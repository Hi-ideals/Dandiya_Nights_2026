import * as paymentService from '../services/payment.service.js';
import { getOwnerBooking, getRegistrationOrThrow } from '../services/registration.service.js';

export async function createOrder(req, res) {
  res.json(await paymentService.createOrder(req.valid.body.registrationNumber));
}

export async function verifyPayment(req, res) {
  const body = req.valid.body;
  const { result } = await paymentService.verifyPayment({
    registrationNumber: body.registrationNumber,
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  res.json({ result, booking: await getOwnerBooking(body.registrationNumber) });
}

export async function reportFailure(req, res) {
  const body = req.valid.body;
  const { result } = await paymentService.recordPaymentFailure({
    registrationNumber: body.registrationNumber,
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    cancelled: body.cancelled,
    code: body.code,
    reason: body.reason,
    source: 'checkout',
  });
  res.json({ result });
}

/** "I paid but the page did not update": asks Razorpay directly and confirms if paid. */
export async function reconcile(req, res) {
  const { registrationNumber } = req.valid.body;
  const reg = await getRegistrationOrThrow(registrationNumber);
  if (reg.paymentStatus !== 'paid' && reg.activeOrderId) {
    await paymentService.reconcileOrder(reg.activeOrderId);
  }
  res.json({ booking: await getOwnerBooking(registrationNumber) });
}

export async function webhook(req, res) {
  const outcome = await paymentService.handleWebhook({
    rawBody: req.body,
    signature: req.get('x-razorpay-signature'),
    eventId: req.get('x-razorpay-event-id'),
  });
  res.json({ ok: true, ...outcome });
}
