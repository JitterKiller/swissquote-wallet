# ADR-016: Design system — Tailwind tokens + small in-house component kit

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-012](../product/PDR-012-web-first-banking-ux.md), [ADR-010](ADR-010-frontend-nextjs-client-only.md)

## Context

A consistent, bank-grade look across a dozen screens, light and dark, without pulling in a heavy UI framework.

## Decision

- **Tokens** live in `src/app/globals.css` as CSS variables, exposed to Tailwind v4 through `@theme inline`:
  - surfaces: `background`, `surface`, `surface-2`, `border`;
  - text: `foreground`, `muted`;
  - accent: `accent`, `accent-hover`, `accent-soft` (Swissquote-style orange);
  - status: `success`, `danger`, `warning` and their `*-soft` variants;
  - the dark card: `hero*`;
  - `shadow-card`.

  Dark mode follows `prefers-color-scheme`.
- **Components** are hand-written in `src/components/ui/`: `button` (`Button` / `ButtonLink`), `card`, `feedback` (Badge, Alert, Spinner, Skeleton, EmptyState), `field`, `stepper` (`Stepper`, `ProgressList`), `address` (`AddressPill`, `CopyButton`, `ExplorerLink`, `useCopy`), `page` (`PageHeader`).
- **Libraries:** `lucide-react` for icons (v1 names, e.g. `FingerprintPattern`), `sonner` for toasts (one `<Toaster>` in the root layout), `react-qr-code` for the Receive QR code. The font is Geist.
- **Focus:** a global `:focus-visible:not(input, textarea)` outline. Text fields use their own border + soft ring.

## Consequences

- ✅ Few dependencies, and the whole look can be retuned from the tokens.
- ⚠️ **Gotcha:** with Next 16 + `@tailwindcss/turbopack`, a custom `@layer base { … }` block in `globals.css` comes out **unlayered**, so it overrides Tailwind utilities. Don't count on `@layer base` to let utilities override global styles; scope the global selectors instead.
- ⚠️ `lucide-react` v1 renamed some icons (no `Fingerprint`, `Building2`, `History`). Check the export exists before using one.

## Alternatives considered

- **shadcn/ui or Radix**: more weight and setup than this prototype needs.
- **MUI or Chakra**: their look is hard to make bank-grade, and they come with their own styling system.
