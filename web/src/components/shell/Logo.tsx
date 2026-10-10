export function Logo({ tone = 'default' }: { tone?: 'default' | 'hero' }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[13px] font-bold tracking-tight text-accent-fg">
        SQ
      </span>
      <span className={`leading-tight ${tone === 'hero' ? 'text-hero-fg' : ''}`}>
        <span className="block text-sm font-semibold tracking-tight">Swissquote</span>
        <span className={`block text-xs ${tone === 'hero' ? 'text-hero-muted' : 'text-muted'}`}>Wallet</span>
      </span>
    </span>
  )
}
