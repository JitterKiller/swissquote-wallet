import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}>
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground">
            {icon}
          </div>
        )}
        <div>
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-5 sm:px-6 ${className}`}>{children}</div>
}
