import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DeliveryGuard } from './components/DeliveryGuard';

import { Home } from './pages/Home';
import { CustomerLogin } from './pages/auth/CustomerLogin';
import { AdminLogin } from './pages/auth/AdminLogin';
import { DeliveryLogin } from './pages/auth/DeliveryLogin';
import { AuthCallback } from './pages/auth/AuthCallback';

import { CustomerDashboard } from './pages/customer/Dashboard';
import { CustomerOnboarding } from './pages/customer/Onboarding';
import { Subscription } from './pages/customer/Subscription';
import { CustomerCalendar } from './pages/customer/Calendar';
import { Wallet } from './pages/customer/Wallet';
import { History } from './pages/customer/History';
import { Support } from './pages/customer/Support';

import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminCustomers } from './pages/admin/Customers';
import { DeliveryTeam, Zones, Inventory, Penalties, Reports, Settings } from './pages/admin/SimpleAdminPages';

import { TodayDeliveries } from './pages/delivery/TodayDeliveries';
import { MyAssignees } from './pages/delivery/MyAssignees';
import { CustomerAction } from './pages/delivery/CustomerAction';
import { DeliveryHistory } from './pages/delivery/History';
import { DeliveryChangePassword } from './pages/delivery/ChangePassword';

function App() {
  return (
    <AuthProvider>
      <Router>
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
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedUserType="admin">
                <AdminDashboard />
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
            path="/admin/zones"
            element={
              <ProtectedRoute allowedUserType="admin">
                <Zones />
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
      </Router>
    </AuthProvider>
  );
}

export default App;
