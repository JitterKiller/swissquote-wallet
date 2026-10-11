# Pitch deck: content and demo script

Issue #30. The jury grid:

| Technical | Security & custody | Legal | Business | UX & pitch | Bonus (gasless, compliant dApps) |
|---|---|---|---|---|---|
| 35 | 20 | 15 | 15 | 15 | 20 |

Inputs:
- [business case](../business/business-case.md) (#31);
- [threat model](../threat-model.md) (#32);
- the decision records in [`docs/adr/`](../adr/README.md).

The slides are a Slides artifact, "SQure Pitch Deck". It downloads as PowerPoint or PDF from its page, and its speaker notes hold what to say on each slide.

Target: **about 5 minutes**, ten slides including a 90-second live demo. Each slide carries one idea.

---

| # | Slide | Time | Key line |
|---|---|---|---|
| 1 | **Your keys. Swiss security.** | 15 s | A wallet Swissquote could launch: no seed phrase, no ETH, and Swissquote can never move your money. |
| 2 | **Today, self-custody means leaving Swissquote** | 35 s | Whitelist, USD 10–15 per withdrawal, screenshots, then a seed phrase. Swissquote loses the client at the exact moment they want more control. 1,220,818 client accounts; eToro bought Zengo. |
| 3 | **You always hold the majority. Swissquote is never an owner.** | 35 s | The Account's owners are the phone, the Kit and an optional key; 2 are needed. Check the owners on Basescan (PDR-013, ADR-017). |
| 4 | **Face ID pays up to your limit. Everything else takes two factors.** | 30 s | A thief with the unlocked phone gets at most the daily limit and can't change a rule (PDR-014, PDR-020). |
| 5 | **Phone lost or stolen? One flow, and the thief can't stop it.** | 35 s | 7 days, 3 days for linked clients, at once with a key. Worst case 4.00 / 2.00 / 0.50 USDC at a 0.50 limit. Stopping takes two factors: GS020 (PDR-018, ADR-038). |
| 6 | **A bank's features, without the custody** | 30 s | `@handle` with a verified payee, one tap to and from Swissquote (travel rule), compliance as friction, no ETH, approved dApps with 2 factors. |
| 7 | **Live demo** | 90 s | See the script below. |
| 8 | **Basic security is free. Premium sells speed and insurance.** | 30 s | Free, Client, Premium at CHF 5–9 a month (to model). Median model: break-even at 25% of crypto-active accounts linked, +CHF 0.59 m over three years. |
| 9 | **Real onchain, honest about the rest** | 25 s | What runs on Base Sepolia, what is MOCK, 10 e2e suites. Next: a key tap for payments, a trusted contact, a native app, Bitcoin. |
| 10 | **Your keys. Swiss security.** | 10 s | Try it at swissquote-wallet.vercel.app. |

---

## Demo script (90 seconds)

**Roles:**

| Who | Device | Plays |
|---|---|---|
| Presenter | The laptop, projected | The new device |
| Presenter, then the thief | Phone A | The client's phone, then the stolen one |
| Teammate | A phone, through the QR code | The security key |

**Before the pitch, on the production domain:**
- the treasury is topped up: the relayer Safe `0x062b012bA4582b1857C93Dcf075736Ac8DC339cD`, with Circle test USDC on Base Sepolia;
- the wallet is created and protected on phone A, and the Kit file is on the laptop;
- the security key is added: Security → Add a key, with the teammate's phone;
- `@lea` is claimed.

**The demo:**

1. **Create and protect:** show them on a fresh wallet if there is time. Otherwise say "done before the pitch" and show the owners on the Security page.
2. **Pay `@lea`** 0.10 USDC within the limit: the verified name shows, Face ID approves, no gas.
3. **The phone is stolen:**
   - on the laptop, `/wallet/lost` → open the Kit → "Start the lock-out";
   - on phone A, the red alert → "Demo: try with Face ID only" → refused onchain (GS020).
4. **Kit + key end the wait:** on the laptop, "Have your security key?" → "Lock out now with Kit and key" → the teammate's phone approves → phone A shows "This phone was locked out".

**Fallbacks:** the `e2e:eviction` and `e2e:key` screenshots and their Basescan links.
