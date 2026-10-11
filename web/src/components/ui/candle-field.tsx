'use client'

import { useEffect, useRef } from 'react'

const STEP = 16 // candle pitch, px
const BODY = 10 // candle body width, px
const PERIOD = 1600 // one candle, ms of simulated time
const TICK = 120 // one price tick, ms
const HISTORY = 160
// Chosen so the first window is range-bound: half the candles close up, no trend, no long runs.
const SEED = 3680

type Candle = { open: number; high: number; low: number; close: number }

/** Small seeded PRNG: the first frame is already a full chart, the same on every visit. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generative candlestick chart on the ink panel, the onboarding's signature: candles scroll left
 * at a constant pace while the newest one forms, Swissquote orange when the price closes up, a
 * 1px Plate Grey outline on ink when it closes down, and a crosshair follows the pointer.
 * Decorative and unlabelled (no asset, no prices, no drift): it evokes the trading bank, it is not
 * market data and it never implies performance. One still frame under reduced motion; stopped off
 * screen or when hidden. Hidden from assistive tech.
 */
export function CandleField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx =
      (canvas.getContext('2d', { colorSpace: 'display-p3' } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null) ??
      canvas.getContext('2d')
    if (!ctx) return

    const root = getComputedStyle(document.documentElement)
    const token = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback
    const rule = token('--hero-2', '#232323')
    const grey = token('--hero-muted', '#a3a3a3')
    const accent = token('--accent', '#ff5f0f')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const random = seeded(SEED)

    // Price: a driftless random walk pulled toward a slowly wandering anchor, itself pulled back to 100.
    let price = 100
    let anchor = 100
    const nextPrice = () => {
      anchor += (random() - 0.5) * 0.4 + (100 - anchor) * 0.004
      price += (random() - 0.5) * 1.2 + (anchor - price) * 0.08
      return price
    }
    const formCandle = (open: number, ticks = PERIOD / TICK): Candle => {
      const c = { open, high: open, low: open, close: open }
      for (let i = 0; i < ticks; i++) {
        const p = nextPrice()
        c.high = Math.max(c.high, p)
        c.low = Math.min(c.low, p)
        c.close = p
      }
      return c
    }

    const history: Candle[] = []
    for (let i = 0; i < 64; i++) history.push(formCandle(history.at(-1)?.close ?? price))
    // A page-wide canvas (the landing) needs more than the panel's 64 candles to start full. Older
    // ones come from a second seeded walk, levelled to join the first, so the panel's own window
    // (the newest candles) is unchanged.
    const backfill = Math.min(HISTORY, Math.ceil(window.innerWidth / STEP) + 4) - history.length
    if (backfill > 0) {
      const r = seeded(SEED + 1)
      let p = 100
      let a = 100
      const older: Candle[] = []
      for (let i = 0; i < backfill; i++) {
        const c = { open: p, high: p, low: p, close: p }
        for (let t = 0; t < PERIOD / TICK; t++) {
          a += (r() - 0.5) * 0.4 + (100 - a) * 0.004
          p += (r() - 0.5) * 1.2 + (a - p) * 0.08
          c.high = Math.max(c.high, p)
          c.low = Math.min(c.low, p)
          c.close = p
        }
        older.push(c)
      }
      const shift = history[0].open - older[older.length - 1].close
      history.unshift(...older.map((c) => ({ open: c.open + shift, high: c.high + shift, low: c.low + shift, close: c.close + shift })))
    }
    // The newest candle starts half formed, so a still frame shows a real candle, not a dash.
    let live = formCandle(history.at(-1)!.close, Math.floor(PERIOD / TICK / 2))
    let target = live.close // where the live close is heading
    let sim = 0 // simulated ms: it stops while the canvas is hidden
    let liveStart = -PERIOD / 2
    let nextTick = 0
    let yMin = 0
    let yMax = 0
    let width = 0
    let height = 0
    const pointer = { x: -1, y: -1, inside: false }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const visibleCount = () => Math.ceil(width / STEP) + 2

    function range() {
      let lo = Math.min(live.low, live.close)
      let hi = Math.max(live.high, live.close)
      for (let k = 1; k < visibleCount() && k <= history.length; k++) {
        const c = history[history.length - k]
        lo = Math.min(lo, c.low)
        hi = Math.max(hi, c.high)
      }
      const pad = (hi - lo) * 0.12 || 1
      return [lo - pad, hi + pad] as const
    }

    function advance(dt: number) {
      sim += dt
      while (sim >= nextTick) {
        target = nextPrice()
        live.high = Math.max(live.high, target)
        live.low = Math.min(live.low, target)
        nextTick += TICK
      }
      // The live close glides to the last tick instead of jumping.
      live.close += (target - live.close) * (1 - Math.exp(-dt / 90))
      if (sim - liveStart >= PERIOD) {
        history.push({ ...live, close: target })
        if (history.length > HISTORY) history.splice(0, history.length - HISTORY)
        live = { open: target, high: target, low: target, close: target }
        liveStart += PERIOD
      }
      // The vertical scale eases toward the visible range, so a new high never snaps the chart.
      const [lo, hi] = range()
      const k = 1 - Math.exp(-dt / 450)
      yMin += (lo - yMin) * k
      yMax += (hi - yMax) * k
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height)
      if (width === 0 || height === 0) return
      const top = 10
      const span = height - 20
      const y = (p: number) => top + ((yMax - p) / (yMax - yMin || 1)) * span
      const crisp = (v: number) => Math.round(v * dpr) / dpr
      const line = 1 // hairlines are one CSS pixel, positions snapped to device pixels

      // Four quiet rules, like a chart's grid, with no labels.
      ctx!.fillStyle = rule
      for (let i = 1; i <= 4; i++) ctx!.fillRect(0, crisp((height * i) / 5), width, line)

      // Candles sit on a pixel-snapped layer; the layer itself slides by an unrounded offset (no judder).
      const shift = still ? 0 : Math.min(1, (sim - liveStart) / PERIOD) * STEP
      const right = crisp(width - STEP * 1.5)
      ctx!.save()
      ctx!.translate(-shift, 0)
      for (let k = 0; k < visibleCount(); k++) {
        const c = k === 0 ? live : history[history.length - k]
        if (!c) break
        const cx = right - k * STEP
        const onScreen = cx - shift
        if (onScreen < -STEP) break
        // Candles fade out over the last 48px as they leave on the left.
        ctx!.globalAlpha = Math.max(0, Math.min(1, (onScreen + BODY) / 48))
        const up = c.close >= c.open
        const x = cx - BODY / 2
        const bodyTop = crisp(y(Math.max(c.open, c.close)))
        const bodyBottom = Math.max(bodyTop + line, crisp(y(Math.min(c.open, c.close))))
        const high = crisp(y(c.high))
        const low = Math.max(bodyBottom, crisp(y(c.low)))
        ctx!.fillStyle = up ? accent : grey
        if (up) {
          ctx!.fillRect(cx - line / 2, high, line, low - high)
          ctx!.fillRect(x, bodyTop, BODY, bodyBottom - bodyTop)
        } else {
          // A true 1px outline: the ink ground shows through, at any opacity.
          ctx!.fillRect(cx - line / 2, high, line, bodyTop - high)
          ctx!.fillRect(cx - line / 2, bodyBottom, line, low - bodyBottom)
          ctx!.fillRect(x, bodyTop, BODY, line)
          ctx!.fillRect(x, bodyBottom - line, BODY, line)
          ctx!.fillRect(x, bodyTop, line, bodyBottom - bodyTop)
          ctx!.fillRect(x + BODY - line, bodyTop, line, bodyBottom - bodyTop)
        }
        if (pointer.inside && Math.abs(pointer.x - onScreen) <= STEP / 2) {
          ctx!.globalAlpha = 1
          ctx!.strokeStyle = grey
          ctx!.lineWidth = line
          ctx!.strokeRect(x - 3 + line / 2, bodyTop - 3 + line / 2, BODY + 6 - line, bodyBottom - bodyTop + 6 - line)
        }
      }
      ctx!.restore()
      ctx!.globalAlpha = 1

      // The last price: a steady grey dashed hairline; only its square marker takes the live candle's colour.
      const last = crisp(y(live.close))
      ctx!.strokeStyle = grey
      ctx!.lineWidth = line
      ctx!.globalAlpha = 0.4
      ctx!.setLineDash([3, 3])
      ctx!.beginPath()
      ctx!.moveTo(0, last + line / 2)
      ctx!.lineTo(width, last + line / 2)
      ctx!.stroke()
      ctx!.setLineDash([])
      ctx!.globalAlpha = 1
      ctx!.fillStyle = live.close >= live.open ? accent : grey
      ctx!.fillRect(width - 6, last - 3, 6, 6)

      // Crosshair under the pointer (the plates' registration mark, at chart scale).
      if (pointer.inside) {
        ctx!.fillStyle = grey
        ctx!.globalAlpha = 0.5
        ctx!.fillRect(crisp(pointer.x), 0, line, height)
        ctx!.fillRect(0, crisp(pointer.y), width, line)
        ctx!.globalAlpha = 1
      }
    }

    layout()
    ;[yMin, yMax] = range()
    draw()

    const ro = new ResizeObserver(() => {
      layout()
      draw()
    })
    ro.observe(canvas)
    const host = canvas.parentElement ?? canvas
    const move = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height
      if (still) draw()
    }
    const leave = () => {
      pointer.inside = false
      if (still) draw()
    }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)

    if (still) {
      return () => {
        ro.disconnect()
        host.removeEventListener('pointermove', move)
        host.removeEventListener('pointerleave', leave)
      }
    }

    // Every frame while on screen (the slide needs it); no loop at all while hidden or off screen.
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = last ? Math.min(t - last, 100) : 16
      last = t
      if (document.hidden) return
      advance(dt)
      draw()
    }
    const startLoop = () => {
      if (raf) return
      last = 0
      raf = requestAnimationFrame(loop)
    }
    const stopLoop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? startLoop() : stopLoop()))
    io.observe(canvas)

    return () => {
      stopLoop()
      io.disconnect()
      ro.disconnect()
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerleave', leave)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />
}
