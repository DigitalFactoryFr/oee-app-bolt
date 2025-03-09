import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  
  signIn: async (email, password) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        set({ 
          user: {
            id: data.user.id,
            email: data.user.email || '',
          },
          loading: false 
        });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  signUp: async (email, password) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        set({ 
          user: {
            id: data.user.id,
            email: data.user.email || '',
          },
          loading: false 
        });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  signOut: async () => {
    try {
      set({ loading: true });
      await supabase.auth.signOut();
      set({ user: null, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  getUser: async () => {
    try {
      set({ loading: true });
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        set({ user: null, loading: false });
        return;
      }
      
      if (data.user) {
        set({ 
          user: {
            id: data.user.id,
            email: data.user.email || '',
          },
          loading: false 
        });
      } else {
        set({ user: null, loading: false });
      }
    } catch (error) {
      set({ user: null, loading: false });
    }
  },
}));