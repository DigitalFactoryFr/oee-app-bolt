import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  addHours,
  isSameDay,
  parseISO,
  differenceInMinutes,
  subHours,
  subDays
} from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  Search,
  Zap,
  CheckCircle,
  XCircle
} from 'lucide-react';

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
  status: 'running' | 'stopped' | 'idle';
}

type TimeRangeType = '12h' | '24h' | '7d';

const RealTimeMonitoring: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Stores (lignes, machines, produits)
  const { lines } = useProductionLineStore();
  const { machines, fetchMachines } = useMachineStore();
  const { products } = useProductStore();
  
  // États
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]); // Multi-lignes
  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);      // Pour afficher/masquer le menu lignes
  const [showLineDropdown, setShowLineDropdown] = useState(false);


  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [machineMetrics, setMachineMetrics] = useState<Record<string, MachineMetrics>>({});
  
  const [timeRange, setTimeRange] = useState<TimeRangeType>('12h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState<'all' | 'running' | 'stopped'>('all');

  // Au montage : fetch machines, subscribe à supabase, etc.
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
  console.log('Lines loaded:', lines);
}, [lines]);

  
  // Re-fetch à chaque changement de line/timeRange
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 600000); // 10 min
    return () => clearInterval(interval);
  }, [projectId, selectedLine, timeRange]);

  // Gestion de la dropdown (fermeture au clic extérieur)
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLineDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Détermine la date de début en fonction du timeRange
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

  // Toggle l'ouverture du menu de lignes
  const toggleLineDropdown = () => {
    setLineDropdownOpen(!lineDropdownOpen);
  };

  // Gère la sélection multiple de lignes
  const handleFilterSelect = (lineId: string) => {
    if (selectedFilters.includes(lineId)) {
      // On retire la ligne
      setSelectedFilters(selectedFilters.filter(id => id !== lineId));
    } else {
      // On l'ajoute
      setSelectedFilters([...selectedFilters, lineId]);
    }
    // On peut aussi forcer selectedLine = 'all' si on veut
    setSelectedLine('all');
  };

  // "All lines"
  const handleSelectAllLines = () => {
    setSelectedFilters([]);      // On vide la sélection
    setSelectedLine('all');      // On se place sur "all"
    setLineDropdownOpen(false);  // Ferme le dropdown
  };

  // fetchData depuis supabase
  const fetchData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const startTime = getStartTime(now);

      // 1) lots
      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select(`
          id,
          start_time,
          end_time,
          product:products(name, cycle_time),
          machine:machines(name, id),
          lot_id,
          ok_parts_produced,
          lot_size,
          status
        `)
        .eq('project_id', projectId)
        .gte('start_time', startTime.toISOString());
      if (lotsError) throw lotsError;

      // 2) stops
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

      // 3) quality issues
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

      // Build timeline
      const events: TimelineEvent[] = [];
      const metrics: Record<string, MachineMetrics> = {};

      // Init metrics pour toutes les machines
      machines.forEach(machine => {
        metrics[machine.id] = {
          oee: 0,
          availability: 0,
          performance: 0,
          quality: 100,
          partsProduced: 0,
          defects: 0,
          trend: 0,
          status: 'idle'
        };
        // Ajout d'un event "idle" par défaut
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

      // Process lots => timeline + metrics
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

          // Màj metrics
          const m = metrics[lot.machine.id];
          if (m) {
            const okParts = lot.ok_parts_produced || 0;
            const cycleTime = lot.product.cycle_time || 0;
            m.partsProduced += okParts;
            const usefulTime = (cycleTime * okParts) / 3600; // h
            const start = new Date(lot.start_time);
            const end = lot.end_time ? new Date(lot.end_time) : now;
            const openingTime = (end.getTime() - start.getTime()) / 3_600_000; // h
            if (openingTime > 0) {
              m.oee = (usefulTime / openingTime) * 100;
            }
            m.status = 'running';
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
          // Màj metrics
          if (!stop.end_time && metrics[stop.machine.id]) {
            metrics[stop.machine.id].status = 'stopped';
          }
        });
      }

      // Process quality
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
          // Màj metrics
          const m = metrics[issue.machine.id];
          if (m) {
            m.defects += issue.quantity;
          }
        });
      }

      setTimelineEvents(events);
      setMachineMetrics(metrics);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    }
  };

  // Helpers
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
  const getMachineStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const getMachineStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4" />;
      case 'stopped':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Filtrage final
  const filteredMachines = machines
    .filter(machine => {
      // Soit "all lines" => on garde tout, soit on garde celles dans selectedFilters
      if (selectedLine === 'all') {
        // S'il y a des filters => on garde la machine si machine.line_id est dans selectedFilters
        if (selectedFilters.length > 0) {
          return selectedFilters.includes(machine.line_id);
        }
        // Sinon on garde tout
        return true;
      } else {
        // Filtrage simple
        return machine.line_id === selectedLine;
      }
    })
    .filter(machine => {
      const m = machineMetrics[machine.id];
      const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (machineFilter === 'all') return matchesSearch;
      return (
        matchesSearch &&
        ((machineFilter === 'running' && m?.status === 'running') ||
         (machineFilter === 'stopped' && m?.status === 'stopped'))
      );
    });

  // Timeline
  const renderTimeline = () => {
    const now = new Date();
    const startTime = getStartTime(now);
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
    const timeSlots = Array.from({ length: totalSlots }, (_, i) =>
      addHours(startTime, i * slotInterval)
    );

    return (
      <div className="relative">
        {/* Timeline header */}
        <div
          className="flex border-b border-gray-200 sticky top-0 bg-white z-10"
          style={{ width: `${totalWidth}px` }}
        >
          <div className="w-64 flex-shrink-0 p-4 font-medium text-gray-700 bg-gray-50">
            Machine
          </div>
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
            const machineEvents = timelineEvents.filter(
              event => event.machine === machine.name
            );
            const mm = machineMetrics[machine.id];

            return (
              <div key={machine.id} className="flex border-b border-gray-200">
                <div className="w-64 flex-shrink-0 p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{machine.name}</div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMachineStatusColor(mm?.status || 'idle')}`}
                    >
                      {getMachineStatusIcon(mm?.status || 'idle')}
                      <span className="ml-1 capitalize">{mm?.status || 'idle'}</span>
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="font-medium text-gray-900">{mm?.oee.toFixed(1)}%</div>
                      <div className="text-gray-500">OEE</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{mm?.partsProduced}</div>
                      <div className="text-gray-500">Parts</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{mm?.defects}</div>
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

                    const left = (startOffset / totalMinutes) * totalWidth;
                    const width = (duration / totalMinutes) * totalWidth;
                    const adjustedLeft = Math.max(0, left);
                    const adjustedWidth = Math.min(totalWidth - adjustedLeft, width);

                    if (adjustedWidth <= 0 || adjustedLeft >= totalWidth) return null;

                    return (
                      <div
                        key={event.id}
                        className={`absolute h-8 rounded ${getEventColor(event)} opacity-75 cursor-pointer transition-opacity hover:opacity-100`}
                        style={{
                          left: `${adjustedLeft}px`,
                          width: `${adjustedWidth}px`,
                          top: '50%',
                          transform: 'translateY(-50%)'
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
        {/* Header : en flex-col sur mobile, flex-row sur large */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
          
          {/* Bloc gauche : Lignes + Search + Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            
            {/* Bouton "All Lines" + Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleLineDropdown}
                className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none ${
                  selectedLine === 'all' && selectedFilters.length === 0
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectedLine === 'all' && selectedFilters.length === 0
                  ? 'All Lines'
                  : 'Select Lines'}
              </button>
              {lineDropdownOpen && (
                <div className="absolute mt-2 w-48 bg-white rounded-md shadow-lg z-20">
                  <button
                    onClick={handleSelectAllLines}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      selectedLine === 'all' && selectedFilters.length === 0
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All Lines
                  </button>
                  <div className="border-t my-1"></div>
                  {lines.map(line => (
                    <button
                      key={line.id}
                      onClick={() => setShowLineDropdown(prev => !prev)}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        selectedFilters.includes(line.id)
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {line.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search machines..."
                className="pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Filtre de statut */}
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value as 'all' | 'running' | 'stopped')}
              className="py-2 px-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>
          
          {/* Bloc droit : timeRange + "Live" */}
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRangeType)}
              className="py-2 px-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
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
        
        {/* Contenu principal */}
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

            {/* Légende */}
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
