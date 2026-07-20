// One source of truth for schedule-state display across every surface.
// Flights/elements carry state on schedule_status/schedule_note; stays (bookings)
// carry it on status/status_note. This helper normalises both into a single
// display model consumed by web cards AND PDF renderers — no surface re-derives.
//
// Add a status once here; every surface renders it consistently. Never inline
// schedule/cancel/delay logic in a card again — call this.

export type ScheduleTone = 'danger' | 'caution'

export type ScheduleAlert = {
  struck: boolean                 // strike the primary times / name
  pillLabel: string | null        // e.g. "Cancelled · Denied Boarding", "Delayed"
  tone: ScheduleTone | null
  originalStart: string | null    // struck original (delayed only), else null
  originalEnd: string | null
}

export type ScheduleInput = {
  schedule_status?: string | null   // elements/flights: tentative|confirmed|delayed|cancelled
  schedule_note?: string | null
  status?: string | null            // bookings/stays: ...|cancelled
  status_note?: string | null
  original_start_time?: string | null
  original_end_time?: string | null
}

const NONE: ScheduleAlert = { struck: false, pillLabel: null, tone: null, originalStart: null, originalEnd: null }

export function scheduleAlert(input: ScheduleInput): ScheduleAlert {
  const sched = input.schedule_status ?? null
  const bookingStatus = input.status ?? null

  // Cancelled — either axis (flight via schedule_status, stay via booking status)
  const isCancelled = sched === 'cancelled' || bookingStatus === 'cancelled'
  if (isCancelled) {
    const note = input.schedule_note ?? input.status_note ?? null
    return {
      struck: true,
      pillLabel: note ? `Cancelled \u00b7 ${note}` : 'Cancelled',
      tone: 'danger',
      originalStart: null,
      originalEnd: null,
    }
  }

  // Delayed — original times struck beside new; danger pill
  if (sched === 'delayed') {
    return {
      struck: false,
      pillLabel: input.schedule_note ? `Delayed \u00b7 ${input.schedule_note}` : 'Delayed',
      tone: 'danger',
      originalStart: input.original_start_time ?? null,
      originalEnd: input.original_end_time ?? null,
    }
  }

  // Tentative — caution pill, no strike
  if (sched === 'tentative') {
    return { struck: false, pillLabel: 'Tentatively Scheduled', tone: 'caution', originalStart: null, originalEnd: null }
  }

  return NONE
}