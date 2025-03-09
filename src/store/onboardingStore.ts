import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { OnboardingStep } from '../types';
import { Factory, Settings, Cpu, Package, Users, Database } from 'lucide-react';

interface OnboardingState {
  currentStep: string;
  steps: OnboardingStep[];
  loading: boolean;
  error: string | null;
  setCurrentStep: (step: string) => void;
  updateStepStatus: (stepId: string, status: 'pending' | 'in_progress' | 'completed') => void;
  getStepStatus: (projectId: string, stepId: string) => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 'plant',
  steps: [
    {
      id: 'plant',
      title: 'Plant Configuration',
      description: 'Configure your plant settings',
      status: 'pending',
      icon: Factory
    },
    {
      id: 'lines',
      title: 'Production Lines',
      description: 'Set up your production lines',
      status: 'pending',
      icon: Settings
    },
    {
      id: 'machines',
      title: 'Machines',
      description: 'Configure your machines',
      status: 'pending',
      icon: Cpu
    },
    {
      id: 'products',
      title: 'Products',
      description: 'Add your products',
      status: 'pending',
      icon: Package
    },
    {
      id: 'teams',
      title: 'Teams',
      description: 'Set up your teams',
      status: 'pending',
      icon: Users
    },
    {
      id: 'data',
      title: 'Data Connection',
      description: 'Configure data sources',
      status: 'pending',
      icon: Database
    }
  ],
  loading: false,
  error: null,

  setCurrentStep: (step) => {
    set({ currentStep: step });
    const steps = get().steps.map(s => ({
      ...s,
      status: s.id === step ? 'in_progress' : s.status
    }));
    set({ steps });
  },

  updateStepStatus: (stepId, status) => {
    const steps = get().steps.map(step => 
      step.id === stepId ? { ...step, status } : step
    );
    set({ steps });
  },

  getStepStatus: async (projectId, stepId) => {
    try {
      set({ loading: true });
      const { data, error } = await supabase
        .from('plant_configs')
        .select('status')
        .eq('project_id', projectId)
        .single();

      if (error) throw error;

      if (data) {
        const status = data.status as 'pending' | 'in_progress' | 'completed';
        get().updateStepStatus(stepId, status);
      }

      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  }
}));