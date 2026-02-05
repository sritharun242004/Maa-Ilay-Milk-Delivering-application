import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clearAllCaches } from '../hooks/useCachedData';

interface AuthContextType {
  isAuthenticated: boolean;
  userType: 'customer' | 'admin' | 'delivery' | null;
  userId: string | null;
  sessionLoading: boolean;
  login: (type: 'customer' | 'admin' | 'delivery', userId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = '/api';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<'customer' | 'admin' | 'delivery' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const login = (type: 'customer' | 'admin' | 'delivery', id?: string) => {
    setIsAuthenticated(true);
    setUserType(type);
    setUserId(id ?? null);
  };

  const logout = () => {
    // Clear server session so cookie is invalidated
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => { });

    // Clear all cached data on logout
    clearAllCaches();

    setIsAuthenticated(false);
    setUserType(null);
    setUserId(null);
  };

  // Restore session on app load / page reload so user stays logged in
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

    fetch(`${API_BASE}/auth/session`, {
      credentials: 'include',
      signal: controller.signal
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session not active');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data && data.authenticated && data.user?.role && data.user?.id) {
          login(data.user.role, data.user.id);
        }
      })
      .catch((err) => {
        console.warn('Session check skipped/failed:', err.message);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setSessionLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, userType, userId, sessionLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
