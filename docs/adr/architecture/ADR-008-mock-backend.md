# ADR-008: Mock backend — Next.js route handlers + JSON file store

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-007](../product/PDR-007-prototype-scope-real-vs-mocked.md), [ADR-007](ADR-007-swissquote-guardian-and-relayer.md), [ADR-010](ADR-010-frontend-nextjs-client-only.md)

## Context

The Swissquote side (KYC, the guardian, the relayer, notifications) has to be mocked (PDR-007). It should be as simple to run as possible.

## Decision

- **Route handlers in the same Next.js app:**

  | Endpoint | Role |
  |---|---|
  | `GET /api/guardian` | Returns the guardian and relayer addresses |
  | `POST /api/kyc` | Creates an identity-verification session (mock outcome), single-use, valid for 15 minutes, tied to one wallet |
  | `POST /api/recovery` | Checks KYC and the Kit signature, co-signs, relays the request |
  | `POST /api/recovery/finalize` | Relays `finalizeRecovery` after the delay |

- **Server-only code** lives in `web/src/server/` and is imported only by route handlers.
- **Data** is a JSON file at `web/.data/db.json` (gitignored). Notifications are mocked by `notifyClient` (console output plus the store).
- Dynamic `GET` handlers call `await connection()`, because Cache Components is enabled.

## Consequences

- ✅ A single `npm run dev` runs everything.
- ⚠️ Not ready for serverless hosting: Vercel's file system is read-only. Deploying would need the guardian key in an environment variable and a KV store.
- ⚠️ The endpoints have no authentication. Acceptable for a mock, never for production.

## Alternatives considered

- **A separate Express or Nest service**: two processes to run.
- **Supabase or Firebase**: more setup, nothing gained for a mock.
