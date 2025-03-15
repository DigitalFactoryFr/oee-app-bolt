import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const ForceNavigateOnAuth = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  useEffect(() => {
    // Écouter les changements d'état d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ForceNavigateOnAuth] Événement d’auth :', event, session);
      if (event === 'SIGNED_IN' && session?.user) {
        // Mettre à jour l'utilisateur dans votre store
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        });
        // Forcer la navigation vers le dashboard (ou /projects/new si nécessaire)
        console.log('[ForceNavigateOnAuth] Utilisateur authentifié, redirection vers /dashboard');
        navigate('/dashboard', { replace: true });
      }
    });

    // Nettoyer le listener à la fin
    return () => {
      authListener?.unsubscribe();
    };
  }, [navigate, setUser]);

  return null;
};

export default ForceNavigateOnAuth;
