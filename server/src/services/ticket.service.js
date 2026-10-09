import QRCode from 'qrcode';
import { getDb, serverTimestamp } from '../config/firebase.js';
import { getEventConfig } from '../config/event.js';
import { COLLECTIONS, PAYMENT_STATUS, TICKET_STATUS, TICKET_TYPE_LABELS, registrationType } from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import { TICKET_NUMBER_RE } from '../utils/crypto.js';
import { formatIstDateTime, toIso } from '../utils/format.js';
import { buildQrPayload, getRegistrationOrThrow, getTicketsForRegistration } from './registration.service.js';
import { renderTicketsPdf } from './pdf.service.js';

const tickets = () => getDb().collection(COLLECTIONS.tickets);

/** Resolves a scanned QR token or a typed ticket number to the ticket document ref. */
async function findTicketRef(code) {
  if (TICKET_NUMBER_RE.test(code)) return tickets().doc(code);
  const snap = await tickets().where('qrToken', '==', code).limit(1).get();
  return snap.empty ? null : snap.docs[0].ref;
}

function describe(ticket, reg) {
  let result = 'valid';
  if (ticket.status === TICKET_STATUS.cancelled) result = 'cancelled';
  else if (ticket.checkedIn) result = 'already_checked_in';
  else if (reg.paymentStatus !== PAYMENT_STATUS.paid) result = 'invalid';

  return {
    result,
    ticket: {
      ticketNumber: ticket.ticketNumber,
      registrationNumber: ticket.registrationNumber,
      registrationType: registrationType(reg),
      category: ticket.category,
      ticketType: ticket.ticketType ?? ticket.category,
      ticketLabel: TICKET_TYPE_LABELS[ticket.ticketType ?? ticket.category] ?? null,
      gender: reg.gender ?? null,
      status: ticket.status,
      checkedIn: ticket.checkedIn,
      checkedInAt: toIso(ticket.checkedInAt),
      checkedInBy: ticket.checkedInBy?.email ?? null,
      holderName: reg.fullName,
      ticketsInBooking: reg.ticketQuantity,
      rangoliSelected: reg.rangoliSelected,
      drawingSelected: reg.drawingSelected,
    },
  };
}

/** Staff-only lookup. */
export async function verifyTicket(code) {
  const ref = await findTicketRef(code);
  const snap = ref ? await ref.get() : null;
  if (!snap?.exists) return { result: 'invalid', ticket: null };
  const ticket = snap.data();
  const reg = await getRegistrationOrThrow(ticket.registrationId);
  return describe(ticket, reg);
}

/** Checks in one ticket; the transaction guarantees a ticket can be admitted only once. */
export async function checkInTicket(code, staff) {
  const ref = await findTicketRef(code);
  if (!ref) throw new AppError(404, 'TICKET_NOT_FOUND', 'Invalid ticket');
  const db = getDb();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError(404, 'TICKET_NOT_FOUND', 'Invalid ticket');
    const ticket = snap.data();
    const regSnap = await tx.get(db.collection(COLLECTIONS.registrations).doc(ticket.registrationId));
    const reg = regSnap.data();

    const current = describe(ticket, reg);
    if (current.result === 'already_checked_in') {
      throw new AppError(409, 'ALREADY_CHECKED_IN', `Already checked in at ${formatIstDateTime(ticket.checkedInAt)}`, current);
    }
    if (current.result !== 'valid') {
      throw new AppError(409, `TICKET_${current.result.toUpperCase()}`, 'This ticket cannot be checked in', current);
    }

    const checkedInAt = new Date();
    tx.update(ref, {
      checkedIn: true,
      checkedInAt: serverTimestamp(),
      checkedInBy: { uid: staff.uid, email: staff.email },
    });
    return describe({ ...ticket, checkedIn: true, checkedInAt, checkedInBy: { email: staff.email } }, reg);
  });
}

async function buildPdfTickets(reg, ticketList) {
  return Promise.all(
    ticketList.map(async (ticket, index) => ({
      ...ticket,
      index: index + 1,
      qrPng: await QRCode.toBuffer(buildQrPayload(ticket.qrToken), { margin: 1, width: 360, errorCorrectionLevel: 'M' }),
    })),
  );
}

async function loadPaidBooking(registrationNumber) {
  const reg = await getRegistrationOrThrow(registrationNumber);
  if (reg.paymentStatus !== PAYMENT_STATUS.paid) {
    throw new AppError(409, 'PAYMENT_NOT_CONFIRMED', 'Tickets are available after payment is confirmed');
  }
  return reg;
}

/** All tickets of a booking in one PDF. */
export async function getBookingPdf(registrationNumber) {
  const reg = await loadPaidBooking(registrationNumber);
  const list = await getTicketsForRegistration(registrationNumber);
  if (!list.length) throw new AppError(409, 'TICKETS_NOT_ISSUED', 'Tickets are not issued yet');
  return renderTicketsPdf({ event: getEventConfig(), registration: reg, tickets: await buildPdfTickets(reg, list) });
}

/** A single ticket PDF; the caller has already proven access to the parent booking. */
export async function getSingleTicketPdf(ticketNumber) {
  const registrationNumber = ticketNumber.split('-')[0];
  const reg = await loadPaidBooking(registrationNumber);
  const snap = await tickets().doc(ticketNumber).get();
  if (!snap.exists) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
  const all = await buildPdfTickets(reg, [snap.data()]);
  all[0].index = Number(ticketNumber.split('-')[1]);
  return renderTicketsPdf({ event: getEventConfig(), registration: reg, tickets: all });
}
