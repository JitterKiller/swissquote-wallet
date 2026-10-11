# ADR-032: Swaps and multi-asset balances: `lib/assets.ts`, `lib/swap.ts` (QuoterV2 + SwapRouter02), one approved-contracts registry, exact amounts, swaps in Activity

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:**
  - [ADR-015](ADR-015-activity-from-chain-logs.md): Activity also reads EURC and WETH, to recognise swaps.
  - [ADR-022](ADR-022-compliance-checks.md): the typed confirmation uses the exact amount in the token's decimals, and the dollar threshold is optional.
  - [ADR-028](ADR-028-approved-dapps-native-integration.md): the approved contracts include the swap router.
  - [ADR-031](ADR-031-earn-screen.md): the unlisted demo targets the Universal Router.
- **Related:** [PDR-028](../product/PDR-028-swaps.md), [PDR-025](../product/PDR-025-approved-dapps.md), [PDR-023](../product/PDR-023-compliance-as-friction.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-023](ADR-023-sponsorship-policy-proxy.md)

## Context

PDR-028 adds swaps. The implementation needs four things:

- The Account must hold several tokens.
- The app must quote and execute through Uniswap v3 on Base Sepolia.
- The paymaster's allowlist must stay in step with the UI.
- Amounts must be shown honestly.

Building it exposed three bugs in shared code:

1. **The typed confirmation could not be satisfied.** It showed a 2-decimal placeholder but compared it to a 6-decimal amount, so a Max of 0.498962 could never be confirmed. Send's Max also rounded 0.999512 up to "1", which is more than the balance.
2. **The large-amount threshold mixed units.** It compared wei to a USDC amount.
3. **Activity misread swaps.** It showed a swap as "Sent USDC to 0x4304…", the pool's address.

## Decision

### `lib/assets.ts`

- **`ASSETS`:**

  | Asset | Address | Decimals | Held as |
  |---|---|---|---|
  | USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 | USDC |
  | EURC | `0x808456652fdb597867f38412077A9182bf77359F` | 6 | EURC |
  | ETH | `0x4200000000000000000000000000000000000006` | 18 | WETH |

- **Lookups:** `assetByAddress`, and `readBalances`, which reads all three balances in one multicall.
- **Display:**
  - `formatAsset(amount, asset, round = 'down')` formats balances and quotes at the asset's precision: 2 decimals, or 6 for ETH. It rounds down, so an ETH holding reads the same on a receipt and beside it.
  - `formatAssetExact` formats up to 6 decimals, floored.
  - `shows` hides dust.
- **Input:** `toInput` fills the field for Max and flip. `INPUT_DECIMALS = 6` (defined in `lib/inputs.ts` with the other field rules, ADR-033).

### `lib/format.ts`

- **`formatDecimal(amount, decimals, { places, round, group, min })`** works on the integer, with no float. It rounds to the nearest unit or down, and handles negative amounts.
- **`formatUsdc`** now rounds down: a balance of 0.999498 reads 0.99, never more than there is.
- **`formatUsdcExact`** is what Send's review and receipt show.

### `lib/swap.ts`

- **`quoteSwap`:**
  - Simulates QuoterV2 `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` `quoteExactInputSingle` on fee tiers 100, 500, 3000 and 10000.
  - Keeps the best quote, with `minOut = amountOut × (1 − 0.5%)` (`SLIPPAGE_BPS = 50`).
  - Returns null when every tier reverts (`ContractFunctionRevertedError`): no pool can fill the amount.
  - Throws when the node does not answer. The screen then says it is retrying and keeps a quote it already showed, instead of claiming there is no pool.
- **`swapSteps`** returns two calls:
  - `approve(router, amountIn)` on the token given;
  - `router.multicall(deadline, [exactInputSingle(...)])`, where:
    - `deadline` = now + 600 s, with "now" taken when the calls are built, at approval;
    - `exactInputSingle` has `recipient` = the Account, `amountOutMinimum = minOut` and `sqrtPriceLimitX96 = 0`.
- **`swapCalls`** batches the steps into one 2-factor call (`twoFactorCall`: the Kit owner signature plus the Key Safe). It is sent by `sendCalls`, sponsored and passkey-signed.
- **`describeSwap`** decodes the router call for the preview.
- **`receivedBy(account, token, txHash)`** sums the token's `Transfer` logs to the Account in the transaction's receipt. The receipt's "You got" uses it, so it does not depend on a balance read that a lagging node could miss. When it is null, the receipt shows the minimum, labelled "You got at least".

### `lib/dapps.ts`

- **`UNISWAP_V3_ROUTER`** is SwapRouter02 `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`.
- **`APPROVED_CONTRACTS`** is the one registry of approved contracts: the Earn protocols' contracts plus the router. Both readers use it:
  - `isApprovedContract`, read by the paymaster (ADR-023);
  - `approvedContractName`, read by the UI and the previews.
- **`UNLISTED_DEMO`** is now Uniswap's Universal Router `0x492E6456D9528771018DeB9E87ef7750EF184104`, because SwapRouter02 is approved. The Earn button reads "Demo: try an unlisted router".

### `lib/compliance.ts` and `ComplianceChecks`

- **`describeCall`:**
  - Decodes `approve` and `transfer` for every asset, with exact amounts.
  - Decodes the router call, for example "Swap 0.50 USDC for at least 0.49 EURC at Uniswap v3 (0x94cC…2bc4)".
- **`needsHighValueConfirmation(amount, balance, largeAt)`:** a `largeAt` of `null` keeps the balance rule only. ETH uses it.
- **`ComplianceChecks`:**
  - Takes `decimals` and `largeAt`.
  - The typed confirmation shows the exact amount in the token's decimals and compares the typed text against it.

### `lib/activity.ts`

- **Queries:** the Transfer query reads USDC, EURC and WETH together, with one `eth_getLogs` per block range and direction (an address array).
- **Swap detection:** a transaction with USDC out and another asset in, or the reverse, gives one USDC row with `swap: { asset, amount }`.
- **Approval route:** both directions are marked Face ID + Kit. A swap back to USDC took the other asset out of the Account with 2 factors.
- **Display:** `TransferRow` shows "Swapped to EURC" or "Swapped from EURC", then "Got N EURC" or "Gave N EURC", at list precision. On wider screens it adds "· Uniswap v3".

### UI

- **`/swap` (`SwapView`)**, in the order the owner sees it:
  1. "You give": the amount and the asset picker. Max sits beside the balance, so a 6-decimal amount fits on a phone; `amountFit` steps the font down before it would clip.
  2. A flip button.
  3. "You get about": a live quote (`aria-live`), debounced 350 ms and refreshed every 15 s.
  - On phones the pickers and the flip are 44 px tall.
  4. Rows for the rate, the minimum ("at least", floored) and the pool, plus a testnet note when ETH is involved.
  5. A sealed review, "Face ID and your Kit will approve". It shows:
     - the minimum ("At least"), with "Expected N · if less, nothing happens";
     - the exact allowance, with the router's address;
     - the pool, the approval squares and the network fee.
  6. `ComplianceChecks subject="dapp"`.
  7. The Kit file or local copy, the passphrase, then Face ID.
  8. A receipt with the amount received, read from the transaction's logs (`receivedBy`).
- **Overview:** `useAssetBalances` and `otherBalancesLine` add a line under the balance. The tiles are Send, Receive, Swap and Earn.
- **Sidebar:** Swap comes after Earn.
- **Send:** Max is the exact balance, and the review and receipt show the exact amount. The amount field uses `amountFit`.
- **`PlateRow`:** labels no longer wrap; the value does.

### Tests

- **`npm run e2e:swap`** (`scripts/e2e-swap.mts`) runs these steps:
  1. Protect a wallet and fund it with 1 USDC.
  2. USDC → EURC, 0.50.
  3. EURC → USDC with Max, which confirms the exact typed amount.
  4. USDC → ETH, 0.20.
  5. ETH → USDC with Max.
  6. Check Activity.
  7. Send the funds back to the treasury.
- It saves `swap-*` captures (phone and desktop) and takes about 2 minutes.

## Consequences

- ✅ **One operation per swap:** each swap is a single sponsored UserOp signed by Face ID and the Kit. The router can only take the exact amount. The paymaster and the UI read the same registry.
- ✅ **Honest amounts:** a minimum is never rounded up, Max never exceeds the balance, and the typed confirmation matches what is signed. The same fix applies to Send.
- ⚠️ **Partial asset history:** rows other than swaps stay USDC. EURC or WETH received directly is not listed yet.
- ⚠️ **Quote cost:** a quote is 4 simulated calls to QuoterV2, repeated every 15 s while the screen is open.
- ⚠️ **A frozen quote can revert:** the review keeps the quote it showed. If the pool moves by more than 0.5% before approval, the swap reverts and nothing happens. The simulation usually catches this first.
- ⚠️ **Testnet prices:** the pools are mispriced, so round trips through ETH can gain or lose a lot. The screen labels it.

## Alternatives considered

- **Universal Router (Permit2 and command bytes):** harder to decode, preview and allow safely. It stays the unlisted demo.
- **An aggregator API:** no testnet support, and a third-party key.
- **Prices from the pool's `slot0`:** ignores liquidity and ticks. QuoterV2 simulates the real swap.
- **Native ETH with an unwrap step:** see PDR-028.
- **An indexer for multi-asset history:** not needed for the prototype; logs are enough (ADR-015).
