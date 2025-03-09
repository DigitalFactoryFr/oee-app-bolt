import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { Calendar, Download, Filter, ArrowRightLeft, ChevronDown, Activity, Gauge, Package, AlertTriangle, Clock, ChevronRight, Calculator } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import OEEChart from '../../../components/charts/OEEChart';
import ProductionChart from '../../../components/charts/ProductionChart';
import DowntimeChart from '../../../components/charts/DowntimeChart';
import QualityChart from '../../../components/charts/QualityChart';
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';
import FilterPanel from '../../../components/reports/FilterPanel';
import { supabase } from '../../../lib/supabase';

const ReportsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  // State for metrics
  const [oeeData, setOeeData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const [downtimeData, setDowntimeData] = useState<any[]>([]);
  const [qualityData, setQualityData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    totalProduction: 0,
    firstPassYield: 0,
    scrapRate: 0
  });

  // Filter states
  const [filterOptions, setFilterOptions] = useState({
    machines: [] as string[],
    lines: [] as string[],
    products: [] as string[],
    teams: [] as string[]
  });

  const [selectedFilters, setSelectedFilters] = useState({
    machines: [] as string[],
    lines: [] as string[],
    products: [] as string[],
    teams: [] as string[]
  });

  useEffect(() => {
    loadData();
    loadFilterOptions();
  }, [projectId, selectedPeriod]);

  const loadFilterOptions = async () => {
    if (!projectId) return;

    try {
      const [machinesResult, linesResult, productsResult, teamsResult] = await Promise.all([
        supabase.from('machines').select('id, name').eq('project_id', projectId),
        supabase.from('production_lines').select('id, name').eq('project_id', projectId),
        supabase.from('products').select('id, name').eq('project_id', projectId),
        supabase.from('team_members').select('id, email, team_name').eq('project_id', projectId)
      ]);

      setFilterOptions({
        machines: machinesResult.data?.map(m => m.name) || [],
        lines: linesResult.data?.map(l => l.name) || [],
        products: productsResult.data?.map(p => p.name) || [],
        teams: teamsResult.data?.map(t => t.team_name) || []
      });
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      // First check if we have any data
      const { count, error: countError } = await supabase
        .from('lots')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);

      if (countError) throw countError;

      if (count === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      setHasData(true);

      // Calculate date range
      const endDate = new Date();
      let startDate: Date;
      switch (selectedPeriod) {
        case 'week':
          startDate = subDays(endDate, 7);
          break;
        case 'month':
          startDate = subDays(endDate, 30);
          break;
        case 'quarter':
          startDate = subDays(endDate, 90);
          break;
        default:
          startDate = subDays(endDate, 7);
      }

      // Fetch all required data
      const [lotsResult, stopsResult, qualityResult] = await Promise.all([
        supabase
          .from('lots')
          .select(`
            id,
            date,
            lot_size,
            ok_parts_produced,
            products (cycle_time)
          `)
          .eq('project_id', projectId)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
        supabase
          .from('stop_events')
          .select('*')
          .eq('project_id', projectId)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
        supabase
          .from('quality_issues')
          .select('*')
          .eq('project_id', projectId)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
      ]);

      if (lotsResult.error) throw lotsResult.error;
      if (stopsResult.error) throw stopsResult.error;
      if (qualityResult.error) throw qualityResult.error;

      // Process data by date
      const dateMap = new Map();
      let totalOEE = 0;
      let totalAvailability = 0;
      let totalPerformance = 0;
      let totalQuality = 0;
      let daysCount = 0;
      let totalProduction = 0;
      let totalScrap = 0;
      let totalDefects = 0;

      // Initialize data for each date
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        dateMap.set(dateStr, {
          date: dateStr,
          oee: 0,
          availability: 100,
          performance: 0,
          quality: 100,
          actual: 0,
          target: 0,
          scrap: 0,
          rework: 0,
          other: 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Process lots
      lotsResult.data?.forEach(lot => {
        const data = dateMap.get(lot.date);
        if (data) {
          data.actual += lot.ok_parts_produced;
          data.target += lot.lot_size;
          totalProduction += lot.ok_parts_produced;

          // Calculate performance
          if (lot.products.cycle_time && lot.lot_size > 0) {
            const theoreticalTime = (lot.products.cycle_time * lot.lot_size) / 60;
            const actualTime = (lot.products.cycle_time * lot.ok_parts_produced) / 60;
            data.performance = (actualTime / theoreticalTime) * 100;
          }
        }
      });

      // Process stops
      stopsResult.data?.forEach(stop => {
        const data = dateMap.get(stop.date);
        if (data) {
          const startTime = new Date(stop.start_time);
          const endTime = stop.end_time ? new Date(stop.end_time) : new Date();
          const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours
          
          if (stop.failure_type === 'AP') {
            data.availability = Math.max(0, data.availability - (duration / 24) * 100);
          }
        }
      });

      // Process quality issues
      qualityResult.data?.forEach(issue => {
        const data = dateMap.get(issue.date);
        if (data) {
          if (issue.category === 'scrap') {
            data.scrap += issue.quantity;
            totalScrap += issue.quantity;
          } else if (issue.category.includes('rework')) {
            data.rework += issue.quantity;
          } else {
            data.other += issue.quantity;
          }
          totalDefects += issue.quantity;
        }
      });

      // Calculate final metrics for each date
      const oeeData = [];
      const productionData = [];
      const qualityData = [];

      dateMap.forEach((data, date) => {
        if (data.target > 0) {
          daysCount++;

          // Calculate quality
          data.quality = ((data.target - data.scrap) / data.target) * 100;

          // Calculate OEE
          data.oee = (data.availability * data.performance * data.quality) / 10000;

          // Update totals
          totalOEE += data.oee;
          totalAvailability += data.availability;
          totalPerformance += data.performance;
          totalQuality += data.quality;

          // Push to chart data arrays
          oeeData.push({
            date,
            oee: data.oee,
            availability: data.availability,
            performance: data.performance,
            quality: data.quality
          });

          productionData.push({
            date,
            actual: data.actual,
            target: data.target,
            scrap: data.scrap
          });

          qualityData.push({
            date,
            rework: data.rework,
            scrap: data.scrap,
            other: data.other
          });
        }
      });

      // Calculate downtime distribution
      const downtimeData = stopsResult.data?.reduce((acc: any, stop) => {
        const type = stop.failure_type;
        const startTime = new Date(stop.start_time);
        const endTime = stop.end_time ? new Date(stop.end_time) : new Date();
        const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours

        const existingType = acc.find((d: any) => d.name === type);
        if (existingType) {
          existingType.value += duration;
        } else {
          acc.push({
            name: type,
            value: duration,
            color: type === 'AP' ? '#2563eb' :
                   type === 'PA' ? '#dc2626' :
                   type === 'DO' ? '#eab308' :
                   type === 'NQ' ? '#9333ea' :
                   '#16a34a'
          });
        }
        return acc;
      }, []);

      // Set state
      setOeeData(oeeData);
      setProductionData(productionData);
      setQualityData(qualityData);
      setDowntimeData(downtimeData || []);

      // Calculate global metrics
      if (daysCount > 0) {
        setMetrics({
          oee: totalOEE / daysCount,
          availability: totalAvailability / daysCount,
          performance: totalPerformance / daysCount,
          quality: totalQuality / daysCount,
          totalProduction,
          firstPassYield: totalProduction > 0 ? ((totalProduction - totalDefects) / totalProduction) * 100 : 0,
          scrapRate: totalProduction > 0 ? (totalScrap / totalProduction) * 100 : 0
        });
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading report data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report data');
      setLoading(false);
    }
  };

  const handleComparisonSelect = (type: string) => {
    setComparisonType(type);
    setShowCompareModal(false);
    setShowComparisonSelector(true);
  };

  const handleComparisonItems = async (items: string[]) => {
    setShowComparisonSelector(false);
  };

  const handleFilterChange = (category: string, values: string[]) => {
    setSelectedFilters(prev => ({
      ...prev,
      [category]: values
    }));
  };

  const handleClearFilters = () => {
    setSelectedFilters({
      machines: [],
      lines: [],
      products: [],
      teams: []
    });
  };

  const handleExport = () => {
    const exportData = {
      oee: oeeData,
      production: productionData,
      quality: qualityData,
      downtime: downtimeData
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_report_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze your production performance and identify improvement opportunities
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {selectedPeriod === 'week' ? 'Last 7 days' : 
                 selectedPeriod === 'month' ? 'Last 30 days' : 
                 selectedPeriod === 'quarter' ? 'Last 90 days' : 'Custom'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedPeriod('week');
                        setShowPeriodDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Last 7 days
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPeriod('month');
                        setShowPeriodDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Last 30 days
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPeriod('quarter');
                        setShowPeriodDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Last 90 days
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowCompareModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Compare
            </button>
            <button
              onClick={() => setShowFilterPanel(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        ) : !hasData ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Production Data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start recording production data to see analytics and reports.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">OEE Overview</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-blue-600">{metrics.oee.toFixed(1)}%</span>
                  <span className="text-sm text-green-600">↑ 2.3%</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{metrics.availability.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Availability</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{metrics.performance.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Performance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{metrics.quality.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Quality</div>
                </div>
              </div>
              <OEEChart data={oeeData} />
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Production Trends</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">{metrics.totalProduction.toLocaleString()}</span>
                  <span className="text-sm text-green-600">↑ 5.7%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">{metrics.firstPassYield.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">First Pass Yield</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">{metrics.scrapRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Scrap Rate</div>
                </div>
              </div>
              <ProductionChart data={productionData} />
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Downtime Analysis</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">24.5h</span>
                  <span className="text-red-600">↑ 1.2h</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">15</div>
                  <div className="text-sm text-gray-500">Stop Events</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">98min</div>
                  <div className="text-sm text-gray-500">Avg. Duration</div>
                </div>
              </div>
              <DowntimeChart data={downtimeData} />
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Quality Issues</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">187</span>
                  <span className="text-red-600">↑ 12</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">45</div>
                  <div className="text-sm text-gray-500">Rework</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">32</div>
                  <div className="text-sm text-gray-500">Scrap</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">110</div>
                  <div className="text-sm text-gray-500">Other</div>
                </div>
              </div>
              <QualityChart data={qualityData} />
            </div>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Reports</h3>
          <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
            {[
              {
                id: 'oee',
                title: 'OEE Report',
                description: 'Detailed analysis of Overall Equipment Effectiveness',
                path: 'oee',
                icon: Gauge
              },
              {
                id: 'oee-draft',
                title: 'OEE Draft Calculations',
                description: 'Experimental OEE calculations with detailed metrics',
                path: 'oee-draft',
                icon: Calculator
              },
              {
                id: 'production',
                title: 'Production Report',
                description: 'Production volumes, efficiency, and trends',
                path: 'production',
                icon: Package
              },
              {
                id: 'quality',
                title: 'Quality Report',
                description: 'Quality metrics, defects analysis, and trends',
                path: 'quality',
                icon: AlertTriangle
              },
              {
                id: 'downtime',
                title: 'Downtime Report',
                description: 'Analysis of stops, causes, and impact',
                path: 'downtime',
                icon: Clock
              }
            ].map((section) => {
              const Icon = section.icon;
              return (
                <div 
                  key={section.id}
                  onClick={() => navigate(`/projects/${projectId}/reports/${section.path}`)}
                  className="p-6 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Icon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-base font-medium text-gray-900">{section.title}</h4>
                        <p className="mt-1 text-sm text-gray-500">{section.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modals */}
        <ComparisonModal
          isVisible={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          onCompare={handleComparisonSelect}
          projectId={projectId || ''}
        />

        <ComparisonSelector
          isVisible={showComparisonSelector}
          onClose={() => setShowComparisonSelector(false)}
          type={comparisonType}
          projectId={projectId || ''}
          onSelect={handleComparisonItems}
          onCompare={handleComparisonItems}
        />

        <FilterPanel
          isVisible={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          options={filterOptions}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      </div>
    </ProjectLayout>
  );
};

export default ReportsPage;