import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RequireUser from './components/RequireUser';
import SignInPage from './pages/SignInPage';
import { PageLoader } from './components/ui';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import PaymentProcessingPage from './pages/PaymentProcessingPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import BookingPage from './pages/BookingPage';
import MyBookingsPage from './pages/MyBookingsPage';
import NotFoundPage from './pages/NotFoundPage';

// Admin bundle (Firebase Auth UI, tables, scanner) is loaded only when needed.
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const RegistrationsPage = lazy(() => import('./pages/admin/RegistrationsPage'));
const RegistrationDetailPage = lazy(() => import('./pages/admin/RegistrationDetailPage'));
const CheckInPage = lazy(() => import('./pages/admin/CheckInPage'));

const ADMIN = ['admin'];
const STAFF = ['admin', 'staff'];

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<SignInPage />} />
          {/* Attendee pages require Google sign-in; bookings belong to the signed-in account. */}
          <Route path="register" element={<RequireUser><RegisterPage /></RequireUser>} />
          <Route path="payment/:registrationNumber/processing" element={<RequireUser><PaymentProcessingPage /></RequireUser>} />
          <Route path="payment/:registrationNumber/failed" element={<RequireUser><PaymentFailedPage /></RequireUser>} />
          <Route path="booking/:registrationNumber" element={<RequireUser><BookingPage /></RequireUser>} />
          <Route path="my-bookings" element={<RequireUser><MyBookingsPage /></RequireUser>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="admin/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute roles={STAFF}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="admin"
            element={
              <ProtectedRoute roles={ADMIN}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/registrations"
            element={
              <ProtectedRoute roles={ADMIN}>
                <RegistrationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/registrations/:registrationId"
            element={
              <ProtectedRoute roles={ADMIN}>
                <RegistrationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="staff/check-in" element={<CheckInPage />} />
          <Route path="admin/*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
