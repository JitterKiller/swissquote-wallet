'use client'

import { useEffect, useRef } from 'react'

/**
 * Generative square field, the world's signature move: a grid of cells on an ink ground where
 * Swissquote-orange cells light in slow diagonal waves and gather around the pointer, like
 * blocks settling onchain. One static frame under reduced motion; paused off screen or when
 * the tab is hidden. Decorative: hidden from assistive tech.
 */
export function BlockField({ className = '', cell = 14, gap = 4 }: { className?: string; cell?: number; gap?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx =
      (canvas.getContext('2d', { colorSpace: 'display-p3' } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null) ??
      canvas.getContext('2d')
    if (!ctx) return

    const root = getComputedStyle(document.documentElement)
    const base = root.getPropertyValue('--hero-2').trim() || '#232323'
    const accent = root.getPropertyValue('--accent').trim() || '#ff5f0f'
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let cols = 0
    let rows = 0
    let ox = 0
    let oy = 0
    let seeds: Float32Array = new Float32Array(0)
    let lit: Uint8Array = new Uint8Array(0)
    const pointer = { x: -1e4, y: -1e4 }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const step = cell + gap

    function layout() {
      const { width, height } = canvas!.getBoundingClientRect()
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.max(1, Math.floor((width + gap) / step))
      rows = Math.max(1, Math.floor((height + gap) / step))
      ox = (width - (cols * step - gap)) / 2
      oy = (height - (rows * step - gap)) / 2
      seeds = new Float32Array(cols * rows).map(() => Math.random())
      // A few cells stay lit: the Account's settled blocks.
      lit = new Uint8Array(cols * rows).map((_, i) => (seeds[i] > 0.965 ? 1 : 0))
    }

    function draw(t: number) {
      const { width, height } = canvas!.getBoundingClientRect()
      ctx!.clearRect(0, 0, width, height)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const x = ox + c * step
          const y = oy + r * step
          ctx!.globalAlpha = 1
          ctx!.fillStyle = base
          ctx!.fillRect(x, y, cell, cell)
          const wave = Math.pow(0.5 + 0.5 * Math.sin(t * 0.0005 + c * 0.32 - r * 0.21 + seeds[i] * 2.4), 18)
          const dx = x + cell / 2 - pointer.x
          const dy = y + cell / 2 - pointer.y
          const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (step * 5))
          const glow = Math.max(lit[i] ? 0.85 : 0, wave * 0.75, near * near * 0.95)
          if (glow > 0.04) {
            ctx!.globalAlpha = glow
            ctx!.fillStyle = accent
            ctx!.fillRect(x, y, cell, cell)
          }
        }
      }
      ctx!.globalAlpha = 1
    }

    layout()
    draw(0)
    if (still) {
      const ro = new ResizeObserver(() => {
        layout()
        draw(0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    let raf = 0
    let last = 0
    let visible = true
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible || document.hidden || t - last < 33) return
      last = t
      draw(t)
    }
    raf = requestAnimationFrame(loop)

    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    io.observe(canvas)
    const ro = new ResizeObserver(layout)
    ro.observe(canvas)
    const host = canvas.parentElement ?? canvas
    const move = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const leave = () => {
      pointer.x = -1e4
      pointer.y = -1e4
    }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerleave', leave)
    }
  }, [cell, gap])

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />
}
