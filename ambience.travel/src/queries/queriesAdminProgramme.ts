// queriesAdminProgramme.ts - Admin queries for the programme product.
//
// All reads + writes go through travel-read-programme-admin and
// travel-write-programme-admin EFs via supabase.functions.invoke.
// Zero direct supabase.from() calls.
//
// Mirrors the call sites in ProgrammeAdmin.tsx 1:1. Each function maps to
// exactly one EF mode.
//
// Last updated: S53G - initial build. Extracted from ProgrammeAdmin.tsx
//   (29 direct DB calls across 5 tables → 0).

import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProgrammeRow = {
  id:                   string
  urlId:               string
  programme_type:       string
  sub_path:             string
  status:               string
  active:               boolean
  isPublic:            boolean
  public_wifi:          boolean
  public_alarm:         boolean
  public_owner_phone:   boolean
  public_manager_phone: boolean
  no_alarm:             boolean
  public_arrival:       boolean
  guestNames:          string
  guestCount:          number
  checkIn:             string | null
  checkOut:            string | null
  welcomeLetter:       string
  propertyId:          string | null
  activeListingIds:   string[] | null
  alarm_code_provided:  boolean
  properties:           { id: string; name: string; slug: string } | null
}

export type PropertyRow = {
  id:                 string
  slug:               string
  name:               string
  tagline:            string | null
  city:               string | null
  country:            string | null
  hero_image:         string | null
  mapsUrl:           string | null
  mapsEmbedUrl:     string | null
  ownerName:         string | null
  ownerPhone:        string | null
  managerName:       string | null
  managerPhone:      string | null
  emergencyContacts: { label: string; phone: string }[]
  active:             boolean
}

export type ListingRow = {
  id:          string
  name:        string
  category:    string
  genre:       string | null
  address:     string
  website:     string | null
  hours:       string | null
  note:        string | null
  favourite:   boolean
  propertyId: string
}

export type PropertySectionRow = {
  id:          string
  title:       string
  icon:        string
  sortOrder:  number
  variant:     string
  content:     unknown
  propertyId: string
}

export type PropertySectionMeta = {
  id:    string
  title: string
  icon:  string
}

export type ProgrammeSectionRow = {
  id:         string
  section_id: string
  content:    unknown
}

export type ProgrammePayload = {
  urlId:               string
  programme_type:       string
  sub_path:             string
  status:               string
  guestNames:          string
  guestCount:          number
  checkIn:             string | null
  checkOut:            string | null
  welcomeLetter:       string
  propertyId:          string | null
  alarm_code_provided:  boolean
}

export type ListingPayload = {
  name:        string
  category:    string
  genre:       string | null
  address:     string
  website:     string | null
  hours:       string | null
  note:        string | null
  favourite:   boolean
  propertyId: string
}

export type PropertyPayload = {
  name:               string
  tagline:            string | null
  city:               string | null
  country:            string | null
  hero_image:         string | null
  mapsUrl:           string | null
  mapsEmbedUrl:     string | null
  ownerName:         string | null
  ownerPhone:        string | null
  managerName:       string | null
  managerPhone:      string | null
  emergencyContacts: { label: string; phone: string }[]
}

export type TogglableField =
  | 'active' | 'is_public' | 'public_wifi' | 'public_alarm'
  | 'public_owner_phone' | 'public_manager_phone' | 'no_alarm' | 'public_arrival'

// ── EF names ──────────────────────────────────────────────────────────────────

const READ_EF  = 'travel-read-programme-admin'
const WRITE_EF = 'travel-write-programme-admin'

// ── Error helper ──────────────────────────────────────────────────────────────
// supabase.functions.invoke wraps non-2xx in a FunctionsHttpError whose
// .context is the Response. Read the JSON body to recover our { error } shape.

async function extractError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context
  const fallback = error instanceof Error ? error.message : 'Unexpected error'
  if (!ctx || typeof ctx.json !== 'function') return fallback
  const body = await ctx.json().catch(() => null) as { error?: string } | null
  return body?.error ?? fallback
}

// ── Read functions ─────────────────────────────────────────────────────────────

export async function fetchProgrammes(): Promise<ProgrammeRow[]> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'programmes' },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.data as ProgrammeRow[]
}

export async function fetchProgrammeProperties(): Promise<PropertyRow[]> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'properties' },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.data as PropertyRow[]
}

export async function fetchProgrammePropertyStubs(): Promise<{ id: string; name: string; slug: string }[]> {
  const rows = await fetchProgrammeProperties()
  return rows.map(p => ({ id: p.id, name: p.name, slug: p.slug }))
}

export async function fetchListings(propertyId: string): Promise<ListingRow[]> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'listings', propertyId: propertyId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.data as ListingRow[]
}

export async function fetchPropertySections(propertyId: string): Promise<PropertySectionRow[]> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'property_sections', propertyId: propertyId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.data as PropertySectionRow[]
}

export async function fetchPropertySectionsMeta(propertyId: string): Promise<PropertySectionMeta[]> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'property_sections_meta', propertyId: propertyId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.data as PropertySectionMeta[]
}

export async function fetchProgrammeSections(programmeId: string): Promise<ProgrammeSectionRow[]> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'programme_sections', programme_id: programmeId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.data as ProgrammeSectionRow[]
}

// ── Write functions ────────────────────────────────────────────────────────────

export async function createProgramme(payload: ProgrammePayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'create_programme', payload },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function updateProgramme(id: string, payload: Partial<ProgrammePayload>): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_programme', id, payload },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function deleteProgramme(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'delete_programme', id },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function toggleProgrammeField(id: string, field: TogglableField, value: boolean): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'toggle_programme_field', id, field, value },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function updateWelcomeLetter(id: string, welcomeLetter: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_welcome_letter', id, welcomeLetter: welcomeLetter },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function updateProperty(id: string, payload: PropertyPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_property', id, payload },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function deleteProperty(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'delete_property', id },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function togglePropertyActive(id: string, value: boolean): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'toggle_property_active', id, value },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function createListing(payload: ListingPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'create_listing', payload },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function updateListing(id: string, payload: ListingPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_listing', id, payload },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function deleteListing(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'delete_listing', id },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function upsertProgrammeSection(
  existingId:  string | null,
  programmeId: string,
  sectionId:   string,
  content:     unknown,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: {
      mode:         'upsert_programme_section',
      existingId:  existingId,
      programme_id: programmeId,
      section_id:   sectionId,
      content,
    },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function deleteProgrammeSection(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'delete_programme_section', id },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function updateSectionContent(id: string, content: unknown): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_section_content', id, content },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function reorderPropertySections(
  idA: string, sortOrderA: number,
  idB: string, sortOrderB: number,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: {
      mode:         'reorder_property_sections',
      id_a:         idA,
      sort_order_a: sortOrderA,
      id_b:         idB,
      sort_order_b: sortOrderB,
    },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function updateSectionMeta(id: string, title: string, icon: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_section_meta', id, title, icon },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

// ── Programme guest functions (S53H - GuestLinker EF-compliance migration) ───

export interface ProgrammeGuest {
  id:           string
  programmeId:  string
  displayName:  string
  profileId:    string | null
  isLead:       boolean
  sortOrder:    number
  resolvedName: string | null
}

export interface GuestSearchResult {
  personId:    string
  profileId:   string | null
  displayName: string
  nickname:    string | null
  linkable:    boolean
}

export async function fetchProgrammeGuests(programmeId: string): Promise<ProgrammeGuest[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-journey-admin', {
    body: { mode: 'programme_guests', programme_id: programmeId },
  })
  if (error) throw error
  const guests = (data?.guests ?? []) as Array<Record<string, unknown>>
  return guests.map(mapGuest)
}

export async function searchProgrammeGuestCandidates(query: string): Promise<GuestSearchResult[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-journey-admin', {
    body: { mode: 'programme_guest_search', query },
  })
  if (error) throw error
  const results = (data?.results ?? []) as Array<Record<string, unknown>>
  return results.map(r => ({
    personId:    r.personId as string,
    profileId:   (r.profile_id as string | null) ?? null,
    displayName: (r.displayName as string) ?? '',
    nickname:    (r.nickname as string | null) ?? null,
    linkable:    !!r.linkable,
  }))
}

export async function linkProgrammeGuest(programmeId: string, personId: string): Promise<ProgrammeGuest> {
  const { data, error } = await supabase.functions.invoke('travel-write-journey', {
    body: { mode: 'link_programme_guest', programme_id: programmeId, personId: personId },
  })
  if (error) throw await toLinkError(error)
  return mapGuest((data?.guest ?? {}) as Record<string, unknown>)
}

export async function unlinkProgrammeGuest(guestId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-journey', {
    body: { mode: 'unlink_programme_guest', guest_id: guestId },
  })
  if (error) throw error
}

export async function removeProgrammeGuest(guestId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-journey', {
    body: { mode: 'remove_programme_guest', guest_id: guestId },
  })
  if (error) throw error
}

export type LinkErrorReason = 'no_profile' | 'already_linked' | 'no_name' | 'unknown'

export class LinkGuestError extends Error {
  reason: LinkErrorReason
  constructor(reason: LinkErrorReason, message: string) {
    super(message)
    this.name = 'LinkGuestError'
    this.reason = reason
  }
}

async function toLinkError(error: unknown): Promise<LinkGuestError> {
  const ctx = (error as { context?: Response })?.context
  const fallback = (error instanceof Error ? error.message : 'Could not link this guest.')
  if (!ctx || typeof ctx.json !== 'function') return new LinkGuestError('unknown', fallback)
  const body = await ctx.json().catch(() => null) as { error?: string; message?: string } | null
  const reason = (body?.error as LinkErrorReason) ?? 'unknown'
  const message = body?.message ?? fallback
  const known: LinkErrorReason[] = ['no_profile', 'already_linked', 'no_name']
  return new LinkGuestError(known.includes(reason) ? reason : 'unknown', message)
}

function mapGuest(r: Record<string, unknown>): ProgrammeGuest {
  return {
    id:           r.id as string,
    programmeId:  r.programme_id as string,
    displayName:  (r.displayName as string) ?? '',
    profileId:    (r.profile_id as string | null) ?? null,
    isLead:       !!r.is_lead,
    sortOrder:    (r.sortOrder as number) ?? 0,
    resolvedName: (r.resolved_name as string | null) ?? null,
  }
}