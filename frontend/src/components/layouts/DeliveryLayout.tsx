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
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200 fixed left-0 top-0 h-screen p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg flex items-center justify-center">
            <Droplet className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-2xl font-bold text-gray-900 block">Maa Ilay</span>
            <span className="text-xs text-gray-500">Delivery Portal</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
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
