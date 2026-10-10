import { AppShell } from '@/components/shell/AppShell'

// The wallet UI is client-only: it needs WebAuthn and the wallet stored in
// this browser, so AppShell renders pages only after hydration. Opt these
// routes out of Next's instant-navigation validation (it can't render them).
export const instant = false

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
