# ADR-028: Approved dApps — native call builders, 2-factor Account transactions, paymaster allowlist

- **Status:** Accepted, amended by [ADR-032](ADR-032-swaps-and-assets.md) (one registry of approved contracts, with the swap router)
- **Date:** 2026-10-10
- **Amends:** [ADR-023](ADR-023-sponsorship-policy-proxy.md) (the sponsorship policy also checks dApp contracts)
- **Related:** [PDR-025](../product/PDR-025-approved-dapps.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-022](ADR-022-compliance-checks.md), issue #25

## Context

PDR-025 asks for a short list of approved dApps built natively, every dApp action with 2 factors, the usual checks before Face ID, and sponsorship only for approved contracts. Checked on Base Sepolia (2026-10-10): Aave v3 (Pool `0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b`, reserves Circle USDC and WETH), Compound III (cUSDCv3 `0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017`, base token Circle USDC, supply not paused) and Uniswap v3 (USDC/WETH pools with liquidity) all accept Circle's test USDC.

## Decision

- **`web/src/lib/dapps.ts`** (shared by the app and the server):
  - `APPROVED_DAPPS`: id, name, description, URL, risks, and the contracts each one may be called on. First list: Aave v3 (Pool) and Compound III (cUSDCv3).
  - Call builders returning one `AccountCall` per action, batched through `MultiSendCallOnly` (ADR-017): deposit = `USDC.approve(protocol, amount)` + `supply`; withdraw = `withdraw(USDC, amount | max, account)`. Exact approvals only, never unlimited.
  - Reads: the position (Aave aToken balance, Comet `balanceOf`) and the current supply rate (Aave `currentLiquidityRate`, Comet `getSupplyRate(getUtilization())`), as an APY for display.
  - `dappActionCalls(...)`: wraps the action in `twoFactorCall` (Kit owner key + Key Safe, one sponsored Key Safe UserOp).
  - `describeDappCall(...)`: readable lines for the preview.
- **Checks before Face ID:** the UI reuses `simulateCalls` and `screenRecipient` (ADR-022) on the protocol contract, and shows the preview lines. The simulation runs each inner call from the Account.
- **Sponsorship policy** (`web/src/server/sponsorship.ts`): classification now also collects the **contracts** a UserOp calls or approves (generic calls and `approve` spenders; transfers, security operations and calls to the sender itself are not dApp contracts). If any is not in `APPROVED_DAPPS`, `decide` refuses with reason `unapproved-dapp` and says the client can still pay gas.
- **Tests:** `npm run check:dapps` on Base Sepolia: fund a test Account through the Swissquote treasury (registry link + `/api/swissquote/withdraw`), deposit to and withdraw from each approved dApp with 2 factors, check Face ID alone is refused, check the paymaster refuses an unapproved contract, then send the USDC back to the treasury.

## Consequences

- ✅ One place lists what clients may interact with; the app and the paymaster read the same list.
- ✅ No new dependency or third-party account (no WalletConnect project).
- ⚠️ Adding a protocol means writing its builders and reads (small for lending markets).
- ⚠️ The allowlist is enforced by Swissquote's app and paymaster, not on-chain (by design: friction, not veto).
- ⚠️ Aave rounding can leave a dust balance after a full withdrawal; `max` withdrawals avoid it.

## Alternatives considered

- **WalletConnect (Reown WalletKit):** any dApp, but a third-party project id, and request handling for arbitrary calldata (harder to preview). Roadmap behind the same allowlist.
- **Safe Apps SDK in an iframe:** same openness problem, and the Safe Apps protocol assumes Safe's own transaction service.
- **An on-chain guard restricting targets:** a Swissquote veto and custom Solidity (PDR-001, ADR-011).
