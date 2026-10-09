import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAdmin, requireBookingOwner, requireStaff, requireUser } from '../middleware/auth.js';
import {
  downloadLimiter,
  paymentLimiter,
  registrationLimiter,
  staffLimiter,
} from '../middleware/rateLimiters.js';
import {
  adminRegistrationsQuery,
  createOrderSchema,
  createRegistrationSchema,
  exportQuery,
  paymentFailureSchema,
  registrationIdParam,
  registrationNumberParam,
  ticketCodeParam,
  ticketNumberParam,
  verifyPaymentSchema,
} from '../validators/schemas.js';
import * as registration from '../controllers/registration.controller.js';
import * as payment from '../controllers/payment.controller.js';
import * as ticket from '../controllers/ticket.controller.js';
import * as admin from '../controllers/admin.controller.js';

const router = Router();

// Attendees must be signed in (Google) and own the booking.
const bookingFromParams = [requireUser, requireBookingOwner((req) => req.valid.params.registrationNumber)];
const bookingFromBody = [requireUser, requireBookingOwner((req) => req.valid.body.registrationNumber)];
const bookingFromTicket = [requireUser, requireBookingOwner((req) => req.valid.params.ticketNumber.split('-')[0])];

router.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
router.get('/config', registration.getPublicConfig);

// Public registration
router.post(
  '/registrations',
  registrationLimiter,
  requireUser,
  validate(createRegistrationSchema),
  registration.createRegistration,
);
router.get('/me/bookings', requireUser, registration.listMyBookings);
router.get(
  '/registrations/:registrationNumber/status',
  validate(registrationNumberParam, 'params'),
  registration.getRegistrationStatus,
);
router.get(
  '/registrations/:registrationNumber',
  validate(registrationNumberParam, 'params'),
  bookingFromParams,
  registration.getBooking,
);
router.get(
  '/registrations/:registrationNumber/tickets/download',
  downloadLimiter,
  validate(registrationNumberParam, 'params'),
  bookingFromParams,
  ticket.downloadBookingTickets,
);

// Payments (webhook is mounted in app.js with a raw body parser)
router.post('/payments/create-order', paymentLimiter, validate(createOrderSchema), bookingFromBody, payment.createOrder);
router.post('/payments/verify', paymentLimiter, validate(verifyPaymentSchema), bookingFromBody, payment.verifyPayment);
router.post('/payments/failure', paymentLimiter, validate(paymentFailureSchema), bookingFromBody, payment.reportFailure);
router.post('/payments/reconcile', paymentLimiter, validate(createOrderSchema), bookingFromBody, payment.reconcile);

// Tickets
router.get(
  '/tickets/:ticketNumber/download',
  downloadLimiter,
  validate(ticketNumberParam, 'params'),
  bookingFromTicket,
  ticket.downloadTicket,
);
router.get('/tickets/verify/:ticketNumber', staffLimiter, requireStaff, validate(ticketCodeParam, 'params'), ticket.verifyTicket);
router.post('/tickets/:ticketNumber/check-in', staffLimiter, requireStaff, validate(ticketCodeParam, 'params'), ticket.checkIn);

// Admin
router.get('/admin/me', requireStaff, admin.me);
router.get('/admin/dashboard', requireAdmin, admin.dashboard);
router.get('/admin/registrations', requireAdmin, validate(adminRegistrationsQuery, 'query'), admin.listRegistrations);
router.get(
  '/admin/registrations/:registrationId',
  requireAdmin,
  validate(registrationIdParam, 'params'),
  admin.getRegistration,
);
router.get('/admin/export/excel', requireAdmin, validate(exportQuery, 'query'), admin.exportExcel);

export default router;
