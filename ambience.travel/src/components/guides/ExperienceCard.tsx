// ExperienceCard.tsx — single experience card for the experiences guide page
// What it owns: card chrome, image, kicker, name, body, bullets, address block.
// What it does not own: gating logic (consumes hasFullAccess prop), layout.
//
// No recognition marks — travel_experiences has no michelin/highlighted columns.
// No image_2 — single image only.
// No tags, cuisine, neighborhood — not on travel_experiences schema.
// No venue_status banner — not on travel_experiences schema.
// Kicker occupies the eyebrow slot.
//
// Last updated: S41 — initial build.

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../lib/landingColors'
import { resolveMapsUrl } from '../../lib/mapsUrl'
import type { ExperienceVenue } from '../../lib/queriesGuidesExperiences'

interface ExperienceCardProps {
  venue:           ExperienceVenue
  hasFullAccess:   boolean
  destinationName: string
}

export function ExperienceCard({ venue, hasFullAccess, destinationName }: ExperienceCardProps) {
  const isTeaser = !hasFullAccess
  return (
    <article style={cardStyle}>
      <ImageBlock venue={venue} isTeaser={isTeaser} />
      <div style={cardBodyStyle}>
        {venue.kicker && (
          <div style={kickerStyle}>{venue.kicker}</div>
        )}
        <h3 style={nameStyle}>{venue.name}</h3>
        {isTeaser
          ? <TeaserBody destinationName={destinationName} />
          : <FullBody venue={venue} />
        }
        <AddressBlock venue={venue} />
      </div>
    </article>
  )
}

// ── Image block ──────────────────────────────────────────────────────────────

function ImageBlock({ venue, isTeaser }: { venue: ExperienceVenue; isTeaser: boolean }) {
  if (!venue.image_src?.trim()) {
    return (
      <div style={{ ...nameFallbackStyle, opacity: isTeaser ? 0.7 : 1 }}>
        <span style={nameFallbackTextStyle}>{venue.name}</span>
      </div>
    )
  }
  return (
    <div style={imageWrapStyle}>
      <img
        src={venue.image_src}
        alt={venue.image_alt ?? venue.name}
        style={{ ...imageStyle, opacity: isTeaser ? 0.7 : 1 }}
        loading="lazy"
      />
      <div style={imageOverlayStyle} />
    </div>
  )
}

// ── Full body ────────────────────────────────────────────────────────────────

function FullBody({ venue }: { venue: ExperienceVenue }) {
  return (
    <>
      {venue.body && (
        <p style={descriptionStyle}>{venue.body}</p>
      )}
      {venue.bullets && venue.bullets.length > 0 && (
        <ul style={bulletsStyle}>
          {venue.bullets.map((b, i) => (
            <li key={i} style={bulletItemStyle}>{b}</li>
          ))}
        </ul>
      )}
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

// ── Address block ────────────────────────────────────────────────────────────

function AddressBlock({ venue }: { venue: ExperienceVenue }) {
  const mapsUrl = resolveMapsUrl(venue.maps_url, venue.address)
  if (!venue.address && !mapsUrl) return null
  return (
    <div style={addressStyle}>
      {mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={addressLinkStyle}>
          {venue.address ?? 'View on map'} <span style={addressArrowStyle}>↗</span>
        </a>
      ) : (
        venue.address
      )}
    </div>
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

const imageWrapStyle: React.CSSProperties = {
  height:   310,
  position: 'relative',
  overflow: 'hidden',
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
  height:          310,
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         '0 32px',
  background:      `linear-gradient(135deg, ${IMMERSE.goldTint}, rgba(154,169,120,0.06)), ${ID.panel2}`,
  borderBottom:    `1px solid ${IMMERSE.tableBorder}`,
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

const kickerStyle: React.CSSProperties = {
  color:         ID.gold,
  fontSize:      11,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  marginBottom:  14,
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

const bulletsStyle: React.CSSProperties = {
  margin:        '0 0 18px',
  padding:       0,
  listStyle:     'none',
  display:       'flex',
  flexDirection: 'column',
  gap:           8,
}

const bulletItemStyle: React.CSSProperties = {
  fontSize:   14,
  color:      '#ddd4c3',
  lineHeight: 1.55,
  paddingLeft: 16,
  position:   'relative',
}

const teaserStyle: React.CSSProperties = {
  color:      ID.dim,
  fontSize:   14,
  fontStyle:  'italic',
  margin:     '0 0 16px',
  lineHeight: 1.55,
}

const addressStyle: React.CSSProperties = {
  paddingTop:  16,
  borderTop:   `1px solid ${IMMERSE.tableBorder}`,
  color:       '#958f84',
  fontSize:    12,
  lineHeight:  1.45,
  marginTop:   'auto',
}

const addressLinkStyle: React.CSSProperties = {
  color:           '#958f84',
  textDecoration:  'none',
  borderBottom:    '1px solid transparent',
  transition:      'border-color 200ms ease, color 200ms ease',
  display:         'inline-flex',
  alignItems:      'center',
  gap:             4,
}

const addressArrowStyle: React.CSSProperties = {
  color:    ID.gold,
  fontSize: 11,
}