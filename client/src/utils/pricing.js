/**
 * Mirror of server/src/services/pricing.service.js for the live estimate.
 * The server recalculates and is the only source of the amount actually charged.
 */
export function calculatePricing(pricing, { type = 'dandiya', category, ticketQuantity, rangoliSelected, drawingSelected }) {
  if (type === 'competition') return calculateCompetitionPricing(pricing, { rangoliSelected, drawingSelected, ticketQuantity });

  const categoryPrice = pricing?.categories?.[category];
  const quantity = Number(ticketQuantity);
  if (!categoryPrice || !Number.isInteger(quantity) || quantity < 1 || quantity > pricing.maxTicketsPerBooking) {
    return null;
  }

  const multiplier = pricing.competitionChargeMode === 'per_ticket' ? quantity : 1;
  const selected = { rangoli: rangoliSelected, drawing: drawingSelected };
  const competitions = ['rangoli', 'drawing']
    .filter((key) => selected[key])
    .map((key) => ({
      key,
      label: pricing.competitions[key].label,
      quantity: multiplier,
      basePaise: pricing.competitions[key].basePaise * multiplier,
      platformFeePaise: pricing.competitions[key].platformFeePaise * multiplier,
    }));

  const ticketSubtotalPaise = categoryPrice.basePaise * quantity;
  const ticketPlatformFeePaise = categoryPrice.platformFeePaise * quantity;
  const competitionSubtotalPaise = competitions.reduce((s, c) => s + c.basePaise, 0);
  const competitionPlatformFeePaise = competitions.reduce((s, c) => s + c.platformFeePaise, 0);

  return {
    type: 'dandiya',
    category,
    categoryLabel: categoryPrice.label,
    ticketQuantity: quantity,
    ticketUnitPaise: categoryPrice.basePaise,
    ticketUnitPlatformFeePaise: categoryPrice.platformFeePaise,
    ticketSubtotalPaise,
    ticketPlatformFeePaise,
    competitions,
    competitionSubtotalPaise,
    competitionPlatformFeePaise,
    totalAmountPaise: ticketSubtotalPaise + ticketPlatformFeePaise + competitionSubtotalPaise + competitionPlatformFeePaise,
  };
}

/** Rangoli / Drawing registration: one competition, one ticket per participant. */
function calculateCompetitionPricing(pricing, { rangoliSelected, drawingSelected, ticketQuantity }) {
  const selected = { rangoli: rangoliSelected, drawing: drawingSelected };
  const quantity = Number(ticketQuantity);
  const keys = ['rangoli', 'drawing'].filter((key) => selected[key]);
  if (keys.length !== 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > pricing.maxTicketsPerBooking) {
    return null;
  }
  const competitions = keys.map((key) => ({
    key,
    label: pricing.competitions[key].label,
    quantity,
    basePaise: pricing.competitions[key].basePaise * quantity,
    platformFeePaise: pricing.competitions[key].platformFeePaise * quantity,
  }));

  const competitionSubtotalPaise = competitions.reduce((s, c) => s + c.basePaise, 0);
  const competitionPlatformFeePaise = competitions.reduce((s, c) => s + c.platformFeePaise, 0);
  return {
    type: 'competition',
    category: null,
    ticketQuantity: quantity,
    ticketSubtotalPaise: 0,
    ticketPlatformFeePaise: 0,
    competitions,
    competitionSubtotalPaise,
    competitionPlatformFeePaise,
    totalAmountPaise: competitionSubtotalPaise + competitionPlatformFeePaise,
  };
}
