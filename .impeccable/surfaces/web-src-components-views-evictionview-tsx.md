---
version: 1
slug: "web-src-components-views-evictionview-tsx"
primary_target: "web/src/components/views/EvictionView.tsx"
related_targets: ["web/src/components/shell/SecurityBanners.tsx","web/src/components/shell/AppShell.tsx"]
---

# Surface brief: phone lost or stolen (issues #15, #16)

- **Scope:** `/lost` (EvictionView, new device: "Phone lost or stolen?"), the lock-out alert and its cancel panel on every page of the current device (SecurityBanners, AppShell), and the "This phone was locked out" screen. The welcome link points to `/lost`; `/recover` (legacy Key Safe recovery) stays reachable until #33, and `/lost` sends v1 Kits and wallets without an Account there.
- **Mode:** Operate.
- **Audience and job:** the owner after losing a phone, on a new phone, with the Kit file and passphrase; the same owner (or a thief) on the old phone. Demo: two phones side by side, the old one shows the alert while the new one counts down.
- **Proof and content:** the Account's owners, guardians, pending eviction (newOwners, executeAfter) and allowance read on-chain; the eviction delay (7 days level 0, 3 days level 1, 3 minutes in the demo deployment); the old phone's daily limit as the loss bound; the start, finalize and handover transactions on Basescan; a real GS020 refusal when the phone alone tries to cancel.
- **Constraints:** Kit and passphrase never leave the device; the opened Kit stays in memory only; the new passkey is persisted (public data) before anything is sent; level 1 adds the MOCK identity check before Swissquote co-signs; security operations are sponsored; English copy; keep `/recover` and `npm run e2e:recovery` working.
- **Out of scope:** the security key's instant eviction (#17, shown as a "Soon" mention only), the Security page (#26), retiring the legacy recovery (#33).
- **Unresolved:** none blocking.

## Direction contract

THESIS: Losing a phone is a countdown the owner controls, not a race against the thief. The new phone shows the lock-out as a live timer with its exact terms; the old phone shows who can stop it. It refuses the generic "account recovery" wizard and the alarmist full-screen takeover.

OWN-WORLD: DESIGN.md as built. Ink plates for what is live onchain or signed, with the seal only on the 2-of-2 takeover; mono for the countdown, figures and addresses; factor squares for who can stop it (orange phone + ink Kit); the delay drawn as ten square cells in the allowance cells' grammar; the loss bound on the apricot field; Signal Red only for the alert on the old phone.

STORY: On the new phone the owner opens the Kit, approves Face ID, erases the old phone, starts the lock-out and watches it count down, knowing the old phone can still spend at most its daily limit and only the old phone plus the Kit can stop it; then takes over with Face ID and the Kit. On the old phone a red banner names the lock-out and its time; "This wasn't me" stops it with the Kit and Face ID; Face ID alone is refused, live.

FIRST VIEWPORT: New phone, pending: an ink plate "Lock-out · live onchain" with a live square, the countdown in display mono, "until the old phone is locked out", ten delay cells, then rows Old phone (address, can still spend ≤ limit/day), New phone (this phone), Can stop it (old phone + your Kit, with squares); below, "Next: take over with Face ID + your Kit" and the disabled wait button that becomes "Take over". Old phone: the red banner above the Overview's plate, its countdown in sync, "This wasn't me" at the right.

FORM: user-picked in the shape round (plate + countdown, red banner on every page with a cancel panel, a "Demo: try with Face ID only" proof); no roll, inside the established world.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
