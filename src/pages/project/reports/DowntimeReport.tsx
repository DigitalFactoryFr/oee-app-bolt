import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays, differenceInMinutes } from 'date-fns';
import {
  Calendar,
  Download,
  Filter,
  ArrowRightLeft,
  ChevronDown,
  Clock,
  PenTool as Tool,
  AlertTriangle,
  Settings
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import DowntimeChart from '../../../components/charts/DowntimeChart';
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';
import FilterPanel from '../../../components/reports/FilterPanel';
import { supabase } from '../../../lib/supabase';

//
// Interfaces
//
interface DowntimeData {
  name: string;
  value: number;
  color: string;
  // Pour comparaison (optionnel)
  value_prev?: number;
}

interface DowntimeMetrics {
  totalDowntime: number;
  plannedDowntime: number;
  unplannedDowntime: number;
  mtbf: number;
  mttr: number;
  availability: number;
  // Pour comparaison (optionnel)
  totalDowntime_prev?: number;
  mtbf_prev?: number;
  mttr_prev?: number;
  availability_prev?: number;
}

interface MachineDowntime {
  id: string;
  name: string;
  downtime: number;
  stops: number;
  mttr: number;
  availability: number;
  trend: number;
  // Pour comparaison
  downtime_prev?: number;
  stops_prev?: number;
  mttr_prev?: number;
  availability_prev?: number;
  trend_prev?: number;
}

interface FailureBreakdown {
  type: string;
  count: number;
  duration: number;
  percentage: number;
  // Pour comparaison
  count_prev?: number;
  duration_prev?: number;
  percentage_prev?: number;
}

type TimeRangeType = '24h' | '7d' | '30d' | '90d';

//
// Fonctions de fusion pour comparaison
//
function mergeDowntimeData(
  dataA: DowntimeData[],
  dataB: DowntimeData[]
): DowntimeData[] {
  // Fusionner par nom (clé)
  const map = new Map<string, DowntimeData>();
  dataA.forEach(item => {
    map.set(item.name, { ...item });
  });
  dataB.forEach(item => {
    const existing = map.get(item.name);
    if (existing) {
      existing.value_prev = item.value;
    } else {
      map.set(item.name, { name: item.name, value: 0, color: item.color, value_prev: item.value });
    }
  });
  return Array.from(map.values());
}

function mergeMachineDowntime(
  dataA: MachineDowntime[],
  dataB: MachineDowntime[]
): MachineDowntime[] {
  return dataA.map(machineA => {
    const machineB = dataB.find(m => m.id === machineA.id);
    return {
      ...machineA,
      downtime_prev: machineB ? machineB.downtime : 0,
      stops_prev: machineB ? machineB.stops : 0,
      mttr_prev: machineB ? machineB.mttr : 0,
      availability_prev: machineB ? machineB.availability : 0,
      trend_prev: machineB ? machineB.trend : 0,
    };
  });
}

function mergeDowntimeMetrics(
  mA: DowntimeMetrics,
  mB: DowntimeMetrics
): DowntimeMetrics {
  return {
    totalDowntime: mA.totalDowntime,
    plannedDowntime: mA.plannedDowntime,
    unplannedDowntime: mA.unplannedDowntime,
    mtbf: mA.mtbf,
    mttr: mA.mttr,
    availability: mA.availability,
    totalDowntime_prev: mB.totalDowntime,
    mtbf_prev: mB.mtbf,
    mttr_prev: mB.mttr,
    availability_prev: mB.availability,
  };
}

//
// Composant principal DowntimeReport
//
const DowntimeReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // États de période, chargement et erreur
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Données principales
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

  // États pour les filtres
  const [showFilterPanel, setShowFilterPanel] = useState(false);
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

  // États pour la comparaison
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('machines');
  const [downtimeComparisonData, setDowntimeComparisonData] = useState<DowntimeData[]>([]);
  const [machineDowntimeComparison, setMachineDowntimeComparison] = useState<MachineDowntime[]>([]);
  const [comparisonMetrics, setComparisonMetrics] = useState<DowntimeMetrics | null>(null);

  // Charger filtres et données à chaque changement de projet, période ou filtres
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
  }, [projectId, selectedPeriod, selectedFilters]);

  // --------------------------------------------------------------------
  // 1) Charger les options de filtre depuis Supabase
  // --------------------------------------------------------------------
  const loadFilterOptions = async () => {
    if (!projectId) return;
    try {
      const [machRes, lineRes, prodRes, teamRes] = await Promise.all([
        supabase.from('machines').select('id, name').eq('project_id', projectId),
        supabase.from('production_lines').select('id, name').eq('project_id', projectId),
        supabase.from('products').select('id, name').eq('project_id', projectId),
        supabase.from('team_members').select('id, team_name').eq('project_id', projectId)
      ]);
      setFilterOptions({
        machines: Array.from(new Set(machRes.data?.map((m: any) => m.name) || [])),
        lines: Array.from(new Set(lineRes.data?.map((l: any) => l.name) || [])),
        products: Array.from(new Set(prodRes.data?.map((p: any) => p.name) || [])),
        teams: Array.from(new Set(teamRes.data?.map((t: any) => t.team_name) || []))
      });
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

  // --------------------------------------------------------------------
  // 2) Charger les données principales (Downtime) depuis Supabase
  // --------------------------------------------------------------------
  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
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

      // Requête sur stop_events
      let stopsQuery = supabase
        .from('stop_events')
        .select(`*, machines (id, name)`)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      // Appliquer les filtres
      if (selectedFilters.machines.length) {
        stopsQuery = stopsQuery.in('machine', selectedFilters.machines);
      }
      if (selectedFilters.lines.length) {
        stopsQuery = stopsQuery.in('line', selectedFilters.lines);
      }
      if (selectedFilters.products.length) {
        stopsQuery = stopsQuery.in('product', selectedFilters.products);
      }
      if (selectedFilters.teams.length) {
        stopsQuery = stopsQuery.in('team', selectedFilters.teams);
      }

      const { data: stopsData, error: stopsError } = await stopsQuery;
      if (stopsError) throw stopsError;

      // Initialisations pour le traitement
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

      // Traitement des arrêts
      stopsData?.forEach((stop: any) => {
        const machineId = stop.machine;
        const machineName = stop.machines?.name;
        const failureType: string = stop.failure_type;
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

        // Mettre à jour la catégorie de downtime
        const cat = downtimeCategories.get(failureType);
        if (cat) {
          cat.value += duration / 60; // en heures
        }

        // Mettre à jour les données par machine
        if (machineId && machineName) {
          const mData = machineMap.get(machineId) || {
            id: machineId,
            name: machineName,
            downtime: 0,
            stops: 0,
            mttr: 0,
            availability: 100,
            trend: 0
          };
          mData.downtime += duration;
          mData.stops++;
          machineMap.set(machineId, mData);
        }

        // Mettre à jour la répartition par type d'échec
        const fData = failureMap.get(failureType) || { count: 0, duration: 0 };
        fData.count++;
        fData.duration += duration;
        failureMap.set(failureType, fData);
      });

      // Calcul des métriques machine
      machineMap.forEach(machine => {
        const totalMinutes = differenceInMinutes(endDate, startDate);
        machine.availability = ((totalMinutes - machine.downtime) / totalMinutes) * 100;
        machine.mttr = machine.stops > 0 ? machine.downtime / machine.stops : 0;
      });

      // Calcul du breakdown par type
      const failureBreakdownData: FailureBreakdown[] = Array.from(failureMap.entries())
        .map(([type, data]) => ({
          type,
          count: data.count,
          duration: data.duration,
          percentage: (data.duration / totalDowntime) * 100
        }))
        .sort((a, b) => b.duration - a.duration);

      // Calcul final des métriques globales
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
      setFailureBreakdown(failureBreakdownData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading downtime data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load downtime data');
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------
  // 3) Helpers pour récupérer les IDs depuis des noms (filtres)
  // --------------------------------------------------------------------
  async function getMachineIdsByName(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (names.every(n => uuidRegex.test(n))) return names;
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

  async function getLineIdsByName(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (names.every(n => uuidRegex.test(n))) return names;
    const { data, error } = await supabase
      .from('production_lines')
      .select('id, name')
      .eq('project_id', projectId)
      .in('name', names);
    if (error) {
      console.error('getLineIdsByName error:', error);
      return [];
    }
    return data?.map((l: any) => l.id) || [];
  }

  async function getProductIdsByName(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (names.every(n => uuidRegex.test(n))) return names;
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

  async function getTeamMemberIdsByTeamName(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const { data, error } = await supabase
      .from('team_members')
      .select('id, team_name')
      .eq('project_id', projectId)
      .in('team_name', names);
    if (error) {
      console.error('getTeamMemberIdsByTeamName error:', error);
      return [];
    }
    return data?.map((t: any) => t.id) || [];
  }

  // --------------------------------------------------------------------
  // 4) Chargement des données de comparaison pour un item (machines, lines, products, teams)
  // --------------------------------------------------------------------
  async function loadComparisonData(itemName: string): Promise<{
    downtimeData: DowntimeData[];
    machineDowntime: MachineDowntime[];
    metrics: DowntimeMetrics;
    failureBreakdown: FailureBreakdown[];
  }> {
    if (!projectId) {
      return {
        downtimeData: [],
        machineDowntime: [],
        metrics: { totalDowntime: 0, plannedDowntime: 0, unplannedDowntime: 0, mtbf: 0, mttr: 0, availability: 0 },
        failureBreakdown: []
      };
    }
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

    // Déterminer le filtre selon comparisonType
    let finalMachineIDs: string[] = [];
    let productIDs: string[] = [];
    let teamIDs: string[] = [];

    if (comparisonType === 'machines') {
      finalMachineIDs = await getMachineIdsByName([itemName]);
    } else if (comparisonType === 'lines') {
      const lineIDs = await getLineIdsByName([itemName]);
      if (lineIDs.length > 0) {
        const { data: machOfLines } = await supabase
          .from('machines')
          .select('id')
          .eq('project_id', projectId)
          .in('line_id', lineIDs);
        if (machOfLines) {
          finalMachineIDs = machOfLines.map((m: any) => m.id);
        }
      }
    } else if (comparisonType === 'products') {
      productIDs = await getProductIdsByName([itemName]);
    } else if (comparisonType === 'teams') {
      teamIDs = await getTeamMemberIdsByTeamName([itemName]);
    }

    finalMachineIDs = Array.from(new Set(finalMachineIDs));

    // Requêtes avec filtres de comparaison
    let stopsQuery = supabase
      .from('stop_events')
      .select(`*, machines (id, name)`)
      .eq('project_id', projectId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));

    if (finalMachineIDs.length > 0) {
      stopsQuery = stopsQuery.in('machine', finalMachineIDs);
    }
    if (productIDs.length > 0) {
      stopsQuery = stopsQuery.in('product', productIDs);
    }
    if (teamIDs.length > 0) {
      stopsQuery = stopsQuery.in('team', teamIDs);
    }

    const { data: stopsData, error: stopsError } = await stopsQuery;
    if (stopsError) throw stopsError;

    // Traitement similaire à loadData
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
      const failureType = stop.failure_type;
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
        cat.value += duration / 60;
      }

      if (machineId && machineName) {
        const mData = machineMap.get(machineId) || {
          id: machineId,
          name: machineName,
          downtime: 0,
          stops: 0,
          mttr: 0,
          availability: 100,
          trend: 0
        };
        mData.downtime += duration;
        mData.stops++;
        machineMap.set(machineId, mData);
      }

      const fData = failureMap.get(failureType) || { count: 0, duration: 0 };
      fData.count++;
      fData.duration += duration;
      failureMap.set(failureType, fData);
    });

    machineMap.forEach(machine => {
      const totalMinutes = differenceInMinutes(endDate, startDate);
      machine.availability = ((totalMinutes - machine.downtime) / totalMinutes) * 100;
      machine.mttr = machine.stops > 0 ? machine.downtime / machine.stops : 0;
    });

    const failureBreakdownData: FailureBreakdown[] = Array.from(failureMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        duration: data.duration,
        percentage: (data.duration / totalDowntime) * 100
      }))
      .sort((a, b) => b.duration - a.duration);

    const totalMinutes = differenceInMinutes(endDate, startDate);
    const availability = ((totalMinutes - totalDowntime) / totalMinutes) * 100;
    const mttr = totalStops > 0 ? totalRepairTime / totalStops : 0;
    const mtbf = totalStops > 0 ? (totalMinutes - totalDowntime) / totalStops : totalMinutes;

    return {
      downtimeData: Array.from(downtimeCategories.values()),
      machineDowntime: Array.from(machineMap.values()).sort((a, b) => b.downtime - a.downtime),
      metrics: {
        totalDowntime,
        plannedDowntime,
        unplannedDowntime,
        mtbf,
        mttr,
        availability
      },
      failureBreakdown: failureBreakdownData
    };
  }

  // --------------------------------------------------------------------
  // 5) Activation de la comparaison
  // --------------------------------------------------------------------
  const handleComparisonSelect = (type: string) => {
    setComparisonType(type);
    setShowCompareModal(false);
    setShowComparisonSelector(true);
  };

  const handleComparisonItems = async (items: string[]) => {
    setShowComparisonSelector(false);
    setShowComparison(true);
    if (items.length < 2) return;
    // Charger data pour le premier et le second item
    const dataA = await loadComparisonData(items[0]);
    const dataB = await loadComparisonData(items[1]);

    // Fusionner les données pour la comparaison
    const mergedDowntimeData = mergeDowntimeData(dataA.downtimeData, dataB.downtimeData);
    setDowntimeComparisonData(mergedDowntimeData);

    const mergedMachineDowntime = mergeMachineDowntime(dataA.machineDowntime, dataB.machineDowntime);
    setMachineDowntimeComparison(mergedMachineDowntime);

    const compMetrics = mergeDowntimeMetrics(dataA.metrics, dataB.metrics);
    setComparisonMetrics(compMetrics);
  };

  const clearComparison = () => {
    setShowComparison(false);
    setComparisonMetrics(null);
    setDowntimeComparisonData([]);
    setMachineDowntimeComparison([]);
  };

  // --------------------------------------------------------------------
  // Données affichées (si comparaison active)
  // --------------------------------------------------------------------
  const displayedDowntimeData = showComparison && downtimeComparisonData.length > 0
    ? downtimeComparisonData
    : downtimeData;

  const displayedMachineDowntime = showComparison && machineDowntimeComparison.length > 0
    ? machineDowntimeComparison
    : machineDowntime;

  // --------------------------------------------------------------------
  // Rendu
  // --------------------------------------------------------------------
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
            {/* Sélection de période */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {selectedPeriod === '24h'
                  ? 'Last 24 hours'
                  : selectedPeriod === '7d'
                  ? 'Last 7 days'
                  : selectedPeriod === '30d'
                  ? 'Last 30 days'
                  : 'Last 90 days'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    {([
                      { value: '24h', label: 'Last 24 hours' },
                      { value: '7d', label: 'Last 7 days' },
                      { value: '30d', label: 'Last 30 days' },
                      { value: '90d', label: 'Last 90 days' }
                    ] as { value: TimeRangeType; label: string }[]).map(period => (
                      <button
                        key={period.value}
                        onClick={() => {
                          setSelectedPeriod(period.value);
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

            {/* Bouton de comparaison */}
            {!showComparison ? (
              <button
                onClick={() => setShowCompareModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Compare
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  disabled
                  className="inline-flex items-center px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-blue-50"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Comparing
                </button>
                <button
                  onClick={clearComparison}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Bouton Filtres */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                selectedFilters.machines.length > 0 ||
                selectedFilters.lines.length > 0 ||
                selectedFilters.products.length > 0 ||
                selectedFilters.teams.length > 0
                  ? 'border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>

            {/* Bouton Export */}
            <button
              onClick={() => {
                const exportData = {
                  downtimeData,
                  machineDowntime,
                  failureBreakdown,
                  metrics
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `downtime_report_${format(new Date(), 'yyyy-MM-dd')}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
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
          onFilterChange={(cat, values) => setSelectedFilters({ ...selectedFilters, [cat]: values })}
          onClearFilters={() =>
            setSelectedFilters({ machines: [], lines: [], products: [], teams: [] })
          }
        />

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
                        {metrics.availability.toFixed(1)}%
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
                        {formatDuration(metrics.mttr)}
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
                        {formatDuration(metrics.mtbf)}
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
                  <span className="text-sm text-gray-500">Total:</span>
                  <span className="text-lg font-semibold text-blue-600">
                    {formatDuration(metrics.totalDowntime)}
                  </span>
                </div>
              </div>
              <DowntimeChart
                data={displayedDowntimeData}
                comparisonData={showComparison ? downtimeComparisonData : undefined}
                showComparison={showComparison}
              />
            </div>

            {/* Machine Downtime */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Machine Downtime</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {displayedMachineDowntime.map(machine => (
                    <div key={machine.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{machine.name}</h4>
                          <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                            <span>{machine.stops} stops</span>
                            <span>{formatDuration(machine.downtime)} total</span>
                            <span>{formatDuration(machine.mttr)} MTTR</span>
                            <span className="font-medium text-blue-600">
                              {machine.availability.toFixed(1)}% availability
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 sm:mt-0">
                          <div className="flex items-baseline">
                            <span className={`text-sm font-medium ${machine.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
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

        {/* Modaux de comparaison */}
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

        {/* Bouton Clear Comparison */}
        {showComparison && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearComparison}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
            >
              Clear Comparison
            </button>
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default DowntimeReport;
