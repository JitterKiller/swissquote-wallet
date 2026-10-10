import { Check } from 'lucide-react'

import { Spinner } from './feedback'

/** Horizontal progress through a multi-step flow. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                done
                  ? 'bg-accent text-accent-fg'
                  : active
                    ? 'border-2 border-accent text-accent'
                    : 'border border-border text-muted'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {/* On narrow screens only the current step keeps its label. */}
            <span className={`truncate ${active ? 'font-medium text-foreground' : 'hidden text-muted sm:inline'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px min-w-3 flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}

/** Vertical checklist of async steps (done / running / pending). */
export function ProgressList({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="space-y-3">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full ${
                done ? 'bg-success-soft text-success' : active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : active ? <Spinner className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span className={done ? 'text-muted' : active ? 'font-medium' : 'text-muted'}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
