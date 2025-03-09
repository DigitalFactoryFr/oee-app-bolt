import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays, parseISO, differenceInMinutes } from 'date-fns';
import { Calendar, Download, Filter, ArrowRightLeft, ChevronDown, Clock, PenTool as Tool, AlertTriangle, Settings } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import DowntimeChart from '../../../components/charts/DowntimeChart';
import { supabase } from '../../../lib/supabase';

interface DowntimeData {
  name: string;
  value: number;
  color: string;
}

interface DowntimeMetrics {
  totalDowntime: number;
  plannedDowntime: number;
  unplannedDowntime: number;
  mtbf: number;
  mttr: number;
  availability: number;
}

interface MachineDowntime {
  id: string;
  name: string;
  downtime: number;
  stops: number;
  mttr: number;
  availability: number;
  trend: number;
}

interface FailureBreakdown {
  type: string;
  count: number;
  duration: number;
  percentage: number;
}

type TimeRangeType = '24h' | '7d' | '30d' | '90d';

const DowntimeReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downtimeData, setDowntimeData] = useState<DowntimeData[]>([]);
  const [machineDowntime, setMachineDowntime] = useState<MachineDowntime[]>([]);
  const [failureBreakdown, setFailureBreakdown] = useState<FailureBreakdown[]>([]);
  const [metrics, setMetrics] = useState<DowntimeMetrics>({
    totalDowntime: 0,
    plannedDowntime: 0,
    unplannedDowntime: 0,
    mtbf: 0,
    mttr: 0,
    availability: 0
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
      const [stopsResult, lotsResult] = await Promise.all([
        supabase
          .from('stop_events')
          .select(`
            *,
            machines (id, name)
          `)
          .eq('project_id', projectId)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
        supabase
          .from('lots')
          .select(`
            id,
            date,
            start_time,
            end_time,
            machines (id, name)
          `)
          .eq('project_id', projectId)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
      ]);

      if (stopsResult.error) throw stopsResult.error;
      if (lotsResult.error) throw lotsResult.error;

      // Process data
      const machineMap = new Map<string, MachineDowntime>();
      const failureMap = new Map<string, { count: number; duration: number }>();
      
      let totalDowntime = 0;
      let plannedDowntime = 0;
      let unplannedDowntime = 0;
      let totalStops = 0;
      let totalRepairTime = 0;

      // Initialize downtime categories
      const downtimeCategories = new Map([
        ['AP', { name: 'Planned', value: 0, color: '#2563eb' }],
        ['PA', { name: 'Breakdown', value: 0, color: '#dc2626' }],
        ['DO', { name: 'Organized', value: 0, color: '#eab308' }],
        ['NQ', { name: 'Quality', value: 0, color: '#9333ea' }],
        ['CS', { name: 'Setup', value: 0, color: '#16a34a' }]
      ]);

      // Process stops
      stopsResult.data?.forEach(stop => {
        const machineId = stop.machine;
        const machineName = stop.machines?.name;
        const failureType = stop.failure_type;
        
        const startTime = new Date(stop.start_time);
        const endTime = stop.end_time ? new Date(stop.end_time) : new Date();
        const duration = differenceInMinutes(endTime, startTime);

        // Update total metrics
        totalDowntime += duration;
        totalStops++;
        totalRepairTime += duration;

        if (failureType === 'AP') {
          plannedDowntime += duration;
        } else {
          unplannedDowntime += duration;
        }

        // Update downtime categories
        const category = downtimeCategories.get(failureType);
        if (category) {
          category.value += duration / 60; // Convert to hours
        }

        // Update machine metrics
        if (machineId && machineName) {
          const machineData = machineMap.get(machineId) || {
            id: machineId,
            name: machineName,
            downtime: 0,
            stops: 0,
            mttr: 0,
            availability: 100,
            trend: 0
          };

          machineData.downtime += duration;
          machineData.stops++;
          machineMap.set(machineId, machineData);
        }

        // Update failure type breakdown
        const failureData = failureMap.get(failureType) || { count: 0, duration: 0 };
        failureData.count++;
        failureData.duration += duration;
        failureMap.set(failureType, failureData);
      });

      // Calculate machine availability and MTTR
      machineMap.forEach(machine => {
        const totalMinutes = differenceInMinutes(endDate, startDate);
        machine.availability = ((totalMinutes - machine.downtime) / totalMinutes) * 100;
        machine.mttr = machine.stops > 0 ? machine.downtime / machine.stops : 0;
      });

      // Calculate failure breakdown percentages
      const breakdownData: FailureBreakdown[] = Array.from(failureMap.entries())
        .map(([type, data]) => ({
          type,
          count: data.count,
          duration: data.duration,
          percentage: (data.duration / totalDowntime) * 100
        }))
        .sort((a, b) => b.duration - a.duration);

      // Calculate final metrics
      const totalMinutes = differenceInMinutes(endDate, startDate);
      const availability = ((totalMinutes - totalDowntime) / totalMinutes) * 100;
      const mttr = totalStops > 0 ? totalRepairTime / totalStops : 0;
      const mtbf = totalStops > 0 ? (totalMinutes - totalDowntime) / totalStops : totalMinutes;

      setMetrics({
        totalDowntime,
        plannedDowntime,
        unplannedDowntime,
        mtbf,
        mttr,
        availability
      });

      setDowntimeData(Array.from(downtimeCategories.values()));
      setMachineDowntime(Array.from(machineMap.values()).sort((a, b) => b.downtime - a.downtime));
      setFailureBreakdown(breakdownData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading downtime data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load downtime data');
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Downtime Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze equipment downtime and maintenance metrics
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
                      <Clock className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Downtime
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {formatDuration(metrics.totalDowntime)}
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
                      <Settings className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Availability
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {metrics.availability.toFixed(1)}%
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
                      <Tool className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          MTTR
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {formatDuration(metrics.mttr)}
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                            <span>↑ 12m</span>
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
                          MTBF
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {formatDuration(metrics.mtbf)}
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            <span>↑ 1.5h</span>
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Downtime Distribution Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Downtime Distribution</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Total:</span>
                  <span className="text-lg font-semibold text-blue-600">
                    {formatDuration(metrics.totalDowntime)}
                  </span>
                </div>
              </div>
              <DowntimeChart data={downtimeData} />
            </div>

            {/* Failure Type Breakdown */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Failure Analysis</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {failureBreakdown.map((failure) => (
                    <div key={failure.type} className="bg-gray-50 rounded-lg p-4">
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {failure.type === 'AP' ? 'Planned Downtime' :
                             failure.type === 'PA' ? 'Equipment Breakdown' :
                             failure.type === 'DO' ? 'Organized Malfunction' :
                             failure.type === 'NQ' ? 'Quality Issue' :
                             failure.type === 'CS' ? 'Series Change' :
                             failure.type}
                          </h4>
                          <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                            <span>{failure.count} occurrences</span>
                            <span>{formatDuration(failure.duration)}</span>
                            <span>{failure.percentage.toFixed(1)}% of total</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="relative pt-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                            <div
                              style={{ width: `${failure.percentage}%` }}
                              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                failure.type === 'AP' ? 'bg-blue-600' :
                                failure.type === 'PA' ? 'bg-red-600' :
                                failure.type === 'DO' ? 'bg-yellow-500' :
                                failure.type === 'NQ' ? 'bg-purple-600' :
                                'bg-green-600'
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

            {/* Machine Downtime */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Machine Downtime</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {machineDowntime.map((machine) => (
                    <div key={machine.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{machine.name}</h4>
                          <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                            <span>{machine.stops} stops</span>
                            <span>{formatDuration(machine.downtime)} total</span>
                            <span>{formatDuration(machine.mttr)} MTTR</span>
                            <span className="font-medium text-blue-600">{machine.availability.toFixed(1)}% availability</span>
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
                              style={{ width: `${machine.availability}%` }}
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

export default DowntimeReport;