'use client'

import { daysSinceKitTest, kitTestDue, useKitTestedAt } from '@/components/account/useKitTest'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ButtonLink } from '@/components/ui/button'
import { FactorSquare } from '@/components/ui/factor'
import { useNow } from '@/lib/hooks'

/**
 * The Overview's "Test your Recovery Kit" reminder (#9, PDR-016, ADR-041): shown once the last test on
 * this device is 90 days old, or never happened here. A quiet white section in the Level Callout's
 * register, led by the Kit's square; its secondary action opens the test under the Security page's
 * "Recovery Kit" row. Gone as soon as the Kit is tested.
 */
export function KitReminder() {
  const { wallet, chain } = useLoadedWallet()
  const testedAt = useKitTestedAt()
  const now = useNow(60_000)
  if (!wallet.account || !chain.account?.deployed || !kitTestDue(testedAt, now)) return null
  const days = daysSinceKitTest(testedAt, now)
  return (
    <section aria-labelledby="kit-reminder-title" className="rounded-2xl border border-border p-5">
      <h2 id="kit-reminder-title" className="flex items-center gap-2.5 font-semibold">
        <FactorSquare factor="kit" />
        Test your Recovery Kit
      </h2>
      <p className="mt-1 text-sm text-muted">
        {days === null ? 'Not tested on this phone yet.' : `Last tested ${days} days ago.`} Check that you still have the file and its passphrase: on a
        new phone, they are what gets you back in.
      </p>
      <ButtonLink href="/wallet/security?change=kit" variant="secondary" className="mt-4 w-full max-sm:h-11">
        Test my Kit
      </ButtonLink>
    </section>
  )
}
