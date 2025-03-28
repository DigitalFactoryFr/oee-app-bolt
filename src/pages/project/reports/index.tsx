import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  format,
  subDays,
  startOfToday,
  startOfYesterday,
  differenceInMinutes
} from 'date-fns';

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
  ChevronRight,
  X,
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import ProjectLayout from '../../../components/layout/ProjectLayout';

// Charts
import OEEChart from '../../../components/charts/OEEChart';
import ProductionChart from '../../../components/charts/ProductionChart';
import QualityChart from '../../../components/charts/QualityChart';
import DowntimeChart from '../../../components/charts/DowntimeChart';
import StopTimeChart from '../../../components/charts/StopTimeChart';

// Filters / Comparison
import ComparisonModal from '../../../components/reports/ComparisonModal';
import ComparisonSelector from '../../../components/reports/ComparisonSelector';
import FilterPanel from '../../../components/reports/FilterPanel';

// ---------------------------------------------------
//                 Types et interfaces
// ---------------------------------------------------
interface Metrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalProduction: number;
  firstPassYield: number;
  scrapRate: number;
  totalStopTime: number;
  totalScrap?: number;
  totalRework?: number;
  totalPannes?: number; 
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'quarter';

// ---------------------------------------------------
//                 Fonctions de merge
// ---------------------------------------------------
function mergeOEEData(dataA: any[], dataB: any[]) {
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

  return merged.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function mergeProductionData(dataA: any[], dataB: any[]) {
  const allDates = new Set([...dataA.map(d => d.date), ...dataB.map(d => d.date)]);
  const mapA = new Map(dataA.map(d => [d.date, d]));
  const mapB = new Map(dataB.map(d => [d.date, d]));
  const merged: any[] = [];

  allDates.forEach(date => {
    const rowA = mapA.get(date) || {};
    const rowB = mapB.get(date) || {};
    merged.push({
      date,
      actual: rowA.actual ?? 0,
      target: rowA.target ?? 0,
      scrap: rowA.scrap ?? 0,
      actual_prev: rowB.actual ?? 0,
      target_prev: rowB.target ?? 0,
      scrap_prev: rowB.scrap ?? 0
    });
  });

  return merged.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function mergeQualityData(dataA: any[], dataB: any[]) {
  const allDates = new Set([...dataA.map(d => d.date), ...dataB.map(d => d.date)]);
  const mapA = new Map(dataA.map(d => [d.date, d]));
  const mapB = new Map(dataB.map(d => [d.date, d]));
  const merged: any[] = [];

  allDates.forEach(date => {
    const rowA = mapA.get(date) || {};
    const rowB = mapB.get(date) || {};
    merged.push({
      date,
      rework: rowA.rework ?? 0,
      scrap: rowA.scrap ?? 0,
      other: rowA.other ?? 0,
      rework_prev: rowB.rework ?? 0,
      scrap_prev: rowB.scrap ?? 0,
      other_prev: rowB.other ?? 0
    });
  });

  return merged.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function mergeStopTimeData(dataA: any[], dataB: any[]) {
  const allDates = new Set([...dataA.map(d => d.date), ...dataB.map(d => d.date)]);
  const mapA = new Map(dataA.map(d => [d.date, d]));
  const mapB = new Map(dataB.map(d => [d.date, d]));
  const merged: any[] = [];

  allDates.forEach(date => {
    const rowA = mapA.get(date) || {};
    const rowB = mapB.get(date) || {};
    merged.push({
      date,
      AP: rowA.AP ?? 0,
      PA: rowA.PA ?? 0,
      DO: rowA.DO ?? 0,
      NQ: rowA.NQ ?? 0,
      other: rowA.other ?? 0,
      AP_prev: rowB.AP ?? 0,
      PA_prev: rowB.PA ?? 0,
      DO_prev: rowB.DO ?? 0,
      NQ_prev: rowB.NQ ?? 0,
      other_prev: rowB.other ?? 0
    });
  });

  return merged.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Exemple simple : on retourne un tableau [distA, distB] pour un "double donut"
function mergeDowntimeDistribution(distA: any[], distB: any[]) {
  return [distA, distB];
}

// ---------------------------------------------------
//                 Composant principal
// ---------------------------------------------------
const ReportsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // ------------------- États -------------------
  // Période
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Comparaison
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [comparisonType, setComparisonType] = useState<string>('machines');
  const [showComparison, setShowComparison] = useState(false);

  // Données de comparaison
  const [oeeComparisonData, setOeeComparisonData] = useState<any[]>([]);
  const [productionComparisonData, setProductionComparisonData] = useState<any[]>([]);
  const [qualityComparisonData, setQualityComparisonData] = useState<any[]>([]);
  const [stopTimeComparisonData, setStopTimeComparisonData] = useState<any[]>([]);
  const [downtimeComparisonData, setDowntimeComparisonData] = useState<any[]>([]); // Pour un double donut
  const [comparisonMetrics, setComparisonMetrics] = useState<Metrics | null>(null);

  // Données "normales"
  const [oeeData, setOeeData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const [qualityData, setQualityData] = useState<any[]>([]);
  const [stopTimeData, setStopTimeData] = useState<any[]>([]);
  const [downtimeData, setDowntimeData] = useState<any[]>([]);

  // Tableau fusionné pour OEE
  const [oeeDataMerged, setOeeDataMerged] = useState<any[]>([]);

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

  // État chargement / erreur
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  // KPI
  const [metrics, setMetrics] = useState<Metrics>({
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    totalProduction: 0,
    firstPassYield: 0,
    scrapRate: 0,
    totalStopTime: 0
  });

  // ------------------- useEffect -------------------
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
  }, [projectId, selectedPeriod, selectedFilters]);

  // ------------------- Fonctions internes -------------------
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

  function clearComparison() {
    setShowComparison(false);
    setOeeComparisonData([]);
    setProductionComparisonData([]);
    setQualityComparisonData([]);
    setStopTimeComparisonData([]);
    setDowntimeComparisonData([]);
    setComparisonMetrics(null);
    setOeeDataMerged([]); 
  }
function mapFailureType(ft: string | null | undefined): string {
  // On convertit en chaîne, on force en minuscules puis on renvoie en majuscules les valeurs reconnues
  const ftStr = String(ft || '').toLowerCase();
  switch (ftStr) {
    case 'ap':
    case 'pa':
    case 'do':
    case 'nq':
      return ftStr.toUpperCase();
    default:
      return 'CS';
  }
}


  // Helpers pour récupérer des IDs en fonction des noms
  async function getMachineIdsByName(names: string[]): Promise<string[]> {
    if (!names.length) return [];
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

async function getProductIdsByName(names: string[]): Promise<string[]> {
  if (!names.length) return [];
  
  // Regex pour détecter un UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Si tous les "names" sont déjà des UUID, on les retourne directement
  if (names.every(n => uuidRegex.test(n))) {
    return names;
  }

  // Sinon, on suppose que ce sont des noms
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

async function getLineIdsByName(names: string[]): Promise<string[]> {
  if (!names.length) return [];

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (names.every(n => uuidRegex.test(n))) {
    // Déjà des UUID
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


  // ------------------- loadFilterOptions -------------------
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

  function getPreviousRange(period: PeriodType) {
  const { startDate, endDate } = getDateRange(period); // ta fonction existante
  const duration = endDate.getTime() - startDate.getTime();
  return {
    startDate: new Date(startDate.getTime() - duration),
    endDate: new Date(endDate.getTime() - duration)
  };
}


  // ------------------- loadData (pour affichage normal) -------------------
  async function loadData() {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      // Vérifier la présence de lots
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

      // Déterminer la plage de dates
      const { startDate, endDate } = getDateRange();
let globalScrap = 0;
let globalRework = 0;
let globalPannes = 0;
let totalPannesTime = 0;  
      
  
      // Préparer les requêtes
      let lotsQuery = supabase
        .from('lots')
        .select(`
          id,
          start_time,
          end_time,
          machine,
          product,
          team_member,
          lot_size,
          ok_parts_produced,
          products:product ( cycle_time )
        `)
        .eq('project_id', projectId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());

      let stopsQuery = supabase
        .from('stop_events')
        .select(`
          id,
          start_time,
          end_time,
          machine,
          product,
          team_member,
          failure_type
        `)
        .eq('project_id', projectId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());

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

      // Appliquer les filtres
      let finalMachineIDs: string[] = [];
      if (selectedFilters.lines.length > 0) {
        const lineIDs = await getLineIdsByName(selectedFilters.lines);
        if (lineIDs.length > 0) {
          const { data: machOfLines } = await supabase
            .from('machines')
            .select('id, line_id')
            .eq('project_id', projectId)
            .in('line_id', lineIDs);
          if (machOfLines) {
            const lineMachineIDs = machOfLines.map((m: any) => m.id);
            finalMachineIDs = [...finalMachineIDs, ...lineMachineIDs];
          }
        }
      }
      if (selectedFilters.machines.length > 0) {
        const machineIDs = await getMachineIdsByName(selectedFilters.machines);
        finalMachineIDs = [...finalMachineIDs, ...machineIDs];
      }
      finalMachineIDs = Array.from(new Set(finalMachineIDs));
      if (finalMachineIDs.length > 0) {
        lotsQuery.in('machine', finalMachineIDs);
        stopsQuery.in('machine', finalMachineIDs);
        qualityQuery.in('machine', finalMachineIDs);
      }
      if (selectedFilters.products.length > 0) {
        const productIDs = await getProductIdsByName(selectedFilters.products);
        if (productIDs.length > 0) {
          lotsQuery.in('product', productIDs);
          stopsQuery.in('product', productIDs);
          qualityQuery.in('product', productIDs);
        }
      }
      if (selectedFilters.teams.length > 0) {
        const teamIDs = await getTeamMemberIdsByTeamName(selectedFilters.teams);
        if (teamIDs.length > 0) {
          lotsQuery.in('team_member', teamIDs);
          stopsQuery.in('team_member', teamIDs);
          qualityQuery.in('team_member', teamIDs);
        }
      }

      // Exécuter les requêtes
      const [lotsResult, stopsResult, qualityResult] = await Promise.all([
        lotsQuery,
        stopsQuery,
        qualityQuery
      ]);
      if (lotsResult.error) throw lotsResult.error;
      if (stopsResult.error) throw stopsResult.error;
      if (qualityResult.error) throw qualityResult.error;

      // Construction des données
      const dateMap = new Map<string, any>();
      const stopMap = new Map<string, any>();
      const tmpDowntime: any[] = [];

      function addDowntime(type: string, hours: number) {
        const found = tmpDowntime.find(x => x.name === type);
        if (found) found.value += hours;
        else {
          tmpDowntime.push({
            name: type,
            value: hours,
            // Couleurs au choix
            color:
              type === 'AP' ? '#2563eb' :
              type === 'PA' ? '#dc2626' :
              type === 'DO' ? '#eab308' :
              type === 'NQ' ? '#9333ea' :
              '#9ca3af'
          });
        }
      }

      // 1) Parcourir lots
// ...
// 1) Parcourir les lots
// -------------------- LOADDATA - LOTS --------------------
lotsResult.data?.forEach((lot: any) => {
  // Récupère start/end
  const st = new Date(lot.start_time);
  let et = lot.end_time ? new Date(lot.end_time) : new Date();

  // Borne la fin à endDate si ça dépasse
  if (et > endDate) {
    et = endDate;
  }

  // Calcule la durée en minutes
  const durMin = Math.max(0, differenceInMinutes(et, st));

  // Formate le jour (aaaa-mm-jj)
  const dayStr = format(st, 'yyyy-MM-dd');

  // Initialise la case du dateMap si elle n’existe pas
  if (!dateMap.has(dayStr)) {
    dateMap.set(dayStr, {
      date: dayStr,
      plannedTime: 0,
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
  const obj = dateMap.get(dayStr);

  // Incrémente plannedTime
  obj.plannedTime += durMin;

  // Si cycle_time, on ajoute au netTimeSec (ok_parts_produced * cycle_time)
  if (lot.products?.cycle_time && lot.ok_parts_produced > 0) {
    obj.netTimeSec += lot.ok_parts_produced * lot.products.cycle_time;
  }

  // OK parts
  obj.okParts += lot.ok_parts_produced;
  obj.actual += lot.ok_parts_produced;

  // Calcul du target (optionnel)
  if (lot.lot_size > 0 && durMin > 0) {
    const now = new Date();
    const elapsed = differenceInMinutes(now > et ? et : now, st);
    const ratio = Math.min(elapsed / durMin, 1);
    obj.target += Math.round(ratio * lot.lot_size);
  }
});
// -------------------- Fin du forEach LOTS --------------------



      // 2) Parcourir stops
// ...
// 2) Parcourir les arrêts
// -------------------- LOADDATA - STOPS --------------------
stopsResult.data?.forEach((stop: any) => {
  // Récupère start/end
  const sTime = new Date(stop.start_time);
  let eTime = stop.end_time ? new Date(stop.end_time) : new Date();

  // Borne la fin à endDate si ça dépasse
  if (eTime > endDate) {
    eTime = endDate;
  }

  // Durée
  const durMin = Math.max(0, differenceInMinutes(eTime, sTime));
  const dayStr = format(sTime, 'yyyy-MM-dd');

  // Initialise la case du dateMap si elle n’existe pas
  if (!dateMap.has(dayStr)) {
    dateMap.set(dayStr, {
      date: dayStr,
      plannedTime: 0,
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
  const obj = dateMap.get(dayStr);

  // Convertir en heures
  const hours = durMin / 60;
  const ft = mapFailureType(stop.failure_type);

  // Exemple : si PA => pannes +1
  if (ft === 'PA') {
    globalPannes += 1;
    totalPannesTime += hours;
  }

  // Ajoute durMin aux unplannedStops (ou plannedStops selon la logique)
  obj.unplannedStops += durMin;

  // Ajout à la distribution downtime
  addDowntime(ft, hours);

  // Mise à jour de stopMap (pour le StopTimeChart)
  if (!stopMap.has(dayStr)) {
    stopMap.set(dayStr, { date: dayStr, AP: 0, PA: 0, DO: 0, NQ: 0, CS: 0 });
  }
  const stObj = stopMap.get(dayStr);

  if (ft === 'AP') {
    stObj.AP += hours;
  } else if (ft === 'PA') {
    stObj.PA += hours;
    obj.plannedStops += durMin;  // si c’est un arrêt planifié
  } else if (ft === 'DO') {
    stObj.DO += hours;
  } else if (ft === 'NQ') {
    stObj.NQ += hours;
  } else {
    stObj.CS += hours;
  }
});
// -------------------- Fin du forEach STOPS --------------------

// ...



      // 3) Parcourir quality
      qualityResult.data?.forEach((issue: any) => {
        const dayStr = issue.date;
        if (!dateMap.has(dayStr)) {
          dateMap.set(dayStr, {
            date: dayStr,
            plannedTime: 0,
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
        const obj = dateMap.get(dayStr);
        if (issue.category === 'scrap') {
          obj.scrapParts += issue.quantity;
        } else if (issue.category.includes('rework')) {
          obj.rework += issue.quantity;
        } else {
          obj.other += issue.quantity;
        }
      });

      // 4) Calcul final
      const tmpOEEData: any[] = [];
      const tmpProdData: any[] = [];
      const tmpQualityData: any[] = [];
      const tmpStopTime: any[] = [];
      let dayCount = 0;
      let sumA = 0, sumP = 0, sumQ = 0, sumOEE = 0;
      let globalOk = 0, globalDefects = 0;
      let totalStopHours = 0;

      const allDates = Array.from(dateMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
      allDates.forEach(d => {
        const plannedProdTime = Math.max(0, d.plannedTime - d.plannedStops);
        const runTime = Math.max(0, d.plannedTime - d.unplannedStops);

        let A = 0;
        if (plannedProdTime > 0) {
          A = (runTime / plannedProdTime) * 100;
        }
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
        let Q = 100;
        if (totParts > 0) {
          Q = (d.okParts / totParts) * 100;
        }
        const OEEfrac = (A * P * Q) / 1000000;
        const OEEpct = OEEfrac * 100;

        tmpOEEData.push({
          date: d.date,
          oee: OEEpct,
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
          dayCount++;
          sumA += A;
          sumP += P;
          sumQ += Q;
          sumOEE += OEEpct;
        }
        globalOk += d.okParts;
        globalScrap += d.scrapParts;
        globalRework += d.rework; 
        globalDefects += (d.scrapParts + d.rework + d.other);
      });

      const allStopDates = Array.from(stopMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
      allStopDates.forEach(s => {
        tmpStopTime.push(s);
      });

      tmpDowntime.forEach(d => {
        totalStopHours += d.value;
      });

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

      // Stocker dans le state
      setOeeData(tmpOEEData);
      setProductionData(tmpProdData);
      setQualityData(tmpQualityData);
      setStopTimeData(tmpStopTime);
      setDowntimeData(tmpDowntime);

      setMetrics({
        oee: avgOEE,
        availability: avgA,
        performance: avgP,
        quality: avgQ,
        totalProduction,
        firstPassYield,
        scrapRate,
        totalStopTime: totalStopHours,
        totalScrap: globalScrap,
        totalRework: globalRework,
        totalPannes: globalPannes,
        totalPannesTime: totalPannesTime,
      });

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  }

  // ------------------- Comparaison -------------------
  function handleComparisonSelect(type: string) {
    setComparisonType(type);
    setShowCompareModal(false);
    setShowComparisonSelector(true);
  }

  async function handleComparisonItems(items: string[]) {
    setShowComparisonSelector(false);
    setShowComparison(true);

    if (items.length < 2) return;

    // Charger dataA
    const dataA = await loadComparisonData(items[0]);
    // Charger dataB
    const dataB = await loadComparisonData(items[1]);

    // Fusion OEE
    const mergedOEE = mergeOEEData(dataA.oeeData, dataB.oeeData);
    setOeeDataMerged(mergedOEE);

    // Fusion Production
    const mergedProd = mergeProductionData(dataA.productionData, dataB.productionData);
    setProductionComparisonData(mergedProd);

    // Fusion Quality
    const mergedQual = mergeQualityData(dataA.qualityData, dataB.qualityData);
    setQualityComparisonData(mergedQual);

    // Fusion StopTime
    const mergedStop = mergeStopTimeData(dataA.stopTimeData, dataB.stopTimeData);
    setStopTimeComparisonData(mergedStop);

    // Fusion Downtime (double distribution)
setDowntimeComparisonData(dataB.downtimeData);

    // KPI de comparaison => on prend ceux de dataB (ou une moyenne, à vous de voir)
    setComparisonMetrics(dataB.metrics);
  }

  // Cette fonction charge la data "comparaison" pour un item (machine/line/product/team)
async function loadComparisonData(itemName: string) {
  const { startDate, endDate } = getDateRange();
let globalScrap = 0;
let globalRework = 0;
  let globalPannes = 0
    let totalPannesTime = 0;
  

  // 1) Récupérer les IDs en fonction du type de comparaison
  let finalMachineIDs: string[] = [];
  let productIDs: string[] = [];
  let teamIDs: string[] = [];

  if (comparisonType === 'machines') {
    // Pour une machine, récupération directe
    finalMachineIDs = await getMachineIdsByName([itemName]);
  } else if (comparisonType === 'lines') {
    // Pour une ligne, on récupère l'ID de la ligne puis toutes les machines associées
    const lineIDs = await getLineIdsByName([itemName]);
    console.log(`[Comparison - Lines] Nom: ${itemName}, lineIDs: `, lineIDs);
    if (lineIDs.length > 0) {
      const { data: machines, error } = await supabase
        .from('machines')
        .select('id')
        .eq('project_id', projectId)
        .in('line_id', lineIDs);
      if (error) {
        console.error("Erreur lors de la récupération des machines pour la ligne:", error);
        throw error;
      }
      if (machines) {
        finalMachineIDs = machines.map((m: any) => m.id);
      }
    }
  } else if (comparisonType === 'products') {
    // Pour un produit, récupération directe
    productIDs = await getProductIdsByName([itemName]);
    console.log(`[Comparison - Products] Nom: ${itemName}, productIDs: `, productIDs);
  } else if (comparisonType === 'teams') {
    // Pour une équipe
    teamIDs = await getTeamMemberIdsByTeamName([itemName]);
  }

  // Supprimer les doublons
  finalMachineIDs = Array.from(new Set(finalMachineIDs));
  productIDs = Array.from(new Set(productIDs));
  teamIDs = Array.from(new Set(teamIDs));

  console.log(`[Comparison] Type: ${comparisonType} pour "${itemName}"`);
  console.log("Machine IDs:", finalMachineIDs);
  console.log("Product IDs:", productIDs);
  console.log("Team IDs:", teamIDs);

  // 2) Construire les requêtes sur la période
  let lotsQuery = supabase
    .from('lots')
    .select(`
      id,
      start_time,
      end_time,
      machine,
      product,
      team_member,
      lot_size,
      ok_parts_produced,
      products:product ( cycle_time )
    `)
    .eq('project_id', projectId)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString());

  let stopsQuery = supabase
    .from('stop_events')
    .select(`
      id,
      start_time,
      end_time,
      machine,
      product,
      team_member,
      failure_type
    `)
    .eq('project_id', projectId)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString());

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

  // 3) Appliquer les filtres obtenus (on applique seulement le filtre pertinent)
  if (finalMachineIDs.length > 0) {
    lotsQuery = lotsQuery.in('machine', finalMachineIDs);
    stopsQuery = stopsQuery.in('machine', finalMachineIDs);
    qualityQuery = qualityQuery.in('machine', finalMachineIDs);
  }
  if (productIDs.length > 0) {
    lotsQuery = lotsQuery.in('product', productIDs);
    stopsQuery = stopsQuery.in('product', productIDs);
    qualityQuery = qualityQuery.in('product', productIDs);
  }
  if (teamIDs.length > 0) {
    lotsQuery = lotsQuery.in('team_member', teamIDs);
    stopsQuery = stopsQuery.in('team_member', teamIDs);
    qualityQuery = qualityQuery.in('team_member', teamIDs);
  }

  // 4) Exécuter les requêtes
  const [lotsResult, stopsResult, qualityResult] = await Promise.all([
    lotsQuery,
    stopsQuery,
    qualityQuery
  ]);
  if (lotsResult.error) {
    console.error("Erreur lors du chargement des lots :", lotsResult.error);
    throw lotsResult.error;
  }
  if (stopsResult.error) {
    console.error("Erreur lors du chargement des arrêts :", stopsResult.error);
    throw stopsResult.error;
  }
  if (qualityResult.error) {
    console.error("Erreur lors du chargement des issues qualité :", qualityResult.error);
    throw qualityResult.error;
  }

  console.log(`[Comparison] ${itemName} - Lots: ${lotsResult.data?.length}, Stops: ${stopsResult.data?.length}, Quality: ${qualityResult.data?.length}`);

  // 5) Traitement des données (basé sur loadData)
  const dateMap = new Map<string, any>();
  const stopMap = new Map<string, any>();
  const tmpDowntime: any[] = [];

  function addDowntime(type: string, hours: number) {
    const found = tmpDowntime.find(x => x.name === type);
    if (found) {
      found.value += hours;
    } else {
      tmpDowntime.push({
        name: type,
        value: hours,
        color:
          type === 'AP' ? '#2563eb' :
          type === 'PA' ? '#dc2626' :
          type === 'DO' ? '#eab308' :
          type === 'NQ' ? '#9333ea' :
          '#9ca3af'
      });
    }
  }

  // Traitement des lots
// Dans loadComparisonData(...)
// -------------------- LOADCOMPARISONDATA - LOTS --------------------
lotsResult.data?.forEach((lot: any) => {
  const st = new Date(lot.start_time);
  let et = lot.end_time ? new Date(lot.end_time) : new Date();

  // Borne à endDate
  if (et > endDate) {
    et = endDate;
  }

  // Durée min
  const durMin = Math.max(0, differenceInMinutes(et, st));
  const dayStr = format(st, 'yyyy-MM-dd');

  if (!dateMap.has(dayStr)) {
    dateMap.set(dayStr, {
      date: dayStr,
      plannedTime: 0,
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
  const obj = dateMap.get(dayStr);

  // updated plannedTime
  obj.plannedTime += durMin;

  if (lot.products?.cycle_time && lot.ok_parts_produced > 0) {
    obj.netTimeSec += lot.ok_parts_produced * lot.products.cycle_time;
  }
  obj.okParts += lot.ok_parts_produced;
  obj.actual += lot.ok_parts_produced;

  if (lot.lot_size > 0 && durMin > 0) {
    const now = new Date();
    const elapsed = differenceInMinutes(now > et ? et : now, st);
    const ratio = Math.min(elapsed / durMin, 1);
    obj.target += Math.round(ratio * lot.lot_size);
  }
});
// -------------------- Fin du forEach LOTS (Comparison) --------------------

// ← Fin du forEach lots


  // Traitement des arrêts
// -------------------- LOADCOMPARISONDATA - STOPS --------------------
stopsResult.data?.forEach((stop: any) => {
  const sTime = new Date(stop.start_time);
  let eTime = stop.end_time ? new Date(stop.end_time) : new Date();

  // Borne à endDate
  if (eTime > endDate) {
    eTime = endDate;
  }

  const durMin = Math.max(0, differenceInMinutes(eTime, sTime));
  const dayStr = format(sTime, 'yyyy-MM-dd');

  if (!dateMap.has(dayStr)) {
    dateMap.set(dayStr, {
      date: dayStr,
      plannedTime: 0,
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
  const obj = dateMap.get(dayStr);

  const hours = durMin / 60;
  const ft = mapFailureType(stop.failure_type);

  if (ft === 'PA') {
    globalPannes += 1;
    totalPannesTime += hours;
  }

  obj.unplannedStops += durMin;
  addDowntime(ft, hours);

  if (!stopMap.has(dayStr)) {
    stopMap.set(dayStr, { date: dayStr, AP: 0, PA: 0, DO: 0, NQ: 0, CS: 0 });
  }
  const stObj = stopMap.get(dayStr);

  if (ft === 'AP') {
    stObj.AP += hours;
  } else if (ft === 'PA') {
    stObj.PA += hours;
    obj.plannedStops += durMin;
  } else if (ft === 'DO') {
    stObj.DO += hours;
  } else if (ft === 'NQ') {
    stObj.NQ += hours;
  } else {
    stObj.CS += hours;
  }
});
// -------------------- Fin du forEach STOPS (Comparison) --------------------


  // Traitement des issues qualité
 qualityResult.data?.forEach((issue: any) => {
  const dayStr = issue.date;
  if (!dateMap.has(dayStr)) {
    dateMap.set(dayStr, {
      date: dayStr,
      plannedTime: 0,
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
  const obj = dateMap.get(dayStr);
  if (issue.category === 'scrap') {
    obj.scrapParts += issue.quantity;
    globalScrap += issue.quantity;  // Ajouté pour accumuler le scrap
  } else if (issue.category.includes('rework')) {
    obj.rework += issue.quantity;
    globalRework += issue.quantity; // Ajouté pour accumuler le rework
  } else {
    obj.other += issue.quantity;
  }
});


  // Calcul final des indicateurs
  const tmpOEEData: any[] = [];
  const tmpProdData: any[] = [];
  const tmpQualityData: any[] = [];
  const tmpStopTime: any[] = [];
  let dayCount = 0;
  let sumA = 0, sumP = 0, sumQ = 0, sumOEE = 0;
  let globalOk = 0, globalDefects = 0;
  let totalStopHours = 0;

  const allDates = Array.from(dateMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
  allDates.forEach(d => {
    const plannedProdTime = Math.max(0, d.plannedTime - d.plannedStops);
    const runTime = Math.max(0, d.plannedTime - d.unplannedStops);
    let A = plannedProdTime > 0 ? (runTime / plannedProdTime) * 100 : 0;
    let netSec = d.netTimeSec;
    const totParts = d.okParts + d.scrapParts;
    if (d.okParts > 0 && d.scrapParts > 0) {
      const avgCycle = netSec / d.okParts;
      netSec += avgCycle * d.scrapParts;
    }
    const netMin = netSec / 60;
    let P = runTime > 0 ? (netMin / runTime) * 100 : 0;
    if (P > 100) P = 100;
    let Q = totParts > 0 ? (d.okParts / totParts) * 100 : 100;
    const OEEfrac = (A * P * Q) / 1_000_000;
    const OEEpct = OEEfrac * 100;
    tmpOEEData.push({
      date: d.date,
      oee: OEEpct,
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
      dayCount++;
      sumA += A;
      sumP += P;
      sumQ += Q;
      sumOEE += OEEpct;
    }
    globalOk += d.okParts;
    globalScrap += d.scrapParts;
    globalDefects += (d.scrapParts + d.rework + d.other);
  });

  Array.from(stopMap.values())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach(s => tmpStopTime.push(s));
  tmpDowntime.forEach(d => {
    totalStopHours += d.value;
  });

  const avgA = dayCount > 0 ? sumA / dayCount : 0;
  const avgP = dayCount > 0 ? sumP / dayCount : 0;
  const avgQ = dayCount > 0 ? sumQ / dayCount : 0;
  const avgOEE = dayCount > 0 ? sumOEE / dayCount : 0;
  const totalProduction = globalOk;
  const totalScrap = globalScrap;
  const firstPassYield = totalProduction > 0 ? ((totalProduction - globalDefects) / totalProduction) * 100 : 0;
  const scrapRate = totalProduction > 0 ? (totalScrap / totalProduction) * 100 : 0;

  return {
    oeeData: tmpOEEData,
    productionData: tmpProdData,
    qualityData: tmpQualityData,
    stopTimeData: tmpStopTime,
    downtimeData: tmpDowntime,
    totalScrap: globalScrap,
    totalRework: globalRework,

    metrics: {
      oee: avgOEE,
      availability: avgA,
      performance: avgP,
      quality: avgQ,
      totalProduction,
      firstPassYield,
      totalScrap: globalScrap,
      totalRework: globalRework,  
      totalStopTime: totalStopHours,
      totalPannes: globalPannes,
      totalPannesTime: totalPannesTime,
    }
  };
}





  // ------------------- Export -------------------
  function handleExport() {
    const exportData = {
      oee: oeeData,
      production: productionData,
      quality: qualityData,
      stopTime: stopTimeData,
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
  }

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

  // ------------------- Data "affichée" (avec ou sans comparaison) -------------------
  // Pour OEE : si showComparison et qu'on a des données fusionnées, on les affiche. Sinon, on affiche le set normal.
  const displayedOeeData = showComparison && oeeDataMerged.length > 0
    ? oeeDataMerged
    : oeeData;

  // Production
  const displayedProductionData = showComparison && productionComparisonData.length > 0
    ? productionComparisonData
    : productionData;

  // Quality
  const displayedQualityData = showComparison && qualityComparisonData.length > 0
    ? qualityComparisonData
    : qualityData;

  // StopTime
  const displayedStopTimeData = showComparison && stopTimeComparisonData.length > 0
    ? stopTimeComparisonData
    : stopTimeData;

  // Downtime => si showComparison, downtimeComparisonData est un tableau [distA, distB]
  // On passe data={downtimeData} et comparisonData={downtimeComparisonData} au composant.
  // Le composant gérera un double donut si comparisonData.length === 2
  // Sinon, on fait un simple donut
  const displayedDowntimeData = downtimeData; 
  const displayedDowntimeComparison = downtimeComparisonData; 

  // ------------------- Rendu -------------------
  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
            <p className="mt-1 text-sm text-gray-500">
              Analyze your production performance and identify improvement opportunities
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
            {/* Sélection de période */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium 
                  text-gray-700 bg-white hover:bg-gray-50"
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
                    text-blue-600 bg-blue-50 cursor-default"
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
        ) : !hasData ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Production Data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start recording production data to see analytics and reports.
            </p>
          </div>
        ) : (
          <>
            {/* Grille de 2 colonnes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


              
              
{/* OEE Overview */}
<div className="bg-white shadow rounded-lg p-6">
  {/* Titre + bloc OEE (principal uniquement) */}
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-medium text-gray-900">OEE Overview</h3>
    <div className="flex items-baseline space-x-2">
      <span className="text-3xl font-bold text-blue-600">
        {metrics.oee.toFixed(1)}%
      </span>
      <span className="text-sm text-green-600">↑ 2.3%</span>
    </div>
  </div>

  {/* OEE comparé sur une nouvelle ligne, 3 colonnes : 
      2 premières colonnes vides, 3e pour l'OEE comparé aligné à droite */}
  {showComparison && comparisonMetrics && (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {/* Colonnes 1 et 2 vides */}
      <div />
      <div />
      {/* OEE comparé + flèche dans la même ligne */}
      <div className="text-right opacity-70">
        <div className="flex items-baseline justify-end space-x-2">
          <span className="text-3xl font-bold text-blue-600">
            {comparisonMetrics.oee.toFixed(1)}%
          </span>
          <span className="text-sm text-green-600">↑ 1.5%</span>
        </div>
      </div>
    </div>
  )}

  {/* KPI "normaux" (A, P, Q) */}
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

  {/* KPI comparés (mêmes couleurs, opacité) */}
  {showComparison && comparisonMetrics && (
    <div className="grid grid-cols-3 gap-4 mb-6 border-t pt-4">
      <div className="text-center opacity-70">
        <div className="text-2xl font-semibold text-gray-900">
          {comparisonMetrics.availability.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">Availability</div>
      </div>
      <div className="text-center opacity-70">
        <div className="text-2xl font-semibold text-gray-900">
          {comparisonMetrics.performance.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">Performance</div>
      </div>
      <div className="text-center opacity-70">
        <div className="text-2xl font-semibold text-gray-900">
          {comparisonMetrics.quality.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">Quality</div>
      </div>
    </div>
  )}

  {/* Ton composant OEEChart */}
  <OEEChart
    data={displayedOeeData}
    showComparison={showComparison}
  />
</div>



{/* Production Trends */}
<div className="bg-white shadow rounded-lg p-6">
  {/* Titre + Production principale */}
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-medium text-gray-900">Production Trends</h3>
    <div className="flex items-baseline space-x-2">
      <span className="text-3xl font-bold text-gray-900">
        {(metrics.totalProduction ?? 0).toLocaleString()}
      </span>
      <span className="text-sm text-green-600">↑ 5.7%</span>
    </div>
  </div>

  {/* Production comparée sur une nouvelle ligne, dans une grille à 2 colonnes */}
  {showComparison && comparisonMetrics && (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* Première colonne vide pour conserver l'alignement */}
      <div />
      <div className="text-right opacity-50">
        <div className="flex items-baseline justify-end space-x-2">
          <span className="text-3xl font-bold text-gray-900">
            {(comparisonMetrics.totalProduction ?? 0).toLocaleString()}
          </span>
          <span className="text-sm text-green-600">↑ 2.2%</span>
        </div>
      </div>
    </div>
  )}

  {/* KPI normaux (First Pass Yield, Scrap Rate) */}
  <div className="grid grid-cols-2 gap-4 mb-6">
    <div className="text-center">
      <div className="text-2xl font-semibold text-gray-900">
        {(metrics.firstPassYield ?? 0).toFixed(1)}%
      </div>
      <div className="text-sm text-gray-500">First Pass Yield</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-semibold text-gray-900">
        {(metrics.scrapRate ?? 0).toFixed(1)}%
      </div>
      <div className="text-sm text-gray-500">Scrap Rate</div>
    </div>
  </div>

  {/* KPI comparés (First Pass Yield, Scrap Rate) */}
  {showComparison && comparisonMetrics && (
    <div className="grid grid-cols-2 gap-4 mb-6 border-t pt-4">
      <div className="text-center opacity-50">
        <div className="text-2xl font-semibold text-gray-900">
          {(comparisonMetrics.firstPassYield ?? 0).toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">First Pass Yield</div>
      </div>
      <div className="text-center opacity-50">
        <div className="text-2xl font-semibold text-gray-900">
          {(comparisonMetrics.scrapRate ?? 0).toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">Scrap Rate</div>
      </div>
    </div>
  )}

  {/* ProductionChart */}
  <ProductionChart
    data={displayedProductionData}
    showComparison={showComparison}
  />
</div>




           {/* Downtime Analysis */}
<div className="bg-white shadow rounded-lg p-6">
  {/* Titre + StopTime principal */}
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-medium text-gray-900">Downtime Analysis</h3>
    <div className="flex items-baseline space-x-2">
      <span className="text-2xl font-bold text-gray-900">
        {metrics.totalStopTime.toFixed(1)}h
      </span>
      <span className="text-sm text-red-600">Stop Time</span>
    </div>
  </div>

  {/* StopTime comparé sur une nouvelle ligne, 2 colonnes (première vide, deuxième alignée à droite) */}
  {showComparison && comparisonMetrics && (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* Colonne vide pour “pousser” le comparé à droite */}
      <div />
      <div className="text-right opacity-50">
        <div className="flex items-baseline justify-end space-x-2">
          <span className="text-2xl font-bold text-gray-900">
            {comparisonMetrics.totalStopTime.toFixed(1)}h
          </span>
          <span className="text-sm text-red-600">Stop Time</span>
        </div>
      </div>
    </div>
  )}

  {/* DowntimeChart : data=displayedDowntimeData, comparisonData=displayedDowntimeComparison */}
  <DowntimeChart
    data={displayedDowntimeData}
    showComparison={showComparison}
    comparisonData={displayedDowntimeComparison}
  />
</div>


              
{/* Quality Issues */}
<div className="bg-white shadow rounded-lg p-6">
  <h3 className="text-lg font-medium text-gray-900 mb-4">Quality Issues</h3>

  {/* 1) KPI principaux (Scrap, Rework) sur la première grille */}
  <div className="grid grid-cols-2 gap-4 mb-6">
    <div className="text-center">
      <div className="text-3xl font-bold text-gray-900">
        {(metrics.totalScrap ?? 0).toLocaleString()}
      </div>
      <div className="text-sm text-red-600">Scrap</div>
    </div>
    <div className="text-center">
      <div className="text-3xl font-bold text-gray-900">
        {(metrics.totalRework ?? 0).toLocaleString()}
      </div>
      <div className="text-sm text-red-600">Rework</div>
    </div>
  </div>

  {/* 2) KPI comparés (Scrap, Rework) sur la deuxième grille */}
  {showComparison && comparisonMetrics && (
    <div className="grid grid-cols-2 gap-4 mb-6 border-t pt-4">
      <div className="text-center opacity-70">
        <div className="text-3xl font-bold text-gray-900">
          {(comparisonMetrics.totalScrap ?? 0).toLocaleString()}
        </div>
        <div className="text-sm text-red-600">Scrap</div>
      </div>
      <div className="text-center opacity-70">
        <div className="text-3xl font-bold text-gray-900">
          {(comparisonMetrics.totalRework ?? 0).toLocaleString()}
        </div>
        <div className="text-sm text-red-600">Rework</div>
      </div>
    </div>
  )}

  {/* QualityChart */}
  <QualityChart
    data={displayedQualityData}
    showComparison={showComparison}
  />
</div>

              </div>



              
      
{/* Stop Time Trend */}
<div className="bg-white shadow rounded-lg p-6 mt-6">
  <h3 className="text-lg font-medium text-gray-900 mb-4">Stop Time Trend</h3>

  {/* 1) KPI principaux (Downtime for Breakdowns, Breakdown Frequency) */}
  <div className="grid grid-cols-2 gap-4 mb-6">
    <div className="text-center">
      <div className="text-3xl font-bold text-gray-900">
        {(metrics.totalPannesTime ?? 0).toFixed(1)}h
      </div>
      <div className="text-sm text-red-600">Downtime (Breakdowns)</div>
    </div>
    <div className="text-center">
      <div className="text-3xl font-bold text-gray-900">
        {metrics.totalPannes ?? 0}
      </div>
      <div className="text-sm text-red-600">Breakdown Frequency</div>
    </div>
  </div>

  {/* 2) KPI comparés (Downtime, Frequency) sur la deuxième grille */}
  {showComparison && comparisonMetrics && (
    <div className="grid grid-cols-2 gap-4 mb-6 border-t pt-4">
      <div className="text-center opacity-70">
        <div className="text-3xl font-bold text-gray-900">
          {(comparisonMetrics.totalPannesTime ?? 0).toFixed(1)}h
        </div>
        <div className="text-sm text-red-600">Downtime (Breakdowns)</div>
      </div>
      <div className="text-center opacity-70">
        <div className="text-3xl font-bold text-gray-900">
          {comparisonMetrics.totalPannes ?? 0}
        </div>
        <div className="text-sm text-red-600">Breakdown Frequency</div>
      </div>
    </div>
  )}

  {/* StopTimeChart */}
  <StopTimeChart
    data={stopTimeData}
    comparisonData={stopTimeComparisonData} // On passe bien la data comparée
    showComparison={showComparison}
    comparisonLabel="Previous Period"
  />
</div>


          </>
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
      },
      {
        id: 'qualityCausesTracking',
        title: 'Quality Causes Tracking',
        description: 'Detailed analysis of quality causes and tracking',
        path: 'qualitytracking',
        icon: AlertTriangle // Remplacez par un autre icône si nécessaire
      },
      {
        id: 'stopesCausesTracking',
        title: 'Stops Causes Tracking',
        description: 'Detailed analysis of stops causes and tracking',
        path: 'stopstracking',
        icon: Clock // Remplacez par un autre icône si nécessaire
      },
      {
        id: 'qualityPareto',
        title: 'Quality Pareto',
        description: 'Detailed analysis of quality pareto',
        path: 'qualitypareto',
        icon: AlertTriangle // Remplacez par un autre icône si nécessaire
      },
      {
        id: 'stopspareto',
        title: 'Stops Pareto',
        description: 'Detailed analysis of stops pareto',
        path: 'stopspareto',
        icon: Clock // Remplacez par un autre icône si nécessaire
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


        {/* Modals */}
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
