// ImmerseStateScreens.tsx — Shared loading + error screens for immerse routes.
// Consumed by ImmerseEngagementRoute (overview) and DestinationPage (subpage).
// Both screens render *inside* an ImmerseLayout — the layout is the caller's
// responsibility, so the screens themselves are chrome-free panels designed
// to fill the layout's content area.
//
// Last updated: S30E perf — Extracted from ImmerseEngagementRoute to fix the
//   destination subpage white-flash. DestinationPage was returning `null`
//   while loading, producing an unstyled gap between unmount and mount.
//   Both consumers now render LoadingScreen inside ImmerseLayout during
//   load, eliminating the flash.

export function LoadingScreen() {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: 13, color: '#7A8476', letterSpacing: '0.06em' }}>
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
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#171917' }}>{message}</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: '#C9B88E', textDecoration: 'none' }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}