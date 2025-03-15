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
    console.log("[AuthCallback] Composant monté 🚀");

    console.log("[DEBUG] navigate est :", navigate);
    if (typeof navigate !== "function") {
      console.error("[ERROR] ❌ useNavigate() ne retourne pas une fonction !");
      return;
    }

    const checkAuth = async () => {
      console.log("[AuthCallback] Vérification de la session en cours...");

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthCallback] Erreur récupération session ❌", error);
        setError("Erreur lors de la récupération de la session.");
        navigate('/auth', { replace: true });
        return;
      }

      if (session?.user) {
        console.log("[AuthCallback] ✅ Utilisateur authentifié :", session.user);
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
        });

        try {
          console.log("[AuthCallback] 📂 Chargement des projets...");
          await fetchProjects();

          console.log("[AuthCallback] 🟢 Projets récupérés :", projects);

          // Ajout d'un setTimeout pour éviter un problème de timing
          setTimeout(() => {
            if (!projects || projects.length === 0) {
              console.log("[AuthCallback] ➡ Aucun projet => Redirection /projects/new");
              navigate('/projects/new', { replace: true });
            } else {
              console.log("[AuthCallback] ✅ Projets trouvés => Redirection /dashboard");
              navigate('/dashboard', { replace: true });
            }
          }, 500);
        } catch (err) {
          console.error("[AuthCallback] ❌ Erreur lors du chargement des projets", err);
          setError("Impossible de récupérer les projets.");
          navigate('/auth', { replace: true });
        }
      } else {
        console.warn("[AuthCallback] ❌ Aucun utilisateur connecté, redirection vers /auth");
        navigate('/auth', { replace: true });
      }
    };

    checkAuth();
  }, [navigate, setUser, setError, fetchProjects]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
