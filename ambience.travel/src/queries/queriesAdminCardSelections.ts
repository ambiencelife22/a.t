/* queriesAdminCardSelections.ts
 * EF-routed query layer for engagement content-card selections + overrides.
 * DB -> EF (travel-read-engagement-admin / travel-write-engagement) -> typesCards -> here -> frontend.
 * Frontend never touches the DB. camelizeKeys at every read boundary.
 */

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import type {
  CardKind, CardSelection, CardCanonicalOption,
  CardSelectionRow, CardOverrideJoinRow,
} from '../types/typesCards'

function shapeRow(s: CardSelectionRow, override: CardOverrideJoinRow | null): CardSelection {
  const isDining = s.diningVenueId !== null
  const canon = isDining ? s.dining : s.experience
  return {
    id:                      s.id,
    engagementId:            s.engagementId,
    sortOrder:               s.sortOrder,
    isActive:                s.isActive,
    diningVenueId:           s.diningVenueId,
    experienceId:            s.experienceId,
    kind:                    isDining ? 'dining' : 'experience',
    canonicalName:           canon?.name ?? null,
    canonicalKicker:         canon?.kicker ?? null,
    canonicalTagline:        canon?.tagline ?? null,
    canonicalBody:           canon?.body ?? null,
    canonicalBulletsHeading: canon?.bulletsHeading ?? null,
    canonicalBullets:        canon?.bullets ?? null,
    canonicalImageSrc:       canon?.imageSrc ?? null,
    canonicalImageAlt:       canon?.imageAlt ?? null,
    canonicalImageCredit:    canon?.imageCredit ?? null,
    canonicalImageCreditUrl: canon?.imageCreditUrl ?? null,
    canonicalImageLicense:   canon?.imageLicense ?? null,
    canonicalGlobalDestSlug: canon?.globalDestinations?.slug ?? null,
    overrideId:              override?.id ?? null,
    kickerOverride:          override?.kickerOverride ?? null,
    nameOverride:            override?.nameOverride ?? null,
    taglineOverride:         override?.taglineOverride ?? null,
    bodyOverride:            override?.bodyOverride ?? null,
    bulletsHeadingOverride:  override?.bulletsHeadingOverride ?? null,
    bulletsOverride:         override?.bulletsOverride ?? null,
    imageSrcOverride:        override?.imageSrcOverride ?? null,
    imageAltOverride:        override?.imageAltOverride ?? null,
    imageCreditOverride:     override?.imageCreditOverride ?? null,
    imageCreditUrlOverride:  override?.imageCreditUrlOverride ?? null,
    imageLicenseOverride:    override?.imageLicenseOverride ?? null,
  }
}

async function invokeRead<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', { body })
  if (error) throw new Error(`travel-read-engagement-admin [${body.mode}]: ${error.message}`)
  return camelizeKeys<T>(data)
}

async function invokeWrite<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-engagement', { body })
  if (error) throw new Error(`travel-write-engagement [${body.mode}]: ${error.message}`)
  return data as T
}

export async function fetchCardSelections(engagementId: string): Promise<CardSelection[]> {
  const { selections, overrides } = await invokeRead<{ selections: CardSelectionRow[]; overrides: CardOverrideJoinRow[] }>({
    mode: 'card_selections', engagementId,
  })
  const overrideByKey = new Map<string, CardOverrideJoinRow>()
  ;(overrides ?? []).forEach(o => {
    if (o.diningVenueId) overrideByKey.set(`dining:${o.diningVenueId}`, o)
    if (o.experienceId) overrideByKey.set(`experience:${o.experienceId}`, o)
  })
  return (selections ?? []).map(s => {
    const key = s.diningVenueId ? `dining:${s.diningVenueId}` : `experience:${s.experienceId}`
    return shapeRow(s, overrideByKey.get(key) ?? null)
  })
}

export async function updateSelection(id: string, payload: { sortOrder?: number; isActive?: boolean }): Promise<void> {
  await invokeWrite({ mode: 'selection_update', id, fields: payload })
}

export async function insertSelection(args: { engagementId: string; kind: CardKind; cardId: string; sortOrder: number }): Promise<string> {
  const { id } = await invokeWrite<{ id: string }>({
    mode: 'selection_insert',
    engagementId: args.engagementId, kind: args.kind, cardId: args.cardId, sortOrder: args.sortOrder,
  })
  return id
}

export async function deleteSelection(id: string): Promise<void> {
  await invokeWrite({ mode: 'selection_delete', id })
}

export async function reorderSelections(orderedIds: string[]): Promise<void> {
  await invokeWrite({ mode: 'selections_reorder', orderedIds })
}

export async function upsertOverride(args: {
  engagementId: string; kind: CardKind; cardId: string; overrideId: string | null
  fields: Partial<Record<string, unknown>>
}): Promise<string> {
  if (args.overrideId) {
    await invokeWrite({ mode: 'card_override_update', id: args.overrideId, fields: args.fields })
    return args.overrideId
  }
  const { id } = await invokeWrite<{ id: string }>({
    mode: 'card_override_insert', engagement_id: args.engagementId, kind: args.kind, card_id: args.cardId,
  })
  if (Object.keys(args.fields).length > 0) {
    await invokeWrite({ mode: 'card_override_update', id, fields: args.fields })
  }
  return id
}

export async function deleteOverride(overrideId: string): Promise<void> {
  await invokeWrite({ mode: 'card_override_delete', id: overrideId })
}

export async function searchCanonicalCards(query: string): Promise<CardCanonicalOption[]> {
  const { rows } = await invokeRead<{ rows: CardCanonicalOption[] }>({ mode: 'canonical_card_search', query: query.trim() })
  return (rows ?? []).slice().sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function nextSortOrder(existing: CardSelection[], kind: CardKind): number {
  const inKind = existing.filter(c => c.kind === kind)
  if (inKind.length === 0) return 1
  return Math.max(...inKind.map(c => c.sortOrder)) + 1
}
export function resolveText(override: string | null, canonical: string | null): {
  state:    'default' | 'customised' | 'hidden'
  rendered: string
} {
  if (override === null) return { state: 'default',    rendered: canonical ?? '' }
  if (override === '')   return { state: 'hidden',     rendered: '' }
  return                        { state: 'customised', rendered: override }
}

export function resolveBullets(override: string[] | null, canonical: string[] | null): {
  state:    'default' | 'customised' | 'hidden'
  rendered: string[]
} {
  if (override === null)     return { state: 'default',    rendered: canonical ?? [] }
  if (override.length === 0) return { state: 'hidden',     rendered: [] }
  return                            { state: 'customised', rendered: override }
}
