import { getPricingConfig } from '../config/pricing.js';
import { AppError } from '../utils/AppError.js';

export const COMPETITION_KEYS = ['rangoli', 'drawing'];

export const REGISTRATION_TYPES = Object.freeze({ dandiya: 'dandiya', competition: 'competition' });

/** One competition, charged per ticket (one ticket per participant). */
function calculateCompetitionPricing({ rangoliSelected = false, drawingSelected = false, ticketQuantity }, pricing) {
  const selected = { rangoli: Boolean(rangoliSelected), drawing: Boolean(drawingSelected) };
  const keys = COMPETITION_KEYS.filter((key) => selected[key]);
  if (keys.length !== 1) {
    throw new AppError(400, 'INVALID_COMPETITION', 'Please select Rangoli or Drawing');
  }
  if (!Number.isInteger(ticketQuantity) || ticketQuantity < 1 || ticketQuantity > pricing.maxTicketsPerBooking) {
    throw new AppError(400, 'INVALID_TICKET_QUANTITY', `You can book between 1 and ${pricing.maxTicketsPerBooking} tickets`);
  }
  const competitions = keys.map((key) => {
    const item = pricing.competitions[key];
    return {
      key,
      label: item.label,
      quantity: ticketQuantity,
      basePaise: item.basePaise * ticketQuantity,
      platformFeePaise: item.platformFeePaise * ticketQuantity,
    };
  });

  const competitionSubtotalPaise = competitions.reduce((sum, c) => sum + c.basePaise, 0);
  const competitionPlatformFeePaise = competitions.reduce((sum, c) => sum + c.platformFeePaise, 0);
  return {
    pricingVersion: pricing.version,
    currency: pricing.currency,
    type: REGISTRATION_TYPES.competition,
    category: null,
    categoryLabel: 'Competition',
    ticketQuantity,
    ticketUnitPaise: 0,
    ticketUnitPlatformFeePaise: 0,
    ticketSubtotalPaise: 0,
    ticketPlatformFeePaise: 0,
    competitions,
    competitionSubtotalPaise,
    competitionPlatformFeePaise,
    totalAmountPaise: competitionSubtotalPaise + competitionPlatformFeePaise,
  };
}

/**
 * Authoritative price calculation (integer paise). The frontend mirrors this for the
 * live estimate, but only this result is ever charged.
 *
 * type "dandiya": Couple/Single entry tickets (competition flags are only honoured for
 * legacy combined bookings). type "competition": Rangoli and/or Drawing entries.
 */
export function calculatePricing(input, pricing = getPricingConfig()) {
  if (input.type === REGISTRATION_TYPES.competition) return calculateCompetitionPricing(input, pricing);

  const { category, ticketQuantity, rangoliSelected = false, drawingSelected = false } = input;
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
    type: REGISTRATION_TYPES.dandiya,
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
