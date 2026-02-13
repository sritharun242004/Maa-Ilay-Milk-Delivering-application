import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Phone, Home, User, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';

const SERVICEABLE_AREAS = [
  { area: 'Reddiyarpalayam', pincode: '605010' },
  { area: 'Jipmer', pincode: '605006' },
  { area: 'Lawspet', pincode: '605008' },
  { area: 'Auroville', pincode: '605101' },
  { area: 'Saram', pincode: '605013' },
  { area: 'Rainbow Nagar', pincode: '605011' },
  { area: 'White Town', pincode: '605001' },
  { area: 'Muthiyapet', pincode: '605003' },
  { area: 'Ariyankuppam', pincode: '605007' },
] as const;

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
            setError(retryData.error || retryData.message || 'Failed to save profile');
            return;
          }
        }

        setError(data.error || data.message || 'Failed to save profile');
      } else {
        login('customer');
        navigate('/customer/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-2 focus:ring-green-800/10 outline-none transition-colors text-gray-900 placeholder:text-gray-400";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple top bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <img
          src="/Maa Illay Remove Background (1).png"
          alt="Maa Ilay Logo"
          className="h-9 w-auto object-contain"
        />
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back to Home
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Complete your profile</h1>
          <p className="text-sm text-gray-500 mt-1">We need a few details to deliver fresh milk to your doorstep.</p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex items-start gap-3">
          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Your contact details and address are needed for delivery purposes only. Your information is secure.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Unable to save profile</p>
              <p className="text-sm text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                className={inputClasses}
              />
              <p className="text-xs text-gray-400 mt-1">We'll use this for delivery updates</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Search Address
              </label>
              <AddressAutocomplete
                onPlaceSelected={(place) => {
                  const serviceablePincodes = SERVICEABLE_AREAS.map(a => a.pincode);
                  const autoPin = place.pincode?.replace(/\D/g, '') || '';
                  setFormData((prev) => ({
                    ...prev,
                    addressLine1: place.addressLine1 || prev.addressLine1,
                    addressLine2: place.addressLine2 || prev.addressLine2,
                    city: place.city || prev.city,
                    pincode: serviceablePincodes.includes(autoPin) ? autoPin : prev.pincode,
                  }));
                }}
                className={inputClasses}
              />
              <p className="text-xs text-gray-400">Search to auto-fill your address, or type manually below</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Door No. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                required
                placeholder="e.g. 12/3, Plot No. 5"
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Address Line 2 <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                placeholder="Area, Colony, Locality"
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Landmark <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                placeholder="Near temple, bus stop, hospital, etc."
                className={inputClasses}
              />
              <p className="text-xs text-gray-400 mt-1">Helps our delivery person find you easily</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Pondicherry"
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Area & Pincode <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    required
                    className={`${inputClasses} appearance-none pr-8`}
                  >
                    <option value="">Select your area</option>
                    {SERVICEABLE_AREAS.map((a) => (
                      <option key={`${a.area}-${a.pincode}`} value={a.pincode}>
                        {a.area} - {a.pincode}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-400 mt-1">We currently deliver only in these areas</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Complete Profile & Continue'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
