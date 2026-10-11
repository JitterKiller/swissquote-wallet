import type { ReactNode } from 'react'

/**
 * A registered ink plate for anything Face ID signs: crosshairs mark two corners. The one place
 * the world turns dark on a light screen.
 */
export function Plate({
  title,
  children,
  className = '',
}: {
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`relative rounded-2xl border border-hero-2 bg-hero p-5 text-hero-fg sm:p-6 ${className}`}>
      <Crosshair className="-left-[7px] -top-[7px]" />
      <Crosshair className="-bottom-[7px] -right-[7px]" />
      {title && <p className="token text-hero-muted">{title}</p>}
      <div className={title ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

function Crosshair({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 14 14" className={`absolute h-3.5 w-3.5 text-foreground ${className}`}>
      <path d="M7 0v14M0 7h14" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/** A row inside a plate (use inside a <dl>): label on the left, the fact on the right. */
export function PlateRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-hero-2 py-2 text-sm first:border-t-0 first:pt-0">
      <dt className="shrink-0 text-hero-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}
