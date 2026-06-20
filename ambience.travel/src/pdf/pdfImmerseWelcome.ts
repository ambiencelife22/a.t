// pdfImmerseWelcome.ts — Welcome Letter PDF export for ambience.TRAVEL
//
// What it owns:
//   - jsPDF lifecycle (register fonts, page chrome, save)
//   - Letter layout: small wordmark, "Dear {name}," salutation, authored body.
//     ONE PAGE PER GUEST. All guests in one PDF (for the hotel to print).
//
// What it does not own:
//   - The letter bodies or recipient list — passed in by the caller.
//   - Footer, theme, helpers → pdfShared.ts
//   - Font loading / registration → pdfFonts.ts
//
// Model: each guest's letter is its OWN authored body (the letters genuinely
// differ per guest — see the manual example). The salutation "Dear {name},"
// is rendered automatically; everything else (including the sign-off and signer)
// is part of the authored body text. {{guest_name}} in a body is substituted
// with that recipient's name for convenience.
//
// No hero by design — this is correspondence, not a brochure.

import { loadGuideFonts, registerGuideFonts } from './pdfFonts'
import { assertJsPdf, loadImg, loadSvg, serif } from './pdfUtils'
import type { Img } from './pdfUtils'
import { T, P, CW, ASSETS, stampPageChrome } from './pdfShared'
import type { TripBrief, DossierTrip } from '../queries/queriesAdminTrip'

// ── Public types ──────────────────────────────────────────────────────────────

export interface WelcomeRecipient {
  guest_name: string         // substituted into "Dear {name}," and any {{guest_name}}
  body:       string         // the authored letter for this guest (incl. sign-off)
}

export interface WelcomeLetterData {
  trip:       DossierTrip
  brief:      TripBrief | null
  recipients: WelcomeRecipient[]
}

// ── Layout ────────────────────────────────────────────────────────────────────

const LETTER = {
  topY:        28,   // wordmark baseline
  bodyTopY:    52,   // salutation start
  lineH:       5.6,  // body line height (mm)
  paraGap:     3.5,  // extra gap between paragraphs
  footerGuard: P.h - 22,
} as const

function personalise(text: string, guestName: string): string {
  return text.replace(/\{\{\s*guest_name\s*\}\}/gi, guestName)
}

// ── Wordmark (small, top-centre — no hero) ─────────────────────────────────────

function drawWordmark(doc: any, emblem: Img | null, logo: Img | null): void {
  const eS = 7; const gap = 3
  const logoH = 7; const logoW = logoH * 3.0
  const totalW = eS + gap + logoW
  const x = (P.w - totalW) / 2
  const y = LETTER.topY - eS

  if (emblem) doc.addImage(emblem.data, emblem.format, x, y, eS, eS, undefined, 'FAST')
  if (logo)   doc.addImage(logo.data,   logo.format,   x + eS + gap, y + (eS - logoH) / 2 + 0.3, logoW, logoH, undefined, 'FAST')
}

// ── One guest's letter (one page) ──────────────────────────────────────────────

function renderLetter(doc: any, recipient: WelcomeRecipient, emblem: Img | null, logo: Img | null): void {
  doc.setFillColor(T.cream[0], T.cream[1], T.cream[2])
  doc.rect(0, 0, P.w, P.h, 'F')

  drawWordmark(doc, emblem, logo)

  let y = LETTER.bodyTopY

  // Salutation — rendered automatically.
  serif(doc, 'normal', 12)
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2])
  doc.text(`Dear ${recipient.guest_name},`, P.margin, y)
  y += LETTER.lineH * 2

  // Body — authored verbatim (sign-off + signer are written into this text).
  // Paragraphs split on blank lines; single newlines preserved as line breaks.
  const body = personalise(recipient.body ?? '', recipient.guest_name)
  const paragraphs = body.split(/\n\s*\n/).map(p => p.replace(/\s+$/g, '')).filter(p => p.trim())

  serif(doc, 'normal', 11)
  doc.setTextColor(T.inkSoft[0], T.inkSoft[1], T.inkSoft[2])

  for (const para of paragraphs) {
    const rawLines = para.split('\n')
    for (const raw of rawLines) {
      const wrapped = doc.splitTextToSize(raw.trim(), CW)
      for (const line of wrapped) {
        if (y > LETTER.footerGuard) {
          doc.addPage()
          doc.setFillColor(T.cream[0], T.cream[1], T.cream[2]); doc.rect(0, 0, P.w, P.h, 'F')
          y = LETTER.bodyTopY
        }
        doc.text(line, P.margin, y); y += LETTER.lineH
      }
    }
    y += LETTER.paraGap
  }
}

// ── Filename ──────────────────────────────────────────────────────────────────

function buildFilename(data: WelcomeLetterData): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim()
  const dest = data.trip.destinations[0]?.name ?? 'Trip'
  return `Welcome Letters - ${safe(dest)}.pdf`
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportWelcomeLetterPdf(data: WelcomeLetterData): Promise<void> {
  const jsPDF    = assertJsPdf()
  const fontData = await loadGuideFonts()
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGuideFonts(doc, fontData)

  const [emblem, logo] = await Promise.all([
    loadImg(ASSETS.emblem),
    loadSvg(ASSETS.logoSvg, 800),
  ])

  const recipients = data.recipients.filter(r => r.guest_name?.trim())
  if (recipients.length === 0) return

  recipients.forEach((r, i) => {
    if (i > 0) doc.addPage()
    renderLetter(doc, r, emblem, logo)
  })

  stampPageChrome(doc, data.brief)
  doc.save(buildFilename(data))
}