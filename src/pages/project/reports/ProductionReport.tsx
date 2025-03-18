import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import {
  Calendar,
  Download,
  Filter,
  ArrowRightLeft,
  ChevronDown,
  Package,
  Activity,
  AlertTriangle,
  Clock
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import ProductionChart from '../../../components/charts/ProductionChart';

// Comparaison & Filtres
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';
import FilterPanel from '../../../components/reports/FilterPanel';

import { supabase } from '../../../lib/supabase';

//
// Interfaces
//
interface ProductionData {
  date: string;
  actual: number;
  target: number;
  scrap: number;
  // Champs pour la comparaison
  actual_prev?: number;
  target_prev?: number;
  scrap_prev?: number;
}

interface ProductionMetrics {
  totalProduction: number;
  averageEfficiency: number;
  scrapRate: number;
  trend: number;
}

interface MachineProduction {
  id: string;
  name: string;
  production: number;
  efficiency: number;
  scrap: number;
  trend: number;
  // Champs pour la comparaison
  production_prev?: number;
  efficiency_prev?: number;
  scrap_prev?: number;
  trend_prev?: number;
}

type TimeRangeType = '24h' | '7d' | '30d' | '90d';

//
// Fonctions de fusion (pour la comparaison)
//
function mergeProductionData(a: ProductionData[], b: ProductionData[]): ProductionData[] {
  const allDates = new Set([...a.map(d => d.date), ...b.map(d => d.date)]);
  const merged: ProductionData[] = [];
  allDates.forEach(date => {
    const rowA = a.find(d => d.date === date) || { date, actual: 0, target: 0, scrap: 0 };
    const rowB = b.find(d => d.date === date) || { date, actual: 0, target: 0, scrap: 0 };
    merged.push({
      date,
      actual: rowA.actual,
      target: rowA.target,
      scrap: rowA.scrap,
      actual_prev: rowB.actual,
      target_prev: rowB.target,
      scrap_prev: rowB.scrap
    });
  });
  return merged.sort((x, y) => x.date.localeCompare(y.date));
}

function mergeMachineProduction(a: MachineProduction[], b: MachineProduction[]): MachineProduction[] {
  // On crée un map pour retrouver vite l'élément de b
  const mapB = new Map(b.map(m => [m.id, m]));
  return a.map(mA => {
    const mB = mapB.get(mA.id);
    if (mB) {
      return {
        ...mA,
        production_prev: mB.production,
        efficiency_prev: mB.efficiency,
        scrap_prev: mB.scrap,
        trend_prev: mB.trend
      };
    } else {
      return {
        ...mA,
        production_prev: 0,
        efficiency_prev: 0,
        scrap_prev: 0,
        trend_prev: 0
      };
    }
  });
}

//
// Composant principal
//
const ProductionReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Période, loading, erreur
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Données principales
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [machineProduction, setMachineProduction] = useState<MachineProduction[]>([]);
  const [metrics, setMetrics] = useState<ProductionMetrics>({
    totalProduction: 0,
    averageEfficiency: 0,
    scrapRate: 0,
    trend: 0
  });

  // Filtres
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

  // Comparaison
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('machines');

  // Données de comparaison
  const [productionComparisonData, setProductionComparisonData] = useState<ProductionData[]>([]);
  const [comparisonMetrics, setComparisonMetrics] = useState<ProductionMetrics | null>(null);
  const [machineProductionComparison, setMachineProductionComparison] = useState<MachineProduction[]>([]);

  // ----------------------------------------------------------------
  // useEffect : charge les options de filtre et les données
  // ----------------------------------------------------------------
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
  }, [projectId, selectedPeriod, selectedFilters]);

  // ----------------------------------------------------------------
  // 1) Charger les options de filtre (machines, lignes, produits, équipes)
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // 2) Charger les données principales (lots + quality_issues)
  // ----------------------------------------------------------------
  async function loadData() {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      // Calcule la plage de dates
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

      // Requête sur lots
      let lotsQuery = supabase
        .from('lots')
        .select(`
          id,
          date,
          lot_size,
          ok_parts_produced,
          machine,
          product,
          team_member,
          machines (id, name)
        `)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      // Requête sur quality_issues
      let qualityQuery = supabase
        .from('quality_issues')
        .select(`
          id,
          machine,
          product,
          team_member,
          date,
          category,
          quantity
        `)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      // Appliquer les filtres (machines, lignes, produits, équipes)
      let finalMachineIDs: string[] = [];

      // 1) Filtrer par ligne => récupérer machines associées
      if (selectedFilters.lines.length > 0) {
        const lineIDs = await getLineIdsByName(selectedFilters.lines);
        if (lineIDs.length > 0) {
          const { data: machOfLines } = await supabase
            .from('machines')
            .select('id, line_id')
            .eq('project_id', projectId)
            .in('line_id', lineIDs);
          if (machOfLines) {
            finalMachineIDs = finalMachineIDs.concat(machOfLines.map((m: any) => m.id));
          }
        }
      }

      // 2) Filtrer par machines => IDs machines
      if (selectedFilters.machines.length > 0) {
        const machineIDs = await getMachineIdsByName(selectedFilters.machines);
        finalMachineIDs = finalMachineIDs.concat(machineIDs);
      }
      finalMachineIDs = Array.from(new Set(finalMachineIDs));
      if (finalMachineIDs.length > 0) {
        lotsQuery = lotsQuery.in('machine', finalMachineIDs);
        qualityQuery = qualityQuery.in('machine', finalMachineIDs);
      }

      // 3) Filtrer par produits => IDs produits
      if (selectedFilters.products.length > 0) {
        const productIDs = await getProductIdsByName(selectedFilters.products);
        if (productIDs.length > 0) {
          lotsQuery = lotsQuery.in('product', productIDs);
          qualityQuery = qualityQuery.in('product', productIDs);
        }
      }

      // 4) Filtrer par équipes => IDs team_member
      if (selectedFilters.teams.length > 0) {
        const teamIDs = await getTeamMemberIdsByTeamName(selectedFilters.teams);
        if (teamIDs.length > 0) {
          lotsQuery = lotsQuery.in('team_member', teamIDs);
          qualityQuery = qualityQuery.in('team_member', teamIDs);
        }
      }

      const [lotsResult, qualityResult] = await Promise.all([lotsQuery, qualityQuery]);
      if (lotsResult.error) throw lotsResult.error;
      if (qualityResult.error) throw qualityResult.error;

      // Traitement
      const dateMap = new Map<string, ProductionData>();
      const machineMap = new Map<string, MachineProduction>();

      let totalProduction = 0;
      let totalEfficiency = 0;
      let totalScrap = 0;
      let lotCount = 0;

      // Parcours des lots
      lotsResult.data?.forEach((lot: any) => {
        const date = lot.date;
        const machineId = lot.machines?.id;
        const machineName = lot.machines?.name;

        if (!machineId || !machineName) return;

        // Mise à jour par date
        const dateData = dateMap.get(date) || { date, actual: 0, target: 0, scrap: 0 };
        dateData.actual += lot.ok_parts_produced;
        dateData.target += lot.lot_size || 0;
        dateMap.set(date, dateData);

        // Mise à jour par machine
        const machData = machineMap.get(machineId) || {
          id: machineId,
          name: machineName,
          production: 0,
          efficiency: 0,
          scrap: 0,
          trend: 0
        };
        machData.production += lot.ok_parts_produced;
        if (lot.lot_size) {
          machData.efficiency = (lot.ok_parts_produced / lot.lot_size) * 100;
        }
        machineMap.set(machineId, machData);

        totalProduction += lot.ok_parts_produced;
        if (lot.lot_size) {
          totalEfficiency += (lot.ok_parts_produced / lot.lot_size) * 100;
          lotCount++;
        }
      });

      // Parcours des quality_issues
      qualityResult.data?.forEach((issue: any) => {
        if (issue.category === 'scrap') {
          const dateData = dateMap.get(issue.date);
          if (dateData) {
            dateData.scrap += issue.quantity;
            totalScrap += issue.quantity;
          }
          const machData = machineMap.get(issue.machine);
          if (machData) {
            machData.scrap += issue.quantity;
          }
        }
      });

      // Calcul final des metrics
      const avgEfficiency = lotCount > 0 ? totalEfficiency / lotCount : 0;
      const scrapRate = totalProduction > 0 ? (totalScrap / totalProduction) * 100 : 0;

      setMetrics({
        totalProduction,
        averageEfficiency: avgEfficiency,
        scrapRate,
        trend: 0
      });

      setProductionData(
        Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      );
      setMachineProduction(
        Array.from(machineMap.values()).sort((a, b) => b.production - a.production)
      );

      setLoading(false);
    } catch (err) {
      console.error('Error loading production data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load production data');
      setLoading(false);
    }
  }

  // ----------------------------------------------------------------
  // Helpers pour récupérer les IDs
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // 3) Chargement de la data "comparaison" pour un item
  // ----------------------------------------------------------------
  async function loadComparisonData(itemName: string): Promise<{
    productionData: ProductionData[];
    machineProduction: MachineProduction[];
    metrics: ProductionMetrics;
  }> {
    if (!projectId) {
      return {
        productionData: [],
        machineProduction: [],
        metrics: { totalProduction: 0, averageEfficiency: 0, scrapRate: 0, trend: 0 }
      };
    }

    // Déterminer la plage de dates
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

    // Déterminer comment filtrer selon comparisonType
    let finalMachineIDs: string[] = [];
    let productIDs: string[] = [];
    let teamIDs: string[] = [];

    if (comparisonType === 'machines') {
      // On suppose itemName = machineName ou machineID
      finalMachineIDs = await getMachineIdsByName([itemName]);
    } else if (comparisonType === 'lines') {
      // Récupérer l'ID de la ligne, puis toutes les machines associées
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
      // itemName = productName ou productID
      productIDs = await getProductIdsByName([itemName]);
    } else if (comparisonType === 'teams') {
      // itemName = teamName
      teamIDs = await getTeamMemberIdsByTeamName([itemName]);
    }

    finalMachineIDs = Array.from(new Set(finalMachineIDs));

    // Requêtes sur lots & quality
    let lotsQuery = supabase
      .from('lots')
      .select(`
        id,
        date,
        lot_size,
        ok_parts_produced,
        machine,
        product,
        team_member,
        machines (id, name)
      `)
      .eq('project_id', projectId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));

    let qualityQuery = supabase
      .from('quality_issues')
      .select(`
        id,
        machine,
        product,
        team_member,
        date,
        category,
        quantity
      `)
      .eq('project_id', projectId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));

    // Appliquer le filtre
    if (finalMachineIDs.length > 0) {
      lotsQuery = lotsQuery.in('machine', finalMachineIDs);
      qualityQuery = qualityQuery.in('machine', finalMachineIDs);
    }
    if (productIDs.length > 0) {
      lotsQuery = lotsQuery.in('product', productIDs);
      qualityQuery = qualityQuery.in('product', productIDs);
    }
    if (teamIDs.length > 0) {
      lotsQuery = lotsQuery.in('team_member', teamIDs);
      qualityQuery = qualityQuery.in('team_member', teamIDs);
    }

    // Exécution
    const [lotsResult, qualityResult] = await Promise.all([lotsQuery, qualityQuery]);
    if (lotsResult.error) throw lotsResult.error;
    if (qualityResult.error) throw qualityResult.error;

    const dateMap = new Map<string, ProductionData>();
    const machineMap = new Map<string, MachineProduction>();

    let totalProduction = 0;
    let totalEfficiency = 0;
    let totalScrap = 0;
    let lotCount = 0;

    // Parcours des lots
    lotsResult.data?.forEach((lot: any) => {
      const date = lot.date;
      const machineId = lot.machines?.id;
      const machineName = lot.machines?.name;

      if (!machineId || !machineName) return;

      const dateData = dateMap.get(date) || { date, actual: 0, target: 0, scrap: 0 };
      dateData.actual += lot.ok_parts_produced;
      dateData.target += lot.lot_size || 0;
      dateMap.set(date, dateData);

      const machData = machineMap.get(machineId) || {
        id: machineId,
        name: machineName,
        production: 0,
        efficiency: 0,
        scrap: 0,
        trend: 0
      };
      machData.production += lot.ok_parts_produced;
      if (lot.lot_size) {
        machData.efficiency = (lot.ok_parts_produced / lot.lot_size) * 100;
      }
      machineMap.set(machineId, machData);

      totalProduction += lot.ok_parts_produced;
      if (lot.lot_size) {
        totalEfficiency += (lot.ok_parts_produced / lot.lot_size) * 100;
        lotCount++;
      }
    });

    // Parcours des issues qualité
    qualityResult.data?.forEach((issue: any) => {
      if (issue.category === 'scrap') {
        const dateData = dateMap.get(issue.date);
        if (dateData) {
          dateData.scrap += issue.quantity;
          totalScrap += issue.quantity;
        }
        const machData = machineMap.get(issue.machine);
        if (machData) {
          machData.scrap += issue.quantity;
        }
      }
    });

    const avgEfficiency = lotCount > 0 ? totalEfficiency / lotCount : 0;
    const scrapRate = totalProduction > 0 ? (totalScrap / totalProduction) * 100 : 0;

    return {
      productionData: Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      machineProduction: Array.from(machineMap.values()).sort((a, b) => b.production - a.production),
      metrics: {
        totalProduction,
        averageEfficiency: avgEfficiency,
        scrapRate,
        trend: 0
      }
    };
  }

  // ----------------------------------------------------------------
  // 4) Activation de la comparaison
  // ----------------------------------------------------------------
  function handleComparisonSelect(type: string) {
    setComparisonType(type);
    setShowCompareModal(false);
    setShowComparisonSelector(true);
  }

  async function handleComparisonItems(items: string[]) {
    // items : ex. [ "Machine A", "Machine B" ] ou [ "Line 1", "Line 2" ] etc.
    setShowComparisonSelector(false);
    setShowComparison(true);

    if (items.length < 2) return;

    // Charger dataA
    const dataA = await loadComparisonData(items[0]);
    // Charger dataB
    const dataB = await loadComparisonData(items[1]);

    // Fusion
    const mergedProduction = mergeProductionData(dataA.productionData, dataB.productionData);
    setProductionComparisonData(mergedProduction);

    const mergedMachines = mergeMachineProduction(dataA.machineProduction, dataB.machineProduction);
    setMachineProductionComparison(mergedMachines);

    // On peut prendre la moyenne ou autre
    const comp: ProductionMetrics = {
      totalProduction: (dataA.metrics.totalProduction + dataB.metrics.totalProduction) / 2,
      averageEfficiency: (dataA.metrics.averageEfficiency + dataB.metrics.averageEfficiency) / 2,
      scrapRate: (dataA.metrics.scrapRate + dataB.metrics.scrapRate) / 2,
      trend: 0
    };
    setComparisonMetrics(comp);
  }

  function clearComparison() {
    setShowComparison(false);
    setComparisonMetrics(null);
    setProductionComparisonData([]);
    setMachineProductionComparison([]);
  }

  // ----------------------------------------------------------------
  // Données affichées (avec ou sans comparaison)
  // ----------------------------------------------------------------
  const displayedProductionData = showComparison && productionComparisonData.length > 0
    ? productionComparisonData
    : productionData;

  const displayedMachineProduction = showComparison && machineProductionComparison.length > 0
    ? machineProductionComparison
    : machineProduction;

  const isFilterActive =
    selectedFilters.machines.length > 0 ||
    selectedFilters.lines.length > 0 ||
    selectedFilters.products.length > 0 ||
    selectedFilters.teams.length > 0;

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------
  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Production Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze production performance and efficiency metrics
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Sélection de la période */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium
                  text-gray-700 bg-white hover:bg-gray-50"
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

            {/* Compare */}
            {!showComparison ? (
              <button
                onClick={() => setShowCompareModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium
                  text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Compare
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  disabled
                  className="inline-flex items-center px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium
                    text-blue-600 bg-blue-50"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Comparing
                </button>
                <button
                  onClick={clearComparison}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium
                    text-red-600 bg-red-50 hover:bg-red-100"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Filtres */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium
                ${
                  isFilterActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>

            {/* Export */}
            <button
              onClick={() => {
                const exportData = {
                  productionData,
                  machineProduction,
                  metrics
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `production_report_${format(new Date(), 'yyyy-MM-dd')}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium
                text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <FilterPanel
          isVisible={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          options={filterOptions}
          selectedFilters={selectedFilters}
          onFilterChange={(cat, values) => setSelectedFilters(prev => ({ ...prev, [cat]: values }))}
          onClearFilters={() => setSelectedFilters({ machines: [], lines: [], products: [], teams: [] })}
        />

        {/* Contenu */}
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
              {/* Total Production */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <Package className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Production
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.totalProduction.toLocaleString()}
                        </div>
                        <div className="ml-2 text-sm font-semibold text-green-600">↑ 5.7%</div>
                      </dd>
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">
                            {comparisonMetrics.totalProduction.toLocaleString()}
                          </div>
                          <div className="ml-2 text-sm font-semibold text-green-600">↑ 2.2%</div>
                        </dd>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Average Efficiency */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <Activity className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Average Efficiency
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.averageEfficiency.toFixed(1)}%
                        </div>
                        <div className="ml-2 text-sm font-semibold text-green-600">↑ 2.3%</div>
                      </dd>
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">
                            {comparisonMetrics.averageEfficiency.toFixed(1)}%
                          </div>
                          <div className="ml-2 text-sm font-semibold text-green-600">↑ 1.5%</div>
                        </dd>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scrap Rate */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <AlertTriangle className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">Scrap Rate</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.scrapRate.toFixed(1)}%
                        </div>
                        <div className="ml-2 text-sm font-semibold text-red-600">↑ 0.8%</div>
                      </dd>
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">
                            {comparisonMetrics.scrapRate.toFixed(1)}%
                          </div>
                          <div className="ml-2 text-sm font-semibold text-red-600">↑ 0.3%</div>
                        </dd>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Production Time */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <Clock className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Production Time
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">98.5%</div>
                        <div className="ml-2 text-sm font-semibold text-green-600">↑ 1.2%</div>
                      </dd>
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">97.8%</div>
                          <div className="ml-2 text-sm font-semibold text-green-600">↑ 0.7%</div>
                        </dd>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Production Trend Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Production Trend</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Target Achievement:</span>
                  <span className="text-lg font-semibold text-green-600">94.8%</span>
                </div>
              </div>
              {/*
                On passe showComparison au composant ProductionChart
                pour qu'il affiche la 2ème série (barres "B")
              */}
              <ProductionChart
                data={displayedProductionData}
                showComparison={showComparison}
              />
            </div>

            {/* Machine Production */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Machine Production</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {displayedMachineProduction.map(machine => {
                    const compMachine = showComparison
                      ? machineProductionComparison.find(m => m.id === machine.id)
                      : undefined;
                    return (
                      <div key={machine.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="sm:flex sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{machine.name}</h4>
                            <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                              <span>{machine.production.toLocaleString()} parts</span>
                              <span>{machine.efficiency.toFixed(1)}% efficiency</span>
                              <span>{machine.scrap} scrapped</span>
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
                        {showComparison && compMachine && (
                          <div className="sm:flex sm:items-center sm:justify-between mt-2 opacity-50">
                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                              <span>
                                {(compMachine.production_prev ?? compMachine.production).toLocaleString()} parts
                              </span>
                              <span>
                                {(compMachine.efficiency_prev ?? compMachine.efficiency).toFixed(1)}% efficiency
                              </span>
                              <span>
                                {compMachine.scrap_prev ?? compMachine.scrap} scrapped
                              </span>
                            </div>
                            <div className="flex items-baseline">
                              <span
                                className={`text-sm font-medium ${
                                  (compMachine.trend_prev ?? compMachine.trend) > 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {(compMachine.trend_prev ?? compMachine.trend) > 0 ? '↑' : '↓'}{' '}
                                {Math.abs(compMachine.trend_prev ?? compMachine.trend)}%
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="mt-4">
                          <div className="relative pt-1">
                            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                              <div
                                style={{ width: `${machine.efficiency}%` }}
                                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

        {/* Bouton Clear Comparison en bas si besoin */}
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

export default ProductionReport;
