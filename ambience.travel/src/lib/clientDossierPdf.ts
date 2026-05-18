// clientDossierPdf.ts — Client Dossier PDF export for ambience.TRAVEL admin
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Logo + emblem header block
//   - Opening paragraph (salutation, guest description, party composition)
//   - Special requests section (plain / important / vital highlight tiers)
//   - Per-room arrangement sections
//   - Reservation details block
//   - Contact block (our advisor + on-site contact request line)
//   - Closing paragraph
//   - Filename construction
//
// What it does not own:
//   - Font loading (shared via loadGuideFonts / registerGuideFonts)
//   - Data fetching (caller passes ClientDossierData)
//   - UI trigger (TripDossierSection owns the Download button)
//   - jsPDF script loading (useDossierDownload owns this)
//
// Highlight tiers:
//   plain      — standard bullet, no background
//   important  — gold left bar + amber tint (#FFF8E6 / #C9A84C)
//   vital      — red left bar + red tint (#FDE8E8 / #C94C4C)
//
// Prior: S45 — initial ship.

import { loadGuideFonts, registerGuideFonts, PDF_FONTS, PDF_FONTS_SANS_MEDIUM_FAMILY } from './guidePdfFonts'

// ── Theme ─────────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

// Record<string, RGB> avoids literal-type narrowing from 'as const',
// which would cause spread errors (Type 'number' not assignable to '247' etc).
const THEME: Record<string, RGB> = {
  offWhite:  [247, 245, 240],
  ink:       [26,  29,  26],
  inkMuted:  [90,  90,  84],
  rule:      [200, 196, 188],
  goldText:  [138, 111, 62],
  goldHlBg:  [255, 248, 230],
  goldHlBar: [201, 168, 76],
  redHlBg:   [253, 232, 232],
  redHlBar:  [201, 76,  76],
}

// ── Layout ────────────────────────────────────────────────────────────────────

const PAGE = {
  width:   210,
  height:  297,
  margin:  20,
  bodyTop: 18,
} as const

const ASSET_PATHS = {
  emblem:  '/emblem.png',
  logoSvg: '/ambience_travel.svg',
} as const

// ── Public types ──────────────────────────────────────────────────────────────

export type DossierPriority = 'plain' | 'important' | 'vital'

export interface DossierRequestItem {
  text:     string
  priority: DossierPriority
}

export interface DossierRoomSection {
  roomName: string
  items:    DossierRequestItem[]
}

export interface ClientDossierData {
  // House / guest
  guestDisplayName: string
  guestDescription: string
  partyIntro:       string
  arrivalNote?:     string

  // Booking
  hotelName:           string
  destination:         string
  dateRange:           string   // e.g. "24-28 May 2026"
  roomName:            string
  checkIn:             string
  checkOut:            string
  duration:            string
  rateType:            string
  inclusions?:         string
  confirmationNumber?: string

  // Contacts
  primaryContactName?: string
  primaryContactRole?: string

  // Content
  specialRequests?:  DossierRequestItem[]
  roomArrangements?: DossierRoomSection[]
}

// ── Font helpers ──────────────────────────────────────────────────────────────

function setSerif(doc: any, style: 'normal' | 'italic', size: number) {
  doc.setFont(PDF_FONTS.serif, style)
  doc.setFontSize(size)
}

function setSans(doc: any, style: 'normal' | 'bold' | 'italic' | 'medium', size: number) {
  if (style === 'medium') {
    doc.setFont(PDF_FONTS_SANS_MEDIUM_FAMILY, 'normal')
    doc.setFontSize(size)
    return
  }
  doc.setFont(PDF_FONTS.sans, style)
  doc.setFontSize(size)
}

// ── Image helpers ─────────────────────────────────────────────────────────────

interface ImagePayload { data: string; format: 'PNG' | 'JPEG' }

async function loadImageAsDataUrl(src: string): Promise<ImagePayload | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = img.naturalWidth  || 1
        canvas.height = img.naturalHeight || 1
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        const isPng = /\.png(\?|$)/i.test(src)
        if (!isPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
        ctx.drawImage(img, 0, 0)
        resolve(isPng
          ? { data: canvas.toDataURL('image/png'),         format: 'PNG'  }
          : { data: canvas.toDataURL('image/jpeg', 0.86), format: 'JPEG' })
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function rasterizeSvgAsDataUrl(src: string, targetPxWidth: number): Promise<ImagePayload | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const svgText = await res.text()
    const blob    = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    return await new Promise<ImagePayload | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        try {
          const naturalW = img.naturalWidth  || targetPxWidth
          const naturalH = img.naturalHeight || (targetPxWidth / 3)
          const scale    = targetPxWidth / naturalW
          const canvas   = document.createElement('canvas')
          canvas.width   = Math.round(naturalW * scale)
          canvas.height  = Math.round(naturalH * scale)
          const ctx = canvas.getContext('2d')
          if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(null); return }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(blobUrl)
          resolve({ data: canvas.toDataURL('image/png'), format: 'PNG' })
        } catch { URL.revokeObjectURL(blobUrl); resolve(null) }
      }
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null) }
      img.src = blobUrl
    })
  } catch { return null }
}

// ── Render helpers ────────────────────────────────────────────────────────────

function drawThinRule(doc: any, y: number, color: RGB = THEME.rule) {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(0.4)
  doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y)
}

function drawBodyText(
  doc: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size = 9,
  color: RGB = THEME.ink,
  style: 'normal' | 'italic' = 'normal',
): number {
  setSans(doc, style, size)
  doc.setTextColor(color[0], color[1], color[2])
  const lines = doc.splitTextToSize(text, maxWidth)
  for (const line of lines) { doc.text(line, x, y); y += 4.8 }
  return y
}

function drawBulletItem(
  doc: any,
  text: string,
  y: number,
  priority: DossierPriority,
  contentWidth: number,
): number {
  const padL  = priority !== 'plain' ? 14  : 10
  const padV  = priority !== 'plain' ? 4   : 2.5
  const textW = contentWidth - padL - 2

  setSans(doc, 'normal', 9)
  const lines  = doc.splitTextToSize(text, textW)
  const lineH  = 4.8
  const blockH = lines.length * lineH + padV * 2

  if (priority === 'important') {
    doc.setFillColor(THEME.goldHlBg[0], THEME.goldHlBg[1], THEME.goldHlBg[2])
    doc.rect(PAGE.margin, y, contentWidth, blockH, 'F')
    doc.setFillColor(THEME.goldHlBar[0], THEME.goldHlBar[1], THEME.goldHlBar[2])
    doc.rect(PAGE.margin, y, 2.5, blockH, 'F')
  }

  if (priority === 'vital') {
    doc.setFillColor(THEME.redHlBg[0], THEME.redHlBg[1], THEME.redHlBg[2])
    doc.rect(PAGE.margin, y, contentWidth, blockH, 'F')
    doc.setFillColor(THEME.redHlBar[0], THEME.redHlBar[1], THEME.redHlBar[2])
    doc.rect(PAGE.margin, y, 2.5, blockH, 'F')
  }

  doc.setFillColor(THEME.inkMuted[0], THEME.inkMuted[1], THEME.inkMuted[2])
  doc.circle(PAGE.margin + padL - 4, y + blockH / 2, 1.2, 'F')

  setSans(doc, 'normal', 9)
  doc.setTextColor(THEME.ink[0], THEME.ink[1], THEME.ink[2])
  let ty = y + padV + lineH - 1
  for (const line of lines) { doc.text(line, PAGE.margin + padL, ty); ty += lineH }

  return y + blockH + 2.5
}

function drawLabelValue(doc: any, label: string, value: string, y: number): number {
  setSans(doc, 'bold', 7)
  doc.setTextColor(THEME.inkMuted[0], THEME.inkMuted[1], THEME.inkMuted[2])
  doc.text(label.toUpperCase(), PAGE.margin, y, { charSpace: 0.4 })
  y += 4.5
  setSans(doc, 'normal', 9)
  doc.setTextColor(THEME.ink[0], THEME.ink[1], THEME.ink[2])
  const lines = doc.splitTextToSize(value, PAGE.width - PAGE.margin * 2)
  for (const line of lines) { doc.text(line, PAGE.margin, y); y += 4.8 }
  return y + 4
}

function drawSectionHeading(doc: any, text: string, y: number): number {
  setSans(doc, 'bold', 7.5)
  doc.setTextColor(THEME.inkMuted[0], THEME.inkMuted[1], THEME.inkMuted[2])
  doc.text(text.toUpperCase(), PAGE.margin, y, { charSpace: 0.5 })
  y += 3
  drawThinRule(doc, y)
  return y + 7
}

function newPage(doc: any): number {
  doc.addPage()
  doc.setFillColor(THEME.offWhite[0], THEME.offWhite[1], THEME.offWhite[2])
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
  return PAGE.bodyTop + 8
}

function stampBackground(doc: any) {
  const count = doc.getNumberOfPages()
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    doc.setFillColor(THEME.offWhite[0], THEME.offWhite[1], THEME.offWhite[2])
    doc.rect(0, 0, PAGE.width, PAGE.height, 'F')
  }
}

// ── Filename ──────────────────────────────────────────────────────────────────

function buildFilename(dossier: ClientDossierData): string {
  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mm    = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy  = today.getFullYear()
  const safe  = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase()
  return `ambience-client-dossier-${safe(dossier.hotelName)}-${dd}${mm}${yyyy}.pdf`
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportClientDossierPdf(dossier: ClientDossierData): Promise<void> {
  const w = window as any
  const jsPDF = w.jspdf?.jsPDF
  if (!jsPDF) throw new Error('jsPDF not loaded')

  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImageAsDataUrl(ASSET_PATHS.emblem),
    rasterizeSvgAsDataUrl(ASSET_PATHS.logoSvg, 800),
  ])

  doc.setFillColor(THEME.offWhite[0], THEME.offWhite[1], THEME.offWhite[2])
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  const contentWidth = PAGE.width - PAGE.margin * 2
  let y: number = PAGE.bodyTop

  // ── Header: emblem + logo ─────────────────────────────────────────────────
  if (emblem) {
    doc.addImage(emblem.data, emblem.format, PAGE.margin, y, 10, 10, undefined, 'FAST')
  }
  if (logo) {
    const logoH = 8; const logoW = logoH * 3.0
    const logoX = emblem ? PAGE.margin + 13 : PAGE.margin
    doc.addImage(logo.data, logo.format, logoX, y + 1, logoW, logoH, undefined, 'FAST')
  }
  y += 16
  drawThinRule(doc, y)
  y += 10

  // ── Title block ───────────────────────────────────────────────────────────
  setSans(doc, 'normal', 7.5)
  doc.setTextColor(THEME.inkMuted[0], THEME.inkMuted[1], THEME.inkMuted[2])
  doc.text('CLIENT DOSSIER', PAGE.margin, y, { charSpace: 0.6 })
  y += 5

  setSerif(doc, 'normal', 20)
  doc.setTextColor(THEME.ink[0], THEME.ink[1], THEME.ink[2])
  doc.text(dossier.hotelName, PAGE.margin, y)
  y += 6

  setSans(doc, 'normal', 8.5)
  doc.setTextColor(THEME.inkMuted[0], THEME.inkMuted[1], THEME.inkMuted[2])
  doc.text(`${dossier.destination}  \u00b7  ${dossier.dateRange}`, PAGE.margin, y)
  y += 10

  drawThinRule(doc, y)
  y += 10

  // ── Opening ───────────────────────────────────────────────────────────────
  y = drawBodyText(doc, 'Hello and good day!', PAGE.margin, y, contentWidth)
  y += 3

  const openingPara =
    `Thank you for your support of our dear guest, ${dossier.guestDisplayName}. ` +
    `${dossier.guestDescription} ${dossier.partyIntro}`
  y = drawBodyText(doc, openingPara, PAGE.margin, y, contentWidth)
  y += 3

  if (dossier.arrivalNote) {
    y = drawBodyText(doc, dossier.arrivalNote, PAGE.margin, y, contentWidth)
    y += 3
  }

  // ── Special requests ──────────────────────────────────────────────────────
  if (dossier.specialRequests?.length) {
    y = drawBodyText(doc, 'May we kindly request attention to the following details:', PAGE.margin, y, contentWidth)
    y += 5

    for (const item of dossier.specialRequests) {
      if (y > PAGE.height - 30) y = newPage(doc)
      y = drawBulletItem(doc, item.text, y, item.priority, contentWidth)
    }
    y += 6
  }

  // ── Room arrangements ─────────────────────────────────────────────────────
  if (dossier.roomArrangements?.length) {
    for (const section of dossier.roomArrangements) {
      if (y > PAGE.height - 40) y = newPage(doc)
      y = drawSectionHeading(doc, `Arrangements \u2013 ${section.roomName}`, y)
      for (const item of section.items) {
        if (y > PAGE.height - 30) y = newPage(doc)
        y = drawBulletItem(doc, item.text, y, item.priority, contentWidth)
      }
      y += 6
    }
  }

  // ── Reservation details ───────────────────────────────────────────────────
  if (y > PAGE.height - 60) y = newPage(doc)
  y = drawSectionHeading(doc, 'Reservation Details', y)
  y = drawLabelValue(doc, 'Accommodation', dossier.roomName,  y)
  y = drawLabelValue(doc, 'Check-In',      dossier.checkIn,   y)
  y = drawLabelValue(doc, 'Check-Out',     dossier.checkOut,  y)
  y = drawLabelValue(doc, 'Duration',      dossier.duration,  y)
  y = drawLabelValue(doc, 'Rate Plan',     dossier.rateType,  y)
  if (dossier.inclusions)         y = drawLabelValue(doc, 'Inclusions',          dossier.inclusions,         y)
  if (dossier.confirmationNumber) y = drawLabelValue(doc, 'Confirmation Number', dossier.confirmationNumber, y)

  // ── Contact ───────────────────────────────────────────────────────────────
  if (y > PAGE.height - 50) y = newPage(doc)
  y += 2
  y = drawSectionHeading(doc, 'Contact', y)
  if (dossier.primaryContactName) y = drawLabelValue(doc, 'Our Advisor', dossier.primaryContactName, y)
  y = drawBodyText(
    doc,
    'May we kindly request that you share the best on-site contact and MOD details for the duration of the stay.',
    PAGE.margin, y, contentWidth, 9, THEME.inkMuted, 'italic',
  )
  y += 8

  // ── Closing ───────────────────────────────────────────────────────────────
  drawThinRule(doc, y)
  y += 8
  y = drawBodyText(
    doc,
    'Thank you again for your kind support. We look forward to hearing from you at your earliest convenience.',
    PAGE.margin, y, contentWidth,
  )
  drawBodyText(
    doc,
    'This dossier is confidential and intended solely for the named recipient.',
    PAGE.margin, y + 2, contentWidth, 8.5, THEME.inkMuted, 'italic',
  )

  stampBackground(doc)
  doc.save(buildFilename(dossier))
}