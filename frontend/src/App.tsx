import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DeliveryGuard } from './components/DeliveryGuard';
import { ErrorBoundary } from './components/ErrorBoundary';

// Loading spinner for lazy-loaded routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
  </div>
);

// --- Lazy-loaded pages ---

// Public / Auth
const Home = React.lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const CustomerLogin = React.lazy(() => import('./pages/auth/CustomerLogin').then(m => ({ default: m.CustomerLogin })));
const AdminLogin = React.lazy(() => import('./pages/auth/AdminLogin').then(m => ({ default: m.AdminLogin })));
const DeliveryLogin = React.lazy(() => import('./pages/auth/DeliveryLogin').then(m => ({ default: m.DeliveryLogin })));
const AuthCallback = React.lazy(() => import('./pages/auth/AuthCallback').then(m => ({ default: m.AuthCallback })));

// Customer pages
const CustomerDashboard = React.lazy(() => import('./pages/customer/Dashboard').then(m => ({ default: m.CustomerDashboard })));
const CustomerOnboarding = React.lazy(() => import('./pages/customer/Onboarding').then(m => ({ default: m.CustomerOnboarding })));
const Subscription = React.lazy(() => import('./pages/customer/Subscription').then(m => ({ default: m.Subscription })));
const CustomerCalendar = React.lazy(() => import('./pages/customer/Calendar').then(m => ({ default: m.CustomerCalendar })));
const Wallet = React.lazy(() => import('./pages/customer/Wallet').then(m => ({ default: m.Wallet })));
const PaymentCallback = React.lazy(() => import('./pages/customer/PaymentCallback').then(m => ({ default: m.PaymentCallback })));
const History = React.lazy(() => import('./pages/customer/History').then(m => ({ default: m.History })));
const Support = React.lazy(() => import('./pages/customer/Support').then(m => ({ default: m.Support })));
const Profile = React.lazy(() => import('./pages/customer/Profile').then(m => ({ default: m.Profile })));

// Admin pages
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard').then(m => ({ default: m.AdminDashboard })));
const AdminCustomers = React.lazy(() => import('./pages/admin/Customers').then(m => ({ default: m.AdminCustomers })));
const AdminTodayDeliveries = React.lazy(() => import('./pages/admin/TodayDeliveries').then(m => ({ default: m.TodayDeliveries })));
const BottlesOut = React.lazy(() => import('./pages/admin/BottlesOut').then(m => ({ default: m.BottlesOut })));
const AdminDeliveries = React.lazy(() => import('./pages/admin/Deliveries').then(m => ({ default: m.AdminDeliveries })));
const DeliveryTeam = React.lazy(() => import('./pages/admin/SimpleAdminPages').then(m => ({ default: m.DeliveryTeam })));
const Inventory = React.lazy(() => import('./pages/admin/SimpleAdminPages').then(m => ({ default: m.Inventory })));
const AdminPayments = React.lazy(() => import('./pages/admin/Payments').then(m => ({ default: m.AdminPayments })));
const Penalties = React.lazy(() => import('./pages/admin/SimpleAdminPages').then(m => ({ default: m.Penalties })));
const Reports = React.lazy(() => import('./pages/admin/SimpleAdminPages').then(m => ({ default: m.Reports })));
const Settings = React.lazy(() => import('./pages/admin/SimpleAdminPages').then(m => ({ default: m.Settings })));

// Delivery pages
const TodayDeliveries = React.lazy(() => import('./pages/delivery/TodayDeliveries').then(m => ({ default: m.TodayDeliveries })));
const MyAssignees = React.lazy(() => import('./pages/delivery/MyAssignees').then(m => ({ default: m.MyAssignees })));
const CustomerAction = React.lazy(() => import('./pages/delivery/CustomerAction').then(m => ({ default: m.CustomerAction })));
const DeliveryHistory = React.lazy(() => import('./pages/delivery/History').then(m => ({ default: m.DeliveryHistory })));
const DeliveryChangePassword = React.lazy(() => import('./pages/delivery/ChangePassword').then(m => ({ default: m.DeliveryChangePassword })));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />

              <Route path="/customer/login" element={<CustomerLogin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/delivery/login" element={<DeliveryLogin />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/customer/onboarding" element={<CustomerOnboarding />} />

              <Route
                path="/customer/dashboard"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <CustomerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/subscription"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <Subscription />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/calendar"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <CustomerCalendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/wallet"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <Wallet />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment/callback"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <PaymentCallback />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/history"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <History />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/support"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <Support />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/profile"
                element={
                  <ProtectedRoute allowedUserType="customer">
                    <Profile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/deliveries"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <AdminDeliveries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/today-deliveries"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <AdminTodayDeliveries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/bottles-out"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <BottlesOut />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/customers"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <AdminCustomers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/delivery-team"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <DeliveryTeam />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/inventory"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <Inventory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/payments"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <AdminPayments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/penalties"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <Penalties />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedUserType="admin">
                    <Settings />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/delivery/change-password"
                element={
                  <ProtectedRoute allowedUserType="delivery">
                    <DeliveryChangePassword />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/delivery/today"
                element={
                  <ProtectedRoute allowedUserType="delivery">
                    <DeliveryGuard>
                      <TodayDeliveries />
                    </DeliveryGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/delivery/assignees"
                element={
                  <ProtectedRoute allowedUserType="delivery">
                    <DeliveryGuard>
                      <MyAssignees />
                    </DeliveryGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/delivery/customer/:id"
                element={
                  <ProtectedRoute allowedUserType="delivery">
                    <DeliveryGuard>
                      <CustomerAction />
                    </DeliveryGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/delivery/history"
                element={
                  <ProtectedRoute allowedUserType="delivery">
                    <DeliveryGuard>
                      <DeliveryHistory />
                    </DeliveryGuard>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
