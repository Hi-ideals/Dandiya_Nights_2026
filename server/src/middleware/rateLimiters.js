import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMinutes, limit) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' } },
  });

export const globalLimiter = make(15, 600);
export const registrationLimiter = make(15, 20);
export const paymentLimiter = make(15, 60);
export const downloadLimiter = make(15, 60);
export const staffLimiter = make(1, 120);
