import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { webhook } from './controllers/payment.controller.js';
import { globalLimiter } from './middleware/rateLimiters.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  const trustProxy = env.trustProxy === 'false' ? false : env.trustProxy === 'true' ? true : Number(env.trustProxy) || env.trustProxy;
  app.set('trust proxy', trustProxy);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Razorpay webhook needs the exact raw bytes for signature verification,
  // so it is registered before (and without) the JSON parser and CORS.
  app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), webhook);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.clientUrls.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '20kb' }));
  app.use('/api', globalLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
