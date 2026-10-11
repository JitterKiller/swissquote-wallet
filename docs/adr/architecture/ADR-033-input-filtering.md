# ADR-033: Text fields accept only what the app accepts (`lib/inputs.ts`), and the payment link fills Send

- **Status:** Accepted
- **Date:** 2026-10-11
- **Related:** [PDR-010](../product/PDR-010-handle-transfers-verified-payee.md), [PDR-023](../product/PDR-023-compliance-as-friction.md), [ADR-024](ADR-024-handle-directory.md), [ADR-032](ADR-032-swaps-and-assets.md)

## Context

The fields took any text and checked it afterwards, field by field:

- **Amount fields** accepted letters. Only "," was turned into ".".
- **The `@handle` fields** accepted spaces, capitals and punctuation, so the server refused them later.
- **The recipient** only trimmed spaces, so a pasted payment URI (`ethereum:0x…@84532`) was rejected.
- **Names** accepted anything.

On top of that, the "Request a payment" link and QR (`/send?to=@handle&amount=20`, PDR-010) opened an empty Send: nothing read the query string.

## Decision

- **`lib/inputs.ts`** holds one filter per kind of field. Each runs on every change, so a field never holds something the app would refuse later.
  - **`cleanAmount(raw, decimals)`:**
    - keeps digits and one decimal point;
    - reads a lone "," as the point (a European keypad), and drops thousands separators, spaces and apostrophes ("1,234.56", "1'234.50");
    - keeps at most `decimals` decimals and 9 whole digits.
  - **`INPUT_DECIMALS = 6`:** the input rule of ADR-032, now defined here.
  - **`cleanHandle`** applies the directory's rule (ADR-024): lowercase, a letter first, then letters, digits or `_`, 20 at most.
  - **`cleanRecipient`** keeps a 0x address or an @handle, and pulls the address out of a pasted link or payment URI.
  - **`cleanName`** keeps letters of any alphabet, spaces, apostrophes, hyphens and dots, 40 at most. `{ digits: true }` is for the MOCK Swissquote sign-in, whose name is also the demo client's login.
- **Where each filter applies:**

  | Fields | Filter |
  |---|---|
  | Send, Swap, Earn, "Check a payment", the typed confirmation | `cleanAmount` with the token's precision, up to 6 decimals |
  | Daily limit, payment-request amount, Swissquote account transfers | `cleanAmount` with 2 decimals |
  | Recipient, typed or pasted with the paste button | `cleanRecipient` |
  | Handle claim and contact (`HandleInput`, an "@" printed inside the field) | `cleanHandle` |
  | Your name, the new phone's name, the recovered device's name | `cleanName` |
  | Swissquote sign-in name | `cleanName` with digits |

- **Kit passphrases stay free on purpose:** any character adds strength.
- **The payment link fills Send.** `SendView` reads `to` and `amount` from the query string through the same filters (`queryParam`).

## Consequences

- ✅ A field can no longer hold text that the app or the server refuses later. Pasted amounts with separators and pasted payment URIs work.
- ✅ The payment request link and QR open Send ready to review.
- ⚠️ **"1,234" is read as 1.234.** A lone comma is the decimal point, so a value with an English thousands comma and no decimals becomes a decimal. The review shows the amount exactly, and the typed confirmation covers large amounts.
- ⚠️ **No explanation for refused characters.** A refused character does not appear and no message says why. The field's hint and placeholder show the expected form.

## Alternatives considered

- **`type="number"`:** browsers differ on decimals and on the comma, it allows "e" and "-", and scrolling over it changes the value.
- **Validate on submit with an error:** the owner finds out late, and the field still shows a value the app will refuse.
- **An input-mask library:** a dependency for four small pure functions.
