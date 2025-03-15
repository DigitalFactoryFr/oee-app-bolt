import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setError } = useAuthStore();
  const { fetchProjects } = useProjectStore();

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('[AuthCallback] Début du callback');
      console.log('[AuthCallback] window.location.href:', window.location.href);
      console.log('[AuthCallback] window.location.hash:', window.location.hash);

      // Tenter d'extraire un code dans la query string (flux PKCE)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        // Flux PKCE attendu (code présent) : échange du code contre une session
        console.log('[AuthCallback] Code trouvé dans la query:', code);
        const { data, error } = await supabase.auth.exchangeCodeForSession(code, { storeSession: true });
        console.log('[AuthCallback] Réponse de exchangeCodeForSession:', { data, error });
        if (error) {
          setError(error.message);
          navigate('/auth');
          return;
        }
        if (data?.session?.user) {
          setUser({ id: data.session.user.id, email: data.session.user.email || '' });
        }
      } else {
        // Flux implicite : extraire les tokens depuis le hash
        console.log('[AuthCallback] Aucun code trouvé, traitement du hash');
        const hash = window.location.hash; // Ex.: "#access_token=...&refresh_token=...&expires_at=..."
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const expires_in = params.get('expires_in'); // Certains renvoient expires_in
          const token_type = params.get('token_type');
          console.log('[AuthCallback] Tokens extraits du hash:', { access_token, refresh_token, expires_in, token_type });
          if (access_token) {
            const sessionData = {
              access_token,
              refresh_token,
              expires_in: expires_in ? parseInt(expires_in) : undefined,
              token_type,
            };
            const { error } = await supabase.auth.setSession(sessionData);
            if (error) {
              setError(error.message);
              navigate('/auth');
              return;
            }
            // Optionnel : récupérer l'utilisateur mis à jour
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
              setUser({ id: userData.user.id, email: userData.user.email || '' });
            }
          } else {
            setError("Aucun access token trouvé dans l'URL.");
            navigate('/auth');
            return;
          }
        } else {
          setError("Aucun code ni token trouvé dans l'URL.");
          navigate('/auth');
          return;
        }
      }

      // Une fois la session établie, charger les projets et rediriger
      try {
        await fetchProjects();
        // Vous pouvez ici rediriger selon vos besoins (dashboard, nouveau projet, etc.)
        // Par exemple :
        navigate('/dashboard');
      } catch (err) {
        setError("Erreur lors du chargement des projets.");
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate, setUser, setError, fetchProjects]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;
