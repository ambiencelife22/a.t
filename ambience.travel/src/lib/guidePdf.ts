// guidePdf.ts — PDF export for guide pages (dining v1, hotels/experiences later)
// What it owns:
//   - jsPDF lifecycle (load libs, register fonts, page chrome, save)
//   - Cover page (full-bleed hero, serif title, gold rule, intro, tagline footer)
//   - Welcome page (welcome copy + at-a-glance bullets)
//   - Contents page (auto-generated from sections present)
//   - Card list section (manual layout, page-break-aware)
//   - Closing chrome (footer rule + AMBIENCE.COM mark per page)
//   - Filename construction
//
// What it does not own:
//   - Library loading (caller passes pdfReady boolean — DiningGuidePage owns the
//     loader effect, mirroring the sports-side pattern)
//   - Hotel/experience guide shape (variant: 'dining' for now — extend later)
//   - Filter state (PDF renders the full unfiltered venue set; filters live in UI)
//
// Design canon:
//   - Light theme: cream cover bg (#F6F1E8), white content pages, gold (#d8b56a) accents
//   - Cormorant Garamond for headlines + venue names; Helvetica for body
//   - A4 portrait, 14mm side margins (matches sports)
//   - Cards never split across pages — explicit pre-flight height check before each
//   - DB is canon: renders only fields present on DiningVenue
//
// Last updated: S37 — Initial ship.

import type { DiningVenue, GuideDestination } from './diningGuideQueries'
import { loadGuideFonts, registerGuideFonts, PDF_FONTS } from './guidePdfFonts'

// ── Theme ────────────────────────────────────────────────────────────────────
// Light, print-grade. Mirrors mock-up.

const THEME = {
  // Backgrounds
  cream:    [246, 241, 232] as RGB,  // cover bg + welcome bg (#F6F1E8 → IMMERSE.lightSurface)
  white:    [255, 255, 255] as RGB,  // content page bg
  paper:    [252, 250, 244] as RGB,  // very subtle alt — cards, soft panels

  // Ink
  ink:      [26,  29,  26]  as RGB,  // primary text — IMMERSE.textOnLight (#1A1D1A)
  inkSoft:  [60,  66,  60]  as RGB,  // body copy slightly relaxed
  muted:    [90,  106, 90]  as RGB,  // IMMERSE.mutedOnLight (#5A6A5A)
  faint:    [140, 140, 140] as RGB,  // page numbers, footer

  // Brand
  gold:     [216, 181, 106] as RGB,  // ID.gold (#d8b56a)
  goldSoft: [184, 150, 12]  as RGB,  // for thin rules
  rule:     [220, 215, 205] as RGB,  // hairline borders

  // Image fallback
  fallbackBg: [240, 233, 218] as RGB,
} as const

type RGB = [number, number, number]

// ── Layout ───────────────────────────────────────────────────────────────────

const PAGE = {
  width:      210,    // A4
  height:     297,
  margin:     16,
  topChrome:  22,     // eyebrow strip occupies y=0..22
  bodyTop:    32,     // first usable y for content
  footerY:    284,    // footer rule at this y
  footerText: 289,    // footer text at this y
} as const

// ── Public API ───────────────────────────────────────────────────────────────

export interface ExportGuidePdfOptions {
  destination: GuideDestination
  venues: DiningVenue[]
  variant: 'dining'  // future: 'hotels' | 'experiences'
  /** Optional emblem image; if provided, used in chrome. Falls back to text wordmark. */
  emblemImg?: HTMLImageElement | null
  /** Eyebrow + headline + intro from the page (already resolved against overlay). */
  copy: {
    eyebrow:  string
    headline: string
    intro:    string
  }
  /** Optional hero image src (already resolved from overlay). */
  heroImageSrc?: string | null
}

/**
 * Generates and downloads the guide PDF.
 * Caller must ensure jsPDF + autoTable are loaded (window.jspdf.jsPDF + window.autoTable
 * or doc.autoTable). Mirrors the sports-side pdfReady gate.
 */
export async function exportGuidePdf(opts: ExportGuidePdfOptions): Promise<void> {
  const w = window as any
  const jsPDF = w.jspdf?.jsPDF
  if (!jsPDF) {
    throw new Error('jsPDF not loaded — ensure pdfReady before calling exportGuidePdf')
  }

  // Load + register Cormorant.
  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const ctx: RenderCtx = {
    doc,
    destination: opts.destination,
    variant: opts.variant,
    emblemImg: opts.emblemImg ?? null,
    copy: opts.copy,
    heroImageSrc: opts.heroImageSrc ?? null,
    sections: buildSections(opts),
  }

  // ── Render flow ───────────────────────────────────────────────────────────
  await renderCoverPage(ctx)

  doc.addPage()
  renderWelcomePage(ctx)

  doc.addPage()
  renderContentsPage(ctx)

  doc.addPage()
  await renderCardsSection(ctx, opts.venues)

  doc.addPage()
  renderClosingPage(ctx)

  // Stamp page numbers + repeating chrome (skip cover, page 1).
  stampPageChrome(ctx)

  doc.save(buildFilename(opts.destination, opts.variant))
}

// ── Render context ───────────────────────────────────────────────────────────

interface RenderCtx {
  doc: any
  destination: GuideDestination
  variant: 'dining'
  emblemImg: HTMLImageElement | null
  copy: { eyebrow: string; headline: string; intro: string }
  heroImageSrc: string | null
  sections: ContentsSection[]
}

interface ContentsSection {
  page: number   // populated post-render
  title: string
  blurb: string
}

function buildSections(opts: ExportGuidePdfOptions): ContentsSection[] {
  // Sections rendered in fixed order — page numbers stamped during a final pass.
  // Page 1 = cover (not in contents). Welcome = 2. Contents = 3. Cards = 4+. Closing = last.
  const items: ContentsSection[] = [
    { page: 2, title: `Welcome to ${opts.destination.name}`, blurb: opts.copy.intro },
    { page: 4, title: `${capitalize(opts.variant)} Highlights`, blurb: 'Our curated selection of standout tables' },
  ]
  if (opts.venues.length > 0) {
    items.push({
      page: -1, // computed at render time — see renderClosingPage stamp
      title: 'Plan Your Visit',
      blurb: 'Insider tips for a seamless experience',
    })
  }
  return items
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Filename ─────────────────────────────────────────────────────────────────

function buildFilename(destination: GuideDestination, variant: string): string {
  const today = new Date()
  const dd   = String(today.getDate()).padStart(2, '0')
  const mm   = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy = today.getFullYear()
  return `ambienceTRAVEL-${destination.slug}-${variant}-guide-${dd}${mm}${yyyy}.pdf`
}

// ── Cover page ───────────────────────────────────────────────────────────────

async function renderCoverPage(ctx: RenderCtx) {
  const { doc, copy, heroImageSrc, emblemImg } = ctx

  // Cream background — full page.
  doc.setFillColor(...THEME.cream)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  // Top emblem + wordmark, centered.
  const wordmarkY = 22
  if (emblemImg) {
    drawClippedEmblem(doc, emblemImg, PAGE.width / 2 - 5, 12, 10)
  }
  setSerif(doc, 'normal', 14)
  doc.setTextColor(...THEME.ink)
  doc.text('ambience', PAGE.width / 2, wordmarkY + 6, { align: 'center' })

  setSans(doc, 'normal', 7)
  doc.setTextColor(...THEME.gold)
  doc.text('CURATED TRAVEL', PAGE.width / 2, wordmarkY + 11, { align: 'center', charSpace: 0.6 })

  // Massive serif headline — wraps if long.
  const titleY = 70
  setSerif(doc, 'normal', 48)
  doc.setTextColor(...THEME.ink)
  const titleLines = doc.splitTextToSize(copy.headline, PAGE.width - PAGE.margin * 2 - 8)
  // Cap at 3 lines visually; serif at 48pt with 1.0 lineHeight ≈ 17mm/line.
  let yCursor = titleY
  for (let i = 0; i < Math.min(titleLines.length, 3); i++) {
    doc.text(titleLines[i], PAGE.margin + 4, yCursor)
    yCursor += 17
  }

  // Gold rule under title — short, centered-left under the headline block.
  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.6)
  doc.line(PAGE.margin + 4, yCursor + 2, PAGE.margin + 28, yCursor + 2)

  // Intro copy — sans, muted ink.
  setSans(doc, 'normal', 10.5)
  doc.setTextColor(...THEME.muted)
  const introLines = doc.splitTextToSize(copy.intro, PAGE.width - PAGE.margin * 2 - 60)
  let introY = yCursor + 12
  for (const line of introLines) {
    doc.text(line, PAGE.margin + 4, introY)
    introY += 5.5
  }

  // Hero image — full-bleed, lower portion of the page.
  // Bottom 50% of the page is the hero.
  const heroTop    = 162
  const heroBottom = 270
  if (heroImageSrc) {
    try {
      const imgData = await loadImageAsDataUrl(heroImageSrc)
      if (imgData) {
        // Full-bleed: x=0, width=full, height=heroBottom-heroTop.
        doc.addImage(imgData.data, imgData.format, 0, heroTop, PAGE.width, heroBottom - heroTop, undefined, 'FAST')
      }
    } catch {
      // Silent fallback — render gold gradient panel.
      drawHeroFallback(doc, heroTop, heroBottom)
    }
  } else {
    drawHeroFallback(doc, heroTop, heroBottom)
  }

  // Bottom tagline — gold, tracked uppercase.
  setSans(doc, 'normal', 8)
  doc.setTextColor(...THEME.gold)
  doc.text('CURATED LOCALLY  ·  EXPERIENCED BEAUTIFULLY', PAGE.width / 2, PAGE.height - 12, {
    align: 'center',
    charSpace: 0.6,
  })
}

function drawHeroFallback(doc: any, top: number, bottom: number) {
  doc.setFillColor(...THEME.fallbackBg)
  doc.rect(0, top, PAGE.width, bottom - top, 'F')
  // Subtle gold rule mid-band.
  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.4)
  doc.line(PAGE.width / 2 - 12, (top + bottom) / 2, PAGE.width / 2 + 12, (top + bottom) / 2)
}

// ── Welcome page ─────────────────────────────────────────────────────────────

function renderWelcomePage(ctx: RenderCtx) {
  const { doc, destination, copy } = ctx

  // White bg.
  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  // Headline.
  setSerif(doc, 'normal', 28)
  doc.setTextColor(...THEME.ink)
  doc.text(`Welcome to ${destination.name}`, PAGE.margin, y)
  y += 14

  // Intro copy — sans, full width.
  setSans(doc, 'normal', 10.5)
  doc.setTextColor(...THEME.inkSoft)
  const introLines = doc.splitTextToSize(copy.intro, PAGE.width - PAGE.margin * 2)
  for (const line of introLines) {
    doc.text(line, PAGE.margin, y)
    y += 5.5
  }
  y += 8

  // Gold rule.
  doc.setDrawColor(...THEME.gold)
  doc.setLineWidth(0.4)
  doc.line(PAGE.margin, y, PAGE.margin + 24, y)
  y += 14

  // "At a Glance" panel.
  const panelTop = y
  const panelHeight = 60
  doc.setFillColor(...THEME.cream)
  doc.rect(PAGE.margin, panelTop, PAGE.width - PAGE.margin * 2, panelHeight, 'F')

  setSerif(doc, 'normal', 18)
  doc.setTextColor(...THEME.ink)
  doc.text('At a Glance', PAGE.margin + 8, panelTop + 12)

  // Bullets — populate generically; later we'll pull from a structured source.
  const bullets = [
    'A curated selection of standout tables',
    'Reserved for guests on a curated journey',
    'Reservation guidance included where helpful',
  ]
  setSans(doc, 'normal', 10)
  doc.setTextColor(...THEME.muted)
  let bulletY = panelTop + 22
  for (const b of bullets) {
    doc.text('·', PAGE.margin + 8, bulletY)
    doc.text(b, PAGE.margin + 13, bulletY)
    bulletY += 6
  }
}

// ── Contents page ────────────────────────────────────────────────────────────

function renderContentsPage(ctx: RenderCtx) {
  const { doc, sections } = ctx

  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  setSerif(doc, 'normal', 28)
  doc.setTextColor(...THEME.gold)
  doc.text('Contents', PAGE.margin, y)
  y += 16

  // Two-column layout: page no. (small, gold) | title (medium, ink) | blurb (small, muted, right)
  for (const section of sections) {
    const pageStr = String(section.page).padStart(2, '0')

    setSans(doc, 'normal', 10)
    doc.setTextColor(...THEME.gold)
    doc.text(pageStr, PAGE.margin, y)

    setSans(doc, 'normal', 11)
    doc.setTextColor(...THEME.ink)
    doc.text(section.title, PAGE.margin + 14, y)

    setSans(doc, 'normal', 9)
    doc.setTextColor(...THEME.muted)
    doc.text(section.blurb, PAGE.width - PAGE.margin, y, { align: 'right' })

    y += 4
    // Hairline separator.
    doc.setDrawColor(...THEME.rule)
    doc.setLineWidth(0.15)
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y)
    y += 8
  }
}

// ── Cards section ────────────────────────────────────────────────────────────

const CARD = {
  imageSize:    36,    // square thumb, mm
  rowGap:       6,     // between cards
  rowMinHeight: 38,    // min mm per row
  rowPadding:   4,     // top/bottom inside card
} as const

async function renderCardsSection(ctx: RenderCtx, venues: DiningVenue[]) {
  const { doc, destination } = ctx

  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  // Section heading.
  setSerif(doc, 'normal', 26)
  doc.setTextColor(...THEME.ink)
  doc.text(`${capitalize(ctx.variant)} Highlights`, PAGE.margin, y)
  y += 5

  setSans(doc, 'normal', 8.5)
  doc.setTextColor(...THEME.gold)
  doc.text('OUR CURATED SELECTION OF STANDOUT TABLES', PAGE.margin, y, { charSpace: 0.4 })
  y += 12

  if (venues.length === 0) {
    setSans(doc, 'italic', 10)
    doc.setTextColor(...THEME.muted)
    doc.text(`No tables curated for ${destination.name} yet.`, PAGE.margin, y)
    return
  }

  // Render each venue as a card. Page-break before any card that won't fit.
  for (const venue of venues) {
    const cardHeight = computeCardHeight(doc, venue)
    if (y + cardHeight > PAGE.footerY - 8) {
      doc.addPage()
      doc.setFillColor(...THEME.white)
      doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
      y = PAGE.bodyTop + 8
    }

    await renderCard(doc, venue, y)
    y += cardHeight + CARD.rowGap
  }
}

function computeCardHeight(doc: any, venue: DiningVenue): number {
  // Card height = max(image side, text block height) + padding.
  const textWidth = PAGE.width - PAGE.margin * 2 - CARD.imageSize - 8
  let textHeight = 0

  // Cuisine eyebrow (~3.5mm) + name (~7mm) + body lines + tags row + address row.
  textHeight += 4   // cuisine
  textHeight += 8   // name
  if (venue.body) {
    setSans(doc, 'normal', 9.5)
    const bodyLines = doc.splitTextToSize(venue.body, textWidth)
    textHeight += bodyLines.length * 4.4 + 2
  }
  if (venue.tags && venue.tags.length > 0) textHeight += 6
  if (venue.address) {
    setSans(doc, 'normal', 8.5)
    const addrLines = doc.splitTextToSize(venue.address, textWidth)
    textHeight += addrLines.length * 4 + 2
  }
  return Math.max(textHeight + CARD.rowPadding * 2, CARD.imageSize, CARD.rowMinHeight)
}

async function renderCard(doc: any, venue: DiningVenue, top: number) {
  const cardHeight = computeCardHeight(doc, venue)
  const cardWidth  = PAGE.width - PAGE.margin * 2

  // Card frame — soft hairline.
  doc.setDrawColor(...THEME.rule)
  doc.setLineWidth(0.15)
  doc.line(PAGE.margin, top + cardHeight + CARD.rowGap / 2,
           PAGE.width - PAGE.margin, top + cardHeight + CARD.rowGap / 2)

  // Image (left) — square at top-left of card row.
  const imgX = PAGE.margin
  const imgY = top + CARD.rowPadding
  if (venue.image_src) {
    try {
      const imgData = await loadImageAsDataUrl(venue.image_src)
      if (imgData) {
        doc.addImage(imgData.data, imgData.format, imgX, imgY, CARD.imageSize, CARD.imageSize, undefined, 'FAST')
      } else {
        drawImageFallback(doc, imgX, imgY, venue.name)
      }
    } catch {
      drawImageFallback(doc, imgX, imgY, venue.name)
    }
  } else {
    drawImageFallback(doc, imgX, imgY, venue.name)
  }

  // Text block (right of image).
  const textX = imgX + CARD.imageSize + 8
  const textWidth = cardWidth - CARD.imageSize - 8
  let ty = top + CARD.rowPadding + 4

  // Cuisine eyebrow — gold, tracked uppercase.
  if (venue.cuisine_subcategory) {
    setSans(doc, 'normal', 7.5)
    doc.setTextColor(...THEME.gold)
    doc.text(venue.cuisine_subcategory.toUpperCase(), textX, ty, { charSpace: 0.4 })
    ty += 4
  }

  // Name — Cormorant, ink.
  setSerif(doc, 'normal', 18)
  doc.setTextColor(...THEME.ink)
  doc.text(venue.name, textX, ty)
  ty += 7

  // Neighborhood + Michelin chip on same row.
  if (venue.neighborhood || venue.michelin) {
    setSans(doc, 'normal', 8.5)
    doc.setTextColor(...THEME.muted)
    let metaX = textX
    if (venue.neighborhood) {
      doc.text(venue.neighborhood, metaX, ty)
      metaX += doc.getTextWidth(venue.neighborhood) + 4
    }
    if (venue.michelin) {
      // Michelin pill — gold border + gold text.
      const pillText = 'MICHELIN'
      setSans(doc, 'bold', 7)
      doc.setTextColor(...THEME.gold)
      const pillW = doc.getTextWidth(pillText) + 4
      doc.setDrawColor(...THEME.gold)
      doc.setLineWidth(0.3)
      doc.roundedRect(metaX, ty - 3.2, pillW, 4.4, 1, 1)
      doc.text(pillText, metaX + 2, ty + 0.2, { charSpace: 0.4 })
    }
    ty += 5
  }

  // Body.
  if (venue.body) {
    setSans(doc, 'normal', 9.5)
    doc.setTextColor(...THEME.inkSoft)
    const bodyLines = doc.splitTextToSize(venue.body, textWidth)
    for (const line of bodyLines) {
      doc.text(line, textX, ty)
      ty += 4.4
    }
    ty += 1
  }

  // Tags — small pills.
  if (venue.tags && venue.tags.length > 0) {
    setSans(doc, 'normal', 7.5)
    doc.setTextColor(...THEME.muted)
    let tagX = textX
    for (const tag of venue.tags) {
      const w = doc.getTextWidth(tag) + 4
      if (tagX + w > textX + textWidth) break  // single row only in PDF
      doc.setDrawColor(...THEME.rule)
      doc.setLineWidth(0.15)
      doc.roundedRect(tagX, ty - 2.8, w, 4.2, 1, 1)
      doc.text(tag, tagX + 2, ty + 0.2)
      tagX += w + 2
    }
    ty += 5
  }

  // Address.
  if (venue.address) {
    setSans(doc, 'normal', 8.5)
    doc.setTextColor(...THEME.faint)
    const addrLines = doc.splitTextToSize(venue.address, textWidth)
    for (const line of addrLines) {
      doc.text(line, textX, ty)
      ty += 4
    }
  }
}

function drawImageFallback(doc: any, x: number, y: number, name: string) {
  doc.setFillColor(...THEME.fallbackBg)
  doc.rect(x, y, CARD.imageSize, CARD.imageSize, 'F')
  setSerif(doc, 'italic', 12)
  doc.setTextColor(...THEME.muted)
  // Show first letter of name centered.
  const letter = (name?.[0] ?? '·').toUpperCase()
  doc.text(letter, x + CARD.imageSize / 2, y + CARD.imageSize / 2 + 3, { align: 'center' })
}

// ── Closing page ─────────────────────────────────────────────────────────────

function renderClosingPage(ctx: RenderCtx) {
  const { doc, destination } = ctx

  doc.setFillColor(...THEME.white)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = PAGE.bodyTop + 12

  setSerif(doc, 'normal', 26)
  doc.setTextColor(...THEME.ink)
  doc.text('Plan Your Visit', PAGE.margin, y)
  y += 5

  setSans(doc, 'normal', 8.5)
  doc.setTextColor(...THEME.gold)
  doc.text('INSIDER TIPS FOR A SEAMLESS EXPERIENCE', PAGE.margin, y, { charSpace: 0.4 })
  y += 14

  setSans(doc, 'normal', 10.5)
  doc.setTextColor(...THEME.inkSoft)
  const lines = [
    `For the standout tables in ${destination.name}, reservations are essential — and often required several weeks ahead.`,
    '',
    'Our concierge team is available to coordinate timings, dietary needs, and any preferences that make the experience feel effortless.',
    '',
    'For the most current detail, refer to the live guide on ambience.travel.',
  ]
  for (const line of lines) {
    if (line === '') { y += 4; continue }
    const wrapped = doc.splitTextToSize(line, PAGE.width - PAGE.margin * 2)
    for (const w of wrapped) {
      doc.text(w, PAGE.margin, y)
      y += 5.5
    }
  }
}

// ── Page chrome ──────────────────────────────────────────────────────────────
// Stamps eyebrow + page number on every page except the cover, plus footer.

function stampPageChrome(ctx: RenderCtx) {
  const { doc, destination, variant } = ctx
  const pageCount = doc.getNumberOfPages()

  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i)

    // Top eyebrow strip — destination + variant on left, page number right.
    const eyebrowText = `${destination.name.toUpperCase()} ${variant.toUpperCase()} GUIDE`
    setSans(doc, 'normal', 7.5)
    doc.setTextColor(...THEME.gold)
    doc.text(eyebrowText, PAGE.margin, 14, { charSpace: 0.5 })

    const pageStr = String(i).padStart(2, '0')
    doc.text(pageStr, PAGE.width - PAGE.margin, 14, { align: 'right' })

    // Thin gold rule under eyebrow.
    doc.setDrawColor(...THEME.gold)
    doc.setLineWidth(0.2)
    doc.line(PAGE.margin, 18, PAGE.width - PAGE.margin, 18)

    // Footer rule + AMBIENCE.COM right.
    doc.setDrawColor(...THEME.rule)
    doc.setLineWidth(0.15)
    doc.line(PAGE.margin, PAGE.footerY, PAGE.width - PAGE.margin, PAGE.footerY)

    setSans(doc, 'normal', 7)
    doc.setTextColor(...THEME.gold)
    doc.text('AMBIENCE CURATED TRAVEL', PAGE.margin, PAGE.footerText, { charSpace: 0.5 })
    doc.text('AMBIENCE.COM', PAGE.width - PAGE.margin, PAGE.footerText, { align: 'right', charSpace: 0.5 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function setSerif(doc: any, style: 'normal' | 'italic', size: number) {
  doc.setFont(PDF_FONTS.serif, style)
  doc.setFontSize(size)
}

function setSans(doc: any, style: 'normal' | 'bold' | 'italic', size: number) {
  doc.setFont(PDF_FONTS.sans, style)
  doc.setFontSize(size)
}

interface ImageData {
  data: string  // base64 data URL or raw base64
  format: 'JPEG' | 'PNG' | 'WEBP'
}

/**
 * Loads an image src (URL or data URL) as a base64 data URL via canvas.
 * Returns null on failure (caller renders fallback).
 *
 * Why canvas: jsPDF's addImage works best with JPEG/PNG. WebP is supported in
 * modern jsPDF but rendering varies; canvas → JPEG normalises for consistency.
 */
async function loadImageAsDataUrl(src: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        // White background flush — handles WebP transparency cleanly.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86)
        resolve({ data: dataUrl, format: 'JPEG' })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Draws an emblem image clipped to a circle on white background.
 * Mirrors the sports-side pattern — strips dark outer ring, prints clean.
 */
function drawClippedEmblem(doc: any, img: HTMLImageElement, x: number, y: number, size: number) {
  try {
    const px = 120
    const canvas = document.createElement('canvas')
    canvas.width = px; canvas.height = px
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#F6F1E8'  // cream — matches cover bg
    ctx.fillRect(0, 0, px, px)
    ctx.save()
    ctx.beginPath()
    ctx.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, 0, 0, px, px)
    ctx.restore()
    const composited = canvas.toDataURL('image/jpeg', 1.0)
    doc.addImage(composited, 'JPEG', x, y, size, size)
  } catch {}
}