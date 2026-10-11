import { OnboardingShell } from '@/components/shell/OnboardingShell'

/** "Phone lost or stolen?" (ADR-030): the onboarding shell with its panel stepped back, so the lock-out leads. */
export default function RecoveryLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingShell quiet>{children}</OnboardingShell>
}
