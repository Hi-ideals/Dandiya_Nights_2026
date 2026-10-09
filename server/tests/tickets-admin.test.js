import { beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { bearer, createTestContext } from './helpers/setup.js';

let ctx;
beforeEach(() => {
  ctx = createTestContext();
});

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('ticket PDF download', () => {
  it('downloads all tickets of a paid booking as one PDF', async () => {
    const { number, token } = await ctx.bookAndPay({ ticketQuantity: 2, rangoliSelected: true });
    const res = await ctx.api
      .get(`/api/registrations/${number}/tickets/download`)
      .set(bearer(token))
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  });

  it('downloads an individual ticket', async () => {
    const { number, token } = await ctx.bookAndPay({ ticketQuantity: 3 });
    const res = await ctx.api
      .get(`/api/tickets/${number}-02/download`)
      .set(bearer(token))
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.body.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('refuses downloads without the right token or before payment', async () => {
    const paid = await ctx.bookAndPay();
    expect((await ctx.api.get(`/api/tickets/${paid.number}-01/download`)).status).toBe(401);
    const other = await ctx.api.get(`/api/tickets/${paid.number}-01/download`).set(bearer('user2-token'));
    expect(other.status).toBe(404);

    const unpaid = await ctx.register();
    const res = await ctx.api.get(`/api/registrations/${unpaid.number}/tickets/download`).set(bearer(unpaid.token));
    expect(res.status).toBe(409);
  });
});

describe('ticket verification and check-in', () => {
  it('requires staff authentication', async () => {
    const { number } = await ctx.bookAndPay();
    expect((await ctx.api.get(`/api/tickets/verify/${number}-01`)).status).toBe(401);
    expect((await ctx.api.get(`/api/tickets/verify/${number}-01`).set(bearer('user-token'))).status).toBe(403);
    expect((await ctx.api.post(`/api/tickets/${number}-01/check-in`).set(bearer('bad'))).status).toBe(401);
  });

  it('validates by QR token and by ticket number', async () => {
    const { number } = await ctx.bookAndPay({ ticketQuantity: 2 });
    const ticket = ctx.db.get('tickets', `${number}-02`);

    const byQr = await ctx.api.get(`/api/tickets/verify/${ticket.qrToken}`).set(bearer('staff-token'));
    expect(byQr.body).toMatchObject({ result: 'valid', ticket: { ticketNumber: `${number}-02`, holderName: 'Priya Sharma' } });

    const byNumber = await ctx.api.get(`/api/tickets/verify/${number.toLowerCase()}-02`).set(bearer('staff-token'));
    expect(byNumber.body.result).toBe('valid');

    const unknown = await ctx.api.get('/api/tickets/verify/DN26AAAAAA-01').set(bearer('staff-token'));
    expect(unknown.body).toEqual({ result: 'invalid', ticket: null });
  });

  it('checks in each ticket once, independently, even under concurrent scans', async () => {
    const { number } = await ctx.bookAndPay({ ticketQuantity: 2 });
    const scans = await Promise.all(
      [1, 2, 3].map(() => ctx.api.post(`/api/tickets/${number}-01/check-in`).set(bearer('staff-token'))),
    );
    expect(scans.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(scans.find((r) => r.status === 409).body.error.code).toBe('ALREADY_CHECKED_IN');

    const t1 = ctx.db.get('tickets', `${number}-01`);
    expect(t1).toMatchObject({ checkedIn: true, checkedInBy: { uid: 'staff-1', email: 'staff@example.com' } });
    expect(t1.checkedInAt).toBeInstanceOf(Date);

    const verify = await ctx.api.get(`/api/tickets/verify/${number}-01`).set(bearer('staff-token'));
    expect(verify.body.result).toBe('already_checked_in');

    const second = await ctx.api.post(`/api/tickets/${number}-02/check-in`).set(bearer('admin-token'));
    expect(second.status).toBe(200);
  });

  it('refuses check-in of a cancelled ticket', async () => {
    const { number } = await ctx.bookAndPay();
    ctx.db.store.get(`tickets/${number}-01`).status = 'cancelled';
    const res = await ctx.api.post(`/api/tickets/${number}-01/check-in`).set(bearer('staff-token'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TICKET_CANCELLED');
  });
});

describe('admin API', () => {
  async function seed() {
    const a = await ctx.bookAndPay({ fullName: 'Anita Rao', category: 'couple', ticketQuantity: 2, rangoliSelected: true });
    const b = await ctx.bookAndPay({ fullName: 'Rahul Patil', category: 'single', ticketQuantity: 3, drawingSelected: true, mobileNumber: '9123456780' });
    const c = await ctx.register({ fullName: 'Pending Person', category: 'single', ticketQuantity: 1 });
    const d = await ctx.register({ fullName: 'Failed Payer', address: '=HYPERLINK("http://evil")', category: 'couple', ticketQuantity: 1 });
    const order = await ctx.createOrder(d.number, d.token);
    await ctx.api
      .post('/api/payments/failure')
      .set(bearer(d.token))
      .send({ registrationNumber: d.number, razorpay_order_id: order.body.orderId });
    await ctx.api.post(`/api/tickets/${a.number}-01/check-in`).set(bearer('staff-token'));
    return { a, b, c, d };
  }

  it('rejects unauthenticated, non-admin and staff users', async () => {
    expect((await ctx.api.get('/api/admin/dashboard')).status).toBe(401);
    expect((await ctx.api.get('/api/admin/registrations').set(bearer('user-token'))).status).toBe(403);
    expect((await ctx.api.get('/api/admin/export/excel').set(bearer('staff-token'))).status).toBe(403);
  });

  it('dashboard counts only verified payments as revenue', async () => {
    await seed();
    const res = await ctx.api.get('/api/admin/dashboard').set(bearer('admin-token'));
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      totalRegistrations: 4,
      confirmedRegistrations: 2,
      pendingPayments: 1,
      failedPayments: 1,
      totalTicketsBooked: 5,
      coupleTickets: 2,
      singleTickets: 3,
      rangoliParticipants: 1,
      drawingParticipants: 1,
      verifiedRevenuePaise: 2 * 52000 + 11000 + 3 * 21000 + 11000,
      ticketsCheckedIn: 1,
      ticketsRemaining: 4,
    });
  });

  it('lists, searches, filters and paginates registrations', async () => {
    const { a, b } = await seed();
    const get = (query) => ctx.api.get('/api/admin/registrations').query(query).set(bearer('admin-token'));

    const all = await get({ pageSize: 2 });
    expect(all.body.pagination).toEqual({ page: 1, pageSize: 2, total: 4, totalPages: 2 });

    expect((await get({ q: 'anita' })).body.items.map((r) => r.registrationNumber)).toEqual([a.number]);
    expect((await get({ q: '91234' })).body.items[0].registrationNumber).toBe(b.number);
    expect((await get({ q: `${b.number}-02` })).body.items[0].registrationNumber).toBe(b.number);
    expect((await get({ paymentStatus: 'paid' })).body.pagination.total).toBe(2);
    expect((await get({ category: 'single' })).body.pagination.total).toBe(2);
    expect((await get({ competition: 'rangoli' })).body.items[0].registrationNumber).toBe(a.number);
    expect((await get({ competition: 'none' })).body.pagination.total).toBe(2);
    expect((await get({ checkIn: 'partial' })).body.items[0].registrationNumber).toBe(a.number);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    expect((await get({ from: today, to: today })).body.pagination.total).toBe(4);
    expect((await get({ from: '2020-01-01', to: '2020-01-02' })).body.pagination.total).toBe(0);

    const row = (await get({ q: a.number })).body.items[0];
    expect(row).toMatchObject({ ticketNumbers: [`${a.number}-01`, `${a.number}-02`], checkIn: { checkedIn: 1, total: 2, state: 'partial' } });
    expect(row.razorpayOrderId).toMatch(/^order_/);
    expect(row.razorpayPaymentId).toMatch(/^pay_/);
  });

  it('returns registration details with tickets and payments', async () => {
    const { a } = await seed();
    const res = await ctx.api.get(`/api/admin/registrations/${a.number}`).set(bearer('admin-token'));
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.payments[0]).toMatchObject({ status: 'paid', verifiedVia: 'checkout' });
    expect(res.body.breakdown.totalAmountPaise).toBe(115000);
  });

  it('exports an Excel workbook with three sheets, filters and formula escaping', async () => {
    await seed();
    const res = await ctx.api
      .get('/api/admin/export/excel')
      .set(bearer('admin-token'))
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/\.xlsx"/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Registrations', 'Payments', 'Summary']);
    const regs = wb.getWorksheet('Registrations');
    expect(regs.rowCount).toBe(5);
    const addresses = regs.getColumn(5).values.slice(2);
    expect(addresses).toContain(`'=HYPERLINK("http://evil")`);

    const summary = wb.getWorksheet('Summary');
    const metrics = Object.fromEntries(summary.getSheetValues().slice(2).filter(Boolean).map((r) => [r[1], r[2]]));
    expect(metrics['Total registrations']).toBe(4);
    expect(metrics['Verified revenue']).toBe(1890);

    const paidOnly = await ctx.api
      .get('/api/admin/export/excel')
      .query({ paymentStatus: 'paid' })
      .set(bearer('admin-token'))
      .buffer(true)
      .parse(binaryParser);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(paidOnly.body);
    expect(wb2.getWorksheet('Registrations').rowCount).toBe(3);
    expect(paidOnly.headers['content-disposition']).toMatch(/-paid-/);
  });
});
