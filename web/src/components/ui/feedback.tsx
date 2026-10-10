import { CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning'

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  accent: 'bg-accent-soft text-accent-ink border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

const ALERT_TONES: Record<Exclude<Tone, 'neutral' | 'accent'> | 'info', string> = {
  info: 'bg-surface-2 border-border text-foreground',
  success: 'bg-success-soft border-transparent text-foreground',
  danger: 'bg-danger-soft border-transparent text-foreground',
  warning: 'bg-warning-soft border-transparent text-foreground',
}

const ALERT_ICONS = {
  info: <Info className="h-4 w-4 text-muted" />,
  success: <CircleCheck className="h-4 w-4 text-success" />,
  danger: <TriangleAlert className="h-4 w-4 text-danger" />,
  warning: <TriangleAlert className="h-4 w-4 text-warning" />,
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: keyof typeof ALERT_TONES
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={`flex gap-3 rounded-xl border p-3.5 text-sm ${ALERT_TONES[tone]}`}>
      <div className="mt-0.5 shrink-0">{ALERT_ICONS[tone]}</div>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-muted' : ''}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden />
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
