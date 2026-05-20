// guidePdf.ts — PDF export for guide pages (dining + experiences)
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Cover page (full-bleed hero image, big title with year + version, emblem)
//   - Welcome page (welcome copy + at-a-glance bullets)
//   - Contents page (auto-generated from sections present)
//   - Card list section (manual layout, page-break-aware)
//   - Closing chrome (logo + restriction notice + copyright per page)
//   - Accuracy disclaimer block (gated on accuracyDate non-null)
//   - Filename construction
//
// What it does not own:
//   - Library loading (usePdfDownload hook owns this)
//   - Filter state (PDF renders the full unfiltered venue set)
//   - Image loading, SVG rasterisation, font helpers, draw helpers (pdfUtils.ts)
//
// Variants:
//   dining      — DiningVenue[], recognition marks, cuisine/neighborhood meta
//   experiences — ExperienceVenue[], no recognition marks, kicker in eyebrow slot,
//                 at_a_glance_bullets from overlay on welcome page
//
// Last updated: S48 — refactored to import shared primitives from pdfUtils.ts.
//   Removed: setSerif, setSans, drawStar, drawStarRow, loadImageAsDataUrl,
//   rasterizeSvgAsDataUrl, local ImageData interface, inline jsPDF guard.
//   All replaced by imports from pdfUtils. RenderCtx emblem/logo now typed as Img.
// Prior: S41 — Added experiences variant.
// Prior: S39 — Added accuracyDate.
// Prior: S37 — Welcome + Contents merged. Source Sans 3 Light embedded.

import type { DiningVenue, GuideDestination } from './queriesGuidesDining'
import type { ExperienceVenue, ExperiencesGuideDestination } from './queriesGuidesExperiences'
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

const ASSET_PATHS = {
  emblem:  '/emblem.png',
  logoSvg: '/ambience_travel.svg',
} as const

const AMBIENCE_URL       = 'https://ambience.travel'
const RESTRICTION_NOTICE = 'This guide is for ambience and its guests only.'

// ── Public API ───────────────────────────────────────────────────────────────

export type ExportGuidePdfOptions =
  | {
      variant:      'dining'
      destination:  GuideDestination
      venues:       DiningVenue[]
      copy:         { eyebrow: string; headline: string; intro: string }
      heroImageSrc?: string | null
      guideYear:    number
      guideVersion: string
      accuracyDate: string | null
    }
  | {
      variant:      'experiences'
      destination:  ExperiencesGuideDestination
      venues:       ExperienceVenue[]
      copy:         { eyebrow: string; headline: string; intro: string }
      heroImageSrc?: string | null
      guideYear:    number
      guideVersion: string
      accuracyDate: string | null
    }

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
    sections:     buildSections(opts),
    venues:       opts.venues as any[],
    accuracyDate: opts.accuracyDate,
  }

  await renderCoverPage(ctx)
  doc.addPage(); renderWelcomePage(ctx)
  doc.addPage(); await renderCardsSection(ctx, opts.venues as any[])

  if (planYourVisitHasContent(overlay)) {
    doc.addPage()
    renderClosingPage(ctx)
  }

  stampPageChrome(ctx)
  doc.save(buildFilename(opts.destination.slug, opts.variant, opts.guideYear, opts.guideVersion))
}

function planYourVisitHasContent(overlay: any): boolean {
  if (!overlay) return false
  return !!(overlay.plan_your_visit_intro?.trim()) || !!(overlay.plan_your_visit_bullets?.length)
}

// ── Render context ────────────────────────────────────────────────────────────

interface RenderCtx {
  doc:          any
  destination:  any
  variant:      'dining' | 'experiences'
  copy:         { eyebrow: string; headline: string; intro: string }
  heroImageSrc: string | null
  guideYear:    number
  guideVersion: string
  emblem:       Img | null
  logo:         Img | null
  sections:     ContentsSection[]
  venues:       any[]
  accuracyDate: string | null
}

interface ContentsSection {
  page:  number
  title: string
  blurb: string
}

function buildSections(opts: ExportGuidePdfOptions): ContentsSection[] {
  const overlay  = opts.destination.overlay as any
  const destName = opts.destination.name
  const isExp    = opts.variant === 'experiences'

  const items: ContentsSection[] = [
    { page: 2, title: `Welcome to ${destName}`, blurb: 'A note on the destination and our selection' },
    { page: 3, title: isExp ? `${destName} Experiences` : `${capitalize(opts.variant)} Highlights`,
                      blurb: isExp ? 'Our curated selection of standout experiences' : 'Our curated selection of standout tables' },
  ]
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

function buildFilename(slug: string, variant: string, year: number, version: string): string {
  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mm    = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy  = today.getFullYear()
  const safeV = version.replace(/[^a-zA-Z0-9.]/g, '')
  return `ambienceTRAVEL-${slug}-${variant}-guide-${year}-v${safeV}-${dd}${mm}${yyyy}.pdf`
}

// ── Cover page ────────────────────────────────────────────────────────────────

async function renderCoverPage(ctx: RenderCtx) {
  const { doc, destination, copy, heroImageSrc, emblem, logo, guideYear, guideVersion, variant } = ctx

  doc.setFillColor(...THEME.cream)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  if (emblem) {
    const size = 14
    doc.addImage(emblem.data, emblem.format, PAGE.width / 2 - size / 2, 18, size, size, undefined, 'FAST')
  }
  if (logo) {
    const logoH = 12; const logoW = logoH * 3.0
    doc.addImage(logo.data, logo.format, PAGE.width / 2 - logoW / 2, 36, logoW, logoH, undefined, 'FAST')
  }

  const titleY = 74
  serif(doc, 'normal', 42)
  doc.setTextColor(...THEME.ink)
  const titleText  = `${destination.name} ${capitalize(variant)} Guide ${guideYear}`
  const titleLines = doc.splitTextToSize(titleText, PAGE.width - PAGE.margin * 2 - 8)
  let yCursor = titleY
  for (let i = 0; i < Math.min(titleLines.length, 3); i++) {
    doc.text(titleLines[i], PAGE.margin + 4, yCursor)
    yCursor += 15
  }

  sans(doc, 'normal', 9)
  doc.setTextColor(...THEME.gold)
  doc.text(`V${guideVersion.toUpperCase()}`, PAGE.margin + 4, yCursor + 2, { charSpace: 0.6 })

  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.6)
  doc.line(PAGE.margin + 4, yCursor + 8, PAGE.margin + 28, yCursor + 8)

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

  // At-a-glance panel
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

  y = panelTop + panelHeight + 14

  if (variant === 'dining') {
    y = renderRecognitionKey(doc, venues as DiningVenue[], y)
  }

  y += 14
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
    const pageStr = section.page > 0 ? String(section.page).padStart(2, '0') : '··'
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
  const sectionTitle = variant === 'experiences'
    ? `${destination.name} Experiences`
    : `${capitalize(variant)} Highlights`
  doc.text(sectionTitle, PAGE.margin, y)
  y += 5

  sans(doc, 'normal', 8.5)
  doc.setTextColor(...THEME.gold)
  const subline = variant === 'experiences'
    ? 'OUR CURATED SELECTION OF STANDOUT EXPERIENCES'
    : 'OUR CURATED SELECTION OF STANDOUT TABLES'
  doc.text(subline, PAGE.margin, y, { charSpace: 0.4 })
  y += 12

  if (venues.length === 0) {
    sans(doc, 'italic', 10); doc.setTextColor(...THEME.muted)
    doc.text(`No ${variant} curated for ${destination.name} yet.`, PAGE.margin, y)
    return
  }

  for (const venue of venues) {
    const cardHeight = computeCardHeight(doc, venue, variant)
    if (y + cardHeight > PAGE.footerY - 10) {
      doc.addPage()
      doc.setFillColor(...THEME.white)
      doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
      y = PAGE.bodyTop + 8
    }
    await renderCard(doc, venue, y, variant)
    y += cardHeight + CARD.rowGap
  }

  if (ctx.accuracyDate && !planYourVisitHasContent(ctx.destination.overlay)) {
    const disclaimerY = Math.max(y + 8, PAGE.footerY - 36)
    renderDisclaimer(doc, ctx.accuracyDate, disclaimerY)
  }
}

function computeCardHeight(doc: any, venue: any, variant: 'dining' | 'experiences'): number {
  const textWidth = PAGE.width - PAGE.margin * 2 - CARD.imageWidth - 8
  let textHeight  = 0

  textHeight += 6 // eyebrow / kicker
  textHeight += 6 // name

  if (variant === 'dining') {
    const hasRecognition =
      (venue.michelin_award === 'star' && venue.michelin_stars) ||
      venue.michelin_award === 'bib_gourmand' ||
      venue.michelin_green_star ||
      venue.worlds_50_best
    if (hasRecognition) textHeight += 6
    if (venue.neighborhood) textHeight += 5
  }

  if (venue.body) {
    sans(doc, 'normal', 9.5)
    const bodyLines = doc.splitTextToSize(venue.body, textWidth)
    textHeight += bodyLines.length * 4.4 + 2
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
    } catch { /* fall through to fallback */ }
  }
  if (!cardImgDrawn) { drawImageFallback(doc, imgX, imgY, venue.name) }

  const textX = imgX + CARD.imageWidth + 8
  const textWidth = (PAGE.width - PAGE.margin * 2) - CARD.imageWidth - 8
  let ty = top + CARD.rowPadding + 4

  const eyebrow = variant === 'dining' ? venue.cuisine_subcategory : venue.kicker
  if (eyebrow) {
    sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.gold)
    doc.text(eyebrow.toUpperCase(), textX, ty, { charSpace: 0.4 })
    ty += 6
  }

  serif(doc, 'normal', 18); doc.setTextColor(...THEME.ink)
  doc.text(venue.name, textX, ty)
  ty += 6

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
      ty += 6
    }

    if (venue.neighborhood) {
      sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.muted)
      doc.text(venue.neighborhood, textX, ty)
      ty += 5
    }
  }

  if (venue.body) {
    sans(doc, 'normal', 9.5); doc.setTextColor(...THEME.inkSoft)
    const bodyLines = doc.splitTextToSize(venue.body, textWidth)
    for (const line of bodyLines) { doc.text(line, textX, ty); ty += 4.4 }
    ty += 1
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
  y += 5

  sans(doc, 'normal', 8.5); doc.setTextColor(...THEME.gold)
  doc.text('INSIDER TIPS FOR A SEAMLESS EXPERIENCE', PAGE.margin, y, { charSpace: 0.4 })
  y += 14

  if (intro) {
    sans(doc, 'normal', 11); doc.setTextColor(...THEME.inkSoft)
    const wrapped = doc.splitTextToSize(intro, PAGE.width - PAGE.margin * 2)
    for (const line of wrapped) { doc.text(line, PAGE.margin, y); y += 5.5 }
    y += 4
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
      const eyebrowText = `${destination.name.toUpperCase()} ${variant.toUpperCase()} GUIDE`
      sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.gold)
      doc.text(eyebrowText, PAGE.margin, 14, { charSpace: 0.5 })
      doc.text(String(i).padStart(2, '0'), PAGE.width - PAGE.margin, 14, { align: 'right' })
      doc.setDrawColor(...THEME.gold); doc.setLineWidth(0.2)
      doc.line(PAGE.margin, 18, PAGE.width - PAGE.margin, 18)
    }

    drawRule(doc, PAGE.margin, PAGE.footerY, PAGE.width - PAGE.margin * 2, THEME.rule, 0.15)

    if (logo) {
      const logoH = 7; const logoW = logoH * 3.0
      const logoX = PAGE.margin; const logoY = PAGE.footerY + 3
      doc.addImage(logo.data, logo.format, logoX, logoY, logoW, logoH, undefined, 'FAST')
      try { doc.link(logoX, logoY, logoW, logoH, { url: AMBIENCE_URL }) } catch {}
    }

    sans(doc, 'italic', 7.5); doc.setTextColor(...THEME.muted)
    doc.text(RESTRICTION_NOTICE, PAGE.width / 2, PAGE.footerY + 7.5, { align: 'center' })

    sans(doc, 'normal', 7.5); doc.setTextColor(...THEME.faint)
    doc.text(`© ${guideYear} ambience.travel`, PAGE.width - PAGE.margin, PAGE.footerY + 7.5, { align: 'right' })
  }
}