export type Factor = 'phone' | 'cloud' | 'kit'

/** The Factor Code Rule (DESIGN.md): phone = orange fill, cloud account = ink outline, Kit = ink fill. On an ink plate, ink turns to the plate's foreground. */
const CODES: Record<Factor, Record<'light' | 'hero', string>> = {
  phone: { light: 'bg-accent', hero: 'bg-accent' },
  cloud: { light: 'ring-1 ring-inset ring-foreground', hero: 'ring-1 ring-inset ring-hero-fg' },
  kit: { light: 'bg-foreground', hero: 'bg-hero-fg' },
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

/** Which factors approved a payment: the phone alone (within today's limit) or the phone and the Kit. */
export function ApprovalSquares({
  kit,
  tone = 'light',
  size = 'md',
  className = '',
}: {
  kit: boolean
  tone?: 'light' | 'hero'
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span className={`inline-flex shrink-0 gap-1 ${className}`}>
      <FactorSquare factor="phone" tone={tone} size={size} />
      {kit && <FactorSquare factor="kit" tone={tone} size={size} />}
    </span>
  )
}
