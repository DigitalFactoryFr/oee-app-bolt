import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { Calendar, Download, Filter, ChevronDown, Activity, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import OEEChart from '../../../components/charts/OEEChart';
import { supabase } from '../../../lib/supabase';

interface OEEData {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

interface MachineOEEMetrics {
  name: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  trend: number;
  historicalData: OEEData[];
  hasData: boolean;
}

interface GlobalOEEMetrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  trend: number;
  hasData: boolean;
}

type TimeRangeType = 'week' | 'month' | 'quarter';

const OEEReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [machineMetrics, setMachineMetrics] = useState<Record<string, MachineOEEMetrics>>({});
  const [globalMetrics, setGlobalMetrics] = useState<GlobalOEEMetrics>({
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    trend: 0,
    hasData: false
  });

  useEffect(() => {
    loadData();
  }, [projectId, selectedPeriod]);

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

      // If no data exists, set empty state and return early
      if (count === 0) {
        setMachineMetrics({});
        setGlobalMetrics({
          oee: 0,
          availability: 0,
          performance: 0,
          quality: 0,
          trend: 0,
          hasData: false
        });
        setLoading(false);
        return;
      }

      // Calculate date ranges
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

      // Fetch machines with their names
      const { data: machines, error: machinesError } = await supabase
        .from('machines')
        .select('id, name')
        .eq('project_id', projectId);

      if (machinesError) throw machinesError;

      const metricsData: Record<string, MachineOEEMetrics> = {};
      let globalTotalOEE = 0;
      let globalTotalAvailability = 0;
      let globalTotalQuality = 0;
      let globalTotalPerformance = 0;
      let globalDataCount = 0;

      for (const machine of machines) {
        // Fetch lots, stops, and product info for the machine
        const [lotsResult, stopsResult, productResult] = await Promise.all([
          supabase
            .from('lots')
            .select(`
              id,
              date,
              start_time,
              end_time,
              lot_size,
              ok_parts_produced,
              products (cycle_time)
            `)
            .eq('machine', machine.id)
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .lte('date', format(endDate, 'yyyy-MM-dd')),
          supabase
            .from('stop_events')
            .select('*')
            .eq('machine', machine.id)
            .eq('failure_type', 'AP') // Only planned stops
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .lte('date', format(endDate, 'yyyy-MM-dd')),
          supabase
            .from('machines')
            .select('opening_time_minutes')
            .eq('id', machine.id)
            .single()
        ]);

        if (lotsResult.error) throw lotsResult.error;
        if (stopsResult.error) throw stopsResult.error;
        if (productResult.error) throw productResult.error;

        const dateMap = new Map<string, OEEData>();
        let totalOEE = 0;
        let totalAvailability = 0;
        let totalQuality = 0;
        let totalPerformance = 0;
        let daysWithData = 0;

        // Initialize data for each date
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          dateMap.set(dateStr, {
            date: dateStr,
            oee: 0,
            availability: 100,
            performance: 0,
            quality: 100
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Process each date's data
        dateMap.forEach((data, date) => {
          const dayLots = lotsResult.data?.filter(lot => lot.date === date) || [];
          const dayStops = stopsResult.data?.filter(stop => stop.date === date) || [];

          if (dayLots.length === 0) return; // Skip days without data

          // Calculate total opening time in minutes
          const openingTime = productResult.data?.opening_time_minutes || 480; // Default 8 hours

          // Calculate planned downtime
          const plannedDowntime = dayStops.reduce((total, stop) => {
            const start = new Date(stop.start_time);
            const end = stop.end_time ? new Date(stop.end_time) : new Date();
            return total + (end.getTime() - start.getTime()) / (1000 * 60);
          }, 0);

          // Calculate actual production time
          const availableTime = openingTime - plannedDowntime;
          
          // Calculate OEE components for each lot
          let totalOKParts = 0;
          let totalParts = 0;
          let theoreticalCycleTime = 0;

          dayLots.forEach(lot => {
            totalOKParts += lot.ok_parts_produced;
            totalParts += lot.lot_size;
            theoreticalCycleTime = lot.products.cycle_time;
          });

          // Calculate metrics only if we have production data
          if (totalParts > 0) {
            daysWithData++;

            // Quality = Good Parts / Total Parts
            data.quality = (totalOKParts / totalParts) * 100;

            // Availability = Actual Production Time / Planned Production Time
            data.availability = (availableTime / openingTime) * 100;

            // Calculate theoretical production time
            const theoreticalProductionTime = (theoreticalCycleTime * totalParts) / 60; // Convert to minutes

            // Calculate actual production time
            const actualProductionTime = (theoreticalCycleTime * totalOKParts) / 60;

            // Calculate Performance
            data.performance = (actualProductionTime / theoreticalProductionTime) * 100;

            // Calculate OEE
            data.oee = (data.availability * data.performance * data.quality) / 10000;

            // Update totals
            totalOEE += data.oee;
            totalAvailability += data.availability;
            totalQuality += data.quality;
            totalPerformance += data.performance;
          }

          // Ensure all metrics are between 0 and 100
          data.availability = Math.min(100, Math.max(0, data.availability));
          data.performance = Math.min(100, Math.max(0, data.performance));
          data.quality = Math.min(100, Math.max(0, data.quality));
          data.oee = Math.min(100, Math.max(0, data.oee));
        });

        // Calculate trend and store metrics
        const historicalData = Array.from(dateMap.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .filter(data => data.oee > 0); // Only include days with data

        const lastDay = historicalData[historicalData.length - 1]?.oee || 0;
        const previousDay = historicalData[historicalData.length - 2]?.oee || 0;
        const trend = lastDay - previousDay;

        if (daysWithData > 0) {
          metricsData[machine.id] = {
            name: machine.name,
            oee: totalOEE / daysWithData,
            availability: totalAvailability / daysWithData,
            quality: totalQuality / daysWithData,
            performance: totalPerformance / daysWithData,
            trend,
            historicalData,
            hasData: daysWithData > 0
          };

          // Update global totals
          globalTotalOEE += totalOEE;
          globalTotalAvailability += totalAvailability;
          globalTotalQuality += totalQuality;
          globalTotalPerformance += totalPerformance;
          globalDataCount += daysWithData;
        }
      }

      // Calculate global metrics
      if (globalDataCount > 0) {
        setGlobalMetrics({
          oee: globalTotalOEE / globalDataCount,
          availability: globalTotalAvailability / globalDataCount,
          quality: globalTotalQuality / globalDataCount,
          performance: globalTotalPerformance / globalDataCount,
          trend: 0, // Calculate global trend if needed
          hasData: true
        });
      }

      setMachineMetrics(metricsData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading OEE data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load OEE data');
      setLoading(false);
    }
  };

  const getMetricColor = (value: number) => {
    if (value >= 95) return 'text-green-600';
    if (value >= 85) return 'text-blue-600';
    if (value >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMetricBgColor = (value: number) => {
    if (value >= 95) return 'bg-green-50';
    if (value >= 85) return 'bg-blue-50';
    if (value >= 75) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">OEE Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Detailed analysis of Overall Equipment Effectiveness by machine
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
                 'Last 90 days'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    {[
                      { value: 'week', label: 'Last 7 days' },
                      { value: 'month', label: 'Last 30 days' },
                      { value: 'quarter', label: 'Last 90 days' }
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
        ) : !globalMetrics.hasData ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Production Data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start recording production data to see OEE metrics and analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global OEE Summary */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Global Performance</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className={`${getMetricBgColor(globalMetrics.oee)} rounded-lg p-4`}>
                    <h4 className="text-sm font-medium text-gray-500">Global OEE</h4>
                    <p className={`text-3xl font-bold ${getMetricColor(globalMetrics.oee)}`}>
                      {globalMetrics.oee.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`${getMetricBgColor(globalMetrics.availability)} rounded-lg p-4`}>
                    <h4 className="text-sm font-medium text-gray-500">Global Availability</h4>
                    <p className={`text-3xl font-bold ${getMetricColor(globalMetrics.availability)}`}>
                      {globalMetrics.availability.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`${getMetricBgColor(globalMetrics.performance)} rounded-lg p-4`}>
                    <h4 className="text-sm font-medium text-gray-500">Global Performance</h4>
                    <p className={`text-3xl font-bold ${getMetricColor(globalMetrics.performance)}`}>
                      {globalMetrics.performance.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`${getMetricBgColor(globalMetrics.quality)} rounded-lg p-4`}>
                    <h4 className="text-sm font-medium text-gray-500">Global Quality</h4>
                    <p className={`text-3xl font-bold ${getMetricColor(globalMetrics.quality)}`}>
                      {globalMetrics.quality.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Machine Analysis */}
            {Object.entries(machineMetrics)
              .filter(([_, metrics]) => metrics.hasData)
              .map(([machineId, metrics]) => (
                <div key={machineId} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">{metrics.name}</h3>
                      {metrics.trend !== 0 && (
                        <div className={`flex items-center ${metrics.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {metrics.trend >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                          <span className="ml-1">{Math.abs(metrics.trend).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`${getMetricBgColor(metrics.oee)} rounded-lg p-4`}>
                          <h4 className="text-sm font-medium text-gray-500">OEE</h4>
                          <p className={`text-3xl font-bold ${getMetricColor(metrics.oee)}`}>
                            {metrics.oee.toFixed(1)}%
                          </p>
                        </div>
                        <div className={`${getMetricBgColor(metrics.availability)} rounded-lg p-4`}>
                          <h4 className="text-sm font-medium text-gray-500">Availability</h4>
                          <p className={`text-3xl font-bold ${getMetricColor(metrics.availability)}`}>
                            {metrics.availability.toFixed(1)}%
                          </p>
                        </div>
                        <div className={`${getMetricBgColor(metrics.performance)} rounded-lg p-4`}>
                          <h4 className="text-sm font-medium text-gray-500">Performance</h4>
                          <p className={`text-3xl font-bold ${getMetricColor(metrics.performance)}`}>
                            {metrics.performance.toFixed(1)}%
                          </p>
                        </div>
                        <div className={`${getMetricBgColor(metrics.quality)} rounded-lg p-4`}>
                          <h4 className="text-sm font-medium text-gray-500">Quality</h4>
                          <p className={`text-3xl font-bold ${getMetricColor(metrics.quality)}`}>
                            {metrics.quality.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Trend Chart */}
                      {metrics.historicalData.length > 0 && (
                        <div className="h-64">
                          <OEEChart
                            data={metrics.historicalData}
                            showComparison={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default OEEReport;