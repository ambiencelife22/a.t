// typesEventStatus.ts — Canonical event / booking lifecycle status registry.
//
// What it owns:
//   - EVENT_STATUSES: platform-wide lifecycle stages for all bookable trip
//     elements (proposed through cancelled). Ordered by lifecycle sequence.
//   - EVENT_STATUS_META: label + accent colour per status. Used for pill
//     rendering across admin UI.
//   - getEventStatusMeta: resolver with graceful fallback.
//
// What it does not own:
//   - Supplier identity (see typesSuppliers.ts)
//   - Aux booking type taxonomy or display metadata (see typesElements.ts)
//   - DB queries, UI rendering
//
// Source of truth for:
//   - JourneyEvent.status CHECK constraint
//   - JourneyDayEntry.status (future)
//   - AdminEngagementElement.status (future)
//   - All status pills across admin + client surfaces
//
// Last updated: S50 — extracted from typesSuppliers.ts. Lifecycle status is
//   not a supplier concern; pulled into its own file per single-responsibility
//   convention.
// Prior: S48 — initial registry shipped in typesSuppliers.ts.

// ── Lifecycle stages ──────────────────────────────────────────────────────────
// Ordered by workflow — proposed through to cancelled.
// DB CHECK constraints and UI pills must match this list exactly.

export const EVENT_STATUSES = [
  'recommended',       // Proposed by advisor — not yet reviewed by client
  'requested',         // Client asked — advisor sourcing
  'quoted',            // Price/option presented — awaiting decision
  'awaiting_decision', // Presented — client is considering
  'pending',           // Approved — booking in progress
  'confirmed',         // Booked and confirmed with supplier
  'paid',              // Fully settled — no outstanding payments
  'cancelled',         // No longer active
] as const

export type EventStatus = typeof EVENT_STATUSES[number]

// ── Pill metadata ─────────────────────────────────────────────────────────────

export const EVENT_STATUS_META: Record<EventStatus, { label: string; color: string }> = {
  recommended:       { label: 'Recommended',       color: '#B4AFA5' },  // faint  — proposed
  requested:         { label: 'Requested',         color: '#B4AFA5' },  // faint  — sourcing
  quoted:            { label: 'Quoted',            color: '#93C5FD' },  // blue   — option presented
  awaiting_decision: { label: 'Awaiting Decision', color: '#93C5FD' },  // blue   — client considering
  pending:           { label: 'Pending',           color: '#fbbf24' },  // amber  — in progress
  confirmed:         { label: 'Confirmed',         color: '#C9A84C' },  // gold   — booked
  paid:              { label: 'Paid',              color: '#4ade80' },  // green  — settled
  cancelled:         { label: 'Cancelled',         color: '#f87171' },  // red    — inactive
}

// Normalize any inbound status (DB title-case like 'Confirmed'/'Quoted', or
// canonical lowercase) to the canonical key. ONE place that bridges the
// booking-table vocabulary to the registry — see note below.
export function normalizeEventStatus(status: string | null | undefined): EventStatus {
  const key = (status ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  return (EVENT_STATUSES as readonly string[]).includes(key) ? (key as EventStatus) : 'recommended'
}

export function getEventStatusMeta(status: EventStatus | string | null | undefined): { label: string; color: string } {
  return EVENT_STATUS_META[normalizeEventStatus(status)]
}