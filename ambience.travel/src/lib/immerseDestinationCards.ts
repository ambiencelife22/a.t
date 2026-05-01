// immerseDestinationCards.ts — Dining + Experience content cards for /immerse/ subpages.
// Owns: getImmerseDestinationCards — single canonical cards fetcher.
// Does not own: canonical dining/experience seeding (lives in DB migrations),
//   trip overview content (lives in immerseEngagementQueries).
//
// Read shape (S32C cards refactor):
//   travel_immerse_trip_content_card_selections is engagement-scoped curation.
//   Joins to canonical travel_dining_venues + travel_experiences via
//   dining_venue_id / experience_id (mutually-exclusive XOR per row).
//   travel_immerse_trip_content_card_overrides keys on the same dual FK.
//   Result: filter selections by canonical row's global_destination_id (FK
//   truth), merge per-engagement overrides via ?? chain, return dining and
//   experiences pre-split.
//

import { supabase } from './supabase'
import { rewriteImageUrl } from './imageUrl'
import type { ImmerseContentCard } from './immerseTypes'

// ─── Public types ─────────────────────────────────────────────────────────────

// S32F: Cards fetcher returns dining + experiences pre-split, since they
// always render in two separate sections. Saves the consumer from filtering.
export interface ImmerseDestinationCards {
  dining:      ImmerseContentCard[]
  experiences: ImmerseContentCard[]
}

// ─── Internal types ──────────────────────────────────────────────────────────

type ContentCardWithType = ImmerseContentCard & { _cardType: 'dining' | 'experience' }

type CardOverrideRow = {
  dining_venue_id:           string | null
  experience_id:             string | null
  kicker_override:           string | null
  name_override:             string | null
  tagline_override:          string | null
  body_override:             string | null
  bullets_heading_override:  string | null
  bullets_override:          string[] | null
  image_src_override:        string | null
  image_alt_override:        string | null
  image_credit_override:     string | null
  image_credit_url_override: string | null
  image_license_override:    string | null
}

type CanonicalCardRow = {
  id:                string
  kicker:            string | null
  name:              string | null
  tagline:           string | null
  body:              string | null
  bullets_heading:   string | null
  bullets:           unknown
  image_src:         string | null
  image_alt:         string | null
  image_credit:      string | null
  image_credit_url:  string | null
  image_license:     string | null
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getImmerseDestinationCards(
  engagementId:        string,
  globalDestinationId: string,
): Promise<ImmerseDestinationCards> {
  const cards = await fetchContentCards(engagementId, globalDestinationId)
  return {
    dining:      cards.filter(c => c._cardType === 'dining').map(stripCardType),
    experiences: cards.filter(c => c._cardType === 'experience').map(stripCardType),
  }
}

// ─── Internal — UNION read on selections + override merge ────────────────────

async function fetchContentCards(
  engagementId:        string,
  globalDestinationId: string,
): Promise<ContentCardWithType[]> {
  if (!engagementId) return []

  const [diningRes, expRes] = await Promise.all([
    supabase
      .from('travel_immerse_trip_content_card_selections')
      .select(`
        sort_order,
        dining_venue_id,
        travel_dining_venues!inner (
          id, global_destination_id,
          kicker, name, tagline, body,
          bullets_heading, bullets,
          image_src, image_alt, image_credit, image_credit_url, image_license
        )
      `)
      .eq('trip_id', engagementId)
      .eq('is_active', true)
      .not('dining_venue_id', 'is', null)
      .eq('travel_dining_venues.global_destination_id', globalDestinationId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('travel_immerse_trip_content_card_selections')
      .select(`
        sort_order,
        experience_id,
        travel_experiences!inner (
          id, global_destination_id,
          kicker, name, tagline, body,
          bullets_heading, bullets,
          image_src, image_alt, image_credit, image_credit_url, image_license
        )
      `)
      .eq('trip_id', engagementId)
      .eq('is_active', true)
      .not('experience_id', 'is', null)
      .eq('travel_experiences.global_destination_id', globalDestinationId)
      .order('sort_order', { ascending: true }),
  ])

  if (diningRes.error && expRes.error) return []

  type SelectionWithCanon = {
    sort_order: number
    cardType:   'dining' | 'experience'
    fkId:       string
    canon:      CanonicalCardRow
  }

  const selections: SelectionWithCanon[] = []

  for (const row of (diningRes.data ?? [])) {
    const canon = row.travel_dining_venues as unknown as CanonicalCardRow | null
    if (!canon || !row.dining_venue_id) continue
    selections.push({
      sort_order: row.sort_order as number,
      cardType:   'dining',
      fkId:       row.dining_venue_id as string,
      canon,
    })
  }
  for (const row of (expRes.data ?? [])) {
    const canon = row.travel_experiences as unknown as CanonicalCardRow | null
    if (!canon || !row.experience_id) continue
    selections.push({
      sort_order: row.sort_order as number,
      cardType:   'experience',
      fkId:       row.experience_id as string,
      canon,
    })
  }

  if (selections.length === 0) return []

  const diningIds = selections.filter(s => s.cardType === 'dining').map(s => s.fkId)
  const expIds    = selections.filter(s => s.cardType === 'experience').map(s => s.fkId)

  const overrideQueries = []
  if (diningIds.length > 0) {
    overrideQueries.push(
      supabase
        .from('travel_immerse_trip_content_card_overrides')
        .select(`
          dining_venue_id, experience_id,
          kicker_override, name_override, tagline_override, body_override,
          bullets_heading_override, bullets_override,
          image_src_override, image_alt_override,
          image_credit_override, image_credit_url_override, image_license_override
        `)
        .eq('trip_id', engagementId)
        .eq('is_active', true)
        .in('dining_venue_id', diningIds)
    )
  }
  if (expIds.length > 0) {
    overrideQueries.push(
      supabase
        .from('travel_immerse_trip_content_card_overrides')
        .select(`
          dining_venue_id, experience_id,
          kicker_override, name_override, tagline_override, body_override,
          bullets_heading_override, bullets_override,
          image_src_override, image_alt_override,
          image_credit_override, image_credit_url_override, image_license_override
        `)
        .eq('trip_id', engagementId)
        .eq('is_active', true)
        .in('experience_id', expIds)
    )
  }

  const overrideResults = await Promise.all(overrideQueries)

  const overrideByDiningId = new Map<string, CardOverrideRow>()
  const overrideByExpId    = new Map<string, CardOverrideRow>()
  for (const res of overrideResults) {
    for (const ov of (res.data ?? []) as CardOverrideRow[]) {
      if (ov.dining_venue_id) overrideByDiningId.set(ov.dining_venue_id, ov)
      if (ov.experience_id)   overrideByExpId.set(ov.experience_id, ov)
    }
  }

  selections.sort((a, b) => a.sort_order - b.sort_order)

  return selections.map(s => {
    const ov = s.cardType === 'dining'
      ? overrideByDiningId.get(s.fkId)
      : overrideByExpId.get(s.fkId)

    const r = s.canon

    const bulletsOverride = ov?.bullets_override
    const bulletsCanon    = Array.isArray(r.bullets) ? (r.bullets as string[]) : null
    const bullets         = Array.isArray(bulletsOverride)
      ? (bulletsOverride as string[])
      : bulletsCanon ?? undefined

    return {
      _cardType:       s.cardType,
      id:              r.id,
      kicker:          ov?.kicker_override            ?? r.kicker            ?? '',
      name:            ov?.name_override              ?? r.name              ?? '',
      tagline:         ov?.tagline_override           ?? r.tagline           ?? '',
      body:            ov?.body_override              ?? r.body              ?? '',
      bulletsHeading:  ov?.bullets_heading_override   ?? r.bullets_heading   ?? '',
      bullets:         bullets,
      imageSrc:        rewriteImageUrl(ov?.image_src_override ?? r.image_src),
      imageAlt:        ov?.image_alt_override         ?? r.image_alt         ?? '',
      imageCredit:     ov?.image_credit_override      ?? r.image_credit      ?? undefined,
      imageCreditUrl:  ov?.image_credit_url_override  ?? r.image_credit_url  ?? undefined,
      imageLicense:    ov?.image_license_override     ?? r.image_license     ?? undefined,
    }
  })
}

function stripCardType(c: ContentCardWithType): ImmerseContentCard {
  const { _cardType, ...card } = c
  return card
}