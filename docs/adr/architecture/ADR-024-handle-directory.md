# ADR-024: `@handle` directory — store-backed, exact-match resolution for linked clients, `RecipientField`

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-010](../product/PDR-010-handle-transfers-verified-payee.md), [PDR-022](../product/PDR-022-wallet-registry-ownership-proof.md), [PDR-023](../product/PDR-023-compliance-as-friction.md), [ADR-020](ADR-020-deployment-vercel-upstash.md), [ADR-021](ADR-021-wallet-registry.md), issue #20

## Context

PDR-010 wants `@handle` payments that show the payee's verified name before signing, with privacy by design. The registry (ADR-021) already links clients to their Accounts.

## Decision

- **Server** (`web/src/server/handles.ts`, store collections `handles` and `handleByClient`):
  - **Claim** (`POST /api/handles`): only linked clients. The format is `^[a-z][a-z0-9_]{2,19}$`, and reserved names (swissquote, support, admin, …) are refused. Uniqueness uses `store().setIfAbsent`. Changing a handle claims the new one first, then frees the old one and keeps the contacts.
  - **Visibility** (`PATCH /api/handles`): `clients` (default), `contacts` or `nobody`. Contacts are added by handle (`POST /api/handles/contacts`).
  - **Resolve** (`GET /api/handles/[handle]?clientId=`): only for linked clients, exact match, 30 lookups a minute per client. A hidden, missing or not-allowed handle answers the same 404. A sanctioned Account is not returned (PDR-023). The response is `{ handle, account, maskedName, verified }`.
  - **Release** (`DELETE /api/handles?clientId=`), and the caller's own handle (`GET /api/handles/me`).
- **Client:**
  - `web/src/lib/handles.ts` (API calls, `paymentRequestUrl(handle, amount)` → `/send?to=@handle&amount=`);
  - **`web/src/components/send/RecipientField.tsx`**: accepts `0x…` or `@handle`, resolves the handle for the signed-in client, shows "✓ Adam M. · verified Swissquote client", and warns on an unverified 0x address. Props: `{ value, onChange, onRecipient(recipient | null) }`. The send flow (#12) integrates it and reads `?to=&amount=`.
  - Page `/handle` (`HandleView`): mock Swissquote sign-in, link the wallet (registry, Face ID), claim a handle, set its visibility and contacts, payment request link + QR, and a "Check a recipient" demo.
- **MOCK session** (`web/src/lib/session.ts`): `getSession()`, `setSession()`, `clearSession()`, `mockSignIn(name)`. It stands in for the e-banking login until #21 builds the real mock "Sign in with Swissquote". The API calls pass the client id (MOCK auth, as in ADR-021).
- **No reverse lookup** (address → name): it would let anyone enumerate which addresses belong to clients.

## Consequences

- ✅ Verified payee before Face ID, without any public on-chain mapping.
- ✅ No enumeration: no search or listing, rate limits, and identical answers for hidden and missing handles.
- ⚠️ MOCK authentication: the client id is trusted from the caller. In production it comes from the e-banking session.
- ⚠️ A pasted 0x address of a client is shown as "unverified" (no reverse lookup). Payment requests and handles are the verified path.
- ⚠️ The send flow must integrate `RecipientField` and the `?to=&amount=` parameters (#12).

## Alternatives considered

- **ENS / Basenames:** public, enumerable, and not tied to a verified identity (PDR-010).
- **Reverse lookup for pasted addresses:** a privacy leak.
