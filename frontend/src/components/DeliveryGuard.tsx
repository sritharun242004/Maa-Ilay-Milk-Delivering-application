import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';

interface DeliveryGuardProps {
  children: React.ReactNode;
}

export const DeliveryGuard: React.FC<DeliveryGuardProps> = ({ children }) => {
  const [mustChange, setMustChange] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/delivery/me'), { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { mustChangePassword: false }))
      .then((data) => setMustChange(data.mustChangePassword === true))
      .catch(() => setMustChange(false));
  }, []);

  if (mustChange === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mustChange) {
    return <Navigate to="/delivery/change-password" replace />;
  }

  return <>{children}</>;
};
