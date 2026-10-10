# ADR-013: Vault — a second Safe with the Safe Allowance Module, the Spending Safe as delegate

- **Status:** Superseded by [ADR-017](ADR-017-two-safe-account.md)
- **Date:** 2026-10-10
- **Related:** [PDR-011](../product/PDR-011-vault-daily-limit.md), [ADR-001](ADR-001-safe-smart-account.md), [ADR-004](ADR-004-bundler-and-paymaster.md), [ADR-006](ADR-006-recovery-target-verifier-proxy.md), [ADR-011](ADR-011-no-custom-cryptography.md)

## Context

PDR-011 needs a daily limit for the passkey and a second factor above it. Constraints:

- **No custom contracts** (ADR-011).
- **Don't touch what works:** the passkey-owned Safe, its signing path and its recovery (ADR-001, ADR-002, ADR-005, ADR-006).
- The audited **Safe Allowance Module** gives a *delegate* a periodic spending allowance, but it **rejects contract signatures**: its code reverts with "Contract signatures are not supported by this module" (string present in the bytecode deployed on Base Sepolia). The passkey is a contract owner (its WebAuthn verifier proxy), so it **cannot be a delegate that signs**.
- With an **empty signature**, the module authenticates `msg.sender` as the delegate. A contract can therefore be a delegate if it calls the module itself.

## Decision

- **Vault:** a new Safe with owners **[Spending Safe address, second factor address]** and threshold **2**. Demo: the second factor is the Recovery Kit key (ECDSA).
- **Module:** Safe Allowance Module **v1.0.0** at `0x691f59471Bfd2B7d639DCF74671a2d648ED1E331` (Candide deployment list; bytecode present on Base Sepolia), enabled on the Vault.
- **Allowance:** the Spending Safe is the delegate:
  - `addDelegate(spendingSafe)`
  - `setAllowance(spendingSafe, USDC, limit, resetTimeMin = 1440, resetBaseMin = 0)`
- **Daily spend (passkey only):** a normal sponsored UserOp from the Spending Safe (`sendCalls` in `web/src/lib/wallet.ts`) calls `executeAllowanceTransfer(vault, USDC, to, amount, paymentToken = 0x0, payment = 0, delegate = spendingSafe, signature = 0x)`. The empty signature makes the module use `msg.sender`, the Spending Safe.
- **Above the limit, or admin (change the limit, change owners):** a Spending Safe UserOp calls `vault.execTransaction(...)`. The signatures are:
  - the second factor's ECDSA signature over the Safe transaction hash;
  - an "approved hash" signature (`v = 1`) for the Spending Safe, which Safe accepts because the Spending Safe is `msg.sender`.

  Signatures are sorted by owner address, as Safe requires.
- **Setup:** one Spending Safe UserOp that:
  1. deploys the Vault through the Safe proxy factory at a deterministic address, enabling the Allowance Module during `setup`;
  2. calls `vault.execTransaction` (Kit signature + `v = 1`) to run `addDelegate` and `setAllowance`.

  The exact factory, singleton and module-setup calls are settled during the spike.
- **Recovery:** unchanged. The Spending Safe keeps its address through recovery (ADR-006), so the Vault's first owner and the allowance delegate follow the new passkey automatically.
- **Code:**
  - `web/src/lib/vault.ts` (new);
  - `ALLOWANCE_MODULE_ADDRESS` and `VAULT_DAILY_LIMIT` in `web/src/lib/config.ts`;
  - both pocket balances on the Dashboard.

**Spike (2 hours max) before building the UI.** On Base Sepolia, check that:

1. a Spending Safe UserOp calling `executeAllowanceTransfer` with an empty signature succeeds;
2. the same call above the remaining allowance reverts;
3. `vault.execTransaction` with the Kit's ECDSA signature + `v = 1` from the Spending Safe succeeds.

If (1) fails, this record becomes Deprecated and the vault stays a pitch item (PDR-009 cut line).

## Consequences

- ✅ No custom contract: Safe plus an audited Safe module.
- ✅ The existing Safe, passkey signing and recovery are untouched, and the existing e2e tests stay valid.
- ✅ Recovery protects the Vault for free.
- ⚠️ We checked the module's presence and its EIP-1271 refusal in the deployed bytecode, not its full verified source. The spike is the real check.
- ⚠️ Always pass `payment = 0`: the module pays any payment to `tx.origin`, which is the bundler here.
- ⚠️ The thief still gets the Spending balance plus the daily limit until recovery revokes the old passkey (PDR-011).
- ⚠️ Rotating a lost second factor is not covered yet.

## Alternatives considered

- **Passkey verifier proxy as a signing delegate:** rejected by the module (no EIP-1271 support).
- **A single Safe with two owners plus the allowance:** rewrites the working core and hits the same EIP-1271 limitation.
- **Zodiac Delay modifier (time-locked withdrawals):** needs a key that can cancel which the thief does not have, plus extra contracts and flows.
- **A custom Safe Guard enforcing limits:** custom security-critical Solidity, against the spirit of ADR-011.
