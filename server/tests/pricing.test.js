import { describe, expect, it } from 'vitest';
import { calculatePricing } from '../src/services/pricing.service.js';
import { DEFAULT_PRICING } from '../src/config/pricing.js';
import { normalizeIndianMobile } from '../src/utils/format.js';
import { safeCell } from '../src/services/excel.service.js';

const total = (input) => calculatePricing({ rangoliSelected: false, drawingSelected: false, ...input }).totalAmountPaise;

describe('pricing', () => {
  it.each([
    ['1 couple', { category: 'couple', ticketQuantity: 1 }, 53000],
    ['2 couple', { category: 'couple', ticketQuantity: 2 }, 106000],
    ['1 single', { category: 'single', ticketQuantity: 1 }, 22000],
    ['3 single', { category: 'single', ticketQuantity: 3 }, 66000],
    ['1 couple + rangoli', { category: 'couple', ticketQuantity: 1, rangoliSelected: true }, 64000],
    ['1 single + drawing', { category: 'single', ticketQuantity: 1, drawingSelected: true }, 33000],
    ['2 single + both', { category: 'single', ticketQuantity: 2, rangoliSelected: true, drawingSelected: true }, 66000],
    ['7 couple (max)', { category: 'couple', ticketQuantity: 7 }, 371000],
  ])('%s', (_label, input, expected) => {
    expect(total(input)).toBe(expected);
  });

  it('returns a detailed breakdown in integer paise', () => {
    const b = calculatePricing({ category: 'couple', ticketQuantity: 2, rangoliSelected: true, drawingSelected: false });
    expect(b).toMatchObject({
      ticketSubtotalPaise: 99800,
      ticketPlatformFeePaise: 6200,
      competitionSubtotalPaise: 9900,
      competitionPlatformFeePaise: 1100,
      totalAmountPaise: 117000,
      currency: 'INR',
    });
    expect(b.competitions).toHaveLength(1);
    Object.values(b).filter((v) => typeof v === 'number').forEach((v) => expect(Number.isInteger(v)).toBe(true));
  });

  it('charges competitions once per registration, not per ticket', () => {
    expect(total({ category: 'single', ticketQuantity: 5, rangoliSelected: true })).toBe(5 * 22000 + 11000);
  });

  it('supports per-ticket competition charging when configured', () => {
    const pricing = { ...DEFAULT_PRICING, competitionChargeMode: 'per_ticket' };
    const b = calculatePricing({ category: 'single', ticketQuantity: 3, rangoliSelected: true }, pricing);
    expect(b.totalAmountPaise).toBe(3 * 22000 + 3 * 11000);
  });

  it.each([0, 8, 2.5, -1])('rejects ticket quantity %s', (ticketQuantity) => {
    expect(() => calculatePricing({ category: 'couple', ticketQuantity })).toThrow(/between 1 and 7/);
  });

  it.each([
    ['1 Rangoli ticket', { competition: 'rangoli', ticketQuantity: 1 }, 11000],
    ['3 Drawing tickets', { competition: 'drawing', ticketQuantity: 3 }, 33000],
    ['7 Rangoli tickets (max)', { competition: 'rangoli', ticketQuantity: 7 }, 77000],
  ])('competition: %s', (_label, { competition, ticketQuantity }, expected) => {
    const b = calculatePricing({
      type: 'competition',
      rangoliSelected: competition === 'rangoli',
      drawingSelected: competition === 'drawing',
      ticketQuantity,
    });
    expect(b).toMatchObject({ totalAmountPaise: expected, ticketSubtotalPaise: 0, ticketQuantity });
    expect(b.competitions).toEqual([expect.objectContaining({ key: competition, quantity: ticketQuantity })]);
  });

  it('competition pricing needs exactly one competition', () => {
    expect(() => calculatePricing({ type: 'competition', ticketQuantity: 1 })).toThrow(/Rangoli or Drawing/);
    expect(() =>
      calculatePricing({ type: 'competition', rangoliSelected: true, drawingSelected: true, ticketQuantity: 1 }),
    ).toThrow(/Rangoli or Drawing/);
  });

  it('rejects an unknown category', () => {
    expect(() => calculatePricing({ category: 'family', ticketQuantity: 1 })).toThrow();
  });
});

describe('mobile number normalisation', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['98765-43210', '9876543210'],
  ])('%s -> %s', (input, expected) => expect(normalizeIndianMobile(input)).toBe(expected));

  it.each(['5876543210', '98765', 'abcdefghij', '+1 9876543210', ''])('rejects %s', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe('spreadsheet formula escaping', () => {
  it.each(['=HYPERLINK("x")', '+cmd', '-2+3', '@SUM(A1)'])('escapes %s', (value) => {
    expect(safeCell(value)).toBe(`'${value}`);
  });
  it('leaves normal values alone', () => {
    expect(safeCell('Priya')).toBe('Priya');
    expect(safeCell(42)).toBe(42);
  });
});
