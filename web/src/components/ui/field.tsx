import type { ComponentProps, ReactNode } from 'react'

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  aside,
}: {
  label: string
  htmlFor: string
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={`h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent-soft ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-border bg-surface p-3.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent-soft ${className}`}
      {...props}
    />
  )
}
