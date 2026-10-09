import crypto from 'node:crypto';
import { env } from '../config/env.js';

// No 0/O/1/I/L to keep numbers easy to read aloud at the gate.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomChars(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** e.g. DN26K7Q2XF — also used as the Firestore document ID. */
export function generateRegistrationNumber(date = new Date()) {
  const year = String(date.getUTCFullYear()).slice(-2);
  return `DN${year}${randomChars(6)}`;
}

/** e.g. DN26K7Q2XF-03 — deterministic so ticket issuance is idempotent. */
export function buildTicketNumber(registrationNumber, index) {
  return `${registrationNumber}-${String(index).padStart(2, '0')}`;
}

export const REGISTRATION_NUMBER_RE = /^DN\d{2}[A-Z2-9]{6}$/;
export const TICKET_NUMBER_RE = /^DN\d{2}[A-Z2-9]{6}-\d{2}$/;

/** Opaque random token placed in QR codes; contains no personal data. */
export function generateQrToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const hmacHex = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('hex');

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/** Razorpay Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function isValidPaymentSignature({ orderId, paymentId, signature }) {
  return safeEqual(hmacHex(env.razorpay.keySecret, `${orderId}|${paymentId}`), signature);
}

/** Razorpay webhook signature: HMAC_SHA256(raw body, webhook secret). */
export function isValidWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret) return false;
  return safeEqual(hmacHex(env.razorpay.webhookSecret, rawBody), signature);
}
