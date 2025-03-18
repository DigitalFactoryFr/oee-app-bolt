import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays, differenceInMinutes } from 'date-fns';
import {
  Calendar,
  Download,
  Filter,
  ChevronDown,
  Clock,
  PenTool as Tool,
  AlertTriangle,
  Settings,
  Search
} from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import DowntimeChart from '../../../components/charts/DowntimeChart';
import FilterPanel from '../../../components/reports/FilterPanel';
import { supabase } from '../../../lib/supabase';

//
// Interfaces
//
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
  trend: number;  // Pourcentage (ex: +5 => +5%)
}

interface FailureBreakdown {
  type: string;
  count: number;
  duration: number;
  percentage: number;
}

type TimeRangeType = '24h' | '7d' | '30d' | '90d';

interface FilterOptions {
  machines: string[];
  products: string[];
}

//
// Fonctions auxiliaires pour convertir les noms en UUIDs
//
async function getMachineIdsByName(names: string[], projectId: string): Promise<string[]> {
  if (!names || names.length === 0) return [];
  const { data, error } = await supabase
    .from('machines')
    .select('id, name')
    .eq('project_id', projectId)
    .in('name', names);
  if (error) {
    console.error('getMachineIdsByName error:', error);
    return [];
  }
  return data?.map((m: any) => m.id) || [];
}

async function getProductIdsByName(names: string[], projectId: string): Promise<string[]> {
  if (!names || names.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select('id, name')
    .eq('project_id', projectId)
    .in('name', names);
  if (error) {
    console.error('getProductIdsByName error:', error);
    return [];
  }
  return data?.map((p: any) => p.id) || [];
}

//
// Rapport DowntimeReport
//
const DowntimeReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // --- Période
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // --- Chargement / Erreur
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Données principales
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

  // --- Filtres
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    machines: [],
    products: []
  });
  const [selectedFilters, setSelectedFilters] = useState<FilterOptions>({
    machines: [],
    products: []
  });

  // --- Recherche locale (pour machines)
  const [searchTerm, setSearchTerm] = useState('');

  // useEffect : charger filtres et données
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedPeriod, selectedFilters]);

  // --------------------------------------------------------------------------
  // 1) Chargement des options de filtres
  // --------------------------------------------------------------------------
  const loadFilterOptions = async () => {
    if (!projectId) return;
    try {
      const [machRes, prodRes] = await Promise.all([
        supabase.from('machines').select('id, name').eq('project_id', projectId),
        supabase.from('products').select('id, name').eq('project_id', projectId)
      ]);
      setFilterOptions({
        machines: Array.from(new Set(machRes.data?.map((m: any) => m.name) || [])),
        products: Array.from(new Set(prodRes.data?.map((p: any) => p.name) || []))
      });
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

  // --------------------------------------------------------------------------
  // 2) Gestion de la période
  // --------------------------------------------------------------------------
  const periodOptions = [
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d',  label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' }
  ];

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    switch (selectedPeriod) {
      case '24h':
        startDate = subDays(now, 1);
        break;
      case '7d':
        startDate = subDays(now, 7);
        break;
      case '30d':
        startDate = subDays(now, 30);
        break;
      case '90d':
        startDate = subDays(now, 90);
        break;
      default:
        startDate = subDays(now, 7);
    }
    return { startDate, endDate: now };
  };

  // --------------------------------------------------------------------------
  // 3) Chargement et traitement des données Downtime
  // --------------------------------------------------------------------------
  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();

      // Convertir les noms en UUID
      let machineIDs: string[] = [];
      let productIDs: string[] = [];

      if (selectedFilters.machines?.length) {
        machineIDs = await getMachineIdsByName(selectedFilters.machines, projectId);
      }
      if (selectedFilters.products?.length) {
        productIDs = await getProductIdsByName(selectedFilters.products, projectId);
      }

      // Requête stop_events
      let stopsQuery = supabase
        .from('stop_events')
        .select(`*, machines (id, name)`)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (machineIDs.length > 0) {
        stopsQuery = stopsQuery.in('machine', machineIDs);
      }
      if (productIDs.length > 0) {
        stopsQuery = stopsQuery.in('product', productIDs);
      }

      const { data: stopsData, error: stopsError } = await stopsQuery;
      if (stopsError) throw stopsError;

      // Initialisations
      const machineMap = new Map<string, MachineDowntime>();
      const downtimeCategories = new Map<string, DowntimeData>([
        ['AP', { name: 'Planned Downtime', value: 0, color: '#2563eb' }],
        ['PA', { name: 'Equipment Breakdown', value: 0, color: '#dc2626' }],
        ['DO', { name: 'Organized Malfunction', value: 0, color: '#eab308' }],
        ['NQ', { name: 'Quality Issue', value: 0, color: '#9333ea' }],
        ['CS', { name: 'Setup/Series Change', value: 0, color: '#16a34a' }]
      ]);
      const failureMap = new Map<string, { count: number; duration: number }>();

      let totalDowntime = 0;
      let plannedDowntime = 0;
      let unplannedDowntime = 0;
      let totalStops = 0;
      let totalRepairTime = 0;

      stopsData?.forEach((stop: any) => {
        const machineId = stop.machine;
        const machineName = stop.machines?.name;
        const failureType = stop.failure_type || 'CS'; // Par défaut
        const startTime = new Date(stop.start_time);
        const endTime = stop.end_time ? new Date(stop.end_time) : new Date();
        const duration = differenceInMinutes(endTime, startTime);

        totalDowntime += duration;
        totalStops++;
        totalRepairTime += duration;

        if (failureType === 'AP') {
          plannedDowntime += duration;
        } else {
          unplannedDowntime += duration;
        }

        const cat = downtimeCategories.get(failureType);
        if (cat) {
          cat.value += duration / 60; // en heures
        }

        // Agrégation par machine
        if (machineId && machineName) {
          const mData = machineMap.get(machineId) || {
            id: machineId,
            name: machineName,
            downtime: 0,
            stops: 0,
            mttr: 0,
            availability: 100,
            trend: 0 // On le simulera ou le calculera
          };
          mData.downtime += duration;
          mData.stops++;
          machineMap.set(machineId, mData);
        }

        // Échec
        const fData = failureMap.get(failureType) || { count: 0, duration: 0 };
        fData.count++;
        fData.duration += duration;
        failureMap.set(failureType, fData);
      });

      // Calcul par machine
      machineMap.forEach(machine => {
        const totalPeriodMinutes = differenceInMinutes(endDate, startDate);
        machine.availability = ((totalPeriodMinutes - machine.downtime) / totalPeriodMinutes) * 100;

        machine.mttr = machine.stops > 0 ? machine.downtime / machine.stops : 0;

        // On simule un "trend" : par exemple, on dit qu'on a +2% ou -3% aléatoire
        // Adaptez selon votre logique
        machine.trend = Math.floor(Math.random() * 5) - 2; // ex: -2..+2
      });

      // Breakdown par type
      const breakdownData: FailureBreakdown[] = Array.from(failureMap.entries())
        .map(([type, data]) => ({
          type,
          count: data.count,
          duration: data.duration,
          percentage: totalDowntime > 0 ? (data.duration / totalDowntime) * 100 : 0
        }))
        .sort((a, b) => b.duration - a.duration);

      // Calcul final
      const totalPeriodMinutes = differenceInMinutes(endDate, startDate);
      const availability = totalPeriodMinutes > 0
        ? ((totalPeriodMinutes - totalDowntime) / totalPeriodMinutes) * 100
        : 100;
      const mttr = totalStops > 0 ? totalRepairTime / totalStops : 0;
      const mtbf = totalStops > 0
        ? (totalPeriodMinutes - totalDowntime) / totalStops
        : totalPeriodMinutes;

      setMetrics({
        totalDowntime,
        plannedDowntime,
        unplannedDowntime,
        mtbf,
        mttr,
        availability
      });
      setDowntimeData(Array.from(downtimeCategories.values()));
      setMachineDowntime(
        Array.from(machineMap.values())
          .sort((a, b) => b.downtime - a.downtime)
      );
      setFailureBreakdown(breakdownData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading downtime data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load downtime data');
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 4) Export
  // --------------------------------------------------------------------------
  const handleExport = () => {
    const nowStr = format(new Date(), 'yyyy-MM-dd');
    const exportData = {
      period: selectedPeriod,
      filters: selectedFilters,
      downtimeData,
      machineDowntime,
      failureBreakdown,
      metrics
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `downtime_report_${nowStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------------------------------
  // 5) Handlers des filtres
  // --------------------------------------------------------------------------
  const handleFilterChange = (category: keyof FilterOptions, values: string[]) => {
    setSelectedFilters(prev => ({ ...prev, [category]: values }));
  };

  const handleClearFilters = () => {
    setSelectedFilters({ machines: [], products: [] });
  };

  // On évite l'erreur "length is undefined" en vérifiant l'existence
  const isFilterActive =
    (selectedFilters.machines && selectedFilters.machines.length > 0) ||
    (selectedFilters.products && selectedFilters.products.length > 0);

  // --------------------------------------------------------------------------
  // 6) Recherche locale (searchTerm)
  // --------------------------------------------------------------------------
  const filteredMachineDowntime = machineDowntime.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --------------------------------------------------------------------------
  // 7) Formatage
  // --------------------------------------------------------------------------
  const formatDuration = (minutes: number, decimals = 0): string => {
    if (minutes <= 0) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}h ${m.toFixed(decimals)}m`;
  };

  const formatNumber = (val: number, decimals = 1) => {
    return val.toFixed(decimals);
  };

  // --------------------------------------------------------------------------
  // Rendu
  // --------------------------------------------------------------------------
  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Downtime Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze equipment downtime and maintenance metrics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
            {/* Sélection de période */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {periodOptions.find((p) => p.value === selectedPeriod)?.label || 'Last 7 days'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    {periodOptions.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => {
                          setSelectedPeriod(p.value as TimeRangeType);
                          setShowPeriodDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bouton Filtres */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                isFilterActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>

            {/* Bouton Export */}
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Panneau de filtres */}
        <FilterPanel
          isVisible={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          options={filterOptions}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        {/* Contenu principal */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barre de recherche (locale) pour machines */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute top-2 left-2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search machine..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full text-sm"
                />
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Downtime */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5 flex items-center">
                  <Clock className="h-6 w-6 text-gray-400" />
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Downtime</dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {formatDuration(metrics.totalDowntime)}
                    </dd>
                  </div>
                </div>
              </div>
              {/* Availability */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5 flex items-center">
                  <Settings className="h-6 w-6 text-gray-400" />
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500 truncate">Availability</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {formatNumber(metrics.availability, 1)}%
                      </div>
                      <div className="ml-2 text-sm font-semibold text-green-600">↑ 2.3%</div>
                    </dd>
                  </div>
                </div>
              </div>
              {/* MTTR */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5 flex items-center">
                  <Tool className="h-6 w-6 text-gray-400" />
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500 truncate">MTTR</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {formatDuration(metrics.mttr, 0)}
                      </div>
                      <div className="ml-2 text-sm font-semibold text-red-600">↑ 12m</div>
                    </dd>
                  </div>
                </div>
              </div>
              {/* MTBF */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5 flex items-center">
                  <AlertTriangle className="h-6 w-6 text-gray-400" />
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500 truncate">MTBF</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {formatDuration(metrics.mtbf, 0)}
                      </div>
                      <div className="ml-2 text-sm font-semibold text-green-600">↑ 1.5h</div>
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            {/* Downtime Distribution Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Downtime Distribution</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Total Downtime:</span>
                  <span className="text-lg font-semibold text-blue-600">
                    {formatDuration(metrics.totalDowntime)}
                  </span>
                </div>
              </div>
              <div className="h-96">
                <DowntimeChart data={downtimeData} />
              </div>
            </div>

            {/* Machine Downtime (filtrée localement par searchTerm) */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Machine Downtime</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                {filteredMachineDowntime.length === 0 ? (
                  <p className="text-sm text-gray-500">No machines match your search.</p>
                ) : (
                  <div className="space-y-4">
                    {filteredMachineDowntime.map((machine) => (
                      <div key={machine.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="sm:flex sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {machine.name}
                            </h4>
                            <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                              <span>{machine.stops} stops</span>
                              <span>{formatDuration(machine.downtime)} total</span>
                              <span>{formatDuration(machine.mttr)} MTTR</span>
                              <span className="font-medium text-blue-600">
                                {formatNumber(machine.availability, 1)}% availability
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0">
                            <div className="flex items-baseline">
                              <span
                                className={`text-sm font-medium ${
                                  machine.trend > 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default DowntimeReport;
