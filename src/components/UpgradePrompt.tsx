import React from "react";
import { ArrowRight } from "lucide-react";
import { useSubscriptionStore } from '../store/subscriptionStore';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe("pk_live_51R1mHfG3UtTNBuRxHWDBd3y73w3NmrCyrclE4nyNzMuj9KCkAkX7GzdFnpAD2m7NJ6XMSY1TDajYohs07UKOVifw00ZbomCm91");

interface UpgradePromptProps {
  machineCount: number;
  className?: string;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ machineCount, className = '' }) => {
  const { subscription, startCheckout } = useSubscriptionStore();

  if (!subscription || subscription.status !== 'free') return null;

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

  return (
    <div className={`bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 ${className}`}>
      <h3 className="text-xl font-bold mb-2">Upgrade to Pro</h3>
      <p className="mb-4">
        Get unlimited machines and advanced features for only €39/machine/month
      </p>
      <div className="space-y-3 mb-6">
        <div className="flex items-center">
          <div className="h-5 w-5 rounded-full bg-blue-400 flex items-center justify-center mr-2">
            <span className="text-sm">✓</span>
          </div>
          <span>Unlimited production lines</span>
        </div>
        <div className="flex items-center">
          <div className="h-5 w-5 rounded-full bg-blue-400 flex items-center justify-center mr-2">
            <span className="text-sm">✓</span>
          </div>
          <span>Advanced analytics and reporting</span>
        </div>
        <div className="flex items-center">
          <div className="h-5 w-5 rounded-full bg-blue-400 flex items-center justify-center mr-2">
            <span className="text-sm">✓</span>
          </div>
          <span>Priority support</span>
        </div>
      </div>
      <button
        onClick={handleUpgrade}
        className="w-full bg-white text-blue-600 hover:bg-blue-50 font-medium py-2 px-4 rounded-md inline-flex items-center justify-center"
      >
        Upgrade Now
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </div>
  );
};

export default UpgradePrompt;