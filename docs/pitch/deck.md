# Pitch deck — content and demo script

Issue #30. Jury grid: technical 35 · security & custody 20 · legal 15 · business 15 · UX & pitch 15 · bonus 20 (gasless, compliant dApp interaction).
Inputs: [business case](../business/business-case.md) (#31), [threat model](../threat-model.md) (#32), decision records in [`docs/adr/`](../adr/README.md).

Target: **7 minutes**, including a 3-minute live demo. One idea per slide.

---

### 1. Title
**Swissquote Wallet: your keys, one tap from your bank.**
Self-custody with the security, compliance and simplicity of a Swiss bank.

### 2. The problem
- Today, self-custody means **leaving Swissquote**: whitelist an address, pay USD 10–15, prove ownership with screenshots, then the assets are gone.
- Seed phrases are the first cause of lost funds, and the main reason bank clients don't self-custody.
- Crypto income fell about 66% in H1 2026. **eToro bought Zengo** (self-custody) in April 2026.

*Speaker:* "Swissquote loses the client at the exact moment they want more control."

### 3. Our answer
Three promises:
1. **No seed phrase.** Face ID, plus an encrypted Recovery Kit in your cloud.
2. **Swissquote can never touch your money.** You can check it on-chain.
3. **One tap from your Swissquote account,** with proof of ownership built in (FINMA).

### 4. The custody rule (security & custody)
**The user always holds the majority, Swissquote never does** (PDR-013).
Comparison of the five approaches from the brief (MPC, passkeys, ERC-4337, seed, SLIP-39), scores /100:

| Seed | MPC with Swissquote | Passkey, single owner | **Our design** | **+ security key** |
|---|---|---|---|---|
| 55 | 78 | 71 | **76** | **87** |

*Speaker:* "MPC scores well only because Swissquote co-signs everything. That is not self-custody."

### 5. Architecture
- **Account Safe** (holds everything): owners = phone + Kit (+ security key), 2 required.
- **Phone** = Face ID up to the **daily limit you choose**.
- Gas sponsored by Swissquote.

**QR code → Basescan:** "Check the owners yourself: there is no Swissquote address."

### 6. Separation of powers

| Power | Who |
|---|---|
| Spend up to your limit | Face ID |
| Large payments, settings | 2 of your factors |
| Arbitrate a lost or stolen phone | The Kit, after a delay (Swissquote co-signs at level 1) |

### 7. Lost or stolen phone: one flow, the thief cannot cancel
- The Kit starts an eviction. **The thief cannot cancel it**: that needs 2 factors (`GS020` on-chain).
- Locked out after **7 days** (everyone), **3 days** (Swissquote clients), **immediately** (security key).
- Maximum loss = days × your limit.

*Speaker:* "Kraken and MetaMask: a race against the thief. Bitkey and Zengo: trust the provider. Us: a bounded loss, and your own keys decide."

### 8. Threat model = test suite
Five rows from the [threat model](../threat-model.md), each linked to a passing test: phone thief, Kit thief, phishing site, Swissquote compromised, address poisoning.
"14 attackers, every claim backed by a check on Base Sepolia."

### 9. A bank's features, without custody (UX + bonus)
- **`@handle` with verified payee:** "✓ Adam M., verified Swissquote client" before Face ID.
- **One-tap transfers** with the Swissquote account. The travel rule is filled in automatically.
- **Compliance as friction:** sanctions screening, readable simulation, look-alike and large-payment checks.
- **Gasless USDC:** users never hold ETH.

### 10. Legal feasibility
- **Not custody:** Swissquote has no power of disposal (FINMA practice). It is never an owner and cannot act alone.
- **FINMA Guidance 02/2019:** wallet ownership proven by a passkey-signed statement, kept as evidence.
- **Privacy (FADP):** consent at linking, minimal data. `@handle`s are never on-chain.
- **Roadmap:** CARF reporting (2027), Swiss e-ID for re-identification, licensed insurance partner.

### 11. Business case
- **Offers:** Free (everyone) → Client (free, faster, banking extras) → **Premium "Theft protection"** CHF 5–9 / month (key, instant eviction, insurance).
- **Levers:** retained trading (one tap back to the desk), acquisition funnel, premium.
- **Numbers** (model, median): year 1 −0.38 m, **break-even at 25% adoption** among crypto clients, **+0.59 m cumulative over 3 years**.

*Speaker:* "Basic security is free. We sell speed, comfort and insurance."

### 12. Roadmap
- Bitcoin with the same rule (2-of-3 multisig with a timelocked recovery path).
- An open-source emergency exit page.
- Native app, Swiss e-ID, insurance partner.

### 13. Real vs mocked
- **Real on Base Sepolia:** passkeys, Safe, Allowance and recovery modules, eviction, sponsored gas, USDC transfers, registry proof, sanctions policy.
- **Mocked:** banking balance, KYC, e-banking login, guardian HSM, notifications.

---

## Demo script (3 minutes)

**Roles:**
- **Presenter:** laptop + phone A, the client.
- **Thief:** phone B.
- **Operator:** starts the eviction early, because of the 3-minute delay.

**Before the pitch:**
- treasury funded (`/api/health` → relayer address);
- client "Adam" created on the **production domain**;
- Kit file saved;
- `@lea` exists.

1. **Create** (20 s): Face ID → wallet. "No seed phrase."
2. **Protect** (20 s): choose a passphrase → Kit saved to iCloud Drive; choose a daily limit → the Account is deployed. Show the Basescan owners (QR).
3. **Link Swissquote** (15 s): sign in (MOCK) → Face ID → "Linked as Adam M."
4. **Top up** (15 s): `/swissquote` → "Move to my wallet" 50 USDC → on-chain.
5. **Pay a handle** (30 s): send to `@lea` → verified name, checks green → Face ID → done, no gas.
6. **Compliance** (15 s): paste `0x…bad1` → "on a sanctions list", Swissquote won't sponsor.
7. **Phone stolen** (60 s):
   - the Thief takes phone A;
   - the Presenter, on the laptop: "Phone lost or stolen?" → Kit passphrase → eviction started (alerts);
   - the Thief tries to cancel → refused;
   - switch to the eviction the Operator started 3 minutes earlier → finalize → the old phone can no longer spend.
8. **Close** (10 s): "Your keys. One tap from your bank."

**Fallbacks:** screen recording of steps 7–8, and the Basescan links from the spike (ADR-019).

**Depends on teammates' issues:** Account setup UI (#10), send flow (#12), eviction UI (#15, #16), security key (#17). Update the script once they land.
