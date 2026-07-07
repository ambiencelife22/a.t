# Changelog

**What goes here — and what doesn't.**

This logs **major, architectural changes only** — the things a new instance reading
`git log` alone would miss or have to reconstruct painfully. The bar:

> Would someone reading only the commit history miss this, or have to piece it
> together from scattered diffs?

If **yes** → log it. If it's already clear from a commit message and a diff → **skip it.**

The most important class is **DB / schema changes**, because this repo does **not**
track SQL migrations as files — schema changes are applied live in Supabase
(project rjobcbpnhymuczjhqzmh) and are therefore **invisible to git diffs**. A
changelog entry is the only version-controlled record that they happened.

**Do NOT log:** single-column adds, renames, copy tweaks, styling, bug fixes, or
anything otherwise already captured by a normal repo push and its diff. We're in active
dev (~70% to launch) — there will be a constant stream of minor changes, and
duplicating them here just creates noise that rots. Restraint keeps this useful.

Tags: **[DB]** = live schema/data change in Supabase (not in repo diffs).
**[ARC]** = multi-part architectural work spanning code + DB.

---

## 2026-07-01

### [DB] payment_exception_override on travel_bookings (Arc B Phase 6, first client slice)

Added nullable boolean travel_bookings.payment_exception_override. Live schema
change (Supabase), not in repo diffs. Admin force-flag for the guest-facing
"Payment Outstanding" signal. NULL/false defers to date logic; true forces the
exception. Consumed only by _shared/elementStatus.ts derivePaymentException.

Scope note: this is the FIRST client-facing Phase 6 slice, but a narrow one — a
payment-exception signal, NOT the full per-stage status render. The confirmation
EF (travel-get-trip-confirmation) now derives ONE boolean (payment_exception) via
the canonical helper and exposes it guest-side; it does NOT yet roll up
lifecycle status via deriveElementStatus. So the Phase 4+5 "pending" note below
(client EFs not yet on the canonical rollup) still stands for status; only the
payment-exception axis shipped. derivePaymentException fires on
override===true OR (balance_due_date < today AND balance_paid_at null); not-yet-due
stays silent. UTC today (destination-aware is logged debt). Rendered red,
exception-only, on web (ImmerseTripPage) + PDF (pdfImmerseConfirmation); silent
otherwise. Admin set-toggle in FinancialTab pending.

---

## 2026-06-27

### [DB][ARC] Arc B — Universal Element Status, Phases 1-3 (data + behavior + history)

The keystone status model. Every engagement element (booking, room, aux) now
carries a status from one registry; confirmation becomes a status value rather
than a parallel derived truth. Live and verified in Supabase; DB-side only —
none of this appears in repo diffs. Phases 4-6 (rollup helper, read EFs, render)
are pending.

Phase 1 — status_id column + true backfill.
- Added status_id uuid FK to travel_lifecycle_statuses on travel_bookings,
  travel_booking_rooms, travel_engagement_aux_bookings. Text status column kept
  (readers migrate first; not dropped this phase).
- Backfilled to TRUE statuses, not a uniform stamp: 15 bookings + 45 rooms to
  confirmed; aux split 7 confirmed / 15 guest_managed / 1 cancelled. The one
  cancelled (Dinings SW3) was caught via dining_status — a blanket "confirmed"
  backfill would have falsely marked a cancelled, penalty-applied booking as
  confirmed. Zero nulls across all three tables.
- Two new off-ladder registry stages added to travel_lifecycle_statuses:
  guest_managed ("Own Arrangements", sort_order 210) and
  guest_managed_undetermined ("Please Advise", 220). Rationale: ambience cannot
  truthfully mark a guest-booked element "confirmed" — it has no visibility or
  control if the guest changes/cancels it. These two stages sit above the 10-90
  lifecycle ladder and are EXCLUDED from rollup math (a guest-managed child
  neither confirms nor un-confirms its parent). guest_managed_undetermined is
  forward-looking (placeholder for guest-managed elements whose details aren't in
  yet); nothing backfilled to it today.

Phase 2 — auto-promotion trigger (fn_autopromote_on_confirmation).
- Attached to all three tables. When a confirmation_number first appears, status
  advances to confirmed ONLY if the element is on the lifecycle ladder
  (sort_order <= 90) AND below confirmed (< 40). Never overrides a manual
  terminal/higher state (paid/cancelled/closed); never touches off-ladder
  guest_managed/undetermined. "Evidence promotes; it never overrides human intent."
- BEFORE trigger, UPDATE OF confirmation_number — sets NEW.status_id on the
  same write (no second UPDATE, no recursion). Four behavior cases proven via
  rollback tests.

Phase 3 — element_status_events (append-only history).
- Columns: (id, element_type, element_id, from_status_id, to_status_id,
  changed_by, source, changed_at). Polymorphic element_id (no native FK — the
  accepted cost for one uniform log across the whole tree); native FKs on
  from/to status. changed_by uuid nullable (NULL = system/auto; source carries
  the why). Index on (element_type, element_id, changed_at DESC).
- The trigger now writes an event on every auto-promotion
  (source = 'auto_confirmation_number', changed_by NULL).
- Security: RLS enabled, NO policies → deny-by-default, service-role-only
  (same locked posture as a_ppd_*). Trigger function set SECURITY DEFINER so
  the audit write never silently drops under RLS regardless of the invoking role.
  Do NOT add a client read policy — status history is read only through admin
  EFs via service role.

Pending (Phases 4-6): deriveElementStatus(children) rollup helper that retires
_shared/confirmation.ts (the original confirmation-vs-status drift bug becomes
structurally impossible once status is universal); read EFs return status_id +
label + derived rollup; client + PDF render the status ladder.

### [ARC] Arc B Phase 4+5 (calendar surface) — canonical status rollup; confirmation.ts retired

The element-status rollup is now a single canonical helper, per Dev Standards II
(no parallel-shipped implementations). Scoped to the admin calendar as the first
proven vertical; client confirmation/programme surfaces are a later slice.

- New `_shared/elementStatus.ts` — `deriveElementStatus(children)`: the one rollup
  over Universal Element Status. All eligible children >= confirmed -> Confirmed;
  some -> Partial (n/m exposed); none -> lowest stage; no eligible -> empty.
  Off-ladder children (guest_managed/undetermined) EXCLUDED from the math — a
  guest-arranged element neither confirms nor un-confirms its parent. Derived at
  read, never stored.
- `travel-read-trip-admin` (calendar mode) re-keyed: fetches the lifecycle registry
  once into a resolver map, reads each room's status_id, rolls up via the helper.
  Output contract preserved (confirmation / rooms_confirmed / rooms_total) so
  CalendarTab is unchanged — the derivation source moved from conf-number inference
  to status_id, drift eliminated.
- `_shared/confirmation.ts` DELETED. It inferred confirmed-ness from
  confirmation_number; that inference now lives at the source (the Phase 2 trigger
  + status_id). Keeping it would parallel-ship two truths — the exact drift it was
  built to prevent, reborn on a new axis. Its rollup + per-child-honesty logic
  survive, re-keyed onto status, in elementStatus.ts.
- Verified live: 6 trips / 15 stays all roll up confirmed n/n from real status_id.

Pending: client EFs (travel-get-trip-confirmation, travel-get-trip-programme) still
derive confirmation independently — not yet on the canonical helper (separate slice).
Phase 6 (richer per-stage render on detail/client surfaces) also pending.

### [DEBT] Engagement-level export/branding control — ONE location, not per-surface

Status: NOT BUILT. Logged as debt so it is built correctly when picked up.

The need: an admin must be able to export a trip's PDFs (brief / confirmation /
programme) under an alternate branding — AlfaOne Concierge, or unbranded — while
the GUEST always sees ambience. "Admin only, not public."

The mission constraint (Dev Standards II, single source): export/branding is a
property of the ENGAGEMENT (the universal spine), controlled in ONE location with
sublevels as needed. It must NOT be a picker duplicated across ItineraryEditorPage,
TripDossierSection, and BriefEditorPage — three pickers would be three sources of
truth for "how does this trip print," the exact drift extraction exists to kill.

Architecture when built:
  - Branding/export identity lives once, on the engagement (or a single engagement-
    scoped export-settings surface), NOT on travel_engagement_briefs.logo_variant read by
    the guest EFs (that path leaks the variant to the guest download).
  - The three PDF exporters (pdfImmerseBrief/Confirmation/Programme) take an explicit
    branding param (default 'ambience'); they stop reading brief.logo_variant for the
    guest path.
  - Guest surface (ImmerseTripPage) passes nothing -> always ambience. Structurally
    cannot emit AlfaOne. This isolation is the security property, must be verified.
  - Admin export: ONE engagement-level control supplies the variant. Every admin
    surface that can export reads that one control; none owns its own picker.
  - stampPageChrome footer must follow the variant too (currently hard-codes
    ambience.travel) — already drafted, not shipped.

Current state: drawFrostedLogoCard already supports variant 'alfaone'/'unbranded';
brief.logo_variant exists and is admin-set in BriefEditorPage. But it is Model A
(stored on brief, read by guest EFs) — wrong for admin-only. Rebuild as engagement-
scoped, export-time, guest-isolated.

## 2026-07-02

### [DB] public_preview_rank aligned across all guide item tables

Added `public_preview_rank INTEGER` (nullable) to four tables previously missing
it: `travel_experiences`, `travel_shopping`, `travel_accom_hotels`,
`travel_happenings`. Backfilled with ROW_NUMBER() OVER (PARTITION BY
destination_id ORDER BY name) per table, matching the pattern established on
`travel_dining_venues` in S53. All rows that should be publicly previewable now
carry a non-null rank.

Result: 56/56 experiences, 25/25 shopping, 575/575 hotels, 1/1 happenings ranked.

This closes the Gateable contract gap — `utilsGuideGating.Gateable` is now strict
(`public_preview_rank: number | null`, required, no index signature). All five
guide item types (DiningVenue, ExperienceVenue, Shop, HotelVenue, Happening)
satisfy the contract structurally. TypeScript enforces alignment at every callsite.

### [DB] accuracy_date migrated to DATE NOT NULL on all guide overlay tables

`accuracy_date` migrated from `text` (nullable, mixed free-text format) to
`DATE NOT NULL` on: `travel_dining_guides`, `travel_experiences_guides`,
`travel_hotel_guides`, `travel_shopping_guides`.

Steps applied live in Supabase:
1. Normalised free-text "May 2026" / "June 2026" to first-of-month ISO via
   TO_DATE() on all four tables.
2. Backfilled NULL rows (travel_experiences_guides ×2, travel_hotel_guides ×1)
   to 2026-07-01.
3. Dropped dependent views travel_dining_guide_for_user and
   travel_experiences_guide_for_user, ran ALTER COLUMN TYPE DATE on all four
   tables, added NOT NULL, recreated both views with identical definitions.

Render: formatMonthYear(iso) → "May 2026" for guide accuracy disclaimers.
formatDateLong(iso) → "01 July 2026" for general app use. Both in utilsDates.ts,
following the S23 UTC-safe parse pattern (no new Date(iso)).

### [DB] maps_url format constraint — universal across all guide tables

Added CHECK constraint `chk_maps_url_format` to five tables:
`travel_dining_venues`, `travel_experiences`, `travel_happenings`,
`travel_programme_properties`, `travel_shopping`.

Constraint enforces Google Maps short-link format only:
  `^https://(maps\.app\.goo\.gl|share\.google|goo\.gl/maps)/`

Rejects raw long-form Google Maps URLs. Accepts all three known
short-link formats. Four pre-existing non-compliant rows corrected
before constraint applied (China Tang London, Château de La
Messardière St Tropez, Valentino St Tropez, Pucci St Tropez).

One standard, enforced universally at the DB level across every
guide surface. The constraint is the globalization.

### [DB] Guide views rebuilt with security_invoker=true

`travel_dining_guide_for_user` and `travel_experiences_guide_for_user`
recreated with `WITH (security_invoker = true)`. Supabase security
advisor was flagging both views as SECURITY DEFINER due to the
auth.uid() subselect pattern. security_invoker ensures RLS and
permissions are evaluated as the querying user, not the view creator.
Correct posture for user-scoped grants views.

## 2026-07-05

### [ARC] Eight-shape surface — stay shape unified onto the one surface (Stages A–B; C/D pending)

The destination subpage is being dissolved into the unified engagement surface as
shape 'stay' — no bespoke page, one surface resolving (stage × shape) via
resolveSectionSet. Spans registry + types + route across five commits; the
campaign shape is not visible in any single diff.

Model: a destination-within-a-journey IS a stay render. The route resolver fetches
getProposalDestination and attaches it as `detail` on the proposal arm of
EngagementClientData; the surface renders that detail as shape 'stay' (shape forced
in the destination branch — journeyTypes[0] resolves to 'journey', not 'stay').
Fetch lives in the resolver, surface stays a pure render of resolved data (Option B).

Stage A — stay SectionTypes (intro/hotel_options/dining_grid/experiences_grid/
detail_pricing) added to SECTION_REGISTRY. Registry renumbered to gapped integers
(0,10,…100) so journey/stay interleave without fractions — the gaps ARE the
interleave contract, do not renumber to consecutive. interstitial widened to
['journey','stay']; welcome/destinations/pricing narrowed off 'stay'.
Stage B — `detail?: ImmerseDestinationData` on the proposal union arm; renderers
wired; resolver fetches it behind the ?stay=next shadow flag.

SHADOW STATE (the thing git log won't tell you): the new stay path is live ONLY
behind ?stay=next. Default is still the bespoke DestinationPage. NOT yet cut over.
Next: Stage C parity eyeball (old vs ?stay=next on a real destination), then
cutover (flip default), then Stage D delete DestinationPage.tsx once grep-zero.

Naming: ?stay=next is this campaign's own flag — NOT A3's retired ?surface. Also
this session (renames, captured in diffs, logged here only for the search trail):
typesImmerseClient -> typesImmerseDelivery, queriesImmerseClient ->
queriesImmerseEngagement (Client=identity-only; neither held client identity).

FIND:  * Last updated: S54 — Tabs section added. Four show_tab_* booleans
REPLACE:
 * Last updated: S53O — brief accommodation reduced to index shape (hotel,
 *   dates, nights, party composition, room categories + per-room conf,
 *   booked-by). Guest names, cancellation, invoices, inclusions removed —
 *   those live on Confirmation + Programme. Matches TripBriefTab + PDF.
 * Prior: S54 — Tabs section added. Four show_tab_* booleans

 ## 2026-07-06

### [DB] bedding_type column + CHECK constraint on booking/overlay room tables

Live Supabase schema change (not in repo diffs). Added `bedding_type text` to
`travel_booking_rooms` with a CHECK constraint limiting it to a 14-slug closed
vocabulary (king, cal_king, queen, double, twin, two_kings, two_queens,
two_twins, king_twin, double_twin, three_twins, bunk, sofa_bed, zip_link).
Retrofitted the identical CHECK onto `travel_immerse_rooms.bedding_type`, which
had the column but was unconstrained.

Logged because it doubled as a root-cause fix invisible to git: the room SELECT
in _shared/trip.ts had long requested `bedding_type` from travel_booking_rooms
where the column did not exist. The query errored (Postgres 42703), returned
null, and EVERY guest surface (confirmation, brief, PDF, programme — all share
fetchTripBookings) rendered `_rooms: []` for all hotels. Room-level confirmation
numbers never appeared; only booking-level did. Silent because the room fetch
had no error logging. Adding the column (correctly, constrained) restored rooms
platform-wide.

DEBT: the 14-slug vocabulary now lives in three places (two CHECK constraints +
utilsBooking.BEDDING_LABELS). Mission-grade single source is a travel_bedding_types
registry table (slug PK, label, sort_order, description) FK'd from both room
tables, TS map synced to it. Next dedicated migration.

## 2026-07-06

### [ARC][DB] Overlay rename Phase A begins — travel_immerse_* → travel_overlay_* (migrations 1-3)

The "kill trips/immerse" campaign's overlay tier. `travel_immerse_*` (per-engagement
proposal render tables) are being renamed to `travel_overlay_*`, one table per
migration, DB-fully-then-code, each live-verified before the next. Live Supabase
schema changes — invisible to git diffs; this is their only version-controlled record.

Grammar (locked): place=`global_*`, canon=`travel_*`, engagement spine=`travel_engagement_*`
(pending Phase B), overlay=`travel_overlay_*`. Overlay prefix is `travel_overlay_*`
NOT `travel_engagement_overlay_*` (63-byte constraint-name limit).

Renamed this pass (3 of 13 overlay tables):
- `travel_immerse_destination_pricing_rows` → `travel_overlay_destination_pricing_rows`
- `travel_immerse_engagement_content_card_overrides` → `travel_overlay_engagement_content_card_overrides`
- `travel_immerse_engagement_content_card_selections` → `travel_overlay_engagement_content_card_selections`

Each: table + constraints + standalone indexes renamed (PK index renames WITH its
constraint — never ALTER INDEX it). Stale constraint-name lies corrected in passing:
`*_trip_id_fkey` → `*_engagement_id_fkey` (the FK column was already `engagement_id`
from Campaign 1). On card_selections the overlay-prefixed FK names exceeded 63 bytes,
so FK constraints use a shortened honest stem `overlay_card_selections_*`; a doubled-
stale index `idx_trip_card_selections_trip_active` (named `trip` twice, filtered on
`engagement_id`) → `idx_overlay_card_selections_engagement_active`.

Callers repointed + redeployed: travel-get-immerse-proposal (also brought onto the
shared createServiceClient() factory this pass — it had been missed by the S53H
Batch 2 sweep and was still on inline makeDb() + hand-rolled ok/err), travel-read-
engagement-admin, queriesAdminCardOverrides, queriesAdminCardSelections. Commit 5efb813.

Still pending (10 overlay tables): route_stops, rooms, engagement_pricing_rows,
engagement_regions, engagement_region_hotels, engagement_destination_rows,
engagement_destination_hotels, engagement_hotel_gallery_overrides, engagement_display,
and engagements itself (LAST — high fan-out: it + engagement_display also read in
_shared/trip.ts, so their rename redeploys all three client EFs). The lone remaining
column-lie deferred to Phase B/C: travel_overlay_engagements.trip_id (real FK to
travel_trips, stays until spine rename); pricing-rows' trip_destination_row_id column.

## 2026-07-07

### [ARC][DB] Overlay rename Phase A COMPLETE — travel_immerse_* → travel_overlay_* (13 of 13)

The "kill trips/immerse" campaign's overlay tier is done. All 13 per-engagement
proposal/overlay tables renamed travel_immerse_* → travel_overlay_*, one migration
each, DB-fully-then-code, every one verified live. Live Supabase schema — invisible
to git diffs; this is the record.

Grammar (locked): place=global_*, canon=travel_*, engagement spine=travel_engagement_*
(Phase B, pending), overlay=travel_overlay_*. Overlay prefix is travel_overlay_* NOT
travel_engagement_overlay_* (63-byte constraint-name limit).

Tables renamed (migrations 1–13):
- destination_pricing_rows, engagement_content_card_overrides,
  engagement_content_card_selections, engagement_hotel_gallery_overrides,
  route_stops, engagement_pricing_rows, engagement_regions,
  engagement_region_hotels, engagement_destination_hotels,
  engagement_destination_rows, rooms, engagement_display, and the root
  travel_immerse_engagements → travel_overlay_engagements.

Each: table + constraints + standalone indexes renamed (PK/unique indexes rename
WITH their constraints, never ALTER INDEX'd). Stale name-lies corrected throughout:
*_trip_id_fkey → *_engagement_id_fkey where the FK column was already engagement_id
(a prior pass renamed the columns; only the constraint names still lied). Names
crossing 63 bytes shortened to honest stems (overlay_card_selections_*,
overlay_hotel_gallery_ov_*, overlay_dest_hotels_*, overlay_dest_rows_*,
overlay_engagement_pricing_*, idx_overlay_region_hotels_*).

Migration 13 (the root, travel_immerse_engagements) — ZERO-DOWNTIME cutover.
This table is the FK target of 21 inbound FKs (all 12 overlay children + self-ref
+ travel_bookings/engagement_expenses/engagement_houses/engagement_links/requests/
tasks/time_entries/trips.confirmed_engagement_id) and is read by 15 files across
10 EFs + 2 shared modules. Direct rename would have broken the whole platform for
the duration of a 10-EF redeploy. Instead: rename table → create SELECT * view
under the old name (security_invoker=true, RLS-respecting) → repoint 3 DB functions
+ 15 files → deploy 10 EFs → drop view. Platform never in a broken state.
trip_id FK to travel_trips PRESERVED (real spine link, Phase B boundary — trip_id
here is truth, not a lie; only the constraint name was de-stale'd to
travel_overlay_engagements_trip_id_fkey). All 21 inbound FKs verified re-pointing
post-rename. Triggers tg_immerse_derive_children + tg_immerse_engagement_public_view
renamed to tg_overlay_*; all trigger FUNCTIONS preserved.

### [DB] Two latent DB-function bugs found + fixed (function-body sweep)

The filesystem grep (supabase/functions/ src/) does NOT see table references inside
DB function/trigger bodies. A post-rename pg_proc sweep caught two live breaks the
grep missed:
- resolve_and_project_guest_label — INSERT INTO the display table; broken since
  migration 12 (guest-label projection failing on every engagement write). Fixed.
- clone_engagement — referenced all 12 old overlay names + engagements; broken
  since migration 1. It is a fully-built transactional clone (id-maps + FK remap),
  not the incomplete stub the debt board implied. Fixed. KNOWN GAP: room clone
  copies bed_config_override (deprecated) but not bedding_type — cloned rooms lose
  bedding; fix in the clone review.
- derive_tasks_for_engagement — surfaced during migration 13's engagements-name
  sweep (writes child engagements); repointed to travel_overlay_engagements.
All three functions now carry COMMENT ON FUNCTION documenting their overlay writes.

### [PROCESS] Standing rule earned — sweep DB function bodies after any table rename

After renaming any table: run BOTH the filesystem grep AND a pg_proc function-body
sweep (pg_get_functiondef LIKE '%old_table_name%'). DB function/trigger bodies are
invisible to git and to the repo grep; unswept, a rename silently breaks server-side
logic. Cost this campaign: 2 live bugs. Also: tsc green ≠ grep clean (a table name
in .from('...') is a string literal TS does not validate — the clean-grep is the
completeness gate, never tsc).