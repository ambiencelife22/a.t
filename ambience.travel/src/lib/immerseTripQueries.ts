// immerseTripQueries.ts — Supabase query layer for immerse engagement master data
// Owns:
//   - getImmerseEngagement(urlId)        — full ImmerseEngagementData fetch by public url_id
//   - getImmerseEngagementBySlug(slug)   — full ImmerseEngagementData fetch by slug
//                                          (used for public previews like /immerse/honeymoon/)
// Does not own: destination subpage data (see immerseQueries.ts)
// Last updated: S30E — Engagement abstraction. Master table renamed
//   travel_immerse_trips → travel_immerse_engagements; status table renamed
//   travel_trip_statuses → travel_engagement_statuses; FK column renamed
//   trip_status_id → engagement_status_id. Engagement_type discriminator
//   column added with DB DEFAULT 'journey' — surfaced on
//   ImmerseEngagementData.engagementType. All public functions renamed
//   getImmerseTrip → getImmerseEngagement (etc.). Internal locals renamed
//   tripRow/tripId → engagementRow/engagementId. Child table .eq('trip_id', …)
//   filters preserved verbatim — child tables (route_stops,
//   trip_destination_rows, trip_pricing_rows, trip_display) keep "trip"
//   prefix because they describe journey-engagement-specific detail; the
//   engagement_type discriminator is the signal for type-specific dispatch.
// Prior: S30D — Trip + itinerary status FK lookups. travel_immerse_trips
//   carried trip_status_id + itinerary_status_id (both NOT NULL FKs) into
//   travel_trip_statuses + travel_itinerary_statuses. Hydration resolved both
//   via Supabase nested select; ImmerseTripData carried tripStatus +
//   itineraryStatus as full TripStatus / ItineraryStatus objects (id, slug,
//   label, sortOrder, isActive). Existing statusLabel free-text field
//   preserved — different concept (guest-facing display copy vs operator-facing
//   lifecycle state). Mappers imported from statusQueries.ts to avoid
//   duplicating the snake_case → camelCase shape.
// Prior: S30D — Storage URL rewriting at the read layer. Trip hero
//   (image 1 + image 2), route stop image_src, and destination row image_src
//   pass through rewriteImageUrl() before reaching components. The Supabase
//   project-host prefix never reaches rendered HTML; the /img/* rewrite in
//   vercel.json proxies these to Supabase Storage at the edge. Defensive +
//   idempotent — see imageUrl.ts.
// Prior: S30 — Welcome letter hydration. fetchCanonicalWelcomeLetter()
//   reads the single row in travel_immerse_welcome_letter. Per-engagement 5x
//   welcome_*_override columns on travel_immerse_engagements resolved via the
//   standard ?? chain. ImmerseEngagementData.welcomeLetter is always present
//   (never optional); every field is '' when all sources are null.
// Prior: S25 — swap display-name read from global_people_display → travel_immerse_trip_display.
//   Engagement-keyed (via trip_id column on the display table — child table
//   keeps "trip" naming), unconditional, maybeSingle(). Preserves nickname →
//   first_name → 'Our VIP Guest' fallback via trip_display's first_name +
//   nickname columns. Sync from global_people handled DB-side by
//   trg_sync_trip_display_from_person.
// Prior: S20 — hydrate subpage_status column into ImmerseDestinationRow.subpageStatus;
//   filter 'hidden' rows at the query layer.

import { supabaseAnon } from './supabase'
import { rewriteImageUrl } from './imageUrl'
import { mapEngagementStatus, mapItineraryStatus } from './statusQueries'
import type {
  ImmerseEngagementData,
  EngagementType,
  ImmerseTripFormat,
  ImmerseRouteStop,
  ImmerseDestinationRow,
  ImmerseSubpageStatus,
  ImmerseTripPricingRow,
  ImmerseWelcomeLetter,
  EngagementStatus,
  ItineraryStatus,
} from './immerseTypes'

// ── DB row types ─────────────────────────────────────────────────────────────

// S30D: nested join row shape returned by Supabase for status FKs.
// Identical for both engagement + itinerary statuses (lookup tables share schema).
type StatusJoinRow = {
  id:         string
  slug:       string
  label:      string
  sort_order: number
  is_active:  boolean
}

// S30E: TripRow → EngagementRow. Adds engagement_type discriminator.
// Renamed FK column trip_status_id → engagement_status_id; nested join key
// travel_trip_statuses → travel_engagement_statuses.
type EngagementRow = {
  id:                              string
  url_id:                          string
  slug:                            string
  trip_format:                     string
  engagement_type:                 string                       // S30E
  journey_types:                   string[] | null
  person_id:                       string | null
  status_label:                    string | null
  // S30E: status FK column + nested join row
  engagement_status_id:            string                       // S30E (was trip_status_id)
  itinerary_status_id:             string
  travel_engagement_statuses:      StatusJoinRow | null         // S30E (was travel_trip_statuses)
  travel_itinerary_statuses:       StatusJoinRow | null
  eyebrow:                         string | null
  title:                           string | null
  subtitle:                        string | null
  hero_image_src:                  string | null
  hero_image_alt:                  string | null
  hero_image_src_2:                string | null
  hero_image_alt_2:                string | null
  hero_title_2:                    string | null
  hero_subtitle_2:                 string | null
  hero_pills:                      string[] | null
  welcome_eyebrow_override:        string | null   // S30
  welcome_title_override:          string | null   // S30
  welcome_body_override:           string | null   // S30
  welcome_signoff_body_override:   string | null   // S30
  welcome_signoff_name_override:   string | null   // S30
  route_heading:                   string | null
  route_body:                      string | null
  route_eyebrow:                   string | null
  destination_heading:             string | null
  destination_subtitle:            string | null
  destination_body:                string | null
  pricing_heading:                 string | null
  pricing_title:                   string | null
  pricing_body:                    string | null
  pricing_total_label:             string | null
  pricing_total_value:             string | null
  pricing_notes_heading:           string | null
  pricing_notes_title:             string | null
  pricing_notes:                   string[] | null
}

// S25: narrowed from PersonDisplayRow(id, first_name, last_name, nickname)
// to only the fields trip_display exposes. first_name + nickname are sufficient
// for the display-name fallback chain in hydrateEngagement.
type TripDisplayRow = {
  first_name: string | null
  nickname:   string | null
}

// S30: Canonical proposal welcome letter row shape.
type WelcomeLetterRow = {
  eyebrow:      string | null
  title:        string | null
  body:         string | null
  signoff_body: string | null
  signoff_name: string | null
}

type RouteStopRow = {
  id:         string
  sort_order: number
  title:      string | null
  stay_label: string | null
  note:       string | null
  image_src:  string | null
  image_alt:  string | null
}

// S20: subpage_status added to select list. NOT NULL DEFAULT 'live' in DB —
// nullable here only as a defensive fallback if a legacy row somehow lacks it.
type DestinationRowRow = {
  id:                string
  sort_order:        number
  number_label:      string | null
  title:             string | null
  mood:              string | null
  summary:           string | null
  stay_label:        string | null
  image_src:         string | null
  image_alt:         string | null
  destination_slug:  string | null
  subpage_status:    string | null
}

type PricingRowRow = {
  id:                 string
  sort_order:         number
  destination:        string | null
  recommended_basis:  string | null
  stay_label:         string | null
  indicative_range:   string | null
}

// ── Public fetch ─────────────────────────────────────────────────────────────
// S30E: ENGAGEMENT_SELECT_COLUMNS pulls engagement_type discriminator and
// the renamed engagement_status_id FK + travel_engagement_statuses join.
// Itinerary side preserved verbatim. Pattern matches the canonical
// travel_accom_hotels nested select used in immerseQueries.ts.

const ENGAGEMENT_SELECT_COLUMNS = `
  id, url_id, slug, trip_format, engagement_type, journey_types,
  person_id, status_label,
  engagement_status_id, itinerary_status_id,
  travel_engagement_statuses (id, slug, label, sort_order, is_active),
  travel_itinerary_statuses (id, slug, label, sort_order, is_active),
  eyebrow, title, subtitle,
  hero_image_src, hero_image_alt, hero_image_src_2, hero_image_alt_2,
  hero_title_2, hero_subtitle_2, hero_pills,
  welcome_eyebrow_override, welcome_title_override, welcome_body_override,
  welcome_signoff_body_override, welcome_signoff_name_override,
  route_heading, route_body, route_eyebrow,
  destination_heading, destination_subtitle, destination_body,
  pricing_heading, pricing_title, pricing_body,
  pricing_total_label, pricing_total_value,
  pricing_notes_heading, pricing_notes_title, pricing_notes
`

export async function getImmerseEngagement(urlId: string): Promise<ImmerseEngagementData | null> {
  const { data: engagement, error: engagementErr } = await supabaseAnon
    .from('travel_immerse_engagements')
    .select(ENGAGEMENT_SELECT_COLUMNS)
    .eq('url_id', urlId)
    .single()

  if (engagementErr || !engagement) return null
  return hydrateEngagement(engagement as unknown as EngagementRow)
}

export async function getImmerseEngagementBySlug(slug: string): Promise<ImmerseEngagementData | null> {
  const { data: engagement, error: engagementErr } = await supabaseAnon
    .from('travel_immerse_engagements')
    .select(ENGAGEMENT_SELECT_COLUMNS)
    .eq('slug', slug)
    .single()

  if (engagementErr || !engagement) return null
  return hydrateEngagement(engagement as unknown as EngagementRow)
}

// S30: Canonical welcome letter is a single-row table. maybeSingle() returns
// null if the table is somehow empty; component handles "all empty" as hidden.
async function fetchCanonicalWelcomeLetter(): Promise<WelcomeLetterRow | null> {
  const { data } = await supabaseAnon
    .from('travel_immerse_welcome_letter')
    .select('eyebrow, title, body, signoff_body, signoff_name')
    .limit(1)
    .maybeSingle()
  return (data ?? null) as WelcomeLetterRow | null
}

// S30D: defensive fallback when a status join row is somehow missing.
// Both FK columns are NOT NULL in DB so this should never fire — keeps
// the type contract on ImmerseEngagementData (non-nullable) honest if it does.
const EMPTY_ENGAGEMENT_STATUS: EngagementStatus = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }
const EMPTY_ITINERARY_STATUS:  ItineraryStatus  = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }

// S30E: defensive fallback for engagement_type. DB DEFAULT 'journey' makes
// this unreachable for current rows; the narrow protects against future
// CHECK enum drift before types update.
function normalizeEngagementType(value: string): EngagementType {
  if (value === 'journey')      return 'journey'
  if (value === 'service')      return 'service'
  if (value === 'experience')   return 'experience'
  if (value === 'acquisition')  return 'acquisition'
  return 'journey'
}

// ── Shared hydration ─────────────────────────────────────────────────────────

async function hydrateEngagement(engagementRow: EngagementRow): Promise<ImmerseEngagementData | null> {
  const engagementId = engagementRow.id

  // S25: display-name read is now engagement-keyed and unconditional. Public
  // template hits its trip_display row with first_name=NULL and falls through
  // to the 'Our VIP Guest' default. Yazeed's engagement hits his row with
  // first_name='Yazeed'. Note: trip_display.trip_id column kept for child-
  // table scope-preservation (S30E §VI rename protocol).
  // S30: canonical welcome letter fetched in parallel.
  const [displayRes, stopsRes, destsRes, pricingRes, welcomeCanon] = await Promise.all([
    supabaseAnon
      .from('travel_immerse_trip_display')
      .select('first_name, nickname')
      .eq('trip_id', engagementId)
      .maybeSingle(),
    supabaseAnon
      .from('travel_immerse_route_stops')
      .select('id, sort_order, title, stay_label, note, image_src, image_alt')
      .eq('trip_id', engagementId)
      .order('sort_order'),
    // S20: subpage_status added to select; 'hidden' rows filtered server-side
    supabaseAnon
      .from('travel_immerse_trip_destination_rows')
      .select('id, sort_order, number_label, title, mood, summary, stay_label, image_src, image_alt, destination_slug, subpage_status')
      .eq('trip_id', engagementId)
      .neq('subpage_status', 'hidden')
      .order('sort_order'),
    supabaseAnon
      .from('travel_immerse_trip_pricing_rows')
      .select('id, sort_order, destination, recommended_basis, stay_label, indicative_range')
      .eq('trip_id', engagementId)
      .order('sort_order'),
    fetchCanonicalWelcomeLetter(),
  ])

  const displayRow = (displayRes.data  ?? null) as TripDisplayRow | null
  const stopRows   = (stopsRes.data    ?? []) as RouteStopRow[]
  const destRows   = (destsRes.data    ?? []) as unknown as DestinationRowRow[]
  const priceRows  = (pricingRes.data  ?? []) as PricingRowRow[]

  const clientName = displayRow?.nickname
    ?? displayRow?.first_name
    ?? 'Our VIP Guest'

  // S30E: status FKs resolved via nested join. Both NOT NULL in DB so the
  // fallback to EMPTY_*_STATUS should never trigger; if it ever does, the
  // empty slug ('') will fail the union narrow at any consumer that branches
  // on EngagementStatusSlug — visible failure mode preferred over silent default.
  const engagementStatus: EngagementStatus = engagementRow.travel_engagement_statuses
    ? mapEngagementStatus(engagementRow.travel_engagement_statuses)
    : EMPTY_ENGAGEMENT_STATUS

  const itineraryStatus: ItineraryStatus = engagementRow.travel_itinerary_statuses
    ? mapItineraryStatus(engagementRow.travel_itinerary_statuses)
    : EMPTY_ITINERARY_STATUS

  // S30: engagement override → canonical → '' for all 5 welcome letter fields.
  const welcomeLetter: ImmerseWelcomeLetter = {
    eyebrow:     engagementRow.welcome_eyebrow_override      ?? welcomeCanon?.eyebrow      ?? '',
    title:       engagementRow.welcome_title_override        ?? welcomeCanon?.title        ?? '',
    body:        engagementRow.welcome_body_override         ?? welcomeCanon?.body         ?? '',
    signoffBody: engagementRow.welcome_signoff_body_override ?? welcomeCanon?.signoff_body ?? '',
    signoffName: engagementRow.welcome_signoff_name_override ?? welcomeCanon?.signoff_name ?? '',
  }

  // S30D: route stop image_src rewritten on the way out.
  const routeStops: ImmerseRouteStop[] = stopRows.map(r => ({
    id:        r.id,
    title:     r.title      ?? '',
    stayLabel: r.stay_label ?? '',
    note:      r.note       ?? '',
    imageSrc:  rewriteImageUrl(r.image_src),
    imageAlt:  r.image_alt  ?? '',
  }))

  // S30D: destination row image_src rewritten on the way out.
  const destinationRows: ImmerseDestinationRow[] = destRows.map(r => ({
    id:              r.id,
    numberLabel:     r.number_label ?? '',
    title:           r.title        ?? '',
    mood:            r.mood         ?? '',
    summary:         r.summary      ?? '',
    stayLabel:       r.stay_label   ?? '',
    imageSrc:        rewriteImageUrl(r.image_src),
    imageAlt:        r.image_alt    ?? '',
    destinationSlug: r.destination_slug,
    subpageStatus:   normalizeSubpageStatus(r.subpage_status),  // S20
  }))

  const tripPricingRows: ImmerseTripPricingRow[] = priceRows.map(r => ({
    id:               r.id,
    destination:      r.destination        ?? '',
    recommendedBasis: r.recommended_basis  ?? '',
    stayLabel:        r.stay_label         ?? '',
    indicativeRange:  r.indicative_range   ?? '',
  }))

  // S30D: hero image fields rewritten. heroImageSrc2 uses `|| undefined`
  // to preserve the existing optional-undefined contract — rewriteImageUrl
  // returns '' on null/empty input.
  const heroSrc2Resolved = rewriteImageUrl(engagementRow.hero_image_src_2)

  return {
    engagementId:    engagementRow.id,
    engagementType:  normalizeEngagementType(engagementRow.engagement_type),  // S30E
    urlId:           engagementRow.url_id,
    slug:            engagementRow.slug,
    tripFormat:      (engagementRow.trip_format as ImmerseTripFormat) ?? 'journey',
    journeyTypes:    engagementRow.journey_types ?? [],
    clientName,
    statusLabel:     engagementRow.status_label ?? '',

    engagementStatus,   // S30E (was tripStatus)
    itineraryStatus,

    welcomeLetter,

    eyebrow:       engagementRow.eyebrow        ?? '',
    title:         engagementRow.title          ?? '',
    subtitle:      engagementRow.subtitle       ?? '',
    heroImageSrc:  rewriteImageUrl(engagementRow.hero_image_src),
    heroImageAlt:  engagementRow.hero_image_alt ?? '',
    heroImageSrc2: heroSrc2Resolved || undefined,
    heroImageAlt2: engagementRow.hero_image_alt_2 ?? undefined,
    heroTitle2:    engagementRow.hero_title_2    ?? undefined,
    heroSubtitle2: engagementRow.hero_subtitle_2 ?? undefined,
    heroPills:     engagementRow.hero_pills     ?? [],

    routeHeading:  engagementRow.route_heading ?? '',
    routeBody:     engagementRow.route_body    ?? '',
    routeEyebrow:  engagementRow.route_eyebrow ?? undefined,
    routeStops,

    destinationHeading:   engagementRow.destination_heading   ?? '',
    destinationSubtitle:  engagementRow.destination_subtitle  ?? undefined,
    destinationBody:      engagementRow.destination_body      ?? undefined,
    destinationRows,

    pricingHeading:      engagementRow.pricing_heading       ?? '',
    pricingTitle:        engagementRow.pricing_title         ?? '',
    pricingBody:         engagementRow.pricing_body          ?? '',
    pricingRows:         tripPricingRows,
    pricingTotalLabel:   engagementRow.pricing_total_label   ?? '',
    pricingTotalValue:   engagementRow.pricing_total_value   ?? '',
    pricingNotesHeading: engagementRow.pricing_notes_heading ?? '',
    pricingNotesTitle:   engagementRow.pricing_notes_title   ?? '',
    pricingNotes:        engagementRow.pricing_notes         ?? [],
  }
}

// S20: defensive normalizer — DB has NOT NULL DEFAULT 'live' but this catches
// any unexpected value from a legacy migration or schema drift.
function normalizeSubpageStatus(value: string | null): ImmerseSubpageStatus {
  if (value === 'live')    return 'live'
  if (value === 'preview') return 'preview'
  if (value === 'hidden')  return 'hidden'
  return 'live'
}