/**
 * The loss bound drawn as squares (DESIGN.md): with `today`, a first square for what is left today,
 * then one per daily reset until the Kit locks the phone out. `lg` grows them on desktop, where the
 * worst case stands beside the owners plate (Security page).
 */
export function DaySquares({ days, today = false, size = 'md' }: { days: number; today?: boolean; size?: 'md' | 'lg' }) {
  const labels = [...(today ? ['now'] : []), ...Array.from({ length: days }, (_, i) => String(i + 1))]
  return (
    <div className="flex items-end gap-1" aria-hidden>
      {labels.map((label, i) => (
        <span key={label} className="flex flex-col items-center gap-1">
          <span className={`h-7 w-7 rounded-[3px] ${size === 'lg' ? 'lg:h-9 lg:w-9' : ''} ${i === 0 ? 'bg-accent' : 'bg-accent/45'}`} />
          <span className="font-mono text-[11px] tabular-nums text-foreground/70">{label}</span>
        </span>
      ))}
    </div>
  )
}
