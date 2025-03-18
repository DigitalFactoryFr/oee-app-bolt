import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import {
  Calendar,
  Download,
  Filter,
  ArrowRightLeft,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  AlertOctagon,
  BarChart2
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import QualityChart from '../../../components/charts/QualityChart';

// ---- Filtres & Comparaison ----
import FilterPanel from '../../../components/reports/FilterPanel';
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';

// ---- Supabase ----
import { supabase } from '../../../lib/supabase';

//
// ---------------------- Interfaces ----------------------
//
interface QualityData {
  date: string;
  rework: number;
  scrap: number;
  other: number;
  // Champs optionnels pour la comparaison
  rework_prev?: number;
  scrap_prev?: number;
  other_prev?: number;
}

interface QualityMetrics {
  totalIssues: number;
  reworkRate: number;
  scrapRate: number;
  firstPassYield: number;
  trend: number;
}

interface MachineQuality {
  id: string;
  name: string;
  issues: number;
  rework: number;
  scrap: number;
  fpy: number;
  trend: number;
  // Champs optionnels pour la comparaison
  issues_prev?: number;
  rework_prev?: number;
  scrap_prev?: number;
  fpy_prev?: number;
  trend_prev?: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
  // Champs pour comparaison
  count_prev?: number;
  percentage_prev?: number;
}

type TimeRangeType = '24h' | '7d' | '30d' | '90d';

//
// ---------------------- QualityReport ----------------------
//
const QualityReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // --------- États pour la période ---------
  const [selectedPeriod, setSelectedPeriod] = useState<TimeRangeType>('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // --------- États de chargement / erreur ---------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --------- Données principales ---------
  const [qualityData, setQualityData] = useState<QualityData[]>([]);
  const [machineQuality, setMachineQuality] = useState<MachineQuality[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [metrics, setMetrics] = useState<QualityMetrics>({
    totalIssues: 0,
    reworkRate: 0,
    scrapRate: 0,
    firstPassYield: 0,
    trend: 0
  });

  // --------- Filtres ---------
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

  // --------- Comparaison ---------
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('machines');

  // Données de comparaison
  const [qualityComparisonData, setQualityComparisonData] = useState<QualityData[]>([]);
  const [comparisonMetrics, setComparisonMetrics] = useState<QualityMetrics | null>(null);
  const [categoryBreakdownComparison, setCategoryBreakdownComparison] = useState<CategoryBreakdown[]>([]);
  const [machineQualityComparison, setMachineQualityComparison] = useState<MachineQuality[]>([]);

  //
  // ---------------------- useEffect principal ----------------------
  //
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
  }, [projectId, selectedPeriod, selectedFilters]);

  //
  // ---------------------- 1) Chargement des options de filtre ----------------------
  //
  const loadFilterOptions = async () => {
    if (!projectId) return;
    try {
      // Récupération des listes (machines, lignes, produits, équipes)
      const [machRes, lineRes, prodRes, teamRes] = await Promise.all([
        supabase.from('machines').select('id, name').eq('project_id', projectId),
        supabase.from('production_lines').select('id, name').eq('project_id', projectId),
        supabase.from('products').select('id, name').eq('project_id', projectId),
        supabase.from('team_members').select('id, team_name').eq('project_id', projectId)
      ]);

      if (machRes.error) throw machRes.error;
      if (lineRes.error) throw lineRes.error;
      if (prodRes.error) throw prodRes.error;
      if (teamRes.error) throw teamRes.error;

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

  //
  // ---------------------- 2) Chargement des données principales ----------------------
  //
  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      // 2.1) Calcul de la plage de dates
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

      // 2.2) Préparation des requêtes Supabase
      // On applique les filtres (machines, lines => machines, products, teams) sur "lots" et "quality_issues".
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
          date,
          category,
          quantity,
          machine,
          product,
          team_member,
          machines (id, name)
        `)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      // ---- Application des filtres ----
      // 1) Filtrer par lines => on récupère d'abord la liste des machines associées aux lignes
      let finalMachineIDs: string[] = [];
      if (selectedFilters.lines.length > 0) {
        const { data: linesData, error: linesError } = await supabase
          .from('production_lines')
          .select('id')
          .eq('project_id', projectId)
          .in('name', selectedFilters.lines);

        if (linesError) throw linesError;
        const lineIDs = linesData?.map((l: any) => l.id) || [];

        // Récupérer les machines de ces lignes
        if (lineIDs.length > 0) {
          const { data: machinesOfLines } = await supabase
            .from('machines')
            .select('id')
            .eq('project_id', projectId)
            .in('line_id', lineIDs);

          if (machinesOfLines) {
            finalMachineIDs.push(...machinesOfLines.map((m: any) => m.id));
          }
        }
      }

      // 2) Filtrer par machines => on récupère l'id de chaque machine
      if (selectedFilters.machines.length > 0) {
        const { data: machData, error: machError } = await supabase
          .from('machines')
          .select('id')
          .eq('project_id', projectId)
          .in('name', selectedFilters.machines);

        if (machError) throw machError;
        if (machData) {
          finalMachineIDs.push(...machData.map((m: any) => m.id));
        }
      }

      finalMachineIDs = Array.from(new Set(finalMachineIDs)); // supprime les doublons
      if (finalMachineIDs.length > 0) {
        lotsQuery = lotsQuery.in('machine', finalMachineIDs);
        qualityQuery = qualityQuery.in('machine', finalMachineIDs);
      }

      // 3) Filtrer par produits
      if (selectedFilters.products.length > 0) {
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select('id')
          .eq('project_id', projectId)
          .in('name', selectedFilters.products);
        if (prodError) throw prodError;
        const productIDs = prodData?.map((p: any) => p.id) || [];
        if (productIDs.length > 0) {
          lotsQuery = lotsQuery.in('product', productIDs);
          qualityQuery = qualityQuery.in('product', productIDs);
        }
      }

      // 4) Filtrer par équipes
      if (selectedFilters.teams.length > 0) {
        const { data: teamData, error: teamError } = await supabase
          .from('team_members')
          .select('id')
          .eq('project_id', projectId)
          .in('team_name', selectedFilters.teams);
        if (teamError) throw teamError;
        const teamIDs = teamData?.map((t: any) => t.id) || [];
        if (teamIDs.length > 0) {
          lotsQuery = lotsQuery.in('team_member', teamIDs);
          qualityQuery = qualityQuery.in('team_member', teamIDs);
        }
      }

      // 2.3) Exécution des requêtes en parallèle
      const [lotsResult, qualityResult] = await Promise.all([lotsQuery, qualityQuery]);
      if (lotsResult.error) throw lotsResult.error;
      if (qualityResult.error) throw qualityResult.error;

      // 2.4) Traitement pour remplir qualityData, machineQuality, categoryBreakdown, metrics
      const dateMap = new Map<string, QualityData>();
      const machineMap = new Map<string, MachineQuality>();
      const categoryMap = new Map<string, number>();

      let totalParts = 0;
      let totalDefects = 0;
      let totalRework = 0;
      let totalScrap = 0;

      // Parcours des lots
      lotsResult.data?.forEach((lot: any) => {
        const date = lot.date;
        const machineId = lot.machine;
        const machineName = lot.machines?.name || 'Unknown';
        totalParts += lot.ok_parts_produced || 0;

        if (!machineMap.has(machineId)) {
          machineMap.set(machineId, {
            id: machineId,
            name: machineName,
            issues: 0,
            rework: 0,
            scrap: 0,
            fpy: 100,
            trend: 0
          });
        }
      });

      // Parcours des issues qualité
      qualityResult.data?.forEach((issue: any) => {
        const date = issue.date;
        const machineId = issue.machine;
        const category = issue.category;
        const quantity = issue.quantity || 0;

        // 1) Mise à jour dateMap
        const dateData = dateMap.get(date) || { date, rework: 0, scrap: 0, other: 0 };
        if (category === 'scrap') {
          dateData.scrap += quantity;
          totalScrap += quantity;
        } else if (category.includes('rework')) {
          dateData.rework += quantity;
          totalRework += quantity;
        } else {
          dateData.other += quantity;
        }
        dateMap.set(date, dateData);

        // 2) Mise à jour machineMap
        const mData = machineMap.get(machineId);
        if (mData) {
          mData.issues++;
          if (category === 'scrap') {
            mData.scrap += quantity;
          } else if (category.includes('rework')) {
            mData.rework += quantity;
          }
        }

        // 3) Mise à jour categoryMap
        const currentCount = categoryMap.get(category) || 0;
        categoryMap.set(category, currentCount + quantity);

        totalDefects += quantity;
      });

      // 2.5) Calcul des métriques globales
      const firstPassYield = totalParts > 0 ? ((totalParts - totalDefects) / totalParts) * 100 : 100;
      setMetrics({
        totalIssues: totalDefects,
        reworkRate: totalParts > 0 ? (totalRework / totalParts) * 100 : 0,
        scrapRate: totalParts > 0 ? (totalScrap / totalParts) * 100 : 0,
        firstPassYield,
        trend: 0 // Calcul du trend si nécessaire
      });

      // 2.6) Category breakdown
      const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries()).map(
        ([cat, count]) => ({
          category: cat,
          count,
          percentage: totalDefects > 0 ? (count / totalDefects) * 100 : 0
        })
      );
      breakdown.sort((a, b) => b.count - a.count);

      // 2.7) Machine Quality => calcul du FPY par machine
      machineMap.forEach(machine => {
        const sumDefects = machine.rework + machine.scrap;
        machine.fpy = totalParts > 0 ? (100 - (sumDefects / totalParts) * 100) : 100;
      });

      // 2.8) Transformation en array
      const qualityArray = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      const machineArray = Array.from(machineMap.values()).sort((a, b) => b.fpy - a.fpy);

      // 2.9) set states
      setQualityData(qualityArray);
      setMachineQuality(machineArray);
      setCategoryBreakdown(breakdown);
      setLoading(false);
    } catch (err) {
      console.error('Error loading quality data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality data');
      setLoading(false);
    }
  };

  //
  // ---------------------- 3) Filtres : callbacks ----------------------
  //
  const handleFilterChange = (category: string, values: string[]) => {
    setSelectedFilters(prev => ({ ...prev, [category]: values }));
  };

  const handleClearFilters = () => {
    setSelectedFilters({ machines: [], lines: [], products: [], teams: [] });
  };

  const isFilterActive =
    selectedFilters.machines.length > 0 ||
    selectedFilters.lines.length > 0 ||
    selectedFilters.products.length > 0 ||
    selectedFilters.teams.length > 0;

  //
  // ---------------------- 4) Comparaison ----------------------
  //
  // 4.1) Ouverture de la modal "Compare"
  const handleComparisonSelect = (type: string) => {
    setComparisonType(type);
    setShowCompareModal(false);
    setShowComparisonSelector(true);
  };

  // 4.2) Fonction qui charge la data d’un item (machine, line, etc.) en appliquant la même plage de dates + filtres
  const loadComparisonData = async (itemName: string) => {
    if (!projectId) return null;

    // Même logique que loadData, sauf qu’on filtre en plus par "itemName"
    // Selon comparisonType, on considère itemName comme une machine, ou une line, etc.
    // On renvoie un objet : { qualityData, machineQuality, categoryBreakdown, metrics }

    // 1) Date range
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

    // 2) Préparer les requêtes
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
        date,
        category,
        quantity,
        machine,
        product,
        team_member,
        machines (id, name)
      `)
      .eq('project_id', projectId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));

    // 3) Appliquer les mêmes filtres que l'affichage normal
    // (machines, lines => machines, products, teams)
    // SAUF qu’on va forcer un filtre supplémentaire sur "itemName" selon comparisonType
    // Ex. si comparisonType === 'machines', on force lotsQuery.in('machine', [machineId]) etc.

    // a) Appliquer les filtres déjà sélectionnés
    // (reprendre la logique de loadData : lines -> machines, etc.)
    // ...

    // b) Forcer le filtre sur itemName selon comparisonType
    if (comparisonType === 'machines') {
      // On cherche l'ID de la machine correspondant à itemName
      const { data: machData, error: machError } = await supabase
        .from('machines')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', itemName);
      if (machError) throw machError;
      const machineIds = machData?.map((m: any) => m.id) || [];
      if (machineIds.length > 0) {
        lotsQuery = lotsQuery.in('machine', machineIds);
        qualityQuery = qualityQuery.in('machine', machineIds);
      }
    }
    // Idem pour lines, products, teams => adapter selon votre logique

    // 4) Exécuter les requêtes
    const [lotsResult, qualityResult] = await Promise.all([lotsQuery, qualityQuery]);
    if (lotsResult.error) throw lotsResult.error;
    if (qualityResult.error) throw qualityResult.error;

    // 5) Traitement identique à loadData
    const dateMap = new Map<string, QualityData>();
    const machineMap = new Map<string, MachineQuality>();
    const categoryMap = new Map<string, number>();

    let totalParts = 0;
    let totalDefects = 0;
    let totalRework = 0;
    let totalScrap = 0;

    lotsResult.data?.forEach((lot: any) => {
      const date = lot.date;
      const machineId = lot.machine;
      const machineName = lot.machines?.name || 'Unknown';
      totalParts += lot.ok_parts_produced || 0;

      if (!machineMap.has(machineId)) {
        machineMap.set(machineId, {
          id: machineId,
          name: machineName,
          issues: 0,
          rework: 0,
          scrap: 0,
          fpy: 100,
          trend: 0
        });
      }
    });

    qualityResult.data?.forEach((issue: any) => {
      const date = issue.date;
      const machineId = issue.machine;
      const category = issue.category;
      const quantity = issue.quantity || 0;

      const dateData = dateMap.get(date) || { date, rework: 0, scrap: 0, other: 0 };
      if (category === 'scrap') {
        dateData.scrap += quantity;
        totalScrap += quantity;
      } else if (category.includes('rework')) {
        dateData.rework += quantity;
        totalRework += quantity;
      } else {
        dateData.other += quantity;
      }
      dateMap.set(date, dateData);

      const mData = machineMap.get(machineId);
      if (mData) {
        mData.issues++;
        if (category === 'scrap') {
          mData.scrap += quantity;
        } else if (category.includes('rework')) {
          mData.rework += quantity;
        }
      }

      const currentCount = categoryMap.get(category) || 0;
      categoryMap.set(category, currentCount + quantity);

      totalDefects += quantity;
    });

    const firstPassYield = totalParts > 0 ? ((totalParts - totalDefects) / totalParts) * 100 : 100;
    const localMetrics: QualityMetrics = {
      totalIssues: totalDefects,
      reworkRate: totalParts > 0 ? (totalRework / totalParts) * 100 : 0,
      scrapRate: totalParts > 0 ? (totalScrap / totalParts) * 100 : 0,
      firstPassYield,
      trend: 0
    };

    const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries()).map(([cat, count]) => ({
      category: cat,
      count,
      percentage: totalDefects > 0 ? (count / totalDefects) * 100 : 0
    }));
    breakdown.sort((a, b) => b.count - a.count);

    machineMap.forEach(machine => {
      const sumDefects = machine.rework + machine.scrap;
      machine.fpy = totalParts > 0 ? (100 - (sumDefects / totalParts) * 100) : 100;
    });
    const qualityArray = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const machineArray = Array.from(machineMap.values()).sort((a, b) => b.fpy - a.fpy);

    return {
      qualityData: qualityArray,
      machineQuality: machineArray,
      categoryBreakdown: breakdown,
      metrics: localMetrics
    };
  };

  // 4.3) Quand on sélectionne 2 items à comparer
  const handleComparisonItems = async (items: string[]) => {
    setShowComparisonSelector(false);
    setShowComparison(true);
    if (items.length < 2) return;

    // Charger dataA et dataB
    const dataA = await loadComparisonData(items[0]);
    const dataB = await loadComparisonData(items[1]);
    if (!dataA || !dataB) return;

    // Fusion pour le chart QualityTrend
    const mergedQuality: QualityData[] = mergeQualityData(dataA.qualityData, dataB.qualityData);
    setQualityComparisonData(mergedQuality);

    // On peut décider de prendre dataB comme "comparaison" => on stocke metrics de dataB dans comparisonMetrics
    setComparisonMetrics(dataB.metrics);

    // CategoryBreakdown => on merge ou on fait un matching par category
    const catMerged = mergeCategoryBreakdown(dataA.categoryBreakdown, dataB.categoryBreakdown);
    setCategoryBreakdownComparison(catMerged);

    // MachineQuality => on merge ou on matche par machine.id
    const machMerged = mergeMachineQuality(dataA.machineQuality, dataB.machineQuality);
    setMachineQualityComparison(machMerged);
  };

  // 4.4) Nettoyage de la comparaison
  const clearComparison = () => {
    setShowComparison(false);
    setComparisonMetrics(null);
    setQualityComparisonData([]);
    setCategoryBreakdownComparison([]);
    setMachineQualityComparison([]);
  };

  //
  // ---------------------- 5) Fonctions de merge pour la comparaison ----------------------
  //
  function mergeQualityData(dataA: QualityData[], dataB: QualityData[]): QualityData[] {
    const allDates = new Set([...dataA.map(d => d.date), ...dataB.map(d => d.date)]);
    const mapA = new Map(dataA.map(d => [d.date, d]));
    const mapB = new Map(dataB.map(d => [d.date, d]));
    const merged: QualityData[] = [];

    allDates.forEach(date => {
      const rowA = mapA.get(date) || { date, rework: 0, scrap: 0, other: 0 };
      const rowB = mapB.get(date) || { date, rework: 0, scrap: 0, other: 0 };
      merged.push({
        date,
        rework: rowA.rework,
        scrap: rowA.scrap,
        other: rowA.other,
        rework_prev: rowB.rework,
        scrap_prev: rowB.scrap,
        other_prev: rowB.other
      });
    });

    return merged.sort((a, b) => a.date.localeCompare(b.date));
  }

  function mergeCategoryBreakdown(
    catA: CategoryBreakdown[],
    catB: CategoryBreakdown[]
  ): CategoryBreakdown[] {
    // On crée un map pour catA et catB
    const mapA = new Map(catA.map(c => [c.category, c]));
    const mapB = new Map(catB.map(c => [c.category, c]));
    const allCats = new Set([...mapA.keys(), ...mapB.keys()]);

    const merged: CategoryBreakdown[] = [];
    allCats.forEach(category => {
      const cA = mapA.get(category) || { category, count: 0, percentage: 0 };
      const cB = mapB.get(category) || { category, count: 0, percentage: 0 };
      merged.push({
        category,
        count: cA.count,
        percentage: cA.percentage,
        count_prev: cB.count,
        percentage_prev: cB.percentage
      });
    });
    merged.sort((a, b) => b.count - a.count);
    return merged;
  }

  function mergeMachineQuality(
    machA: MachineQuality[],
    machB: MachineQuality[]
  ): MachineQuality[] {
    // On se base sur l'id
    const mapA = new Map(machA.map(m => [m.id, m]));
    const mapB = new Map(machB.map(m => [m.id, m]));
    const allIds = new Set([...mapA.keys(), ...mapB.keys()]);

    const merged: MachineQuality[] = [];
    allIds.forEach(id => {
      const mA = mapA.get(id);
      const mB = mapB.get(id);
      if (mA && mB) {
        merged.push({
          id,
          name: mA.name,
          issues: mA.issues,
          rework: mA.rework,
          scrap: mA.scrap,
          fpy: mA.fpy,
          trend: mA.trend,
          issues_prev: mB.issues,
          rework_prev: mB.rework,
          scrap_prev: mB.scrap,
          fpy_prev: mB.fpy,
          trend_prev: mB.trend
        });
      } else if (mA) {
        merged.push(mA);
      } else if (mB) {
        merged.push(mB);
      }
    });
    // On peut trier par fpy
    merged.sort((a, b) => b.fpy - a.fpy);
    return merged;
  }

  //
  // ---------------------- 6) Export JSON ----------------------
  //
  const handleExport = () => {
    const exportData = {
      qualityData,
      machineQuality,
      categoryBreakdown,
      metrics
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality_report_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  //
  // ---------------------- Données finales affichées ----------------------
  //
  // Pour le chart QualityTrend : si on compare, on affiche le tableau fusionné
  const displayedQualityData = showComparison && qualityComparisonData.length > 0
    ? qualityComparisonData
    : qualityData;

  // CategoryBreakdown : on affiche la version "normale", + on ajoute la ligne de comparaison en dessous
  const displayedCategoryBreakdown = categoryBreakdown;

  // MachineQuality : idem
  const displayedMachineQuality = machineQuality;

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quality Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze quality metrics and identify improvement opportunities
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
                    {(['24h', '7d', '30d', '90d'] as TimeRangeType[]).map(period => (
                      <button
                        key={period}
                        onClick={() => {
                          setSelectedPeriod(period);
                          setShowPeriodDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {period === '24h'
                          ? 'Last 24 hours'
                          : period === '7d'
                          ? 'Last 7 days'
                          : period === '30d'
                          ? 'Last 30 days'
                          : 'Last 90 days'}
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
                  Clear
                </button>
              </div>
            )}

            {/* Filters */}
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

        {/* Panneau de filtres */}
        <FilterPanel
          isVisible={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          options={filterOptions}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
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
            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* First Pass Yield */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        First Pass Yield
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.firstPassYield.toFixed(1)}%
                        </div>
                        {/* Exemple d'évolution (placeholder) */}
                        <div className="ml-2 text-sm font-semibold text-green-600">↑ 1.2%</div>
                      </dd>
                      {/* Ligne de comparaison (opacité 50%) */}
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">
                            {comparisonMetrics.firstPassYield.toFixed(1)}%
                          </div>
                          <div className="ml-2 text-sm font-semibold text-green-600">↑ 0.8%</div>
                        </dd>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Quality Issues */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <AlertOctagon className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Quality Issues
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.totalIssues.toLocaleString()}
                        </div>
                        <div className="ml-2 text-sm font-semibold text-red-600">↑ 5.4%</div>
                      </dd>
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">
                            {comparisonMetrics.totalIssues.toLocaleString()}
                          </div>
                          <div className="ml-2 text-sm font-semibold text-red-600">↑ 2.1%</div>
                        </dd>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rework Rate */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <BarChart2 className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">Rework Rate</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.reworkRate.toFixed(1)}%
                        </div>
                        <div className="ml-2 text-sm font-semibold text-yellow-600">↓ 0.8%</div>
                      </dd>
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">
                            {comparisonMetrics.reworkRate.toFixed(1)}%
                          </div>
                          <div className="ml-2 text-sm font-semibold text-yellow-600">↓ 0.3%</div>
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
                        <div className="ml-2 text-sm font-semibold text-red-600">↑ 0.3%</div>
                      </dd>
                      {showComparison && comparisonMetrics && (
                        <dd className="mt-1 flex items-baseline opacity-50">
                          <div className="text-base font-medium text-gray-900">
                            {comparisonMetrics.scrapRate.toFixed(1)}%
                          </div>
                          <div className="ml-2 text-sm font-semibold text-red-600">↑ 0.1%</div>
                        </dd>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Trend Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Quality Trend</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Target FPY:</span>
                  <span className="text-lg font-semibold text-blue-600">98.5%</span>
                </div>
              </div>
              <QualityChart data={displayedQualityData} showComparison={showComparison} />
            </div>

            {/* Category Breakdown */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quality Issues by Category</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {displayedCategoryBreakdown.map(cat => {
                    const compCat = categoryBreakdownComparison.find(c => c.category === cat.category);

                    return (
                      <div key={cat.category} className="bg-gray-50 rounded-lg p-4">
                        <div className="sm:flex sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {cat.category === 'scrap'
                                ? 'Scrap'
                                : cat.category.includes('rework')
                                ? 'Rework'
                                : cat.category}
                            </h4>
                            <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                              <span>{cat.count.toLocaleString()} issues</span>
                              <span>{cat.percentage.toFixed(1)}% of total</span>
                            </div>
                          </div>
                        </div>

                        {/* Comparaison (opacité 50%) */}
                        {showComparison && compCat && (
                          <div className="mt-1 text-sm text-gray-500 opacity-50">
                            <span>{(compCat.count_prev ?? compCat.count).toLocaleString()} issues</span>
                            <span className="ml-4">
                              {(compCat.percentage_prev ?? compCat.percentage).toFixed(1)}% of total
                            </span>
                          </div>
                        )}

                        <div className="mt-4">
                          <div className="relative pt-1">
                            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                              <div
                                style={{ width: `${cat.percentage}%` }}
                                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                  cat.category === 'scrap'
                                    ? 'bg-red-600'
                                    : cat.category.includes('rework')
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-500'
                                }`}
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

            {/* Machine Quality */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Machine Quality Performance</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {displayedMachineQuality.map(machine => {
                    const compMachine = machineQualityComparison.find(m => m.id === machine.id);
                    return (
                      <div key={machine.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="sm:flex sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{machine.name}</h4>
                            <div className="mt-1 flex items-center space-x-6 text-sm text-gray-500">
                              <span>{machine.issues} issues</span>
                              <span>{machine.rework} rework</span>
                              <span>{machine.scrap} scrap</span>
                              <span className="font-medium text-blue-600">
                                {machine.fpy.toFixed(1)}% FPY
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

                        {/* Comparaison (opacité 50%) */}
                        {showComparison && compMachine && (
                          <div className="sm:flex sm:items-center sm:justify-between mt-2 opacity-50">
                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                              <span>{compMachine.issues_prev ?? compMachine.issues} issues</span>
                              <span>{compMachine.rework_prev ?? compMachine.rework} rework</span>
                              <span>{compMachine.scrap_prev ?? compMachine.scrap} scrap</span>
                              <span className="font-medium text-blue-600">
                                {(compMachine.fpy_prev ?? compMachine.fpy).toFixed(1)}% FPY
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
                                style={{ width: `${machine.fpy}%` }}
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

        {/* Modals de comparaison */}
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

//
// Fonctions utilitaires ? (si vous en avez besoin ailleurs)
//

export default QualityReport;
