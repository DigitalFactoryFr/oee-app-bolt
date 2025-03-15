import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../services/emailService';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getUser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  /** 🔹 Connexion avec email et mot de passe */
  signIn: async (email, password) => {
    try {
      set({ loading: true, error: null });
      console.log("[AuthStore] 🔄 Tentative de connexion...");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        console.log("[AuthStore] ✅ Connexion réussie :", data.user);
        set({
          user: {
            id: data.user.id,
            email: data.user.email || ''
          },
          loading: false
        });
      }
    } catch (error) {
      console.error("[AuthStore] ❌ Erreur de connexion :", error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  /** 🔹 Inscription avec email et mot de passe */
  signUp: async (email, password) => {
    try {
      set({ loading: true, error: null });
      console.log("[AuthStore] 🔄 Tentative d'inscription...");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://i40pilot.app/auth/callback'
        }
      });

      if (error) throw error;

      if (data?.user) {
        console.log("[AuthStore] ✅ Inscription réussie :", data.user);

        // 🔹 Envoi d’un email de bienvenue uniquement si l'utilisateur est bien créé
        await sendEmail(
          email,
          'Welcome to Pilot!',
          'WELCOME',
          { email }
        );

        set({
          user: {
            id: data.user.id,
            email: data.user.email || ''
          },
          loading: false
        });
      }
    } catch (error) {
      console.error("[AuthStore] ❌ Erreur d'inscription :", error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  /** 🔹 Déconnexion */
  signOut: async () => {
    try {
      set({ loading: true });
      console.log("[AuthStore] 🚪 Déconnexion en cours...");

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      console.log("[AuthStore] ✅ Déconnexion réussie !");
      set({ user: null, loading: false });
    } catch (error) {
      console.error("[AuthStore] ❌ Erreur de déconnexion :", error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  /** 🔹 Récupération de l'utilisateur */
getUser: async () => {
  try {
    set({ loading: true, error: null });
    console.log("[AuthStore] 🔍 Vérification de la session utilisateur...");

    // 🔹 Récupérer l'utilisateur avec la session active
    const { data: session, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.session) {
      console.warn("[AuthStore] ⚠️ Session absente ou expirée. Tentative de récupération...");

      // 🔹 Rafraîchir la session
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error("[AuthStore] ❌ Impossible de rafraîchir la session :", refreshError);
        set({ user: null, loading: false, error: "Session expired. Please log in again." });
        return;
      }
    }

    // 🔹 Récupérer les infos utilisateur après refresh
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[AuthStore] ❌ Erreur lors de la récupération de l'utilisateur :", userError);
      set({ user: null, loading: false, error: userError?.message || "User not found." });
      return;
    }

    console.log("[AuthStore] ✅ Utilisateur récupéré :", user);
    set({
      user: {
        id: user.id,
        email: user.email || ''
      },
      loading: false
    });
  } catch (error) {
    console.error("[AuthStore] ❌ Erreur inattendue :", error);
    set({ user: null, loading: false, error: (error as Error).message });
  }
},


  /** 🔹 Connexion avec Google */
signInWithGoogle: async () => {
  try {
    set({ loading: true, error: null });
    console.log("[AuthStore] 🌍 Connexion avec Google en cours...");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://i40pilot.app/auth/callback'
      }
    });

    if (error) throw error;

    console.log("[AuthStore] ✅ Redirection vers Google réussie.");

    // ✅ Sauvegarder la session après la connexion
    setTimeout(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData.session));
        console.log("[AuthStore] ✅ Session enregistrée dans localStorage.");
      }

      await useAuthStore.getState().getUser();
    }, 3000);
  } catch (error) {
    console.error("[AuthStore] ❌ Erreur lors de la connexion avec Google :", error);
    set({ error: (error as Error).message, loading: false });
  }
},

}));
