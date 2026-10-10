# PDR-015: Open wallet for everyone, the Swissquote link as the upgrade

- **Status:** Accepted
- **Date:** 2026-10-10
- **Refines:** [PDR-003](PDR-003-gasless-by-default.md) (sponsorship policy), [PDR-004](PDR-004-recovery-policy.md) (level 0 recovery)
- **Related:** [PDR-006](PDR-006-identity-verification-before-guardian-approval.md), [PDR-010](PDR-010-handle-transfers-verified-payee.md), [PDR-014](PDR-014-separation-of-powers.md), [PDR-016](PDR-016-recovery-kit-encrypted-cloud-backup.md), [PDR-017](PDR-017-theft-protection-hardware-key.md)

## Context

- A bonus criterion rewards a strong business case, including **new users**. An acquisition funnel needs a wallet people can use before they become clients.
- Today anyone can create a wallet (no Swissquote login), but PDR-006 assumes every user has a KYC record, and PDR-003 says production sponsorship is for clients only. Nothing recorded who the wallet is for.

## Decision

**Two levels, plus an option for both:**

| | **Level 0: wallet for everyone** (free, no Swissquote account) | **Level 1: linked Swissquote client** |
|---|---|---|
| Account owners (PDR-014) | Key Safe + Kit, 2 of 2 | Key Safe + Kit, 2 of 2 |
| Key Safe recovery | Kit alone, **7-day** delay | Kit + Swissquote after identity verification (PDR-004, PDR-006), **3-day** delay |
| Default daily limit | 200 USDC | 1,000 USDC |
| Gas | 10 sponsored operations a month, then gas paid in USDC (ERC-20 paymaster) | Sponsored |
| Alerts | In the app (push) | Push, SMS, email, e-banking |
| Extras | — | Wallet registry, `@handle` and verified payee (PDR-010), transfer between the Swissquote account and the wallet |
| Free upgrades | Trusted contact as arbiter, own FIDO2 key | Same |

- **Option for both levels:** "Theft protection", a hardware key as third factor (PDR-017).
- **Linking** = Swissquote login + KYC (the existing account opening) + wallet ownership proof in the registry. Address unchanged.
- **Upgrade from level 0 to 1:** one passkey-signed operation on the Key Safe switches its recovery module from 7 days to 3 days and adds Swissquote as guardian.
- **Funnel:** the link is offered when the need appears:
  - setting up recovery ("add Swissquote as your guardian");
  - wanting an `@handle`;
  - selling to CHF;
  - reaching the gas quota.

  Metrics: wallets created → linked → funded → trading.
- **Legal:** level 0 is pure non-custodial software. Swissquote has no power of disposal, so no KYC is needed. KYC comes only with the link.
- **Prototype:** the Swissquote login is **MOCK**.

**Honest comparison** (shown in the security page and the pitch):

| Scenario | Level 0 | Level 1 | With hardware key |
|---|---|---|---|
| Kit lost | Slow exit through the daily limit | Same | Replaced at once |
| Phone lost (passkey not synced) | Kit + 7 days. A stolen Kit can start it, so the owner must cancel. | Kit + identity + 3 days. A stolen Kit fails identity verification. | At once |
| Phone stolen and unlocked | Tie, low daily limit | Tie, plus instant alerts and gas sponsorship stopped (friction) | Thief evicted at once |

If the passkey is synced (iCloud Keychain / Google), a lost phone needs no recovery at all: signing in on the new phone brings it back.

## Consequences

- ✅ An acquisition funnel: the wallet is the entry point, and the bank link is the upgrade.
- ✅ The security table is honest, and every gap has a free fix (trusted contact, own key) and a paid one.
- ⚠️ Without a hardware key, level 1 adds little for phone theft and Kit loss. The Swissquote plan should include the key (PDR-017).
- ⚠️ Level 0 Kit theft: one missed in-app alert is enough. Mitigated by the 7-day delay and push notifications.
- ⚠️ The gas quota needs a sponsorship policy service (production).

## Alternatives considered

- **Swissquote clients only:** simpler and closer to the brief's wording, but no acquisition funnel.
- **Swissquote as sole arbiter at level 1:** gives Swissquote conditional control (PDR-014).
- **Making a trusted contact mandatory at level 0:** too much friction for a first wallet. Kept optional and strongly recommended.
