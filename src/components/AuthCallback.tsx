import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, setError } = useAuthStore();
  const { projects, fetchProjects } = useProjectStore();
  const returnTo = searchParams.get('returnTo');

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('[AuthCallback] Début du callback');

      // Afficher les variables d'environnement pour vérification
      console.log('[AuthCallback] Variables d\'environnement:', {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      });

      // Inspecter l'instance supabase et l'objet auth
      console.log('[AuthCallback] Instance supabase:', supabase);
      console.log('[AuthCallback] supabase.auth:', supabase.auth);
      console.log('[AuthCallback] getSessionFromUrl:', supabase.auth.getSessionFromUrl);

      // Vérifier que la méthode getSessionFromUrl existe
      if (typeof supabase.auth.getSessionFromUrl !== 'function') {
        console.error('[AuthCallback] getSessionFromUrl n\'est pas défini.');
        setError("La méthode getSessionFromUrl n'est pas disponible. Vérifiez votre version ou la configuration de @supabase/supabase-js.");
        navigate('/auth');
        return;
      }

      try {
        console.log('[AuthCallback] Appel de getSessionFromUrl avec storeSession: true');
        const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
        console.log('[AuthCallback] Réponse de getSessionFromUrl:', { data, error });

        if (error) {
          console.error('[AuthCallback] Erreur lors de l\'échange du token:', error);
          setError(error.message);
          navigate('/auth');
          return;
        }

        if (data?.session?.user) {
          console.log('[AuthCallback] Utilisateur récupéré:', data.session.user);
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
          });

          console.log('[AuthCallback] Appel de fetchProjects()');
          await fetchProjects();
          console.log('[AuthCallback] Valeur de projects après fetchProjects:', projects);

          if (returnTo) {
            const redirectUrl = returnTo.replace('#', '');
            console.log('[AuthCallback] Redirection vers returnTo:', redirectUrl);
            navigate(redirectUrl);
          } else if (!projects || !projects.length) {
            console.log('[AuthCallback] Aucun projet trouvé, redirection vers /projects/new');
            navigate('/projects/new');
          } else {
            console.log('[AuthCallback] Projet(s) trouvé(s), redirection vers /dashboard');
            navigate('/dashboard');
          }
        } else {
          console.error('[AuthCallback] Aucune session utilisateur trouvée dans data');
          setError('Unable to retrieve user session.');
          navigate('/auth');
        }
      } catch (err) {
        console.error('[AuthCallback] Exception attrapée:', err);
        setError('An error occurred during authentication');
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate, setUser, setError, returnTo, fetchProjects]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;
