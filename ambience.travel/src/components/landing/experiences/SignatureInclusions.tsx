// SignatureInclusions.tsx — inclusions and exclusions section for signature experience pages
// Owns the two-panel included/excluded list only.
// Last updated: S9

import { useEffect, useState } from 'react'
import { C } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type Props = {
  eyebrow:  string
  title:    string
  body:     string
  included: string[]
  excluded: string[]
}

export default function SignatureInclusions({ eyebrow, title, body, included, excluded }: Props) {
  const { ref, visible }        = useVisible(0.10)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <section
      ref={ref}
      style={{
        padding:      'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        background:   `linear-gradient(180deg, ${C.bg}, #F2ECE2)`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 760, marginBottom: 36 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.gold, marginBottom: 16, ...fadeUp(visible, 0) }}>
            {eyebrow}
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,50px)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.04, color: C.text, marginBottom: 16, ...fadeUp(visible, 80) }}>
            {title}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.muted, margin: 0, ...fadeUp(visible, 160) }}>
            {body}
          </p>
        </div>

        <div
          style={{
            display:             'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)',
            gap:                 22,
            ...fadeUp(visible, 220),
          }}
        >
          {/* Included */}
          <div style={{ background: '#FBFAF7', border: `1px solid ${C.border}`, borderRadius: 26, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: C.text, marginBottom: 18 }}>
              What's included
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {included.map(item => (
                <li key={item} style={{ padding: '13px 14px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 1.6, color: C.text }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Excluded */}
          <div style={{ background: '#FBFAF7', border: `1px solid ${C.border}`, borderRadius: 26, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: C.text, marginBottom: 18 }}>
              What's not included
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {excluded.map(item => (
                <li key={item} style={{ padding: '13px 14px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 1.6, color: C.muted }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}