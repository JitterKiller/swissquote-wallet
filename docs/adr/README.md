# Decision records

Why the project is built the way it is. Read the relevant record **before** changing the product behaviour, the architecture, the custody model, recovery or anything cryptographic, and before prompting an AI assistant for a non-trivial change.

## Current design in one paragraph

A **Safe smart account** (ERC-4337) on **Base Sepolia**, owned by a **passkey** (Face ID / Touch ID). Gas is always **sponsored**, so users never hold ETH. **Recovery** needs two guardians, the client's **Recovery Kit** and the **Swissquote Guardian** (which approves only after identity verification). After their approval comes a **delay**, during which the current owner can **cancel**. When the delay ends, the owner is replaced by a new passkey: same address, same funds. Swissquote alone can never move funds or recover a wallet. Banking, KYC and the HSM are **mocked** in a small backend inside the Next.js app.

## Two kinds of records

| Folder | Prefix | Answers | Examples |
|---|---|---|---|
| [`product/`](product/) | **PDR** (Product Decision Record) | *What* we build and *why*, for users, the business or regulation | custody model, recovery policy, gasless UX, scope of mocks |
| [`architecture/`](architecture/) | **ADR** (Architecture Decision Record) | *How* it is built | smart account, network, contracts, backend, storage, tests |

A product decision usually has one or more architecture decisions implementing it. Each record links to the related ones.

## Product decisions

| ID | Decision | Status |
|---|---|---|
| [PDR-001](product/PDR-001-non-custodial-model.md) | Non-custodial: Swissquote is a guardian, never a custodian | Accepted |
| [PDR-002](product/PDR-002-passkeys-instead-of-seed-phrases.md) | Passkeys instead of seed phrases | Accepted |
| [PDR-003](product/PDR-003-gasless-by-default.md) | Gasless by default: users never need ETH | Accepted |
| [PDR-004](product/PDR-004-recovery-policy.md) | Recovery: Recovery Kit + Swissquote, 2 of 2, delay with owner veto | Accepted |
| [PDR-005](product/PDR-005-recovery-kit.md) | Recovery Kit: client-held offline factor, never stored by the app | Accepted |
| [PDR-006](product/PDR-006-identity-verification-before-guardian-approval.md) | Identity verification before Swissquote approves a recovery | Accepted |
| [PDR-007](product/PDR-007-prototype-scope-real-vs-mocked.md) | Prototype scope: real on-chain, mocked banking | Accepted |
| [PDR-008](product/PDR-008-english-ui-copy.md) | English UI copy and documentation | Accepted |

## Architecture decisions

| ID | Decision | Status |
|---|---|---|
| [ADR-001](architecture/ADR-001-safe-smart-account.md) | Safe smart account via abstractionkit (`SafeMultiChainSigAccountV1`, EntryPoint v0.9) | Accepted |
| [ADR-002](architecture/ADR-002-passkey-signing-safe-webauthn.md) | Passkey signing through Safe's WebAuthn signer (shared signer → verifier proxy) | Accepted |
| [ADR-003](architecture/ADR-003-network-base-sepolia.md) | Base Sepolia + Circle testnet USDC | Accepted |
| [ADR-004](architecture/ADR-004-bundler-and-paymaster.md) | Candide public bundler + ERC-7677 paymaster | Accepted |
| [ADR-005](architecture/ADR-005-social-recovery-module.md) | Candide Social Recovery Module **v0.0.1** | Accepted |
| [ADR-006](architecture/ADR-006-recovery-target-verifier-proxy.md) | Recovery target = new passkey's verifier proxy, deployed in the request UserOp | Accepted |
| [ADR-007](architecture/ADR-007-swissquote-guardian-and-relayer.md) | Swissquote Guardian key + relayer Safe (mock HSM) | Accepted |
| [ADR-008](architecture/ADR-008-mock-backend.md) | Mock backend: Next.js route handlers + JSON file store | Accepted |
| [ADR-009](architecture/ADR-009-client-storage-public-data-only.md) | Client storage: public data only | Accepted |
| [ADR-010](architecture/ADR-010-frontend-nextjs-client-only.md) | Next.js 16, client-only wallet UI, Tailwind v4 | Accepted |
| [ADR-011](architecture/ADR-011-no-custom-cryptography.md) | No custom cryptography | Accepted |
| [ADR-012](architecture/ADR-012-testing-real-chain-real-webauthn.md) | Testing on the real chain with real Chrome WebAuthn | Accepted |

## Open questions (future records)

| Topic | Kind | Notes |
|---|---|---|
| Third guardian (trusted contact or YubiKey passkey), making recovery 2 of 3 | PDR + ADR | So that losing the Recovery Kit is not fatal |
| Compliance layer: SECO/OFAC sanctions screening, transaction simulation, approved-dApp list, high-value checks | PDR + ADR | Off-chain check or on-chain Safe guard? Must stay friction, not a veto (PDR-001) |
| Wallet registry + proof of ownership (EIP-1271 signed message) | PDR + ADR | Needed for FINMA travel-rule transfers between the Swissquote account and the wallet |
| Mock "transfer from my Swissquote account" | PDR | Avoids the faucet during the demo |
| `@handle` transfers between Swissquote clients | PDR | Privacy: a handle reveals the address and its history |
| Demo domain | ADR | Passkeys are bound to their domain (rpId) |
| React Native app | ADR | Associated domains to share passkeys with the web app |
| Bitcoin | PDR | Roadmap story for the pitch |

## How to add or change a decision

1. Copy [`_template.md`](_template.md) into `product/` or `architecture/`, using the next number in that folder: `PDR-009-short-title.md`, `ADR-013-short-title.md`.
2. Fill in Context / Decision / Consequences / Alternatives, and link the related records.
3. Add a row to the matching table above.
4. **Never rewrite an accepted record.** To change a decision, write a new record, then set the old one's status to `Superseded by ADR-0xx`.

Statuses: `Proposed` → `Accepted` → (`Superseded by …` | `Deprecated`).
