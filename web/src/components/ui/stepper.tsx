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
          <li key={label} className={`flex items-center gap-2 ${active ? 'flex-none sm:min-w-0 sm:flex-1' : 'min-w-0 flex-1'}`}>
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold tabular-nums transition-colors duration-200 ${
                done
                  ? 'bg-foreground text-background'
                  : active
                    ? 'bg-accent text-accent-fg'
                    : 'border border-border text-muted'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {/* On narrow screens only the current step keeps its label. */}
            <span className={`token ${active ? 'shrink-0 whitespace-nowrap text-foreground' : 'hidden truncate text-muted sm:inline'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <span className={`h-px bg-border ${active ? 'w-6 sm:w-auto sm:min-w-3 sm:flex-1' : 'min-w-3 flex-1'}`} />}
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
                done ? 'bg-success-soft text-success' : active ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-muted'
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
