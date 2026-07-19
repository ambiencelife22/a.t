// src/types/typesTimeline.ts
// Client-side mirror of the TimelineItem shape produced by
// supabase/functions/_shared/timeline.ts. The EF builds the trip timeline
// server-side (single source) and returns it as `entries`; the programme tab
// and PDF render this shape directly. The Deno _shared module cannot be imported
// across the Vite boundary, so the TYPE is mirrored here. Keep in sync with
// _shared/timeline.ts TimelineItem (the runtime producer).

export type { TimelineRoom, TimelinePassenger, TimelineDriverDetail, TimelineItem } from '@shared/typesTimeline'