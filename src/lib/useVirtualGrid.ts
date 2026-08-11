'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface VirtualGrid {
  /** Attach to the scrolling container. */
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** Columns that fit at the current width. */
  columns: number
  /** Full scroll height, so the scrollbar reflects the whole fleet. */
  totalHeight: number
  /** Translate applied to the rendered window. */
  offsetY: number
  /** Indices currently worth rendering. */
  visible: number[]
  /** True once the container has been measured on the client. */
  ready: boolean
}

/**
 * Responsive windowing for a uniform card grid.
 *
 * Two jobs, both required for the monitor to survive a busy hour:
 *   - columns are derived from the measured container width, so the grid
 *     reflows from a 1280px laptop to an ultrawide wallboard without
 *     breakpoints hardcoded per screen;
 *   - only the rows intersecting the viewport (plus a small overscan) are
 *     returned, so 1,284 live calls mount ~20 cards, not 1,284. That bound is
 *     what keeps the canvas-backed orbs affordable — each one is a real
 *     animation, and mounting a thousand would take the tab down.
 */
export function useVirtualGrid({
  count,
  minColumnWidth,
  rowHeight,
  gap = 14,
  overscanRows = 2,
  maxColumns = 8,
}: {
  count: number
  minColumnWidth: number
  rowHeight: number
  gap?: number
  overscanRows?: number
  maxColumns?: number
}): VirtualGrid {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const frame = useRef<number | null>(null)

  // Measure the container, and keep measuring as the window resizes.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      setWidth(box.width)
      setHeight(box.height)
    })
    observer.observe(el)
    setWidth(el.clientWidth)
    setHeight(el.clientHeight)
    return () => observer.disconnect()
  }, [])

  // Scroll is coalesced into an animation frame — a fast trackpad flick fires
  // scroll events far more often than we can usefully re-window.
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || frame.current !== null) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null
      setScrollTop(el.scrollTop)
    })
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [onScroll])

  const ready = width > 0
  const columns = ready
    ? Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minColumnWidth + gap))))
    : 1
  const rows = Math.ceil(count / columns)
  const stride = rowHeight + gap
  const totalHeight = Math.max(0, rows * stride - gap)

  const firstRow = Math.max(0, Math.floor(scrollTop / stride) - overscanRows)
  const visibleRows = Math.ceil((height || rowHeight) / stride) + overscanRows * 2
  const lastRow = Math.min(rows, firstRow + visibleRows)

  const visible: number[] = []
  if (ready) {
    for (let i = firstRow * columns; i < Math.min(lastRow * columns, count); i++) visible.push(i)
  }

  return {
    scrollRef,
    columns,
    totalHeight,
    offsetY: firstRow * stride,
    visible,
    ready,
  }
}
