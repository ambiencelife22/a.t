// src/queries/queriesTime.ts
// Frontend query layer for time tracking. All access via Class A Edge Functions.
// No direct table reads/writes (immerse/client-data architecture rule).
import { supabase } from '../lib/supabase';
import { snakeizeKeys } from '@shared/camelize';

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

export const fetchHousePeople = (houseId: string) =>
  invokeRead<{ people: HouseMember[] }>({ mode: 'house_people', house_id: houseId }).then(r => r.people);

export const fetchEngagementsForHouse = (houseId: string) =>
  invokeRead<{ engagements: EngagementOption[] }>({ mode: 'engagements_for_house', house_id: houseId }).then(r => r.engagements);

export const fetchHouseForEngagement = (engagementId: string) =>
  invokeRead<{ house: HouseOption | null }>({ mode: 'house_for_engagement', engagement_id: engagementId }).then(r => r.house);

// ---- Analytics ----
export const fetchTimeAnalytics = (filters: TimeAnalyticsFilters = {}, groupBy: AnalyticsGroupBy = 'house') =>
  invokeRead<TimeAnalyticsResult>({ mode: 'analytics', group_by: groupBy, ...filters });

// ---- Writes ----
export const createTimeEntry = (input: TimeEntryInput) =>
  invokeWrite<{ entry: TimeEntry }>({ mode: 'create_entry', ...snakeizeKeys<Record<string, unknown>>(input) }).then(r => r.entry);

export const updateTimeEntry = (id: string, patch: Partial<TimeEntryInput> & {
  invoiceStatus?: string; invoicedAt?: string | null; paidAt?: string | null;
}) =>
  invokeWrite<{ entry: TimeEntry }>({ mode: 'update_entry', id, ...snakeizeKeys<Record<string, unknown>>(patch) }).then(r => r.entry);

export const deleteTimeEntry = (id: string) =>
  invokeWrite<{ deleted: boolean }>({ mode: 'delete_entry', id }).then(r => r.deleted);

export const upsertTimeActivity = (input: Partial<TimeActivity> & { slug: string; label: string }) =>
  invokeWrite<{ activity: TimeActivity }>({ mode: 'upsert_activity', ...input }).then(r => r.activity);

export const upsertTimeRate = (input: Partial<TimeRate> & { slug: string; role_label: string; hourlyRate: number }) =>
  invokeWrite<{ rate: TimeRate }>({ mode: 'upsert_rate', ...input }).then(r => r.rate);

// ---- Types ----
export interface TimeActivity {
  id: string; slug: string; label: string; sortOrder: number; isActive: boolean;
}
export interface TimeRate {
  id: string; slug: string; role_label: string; hourlyRate: number;
  currency: string; isActive: boolean;
}
export interface TimeEntryFilters {
  house_id?: string; engagement_id?: string;
  work_date_from?: string; work_date_to?: string;
}
export interface TimeEntryInput {
  houseId: string;
  engagementId?: string | null;
  housePersonId?: string | null;
  workDate: string;            // ISO YYYY-MM-DD
  hours: number;                // >0, <=5, 0.25 steps
  activityId?: string | null;
  notes?: string | null;
  entryType?: 'billable' | 'proactive';
  performedBy?: string | null;             // deprecated free-text, retained for legacy rows
  performedByPersonId?: string | null;   // global_people id - the performer
  isInvoiceable?: boolean;                  // will this be billed to the client?
  rateId?: string | null;      // effort_value + billable_amount computed server-side
  startedAt?: string | null;
  endedAt?: string | null;
}
export interface TimeEntry extends TimeEntryInput {
  id: string;
  rate_applied: number | null;
  effortValue: number | null;
  billableAmount: number | null;
  invoiceStatus: 'uninvoiced' | 'invoiced' | 'paid';
  invoicedAt: string | null;
  paid_at: string | null;
  createdAt: string; updatedAt: string;
  travel_time_activities?: { slug: string; label: string } | null;
  travel_time_rates?: { slug: string; role_label: string; hourlyRate: number; currency: string } | null;
  performer?: { firstName: string | null; lastName: string | null; nickname: string | null } | null;
}
export interface TimeSummary { hours: number; amount: number; }

export interface HouseOption {
  id: string; a_house_id: string | null; displayName: string | null;
}
export interface HouseMember {
  id: string; houseId: string; personId: string | null;
  memberRef: string | null; role: string | null; displayName: string | null;
}
export interface EngagementOption {
  id: string; urlId: string | null; title: string | null; iterationLabel: string | null;
}

// ---- Analytics types ----
export type AnalyticsGroupBy = 'house' | 'engagement' | 'team' | 'activity';

export interface TimeAnalyticsFilters {
  houseId?: string;
  engagementId?: string;
  teamMemberId?: string;      // performer person_id
  activityId?: string;
  entryType?: 'billable' | 'proactive';
  isInvoiceable?: boolean;
  workDateFrom?: string;
  workDateTo?: string;
}

export interface AnalyticsSummary {
  hours: number; effortValue: number; invoiced: number; absorbed: number;
}
export interface AnalyticsBreakdownRow {
  key: string; label: string;
  hours: number; effortValue: number; invoiced: number; absorbed: number;
}
export interface AnalyticsEntry {
  id: string; work_date: string;
  house: string | null; engagement: string | null; activity: string | null;
  performer: string | null;
  hours: number; entry_type: string; isInvoiceable: boolean;
  rate_applied: number | null; effortValue: number; billableAmount: number;
  notes: string | null;
}
export interface TimeAnalyticsResult {
  summary: AnalyticsSummary;
  breakdown: AnalyticsBreakdownRow[];
  groupBy: AnalyticsGroupBy;
  entries: AnalyticsEntry[];
}