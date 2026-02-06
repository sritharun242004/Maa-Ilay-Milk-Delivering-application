import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Droplet,
  Home,
  Package,
  Calendar,
  Wallet,
  Clock,
  HelpCircle,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react';

interface CustomerLayoutProps {
  children: React.ReactNode;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/customer/dashboard', label: 'Dashboard', icon: Home },
    { path: '/customer/subscription', label: 'Subscription', icon: Package },
    { path: '/customer/calendar', label: 'Calendar', icon: Calendar },
    { path: '/customer/wallet', label: 'Wallet', icon: Wallet },
    { path: '/customer/history', label: 'History', icon: Clock },
    { path: '/customer/profile', label: 'Profile', icon: User },
    { path: '/customer/support', label: 'Support', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-brown-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-brown-200 fixed left-0 top-0 h-screen p-6">
        <div className="flex items-center gap-2 mb-8 px-2">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-12 w-auto object-contain"
          />
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brown-100 text-brand'
                    : 'text-neutral-700 hover:bg-brown-50 hover:text-brand'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all duration-200 mt-4"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-brown-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-10 w-auto object-contain"
          />
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="space-y-2 mt-16">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-brown-100 text-brand'
                        : 'text-neutral-700 hover:bg-brown-50 hover:text-brand'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all duration-200 w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-64 p-8 pt-24 lg:pt-8">{children}</main>
    </div>
  );
};
