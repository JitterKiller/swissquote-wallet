# ADR-029: Activity shows which factors approved each payment, read from the Allowance Module's events

- **Status:** Accepted, amended by [ADR-043](ADR-043-demo-key-and-key-approvals.md) ("Face ID + key", from the `SafeMultiSigTransaction` signatures)
- **Date:** 2026-10-11
- **Amends:** [ADR-015](ADR-015-activity-from-chain-logs.md) (one more log source for Accounts)
- **Related:** [PDR-014](../product/PDR-014-separation-of-powers.md), [PDR-020](../product/PDR-020-daily-limit-chosen-by-user.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-027](ADR-027-visual-world-swiss-onchain-fintech.md)

## Context

The Overview and Activity lists showed every payment out of the Account the same way, although some were approved by Face ID alone (within today's limit) and others by Face ID and the Recovery Kit. The difference is the product's main promise (PDR-014), so the list should prove it. DESIGN.md's Factor Code Rule already gives each factor a square: orange for the phone, ink for the Kit. The route must come from the chain, not from local memory, so that it also shows on another device and after a recovery.

## Decision

- `fetchTransfers(address, fromBlock, kind)` in `web/src/lib/activity.ts` takes `kind: 'account' | 'key-safe'`. `WalletProvider` passes `'account'` when the wallet has an Account.
- For an Account, it also reads the Allowance Module's (`ALLOWANCE_MODULE_ADDRESS`) `ExecuteAllowanceTransfer(address indexed safe, address delegate, address token, address to, uint96 value, uint16 nonce)` logs, filtered on `safe = Account`. It uses the same 49k-block ranges and the same RPC (`LOGS_NODE_URL`) as the USDC logs. Topic0 is `0xa11cca2c2027e28ab0046aab4d4040f59d8b06e819ccd974c1e53e86aa814c19`, checked on a real transaction.
- Each outgoing `Transfer` gets a `via` field:
  - `'face-id'` if its transaction emitted one of those events (the daily allowance paid it, Face ID alone);
  - otherwise `'face-id+kit'`: any other transfer out of the Account goes through its threshold 2, which today means the Key Safe plus the Kit owner key.
  - For a wallet without an Account (legacy Key Safe), outgoing transfers are `'face-id'`.
- `TransferRow` shows the squares (`ApprovalSquares` in `web/src/components/ui/factor.tsx`), and `ApprovalLegend` explains them above the list.

## Consequences

- ✅ The activity list proves the separation of powers with real data, on any device, with no backend and no local log.
- ✅ One extra `eth_getLogs` per range and per sync (every 10 s), only for Accounts.
- ⚠️ "Not paid by the allowance" is read as "Face ID + Kit". That stops being true once a hardware key can be the second owner (PDR-017): a transfer could then be phone + hardware key. That build must tell the signers apart, e.g. by decoding the Account's `execTransaction` signatures or by watching `ExecutionSuccess` together with the owners.
- ⚠️ Same limits as ADR-015: a free public RPC, and about 7 days of history on a recovered wallet.

## Alternatives considered

- **Remember the route locally when sending:** rejected. It is lost on another device or after a recovery, and it cannot cover transfers made elsewhere (scripts, a second phone).
- **Decode each transaction's calldata** (`handleOps`, then `execTransaction` or `executeAllowanceTransfer`): rejected for now. It needs one `getTransaction` per transfer, whereas the module already emits an indexed event.
- **The Account's `ExecutionFromModuleSuccess` / `ExecutionSuccess` events:** these say whether the Account executed through a module or by owner signatures. The module case would also match the recovery module, so the Allowance Module's own event is the more precise source.
