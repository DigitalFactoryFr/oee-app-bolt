import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  subDays,
  startOfToday,
  startOfYesterday,
  differenceInMinutes
} from 'date-fns';
import {
  Calendar,
  ChevronDown,
  Filter,
  Download,
  Search,
  ArrowUp,
  ArrowDown,
  Activity
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import FilterPanel from '../../../components/reports/FilterPanel';
import OEEChart from '../../../components/charts/OEEChart';

// -------------------- Types --------------------
interface OEEData {
  date: string;
  oee: number;           // 0..100
  availability: number;  // 0..100
  performance: number;   // 0..100
  quality: number;       // 0..100
}

interface MachineOEEMetrics {
  machineId: string;
  machineName: string;
  oee: number;           // 0..100
  availability: number;  // 0..100
  performance: number;   // 0..100
  quality: number;       // 0..100
  trend: number;         // Différence (points de %) entre le dernier jour et l'avant-dernier
  historicalData: OEEData[];
  hasData: boolean;
}

interface FilterOptions {
  machines: string[];
  lines: string[];
  products: string[];
  teams: string[];
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'quarter';

const OEEReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // --- Période ---
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // --- Filtres ---
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

  // --- Recherche machine ---
  const [machineSearch, setMachineSearch] = useState('');

  // --- Données ---
  const [machineMetrics, setMachineMetrics] = useState<MachineOEEMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  // -----------------------------------------------------------
  // Helpers pour récupérer IDs depuis des noms
  // -----------------------------------------------------------
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

  // -----------------------------------------------------------
  // Calculer la plage de dates
  // -----------------------------------------------------------
  function getDateRange(period: PeriodType) {
    const now = new Date();
    switch (period) {
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

  // -----------------------------------------------------------
  // Charger les options de filtre
  // -----------------------------------------------------------
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

  // -----------------------------------------------------------
  // Charger les données OEE
  // -----------------------------------------------------------
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
        setMachineMetrics([]);
        setLoading(false);
        return;
      }
      setHasData(true);

      // Charger la liste de machines filtrée
      let machineQuery = supabase
        .from('machines')
        .select('id, name, opening_time_minutes')
        .eq('project_id', projectId);

      // Filtre par lignes
      if (selectedFilters.lines.length > 0) {
        const lineIDs = await getLineIdsByName(selectedFilters.lines);
        if (lineIDs.length > 0) {
          machineQuery = machineQuery.in('line_id', lineIDs);
        }
      }
      // Filtre par machines
      if (selectedFilters.machines.length > 0) {
        const machineIDs = await getMachineIdsByName(selectedFilters.machines);
        if (machineIDs.length > 0) {
          machineQuery = machineQuery.in('id', machineIDs);
        }
      }

      const { data: machines, error: machineError } = await machineQuery;
      if (machineError) throw machineError;
      if (!machines || machines.length === 0) {
        setHasData(false);
        setMachineMetrics([]);
        setLoading(false);
        return;
      }

      // Plage de dates
      const { startDate, endDate } = getDateRange(selectedPeriod);

      // Filtre sur produits / équipes
      const productIDs = selectedFilters.products.length
        ? await getProductIdsByName(selectedFilters.products)
        : [];
      const teamIDs = selectedFilters.teams.length
        ? await getTeamMemberIdsByTeamName(selectedFilters.teams)
        : [];

      const metricsArray: MachineOEEMetrics[] = [];

      // Boucle sur chaque machine
      for (const machine of machines) {
        let lotsQuery = supabase
          .from('lots')
          .select(`
            id,
            start_time,
            end_time,
            lot_size,
            ok_parts_produced,
            date,
            products:product ( cycle_time )
          `)
          .eq('project_id', projectId)
          .eq('machine', machine.id)
          .gte('start_time', startDate.toISOString())
          .lte('start_time', endDate.toISOString());

        let stopsQuery = supabase
          .from('stop_events')
          .select(`
            id,
            start_time,
            end_time,
            failure_type,
            date
          `)
          .eq('project_id', projectId)
          .eq('machine', machine.id)
          .gte('start_time', startDate.toISOString())
          .lte('start_time', endDate.toISOString());

        let qualityQuery = supabase
          .from('quality_issues')
          .select(`
            id,
            date,
            category,
            quantity
          `)
          .eq('project_id', projectId)
          .eq('machine', machine.id)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'));

        // Filtres sur produits
        if (productIDs.length > 0) {
          lotsQuery = lotsQuery.in('product', productIDs);
          stopsQuery = stopsQuery.in('product', productIDs);
          qualityQuery = qualityQuery.in('product', productIDs);
        }
        // Filtres sur équipes
        if (teamIDs.length > 0) {
          lotsQuery = lotsQuery.in('team_member', teamIDs);
          stopsQuery = stopsQuery.in('team_member', teamIDs);
          qualityQuery = qualityQuery.in('team_member', teamIDs);
        }

        // Exécution en parallèle
        const [lotsResult, stopsResult, qualityResult] = await Promise.all([
          lotsQuery,
          stopsQuery,
          qualityQuery
        ]);
        if (lotsResult.error) throw lotsResult.error;
        if (stopsResult.error) throw stopsResult.error;
        if (qualityResult.error) throw qualityResult.error;

        // dateMap
        const dateMap = new Map<string, {
          date: string;
          plannedTime: number;
          plannedStops: number;
          unplannedStops: number;
          okParts: number;
          scrapParts: number;
          netTimeSec: number;
        }>();

        // 1) Parcourir les lots
lotsResult.data?.forEach((lot: any) => {
  const dayStr = lot.date || format(new Date(lot.start_time), 'yyyy-MM-dd');
  if (!dateMap.has(dayStr)) {
    dateMap.set(dayStr, {
      date: dayStr,
      plannedTime: 0,
      plannedStops: 0,
      unplannedStops: 0,
      okParts: 0,
      scrapParts: 0,
      netTimeSec: 0
    });
  }
  const obj = dateMap.get(dayStr)!;

  // Récupérer la plage
  // On a déjà { startDate, endDate } en dehors de ce forEach
  // => const { startDate, endDate } = getDateRange(selectedPeriod);

  // Récupère startTime/endTime du lot
  let st = new Date(lot.start_time);
  let et = lot.end_time ? new Date(lot.end_time) : new Date();

  // -------------------- AJOUT : BORNER LES DATES --------------------
  // 1) Si le lot a commencé avant la plage, on borne à startDate
  if (st < startDate) {
    st = startDate;
  }
  // 2) Si le lot se termine après la plage (ou pas fini), on borne à endDate
  if (et > endDate) {
    et = endDate;
  }
  // ---------------------------------------------------------------

  // Durée planifiée (en minutes)
  const durMin = Math.max(0, differenceInMinutes(et, st));
  obj.plannedTime += durMin;

  // Calcul du temps net théorique
  if (lot.products?.cycle_time && lot.ok_parts_produced > 0) {
    obj.netTimeSec += lot.ok_parts_produced * lot.products.cycle_time;
  }

  // Pièces OK
  obj.okParts += lot.ok_parts_produced;
}); // Fin du forEach lots


        // 2) Parcourir les arrêts
stopsResult.data?.forEach((stop: any) => {
  const dayStr = stop.date || format(new Date(stop.start_time), 'yyyy-MM-dd');
  if (!dateMap.has(dayStr)) {
    dateMap.set(dayStr, {
      date: dayStr,
      plannedTime: 0,
      plannedStops: 0,
      unplannedStops: 0,
      okParts: 0,
      scrapParts: 0,
      netTimeSec: 0
    });
  }
  const obj = dateMap.get(dayStr)!;

  // Start/end
  let sTime = new Date(stop.start_time);
  let eTime = stop.end_time ? new Date(stop.end_time) : new Date();

  // -------------------- AJOUT : BORNER LES DATES --------------------
  // S’il commence avant startDate
  if (sTime < startDate) {
    sTime = startDate;
  }
  // S’il finit après endDate ou n’est pas terminé
  if (eTime > endDate) {
    eTime = endDate;
  }
  // ---------------------------------------------------------------

  // Durée
  const durMin = Math.max(0, differenceInMinutes(eTime, sTime));

  // Arrêt planifié => PA
  if (stop.failure_type === 'PA') {
    obj.plannedStops += durMin;
  }
  // Sinon unplanned
  obj.unplannedStops += durMin;
}); // Fin du forEach stops


        // 3) Parcourir la qualité (scrap)
        qualityResult.data?.forEach((issue: any) => {
          const dayStr = issue.date;
          if (!dateMap.has(dayStr)) {
            dateMap.set(dayStr, {
              date: dayStr,
              plannedTime: 0,
              plannedStops: 0,
              unplannedStops: 0,
              okParts: 0,
              scrapParts: 0,
              netTimeSec: 0
            });
          }
          const obj = dateMap.get(dayStr)!;
          if (issue.category === 'scrap') {
            obj.scrapParts += issue.quantity;
          }
        });

        // 4) Calculer A, P, Q, OEE par jour
        const historicalData: OEEData[] = [];
        let sumA = 0, sumP = 0, sumQ = 0, sumOEE = 0;
        let dayCount = 0;

        Array.from(dateMap.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .forEach(d => {
            const plannedProdTime = Math.max(0, d.plannedTime - d.plannedStops);
            const runTime = Math.max(0, d.plannedTime - d.unplannedStops);

            // Availability
            let A = 0;
            if (plannedProdTime > 0) {
              A = (runTime / plannedProdTime) * 100;
            }

            // Performance
            let netMin = d.netTimeSec / 60; // temps théorique
            let P = 0;
            if (runTime > 0) {
              P = (netMin / runTime) * 100;
              if (P > 100) P = 100;
            }

            // Quality
            const totParts = d.okParts + d.scrapParts;
            let Q = totParts > 0 ? (d.okParts / totParts) * 100 : 100;

            // OEE = (A * P * Q) / 10,000 => [0..100]
            const dailyOEE = (A * P * Q) / 10000;

            if (totParts > 0) {
              dayCount++;
              sumA += A;
              sumP += P;
              sumQ += Q;
              sumOEE += dailyOEE;
            }

            historicalData.push({
              date: d.date,
              availability: A,
              performance: P,
              quality: Q,
              oee: dailyOEE // 0..100
            });
          });

        // Moyennes
        let avgA = 0, avgP = 0, avgQ = 0, avgOEE = 0;
        if (dayCount > 0) {
          avgA = sumA / dayCount;       // 0..100
          avgP = sumP / dayCount;       // 0..100
          avgQ = sumQ / dayCount;       // 0..100
          avgOEE = sumOEE / dayCount;   // 0..100
        }

        // Tendance
        historicalData.sort((a, b) => a.date.localeCompare(b.date));
        const lastDay = historicalData[historicalData.length - 1]?.oee || 0;
        const prevDay = historicalData[historicalData.length - 2]?.oee || 0;
        const trend = lastDay - prevDay; // en points de %

        metricsArray.push({
          machineId: machine.id,
          machineName: machine.name,
          oee: avgOEE,           // 0..100
          availability: avgA,    // 0..100
          performance: avgP,     // 0..100
          quality: avgQ,         // 0..100
          trend: trend,
          historicalData,
          hasData: dayCount > 0
        });
      }

      setMachineMetrics(metricsArray);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  }

  // -----------------------------------------------------------
  // Filtrage local (champ de recherche machine)
  // -----------------------------------------------------------
  const filteredMachines = machineMetrics.filter(m =>
    m.machineName.toLowerCase().includes(machineSearch.toLowerCase())
  );

  // -----------------------------------------------------------
  // Gestion des filtres
  // -----------------------------------------------------------
  const handleFilterChange = (category: string, values: string[]) => {
    setSelectedFilters(prev => ({ ...prev, [category]: values }));
  };
  const handleClearFilters = () => {
    setSelectedFilters({ machines: [], lines: [], products: [], teams: [] });
  };

  // -----------------------------------------------------------
  // Export JSON (optionnel)
  // -----------------------------------------------------------
  function handleExport() {
    const exportData = {
      machineMetrics
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oee_report_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // -----------------------------------------------------------
  // useEffect : charger filtres + data
  // -----------------------------------------------------------
  useEffect(() => {
    if (projectId) {
      loadFilterOptions();
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedPeriod, selectedFilters]);

  // -----------------------------------------------------------
  // Rendu principal
  // -----------------------------------------------------------
  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">OEE Report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Detailed analysis of Overall Equipment Effectiveness by machine
            </p>
          </div>

          {/* Boutons Période / Filtres / Export */}
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
            {/* Sélecteur de période */}
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
                // Z-50 pour que le dropdown soit devant le chart
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
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

            {/* Bouton Filtres */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className="inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium
                border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>

            {/* Bouton Export */}
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium
                text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Panneau de filtres */}
        {showFilterPanel && (
          <FilterPanel
            isVisible={showFilterPanel}
            onClose={() => setShowFilterPanel(false)}
            options={filterOptions}
            selectedFilters={selectedFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        )}

        {/* Champ de recherche machine */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <input
              type="text"
              placeholder="Search machine..."
              value={machineSearch}
              onChange={(e) => setMachineSearch(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400">
              <Search className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        {loading ? (
          <div className="flex justify-center items-center h-24">
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
              Start recording production data to see OEE metrics and analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredMachines.map((m) => (
              <div
                key={m.machineId}
                className="bg-white shadow-sm rounded-lg p-6 mb-8 h-64 relative"
              >
                {/* Layout sur toute la hauteur */}
                <div className="flex flex-col md:flex-row items-start h-full">
                  
                  {/* Colonne gauche : Nom + KPIs */}
                  <div className="md:w-1/2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">
                        {m.machineName}
                      </h3>
                      {/* Tendance */}
                      {m.trend !== 0 && (
                        <div className={`flex items-center ${
                          m.trend > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {m.trend > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                          <span className="ml-1 text-sm">
                            {m.trend.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {m.hasData ? (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        {/* OEE en bleu */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {m.oee.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-500">OEE</div>
                        </div>

                        {/* Availability en noir */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {m.availability.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-500">Availability</div>
                        </div>

                        {/* Performance en noir */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {m.performance.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-500">Performance</div>
                        </div>

                        {/* Quality en noir */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {m.quality.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-500">Quality</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm mt-4">
                        No data for this machine in the selected period.
                      </p>
                    )}
                  </div>

                  {/* Colonne droite : Chart */}
                  {/* z-0 pour ne pas recouvrir le dropdown, overflow-visible si besoin */}
                  <div className="md:w-1/2 mt-6 md:mt-0 md:pl-6 h-full relative z-0">
                    {m.hasData && m.historicalData.length > 0 && (
                      <div className="w-full h-full overflow-hidden">
                        <OEEChart data={m.historicalData} showComparison={false} />
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default OEEReport;
