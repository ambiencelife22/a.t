// One source of truth for schedule-state display across every surface.
// Flights/elements carry state on schedule_status/schedule_note; stays (bookings)
// carry it on status/status_note. This helper normalises both into a single
// display model consumed by web cards AND PDF renderers - no surface re-derives.
//
// Add a status once here; every surface renders it consistently. Never inline
// schedule/cancel/delay logic in a card again - call this.

export type ScheduleTone = 'danger' | 'caution'

export type ScheduleAlert = {
  struck: boolean                 // strike the primary times / name
  pillLabel: string | null        // e.g. "Cancelled · Denied Boarding", "Delayed"
  tone: ScheduleTone | null
  originalStart: string | null    // struck original (delayed only), else null
  originalEnd: string | null
}

export type ScheduleInput = {
  scheduleStatus?: string | null   // elements/flights: tentative|confirmed|delayed|cancelled
  scheduleNote?: string | null
  status?: string | null            // bookings/stays: ...|cancelled
  statusNote?: string | null
  originalStartTime?: string | null
  originalEndTime?: string | null
}

const NONE: ScheduleAlert = { struck: false, pillLabel: null, tone: null, originalStart: null, originalEnd: null }

export function scheduleAlert(input: ScheduleInput): ScheduleAlert {
  const sched = input.scheduleStatus ?? null
  const bookingStatus = input.status ?? null

  // Cancelled - either axis (flight via schedule_status, stay via booking status)
  const isCancelled = sched === 'cancelled' || bookingStatus === 'cancelled'
  if (isCancelled) {
    const note = input.scheduleNote ?? input.statusNote ?? null
    return {
      struck: true,
      pillLabel: note ? `Cancelled \u00b7 ${note}` : 'Cancelled',
      tone: 'danger',
      originalStart: null,
      originalEnd: null,
    }
  }

  // Delayed - original times struck beside new; danger pill
  if (sched === 'delayed') {
    return {
      struck: false,
      pillLabel: input.scheduleNote ? `Delayed \u00b7 ${input.scheduleNote}` : 'Delayed',
      tone: 'danger',
      originalStart: input.originalStartTime ?? null,
      originalEnd: input.originalEndTime ?? null,
    }
  }

  // Tentative - caution pill, no strike
  if (sched === 'tentative') {
    return { struck: false, pillLabel: 'Tentatively Scheduled', tone: 'caution', originalStart: null, originalEnd: null }
  }

  return NONE
}