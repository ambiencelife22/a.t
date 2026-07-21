/* GuideCardHotels.tsx - single hotel card for the hotels guide page.
 *
 * What it owns: card chrome, image, prestige row (stars + forbes + partner),
 *   name, description, address-as-link, website link, teaser body.
 * What it does not own: gating decision (utilsGuideGating: cardBodyMode),
 *   layout, filter state.
 *
 * Visual prestige stack (only renders fields that are populated):
 *   - Star row: repeated star glyph based on stars 1-5
 *   - Forbes pill: "FORBES N\u2605" when forbes_rating is set
 *   - Preferred Partner pill: when is_preferred_partner is true
 *   - Michelin Keys: deferred pending icon asset
 *
 * Body-mode logic:
 *   'full'   - render description + address + website. Full-access viewers,
 *              or hotels marked publicly previewable (public_preview_rank
 *              != null) once that column is added to travel_accom_hotels.
 *   'teaser' - render teaser line only. Public viewers, hotels not marked
 *              publicly previewable.
 *
 * Last updated: S53 - Renamed to convention. cardBodyMode() replaces inline
 *   isTeaser derivation. Ready for public_preview_rank on
 *   travel_accom_hotels; behaviour is identical until that column ships,
 *   since Gateable.publicPreviewRank is optional.
 * Prior: S37 - initial.
 */

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'
import { resolveMapsLink } from '../../utils/utilsMapsUrl'
import { cardBodyMode } from '../../utils/utilsGuideGating'
import type { HotelVenue } from '../../queries/queriesGuidesHotels'

interface GuideCardHotelsProps {
  hotel:           HotelVenue
  hasFullAccess:   boolean
  destinationName: string
}

export function GuideCardHotels({ hotel, hasFullAccess, destinationName }: GuideCardHotelsProps) {
  const bodyMode = cardBodyMode(hotel, hasFullAccess)
  const isTeaser = bodyMode === 'teaser'

  return (
    <article style={cardStyle}>
      <ImageBlock hotel={hotel} isTeaser={isTeaser} />
      <div style={cardBodyStyle}>
        <PrestigeRow hotel={hotel} />
        <h3 style={nameStyle}>{hotel.name}</h3>
        {isTeaser && <TeaserBody destinationName={destinationName} />}
        {!isTeaser && <FullBody hotel={hotel} />}
      </div>
    </article>
  )
}

// ── Image + name-fallback ────────────────────────────────────────────────────

function ImageBlock({ hotel, isTeaser }: { hotel: HotelVenue; isTeaser: boolean }) {
  if (!hotel.heroImageSrc || !hotel.heroImageSrc.trim()) {
    return <NameFallbackPanel name={hotel.name} isTeaser={isTeaser} />
  }
  return (
    <div style={imageTileStyle}>
      <img
        src={hotel.heroImageSrc}
        alt={hotel.heroImageAlt ?? hotel.name}
        style={{ ...imageTileImgStyle, opacity: isTeaser ? 0.7 : 1 }}
        loading="lazy"
      />
      <div style={imageTileOverlayStyle} />
    </div>
  )
}

function NameFallbackPanel({ name, isTeaser }: { name: string; isTeaser: boolean }) {
  return (
    <div style={{ ...nameFallbackStyle, opacity: isTeaser ? 0.7 : 1 }}>
      <span style={nameFallbackTextStyle}>{name}</span>
    </div>
  )
}

// ── Prestige row ─────────────────────────────────────────────────────────────

function PrestigeRow({ hotel }: { hotel: HotelVenue }) {
  const hasStars   = hotel.stars !== null && hotel.stars > 0
  const hasKeys    = hotel.michelinKeys !== null && hotel.michelinKeys > 0
  const hasForbes  = hotel.forbesRating !== null
  const hasPartner = hotel.isPreferredPartner
  if (!hasStars && !hasKeys && !hasForbes && !hasPartner) {
    return <div style={prestigeRowEmptyStyle} />
  }
  return (
    <div style={prestigeRowStyle}>
      {hasStars && (
        <span style={starsStyle} aria-label={`${hotel.stars} star`}>
          {'\u2605'.repeat(hotel.stars!)}
        </span>
      )}
      {hasKeys && (
        <span style={pillKeysStyle}>
          {hotel.michelinKeys} {hotel.michelinKeys === 1 ? 'KEY' : 'KEYS'}
        </span>
      )}
      {hasForbes && (
        <span style={pillForbesStyle}>FORBES {hotel.forbesRating}{'\u2605'}</span>
      )}
      {hasPartner && (
        <span style={pillPartnerStyle}>PREFERRED PARTNER</span>
      )}
    </div>
  )
}

// ── Full body ────────────────────────────────────────────────────────────────

function FullBody({ hotel }: { hotel: HotelVenue }) {
  const fullAddress = [hotel.address, hotel.city, hotel.zip_code].filter(Boolean).join(', ')
  const mapsUrl = resolveMapsLink(hotel.googleMapsUrl, fullAddress || null)

  return (
    <>
      {hotel.description && (
        <p style={descriptionStyle}>{hotel.description}</p>
      )}
      <div style={metaBlockStyle}>
        {fullAddress && (
          <div style={metaRowStyle}>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={metaLinkStyle}>
                {fullAddress} <span style={arrowStyle}>{'\u2197'}</span>
              </a>
            ) : fullAddress}
          </div>
        )}
        {hotel.website && (
          <div style={metaRowStyle}>
            <a href={hotel.website} target="_blank" rel="noopener noreferrer" style={metaLinkStyle}>
              Website <span style={arrowStyle}>{'\u2197'}</span>
            </a>
          </div>
        )}
      </div>
    </>
  )
}

// ── Teaser body ──────────────────────────────────────────────────────────────

function TeaserBody({ destinationName }: { destinationName: string }) {
  return (
    <p style={teaserStyle}>
      Reserved for guests on a {destinationName} journey.
    </p>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border:        `1px solid ${IMMERSE.tableBorder}`,
  background:    'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))',
  borderRadius:  30,
  overflow:      'hidden',
  minHeight:     720,
  boxShadow:     '0 20px 60px rgba(0,0,0,0.20)',
  display:       'flex',
  flexDirection: 'column',
}

const imageTileStyle: React.CSSProperties = {
  height:     310,
  position:   'relative',
  overflow:   'hidden',
  background: ID.panel2,
}

const imageTileImgStyle: React.CSSProperties = {
  width:      '100%',
  height:     '100%',
  objectFit:  'cover',
  display:    'block',
  transition: 'opacity 240ms ease',
}

const imageTileOverlayStyle: React.CSSProperties = {
  position:      'absolute',
  inset:         0,
  background:    IMMERSE.imageOverlaySoft,
  pointerEvents: 'none',
}

const nameFallbackStyle: React.CSSProperties = {
  height:         310,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  padding:        '0 32px',
  background:     `linear-gradient(135deg, ${IMMERSE.goldTint}, rgba(154,169,120,0.06)), ${ID.panel2}`,
  borderBottom:   `1px solid ${IMMERSE.tableBorder}`,
}

const nameFallbackTextStyle: React.CSSProperties = {
  fontFamily:    FONTS.serif,
  fontSize:      38,
  fontWeight:    400,
  letterSpacing: '-0.04em',
  color:         ID.muted,
  textAlign:     'center',
  lineHeight:    1.05,
  fontStyle:     'italic',
}

const cardBodyStyle: React.CSSProperties = {
  padding:       26,
  flex:          1,
  display:       'flex',
  flexDirection: 'column',
}

const prestigeRowStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          10,
  flexWrap:     'wrap',
  marginBottom: 14,
  minHeight:    24,
}

const prestigeRowEmptyStyle: React.CSSProperties = {
  minHeight:    24,
  marginBottom: 14,
}

const starsStyle: React.CSSProperties = {
  color:         ID.gold,
  fontSize:      14,
  letterSpacing: '0.05em',
}

const pillForbesStyle: React.CSSProperties = {
  borderRadius:  999,
  padding:       '7px 10px',
  fontSize:      10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  border:        `1px solid ${IMMERSE.goldBorder}`,
  color:         ID.gold,
  background:    IMMERSE.goldTint,
  fontWeight:    600,
}

const pillKeysStyle: React.CSSProperties = {
  borderRadius:  999,
  padding:       '7px 10px',
  fontSize:      10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  border:        `1px solid ${IMMERSE.goldBorder}`,
  color:         ID.gold,
  background:    IMMERSE.goldTint,
  fontWeight:    600,
}

const pillPartnerStyle: React.CSSProperties = {
  borderRadius:  999,
  padding:       '7px 10px',
  fontSize:      10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  border:        `1px solid ${IMMERSE.tableBorder}`,
  color:         ID.muted,
  background:    'rgba(255,255,255,0.04)',
  fontWeight:    600,
}

const nameStyle: React.CSSProperties = {
  fontFamily:    FONTS.serif,
  fontSize:      35,
  fontWeight:    400,
  lineHeight:    1.02,
  letterSpacing: '-0.05em',
  margin:        '0 0 14px',
  color:         ID.text,
}

const descriptionStyle: React.CSSProperties = {
  color:      '#ddd4c3',
  lineHeight: 1.62,
  fontSize:   15.5,
  margin:     '0 0 18px',
}

const metaBlockStyle: React.CSSProperties = {
  marginTop:     'auto',
  paddingTop:    16,
  borderTop:     `1px solid ${IMMERSE.tableBorder}`,
  display:       'flex',
  flexDirection: 'column',
  gap:           8,
}

const metaRowStyle: React.CSSProperties = {
  color:      '#958f84',
  fontSize:   12,
  lineHeight: 1.45,
}

const metaLinkStyle: React.CSSProperties = {
  color:          '#958f84',
  textDecoration: 'none',
  display:        'inline-flex',
  alignItems:     'center',
  gap:            4,
}

const arrowStyle: React.CSSProperties = {
  color:    ID.gold,
  fontSize: 11,
}

const teaserStyle: React.CSSProperties = {
  color:      ID.dim,
  fontSize:   14,
  fontStyle:  'italic',
  margin:     0,
  lineHeight: 1.55,
}