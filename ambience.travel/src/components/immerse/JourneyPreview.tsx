/* JourneyPreview.tsx
 * DEV ONLY — preview JourneyPage with Tanzania seed data.
 * Uses ImmerseLayout + ImmerseHero per immerse protocol.
 * Remove preview route before production — wire to Edge Function instead.
 * Route: localhost:5173/preview/journey
 *
 * Last updated: S48 — upgraded to ImmerseLayout + ImmerseHero.
 * Prior: S48 — initial build with PropertyIntroSection.
 */

import { useState } from 'react'
import ImmerseLayout          from '../layouts/ImmerseLayout'
import ImmerseHero            from '../immerse/ImmerseHero'
import JourneyPage            from '../programme/JourneyPage'
import { tanzaniaProperty, tanzaniaBooking, tanzaniaDays } from '../../data/tanzaniaJourney'
import { formatDateOnly }     from '../../utils/utilsDates'

function buildDateLabel(checkIn?: string, checkOut?: string): string | undefined {
  if (!checkIn && !checkOut) return undefined
  if (checkIn && checkOut) return `${formatDateOnly(checkIn)} — ${formatDateOnly(checkOut)}`
  if (checkIn)  return `From ${formatDateOnly(checkIn)}`
  if (checkOut) return `Until ${formatDateOnly(checkOut)}`
}

export default function JourneyPreview() {
  const [tab, setTab] = useState<'itinerary' | 'brief' | 'contacts'>('itinerary')

  const dateLabel = buildDateLabel(tanzaniaBooking.checkIn, tanzaniaBooking.checkOut)

  return (
    <ImmerseLayout>
      <ImmerseHero
        guestName={tanzaniaBooking.guestNames}
        title={tanzaniaProperty.name}
        titlePrefix='A Journey Through'
        subtitle={tanzaniaProperty.tagline}
        dateLabel={dateLabel}
        heroImageSrc={tanzaniaProperty.heroImage}
        heroImageAlt={tanzaniaProperty.name}
        primaryHref='#itinerary'
        primaryLabel='View Itinerary'
        secondaryHref='#brief'
        secondaryLabel='Trip Brief'
      />

      {/* Welcome letter — between hero and tabs */}
      <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: '#F7F5F0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#B4AFA5', marginBottom: 28, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Welcome</p>
          {tanzaniaBooking.welcomeLetter.split('\n\n').filter(Boolean).map((p: string, i: number, arr: string[]) => (
            <p key={i} style={{
              fontSize:      i === 0 ? 'clamp(18px,2vw,26px)' : 15,
              fontFamily:    i === 0 ? "'Cormorant Garamond', Georgia, serif" : "'Plus Jakarta Sans', sans-serif",
              lineHeight:    1.85,
              color:         i === 0 ? '#1A1D1A' : '#787060',
              marginBottom:  i === arr.length - 1 ? 0 : 20,
              letterSpacing: i === 0 ? '-0.01em' : 'normal',
            }}>
              {p}
            </p>
          ))}
        </div>
      </section>

      <div id='itinerary'>
        <JourneyPage
          booking={tanzaniaBooking}
          property={tanzaniaProperty}
          days={tanzaniaDays}
          isPublic={true}
          activeTab={tab}
          onTabChange={setTab}
        />
      </div>
    </ImmerseLayout>
  )
}