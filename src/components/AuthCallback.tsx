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
    const fetchUserAndProjects = async () => {
      console.log("[AuthCallback] 🔄 Vérification de la session en cours...");

      // 🔹 Vérifie la session Supabase
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthCallback] ❌ Erreur de récupération de session :", error);
        navigate('/auth', { replace: true });
        return;
      }

      if (!session || !session.user) {
        console.log("[AuthCallback] ❌ Aucun utilisateur trouvé, redirection vers /auth");
        navigate('/auth', { replace: true });
        return;
      }

      console.log("[AuthCallback] ✅ Utilisateur détecté :", session.user);
      setUser({
        id: session.user.id,
        email: session.user.email ?? '',
      });

      // 🔄 Chargement des projets
      await fetchProjects();
      console.log("[AuthCallback] ✅ Projets récupérés :", projects);

      // 🔀 Redirection en fonction de la présence de projets
      setTimeout(() => {
        if (projects.length > 0) {
          console.log("[AuthCallback] 📂 Redirection vers /dashboard");
          navigate('/dashboard', { replace: true });
        } else {
          console.log("[AuthCallback] 🆕 Aucun projet => Redirection vers /projects/new");
          navigate('/projects/new', { replace: true });
        }
      }, 500);
    };

    fetchUserAndProjects();
  }, [navigate, setUser, setError, fetchProjects, projects.length]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
