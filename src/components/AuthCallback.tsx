import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setError } = useAuthStore();
  const { fetchProjects, projects } = useProjectStore();

  useEffect(() => {
    const finalizeAuth = async () => {
      try {
        console.log('[AuthCallback] Début du callback (flux implicite)');

        // 1. Vérifier la session auprès de Supabase
        const { data, error } = await supabase.auth.getSession();
        console.log('[AuthCallback] Résultat getSession:', { data, error });
        if (error) {
          console.error('[AuthCallback] Erreur getSession:', error);
          setError(error.message);
          navigate('/auth');
          return;
        }

        // 2. Si pas d’utilisateur, on renvoie vers /auth
        if (!data.session?.user) {
          console.error('[AuthCallback] Aucune session utilisateur trouvée');
          setError('No session found');
          navigate('/auth');
          return;
        }

        // 3. On stocke l’utilisateur dans le store
        console.log('[AuthCallback] Utilisateur connecté:', data.session.user);
        setUser({
          id: data.session.user.id,
          email: data.session.user.email || '',
        });

        // 4. Charger les projets de l’utilisateur
        await fetchProjects();
        console.log('[AuthCallback] Projets chargés:', projects);

        // 5. Décider de la redirection finale
        if (projects.length === 0) {
          console.log('[AuthCallback] Aucun projet => vers /projects/new');
          navigate('/projects/new');
        } else {
          console.log('[AuthCallback] Au moins un projet => vers /dashboard');
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('[AuthCallback] Exception attrapée:', err);
        setError('An error occurred during authentication');
        navigate('/auth');
      }
    };

    finalizeAuth();
    // Important : ne mettez PAS `projects` dans le tableau de dépendances
    // pour éviter un re-render infini si fetchProjects() modifie le store.
  }, [navigate, setUser, setError, fetchProjects]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;
