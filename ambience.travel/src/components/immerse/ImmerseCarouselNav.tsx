// ImmerseCarouselNav.tsx — carousel nav helpers shared across hotel + room carousels
// Owns: NavRow (dots + mobile flanking arrows), desktopGutterArrowStyle, mobileNavArrowStyle
// Does not own: any carousel state — pure presentation, all state passed in
// Last updated: S31 — Added desktopFlowArrowStyle for inline (non-absolute)
//   desktop arrows. Used by HotelWithRooms room-switch row between RoomCategory
//   and gallery. Disabled state preserved in layout via opacity 0.18.
// Prior: S31 — Desktop gutter arrow size bumped to fontSize 88 +
//   fontWeight 600 (was 22 / regular).
// Prior: S31 — NavRow now optionally preserves its on-screen position
//   across taps via preserveScrollPosition prop. Used by RoomCategory mobile
//   NavRow where content above changes height between rooms (varying bullet
//   counts, rate chips, floorplan link presence) and would otherwise cause
//   page jump. Pure-presentation prop; no state moved.
// Prior: S31 — Mobile arrow size bumped a further 22% (font 22→27,
//   padding 11/16→13/20). fontWeight 600 retained.
// Prior: S31 — Extracted from ImmerseDestinationComponents.tsx.
//   Mobile arrow size bumped 10% (font 20→22, padding 10/14→11/16) +
//   fontWeight 600 added.
// Prior: S30G — Mobile arrows: removed background pill, border, border-radius.
//   Mobile arrow size shrunk ~11% (font 20, padding 10/14).
//   Mobile carousel arrows moved into dot row (flanking dots).

import { useRef, useLayoutEffect } from 'react'
import { ID } from './ImmerseComponents'

export function desktopGutterArrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: -20,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: ID.muted,
    fontSize: 88,
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 0.72,
    padding: '8px 6px',
    lineHeight: 1,
    transition: 'opacity 0.2s ease',
    zIndex: 2,
  } as React.CSSProperties
}

// Desktop flow-positioned arrow (no absolute positioning; sits where it's
// rendered in the layout). Use when the arrows are an inline element of a
// row, not floating in a gutter. Disabled state stays in layout via low
// opacity rather than disappearing.
export function desktopFlowArrowStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color: ID.muted,
    fontSize: 88,
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.18 : 0.72,
    padding: '8px 6px',
    lineHeight: 1,
    transition: 'opacity 0.2s ease',
  }
}

export function mobileNavArrowStyle(): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color: ID.text,
    fontSize: 27,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '13px 20px',
    lineHeight: 1,
    transition: 'opacity 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

export function NavRow({ isMobile, total, activeIdx, prevIdx, onChange, preserveScrollPosition = false }: {
  isMobile:                 boolean
  total:                    number
  activeIdx:                number
  prevIdx:                  number | null
  onChange:                 (i: number) => void
  preserveScrollPosition?:  boolean
}) {
  const prevAvailable = activeIdx > 0
  const nextAvailable = activeIdx < total - 1

  // Scroll-position preservation: when content above the NavRow changes height
  // between taps (e.g. RoomCategory content panel with varying bullet counts),
  // capture pre-tap top and restore post-render so the row stays under the
  // user's finger. Mobile-only — desktop has no equivalent jump issue.
  const rowRef             = useRef<HTMLDivElement>(null)
  const pendingTopRef      = useRef<number | null>(null)

  function handleChange(nextIdx: number) {
    if (preserveScrollPosition && isMobile && rowRef.current) {
      pendingTopRef.current = rowRef.current.getBoundingClientRect().top
    }
    onChange(nextIdx)
  }

  useLayoutEffect(() => {
    if (pendingTopRef.current === null) return
    if (!rowRef.current) return
    const newTop = rowRef.current.getBoundingClientRect().top
    const delta  = newTop - pendingTopRef.current
    pendingTopRef.current = null
    if (delta !== 0) {
      window.scrollBy({ top: delta, left: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [activeIdx])

  const dots = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => handleChange(i)}
          style={{
            width: i === activeIdx ? 22 : 7,
            height: 7,
            borderRadius: 999,
            background: i === activeIdx ? ID.gold : ID.lineSoft,
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'width 0.3s ease, background 0.3s ease',
            animation: i === activeIdx
              ? 'immerseDotPulse 2.4s ease-in-out infinite'
              : i === prevIdx
                ? 'immerseDotDim 0.45s ease-out both'
                : undefined,
          }}
        />
      ))}
    </div>
  )

  if (!isMobile) {
    return <div ref={rowRef} style={{ marginTop: 24 }}>{dots}</div>
  }

  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <button
        onClick={() => prevAvailable && handleChange(activeIdx - 1)}
        style={{
          ...mobileNavArrowStyle(),
          visibility: prevAvailable ? 'visible' : 'hidden',
        }}
        aria-label='Previous'
      >‹</button>
      {dots}
      <button
        onClick={() => nextAvailable && handleChange(activeIdx + 1)}
        style={{
          ...mobileNavArrowStyle(),
          visibility: nextAvailable ? 'visible' : 'hidden',
        }}
        aria-label='Next'
      >›</button>
    </div>
  )
}