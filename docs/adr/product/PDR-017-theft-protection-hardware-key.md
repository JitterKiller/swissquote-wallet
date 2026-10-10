# PDR-017: "Theft protection" offer — a hardware key as third factor

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-013](PDR-013-key-management-user-majority.md), [PDR-014](PDR-014-separation-of-powers.md), [PDR-015](PDR-015-open-wallet-and-levels.md), [PDR-016](PDR-016-recovery-kit-encrypted-cloud-backup.md), [ADR-017](../architecture/ADR-017-two-safe-account.md)

## Context

With two factors, a stolen unlocked phone is a tie (PDR-014). The market answers it in three ways:

- **A race:** Kraken Wallet, MetaMask, Coinbase.
- **Putting the provider in the loop:** Bitkey's server key, Zengo's server-side face scan.
- **Letting guardians freeze the wallet:** Argent.

A third factor that the user holds breaks the tie without giving Swissquote any power.

## Decision

- **An optional third owner of the Account:** a FIDO2 hardware security key (a passkey on hardware). WebAuthn user verification is required, so the key's PIN is enforced.
- **Offered by Swissquote as "Theft protection":**
  - The key is shipped and preconfigured. In production, its authenticity is checked through WebAuthn attestation.
  - **Swissquote never holds the key.**
  - **Any FIDO2 key is accepted**, so level 0 users can buy their own: no lock-in.
  - Higher daily limit.
  - Large payments with Face ID + a tap instead of the Kit passphrase.
- **Guided "Phone stolen?" flow:**
  1. erase the phone (Find My / Find My Device);
  2. evict: Kit + key replace the Key Safe and move the allowance, immediately (ADR-017);
  3. report: the Swissquote paymaster stops sponsoring the stolen Key Safe (friction, not a veto). The reporter proves ownership with identity verification (level 1) or a Kit signature (level 0).
- **Insurance of the capped loss** (about one day's limit): to explore with a licensed insurance partner. Swissquote cannot insure on its own without a FINMA insurance licence.
- **Rule of three places:** the key stays at home, never in the same bag as the phone.
- **Demo:** the key is simulated with Chrome's virtual authenticator, or a real YubiKey.
- **Price references:** Zengo Pro launched at about $20 a month, Ledger Recover at $9.99 a month, and a YubiKey costs about CHF 50–80.

## Consequences

- ✅ A stolen phone is solved immediately, and the loss is about one day's limit.
- ✅ Business case: a subscription, a reason to link the account, and a bank-like gesture (banks already ship e-banking tokens).
- ✅ Swissquote sells convenience, assistance and insurance, not basic security: free equivalents exist.
- ⚠️ Phone + key stolen together means full control.
- ⚠️ The insurance needs a partner. Attestation is checked in production only (the virtual authenticator has none).

## Alternatives considered

- **Swissquote as co-owner:** not self-custody (PDR-014).
- **Server-side face scan before each transaction (Zengo):** puts Swissquote in every signature.
- **Guardians who can freeze the wallet (Argent):** needs a custom module and gives a third party a blocking power.
- **No offer:** the tie stays the only answer to phone theft.
