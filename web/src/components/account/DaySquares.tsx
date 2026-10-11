/**
 * The loss bound drawn as squares (DESIGN.md): with `today`, a first square for what is left today,
 * then one per daily reset until the Kit locks the phone out.
 */
export function DaySquares({ days, today = false }: { days: number; today?: boolean }) {
  const labels = [...(today ? ['now'] : []), ...Array.from({ length: days }, (_, i) => String(i + 1))]
  return (
    <div className="flex items-end gap-1" aria-hidden>
      {labels.map((label, i) => (
        <span key={label} className="flex flex-col items-center gap-1">
          <span className={`h-7 w-7 rounded-[3px] ${i === 0 ? 'bg-accent' : 'bg-accent/45'}`} />
          <span className="font-mono text-[11px] tabular-nums text-foreground/70">{label}</span>
        </span>
      ))}
    </div>
  )
}
