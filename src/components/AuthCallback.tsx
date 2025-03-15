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
  const checkUserSession = async () => {
    console.log("[AuthCallback] 🔄 Vérification de la session...");
    await getUser(); // Appelle la fonction `getUser()`

    const { user } = useAuthStore.getState();
    if (user) {
      console.log("[AuthCallback] ✅ Utilisateur trouvé, redirection vers le tableau de bord...");
      navigate('/dashboard', { replace: true });
    } else {
      console.log("[AuthCallback] ❌ Aucun utilisateur trouvé, redirection vers connexion.");
      navigate('/auth', { replace: true });
    }
  };

  setTimeout(() => {
    checkUserSession();
  }, 2000);
}, [navigate]);


  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
