import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';
import { Calendar, Download, Filter, ArrowRightLeft, ChevronDown, AlertTriangle, CheckCircle, AlertOctagon, BarChart2 } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import QualityChart from '../../../components/charts/QualityChart';
import { supabase } from '../../../lib/supabase';

interface QualityData {
  date: string;
  rework: number;
  scrap: number;
  other: number;
}

interface QualityMetrics {
  totalIssues: number;
  reworkRate: number;
  scrapRate: number;
  firstPassYield: number;
  trend: number;
}

interface MachineQuality {
  id: string;
  name: string;
  issues: number;
  rework: number;
  scrap: number;
  fpy: number;
  trend: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

type TimeRangeType = '24h' | '7d' | '30d' | '90d';

const QualityReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qualityData, setQualityData] = useState<QualityData[]>([]);
  const [machineQuality, setMachineQuality] = useState<MachineQuality[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [metrics, setMetrics] = useState<QualityMetrics>({
    totalIssues: 0,
    reworkRate: 0,
    scrapRate: 0,
    firstPassYield: 0,
    trend: 0
  });

  useEffect(() => {
    loadData();
  }, [projectId, selectedPeriod]);

  const loadData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      let startDate: Date;
      switch (selectedPeriod) {
        case '24h':
          startDate = subDays(endDate, 1);
          break;
        case '7d':
          startDate = subDays(endDate, 7);
          break;
        case '30d':
          startDate = subDays(endDate, 30);
          break;
        case '90d':
          startDate = subDays(endDate, 90);
          break;
        default:
          startDate = subDays(endDate, 7);
      }

      // Fetch data from Supabase
      const [lotsResult, qualityResult] = await Promise.all([
        supabase
          .from('lots')
          .select(`
            id,
            date,
            lot_size,
            ok_parts_produced,
            machines (id, name)
          `)
          .eq('project_id', projectId)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
        supabase
          .from('quality_issues')
          .select(`
            *,
            machines (id, name)
          `)
          .eq('project_id', projectId)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
      ]);

      if (lotsResult.error) throw lotsResult.error;
      if (qualityResult.error) throw qualityResult.error;

      // Process data by date
      const dateMap = new Map<string, QualityData>();
      const machineMap = new Map<string, MachineQuality>();
      const categoryMap = new Map<string, number>();

      let totalParts = 0;
      let totalDefects = 0;
      let totalRework = 0;
      let totalScrap = 0;

      // Process lots
      lotsResult.data?.forEach(lot => {
        const date = lot.date;
        const machineId = lot.machines?.id;
        const machineName = lot.machines?.name;

        if (!machineId || !machineName) return;

        totalParts += lot.ok_parts_produced;

        // Initialize machine data if not exists
        if (!machineMap.has(machineId)) {
          machineMap.set(machineId, {
            id: machineId,
            name: machineName,
            issues: 0,
            rework: 0,
            scrap: 0,
            fpy: 100,
            trend: 0
          });
        }
      });

      // Process quality issues
      qualityResult.data?.forEach(issue => {
        const date = issue.date;
        const machineId = issue.machine;
        const category = issue.category;
        const quantity = issue.quantity;

        // Update date-based data
        const dateData = dateMap.get(date) || {
          date,
          rework: 0,
          scrap: 0,
          other: 0
        };

        if (category === 'scrap') {
          dateData.scrap += quantity;
          totalScrap += quantity;
        } else if (category.includes('rework')) {
          dateData.rework += quantity;
          totalRework += quantity;
        } else {
          dateData.other += quantity;
        }
        dateMap.set(date, dateData);

        // Update machine-based data
        const machineData = machineMap.get(machineId);
        if (machineData) {
          machineData.issues++;
          if (category === 'scrap') {
            machineData.scrap += quantity;
          } else if (category.includes('rework')) {
            machineData.rework += quantity;
          }
        }

        // Update category breakdown
        const currentCount = categoryMap.get(category) || 0;
        categoryMap.set(category, currentCount + quantity);
        totalDefects += quantity;
      });

      // Calculate final metrics
      const firstPassYield = totalParts > 0 ? ((totalParts - totalDefects) / totalParts) * 100 : 100;
      
      setMetrics({
        totalIssues: totalDefects,
        reworkRate: totalParts > 0 ? (totalRework / totalParts) * 100 : 0,
        scrapRate: totalParts > 0 ? (totalScrap / totalParts) * 100 : 0,
        firstPassYield,
        trend: 0 // Calculate trend based on previous period if needed
      });

      // Calculate category breakdown percentages
      const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: totalDefects > 0 ? (count / totalDefects) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate machine FPY
      machineMap.forEach(machine => {
        const totalDefects = machine.rework + machine.scrap;
        machine.fpy = 100 - ((totalDefects / totalParts) * 100);
      });

      // Convert maps to arrays and sort
      const qualityArray = Array.from(dateMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      const machineArray = Array.from(machineMap.values())
        .sort((a, b) => b.fpy - a.fpy);

      setQualityData(qualityArray);
      setMachineQuality(machineArray);
      setCategoryBreakdown(breakdown);
      setLoading(false);
    } catch (err) {
      console.error('Error loading quality data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality data');
      setLoading(false);
    }
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quality Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze quality metrics and identify improvement opportunities
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {selectedPeriod === '24h' ? 'Last 24 hours' :
                 selectedPeriod === '7d' ? 'Last 7 days' :
                 selectedPeriod === '30d' ? 'Last 30 days' :
                 'Last 90 days'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    {[
                      { value: '24h', label: 'Last 24 hours' },
                      { value: '7d', label: 'Last 7 days' },
                      { value: '30d', label: 'Last 30 days' },
                      { value: '90d', label: 'Last 90 days' }
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => {
                          setSelectedPeriod(period.value as TimeRangeType);
                          setShowPeriodDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {period.label}
                      </button>
                    ))}
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
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <button
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
        ) : (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          First Pass Yield
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {metrics.firstPassYield.toFixed(1)}%
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            <span>↑ 1.2%</span>
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertOctagon className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Quality Issues
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {metrics.totalIssues.toLocaleString()}
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                            <span>↑ 5.4%</span>
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BarChart2 className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Rework Rate
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {metrics.reworkRate.toFixed(1)}%
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-yellow-600">
                            <span>↓ 0.8%</span>
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Scrap Rate
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {metrics.scrapRate.toFixed(1)}%
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                            <span>↑ 0.3%</span>
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Trend Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Quality Trend</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Target FPY:</span>
                  <span className="text-lg font-semibold text-blue-600">98.5%</span>
                </div>
              </div>
              <QualityChart data={qualityData} />
            </div>

            {/* Category Breakdown */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quality Issues by Category</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {categoryBreakdown.map((category) => (
                    <div key={category.category} className="bg-gray-50 rounded-lg p-4">
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {category.category === 'at_station_rework' ? 'At Station Rework' :
                             category.category === 'off_station_rework' ? 'Off Station Rework' :
                             category.category === 'scrap' ? 'Scrap' : category.category}
                          </h4>
                          <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                            <span>{category.count.toLocaleString()} issues</span>
                            <span>{category.percentage.toFixed(1)}% of total</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="relative pt-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                            <div
                              style={{ width: `${category.percentage}%` }}
                              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                category.category === 'scrap' ? 'bg-red-600' :
                                category.category.includes('rework') ? 'bg-yellow-500' :
                                'bg-gray-500'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Machine Quality */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Machine Quality Performance</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {machineQuality.map((machine) => (
                    <div key={machine.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{machine.name}</h4>
                          <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                            <span>{machine.issues} issues</span>
                            <span>{machine.rework} rework</span>
                            <span>{machine.scrap} scrap</span>
                            <span className="font-medium text-blue-600">{machine.fpy.toFixed(1)}% FPY</span>
                          </div>
                        </div>
                        <div className="mt-2 sm:mt-0">
                          <div className="flex items-baseline">
                            <span className={`text-sm font-medium ${
                              machine.trend > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {machine.trend > 0 ? '↑' : '↓'} {Math.abs(machine.trend)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="relative pt-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                            <div
                              style={{ width: `${machine.fpy}%` }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default QualityReport;