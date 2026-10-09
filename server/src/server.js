import { env, validateEnv } from './config/env.js';
import { createApp } from './app.js';

validateEnv();

const app = createApp();
// HOST=127.0.0.1 in production keeps the API reachable only through Nginx.
const server = app.listen(env.port, process.env.HOST || '0.0.0.0', () => {
  console.log(`[server] Dandiya Nights API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${env.port} is already in use. Stop the other process or set PORT in server/.env.`);
  } else {
    console.error('[server] Failed to start:', err);
  }
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
