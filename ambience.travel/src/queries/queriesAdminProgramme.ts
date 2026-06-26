/* queries/queriesAdminProgramme.ts
 * Admin-side programme query module. Single source for the admin programme-guest
 * surface. Every function invokes an Edge Function — zero direct supabase.from().
 *
 * Boundary discipline: EFs speak snake_case (DB/JSON). This module is the seam —
 * it maps every snake_case response into camelCase before anything in the repo
 * touches it. No snake_case keys leak past this file.
 *
 * Guest identity model: a programme guest links a global_people PERSON to a
 * programme via that person's global_profiles.id. Search resolves person -> profile
 * server-side and reports `linkable` (has a login account). Linking a person with no
 * profile is refused server-side (no dead links).
 *
 * Created: S53H — GuestLinker EF-compliance migration.
 */

import { supabase } from '../lib/supabase'

// ── Types (TitleCase; camelCase fields) ──────────────────────────────────────

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

// ── Reads (travel-read-trip-admin) ───────────────────────────────────────────

export async function fetchProgrammeGuests(programmeId: string): Promise<ProgrammeGuest[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-trip-admin', {
    body: { mode: 'programme_guests', programme_id: programmeId },
  })
  if (error) throw error
  const guests = (data?.guests ?? []) as Array<Record<string, unknown>>
  return guests.map(mapGuest)
}

export async function searchProgrammeGuestCandidates(query: string): Promise<GuestSearchResult[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-trip-admin', {
    body: { mode: 'programme_guest_search', query },
  })
  if (error) throw error
  const results = (data?.results ?? []) as Array<Record<string, unknown>>
  return results.map(r => ({
    personId:    r.person_id as string,
    profileId:   (r.profile_id as string | null) ?? null,
    displayName: (r.display_name as string) ?? '',
    nickname:    (r.nickname as string | null) ?? null,
    linkable:    !!r.linkable,
  }))
}

// ── Writes (travel-write-trip) ───────────────────────────────────────────────

// Resolves person -> profile server-side. Throws a typed error when the person has
// no login account (no_profile) or is already linked (already_linked), so the UI can
// give precise direction.
export async function linkProgrammeGuest(programmeId: string, personId: string): Promise<ProgrammeGuest> {
  const { data, error } = await supabase.functions.invoke('travel-write-trip', {
    body: { mode: 'link_programme_guest', programme_id: programmeId, person_id: personId },
  })
  // functions.invoke surfaces non-2xx as `error`; the JSON body carries our reason.
  if (error) throw await toLinkError(error)
  return mapGuest((data?.guest ?? {}) as Record<string, unknown>)
}

export async function unlinkProgrammeGuest(guestId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-trip', {
    body: { mode: 'unlink_programme_guest', guest_id: guestId },
  })
  if (error) throw error
}

export async function removeProgrammeGuest(guestId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-trip', {
    body: { mode: 'remove_programme_guest', guest_id: guestId },
  })
  if (error) throw error
}

// ── Typed link errors ─────────────────────────────────────────────────────────

export type LinkErrorReason = 'no_profile' | 'already_linked' | 'no_name' | 'unknown'

export class LinkGuestError extends Error {
  reason: LinkErrorReason
  constructor(reason: LinkErrorReason, message: string) {
    super(message)
    this.name = 'LinkGuestError'
    this.reason = reason
  }
}

// supabase.functions.invoke wraps non-2xx in a FunctionsHttpError whose .context is
// the Response. Read the JSON body to recover our { error, message } shape.
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

// ── Private mappers ───────────────────────────────────────────────────────────

function mapGuest(r: Record<string, unknown>): ProgrammeGuest {
  return {
    id:           r.id as string,
    programmeId:  r.programme_id as string,
    displayName:  (r.display_name as string) ?? '',
    profileId:    (r.profile_id as string | null) ?? null,
    isLead:       !!r.is_lead,
    sortOrder:    (r.sort_order as number) ?? 0,
    resolvedName: (r.resolved_name as string | null) ?? null,
  }
}