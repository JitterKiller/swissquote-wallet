'use client'

import { formatUnits, parseUnits } from 'viem'

import { amountFit, Field, Input } from '@/components/ui/field'
import { SUGGESTED_DAILY_LIMIT, USDC_DECIMALS } from '@/lib/config'
import { cleanAmount } from '@/lib/inputs'

export const SUGGESTED_LIMIT = formatUnits(SUGGESTED_DAILY_LIMIT, USDC_DECIMALS)
const PRESETS = ['100', '250', '500', '1000']
const MAX_LIMIT = parseUnits('1000000', USDC_DECIMALS)

/** "250" → 250 USDC in base units, or null while the field is not an amount. */
export function parseDailyLimit(value: string): bigint | null {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null
  try {
    return parseUnits(value, USDC_DECIMALS)
  } catch {
    return null
  }
}

/** The field's error, or null. A limit is more than 0 and at most 1,000,000 USDC (PDR-020). */
export function dailyLimitError(value: string, parsed: bigint | null): string | null {
  if (value && parsed === null) return 'Enter a valid amount.'
  if (parsed !== null && parsed > MAX_LIMIT) return 'Choose at most 1,000,000 USDC.'
  return null
}

/**
 * The daily limit field (PDR-020): the amount in 48px mono with "USDC / day", and the presets. Used
 * by the protect flow and by "Change" on the Security page (#13). `suggested` marks the suggested preset.
 */
export function LimitPicker({
  id,
  label,
  value,
  onChange,
  error,
  suggested = false,
  describedBy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error: string | null
  suggested?: boolean
  /** The element that says what this value does (the worst case before → after). */
  describedBy?: string
}) {
  return (
    <div className="space-y-3">
      <Field label={label} htmlFor={id} error={error}>
        <div className="relative">
          <Input
            id={id}
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(cleanAmount(e.target.value, 2))}
            aria-describedby={describedBy}
            className={`h-[60px] border-[1.5px] border-foreground pr-28 font-mono !text-5xl font-semibold tabular-nums tracking-tight ${amountFit(value, 6)}`}
            autoComplete="off"
          />
          <span className="token pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">USDC / day</span>
        </div>
      </Field>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested limits">
        {PRESETS.map((preset) => {
          const selected = value === preset
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset)}
              className={`h-9 rounded-lg border px-3.5 font-mono text-sm tabular-nums transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] max-sm:h-11 ${
                selected ? 'border-transparent bg-accent font-semibold text-accent-fg' : 'border-border bg-surface text-foreground hover:bg-surface-2'
              }`}
            >
              {Number(preset).toLocaleString('en-US')}
              {suggested && preset === SUGGESTED_LIMIT && (
                <span className={`ml-1.5 font-sans text-[11px] ${selected ? 'text-accent-fg' : 'text-muted'}`}>suggested</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
