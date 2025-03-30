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
  addMinutes,
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
  RefreshCw
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// --------------------- Utility Functions ---------------------

// Calcule les paramètres Weibull (shape et scale) à partir des intervalles entre occurrences (en jours)
function calculateWeibullFromTimestamps(timestamps: Date[]): { shape: number; scale: number } {
  if (timestamps.length < 2) return { shape: 1, scale: 0 };
  const sorted = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
  const intervals = sorted.slice(1).map((t, i) =>
    (t.getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24)
  );
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const shape = stdDev > 0 ? mean / stdDev : 1;
  return { shape, scale: mean };
}

// Calcule la médiane de la loi Weibull
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
  totalDurationH: number;     // For stops only
  scrapCount: number;         // Total pieces scrapped
  reworkCount: number;        // Total pieces reworked
  lastOccurrence: string;
  avgDuration: number;        // For stops: average duration (hrs) or for quality: average affected pieces
  stdDeviation: number;       // Variation (hrs or pieces)
  variabilityIndex: number;
  occurrencePerWeek: number;  // Predicted occurrences per week
  severityValue: number;      // For quality: average affected pieces per occurrence; for stops: time impact (hrs)
  predictedRiskScore: number;
  certainty: string;          // "Insufficient Data", "Not Normal", or "High Certainty"
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

const DEFAULT_CYCLE_TIME = 0.5;        // in hours
const RISK_FACTOR_SCRAP = 10;           // risk factor for scrap
const RISK_FACTOR_REWORK = 2;           // risk factor for rework
const TAU_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

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
  if (score >= 75) return 'bg-red-100 text-red-800';
  if (score >= 50) return 'bg-orange-100 text-orange-800';
  if (score >= 25) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
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
  return (
    <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-100 hover:shadow-md transition">
      {/* Header: Icon, Title, Risk */}
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
          Risk: {cause.predictedRiskScore.toFixed(2)} ({causeRiskClass})
        </div>
      </div>
      {/* Content: Historical Analysis & Prediction */}
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
                  <span className="font-semibold text-gray-800">{cause.avgDuration.toFixed(2)}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration Variation (hrs)</span>
                  <span className="font-semibold text-gray-800">{cause.stdDeviation.toFixed(2)}h</span>
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
                  <span className="font-semibold text-gray-800">{cause.avgDuration.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Variation (Pieces)</span>
                  <span className="font-semibold text-gray-800">{cause.stdDeviation.toFixed(2)}</span>
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
              <span className="font-semibold text-gray-800">{cause.severityValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Confidence</span>
              <span className="font-semibold text-gray-800">{cause.certainty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Next Expected Occurrence</span>
              <span className="font-semibold text-gray-800">{cause.expectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">
                Weibull Parameters
                <span
                  className="ml-1 text-blue-500 cursor-pointer"
                  title="The Weibull distribution models time-to-failure based on the intervals between events.
'Shape' reflects whether the failure rate increases (>1), remains constant (=1), or decreases (<1) over time.
'Scale' is the characteristic time (in days) — here, the average interval.
The next occurrence is estimated by the median: scale × (ln2)^(1/shape)."
                >
                  (?)
                </span>
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

// --------------------- Main Component: PredictiveInsights ---------------------

const PredictiveInsights: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [timeRange, setTimeRange] = useState<TimeRangeType>('30d');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('ALL');
  const [expectedDateFilter, setExpectedDateFilter] = useState<ExpectedDateFilter>('ALL');
  const [machineSearch, setMachineSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machineList, setMachineList] = useState<MachineHealth[]>([]);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, timeRange, categoryFilter, expectedDateFilter, machineSearch]);

  // --------------------- fetchData ---------------------
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

      // 2) Fetch Lots (Production)
      const { data: lotsData, error: lotsErr } = await supabase
        .from('lots')
        .select('id, machine, start_time, end_time, lot_size, ok_parts_produced')
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if (lotsErr) throw lotsErr;
      const productionDatesByMachine: { [machineId: string]: Set<string> } = {};
      lotsData?.forEach(lot => {
        if (lot.machine) {
          if (!productionDatesByMachine[lot.machine]) {
            productionDatesByMachine[lot.machine] = new Set();
          }
          productionDatesByMachine[lot.machine].add(format(new Date(lot.start_time), 'yyyy-MM-dd'));
        }
      });

      // 3) Fetch stop_events
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

      // 4) Fetch quality_issues
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
          qualQ = qualQ.eq('category', '???');
        }
      }
      const { data: qualData, error: qualErr } = await qualQ;
      if (qualErr) throw qualErr;

      // 5) Process data per machine
      const results: MachineHealth[] = [];
      for (const mach of machData) {
        const productionDates = productionDatesByMachine[mach.id] || new Set();
        if (productionDates.size === 0) continue;
        const productionDays = productionDates.size;
        const mLots = lotsData?.filter(l => l.machine === mach.id) || [];
        const mStops = stopsData?.filter(s => s.machine === mach.id) || [];
        const mQual = qualData?.filter(q => q.machine === mach.id) || [];
        let totalLots = 0, totalOk = 0;
        mLots.forEach(lot => {
          totalLots += lot.lot_size || 0;
          totalOk += lot.ok_parts_produced || 0;
        });
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
        const sortedStops = [...mStops].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        let sumStopH = 0, sumSqStopH = 0;
        sortedStops.forEach(stp => {
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          const durH = differenceInMinutes(eT, sT) / 60;
          sumStopH += durH;
          sumSqStopH += durH * durH;
        });
        const stopCount = sortedStops.length;
        const observedDays = differenceInDays(end, start);
        const periodH = observedDays * 24;
        const uptimeH = Math.max(0, periodH - sumStopH);
        const mtbf = stopCount > 0 ? uptimeH / stopCount : uptimeH;
        const mttr = stopCount > 0 ? sumStopH / stopCount : 0;
        const recentStart = subDays(end, observedDays);
        const recentStops = mStops.filter(s => new Date(s.start_time) >= recentStart).length;
        const dailyOpenMin = mach.opening_time_minutes || 480;
        const dailyOpenH = dailyOpenMin / 60;
        const computeWeight = (eventTime: Date) => Math.exp((eventTime.getTime() - end.getTime()) / TAU_MS);

        // Aggregator with occurrence timestamps
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
          const variance = cObj.occurrences > 0 ? cObj.sumSqDurH / cObj.occurrences - avgDuration * avgDuration : 0;
          let stdDeviation = Math.sqrt(Math.max(variance, 0));
          const variabilityIndex = avgDuration > 0 ? stdDeviation / avgDuration : 0;
          const lastOccurrenceStr = cObj.lastOccurrence ? format(cObj.lastOccurrence, 'yyyy-MM-dd') : 'N/A';

          // Calcul des paramètres Weibull basés sur les intervalles (en jours)
          const { shape, scale } = calculateWeibullFromTimestamps(cObj.occurrenceTimestamps);
          const medianInterval = weibullMedian(shape, scale);
          const expectedDate = format(addDays(new Date(), medianInterval), 'yyyy-MM-dd');

          const occurrencePerWeek = productionDays > 0 ? (cObj.weightedOccurrences * 7) / productionDays : 0;
          let severityValue = 0;
          let predictedRiskScore = 0;
          let certainty = '';

          if (cObj.type === 'SCRAP' || cObj.type === 'REWORK') {
            // Pour SCRAP/REWORK : moyenne des pièces affectées par occurrence
            const totalAffected = cObj.type === 'SCRAP' ? cObj.scrap : cObj.rework;
            const avgPieces = cObj.occurrences > 0 ? totalAffected / cObj.occurrences : 0;
            severityValue = avgPieces;
            const riskFactor = cObj.type === 'SCRAP' ? RISK_FACTOR_SCRAP : RISK_FACTOR_REWORK;
            predictedRiskScore = dailyOpenH > 0 ? occurrencePerWeek * avgPieces * DEFAULT_CYCLE_TIME * riskFactor : 0;
            certainty = cObj.occurrences < 5 
              ? 'Insufficient Data' 
              : (stdDeviation / (avgPieces || 1)) > 1 ? 'Not Normal' : 'High Certainty';
          } else {
            severityValue = avgDuration + 2 * stdDeviation;
            predictedRiskScore = dailyOpenH > 0 ? (occurrencePerWeek * severityValue) / dailyOpenH * 100 : 0;
            certainty = cObj.occurrences < 5 
              ? 'Insufficient Data' 
              : variabilityIndex > 1 ? 'Not Normal' : 'High Certainty';
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

        let finalCauseList = causeList;
        if (categoryFilter !== 'ALL') {
          finalCauseList = finalCauseList.filter(c => c.type === categoryFilter);
        }
        if (finalCauseList.length === 0) continue;
        const nextFail = format(new Date(), 'yyyy-MM-dd');

        let machineRisk = 0;
        if (categoryFilter === 'SCRAP' || categoryFilter === 'REWORK') {
          machineRisk = finalCauseList.reduce((acc, c) => acc + c.predictedRiskScore, 0);
        } else {
          const machineStops = sortedStops.filter(s => {
            const t = mapStopFailureType(s.failure_type);
            return t !== 'AP' && t !== 'SCRAP' && t !== 'REWORK';
          });
          const machineStopCount = machineStops.length;
          let sumStopH = 0, sumSqStopH = 0;
          machineStops.forEach(stp => {
            const sT = new Date(stp.start_time);
            let eT = stp.end_time ? new Date(stp.end_time) : end;
            if (eT > end) eT = end;
            const durH = differenceInMinutes(eT, sT) / 60;
            sumStopH += durH;
            sumSqStopH += durH * durH;
          });
          const machineVar = machineStopCount > 0 ? sumSqStopH / machineStopCount - Math.pow(sumStopH / machineStopCount, 2) : 0;
          const machineStdDev = Math.sqrt(Math.max(machineVar, 0));
          const machineAvgDur = machineStopCount > 0 ? sumStopH / machineStopCount : 0;
          const machineSeverity = machineAvgDur + 2 * machineStdDev;
          const machineOccurrencePerWeek = productionDays > 0 ? (machineStopCount * 7) / productionDays : 0;
          machineRisk = dailyOpenH > 0 ? (machineOccurrencePerWeek * machineSeverity) / dailyOpenH * 100 : 0;
        }

        const machineTotalScrap = finalCauseList.filter(c => c.type === 'SCRAP').reduce((sum, c) => sum + c.scrapCount, 0);
        const machineTotalRework = finalCauseList.filter(c => c.type === 'REWORK').reduce((sum, c) => sum + c.reworkCount, 0);

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

  // --------------------- Render ---------------------
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
                  <button onClick={() => { setTimeRange('7d'); setShowRangeDropdown(false); }} className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Last 7 days</button>
                  <button onClick={() => { setTimeRange('30d'); setShowRangeDropdown(false); }} className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Last 30 days</button>
                  <button onClick={() => { setTimeRange('90d'); setShowRangeDropdown(false); }} className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Last 90 days</button>
                </div>
              )}
            </div>
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
          <input type="text" placeholder="Search machine..." className="border border-gray-300 rounded-md px-3 py-2 text-sm" onChange={(e) => setMachineSearch(e.target.value)} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CategoryFilterType)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="ALL">All Categories</option>
            {FAILURE_TYPES.filter(ft => ft.type !== 'AP').map(ft => (
              <option key={ft.type} value={ft.type}>{ft.name} ({ft.type})</option>
            ))}
          </select>
          <select value={expectedDateFilter} onChange={(e) => setExpectedDateFilter(e.target.value as ExpectedDateFilter)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="ALL">All Next Occurrences</option>
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="NEXT_MONTH">Next Month</option>
            <option value="NEXT_6_MONTHS">Next 6 Months</option>
            <option value="THIS_YEAR">This Year</option>
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
            <p className="text-sm text-gray-500">No machines or production data found for these filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {machineList.map(mach => {
              const stopsLabel = `Stops (Last ${timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30} days)`;
              return (
                <div key={mach.id} className="bg-white shadow rounded-lg p-6">
                  {/* Machine Header */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {mach.name}
                        <span className={`ml-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(mach.predictedRisk)}`}>
                          Risk: {mach.predictedRisk.toFixed(0)}
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Sample: {mach.sampleSize.totalOkParts}/{mach.sampleSize.totalLots}
                      </p>
                    </div>
                    <div className="text-right mt-4 md:mt-0">
                      <div className="text-xs text-gray-500">Next Failure (approx.)</div>
                      <div className="mt-1 text-lg font-semibold text-blue-600">{mach.nextFailureGlobal}</div>
                    </div>
                  </div>
                  {/* KPI Blocks */}
                  {categoryFilter === 'ALL' || !['SCRAP', 'REWORK'].includes(categoryFilter) ? (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">Downtime (Unplanned)</span>
                        <div className="mt-1 text-base font-semibold text-gray-900">{formatDuration(mach.totalDowntimeH)}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">MTBF</span>
                        <div className="mt-1 text-base font-semibold text-gray-900">{formatDuration(mach.mtbf)}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">MTTR</span>
                        <div className="mt-1 text-base font-semibold text-gray-900">{formatDuration(mach.mttr)}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">{stopsLabel}</span>
                        <div className="mt-1 text-base font-semibold text-gray-900">{mach.recentStops}</div>
                      </div>
                    </div>
                  ) : null}
                  {categoryFilter === 'ALL' || ['SCRAP', 'REWORK'].includes(categoryFilter) ? (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">Scrap</span>
                        <div className="mt-1 text-base font-semibold text-red-700">{mach.totalScrap.toLocaleString()}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">Rework</span>
                        <div className="mt-1 text-base font-semibold text-purple-700">{mach.totalRework.toLocaleString()}</div>
                      </div>
                    </div>
                  ) : null}
                  {/* Cause List */}
                  <div className="space-y-4">
                    {mach.causeList.map((cause, idx) => (
                      <CauseCard key={`${cause.type}_${idx}`} cause={cause} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default PredictiveInsights;
