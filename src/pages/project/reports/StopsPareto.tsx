import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  subDays,
  startOfToday,
  startOfYesterday,
  differenceInMinutes
} from 'date-fns';
import { Calendar, Download, Filter, ChevronDown, ArrowRightLeft, PenTool as Tool, Clock, AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// Import des composants de filtrage et comparaison
import FilterPanel from '../../../components/reports/FilterPanel';
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';

// Import Recharts pour les diagrammes
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'quarter';

interface StopEvent {
  failure_type: string;
  cause: string;
  duration: number;
}

interface ParetoData {
  cause: string;
  duration: number;
  percentage: number;
  cumulative: number;
}

interface CategoryData {
  type: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  data: ParetoData[];
  totalDuration: number;
}

interface FilterOptions {
  machines: string[];
  lines: string[];
  products: string[];
  teams: string[];
}

const FAILURE_TYPES = [
  { type: 'AP', name: 'Planned Downtime', icon: Clock, color: '#2563eb' },
  { type: 'PA', name: 'Equipment Breakdown', icon: Tool, color: '#dc2626' },
  { type: 'DO', name: 'Organized Malfunction', icon: AlertTriangle, color: '#eab308' },
  { type: 'NQ', name: 'Non-quality Issue', icon: Settings, color: '#9333ea' },
  { type: 'CS', name: 'Series Change', icon: RefreshCw, color: '#16a34a' }
];

const StopsPareto: React.FC = () => {
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
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [comparisonData, setComparisonData] = useState<CategoryData[]>([]);
  
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
        .from('stop_events')
        .select(`
          id,
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

      const { data: stops, error: queryError } = await query;

      if (queryError) throw queryError;

      // Agréger les données par type d'arrêt et cause
      const categoryMap = new Map<string, Map<string, number>>();
      
      stops?.forEach((stop: any) => {
        const type = stop.failure_type;
        const cause = stop.cause;
        const duration = differenceInMinutes(
          stop.end_time ? new Date(stop.end_time) : new Date(),
          new Date(stop.start_time)
        );
        
        if (!categoryMap.has(type)) {
          categoryMap.set(type, new Map<string, number>());
        }
        
        const causeMap = categoryMap.get(type)!;
        causeMap.set(cause, (causeMap.get(cause) || 0) + duration);
      });

      // Convertir en format Pareto pour chaque catégorie
      const categoriesData: CategoryData[] = FAILURE_TYPES.map(failureType => {
        const causeMap = categoryMap.get(failureType.type) || new Map<string, number>();
        let totalDuration = 0;
        
        const paretoArray: ParetoData[] = Array.from(causeMap.entries())
          .map(([cause, duration]) => {
            totalDuration += duration;
            return { cause, duration, percentage: 0, cumulative: 0 };
          })
          .sort((a, b) => b.duration - a.duration);

        // Calculer les pourcentages et le cumulatif
        let cumulative = 0;
        paretoArray.forEach(item => {
          item.percentage = (item.duration / totalDuration) * 100;
          cumulative += item.percentage;
          item.cumulative = cumulative;
        });

        return {
          type: failureType.type,
          name: failureType.name,
          icon: <failureType.icon className="h-5 w-5" />,
          color: failureType.color,
          data: paretoArray,
          totalDuration
        };
      });

      setCategoryData(categoriesData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading stop events:', err);
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
    setComparisonData([]);
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
      categoryData
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stops_pareto_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            <h2 className="text-2xl font-bold text-gray-900">Stops Pareto Analysis</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze downtime causes by category
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
          <div className="space-y-8">
            {/* Diagrammes de Pareto par catégorie */}
            {categoryData.map((category) => (
              <div key={category.type} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg bg-${category.color.slice(1)}/10`}>
                      {category.icon}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">Total Duration:</span>
                    <span className="text-lg font-semibold" style={{ color: category.color }}>
                      {formatDuration(category.totalDuration)}
                    </span>
                  </div>
                </div>

                {category.data.length > 0 ? (
                  <>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={category.data}
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="cause"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            interval={0}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            yAxisId="left"
                            orientation="left"
                            label={{ value: 'Duration (min)', angle: -90, position: 'insideLeft' }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, 100]}
                            label={{ value: 'Cumulative %', angle: 90, position: 'insideRight' }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
                                    <p className="font-medium">{data.cause}</p>
                                    <p className="text-gray-600">Duration: {formatDuration(data.duration)}</p>
                                    <p className="text-gray-600">Percentage: {data.percentage.toFixed(1)}%</p>
                                    <p className="text-gray-600">Cumulative: {data.cumulative.toFixed(1)}%</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Bar
                            yAxisId="left"
                            dataKey="duration"
                            fill={category.color}
                            name="Duration"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="cumulative"
                            stroke="#2563eb"
                            name="Cumulative %"
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Tableau détaillé */}
                    <div className="mt-6 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cause
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Duration
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Percentage
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cumulative %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {category.data.map((item, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.cause}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDuration(item.duration)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.percentage.toFixed(1)}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.cumulative.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No data available for this category
                  </div>
                )}
              </div>
            ))}
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

export default StopsPareto;