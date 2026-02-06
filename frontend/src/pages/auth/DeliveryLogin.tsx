import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Droplet } from 'lucide-react';

export const DeliveryLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Use delivery-specific auth endpoint
                const response = await fetch('/api/auth/delivery/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone,
          password,
          redirect: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        login('delivery', data.user?.id);
        navigate('/delivery/today');
      } else {
        alert('Invalid credentials');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brown-50 to-cream-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-brown-200">
        <div className="flex justify-center mb-6">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-16 w-auto object-contain"
          />
        </div>

        <h1 className="text-3xl font-bold text-neutral-700 text-center mb-2">Delivery Portal</h1>
        <p className="text-center text-neutral-600 mb-8">Login to manage deliveries</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-3 border-2 border-brown-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brown-200 transition-colors outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border-2 border-brown-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brown-200 transition-colors outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-brand to-brand-hover text-white rounded-xl font-semibold shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300"
          >
            Login to Delivery Portal
          </button>
        </form>
      </div>
    </div>
  );
};
