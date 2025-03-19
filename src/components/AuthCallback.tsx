import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { fetchProjects } = useProjectStore();

  useEffect(() => {
    const checkUserSession = async () => {
      console.log("[AuthCallback] 🔄 Vérification de la session...");

      try {
        // Vérification initiale de l'utilisateur
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error("[AuthCallback] ❌ Erreur lors de la récupération de l'utilisateur :", error.message);
          return navigate('/auth', { replace: true });
        }

        console.log("[AuthCallback] ✅ Utilisateur récupéré :", user);

        if (!user) {
          console.warn("[AuthCallback] ❌ Aucun utilisateur trouvé, tentative de rafraîchir la session...");
          
          // Forcer une récupération de session
          const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error("[AuthCallback] ⚠️ Échec du rafraîchissement de la session :", refreshError.message);
            return navigate('/auth', { replace: true });
          }

          console.log("[AuthCallback] 🔄 Session rafraîchie, récupération de l'utilisateur...");
          user = refreshedSession?.user;
        }

        if (user) {
          console.log("[AuthCallback] ✅ Session active, redirection vers le tableau de bord...");
          setUser(user);
          fetchProjects(); // Charger les projets associés
          return navigate('/dashboard', { replace: true });
        } else {
          console.warn("[AuthCallback] ❌ Aucun utilisateur détecté après rafraîchissement.");
          return navigate('/auth', { replace: true });
        }

      } catch (err) {
        console.error("[AuthCallback] ⚠️ Erreur inattendue :", err);
        navigate('/auth', { replace: true });
      }
    };

    // Exécuter la vérification après un court délai pour s'assurer que Supabase a bien traité l'authentification
    setTimeout(() => {
      checkUserSession();
    }, 2000);

  }, [navigate, setUser, fetchProjects]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
