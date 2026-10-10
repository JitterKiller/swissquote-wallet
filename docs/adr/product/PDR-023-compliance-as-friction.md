# PDR-023: Compliance as friction — sanctions screening, readable preview, high-value and look-alike checks

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-010](PDR-010-handle-transfers-verified-payee.md), [PDR-018](PDR-018-time-locked-eviction.md), [PDR-019](PDR-019-offer-tiers.md), [ADR-022](../architecture/ADR-022-compliance-checks.md), issue #24

## Context

- A bonus criterion rewards "compliant dApp interaction", such as sanctions screening, transaction simulation and extra checks for high-value transactions.
- PDR-001: compliance must add **friction, never a veto**. Swissquote has no power over the funds.
- Subtlety: the passkey only works on Swissquote's domain, so the app is in practice the client's main interface. A refusal *in the app* would act as a veto if the client had no other way out. They do: the Kit can evict the Key Safe to a key used with any software, and the recovery module is permissionless (PDR-018). So the refusal stays friction.

## Decision

1. **Sanctions screening.**
   - Sources: SECO plus the OFAC, EU and UN lists. In the prototype, a mock list, plus the free Chainalysis API when a key is configured.
   - It runs when a recipient is entered (0x or `@handle`), again before signing, in the sponsorship policy (#23), in handle resolution (#20) and in transfers with the Swissquote account (#19).
   - Outcome: **Swissquote's app does not prepare or sponsor the transfer, and says why. Nothing is blocked on-chain.**
2. **Readable preview before Face ID:**
   - the decoded action (token, amount, recipient, within or above the daily limit);
   - a **simulation** (`eth_call` from the sender) with its result.

   A failing simulation shows a warning before signing.
3. **High-value check.** Above 50% of the balance or 5,000 USDC, the user types the amount to confirm. A first-time recipient gets a reminder.
4. **Look-alike warning (address poisoning).** If a recipient shares the first 4 and last 4 characters with a past counterparty but is a different address, a strong warning is shown. This targets one of the most common retail scams.
5. **Records.** Screening results are logged. Level 0 screening uses the address only: no personal data.

**Roadmap:** an open-source "emergency exit" page that runs the Kit eviction without Swissquote's app (as Bitkey's Emergency Exit Kit does), to make the exit path concrete.

## Consequences

- ✅ The bonus criterion is covered without taking custody.
- ✅ Protects clients against the most common scams (poisoned addresses, typos, sanctioned counterparties).
- ⚠️ A determined client can still exit through the eviction (7 or 3 days) and transact elsewhere. That is the honest meaning of "friction, not veto".
- ⚠️ The prototype list is a mock. Production needs a licensed provider (Chainalysis, TRM, Elliptic) and the SECO list, plus an appeal path for false positives.

## Alternatives considered

- **On-chain Safe guard blocking sanctioned destinations:** a Swissquote veto (PDR-001), custom Solidity (ADR-011), and Safe 1.4.1 module transactions bypass guards anyway.
- **No screening:** loses the bonus and exposes the bank's reputation.
