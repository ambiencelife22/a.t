// ImmerseShimmer.tsx — section-level loading placeholder for /immerse/ subpages
// Owns: SectionShimmer (single primitive), HotelsShimmer, ContentGridShimmer, PricingShimmer
//   — wrappers that match each section's approximate footprint so the page
//   doesn't jump when real content lands.
// Does not own: full-screen loading (TravelLoadingScreen in ImmerseStateScreens),
//   keyframes (src/index.css)
//
// Last updated: S32F — Initial shimmer primitive for progressive reveal of
//   destination subpage. Pairs with the 4-stream fetch in DestinationPage:
//   core lands → hero paints → hotels/cards/cards2/pricing each shimmer in
//   place until their slice arrives. Visual: flat panel with subtle gold-
//   tinted gradient sweep, sized to roughly match the real section so layout
//   doesn't jump.

import { ID } from '../../lib/landingColors'

// ─── Single primitive ────────────────────────────────────────────────────────

export function SectionShimmer({
  height,
  background = ID.bg,
  fullBleed   = false,
}: {
  height:      number | string
  background?: string
  fullBleed?:  boolean
}) {
  return (
    <section
      style={{
        position:   'relative',
        background,
        overflow:   'hidden',
        padding:    fullBleed ? 0 : '58px 0',
      }}
    >
      <div style={{
        width:        fullBleed ? '100%' : 'min(1220px, calc(100% - 36px))',
        margin:       '0 auto',
        height,
        borderRadius: fullBleed ? 0 : ID.radiusLg,
        background:   ID.panel,
        border:       `1px solid ${ID.line}`,
        position:     'relative',
        overflow:     'hidden',
      }}>
        {/* Gold-tinted sweep — slow, single direction, subtle */}
        <div style={{
          position:   'absolute',
          inset:      0,
          background: `linear-gradient(90deg, transparent 0%, rgba(216,181,106,0.06) 50%, transparent 100%)`,
          backgroundSize: '200% 100%',
          animation:  'immerseShimmerSweep 2.4s ease-in-out infinite',
        }} />
      </div>
    </section>
  )
}

// ─── Section-shaped wrappers ─────────────────────────────────────────────────

// Hotels section — large; selector + detail panel + carousel + gallery.
export function HotelsShimmer() {
  return <SectionShimmer height={520} />
}

// Content grid (Dining or Experiences) — header + 3-card grid.
export function ContentGridShimmer({ dark = false }: { dark?: boolean }) {
  return <SectionShimmer height={460} background={dark ? ID.bg : '#0a0a0a'} />
}

// Pricing — 2-panel grid.
export function PricingShimmer() {
  return <SectionShimmer height={420} background='#060606' />
}