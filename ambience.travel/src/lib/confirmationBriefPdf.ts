// confirmationBriefPdf.ts — Trip Confirmation Brief PDF export
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Page 1: hero cover-crop + cream mask, frosted glass logo card, centred title.
//             Rooms flow below on same page; new page only on overflow.
//   - Per-room cards — half-width image left (cover crop), room name serif,
//     guests muted, Conf #: pill + booked_by_label (free-text) pinned bottom.
//   - Fallback: if no rooms on a booking, one synthetic card from the booking.
//
// Last updated: S47 — booked_by_label wired: room.booked_by_label ?? fallback.
//   SVG loading ported exactly from guidePdf.ts rasterizeSvgAsDataUrl.
//   Logo card image-based (emblem PNG + SVG raster). Footer ambience.travel
//   hyperlinked via doc.link(). Footer dot removed. No unconditional page break.

import { loadGuideFonts, registerGuideFonts, PDF_FONTS, PDF_FONTS_SANS_MEDIUM_FAMILY } from './guidePdfFonts'
import type { TripBrief, TripBooking, DossierTrip, HouseProfile, BookingRoom } from './adminTripQueries'

// ── Theme ─────────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

const T: Record<string, RGB> = {
  cream:   [250, 247, 242],
  ink:     [26,  29,  26],
  inkSoft: [60,  66,  60],
  muted:   [120, 115, 105],
  faint:   [180, 175, 165],
  gold:    [180, 145, 80],
  rule:    [220, 215, 205],
  cardBg:  [245, 242, 236],
  white:   [255, 255, 255],
}

const P = { w: 210, h: 297, margin: 16, heroH: 87 } as const
const CW = P.w - P.margin * 2

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConfirmationBriefData {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  heroImageData:   string | null
}

const ASSETS = { emblem: '/emblem.png', logoSvg: '/ambience_travel.svg' } as const

// ── Font helpers ──────────────────────────────────────────────────────────────

function serif(doc: any, style: 'normal' | 'italic', size: number) {
  doc.setFont(PDF_FONTS.serif, style); doc.setFontSize(size)
}

function sans(doc: any, style: 'normal' | 'bold' | 'italic' | 'medium', size: number) {
  if (style === 'medium') {
    doc.setFont(PDF_FONTS_SANS_MEDIUM_FAMILY, 'normal'); doc.setFontSize(size); return
  }
  doc.setFont(PDF_FONTS.sans, style); doc.setFontSize(size)
}

// ── Image loading ─────────────────────────────────────────────────────────────

interface Img { data: string; format: 'PNG' | 'JPEG'; nw: number; nh: number }

async function loadImg(src: string): Promise<Img | null> {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const nw = img.naturalWidth || 1; const nh = img.naturalHeight || 1
        const c = document.createElement('canvas'); c.width = nw; c.height = nh
        const ctx = c.getContext('2d'); if (!ctx) { resolve(null); return }
        const isPng = /\.png(\?|$)/i.test(src)
        if (!isPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, nw, nh) }
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

// Exact port of rasterizeSvgAsDataUrl from guidePdf.ts — the version that works.
async function loadSvg(src: string, targetW: number): Promise<Img | null> {
  try {
    const res = await fetch(src); if (!res.ok) return null
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
          const c = document.createElement('canvas')
          c.width  = Math.round(naturalW * scale)
          c.height = Math.round(naturalH * scale)
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

// ── Cover crop — async, awaits image load ─────────────────────────────────────

async function makeCoverCropAsync(
  srcData: string, format: 'PNG' | 'JPEG',
  srcNw: number, srcNh: number,
  destWmm: number, destHmm: number,
): Promise<{ data: string; format: 'PNG' | 'JPEG' }> {
  const PX = 4
  const outW = Math.round(destWmm * PX); const outH = Math.round(destHmm * PX)
  const scale = Math.max(outW / srcNw, outH / srcNh)
  const sw = Math.round(srcNw * scale); const sh = Math.round(srcNh * scale)
  const ox = Math.round((sw - outW) / 2); const oy = Math.round((sh - outH) / 2)

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = outW; c.height = outH
        const ctx = c.getContext('2d')
        if (!ctx) { resolve({ data: srcData, format }); return }
        if (format !== 'PNG') { ctx.fillStyle = '#FAF7F2'; ctx.fillRect(0, 0, outW, outH) }
        ctx.drawImage(img, -ox, -oy, sw, sh)
        resolve({ data: format === 'PNG' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88), format })
      } catch { resolve({ data: srcData, format }) }
    }
    img.onerror = () => resolve({ data: srcData, format })
    img.src = srcData
  })
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

function rule(doc: any, x: number, y: number, w: number, color: RGB = T.rule, t = 0.3) {
  doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(t)
  doc.line(x, y, x + w, y)
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildDateRange(s: string | null, e: string | null): string {
  if (!s) return ''
  if (!e) return fmtDate(s)
  const sd = new Date(s.slice(0, 10) + 'T00:00:00')
  const ed = new Date(e.slice(0, 10) + 'T00:00:00')
  const sm = sd.toLocaleDateString('en-US', { month: 'long' })
  const em = ed.toLocaleDateString('en-US', { month: 'long' })
  if (sm === em && sd.getFullYear() === ed.getFullYear())
    return `${sd.getDate()}\u2013${ed.getDate()} ${em} ${ed.getFullYear()}`
  return `${fmtDate(s)}\u2013${fmtDate(e)}`
}

// ── Frosted glass logo card — exact same pattern as guidePdf.ts ───────────────

// variant: 'ambience' (default) | 'alfaone' | 'unbranded' | null
// 'ambience'  — frosted card: emblem PNG + ambience_travel.svg raster
// 'alfaone'   — frosted card: "AlfaOne Concierge" in gold serif (asset TBD)
// 'unbranded' — nothing drawn
// null        — treated as 'ambience'
function drawFrostedLogoCard(
  doc: any,
  emblem: Img | null,
  logo: Img | null,
  variant: string | null,
) {
  const v = variant ?? 'ambience'
  if (v === 'unbranded') return

  const cx = P.margin; const cy = 8
  const pH = 5; const pW = 5; const eS = 12; const gap = 4

  if (v === 'alfaone') {
    doc.setFont(PDF_FONTS.serif, 'normal'); doc.setFontSize(13)
    const textW = doc.getTextWidth('AlfaOne Concierge')
    const cW = pW * 2 + textW
    const cH = pH * 2 + eS

    doc.setGState(doc.GState({ opacity: 0.82 }))
    doc.setFillColor(250, 247, 242)
    doc.setDrawColor(200, 195, 185)
    doc.setLineWidth(0.2)
    doc.roundedRect(cx, cy, cW, cH, 3, 3, 'FD')
    doc.setGState(doc.GState({ opacity: 1 }))

    doc.setFont(PDF_FONTS.serif, 'normal'); doc.setFontSize(13)
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
    doc.text('AlfaOne Concierge', cx + pW, cy + pH + eS * 0.62)
    return
  }

  // 'ambience' — emblem + SVG logo
  const logoH = 10; const logoW = logoH * 3.0
  const cW = pW + eS + gap + logoW + pW
  const cH = pH * 2 + Math.max(eS, logoH)

  doc.setGState(doc.GState({ opacity: 0.82 }))
  doc.setFillColor(250, 247, 242)
  doc.setDrawColor(200, 195, 185)
  doc.setLineWidth(0.2)
  doc.roundedRect(cx, cy, cW, cH, 3, 3, 'FD')
  doc.setGState(doc.GState({ opacity: 1 }))

  if (emblem) doc.addImage(emblem.data, emblem.format, cx + pW, cy + pH, eS, eS, undefined, 'FAST')
  if (logo) {
    const logoX = cx + pW + eS + gap
    const logoY = cy + pH + (Math.max(eS, logoH) - logoH) / 2
    doc.addImage(logo.data, logo.format, logoX, logoY, logoW, logoH, undefined, 'FAST')
  }
}

// ── Footer ────────────────────────────────────────────────────────────────────

function stampChrome(doc: any, brief: TripBrief | null) {
  const count  = doc.getNumberOfPages()
  const footer = brief?.footer_tagline ?? 'TAILORED TRAVEL DESIGN  \u00b7  CONCIERGE SUPPORT  \u00b7  ambience.travel'
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    rule(doc, P.margin, P.h - 10, CW)
    sans(doc, 'normal', 6.5)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    // Hyperlink ambience.travel portion
    const LINK = 'ambience.travel'
    const idx  = footer.lastIndexOf(LINK)
    if (idx !== -1) {
      const before = footer.slice(0, idx)
      const after  = footer.slice(idx + LINK.length)
      doc.text(before, P.margin, P.h - 5.5)
      const bw = doc.getTextWidth(before)
      doc.text(LINK, P.margin + bw, P.h - 5.5)
      const lw = doc.getTextWidth(LINK)
      doc.link(P.margin + bw, P.h - 8, lw, 4, { url: 'https://ambience.travel' })
      if (after) doc.text(after, P.margin + bw + lw, P.h - 5.5)
    } else {
      doc.text(footer, P.margin, P.h - 5.5)
    }
    doc.text(`PAGE ${i} OF ${count}`, P.w - P.margin, P.h - 5.5, { align: 'right' })
  }
}

// ── Room card ─────────────────────────────────────────────────────────────────

async function drawRoomCard(doc: any, room: BookingRoom, booking: TripBooking, y: number): Promise<number> {
  const imgW = Math.round(CW * 0.44)
  const padV = 7; const padH = 8; const minCardH = 36
  const contentX = P.margin + imgW; const contentW = CW - imgW

  // Guest line
  const guestParts: string[] = []
  if (room.guest_name) guestParts.push(room.guest_name)
  if (room.additional_guests?.length) guestParts.push(...room.additional_guests)
  if (room.party_composition) guestParts.push(room.party_composition)
  const guestLine = guestParts.join('  \u00b7  ')

  // Booked-by: free-text label takes priority over booking-level fallback
  const isAmbience   = (booking.booked_by ?? 'ambience') === 'ambience'
  const pillColor    = isAmbience ? T.gold : T.faint
  const pillBg       = isAmbience ? ([250, 247, 240] as RGB) : ([245, 245, 245] as RGB)
  const bookedByText = room.booked_by_label?.trim() || (isAmbience ? 'Booked by ambience' : 'Self-booked')
  const confText     = room.confirmation_number ? `Conf #:  ${room.confirmation_number}` : null

  // Measure content height
  serif(doc, 'normal', 11)
  const nameLines    = doc.splitTextToSize(room.room_name ?? 'Booking', contentW - padH * 2)
  const nameH        = nameLines.length * 5.5
  const guestH       = guestLine ? 5 : 0
  const bottomBlockH = confText ? 4 + 6 + 7 + 4.5 : 4 + 4.5  // gap + pill + gap + booked-by
  const contentH     = padV + nameH + (guestH ? guestH + 5 : 0) + bottomBlockH + padV
  const cardH        = Math.max(minCardH, contentH)

  // Room image — async cover crop to exact dimensions
  let croppedImg: { data: string; format: 'PNG' | 'JPEG' } | null = null
  if (room.brief_image_src) {
    try {
      const raw = await loadImg(room.brief_image_src)
      if (raw) croppedImg = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, imgW, cardH)
    } catch { /* silent */ }
  }

  // Card background
  doc.setFillColor(T.white[0], T.white[1], T.white[2])
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'FD')

  // Image
  if (croppedImg) {
    doc.addImage(croppedImg.data, croppedImg.format, P.margin, y, imgW, cardH, undefined, 'FAST')
  } else {
    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.rect(P.margin, y, imgW, cardH, 'F')
  }

  // Redraw border over image
  doc.setDrawColor(T.rule[0], T.rule[1], T.rule[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(P.margin, y, CW, cardH, 2, 2, 'D')

  // Content — natural top-to-bottom flow, no pinning
  const tx = contentX + padH; let ty = y + padV

  serif(doc, 'normal', 11)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (const line of nameLines) { doc.text(line, tx, ty); ty += 5.5 }

  if (guestLine) {
    ty += 2
    sans(doc, 'normal', 8)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text((doc.splitTextToSize(guestLine, contentW - padH * 2))[0] ?? '', tx, ty)
    ty += 5
  }

  ty += 4  // breathing room before pill

  if (confText) {
    sans(doc, 'normal', 8)
    const pillTextW = doc.getTextWidth(confText)
    const ppx = 5; const pillW = pillTextW + ppx * 2; const pillH = 6
    doc.setFillColor(pillBg[0], pillBg[1], pillBg[2])
    doc.setDrawColor(pillColor[0], pillColor[1], pillColor[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(tx, ty - pillH + 2, pillW, pillH, 1.5, 1.5, 'FD')
    doc.setTextColor(pillColor[0], pillColor[1], pillColor[2])
    doc.text(confText, tx + ppx, ty - 0.2)
    ty += 7
  }

  sans(doc, 'italic', 7.5)
  doc.setTextColor(T.faint[0], T.faint[1], T.faint[2])
  doc.text(bookedByText, tx, ty)

  return cardH
}

// ── Main render ───────────────────────────────────────────────────────────────

async function renderAll(doc: any, d: ConfirmationBriefData, emblem: Img | null, logo: Img | null) {
  const { trip, brief, house } = d

  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  // Hero
  if (d.heroImageData) {
    try {
      const raw = await loadImg(d.heroImageData)
      if (raw) {
        const cropped = await makeCoverCropAsync(raw.data, raw.format, raw.nw, raw.nh, P.w, P.heroH)
        doc.addImage(cropped.data, cropped.format, 0, 0, P.w, P.heroH, undefined, 'FAST')
      }
    } catch { /* silent */ }
  }
  if (!d.heroImageData) {
    doc.setFillColor(T.cardBg[0], T.cardBg[1], T.cardBg[2])
    doc.rect(0, 0, P.w, P.heroH, 'F')
  }

  // Cream mask — prevents any hero bleed onto title
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, P.heroH, P.w, P.h - P.heroH, 'F')

  drawFrostedLogoCard(doc, emblem, logo, brief?.logo_variant ?? null)

  // Cover text
  let y = P.heroH + 14

  const title = brief?.brief_title ?? d.destinationName
  serif(doc, 'normal', 32)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  for (const line of doc.splitTextToSize(title, CW)) {
    doc.text(line, P.w / 2, y, { align: 'center' }); y += 12
  }
  y += 4

  rule(doc, P.margin, y, CW, T.gold, 0.4); y += 8

  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text((brief?.brief_subtitle ?? 'TRIP CONFIRMATION BRIEF').toUpperCase(), P.w / 2, y, { align: 'center', charSpace: 0.8 })
  y += 8

  const preparedFor = brief?.prepared_for ?? house?.display_name ?? ''
  if (preparedFor) {
    serif(doc, 'italic', 12)
    doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])
    doc.text(`Prepared for ${preparedFor}`, P.w / 2, y, { align: 'center' }); y += 9
  }

  const dateRange = brief?.snapshot_dates ?? buildDateRange(trip.start_date, trip.end_date)
  if (dateRange) {
    sans(doc, 'normal', 9)
    doc.setTextColor(T.muted[0], T.muted[1], T.muted[2])
    doc.text(dateRange, P.w / 2, y, { align: 'center' }); y += 12
  }

  // Collect rooms
  const allRooms: { room: BookingRoom; booking: TripBooking }[] = []
  for (const b of trip.bookings.filter(bk => bk.brief_show !== false)) {
    if (b._rooms.length > 0) {
      for (const r of b._rooms) allRooms.push({ room: r, booking: b })
      continue
    }
    allRooms.push({
      room: {
        id: b.id, booking_id: b.id, room_name: b.name,
        confirmation_number: b.confirmation_number,
        guest_name: d.house?.display_name ?? null,
        party_composition: b.party_composition,
        notes: b.inclusions ?? null, nights: b.nights,
        rate: b.commissionable_rate, tax_pct: b.taxes_and_fees,
        total: null, brief_image_src: b.brief_image_src,
        additional_guests: null, booked_by_label: null,
        sort_order: b.sort_order ?? 0,
        created_at: b.created_at ?? '', updated_at: b.updated_at ?? '',
      },
      booking: b,
    })
  }

  if (allRooms.length === 0) return

  rule(doc, P.margin, y, CW); y += 8
  sans(doc, 'bold', 7)
  doc.setTextColor(T.gold[0], T.gold[1], T.gold[2])
  doc.text('CONFIRMED ARRANGEMENTS', P.margin, y, { charSpace: 0.5 }); y += 7

  const FOOTER_MARGIN = 18

  for (const { room, booking } of allRooms) {
    // Pre-measure card height
    const padH = 8; const padV = 7; const contentW = CW - Math.round(CW * 0.44)
    serif(doc, 'normal', 11)
    const nl = doc.splitTextToSize(room.room_name ?? 'Booking', contentW - padH * 2)
    const gp: string[] = []
    if (room.guest_name) gp.push(room.guest_name)
    if (room.additional_guests?.length) gp.push(...room.additional_guests)
    if (room.party_composition) gp.push(room.party_composition)
    const bH = room.confirmation_number ? 4 + 6 + 7 + 4.5 : 4 + 4.5
    const cH = padV + nl.length * 5.5 + (gp.length ? 10 : 0) + bH + padV
    const cardH = Math.max(36, cH)

    if (y + cardH > P.h - FOOTER_MARGIN) {
      doc.addPage()
      doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
      doc.rect(0, 0, P.w, P.h, 'F')
      y = 26
    }

    const drawn = await drawRoomCard(doc, room, booking, y)
    y += drawn + 4
  }
}

// ── Filename + export ─────────────────────────────────────────────────────────

function buildFilename(d: ConfirmationBriefData): string {
  // Trip Confirmation - {Client Name} - {Destination} {dd-dd Month YYYY}
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim()

  const clientName  = d.brief?.prepared_for ?? d.house?.display_name ?? d.trip.trip_code
  const destination = d.destinationName

  const dateRange = (() => {
    const s = d.trip.start_date; const e = d.trip.end_date
    if (!s) return ''
    const sd = new Date(s.slice(0, 10) + 'T00:00:00')
    const ed = e ? new Date(e.slice(0, 10) + 'T00:00:00') : null
    const month = sd.toLocaleDateString('en-US', { month: 'long' })
    const year  = sd.getFullYear()
    if (ed && ed.getMonth() === sd.getMonth() && ed.getFullYear() === sd.getFullYear()) {
      return `${sd.getDate()}-${ed.getDate()} ${month} ${year}`
    }
    return `${sd.getDate()} ${month} ${year}`
  })()

  return ['Trip Confirmation', safe(clientName), safe(destination), dateRange].filter(Boolean).join(' - ') + '.pdf'
}

export async function exportConfirmationBriefPdf(data: ConfirmationBriefData): Promise<void> {
  const w = window as any
  const jsPDF = w.jspdf?.jsPDF
  if (!jsPDF) throw new Error('jsPDF not loaded')

  const fontData = await loadGuideFonts()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  await renderAll(doc, data, emblem, logo)
  stampChrome(doc, data.brief)
  doc.save(buildFilename(data))
}