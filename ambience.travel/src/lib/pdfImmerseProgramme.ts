// dailyProgrammePdf.ts — Daily Programme PDF export for ambience.TRAVEL
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Dark header: emblem + ambience_travel.svg logo, destination name,
//     "DAILY PROGRAMME" eyebrow, "Prepared for" line
//   - Per visible day: "DAY N" gold label + date header, rule beneath
//   - Entry rows: time column (18mm), accent dot, title / subtitle /
//     guest_label / confirmation_number, "Self-arranged" / "TBC" pill
//   - Empty-day fallback: day_note or "No plans today"
//   - Footer: ambience_travel.svg logo + tagline, hyperlinked via doc.link()
//   - Filename: "ambience · {TripCode} · Daily Programme · {dd Month yyyy}.pdf"
//
// What it does not own:
//   - jsPDF script loading (useProgrammeDownload owns this)
//   - Data fetching (ItineraryEditorPage passes current state)
//   - Font loading (shared via guidePdfFonts.ts)
//
// Palette mirrors ItineraryPreview in ItineraryEditorPage.tsx exactly:
//   CREAM #F7F5F0 · INK #1A1D1A · GOLD #C9A84C · MUTED #787060 · RULE #DCDBD5
//
// Category accent colours mirror categoryColor() in ItineraryEditorPage.tsx.
// All image ops route through pdfUtils.ts — no inline canvas logic.
//
// Last updated: S48 — initial ship.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, makeCoverCropAsync, serif, sans, drawRule } from './pdfUtils'
import type { RGB } from './pdfUtils'
import type { TripDay, TripDayEntry, DossierTrip, HouseProfile } from './adminTripQueries'

// ── Theme ─────────────────────────────────────────────────────────────────────

const T: Record<string, RGB> = {
  cream:   [247, 245, 240],
  cream2:  [240, 237, 230],
  ink:     [26,  29,  26],
  inkSoft: [60,  66,  60],
  gold:    [201, 168, 76],
  muted:   [120, 116, 96],
  faint:   [180, 175, 165],
  rule:    [220, 219, 213],
  cardBg:  [240, 237, 230],
  white:   [255, 255, 255],
  // Category accents — mirror categoryColor() in ItineraryEditorPage
  catFlight:     [147, 197, 253],
  catTransfer:   [163, 230, 53],
  catHotel:      [201, 168, 76],
  catDining:     [249, 168, 212],
  catExperience: [196, 181, 253],
  catLeisure:    [110, 231, 183],
  catNote:       [180, 175, 165],
  catOther:      [180, 175, 165],
}

// ── Layout ────────────────────────────────────────────────────────────────────

const P = {
  w:          210,
  h:          297,
  margin:     16,
  headerH:    52,   // dark header block height
  footerY:    282,
  timeColW:   18,   // mm — time column width
  dotW:       5,    // mm — accent dot column
  entryPadV:  3.5,  // vertical padding per entry row
} as const

const CW = P.w - P.margin * 2

const ASSET = {
  emblem:  '/emblem.png',
  logoSvg: '/ambience_travel.svg',
} as const

const AMBIENCE_URL     = 'https://ambience.travel'
const FOOTER_TAGLINE   = 'PRIVATE TRAVEL DESIGN  \u00b7  TAILORED SUPPORT  \u00b7  SEAMLESS EXECUTION'

// ── Public types ──────────────────────────────────────────────────────────────

export interface DailyProgrammeData {
  trip:           DossierTrip
  house:          HouseProfile | null
  days:           TripDay[]
  entriesByDate:  Record<string, TripDayEntry[]>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour   = parseInt(h, 10)
  const ampm   = hour >= 12 ? 'PM' : 'AM'
  const h12    = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function categoryAccent(cat: string | null): RGB {
  const map: Record<string, RGB> = {
    Flight:     T.catFlight,
    Transfer:   T.catTransfer,
    Hotel:      T.catHotel,
    Dining:     T.catDining,
    Experience: T.catExperience,
    Leisure:    T.catLeisure,
    Note:       T.catNote,
    Other:      T.catOther,
  }
  return map[cat ?? ''] ?? T.catOther
}

function buildFilename(trip: DossierTrip): string {
  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mon   = today.toLocaleDateString('en-US', { month: 'long' })
  const yyyy  = today.getFullYear()
  return `ambience \u00b7 ${trip.trip_code} \u00b7 Daily Programme \u00b7 ${dd} ${mon} ${yyyy}.pdf`
}

// ── Header ────────────────────────────────────────────────────────────────────

async function renderHeader(
  doc:     any,
  trip:    DossierTrip,
  house:   HouseProfile | null,
  emblem:  any,
  logo:    any,
): Promise<void> {
  // Dark header block
  doc.setFillColor(T.ink[0], T.ink[1], T.ink[2])
  doc.rect(0, 0, P.w, P.headerH, 'F')

  // Emblem + logo centred row
  const emblemS  = 9   // mm
  const logoH    = 7   // mm
  const logoW    = logoH * 3.0
  const gap      = 4
  const rowW     = emblemS + gap + logoW
  const rowX     = (P.w - rowW) / 2
  const rowY     = 9

  if (emblem) {
    doc.addImage(emblem.data, emblem.format, rowX, rowY, emblemS, emblemS, undefined, 'FAST')
  }
  if (logo) {
    const logoY = rowY + (emblemS - logoH) / 2
    doc.addImage(logo.data, logo.format, rowX + emblemS + gap, logoY, logoW, logoH, undefined, 'FAST')
  }

  // Destination name
  const destName = trip.destinations[0]?.name ?? trip.trip_code
  serif(doc, 'normal', 20)
  doc.setTextColor(T.cream[0], T.cream[1], T.cream[2])
  doc.text(destName, P.w / 2, 26, { align: 'center' })

  // "DAILY PROGRAMME" eyebrow
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('DAILY PROGRAMME', P.w / 2, 33, { align: 'center', charSpace: 0.8 })

  // "Prepared for" line
  const preparedFor = house?.display_name ?? null
  if (preparedFor) {
    sans(doc, 'italic', 8.5)
    doc.setTextColor(
      Math.round(T.cream[0] * 0.55),
      Math.round(T.cream[1] * 0.55),
      Math.round(T.cream[2] * 0.55),
    )
    doc.text(`Prepared for ${preparedFor}`, P.w / 2, 41, { align: 'center' })
  }
}

// ── Entry row ─────────────────────────────────────────────────────────────────

/**
 * Renders one itinerary entry row. Returns the height consumed (mm).
 * Layout: [timeColW] [dotW] [content flex]
 */
function renderEntryRow(doc: any, entry: TripDayEntry, y: number, availW: number): number {
  const accent    = categoryAccent(entry.category)
  const contentX  = P.margin + P.timeColW + P.dotW
  const contentW  = availW - P.timeColW - P.dotW
  const isAmbience = entry.booked_by === 'ambience'

  // Measure content height first
  let measuredH = P.entryPadV

  serif(doc, 'normal', 10.5)
  const titleLines = doc.splitTextToSize(entry.title, contentW - 2)
  measuredH += titleLines.length * 4.8

  if (entry.subtitle) {
    sans(doc, 'normal', 8.5)
    measuredH += 4.5
  }
  if (entry.guest_label) {
    measuredH += 4
  }
  if (entry.confirmation_number) {
    measuredH += 4.5
  }

  measuredH += P.entryPadV
  const rowH = Math.max(measuredH, 10)

  // Bottom rule
  drawRule(doc, P.margin + P.timeColW + P.dotW, y + rowH, contentW, T.rule, 0.15)

  // Time
  if (entry.start_time) {
    sans(doc, 'bold', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(fmtTime(entry.start_time), P.margin, y + P.entryPadV + 4, { align: 'left' })
  }

  // Accent dot
  const dotCX = P.margin + P.timeColW + 2.5
  const dotCY = y + P.entryPadV + 3
  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.circle(dotCX, dotCY, 1.6, 'F')

  // Content
  let ty = y + P.entryPadV

  // Title + non-ambience pill on same line if it fits
  serif(doc, 'normal', 10.5)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  const titleLineH = 4.8
  for (const line of titleLines) {
    doc.text(line, contentX, ty + titleLineH)
    ty += titleLineH
  }

  // Non-ambience pill
  if (!isAmbience) {
    const pillText = entry.booked_by === 'self' ? 'Self-arranged' : 'TBC'
    sans(doc, 'normal', 6.5)
    const pillW   = doc.getTextWidth(pillText) + 6
    const pillH   = 4
    const pillX   = contentX
    const pillY   = ty

    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.setDrawColor(T.faint[0], T.faint[1], T.faint[2])
    doc.setLineWidth(0.2)
    doc.roundedRect(pillX, pillY, pillW, pillH, 1, 1, 'FD')
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(pillText, pillX + 3, pillY + pillH - 0.8)
    ty += pillH + 1
  }

  if (entry.subtitle) {
    sans(doc, 'normal', 8.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(entry.subtitle, contentX, ty + 4)
    ty += 4.5
  }

  if (entry.guest_label) {
    sans(doc, 'italic', 7.5)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(entry.guest_label, contentX, ty + 3.5)
    ty += 4
  }

  if (entry.confirmation_number) {
    sans(doc, 'normal', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(`#${entry.confirmation_number}`, contentX, ty + 3.5)
  }

  return rowH
}

// ── Day section ───────────────────────────────────────────────────────────────

/**
 * Renders one day header + its entries.
 * Returns the final y cursor after all entries are drawn.
 * Handles page overflow — adds a new cream page when needed.
 */
function renderDay(
  doc:     any,
  day:     TripDay,
  entries: TripDayEntry[],
  dayIdx:  number,
  yIn:     number,
): number {
  const DAY_HEADER_H = 14  // mm including rule
  const FOOTER_GUARD = P.footerY - 10

  let y = yIn

  // Page break before day header if no room
  if (y + DAY_HEADER_H > FOOTER_GUARD) {
    y = addPage(doc)
  }

  // Day header
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(`DAY ${dayIdx + 1}`, P.margin, y + 5, { charSpace: 0.6 })

  serif(doc, 'normal', 13)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  const dayLabel = day.day_label || fmtDate(day.entry_date)
  doc.text(dayLabel, P.margin + P.timeColW, y + 5)

  y += 8
  drawRule(doc, P.margin, y, CW, T.rule, 0.25)
  y += 6

  const visibleEntries = entries.filter(e => e.brief_show)

  if (visibleEntries.length === 0) {
    // Empty day fallback
    sans(doc, 'italic', 9)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(day.day_note || 'No plans today', P.margin + P.timeColW + P.dotW, y + 3.5)
    y += 10
    return y
  }

  for (const entry of visibleEntries) {
    // Pre-measure to decide page break
    sans(doc, 'normal', 10.5)
    const titleLines = doc.splitTextToSize(entry.title, CW - P.timeColW - P.dotW - 2)
    const estH = P.entryPadV * 2
      + titleLines.length * 4.8
      + (entry.subtitle          ? 4.5 : 0)
      + (entry.guest_label       ? 4   : 0)
      + (entry.confirmation_number ? 4.5 : 0)
      + (entry.booked_by !== 'ambience' ? 5 : 0)

    if (y + Math.max(estH, 10) > FOOTER_GUARD) {
      y = addPage(doc)
    }

    const rowH = renderEntryRow(doc, entry, y, CW)
    y += rowH + 2
  }

  y += 4  // breathing room between days
  return y
}

// ── Page management ───────────────────────────────────────────────────────────

function stampCreamBackground(doc: any): void {
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')
}

function addPage(doc: any): number {
  doc.addPage()
  stampCreamBackground(doc)
  return P.margin + 10
}

// ── Footer chrome ─────────────────────────────────────────────────────────────

function stampFooterChrome(doc: any, logo: any): void {
  const count = doc.getNumberOfPages()
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)

    // Skip dark header page footer rule (page 1 has the header block)
    drawRule(doc, P.margin, P.footerY, CW, T.rule, 0.15)

    // Logo left
    if (logo) {
      const logoH = 6; const logoW = logoH * 3.0
      doc.addImage(logo.data, logo.format, P.margin, P.footerY + 3, logoW, logoH, undefined, 'FAST')
      try { doc.link(P.margin, P.footerY + 2, logoW, logoH + 1, { url: AMBIENCE_URL }) } catch {}
    }

    // Tagline centre
    sans(doc, 'normal', 6)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(FOOTER_TAGLINE, P.w / 2, P.footerY + 6.5, { align: 'center', charSpace: 0.3 })

    // Page number right
    sans(doc, 'normal', 7)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(`${i} / ${count}`, P.w - P.margin, P.footerY + 6.5, { align: 'right' })
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportDailyProgrammePdf(data: DailyProgrammeData): Promise<void> {
  const jsPDF = assertJsPdf()

  const fontData = await loadGuideFonts()
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSET.emblem),
    loadSvg(ASSET.logoSvg, 800),
  ])

  // Page 1 — dark header
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  await renderHeader(doc, data.trip, data.house, emblem, logo)

  // Content starts below header
  let y = P.headerH + 10

  const visibleDays = data.days.filter(d => d.show)

  visibleDays.forEach((day, idx) => {
    const entries = (data.entriesByDate[day.entry_date] ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
    y = renderDay(doc, day, entries, idx, y)
  })

  stampFooterChrome(doc, logo)
  doc.save(buildFilename(data.trip))
}