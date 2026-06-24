// pdfImmerseProgramme.ts — Daily Programme PDF export for ambience.TRAVEL
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Per visible day: day header, entry rows with time + accent bar + images
//   - Empty-day fallback, programme notes section
//   - Filename: "ambience · {Destination} · Daily Programme · {date}.pdf"
//
// What it does not own:
//   - Hero, footer, theme, date helpers, page helpers → pdfShared.ts
//   - Image loading, SVG rasterisation, cover crop, font helpers → pdfUtils.ts
//   - Font loading / registration → pdfFonts.ts
//
// Last updated: S43 Add 2C — hero, footer, theme extracted to pdfShared.ts.
//   drawPdfHero() canonical across all three PDFs. Eyebrow now uses
//   Cormorant Garamond sentence case (not ALL CAPS sans).
// Prior: S50r2 — aux bookings merged into programme PDF.
// Prior: S49/S50 — entry images, programme notes, category accent bar.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, makeCoverCropAsync, serif, sans, drawRule } from './pdfUtils'
import type { RGB } from './pdfUtils'
import {
  T, P, CW, ASSETS,
  fmtTime, buildDateRange, drawPdfHero, stampPageChrome, addCreamPage, roomLine, driverDetailLines, drawOwnArrangementsChip,
} from './pdfShared'
import type { TripDay, DossierTrip, HouseProfile, TripBrief } from '../queries/queriesAdminTrip'
import type { TimelineItem } from '../types/typesTimeline'
import { bookedByLabel, isOwnArrangements, categoryAccentRgb } from '../utils/utilsBooking'

// ── Public types ──────────────────────────────────────────────────────────────

export interface DailyProgrammeData {
  trip:          DossierTrip
  brief:         TripBrief | null
  house:         HouseProfile | null
  days:          TripDay[]
  entriesByDate: Record<string, TimelineItem[]>
}

// ── Internal merged entry type ────────────────────────────────────────────────

type ProgrammeEntry = {
  id:                  string
  category:            string | null
  start_time:          string | null
  end_time:            string | null
  title:               string
  subtitle:            string | null
  guest_label:         string | null
  confirmation_number: string | null
  notes:               string | null
  booked_by:           string | null
  brief_show:          boolean
  image_src:           string | null
  passengerLines:      string[]
}

// ── Layout ────────────────────────────────────────────────────────────────────

const PROG = {
  footerY:   282,
  timeColW:  18,
  barW:      2,
  barGap:    3,
  entryPadV: 3.5,
  imgW:      36,
} as const

// ── Category accents ──────────────────────────────────────────────────────────

// categoryAccent: single source in utilsBooking.ts → categoryAccentRgb

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateFull(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function buildFilename(trip: DossierTrip): string {
  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mon   = today.toLocaleDateString('en-US', { month: 'long' })
  const yyyy  = today.getFullYear()
  return `ambience \u00b7 ${trip.destinations[0]?.name ?? 'Programme'} \u00b7 Daily Programme \u00b7 ${dd} ${mon} ${yyyy}.pdf`
}

// ── Map timeline items → render rows ─────────────────────────────────────────
// The EF (travel-get-trip-programme via _shared/timeline.ts) already merged and
// ordered hotels + aux + standalone entries. Here we only flatten each item's
// structured rooms/passengers into the PDF's passengerLines render mechanism.

function timelineToRows(items: TimelineItem[]): ProgrammeEntry[] {
  return items.map(it => {
    // Rooms (hotel check-in) and passengers (aux) both render as lines.
    // Guarded with ?? [] so non-timeline rows (admin editor passes raw
    // TripDayEntry rows, which carry neither) don't crash.
    // Shared composition — roomLine owns field selection + order (see pdfShared).
    // TimelineRoom uses `guest` where roomDisplay reads `guest_name`; map it.
    const roomLines = (it.rooms ?? []).map(r => roomLine({
      guest_name:          r.guest,
      room_name:           r.room_name,
      party_composition:   r.party_composition,
      notes:               r.notes,
      confirmation_number: r.confirmation_number,
    }))
    const paxLines = (it.passengers ?? []).map(p => {
      const name = p.resolved_passenger_label ?? p.passenger_label ?? 'Guest'
      const detail = [
        p.confirmation_number ? `Conf ${p.confirmation_number}` : null,
        p.seat_numbers ? `Seats ${p.seat_numbers}` : null,
      ].filter(Boolean).join('  \u00b7  ')
      return detail ? `${name}  \u00b7  ${detail}` : name
    })
    const vehLines = driverDetailLines(it)
    return {
      id:                  it.id,
      category:            it.category,
      start_time:          it.start_time,
      end_time:            it.end_time,
      title:               it.title,
      subtitle:            it.subtitle,
      guest_label:         it.guest_label,
      confirmation_number: it.confirmation_number,
      notes:               it.notes,
      booked_by:           it.booked_by,
      brief_show:          it.brief_show,
      image_src:           it.image_src,
      passengerLines:      [...roomLines, ...paxLines, ...vehLines],
    }
  })
}

// ── Entry row ─────────────────────────────────────────────────────────────────

async function renderEntryRow(doc: any, entry: ProgrammeEntry, y: number): Promise<number> {
  const accent      = categoryAccentRgb(entry.category)
  const bookedLabel = bookedByLabel(entry.booked_by)
  const hasImage    = !!entry.image_src

  const imageColW = hasImage ? PROG.imgW + 3 : 0
  const accentX   = P.margin + PROG.timeColW
  const contentX  = accentX + PROG.barW + PROG.barGap + imageColW
  const contentW  = CW - PROG.timeColW - PROG.barW - PROG.barGap - imageColW

  serif(doc, 'normal', 10.5)
  const titleLines = doc.splitTextToSize(entry.title, contentW - 2)
  let measuredH = PROG.entryPadV + titleLines.length * 4.8 + 4.5
  if (entry.subtitle)            measuredH += 4.5
  measuredH += entry.passengerLines.length * 4.5
  if (entry.guest_label)         measuredH += 4
  if (entry.confirmation_number) measuredH += 4.5
  measuredH += PROG.entryPadV

  const rowH = Math.max(measuredH, hasImage ? PROG.imgW * 0.66 : 10)

  drawRule(doc, contentX, y + rowH, contentW, T.rule, 0.15)

  if (entry.start_time) {
    sans(doc, 'bold', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(fmtTime(entry.start_time), P.margin, y + PROG.entryPadV + 4)
  }

  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.rect(accentX, y + 1, PROG.barW, rowH - 2, 'F')

  if (hasImage) {
    const imgX = accentX + PROG.barW + PROG.barGap
    try {
      const raw = await loadImg(entry.image_src!)
      if (raw) {
        const cropped = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, PROG.imgW, rowH)
        doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
        doc.rect(imgX, y, PROG.imgW, rowH, 'F')
        doc.addImage(cropped.data, cropped.format, imgX, y, PROG.imgW, rowH, undefined, 'FAST')
      }
    } catch {
      doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
      doc.rect(imgX, y, PROG.imgW, rowH, 'F')
    }
  }

  let ty = y + PROG.entryPadV

  serif(doc, 'normal', 10.5)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (const line of titleLines) { doc.text(line, contentX, ty + 4.8); ty += 4.8 }

  if (isOwnArrangements(entry.booked_by)) {
    drawOwnArrangementsChip(doc, contentX, ty + 0.5); ty += 5.4
  }
  if (!isOwnArrangements(entry.booked_by)) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(bookedLabel, contentX, ty + 3.5); ty += 4.5
  }

  if (entry.subtitle) {
    sans(doc, 'normal', 8.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(entry.subtitle, contentX, ty + 4); ty += 4.5
  }
  for (const line of entry.passengerLines) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    doc.text(line, contentX, ty + 4); ty += 4.5
  }
  if (entry.guest_label) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(entry.guest_label, contentX, ty + 3.5); ty += 4
  }
  if (entry.confirmation_number) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(`#${entry.confirmation_number}`, contentX, ty + 3.5)
  }

  return rowH
}

// ── Day section ───────────────────────────────────────────────────────────────

async function renderDay(doc: any, day: TripDay, entries: ProgrammeEntry[], dayIdx: number, yIn: number): Promise<number> {
  const FOOTER_GUARD = PROG.footerY - 10
  let y = yIn

  if (y + 14 > FOOTER_GUARD) y = addCreamPage(doc)

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(`DAY ${dayIdx + 1}`, P.margin, y + 5, { charSpace: 0.6 })

  serif(doc, 'normal', 13)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text(day.day_label || fmtDateFull(day.entry_date), P.margin + PROG.timeColW, y + 5)

  y += 8
  drawRule(doc, P.margin, y, CW, T.rule, 0.25)
  y += 6

  const visibleEntries = entries.filter(e => e.brief_show)

  if (visibleEntries.length === 0) {
    sans(doc, 'italic', 9)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(day.day_note || 'No plans today', P.margin + PROG.timeColW + PROG.barW + PROG.barGap, y + 3.5)
    return y + 10
  }

  for (const entry of visibleEntries) {
    serif(doc, 'normal', 10.5)
    const titleLines = doc.splitTextToSize(entry.title, CW - PROG.timeColW - PROG.barW - PROG.barGap - 2)
    const hasImage   = !!entry.image_src
    const estH = Math.max(
      PROG.entryPadV * 2 + titleLines.length * 4.8 + 4.5
        + (entry.subtitle ? 4.5 : 0)
        + entry.passengerLines.length * 4.5
        + (entry.guest_label ? 4 : 0)
        + (entry.confirmation_number ? 4.5 : 0),
      hasImage ? PROG.imgW * 0.66 : 0,
    )
    if (y + Math.max(estH, 10) > FOOTER_GUARD) y = addCreamPage(doc)
    y += await renderEntryRow(doc, entry, y) + 2
  }

  return y + 4
}

// ── Programme notes ───────────────────────────────────────────────────────────

function renderProgrammeNotes(doc: any, notes: string, yIn: number): number {
  const FOOTER_GUARD = PROG.footerY - 10
  let y = yIn

  if (y + 20 > FOOTER_GUARD) y = addCreamPage(doc)
  y += 6
  drawRule(doc, P.margin, y, CW, T.rule, 0.3); y += 7
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('NOTES', P.margin, y, { charSpace: 0.5 }); y += 8

  const lines = doc.splitTextToSize(notes, CW)
  sans(doc, 'normal', 9)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  for (const line of lines) {
    if (y + 5 > FOOTER_GUARD) y = addCreamPage(doc)
    doc.text(line, P.margin, y); y += 5
  }

  return y
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportDailyProgrammePdf(data: DailyProgrammeData): Promise<void> {
  const jsPDF    = assertJsPdf()
  const fontData = await loadGuideFonts()
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  // Resolve hero image
  let heroImageData: string | null = null
  const heroSrc = data.brief?.hero_image_src ?? data.trip.destinations[0]?.hero_image_src ?? null
  if (heroSrc) {
    try {
      const blob = await fetch(heroSrc).then(r => r.blob())
      heroImageData = await new Promise(res => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob)
      })
    } catch { /* silent */ }
  }

  const preparedFor = data.brief?.prepared_for ?? null
  const title       = data.brief?.brief_title ?? data.trip.destinations[0]?.name ?? ''

  let y = await drawPdfHero(doc, {
    title,
    docType:       'Daily Programme',
    subtitle:      data.brief?.brief_subtitle ?? null,
    preparedFor,
    dateRange:     buildDateRange(data.trip.start_date, data.trip.end_date),
    heroImageData,
    emblem,
    logo,
    logoVariant:   data.brief?.logo_variant ?? null,
  })

  const visibleDays = data.days.filter(d => d.show)
  for (let idx = 0; idx < visibleDays.length; idx++) {
    const day     = visibleDays[idx]
    const entries = timelineToRows(data.entriesByDate[day.entry_date] ?? [])
    y = await renderDay(doc, day, entries, idx, y)
  }

  if (data.brief?.programme_notes?.trim()) {
    y = renderProgrammeNotes(doc, data.brief.programme_notes, y)
  }

  stampPageChrome(doc, data.brief)
  doc.save(buildFilename(data.trip))
}