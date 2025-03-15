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
    console.log('[AuthCallback] 📌 Composant monté');

    // Vérification des fonctions critiques
    console.log("[DEBUG] Vérification de setUser:", setUser);
    console.log("[DEBUG] Vérification de fetchProjects:", fetchProjects);

    if (typeof setUser !== "function") {
      console.error("[ERROR] ❌ setUser n'est pas une fonction !");
    }

    if (typeof fetchProjects !== "function") {
      console.error("[ERROR] ❌ fetchProjects n'est pas une fonction !");
    }

    if (typeof navigate !== "function") {
      console.error("[ERROR] ❌ navigate() n'est pas défini correctement !");
    } else {
      console.log("[AuthCallback] ✅ Navigation possible !");
    }

    // Écouteur sur le changement d'état d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthCallback] 🔄 Événement onAuthStateChange =>`, event, session);

        if (event === 'SIGNED_IN' && session?.user) {
          try {
            console.log("[AuthCallback] ✅ Utilisateur authentifié :", session.user);

            // Mettre à jour l'utilisateur dans le store
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
            });

            // Charger les projets
            await fetchProjects();

            console.log("[DEBUG] Projects actuel :", projects);
            console.log("[DEBUG] projects.length :", projects ? projects.length : "undefined");

            // Vérifier la navigation en fonction des projets
            if (!projects || projects.length === 0) {
              console.log('[AuthCallback] 🆕 Aucun projet => Redirection vers /projects/new');
              navigate('/projects/new', { replace: true });
            } else {
              console.log('[AuthCallback] 📂 Au moins un projet => Redirection vers /dashboard');
              navigate('/dashboard', { replace: true });
            }
          } catch (err) {
            console.error('[AuthCallback] ❌ Erreur:', err);
            setError('Erreur lors de la récupération des projets');
            navigate('/auth', { replace: true });
          }
        }
      }
    );

    return () => {
      console.log("[AuthCallback] 🛑 Désinscription du listener d'authentification");
      authListener?.unsubscribe();
    };
  }, [navigate, setUser, setError, fetchProjects]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
