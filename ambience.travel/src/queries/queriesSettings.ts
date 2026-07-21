// src/queries/queriesSettings.ts
// Canonical client access layer for a_platform_settings.
//
// Two read paths:
//   1. fetchMaintenanceMode() - direct anon Supabase query, no EF.
//      Used by ImmerseEngagementRoute (guest context, no session).
//      RLS public read policy on a_platform_settings allows this.
//   2. fetchSettings() - via travel-read-settings EF.
//      Used by admin SettingsTab (authenticated context).
//      Returns full record including updated_at / updated_by.
//
// Write path:
//   setMaintenanceMode(value) - via travel-write-settings EF.
//   Admin-only. JWT required.
//
// Created: S53H

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import type { PlatformSettings } from '../types/typesImmerse'
/*
 * Lightweight read for the guest gate in ImmerseEngagementRoute.
 * No EF - anon client reads a_platform_settings directly via RLS public policy.
 * Returns false on any error (fail open - never block a guest on a read failure).
 */


export async function fetchMaintenanceMode(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('travel-write-settings', {
    body: { mode: 'maintenance_mode' },
  })
  if (error) return false
  return Boolean(data?.maintenanceMode)
}
// ── Admin path - EF ───────────────────────────────────────────────────────────

/**
 * Full settings read for admin SettingsTab.
 * Via travel-read-settings EF (JWT required).
 */
export async function fetchSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.functions.invoke('travel-write-settings', {
    body: { mode: 'settings' },
  })
  if (error) throw new Error(`settings: ${error.message}`)
  if (!data?.settings) return { maintenanceMode: false, updatedAt: null, updatedBy: null }
  return camelizeKeys<PlatformSettings>(data.settings)
}

/**
 * Toggle maintenance mode on or off.
 * Via travel-write-settings EF (JWT required, admin only).
 */
export async function setMaintenanceMode(value: boolean): Promise<PlatformSettings> {
  const { data, error } = await supabase.functions.invoke('travel-write-settings', {
    body: { mode: 'set_maintenance_mode', value },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return data as PlatformSettings
}