import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Machine, MachineExcelData } from '../types';

interface ImportResult {
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
      set({ machines, loading: false, error: null });
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
        loading: false,
        error: null
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
        loading: false,
        error: null
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
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error deleting machine:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

async bulkCreateMachines(projectId, machines) {
  try {
    set({ loading: true, error: null });

    // Récupérer toutes les production lines pour ce projet
    const { data: lines, error: linesError } = await supabase
      .from('production_lines')
      .select('id, name')
      .eq('project_id', projectId);

    if (linesError) throw linesError;

    if (!lines || lines.length === 0) {
      throw new Error('No production lines found for this project');
    }

    // Récupérer les machines existantes pour ce projet
    const { data: existingMachines, error: machinesError } = await supabase
      .from('machines')
      .select('*')
      .eq('project_id', projectId);

    if (machinesError) throw machinesError;

    // Créer une map pour rechercher rapidement les production lines par nom (en minuscule)
    const linesByName = new Map(lines.map(line => [line.name.toLowerCase(), line]));

    // Construire une map des machines existantes avec une clé basée sur (line_name + machine name)
    const existingMachinesByKey = new Map<string, any>();
    existingMachines?.forEach(machine => {
      const line = lines.find(l => l.id === machine.line_id);
      if (line) {
        const key = `${line.name.toLowerCase()}-${machine.name.toLowerCase()}`;
        existingMachinesByKey.set(key, machine);
      }
    });

    const duplicates: Array<{
      name: string;
      existing: Machine;
      new: Partial<Machine>;
    }> = [];
    const created: Machine[] = [];
    const errorsArray: Array<{ row: number; message: string }> = [];

    // Process each machine from the Excel file
    for (let i = 0; i < machines.length; i++) {
      const rowIndex = i + 2; // pour référence de ligne dans Excel
      const machine = machines[i];

      // Vérifier que line_name est présent ; sinon, ajouter une erreur et passer à la suite
      if (!machine.line_name) {
        errorsArray.push({
          row: rowIndex,
          message: `Production line is missing for machine "${machine.name}"`,
        });
        continue;
      }

      const lineNameKey = machine.line_name.trim().toLowerCase();
      const line = linesByName.get(lineNameKey);
      if (!line) {
        errorsArray.push({
          row: rowIndex,
          message: `Production line "${machine.line_name}" not found for machine "${machine.name}"`,
        });
        continue;
      }

      // Construire la clé unique (line_name + machine name)
      const key = `${lineNameKey}-${machine.name.toLowerCase()}`;
      const existingMachine = existingMachinesByKey.get(key);

      if (existingMachine) {
        duplicates.push({
          name: machine.name,
          existing: existingMachine,
          new: {
            description: machine.description,
            opening_time_minutes: machine.opening_time_minutes,
          },
        });
      } else {
        const { data, error } = await supabase
          .from('machines')
          .insert([
            {
              project_id: projectId,
              line_id: line.id,
              name: machine.name,
              description: machine.description,
              opening_time_minutes: machine.opening_time_minutes,
              status: 'in_progress',
            },
          ])
          .select()
          .single();

        if (error) {
          errorsArray.push({
            row: rowIndex,
            message: `Insert error for machine "${machine.name}": ${error.message}`,
          });
          continue;
        }
        if (data) {
          created.push(data as Machine);
        }
      }
    }

    // Mettre à jour l'état local
    set({ loading: false, error: null });
    return { duplicates, created, errors: errorsArray };
  } catch (error) {
    console.error('Error in bulkCreateMachines:', error);
    set({ error: (error as Error).message, loading: false });
    throw error;
  }
}


}));