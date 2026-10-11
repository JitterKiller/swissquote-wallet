---
version: 1
slug: "web-src-components-account-limitchange-tsx"
primary_target: "web/src/components/account/LimitChange.tsx"
related_targets: ["web/src/components/views/SecurityView.tsx","web/src/components/account/LimitPicker.tsx","web/src/components/views/AccountSetupStep.tsx","web/src/components/account/AllowanceMeter.tsx","web/src/components/views/OverviewView.tsx"]
---

# Surface brief: Change the daily limit

- **Scope:** the daily limit change (#13).
  - "Change" on the Security page's "Daily limit" row stops being "Soon" and opens a panel under the row.
  - The Overview's Face ID meter links to it (`/security?change=limit`).
  - The onboarding's limit field and presets become a shared `LimitPicker`.
- **Mode:** Operate.
- **Audience and job:** the owner who wants Face ID to spend more or less per day. They must see what the change does to their worst case before both factors sign it.
- **Proof and content:**
  - The current limit, spent today and the reset come from the Allowance Module, through `readAccount`.
  - The worst case before and after, from the one formula `lossBound` (limit × (days + 1)) and the level read onchain.
  - One sponsored 2-factor UserOp: `twoFactorCall(setDailyLimitCall)`, classed as a security operation by the paymaster.
  - The transaction on Basescan.
- **Constraints:**
  - 2 factors to raise or lower (PDR-020). The copy says why lowering needs the Kit too: a thief with the phone cannot change the rules or block the spending.
  - Limits: more than 0, at most 1,000,000 USDC, 2 decimals, different from the current one.
  - Network fee covered by Swissquote.
  - Review before signing (PDR-012).
  - English copy.
- **Out of scope:**
  - a limit of 0 or a "pause";
  - other tokens' limits;
  - changing the reset time;
  - the security key route (#17).
- **Unresolved:** none blocking.

## Direction contract

THESIS: Changing the limit is changing your worst case. The panel puts the new limit and the new worst case side by side with the current ones, before anything is signed, so a raise is never just a bigger number in a field. It refuses a settings slider with a "Save" button, and any change that one factor could make.

OWN-WORLD:
- DESIGN.md as built.
- The onboarding's amount field and presets (shared `LimitPicker`).
- The worst case before → after on the Apricot Field: the current figure muted, the new one large in mono, the difference in words.
- The sealed 2-of-2 plate "Face ID and your Kit will approve" (the seal is earned: it is a 2-factor commit).
- The Kit section as in Send, Swap and Earn.
- The receipt plate without seal.
- One committed orange: the selected preset and the primary action.

STORY:
1. On the Security page the owner taps "Change" beside "0.50 USDC a day". The panel opens under the row and the amount field takes focus.
2. They type or pick a new limit. The worst case shows "4.00 → 8.00 USDC" and "4.00 more than now", plus what Face ID can still spend today.
3. The sealed plate lists the new limit, the new worst case and the approval.
4. They open the Kit with its passphrase and approve with Face ID.
5. The receipt says the limit changed onchain, and the row above shows the new value.
6. From the Overview, "Change" beside the Face ID meter lands here with the panel open.

FIRST VIEWPORT: on the Security page at the Daily limit row, with the panel open:
1. "New daily limit" and Cancel;
2. the amount field with "USDC / day" and the presets;
3. the before → after worst case;
4. the sealed plate;
5. the Kit;
6. "Approve with Kit and Face ID".

FORM: chosen by the user in the shape round (a panel in the Security page; impact before → after), inside the established world, with no roll.

FINISH: unreviewed and undocumented is unfinished. This build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
