# ADR-022: Compliance checks — server screening with a mock list (+ optional Chainalysis), client preview and warnings

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-023](../product/PDR-023-compliance-as-friction.md), [ADR-011](ADR-011-no-custom-cryptography.md), [ADR-020](ADR-020-deployment-vercel-upstash.md), [ADR-021](ADR-021-wallet-registry.md)

## Context

PDR-023 needs screening that the client, the sponsorship policy (#23), handle resolution (#20) and Swissquote transfers (#19) can all call, plus client-side checks before Face ID.

## Decision

- **Server** (`web/src/server/compliance.ts`): `screenAddress(address)` → `{ status: 'clear' | 'sanctioned', source: 'mock-list' | 'chainalysis', list?: string }`.
  - **Mock list:** a constant of test addresses (**MOCK**, documented in the README for the demo), plus `SANCTIONS_EXTRA_ADDRESSES` (comma-separated env var) to add demo addresses without a deploy.
  - **Chainalysis** when `CHAINALYSIS_API_KEY` is set: `GET https://public.chainalysis.com/api/v1/address/{address}` with the `X-API-Key` header. A non-empty `identifications` means sanctioned. Results are cached 24 h in the store (`sanctionsCache`).
  - Every screening is appended to the `compliance` log.
  - `isSanctioned(address)` for the sponsorship policy (#23), handles (#20) and Swissquote transfers (#19).
- **Endpoint:** `POST /api/compliance/screen { address }` → result.
- **Client** (`web/src/lib/compliance.ts`):
  - `screenRecipient(address)`;
  - `simulateCalls(from, calls)` (`eth_call` per call through viem; a revert gives a readable reason);
  - `isLookAlike(address, knownAddresses)` (same first 4 and last 4 hex characters, different address);
  - `needsHighValueConfirmation(amount, balance)` (≥ 50% of the balance or ≥ 5,000 USDC).
- **UI** (`web/src/components/send/ComplianceChecks.tsx`), contract for the send flow (#12):
  - props: `{ from, to, amount, balance, knownRecipients, onChange }`;
  - `onChange({ blocked, needsConfirmation, reasons })`.

  It renders the screening status, the simulation result, the look-alike warning and the high-value confirmation (type the amount).

## Consequences

- ✅ One screening function for every caller, cached and logged.
- ✅ Works offline from Chainalysis: the mock list is enough for the demo.
- ⚠️ The Chainalysis endpoint and response format must be checked against their current docs before relying on them.
- ⚠️ A simulation run with `eth_call` from the Account does not reproduce the 4337 validation step. It checks the effect of the call, not the signature.

## Alternatives considered

- **Screening only in the client:** the sponsorship policy needs it on the server anyway.
- **Paid providers (TRM, Elliptic):** out of scope for a hackathon. Same interface later.
