---
target: onboarding flow (/welcome, /welcome/protect, /recover)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/rayd418/Desktop/swissquote/swissquote-wallet/web/src/app/(onboarding)"
timestamp: 2026-10-10T23-51-41Z
slug: web-src-app-onboarding
---
Method: dual-agent (A: design review · B: detector + browser)

# Critique: onboarding flow (/welcome → /welcome/protect → /recover)

Target: web/src/app/(onboarding) + CreateWalletView, ProtectWalletView, AccountSetupStep, RecoverView, OnboardingShell. Evidence: 27 captures (desktop light, dark, mobile) + 640/320px probe.

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Kit test passes silently; document.title static across 4 sub-steps |
| 2 | Match real world | 2 | passkey, private/public key, gas sponsorship, Basescan, 2 of 2, UTC |
| 3 | User control & freedom | 2 | No in-flow Back; reload loses progress; Skip for now unexplained |
| 4 | Consistency & standards | 2 | Custody model told 4 ways; Welcome/Recover on old type scale and cards |
| 5 | Error prevention | 2 | Error on first keystroke; no high-limit warning; no digit grouping |
| 6 | Recognition vs recall | 3 | Plate recap, presets, filename hint |
| 7 | Flexibility & efficiency | 2 | No client fast path; no paste in Test |
| 8 | Aesthetic & minimalist | 3 | Clean; passphrase step crowded; moving chart in periphery |
| 9 | Error recovery | 2 | "Passkey prompt was cancelled." with no next step; new Kit invalidates old file silently |
| 10 | Help & documentation | 2 | Nothing on forgotten passphrase or where to keep it |
| Total | | 23/40 | Acceptable |

## Design Specificity Verdict
LLM: partly authored. Product-only moves: loss bound (limit × days squares), "Face ID will approve" plate, "Three locks" factor squares. Frame is the generic split sign-in; the panel is a static poster identical on 7 screens; candle field reads as exchange imagery (random data as price) next to a stablecoin wallet; /welcome and /recover not migrated; Overview hand-off reverts to old world.
Deterministic: 0 findings (CLI, in-page detector on 6 screens, URL scans 1280 and 390). Contrast AA everywhere in light (min 4.86:1). Disabled primary buttons 1.66:1 (exempt). No overlay (headless).

## Priority Issues
- [P1] Custody model told four ways (ProtectWalletView.tsx:262, AccountSetupStep plate, RecoverView, OverviewView.tsx:192 legacy ADR-026). Fix: one model component with factor squares reused everywhere; label Recover legacy. /impeccable clarify → polish
- [P1] Sub-step changes invisible to keyboard and screen readers: focus to BODY (key={step}, ProtectWalletView.tsx:128), no aria-describedby/aria-invalid in field.tsx, invisible file-input focus, two h1 per page. Fix: focus step h1, title, aria wiring, focus-within, tagline as p, polite live region. /impeccable harden
- [P1] Flow breaks on interruption: in-memory state; reload/app switch restarts and regenerates the Kit. Fix: persist encrypted Kit (ADR-018), resume at Test, warn old file invalid, in-flow Back. /impeccable harden
- [P2] Amount input unsafe for money: no grouping, clips at 320px, no high-limit warning, "at most about", UTC reset. /impeccable clarify → adapt
- [P2] Panel does no work: identical on 7 screens, candles random on a fixed 2s timer (candle-field.tsx:8), mobile opens on chain facts. Fix: panel tells the user's own story ending on the real block. /impeccable shape → animate

## Persona Red Flags
Jordan: unexplained passkey/private key; three locks vs 2 of 2; "After 7 days" reads automatic; Skip for now; USDC unexplained.
Casey: Save forces app switch, lost tab restarts; CTA ~920px down; 32px eye toggle, 36px presets; duplicate Kit files.
Sam: focus to BODY; hints unread; invisible file focus; stepper labels hidden from AT; loss bound not live.
Swissquote client 50s: no client door (12px footnote); candles read as volatility beside "a thief can take"; no passphrase storage advice; Overview "Recovery Kit + Swissquote (2 of 2)".

## Minor Observations
Done stepper shows step 3 active; "Saved and tested" unverified; dark-mode plate barely separates, day squares muddy; first CTA disabled at 1.66:1 looks broken; "Network fee 0.00" no unit; "Demo: simulate an attacker" full-width in Recover.

## Questions to Consider
1. What do random candles prove? Could the panel show the user's Account assembling and the real block?
2. Should the orange land on "Your keys" rather than "Swissquote"?
3. Why does the Swissquote client get no door before a 12px footnote?
4. Should the emotional peak be what a thief can take, or what a thief can never reach?
