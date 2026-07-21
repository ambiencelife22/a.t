// MaintenanceScreen.tsx - platform-wide maintenance gate.
//
// Shown when a_platform_settings.maintenance_mode = true.
// Renders before any engagement fetch - ImmerseEngagementRoute short-circuits
// to this component if the flag is on.
//
// Theme: dark surface (ID tokens), matching the immerse layer. Distinct from
// the cream soft-gate screens (ImmerseNotPublicFallback,
// ImmerseProposalArchivedFallback) - maintenance is a platform-level signal,
// not an engagement-level one. Dark feels more deliberate and appropriate.
//
// No brand chrome beyond /emblem.png and the wordmark - no invented taglines,
// no contact copy that may be wrong. Copy is lighthearted but precise.
//
// Admin bypass: ImmerseEngagementRoute passes ?preview in the URL to skip
// this screen for authenticated admins verifying the live surface.
//
// Created: S53H

import { ID } from '../../tokens/tokensLanding'
import { TYPE } from '../../tokens/tokensAmbienceTravel'

export default function MaintenanceScreen() {
  return (
    <div
      style={{
        minHeight:      '100vh',
        background:     ID.bg,
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
      <img
        src='/emblem.png'
        alt=''
        style={{ width: 48, height: 48, opacity: 0.45, marginBottom: 4 }}
      />

      <div
        style={{
          fontSize:      10,
          fontFamily:    TYPE.sans,
          fontWeight:    700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color:         ID.dim,
        }}
      >
        ambience &middot; travel
      </div>

      <div
        style={{
          width:      48,
          height:     1,
          background: ID.gold,
          opacity:    0.6,
        }}
      />

      <div
        style={{
          fontSize:   'clamp(22px, 3vw, 32px)',
          fontFamily: TYPE.serif,
          fontWeight: 400,
          color:      ID.text,
          lineHeight: 1.15,
          maxWidth:   520,
          letterSpacing: '-0.01em',
        }}
      >
        Even the best journeys have a brief layover.
      </div>

      <div
        style={{
          fontSize:   14,
          fontFamily: TYPE.sans,
          color:      ID.muted,
          lineHeight: 1.8,
          maxWidth:   420,
        }}
      >
        We are making a few quiet adjustments. Everything will be exactly
        where it should be when we return.
      </div>

      <div
        style={{
          marginTop:  12,
          fontSize:   11,
          fontFamily: TYPE.sans,
          color:      ID.dim,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        ambience.travel
      </div>
    </div>
  )
}