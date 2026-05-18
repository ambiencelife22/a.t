// confirmationBriefPdf.ts — Trip Confirmation Brief PDF export
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Page 1: hero image fade, emblem + logo, title block, trip snapshot,
//             journey overview strip, booking status legend, contacts, notes
//   - Page 2: confirmed arrangements (per-booking cards with category icons)
//   - Drawn SVG-style icons (no external icon assets required)
//   - Filename construction
//
// What it does not own:
//   - Font loading (shared via loadGuideFonts / registerGuideFonts)
//   - Data fetching (caller passes ConfirmationBriefData)
//   - jsPDF script loading (useBriefDownload owns this)
//
// Icon vocabulary (drawn): flight | car | bed | dining | anchor | yacht |
//   experience | departure | transfer | wellness | person | hotel
//
// Last updated: S45 — initial ship.

import { loadGuideFonts, registerGuideFonts, PDF_FONTS, PDF_FONTS_SANS_MEDIUM_FAMILY } from './guidePdfFonts'
import type { TripBrief, TripBooking, DossierTrip, HouseProfile } from './adminTripQueries'

// ── Theme ─────────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

const T: Record<string, RGB> = {
  cream:     [250, 247, 242],
  ink:       [26,  29,  26],
  inkSoft:   [60,  66,  60],
  muted:     [120, 115, 105],
  faint:     [180, 175, 165],
  gold:      [180, 145, 80],
  goldLight: [220, 190, 130],
  rule:      [220, 215, 205],
  cardBg:    [245, 242, 236],
  white:     [255, 255, 255],
  ambience:  [210, 170, 100],
}

// ── Layout ────────────────────────────────────────────────────────────────────

const P = {
  w:      210,
  h:      297,
  margin: 14,
  heroH:  72,   // hero image height mm
} as const

const CW = P.w - P.margin * 2

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConfirmationBriefData {
  trip:     DossierTrip
  brief:    TripBrief | null
  house:    HouseProfile | null
  // Resolved destination name (from global_destinations or brief override)
  destinationName: string
  // Hero image data URL (pre-loaded by caller)
  heroImageData:   string | null
}

// ── Asset paths ───────────────────────────────────────────────────────────────

const ASSET_PATHS = {
  emblem:  '/emblem.png',
  logoSvg: '/ambience_travel.svg',
} as const

// ── Font helpers ──────────────────────────────────────────────────────────────

function setSerif(doc: any, style: 'normal' | 'italic', size: number) {
  doc.setFont(PDF_FONTS.serif, style); doc.setFontSize(size)
}
function setSans(doc: any, style: 'normal' | 'bold' | 'italic' | 'medium', size: number) {
  if (style === 'medium') doc.setFont(PDF_FONTS_SANS_MEDIUM_FAMILY, 'normal')
  else doc.setFont(PDF_FONTS.sans, style)
  doc.setFontSize(size)
}

// ── Image helpers ─────────────────────────────────────────────────────────────

interface ImgPayload { data: string; format: 'PNG' | 'JPEG' }

async function loadImg(src: string): Promise<ImgPayload | null> {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 1; canvas.height = img.naturalHeight || 1
        const ctx = canvas.getContext('2d'); if (!ctx) { resolve(null); return }
        const isPng = /\.png(\?|$)/i.test(src)
        if (!isPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
        ctx.drawImage(img, 0, 0)
        resolve(isPng
          ? { data: canvas.toDataURL('image/png'),        format: 'PNG'  }
          : { data: canvas.toDataURL('image/jpeg', 0.88), format: 'JPEG' })
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function loadSvg(src: string, targetW: number): Promise<ImgPayload | null> {
  try {
    const res = await fetch(src); if (!res.ok) return null
    const blob = new Blob([await res.text()], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    return await new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        try {
          const scale  = targetW / (img.naturalWidth || targetW)
          const canvas = document.createElement('canvas')
          canvas.width  = Math.round((img.naturalWidth  || targetW) * scale)
          canvas.height = Math.round((img.naturalHeight || targetW / 3) * scale)
          const ctx = canvas.getContext('2d'); if (!ctx) { URL.revokeObjectURL(url); resolve(null); return }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          resolve({ data: canvas.toDataURL('image/png'), format: 'PNG' })
        } catch { URL.revokeObjectURL(url); resolve(null) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  } catch { return null }
}

// ── Icon drawing ──────────────────────────────────────────────────────────────

function drawIcon(doc: any, icon: string, cx: number, cy: number, size = 5) {
  const s = size / 2
  doc.setLineWidth(0.5)
  doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2])
  doc.setFillColor(T.gold[0], T.gold[1], T.gold[2])

  switch (icon) {
    case 'flight':
      // Simple airplane shape
      doc.setLineWidth(0.6)
      doc.line(cx - s, cy, cx + s, cy)
      doc.line(cx, cy - s * 0.8, cx, cy + s * 0.3)
      doc.line(cx - s * 0.5, cy + s * 0.1, cx + s * 0.5, cy + s * 0.1)
      break
    case 'car': case 'transfer':
      // Rectangle body + wheels
      doc.roundedRect(cx - s * 0.9, cy - s * 0.3, s * 1.8, s * 0.8, 0.8, 0.8)
      doc.circle(cx - s * 0.45, cy + s * 0.4, s * 0.25, 'F')
      doc.circle(cx + s * 0.45, cy + s * 0.4, s * 0.25, 'F')
      break
    case 'bed':
      // Bed rectangle
      doc.roundedRect(cx - s * 0.9, cy - s * 0.2, s * 1.8, s * 0.7, 0.6, 0.6)
      doc.line(cx - s * 0.9, cy + s * 0.15, cx + s * 0.9, cy + s * 0.15)
      doc.circle(cx - s * 0.5, cy - s * 0.05, s * 0.2, 'F')
      break
    case 'dining':
      // Fork and knife
      doc.line(cx - s * 0.25, cy - s * 0.7, cx - s * 0.25, cy + s * 0.7)
      doc.line(cx + s * 0.25, cy - s * 0.7, cx + s * 0.25, cy + s * 0.7)
      doc.line(cx - s * 0.25, cy - s * 0.2, cx + s * 0.25, cy - s * 0.2)
      break
    case 'anchor':
      // Circle + vertical line + arc
      doc.circle(cx, cy - s * 0.5, s * 0.3)
      doc.line(cx, cy - s * 0.2, cx, cy + s * 0.6)
      doc.line(cx - s * 0.5, cy - s * 0.1, cx + s * 0.5, cy - s * 0.1)
      break
    case 'yacht': case 'departure':
      // Sail shape
      doc.line(cx, cy - s * 0.8, cx, cy + s * 0.5)
      doc.line(cx, cy - s * 0.8, cx + s * 0.7, cy + s * 0.2)
      doc.line(cx, cy + s * 0.2, cx + s * 0.7, cy + s * 0.2)
      doc.line(cx - s * 0.7, cy + s * 0.5, cx + s * 0.7, cy + s * 0.5)
      break
    case 'experience': case 'wellness':
      // Star / sparkle
      doc.line(cx, cy - s * 0.8, cx, cy + s * 0.8)
      doc.line(cx - s * 0.8, cy, cx + s * 0.8, cy)
      doc.line(cx - s * 0.55, cy - s * 0.55, cx + s * 0.55, cy + s * 0.55)
      doc.line(cx + s * 0.55, cy - s * 0.55, cx - s * 0.55, cy + s * 0.55)
      break
    case 'person':
      doc.circle(cx, cy - s * 0.4, s * 0.3)
      doc.ellipse(cx, cy + s * 0.35, s * 0.5, s * 0.4)
      break
    case 'hotel':
      doc.rect(cx - s * 0.7, cy - s * 0.6, s * 1.4, s * 1.2)
      doc.rect(cx - s * 0.2, cy + s * 0.1, s * 0.4, s * 0.5)
      doc.line(cx - s * 0.7, cy - s * 0.1, cx + s * 0.7, cy - s * 0.1)
      break
    default:
      doc.circle(cx, cy, s * 0.5, 'F')
  }
}

function drawIconCircle(doc: any, icon: string, cx: number, cy: number, r = 6) {
  doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
  doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2])
  doc.setLineWidth(0.4)
  doc.circle(cx, cy, r)
  drawIcon(doc, icon, cx, cy, r * 0.75)
}

// ── Page chrome ───────────────────────────────────────────────────────────────

function stampChrome(doc: any, brief: TripBrief | null, emblem: ImgPayload | null, logo: ImgPayload | null) {
  const count = doc.getNumberOfPages()
  const footer = brief?.footer_tagline ?? 'PRIVATE TRAVEL DESIGN  \u00b7  TAILORED SUPPORT  \u00b7  SEAMLESS EXECUTION'

  for (let i = 1; i <= count; i++) {
    doc.setPage(i)

    // Emblem + logo centred at top
    if (emblem) {
      const eSize = 8
      doc.addImage(emblem.data, emblem.format, P.w / 2 - eSize / 2, 5, eSize, eSize, undefined, 'FAST')
    }
    if (logo) {
      const lh = 6; const lw = lh * 3
      doc.addImage(logo.data, logo.format, P.w / 2 - lw / 2, 14, lw, lh, undefined, 'FAST')
    }

    // Footer rule
    doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
    doc.setLineWidth(0.3)
    doc.line(P.margin, P.h - 10, P.w - P.margin, P.h - 10)

    // Footer emblem dot
    doc.setFillColor(T.ambience[0], T.ambience[1], T.ambience[2])
    doc.circle(P.w / 2, P.h - 8, 0.8, 'F')

    // Footer text
    setSans(doc, 'normal', 6.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(footer, P.margin, P.h - 6)
    doc.text(`PAGE ${i} OF ${count}`, P.w - P.margin, P.h - 6, { align: 'right' })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function goldRule(doc: any, x: number, y: number, w: number) {
  doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2])
  doc.setLineWidth(0.5)
  doc.line(x, y, x + w, y)
}

function faintRule(doc: any, x: number, y: number, w: number) {
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.line(x, y, x + w, y)
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  if (!end) return fmtDate(start)
  const s = new Date(start.slice(0, 10) + 'T00:00:00')
  const e = new Date(end.slice(0,   10) + 'T00:00:00')
  const sm = s.toLocaleDateString('en-US', { month: 'long' })
  const em = e.toLocaleDateString('en-US', { month: 'long' })
  const sy = s.getFullYear(); const ey = e.getFullYear()
  if (sy === ey && sm === em) return `${s.getDate()}\u2013${e.getDate()} ${em} ${ey}`
  if (sy === ey) return `${s.getDate()} ${sm}\u2013${e.getDate()} ${em} ${ey}`
  return `${fmtDate(start)}\u2013${fmtDate(end)}`
}

function buildGuestsStr(adults: number | null, children: number | null): string {
  const a = adults ?? 0; const c = children ?? 0
  const parts = []
  if (a > 0) parts.push(`${a} Adult${a !== 1 ? 's' : ''}`)
  if (c > 0) parts.push(`${c} Child${c !== 1 ? 'ren' : ''}`)
  return parts.join(', ') || '--'
}

// ── Page 1 renderer ───────────────────────────────────────────────────────────

function renderPage1(doc: any, d: ConfirmationBriefData) {
  const { trip, brief, house } = d
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  // Hero image with bottom fade
  if (d.heroImageData) {
    try {
      doc.addImage(d.heroImageData, 'JPEG', 0, 0, P.w, P.heroH, undefined, 'FAST')
      // Fade overlay: gradient from transparent to cream
      for (let i = 0; i < 28; i++) {
        const alpha = i / 28
        const r = Math.round(T.cream[0] * alpha + 255 * (1 - alpha))
        const g = Math.round(T.cream[1] * alpha + 255 * (1 - alpha))
        const b = Math.round(T.cream[2] * alpha + 255 * (1 - alpha))
        doc.setFillColor(r, g, b)
        doc.setGState(doc.GState({ opacity: alpha * 0.9 }))
        doc.rect(0, P.heroH - 28 + i, P.w, 1.2, 'F')
      }
      doc.setGState(doc.GState({ opacity: 1 }))
    } catch { /* hero failed silently */ }
  }

  let y: number = P.heroH + 4

  // Title block
  const title = brief?.brief_title ?? d.destinationName
  setSerif(doc, 'normal', 28)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  const titleLines = doc.splitTextToSize(title, CW)
  for (const line of titleLines) { doc.text(line, P.margin, y); y += 10 }
  y -= 2

  // TRIP CONFIRMATION BRIEF label with rules
  const labelText = (brief?.brief_subtitle ?? 'TRIP CONFIRMATION BRIEF').toUpperCase()
  const labelW    = P.w - P.margin * 2 - 20
  setSans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  const lw = doc.getTextWidth(labelText)
  const labelX = P.w / 2 - lw / 2
  doc.text(labelText, labelX, y, { charSpace: 0.8 })
  goldRule(doc, P.margin, y - 1.5, labelX - P.margin - 2)
  goldRule(doc, labelX + lw + 2, y - 1.5, P.w - P.margin - labelX - lw - 2)
  y += 5

  // Gold dot
  doc.setFillColor(T.gold[0], T.gold[1], T.gold[2])
  doc.circle(P.w / 2, y, 0.8, 'F')
  y += 5

  // Prepared for
  const preparedFor = brief?.prepared_for ?? house?.display_name ?? ''
  if (preparedFor) {
    setSerif(doc, 'italic', 10)
    doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
    doc.text(`Prepared for ${preparedFor}`, P.w / 2, y, { align: 'center' })
    y += 6
  }

  // Date range
  const dateRange = brief?.snapshot_dates ?? buildDateRange(trip.start_date, trip.end_date)
  setSans(doc, 'normal', 9)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  doc.text(dateRange, P.w / 2, y, { align: 'center' })
  y += 8

  faintRule(doc, P.margin, y, CW); y += 8

  // ── Trip Snapshot ──────────────────────────────────────────────────────────
  setSans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('TRIP SNAPSHOT', P.w / 2, y, { align: 'center', charSpace: 0.8 })
  y += 6

  const snapshotItems = [
    { icon: 'hotel',  label: 'DESTINATION', value: brief?.snapshot_destination ?? d.destinationName },
    { icon: 'flight', label: 'DATES',       value: brief?.snapshot_dates ?? dateRange },
    { icon: 'person', label: 'GUESTS',      value: brief?.snapshot_guests ?? buildGuestsStr(trip.guest_count_adults, trip.guest_count_children) },
    { icon: 'anchor', label: 'STATUS',      value: brief?.snapshot_status ?? (trip.status ? trip.status.charAt(0).toUpperCase() + trip.status.slice(1) : 'Confirmed') },
  ]

  const cardW = (CW - 6) / 4; const cardH = 22
  snapshotItems.forEach((item, i) => {
    const cx = P.margin + i * (cardW + 2) + cardW / 2
    const bx = P.margin + i * (cardW + 2)
    doc.setFillColor(T.white[0], T.white[1], T.white[2])
    doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(bx, y, cardW, cardH, 2, 2, 'FD')
    drawIconCircle(doc, item.icon, cx, y + 6, 3.5)
    setSans(doc, 'bold', 6)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(item.label, cx, y + 13, { align: 'center', charSpace: 0.5 })
    setSans(doc, 'normal', 7.5)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    const vLines = doc.splitTextToSize(item.value, cardW - 4)
    doc.text(vLines[0] ?? '', cx, y + 18.5, { align: 'center' })
  })
  y += cardH + 8

  // ── Journey Overview ───────────────────────────────────────────────────────
  faintRule(doc, P.margin, y, CW); y += 6
  setSans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('JOURNEY OVERVIEW', P.w / 2, y, { align: 'center', charSpace: 0.8 })
  y += 7

  const steps = brief?.journey_steps ?? []
  if (steps.length > 0) {
    const stepW = CW / steps.length
    steps.forEach((step, i) => {
      const cx = P.margin + i * stepW + stepW / 2
      drawIconCircle(doc, step.icon, cx, y + 5, 4.5)

      // Connector line
      if (i < steps.length - 1) {
        doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
        doc.setLineWidth(0.3)
        doc.setLineDashPattern([1, 1], 0)
        doc.line(cx + 4.5, y + 5, cx + stepW - 4.5, y + 5)
        doc.setLineDashPattern([], 0)
      }

      setSans(doc, 'bold', 6)
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
      doc.text(step.label.toUpperCase(), cx, y + 13, { align: 'center', charSpace: 0.4 })
      setSans(doc, 'normal', 7)
      doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
      const dLines = doc.splitTextToSize(step.detail, stepW - 4)
      dLines.slice(0, 2).forEach((l: string, li: number) => {
        doc.text(l, cx, y + 17 + li * 4, { align: 'center' })
      })
    })
    y += 26
  } else {
    setSans(doc, 'italic', 8)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text('No journey steps added yet.', P.w / 2, y + 4, { align: 'center' })
    y += 12
  }

  // ── Booking Status legend ──────────────────────────────────────────────────
  faintRule(doc, P.margin, y, CW); y += 6
  setSans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('BOOKING STATUS', P.w / 2, y, { align: 'center', charSpace: 0.8 })
  y += 5

  const legendItems = [
    { color: T.gold,  label: 'Booked by ambience' },
    { color: T.faint, label: 'Self-booked' },
  ]
  let legendX = P.w / 2 - 42
  legendItems.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2])
    doc.circle(legendX, y - 1, 2, 'F')
    setSans(doc, 'normal', 8)
    doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
    doc.text(item.label, legendX + 4, y)
    legendX += doc.getTextWidth(item.label) + 10
  })
  y += 8

  // ── Contacts + Notes two-column ────────────────────────────────────────────
  faintRule(doc, P.margin, y, CW); y += 6

  const colW = (CW - 6) / 2
  const colR = P.margin + colW + 6

  // Left: Primary Contacts
  setSans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('PRIMARY CONTACTS', P.margin, y, { charSpace: 0.6 })

  // Right: Important Notes
  doc.text('IMPORTANT NOTES', colR, y, { charSpace: 0.6 })
  y += 5

  // Advisor contact
  const advisorName  = brief?.advisor_name  ?? ''
  const advisorEmail = brief?.advisor_email ?? ''
  const advisorPhone = brief?.advisor_phone ?? ''

  let cy = y
  if (advisorName || advisorEmail || advisorPhone) {
    drawIconCircle(doc, 'person', P.margin + 5, cy + 4, 3.5)
    setSans(doc, 'bold', 8)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text('Lead Travel Designer \u2014 ambience', P.margin + 11, cy + 2)
    setSans(doc, 'normal', 7.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    if (advisorEmail) { doc.text(advisorEmail, P.margin + 11, cy + 6); cy += 4 }
    if (advisorPhone) { doc.text(advisorPhone, P.margin + 11, cy + 6); cy += 4 }
    cy += 8
  }

  const hotelNote = brief?.hotel_contact_note ?? 'Shared closer to arrival'
  drawIconCircle(doc, 'hotel', P.margin + 5, cy + 4, 3.5)
  setSans(doc, 'bold', 8)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text('Hotel Contact', P.margin + 11, cy + 2)
  setSans(doc, 'normal', 7.5)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  doc.text(hotelNote, P.margin + 11, cy + 6)

  // Notes
  const notes = brief?.important_notes ?? []
  let ny = y
  notes.slice(0, 5).forEach(note => {
    doc.setFillColor(T.gold[0], T.gold[1], T.gold[2])
    doc.circle(colR + 1.5, ny + 0.5, 1, 'F')
    setSans(doc, 'normal', 8)
    doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
    const nLines = doc.splitTextToSize(note, colW - 8)
    nLines.forEach((l: string, li: number) => {
      doc.text(l, colR + 5, ny + li * 4)
    })
    ny += nLines.length * 4 + 3
  })
}

// ── Page 2 renderer ───────────────────────────────────────────────────────────

async function renderPage2(doc: any, d: ConfirmationBriefData) {
  doc.addPage()
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  // Mini hero fade at top
  if (d.heroImageData) {
    try {
      doc.addImage(d.heroImageData, 'JPEG', 0, 0, P.w, 28, undefined, 'FAST')
      for (let i = 0; i < 14; i++) {
        const alpha = i / 14
        doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
        doc.setGState(doc.GState({ opacity: alpha }))
        doc.rect(0, 14 + i, P.w, 1.5, 'F')
      }
      doc.setGState(doc.GState({ opacity: 1 }))
    } catch { /* silent */ }
  }

  let y: number = 30

  // Title
  setSerif(doc, 'normal', 22)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text('Confirmed Arrangements', P.margin, y)
  y += 4

  setSans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('KEY RESERVATIONS & OPERATIONAL NOTES', P.margin, y, { charSpace: 0.5 })
  y += 4

  setSans(doc, 'normal', 8)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  const subtitle = `${d.destinationName}  \u00b7  ${d.brief?.snapshot_dates ?? buildDateRange(d.trip.start_date, d.trip.end_date)}`
  doc.text(subtitle, P.margin, y)
  y += 6

  faintRule(doc, P.margin, y, CW); y += 6

  // Booking cards — grouped by brief_category, sorted by sort_order
  const visibleBookings = d.trip.bookings.filter(b => b.brief_show !== false)

  // Group by category
  const categoryOrder = ['Accommodation', 'Arrival & Transfers', 'Dining', 'Experiences', 'Additional Notes']
  const grouped = new Map<string, TripBooking[]>()
  for (const b of visibleBookings) {
    const cat = b.brief_category ?? b.booking_type ?? 'Other'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(b)
  }

  // Sort categories
  const sortedCats = [...grouped.keys()].sort((a, b) => {
    const ai = categoryOrder.indexOf(a); const bi = categoryOrder.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const cardH   = 30
  const imgW    = 36
  const iconR   = 5
  const iconCol = P.margin + imgW + 6

  for (const cat of sortedCats) {
    const bookings = grouped.get(cat)!

    if (y + cardH > P.h - 14) { doc.addPage(); doc.setFillColor(T.cream[0], T.cream[1], T.cream[2]); doc.rect(0, 0, P.w, P.h, 'F'); y = 22 }

    // Card background
    doc.setFillColor(T.white[0], T.white[1], T.white[2])
    doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

    // Booking image (first booking with image)
    const imgBooking = bookings.find(b => b.brief_image_src)
    if (imgBooking?.brief_image_src) {
      try {
        const imgData = await loadImg(imgBooking.brief_image_src)
        if (imgData) doc.addImage(imgData.data, imgData.format, P.margin, y, imgW, cardH, undefined, 'FAST')
        else drawImgFallback(doc, P.margin, y, imgW, cardH)
      } catch { drawImgFallback(doc, P.margin, y, imgW, cardH) }
    } else {
      drawImgFallback(doc, P.margin, y, imgW, cardH)
    }

    // Category icon + label
    const catIcon = catToIcon(cat)
    drawIconCircle(doc, catIcon, iconCol + 4, y + cardH / 2, iconR)
    setSans(doc, 'bold', 6.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(cat.toUpperCase(), iconCol + 11, y + cardH / 2 - 1, { charSpace: 0.4 })

    // Booking details
    const textX = iconCol + 11
    const textW = CW - (textX - P.margin) - 30
    let ty = y + cardH / 2 + 4

    for (const b of bookings.slice(0, 3)) {
      const name = b.name ?? b._hotel_name ?? b.supplier_name_override ?? ''
      setSans(doc, 'bold', 8)
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
      doc.text(name, textX, ty)

      const details: string[] = []
      if (b.start_date) {
        const dr = b.end_date
          ? `${b.booking_type === 'Hotel' ? 'Check-in' : ''}: ${fmtDate(b.start_date)}`
          : fmtDate(b.start_date)
        details.push(dr)
      }
      if (b.booking_type === 'Hotel' && b.end_date) details.push(`Check-out: ${fmtDate(b.end_date)}`)
      if (b.confirmation_number) details.push(`Confirmation: ${b.confirmation_number}`)
      if (b.inclusions) details.push(b.inclusions.split('.')[0])

      setSans(doc, 'normal', 7.5)
      doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
      details.slice(0, 3).forEach(detail => {
        ty += 4
        doc.text(detail, textX, ty)
      })
      ty += 5
    }

    // Booked by pill (top right of card)
    const firstBooking = bookings[0]
    const bookedBy = firstBooking?.booked_by ?? 'ambience'
    const pillColor = bookedBy === 'ambience' ? T.gold : T.faint
    const pillLabel = bookedBy === 'ambience' ? 'BOOKED BY AMBIENCE' : 'SELF-BOOKED'
    const pillX = P.margin + CW - 2
    setSans(doc, 'bold', 5.5)
    doc.setTextColor(pillColor[0], pillColor[1], pillColor[2])
    const pillW = doc.getTextWidth(pillLabel) + 8
    doc.setDrawColor(pillColor[0], pillColor[1], pillColor[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(pillX - pillW, y + 4, pillW, 5, 1, 1)
    doc.text(pillLabel, pillX - pillW / 2, y + 7.5, { align: 'center', charSpace: 0.3 })

    y += cardH + 4
  }
}

function drawImgFallback(doc: any, x: number, y: number, w: number, h: number) {
  doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
  doc.rect(x, y, w, h, 'F')
}

function catToIcon(cat: string): string {
  const map: Record<string, string> = {
    'Accommodation':       'bed',
    'Arrival & Transfers': 'car',
    'Dining':              'dining',
    'Experiences':         'experience',
    'Additional Notes':    'anchor',
  }
  return map[cat] ?? 'anchor'
}

// ── Filename ──────────────────────────────────────────────────────────────────

function buildFilename(d: ConfirmationBriefData): string {
  const today = new Date()
  const dd = String(today.getDate()).padStart(2, '0')
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy = today.getFullYear()
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase()
  return `ambience-confirmation-brief-${safe(d.trip.trip_code)}-${dd}${mm}${yyyy}.pdf`
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportConfirmationBriefPdf(data: ConfirmationBriefData): Promise<void> {
  const w = window as any
  const jsPDF = w.jspdf?.jsPDF
  if (!jsPDF) throw new Error('jsPDF not loaded')

  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSET_PATHS.emblem),
    loadSvg(ASSET_PATHS.logoSvg, 800),
  ])

  renderPage1(doc, data)
  await renderPage2(doc, data)
  stampChrome(doc, data.brief, emblem, logo)

  doc.save(buildFilename(data))
}