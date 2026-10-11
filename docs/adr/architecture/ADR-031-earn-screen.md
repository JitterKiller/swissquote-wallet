# ADR-031: Earn screen: positions plate, approved-protocol cards, 2-factor review with risk acknowledgement, chained simulation

- **Status:** Accepted, amended by [ADR-032](ADR-032-swaps-and-assets.md) (the unlisted demo targets Uniswap's Universal Router)
- **Date:** 2026-10-11
- **Amends:** [ADR-022](ADR-022-compliance-checks.md) (the simulation now chains the steps)
- **Related:** [PDR-025](../product/PDR-025-approved-dapps.md), [ADR-028](ADR-028-approved-dapps-native-integration.md), [PDR-023](../product/PDR-023-compliance-as-friction.md), [ADR-027](ADR-027-visual-world-swiss-onchain-fintech.md)

## Context

ADR-028 built the approved dApps in `lib/dapps.ts`: Aave v3 and Compound III, deposit and withdraw with 2 factors, exact approvals, and paymaster sponsorship only for approved contracts. Issue #25 needs the screen, and its acceptance asks that "an unlisted [dApp] shows the friction". Building the review exposed a gap: ADR-022 simulated each call with its own `eth_call`, so a deposit's `supply` failed in simulation for lack of the `approve` that precedes it.

## Decision

- **`/earn` (`EarnView`)** is in the sidebar and opens from the Overview's Earn tile and Earn card. The layout was chosen in the shape round:
  - **Positions plate:** an ink plate "Lent · live onchain" with the total and one row per protocol (amount, live APY), labelled "testnet rates, variable".
  - **Protocol cards:** name, "Approved" badge, APY with "variable", what it is, its risks, the position, and the contract linked to Basescan. Deposit, plus Withdraw once there is a position.
  - **Action panel:**
    - the amount (Max = the Account's balance, or the whole position as `max` for a withdrawal);
    - a sealed review "Face ID and your Kit will approve" listing the exact steps (allow exactly N, supply N; or withdraw back to the Account), with approval squares;
    - the checks (`ComplianceChecks subject="dapp"`: protocol contract screened, chained simulation, typed confirmation for large amounts);
    - **for deposits, a required risk acknowledgement** ("not a bank deposit, variable rate, smart-contract risk");
    - then the Kit (local copy or file, plus passphrase) and Face ID → `dappActionCalls` via `sendCalls`.
  - **Unlisted demo:** "Demo: try an unlisted dApp" asks the Key Safe to approve the Uniswap v3 router on Base Sepolia (`UNLISTED_DEMO`). The paymaster refuses with `unapproved-dapp` before any Face ID prompt, and the screen shows the paymaster's own message as evidence.
- **Chained simulation:** `simulateCalls` (`lib/compliance.ts`) uses `eth_simulateV1` through viem's `simulateCalls`, so the steps run in order on one state. It falls back to one `eth_call` per step on nodes without it. `dappActionSteps` exposes a deposit's two steps for the simulation.
- **Typed confirmation** compares amounts, not strings ("0.5" and "0.50" match). Its input is labelled "Type the amount to confirm".
- **Test:** `npm run e2e:earn` runs on Base Sepolia in about 2 minutes:
  1. protect and fund a wallet;
  2. deposit 0.50 to Aave with Kit + Face ID;
  3. withdraw the whole position;
  4. run the unlisted demo;
  5. send the USDC back to the treasury.

## Consequences

- ✅ A compliant dApp interaction runs end to end in the app with the same friction as a payment. It shows the jury the bonus criterion.
- ✅ Simulations of multi-step operations are now meaningful (Send as well).
- ⚠️ `eth_simulateV1` depends on the node; the fallback reverts to per-call simulation (a deposit's supply would then show as failing).
- ⚠️ Rates are testnet values and can be near zero (Compound III shows 0.03% at times).

## Alternatives considered

- **Comparator layout (one amount, pick a protocol):** reads less well for withdrawals and positions. Not picked in the shape round.
- **Simulating the batched MultiSend through the Safe's `simulateAndRevert`:** exact, but more code. `eth_simulateV1` is available on Base Sepolia.
- **Showing the risks without an acknowledgement:** the team prefers the explicit friction (PDR-023).
