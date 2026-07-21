/* queriesAdminCardOverrides.ts
 * EF-routed query layer for engagement content-card overrides.
 * DB -> EF (travel-read-engagement-admin / travel-write-engagement) -> typesCards -> here -> frontend.
 * Frontend never touches the DB. camelizeKeys at every read boundary.
 */

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import type { CardKind, CardOverride, CardCanonicalOption, CardOverrideRow } from '../types/typesCards'

function shapeRow(r: CardOverrideRow): CardOverride {
  const isDining = r.diningVenueId !== null
  const canon = isDining ? r.dining : r.experience
  return {
    id:                      r.id,
    engagementId:            r.engagementId,
    diningVenueId:           r.diningVenueId,
    experienceId:            r.experienceId,
    kind:                    isDining ? 'dining' : 'experience',
    canonicalName:           canon?.name ?? null,
    canonicalImageSrc:       canon?.imageSrc ?? null,
    canonicalGlobalDestSlug: canon?.globalDestinations?.slug ?? null,
    kickerOverride:          r.kickerOverride,
    nameOverride:            r.nameOverride,
    taglineOverride:         r.taglineOverride,
    bodyOverride:            r.bodyOverride,
    bulletsHeadingOverride:  r.bulletsHeadingOverride,
    bulletsOverride:         r.bulletsOverride,
    imageSrcOverride:        r.imageSrcOverride,
    imageAltOverride:        r.imageAltOverride,
    imageCreditOverride:     r.imageCreditOverride,
    imageCreditUrlOverride:  r.imageCreditUrlOverride,
    imageLicenseOverride:    r.imageLicenseOverride,
    isActive:                r.isActive,
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

export async function fetchCardOverrides(engagementId: string): Promise<CardOverride[]> {
  const { rows } = await invokeRead<{ rows: CardOverrideRow[] }>({ mode: 'card_overrides', engagementId })
  return (rows ?? [])
    .map(shapeRow)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
      return (a.canonicalName ?? '').localeCompare(b.canonicalName ?? '')
    })
}

export async function updateCardOverride(id: string, payload: Partial<CardOverride>): Promise<void> {
  const fields: Record<string, unknown> = {}
  const persistableKeys: (keyof CardOverride)[] = [
    'kickerOverride', 'nameOverride', 'taglineOverride', 'bodyOverride',
    'bulletsHeadingOverride', 'bulletsOverride',
    'imageSrcOverride', 'imageAltOverride',
    'imageCreditOverride', 'imageCreditUrlOverride', 'imageLicenseOverride',
    'isActive',
  ]
  persistableKeys.forEach(k => {
    if (k in payload) fields[k] = payload[k]
  })
  if (Object.keys(fields).length === 0) return
  await invokeWrite({ mode: 'card_override_update', id, fields })
}

export async function insertCardOverride(args: { engagementId: string; kind: CardKind; cardId: string }): Promise<string> {
  const { id } = await invokeWrite<{ id: string }>({
    mode: 'card_override_insert',
    engagementId: args.engagementId,
    kind: args.kind,
    cardId: args.cardId,
  })
  return id
}

export async function deleteCardOverride(id: string): Promise<void> {
  await invokeWrite({ mode: 'card_override_delete', id })
}

export async function searchCanonicalCards(query: string): Promise<CardCanonicalOption[]> {
  const { rows } = await invokeRead<{ rows: CardCanonicalOption[] }>({ mode: 'canonical_card_search', query: query.trim() })
  return (rows ?? []).slice().sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}