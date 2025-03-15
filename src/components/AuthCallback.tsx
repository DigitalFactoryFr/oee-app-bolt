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
      console.log('[AuthCallback] window.location.href:', window.location.href);
      console.log('[AuthCallback] window.location.search:', window.location.search);

      // Extraction manuelle du paramètre "code"
      const code = searchParams.get('code');
      console.log('[AuthCallback] Code extrait:', code);

      if (!code) {
        console.error('[AuthCallback] Aucun code trouvé dans l\'URL');
        setError("Aucun code trouvé dans l'URL");
        navigate('/auth');
        return;
      }

      try {
        console.log('[AuthCallback] Appel de exchangeCodeForSession avec le code:', code);
        // Appel de exchangeCodeForSession en passant le code extrait
        const { data, error } = await supabase.auth.exchangeCodeForSession(code, {
          storeSession: true,
        });
        console.log('[AuthCallback] Réponse de exchangeCodeForSession:', { data, error });

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
          setError('Impossible de récupérer la session utilisateur.');
          navigate('/auth');
        }
      } catch (err) {
        console.error('[AuthCallback] Exception attrapée:', err);
        setError("Une erreur s'est produite lors de l'authentification");
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
