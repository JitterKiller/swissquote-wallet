import Link from 'next/link'
import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'hero'
type Size = 'sm' | 'md' | 'lg' | 'action'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent font-semibold text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-border bg-surface text-foreground hover:bg-surface-2',
  ghost: 'text-foreground hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
  // Secondary action on an ink plate.
  hero: 'bg-hero-2 text-hero-fg hover:bg-hero-fg/15',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  // The main actions on a plate: a tile (icon over label) on phones, a large button from sm up.
  action: 'h-16 flex-col gap-1 rounded-xl px-2 text-sm sm:h-12 sm:flex-row sm:gap-2 sm:px-5 sm:text-base',
}

export const buttonSizeClasses = (size: Size) => SIZES[size]

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `inline-flex items-center justify-center font-medium [&_svg]:shrink-0 transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`
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
