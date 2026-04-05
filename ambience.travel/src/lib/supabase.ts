/* supabase.ts
 * Supabase client for ambience.travel.
 * Same project as ambience.SPORTS — rjobcbpnhymuczjhqzmh.
 * Shared auth, shared profiles table, shared infrastructure.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)