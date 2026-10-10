# PDR-016: Recovery Kit as a passphrase-encrypted cloud backup

- **Status:** Accepted
- **Date:** 2026-10-10
- **Supersedes:** [PDR-005](PDR-005-recovery-kit.md)
- **Related:** [PDR-014](PDR-014-separation-of-powers.md), [PDR-015](PDR-015-open-wallet-and-levels.md), [ADR-018](../architecture/ADR-018-recovery-kit-encryption-and-storage.md)

## Context

- PDR-005 made the Kit an offline file that the app never stores. The team rejects paper or printed QR codes as the main format.
- Under PDR-014 the Kit becomes an **owner of the Account**: phone + Kit means full control. It must be independent from the phone, so that a thief holding the unlocked phone cannot open it.
- Industry practice:
  - Robinhood and Coinbase: password-encrypted backup in iCloud or Google Drive.
  - MetaMask (2025): Google/Apple login + password, with the key split across holders (TOPRF).
  - Phantom: email + PIN on distributed, guess-limited storage (Juicebox).

## Decision

- **The Kit is a key generated on the device and encrypted with a passphrase the user chooses.** The passphrase is never sent anywhere. Format and storage: ADR-018.
- **Two encrypted copies:**
  - in the user's **iCloud Drive / Google Drive**, for recovery on a new device;
  - **in the app**, so a large payment only asks for the passphrase.
- **Three separate locks**, explained in the UI:

  | Lock | Opens | Asked by |
  |---|---|---|
  | Face ID / device passcode | The passkey (spending up to the limit) | The phone |
  | Apple / Google account | Access to the encrypted file | Apple / Google (transparent in a native app) |
  | **Kit passphrase** | The Kit itself | Our app |

- **Passphrase rules:** at least 12 characters, not the device passcode, strength indicator. Advise against saving it in the phone's keychain, and recommend iOS Stolen Device Protection.
- **Test at setup**, then periodic "test your Kit" reminders.
- **Swissquote never sees the file or the passphrase.**
- **User experience:**
  - large payment = Face ID + passphrase;
  - recovery = cloud file + passphrase (+ identity verification at level 1);
  - with a hardware key, a tap replaces the passphrase.
- **Optional:** paper/QR export for those who want it, and SLIP-39 split later.

## Consequences

- ✅ No paper. Same experience as Robinhood and Coinbase cloud backups.
- ✅ A stolen file, a hacked iCloud account or a stolen unlocked phone gives nothing without the passphrase.
- ⚠️ Security rests on passphrase strength: a stolen file can be attacked offline. Hence no 4-digit PIN.
- ⚠️ A forgotten passphrase is a lost Kit. Without a hardware key only the slow exit remains (PDR-014).
- ⚠️ Web demo: recovery uses a file picker. A native app reads its own iCloud / Drive folder automatically.

## Alternatives considered

- **Paper or printed QR as the main format:** rejected by the team, kept as an option.
- **Google Authenticator / TOTP:** a shared secret that a contract cannot verify, a server would have to hold, and that lives on the same phone.
- **12 words:** blurs the "no seed phrase" promise (PDR-002).
- **Short PIN with distributed, guess-limited storage (Juicebox / TOPRF):** best UX, but heavy to build. Roadmap.
- **Encrypted Kit stored by Swissquote:** without TOPRF, Swissquote could attack weak passphrases offline, and it looks like control.
