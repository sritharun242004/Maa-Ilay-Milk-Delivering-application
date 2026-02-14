import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Droplets,
  LayoutDashboard,
  Users,
  Truck,
  MapPin,
  Package,
  AlertCircle,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  IndianRupee,
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
    { path: '/admin/deliveries', label: 'Deliveries', icon: ClipboardList },
    { path: '/admin/customers', label: 'Customers', icon: Users },
    { path: '/admin/delivery-team', label: 'Delivery Team', icon: Truck },
    { path: '/admin/products', label: 'Products', icon: Droplets },
    { path: '/admin/inventory', label: 'Inventory', icon: Package },
    { path: '/admin/payments', label: 'Payments', icon: IndianRupee },
    { path: '/admin/penalties', label: 'Penalties', icon: AlertCircle },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-gray-200 fixed left-0 top-0 h-screen px-4 py-5">
        <div className="mb-6 px-2">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-10 w-auto object-contain mb-1"
          />
          <span className="text-xs text-gray-400 block">Admin Portal</span>
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

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-9 w-auto object-contain"
          />
          <span className="text-xs text-gray-400">Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-60 bg-white px-4 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="space-y-0.5 mt-14">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
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
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-200 w-full"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-60 p-6 pt-20 lg:pt-6">{children}</main>
    </div>
  );
};
