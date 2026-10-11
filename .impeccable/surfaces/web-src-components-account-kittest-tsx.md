---
version: 1
slug: "web-src-components-account-kittest-tsx"
primary_target: "web/src/components/account/KitTest.tsx"
related_targets: ["web/src/components/account/KitReminder.tsx","web/src/components/views/SecurityView.tsx","web/src/components/views/OverviewView.tsx","web/src/components/views/EvictionView.tsx","web/src/lib/storage.ts"]
---

# Surface brief: Test your Recovery Kit

- **Scope:** the "Test your Kit" reminder (#9, PDR-016: "test at setup, then periodic 'test your Kit' reminders").
  - The Security page gains a "Recovery Kit" rule row: when the Kit was last tested on this device, and "Test" opening an In-Row Panel (also `/wallet/security?change=kit`).
  - The panel re-opens the Kit file the owner saved in iCloud Drive or Google Drive, with its passphrase, as on a new phone. It then checks onchain that the file's keys are still the Account's Kit owner and lock-out guardian. Nothing is signed or sent.
  - When the last test is 90 days old or more, or never happened on this device, the Overview shows a quiet reminder that leads to the panel.
  - "Demo: skip 90 days" ages the last test so the reminder shows live.
  - Opening the Kit file in "Phone lost or stolen?" counts as a test on the new device.
- **Mode:** Operate.
- **Audience and job:**
  - **The owner**, months after setup, finds out now, while the phone still works, that the file is gone or the passphrase forgotten.
  - **The jury** sees that self-custody without a seed phrase keeps one small ritual, and that it takes 20 seconds.
- **Proof and content:**
  - **Last test:** `sq-kit-tested:v1` on this device. It is saved at setup, after each test, and after opening the Kit in `/wallet/lost`.
  - **The check:**
    1. `parseKitFile` (v3), and the file is for this Account;
    2. `decryptKit` with the passphrase;
    3. `readAccount`: the owner key is among the owners, and the guardian key among the lock-out guardians.
  - **A lost file:** this phone's encrypted copy (`sq-kit:v3`) can be saved again, with the same passphrase.
- **Constraints:**
  - Nothing leaves the device: the file and the passphrase are read locally, and the passphrase is never stored.
  - A test signs nothing: no ink plate (the Ink Plate Rule), and no orange in the reminder (Send keeps the Overview's one orange).
  - English copy. It is honest about a forgotten passphrase: nobody can reset it, not even Swissquote.
  - 44px targets on phones.
- **Out of scope:**
  - replacing the Kit (a new passphrase or new keys: it needs 2 factors, an open question in PDR-014);
  - notifications outside the app;
  - testing the security key or the phone.
- **Unresolved:** none blocking.

## Direction contract

THESIS: A Recovery Kit is only as good as the day it is needed. The reminder turns that into a 20-second ritual: open the file from the cloud drive with the passphrase, as on a new phone, and see onchain that its keys still guard the Account. It refuses an alarm banner, a nag modal, and anything that reads as a failure before the test has run.

OWN-WORLD:
- DESIGN.md as built: the In-Row Panel under its rule row, the protect flow's Kit drop zone and passphrase field, the Kit's ink factor square, hairline rows, a warning "Due" badge, and Gate Blocks for failures.
- The Overview reminder is a quiet white section in the Level Callout's register, led by the Kit square, with a secondary "Test my Kit".
- The result is a light checklist with ink checks (never green and red), not a plate: nothing was signed.
- One orange in the panel: "Test my Kit".

STORY:
1. On the Overview, 94 days after setup, a quiet card says "Test your Recovery Kit · last tested 94 days ago".
2. "Test my Kit" lands on Security with the Recovery Kit panel open.
3. The owner picks the file in iCloud Drive and types the passphrase.
4. The app checks onchain that the file opens and its two keys still guard the Account: "Kit tested", next test in 90 days. The reminder is gone.
5. If the file is lost, the owner saves it again from this phone, then tests it. If the passphrase is forgotten, the panel gives the honest options.

FIRST VIEWPORT:
- **Security, panel open:**
  1. the row "Recovery Kit · Due · tested 94 days ago";
  2. one sentence on what the test does;
  3. the Kit file drop zone and the passphrase field;
  4. "Test my Kit";
  5. "Can't find the file?" and "Forgot the passphrase?".
- **Overview:** on desktop the reminder heads the right column, above "Wallet protected". On phones it sits right under the Account plate: it is rare, and it asks for action.

FORM: chosen by the user in the shape round:
- the Security row plus an Overview reminder;
- the cloud file plus the passphrase, with an onchain check;
- every 90 days, with a Demo control.

It sits inside the established world, with no roll.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
