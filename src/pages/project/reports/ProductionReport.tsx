import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';
import { Calendar, Download, Filter, ArrowRightLeft, ChevronDown, Activity, Package, AlertTriangle, Clock } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import ProductionChart from '../../../components/charts/ProductionChart';
import { supabase } from '../../../lib/supabase';

interface ProductionData {
  date: string;
  actual: number;
  target: number;
  scrap: number;
}

interface ProductionMetrics {
  totalProduction: number;
  averageEfficiency: number;
  scrapRate: number;
  trend: number;
}

interface MachineProduction {
  id: string;
  name: string;
  production: number;
  efficiency: number;
  scrap: number;
  trend: number;
}

type TimeRangeType = '24h' | '7d' | '30d' | '90d';

const ProductionReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [machineProduction, setMachineProduction] = useState<MachineProduction[]>([]);
  const [metrics, setMetrics] = useState<ProductionMetrics>({
    totalProduction: 0,
    averageEfficiency: 0,
    scrapRate: 0,
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
            theoretical_lot_size,
            machines (id, name)
          `)
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
      if (qualityResult.error) throw qualityResult.error;

      // Process data by date
      const dateMap = new Map<string, ProductionData>();
      const machineMap = new Map<string, MachineProduction>();

      let totalProduction = 0;
      let totalEfficiency = 0;
      let totalScrap = 0;
      let lotCount = 0;

      // Process lots
      lotsResult.data?.forEach(lot => {
        const date = lot.date;
        const machineId = lot.machines?.id;
        const machineName = lot.machines?.name;

        if (!machineId || !machineName) return;

        // Update date-based data
        const dateData = dateMap.get(date) || {
          date,
          actual: 0,
          target: 0,
          scrap: 0
        };

        dateData.actual += lot.ok_parts_produced;
        dateData.target += lot.theoretical_lot_size || 0;
        dateMap.set(date, dateData);

        // Update machine-based data
        const machineData = machineMap.get(machineId) || {
          id: machineId,
          name: machineName,
          production: 0,
          efficiency: 0,
          scrap: 0,
          trend: 0
        };

        machineData.production += lot.ok_parts_produced;
        if (lot.theoretical_lot_size) {
          machineData.efficiency = (lot.ok_parts_produced / lot.theoretical_lot_size) * 100;
        }
        machineMap.set(machineId, machineData);

        // Update totals
        totalProduction += lot.ok_parts_produced;
        if (lot.theoretical_lot_size) {
          totalEfficiency += (lot.ok_parts_produced / lot.theoretical_lot_size) * 100;
          lotCount++;
        }
      });

      // Process quality issues
      qualityResult.data?.forEach(issue => {
        const date = issue.date;
        const machineId = issue.machine;

        if (issue.category === 'scrap') {
          // Update date-based scrap
          const dateData = dateMap.get(date);
          if (dateData) {
            dateData.scrap += issue.quantity;
            totalScrap += issue.quantity;
          }

          // Update machine-based scrap
          const machineData = machineMap.get(machineId);
          if (machineData) {
            machineData.scrap += issue.quantity;
          }
        }
      });

      // Calculate final metrics
      setMetrics({
        totalProduction,
        averageEfficiency: lotCount > 0 ? totalEfficiency / lotCount : 0,
        scrapRate: totalProduction > 0 ? (totalScrap / totalProduction) * 100 : 0,
        trend: 0 // Calculate trend based on previous period if needed
      });

      // Convert maps to arrays and sort
      const productionArray = Array.from(dateMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      const machineArray = Array.from(machineMap.values())
        .sort((a, b) => b.production - a.production);

      setProductionData(productionArray);
      setMachineProduction(machineArray);
      setLoading(false);
    } catch (err) {
      console.error('Error loading production data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load production data');
      setLoading(false);
    }
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Production Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze production performance and efficiency metrics
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
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Production
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {metrics.totalProduction.toLocaleString()}
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            <span>parts</span>
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
                      <Activity className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Average Efficiency
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {metrics.averageEfficiency.toFixed(1)}%
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            <span>↑ 2.3%</span>
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
                            <span>↑ 0.8%</span>
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
                      <Clock className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Production Time
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            98.5%
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
            </div>

            {/* Production Trend Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Production Trend</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Target Achievement:</span>
                  <span className="text-lg font-semibold text-green-600">94.8%</span>
                </div>
              </div>
              <ProductionChart data={productionData} />
            </div>

            {/* Machine Production */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Machine Production</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {machineProduction.map((machine) => (
                    <div key={machine.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{machine.name}</h4>
                          <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                            <span>{machine.production.toLocaleString()} parts</span>
                            <span>{machine.efficiency.toFixed(1)}% efficiency</span>
                            <span>{machine.scrap} scrapped</span>
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
                              style={{ width: `${machine.efficiency}%` }}
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

export default ProductionReport;