import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { FakeFirestore } from './fakeFirestore.js';
import { FakeRazorpay, signCheckout } from './fakeRazorpay.js';
import { setFirebaseOverrides } from '../../src/config/firebase.js';
import { setRazorpayClient } from '../../src/config/razorpay.js';
import { createApp } from '../../src/app.js';

export const SECRETS = {
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
};

const TOKENS = {
  'admin-token': { uid: 'admin-1', email: 'admin@example.com', role: 'admin' },
  'staff-token': { uid: 'staff-1', email: 'staff@example.com' }, // role comes from admins collection
  'user-token': { uid: 'user-1', email: 'priya@example.com', name: 'Priya Sharma' },
  'user2-token': { uid: 'user-2', email: 'rahul@example.com', name: 'Rahul Patil' },
};

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

export function createTestContext() {
  const db = new FakeFirestore();
  const razorpay = new FakeRazorpay();
  const auth = {
    async verifyIdToken(token) {
      if (!TOKENS[token]) throw new Error('invalid token');
      return { ...TOKENS[token] };
    },
  };
  setFirebaseOverrides({ db, auth, serverTimestamp: () => new Date() });
  setRazorpayClient(razorpay);
  db.store.set('admins/staff-1', { uid: 'staff-1', email: 'staff@example.com', role: 'staff', active: true });

  const app = createApp();
  const api = request(app);

  const validRegistration = (overrides = {}) => ({
    fullName: 'Priya Sharma',
    mobileNumber: '9876543210',
    address: '12 MG Road, Bidar, Karnataka',
    category: 'couple',
    ticketQuantity: 1,
    rangoliSelected: false,
    drawingSelected: false,
    clientRequestId: randomUUID(),
    ...overrides,
  });

  /** Registers as a signed-in attendee; `token` is that attendee's Firebase ID token. */
  async function register(overrides, token = 'user-token') {
    const res = await api.post('/api/registrations').set(bearer(token)).send(validRegistration(overrides));
    return { res, number: res.body.registration?.registrationNumber, token };
  }

  async function createOrder(number, token) {
    return api.post('/api/payments/create-order').set(bearer(token)).send({ registrationNumber: number });
  }

  /** Register -> order -> pay -> verify. Returns everything for further assertions. */
  async function bookAndPay(overrides) {
    const { number, token } = await register(overrides);
    const order = await createOrder(number, token);
    const payment = razorpay.pay(order.body.orderId);
    const verify = await api
      .post('/api/payments/verify')
      .set(bearer(token))
      .send({
        registrationNumber: number,
        razorpay_order_id: order.body.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signCheckout(SECRETS.keySecret, order.body.orderId, payment.id),
      });
    return { number, token, orderId: order.body.orderId, payment, verify };
  }

  return { db, razorpay, api, validRegistration, register, createOrder, bookAndPay };
}
