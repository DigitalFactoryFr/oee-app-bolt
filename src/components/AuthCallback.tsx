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

      // Afficher les variables d'environnement (pour vérifier qu'elles sont bien définies)
      console.log('[AuthCallback] Variables d\'environnement:', {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      });

      // Inspection de l'instance Supabase et de l'objet auth
      console.log('[AuthCallback] Instance supabase:', supabase);
      console.log('[AuthCallback] supabase.auth:', supabase.auth);
      console.log(
        '[AuthCallback] Méthodes disponibles dans supabase.auth:',
        Object.keys(supabase.auth)
      );

      // Essayons d'utiliser getSessionFromUrl ou, en fallback, exchangeCodeForSession
      const getSession =
        supabase.auth.getSessionFromUrl || supabase.auth.exchangeCodeForSession;

      if (typeof getSession !== 'function') {
        console.error(
          '[AuthCallback] Ni getSessionFromUrl ni exchangeCodeForSession ne sont définies.'
        );
        setError(
          "La méthode d'échange du code n'est pas disponible. Vérifiez votre configuration de @supabase/supabase-js."
        );
        navigate('/auth');
        return;
      }

      try {
        console.log(
          '[AuthCallback] Appel de la méthode d\'échange du code avec storeSession: true'
        );
        // Notez l'utilisation de .call pour s'assurer que le "this" est correctement lié
        const { data, error } = await getSession.call(supabase.auth, {
          storeSession: true,
        });
        console.log('[AuthCallback] Réponse de la méthode d\'échange:', { data, error });

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
