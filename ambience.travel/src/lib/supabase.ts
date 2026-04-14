/* supabase.ts
 * Supabase client for ambience.travel.
 * Same project as ambience.SPORTS — rjobcbpnhymuczjhqzmh.
 * Shared auth, shared profiles table, shared infrastructure.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Standard client — attaches session JWT automatically.
// Use for all authenticated operations.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// Anon-only client — never attaches a session token.
// Used for public programme fetches so that RLS evaluates against
// the anon role regardless of whether the visitor is logged in.
// Without this, a logged-in user's JWT is sent and the
// authenticated RLS policies (which check programme_guests) apply
// instead of the public read policies.
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    false,
    autoRefreshToken:  false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  },
})