import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { LotData, StopEvent, QualityIssue, LotTracking } from '../types';

interface DataState {
  lots: LotData[];
  lotTrackings: LotTracking[];
  stops: StopEvent[];
  quality: QualityIssue[];
  loading: boolean;
  error: string | null;
  importLots: (projectId: string, lots: LotData[]) => Promise<void>;
  importStops: (projectId: string, stops: StopEvent[]) => Promise<void>;
  importQuality: (projectId: string, quality: QualityIssue[]) => Promise<void>;
  createLot: (projectId: string, lotData: Partial<LotData>) => Promise<LotData>;
  addLotTracking: (lotId: string, trackingData: Partial<LotTracking>) => Promise<LotTracking>;
  getLotTrackings: (lotId: string) => Promise<LotTracking[]>;
  calculateTheoreticalLotSize: (startTime: string, endTime: string, cycleTime: number) => number;
  completeLot: (lotId: string) => Promise<void>;
  getLot: (lotId: string) => Promise<LotData | null>;
  getActiveLot: (projectId: string, userEmail: string) => Promise<any>;
  createStopEvent: (projectId: string, stopData: Partial<StopEvent>) => Promise<StopEvent>;
  getCommonCauses: (projectId: string) => Promise<string[]>;
  completeStopEvent: (stopId: string, endTime: string) => Promise<void>;
  getStopEvents: (lotId: string) => Promise<StopEvent[]>;
  createQualityIssue: (projectId: string, issueData: Partial<QualityIssue>) => Promise<QualityIssue>;
}

const formatDateTime = (date: string, time: string): string => {
  const [year, month, day] = date.split('-');
  const [hours, minutes] = time.split(':');
  return `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`;
};

export const useDataStore = create<DataState>((set, get) => ({
  lots: [],
  lotTrackings: [],
  stops: [],
  quality: [],
  loading: false,
  error: null,

  calculateTheoreticalLotSize: (startTime: string, endTime: string, cycleTime: number) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return Math.floor((durationMinutes * 60) / cycleTime);
  },

  getLot: async (lotId: string) => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('*')
        .eq('id', lotId)
        .single();

      if (error) throw error;
      return data as LotData;
    } catch (error) {
      console.error('Error fetching lot:', error);
      return null;
    }
  },

  getLotTrackings: async (lotId: string) => {
    try {
      const { data, error } = await supabase
        .from('lot_tracking')
        .select('*')
        .eq('lot_id', lotId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as LotTracking[];
    } catch (error) {
      console.error('Error fetching lot trackings:', error);
      return [];
    }
  },

  addLotTracking: async (lotId: string, trackingData: Partial<LotTracking>) => {
    try {
      set({ loading: true, error: null });

      const lot = await get().getLot(lotId);
      if (!lot) throw new Error('Lot not found');

      const startTime = formatDateTime(lot.date, trackingData.start_time!);
      const endTime = formatDateTime(lot.date, trackingData.end_time!);

      const newTracking = {
        lot_id: lotId,
        date: lot.date,
        start_time: startTime,
        end_time: endTime,
        parts_produced: trackingData.parts_produced || 0,
        comment: trackingData.comment
      };

      const { data: trackingResult, error: trackingError } = await supabase
        .from('lot_tracking')
        .insert([newTracking])
        .select()
        .single();

      if (trackingError) throw trackingError;

      const tracking = trackingResult as LotTracking;
      set((state) => ({
        lotTrackings: [...state.lotTrackings, tracking],
        loading: false
      }));

      return tracking;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add tracking';
      set({ error: message, loading: false });
      throw error;
    }
  },

  completeLot: async (lotId: string) => {
    try {
      set({ loading: true, error: null });

      const lot = await get().getLot(lotId);
      if (!lot) throw new Error('Lot not found');

      const trackings = await get().getLotTrackings(lotId);
      const totalPartsProduced = trackings.reduce((sum, t) => sum + t.parts_produced, 0);

      const { error } = await supabase
        .from('lots')
        .update({ 
          status: 'completed',
          ok_parts_produced: totalPartsProduced
        })
        .eq('id', lotId);

      if (error) throw error;

      set((state) => ({
        lots: state.lots.map(l => 
          l.id === lotId 
            ? { ...l, status: 'completed', ok_parts_produced: totalPartsProduced }
            : l
        ),
        loading: false
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete lot';
      set({ error: message, loading: false });
      throw error;
    }
  },

  createLot: async (projectId, lotData) => {
    try {
      set({ loading: true, error: null });

      if (!lotData.date || !lotData.start_time || !lotData.end_time || !lotData.product || !lotData.machine) {
        throw new Error('Missing required fields');
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user?.email) throw new Error('User not authenticated');

      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('email', userData.user.email)
        .eq('status', 'active');

      if (teamError) throw teamError;
      if (!teamMembers || teamMembers.length === 0) {
        throw new Error('No active team member found for current user');
      }

      const startTime = formatDateTime(lotData.date, lotData.start_time);
      const endTime = formatDateTime(lotData.date, lotData.end_time);

      const newLot = {
        project_id: projectId,
        date: lotData.date,
        start_time: startTime,
        end_time: endTime,
        team_member: teamMembers[0].id,
        product: lotData.product,
        machine: lotData.machine,
        lot_id: lotData.lot_id,
        lot_size: lotData.lot_size,
        ok_parts_produced: 0,
        comment: lotData.comment,
        status: 'in_progress'
      };

      const { data, error } = await supabase
        .from('lots')
        .insert([newLot])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create lot');

      const createdLot = data as LotData;
      set((state) => ({
        lots: [...state.lots, createdLot],
        loading: false,
        error: null
      }));

      return createdLot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create lot';
      set({ error: message, loading: false });
      throw error;
    }
  },

  importLots: async (projectId, lots) => {
    try {
      set({ loading: true, error: null });
      console.log("📦 Starting lots import with", lots.length, "lots");

      const [teamMembersResult, productsResult, machinesResult] = await Promise.all([
        supabase.from('team_members')
          .select('id, email')
          .eq('project_id', projectId),
        supabase.from('products')
          .select('id, name')
          .eq('project_id', projectId),
        supabase.from('machines')
          .select('id, name')
          .eq('project_id', projectId)
      ]);

      if (teamMembersResult.error) throw teamMembersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (machinesResult.error) throw machinesResult.error;

      const teamMembers = teamMembersResult.data || [];
      const products = productsResult.data || [];
      const machines = machinesResult.data || [];

      const teamMemberMap = new Map(
        teamMembers.map(tm => [tm.email.toLowerCase(), tm])
      );
      const productMap = new Map(
        products.map(p => [p.name.toLowerCase(), p])
      );
      const machineMap = new Map(
        machines.map(m => [m.name.toLowerCase(), m])
      );

      const lotsToInsert = lots.map((lot, index) => {
        const teamMember = teamMemberMap.get(lot.team_member.toLowerCase());
        const product = productMap.get(lot.product.toLowerCase());
        const machine = machineMap.get(lot.machine.toLowerCase());

        if (!teamMember) {
          throw new Error(`Row ${index + 1}: Team member not found: ${lot.team_member}`);
        }
        if (!product) {
          throw new Error(`Row ${index + 1}: Product not found: ${lot.product}`);
        }
        if (!machine) {
          throw new Error(`Row ${index + 1}: Machine not found: ${lot.machine}`);
        }

        if (!lot.lot_size || lot.lot_size < 1) {
          throw new Error(`Row ${index + 1}: Lot size must be greater than 0`);
        }

        if (lot.ok_parts_produced > lot.lot_size) {
          throw new Error(`Row ${index + 1}: OK parts produced (${lot.ok_parts_produced}) cannot exceed lot size (${lot.lot_size})`);
        }

        const startTime = formatDateTime(lot.date, lot.start_time);
        const endTime = formatDateTime(lot.date, lot.end_time);

        const now = new Date();
        const lotEndTime = new Date(endTime);
        const isCompleted = lotEndTime < now || lot.ok_parts_produced >= lot.lot_size;

        return {
          project_id: projectId,
          date: lot.date,
          start_time: startTime,
          end_time: endTime,
          team_member: teamMember.id,
          product: product.id,
          machine: machine.id,
          lot_id: lot.lot_id || `LOT-${lot.date}-${String(index + 1).padStart(3, '0')}`,
          lot_size: lot.lot_size,
          ok_parts_produced: lot.ok_parts_produced,
          status: isCompleted ? 'completed' : 'in_progress'
        };
      });

      console.log("📦 Inserting lots:", lotsToInsert);

      for (let i = 0; i < lotsToInsert.length; i += 100) {
        const batch = lotsToInsert.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('lots')
          .insert(batch);

        if (insertError) {
          console.error("❌ Error inserting lots:", insertError);
          throw insertError;
        }
      }

      console.log("✅ Successfully imported lots");
      set({ loading: false });
    } catch (error) {
      console.error('Error importing lots:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  importStops: async (projectId, stops) => {
    try {
      set({ loading: true, error: null });
      console.log("🛑 Starting stops import with", stops.length, "stops");

      const [teamMembersResult, productsResult, machinesResult] = await Promise.all([
        supabase.from('team_members')
          .select('id, email')
          .eq('project_id', projectId),
        supabase.from('products')
          .select('id, name')
          .eq('project_id', projectId),
        supabase.from('machines')
          .select('id, name')
          .eq('project_id', projectId)
      ]);

      if (teamMembersResult.error) throw teamMembersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (machinesResult.error) throw machinesResult.error;

      const teamMembers = teamMembersResult.data || [];
      const products = productsResult.data || [];
      const machines = machinesResult.data || [];

      const teamMemberMap = new Map(
        teamMembers.map(tm => [tm.email.toLowerCase(), tm])
      );
      const productMap = new Map(
        products.map(p => [p.name.toLowerCase(), p])
      );
      const machineMap = new Map(
        machines.map(m => [m.name.toLowerCase(), m])
      );

      // First get all lots to match with stops
      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select('id, date, start_time, end_time, product, machine, team_member')
        .eq('project_id', projectId);

      if (lotsError) throw lotsError;

      const stopsToInsert = stops.map((stop, index) => {
        const teamMember = teamMemberMap.get(stop.team_member.toLowerCase());
        const product = productMap.get(stop.product.toLowerCase());
        const machine = machineMap.get(stop.machine.toLowerCase());

        if (!teamMember) {
          throw new Error(`Row ${index + 1}: Team member not found: ${stop.team_member}`);
        }
        if (!product) {
          throw new Error(`Row ${index + 1}: Product not found: ${stop.product}`);
        }
        if (!machine) {
          throw new Error(`Row ${index + 1}: Machine not found: ${stop.machine}`);
        }

        const startTime = formatDateTime(stop.date, stop.start_time);
        const endTime = formatDateTime(stop.date, stop.end_time);

        // Find matching lot
        const matchingLot = lots?.find(lot => {
          const lotStart = new Date(lot.start_time);
          const lotEnd = lot.end_time ? new Date(lot.end_time) : new Date();
          const stopStart = new Date(startTime);
          const stopEnd = new Date(endTime);

          return (
            lot.machine === machine.id &&
            lot.product === product.id &&
            lot.team_member === teamMember.id &&
            ((stopStart >= lotStart && stopStart <= lotEnd) ||
             (stopEnd >= lotStart && stopEnd <= lotEnd))
          );
        });

        const now = new Date();
        const stopEndTime = new Date(endTime);
        const isCompleted = stopEndTime <= now;

        return {
          project_id: projectId,
          date: stop.date,
          start_time: startTime,
          end_time: endTime,
          team_member: teamMember.id,
          product: product.id,
          machine: machine.id,
          failure_type: stop.failure_type,
          cause: stop.cause,
          comment: stop.comment,
          lot_id: matchingLot?.id,
          status: isCompleted ? 'completed' : 'ongoing'
        };
      });

      for (let i = 0; i < stopsToInsert.length; i += 100) {
        const batch = stopsToInsert.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('stop_events')
          .insert(batch);

        if (insertError) throw insertError;
      }

      set({ loading: false });
    } catch (error) {
      console.error('Error importing stops:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  importQuality: async (projectId, quality) => {
    try {
      set({ loading: true, error: null });
      console.log("⚠️ Starting quality issues import with", quality.length, "issues");

      const [teamMembersResult, productsResult, machinesResult] = await Promise.all([
        supabase.from('team_members')
          .select('id, email')
          .eq('project_id', projectId),
        supabase.from('products')
          .select('id, name, cycle_time')
          .eq('project_id', projectId),
        supabase.from('machines')
          .select('id, name')
          .eq('project_id', projectId)
      ]);

      if (teamMembersResult.error) throw teamMembersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (machinesResult.error) throw machinesResult.error;

      const teamMembers = teamMembersResult.data || [];
      const products = productsResult.data || [];
      const machines = machinesResult.data || [];

      const teamMemberMap = new Map(
        teamMembers.map(tm => [tm.email.toLowerCase(), tm])
      );
      const productMap = new Map(
        products.map(p => [p.name.toLowerCase(), p])
      );
      const machineMap = new Map(
        machines.map(m => [m.name.toLowerCase(), m])
      );

      // First get all lots to match with quality issues
      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select('id, date, start_time, end_time, product, machine, team_member')
        .eq('project_id', projectId);

      if (lotsError) throw lotsError;

      const qualityToInsert = quality.map((issue, index) => {
        const teamMember = teamMemberMap.get(issue.team_member.toLowerCase());
        const product = productMap.get(issue.product.toLowerCase());
        const machine = machineMap.get(issue.machine.toLowerCase());

        if (!teamMember) {
          throw new Error(`Row ${index + 1}: Team member not found: ${issue.team_member}`);
        }
        if (!product) {
          throw new Error(`Row ${index + 1}: Product not found: ${issue.product}`);
        }
        if (!machine) {
          throw new Error(`Row ${index + 1}: Machine not found: ${issue.machine}`);
        }

        // Find matching lot
        const matchingLot = lots?.find(lot => {
          const lotDate = lot.date;
          return (
            lot.machine === machine.id &&
            lot.product === product.id &&
            lot.team_member === teamMember.id &&
            lotDate === issue.date
          );
        });

        const issueDate = new Date(issue.date);
        const now = new Date();
        const isHistorical = issueDate < now;

        const durationMinutes = (product.cycle_time * issue.quantity) / 60;
        
        const endTime = isHistorical 
          ? `${issue.date}T17:00:00.000Z`
          : null;

        const startTime = isHistorical
          ? new Date(new Date(endTime!).getTime() - (durationMinutes * 60 * 1000)).toISOString()
          : `${issue.date}T${new Date().toTimeString().slice(0, 8)}.000Z`;

        return {
          project_id: projectId,
          date: issue.date,
          start_time: startTime,
          end_time: endTime,
          status: isHistorical ? 'completed' : 'ongoing',
          team_member: teamMember.id,
          product: product.id,
          machine: machine.id,
          category: issue.category,
          quantity: issue.quantity,
          cause: issue.cause,
          comment: issue.comment,
          lot_id: matchingLot?.id
        };
      });

      for (let i = 0; i < qualityToInsert.length; i += 100) {
        const batch = qualityToInsert.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('quality_issues')
          .insert(batch);

        if (insertError) throw insertError;
      }

      set({ loading: false });
    } catch (error) {
      console.error('Error importing quality issues:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  getActiveLot: async (projectId: string, userEmail: string) => {
    try {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('email', userEmail)
        .single();

      if (!teamMember) return null;

      const { data: lot } = await supabase
        .from('lots')
        .select(`
          id,
          product,
          machine,
          team_member,
          products:product (name),
          machines:machine (name),
          team_members:team_member (email)
        `)
        .eq('project_id', projectId)
        .eq('team_member', teamMember.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!lot) return null;

      return {
        id: lot.id,
        product: lot.product,
        machine: lot.machine,
        team_member: lot.team_member,
        product_name: lot.products.name,
        machine_name: lot.machines.name,
        team_member_name: lot.team_members.email
      };
    } catch (error) {
      console.error('Error getting active lot:', error);
      return null;
    }
  },

  createStopEvent: async (projectId: string, stopData: Partial<StopEvent>) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('stop_events')
        .insert([{
          project_id: projectId,
          ...stopData
        }])
        .select()
        .single();

      if (error) throw error;

      const stopEvent = data as StopEvent;
      set((state) => ({
        stops: [...state.stops, stopEvent],
        loading: false
      }));

      return stopEvent;
    } catch (error) {
      console.error('Error creating stop event:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  getCommonCauses: async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_unique_failure_causes', { p_project_id: projectId });

      if (error) throw error;
      return (data as { cause: string }[]).map(row => row.cause);
    } catch (error) {
      console.error('Error getting common causes:', error);
      return [];
    }
  },

  completeStopEvent: async (stopId: string, endTime: string) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('stop_events')
        .update({
          end_time: endTime,
          status: 'completed'
        })
        .eq('id', stopId);

      if (error) throw error;

      set((state) => ({
        stops: state.stops.map(stop =>
          stop.id === stopId
            ? { ...stop, end_time: endTime, status: 'completed' }
            : stop
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error completing stop event:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  getStopEvents: async (lotId: string) => {
    try {
      const { data, error } = await supabase
        .from('stop_events')
        .select('*')
        .eq('lot_id', lotId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as StopEvent[];
    } catch (error) {
      console.error('Error fetching stop events:', error);
      return [];
    }
  },

  createQualityIssue: async (projectId: string, issueData: Partial<QualityIssue>) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('quality_issues')
        .insert([{
          project_id: projectId,
          ...issueData
        }])
        .select()
        .single();

      if (error) throw error;

      const qualityIssue = data as QualityIssue;
      set((state) => ({
        quality: [...state.quality, qualityIssue],
        loading: false
      }));

      return qualityIssue;
    } catch (error) {
      console.error('Error creating quality issue:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  }
}));