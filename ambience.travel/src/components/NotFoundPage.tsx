// NotFoundPage.tsx — canonical standalone 404 for unmatched routes
// What it owns:
//   - Full-page not-found render for routes that have no layout context
//   - Used by DiningGuideRoute (and any future guide/public route) when
//     destination validation fails and there is no layout shell to render into
//   - Renders its own dark background — does NOT require a parent layout
//
// What it does not own:
//   - Immerse-layer not-found (ImmerseStateScreens.NotFound — renders inside
//     ImmerseLayout on ID.bg dark surface)
//   - Programme-layer not-found (inline in ProgrammeRoute — renders inside
//     ProgrammeLayout on light surface)
//
// When to use this vs the layer-specific ones:
//   - Route has no layout → NotFoundPage (this file)
//   - Route renders inside ImmerseLayout → ImmerseStateScreens.NotFound
//   - Route renders inside ProgrammeLayout → inline NotFound in ProgrammeRoute
//
// Last updated: S40 — Created. Extracted from null-return pattern in
//   DiningGuideRoute. Gives guide routes a proper branded 404 instead of
//   a blank screen after redirect.

import { ID, FONTS } from '../tokens/tokensLanding'

interface NotFoundPageProps {
  message?:    string
  subMessage?: string
  homeUrl?:    string
  homeLabel?:  string
}

const HOME_URL   = 'https://ambience.travel'
const HOME_LABEL = 'Return to ambience.travel'

export default function NotFoundPage({
  message    = "We couldn't find that page.",
  subMessage,
  homeUrl    = HOME_URL,
  homeLabel  = HOME_LABEL,
}: NotFoundPageProps) {
  return (
    <div style={wrapStyle}>
      <div style={innerStyle}>

        {/* Emblem */}
        <img
          src='/emblem.png'
          alt=''
          style={emblemStyle}
        />

        {/* Message */}
        <p style={messageStyle}>{message}</p>
        {subMessage && (
          <p style={{ margin: 0, fontSize: 15, fontFamily: FONTS.serif, fontWeight: 400, color: ID.muted, lineHeight: 1.6, letterSpacing: '-0.01em' }}>
            {subMessage}
          </p>
        )}

        {/* Return link */}
        <a href={homeUrl} style={linkStyle}>
          {homeLabel} →
        </a>

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  minHeight:       '100vh',
  background:      ID.bg,
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         '0 24px',
}

const innerStyle: React.CSSProperties = {
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            24,
  textAlign:      'center',
  maxWidth:       480,
  animation:      'immerseFadeIn 0.5s ease both',
}

const emblemStyle: React.CSSProperties = {
  width:   52,
  height:  52,
  opacity: 0.55,
}

const messageStyle: React.CSSProperties = {
  margin:        0,
  fontSize:      18,
  fontFamily:    FONTS.serif,
  fontWeight:    400,
  letterSpacing: '-0.01em',
  color:         ID.text,
  lineHeight:    1.6,
}

const linkStyle: React.CSSProperties = {
  fontSize:       13,
  color:          ID.gold,
  textDecoration: 'none',
  letterSpacing:  '0.04em',
}