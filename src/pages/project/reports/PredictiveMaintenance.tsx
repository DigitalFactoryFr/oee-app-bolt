// ============================================================================
// PredictiveInsights.tsx
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  subDays,
  differenceInMinutes,
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
  Download,
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
interface TooltipProps {
  content: string;
  className?: string;
}

/**
 * Tooltip gérant un texte long avec possibilité de scroll
 * et un effet de fondu (opacity).
 */
const Tooltip: React.FC<TooltipProps> = ({ content, className = '', children }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}

      {/* Conteneur principal du tooltip (toujours monté) */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 flex flex-col items-center">
        {/* 
          La visibilité et l'interaction dépendent de hovered.
          - pointer-events-none : on ne peut pas cliquer/scroll
          - pointer-events-auto : on peut cliquer/scroll
        */}
        <div
          className={`
            bg-gray-700 text-white text-xs rounded py-1 px-2 z-50 w-64 text-left
            transition-all duration-200 whitespace-pre-wrap break-words
            max-h-60 overflow-y-auto
            ${hovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
        >
          {content}
        </div>
        {/* Petit triangle */}
        <div
          className={`
            w-2 h-2 bg-gray-700 transform rotate-45 -mt-1 z-50 transition-all duration-200
            ${hovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
        />
      </div>
    </div>
  );
};

// --------------------- Utility Functions ---------------------
function quantile(arr: number[], q: number): number {
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
    return arr[base] + rest * (arr[base + 1] - arr[base]);
  } else {
    return arr[base];
  }
}

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
  return shape > 0 ? scale * Math.pow(Math.log(2), 1 / shape) : 0;
}

// --------------------- Types & Interfaces ---------------------
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
  variabilityIndex: number;
  IQR: number;
  occurrencePerWeek: number;
  severityValue: number;
  predictedRiskScore: number;
  certainty: string;
  expectedDate: string;
  trend: string;
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
  durations?: number[]; // For stops: hours; for SCRAP/REWORK: pieces
}

// --------------------- Constants & Parameters ---------------------
const INITIAL_RISK_FACTOR_SCRAP = 7.5;
const INITIAL_RISK_FACTOR_REWORK = 2.5;

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
  if (isNaN(score)) return 'bg-gray-100 text-gray-800';
  if (score >= 100) return 'bg-red-100 text-red-800';
  if (score >= 50) return 'bg-orange-100 text-orange-800';
  if (score >= 25) return 'bg-yellow-100 text-yellow-800';
  if (score >= 10) return 'bg-blue-100 text-blue-800';
  if (score >= 2.5) return 'bg-teal-100 text-teal-800';
  return 'bg-green-100 text-green-800';
}

function classifyRisk(score: number): string {
  if (isNaN(score)) return 'Undefined';
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
  riskFactorScrap: number;
  riskFactorRework: number;
  categoryFilter: CategoryFilterType;
}

const CauseCard: React.FC<CauseCardProps> = ({ cause, riskFactorScrap, riskFactorRework }) => {
  // Risk
  let riskScoreDisplay = cause.predictedRiskScore;
  if (riskScoreDisplay === 0) {
    riskScoreDisplay = NaN;
  }
  if (
    (cause.type === 'SCRAP' && riskFactorScrap === 0) ||
    (cause.type === 'REWORK' && riskFactorRework === 0)
  ) {
    riskScoreDisplay = NaN;
  }
  const displayedRisk = isNaN(riskScoreDisplay) ? 'N/A' : riskScoreDisplay.toFixed(2);
  const riskBadgeClass = getRiskColor(riskScoreDisplay);
  const causeRiskClass = classifyRisk(riskScoreDisplay);

  // IQR
  const displayedIQR = isNaN(cause.IQR) ? 'N/A' : cause.IQR.toFixed(2);
  // Average Duration or Affected Pieces
  const displayedAvgDuration = isNaN(cause.avgDuration) ? 'N/A' : cause.avgDuration.toFixed(2);
  // Severity
  const displayedSeverity = isNaN(cause.severityValue) ? 'N/A' : cause.severityValue.toFixed(2);

  // Weibull shape & scale
  const shapeVal = cause.weibullParams.shape;
  const scaleVal = cause.weibullParams.scale;
  const shapeDisplay = shapeVal === 0 || isNaN(shapeVal) ? 'N/A' : shapeVal.toFixed(2);
  const scaleDisplay = scaleVal === 0 || isNaN(scaleVal) ? 'N/A' : scaleVal.toFixed(2);

  const weibullTooltipText = `
Weibull Distribution:
- Shape > 1: Failure rate increases over time
- Shape < 1: Failure rate decreases over time
- Shape = 1: Failure rate is constant (exponential)
- Scale: Average interval (in days) between failures.
- Median = scale × (ln(2))^(1/shape)
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
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${riskBadgeClass}`}>
          Risk: {displayedRisk} ({causeRiskClass})
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
                  <span className="font-semibold text-gray-800">{displayedAvgDuration}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">IQR (hrs)</span>
                  <span className="font-semibold text-gray-800">{displayedIQR}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trend (vs. previous period)</span>
                  <span className="font-semibold text-gray-800">{cause.trend}</span>
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
                  <span className="font-semibold text-gray-800">{displayedAvgDuration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">IQR (Pieces)</span>
                  <span className="font-semibold text-gray-800">{displayedIQR}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trend (vs. previous period)</span>
                  <span className="font-semibold text-gray-800">{cause.trend}</span>
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
              <span className="font-semibold text-gray-800">{cause.occurrencePerWeek.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">
                {cause.type === 'SCRAP' || cause.type === 'REWORK'
                  ? 'Affected Parts (est.)'
                  : 'Severity (Time Impact)'}
              </span>
              <span className="font-semibold text-gray-800">{displayedSeverity}</span>
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
                shape: {shapeDisplay}, scale: {scaleDisplay}
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
  riskPeriod: number;
  setRiskFactorScrap: (value: number) => void;
  setRiskFactorRework: (value: number) => void;
  setRiskPeriod: (value: number) => void;
  onClose: () => void;
}

const RiskParametersModal: React.FC<RiskParametersModalProps> = ({
  riskFactorScrap,
  riskFactorRework,
  riskPeriod,
  setRiskFactorScrap,
  setRiskFactorRework,
  setRiskPeriod,
  onClose
}) => {
  // État local pour n'appliquer qu'au clic "Apply"
  const [localRiskPeriod, setLocalRiskPeriod] = useState<number>(riskPeriod);
  const [localRiskFactorScrap, setLocalRiskFactorScrap] = useState<number>(riskFactorScrap);
  const [localRiskFactorRework, setLocalRiskFactorRework] = useState<number>(riskFactorRework);

  const applyChanges = () => {
    setRiskPeriod(localRiskPeriod);
    setRiskFactorScrap(localRiskFactorScrap);
    setRiskFactorRework(localRiskFactorRework);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="bg-white rounded-lg shadow-lg z-40 w-80 p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Parameters</h3>
        <div className="space-y-4">
          {/* Risk Period */}
          <div>
            <label className="block text-sm text-gray-700">Risk Period (days)</label>
            <select
              value={localRiskPeriod}
              onChange={(e) => setLocalRiskPeriod(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={7}>7</option>
              <option value={30}>30</option>
              <option value={90}>90</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Data History: Defines the number of past days included in the analysis and affects the exponential weighting.
            </p>
          </div>

          {/* Scrap Risk Factor */}
          <div>
            <label className="block text-sm text-gray-700">Scrap Risk Factor</label>
            <input
              type="number"
              min={0}
              max={15}
              step={0.1}
              value={localRiskFactorScrap}
              onChange={(e) => setLocalRiskFactorScrap(parseFloat(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              title="Risk factor for Scrap (0–15)."
            />
            <p className="text-xs text-gray-500 mt-1">
              Determines how strongly scrap events affect the overall risk score. A higher value may simulate up to 10× more lost production time, reflecting increased downtime and higher operational costs.
            </p>
          </div>

          {/* Rework Risk Factor */}
          <div>
            <label className="block text-sm text-gray-700">Rework Risk Factor</label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={localRiskFactorRework}
              onChange={(e) => setLocalRiskFactorRework(parseFloat(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              title="Risk factor for Rework (0–5)."
            />
            <p className="text-xs text-gray-500 mt-1">
              Determines how strongly rework events affect the overall risk score. A higher value increases the influence of rework events on downtime and productivity.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={applyChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

// --------------------- Export Function ---------------------
const handleExportJson = (data: MachineHealth[]) => {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.json';
  a.click();
  URL.revokeObjectURL(url);
};

// --------------------- Main Component: PredictiveInsights ---------------------
const PredictiveInsights: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Filtres
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('ALL');
  const [expectedDateFilter, setExpectedDateFilter] = useState<ExpectedDateFilter>('ALL');
  const [machineSearch, setMachineSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machineList, setMachineList] = useState<MachineHealth[]>([]);

  // Pagination
  const [machinePage, setMachinePage] = useState<number>(1);
  // Limite de causes
  const [causeLimit, setCauseLimit] = useState<number | 'ALL'>(3);

  // Paramètres de risque
  const [riskFactorScrap, setRiskFactorScrap] = useState<number>(INITIAL_RISK_FACTOR_SCRAP);
  const [riskFactorRework, setRiskFactorRework] = useState<number>(INITIAL_RISK_FACTOR_REWORK);
  const [riskPeriod, setRiskPeriod] = useState<number>(30); // par défaut 30 jours
  const [showRiskModal, setShowRiskModal] = useState<boolean>(false);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
    setMachinePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectId,
    categoryFilter,
    expectedDateFilter,
    machineSearch,
    riskFactorScrap,
    riskFactorRework,
    riskPeriod
  ]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const end = now;
      const start = subDays(now, riskPeriod);
      const previousStart = subDays(start, riskPeriod);
      const previousEnd = start;
      const tau = riskPeriod * 24 * 60 * 60 * 1000;

      // 1) Récupération des machines
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

      // 2) Récupération des produits
      const { data: productsData, error: prodErr } = await supabase
        .from('products')
        .select('id, cycle_time');
      if (prodErr) throw prodErr;
      const productCycleMap = new Map<string, number>();
      productsData?.forEach(prod => {
        productCycleMap.set(prod.id, prod.cycle_time || 1);
      });

      // 3) Récupération des lots (période courante)
      const { data: lotsData, error: lotsErr } = await supabase
        .from('lots')
        .select('id, machine, product, start_time, end_time, lot_size, ok_parts_produced')
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if (lotsErr) throw lotsErr;

      // Calcul du temps de cycle moyen par machine
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
        machineCycleAvg[mId] = arr.length > 0 ? arr.reduce((acc, v) => acc + v, 0) / arr.length : 1;
      });

      // 4) Récupération des arrêts (période courante)
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

      // 5) Récupération des issues qualité (période courante)
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
          // Dans ce cas, on n'aura rien
          qualQ = qualQ.eq('category', '???');
        }
      }
      const { data: qualData, error: qualErr } = await qualQ;
      if (qualErr) throw qualErr;

      // 6) Récupération des arrêts (période précédente)
      const { data: stopsDataPrev, error: stopsPrevErr } = await supabase
        .from('stop_events')
        .select('id, machine, start_time, end_time, failure_type, cause')
        .eq('project_id', projectId)
        .gte('start_time', previousStart.toISOString())
        .lte('start_time', previousEnd.toISOString());
      if (stopsPrevErr) throw stopsPrevErr;

      // 7) Récupération des issues qualité (période précédente)
      const { data: qualDataPrev, error: qualPrevErr } = await supabase
        .from('quality_issues')
        .select('id, machine, start_time, end_time, category, cause, quantity')
        .eq('project_id', projectId)
        .gte('start_time', previousStart.toISOString())
        .lte('start_time', previousEnd.toISOString());
      if (qualPrevErr) throw qualPrevErr;

      // Map des jours de production par machine
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
        if (productionDates.size === 0) continue; // Pas de production => pas de data
        const productionDays = productionDates.size;

        const realCycleTime = machineCycleAvg[mach.id] || 1;
        const mStops = (stopsData || []).filter(s => s.machine === mach.id);
        const mQual = (qualData || []).filter(q => q.machine === mach.id);
        const mLots = (lotsData || []).filter(l => l.machine === mach.id);

        let totalLots = 0, totalOk = 0;
        mLots.forEach(lot => {
          totalLots += lot.lot_size || 0;
          totalOk += lot.ok_parts_produced || 0;
        });

        // Calcul du downtime non planifié
        let sumUnplannedMin = 0;
        mStops.forEach(stp => {
          const ft = mapStopFailureType(stp.failure_type);
          if (ft === 'AP') return; // AP => planned downtime
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          sumUnplannedMin += differenceInMinutes(eT, sT);
        });
        const totalDowntimeH = sumUnplannedMin / 60;

        // MTTR
        const sortedStops = [...mStops].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        let sumStopH = 0;
        sortedStops.forEach(stp => {
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          const durH = differenceInMinutes(eT, sT) / 60;
          sumStopH += durH;
        });
        const stopCount = sortedStops.length;
        const mttr = stopCount > 0 ? sumStopH / stopCount : 0;

        // MTBF
        const dailyOpenMin = mach.opening_time_minutes || 480;
        const dailyOpenH = dailyOpenMin / 60;
        const productionPeriodH = productionDays * dailyOpenH;
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
        const mtbf = productionStops.length > 0
          ? (productionPeriodH - sumStopHProduction) / productionStops.length
          : productionPeriodH - sumStopHProduction;

        const recentStops = mStops.filter(s => new Date(s.start_time) >= start).length;

        // Poids exponentiel
        const computeWeight = (eventTime: Date) =>
          Math.exp((eventTime.getTime() - end.getTime()) / tau);

        // Agrégation des causes (période courante)
        const causeMap = new Map<string, CAgg>();

        // Arrêts
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
              occurrenceTimestamps: [],
              durations: []
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
          cObj.durations!.push(durH);
        }

        // Issues qualité (SCRAP/REWORK)
        for (const qi of mQual) {
          const qType = mapQualityCategory(qi.category);
          if (qType !== 'SCRAP' && qType !== 'REWORK') continue;
          const cText = qi.cause || '(No cause)';
          const key = qType + '|' + cText;
          const qiT = new Date(qi.start_time);
          const weight = computeWeight(qiT);
          const qty = qi.quantity || 0;
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
              occurrenceTimestamps: [],
              durations: []
            });
          }
          const cObj = causeMap.get(key)!;
          cObj.occurrences++;
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
          cObj.durations!.push(qty);
        }

        // Agrégation des causes (période précédente)
        const prevStops = (stopsDataPrev || []).filter(s => s.machine === mach.id);
        const prevQual = (qualDataPrev || []).filter(q => q.machine === mach.id);
        const prevCauseMap = new Map<string, CAgg>();

        // Stops (période précédente)
        for (const stp of prevStops) {
          const ft = mapStopFailureType(stp.failure_type);
          const cText = stp.cause || '(No cause)';
          const key = ft + '|' + cText;
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : previousEnd;
          if (eT > previousEnd) eT = previousEnd;
          const durH = differenceInMinutes(eT, sT) / 60;
          const weight = computeWeight(sT);
          if (!prevCauseMap.has(key)) {
            prevCauseMap.set(key, {
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
              occurrenceTimestamps: [],
              durations: []
            });
          }
          const cObj = prevCauseMap.get(key)!;
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
          cObj.durations!.push(durH);
        }

        // Quality issues (période précédente)
        for (const qi of prevQual) {
          const qType = mapQualityCategory(qi.category);
          if (qType !== 'SCRAP' && qType !== 'REWORK') continue;
          const cText = qi.cause || '(No cause)';
          const key = qType + '|' + cText;
          const qiT = new Date(qi.start_time);
          const weight = computeWeight(qiT);
          const qty = qi.quantity || 0;
          if (!prevCauseMap.has(key)) {
            prevCauseMap.set(key, {
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
              occurrenceTimestamps: [],
              durations: []
            });
          }
          const cObj = prevCauseMap.get(key)!;
          cObj.occurrences++;
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
          cObj.durations!.push(qty);
        }

        // Construction de la causeList finale
        let causeList: FailureCause[] = [];
        causeMap.forEach(cObj => {
          let avgDuration = 0,
            stdDeviation = 0,
            IQR = NaN,
            variabilityIndex = 0,
            severityValue = NaN;
          const durations = cObj.durations || [];
          if (durations.length < 2) {
            avgDuration = durations.length === 1 ? durations[0] : NaN;
          } else {
            const sortedDur = [...durations].sort((a, b) => a - b);
            const sumDur = sortedDur.reduce((acc, val) => acc + val, 0);
            avgDuration = sumDur / sortedDur.length;

            const median = (arr: number[]): number => {
              const mid = Math.floor(arr.length / 2);
              return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
            };

            const firstHalf = sortedDur.slice(0, Math.floor(sortedDur.length / 2));
            const secondHalf = sortedDur.slice(Math.ceil(sortedDur.length / 2));
            const Q1 = median(firstHalf);
            const Q3 = median(secondHalf);
            IQR = Q3 - Q1;

            stdDeviation = Math.sqrt(
              sortedDur.reduce((sum, v) => sum + Math.pow(v - avgDuration, 2), 0) / sortedDur.length
            );
            variabilityIndex = avgDuration > 0 ? stdDeviation / avgDuration : 0;

            // Gestion d'exceedances (POT) ou fallback
            if (sortedDur.length >= 30) {
              const thresh = quantile(sortedDur, 0.75);
              const exceedances = sortedDur.filter(d => d > thresh).map(d => d - thresh);
              if (exceedances.length > 0) {
                const meanExceed = exceedances.reduce((acc, val) => acc + val, 0) / exceedances.length;
                const varExceed = exceedances.reduce((acc, val) => acc + Math.pow(val - meanExceed, 2), 0) / exceedances.length;
                const potShape = (1 - (meanExceed * meanExceed) / varExceed) / 2;
                const potScale = meanExceed * (1 - potShape);
                let medianExceed = 0;
                if (potShape !== 0) {
                  medianExceed =
                    (potScale / potShape) *
                    (Math.pow(Math.log(2), -potShape) - 1);
                } else {
                  medianExceed = potScale * Math.log(2);
                }
                severityValue = avgDuration + 2 * medianExceed;
              } else {
                severityValue = avgDuration + 1.5 * IQR;
              }
            } else {
              severityValue = avgDuration + 1.5 * IQR;
            }
          }

          let predictedRiskScore = 0;
          const dailyOpenH = mach.opening_time_minutes ? mach.opening_time_minutes / 60 : 8;
          const occurrencePerWeek = productionDays > 0 ? (cObj.weightedOccurrences * 7) / productionDays : 0;
          let certainty = '';
          if (cObj.occurrences < 5) {
            certainty = 'Insufficient Data';
          } else if (variabilityIndex > 1) {
            certainty = 'Not Normal';
          } else {
            certainty = 'High Certainty';
          }

          // Calcul du risk score
          if (cObj.type === 'SCRAP' || cObj.type === 'REWORK') {
            const riskFactor = cObj.type === 'SCRAP' ? riskFactorScrap : riskFactorRework;
            if (!isNaN(severityValue) && dailyOpenH > 0) {
              predictedRiskScore =
                (occurrencePerWeek * severityValue * (realCycleTime / 3600) * riskFactor * 100) / dailyOpenH;
            }
          } else {
            if (!isNaN(severityValue) && dailyOpenH > 0) {
              predictedRiskScore = (occurrencePerWeek * severityValue * 100) / dailyOpenH;
            }
          }
          if (isNaN(predictedRiskScore)) predictedRiskScore = 0;

          // Trend
          let trend = 'N/A';
          const prevKey = cObj.type + '|' + cObj.causeText;
          if (prevCauseMap.has(prevKey)) {
            const prevObj = prevCauseMap.get(prevKey)!;
            if (prevObj.totalDurH > 0) {
              const change = ((cObj.totalDurH - prevObj.totalDurH) / prevObj.totalDurH) * 100;
              trend = change.toFixed(0) + '%';
            }
          }

          // Weibull
          let shapeForExpected = 0,
            scaleForExpected = 0,
            medianInterval = 0;
          if (cObj.occurrenceTimestamps.length >= 2) {
            if (cObj.durations && cObj.durations.length >= 30) {
              const sortedDur = [...cObj.durations].sort((a, b) => a - b);
              const thresh = quantile(sortedDur, 0.75);
              const exceedances = sortedDur.filter(d => d > thresh).map(d => d - thresh);
              if (exceedances.length > 0) {
                const meanExceed = exceedances.reduce((acc, val) => acc + val, 0) / exceedances.length;
                const varExceed = exceedances.reduce((acc, val) => acc + Math.pow(val - meanExceed, 2), 0) / exceedances.length;
                const potShape = (1 - (meanExceed * meanExceed) / varExceed) / 2;
                const potScale = meanExceed * (1 - potShape);
                if (potShape !== 0) {
                  medianInterval =
                    (potScale / potShape) *
                    (Math.pow(Math.log(2), -potShape) - 1);
                } else {
                  medianInterval = potScale * Math.log(2);
                }
                shapeForExpected = potShape;
                scaleForExpected = potScale;
              } else {
                const w = calculateWeibullFromTimestamps(cObj.occurrenceTimestamps);
                shapeForExpected = w.shape;
                scaleForExpected = w.scale;
                medianInterval = weibullMedian(w.shape, w.scale);
              }
            } else {
              const w = calculateWeibullFromTimestamps(cObj.occurrenceTimestamps);
              shapeForExpected = w.shape;
              scaleForExpected = w.scale;
              medianInterval = weibullMedian(w.shape, w.scale);
            }
          }
          const expectedDate = format(addDays(new Date(), medianInterval), 'yyyy-MM-dd');

          causeList.push({
            type: cObj.type,
            causeText: cObj.causeText,
            occurrences: cObj.occurrences,
            totalDurationH: cObj.totalDurH,
            scrapCount: cObj.scrap,
            reworkCount: cObj.rework,
            lastOccurrence: cObj.lastOccurrence ? format(cObj.lastOccurrence, 'yyyy-MM-dd') : 'N/A',
            avgDuration,
            variabilityIndex,
            IQR,
            occurrencePerWeek,
            severityValue,
            predictedRiskScore,
            certainty,
            expectedDate,
            trend,
            weibullParams: { shape: shapeForExpected, scale: scaleForExpected }
          });
        });

        // Filtrer par date attendue si nécessaire
        if (expectedDateFilter !== 'ALL') {
          if (expectedDateFilter === 'TODAY') {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            causeList = causeList.filter(cause => cause.expectedDate === todayStr);
          } else {
            const dateRange = getExpectedDateRange(expectedDateFilter);
            if (dateRange) {
              causeList = causeList.filter(cause => {
                const ed = new Date(cause.expectedDate);
                return ed >= dateRange.start && ed <= dateRange.end;
              });
            }
          }
          if (causeList.length === 0) continue;
        }

        const nextFail = causeList.length > 0
          ? format(
              causeList.reduce((min, cause) => {
                const ed = new Date(cause.expectedDate);
                return ed < min ? ed : min;
              }, new Date(causeList[0].expectedDate)),
              'yyyy-MM-dd'
            )
          : 'N/A';

        const machineTotalScrap = causeList
          .filter(c => c.type === 'SCRAP')
          .reduce((sum, c) => sum + c.scrapCount, 0);
        const machineTotalRework = causeList
          .filter(c => c.type === 'REWORK')
          .reduce((sum, c) => sum + c.reworkCount, 0);

        let machineRisk = causeList.reduce((acc, c) => acc + c.predictedRiskScore, 0);
        if (machineRisk === 0) {
          machineRisk = NaN;
        }
        if (
          (categoryFilter === 'SCRAP' && riskFactorScrap === 0) ||
          (categoryFilter === 'REWORK' && riskFactorRework === 0)
        ) {
          machineRisk = NaN;
        }

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
          predictedRisk: machineRisk,
          causeList,
          sampleSize: { totalLots, totalOkParts: totalOk },
          nextFailureGlobal: nextFail
        });
      }

      // Tri final par risque décroissant
      results.sort((a, b) => {
        const valA = isNaN(a.predictedRisk) ? -1 : a.predictedRisk;
        const valB = isNaN(b.predictedRisk) ? -1 : b.predictedRisk;
        return valB - valA;
      });

      setMachineList(results);
      setLoading(false);
    } catch (err) {
      console.error('PredictiveInsights => fetchData ERROR:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  }

  const displayedMachines = machineList.slice(0, machinePage * 10);

  const riskClassificationText = `Risk Classification Explanation

- **Critical (≥ 100):** Represents a potential shutdown equal to one full operating day (typically around 480 minutes of lost production). Immediate corrective action is required to avoid severe disruption.
- **Severe (50–99):** Indicates a very high risk that could result in substantial downtime—often in the range of 240 to 480 minutes. These conditions demand prompt investigation and repair.
- **High (25–49):** Signifies a significant risk level that may lead to several hours (approximately 120–240 minutes) of production loss. Proactive maintenance is recommended.
- **Moderate (10–24):** Reflects a moderate risk where potential downtime might be around 60 to 120 minutes. Regular monitoring and scheduled maintenance should be maintained.
- **Minor (2.5–9):** Suggests a low risk with minimal disruption—typically less than 60 minutes of downtime. Although not urgent, continued observation is advisable.
- **Low (< 2.5 or N/A):** A score below 2.5—or when the risk score is not determined (displayed as “N/A”)—implies negligible risk, meaning there is either insufficient data or the impact is minimal (often less than 15 minutes).
`;

  const handleExport = () => {
    handleExportJson(machineList);
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Predictive Insights</h2>
            <p className="text-sm text-gray-500 mt-1">
              Advanced analysis from production lots, stop_events, and quality_issues. Data History: Last {riskPeriod} days; Scrap Risk Factor: {riskFactorScrap}; Rework Risk Factor: {riskFactorRework}.
            </p>
          </div>
          <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <button
              onClick={() => setShowRiskModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              Parameters
            </button>
            <button
              onClick={handleExport}
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
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilterType)}
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
            onChange={(e) => setExpectedDateFilter(e.target.value as ExpectedDateFilter)}
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
                const sortedCauses = [...mach.causeList].sort((a, b) => b.predictedRiskScore - a.predictedRiskScore);
                const displayedCauses = causeLimit === 'ALL' ? sortedCauses : sortedCauses.slice(0, causeLimit);

                let machineRisk = mach.predictedRisk;
                if (machineRisk === 0) {
                  machineRisk = NaN;
                }
                const machineRiskText = isNaN(machineRisk) ? 'N/A' : machineRisk.toFixed(0);

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
                              Risk: {machineRiskText}
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
                          <span className="text-xs text-gray-500">{`Stops (Last ${riskPeriod} days)`}</span>
                          <div className="mt-1 text-base font-semibold text-gray-900">
                            {mach.recentStops}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* KPI Scrap/Rework */}
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
                        <CauseCard
                          key={`${cause.type}_${idx}`}
                          cause={cause}
                          riskFactorScrap={riskFactorScrap}
                          riskFactorRework={riskFactorRework}
                          categoryFilter={categoryFilter}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
          riskPeriod={riskPeriod}
          setRiskFactorScrap={setRiskFactorScrap}
          setRiskFactorRework={setRiskFactorRework}
          setRiskPeriod={setRiskPeriod}
          onClose={() => setShowRiskModal(false)}
        />
      )}
    </ProjectLayout>
  );
};

export default PredictiveInsights;
