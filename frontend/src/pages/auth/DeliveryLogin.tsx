import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/api';

export const DeliveryLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/auth/delivery/login'), {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-sm w-full bg-white rounded-lg p-8 shadow-sm border border-gray-200">
        <div className="flex justify-center mb-6">
          <img
            src="/Maa Illay Remove Background (1).png"
            alt="Maa Ilay Logo"
            className="h-14 w-auto object-contain"
          />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 text-center mb-1">Delivery Portal</h1>
        <p className="text-center text-sm text-gray-500 mb-8">Login to manage deliveries</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-2 focus:ring-green-800/10 transition-colors outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-2 focus:ring-green-800/10 transition-colors outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-800 text-white rounded-lg text-sm font-medium hover:bg-green-900 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Logging in...
              </span>
            ) : 'Login to Delivery Portal'}
          </button>
        </form>
      </div>
    </div>
  );
};
