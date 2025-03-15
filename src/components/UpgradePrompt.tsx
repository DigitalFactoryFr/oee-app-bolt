import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useSubscriptionStore } from '../store/subscriptionStore';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe("pk_live_51R1mHfG3UtTNBuRxHWDBd3y73...");

interface UpgradePromptProps {
  // machineCount: number; // <- vous pouvez l'enlever si on gère tout localement
  className?: string;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ className = '' }) => {
  const { subscription, startCheckout } = useSubscriptionStore();

  // ►►► Ajout d'un state local pour le nombre de machines payantes désirées
  const [desiredMachineCount, setDesiredMachineCount] = useState(5);

  if (!subscription || subscription.status !== 'free') return null;

  const handleUpgrade = async () => {
    try {
      // ►►► On passe desiredMachineCount à la fonction startCheckout
      const sessionId = await startCheckout(desiredMachineCount);
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

      {/* ►►► Nouveau champ pour laisser l'utilisateur choisir son nombre de machines */}
      <div className="mb-4">
        <label htmlFor="machineCount" className="block text-sm font-medium">
          Number of machines you want to pay for
        </label>
        <input
          id="machineCount"
          type="number"
          min={1}
          value={desiredMachineCount}
          onChange={(e) => setDesiredMachineCount(Number(e.target.value))}
          className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900"
        />
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
