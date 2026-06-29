// pdfGuide.ts — PDF export for guide pages (dining + experiences + shopping + hotels)
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Cover page (full-bleed hero image, big title with year + version, emblem)
//   - Welcome page (welcome copy + at-a-glance bullets)
//   - Contents page (auto-generated from sections present, including
//     dining subsections when supplementary or recently closed venues exist)
//   - Card list section (manual layout, page-break-aware, variant dispatch)
//   - Three-group dining layout: primary → supplementary → recently closed
//     Each group opens on its own page with editorial section break
//     (eyebrow + serif heading + descriptor)
//   - Happenings section (S52 — time-bound destination content)
//   - Closing chrome (logo + restriction notice + copyright per page)
//   - Accuracy disclaimer block (gated on accuracyDate non-null)
//   - Filename construction
//
// What it does not own:
//   - Library loading (usePdfDownload hook owns this)
//   - Filter state (PDF renders the full venue set, minus permanently_closed
//     past the visibility window — treated as data hygiene)
//   - Image loading, SVG rasterisation, font helpers, draw helpers (pdfUtils.ts)
//
// Variants:
//   dining      — DiningVenue[], recognition marks, cuisine/neighborhood meta.
//                 Three-group layout: primary, supplementary, recently closed.
//                 Each group on its own page with full editorial section break.
//                 permanently_closed past closed_visible_until excluded.
//   experiences — ExperienceVenue[], no recognition marks, kicker in eyebrow slot
//   shopping    — Shop[], shop_type · by_appointment eyebrow, bullet list
//   hotels      — HotelVenue[], stars + michelin keys + forbes recognition
//   All variants accept optional happenings[] — rendered as its own page.
//   BaseGuidePdfOptions hoists shared fields off the variant union.
//
// Last updated: S52 — Editorial chapter break treatment for dining groups.
//   "Also Nearby" and "Recently Closed" now each open on a new page with
//   eyebrow + serif heading + descriptor, mirroring the web page treatment.
//   renderGroupSectionBreak replaces the lightweight inline subsection divider.
//   Contents page lists subsections when they exist.
// Prior: S52 — Three-group dining layout introduced with inline dividers.
// Prior: S52 — SPACE scale established. Role-based vertical spacing.
// Prior: S51 — logoVariant option ('ambience' | 'alfaone' | 'unbranded')
//   threaded through.
// Prior: S51 — hotels variant added.
// Prior: S52 — shopping variant added; BaseGuidePdfOptions hoist.
// Prior: S52 — happenings section added.
// Prior: S48 — refactored to import shared primitives from pdfUtils.ts.

import type { DiningVenue, GuideDestination } from '../queries/queriesGuidesDining'
import type { ExperienceVenue, ExperiencesGuideDestination } from '../queries/queriesGuidesExperiences'
import type { Happening } from '../queries/queriesGuidesHappenings'
import type { Shop, ShoppingGuideDestination } from '../queries/queriesGuidesShopping'
import type { HotelVenue, HotelGuideDestination } from '../queries/queriesGuidesHotels'
import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import {
  assertJsPdf, loadImg, loadSvg,
  serif, sans, drawRule, drawStar, drawStarRow,
  type RGB, type Img,
} from './pdfUtils'

// ── Theme ────────────────────────────────────────────────────────────────────

const THEME = {
  cream:      [246, 241, 232] as RGB,
  white:      [255, 255, 255] as RGB,
  ink:        [26,  29,  26]  as RGB,
  inkSoft:    [60,  66,  60]  as RGB,
  muted:      [90,  106, 90]  as RGB,
  faint:      [140, 140, 140] as RGB,
  gold:       [216, 181, 106] as RGB,
  rule:       [220, 215, 205] as RGB,
  fallbackBg: [240, 233, 218] as RGB,
} as const

// ── Layout ───────────────────────────────────────────────────────────────────

const PAGE = {
  width:      210,
  height:     297,
  margin:     16,
  bodyTop:    32,
  footerY:    280,
} as const

// ── Spacing scale ────────────────────────────────────────────────────────────

const SPACE = {
  LINE_TIGHT:       1,
  WITHIN_BODY:      3,
  CLUSTER_TIGHT:    5,
  META_GAP:         6,
  META_TO_NAME:     7,
  LEAD_IN:          7,
  IDENTITY_BREATHE: 8,
  SECTION_BREATHE:  9,
  SUBLINE_TO_BODY: 14,
  PAGE_PAD:        14,
} as const

const ASSET_PATHS = {
  emblem:  '/emblem.png',
  logoSvg: '/ambience_travel.svg',
} as const

const AMBIENCE_URL       = 'https://ambience.travel'
const RESTRICTION_NOTICE = 'This guide is for ambience and its guests only.'

// ── Public API ───────────────────────────────────────────────────────────────

interface BaseGuidePdfOptions {
  happenings?:   Happening[]
  copy:          { eyebrow: string; headline: string; intro: string }
  heroImageSrc?: string | null
  guideYear:     number
  guideVersion:  string
  accuracyDate:  string | null
  logoVariant?:  'ambience' | 'alfaone' | 'unbranded'
}

export type ExportGuidePdfOptions =
  | (BaseGuidePdfOptions & {
      variant:     'dining'
      destination: GuideDestination
      venues:      DiningVenue[]
    })
  | (BaseGuidePdfOptions & {
      variant:     'experiences'
      destination: ExperiencesGuideDestination
      venues:      ExperienceVenue[]
    })
  | (BaseGuidePdfOptions & {
      variant:     'shopping'
      destination: ShoppingGuideDestination
      venues:      Shop[]
    })
  | (BaseGuidePdfOptions & {
      variant:     'hotels'
      destination: HotelGuideDestination
      venues:      HotelVenue[]
    })

export async function exportGuidePdf(opts: ExportGuidePdfOptions): Promise<void> {
  const jsPDF = assertJsPdf()

  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSET_PATHS.emblem),
    loadSvg(ASSET_PATHS.logoSvg, 800),
  ])

  const overlay = opts.destination.overlay as any

  const happenings = filterFutureHappenings(opts.happenings ?? [])

  const ctx: RenderCtx = {
    doc,
    destination:  opts.destination as any,
    variant:      opts.variant,
    copy:         opts.copy,
    heroImageSrc: opts.heroImageSrc ?? null,
    guideYear:    opts.guideYear,
    guideVersion: opts.guideVersion,
    emblem,
    logo,
    sections:     buildSections(opts, happenings.length > 0),
    venues:       opts.venues as any[],
    happenings,
    accuracyDate: opts.accuracyDate,
    logoVariant:  opts.logoVariant ?? 'ambience',
  }

  await renderCoverPage(ctx)
  doc.addPage(); renderWelcomePage(ctx)
  doc.addPage(); await renderCardsSection(ctx, opts.venues as any[])

  if (happenings.length > 0) {
    doc.addPage()
    await renderHappeningsSection(ctx)
  }

  if (planYourVisitHasContent(overlay)) {
    doc.addPage()
    renderClosingPage(ctx)
  }

  stampPageChrome(ctx)
  doc.save(buildFilename(opts.destination.slug, opts.variant, opts.guideYear, opts.guideVersion, opts.logoVariant ?? 'ambience'))
}

function planYourVisitHasContent(overlay: any): boolean {
  if (!overlay) return false
  return !!(overlay.plan_your_visit_intro?.trim()) || !!(overlay.plan_your_visit_bullets?.length)
}

function filterFutureHappenings(happenings: Happening[]): Happening[] {
  const today = new Date().toISOString().slice(0, 10)
  return happenings
    .filter(h => h.end_date >= today)
    .slice()
    .sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.name.localeCompare(b.name)
    })
}

// ── Render context ────────────────────────────────────────────────────────────

interface RenderCtx {
  doc:          any
  destination:  any
  variant:      'dining' | 'experiences' | 'shopping' | 'hotels'
  copy:         { eyebrow: string; headline: string; intro: string }
  heroImageSrc: string | null
  guideYear:    number
  guideVersion: string
  emblem:       Img | null
  logo:         Img | null
  sections:     ContentsSection[]
  venues:       any[]
  happenings:   Happening[]
  accuracyDate: string | null
  logoVariant:  'ambience' | 'alfaone' | 'unbranded'
}

interface ContentsSection {
  page:  number
  title: string
  blurb: string
}

function buildSections(opts: ExportGuidePdfOptions, hasHappenings: boolean): ContentsSection[] {
  const overlay    = opts.destination.overlay as any
  const destName   = opts.destination.name
  const isExp      = opts.variant === 'experiences'
  const isShopping = opts.variant === 'shopping'
  const isHotels   = opts.variant === 'hotels'

  const mainTitle = isShopping
    ? `Selected shopping in ${destName}`
    : isHotels
      ? `${destName} Hotels`
      : isExp
        ? `${destName} Experiences`
        : `${destName} Dining`

  const mainBlurb = isShopping
    ? 'Curated boutiques, maisons, and ateliers'
    : isHotels
      ? 'Our curated selection of standout stays'
      : isExp
        ? 'Our curated selection of standout experiences'
        : 'Our curated selection of standout tables'

  const items: ContentsSection[] = [
    { page: 2, title: `Welcome to ${destName}`, blurb: 'A note on the destination and our selection' },
    { page: 3, title: mainTitle, blurb: mainBlurb },
  ]

  // For dining: surface subsection chapters in the contents when they exist
  if (opts.variant === 'dining') {
    const groups = groupDiningVenuesForPdf(opts.venues as DiningVenue[])
    if (groups.supplementary.length > 0 && groups.primary.length > 0) {
      items.push({ page: -1, title: 'Also Nearby', blurb: `Beyond the highlights ${destName}` })
    }
    if (groups.recentlyClosed.length > 0 && (groups.primary.length > 0 || groups.supplementary.length > 0)) {
      items.push({ page: -1, title: 'Recently Closed', blurb: 'Kept here briefly for reference' })
    }
  }

  if (hasHappenings) {
    items.push({ page: -1, title: `Coming up in ${destName}`, blurb: 'Time-bound programme during the season' })
  }
  if (planYourVisitHasContent(overlay)) {
    const heading = overlay?.plan_your_visit_heading?.trim() || 'Plan Your Visit'
    items.push({ page: -1, title: heading, blurb: 'Insider tips for a seamless experience' })
  }
  return items
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Filename ──────────────────────────────────────────────────────────────────

function buildFilename(slug: string, variant: string, year: number, version: string, logoVariant: string = 'ambience'): string {
  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mm    = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy  = today.getFullYear()
  const safeV = version.replace(/[^a-zA-Z0-9.]/g, '')
  const suffix = logoVariant === 'ambience' ? '' : `-${logoVariant}`
  return `ambienceTRAVEL-${slug}-${variant}-guide-${year}-v${safeV}-${dd}${mm}${yyyy}${suffix}.pdf`
}

// ── Cover page ────────────────────────────────────────────────────────────────

async function renderCoverPage(ctx: RenderCtx) {
  const { doc, destination, copy, heroImageSrc, emblem, logo, guideYear, guideVersion, variant } = ctx

  doc.setFillColor(...THEME.cream)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  if (ctx.logoVariant === 'alfaone') {
    serif(doc, 'normal', 18)
    doc.setTextColor(...THEME.gold)
    doc.text('AlfaOne Concierge', PAGE.width / 2, 44, { align: 'center' })
  }
  if (ctx.logoVariant === 'ambience') {
    if (emblem) {
      const size = 14
      doc.addImage(emblem.data, emblem.format, PAGE.width / 2 - size / 2, 18, size, size, undefined, 'FAST')
    }
    if (logo) {
      const logoH = 12; const logoW = logoH * 3.0
      doc.addImage(logo.data, logo.format, PAGE.width / 2 - logoW / 2, 36, logoW, logoH, undefined, 'FAST')
    }
  }

  // Eyebrow: destination name (universal pattern S52)
  const eyebrowY = 68
  sans(doc, 'normal', 10)
  doc.setTextColor(...THEME.gold)
  doc.text(copy.eyebrow.toUpperCase(), PAGE.margin + 4, eyebrowY, { charSpace: 1.2 })

  // Title: "The {Variant} Guide" + year stacked
  const titleY = eyebrowY + 12
  serif(doc, 'normal', 42)
  doc.setTextColor(...THEME.ink)
  const titleLines = doc.splitTextToSize(copy.headline, PAGE.width - PAGE.margin * 2 - 8)
  let yCursor = titleY
  for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
    doc.text(titleLines[i], PAGE.margin + 4, yCursor)
    yCursor += 15
  }

  // Year — same serif, slightly smaller
  serif(doc, 'normal', 28)
  doc.setTextColor(...THEME.ink)
  doc.text(String(guideYear), PAGE.margin + 4, yCursor + 4)
  yCursor += 12

  // Version pill
  sans(doc, 'normal', 9)
  doc.setTextColor(...THEME.gold)
  doc.text(`V${guideVersion.toUpperCase()}`, PAGE.margin + 4, yCursor + 8, { charSpace: 0.6 })

  // Gold rule
  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.6)
  doc.line(PAGE.margin + 4, yCursor + 14, PAGE.margin + 28, yCursor + 14)

  sans(doc, 'normal', 11)
  doc.setTextColor(...THEME.muted)
  const introLines = doc.splitTextToSize(copy.intro, PAGE.width - PAGE.margin * 2 - 60)
  let introY = yCursor + 18
  for (const line of introLines) { doc.text(line, PAGE.margin + 4, introY); introY += 5.5 }

  const heroTop = 162; const heroBottom = 270
  let heroDrawn = false
  if (heroImageSrc) {
    try {
      const imgData = await loadImg(heroImageSrc)
      if (imgData) {
        doc.addImage(imgData.data, imgData.format, 0, heroTop, PAGE.width, heroBottom - heroTop, undefined, 'FAST')
        heroDrawn = true
      }
    } catch { /* fall through to fallback */ }
  }
  if (!heroDrawn) { drawHeroFallback(doc, heroTop, heroBottom) }
}

function drawHeroFallback(doc: any, top: number, bottom: number) {
  doc.setFillColor(...THEME.fallbackBg)
  doc.rect(0, top, PAGE.width, bottom - top, 'F')
  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.4)
  doc.line(PAGE.width / 2 - 12, (top + bottom) / 2, PAGE.width / 2 + 12, (top + bottom) / 2)
}

// ── Welcome page ──────────────────────────────────────────────────────────────

function renderWelcomePage(ctx: RenderCtx) {
  const { doc, destination, copy, venues, variant } = ctx
  const overlay = ctx.destination.overlay as any

  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  serif(doc, 'normal', 28)
  doc.setTextColor(...THEME.ink)
  doc.text(`Welcome to ${destination.name}`, PAGE.margin, y)
  y += 14

  sans(doc, 'normal', 11)
  doc.setTextColor(...THEME.inkSoft)
  const introLines = doc.splitTextToSize(copy.intro, PAGE.width - PAGE.margin * 2)
  for (const line of introLines) { doc.text(line, PAGE.margin, y); y += 5.5 }
  y += 8

  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.4)
  doc.line(PAGE.margin, y, PAGE.margin + 24, y)
  y += 14

  const panelTop    = y
  const panelHeight = 60
  doc.setFillColor(...THEME.cream)
  doc.rect(PAGE.margin, panelTop, PAGE.width - PAGE.margin * 2, panelHeight, 'F')

  serif(doc, 'normal', 18)
  doc.setTextColor(...THEME.ink)
  doc.text('At a Glance', PAGE.margin + 8, panelTop + 12)

  const atAGlanceBullets: string[] = variant === 'experiences' && overlay?.at_a_glance_bullets?.length
    ? overlay.at_a_glance_bullets
    : variant === 'experiences'
      ? [
          'A curated selection of standout experiences',
          'Reserved for guests on a curated journey',
          'Availability and logistics guidance included',
        ]
      : [
          'A curated selection of standout tables',
          'Reserved for guests on a curated journey',
          'Reservation guidance included where helpful',
        ]

  let bulletY = panelTop + 22
  for (const b of atAGlanceBullets.slice(0, 3)) {
    sans(doc, 'bold', 14)
    doc.setTextColor(...THEME.gold)
    doc.text('\u00b7', PAGE.margin + 8, bulletY)
    sans(doc, 'normal', 10)
    doc.setTextColor(...THEME.muted)
    doc.text(b, PAGE.margin + 13, bulletY)
    bulletY += 6
  }

  y = panelTop + panelHeight + SPACE.PAGE_PAD

  if (variant === 'dining') {
    const operationalVenues = (venues as DiningVenue[]).filter(
      v => v.venue_status !== 'permanently_closed',
    )
    y = renderRecognitionKey(doc, operationalVenues, y)
  }

  y += SPACE.PAGE_PAD
  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.4)
  doc.line(PAGE.margin, y, PAGE.margin + 24, y)
  y += 16

  renderContentsBlock(ctx, y)
}

function renderRecognitionKey(doc: any, venues: DiningVenue[], y: number): number {
  const present = derivePresentKinds(venues)
  if (present.size === 0) return y

  sans(doc, 'normal', 7.5)
  doc.setTextColor(...THEME.gold)
  doc.text('RECOGNITION', PAGE.margin, y, { charSpace: 0.5 })

  doc.setDrawColor(...THEME.rule)
  doc.setLineWidth(0.15)
  doc.line(PAGE.margin, y + 2, PAGE.width - PAGE.margin, y + 2)

  const itemY = y + 8
  let x = PAGE.margin

  interface KeyItem { render: () => number; label: string }
  const items: KeyItem[] = []

  if (present.has('stars')) {
    items.push({ label: 'Michelin Stars', render: () => {
      const r = 1.5; drawStar(doc, x + r, itemY - 1.5, r, THEME.gold); return r * 2
    }})
  }
  if (present.has('bib')) {
    items.push({ label: 'Bib Gourmand', render: () => {
      const t = 'BIB'; const cs = 0.5; const px = 3
      sans(doc, 'bold', 6.5); doc.setTextColor(...THEME.gold)
      const baseW = doc.getTextWidth(t); const trackW = cs * (t.length - 1)
      const pillW = baseW + trackW + px * 2
      doc.setDrawColor(...THEME.gold); doc.setLineWidth(0.25)
      doc.roundedRect(x, itemY - 2.8, pillW, 4, 1, 1)
      doc.text(t, x + px, itemY - 0.1, { charSpace: cs })
      return pillW
    }})
  }
  if (present.has('green')) {
    items.push({ label: 'Green Star', render: () => {
      const r = 1.5; drawStar(doc, x + r, itemY - 1.5, r, [58, 165, 90] as RGB); return r * 2
    }})
  }
  if (present.has('fifty_best')) {
    items.push({ label: 'World\u2019s 50 Best', render: () => {
      const t = '50 BEST'; const cs = 0.4; const px = 3
      sans(doc, 'bold', 6.5); doc.setTextColor(...THEME.ink)
      const baseW = doc.getTextWidth(t); const trackW = cs * (t.length - 1)
      const pillW = baseW + trackW + px * 2
      doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.25)
      doc.roundedRect(x, itemY - 2.8, pillW, 4, 1, 1)
      doc.text(t, x + px, itemY - 0.1, { charSpace: cs })
      return pillW
    }})
  }

  for (const item of items) {
    const glyphW = item.render()
    sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.muted)
    doc.text(item.label, x + glyphW + 3, itemY)
    x += glyphW + 3 + doc.getTextWidth(item.label) + 10
  }

  return itemY + 4
}

function derivePresentKinds(venues: DiningVenue[]): Set<string> {
  const set = new Set<string>()
  for (const v of venues) {
    if (v.michelin_award === 'star' && v.michelin_stars) set.add('stars')
    if (v.michelin_award === 'bib_gourmand')            set.add('bib')
    if (v.michelin_green_star)                          set.add('green')
    if (v.worlds_50_best)                               set.add('fifty_best')
  }
  return set
}

// ── Contents block ────────────────────────────────────────────────────────────

function renderContentsBlock(ctx: RenderCtx, startY: number): number {
  const { doc, sections } = ctx
  let y = startY

  serif(doc, 'normal', 22)
  doc.setTextColor(...THEME.gold)
  doc.text('Contents', PAGE.margin, y)
  y += 12

  for (const section of sections) {
    const pageStr = section.page > 0 ? String(section.page).padStart(2, '0') : '\u00b7\u00b7'
    sans(doc, 'normal', 10); doc.setTextColor(...THEME.gold)
    doc.text(pageStr, PAGE.margin, y)
    sans(doc, 'normal', 11); doc.setTextColor(...THEME.ink)
    doc.text(section.title, PAGE.margin + 14, y)
    sans(doc, 'normal', 9); doc.setTextColor(...THEME.muted)
    doc.text(section.blurb, PAGE.width - PAGE.margin, y, { align: 'right' })
    y += 4
    doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.15)
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y)
    y += 8
  }
  return y
}

// ── Dining venue grouping ────────────────────────────────────────────────────
// Mirrors DiningGuidePage three-group render:
//   primary           — operational AND NOT is_supplementary
//   supplementary     — operational AND is_supplementary
//   recentlyClosed    — permanently_closed AND closed_visible_until >= today
//   excluded          — permanently_closed AND closed_visible_until < today

interface DiningGroups {
  primary:        DiningVenue[]
  supplementary:  DiningVenue[]
  recentlyClosed: DiningVenue[]
}

function groupDiningVenuesForPdf(venues: DiningVenue[]): DiningGroups {
  const today = new Date().toISOString().slice(0, 10)

  const primary:       DiningVenue[] = []
  const supplementary: DiningVenue[] = []
  const closed:        DiningVenue[] = []

  for (const v of venues) {
    if (v.venue_status === 'permanently_closed') {
      if (v.closed_visible_until && v.closed_visible_until >= today) {
        closed.push(v)
      }
      continue
    }
    if (v.is_supplementary) {
      supplementary.push(v)
    } else {
      primary.push(v)
    }
  }

  const byName = (a: DiningVenue, b: DiningVenue) => a.name.localeCompare(b.name)
  primary.sort(byName)
  supplementary.sort(byName)
  closed.sort(byName)

  return { primary, supplementary, recentlyClosed: closed }
}

// ── Editorial group section break (S52) ──────────────────────────────────────
// Starts a new page and renders the section opening for a venue group.
// Treatment mirrors the web GuideSectionBreak component:
//   - Small eyebrow (gold, uppercase)
//   - Large serif heading
//   - Descriptor (italic muted prose, wrapped)
//   - Gold rule below
// Returns the Y position where venue cards should begin.
//
// This is "chapter break" pacing — each section announces itself as its own
// editorial unit, not a row separator.

function renderGroupSectionBreak(
  doc: any,
  eyebrow: string,
  heading: string,
  descriptor: string,
): number {
  doc.addPage()
  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  // Eyebrow — small uppercase gold
  sans(doc, 'normal', 8.5)
  doc.setTextColor(...THEME.gold)
  doc.text(eyebrow.toUpperCase(), PAGE.margin, y, { charSpace: 0.5 })
  y += SPACE.LEAD_IN + 2

  // Heading — large serif, ink
  serif(doc, 'normal', 28)
  doc.setTextColor(...THEME.ink)
  doc.text(heading, PAGE.margin, y)
  y += 12

  // Descriptor — italic muted, wrapped to comfortable line length
  sans(doc, 'italic', 10.5)
  doc.setTextColor(...THEME.muted)
  const descMaxWidth = Math.min(PAGE.width - PAGE.margin * 2, 140)
  const descLines = doc.splitTextToSize(descriptor, descMaxWidth)
  for (const line of descLines) {
    doc.text(line, PAGE.margin, y)
    y += 5.5
  }
  y += 6

  // Gold rule
  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.4)
  doc.line(PAGE.margin, y, PAGE.margin + 24, y)
  y += SPACE.SUBLINE_TO_BODY + 4

  return y
}

// ── Cards section ─────────────────────────────────────────────────────────────

const CARD = {
  imageWidth:   48,
  imageHeight:  32,
  rowGap:       6,
  rowMinHeight: 38,
  rowPadding:   4,
} as const

async function renderCardsSection(ctx: RenderCtx, venues: any[]) {
  const { doc, destination, variant } = ctx

  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  serif(doc, 'normal', 26)
  doc.setTextColor(...THEME.ink)
  const sectionTitle =
    variant === 'shopping'    ? `Selected shopping in ${destination.name}` :
    variant === 'hotels'      ? `${destination.name} Hotels` :
    variant === 'experiences' ? `${destination.name} Experiences` :
                                `${destination.name} Dining`
  doc.text(sectionTitle, PAGE.margin, y)
  y += SPACE.SECTION_BREATHE

  sans(doc, 'normal', 8.5)
  doc.setTextColor(...THEME.gold)
  const subline =
    variant === 'shopping'    ? 'CURATED BOUTIQUES, MAISONS, AND ATELIERS' :
    variant === 'hotels'      ? 'OUR CURATED SELECTION OF STANDOUT STAYS' :
    variant === 'experiences' ? 'OUR CURATED SELECTION OF STANDOUT EXPERIENCES' :
                                'OUR CURATED SELECTION OF STANDOUT TABLES'
  doc.text(subline, PAGE.margin, y, { charSpace: 0.4 })
  y += SPACE.SUBLINE_TO_BODY

  if (variant === 'dining') {
    y = await renderDiningGroupedCards(ctx, venues as DiningVenue[], y)
  } else {
    y = await renderNonDiningCards(ctx, venues, y)
  }

  const hasFollowingPages =
    ctx.happenings.length > 0 ||
    planYourVisitHasContent(ctx.destination.overlay)
  if (ctx.accuracyDate && !hasFollowingPages) {
    const disclaimerY = Math.max(y + 8, PAGE.footerY - 36)
    renderDisclaimer(doc, ctx.accuracyDate, disclaimerY)
  }
}

// Dining-only path: three groups, each opening on its own page with
// editorial chapter break.
async function renderDiningGroupedCards(ctx: RenderCtx, venues: DiningVenue[], startY: number): Promise<number> {
  const { doc, destination } = ctx
  const groups = groupDiningVenuesForPdf(venues)
  let y = startY

  if (groups.primary.length === 0 &&
      groups.supplementary.length === 0 &&
      groups.recentlyClosed.length === 0) {
    sans(doc, 'italic', 10); doc.setTextColor(...THEME.muted)
    doc.text(`No dining curated for ${destination.name} yet.`, PAGE.margin, y)
    return y
  }

  // Primary group — continues from the main section opening on the current page
  for (const venue of groups.primary) {
    const cardHeight = computeCardHeight(doc, venue, 'dining')
    if (y + cardHeight > PAGE.footerY - 10) {
      doc.addPage()
      doc.setFillColor(...THEME.white)
      doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
      y = PAGE.bodyTop + 8
    }
    await renderCard(doc, venue, y, 'dining')
    y += cardHeight + CARD.rowGap
  }

  // Supplementary group — new page, editorial chapter break
  if (groups.supplementary.length > 0) {
    if (groups.primary.length > 0) {
      y = renderGroupSectionBreak(
        doc,
        'Beyond the Center',
        'Also Nearby',
        `Worth the journey from central ${destination.name}. Tables outside the main circuit, kept here for those who want a fuller picture of the city's dining landscape.`,
      )
    }

    for (const venue of groups.supplementary) {
      const cardHeight = computeCardHeight(doc, venue, 'dining')
      if (y + cardHeight > PAGE.footerY - 10) {
        doc.addPage()
        doc.setFillColor(...THEME.white)
        doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
        y = PAGE.bodyTop + 8
      }
      await renderCard(doc, venue, y, 'dining')
      y += cardHeight + CARD.rowGap
    }
  }

  // Recently closed — new page, editorial chapter break
  if (groups.recentlyClosed.length > 0) {
    const hasPreceding = groups.primary.length > 0 || groups.supplementary.length > 0
    if (hasPreceding) {
      y = renderGroupSectionBreak(
        doc,
        'For Reference',
        'Recently Closed',
        'Tables that have recently closed their doors. Kept here briefly so the record stays current and any prior recommendation has context.',
      )
    }

    for (const venue of groups.recentlyClosed) {
      const cardHeight = computeCardHeight(doc, venue, 'dining')
      if (y + cardHeight > PAGE.footerY - 10) {
        doc.addPage()
        doc.setFillColor(...THEME.white)
        doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
        y = PAGE.bodyTop + 8
      }
      await renderCard(doc, venue, y, 'dining')
      y += cardHeight + CARD.rowGap
    }
  }

  return y
}

// Non-dining path: sequential single-group render.
async function renderNonDiningCards(ctx: RenderCtx, venues: any[], startY: number): Promise<number> {
  const { doc, destination, variant } = ctx
  let y = startY

  if (venues.length === 0) {
    sans(doc, 'italic', 10); doc.setTextColor(...THEME.muted)
    doc.text(`No ${variant} curated for ${destination.name} yet.`, PAGE.margin, y)
    return y
  }

  for (const item of venues) {
    if (variant === 'shopping') {
      const cardHeight = computeShopCardHeight(doc, item as Shop)
      if (y + cardHeight > PAGE.footerY - 10) {
        doc.addPage()
        doc.setFillColor(...THEME.white)
        doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
        y = PAGE.bodyTop + 8
      }
      await renderShopCard(doc, item as Shop, y)
      y += cardHeight + CARD.rowGap
      continue
    }

    if (variant === 'hotels') {
      const cardHeight = computeHotelCardHeight(doc, item as HotelVenue)
      if (y + cardHeight > PAGE.footerY - 10) {
        doc.addPage()
        doc.setFillColor(...THEME.white)
        doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
        y = PAGE.bodyTop + 8
      }
      await renderHotelCard(doc, item as HotelVenue, y)
      y += cardHeight + CARD.rowGap
      continue
    }

    const cardHeight = computeCardHeight(doc, item, variant as 'dining' | 'experiences')
    if (y + cardHeight > PAGE.footerY - 10) {
      doc.addPage()
      doc.setFillColor(...THEME.white)
      doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
      y = PAGE.bodyTop + 8
    }
    await renderCard(doc, item, y, variant as 'dining' | 'experiences')
    y += cardHeight + CARD.rowGap
  }

  return y
}

// ── Dining / Experiences card ─────────────────────────────────────────────────

function computeCardHeight(doc: any, venue: any, variant: 'dining' | 'experiences'): number {
  const textWidth = PAGE.width - PAGE.margin * 2 - CARD.imageWidth - 8
  let textHeight  = 0

  const hasEyebrow = variant === 'dining' ? !!venue.cuisine_subcategory : !!venue.kicker
  if (hasEyebrow) textHeight += SPACE.LEAD_IN
  textHeight += SPACE.IDENTITY_BREATHE

  if (variant === 'dining') {
    const hasRecognition =
      (venue.michelin_award === 'star' && venue.michelin_stars) ||
      venue.michelin_award === 'bib_gourmand' ||
      venue.michelin_green_star ||
      venue.worlds_50_best
    if (hasRecognition)    textHeight += SPACE.CLUSTER_TIGHT
    if (venue.neighborhood) textHeight += SPACE.CLUSTER_TIGHT
  }

  if (venue.body) {
    sans(doc, 'normal', 9.5)
    const bodyLines = doc.splitTextToSize(venue.body, textWidth)
    textHeight += bodyLines.length * 4.4 + SPACE.WITHIN_BODY
  }

  return Math.max(textHeight + CARD.rowPadding * 2, CARD.imageHeight, CARD.rowMinHeight)
}

async function renderCard(doc: any, venue: any, top: number, variant: 'dining' | 'experiences') {
  const cardHeight = computeCardHeight(doc, venue, variant)

  doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.15)
  doc.line(PAGE.margin, top + cardHeight + CARD.rowGap / 2,
           PAGE.width - PAGE.margin, top + cardHeight + CARD.rowGap / 2)

  const imgX = PAGE.margin; const imgY = top + CARD.rowPadding
  let cardImgDrawn = false
  if (venue.image_src) {
    try {
      const imgData = await loadImg(venue.image_src)
      if (imgData) {
        doc.addImage(imgData.data, imgData.format, imgX, imgY, CARD.imageWidth, CARD.imageHeight, undefined, 'FAST')
        cardImgDrawn = true
      }
    } catch { /* fall through */ }
  }
  if (!cardImgDrawn) { drawImageFallback(doc, imgX, imgY, venue.name) }

  const textX = imgX + CARD.imageWidth + 8
  const textWidth = (PAGE.width - PAGE.margin * 2) - CARD.imageWidth - 8
  let ty = top + CARD.rowPadding + 4

  const eyebrow = variant === 'dining' ? venue.cuisine_subcategory : venue.kicker
  if (eyebrow) {
    sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.gold)
    doc.text(eyebrow.toUpperCase(), textX, ty, { charSpace: 0.4 })
    ty += SPACE.LEAD_IN
  }

  serif(doc, 'normal', 18); doc.setTextColor(...THEME.ink)
  doc.text(venue.name, textX, ty)
  ty += SPACE.IDENTITY_BREATHE

  if (variant === 'dining') {
    const hasStars = venue.michelin_award === 'star' && venue.michelin_stars
    const hasBib   = venue.michelin_award === 'bib_gourmand'
    const hasGreen = venue.michelin_green_star
    const hasFifty = venue.worlds_50_best

    if (hasStars || hasBib || hasGreen || hasFifty) {
      let markX = textX

      if (hasStars) {
        const starRadius = 1.7
        const rowW = drawStarRow(doc, markX, ty - 1.7, venue.michelin_stars!, starRadius, THEME.gold)
        markX += rowW + 6
      }
      if (hasBib) {
        const pillText = 'BIB'; const pillCharSpace = 0.5; const pillPaddingX = 3.5
        sans(doc, 'bold', 7); doc.setTextColor(...THEME.gold)
        const baseW = doc.getTextWidth(pillText); const trackW = pillCharSpace * (pillText.length - 1)
        const pillW = baseW + trackW + pillPaddingX * 2
        doc.setDrawColor(...THEME.gold); doc.setLineWidth(0.3)
        doc.roundedRect(markX, ty - 3.2, pillW, 4.4, 1, 1)
        doc.text(pillText, markX + pillPaddingX, ty + 0.2, { charSpace: pillCharSpace })
        markX += pillW + 6
      }
      if (hasGreen) {
        const starRadius = 1.7
        drawStar(doc, markX + starRadius, ty - 1.7, starRadius, [58, 165, 90] as RGB)
        markX += starRadius * 2 + 6
      }
      if (hasFifty) {
        const pillText = '50 BEST'; const pillCharSpace = 0.4; const pillPaddingX = 3.5
        sans(doc, 'bold', 7); doc.setTextColor(...THEME.ink)
        const baseW = doc.getTextWidth(pillText); const trackW = pillCharSpace * (pillText.length - 1)
        const pillW = baseW + trackW + pillPaddingX * 2
        doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.3)
        doc.roundedRect(markX, ty - 3.2, pillW, 4.4, 1, 1)
        doc.text(pillText, markX + pillPaddingX, ty + 0.2, { charSpace: pillCharSpace })
      }
      ty += SPACE.CLUSTER_TIGHT
    }

    if (venue.neighborhood) {
      sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.muted)
      doc.text(venue.neighborhood, textX, ty)
      ty += SPACE.CLUSTER_TIGHT
    }
  }

  if (venue.body) {
    sans(doc, 'normal', 9.5); doc.setTextColor(...THEME.inkSoft)
    const bodyLines = doc.splitTextToSize(venue.body, textWidth)
    for (const line of bodyLines) { doc.text(line, textX, ty); ty += 4.4 }
    ty += SPACE.WITHIN_BODY
  }

  if (venue.address) {
    sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.faint)
    const addrLines  = doc.splitTextToSize(venue.address, textWidth)
    const addrStartY = ty
    for (const line of addrLines) { doc.text(line, textX, ty); ty += 4 }
    if (venue.maps_url) {
      const linkH = ty - addrStartY
      const linkW = Math.min(doc.getTextWidth(addrLines[0], 'Helvetica', 8.5), textWidth)
      try { doc.link(textX, addrStartY - 3, linkW, linkH + 1, { url: venue.maps_url }) } catch {}
    }
  }
}

function drawImageFallback(doc: any, x: number, y: number, name: string) {
  doc.setFillColor(...THEME.fallbackBg)
  doc.rect(x, y, CARD.imageWidth, CARD.imageHeight, 'F')
  serif(doc, 'italic', 12); doc.setTextColor(...THEME.muted)
  const letter = (name?.[0] ?? '\u00b7').toUpperCase()
  doc.text(letter, x + CARD.imageWidth / 2, y + CARD.imageHeight / 2 + 3, { align: 'center' })
}

// ── Shop card ─────────────────────────────────────────────────────────────────

function computeShopCardHeight(doc: any, s: Shop): number {
  const textWidth = PAGE.width - PAGE.margin * 2 - CARD.imageWidth - 8
  let textHeight = 0

  const hasEyebrow = !!s.shop_type || !!s.by_appointment
  if (hasEyebrow) textHeight += SPACE.LEAD_IN
  textHeight += SPACE.IDENTITY_BREATHE

  if (s.body) {
    sans(doc, 'normal', 9.5)
    const bodyLines = doc.splitTextToSize(s.body, textWidth)
    textHeight += bodyLines.length * 4.4 + SPACE.WITHIN_BODY
  }

  const bullets = normalizeShopBullets(s.bullets)
  if (bullets.length > 0) {
    sans(doc, 'normal', 9)
    for (const b of bullets) {
      const lines = doc.splitTextToSize(b, textWidth - 6)
      textHeight += lines.length * 4.2 + SPACE.LINE_TIGHT
    }
    textHeight += SPACE.WITHIN_BODY
  }

  if (s.address) textHeight += SPACE.CLUSTER_TIGHT

  return Math.max(textHeight + CARD.rowPadding * 2, CARD.imageHeight, CARD.rowMinHeight)
}

async function renderShopCard(doc: any, s: Shop, top: number) {
  const cardHeight = computeShopCardHeight(doc, s)

  doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.15)
  doc.line(PAGE.margin, top + cardHeight + CARD.rowGap / 2,
           PAGE.width - PAGE.margin, top + cardHeight + CARD.rowGap / 2)

  const imgX = PAGE.margin; const imgY = top + CARD.rowPadding
  let cardImgDrawn = false
  if (s.image_src) {
    try {
      const imgData = await loadImg(s.image_src)
      if (imgData) {
        doc.addImage(imgData.data, imgData.format, imgX, imgY, CARD.imageWidth, CARD.imageHeight, undefined, 'FAST')
        cardImgDrawn = true
      }
    } catch { /* fall through */ }
  }
  if (!cardImgDrawn) { drawImageFallback(doc, imgX, imgY, s.brand ?? s.name) }

  const textX = imgX + CARD.imageWidth + 8
  const textWidth = (PAGE.width - PAGE.margin * 2) - CARD.imageWidth - 8
  let ty = top + CARD.rowPadding + 4

  const eyebrowParts: string[] = []
  if (s.shop_type)      eyebrowParts.push(s.shop_type.toUpperCase())
  if (s.by_appointment) eyebrowParts.push('BY APPOINTMENT')
  if (eyebrowParts.length > 0) {
    sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.gold)
    doc.text(eyebrowParts.join(' \u00b7 '), textX, ty, { charSpace: 0.4 })
    ty += SPACE.LEAD_IN
  }

  serif(doc, 'normal', 18); doc.setTextColor(...THEME.ink)
  const nameLines = doc.splitTextToSize(s.name, textWidth)
  doc.text(nameLines[0], textX, ty)
  ty += SPACE.IDENTITY_BREATHE

  if (s.body) {
    sans(doc, 'normal', 9.5); doc.setTextColor(...THEME.inkSoft)
    const bodyLines = doc.splitTextToSize(s.body, textWidth)
    for (const line of bodyLines) { doc.text(line, textX, ty); ty += 4.4 }
    ty += SPACE.WITHIN_BODY
  }

  const bullets = normalizeShopBullets(s.bullets)
  if (bullets.length > 0) {
    for (const b of bullets) {
      sans(doc, 'bold', 11); doc.setTextColor(...THEME.gold)
      doc.text('\u00b7', textX, ty)
      sans(doc, 'normal', 9); doc.setTextColor(...THEME.inkSoft)
      const lines = doc.splitTextToSize(b, textWidth - 6)
      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], textX + 4, ty)
        ty += 4.2
      }
      ty += SPACE.LINE_TIGHT
    }
    ty += SPACE.LINE_TIGHT
  }

  if (s.address) {
    sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.faint)
    const addrLines = doc.splitTextToSize(s.address, textWidth)
    const addrStartY = ty
    for (const line of addrLines) { doc.text(line, textX, ty); ty += 4 }
    if (s.maps_url) {
      const linkH = ty - addrStartY
      const linkW = Math.min(doc.getTextWidth(addrLines[0], 'Helvetica', 8.5), textWidth)
      try { doc.link(textX, addrStartY - 3, linkW, linkH + 1, { url: s.maps_url }) } catch {}
    }
  }
}

function normalizeShopBullets(bullets: Shop['bullets']): string[] {
  if (!Array.isArray(bullets)) return []
  return bullets
    .map(b => typeof b === 'string' ? b : (b?.text ?? ''))
    .filter(Boolean)
}

// ── Hotel card ────────────────────────────────────────────────────────────────

function normalizeHotelBullets(bullets: HotelVenue['bullets']): string[] {
  if (!Array.isArray(bullets)) return []
  return bullets
    .map(b => typeof b === 'string' ? b : (b && typeof b === 'object' && 'text' in b ? (b as { text: string }).text : ''))
    .filter(Boolean)
}

function computeHotelCardHeight(doc: any, h: HotelVenue): number {
  const textWidth = PAGE.width - PAGE.margin * 2 - CARD.imageWidth - 8
  let textHeight = 0

  textHeight += SPACE.LEAD_IN
  textHeight += SPACE.IDENTITY_BREATHE

  const hasRecognition =
    (h.stars && h.stars > 0) ||
    (h.michelin_keys && h.michelin_keys > 0) ||
    (h.forbes_rating && h.forbes_rating > 0)
  if (hasRecognition) textHeight += SPACE.CLUSTER_TIGHT

  if (h.city) textHeight += SPACE.CLUSTER_TIGHT

  if (h.description) {
    sans(doc, 'normal', 9.5)
    const bodyLines = doc.splitTextToSize(h.description, textWidth)
    textHeight += bodyLines.length * 4.4 + SPACE.WITHIN_BODY
  }

  const bullets = normalizeHotelBullets(h.bullets)
  if (bullets.length > 0) {
    sans(doc, 'normal', 9)
    for (const b of bullets) {
      const lines = doc.splitTextToSize(b, textWidth - 6)
      textHeight += lines.length * 4.2 + SPACE.LINE_TIGHT
    }
    textHeight += SPACE.WITHIN_BODY
  }

  if (h.address) textHeight += SPACE.CLUSTER_TIGHT

  return Math.max(textHeight + CARD.rowPadding * 2, CARD.imageHeight, CARD.rowMinHeight)
}

async function renderHotelCard(doc: any, h: HotelVenue, top: number) {
  const cardHeight = computeHotelCardHeight(doc, h)

  doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.15)
  doc.line(PAGE.margin, top + cardHeight + CARD.rowGap / 2,
           PAGE.width - PAGE.margin, top + cardHeight + CARD.rowGap / 2)

  const imgX = PAGE.margin; const imgY = top + CARD.rowPadding
  let cardImgDrawn = false
  if (h.hero_image_src) {
    try {
      const imgData = await loadImg(h.hero_image_src)
      if (imgData) {
        doc.addImage(imgData.data, imgData.format, imgX, imgY, CARD.imageWidth, CARD.imageHeight, undefined, 'FAST')
        cardImgDrawn = true
      }
    } catch { /* fall through */ }
  }
  if (!cardImgDrawn) { drawImageFallback(doc, imgX, imgY, h.name) }

  const textX = imgX + CARD.imageWidth + 8
  const textWidth = (PAGE.width - PAGE.margin * 2) - CARD.imageWidth - 8
  let ty = top + CARD.rowPadding + 4

  const eyebrowParts: string[] = []
  if (h.is_preferred_partner) eyebrowParts.push('PREFERRED PARTNER')
  if (eyebrowParts.length > 0) {
    sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.gold)
    doc.text(eyebrowParts.join(' \u00b7 '), textX, ty, { charSpace: 0.4 })
  }
  ty += SPACE.LEAD_IN

  serif(doc, 'normal', 18); doc.setTextColor(...THEME.ink)
  const nameLines = doc.splitTextToSize(h.name, textWidth)
  doc.text(nameLines[0], textX, ty)
  ty += SPACE.IDENTITY_BREATHE

  const starCount    = h.stars ?? 0
  const michelinKeys = h.michelin_keys ?? 0
  const forbesRating = h.forbes_rating ?? 0
  if (starCount > 0 || michelinKeys > 0 || forbesRating > 0) {
    let markX = textX

    if (starCount > 0) {
      const starRadius = 1.7
      const rowW = drawStarRow(doc, markX, ty - 1.7, starCount, starRadius, THEME.gold)
      markX += rowW + 6
    }
    if (michelinKeys > 0) {
      const t = `${michelinKeys} ${michelinKeys === 1 ? 'KEY' : 'KEYS'}`
      const cs = 0.4; const px = 3.5
      sans(doc, 'bold', 7); doc.setTextColor(...THEME.gold)
      const baseW = doc.getTextWidth(t); const trackW = cs * (t.length - 1)
      const pillW = baseW + trackW + px * 2
      doc.setDrawColor(...THEME.gold); doc.setLineWidth(0.3)
      doc.roundedRect(markX, ty - 3.2, pillW, 4.4, 1, 1)
      doc.text(t, markX + px, ty + 0.2, { charSpace: cs })
      markX += pillW + 6
    }
    if (forbesRating > 0) {
      const t = `FORBES ${forbesRating}`
      const cs = 0.4; const px = 3.5
      sans(doc, 'bold', 7); doc.setTextColor(...THEME.ink)
      const baseW = doc.getTextWidth(t); const trackW = cs * (t.length - 1)
      const pillW = baseW + trackW + px * 2
      doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.3)
      doc.roundedRect(markX, ty - 3.2, pillW, 4.4, 1, 1)
      doc.text(t, markX + px, ty + 0.2, { charSpace: cs })
    }
    ty += SPACE.CLUSTER_TIGHT
  }

  if (h.city) {
    sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.muted)
    doc.text(h.city, textX, ty)
    ty += SPACE.CLUSTER_TIGHT
  }

  if (h.description) {
    sans(doc, 'normal', 9.5); doc.setTextColor(...THEME.inkSoft)
    const bodyLines = doc.splitTextToSize(h.description, textWidth)
    for (const line of bodyLines) { doc.text(line, textX, ty); ty += 4.4 }
    ty += SPACE.WITHIN_BODY
  }

  const bullets = normalizeHotelBullets(h.bullets)
  if (bullets.length > 0) {
    for (const b of bullets) {
      sans(doc, 'bold', 11); doc.setTextColor(...THEME.gold)
      doc.text('\u00b7', textX, ty)
      sans(doc, 'normal', 9); doc.setTextColor(...THEME.inkSoft)
      const lines = doc.splitTextToSize(b, textWidth - 6)
      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], textX + 4, ty)
        ty += 4.2
      }
      ty += SPACE.LINE_TIGHT
    }
    ty += SPACE.LINE_TIGHT
  }

  if (h.address) {
    sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.faint)
    const addrLines  = doc.splitTextToSize(h.address, textWidth)
    const addrStartY = ty
    for (const line of addrLines) { doc.text(line, textX, ty); ty += 4 }
    if (h.google_maps_url) {
      const linkH = ty - addrStartY
      const linkW = Math.min(doc.getTextWidth(addrLines[0], 'Helvetica', 8.5), textWidth)
      try { doc.link(textX, addrStartY - 3, linkW, linkH + 1, { url: h.google_maps_url }) } catch {}
    }
  }
}

// ── Happenings section ────────────────────────────────────────────────────────

async function renderHappeningsSection(ctx: RenderCtx) {
  const { doc, destination, happenings } = ctx

  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  serif(doc, 'normal', 26)
  doc.setTextColor(...THEME.ink)
  doc.text(`Coming up in ${destination.name}`, PAGE.margin, y)
  y += SPACE.SECTION_BREATHE

  sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.gold)
  doc.text('A SNAPSHOT OF WHAT\u2019S ON THIS SEASON', PAGE.margin, y, { charSpace: 0.4 })
  y += SPACE.SUBLINE_TO_BODY

  for (const happening of happenings) {
    const cardHeight = computeHappeningCardHeight(doc, happening)
    if (y + cardHeight > PAGE.footerY - 10) {
      doc.addPage()
      doc.setFillColor(...THEME.white)
      doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
      y = PAGE.bodyTop + 8
    }
    await renderHappeningCard(doc, happening, y)
    y += cardHeight + CARD.rowGap
  }

  if (ctx.accuracyDate && !planYourVisitHasContent(ctx.destination.overlay)) {
    const disclaimerY = Math.max(y + 8, PAGE.footerY - 36)
    renderDisclaimer(doc, ctx.accuracyDate, disclaimerY)
  }
}

function computeHappeningCardHeight(doc: any, h: Happening): number {
  const textWidth = PAGE.width - PAGE.margin * 2 - CARD.imageWidth - 8
  let textHeight  = 0

  textHeight += SPACE.LEAD_IN
  textHeight += SPACE.META_TO_NAME
  textHeight += SPACE.IDENTITY_BREATHE

  if (h.tagline) {
    sans(doc, 'italic', 9.5)
    const taglineLines = doc.splitTextToSize(h.tagline, textWidth)
    textHeight += taglineLines.length * 4.2 + SPACE.WITHIN_BODY
  }

  if (h.body) {
    sans(doc, 'normal', 9.5)
    const bodyLines = doc.splitTextToSize(h.body, textWidth)
    textHeight += bodyLines.length * 4.4 + SPACE.WITHIN_BODY
  }

  const bullets = normalizeHappeningBullets(h.bullets)
  if (bullets.length > 0) {
    sans(doc, 'normal', 9)
    for (const b of bullets) {
      const lines = doc.splitTextToSize(b, textWidth - 6)
      textHeight += lines.length * 4.2 + SPACE.LINE_TIGHT
    }
    textHeight += SPACE.WITHIN_BODY
  }

  if (h.venue_name) textHeight += SPACE.CLUSTER_TIGHT
  if (h.address)    textHeight += SPACE.CLUSTER_TIGHT

  return Math.max(textHeight + CARD.rowPadding * 2, CARD.imageHeight, CARD.rowMinHeight)
}

async function renderHappeningCard(doc: any, h: Happening, top: number) {
  const cardHeight = computeHappeningCardHeight(doc, h)

  doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.15)
  doc.line(PAGE.margin, top + cardHeight + CARD.rowGap / 2,
           PAGE.width - PAGE.margin, top + cardHeight + CARD.rowGap / 2)

  const imgX = PAGE.margin; const imgY = top + CARD.rowPadding
  let cardImgDrawn = false
  if (h.image_src) {
    try {
      const imgData = await loadImg(h.image_src)
      if (imgData) {
        doc.addImage(imgData.data, imgData.format, imgX, imgY, CARD.imageWidth, CARD.imageHeight, undefined, 'FAST')
        cardImgDrawn = true
      }
    } catch { /* fall through */ }
  }
  if (!cardImgDrawn) { drawImageFallback(doc, imgX, imgY, h.name) }

  const textX     = imgX + CARD.imageWidth + 8
  const textWidth = (PAGE.width - PAGE.margin * 2) - CARD.imageWidth - 8
  let ty = top + CARD.rowPadding + 4

  const isSingleDay = h.start_date === h.end_date
  const tag = isSingleDay ? 'ONE EVENING' : 'LIMITED DATES'
  const eyebrowText = h.category ? `${tag} \u00b7 ${h.category.toUpperCase()}` : tag
  sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.gold)
  doc.text(eyebrowText, textX, ty, { charSpace: 0.4 })
  ty += SPACE.LEAD_IN

  serif(doc, 'italic', 11); doc.setTextColor(...THEME.gold)
  doc.text(formatHappeningDateRange(h.start_date, h.end_date), textX, ty)
  ty += SPACE.META_TO_NAME

  serif(doc, 'normal', 18); doc.setTextColor(...THEME.ink)
  const nameLines = doc.splitTextToSize(h.name, textWidth)
  doc.text(nameLines[0], textX, ty)
  ty += SPACE.IDENTITY_BREATHE

  if (h.tagline) {
    sans(doc, 'italic', 9.5); doc.setTextColor(...THEME.inkSoft)
    const taglineLines = doc.splitTextToSize(h.tagline, textWidth - 4)
    const taglineStartY = ty - 3
    for (const line of taglineLines) { doc.text(line, textX + 4, ty); ty += 4.2 }
    const taglineEndY = ty
    doc.setDrawColor(...THEME.gold); doc.setLineWidth(0.6)
    doc.line(textX, taglineStartY, textX, taglineEndY - 1)
    ty += SPACE.WITHIN_BODY
  }

  if (h.body) {
    sans(doc, 'normal', 9.5); doc.setTextColor(...THEME.inkSoft)
    const bodyLines = doc.splitTextToSize(h.body, textWidth)
    for (const line of bodyLines) { doc.text(line, textX, ty); ty += 4.4 }
    ty += SPACE.WITHIN_BODY
  }

  const bullets = normalizeHappeningBullets(h.bullets)
  if (bullets.length > 0) {
    for (const b of bullets) {
      sans(doc, 'bold', 11); doc.setTextColor(...THEME.gold)
      doc.text('\u00b7', textX, ty)
      sans(doc, 'normal', 9); doc.setTextColor(...THEME.inkSoft)
      const lines = doc.splitTextToSize(b, textWidth - 6)
      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], textX + 4, ty)
        ty += 4.2
      }
      ty += SPACE.LINE_TIGHT
    }
    ty += SPACE.LINE_TIGHT
  }

  if (h.venue_name) {
    sans(doc, 'bold', 8.5); doc.setTextColor(...THEME.muted)
    doc.text(h.venue_name, textX, ty)
    ty += SPACE.CLUSTER_TIGHT
  }
  if (h.address) {
    sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.faint)
    const addrLines  = doc.splitTextToSize(h.address, textWidth)
    const addrStartY = ty
    for (const line of addrLines) { doc.text(line, textX, ty); ty += 4 }
    if (h.maps_url) {
      const linkH = ty - addrStartY
      const linkW = Math.min(doc.getTextWidth(addrLines[0], 'Helvetica', 8.5), textWidth)
      try { doc.link(textX, addrStartY - 3, linkW, linkH + 1, { url: h.maps_url }) } catch {}
    }
  }
}

function normalizeHappeningBullets(bullets: Happening['bullets']): string[] {
  if (!Array.isArray(bullets)) return []
  return bullets
    .map(b => typeof b === 'string' ? b : (b?.text ?? ''))
    .filter(Boolean)
}

function formatHappeningDateRange(startISO: string, endISO: string): string {
  const start = parseISODate(startISO)
  const end   = parseISODate(endISO)
  if (startISO === endISO) return formatFullDate(start)
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}\u2013${end.day} ${MONTHS[start.month]} ${start.year}`
  }
  if (start.year === end.year) {
    return `${start.day} ${MONTHS[start.month]} \u2013 ${end.day} ${MONTHS[end.month]} ${start.year}`
  }
  return `${formatFullDate(start)} \u2013 ${formatFullDate(end)}`
}

function parseISODate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function formatFullDate(d: { year: number; month: number; day: number }): string {
  return `${d.day} ${MONTHS[d.month]} ${d.year}`
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Closing page ──────────────────────────────────────────────────────────────

function renderClosingPage(ctx: RenderCtx) {
  const { doc, destination } = ctx
  const overlay = destination.overlay as any

  const heading = overlay?.plan_your_visit_heading?.trim() || 'Plan Your Visit'
  const intro   = overlay?.plan_your_visit_intro?.trim() ?? ''
  const bullets = overlay?.plan_your_visit_bullets ?? []

  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  serif(doc, 'normal', 26); doc.setTextColor(...THEME.ink)
  doc.text(heading, PAGE.margin, y)
  y += SPACE.SECTION_BREATHE

  sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.gold)
  doc.text('INSIDER TIPS FOR A SEAMLESS EXPERIENCE', PAGE.margin, y, { charSpace: 0.4 })
  y += SPACE.SUBLINE_TO_BODY

  if (intro) {
    sans(doc, 'normal', 11); doc.setTextColor(...THEME.inkSoft)
    const wrapped = doc.splitTextToSize(intro, PAGE.width - PAGE.margin * 2)
    for (const line of wrapped) { doc.text(line, PAGE.margin, y); y += 5.5 }
    y += SPACE.WITHIN_BODY
  }

  if (bullets.length > 0) {
    const bulletWidth = PAGE.width - PAGE.margin * 2 - 8
    for (const bullet of bullets) {
      const trimmed = bullet?.trim()
      if (!trimmed) continue
      const wrapped = doc.splitTextToSize(trimmed, bulletWidth)
      sans(doc, 'bold', 14); doc.setTextColor(...THEME.gold)
      doc.text('\u00b7', PAGE.margin, y)
      sans(doc, 'normal', 11); doc.setTextColor(...THEME.inkSoft)
      for (const line of wrapped) { doc.text(line, PAGE.margin + 6, y); y += 5.5 }
      y += 2
    }
  }

  if (ctx.accuracyDate) {
    y += 12
    doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.15)
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y)
    y += 8
    renderDisclaimer(doc, ctx.accuracyDate, y)
  }
}

// ── Disclaimer ────────────────────────────────────────────────────────────────

function renderDisclaimer(doc: any, accuracyDate: string, startY: number) {
  const text =
    `The venues listed in this guide reflect our knowledge as of ${accuracyDate}. ` +
    `Availability, pricing, and operators change. ` +
    `ambience makes every effort to keep this information current but cannot guarantee its accuracy ` +
    `at the time of reading. This guide, including any exported PDF, is provided for inspiration and planning purposes only.`

  sans(doc, 'italic', 7.5); doc.setTextColor(...THEME.faint)
  const lines = doc.splitTextToSize(text, PAGE.width - PAGE.margin * 2)
  let y = startY
  for (const line of lines) {
    if (y > PAGE.footerY - 6) break
    doc.text(line, PAGE.margin, y); y += 4
  }
}

// ── Page chrome ───────────────────────────────────────────────────────────────

function stampPageChrome(ctx: RenderCtx) {
  const { doc, destination, variant, logo, guideYear } = ctx
  const pageCount = doc.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    if (i > 1) {
      const eyebrowText = `${destination.name.toUpperCase()} \u00b7 ${variant.toUpperCase()} GUIDE`
      sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.gold)
      doc.text(eyebrowText, PAGE.margin, 14, { charSpace: 0.5 })
      doc.text(String(i).padStart(2, '0'), PAGE.width - PAGE.margin, 14, { align: 'right' })
      doc.setDrawColor(...THEME.gold); doc.setLineWidth(0.2)
      doc.line(PAGE.margin, 18, PAGE.width - PAGE.margin, 18)
    }

    drawRule(doc, PAGE.margin, PAGE.footerY, PAGE.width - PAGE.margin * 2, THEME.rule, 0.15)

    if (ctx.logoVariant === 'alfaone') {
      serif(doc, 'normal', 9)
      doc.setTextColor(...THEME.gold)
      doc.text('AlfaOne Concierge', PAGE.margin, PAGE.footerY + 8)
      try { doc.link(PAGE.margin, PAGE.footerY + 3, 40, 7, { url: AMBIENCE_URL }) } catch {}
    }
    if (ctx.logoVariant === 'ambience' && logo) {
      const logoH = 7; const logoW = logoH * 3.0
      const logoX = PAGE.margin; const logoY = PAGE.footerY + 3
      doc.addImage(logo.data, logo.format, logoX, logoY, logoW, logoH, undefined, 'FAST')
      try { doc.link(logoX, logoY, logoW, logoH, { url: AMBIENCE_URL }) } catch {}
    }

    if (ctx.logoVariant !== 'unbranded') {
      sans(doc, 'italic', 7.5); doc.setTextColor(...THEME.muted)
      doc.text(RESTRICTION_NOTICE, PAGE.width / 2, PAGE.footerY + 7.5, { align: 'center' })

      sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.faint)
      doc.text(`\u00a9 ${guideYear} ambience.travel`, PAGE.width - PAGE.margin, PAGE.footerY + 7.5, { align: 'right' })
    }
  }
}