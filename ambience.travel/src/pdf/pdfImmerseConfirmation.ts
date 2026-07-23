// pdfImmerseConfirmation.ts - Engagement Confirmation PDF export
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Hotel cards - image-left header (hotel name, dates, party, booking-level
//     conf when roomless, booked_by), nested room rows beneath (room name,
//     guests, per-room conf pill). Section: "ACCOMMODATION".
//   - Flight cards - icon, route, times, conf# pill. Section: "FLIGHTS".
//   - Contact cards - advisor + selected house guests/staff. S54.
//
// What it does not own:
//   - Hero, footer, theme, date helpers, page helpers → pdfShared.ts
//   - Image loading, SVG rasterisation, cover crop, font helpers → pdfUtils.ts
//   - Font loading / registration → pdfFonts.ts
//
// Last updated: S43 Add 2C - hero, footer, theme, helpers extracted to
//   pdfShared.ts. drawPdfHero() is now canonical across all three PDFs.
// Prior: S54 - Contacts section.
// Prior: S50 - bookedByLabel() canonical.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, makeCoverCropAsync, serif, sans, drawRule } from './pdfUtils'
import type { Img } from './pdfUtils'
import {
  T, P, CW, ASSETS,
  fmtDate, fmtTime, buildDateRange, passengerLines, driverDetailLines, roomDisplay,
  drawOwnArrangementsChip, drawConfPill, drawAlertPill, drawStrikeText, guestLine, greeterLines, diningPdfStatus, isDiningCancelled,
  drawPdfHero, stampPageChrome, addCreamPage,
  type ExportBranding,
} from './pdfShared'
import { scheduleAlert } from '../utils/utilsScheduleAlert'
import { moneyDec } from '../utils/utilsCurrency'
import type {
  ImmerseEngagementBrief as EngagementBrief,
  ImmerseEngagementBooking as EngagementBooking,
  ImmerseDossierJourney as DossierJourney,
  ImmerseEngagementHouse as HouseProfile,
  ImmerseBookingRoom as BookingRoom,
  EngagementElement as AdminEngagementElement,
} from '../types/typesImmerse'
import { bookedByLabel, buildRoute, isOwnArrangements } from '../utils/utilsBooking'
import { isGroundTransportElement, groupElementsBySection, isMeetGreetElement, isDiningElement } from '../types/typesElements'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConfirmationContact {
  id:    string
  name:  string
  role:  string | null
  email: string | null
  phone: string | null
}

export interface ConfirmationBriefData {
  trip:             DossierJourney
  brief:            EngagementBrief | null
  house:            HouseProfile | null
  destinationName:  string
  heroImageData:    string | null
  elements:      AdminEngagementElement[]
  guestDisplayName: string | null
  contacts?:        ConfirmationContact[]
  experiences?:     { entry_date: string | null; title: string; notes: string | null }[]
}

// ── Hotel card - measure / draw split for row-level pagination ─────────────────
// Single measurement source (measureHotel) feeds both pagination and drawing, so
// estimates can never drift. Tall cards (many rooms) split across pages: header +
// rooms that fit, then remaining rooms continue under a slim continuation header.

const HOTEL_IMG_W = Math.round(CW * 0.40)
const HOTEL_IMG_H = Math.round(HOTEL_IMG_W * 9 / 16)   // fixed 16:9 landscape
const HOTEL_IMG_RADIUS = 1.5                            // subtle rounded corners
const HOTEL_PADV  = 7
const HOTEL_PADH  = 8

type RoomMeasure = { room: BookingRoom; h: number }
type HotelMeasure = { headerH: number; rooms: RoomMeasure[]; nameLines: string[] }

function measureHotel(doc: any, booking: EngagementBooking): HotelMeasure {
  const contentW = CW - HOTEL_IMG_W
  const rooms    = booking._rooms ?? []
  const headerConf = rooms.length === 0 && booking.confirmationNumber
  const hasException = booking.paymentException === true

  serif(doc, 'normal', 11)
  const nameLines = doc.splitTextToSize(booking._hotel_name ?? booking.name ?? 'Hotel', contentW - HOTEL_PADH * 2)
  const headerContentH = HOTEL_PADV
    + nameLines.length * 5.5
    + (buildDateRange(booking.checkInDate ?? booking.startDate, booking.endDate) ? 5 : 0)
    + (booking.checkInNote ? 4.5 : 0)
    + (booking.checkOutNote ? 4.5 : 0)
    + (booking.expectedArrivalTime ? 5 : 0)
    + (booking.lateCheckoutApprovedTime ? 5 : 0)
    + (booking.requestedCheckoutTime && !booking.lateCheckoutApprovedTime ? 4.5 : 0)
    + (booking.startTime ? 5 : 0)
    + (booking.partyComposition ? 5 : 0)
    + (hasException ? 6 : 0)
    + (booking.cancellationPolicy ? (doc.splitTextToSize(booking.cancellationPolicy, contentW - HOTEL_PADH * 2).length * 4 + 10) : 0)
    + ((booking._invoices ?? []).length > 0 ? (booking._invoices as {id:string;invoiceNumber:string;invoiceDate:string|null;amount:number|null;currency:string;description:string|null}[]).length * 12 + 8 : 0)
    + (booking.inclusionsOverride ? (booking.inclusionsOverride as {heading:string;bullets:string[]}[]).reduce((acc, g) => acc + 6 + g.bullets.length * 4.5, 0) : 0)
    + (headerConf ? 4 + 6 + 7 + 4.5 : 4 + 4.5)+ (hasException ? 6 : 0)
    + (() => { const a = scheduleAlert(booking); return a.pillLabel ? (2.6 * 2 + doc.splitTextToSize(a.pillLabel, contentW - HOTEL_PADH * 2 - 10).length * 4 + 3) : 0 })()
    + (booking.cancellationPolicy ? (doc.splitTextToSize(booking.cancellationPolicy, contentW - HOTEL_PADH * 2).length * 4 + 10) : 0)
    + HOTEL_PADV
  const headerH = Math.max(36, headerContentH, HOTEL_IMG_H + HOTEL_PADV * 2)

  const roomMeasures: RoomMeasure[] = rooms.map(room => {
    const d = roomDisplay(room)
    const h = HOTEL_PADV
      + (d.roomName ? 5 : 0)
      + (d.guestLine ? 4.5 : 0)
      + (d.board ? 4.5 : 0)
      + (d.bedding ? 4.5 : 0)
      + HOTEL_PADV
    return { room, h }
  })

  return { headerH, rooms: roomMeasures, nameLines }
}

async function drawHotelHeader(doc: any, booking: EngagementBooking, y: number, m: HotelMeasure, continuation: boolean): Promise<void> {
  const imgW = HOTEL_IMG_W
  const contentX = P.margin + HOTEL_PADH + imgW; const contentW = CW - HOTEL_PADH - imgW
  const ownArr = isOwnArrangements(booking.bookedBy)
  const bookedByText = bookedByLabel(booking.bookedBy)
  const dateRange = buildDateRange(booking.checkInDate ?? booking.startDate, booking.endDate)
  const rooms = booking._rooms ?? []
  const headerConf = rooms.length === 0 && booking.confirmationNumber
    ? `Conf #:  ${booking.confirmationNumber}` : null
  const headerH = m.headerH

  // Image - fixed 16:9 landscape, rounded, high-res (matches programme image standard).
  const imgX = P.margin + HOTEL_PADH
  const imgY = y + (headerH - HOTEL_IMG_H) / 2   // vertically centre in the header
  let croppedImg: { data: string; format: 'PNG' | 'JPEG' } | null = null
  const imgSrc = booking.briefImageSrc ?? booking._hotel_image_src
  if (imgSrc) {
    try {
      const raw = await loadImg(imgSrc)
      if (raw) croppedImg = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, imgW, HOTEL_IMG_H, 12, HOTEL_IMG_RADIUS)
    } catch { /* silent */ }
  }

  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, headerH, 2, 2, 'FD')
  if (croppedImg) doc.addImage(croppedImg.data, croppedImg.format, imgX, imgY, imgW, HOTEL_IMG_H, undefined, 'SLOW')
  if (!croppedImg) { doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2]); doc.roundedRect(imgX, imgY, imgW, HOTEL_IMG_H, HOTEL_IMG_RADIUS, HOTEL_IMG_RADIUS, 'F') }
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2]); doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, headerH, 2, 2, 'D')

  const tx = contentX + HOTEL_PADH; let ty = y + HOTEL_PADV
  const stayAlert = scheduleAlert(booking)
  serif(doc, 'normal', 11)
  doc.setTextColor(stayAlert.struck ? T.faint[0] : T.ink[0], stayAlert.struck ? T.faint[1] : T.ink[1], stayAlert.struck ? T.faint[2] : T.ink[2])
  for (const line of m.nameLines) {
    const txt = continuation ? `${line} (continued)` : line
    if (stayAlert.struck) drawStrikeText(doc, txt, tx, ty, 'left')
    else doc.text(txt, tx, ty)
    ty += 5.5
  }
  if (dateRange) {
    sans(doc, 'normal', 8); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    if (stayAlert.struck) drawStrikeText(doc, dateRange, tx, ty, 'left')
    else doc.text(dateRange, tx, ty)
    ty += 5
  }
  if (stayAlert.pillLabel) {
    ty += drawAlertPill(doc, tx, ty, stayAlert.pillLabel, stayAlert.tone ?? 'danger', contentW - HOTEL_PADH * 2) + 2.5
  }

  if (dateRange) { sans(doc, 'normal', 8); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text(dateRange, tx, ty); ty += 5 }
  if (booking.checkInNote) { sans(doc, 'italic', 7); doc.setTextColor(T.gold[0], T.gold[1], T.gold[2]); doc.text((doc.splitTextToSize(booking.checkInNote, contentW - HOTEL_PADH * 2))[0] ?? '', tx, ty); ty += 4.5 }
  if (booking.checkOutNote) { sans(doc, 'italic', 7); doc.setTextColor(T.gold[0], T.gold[1], T.gold[2]); doc.text((doc.splitTextToSize(booking.checkOutNote, contentW - HOTEL_PADH * 2))[0] ?? '', tx, ty); ty += 4.5 }
  if (booking.expectedArrivalTime) { sans(doc, 'normal', 8); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text(`Expected arrival ${fmtTime(booking.expectedArrivalTime)}`, tx, ty); ty += 5 }
  if (booking.lateCheckoutApprovedTime) { sans(doc, 'normal', 8); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text(`Late checkout approved ${fmtTime(booking.lateCheckoutApprovedTime)}`, tx, ty); ty += 5 }
  if (booking.requestedCheckoutTime && !booking.lateCheckoutApprovedTime) { sans(doc, 'italic', 7); doc.setTextColor(T.gold[0], T.gold[1], T.gold[2]); doc.text(`Check-Out Time Requested · ${fmtTime(booking.requestedCheckoutTime)}`, tx, ty); ty += 4.5 }
  if (booking.startTime) { sans(doc, 'normal', 8); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text(`Check-in ${fmtTime(booking.startTime)}`, tx, ty); ty += 5 }
  if (booking.partyComposition) { sans(doc, 'normal', 8); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text((doc.splitTextToSize(booking.partyComposition, contentW - HOTEL_PADH * 2))[0] ?? '', tx, ty); ty += 5 }

  if (booking.inclusionsOverride && (booking.inclusionsOverride as {heading:string;bullets:string[]}[]).length > 0) {
    ty += 2
    for (const group of booking.inclusionsOverride as {heading:string;bullets:string[]}[]) {
      sans(doc, 'bold', 7); doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
      doc.text(group.heading.toUpperCase(), tx, ty, { charSpace: 0.3 }); ty += 4.5
      for (const bullet of group.bullets) {
        sans(doc, 'normal', 7.5); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
        doc.text('\u00b7', tx, ty)
        const bLines = doc.splitTextToSize(bullet, contentW - HOTEL_PADH * 2 - 5)
        for (const bl of bLines) { doc.text(bl, tx + 4, ty); ty += 4 }
      }
      ty += 2
    }
  }

  if (booking.cancellationPolicy) {
    ty += 2
    sans(doc, 'bold', 7); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text('CANCELLATION POLICY', tx, ty, { charSpace: 0.3 }); ty += 4
    sans(doc, 'normal', 7.5); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    const cpLines = doc.splitTextToSize(booking.cancellationPolicy, contentW - HOTEL_PADH * 2)
    for (const line of cpLines) { doc.text(line, tx, ty); ty += 4 }
    ty += 2
  }
  if ((booking._invoices ?? []).length > 0) {
    ty += 2
    sans(doc, 'bold', 7); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text('INVOICES', tx, ty, { charSpace: 0.3 }); ty += 5
    for (const inv of booking._invoices as {id:string;invoiceNumber:string;invoiceDate:string|null;amount:number|null;currency:string;description:string|null}[]) {
      sans(doc, 'normal', 7.5); doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
      const label = inv.description ?? `Invoice ${inv.invoiceNumber}`
      doc.text(label, tx, ty)
      const amtStr = inv.amount != null ? `${inv.currency} ${Math.abs(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
      if (amtStr) { sans(doc, 'normal', 7.5); doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]); doc.text(amtStr, tx + contentW - HOTEL_PADH * 2, ty, { align: 'right' }) }
      if (inv.invoiceDate) { sans(doc, 'normal', 7); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2]); doc.text(inv.invoiceDate, tx, ty + 4) }
      ty += 10
    }
  }

  ty += 4
  if (booking.paymentException === true) {
    sans(doc, 'bold', 7)
    doc.setTextColor(180, 50, 31)
    doc.text('PAYMENT OUTSTANDING', tx, ty, { charSpace: 0.4 })
    ty += 6
  }
  if (headerConf) { drawConfPill(doc, tx, ty - 4, headerConf, ownArr ? 'faint' : 'gold'); ty += 7 }
  if (isOwnArrangements(booking.bookedBy)) { drawOwnArrangementsChip(doc, tx, ty - 3.6) }
  if (!isOwnArrangements(booking.bookedBy)) { sans(doc, 'italic', 7.5); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2]); doc.text(bookedByText, tx, ty) }
}

function drawRoomRow(doc: any, rm: RoomMeasure, booking: EngagementBooking, y: number): void {
  const ownArr = isOwnArrangements(booking.bookedBy)
  const rtx = P.margin + HOTEL_PADH
  const d = roomDisplay(rm.room)
  const roomConf = d.conf ? `Conf #:  ${d.conf}` : null

  // Full-width room band (white, with side+bottom borders) + top divider
  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.rect(P.margin, y, CW, rm.h, 'F')
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2]); doc.setLineWidth(0.3)
  doc.line(P.margin, y, P.margin + CW, y)                 // top divider
  doc.line(P.margin, y, P.margin, y + rm.h)               // left edge
  doc.line(P.margin + CW, y, P.margin + CW, y + rm.h)     // right edge

  let rty = y + HOTEL_PADV
  if (d.roomName) { sans(doc, 'bold', 8.5); doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]); doc.text((doc.splitTextToSize(d.roomName, CW - HOTEL_PADH * 2 - 40))[0] ?? d.roomName, rtx, rty); rty += 5 }
  if (d.guestLine) { sans(doc, 'normal', 7.5); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text((doc.splitTextToSize(d.guestLine, CW - HOTEL_PADH * 2 - 40))[0] ?? d.guestLine, rtx, rty); rty += 4.5 }
  if (d.bedding) { sans(doc, 'normal', 7.5); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text(d.bedding, rtx, rty); rty += 4.5 }
  if (d.board) { sans(doc, 'italic', 7); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2]); doc.text((doc.splitTextToSize(d.board, CW - HOTEL_PADH * 2 - 40))[0] ?? d.board, rtx, rty); rty += 4.5 }

  if (roomConf) {
    sans(doc, 'normal', 7.5)
    const pillW = doc.getTextWidth(roomConf) + 10
    drawConfPill(doc, P.margin + CW - HOTEL_PADH - pillW, y + HOTEL_PADV - 2, roomConf, ownArr ? 'faint' : 'gold')
  }
}

// Orchestrator: draws header + rooms with row-level pagination. Returns final y.
async function drawHotelSplit(doc: any, booking: EngagementBooking, y: number, footerMargin: number): Promise<number> {
  const m = measureHotel(doc, booking)
  const pageBottom = P.h - footerMargin

  // Header must fit with at least one room (or alone if roomless). If it doesn't
  // fit in remaining space, start fresh - but only if we're not already at top.
  const firstRoomH = m.rooms[0]?.h ?? 0
  const headerNeed = m.headerH + firstRoomH
  const atTop = y <= (P.margin + 12)
  if (!atTop && y + headerNeed > pageBottom) y = addCreamPage(doc)

  await drawHotelHeader(doc, booking, y, m, false)
  y += m.headerH

  for (let i = 0; i < m.rooms.length; i++) {
    const rm = m.rooms[i]
    if (y + rm.h > pageBottom) {
      // Continue remaining rooms on a fresh page under a slim continuation header.
      y = addCreamPage(doc)
      await drawHotelHeader(doc, booking, y, m, true)
      y += m.headerH
    }
    drawRoomRow(doc, rm, booking, y)
    y += rm.h
  }
  return y
}
// ── Greeter card ──────────────────────────────────────────────────────────────
function drawGreeterCard(doc: any, aux: AdminEngagementElement, y: number): number {
  const padV = 6; const padH = 10
  const lines = greeterLines(aux)
  const cardH = Math.max(24, padV + 6 + 5 + lines.length * 4.8 + padV)

  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

  const tx = P.margin + padH; let ty = y + padV
  sans(doc, 'bold', 6)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text((aux.elementTypeLabel ?? 'Airport Meet & Greet').toUpperCase(), tx, ty + 3, { charSpace: 0.3 }); ty += 7

  serif(doc, 'normal', 10.5)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text(aux.name ?? 'Airport Meet & Greet', tx, ty + 3); ty += 6

  const dep = fmtTime(aux.startTime)
  if (dep) {
    sans(doc, 'bold', 9)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(dep, P.margin + CW - padH, y + padV + 3, { align: 'right' })
  }
  for (const line of lines) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(line, tx, ty); ty += 4.8
  }
  return cardH
}

// ── Dining card ───────────────────────────────────────────────────────────────
function drawDiningCard(doc: any, aux: AdminEngagementElement, y: number): number {
  const padV = 6; const padH = 10
  const cancelled = isDiningCancelled(aux)
  const v = aux.venue
  const rows: { label: string; value: string }[] = []
  if (v?.address)         rows.push({ label: 'Address',  value: v.address })
  if (v?.phone)           rows.push({ label: 'Phone',    value: v.phone })
  if (v?.dressCode)      rows.push({ label: 'Dress',    value: v.dressCode })
  if (v?.childrenPolicy) rows.push({ label: 'Children', value: v.childrenPolicy })
  if (v?.tableHoldNote) rows.push({ label: 'Table',    value: v.tableHoldNote })
  const gLine = guestLine({ guestName: (aux as any).resolvedGuestName ?? aux.guestName, guestCount: aux.guestCount })
  const pill = diningPdfStatus(aux)

  const pkgN = (aux.packageName || aux.pricePerPerson ? 1 : 0)
    + ((aux.packageInclusions?.length ?? 0) > 0 ? 1 + aux.packageInclusions!.length : 0)
    + ((aux.schedule?.length ?? 0) > 0 ? aux.schedule!.reduce((n, ev) => n + 1 + (ev.detail?.length ?? 0), 0) : 0)
    + (aux.notes ? 1 : 0)
  const cardH = Math.max(28,
    padV + 6 + 5 + (gLine ? 5 : 0) + rows.length * 5 + pkgN * 4.5 + (pill ? 7 : 0) + padV)

  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

  const tx = P.margin + padH; let ty = y + padV
  sans(doc, 'bold', 6)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text((aux.elementTypeLabel ?? 'Dining').toUpperCase(), tx, ty + 3, { charSpace: 0.3 }); ty += 7

  serif(doc, 'normal', 10.5)
  doc.setTextColor(cancelled ? T.faint[0] : T.ink[0], cancelled ? T.faint[1] : T.ink[1], cancelled ? T.faint[2] : T.ink[2])
  const nameStr = aux.name ?? 'Dining'
  doc.text(nameStr, tx, ty + 3)
  if (cancelled) {
    const nw = doc.getTextWidth(nameStr)
    doc.setDrawColor(T.faint[0], T.faint[1], T.faint[2]); doc.setLineWidth(0.4)
    doc.line(tx, ty + 1.5, tx + nw, ty + 1.5)
  }
  const dep = fmtTime(aux.startTime)
  if (dep) {
    sans(doc, 'bold', 9)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(dep, P.margin + CW - padH, y + padV + 3, { align: 'right' })
  }
  ty += 6

  if (gLine) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(gLine, tx, ty); ty += 5
  }
  for (const r of rows) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(r.label, tx, ty)
    const valStr = (doc.splitTextToSize(r.value, CW - padH * 2 - 22))[0] ?? r.value
    if (r.label === 'Address' && v?.mapsUrl) {
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
      doc.text(valStr, tx + 20, ty)
      const vw = doc.getTextWidth(valStr)
      try { doc.link(tx + 20, ty - 3, vw, 5, { url: v.mapsUrl }) } catch {}
      ty += 5
      continue
    }
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(valStr, tx + 20, ty)
    ty += 5
  }
  const pkgLines: string[] = []
  if (aux.packageName || aux.pricePerPerson) {
    pkgLines.push([aux.packageName, aux.pricePerPerson != null ? `${moneyDec(aux.pricePerPerson, aux.currency ?? 'EUR')} per person` : null].filter(Boolean).join('  \u00b7  '))
  }
  if ((aux.packageInclusions?.length ?? 0) > 0) {
    pkgLines.push('Includes:')
    for (const line of aux.packageInclusions!) pkgLines.push(`  ${line}`)
  }
  if ((aux.schedule?.length ?? 0) > 0) {
    for (const ev of aux.schedule!) {
      pkgLines.push([ev.time ? fmtTime(ev.time) : null, ev.title].filter(Boolean).join('  '))
      if ((ev.detail?.length ?? 0) > 0) for (const line of ev.detail!) pkgLines.push(`  ${line}`)
    }
  }
  for (const pl of pkgLines) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    for (const wl of doc.splitTextToSize(pl, CW - padH * 2)) { doc.text(wl, tx, ty); ty += 4.5 }
  }
  if (aux.notes) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    for (const wl of doc.splitTextToSize(aux.notes, CW - padH * 2)) { doc.text(wl, tx, ty); ty += 4.5 }
  }
  if (pill) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(pill.tone[0], pill.tone[1], pill.tone[2])
    const pillLines = doc.splitTextToSize(pill.label, CW - padH * 2)
    doc.text(pillLines[0] ?? pill.label, tx, ty + 1)
  }
  return cardH
}

// ── Flight card ───────────────────────────────────────────────────────────────

function drawFlightCard(doc: any, aux: AdminEngagementElement, y: number): number {
  const alert = scheduleAlert(aux)
  const padV = 7; const padH = 10
  const bookedByText = bookedByLabel(aux.bookedBy)
  const ownArr       = isOwnArrangements(aux.bookedBy)
  const paxLines     = passengerLines({ passengers: (aux.passengers ?? []).map(p => ({ id: p.id, passengerLabel: p.passengerLabel, resolvedPassengerLabel: p.resolvedPassengerLabel, confirmationNumber: p.confirmationNumber, seatNumbers: p.seatNumbers, sortOrder: p.sortOrder })) })
  const isGroundCar  = isGroundTransportElement(aux.elementType)
  const detailLines  = isGroundCar ? driverDetailLines({ driverDetails: (aux.driverDetails ?? []).map(d => ({ id: d.id, driverName: d.driverName, driverPhone: d.driverPhone, carModel: d.carModel, plate: d.plate, vehicleRole: d.vehicleRole, sortOrder: d.sortOrder })) }) : paxLines

  // Vertical rhythm: header block (icon row · name/route/meta) is a fixed 23mm,
  // then detail lines at 5mm each, then a 5mm gap, then the booked-by line.
  const headerBlockH = 23
  const detailH      = detailLines.length * 5
  const footerH      = 5 + (ownArr ? 5.4 : 4.5)
  const alertPre     = scheduleAlert(aux)
  const alertH       = alertPre.pillLabel ? (2.6 * 2 + (doc.splitTextToSize(alertPre.pillLabel, CW * 0.62 - 10).length * 4)) + 3 : 0
  const cardH        = Math.max(34, padV + headerBlockH + detailH + alertH + footerH + padV - 4)

  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

  const iconX = P.margin + padH
  sans(doc, 'normal', 13)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('\u2708', iconX, y + padV + 5)

  const typeLabel = (aux.elementType ?? 'Flight').toUpperCase()
  sans(doc, 'bold', 6)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text(typeLabel, iconX, y + padV + 11, { charSpace: 0.3 })

  const centreX = P.margin + CW * 0.28

  if (aux.name) {
    serif(doc, 'normal', 10.5)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(aux.name, centreX, y + padV + 5)
  }
  const { route: auxRoute, terminals: auxTerminals } = buildRoute(aux)
  if (auxRoute) {
    sans(doc, 'normal', 9)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(auxRoute, centreX, y + padV + 11)
  }
  const metaLine = [aux.startDate ? fmtDate(aux.startDate) : null, aux.cabinClass, aux.aircraftType, auxTerminals].filter(Boolean).join('  \u00b7  ')
  if (metaLine) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(metaLine, centreX, y + padV + 17)
  }

  // Detail lines flow directly under the header block.
  let py = y + padV + headerBlockH
  for (const line of detailLines) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(line, centreX, py)
    py += 5
  }

  // Times, top-right
  const rightX = P.margin + CW - padH
  const dep = fmtTime(aux.startTime); const arr = fmtTime(aux.endTime)
  if (dep || arr) {
    const timeStr = dep && arr ? `${dep}  -  ${arr}` : dep || arr
    sans(doc, 'bold', 9)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(timeStr, rightX, y + padV + 5, { align: 'right' })
  }

  // Schedule alert pill (delayed / tentative / cancelled) - one source via scheduleAlert.
  if (alert.pillLabel) {
    py += drawAlertPill(doc, centreX, py, alert.pillLabel, alert.tone ?? 'danger', CW * 0.62) + 2.5
  }
  // Booked-by / own-arrangements - flows after detail lines with a clean gap,
  // not pinned to the card bottom (consistent spacing regardless of line count).
  const footerY = py + 1
  if (ownArr) {
    drawOwnArrangementsChip(doc, centreX, footerY - 3.6)
    return cardH
  }
  sans(doc, 'italic', 7.5)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text(bookedByText, centreX, footerY)

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

async function renderAll(doc: any, d: ConfirmationBriefData, emblem: Img | null, logo: Img | null, branding: ExportBranding = 'ambience') {
  const { trip, brief, house } = d

  const title       = brief?.briefTitle ?? d.destinationName ?? trip.destinations[0]?.name ?? ''
  const preparedFor = d.guestDisplayName ?? brief?.preparedFor ?? null
  const dateRange   = brief?.snapshotDates ?? buildDateRange(trip.startDate, trip.endDate)

  let y = await drawPdfHero(doc, {
    title,
    docType:       'Engagement Confirmation',
    subtitle:      brief?.briefSubtitle ?? null,
    preparedFor,
    dateRange,
    heroImageData: d.heroImageData,
    emblem,
    logo,
    logoVariant:   branding,
  })
  const FOOTER_MARGIN = 18

  // ── Hotel cards ───────────────────────────────────────────────────────────

  const accomBookings = trip.bookings
    .filter(bk => bk.briefShow !== false)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  if (accomBookings.length > 0) {
    drawRule(doc, P.margin, y, CW); y += 8
    sans(doc, 'bold', 7)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('ACCOMMODATION', P.margin, y, { charSpace: 0.5 }); y += 7

    for (const booking of accomBookings) {
      y = await drawHotelSplit(doc, booking, y, FOOTER_MARGIN)
      y += 6
    }
  }

  // ── Aux sections - grouped by registry section (flights, transfers, greeters,
  //    dining, etc), mirroring the web confirmation. ────────────────────────────

  const visibleAux = d.elements.filter(a => a.briefShow !== false)
  const auxSections = groupElementsBySection(visibleAux)

  for (const section of auxSections) {
    y = addCreamPage(doc)
    drawRule(doc, P.margin, y, CW); y += 8
    sans(doc, 'bold', 7)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(section.label.toUpperCase(), P.margin, y, { charSpace: 0.5 }); y += 7

    for (const aux of section.items) {
      if (isMeetGreetElement(aux.elementType)) {
        const h = Math.max(24, HOTEL_PADV - 1 + 6 + 5 + greeterLines(aux).length * 4.8 + HOTEL_PADV - 1)
        if (y + h > P.h - FOOTER_MARGIN) y = addCreamPage(doc)
        y += drawGreeterCard(doc, aux, y) + 4
        continue
      }
      if (aux.venue || aux.guestName || aux.guestCount) {
        const v = aux.venue
        const rowN = [v?.address, v?.phone, v?.dressCode, v?.childrenPolicy, v?.tableHoldNote].filter(Boolean).length
        const gl = (aux.guestName || aux.guestCount) ? 1 : 0
        const pillN = diningPdfStatus(aux) ? 1 : 0
        const pkgN2 = (aux.packageName || aux.pricePerPerson ? 1 : 0)
          + ((aux.packageInclusions?.length ?? 0) > 0 ? 1 + aux.packageInclusions!.length : 0)
          + ((aux.schedule?.length ?? 0) > 0 ? aux.schedule!.reduce((n, ev) => n + 1 + (ev.detail?.length ?? 0), 0) : 0)
          + (aux.notes ? 1 : 0)
        const h = Math.max(28, 6 + 6 + 5 + gl * 5 + rowN * 5 + pkgN2 * 4.5 + pillN * 7 + 6)
        if (y + h > P.h - FOOTER_MARGIN) y = addCreamPage(doc)
        y += drawDiningCard(doc, aux, y) + 4
        continue
      }
      const detailN = isGroundTransportElement(aux.elementType) ? driverDetailLines({ driverDetails: (aux.driverDetails ?? []).map(d => ({ id: d.id, driverName: d.driverName, driverPhone: d.driverPhone, carModel: d.carModel, plate: d.plate, vehicleRole: d.vehicleRole, sortOrder: d.sortOrder })) }).length : (aux.passengers ?? []).length
      const h = Math.max(34, 30 + Math.max(detailN, 1) * 5 + 4)
      if (y + h > P.h - FOOTER_MARGIN) y = addCreamPage(doc)
      y += drawFlightCard(doc, aux, y) + 4
    }
  }
  // ── Experiences ───────────────────────────────────────────────────────────
  const experiences = d.experiences ?? []
  if (experiences.length > 0) {
    y = addCreamPage(doc)
    drawRule(doc, P.margin, y, CW); y += 8
    sans(doc, 'bold', 7)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('EXPERIENCES', P.margin, y, { charSpace: 0.5 }); y += 7
    for (const xp of experiences) {
      const h = 24
      if (y + h > P.h - FOOTER_MARGIN) y = addCreamPage(doc)
      serif(doc, 'normal', 10); doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
      doc.text(xp.title, P.margin, y); y += 5
      if (xp.entry_date) { sans(doc, 'normal', 8); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); doc.text(fmtDate(xp.entry_date), P.margin, y); y += 5 }
      if (xp.notes) { sans(doc, 'normal', 7.5); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2]); for (const wl of doc.splitTextToSize(xp.notes, CW)) { doc.text(wl, P.margin, y); y += 4.5 } }
      y += 4
    }
  }
  // ── Contacts ──────────────────────────────────────────────────────────────

  const allContacts = d.contacts ?? []
  const guests = allContacts.filter(c => c.role !== 'staff')
  const staff  = allContacts.filter(c => c.role === 'staff')

  const hasContacts = !!brief?.advisorName || guests.length > 0 || staff.length > 0
  if (hasContacts) y = addCreamPage(doc)

  if (brief?.advisorName) {
    const advisor: ConfirmationContact = {
      id:    'advisor',
      name:  brief.advisorName,
      role:  'advisor',
      email: (brief as any).showAdvisorEmail ? (brief.advisorEmail ?? null) : null,
      phone: (brief as any).showAdvisorPhone ? ((brief as any).advisorPhone ?? null) : null,
    }
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
  const clientName = d.guestDisplayName ?? d.brief?.preparedFor ?? d.trip.destinations[0]?.name ?? ''
  const destination = d.destinationName
  const dateRange = (() => {
    const s = d.trip.startDate; const e = d.trip.endDate
    if (!s) return ''
    const sd = new Date(s.slice(0, 10) + 'T00:00:00')
    const ed = e ? new Date(e.slice(0, 10) + 'T00:00:00') : null
    const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const month = MONTHS_LONG[sd.getMonth()]
    const year  = sd.getFullYear()
    if (ed && ed.getMonth() === sd.getMonth() && ed.getFullYear() === sd.getFullYear())
      return `${sd.getDate()}-${ed.getDate()} ${month} ${year}`
    return `${sd.getDate()} ${month} ${year}`
  })()
  return ['Engagement Confirmation', safe(clientName), safe(destination), dateRange].filter(Boolean).join(' - ') + '.pdf'
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportConfirmationBriefPdf(data: ConfirmationBriefData, branding: ExportBranding = 'ambience'): Promise<void> {
  const jsPDF = assertJsPdf()
  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  await renderAll(doc, data, emblem, logo, branding)
  stampPageChrome(doc, data.brief)
  doc.save(buildFilename(data))
}