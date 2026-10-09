import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const list = (value, fallback) =>
  (value || fallback)
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';
const clientUrls = list(process.env.CLIENT_URL, 'http://localhost:5173');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5000,
  clientUrls,
  // Base URL used inside QR codes and links shown to attendees.
  publicAppUrl: (process.env.PUBLIC_APP_URL || clientUrls[0]).replace(/\/+$/, ''),
  trustProxy: process.env.TRUST_PROXY ?? (nodeEnv === 'production' ? '1' : 'false'),

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
    // Optional: base64-encoded service account JSON for hosts without file-based secrets.
    serviceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || undefined,
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  adminEmail: process.env.ADMIN_EMAIL || '',
  pricingConfigJson: process.env.PRICING_CONFIG_JSON || '',
};

const REQUIRED_IN_PRODUCTION = [
  ['RAZORPAY_KEY_ID', env.razorpay.keyId],
  ['RAZORPAY_KEY_SECRET', env.razorpay.keySecret],
  ['RAZORPAY_WEBHOOK_SECRET', env.razorpay.webhookSecret],
  ['CLIENT_URL', process.env.CLIENT_URL],
];

export function validateEnv() {
  const missing = REQUIRED_IN_PRODUCTION.filter(([, value]) => !value).map(([name]) => name);

  if (env.isProduction && missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (env.isProduction && env.razorpay.keyId.startsWith('rzp_test_')) {
    console.warn('[config] Razorpay is running in TEST mode in production.');
  }
  if (!env.isProduction && missing.length) {
    console.warn(`[config] Missing (ok for local dev only): ${missing.join(', ')}`);
  }
}
