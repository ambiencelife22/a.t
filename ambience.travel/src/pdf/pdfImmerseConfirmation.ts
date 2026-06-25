// pdfImmerseConfirmation.ts — Trip Confirmation Brief PDF export
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Hotel cards — image-left header (hotel name, dates, party, booking-level
//     conf when roomless, booked_by), nested room rows beneath (room name,
//     guests, per-room conf pill). Section: "ACCOMMODATION".
//   - Flight cards — icon, route, times, conf# pill. Section: "FLIGHTS".
//   - Contact cards — advisor + selected house guests/staff. S54.
//
// What it does not own:
//   - Hero, footer, theme, date helpers, page helpers → pdfShared.ts
//   - Image loading, SVG rasterisation, cover crop, font helpers → pdfUtils.ts
//   - Font loading / registration → pdfFonts.ts
//
// Last updated: S43 Add 2C — hero, footer, theme, helpers extracted to
//   pdfShared.ts. drawPdfHero() is now canonical across all three PDFs.
// Prior: S54 — Contacts section.
// Prior: S50 — bookedByLabel() canonical.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, makeCoverCropAsync, serif, sans, drawRule } from './pdfUtils'
import type { Img } from './pdfUtils'
import {
  T, P, CW, ASSETS,
  fmtDate, fmtTime, buildDateRange, passengerLines, driverDetailLines, roomDisplay,
  drawOwnArrangementsChip, drawConfPill,
  drawPdfHero, stampPageChrome, addCreamPage,
} from './pdfShared'
import type { TripBrief, TripBooking, DossierTrip, HouseProfile, BookingRoom, TripAuxBooking } from '../queries/queriesAdminTrip'
import { bookedByLabel, isOwnArrangements } from '../utils/utilsBooking'
import { isGroundTransportBooking } from '../types/typesAuxBookings'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConfirmationContact {
  id:    string
  name:  string
  role:  string | null
  email: string | null
  phone: string | null
}

export interface ConfirmationBriefData {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  heroImageData:   string | null
  auxBookings:     TripAuxBooking[]
  contacts?:       ConfirmationContact[]
}

// ── Hotel card ────────────────────────────────────────────────────────────────
// One card per hotel booking: image-left header (hotel name, dates, booking-level
// conf when roomless, booked_by), then nested room rows beneath (room name, guests,
// per-room conf pill). Mirrors the client screen hierarchy.

async function drawHotelCard(doc: any, booking: TripBooking, y: number): Promise<number> {
  const imgW = Math.round(CW * 0.44)
  const padV = 7; const padH = 8
  const contentX = P.margin + imgW; const contentW = CW - imgW

  const ownArr       = isOwnArrangements(booking.booked_by)
  // pill tone derived per call: ownArr ? 'faint' : 'gold'
  const bookedByText = bookedByLabel(booking.booked_by)
  const hotelName    = booking._hotel_name ?? booking.name ?? 'Hotel'
  const dateRange    = buildDateRange(booking.start_date, booking.end_date)
  const rooms        = booking._rooms ?? []

  // Booking-level conf only shows when there are no rooms (rooms carry their own).
  const headerConf   = rooms.length === 0 && booking.confirmation_number
    ? `Conf #:  ${booking.confirmation_number}` : null

  // ── Measure header block ──
  serif(doc, 'normal', 11)
  const nameLines = doc.splitTextToSize(hotelName, contentW - padH * 2)
  const nameH     = nameLines.length * 5.5
  const dateH     = dateRange ? 5 : 0
  const partyH    = booking.party_composition ? 5 : 0
  const bottomH   = headerConf ? 4 + 6 + 7 + 4.5 : 4 + 4.5
  const headerContentH = padV + nameH + dateH + partyH + bottomH + padV
  const headerH   = Math.max(36, headerContentH)

  // ── Measure room rows ──
  const roomRowH = (room: BookingRoom): number => {
    const d = roomDisplay(room)
    const nameH  = d.roomName  ? 5   : 0
    const guestH = d.guestLine ? 4.5 : 0
    const boardH = d.board     ? 4.5 : 0
    return padV + nameH + guestH + boardH + padV
  }
  const roomsH = rooms.reduce((sum, r) => sum + roomRowH(r), 0)
  const cardH  = headerH + (rooms.length > 0 ? roomsH : 0)

  // ── Hotel image (crop to header height) ──
  let croppedImg: { data: string; format: 'PNG' | 'JPEG' } | null = null
  const imgSrc = booking.brief_image_src ?? booking._hotel_image_src
  if (imgSrc) {
    try {
      const raw = await loadImg(imgSrc)
      if (raw) croppedImg = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, imgW, cardH)
    } catch { /* silent */ }
  }

  // ── Card frame ──
  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

  if (croppedImg) {
    doc.addImage(croppedImg.data, croppedImg.format, P.margin, y, imgW, cardH, undefined, 'FAST')
  }
  if (!croppedImg) {
    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.rect(P.margin, y, imgW, cardH, 'F')
  }

  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'D')

  // ── Header text ──
  const tx = contentX + padH; let ty = y + padV

  serif(doc, 'normal', 11)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (const line of nameLines) { doc.text(line, tx, ty); ty += 5.5 }

  if (dateRange) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(dateRange, tx, ty); ty += 5
  }
  if (booking.party_composition) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text((doc.splitTextToSize(booking.party_composition, contentW - padH * 2))[0] ?? '', tx, ty)
    ty += 5
  }

  ty += 4

  if (headerConf) {
    drawConfPill(doc, tx, ty - 4, headerConf, ownArr ? 'faint' : 'gold')
    ty += 7
  }

  if (isOwnArrangements(booking.booked_by)) {
    drawOwnArrangementsChip(doc, tx, ty - 3.6)
  }
  if (!isOwnArrangements(booking.booked_by)) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(bookedByText, tx, ty)
  }
  if (rooms.length > 0) {
    let ry = y + headerH
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i]
      const thisRowH = roomRowH(room)

      // Divider above each room row (separates header / prior room)
      drawRule(doc, contentX, ry, contentW, T.rule, 0.3)

      const d = roomDisplay(room)
      const guestLine = d.guestLine
      const roomConf  = d.conf ? `Conf #:  ${d.conf}` : null

      let rty = ry + padV
      if (d.roomName) {
        sans(doc, 'bold', 8.5)
        doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
        doc.text((doc.splitTextToSize(d.roomName, contentW - padH * 2 - 40))[0] ?? d.roomName, tx, rty)
        rty += 5
      }
      if (guestLine) {
        sans(doc, 'normal', 7.5)
        doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
        doc.text((doc.splitTextToSize(guestLine, contentW - padH * 2 - 40))[0] ?? guestLine, tx, rty)
        rty += 4.5
      }
      if (d.board) {
        sans(doc, 'italic', 7)
        doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
        doc.text((doc.splitTextToSize(d.board, contentW - padH * 2 - 40))[0] ?? d.board, tx, rty)
        rty += 4.5
      }

      // Per-room conf pill — right-aligned within content column
      if (roomConf) {
        sans(doc, 'normal', 7.5)
        const pillW = doc.getTextWidth(roomConf) + 10
        const px = P.margin + CW - padH - pillW
        const py = ry + padV - 2
        drawConfPill(doc, px, py, roomConf, ownArr ? 'faint' : 'gold')
      }

      ry += thisRowH
    }
  }

  return cardH
}

// ── Flight card ───────────────────────────────────────────────────────────────

function drawFlightCard(doc: any, aux: TripAuxBooking, y: number): number {
  const padV = 6; const padH = 10
  const bookedByText = bookedByLabel(aux.booked_by)
  const paxLines = passengerLines(aux)
  const isGroundCar = isGroundTransportBooking(aux.booking_type)
  const detailLines = isGroundCar ? driverDetailLines(aux) : paxLines
  // Base block holds name/route/date/cabin; detail lines extend height.
  const baseH = 30
  const cardH = Math.max(34, baseH + detailLines.length * 5 + 4)

  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

  const iconX = P.margin + padH
  sans(doc, 'normal', 13)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('\u2708', iconX, y + padV + 5)

  const typeLabel = (aux.booking_type ?? 'Flight').toUpperCase()
  sans(doc, 'bold', 6)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text(typeLabel, iconX, y + padV + 11, { charSpace: 0.3 })

  const centreX = P.margin + CW * 0.28

  if (aux.name) {
    serif(doc, 'normal', 10.5)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(aux.name, centreX, y + padV + 5)
  }
  if (aux.origin || aux.destination || aux.depart_airport || aux.arrive_airport) {
    const route = [aux.depart_airport ?? aux.origin, aux.arrive_airport ?? aux.destination].filter(Boolean).join('  \u2192  ')
    sans(doc, 'normal', 9)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(route, centreX, y + padV + 11)
  }
  const metaLine = [aux.start_date ? fmtDate(aux.start_date) : null, aux.cabin_class, aux.aircraft_type].filter(Boolean).join('  \u00b7  ')
  if (metaLine) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(metaLine, centreX, y + padV + 17)
  }

  // Passenger or driver lines depending on booking type
  let py = y + padV + 23
  for (const line of detailLines) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(line, centreX, py)
    py += 5
  }

  const rightX = P.margin + CW - padH
  const dep = fmtTime(aux.start_time); const arr = fmtTime(aux.end_time)
  if (dep || arr) {
    const timeStr = dep && arr ? `${dep}  \u2013  ${arr}` : dep || arr
    sans(doc, 'bold', 9)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(timeStr, rightX, y + padV + 5, { align: 'right' })
  }

  if (isOwnArrangements(aux.booked_by)) {
    drawOwnArrangementsChip(doc, P.margin + padH, y + cardH - 7.6)
  }
  if (!isOwnArrangements(aux.booked_by)) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(bookedByText, P.margin + padH, y + cardH - 4)
  }

  return cardH
}

// ── Contact card ──────────────────────────────────────────────────────────────

const CONTACT_CARD_H = 30
const CONTACT_GAP    = 4
const CONTACT_COL_W  = (CW - CONTACT_GAP) / 2

function drawContactCard(doc: any, c: ConfirmationContact, roleLabel: string, x: number, y: number) {
  const padH = 8; const padV = 7
  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, CONTACT_COL_W, CONTACT_CARD_H, 2, 2, 'FD')

  let ty = y + padV
  sans(doc, 'bold', 6)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text(roleLabel.toUpperCase(), x + padH, ty, { charSpace: 0.4 })
  ty += 6

  serif(doc, 'normal', 12)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text(c.name, x + padH, ty)
  ty += 6

  if (c.phone) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(c.phone, x + padH, ty)
    ty += 4.5
  }
  if (c.email) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(c.email, x + padH, ty)
  }
}

function drawContactBlock(
  doc: any,
  label: string,
  people: { c: ConfirmationContact; roleLabel: string }[],
  y: number,
  footerMargin: number,
): number {
  if (people.length === 0) return y
  if (y + 8 + CONTACT_CARD_H > P.h - footerMargin) {
    y = addCreamPage(doc)
  }
  drawRule(doc, P.margin, y, CW); y += 8
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(label.toUpperCase(), P.margin, y, { charSpace: 0.5 }); y += 7

  for (let i = 0; i < people.length; i += 2) {
    if (y + CONTACT_CARD_H > P.h - footerMargin) {
      y = addCreamPage(doc)
    }
    drawContactCard(doc, people[i].c, people[i].roleLabel, P.margin, y)
    if (people[i + 1]) {
      drawContactCard(doc, people[i + 1].c, people[i + 1].roleLabel, P.margin + CONTACT_COL_W + CONTACT_GAP, y)
    }
    y += CONTACT_CARD_H + CONTACT_GAP
  }
  return y
}

// ── Main render ───────────────────────────────────────────────────────────────

async function renderAll(doc: any, d: ConfirmationBriefData, emblem: Img | null, logo: Img | null) {
  const { trip, brief, house } = d

  const title       = brief?.brief_title ?? d.destinationName ?? trip.destinations[0]?.name ?? ''
  const preparedFor = brief?.prepared_for ?? null
  const dateRange   = brief?.snapshot_dates ?? buildDateRange(trip.start_date, trip.end_date)

  let y = await drawPdfHero(doc, {
    title,
    docType:       'Trip Confirmation',
    subtitle:      brief?.brief_subtitle ?? null,
    preparedFor,
    dateRange,
    heroImageData: d.heroImageData,
    emblem,
    logo,
    logoVariant:   brief?.logo_variant ?? null,
  })

  const FOOTER_MARGIN = 18

  // ── Hotel cards ───────────────────────────────────────────────────────────

  const accomBookings = trip.bookings
    .filter(bk => bk.brief_show !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  if (accomBookings.length > 0) {
    drawRule(doc, P.margin, y, CW); y += 8
    sans(doc, 'bold', 7)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('ACCOMMODATION', P.margin, y, { charSpace: 0.5 }); y += 7

    for (const booking of accomBookings) {
      // Estimate full card height (header + room rows) for pagination.
      const padV = 7; const contentW = CW - Math.round(CW * 0.44); const padH = 8
      serif(doc, 'normal', 11)
      const nl = doc.splitTextToSize(booking._hotel_name ?? booking.name ?? 'Hotel', contentW - padH * 2)
      const rooms = booking._rooms ?? []
      const headerConf = rooms.length === 0 && booking.confirmation_number
      const headerH = Math.max(36,
        padV + nl.length * 5.5
        + (buildDateRange(booking.start_date, booking.end_date) ? 5 : 0)
        + (booking.party_composition ? 5 : 0)
        + (headerConf ? 4 + 6 + 7 + 4.5 : 4 + 4.5)
        + padV)
      const roomsH = rooms.reduce((sum, r) => {
        const d = roomDisplay(r)
        return sum + padV + (d.roomName ? 5 : 0) + (d.guestLine ? 4.5 : 0) + (d.board ? 4.5 : 0) + padV
      }, 0)
      const cardH = headerH + (rooms.length > 0 ? roomsH : 0)

      if (y + cardH > P.h - FOOTER_MARGIN) y = addCreamPage(doc)
      const drawn = await drawHotelCard(doc, booking, y)
      y += drawn + 4
    }
  }

  // ── Flight cards ──────────────────────────────────────────────────────────

  const visibleFlights = d.auxBookings
    .filter(a => a.brief_show !== false)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (visibleFlights.length > 0) {
    y += 6
    if (y + 20 > P.h - FOOTER_MARGIN) y = addCreamPage(doc)
    drawRule(doc, P.margin, y, CW); y += 8
    sans(doc, 'bold', 7)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('FLIGHTS', P.margin, y, { charSpace: 0.5 }); y += 7

    for (const aux of visibleFlights) {
      const estPax = (aux.passengers ?? []).length || 1
      if (y + (30 + estPax * 5 + 8) > P.h - FOOTER_MARGIN) y = addCreamPage(doc)
      y += drawFlightCard(doc, aux, y) + 4
    }
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  const allContacts = d.contacts ?? []
  const guests = allContacts.filter(c => c.role !== 'staff')
  const staff  = allContacts.filter(c => c.role === 'staff')

  if (brief?.advisor_name) {
    const advisor: ConfirmationContact = {
      id:    'advisor',
      name:  brief.advisor_name,
      role:  'advisor',
      email: (brief as any).show_advisor_email ? (brief.advisor_email ?? null) : null,
      phone: (brief as any).show_advisor_phone ? ((brief as any).advisor_phone ?? null) : null,
    }
    y += 6
    y = drawContactBlock(doc, 'Travel Advisor', [{ c: advisor, roleLabel: 'Travel Advisor' }], y, FOOTER_MARGIN)
  }
  if (guests.length > 0) {
    y += 6
    y = drawContactBlock(doc, guests.length === 1 ? 'Guest' : 'Guests', guests.map(c => ({ c, roleLabel: 'Guest' })), y, FOOTER_MARGIN)
  }
  if (staff.length > 0) {
    y += 6
    y = drawContactBlock(doc, 'Staff', staff.map(c => ({ c, roleLabel: 'Staff' })), y, FOOTER_MARGIN)
  }
}

// ── Filename ──────────────────────────────────────────────────────────────────

function buildFilename(d: ConfirmationBriefData): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim()
  const clientName = d.brief?.prepared_for ?? d.house?.display_name ?? d.trip.destinations[0]?.name ?? ''
  const destination = d.destinationName
  const dateRange = (() => {
    const s = d.trip.start_date; const e = d.trip.end_date
    if (!s) return ''
    const sd = new Date(s.slice(0, 10) + 'T00:00:00')
    const ed = e ? new Date(e.slice(0, 10) + 'T00:00:00') : null
    const month = sd.toLocaleDateString('en-US', { month: 'long' })
    const year  = sd.getFullYear()
    if (ed && ed.getMonth() === sd.getMonth() && ed.getFullYear() === sd.getFullYear())
      return `${sd.getDate()}-${ed.getDate()} ${month} ${year}`
    return `${sd.getDate()} ${month} ${year}`
  })()
  return ['Trip Confirmation', safe(clientName), safe(destination), dateRange].filter(Boolean).join(' - ') + '.pdf'
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportConfirmationBriefPdf(data: ConfirmationBriefData): Promise<void> {
  const jsPDF = assertJsPdf()
  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  await renderAll(doc, data, emblem, logo)
  stampPageChrome(doc, data.brief)
  doc.save(buildFilename(data))
}