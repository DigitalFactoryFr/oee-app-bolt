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
    console.log("[AuthCallback] 🔄 Vérification de la session en cours...");

    const checkAuth = async () => {
      const { data: session, error } = await supabase.auth.getSession();

      if (error || !session?.session) {
        console.error("[AuthCallback] ❌ Aucune session trouvée, redirection vers /auth");
        setError("Session invalide");
        navigate("/auth", { replace: true });
        return;
      }

      console.log("[AuthCallback] ✅ Utilisateur authentifié :", session.session.user);

      // Mettre à jour le store utilisateur
      setUser({
        id: session.session.user.id,
        email: session.session.user.email ?? "",
      });

      try {
        console.log("[AuthCallback] 🔄 Récupération des projets en cours...");
        await fetchProjects(); // Charge les projets AVANT de faire la redirection

        console.log("[AuthCallback] 📂 Projets récupérés :", projects);
        if (projects.length > 0) {
          console.log("[AuthCallback] ✅ Redirection vers /dashboard");
          navigate("/dashboard", { replace: true });
        } else {
          console.log("[AuthCallback] 🆕 Aucun projet, redirection vers /projects/new");
          navigate("/projects/new", { replace: true });
        }
      } catch (err) {
        console.error("[AuthCallback] ❌ Erreur lors de la récupération des projets:", err);
        setError("Erreur lors de la récupération des projets");
        navigate("/auth", { replace: true });
      }
    };

    checkAuth();
  }, [navigate, setUser, setError, fetchProjects, projects.length]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
