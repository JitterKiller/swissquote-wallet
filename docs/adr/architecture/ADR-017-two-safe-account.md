# ADR-017: Two-Safe account — Account Safe (user factors, threshold 2) + Key Safe with a daily allowance

- **Status:** Proposed (accepted once the spike below passes)
- **Date:** 2026-10-10
- **Supersedes:** [ADR-013](ADR-013-vault-allowance-module.md)
- **Related:** [PDR-013](../product/PDR-013-key-management-user-majority.md), [PDR-014](../product/PDR-014-separation-of-powers.md), [PDR-015](../product/PDR-015-open-wallet-and-levels.md), [PDR-017](../product/PDR-017-theft-protection-hardware-key.md), [ADR-001](ADR-001-safe-smart-account.md), [ADR-002](ADR-002-passkey-signing-safe-webauthn.md), [ADR-005](ADR-005-social-recovery-module.md), [ADR-007](ADR-007-swissquote-guardian-and-relayer.md), [ADR-011](ADR-011-no-custom-cryptography.md), [ADR-018](ADR-018-recovery-kit-encryption-and-storage.md)

## Context

PDR-014 requires that the passkey alone can only spend up to a daily limit, that every other action needs 2 of the user's factors, and that Swissquote is never an owner, with no custom contracts (ADR-011).

Facts this design relies on:

- **Safe Allowance Module v1.0.0** (`0x691f59471Bfd2B7d639DCF74671a2d648ED1E331`, bytecode present on Base Sepolia) **rejects contract signatures**. The string "Contract signatures are not supported by this module" is in the deployed bytecode. But with an **empty signature** it authenticates `msg.sender` as the delegate.
- **Safe** accepts a `v = 1` signature for an owner that is `msg.sender`, with no prior `approveHash`. It accepts **EIP-1271 contract owners** (`v = 0`), such as the WebAuthn verifier proxy of ADR-002.
- **Candide recovery module v0.0.1:**
  - a guardian cannot be an owner of the same Safe;
  - a new owner cannot be a guardian;
  - every configuration call requires `msg.sender == wallet`.
- Our accounts are **Safe L2 v1.4.1** (abstractionkit default for `SafeMultiChainSigAccountV1`). Transaction guards do not run on module transactions.

## Decision

```
Account Safe (0xACC…) — holds ALL funds, public address (balance, activity, registry, @handle, receive QR)
  owners: [ Key Safe, Recovery Kit address, (hardware key verifier proxy) ]   threshold: 2
  modules: Safe Allowance Module v1.0.0 → delegate Key Safe, USDC limit per day
           (optional) Candide recovery module, After7Days → guardian: trusted contact
Key Safe (0xKEY…) — the existing passkey Safe (ADR-001/002), holds no funds
  owner: passkey verifier proxy   modules: Safe 4337, Candide recovery (ADR-005)
```

- **Key Safe:** unchanged code path (`sendCalls` in `web/src/lib/wallet.ts`). It keeps its Candide recovery module:
  - level 0: guardian Kit, `After7Days` (`0x088f6cfD8BB1dDb1BB069CCb3fc1A98927D233f2`);
  - level 1: guardians Kit + Swissquote, `After3Days` (`0x38275826E1933303E508433dD5f289315Da2541c`);
  - demo: `After3Minutes` for both.
- **Account Safe:** a plain Safe L2 v1.4.1 (no 4337 module), deployed through the Safe proxy factory at a deterministic address, with the Allowance Module enabled at setup.
- **Spend up to the limit (passkey only):** a Key Safe UserOp calls `executeAllowanceTransfer(account, USDC, to, amount, paymentToken = 0x0, payment = 0, delegate = keySafe, signature = 0x)`.
- **Above the limit, or administration** (limit, owners, guardians): a Key Safe UserOp calls `account.execTransaction(...)`. Signatures, sorted by owner address as Safe requires:
  - Kit: ECDSA over the SafeTx hash, signed in the browser after decryption (ADR-018);
  - Key Safe: `v = 1`, because it is `msg.sender`;
  - with a hardware key: the key's WebAuthn contract signature (`v = 0`, verifier proxy) instead of the Kit.
- **Eviction after phone theft (no Key Safe needed):** the relayer (ADR-007) submits `account.execTransaction` signed by the Kit (ECDSA) and the hardware key (contract signature). It runs, through `MultiSendCallOnly`:
  1. `swapOwner(keySafe → newKeySafe)`;
  2. `removeDelegate(keySafe, true)`;
  3. `addDelegate(newKeySafe)`;
  4. `setAllowance(newKeySafe, USDC, limit, 1440, 0)`.
- **After a Key Safe recovery:** nothing changes on the Account (same Key Safe address).
- **Setup:** one Key Safe UserOp right after the Kit is generated (still in memory):
  1. deploy the Account with owners [Key Safe, Kit], threshold 2, Allowance Module enabled;
  2. `account.execTransaction` (Kit + `v = 1`) running `addDelegate` + `setAllowance`.

  The exact factory, singleton and module-setup calls are settled in the spike.
- **Code:**
  - `web/src/lib/account.ts` (new);
  - `ALLOWANCE_MODULE_ADDRESS` and the default limits in `web/src/lib/config.ts`;
  - balance, activity (ADR-015) and receive use the Account address;
  - Send splits by the remaining allowance.

**Spike (2 hours max), on Base Sepolia:**

1. A Key Safe UserOp calling `executeAllowanceTransfer` with an empty signature succeeds.
2. The same call above the remaining allowance reverts.
3. A Key Safe UserOp calling `account.execTransaction` with the Kit's ECDSA signature + `v = 1` succeeds.
4. The relayer calling `account.execTransaction` with the Kit's ECDSA + a WebAuthn verifier-proxy contract signature succeeds.

If 1 or 3 fails, this record becomes Deprecated and the current single-owner design stays, with the residual risk shown in the threat-model slide.

## Consequences

- ✅ Only audited contracts: Safe, Allowance Module, Candide recovery module.
- ✅ The passkey signing path, Key Safe recovery and its e2e tests are reused as they are.
- ✅ "Swissquote is never an owner" can be checked by anyone by reading the Account's owners.
- ⚠️ The Allowance Module was checked through its deployed bytecode only. The spike is the real check.
- ⚠️ Always pass `payment = 0`: the module pays any payment to `tx.origin`, which is the bundler here.
- ⚠️ The allowance is not cut automatically when a recovery starts (PDR-014).
- ⚠️ New flows to build: Kit rotation, hardware key enrolment, eviction.
- ⚠️ Every spend makes one extra call. On an L2 the cost is negligible.

## Alternatives considered

- **Passkey verifier proxy as the delegate:** the module rejects contract signatures.
- **A single Safe with the passkey as owner plus an allowance:** same EIP-1271 limitation, and the passkey stays root.
- **Safe 1.5.0 module guard with a custom guard:** custom security-critical Solidity.
- **Zodiac Delay modifier:** extra contracts, and cancelling needs a key the thief does not have.
- **ADR-013 (vault owned by the Spending Safe + Kit):** superseded. A thief holding the Spending Safe could drain the limit forever.
