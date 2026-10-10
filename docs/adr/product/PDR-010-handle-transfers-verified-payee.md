# PDR-010: `@handle` transfers between Swissquote clients, with verified payee

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-009](PDR-009-feature-priorities.md), [ADR-008](../architecture/ADR-008-mock-backend.md)

## Context

- Sending to a `0x…` address is error-prone. Copy-paste mistakes and address poisoning (a look-alike address planted in the transaction history) are a major source of retail crypto losses.
- Handles alone are not distinctive: ENS / Basenames, Revolut's Revtags and TWINT's phone numbers already exist.
- Swissquote's unique asset is that **every client is identity-verified (KYC)**. That turns a handle from a convenience into an anti-fraud and compliance feature.
- Open concern from the index: a handle reveals the wallet address, and with it the address's whole on-chain history.

## Decision

- **Handle:** a unique `@name` chosen by the client, **opt-in**. It is stored in Swissquote's wallet registry (client → handle → wallet address → proof of ownership), **never on-chain**.
- **Registration requires proof of ownership:** the wallet signs a registration message (EIP-1271 signature from the Safe), so a handle can only point to a wallet its owner controls.
- **Verified payee before signing:** the send screen accepts `@handle` or `0x…`. For a handle, it shows the recipient's **masked verified name** before the passkey prompt, for example "✓ Adam M. — verified Swissquote client". This mirrors the EU *Verification of Payee* for euro transfers. An unknown `0x…` address shows an explicit "unverified recipient" warning.
- **Privacy by design:**
  - Only authenticated Swissquote clients can resolve a handle, one exact handle per request: no search, no listing, rate-limited.
  - Each client chooses who can resolve their handle: Swissquote clients (default) / contacts only / nobody.
  - Payment requests by link or QR code are offered as an alternative to typing a handle.
  - Accepted limitation: anyone who receives or sends a payment learns the counterparty's address and can read its on-chain history.
- **Compliance:** when both ends are verified Swissquote clients, the travel-rule data (originator and beneficiary) is known on both sides by construction. Once the compliance layer exists, resolution also runs sanctions screening.
- **Not decided:** sending to a client who has no wallet by crediting their Swissquote account. It needs legal validation: FINMA Guidance 02/2019 restricts transfers with external wallets to wallets that belong to the client, and here the sending wallet belongs to someone else. Listed in the open questions.
- **Prototype:** the registry and the resolution endpoint live in the mock backend (`web/src/server/`, data in `web/.data/db.json`). Verified names are mocked and carry a **MOCK** badge.

## Consequences

- ✅ Fraud protection at the moment it matters, before the user signs.
- ✅ A payment network between Swissquote clients: network effect, and every invitation is a potential new client.
- ✅ Strong legal argument: transfers between verified wallets are travel-rule complete.
- ⚠️ The registry links identities to addresses: personal data under the Swiss FADP. Explicit consent, minimal data, and no public listing. A registry breach would de-anonymize wallets.
- ⚠️ Handle squatting and look-alike handles: the verified name shown before signing is the mitigation. Reserve sensitive names (`@swissquote`, `@support`, …).
- ⚠️ The mock endpoints have no authentication (ADR-008), so the "authenticated clients only" rule is not enforced in the prototype.

## Alternatives considered

- **ENS / Basenames:** public on-chain mapping that anyone can enumerate, with no link to a verified identity.
- **Phone number or email as identifier (TWINT-style):** leaks contact data, and ties payments to SIM cards and email accounts, which are attack vectors in our threat model (PDR-006).
- **`0x…` addresses plus a local address book:** no network effect, and no protection against poisoned addresses.
