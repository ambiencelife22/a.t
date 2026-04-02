/* IntroSection.tsx
 * Full-viewport dark brand moment for ambience.travel.
 * Single TravelCard per cycle — image on top, caption + data below.
 * Caption moved out of the image area entirely into the text section.
 * 5 cards, one at a time, alternating left/right anchor positions.
 * Total cycle: 4.4s (fade-in 500ms, hold 3.5s, fade-out 4.0s, next 4.4s).
 */

import { useEffect, useState } from 'react'
import AmbienceLogo from '../AmbienceLogo'
import { C } from '../../lib/landingTypes'
import { TRAVEL_MOMENT_COLORS, WIDGET } from '../../lib/landingColors'

// ── Type ──────────────────────────────────────────────────────────────────────

type TravelCard = {
  src:      string
  caption:  string
  location: string
  type:     string
  status:   'Planning' | 'Confirmed' | 'Enquiry Received'
  detail:   string
  timing:   string
}

// ── Data — 5 cards ────────────────────────────────────────────────────────────

const ITEMS: TravelCard[] = [
  {
    src:      '/landing/serengeti-explorer.webp',
    caption:  'Serengeti Explorer',
    location: 'Serengeti, Tanzania',
    type:     'Extended Journey',
    status:   'Confirmed',
    detail:   'Elewana Collection',
    timing:   'July · 7 nights',
  },
  {
    src:      '/landing/aman-kyoto.webp',
    caption:  'Aman Kyoto',
    location: 'Kyoto, Japan',
    type:     'Wellness Escape',
    status:   'Planning',
    detail:   'Spa & Onsen Retreat',
    timing:   'March · 5 nights',
  },
  {
    src:      '/landing/peninsula-nyc.webp',
    caption:  'The Peninsula',
    location: 'New York City, USA',
    type:     'Signature City Stay',
    status:   'Confirmed',
    detail:   'Peninsula Suite',
    timing:   '4 nights · October',
  },
  {
    src:      '/landing/chenot-weggis.webp',
    caption:  'Chenot Palace',
    location: 'Weggis, Switzerland',
    type:     'Wellness Escape',
    status:   'Enquiry Received',
    detail:   'Detox & Regeneration',
    timing:   '7 nights',
  },
  {
    src:      '/landing/marsan.webp',
    caption:  'Marsan par Hélène Darroze',
    location: 'Paris, France',
    type:     'Signature Dining',
    status:   'Confirmed',
    detail:   'Chef\'s tasting menu',
    timing:   'Friday evening',
  },
  {
    src:      '/landing/waldorf-bh1.webp',
    caption:  'Waldorf Astoria',
    location: 'Beverly Hills, California',
    type:     'Suites & Villas',
    status:   'Planning',
    detail:   'Terrace Villa',
    timing:   '4 nights · May',
  },
  {
    src:      '/landing/global7500.webp',
    caption:  'Bombardier Global 7500',
    location: 'London Luton → Malé',
    type:     'Private Aviation',
    status:   'Confirmed',
    detail:   'Full cabin charter',
    timing:   'June · 9h 40m',
  },
  {
    src:      '/landing/yacht-aerial.webp',
    caption:  'Private Charter',
    location: 'Mediterranean',
    type:     'Yacht & Sea',
    status:   'Confirmed',
    detail:   'Superyacht · 58m',
    timing:   'August · 10 nights',
  },
]

// ── Float positions — 6 anchors, alternating left/right ───────────────────────

const ALL_POSITIONS = [
  { top: '12%', left: 'clamp(16px, 3vw, 48px)',               tx: '0',     ty: '0'    }, // left  top
  { top: '10%', left: 'calc(100% - clamp(16px, 3vw, 48px))',  tx: '-100%', ty: '0'    }, // right top
  { top: '50%', left: 'clamp(16px, 3vw, 48px)',               tx: '0',     ty: '-50%' }, // left  mid
  { top: '45%', left: 'calc(100% - clamp(16px, 3vw, 48px))',  tx: '-100%', ty: '-50%' }, // right mid
  { top: '72%', left: 'clamp(16px, 3vw, 48px)',               tx: '0',     ty: '-50%' }, // left  low
  { top: '68%', left: 'calc(100% - clamp(16px, 3vw, 48px))',  tx: '-100%', ty: '-50%' }, // right low
  { top: '30%', left: 'clamp(16px, 3vw, 48px)',               tx: '0',     ty: '-50%' }, // left  upper-mid
  { top: '28%', left: 'calc(100% - clamp(16px, 3vw, 48px))',  tx: '-100%', ty: '-50%' }, // right upper-mid
]

// ── Timing — 4.4s total cycle ─────────────────────────────────────────────────
const FADE_IN_MS  = 500
const FADE_OUT_MS = 4000
const NEXT_MS     = 4400

// ── TravelCard — image on top, caption + data below ──────────────────────────

function TravelCard({ item }: { item: TravelCard }) {
  const color       = TRAVEL_MOMENT_COLORS[item.type] ?? C.gold
  const statusColor =
    item.status === 'Confirmed'      ? C.green :
    item.status === 'Planning'       ? C.gold  : C.purple

  return (
    <div
      style={{
        width:        320,
        background:   WIDGET.bgInset,
        borderRadius: 16,
        border:       `1px solid ${WIDGET.textFaint}`,
        overflow:     'hidden',
      }}
    >
      {/* Image — pure photo, no overlaid text */}
      <div
        style={{
          width:              '100%',
          height:             160,
          backgroundColor:    WIDGET.bgDeep,
          backgroundImage:    `url(${item.src})`,
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          backgroundRepeat:   'no-repeat',
        }}
      />

      {/* Caption panel — property, location, type pill all in dark panel */}
      <div
        style={{
          padding:      '12px 16px 10px',
          borderBottom: `1px solid ${WIDGET.borderMid}`,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: WIDGET.text, marginBottom: 2, lineHeight: 1.3 }}>
          {item.caption}
        </div>
        <div style={{ fontSize: 11, color: WIDGET.textMid, marginBottom: 8 }}>{item.location}</div>
        <div
          style={{
            display:       'inline-block',
            fontSize:      8,
            fontWeight:    700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            padding:       '3px 9px',
            borderRadius:  100,
            background:    `${color}22`,
            color,
            border:        `1px solid ${color}40`,
          }}
        >
          {item.type}
        </div>
      </div>

      {/* Data row — Stay / Timing / Status */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap:                 1,
          background:          WIDGET.borderMid,
        }}
      >
        {[
          { label: 'Stay',   value: item.detail, color: WIDGET.text  },
          { label: 'Timing', value: item.timing,  color: C.gold       },
          { label: 'Status', value: item.status,  color: statusColor  },
        ].map(cell => (
          <div key={cell.label} style={{ background: WIDGET.bgInset, padding: '8px 10px' }}>
            <div
              style={{
                fontSize:      7,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         WIDGET.textMid,
                marginBottom:  3,
              }}
            >
              {cell.label}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: cell.color, lineHeight: 1.2 }}>
              {cell.value}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding:        '8px 16px',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
        }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, opacity: 0.9 }} />
          <span style={{ fontSize: 9, color: WIDGET.textDim }}>{item.status}</span>
        </div>
        <span style={{ fontSize: 9, color: WIDGET.textFaint }}>Private planning</span>
      </div>
    </div>
  )
}

// ── FloatingItem — one card at a time, alternates sides ──────────────────────

function FloatingItem({ isMobile }: { isMobile: boolean }) {
  const [index,  setIndex]  = useState(0)
  const [phase,  setPhase]  = useState<'in' | 'hold' | 'out'>('in')
  const [posIdx, setPosIdx] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), FADE_IN_MS)
    const t2 = setTimeout(() => setPhase('out'),  FADE_OUT_MS)
    const t3 = setTimeout(() => {
      setIndex(i => (i + 1) % ITEMS.length)
      setPosIdx(p => (p + 1) % ALL_POSITIONS.length)
      setPhase('in')
    }, NEXT_MS)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [index])

  const item    = ITEMS[index]
  const opacity = phase === 'hold' ? 1 : 0
  const scale   = phase === 'hold' ? 1 : phase === 'in' ? 0.95 : 1.01
  const blur    = phase === 'out'  ? 2 : 0
  const pos     = ALL_POSITIONS[posIdx]

  if (isMobile) {
    return (
      <div
        style={{
          position:        'absolute',
          top:             16,
          left:            '50%',
          transform:       `translateX(-50%) scale(${0.72 * scale})`,
          transformOrigin: 'top center',
          opacity:         opacity * 0.86,
          width:           'min(320px, 90vw)',
          pointerEvents:   'none',
          transition:      'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        <TravelCard item={item} />
      </div>
    )
  }

  return (
    <div
      style={{
        position:   'absolute',
        top:        pos.top,
        left:       pos.left,
        transform:  `translate(${pos.tx}, ${pos.ty})`,
        transition: 'top 1s ease, left 1s ease, transform 1s ease',
        opacity:    0.86,
        maxWidth:   320,
      }}
    >
      <div
        style={{
          opacity,
          transform:    `scale(${scale})`,
          filter:       blur ? `blur(${blur}px)` : 'none',
          transition:   'opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          borderRadius: 16,
        }}
      >
        <TravelCard item={item} />
      </div>
    </div>
  )
}

// ── IntroSection ──────────────────────────────────────────────────────────────

export default function IntroSection({ heroVis }: { heroVis: boolean }) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    heroVis ? 1 : 0,
    transform:  heroVis ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
  })

  return (
    <section
      style={{
        minHeight:      '100vh',
        background:     '#1A1A18',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        position:       'relative',
        overflow:       'hidden',
        borderBottom:   `1px solid ${WIDGET.borderMid}`,
      }}
    >
      {/* Grid texture */}
      <div
        style={{
          position:        'absolute',
          inset:           0,
          opacity:         0.08,
          pointerEvents:   'none',
          backgroundImage: 'linear-gradient(rgba(250,248,246,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(250,248,246,0.08) 1px,transparent 1px)',
          backgroundSize:  '56px 56px',
        }}
      />

      {/* Floating card */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <FloatingItem isMobile={isMobile} />
      </div>

      {/* Centre identity */}
      <div
        style={{
          position:       'relative',
          zIndex:         2,
          textAlign:      'center',
          padding:        'clamp(160px,20vw,0px) clamp(20px,5vw,48px) 0',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
        }}
      >
        {/* Emblem */}
        <div style={{ ...fade(0), marginBottom: 28 }}>
          <img
            src='/emblem.png'
            alt='ambience.travel emblem'
            style={{
              width:        72,
              height:       72,
              borderRadius: '50%',
              boxShadow:    '0 0 0 1px rgba(201,184,142,0.35), 0 0 48px rgba(201,184,142,0.22)',
            }}
          />
        </div>

        {/* Logo */}
        <div style={{ ...fade(100), marginBottom: 28 }}>
          <AmbienceLogo isDark={true} height='clamp(88px,4vw,88px)' />
        </div>

        {/* Dual tagline */}
        <div style={{ ...fade(220), marginBottom: 28 }}>
          <p
            style={{
              fontSize:      'clamp(28px,3.5vw,48px)',
              color:         'rgba(255,255,255,0.95)',
              letterSpacing: '-0.02em',
              marginBottom:  8,
              lineHeight:    1.15,
              fontWeight:    700,
            }}
          >
            Quietly exceptional.
          </p>
          <p
            style={{
              fontSize:      'clamp(28px,3.5vw,48px)',
              color:         'rgba(255,255,255,0.35)',
              letterSpacing: '-0.02em',
              lineHeight:    1.15,
              fontWeight:    700,
            }}
          >
            Designed around the guest.
          </p>
        </div>

        {/* Descriptor */}
        <p
          style={{
            ...fade(300),
            fontSize:   'clamp(14px,1.4vw,17px)',
            color:      'rgba(255,255,255,0.5)',
            lineHeight: 1.8,
            maxWidth:   520,
            margin:     '0 auto 48px',
          }}
        >
          Private travel design and discreet coordination for journeys shaped with taste, rhythm, and care.
        </p>

        {/* Scroll indicator */}
        <div style={{ ...fade(400), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: WIDGET.textFaint }}>
            scroll
          </span>
          <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, ${WIDGET.textFaint}, transparent)` }} />
        </div>
      </div>
    </section>
  )
}