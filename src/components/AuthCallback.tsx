import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setError } = useAuthStore();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setError(error.message);
        navigate('/auth');
        return;
      }

      if (data.session?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
        });
        navigate('/dashboard');
      } else {
        setError('Unable to retrieve user session.');
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate, setUser, setError]);

  return (
    <div className="flex justify-center items-center h-screen">
      <p>Authenticating...</p>
    </div>
  );
};

export default AuthCallback;
