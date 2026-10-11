import type { ComponentProps, ReactNode } from 'react'

/**
 * Phones: the big mono amount steps down a size (36 → 30 → 24 px) before it would clip. `fits` is
 * how many characters the field shows at 36 px; each step down shows about 20% more.
 */
export function amountFit(text: string, fits: number) {
  if (text.length <= fits) return ''
  return text.length <= Math.floor(fits * 1.2) ? 'max-sm:!text-3xl' : 'max-sm:!text-2xl'
}

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

/** 16px text below 640px: iOS Safari zooms the page into any field set smaller. */
export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={`h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none sm:text-sm transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-accent-ink focus:ring-4 focus:ring-accent-soft ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-border bg-surface p-3.5 text-base outline-none sm:text-sm transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-accent-ink focus:ring-4 focus:ring-accent-soft ${className}`}
      {...props}
    />
  )
}
