// ============================================================================
// PredictiveInsights.tsx
// ============================================================================
// Ce composant affiche une analyse prédictive avancée basée sur:
// - Les données de production (lots)
// - Les événements d'arrêt (stop_events)
// - Les problèmes de qualité (quality_issues)
//
// Modifications principales demandées :
// 1. Pour Scrap/Rework, remplacer "Durée Moy. (pièces)" et "Std Dev. (pièces)"
//    par "Avg" et "Variation".
// 2. Ajouter "Affected (est.)" dans la section Prédiction pour Scrap/Rework.
// 3. Afficher un pourcentage de certitude à côté du texte (Insufficient Data, etc.)
// 4. Calculer le risque machine pour Scrap/Rework si le filtre sélectionné est
//    "SCRAP" ou "REWORK" (somme des predictedRiskScore des causes).
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
  avgDuration: number;       // Soit en heures (stops), soit en pièces (scrap/rework)
  stdDeviation: number;      // Idem
  variabilityIndex: number;
  occurrencePerWeek: number;
  severityValue: number;     // Pour Scrap/Rework : nb de pièces affectées (avgParts)
  predictedRiskScore: number;// Score de risque calculé
  certainty: string;         // "Insufficient Data", "Not Normal", "High Certainty"
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

// --------------------- Constantes & Paramètres ---------------------

const DEFAULT_CYCLE_TIME = 0.5;
const RISK_FACTOR_SCRAP = 10;
const RISK_FACTOR_REWORK = 2;
const TAU_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours en ms

// --------------------- Icônes et Couleurs (Stops Causes Tracking) ---------------------

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

// --------------------- Fonctions de risque, formatage, etc. ---------------------

// Nouveau design inspiré du code (couleurs en fonction du score)
function getRiskColor(score: number): string {
  if (score >= 75) return "bg-red-100 text-red-800";
  if (score >= 50) return "bg-orange-100 text-orange-800";
  if (score >= 25) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

function classifyRisk(score: number): string {
  if (score >= 100) return "Critical";
  if (score >= 50)  return "Severe";
  if (score >= 25)  return "High";
  if (score >= 10)  return "Moderate";
  if (score >= 2.5) return "Minor";
  return "Low";
}

function formatDuration(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
}

// Map texte de certitude -> pourcentage indicatif
function mapCertaintyToPercent(cert: string): number {
  switch (cert) {
    case "Insufficient Data":
      return 30;
    case "Not Normal":
      return 60;
    case "High Certainty":
      return 90;
    default:
      return 50; // Valeur par défaut
  }
}

// --------------------- Helpers Date Range ---------------------

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

// --------------------- Mappers pour les types ---------------------

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

// --------------------- Composant CauseCard ---------------------

interface CauseCardProps {
  cause: FailureCause;
}

const CauseCard: React.FC<CauseCardProps> = ({ cause }) => {
  const riskBadgeClass = getRiskColor(cause.predictedRiskScore);
  const causeRiskClass = classifyRisk(cause.predictedRiskScore);
  const certaintyPct = mapCertaintyToPercent(cause.certainty);

  return (
    <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-100 hover:shadow-md transition">
      {/* En-tête : Icon, Titre, Badge Risk */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-full bg-gray-50 flex items-center justify-center">
            {getCategoryIcon(cause.type)}
          </div>
          <div>
            <h4 className="text-base font-semibold text-gray-800">{cause.causeText}</h4>
            <p className="text-xs text-gray-500">Type : {cause.type}</p>
          </div>
        </div>
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${riskBadgeClass}`}>
          Risk: {cause.predictedRiskScore.toFixed(2)} ({causeRiskClass})
        </div>
      </div>

      {/* Contenu "Historique" et "Prédiction" */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* Historique */}
        <div className="bg-gray-50 p-3 rounded-md">
          <h5 className="font-medium text-gray-900 mb-2 text-sm">Historique</h5>
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Occurrences</span>
              <span className="font-semibold text-gray-800">{cause.occurrences}</span>
            </div>
            {cause.type !== 'SCRAP' && cause.type !== 'REWORK' ? (
              /* Pour stops */
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Durée Moy.</span>
                  <span className="font-semibold text-gray-800">
                    {cause.avgDuration.toFixed(2)}h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Std Dev.</span>
                  <span className="font-semibold text-gray-800">
                    {cause.stdDeviation.toFixed(2)}h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dernière</span>
                  <span className="font-semibold text-gray-800">
                    {cause.lastOccurrence}
                  </span>
                </div>
              </>
            ) : (
              /* Pour scrap/rework */
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg</span>
                  <span className="font-semibold text-gray-800">
                    {cause.avgDuration.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Variation</span>
                  <span className="font-semibold text-gray-800">
                    {cause.stdDeviation.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dernière</span>
                  <span className="font-semibold text-gray-800">
                    {cause.lastOccurrence}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Prédiction */}
        <div className="bg-gray-50 p-3 rounded-md">
          <h5 className="font-medium text-gray-900 mb-2 text-sm">Prédiction</h5>
          <div className="flex flex-col space-y-2">
            {/* Pour stops */}
            {cause.type !== 'SCRAP' && cause.type !== 'REWORK' && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Occurrence/sem.</span>
                  <span className="font-semibold text-gray-800">
                    {cause.occurrencePerWeek.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Severity</span>
                  <span className="font-semibold text-gray-800">
                    {cause.severityValue.toFixed(2)}
                  </span>
                </div>
              </>
            )}
            {/* Pour scrap/rework */}
            { (cause.type === 'SCRAP' || cause.type === 'REWORK') && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Affected (est.)</span>
                  <span className="font-semibold text-gray-800">
                    {cause.severityValue.toFixed(2)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Certainty</span>
              <span className="font-semibold text-gray-800">
                {cause.certainty} ({certaintyPct}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expected</span>
              <span className="font-semibold text-gray-800">{cause.expectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Weibull</span>
              <span className="font-semibold text-gray-800">
                (shape: {cause.weibullParams.shape.toFixed(2)}, scale: {cause.weibullParams.scale.toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------------------- Composant Principal : PredictiveInsights ---------------------

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

  // --------------------- fetchData : Récupération et traitement ---------------------
  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const { start, end, days } = getDateRange(timeRange);

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

      // 2) Récupération des lots (production)
      const { data: lotsData, error: lotsErr } = await supabase
        .from('lots')
        .select('id, machine, start_time, end_time, lot_size, ok_parts_produced')
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if (lotsErr) throw lotsErr;

      // Dictionnaire : machineId -> Set de dates (jours de production)
      const productionDatesByMachine: { [machineId: string]: Set<string> } = {};
      lotsData?.forEach(lot => {
        if (lot.machine) {
          if (!productionDatesByMachine[lot.machine]) {
            productionDatesByMachine[lot.machine] = new Set();
          }
          productionDatesByMachine[lot.machine].add(format(new Date(lot.start_time), 'yyyy-MM-dd'));
        }
      });

      // 3) Récupération des stop_events
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

      // 4) Récupération des quality_issues
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
          // Filtre improbable pour n'afficher que la catégorie demandée
          qualQ = qualQ.eq('category', '???');
        }
      }
      const { data: qualData, error: qualErr } = await qualQ;
      if (qualErr) throw qualErr;

      // 5) Traitement machine par machine
      const results: MachineHealth[] = [];

      for (const mach of machData) {
        const productionDates = productionDatesByMachine[mach.id] || new Set();
        if (productionDates.size === 0) continue;
        const productionDays = productionDates.size;

        const mLots = lotsData?.filter(l => l.machine === mach.id) || [];
        const mStops = stopsData?.filter(s => s.machine === mach.id) || [];
        const mQual = qualData?.filter(q => q.machine === mach.id) || [];

        // Calcul du sample (lots)
        let totalLots = 0, totalOk = 0;
        mLots.forEach(lot => {
          totalLots += lot.lot_size || 0;
          totalOk += lot.ok_parts_produced || 0;
        });

        // Calcul du downtime (Unplanned)
        let sumUnplannedMin = 0;
        mStops.forEach(stp => {
          const ft = mapStopFailureType(stp.failure_type);
          // On ignore AP (Planned)
          if (ft === 'AP') return;
          const sT = new Date(stp.start_time);
          let eT = stp.end_time ? new Date(stp.end_time) : end;
          if (eT > end) eT = end;
          sumUnplannedMin += differenceInMinutes(eT, sT);
        });
        const totalDowntimeH = sumUnplannedMin / 60;

        // Tri des stops par date
        const sortedStops = [...mStops].sort((a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
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

        // Durée d'ouverture quotidienne
        const dailyOpenMin = mach.opening_time_minutes || 480;
        const dailyOpenH = dailyOpenMin / 60;

        // Pondération exponentielle
        const computeWeight = (eventTime: Date) =>
          Math.exp((eventTime.getTime() - end.getTime()) / TAU_MS);

        // Agrégation par cause
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
        }
        const causeMap = new Map<string, CAgg>();

        // Traitement stops
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
              weightedSumSqDurH: 0
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
        }

        // Traitement qualité (Scrap/Rework)
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
              weightedQuantitySumSq: 0
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
          // Weighted qty
          cObj.weightedQuantitySum! += weight * qty;
          cObj.weightedQuantitySumSq! += weight * qty * qty;
          if (!cObj.lastOccurrence || qiT > cObj.lastOccurrence) {
            cObj.lastOccurrence = qiT;
          }
        }

        // Constitution du tableau de causes
        const causeList: FailureCause[] = [];
        causeMap.forEach(cObj => {
          const avgDuration = cObj.occurrences > 0 ? cObj.totalDurH / cObj.occurrences : 0;
          const variance = cObj.occurrences > 0
            ? (cObj.sumSqDurH / cObj.occurrences) - (avgDuration * avgDuration)
            : 0;
          const stdDeviation = Math.sqrt(Math.max(variance, 0));
          const variabilityIndex = avgDuration > 0 ? stdDeviation / avgDuration : 0;
          const lastOccurrenceStr = cObj.lastOccurrence
            ? format(cObj.lastOccurrence, 'yyyy-MM-dd')
            : 'N/A';

          const weightedOccurrence = cObj.weightedOccurrences;
          const weightedAvgDuration =
            weightedOccurrence > 0 ? cObj.weightedTotalDurH / weightedOccurrence : 0;
          const weightedVariance =
            weightedOccurrence > 0
              ? (cObj.weightedSumSqDurH / weightedOccurrence) - (weightedAvgDuration * weightedAvgDuration)
              : 0;
          const weightedStdDev = Math.sqrt(Math.max(weightedVariance, 0));

          let occurrencePerWeek = 0;
          let severityValue = 0;
          let predictedRiskScore = 0;
          let certainty = "";
          let expectedDate = "";
          let weibullParams = { shape: 1, scale: 0 };

          // Distinction stops vs. scrap/rework
          if (cObj.type === 'SCRAP' || cObj.type === 'REWORK') {
            // Qualité
            const weightedQuantity = cObj.weightedQuantitySum || 0;
            const weightedQuantitySq = cObj.weightedQuantitySumSq || 0;
            const avgParts = weightedOccurrence > 0 ? weightedQuantity / weightedOccurrence : 0;
            const varParts =
              weightedOccurrence > 0
                ? (weightedQuantitySq / weightedOccurrence) - (avgParts * avgParts)
                : 0;
            const stdDevParts = Math.sqrt(Math.max(varParts, 0));
            const variabilityIndexQuality = avgParts > 0 ? stdDevParts / avgParts : 0;
            const riskFactor = cObj.type === 'SCRAP' ? RISK_FACTOR_SCRAP : RISK_FACTOR_REWORK;
            // predictedRiskScore = (avgParts * DEFAULT_CYCLE_TIME + 2 * stdDevParts) * riskFactor
            predictedRiskScore = (avgParts * DEFAULT_CYCLE_TIME + 2 * stdDevParts) * riskFactor;
            severityValue = avgParts; // Nombre de pièces affectées (moyen)
            occurrencePerWeek = 0;    // Non pertinent
            // Certitude
            certainty =
              cObj.occurrences < 5
                ? "Insufficient Data"
                : variabilityIndexQuality > 1
                ? "Not Normal"
                : "High Certainty";
            expectedDate = format(new Date(), 'yyyy-MM-dd');
            weibullParams = {
              shape: variabilityIndexQuality > 0 ? Math.max(0.5, 1 / variabilityIndexQuality) : 1,
              scale: avgParts
            };
          } else {
            // Stops
            occurrencePerWeek = productionDays > 0 ? (weightedOccurrence * 7) / productionDays : 0;
            severityValue = weightedAvgDuration + 2 * weightedStdDev;
            predictedRiskScore =
              dailyOpenH > 0 ? (occurrencePerWeek * severityValue / dailyOpenH) * 100 : 0;
            // Certitude
            certainty =
              cObj.occurrences < 5
                ? "Insufficient Data"
                : variabilityIndex > 1
                ? "Not Normal"
                : "High Certainty";
            // Expected date
            expectedDate = format(
              addMinutes(new Date(), Math.log(2) / ((cObj.occurrences * 7) / productionDays)),
              'yyyy-MM-dd'
            );
            weibullParams = {
              shape: variabilityIndex > 0 ? Math.max(0.5, 1 / variabilityIndex) : 1,
              scale: weightedAvgDuration
            };
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
            weibullParams
          });
        });

        // Filtre par catégorie
        let finalCauseList = causeList;
        if (categoryFilter !== 'ALL') {
          finalCauseList = finalCauseList.filter(c => c.type === categoryFilter);
        }
        if (finalCauseList.length === 0) continue;
        const nextFail = format(new Date(), 'yyyy-MM-dd');

        // ----------------------------------------------------------------
        // Calcul du risque global machine
        // ----------------------------------------------------------------
        let machineRisk = 0;
        if (categoryFilter === 'SCRAP' || categoryFilter === 'REWORK') {
          // Si on filtre sur Scrap/Rework, on calcule le risque machine
          // en sommant les predictedRiskScore des causes Scrap/Rework
          let sumQualityRisk = 0;
          finalCauseList.forEach(c => {
            if (c.type === 'SCRAP' || c.type === 'REWORK') {
              sumQualityRisk += c.predictedRiskScore;
            }
          });
          machineRisk = sumQualityRisk;
        } else {
          // Risque machine "stops" classique
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
          const machineVar =
            machineStopCount > 0
              ? (sumSqStopH / machineStopCount) - ( (sumStopH / machineStopCount) ** 2 )
              : 0;
          const machineStdDev = Math.sqrt(Math.max(machineVar, 0));
          const machineAvgDur = machineStopCount > 0 ? sumStopH / machineStopCount : 0;
          const machineSeverity = machineAvgDur + 2 * machineStdDev;
          const productionDaysForStops = productionDays;
          const machineOccurrencePerWeek =
            productionDaysForStops > 0 ? (machineStopCount * 7) / productionDaysForStops : 0;
          machineRisk =
            dailyOpenH > 0 ? (machineOccurrencePerWeek * machineSeverity / dailyOpenH) * 100 : 0;
        }

        // Calcul total Scrap/Rework
        const machineTotalScrap = finalCauseList
          .filter(c => c.type === 'SCRAP')
          .reduce((sum, c) => sum + c.scrapCount, 0);
        const machineTotalRework = finalCauseList
          .filter(c => c.type === 'REWORK')
          .reduce((sum, c) => sum + c.reworkCount, 0);

        const machineObj: MachineHealth = {
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
        };

        results.push(machineObj);
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

  // --------------------- Rendu final ---------------------
  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
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
            <button
              onClick={() => alert('Export not implemented')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Filtres */}
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
            {FAILURE_TYPES.map(ft => (
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
        </div>

        {/* Affichage des Machines */}
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
          <div className="space-y-6">
            {machineList.map(mach => {
              const stopsLabel = `Stops (Last ${
                timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30
              } days)`;
              return (
                <div key={mach.id} className="bg-white shadow rounded-lg p-6">
                  {/* En-tête Machine */}
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
                      <div className="mt-1 text-lg font-semibold text-blue-600">
                        {mach.nextFailureGlobal}
                      </div>
                    </div>
                  </div>

                  {/* KPI (Stops vs. Quality) */}
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

                  {categoryFilter === 'ALL' || ['SCRAP', 'REWORK'].includes(categoryFilter) ? (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">Scrap</span>
                        <div className="mt-1 text-base font-semibold text-red-700">
                          {mach.totalScrap.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="text-xs text-gray-500">Rework</span>
                        <div className="mt-1 text-base font-semibold text-purple-700">
                          {mach.totalRework.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Liste des Causes */}
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
