import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, setError } = useAuthStore();
  const { fetchProjects, projects } = useProjectStore();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthCallback] Erreur lors de la récupération de la session :", error);
        setError("Erreur lors de la récupération de la session.");
        navigate('/auth', { replace: true });
        return;
      }

      if (session?.user) {
        console.log("[AuthCallback] Utilisateur authentifié :", session.user);
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
        });

        try {
          await fetchProjects();
          if (!projects || projects.length === 0) {
            console.log('[AuthCallback] Aucun projet trouvé, redirection vers /projects/new');
            navigate('/projects/new', { replace: true });
          } else {
            console.log('[AuthCallback] Projets trouvés, redirection vers /dashboard');
            navigate('/dashboard', { replace: true });
          }
        } catch (err) {
          console.error("[AuthCallback] Erreur lors de la récupération des projets :", err);
          setError("Impossible de récupérer les projets.");
          navigate('/auth', { replace: true });
        }
      } else {
        console.warn("[AuthCallback] Aucun utilisateur connecté, redirection vers /auth");
        navigate('/auth', { replace: true });
      }
    };

    checkAuth();
  }, [navigate, setUser, setError, fetchProjects]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="text-gray-600 mt-4">Connexion en cours...</p>
    </div>
  );
}
