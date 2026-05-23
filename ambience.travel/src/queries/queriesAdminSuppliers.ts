// queriesAdminSuppliers.ts — Supplier query layer.
// Read + write access to travel_suppliers for admin surfaces.
//
// Used by:
//   - BriefAuxEditor — airline supplier picker for flight aux bookings
//   - Future: supplier admin CRUD surface
//
// All column names verified against information_schema before write.
//
// Last updated: S50 — initial ship. fetchSuppliers + createSupplier wired
//   for the flight aux booking UI airline picker workstream.

import { supabase } from '../lib/supabase'
import type { SupplierType } from '../types/typesSuppliers'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Supplier = {
  id:             string
  name:           string
  supplier_type:  string   // SupplierType but stored as text to tolerate legacy values
  is_active:      boolean
  created_at:     string
  updated_at:     string
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch suppliers, optionally filtered by one or more supplier types.
 * Returns only active suppliers (is_active = true), ordered by name.
 *
 * Examples:
 *   fetchSuppliers()                                     — all active suppliers
 *   fetchSuppliers(['Commercial Airline'])               — airlines only
 *   fetchSuppliers(['Commercial Airline', 'Private Jet / Charter'])
 *                                                         — airlines + charter
 */
export async function fetchSuppliers(types?: SupplierType[]): Promise<Supplier[]> {
  let query = supabase
    .from('travel_suppliers')
    .select('id, name, supplier_type, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (types && types.length > 0) {
    query = query.in('supplier_type', types)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Supplier[]
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Create a new supplier row.
 * Used by the flight aux booking UI when admin types an airline name not yet
 * in the supplier registry — we create the supplier row inline rather than
 * orphaning a free-text airline_name string.
 *
 * Returns the inserted row (with id assigned by Supabase).
 */
export async function createSupplier(name: string, supplierType: SupplierType): Promise<Supplier> {
  const { data, error } = await supabase
    .from('travel_suppliers')
    .insert({ name, supplier_type: supplierType, is_active: true })
    .select('id, name, supplier_type, is_active, created_at, updated_at')
    .single()
  if (error) throw new Error(error.message)
  return data as Supplier
}