import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setIsAuthenticated(false);
    setUserType(null);
    setUserId(null);
  };

  // Restore session on app load / page reload so user stays logged in
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/session`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.authenticated && data.user?.role && data.user?.id) {
          login(data.user.role, data.user.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });
    return () => { cancelled = true; };
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
