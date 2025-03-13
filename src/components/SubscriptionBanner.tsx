import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe("pk_live_51R1mHfG3UtTNBuRxHWDBd3y73w3NmrCyrclE4nyNzMuj9KCkAkX7GzdFnpAD2m7NJ6XMSY1TDajYohs07UKOVifw00ZbomCm91");

interface SubscriptionBannerProps {
  machineCount: number;
}

const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({ machineCount }) => {
  const { subscription, startCheckout } = useSubscriptionStore();

  if (!subscription) return null;

  const handleUpgrade = async () => {
    try {
      const sessionId = await startCheckout(machineCount);
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
    }
  };

  if (subscription.status === 'free' && machineCount >= subscription.machine_limit) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              You've reached the free tier limit of {subscription.machine_limit} machines.
              <button
                onClick={handleUpgrade}
                className="ml-2 font-medium text-yellow-700 underline hover:text-yellow-600"
              >
                Upgrade now
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (subscription.status === 'trial' && subscription.trial_ends_at) {
    const trialEnds = new Date(subscription.trial_ends_at);
    const daysLeft = Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 7) {
      return (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Your trial ends in {daysLeft} days.
                <button
                  onClick={handleUpgrade}
                  className="ml-2 font-medium text-blue-700 underline hover:text-blue-600"
                >
                  Upgrade now
                </button>
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  if (subscription.status === 'past_due') {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <X className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              Your subscription payment is past due.
              <button
                onClick={handleUpgrade}
                className="ml-2 font-medium text-red-700 underline hover:text-red-600"
              >
                Update payment method
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (subscription.status === 'active') {
    return (
      <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <Check className="h-5 w-5 text-green-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-green-700">
              Pro subscription active • {machineCount} machine{machineCount !== 1 ? 's' : ''} • €{machineCount * 39}/month
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;