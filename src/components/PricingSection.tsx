import React from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const PricingSection = () => {
  const plans = [
    {
      name: "Free",
      price: "€0",
      period: "forever",
      description: "Perfect for small businesses starting with OEE tracking",
      cta: "Start for free",
      link: "/auth?mode=signup",
      highlighted: false,
      features: [
        { text: "1 project / 1 plant", icon: <Check className="h-4 w-4" /> },
        { text: "Up to 3 machines", icon: <Check className="h-4 w-4" /> },
        { text: "1 user", icon: <Check className="h-4 w-4" /> },
        { text: "Basic OEE dashboard", icon: <Check className="h-4 w-4" /> },
        { text: "Excel import/export", icon: <Check className="h-4 w-4" /> },
      ],
    },
    {
      name: "Pro",
      price: "€39",
      period: "per machine/month",
      description: "For businesses looking to optimize their production",
      cta: "14-day free trial",
      link: "/auth?mode=signup",
      highlighted: true,
      features: [
        { text: "Multi project", icon: <Check className="h-4 w-4" /> },
        { text: "Pay per machine", icon: <Check className="h-4 w-4" /> },
        { text: "Advanced user management", icon: <Check className="h-4 w-4" /> },
        { text: "Machine connectivity (MQTT, SQL, REST API)", icon: <Check className="h-4 w-4" /> },
        { text: "Advanced dashboard with detailed KPIs", icon: <Check className="h-4 w-4" /> },
        { text: "Export to Excel, Power BI, ERP API", icon: <Check className="h-4 w-4" /> },
      ],
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "contact us",
      description: "Complete solution for large industrial enterprises",
      cta: "Contact us",
      link: "https://i40pilot.app/contact",
      highlighted: false,
      features: [
        { text: "All Pro features", icon: <Check className="h-4 w-4" /> },
        { text: "On-premise server installation", icon: <Check className="h-4 w-4" /> },
        { text: "Advanced configuration and full data access", icon: <Check className="h-4 w-4" /> },
        { text: "Dedicated support & custom integration", icon: <Check className="h-4 w-4" /> },
      ],
    },
  ];

  return (
    <div id="pricing" className="bg-gray-50 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base font-semibold uppercase tracking-wide text-blue-600">
            Pricing
          </h2>
          <p className="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight">
            Choose the plan that fits your needs
          </p>
          <p className="mt-5 mx-auto max-w-xl text-xl text-gray-500">
            Flexible solutions for industrial businesses of all sizes
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`${
                plan.highlighted
                  ? "border-2 border-blue-500 shadow-xl scale-105 z-10"
                  : "border border-gray-200"
              } rounded-lg shadow-sm bg-white flex flex-col`}
            >
              {plan.highlighted && (
                <div className="bg-blue-500 text-white py-1 px-4 rounded-t-lg font-medium text-center">
                  Recommended
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-2 text-4xl font-extrabold text-gray-900">{plan.price}</p>
                  <p className="text-gray-500">{plan.period}</p>
                  <p className="mt-4 text-sm text-gray-500">{plan.description}</p>
                </div>

                {/* Lien CTA */}
                {plan.link.startsWith("http") ? (
                  <a
                    href={plan.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-6 block w-full py-3 px-6 rounded-md text-center font-medium ${
                      plan.name === "Enterprise"
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    to={plan.link}
                    className={`mt-6 block w-full py-3 px-6 rounded-md text-center font-medium ${
                      plan.name === "Enterprise"
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>

              <div className="pt-6 pb-8 px-6 text-left">
                <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-4">
                  Included
                </h4>
                <ul className="space-y-4">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center">
                      {feature.icon}
                      <p className="ml-2 text-base text-gray-500">{feature.text}</p>
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
