/* ProgrammePage.tsx
 * Guest-facing stay programme page for ambience.travel.
 * Uses C.* from theme.ts and DANGER from colors.ts — no hardcoded hex.
 */

import { useEffect, useState } from 'react'
import { C } from '../../lib/theme'
import { DANGER } from '../../lib/colors'
import type { Booking, Property, ManualSection, Listing, ListingCategory } from '../../lib/programmeTypes'
import PropertyIntroSection from './PropertyIntroSection'

// ── Travel-specific light-section tokens ──────────────────────────────────────
// These are fixed light values used in the guest-facing light sections.
// Not part of the dark theme — intentional contrast with the dark hero.

const L = {
  bg:     '#F7F4EE',
  bgAlt:  '#F3EEE6',
  bgCard: '#FFFFFF',
  text:   '#171917',
  muted:  '#4F564F',
  faint:  '#7A8476',
  border: '#DED7CC',
  gold:   '#C9B88E',
}


// ── Gated value — shown when a field is not visible on public programmes ───────

function GatedValue() {
  return (
    <span style={{
      fontSize:      12,
      color:         L.faint,
      fontStyle:     'italic',
      letterSpacing: '0.02em',
    }}>
      Ask your host
    </span>
  )
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
    <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: L.bg }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: L.faint, marginBottom: 24 }}>
          Welcome
        </p>
        {paragraphs.map((p: string, i: number) => (
          <p key={i} style={{
            fontSize:      i === 0 ? 'clamp(18px,2vw,24px)' : 16,
            lineHeight:    1.85,
            color:         i === 0 ? L.text : L.muted,
            fontWeight:    i === 0 ? 600 : 400,
            marginBottom:  i === paragraphs.length - 1 ? 0 : 20,
            letterSpacing: i === 0 ? '-0.01em' : 'normal',
          }}>
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}

function ManualBlock({ block, isPublic, publicWifi, publicAlarm }: { block: ManualSection['content'][0]; isPublic: boolean; publicWifi: boolean; publicAlarm: boolean }) {
  if (block.type === 'paragraph') {
    return <p style={{ fontSize: 14, lineHeight: 1.85, color: L.muted, marginBottom: 12 }}>{block.text}</p>
  }
  if (block.type === 'heading') {
    return (
      <div style={{
        borderLeft:  `3px solid ${L.gold}`,
        paddingLeft: 12,
        marginBottom: 10,
        marginTop:   20,
      }}>
        <p style={{
          fontSize:      13,
          fontWeight:    700,
          color:         L.text,
          margin:        0,
          letterSpacing: '0.01em',
        }}>{block.text}</p>
      </div>
    )
  }
  if (block.type === 'list') {
    return (
      <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
        {block.items.map((item: string, i: number) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.8, color: L.muted, marginBottom: 4 }}>{item}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'warning') {
    return (
      <div style={{
        padding:      '12px 16px',
        borderRadius: 12,
        background:   `${DANGER}0f`,
        border:       `1px solid ${DANGER}40`,
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: L.muted, margin: 0 }}>
          <span style={{ color: DANGER, fontWeight: 700, marginRight: 6 }}>Warning</span>
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
        border:       `1px solid ${L.border}`,
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: L.muted, margin: 0 }}>{block.text}</p>
      </div>
    )
  }
  if (block.type === 'wifi') {
    const showWifi = !isPublic || publicWifi
    return (
      <div style={{
        padding:       '20px 24px',
        borderRadius:  16,
        background:    C.bg,
        marginBottom:  12,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.faint, marginBottom: 4 }}>Network</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: 'monospace' }}>
            {showWifi ? block.network : <GatedValue />}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.faint, marginBottom: 4 }}>Password</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.gold, fontFamily: 'monospace' }}>
            {showWifi ? block.password : <GatedValue />}
          </div>
        </div>
      </div>
    )
  }
  return null
}

function HouseManual({ sections, isPublic, publicWifi, publicAlarm, noAlarm, publicArrival, publicOwnerPhone, publicManagerPhone, mapsUrl }: { sections: ManualSection[]; isPublic: boolean; publicWifi: boolean; publicAlarm: boolean; noAlarm: boolean; publicArrival: boolean; publicOwnerPhone: boolean; publicManagerPhone: boolean; mapsUrl: string | null }) {
  const [open, setOpen] = useState<string | null>(null)

  // Section gating:
  // - Arrival: if public and not revealed, replace with redacted content + note
  // - Alarm: if public and not revealed, prepend gated note to content
  const resolvedSections = sections.map(section => {
    if (section.title === 'Arrival' && isPublic && !publicArrival) {
      return {
        ...section,
        content: [
          { type: 'paragraph' as const, text: 'This lovely condo is located at XXXX. On arrival, your host will greet you at street level, give you the keys, and escort you up.' },
          { type: 'note'      as const, text: 'Should your host be in the condo or not at street level, touch the call button X on the right side of the building door.' },
          { type: 'paragraph' as const, text: 'The condo is located on the Xth level via the stairs or by pressing X on the elevator.' },
          { type: 'note'      as const, text: 'Please ask your host for arrival details.' },
        ],
      }
    }
    if (section.title === 'Alarm' && isPublic && !publicAlarm && !noAlarm) {
      return {
        ...section,
        content: [
          { type: 'note' as const, text: 'Alarm code details are available — please ask your host.' },
          ...section.content,
        ],
      }
    }
    return section
  })

  // Privacy notice — shown when any gate is active
  const anyGated = isPublic && (!publicArrival || !publicAlarm || !publicWifi || !publicOwnerPhone || !publicManagerPhone)

  return (
    <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: L.bgAlt }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: L.faint, marginBottom: 8 }}>
          House Guide
        </p>
        <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 600, letterSpacing: '-0.03em', color: L.text, marginBottom: 32 }}>
          Everything you need to know.
        </h2>

        {anyGated && (
          <div style={{
            padding:      '12px 16px',
            borderRadius: 12,
            background:   '#F9F7F2',
            border:       `1px solid ${L.border}`,
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: L.muted, margin: 0 }}>
              🔒 Some information on this page is protected for privacy purposes.
            </p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {resolvedSections.map(section => (
            <div key={section.id}>
              <button
                onClick={() => setOpen(open === section.id ? null : section.id)}
                style={{
                  width:          '100%',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '18px 24px',
                  background:     open === section.id ? L.bgCard : 'rgba(255,255,255,0.6)',
                  border:         `1px solid ${open === section.id ? L.border : 'rgba(222,215,204,0.5)'}`,
                  borderRadius:   open === section.id ? '16px 16px 0 0' : 16,
                  cursor:         'pointer',
                  textAlign:      'left',
                  transition:     'background 0.2s ease, border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 18 }}>{section.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: L.text }}>{section.title}</span>
                </div>
                <span style={{
                  fontSize:   14,
                  color:      L.faint,
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
                  background:   L.bgCard,
                  border:       `1px solid ${L.border}`,
                  borderTop:    'none',
                  borderRadius: '0 0 16px 16px',
                }}>
                  {section.content.map((block: ManualSection['content'][0], i: number) => (
                    <ManualBlock key={i} block={block} isPublic={isPublic} publicWifi={publicWifi} publicAlarm={publicAlarm} />
                  ))}
                  {section.title === 'Arrival' && mapsUrl && (!isPublic || publicArrival) && (
                    <a
                      href={mapsUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      style={{
                        display:       'inline-block',
                        marginTop:     8,
                        fontSize:      12,
                        fontWeight:    600,
                        color:         L.gold,
                        textDecoration:'none',
                        letterSpacing: '0.03em',
                      }}
                    >
                      Open in Maps →
                    </a>
                  )}
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
      border:       `1px solid ${L.border}`,
      background:   L.bgCard,
      boxShadow:    '0 4px 16px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: L.text, lineHeight: 1.3 }}>
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
            background:    `${L.gold}1f`,
            border:        `1px solid ${L.gold}4d`,
            color:         L.gold,
            flexShrink:    0,
            marginLeft:    12,
          }}>
            Favourite
          </span>
        )}
      </div>
      {listing.genre && (
        <p style={{ fontSize: 11, color: L.faint, marginBottom: 10, letterSpacing: '0.04em' }}>{listing.genre}</p>
      )}
      <p style={{ fontSize: 12, color: L.muted, lineHeight: 1.6, marginBottom: listing.note || listing.hours || listing.website ? 12 : 0 }}>
        {listing.address}
      </p>
      {listing.hours && (
        <p style={{ fontSize: 11, color: L.faint, marginBottom: 8 }}>⏱ {listing.hours}</p>
      )}
      {listing.note && (
        <p style={{ fontSize: 12, color: L.muted, fontStyle: 'italic', lineHeight: 1.6, marginBottom: listing.website ? 12 : 0 }}>
          {listing.note}
        </p>
      )}
      {listing.website && (
        <a
          href={listing.website}
          target='_blank'
          rel='noopener noreferrer'
          style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: L.gold, letterSpacing: '0.04em', textDecoration: 'none' }}
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
    <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: L.bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: L.faint, marginBottom: 8 }}>
          Local Recommendations
        </p>
        <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 600, letterSpacing: '-0.03em', color: L.text, marginBottom: 32 }}>
          Dining, activities & more.
        </h2>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding:       '9px 20px',
                borderRadius:  100,
                border:        `1px solid ${activeCategory === cat.id ? L.text : L.border}`,
                background:    activeCategory === cat.id ? L.text : 'transparent',
                color:         activeCategory === cat.id ? L.bg : L.muted,
                fontSize:      12,
                fontWeight:    600,
                cursor:        'pointer',
                letterSpacing: '0.02em',
                transition:    'all 0.2s ease',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {filtered.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ContactsSection({ property, isPublic, publicOwnerPhone, publicManagerPhone }: { property: Property; isPublic: boolean; publicOwnerPhone: boolean; publicManagerPhone: boolean }) {
  return (
    <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: C.bg }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>
          Contacts
        </p>
        <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 600, letterSpacing: '-0.03em', color: C.text, marginBottom: 32 }}>
          We're here if you need us.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 32 }}>
          {[
            { contact: property.owner,   showPhone: !isPublic || publicOwnerPhone },
            { contact: property.manager, showPhone: !isPublic || publicManagerPhone },
          ].map(({ contact, showPhone }) => (
            <div key={contact.name} style={{
              padding:      '20px 24px',
              borderRadius: 16,
              border:       `1px solid ${C.border}`,
              background:   C.bgCard,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>
                {contact.role}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>{contact.name}</div>
              {showPhone
                ? <a href={`tel:${contact.phone}`} style={{ fontSize: 13, color: C.gold, textDecoration: 'none' }}>{contact.phone}</a>
                : <GatedValue />
              }
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
          <p style={{ fontSize: 11, color: C.faint, marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Emergencies
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {property.emergencies.map((e: Property['emergencies'][0]) => (
              <div key={e.label}>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 2 }}>{e.label}</div>
                <a href={`tel:${e.phone}`} style={{ fontSize: 14, fontWeight: 600, color: C.muted, textDecoration: 'none' }}>
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

// ── Main export ───────────────────────────────────────────────────────────────

export type TripPageProps = {
  booking:             Booking
  property:            Property
  manual:              ManualSection[]
  listings:            Listing[]
  isPublic?:           boolean
  publicWifi?:         boolean
  publicAlarm?:        boolean
  publicOwnerPhone?:   boolean
  publicManagerPhone?: boolean
  noAlarm?:            boolean
  publicArrival?: boolean
}

export default function TripPage({ booking, property, manual, listings, isPublic = false, publicWifi = false, publicAlarm = false, publicOwnerPhone = false, publicManagerPhone = false, noAlarm = false, publicArrival = false }: TripPageProps) {
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
        checkIn={booking.checkIn}
        checkOut={booking.checkOut}
      />
      <WelcomeLetter booking={booking} />
      <HouseManual sections={manual} isPublic={isPublic} publicWifi={publicWifi} publicAlarm={publicAlarm} noAlarm={noAlarm} publicArrival={publicArrival} publicOwnerPhone={publicOwnerPhone} publicManagerPhone={publicManagerPhone} mapsUrl={property.mapsUrl} />
      <ListingsSection listings={listings} />
      <ContactsSection property={property} isPublic={isPublic} publicOwnerPhone={publicOwnerPhone} publicManagerPhone={publicManagerPhone} />
    </>
  )
}