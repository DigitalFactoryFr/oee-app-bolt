import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, setError } = useAuthStore();
  const { fetchProjects, projects } = useProjectStore();
  const [loading, setLoading] = useState(true); // Ajout d'un état de chargement

  useEffect(() => {
    console.log("[AuthCallback] 🔄 Vérification de la session...");
    
    const checkAuth = async () => {
      const { data: session, error } = await supabase.auth.getSession();
      
      if (error || !session?.session) {
        console.error("[AuthCallback] ❌ Aucune session trouvée, redirection vers /auth");
        setError("Session invalide");
        navigate("/auth", { replace: true });
        return;
      }

      console.log("[AuthCallback] ✅ Utilisateur authentifié :", session.session.user);

      setUser({
        id: session.session.user.id,
        email: session.session.user.email ?? "",
      });

      try {
        console.log("[AuthCallback] 🔄 Récupération des projets en cours...");
        await fetchProjects(); // ⚡ On attend la fin du fetch
        setLoading(false); // ⚡ On marque la fin du chargement
      } catch (err) {
        console.error("[AuthCallback] ❌ Erreur lors de la récupération des projets:", err);
        setError("Erreur lors de la récupération des projets");
        navigate("/auth", { replace: true });
      }
    };

    checkAuth();
  }, [navigate, setUser, setError, fetchProjects]);

  useEffect(() => {
    if (!loading) {
      console.log("[AuthCallback] 📂 Projets chargés :", projects);
      
      if (projects.length > 0) {
        console.log("[AuthCallback] ✅ Redirection vers /dashboard");
        navigate("/dashboard", { replace: true });
      } else {
        console.log("[AuthCallback] 🆕 Aucun projet, redirection vers /projects/new");
        navigate("/projects/new", { replace: true });
      }
    }
  }, [projects, loading, navigate]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
