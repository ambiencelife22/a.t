// src/queries/queriesTeam.ts
// Frontend query layer for the ambience team (global_team). All access via
// the global-read-team / global-write-team Edge Functions. No direct table
// reads/writes (client-data architecture rule).
//
// global_team is a cross-product entity. The time-tracker "Performed By" picker
// is the first consumer (members + member_by_person), but this layer is the
// canonical client access for team data ecosystem-wide.
import { supabase } from '../lib/supabase';

async function invokeRead<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('global-read-team', { body });
  if (error) throw error;
  return data as T;
}
async function invokeWrite<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('global-write-team', { body });
  if (error) throw error;
  return data as T;
}

// ---- Reads ----
export const fetchTeamMembers = (includeInactive = false) =>
  invokeRead<{ members: TeamMember[] }>({ mode: 'members', include_inactive: includeInactive })
    .then(r => r.members);

export const fetchTeamMemberById = (id: string) =>
  invokeRead<{ member: TeamMember | null }>({ mode: 'member_by_id', id }).then(r => r.member);

// Used to default "Performed By" to the logged-in admin's own team row.
export const fetchTeamMemberByPerson = (personId: string) =>
  invokeRead<{ member: TeamMember | null }>({ mode: 'member_by_person', person_id: personId }).then(r => r.member);

// ---- Writes ----
export const upsertTeamMember = (input: TeamMemberInput) =>
  invokeWrite<{ member: TeamMemberRow }>({ mode: 'upsert_member', ...input }).then(r => r.member);

export const setTeamMemberActive = (personId: string, isActive: boolean) =>
  invokeWrite<{ member: TeamMemberRow }>({ mode: 'set_active', person_id: personId, is_active: isActive }).then(r => r.member);

// ---- Types ----
export type TeamRole = 'owner' | 'admin' | 'member';

// Resolved member (read shape - joined to global_people + travel_time_rates).
export interface TeamMember {
  id: string;
  personId: string;
  role: TeamRole;
  isActive: boolean;
  defaultRateId: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  rateLabel: string | null;
  hourlyRate: number | null;
  currency: string | null;
}

// Raw row returned by writes (unjoined).
export interface TeamMemberRow {
  id: string;
  personId: string;
  role: TeamRole;
  isActive: boolean;
  defaultRateId: string | null;
}

export interface TeamMemberInput {
  personId: string;                  // required; keyed on this (UNIQUE)
  role?: TeamRole;                    // omit to leave unchanged on update
  default_rate_id?: string | null;
  is_active?: boolean;
}