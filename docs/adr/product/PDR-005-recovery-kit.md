# PDR-005: Recovery Kit — a client-held offline factor, never stored by the app

- **Status:** Superseded by [PDR-016](PDR-016-recovery-kit-encrypted-cloud-backup.md)
- **Date:** 2026-10-10
- **Related:** [PDR-004](PDR-004-recovery-policy.md), [ADR-009](../architecture/ADR-009-client-storage-public-data-only.md)

## Context

Recovery needs a factor that an attacker holding the phone or the email account does not have, and that Swissquote does not control.

## Decision

- At setup, the browser generates a guardian key and gives it to the user as a **file to keep offline** (printed, or in a password manager).
- The user must confirm they stored it "somewhere safe, not on this device".
- The app **never persists** it. At recovery time, the user uploads or pastes it, and it signs in the browser.

## Consequences

- ✅ A stolen Kit is not catastrophic: it is one approval out of two, and the delay plus the owner's veto still apply.
- ✅ A lost Kit is not catastrophic either, as long as the passkey still works. Rotating the Kit is a possible future feature.
- ⚠️ The demo uses a plain JSON file. In production: a printed sheet, an encrypted file, or SLIP-39 shares.
- ⚠️ The Kit only works if users keep it away from the phone. The UX has to insist on this.

## Alternatives considered

- **Trusted contact as guardian**: planned as a third guardian.
- **Second passkey on a hardware key (YubiKey)**: also planned as a third guardian.
- **Encrypted backup stored by Swissquote**: would increase Swissquote's control (PDR-001).
