import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { sendEmail } from '../services/emailService';

const stripePromise = loadStripe("pk_live_51R1mHfG3UtTNBuRxHWDBd3y73w3NmrCyrclE4nyNzMuj9KCkAkX7GzdFnpAD2m7NJ6XMSY1TDajYohs07UKOVifw00ZbomCm91");

interface Subscription {
  id: string;
  project_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: 'free' | 'trial' | 'active' | 'past_due' | 'canceled';
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  machine_limit: number;
  created_at: string;
  updated_at: string;
}

interface SubscriptionState {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  fetchSubscription: (projectId: string) => Promise<void>;
  startCheckout: (machineCount: number) => Promise<string>;
  updateSubscription: (subscriptionId: string, data: Partial<Subscription>) => Promise<void>;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscription: null,
  loading: false,
  error: null,

fetchSubscription: async (projectId) => {
  try {
    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('project_id', projectId);
    
    console.log('Subscriptions returned:', data);
    console.log('Error:', error);

    // Si data est un tableau avec 0 ou plusieurs éléments, c'est la source du problème.
    set({ subscription: data && data.length === 1 ? data[0] : null, loading: false });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    set({ error: (error as Error).message, loading: false });
  }
}
,

  startCheckout: async (machineCount) => {
    try {
      set({ loading: true, error: null });

      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineCount })
      });

      const { id: sessionId } = await response.json();

      if (!sessionId) {
        throw new Error('Failed to create checkout session');
      }

      set({ loading: false });
      return sessionId;
    } catch (error) {
      console.error('Error starting checkout:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateSubscription: async (subscriptionId, data) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('subscriptions')
        .update(data)
        .eq('id', subscriptionId);

      if (error) throw error;

      set((state) => ({
        subscription: state.subscription
          ? { ...state.subscription, ...data }
          : null,
        loading: false
      }));
    } catch (error) {
      console.error('Error updating subscription:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  cancelSubscription: async (subscriptionId) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      if (error) throw error;

      set((state) => ({
        subscription: state.subscription
          ? { ...state.subscription, status: 'canceled' }
          : null,
        loading: false
      }));
    } catch (error) {
      console.error('Error canceling subscription:', error);
      set({ error: (error as Error).message, loading: false });
    }
  }
}));