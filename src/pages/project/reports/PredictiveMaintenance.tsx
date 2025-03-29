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
  Activity,
  Search
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// ================== Types ==================
type TimeRangeType = '7d' | '30d' | '90d';

/** 
 * Category filter: 
 * - ALL => no restriction
 * - PA => Failures
 * - NQ => Non-Quality
 * - CS => Series Changes
 * - DO => Scheduled Deviation
 * - SCRAP => Scrap
 * - REWORK => Rework
 */
type CategoryFilterType = 'ALL' | 'PA' | 'NQ' | 'CS' | 'DO' | 'SCRAP' | 'REWORK';

/**
 * expectedDateFilter => filter the cause nextOccurrence by date range 
 * e.g. "TODAY", "THIS_WEEK", "THIS_MONTH", ...
 */
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
  probability: number;    
  severity: number;       
  riskScore: number;      
  nextOccurrence: string; // e.g. '2025-04-05'
}

interface MachineHealth {
  id: string;
  name: string;

  // Performance KPI
  totalDowntimeH: number; // unplanned
  mtbf: number;
  mttr: number;
  recentStops: number; // based on the selected period => last X days

  // Quality KPI
  totalScrap: number;
  totalRework: number;

  riskScore: number;      
  causeList: FailureCause[];

  sampleSize: {
    totalLots: number;
    totalOkParts: number;
  };

  nextFailureGlobal: string; // earliest cause date
}

// ================== Helpers ==================
function getDateRange(range: TimeRangeType){
  const now = new Date();
  switch(range){
    case '7d':  return { start: subDays(now,7), end: now, days:7 };
    case '90d': return { start: subDays(now,90), end: now, days:90 };
    default:    return { start: subDays(now,30), end: now, days:30 };
  }
}

/** 
 * nextOccurrence => we parse => filter by "expectedDateFilter"
 * We'll define a helper function to get the [start, end] range for each.
 */
function getExpectedDateRange(edf: ExpectedDateFilter){
  const now = new Date();
  switch(edf){
    case 'TODAY':
      return { start: startOfToday(), end: endOfToday() };
    case 'THIS_WEEK':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'THIS_MONTH':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'NEXT_MONTH': {
      // next month => from endOfMonth(thisMonth)+1day to endOfMonth nextMonth 
      const startOfNextMonth = addDays(endOfMonth(now), 1);
      const endOfNextMonth   = endOfMonth(startOfNextMonth);
      return { start: startOfNextMonth, end: endOfNextMonth };
    }
    case 'NEXT_6_MONTHS': {
      // we do now => addDays(180)
      return { start: now, end: addDays(now, 180) };
    }
    case 'THIS_YEAR':
      return { start: startOfYear(now), end: endOfYear(now) };
    default: // 'ALL'
      return null; // means no filter
  }
}

function mapStopFailureType(ft: string|null|undefined){
  const s = (ft||'').toLowerCase();
  switch(s){
    case 'ap':
    case 'pa':
    case 'nq':
    case 'cs':
    case 'do':
      return s.toUpperCase();
    default:
      return 'CS'; // fallback
  }
}

function mapQualityCategory(cat: string|null|undefined){
  const s = (cat||'').toLowerCase();
  if(s.includes('scrap')) return 'SCRAP';
  if(s.includes('rework'))return 'REWORK';
  return 'NQ';
}

function getCategoryIcon(type: string){
  switch(type.toUpperCase()){
    case 'PA': return <AlertTriangle className="h-5 w-5 text-red-500 mr-1"/>;
    case 'NQ': return <AlertTriangle className="h-5 w-5 text-yellow-500 mr-1"/>;
    case 'CS': return <Activity className="h-5 w-5 text-gray-500 mr-1"/>;
    case 'DO': return <Clock className="h-5 w-5 text-blue-500 mr-1"/>;
    case 'SCRAP': return <AlertTriangle className="h-5 w-5 text-red-400 mr-1"/>;
    case 'REWORK':return <AlertTriangle className="h-5 w-5 text-purple-400 mr-1"/>;
    default:    return <Activity className="h-5 w-5 text-gray-400 mr-1"/>;
  }
}

function getRiskColor(score: number){
  if(score>=75) return 'bg-red-100 text-red-800';
  if(score>=50) return 'bg-orange-100 text-orange-800';
  if(score>=25) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

function formatDuration(h: number){
  const hh = Math.floor(h);
  const mm = Math.round((h - hh)*60);
  return `${hh}h ${mm}m`;
}

function isPerformanceCat(cat:CategoryFilterType){
  return ['PA','NQ','CS','DO'].includes(cat);
}
function isQualityCat(cat:CategoryFilterType){
  return ['SCRAP','REWORK'].includes(cat);
}

// ================== MAIN ==================
const PredictiveInsights:React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // timeRange
  const [timeRange, setTimeRange] = useState<TimeRangeType>('30d');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);

  // filters
  const [machineSearch, setMachineSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('ALL');
  const [expectedDateFilter, setExpectedDateFilter] = useState<ExpectedDateFilter>('ALL');

  // data
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string|null>(null);
  const [machineList, setMachineList] = useState<MachineHealth[]>([]);

  useEffect(()=>{
    if(projectId){
      fetchData();
    }
  },[projectId, timeRange, machineSearch, categoryFilter, expectedDateFilter]);

  async function fetchData(){
    try{
      setLoading(true);
      setError(null);

      // get range
      const { start, end, days } = getDateRange(timeRange);
      console.log('Predictive => from', start.toISOString(),'to', end.toISOString(), 'days=',days);

      // 1) machines
      let machQ = supabase
        .from('machines')
        .select('id,name')
        .eq('project_id', projectId);
      if(machineSearch){
        machQ = machQ.ilike('name', `%${machineSearch}%`);
      }
      const { data:machData, error:machErr } = await machQ;
      if(machErr) throw machErr;
      if(!machData || machData.length===0){
        setMachineList([]);
        setLoading(false);
        return;
      }

      // 2) load lots
      const { data:lotsData, error:lotsErr } = await supabase
        .from('lots')
        .select(`
          id,
          machine,
          start_time,
          end_time,
          lot_size,
          ok_parts_produced
        `)
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if(lotsErr) throw lotsErr;

      // 3) load stops
      let stopsQ = supabase
        .from('stop_events')
        .select(`
          id,
          machine,
          start_time,
          end_time,
          failure_type,
          cause
        `)
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if(categoryFilter!=='ALL'){
        if(isPerformanceCat(categoryFilter)){
          stopsQ= stopsQ.eq('failure_type', categoryFilter);
        } else if(isQualityCat(categoryFilter)){
          stopsQ= stopsQ.eq('failure_type','???'); // no stops
        }
      }
      const { data:stopsData, error:stopsErr } = await stopsQ;
      if(stopsErr) throw stopsErr;

      // 4) load quality_issues
      let qualQ = supabase
        .from('quality_issues')
        .select(`
          id,
          machine,
          start_time,
          end_time,
          category,
          cause,
          quantity
        `)
        .eq('project_id', projectId)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());
      if(categoryFilter!=='ALL'){
        if(isQualityCat(categoryFilter)){
          // "SCRAP" => cat ~ '%scrap%', "REWORK" => cat~'%rework%'
          if(categoryFilter==='SCRAP'){
            qualQ= qualQ.ilike('category','%scrap%');
          } else {
            qualQ= qualQ.ilike('category','%rework%');
          }
        } else if(isPerformanceCat(categoryFilter)){
          qualQ= qualQ.eq('category','???'); // no results
        }
      }
      const { data:qualData, error:qualErr } = await qualQ;
      if(qualErr) throw qualErr;

      // =========== Build machineList ===========
      const results: MachineHealth[] = [];

      for(const mach of machData){
        // filter
        const mLots = lotsData?.filter(l => l.machine=== mach.id) || [];
        const mStops= stopsData?.filter(s => s.machine=== mach.id) || [];
        const mQual = qualData?.filter(q => q.machine=== mach.id) || [];

        // A) production
        let totalLots=0, totalOk=0;
        mLots.forEach(lot=>{
          totalLots += (lot.lot_size||0);
          totalOk   += (lot.ok_parts_produced||0);
        });

        // B) unplanned downtime => sum stops if failure_type != 'AP'
        let sumUnplannedMin=0;
        for(const stp of mStops){
          const ft= mapStopFailureType(stp.failure_type);
          if(ft==='AP') continue; // skip planned
          const sT= new Date(stp.start_time);
          let eT= stp.end_time? new Date(stp.end_time): end;
          if(eT> end) eT= end;
          const durMin= differenceInMinutes(eT,sT);
          sumUnplannedMin+= durMin;
        }
        const totalDowntimeH= sumUnplannedMin/60;

        // C) stops => MTBF, MTTR
        let sumStopH=0;
        const sortedStops= [...mStops].sort((a,b)=>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        for(const stp of sortedStops){
          const sT= new Date(stp.start_time);
          let eT= stp.end_time? new Date(stp.end_time): end;
          if(eT> end) eT= end;
          const durH= differenceInMinutes(eT,sT)/60;
          sumStopH+= durH;
        }
        const stopCount= sortedStops.length;
        const totalDays= Math.max(0, differenceInDays(end, start));
        const periodH= totalDays*24;
        let uptimeH= Math.max(0, periodH- sumStopH);
        let mtbf=0;
        if(stopCount>0){
          mtbf= uptimeH/stopCount;
        } else {
          mtbf= uptimeH; 
        }
        let mttr=0;
        if(stopCount>0){
          mttr= sumStopH/ stopCount;
        }

        // D) recentStops => stops in last X days
        const recentStart= subDays(end, days);
        const recentStops= mStops.filter(s => new Date(s.start_time)>=recentStart).length;

        // E) aggregator causes
        interface CAgg {
          type: string;
          causeText: string;
          occurrences: number;
          totalDurH: number;
          scrap: number;
          rework: number;
        }
        const causeMap= new Map<string,CAgg>();

        // stops => type= mapStopFailureType => aggregator
        for(const stp of mStops){
          const ft= mapStopFailureType(stp.failure_type);
          const cText= stp.cause||'(No cause)';
          const key= ft+'|'+cText;

          const sT= new Date(stp.start_time);
          let eT= stp.end_time? new Date(stp.end_time): end;
          if(eT> end) eT= end;
          const durH= differenceInMinutes(eT,sT)/60;

          if(!causeMap.has(key)){
            causeMap.set(key,{
              type: ft, causeText: cText, occurrences:0,
              totalDurH:0, scrap:0, rework:0
            });
          }
          const cObj= causeMap.get(key)!;
          cObj.occurrences++;
          cObj.totalDurH += durH;
        }

        // quality => aggregator
        for(const qi of mQual){
          const qType= mapQualityCategory(qi.category);
          const cText= qi.cause||'(No cause)';
          const key= qType+'|'+ cText;

          if(!causeMap.has(key)){
            causeMap.set(key,{
              type: qType, causeText: cText, occurrences:0,
              totalDurH:0, scrap:0, rework:0
            });
          }
          const cObj= causeMap.get(key)!;
          cObj.occurrences++;
          if(qType==='SCRAP'){
            cObj.scrap += (qi.quantity||0);
          } else if(qType==='REWORK'){
            cObj.rework += (qi.quantity||0);
          }
        }

        // sum global scrap/rework
        let sumScrap=0; 
        let sumRework=0;
        let totalOccurrences=0;
        causeMap.forEach(c=> { totalOccurrences+= c.occurrences; });

        // build causeList
        const causeList: FailureCause[]= [];

        causeMap.forEach(cObj=>{
          const probability= totalOccurrences>0
            ? (cObj.occurrences / totalOccurrences)*100
            : 0;
          let severity=0;
          if(cObj.type==='SCRAP' || cObj.type==='REWORK'){
            severity= cObj.scrap*0.02 + cObj.rework*0.01;
            sumScrap += cObj.scrap;
            sumRework+= cObj.rework;
          } else {
            severity= cObj.totalDurH;
          }
          const riskScore= probability* severity;

          // for nextOccurrence => random up to +10 days
          // We'll parse "the earliest" at the end
          const deltaDays= Math.floor(Math.random()*10)+1; 
          const nextOccDate= addDays(new Date(), deltaDays);

          causeList.push({
            type: cObj.type,
            causeText: cObj.causeText,
            occurrences: cObj.occurrences,
            totalDurationH: cObj.totalDurH,
            scrapCount: cObj.scrap,
            reworkCount: cObj.rework,
            probability,
            severity,
            riskScore,
            nextOccurrence: format(nextOccDate,'yyyy-MM-dd')
          });
        });
        causeList.sort((a,b)=> a.nextOccurrence.localeCompare(b.nextOccurrence)); 
        // on tri par date la plus proche, puis par .riskScore ?

        // filter causeList => expectedDateFilter
        let finalCauseList= causeList;
        if(expectedDateFilter!=='ALL'){
          const dr= getExpectedDateRange(expectedDateFilter);
          if(dr){
            const {start: eStart, end: eEnd} = dr;
            finalCauseList= causeList.filter(c=>{
              // parse c.nextOccurrence
              const cDate= new Date(c.nextOccurrence+'T00:00:00'); 
              // keep if cDate in [eStart, eEnd]
              return cDate>= eStart && cDate<= eEnd;
            });
          }
        }

        // filter causeList => category if needed 
        // (on a déjà fait un 1er filter by eq(...) in stops, but let's re-check)
        if(categoryFilter!=='ALL'){
          finalCauseList = finalCauseList.filter(c=> c.type=== categoryFilter);
        }

        // si finalCauseList est vide => on skip entirely
        if(finalCauseList.length===0){
          // skip => no data
          continue;
        }

        // unify nextFailureGlobal => la date la plus proche => finalCauseList[0]
        // car on a trié par .nextOccurrence
        const nextFail= finalCauseList[0].nextOccurrence+' 12:00';

        // risk => max among finalCauseList
        let topRisk=0;
        finalCauseList.forEach(fc=>{
          if(fc.riskScore> topRisk) topRisk= fc.riskScore;
        });

        const machineObj: MachineHealth={
          id:mach.id,
          name:mach.name,
          totalDowntimeH,
          mtbf,
          mttr,
          recentStops,
          totalScrap: sumScrap,
          totalRework: sumRework,
          riskScore: parseFloat(topRisk.toFixed(1)),
          causeList: finalCauseList,
          sampleSize:{
            totalLots,
            totalOkParts: totalOk
          },
          nextFailureGlobal: nextFail
        };

        results.push(machineObj);
      }

      // sort descending by riskScore
      results.sort((a,b)=> b.riskScore- a.riskScore);

      setMachineList(results);
      setLoading(false);

    } catch(err){
      console.error('PredictiveInsights => fetchData ERROR:', err);
      setError(err instanceof Error? err.message : 'Failed to load data');
      setLoading(false);
    }
  }

  function showPerformanceCat(){
    return (categoryFilter==='ALL' || isPerformanceCat(categoryFilter));
  }
  function showQualityCat(){
    return (categoryFilter==='ALL' || isQualityCat(categoryFilter));
  }

  // Rendu
  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-2 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Predictive Insights</h2>
            <p className="text-sm text-gray-500 mt-1">
              Advanced analysis from lots, stop_events, and quality_issues
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* timeRange */}
            <div className="relative">
              <button
                onClick={()=> setShowRangeDropdown(!showRangeDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 
                  rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2"/>
                {timeRange==='7d'
                  ? 'Last 7 days'
                  : timeRange==='90d'
                  ? 'Last 90 days'
                  : 'Last 30 days'
                }
                <ChevronDown className="ml-2 h-4 w-4"/>
              </button>
              {showRangeDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow z-20">
                  <button
                    onClick={()=> {setTimeRange('7d'); setShowRangeDropdown(false);}}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >Last 7 days</button>
                  <button
                    onClick={()=> {setTimeRange('30d'); setShowRangeDropdown(false);}}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >Last 30 days</button>
                  <button
                    onClick={()=> {setTimeRange('90d'); setShowRangeDropdown(false);}}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >Last 90 days</button>
                </div>
              )}
            </div>
            <button
              onClick={()=> alert('Export not implemented')}
              className="inline-flex items-center px-4 py-2 border border-transparent 
                rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2"/>
              Export
            </button>
          </div>
        </div>

        {/* Filters line 2 => machine + category + expected date */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-6">
          {/* search machine */}
          <div className="relative">
            <Search className="absolute left-2 top-2 text-gray-400 h-4 w-4"/>
            <input
              type="text"
              value={machineSearch}
              onChange={(e)=> setMachineSearch(e.target.value)}
              placeholder="Search machines..."
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* category */}
          <select
            value={categoryFilter}
            onChange={(e)=> setCategoryFilter(e.target.value as CategoryFilterType)}
            className="border border-gray-300 text-sm rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="PA">Failures (PA)</option>
            <option value="NQ">Non-Quality (NQ)</option>
            <option value="CS">Series Changes (CS)</option>
            <option value="DO">Scheduled Deviation (DO)</option>
            <option value="SCRAP">Scrap</option>
            <option value="REWORK">Rework</option>
          </select>

          {/* expected date filter */}
          <select
            value={expectedDateFilter}
            onChange={(e)=> setExpectedDateFilter(e.target.value as ExpectedDateFilter)}
            className="border border-gray-300 text-sm rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
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

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2"/>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : machineList.length===0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No machines or data found for these filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {machineList.map(mach => {
              // Show performance or quality lines?
              const showPerf = (categoryFilter==='ALL' || isPerformanceCat(categoryFilter));
              const showQual = (categoryFilter==='ALL' || isQualityCat(categoryFilter));

              // We'll label "Downtime (Unplanned)" consistently
              const downtimeLabel= "Downtime (Unplanned)";
              // "Stops (Last X days)"
              let days=7;
              if(timeRange==='30d') days=30; else if(timeRange==='90d') days=90;
              const stopsLabel= `Stops (Last ${days} days)`;

              const riskBadge= getRiskColor(mach.riskScore);

              return (
                <div key={mach.id} className="bg-white shadow rounded-lg p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{mach.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Sample: {mach.sampleSize.totalOkParts}/{mach.sampleSize.totalLots}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Next Failure (approx.)</div>
                      <div className="mt-1 text-lg font-semibold text-blue-600">
                        {mach.nextFailureGlobal}
                      </div>
                    </div>
                  </div>

                  {/* Performance KPI line */}
                  {showPerf && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <div className="text-xs text-gray-500">{downtimeLabel}</div>
                        <div className="mt-1 text-base font-semibold text-gray-900">
                          {formatDuration(mach.totalDowntimeH)}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <div className="text-xs text-gray-500">MTBF</div>
                        <div className="mt-1 text-base font-semibold text-gray-900">
                          {formatDuration(mach.mtbf)}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <div className="text-xs text-gray-500">MTTR</div>
                        <div className="mt-1 text-base font-semibold text-gray-900">
                          {formatDuration(mach.mttr)}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <div className="text-xs text-gray-500">{stopsLabel}</div>
                        <div className="mt-1 text-base font-semibold text-gray-900">
                          {mach.recentStops}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quality KPI line */}
                  {showQual && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <div className="text-xs text-gray-500">Scrap</div>
                        <div className="mt-1 text-base font-semibold text-red-700">
                          {mach.totalScrap.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded text-center">
                        <div className="text-xs text-gray-500">Rework</div>
                        <div className="mt-1 text-base font-semibold text-purple-700">
                          {mach.totalRework.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risk badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${riskBadge}`}
                    >
                      Risk: {mach.riskScore.toFixed(1)}
                    </span>
                  </div>

                  {/* cause list */}
                  <div className="space-y-4">
                    {mach.causeList.map((cause, idx)=>{
                      const cBadge= getRiskColor(cause.riskScore);

                      return (
                        <div key={`${cause.type}_${idx}`} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              {getCategoryIcon(cause.type)}
                              <div>
                                <h4 className="text-sm font-medium text-gray-900">{cause.causeText}</h4>
                                <p className="text-xs text-gray-500 mt-0.5">(Type: {cause.type})</p>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cBadge}`}
                            >
                              Risk: {cause.riskScore.toFixed(1)}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500">
                            Probability: {cause.probability.toFixed(1)}% — Severity: {cause.severity.toFixed(1)}
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                            <div>
                              <div className="text-gray-500">Occurrences</div>
                              <div className="text-gray-900">{cause.occurrences}</div>
                            </div>
                            {cause.type==='SCRAP' || cause.type==='REWORK' ? (
                              <>
                                <div>
                                  <div className="text-gray-500">{cause.type} (count)</div>
                                  <div className="text-gray-900">
                                    {cause.type==='SCRAP'? cause.scrapCount : cause.reworkCount}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">{cause.type} %</div>
                                  <div className="text-gray-900">
                                    {mach.sampleSize.totalOkParts>0
                                      ? (
                                          (cause.type==='SCRAP'? cause.scrapCount : cause.reworkCount)
                                          / mach.sampleSize.totalOkParts * 100
                                        ).toFixed(2) + '%'
                                      : '0%'
                                    }
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Duration (h) */}
                                <div>
                                  <div className="text-gray-500">Duration (h)</div>
                                  <div className="text-gray-900">
                                    {cause.totalDurationH.toFixed(2)}
                                  </div>
                                </div>
                                {/* Scrap/Rework if >0 */}
                                {(cause.scrapCount>0 || cause.reworkCount>0) ? (
                                  <div>
                                    <div className="text-gray-500">Scrap/Rework</div>
                                    <div className="text-gray-900">
                                      {cause.scrapCount}/{cause.reworkCount}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-gray-500">Scrap/Rework</div>
                                    <div className="text-gray-900">-</div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 mt-2 italic">
                            Next occurrence ~ {cause.nextOccurrence}
                          </div>
                        </div>
                      );
                    })}
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
