import React, { useState } from 'react';
import { Menu, X, Activity } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuthStore();

  // Ne pas afficher le header sur la page d'authentification
  if (location.pathname === '/auth') {
    return null;
  }

  // Fonctions pour forcer la redirection en dur
  const goFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = 'https://i40pilot.app/#features';
  };
  const goPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = 'https://i40pilot.app/#pricing';
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo (Pilot) à gauche */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              {/* Lien interne vers "/" (accueil) */}
              <Link to="/" className="flex items-center">
                <Activity className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Pilot</span>
              </Link>
            </div>
            {/* Menu principal (desktop) */}
            <nav className="hidden md:ml-6 md:flex md:space-x-8">
              <a
                href="https://i40pilot.app/#features"
                onClick={goFeatures}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Features
              </a>
              <a
                href="https://i40pilot.app/#pricing"
                onClick={goPricing}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Pricing
              </a>
              <Link
                to="/about"
                className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                About
              </Link>
              <Link
                to="/contact"
                className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Zone de droite (desktop) */}
          <div className="hidden md:flex items-center">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">{user.email}</span>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  My Dashboard
                </Link>
              </div>
            ) : (
              <>
                <Link
                  to="/auth?mode=login"
                  className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  Log in
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="ml-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Bouton hamburger (mobile) */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400
                         hover:text-gray-500 hover:bg-gray-100 focus:outline-none
                         focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="sr-only">Open menu</span>
              {isMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1 border-b border-gray-200">
            <a
              href="https://i40pilot.app/#features"
              onClick={goFeatures}
              className="block pl-3 pr-4 py-2 text-base font-medium
                         text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              Features
            </a>
            <a
              href="https://i40pilot.app/#pricing"
              onClick={goPricing}
              className="block pl-3 pr-4 py-2 text-base font-medium
                         text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              Pricing
            </a>
            <Link
              to="/about"
              className="block pl-3 pr-4 py-2 text-base font-medium
                         text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              About
            </Link>
            <Link
              to="/contact"
              className="block pl-3 pr-4 py-2 text-base font-medium
                         text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              Contact
            </Link>
          </div>

          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-4 flex items-center">
              {user ? (
                <div className="flex-1">
                  <p className="text-gray-700 text-base font-medium">{user.email}</p>
                  <Link
                    to="/dashboard"
                    className="mt-2 block px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md text-center"
                  >
                    My Dashboard
                  </Link>
                </div>
              ) : (
                <div className="flex space-x-4">
                  <Link
                    to="/auth?mode=login"
                    className="text-base font-medium text-gray-500 hover:text-gray-900"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/auth?mode=signup"
                    className="px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
