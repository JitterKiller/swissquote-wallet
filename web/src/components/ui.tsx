import { useEffect, useState, type ReactNode } from 'react'

export function Shell({ children }: { children?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">
            SQ
          </div>
          <span className="font-semibold tracking-tight">Swissquote Wallet</span>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
          Base Sepolia · testnet
        </span>
      </header>
      {children}
    </main>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </section>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-fg hover:opacity-90'
      : 'border border-border bg-surface hover:bg-background'
  return (
    <button
      className={`h-11 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const text = `${error.name} ${error.message} ${String(error.cause ?? '')}`
    if (/NotAllowedError|not allowed|AbortError/i.test(text)) return 'Passkey prompt was cancelled.'
    return error.message
  }
  return String(error)
}

/** Current time, re-rendered every second (for countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function formatCountdown(seconds: number) {
  if (seconds <= 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'mock' }) {
  const styles = tone === 'mock' ? 'border-accent text-accent' : 'border-border text-muted'
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${styles}`}>{children}</span>
}
