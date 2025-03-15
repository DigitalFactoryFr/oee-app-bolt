import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { useNavigate } from 'react-router-dom




export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, setError } = useAuthStore();
  const { fetchProjects, projects } = useProjectStore();

  useEffect(() => {
    // On s'inscrit à l'événement de changement d'état d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthCallback] onAuthStateChange =>', event, session);

        // Si l'utilisateur vient de se connecter
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            // 1. Mettre à jour le store avec l'utilisateur
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
            });

            // 2. Charger les projets de l'utilisateur
            await fetchProjects();

            // 3. Rediriger selon la présence de projets
            if (!projects || projects.length === 0) {
              console.log('[AuthCallback] Aucun projet => /projects/new');
              navigate('/projects/new', { replace: true });
            } else {
              console.log('[AuthCallback] Au moins un projet => /dashboard');
              navigate('/dashboard', { replace: true });
            }
          } catch (err) {
            console.error('[AuthCallback] Erreur:', err);
            setError('Erreur lors de la récupération des projets');
            navigate('/auth', { replace: true });
          }
        }

        // Important : NE RETOURNEZ RIEN dans cette callback
        // pour éviter "TypeError: t is not a function".
      }
    );

    // On désinscrit le listener lors du démontage du composant
    return () => {
      authListener?.unsubscribe();
    };
  }, [navigate, setUser, setError, fetchProjects]);
  // Note: on n'ajoute pas "projects" dans le tableau de dépendances
  // pour éviter un re-render infini si la liste de projets change.

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}
