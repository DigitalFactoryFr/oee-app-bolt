import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const InvitePage = () => {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const acceptInvite = async () => {
      if (!inviteId) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        // 🔍 Vérification de l'utilisateur
        if (!user?.email) {
          return navigate(`/auth?returnTo=/invite/${inviteId}`);
        }

        console.log("[InvitePage] 🔍 Vérification de l'invitation pour :", user.email);

        // 📌 Étape 1 : Récupérer l'invitation associée à l'utilisateur
        const { data: teamMember, error: teamMemberError } = await supabase
          .from('team_members')
          .select('*')
          .eq('id', inviteId)
          .eq('email', user.email) // Vérification que l'invitation correspond bien à l'email
          .single();

        if (teamMemberError) throw teamMemberError;
        if (!teamMember) throw new Error('Invitation not found or not linked to your account');

        // 📌 Étape 2 : Vérifier si l'invitation est encore valide
        if (teamMember.status !== 'pending' && teamMember.status !== 'invited') {
          throw new Error('This invitation has already been used or is no longer valid');
        }

        console.log("[InvitePage] 🔄 Mise à jour du statut en 'active'...");

        // ✅ Étape 3 : Mise à jour du statut du membre invité
        const { error: updateError } = await supabase
          .from('team_members')
          .update({
            status: 'active',
            joined_at: new Date().toISOString()
          })
          .eq('id', inviteId)
          .eq('email', user.email); // Sécurité supplémentaire

        if (updateError) throw updateError;

        // ✅ Étape 4 : Vérification que le statut est bien mis à jour
        const { data: updatedMember, error: fetchError } = await supabase
          .from('team_members')
          .select('*')
          .eq('id', inviteId)
          .eq('email', user.email)
          .single();

        if (!fetchError && updatedMember.status === 'active') {
          console.log("[InvitePage] ✅ Invitation acceptée, redirection...");
          navigate(`/projects/${teamMember.project_id}`);
        } else {
          throw new Error('Failed to verify the status update');
        }
      } catch (err) {
        console.error('Error accepting invitation:', err);
        setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      acceptInvite();
    }
  }, [inviteId, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex items-center justify-center">
            <Activity className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accepting Invitation...
          </h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex items-center justify-center">
            <Activity className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {error}
          </p>
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InvitePage;
