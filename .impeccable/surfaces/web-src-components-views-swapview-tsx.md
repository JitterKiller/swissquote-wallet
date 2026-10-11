---
version: 1
slug: "web-src-components-views-swapview-tsx"
primary_target: "web/src/components/views/SwapView.tsx"
related_targets: ["web/src/components/views/OverviewView.tsx","web/src/components/shell/AppShell.tsx"]
---

# Surface brief: Swap

- **Scope:** `/swap` (SwapView, the sidebar's Swap leaves "Soon"); the Overview plate's secondary balances line and its Swap tile; the approved-contract list (Uniswap v3 SwapRouter02 joins; Earn's unlisted demo moves to Uniswap's Universal Router).
- **Mode:** Operate.
- **Audience and job:** the owner who wants euros (EURC) or some ETH from their USDC, or back, without leaving self-custody; the jury, who sees a second compliant dApp interaction.
- **Proof and content:** live quotes from Uniswap v3's QuoterV2 on Base Sepolia, best fee tier picked per quote; the Account's USDC, EURC and WETH balances; the readable steps (allow exactly N, swap N for at least M), screening, chained simulation; the swap transaction on Basescan.
- **Constraints:**
  - Kit + Face ID for every swap (a dApp action, PDR-025);
  - exact approvals;
  - recipient is always the Account;
  - a 0.5% slippage floor ("at least M or nothing happens");
  - a deadline;
  - ETH is held as WETH;
  - testnet prices labelled honestly;
  - no ETH needed for fees (sponsored);
  - English copy.
- **Out of scope:** other tokens, limit orders, sending EURC/ETH, EURC/ETH in Activity.
- **Unresolved:** none blocking.

## Direction contract

THESIS: Change currency the way a bank client expects, with the custody of a wallet: you give an exact amount, you see the rate and the minimum you will get, and both your factors sign it. It refuses the DEX trading terminal (charts, slippage sliders, token lists) and any promise of a price.

OWN-WORLD:
- DESIGN.md as built: a white swap card with mono figures and a flip control, and a sealed 2-of-2 review plate.
- Amounts follow each token's precision: two decimals for USDC and EURC, up to six significant decimals for ETH.
- Rates, the minimum and the pool fee are mono data rows on hairlines; the balances strip is in mono.
- One committed orange, used only for the primary action.

STORY: The owner picks what they give and what they get, types an amount, sees the live rate, the minimum guaranteed and the pool, reviews the exact steps, and approves with the Kit and Face ID; the receipt shows what they gave and what arrived. On testnet, an ETH price that looks wrong is labelled as a testnet pool price.

FIRST VIEWPORT:
- Under the header, the swap card: "You give" (amount field with a token picker), the ⇅ flip, "You get ≈" (the quote with a token picker), then rows Rate, At least (0.5% slippage), Pool (Uniswap v3 · fee), and "Review swap".
- Under it, a balances strip: USDC · EURC · ETH.
- The review opens under the card: the sealed plate, the checks, the Kit, and "Approve with Kit and Face ID".

FORM: user-picked in the shape round (both pairs, from→to card with a sealed review, balances on the Overview and the Swap screen); no roll, inside the established world.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
