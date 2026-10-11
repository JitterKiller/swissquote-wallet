# PDR-025: Compliant dApp interaction — a short list of approved dApps, built natively, 2 factors

- **Status:** Accepted, amended by [PDR-028](PDR-028-swaps.md) (a swap venue joins the approved list)
- **Date:** 2026-10-10
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-014](PDR-014-separation-of-powers.md), [PDR-019](PDR-019-offer-tiers.md), [PDR-023](PDR-023-compliance-as-friction.md), [ADR-028](../architecture/ADR-028-approved-dapps-native-integration.md), issue #25

## Context

- The bonus criterion asks for "compliant dApp interaction". PDR-023 covers screening, a readable preview with simulation and high-value checks for payments; dApps were left open.
- A dApp call is not a payment: it grants allowances and moves funds into a contract whose risks the client may not see. Drainer approvals are one of the most common losses in self-custody.
- The two-Safe Account (PDR-014, ADR-017): Face ID alone can only send USDC within the daily limit. Any other call leaves the Account with 2 factors.
- WalletConnect would open any dApp, but needs a third-party project and gives the wallet no say over which dApps a client meets.

## Decision

- **A short list of approved dApps, integrated natively.** The wallet itself builds the calls for each approved protocol; it does not connect to arbitrary dApp front-ends. First list (Base Sepolia, Circle USDC): **Aave v3** and **Compound III** (USDC lending: "earn"). The list is curated by Swissquote (audits, track record, legal review) and shown with each protocol's risks.
- **Every dApp action needs 2 factors: Face ID + the Kit passphrase.** A protocol call is not covered by the daily limit, so a thief with the unlocked phone cannot approve a drainer or move funds into a protocol.
- **Before Face ID, the same checks as a payment (PDR-023):** a readable preview of each step (allow X to spend N USDC, supply N USDC to Aave), a simulation, and screening of the contracts.
- **Swissquote only sponsors calls to approved dApp contracts.** Calls to any other contract are not sponsored, with a clear message. It stays friction, not a veto (PDR-001, PDR-023): the client can still pay gas, or leave through the eviction.
- **Withdrawing from an approved dApp back to the Account** follows the same rule (2 factors), so funds only ever return to the Account.
- **No custody, no Swissquote yield product:** the client lends directly to the protocol from their Account; Swissquote neither holds the position nor promises a return.

## Consequences

- ✅ Covers the "compliant dApp interaction" bonus with a concrete, demonstrable flow: allowlist, preview, simulation, screening, 2 factors, sponsorship policy.
- ✅ Closes the approval-drainer risk for Swissquote's clients.
- ✅ A familiar "earn" product for bank clients, without Swissquote taking custody.
- ⚠️ Fewer dApps than an open wallet. Opening more (WalletConnect, with the same allowlist and 2-factor rule) is roadmap.
- ⚠️ Protocol risk (smart contract, liquidity) stays with the client and must be disclosed; legal review needed before production (no investment advice, FINMA).
- ⚠️ Testnet protocols do not pay meaningful yield; the demo shows the mechanism, not returns.

## Alternatives considered

- **WalletConnect to any dApp:** maximal reach, but needs a third-party project, and the wallet cannot vet the dApps its clients use. Roadmap, behind the same allowlist.
- **Within the daily limit with Face ID alone:** the Allowance Module only moves tokens to an address; a protocol call needs the Account, so 2 factors anyway. It is also the safer rule.
- **Swissquote-wrapped yield product:** would make Swissquote a custodian or an issuer (PDR-001).
