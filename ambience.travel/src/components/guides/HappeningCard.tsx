// HappeningCard.tsx — single happening card for time-bound destination content
//
// Conceptually distinct from ExperienceCard:
//   - Happenings have inherent time windows (Les Grimaldines: 28 July 2026)
//   - Date is the defining attribute, given first-class visual treatment
//   - "ONE EVENING" / "LIMITED DATES" eyebrow replaces category-only kicker
//
// Shape consistency: same card chrome, dimensions, image treatment, and
// address block as ExperienceCard so the grid stays cohesive. The difference
// is internal — date pill, tagline as italic blockquote, website link.
//
// What it owns: card chrome, image, date pill, name, tagline, body, bullets,
//   website link, address block.
// What it does not own: gating logic (consumes hasFullAccess), layout.
//
// Last updated: S52 — initial build for the Coming Up section on
//   ExperiencesGuidePage.

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'
import { resolveMapsUrl } from '../../utils/utilsMapsUrl'
import type { Happening } from '../../queries/queriesGuidesHappenings'

interface HappeningCardProps {
  happening:       Happening
  hasFullAccess:   boolean
  destinationName: string
}

export function HappeningCard({ happening, hasFullAccess, destinationName }: HappeningCardProps) {
  const isTeaser = !hasFullAccess
  return (
    <article style={cardStyle}>
      <ImageBlock happening={happening} isTeaser={isTeaser} />
      <div style={cardBodyStyle}>
        <DateEyebrow happening={happening} />
        <DateLine happening={happening} />
        <h3 style={nameStyle}>{happening.name}</h3>
        {isTeaser
          ? <TeaserBody destinationName={destinationName} />
          : <FullBody happening={happening} />
        }
        <AddressBlock happening={happening} />
      </div>
    </article>
  )
}

// ── Image block ──────────────────────────────────────────────────────────────

function ImageBlock({ happening, isTeaser }: { happening: Happening; isTeaser: boolean }) {
  if (!happening.image_src?.trim()) {
    return (
      <div style={{ ...nameFallbackStyle, opacity: isTeaser ? 0.7 : 1 }}>
        <span style={nameFallbackTextStyle}>{happening.name}</span>
      </div>
    )
  }
  return (
    <div style={imageWrapStyle}>
      <img
        src={happening.image_src}
        alt={happening.image_alt ?? happening.name}
        style={{ ...imageStyle, opacity: isTeaser ? 0.7 : 1 }}
        loading="lazy"
      />
      <div style={imageOverlayStyle} />
    </div>
  )
}

// ── Date eyebrow ─────────────────────────────────────────────────────────────
// "ONE EVENING" for single-day, "LIMITED DATES" for multi-day, with
// optional category appended in muted weight.

function DateEyebrow({ happening }: { happening: Happening }) {
  const isSingleDay = happening.start_date === happening.end_date
  const tag = isSingleDay ? 'One Evening' : 'Limited Dates'
  return (
    <div style={eyebrowStyle}>
      <span style={eyebrowTagStyle}>{tag}</span>
      {happening.category && (
        <>
          <span style={eyebrowDividerStyle}>·</span>
          <span style={eyebrowCategoryStyle}>{happening.category}</span>
        </>
      )}
    </div>
  )
}

// ── Date line ────────────────────────────────────────────────────────────────
// Prominent date treatment — serif, large, the defining attribute of the card.

function DateLine({ happening }: { happening: Happening }) {
  return (
    <div style={dateLineStyle}>{formatDateRange(happening.start_date, happening.end_date)}</div>
  )
}

function formatDateRange(startISO: string, endISO: string): string {
  const start = parseDate(startISO)
  const end   = parseDate(endISO)
  if (startISO === endISO) return formatFullDate(start)
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}\u2013${end.day} ${MONTHS[start.month]} ${start.year}`
  }
  if (start.year === end.year) {
    return `${start.day} ${MONTHS[start.month]} \u2013 ${end.day} ${MONTHS[end.month]} ${start.year}`
  }
  return `${formatFullDate(start)} \u2013 ${formatFullDate(end)}`
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function formatFullDate(d: { year: number; month: number; day: number }): string {
  return `${d.day} ${MONTHS[d.month]} ${d.year}`
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Full body ────────────────────────────────────────────────────────────────

function FullBody({ happening }: { happening: Happening }) {
  const bullets = normalizeBullets(happening.bullets)
  return (
    <>
      {happening.tagline && (
        <p style={taglineStyle}>{happening.tagline}</p>
      )}
      {happening.body && (
        <p style={descriptionStyle}>{happening.body}</p>
      )}
      {bullets.length > 0 && (
        <ul style={bulletsStyle}>
          {bullets.map((b, i) => (
            <li key={i} style={bulletItemStyle}>{b}</li>
          ))}
        </ul>
      )}
      {happening.website_url && (
        <a href={happening.website_url} target="_blank" rel="noopener noreferrer" style={websiteLinkStyle}>
          Visit official site <span style={websiteArrowStyle}>{'\u2197'}</span>
        </a>
      )}
    </>
  )
}

function normalizeBullets(bullets: Happening['bullets']): string[] {
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

function AddressBlock({ happening }: { happening: Happening }) {
  const mapsUrl = resolveMapsUrl(happening.maps_url, happening.address)
  if (!happening.venue_name && !happening.address && !mapsUrl) return null
  return (
    <div style={addressStyle}>
      {happening.venue_name && (
        <div style={venueNameStyle}>{happening.venue_name}</div>
      )}
      {mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={addressLinkStyle}>
          {happening.address ?? 'View on map'} <span style={addressArrowStyle}>{'\u2197'}</span>
        </a>
      ) : happening.address ? (
        <span>{happening.address}</span>
      ) : null}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border:        `1px solid ${IMMERSE.tableBorder}`,
  background:    'linear-gradient(180deg, rgba(216,181,106,0.06), rgba(255,255,255,0.02))',
  borderRadius:  30,
  overflow:      'hidden',
  minHeight:     720,
  boxShadow:     '0 20px 60px rgba(0,0,0,0.20)',
  display:       'flex',
  flexDirection: 'column',
}

const imageWrapStyle: React.CSSProperties = {
  height:     310,
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

const eyebrowStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          8,
  marginBottom: 10,
  fontSize:     11,
  letterSpacing:'0.18em',
  textTransform:'uppercase',
}

const eyebrowTagStyle: React.CSSProperties = {
  color:      ID.gold,
  fontWeight: 700,
}

const eyebrowDividerStyle: React.CSSProperties = {
  color:   ID.dim,
  opacity: 0.7,
}

const eyebrowCategoryStyle: React.CSSProperties = {
  color:      ID.dim,
  fontWeight: 500,
}

const dateLineStyle: React.CSSProperties = {
  fontFamily:    FONTS.serif,
  fontSize:      20,
  fontWeight:    400,
  fontStyle:     'italic',
  color:         ID.gold,
  letterSpacing: '-0.01em',
  marginBottom:  10,
}

const nameStyle: React.CSSProperties = {
  fontFamily:    FONTS.serif,
  fontSize:      32,
  fontWeight:    400,
  lineHeight:    1.04,
  letterSpacing: '-0.04em',
  margin:        '0 0 14px',
  color:         ID.text,
}

const taglineStyle: React.CSSProperties = {
  fontFamily: FONTS.serif,
  fontStyle:  'italic',
  fontSize:   16.5,
  color:      ID.text,
  lineHeight: 1.4,
  margin:     '0 0 16px',
  paddingLeft: 14,
  borderLeft: `2px solid ${ID.gold}`,
  opacity:    0.92,
}

const descriptionStyle: React.CSSProperties = {
  color:      '#ddd4c3',
  lineHeight: 1.62,
  fontSize:   15,
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
  fontSize:    14,
  color:       '#ddd4c3',
  lineHeight:  1.55,
  paddingLeft: 16,
  position:    'relative',
}

const websiteLinkStyle: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  gap:            6,
  color:          ID.gold,
  textDecoration: 'none',
  fontSize:       12,
  letterSpacing:  '0.04em',
  textTransform:  'uppercase',
  fontWeight:     600,
  marginBottom:   18,
  paddingBottom:  3,
  borderBottom:   `1px solid ${ID.gold}40`,
  alignSelf:      'flex-start',
}

const websiteArrowStyle: React.CSSProperties = {
  fontSize: 10,
}

const teaserStyle: React.CSSProperties = {
  color:      ID.dim,
  fontSize:   14,
  fontStyle:  'italic',
  margin:     '0 0 16px',
  lineHeight: 1.55,
}

const addressStyle: React.CSSProperties = {
  paddingTop:    16,
  borderTop:     `1px solid ${IMMERSE.tableBorder}`,
  color:         '#958f84',
  fontSize:      12,
  lineHeight:    1.45,
  marginTop:     'auto',
  display:       'flex',
  flexDirection: 'column',
  gap:           4,
}

const venueNameStyle: React.CSSProperties = {
  color:      '#b8b0a3',
  fontWeight: 600,
  fontSize:   12.5,
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