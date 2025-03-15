import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, setError } = useAuthStore();
  const { projects, fetchProjects } = useProjectStore();
  const returnTo = searchParams.get('returnTo');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
       const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });

        if (error) {
          setError(error.message);
          navigate('/auth');
          return;
        }

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
          });

          // Fetch projects to check if user has any
          await fetchProjects();

          // If returnTo is set, navigate there
          if (returnTo) {
            navigate(returnTo.replace('#', ''));
          }
          // If no projects, go to new project page
          else if (!projects.length) {
            navigate('/projects/new');
          }
          // Otherwise go to dashboard
          else {
            navigate('/dashboard');
          }
        } else {
          setError('Unable to retrieve user session.');
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('An error occurred during authentication');
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate, setUser, setError, returnTo, fetchProjects]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;