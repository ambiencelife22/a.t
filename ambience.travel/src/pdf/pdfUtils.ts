// pdfUtils.ts — Shared PDF primitives for all ambience PDF exports.
//
// What it owns:
//   - Image loading:   loadImg (PNG/JPEG via canvas)
//   - SVG loading:     loadSvg (fetch → Blob → Image → canvas raster)
//   - Cover crop:      makeCoverCropAsync (async canvas cover-crop to exact mm target)
//   - Font helpers:    serif(), sans() — thin wrappers around doc.setFont/setFontSize
//   - Draw helpers:    drawRule(), drawStar(), drawStarRow()
//   - jsPDF guard:     assertJsPdf()
//
// What it does not own:
//   - Font loading / registration (guidePdfFonts.ts owns this)
//   - PDF lifecycle (each PDF module owns its own jsPDF instance)
//   - Any page chrome or layout logic
//
// Consuming files: guidePdf.ts, confirmationBriefPdf.ts,
//   clientDossierPdf.ts, dailyProgrammePdf.ts.
//
// Rule: never import from a PDF module here. This file has no upstream
//   dependencies other than guidePdfFonts.ts constants.
//
// Last updated: S48 — initial extraction from guidePdf.ts +
//   confirmationBriefPdf.ts. Identical logic, single source.

import { PDF_FONTS, PDF_FONTS_SANS_MEDIUM_FAMILY } from './pdfFonts'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RGB = [number, number, number]

export interface Img {
  data:   string
  format: 'PNG' | 'JPEG'
  nw:     number
  nh:     number
}

// ── jsPDF guard ───────────────────────────────────────────────────────────────

/**
 * Asserts that jsPDF has been loaded onto window.jspdf.
 * Throws a descriptive error if not — caller should surface this to the user.
 */
export function assertJsPdf(): any {
  const jsPDF = (window as any).jspdf?.jsPDF
  if (!jsPDF) throw new Error('jsPDF not loaded. Ensure pdfReady before calling export functions.')
  return jsPDF
}

// ── Image loading ─────────────────────────────────────────────────────────────

/**
 * Loads any image URL (PNG, JPEG, WEBP) via an HTMLImageElement → canvas.
 * PNG: transparent background preserved.
 * JPEG/WEBP: white background composited first (jsPDF requires opaque JPEG).
 *
 * Returns null on network error or canvas failure — callers must handle gracefully.
 */
export async function loadImg(src: string): Promise<Img | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const nw = img.naturalWidth  || 1
        const nh = img.naturalHeight || 1
        const c  = document.createElement('canvas')
        c.width  = nw
        c.height = nh
        const ctx = c.getContext('2d')
        if (!ctx) { resolve(null); return }
        const isPng = /\.png(\?|$)/i.test(src)
        if (!isPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, nw, nh) }
        ctx.drawImage(img, 0, 0)
        resolve(isPng
          ? { data: c.toDataURL('image/png'),        format: 'PNG',  nw, nh }
          : { data: c.toDataURL('image/jpeg', 0.88), format: 'JPEG', nw, nh })
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Rasterises an SVG file to PNG via fetch → Blob URL → HTMLImageElement → canvas.
 *
 * This is the canonical pattern proven in guidePdf.ts. Do not diverge.
 * Always use this instead of passing SVG src directly to jsPDF.addImage.
 *
 * targetW: canvas output width in px. Height scales proportionally from
 * the SVG's natural aspect ratio. ambience_travel.svg viewBox is 800×300 (2.67:1).
 */
export async function loadSvg(src: string, targetW: number): Promise<Img | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const svgText = await res.text()
    const blob    = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)

    return await new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        try {
          const naturalW = img.naturalWidth  || targetW
          const naturalH = img.naturalHeight || Math.round(targetW / 3)
          const scale    = targetW / naturalW
          const c        = document.createElement('canvas')
          c.width        = Math.round(naturalW * scale)
          c.height       = Math.round(naturalH * scale)
          const ctx = c.getContext('2d')
          if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(null); return }
          ctx.drawImage(img, 0, 0, c.width, c.height)
          URL.revokeObjectURL(blobUrl)
          resolve({ data: c.toDataURL('image/png'), format: 'PNG', nw: c.width, nh: c.height })
        } catch { URL.revokeObjectURL(blobUrl); resolve(null) }
      }
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null) }
      img.src = blobUrl
    })
  } catch { return null }
}

// ── Cover crop ────────────────────────────────────────────────────────────────

/**
 * Async canvas cover-crop. Takes a decoded image (srcData, format, srcNw, srcNh)
 * and crops it to exactly destWmm × destHmm at PX px/mm resolution.
 *
 * Rule: always await this after loadImg. Never pass raw src to jsPDF.addImage
 * when a specific crop region is required — dimensions and crop must be
 * pre-resolved (Dev Standards S47).
 *
 * Falls back to returning the original srcData on canvas error.
 */
export async function makeCoverCropAsync(
  srcData: string,
  format:  'PNG' | 'JPEG',
  srcNw:   number,
  srcNh:   number,
  destWmm: number,
  destHmm: number,
  pxPerMm = 4,
): Promise<{ data: string; format: 'PNG' | 'JPEG' }> {
  const outW  = Math.round(destWmm * pxPerMm)
  const outH  = Math.round(destHmm * pxPerMm)
  const scale = Math.max(outW / srcNw, outH / srcNh)
  const sw    = Math.round(srcNw * scale)
  const sh    = Math.round(srcNh * scale)
  const ox    = Math.round((sw - outW) / 2)
  const oy    = Math.round((sh - outH) / 2)

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width  = outW
        c.height = outH
        const ctx = c.getContext('2d')
        if (!ctx) { resolve({ data: srcData, format }); return }
        if (format !== 'PNG') { ctx.fillStyle = '#FAF7F2'; ctx.fillRect(0, 0, outW, outH) }
        ctx.drawImage(img, -ox, -oy, sw, sh)
        resolve(format === 'PNG'
          ? { data: c.toDataURL('image/png'),         format: 'PNG'  }
          : { data: c.toDataURL('image/jpeg', 0.88),  format: 'JPEG' })
      } catch { resolve({ data: srcData, format }) }
    }
    img.onerror = () => resolve({ data: srcData, format })
    img.src = srcData
  })
}

// ── Font helpers ──────────────────────────────────────────────────────────────

/**
 * Sets Cormorant Garamond (serif display family) on a jsPDF doc.
 * Valid styles: 'normal' | 'italic'
 */
export function serif(doc: any, style: 'normal' | 'italic', size: number): void {
  doc.setFont(PDF_FONTS.serif, style)
  doc.setFontSize(size)
}

/**
 * Sets Source Sans 3 (sans body family) on a jsPDF doc.
 * 'medium' routes to the SourceSans3-Medium family alias (Dev Standards pattern).
 */
export function sans(doc: any, style: 'normal' | 'bold' | 'italic' | 'medium', size: number): void {
  if (style === 'medium') {
    doc.setFont(PDF_FONTS_SANS_MEDIUM_FAMILY, 'normal')
    doc.setFontSize(size)
    return
  }
  doc.setFont(PDF_FONTS.sans, style)
  doc.setFontSize(size)
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

/**
 * Draws a horizontal rule at (x, y) with given width.
 * Defaults: color = [220, 215, 205], thickness = 0.3pt.
 */
export function drawRule(
  doc:       any,
  x:         number,
  y:         number,
  w:         number,
  color:     RGB = [220, 215, 205],
  thickness  = 0.3,
): void {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(thickness)
  doc.line(x, y, x + w, y)
}

/**
 * Draws a filled 5-pointed star centred at (cx, cy) with given radius and RGB fill.
 * Inner radius ratio: 0.382 (golden ratio approximation).
 */
export function drawStar(doc: any, cx: number, cy: number, radius: number, rgb: RGB): void {
  const inner = radius * 0.382
  const points: Array<[number, number]> = []
  for (let i = 0; i < 10; i++) {
    const r     = (i % 2 === 0) ? radius : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  const start  = points[0]
  const deltas = points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]] as [number, number])
  deltas.push([start[0] - points[points.length - 1][0], start[1] - points[points.length - 1][1]])
  doc.setFillColor(rgb[0], rgb[1], rgb[2])
  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  doc.setLineWidth(0.05)
  doc.lines(deltas, start[0], start[1], [1, 1], 'F', true)
}

/**
 * Draws a horizontal row of `count` stars starting at (x, y).
 * Returns the total pixel width consumed (for inline layout after the row).
 */
export function drawStarRow(
  doc:    any,
  x:      number,
  y:      number,
  count:  number,
  radius: number,
  rgb:    RGB,
  gap     = 0.6,
): number {
  const stride = radius * 2 + gap
  for (let i = 0; i < count; i++) drawStar(doc, x + radius + i * stride, y, radius, rgb)
  return stride * count - gap
}