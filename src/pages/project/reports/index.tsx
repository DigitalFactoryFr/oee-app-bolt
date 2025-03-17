import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, subDays, startOfToday, startOfYesterday, differenceInMinutes } from 'date-fns';
import {
  Calendar,
  Download,
  Filter,
  ArrowRightLeft,
  ChevronDown,
  Activity,
  Gauge,
  Package,
  AlertTriangle,
  Clock,
  ChevronRight
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import ProjectLayout from '../../../components/layout/ProjectLayout';

// Charts
import OEEChart from '../../../components/charts/OEEChart';
import ProductionChart from '../../../components/charts/ProductionChart';
import DowntimeChart from '../../../components/charts/DowntimeChart';
import QualityChart from '../../../components/charts/QualityChart';

// Filters / Comparison
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';
import FilterPanel from '../../../components/reports/FilterPanel';

interface Metrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalProduction: number;
  firstPassYield: number;
  scrapRate: number;
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'quarter';

function mergeComparisonData(dataA: any[], dataB: any[]) {
  // Fusionne par date (même si les séries ne sont pas de même longueur)
  const allDates = new Set([...dataA.map(d => d.date), ...dataB.map(d => d.date)]);
  const mapA = new Map(dataA.map(d => [d.date, d]));
  const mapB = new Map(dataB.map(d => [d.date, d]));
  const merged: any[] = [];
  allDates.forEach(date => {
    const rowA = mapA.get(date) || {};
    const rowB = mapB.get(date) || {};
    merged.push({
      date,
      oee: rowA.oee ?? 0,
      availability: rowA.availability ?? 0,
      performance: rowA.performance ?? 0,
      quality: rowA.quality ?? 0,
      oee_prev: rowB.oee ?? 0,
      availability_prev: rowB.availability ?? 0,
      performance_prev: rowB.performance ?? 0,
      quality_prev: rowB.quality ?? 0
    });
  });
  return Array.from(merged).sort((a, b) => (a.date < b.date ? -1 : 1));
}

const ReportsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Période sélectionnée
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Comparaison
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

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

  // Chargement / Erreur
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [hasData, setHasData] = useState(false);

  // Données des graphiques et indicateurs
  const [oeeData, setOeeData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const [downtimeData, setDowntimeData] = useState<any[]>([]);
  const [qualityData, setQualityData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    totalProduction: 0,
    firstPassYield: 0,
    scrapRate: 0
  });

  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
  }, [projectId, selectedPeriod, selectedFilters]);

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

  // Helpers pour convertir noms → UUID
  const getMachineIdsByName = async (names: string[]): Promise<string[]> => {
    if (!names.length) return [];
    const { data, error } = await supabase
      .from('machines')
      .select('id, name')
      .eq('project_id', projectId)
      .in('name', names);
    if (error) {
      console.error('Error in getMachineIdsByName:', error);
      return [];
    }
    return data?.map(m => m.id) || [];
  };

  const getProductIdsByName = async (names: string[]): Promise<string[]> => {
    if (!names.length) return [];
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('project_id', projectId)
      .in('name', names);
    return data?.map(p => p.id) || [];
  };

  const getTeamMemberIdsByTeamName = async (names: string[]): Promise<string[]> => {
    if (!names.length) return [];
    const { data } = await supabase
      .from('team_members')
      .select('id, team_name')
      .eq('project_id', projectId)
      .in('team_name', names);
    return data?.map(t => t.id) || [];
  };

  const loadFilterOptions = async () => {
    if (!projectId) return;
    try {
      const [machRes, linesRes, prodRes, teamsRes] = await Promise.all([
        supabase.from('machines').select('id, name').eq('project_id', projectId),
        supabase.from('production_lines').select('id, name').eq('project_id', projectId),
        supabase.from('products').select('id, name').eq('project_id', projectId),
        supabase.from('team_members').select('id, team_name').eq('project_id', projectId)
      ]);

      setFilterOptions({
        machines: Array.from(new Set(machRes.data?.map(m => m.name) || [])),
        lines: Array.from(new Set(linesRes.data?.map(l => l.name) || [])),
        products: Array.from(new Set(prodRes.data?.map(p => p.name) || [])),
        teams: Array.from(new Set(teamsRes.data?.map(t => t.team_name) || []))
      });
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      // Vérifier les lots
      const { count, error: countError } = await supabase
        .from('lots')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);
      if (countError) throw countError;
      if (!count || count === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }
      setHasData(true);

      const { startDate, endDate } = getDateRange();

      // Requête sur les lots (utiliser start_time pour filtrer)
      let lotsQuery = supabase
        .from('lots')
        .select(`
          id,
          start_time,
          end_time,
          ok_parts_produced,
          lot_size,
          machine,
          product,
          team_member,
          products:product ( cycle_time )
        `)
        .eq('project_id', projectId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());

      if (selectedFilters.machines.length > 0) {
        const machineIDs = await getMachineIdsByName(selectedFilters.machines);
        lotsQuery = lotsQuery.in('machine', machineIDs);
      }
      if (selectedFilters.products.length > 0) {
        const productIDs = await getProductIdsByName(selectedFilters.products);
        lotsQuery = lotsQuery.in('product', productIDs);
      }
      if (selectedFilters.teams.length > 0) {
        const teamIDs = await getTeamMemberIdsByTeamName(selectedFilters.teams);
        lotsQuery = lotsQuery.in('team_member', teamIDs);
      }

      // Requête sur stop_events
      let stopsQuery = supabase
        .from('stop_events')
        .select(`
          id,
          start_time,
          end_time,
          machine,
          failure_type
        `)
        .eq('project_id', projectId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());
      if (selectedFilters.machines.length > 0) {
        const machineIDs = await getMachineIdsByName(selectedFilters.machines);
        stopsQuery = stopsQuery.in('machine', machineIDs);
      }
      // Si vous avez des colonnes product/team dans stop_events, appliquez-les de la même façon.

      // Requête sur quality_issues
      let qualityQuery = supabase
        .from('quality_issues')
        .select(`
          id,
          machine,
          category,
          quantity,
          date
        `)
        .eq('project_id', projectId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));
      if (selectedFilters.machines.length > 0) {
        const machineIDs = await getMachineIdsByName(selectedFilters.machines);
        qualityQuery = qualityQuery.in('machine', machineIDs);
      }
      // Idem pour products ou teams si ces colonnes existent dans quality_issues.

      const [lotsResult, stopsResult, qualityResult] = await Promise.all([
        lotsQuery,
        stopsQuery,
        qualityQuery
      ]);
      if (lotsResult.error) throw lotsResult.error;
      if (stopsResult.error) throw stopsResult.error;
      if (qualityResult.error) throw qualityResult.error;

      // Préparation du calcul par jour
      const dateMap = new Map<string, any>();

      lotsResult.data?.forEach((lot: any) => {
        const dayStr = format(new Date(lot.start_time), 'yyyy-MM-dd');
        if (!dateMap.has(dayStr)) {
          dateMap.set(dayStr, {
            date: dayStr,
            // PlannedProductionTime = (end_time - start_time) - (durée des arrêts planifiés)
            plannedTime: 0,
            // RunTime = (end_time - start_time) - (tous les arrêts)
            runTime: 0,
            // On stocke aussi les durées d'arrêts planifiés et non planifiés
            plannedStops: 0,
            unplannedStops: 0,
            netTimeSec: 0,
            okParts: 0,
            scrapParts: 0,
            rework: 0,
            other: 0,
            actual: 0,
            target: 0
          });
        }
        const data = dateMap.get(dayStr);
        const st = new Date(lot.start_time);
        // Si le lot est toujours en cours, on considère end_time = now
        const et = lot.end_time ? new Date(lot.end_time) : new Date();
        const lotDuration = Math.max(0, differenceInMinutes(et, st));
        // Pour PlannedProductionTime, on ne retire que les arrêts planifiés (ex. failure_type === 'PA')
        data.plannedTime += lotDuration;
        // Pour RunTime, nous soustrairons tous les arrêts (calculé ultérieurement)
        // NetTimeSec = ok_parts_produced * cycle_time (en secondes)
        if (lot.products?.cycle_time && lot.ok_parts_produced > 0) {
          data.netTimeSec += lot.ok_parts_produced * lot.products.cycle_time;
        }
        data.okParts += lot.ok_parts_produced;
        data.actual += lot.ok_parts_produced;
        if (lot.lot_size) {
          // Partial target calculé sur le ratio écoulé du lot
          const now = new Date();
          const elapsed = differenceInMinutes(now > et ? et : now, st);
          const ratio = Math.min(elapsed / lotDuration, 1);
          data.target += Math.round(ratio * lot.lot_size);
        }
      });

      // Traiter les stops
      stopsResult.data?.forEach((stop: any) => {
        const dayStr = format(new Date(stop.start_time), 'yyyy-MM-dd');
        if (!dateMap.has(dayStr)) {
          dateMap.set(dayStr, {
            date: dayStr,
            plannedTime: 0,
            runTime: 0,
            plannedStops: 0,
            unplannedStops: 0,
            netTimeSec: 0,
            okParts: 0,
            scrapParts: 0,
            rework: 0,
            other: 0,
            actual: 0,
            target: 0
          });
        }
        const data = dateMap.get(dayStr);
        const sTime = new Date(stop.start_time);
        const eTime = stop.end_time ? new Date(stop.end_time) : new Date();
        const stopDuration = Math.max(0, differenceInMinutes(eTime, sTime));
        // Pour RunTime, tous les arrêts sont retirés
        // Pour PlannedProductionTime, on retire seulement les arrêts planifiés
        if (stop.failure_type === 'PA') {
          data.plannedStops += stopDuration;
        } else {
          data.unplannedStops += stopDuration;
        }
      });

      // Traiter les quality issues pour récupérer le scrap
      qualityResult.data?.forEach((issue: any) => {
        const dayStr = issue.date;
        if (!dateMap.has(dayStr)) {
          dateMap.set(dayStr, {
            date: dayStr,
            plannedTime: 0,
            runTime: 0,
            plannedStops: 0,
            unplannedStops: 0,
            netTimeSec: 0,
            okParts: 0,
            scrapParts: 0,
            rework: 0,
            other: 0,
            actual: 0,
            target: 0
          });
        }
        const data = dateMap.get(dayStr);
        if (issue.category === 'scrap') {
          data.scrapParts += issue.quantity;
        } else if (issue.category.includes('rework')) {
          data.rework += issue.quantity;
        } else {
          data.other += issue.quantity;
        }
      });

      // Calcul final par jour
      const tmpOEEData: any[] = [];
      const tmpProdData: any[] = [];
      const tmpQualityData: any[] = [];

      let dayCount = 0;
      let sumA = 0, sumP = 0, sumQ = 0, sumOEE = 0;
      let globalOk = 0, globalScrap = 0, globalDefects = 0;

      const allDays = Array.from(dateMap.values()).sort((a, b) => a.date < b.date ? -1 : 1);
      allDays.forEach(d => {
        // RunTime = (lot duration) - (tous les arrêts)
        const runTime = Math.max(0, d.plannedTime - (d.plannedStops + d.unplannedStops));
        // Planned Production Time = (lot duration) - (arrêts planifiés)
        const plannedProdTime = Math.max(0, d.plannedTime - d.plannedStops);
        // Pour Availability : si plannedProdTime > 0, A = runTime / plannedProdTime * 100
        let A = 0;
        if (plannedProdTime > 0) {
          A = (runTime / plannedProdTime) * 100;
        }
        // Pour Performance : NetTime = okParts * cycle_time + scrapParts * (cycle_time moyen)
        let netSec = d.netTimeSec;
        const totParts = d.okParts + d.scrapParts;
        if (d.okParts > 0 && d.scrapParts > 0) {
          const avgCycle = netSec / d.okParts;
          netSec += avgCycle * d.scrapParts;
        }
        const netMin = netSec / 60;
        let P = 0;
        if (runTime > 0) {
          P = (netMin / runTime) * 100;
          if (P > 100) P = 100;
        }
        // Qualité = okParts / (okParts + scrapParts)
        let Q = 100;
        if (totParts > 0) {
          Q = (d.okParts / totParts) * 100;
        }
        // OEE = (A * P * Q) / 1,000,000 * 100
        const OEE = ((A * P * Q) / 1000000) * 100;

        d.availability = A;
        d.performance = P;
        d.quality = Q;
        d.oee = OEE;

        tmpOEEData.push({
          date: d.date,
          oee: OEE,
          availability: A,
          performance: P,
          quality: Q
        });
        tmpProdData.push({
          date: d.date,
          actual: d.okParts,
          target: d.target > 0 ? d.target : totParts,
          scrap: d.scrapParts
        });
        tmpQualityData.push({
          date: d.date,
          rework: d.rework,
          scrap: d.scrapParts,
          other: d.other
        });

        if (totParts > 0) {
          sumA += A;
          sumP += P;
          sumQ += Q;
          sumOEE += OEE;
          dayCount++;
        }
        globalOk += d.okParts;
        globalScrap += d.scrapParts;
        globalDefects += (d.scrapParts + d.rework + d.other);
      });

      // Downtime distribution (pour le pie chart)
      const tmpDowntime = stopsResult.data?.reduce((acc: any, stop: any) => {
        const sTime = new Date(stop.start_time);
        const eTime = stop.end_time ? new Date(stop.end_time) : new Date();
        const durH = (eTime.getTime() - sTime.getTime()) / (1000 * 60 * 60);
        const type = stop.failure_type || 'Unknown';
        const existing = acc.find((x: any) => x.name === type);
        if (existing) {
          existing.value += durH;
        } else {
          acc.push({
            name: type,
            value: durH,
            color:
              type === 'AP' ? '#2563eb' :
              type === 'PA' ? '#dc2626' :
              type === 'DO' ? '#eab308' :
              type === 'NQ' ? '#9333ea' :
              '#16a34a'
          });
        }
        return acc;
      }, []);

      let avgA = 0, avgP = 0, avgQ = 0, avgOEE = 0;
      if (dayCount > 0) {
        avgA = sumA / dayCount;
        avgP = sumP / dayCount;
        avgQ = sumQ / dayCount;
        avgOEE = sumOEE / dayCount;
      }
      const totalProduction = globalOk;
      const totalScrap = globalScrap;
      const totalDefects = globalDefects;
      const firstPassYield = totalProduction > 0 ? ((totalProduction - totalDefects) / totalProduction) * 100 : 0;
      const scrapRate = totalProduction > 0 ? (totalScrap / totalProduction) * 100 : 0;

      setOeeData(tmpOEEData);
      setProductionData(tmpProdData);
      setQualityData(tmpQualityData);
      setDowntimeData(tmpDowntime || []);

      setMetrics({
        oee: avgOEE,
        availability: avgA,
        performance: avgP,
        quality: avgQ,
        totalProduction,
        firstPassYield,
        scrapRate
      });

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  // Comparaison : sélection du type et chargement de data pour comparaison
  const handleComparisonSelect = (type: string) => {
    setComparisonType(type);
    setShowCompareModal(false);
    setShowComparisonSelector(true);
  };

  const handleComparisonItems = async (items: string[]) => {
    setShowComparisonSelector(false);
    setShowComparison(true);
    // Par exemple, items contiendra les noms de 2 machines
    const dataA = await loadComparisonDataForMachine(items[0]);
    const dataB = await loadComparisonDataForMachine(items[1]);
    const merged = mergeComparisonData(dataA, dataB);
    setComparisonData(merged);
  };

  const loadComparisonDataForMachine = async (machineName: string) => {
    // On convertit le nom en ID
    const [machineId] = await getMachineIdsByName([machineName]);
    if (!machineId) return [];
    const { startDate, endDate } = getDateRange();
    const lotsRes = await supabase
      .from('lots')
      .select(`
        id,
        start_time,
        end_time,
        ok_parts_produced,
        lot_size,
        products:product ( cycle_time )
      `)
      .eq('project_id', projectId)
      .eq('machine', machineId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());
    const stopsRes = await supabase
      .from('stop_events')
      .select(`
        start_time,
        end_time,
        failure_type
      `)
      .eq('project_id', projectId)
      .eq('machine', machineId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());
    const qualityRes = await supabase
      .from('quality_issues')
      .select(`
        category,
        quantity,
        date
      `)
      .eq('project_id', projectId)
      .eq('machine', machineId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));
    if (lotsRes.error || stopsRes.error || qualityRes.error) return [];
    const dateMap = new Map<string, any>();
    lotsRes.data?.forEach((lot: any) => {
      const dayStr = format(new Date(lot.start_time), 'yyyy-MM-dd');
      if (!dateMap.has(dayStr)) {
        dateMap.set(dayStr, {
          date: dayStr,
          plannedTime: 0,
          unplanned: 0,
          netTimeSec: 0,
          okParts: 0,
          scrapParts: 0
        });
      }
      const obj = dateMap.get(dayStr);
      const st = new Date(lot.start_time);
      const et = lot.end_time ? new Date(lot.end_time) : new Date();
      const durMin = differenceInMinutes(et, st);
      obj.plannedTime += Math.max(0, durMin);
      if (lot.products?.cycle_time && lot.ok_parts_produced > 0) {
        obj.netTimeSec += lot.ok_parts_produced * lot.products.cycle_time;
      }
      obj.okParts += lot.ok_parts_produced;
    });
    stopsRes.data?.forEach((stop: any) => {
      const dayStr = format(new Date(stop.start_time), 'yyyy-MM-dd');
      if (!dateMap.has(dayStr)) {
        dateMap.set(dayStr, {
          date: dayStr,
          plannedTime: 0,
          unplanned: 0,
          netTimeSec: 0,
          okParts: 0,
          scrapParts: 0
        });
      }
      const obj = dateMap.get(dayStr);
      if (stop.failure_type !== 'PA') { // Tous les arrêts non planifiés
        const sTime = new Date(stop.start_time);
        const eTime = stop.end_time ? new Date(stop.end_time) : new Date();
        const durMin = differenceInMinutes(eTime, sTime);
        obj.unplanned += Math.max(0, durMin);
      }
    });
    qualityRes.data?.forEach((q: any) => {
      const dayStr = q.date;
      if (!dateMap.has(dayStr)) {
        dateMap.set(dayStr, {
          date: dayStr,
          plannedTime: 0,
          unplanned: 0,
          netTimeSec: 0,
          okParts: 0,
          scrapParts: 0
        });
      }
      const obj = dateMap.get(dayStr);
      if (q.category === 'scrap') {
        obj.scrapParts = (obj.scrapParts || 0) + q.quantity;
      }
    });
    const arr: any[] = [];
    Array.from(dateMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1)).forEach(d => {
      const runTime = Math.max(0, d.plannedTime - d.unplanned);
      let netSec = d.netTimeSec;
      const totParts = d.okParts + (d.scrapParts || 0);
      if (d.okParts > 0 && d.scrapParts > 0) {
        const avgCycle = netSec / d.okParts;
        netSec += avgCycle * d.scrapParts;
      }
      const netMin = netSec / 60;
      let A = 0, P = 0, Q = 0, OEE = 0;
      if (d.plannedTime > 0) {
        A = (runTime / d.plannedTime) * 100;
      }
      if (runTime > 0) {
        P = (netMin / runTime) * 100;
        if (P > 100) P = 100;
      }
      if (totParts > 0) {
        Q = (d.okParts / totParts) * 100;
      }
      const frac = (A * P * Q) / 1000000;
      OEE = frac * 100;
      arr.push({
        date: d.date,
        oee: OEE,
        availability: A,
        performance: P,
        quality: Q
      });
    });
    return arr;
  };

  const handleExport = () => {
    const exportData = {
      oee: oeeData,
      production: productionData,
      quality: qualityData,
      downtime: downtimeData
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_report_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFilterChange = (category: string, values: string[]) => {
    setSelectedFilters(prev => ({ ...prev, [category]: values }));
  };

  const handleClearFilters = () => {
    setSelectedFilters({ machines: [], lines: [], products: [], teams: [] });
  };

  // Boutons actifs si filtre ou comparaison
  const isFilterActive =
    selectedFilters.machines.length > 0 ||
    selectedFilters.lines.length > 0 ||
    selectedFilters.products.length > 0 ||
    selectedFilters.teams.length > 0;

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze your production performance and identify improvement opportunities
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Période */}
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
                    {(['today', 'yesterday', 'week', 'month', 'quarter'] as PeriodType[]).map(period => (
                      <button
                        key={period}
                        onClick={() => {
                          setSelectedPeriod(period);
                          setShowPeriodDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {period === 'today'
                          ? 'Today'
                          : period === 'yesterday'
                          ? 'Yesterday'
                          : period === 'week'
                          ? 'Last 7 days'
                          : period === 'month'
                          ? 'Last 30 days'
                          : 'Last 90 days'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compare */}
            <button
              onClick={() => setShowCompareModal(true)}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                showComparison
                  ? 'border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Compare
            </button>

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

        <FilterPanel
          isVisible={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          options={filterOptions}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
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
        ) : !hasData ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Production Data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start recording production data to see analytics and reports.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OEE Overview */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">OEE Overview</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {metrics.oee.toFixed(1)}%
                  </span>
                  <span className="text-sm text-green-600">↑ 2.3%</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.availability.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Availability</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.performance.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Performance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.quality.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Quality</div>
                </div>
              </div>
              <OEEChart
                data={oeeData}
                showComparison={showComparison}
                comparisonData={comparisonData}
              />
            </div>

            {/* Production Trends */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Production Trends</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {metrics.totalProduction.toLocaleString()}
                  </span>
                  <span className="text-sm text-green-600">↑ 5.7%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.firstPassYield.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">First Pass Yield</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.scrapRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Scrap Rate</div>
                </div>
              </div>
              <ProductionChart data={productionData} />
            </div>

            {/* Downtime Analysis */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Downtime Analysis</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">24.5h</span>
                  <span className="text-red-600">↑ 1.2h</span>
                </div>
              </div>
              <DowntimeChart data={downtimeData} />
            </div>

            {/* Quality Issues */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Quality Issues</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">187</span>
                  <span className="text-red-600">↑ 12</span>
                </div>
              </div>
              <QualityChart data={qualityData} />
            </div>
          </div>
        )}

        {/* Detailed Reports */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Reports</h3>
          <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
            {[
              {
                id: 'oee',
                title: 'OEE Report',
                description: 'Detailed analysis of Overall Equipment Effectiveness',
                path: 'oee',
                icon: Gauge
              },
              {
                id: 'production',
                title: 'Production Report',
                description: 'Production volumes, efficiency, and trends',
                path: 'production',
                icon: Package
              },
              {
                id: 'quality',
                title: 'Quality Report',
                description: 'Quality metrics, defects analysis, and trends',
                path: 'quality',
                icon: AlertTriangle
              },
              {
                id: 'downtime',
                title: 'Downtime Report',
                description: 'Analysis of stops, causes, and impact',
                path: 'downtime',
                icon: Clock
              }
            ].map(section => {
              const Icon = section.icon;
              return (
                <div
                  key={section.id}
                  onClick={() => navigate(`/projects/${projectId}/reports/${section.path}`)}
                  className="p-6 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Icon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-base font-medium text-gray-900">{section.title}</h4>
                        <p className="mt-1 text-sm text-gray-500">{section.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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

export default ReportsPage;
