// ============================================================================
// PredictiveInsights.tsx
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  subDays,
  differenceInMinutes,
  differenceInDays,
  addDays,
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear
} from 'date-fns';
import {
  Calendar,
  Download,
  ChevronDown,
  AlertTriangle,
  Clock,
  PenTool as Tool,
  Settings,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// --------------------- Tooltip Component ---------------------
// Simple composant pour afficher un tooltip au survol
const Tooltip: React.FC<{ content: string; className?: string }> = ({
  content,
  className = '',
  children
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-xs rounded py-1 px-2 z-50 w-64 text-center">
          {content}
        </div>
      )}
    </div>
  );
};

// --------------------- Utility Functions ---------------------

function calculateWeibullFromTimestamps(timestamps: Date[]): { shape: number; scale: number } {
  if (timestamps.length < 2) return { shape: 1, scale: 0 };
  const sorted = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
  const intervals = sorted.slice(1).map(
    (t, i) => (t.getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24)
  );
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const shape = stdDev > 0 ? mean / stdDev : 1;
  return { shape, scale: mean };
}

function weibullMedian(shape: number, scale: number): number {
  return scale * Math.pow(Math.log(2), 1 / shape);
}

// --------------------- Types & Interfaces ---------------------

type TimeRangeType = '7d' | '30d' | '90d';
type CategoryFilterType = 'ALL' | 'PA' | 'NQ' | 'CS' | 'DO' | 'SCRAP' | 'REWORK';
type ExpectedDateFilter =
  | 'ALL'
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'NEXT_MONTH'
  | 'NEXT_6_MONTHS'
  | 'THIS_YEAR';

interface FailureCause {
  type: string;
  causeText: string;
  occurrences: number;
  totalDurationH: number;
  scrapCount: number;
  reworkCount: number;
  lastOccurrence: string;
  avgDuration: number;
  stdDeviation: number;
  variabilityIndex: number;
  occurrencePerWeek: number;
  severityValue: number;
  predictedRiskScore: number;
  certainty: string;
  expectedDate: string;
  weibullParams: { shape: number; scale: number };
}

interface MachineHealth {
  id: string;
  name: string;
  opening_time_minutes: number;
  totalDowntimeH: number;
  mtbf: number;
  mttr: number;
  recentStops: number;
  totalScrap: number;
  totalRework: number;
  predictedRisk: number;
  causeList: FailureCause[];
  sampleSize: { totalLots: number; totalOkParts: number };
  nextFailureGlobal: string;
}

// --------------------- Constants & Parameters ---------------------

const TAU_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Risk factors for Scrap/Rework (modifiable via popup)
const INITIAL_RISK_FACTOR_SCRAP = 7.5; // exemple: 1–15
const INITIAL_RISK_FACTOR_REWORK = 2.5; // exemple: 1–5

// --------------------- Icons & Colors ---------------------

const FAILURE_TYPES = [
  { type: 'AP', name: 'Planned Downtime', icon: Clock, color: '#2563eb' },
  { type: 'PA', name: 'Equipment Breakdown', icon: Tool, color: '#dc2626' },
  { type: 'DO', name: 'Organized Malfunction', icon: AlertTriangle, color: '#eab308' },
  { type: 'NQ', name: 'Non-quality Issue', icon: Settings, color: '#9333ea' },
  { type: 'CS', name: 'Series Change', icon: RefreshCw, color: '#16a34a' },
  { type: 'SCRAP', name: 'Scrap', icon: AlertTriangle, color: '#f43f5e' },
  { type: 'REWORK', name: 'Rework', icon: AlertTriangle, color: '#d946ef' }
];

function getCategoryIcon(type: string) {
  const found = FAILURE_TYPES.find(ft => ft.type === type);
  if (found) {
    return <found.icon className="h-5 w-5" style={{ color: found.color }} />;
  }
  return <AlertTriangle className="h-5 w-5 text-gray-400" />;
}

// --------------------- Risk / Formatting Functions ---------------------

function getRiskColor(score: number): string {
  if (score >= 100) {
    return 'bg-red-100 text-red-800';
  } else if (score >= 50) {
    return 'bg-orange-100 text-orange-800';
  } else if (score >= 25) {
    return 'bg-yellow-100 text-yellow-800';
  } else if (score >= 10) {
    return 'bg-blue-100 text-blue-800';
  } else if (score >= 2.5) {
    return 'bg-teal-100 text-teal-800';
  } else {
    return 'bg-green-100 text-green-800';
  }
}

function classifyRisk(score: number): string {
  if (score >= 100) return 'Critical';
  if (score >= 50) return 'Severe';
  if (score >= 25) return 'High';
  if (score >= 10) return 'Moderate';
  if (score >= 2.5) return 'Minor';
  return 'Low';
}

function formatDuration(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
}

// --------------------- Date Range Helpers ---------------------

function getDateRange(range: TimeRangeType) {
  const now = new Date();
  switch (range) {
    case '7d':
      return { start: subDays(now, 7), end: now, days: 7 };
    case '90d':
      return { start: subDays(now, 90), end: now, days: 90 };
    default:
      return { start: subDays(now, 30), end: now, days: 30 };
  }
}

function getExpectedDateRange(edf: ExpectedDateFilter) {
  const now = new Date();
  switch (edf) {
    case 'TODAY':
      return { start: startOfToday(), end: endOfToday() };
    case 'THIS_WEEK':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'THIS_MONTH':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'NEXT_MONTH': {
      const sNext = addDays(endOfMonth(now), 1);
      return { start: sNext, end: endOfMonth(sNext) };
    }
    case 'NEXT_6_MONTHS':
      return { start: now, end: addDays(now, 180) };
    case 'THIS_YEAR':
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return null;
  }
}

// --------------------- Mappers for Types ---------------------

function mapStopFailureType(ft: string | null | undefined) {
  const s = (ft || '').toLowerCase();
  switch (s) {
    case 'pa':
    case 'nq':
    case 'cs':
    case 'do':
      return s.toUpperCase();
    default:
      return 'CS';
  }
}

function mapQualityCategory(cat: string | null | undefined) {
  const s = (cat || '').toLowerCase();
  if (s.includes('scrap')) return 'SCRAP';
  if (s.includes('rework')) return 'REWORK';
  return 'NQ';
}

// --------------------- CauseCard Component ---------------------

interface CauseCardProps {
  cause: FailureCause;
}

const CauseCard: React.FC<CauseCardProps> = ({ cause }) => {
  const riskBadgeClass = getRiskColor(cause.predictedRiskScore);
  const causeRiskClass = classifyRisk(cause.predictedRiskScore);

  // Texte pour le tooltip sur Weibull
  const weibullTooltipText = `
Weibull Distribution:
- Shape > 1: Failure rate increases over time
- Shape < 1: Failure rate decreases over time
- Shape = 1: Failure rate is constant (exponential)

- Scale: Represents the average interval (in days) between failures. 
  The median is scale × (ln2)^(1/shape).

These parameters help predict the next failure based on historical intervals.
  `;

  return (
    <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-100 hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-full bg-gray-50 flex items-center justify-center">
            {getCategoryIcon(cause.type)}
          </div>
          <div>
            <h4 className="text-base font-semibold text-gray-800">{cause.causeText}</h4>
            <p className="text-xs text-gray-500">Type: {cause.type}</p>
          </div>
        </div>
        <div
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${riskBadgeClass}`}
        >
          Risk: {cause.predictedRiskScore.toFixed(2)} ({causeRiskClass})
        </div>
      </div>
      {/* Historical Analysis & Prediction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* Historical Analysis */}
        <div className="bg-gray-50 p-3 rounded-md">
          <h5 className="font-medium text-gray-900 mb-2 text-sm">Historical Analysis</h5>
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Occurrences</span>
              <span className="font-semibold text-gray-800">{cause.occurrences}</span>
            </div>
            {cause.type !== 'SCRAP' && cause.type !== 'REWORK' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Average Duration (hrs)</span>
                  <span className="font-semibold text-gray-800">
                    {cause.avgDuration.toFixed(2)}h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration Variation (hrs)</span>
                  <span className="font-semibold text-gray-800">
                    {cause.stdDeviation.toFixed(2)}h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Occurrence</span>
                  <span className="font-semibold text-gray-800">{cause.lastOccurrence}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Average Affected Pieces</span>
                  <span className="font-semibold text-gray-800">
                    {cause.avgDuration.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Variation (Pieces)</span>
                  <span className="font-semibold text-gray-800">
                    {cause.stdDeviation.toFixed(2)}
                  </span>
                </div>
                {cause.type === 'SCRAP' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Scrapped</span>
                    <span className="font-semibold text-gray-800">{cause.scrapCount}</span>
                  </div>
                )}
                {cause.type === 'REWORK' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Reworked</span>
                    <span className="font-semibold text-gray-800">{cause.reworkCount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Occurrence</span>
                  <span className="font-semibold text-gray-800">{cause.lastOccurrence}</span>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Prediction */}
        <div className="bg-gray-50 p-3 rounded-md">
          <h5 className="font-medium text-gray-900 mb-2 text-sm">Prediction</h5>
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Predicted Occurrences/Week</span>
              <span className="font-semibold text-gray-800">
                {cause.occurrencePerWeek.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">
                {cause.type === 'SCRAP' || cause.type === 'REWORK'
                  ? 'Affected Parts (est.)'
                  : 'Severity (Time Impact)'}
              </span>
              <span className="font-semibold text-gray-800">
                {cause.severityValue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Confidence</span>
              <span className="font-semibold text-gray-800">{cause.certainty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Next Expected Occurrence</span>
              <span className="font-semibold text-gray-800">{cause.expectedDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center">
                Weibull Parameters
                <Tooltip content={weibullTooltipText} className="ml-1">
                  <HelpCircle className="h-4 w-4 text-blue-500 cursor-pointer" />
                </Tooltip>
              </span>
              <span className="font-semibold text-gray-800">
                shape: {cause.weibullParams.shape.toFixed(2)}, scale: {cause.weibullParams.scale.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------------------- RiskParametersModal Component ---------------------

interface RiskParametersModalProps {
  riskFactorScrap: number;
  riskFactorRework: number;
  setRiskFactorScrap: (value: number) => void;
  setRiskFactorRework: (value: number) => void;
  onClose: () => void;
}

const RiskParametersModal: React.FC<RiskParametersModalProps> = ({
  riskFactorScrap,
  riskFactorRework,
  setRiskFactorScrap,
  setRiskFactorRework,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="bg-white rounded-lg shadow-lg z-40 w-80 p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Parameters</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700">Scrap Risk Factor</label>
            <input
              type="number"
              min={1}
              max={15}
              step={0.1}
              value={riskFactorScrap}
              onChange={(e) => setRiskFactorScrap(parseFloat(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              title="Risk factor for Scrap (1–15)."
            />
            <p className="text-xs text-gray-500 mt-1">
              Determines the impact of the scrap rate on the overall risk score.
              Typical values range between 1 and 15.
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-700">Rework Risk Factor</label>
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              value={riskFactorRework}
              onChange={(e) => setRiskFactorRework(parseFloat(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              title="Risk factor for Rework (1–5)."
            />
            <p className="text-xs text-gray-500 mt-1">
              Adjusts the influence of rework events in the risk score calculation.
              Typical values range between 1 and 5.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --------------------- Main Component: PredictiveInsights ---------------------

const PredictiveInsights: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Filter states
  const [timeRange, setTimeRange] = useState<TimeRangeType>('30d');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('ALL');
  const [expectedDateFilter, setExpectedDateFilter] = useState<ExpectedDateFilter>('ALL');
  const [machineSearch, setMachineSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machineList, setMachineList] = useState<MachineHealth[]>([]);

  // Pagination state for machines
  const [machinePage, setMachinePage] = useState<number>(1);

  // State for limitation of causes displayed per machine.
  // Options: Top 3, 5, 10 or ALL
  const [causeLimit, setCauseLimit] = useState<number | 'ALL'>(3);

  // Risk factors for Scrap/Rework
  const [riskFactorScrap, setRiskFactorScrap] = useState<number>(INITIAL_RISK_FACTOR_SCRAP);
  const [riskFactorRework, setRiskFactorRework] = useState<number>(INITIAL_RISK_FACTOR_REWORK);

  // State for showing the Risk Parameters modal
  const [showRiskModal, setShowRiskModal] = useState<boolean>(false);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
    // Réinitialiser la pagination à chaque changement de filtre
    setMachinePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectId,
    timeRange,
    categoryFilter,
    expectedDateFilter,
    machineSearch,
    riskFactorScrap,
    riskFactorRework
  ]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const { start, end, days } = getDateRange(timeRange);

      // 1) Fetch Machines
      let machQ = supabase
        .from('machines')
        .select('id, name, opening_time_minutes')
        .eq('project_id', projectId);
      if (machineSearch) {
        machQ = machQ.ilike('name', `%${machineSearch}%`);
      }
      const { data: machData, error: machErr } = await machQ;
      if (machErr) throw machErr;
      if (!machData || machData.length === 0) {
        setMachineList([]);
        setLoading(false);
        return;
      }

      // 2) Fetch Products (for cycle_time)
      const { data: productsData, error: prodErr } = await supabase
        .from('products')
        .select('id, cycle_time');
      if (prodErr) throw prodErr;
      const productCycleMap = new Map<string, number>();
      productsData?.forEach(prod => {
        productCycleMap.set(prod.id, prod.cycle_time || 1);
      });

      // 3) Fetch Lots (note: column is "product", not "product_id")
      const { data: lotsData, error: lotsErr } = await supabase
        .from('lots')
        .select('id, machine, product, start_time, end_time, lot_size, ok_parts_produced')
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if (lotsErr) throw lotsErr;

      // Compute average cycle time per machine (in minutes)
      const cycleTimeByMachine: { [machineId: string]: number[] } = {};
      lotsData?.forEach(lot => {
        if (!lot.machine || !lot.product) return;
        const cTime = productCycleMap.get(lot.product) || 1;
        if (!cycleTimeByMachine[lot.machine]) {
          cycleTimeByMachine[lot.machine] = [];
        }
        cycleTimeByMachine[lot.machine].push(cTime);
      });
      const machineCycleAvg: { [machineId: string]: number } = {};
      Object.keys(cycleTimeByMachine).forEach(mId => {
        const arr = cycleTimeByMachine[mId];
        if (arr.length > 0) {
          const sum = arr.reduce((acc, val) => acc + val, 0);
          machineCycleAvg[mId] = sum / arr.length;
        } else {
          machineCycleAvg[mId] = 1;
        }
      });

      // 4) Fetch stop_events
      let stopsQ = supabase
        .from('stop_events')
        .select('id, machine, start_time, end_time, failure_type, cause')
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if (categoryFilter !== 'ALL') {
        stopsQ = stopsQ.eq('failure_type', categoryFilter);
      }
      const { data: stopsData, error: stopsErr } = await stopsQ;
      if (stopsErr) throw stopsErr;

      // 5) Fetch quality_issues
      let qualQ = supabase
        .from('quality_issues')
        .select('id, machine, start_time, end_time, category, cause, quantity')
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'SCRAP' || categoryFilter === 'REWORK') {
          qualQ = qualQ.ilike('category', `%${categoryFilter.toLowerCase()}%`);
        } else {
          // Si l'utilisateur choisit un type qui n'existe pas dans quality_issues, on force un match impossible
          qualQ = qualQ.eq('category', '???');
        }
      }
      const { data: qualData, error: qualErr } = await qualQ;
      if (qualErr) throw qualErr;

      // 6) Build production dates map from Lots (dates on which production occurred)
      const productionDatesByMachine: { [machineId: string]: Set<string> } = {};
      lotsData?.forEach(lot => {
        if (lot.machine) {
          if (!productionDatesByMachine[lot.machine]) {
            productionDatesByMachine[lot.machine] = new Set();
          }
          productionDatesByMachine[lot.machine].add(format(new Date(lot.start_time), 'yyyy-MM-dd'));
        }
      });

      const results: MachineHealth[] = [];

      for (const mach of machData) {
        const productionDates = productionDatesByMachine[mach.id] || new Set();
        if (productionDates.size === 0) continue;
        const productionDays = productionDates.size;

        // Real cycle time for machine (in minutes)
        const realCycleTime = machineCycleAvg[mach.id] || 1;

        const mStops = stopsData?.filter(s => s.machine === mach.id) || [];
        const mQual = qualData?.filter(q => q.machine === mach.id) || [];
        const mLots = lotsData?.filter(l => l.machine === mach.id) || [];

        let totalLots = 0,
          totalOk = 0;
        mLots.forEach(lot => {
          totalLots += lot.lot_size || 0;
          totalOk += lot.ok_parts_produced || 0;
        });

        // Downtime for stops (calculé sur l'ensemble de la période)
        let sumUnplannedMin = 0;
        mStops.forEach(stp => {
          const ft = mapStopFailureType(stp.failure_type);
          if (ft === 'AP') return;
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          sumUnplannedMin += differenceInMinutes(eT, sT);
        });
        const totalDowntimeH = sumUnplannedMin / 60;

        // Calcul de MTTR (inchangé)
        const sortedStops = [...mStops].sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        let sumStopH = 0,
          sumSqStopH = 0;
        sortedStops.forEach(stp => {
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          const durH = differenceInMinutes(eT, sT) / 60;
          sumStopH += durH;
          sumSqStopH += durH * durH;
        });
        const stopCount = sortedStops.length;
        const mttr = stopCount > 0 ? sumStopH / stopCount : 0;

        // Nouveau calcul du MTBF basé sur le temps de production uniquement
        const dailyOpenMin = mach.opening_time_minutes || 480;
        const dailyOpenH = dailyOpenMin / 60;
        // Période de production en heures = nombre de jours de production * heures d'ouverture
        const productionPeriodH = productionDays * dailyOpenH;
        // Filtrer les arrêts se produisant sur des jours de production
        const productionStops = mStops.filter(s =>
          productionDates.has(format(new Date(s.start_time), 'yyyy-MM-dd'))
        );
        let sumStopHProduction = 0;
        productionStops.forEach(stp => {
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          sumStopHProduction += differenceInMinutes(eT, sT) / 60;
        });
        const mtbf =
          productionStops.length > 0
            ? (productionPeriodH - sumStopHProduction) / productionStops.length
            : productionPeriodH - sumStopHProduction;

        const recentStart = subDays(end, differenceInDays(end, start));
        const recentStops = mStops.filter(s => new Date(s.start_time) >= recentStart).length;

        const computeWeight = (eventTime: Date) =>
          Math.exp((eventTime.getTime() - end.getTime()) / TAU_MS);

        // Aggregation by cause
        interface CAgg {
          type: string;
          causeText: string;
          occurrences: number;
          totalDurH: number;
          sumSqDurH: number;
          scrap: number;
          rework: number;
          lastOccurrence: Date | null;
          weightedOccurrences: number;
          weightedTotalDurH: number;
          weightedSumSqDurH: number;
          weightedQuantitySum?: number;
          weightedQuantitySumSq?: number;
          occurrenceTimestamps: Date[];
        }
        const causeMap = new Map<string, CAgg>();

        // Process stops events
        for (const stp of mStops) {
          const ft = mapStopFailureType(stp.failure_type);
          const cText = stp.cause || '(No cause)';
          const key = ft + '|' + cText;
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          const durH = differenceInMinutes(eT, sT) / 60;
          const weight = computeWeight(sT);

          if (!causeMap.has(key)) {
            causeMap.set(key, {
              type: ft,
              causeText: cText,
              occurrences: 0,
              totalDurH: 0,
              sumSqDurH: 0,
              scrap: 0,
              rework: 0,
              lastOccurrence: null,
              weightedOccurrences: 0,
              weightedTotalDurH: 0,
              weightedSumSqDurH: 0,
              occurrenceTimestamps: []
            });
          }
          const cObj = causeMap.get(key)!;
          cObj.occurrences++;
          cObj.totalDurH += durH;
          cObj.sumSqDurH += durH * durH;
          cObj.weightedOccurrences += weight;
          cObj.weightedTotalDurH += weight * durH;
          cObj.weightedSumSqDurH += weight * durH * durH;
          if (!cObj.lastOccurrence || sT > cObj.lastOccurrence) {
            cObj.lastOccurrence = sT;
          }
          cObj.occurrenceTimestamps.push(sT);
        }

        // Process quality issues (Scrap/Rework)
        for (const qi of mQual) {
          const qType = mapQualityCategory(qi.category);
          const cText = qi.cause || '(No cause)';
          const key = qType + '|' + cText;
          const qiT = new Date(qi.start_time);
          const weight = computeWeight(qiT);

          if (!causeMap.has(key)) {
            causeMap.set(key, {
              type: qType,
              causeText: cText,
              occurrences: 0,
              totalDurH: 0,
              sumSqDurH: 0,
              scrap: 0,
              rework: 0,
              lastOccurrence: null,
              weightedOccurrences: 0,
              weightedTotalDurH: 0,
              weightedSumSqDurH: 0,
              weightedQuantitySum: 0,
              weightedQuantitySumSq: 0,
              occurrenceTimestamps: []
            });
          }
          const cObj = causeMap.get(key)!;
          cObj.occurrences++;
          const qty = qi.quantity || 0;
          if (qType === 'SCRAP') {
            cObj.scrap += qty;
          } else if (qType === 'REWORK') {
            cObj.rework += qty;
          }
          cObj.weightedOccurrences += weight;
          cObj.weightedQuantitySum! += weight * qty;
          cObj.weightedQuantitySumSq! += weight * qty * qty;
          if (!cObj.lastOccurrence || qiT > cObj.lastOccurrence) {
            cObj.lastOccurrence = qiT;
          }
          cObj.occurrenceTimestamps.push(qiT);
        }

        // Build causeList from causeMap
        const causeList: FailureCause[] = [];
        causeMap.forEach(cObj => {
          let avgDuration = cObj.occurrences > 0 ? cObj.totalDurH / cObj.occurrences : 0;
          const variance =
            cObj.occurrences > 0
              ? cObj.sumSqDurH / cObj.occurrences - avgDuration * avgDuration
              : 0;
          let stdDeviation = Math.sqrt(Math.max(variance, 0));
          const variabilityIndex = avgDuration > 0 ? stdDeviation / avgDuration : 0;
          const lastOccurrenceStr = cObj.lastOccurrence ? format(cObj.lastOccurrence, 'yyyy-MM-dd') : 'N/A';

          // Weibull parameters based on occurrence intervals (in days)
          const { shape, scale } = calculateWeibullFromTimestamps(cObj.occurrenceTimestamps);
          const medianInterval = weibullMedian(shape, scale);
          const expectedDate = format(addDays(new Date(), medianInterval), 'yyyy-MM-dd');

          const weightedOccurrence = cObj.weightedOccurrences;
          const occurrencePerWeek = productionDays > 0 ? (weightedOccurrence * 7) / productionDays : 0;

          let severityValue = 0;
          let predictedRiskScore = 0;
          let certainty = '';

          if (cObj.type === 'SCRAP' || cObj.type === 'REWORK') {
            const totalAffected = cObj.type === 'SCRAP' ? cObj.scrap : cObj.rework;
            const avgParts = cObj.occurrences > 0 ? totalAffected / cObj.occurrences : 0;
            const wQty = cObj.weightedQuantitySum || 0;
            const wQtySq = cObj.weightedQuantitySumSq || 0;
            const wAvgParts = weightedOccurrence > 0 ? wQty / weightedOccurrence : 0;
            const wVarParts =
              weightedOccurrence > 0
                ? wQtySq / weightedOccurrence - wAvgParts * wAvgParts
                : 0;
            const wStdParts = Math.sqrt(Math.max(wVarParts, 0));

            avgDuration = avgParts;
            stdDeviation = wStdParts;
            const probableAffected = wAvgParts + 2 * wStdParts;
            severityValue = probableAffected;

            const riskFactor = cObj.type === 'SCRAP' ? riskFactorScrap : riskFactorRework;
            predictedRiskScore =
              dailyOpenH > 0
                ? (occurrencePerWeek *
                    probableAffected *
                    (realCycleTime / 3600) *
                    riskFactor *
                    100) /
                  dailyOpenH
                : 0;

            const varIndex = avgParts > 0 ? wStdParts / avgParts : 0;
            certainty =
              cObj.occurrences < 5
                ? 'Insufficient Data'
                : varIndex > 1
                ? 'Not Normal'
                : 'High Certainty';
          } else {
            severityValue = avgDuration + 2 * stdDeviation;
            predictedRiskScore =
              dailyOpenH > 0 ? ((occurrencePerWeek * severityValue) / dailyOpenH) * 100 : 0;
            certainty =
              cObj.occurrences < 5
                ? 'Insufficient Data'
                : variabilityIndex > 1
                ? 'Not Normal'
                : 'High Certainty';
          }

          causeList.push({
            type: cObj.type,
            causeText: cObj.causeText,
            occurrences: cObj.occurrences,
            totalDurationH: cObj.totalDurH,
            scrapCount: cObj.scrap,
            reworkCount: cObj.rework,
            lastOccurrence: lastOccurrenceStr,
            avgDuration,
            stdDeviation,
            variabilityIndex,
            occurrencePerWeek,
            severityValue,
            predictedRiskScore,
            certainty,
            expectedDate,
            weibullParams: { shape, scale }
          });
        });

        if (causeList.length === 0) continue;
        let finalCauseList = causeList;
        if (categoryFilter !== 'ALL') {
          finalCauseList = finalCauseList.filter(c => c.type === categoryFilter);
          if (finalCauseList.length === 0) continue;
        }

        const nextFail = format(new Date(), 'yyyy-MM-dd');
        const machineRisk = finalCauseList.reduce((acc, c) => acc + c.predictedRiskScore, 0);

        const machineTotalScrap = finalCauseList
          .filter(c => c.type === 'SCRAP')
          .reduce((sum, c) => sum + c.scrapCount, 0);
        const machineTotalRework = finalCauseList
          .filter(c => c.type === 'REWORK')
          .reduce((sum, c) => sum + c.reworkCount, 0);

        results.push({
          id: mach.id,
          name: mach.name,
          opening_time_minutes: mach.opening_time_minutes || 480,
          totalDowntimeH,
          mtbf,
          mttr,
          recentStops,
          totalScrap: machineTotalScrap,
          totalRework: machineTotalRework,
          predictedRisk: parseFloat(machineRisk.toFixed(1)),
          causeList: finalCauseList,
          sampleSize: { totalLots, totalOkParts: totalOk },
          nextFailureGlobal: nextFail
        });
      }

      results.sort((a, b) => b.predictedRisk - a.predictedRisk);
      setMachineList(results);
      setLoading(false);
    } catch (err) {
      console.error('PredictiveInsights => fetchData ERROR:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  }

  // Déterminer la liste des machines à afficher en fonction de la pagination
  const displayedMachines = machineList.slice(0, machinePage * 10);

  // Texte pour le tooltip de la classification de risque
  const riskClassificationText = `Risk Classification:
- ≥ 100: Critical (e.g. potential loss of one full operating day per week)
- 50–99: Severe
- 25–49: High
- 10–24: Moderate
- 2.5–9: Minor
- < 2.5: Low
`;

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Predictive Insights</h2>
            <p className="text-sm text-gray-500 mt-1">
              Advanced analysis from production lots, stop_events, and quality_issues.
            </p>
          </div>
          <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <div className="relative">
              <button
                onClick={() => setShowRangeDropdown(!showRangeDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {timeRange === '7d'
                  ? 'Last 7 days'
                  : timeRange === '90d'
                  ? 'Last 90 days'
                  : 'Last 30 days'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>
              {showRangeDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow z-20">
                  <button
                    onClick={() => {
                      setTimeRange('7d');
                      setShowRangeDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => {
                      setTimeRange('30d');
                      setShowRangeDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Last 30 days
                  </button>
                  <button
                    onClick={() => {
                      setTimeRange('90d');
                      setShowRangeDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Last 90 days
                  </button>
                </div>
              )}
            </div>
            {/* Bouton Parameters avant Export */}
            <button
              onClick={() => setShowRiskModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              Parameters
            </button>
            <button
              onClick={() => alert('Export not implemented')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-6">
          <input
            type="text"
            placeholder="Search machine..."
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            onChange={(e) => setMachineSearch(e.target.value)}
          />
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as CategoryFilterType)
            }
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="ALL">All Categories</option>
            {FAILURE_TYPES.filter(ft => ft.type !== 'AP').map(ft => (
              <option key={ft.type} value={ft.type}>
                {ft.name} ({ft.type})
              </option>
            ))}
          </select>
          <select
            value={expectedDateFilter}
            onChange={(e) =>
              setExpectedDateFilter(e.target.value as ExpectedDateFilter)
            }
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="ALL">All Next Occurrences</option>
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="NEXT_MONTH">Next Month</option>
            <option value="NEXT_6_MONTHS">Next 6 Months</option>
            <option value="THIS_YEAR">This Year</option>
          </select>
          {/* Nouveau dropdown pour limiter le nombre de causes affichées */}
          <select
            value={causeLimit}
            onChange={(e) => {
              const value = e.target.value;
              setCauseLimit(value === 'ALL' ? 'ALL' : parseInt(value, 10));
            }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="3">Top 3 Causes</option>
            <option value="5">Top 5 Causes</option>
            <option value="10">Top 10 Causes</option>
            <option value="ALL">All Causes</option>
          </select>
        </div>

        {/* Main Content: Machines */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : machineList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              No machines or production data found for these filters.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {displayedMachines.map(mach => {
                // Pour chaque machine, trier les causes par risque décroissant et appliquer la limitation
                const sortedCauses = [...mach.causeList].sort(
                  (a, b) => b.predictedRiskScore - a.predictedRiskScore
                );
                const displayedCauses =
                  causeLimit === 'ALL' ? sortedCauses : sortedCauses.slice(0, causeLimit);
                const stopsLabel = `Stops (Last ${
                  timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30
                } days)`;
                return (
                  <div key={mach.id} className="bg-white shadow rounded-lg p-6">
                    {/* Machine Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {mach.name}
                          <Tooltip content={riskClassificationText} className="ml-4">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ml-2 ${getRiskColor(
                                mach.predictedRisk
                              )}`}
                            >
                              Risk: {mach.predictedRisk.toFixed(0)}
                              <HelpCircle className="ml-1 h-4 w-4 text-blue-500 cursor-pointer" />
                            </span>
                          </Tooltip>
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Sample: {mach.sampleSize.totalOkParts}/{mach.sampleSize.totalLots}
                        </p>
                      </div>
                      <div className="text-right mt-4 md:mt-0">
                        <div className="text-xs text-gray-500">Next Failure (approx.)</div>
                        <div className="mt-1 text-lg font-semibold text-blue-600">
                          {mach.nextFailureGlobal}
                        </div>
                      </div>
                    </div>

                    {/* KPI Blocks */}
                    {categoryFilter === 'ALL' || !['SCRAP', 'REWORK'].includes(categoryFilter) ? (
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded text-center">
                          <span className="text-xs text-gray-500">Downtime (Unplanned)</span>
                          <div className="mt-1 text-base font-semibold text-gray-900">
                            {formatDuration(mach.totalDowntimeH)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded text-center">
                          <span className="text-xs text-gray-500">MTBF</span>
                          <div className="mt-1 text-base font-semibold text-gray-900">
                            {formatDuration(mach.mtbf)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded text-center">
                          <span className="text-xs text-gray-500">MTTR</span>
                          <div className="mt-1 text-base font-semibold text-gray-900">
                            {formatDuration(mach.mttr)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded text-center">
                          <span className="text-xs text-gray-500">{stopsLabel}</span>
                          <div className="mt-1 text-base font-semibold text-gray-900">
                            {mach.recentStops}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* KPI Scrap/Rework selon le filtre */}
                    {(categoryFilter === 'ALL' ||
                      categoryFilter === 'SCRAP' ||
                      categoryFilter === 'REWORK') && (
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        {(categoryFilter === 'ALL' || categoryFilter === 'SCRAP') && (
                          <div className="bg-gray-50 p-4 rounded text-center">
                            <span className="text-xs text-gray-500">Scrap</span>
                            <div className="mt-1 text-base font-semibold text-red-700">
                              {mach.totalScrap.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {(categoryFilter === 'ALL' || categoryFilter === 'REWORK') && (
                          <div className="bg-gray-50 p-4 rounded text-center">
                            <span className="text-xs text-gray-500">Rework</span>
                            <div className="mt-1 text-base font-semibold text-purple-700">
                              {mach.totalRework.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cause List */}
                    <div className="space-y-4">
                      {displayedCauses.map((cause, idx) => (
                        <CauseCard key={`${cause.type}_${idx}`} cause={cause} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Pagination : bouton "Load More Machines" */}
            {machineList.length > displayedMachines.length && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setMachinePage(machinePage + 1)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Load More Machines
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {showRiskModal && (
        <RiskParametersModal
          riskFactorScrap={riskFactorScrap}
          riskFactorRework={riskFactorRework}
          setRiskFactorScrap={setRiskFactorScrap}
          setRiskFactorRework={setRiskFactorRework}
          onClose={() => setShowRiskModal(false)}
        />
      )}
    </ProjectLayout>
  );
};

export default PredictiveInsights;
