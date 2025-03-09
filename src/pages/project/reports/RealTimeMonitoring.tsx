import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, addHours, isSameDay, parseISO, differenceInMinutes, subHours, subDays } from 'date-fns';
import { Activity, AlertTriangle, ArrowDown, ArrowUp, Clock, Search, Zap } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useProductionLineStore } from '../../../store/productionLineStore';
import { useMachineStore } from '../../../store/machineStore';
import { useProductStore } from '../../../store/productStore';
import { supabase } from '../../../lib/supabase';

interface TimelineEvent {
  id: string;
  type: 'production' | 'stop' | 'quality' | 'idle';
  machine: string;
  startTime: string;
  endTime?: string;
  status: string;
  details: {
    product?: string;
    lotId?: string;
    cause?: string;
    category?: string;
  };
}

interface MachineMetrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  partsProduced: number;
  defects: number;
  trend: number;
}

type TimeRangeType = '12h' | '24h' | '7d';

const RealTimeMonitoring: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { lines } = useProductionLineStore();
  const { machines, fetchMachines } = useMachineStore();
  const { products } = useProductStore();
  
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [machineMetrics, setMachineMetrics] = useState<Record<string, MachineMetrics>>({});
  const [timeRange, setTimeRange] = useState<TimeRangeType>('12h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState<'all' | 'running' | 'stopped'>('all');

  useEffect(() => {
    if (projectId) {
      fetchMachines(projectId);
      const subscription = supabase
        .channel('real-time-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'lots',
          filter: `project_id=eq.${projectId}`
        }, () => fetchData())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'stop_events',
          filter: `project_id=eq.${projectId}`
        }, () => fetchData())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'quality_issues',
          filter: `project_id=eq.${projectId}`
        }, () => fetchData())
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [projectId, selectedLine, timeRange]);

  const getStartTime = (now: Date) => {
    switch (timeRange) {
      case '12h':
        return subHours(now, 12);
      case '24h':
        return subHours(now, 24);
      case '7d':
        return subDays(now, 7);
      default:
        return subHours(now, 12);
    }
  };

  const fetchData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const startTime = getStartTime(now);

      // Fetch active lots
      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select(`
          id,
          start_time,
          end_time,
          product:products(name),
          machine:machines(name, id),
          lot_id,
          ok_parts_produced,
          lot_size,
          theoretical_lot_size,
          status
        `)
        .eq('project_id', projectId)
        .gte('start_time', startTime.toISOString());

      if (lotsError) throw lotsError;

      // Fetch stops
      const { data: stops, error: stopsError } = await supabase
        .from('stop_events')
        .select(`
          id,
          start_time,
          end_time,
          machine:machines(name, id),
          failure_type,
          cause,
          status
        `)
        .eq('project_id', projectId)
        .gte('start_time', startTime.toISOString());

      if (stopsError) throw stopsError;

      // Fetch quality issues
      const { data: qualityIssues, error: qualityError } = await supabase
        .from('quality_issues')
        .select(`
          id,
          start_time,
          end_time,
          machine:machines(name, id),
          category,
          cause,
          status,
          quantity
        `)
        .eq('project_id', projectId)
        .gte('start_time', startTime.toISOString());

      if (qualityError) throw qualityError;

      // Build timeline events and calculate metrics for each machine
      const events: TimelineEvent[] = [];
      const metrics: Record<string, MachineMetrics> = {};

      // Initialize metrics for all machines
      machines.forEach(machine => {
        metrics[machine.id] = {
          oee: 0,
          availability: 0,
          performance: 0,
          quality: 100,
          partsProduced: 0,
          defects: 0,
          trend: 0
        };

        // Add idle state for the full time range
        events.push({
          id: `idle-${machine.id}`,
          type: 'idle',
          machine: machine.name,
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
          status: 'idle',
          details: {
            cause: 'No active lot'
          }
        });
      });

      // Process lots and calculate metrics
      if (lots) {
        lots.forEach(lot => {
          events.push({
            id: lot.id,
            type: 'production',
            machine: lot.machine.name,
            startTime: lot.start_time,
            endTime: lot.end_time || now.toISOString(),
            status: lot.status,
            details: {
              product: lot.product.name,
              lotId: lot.lot_id
            }
          });

          // Update machine metrics
          if (metrics[lot.machine.id]) {
            metrics[lot.machine.id].partsProduced += lot.ok_parts_produced || 0;
            if (lot.theoretical_lot_size) {
              metrics[lot.machine.id].performance = (lot.ok_parts_produced / lot.theoretical_lot_size) * 100;
            }
          }
        });
      }

      // Process stops
      if (stops) {
        stops.forEach(stop => {
          events.push({
            id: stop.id,
            type: 'stop',
            machine: stop.machine.name,
            startTime: stop.start_time,
            endTime: stop.end_time || now.toISOString(),
            status: stop.status,
            details: {
              cause: `${stop.failure_type}: ${stop.cause}`
            }
          });

          // Update machine metrics
          if (metrics[stop.machine.id]) {
            const duration = stop.end_time ? 
              differenceInMinutes(new Date(stop.end_time), new Date(stop.start_time)) : 
              differenceInMinutes(now, new Date(stop.start_time));
            
            const totalMinutes = timeRange === '7d' ? 7 * 24 * 60 : parseInt(timeRange) * 60;
            metrics[stop.machine.id].availability = Math.max(0, 100 - (duration / totalMinutes) * 100);
          }
        });
      }

      // Process quality issues
      if (qualityIssues) {
        qualityIssues.forEach(issue => {
          events.push({
            id: issue.id,
            type: 'quality',
            machine: issue.machine.name,
            startTime: issue.start_time,
            endTime: issue.end_time || now.toISOString(),
            status: issue.status,
            details: {
              category: issue.category,
              cause: issue.cause
            }
          });

          // Update machine metrics
          if (metrics[issue.machine.id]) {
            metrics[issue.machine.id].defects += issue.quantity;
            if (metrics[issue.machine.id].partsProduced > 0) {
              metrics[issue.machine.id].quality = ((metrics[issue.machine.id].partsProduced - metrics[issue.machine.id].defects) / metrics[issue.machine.id].partsProduced) * 100;
            }
          }
        });
      }

      // Calculate final OEE for each machine
      Object.keys(metrics).forEach(machineId => {
        const m = metrics[machineId];
        m.oee = (m.availability * m.performance * m.quality) / 10000;
      });

      setTimelineEvents(events);
      setMachineMetrics(metrics);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    }
  };

  const getEventColor = (event: TimelineEvent) => {
    switch (event.type) {
      case 'production':
        return 'bg-green-500';
      case 'stop':
        return 'bg-red-500';
      case 'quality':
        return 'bg-yellow-500';
      case 'idle':
        return 'bg-gray-300';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredMachines = machines
    .filter(machine => selectedLine === 'all' || machine.line_id === selectedLine)
    .filter(machine => {
      const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (machineFilter === 'all') return matchesSearch;
      
      const machineEvents = timelineEvents.filter(event => event.machine === machine.name);
      const isRunning = !machineEvents.some(event => 
        (event.type === 'stop' && event.status === 'ongoing') ||
        (event.type === 'idle' && !machineEvents.some(e => e.type === 'production'))
      );
      
      return matchesSearch && (
        (machineFilter === 'running' && isRunning) ||
        (machineFilter === 'stopped' && !isRunning)
      );
    });

  const renderTimeline = () => {
    const now = new Date();
    const startTime = getStartTime(now);

    // Calculate time slots based on range
    let slotWidth: number;
    let slotInterval: number;
    let formatPattern: string;

    switch (timeRange) {
      case '12h':
        slotWidth = 120;
        slotInterval = 1;
        formatPattern = 'HH:mm';
        break;
      case '24h':
        slotWidth = 80;
        slotInterval = 2;
        formatPattern = 'HH:mm';
        break;
      case '7d':
        slotWidth = 100;
        slotInterval = 12;
        formatPattern = 'MM/dd HH:mm';
        break;
      default:
        slotWidth = 120;
        slotInterval = 1;
        formatPattern = 'HH:mm';
    }

    const totalHours = timeRange === '7d' ? 168 : parseInt(timeRange);
    const totalSlots = Math.ceil(totalHours / slotInterval);
    const totalWidth = Math.max(1200, slotWidth * totalSlots);

    // Create time slots
    const timeSlots = Array.from({ length: totalSlots }, (_, i) => 
      addHours(startTime, i * slotInterval)
    );

    return (
      <div className="relative">
        {/* Timeline header */}
        <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10" style={{ width: `${totalWidth}px` }}>
          <div className="w-64 flex-shrink-0 p-4 font-medium text-gray-700 bg-gray-50">Machine</div>
          <div className="flex-1 flex">
            {timeSlots.map((time, i) => (
              <div
                key={i}
                className="flex-shrink-0 p-4 text-sm text-gray-500 text-center border-l border-gray-200"
                style={{ width: `${slotWidth}px`, minWidth: `${slotWidth}px` }}
              >
                {format(time, formatPattern)}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline rows */}
        <div style={{ width: `${totalWidth}px` }}>
          {filteredMachines.map(machine => {
            const machineEvents = timelineEvents.filter(event => 
              event.machine === machine.name
            );
            const metrics = machineMetrics[machine.id];

            return (
              <div key={machine.id} className="flex border-b border-gray-200">
                <div className="w-64 flex-shrink-0 p-4 bg-gray-50">
                  <div className="font-medium text-gray-900">{machine.name}</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="font-medium text-gray-900">{metrics?.oee.toFixed(1)}%</div>
                      <div className="text-gray-500">OEE</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{metrics?.partsProduced}</div>
                      <div className="text-gray-500">Parts</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{metrics?.defects}</div>
                      <div className="text-gray-500">Defects</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 relative min-h-[4rem]">
                  <div className="absolute inset-0 flex">
                    {timeSlots.map((_, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 border-l border-gray-200"
                        style={{ width: `${slotWidth}px`, minWidth: `${slotWidth}px` }}
                      />
                    ))}
                  </div>

                  {machineEvents.map(event => {
                    const start = new Date(event.startTime);
                    const end = event.endTime ? new Date(event.endTime) : now;

                    const startOffset = differenceInMinutes(start, startTime);
                    const duration = differenceInMinutes(end, start);
                    const totalMinutes = totalHours * 60;
                    
                    // Calculate position and width
                    const left = (startOffset / totalMinutes) * totalWidth;
                    const width = (duration / totalMinutes) * totalWidth;

                    // Adjust position and width to stay within bounds
                    const adjustedLeft = Math.max(0, left);
                    const adjustedWidth = Math.min(totalWidth - adjustedLeft, width);

                    // Skip if completely outside view
                    if (adjustedWidth <= 0 || adjustedLeft >= totalWidth) return null;

                    return (
                      <div
                        key={event.id}
                        className={`absolute h-8 rounded ${getEventColor(event)} opacity-75 cursor-pointer transition-opacity hover:opacity-100`}
                        style={{
                          left: `${adjustedLeft}px`,
                          width: `${adjustedWidth}px`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          zIndex: event.type === 'stop' ? 30 : event.type === 'quality' ? 20 : event.type === 'production' ? 10 : 5
                        }}
                        title={`${event.type}: ${event.details.cause || event.details.product || 'Idle'}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ProjectLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Production Lines</option>
              {lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search machines..."
                className="pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value as 'all' | 'running' | 'stopped')}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRangeType)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="12h">Last 12 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
            <div className="flex items-center text-sm text-gray-500">
              <Zap className="h-4 w-4 mr-1" />
              Live
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading timeline</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {renderTimeline()}
              </div>
            )}

            <div className="mt-4 flex items-center space-x-6">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Production</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Stops</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Quality Issues</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-300 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Idle</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default RealTimeMonitoring;