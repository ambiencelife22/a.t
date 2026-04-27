// ImmerseComponents.tsx - shared primitives for all /immerse/ proposal components
// Owns: ID palette, useImmerseMobile, immerseFadeUp, useImmerseVisible, shared UI atoms
// Does not own page-level components or data.
// Last updated: S30 — ImmerseWelcomeLetter flipped to left-align + cream light surface.
//   All text tokens inside the welcome block use *OnLight variants
//   (textOnLight, mutedOnLight) per the light-surface token rule earned in
//   S29 Addendum 2 via the ImmerseStayBox muddy-text bug. Section background
//   is IMMERSE.lightSurface. ImmerseTitle received an optional lightSurface
//   prop to swap its default ID.text → IMMERSE.textOnLight.
// Prior: S30 — Added ImmerseWelcomeLetter (initial centered/dark version).
// Prior: S12 — original primitives shipped.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ID, IMMERSE } from '../../lib/landingColors'
export { ID } from '../../lib/landingColors'

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
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.75s ease ${delayMs}ms, transform 0.75s ease ${delayMs}ms`,
    willChange: 'opacity, transform',
  }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

type SectionWrapProps = {
  children: ReactNode
  id?: string
  style?: CSSProperties
  innerStyle?: CSSProperties
  refProp?: React.RefObject<HTMLElement>
}

export function ImmerseSectionWrap({ children, id, style, innerStyle, refProp }: SectionWrapProps) {
  return (
    <section
      id={id}
      ref={refProp}
      style={{
        padding: '58px 0',
        borderTop: `1px solid ${IMMERSE.borderFaint}`,
        ...style,
      }}
    >
      <div
        style={{
          width: 'min(1220px, calc(100% - 36px))',
          margin: '0 auto',
          overflow: 'hidden',
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
          color: shimmer ? 'transparent' : ID.gold,
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 14,
          backgroundImage: shimmer
            ? `linear-gradient(90deg, ${ID.gold} 0%, ${ID.gold} 35%, ${IMMERSE.shimmer} 50%, ${ID.gold} 65%, ${ID.gold} 100%)`
            : undefined,
          backgroundSize: shimmer ? '200% auto' : undefined,
          backgroundClip: shimmer ? 'text' : undefined,
          WebkitBackgroundClip: shimmer ? 'text' : undefined,
          animation: shimmer ? 'immerseShimmer 2.2s ease 0.3s 1 both' : undefined,
          ...style,
        }}
      >
        {children}
      </div>
    </>
  )
}

// S30: lightSurface prop — when rendering on IMMERSE.lightSurface (cream),
// use textOnLight instead of ID.text to avoid the light-on-light muddy-text bug
// earned via S29 Addendum 2 (ImmerseStayBox). Default remains ID.text for
// dark-surface parents (the original use case).
export function ImmerseTitle({
  children, style, serif = false, lightSurface = false,
}: {
  children: string
  style?: CSSProperties
  serif?: boolean
  lightSurface?: boolean
}) {
  return (
    <h2
      style={{
        fontSize: 'clamp(32px,4vw,56px)',
        lineHeight: serif ? 1.08 : 1.02,
        letterSpacing: serif ? '-0.02em' : '-0.05em',
        fontWeight: serif ? 400 : 800,
        fontFamily: serif ? '"Cormorant Garamond", "Cormorant", "Times New Roman", serif' : undefined,
        margin: '0 0 12px',
        color: lightSurface ? IMMERSE.textOnLight : ID.text,
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
        color: ID.muted,
        fontSize: 15,
        lineHeight: 1.82,
        margin: 0,
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
  const background  = isGold ? IMMERSE.goldTint : IMMERSE.pillBg
  const color       = isGold ? ID.gold : ID.muted

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 14px',
        borderRadius: 999,
        border: `1px solid ${borderColor}`,
        background,
        color,
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 800,
        whiteSpace: 'nowrap',
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
        border: `1px solid ${ID.line}`,
        borderRadius: ID.radiusXl,
        background: ID.panel,
        boxShadow: ID.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Stay box ────────────────────────────────────────────────────────────────
// Used on the cream destination-rows section only. All text tokens are *OnLight
// variants — using ID.text / ID.dim here was the S29 muddy-text bug on Nordic +
// NYC stay bricks (dark-theme text on cream surface).

export function ImmerseStayBox({ label, nightlyRange }: { label: string; nightlyRange?: string }) {
  return (
    <div
      style={{
        minWidth: 160,
        flexShrink: 0,
        border: `1px solid ${IMMERSE.goldBorderSoft}`,
        borderRadius: 18,
        background: IMMERSE.goldTint,
        padding: '12px 14px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: ID.gold,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {nightlyRange ? 'Per night' : 'Suggested stay'}
      </div>
      <div
        style={{
          fontSize: nightlyRange ? 16 : 22,
          lineHeight: 1.08,
          letterSpacing: nightlyRange ? '-0.02em' : '-0.04em',
          fontWeight: 800,
          color: IMMERSE.textOnLight,
        }}
      >
        {nightlyRange ?? label}
      </div>
      {nightlyRange && (
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: IMMERSE.mutedOnLight,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

// ─── Welcome letter (S30) ─────────────────────────────────────────────────────
// Renders between Hero 1 and Route Strip on the trip overview page.
// Cream light surface, left-aligned. All text tokens are *OnLight variants.
// Body supports paragraph breaks (split on \n\n).
// Empty-string-means-hide applies at both section and field level:
//   - All 5 fields empty  → entire section hides
//   - Any single field '' → that field hides, others render

export function ImmerseWelcomeLetter({
  eyebrow,
  title,
  body,
  signoffBody,
  signoffName,
}: {
  eyebrow:     string
  title:       string
  body:        string
  signoffBody: string
  signoffName: string
}) {
  const { ref, visible } = useImmerseVisible()

  if (!eyebrow && !title && !body && !signoffBody && !signoffName) return null

  const paragraphs = body
    ? body.split('\n\n').map(p => p.trim()).filter(p => p.length > 0)
    : []

  return (
    <ImmerseSectionWrap
      refProp={ref as React.RefObject<HTMLElement>}
      style={{ background: IMMERSE.lightSurface, borderTop: 'none' }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0',
          textAlign: 'left',
          ...immerseFadeUp(visible),
        }}
      >
        {eyebrow && <ImmerseEyebrow>{eyebrow}</ImmerseEyebrow>}
        {title && <ImmerseTitle serif lightSurface>{title}</ImmerseTitle>}
        {paragraphs.length > 0 && (
          <div style={{ marginTop: 24 }}>
            {paragraphs.map((p, i) => (
              <p
                key={i}
                style={{
                  color: IMMERSE.mutedOnLight,
                  fontSize: 15,
                  lineHeight: 1.82,
                  margin: i === 0 ? 0 : '16px 0 0',
                }}
              >
                {p}
              </p>
            ))}
          </div>
        )}
        {(signoffBody || signoffName) && (
          <div style={{ marginTop: 44 }}>
            {signoffBody && (
              <div
                style={{
                  color: IMMERSE.mutedOnLight,
                  fontSize: 15,
                  lineHeight: 1.82,
                  fontStyle: 'italic',
                }}
              >
                {signoffBody}
              </div>
            )}
            {signoffName && (
              <div
                style={{
                  marginTop: 4,
                  color: IMMERSE.mutedOnLight,
                  fontSize: 15,
                  lineHeight: 1.82,
                }}
              >
                {signoffName}
              </div>
            )}
          </div>
        )}
      </div>
    </ImmerseSectionWrap>
  )
}
