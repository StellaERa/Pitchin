# Pitchin Backend

The backend is the NestJS API and supporting services for Pitchin. It currently provides platform foundations such as authentication, users, workspaces, bookings, payments, invoices, notifications, webhooks, audit history, and reconciliation.

> **Product status:** Pitchin is evolving toward a neighbourhood repair board where residents report local problems, pool funds, and verify repairs. The current backend is an early platform foundation; issue reporting, AI triage, repair-pool workflows, contractor bidding, neighbour verification, and Stellar escrow integration are planned product work and should not be assumed to exist in the API yet.

## Responsibilities

- Provide versioned REST endpoints under `/api/v1`.
- Authenticate most requests with JWT bearer tokens and apply global rate limits.
- Manage the existing user, workspace, booking, payment, invoice, notification, and operational workflows.
- Expose API documentation through Swagger at `/swagger` when the service is running.
- Provide supporting infrastructure for email, uploads, scheduled jobs, caching, queues, webhooks, and audit/reconciliation workflows.

For the repair-board product, the backend is the natural home for application workflows that do not belong on-chain: issue descriptions and media references, triage requests, search and projections, contractor-facing API views, and notifications. Contract calls and indexing will be added as those flows are implemented. AI output is intended to remain advisory; contract rules and human verification govern releases.

## Architecture

```text
Next.js client
     |
     | REST /api/v1 (JWT bearer authentication)
     v
NestJS API ---- PostgreSQL
     |          Redis / Bull queues
     |          Object storage and email integrations
     |
     +---- Stellar/Soroban integration (repair-board workflows: planned)
```

The application is organized into NestJS modules under `src/`. Global infrastructure includes request validation, structured exception responses, correlation IDs, API version headers, CORS allowlisting, rate limiting, scheduled tasks, and Swagger documentation.

## Run Locally

Requirements: Node.js 20 or later, PostgreSQL, and Redis.

```bash
cd backend
npm install
```

Configure the environment for the local database and Redis (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and `REDIS_HOST` / `REDIS_PORT`). Add any credentials required by the integrations you intend to exercise.

```bash
npm run start:dev
```

The API listens on port `3000` by default. Set `PORT=3001` if running it alongside the frontend's default development server. Swagger is available at `/swagger`.

## API Conventions

- Routes use URI versioning, currently `/api/v1/...`.
- Most endpoints require `Authorization: Bearer <token>`; the login flow is under `/api/v1/auth`.
- List endpoints use pagination. Responses include a `meta` object with page and total counts.
- Responses include API-version headers. Error responses include a correlation ID for log tracing.
- CORS is restricted to configured origins; use `CORS_ALLOWED_ORIGINS` for local or deployed clients.

Consult the running Swagger document for the current endpoint list and request schemas. Do not infer that the target repair-board endpoints described in the root README are already available.

## Tests and Build

Run these from `backend/`:

```bash
npm test
npm run test:e2e
npm run build
```

The Jest unit tests live alongside source modules; API end-to-end tests are in `test/`.

## Related Components

- [Root README](../README.md): product scope, target architecture, invariants, and roadmap.
- [Contracts README](../contracts/README.md): current Soroban workspace and planned repair-board contract boundaries.
- [Frontend README](../frontend/README.md): current Next.js client and planned resident/contractor flows.