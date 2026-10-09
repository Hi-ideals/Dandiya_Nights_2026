import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, Ticket } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { EmptyState, PageLoader, StatusBadge } from '../components/ui';
import { categoryLabel, competitionsLabel, formatDateTime, formatINR, registrationTypeLabel } from '../utils/format';

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/me/bookings');
      setItems(data.items);
      setError('');
    } catch (err) {
      setError(await errorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="section-title">My Tickets</h1>
      <p className="mt-2 text-sm text-stone-600">
        Bookings for <strong>{user?.email}</strong>. Sign in with this Google account on any device to see them.
      </p>

      <div className="card mt-6 divide-y divide-stone-100">
        {error ? (
          <EmptyState icon={AlertCircle} title="Couldn't load your bookings">
            {error}
            <div className="mt-3">
              <button type="button" className="btn-maroon" onClick={load}>
                Try again
              </button>
            </div>
          </EmptyState>
        ) : !items ? (
          <PageLoader label="Loading your bookings…" />
        ) : items.length === 0 ? (
          <EmptyState icon={Ticket} title="No bookings in this account yet">
            If you booked with a different Google account, sign out and sign in with that one.
            <div className="mt-3">
              <Link to="/register" className="btn-primary">
                Register now
              </Link>
            </div>
          </EmptyState>
        ) : (
          items.map((b) => (
            <Link
              key={b.registrationNumber}
              to={`/booking/${b.registrationNumber}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-maroon-50/50"
            >
              <div className="min-w-0">
                <p className="font-mono font-semibold text-maroon-800">{b.registrationNumber}</p>
                <p className="text-xs font-semibold tracking-wide text-gold-600 uppercase">{registrationTypeLabel(b.type)}</p>
                <p className="truncate text-sm text-stone-700">
                  {b.fullName} ·{' '}
                  {b.type === 'competition'
                    ? competitionsLabel(b)
                    : `${b.ticketQuantity} × ${categoryLabel(b.category)}`}{' '}
                  · {formatINR(b.totalAmountPaise)}
                </p>
                <p className="text-xs text-stone-500">Booked {formatDateTime(b.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={b.paymentStatus} />
                <ChevronRight className="h-5 w-5 text-stone-400" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
