import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { fetchProjects } = useProjectStore();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  useEffect(() => {
    const checkUserSession = async () => {
      console.log("[AuthCallback] 🔄 Début de la vérification de la session...");
      
      try {
        // 1. Vérifier si l'utilisateur est connecté
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          console.error("[AuthCallback] ❌ Erreur ou utilisateur non trouvé :", error?.message);
          return navigate('/auth', { replace: true });
        }
        console.log("[AuthCallback] ✅ Utilisateur connecté :", user.email);
        setUser(user);

        // 2. Si un paramètre returnTo est présent et correspond à une invitation, rediriger vers InvitePage
        if (returnTo && returnTo.startsWith('/invite/')) {
          console.log("[AuthCallback] Redirection vers l'invitation:", returnTo);
          return navigate(returnTo, { replace: true });
        }

        // 3. Traitement classique si pas de paramètre returnTo
        console.log("[AuthCallback] 🔍 Recherche de l'utilisateur dans team_members...");
        const { data: member, error: memberError } = await supabase
          .from('team_members')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();
        if (memberError || !member) {
          console.warn("[AuthCallback] ❌ Aucun projet trouvé pour cet utilisateur.");
          return navigate('/projects/new', { replace: true });
        }
        console.log(`[AuthCallback] 📌 Utilisateur trouvé avec statut : ${member.status}`);

        // 4. Si le membre est invité, le mettre à jour en "active"
        if (member.status === "invited") {
          console.log("[AuthCallback] 🔄 Mise à jour du statut en 'active'...");
          const { error: updateError } = await supabase
            .from('team_members')
            .update({ status: 'active' })
            .eq('id', member.id);
          if (updateError) {
            console.error("[AuthCallback] ❌ Échec de la mise à jour du statut :", updateError.message);
          } else {
            console.log("[AuthCallback] ✅ Statut mis à jour en 'active'.");
          }
        }

        // 5. Vérifier l'accès au projet
        console.log("[AuthCallback] 🔄 Vérification de l'accès au projet...");
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', member.project_id)
          .maybeSingle();
        if (projectError || !project) {
          console.warn("[AuthCallback] ❌ Impossible de récupérer le projet.");
          return navigate('/projects/new', { replace: true });
        }

        console.log("[AuthCallback] 🚀 Redirection vers le projet");
        navigate(`/projects/${member.project_id}`, { replace: true });

      } catch (err) {
        console.error("[AuthCallback] ⚠️ Erreur inattendue :", err);
        navigate('/auth', { replace: true });
      }
    };

    checkUserSession();
  }, [navigate, setUser, fetchProjects, returnTo]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="mt-2 text-gray-600">Connexion en cours...</p>
    </div>
  );
}
