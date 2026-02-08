import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Droplet, MapPin, Phone, Home, User, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';

export const CustomerOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: 'Pondicherry',
    pincode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill name from session (Google gives us name)
  useEffect(() => {
    fetch(getApiUrl('/api/auth/session'), { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.name) setFormData((prev) => ({ ...prev, name: data.user.name }));
      })
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetchWithCsrf('/api/customer/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      // Handle CSRF errors by clearing cache and retrying once
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (response.status === 403 && data.error?.includes('CSRF')) {
          clearCsrfToken();
          // Retry with fresh token
          const retryResponse = await fetchWithCsrf('/api/customer/complete-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
          });

          if (retryResponse.ok) {
            login('customer');
            navigate('/customer/dashboard');
            return;
          } else {
            const retryData = await retryResponse.json().catch(() => ({}));
            setError(retryData.error || 'Failed to save profile');
            return;
          }
        }

        setError(data.error || 'Failed to save profile');
      } else {
        login('customer');
        navigate('/customer/dashboard');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      {/* Floating Nav Bar - same as Home page */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-[1350px] bg-white/80 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-full transition-all duration-300">
        <div className="px-8 md:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-lg flex items-center justify-center">
              <Droplet className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Maa Ilay</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2 text-sm font-medium text-gray-700 hover:text-emerald-600 transition-colors"
            >
              Back to Home
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/login')}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              Subscribe / Login
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 pt-40 pb-12">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Complete your profile</h1>
          <p className="text-gray-600 mt-2">We need a few details to deliver fresh milk to your doorstep.</p>
        </div>
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8 flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Why we need this information</h3>
            <p className="text-blue-700 text-sm leading-relaxed">
              We need your contact details and address to deliver fresh milk to your doorstep every morning. 
              Your information is secure and will only be used for delivery purposes.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 flex items-start gap-4">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-emerald-600" />
                </div>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={2}
                placeholder="Enter your full name"
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-emerald-600" />
                </div>
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                pattern="[0-9]{10}"
                placeholder="Enter 10-digit mobile number"
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-500 mt-2">We'll use this for delivery updates</p>
            </div>

            {/* Address Line 1 */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-emerald-600" />
                </div>
                Address Line 1 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                required
                placeholder="House/Flat No., Building Name, Street"
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Address Line 2 */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-gray-600" />
                </div>
                Address Line 2 <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                placeholder="Area, Colony, Locality"
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Landmark */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-gray-600" />
                </div>
                Landmark <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                placeholder="Near temple, bus stop, hospital, etc."
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-500 mt-2">Helps our delivery person find you easily</p>
            </div>

            {/* City & Pincode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                  </div>
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Pondicherry"
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                  </div>
                  Pincode <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  required
                  pattern="[0-9]{6}"
                  placeholder="6-digit pincode"
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving your details...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Complete Profile & Continue</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            🔒 Your information is encrypted and secure
          </p>
        </div>
      </div>
    </div>
  );
};
