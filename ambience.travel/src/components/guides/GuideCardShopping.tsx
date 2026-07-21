/* GuideCardShopping.tsx - single shopping card for the shopping guide.
 *
 * Conceptually distinct from GuideCardExperiences:
 *   Shopping is a reference list (where to buy), not a narrative.
 *   Cards are more compact: smaller image, denser type, 3-column grid.
 *   Shop type carries as eyebrow ("FASHION", "JEWELRY").
 *   "By Appointment" pill when relevant.
 *
 * What it owns: card chrome, image, name, type eyebrow, by-appointment pill,
 *   tagline, body, bullets, address block, teaser body.
 * What it does not own: gating decision (utilsGuideGating: cardBodyMode),
 *   layout, grid.
 *
 * Body-mode logic:
 *   'full'   - render tagline + body + bullets. Full-access viewers, or
 *              shops marked publicly previewable (public_preview_rank
 *              != null) once that column is added to travel_shopping.
 *   'teaser' - render teaser line only. Public viewers, shops not marked
 *              publicly previewable.
 *
 * Last updated: S53 - Renamed to convention. cardBodyMode() replaces inline
 *   isTeaser derivation. Ready for public_preview_rank on
 *   travel_shopping; behaviour is identical until that column ships.
 * Prior: S52 - initial.
 */

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'
import { resolveMapsUrl } from '../../utils/utilsMapsUrl'
import { cardBodyMode } from '../../utils/utilsGuideGating'
import type { Shop } from '../../queries/queriesGuidesShopping'

interface GuideCardShoppingProps {
  shop:            Shop
  hasFullAccess:   boolean
  destinationName: string
}

export function GuideCardShopping({ shop, hasFullAccess, destinationName }: GuideCardShoppingProps) {
  const bodyMode = cardBodyMode(shop, hasFullAccess)
  const isTeaser = bodyMode === 'teaser'

  return (
    <article style={cardStyle}>
      <ImageBlock shop={shop} isTeaser={isTeaser} />
      <div style={cardBodyStyle}>
        <Eyebrow shop={shop} />
        <h3 style={nameStyle}>{shop.name}</h3>
        {isTeaser
          ? <TeaserBody destinationName={destinationName} />
          : <FullBody shop={shop} />
        }
        <AddressBlock shop={shop} />
      </div>
    </article>
  )
}

// ── Image block ──────────────────────────────────────────────────────────────

function ImageBlock({ shop, isTeaser }: { shop: Shop; isTeaser: boolean }) {
  if (!shop.imageSrc?.trim()) {
    return (
      <div style={{ ...nameFallbackStyle, opacity: isTeaser ? 0.7 : 1 }}>
        <span style={nameFallbackTextStyle}>{shop.brand ?? shop.name}</span>
      </div>
    )
  }
  return (
    <div style={imageWrapStyle}>
      <img
        src={shop.imageSrc}
        alt={shop.imageAlt ?? shop.name}
        style={{ ...imageStyle, opacity: isTeaser ? 0.7 : 1 }}
        loading="lazy"
      />
      <div style={imageOverlayStyle} />
    </div>
  )
}

// ── Eyebrow ──────────────────────────────────────────────────────────────────

function Eyebrow({ shop }: { shop: Shop }) {
  if (!shop.shopType && !shop.byAppointment) return null
  return (
    <div style={eyebrowStyle}>
      {shop.shopType && (
        <span style={eyebrowTypeStyle}>{shop.shopType.toUpperCase()}</span>
      )}
      {shop.shopType && shop.byAppointment && (
        <span style={eyebrowDividerStyle}>{'\u00B7'}</span>
      )}
      {shop.byAppointment && (
        <span style={eyebrowAppointmentStyle}>By Appointment</span>
      )}
    </div>
  )
}

// ── Full body ────────────────────────────────────────────────────────────────

function FullBody({ shop }: { shop: Shop }) {
  const bullets = normalizeBullets(shop.bullets)
  return (
    <>
      {shop.tagline && (
        <p style={taglineStyle}>{shop.tagline}</p>
      )}
      {shop.body && (
        <p style={descriptionStyle}>{shop.body}</p>
      )}
      {bullets.length > 0 && (
        <ul style={bulletsStyle}>
          {bullets.map((b, i) => (
            <li key={i} style={bulletItemStyle}>{b}</li>
          ))}
        </ul>
      )}
    </>
  )
}

function normalizeBullets(bullets: Shop['bullets']): string[] {
  if (!Array.isArray(bullets)) return []
  return bullets.map(b => typeof b === 'string' ? b : (b?.text ?? '')).filter(Boolean)
}

// ── Teaser body ──────────────────────────────────────────────────────────────

function TeaserBody({ destinationName }: { destinationName: string }) {
  return (
    <p style={teaserStyle}>
      Reserved for guests on a {destinationName} journey.
    </p>
  )
}

// ── Address block ────────────────────────────────────────────────────────────

function AddressBlock({ shop }: { shop: Shop }) {
  const mapsUrl = resolveMapsUrl(shop.mapsUrl, shop.address)
  if (!shop.address && !mapsUrl) return null
  return (
    <div style={addressStyle}>
      {mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={addressLinkStyle}>
          {shop.address ?? 'View on map'} <span style={addressArrowStyle}>{'\u2197'}</span>
        </a>
      ) : (
        shop.address
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border:        `1px solid ${IMMERSE.tableBorder}`,
  background:    'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))',
  borderRadius:  24,
  overflow:      'hidden',
  minHeight:     500,
  boxShadow:     '0 16px 50px rgba(0,0,0,0.18)',
  display:       'flex',
  flexDirection: 'column',
}

const imageWrapStyle: React.CSSProperties = {
  height:     200,
  position:   'relative',
  overflow:   'hidden',
  background: ID.panel2,
}

const imageStyle: React.CSSProperties = {
  width:      '100%',
  height:     '100%',
  objectFit:  'cover',
  display:    'block',
  transition: 'opacity 240ms ease',
}

const imageOverlayStyle: React.CSSProperties = {
  position:      'absolute',
  inset:         0,
  background:    IMMERSE.imageOverlaySoft,
  pointerEvents: 'none',
}

const nameFallbackStyle: React.CSSProperties = {
  height:         200,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  padding:        '0 24px',
  background:     `linear-gradient(135deg, ${IMMERSE.goldTint}, rgba(154,169,120,0.06)), ${ID.panel2}`,
  borderBottom:   `1px solid ${IMMERSE.tableBorder}`,
}

const nameFallbackTextStyle: React.CSSProperties = {
  fontFamily:    FONTS.serif,
  fontSize:      26,
  fontWeight:    400,
  letterSpacing: '-0.03em',
  color:         ID.muted,
  textAlign:     'center',
  lineHeight:    1.05,
  fontStyle:     'italic',
}

const cardBodyStyle: React.CSSProperties = {
  padding:       22,
  flex:          1,
  display:       'flex',
  flexDirection: 'column',
}

const eyebrowStyle: React.CSSProperties = {
  display:       'flex',
  alignItems:    'center',
  gap:           7,
  marginBottom:  10,
  fontSize:      10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}

const eyebrowTypeStyle: React.CSSProperties = {
  color:      ID.gold,
  fontWeight: 700,
}

const eyebrowDividerStyle: React.CSSProperties = {
  color:   ID.dim,
  opacity: 0.7,
}

const eyebrowAppointmentStyle: React.CSSProperties = {
  color:      ID.dim,
  fontWeight: 500,
}

const nameStyle: React.CSSProperties = {
  fontFamily:    FONTS.serif,
  fontSize:      26,
  fontWeight:    400,
  lineHeight:    1.05,
  letterSpacing: '-0.04em',
  margin:        '0 0 12px',
  color:         ID.text,
}

const taglineStyle: React.CSSProperties = {
  fontFamily: FONTS.serif,
  fontStyle:  'italic',
  fontSize:   14,
  color:      ID.text,
  lineHeight: 1.4,
  margin:     '0 0 12px',
  opacity:    0.9,
}

const descriptionStyle: React.CSSProperties = {
  color:      '#ddd4c3',
  lineHeight: 1.58,
  fontSize:   13.5,
  margin:     '0 0 14px',
}

const bulletsStyle: React.CSSProperties = {
  margin:        '0 0 14px',
  padding:       0,
  listStyle:     'none',
  display:       'flex',
  flexDirection: 'column',
  gap:           6,
}

const bulletItemStyle: React.CSSProperties = {
  fontSize:    12.5,
  color:       '#ddd4c3',
  lineHeight:  1.5,
  paddingLeft: 14,
  position:    'relative',
}

const teaserStyle: React.CSSProperties = {
  color:      ID.dim,
  fontSize:   13,
  fontStyle:  'italic',
  margin:     '0 0 14px',
  lineHeight: 1.55,
}

const addressStyle: React.CSSProperties = {
  paddingTop: 14,
  borderTop:  `1px solid ${IMMERSE.tableBorder}`,
  color:      '#958f84',
  fontSize:   11.5,
  lineHeight: 1.45,
  marginTop:  'auto',
}

const addressLinkStyle: React.CSSProperties = {
  color:          '#958f84',
  textDecoration: 'none',
  borderBottom:   '1px solid transparent',
  transition:     'border-color 200ms ease, color 200ms ease',
  display:        'inline-flex',
  alignItems:     'center',
  gap:            4,
}

const addressArrowStyle: React.CSSProperties = {
  color:    ID.gold,
  fontSize: 11,
}