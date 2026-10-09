import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BadgeCheck,
  Brush,
  Clock,
  Flower2,
  Heart,
  IndianRupee,
  RefreshCw,
  ScanLine,
  Ticket,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { adminApi, errorMessage } from '../../services/api';
import ExportMenu from '../../components/ExportMenu';
import { PageLoader, Spinner, StatusBadge } from '../../components/ui';
import { categoryLabel, formatDateTime, formatINR } from '../../utils/format';

function Stat({ icon: Icon, label, value, tone = 'maroon', sub }) {
  const tones = {
    maroon: 'bg-maroon-50 text-maroon-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    sky: 'bg-sky-50 text-sky-700',
    gold: 'bg-gold-100 text-gold-600',
  };
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-stone-500">{label}</p>
        <p className="text-xl font-bold text-stone-900 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-stone-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await adminApi.get('/admin/dashboard');
      setData(res.data);
      setError('');
    } catch (err) {
      setError(await errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data && error) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-stone-700">{error}</p>
        <button type="button" className="btn-maroon mt-4" onClick={load}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return <PageLoader label="Loading dashboard…" />;

  const s = data.summary;
  const totalTickets = s.ticketsCheckedIn + s.ticketsRemaining;
  const checkedPct = totalTickets ? Math.round((s.ticketsCheckedIn / totalTickets) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-sm text-stone-500">Updated {formatDateTime(data.generatedAt)}</p>
        </div>
        <button type="button" className="btn-outline" onClick={load} disabled={refreshing}>
          {refreshing ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={IndianRupee} label="Verified revenue" value={formatINR(s.verifiedRevenuePaise)} tone="green" sub="Successful payments only" />
        <Stat icon={Users} label="Total registrations" value={s.totalRegistrations} />
        <Stat icon={BadgeCheck} label="Confirmed registrations" value={s.confirmedRegistrations} tone="green" />
        <Stat icon={Ticket} label="Total tickets booked" value={s.totalTicketsBooked} tone="gold" sub="Confirmed bookings" />
        <Stat icon={Clock} label="Pending payments" value={s.pendingPayments} tone="amber" sub={s.cancelledPayments ? `+ ${s.cancelledPayments} cancelled` : undefined} />
        <Stat icon={XCircle} label="Failed payments" value={s.failedPayments} tone="red" />
        <Stat icon={Heart} label="Couple tickets" value={s.coupleTickets} />
        <Stat icon={User} label="Single tickets" value={s.singleTickets} />
        <Stat icon={Flower2} label="Rangoli participants" value={s.rangoliParticipants} tone="sky" />
        <Stat icon={Brush} label="Drawing participants" value={s.drawingParticipants} tone="sky" />
        <Stat icon={ScanLine} label="Tickets checked in" value={s.ticketsCheckedIn} tone="green" />
        <Stat icon={Ticket} label="Remaining to check in" value={s.ticketsRemaining} tone="amber" />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold text-stone-800">Entry progress</p>
          <p className="text-stone-500">
            {s.ticketsCheckedIn} / {totalTickets} tickets ({checkedPct}%)
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-linear-to-r from-gold-400 to-maroon-600 transition-all" style={{ width: `${checkedPct}%` }} />
        </div>
      </div>

      <div className="card p-4">
        <ExportMenu />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <h2 className="font-semibold text-stone-900">Recent registrations</h2>
          <Link to="/admin/registrations" className="text-sm font-medium text-maroon-700">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500 uppercase">
              <tr>
                <th className="px-4 py-2.5">Reg. No.</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Tickets</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                    No registrations yet.
                  </td>
                </tr>
              )}
              {data.recent.map((r) => (
                <tr key={r.registrationNumber} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link to={`/admin/registrations/${r.registrationNumber}`} className="font-semibold text-maroon-700">
                      {r.registrationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{r.fullName}</td>
                  <td className="px-4 py-2.5">
                    {r.ticketQuantity} × {categoryLabel(r.category)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{formatINR(r.totalAmountPaise)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={r.paymentStatus} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-500">{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
