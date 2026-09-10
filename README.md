# Generator Fuel Tracker

Tracks generator refuels, run time, and reported issues for a tailgating rental
business — admin portal, live iPad/dashboard, and an offline-capable QR scan
flow for field workers and customers.

## Stack

Next.js (App Router, TypeScript) · Prisma + PostgreSQL · Auth.js (credentials) ·
Tailwind CSS · MapLibre GL (OpenStreetMap tiles) · IndexedDB (`idb`) for offline
scan queuing · Vitest for unit tests.

## Local setup

1. Start a Postgres instance and set `DATABASE_URL` in `.env` (a local dev
   cluster is already configured to run on `localhost:5433` — start it with:
   `pg_ctl -D ~/pgdata-gft -o "-p 5433" -l ~/pgdata-gft/logfile start`, using the
   `postgresql@16` Homebrew formula).
2. Install dependencies: `npm install`
3. Apply migrations: `npx prisma migrate dev`
4. Seed sample data (admin user, a generator, worker/customer PINs):
   `npm run db:seed`
5. Run the dev server: `npm run dev`

Seeded login: `admin@example.com` / `changeme123`. Seeded worker PIN `11111`,
customer PIN `22222`, scan URL printed by the seed script.

## Key routes

- `/` — landing page
- `/admin` — admin portal (generator types, maintenance tags, inventory,
  customers, workers, issues, reports) — requires login
- `/dashboard`, `/dashboard/map` — live kiosk dashboard (no login; intended for
  an always-on iPad on-site)
- `/scan/[qrToken]` — the offline-capable PIN-protected scan flow

## Core design notes

- Generator status (`IDLE` / `RUNNING` / `NEEDS_FUEL_SOON` / `OVERDUE`) is
  **derived at read-time** from raw scan events (`src/lib/status.ts`), never
  stored as a mutable field — this is what keeps status correct even when
  offline scans sync late or out of order.
- PINs use a keyless SHA-256 hash (`src/lib/pin.ts` / `src/lib/pin-client.ts`)
  so the scan page can verify a PIN fully offline against a cached table
  without shipping a server secret to the client. See the comment in
  `src/lib/pin.ts` for the threat-model reasoning.
- The scan flow queues events in IndexedDB and syncs them with an idempotent
  `clientEventId` (`src/lib/offline-db.ts`, `src/lib/sync-queue.ts`,
  `src/lib/scan.ts`).

## Tests

```bash
npm test
```

Covers the status-derivation logic: same-day resets, day-boundary resets, the
30-minute threshold, overdue transition, the 2-hour auto-idle revert, and
out-of-order/duplicate event handling.

