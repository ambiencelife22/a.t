import { useEffect, useMemo, useRef, useState } from 'react'
import { C } from '../../lib/theme'

type Tab =
  | 'overview'
  | 'preferences'
  | 'documents'
  | 'protocol'
  | 'trips'
  | 'contacts'

type ServiceLevel = 1 | 2 | 3 | 4 | 5

type LinkedPartyMember = {
  id: string
  name: string
  linked: boolean
}

type TripStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
type TripType = 'Stay' | 'Journey'

type ContactType =
  | 'Hotel'
  | 'Private Aviation'
  | 'Chauffeur'
  | 'Security'
  | 'Restaurant Group'
  | 'Concierge Service'

type FrequentFlyer = {
  airline: string
  number: string
}

type ClientTrip = {
  id: string
  programme: string
  propertyOrRoute: string
  dates: string
  type: TripType
  status: TripStatus
}

type ClientContact = {
  id: string
  name: string
  company: string
  role: string
  type: ContactType
  lastContact: string
}

type ClientProfileData = {
  id: string
  clientCode: string
  firstName: string
  lastName: string
  nickname?: string
  age: number
  nationality: string
  languages: string[]
  homeBase: string
  accountLinked: boolean
  serviceLevel: ServiceLevel
  lastUpdated: string
  updatedBy: string
  partyMembers: LinkedPartyMember[]
  preferredCabinClass: string
  preferredHotelTier: string
  dietary: string[]
  allergies: string[]
  notes: string
  passportExpiry: string
  passportExpirySoon: boolean
  dining: {
    cuisines: string[]
    dietary: string[]
    allergies: string[]
    michelinPreferred: boolean
    michelinNotes: string
    priceLevel: '$' | '$$' | '$$$' | '$$$$'
    atmosphere: string[]
    aversions: string
  }
  hotel: {
    starRating: number
    roomCategory: string
    bedType: string
    preferredBrands: string[]
    avoidBrands: string[]
    viewPreference: string
    bathPreference: string
    earlyCheckIn: boolean
    lateCheckOut: boolean
    accessibility: string
  }
  flight: {
    cabinClass: string
    seatPreference: string
    mealCodes: string[]
    privateAviation: string
    pjPreferences: string
    preferredAirlines: string[]
    avoidAirlines: string[]
    loungeAccess: string
    maxLayover: string
  }
  documents: {
    passportNumberMasked: string
    passportNumberFull: string
    passportCountryOfIssue: string
    passportExpiry: string
    dob: string
    globalEntryNumberMasked: string
    globalEntryNumberFull: string
    globalEntryExpiry: string
    tsaPreCheck: boolean
    knownTravellerNumberMasked: string
    knownTravellerNumberFull: string
    nexus: boolean
    redressNumberMasked: string
    redressNumberFull: string
    frequentFlyers: FrequentFlyer[]
    visaNotes: string
  }
  protocol: {
    addressPreference: string
    approachVia: string
    photographyPolicy: 'Allowed' | 'Ask first' | 'Never'
    securityNotes: string
    additionalNotes: string
  }
  trips: ClientTrip[]
  contacts: ClientContact[]
}

type BriefSectionKey =
  | 'profile'
  | 'preferences'
  | 'documents'
  | 'protocol'
  | 'arrival'
  | 'contacts'

type BriefSection = {
  key: BriefSectionKey
  label: string
  included: boolean
  customText: string
}

const WARNING = '#f97316'
const DANGER = '#ef4444'
const SOFT_GREEN = '#4ade80'
const SOFT_BLUE = '#7FDEFF'

const SAMPLE_CLIENT: ClientProfileData = {
  id: 'client-ragnar-sigurdsson',
  clientCode: 'CL-IS-0142',
  firstName: 'Ragnar',
  lastName: 'Sigurdsson',
  nickname: 'Ragnar',
  age: 43,
  nationality: 'Icelandic',
  languages: ['Icelandic', 'English', 'Danish'],
  homeBase: 'Reykjavik, Iceland',
  accountLinked: true,
  serviceLevel: 4,
  lastUpdated: '4 Apr 2026',
  updatedBy: 'Deron',
  partyMembers: [
    { id: 'pm-1', name: 'Gunnar Sigurdsson', linked: true },
    { id: 'pm-2', name: 'Anna Jónsdóttir', linked: false },
  ],
  preferredCabinClass: 'Business / First',
  preferredHotelTier: 'Luxury / Ultra-Luxury',
  dietary: ['Halal', 'No Alcohol'],
  allergies: ['Shellfish'],
  notes:
    'Prefers discreet arrival experiences, low-friction service, and properties with strong privacy culture. Aman and Four Seasons consistently perform best. Avoid overly theatrical F&B environments and loud public-facing tables.',
  passportExpiry: '18 Aug 2026',
  passportExpirySoon: true,
  dining: {
    cuisines: ['Japanese', 'Italian', 'Middle Eastern', 'Nordic'],
    dietary: ['Halal', 'No Alcohol'],
    allergies: ['Shellfish'],
    michelinPreferred: true,
    michelinNotes: 'Enjoys refined dining if quiet, discreet, and worth the effort.',
    priceLevel: '$$$$',
    atmosphere: ['Quiet', 'Waterfront', 'Private Room', 'Design-led'],
    aversions: 'No loud venues, nightclub energy, or tasting menus that feel performative.',
  },
  hotel: {
    starRating: 5,
    roomCategory: 'Suite / Villa',
    bedType: 'King',
    preferredBrands: ['Aman', 'Four Seasons', 'Rosewood'],
    avoidBrands: ['W Hotels'],
    viewPreference: 'Sea / Nature',
    bathPreference: 'Tub required',
    earlyCheckIn: true,
    lateCheckOut: true,
    accessibility: 'No special accessibility requirements noted.',
  },
  flight: {
    cabinClass: 'Business / First',
    seatPreference: 'Window',
    mealCodes: ['MOML', 'HNML'],
    privateAviation: 'If available',
    pjPreferences:
      'Prefers newer long-range aircraft, quiet cabin, minimal branding, trusted operators only.',
    preferredAirlines: ['Qatar Airways', 'Emirates', 'British Airways'],
    avoidAirlines: ['Ryanair'],
    loungeAccess: 'Own membership',
    maxLayover: '2hr',
  },
  documents: {
    passportNumberMasked: 'P••••••91',
    passportNumberFull: 'P38492191',
    passportCountryOfIssue: 'Iceland',
    passportExpiry: '18 Aug 2026',
    dob: '12 Oct 1982',
    globalEntryNumberMasked: 'GE••••83',
    globalEntryNumberFull: 'GE992183',
    globalEntryExpiry: '02 Nov 2027',
    tsaPreCheck: true,
    knownTravellerNumberMasked: 'KTN•••219',
    knownTravellerNumberFull: 'KTN842219',
    nexus: false,
    redressNumberMasked: 'RD•••02',
    redressNumberFull: 'RD11002',
    frequentFlyers: [
      { airline: 'Qatar Airways Privilege Club', number: 'QR-8841-2192' },
      { airline: 'British Airways Executive Club', number: 'BA-2491-1140' },
      { airline: 'Emirates Skywards', number: 'EK-7732-0031' },
    ],
    visaNotes:
      'No immediate issues. Verify Schengen validity assumptions per routing. No US visa notes currently flagged.',
  },
  protocol: {
    addressPreference: 'Use Mr. Ragnar initially. Mirror formality if principal sets tone.',
    approachVia: 'Direct to principal unless fixer is explicitly copied in.',
    photographyPolicy: 'Ask first',
    securityNotes:
      'Do not announce movement details widely. Keep arrivals discreet and avoid visible comms around family travel.',
    additionalNotes:
      'Respond succinctly. Avoid over-explaining. Best service style is calm, anticipatory, and low-friction.',
  },
  trips: [
    {
      id: 'trip-1',
      programme: 'Summer Mediterranean Sequence',
      propertyOrRoute: 'Amanzoe / One&Only Aesthesis / Four Seasons Athens',
      dates: '12 Jun 2026 — 22 Jun 2026',
      type: 'Journey',
      status: 'upcoming',
    },
    {
      id: 'trip-2',
      programme: 'Tokyo Reset',
      propertyOrRoute: 'Aman Tokyo',
      dates: '06 Nov 2025 — 11 Nov 2025',
      type: 'Stay',
      status: 'completed',
    },
    {
      id: 'trip-3',
      programme: 'Alpine Winter Check-In',
      propertyOrRoute: 'The Chedi Andermatt',
      dates: '17 Jan 2025 — 22 Jan 2025',
      type: 'Stay',
      status: 'completed',
    },
  ],
  contacts: [
    {
      id: 'contact-1',
      name: 'Luc Moreau',
      company: 'Four Seasons George V Paris',
      role: 'Guest Relations Manager',
      type: 'Hotel',
      lastContact: '11 Mar 2026',
    },
    {
      id: 'contact-2',
      name: 'Sofia Ricci',
      company: 'Aman Venice',
      role: 'Preferred Butler',
      type: 'Hotel',
      lastContact: '04 Feb 2026',
    },
    {
      id: 'contact-3',
      name: 'Olivier Durant',
      company: 'Étoile Chauffeurs Paris',
      role: 'Senior Driver',
      type: 'Chauffeur',
      lastContact: '28 Jan 2026',
    },
  ],
}

const INITIAL_BRIEF_SECTIONS: BriefSection[] = [
  {
    key: 'profile',
    label: 'Profile Summary',
    included: true,
    customText: 'Concise guest overview for recipient.',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    included: true,
    customText: 'Dining, hotel, and flight notes relevant to this trip.',
  },
  {
    key: 'documents',
    label: 'Documents',
    included: false,
    customText: 'Sensitive documents only if operationally required.',
  },
  {
    key: 'protocol',
    label: 'Protocol',
    included: true,
    customText: 'Address, approach, privacy, and service posture.',
  },
  {
    key: 'arrival',
    label: 'Arrival Notes',
    included: true,
    customText: 'Arrival timing, greeting style, and check-in priorities.',
  },
  {
    key: 'contacts',
    label: 'Preferred Contacts',
    included: false,
    customText: 'Preferred relationship contacts tied to this client.',
  },
]

function pageWrap(): React.CSSProperties {
  return {
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    padding: '28px 28px 48px',
    boxSizing: 'border-box',
  }
}

function card(padding = 20): React.CSSProperties {
  return {
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding,
    boxSizing: 'border-box',
  }
}

function softInset(): React.CSSProperties {
  return {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
  }
}

function sectionLabelStyle(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.muted,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    marginBottom: 10,
  }
}

function valueStyle(): React.CSSProperties {
  return {
    fontSize: 14,
    color: C.text,
    lineHeight: 1.55,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }
}

function fieldLabelStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.faint,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    marginBottom: 6,
  }
}

function buttonBase(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    whiteSpace: 'nowrap',
  }
}

function iconButtonStyle(): React.CSSProperties {
  return {
    ...buttonBase(),
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.text,
  }
}

function goldButtonStyle(): React.CSSProperties {
  return {
    ...buttonBase(),
    background: `${C.gold}16`,
    border: `1px solid ${C.borderGold}`,
    color: C.gold,
  }
}

function inputLikeStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.bg,
    color: C.text,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }
}

function monoStyle(color = C.text): React.CSSProperties {
  return {
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    color,
  }
}

function SectionLabel({ text }: { text: string }) {
  return <div style={sectionLabelStyle()}>{text}</div>
}

function ServiceLevelDots({ level }: { level: ServiceLevel }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, idx) => {
        const filled = idx < level
        return (
          <div
            key={idx}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: filled ? C.gold : 'transparent',
              border: `1px solid ${filled ? C.gold : C.faint}`,
              boxSizing: 'border-box',
            }}
          />
        )
      })}
    </div>
  )
}

function StatusPill({
  label,
  color,
  bg,
}: {
  label: string
  color: string
  bg: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${color}40`,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}

function TagPill({
  label,
  kind = 'default',
}: {
  label: string
  kind?: 'default' | 'gold' | 'green' | 'amber' | 'red' | 'redTint' | 'blue'
}) {
  const styles: Record<string, { color: string; border: string; background: string }> = {
    default: {
      color: C.text,
      border: C.border,
      background: 'transparent',
    },
    gold: {
      color: C.gold,
      border: C.borderGold,
      background: `${C.gold}10`,
    },
    green: {
      color: SOFT_GREEN,
      border: `${SOFT_GREEN}55`,
      background: `${SOFT_GREEN}12`,
    },
    amber: {
      color: WARNING,
      border: `${WARNING}55`,
      background: `${WARNING}12`,
    },
    red: {
      color: DANGER,
      border: `${DANGER}70`,
      background: 'transparent',
    },
    redTint: {
      color: '#fca5a5',
      border: `${DANGER}55`,
      background: `${DANGER}10`,
    },
    blue: {
      color: SOFT_BLUE,
      border: `${SOFT_BLUE}55`,
      background: `${SOFT_BLUE}12`,
    },
  }

  const s = styles[kind]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        border: `1px solid ${s.border}`,
        background: s.background,
        color: s.color,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {label}
    </span>
  )
}

function KeyValueCard({
  label,
  value,
  valueColor,
  fullWidth = false,
  warning = false,
  mono = false,
  action,
}: {
  label: string
  value: React.ReactNode
  valueColor?: string
  fullWidth?: boolean
  warning?: boolean
  mono?: boolean
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        ...card(18),
        minHeight: 116,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        gridColumn: fullWidth ? '1 / -1' : undefined,
        boxShadow: warning ? `inset 0 0 0 1px ${WARNING}40` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={sectionLabelStyle()}>{label}</div>
        {action ? <div>{action}</div> : null}
      </div>

      <div
        style={
          mono
            ? {
                ...monoStyle(valueColor ?? C.text),
                fontSize: 14,
                lineHeight: 1.55,
              }
            : {
                ...valueStyle(),
                color: valueColor ?? C.text,
              }
        }
      >
        {value}
      </div>
    </div>
  )
}

function FieldRow({
  label,
  value,
  mono = false,
  valueColor,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  valueColor?: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px minmax(0, 1fr)',
        gap: 18,
        padding: '12px 0',
        borderTop: `1px solid ${C.border}`,
        alignItems: 'start',
      }}
    >
      <div style={fieldLabelStyle()}>{label}</div>
      <div
        style={
          mono
            ? {
                ...monoStyle(valueColor ?? C.text),
                lineHeight: 1.6,
              }
            : {
                ...valueStyle(),
                color: valueColor ?? C.text,
              }
        }
      >
        {value}
      </div>
    </div>
  )
}

function Toggle({
  enabled,
  label,
}: {
  enabled: boolean
  label?: string
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          background: enabled ? `${SOFT_GREEN}22` : C.bg,
          border: `1px solid ${enabled ? `${SOFT_GREEN}55` : C.border}`,
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: enabled ? SOFT_GREEN : C.faint,
            transition: 'left 0.18s ease',
          }}
        />
      </div>
      {label ? (
        <span style={{ ...valueStyle(), fontSize: 13 }}>{label}</span>
      ) : null}
    </div>
  )
}

function MaskedValue({
  masked,
  revealed,
}: {
  masked: string
  revealed: string
}) {
  return <span>{revealed ? revealed : masked}</span>
}

function tabColor(active: boolean): React.CSSProperties {
  return {
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    color: active ? C.text : C.faint,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'color 0.18s ease',
    whiteSpace: 'nowrap',
  }
}

function tripStatusMeta(status: TripStatus) {
  switch (status) {
    case 'upcoming':
      return {
        label: 'Upcoming',
        color: C.gold,
        bg: `${C.gold}14`,
      }
    case 'in_progress':
      return {
        label: 'In Progress',
        color: SOFT_BLUE,
        bg: `${SOFT_BLUE}12`,
      }
    case 'completed':
      return {
        label: 'Completed',
        color: SOFT_GREEN,
        bg: `${SOFT_GREEN}12`,
      }
    default:
      return {
        label: 'Cancelled',
        color: DANGER,
        bg: `${DANGER}10`,
      }
  }
}

function layoutGrid(): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 340px',
    gap: 22,
    alignItems: 'start',
  }
}

function OverviewTab({ client }: { client: ClientProfileData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
      <KeyValueCard label='Nationality' value={client.nationality} />
      <KeyValueCard label='Languages spoken' value={client.languages.join(' · ')} />

      <KeyValueCard label='Home city / base' value={client.homeBase} />
      <KeyValueCard label='Age' value={`${client.age}`} />

      <KeyValueCard
        label='Passport expiry'
        value={client.passportExpiry}
        warning={client.passportExpirySoon}
        valueColor={client.passportExpirySoon ? WARNING : C.text}
      />
      <KeyValueCard label='Preferred cabin class' value={client.preferredCabinClass} />

      <KeyValueCard label='Preferred hotel tier' value={client.preferredHotelTier} />
      <KeyValueCard
        label='Dietary requirements'
        value={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {client.dietary.map(item => (
              <TagPill
                key={item}
                label={item}
                kind={item === 'Halal' ? 'green' : item === 'No Alcohol' ? 'amber' : 'gold'}
              />
            ))}
          </div>
        }
      />

      <KeyValueCard
        label='Allergies'
        value={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {client.allergies.map(item => (
              <TagPill key={item} label={item} kind='red' />
            ))}
          </div>
        }
      />

      <KeyValueCard
        label='Notes'
        fullWidth
        value={client.notes}
      />
    </div>
  )
}

function PreferencesTab({ client }: { client: ClientProfileData }) {
  const { dining, hotel, flight } = client

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={card(22)}>
        <SectionLabel text='Dining' />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
          <div style={{ ...softInset(), padding: 16 }}>
            <div style={fieldLabelStyle()}>Cuisines</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {dining.cuisines.map(item => (
                <TagPill key={item} label={item} kind='gold' />
              ))}
            </div>
          </div>

          <div style={{ ...softInset(), padding: 16 }}>
            <div style={fieldLabelStyle()}>Dietary</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {dining.dietary.map(item => (
                <TagPill
                  key={item}
                  label={item}
                  kind={item === 'Halal' ? 'green' : item === 'No Alcohol' ? 'amber' : 'gold'}
                />
              ))}
            </div>
          </div>

          <div style={{ ...softInset(), padding: 16 }}>
            <div style={fieldLabelStyle()}>Allergies</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {dining.allergies.map(item => (
                <TagPill key={item} label={item} kind='red' />
              ))}
            </div>
          </div>

          <div style={{ ...softInset(), padding: 16 }}>
            <div style={fieldLabelStyle()}>Michelin</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Toggle enabled={dining.michelinPreferred} label={dining.michelinPreferred ? 'Preferred' : 'Off'} />
              <div style={{ ...valueStyle(), fontSize: 13, color: C.muted }}>
                {dining.michelinNotes}
              </div>
            </div>
          </div>

          <div style={{ ...softInset(), padding: 16 }}>
            <div style={fieldLabelStyle()}>Price level</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['$', '$$', '$$$', '$$$$'] as const).map(level => (
                <TagPill
                  key={level}
                  label={level}
                  kind={level === dining.priceLevel ? 'gold' : 'default'}
                />
              ))}
            </div>
          </div>

          <div style={{ ...softInset(), padding: 16 }}>
            <div style={fieldLabelStyle()}>Atmosphere</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {dining.atmosphere.map(item => (
                <TagPill key={item} label={item} kind='gold' />
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...softInset(), padding: 16, marginTop: 18 }}>
          <div style={fieldLabelStyle()}>Aversions</div>
          <div style={{ ...valueStyle(), fontSize: 13 }}>{dining.aversions}</div>
        </div>
      </div>

      <div style={card(22)}>
        <SectionLabel text='Hotel' />

        <FieldRow
          label='Star rating preference'
          value={
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: idx < hotel.starRating ? C.gold : 'transparent',
                    border: `1px solid ${idx < hotel.starRating ? C.gold : C.faint}`,
                  }}
                />
              ))}
            </div>
          }
        />
        <FieldRow label='Room category' value={hotel.roomCategory} />
        <FieldRow label='Bed type' value={hotel.bedType} />
        <FieldRow
          label='Preferred brands'
          value={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hotel.preferredBrands.map(item => (
                <TagPill key={item} label={item} kind='gold' />
              ))}
            </div>
          }
        />
        <FieldRow
          label='Brands to avoid'
          value={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hotel.avoidBrands.map(item => (
                <TagPill key={item} label={item} kind='redTint' />
              ))}
            </div>
          }
        />
        <FieldRow label='View preference' value={hotel.viewPreference} />
        <FieldRow label='Bath preference' value={hotel.bathPreference} />
        <FieldRow label='Early check-in priority' value={<Toggle enabled={hotel.earlyCheckIn} />} />
        <FieldRow label='Late check-out priority' value={<Toggle enabled={hotel.lateCheckOut} />} />
        <FieldRow label='Accessibility requirements' value={hotel.accessibility} />
      </div>

      <div style={card(22)}>
        <SectionLabel text='Flight' />

        <FieldRow label='Cabin class' value={flight.cabinClass} />
        <FieldRow label='Seat preference' value={flight.seatPreference} />
        <FieldRow
          label='Meal code'
          value={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {flight.mealCodes.map(item => (
                <TagPill key={item} label={item} kind='blue' />
              ))}
            </div>
          }
        />
        <FieldRow label='Private aviation' value={flight.privateAviation} />
        <FieldRow label='PJ preferences' value={flight.pjPreferences} />
        <FieldRow
          label='Preferred airlines'
          value={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {flight.preferredAirlines.map(item => (
                <TagPill key={item} label={item} kind='gold' />
              ))}
            </div>
          }
        />
        <FieldRow
          label='Airlines to avoid'
          value={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {flight.avoidAirlines.map(item => (
                <TagPill key={item} label={item} kind='redTint' />
              ))}
            </div>
          }
        />
        <FieldRow label='Lounge access' value={flight.loungeAccess} />
        <FieldRow label='Max layover' value={flight.maxLayover} />
      </div>
    </div>
  )
}

function DocumentsTab({ client }: { client: ClientProfileData }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({
    passport: false,
    globalEntry: false,
    ktn: false,
    redress: false,
  })

  const docs = client.documents

  function reveal(key: string) {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function revealBtn(active: boolean, onClick: () => void) {
    return (
      <button onClick={onClick} style={{ ...iconButtonStyle(), padding: '7px 10px', fontSize: 11 }}>
        {active ? 'Hide' : 'Reveal'}
      </button>
    )
  }

  return (
    <div style={{ ...card(22) }}>
      <SectionLabel text='Sensitive Data · Admin Only' />

      <FieldRow
        label='Passport number'
        mono
        value={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <MaskedValue
              masked={docs.passportNumberMasked}
              revealed={revealed.passport ? docs.passportNumberFull : ''}
            />
            {revealBtn(revealed.passport, () => reveal('passport'))}
          </div>
        }
      />
      <FieldRow
        label='Passport expiry'
        value={docs.passportExpiry}
        valueColor={client.passportExpirySoon ? WARNING : C.text}
      />
      <FieldRow label='Passport country of issue' value={docs.passportCountryOfIssue} />
      <FieldRow label='Date of birth' value={docs.dob} />

      <FieldRow
        label='Global Entry'
        mono
        value={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <MaskedValue
              masked={docs.globalEntryNumberMasked}
              revealed={revealed.globalEntry ? docs.globalEntryNumberFull : ''}
            />
            {revealBtn(revealed.globalEntry, () => reveal('globalEntry'))}
          </div>
        }
      />
      <FieldRow label='Global Entry expiry' value={docs.globalEntryExpiry} />
      <FieldRow label='TSA PreCheck' value={<Toggle enabled={docs.tsaPreCheck} />} />

      <FieldRow
        label='Known Traveller Number'
        mono
        value={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <MaskedValue
              masked={docs.knownTravellerNumberMasked}
              revealed={revealed.ktn ? docs.knownTravellerNumberFull : ''}
            />
            {revealBtn(revealed.ktn, () => reveal('ktn'))}
          </div>
        }
      />
      <FieldRow label='NEXUS' value={<Toggle enabled={docs.nexus} />} />

      <FieldRow
        label='Redress number'
        mono
        value={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <MaskedValue
              masked={docs.redressNumberMasked}
              revealed={revealed.redress ? docs.redressNumberFull : ''}
            />
            {revealBtn(revealed.redress, () => reveal('redress'))}
          </div>
        }
      />

      <FieldRow
        label='Frequent flyer numbers'
        value={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {docs.frequentFlyers.map(item => (
              <div
                key={item.airline}
                style={{
                  ...softInset(),
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <div style={{ ...valueStyle(), fontSize: 13 }}>{item.airline}</div>
                <div style={monoStyle()}>{item.number}</div>
              </div>
            ))}
          </div>
        }
      />

      <FieldRow label='Visa notes' value={docs.visaNotes} />
    </div>
  )
}

function ProtocolTab({ client }: { client: ClientProfileData }) {
  const { protocol } = client

  return (
    <div style={{ ...card(22) }}>
      <SectionLabel text='Protocol' />
      <FieldRow label='Preferred form of address' value={protocol.addressPreference} />
      <FieldRow label='Who to approach first' value={protocol.approachVia} />
      <FieldRow
        label='Photography'
        value={
          <StatusPill
            label={protocol.photographyPolicy}
            color={
              protocol.photographyPolicy === 'Allowed'
                ? SOFT_GREEN
                : protocol.photographyPolicy === 'Ask first'
                ? WARNING
                : DANGER
            }
            bg={
              protocol.photographyPolicy === 'Allowed'
                ? `${SOFT_GREEN}12`
                : protocol.photographyPolicy === 'Ask first'
                ? `${WARNING}12`
                : `${DANGER}10`
            }
          />
        }
      />
      <FieldRow label='Security considerations' value={protocol.securityNotes} />
      <FieldRow label='Additional protocol notes' value={protocol.additionalNotes} />
    </div>
  )
}

function TripsTab({ client }: { client: ClientProfileData }) {
  return (
    <div style={{ ...card(22) }}>
      <SectionLabel text='Programmes' />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {client.trips.map((trip, index) => {
          const status = tripStatusMeta(trip.status)

          return (
            <div
              key={trip.id}
              style={{
                padding: '16px 0',
                borderTop: index === 0 ? 'none' : `1px solid ${C.border}`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -22,
                  top: 16,
                  bottom: 16,
                  width: 3,
                  borderRadius: 999,
                  background: trip.status === 'upcoming' ? C.gold : 'transparent',
                }}
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(180px, 0.8fr) 110px 120px auto',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.text,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      marginBottom: 4,
                    }}
                  >
                    {trip.programme}
                  </div>
                  <div style={{ ...valueStyle(), fontSize: 13, color: C.muted }}>
                    {trip.propertyOrRoute}
                  </div>
                </div>

                <div style={{ ...valueStyle(), fontSize: 13 }}>{trip.dates}</div>
                <div style={{ ...valueStyle(), fontSize: 13 }}>{trip.type}</div>
                <div>
                  <StatusPill label={status.label} color={status.color} bg={status.bg} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button style={{ ...iconButtonStyle(), padding: '8px 12px', fontSize: 11 }}>
                    Open Programme
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ContactsTab({ client }: { client: ClientProfileData }) {
  return (
    <div style={{ ...card(22) }}>
      <SectionLabel text='Linked Personal Industry Contacts' />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {client.contacts.map((contact, index) => (
          <div
            key={contact.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 0.8fr) minmax(220px, 1fr) minmax(180px, 0.9fr) 120px 110px',
              gap: 16,
              alignItems: 'center',
              padding: '14px 0',
              borderTop: index === 0 ? 'none' : `1px solid ${C.border}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.text,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  marginBottom: 4,
                }}
              >
                {contact.name}
              </div>
              <div style={{ ...valueStyle(), fontSize: 12, color: C.muted }}>{contact.type}</div>
            </div>

            <div style={{ ...valueStyle(), fontSize: 13 }}>{contact.company}</div>
            <div style={{ ...valueStyle(), fontSize: 13 }}>{contact.role}</div>
            <div style={{ ...valueStyle(), fontSize: 13 }}>{contact.lastContact}</div>
            <div style={{ textAlign: 'right' }}>
              <button style={{ ...iconButtonStyle(), padding: '8px 12px', fontSize: 11 }}>
                Open
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BriefGeneratorSidebar() {
  const [recipientType, setRecipientType] = useState('Hotel')
  const [recipientName, setRecipientName] = useState('Amanzoe Front Office')
  const [recipientEmail, setRecipientEmail] = useState('frontoffice@sample.com')
  const [deliveryMethod, setDeliveryMethod] = useState<'PDF' | 'Email'>('PDF')
  const [sections, setSections] = useState<BriefSection[]>(INITIAL_BRIEF_SECTIONS)

  function toggleSection(key: BriefSectionKey) {
    setSections(prev =>
      prev.map(section =>
        section.key === key
          ? { ...section, included: !section.included }
          : section
      )
    )
  }

  return (
    <div style={{ ...card(20), position: 'sticky', top: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              marginBottom: 4,
            }}
          >
            Brief Generator
          </div>
          <div style={{ ...valueStyle(), fontSize: 12, color: C.muted }}>
            Light treatment for the first pass
          </div>
        </div>

        <StatusPill label='Ready' color={C.gold} bg={`${C.gold}12`} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={fieldLabelStyle()}>Recipient type</div>
          <select
            value={recipientType}
            onChange={e => setRecipientType(e.target.value)}
            style={inputLikeStyle()}
          >
            <option>Hotel</option>
            <option>Chauffeur</option>
            <option>Aviation</option>
            <option>Security</option>
            <option>Concierge</option>
          </select>
        </div>

        <div>
          <div style={fieldLabelStyle()}>Recipient name</div>
          <input
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            style={inputLikeStyle()}
          />
        </div>

        <div>
          <div style={fieldLabelStyle()}>Recipient email</div>
          <input
            value={recipientEmail}
            onChange={e => setRecipientEmail(e.target.value)}
            style={inputLikeStyle()}
          />
        </div>

        <div>
          <div style={fieldLabelStyle()}>Delivery method</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['PDF', 'Email'] as const).map(method => (
              <button
                key={method}
                onClick={() => setDeliveryMethod(method)}
                style={{
                  ...iconButtonStyle(),
                  padding: '8px 12px',
                  fontSize: 11,
                  color: deliveryMethod === method ? C.gold : C.text,
                  borderColor: deliveryMethod === method ? C.borderGold : C.border,
                  background: deliveryMethod === method ? `${C.gold}10` : 'transparent',
                }}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={fieldLabelStyle()}>Sections</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sections.map(section => (
              <div
                key={section.key}
                style={{
                  ...softInset(),
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <button
                  onClick={() => toggleSection(section.key)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    marginTop: 2,
                    border: `1px solid ${section.included ? C.gold : C.border}`,
                    background: section.included ? `${C.gold}18` : 'transparent',
                    color: section.included ? C.gold : 'transparent',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✓
                </button>

                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      marginBottom: 4,
                    }}
                  >
                    {section.label}
                  </div>
                  <div style={{ ...valueStyle(), fontSize: 12, color: C.muted }}>
                    {section.customText}
                  </div>
                </div>

                <button style={{ ...iconButtonStyle(), padding: '7px 10px', fontSize: 11 }}>
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
          <button style={goldButtonStyle()}>Send</button>
          <button style={iconButtonStyle()}>Save Draft</button>
        </div>
      </div>
    </div>
  )
}

// ── Sample client list for preview ────────────────────────────────────────────

const SAMPLE_CLIENTS: ClientProfileData[] = [
  SAMPLE_CLIENT,
  {
    ...SAMPLE_CLIENT,
    id: 'client-sofia-mueller',
    clientCode: 'CL-DE-0089',
    firstName: 'Sofia',
    lastName: 'Mueller',
    nickname: undefined,
    age: 38,
    nationality: 'German',
    languages: ['German', 'English', 'French'],
    homeBase: 'Munich, Germany',
    accountLinked: true,
    serviceLevel: 3 as ServiceLevel,
    lastUpdated: '1 Apr 2026',
    updatedBy: 'Deron',
    partyMembers: [{ id: 'pm-s1', name: 'Klaus Mueller', linked: false }],
    dietary: ['Vegetarian'],
    allergies: ['Dairy', 'Nuts'],
    passportExpirySoon: false,
    passportExpiry: '02 Mar 2029',
  },
  {
    ...SAMPLE_CLIENT,
    id: 'client-james-whitfield',
    clientCode: 'CL-GB-0034',
    firstName: 'James',
    lastName: 'Whitfield',
    nickname: 'JW',
    age: 55,
    nationality: 'British',
    languages: ['English'],
    homeBase: 'London, UK',
    accountLinked: false,
    serviceLevel: 5 as ServiceLevel,
    lastUpdated: '28 Mar 2026',
    updatedBy: 'Deron',
    partyMembers: [],
    dietary: ['No Pork'],
    allergies: [],
    passportExpirySoon: false,
    passportExpiry: '14 Jun 2028',
  },
  {
    ...SAMPLE_CLIENT,
    id: 'client-yasmine-al-rashid',
    clientCode: 'CL-AE-0211',
    firstName: 'Yasmine',
    lastName: 'Al-Rashid',
    nickname: undefined,
    age: 31,
    nationality: 'Emirati',
    languages: ['Arabic', 'English'],
    homeBase: 'Dubai, UAE',
    accountLinked: true,
    serviceLevel: 4 as ServiceLevel,
    lastUpdated: '7 Apr 2026',
    updatedBy: 'Deron',
    partyMembers: [
      { id: 'pm-y1', name: 'Fatima Al-Rashid', linked: true },
      { id: 'pm-y2', name: 'Omar Al-Rashid', linked: false },
    ],
    dietary: ['Halal', 'No Alcohol'],
    allergies: ['Shellfish', 'Sesame'],
    passportExpirySoon: true,
    passportExpiry: '30 May 2026',
  },
  {
    ...SAMPLE_CLIENT,
    id: 'client-hiroshi-tanaka',
    clientCode: 'CL-JP-0056',
    firstName: 'Hiroshi',
    lastName: 'Tanaka',
    nickname: undefined,
    age: 48,
    nationality: 'Japanese',
    languages: ['Japanese', 'English'],
    homeBase: 'Tokyo, Japan',
    accountLinked: true,
    serviceLevel: 2 as ServiceLevel,
    lastUpdated: '15 Mar 2026',
    updatedBy: 'Deron',
    partyMembers: [{ id: 'pm-h1', name: 'Yuki Tanaka', linked: true }],
    dietary: [],
    allergies: [],
    passportExpirySoon: false,
    passportExpiry: '22 Aug 2027',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function dietaryKind(item: string): 'green' | 'amber' | 'gold' {
  if (item === 'Halal' || item === 'Kosher' || item === 'Vegetarian' || item === 'Vegan') return 'green'
  if (item === 'No Alcohol' || item === 'No Pork') return 'amber'
  return 'gold'
}

// ── Client list brick ──────────────────────────────────────────────────────────

function ClientBrick({ client, onClick }: { client: ClientProfileData; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...card(20),
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.15s ease, transform 0.15s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = C.borderGold
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = C.border
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Gold accent top bar for high service level */}
      {client.serviceLevel >= 4 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${C.gold}, transparent)`,
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.gold, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', marginBottom: 2 }}>
            {client.firstName} {client.lastName}
          </div>
          <div style={{ ...monoStyle(C.faint), fontSize: 11 }}>{client.clientCode}</div>
        </div>
        <ServiceLevelDots level={client.serviceLevel} />
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <StatusPill
          label={client.accountLinked ? 'Linked' : 'Not Linked'}
          color={client.accountLinked ? SOFT_GREEN : C.faint}
          bg={client.accountLinked ? `${SOFT_GREEN}10` : `${C.faint}10`}
        />
        {client.passportExpirySoon && (
          <StatusPill label='Passport expiring' color={WARNING} bg={`${WARNING}10`} />
        )}
      </div>

      {/* Location + party */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {client.nationality} · {client.homeBase}
        </div>
        {client.partyMembers.length > 0 && (
          <div style={{ fontSize: 11, color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Party of {client.partyMembers.length + 1}
          </div>
        )}
      </div>

      {/* Dietary tags */}
      {client.dietary.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {client.dietary.slice(0, 3).map(d => (
            <TagPill key={d} label={d} kind={dietaryKind(d)} />
          ))}
          {client.dietary.length > 3 && (
            <TagPill label={`+${client.dietary.length - 3}`} kind='default' />
          )}
        </div>
      )}

      {/* Last updated */}
      <div style={{ fontSize: 10, color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 'auto', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
        Updated {client.lastUpdated} · {client.updatedBy}
      </div>
    </div>
  )
}

// ── Client list view ───────────────────────────────────────────────────────────

function ClientList({ onSelect }: { onSelect: (client: ClientProfileData) => void }) {
  const [search, setSearch] = useState('')

  const filtered = SAMPLE_CLIENTS.filter(c => {
    const q = search.toLowerCase()
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.clientCode.toLowerCase().includes(q) ||
      c.homeBase.toLowerCase().includes(q) ||
      c.nationality.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
            Design
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
            Clients
          </div>
        </div>
        <button style={{
          ...goldButtonStyle(),
          fontSize: 12,
          padding: '8px 16px',
        }}>
          + New Client
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder='Search by name, code, nationality, city…'
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: C.bgCard,
          color: C.text,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box' as const,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      />

      {/* Count */}
      <div style={{ fontSize: 12, color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {filtered.length} client{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ''}
      </div>

      {/* Grid */}
      {filtered.length === 0 && (
        <div style={{ fontSize: 13, color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '24px 0' }}>
          No clients match your search.
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
        gap: 16,
      }}>
        {filtered.map(client => (
          <ClientBrick key={client.id} client={client} onClick={() => onSelect(client)} />
        ))}
      </div>
    </div>
  )
}

// ── Client detail view ─────────────────────────────────────────────────────────

function ClientDetail({ client, onBack }: { client: ClientProfileData; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [briefOpen, setBriefOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [underline, setUnderline] = useState({ left: 0, width: 0 })

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 900) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const bar = tabBarRef.current
    if (!bar) return
    const active = bar.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)
    if (!active) return
    setUnderline({ left: active.offsetLeft, width: active.offsetWidth })
  }, [tab])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',    label: 'Overview' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'documents',   label: 'Documents' },
    { id: 'protocol',    label: 'Protocol' },
    { id: 'trips',       label: 'Trips' },
    { id: 'contacts',    label: 'Contacts' },
  ]

  function renderTab() {
    if (tab === 'overview')    return <OverviewTab client={client} />
    if (tab === 'preferences') return <PreferencesTab client={client} />
    if (tab === 'documents')   return <DocumentsTab client={client} />
    if (tab === 'protocol')    return <ProtocolTab client={client} />
    if (tab === 'trips')       return <TripsTab client={client} />
    if (tab === 'contacts')    return <ContactsTab client={client} />
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Back link */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.muted, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif",
          padding: '0 0 16px 0',
        }}
      >
        ← All clients
      </button>

      {/* Client header card */}
      <div style={{ ...card(20), marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(232,197,71,0.04) 0%, rgba(232,197,71,0) 50%)',
        }} />

        {/* Name + meta */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.gold, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
              {client.firstName} {client.lastName}
            </div>
            <ServiceLevelDots level={client.serviceLevel} />
            <StatusPill
              label={client.accountLinked ? 'Linked' : 'Not Linked'}
              color={client.accountLinked ? SOFT_GREEN : C.faint}
              bg={client.accountLinked ? `${SOFT_GREEN}10` : `${C.faint}10`}
            />
            {client.passportExpirySoon && (
              <StatusPill label='Passport expiring' color={WARNING} bg={`${WARNING}10`} />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ ...monoStyle(C.faint), fontSize: 11 }}>{client.clientCode}</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{client.homeBase}</div>
            <div style={{ fontSize: 12, color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Updated {client.lastUpdated} · {client.updatedBy}
            </div>
          </div>

          {/* Party members */}
          {client.partyMembers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {client.partyMembers.map(member => (
                <div key={member.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '6px 12px', borderRadius: 999,
                  border: `1px solid ${C.border}`, background: C.bg,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: member.linked ? SOFT_GREEN : 'transparent',
                    border: `1px solid ${member.linked ? SOFT_GREEN : C.faint}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {member.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
          <button style={{ ...iconButtonStyle(), fontSize: 12, padding: '8px 14px' }}>Edit</button>
          <button
            style={{ ...goldButtonStyle(), fontSize: 12, padding: '8px 14px' }}
            onClick={() => setBriefOpen(prev => !prev)}
          >
            {briefOpen ? 'Hide Brief' : 'Generate Brief'}
          </button>
          <button style={{ ...iconButtonStyle(), fontSize: 12, padding: '8px 14px' }}>Add to Trip</button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        ref={tabBarRef}
        style={{
          position: 'relative',
          display: 'flex',
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        {tabs.map(item => (
          <button
            key={item.id}
            data-tab={item.id}
            onClick={() => setTab(item.id)}
            style={tabColor(tab === item.id)}
          >
            {item.label}
          </button>
        ))}
        <div style={{
          position: 'absolute', bottom: 0,
          left: underline.left, width: underline.width,
          height: 2, background: C.gold, borderRadius: 999,
          transition: 'left 0.22s cubic-bezier(0.16,1,0.3,1), width 0.22s cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Content — stacks on mobile, side-by-side on desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : briefOpen ? 'minmax(0, 1fr) 320px' : '1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        <div>{renderTab()}</div>
        {briefOpen && <BriefGeneratorSidebar />}
      </div>
    </div>
  )
}

// ── Entry point ────────────────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const [selected, setSelected] = useState<ClientProfileData | null>(null)

  if (selected) {
    return <ClientDetail client={selected} onBack={() => setSelected(null)} />
  }

  return <ClientList onSelect={setSelected} />
}