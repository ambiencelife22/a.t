// ImmerseComponents.tsx — shared primitives for all /immerse/ proposal components
// Owns: ID palette, useImmerseMobile, immerseFadeUp, useImmerseVisible, shared UI atoms
// Does not own page-level components or data.
// Last updated: S10

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// ID — Immerse Dark palette. Fixed. Matches HTML preview exactly.
export const ID = {
  bg:         '#060606',
  panel:      '#101010',
  panel2:     '#151515',
  line:       '#272727',
  lineSoft:   '#343434',
  text:       '#f5f2ec',
  muted:      '#c9c3b9',
  dim:        '#938c81',
  gold:       '#d8b56a',
  shadow:     '0 24px 64px rgba(0,0,0,0.36)',
  radiusXl:   30,
  radiusLg:   22,
  radiusMd:   16,
} as const

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useImmerseMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < breakpoint) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

export function useImmerseVisible(threshold = 0.10) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function immerseFadeUp(visible: boolean, delayMs = 0): CSSProperties {
  return {
    opacity:    visible ? 1 : 0,
    transform:  visible ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.75s ease ${delayMs}ms, transform 0.75s ease ${delayMs}ms`,
    willChange: 'opacity, transform',
  }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

type SectionWrapProps = {
  children:    ReactNode
  id?:         string
  style?:      CSSProperties
  innerStyle?: CSSProperties
  refProp?:    React.RefObject<HTMLElement>
}

export function ImmerseSectionWrap({ children, id, style, innerStyle, refProp }: SectionWrapProps) {
  return (
    <section
      id={id}
      ref={refProp}
      style={{
        padding:   '58px 0',
        borderTop: `1px solid rgba(255,255,255,0.04)`,
        ...style,
      }}
    >
      <div
        style={{
          width:    'min(1220px, calc(100% - 36px))',
          margin:   '0 auto',
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </section>
  )
}

// ─── Typography atoms ─────────────────────────────────────────────────────────

export function ImmerseEyebrow({ children, style }: { children: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        color:         ID.gold,
        fontSize:      11,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight:    700,
        marginBottom:  14,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function ImmerseTitle({ children, style }: { children: string; style?: CSSProperties }) {
  return (
    <h2
      style={{
        fontSize:      'clamp(32px,4vw,56px)',
        lineHeight:    1.02,
        letterSpacing: '-0.05em',
        fontWeight:    800,
        margin:        '0 0 12px',
        color:         ID.text,
        ...style,
      }}
    >
      {children}
    </h2>
  )
}

export function ImmerseBody({ children, style }: { children: string; style?: CSSProperties }) {
  return (
    <p
      style={{
        color:      ID.muted,
        fontSize:   15,
        lineHeight: 1.82,
        margin:     0,
        ...style,
      }}
    >
      {children}
    </p>
  )
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

type PillProps = { children: string; isGold?: boolean }

export function ImmersePill({ children, isGold }: PillProps) {
  const borderColor = isGold ? 'rgba(216,181,106,0.34)' : ID.lineSoft
  const background  = isGold ? 'rgba(216,181,106,0.08)' : 'rgba(255,255,255,0.02)'
  const color       = isGold ? ID.gold : ID.muted

  return (
    <div
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '10px 14px',
        borderRadius:   999,
        border:         `1px solid ${borderColor}`,
        background,
        color,
        fontSize:       11,
        letterSpacing:  '0.08em',
        textTransform:  'uppercase',
        fontWeight:     800,
        whiteSpace:     'nowrap',
      }}
    >
      {children}
    </div>
  )
}

// ─── Panel card ───────────────────────────────────────────────────────────────

export function ImmersePanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        border:       `1px solid ${ID.line}`,
        borderRadius: ID.radiusXl,
        background:   'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
        boxShadow:    ID.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Stay box ────────────────────────────────────────────────────────────────

export function ImmerseStayBox({ label }: { label: string }) {
  return (
    <div
      style={{
        minWidth:     160,
        flexShrink:   0,
        border:       '1px solid rgba(216,181,106,0.28)',
        borderRadius: 18,
        background:   'rgba(216,181,106,0.08)',
        padding:      '12px 14px',
        textAlign:    'center',
      }}
    >
      <div
        style={{
          fontSize:      10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color:         ID.gold,
          fontWeight:    700,
          marginBottom:  6,
        }}
      >
        Suggested stay
      </div>
      <div
        style={{
          fontSize:      22,
          lineHeight:    1.08,
          letterSpacing: '-0.04em',
          fontWeight:    800,
          color:         ID.text,
        }}
      >
        {label}
      </div>
    </div>
  )
}
