import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedUserType: 'customer' | 'admin' | 'delivery';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedUserType,
}) => {
  const { isAuthenticated, userType, sessionLoading } = useAuth();

  // Wait for global session check (restore on reload) before redirecting
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || userType !== allowedUserType) {
    return <Navigate to={`/${allowedUserType === 'customer' ? 'customer' : allowedUserType}/login`} replace />;
  }

  return <>{children}</>;
};
