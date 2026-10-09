import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../services/api';
import { loadRazorpay } from '../services/razorpay';

/**
 * Opens Razorpay Checkout for a registration. The success handler only forwards the
 * signed response to the processing page; the backend decides whether payment succeeded.
 */
export function usePayment() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const reportFailure = useCallback((registrationNumber, body) => {
    return api
      .post('/payments/failure', { registrationNumber, ...body })
      .catch(() => {}); // best effort; webhook also records failures
  }, []);

  const pay = useCallback(
    async (registrationNumber) => {
      setBusy(true);
      try {
        const { data } = await api.post(
          '/payments/create-order',
          { registrationNumber },
        );
        if (data.alreadyPaid) {
          toast.success('Payment already confirmed!');
          navigate(`/booking/${registrationNumber}`);
          return;
        }

        const Razorpay = await loadRazorpay();
        let completed = false;
        let lastFailure = null;

        const checkout = new Razorpay({
          key: data.keyId,
          order_id: data.orderId,
          amount: data.amountPaise,
          currency: data.currency,
          name: data.name,
          description: data.description,
          prefill: data.prefill,
          notes: { registrationNumber },
          theme: { color: '#7a1035' },
          retry: { enabled: true, max_count: 3 },
          handler(response) {
            completed = true;
            navigate(`/payment/${registrationNumber}/processing`, { replace: true, state: { response } });
          },
          modal: {
            confirm_close: true,
            ondismiss() {
              if (completed) return;
              const reason = lastFailure ? 'failed' : 'cancelled';
              reportFailure(registrationNumber, {
                razorpay_order_id: data.orderId,
                cancelled: !lastFailure,
                code: lastFailure?.code,
                reason: lastFailure?.description ?? 'Checkout closed by user',
              }).finally(() => navigate(`/payment/${registrationNumber}/failed?reason=${reason}`));
            },
          },
        });

        checkout.on('payment.failed', ({ error }) => {
          lastFailure = error;
          reportFailure(registrationNumber, {
            razorpay_order_id: data.orderId,
            razorpay_payment_id: error?.metadata?.payment_id,
            cancelled: false,
            code: error?.code,
            reason: error?.description,
          });
        });

        checkout.open();
      } catch (err) {
        toast.error(err?.isAxiosError ? await errorMessage(err) : err.message);
      } finally {
        setBusy(false);
      }
    },
    [navigate, reportFailure],
  );

  return { pay, busy };
}
