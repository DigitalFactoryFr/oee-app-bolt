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
    const checkProjects = async () => {
      console.log("[AuthCallback] 🔄 Vérification des projets en cours...");
      
      try {
        await fetchProjects(); 
        console.log("[AuthCallback] ✅ Projets récupérés :", projects);

        setTimeout(() => {
          if (projects.length > 0) {
            console.log("[AuthCallback] 📂 Redirection vers /dashboard");
            navigate('/dashboard', { replace: true });
          } else {
            console.log("[AuthCallback] 🆕 Aucun projet => Redirection vers /projects/new");
            navigate('/projects/new', { replace: true });
          }
        }, 500); // Ajout d’un petit délai pour s'assurer que les projets sont chargés
      } catch (err) {
        console.error("[AuthCallback] ❌ Erreur lors de la récupération des projets:", err);
        setError('Erreur lors de la récupération des projets');
        navigate('/auth', { replace: true });
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthCallback] onAuthStateChange =>', event, session);

        if (event === 'SIGNED_IN' && session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
          });
          console.log("[AuthCallback] 👤 Utilisateur mis à jour :", session.user);
          checkProjects();
        }
      }
    );

    return () => {
      console.log("[AuthCallback] 🛑 Désinscription du listener d'authentification");
      authListener?.unsubscribe();
    };
  }, [navigate, setUser, setError, fetchProjects, projects.length]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
