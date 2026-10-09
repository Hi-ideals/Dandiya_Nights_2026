import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createTestContext } from './helpers/setup.js';

let ctx;
beforeEach(() => {
  ctx = createTestContext();
});

describe('POST /api/registrations', () => {
  it('creates a pending couple registration with server-calculated pricing', async () => {
    const { res, number } = await ctx.register({ category: 'couple', ticketQuantity: 2, totalAmountPaise: 1 });
    expect(res.status).toBe(201);
    expect(number).toMatch(/^DN\d{2}[A-Z2-9]{6}$/);
    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body.breakdown.totalAmountPaise).toBe(104000);

    const stored = ctx.db.get('registrations', number);
    expect(stored).toMatchObject({
      registrationNumber: number,
      userId: 'user-1',
      email: 'priya@example.com',
      category: 'couple',
      ticketQuantity: 2,
      paymentStatus: 'pending',
      status: 'pending_payment',
      totalAmountPaise: 104000, // client-supplied amount ignored
      ticketSubtotalPaise: 99800,
      ticketPlatformFeePaise: 4200,
      currency: 'INR',
    });
    expect(stored.pricingSnapshot.version).toBe('2026-v1');
    expect(ctx.db.all('tickets')).toHaveLength(0);
  });

  it('creates a single registration with both competitions', async () => {
    const { res } = await ctx.register({ category: 'single', ticketQuantity: 2, rangoliSelected: true, drawingSelected: true });
    expect(res.status).toBe(201);
    expect(res.body.breakdown.totalAmountPaise).toBe(64000);
    expect(res.body.breakdown.competitions.map((c) => c.key)).toEqual(['rangoli', 'drawing']);
  });

  it('accepts exactly 7 tickets', async () => {
    const { res } = await ctx.register({ ticketQuantity: 7 });
    expect(res.status).toBe(201);
  });

  it('rejects more than 7 tickets', async () => {
    const { res } = await ctx.register({ ticketQuantity: 8 });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.ticketQuantity).toMatch(/at most 7/);
  });

  it('returns field-level errors for invalid submissions', async () => {
    const { res } = await ctx.register({
      fullName: '',
      mobileNumber: '12345',
      address: 'x',
      category: 'family',
      ticketQuantity: 0,
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(
      ['address', 'category', 'fullName', 'mobileNumber', 'ticketQuantity'].sort(),
    );
    expect(ctx.db.all('registrations')).toHaveLength(0);
  });

  it('normalises +91 mobile numbers', async () => {
    const { number } = await ctx.register({ mobileNumber: '+91 98765 43210' });
    expect(ctx.db.get('registrations', number).mobileNumber).toBe('9876543210');
  });

  it('treats a repeated submit (same clientRequestId) as the same registration', async () => {
    const body = ctx.validRegistration();
    const [a, b] = await Promise.all([
      ctx.api.post('/api/registrations').set(bearer('user-token')).send(body),
      ctx.api.post('/api/registrations').set(bearer('user-token')).send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.registration.registrationNumber).toBe(b.body.registration.registrationNumber);
    expect(ctx.db.all('registrations')).toHaveLength(1);
  });

  it('rejects reuse of a clientRequestId with different details', async () => {
    const body = ctx.validRegistration();
    await ctx.api.post('/api/registrations').set(bearer('user-token')).send(body);
    const res = await ctx.api.post('/api/registrations').set(bearer('user-token')).send({ ...body, ticketQuantity: 3 });
    expect(res.status).toBe(409);
  });
});

describe('sign-in and booking ownership', () => {
  it('requires a signed-in user to register', async () => {
    const res = await ctx.api.post('/api/registrations').send(ctx.validRegistration());
    expect(res.status).toBe(401);
    const bad = await ctx.api.post('/api/registrations').set(bearer('expired')).send(ctx.validRegistration());
    expect(bad.status).toBe(401);
    expect(ctx.db.all('registrations')).toHaveLength(0);
  });

  it('the same clientRequestId from two different users creates two bookings', async () => {
    const body = ctx.validRegistration();
    const a = await ctx.api.post('/api/registrations').set(bearer('user-token')).send(body);
    const b = await ctx.api.post('/api/registrations').set(bearer('user2-token')).send(body);
    expect(a.body.registration.registrationNumber).not.toBe(b.body.registration.registrationNumber);
  });

  it('lists only my bookings, newest first, on any device', async () => {
    const first = await ctx.register({ ticketQuantity: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const second = await ctx.register({ ticketQuantity: 2 });
    await ctx.register({ fullName: 'Rahul Patil' }, 'user2-token');

    const res = await ctx.api.get('/api/me/bookings').set(bearer('user-token'));
    expect(res.status).toBe(200);
    expect(res.body.items.map((b) => b.registrationNumber)).toEqual([second.number, first.number]);
    expect((await ctx.api.get('/api/me/bookings')).status).toBe(401);
  });

  it('admins can open any booking', async () => {
    const { number } = await ctx.register();
    const res = await ctx.api.get(`/api/registrations/${number}`).set(bearer('admin-token'));
    expect(res.status).toBe(200);
  });

  it('status endpoint exposes no personal data', async () => {
    const { number } = await ctx.register();
    const res = await ctx.api.get(`/api/registrations/${number}/status`);
    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe('pending');
    expect(res.body).not.toHaveProperty('fullName');
    expect(res.body).not.toHaveProperty('mobileNumber');
  });

  it('full booking requires the owner to be signed in', async () => {
    const { number, token } = await ctx.register();
    expect((await ctx.api.get(`/api/registrations/${number}`)).status).toBe(401);
    expect((await ctx.api.get(`/api/registrations/${number}`).set(bearer('x'.repeat(32)))).status).toBe(401);
    const ok = await ctx.api.get(`/api/registrations/${number}`).set(bearer(token));
    expect(ok.status).toBe(200);
    expect(ok.body.fullName).toBe('Priya Sharma');
    expect(ok.body.email).toBe('priya@example.com');
    expect(ok.body.tickets).toEqual([]);
  });

  it("one user cannot open, pay for or download another user's booking", async () => {
    const mine = await ctx.register();
    const theirs = await ctx.register({ fullName: 'Rahul Patil' }, 'user2-token');
    expect((await ctx.api.get(`/api/registrations/${theirs.number}`).set(bearer(mine.token))).status).toBe(404);
    expect((await ctx.createOrder(theirs.number, mine.token)).status).toBe(404);
    expect(
      (await ctx.api.get(`/api/registrations/${theirs.number}/tickets/download`).set(bearer(mine.token))).status,
    ).toBe(404);
  });
});
