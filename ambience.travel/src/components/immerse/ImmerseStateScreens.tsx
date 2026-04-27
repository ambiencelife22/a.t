// ImmerseStateScreens.tsx — Shared loading + error screens for immerse routes.
// Consumed by ImmerseEngagementRoute (overview) and DestinationPage (subpage).
// Both screens render *inside* an ImmerseLayout — the layout is the caller's
// responsibility, so the screens themselves are chrome-free panels designed
// to fill the layout's content area.
//
// Token policy:
//   ImmerseLayout uses ID.bg as the page background (dark — #0E110E ish).
//   Both screens render on that dark surface, so colours come from the ID.*
//   token family directly. Earlier hardcoded hex strings made the message
//   text near-black on near-black — invisible on the immerse dark surface.
//
// Last updated: S32 — Replaced hardcoded hex (#171917, #7A8476, #C9B88E)
//   with ID.text / ID.muted / ID.gold tokens from landingColors. The dark-on-
//   dark "This proposal is not available" message is now legible. Outbound
//   link goes to ambience.travel marketing site.
// Prior: S30E perf — Extracted from ImmerseEngagementRoute to fix the
//   destination subpage white-flash. DestinationPage was returning `null`
//   while loading, producing an unstyled gap between unmount and mount.
//   Both consumers now render LoadingScreen inside ImmerseLayout during
//   load, eliminating the flash.

import { ID } from '../../lib/landingColors'

export function LoadingScreen() {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{
        fontSize:      13,
        color:         ID.muted,
        letterSpacing: '0.06em',
      }}>
        Loading your proposal…
      </div>
    </div>
  )
}

export function NotFound({ message }: { message: string }) {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
      padding:        '0 24px',
      textAlign:      'center',
    }}>
      <div style={{
        fontSize:   20,
        fontWeight: 600,
        color:      ID.text,
      }}>
        {message}
      </div>
      <a
        href='https://ambience.travel'
        style={{
          fontSize:       13,
          color:          ID.gold,
          textDecoration: 'none',
          letterSpacing:  '0.04em',
        }}
      >
        Return to ambience.travel →
      </a>
    </div>
  )
}