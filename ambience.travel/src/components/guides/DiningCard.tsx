// DiningCard.tsx — single dining venue card for the guide page
// What it owns: card chrome, image grid, meta-row, name, ambience_take, why-block, tags, address.
// What it does not own: gating logic (consumes hasFullAccess prop), filter state, layout.
// Last updated: S35

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../lib/landingColors'
import { resolveMapsUrl } from '../../lib/mapsUrl'
import type { DiningVenue } from '../../lib/diningGuideQueries'

interface DiningCardProps {
  venue: DiningVenue
  hasFullAccess: boolean
  destinationName: string
}

export function DiningCard({ venue, hasFullAccess, destinationName }: DiningCardProps) {
  const isTeaser = !hasFullAccess

  return (
    <article style={cardStyle}>
      <ImageGrid venue={venue} isTeaser={isTeaser} />
      <div style={cardBodyStyle}>
        <MetaRow venue={venue} />
        <h3 style={nameStyle}>{venue.name}</h3>
        {isTeaser && <TeaserBody destinationName={destinationName} />}
        {!isTeaser && <FullBody venue={venue} />}
      </div>
    </article>
  )
}

// ── Image Grid ───────────────────────────────────────────────────────────────

interface ImageGridProps {
  venue: DiningVenue
  isTeaser: boolean
}

function ImageGrid({ venue, isTeaser }: ImageGridProps) {
  const hasImage1 = venue.image_src && venue.image_src.trim()
  const hasImage2 = venue.image_2_src && venue.image_2_src.trim()
  const count = (hasImage1 ? 1 : 0) + (hasImage2 ? 1 : 0)

  if (count === 0) {
    return <NameFallbackPanel name={venue.name} isTeaser={isTeaser} />
  }

  if (count === 1) {
    return (
      <div style={{ ...imageGridStyle, gridTemplateColumns: '1fr' }}>
        <ImageTile
          src={hasImage1 ? venue.image_src! : venue.image_2_src!}
          alt={hasImage1 ? venue.image_alt : venue.image_2_alt}
          name={venue.name}
          isTeaser={isTeaser}
        />
      </div>
    )
  }

  return (
    <div style={{ ...imageGridStyle, gridTemplateColumns: '1.08fr 0.92fr' }}>
      <ImageTile src={venue.image_src!} alt={venue.image_alt} name={venue.name} isTeaser={isTeaser} />
      <ImageTile src={venue.image_2_src!} alt={venue.image_2_alt} name={venue.name} isTeaser={isTeaser} />
    </div>
  )
}

interface ImageTileProps {
  src: string
  alt: string | null
  name: string
  isTeaser: boolean
}

function ImageTile({ src, alt, name, isTeaser }: ImageTileProps) {
  return (
    <div style={imageTileStyle}>
      <img
        src={src}
        alt={alt ?? name}
        style={{
          ...imageTileImgStyle,
          opacity: isTeaser ? 0.7 : 1,
        }}
        loading="lazy"
      />
      <div style={imageTileOverlayStyle} />
    </div>
  )
}

interface NameFallbackPanelProps {
  name: string
  isTeaser: boolean
}

function NameFallbackPanel({ name, isTeaser }: NameFallbackPanelProps) {
  return (
    <div style={{
      ...nameFallbackStyle,
      opacity: isTeaser ? 0.7 : 1,
    }}>
      <span style={nameFallbackTextStyle}>{name}</span>
    </div>
  )
}

// ── Meta Row ─────────────────────────────────────────────────────────────────

function MetaRow({ venue }: { venue: DiningVenue }) {
  return (
    <div style={metaRowStyle}>
      {venue.cuisine_subcategory && (
        <span style={eyebrowStyle}>{venue.cuisine_subcategory}</span>
      )}
      {venue.michelin && (
        <span style={pillMichelinStyle}>MICHELIN</span>
      )}
    </div>
  )
}

// ── Full Body ────────────────────────────────────────────────────────────────

function FullBody({ venue }: { venue: DiningVenue }) {
  const mapsUrl = resolveMapsUrl(venue.maps_url, venue.address)

  return (
    <>
      {venue.ambience_take && (
        <p style={descriptionStyle}>{venue.ambience_take}</p>
      )}
      {venue.why_recommend && (
        <p style={whyStyle}>
          <strong style={whyStrongStyle}>Why ambience recommends it: </strong>
          {venue.why_recommend}
        </p>
      )}
      {venue.tags && venue.tags.length > 0 && (
        <div style={tagsStyle}>
          {venue.tags.map((tag) => (
            <span key={tag} style={tagPillStyle}>{tag}</span>
          ))}
        </div>
      )}
      {venue.address && (
        <div style={addressStyle}>
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={addressLinkStyle}>
              {venue.address} <span style={addressArrowStyle}>↗</span>
            </a>
          ) : (
            venue.address
          )}
        </div>
      )}
    </>
  )
}

// ── Teaser Body ──────────────────────────────────────────────────────────────

function TeaserBody({ destinationName }: { destinationName: string }) {
  return (
    <p style={teaserStyle}>
      Reserved for guests on a {destinationName} journey.
    </p>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border: `1px solid ${IMMERSE.tableBorder}`,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))',
  borderRadius: 30,
  overflow: 'hidden',
  minHeight: 720,
  boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
  display: 'flex',
  flexDirection: 'column',
}

const imageGridStyle: React.CSSProperties = {
  height: 310,
  display: 'grid',
  gap: 1,
  background: 'rgba(247,241,231,0.1)',
}

const imageTileStyle: React.CSSProperties = {
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
  background: ID.panel2,
}

const imageTileImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  transition: 'opacity 240ms ease',
}

const imageTileOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: IMMERSE.imageOverlaySoft,
  pointerEvents: 'none',
}

const nameFallbackStyle: React.CSSProperties = {
  height: 310,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 32px',
  background: `linear-gradient(135deg, ${IMMERSE.goldTint}, rgba(154,169,120,0.06)), ${ID.panel2}`,
  borderBottom: `1px solid ${IMMERSE.tableBorder}`,
}

const nameFallbackTextStyle: React.CSSProperties = {
  fontFamily: FONTS.serif,
  fontSize: 38,
  fontWeight: 400,
  letterSpacing: '-0.04em',
  color: ID.muted,
  textAlign: 'center',
  lineHeight: 1.05,
  fontStyle: 'italic',
}

const cardBodyStyle: React.CSSProperties = {
  padding: 26,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 14,
  minHeight: 24,
}

const eyebrowStyle: React.CSSProperties = {
  color: ID.gold,
  fontSize: 11,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}

const pillMichelinStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '7px 10px',
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  border: `1px solid ${IMMERSE.goldBorder}`,
  color: ID.gold,
  background: IMMERSE.goldTint,
  fontWeight: 600,
}

const nameStyle: React.CSSProperties = {
  fontFamily: FONTS.serif,
  fontSize: 35,
  fontWeight: 400,
  lineHeight: 1.02,
  letterSpacing: '-0.05em',
  margin: '0 0 14px',
  color: ID.text,
}

const descriptionStyle: React.CSSProperties = {
  color: '#ddd4c3',
  lineHeight: 1.62,
  fontSize: 15.5,
  margin: '0 0 18px',
}

const whyStyle: React.CSSProperties = {
  color: ID.muted,
  lineHeight: 1.55,
  fontSize: 14,
  margin: '0 0 20px',
  padding: 16,
  borderRadius: 18,
  background: 'rgba(247,241,231,0.045)',
  border: '1px solid rgba(247,241,231,0.08)',
}

const whyStrongStyle: React.CSSProperties = {
  color: ID.text,
  fontWeight: 600,
}

const tagsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 18,
}

const tagPillStyle: React.CSSProperties = {
  color: '#d8d1c1',
  background: 'rgba(255,255,255,0.045)',
  border: `1px solid ${IMMERSE.tableBorder}`,
  padding: '7px 10px',
  borderRadius: 999,
  fontSize: 12,
}

const addressStyle: React.CSSProperties = {
  paddingTop: 16,
  borderTop: `1px solid ${IMMERSE.tableBorder}`,
  color: '#958f84',
  fontSize: 12,
  lineHeight: 1.45,
  marginTop: 'auto',
}

const addressLinkStyle: React.CSSProperties = {
  color: '#958f84',
  textDecoration: 'none',
  borderBottom: `1px solid transparent`,
  transition: 'border-color 200ms ease, color 200ms ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

const addressArrowStyle: React.CSSProperties = {
  color: ID.gold,
  fontSize: 11,
}

const teaserStyle: React.CSSProperties = {
  color: ID.dim,
  fontSize: 14,
  fontStyle: 'italic',
  margin: '0 0 0',
  lineHeight: 1.55,
}