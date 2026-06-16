/* GuideDownloadTab.tsx — canonical PDF download UI for all four guide variants.
 *
 * Replaces the four near-identical DownloadTab components that used to live
 * inline across Guides<X>Tab files. One picker, one fetch path per variant,
 * three logo branding options (ambience / alfaone / unbranded).
 *
 * What it owns:
 *   - Three-button branding picker
 *   - jsPDF library readiness via useGuidePdf hook
 *   - Per-variant dispatch: resolves the right (destination, venues) pair
 *     for the active variant and hands the ExportGuidePdfOptions to
 *     handleDownloadPdf
 *   - Local copy defaults (from typesGuides GUIDE_COPY)
 *
 * What it does not own:
 *   - The modal shell
 *   - The PDF rendering itself (pdfGuide.ts)
 *   - The CDN load (useGuidePdf)
 *
 * Last updated: S52 — initial build.
 */

import { useState } from 'react'
import { A } from '../../../tokens/tokensAdmin'
import { useToast } from '../../../providers/ToastContext'
import { useGuidePdf } from '../../../hooks/useGuidePdf'
import {
  getGuideDestination,
  getDiningVenuesByDestination,
} from '../../../queries/queriesGuidesDining'
import {
  getExperiencesGuideDestination,
  getExperienceVenuesByDestination,
} from '../../../queries/queriesGuidesExperiences'
import {
  getHotelGuideDestination,
  getHotelsByDestination,
} from '../../../queries/queriesGuidesHotels'
import {
  getShoppingGuideDestination,
  fetchShoppingForDestination,
} from '../../../queries/queriesGuidesShopping'
import { fetchActiveHappeningsForDestination } from '../../../queries/queriesGuidesHappenings'
import {
  type GuideVariant,
  GUIDE_COPY,
} from '../../../types/typesGuides'

type LogoVariant = 'ambience' | 'alfaone' | 'unbranded'

const VARIANTS: { variant: LogoVariant; label: string; description: string }[] = [
  { variant: 'ambience',  label: 'Ambience',  description: 'Default branding — emblem + ambience.travel logo' },
  { variant: 'alfaone',   label: 'AlfaOne',   description: 'AlfaOne Concierge wordmark, gold serif' },
  { variant: 'unbranded', label: 'Unbranded', description: 'No logo, no restriction notice, no copyright' },
]

export default function GuideDownloadTab({
  variant,
  destinationSlug,
  destinationName,
  destinationId,
}: {
  variant:         GuideVariant
  destinationSlug: string
  destinationName: string
  destinationId:   string
}) {
  const { toast } = useToast()
  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()
  const [downloading, setDownloading] = useState<LogoVariant | null>(null)

  const copy = GUIDE_COPY[variant]

  async function handleDownload(logoVariant: LogoVariant) {
    if (!pdfReady) {
      toast.info('PDF library is still loading. Try again in a moment.')
      return
    }
    setDownloading(logoVariant)
    try {
      // Happenings are destination-level, not guide-variant-level — fetched
      // in parallel with the variant-specific data. Soft-fail: a happenings
      // query failure should not block the PDF.
      const happeningsPromise = fetchActiveHappeningsForDestination(
        destinationId,
        { surface: variant },
      ).catch(err => {
        console.error('GuideDownloadTab: happenings fetch failed', err)
        return []
      })

      // Variant-discriminated fetch. Each branch resolves to the right
      // (destination, venues) pair for ExportGuidePdfOptions.
      let payload
      if (variant === 'dining') {
        const [destination, venues, happenings] = await Promise.all([
          getGuideDestination(destinationSlug),
          getDiningVenuesByDestination(destinationSlug),
          happeningsPromise,
        ])
        if (!destination) { toast.error('Destination not found.'); setDownloading(null); return }
        const overlay      = destination.overlay
        const heroImageSrc = overlay?.hero_image_src ?? destination.heroImageSrc ?? null
        payload = {
          variant:      'dining' as const,
          destination,
          venues,
          happenings,
          copy: {
            eyebrow:  overlay?.eyebrow_override  ?? copy.defaultEyebrow,
            headline: overlay?.headline_override ?? `${destinationName} dining`,
            intro:    overlay?.intro_override    ?? '',
          },
          heroImageSrc,
          guideYear:    overlay?.guide_year    ?? new Date().getFullYear(),
          guideVersion: overlay?.guide_version ?? '1',
          accuracyDate: overlay?.accuracy_date ?? null,
          logoVariant,
        }
      } else if (variant === 'experiences') {
        const [destination, venues, happenings] = await Promise.all([
          getExperiencesGuideDestination(destinationSlug),
          getExperienceVenuesByDestination(destinationSlug),
          happeningsPromise,
        ])
        if (!destination) { toast.error('Destination not found.'); setDownloading(null); return }
        const overlay      = destination.overlay
        const heroImageSrc = overlay?.hero_image_src ?? destination.heroImageSrc ?? null
        payload = {
          variant:      'experiences' as const,
          destination,
          venues,
          happenings,
          copy: {
            eyebrow:  overlay?.eyebrow_override  ?? copy.defaultEyebrow,
            headline: overlay?.headline_override ?? `${destinationName} experiences`,
            intro:    overlay?.intro_override    ?? '',
          },
          heroImageSrc,
          guideYear:    overlay?.guide_year    ?? new Date().getFullYear(),
          guideVersion: overlay?.guide_version ?? '1',
          accuracyDate: overlay?.accuracy_date ?? null,
          logoVariant,
        }
      } else if (variant === 'hotels') {
        const [destination, venues, happenings] = await Promise.all([
          getHotelGuideDestination(destinationSlug),
          getHotelsByDestination(destinationSlug),
          happeningsPromise,
        ])
        if (!destination) { toast.error('Destination not found.'); setDownloading(null); return }
        const overlay      = destination.overlay
        const heroImageSrc = overlay?.hero_image_src ?? null
        payload = {
          variant:      'hotels' as const,
          destination,
          venues,
          happenings,
          copy: {
            eyebrow:  overlay?.eyebrow_override  ?? copy.defaultEyebrow,
            headline: overlay?.headline_override ?? `${destinationName} Hotels`,
            intro:    overlay?.intro_override    ?? '',
          },
          heroImageSrc,
          guideYear:    overlay?.guide_year    ?? new Date().getFullYear(),
          guideVersion: overlay?.guide_version ?? '1',
          accuracyDate: overlay?.accuracy_date ?? null,
          logoVariant,
        }
      } else {
        // shopping
        const [destination, venues, happenings] = await Promise.all([
          getShoppingGuideDestination(destinationSlug),
          fetchShoppingForDestination(destinationId),
          happeningsPromise,
        ])
        if (!destination) { toast.error('Destination not found.'); setDownloading(null); return }
        const overlay      = destination.overlay
        const heroImageSrc = overlay?.hero_image_src ?? destination.heroImageSrc ?? null
        payload = {
          variant:      'shopping' as const,
          destination,
          venues,
          happenings,
          copy: {
            eyebrow:  overlay?.eyebrow_override  ?? copy.defaultEyebrow,
            headline: overlay?.headline_override ?? `${destinationName} Shopping`,
            intro:    overlay?.intro_override    ?? '',
          },
          heroImageSrc,
          guideYear:    overlay?.guide_year    ?? new Date().getFullYear(),
          guideVersion: overlay?.guide_version ?? '1',
          accuracyDate: overlay?.accuracy_date ?? null,
          logoVariant,
        }
      }

      await handleDownloadPdf(payload)
      toast.success(`Downloaded ${logoVariant} variant.`)
    } catch (e) {
      toast.error(`Download failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
    setDownloading(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
        marginBottom: 4,
      }}>
        Download PDF
      </div>
      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginBottom: 8 }}>
        Choose the branding variant for this download. The guide content is identical across all variants.
      </div>

      {VARIANTS.map(({ variant: lv, label, description }) => (
        <button
          key={lv}
          onClick={() => handleDownload(lv)}
          disabled={downloading !== null || !pdfReady || pdfDownloading}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '14px 18px',
            background:     A.bgCard,
            border:         `1px solid ${A.border}`,
            borderRadius:   10,
            cursor:         downloading !== null ? 'not-allowed' : 'pointer',
            textAlign:      'left',
            fontFamily:     A.font,
            opacity:        downloading !== null && downloading !== lv ? 0.4 : 1,
            transition:     'border-color 150ms, opacity 150ms',
          }}
          onMouseEnter={e => {
            if (downloading === null) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = A.borderGold
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = A.border
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: A.text, marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 11, color: A.muted }}>
              {description}
            </div>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: A.gold,
            letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0,
          }}>
            {downloading === lv ? 'Generating…' : 'Download ↓'}
          </div>
        </button>
      ))}
    </div>
  )
}