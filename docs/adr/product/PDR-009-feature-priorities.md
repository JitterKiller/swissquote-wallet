# PDR-009: Feature priorities for the rest of the hackathon

- **Status:** Accepted, build order amended by [PDR-014](PDR-014-separation-of-powers.md)
- **Date:** 2026-10-10
- **Related:** [PDR-010](PDR-010-handle-transfers-verified-payee.md), [PDR-011](PDR-011-vault-daily-limit.md), [ADR-013](../architecture/ADR-013-vault-allowance-module.md)

## Context

The core lifecycle (create → sign → lose access → recover) works end to end on Base Sepolia. Most teams will converge on the same stack (Safe, passkeys, paymaster, guardians), so the remaining time must go to what scores and what sets us apart.

The jury scores technical implementation (35), security and custody design (20), legal feasibility (15), business case (15), user experience and pitch (15), plus up to 20 bonus points for gasless transactions and compliant dApp interaction, counted only if the core works end to end.

## Decision

**Ranking**, by weight in the score and by differentiation:

| # | Feature | Status | Effort left |
|---|---|---|---|
| 1 | Recovery that tells the owner from an attacker (PDR-004, PDR-006) | ✅ | — |
| 2 | Swissquote can never move, freeze or censor funds, verifiable on-chain (PDR-001) | ✅ | Pitch: slide + QR code to the Safe on Basescan |
| 3 | Passkeys, no seed phrase (PDR-002) | ✅ | — |
| 4 | Transfer between the Swissquote account and the wallet, with FINMA proof of ownership | ⏳ | Low |
| 5 | `@handle` transfers with verified payee and privacy by design (PDR-010) | ⏳ | Low |
| 6 | Compliance as friction: sanctions screening, readable transaction preview, high-value checks, approved dApps | ⏳ | Medium |
| 7 | Gasless USDC (PDR-003) | ✅ | — |
| 8 | Vault with a daily limit (PDR-011, ADR-013) | ⏳ | Medium |
| 9 | Third guardian (trusted contact), also used for inheritance | ⏳ | Low to medium |
| 10 | Bitcoin | Roadmap | Pitch slide only |

**Build order** (differs from the ranking, cheapest enablers first):

1. Wallet registry (client → handle → wallet address → proof of ownership). One table in the mock backend, shared by items 4 and 5.
2. Transfer between the Swissquote account and the wallet (item 4). Also removes the faucet from the demo.
3. `@handle` transfers (item 5).
4. Compliance (item 6). Start with sanctions screening when an address or handle is resolved, then the approved-dApp list if time allows.
5. Vault (item 8). Start with the time-boxed spike defined in ADR-013.
6. Third guardian and inheritance (item 9).

**Cut line:** if time runs short, drop from the bottom of the build order. Items 1 to 4 cover every scored criterion plus our differentiator. A dropped vault becomes a residual-risk row in the threat-model slide.

**Dropped:** including self-custodied crypto in the Swissquote tax statement. Distinctive, but it earns no direct points and the time is better spent on the vault.

## Consequences

- ✅ Everyone on the team (and every AI assistant) works on the same next item.
- ✅ The pitch leads with what others are unlikely to have: on-chain proof that Swissquote has no control, an attack scenario backed by e2e tests, verified `@handle` payments.
- ⚠️ Revisit this ranking if a feature turns out much more expensive than estimated.

## Alternatives considered

- **Polish the core only**: safe, but indistinguishable from other teams.
- **Bonus features first**: bonus points only count if the core works, and gasless is already done.
