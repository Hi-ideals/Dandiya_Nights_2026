import QRCode from 'qrcode';
import { getDb, serverTimestamp } from '../config/firebase.js';
import { env } from '../config/env.js';
import { getEventConfig } from '../config/event.js';
import { getPricingConfig } from '../config/pricing.js';
import { COLLECTIONS, PAYMENT_STATUS, REGISTRATION_STATUS } from '../config/constants.js';
import { calculatePricing } from './pricing.service.js';
import { AppError, notFound } from '../utils/AppError.js';
import { generateRegistrationNumber, sha256 } from '../utils/crypto.js';
import { toDate, toIso } from '../utils/format.js';

const MAX_NUMBER_ATTEMPTS = 5;

const registrations = () => getDb().collection(COLLECTIONS.registrations);

/**
 * Creates a pending registration owned by the signed-in user. Repeated submissions with
 * the same clientRequestId (double-clicks, network retries) return the original registration.
 */
export async function createRegistration(input, user) {
  if (!getEventConfig().registrationOpen) {
    throw new AppError(403, 'REGISTRATION_CLOSED', 'Registrations are closed for this event');
  }

  const pricing = getPricingConfig();
  const breakdown = calculatePricing(input, pricing);
  const db = getDb();

  const fields = {
    fullName: input.fullName.replace(/\s+/g, ' '),
    mobileNumber: input.mobileNumber,
    address: input.address.replace(/\s+/g, ' '),
    category: input.category,
    ticketQuantity: input.ticketQuantity,
    rangoliSelected: input.rangoliSelected,
    drawingSelected: input.drawingSelected,
  };
  const payloadHash = sha256(JSON.stringify(fields));
  const keyRef = db.collection(COLLECTIONS.idempotencyKeys).doc(sha256(`registration:${user.uid}:${input.clientRequestId}`));

  const { registrationNumber, reused } = await db.runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists) {
      const existing = keySnap.data();
      if (existing.payloadHash !== payloadHash) {
        throw new AppError(409, 'DUPLICATE_REQUEST', 'This form was already submitted with different details. Please refresh and try again.');
      }
      return { registrationNumber: existing.registrationNumber, reused: true };
    }

    let number;
    let ref;
    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS && !number; attempt += 1) {
      const candidate = generateRegistrationNumber();
      const candidateRef = registrations().doc(candidate);
      // eslint-disable-next-line no-await-in-loop
      const snap = await tx.get(candidateRef);
      if (!snap.exists) {
        number = candidate;
        ref = candidateRef;
      }
    }
    if (!number) throw new AppError(503, 'NUMBER_GENERATION_FAILED', 'Please try again');

    tx.create(ref, {
      registrationNumber: number,
      userId: user.uid,
      email: user.email.toLowerCase(),
      ...fields,
      nameLower: fields.fullName.toLowerCase(),
      ticketSubtotalPaise: breakdown.ticketSubtotalPaise,
      ticketPlatformFeePaise: breakdown.ticketPlatformFeePaise,
      competitionSubtotalPaise: breakdown.competitionSubtotalPaise,
      competitionPlatformFeePaise: breakdown.competitionPlatformFeePaise,
      totalAmountPaise: breakdown.totalAmountPaise,
      currency: breakdown.currency,
      // Snapshot so later price changes never alter this booking.
      pricingSnapshot: {
        version: pricing.version,
        competitionChargeMode: pricing.competitionChargeMode,
        category: pricing.categories[input.category],
        competitions: breakdown.competitions,
      },
      status: REGISTRATION_STATUS.pendingPayment,
      paymentStatus: PAYMENT_STATUS.pending,
      activeOrderId: null,
      orderLockUntil: null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      amountPaidPaise: 0,
      ticketNumbers: [],
      paidAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.create(keyRef, { registrationNumber: number, payloadHash, createdAt: serverTimestamp() });
    return { registrationNumber: number, reused: false };
  });

  const registration = await getRegistrationOrThrow(registrationNumber);
  return {
    reused,
    registration: toStatusView(registration),
    breakdown: breakdownFromRegistration(registration),
  };
}

export async function getRegistrationOrThrow(registrationNumber) {
  const snap = await registrations().doc(registrationNumber).get();
  if (!snap.exists) throw notFound('Booking not found', 'BOOKING_NOT_FOUND');
  return { id: snap.id, ...snap.data() };
}

export async function getTicketsForRegistration(registrationNumber) {
  const snap = await getDb()
    .collection(COLLECTIONS.tickets)
    .where('registrationId', '==', registrationNumber)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber));
}

export function breakdownFromRegistration(reg) {
  return {
    currency: reg.currency,
    category: reg.category,
    categoryLabel: reg.pricingSnapshot?.category?.label,
    ticketQuantity: reg.ticketQuantity,
    ticketUnitPaise: reg.pricingSnapshot?.category?.basePaise,
    ticketUnitPlatformFeePaise: reg.pricingSnapshot?.category?.platformFeePaise,
    ticketSubtotalPaise: reg.ticketSubtotalPaise,
    ticketPlatformFeePaise: reg.ticketPlatformFeePaise,
    competitions: reg.pricingSnapshot?.competitions ?? [],
    competitionSubtotalPaise: reg.competitionSubtotalPaise,
    competitionPlatformFeePaise: reg.competitionPlatformFeePaise,
    totalAmountPaise: reg.totalAmountPaise,
  };
}

/** Public, non-personal status. */
export function toStatusView(reg) {
  return {
    registrationNumber: reg.registrationNumber,
    status: reg.status,
    paymentStatus: reg.paymentStatus,
    category: reg.category,
    ticketQuantity: reg.ticketQuantity,
    totalAmountPaise: reg.totalAmountPaise,
    currency: reg.currency,
  };
}

export function buildQrPayload(qrToken) {
  return `${env.publicAppUrl}/staff/check-in?t=${encodeURIComponent(qrToken)}`;
}

/** Full booking details for the attendee holding the access token. */
export async function getOwnerBooking(registrationNumber) {
  const reg = await getRegistrationOrThrow(registrationNumber);
  const tickets = reg.paymentStatus === PAYMENT_STATUS.paid ? await getTicketsForRegistration(registrationNumber) : [];

  return {
    ...toStatusView(reg),
    fullName: reg.fullName,
    email: reg.email ?? null,
    mobileNumber: reg.mobileNumber,
    address: reg.address,
    rangoliSelected: reg.rangoliSelected,
    drawingSelected: reg.drawingSelected,
    breakdown: breakdownFromRegistration(reg),
    amountPaidPaise: reg.amountPaidPaise,
    razorpayPaymentId: reg.razorpayPaymentId,
    paidAt: toIso(reg.paidAt),
    createdAt: toIso(reg.createdAt),
    tickets: await Promise.all(
      tickets.map(async (ticket) => ({
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        checkedIn: ticket.checkedIn,
        checkedInAt: toIso(ticket.checkedInAt),
        qrDataUrl: await QRCode.toDataURL(buildQrPayload(ticket.qrToken), { margin: 1, width: 280 }),
      })),
    ),
  };
}

/** All bookings of one signed-in user, newest first (equality-only query: no composite index). */
export async function listUserBookings(uid) {
  const snap = await registrations().where('userId', '==', uid).get();
  return snap.docs
    .map((doc) => doc.data())
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
    .map((reg) => ({
      ...toStatusView(reg),
      fullName: reg.fullName,
      rangoliSelected: reg.rangoliSelected,
      drawingSelected: reg.drawingSelected,
      ticketNumbers: reg.ticketNumbers ?? [],
      createdAt: toIso(reg.createdAt),
      paidAt: toIso(reg.paidAt),
    }));
}
