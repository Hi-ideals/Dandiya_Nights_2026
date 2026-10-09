import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api, errorCode } from '../services/api';
import { Spinner } from '../components/ui';

const RETRY_DELAYS = [1500, 3000, 6000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTransient = (err) => !err?.response || err.response.status >= 500 || err.response.status === 429;

/**
 * Sends Razorpay's signed response to the backend. Nothing here assumes success:
 * the booking is confirmed only when the server verifies the signature and payment.
 */
export default function PaymentProcessingPage() {
  const { registrationNumber } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);
  const [stuck, setStuck] = useState(false);
  const [message, setMessage] = useState('Confirming your payment securely…');

  const reconcile = useCallback(async () => {
    const { data } = await api.post(
      '/payments/reconcile',
      { registrationNumber },
    );
    return data.booking.paymentStatus === 'paid';
  }, [registrationNumber]);

  const run = useCallback(async () => {
    setStuck(false);
    const response = state?.response;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
      try {
        if (response) {
          await api.post(
            '/payments/verify',
            {
              registrationNumber,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          );
          navigate(`/booking/${registrationNumber}`, { replace: true, state: { justPaid: true } });
          return;
        }
        // Page refreshed / opened without a checkout response: ask the server to check Razorpay.
        if (await reconcile()) {
          navigate(`/booking/${registrationNumber}`, { replace: true, state: { justPaid: true } });
        } else {
          navigate(`/payment/${registrationNumber}/failed?reason=pending`, { replace: true });
        }
        return;
      } catch (err) {
        if (!isTransient(err)) {
          const code = errorCode(err) ?? 'VERIFICATION_FAILED';
          if (code === 'BOOKING_NOT_FOUND') {
            navigate(`/booking/${registrationNumber}`, { replace: true });
            return;
          }
          navigate(`/payment/${registrationNumber}/failed?reason=verification&code=${encodeURIComponent(code)}`, {
            replace: true,
          });
          return;
        }
        if (attempt < RETRY_DELAYS.length) {
          setMessage('Still confirming… please keep this page open.');
          await sleep(RETRY_DELAYS[attempt]);
        }
      }
    }

    // Verification endpoint unreachable: try reconciliation once before giving up.
    try {
      if (await reconcile()) {
        navigate(`/booking/${registrationNumber}`, { replace: true, state: { justPaid: true } });
        return;
      }
    } catch {
      // fall through to the "stuck" screen
    }
    setStuck(true);
  }, [navigate, reconcile, registrationNumber, state]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      {stuck ? (
        <>
          <h1 className="text-2xl font-semibold text-stone-900">We couldn't confirm your payment yet</h1>
          <p className="mt-3 text-sm text-stone-600">
            If money was deducted, don't pay again. Your payment is confirmed automatically once Razorpay notifies us.
            Booking <span className="font-mono font-semibold">{registrationNumber}</span>.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" className="btn-maroon" onClick={run}>
              Check again
            </button>
            <Link to={`/booking/${registrationNumber}`} className="btn-outline">
              View booking
            </Link>
          </div>
        </>
      ) : (
        <>
          <Spinner className="h-12 w-12 text-maroon-700" />
          <h1 className="mt-6 text-2xl font-semibold text-stone-900">{message}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-stone-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Please don't close or refresh this page.
          </p>
        </>
      )}
    </div>
  );
}
