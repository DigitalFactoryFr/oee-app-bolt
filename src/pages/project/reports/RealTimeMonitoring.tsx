import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  format,
  differenceInMinutes,
  startOfToday,
  startOfYesterday,
  subDays,
  subHours
} from 'date-fns';
import {
  Search,
  Zap,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

// ---------------------- Types ----------------------
type TimeRangeType = 'today' | 'yesterday' | '12h' | '24h' | '7d';

interface ProductionLine {
  id: string;
  name: string;
}
interface Machine {
  id: string;
  name: string;
  line_id: string;
}

interface TimelineEvent {
  id: string;
  type: 'production' | 'stop' | 'quality' | 'idle';
  machine: string;   // Nom de la machine
  startTime: string;
  endTime?: string;
  status: string;
  details: {
    product?: string;
    lotId?: string;
    cause?: string;
    category?: string;
  };
}

// Ce qu’on veut afficher côté “OEE” simplifié
interface MachineMetrics {
  oee: number;             // 0..100
  availability: number;    // 0..100
  performance: number;     // 0..100
  quality: number;         // 0..100

  partsProduced: number;
  defects: number;

  status: 'running'|'stopped'|'idle';
  // Pour accumuler data avant calcul final
  dateMap?: Map<string, {
    plannedTime: number;
    plannedStops: number;
    unplannedStops: number;
    netTimeSec: number;
    okParts: number;
    scrapParts: number;
  }>;
}

// ================================================================
const RealTimeMonitoring: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Pour *ne plus dépendre* d’un store qui renvoie vide, on charge direct.
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  // Filtre Lignes
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]); // multi
  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);

  // Timeline & metrics
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [machineMetrics, setMachineMetrics] = useState<Record<string,MachineMetrics>>({});

  // timeRange => calcul startTime
  const [timeRange, setTimeRange] = useState<TimeRangeType>('12h');

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  // Filtre sur le nom ou status
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState<'all'|'running'|'stopped'>('all');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ================== useEffects ==================
  // 1) Charger lines+machines en direct
  useEffect(() => {
    if(!projectId) return;
    loadLinesAndMachines();
  }, [projectId]);

  // 2) S’abonner en real-time
  useEffect(() => {
    if(!projectId) return;
    const subscription = supabase
      .channel('real-time-changes')
      .on(
        'postgres_changes',
        { event: '*', schema:'public', table:'lots', filter:`project_id=eq.${projectId}` },
        ()=> fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema:'public', table:'stop_events', filter:`project_id=eq.${projectId}` },
        ()=> fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema:'public', table:'quality_issues', filter:`project_id=eq.${projectId}` },
        ()=> fetchData()
      )
      .subscribe();

    return ()=> { subscription.unsubscribe(); };
  }, [projectId]);

  // 3) fetch quand line/timeRange change
  useEffect(() => {
    fetchData();
    // Optionnel: un setInterval si besoin
  }, [selectedLine, selectedFilters, timeRange]);

  // 4) fermer dropdown si clic extérieur
  useEffect(() => {
    function handleClickOutside(e:MouseEvent){
      if(dropdownRef.current && !dropdownRef.current.contains(e.target as Node)){
        setLineDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return ()=> document.removeEventListener('mousedown', handleClickOutside);
  },[]);

  // =============== loadLinesAndMachines ===============
  async function loadLinesAndMachines(){
    try{
      if(!projectId) return;
      const [linRes, machRes] = await Promise.all([
        supabase.from('production_lines')
          .select('id, name')
          .eq('project_id', projectId),
        supabase.from('machines')
          .select('id, name, line_id')
          .eq('project_id', projectId)
      ]);
      if(linRes.error) throw linRes.error;
      if(machRes.error) throw machRes.error;

      setLines(linRes.data || []);
      setMachines(machRes.data || []);
       handleSelectAllLines();
      console.log('>> loadLinesAndMachines => lines:', linRes.data, ' machines:', machRes.data);
    } catch(err){
      console.error('loadLinesAndMachines ERROR:', err);
    }
  }

  function handleSelectAllLines() {
  // on vide selectedFilters, on met selectedLine="all"
  setSelectedFilters([]);
  setSelectedLine('all');
  setLineDropdownOpen(false);
}


  // =============== getStartTime ===============
  function getStartTime(now:Date){
    switch(timeRange){
      case 'today':
        return startOfToday();
      case 'yesterday':
        return startOfYesterday();
      case '12h':
        return subHours(now,12);
      case '24h':
        return subHours(now,24);
      case '7d':
        return subDays(now,7);
      default:
        return subHours(now,12);
    }
  }

  // =============== fetchData ===============
  async function fetchData(){
    if(!projectId) return;
    try{
      setLoading(true);
      setError(null);

      console.log('=== fetchData() start ===');
      console.log('selectedLine=', selectedLine, 'selectedFilters=', selectedFilters);

      const now = new Date();
      const startTime = getStartTime(now);

      // Charger lots/stops/quality
      let lotsQ = supabase.from('lots')
        .select(`
          id,
          start_time,
          end_time,
          product:products(name, cycle_time),
          machine:machines(id, name, line_id),
          lot_id,
          ok_parts_produced,
          lot_size,
          status
        `)
        .eq('project_id', projectId)
        .gte('start_time', startTime.toISOString());

      let stopsQ = supabase.from('stop_events')
        .select(`
          id,
          start_time,
          end_time,
          machine:machines(id, name, line_id),
          failure_type,
          cause,
          status
        `)
        .eq('project_id', projectId)
        .gte('start_time', startTime.toISOString());

      let qualityQ = supabase.from('quality_issues')
        .select(`
          id,
          start_time,
          end_time,
          machine:machines(id, name, line_id),
          category,
          cause,
          status,
          quantity
        `)
        .eq('project_id', projectId)
        .gte('start_time', startTime.toISOString());

      // Appliquer filtre lignes
      let lineIDs:string[]=[];
      if(selectedLine==='all' && selectedFilters.length>0){
        lineIDs=[...selectedFilters];
      } else if(selectedLine!=='all'){
        lineIDs=[selectedLine];
      }
      if(lineIDs.length>0){
        lotsQ = lotsQ.in('machine.line_id', lineIDs);
        stopsQ= stopsQ.in('machine.line_id', lineIDs);
        qualityQ= qualityQ.in('machine.line_id', lineIDs);
      }

      const [lotsRes, stopsRes, qualityRes] = await Promise.all([
        lotsQ, stopsQ, qualityQ
      ]);
      if(lotsRes.error) throw lotsRes.error;
      if(stopsRes.error) throw stopsRes.error;
      if(qualityRes.error) throw qualityRes.error;

      // Construire timeline + metrics
      const events: TimelineEvent[] = [];
      const metrics: Record<string,MachineMetrics> = {};

      // init metrics pour chaque machine
      machines.forEach(m=>{
        metrics[m.id] = {
          oee:0, availability:0, performance:0, quality:100,
          partsProduced:0, defects:0,
          status:'idle',
          dateMap:new Map()
        };
        // event idle
        events.push({
          id:`idle-${m.id}`,
          type:'idle',
          machine:m.name,
          startTime:startTime.toISOString(),
          endTime: now.toISOString(),
          status:'idle',
          details:{}
        });
      });

      // ========== LOTS ==========
      lotsRes.data?.forEach((lot:any)=>{
          if (!lot.machine) return;

        const mid = lot.machine.id;
        const mName= lot.machine.name;
        events.push({
          id: lot.id,
          type:'production',
          machine: mName,
          startTime: lot.start_time,
          endTime: lot.end_time || now.toISOString(),
          status: lot.status,
          details:{
            product: lot.product?.name,
            lotId: lot.lot_id
          }
        });
        const M = metrics[mid];
        if(!M) return;

        // borne
        let s=new Date(lot.start_time);
        let e= lot.end_time? new Date(lot.end_time): now;
        if(s<startTime) s= startTime;
        if(e> now) e= now;
        const durMin = Math.max(0, differenceInMinutes(e,s));

        // dayStr par ex
        const dayStr= format(s,'yyyy-MM-dd');
        if(!M.dateMap?.has(dayStr)){
          M.dateMap?.set(dayStr,{
            plannedTime:0, plannedStops:0, unplannedStops:0,
            netTimeSec:0, okParts:0, scrapParts:0
          });
        }
        const obj = M.dateMap?.get(dayStr)!;
        obj.plannedTime+= durMin;

        if(lot.product?.cycle_time && lot.ok_parts_produced>0){
          obj.netTimeSec+=(lot.ok_parts_produced* lot.product.cycle_time);
        }
        obj.okParts+= lot.ok_parts_produced;
        M.partsProduced+= lot.ok_parts_produced;

        M.status='running';
      });

      // ========== STOPS ==========
      stopsRes.data?.forEach((stop:any)=>{
        const mid=stop.machine.id;
        const mName=stop.machine.name;
        events.push({
          id: stop.id,
          type:'stop',
          machine: mName,
          startTime: stop.start_time,
          endTime: stop.end_time || now.toISOString(),
          status: stop.status,
          details:{
            cause: `${stop.failure_type}: ${stop.cause}`
          }
        });
        const M= metrics[mid];
        if(!M) return;

        if(!stop.end_time) M.status='stopped';

        let s=new Date(stop.start_time);
        let e=stop.end_time? new Date(stop.end_time): now;
        if(s<startTime) s=startTime;
        if(e> now) e= now;
        const durMin= Math.max(0, differenceInMinutes(e,s));
        const dayStr= format(s,'yyyy-MM-dd');
        if(!M.dateMap?.has(dayStr)){
          M.dateMap?.set(dayStr,{
            plannedTime:0, plannedStops:0, unplannedStops:0,
            netTimeSec:0, okParts:0, scrapParts:0
          });
        }
        const obj=M.dateMap?.get(dayStr)!;
        // si failure_type==='PA' => plannedStop
        if(stop.failure_type==='PA'){
          obj.plannedStops+= durMin;
        } else {
          obj.unplannedStops+= durMin;
        }
      });

      // ========== QUALITY ==========
      qualityRes.data?.forEach((issue:any)=>{
        const mid= issue.machine.id;
        const mName= issue.machine.name;
        events.push({
          id: issue.id,
          type:'quality',
          machine: mName,
          startTime: issue.start_time,
          endTime: issue.end_time|| now.toISOString(),
          status: issue.status,
          details:{
            category: issue.category,
            cause: issue.cause
          }
        });
        const M= metrics[mid];
        if(!M) return;

        let s=new Date(issue.start_time);
        if(s<startTime) s=startTime;
        const dayStr= format(s,'yyyy-MM-dd');
        if(!M.dateMap?.has(dayStr)){
          M.dateMap?.set(dayStr,{
            plannedTime:0, plannedStops:0, unplannedStops:0,
            netTimeSec:0, okParts:0, scrapParts:0
          });
        }
        const obj=M.dateMap?.get(dayStr)!;
        if(issue.category==='scrap'){
          obj.scrapParts+= issue.quantity;
          M.defects+= issue.quantity;
        }
      });

      // ========== Calcul final OEE (A,P,Q) ==========
      Object.keys(metrics).forEach((mid)=>{
        const M= metrics[mid];
        if(!M.dateMap) return;
        let dayCount=0;
        let sumA=0, sumP=0, sumQ=0, sumOEE=0;

        M.dateMap.forEach((vals, dayStr)=>{
          const plannedProdTime= Math.max(0, vals.plannedTime - vals.plannedStops);
          const runTime= Math.max(0, vals.plannedTime - vals.unplannedStops);

          let A=0;
          if(plannedProdTime>0){
            A= (runTime/ plannedProdTime)* 100;
          }
          const netMin= vals.netTimeSec/60;
          let P=0;
          if(runTime>0){
            P= (netMin/runTime)* 100;
            if(P>100) P=100; 
          }
          const totParts= vals.okParts+ vals.scrapParts;
          let Q= (totParts>0) ? (vals.okParts/totParts)*100 :100;

          // OEE en [0..100], => (A%*P%*Q%)/100 => ou /10000, attention
          // En OEEReport, c’était (A * P * Q)/1000000 => c’est pareil, c’est un ratio
          // ici on fait plus simple:
          const dailyOEE= (A * P * Q)/(100*100);
          // => ou dailyOEE= (A/100)*(P/100)*(Q/100)*100 => [0..100]
          if(totParts>0){
            dayCount++;
            sumA+=A; sumP+=P; sumQ+=Q; sumOEE+=dailyOEE;
          }
        });

        if(dayCount>0){
          M.availability= sumA/dayCount;
          M.performance= sumP/dayCount;
          M.quality= sumQ/dayCount;
          M.oee= sumOEE/dayCount;
        }
      });

      // on stock
      setTimelineEvents(events);
      setMachineMetrics(metrics);
      setLoading(false);

    } catch(err){
      console.error('fetchData error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    }
  }

  // =============== Filtrer machines ===============
  const filteredMachines = machines
    .filter(m=>{
      // Filtre line
      if(selectedLine==='all' && selectedFilters.length===0){
        return true;
      } else if(selectedLine==='all' && selectedFilters.length>0){
        return selectedFilters.includes(m.line_id);
      } else {
        return m.line_id=== selectedLine;
      }
    })
    .filter(m=>{
      // searchTerm + status
      const mm= machineMetrics[m.id];
      if(!mm) return false; // machine n’a pas de metrics => pas d’événements
      const matchesSearch= m.name.toLowerCase().includes(searchTerm.toLowerCase());
      if(machineFilter==='all') return matchesSearch;
      if(machineFilter==='running') return matchesSearch && mm.status==='running';
      if(machineFilter==='stopped') return matchesSearch && mm.status==='stopped';
      return false;
    });

  // =============== Timeline rendering ===============
  function getEventColor(evtType:string){
    switch(evtType){
      case 'production': return 'bg-green-500';
      case 'stop':       return 'bg-red-500';
      case 'quality':    return 'bg-yellow-500';
      case 'idle':       return 'bg-gray-300';
      default:           return 'bg-gray-400';
    }
  }
  function getMachineStatusColor(st:string){
    switch(st){
      case 'running': return 'bg-green-100 text-green-800';
      case 'stopped': return 'bg-red-100 text-red-800';
      default:        return 'bg-gray-100 text-gray-800';
    }
  }
  function getMachineStatusIcon(st:string){
    switch(st){
      case 'running': return <CheckCircle className="h-4 w-4"/>;
      case 'stopped': return <XCircle className="h-4 w-4"/>;
      default:        return <Clock className="h-4 w-4"/>;
    }
  }

  function renderTimeline(){
    const now= new Date();
    const start= getStartTime(now);

    // param => slotWidth, slotInterval, totalHours
    let slotWidth=120, slotInterval=1, formatPattern='HH:mm', totalHours=12;

    if(timeRange==='today'){
      // from startOfToday to now
      totalHours= Math.ceil((now.getTime()-start.getTime())/3600000);
      slotWidth=80; slotInterval=2; formatPattern='HH:mm';
    }
    else if(timeRange==='yesterday'){
      // 24h => on peut ajuster
      totalHours=24; slotWidth=80; slotInterval=2; formatPattern='HH:mm';
    }
    else if(timeRange==='12h'){
      totalHours=12; slotWidth=120; slotInterval=1; formatPattern='HH:mm';
    }
    else if(timeRange==='24h'){
      totalHours=24; slotWidth=80; slotInterval=2; formatPattern='HH:mm';
    }
    else if(timeRange==='7d'){
      totalHours=168; slotWidth=100; slotInterval=12; formatPattern='MM/dd HH:mm';
    }
    const totalSlots= Math.ceil(totalHours/slotInterval);
    const totalWidth= Math.max(1200, slotWidth*totalSlots);

    const timeSlots: Date[]=[];
    for(let i=0; i< totalSlots; i++){
      timeSlots.push(new Date(start.getTime()+ i*slotInterval*3600000));
    }

    return (
      <div className="relative">
        {/* header */}
        <div
          className="flex border-b border-gray-200 sticky top-0 bg-white z-10"
          style={{ width: `${totalWidth}px` }}
        >
          <div className="w-64 flex-shrink-0 p-4 font-medium text-gray-700 bg-gray-50">
            Machine
          </div>
          <div className="flex-1 flex">
            {timeSlots.map((t,i)=>(
              <div
                key={i}
                className="flex-shrink-0 p-4 text-sm text-gray-500 text-center border-l border-gray-200"
                style={{ width: slotWidth, minWidth: slotWidth }}
              >
                {format(t, formatPattern)}
              </div>
            ))}
          </div>
        </div>

        {/* body rows */}
        <div style={{ width: `${totalWidth}px` }}>
          {filteredMachines.map(m=>{
            const mm= machineMetrics[m.id];
            const rowEvents= timelineEvents.filter(e=> e.machine=== m.name);

            return (
              <div key={m.id} className="flex border-b border-gray-200">
                {/* info */}
                <div className="w-64 flex-shrink-0 p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{m.name}</div>
                    <span className={
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium "
                      + getMachineStatusColor(mm?.status || 'idle')
                    }>
                      {getMachineStatusIcon(mm?.status || 'idle')}
                      <span className="ml-1 capitalize">{mm?.status||'idle'}</span>
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="font-medium text-gray-900">{mm?.oee.toFixed(1)}%</div>
                      <div className="text-gray-500">OEE</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{mm?.partsProduced}</div>
                      <div className="text-gray-500">Parts</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{mm?.defects}</div>
                      <div className="text-gray-500">Defects</div>
                    </div>
                  </div>
                </div>

                {/* timeline */}
                <div className="flex-1 relative min-h-[4rem]">
                  {/* vertical lines */}
                  <div className="absolute inset-0 flex">
                    {timeSlots.map((_, i)=>(
                      <div
                        key={i}
                        className="flex-shrink-0 border-l border-gray-200"
                        style={{ width: slotWidth, minWidth: slotWidth}}
                      />
                    ))}
                  </div>

                  {rowEvents.map(evt=>{
                    const sTime= new Date(evt.startTime);
                    const eTime= evt.endTime? new Date(evt.endTime): now;
                    const totalMin= totalHours*60;
                    const offset= differenceInMinutes(sTime, start);
                    const dur= differenceInMinutes(eTime, sTime);

                    const left= (offset/totalMin)* totalWidth;
                    const width= (dur/totalMin)* totalWidth;
                    const adjLeft= Math.max(0, left);
                    const adjWidth= Math.min(totalWidth- adjLeft, width);

                    if(adjWidth<=0 || adjLeft>= totalWidth) return null;
                    return (
                      <div
                        key={evt.id}
                        className={`absolute h-8 rounded ${getEventColor(evt.type)} opacity-75 cursor-pointer transition-opacity hover:opacity-100`}
                        style={{
                          left: adjLeft,
                          width: adjWidth,
                          top:'50%', transform:'translateY(-50%)'
                        }}
                        title={`${evt.type}: ${evt.details.cause || evt.details.product || 'Idle'}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =============== UI: dropdown lines ===============
  function toggleLineDropdown(){
    setLineDropdownOpen(!lineDropdownOpen);
  }
  function handleSelectAllLines(){
    console.log('handleSelectAllLines => CLEAR');
    setSelectedFilters([]);
    setSelectedLine('all');
    setLineDropdownOpen(false);
  }
  function handleFilterSelect(lineId: string){
    console.log('handleFilterSelect => lineId:', lineId);
    if(selectedFilters.includes(lineId)){
      setSelectedFilters(prev=> prev.filter(x=> x!==lineId));
    } else {
      setSelectedFilters(prev=> [...prev, lineId]);
    }
    setSelectedLine('all');
  }

  // =============== RENDER ===============
  return (
    <ProjectLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">

          {/* Gauche: line + search + status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">

            {/* All lines dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleLineDropdown}
                className={
                  (selectedLine==='all' && selectedFilters.length===0)
                    ? 'px-4 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700'
                    : 'px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              >
                {(selectedLine==='all' && selectedFilters.length===0) ? 'All Lines' : 'Select Lines'}
              </button>
              {lineDropdownOpen && (
                <div className="absolute mt-2 w-48 bg-white rounded-md shadow-lg z-20">
                  <button
                    onClick={handleSelectAllLines}
                    className={
                      (selectedLine==='all' && selectedFilters.length===0)
                        ? 'w-full text-left px-4 py-2 text-sm bg-blue-50 text-blue-700'
                        : 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50'
                    }
                  >
                    All Lines
                  </button>
                  <div className="border-t my-1" />
                  {lines.map(line=>{
                    const isSelected = selectedFilters.includes(line.id);
                    return (
                      <button
                        key={line.id}
                        onClick={()=> handleFilterSelect(line.id)}
                        className={
                          isSelected
                            ? 'w-full text-left px-4 py-2 text-sm bg-blue-50 text-blue-700'
                            : 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50'
                        }
                      >
                        {line.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search machine */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="h-4 w-4"/>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={e=> setSearchTerm(e.target.value)}
                placeholder="Search machines..."
                className="pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Filter by machine status */}
            <select
              value={machineFilter}
              onChange={e=> setMachineFilter(e.target.value as 'all'|'running'|'stopped')}
              className="py-2 px-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>

          {/* Droite: timeRange + "Live" label */}
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={e=> setTimeRange(e.target.value as TimeRangeType)}
              className="py-2 px-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="12h">Last 12 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
            <div className="flex items-center text-sm text-gray-500">
              <Zap className="h-4 w-4 mr-1"/>
              Live
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading timeline</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling:'touch' }}>
                {renderTimeline()}
              </div>
            )}

            {/* Légende */}
            <div className="mt-4 flex items-center space-x-6">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Production</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Stops</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Quality Issues</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-300 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Idle</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default RealTimeMonitoring;
