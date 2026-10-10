# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Anyone who wants to hold and pay in stablecoins (USDC) with their own keys, without a seed phrase.** Swissquote clients and non-clients are first-class users on equal footing: a non-client gets the full free wallet (level 0) with the same basic security and must feel as much at home as a client.
- **Linking a Swissquote account is an optional upgrade (level 1)**, never a gate on basic security: shorter lock-out delay for a stolen phone, `@handle` with verified payee, one-tap transfers with the Swissquote account, unlimited sponsored network fees.
- **Jobs:** create a wallet in seconds; protect it (Recovery Kit + a daily limit they choose); receive and pay; move money between the wallet and the Swissquote account (clients); get back in after a lost or stolen phone; understand at any time who can do what with their money.
- **Evaluators:** the BSA Hackathon jury and Swissquote, judging the Swissquote Wallet Challenge (technical, security and custody, legal, business, UX and pitch, plus a bonus for gasless use and compliant dApp interaction).

## Product Purpose

A self-custody wallet Swissquote could launch: the client holds the keys, Swissquote can never move the funds on its own, and the experience stays one tap from the Swissquote account. Today, self-custody means leaving Swissquote (whitelisting an address, paying a withdrawal fee, proving ownership with screenshots); seed phrases are the main reason bank clients don't self-custody. Success: create → sign → lose → recover works end to end on testnet, a non-expert understands their protection, and the custody claim can be checked on-chain.

## Positioning

The user always holds the majority and Swissquote is never an owner (PDR-013), checkable on-chain. Funds sit in an Account Safe owned only by the user's factors (phone + Recovery Kit, optionally a security key; 2 required). Face ID alone spends up to a daily limit the user chooses; anything else needs two factors. A lost or stolen phone goes through one flow: the Kit locks it out after a delay the thief cannot cancel, so the worst case is a bounded loss shown as an amount (limit × days), not a race against the thief (Kraken, MetaMask) and not trust in the provider (Bitkey, Zengo, MPC co-signing). Swissquote adds what only a bank can: a verified-client relationship, identity checks before it co-signs, compliance as friction, and sponsored fees.

## Operating Context

- **Hackathon demo:** 7-minute pitch with a 3-minute live demo. The desktop web app is projected for the jury, and **two phones** play the lost/stolen-phone scenario side by side (old device and new device).
- **Real use:** mostly on a phone (Face ID / Touch ID passkeys), with a desktop online-banking-grade web app (PDR-012).
- **Network:** Base Sepolia testnet with Circle test USDC; gas always sponsored, users never hold ETH.
- **Deployment:** https://swissquote-wallet.vercel.app. Passkeys are bound to that domain: demo wallets are created there.
- **Supporting documents for the jury:** threat model, business case, pitch deck and decision records (see Evidence on Hand).

## Capabilities and Constraints

- **Working:** passkey wallet creation; protect flow (passphrase-encrypted Recovery Kit downloaded and tested, user-chosen daily limit, Account Safe created in one sponsored transaction); send with review before signing and compliance checks (sanctions screening, simulation, look-alike and large-payment warnings); receive with QR; on-chain activity; security page; `@handle` payments with verified payee and payment requests; transfers between the Swissquote account and the wallet; wallet registry with a Face ID proof of ownership; recovery on a new device with a Swissquote identity check (legacy flow, kept until the eviction flow ships).
- **Being built:** balance and activity on the Account (#11), Face ID up to the limit and a second factor above it (#12), limit settings (#13), the "phone lost or stolen" eviction flow and the alert/cancel on the current device (#15, #16), security key (#17), level upgrade (#21), offers page (#22), security page for the two-Safe account (#26), approved-dApp list (#25).
- **Constraints:** Swissquote never gains unilateral power and is never an owner (PDR-001, PDR-014); security operations are always sponsored at every level (PDR-019); no seed phrases (PDR-002); English UI copy (PDR-008); banking, KYC, the guardian HSM, notifications and Swissquote balances are mocked and must be marked MOCK in code and UI (PDR-007); upcoming features stay visible but disabled ("Soon"), never faked.
- **Terminology:** Account (holds the funds), phone / Key Safe, Recovery Kit and Kit passphrase, daily limit, lock-out (eviction) of a lost or stolen phone, levels 0 and 1, offers Free / Client / Premium "Theft protection", guardian, `@handle`, verified payee, "network fee covered by Swissquote".
- **Undecided:** offer prices (CHF 5–9 a month indicative, to model), insurance partner, React Native app, swaps, Bitcoin (pitch slide only).

## Brand Commitments

- Name: **Swissquote Wallet**. Line in use: "Your keys. Your crypto. One tap from Swissquote."
- A **Swissquote-inspired prototype**: the Swissquote name, the current orange and the SQ monogram already in the app, no official Swissquote assets. Keep the existing design system (ADR-016).
- Voice (from the shipped copy and PDR-008): plain English, calm and precise like a Swiss bank, honest about what is real and what is mocked.

## Evidence on Hand

- Decision records: `docs/adr/` (product PDR-001…024, architecture ADR-001…026).
- Threat model: `docs/threat-model.md`. Business case: `docs/business/business-case.md` with `docs/business/model.py`. Pitch and demo script: `docs/pitch/deck.md`.
- On-chain proof: e2e and spike scripts in `web/scripts/` with Basescan links recorded in ADR-019 and the GitHub issues.
- Public facts used in the pitch: Swissquote's 1,220,818 client accounts (30 June 2026, including 423,409 Yuh); eToro's acquisition of Zengo (April 2026).
- **Absent, never to fabricate:** real users, testimonials, usage metrics, official Swissquote brand assets, confirmed prices, an insurance partner, regulatory approval.

## Product Principles

1. **The user always holds the majority, and the interface proves it.** Who can do what is visible in the product and checkable on-chain; Swissquote appears as a guardian, never as an owner.
2. **Everyone gets the full security.** The free wallet is a first-class product; the Swissquote link adds speed and comfort, never basic protection.
3. **Risk is bounded and shown as amounts.** Limits, loss bounds and delays are concrete numbers the user sees before committing, and every transaction is reviewed before signing.
4. **No crypto homework.** No seed phrase, no ETH, no jargon: Face ID, a Recovery Kit and banking words.
5. **An honest prototype.** Real on-chain, mocked banking labelled MOCK, upcoming features marked "Soon" rather than faked.
