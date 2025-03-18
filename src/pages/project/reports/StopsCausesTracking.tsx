import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  subDays,
  startOfToday,
  startOfYesterday,
  eachDayOfInterval,
  parseISO,
  differenceInMinutes
} from 'date-fns';
import {
  Calendar,
  Download,
  Filter,
  ChevronDown,
  Search,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  PenTool as Tool,
  AlertTriangle,
  Settings,
  RefreshCw,
  X
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// Composants pour filtres / comparaison
import FilterPanel from '../../../components/reports/FilterPanel';
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';

// Recharts
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'quarter';

// Un arrêt
interface StopEvent {
  id: string;
  date: string;
  failure_type: string;   // "AP", "PA", "DO", "NQ", "CS"
  cause: string;
  start_time: string;
  end_time: string | null;
  machine?: any;
  product?: any;
  team_member?: any;
}

// Données agrégées par cause
interface CauseData {
  cause: string;
  counts: { [key: string]: number };   // nombre d’occurrences par type
  durations: { [key: string]: number };// total minutes par type
  totalDuration: number;               // minutes
  trend: number;                       // % d’évolution
}

// Données journalières pour le BarChart
interface DailyData {
  date: string;
  AP: number; // Planned downtime
  PA: number; // Equipment breakdown
  DO: number; // Organized malfunction
  NQ: number; // Non-quality issue
  CS: number; // Series change
  total: number;
}

// Données pour le LineChart (tendances)
interface CauseTrend {
  date: string;
  [key: string]: number | string;
}

// Filtres (machines, lignes, produits, équipes)
interface FilterOptions {
  machines: string[];
  lines: string[];
  products: string[];
  teams: string[];
}

// Liste des types d’arrêt avec icônes et couleurs
const FAILURE_TYPES = [
  { type: 'AP', name: 'Planned Downtime', icon: Clock, color: '#2563eb' },
  { type: 'PA', name: 'Equipment Breakdown', icon: Tool, color: '#dc2626' },
  { type: 'DO', name: 'Organized Malfunction', icon: AlertTriangle, color: '#eab308' },
  { type: 'NQ', name: 'Non-quality Issue', icon: Settings, color: '#9333ea' },
  { type: 'CS', name: 'Series Change', icon: RefreshCw, color: '#16a34a' }
];

const StopsCausesTracking: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // ------------------ États : Période & Filtres ------------------
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Filtres
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    machines: [],
    lines: [],
    products: [],
    teams: []
  });
  const [selectedFilters, setSelectedFilters] = useState<FilterOptions>({
    machines: [],
    lines: [],
    products: [],
    teams: []
  });

  // ------------------ États : Comparaison ------------------
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('machines');

  // ------------------ États : Données & Chargement ------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Données “normales”
  const [causesData, setCausesData] = useState<CauseData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [causeTrends, setCauseTrends] = useState<CauseTrend[]>([]);

  // Recherche sur le nom de la cause
  const [searchTerm, setSearchTerm] = useState('');

  // Données de comparaison
  const [comparisonData, setComparisonData] = useState<CauseData[]>([]);

  // ------------------ KPI Majeurs ------------------
  const [totalDowntime, setTotalDowntime] = useState(0); // en minutes
  const [stopFrequency, setStopFrequency] = useState(0); // nb total d’arrêts

  // ------------------ useEffect ------------------
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
  }, [projectId, selectedPeriod, selectedFilters]);

  // ------------------ Fonctions : Plage de dates ------------------
  function getDateRange() {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return { startDate: startOfToday(), endDate: now };
      case 'yesterday':
        return { startDate: startOfYesterday(), endDate: startOfToday() };
      case 'week':
        return { startDate: subDays(now, 7), endDate: now };
      case 'month':
        return { startDate: subDays(now, 30), endDate: now };
      case 'quarter':
      default:
        return { startDate: subDays(now, 90), endDate: now };
    }
  }

  // ------------------ Filtres : handleFilterChange & clear ------------------
  const handleFilterChange = (category: string, values: string[]) => {
    setSelectedFilters(prev => ({ ...prev, [category]: values }));
  };

  const handleClearFilters = () => {
    setSelectedFilters({
      machines: [],
      lines: [],
      products: [],
      teams: []
    });
  };

  // ------------------ Comparaison ------------------
  const handleComparisonSelect = (type: string) => {
    setComparisonType(type);
    setShowCompareModal(false);
    setShowComparisonSelector(true);
  };

  const handleComparisonItems = async (items: string[]) => {
    setShowComparisonSelector(false);
    setShowComparison(true);

    // Dans un cas réel, on appellerait loadComparisonData()
    // Pour l'exemple, on duplique la data
    setComparisonData(causesData);
  };

  const clearComparison = () => {
    setShowComparison(false);
    setComparisonData([]);
  };

  // ------------------ Helpers : récupérer IDs ------------------
  async function getMachineIdsByName(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    // Vérifier si ce sont déjà des UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (names.every(n => uuidRegex.test(n))) {
      return names;
    }
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
    if (names.every(n => uuidRegex.test(n))) {
      return names;
    }
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
    if (names.every(n => uuidRegex.test(n))) {
      return names;
    }
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

  // ------------------ Chargement des filtres (machines, lignes, etc.) ------------------
  async function loadFilterOptions() {
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
  }

  // ------------------ Chargement des données (arrêts) ------------------
  async function loadData() {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();

      // 1) Si on filtre par lignes, récupérer toutes les machines associées
      let finalMachineIDs: string[] = [];
      if (selectedFilters.lines.length > 0) {
        const lineIDs = await getLineIdsByName(selectedFilters.lines);
        if (lineIDs.length > 0) {
          // Récupérer toutes les machines associées à ces lignes
          const { data: lineMachines, error } = await supabase
            .from('machines')
            .select('id, line_id')
            .eq('project_id', projectId)
            .in('line_id', lineIDs);
          if (error) {
            console.error('Error fetching machines for lines:', error);
          } else {
            const machineIDsFromLines = lineMachines?.map((m: any) => m.id) || [];
            finalMachineIDs = [...finalMachineIDs, ...machineIDsFromLines];
          }
        }
      }
      // 2) Si on filtre par machines, les ajouter
      if (selectedFilters.machines.length > 0) {
        const machineIDs = await getMachineIdsByName(selectedFilters.machines);
        finalMachineIDs = [...finalMachineIDs, ...machineIDs];
      }
      finalMachineIDs = Array.from(new Set(finalMachineIDs)); // remove duplicates

      // 3) Préparer la requête "stop_events"
      let query = supabase
        .from('stop_events')
        .select(`
          id,
          date,
          failure_type,
          cause,
          start_time,
          end_time,
          machine:machines(name),
          product:products(name),
          team_member:team_members(team_name)
        `)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      // 4) Appliquer la liste finale de machines, plus produits & équipes
      if (finalMachineIDs.length > 0) {
        query = query.in('machine', finalMachineIDs);
      }
      if (selectedFilters.products.length > 0) {
        const productIDs = await getProductIdsByName(selectedFilters.products);
        if (productIDs.length > 0) {
          query = query.in('product', productIDs);
        }
      }
      if (selectedFilters.teams.length > 0) {
        const teamIDs = await getTeamMemberIdsByTeamName(selectedFilters.teams);
        if (teamIDs.length > 0) {
          query = query.in('team_member', teamIDs);
        }
      }

      const { data: stops, error: queryError } = await query;
      if (queryError) throw queryError;

      // Préparer la structure journalière
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      const dailyMap = new Map<string, { [key: string]: number }>();
      dateRange.forEach(d => {
        dailyMap.set(format(d, 'yyyy-MM-dd'), {
          AP: 0, PA: 0, DO: 0, NQ: 0, CS: 0, total: 0
        });
      });

      // Aggregation par cause
      const causesMap = new Map<string, {
        counts: { [key: string]: number };
        durations: { [key: string]: number };
        history: Map<string, number>;
      }>();

      let globalDuration = 0; // minutes
      let globalCount = 0;    // arrêts

      stops?.forEach((stop: any) => {
        const dateStr = stop.date;
        const cause = stop.cause;
        const type = stop.failure_type;
        const duration = differenceInMinutes(
          stop.end_time ? new Date(stop.end_time) : new Date(),
          new Date(stop.start_time)
        );

        globalDuration += duration;
        globalCount += 1;

        // Mise à jour daily
        if (dailyMap.has(dateStr)) {
          const dObj = dailyMap.get(dateStr)!;
          if (dObj[type] !== undefined) {
            dObj[type] += duration;
            dObj.total += duration;
          }
        }

        // Mise à jour causes
        if (!causesMap.has(cause)) {
          causesMap.set(cause, {
            counts: { AP: 0, PA: 0, DO: 0, NQ: 0, CS: 0 },
            durations: { AP: 0, PA: 0, DO: 0, NQ: 0, CS: 0 },
            history: new Map<string, number>()
          });
        }
        const cData = causesMap.get(cause)!;
        cData.counts[type] = (cData.counts[type] || 0) + 1;
        cData.durations[type] = (cData.durations[type] || 0) + duration;
        // Historique par date
        cData.history.set(dateStr, (cData.history.get(dateStr) || 0) + duration);
      });

      // Conversion en tableau
      const dailyArray: DailyData[] = [];
      dailyMap.forEach((val, date) => {
        dailyArray.push({
          date,
          AP: val.AP,
          PA: val.PA,
          DO: val.DO,
          NQ: val.NQ,
          CS: val.CS,
          total: val.total
        });
      });
      dailyArray.sort((a, b) => a.date.localeCompare(b.date));

      const causesArray: CauseData[] = [];
      causesMap.forEach((val, cause) => {
        const totalDuration = Object.values(val.durations).reduce((s, v) => s + v, 0);
        // Calcul de la tendance
        const histArray = Array.from(val.history.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        let trend = 0;
        if (histArray.length > 1) {
          const firstVal = histArray[0][1] || 1;
          const lastVal = histArray[histArray.length - 1][1];
          trend = ((lastVal - firstVal) / firstVal) * 100;
        }
        causesArray.push({
          cause,
          counts: val.counts,
          durations: val.durations,
          totalDuration,
          trend
        });
      });

      // On ne garde que celles > 0
      const filteredCauses = causesArray.filter(c => c.totalDuration > 0)
        .sort((a, b) => b.totalDuration - a.totalDuration);

      // Top 5
      const top5 = filteredCauses.slice(0, 5).map(c => c.cause);
      const causeTrendsArray: CauseTrend[] = dateRange.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const row: CauseTrend = { date: dateStr };
        top5.forEach(c => {
          row[c] = causesMap.get(c)?.history.get(dateStr) || 0;
        });
        return row;
      });

      setCausesData(filteredCauses);
      setDailyData(dailyArray);
      setCauseTrends(causeTrendsArray);

      // KPI
      setTotalDowntime(globalDuration);
      setStopFrequency(globalCount);

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  }

  // ------------------ Export JSON ------------------
  function handleExport() {
    const { startDate, endDate } = getDateRange();
    const exportData = {
      period: selectedPeriod,
      from: format(startDate, 'yyyy-MM-dd'),
      to: format(endDate, 'yyyy-MM-dd'),
      filters: selectedFilters,
      totalDowntime,
      stopFrequency,
      causesData,
      dailyData,
      causeTrends
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stops_causes_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ------------------ Formatage & Recherche ------------------
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const filteredCauses = causesData.filter(c =>
    c.cause.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ------------------ Rendu ------------------
  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header & Contrôles */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Stop Causes Tracking</h2>
            <p className="mt-1 text-sm text-gray-500">Monitor stop events trends and patterns by category</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
            {/* Sélection de période */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {selectedPeriod === 'today'
                  ? 'Today'
                  : selectedPeriod === 'yesterday'
                  ? 'Yesterday'
                  : selectedPeriod === 'week'
                  ? 'Last 7 days'
                  : selectedPeriod === 'month'
                  ? 'Last 30 days'
                  : 'Last 90 days'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    {([
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'week', label: 'Last 7 days' },
                      { value: 'month', label: 'Last 30 days' },
                      { value: 'quarter', label: 'Last 90 days' }
                    ] as { value: PeriodType; label: string }[]).map(period => (
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

            {/* Compare */}
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
                  <X className="h-4 w-4 mr-1" /> Clear
                </button>
              </div>
            )}

            {/* Filtres */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* FilterPanel */}
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
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI majeurs : durée & fréquence totales + répartition par catégorie */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Stops Key Metrics</h3>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {formatDuration(totalDowntime)}
                  </span>
                  <span className="text-sm text-red-600">Total Downtime</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {stopFrequency}
                  </div>
                  <div className="text-sm text-gray-500">Stop Frequency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {causesData.length > 0 ? causesData[0].cause : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500">Top Cause</div>
                </div>
              </div>

              {/* Répartition par catégorie (uniquement > 0) */}
              <div className="border-t pt-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3">By Category</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {FAILURE_TYPES.map(ft => {
                    // On calcule la durée totale & la fréquence pour cette catégorie
                    let catDuration = 0;
                    let catCount = 0;
                    dailyData.forEach(d => {
                      catDuration += (d as any)[ft.type] || 0;
                    });
                    causesData.forEach(c => {
                      catCount += c.counts[ft.type] || 0;
                    });
                    if (catDuration <= 0 && catCount <= 0) {
                      // On n’affiche pas la catégorie si 0
                      return null;
                    }
                    return (
                      <div key={ft.type} className="flex items-center space-x-3 bg-gray-50 p-3 rounded">
                        <div
                          className="h-8 w-8 rounded flex items-center justify-center"
                          style={{ backgroundColor: ft.color, color: 'white' }}
                        >
                          <ft.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{ft.name}</div>
                          <div className="text-xs text-gray-600">
                            {catCount} stops • {formatDuration(catDuration)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Graphique Daily (Barres empilées) */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Stop Events Trend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => format(parseISO(date as string), 'MMM dd, yyyy')}
                      formatter={(value: any) => formatDuration(value)}
                    />
                    <Legend />
                    {FAILURE_TYPES.map(type => (
                      <Bar
                        key={type.type}
                        dataKey={type.type}
                        name={type.name}
                        fill={type.color}
                        stackId="a"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Liste des causes (Top Stop Causes) */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Top Stop Causes</h3>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search causes..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {filteredCauses.map((cause, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{cause.cause}</h4>
                          <div className="mt-1 grid grid-cols-1 sm:grid-cols-5 gap-4 text-sm">
                            {FAILURE_TYPES
                              // On ne montre que si la durée > 0
                              .filter(ft => (cause.durations[ft.type] || 0) > 0)
                              .map(ft => {
                                const dur = cause.durations[ft.type] || 0;
                                return (
                                  <div key={ft.type} className="flex items-center space-x-2">
                                    <div
                                      className="p-1 rounded bg-opacity-10"
                                      style={{ backgroundColor: ft.color }}
                                    >
                                      <ft.icon
                                        className="h-4 w-4"
                                        style={{ color: ft.color }}
                                      />
                                    </div>
                                    <span className="text-gray-600">
                                      {formatDuration(dur)}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                        {/* Tendance */}
                        <div className="mt-2 sm:mt-0">
                          <div className="flex items-center">
                            {cause.trend > 0 ? (
                              <ArrowUp className="h-4 w-4 text-red-600" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-green-600" />
                            )}
                            <span
                              className={`ml-1 text-sm font-medium ${
                                cause.trend > 0 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {Math.abs(cause.trend).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Barre de progression colorée (uniquement pour les durées > 0) */}
                      <div className="mt-4">
                        <div className="relative pt-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                            {FAILURE_TYPES
                              .filter(ft => (cause.durations[ft.type] || 0) > 0)
                              .map(ft => {
                                const dur = cause.durations[ft.type] || 0;
                                const ratio = cause.totalDuration
                                  ? (dur / cause.totalDuration) * 100
                                  : 0;
                                return (
                                  <div
                                    key={ft.type}
                                    style={{
                                      width: `${ratio}%`,
                                      backgroundColor: ft.color
                                    }}
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center"
                                  />
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredCauses.length === 0 && (
                    <div className="text-sm text-gray-500">
                      No matching causes for your search
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tendances par cause (top 5) */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Causes Trends</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={causeTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => format(parseISO(date as string), 'MMM dd, yyyy')}
                      formatter={(value: any) => formatDuration(value)}
                    />
                    <Legend />
                    {causesData.slice(0, 5).map((cause, idx) => {
                      // Couleur via index ou fallback
                      const fallbackColors = ['#2563eb', '#dc2626', '#eab308', '#9333ea', '#16a34a'];
                      const color = FAILURE_TYPES[idx]
                        ? FAILURE_TYPES[idx].color
                        : fallbackColors[idx] || '#999999';
                      return (
                        <Line
                          key={cause.cause}
                          type="monotone"
                          dataKey={cause.cause}
                          name={cause.cause}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
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
      </div>
    </ProjectLayout>
  );
};

export default StopsCausesTracking;
