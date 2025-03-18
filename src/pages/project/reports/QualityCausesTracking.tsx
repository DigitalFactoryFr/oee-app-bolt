import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  subDays,
  startOfToday,
  startOfYesterday,
  eachDayOfInterval,
  parseISO
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
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// Import des composants de filtrage et comparaison
import FilterPanel from '../../../components/reports/FilterPanel';
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';

// Import Recharts pour les graphiques
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

interface QualityIssue {
  date: string;
  category: string;
  cause: string;
  quantity: number;
}

interface CauseData {
  cause: string;
  scrapCount: number;
  reworkCount: number;
  totalCount: number;
  trend: number;
}

interface DailyData {
  date: string;
  scrap: number;
  rework: number;
  total: number;
}

interface CauseTrend {
  date: string;
  [key: string]: number | string;
}

interface FilterOptions {
  machines: string[];
  lines: string[];
  products: string[];
  teams: string[];
}

const QualityCausesTracking: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  
  // États pour la période et les filtres
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('machines');

  // États pour les données
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [causesData, setCausesData] = useState<CauseData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [causeTrends, setCauseTrends] = useState<CauseTrend[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // États pour les filtres
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

  // Chargement des options de filtre
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
  }, [projectId, selectedPeriod, selectedFilters]);

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

  const getDateRange = () => {
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
  };

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();

      // Construire la requête de base
      let query = supabase
        .from('quality_issues')
        .select(`
          id,
          date,
          category,
          cause,
          quantity,
          machine:machines(name),
          product:products(name),
          team_member:team_members(team_name)
        `)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      // Appliquer les filtres
      if (selectedFilters.machines.length > 0) {
        query = query.in('machine.name', selectedFilters.machines);
      }
      if (selectedFilters.products.length > 0) {
        query = query.in('product.name', selectedFilters.products);
      }
      if (selectedFilters.teams.length > 0) {
        query = query.in('team_member.team_name', selectedFilters.teams);
      }

      const { data: issues, error: queryError } = await query;

      if (queryError) throw queryError;

      // Agréger les données par cause
      const causesMap = new Map<string, { scrap: number; rework: number; history: Map<string, number> }>();
      const dailyMap = new Map<string, { scrap: number; rework: number }>();
      
      // Générer toutes les dates de l'intervalle
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      dateRange.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        dailyMap.set(dateStr, { scrap: 0, rework: 0 });
      });

      // Traiter les données
      issues?.forEach((issue: any) => {
        const date = issue.date;
        const cause = issue.cause;
        const quantity = issue.quantity || 0;
        const isScrap = issue.category === 'scrap';
        
        // Mise à jour des totaux par cause
        if (!causesMap.has(cause)) {
          causesMap.set(cause, {
            scrap: 0,
            rework: 0,
            history: new Map<string, number>()
          });
        }
        const causeData = causesMap.get(cause)!;
        if (isScrap) {
          causeData.scrap += quantity;
        } else {
          causeData.rework += quantity;
        }
        
        // Mise à jour des données journalières
        const dailyData = dailyMap.get(date) || { scrap: 0, rework: 0 };
        if (isScrap) {
          dailyData.scrap += quantity;
        } else {
          dailyData.rework += quantity;
        }
        dailyMap.set(date, dailyData);
        
        // Mise à jour de l'historique par cause
        causeData.history.set(date, (causeData.history.get(date) || 0) + quantity);
      });

      // Convertir les données pour les graphiques
      const causesArray: CauseData[] = Array.from(causesMap.entries())
        .map(([cause, data]) => {
          const totalCount = data.scrap + data.rework;
          // Calculer la tendance
          const historyArray = Array.from(data.history.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
          const trend = historyArray.length > 1
            ? ((historyArray[historyArray.length - 1][1] - historyArray[0][1]) / historyArray[0][1]) * 100
            : 0;

          return {
            cause,
            scrapCount: data.scrap,
            reworkCount: data.rework,
            totalCount,
            trend
          };
        })
        .sort((a, b) => b.totalCount - a.totalCount);

      // Données journalières
      const dailyArray: DailyData[] = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          scrap: data.scrap,
          rework: data.rework,
          total: data.scrap + data.rework
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Tendances par cause (top 5 causes)
      const topCauses = causesArray.slice(0, 5).map(c => c.cause);
      const causeTrendsArray: CauseTrend[] = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const trend: CauseTrend = { date: dateStr };
        topCauses.forEach(cause => {
          trend[cause] = causesMap.get(cause)?.history.get(dateStr) || 0;
        });
        return trend;
      });

      setCausesData(causesArray);
      setDailyData(dailyArray);
      setCauseTrends(causeTrendsArray);
      setLoading(false);
    } catch (err) {
      console.error('Error loading quality data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
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
    setShowComparison(true);
    // Implémenter la logique de comparaison ici
  };

  const clearComparison = () => {
    setShowComparison(false);
  };

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

  const handleExport = () => {
    const exportData = {
      period: selectedPeriod,
      filters: selectedFilters,
      causesData,
      dailyData,
      causeTrends
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality_causes_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtrer les causes selon le terme de recherche
  const filteredCauses = causesData.filter(cause =>
    cause.cause.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quality Causes Tracking</h2>
            <p className="mt-1 text-sm text-gray-500">
              Monitor quality issues trends and patterns
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Sélecteur de période */}
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
                    {[
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'week', label: 'Last 7 days' },
                      { value: 'month', label: 'Last 30 days' },
                      { value: 'quarter', label: 'Last 90 days' }
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => {
                          setSelectedPeriod(period.value as PeriodType);
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

            {/* Bouton Compare */}
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

            {/* Bouton Filters */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
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
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Graphique de tendance quotidienne */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Quality Issues Trend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => format(parseISO(date as string), 'MMM dd, yyyy')}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="scrap"
                      name="Scrap"
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="rework"
                      name="Rework"
                      stroke="#eab308"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Causes */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Top Quality Issues</h3>
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
                          <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                            <span className="text-red-600">{cause.scrapCount} scrap</span>
                            <span className="text-yellow-600">{cause.reworkCount} rework</span>
                            <span className="font-medium">Total: {cause.totalCount}</span>
                          </div>
                        </div>
                        <div className="mt-2 sm:mt-0">
                          <div className="flex items-center">
                            {cause.trend > 0 ? (
                              <ArrowUp className="h-4 w-4 text-red-600" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-green-600" />
                            )}
                            <span className={`ml-1 text-sm font-medium ${
                              cause.trend > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {Math.abs(cause.trend).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="relative pt-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                            <div
                              style={{ width: `${(cause.scrapCount / cause.totalCount) * 100}%` }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500"
                            />
                            <div
                              style={{ width: `${(cause.reworkCount / cause.totalCount) * 100}%` }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
                    />
                    <Legend />
                    {causesData.slice(0, 5).map((cause, index) => (
                      <Line
                        key={cause.cause}
                        type="monotone"
                        dataKey={cause.cause}
                        name={cause.cause}
                        stroke={[
                          '#2563eb',
                          '#dc2626',
                          '#eab308',
                          '#9333ea',
                          '#16a34a'
                        ][index]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
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

export default QualityCausesTracking;