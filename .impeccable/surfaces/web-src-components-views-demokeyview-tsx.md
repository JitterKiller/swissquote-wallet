---
version: 1
slug: "web-src-components-views-demokeyview-tsx"
primary_target: "web/src/components/views/DemoKeyView.tsx"
related_targets: ["web/src/app/wallet/key/page.tsx","web/src/lib/keyRelay.ts","web/src/components/account/SecurityKeyAdd.tsx","web/src/components/account/SecondFactor.tsx"]
---

# Surface brief: Demo security key

- **Scope:** `/wallet/key` (ADR-043), the screen of the phone that PLAYS the user's FIDO2 security key in the demo. A teammate's phone, with its own Face ID, standing apart from the wallet's phone. States: set up (pairing code from the wallet, register with this phone's Face ID, the matching address), waiting, a request (lock-out now, payment above the limit, swap, Earn, limit change), approving, refused, expired, signed, forget this key.
- **Mode:** Operate.
- **Audience and job:**
  - **The teammate** pairs the key and approves the request on cue.
  - **The jury** sees the phone held up and reads "simulated key" and what it approves, from a distance.
- **Proof and content:** the key is a real WebAuthn credential on this phone and a real third owner onchain (its verifier proxy). The request travels through the MOCK relay (`/api/key-relay`). The key reads the Account's nonce onchain and computes the SafeTx digest itself before signing; it shows the wallet's description of the request.
- **Constraints:** label MOCK in code and UI; never this wallet's own phone (the wallet's passkey is excluded); public data only on this phone; English copy; the key factor code (orange outline square); honest that a real key has no screen.
- **Unresolved:** none blocking.

## Direction contract

THESIS: The phone playing the key must read as a simulation from across a room. Two named layers carry the claim: on ink, the key exactly as a real FIDO2 key behaves (blind, one contact, nothing else); on white, a Demo screen that shows what a real key never could, the request. It refuses a generic approval dialog and a gadget-shop render.

OWN-WORLD: DESIGN.md as built. A Plate Ink field holds the drawn key; its contact is the key factor code, an orange outline square, the only orange besides the primary action. Hanken display for the one instruction, mono tokens for the strip and addresses, MOCK in Amber Note, the white Demo screen in the review plate's row grammar with hairlines.

STORY: 1. Set up: type the wallet's code, touch to register, check both screens show the same address. 2. The key waits. 3. A request lights the contact and fills the Demo screen. 4. Touch the key (Face ID) or Refuse; the wallet carries on.

FIRST VIEWPORT: at 390, the top half is ink: "Simulated security key" and MOCK, the key drawn about 330px wide with the contact centred, "Touch to approve" at 34px and one line naming Face ID as the touch. A labelled seam, "Demo screen · what a real key can't show". Below, on white: the request title, three rows, Refuse and Touch the key. From 768px the same column, centred, the ink field full width.

FORM: "The key, then the demo screen", third on my list of seven, chosen by the user; seed key 5f4f5402. Signature move: the contact pulses (two rings expand) while a request waits and stops on touch; static double ring under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
