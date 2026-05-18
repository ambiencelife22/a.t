// confirmationBriefPdf.ts — Trip Confirmation Brief PDF export
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Page 1: hero full-bleed, frosted glass card top-left (emblem + logo),
//             title block, 4-pill snapshot, booking status legend, contacts
//   - Page 2+: per-room cards (one card per BookingRoom row, image-forward,
//              confirmation number prominent, guest name + party composition)
//   - Fallback: if no rooms on a booking, one card from the booking itself
//   - Drawn SVG-style icons (no external icon assets)
//
// What it does not own:
//   - Font loading (shared via loadGuideFonts / registerGuideFonts)
//   - Data fetching (caller passes ConfirmationBriefData)
//   - jsPDF script loading (useBriefDownload owns this)
//
// Last updated: S46 — Frosted glass card pattern: emblem + logo drawn top-left
//   over hero in renderPage1 (not stampChrome). stampChrome no longer places
//   emblem/logo — footer only.
// Prior: S46 — else chains removed.
// Prior: S45 — redesign: hero prominent, no journey strip,
//   minimal page 1, per-room page 2 from travel_booking_rooms.

import { loadGuideFonts, registerGuideFonts, PDF_FONTS, PDF_FONTS_SANS_MEDIUM_FAMILY } from './guidePdfFonts'
import type { TripBrief, TripBooking, DossierTrip, HouseProfile, BookingRoom } from './adminTripQueries'

// ── Theme ─────────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

const T: Record<string, RGB> = {
  cream:    [250, 247, 242],
  ink:      [26,  29,  26],
  inkSoft:  [60,  66,  60],
  muted:    [120, 115, 105],
  faint:    [180, 175, 165],
  gold:     [180, 145, 80],
  rule:     [220, 215, 205],
  cardBg:   [245, 242, 236],
  white:    [255, 255, 255],
  ambience: [210, 170, 100],
}

const P = { w: 210, h: 297, margin: 16, heroH: 130 } as const
const CW = P.w - P.margin * 2

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConfirmationBriefData {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  heroImageData:   string | null   // pre-loaded JPEG data URL
}

// ── Asset paths ───────────────────────────────────────────────────────────────

const ASSETS = { emblem: '/emblem.png', logoSvg: '/ambience_travel.svg' } as const

// ── Font helpers ──────────────────────────────────────────────────────────────

function serif(doc: any, style: 'normal' | 'italic', size: number) {
  doc.setFont(PDF_FONTS.serif, style); doc.setFontSize(size)
}

function sans(doc: any, style: 'normal' | 'bold' | 'italic' | 'medium', size: number) {
  if (style === 'medium') {
    doc.setFont(PDF_FONTS_SANS_MEDIUM_FAMILY, 'normal')
    doc.setFontSize(size)
    return
  }
  doc.setFont(PDF_FONTS.sans, style)
  doc.setFontSize(size)
}

// ── Image helpers ─────────────────────────────────────────────────────────────

interface Img { data: string; format: 'PNG' | 'JPEG' }

async function loadImg(src: string): Promise<Img | null> {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1
        const ctx = c.getContext('2d'); if (!ctx) { resolve(null); return }
        const isPng = /\.png(\?|$)/i.test(src)
        if (!isPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height) }
        ctx.drawImage(img, 0, 0)
        resolve(isPng
          ? { data: c.toDataURL('image/png'),        format: 'PNG'  }
          : { data: c.toDataURL('image/jpeg', 0.88), format: 'JPEG' })
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function loadSvg(src: string, targetW: number): Promise<Img | null> {
  try {
    const res = await fetch(src); if (!res.ok) return null
    const blob = new Blob([await res.text()], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    return await new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        try {
          const scale = targetW / (img.naturalWidth || targetW)
          const c = document.createElement('canvas')
          c.width  = Math.round((img.naturalWidth  || targetW) * scale)
          c.height = Math.round((img.naturalHeight || targetW / 3) * scale)
          const ctx = c.getContext('2d'); if (!ctx) { URL.revokeObjectURL(url); resolve(null); return }
          ctx.drawImage(img, 0, 0, c.width, c.height)
          URL.revokeObjectURL(url)
          resolve({ data: c.toDataURL('image/png'), format: 'PNG' })
        } catch { URL.revokeObjectURL(url); resolve(null) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  } catch { return null }
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

function rule(doc: any, x: number, y: number, w: number, color: RGB = T.rule, thickness = 0.3) {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(thickness)
  doc.line(x, y, x + w, y)
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildDateRange(s: string | null, e: string | null): string {
  if (!s) return ''
  if (!e) return fmtDate(s)
  const sd = new Date(s.slice(0, 10) + 'T00:00:00')
  const ed = new Date(e.slice(0, 10) + 'T00:00:00')
  const sm = sd.toLocaleDateString('en-US', { month: 'long' })
  const em = ed.toLocaleDateString('en-US', { month: 'long' })
  if (sm === em && sd.getFullYear() === ed.getFullYear())
    return `${sd.getDate()}\u2013${ed.getDate()} ${em} ${ed.getFullYear()}`
  return `${fmtDate(s)}\u2013${fmtDate(e)}`
}

function drawIconCircle(doc: any, icon: string, cx: number, cy: number, r = 5) {
  doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
  doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2])
  doc.setLineWidth(0.4)
  doc.circle(cx, cy, r)
  doc.setLineWidth(0.5)
  doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2])
  const s = r * 0.5
  switch (icon) {
    case 'bed':
      doc.roundedRect(cx - s * 0.9, cy - s * 0.3, s * 1.8, s * 0.8, 0.5, 0.5)
      doc.line(cx - s * 0.9, cy + s * 0.15, cx + s * 0.9, cy + s * 0.15)
      break
    case 'person':
      doc.circle(cx, cy - s * 0.4, s * 0.35)
      doc.ellipse(cx, cy + s * 0.4, s * 0.55, s * 0.45)
      break
    case 'hotel':
      doc.rect(cx - s * 0.7, cy - s * 0.6, s * 1.4, s * 1.2)
      doc.line(cx - s * 0.7, cy - s * 0.05, cx + s * 0.7, cy - s * 0.05)
      break
    case 'flight':
      doc.line(cx - s, cy, cx + s, cy)
      doc.line(cx, cy - s * 0.7, cx, cy + s * 0.3)
      break
    case 'check':
      doc.line(cx - s * 0.5, cy, cx - s * 0.1, cy + s * 0.5)
      doc.line(cx - s * 0.1, cy + s * 0.5, cx + s * 0.5, cy - s * 0.5)
      break
    default:
      doc.setFillColor(T.gold[0], T.gold[1], T.gold[2])
      doc.circle(cx, cy, s * 0.4, 'F')
  }
}

// ── Frosted glass card — emblem + logo top-left over hero ─────────────────────
// Per S45 Add 1 standing rules: white semi-transparent rounded rect, top-left,
// padding 8mm. Never float emblem over raw hero without background.

function drawFrostedLogoCard(doc: any, emblem: Img | null, logo: Img | null) {
  const cardX   = P.margin
  const cardY   = 8
  const padH    = 5   // vertical padding inside card
  const padW    = 5   // horizontal padding inside card
  const emblemS = 16  // emblem square size mm
  const logoH   = 9   // logo height mm
  const logoW   = logoH * 4.0
  const gap     = 4   // gap between emblem and logo

  // Card dimensions
  const cardW = padW + emblemS + gap + logoW + padW
  const cardH = padH * 2 + Math.max(emblemS, logoH)

  // Frosted background — semi-transparent, subtle border
  doc.setGState(doc.GState({ opacity: 0.72 }))
  doc.setFillColor(250, 247, 242)
  doc.setDrawColor(200, 195, 185)
  doc.setLineWidth(0.2)
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'FD')
  doc.setGState(doc.GState({ opacity: 1 }))

  // Emblem
  const emblemX = cardX + padW
  const emblemY = cardY + padH
  if (emblem) {
    doc.addImage(emblem.data, emblem.format, emblemX, emblemY, emblemS, emblemS, undefined, 'FAST')
  }

  // Logo — vertically centred alongside emblem
  const logoX = emblemX + emblemS + gap
  const logoY = cardY + padH + (emblemS - logoH) / 2
  if (logo) {
    doc.addImage(logo.data, logo.format, logoX, logoY, logoW, logoH, undefined, 'FAST')
  }
}

// ── Page chrome — footer only (no emblem/logo — drawn in renderPage1) ─────────

function stampChrome(doc: any, brief: TripBrief | null) {
  const count  = doc.getNumberOfPages()
  const footer = brief?.footer_tagline ?? 'PRIVATE TRAVEL DESIGN  \u00b7  TAILORED SUPPORT  \u00b7  SEAMLESS EXECUTION'

  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    rule(doc, P.margin, P.h - 10, CW)
    doc.setFillColor(T.ambience[0], T.ambience[1], T.ambience[2])
    doc.circle(P.w / 2, P.h - 7.5, 0.8, 'F')
    sans(doc, 'normal', 6.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(footer, P.margin, P.h - 5.5)
    doc.text(`PAGE ${i} OF ${count}`, P.w - P.margin, P.h - 5.5, { align: 'right' })
  }
}

// ── Page 1 ────────────────────────────────────────────────────────────────────

function renderPage1(doc: any, d: ConfirmationBriefData, emblem: Img | null, logo: Img | null) {
  const { trip, brief, house } = d

  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  // Hero
  let heroDrawn = false
  if (d.heroImageData) {
    try {
      doc.addImage(d.heroImageData, 'JPEG', 0, 0, P.w, P.heroH, undefined, 'FAST')
      for (let i = 0; i < 40; i++) {
        const a = i / 40
        const r = Math.round(T.cream[0] * a + 255 * (1 - a))
        const g = Math.round(T.cream[1] * a + 255 * (1 - a))
        const b = Math.round(T.cream[2] * a + 255 * (1 - a))
        doc.setFillColor(r, g, b)
        doc.setGState(doc.GState({ opacity: a * 0.95 }))
        doc.rect(0, P.heroH - 40 + i, P.w, 1.2, 'F')
      }
      doc.setGState(doc.GState({ opacity: 1 }))
      heroDrawn = true
    } catch { /* silent */ }
  }
  if (!heroDrawn) {
    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.rect(0, 0, P.w, P.heroH, 'F')
  }

  // Frosted glass card — emblem + logo top-left over hero
  drawFrostedLogoCard(doc, emblem, logo)

  let y: number = P.heroH + 6

  const title = brief?.brief_title ?? d.destinationName
  serif(doc, 'normal', 32)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  const titleLines = doc.splitTextToSize(title, CW)
  for (const line of titleLines) { doc.text(line, P.margin, y); y += 12 }
  y -= 2

  const labelText = (brief?.brief_subtitle ?? 'TRIP CONFIRMATION BRIEF').toUpperCase()
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  const lw2    = doc.getTextWidth(labelText)
  const labelX = P.w / 2 - lw2 / 2
  doc.text(labelText, labelX, y, { charSpace: 0.8 })
  rule(doc, P.margin, y - 1.5, labelX - P.margin - 3, T.gold, 0.5)
  rule(doc, labelX + lw2 + 3, y - 1.5, P.w - P.margin - labelX - lw2 - 3, T.gold, 0.5)
  y += 5

  doc.setFillColor(T.gold[0], T.gold[1], T.gold[2])
  doc.circle(P.w / 2, y, 0.8, 'F')
  y += 5

  const preparedFor = brief?.prepared_for ?? house?.display_name ?? ''
  if (preparedFor) {
    serif(doc, 'italic', 11)
    doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
    doc.text(`Prepared for ${preparedFor}`, P.w / 2, y, { align: 'center' })
    y += 7
  }
  const dateRange = brief?.snapshot_dates ?? buildDateRange(trip.start_date, trip.end_date)
  sans(doc, 'normal', 9)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  doc.text(dateRange, P.w / 2, y, { align: 'center' })
  y += 10

  rule(doc, P.margin, y, CW); y += 8

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('TRIP SNAPSHOT', P.w / 2, y, { align: 'center', charSpace: 0.8 })
  y += 7

  const snaps = [
    { icon: 'hotel',  label: 'DESTINATION', value: brief?.snapshot_destination ?? d.destinationName },
    { icon: 'flight', label: 'DATES',       value: brief?.snapshot_dates ?? dateRange },
    { icon: 'person', label: 'GUESTS',      value: brief?.snapshot_guests ?? `${trip.guest_count_adults ?? 0} Adults` },
    { icon: 'check',  label: 'STATUS',      value: brief?.snapshot_status ?? 'Confirmed' },
  ]
  const cw4 = (CW - 6) / 4; const ch = 24
  snaps.forEach((item, i) => {
    const bx = P.margin + i * (cw4 + 2); const cx = bx + cw4 / 2
    doc.setFillColor(T.white[0], T.white[1], T.white[2])
    doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(bx, y, cw4, ch, 2, 2, 'FD')
    drawIconCircle(doc, item.icon, cx, y + 7, 4)
    sans(doc, 'bold', 6)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(item.label, cx, y + 15, { align: 'center', charSpace: 0.5 })
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    const vl = doc.splitTextToSize(item.value, cw4 - 4)
    doc.text(vl[0] ?? '', cx, y + 20, { align: 'center' })
  })
  y += ch + 8

  rule(doc, P.margin, y, CW); y += 8

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('BOOKING STATUS', P.w / 2, y, { align: 'center', charSpace: 0.8 })
  y += 6

  const legendItems = [
    { color: T.gold,  label: 'Booked by ambience' },
    { color: T.faint, label: 'Self-booked' },
  ]
  let legendX = P.w / 2 - 38
  legendItems.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2])
    doc.circle(legendX, y - 1, 2, 'F')
    sans(doc, 'normal', 8)
    doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
    doc.text(item.label, legendX + 4, y)
    legendX += doc.getTextWidth(item.label) + 12
  })
  y += 10

  rule(doc, P.margin, y, CW); y += 8

  const colW = (CW - 6) / 2
  const colR = P.margin + colW + 6

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('PRIMARY CONTACTS', P.margin, y, { charSpace: 0.6 })
  doc.text('HOTEL CONTACT', colR, y, { charSpace: 0.6 })
  y += 6

  const aName  = brief?.advisor_name  ?? ''
  const aEmail = brief?.advisor_email ?? ''
  const aPhone = brief?.advisor_phone ?? ''
  drawIconCircle(doc, 'person', P.margin + 5, y + 4, 3.5)
  sans(doc, 'bold', 8.5)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text(aName || 'Lead Travel Designer \u2014 ambience', P.margin + 11, y + 2)
  sans(doc, 'normal', 7.5)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  let ay = y + 6
  if (aEmail) { doc.text(aEmail, P.margin + 11, ay); ay += 4 }
  if (aPhone) { doc.text(aPhone, P.margin + 11, ay) }

  drawIconCircle(doc, 'hotel', colR + 5, y + 4, 3.5)
  sans(doc, 'normal', 8)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  doc.text(brief?.hotel_contact_note ?? 'Shared closer to arrival', colR + 11, y + 4)
}

// ── Page 2+ — per-room cards ──────────────────────────────────────────────────

async function renderRoomPages(doc: any, d: ConfirmationBriefData) {
  doc.addPage()
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  const { trip, brief } = d
  const hotelName = trip.bookings[0]?._hotel_name ?? trip.bookings[0]?.name ?? d.destinationName
  const dateRange = brief?.snapshot_dates ?? buildDateRange(trip.start_date, trip.end_date)

  let y: number = 34

  serif(doc, 'normal', 24)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text('Confirmed Arrangements', P.margin, y); y += 5

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('KEY RESERVATIONS & OPERATIONAL NOTES', P.margin, y, { charSpace: 0.5 }); y += 4

  sans(doc, 'normal', 8)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  doc.text(`${hotelName}  \u00b7  ${dateRange}`, P.margin, y); y += 8

  rule(doc, P.margin, y, CW); y += 8

  const allRooms: { room: BookingRoom; booking: TripBooking }[] = []
  for (const b of trip.bookings.filter(bk => bk.brief_show !== false)) {
    if (b._rooms.length > 0) {
      for (const r of b._rooms) allRooms.push({ room: r, booking: b })
      continue
    }
    const synthetic: BookingRoom = {
      id: b.id, booking_id: b.id,
      room_name:           b.name,
      confirmation_number: b.confirmation_number,
      guest_name:          d.house?.display_name ?? null,
      party_composition:   b.party_composition,
      notes:               b.inclusions ?? null,
      nights:              b.nights,
      rate:                b.commissionable_rate,
      tax_pct:             b.taxes_and_fees,
      total:               null,
      brief_image_src:     b.brief_image_src,
      sort_order:          b.sort_order ?? 0,
      created_at:          b.created_at ?? '',
      updated_at:          b.updated_at ?? '',
    }
    allRooms.push({ room: synthetic, booking: b })
  }

  const imgW = 70   // landscape ~3:2
  const imgH = 47

  for (const { room, booking } of allRooms) {
    // Pre-load image before drawing so we know actual dimensions
    let roomImgData: Awaited<ReturnType<typeof loadImg>> = null
    if (room.brief_image_src) {
      try { roomImgData = await loadImg(room.brief_image_src) } catch { /* silent */ }
    }

    // Estimate content height to size card dynamically
    const tx = P.margin + imgW + 10
    const tw = CW - imgW - 10 - 2
    let contentH = 8 // top padding
    if (room.confirmation_number) contentH += 4 + 7
    if (room.guest_name)          contentH += 6
    if (room.party_composition)   contentH += 5
    if (room.room_name)           contentH += 4
    // room.notes is internal — not shown on client brief
    contentH += 6 // bottom padding

    // cardH: content side gets +6 padding; image side must be flush
    const cardH = Math.max(imgH + 6, contentH)

    if (y + cardH > P.h - 18) {
      doc.addPage()
      doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
      doc.rect(0, 0, P.w, P.h, 'F')
      y = 34
    }

    doc.setFillColor(T.white[0], T.white[1], T.white[2])
    doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

    if (roomImgData) {
      doc.addImage(roomImgData.data, roomImgData.format, P.margin, y, imgW, imgH, undefined, 'FAST')
    }
    if (!roomImgData) {
      doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
      doc.rect(P.margin, y, imgW, imgH, 'F')
    }

    let ty = y + 8

    if (room.confirmation_number) {
      sans(doc, 'bold', 7)
      doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
      doc.text('CONFIRMATION', tx, ty, { charSpace: 0.4 }); ty += 4
      sans(doc, 'bold', 13)
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
      doc.text(`#${room.confirmation_number}`, tx, ty); ty += 7
    }

    if (room.guest_name) {
      serif(doc, 'normal', 13)
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
      doc.text(room.guest_name, tx, ty); ty += 6
    }

    if (room.party_composition) {
      sans(doc, 'normal', 8.5)
      doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
      doc.text(room.party_composition, tx, ty); ty += 5
    }

    if (room.room_name) {
      sans(doc, 'italic', 8)
      doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
      const rLines = doc.splitTextToSize(room.room_name, tw)
      doc.text(rLines[0] ?? '', tx, ty); ty += 4
    }

    const bookedBy  = booking.booked_by ?? 'ambience'
    const pillLabel = bookedBy === 'ambience' ? 'BOOKED BY AMBIENCE' : 'SELF-BOOKED'
    const pillColor = bookedBy === 'ambience' ? T.gold : T.faint
    sans(doc, 'bold', 5.5)
    doc.setTextColor(pillColor[0], pillColor[1], pillColor[2])
    const pillW = doc.getTextWidth(pillLabel) + 8
    const pillX = P.margin + CW - 2 - pillW
    doc.setDrawColor(pillColor[0], pillColor[1], pillColor[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(pillX, y + 4, pillW, 5, 1, 1)
    doc.text(pillLabel, pillX + pillW / 2, y + 7.5, { align: 'center', charSpace: 0.3 })

    y += cardH + 5
  }
}

// ── Filename ──────────────────────────────────────────────────────────────────

function buildFilename(d: ConfirmationBriefData): string {
  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mm    = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy  = today.getFullYear()
  const safe  = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase()
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
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  renderPage1(doc, data, emblem, logo)
  await renderRoomPages(doc, data)
  stampChrome(doc, data.brief)

  doc.save(buildFilename(data))
}