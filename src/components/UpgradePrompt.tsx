// UpgradePrompt.jsx
import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { loadStripe } from '@stripe/stripe-js';
import MachineCountModal from './MachineCountModal';

const stripePromise = loadStripe("pk_live_51R1mHfG3UtTNBuRxHWDBd3y73w3NmrCyrclE4nyNzMuj9KCkAkX7GzdFnpAD2m7NJ6XMSY1TDajYohs07UKOVifw00ZbomCm91");

const UpgradePrompt = ({ machineCount, className = '' }) => {
  const { subscription, startCheckout } = useSubscriptionStore();
  const [modalOpen, setModalOpen] = useState(false);

  if (!subscription || subscription.status !== 'free') return null;

  const handleConfirm = async (selectedMachineCount) => {
    try {
      setModalOpen(false);
      const sessionId = await startCheckout(selectedMachineCount);
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
    }
  };

  return (
    <>
      <div className={`bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 ${className}`}>
        <h3 className="text-xl font-bold mb-2">Upgrade to Pro</h3>
        <p className="mb-4">
          Get unlimited machines and advanced features for only €39/machine/month.
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="w-full bg-white text-blue-600 hover:bg-blue-50 font-medium py-2 px-4 rounded-md inline-flex items-center justify-center"
        >
          Upgrade Now
          <ArrowRight className="ml-2 h-4 w-4" />
        </button>
      </div>
      <MachineCountModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default UpgradePrompt;
