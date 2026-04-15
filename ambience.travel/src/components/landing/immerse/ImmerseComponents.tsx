// ImmerseComponents.tsx — shared primitives for all /immerse/ proposal components
// Owns: ID palette, useImmerseMobile, immerseFadeUp, useImmerseVisible, shared UI atoms
// Does not own page-level components or data.
// Last updated: S11

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ID, IMMERSE } from '../../../lib/landingColors'
export { ID } from '../../../lib/landingColors'

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
        borderTop: `1px solid ${IMMERSE.borderFaint}`,
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

export function ImmerseEyebrow({ children, style, shimmer = true }: { children: string; style?: CSSProperties; shimmer?: boolean }) {
  return (
    <>
      {shimmer && (
        <style>{`
          @keyframes immerseShimmer {
            0%   { background-position: -200% center; }
            100% { background-position:  200% center; }
          }
        `}</style>
      )}
      <div
        style={{
          color:              shimmer ? 'transparent' : ID.gold,
          fontSize:           11,
          letterSpacing:      '0.22em',
          textTransform:      'uppercase',
          fontWeight:         700,
          marginBottom:       14,
          backgroundImage:    shimmer
            ? `linear-gradient(90deg, ${ID.gold} 0%, ${ID.gold} 35%, ${IMMERSE.shimmer} 50%, ${ID.gold} 65%, ${ID.gold} 100%)`
            : undefined,
          backgroundSize:     shimmer ? '200% auto' : undefined,
          backgroundClip:     shimmer ? 'text' : undefined,
          WebkitBackgroundClip: shimmer ? 'text' : undefined,
          animation:          shimmer ? 'immerseShimmer 2.2s ease 0.3s 1 both' : undefined,
          ...style,
        }}
      >
        {children}
      </div>
    </>
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
  const borderColor = isGold ? IMMERSE.goldBorder : ID.lineSoft
  const background  = isGold ? IMMERSE.goldTint   : IMMERSE.pillBg
  const color       = isGold ? ID.gold            : ID.muted

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
        background:   IMMERSE.panelGradient,
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
        border:       `1px solid ${IMMERSE.goldBorderSoft}`,
        borderRadius: 18,
        background:   IMMERSE.goldTint,
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