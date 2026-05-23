// pdfImmerseProgramme.ts — Daily Programme PDF export for ambience.TRAVEL
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Page 1: hero cover-crop behind dark header overlay, emblem + logo,
//     destination name, "DAILY PROGRAMME" eyebrow, "Prepared for" line
//   - Per visible day: "DAY N" gold label + date header, rule beneath
//   - Entry rows: time column, category accent left bar, image panel (optional),
//     title / subtitle / guest_label / confirmation_number
//   - Empty-day fallback: day_note or "No plans today"
//   - Programme notes section at end (when brief.programme_notes is set)
//   - Footer: ambience_travel.svg logo + tagline, page numbers
//   - Filename: "ambience · {TripCode} · Daily Programme · {dd Month yyyy}.pdf"
//
// What it does not own:
//   - jsPDF script loading (useImmerseProgrammePdf owns this)
//   - Data fetching (ImmerseTripPage passes current state)
//   - Font loading (shared via pdfFonts.ts)
//
// Category accent: left vertical bar replacing the dot — cleaner at this scale.
// Images: entry image panels render when image_src is present on the entry.
//
// Last updated: S49/S50 — hero image, logo fix, entry images, programme notes,
//   category dot replaced with accent left bar, "Programme PDF" label.
// Prior: S48 — initial ship.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, makeCoverCropAsync, serif, sans, drawRule } from './pdfUtils'
import type { RGB } from './pdfUtils'
import type { TripDay, TripDayEntry, DossierTrip, HouseProfile, TripBrief } from '../queries/queriesAdminTrip'

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
  w:         210,
  h:         297,
  margin:    16,
  heroH:     56,    // hero image height behind dark header
  headerH:   56,    // dark header overlay height (same as heroH)
  footerY:   282,
  timeColW:  18,    // mm — time column
  barW:      2,     // mm — category accent bar width
  barGap:    3,     // mm — gap after bar before content
  entryPadV: 3.5,
  imgW:      36,    // mm — entry image panel width
} as const

const CW = P.w - P.margin * 2

const ASSET = {
  emblem:  '/emblem.png',
  logoSvg: '/ambience_travel.svg',
} as const

const AMBIENCE_URL   = 'https://ambience.travel'
const FOOTER_TAGLINE = 'PRIVATE TRAVEL DESIGN  \u00b7  TAILORED SUPPORT  \u00b7  SEAMLESS EXECUTION'

// ── Public types ──────────────────────────────────────────────────────────────

export interface DailyProgrammeData {
  trip:          DossierTrip
  brief:         TripBrief | null
  house:         HouseProfile | null
  days:          TripDay[]
  entriesByDate: Record<string, TripDayEntry[]>
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
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
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

// ── Header (page 1) ───────────────────────────────────────────────────────────

async function renderHeader(
  doc:    any,
  trip:   DossierTrip,
  brief:  TripBrief | null,
  house:  HouseProfile | null,
  emblem: any,
  logo:   any,
  heroImageData: string | null,
): Promise<void> {
  // Hero image behind header
  if (heroImageData) {
    try {
      const raw = await loadImg(heroImageData)
      if (raw) {
        const cropped = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, P.w, P.heroH)
        doc.addImage(cropped.data, cropped.format, 0, 0, P.w, P.heroH, undefined, 'FAST')
      }
    } catch { /* silent */ }
  }

  // Dark overlay on top of hero (or solid dark block if no hero)
  doc.setFillColor(T.ink[0], T.ink[1], T.ink[2])
  doc.setGState(doc.GState({ opacity: heroImageData ? 0.72 : 1 }))
  doc.rect(0, 0, P.w, P.headerH, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))

  // Emblem + logo centred
  const emblemS = 9
  const logoH   = 7
  const logoW   = logoH * 3.0
  const gap     = 4
  const rowW    = emblemS + gap + logoW
  const rowX    = (P.w - rowW) / 2
  const rowY    = 9

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

  // Eyebrow
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('DAILY PROGRAMME', P.w / 2, 33, { align: 'center', charSpace: 0.8 })

  // Prepared for
  const preparedFor = brief?.prepared_for ?? house?.display_name ?? null
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

async function renderEntryRow(
  doc:   any,
  entry: TripDayEntry & { image_src?: string | null },
  y:     number,
  availW: number,
): Promise<number> {
  const accent     = categoryAccent(entry.category)
  const isAmbience = entry.booked_by === 'ambience'
  const hasImage   = !!(entry as any).image_src

  // Content layout depends on whether there's an image
  const imageColW  = hasImage ? P.imgW + 3 : 0
  const accentX    = P.margin + P.timeColW
  const contentX   = accentX + P.barW + P.barGap + imageColW
  const contentW   = availW - P.timeColW - P.barW - P.barGap - imageColW

  // Measure height
  let measuredH = P.entryPadV
  serif(doc, 'normal', 10.5)
  const titleLines = doc.splitTextToSize(entry.title, contentW - 2)
  measuredH += titleLines.length * 4.8
  if (entry.subtitle)           measuredH += 4.5
  if (entry.guest_label)        measuredH += 4
  if (entry.confirmation_number) measuredH += 4.5
  if (!isAmbience)              measuredH += 5
  measuredH += P.entryPadV

  const rowH = Math.max(measuredH, hasImage ? P.imgW * 0.66 : 10)

  // Bottom rule
  drawRule(doc, contentX, y + rowH, contentW, T.rule, 0.15)

  // Time
  if (entry.start_time) {
    sans(doc, 'bold', 7.5)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text(fmtTime(entry.start_time), P.margin, y + P.entryPadV + 4, { align: 'left' })
  }

  // Category accent bar (replaces dot)
  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.rect(accentX, y + 1, P.barW, rowH - 2, 'F')

  // Entry image panel
  if (hasImage) {
    const imgX = accentX + P.barW + P.barGap
    const imgH = rowH
    try {
      const raw = await loadImg((entry as any).image_src)
      if (raw) {
        const cropped = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, P.imgW, imgH)
        doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
        doc.rect(imgX, y, P.imgW, imgH, 'F')
        doc.addImage(cropped.data, cropped.format, imgX, y, P.imgW, imgH, undefined, 'FAST')
      }
    } catch {
      doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
      doc.rect(imgX, y, P.imgW, rowH, 'F')
    }
  }

  // Content
  let ty = y + P.entryPadV

  serif(doc, 'normal', 10.5)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (const line of titleLines) {
    doc.text(line, contentX, ty + 4.8)
    ty += 4.8
  }

  if (!isAmbience) {
    const pillText = entry.booked_by === 'self' ? 'Self-arranged' : 'TBC'
    sans(doc, 'normal', 6.5)
    const pillW = doc.getTextWidth(pillText) + 6
    const pillH = 4
    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.setDrawColor(T.faint[0], T.faint[1], T.faint[2])
    doc.setLineWidth(0.2)
    doc.roundedRect(contentX, ty, pillW, pillH, 1, 1, 'FD')
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(pillText, contentX + 3, ty + pillH - 0.8)
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

async function renderDay(
  doc:     any,
  day:     TripDay,
  entries: (TripDayEntry & { image_src?: string | null })[],
  dayIdx:  number,
  yIn:     number,
): Promise<number> {
  const DAY_HEADER_H = 14
  const FOOTER_GUARD = P.footerY - 10
  let y = yIn

  if (y + DAY_HEADER_H > FOOTER_GUARD) y = addPage(doc)

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text(`DAY ${dayIdx + 1}`, P.margin, y + 5, { charSpace: 0.6 })

  serif(doc, 'normal', 13)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text(day.day_label || fmtDate(day.entry_date), P.margin + P.timeColW, y + 5)

  y += 8
  drawRule(doc, P.margin, y, CW, T.rule, 0.25)
  y += 6

  const visibleEntries = entries.filter(e => e.brief_show)

  if (visibleEntries.length === 0) {
    sans(doc, 'italic', 9)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(day.day_note || 'No plans today', P.margin + P.timeColW + P.barW + P.barGap, y + 3.5)
    y += 10
    return y
  }

  for (const entry of visibleEntries) {
    serif(doc, 'normal', 10.5)
    const titleLines = doc.splitTextToSize(entry.title, CW - P.timeColW - P.barW - P.barGap - 2)
    const hasImage = !!(entry as any).image_src
    const imgH = hasImage ? P.imgW * 0.66 : 0
    const estH = Math.max(
      P.entryPadV * 2 + titleLines.length * 4.8
        + (entry.subtitle ? 4.5 : 0)
        + (entry.guest_label ? 4 : 0)
        + (entry.confirmation_number ? 4.5 : 0)
        + (entry.booked_by !== 'ambience' ? 5 : 0),
      imgH,
    )

    if (y + Math.max(estH, 10) > FOOTER_GUARD) y = addPage(doc)

    const rowH = await renderEntryRow(doc, entry, y, CW)
    y += rowH + 2
  }

  y += 4
  return y
}

// ── Programme notes section ───────────────────────────────────────────────────

function renderProgrammeNotes(doc: any, notes: string, yIn: number): number {
  const FOOTER_GUARD = P.footerY - 10
  let y = yIn

  if (y + 20 > FOOTER_GUARD) y = addPage(doc)

  y += 6
  drawRule(doc, P.margin, y, CW, T.rule, 0.3)
  y += 7

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('NOTES', P.margin, y, { charSpace: 0.5 })
  y += 8

  const lines = doc.splitTextToSize(notes, CW)
  sans(doc, 'normal', 9)
  doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
  for (const line of lines) {
    if (y + 5 > FOOTER_GUARD) y = addPage(doc)
    doc.text(line, P.margin, y)
    y += 5
  }

  return y
}

// ── Footer chrome ─────────────────────────────────────────────────────────────

function stampFooterChrome(doc: any, logo: any): void {
  const count = doc.getNumberOfPages()
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    drawRule(doc, P.margin, P.footerY, CW, T.rule, 0.15)

    if (logo) {
      const logoH = 6; const logoW = logoH * 3.0
      doc.addImage(logo.data, logo.format, P.margin, P.footerY + 3, logoW, logoH, undefined, 'FAST')
      try { doc.link(P.margin, P.footerY + 2, logoW, logoH + 1, { url: AMBIENCE_URL }) } catch {}
    }

    sans(doc, 'normal', 6)
    doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
    doc.text(FOOTER_TAGLINE, P.w / 2, P.footerY + 6.5, { align: 'center', charSpace: 0.3 })

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

  // Resolve hero image — brief override || destination hero
  let heroImageData: string | null = null
  const heroSrc = data.brief?.hero_image_src || data.trip.destinations[0]?.hero_image_src || null
  if (heroSrc) {
    try {
      const blob = await fetch(heroSrc).then(r => r.blob())
      heroImageData = await new Promise(res => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob)
      })
    } catch { /* silent */ }
  }

  // Page 1
  stampCreamBackground(doc)
  await renderHeader(doc, data.trip, data.brief, data.house, emblem, logo, heroImageData)

  let y = P.headerH + 10

  const visibleDays = data.days.filter(d => d.show)
  for (let idx = 0; idx < visibleDays.length; idx++) {
    const day     = visibleDays[idx]
    const entries = (data.entriesByDate[day.entry_date] ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
    y = await renderDay(doc, day, entries, idx, y)
  }

  // Programme notes
  if (data.brief?.programme_notes?.trim()) {
    y = renderProgrammeNotes(doc, data.brief.programme_notes, y)
  }

  stampFooterChrome(doc, logo)
  doc.save(buildFilename(data.trip))
}