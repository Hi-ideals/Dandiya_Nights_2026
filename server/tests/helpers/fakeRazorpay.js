import crypto from 'node:crypto';

/** In-memory stand-in for the Razorpay SDK (orders + payments). */
export class FakeRazorpay {
  constructor() {
    this.orders = new Map();
    this.payments = new Map();
    this.counter = 0;
    this.failOrderCreate = false;

    const self = this;
    this.orders.create = async ({ amount, currency, receipt, notes }) => {
      if (self.failOrderCreate) throw new Error('gateway down');
      self.counter += 1;
      const order = { id: `order_TEST${self.counter}`, amount, currency, receipt, notes, status: 'created' };
      self.orders.set(order.id, order);
      return { ...order };
    };
    this.orders.fetchPayments = async (orderId) => ({
      items: [...self.payments.values()].filter((p) => p.order_id === orderId).map((p) => ({ ...p })),
    });
    this.payments.fetch = async (id) => {
      const payment = self.payments.get(id);
      if (!payment) throw new Error('payment not found');
      return { ...payment };
    };
    this.payments.capture = async (id, amount, currency) => {
      const payment = self.payments.get(id);
      if (payment.status !== 'authorized') throw new Error('already captured');
      if (amount !== payment.amount || currency !== payment.currency) throw new Error('bad amount');
      payment.status = 'captured';
      return { ...payment };
    };
  }

  /** Simulates the attendee paying an order through Checkout. */
  pay(orderId, { status = 'captured', amount, method = 'upi' } = {}) {
    const order = this.orders.get(orderId);
    this.counter += 1;
    const payment = {
      id: `pay_TEST${this.counter}`,
      order_id: orderId,
      amount: amount ?? order.amount,
      currency: order.currency,
      status,
      method,
    };
    this.payments.set(payment.id, payment);
    if (status === 'captured') order.status = 'paid';
    return payment;
  }
}

export const signCheckout = (secret, orderId, paymentId) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

export const signWebhook = (secret, body) => crypto.createHmac('sha256', secret).update(body).digest('hex');
