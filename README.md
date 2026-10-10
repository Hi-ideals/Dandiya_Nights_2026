# Dandiya Nights — Registration & Ticketing Platform

Event registration, dynamic pricing, Razorpay payments, QR tickets (PDF), staff check-in, and an admin
dashboard with Excel export for **Dandiya Nights & Drawing & Rangoli Competition** by Team Agni - Bidar Vibes KA38.

```
Dandiya_Nights/
├── client/                 React 19 + Vite + Tailwind (Firebase Hosting)
├── server/                 Node.js + Express 5 API (Firestore via Admin SDK, Razorpay, PDFKit, ExcelJS)
├── firebase.json           Hosting + Firestore config
├── firestore.rules         Denies all direct client access (backend-only data)
└── firestore.indexes.json  Composite indexes for admin filters
```

## How it works

1. Attendee taps Register and **signs in with Google** (Firebase Auth), then fills the form; the browser shows a
   live estimate.
2. `POST /api/registrations` verifies the Firebase ID token, validates input, **recalculates the price on the
   server** (integer paise) and stores a pending registration owned by that account (`userId`, `email`) with a
   pricing snapshot. Only the owner (or an admin) can view, pay for or download that booking.
3. `POST /api/payments/create-order` creates (or safely reuses) the Razorpay order for the server amount.
4. Razorpay Checkout runs. Its success callback only forwards the signed response to `POST /api/payments/verify`,
   which checks the HMAC signature **and** fetches the payment from Razorpay to confirm order, amount, currency and
   `captured` status.
5. Confirmation runs in one Firestore transaction: registration → `paid`, one ticket per booked ticket
   (`DN26XXXXXX-01`, `-02`…) with a random QR token. The webhook (`payment.captured` / `order.paid`) and the
   "check status" reconciliation use the same idempotent function, so duplicate callbacks never create duplicate
   tickets or charges.
6. The attendee sees tickets with QR codes and downloads one PDF for all tickets or individual PDFs.
7. Staff scan QR codes at the gate (`/staff/check-in`); a transaction guarantees each ticket is admitted once.

### Pricing (configurable)

| Item | Base | Platform fee | Total |
|---|---:|---:|---:|
| Couple ticket | ₹499 | ₹31 | ₹530 |
| Single ticket | ₹199 | ₹21 | ₹220 |
| Rangoli Competition | ₹99 | ₹11 | ₹110 |
| Drawing Competition | ₹99 | ₹11 | ₹110 |

Competitions are charged once per booking (`competitionChargeMode: per_registration`). Change prices for a future
event with `PRICING_CONFIG_JSON` in `server/.env` (see `.env.example`); existing bookings keep their snapshot.

---

## 1. Prerequisites

- Node.js 20+ and npm
- A Firebase project (Blaze plan only needed if you deploy the API to Cloud Functions/Cloud Run)
- A Razorpay account (Test Mode works without KYC)
- Firebase CLI: `npm install -g firebase-tools`

## 2. Firebase setup

### Create a new project (or use an existing one)

1. Open <https://console.firebase.google.com> → **Add project** (or select your existing project).
2. **Build → Firestore Database → Create database** → *Production mode* → region `asia-south1` (Mumbai).
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
   Do not enable public sign-up anywhere in the app; admins are created by script.
4. **Project settings → General → Your apps → Web (`</>`)** → register "dandiya-web". Copy `apiKey`,
   `authDomain`, `projectId`, `appId` into `client/.env`.
5. **Project settings → Service accounts → Generate new private key.** Save the JSON **outside the repo**
   (e.g. `server/secrets/service-account.json`, which is git-ignored). Never put it in the frontend.

### Link the CLI and deploy rules + indexes

```bash
firebase login
firebase use --add            # pick your project, alias "default"
firebase deploy --only firestore:rules,firestore:indexes
```

Firestore rules deny every direct read/write. The browser only uses Firebase **Authentication**; all data goes
through the Express API, which verifies Firebase ID tokens and roles itself (the Admin SDK bypasses rules).

## 3. Razorpay setup (Test Mode)

1. Dashboard → switch to **Test Mode** → **Account & Settings → API Keys → Generate Test Key**.
   Put `rzp_test_…` and its secret into `server/.env`. The secret never goes to the frontend.
2. **Account & Settings → Payment capture → Automatic capture** (recommended). The API also captures
   authorized payments itself as a fallback.
3. **Webhooks → Add new webhook** (after the API is reachable over HTTPS):
   - URL: `https://<your-api-host>/api/payments/webhook`
   - Secret: a random string → `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `payment.authorized`

   For local testing expose the API with a tunnel (e.g. `ngrok http 5000`) and use that URL.

Test cards / UPI: <https://razorpay.com/docs/payments/payments/test-card-upi-details/> (e.g. UPI `success@razorpay`).

## 4. Run locally

```bash
# API
cd server
npm install
cp .env.example .env          # fill Firebase, Razorpay, event details
npm run dev                   # http://localhost:5000/api/health

# Create the first admin (prompts for a password) — and staff accounts for the gate
npm run create-admin -- --email admin@example.com --name "Event Admin" --role admin
npm run create-admin -- --email gate1@example.com --name "Gate 1" --role staff

# Frontend (new terminal)
cd client
npm install
cp .env.example .env          # Firebase web config; VITE_API_BASE_URL=/api uses the dev proxy
npm run dev                   # http://localhost:5173
```

Attendees use **Google sign-in**: Firebase Console → Authentication → Sign-in method → **Google → Enable**
(choose a support email). Organisers keep using email/password accounts from `create-admin`.

### Event poster

- `client/public/poster.jpg` — landing page hero (shown uncropped so the poster text stays readable).
- `server/assets/poster.jpg` — header image on PDF tickets (JPG/PNG).

Until they exist, a festive placeholder is shown automatically.

## 5. Tests

```bash
cd server && npm test
```

83 tests cover pricing (all spec examples), validation, 7-ticket limit, duplicate submissions, order reuse on
retry, signature/amount/order tampering, uncaptured payments, duplicate verify callbacks and webhook deliveries,
duplicate payments flagged for refund, simulated database outage + webhook retry, reconciliation, booking ownership
isolation, PDF downloads, QR/number verification, concurrent check-in, admin authorization, filters, dashboard
revenue and Excel export (3 sheets, formula-injection escaping). Tests use in-memory Firestore/Razorpay fakes.

## 6. Deploy

### Recommended: Docker on your own server (e.g. E2E Networks, Ubuntu)

Two containers: `api` (Node, internal only) and `web` (Caddy: serves the React build, proxies `/api`,
automatic HTTPS). Files: `docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile`, `client/Caddyfile`.

```bash
# On the server, inside the cloned repo
cp .env.example .env                       # DOMAIN=dandiyanight.arthotthanaparishat.in, ACME_EMAIL=...
# copy (scp) server/.env, server/secrets/service-account.json, client/.env.production (VITE_API_BASE_URL=/api)
chown 1000:1000 server/secrets/service-account.json && chmod 600 server/secrets/service-account.json
docker compose up -d --build
docker compose exec api node scripts/create-admin.js --email you@example.com --name "Admin" --role admin
```

DNS `A` record for the domain must point to the server and ports 80/443 must be open before the first start
(Caddy requests the certificate then). Update later with `bash deploy/docker-update.sh`.
Logs: `docker compose logs -f api` / `docker compose logs -f web`.

### API (Render / Railway / any Node host)

- Root directory `server`, build `npm install`, start `npm start`, Node 20+.
- Environment: everything in `server/.env.example` with `NODE_ENV=production`, `TRUST_PROXY=1`,
  `CLIENT_URL=https://<project>.web.app,https://<your-domain>`.
- Credentials: set `FIREBASE_SERVICE_ACCOUNT_BASE64` to the base64 of the service-account JSON
  (`base64 -w0 service-account.json`) or mount the file and set `GOOGLE_APPLICATION_CREDENTIALS`.
- On Google Cloud Run, attach a service account with *Cloud Datastore User* + *Firebase Authentication Admin*
  roles and omit key files entirely.
- The server refuses to start in production without Razorpay keys and the webhook secret.

### Frontend (Firebase Hosting)

```bash
cd client
# client/.env.production
#   VITE_API_BASE_URL=https://<your-api-host>/api
#   VITE_FIREBASE_* = production web config
npm run build
cd ..
firebase deploy --only hosting
```

Then add the hosting domain(s) to **Authentication → Settings → Authorized domains**, and update the Razorpay
webhook URL to the production API.

### Go-live checklist

1. Run a complete Test Mode booking on production: register → pay → tickets → PDF → staff check-in → export.
2. Razorpay: complete KYC, generate **Live** keys, create a **Live** webhook (new secret), set
   `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` to live values, restart the API.
3. Set real `EVENT_CONTACT_PHONE` / `EVENT_CONTACT_EMAIL`.
4. Backups: enable Firestore **Point-in-time recovery** or schedule exports
   (`gcloud firestore export gs://<bucket>/backups/$(date +%F)`), and set budget alerts in Google Cloud Billing.
5. Monitor: Razorpay webhook delivery logs, API logs (`[payments] duplicate payment … refund required` warnings),
   Firestore usage tab.

## 7. API reference

| Method | Path | Access |
|---|---|---|
| GET | `/api/health`, `/api/config` | public |
| POST | `/api/registrations` | signed-in attendee (rate limited) |
| GET | `/api/registrations/:no/status` | public, no personal data |
| GET | `/api/me/bookings` | signed-in attendee — own bookings |
| GET | `/api/registrations/:no` | booking owner (Google ID token) or admin |
| GET | `/api/registrations/:no/tickets/download` | booking owner — all tickets PDF |
| POST | `/api/payments/create-order` · `/verify` · `/failure` · `/reconcile` | booking owner |
| POST | `/api/payments/webhook` | Razorpay signature (raw body) |
| GET | `/api/tickets/:ticketNumber/download` | booking owner — single ticket PDF |
| GET | `/api/tickets/verify/:ticketNumberOrQrToken` | staff/admin ID token |
| POST | `/api/tickets/:ticketNumberOrQrToken/check-in` | staff/admin ID token |
| GET | `/api/admin/me` | staff/admin |
| GET | `/api/admin/dashboard` · `/registrations` · `/registrations/:id` · `/export/excel` | admin |

Admin list/export filters: `q, category, paymentStatus, competition (rangoli|drawing|both|any|none),
checkIn (none|partial|all), from, to (YYYY-MM-DD, IST), page, pageSize`.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not load the default credentials` | Set `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_BASE64`. |
| `FAILED_PRECONDITION: The query requires an index` | `firebase deploy --only firestore:indexes` and wait for the build to finish. |
| Admin login says "no admin or staff access" | Run `npm run create-admin` for that email, then sign in again. |
| CORS error in browser | Add the exact site origin (no trailing slash) to `CLIENT_URL`. |
| Webhook 400 `INVALID_WEBHOOK_SIGNATURE` | Secret mismatch between Razorpay dashboard and `RAZORPAY_WEBHOOK_SECRET`. |
| Paid but booking still pending | Attendee taps "I've already paid - check status" (reconciles with Razorpay); check webhook logs. |
| Google sign-in fails inside Instagram/Facebook | Those in-app browsers are blocked by Google; open the site in Chrome/Safari. |
| `auth/unauthorized-domain` | Add your site domain in Authentication → Settings → Authorized domains. |
| Camera scanner won't start | Site must be HTTPS (or localhost) and camera permission allowed; manual ticket entry always works. |
| Duplicate payment flagged | Refund the payment shown as "Duplicate - refund" in the registration detail via Razorpay dashboard. |
