import type { ReactNode } from 'react'

export type Factor = 'phone' | 'cloud' | 'kit' | 'key'

/**
 * The Factor Code Rule (DESIGN.md): phone = orange fill, cloud account = ink outline, Kit = ink fill,
 * security key = orange outline (a second device, kept at home, #17). On an ink plate, ink turns to
 * the plate's foreground.
 */
const CODES: Record<Factor, Record<'light' | 'hero', string>> = {
  phone: { light: 'bg-accent', hero: 'bg-accent' },
  cloud: { light: 'ring-1 ring-inset ring-foreground', hero: 'ring-1 ring-inset ring-hero-fg' },
  kit: { light: 'bg-foreground', hero: 'bg-hero-fg' },
  key: { light: 'ring-[1.5px] ring-inset ring-accent', hero: 'ring-[1.5px] ring-inset ring-accent' },
}

export function FactorSquare({
  factor,
  tone = 'light',
  size = 'md',
  className = '',
}: {
  factor: Factor
  tone?: 'light' | 'hero'
  size?: 'sm' | 'md'
  className?: string
}) {
  return <span aria-hidden className={`inline-block shrink-0 ${size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'} ${CODES[factor][tone]} ${className}`} />
}

/**
 * Which factors approved a payment: the phone alone (within today's limit), or the phone and a second
 * factor, the Kit by default or the security key (`second="key"`, ADR-043).
 */
export function ApprovalSquares({
  kit,
  second = 'kit',
  tone = 'light',
  size = 'md',
  className = '',
}: {
  kit: boolean
  second?: 'kit' | 'key'
  tone?: 'light' | 'hero'
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span className={`inline-flex shrink-0 gap-1 ${className}`}>
      <FactorSquare factor="phone" tone={tone} size={size} />
      {kit && <FactorSquare factor={second} tone={tone} size={size} />}
    </span>
  )
}

/**
 * A plate or list label led by its factor squares. The squares sit in a fixed slot as wide as the
 * phone and the Kit together, so labels line up; pass no factors for a row that involves none.
 */
export function FactorLabel({ factors = [], tone = 'light', children }: { factors?: Factor[]; tone?: 'light' | 'hero'; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-flex w-6 shrink-0 gap-1">
        {factors.map((factor) => (
          <FactorSquare key={factor} factor={factor} tone={tone} />
        ))}
      </span>
      {children}
    </span>
  )
}
