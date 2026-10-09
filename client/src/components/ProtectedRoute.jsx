import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageLoader } from './ui';

/** UI guard only; every admin/staff API call is independently authorised by the backend. */
export default function ProtectedRoute({ roles, children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session…" />;
  if (!user || !role) {
    return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (!roles.includes(role)) {
    return <Navigate to={role === 'staff' ? '/staff/check-in' : '/admin'} replace />;
  }
  return children;
}
