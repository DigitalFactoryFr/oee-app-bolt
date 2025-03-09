import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ProductionLine } from '../types';

interface ImportResult {
  success: boolean;
  duplicates: Array<{
    name: string;
    existing: ProductionLine;
    new: Partial<ProductionLine>;
  }>;
  created: ProductionLine[];
}

interface ProductionLineState {
  lines: ProductionLine[];
  loading: boolean;
  error: string | null;
  fetchLines: (projectId: string) => Promise<void>;
  createLine: (projectId: string, plantConfigId: string, data: Partial<ProductionLine>) => Promise<ProductionLine | null>;
  updateLine: (id: string, data: Partial<ProductionLine>) => Promise<void>;
  deleteLine: (id: string) => Promise<void>;
  bulkCreateLines: (projectId: string, plantConfigId: string, lines: Partial<ProductionLine>[]) => Promise<ImportResult>;
  bulkUpdateLines: (lines: Array<{ id: string } & Partial<ProductionLine>>) => Promise<void>;
}

export const useProductionLineStore = create<ProductionLineState>((set, get) => ({
  lines: [],
  loading: false,
  error: null,

  fetchLines: async (projectId) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('production_lines')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      set({ lines: data as ProductionLine[], loading: false });
    } catch (error) {
      console.error('Error fetching production lines:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  createLine: async (projectId, plantConfigId, lineData) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('production_lines')
        .insert([{
          project_id: projectId,
          plant_config_id: plantConfigId,
          status: 'in_progress',
          ...lineData
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A production line with this name already exists');
        }
        throw error;
      }

      const newLine = data as ProductionLine;
      set((state) => ({
        lines: [...state.lines, newLine],
        loading: false
      }));

      return newLine;
    } catch (error) {
      console.error('Error creating production line:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  updateLine: async (id, lineData) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('production_lines')
        .update(lineData)
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('A production line with this name already exists');
        }
        throw error;
      }

      set((state) => ({
        lines: state.lines.map(line =>
          line.id === id ? { ...line, ...lineData } : line
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating production line:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  deleteLine: async (id) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('production_lines')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        lines: state.lines.filter(line => line.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting production line:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  bulkCreateLines: async (projectId, plantConfigId, newLines) => {
    try {
      set({ loading: true, error: null });

      // First, check for existing lines with the same names
      const { data: existingLines } = await supabase
        .from('production_lines')
        .select('*')
        .eq('project_id', projectId)
        .in('name', newLines.map(l => l.name));

      const existingLinesByName = (existingLines || []).reduce((acc, line) => {
        acc[line.name.toLowerCase()] = line;
        return acc;
      }, {} as Record<string, ProductionLine>);

      const duplicates: ImportResult['duplicates'] = [];
      const linesToCreate: Partial<ProductionLine>[] = [];

      newLines.forEach(line => {
        const existing = existingLinesByName[line.name.toLowerCase()];
        if (existing) {
          duplicates.push({
            name: line.name,
            existing,
            new: line
          });
        } else {
          linesToCreate.push({
            ...line,
            project_id: projectId,
            plant_config_id: plantConfigId,
            status: 'in_progress'
          });
        }
      });

      let created: ProductionLine[] = [];
      if (linesToCreate.length > 0) {
        const { data, error } = await supabase
          .from('production_lines')
          .insert(linesToCreate)
          .select();

        if (error) throw error;
        created = data as ProductionLine[];
      }

      // Update local state
      await get().fetchLines(projectId);

      return {
        success: duplicates.length === 0,
        duplicates,
        created
      };
    } catch (error) {
      console.error('Error bulk creating production lines:', error);
      set({ error: (error as Error).message, loading: false });
      return {
        success: false,
        duplicates: [],
        created: []
      };
    }
  },

  bulkUpdateLines: async (lines) => {
    try {
      set({ loading: true, error: null });

      for (const line of lines) {
        const { error } = await supabase
          .from('production_lines')
          .update(line)
          .eq('id', line.id);

        if (error) throw error;
      }

      set((state) => ({
        lines: state.lines.map(existingLine => {
          const update = lines.find(l => l.id === existingLine.id);
          return update ? { ...existingLine, ...update } : existingLine;
        }),
        loading: false
      }));
    } catch (error) {
      console.error('Error bulk updating production lines:', error);
      set({ error: (error as Error).message, loading: false });
    }
  }
}));