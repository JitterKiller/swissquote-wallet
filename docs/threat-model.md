# Threat model — Swissquote self-custody wallet

Issue #32. Design: [PDR-013](adr/product/PDR-013-key-management-user-majority.md) (user majority), [PDR-014](adr/product/PDR-014-separation-of-powers.md) (separation of powers), [PDR-018](adr/product/PDR-018-time-locked-eviction.md) / [PDR-021](adr/product/PDR-021-one-flow-lost-or-stolen-phone.md) (eviction), [ADR-017](adr/architecture/ADR-017-two-safe-account.md) / [ADR-019](adr/architecture/ADR-019-account-eviction-module.md) (contracts).

## 1. What we protect, and who holds what

| Asset or factor | Where it lives | Power alone |
|---|---|---|
| **Funds** | Account Safe (public address) | — |
| **Phone (Key Safe)** | Passkey in the device's secure hardware (P-256, not extractable), synced or not | Spend up to the **daily limit the user chose**. Nothing else. |
| **Recovery Kit** | Passphrase-encrypted file in the user's iCloud / Google Drive + an encrypted copy in the app. It holds two keys: Account **owner** key and **guardian** key | Start an eviction (level 0: 7 days, level 1: + Swissquote identity check, 3 days). Cannot spend. |
| **Security key** (optional) | FIDO2 key with PIN, at home | Nothing alone |
| **Swissquote** | Guardian key (HSM, mocked), relayer, paymaster policy, registry | Never an owner. At level 1 it co-signs an eviction with the Kit, after identity verification. |

**Rules enforced on-chain** (Safe, Allowance Module, Candide recovery module):

- 2 owner signatures for anything above the limit and for any setting;
- cancelling an eviction needs 2 owners;
- a guardian is never an owner.

## 2. Security goals

| # | Goal |
|---|---|
| G1 | Only the user (2 of their factors) can move more than the daily limit or change the rules |
| G2 | Swissquote alone can never move funds or take over the Account, even compromised |
| G3 | A stolen phone loses access after the delay, and the thief cannot cancel |
| G4 | The user keeps control if Swissquote disappears |
| G5 | Compliance adds friction, never a veto on funds |
| G6 | No seed phrase; no SMS or email factor anywhere |

## 3. Attackers

Levels: **L0** = wallet for everyone, **L1** = linked Swissquote client, **+key** = with a security key.

| # | Attacker | Holds | Can | Cannot | Outcome | Test |
|---|---|---|---|---|---|---|
| A1 | **Phone thief who watched the passcode** | Unlocked phone (Key Safe) | Spend up to the daily limit, each day, until evicted | Move more, change the limit, add owners, cancel the eviction (`GS020`) | L0: loss ≤ 7 × limit. L1: ≤ 3 × limit. +key: ≈ 1 × limit, then evicted | Spike C1, C2, C5b, C5e; variants; `check:eviction-api` E3–E7 |
| A2 | **iCloud / Google takeover** | Synced passkey + encrypted Kit file | Same as A1 | Decrypt the Kit without the passphrase (scrypt keystore) | Same as A1 | `check:kit` K1–K7 |
| A3 | **Kit thief** (file + cracked passphrase) | Kit owner + guardian keys | Start an eviction | Spend, or finish the eviction if the owner cancels with Face ID + Kit (their own copy) | L0: must be cancelled within 7 days (alerts). L1: refused, fails identity verification | `check:eviction-api` E2, E5 |
| A4 | **Compromised front-end / malicious dependency** | The page the user signs in | Ask for a Face ID on a malicious operation | Exceed the daily limit without the Kit | Loss capped by the limit. The preview and simulation make a mismatch visible | `ComplianceChecks` (PDR-023) |
| A5 | **Phishing site** (look-alike domain) | Its own page | Show a fake UI | Use the passkey: bound to Swissquote's domain (rpId). Replay a registry proof: origin and rpId checked | No signature obtained | `check:registry` R4 |
| A6 | **Address poisoning / scam recipient** | A look-alike address in the history | Trick a copy-paste | Pass the look-alike warning silently; hide a sanctioned address in a batch | Explicit confirmation; sanctioned refused | `check:sponsorship` P4; `ComplianceChecks` |
| A7 | **Swissquote insider or compromised backend** | Guardian key, relayer, paymaster, registry | L1: co-sign an eviction **only with a Kit guardian signature**; refuse sponsorship | Move funds, be an owner, start an eviction alone | No loss. A refused sponsorship is friction (user can pay gas) | `check:eviction-api` E2; PDR-001 |
| A8 | **Swissquote outage or end of service** | — | Stop sponsorship, the relayer, the registry | Freeze funds | Phone + Kit still transact. L1: the app moves the Account to the 7-day Kit-only path before closing (PDR-018) | Design (G4) |
| A9 | **SIM swap / email takeover** | Phone number, mailbox | Nothing: no flow uses SMS or email | — | No effect | Design (G6) |
| A10 | **Two factors stolen together** (phone + key, or Kit stored on the phone) | 2 owner factors | Everything | — | Full control: rule of three places, shown at setup | — (residual) |
| A11 | **Coercion** | The user and their phone | Force Face ID up to the limit | Force more without the Kit | Capped by the limit | Design |
| A12 | **Sponsorship abuse** | Many wallets | Spam sponsored operations | Exceed 10 a month per level 0 wallet; sponsor a reported-stolen Key Safe | Bounded cost | `check:sponsorship` P1, P6 |
| A13 | **Forged ownership proof / handle squatting** | Another passkey, look-alike handles | Try to register someone else's Account; claim similar handles | Register without owning the Key Safe; resolve hidden handles or list clients | Refused; the verified name is shown before signing | `check:registry` R1–R5; `check:handles` H1–H6 |
| A14 | **Contract or library bug** | — | — | — | Only audited Safe contracts and modules, established libraries (ADR-011). No custom Solidity | Spike + all checks on Base Sepolia |

## 4. Residual risks we state openly

1. **The daily limit keeps flowing during the eviction delay (A1).** The cap bounds the loss, but nothing cuts it automatically. Bitkey does this; here it would need a custom contract. Mitigation: the limit is the user's choice and its loss bound is shown.
2. **A Kit theft at level 0 relies on the owner noticing (A3).** Mitigations: 7-day delay, push alerts, a long passphrase. Level 1 removes the risk.
3. **Two factors in one place (A10).** Mitigations: the setup UX and the security page.
4. **Mocks:** KYC, e-banking authentication of the API (client id passed by the caller), guardian HSM, account balances. Production replaces them, and the trust model does not change.
5. **Blind signing (A4).** Face ID does not display the transaction. The app's preview and simulation are the defense, and they are only as trustworthy as the front-end. Production needs a strict CSP.

## 5. How to verify it yourself

- **Owners on Basescan:** the Account's owners are the Key Safe, the Kit owner key and optionally the security key. **No Swissquote address**.
- **Checks:**
  - on-chain: `npm run spike:two-safe`, `npm run spike:two-safe-variants`, `npm run check:account`;
  - local: `npm run check:kit`;
  - against `npm run dev`: `check:eviction-api`, `check:registry`, `check:sponsorship`, `check:handles`, `check:swissquote`.
