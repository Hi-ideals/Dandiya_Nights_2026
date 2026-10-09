import { getDb } from '../config/firebase.js';
import { COLLECTIONS, PAYMENT_STATUS, registrationType } from '../config/constants.js';
import { notFound } from '../utils/AppError.js';
import { istDayEnd, istDayStart, toDate, toIso } from '../utils/format.js';
import { breakdownFromRegistration } from './registration.service.js';

// Safety cap for in-memory filtering; comfortably above a single event's bookings.
const MAX_SCAN = 20_000;

const col = (name) => getDb().collection(name);

/**
 * Firestore handles equality + date-range filters (see firestore.indexes.json);
 * free-text search and competition/check-in filters run in memory, which is
 * appropriate for event-sized data and keeps list, dashboard and export consistent.
 */
async function fetchRegistrations({ category, paymentStatus, from, to }) {
  let query = col(COLLECTIONS.registrations);
  if (paymentStatus) query = query.where('paymentStatus', '==', paymentStatus);
  if (category) query = query.where('category', '==', category);
  if (from) query = query.where('createdAt', '>=', istDayStart(from));
  if (to) query = query.where('createdAt', '<=', istDayEnd(to));
  const snap = await query.orderBy('createdAt', 'desc').limit(MAX_SCAN).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function fetchTicketsByRegistration(registrationIds) {
  const map = new Map();
  if (!registrationIds.length) return map;
  const chunks = [];
  for (let i = 0; i < registrationIds.length; i += 30) chunks.push(registrationIds.slice(i, i + 30));
  const snaps = await Promise.all(
    chunks.map((ids) => col(COLLECTIONS.tickets).where('registrationId', 'in', ids).get()),
  );
  snaps.forEach((snap) =>
    snap.docs.forEach((doc) => {
      const ticket = doc.data();
      if (!map.has(ticket.registrationId)) map.set(ticket.registrationId, []);
      map.get(ticket.registrationId).push(ticket);
    }),
  );
  map.forEach((list) => list.sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber)));
  return map;
}

async function fetchAllTickets() {
  const snap = await col(COLLECTIONS.tickets).get();
  const map = new Map();
  snap.docs.forEach((doc) => {
    const ticket = doc.data();
    if (!map.has(ticket.registrationId)) map.set(ticket.registrationId, []);
    map.get(ticket.registrationId).push(ticket);
  });
  map.forEach((list) => list.sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber)));
  return map;
}

function matchesCompetition(reg, competition) {
  switch (competition) {
    case 'rangoli':
      return reg.rangoliSelected;
    case 'drawing':
      return reg.drawingSelected;
    case 'both':
      return reg.rangoliSelected && reg.drawingSelected;
    case 'any':
      return reg.rangoliSelected || reg.drawingSelected;
    case 'none':
      return !reg.rangoliSelected && !reg.drawingSelected;
    default:
      return true;
  }
}

function matchesSearch(reg, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const upper = q.toUpperCase().replace(/\s+/g, '');
  const digits = q.replace(/\D/g, '');
  return (
    reg.nameLower?.includes(needle) ||
    reg.email?.includes(needle) ||
    reg.registrationNumber.includes(upper) ||
    (upper.includes('-') && upper.startsWith(reg.registrationNumber)) ||
    (digits.length >= 4 && reg.mobileNumber.includes(digits))
  );
}

/** In-memory filters (search, registration type, competition). Legacy bookings count as Dandiya. */
const matchesFilters = (reg, filters) =>
  (!filters.type || registrationType(reg) === filters.type) &&
  matchesCompetition(reg, filters.competition) &&
  matchesSearch(reg, filters.q);

function checkInSummary(tickets = []) {
  const checkedIn = tickets.filter((t) => t.checkedIn).length;
  let state = 'none';
  if (tickets.length && checkedIn === tickets.length) state = 'all';
  else if (checkedIn > 0) state = 'partial';
  return { checkedIn, total: tickets.length, state };
}

export function toAdminRow(reg, tickets = []) {
  return {
    id: reg.id ?? reg.registrationNumber,
    registrationNumber: reg.registrationNumber,
    type: registrationType(reg),
    createdAt: toIso(reg.createdAt),
    paidAt: toIso(reg.paidAt),
    fullName: reg.fullName,
    email: reg.email ?? null,
    gender: reg.gender ?? null,
    mobileNumber: reg.mobileNumber,
    address: reg.address,
    category: reg.category,
    ticketQuantity: reg.ticketQuantity,
    rangoliSelected: reg.rangoliSelected,
    drawingSelected: reg.drawingSelected,
    paymentStatus: reg.paymentStatus,
    status: reg.status,
    totalAmountPaise: reg.totalAmountPaise,
    amountPaidPaise: reg.amountPaidPaise ?? 0,
    razorpayOrderId: reg.razorpayOrderId,
    razorpayPaymentId: reg.razorpayPaymentId,
    ticketNumbers: reg.ticketNumbers ?? [],
    checkIn: checkInSummary(tickets),
    tickets: tickets.map((t) => ({
      ticketNumber: t.ticketNumber,
      ticketType: t.ticketType ?? t.category,
      status: t.status,
      checkedIn: t.checkedIn,
      checkedInAt: toIso(t.checkedInAt),
      checkedInBy: t.checkedInBy?.email ?? null,
    })),
  };
}

/** Filtered rows (with tickets) shared by the list view and the Excel export. */
export async function queryRegistrationRows(filters, { allTickets = false } = {}) {
  const regs = (await fetchRegistrations(filters)).filter(
    (reg) => matchesFilters(reg, filters),
  );
  const ticketMap = allTickets
    ? await fetchAllTickets()
    : await fetchTicketsByRegistration(regs.map((r) => r.registrationNumber));
  let rows = regs.map((reg) => toAdminRow(reg, ticketMap.get(reg.registrationNumber)));
  if (filters.checkIn) rows = rows.filter((row) => row.checkIn.state === filters.checkIn);
  return rows;
}

export async function listRegistrations(filters) {
  const { page, pageSize } = filters;
  // Ticket lookups only for the requested page unless a check-in filter needs them all.
  if (filters.checkIn) {
    const rows = await queryRegistrationRows(filters);
    return paginate(rows, page, pageSize);
  }
  const regs = (await fetchRegistrations(filters)).filter(
    (reg) => matchesFilters(reg, filters),
  );
  const { items, pagination } = paginate(regs, page, pageSize);
  const ticketMap = await fetchTicketsByRegistration(items.map((r) => r.registrationNumber));
  return { items: items.map((reg) => toAdminRow(reg, ticketMap.get(reg.registrationNumber))), pagination };
}

function paginate(list, page, pageSize) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), pagination: { page, pageSize, total, totalPages } };
}

export async function getRegistrationDetail(registrationId) {
  const snap = await col(COLLECTIONS.registrations).doc(registrationId).get();
  if (!snap.exists) throw notFound('Registration not found', 'REGISTRATION_NOT_FOUND');
  const reg = { id: snap.id, ...snap.data() };

  const [ticketSnap, paymentSnap] = await Promise.all([
    col(COLLECTIONS.tickets).where('registrationId', '==', registrationId).get(),
    col(COLLECTIONS.payments).where('registrationId', '==', registrationId).get(),
  ]);
  const tickets = ticketSnap.docs.map((d) => d.data()).sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber));

  return {
    ...toAdminRow(reg, tickets),
    updatedAt: toIso(reg.updatedAt),
    breakdown: breakdownFromRegistration(reg),
    pricingVersion: reg.pricingSnapshot?.version ?? null,
    payments: paymentSnap.docs
      .map((d) => d.data())
      .map((p) => ({
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        amountPaise: p.amountPaise,
        currency: p.currency,
        status: p.status,
        method: p.method ?? null,
        verifiedVia: p.verifiedVia ?? null,
        requiresRefund: Boolean(p.requiresRefund),
        lastError: p.lastError ? { ...p.lastError, at: toIso(p.lastError.at) } : null,
        verifiedAt: toIso(p.verifiedAt),
        createdAt: toIso(p.createdAt),
      }))
      .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)),
  };
}

/**
 * Summary figures computed from the underlying records; revenue counts verified payments only.
 * Dandiya tickets and competition entries are counted separately.
 */
export function summarize(rows) {
  const s = {
    totalRegistrations: rows.length,
    dandiyaRegistrations: 0,
    competitionRegistrations: 0,
    confirmedRegistrations: 0,
    pendingPayments: 0,
    failedPayments: 0,
    cancelledPayments: 0,
    totalTicketsBooked: 0,
    coupleTickets: 0,
    singleTickets: 0,
    rangoliParticipants: 0,
    drawingParticipants: 0,
    verifiedRevenuePaise: 0,
    dandiyaRevenuePaise: 0,
    competitionRevenuePaise: 0,
    ticketsCheckedIn: 0,
    ticketsRemaining: 0,
  };

  rows.forEach((row) => {
    const competition = row.type === 'competition';
    if (competition) s.competitionRegistrations += 1;
    else s.dandiyaRegistrations += 1;

    if (row.paymentStatus === PAYMENT_STATUS.paid) {
      s.confirmedRegistrations += 1;
      if (!competition) {
        s.totalTicketsBooked += row.ticketQuantity;
        if (row.category === 'couple') s.coupleTickets += row.ticketQuantity;
        else s.singleTickets += row.ticketQuantity;
      }
      // Competition bookings carry one ticket per participant; legacy combined bookings count once.
      const participants = competition ? row.ticketQuantity : 1;
      if (row.rangoliSelected) s.rangoliParticipants += participants;
      if (row.drawingSelected) s.drawingParticipants += participants;
      s.verifiedRevenuePaise += row.amountPaidPaise;
      if (competition) s.competitionRevenuePaise += row.amountPaidPaise;
      else s.dandiyaRevenuePaise += row.amountPaidPaise;
      s.ticketsCheckedIn += row.checkIn.checkedIn;
      s.ticketsRemaining += row.checkIn.total - row.checkIn.checkedIn;
    } else if (row.paymentStatus === PAYMENT_STATUS.failed) s.failedPayments += 1;
    else if (row.paymentStatus === PAYMENT_STATUS.cancelled) s.cancelledPayments += 1;
    else s.pendingPayments += 1;
  });
  return s;
}

export async function getDashboard() {
  const rows = await queryRegistrationRows({}, { allTickets: true });
  const recent = rows.slice(0, 8).map(({ tickets, address, ...row }) => row);
  return { summary: summarize(rows), recent, generatedAt: new Date().toISOString() };
}

export async function getPaymentsForRows(rows) {
  const ids = rows.map((r) => r.registrationNumber);
  const payments = [];
  for (let i = 0; i < ids.length; i += 30) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await col(COLLECTIONS.payments).where('registrationId', 'in', ids.slice(i, i + 30)).get();
    snap.docs.forEach((doc) => payments.push(doc.data()));
  }
  return payments;
}
