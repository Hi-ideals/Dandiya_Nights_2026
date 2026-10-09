import Razorpay from 'razorpay';
import { env } from './env.js';
import { AppError } from '../utils/AppError.js';

let client;

export function getRazorpay() {
  if (client) return client;
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payments are not configured yet');
  }
  client = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return client;
}

/** Test hook: replace the Razorpay SDK client. */
export function setRazorpayClient(value) {
  client = value;
}
