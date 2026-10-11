import { useId, type ReactNode } from 'react'

const SEAL_TEXT = 'SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY · '

/** The Swissquote seal: orange disc, ink type turning slowly around the SQ mark. */
export function Seal({ size = 104, className = '' }: { size?: number; className?: string }) {
  const ring = `seal-ring-${useId().replace(/:/g, '')}`
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`text-accent ${className}`}
      role="img"
      aria-label="Sponsored by Swissquote, 2 of 2, user majority"
    >
      <defs>
        <path id={ring} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="58" fill="currentColor" />
      <g className="animate-seal" style={{ transformOrigin: '60px 60px', transformBox: 'view-box' }}>
        {/* The ring is 2π·44 ≈ 276 units: the whole text is fitted to it, so nothing is cut. */}
        <text className="fill-accent-fg font-mono" fontSize="9" fontWeight="600">
          <textPath href={`#${ring}`} textLength="275" lengthAdjust="spacingAndGlyphs">
            {SEAL_TEXT}
          </textPath>
        </text>
      </g>
      <text x="60" y="67" textAnchor="middle" className="fill-accent-fg font-sans" fontSize="20" fontWeight="700">
        SQ
      </text>
    </svg>
  )
}

/**
 * A registered ink plate for anything Face ID signs: crosshairs mark two corners, the seal
 * sits half off the top edge. The one place the world turns dark on a light screen.
 */
export function Plate({
  title,
  children,
  seal = true,
  className = '',
}: {
  title?: ReactNode
  children: ReactNode
  seal?: boolean
  className?: string
}) {
  return (
    <section className={`relative rounded-2xl border border-hero-2 bg-hero p-5 text-hero-fg sm:p-6 ${className}`}>
      <Crosshair className="-left-[7px] -top-[7px]" />
      <Crosshair className="-bottom-[7px] -right-[7px]" />
      {seal && <Seal size={120} className="absolute -top-[56px] right-4 sm:right-6" />}
      {title && <p className={`token text-hero-muted ${seal ? 'pr-32 sm:pr-36' : ''}`}>{title}</p>}
      {/* With the seal, the first row starts below its lower edge (64px inside the plate). */}
      <div className={title ? (seal ? 'mt-7' : 'mt-4') : ''}>{children}</div>
    </section>
  )
}

function Crosshair({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 14 14" className={`absolute h-3.5 w-3.5 text-foreground ${className}`}>
      <path d="M7 0v14M0 7h14" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/** A row inside a plate (use inside a <dl>): label on the left, the fact on the right. */
export function PlateRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-hero-2 py-2 text-sm first:border-t-0 first:pt-0">
      <dt className="text-hero-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}
