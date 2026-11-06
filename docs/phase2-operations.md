# Phase 2 local operations

RecoverAI Phase 2 persists payments, cases, webhooks, and background recovery attempts in **SQLite** via Prisma. This guide covers a typical developer machine setup.

## Environment variables

Copy `.env.example` to `.env.local` (or `.env`) and fill in values. **Never commit** secret files. **Never** put secrets in `NEXT_PUBLIC_*` variables.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite connection string, e.g. `file:./dev.db` (relative to `prisma/`) |
| `RAZORPAY_KEY_ID` | Razorpay test key id for live gateway mode |
| `RAZORPAY_KEY_SECRET` | Razorpay test secret (checkout HMAC + API) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC secret from Razorpay dashboard |
| `RAZORPAY_USE_FAKE` | Set `true` to use the in-process fake gateway (tests, local API without keys) |
| `FASTAPI_URL` | ML service base URL, default `http://localhost:8000` |
| `RECOVERY_WORKER_ENABLED` | Set `true` to start in-process worker ticks via `instrumentation.ts` |
| `WORKER_SECRET` | Shared secret for `POST /api/internal/worker/tick` (`x-worker-secret` header) |
| `INTERNAL_WORKER_BASE_URL` | Optional base URL for instrumentation HTTP ticks (default `http://127.0.0.1:$PORT`) |

Phase 4 seed admin variables in `.env.example` are unused in Phase 2.

## SQLite database configuration

- Default dev database: `prisma/dev.db` when `DATABASE_URL="file:./dev.db"`.
- Database files (`prisma/*.db`, journals) are **gitignored**.
- SQLite is a **single-writer** store suitable for local demo and tests. It is not intended for multi-instance production; a future phase may move to PostgreSQL by changing the Prisma datasource only.

## Clean database migration

On an **empty** database (no file yet):

```bash
npx prisma migrate deploy
```

For iterative local schema work:

```bash
npm run db:migrate
```

Vitest sets `DATABASE_URL=file:./test.db` and runs `migrate deploy` + seed in `tests/global-setup.ts`.

## Database seeding

Payment routes require the demo merchant, customer, and active policy:

```bash
npm run db:seed
# equivalent: npx prisma db seed
```

Seed script: `prisma/seed.ts` (`RecoverAI Demo`, `demo_customer_001`, active `MerchantPolicy`).

## Starting the Next.js application

```bash
npm install
npm run db:migrate   # or migrate deploy on fresh clone
npm run db:seed
npm run dev
```

Production-style run:

```bash
npm run build
npm start
```

Without migrate + seed, `create-order` and failure ingest will error when resolving demo merchant context.

## Starting the persistent worker

Recovery attempts run **outside the browser**. Choose one approach:

1. **Standalone worker (recommended when Next dev is stopped)**
   ```bash
   WORKER_SECRET=your_secret npm run worker
   ```
   Runs `runDueAttempts` on an interval in `scripts/worker.ts`.

2. **In-process worker (while Next.js stays running)**

   Set `RECOVERY_WORKER_ENABLED=true` and `WORKER_SECRET` in env. `instrumentation.ts` POSTs to `/api/internal/worker/tick` every 5 seconds.

Closing the **browser tab** does not stop scheduled work. **Stopping the Node process** stops in-process ticks unless the standalone worker is running separately.

## Worker scheduling and deployment limitations

- `instrumentation.ts` requires a **long-lived** Next.js process; it does not run reliably on short-lived serverless instances.
- Rate limiting is **in-memory per process** (not shared across replicas).
- Webhook and worker concurrency against SQLite may see lock contention under heavy parallel load.
- Verified revenue still changes only through `markCaptured` after Razorpay `fetchPayment` confirms `captured` status.
