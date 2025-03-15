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
      try {
        console.log('[AuthCallback] supabase.auth:', supabase.auth);
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
            console.log('[AuthCallback] Redirection vers returnTo:', returnTo.replace('#', ''));
            navigate(returnTo.replace('#', ''));
          } else if (!projects.length) {
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
