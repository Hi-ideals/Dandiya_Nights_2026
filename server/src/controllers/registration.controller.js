import * as registrationService from '../services/registration.service.js';
import { getPublicEventConfig } from '../config/event.js';
import { getPublicPricing } from '../services/pricing.service.js';
import { env } from '../config/env.js';

export function getPublicConfig(_req, res) {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ event: getPublicEventConfig(), pricing: getPublicPricing(), razorpayKeyId: env.razorpay.keyId });
}

export async function createRegistration(req, res) {
  const result = await registrationService.createRegistration(req.valid.body, req.user);
  res.status(result.reused ? 200 : 201).json(result);
}

export async function getRegistrationStatus(req, res) {
  const reg = await registrationService.getRegistrationOrThrow(req.valid.params.registrationNumber);
  res.set('Cache-Control', 'no-store');
  res.json(registrationService.toStatusView(reg));
}

export async function getBooking(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await registrationService.getOwnerBooking(req.valid.params.registrationNumber));
}

export async function listMyBookings(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ items: await registrationService.listUserBookings(req.user.uid) });
}
