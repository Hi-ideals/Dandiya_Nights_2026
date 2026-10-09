import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Download, PartyPopper, RefreshCw, TicketX } from 'lucide-react';
import { api, downloadFile, errorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../hooks/useConfig';
import { usePayment } from '../hooks/usePayment';
import PricingBreakdown from '../components/PricingBreakdown';
import { EmptyState, PageLoader, Spinner, StatusBadge } from '../components/ui';
import {
  TICKET_TYPE_LABELS,
  categoryLabel,
  competitionsLabel,
  formatDateTime,
  formatINR,
  genderLabel,
  registrationTypeLabel,
} from '../utils/format';

function Detail({ label, children, mono }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={`mt-0.5 font-semibold text-stone-900 ${mono ? 'font-mono text-sm break-all' : ''}`}>{children}</dd>
    </div>
  );
}

function TicketCard({ ticket, index, total, onDownload, downloading, event, category }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-maroon-100">
      <div className="festive-bg flex items-center justify-between px-4 py-3 text-white">
        <p className="font-display text-lg text-gold-300">{event.name}</p>
        <span className="text-xs text-white/70">
          {index} of {total}
        </span>
      </div>
      <div className="flex flex-col items-center p-5">
        <img src={ticket.qrDataUrl} alt={`QR code for ticket ${ticket.ticketNumber}`} className="h-44 w-44" />
        <p className="mt-3 font-mono text-lg font-bold tracking-wide text-maroon-800">{ticket.ticketNumber}</p>
        <p className="mt-1 rounded-full bg-maroon-50 px-3 py-1 text-center text-xs font-semibold text-maroon-800">
          {TICKET_TYPE_LABELS[ticket.ticketType ?? category] ?? `${categoryLabel(category)} entry`}
        </p>
        <div className="mt-2">
          {ticket.checkedIn ? (
            <StatusBadge status="checked_in" label={`Checked in ${formatDateTime(ticket.checkedInAt)}`} />
          ) : ticket.status === 'cancelled' ? (
            <StatusBadge status="cancelled" />
          ) : (
            <StatusBadge status="valid" label="Valid for entry" />
          )}
        </div>
        <button type="button" className="btn-outline mt-4 w-full" onClick={() => onDownload(ticket.ticketNumber)} disabled={downloading}>
          {downloading ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />} Download this ticket
        </button>
      </div>
    </article>
  );
}

export default function BookingPage() {
  const { registrationNumber: rawNumber } = useParams();
  const registrationNumber = rawNumber.toUpperCase();
  const { state } = useLocation();
  const { event } = useConfig();
  const { pay, busy: paying } = usePayment();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/registrations/${registrationNumber}`);
      setBooking(data);
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 404 ? 'no-access' : await errorMessage(err));
    }
  }, [registrationNumber]);

  useEffect(() => {
    load();
  }, [load]);

  async function download(ticketNumber) {
    setDownloading(ticketNumber ?? 'all');
    try {
      const url = ticketNumber
        ? `/tickets/${ticketNumber}/download`
        : `/registrations/${registrationNumber}/tickets/download`;
      await downloadFile(url, {
        fallbackName: `${ticketNumber ?? registrationNumber}.pdf`,
      });
    } catch (err) {
      toast.error(await errorMessage(err, 'Download failed. Please try again.'));
    } finally {
      setDownloading(null);
    }
  }

  async function checkStatus() {
    setChecking(true);
    try {
      const { data } = await api.post('/payments/reconcile', { registrationNumber });
      setBooking(data.booking);
      if (data.booking.paymentStatus === 'paid') toast.success('Payment confirmed!');
      else toast('No successful payment found yet.', { icon: 'ℹ️' });
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  if (error === 'no-access') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="card">
          <EmptyState icon={TicketX} title="Booking not found in this account">
            You're signed in as <strong>{user?.email}</strong>. Booking{' '}
            <span className="font-mono font-semibold">{registrationNumber}</span> was made with a different Google
            account, or doesn't exist. Sign in with the account you used to book, or contact the organisers.
          </EmptyState>
          <div className="pb-6 text-center">
            <Link to="/my-bookings" className="btn-maroon">
              My Tickets
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-stone-700">{error}</p>
        <button type="button" className="btn-maroon mt-4" onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!booking) return <PageLoader label="Loading your booking…" />;

  const paid = booking.paymentStatus === 'paid';

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {paid ? (
        <div className="festive-bg overflow-hidden rounded-3xl p-6 text-center text-white sm:p-10">
          <PartyPopper className="mx-auto h-12 w-12 text-gold-300" />
          <h1 className="mt-3 font-display text-3xl text-gold-300 sm:text-4xl">
            {state?.justPaid ? 'Registration successful!' : 'Your tickets are ready'}
          </h1>
          <p className="mt-2 text-white/80">
            {booking.type === 'competition'
              ? `See you at the competition, ${booking.fullName.split(' ')[0]}! ${event.competitionTime}. Show the QR code at the registration desk.`
              : `See you at ${event.name}, ${booking.fullName.split(' ')[0]}! Show the QR code of each ticket at the entry gate.`}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" className="btn-primary" onClick={() => download(null)} disabled={Boolean(downloading)}>
              {downloading === 'all' ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Download Ticket PDF{booking.tickets.length > 1 ? ` (all ${booking.tickets.length})` : ''}
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center sm:p-8">
          <StatusBadge status={booking.paymentStatus} />
          <h1 className="mt-3 text-2xl font-semibold text-stone-900">Payment pending</h1>
          <p className="mt-2 text-sm text-stone-600">
            Your registration is saved but not confirmed. Tickets are issued after payment is verified.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" className="btn-primary" onClick={() => pay(registrationNumber)} disabled={paying || checking}>
              {paying && <Spinner className="h-4 w-4" />} Pay {formatINR(booking.totalAmountPaise)}
            </button>
            <button type="button" className="btn-outline" onClick={checkStatus} disabled={paying || checking}>
              {checking ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />} I've already paid - check status
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-maroon-800">
            <CheckCircle2 className="h-5 w-5" /> Booking details
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Registration number" mono>
              {booking.registrationNumber}
            </Detail>
            <Detail label="Payment status">
              <StatusBadge status={booking.paymentStatus} />
            </Detail>
            <Detail label="Participant name">{booking.fullName}</Detail>
            <Detail label="Mobile number">+91 {booking.mobileNumber}</Detail>
            <Detail label="Registration for">{registrationTypeLabel(booking.type)}</Detail>
            {booking.type === 'competition' ? (
              <>
                <Detail label="Gender">{genderLabel(booking.gender)}</Detail>
                <Detail label="Competition">{competitionsLabel(booking)}</Detail>
              </>
            ) : (
              <>
                <Detail label="Category">{categoryLabel(booking.category)}</Detail>
                <Detail label="Tickets booked">{booking.ticketQuantity}</Detail>
              </>
            )}
            <Detail label={paid ? 'Total amount paid' : 'Amount due'}>
              {formatINR(paid ? booking.amountPaidPaise : booking.totalAmountPaise)}
            </Detail>
            {paid && (
              <>
                <Detail label="Payment reference" mono>
                  {booking.razorpayPaymentId}
                </Detail>
                <Detail label="Paid on">{formatDateTime(booking.paidAt)}</Detail>
              </>
            )}
          </dl>
          {paid && (
            <div className="mt-5 border-t border-stone-100 pt-4">
              <p className="text-xs text-stone-500">Ticket numbers</p>
              <p className="mt-1 font-mono text-sm font-semibold text-stone-800">
                {booking.tickets.map((t) => t.ticketNumber).join(', ')}
              </p>
            </div>
          )}
        </section>
        <PricingBreakdown
          breakdown={booking.breakdown}
          title={paid ? 'Amount paid' : 'Amount due'}
          totalLabel={paid ? 'Total paid' : 'Total payable'}
        />
      </div>

      {paid && (
        <section className="mt-10">
          <h2 className="section-title text-center text-2xl sm:text-3xl">Your Tickets</h2>
          <p className="mt-1 text-center text-sm text-stone-500">Each QR code admits entry once.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-5 [&>*]:w-full [&>*]:sm:w-72">
            {booking.tickets.map((ticket, i) => (
              <TicketCard
                key={ticket.ticketNumber}
                ticket={ticket}
                index={i + 1}
                total={booking.tickets.length}
                event={event}
                category={booking.category}
                onDownload={download}
                downloading={downloading === ticket.ticketNumber}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
