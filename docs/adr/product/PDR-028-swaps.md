# PDR-028: Swaps: USDC ↔ EURC and USDC ↔ ETH at Uniswap v3, from the Account, with 2 factors

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:** [PDR-025](PDR-025-approved-dapps.md) (the approved list gains a swap venue)
- **Related:** [PDR-003](PDR-003-gasless-by-default.md), [PDR-014](PDR-014-separation-of-powers.md), [PDR-023](PDR-023-compliance-as-friction.md), [PDR-025](PDR-025-approved-dapps.md), [ADR-032](../architecture/ADR-032-swaps-and-assets.md), [ADR-028](../architecture/ADR-028-approved-dapps-native-integration.md)

## Context

- **Clients and scope.** Swissquote's clients hold dollars and euros, but the wallet held USDC only. Swaps were listed as undecided in PRODUCT.md.
- **Why swaps matter for compliance.** A swap is the most common DeFi action. It is also one of the most common ways to lose funds: unlimited approvals, fake routers, slippage and sandwiching. That makes it a natural second case for the "compliant dApp interaction" bonus, after Earn (PDR-025).
- **Rules already decided apply:**
  - 2 factors for anything that is not a payment within the daily limit (PDR-014, PDR-025);
  - sponsorship for approved contracts only (PDR-025);
  - a readable preview, a simulation and screening before Face ID (PDR-023);
  - gas always sponsored, users never need ETH (PDR-003).
- **Base Sepolia.** It has Circle's EURC and WETH, with Uniswap v3 pools against Circle's test USDC. The 0.05% pools fill small amounts. Testnet prices are arbitrary: one ETH pool prices ETH near 600 USDC, another far higher.

## Decision

- **Pairs: USDC ↔ EURC and USDC ↔ ETH.**
  - USDC is always one side: it is the wallet's currency, the one the balance and the daily limit are counted in.
  - ETH is held as **WETH**, an ERC-20, so every asset is a token and swaps work the same both ways.
  - ETH is an asset here, never fuel: network fees stay sponsored (PDR-003).
- **One venue: Uniswap v3** (SwapRouter02 on Base Sepolia), added to Swissquote's approved contracts. The app quotes every Uniswap fee tier and keeps the best one, as an aggregator would, and shows it ("Uniswap v3 · 0.05% fee").
- **Protection built into each swap:**
  - an exact approval of the amount given, never unlimited;
  - the Account as the only recipient;
  - a minimum received of the quote minus **0.5% slippage**: "you get at least X, or nothing happens";
  - a 10-minute deadline.
- **Every swap needs 2 factors: Face ID + the Kit passphrase.** A swap is never covered by the daily limit, so a thief with the unlocked phone cannot swap the Account into a bad pool.
- **Before Face ID, the same checks as a dApp action:**
  - the router is screened;
  - a chained simulation with a readable preview ("Swap 0.50 USDC for at least 0.49 EURC at Uniswap v3");
  - a typed confirmation of the exact amount when it is 50% or more of the asset's balance, or 5,000 USDC or EURC or more.
- **Honest amounts:**
  - What is given, received or signed is shown to the last unit, up to 6 decimals ("0.498962 EURC"). This covers the review, the receipt, the preview and the typed confirmation.
  - Balances, lists and quotes are shown at each asset's precision: 2 decimals for USDC and EURC, up to 6 for ETH.
  - These figures, and minimums, are rounded down: never more than there is or than is promised.
  - Inputs take at most 6 decimals; Max is the whole balance to the sixth decimal.
  - The receipt's "You got" is read from the transaction's own logs. When they cannot be read, the receipt shows the minimum, labelled as such.
- **Balances and history:**
  - The Overview shows EURC and ETH under the USDC balance ("+ 0.50 EURC") when the Account holds some.
  - The Swap screen lists all three assets.
  - Activity shows a swap as one row ("Swapped to EURC · Got 0.49 EURC"), approved by Face ID + Kit in both directions, not as a payment to the pool's address.
- **Testnet prices are labelled** on the screen ("Testnet pool price. ETH on Base Sepolia trades far from real markets").
- **No Swissquote fee in the prototype.** The pool's fee is shown. An FX spread is a classic bank revenue; it is to model with the offers (PDR-019).

## Consequences

- ✅ Euros and ETH in the same self-custody Account, under the same 2-factor rule and checks. A second demonstrable "compliant dApp interaction".
- ✅ Approval drainers and fake routers are closed by construction: only the approved router can take funds, it can take only the exact amount, the Account is the recipient, and there is a minimum out.
- ⚠️ **Limited routing:** single-pool Uniswap v3 routes only, with no aggregator and no multi-hop.
- ⚠️ **Testnet prices:** they follow testnet liquidity, so a round trip through two ETH pools can gain or lose a lot.
- ⚠️ **Spending stays in USDC:** the daily limit counts USDC only. EURC and ETH leave the Account with 2 factors; sending EURC or ETH is not built (Send stays USDC).
- ⚠️ **Legal review:** exchanging crypto-assets needs legal review before production (FINMA, no advice). The prototype shows the mechanism.
- ⚠️ **ETH dust:** below 0.000001 ETH it can stay after a Max, because inputs have 6 decimals.

## Alternatives considered

- **Native ETH instead of WETH:** needs wrapping and unwrapping and a separate route. The Allowance Module, balances and approvals are token-based, and WETH keeps everything ERC-20.
- **An aggregator, or Uniswap's Universal Router:**
  - Aggregators give better prices on mainnet, but have no Base Sepolia support and add a third-party dependency.
  - The Universal Router runs opaque command bytes behind Permit2, which are hard to preview and to allow safely. It stays unlisted and is the target of Earn's "unlisted router" demo.
- **Any token pair:** more choice, but each token must be vetted (issuer, sanctions, liquidity). We start with Circle's two stablecoins and ETH.
- **Face ID alone within the daily limit:** the Allowance Module only transfers tokens to an address, while a swap is a contract call from the Account. That means 2 factors anyway, which is also the safer rule.
- **Slippage chosen by the client:** more control, but more ways to be sandwiched. A fixed 0.5% is enough for stablecoins and the testnet; a setting can come later.
