import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Droplet,
  LayoutDashboard,
  Users,
  Truck,
  MapPin,
  Package,
  AlertCircle,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/customers', label: 'Customers', icon: Users },
    { path: '/admin/delivery-team', label: 'Delivery Team', icon: Truck },
    { path: '/admin/zones', label: 'Zones', icon: MapPin },
    { path: '/admin/inventory', label: 'Inventory', icon: Package },
    { path: '/admin/penalties', label: 'Penalties', icon: AlertCircle },
    { path: '/admin/reports', label: 'Reports', icon: FileText },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
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
            <span className="text-xs text-gray-500">Admin Portal</span>
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

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg flex items-center justify-center">
            <Droplet className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Admin</span>
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
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
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
