# PDR-019: Offer in three tiers — free for everyone, linked client, Premium "Theft protection"

- **Status:** Proposed (to agree in the team; prices and the swap-fee waiver still to model)
- **Date:** 2026-10-10
- **Refines:** [PDR-015](PDR-015-open-wallet-and-levels.md) (levels 0 and 1), [PDR-017](PDR-017-theft-protection-hardware-key.md) (the "Theft protection" offer)
- **Related:** [PDR-003](PDR-003-gasless-by-default.md), [PDR-010](PDR-010-handle-transfers-verified-payee.md), [PDR-014](PDR-014-separation-of-powers.md), [PDR-018](PDR-018-time-locked-eviction.md)

## Context

Whatever the design, one residual case stays undecidable: the owner and the attacker hold the same factors. PDR-018 makes time decide it, in the owner's favour, for everyone. The business question is what Swissquote sells on top without selling basic security, which PDR-017 already rules out.

## Decision

**Three tiers. Basic security is free in all of them; the paid tier sells speed, comfort, insurance and assistance.**

| | **Free** (level 0, everyone) | **Client** (level 1, free for Swissquote clients) | **Premium "Theft protection"** (subscription, on top of either) |
|---|---|---|---|
| Stolen phone | Locked out after **7 days** (PDR-018) | After **3 days**, with Swissquote identity check | **Immediately** (hardware key, PDR-017) |
| Loss bound | ≈ 7 days of limit | ≈ 3 days of limit | ≈ 1 day of limit, **insured** (licensed partner) |
| Large payments | Face ID + Kit passphrase | Same | Face ID + **a tap** on the key |
| Lost Kit | Slow exit through the daily limit | Same | Replaced at once (phone + key) |
| Gas | 10 sponsored operations a month, then gas in USDC (PDR-015) | Sponsored | Sponsored |
| Banking extras | — | `@handle`, verified payee, transfers with the Swissquote account | Same as client, plus a higher daily limit |
| Assistance | In-app guide | + Alerts on every channel | + Guided "phone stolen" flow, priority hotline |
| Swaps | Standard Swissquote fee | Standard fee | **No Swissquote fee** (if swaps ship; to model) |

- **Premium includes the hardware key**, shipped and preconfigured. Any FIDO2 key is still accepted at every tier, so there is no lock-in (PDR-017).
- **Indicative price:** CHF 5–9 a month, to model. References: Ledger Recover $9.99 a month, Zengo Pro about $20 a month, a FIDO2 key CHF 25–80 one-off.
- **Conversion triggers:**
  - Free → Client: recovery setup, wanting an `@handle`, selling to CHF, reaching the gas quota (PDR-015).
  - → Premium: balance above a threshold, the first large payment, after the "phone stolen" explainer.
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
