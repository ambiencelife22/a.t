// RouteLoading.tsx - Minimal Suspense fallback for route-level lazy loading.
// Used by App.tsx as the fallback for every <Suspense> wrapper around a
// lazy()'d route component. Intentionally chrome-free: at the route-switch
// level we don't yet know which surface (landing / immerse / programme)
// owns the page, so we render a brand-matched waiting state without
// committing to a layout.
//
// Last updated: S30E perf - initial.
//
// Distinct from the LoadingScreen inside ImmerseEngagementRoute: that one
// renders inside ImmerseLayout once the route is resolved (so the nav
// stays visible while the engagement loads). This one renders before any
// route component has even loaded its JS bundle.

import { ID } from '../tokens/tokensLanding'
import { TYPE } from '../tokens/tokensAmbienceTravel'

export default function RouteLoading() {
  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            22,
      background:     ID.bg,
    }}>
      <div style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', overflow: 'hidden' }}>
        <img src='/emblem.png' alt='' style={{ width: '100%', height: '100%', display: 'block', opacity: 0.85 }} />
        <div style={{
          position:       'absolute',
          inset:          0,
          background:     `linear-gradient(105deg, transparent 30%, ${ID.gold}55 50%, transparent 70%)`,
          backgroundSize: '250% 100%',
          mixBlendMode:   'screen',
          animation:      'immerseEmblemShimmer 2.2s ease-in-out infinite',
          pointerEvents:  'none',
        }} />
      </div>
      <div style={{
        fontSize:      12,
        color:         ID.muted,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight:    600,
        fontFamily:    TYPE.sans,
      }}>
        Preparing Your Experience
      </div>
    </div>
  )
}