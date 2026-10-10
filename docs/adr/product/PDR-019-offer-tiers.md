# PDR-019: Offer in three tiers — free for everyone, linked client, Premium "Theft protection"

- **Status:** Accepted (prices and the swap-fee waiver still to model)
- **Date:** 2026-10-10
- **Refines:** [PDR-003](PDR-003-gasless-by-default.md) (security operations always sponsored), [PDR-015](PDR-015-open-wallet-and-levels.md) (levels 0 and 1), [PDR-017](PDR-017-theft-protection-hardware-key.md) (the "Theft protection" offer)
- **Related:** [PDR-003](PDR-003-gasless-by-default.md), [PDR-010](PDR-010-handle-transfers-verified-payee.md), [PDR-014](PDR-014-separation-of-powers.md), [PDR-018](PDR-018-time-locked-eviction.md), [PDR-020](PDR-020-daily-limit-chosen-by-user.md), [PDR-021](PDR-021-one-flow-lost-or-stolen-phone.md)

## Context

Whatever the design, one residual case stays undecidable: the owner and the attacker hold the same factors. PDR-018 makes time decide it, in the owner's favour, for everyone. The business question is what Swissquote sells on top without selling basic security, which PDR-017 already rules out.

## Decision

**Three tiers. Basic security is free in all of them; the paid tier sells speed, comfort, insurance and assistance.**

| | **Free** (level 0, everyone) | **Client** (level 1, free for Swissquote clients) | **Premium "Theft protection"** (level 1 + subscription, linked clients only) |
|---|---|---|---|
| Stolen phone | Locked out after **7 days** (PDR-018), immediately with a self-bought FIDO2 key | After **3 days**, with Swissquote identity check | **Immediately** (hardware key, PDR-017) |
| Loss bound | ≈ 7 days of limit | ≈ 3 days of limit | ≈ 1 day of limit, **insured** (licensed partner) |
| Large payments | Face ID + Kit passphrase | Same | Face ID + **a tap** on the key |
| Lost Kit | Slow exit through the daily limit | Same | Replaced at once (phone + key) |
| Gas | 10 sponsored operations a month, then gas in USDC (PDR-015). Security operations always sponsored | Sponsored | Sponsored |
| Banking extras | — | `@handle`, verified payee, transfers with the Swissquote account | Same as client |
| Assistance | In-app guide | + Alerts on every channel | + Guided "phone stolen" flow, priority hotline |
| Swaps | Standard Swissquote fee | Standard fee | **No Swissquote fee** (if swaps ship; to model) |

- **The daily limit is chosen by the user in every tier** (PDR-020). No tier sells a higher limit.
- **Premium is for linked clients only** (level 1 + subscription). Billing and shipping a device need a client relationship. It also makes the funnel Free → Client → Premium.
- **Premium includes the hardware key**, shipped, preconfigured and checked for authenticity (WebAuthn attestation).
- **The hardware key feature is open to every level, self-service.** Anyone can buy a FIDO2 key and add it as the Account's third owner (Face ID + Kit, ADR-017). It gives the same on-chain power: immediate eviction, a tap for large payments, replacing a lost Kit. Attestation is optional for a self-bought key. Premium adds shipping, setup, insurance and assistance, not security (PDR-017: no lock-in).
- **Security operations are always sponsored, at every level, outside the gas quota:**
  - eviction: start, cancel, finalize, handover (ADR-019);
  - adding or replacing a factor: hardware key, Kit.

  Otherwise a level 0 user who used up the quota could not defend themselves.
- **Indicative price:** CHF 5–9 a month, to model. References: Ledger Recover $9.99 a month, Zengo Pro about $20 a month, a FIDO2 key CHF 25–80 one-off.
- **Conversion triggers:**
  - Free → Client: recovery setup, wanting an `@handle`, selling to CHF, reaching the gas quota (PDR-015).
  - Client → Premium: balance above a threshold, the first large payment, after the "phone stolen" explainer.
- **Pitch line:** "Everyone is protected. Premium is protected *faster*, insured, and with someone to call."

## Consequences

- ✅ A recurring revenue line, a reason to link an account, and a bank-like gesture: shipping a security token.
- ✅ Defensible publicly and for the jury: no tier is left with an unbounded loss.
- ⚠️ Insurance needs a licensed partner (PDR-017).
- ⚠️ Waiving the swap fee trades per-transaction revenue for subscription revenue: to quantify in the business case. Swaps are not built.
- ⚠️ Prices are placeholders until the business model is done.

## Alternatives considered

- **Hardware key as the only answer to theft, sold as an upsell:** sells the fix for a hole we left. Rejected (see PDR-018).
- **Free hardware key for every client:** strongest security, but costly upfront and many keys would sit unused. It could become a promotion for high-balance clients.
- **No paid tier:** leaves the subscription revenue unused.
