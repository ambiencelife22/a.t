// GuideLockedPage.tsx — locked state for guide routes
// What it owns: renders when a user hits a guide without a grant.
//   Two states: no session (sign in prompt) vs no grant (access request copy).
// What it does not own: auth logic, grant assignment (admin only).
//
// Sits inside GuideLayout — inherits the guide chrome.
// Design: calm, on-brand. No urgency. Destination name in heading.
//
// Last updated: S40C — initial ship.

import { C } from '../../lib/theme'
import { FONTS } from '../../lib/landingColors'
import type { GuideDestination, GrantStatus } from '../../lib/diningGuideQueries'

const HOME_URL = 'https://ambience.travel/'
const SANS     = '"Inter", "Helvetica Neue", sans-serif'

export default function GuideLockedPage({
  destination,
  grantStatus,
}: {
  destination: GuideDestination
  grantStatus: GrantStatus
}) {
  const isNoSession = grantStatus.status === 'no_session'

  return (
    <div style={{
      minHeight:      '60vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        'clamp(48px, 8vw, 96px) clamp(24px, 6vw, 64px)',
      textAlign:      'center',
      gap:            24,
    }}>
      <div style={{
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color:         C.gold,
        fontFamily:    SANS,
      }}>
        {destination.name} · Dining Guide
      </div>

      <div style={{
        fontSize:   'clamp(24px, 4vw, 36px)',
        fontWeight: 700,
        color:      C.text,
        fontFamily: FONTS.serif,
        lineHeight: 1.2,
        maxWidth:   480,
      }}>
        {isNoSession
          ? 'Sign in to view this guide.'
          : 'This guide is available by invitation.'}
      </div>

      <div style={{
        fontSize:   14,
        color:      C.muted,
        fontFamily: SANS,
        maxWidth:   400,
        lineHeight: 1.6,
      }}>
        {isNoSession
          ? 'This guide is available to invited guests. Sign in to continue.'
          : `The ${destination.name} dining guide is shared privately with invited guests. If you believe you should have access, please contact your ambience advisor.`}
      </div>

      {isNoSession && (
        <a
          href='/sign-in'
          style={{
            display:        'inline-block',
            marginTop:      8,
            padding:        '12px 28px',
            background:     C.gold,
            color:          '#0F1110',
            borderRadius:   10,
            fontSize:       13,
            fontWeight:     700,
            fontFamily:     SANS,
            textDecoration: 'none',
            letterSpacing:  '0.04em',
          }}
        >
          Sign In
        </a>
      )}
      <a
        href={HOME_URL}
        style={{
          fontSize:       12,
          color:          C.faint,
          fontFamily:     SANS,
          textDecoration: 'none',
          marginTop:      isNoSession ? 0 : 8,
        }}
      >
        Return to ambience.travel
      </a>
    </div>
  )
}