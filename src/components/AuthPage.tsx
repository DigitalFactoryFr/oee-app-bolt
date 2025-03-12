import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Mail, Lock, Eye, EyeOff, Linkedin, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://i40pilot.app/.netlify/functions/send-email'
  : 'http://localhost:9999/send-email';

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'login';
  const navigate = useNavigate();
  const location = useLocation();
  const { projects } = useProjectStore();
  
  const { signIn, signUp, user, error: authError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  }, [mode]);

  useEffect(() => {
    console.log("User:", user);
    console.log("Projects:", projects);

    if (user) {
      if (projects.length === 0) {
        console.log("No projects → Redirecting to /projects/new");
        navigate('/projects/new', { 
          state: { isFirstProject: true },
          replace: true 
        });
      } else {
        console.log("Has projects → Redirecting to /dashboard");
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, projects, navigate, location]);

  useEffect(() => {
    if (authError) {
      let userMessage = 'An error occurred during authentication';
      if (authError.includes('Invalid login credentials')) {
        userMessage = 'Invalid email or password';
      } else if (authError.includes('Email not confirmed')) {
        userMessage = 'Please confirm your email address before logging in';
      } else if (authError.includes('User already registered')) {
        userMessage = 'An account with this email already exists';
      }
      setError(userMessage);
    }
  }, [authError]);

  const sendEmail = async (email: string, mode: string) => {
    try {
      console.log("📨 Tentative d'envoi d'email via Resend...");

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: mode === 'signup' ? 'Welcome to Pilot!' : 'Login Notification',
          html: `<p>Welcome! You are now authenticated on our platform.</p>`,
        }),
      });

      if (!response.ok) {
        throw new Error(`❌ Erreur API ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      console.log("✅ Email envoyé avec succès :", data);
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de l'email :", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!email || !password) {
        setError('Please fill in all fields');
        return;
      }

      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        
        console.log("📢 Inscription en cours pour :", email);
        const { data, error } = await signUp(email, password);

        if (error) {
          console.error("❌ Erreur d'inscription Supabase :", error.message);
          setError("Signup failed: " + error.message);
          return;
        }

        console.log("✅ Inscription réussie :", data);
        await sendEmail(email, "signup");  // Envoyer l'email après inscription
      } else {
        await signIn(email, password);
        await sendEmail(email, "login");  // Envoyer l'email après connexion
      }
    } catch (err) {
      console.error('❌ Authentication error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-6 mx-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to home
        </button>
        <div className="flex items-center justify-center">
          <Activity className="h-8 w-8 text-blue-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">Pilot</span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-md"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === 'login' ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-md"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white rounded-md">
              {mode === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
