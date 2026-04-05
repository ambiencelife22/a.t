/* TripPage.tsx
 * Guest-facing itinerary page for ambience.travel trips.
 * Receives a booking ID, resolves property + listings + welcome letter.
 * Design: ambience.travel system — dark/gold, Plus Jakarta Sans.
 */

import { useEffect, useState } from 'react'
import type { Booking, Property, ManualSection, Listing, ListingCategory } from '../../lib/programmeTypes'
import PropertyIntroSection from './PropertyIntroSection'

// ── Design tokens (inline — self-contained component) ────────────────────────

const T = {
  bg:         '#F7F4EE',
  bgAlt:      '#F3EEE6',
  bgDark:     '#171917',
  bgCard:     '#FFFFFF',
  text:       '#171917',
  muted:      '#4F564F',
  faint:      '#7A8476',
  border:     '#DED7CC',
  gold:       '#C9B88E',
  darkText:   '#F3F4F3',
  darkBody:   '#BFBFBF',
  darkLabel:  '#838383',
  darkBorder: '#333533',
  darkCard:   '#232423',
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: { id: ListingCategory; label: string; icon: string }[] = [
  { id: 'lunch',    label: 'Lunch',      icon: '☀️' },
  { id: 'dinner',   label: 'Dinner',     icon: '🌙' },
  { id: 'takeaway', label: 'Take Away',  icon: '🥡' },
  { id: 'activity', label: 'Activities', icon: '🗺' },
  { id: 'shopping', label: 'Shopping',   icon: '🛍' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function WelcomeLetter({ booking }: { booking: Booking }) {
  const paragraphs = booking.welcomeLetter.split('\n\n').filter(Boolean)

  return (
    <section style={{
      padding:    'clamp(48px,7vw,88px) clamp(20px,5vw,48px)',
      background: T.bg,
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{
          fontSize:      10,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color:         T.faint,
          marginBottom:  24,
        }}>
          Welcome
        </p>
        {paragraphs.map((p: string, i: number) => (
          <p key={i} style={{
            fontSize:     i === 0 ? 'clamp(18px,2vw,24px)' : 16,
            lineHeight:   1.85,
            color:        i === 0 ? T.text : T.muted,
            fontWeight:   i === 0 ? 600 : 400,
            marginBottom: i === paragraphs.length - 1 ? 0 : 20,
            letterSpacing: i === 0 ? '-0.01em' : 'normal',
          }}>
            {p}
          </p>
        ))}
        {/* <div style={{
          marginTop:   36,
          paddingTop:  24,
          borderTop:   `1px solid ${T.border}`,
          fontSize:    13,
          color:       T.gold,
          fontWeight:  600,
          letterSpacing: '0.02em',
        }}>
          {booking.guestNames}
        </div> */}
      </div>
    </section>
  )
}

function ManualBlock({ block }: { block: ManualSection['content'][0] }) {
  if (block.type === 'paragraph') {
    return <p style={{ fontSize: 14, lineHeight: 1.85, color: T.muted, marginBottom: 12 }}>{block.text}</p>
  }
  if (block.type === 'heading') {
    return <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.text, marginBottom: 8, marginTop: 16 }}>{block.text}</p>
  }
  if (block.type === 'list') {
    return (
      <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
        {block.items.map((item: string, i: number) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.8, color: T.muted, marginBottom: 4 }}>{item}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'warning') {
    return (
      <div style={{
        padding:      '12px 16px',
        borderRadius: 12,
        background:   'rgba(201,184,142,0.08)',
        border:       `1px solid rgba(201,184,142,0.25)`,
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: T.muted, margin: 0 }}>
          <span style={{ color: T.gold, fontWeight: 700, marginRight: 6 }}>Note</span>
          {block.text}
        </p>
      </div>
    )
  }
  if (block.type === 'note') {
    return (
      <div style={{
        padding:      '12px 16px',
        borderRadius: 12,
        background:   '#F9F7F2',
        border:       `1px solid ${T.border}`,
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: T.muted, margin: 0 }}>{block.text}</p>
      </div>
    )
  }
  if (block.type === 'wifi') {
    return (
      <div style={{
        padding:      '20px 24px',
        borderRadius: 16,
        background:   T.bgDark,
        marginBottom: 12,
        display:      'flex',
        flexDirection:'column',
        gap:          12,
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.darkLabel, marginBottom: 4 }}>Network</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.darkText, fontFamily: 'monospace' }}>{block.network}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.darkLabel, marginBottom: 4 }}>Password</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.gold, fontFamily: 'monospace' }}>{block.password}</div>
        </div>
      </div>
    )
  }
  return null
}

function HouseManual({ sections }: { sections: ManualSection[] }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <section style={{
      padding:    'clamp(48px,7vw,88px) clamp(20px,5vw,48px)',
      background: T.bgAlt,
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: T.faint, marginBottom: 8 }}>
          House Guide
        </p>
        <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 600, letterSpacing: '-0.03em', color: T.text, marginBottom: 32 }}>
          Everything you need to know.
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sections.map(section => (
            <div key={section.id}>
              <button
                onClick={() => setOpen(open === section.id ? null : section.id)}
                style={{
                  width:          '100%',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '18px 24px',
                  background:     open === section.id ? T.bgCard : 'rgba(255,255,255,0.6)',
                  border:         `1px solid ${open === section.id ? T.border : 'rgba(222,215,204,0.5)'}`,
                  borderRadius:   open === section.id ? '16px 16px 0 0' : 16,
                  cursor:         'pointer',
                  textAlign:      'left',
                  transition:     'background 0.2s ease, border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 18 }}>{section.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{section.title}</span>
                </div>
                <span style={{
                  fontSize:   14,
                  color:      T.faint,
                  transform:  open === section.id ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.25s ease',
                  display:    'inline-block',
                }}>
                  ↓
                </span>
              </button>

              {open === section.id && (
                <div style={{
                  padding:      '24px 24px 20px',
                  background:   T.bgCard,
                  border:       `1px solid ${T.border}`,
                  borderTop:    'none',
                  borderRadius: '0 0 16px 16px',
                }}>
                  {section.content.map((block: ManualSection['content'][0], i: number) => (
                    <ManualBlock key={i} block={block} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <div style={{
      padding:      24,
      borderRadius: 20,
      border:       `1px solid ${T.border}`,
      background:   T.bgCard,
      boxShadow:    '0 4px 16px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: T.text, lineHeight: 1.3 }}>
          {listing.name}
        </h3>
        {listing.favorite && (
          <span style={{
            fontSize:      8,
            fontWeight:    700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding:       '3px 10px',
            borderRadius:  100,
            background:    'rgba(201,184,142,0.12)',
            border:        `1px solid rgba(201,184,142,0.3)`,
            color:         T.gold,
            flexShrink:    0,
            marginLeft:    12,
          }}>
            Favorite
          </span>
        )}
      </div>
      {listing.genre && (
        <p style={{ fontSize: 11, color: T.faint, marginBottom: 10, letterSpacing: '0.04em' }}>{listing.genre}</p>
      )}
      <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: listing.note || listing.hours || listing.website ? 12 : 0 }}>
        {listing.address}
      </p>
      {listing.hours && (
        <p style={{ fontSize: 11, color: T.faint, marginBottom: 8 }}>⏱ {listing.hours}</p>
      )}
      {listing.note && (
        <p style={{ fontSize: 12, color: T.muted, fontStyle: 'italic', lineHeight: 1.6, marginBottom: listing.website ? 12 : 0 }}>
          {listing.note}
        </p>
      )}
      {listing.website && (
        <a
          href={listing.website}
          target='_blank'
          rel='noopener noreferrer'
          style={{
            display:       'inline-block',
            fontSize:      11,
            fontWeight:    600,
            color:         T.gold,
            letterSpacing: '0.04em',
            textDecoration:'none',
          }}
        >
          Visit website →
        </a>
      )}
    </div>
  )
}

function ListingsSection({ listings }: { listings: Listing[] }) {
  const [activeCategory, setActiveCategory] = useState<ListingCategory>('lunch')

  const filtered = listings.filter(l => l.category === activeCategory)

  return (
    <section style={{
      padding:    'clamp(48px,7vw,88px) clamp(20px,5vw,48px)',
      background: T.bg,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: T.faint, marginBottom: 8 }}>
          Local Recommendations
        </p>
        <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 600, letterSpacing: '-0.03em', color: T.text, marginBottom: 32 }}>
          Dining, activities & more.
        </h2>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding:      '9px 20px',
                borderRadius: 100,
                border:       `1px solid ${activeCategory === cat.id ? T.text : T.border}`,
                background:   activeCategory === cat.id ? T.text : 'transparent',
                color:        activeCategory === cat.id ? T.bg : T.muted,
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                letterSpacing:'0.02em',
                transition:   'all 0.2s ease',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap:                 16,
        }}>
          {filtered.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ContactsSection({ property }: { property: Property }) {
  return (
    <section style={{
      padding:    'clamp(48px,7vw,88px) clamp(20px,5vw,48px)',
      background: T.bgDark,
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: T.darkLabel, marginBottom: 8 }}>
          Contacts
        </p>
        <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 600, letterSpacing: '-0.03em', color: T.darkText, marginBottom: 32 }}>
          We're here if you need us.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 32 }}>
          {[property.owner, property.manager].map(contact => (
            <div key={contact.name} style={{
              padding:      '20px 24px',
              borderRadius: 16,
              border:       `1px solid ${T.darkBorder}`,
              background:   T.darkCard,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.darkLabel, marginBottom: 8 }}>
                {contact.role}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.darkText, marginBottom: 4 }}>{contact.name}</div>
              <a href={`tel:${contact.phone}`} style={{ fontSize: 13, color: T.gold, textDecoration: 'none' }}>
                {contact.phone}
              </a>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${T.darkBorder}`, paddingTop: 24 }}>
          <p style={{ fontSize: 11, color: T.darkLabel, marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Emergencies
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {property.emergencies.map((e: Property['emergencies'][0]) => (
              <div key={e.label}>
                <div style={{ fontSize: 11, color: T.darkLabel, marginBottom: 2 }}>{e.label}</div>
                <a href={`tel:${e.phone}`} style={{ fontSize: 14, fontWeight: 600, color: T.darkBody, textDecoration: 'none' }}>
                  {e.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Main TripPage ─────────────────────────────────────────────────────────────

export type TripPageProps = {
  booking:     Booking
  property:    Property
  manual:      ManualSection[]
  listings:    Listing[]
}

export default function TripPage({ booking, property, manual, listings }: TripPageProps) {
  const [heroVis, setHeroVis] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHeroVis(true), 120)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <PropertyIntroSection
        propertyName={property.name}
        location={property.location}
        tagline={property.tagline}
        photos={property.photos}
        heroVis={heroVis}
      />
      <WelcomeLetter booking={booking} />
      <HouseManual sections={manual} />
      <ListingsSection listings={listings} />
      <ContactsSection property={property} />
    </>
  )
}