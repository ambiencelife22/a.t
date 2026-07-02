// ImmerseNotPublicFallback.tsx — client-facing gate for not-public engagements.
//
// Shown when fetchEngagementClientData returns type='not-public'. The
// engagement exists but public_view = false. This is not a 404 — it is a
// deliberate visibility decision by the operator. Degrade toward human
// contact; never surface an error.
//
// Theme: cream surface, mirrors ProposalArchivedFallback so both soft-gate
// screens read as native to the client surface. Brand chrome is /emblem.png
// only — no invented taglines or copy.
//
// Distinct from:
//   NotFoundPage          — dark surface, engagement genuinely does not exist
//   ProposalArchivedFallback — cream surface, engagement existed and was archived
//
// Created: S53 — P0 gate screen. Replaces NotFoundPage render for not-public
//   engagements in ImmerseEngagementRoute.

const CREAM = '#F7F5F0'
const INK   = '#1A1D1A'
const GOLD  = '#C9A84C'
const MUTED = '#787060'
const FAINT = '#B4AFA5'
const SANS  = "'Plus Jakarta Sans', sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"

export default function ImmerseNotPublicFallback() {
  return (
    <div
      style={{
        minHeight:      '100vh',
        background:      CREAM,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            20,
        padding:        '0 24px',
        textAlign:      'center',
        boxSizing:      'border-box',
      }}
    >
      <img src='/emblem.png' alt='' style={{ width: 52, height: 52, opacity: 0.55, marginBottom: 4 }} />

      <div
        style={{
          fontSize:      10,
          fontFamily:    SANS,
          fontWeight:    700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color:         FAINT,
        }}
      >
        ambience &middot; travel
      </div>

      <div
        style={{
          fontSize:   'clamp(22px, 3vw, 30px)',
          fontFamily: SERIF,
          color:      INK,
          lineHeight: 1.25,
          maxWidth:   520,
        }}
      >
        This page is not publicly visible.
      </div>

      <div
        style={{
          fontSize:   14,
          fontFamily: SANS,
          color:      MUTED,
          lineHeight: 1.7,
          maxWidth:   440,
        }}
      >
        Please reach out to your travel designer for more information.
      </div>

      <div style={{ width: 40, height: 1, background: FAINT, opacity: 0.5, margin: '8px 0 4px' }} />

      <a
        href='https://ambience.travel'
        style={{
          fontSize:       13,
          fontFamily:     SANS,
          color:          GOLD,
          textDecoration: 'none',
          letterSpacing:  '0.02em',
        }}
      >
        Return to ambience.travel {'\u2192'}
      </a>
    </div>
  )
}