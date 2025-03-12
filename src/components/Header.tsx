import React, { useState, useEffect } from 'react';
import { Menu, X, Activity } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';



const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();

  const sendEmail = async () => {
    const API_URL = process.env.NODE_ENV === 'production'
      ? 'https://oee-app-bolt.onrender.com/send-email' // Endpoint Netlify
      : 'http://localhost:3000/send-email';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'bagdadi.adam@gmail.com',
          subject: 'Sign In Attempt',
          html: '<p>A user has attempted to sign in to the platform.</p>',
        }),
      });

      if (!response.ok) {
        throw new Error(`Error sending email: ${await response.text()}`);
      }

      console.log("✅ Email de notification envoyé !");
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de l'email :", error);
    }
  };

  const handleSignIn = () => {
    // Appeler la fonction d'envoi d'email ici
    sendEmail();

    // Logique de redirection après la connexion
    navigate('/auth?mode=login');
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* Autres parties du code */}
      <div className="flex items-center">
        {user ? (
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">{user.email}</span>
            <button onClick={handleSignOut} className="ml-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
              Sign out
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleSignIn} // Clic sur Sign In pour envoyer l'email
              className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/auth?mode=signup')}
              className="ml-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;

