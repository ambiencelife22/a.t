// queriesAdminSuppliers.ts - Supplier query layer.
// All access via Edge Functions - no direct supabase.from() calls.
//
// Read:  travel-read-engagement-admin (mode: suppliers)
// Write: travel-write-engagement      (mode: create_supplier)

import { supabase } from '../lib/supabase'
import type { SupplierType } from '../types/typesSuppliers'
export type { SupplierType }

export type Supplier = {
  id:            string
  name:          string
  supplier_type: SupplierType
  isActive:     boolean
  createdAt:    string
  updatedAt:    string
}

export async function fetchSuppliers(types?: SupplierType[]): Promise<Supplier[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', {
    body: { mode: 'suppliers', supplier_types: types ?? [] },
  })
  if (error) throw new Error(error.message)
  return (data?.suppliers ?? []) as Supplier[]
}

export async function createSupplier(name: string, supplierType: SupplierType): Promise<Supplier> {
  const { data, error } = await supabase.functions.invoke('travel-write-engagement', {
    body: { mode: 'create_supplier', name, supplier_type: supplierType },
  })
  if (error) throw new Error(error.message)
  return data.supplier as Supplier
}
