import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { authErrorMessage, useAuth } from '../../hooks/useAuth';
import { DandiyaSticks } from '../../components/Poster';
import { Field, PageLoader, Spinner } from '../../components/ui';

export default function LoginPage() {
  const { user, role, loading, loginAsOrganiser, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = location.state?.from;
  const home = (r) => (r === 'staff' ? '/staff/check-in' : '/admin');

  if (loading) return <PageLoader />;
  if (user && role) return <Navigate to={from || home(role)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await loginAsOrganiser(email.trim(), password);
      navigate(from || home(r), { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="festive-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <DandiyaSticks className="h-10 w-10" />
          <span className="font-display text-2xl text-gold-300">Dandiya Nights</span>
        </Link>
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8" noValidate>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
            <Lock className="h-5 w-5 text-maroon-700" /> Admin & Staff Login
          </h1>
          <p className="mt-1 text-sm text-stone-500">Authorised organisers only.</p>

          {!configured && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Firebase is not configured. Add the VITE_FIREBASE_* values to <code>client/.env</code>.
            </p>
          )}

          <div className="mt-6 space-y-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
          </div>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-maroon mt-6 w-full py-3" disabled={busy || !configured || !email || !password}>
            {busy && <Spinner className="h-4 w-4" />} Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
