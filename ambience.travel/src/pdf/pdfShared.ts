// pdfShared.ts — Shared primitives for ambience.TRAVEL PDF exports
//
// What it owns:
//   - Theme (T) — single colour palette for all PDFs
//   - Layout constants (P) — page dimensions + margins
//   - Date / time helpers — fmtDate, fmtTime, buildDateRange
//   - Asset paths — ASSETS constant
//   - drawPdfHero() — canonical hero for all three PDFs:
//       Full-bleed image + dark overlay, frosted logo card top-left,
//       title centred serif, eyebrow centred Cormorant (not caps),
//       prepared-for centred italic. One source of truth.
//   - drawFrostedLogoCard() — top-left pill (used inside drawPdfHero)
//   - stampPageChrome() — footer rule + tagline + page count (all PDFs)
//   - addCreAmPage() — new page with cream background
//
// What it does not own:
//   - Section renderers (rooms, entries, flights, overview rows)
//   - jsPDF lifecycle (each PDF file owns its own doc + save)
//   - Font loading / registration (pdfFonts.ts)
//
// Last updated: S43 Add 2C — extracted from pdfImmerseConfirmation,
//   pdfImmerseBrief, pdfImmerseProgramme. Single source of truth.
//   Hero: programme-style overlay + brief-style logo card + Cormorant eyebrow.

import { serif, sans, drawRule, loadImg, loadSvg, makeCoverCropAsync } from './pdfUtils'
import type { RGB, Img } from './pdfUtils'
import type { TripBrief } from '../queries/queriesAdminTrip'
import { roomGuestName, passengerName } from '../utils/utilsRoomDisplay'

// ── Theme — single palette for all PDFs ──────────────────────────────────────

export const T: Record<string, RGB> = {
  cream:   [250, 247, 242],
  ink:     [26,  29,  26],
  inkSoft: [60,  66,  60],
  muted:   [120, 115, 105],
  faint:   [180, 175, 165],
  gold:    [201, 168, 76],
  rule:    [220, 215, 205],
  cardBg:  [245, 242, 236],
  white:   [255, 255, 255],
  // Category accents (programme)
  catFlight:     [147, 197, 253],
  catTransfer:   [163, 230, 53],
  catHotel:      [201, 168, 76],
  catDining:     [249, 168, 212],
  catExperience: [196, 181, 253],
  catLeisure:    [110, 231, 183],
  catNote:       [180, 175, 165],
  catOther:      [180, 175, 165],
}

// ── Layout constants ──────────────────────────────────────────────────────────

export const P = {
  w:      210,
  h:      297,
  margin: 16,
  heroH:  62,   // canonical hero height across all PDFs
} as const

export const CW = P.w - P.margin * 2

// ── Asset paths ───────────────────────────────────────────────────────────────

export const ASSETS = {
  emblem:  '/emblem.png',
  logoSvg: '/ambience_travel.svg',
} as const

// ── Date / time helpers ───────────────────────────────────────────────────────

export function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour   = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function buildDateRange(s: string | null, e: string | null): string {
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

// ── Page helpers ──────────────────────────────────────────────────────────────

export function stampCreamBackground(doc: any): void {
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')
}

export function addCreamPage(doc: any): number {
  doc.addPage()
  stampCreamBackground(doc)
  return P.margin + 10
}

// ── Frosted logo card — top-left pill ─────────────────────────────────────────
// Used inside drawPdfHero. Shared logic for all logo_variant values.

export function drawFrostedLogoCard(
  doc:     any,
  emblem:  Img | null,
  logo:    Img | null,
  variant: string | null,
  cx = P.margin,
  cy = 8,
): void {
  const v = variant ?? 'ambience'
  if (v === 'unbranded') return

  const pH = 4; const pW = 5; const eS = 10; const gap = 3

  if (v === 'alfaone') {
    doc.setFont('CormorantGaramond', 'normal'); doc.setFontSize(12)
    const textW = doc.getTextWidth('AlfaOne Concierge')
    const cW = pW * 2 + textW; const cH = pH * 2 + eS
    doc.setGState(doc.GState({ opacity: 0.92 }))
    doc.setFillColor(250, 247, 242); doc.setDrawColor(200, 195, 185); doc.setLineWidth(0.2)
    doc.roundedRect(cx, cy, cW, cH, 3, 3, 'FD')
    doc.setGState(doc.GState({ opacity: 1 }))
    doc.setFont('CormorantGaramond', 'normal'); doc.setFontSize(12)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('AlfaOne Concierge', cx + pW, cy + pH + eS * 0.62)
    return
  }

  const logoH = 11; const logoW = logoH * 3.0
  const cW = pW + eS + gap + logoW + pW
  const cH = pH * 2 + Math.max(eS, logoH)
  doc.setGState(doc.GState({ opacity: 0.92 }))
  doc.setFillColor(250, 247, 242); doc.setDrawColor(200, 195, 185); doc.setLineWidth(0.2)
  doc.roundedRect(cx, cy, cW, cH, 3, 3, 'FD')
  doc.setGState(doc.GState({ opacity: 1 }))
  if (emblem) doc.addImage(emblem.data, emblem.format, cx + pW, cy + pH, eS, eS, undefined, 'FAST')
  if (logo) {
    const logoX = cx + pW + eS + gap
    const logoY = cy + pH + (Math.max(eS, logoH) - logoH) / 2
    doc.addImage(logo.data, logo.format, logoX, logoY, logoW, logoH, undefined, 'FAST')
  }
}

// ── Canonical hero — one source of truth for all PDFs ─────────────────────────
//
// Layout:
//   IN OVERLAY: full-bleed image + dark overlay + frosted logo card top-left
//     + title centred, Cormorant 22pt, white
//   BELOW HERO (cream): gold rule, subtitle (brief_subtitle italic gold),
//     doc type eyebrow (Cormorant 9pt gold sentence case),
//     prepared for (italic muted), date range (sans faint)
//
// Returns y position after hero (ready for first content section).

export interface HeroParams {
  title:          string
  subtitle?:      string | null  // brief_subtitle — renders below title
  docType:        string        // e.g. "Trip Confirmation" / "Daily Programme" / "Trip Brief"
  preparedFor:    string | null
  dateRange?:     string | null // optional — confirmation + brief show dates in hero
  heroImageData:  string | null
  emblem:         Img | null
  logo:           Img | null
  logoVariant:    string | null
}

export async function drawPdfHero(doc: any, params: HeroParams): Promise<number> {
  const { title, subtitle, docType, preparedFor, dateRange, heroImageData, emblem, logo, logoVariant } = params

  // Cream page background
  stampCreamBackground(doc)

  // Hero image
  if (heroImageData) {
    try {
      const raw = await loadImg(heroImageData)
      if (raw) {
        const cropped = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, P.w, P.heroH)
        doc.addImage(cropped.data, cropped.format, 0, 0, P.w, P.heroH, undefined, 'FAST')
      }
    } catch { /* silent */ }
  }
  if (!heroImageData) {
    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.rect(0, 0, P.w, P.heroH, 'F')
  }

  // Dark overlay
  doc.setFillColor(T.ink[0], T.ink[1], T.ink[2])
  doc.setGState(doc.GState({ opacity: heroImageData ? 0.68 : 1 }))
  doc.rect(0, 0, P.w, P.heroH, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))

  // Cream body below hero
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, P.heroH, P.w, P.h - P.heroH, 'F')

  // Frosted logo card — top-left
  drawFrostedLogoCard(doc, emblem, logo, logoVariant, P.margin, 7)

  // ── Title centred in overlay ────────────────────────────────────────────

  serif(doc, 'normal', 22)
  doc.setTextColor(T.cream[0], T.cream[1], T.cream[2])
  const titleLines = doc.splitTextToSize(title, CW)
  const titleBlockH = titleLines.length * 9
  const titleY = (P.heroH - titleBlockH) / 2 + 6
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], P.w / 2, titleY + i * 9, { align: 'center' })
  }

  // ── Metadata below hero, in cream ──────────────────────────────────────

  let y = P.heroH + 8

  // Gold rule
  drawRule(doc, P.margin, y, CW, T.gold, 0.4)
  y += 6

  // Subtitle (brief_subtitle)
  if (subtitle) {
    doc.setFont('CormorantGaramond', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(subtitle, P.w / 2, y, { align: 'center' })
    y += 5
  }

  // Doc type eyebrow
  doc.setFont('CormorantGaramond', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(docType, P.w / 2, y, { align: 'center', charSpace: 0.2 })
  y += 5

  // Prepared for
  if (preparedFor) {
    serif(doc, 'italic', 10)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(`Prepared for ${preparedFor}`, P.w / 2, y, { align: 'center' })
    y += 5
  }

  // Date range
  if (dateRange) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(dateRange, P.w / 2, y, { align: 'center' })
    y += 5
  }

  return y + 4
}

// ── Footer chrome — one source of truth for all PDFs ─────────────────────────
//
// Renders on every page: rule + tagline + page n of N.
// brief?.footer_tagline overrides the default when set.

export function stampPageChrome(doc: any, brief: TripBrief | null): void {
  const count   = doc.getNumberOfPages()
  const FOOTER_TAGLINE = 'TAILORED TRAVEL DESIGN  \u00b7  CONCIERGE SUPPORT  \u00b7  ambience.travel'
  const footer  = brief?.footer_tagline ?? FOOTER_TAGLINE
  const LINK    = 'ambience.travel'
  const footerY = P.h - 10

  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    drawRule(doc, P.margin, footerY, CW)
    sans(doc, 'normal', 6.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])

    const idx = footer.lastIndexOf(LINK)
    if (idx === -1) {
      doc.text(footer, P.margin, P.h - 5.5)
    }
    if (idx !== -1) {
      const before = footer.slice(0, idx)
      const after  = footer.slice(idx + LINK.length)
      doc.text(before, P.margin, P.h - 5.5)
      const bw = doc.getTextWidth(before)
      doc.text(LINK, P.margin + bw, P.h - 5.5)
      const lw = doc.getTextWidth(LINK)
      try { doc.link(P.margin + bw, P.h - 8, lw, 4, { url: 'https://ambience.travel' }) } catch {}
      if (after) doc.text(after, P.margin + bw + lw, P.h - 5.5)
    }

    doc.text(`PAGE ${i} OF ${count}`, P.w - P.margin, P.h - 5.5, { align: 'right' })
  }
}

// ── Passenger formatting — shared across all trip PDFs ────────────────────────
// An aux flight may carry N passengers, each with own conf + seats.
// Returns one display line per passenger: "Label · Conf X · Seats Y".

export interface AuxPassengerLike {
  person_id?:               string | null
  passenger_label:          string | null
  resolved_passenger_label?: string | null
  confirmation_number:      string | null
  seat_numbers:             string | null
  sort_order:               number
}

export interface AuxLike {
  passengers?: AuxPassengerLike[] | null
}

export function passengerLines(aux: AuxLike): string[] {
  const pax = (aux.passengers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  return pax.map(p => [
    passengerName(p),
    p.confirmation_number ? `Conf ${p.confirmation_number}` : null,
    p.seat_numbers ? `Seats ${p.seat_numbers}` : null,
  ].filter(Boolean).join('  \u00b7  '))
}

// ── Room display composition — shared across all trip PDFs ─────────────────────
// One source for what a room's text content is. Layout stays per-surface
// (confirmation = structured card rows, programme = flat joined string), but the
// FIELDS and their composition live here. Mirror of passengerLines for rooms.
//
// resolved_guest_name is set by the caller (names.ts) before this runs.

export interface RoomLike {
  resolved_guest_name?: string | null
  guest_name?:          string | null
  additional_guests?:   string[] | null
  party_composition?:   string | null
  room_name?:           string | null
  notes?:               string | null
  confirmation_number?: string | null
}

export interface RoomDisplay {
  roomName:  string | null   // e.g. "Suite Fenchl"
  guestLine: string | null   // e.g. "AlSuwaidi Family · Ms. Sayegh"
  board:     string | null   // e.g. "Full board"  (from notes)
  conf:      string | null   // bare conf value, no prefix
}

export function roomDisplay(room: RoomLike): RoomDisplay {
  const guests: string[] = []
  const lead = roomGuestName(room)
  if (lead) guests.push(lead)
  if (room.additional_guests?.length) guests.push(...room.additional_guests)
  if (room.party_composition) guests.push(room.party_composition)
  return {
    roomName:  room.room_name ?? null,
    guestLine: guests.length ? guests.join('  \u00b7  ') : null,
    board:     room.notes ?? null,
    conf:      room.confirmation_number ?? null,
  }
}

// Flat single-string variant for surfaces that render rooms as one line
// (programme PDF). Order: guests · room · board · #conf.
export function roomLine(room: RoomLike): string {
  const d = roomDisplay(room)
  return [
    d.guestLine,
    d.roomName,
    d.board,
    d.conf ? `#${d.conf}` : null,
  ].filter(Boolean).join('  \u00b7  ')
}