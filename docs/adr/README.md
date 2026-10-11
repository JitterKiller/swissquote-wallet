# Decision records

Why the project is built the way it is. Read the relevant record **before** changing the product behaviour, the architecture, the custody model, recovery or anything cryptographic, and before prompting an AI assistant for a non-trivial change.

## Current design in one paragraph

A **Safe smart account** (ERC-4337) on **Base Sepolia**, owned by a **passkey** (Face ID / Touch ID). Gas is always **sponsored**, so users never hold ETH. **Recovery** needs two guardians, the client's **Recovery Kit** and the **Swissquote Guardian** (which approves only after identity verification). After their approval comes a **delay**, during which the current owner can **cancel**. When the delay ends, the owner is replaced by a new passkey: same address, same funds. Swissquote alone can never move funds or recover a wallet. Banking, KYC and the HSM are **mocked** in a small backend inside the Next.js app.

## Target design (decided, being built)

**The user always holds the majority, Swissquote never does** (PDR-013). Funds move to an **Account Safe** whose owners are only the user's factors: the **Key Safe** (today's passkey Safe, which holds no funds), the **Recovery Kit** (a passphrase-encrypted cloud backup, PDR-016) and, optionally, a **hardware key** (PDR-017). Threshold 2. Face ID alone can only spend up to a **daily limit**; anything else needs 2 factors, so a thief with an unlocked phone cannot empty the account or block anything on it (PDR-014, ADR-017). The user chooses the limit (PDR-020). A **lost or stolen phone** goes through one flow: the Kit evicts it after **7 days** (3 days for linked clients, immediately with a hardware key), and the thief cannot cancel (PDR-018, PDR-021, ADR-019). The wallet is **open to everyone** (level 0), and linking a Swissquote account is the upgrade (level 1, PDR-015). Swissquote is **never an owner**. **Shipped so far:** the Account at onboarding (#10), Overview and Send on the Account (#11, #12), the "Phone lost or stolen?" lock-out with the alert and 2-factor stop on the old phone (#15, #16, ADR-030), Earn (#25, ADR-031), Swap (PDR-028, ADR-032), the Security page (#26, ADR-034), the daily limit change (#13, ADR-035), the level 1 upgrade (#21, ADR-036), the security key with the immediate lock-out (#17, ADR-038) and the Offers page with the upgrade funnel (#22, ADR-039). The legacy Key Safe recovery described above stays reachable until #33.

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
| [PDR-003](product/PDR-003-gasless-by-default.md) | Gasless by default: users never need ETH | Accepted, refined by PDR-015 and PDR-019 |
| [PDR-004](product/PDR-004-recovery-policy.md) | Recovery: Recovery Kit + Swissquote, 2 of 2, delay with owner veto | Superseded by PDR-021 (target design; still in the code) |
| [PDR-005](product/PDR-005-recovery-kit.md) | Recovery Kit: client-held offline factor, never stored by the app | Superseded by PDR-016 |
| [PDR-006](product/PDR-006-identity-verification-before-guardian-approval.md) | Identity verification before Swissquote approves a recovery | Accepted |
| [PDR-007](product/PDR-007-prototype-scope-real-vs-mocked.md) | Prototype scope: real on-chain, mocked banking | Accepted |
| [PDR-008](product/PDR-008-english-ui-copy.md) | English UI copy and documentation | Accepted |
| [PDR-009](product/PDR-009-feature-priorities.md) | Feature priorities and build order for the rest of the hackathon | Accepted, build order amended by PDR-014 |
| [PDR-010](product/PDR-010-handle-transfers-verified-payee.md) | `@handle` transfers between Swissquote clients, with verified payee and privacy by design | Accepted |
| [PDR-011](product/PDR-011-vault-daily-limit.md) | Vault with a daily limit: protect funds, not only access | Superseded by PDR-014 |
| [PDR-012](product/PDR-012-web-first-banking-ux.md) | Web-first, online-banking-grade UX (app shell, review before signing, security transparency) | Accepted |
| [PDR-013](product/PDR-013-key-management-user-majority.md) | Key management: passkey + smart account, the user always holds the majority (comparison of MPC, passkeys, ERC-4337, seed, SLIP-39) | Accepted |
| [PDR-014](product/PDR-014-separation-of-powers.md) | Separation of powers: Face ID spends up to a daily limit, 2 user factors for everything else | Accepted, amended by PDR-018, PDR-020, PDR-021 |
| [PDR-015](product/PDR-015-open-wallet-and-levels.md) | Open wallet for everyone (level 0), the Swissquote link as the upgrade (level 1), acquisition funnel | Accepted, amended by PDR-018, PDR-020, PDR-021; refined by PDR-019 |
| [PDR-016](product/PDR-016-recovery-kit-encrypted-cloud-backup.md) | Recovery Kit as a passphrase-encrypted cloud backup | Accepted |
| [PDR-017](product/PDR-017-theft-protection-hardware-key.md) | "Theft protection" offer: hardware key as third factor, guided "phone stolen" flow | Accepted, amended by PDR-018, PDR-020; refined by PDR-019 |
| [PDR-018](product/PDR-018-time-locked-eviction.md) | Time-locked eviction: the Kit locks a stolen phone out after 7 days (level 0) / 3 days (level 1), the thief cannot cancel | Accepted (amends PDR-014, PDR-015, PDR-017) |
| [PDR-019](product/PDR-019-offer-tiers.md) | Offer in three tiers: free, linked client, Premium "Theft protection" for linked clients (speed, comfort, insurance; never basic security); self-service hardware key at every level; security operations always sponsored | Accepted (refines PDR-003, PDR-015, PDR-017; prices to model) |
| [PDR-020](product/PDR-020-daily-limit-chosen-by-user.md) | The daily limit is chosen by the user, same rules at every level (no limit per level, no limit perk) | Accepted |
| [PDR-021](product/PDR-021-one-flow-lost-or-stolen-phone.md) | One flow for a lost or stolen phone: the Account eviction (replaces the Key Safe recovery) | Accepted |
| [PDR-022](product/PDR-022-wallet-registry-ownership-proof.md) | Wallet registry for linked clients; proof of ownership = one Face ID on an EIP-712 statement (FINMA travel rule) | Accepted |
| [PDR-023](product/PDR-023-compliance-as-friction.md) | Compliance as friction: sanctions screening, readable preview with simulation, high-value and look-alike checks | Accepted |
| [PDR-024](product/PDR-024-swissquote-account-transfers.md) | Transfers between the Swissquote account and the wallet: one tap each way, deposits auto-credited from the linked wallet, travel rule filled in | Accepted |
| [PDR-025](product/PDR-025-approved-dapps.md) | Compliant dApp interaction: a short list of approved dApps (Aave v3, Compound III) built natively, 2 factors, preview and screening, sponsored only when approved | Accepted, amended by PDR-028 |
| [PDR-026](product/PDR-026-product-name-squre.md) | Product name: SQure (by Swissquote), "Your keys. Swiss security." | Accepted, amended by PDR-027 |
| [PDR-027](product/PDR-027-logo-two-square-mark.md) | Logo: the two-square mark (orange square = phone, ink square = Kit), "SQure" in one piece, the mark as app icon | Accepted, amended by ADR-037 |
| [PDR-028](product/PDR-028-swaps.md) | Swaps: USDC ↔ EURC and USDC ↔ ETH (held as WETH) at Uniswap v3, from the Account, 2 factors, exact approval, at least the minimum (0.5% slippage) or nothing happens; honest amounts (exact when signed, never rounded up) | Accepted (amends PDR-025) |

## Architecture decisions

| ID | Decision | Status |
|---|---|---|
| [ADR-001](architecture/ADR-001-safe-smart-account.md) | Safe smart account via abstractionkit (`SafeMultiChainSigAccountV1`, EntryPoint v0.9) | Accepted |
| [ADR-002](architecture/ADR-002-passkey-signing-safe-webauthn.md) | Passkey signing through Safe's WebAuthn signer (shared signer → verifier proxy) | Accepted |
| [ADR-003](architecture/ADR-003-network-base-sepolia.md) | Base Sepolia + Circle testnet USDC | Accepted |
| [ADR-004](architecture/ADR-004-bundler-and-paymaster.md) | Candide public bundler + ERC-7677 paymaster | Accepted, amended by ADR-023 |
| [ADR-005](architecture/ADR-005-social-recovery-module.md) | Candide Social Recovery Module **v0.0.1** | Accepted, amended by ADR-019 |
| [ADR-006](architecture/ADR-006-recovery-target-verifier-proxy.md) | Recovery target = new passkey's verifier proxy, deployed in the request UserOp | Superseded by ADR-019 (target design; still in the code) |
| [ADR-007](architecture/ADR-007-swissquote-guardian-and-relayer.md) | Swissquote Guardian key + relayer Safe (mock HSM) | Accepted |
| [ADR-008](architecture/ADR-008-mock-backend.md) | Mock backend: Next.js route handlers + JSON file store | Accepted, amended by ADR-020 |
| [ADR-009](architecture/ADR-009-client-storage-public-data-only.md) | Client storage: public data only | Accepted, amended by ADR-015 and ADR-018 |
| [ADR-010](architecture/ADR-010-frontend-nextjs-client-only.md) | Next.js 16, client-only wallet UI, Tailwind v4 | Partially superseded by ADR-014 |
| [ADR-011](architecture/ADR-011-no-custom-cryptography.md) | No custom cryptography | Accepted |
| [ADR-012](architecture/ADR-012-testing-real-chain-real-webauthn.md) | Testing on the real chain with real Chrome WebAuthn | Accepted |
| [ADR-013](architecture/ADR-013-vault-allowance-module.md) | Vault: second Safe + Safe Allowance Module, the Spending Safe as delegate | Superseded by ADR-017 |
| [ADR-014](architecture/ADR-014-routing-and-wallet-state.md) | Route groups `(wallet)` / `(onboarding)` + shared `WalletProvider` | Accepted |
| [ADR-015](architecture/ADR-015-activity-from-chain-logs.md) | Activity read from on-chain USDC Transfer logs | Accepted, amended by ADR-029 and ADR-032 |
| [ADR-016](architecture/ADR-016-design-system.md) | Design system: Tailwind tokens + in-house component kit | Accepted, amended by ADR-027 |
| [ADR-017](architecture/ADR-017-two-safe-account.md) | Two-Safe account: Account Safe (user factors, threshold 2) + Key Safe with a daily allowance | Accepted (spike C1–C4 passed on 2026-10-10), amended by ADR-019 |
| [ADR-018](architecture/ADR-018-recovery-kit-encryption-and-storage.md) | Recovery Kit: Ethereum keystore V3 via ethers, cloud + local encrypted copies | Accepted, amended by ADR-019 |
| [ADR-019](architecture/ADR-019-account-eviction-module.md) | Account eviction: Candide recovery module on the Account, guardian = the Kit's second key | Accepted (spike C5 passed; amends ADR-017, ADR-018) |
| [ADR-020](architecture/ADR-020-deployment-vercel-upstash.md) | Deployment: Vercel + Upstash Redis behind an async `store()`, one fixed demo domain (passkey rpId) | Accepted |
| [ADR-021](architecture/ADR-021-wallet-registry.md) | Wallet registry: passkey-signed EIP-712 statement, verified with ox + on-chain owner checks | Accepted |
| [ADR-022](architecture/ADR-022-compliance-checks.md) | Compliance checks: server screening (mock list + optional Chainalysis), client preview, look-alike and high-value warnings | Accepted, amended by ADR-031 and ADR-032 |
| [ADR-023](architecture/ADR-023-sponsorship-policy-proxy.md) | Sponsorship policy: ERC-7677 paymaster proxy (quota, security operations, sanctions, stolen-device reports) | Accepted, amended by ADR-028 |
| [ADR-024](architecture/ADR-024-handle-directory.md) | `@handle` directory: exact-match resolution for linked clients, visibility and contacts, `RecipientField`, MOCK session | Accepted |
| [ADR-025](architecture/ADR-025-swissquote-transfers.md) | Swissquote account transfers: treasury = relayer Safe, deposits verified from on-chain logs, MOCK balances | Accepted |
| [ADR-026](architecture/ADR-026-transitional-legacy-key-safe-recovery.md) | Transitional: the protect flow keeps the legacy Key Safe recovery (same Kit guardian key) until the eviction flow ships | Accepted (temporary, #33) |
| [ADR-027](architecture/ADR-027-visual-world-swiss-onchain-fintech.md) | Visual world: Swiss onchain fintech (white, ink, one Swissquote orange, sealed ink plates), recorded in DESIGN.md through impeccable | Accepted, amended by ADR-037 |
| [ADR-028](architecture/ADR-028-approved-dapps-native-integration.md) | Approved dApps: native call builders (`lib/dapps.ts`), 2-factor Account transactions, paymaster allowlist | Accepted, amended by ADR-032 |
| [ADR-029](architecture/ADR-029-approval-route-from-chain-events.md) | Activity shows which factors approved each payment (Face ID alone vs Face ID + Kit), read from the Allowance Module's `ExecuteAllowanceTransfer` events | Accepted |
| [ADR-030](architecture/ADR-030-lost-phone-flow-ui.md) | "Phone lost or stolen?" in the app: `/lost` on the new phone (Kit, Face ID, lock-out, live countdown, takeover in one action), red alert and 2-factor stop on the old phone, "Demo: try with Face ID only" refused (GS020), `npm run e2e:eviction` | Accepted, amended by ADR-037 |
| [ADR-031](architecture/ADR-031-earn-screen.md) | Earn screen: positions plate, approved-protocol cards, 2-factor review with risk acknowledgement, "Demo: try an unlisted dApp" (paymaster refusal), chained simulation (eth_simulateV1), `npm run e2e:earn` | Accepted, amended by ADR-032 and ADR-037 |
| [ADR-032](architecture/ADR-032-swaps-and-assets.md) | Swaps and multi-asset balances: `lib/assets.ts`, `lib/swap.ts` (QuoterV2 best fee tier, SwapRouter02 in one 2-factor UserOp), one approved-contracts registry, exact amounts and `formatDecimal`, swaps in Activity, `npm run e2e:swap` | Accepted (amends ADR-015, ADR-022, ADR-028, ADR-031), amended by ADR-037 |
| [ADR-033](architecture/ADR-033-input-filtering.md) | Text fields accept only what the app accepts (`lib/inputs.ts`: amounts, `@handle`, recipient, names; passphrases free), and the payment request link fills Send | Accepted |
| [ADR-034](architecture/ADR-034-security-page.md) | Security page for the two-Safe Account: owners read live onchain with "Swissquote · not an owner" on Basescan, shared worst-case block, powers × parties matrix and scenarios, limit / key / level slots "Soon" (#26) | Accepted, amended by ADR-035, ADR-036 and ADR-038 |
| [ADR-035](architecture/ADR-035-daily-limit-change.md) | Daily limit change (#13): panel on the Security page, shared `LimitPicker`, worst case before → after, sealed 2-of-2 review, Face ID + Kit in one sponsored UserOp, "Change" from the Overview meter, `npm run e2e:limit` | Accepted (amends ADR-034), amended by ADR-037 |
| [ADR-036](architecture/ADR-036-level-1-upgrade.md) | Level 1 upgrade (#21): panel on the Security page and call on /swissquote, worst case before → after and what Swissquote can / never can do, Face ID + Kit add Swissquote's guardian; rule panels and the Swissquote link follow Next 16's Activity, `npm run e2e:level` | Accepted (amends ADR-034), amended by ADR-037 and ADR-039 |
| [ADR-037](architecture/ADR-037-ui-refinements-no-seal-4px-tab-bar-chart.md) | UI refinements: no seal on ink plates (approval squares instead), 4px buttons, phone tab bar with More, Overview balance chart from on-chain transfers, one custody vocabulary, phone polish | Accepted |
| [ADR-038](architecture/ADR-038-security-key.md) | Security key (#17): a third Account owner through Safe's WebAuthn verifier, added with Face ID + Kit (the wallet's own passkey refused); with the Kit it locks a lost phone out at once, also while a lock-out runs (cancelled in the same transaction), relayed by `/api/evict-now`; Key column in the powers matrix, `npm run e2e:key` | Accepted |
| [ADR-039](architecture/ADR-039-offers-page.md) | Offers page and the upgrade funnel (#22, #21): comparison table at `/offers` (your column outlined, worst case from your limit, what your own key does in every offer, "Soon" for what isn't built), MOCK Premium in `store()` (`/api/offers`), one trigger after the first Kit payment on Send, the sidebar reads the link, quota and protect-flow calls to link | Accepted (amends ADR-036) |

## Open questions (future records)

| Topic | Kind | Notes |
|---|---|---|
| Trusted contact as an Account guardian (arbiter), and inheritance | PDR + ADR | Breaks the phone-theft tie and the lost-Kit case without a hardware key (PDR-014). Inheritance: Swissquote checks the certificate of inheritance. Build step 8 in PDR-014 |
| Routing a `@handle` payment to the recipient's Swissquote account when they have no wallet | PDR | Needs legal validation: FINMA Guidance 02/2019 restricts transfers with external wallets to the client's own wallets (PDR-010) |
| React Native app | ADR | Associated domains to share passkeys with the web app |
| Bitcoin implementation | ADR | Rule decided in PDR-013: native 2-of-3 multisig with a timelocked recovery path (miniscript), user majority. Pitch slide only |
| Cut the daily allowance automatically when a recovery starts | ADR | Bitkey does it. Here it needs a custom contract (PDR-014) |
| Rotating a lost Kit without a hardware key | PDR + ADR | Needs 2 factors. Today only the slow exit through the daily limit remains (PDR-014) |
| Kit unlocked by a short PIN through distributed, guess-limited storage (Juicebox / TOPRF) | PDR + ADR | Roadmap (PDR-016) |
| Insurance partner for the capped theft loss | PDR | PDR-017 |

## How to add or change a decision

1. Copy [`_template.md`](_template.md) into `product/` or `architecture/`, using the next free number in that folder (e.g. `PDR-0xx-short-title.md`, `ADR-0xx-short-title.md`).
2. Fill in Context / Decision / Consequences / Alternatives, and link the related records.
3. Add a row to the matching table above.
4. **Never rewrite an accepted record.** To change a decision, write a new record, then set the old one's status to `Superseded by ADR-0xx`.

Statuses: `Proposed` → `Accepted` → (`Superseded by …` | `Deprecated`).
