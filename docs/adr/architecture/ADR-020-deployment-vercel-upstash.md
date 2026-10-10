# ADR-020: Deployment — Vercel + Upstash Redis, one fixed demo domain

- **Status:** Accepted
- **Date:** 2026-10-10
- **Amends:** [ADR-008](ADR-008-mock-backend.md) (the JSON file store becomes one of two backends behind an async store interface)
- **Related:** [ADR-002](ADR-002-passkey-signing-safe-webauthn.md), [ADR-007](ADR-007-swissquote-guardian-and-relayer.md), [PDR-017](../product/PDR-017-theft-protection-hardware-key.md), issue #29

## Context

- **Passkeys are bound to the domain they were created on.** The rpId is `window.location.hostname` (ADR-002). A wallet created on `localhost` does not work on the deployed site, and changing the demo domain later invalidates every passkey.
- The phone demo and the "teammate's phone as security key" demo (PDR-017) need **HTTPS on a stable domain**.
- The mock backend stores its data in `web/.data/db.json` (ADR-008). Vercel's filesystem is read-only, and several requests can run at the same time.
- Five people work in parallel, and several issues add backend tables: evictions (#14), wallets (#18), handles (#20), sponsorship quotas (#23).

## Decision

- **Hosting:** Vercel, Root Directory `web`, framework Next.js. The **production domain is the demo domain**, for example `swissquote-wallet.vercel.app`. It is fixed now. A custom domain is only possible if it is chosen before the demo wallets are created.
- **rpId:** unchanged, `window.location.hostname`.
  - Production wallets live on the production domain.
  - Preview deployments get their own hostnames, and `vercel.app` is a public suffix, so a passkey created on a preview only works on that preview.
  - Localhost wallets stay local.
- **Store:** `web/src/server/store.ts` exposes `store()`, an async, per-record interface:
  - `get`, `set`, `setIfAbsent` (atomic, for uniqueness such as handles), `delete`, `all`;
  - `increment(counter, ttl)` for quotas and rate limits;
  - `append` / `recent` for logs such as notifications.
- **Backends:**
  - **Upstash Redis** when `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Vercel integration) or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set. Layout: hash `sq:<collection>`, counters `sq:counter:<name>`, lists `sq:log:<name>`. Values are JSON strings.
  - **Local JSON file** (`web/.data/db.json`) otherwise. It migrates the pre-ADR-020 format on read, so local guardian keys are kept.
  - **On Vercel without Redis**, requests fail with an explicit error. The build does not fail.
- **Rule for every backend table:** go through `store()`, never the filesystem. One record per key, so concurrent requests never overwrite each other.
- **Guardian key:** `SWISSQUOTE_GUARDIAN_PRIVATE_KEY` must be set on Vercel (Production and Preview) to the team's shared key. Without it, a key is created once in the store with `setIfAbsent`.
- **Health check:** `GET /api/health` returns the store kind, a write/read round trip, whether the guardian key comes from the environment, and the guardian and relayer addresses.

**Setup (once):**

1. Vercel → Add New → Project → import `JitterKiller/swissquote-wallet` → Root Directory `web` → Deploy.
2. Project → Storage → Marketplace → **Upstash Redis** (free plan) → connect to the project, all environments.
3. Project → Settings → Environment Variables → `SWISSQUOTE_GUARDIAN_PRIVATE_KEY` (Production and Preview) = the team's shared key.
4. Redeploy, then open `https://<domain>/api/health`. Expect `"ok": true, "store": "upstash-redis", "guardianFromEnv": true`.
5. Share the production URL with the team. Demo wallets are created **on that URL**.

## Consequences

- ✅ A stable HTTPS domain for phones and for the hybrid security-key demo, with no laptop running.
- ✅ Preview deployments per branch for the team.
- ✅ Concurrency-safe writes, and one store API for every new table.
- ⚠️ Localhost and preview wallets do not work on production. Recreate test wallets on the production domain.
- ⚠️ The mock endpoints are now public and unauthenticated (ADR-008). That is acceptable on a testnet, since every sensitive action still needs a user signature (Kit, passkey). Never put a mainnet key in these variables.
- ⚠️ The relayer waits for inclusion inside the request. If a route hits Vercel's function time limit, set `export const maxDuration = 60` on it.
- ⚠️ The Upstash free plan has request limits, which is enough for a demo.

## Alternatives considered

- **Small VPS + domain + Caddy:** no code change and the JSON file keeps working, but it needs some server administration, and the store would still not be safe for concurrent writes.
- **Laptop + tunnel (ngrok / Cloudflare):** depends on one laptop staying on. ngrok's free plan shows a warning page in the browser.
- **Vercel Blob or Edge Config:** not made for frequent small writes.
