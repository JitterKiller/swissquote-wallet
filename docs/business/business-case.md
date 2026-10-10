# Business case — Swissquote self-custody wallet

Issue #31. Decisions behind the offer: [PDR-015](../adr/product/PDR-015-open-wallet-and-levels.md) (levels and funnel), [PDR-019](../adr/product/PDR-019-offer-tiers.md) (offers), [PDR-020](../adr/product/PDR-020-daily-limit-chosen-by-user.md), [PDR-024](../adr/product/PDR-024-swissquote-account-transfers.md).

> **Status:** model v1 with explicit assumptions. Every line marked **(ask)** needs an order of magnitude from the Swissquote mentors before the pitch.

## 1. Why Swissquote should ship it

- **Self-custody today means leaving Swissquote.** A client who wants their own keys must:
  - whitelist an external address and pay USD 10–15 per withdrawal;
  - prove ownership manually (screenshots for exchange deposits);
  - keep the assets outside, where Swissquote earns nothing.
- **Crypto revenue needs to become stickier.** H1 2026 crypto income fell about 66% to CHF 14.6 m. Monthly crypto turnover averaged CHF 429 m. 2026 guidance was cut to CHF 730 m net revenue.
- **Competitors are moving.** eToro acquired Zengo, a self-custody MPC wallet (announced April 2026, closed 30 April 2026). Kraken ships seed-phrase and embedded wallets. Robinhood runs Robinhood Wallet as a separate non-custodial entity.
- **Swissquote's edge:** 1,220,818 client accounts (30 June 2026, including 423,409 Yuh), a KYC record for each, a Swiss banking brand and an existing crypto desk. Nobody else can say "verified Swissquote client" next to an `@handle`.

## 2. Revenue and cost levers

| Lever | Mechanism | In the model |
|---|---|---|
| **Premium "Theft protection"** | CHF 5–9 / month: shipped security key, instant eviction, insured capped loss, hotline (PDR-019) | Yes |
| **Retained trading** | Moving between wallet and account takes one tap (PDR-024), so self-custodied assets come back to trade on Swissquote instead of an exchange | Yes (fee 0.85% average of 1% / 0.75%) |
| **Acquisition funnel** | Free wallet for everyone (level 0), converted to a Swissquote client at recovery setup, `@handle`, "sell to CHF", gas quota (PDR-015) | Yes (new-client value) |
| Swaps, tokenized assets (Taurus), CHF stablecoin | Distribution to verified wallets | Not modelled (upside) |
| **Gas sponsorship** | ~CHF 0.03 per sponsored operation on Base **(estimate, to measure on mainnet)** | Cost |
| **Security keys, insurance** | CHF 30 per key (written off over 3 years), CHF 12 / premium user / year insurance **(placeholder, partner to find)** | Cost |
| **Platform and operations** | A small team plus infrastructure: CHF 1.0 m / year **(assumption)** | Cost |
| Avoided costs | No manual whitelisting or screenshot review, and fewer custody liabilities for assets that leave the balance sheet | Not quantified **(ask: cost of today's external-wallet checks)** |

## 3. Assumptions (year 1)

Base: 797,409 Swissquote accounts (excluding Yuh).

| Assumption | Cautious | Median | Ambitious | Source |
|---|---|---|---|---|
| Accounts with crypto activity | 10% | 15% | 20% | **(ask)** |
| Linked wallets among them (level 1) | 5% | 10% | 20% | Assumption |
| Premium conversion of linked wallets | 3% | 6% | 10% | Assumption |
| Premium price | CHF 6 / month | CHF 6 / month | CHF 6 / month | PDR-019 range CHF 5–9 |
| Average wallet balance | CHF 1,500 | CHF 2,500 | CHF 4,000 | **(ask)** |
| Yearly turnover traded back on Swissquote | 0.5× | 1.0× | 1.5× | Assumption |
| Level 0 wallets (non-clients) | 10,000 | 30,000 | 80,000 | Assumption |
| Level 0 → Swissquote client | 3% | 5% | 8% | Assumption |
| Revenue per new client per year | CHF 300 | CHF 300 | CHF 300 | About half of CHF 730 m / 1.22 m accounts |
| Sponsored operations per wallet per month | 6 | 8 | 10 | Assumption |

## 4. Results (year 1, CHF)

| | Cautious | Median | Ambitious |
|---|---|---|---|
| Linked wallets | 3,987 | 11,961 | 31,896 |
| Premium subscribers | 120 | 718 | 3,190 |
| New Swissquote clients | 300 | 1,500 | 6,400 |
| Assets in linked wallets | 6.0 m | 29.9 m | 127.6 m |
| Premium revenue | 8,612 | 51,672 | 229,654 |
| Retained trading revenue | 25,417 | 254,174 | 1,626,714 |
| New-client revenue | 90,000 | 450,000 | 1,920,000 |
| **Revenue** | **124,029** | **755,846** | **3,776,368** |
| Gas sponsorship | 30,212 | 120,848 | 402,827 |
| Keys + insurance | 2,631 | 15,789 | 70,172 |
| Platform and operations | 1,000,000 | 1,000,000 | 1,000,000 |
| **Net, year 1** | **−908,814** | **−380,791** | **+2,303,369** |

- **Break-even** at median assumptions: **25% of crypto-active accounts linked** (about 29,900 wallets).
- **Three years, median ramp** (adoption 10% → 15% → 20%, acquired clients keep paying): year 1 −0.38 m, year 2 +0.20 m, year 3 +0.77 m, **cumulative +0.59 m**.

Reproduce: `python3 docs/business/model.py`. Every line is a product of the assumptions above; change them there.

## 5. What moves the result

1. **Adoption among crypto clients.** This drives retained trading, the largest line from the median case up.
2. **Acquisition.** Level 0 users converted to clients carry long-term value. The year-1 figure counts only one year of it.
3. **Platform cost.** This is a fixed cost: the case improves with scale and with reuse of the existing crypto desk and the Taurus infrastructure.
4. **Gas.** Small per user, but it should be measured on Base mainnet before setting the level 0 quota (10 operations a month).

What does *not* drive it: the premium tier. It matters for positioning (basic security free, convenience paid) more than for revenue.

## 6. Questions for the Swissquote mentors

- How many clients hold crypto, and what is their median crypto balance?
- How many external-wallet withdrawals and deposits per month, and what does each manual check cost?
- What share of assets withdrawn to external wallets ever comes back?
- What revenue does a new client typically generate in year 1, and over their lifetime?
- Is a monthly price of CHF 5–9 credible for a security subscription? Is there appetite for an insurance partner?

## 7. Pitch lines

- "The wallet keeps self-custody clients **one tap** from Swissquote's trading desk instead of an exchange's."
- "Basic security is free for everyone. Premium sells speed, comfort and insurance, never the fix."
- "At 25% adoption among crypto clients it pays for itself in year 1. With the acquisition funnel it is positive over three years in the median case."

## Sources

- Swissquote H1 2026: [Finance Magnates](https://www.financemagnates.com/forex/swissquote-inches-toward-chf-100-billion-club-even-as-crypto-income-craters/), [Hubbis](https://hubbis.com/news/swissquote-cuts-2026-guidance-as-crypto-income-slumps-in-first-half), [Quartr H1 2026 summary](https://quartr.com/events/swissquote-group-holding-ltd-sqn-h1-2026_F9Onu006)
- Swissquote fees and wallet rules: [Swissquote crypto wallet](https://www.swissquote.com/en-ch/private/trade/products/cryptocurrencies/wallet)
- eToro and Zengo: [eToro press release](https://www.etoro.com/news-and-analysis/press-releases/etoro-acquires-zengo-to-expand-self-custodial-crypto-capabilities/)
- Price references: Ledger Recover ([The Defiant](https://thedefiant.io/news/nfts-and-web3/ledger-s-new-wallet-recovery-feature-sparks-community-backlash)), Zengo Pro ([TechCrunch](https://techcrunch.com/2023/07/24/crypto-wallet-zengo-launches-pro-subscription-with-additional-security-features))
