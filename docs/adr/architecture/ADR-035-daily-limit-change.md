# ADR-035: Changing the daily limit: a panel on the Security page, worst case before → after, Face ID + Kit in one sponsored UserOp

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:** [ADR-034](ADR-034-security-page.md): the "Change" slot of the daily limit is no longer "Soon".
- **Related:** [PDR-014](../product/PDR-014-separation-of-powers.md), [PDR-020](../product/PDR-020-daily-limit-chosen-by-user.md), [PDR-012](../product/PDR-012-web-first-banking-ux.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-023](ADR-023-sponsorship-policy-proxy.md), issue #13

## Context

PDR-020 lets the user choose the daily limit at setup and change it later, up or down, with 2 factors: `setAllowance` can only be called by the Account. The logic already existed: `setDailyLimitCall` in `lib/account.ts`, checked on-chain by `check:target-flows`. The paymaster already treats Allowance Module settings as security operations, always sponsored (ADR-023).

The Security page (ADR-034) showed "Change" as "Soon" (#13). Raising the limit raises the worst case of a stolen phone (limit × (days + 1)), so the change must show that consequence before anything is signed.

## Decision

- **Where:** "Change" on the Security page's "Daily limit" row opens a panel under the row, inside the row's hairlines, with no card of its own. This was chosen in the impeccable shape round (surface brief `web-src-components-account-limitchange-tsx`).
  - While the panel is open, the row's control reads "Cancel". It disappears once the receipt shows.
  - Closing gives focus back to "Change".
  - The Overview's Face ID meter has a "Change" link beside the reset time, to `/security?change=limit`. The Security page reads it with `useSearchParams()`, inside a `Suspense` boundary. `window.location` is not updated yet when a client navigation renders the page.
- **The panel (`components/account/LimitChange.tsx`):**
  1. **The new limit:** `LimitPicker` (`components/account/LimitPicker.tsx`), the protect flow's field and presets, now shared by both. It is prefilled with the current limit.
     - Valid values: more than 0, at most 1,000,000 USDC, 2 decimals, and different from the current limit.
     - On phones the 48px figure steps down for long values (`amountFit`).
  2. **The worst case before → after, on the Apricot Field:**
     - the current figure, muted;
     - an arrow and the new figure, large in mono;
     - the difference in words ("4.00 USDC more than now" or "less than now");
     - what Face ID can still spend today, or that it cannot spend more until the reset when today's spending already exceeds the new limit;
     - an invalid value says "Choose a limit from 0.01 to 1,000,000 USDC to see your new worst case" instead of showing a figure.
     - The sentence is announced to screen readers (`aria-live`) and describes the field (`aria-describedby`).
     - Both figures use `lossBound()` and the level read on-chain.
  3. **The sealed 2-of-2 plate** "Face ID and your Kit will approve": the new limit (and the current one), the worst case, the approval squares, and "Network fee: Covered by Swissquote".
  4. **The Kit**, as in Send, Swap and Earn: the local encrypted copy or a file, then the passphrase. The copy says why lowering needs the Kit too: with the phone alone, a thief cannot change the rules or block the spending.
     - Kit file drop zones now show keyboard focus, here and in Send, Swap, Earn and the lock-out screens.
  5. **"Approve with Kit and Face ID":** `twoFactorCall({ call: setDailyLimitCall({ keySafe, dailyLimit }) })` sent by `sendCalls`. It is one sponsored UserOp.
  6. **The receipt plate** "Limit changed · onchain", without seal: new limit, previous limit, worst case, factors and the Basescan link.
     - The whole row scrolls back into view, so its new value sits above the receipt.
     - Focus moves to the receipt.
- **After the change:** the stored wallet's `dailyLimit` is updated and the chain state refreshed. The Rules row, the Overview meter and the Custody card read the new allowance.
- **No limit of 0, no pause.** `setDailyLimitCall` refuses 0. A pause can be decided later.
- **Test:** `npm run e2e:limit` (`scripts/e2e-limit.mts`), about 1.5 minutes:
  1. protect a wallet with a 0.50 limit;
  2. open the panel from the Overview's "Change";
  3. raise the limit to 1.00 (worst case 4.00 → 8.00);
  4. lower it to 0.25 (8.00 → 2.00);
  5. check the Security row and the Overview meter;
  6. check the panel's states: 0, above 1,000,000, a wrong passphrase, a new limit below today's spending (after a 0.10 Face ID payment, funded from the treasury and sent back), and no local Kit.
  - It saves `limit-*` captures (phone and desktop).

## Consequences

- ✅ The user can tune what a stolen phone could cost, and sees the new cost before signing. Neither a raise nor a lowering is possible with the phone alone.
- ✅ One limit field and one loss-bound formula for setup and settings.
- ⚠️ A change applies to today immediately: lowering below today's spending stops Face ID payments until the reset. The panel says so.
- ⚠️ The security key route (Face ID + key instead of the Kit, #17) is not built.

## Alternatives considered

- **A dedicated page with a stepper:** more room, but it leaves the Security page and its worst case. The shape round chose the panel.
- **Only the new worst case:** simpler, but the change itself, which is what the user decides on, stays invisible.
- **Allow 0 as a "pause Face ID" preset:** useful when travelling. It needs a decision and a change to `setDailyLimitCall`.
