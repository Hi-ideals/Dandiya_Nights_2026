import { getDb, serverTimestamp } from '../config/firebase.js';
import { getRazorpay } from '../config/razorpay.js';
import { env } from '../config/env.js';
import { getEventConfig } from '../config/event.js';
import {
  COLLECTIONS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REGISTRATION_STATUS,
  TICKET_STATUS,
  registrationType,
  ticketTypesFor,
} from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import {
  buildTicketNumber,
  generateQrToken,
  isValidPaymentSignature,
  isValidWebhookSignature,
  sha256,
} from '../utils/crypto.js';
import { toDate } from '../utils/format.js';

const ORDER_LOCK_MS = 30_000;
const REUSABLE_ORDER_STATUSES = [ORDER_STATUS.created, ORDER_STATUS.failed, ORDER_STATUS.cancelled];

const col = (name) => getDb().collection(name);

function checkoutDescription(reg) {
  if (registrationType(reg) === 'competition') {
    const names = [reg.rangoliSelected && 'Rangoli', reg.drawingSelected && 'Drawing'].filter(Boolean);
    return `${names.join(' & ')} competition entry`;
  }
  return `${reg.ticketQuantity} x ${reg.category === 'couple' ? 'Couple' : 'Single'} Dandiya ticket(s)`;
}

function checkoutPayload(reg, orderId) {
  return {
    alreadyPaid: false,
    keyId: env.razorpay.keyId,
    orderId,
    amountPaise: reg.totalAmountPaise,
    currency: reg.currency,
    registrationNumber: reg.registrationNumber,
    name: getEventConfig().name,
    description: checkoutDescription(reg),
    prefill: { name: reg.fullName, contact: `+91${reg.mobileNumber}` },
  };
}

/**
 * Creates (or safely reuses) the Razorpay order for a pending registration.
 * The amount always comes from the registration's server-side pricing snapshot.
 */
export async function createOrder(registrationNumber) {
  const db = getDb();
  const regRef = col(COLLECTIONS.registrations).doc(registrationNumber);

  const state = await db.runTransaction(async (tx) => {
    const regSnap = await tx.get(regRef);
    if (!regSnap.exists) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const reg = regSnap.data();
    if (reg.paymentStatus === PAYMENT_STATUS.paid) return { alreadyPaid: true, reg };

    if (reg.activeOrderId) {
      const paySnap = await tx.get(col(COLLECTIONS.payments).doc(reg.activeOrderId));
      const pay = paySnap.exists ? paySnap.data() : null;
      if (pay && pay.amountPaise === reg.totalAmountPaise && REUSABLE_ORDER_STATUSES.includes(pay.status)) {
        // Retrying payment: reuse the unpaid order so a retry can never create a second charge.
        tx.update(regRef, { paymentStatus: PAYMENT_STATUS.pending, updatedAt: serverTimestamp() });
        tx.update(paySnap.ref, { status: ORDER_STATUS.created, updatedAt: serverTimestamp() });
        return { reuseOrderId: reg.activeOrderId, reg };
      }
    }

    const lockUntil = toDate(reg.orderLockUntil);
    if (lockUntil && lockUntil.getTime() > Date.now()) {
      throw new AppError(409, 'ORDER_IN_PROGRESS', 'Your payment is being prepared. Please try again in a few seconds.');
    }
    tx.update(regRef, { orderLockUntil: new Date(Date.now() + ORDER_LOCK_MS) });
    return { reg };
  });

  if (state.alreadyPaid) return { alreadyPaid: true, registrationNumber };

  if (state.reuseOrderId) {
    // Recovery path: the order may have been paid while our callback/webhook was lost.
    const { paid } = await reconcileOrder(state.reuseOrderId);
    if (paid) return { alreadyPaid: true, registrationNumber };
    return checkoutPayload(state.reg, state.reuseOrderId);
  }

  const { reg } = state;
  let order;
  try {
    order = await getRazorpay().orders.create({
      amount: reg.totalAmountPaise,
      currency: reg.currency,
      receipt: registrationNumber,
      notes: { registrationNumber },
    });
  } catch (err) {
    await regRef.update({ orderLockUntil: null });
    if (err instanceof AppError) throw err;
    console.error('[razorpay] order creation failed', err?.error ?? err);
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Could not reach the payment gateway. Please try again.');
  }

  if (order.amount !== reg.totalAmountPaise || order.currency !== reg.currency) {
    await regRef.update({ orderLockUntil: null });
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Payment gateway returned an unexpected amount');
  }

  await db.runTransaction(async (tx) => {
    const regSnap = await tx.get(regRef);
    const current = regSnap.data();
    tx.set(col(COLLECTIONS.payments).doc(order.id), {
      registrationId: registrationNumber,
      razorpayOrderId: order.id,
      razorpayPaymentId: null,
      amountPaise: order.amount,
      currency: order.currency,
      status: ORDER_STATUS.created,
      verifiedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const update = { activeOrderId: order.id, orderLockUntil: null, updatedAt: serverTimestamp() };
    if (current.paymentStatus !== PAYMENT_STATUS.paid) {
      update.razorpayOrderId = order.id;
      update.paymentStatus = PAYMENT_STATUS.pending;
    }
    tx.update(regRef, update);
  });

  return checkoutPayload(reg, order.id);
}

/**
 * Single, idempotent state transition from "pending" to "paid" + ticket issuance.
 * Called by the checkout callback, the webhook and reconciliation; whichever
 * arrives first wins and the others become no-ops.
 */
export async function confirmPayment({ orderId, paymentId, amountPaise, currency, method, source }) {
  const db = getDb();
  const payRef = col(COLLECTIONS.payments).doc(orderId);

  return db.runTransaction(async (tx) => {
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) throw new AppError(404, 'ORDER_NOT_FOUND', 'Payment order not found');
    const pay = paySnap.data();

    const regRef = col(COLLECTIONS.registrations).doc(pay.registrationId);
    const regSnap = await tx.get(regRef);
    if (!regSnap.exists) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const reg = regSnap.data();

    if (amountPaise !== pay.amountPaise || currency !== pay.currency) {
      throw new AppError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match the order');
    }

    if (reg.paymentStatus === PAYMENT_STATUS.paid) {
      if (reg.razorpayPaymentId === paymentId) {
        return { result: 'already_processed', registrationNumber: reg.registrationNumber };
      }
      // A different successful payment for an already-paid booking: flag for refund, issue nothing.
      if (pay.status !== ORDER_STATUS.duplicate || pay.razorpayPaymentId !== paymentId) {
        tx.update(payRef, {
          status: ORDER_STATUS.duplicate,
          razorpayPaymentId: paymentId,
          requiresRefund: true,
          verifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      console.warn(`[payments] duplicate payment ${paymentId} for ${reg.registrationNumber}; refund required`);
      return { result: 'duplicate_payment', registrationNumber: reg.registrationNumber };
    }

    if (amountPaise !== reg.totalAmountPaise) {
      throw new AppError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match the booking');
    }

    // Dandiya: one ticket per Couple/Single entry. Competition: one per selected competition.
    const ticketTypes = ticketTypesFor(reg);
    const ticketNumbers = ticketTypes.map((_, i) => buildTicketNumber(reg.registrationNumber, i + 1));

    tx.update(payRef, {
      status: ORDER_STATUS.paid,
      razorpayPaymentId: paymentId,
      method: method ?? null,
      verifiedVia: source,
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(regRef, {
      status: REGISTRATION_STATUS.confirmed,
      paymentStatus: PAYMENT_STATUS.paid,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      amountPaidPaise: amountPaise,
      ticketNumbers,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Deterministic ticket IDs inside the same transaction make duplicate tickets impossible.
    ticketNumbers.forEach((ticketNumber, i) => {
      tx.set(col(COLLECTIONS.tickets).doc(ticketNumber), {
        registrationId: reg.registrationNumber,
        registrationNumber: reg.registrationNumber,
        ticketNumber,
        category: reg.category ?? null,
        ticketType: ticketTypes[i],
        qrToken: generateQrToken(),
        status: TICKET_STATUS.active,
        checkedIn: false,
        checkedInAt: null,
        checkedInBy: null,
        createdAt: serverTimestamp(),
      });
    });

    return { result: 'confirmed', registrationNumber: reg.registrationNumber };
  });
}

/** Fetches the payment from Razorpay, validates it against our order, captures if needed. */
async function fetchVerifiedPayment(paymentId, order) {
  const razorpay = getRazorpay();
  let payment;
  try {
    payment = await razorpay.payments.fetch(paymentId);
  } catch (err) {
    console.error('[razorpay] payment fetch failed', err?.error ?? err);
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Could not confirm the payment right now. Please retry verification.');
  }

  if (payment.order_id !== order.razorpayOrderId) {
    throw new AppError(400, 'ORDER_MISMATCH', 'Payment does not belong to this order');
  }
  if (payment.amount !== order.amountPaise || payment.currency !== order.currency) {
    throw new AppError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match the order');
  }

  if (payment.status === 'authorized') {
    try {
      payment = await razorpay.payments.capture(paymentId, payment.amount, payment.currency);
    } catch {
      // Possibly captured concurrently (auto-capture/webhook); re-read the truth.
      payment = await razorpay.payments.fetch(paymentId);
    }
  }
  if (payment.status !== 'captured') {
    throw new AppError(402, 'PAYMENT_NOT_CAPTURED', 'Payment has not been completed');
  }
  return payment;
}

/** Checkout success callback. Never trusted on its own: signature + Razorpay API checks. */
export async function verifyPayment({ registrationNumber, orderId, paymentId, signature }) {
  if (!isValidPaymentSignature({ orderId, paymentId, signature })) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Payment verification failed');
  }

  const paySnap = await col(COLLECTIONS.payments).doc(orderId).get();
  if (!paySnap.exists || paySnap.data().registrationId !== registrationNumber) {
    throw new AppError(400, 'ORDER_MISMATCH', 'Payment does not belong to this booking');
  }

  const payment = await fetchVerifiedPayment(paymentId, paySnap.data());
  return confirmPayment({
    orderId,
    paymentId,
    amountPaise: payment.amount,
    currency: payment.currency,
    method: payment.method,
    source: 'checkout',
  });
}

/** Asks Razorpay whether an order was paid and confirms it locally if so. */
export async function reconcileOrder(orderId) {
  const paySnap = await col(COLLECTIONS.payments).doc(orderId).get();
  if (!paySnap.exists) return { paid: false };
  const order = paySnap.data();

  let items;
  try {
    ({ items = [] } = await getRazorpay().orders.fetchPayments(orderId));
  } catch (err) {
    console.error('[razorpay] reconcile failed', err?.error ?? err);
    return { paid: false };
  }

  const candidate =
    items.find((p) => p.status === 'captured') ?? items.find((p) => p.status === 'authorized');
  if (!candidate) return { paid: false };

  const payment = await fetchVerifiedPayment(candidate.id, order);
  await confirmPayment({
    orderId,
    paymentId: payment.id,
    amountPaise: payment.amount,
    currency: payment.currency,
    method: payment.method,
    source: 'reconcile',
  });
  return { paid: true };
}

/** Records a failed or cancelled checkout attempt. Never downgrades a paid booking. */
export async function recordPaymentFailure({ registrationNumber, orderId, paymentId, cancelled, code, reason, source }) {
  const db = getDb();
  const payRef = col(COLLECTIONS.payments).doc(orderId);

  return db.runTransaction(async (tx) => {
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) throw new AppError(404, 'ORDER_NOT_FOUND', 'Payment order not found');
    const pay = paySnap.data();
    if (registrationNumber && pay.registrationId !== registrationNumber) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Payment order not found');
    }

    const regRef = col(COLLECTIONS.registrations).doc(pay.registrationId);
    const regSnap = await tx.get(regRef);
    const reg = regSnap.data();
    if (reg.paymentStatus === PAYMENT_STATUS.paid || pay.status === ORDER_STATUS.paid) {
      return { result: 'ignored_already_paid' };
    }

    tx.update(payRef, {
      status: cancelled ? ORDER_STATUS.cancelled : ORDER_STATUS.failed,
      lastError: {
        code: code ?? null,
        reason: reason ?? null,
        paymentId: paymentId ?? null,
        source,
        at: new Date(),
      },
      updatedAt: serverTimestamp(),
    });
    tx.update(regRef, {
      paymentStatus: cancelled ? PAYMENT_STATUS.cancelled : PAYMENT_STATUS.failed,
      updatedAt: serverTimestamp(),
    });
    return { result: cancelled ? 'cancelled' : 'failed' };
  });
}

async function processWebhookEvent(event) {
  const payment = event.payload?.payment?.entity;

  switch (event.event) {
    case 'payment.captured':
    case 'order.paid': {
      if (!payment?.order_id) return 'ignored_no_payment';
      const { result } = await confirmPayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        amountPaise: payment.amount,
        currency: payment.currency,
        method: payment.method,
        source: 'webhook',
      });
      return result;
    }
    case 'payment.authorized': {
      // Only relevant when auto-capture is disabled in the Razorpay dashboard.
      if (!payment?.order_id) return 'ignored_no_payment';
      const paySnap = await col(COLLECTIONS.payments).doc(payment.order_id).get();
      if (!paySnap.exists) return 'ignored_unknown_order';
      const verified = await fetchVerifiedPayment(payment.id, paySnap.data());
      const { result } = await confirmPayment({
        orderId: payment.order_id,
        paymentId: verified.id,
        amountPaise: verified.amount,
        currency: verified.currency,
        method: verified.method,
        source: 'webhook',
      });
      return result;
    }
    case 'payment.failed': {
      if (!payment?.order_id) return 'ignored_no_payment';
      const { result } = await recordPaymentFailure({
        orderId: payment.order_id,
        paymentId: payment.id,
        cancelled: false,
        code: payment.error_code,
        reason: payment.error_description,
        source: 'webhook',
      });
      return result;
    }
    default:
      return 'ignored_event_type';
  }
}

/**
 * Razorpay webhook. Signature is checked against the exact raw bytes; the event ID
 * makes redelivery a no-op. Errors bubble up as 5xx so Razorpay retries.
 */
export async function handleWebhook({ rawBody, signature, eventId }) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
  if (!signature || !isValidWebhookSignature(raw, signature)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Invalid webhook signature');
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Malformed webhook payload');
  }

  const id = (eventId || `sha256_${sha256(raw)}`).replace(/\//g, '_');
  const eventRef = col(COLLECTIONS.webhookEvents).doc(id);
  const existing = await eventRef.get();
  if (existing.exists && existing.data().processedAt) {
    return { duplicate: true, result: existing.data().result };
  }

  let result;
  try {
    result = await processWebhookEvent(event);
  } catch (err) {
    if (err instanceof AppError && ['ORDER_NOT_FOUND', 'BOOKING_NOT_FOUND'].includes(err.code)) {
      result = 'ignored_unknown_order'; // e.g. another app on the same Razorpay account
    } else if (err instanceof AppError && ['AMOUNT_MISMATCH', 'ORDER_MISMATCH'].includes(err.code)) {
      console.error(`[webhook] ${err.code} for event ${id}`);
      result = `rejected_${err.code.toLowerCase()}`;
    } else {
      throw err;
    }
  }

  await eventRef.set(
    {
      razorpayEventId: id,
      eventType: event.event ?? 'unknown',
      result,
      processedAt: serverTimestamp(),
      createdAt: existing.exists ? existing.data().createdAt : serverTimestamp(),
    },
    { merge: true },
  );
  return { duplicate: false, result };
}
