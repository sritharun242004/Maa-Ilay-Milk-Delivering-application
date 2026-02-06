import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Droplet, Truck, Clock, LogOut, Users } from 'lucide-react';

interface DeliveryLayoutProps {
  children: React.ReactNode;
}

export const DeliveryLayout: React.FC<DeliveryLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/delivery/today', label: "Today's Deliveries", icon: Truck },
    { path: '/delivery/assignees', label: 'My Assignees', icon: Users },
    { path: '/delivery/history', label: 'Delivery History', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-brown-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-brown-200 fixed left-0 top-0 h-screen p-6">
        <div className="mb-8 px-2">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-12 w-auto object-contain mb-1"
          />
          <span className="text-xs text-neutral-500 block ml-1">Delivery Portal</span>
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

      <main className="flex-1 lg:ml-64 p-8">{children}</main>
    </div>
  );
};
