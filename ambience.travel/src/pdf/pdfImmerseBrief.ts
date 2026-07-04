// pdfImmerseBrief.ts — Trip Brief PDF export for ambience.TRAVEL
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Overview table: Guest, Trip, Departure, Return, Duration, Destinations
//   - Accommodation, Flights, Transfers, Airport Meet & Greet, Dining sections
//   - Important Notes + Links sections
//   - Filename: "Trip Brief - {ClientName} - {Destination} - {DateRange}.pdf"
//
// What it does not own:
//   - Hero, footer, theme, date helpers, page helpers → pdfShared.ts
//   - Image loading, SVG rasterisation, cover crop, font helpers → pdfUtils.ts
//   - Font loading / registration → pdfFonts.ts
//
// Pagination (S53F): every row checks the footer guard before drawing; sections
//   keep their header with at least one row (no orphan). Estimates removed in
//   favour of per-row guard checks — simpler and drift-free for a text doc.
//
// Last updated: S53G — spacing + elegance pass. Tighter date column (LABEL_W 38),
//   more air above section headers, wider eyebrow tracking, larger inter-section
//   gaps (10pt), improved inter-row gaps (10pt), passenger lines rendered in
//   card-bg pill rows for hierarchy. Hero metadata looser steps.
// Prior: S53F — Airport Meet & Greet + Dining sections (with cancellation
//   indicator + clickable maps address), aligned to web Brief + Confirmation.
// Prior: S50 — booked_by added to Accommodation, Flights, Transfers.
// Prior: S49 — initial ship.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, serif, sans, drawRule } from './pdfUtils'
import type { Img } from './pdfUtils'
import {
  T, P, CW, ASSETS,
  fmtDate, fmtTime, buildDateRange, passengerLines, driverDetailLines, greeterLines,
  isDiningCancelled, drawOwnArrangementsChip,
  drawPdfHero, stampPageChrome, addCreamPage,
  type ExportBranding, type PdfEngagementLink,
} from './pdfShared'
import type {
  ImmerseTripBrief as TripBrief,
  ImmerseTripBooking as TripBooking,
  ImmerseDossierTrip as DossierTrip,
  ImmerseTripHouse as HouseProfile,
  ImmerseTripAuxBooking as TripAuxBooking,
} from '../types/typesImmerse'
import { isFlightBooking, isTransferBooking, isHotelBooking, isMeetGreetBooking, isDiningBooking } from '../types/typesAuxBookings'
import { bookedByLabel, isOwnArrangements } from '../utils/utilsBooking'

// ── Public types ──────────────────────────────────────────────────────────────

export interface TripBriefPdfData {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  heroImageData:   string | null
  auxBookings:     TripAuxBooking[]
  links:           PdfEngagementLink[]
}

// ── Layout ────────────────────────────────────────────────────────────────────

const FOOTER_GUARD = P.h - 18
const LABEL_W      = 38   // S53G: tighter date column (was 46), more room for content

// ── Page management ───────────────────────────────────────────────────────────

function checkOverflow(doc: any, y: number, needed: number): number {
  if (y + needed > FOOTER_GUARD) return addCreamPage(doc)
  return y
}

// ── Section header ────────────────────────────────────────────────────────────
// Draws a section header, paginating first if the header + one row won't fit
// (prevents an orphaned header at the page bottom).
// S53G: breathing room above rule (+4 pre-rule), wider eyebrow tracking (1.2),
// larger post-label gap (9pt).

function drawSectionHeader(doc: any, label: string, y: number, firstRowH = 14): number {
  if (y + 20 + firstRowH > FOOTER_GUARD) y = addCreamPage(doc)
  y += 4
  drawRule(doc, P.margin, y, CW, T.rule, 0.25)
  y += 8
  sans(doc, 'bold', 6.5)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(label.toUpperCase(), P.margin, y, { charSpace: 1.2 })
  return y + 9
}

// ── Overview row ──────────────────────────────────────────────────────────────
// S53G: narrower label column (34pt), slightly larger value type (9pt),
// more generous leading (5.5pt) and post-row gap (7pt).

function drawOverviewRow(doc: any, label: string, value: string, y: number): number {
  const overviewLabelW = 34
  const valueX = P.margin + overviewLabelW
  const valueW = CW - overviewLabelW

  sans(doc, 'normal', 8)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text(label, P.margin, y)

  const valueLines = doc.splitTextToSize(value, valueW)
  sans(doc, 'normal', 9)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (let i = 0; i < valueLines.length; i++) {
    doc.text(valueLines[i], valueX, y + i * 5.5)
  }
  return Math.max(valueLines.length * 5.5, 5.5) + 7
}

// ── Data row ──────────────────────────────────────────────────────────────────
// Generic date | name | sub | bookedBy row. `cancelled` strikes the name and
// shows a small red CANCELLED tag; `cancelNote` renders in red beneath. `mapsUrl`
// makes the `sub` line (when it's an address) a clickable gold link.

interface DataRowOpts {
  date:        string
  name:        string
  sub?:        string | null
  bookedBy?:   string | null
  bookedByRaw?: string | null
  cancelled?:  boolean
  cancelNote?: string | null
  subIsLink?:  string | null   // maps_url — renders sub as gold clickable link
}

function drawDataRow(doc: any, o: DataRowOpts, y: number): number {
  const nameX = P.margin + LABEL_W
  const nameW = CW - LABEL_W

  sans(doc, 'normal', 7.5)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  if (o.date) doc.text(o.date, P.margin, y)

  const nameLines = doc.splitTextToSize(o.name, nameW)
  sans(doc, 'normal', 9)
  doc.setTextColor(o.cancelled ? T.faint[0] : T.ink[0], o.cancelled ? T.faint[1] : T.ink[1], o.cancelled ? T.faint[2] : T.ink[2])
  for (let i = 0; i < nameLines.length; i++) {
    doc.text(nameLines[i], nameX, y + i * 5.5)
    if (o.cancelled && i === 0) {
      const nw = doc.getTextWidth(nameLines[i])
      doc.setDrawColor(T.faint[0], T.faint[1], T.faint[2]); doc.setLineWidth(0.4)
      doc.line(nameX, y - 1, nameX + nw, y - 1)
      // small CANCELLED tag
      sans(doc, 'bold', 6)
      doc.setTextColor(180, 50, 31)
      doc.text('CANCELLED', nameX + nw + 4, y, { charSpace: 0.4 })
      sans(doc, 'normal', 9)
    }
  }
  let ty = y + nameLines.length * 5.5

  if (o.sub) {
    sans(doc, 'normal', 7.5)
    if (o.subIsLink) {
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
      doc.text(o.sub, nameX, ty + 2)
      const sw = doc.getTextWidth(o.sub)
      try { doc.link(nameX, ty - 1, sw, 5, { url: o.subIsLink }) } catch {}
      ty += 6
    }
    if (!o.subIsLink) {
      doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
      doc.text(o.sub, nameX, ty + 2)
      ty += 6
    }
  }
  if (o.cancelled && o.cancelNote) {
    sans(doc, 'normal', 7)
    doc.setTextColor(180, 50, 31)
    doc.text((doc.splitTextToSize(o.cancelNote, nameW))[0] ?? o.cancelNote, nameX, ty + 2); ty += 5.5
  }
  if (isOwnArrangements(o.bookedByRaw)) {
    drawOwnArrangementsChip(doc, nameX, ty - 1.4); ty += 6.4
    return ty - y + 10
  }
  if (o.bookedBy) {
    sans(doc, 'italic', 7)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(o.bookedBy, nameX, ty + 2); ty += 5.5
  }

  // S53G: generous inter-row gap (was +6)
  return ty - y + 10
}

// ── Main render ───────────────────────────────────────────────────────────────

async function renderAll(doc: any, d: TripBriefPdfData, emblem: Img | null, logo: Img | null, branding: ExportBranding = 'ambience') {
  const { trip, brief, house } = d

  const title       = brief?.brief_title ?? d.destinationName ?? trip.destinations[0]?.name ?? ''
  const preparedFor = brief?.prepared_for ?? null

  let y = await drawPdfHero(doc, {
    title,
    docType:       'Trip Brief',
    subtitle:      brief?.brief_subtitle ?? null,
    preparedFor,
    dateRange:     buildDateRange(trip.start_date, trip.end_date),
    heroImageData: d.heroImageData,
    emblem,
    logo,
    logoVariant:   branding,
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
    y = checkOverflow(doc, y, 14)
    y += drawOverviewRow(doc, row.label, row.value, y)
  }

  y += 4

  // ── Accommodation ─────────────────────────────────────────────────────────

  const hotels = trip.bookings.filter((b: TripBooking) => isHotelBooking(b.booking_type) && b.brief_show !== false)
  if (hotels.length > 0) {
    y = drawSectionHeader(doc, 'Accommodation', y)
    for (const h of hotels) {
      y = checkOverflow(doc, y, 18)
      const rooms    = h._rooms ?? []
      const catCounts = rooms.reduce((acc: Record<string, number>, r: any) => {
        const nm = r.room_name ?? 'Room'; acc[nm] = (acc[nm] ?? 0) + 1; return acc
      }, {})
      const cats = Object.entries(catCounts).map(([nm, n]) => (n > 1 ? `${nm} \u00d7${n}` : nm))
      const subParts = [
        h.nights ? `${h.nights} nights` : null,
        cats.length ? cats.join('  \u00b7  ') : null,
        h.check_in_note ?? null,
      ].filter(Boolean)
      y += drawDataRow(doc, {
        date:        buildDateRange(h.check_in_date ?? h.start_date, h.end_date) || '\u2014',
        name:        h._hotel_name ?? h.name ?? 'Hotel',
        sub:         subParts.join('  \u00b7  ') || null,
        bookedBy:    bookedByLabel(h.booked_by),
        bookedByRaw: h.booked_by,
      }, y)
      if (h.inclusions_override && (h.inclusions_override as {heading:string;bullets:string[]}[]).length > 0) {
        for (const group of h.inclusions_override as {heading:string;bullets:string[]}[]) {
          y = checkOverflow(doc, y, 10)
          sans(doc, 'bold', 6.5); doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
          doc.text(group.heading.toUpperCase(), P.margin + LABEL_W, y, { charSpace: 0.3 }); y += 4.5
          for (const bullet of group.bullets) {
            y = checkOverflow(doc, y, 6)
            sans(doc, 'normal', 7.5); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
            doc.text('\u00b7', P.margin + LABEL_W, y)
            const bLines = doc.splitTextToSize(bullet, CW - LABEL_W - 5)
            for (const bl of bLines) { doc.text(bl, P.margin + LABEL_W + 4, y); y += 4 }
          }
          y += 2
        }
      }
      if (h.cancellation_policy) {
        y = checkOverflow(doc, y, 12)
        sans(doc, 'bold', 6.5); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
        doc.text('CANCELLATION POLICY', P.margin + LABEL_W, y, { charSpace: 0.3 }); y += 4
        sans(doc, 'normal', 7.5); doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
        const cpLines = doc.splitTextToSize(h.cancellation_policy, CW - LABEL_W)
        for (const line of cpLines) { doc.text(line, P.margin + LABEL_W, y); y += 4 }
        y += 4
      }
      if ((h._invoices ?? []).length > 0) {
        y = checkOverflow(doc, y, 12)
        sans(doc, 'bold', 6.5); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
        doc.text('INVOICES', P.margin + LABEL_W, y, { charSpace: 0.3 }); y += 5
        for (const inv of h._invoices as {id:string;invoice_number:string;invoice_date:string|null;amount:number|null;currency:string;description:string|null}[]) {
          y = checkOverflow(doc, y, 10)
          sans(doc, 'normal', 7.5); doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
          const label = inv.description ?? `Invoice ${inv.invoice_number}`
          doc.text(label, P.margin + LABEL_W, y)
          const amtStr = inv.amount != null ? `${inv.currency} ${Math.abs(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
          if (amtStr) doc.text(amtStr, P.margin + CW, y, { align: 'right' })
          if (inv.invoice_date) { sans(doc, 'normal', 7); doc.setTextColor(T.faint[0], T.faint[1], T.faint[2]); doc.text(inv.invoice_date, P.margin + LABEL_W, y + 4) }
          y += 10
        }
        y += 2
      }
    }
    y += 10
  }

  // ── Flights ───────────────────────────────────────────────────────────────

  const flights = d.auxBookings.filter(a => isFlightBooking(a.booking_type))
  if (flights.length > 0) {
    y = drawSectionHeader(doc, 'Flights', y)
    for (const f of flights) {
      y = checkOverflow(doc, y, 18)
      const route    = [f.depart_airport ?? f.origin, f.arrive_airport ?? f.destination].filter(Boolean).join('  \u2192  ')
      const meta     = [route, f.cabin_class, f.aircraft_type].filter(Boolean).join('   \u00b7   ') || null
      const paxLines = passengerLines(f)
      y += drawDataRow(doc, {
        date:        f.start_date ? fmtDate(f.start_date) : '\u2014',
        name:        f.name ?? 'Flight',
        sub:         meta,
        bookedBy:    bookedByLabel(f.booked_by),
        bookedByRaw: f.booked_by,
      }, y)
      // S53G: passenger lines rendered in card-bg pill rows for visual hierarchy
      for (const line of paxLines) {
        y = checkOverflow(doc, y, 9)
        doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
        doc.rect(P.margin + LABEL_W, y - 3.5, CW - LABEL_W, 6.5, 'F')
        sans(doc, 'normal', 7.5)
        doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
        doc.text(line, P.margin + LABEL_W + 3, y + 0.5); y += 7.5
      }
      if (paxLines.length > 0) y += 3
    }
    y += 10
  }

  // ── Transfers ─────────────────────────────────────────────────────────────

  const transfers = d.auxBookings.filter(a => isTransferBooking(a.booking_type))
  if (transfers.length > 0) {
    y = drawSectionHeader(doc, 'Transfers', y)
    for (const t of transfers) {
      y = checkOverflow(doc, y, 18)
      y += drawDataRow(doc, {
        date:        t.start_date ? fmtDate(t.start_date) : '\u2014',
        name:        t.name ?? 'Transfer',
        sub:         [t.origin, t.destination].filter(Boolean).join('  \u2192  ') || null,
        bookedBy:    bookedByLabel(t.booked_by),
        bookedByRaw: t.booked_by,
      }, y)
      // Driver/vehicle lines in card-bg pill rows (matches flight passenger style).
      const driverLines = driverDetailLines(t)
      for (const line of driverLines) {
        y = checkOverflow(doc, y, 9)
        doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
        doc.rect(P.margin + LABEL_W, y - 3.5, CW - LABEL_W, 6.5, 'F')
        sans(doc, 'normal', 7.5)
        doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
        doc.text(line, P.margin + LABEL_W + 3, y + 0.5); y += 7.5
      }
      if (driverLines.length > 0) y += 3
    }
    y += 10
  }

  // ── Airport Meet & Greet ────────────────────────────────────────────────────

  const greeters = d.auxBookings.filter(a => isMeetGreetBooking(a.booking_type) && a.brief_show !== false)
  if (greeters.length > 0) {
    y = drawSectionHeader(doc, 'Airport Meet & Greet', y)
    for (const g of greeters) {
      y = checkOverflow(doc, y, 18)
      const sub = [
        g.start_time ? fmtTime(g.start_time) : null,
        ...greeterLines({ contact_name: g.contact_name, contact_phone: g.contact_phone, notes: g.notes }),
      ].filter(Boolean).join('  \u00b7  ')
      y += drawDataRow(doc, {
        date:        g.start_date ? fmtDate(g.start_date) : '\u2014',
        name:        g.name ?? 'Airport Meet & Greet',
        sub:         sub || null,
        bookedBy:    bookedByLabel(g.booked_by),
        bookedByRaw: g.booked_by,
      }, y)
    }
    y += 10
  }

  // ── Dining ──────────────────────────────────────────────────────────────────

  const dining = d.auxBookings.filter(a => isDiningBooking(a.booking_type) && a.brief_show !== false)
  if (dining.length > 0) {
    y = drawSectionHeader(doc, 'Dining', y)
    for (const dd of dining) {
      y = checkOverflow(doc, y, 20)
      const cancelled = isDiningCancelled({ show_cancellation: dd.show_cancellation, dining_status: dd.dining_status })
      const v = dd.venue
      const sub = [
        dd.start_time ? fmtTime(dd.start_time) : null,
        dd.guest_name ?? null,
        dd.guest_count ? `${dd.guest_count} guests` : null,
      ].filter(Boolean).join('  \u00b7  ')
      y += drawDataRow(doc, {
        date:        dd.start_date ? fmtDate(dd.start_date) : '\u2014',
        name:        dd.name ?? 'Dining',
        sub:         v?.address ?? (sub || null),
        subIsLink:   v?.address ? (v?.maps_url ?? null) : null,
        bookedBy:    bookedByLabel(dd.booked_by),
        bookedByRaw: dd.booked_by,
        cancelled,
        cancelNote:  dd.cancellation_penalty_applied ? dd.cancellation_note : null,
      }, y)
      // Time/guest line beneath address (when address occupied the sub slot)
      if (v?.address && sub) {
        y = checkOverflow(doc, y, 7)
        sans(doc, 'normal', 7.5)
        doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
        doc.text(sub, P.margin + LABEL_W, y); y += 6
      }
    }
    y += 10
  }

  // ── Important Notes ───────────────────────────────────────────────────────

  const notes = brief?.important_notes as string[] | null | undefined
  if (notes && notes.length > 0) {
    y = drawSectionHeader(doc, 'Important Notes', y)
    for (const note of notes) {
      y = checkOverflow(doc, y, 14)
      const noteLines = doc.splitTextToSize(note, CW - 8)
      sans(doc, 'normal', 8.5)
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
      doc.text('\u2022', P.margin, y)
      sans(doc, 'normal', 8.5)
      doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
      for (let i = 0; i < noteLines.length; i++) {
        doc.text(noteLines[i], P.margin + 6, y + i * 5.5)
      }
      y += noteLines.length * 5.5 + 4
    }
    y += 10
  }

  // ── Links ─────────────────────────────────────────────────────────────────

  const links = d.links ?? []
  if (links.length > 0) {
    y = drawSectionHeader(doc, 'Links', y)
    for (const link of links) {
      y = checkOverflow(doc, y, 16)
      doc.setFillColor(T.white[0], T.white[1], T.white[2])
      doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
      doc.setLineWidth(0.3)
      doc.roundedRect(P.margin, y, CW, 13, 2, 2, 'FD')
      serif(doc, 'normal', 10)
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
      doc.text(link.label, P.margin + 8, y + 8.5)
      try { doc.link(P.margin, y, CW, 13, { url: link.url }) } catch {}
      y += 16
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

export async function exportTripBriefPdf(data: TripBriefPdfData, branding: ExportBranding = 'ambience'): Promise<void> {
  const jsPDF    = assertJsPdf()
  const fontData = await loadGuideFonts()
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  await renderAll(doc, data, emblem, logo, branding)
  stampPageChrome(doc, data.brief)
  doc.save(buildFilename(data))
}