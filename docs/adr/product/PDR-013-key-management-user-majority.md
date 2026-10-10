# PDR-013: Key management — passkey + smart account, and the user always holds the majority

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-002](PDR-002-passkeys-instead-of-seed-phrases.md), [PDR-014](PDR-014-separation-of-powers.md), [PDR-016](PDR-016-recovery-kit-encrypted-cloud-backup.md), [PDR-017](PDR-017-theft-protection-hardware-key.md), [ADR-017](../architecture/ADR-017-two-safe-account.md)

## Context

The challenge lists MPC / threshold signatures, passkeys and WebAuthn, ERC-4337 smart accounts, seed phrases, and split backups (Shamir, SLIP-39). The jury expects a clear, defended custody model.

These are not five alternatives. They sit at three layers of a wallet:

| Layer | Question | Options |
|---|---|---|
| **Key** | Who signs? | Seed (one key), MPC/TSS (key split between parties), passkey (hardware-bound key) |
| **Account** | Who sets the rules? | Plain account (EOA) vs ERC-4337 smart account (several keys, limits, recovery, sponsored gas) |
| **Backup** | How do you get back in? | Paper seed, Shamir/SLIP-39, encrypted cloud backup, guardians |

Under Swiss practice, a wallet is non-custodial only if the provider has no power of disposal over the assets and cannot influence transactions (FINMA practice as described by MME, 2020). We found no FINMA rule specific to MPC.

## Decision

**One rule on every chain:** the user alone holds a signing majority. Swissquote never reaches a majority, alone or together with a party it controls or chooses. The user can always move funds without Swissquote.

- **EVM (prototype):** passkey (daily factor) + Safe ERC-4337 smart account with on-chain rules (PDR-014, ADR-017) + passphrase-encrypted Recovery Kit (PDR-016) + optional hardware key (PDR-017).
- **Bitcoin (roadmap, pitch only):** the same rule through a native 2-of-3 multisig with a timelocked recovery path (miniscript), as Bitkey and Liana do. MPC/FROST is acceptable later only if the user holds the majority.
- **MPC with a mandatory Swissquote share is rejected.** It puts Swissquote in every transaction.

**Comparison** (scores 1–5, weights are ours, based on the jury grid and a bank's priorities):

| Criterion (weight) | Seed (+SLIP-39) | MPC 2-of-3 with Swissquote | Passkey Safe, single owner (current) | Separation of powers (PDR-014) | + hardware key |
|---|---|---|---|---|---|
| Self-custody, legal clarity (20) | 5 | 3 | 5 | 5 | 5 |
| Phone or backup theft (20) | 1 | 5 | 1 | 3 | 5 |
| Recovery (15) | 2 | 4 | 4 | 4 | 5 |
| Daily UX (15) | 1 | 5 | 5 | 4 | 4 |
| Asset coverage, Bitcoin (10) | 5 | 5 | 2 | 2 | 2 |
| Compliance, on-chain verifiability (10) | 1 | 3 | 4 | 5 | 5 |
| Operations and maturity (5) | 5 | 2 | 3 | 3 | 3 |
| Hackathon feasibility (5) | 5 | 1 | 5 | 3 | 3 |
| **Total /100** | **55** | **78** | **71** | **76** | **87** |

## Consequences

- ✅ Legal clarity: Swissquote has no power of disposal and takes no part in transactions.
- ✅ Verifiable: anyone can read the Safe's owners and threshold on-chain. MPC share distribution cannot be checked from outside.
- ✅ Only audited contracts and established libraries (ADR-011). MPC implementations have a history of key-extraction bugs (BitForge, TSSHOCK), some in audited code.
- ⚠️ EVM only in the prototype. Bitcoin is a roadmap slide.
- ⚠️ MPC scores well on theft and coverage, but only because Swissquote co-signs every transaction, which this record rejects.

## Alternatives considered

- **Seed phrase:** the main source of lost funds, and exactly what bank clients do not want to manage.
- **Shamir / SLIP-39:** improves backup durability, but the full key is rebuilt in one place at recovery (the Ledger Recover backlash). Kept as an optional way to split the Kit later.
- **MPC 2-of-2 with Swissquote (Zengo model):** Swissquote can block. Zengo had to add an escrow-based "Guaranteed Access" in case it shut down.
- **MPC 2-of-3 with Swissquote as a co-signer:** same power distribution as Swissquote being a co-owner. Not self-custody in spirit, and a grey zone legally.
- **EOA + EIP-7702:** the root key stays all-powerful and cannot be rotated (ADR-001).
