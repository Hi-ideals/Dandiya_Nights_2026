import { z } from 'zod';
import { getPricingConfig } from '../config/pricing.js';
import { normalizeIndianMobile } from '../utils/format.js';
import { REGISTRATION_NUMBER_RE, TICKET_NUMBER_RE } from '../utils/crypto.js';

const trimmed = (min, max, label) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const registrationNumberParam = z.object({
  registrationNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REGISTRATION_NUMBER_RE, 'Invalid registration number'),
});

const personFields = {
  fullName: trimmed(2, 100, 'Full name').regex(
    /^[\p{L}][\p{L}\p{M} .'-]*$/u,
    'Full name can contain letters, spaces, dots, hyphens and apostrophes only',
  ),
  mobileNumber: z
    .string({ error: 'Mobile number is required' })
    .transform((value, ctx) => {
      const normalized = normalizeIndianMobile(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number' });
        return z.NEVER;
      }
      return normalized;
    }),
  address: trimmed(5, 300, 'Address'),
  // Client-generated UUID that makes the submit button idempotent.
  clientRequestId: z
    .string({ error: 'clientRequestId is required' })
    .regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid clientRequestId'),
};

const ticketQuantity = z.coerce
  .number({ error: 'Number of tickets is required' })
  .int('Number of tickets must be a whole number')
  .min(1, 'Book at least 1 ticket')
  .refine((value) => value <= getPricingConfig().maxTicketsPerBooking, {
    message: `You can book at most ${getPricingConfig().maxTicketsPerBooking} tickets per booking`,
  });

/** Dandiya Night entry: Couple/Single tickets only (no competitions). */
const dandiyaRegistration = z.object({
  type: z.literal('dandiya'),
  ...personFields,
  category: z.enum(['couple', 'single'], { error: 'Please choose Couple or Single' }),
  ticketQuantity,
});

/** Rangoli / Drawing entry: exactly one competition, one ticket (the participant). */
const competitionRegistration = z.object({
  type: z.literal('competition'),
  ...personFields,
  gender: z.enum(['male', 'female'], { error: 'Please select gender' }),
  competition: z.enum(['rangoli', 'drawing'], { error: 'Please select Rangoli or Drawing' }),
});

export const createRegistrationSchema = z
  .preprocess(
    // Requests without a type are Dandiya registrations.
    (value) => (value && typeof value === 'object' && !('type' in value) ? { ...value, type: 'dandiya' } : value),
    z.discriminatedUnion('type', [dandiyaRegistration, competitionRegistration], {
      error: 'Registration type must be "dandiya" or "competition"',
    }),
  )
  .transform((v) =>
    v.type === 'dandiya'
      ? { ...v, gender: null, rangoliSelected: false, drawingSelected: false }
      : {
          ...v,
          category: null,
          // Always a single ticket; any quantity sent by the client is ignored.
          ticketQuantity: 1,
          rangoliSelected: v.competition === 'rangoli',
          drawingSelected: v.competition === 'drawing',
        },
  );

export const createOrderSchema = registrationNumberParam;

export const verifyPaymentSchema = registrationNumberParam.extend({
  razorpay_order_id: z.string().trim().regex(/^order_[A-Za-z0-9]+$/, 'Invalid order ID'),
  razorpay_payment_id: z.string().trim().regex(/^pay_[A-Za-z0-9]+$/, 'Invalid payment ID'),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/, 'Invalid signature'),
});

export const paymentFailureSchema = registrationNumberParam.extend({
  razorpay_order_id: z.string().trim().regex(/^order_[A-Za-z0-9]+$/, 'Invalid order ID'),
  razorpay_payment_id: z.string().trim().max(64).optional(),
  cancelled: z.boolean().optional().default(false),
  code: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const ticketNumberParam = z.object({
  ticketNumber: z.string().trim().toUpperCase().regex(TICKET_NUMBER_RE, 'Invalid ticket number'),
});

/** Staff can scan a QR token or type a ticket number. */
export const ticketCodeParam = z.object({
  ticketNumber: z
    .string()
    .trim()
    .min(8)
    .max(64)
    .transform((value) => (TICKET_NUMBER_RE.test(value.toUpperCase()) ? value.toUpperCase() : value))
    .refine((value) => TICKET_NUMBER_RE.test(value) || /^[A-Za-z0-9_-]{20,40}$/.test(value), 'Invalid ticket code'),
});

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const adminRegistrationsQuery = z.object({
  q: z.string().trim().max(254).optional(),
  type: z.enum(['dandiya', 'competition']).optional(),
  category: z.enum(['couple', 'single']).optional(),
  paymentStatus: z.enum(['pending', 'failed', 'cancelled', 'paid']).optional(),
  competition: z.enum(['rangoli', 'drawing', 'both', 'any', 'none']).optional(),
  checkIn: z.enum(['none', 'partial', 'all']).optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportQuery = adminRegistrationsQuery.omit({ page: true, pageSize: true });

export const registrationIdParam = z.object({
  registrationId: z.string().trim().toUpperCase().regex(REGISTRATION_NUMBER_RE, 'Invalid registration ID'),
});
