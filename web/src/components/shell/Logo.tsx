/**
 * The SQure mark (PDR-027): an orange square holding a smaller ink square in its lower-right
 * corner, the phone and the Kit, the two factors that hold the Account. Never inverted: the ink
 * square stays ink on any ground. Same geometry as app/icon.svg.
 */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="6" className="fill-accent" />
      <rect x="17" y="17" width="11" height="11" rx="1.5" className="fill-hero" />
    </svg>
  )
}

/**
 * SQure wordmark (PDR-026, PDR-027): the mark, the word in one piece, "by Swissquote" on its baseline.
 * `compact` (the phone's top bar, next to the address) drops the endorsement on screens under 380px.
 */
export function Logo({ tone = 'default', compact = false }: { tone?: 'default' | 'hero'; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="sr-only">SQure by Swissquote</span>
      <LogoMark />
      <span className="flex items-baseline gap-2" aria-hidden>
        <span className={`text-[22px] font-bold leading-none tracking-[-0.035em] ${tone === 'hero' ? 'text-hero-fg' : 'text-foreground'}`}>
          SQure
        </span>
        <span className={`text-xs ${tone === 'hero' ? 'text-hero-muted' : 'text-muted'} ${compact ? 'max-[379px]:hidden' : ''}`}>
          by Swissquote
        </span>
      </span>
    </span>
  )
}
