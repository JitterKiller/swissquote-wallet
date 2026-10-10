# ADR-023: Sponsorship policy — an ERC-7677 paymaster proxy in front of Candide

- **Status:** Accepted, amended by [ADR-028](ADR-028-approved-dapps-native-integration.md) (only approved dApp contracts are sponsored)
- **Date:** 2026-10-10
- **Amends:** [ADR-004](ADR-004-bundler-and-paymaster.md) (wallet UserOps now reach the paymaster through Swissquote's policy)
- **Related:** [PDR-003](../product/PDR-003-gasless-by-default.md), [PDR-015](../product/PDR-015-open-wallet-and-levels.md), [PDR-017](../product/PDR-017-theft-protection-hardware-key.md), [PDR-019](../product/PDR-019-offer-tiers.md), [PDR-023](../product/PDR-023-compliance-as-friction.md), [ADR-020](ADR-020-deployment-vercel-upstash.md), [ADR-021](ADR-021-wallet-registry.md), [ADR-022](ADR-022-compliance-checks.md), issue #23

## Context

PDR-015, PDR-017, PDR-019 and PDR-023 define what Swissquote sponsors:

- a quota at level 0;
- unlimited operations for linked clients;
- security operations always;
- nothing for sanctioned destinations or reported-stolen devices.

The public Candide paymaster sponsors everything. Policy is friction, never a veto: a refused operation can still be sent with the user's own gas.

## Decision

- **`/api/paymaster`** is an ERC-7677 JSON-RPC proxy. `pm_getPaymasterStubData` and `pm_getPaymasterData` go through the policy (`web/src/server/sponsorship.ts`). Every other method (`eth_chainId`, `pm_supportedEntryPoints`, …) is forwarded to `UPSTREAM_PAYMASTER_URL` (Candide; env `PAYMASTER_UPSTREAM_URL`).
- **`PAYMASTER_URL`** in `config.ts` is `<origin>/api/paymaster` in the browser and the upstream on the server. The Swissquote relayer (ADR-007) stays on the upstream: it is Swissquote's own operations account.
- **Classification:** decode the Safe 4337 executor call (`executeUserOpWithErrorString` / `executeUserOp`), then `MultiSend` batches and `execTransaction` (2-factor Account transactions, ADR-017) recursively.
  - **Security call:**
    - any call to a Candide recovery module;
    - the passkey verifier factory or the Safe proxy factory (setup);
    - Safe owner, threshold, module, guard or fallback-handler changes on the executing Safe;
    - Allowance Module settings (anything but `executeAllowanceTransfer`).

    A UserOp that also deploys the account and has no counterparty is setup, hence security.
  - **Counterparties:** ERC-20 `transfer` and `approve` (spender and token), `executeAllowanceTransfer` (recipient), and the target of any other call.
- **Decision order:**
  1. Key Safe reported stolen → refused.
  2. Any sanctioned counterparty (`isSanctioned`, ADR-022) → refused.
  3. Only security calls → sponsored.
  4. Linked client (registry, by Key Safe or Account, ADR-021) → sponsored.
  5. Otherwise the level 0 quota: `SPONSORED_OPS_PER_MONTH` (default 10) per sender and calendar month. It is consumed on `pm_getPaymasterData`, so a batch that mixes a security call with a transfer counts.
- **Refusals** are JSON-RPC errors `{ code: -32001, message, data: { swissquote: true, reason } }` with `reason` ∈ `quota | sanctioned | reported-stolen | invalid`. The message is user-facing (for example, the quota message suggests linking a Swissquote account).
- **`POST /api/report-stolen`** (PDR-017 step 3) stores the Key Safe in `stolenKeySafes`. The proof is either a fresh verified identity session for the linked Account (level 1), or a Recovery Kit signature over the report message. The Kit must be an owner of the Account (ADR-017) or a guardian of a legacy wallet (ADR-005), and the signature is valid for 10 minutes.
- **Checks:** `npm run check:sponsorship` (P1–P6, needs `npm run dev`). `npm run e2e` exercises the proxy from the browser.

## Consequences

- ✅ PDR-019's tiers and the "security operations always sponsored" rule are enforced in one place.
- ✅ Sanctions screening (PDR-023) covers payments made through the app, including transfers hidden in `execTransaction` and batches.
- ⚠️ The quota counts operations that are sponsored but never sent.
- ⚠️ A malicious report needs the Kit or a verified identity. Undoing a report goes through support (not built). Meanwhile the owner can still act through the relayer or with their own gas.
- ⚠️ Paying gas in USDC after the quota (Circle Paymaster) is not built. The app shows the quota message with the "link Swissquote" trigger instead.

## Alternatives considered

- **A sponsorship policy configured at the paymaster provider (Candide dashboard, Pimlico policies):** cannot see our registry, sanctions or stolen-device reports.
- **Checking in the client only:** trivially bypassed, since the paymaster would still sponsor.
