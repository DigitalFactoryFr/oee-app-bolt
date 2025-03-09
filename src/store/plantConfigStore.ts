import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { PlantConfig } from '../types';

interface PlantConfigState {
  plantConfig: PlantConfig | null;
  loading: boolean;
  error: string | null;
  fetchPlantConfig: (projectId: string) => Promise<void>;
  createPlantConfig: (projectId: string, data: Partial<PlantConfig>) => Promise<PlantConfig | null>;
  updatePlantConfig: (id: string, data: Partial<PlantConfig>) => Promise<void>;
}

export const usePlantConfigStore = create<PlantConfigState>((set) => ({
  plantConfig: null,
  loading: false,
  error: null,

  fetchPlantConfig: async (projectId) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('plant_configs')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle(); // Use maybeSingle instead of single to handle no results

      if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows returned" error
      set({ plantConfig: data as PlantConfig | null, loading: false });
    } catch (error) {
      console.error('Error fetching plant config:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  createPlantConfig: async (projectId, configData) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('plant_configs')
        .insert([{ 
          project_id: projectId,
          status: 'in_progress',
          ...configData 
        }])
        .select()
        .single();

      if (error) throw error;

      const newConfig = data as PlantConfig;
      set({ plantConfig: newConfig, loading: false });
      return newConfig;
    } catch (error) {
      console.error('Error creating plant config:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  updatePlantConfig: async (id, configData) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('plant_configs')
        .update(configData)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        plantConfig: state.plantConfig
          ? { ...state.plantConfig, ...configData }
          : null,
        loading: false
      }));
    } catch (error) {
      console.error('Error updating plant config:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
}));