// pdfImmerseBrief.ts — Trip Brief PDF export for ambience.TRAVEL
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Page 1: hero cover-crop + cream mask, frosted glass logo card, centred title.
//   - Overview table: Guest, Trip, Departure, Return, Duration, Destinations
//   - Accommodation section: date + hotel name + nights + conf# + booked_by rows
//   - Flights section: date + flight name + route + booked_by rows
//   - Transfers section: date + transfer name + route + booked_by rows
//   - Important Notes section: bulleted list
//   - Links section: clickable cards
//   - Filename: "Trip Brief - {ClientName} - {Destination} - {DateRange}.pdf"
//
// What it does not own:
//   - Image loading, SVG rasterisation, cover crop, font helpers (pdfUtils.ts)
//   - Font loading / registration (pdfFonts.ts)
//   - jsPDF script loading (useImmerseConfirmationPdf hook)
//
// Mirrors TripBriefTab layout in ImmerseTripPage.tsx exactly.
// Shares frosted logo card + footer chrome logic with pdfImmerseConfirmation.ts.
//
// Last updated: S49 — initial ship.
//               S50 — booked_by added to Accommodation, Flights, Transfers sections.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import {
  assertJsPdf, loadImg, loadSvg, makeCoverCropAsync,
  serif, sans, drawRule,
  type RGB, type Img,
} from './pdfUtils'
import type { TripBrief, TripBooking, DossierTrip, HouseProfile, TripAuxBooking } from '../queries/queriesAdminTrip'
import { bookedByLabel } from '../utils/utilsBooking'

// ── Theme ─────────────────────────────────────────────────────────────────────

const T: Record<string, RGB> = {
  cream:   [250, 247, 242],
  ink:     [26,  29,  26],
  inkSoft: [60,  66,  60],
  muted:   [120, 115, 105],
  faint:   [180, 175, 165],
  gold:    [201, 168, 76],
  rule:    [220, 215, 205],
  cardBg:  [245, 242, 236],
  white:   [255, 255, 255],
}

const P = { w: 210, h: 297, margin: 16, heroH: 72 } as const
const CW = P.w - P.margin * 2
const FOOTER_GUARD = P.h - 18
const LABEL_W = 46  // mm — label column width in overview + section rows

const ASSETS = { emblem: '/emblem.png', logoSvg: '/ambience_travel.svg' } as const

// ── Public types ──────────────────────────────────────────────────────────────

export interface TripBriefPdfData {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  heroImageData:   string | null
  auxBookings:     TripAuxBooking[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
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

// ── Page management ───────────────────────────────────────────────────────────

function addPage(doc: any): number {
  doc.addPage()
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')
  return P.margin + 10
}

function checkOverflow(doc: any, y: number, needed: number): number {
  if (y + needed > FOOTER_GUARD) return addPage(doc)
  return y
}

// ── Section measurement for page-break decisions ──────────────────────────────
// Estimate height of a data row (date + name + optional sub + optional bookedBy)
// Used to decide whether a whole section fits on the current page.

function estimateDataRowHeight(hasSub: boolean, hasBookedBy: boolean, nameLines: number): number {
  return nameLines * 4.8 + (hasSub ? 5 : 0) + (hasBookedBy ? 4.5 : 0) + 6
}

function estimateSectionHeight(rowEstimates: number[]): number {
  // Section header ≈ 14mm (rule + label + spacing)
  return 14 + rowEstimates.reduce((sum, h) => sum + h, 0) + 4
}

// Break to a new page if the whole section won't fit.
// Falls through to row-level checkOverflow inside loop if section is taller than a page.

function ensureSectionFits(doc: any, y: number, sectionH: number): number {
  if (y + sectionH <= FOOTER_GUARD) return y
  // Section won't fit — but if it's larger than one full page, no point breaking
  const fullPageH = FOOTER_GUARD - (P.margin + 10)
  if (sectionH > fullPageH) return y  // let row-level overflow handle it
  return addPage(doc)
}

// ── Frosted logo card (shared with pdfImmerseConfirmation) ────────────────────

function drawFrostedLogoCard(doc: any, emblem: Img | null, logo: Img | null, variant: string | null) {
  const v = variant ?? 'ambience'
  if (v === 'unbranded') return

  const cx = P.margin; const cy = 8
  const pH = 5; const pW = 5; const eS = 12; const gap = 4

  if (v === 'alfaone') {
    doc.setFont('CormorantGaramond', 'normal'); doc.setFontSize(13)
    const textW = doc.getTextWidth('AlfaOne Concierge')
    const cW = pW * 2 + textW; const cH = pH * 2 + eS
    doc.setGState(doc.GState({ opacity: 0.92 }))
    doc.setFillColor(250, 247, 242); doc.setDrawColor(200, 195, 185); doc.setLineWidth(0.2)
    doc.roundedRect(cx, cy, cW, cH, 3, 3, 'FD')
    doc.setGState(doc.GState({ opacity: 1 }))
    doc.setFont('CormorantGaramond', 'normal'); doc.setFontSize(13)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('AlfaOne Concierge', cx + pW, cy + pH + eS * 0.62)
    return
  }

  const logoH = 14; const logoW = logoH * 3.0
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

// ── Footer chrome ─────────────────────────────────────────────────────────────

function stampChrome(doc: any, brief: TripBrief | null) {
  const count  = doc.getNumberOfPages()
  const footer = brief?.footer_tagline ?? 'TAILORED TRAVEL DESIGN  \u00b7  CONCIERGE SUPPORT  \u00b7  ambience.travel'
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    drawRule(doc, P.margin, P.h - 10, CW)
    sans(doc, 'normal', 6.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    const LINK = 'ambience.travel'
    const idx  = footer.lastIndexOf(LINK)
    if (idx !== -1) {
      const before = footer.slice(0, idx)
      const after  = footer.slice(idx + LINK.length)
      doc.text(before, P.margin, P.h - 5.5)
      const bw = doc.getTextWidth(before)
      doc.text(LINK, P.margin + bw, P.h - 5.5)
      const lw = doc.getTextWidth(LINK)
      doc.link(P.margin + bw, P.h - 8, lw, 4, { url: 'https://ambience.travel' })
      if (after) doc.text(after, P.margin + bw + lw, P.h - 5.5)
    } else {
      doc.text(footer, P.margin, P.h - 5.5)
    }
    doc.text(`PAGE ${i} OF ${count}`, P.w - P.margin, P.h - 5.5, { align: 'right' })
  }
}

// ── Section header ────────────────────────────────────────────────────────────

function drawSectionHeader(doc: any, label: string, y: number): number {
  drawRule(doc, P.margin, y, CW, T.rule, 0.3)
  y += 6
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(label.toUpperCase(), P.margin, y, { charSpace: 0.5 })
  return y + 8
}

// ── Overview row ──────────────────────────────────────────────────────────────

function drawOverviewRow(doc: any, label: string, value: string, y: number): number {
  const valueX = P.margin + LABEL_W
  const valueW = CW - LABEL_W

  sans(doc, 'normal', 8.5)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text(label, P.margin, y)

  const valueLines = doc.splitTextToSize(value, valueW)
  sans(doc, 'bold', 8.5)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (let i = 0; i < valueLines.length; i++) {
    doc.text(valueLines[i], valueX, y + i * 5)
  }

  const rowH = Math.max(valueLines.length * 5, 5)
  return rowH + 5
}

// ── Section data row (accommodation / flights / transfers) ────────────────────

function drawDataRow(doc: any, date: string, name: string, sub: string | null, bookedBy: string | null, y: number): number {
  const nameX = P.margin + LABEL_W
  const nameW = CW - LABEL_W

  sans(doc, 'normal', 8)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  if (date) doc.text(date, P.margin, y)

  const nameLines = doc.splitTextToSize(name, nameW)
  sans(doc, 'normal', 8.5)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (let i = 0; i < nameLines.length; i++) {
    doc.text(nameLines[i], nameX, y + i * 4.8)
  }
  let ty = y + nameLines.length * 4.8

  if (sub) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(sub, nameX, ty + 1)
    ty += 5
  }

  if (bookedBy) {
    sans(doc, 'italic', 7)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(bookedBy, nameX, ty + 1)
    ty += 4.5
  }

  return ty - y + 6
}

// ── Main render ───────────────────────────────────────────────────────────────

async function renderAll(doc: any, d: TripBriefPdfData, emblem: Img | null, logo: Img | null) {
  const { trip, brief, house } = d

  // Page 1 background
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  // Hero image
  if (d.heroImageData) {
    try {
      const raw = await loadImg(d.heroImageData)
      if (raw) {
        const cropped = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, P.w, P.heroH)
        doc.addImage(cropped.data, cropped.format, 0, 0, P.w, P.heroH, undefined, 'FAST')
      }
    } catch { /* silent */ }
  }
  if (!d.heroImageData) {
    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.rect(0, 0, P.w, P.heroH, 'F')
  }

  // Cream body below hero
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, P.heroH, P.w, P.h - P.heroH, 'F')

  drawFrostedLogoCard(doc, emblem, logo, brief?.logo_variant ?? null)

  let y = P.heroH + 12

  // Title
  const title = brief?.brief_title ?? d.destinationName
  serif(doc, 'normal', 28)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (const line of doc.splitTextToSize(title, CW)) {
    doc.text(line, P.w / 2, y, { align: 'center' }); y += 10
  }
  y += 2

  drawRule(doc, P.margin, y, CW, T.gold, 0.4); y += 7

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('TRIP BRIEF', P.w / 2, y, { align: 'center', charSpace: 0.8 })
  y += 8

  const preparedFor = brief?.prepared_for ?? house?.display_name ?? ''
  if (preparedFor) {
    serif(doc, 'italic', 11)
    doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
    doc.text(`Prepared for ${preparedFor}`, P.w / 2, y, { align: 'center' }); y += 10
  }

  y += 4

  // ── Overview ─────────────────────────────────────────────────────────────

  y = drawSectionHeader(doc, 'Overview', y)

  const overviewRows: { label: string; value: string }[] = []
  overviewRows.push({ label: 'Guest', value: house?.display_name ?? trip.trip_code })
  overviewRows.push({ label: 'Trip',  value: trip.trip_code })
  if (trip.start_date)      overviewRows.push({ label: 'Departure',    value: fmtDate(trip.start_date) })
  if (trip.end_date)        overviewRows.push({ label: 'Return',       value: fmtDate(trip.end_date) })
  if (trip.duration_nights) overviewRows.push({ label: 'Duration',     value: `${trip.duration_nights} nights` })
  if (trip.destinations.length > 0) {
    overviewRows.push({ label: 'Destinations', value: trip.destinations.map((dest: any) => dest.name).join(', ') })
  }

  for (const row of overviewRows) {
    y = checkOverflow(doc, y, 12)
    y += drawOverviewRow(doc, row.label, row.value, y)
  }

  y += 6

  // ── Accommodation ─────────────────────────────────────────────────────────

  const hotels = trip.bookings.filter((b: TripBooking) => b.booking_type === 'Hotel' && b.brief_show !== false)

  if (hotels.length > 0) {
    // Estimate section height: each hotel row has name + sub + bookedBy (3 lines)
    const rowEstimates = hotels.map(() => estimateDataRowHeight(true, true, 1))
    y = ensureSectionFits(doc, y, estimateSectionHeight(rowEstimates))
    y = drawSectionHeader(doc, 'Accommodation', y)

    for (const h of hotels) {
      y = checkOverflow(doc, y, 16)
      const name    = h._hotel_name ?? h.name ?? 'Hotel'
      const subParts = [
        h.name,
        h.nights ? `${h.nights} nights` : null,
        h.confirmation_number ? `Conf: ${h.confirmation_number}` : null,
      ].filter(Boolean)
      const date    = h.start_date ? fmtDate(h.start_date) : '\u2014'
      const byLabel = bookedByLabel(h.booked_by)
      y += drawDataRow(doc, date, name, subParts.join('  \u00b7  ') || null, byLabel, y)
    }

    y += 4
  }

  // ── Flights ───────────────────────────────────────────────────────────────

  const flights = d.auxBookings.filter(a => (a.booking_type ?? '').toLowerCase().includes('flight'))

  if (flights.length > 0) {
    const rowEstimates = flights.map(() => estimateDataRowHeight(true, true, 1))
    y = ensureSectionFits(doc, y, estimateSectionHeight(rowEstimates))
    y = drawSectionHeader(doc, 'Flights', y)

    for (const f of flights) {
      y = checkOverflow(doc, y, 16)
      const name     = [f.name, f.confirmation_number ? `Conf: ${f.confirmation_number}` : null]
        .filter(Boolean).join('  \u00b7  ')
      const route    = [f.origin, f.destination].filter(Boolean).join('  \u2192  ')
      const seatLine = [f.cabin_class, f.seat_numbers ? `Seats ${f.seat_numbers}` : null].filter(Boolean).join('  \u00b7  ')
      const sub      = [route, seatLine].filter(Boolean).join('   \u00b7   ') || null
      const date     = f.start_date ? fmtDate(f.start_date) : '\u2014'
      const byLabel  = bookedByLabel(f.booked_by)
      y += drawDataRow(doc, date, name || 'Flight', sub, byLabel, y)
    }

    y += 4
  }

  // ── Transfers ─────────────────────────────────────────────────────────────

  const transfers = d.auxBookings.filter(a => (a.booking_type ?? '').toLowerCase().includes('transfer'))

  if (transfers.length > 0) {
    const rowEstimates = transfers.map(() => estimateDataRowHeight(true, true, 1))
    y = ensureSectionFits(doc, y, estimateSectionHeight(rowEstimates))
    y = drawSectionHeader(doc, 'Transfers', y)

    for (const t of transfers) {
      y = checkOverflow(doc, y, 16)
      const sub     = [t.origin, t.destination].filter(Boolean).join('  \u2192  ') || null
      const date    = t.start_date ? fmtDate(t.start_date) : '\u2014'
      const byLabel = bookedByLabel(t.booked_by)
      y += drawDataRow(doc, date, t.name ?? 'Transfer', sub, byLabel, y)
    }

    y += 4
  }

  // ── Important Notes ───────────────────────────────────────────────────────

  const notes = brief?.important_notes as string[] | null | undefined
  if (notes && notes.length > 0) {
    // Estimate: each note averages ~2 lines + header ≈ 14mm
    const notesH = 14 + notes.length * 12 + 4
    y = ensureSectionFits(doc, y, notesH)
    y = drawSectionHeader(doc, 'Important Notes', y)

    for (const note of notes) {
      y = checkOverflow(doc, y, 12)
      const noteLines = doc.splitTextToSize(note, CW - 6)
      sans(doc, 'normal', 8.5)
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
      doc.text('\u2022', P.margin, y)
      sans(doc, 'normal', 8.5)
      doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
      for (let i = 0; i < noteLines.length; i++) {
        doc.text(noteLines[i], P.margin + 5, y + i * 4.8)
      }
      y += noteLines.length * 4.8 + 3
    }
  }

  // ── Links ─────────────────────────────────────────────────────────────────

  const links = (d.brief?.links as { label: string; url: string }[] | null) ?? []

  if (links.length > 0) {
    const linksH = 14 + links.length * 14 + 4
    y = ensureSectionFits(doc, y, linksH)
    y = drawSectionHeader(doc, 'Links', y)

    for (const link of links) {
      y = checkOverflow(doc, y, 14)

      doc.setFillColor(T.white[0], T.white[1], T.white[2])
      doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
      doc.setLineWidth(0.3)
      doc.roundedRect(P.margin, y, CW, 12, 2, 2, 'FD')

      serif(doc, 'normal', 10)
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
      doc.text(link.label, P.margin + 8, y + 7.5)

      try { doc.link(P.margin, y, CW, 12, { url: link.url }) } catch {}

      y += 14
    }
  }
}

// ── Filename ──────────────────────────────────────────────────────────────────

function buildFilename(d: TripBriefPdfData): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim()
  const clientName  = d.brief?.prepared_for ?? d.house?.display_name ?? d.trip.trip_code
  const destination = d.destinationName
  const dateRange   = buildDateRange(d.trip.start_date, d.trip.end_date)
  return ['Trip Brief', safe(clientName), safe(destination), dateRange].filter(Boolean).join(' - ') + '.pdf'
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportTripBriefPdf(data: TripBriefPdfData): Promise<void> {
  const jsPDF = assertJsPdf()

  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  await renderAll(doc, data, emblem, logo)
  stampChrome(doc, data.brief)
  doc.save(buildFilename(data))
}