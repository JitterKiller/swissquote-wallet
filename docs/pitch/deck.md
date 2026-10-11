# Pitch deck: content and demo script

Issue #30. The jury grid:

| Technical | Security & custody | Legal | Business | UX & pitch | Bonus |
|---|---|---|---|---|---|
| 35 | 20 | 15 | 15 | 15 | 20 |

The challenge's five bonus points:
1. gasless transactions;
2. compliant dApp interaction;
3. a recovery that tells the user from an attacker;
4. a business case;
5. Swiss regulation on custody and wallet ownership.

The deck shows each one explicitly, sums them up on slide 10, and the demo tags each step with its bonus point.

Inputs:
- [business case](../business/business-case.md) (#31);
- [threat model](../threat-model.md) (#32);
- the decision records in [`docs/adr/`](../adr/README.md).

The slides are a Slides artifact, "SQure Pitch Deck". It downloads as PowerPoint or PDF from its page, and its speaker notes hold what to say on each slide.

Target: **about 6 minutes**, twelve slides including a 2-minute live demo. For 5 minutes, skip slides 4 and 11: slide 10 covers what matters. Each slide carries one idea.

---

| # | Slide | Time | Key line |
|---|---|---|---|
| 1 | **Your keys. Swiss security.** | 15 s | A wallet Swissquote could launch: no seed phrase, no ETH, and Swissquote can never move your money. |
| 2 | **Today, self-custody means leaving Swissquote** | 30 s | Whitelist, USD 10–15 per withdrawal, screenshots, then a seed phrase. Swissquote loses the client at the exact moment they want more control. 1,220,818 client accounts; eToro bought Zengo. |
| 3 | **You always hold the majority. Swissquote is never an owner.** | 30 s | The Account's owners are the phone, the Kit and an optional key, and 2 are needed. Check the owners on Basescan (PDR-013, ADR-017). |
| 4 | **Face ID pays up to your limit. Everything else takes two factors.** | 20 s | A thief with the unlocked phone gets at most the daily limit and can't change a rule (PDR-014, PDR-020). |
| 5 | **Phone lost or stolen? One flow, and the thief can't stop it.** *Bonus: owner vs attacker.* | 35 s | 7 days, 3 days for linked clients, or at once with a key; worst case 4.00 / 2.00 / 0.50 USDC at a 0.50 limit. A phone thief is refused onchain (GS020). Hijacking an email or a SIM gives nothing: there is no SMS or email factor. A stolen Kit file is useless without its passphrase. At level 1, Swissquote checks identity first (PDR-006, PDR-018). |
| 6 | **Gasless, and DeFi that stays compliant** *Bonus: gasless, compliant dApps.* | 35 s | No ETH, ever: the paymaster sponsors everything. Earn lends USDC on Aave v3 and Compound III; Swap trades USDC ↔ EURC and ETH on Uniswap v3. The same checks every time: approved list, sanctions screening, a simulated preview, high-value checks, Kit + Face ID. An unlisted dApp is not sponsored (PDR-003, PDR-023, PDR-025, PDR-028). |
| 7 | **Swiss rules, built in** *Bonus: Swiss regulation.* | 30 s | Not custody: Swissquote has no power of disposal and is never an owner. Ownership is proven with one Face ID, checked against the owners onchain (FINMA Guidance 02/2019). The travel rule is filled in; an @handle is a verified payee and never goes onchain (FADP). Next: CARF, the Swiss e-ID (PDR-001, PDR-010, PDR-022, PDR-024). |
| 8 | **Live demo** | 2 min | See the script below. Each step carries its bonus tag. |
| 9 | **A business case, not a cost centre** *Bonus: business case.* | 30 s | The three offers are Free, Client and Premium at CHF 5–9 a month (to model). The levers: revenue (Premium), retention (one tap back to the trading desk), new clients (open wallet, linking as the upgrade), lower costs (ownership proven by Face ID, not screenshots). Median model: break-even at 25% of crypto-active accounts linked, +CHF 0.59 m over three years. |
| 10 | **Every bonus point, built and live** | 20 s | One table: each of the five bonus points, how SQure does it, and where the demo shows it. |
| 11 | **Real onchain, honest about the rest** | 20 s | What runs on Base Sepolia, what is MOCK, and the 10 e2e suites. Next: a key tap for payments, a trusted contact, a native app, Bitcoin. |
| 12 | **Your keys. Swiss security.** | 10 s | Try it at swissquote-wallet.vercel.app. |

---

## Demo script (2 minutes)

**Roles:**

| Who | Device | Plays |
|---|---|---|
| Presenter | The laptop, projected | The new device |
| Presenter, then the thief | Phone A | The client's phone, then the stolen one |
| Teammate | A phone, through the QR code | The security key |

Use one Chrome profile (or one device) per wallet. Forgetting a wallet on a browser can only be undone through "Phone lost or stolen?".

**Before the pitch, on the production domain:**
- the treasury is topped up: the relayer Safe `0x062b012bA4582b1857C93Dcf075736Ac8DC339cD`, with Circle test USDC on Base Sepolia (https://faucet.circle.com);
- the wallet is created and protected on phone A, and funded with a few USDC from the Swissquote page ("Move to my wallet");
- the Kit file is on the laptop;
- the security key is added: Security → Add a key, with the teammate's phone;
- `@lea` is claimed;
- a dedicated RPC is set in `NEXT_PUBLIC_NODE_URL` (the public Base Sepolia RPC rate-limits).

**The demo:**

| # | Step | Bonus tag |
|---|---|---|
| 1 | **Create and protect:** show them on a fresh wallet if there is time. Otherwise say "done before the pitch" and show the owners on the Security page. No ETH anywhere. | Gasless |
| 2 | **Pay `@lea`** 0.10 USDC within the limit: the verified name shows before Face ID approves. | Verified payee |
| 3 | **Swap** 1 USDC to EURC: the readable preview and the checks, then the Kit passphrase → "Approve with Kit and biometrics". | Compliant dApp |
| 4 | **The phone is stolen:** on the laptop, `/wallet/lost` → open the Kit → "Start the lock-out". On phone A, the red alert → "Demo: try with Face ID only" → refused onchain (GS020). | Attacker refused |
| 5 | **Kit + key end the wait:** on the laptop, "Have your security key?" → "Lock out now with Kit and key" → the teammate's phone approves → phone A shows "This phone was locked out". | Recovery |

**Fallbacks:** the `e2e:swap`, `e2e:eviction` and `e2e:key` screenshots and their Basescan links.
