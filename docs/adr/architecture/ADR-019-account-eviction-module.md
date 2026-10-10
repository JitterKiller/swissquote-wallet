# ADR-019: Account eviction — Candide recovery module on the Account, guardian = the Kit's second key

- **Status:** Accepted (spike C5 passed on 2026-10-10; PDR-018 accepted)
- **Date:** 2026-10-10
- **Amends:** [ADR-017](ADR-017-two-safe-account.md) (the Account also enables a recovery module and registers the Kit's guardian key), [ADR-018](ADR-018-recovery-kit-encryption-and-storage.md) (the Kit file carries a second encrypted key)
- **Related:** [PDR-014](../product/PDR-014-separation-of-powers.md), [PDR-018](../product/PDR-018-time-locked-eviction.md), [ADR-005](ADR-005-social-recovery-module.md), [ADR-007](ADR-007-swissquote-guardian-and-relayer.md), [ADR-011](ADR-011-no-custom-cryptography.md)

## Context

PDR-018 needs a delayed eviction of a stolen Key Safe that the thief cannot cancel, using only audited contracts. Facts:

- **Candide recovery module v0.0.1** (ADR-005):
  - a guardian cannot be an owner of the same Safe;
  - a new owner cannot be a guardian;
  - configuration and `cancelRecovery` require `msg.sender == wallet`;
  - `finalizeRecovery` is callable by anyone.
- **On the Account** (threshold 2, ADR-017), `msg.sender == Account` means an `execTransaction` with **2 owner signatures**. A thief holding only the Key Safe can neither cancel nor reconfigure.
- **The Kit owner key cannot also be the guardian** (module rule above). We need a second key.

## Decision

- **Modules.** Account setup (ADR-017) enables **two** modules through `SafeModuleSetup.enableModules`:
  - the Allowance Module;
  - a Candide recovery module: `After7Days` (`0x088f6cfD8BB1dDb1BB069CCb3fc1A98927D233f2`) at level 0, `After3Days` (`0x38275826E1933303E508433dD5f289315Da2541c`) at level 1, `After3Minutes` (`0x949d01d424bE050D09C16025dd007CB59b3A8c66`) in the demo.
- **Guardians.**
  - Level 0: the Kit's **guardian key**, threshold 1.
  - Level 1: guardian key + Swissquote Guardian (ADR-007), threshold 2.
  - An optional trusted contact is one more guardian on the same module.
- **Kit file.** It gains a second keystore, `guardianKeystore`:
  - keystore V3 via ethers, same passphrase (ADR-018);
  - two independent random keys, no derivation of our own (ADR-011).
- **Eviction flow:**
  1. The new device creates a passkey; the new Key Safe address is predicted.
  2. `newOwners = [newKeySafe, kitOwner, (hardware key proxy)]`, `newThreshold = 2`.
  3. The guardian key signs the EIP-712 `ExecuteRecovery` message (domain "Social Recovery Module", version `0.0.1`). At level 1, Swissquote co-signs after identity verification (PDR-006).
  4. The relayer calls `multiConfirmRecovery(account, newOwners, 2, signatures, execute = true)`, and alerts go out on every channel.
  5. During the delay, a cancel is only possible through `account.execTransaction(cancelRecovery())` signed by **2 factors**.
  6. The relayer calls `finalizeRecovery(account)`.
  7. **Handover**, in one new Key Safe UserOp: three `account.execTransaction` calls signed by the Kit (ECDSA) and the new Key Safe (`v = 1`):
     - `removeDelegate(oldKeySafe, true)`;
     - `addDelegate(newKeySafe)`;
     - `setAllowance(newKeySafe, USDC, limit, 1440, 0)`.
- **Moving the Account from level 0 to 1** takes 2-factor `execTransaction` calls:
  - disable the 7-day module, enable the 3-day module;
  - `addGuardianWithThreshold(guardianKey, 1)`, then `addGuardianWithThreshold(swissquote, 2)`.

  Guardians are stored per module, so they have to be registered again.
- **Code:**
  - eviction helpers in `web/src/lib/account.ts`;
  - Kit v3 with `guardianKeystore` in `web/src/lib/recoveryKit.ts`;
  - `ACCOUNT_RECOVERY_MODULE` by level in `web/src/lib/config.ts`;
  - route handlers `/api/eviction` and `/api/eviction/finalize`, mirroring `/api/recovery`.
- **Spike:** `scripts/spike-two-safe.mts` (`npm run spike:two-safe`), criteria C5a–C5e.

## Spike results (Base Sepolia, 2026-10-10)

`npm run spike:two-safe`, run twice, **9/9 checks passed both times**. Setup: simulated passkeys, test token `tUSD` (6 decimals, deterministic address `0xD6614edf5b73A25ce53C2bC6438dE6805A1eF7d1`), Account owners [Key Safe, Kit, hardware key], threshold 2, limit 100 tUSD/day. Links are from run 2 (Account `0xe22dd46dB9BA467BEd394DCd9331b07aCEabb589`).

| # | Check | Result |
|---|---|---|
| C3 (ADR-017) | Key Safe UserOp deploys the Account and runs 3 `account.execTransaction` signed by Kit ECDSA + `v = 1` | ✅ [tx](https://sepolia.basescan.org/tx/0x13a837658a4a5544786fc1d57d8dccd42c91e4d74fc06bfc5643d1e9f15e2732) |
| C1 (ADR-017) | Face ID alone spends 20 + 20 tUSD within the limit, with the SDK's `v = 1` delegate signature **and** with an empty signature | ✅ [tx 1](https://sepolia.basescan.org/tx/0x67a2fc9838d7b0b65f1927c30cf5d40cc158efeace6b036287e58c6a18ef8490), [tx 2](https://sepolia.basescan.org/tx/0x8f2b6e4f788e1e3402a09e12cf012805aed5ba5bc9cd22a34a451424ec1c904b) |
| C2 (ADR-017) | 70 tUSD with 60 left | ✅ refused: `newSpent > allowance.spent && newSpent <= allowance.amount` |
| C4 (ADR-017) | Relayer moves 500 tUSD with Kit ECDSA + hardware key WebAuthn contract signature (`v = 0`), no Key Safe | ✅ [tx](https://sepolia.basescan.org/tx/0x547845ab4eee61515041ddc76aed6f6b8f9d2965fefaa3b1a8727c2883ef1050) |
| C5a | The Kit's guardian key alone starts the eviction | ✅ [tx](https://sepolia.basescan.org/tx/0xf1f5b3afde2aa2112d3628db07614f86170440a3cfb2c702aead865e1e02e1e8) |
| C5b | The thief (Key Safe alone) tries to cancel | ✅ refused by the Safe: `GS020` (not enough signatures). Eviction still pending |
| C5c | The owner cancels with 2 factors (Face ID + Kit) | ✅ [tx](https://sepolia.basescan.org/tx/0x987b155b03cf3c65b21738cb46062274e2ec5fb85f1932d98a6c878110ca6894) |
| — | During the delay, the thief still draws the daily limit (10 tUSD): the residual risk of PDR-018 | ℹ️ [tx](https://sepolia.basescan.org/tx/0x650e483c98409c786841903befc5956b97f01f81be5f81241d4b44b2a6ababbb) |
| C5d | After the delay, `finalizeRecovery` (by anyone) replaces the stolen Key Safe: owners = new Key Safe, Kit, hardware key; threshold 2 | ✅ [tx](https://sepolia.basescan.org/tx/0xcb5b173a2cb0b654925c5f57226b97d71fc7241a7295592bf40b91757b16386b) |
| — | Handover: new Key Safe + Kit move the allowance (`removeDelegate`, `addDelegate`, `setAllowance`) in one UserOp | ✅ [tx](https://sepolia.basescan.org/tx/0x712f12dd44aff8505bc9064d5641ad6729fb223947f806464d6068377f183ddf) |
| C5e | The stolen Key Safe can no longer spend; the new phone spends 10 tUSD | ✅ refused: `newSpent > allowance.spent && newSpent <= allowance.amount` (allowance deleted); new phone [tx](https://sepolia.basescan.org/tx/0xb07e420185e9bf91a33482bf280d51fe1513451911101fd155b20b85075095a3) |

Things the run confirmed:

- **Both delegate signature forms work.** The SDK sends `v = 1` with `r = s = 0` by default, ADR-017 uses an empty signature, and the module reads `msg.sender` either way.
- **Contract addresses.** The Account is a plain Safe L2 v1.4.1 (`0x29fcB43b…C762`), created through the v1.4.1 proxy factory (`0x4e1DCf7A…ec67`), with the modules enabled by `SafeModuleSetup.enableModules` (`0x2dd68b00…5b47`).
- **The hardware key's verifier proxy needs no prior approval.** Its WebAuthn signature over the SafeTx EIP-712 digest is accepted as a `v = 0` contract signature.

## Consequences

- ✅ Only audited contracts. It reuses the module, the EIP-712 guardian flow, the relayer and the recovery UI patterns already built for the Key Safe.
- ✅ The thief can neither cancel nor reconfigure: every Account action needs 2 factors.
- ⚠️ `finalizeRecovery` does not touch the Allowance Module. The old Key Safe stays a delegate until the handover, so the new device must run the handover right after finalizing (automatically, in the app).
- ✅ Decided in PDR-021: the eviction is the single flow for a lost **or** stolen phone. In the target design the Key Safe no longer gets its own recovery module (amends ADR-017); the current Key Safe recovery stays in the code until the eviction UI ships.
- ⚠️ Decrypting two keystores doubles the scrypt time (about 2–4 s).

## Alternatives considered

- **The Kit owner key as guardian:** the module forbids a guardian that is also an owner.
- **Forking the module so an owner can be a guardian:** custom security-critical code (ADR-011).
- **Deriving the guardian key from the owner key:** a derivation scheme of our own (ADR-011). Two random keystores are simpler.
- **Zodiac Delay modifier:** extra contracts, and its cancel path needs the same 2-factor authority anyway.
