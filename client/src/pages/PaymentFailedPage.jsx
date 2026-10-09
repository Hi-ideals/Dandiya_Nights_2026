import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { usePayment } from '../hooks/usePayment';
import { PageLoader, Spinner, StatusBadge } from '../components/ui';
import { formatINR } from '../utils/format';

const COPY = {
  cancelled: {
    icon: XCircle,
    title: 'Payment cancelled',
    body: 'You closed the payment window before completing the payment. Your registration is saved - you can pay now.',
  },
  failed: {
    icon: XCircle,
    title: 'Payment failed',
    body: 'Your payment did not go through. No ticket has been issued. If money was deducted it will be refunded by your bank automatically.',
  },
  pending: {
    icon: AlertTriangle,
    title: 'Payment not completed yet',
    body: 'We have not received a successful payment for this booking. If you just paid, wait a minute and check again.',
  },
  verification: {
    icon: AlertTriangle,
    title: "We couldn't verify this payment",
    body: 'The payment could not be verified, so no ticket was issued. If money was deducted, check status below before paying again.',
  },
};

export default function PaymentFailedPage() {
  const { registrationNumber } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pay, busy } = usePayment();
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const reason = COPY[params.get('reason')] ? params.get('reason') : 'failed';
  const { icon: Icon, title, body } = COPY[reason];

  useEffect(() => {
    api
      .get(`/registrations/${registrationNumber}/status`)
      .then(({ data }) => {
        if (data.paymentStatus === 'paid') navigate(`/booking/${registrationNumber}`, { replace: true });
        else setStatus(data);
      })
      .catch(() => setStatus({ missing: true }));
  }, [navigate, registrationNumber]);

  async function checkStatus() {
    setChecking(true);
    try {
      const { data } = await api.post(
        '/payments/reconcile',
        { registrationNumber },
      );
      if (data.booking.paymentStatus === 'paid') {
        toast.success('Payment confirmed!');
        navigate(`/booking/${registrationNumber}`, { replace: true, state: { justPaid: true } });
      } else {
        toast('No successful payment found yet.', { icon: 'ℹ️' });
        setStatus((s) => ({ ...s, paymentStatus: data.booking.paymentStatus }));
      }
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  if (!status) return <PageLoader />;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="card p-6 text-center sm:p-8">
        <Icon className={`mx-auto h-14 w-14 ${reason === 'cancelled' || reason === 'failed' ? 'text-red-500' : 'text-amber-500'}`} />
        <h1 className="mt-4 text-2xl font-semibold text-stone-900">{title}</h1>
        <p className="mt-2 text-sm text-stone-600">{body}</p>

        {!status.missing && (
          <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-4 text-left text-sm">
            <div>
              <dt className="text-xs text-stone-500">Registration No.</dt>
              <dd className="font-mono font-semibold">{registrationNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Status</dt>
              <dd>
                <StatusBadge status={status.paymentStatus} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Tickets</dt>
              <dd className="font-semibold capitalize">
                {status.type === 'competition'
                  ? `${status.ticketQuantity} competition entr${status.ticketQuantity > 1 ? 'ies' : 'y'}`
                  : `${status.ticketQuantity} × ${status.category}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Amount</dt>
              <dd className="font-semibold">{formatINR(status.totalAmountPaise)}</dd>
            </div>
          </dl>
        )}

        {!status.missing && (
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" className="btn-primary py-3" onClick={() => pay(registrationNumber)} disabled={busy || checking}>
              {busy ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Retry payment
            </button>
            <button type="button" className="btn-outline" onClick={checkStatus} disabled={busy || checking}>
              {checking && <Spinner className="h-4 w-4" />} I've already paid - check status
            </button>
          </div>
        )}
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-maroon-700">
          Back to home
        </Link>
      </div>
    </div>
  );
}
