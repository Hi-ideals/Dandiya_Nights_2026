import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:5173',
      RAZORPAY_KEY_ID: 'rzp_test_dummy',
      RAZORPAY_KEY_SECRET: 'test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
      EVENT_POSTER_PATH: 'assets/does-not-exist.jpg',
    },
  },
});
