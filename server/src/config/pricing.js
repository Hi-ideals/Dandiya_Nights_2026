import { z } from 'zod';
import { env } from './env.js';

/**
 * Central pricing configuration. All amounts are integer paise (₹1 = 100 paise).
 * Override for future events with PRICING_CONFIG_JSON (same shape).
 */
export const DEFAULT_PRICING = Object.freeze({
  version: '2026-v2',
  currency: 'INR',
  maxTicketsPerBooking: 7,
  // 'per_registration' charges each selected competition once per booking;
  // 'per_ticket' multiplies competition fees by the ticket quantity.
  competitionChargeMode: 'per_registration',
  categories: {
    couple: { label: 'Couple', basePaise: 49900, platformFeePaise: 3100 },
    single: { label: 'Single', basePaise: 19900, platformFeePaise: 2100 },
  },
  competitions: {
    rangoli: { label: 'Rangoli Competition', basePaise: 9900, platformFeePaise: 1100 },
    drawing: { label: 'Drawing Competition', basePaise: 9900, platformFeePaise: 1100 },
  },
});

const paise = z.number().int().nonnegative();
const priceItem = z.object({ label: z.string().min(1), basePaise: paise, platformFeePaise: paise });

const pricingSchema = z.object({
  version: z.string().min(1),
  currency: z.literal('INR'),
  maxTicketsPerBooking: z.number().int().min(1).max(50),
  competitionChargeMode: z.enum(['per_registration', 'per_ticket']),
  categories: z.object({ couple: priceItem, single: priceItem }),
  competitions: z.object({ rangoli: priceItem, drawing: priceItem }),
});

let cached;

export function getPricingConfig() {
  if (cached) return cached;
  const config = env.pricingConfigJson ? JSON.parse(env.pricingConfigJson) : DEFAULT_PRICING;
  cached = Object.freeze(pricingSchema.parse(config));
  return cached;
}

export function resetPricingCache() {
  cached = undefined;
}
