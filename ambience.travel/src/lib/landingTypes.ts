export const C = {
  bg: '#F7F4EE',
  bgCard: '#F1F1F1',
  bgDark: '#171917',
  bgAlt: '#F3EEE6',
  border: '#DED7CC',
  gold: '#C9B88E',
  blue: '#7FDEFF',
  green: '#4ade80',
  purple: '#a78bfa',
  orange: '#f97316',
  text: '#171917',
  lightText: '#F3F4F3',
  muted: '#4F564F',
  faint: '#7A8476',
  // Light frosted card (on C.bgAlt surface)
  lightCardBg:     'rgba(255,255,255,0.88)',
  lightCardBorder: 'rgba(255,255,255,0.70)',
  // Nav frosted background
  navBg: 'rgba(247,244,238,0.92)',
} as const

export const DARK = {
  text:       '#F3F4F3',  // was rgba(255,255,255,0.95)
  body:       '#BFBFBF',  // was rgba(255,255,255,0.72)
  label:      '#838383',  // was rgba(255,255,255,0.46)
  cardBorder: '#333533',  // was rgba(255,255,255,0.12)
  cardBg:     '#232423',  // was rgba(255,255,255,0.05)
  // Intro tagline hierarchy (on #1A1A18 bg)
  heading:    'rgba(255,255,255,0.95)',  // primary heading — near-white
  subheading: 'rgba(255,255,255,0.35)', // secondary/ghost heading
  descriptor: 'rgba(255,255,255,0.50)', // body descriptor
} as const

// Caption card pattern — used on top of editorial images in HeroSection & PillarsSection
export const OVERLAY = {
  // Pill (light, frosted)
  pillBg:         '#F1F1F1',              // C.bgCard — solid fallback under backdrop-filter
  pillBorder:     'rgba(255,255,255,0.45)',
  pillText:       '#4F564F',              // C.muted
  // Dark caption card
  cardBg:         'rgba(23,25,23,0.72)',  // near-opaque dark — intentional alpha for blur effect
  cardBorder:     'rgba(255,255,255,0.10)',
  cardText:       'rgba(247,244,238,0.92)',
  cardLabel:      'rgba(201,184,142,0.92)', // gold at 92% — intentional alpha
  // Chip row (HeroSection feature chips)
  chipBg:         'rgba(255,255,255,0.82)',
  chipBorder:     '#DED7CC',              // C.border
} as const