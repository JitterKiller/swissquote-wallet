# ADR-001: Smart account — Safe via abstractionkit (`SafeMultiChainSigAccountV1`, EntryPoint v0.9)

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-001](../product/PDR-001-non-custodial-model.md), [PDR-002](../product/PDR-002-passkeys-instead-of-seed-phrases.md), [PDR-003](../product/PDR-003-gasless-by-default.md), [PDR-004](../product/PDR-004-recovery-policy.md)

## Context

The product decisions need an account that is owned by a passkey (P-256), can rotate its owner without changing address, supports guardian recovery, and can have its gas sponsored. A plain Ethereum account (EOA) can do none of these.

## Decision

- **Safe** with the **Safe 4337 module**, driven by Candide's **`abstractionkit`** (v0.4.x).
- We use the class `SafeMultiChainSigAccountV1`, which targets EntryPoint v0.9 at `0x433709009B8330FDa32311DF1C2AFA402eD8D009`.
- The address is deterministic from the owners (`createAccountAddress`), so it is known before deployment. The first UserOp deploys the Safe.
- Before a Safe is deployed, `sendCalls` uses `initializeNewAccount([passkey])`. Once deployed, it uses `new SafeAccount(address)`.

## Consequences

- ✅ Battle-tested Safe contracts, plus audited modules for passkeys and social recovery.
- ✅ The owner can be replaced on the same address, which is what makes recovery possible.
- ⚠️ EVM only. Bitcoin (a large share of Swissquote clients' crypto) would need another design: miniscript/Taproot multisig with timelocks, or MPC. Roadmap item.

## Alternatives considered

- **Coinbase Smart Wallet**: native passkeys, but no recovery module.
- **ZeroDev Kernel**: viable, but its recovery support is less turnkey.
- **MPC/TSS**: works across chains, but is complex to build and to demonstrate.
- **EOA + EIP-7702**: the EOA's root key stays all-powerful and cannot be rotated, so recovery cannot revoke it.
