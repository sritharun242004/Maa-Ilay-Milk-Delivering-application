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
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-gray-200 fixed left-0 top-0 h-screen px-4 py-5">
        <div className="flex items-center gap-2 mb-6 px-2">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-14 w-auto object-contain"
          />
        </div>

        <nav className="flex-1 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-green-50 text-green-800'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-200 mt-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-12 w-auto object-contain"
          />
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2.5 hover:bg-gray-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-white px-5 py-6"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="space-y-1 mt-14">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-3 rounded-lg text-base font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-green-50 text-green-800'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3.5 px-4 py-3 rounded-lg text-base font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-200 w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-60 p-4 sm:p-6 pt-20 sm:pt-24 lg:pt-6 overflow-x-hidden">{children}</main>
    </div>
  );
};
