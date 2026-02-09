import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/api';

export const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        // Check if we have a session token from the backend
        const checkSession = async () => {
            try {
                // Use Express backend session endpoint
                const response = await fetch(getApiUrl('/api/auth/session'), {
                    credentials: 'include', // Important: include cookies
                });

                if (response.ok) {
                    const session = await response.json();

                    if (session?.user) {
                        // Update local auth state
                        login(session.user.role, session.user.id);

                        // Redirect based on user status
                        if (session.user.status === 'NEW') {
                            navigate('/customer/register');
                        } else {
                            navigate('/customer/dashboard');
                        }
                    } else {
                        // No session, redirect to login
                        navigate('/customer/login');
                    }
                } else {
                    navigate('/customer/login');
                }
            } catch (error) {
                console.error('Session check failed:', error);
                navigate('/customer/login');
            }
        };

        checkSession();
    }, [navigate, login]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Completing sign in...</p>
            </div>
        </div>
    );
};
