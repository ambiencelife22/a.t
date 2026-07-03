// queriesImmerseProposal.ts — Client adapter for travel-get-immerse-proposal EF.
//
// Single source for all client-facing proposal data — overview and subpages.
// Replaces:
//   queriesImmerseEngagement.ts   (engagement fetch + hydration)
//   queriesImmerseDestCore.ts     (destination core + slug resolution)
//   queriesImmerseDestHotels.ts   (hotels + rooms + gallery)
//   queriesImmerseDestCards.ts    (dining + experience cards)
//   queriesImmerseDestPricing.ts  (destination pricing rows)
//
// The EF does all DB work server-side via service role. This file:
//   - Calls the EF
//   - Applies rewriteImageUrl on all image fields
//   - Maps raw EF response to existing TypeScript shapes (ImmerseEngagementData,
//     ImmerseDestinationData, etc.) — no shape changes downstream
//
// Public API:
//   getProposalEngagement(urlId)                    → ImmerseEngagementData | null
//   getProposalDestination(urlId, destinationSlug)  → ImmerseDestinationData | null
//
// Created: S53H — consolidation. Replaces 5 client-side query files.

import { supabaseAnon } from '../lib/supabase'
import { rewriteImageUrl, rewriteImageUrls } from '../utils/utilsImageUrl'
import { mapEngagementStatus, mapItineraryStatus } from '../queries/queriesStatus'
import { computeEngagementStage } from '../types/typesImmerse'
import type {
  ImmerseEngagementData,
  ImmerseDestinationData,
  ImmerseDestinationHotelsShape,
  ImmerseHotelOption,
  ImmerseRegionGroup,
  ImmerseRoomOption,
  ImmerseContentCard,
  ImmersePricingRow,
  ImmersePricingNote,
  ImmerseRouteStop,
  ImmerseDestinationRow,
  ImmerseTripPricingRow,
  ImmerseWelcomeLetter,
  EngagementAudience,
  EngagementStatusSlug,
} from '../types/typesImmerse'

// ── EF call ───────────────────────────────────────────────────────────────────

type EFResponse =
  | { mode: 'overview'; engagement: Record<string, unknown> }
  | { mode: 'subpage';  engagement: Record<string, unknown>; destination: Record<string, unknown> }
  | { error: string }

async function callEF(urlId: string, destinationSlug?: string): Promise<EFResponse | null> {
  try {
    const { data, error } = await supabaseAnon.functions.invoke('travel-get-immerse-proposal', {
      body: { url_id: urlId, destination_slug: destinationSlug },
    })
    if (error || !data) return null
    if (data.error) return null
    return data as EFResponse
  } catch {
    return null
  }
}

// ── Public: engagement overview ───────────────────────────────────────────────

export async function getProposalEngagement(urlId: string): Promise<ImmerseEngagementData | null> {
  const result = await callEF(urlId)
  if (!result || 'error' in result) return null
  return hydrateEngagement(result.engagement)
}

// ── Public: destination subpage ───────────────────────────────────────────────

export async function getProposalDestination(
  urlId:           string,
  destinationSlug: string,
): Promise<ImmerseDestinationData | null> {
  const result = await callEF(urlId, destinationSlug)
  if (!result || 'error' in result || result.mode !== 'subpage') return null
  return hydrateDestination(result.destination)
}

// ── Hydrate engagement ────────────────────────────────────────────────────────

function hydrateEngagement(payload: Record<string, unknown>): ImmerseEngagementData | null {
  const eng     = payload.engagementRow as Record<string, unknown>
  const display = payload.display       as Record<string, unknown> | null
  const stops   = payload.routeStops    as Record<string, unknown>[]
  const dests   = payload.destinationRows as Record<string, unknown>[]
  const tmplMap = payload.templateHeroMap as Record<string, { hero_image_src: string | null; hero_image_alt: string | null }>
  const pricing = payload.tripPricingRows as Record<string, unknown>[]
  const welcome = payload.welcomeLetter   as Record<string, unknown> | null

  if (!eng) return null

  const statusRow   = eng.travel_lifecycle_statuses as Record<string, unknown> | null
  const itinRow     = eng.travel_itinerary_statuses as Record<string, unknown> | null
  const statusSlug  = (statusRow?.slug ?? 'requested') as EngagementStatusSlug
  const stage       = computeEngagementStage({ statusSlug })
  const clientName  = (display?.nickname ?? display?.first_name ?? 'Our VIP Guest') as string

  const engagementStatus = statusRow ? mapEngagementStatus(statusRow as any) : EMPTY_STATUS
  const itineraryStatus  = itinRow   ? mapItineraryStatus(itinRow as any)    : EMPTY_ITIN

  const welcomeLetter: ImmerseWelcomeLetter = {
    eyebrow:     (eng.welcome_eyebrow_override ?? welcome?.eyebrow      ?? '') as string,
    title:       (eng.welcome_title_override   ?? welcome?.title        ?? '') as string,
    body:        (eng.welcome_body_override    ?? welcome?.body         ?? '') as string,
    signoffBody: (eng.welcome_signoff_body_override ?? welcome?.signoff_body ?? '') as string,
    signoffName: (eng.welcome_signoff_name_override ?? welcome?.signoff_name ?? '') as string,
  }

  const routeStops: ImmerseRouteStop[] = stops.map(r => ({
    id:              r.id as string,
    title:           (r.title      ?? '') as string,
    stayLabel:       (r.stay_label ?? '') as string,
    note:            (r.note       ?? '') as string,
    imageSrc:        rewriteImageUrl(r.image_src as string | null),
    imageAlt:        (r.image_alt  ?? '') as string,
    destinationRowId: (r.destination_row_id ?? null) as string | null,
    nights:          r.nights as number | undefined,
  }))

  const destinationRows: ImmerseDestinationRow[] = dests.map(r => {
    const gd         = r.global_destinations as Record<string, unknown> | null
    const globalSlug = (gd?.slug ?? null) as string | null
    const globalId   = (gd?.id   ?? null) as string | null
    const fallback   = globalId ? tmplMap[globalId] : null

    const resolvedImageSrc =
      (r.image_src as string | null)
      ?? fallback?.hero_image_src
      ?? (gd?.hero_image_src as string | null)
      ?? null

    const resolvedImageAlt =
      (r.image_alt as string | null)
      ?? fallback?.hero_image_alt
      ?? (gd?.hero_image_alt as string | null)
      ?? ''

    return {
      id:                  r.id as string,
      numberLabel:         (r.number_label ?? '') as string,
      title:               (r.title        ?? '') as string,
      mood:                (r.mood         ?? '') as string,
      summary:             (r.summary      ?? '') as string,
      stayLabel:           (r.stay_label   ?? '') as string,
      nights:              r.nights as number | undefined,
      imageSrc:            rewriteImageUrl(resolvedImageSrc),
      imageAlt:            resolvedImageAlt as string,
      destinationSlug:     globalSlug,
      destinationUrlSlug:  (r.destination_url_slug ?? null) as string | null,
      subpageStatus:       normalizeSubpageStatus(r.subpage_status as string | null),
      heroEyebrowOverride: (r.hero_eyebrow_override ?? undefined) as string | undefined,
    }
  })

  const tripPricingRows: ImmerseTripPricingRow[] = pricing.map(r => {
    const gd = r.global_destinations as Record<string, unknown> | null
    return {
      id:               r.id as string,
      destination:      (gd?.name ?? '') as string,
      recommendedBasis: (r.recommended_basis ?? '') as string,
      stayLabel:        (r.stay_label        ?? '') as string,
      indicativeRange:  (r.indicative_range  ?? '') as string,
    }
  })

  return {
    engagementId:    eng.id as string,
    audience:        normalizeAudience(eng.audience as string | null),
    urlId:           eng.url_id as string,
    stage,
    proposalVisibility: (eng.proposal_visibility ?? 'active') as 'active' | 'archived',
    slug:            eng.slug as string,
    journeyTypes:    (eng.journey_types ?? []) as string[],
    clientName,
    statusLabel:     (eng.status_label ?? '') as string,
    heroTagline:     (eng.hero_tagline ?? undefined) as string | undefined,
    heroEyebrowOverride: (eng.hero_eyebrow_override ?? undefined) as string | undefined,

    engagementStatus,
    itineraryStatus,
    welcomeLetter,

    eyebrow:       (eng.eyebrow   ?? '') as string,
    title:         (eng.title     ?? '') as string,
    subtitle:      (eng.subtitle  ?? '') as string,
    heroImageSrc:  rewriteImageUrl(eng.hero_image_src as string | null),
    heroImageAlt:  (eng.hero_image_alt ?? '') as string,
    heroImageSrc2: rewriteImageUrl(eng.hero_image_src_2 as string | null) ?? undefined,
    heroImageAlt2: (eng.hero_image_alt_2 ?? undefined) as string | undefined,
    heroTitle2:    (eng.hero_title_2    ?? undefined) as string | undefined,
    heroSubtitle2: (eng.hero_subtitle_2 ?? undefined) as string | undefined,
    heroPills:     (eng.hero_pills ?? []) as string[],

    routeHeading:  (eng.route_heading ?? '') as string,
    routeBody:     (eng.route_body    ?? '') as string,
    routeEyebrow:  (eng.route_eyebrow ?? undefined) as string | undefined,
    routeStops,

    destinationHeading:   (eng.destination_heading   ?? '') as string,
    destinationSubtitle:  (eng.destination_subtitle  ?? undefined) as string | undefined,
    destinationBody:      (eng.destination_body      ?? undefined) as string | undefined,
    destinationRows,

    pricingHeading:      (eng.pricing_heading       ?? '') as string,
    pricingTitle:        (eng.pricing_title         ?? '') as string,
    pricingBody:         (eng.pricing_body          ?? '') as string,
    pricingRows:         tripPricingRows,
    pricingTotalLabel:   (eng.pricing_total_label   ?? '') as string,
    pricingTotalValue:   (eng.pricing_total_value   ?? '') as string,
    pricingNotesHeading: (eng.pricing_notes_heading ?? '') as string,
    pricingNotesTitle:   (eng.pricing_notes_title   ?? '') as string,
    pricingNotes:        normalizePricingNotes(eng.pricing_notes),
  }
}

// ── Hydrate destination ───────────────────────────────────────────────────────

function hydrateDestination(payload: Record<string, unknown>): ImmerseDestinationData | null {
  const dest      = payload.destTemplate        as Record<string, unknown> | null
  const ov        = payload.destRow             as Record<string, unknown> | null
  const globalHero = payload.globalHero         as Record<string, unknown> | null
  const hotels    = payload.hotels              as Record<string, unknown>
  const cards     = payload.cards               as { dining: Record<string, unknown>[]; experiences: Record<string, unknown>[] }
  const pricing   = payload.pricingRows         as Record<string, unknown>[]

  if (!dest || !ov) return null

  const destinationId = payload.destinationId        as string
  const engagementId  = payload.tripDestinationRowId as string  // journeyId in shape

  // Hero image resolver: override → template → global canon
  const heroSrc = rewriteImageUrl(
    (ov.hero_image_src_override ?? dest.hero_image_src ?? globalHero?.hero_image_src) as string | null
  )
  const heroAlt = (ov.hero_image_alt_override ?? dest.hero_image_alt ?? globalHero?.hero_image_alt ?? '') as string
  const hero2Src = rewriteImageUrl(
    (ov.hero_image_src_2_override ?? dest.hero_image_src_2) as string | null
  )

  return {
    destinationId,
    destinationSlug:     payload.destinationUrlSlug as string ?? (dest.slug as string ?? ''),
    journeyId:           engagementId,
    shorthand:           (dest.shorthand ?? undefined) as string | undefined,

    eyebrow:      (dest.eyebrow  ?? '') as string,
    title:        (dest.title    ?? '') as string,
    subtitle:     (dest.subtitle ?? '') as string,
    heroImageSrc: heroSrc,
    heroImageAlt: heroAlt,
    heroImageSrc2: hero2Src ?? undefined,
    heroImageAlt2: (ov.hero_image_alt_2_override ?? dest.hero_image_alt_2 ?? undefined) as string | undefined,
    heroTitle2:    (ov.hero_title_2_override    ?? dest.hero_title_2    ?? undefined) as string | undefined,
    heroSubtitle2: (ov.hero_subtitle_2_override ?? dest.hero_subtitle_2 ?? undefined) as string | undefined,
    heroPills:     (dest.hero_pills ?? []) as string[],

    introEyebrow: (dest.intro_eyebrow ?? '') as string,
    introTitle:   (ov.intro_title_override ?? dest.intro_title ?? '') as string,
    introBody:    (ov.intro_body_override  ?? dest.intro_body  ?? '') as string,

    hotelsEyebrow: (dest.hotels_eyebrow ?? '') as string,
    hotelsTitle:   (dest.hotels_title   ?? '') as string,
    hotelsBody:    (dest.hotels_body    ?? '') as string,
    hotels:        hydrateHotelsShape(hotels),

    diningEyebrow: (ov.dining_eyebrow_override ?? dest.dining_eyebrow ?? '') as string,
    diningTitle:   (ov.dining_title_override   ?? dest.dining_title   ?? '') as string,
    diningBody:    (ov.dining_body_override    ?? dest.dining_body    ?? '') as string,
    dining:        (cards?.dining ?? []).map(hydrateContentCard),

    experiencesEyebrow: (ov.experiences_eyebrow_override ?? dest.experiences_eyebrow ?? '') as string,
    experiencesTitle:   (ov.experiences_title_override   ?? dest.experiences_title   ?? '') as string,
    experiencesBody:    (ov.experiences_body_override    ?? dest.experiences_body    ?? '') as string,
    experiences:        (cards?.experiences ?? []).map(hydrateContentCard),

    pricingEyebrow: (dest.pricing_eyebrow ?? '') as string,
    pricingTitle:   (dest.pricing_title   ?? '') as string,
    pricingBody:    (ov.pricing_body_override ?? dest.pricing_body ?? '') as string,
    pricingRows:    (pricing ?? []).map(hydratePricingRow),
    pricingCloser: {
      item:            (ov.pricing_closer_item_override             ?? null) as string | null,
      basis:           (ov.pricing_closer_basis_override            ?? null) as string | null,
      stay:            (ov.pricing_closer_stay_override             ?? null) as string | null,
      indicativeRange: (ov.pricing_closer_indicative_range_override ?? null) as string | null,
    },
    pricingNotesHeading: (ov.pricing_notes_heading_override ?? dest.pricing_notes_heading ?? '') as string,
    pricingNotesTitle:   (ov.pricing_notes_title_override   ?? dest.pricing_notes_title   ?? '') as string,
    pricingNotes:        normalizePricingNotes(ov.pricing_notes_override ?? dest.pricing_notes),
  }
}

// ── Hotels shape ──────────────────────────────────────────────────────────────

function hydrateHotelsShape(raw: Record<string, unknown>): ImmerseDestinationHotelsShape {
  if (!raw) return { kind: 'flat', hotels: [] }
  if (raw.kind === 'regioned') {
    const regions = (raw.regions as Record<string, unknown>[]).map(hydrateRegionGroup)
    return { kind: 'regioned', regions }
  }
  const hotels = (raw.hotels as Record<string, unknown>[]).map(hydrateHotelOption)
  return { kind: 'flat', hotels }
}

function hydrateRegionGroup(r: Record<string, unknown>): ImmerseRegionGroup {
  const tr = r.tripRegion as Record<string, unknown> | null
  return {
    regionId:      r.id as string,
    slug:          r.slug as string,
    title:         (r.title     ?? '') as string,
    shorthand:     (r.shorthand ?? undefined) as string | undefined,
    rank:          ((tr?.rank ?? 'primary') as 'primary' | 'secondary'),
    rankLabel:     (tr?.rank_label ?? '') as string,
    bullets:       (Array.isArray(tr?.bullets) ? tr!.bullets : []) as string[],
    stayLabel:     (tr?.stay_label ?? '') as string,
    heroImageSrc:  rewriteImageUrl(r.hero_image_src as string | null) ?? undefined,
    heroImageAlt:  (r.hero_image_alt ?? undefined) as string | undefined,
    regionGallery: rewriteImageUrls(r.region_gallery as string[] | null),
    hotels:        (r.hotels as Record<string, unknown>[]).map(hydrateHotelOption),
  }
}

function hydrateHotelOption(r: Record<string, unknown>): ImmerseHotelOption {
  return {
    id:           r.id as string,
    storageSlug:  (r.storageSlug  ?? '') as string,
    rank:         ((r.rank ?? 'primary') as 'primary' | 'secondary'),
    rankLabel:    (r.rankLabel    ?? '') as string,
    name:         (r.name         ?? '') as string,
    bullets:      (Array.isArray(r.bullets) ? r.bullets : []) as string[],
    imageSrc:     rewriteImageUrl(r.imageSrc as string | null),
    imageAlt:     (r.imageAlt     ?? '') as string,
    imageCredit:  (r.imageCredit  ?? undefined) as string | undefined,
    stayLabel:    (r.stayLabel    ?? '') as string,
    resortMapSrc: (r.resortMapSrc ?? undefined) as string | undefined,
    michelinKeys: (r.michelinKeys ?? undefined) as number | undefined,
    rooms:        (r.rooms as Record<string, unknown>[]).map(hydrateRoomOption),
    gallery:      rewriteImageUrls(r.gallery as string[] | null),
  }
}

function hydrateRoomOption(r: Record<string, unknown>): ImmerseRoomOption {
  return {
    tierLabel:                (r.tierLabel   ?? '') as string,
    levelLabel:               (r.levelLabel  ?? '') as string,
    roomBasis:                (r.roomBasis   ?? '') as string,
    roomBenefits:             (Array.isArray(r.roomBenefits) ? r.roomBenefits : []) as string[],
    roomImageSrc:             rewriteImageUrl(r.roomImageSrc as string | null),
    roomImageAlt:             (r.roomImageAlt ?? '') as string,
    roomGallery:              rewriteImageUrls(r.roomGallery as string[] | null),
    floorplanSrc:             rewriteImageUrl(r.floorplanSrc as string | null) ?? undefined,
    publicNightlyRate:        (r.publicNightlyRate        ?? undefined) as string | undefined,
    nonNegotiatedNightlyRate: (r.nonNegotiatedNightlyRate ?? undefined) as string | undefined,
    ambienceNightlyRate:      (r.ambienceNightlyRate      ?? undefined) as string | undefined,
    taxInclusive:             (r.taxInclusive             ?? false)     as boolean,
    rateSuffix:               (r.rateSuffix               ?? undefined) as string | undefined,
    rateCadence:              (r.rateCadence              ?? undefined) as string | undefined,
    taxTreatment:             (r.taxTreatment             ?? undefined) as string | undefined,
    roomAlert:                (r.roomAlert                ?? undefined) as string | undefined,
    roomAlertLevel:           (r.roomAlertLevel           ?? undefined) as string | undefined,
    roomId:                   (r.roomId                   ?? undefined) as string | undefined,
    overlayId:                (r.overlayId                ?? undefined) as string | undefined,
    connectedOverlayId:       (r.connectedOverlayId       ?? undefined) as string | undefined,
    connectedRoomId:          (r.connectedRoomId          ?? undefined) as string | undefined,
    connectingNote:           (r.connectingNote           ?? undefined) as string | undefined,
    sqftMin:                  (r.sqftMin ?? undefined) as number | undefined,
    sqftMax:                  (r.sqftMax ?? undefined) as number | undefined,
    sqmMin:                   (r.sqmMin  ?? undefined) as number | undefined,
    sqmMax:                   (r.sqmMax  ?? undefined) as number | undefined,
  }
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function hydrateContentCard(r: Record<string, unknown>): ImmerseContentCard {
  return {
    id:             r.id as string,
    kicker:         (r.kicker         ?? '') as string,
    name:           (r.name           ?? '') as string,
    tagline:        (r.tagline        ?? '') as string,
    body:           (r.body           ?? '') as string,
    bulletsHeading: (r.bulletsHeading ?? undefined) as string | undefined,
    bullets:        (Array.isArray(r.bullets) ? r.bullets : undefined) as string[] | undefined,
    imageSrc:       rewriteImageUrl(r.imageSrc as string | null),
    imageAlt:       (r.imageAlt       ?? '') as string,
    imageCredit:    (r.imageCredit    ?? undefined) as string | undefined,
    imageCreditUrl: (r.imageCreditUrl ?? undefined) as string | undefined,
    imageLicense:   (r.imageLicense   ?? undefined) as string | undefined,
  }
}

// ── Pricing rows ──────────────────────────────────────────────────────────────

function hydratePricingRow(r: Record<string, unknown>): ImmersePricingRow {
  return {
    id:              r.id as string,
    item:            (r.item            ?? '') as string,
    basis:           (r.basis           ?? '') as string,
    stay:            (r.stay            ?? '') as string,
    indicativeRange: (r.indicativeRange ?? '') as string,
    isTotal:         (r.isTotal         ?? false) as boolean,
  }
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeSubpageStatus(v: string | null) {
  if (v === 'live' || v === 'preview' || v === 'hidden') return v
  return 'live' as const
}

function normalizePricingNotes(raw: unknown): ImmersePricingNote[] {
  if (!Array.isArray(raw)) return []
  return raw.map(n =>
    typeof n === 'string'
      ? { text: n, highlighted: false }
      : { text: String((n as Record<string, unknown>).text ?? ''), highlighted: Boolean((n as Record<string, unknown>).highlighted) }
  )
}

function normalizeAudience(v: string | null): EngagementAudience {
  if (v === 'private' || v === 'public') return v
  return 'private'
}

// ── Empty status stubs ────────────────────────────────────────────────────────

const EMPTY_STATUS = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }
const EMPTY_ITIN   = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }