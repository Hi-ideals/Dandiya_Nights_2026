import { getPricingConfig } from '../config/pricing.js';
import { AppError } from '../utils/AppError.js';

export const COMPETITION_KEYS = ['rangoli', 'drawing'];

/**
 * Authoritative price calculation (integer paise). The frontend mirrors this for the
 * live estimate, but only this result is ever charged.
 */
export function calculatePricing(
  { category, ticketQuantity, rangoliSelected = false, drawingSelected = false },
  pricing = getPricingConfig(),
) {
  const categoryPrice = pricing.categories[category];
  if (!categoryPrice) {
    throw new AppError(400, 'INVALID_CATEGORY', 'Please choose Couple or Single');
  }
  if (!Number.isInteger(ticketQuantity) || ticketQuantity < 1 || ticketQuantity > pricing.maxTicketsPerBooking) {
    throw new AppError(
      400,
      'INVALID_TICKET_QUANTITY',
      `You can book between 1 and ${pricing.maxTicketsPerBooking} tickets`,
    );
  }

  const selected = { rangoli: Boolean(rangoliSelected), drawing: Boolean(drawingSelected) };
  const competitionMultiplier = pricing.competitionChargeMode === 'per_ticket' ? ticketQuantity : 1;

  const competitions = COMPETITION_KEYS.filter((key) => selected[key]).map((key) => {
    const item = pricing.competitions[key];
    return {
      key,
      label: item.label,
      quantity: competitionMultiplier,
      basePaise: item.basePaise * competitionMultiplier,
      platformFeePaise: item.platformFeePaise * competitionMultiplier,
    };
  });

  const ticketSubtotalPaise = categoryPrice.basePaise * ticketQuantity;
  const ticketPlatformFeePaise = categoryPrice.platformFeePaise * ticketQuantity;
  const competitionSubtotalPaise = competitions.reduce((sum, c) => sum + c.basePaise, 0);
  const competitionPlatformFeePaise = competitions.reduce((sum, c) => sum + c.platformFeePaise, 0);

  return {
    pricingVersion: pricing.version,
    currency: pricing.currency,
    category,
    categoryLabel: categoryPrice.label,
    ticketQuantity,
    ticketUnitPaise: categoryPrice.basePaise,
    ticketUnitPlatformFeePaise: categoryPrice.platformFeePaise,
    ticketSubtotalPaise,
    ticketPlatformFeePaise,
    competitions,
    competitionSubtotalPaise,
    competitionPlatformFeePaise,
    totalAmountPaise:
      ticketSubtotalPaise + ticketPlatformFeePaise + competitionSubtotalPaise + competitionPlatformFeePaise,
  };
}

/** Pricing exposed to the frontend for the live estimate. */
export function getPublicPricing() {
  const pricing = getPricingConfig();
  return {
    version: pricing.version,
    currency: pricing.currency,
    maxTicketsPerBooking: pricing.maxTicketsPerBooking,
    competitionChargeMode: pricing.competitionChargeMode,
    categories: pricing.categories,
    competitions: pricing.competitions,
  };
}
