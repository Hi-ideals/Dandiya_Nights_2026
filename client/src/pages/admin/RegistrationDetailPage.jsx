import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { adminApi, errorMessage } from '../../services/api';
import PricingBreakdown from '../../components/PricingBreakdown';
import { EmptyState, PageLoader, StatusBadge } from '../../components/ui';
import { categoryLabel, competitionsLabel, formatDateTime, formatINR } from '../../utils/format';

function Item({ label, children, mono }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={`mt-0.5 text-stone-900 ${mono ? 'font-mono text-sm break-all' : 'font-medium'}`}>{children ?? '-'}</dd>
    </div>
  );
}

export default function RegistrationDetailPage() {
  const { registrationId } = useParams();
  const [reg, setReg] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .get(`/admin/registrations/${registrationId}`)
      .then(({ data }) => setReg(data))
      .catch(async (err) => setError(await errorMessage(err)));
  }, [registrationId]);

  if (error) {
    return (
      <div className="card">
        <EmptyState icon={AlertTriangle} title="Couldn't load registration">
          {error}
        </EmptyState>
      </div>
    );
  }
  if (!reg) return <PageLoader />;

  return (
    <div className="space-y-6">
      <Link to="/admin/registrations" className="inline-flex items-center gap-1 text-sm font-medium text-maroon-700">
        <ArrowLeft className="h-4 w-4" /> All registrations
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-stone-900">{reg.registrationNumber}</h1>
        <StatusBadge status={reg.paymentStatus} />
      </div>

      {reg.payments.some((p) => p.requiresRefund) && (
        <p className="flex items-center gap-2 rounded-xl bg-purple-50 p-3 text-sm text-purple-800">
          <AlertTriangle className="h-4 w-4" /> A duplicate payment was received for this booking and needs a manual refund in Razorpay.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <h2 className="font-semibold text-maroon-800">Participant</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Item label="Name">{reg.fullName}</Item>
            <Item label="Mobile">+91 {reg.mobileNumber}</Item>
            <div className="sm:col-span-2">
              <Item label="Address">{reg.address}</Item>
            </div>
            <Item label="Category">{categoryLabel(reg.category)}</Item>
            <Item label="Tickets">{reg.ticketQuantity}</Item>
            <Item label="Competitions">{competitionsLabel(reg)}</Item>
            <Item label="Pricing version">{reg.pricingVersion}</Item>
            <Item label="Registered at">{formatDateTime(reg.createdAt)}</Item>
            <Item label="Paid at">{reg.paidAt ? formatDateTime(reg.paidAt) : '-'}</Item>
            <Item label="Amount paid">{reg.amountPaidPaise ? formatINR(reg.amountPaidPaise) : '-'}</Item>
            <Item label="Razorpay payment ID" mono>
              {reg.razorpayPaymentId}
            </Item>
          </dl>
        </section>
        <PricingBreakdown breakdown={reg.breakdown} title="Charged amount" totalLabel="Total" />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-stone-100 px-5 py-3 font-semibold text-maroon-800">
          Tickets ({reg.tickets.length}) · {reg.checkIn.checkedIn} checked in
        </h2>
        {reg.tickets.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">Tickets are issued after payment is verified.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {reg.tickets.map((t) => (
              <li key={t.ticketNumber} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-mono font-semibold">{t.ticketNumber}</span>
                {t.checkedIn ? (
                  <span className="text-stone-600">
                    <StatusBadge status="checked_in" /> {formatDateTime(t.checkedInAt)} by {t.checkedInBy ?? 'staff'}
                  </span>
                ) : (
                  <StatusBadge status={t.status === 'cancelled' ? 'cancelled' : 'valid'} label={t.status === 'cancelled' ? 'Cancelled' : 'Not checked in'} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-stone-100 px-5 py-3 font-semibold text-maroon-800">Payment attempts</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500 uppercase">
              <tr>
                <th className="px-4 py-2">Order ID</th>
                <th className="px-4 py-2">Payment ID</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Verified</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reg.payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
                    No payment started yet.
                  </td>
                </tr>
              )}
              {reg.payments.map((p) => (
                <tr key={p.razorpayOrderId}>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.razorpayOrderId}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.razorpayPaymentId ?? '-'}</td>
                  <td className="px-4 py-2.5">{formatINR(p.amountPaise)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">
                    {p.verifiedAt ? `${formatDateTime(p.verifiedAt)} (${p.verifiedVia})` : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">
                    {p.method && <span className="uppercase">{p.method}</span>}
                    {p.lastError && ` ${p.lastError.reason ?? p.lastError.code ?? ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
