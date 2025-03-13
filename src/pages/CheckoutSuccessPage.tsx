import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, Check } from 'lucide-react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { sendEmail } from '../services/emailService';

const CheckoutSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateSubscription } = useSubscriptionStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      if (!sessionId) {
        setError('Invalid checkout session');
        setLoading(false);
        return;
      }

      try {
        // Get session details from your backend
        const response = await fetch('/.netlify/functions/get-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        const { subscription, customer } = await response.json();

        if (!subscription || !customer) {
          throw new Error('Invalid session data');
        }

        // Update subscription in database
        await updateSubscription(subscription.id, {
          status: 'active',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customer.id,
          current_period_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
          machine_limit: subscription.quantity
        });

        // Send confirmation email
        await sendEmail(
          customer.email,
          'Welcome to Pilot Pro!',
          'SUBSCRIPTION_STARTED',
          {
            machineCount: subscription.quantity,
            nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString()
          }
        );

        // Redirect to dashboard after short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } catch (err) {
        console.error('Error processing checkout:', err);
        setError(err instanceof Error ? err.message : 'Failed to process checkout');
      } finally {
        setLoading(false);
      }
    };

    processCheckout();
  }, [searchParams, navigate, updateSubscription]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex items-center justify-center">
            <Activity className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Processing your subscription...
          </h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex items-center justify-center">
            <Activity className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {error}
          </p>
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center">
          <Check className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Thank you for subscribing!
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Your subscription has been activated. Redirecting you to the dashboard...
        </p>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;