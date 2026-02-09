import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const CustomerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = (method: string) => {
    if (method === 'google') {
      // Redirect to Express backend Google OAuth (NO intermediate page!)
      window.location.href = '/api/auth/google';
    } else {
      // Mock flow for email (unless we wire that too)
      login('customer');
      navigate('/customer/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brown-50 to-cream-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-brown-200">
        <div className="flex justify-center mb-6">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-16 w-auto object-contain"
          />
        </div>

        <h1 className="text-3xl font-bold text-neutral-700 text-center mb-2">Welcome to Maa Ilay</h1>
        <p className="text-center text-neutral-600 mb-8">Login to manage your milk subscription</p>

        <button
          onClick={() => handleLogin('google')}
          className="w-full bg-white border-2 border-brown-300 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 hover:border-brand hover:shadow-lg transition-all duration-300"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
};
