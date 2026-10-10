# PDR-022: Wallet registry and proof of ownership — one Face ID replaces the manual whitelisting

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-010](PDR-010-handle-transfers-verified-payee.md), [PDR-015](PDR-015-open-wallet-and-levels.md), [PDR-019](PDR-019-offer-tiers.md), [ADR-017](../architecture/ADR-017-two-safe-account.md), [ADR-021](../architecture/ADR-021-wallet-registry.md), issue #18

## Context

- FINMA Guidance 02/2019: Swissquote may only send crypto to, or receive it from, an external wallet that **belongs to its own client**, proven by "suitable technical means". Today this is partly manual (whitelisting, screenshots for exchange deposits).
- `@handle` payments (PDR-010), transfers between the Swissquote account and the wallet (#19) and the level 1 upgrade (PDR-015) all need Swissquote to know which Account belongs to which client.
- Level 0 users have no relationship with Swissquote (PDR-015).

## Decision

- **Only linked clients (level 1) are registered.** A level 0 wallet is never stored at Swissquote.
- **Registry entry:** client id, verified name (from KYC, shown masked as "Adam M."), Account address (the public address, ADR-017), Key Safe, level, proof, dates. Handles are stored separately (#20).
- **Proof of ownership: the client signs a statement with Face ID.** The statement reads: "Swissquote client *id* controls Account *address* on Base, challenge *nonce*, issued at *time*". Swissquote checks three things:
  1. the passkey signature (WebAuthn, created on Swissquote's own domain);
  2. on-chain, that this passkey owns the Key Safe (or, before deployment, that the Key Safe address is the one predicted from the passkey);
  3. on-chain, that the Key Safe is an owner of the Account.

  The challenge is single-use and valid for 10 minutes. The signed statement is kept as **travel-rule evidence**.
- **Effects:**
  - transfers between the Swissquote account and this Account need no manual whitelisting (#19);
  - `@handle` resolution only returns registered Accounts (#20).
- **Lifecycle:**
  - after an eviction (new Key Safe, PDR-021), the new phone signs a fresh proof;
  - the client can unlink at any time, which deletes the entry.
- **Consent (FADP):** linking explains that Swissquote will see this Account's on-chain activity. Only minimal data is stored.

## Consequences

- ✅ FINMA's ownership check becomes one Face ID, with cryptographic evidence instead of screenshots.
- ✅ No Kit needed. The proof is fast enough for onboarding.
- ⚠️ The proof shows control of one owner factor (the Key Safe), not of 2 factors. That is enough because every Account owner is the client's own factor, and the statement is about ownership, not about authorizing a payment.
- ⚠️ In the prototype, authentication is mocked: the client id comes from the mock Swissquote session (#21), or from the request until #21 lands.

## Alternatives considered

- **EIP-1271 signature of the Account itself:** needs a fallback handler and 2 factors (the Kit) for every proof. Too heavy.
- **Test transfer (Satoshi test):** slow, costs fees, and proves control only indirectly.
- **Screenshots (today):** not a sound proof.
- **AOPP:** designed for a single-key address, not for a smart account.
