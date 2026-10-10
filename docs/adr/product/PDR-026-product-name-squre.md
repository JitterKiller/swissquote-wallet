# PDR-026: Product name — SQure, "Your keys. Swiss security."

- **Status:** Accepted
- **Date:** 2026-10-11
- **Related:** [PDR-008](PDR-008-english-ui-copy.md), [PDR-013](PDR-013-key-management-user-majority.md), [ADR-027](../architecture/ADR-027-visual-world-swiss-onchain-fintech.md)

## Context

"Swissquote Wallet" described the product but said nothing about what makes it different, and read like any bank's wallet tab. The team wanted a name that carries the brand and the security promise in one word, for the pitch and the app.

## Decision

- **Name: SQure**, said "secure". "SQ" is Swissquote's monogram; the orange **square** of the logo carries it, and the word finishes it ("SQ" + "ure").
- **Line: "Your keys. Swiss security."** It replaces "Your keys. Your crypto. One tap from Swissquote."
- **Endorsement: "by Swissquote"** next to the wordmark: the bank stands behind it, without owning the keys (PDR-001, PDR-013).
- Where it shows: the wordmark (`Logo.tsx`), page titles, the passkey's relying-party name (new passkeys show "SQure" in the OS sheet), the onboarding headline, `PRODUCT.md`, `DESIGN.md`, README.
- **Unchanged on purpose:** protocol strings that signatures depend on (the EIP-712 domain "Swissquote Wallet Registry", the stolen-device report message) and "Sponsored by Swissquote" (Swissquote is the sponsor). The hackathon track keeps its name, "Swissquote Wallet Challenge".
- Still a Swissquote-inspired prototype: no official Swissquote assets.

## Consequences

- ✅ One word that says the promise (secure) and the brand (SQ).
- ⚠️ Passkeys created before the rename keep "Swissquote Wallet" as their display name in the OS (cosmetic).
- ⚠️ Trademark search needed before any real use.

## Alternatives considered

- **Keep "Swissquote Wallet":** clear but generic.
- **A name without "SQ":** loses the link to the bank, which is the product's edge.
