import React from "react";
import { Check } from "lucide-react";
import { useSubscriptionStore } from '../store/subscriptionStore';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe("pk_live_51R1mHfG3UtTNBuRxHWDBd3y73w3NmrCyrclE4nyNzMuj9KCkAkX7GzdFnpAD2m7NJ6XMSY1TDajYohs07UKOVifw00ZbomCm91");

interface Feature {
  text: string;
  icon: React.ReactNode;
}

interface PricingPlan {
  name: string;
  subtitle: string;
  price: string;
  period: string;
  description: string;
  features: Feature[];
  cta: string;
  highlighted: boolean;
}

const PricingSection = () => {
  const { startCheckout } = useSubscriptionStore();

  const handleCheckout = async (machineCount: number) => {
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

  const plans: PricingPlan[] = [
    {
      name: "Free",
      subtitle: "Starter",
      price: "€0",
      period: "forever",
      description: "Perfect for small businesses starting with OEE tracking",
      features: [
        { text: "1 production line", icon: <Check className="h-4 w-4" /> },
        { text: "Up to 3 machines", icon: <Check className="h-4 w-4" /> },
        { text: "1 user", icon: <Check className="h-4 w-4" /> },
        { text: "Basic OEE dashboard", icon: <Check className="h-4 w-4" /> },
        { text: "Excel import/export", icon: <Check className="h-4 w-4" /> },
      ],
      cta: "Start for free",
      highlighted: false,
    },
    {
      name: "Pro",
      subtitle: "Per Machine",
      price: "€39",
      period: "per machine/month",
      description: "For businesses looking to optimize their production",
      features: [
        { text: "Unlimited production lines", icon: <Check className="h-4 w-4" /> },
        { text: "Pay per machine", icon: <Check className="h-4 w-4" /> },
        { text: "Advanced user management", icon: <Check className="h-4 w-4" /> },
        { text: "Machine connectivity (MQTT, SQL, REST API)", icon: <Check className="h-4 w-4" /> },
        { text: "Advanced dashboard with detailed KPIs", icon: <Check className="h-4 w-4" /> },
        { text: "Export to Excel, Power BI, ERP API", icon: <Check className="h-4 w-4" /> },
      ],
      cta: "14-day free trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      subtitle: "On-Premise",
      price: "Custom",
      period: "contact us",
      description: "Complete solution for large industrial enterprises",
      features: [
        { text: "All Pro features", icon: <Check className="h-4 w-4" /> },
        { text: "On-premise server installation", icon: <Check className="h-4 w-4" /> },
        { text: "Advanced configuration and full data access", icon: <Check className="h-4 w-4" /> },
        { text: "Dedicated support & custom integration", icon: <Check className="h-4 w-4" /> },
      ],
      cta: "Contact us",
      highlighted: false,
    }
  ];

  return (
    <div id="pricing" className="bg-gray-50 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base font-semibold text-blue-600 tracking-wide uppercase">Pricing</h2>
          <p className="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight">
            Choose the plan that fits your needs
          </p>
          <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
            Flexible solutions for industrial businesses of all sizes
          </p>
        </div>

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`${
                plan.highlighted 
                  ? 'border-2 border-blue-500 shadow-xl scale-105 z-10' 
                  : 'border border-gray-200'
              } rounded-lg shadow-sm divide-y divide-gray-200 bg-white`}
            >
              {plan.highlighted && (
                <div className="bg-blue-500 text-white text-center py-1 px-4 rounded-t-lg font-medium">
                  Recommended
                </div>
              )}
              <div className="p-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">{plan.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{plan.subtitle}</p>
                <p className="mt-4">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-base font-medium text-gray-500">/{plan.period}</span>
                </p>
                <p className="mt-4 text-sm text-gray-500">{plan.description}</p>

                {plan.name === 'Pro' ? (
                  <button
                    onClick={() => handleCheckout(1)}
                    className="mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {plan.cta}
                  </button>
                ) : (
                  <a
                    href={plan.name === 'Free' ? '/auth?mode=signup' : '#contact'}
                    className="mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    {plan.cta}
                  </a>
                )}
              </div>
              <div className="pt-6 pb-8 px-6">
                <h3 className="text-sm font-medium text-gray-900 tracking-wide uppercase">Included</h3>
                <ul className="mt-6 space-y-4">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex">
                      <div className="flex-shrink-0">{feature.icon}</div>
                      <p className="ml-3 text-base text-gray-500">{feature.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingSection;