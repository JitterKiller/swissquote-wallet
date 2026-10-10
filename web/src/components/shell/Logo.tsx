/** SQure wordmark (PDR-026): the orange square carries "SQ", the word finishes it, "by Swissquote" signs it. */
export function Logo({ tone = 'default' }: { tone?: 'default' | 'hero' }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="sr-only">SQure by Swissquote</span>
      <span className="flex items-center" aria-hidden>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[13px] font-bold tracking-tight text-accent-fg">
          SQ
        </span>
        <span className={`ml-[3px] text-xl font-semibold tracking-[-0.03em] ${tone === 'hero' ? 'text-hero-fg' : ''}`}>
          ure
        </span>
      </span>
      <span aria-hidden className={`mt-1 text-xs ${tone === 'hero' ? 'text-hero-muted' : 'text-muted'}`}>
        by Swissquote
      </span>
    </span>
  )
}
