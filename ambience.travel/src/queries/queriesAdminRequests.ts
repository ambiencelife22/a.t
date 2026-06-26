// queriesAdminRequests.ts
// Read + write layer for travel_requests.
// All access via Edge Functions — no direct supabase.from() calls.
//
// Read:  travel-read-trip-admin  (mode: requests)
// Write: travel-write-trip       (mode: create_request | update_request | delete_request)
//
// Last updated: S53G — migrated from direct DB to EF.

import { supabase } from '../lib/supabase'

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

export const REQUEST_STATUSES: RequestStatus[]  = ['New', 'In Progress', 'Proposal Sent', 'Confirmed', 'Closed']
export const REQUEST_CHANNELS: RequestChannel[] = ['WhatsApp', 'Email', 'Phone', 'PA', 'Other']

export async function fetchRequestsForHouse(houseId: string): Promise<TravelRequest[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-trip-admin', {
    body: { mode: 'requests', house_id: houseId },
  })
  if (error) throw new Error(`Failed to fetch requests: ${error.message}`)
  return (data?.requests ?? []) as TravelRequest[]
}

export async function createRequest(
  houseId:      string,
  requestBody:  string,
  channel:      RequestChannel | null,
  receivedAt:   string | null,
  tripId:       string | null,
  engagementId: string | null,
  handledBy:    string | null,
  notes:        string | null,
): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-trip', {
    body: {
      mode: 'create_request',
      house_id: houseId, request_body: requestBody,
      channel, received_at: receivedAt,
      trip_id: tripId, engagement_id: engagementId,
      handled_by: handledBy, notes,
    },
  })
  if (error) throw new Error(`Failed to create request: ${error.message}`)
}

export async function updateRequest(id: string, patch: RequestPatch): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-trip', {
    body: { mode: 'update_request', id, patch },
  })
  if (error) throw new Error(`Failed to update request: ${error.message}`)
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-trip', {
    body: { mode: 'delete_request', id },
  })
  if (error) throw new Error(`Failed to delete request: ${error.message}`)
}
