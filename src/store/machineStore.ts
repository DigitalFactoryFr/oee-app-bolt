import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Machine, MachineExcelData } from '../types';

interface ImportResult {
  success: boolean;
  duplicates: Array<{
    name: string;
    existing: Machine;
    new: Partial<Machine>;
  }>;
  created: Machine[];
}

interface MachineState {
  machines: Machine[];
  loading: boolean;
  error: string | null;
  fetchMachines: (projectId: string) => Promise<Machine[]>;
  createMachine: (projectId: string, lineId: string, data: Partial<Machine>) => Promise<Machine | null>;
  updateMachine: (id: string, data: Partial<Machine>) => Promise<void>;
  deleteMachine: (id: string) => Promise<void>;
  bulkCreateMachines: (projectId: string, machines: MachineExcelData[]) => Promise<ImportResult>;
  bulkUpdateMachines: (updates: Array<{ id: string } & Partial<Machine>>) => Promise<void>;
}

export const useMachineStore = create<MachineState>((set, get) => ({
  machines: [],
  loading: false,
  error: null,

  fetchMachines: async (projectId) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const machines = data as Machine[];
      set({ machines, loading: false });
      return machines;
    } catch (error) {
      console.error('Error fetching machines:', error);
      set({ error: (error as Error).message, loading: false });
      return [];
    }
  },

  createMachine: async (projectId, lineId, machineData) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('machines')
        .insert([{
          project_id: projectId,
          line_id: lineId,
          status: 'in_progress',
          ...machineData
        }])
        .select()
        .single();

      if (error) throw error;

      const newMachine = data as Machine;
      set((state) => ({
        machines: [...state.machines, newMachine],
        loading: false
      }));

      return newMachine;
    } catch (error) {
      console.error('Error creating machine:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  updateMachine: async (id, machineData) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('machines')
        .update(machineData)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        machines: state.machines.map(machine =>
          machine.id === id ? { ...machine, ...machineData } : machine
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating machine:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteMachine: async (id) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        machines: state.machines.filter(machine => machine.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting machine:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  bulkCreateMachines: async (projectId, machines) => {
    try {
      set({ loading: true, error: null });
      console.log("🚀 Starting bulk machine creation...");

      // 1. Récupérer toutes les lignes de production
      const { data: lines, error: linesError } = await supabase
        .from('production_lines')
        .select('id, name')
        .eq('project_id', projectId);

      if (linesError) throw linesError;

      if (!lines || lines.length === 0) {
        throw new Error('No production lines found for this project');
      }

      // 2. Récupérer toutes les machines existantes
      const { data: existingMachines, error: machinesError } = await supabase
        .from('machines')
        .select('*')
        .eq('project_id', projectId);

      if (machinesError) throw machinesError;

      // 3. Créer les maps pour la recherche rapide
      const linesByName = new Map(lines.map(line => [line.name.toLowerCase(), line]));
      const existingMachinesByKey = new Map();
      
      existingMachines?.forEach(machine => {
        const line = lines.find(l => l.id === machine.line_id);
        if (line) {
          const key = `${line.name.toLowerCase()}-${machine.name.toLowerCase()}`;
          existingMachinesByKey.set(key, machine);
        }
      });

      // 4. Préparer les résultats
      const duplicates: Array<{
        name: string;
        existing: Machine;
        new: Partial<Machine>;
      }> = [];
      const created: Machine[] = [];
      const toCreate: Partial<Machine>[] = [];

      // 5. Traiter chaque machine
      for (const machine of machines) {
        const line = linesByName.get(machine.line_name.toLowerCase());
        
        if (!line) {
          throw new Error(`Production line "${machine.line_name}" not found`);
        }

        const key = `${machine.line_name.toLowerCase()}-${machine.name.toLowerCase()}`;
        const existingMachine = existingMachinesByKey.get(key);

        if (existingMachine) {
          duplicates.push({
            name: machine.name,
            existing: existingMachine,
            new: {
              description: machine.description,
              opening_time_minutes: machine.opening_time_minutes,
            }
          });
        } else {
          toCreate.push({
            project_id: projectId,
            line_id: line.id,
            name: machine.name,
            description: machine.description,
            opening_time_minutes: machine.opening_time_minutes,
            status: 'in_progress'
          });
        }
      }

      // 6. Créer les nouvelles machines
      if (toCreate.length > 0) {
        const { data, error } = await supabase
          .from('machines')
          .insert(toCreate)
          .select();

        if (error) throw error;
        if (data) created.push(...(data as Machine[]));
      }

      // 7. Mettre à jour l'état local
      if (created.length > 0) {
        set((state) => ({
          machines: [...state.machines, ...created],
          loading: false
        }));
      }

      return {
        success: true,
        duplicates,
        created
      };

    } catch (error) {
      console.error('Error in bulkCreateMachines:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  bulkUpdateMachines: async (updates) => {
    try {
      set({ loading: true, error: null });

      for (const update of updates) {
        const { error } = await supabase
          .from('machines')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      set((state) => ({
        machines: state.machines.map(existingMachine => {
          const update = updates.find(u => u.id === existingMachine.id);
          return update ? { ...existingMachine, ...update } : existingMachine;
        }),
        loading: false
      }));
    } catch (error) {
      console.error('Error bulk updating machines:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  }
}));