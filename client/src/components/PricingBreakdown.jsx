import { formatINR } from '../utils/format';

function Row({ label, detail, amount, muted }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-1.5 text-sm ${muted ? 'text-stone-500' : 'text-stone-700'}`}>
      <div>
        <p>{label}</p>
        {detail && <p className="text-xs text-stone-400">{detail}</p>}
      </div>
      <p className="shrink-0 tabular-nums">{formatINR(amount)}</p>
    </div>
  );
}

/** Shared by the registration form (live estimate) and the booking page (charged snapshot). */
export default function PricingBreakdown({
  breakdown,
  title = 'Price breakdown',
  totalLabel = 'Total payable',
  note,
  emptyHint = 'Choose a category and number of tickets to see the total.',
  className = '',
}) {
  if (!breakdown) {
    return (
      <div className={`card p-5 ${className}`}>
        <h3 className="font-semibold text-maroon-800">{title}</h3>
        <p className="mt-2 text-sm text-stone-500">{emptyHint}</p>
      </div>
    );
  }

  const b = breakdown;
  // Competition bookings have no Couple/Single entry tickets.
  const hasEntryTickets = b.type !== 'competition' && b.ticketSubtotalPaise > 0;
  return (
    <div className={`card overflow-hidden ${className}`} aria-live="polite">
      <div className="border-b border-maroon-100 bg-maroon-50/60 px-5 py-3">
        <h3 className="font-semibold text-maroon-800">{title}</h3>
      </div>
      <div className="divide-y divide-dashed divide-stone-200 px-5 py-2">
        {hasEntryTickets && (
        <div className="py-1">
          <Row
            label={`${b.categoryLabel ?? b.category} ticket × ${b.ticketQuantity}`}
            detail={`${formatINR(b.ticketUnitPaise)} each`}
            amount={b.ticketSubtotalPaise}
          />
          <Row
            label="Ticket platform fee"
            detail={`${formatINR(b.ticketUnitPlatformFeePaise)} × ${b.ticketQuantity}`}
            amount={b.ticketPlatformFeePaise}
            muted
          />
        </div>
        )}
        {b.competitions?.length > 0 && (
          <div className="py-1">
            {b.competitions.map((c) => (
              <Row
                key={c.key}
                label={c.label}
                detail={`Fee ${formatINR(c.basePaise)} + platform ${formatINR(c.platformFeePaise)}${
                  c.quantity > 1 ? ` (× ${c.quantity})` : ''
                }`}
                amount={c.basePaise + c.platformFeePaise}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between bg-maroon-900 px-5 py-4 text-white">
        <span className="font-medium">{totalLabel}</span>
        <span className="font-display text-2xl text-gold-300 tabular-nums">{formatINR(b.totalAmountPaise)}</span>
      </div>
      {note && <p className="px-5 py-3 text-xs text-stone-500">{note}</p>}
    </div>
  );
}
