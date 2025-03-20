import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Gauge, Zap } from "lucide-react";

const Hero = () => {
  useEffect(() => {
    // Vérifier si l'URL contient un hash (#features ou #pricing) => scroll
    const hash = window.location.hash;
    if (hash) {
      const id = hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 150);
      }
    }
  }, []);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Colonne gauche : texte + CTA */}
        <div className="relative flex flex-col justify-center px-6 py-16 sm:py-20 lg:py-24 bg-gray-900">
          <div className="max-w-xl mx-auto text-white">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight">
              <span className="block">Optimize your</span>
              <span className="block text-blue-400">industrial production</span>
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-lg">
              Track your OEE performance in real-time, identify bottlenecks, and improve your operational efficiency with our complete industrial monitoring solution.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <Link
                to="/auth?mode=signup"
                className="inline-flex items-center justify-center px-6 py-3 text-lg font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow"
              >
                Start for free
              </Link>
              <a
                href="https://i40pilot.app/#pricing"
                className="inline-flex items-center justify-center px-6 py-3 text-lg font-medium rounded-md text-gray-900 bg-white hover:bg-gray-50 shadow"
              >
                View demo
              </a>
            </div>
          </div>
        </div>

        {/* Colonne droite : image + overlay */}
        <div className="relative h-96 lg:h-auto">
          <img
            className="absolute inset-0 w-full h-full object-cover"
            src="https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?ixlib=rb-1.2.1&auto=format&fit=crop&w=2100&q=80"
            alt="Modern factory with dashboards"
          />
          <div className="absolute inset-0 bg-gray-900 bg-opacity-40" />
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="bg-white py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-base font-semibold uppercase tracking-wide text-blue-600">
            Features
          </h2>
          <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            A complete solution for your industry
          </p>
          <p className="mx-auto mt-5 max-w-prose text-xl text-gray-500">
            Everything you need to track and improve your industrial performance.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Real-time OEE tracking",
                icon: Gauge,
                description:
                  "Visualize your performance indicators in real-time and make informed decisions immediately.",
              },
              {
                title: "Advanced analytics",
                icon: BarChart3,
                description:
                  "Identify trends, compare performance, and generate detailed reports to optimize your production.",
              },
              {
                title: "Easy integration",
                icon: Zap,
                description:
                  "Connect to your machines via MQTT, SQL, or REST API and easily import/export your data with Excel.",
              },
            ].map((feature, index) => (
              <div key={index} className="pt-6">
                <div className="flow-root rounded-lg bg-gray-50 px-6 pb-8">
                  <div className="-mt-6">
                    <div>
                      <span className="inline-flex items-center justify-center rounded-md bg-blue-500 p-3 shadow-lg">
                        <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="mt-5 text-base text-gray-500">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
