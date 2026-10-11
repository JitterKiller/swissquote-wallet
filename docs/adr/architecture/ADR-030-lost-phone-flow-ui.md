# ADR-030: "Phone lost or stolen?" in the app: `/lost` on the new phone, alert and 2-factor stop on the old one

- **Status:** Accepted
- **Date:** 2026-10-11
- **Related:** [PDR-018](../product/PDR-018-time-locked-eviction.md), [PDR-021](../product/PDR-021-one-flow-lost-or-stolen-phone.md), [ADR-019](ADR-019-account-eviction-module.md), [ADR-018](ADR-018-recovery-kit-encryption-and-storage.md), [ADR-026](ADR-026-transitional-legacy-key-safe-recovery.md), [ADR-027](ADR-027-visual-world-swiss-onchain-fintech.md)

## Context

ADR-019 built the eviction onchain and in `lib/eviction.ts`, and `check-target-flows` F5–F6 prove it. Issues #15 and #16 put it in the app for the two-phone demo:
- on the new phone, a guided flow ending in the handover;
- on the old phone, an alert, a stop that needs 2 factors, and the locked-out state.

PDR-021 wants one flow, but the legacy Key Safe recovery must stay reachable until #33.

## Decision

- **One entry, `/lost`** (`EvictionView`). The welcome link reads "Phone lost or stolen?".
  - It lives in the route group `(recovery)`: the onboarding shell with its panel stepped back to the logo and the live chain facts, so the lock-out leads the screen.
  - The copy calls the new device "this device", since it can be a laptop.
  - The steps are Kit, Face ID, Lock out, Delay, Take over:
  - **Kit:** the Kit file and passphrase are decrypted in the browser. The app checks that the Kit's guardian key guards the Account. The old phone is the Account's allowance delegate. The level comes from the guardians (`evictionLevel`).
  - **Face ID:** a new passkey; its Key Safe address is predicted.
  - **Lock out:**
    - level 1 first runs the MOCK identity check;
    - links to Find My and Find My Device;
    - the exact loss bound: what is left today, plus one daily limit per reset during the delay. The same rule now applies at setup (`AccountSetupStep`);
    - an ink plate "Your Kit will start the lock-out", with no seal: it is not a 2-of-2 commit;
    - then `startEviction` → `POST /api/eviction`.
  - **Delay:** a live countdown to `pendingEviction.executeAfter`, polled every 5 s.
    - The "Take over" button enables 5 s after the deadline, because the chain's clock can lag.
    - If the eviction disappears and this device's Key Safe is an owner, it was finalized elsewhere. Otherwise it was stopped, and the user can start again with the same new key.
  - **Take over:** a sealed plate "Face ID and your Kit will approve". One action runs `POST /api/eviction/finalize` (the relayer), then the handover UserOp from the new Key Safe (`handoverCalls`, Kit + `v = 1`), which also deploys it.
    - Right after the finalize, the RPC node and the bundler's node can lag a block. The app waits until the Account lists the new Key Safe, then retries the bundler's "would revert" (EXECUTION_REVERTED) a few times before asking for Face ID.
    - The wallet is then saved with the new Key Safe and the same Account.
- **Storage:**
  - The new passkey is saved in `LocalEviction` (public data) before anything is sent, so a reload resumes at the right step.
  - The encrypted Kit is saved as the local copy (`saveLocalKit`, ADR-018), for the takeover and for later Kit payments from this device.
  - The opened Kit lives in memory only. After a reload the takeover asks for the passphrase again.
- **Legacy until #33:** `/lost` sends v1 Kits, and wallets without an Account lock-out, to `/recover` (ADR-026), which is unchanged. `npm run e2e:recovery` opens `/recover` directly.
- **Old phone** (`SecurityBanners`, `AppShell`):
  - `getPendingEviction(state, keySafe)` returns the pending eviction that would remove this phone, and a red banner shows it on every page with the countdown.
  - "This wasn't me" opens a panel: Kit passphrase (local copy or file), an ink plate "Face ID and your Kit will stop it", then Face ID → `cancelEvictionCalls` via `sendCalls`.
  - When the Account no longer lists this Key Safe (`isEvicted`), `RevokedScreen` says "This phone was locked out" with a Basescan link to the owners.
- **Demo proof, labelled "Demo":** "Demo: try with Face ID only" sends `thiefCancelCalls`, the Account transaction with the Key Safe's approval alone.
  - The bundler's simulation reverts before any Face ID prompt (EXECUTION_REVERTED, with no reason).
  - So `safeRevertReason` replays the call with `eth_call` from the Key Safe and reads the Safe's code (GS020).
  - The panel shows it as evidence: one factor square lit out of two, "Refused by your Account", "GS020 · 1 of 2 factors".
- **Test:** `npm run e2e:eviction`, two phones in real Chrome on Base Sepolia, about 6 minutes:
  1. protect and fund the old phone;
  2. the new phone starts the lock-out;
  3. the old phone sees the alert, the thief attempt is refused, and Kit + Face ID stop it;
  4. the new phone starts again, waits for the delay and takes over;
  5. the old phone is locked out, and the new phone spends within the limit;
  6. a linked client's (level 1) identity check and 3-day terms.

  Each screen is captured at 390×844 (viewport and full page) and at 1440×900.

## Consequences

- ✅ The lost-or-stolen story runs end to end in the app, on two phones, with every step checkable on Basescan.
- ✅ The thief's limit is shown live: the stop needs the Kit, and the demo button proves the Account refuses Face ID alone.
- ⚠️ Holding the opened Kit in memory during the delay widens the window in which the page holds the Kit keys. It saves typing the passphrase twice in the demo. A reload clears it.
- ⚠️ The banner comes from the 10 s Account poll, so the old phone can learn of a lock-out up to 10 s late. Production adds push (Swissquote notifications, MOCK today).
- ⚠️ Between the finalize and the handover, the old Key Safe is no longer an owner but is still the allowance delegate, so it can still spend today's limit.
  - The takeover runs both in one action and retries. If the handover still fails, the screen says so and asks the user to try again at once.
  - Closing that window onchain means cutting the allowance inside the module's execution (open question "Cut the daily allowance automatically when a recovery starts").
- ⚠️ The security key's instant eviction (#17) is not in this UI.
- #33 can now retire `/recover`, the legacy guardians on the Key Safe and `e2e:recovery`, with `e2e:eviction` taking over.

## Alternatives considered

- **Full-screen takeover on the old phone:** rejected in the shape round. It blocks an owner who is moving to a new phone themselves. The banner keeps the app usable and still shows on every page.
- **Two separate actions for finalize and handover:** rejected. The old phone is only truly out once the limit has moved, so one "Take over" step matches what the user means.
- **Keeping `/recover` as the entry and branching inside it:** rejected. PDR-021's single flow deserves its own name in the UI ("Phone lost or stolen?"), and the legacy screen and its e2e test stay untouched until #33.
