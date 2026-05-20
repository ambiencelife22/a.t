// adminRequestQueries.ts
// Read + write layer for travel_requests.
//
// All column names verified against information_schema S44.
// Columns: id, house_id, trip_id, engagement_id, channel, received_at,
//          request_body, status, handled_by, notes, created_at, updated_at
//
// Last updated: S44 — initial ship.

import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RequestStatus  = 'New' | 'In Progress' | 'Proposal Sent' | 'Confirmed' | 'Closed'
export type RequestChannel = 'WhatsApp' | 'Email' | 'Phone' | 'PA' | 'Other'

export interface TravelRequest {
  id:            string
  house_id:      string
  trip_id:       string | null
  engagement_id: string | null
  channel:       RequestChannel | null
  received_at:   string
  request_body:  string
  status:        RequestStatus
  handled_by:    string | null
  notes:         string | null
  created_at:    string
  updated_at:    string
}

export type RequestPatch = Partial<Omit<TravelRequest, 'id' | 'house_id' | 'created_at' | 'updated_at'>>

// ── Constants ─────────────────────────────────────────────────────────────────

export const REQUEST_STATUSES: RequestStatus[]  = ['New', 'In Progress', 'Proposal Sent', 'Confirmed', 'Closed']
export const REQUEST_CHANNELS: RequestChannel[] = ['WhatsApp', 'Email', 'Phone', 'PA', 'Other']

// ── Queries ───────────────────────────────────────────────────────────────────

export async function fetchRequestsForHouse(houseId: string): Promise<TravelRequest[]> {
  const { data, error } = await supabase
    .from('travel_requests')
    .select('id, house_id, trip_id, engagement_id, channel, received_at, request_body, status, handled_by, notes, created_at, updated_at')
    .eq('house_id', houseId)
    .order('received_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch requests: ${error.message}`)
  return (data ?? []) as TravelRequest[]
}

export async function createRequest(
  houseId:     string,
  requestBody: string,
  channel:     RequestChannel | null,
  receivedAt:  string | null,
  tripId:      string | null,
  engagementId: string | null,
  handledBy:   string | null,
  notes:       string | null,
): Promise<void> {
  const { error } = await supabase.from('travel_requests').insert({
    house_id:      houseId,
    request_body:  requestBody,
    channel,
    received_at:   receivedAt ?? new Date().toISOString(),
    trip_id:       tripId,
    engagement_id: engagementId,
    handled_by:    handledBy,
    notes,
    status:        'New',
  })
  if (error) throw new Error(`Failed to create request: ${error.message}`)
}

export async function updateRequest(id: string, patch: RequestPatch): Promise<void> {
  const { error } = await supabase.from('travel_requests').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update request: ${error.message}`)
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await supabase.from('travel_requests').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete request: ${error.message}`)
}