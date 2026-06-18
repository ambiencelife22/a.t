// pdfImmerseBrief.ts — Trip Brief PDF export for ambience.TRAVEL
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Overview table: Guest, Trip, Departure, Return, Duration, Destinations
//   - Accommodation, Flights, Transfers section rows
//   - Important Notes + Links sections
//   - Filename: "Trip Brief - {ClientName} - {Destination} - {DateRange}.pdf"
//
// What it does not own:
//   - Hero, footer, theme, date helpers, page helpers → pdfShared.ts
//   - Image loading, SVG rasterisation, cover crop, font helpers → pdfUtils.ts
//   - Font loading / registration → pdfFonts.ts
//
// Last updated: S43 Add 2C — hero, footer, theme, helpers extracted to
//   pdfShared.ts. drawPdfHero() canonical across all three PDFs.
// Prior: S50 — booked_by added to Accommodation, Flights, Transfers.
// Prior: S49 — initial ship.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, serif, sans, drawRule } from './pdfUtils'
import type { Img } from './pdfUtils'
import {
  T, P, CW, ASSETS,
  fmtDate, buildDateRange, passengerLines,
  drawPdfHero, stampPageChrome, addCreamPage,
} from './pdfShared'
import type { TripBrief, TripBooking, DossierTrip, HouseProfile, TripAuxBooking } from '../queries/queriesAdminTrip'
import { bookedByLabel } from '../utils/utilsBooking'

// ── Public types ──────────────────────────────────────────────────────────────

export interface TripBriefPdfData {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  heroImageData:   string | null
  auxBookings:     TripAuxBooking[]
}

// ── Layout ────────────────────────────────────────────────────────────────────

const FOOTER_GUARD = P.h - 18
const LABEL_W      = 46

// ── Page management ───────────────────────────────────────────────────────────

function checkOverflow(doc: any, y: number, needed: number): number {
  if (y + needed > FOOTER_GUARD) return addCreamPage(doc)
  return y
}

function estimateDataRowHeight(hasSub: boolean, hasBookedBy: boolean, nameLines: number): number {
  return nameLines * 4.8 + (hasSub ? 5 : 0) + (hasBookedBy ? 4.5 : 0) + 6
}

function estimateSectionHeight(rowEstimates: number[]): number {
  return 14 + rowEstimates.reduce((sum, h) => sum + h, 0) + 4
}

function ensureSectionFits(doc: any, y: number, sectionH: number): number {
  if (y + sectionH <= FOOTER_GUARD) return y
  const fullPageH = FOOTER_GUARD - (P.margin + 10)
  if (sectionH > fullPageH) return y
  return addCreamPage(doc)
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
  return Math.max(valueLines.length * 5, 5) + 5
}

// ── Data row ──────────────────────────────────────────────────────────────────

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
    doc.text(sub, nameX, ty + 1); ty += 5
  }
  if (bookedBy) {
    sans(doc, 'italic', 7)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(bookedBy, nameX, ty + 1); ty += 4.5
  }

  return ty - y + 6
}

// ── Main render ───────────────────────────────────────────────────────────────

async function renderAll(doc: any, d: TripBriefPdfData, emblem: Img | null, logo: Img | null) {
  const { trip, brief, house } = d

  const title       = brief?.brief_title ?? d.destinationName ?? trip.destinations[0]?.name ?? ''
  const preparedFor = brief?.prepared_for ?? house?.display_name ?? null

  let y = await drawPdfHero(doc, {
    title,
    docType:       'Trip Brief',
    subtitle:      brief?.brief_subtitle ?? null,
    preparedFor,
    dateRange:     buildDateRange(trip.start_date, trip.end_date),
    heroImageData: d.heroImageData,
    emblem,
    logo,
    logoVariant:   brief?.logo_variant ?? null,
  })

  y += 4

  // ── Overview ──────────────────────────────────────────────────────────────

  y = drawSectionHeader(doc, 'Overview', y)

  const overviewRows: { label: string; value: string }[] = []
  overviewRows.push({ label: 'Guest', value: house?.display_name ?? trip.destinations[0]?.name ?? '' })
  overviewRows.push({ label: 'Trip',  value: brief?.brief_title ?? trip.destinations[0]?.name ?? '' })
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
    const rowEstimates = hotels.map(() => estimateDataRowHeight(true, true, 1))
    y = ensureSectionFits(doc, y, estimateSectionHeight(rowEstimates))
    y = drawSectionHeader(doc, 'Accommodation', y)
    for (const h of hotels) {
      y = checkOverflow(doc, y, 16)
      const name     = h._hotel_name ?? h.name ?? 'Hotel'
      const subParts = [h.name, h.nights ? `${h.nights} nights` : null, h.confirmation_number ? `Conf: ${h.confirmation_number}` : null].filter(Boolean)
      const date     = h.start_date ? fmtDate(h.start_date) : '\u2014'
      y += drawDataRow(doc, date, name, subParts.join('  \u00b7  ') || null, bookedByLabel(h.booked_by), y)
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
      const route    = [f.origin, f.destination].filter(Boolean).join('  \u2192  ')
      const meta     = [route, f.cabin_class, f.aircraft_type].filter(Boolean).join('   \u00b7   ') || null
      const paxLines = passengerLines(f)
      y += drawDataRow(doc, f.start_date ? fmtDate(f.start_date) : '\u2014', f.name ?? 'Flight', meta, bookedByLabel(f.booked_by), y)
      for (const line of paxLines) {
        y = checkOverflow(doc, y, 8)
        sans(doc, 'normal', 7.5)
        doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
        doc.text(line, P.margin + LABEL_W, y); y += 5
      }
      if (paxLines.length > 0) y += 2
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
      const sub = [t.origin, t.destination].filter(Boolean).join('  \u2192  ') || null
      y += drawDataRow(doc, t.start_date ? fmtDate(t.start_date) : '\u2014', t.name ?? 'Transfer', sub, bookedByLabel(t.booked_by), y)
    }
    y += 4
  }

  // ── Important Notes ───────────────────────────────────────────────────────

  const notes = brief?.important_notes as string[] | null | undefined
  if (notes && notes.length > 0) {
    y = ensureSectionFits(doc, y, 14 + notes.length * 12 + 4)
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
    y = ensureSectionFits(doc, y, 14 + links.length * 14 + 4)
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
  const safe        = (s: string) => s.replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim()
  const clientName  = d.brief?.prepared_for ?? d.house?.display_name ?? d.trip.destinations[0]?.name ?? ''
  const destination = d.destinationName
  const dateRange   = buildDateRange(d.trip.start_date, d.trip.end_date)
  return ['Trip Brief', safe(clientName), safe(destination), dateRange].filter(Boolean).join(' - ') + '.pdf'
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportTripBriefPdf(data: TripBriefPdfData): Promise<void> {
  const jsPDF    = assertJsPdf()
  const fontData = await loadGuideFonts()
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  await renderAll(doc, data, emblem, logo)
  stampPageChrome(doc, data.brief)
  doc.save(buildFilename(data))
}