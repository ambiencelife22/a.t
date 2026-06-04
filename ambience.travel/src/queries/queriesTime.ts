// src/queries/queriesTime.ts
// Frontend query layer for time tracking. All access via Class A Edge Functions.
// No direct table reads/writes (immerse/client-data architecture rule).
import { supabase } from '../lib/supabase';

async function invokeRead<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-timetracking', { body });
  if (error) throw error;
  return data as T;
}
async function invokeWrite<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-timetracking', { body });
  if (error) throw error;
  return data as T;
}

// ---- Reads ----
export const fetchTimeActivities = () =>
  invokeRead<{ activities: TimeActivity[] }>({ mode: 'activities' }).then(r => r.activities);

export const fetchTimeRates = () =>
  invokeRead<{ rates: TimeRate[] }>({ mode: 'rates' }).then(r => r.rates);

export const fetchTimeEntries = (filters: TimeEntryFilters = {}) =>
  invokeRead<{ entries: TimeEntry[] }>({ mode: 'entries', ...filters }).then(r => r.entries);

export const fetchTimeEntry = (id: string) =>
  invokeRead<{ entry: TimeEntry | null }>({ mode: 'entry', id }).then(r => r.entry);

export const fetchTimeSummaryByHouse = () =>
  invokeRead<{ summary: Record<string, TimeSummary> }>({ mode: 'summary_by_house' }).then(r => r.summary);

export const fetchTimeSummaryByEngagement = () =>
  invokeRead<{ summary: Record<string, TimeSummary> }>({ mode: 'summary_by_engagement' }).then(r => r.summary);

// ---- Pickers / resolvers (house <-> engagement via travel_bookings hub) ----
export const fetchHouses = (query = '') =>
  invokeRead<{ houses: HouseOption[] }>({ mode: 'houses', query }).then(r => r.houses);

export const fetchHousePeople = (house_id: string) =>
  invokeRead<{ people: HouseMember[] }>({ mode: 'house_people', house_id }).then(r => r.people);

export const fetchEngagementsForHouse = (house_id: string) =>
  invokeRead<{ engagements: EngagementOption[] }>({ mode: 'engagements_for_house', house_id }).then(r => r.engagements);

export const fetchHouseForEngagement = (engagement_id: string) =>
  invokeRead<{ house: HouseOption | null }>({ mode: 'house_for_engagement', engagement_id }).then(r => r.house);

// ---- Writes ----
export const createTimeEntry = (input: TimeEntryInput) =>
  invokeWrite<{ entry: TimeEntry }>({ mode: 'create_entry', ...input }).then(r => r.entry);

export const updateTimeEntry = (id: string, patch: Partial<TimeEntryInput> & {
  invoice_status?: string; invoiced_at?: string | null; paid_at?: string | null;
}) =>
  invokeWrite<{ entry: TimeEntry }>({ mode: 'update_entry', id, ...patch }).then(r => r.entry);

export const deleteTimeEntry = (id: string) =>
  invokeWrite<{ deleted: boolean }>({ mode: 'delete_entry', id }).then(r => r.deleted);

export const upsertTimeActivity = (input: Partial<TimeActivity> & { slug: string; label: string }) =>
  invokeWrite<{ activity: TimeActivity }>({ mode: 'upsert_activity', ...input }).then(r => r.activity);

export const upsertTimeRate = (input: Partial<TimeRate> & { slug: string; role_label: string; hourly_rate: number }) =>
  invokeWrite<{ rate: TimeRate }>({ mode: 'upsert_rate', ...input }).then(r => r.rate);

// ---- Types ----
export interface TimeActivity {
  id: string; slug: string; label: string; sort_order: number; is_active: boolean;
}
export interface TimeRate {
  id: string; slug: string; role_label: string; hourly_rate: number;
  currency: string; is_active: boolean;
}
export interface TimeEntryFilters {
  house_id?: string; engagement_id?: string;
  work_date_from?: string; work_date_to?: string;
}
export interface TimeEntryInput {
  house_id: string;
  engagement_id?: string | null;
  house_person_id?: string | null;
  work_date: string;            // ISO YYYY-MM-DD
  hours: number;                // >0, <=5, 0.25 steps
  activity_id?: string | null;
  notes?: string | null;
  entry_type?: 'billable' | 'proactive';
  performed_by?: string | null;
  rate_id?: string | null;      // billable_amount computed server-side
  started_at?: string | null;
  ended_at?: string | null;
}
export interface TimeEntry extends TimeEntryInput {
  id: string;
  rate_applied: number | null;
  billable_amount: number | null;
  invoice_status: 'uninvoiced' | 'invoiced' | 'paid';
  invoiced_at: string | null;
  paid_at: string | null;
  created_at: string; updated_at: string;
  travel_time_activities?: { slug: string; label: string } | null;
  travel_time_rates?: { slug: string; role_label: string; hourly_rate: number; currency: string } | null;
}
export interface TimeSummary { hours: number; amount: number; }

export interface HouseOption {
  id: string; a_house_id: string | null; display_name: string | null;
}
export interface HouseMember {
  id: string; house_id: string; person_id: string | null;
  member_ref: string | null; role: string | null; display_name: string | null;
}
export interface EngagementOption {
  id: string; url_id: string | null; title: string | null; iteration_label: string | null;
}