// RouteLoading.tsx — Minimal Suspense fallback for route-level lazy loading.
// Used by App.tsx as the fallback for every <Suspense> wrapper around a
// lazy()'d route component. Intentionally chrome-free: at the route-switch
// level we don't yet know which surface (landing / immerse / programme)
// owns the page, so we render a brand-matched waiting state without
// committing to a layout.
//
// Last updated: S30E perf — initial.
//
// Distinct from the LoadingScreen inside ImmerseEngagementRoute: that one
// renders inside ImmerseLayout once the route is resolved (so the nav
// stays visible while the engagement loads). This one renders before any
// route component has even loaded its JS bundle.

export default function RouteLoading() {
  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     '#1A1C1A',
    }}>
      <div style={{
        fontSize:      13,
        color:         '#7A8476',
        letterSpacing: '0.06em',
        fontFamily:    'system-ui, -apple-system, sans-serif',
      }}>
        Loading…
      </div>
    </div>
  )
}