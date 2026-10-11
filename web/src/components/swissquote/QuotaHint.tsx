import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

/** "Monthly sponsored quota reached…" from the paymaster (ADR-023) names its way out: link the Swissquote account. */
export const isQuotaRefusal = (error: string | null) => !!error && /sponsored quota/i.test(error)

/**
 * The way out of the level 0 sponsored-fee quota (PDR-015 funnel, #21): linked clients have unlimited
 * sponsored network fees. Shown inside a "Not sent" alert when the paymaster refused for the quota.
 */
export function QuotaHint({ error }: { error: string | null }) {
  if (!isQuotaRefusal(error)) return null
  return (
    <Link href="/swissquote" className="mt-2 inline-flex min-h-11 items-center gap-1 font-medium text-accent-ink hover:underline sm:min-h-0">
      Link with Face ID <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
