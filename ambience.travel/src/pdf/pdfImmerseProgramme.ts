// pdfImmerseProgramme.ts — Daily Programme PDF export for ambience.TRAVEL
//
// Pagination model (S53F): SINGLE measurement source (measureEntryRow). First day
//   flows under the hero on page 1 (no blank page 1); each subsequent day begins
//   on a fresh page. Day header never orphans; rows never split across pages.
//   Image: fixed 3:2 box, rounded, high-res.
//
// Last updated: S53G — elegance pass.
//   - Empty days collapse onto shared pages (no full-page blank days)
//   - Passenger names rendered in card-bg pill rows (hierarchy, not grocery list)
//   - Time column: am/pm suffix dropped — time only, cleaner
//   - Entry inter-row gap: +2 → +5
//   - entryPadV: 3.5 → 5 (more air above title)
//   - booked_by italic: more breathing room before detail lines
//   - Day header: DAY N eyebrow larger (8pt), date larger (15pt), rule thicker
//   - isMeetGreetElement / isDiningElement: now receive it.category (slug)

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, makeCoverCropAsync, serif, sans, drawRule } from './pdfUtils'
import {
  T, P, CW, ASSETS,
  fmtTime, buildDateRange, formatDateWeekday, drawPdfHero, stampPageChrome, addCreamPage,
  roomLine, driverDetailLines, drawOwnArrangementsChip,
  diningPdfStatus, isDiningCancelled, greeterLines,
  type PdfEngagementLink,
} from './pdfShared'
import type {
  ImmerseJourneyDay as JourneyDay,
  ImmerseDossierJourney as DossierJourney,
  ImmerseEngagementHouse as HouseProfile,
  ImmerseEngagementBrief as EngagementBrief,
} from '../types/typesImmerse'
import type { TimelineItem } from '../types/typesTimeline'
import { bookedByLabel, isOwnArrangements, categoryAccentRgb } from '../utils/utilsBooking'
import { isMeetGreetElement, isDiningElement } from '../types/typesElements'

// ── Public types ──────────────────────────────────────────────────────────────

export interface DailyProgrammeData {
  journey:          DossierJourney
  brief:            EngagementBrief | null
  house:            HouseProfile | null
  days:             JourneyDay[]
  entriesByDate:    Record<string, TimelineItem[]>
  links:            PdfEngagementLink[]
  guestDisplayName: string | null
}

// ── Internal render row ─────────────────────────────────────────────────────────

type ProgrammeEntry = {
  id:                  string
  category:            string | null
  bookingType:         string | null
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
  detailLines:         string[]
  noteLines:           string[]   // S55-P2: gold-italic concierge notes, own treatment
  passengerLines:      string[]   // S53G: separated for pill rendering
  diningCancelled:     boolean
  diningPill:          { label: string; tone: [number, number, number] } | null
}

// ── Layout ────────────────────────────────────────────────────────────────────

const PROG = {
  footerY:    282,
  timeColW:   16,     // S53G: slightly tighter (was 18), time-only is shorter
  barW:       2,
  barGap:     3,
  entryPadV:  5,      // S53G: more air above title (was 3.5)
  imgW:       36,
  imgH:       24,
  imgRadius:  1.5,
  lineH:      4.8,
  titleLineH: 5.2,    // S53G: slightly more leading on title (was 4.8)
  pillH:      6.5,    // S53G: passenger pill row height
} as const

const FOOTER_GUARD = PROG.footerY - 10

// ── Helpers ───────────────────────────────────────────────────────────────────

// S53G: time only, no am/pm suffix
function fmtTimeOnly(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${h}:${m ?? '00'}`
}

function buildFilename(trip: DossierJourney): string {
  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mon   = ['January','February','March','April','May','June','July','August','September','October','November','December'][today.getMonth()]
  const yyyy  = today.getFullYear()
  return `ambience \u00b7 ${trip.destinations[0]?.name ?? 'Programme'} \u00b7 Daily Programme \u00b7 ${dd} ${mon} ${yyyy}.pdf`
}

// ── Map timeline items → render rows ─────────────────────────────────────────

function timelineToRows(items: TimelineItem[]): ProgrammeEntry[] {
  return items.map(it => {
    const roomLines = (it.rooms ?? []).map(r => roomLine({
      guest_name:          r.guest,
      room_name:           r.room_name,
      party_composition:   r.party_composition,
      notes:               r.notes,
      confirmation_number: r.confirmation_number,
    }))
    const roomLinesWithCheckIn = (it.rooms ?? []).map((r, i) => {
      const base = roomLines[i]
      return r.check_in_time ? `${base}  \u00b7  Check-in ${fmtTime(r.check_in_time)}` : base
    })

    // S53G: passenger names separated for pill rendering
    const paxLines = (it.passengers ?? []).map(p => {
      const name = p.resolved_passenger_label ?? p.passenger_label ?? 'Guest'
      const detail = [
        p.confirmation_number ? `Conf ${p.confirmation_number}` : null,
        p.seat_numbers ? `Seats ${p.seat_numbers}` : null,
      ].filter(Boolean).join('  \u00b7  ')
      return detail ? `${name}  \u00b7  ${detail}` : name
    })

    const vehLines = driverDetailLines(it)

    // category is now a slug — isMeetGreetElement + isDiningElement accept slugs
    const greetLines = isMeetGreetElement(it.category)
      ? greeterLines({ contact_name: it.contact_name, contact_phone: it.contact_phone, notes: null })
      : []

    const isDining = isDiningElement(it.category)
    const diningPill = isDining
      ? diningPdfStatus({
          show_cancellation:            it.show_cancellation,
          dining_status:                it.dining_status,
          cancellation_penalty_applied: it.cancellation_penalty_applied,
          cancellation_note:            it.cancellation_note,
          venue:                        it.venue ? { booking_terms: it.venue.booking_terms } : null,
        })
      : null
    const diningCancelled = isDining && isDiningCancelled({
      show_cancellation: it.show_cancellation,
      dining_status:     it.dining_status,
    })

    const diningDetail: string[] = []
    if (isDining && it.venue) {
      const v = it.venue
      const guestLine = [it.guest_name, it.guest_count ? `${it.guest_count} guests` : null].filter(Boolean).join('  \u00b7  ')
      if (guestLine) diningDetail.push(guestLine)
      if (v.address) diningDetail.push(v.address)
      const contact = [v.phone, v.dress_code].filter(Boolean).join('  \u00b7  ')
      if (contact) diningDetail.push(contact)
    }

    // Check-in/out notes lead the detail lines (concierge intention, e.g. early
    // check-in half-rate). Rooms, vehicles, greeters, dining follow. Passengers
    // are rendered separately as pills, so they're excluded here.
    const detailLines = [
      ...roomLinesWithCheckIn,
      ...vehLines,
      ...greetLines,
      ...diningDetail,
    ]
    // S55-P2: concierge check-in/out notes carried separately for gold-italic
    // treatment (parity with Confirmation + Brief); was plain ink in detailLines.
    const noteLines = [
      ...(it.check_in_note ? [it.check_in_note] : []),
      ...(it.check_out_note ? [it.check_out_note] : []),
    ]

    return {
      id:                  it.id,
      category:            it.category,
      bookingType:         it.category,
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
      detailLines,
      noteLines,
      passengerLines:      paxLines,
      diningCancelled,
      diningPill,
    }
  })
}

// ── Entry row — single measurement source ─────────────────────────────────────

function measureEntryRow(doc: any, entry: ProgrammeEntry): number {
  const hasImage  = !!entry.image_src
  const imageColW = hasImage ? PROG.imgW + 3 : 0
  const contentW  = CW - PROG.timeColW - PROG.barW - PROG.barGap - imageColW

  serif(doc, 'normal', 10.5)
  const titleLines = doc.splitTextToSize(entry.title, contentW - 2)

  let h = PROG.entryPadV + titleLines.length * PROG.titleLineH

  // booked_by gap
  const bookedLabel = bookedByLabel(entry.booked_by)
  if (isOwnArrangements(entry.booked_by)) h += 7
  if (!isOwnArrangements(entry.booked_by) && bookedLabel) h += 6

  if (entry.subtitle)              h += PROG.lineH + 1
  h += entry.noteLines.length     * (PROG.lineH + 0.5)
  // Detail lines may wrap (venue policy terms); count wrapped rows so the row
  // height matches what drawEntryRow actually renders.
  {
    const imageColW2 = hasImage ? PROG.imgW + 3 : 0
    const contentW2  = CW - PROG.timeColW - PROG.barW - PROG.barGap - imageColW2
    sans(doc, 'normal', 8)
    for (const line of entry.detailLines) {
      h += doc.splitTextToSize(line, contentW2 - 2).length * PROG.lineH
    }
  }
  // S53G: passenger pills each take pillH
  h += entry.passengerLines.length * (PROG.pillH + 1)
  if (entry.diningPill) {
    const imageColW3 = hasImage ? PROG.imgW + 3 : 0
    const contentW3  = CW - PROG.timeColW - PROG.barW - PROG.barGap - imageColW3
    sans(doc, 'normal', 7.5)
    h += doc.splitTextToSize(entry.diningPill.label, contentW3 - 2).length * PROG.lineH + 1
  }
  if (entry.guest_label)           h += 5
  if (entry.confirmation_number)   h += 5
  h += PROG.entryPadV

  return Math.max(h, hasImage ? PROG.imgH + PROG.entryPadV * 2 : 12)
}

async function drawEntryRow(doc: any, entry: ProgrammeEntry, y: number, rowH: number): Promise<void> {
  const accent      = categoryAccentRgb(entry.category)
  const bookedLabel = bookedByLabel(entry.booked_by)
  const hasImage    = !!entry.image_src

  const imageColW = hasImage ? PROG.imgW + 3 : 0
  const accentX   = P.margin + PROG.timeColW
  const contentX  = accentX + PROG.barW + PROG.barGap + imageColW
  const contentW  = CW - PROG.timeColW - PROG.barW - PROG.barGap - imageColW

  drawRule(doc, contentX, y + rowH, contentW, T.rule, 0.15)

  // S53G: time only, no am/pm
  if (entry.start_time) {
    sans(doc, 'bold', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(fmtTimeOnly(entry.start_time), P.margin, y + PROG.entryPadV + 5)
  }

  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.rect(accentX, y + 1, PROG.barW, rowH - 2, 'F')

  if (hasImage) {
    const imgX = accentX + PROG.barW + PROG.barGap
    const imgY = y + (rowH - PROG.imgH) / 2
    try {
      const raw = await loadImg(entry.image_src!)
      if (raw) {
        const cropped = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, PROG.imgW, PROG.imgH, 12, PROG.imgRadius)
        doc.addImage(cropped.data, cropped.format, imgX, imgY, PROG.imgW, PROG.imgH, undefined, 'SLOW')
      }
    } catch {
      doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
      doc.roundedRect(imgX, imgY, PROG.imgW, PROG.imgH, PROG.imgRadius, PROG.imgRadius, 'F')
    }
  }

  let ty = y + PROG.entryPadV

  // Title
  serif(doc, 'normal', 10.5)
  const titleLines = doc.splitTextToSize(entry.title, contentW - 2)
  doc.setTextColor(
    entry.diningCancelled ? T.faint[0] : T.ink[0],
    entry.diningCancelled ? T.faint[1] : T.ink[1],
    entry.diningCancelled ? T.faint[2] : T.ink[2],
  )
  for (const line of titleLines) {
    doc.text(line, contentX, ty + PROG.titleLineH)
    if (entry.diningCancelled) {
      const lw = doc.getTextWidth(line)
      doc.setDrawColor(T.faint[0], T.faint[1], T.faint[2]); doc.setLineWidth(0.4)
      doc.line(contentX, ty + PROG.titleLineH - 1.4, contentX + lw, ty + PROG.titleLineH - 1.4)
    }
    ty += PROG.titleLineH
  }

  ty += 1.5   // S53G: small air between title and booked_by

  // Booked by
  if (isOwnArrangements(entry.booked_by)) {
    drawOwnArrangementsChip(doc, contentX, ty + 0.5); ty += 6.5
  }
  if (!isOwnArrangements(entry.booked_by) && bookedLabel) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(bookedLabel, contentX, ty + 4); ty += 5.5
  }

  // Subtitle
  if (entry.subtitle) {
    sans(doc, 'normal', 8.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(entry.subtitle, contentX, ty + 4); ty += PROG.lineH + 1
  }

   // S55-P2: concierge check-in/out notes — gold italic, the intention voice,
  // parity with Confirmation + Brief surfaces (was plain ink in detailLines).
  for (const line of entry.noteLines) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    for (const wl of doc.splitTextToSize(line, contentW - 2)) {
      doc.text(wl, contentX, ty + 4)
      ty += PROG.lineH
    }
  }
  if (entry.noteLines.length > 0) ty += 0.5
  // Detail lines (rooms, vehicles, greeters, dining). Long lines (venue policy
  // terms) wrap fully — never truncated. The PDF may be the only surface a guest
  // sees; it must carry the complete terms, not a fragment.
  for (const line of entry.detailLines) {
    sans(doc, 'normal', 8)
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
    for (const wl of doc.splitTextToSize(line, contentW - 2)) {
      doc.text(wl, contentX, ty + 4)
      ty += PROG.lineH
    }
  }

  // S53G: passenger lines as card-bg pill rows
  if (entry.passengerLines.length > 0) {
    if (entry.detailLines.length > 0) ty += 1
    for (const line of entry.passengerLines) {
      doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
      doc.rect(contentX, ty, contentW - 2, PROG.pillH, 'F')
      sans(doc, 'normal', 7.5)
      doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
      doc.text(line, contentX + 3, ty + 4.4)
      ty += PROG.pillH + 1
    }
  }

  // Dining pill — wraps fully (cancellation/booking terms); never truncated.
  if (entry.diningPill) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(entry.diningPill.tone[0], entry.diningPill.tone[1], entry.diningPill.tone[2])
    for (const pl of doc.splitTextToSize(entry.diningPill.label, contentW - 2)) {
      doc.text(pl, contentX, ty + 4)
      ty += PROG.lineH
    }
    ty += 1
  }

  if (entry.guest_label) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(entry.guest_label, contentX, ty + 4); ty += 5
  }

  if (entry.confirmation_number) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(`#${entry.confirmation_number}`, contentX, ty + 4)
  }
}

// ── Day headers ─────────────────────────────────────────────────────────────────

function drawDayHeader(doc: any, day: JourneyDay, dayIdx: number, y: number): number {
  // S53G: DAY N eyebrow larger, date larger, rule thicker
  sans(doc, 'bold', 8)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(`DAY ${dayIdx + 1}`, P.margin, y + 6, { charSpace: 0.8 })

  serif(doc, 'normal', 15)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text(day.day_label || formatDateWeekday(day.entry_date), P.margin + PROG.timeColW, y + 6)

  y += 10
  drawRule(doc, P.margin, y, CW, T.rule, 0.35)
  return y + 8
}

function drawContinuedHeader(doc: any, day: JourneyDay, dayIdx: number, y: number): number {
  sans(doc, 'bold', 7.5)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(`DAY ${dayIdx + 1} (CONTINUED)`, P.margin, y + 5, { charSpace: 0.6 })
  serif(doc, 'normal', 11)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  doc.text(day.day_label || formatDateWeekday(day.entry_date), P.margin + PROG.timeColW + 22, y + 5)
  y += 8
  drawRule(doc, P.margin, y, CW, T.rule, 0.25)
  return y + 6
}

// ── Day section — active (has entries) ───────────────────────────────────────

async function renderActiveDay(
  doc:     any,
  day:     JourneyDay,
  entries: ProgrammeEntry[],
  dayIdx:  number,
  yIn:     number,
): Promise<number> {
  let y = drawDayHeader(doc, day, dayIdx, yIn)

  const visibleEntries = entries.filter(e => e.brief_show)

  if (day.day_note) {
    sans(doc, 'italic', 8.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    const noteLines = doc.splitTextToSize(day.day_note, CW)
    for (const line of noteLines) {
      if (y + 5 > FOOTER_GUARD) { y = addCreamPage(doc); y = drawContinuedHeader(doc, day, dayIdx, y) }
      doc.text(line, P.margin, y + 3.5); y += 5
    }
    y += 2
  }

  for (const entry of visibleEntries) {
    const rowH = measureEntryRow(doc, entry)
    if (y + rowH > FOOTER_GUARD) {
      y = addCreamPage(doc)
      y = drawContinuedHeader(doc, day, dayIdx, y)
    }
    await drawEntryRow(doc, entry, y, rowH)
    y += rowH + 5   // S53G: inter-entry gap (was +2)
  }

  return y + 6
}

// ── Empty day block — compact, inline ────────────────────────────────────────
// S53G: empty days no longer get their own page. Rendered compactly in-flow.
// Returns height consumed so caller can decide whether to paginate.

const EMPTY_DAY_H = 22   // header + "Nothing planned" line

function drawEmptyDay(doc: any, day: JourneyDay, dayIdx: number, y: number): number {
  // Compact day label: DAY N · date on one line
  sans(doc, 'bold', 7.5)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(`DAY ${dayIdx + 1}`, P.margin, y + 5, { charSpace: 0.7 })

  serif(doc, 'normal', 11)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  doc.text(day.day_label || formatDateWeekday(day.entry_date), P.margin + PROG.timeColW, y + 5)

  sans(doc, 'italic', 8)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text('Nothing planned.', P.margin + PROG.timeColW, y + 11)

  drawRule(doc, P.margin, y + 16, CW, T.rule, 0.15)
  return EMPTY_DAY_H
}

// ── Main export ───────────────────────────────────────────────────────────────

import type { ExportBranding } from './pdfShared'
export type { ExportBranding }

export async function exportDailyProgrammePdf(
  data: DailyProgrammeData,
  branding: ExportBranding = 'ambience',
): Promise<void> {
  const jsPDF    = assertJsPdf()
  const fontData = await loadGuideFonts()
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  let heroImageData: string | null = null
  const heroSrc = data.brief?.hero_image_src ?? data.journey.destinations[0]?.hero_image_src ?? null
  if (heroSrc) {
    try {
      const blob = await fetch(heroSrc).then(r => r.blob())
      heroImageData = await new Promise(res => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob)
      })
    } catch { /* silent */ }
  }

  const preparedFor = data.guestDisplayName ?? data.brief?.prepared_for ?? null
  const title       = data.brief?.brief_title ?? data.journey.destinations[0]?.name ?? ''

  let y = await drawPdfHero(doc, {
    title,
    docType:       'Daily Programme',
    subtitle:      data.brief?.brief_subtitle ?? null,
    preparedFor,
    dateRange:     buildDateRange(data.journey.start_date, data.journey.end_date),
    heroImageData,
    emblem,
    logo,
    logoVariant:   branding,
  })

  y += 6

  const visibleDays = data.days.filter(d => d.show)

  // S53G: separate active vs empty days. Active days get their own page (after
  // the first). Empty days collapse into shared pages in-flow.
  let firstDone       = false
  let emptyPageOpen   = false   // are we mid-way through an empty-days page?

  for (let idx = 0; idx < visibleDays.length; idx++) {
    const day     = visibleDays[idx]
    const entries = timelineToRows(data.entriesByDate[day.entry_date] ?? [])
    const hasContent = entries.some(e => e.brief_show)

    if (hasContent) {
      // Active day — always on its own page (except the very first)
      if (firstDone) y = addCreamPage(doc)
      emptyPageOpen = false
      firstDone     = true
      y = await renderActiveDay(doc, day, entries, idx, y)
      continue
    }
    // Empty day — collapse onto shared page
    if (!firstDone) {
      firstDone = true
      y += drawEmptyDay(doc, day, idx, y)
      continue
    }
    if (!emptyPageOpen) {
      y = addCreamPage(doc)
      emptyPageOpen = true
      y += drawEmptyDay(doc, day, idx, y)
      continue
    }
    if (y + EMPTY_DAY_H > FOOTER_GUARD) y = addCreamPage(doc)
    y += drawEmptyDay(doc, day, idx, y)
  }

  if (data.brief?.programme_notes?.trim()) {
    let notesY = addCreamPage(doc)
    drawRule(doc, P.margin, notesY, CW, T.rule, 0.3); notesY += 7
    sans(doc, 'bold', 7)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('NOTES', P.margin, notesY, { charSpace: 0.8 }); notesY += 9

    const lines = doc.splitTextToSize(data.brief.programme_notes, CW)
    sans(doc, 'normal', 9)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    for (const line of lines) {
      if (notesY + 5 > FOOTER_GUARD) notesY = addCreamPage(doc)
      doc.text(line, P.margin, notesY); notesY += 5
    }
  }

  if (data.links && data.links.length > 0) {
    let linksY = addCreamPage(doc)
    drawRule(doc, P.margin, linksY, CW, T.rule, 0.3); linksY += 7
    sans(doc, 'bold', 7)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('LINKS', P.margin, linksY, { charSpace: 0.8 }); linksY += 9
    for (const link of data.links) {
      if (linksY + 13 > FOOTER_GUARD) linksY = addCreamPage(doc)
      doc.setFillColor(link.is_highlighted ? T.cardBg[0] : T.white[0], link.is_highlighted ? T.cardBg[1] : T.white[1], link.is_highlighted ? T.cardBg[2] : T.white[2])
      doc.setDrawColor(link.is_highlighted ? T.gold[0] : T.rule[0], link.is_highlighted ? T.gold[1] : T.rule[1], link.is_highlighted ? T.gold[2] : T.rule[2])
      doc.setLineWidth(link.is_highlighted ? 0.5 : 0.3)
      doc.roundedRect(P.margin, linksY, CW, 13, 2, 2, 'FD')
      serif(doc, 'normal', 10)
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
      doc.text(link.label, P.margin + 8, linksY + 8.5)
      try { doc.link(P.margin, linksY, CW, 13, { url: link.url }) } catch {}
      linksY += 16
    }
  }

  stampPageChrome(doc, data.brief)
  doc.save(buildFilename(data.journey))
}