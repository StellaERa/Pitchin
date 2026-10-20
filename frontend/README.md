# Pitchin Frontend

The frontend is Pitchin's Next.js web application. It is the user-facing layer for the platform and is being shaped toward the resident and contractor experience for the neighbourhood repair board.

> **Product status:** The current app includes platform screens for authentication, workspaces, bookings, check-in, dashboards, invoices, notifications, profiles, settings, and administration. The repair-board map, issue reporting, AI triage, pledge and pool views, contractor bidding, wallet flows, and neighbour verification are product targets; do not assume they are already implemented in the app.

## Current Application

| Area | Route |
|---|---|
| Home | `/` |
| Authentication | `/(auth)` route group |
| Workspaces and bookings | `/workspaces`, `/bookings` |
| Check-in | `/check-in` |
| Dashboard and administration | `/dashboard`, `/admin` |
| Account and preferences | `/profile`, `/settings`, `/notifications` |
| Invoices and contact | `/invoices`, `/contact` |

The application uses Next.js App Router, React, TypeScript, Tailwind CSS, and shared components in `components/`. API requests are handled through the shared client in `lib/apiClient.ts` and use the `NEXT_PUBLIC_API_URL` setting.

## Repair-Board Direction

The intended mobile-first experience will let residents discover nearby issues, submit geotagged photos, review triage suggestions, follow pool funding, and pledge through supported Stellar wallets. Contractors will need bid and job workflows, while eligible neighbours will review submitted completion evidence.

The UI should make clear that AI suggestions do not release funds. Funding and payout status should come from authoritative API/contract state, and payment success should only be shown after confirmation. These are product requirements for the planned flows, not a claim that the flows currently exist.

## Run Locally

Requirements: Node.js 20 or later and a running backend for API-backed screens.

```bash
cd frontend
npm install
```

Set the backend API base URL in `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Run the backend on port `3001` (or set this URL to the port in use), then start the frontend:

```bash
npm run dev
```

Next.js serves the app at `http://localhost:3000` by default. In development, the API client has a local fallback; configuring the URL explicitly avoids connecting to the wrong service. Production builds require `NEXT_PUBLIC_API_URL` to point to the deployed API.

## Test and Build

Run these from `frontend/`:

```bash
npm test
npm run test:e2e
npm run lint
npm run build
```

Unit tests use Vitest; end-to-end tests use Playwright.

## Related Components

- [Root README](../README.md): product overview, target user flows, and roadmap.
- [Backend README](../backend/README.md): API capabilities and local setup.
- [Contracts README](../contracts/README.md): current Soroban contracts and planned escrow/verification contracts.