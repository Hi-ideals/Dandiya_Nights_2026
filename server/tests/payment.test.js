import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createTestContext, SECRETS } from './helpers/setup.js';
import { signCheckout, signWebhook } from './helpers/fakeRazorpay.js';

let ctx;
beforeEach(() => {
  ctx = createTestContext();
});

function webhookRequest(event, { eventId = `evt_${Math.random().toString(36).slice(2)}`, secret } = {}) {
  const body = JSON.stringify(event);
  return ctx.api
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Event-Id', eventId)
    .set('X-Razorpay-Signature', signWebhook(secret ?? SECRETS.webhookSecret, body))
    .send(body);
}

const capturedEvent = (payment) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { ...payment, status: 'captured' } } },
});

describe('create-order', () => {
  it('creates a Razorpay order for the server-calculated amount', async () => {
    const { number, token } = await ctx.register({ category: 'couple', ticketQuantity: 1 });
    const res = await ctx.createOrder(number, token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amountPaise: 53000, currency: 'INR', keyId: 'rzp_test_dummy' });
    expect(res.body.description).toMatch(/Couple Dandiya/);
    expect(ctx.razorpay.orders.get(res.body.orderId).amount).toBe(53000);
    expect(ctx.db.get('payments', res.body.orderId)).toMatchObject({ registrationId: number, status: 'created' });
  });

  it('requires the booking owner to be signed in', async () => {
    const { number } = await ctx.register();
    const res = await ctx.api.post('/api/payments/create-order').send({ registrationNumber: number });
    expect(res.status).toBe(401);
    const other = await ctx.api
      .post('/api/payments/create-order')
      .set(bearer('user2-token'))
      .send({ registrationNumber: number });
    expect(other.status).toBe(404);
  });

  it('reuses the unpaid order on retry instead of creating a second charge', async () => {
    const { number, token } = await ctx.register();
    const first = await ctx.createOrder(number, token);
    await ctx.api
      .post('/api/payments/failure')
      .set(bearer(token))
      .send({ registrationNumber: number, razorpay_order_id: first.body.orderId, cancelled: true });
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('cancelled');

    const retry = await ctx.createOrder(number, token);
    expect(retry.body.orderId).toBe(first.body.orderId);
    expect(ctx.razorpay.orders.size).toBe(1);
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('pending');
  });

  it('releases the lock when the gateway is down so the user can retry', async () => {
    const { number, token } = await ctx.register();
    ctx.razorpay.failOrderCreate = true;
    expect((await ctx.createOrder(number, token)).status).toBe(502);
    ctx.razorpay.failOrderCreate = false;
    expect((await ctx.createOrder(number, token)).status).toBe(200);
  });
});

describe('verify payment', () => {
  it('confirms a successful payment and issues one ticket per booked ticket', async () => {
    const { number, verify, payment } = await ctx.bookAndPay({ category: 'single', ticketQuantity: 3 });
    expect(verify.status).toBe(200);
    expect(verify.body.result).toBe('confirmed');
    expect(verify.body.booking.paymentStatus).toBe('paid');
    expect(verify.body.booking.tickets.map((t) => t.ticketNumber)).toEqual([`${number}-01`, `${number}-02`, `${number}-03`]);
    expect(verify.body.booking.tickets[0].qrDataUrl).toMatch(/^data:image\/png;base64,/);

    const reg = ctx.db.get('registrations', number);
    expect(reg).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', razorpayPaymentId: payment.id, amountPaidPaise: 66000 });
    const tickets = ctx.db.all('tickets');
    expect(tickets).toHaveLength(3);
    expect(new Set(tickets.map((t) => t.qrToken)).size).toBe(3);
    tickets.forEach((t) => expect(t.qrToken).not.toContain('Priya'));
  });

  it('rejects an invalid signature and issues nothing', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(order.body.orderId);
    const res = await ctx.api
      .post('/api/payments/verify')
      .set(bearer(token))
      .send({
        registrationNumber: number,
        razorpay_order_id: order.body.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signCheckout('wrong-secret', order.body.orderId, payment.id),
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('pending');
    expect(ctx.db.all('tickets')).toHaveLength(0);
  });

  it('rejects a payment whose amount does not match the order', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(order.body.orderId, { amount: 100 });
    const res = await ctx.api
      .post('/api/payments/verify')
      .set(bearer(token))
      .send({
        registrationNumber: number,
        razorpay_order_id: order.body.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signCheckout(SECRETS.keySecret, order.body.orderId, payment.id),
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AMOUNT_MISMATCH');
    expect(ctx.db.all('tickets')).toHaveLength(0);
  });

  it("rejects using another booking's order", async () => {
    const a = await ctx.register();
    const b = await ctx.register({}, 'user2-token');
    const orderA = await ctx.createOrder(a.number, a.token);
    const payment = ctx.razorpay.pay(orderA.body.orderId);
    const res = await ctx.api
      .post('/api/payments/verify')
      .set(bearer(b.token))
      .send({
        registrationNumber: b.number,
        razorpay_order_id: orderA.body.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signCheckout(SECRETS.keySecret, orderA.body.orderId, payment.id),
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ORDER_MISMATCH');
  });

  it('rejects a payment that was not captured', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(order.body.orderId, { status: 'failed' });
    const res = await ctx.api
      .post('/api/payments/verify')
      .set(bearer(token))
      .send({
        registrationNumber: number,
        razorpay_order_id: order.body.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signCheckout(SECRETS.keySecret, order.body.orderId, payment.id),
      });
    expect(res.status).toBe(402);
  });

  it('captures an authorized payment before confirming', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(order.body.orderId, { status: 'authorized' });
    const res = await ctx.api
      .post('/api/payments/verify')
      .set(bearer(token))
      .send({
        registrationNumber: number,
        razorpay_order_id: order.body.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signCheckout(SECRETS.keySecret, order.body.orderId, payment.id),
      });
    expect(res.status).toBe(200);
    expect(ctx.razorpay.payments.get(payment.id).status).toBe('captured');
  });

  it('handles duplicate verify callbacks idempotently', async () => {
    const { number, token, orderId, payment } = await ctx.bookAndPay({ ticketQuantity: 2 });
    const body = {
      registrationNumber: number,
      razorpay_order_id: orderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: signCheckout(SECRETS.keySecret, orderId, payment.id),
    };
    const results = await Promise.all(
      [1, 2, 3].map(() => ctx.api.post('/api/payments/verify').set(bearer(token)).send(body)),
    );
    results.forEach((r) => expect(r.status).toBe(200));
    expect(results.map((r) => r.body.result)).toEqual(['already_processed', 'already_processed', 'already_processed']);
    expect(ctx.db.all('tickets')).toHaveLength(2);
  });

  it('create-order after payment reports alreadyPaid', async () => {
    const { number, token } = await ctx.bookAndPay();
    const res = await ctx.createOrder(number, token);
    expect(res.body).toEqual({ alreadyPaid: true, registrationNumber: number });
  });

  it('records a failed payment and allows a retry that succeeds', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    await ctx.api
      .post('/api/payments/failure')
      .set(bearer(token))
      .send({ registrationNumber: number, razorpay_order_id: order.body.orderId, code: 'BAD_REQUEST_ERROR', reason: 'Card declined' });
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('failed');
    expect(ctx.db.get('payments', order.body.orderId).lastError.reason).toBe('Card declined');

    const retry = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(retry.body.orderId);
    const verify = await ctx.api
      .post('/api/payments/verify')
      .set(bearer(token))
      .send({
        registrationNumber: number,
        razorpay_order_id: retry.body.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signCheckout(SECRETS.keySecret, retry.body.orderId, payment.id),
      });
    expect(verify.body.result).toBe('confirmed');
  });

  it('a late failure report never downgrades a paid booking', async () => {
    const { number, token, orderId } = await ctx.bookAndPay();
    const res = await ctx.api
      .post('/api/payments/failure')
      .set(bearer(token))
      .send({ registrationNumber: number, razorpay_order_id: orderId });
    expect(res.body.result).toBe('ignored_already_paid');
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('paid');
  });
});

describe('webhook', () => {
  it('confirms payment from payment.captured when the browser callback never arrived', async () => {
    const { number, token } = await ctx.register({ ticketQuantity: 2 });
    const order = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(order.body.orderId);

    const res = await webhookRequest(capturedEvent(payment));
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('confirmed');
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('paid');
    expect(ctx.db.all('tickets')).toHaveLength(2);
    expect(ctx.db.all('webhookEvents')[0]).toMatchObject({ eventType: 'payment.captured', result: 'confirmed' });
  });

  it('ignores duplicate deliveries of the same event', async () => {
    const { number, token } = await ctx.register({ ticketQuantity: 3 });
    const order = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(order.body.orderId);
    const event = capturedEvent(payment);

    const first = await webhookRequest(event, { eventId: 'evt_same' });
    const second = await webhookRequest(event, { eventId: 'evt_same' });
    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(ctx.db.all('tickets')).toHaveLength(3);
  });

  it('is a no-op after the checkout callback already confirmed', async () => {
    const { payment } = await ctx.bookAndPay({ ticketQuantity: 2 });
    const res = await webhookRequest(capturedEvent(payment));
    expect(res.body.result).toBe('already_processed');
    expect(ctx.db.all('tickets')).toHaveLength(2);
  });

  it('rejects an invalid webhook signature', async () => {
    const res = await webhookRequest({ event: 'payment.captured' }, { secret: 'wrong' });
    expect(res.status).toBe(400);
    expect(ctx.db.all('webhookEvents')).toHaveLength(0);
  });

  it('rejects a webhook whose body was altered after signing', async () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const res = await ctx.api
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signWebhook(SECRETS.webhookSecret, body))
      .send(body.replace('captured', 'failed'));
    expect(res.status).toBe(400);
  });

  it('records payment.failed without touching a paid booking', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    const failed = ctx.razorpay.pay(order.body.orderId, { status: 'failed' });
    const res = await webhookRequest({
      event: 'payment.failed',
      payload: { payment: { entity: { ...failed, error_code: 'BAD_REQUEST_ERROR', error_description: 'declined' } } },
    });
    expect(res.body.result).toBe('failed');
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('failed');
  });

  it('ignores events for orders that are not ours', async () => {
    const res = await webhookRequest(
      capturedEvent({ id: 'pay_OTHER', order_id: 'order_OTHER', amount: 100, currency: 'INR' }),
    );
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('ignored_unknown_order');
  });

  it('flags a second, different successful payment for refund without new tickets', async () => {
    const { orderId } = await ctx.bookAndPay();
    const second = ctx.razorpay.pay(orderId);
    const res = await webhookRequest(capturedEvent(second));
    expect(res.body.result).toBe('duplicate_payment');
    expect(ctx.db.get('payments', orderId)).toMatchObject({ status: 'duplicate', requiresRefund: true });
    expect(ctx.db.all('tickets')).toHaveLength(1);
  });

  it('returns 5xx on a temporary database failure so Razorpay retries, then succeeds', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    const payment = ctx.razorpay.pay(order.body.orderId);
    const event = capturedEvent(payment);

    ctx.db.failTransactions(1);
    const failed = await webhookRequest(event, { eventId: 'evt_retry' });
    expect(failed.status).toBe(500);
    expect(ctx.db.get('registrations', number).paymentStatus).toBe('pending');

    const retried = await webhookRequest(event, { eventId: 'evt_retry' });
    expect(retried.status).toBe(200);
    expect(retried.body.result).toBe('confirmed');
  });
});

describe('reconcile (recovery)', () => {
  it('confirms a booking that was paid while both callback and webhook were lost', async () => {
    const { number, token } = await ctx.register();
    const order = await ctx.createOrder(number, token);
    ctx.razorpay.pay(order.body.orderId);

    const res = await ctx.api.post('/api/payments/reconcile').set(bearer(token)).send({ registrationNumber: number });
    expect(res.status).toBe(200);
    expect(res.body.booking.paymentStatus).toBe('paid');
    expect(res.body.booking.tickets).toHaveLength(1);
  });

  it('leaves an unpaid booking pending', async () => {
    const { number, token } = await ctx.register();
    await ctx.createOrder(number, token);
    const res = await ctx.api.post('/api/payments/reconcile').set(bearer(token)).send({ registrationNumber: number });
    expect(res.body.booking.paymentStatus).toBe('pending');
  });
});
