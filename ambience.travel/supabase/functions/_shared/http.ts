// supabase/functions/_shared/http.ts
// Shared HTTP helpers for Edge Functions. Extracted S54 — these were
// duplicated verbatim across the fleet.

export const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Standard preflight response. Call at the top of a handler:
//   if (req.method === 'OPTIONS') return preflight()
export const preflight = (): Response =>
  new Response('ok', { headers: corsHeaders })
