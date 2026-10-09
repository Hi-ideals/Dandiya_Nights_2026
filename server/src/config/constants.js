export const COLLECTIONS = Object.freeze({
  admins: 'admins',
  registrations: 'registrations',
  payments: 'payments',
  tickets: 'tickets',
  webhookEvents: 'webhookEvents',
  idempotencyKeys: 'idempotencyKeys',
});

// Registration-level payment status. 'paid' is terminal.
export const PAYMENT_STATUS = Object.freeze({
  pending: 'pending',
  failed: 'failed',
  cancelled: 'cancelled',
  paid: 'paid',
});

export const REGISTRATION_STATUS = Object.freeze({
  pendingPayment: 'pending_payment',
  confirmed: 'confirmed',
});

// Status of an individual Razorpay order record in the `payments` collection.
export const ORDER_STATUS = Object.freeze({
  created: 'created',
  failed: 'failed',
  cancelled: 'cancelled',
  paid: 'paid',
  // A second successful payment for an already-paid registration; needs a manual refund.
  duplicate: 'duplicate',
});

export const TICKET_STATUS = Object.freeze({
  active: 'active',
  cancelled: 'cancelled',
});

export const ROLES = Object.freeze({ admin: 'admin', staff: 'staff' });
