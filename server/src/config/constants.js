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

// What a ticket admits to. Dandiya tickets use the category; competition tickets the competition.
export const TICKET_TYPE_LABELS = Object.freeze({
  couple: 'Dandiya Night - Couple (admits 2)',
  single: 'Dandiya Night - Single (admits 1)',
  rangoli: 'Rangoli Competition (1 participant)',
  drawing: 'Drawing Competition (1 participant)',
});

/** Ticket types issued for a registration, in ticket-number order. */
export function ticketTypesFor(reg) {
  if (reg.type === 'competition') {
    const competition = reg.rangoliSelected ? 'rangoli' : 'drawing';
    return Array.from({ length: reg.ticketQuantity }, () => competition);
  }
  return Array.from({ length: reg.ticketQuantity }, () => reg.category);
}

/** Bookings created before competitions were split out have no type: they are Dandiya. */
export const registrationType = (reg) => reg.type ?? 'dandiya';
