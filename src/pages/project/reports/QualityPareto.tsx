import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  subDays,
  startOfToday,
  startOfYesterday
} from 'date-fns';
import {
  Calendar,
  Download,
  Filter,
  ChevronDown,
  Search,
  ArrowRightLeft
} from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// Import des composants de filtrage et comparaison
import FilterPanel from '../../../components/reports/FilterPanel';
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';

// Import Recharts pour le diagramme de Pareto
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

interface QualityIssue {
  category: string;
  cause: string;
  quantity: number;
}

interface ParetoData {
  cause: string;
  scrap: number;
  rework: number;
  total: number;
  percentage: number;
  cumulative: number;
}

interface FilterOptions {
  machines: string[];
  lines: string[];
  products: string[];
  teams: string[];
}

const QualityPareto: React.FC = () => {
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
  const [paretoData, setParetoData] = useState<ParetoData[]>([]);
  const [comparisonData, setComparisonData] = useState<ParetoData[]>([]);
  
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
      const aggregatedData = new Map<string, { scrap: number; rework: number }>();
      
      issues?.forEach((issue: any) => {
        const cause = issue.cause;
        const quantity = issue.quantity || 0;
        const isScrap = issue.category === 'scrap';
        
        if (!aggregatedData.has(cause)) {
          aggregatedData.set(cause, { scrap: 0, rework: 0 });
        }
        
        const current = aggregatedData.get(cause)!;
        if (isScrap) {
          current.scrap += quantity;
        } else {
          current.rework += quantity;
        }
      });

      // Convertir en format Pareto
      let totalIssues = 0;
      const paretoArray: ParetoData[] = Array.from(aggregatedData.entries())
        .map(([cause, data]) => {
          const total = data.scrap + data.rework;
          totalIssues += total;
          return {
            cause,
            scrap: data.scrap,
            rework: data.rework,
            total,
            percentage: 0,
            cumulative: 0
          };
        })
        .sort((a, b) => b.total - a.total);

      // Calculer les pourcentages et le cumulatif
      let cumulative = 0;
      paretoArray.forEach(item => {
        item.percentage = (item.total / totalIssues) * 100;
        cumulative += item.percentage;
        item.cumulative = cumulative;
      });

      setParetoData(paretoArray);
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
      paretoData
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality_pareto_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quality Pareto Analysis</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze quality issues by cause and category
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
            {/* Diagramme de Pareto */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Quality Issues Pareto Chart</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Total Issues:</span>
                  <span className="text-lg font-semibold text-blue-600">
                    {paretoData.reduce((sum, item) => sum + item.total, 0)}
                  </span>
                </div>
              </div>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={paretoData}
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
                      label={{ value: 'Quantity', angle: -90, position: 'insideLeft' }}
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
                              <p className="text-red-600">Scrap: {data.scrap}</p>
                              <p className="text-yellow-600">Rework: {data.rework}</p>
                              <p className="text-blue-600">Total: {data.total}</p>
                              <p className="text-gray-600">
                                Cumulative: {data.cumulative.toFixed(1)}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="scrap"
                      fill="#dc2626"
                      name="Scrap"
                      stackId="a"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="rework"
                      fill="#eab308"
                      name="Rework"
                      stackId="a"
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
            </div>

            {/* Tableau détaillé */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Detailed Analysis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cause
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scrap
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rework
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
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
                    {paretoData.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.cause}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.scrap}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.rework}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.total}
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

export default QualityPareto;