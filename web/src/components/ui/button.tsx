import Link from 'next/link'
import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
  secondary: 'border border-border bg-surface text-foreground hover:bg-surface-2',
  ghost: 'text-foreground hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90 shadow-sm',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `inline-flex items-center justify-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />
}
