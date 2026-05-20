/* auth.ts
 * Auth helpers for ambience.travel.
 * Same Supabase project as ambience.SPORTS — shared auth, shared profiles.
 * Sign-up is admin-controlled — not linked from any public UI.
 *
 * Metadata passed on signUp is picked up by the handle_new_user() DB trigger
 * which creates both a public.profiles row (SPORTS) and a travel_clients row.
 *
 * Fields:
 *   first_name — required, stored in travel_clients.first_name
 *   last_name  — optional, stored in travel_clients.last_name
 *   nickname   — optional, stored in travel_clients.nickname + profiles.display_name fallback
 */

import { supabase } from './supabase'

export async function signUp(
  email:     string,
  password:  string,
  firstName: string,
  lastName?: string,
  nickname?: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name:  lastName  ?? null,
        nickname:   nickname  ?? null,
      },
    },
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}