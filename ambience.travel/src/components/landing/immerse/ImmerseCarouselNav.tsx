// ImmerseCarouselNav.tsx — carousel nav helpers shared across hotel + room carousels
// Owns: NavRow (dots + mobile flanking arrows), desktopGutterArrowStyle, mobileNavArrowStyle
// Does not own: any carousel state — pure presentation, all state passed in
// Last updated: S31 — Extracted from ImmerseDestinationComponents.tsx.
//   Mobile arrow size bumped 10% (font 20→22, padding 10/14→11/16) +
//   fontWeight 600 added per S31 brief.
// Prior: S30G — Mobile arrows: removed background pill, border, border-radius.
//   Mobile arrow size shrunk ~11% (font 20, padding 10/14).
//   Mobile carousel arrows moved into dot row (flanking dots).

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
    fontSize: 22,
    cursor: 'pointer',
    opacity: 0.72,
    padding: '8px 6px',
    lineHeight: 1,
    transition: 'opacity 0.2s ease',
    zIndex: 2,
  } as React.CSSProperties
}

export function mobileNavArrowStyle(): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color: ID.text,
    fontSize: 22,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '11px 16px',
    lineHeight: 1,
    transition: 'opacity 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

export function NavRow({ isMobile, total, activeIdx, prevIdx, onChange }: {
  isMobile:   boolean
  total:      number
  activeIdx:  number
  prevIdx:    number | null
  onChange:   (i: number) => void
}) {
  const prevAvailable = activeIdx > 0
  const nextAvailable = activeIdx < total - 1

  const dots = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
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
    return <div style={{ marginTop: 24 }}>{dots}</div>
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <button
        onClick={() => prevAvailable && onChange(activeIdx - 1)}
        style={{
          ...mobileNavArrowStyle(),
          visibility: prevAvailable ? 'visible' : 'hidden',
        }}
        aria-label='Previous'
      >‹</button>
      {dots}
      <button
        onClick={() => nextAvailable && onChange(activeIdx + 1)}
        style={{
          ...mobileNavArrowStyle(),
          visibility: nextAvailable ? 'visible' : 'hidden',
        }}
        aria-label='Next'
      >›</button>
    </div>
  )
}