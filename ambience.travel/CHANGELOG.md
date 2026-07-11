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

### [ARC][DB] Phase B Stage 1 COMPLETE — 7 spine-leaf tables trip→engagement

Phase B (spine rename) begun. Grammar locked with D: travel_trips → travel_engagements,
travel_overlay_engagements → travel_engagement_iterations, engagement_id → iteration_id on
overlays, trip_id → engagement_id on spine children. Full recon + 6-stage campaign plan on
disk (phase_b_campaign_plan.md), including the travel_bookings/travel_requests dual-column
collision (rename engagement_id→iteration_id FIRST, then trip_id→engagement_id).

Stage 1 renamed all 7 spine-leaf tables + trip_id→engagement_id column (constraints, indexes,
triggers). Live schema — invisible to git diffs; this is the record:
travel_trip_welcome_letters, _briefs, _days, _day_entries, _aux_bookings, _destinations,
_aux_passengers → travel_engagement_*. (_aux_passengers had no trip_id — keyed via
aux_booking_id — table rename only.) Unique constraints on briefs (trip_id) and days/
destinations (composite) renamed with their columns; onConflict strings updated in callers.

Caller repoint applied strict X/Y/Z discipline across the trip EFs + _shared/trip.ts +
_shared/names.ts:
- X (DB column on a renamed table) → engagement_id
- Y (trip_id on travel_bookings / travel_overlay_engagements — NOT renamed) → PRESERVED
- Z (API payload keys, TS type fields, in-memory shapes) → left, logged below

Two breaks caught AFTER the initial "done" — the reason this entry matters:
1. Entered Stage 1 on an already-live half-migrated state: deployed code filtered
   .eq('engagement_id') against tables still holding trip_id (column edits made ahead of
   the DB rename). Broken admin reads AND guest programme/confirmation, live.
2. The guest-EF column seds silently failed (shell paste errors) — travel-get-trip-programme
   kept .eq('trip_id') on aux/days/day_entries against renamed columns. Those reads errored
   (42703) → [] → flights, day overrides, standalone entries absent from the guest programme
   + confirmation. Found only by a rendered-page eyeball on live trip 1d680dcc, NOT by
   tsc/grep (both green while the surface was broken). Fixed + verified: 6 flights render.

pg_proc sweep also caught derive_tasks_for_engagement reading the old aux table name in its
body (invisible to filesystem grep) — repointed. Reconfirms the Phase A rule.

LESSONS (standing): (a) guest-facing renames require a rendered-page eyeball as the
verification — structural checks gate the deploy, the page proves it. (b) Never trust that a
batch sed applied; verify with a re-grep before deploying.

Stages 3-6 remain (12 overlay engagement_id→iteration_id columns; bookings/requests
dual-column collision; travel_overlay_engagements→travel_engagement_iterations; travel_trips
→travel_engagements last). All reuse the compatibility-view technique from Phase A mig 13.

### [DEBT] Deferred honesty pass (Category Z — one sweep, both sides together)
Working but name-lying, rename in a single pass (not piecemeal): tripId/trip_id locals; the
{ trip_id } API payload contract between queriesAdminTrip.ts and the trip EFs (both sides
atomically); TripDayItem.trip_id in _shared/days.ts; Trip* TS type field names.

### [ARC][DB] Phase B Stage 3a — 12 overlay tables engagement_id → iteration_id

Stage 3 splits (decided this session): 3a = the 12 travel_overlay_* proposal-surface
tables; 3b = the 7 non-overlay children (bookings, expenses, houses, links, requests,
tasks, time_entries). Scope clarification worth recording: "Stage 3" is every
engagement_id column pointing at travel_overlay_engagements — 19 tables, not 12. The
split is by verification surface (3a → guest proposal page; 3b → financial/tasks +
pre-satisfies the Stage 4 bookings/requests collision), NOT a half-state: neither
sub-stage ships as "done" until both land.

3a renamed engagement_id → iteration_id on all 12 overlay tables (column + FK
constraints + indexes; live Supabase, invisible to git). Table names stay
travel_overlay_* — they hang off an iteration, and the column now says so. The FK
target (travel_overlay_engagements) keeps its name until Stage 5; iteration_id →
legacy-named-target is a transient honest-column state, resolved then. 63-byte care:
content_card_overrides FK → shortened stem overlay_card_overrides_iteration_id_fkey.
Per-index nuance: on tables whose NAME contains "engagement" (engagement_pricing,
engagement_regions), only the column-half of index names → iteration.

Grammar decision — Option B, not the minimal X-only rename: DB column + DB-facing refs
AND the TS type fields + payload keys all → iteration_id. Rationale (mission, "fix the
callers, don't loosen the truth"): for these overlay tables the type fields ARE Stage
3's subject — renaming only the DB column and leaving the types saying engagement_id
would mint a fresh name-lie in the exact work meant to end it. The deferred Stage-1
trip_id honesty debt stays separate (different names). tsc enforced completeness: after
the 5 query files renamed their payload types, tsc caught 7 unaligned callers across 5
admin editor components — the type contract doing the finding, which is the point.

DB functions repointed: clone_engagement (all 12 overlay INSERT column lists + WHERE
filters → iteration_id; trip_id + parent_engagement_id preserved for their later
stages), resolve_and_project_guest_label (display INSERT + ON CONFLICT → iteration_id;
its travel_engagement_houses.engagement_id ref correctly LEFT — that's 3b).
derive_tasks_for_engagement verified clean — it touches travel_overlay_engagements only
by id/parent_engagement_id and writes travel_tasks.engagement_id (3b), no 12-overlay
column refs. travel-get-immerse-proposal + travel-read-engagement-admin redeployed
(the 5 query files write overlays directly — no write-EF pairing needed).

Verified on live proposal oQC68jVKgcm: destination subpage renders full (hotel options,
rooms, dining/experience cards, subpage pricing, galleries — the dense overlay surface),
clean inspector.

Stage 3b next (the 7 children); then Stage 4 = leftover trip_id → engagement_id on
bookings/requests only (3b pre-frees the engagement_id name on those two per the
collision rule).

### [ARC][DB] Phase B Stage 3b — 7 non-overlay children engagement_id → iteration_id

Completes Stage 3 (Stage 3a = 12 overlays; 3b = these 7). All engagement_id columns
pointing at travel_overlay_engagements now say iteration_id. Live Supabase renames
(column + constraints + indexes), invisible to git — this is the record:
travel_bookings, travel_requests, travel_engagement_expenses, travel_engagement_houses,
travel_engagement_links, travel_tasks, travel_time_entries.

Done as ONE atomic code pass, not the safe-order split originally planned — because a
split leaves files that touch both a 3b-renamed table and a not-yet-renamed one holding
two names, which is the conflated-file state the mission forbids. Atomic keeps every file
speaking one name.

Collision handling: travel_bookings + travel_requests carry BOTH trip_id and
(was) engagement_id. 3b renamed their engagement_id → iteration_id, which FREES the
engagement_id name and pre-satisfies the Stage 4 collision-ordering rule. Their trip_id
STAYS (Category Y) until Stage 4.

Functions: check_closed_won_commission (commission close-won guard — bookings ref →
iteration_id), enforce_engagement_label_house_match, tg_project_guest_label_on_houses,
resolve_and_project_guest_label (its houses ref, deliberately left in 3a), and
derive_tasks_for_engagement (travel_tasks writes → iteration_id). derive_tasks' aux
reference a.engagement_id (travel_engagement_aux_bookings) correctly LEFT — that column
was renamed in Stage 1, points at the parent engagement, is NOT one of these 7. Confirmed
via regexp that a.engagement_id is its only .engagement_id ref (pg_proc false-positive:
flagged because the function also contains travel_bookings).

LESSON reinforced: tsc went green while every frontend invoke payload still sent
engagement_id to EFs now demanding iteration_id — the invoke bodies are loosely typed
(Record<string,unknown>), so the mismatch compiles and breaks only at runtime (400
"iteration_id is required"). Caught by DIRECT grep of all 8 frontend callers, not tsc.
For payload-contract renames, grep the callers — the compiler does not see through loose
invoke typing. (Same class as the S53O guest-flight break: green structure, broken
surface.)

Verified on live money surfaces (the 3b verification = correct NUMBERS, not just render):
StudioDashboard money strip + OutlookTab on Sharm (booking 89aee7e3, iteration aa99b19f):
commission 951.60, net revenue 666.12 = 951.60 − 285.48 IATA share, the correct single
partner-share subtraction (the computeNetRevenue path with documented prior double-count
history — now correct).

### NEXT (Phase B remaining, after 3b)
- STAGE 4: trip_id → engagement_id on travel_bookings + travel_requests ONLY. The name
  is now freed by 3b. This is the second half of the collision (engagement_id→iteration_id
  done; now trip_id→engagement_id). travel_bookings.trip_id is NOT NULL + financial —
  compatibility-view technique, eyeball Outlook/Studio numbers after. Watch: many EFs
  still filter bookings/requests by trip_id legitimately (resolveTripIds path,
  travel-read-trip-admin, guest EFs) — those are Category X for Stage 4 and rename to
  engagement_id; classify each.
- STAGE 5: travel_overlay_engagements → travel_engagement_iterations (its trip_id →
  engagement_id; ~21 inbound FKs; compatibility view). Also parent_engagement_id →
  parent_iteration_id (honesty — it's a self-ref to an iteration).
- STAGE 6: travel_trips → travel_engagements LAST (confirmed_engagement_id →
  confirmed_iteration_id; 10 inbound FKs; compatibility view).
- DEFERRED HONESTY PASS (Category Z, unchanged): the Stage-1 { trip_id } API payload
  contract (queriesAdminTrip.ts ↔ trip EFs), tripId locals, TripDayItem.trip_id,
  Trip* TS type field names. One deliberate both-sides sweep.
- clone_engagement bedding_type gap (room clone drops bedding_type) — still open.

### [ARC][DB] Phase B model CORRECTED to mission + Stage 5a — iteration_id → engagement_id (19 children)

**Model correction (supersedes the Stage-1/3 "deal → iterations" framing above).**
The campaign plan's endgame (travel_trips → travel_engagements as the spine; overlay →
travel_engagement_iterations) was found MISSION-WRONG this session and rewritten. The
mission requires a SERVICE-AGNOSTIC spine ("zero compromise across products; the future
self is ambience.LIFE / MONEY on the same spine"). travel_trips is travel-shaped
(trip_code, trip_type, destinations[]) and CANNOT be that spine. Resolved, following the
engagement-OS model (mission-truthful):
- SPINE = travel_overlay_engagements (carries engagement_type, 21 inbound FKs) →
  becomes travel_engagements. Children key by engagement_id.
- travel_trips → travel_journey: the JOURNEY CAPABILITY module (destinations, route,
  days, brief), NOT the spine, NOT dissolved. "Trip disappears into its true role."
- aux_bookings → elements: cross-cutting, resolved by engagement_type.
- NO iteration tier. The overlay IS the engagement; version/lineage (Yazeed v2/v3) is a
  COLUMN on the spine, not a second table level. => Stage 3's engagement_id → iteration_id
  was a NAME-DETOUR encoding the rejected model. Stage 5a CORRECTS it back to
  engagement_id (now pointing at the spine). The old NEXT block below is superseded by the
  post-3b plan on disk (phase_b_plan_v2_post3b.md, db_map_v10_GROUNDTRUTH.md).

**Ground-truth recon (07 Jul) corrected the map:** travel_trips + travel_trip_guests were
NOT renamed in Stage 1 (still travel_trip_*); the 6 spine leaves (briefs/days/day_entries/
destinations/welcome_letters/aux_bookings) already say engagement_id but point at
travel_trips (the Stage-1 drift, journey objects under the mission model — Stage 6 corrects
to journey_id); Layer 4 fully de-immersed (no travel_immerse_* survive); supplier schism
already resolved (travel_suppliers + travel_supplier_contacts exist, bare suppliers absent);
Residences renamed travel_programme_* → travel_hosted_*. Orphan fn
update_travel_immerse_bottom_notes_updated_at references a non-existent table (verify+drop).

**Stage 5a — iteration_id → engagement_id on all 19 children of travel_overlay_engagements.**
Live Supabase (column + FK constraint + index; invisible to git — this is the record):
travel_bookings, travel_requests, travel_engagement_expenses, _houses, _links,
travel_tasks, travel_time_entries + the 12 travel_overlay_* content tables. The FK still
targets travel_overlay_engagements(id) — honest column, target table renamed in 5b.
parent_engagement_id (self-ref) and trip_id (→ travel_trips, Stage 6) preserved.

6 functions repointed: check_closed_won_commission, resolve_and_project_guest_label,
tg_project_guest_label_on_houses, enforce_engagement_label_house_match, clone_engagement
(all overlay-child iteration_id → engagement_id), and derive_tasks_for_engagement
(PER-LINE: travel_tasks.iteration_id → engagement_id, while b.trip_id (Y) and the aux
a.engagement_id (Stage-1 leaf col → travel_trips) both preserved — that function now
legitimately holds engagement_id meaning two things until Stage 6 corrects the leaf).

26 code files swapped; frontend grep confirmed zero iteration_id remaining (the real
check — tsc green but blind to loose invoke payloads, the 3b lesson). 7 EFs deployed.

TRANSITIONAL STATE (by design, resolved Stage 6): engagement_id now means two things —
the 19 children → the spine (correct), and the 6 spine leaves → travel_trips (Stage-1
drift). Not a bug; sequenced. Stage 6 corrects the leaves to journey_id.

Verified live (5a = numbers + guest render): proposal oQC68jVKgcm/newyork renders (overlay
content intact); OutlookTab Sharm (89aee7e3) commission 951.60, net 666.12 after IATA share.

### NEXT (Phase B remaining — MISSION MODEL, supersedes the older NEXT block above)
- STAGE 5b: travel_overlay_engagements → travel_engagements (THE SPINE). Table rename +
  compatibility view (21 inbound FKs, mig-13 technique). Its own trip_id → journey_id folds
  in with Stage 6. parent_engagement_id stays.
- STAGE 6: travel_trips → travel_journey (journey capability). trip_id → journey_id on
  bookings, requests, overlay(spine), trip_guests; the 6 leaves' engagement_id → journey_id
  (corrects the Stage-1 drift); reconsider leaf homes (briefs/days/destinations/route =
  travel_journey_*; guests = ?). confirmed_engagement_id reconsider. The OLD standalone
  Stage 4 (trip_id → engagement_id) is DISSOLVED — no collision remains; the trip_id rename
  is trip_id → journey_id and folds into Stage 6.
- STAGE 7: travel_engagement_aux_bookings → elements. FK RETARGET to the spine (an element
  is engagement-scoped, not journey-scoped), not just a rename.
- DEFERRED HONESTY PASS (Category Z): the { trip_id } API payload contract, tripId locals,
  TripDayItem.trip_id, Trip* type fields. One both-sides sweep.
- clone_engagement bedding_type gap; orphan fn update_travel_immerse_bottom_notes_updated_at.

### [ARC][DB] Phase B Stage 5b — travel_overlay_engagements → travel_engagements (THE SPINE)

The spine gets its true, mission name. travel_overlay_engagements → travel_engagements —
the service-agnostic engagement entity that carries engagement_type and that every
capability module + cross-cutting concern hangs off. Live Supabase (table + ~18 name-lie
constraints/indexes + 2 name-lie triggers renamed); 21 inbound FKs auto-followed the table
rename. trip_id STAYS (→ travel_trips, Stage 6). parent_engagement_id (self-ref) stays.

ZERO-DOWNTIME via the mig-13 compatibility-view technique — the mission bar "admin/client
never in a broken state" made literal:
  1. rename table
  2. CREATE VIEW travel_overlay_engagements AS SELECT * FROM travel_engagements
     (security_invoker=true) — deployed EFs keep reading the old name through the view
  3. repoint 3 functions + 15 files → deploy 10 EFs
  4. verify ALL surfaces green THROUGH the view (nothing can break — view is transparent)
  5. DROP VIEW
  6. re-verify WITHOUT the view (the drop is the moment a missed ref surfaces)
Both verification stages green. The view earned its place — see the bug below, caught
behind it rather than in front of guests.

3 functions repointed: clone_engagement, derive_tasks_for_engagement,
resolve_and_project_guest_label. Only BARE spine refs (travel_overlay_engagements) →
travel_engagements; the child tables travel_overlay_engagement_* keep their names (they are
overlay content, still correctly prefixed). 15 code files swapped; the substring-safety grep
confirmed only child-table refs remained — the trailing 's' before end-of-token distinguishes
the spine (travel_overlay_engagements) from its children (travel_overlay_engagement_*), so
the sed matched the spine and left children untouched. No greedy-match damage.

BUG SURFACED + FIXED — pre-existing latent, from the travel_immerse era (~2 rename campaigns
ago), invisible until now:
  travel-read-engagement-admin (list mode) embedded travel_trips in its .select() via a
  PostgREST relationship HINT pinned to the constraint name travel_immerse_trips_trip_id_fkey
  — a name that stopped existing when the immerse→overlay rename happened, and again at 5b.
  The hint lived INSIDE a .select() template string, so tsc and every table-name grep were
  blind to it (it is neither a table name nor a typed symbol). It only fired now because the
  table rename changed how PostgREST resolves the embedding.
  Root cause of the ambiguity: travel_engagements ↔ travel_trips has TWO FKs
  (travel_engagements.trip_id → travel_trips, AND travel_trips.confirmed_engagement_id →
  travel_engagements). With two relationships, PostgREST REQUIRES an explicit hint to
  disambiguate — so the fix is not to drop the hint (first attempt — wrong, produced PGRST201
  ambiguity) but to CORRECT it to the current constraint name:
  travel_trips!travel_engagements_trip_id_fkey. (Stage 6 note: this hint updates AGAIN when
  travel_trips → travel_journey renames that constraint.)
  LESSON: PostgREST embed hints are constraint-name string literals inside .select() — a
  THIRD invisible-to-tooling reference class alongside (1) loose invoke payload keys and
  (2) pg_proc function bodies. After any table/constraint rename, grep .select() strings for
  '!' hints AND old constraint/table stems (travel_immerse, travel_overlay_engagements_).
  And: read the actual PGRST error (200 vs 201) rather than speculating — 200 = relationship
  not found (stale hint), 201 = ambiguous (needs a hint). They point to opposite fixes.

Verified live post-view-drop: #admin/trips renders; Yazeed v3 proposal renders; guest brief
+ programme on trip 1d680dcc render with 6 flights (the _shared/trip.ts guest path);
OutlookTab Sharm (89aee7e3) commission 951.60, net 666.12.

### NEXT (Phase B remaining)
- STAGE 6: travel_trips → travel_journey (the journey capability module). trip_id → journey_id
  on bookings, requests, travel_engagements(spine), trip_guests; the 6 leaves' engagement_id →
  journey_id (corrects the Stage-1 drift); reconsider leaf homes (briefs/days/destinations/
  route/welcome = travel_journey_*; guests = ?). confirmed_engagement_id reconsider. UPDATE the
  travel-read-engagement-admin embed hints (both the trip: and primary_client: hints reference
  travel_trips constraints that rename here). The OLD standalone Stage 4 is DISSOLVED — the
  trip_id rename is trip_id → journey_id, folded into Stage 6.
- STAGE 7: travel_engagement_aux_bookings → elements (FK retarget to the spine).
- DEFERRED HONESTY PASS (Category Z): { trip_id } payload contract, tripId locals,
  TripDayItem.trip_id, Trip* type fields. Plus the travel_immerse comment strings (5 harmless
  doc comments found in 5b grep). One both-sides sweep.
- clone_engagement bedding_type gap; orphan fn update_travel_immerse_bottom_notes_updated_at
  (references a non-existent table — verify + drop).

  ### [FIX] Subpage hero bleed — stay-subpage sections read destination detail, never engagement

Pre-existing render bug in the eight-shape surface (NOT a migration artifact), found while
prepping Yazeed's live multi-destination proposal. Two sibling sections — the primary hero
and the interstitial (hero-2 cinematic band) — read ctx.engagement unconditionally. On a
destination subpage (shape 'stay', rendered via ImmerseDetailPage → resolveSectionSet), that
meant every subpage showed the ENGAGEMENT's lead hero instead of the destination's own:
Miami and St Barths both showed NYC's "A More Intimate Manhattan" hero-2, and Miami's hero-1
was the engagement's NYC-winter image.

Root: of the sections that resolve for shape 'stay', hero and interstitial were the only two
reading ctx.engagement; every other stay section already read ctx.detail. Fixed both to
branch on ctx.detail.

THE RULE (locked with D) — subpage hero resolution, both hero-1 and hero-2:
  NEVER fall back to the engagement on a subpage. Either the OVERLAY-SEEDED value (the
  destination row's *_override) or the DESTINATION CANON fallback (travel_destinations →
  global_destinations) — nothing borrowed from the engagement.
  - hero-2 (interstitial): override or NOTHING. No canon fallback (a second hero is optional);
    null override → section renders null. detail ?? engagement only selects the source object;
    when detail is present its own null hero-2 correctly yields no interstitial.
  - hero-1 (primary): override → destination template → global canon (detail.heroImageSrc is
    already this chain, engagement-free). A subpage always needs a primary hero, so it resolves
    to the destination's own, never "nothing", never the engagement.
  Journey top-level (no detail): the engagement's own hero — that is where the engagement hero
  belongs, and the only place it renders.

Companion fix earlier the same session: queriesImmerseProposal.hydrateDestination hero-2 was
override-or-null (dropped a ?? dest.* canon fallback on the SECOND hero specifically — the
second hero is override-or-nothing by the rule above; the PRIMARY hero keeps its canon chain).

Type-safety: detail exists only on the proposal arm of EngagementClientData
(typesImmerseDelivery.ts). Both renderers narrow via ctx.stage === 'proposal' before reading
ctx.detail; the sections resolve only for proposal/draft stages anyway.

ARCHITECTURAL NOTE (Stage 6): subpage hero resolution keys on ctx.detail = the destination
override, a JOURNEY object. When travel_trips → travel_journey and the destination tables
become travel_journey_*, this resolution is journey-capability-owned; other engagement_types
(dining/stay/acquisition) will own their own subpage-hero paths. The override-or-canon rule
is correct now and survives that transition.

LESSON (verification discipline): this took several wrong edits before landing — the query
hydrator, then the section registry, then the surface — because each was edited/investigated
before opening the file the LIVE route actually renders. When a component's grep for a field
comes back EMPTY, that means it DELEGATES — open it and follow the prop — NOT "irrelevant,
move on". The live path was route → ImmerseEngagementSurface (activeDestSlug branch) →
ImmerseDetailPage → SECTION_RENDERERS; the fix belonged in the renderer the whole time. Also:
a stale code COMMENT ("stay sections return null until Stage B") was false — the cutover had
happened. Trust the running page, not the comment.

### [ARC][DB] Phase B Stage 6 · PHASE 1 — travel_trips → travel_journey (view-protected renames)

The journey capability gets its true name. Stage 6 = FULL MISSION (D: "mission mission mission"),
split into two sequenced phases within the one stage because column renames can't be compat-view
protected the way table renames can. PHASE 1 = everything a view CAN cover.

RENAMED (Phase 1, all live, compat-view protected):
- travel_trips → travel_journey (the journey module: destinations/route/days/brief — NOT the
  spine, NOT dissolved). + name-lie constraints/indexes → travel_journey_* (pkey, code_key,
  primary_client, confirmed_engagement, payment_status_check, 4 idx).
- Own columns: trip_code→journey_code, trip_type→journey_type, trip_format→journey_format.
- 5 journey-leaf tables → travel_journey_* AND their engagement_id → journey_id (correcting the
  Stage-1 drift where leaves said engagement_id but pointed at travel_trips):
  travel_engagement_{briefs,days,day_entries,destinations,welcome_letters} → travel_journey_*.
- travel_trip_guests → travel_journey_guests, trip_id→journey_id (1-row table, 0 code refs;
  renamed for consistency; guests-model spine-vs-journey ownership = deferred deliberate call).

DEFERRED TO PHASE 2 (un-viewable column renames): trip_id → journey_id on travel_bookings,
travel_requests, travel_engagements (spine). These base-table columns can't be aliased back by a
view (the old name is simply gone), so they land AFTER caller redeploy — no live-break window.
Plus the { trip_id } → { journey_id } payload contract sweep and the embed constraint-name hints.

STAYS (honest nouns — full mission means NOT renaming these): destinations[] (a list of
destinations), payment_status, confirmed_engagement_id, public_title/subtitle. And
travel_engagement_aux_bookings UNTOUCHED — it becomes a spine ELEMENT in Stage 7 (retargets the
engagement, not the journey); renaming here = a lie torn out next stage. a_house_destinations
(house-history table, different meaning) NOT touched — grep false-positive.

COMPAT VIEW TECHNIQUE, extended for columns: the main-table view aliases renamed columns back
(journey_code AS trip_code); the leaf views alias journey_id AS engagement_id. For CALLERS
repointed to the base tables, PostgREST select-aliasing carries the old field name on reads
(select 'engagement_id:journey_id, ...') so consumers reading .engagement_id keep working, while
.eq/.in/.insert/.upsert/onConflict use the real journey_id. This split (alias on projection, real
column on predicate/write) is the Phase-1 minimal-correct fix; full field-name honesty is the
Phase-2 payload sweep.

TWO LESSONS (both cost cycles, both worth banking):

1. COLUMN-RENAME RIPPLE IS WIDER THAN THE TABLE NAME. The first caller sweep carried table names
   and trip_code but MISSED engagement_id → journey_id on the 5 leaf tables — every leaf .select/
   .eq/.insert still said engagement_id, a dead column on the renamed base tables. Surfaced as the
   Austria (kF4nP8wRm2x) delivery hero vanishing (destinations query returned empty → no
   destinations[0] → no hero). A column rename ripples to: every .select naming it, every .eq/.in
   filter, every insert/upsert payload key, every onConflict, AND the result-type + consumer reads.
   COMPLETENESS CHECK after any column rename:
     grep "\.eq('OLDCOL'\|\.in('OLDCOL'\|OLDCOL:\|onConflict: 'OLDCOL"  across the caller set,
   then CLASSIFY each hit by the table it sits on — the same column name is CORRECT on unrenamed
   tables (aux_bookings.engagement_id, bookings.engagement_id, the spine's confirmed_engagement_id).
   Blanket sed is unsafe; change only the renamed-table accesses.

2. A RENAME SURFACES PRE-EXISTING BUGS. handleSetPublicView + handlePublicView queried
   travel_engagements (the spine) with .eq('engagement_id', tripId) — but the spine's key is `id`,
   it has no engagement_id column. This was ALREADY WRONG before Stage 6 (silent — public_view
   toggle likely no-opped) and only got noticed during the engagement_id audit. Fixed to
   .eq('id', tripId). Renames are a free audit of every column reference — read them, don't just
   mechanically swap.

VERIFICATION DISCIPLINE reaffirmed: exact-string replacement across multi-line query chains is
FRAGILE (indentation / intervening .select() lines caused several NOT-FOUND misses). The
grep-after-every-edit (not tsc — these are runtime column strings tsc can't see) is THE check.
tsc green ≠ applied. Prove the fix pattern on ONE file (here _shared/trip.ts, the guest hero path)
+ deploy + eyeball the live surface BEFORE scaling to the rest.

Verified through views: #admin/trips; guest brief+programme on 1d680dcc (6 flights); Sharm
89aee7e3 951.60/666.12; Austria kF4nP8wRm2x destinations resolve; admin leaf writes; Yazeed
proposal. (Austria hero, if still absent with destinations populating, is a genuine unseeded
case per the override-or-canon-nothing rule — content, not code.)

### NEXT — Stage 6 PHASE 2
trip_id → journey_id on travel_bookings / travel_requests / travel_engagements (+ constraints,
indexes). The { trip_id } → { journey_id } payload contract across the admin write/read surface
(~25 mode payloads in queriesAdminTrip + EF handlers reading body.trip_id — tsc-BLIND, per-surface
verify, deploy frontend+EF lockstep). Update embed hints: travel-read-expenses (travel_journey!
journey_id) + travel-read-engagement-admin (travel_journey!travel_engagements_journey_id_fkey).
Then DROP all compat views + re-verify. Sequenced after caller redeploy so the un-viewable column
renames have no live-break window.

## 2026-07-08

### [DB] element_status_events built from spec — a documented-but-never-created table, restored

Arc B Phase 3 (2026-06-27 changelog) documented `element_status_events` as a shipped
append-only status-history table. It was not. Only the WRITER shipped — the trigger
`fn_autopromote_on_confirmation` carried `INSERT INTO element_status_events` — but the
table itself was never created live. Every status-PROMOTION write (a confirmation_number
set on a not-yet-confirmed element, on `travel_booking_rooms` / `travel_bookings` /
`travel_engagement_aux_bookings`) hit the phantom table and failed silently, platform-wide.
Invisible until a real promotion fired (a room defaulting to `requested` getting a conf
number) — an already-confirmed header skipped the promote branch, so it never surfaced.

Built from the documented spec (not guessed): (id, element_type, element_id, from_status_id,
to_status_id, changed_by, source, changed_at); polymorphic element_id (no native FK — one
uniform log across the element tree); native FKs on from/to status; index (element_type,
element_id, changed_at DESC); RLS enabled, NO policies (deny-by-default, service-role-only,
matches a_ppd_*). The original trigger works unchanged once the table exists — no function
edit needed. Verified live: a real booking (Nicolas, room bc109ddc) inserted clean with
status auto-promoted to confirmed. Phase 3 audit logging now actually functions for the
first time.

LESSON: a changelog entry describing a feature as "shipped" is NOT proof the live schema
matches. The trigger (writer) and table (target) shipped separately; the gap was invisible
to code grep (no migrations tracked — schema is live) and to tsc, and only manifested on the
promotion path. Cross-checking changelog-documented DB objects against information_schema is
now proven-necessary "foundation perfect" work.

### [DB] Orphan function dropped — update_travel_immerse_bottom_notes_updated_at

Dropped `update_travel_immerse_bottom_notes_updated_at` — it referenced
`travel_immerse_bottom_notes`, a table gone since the immerse→overlay rename (~2 campaigns
ago). No trigger used it (verified via pg_trigger). Flagged in db_map v10 §4; closed.

The INVERSE of the element_status_events case, and the pair is the point: there, a live
trigger referenced a table that was never built (→ built it); here, a live function
referenced a table long dead (→ dropped it). Two schema-truth lies pointing opposite
directions, both surfaced by the rename-as-audit, both "foundation perfect" corrections
that only became visible because every reference got exercised.

### [DB] 5 set_updated_at triggers renamed off travel_trip_* — last travel_trip_* object-name lie closed

Trigger NAMES still carried `travel_trip_*` tokens while sitting on renamed tables (they
fire set_updated_at correctly — the name is a label, not a reference, so no bug). Renamed
to match their tables: trg_set_updated_at_travel_trip_{aux_bookings,briefs,day_entries,days,
destinations} → _travel_engagement_aux_bookings (aux stays engagement-scoped, → element in
Stage 7) / _travel_journey_{briefs,day_entries,days,destinations}. Surfaced by the S53O
trigger audit. This was the last travel_trip_* token on any DB object — tables (Phase 1),
functions (audit-clean), triggers (now) all consistent.

DEBT logged, NOT fixed (separate session): the set_updated_at trigger naming convention is
inconsistent platform-wide (trg_set_updated_at / set_updated_at / <table>_set_updated_at /
_<table> / _engagement_aux_pax abbrev). A normalization pass unrelated to the rename arc —
these are cosmetic-cosmetic (no stale-table lie), so logged for their own cleanup.

### [DB] Phase-2 view-drop pre-flight — pg_proc stale-reference sweep PASSED

Ahead of Stage 6 Phase 2 (which drops the Phase-1 compat views travel_trips + 5 leaf views +
guests view after the trip_id → journey_id column cutover): swept every function body for
references to the compat-view names. `pg_get_functiondef LIKE` travel_trips /
travel_overlay_engagements / travel_immerse* / travel_trip_* → ZERO rows. No DB function
resolves through a compat view, so dropping the views in Phase 2 breaks no function. The
chief cutover risk (a function body silently depending on a view about to be dropped) is
cleared from the function side. Guest-EF and frontend caller repoints remain the Phase-2
cutover work; the DB-function half is pre-verified safe.

### [DEBT] Guest-read reliability — silent ?? [] must fail loud (P1, own session)

Counterpart surfaced during the Nicolas programme fix: guest-read EFs use `result ?? []` on
Promise.all sub-fetches, so a transiently FAILED fetch (cold-start timeout, connection blip)
becomes an empty array — the guest sees "Nothing planned today" on a real travel day instead
of an error. Same failure CLASS as the leaf-column [], guest-flight [], and Austria-hero
bugs: a query fails, returns empty, no error, guest sees blank. LOCK: guest-facing reads must
fail loud (500), never silent-empty; [] must mean "genuinely nothing", never "fetch failed".
Strengthens the one-EF-three-modes read-path consolidation (one honest error path vs N EFs
each swallowing failures). Own session.

### [FIX] buildHotelItems re-check-in heuristic now scopes same-party, not same-hotel (P3 closed)

Was: any second booking at a shared hotel got "Re-Check-in" (grouped by hotel identity +
date range). Nicolas (1 night, {Nico, Joy}) sharing Beverly Hilton with the entourage's
21-night stay ({Hussain, Ibrahim}) was mislabelled "Re-Check-in" though a different party.
Fixed: re-check-in is now occupant-based — a booking is a re-check-in iff one of its
occupants (each room's person_id + additional_guests uuids, unioned) appears in an
earlier-STARTING stay at the same hotel. Disjoint parties sharing a hotel are independent
first check-ins ("Check-in"); a genuine same-party split stay still reads "Re-Check-in".
Same-range concurrent rows (one party split across booking rows) guarded via stampedStay so
they don't flag each other. Verified live on kH9mP4wRn3x: Nico Jul 6 now "Check-in",
entourage Jun 29 stays unchanged.

This resolves the party half of the hotel-vs-party conflation. The calendar "Stays" metric
debt (S53I) — distinct-hotel count conflating properties / principal's stays / room footprint
— is the SAME model question on the admin side and remains open (needs the calendar EF to
carry room counts + principal/entourage distinction). The occupantsOf pattern here (party =
union of room occupants) is the reusable primitive for it.

### [ARC-pending] Canonical formatName() + fully-tailorable name register — foundational, own session

Surfaced chasing a cosmetic name-register blemish ("Nico" lead vs "Joy Tran" additional guest
on the same room); the blemish is the visible tip of a foundational gap. NOT a debt to patch —
a foundation piece the codebase is explicitly waiting for. Do it right, own session, recon-first.

THE PROBLEM (two uncoordinated name rules = parallel-ship):
- Frontend: assembleFormalName (HouseTab.tsx:151) — the patronymic-chain composer
  (given + [middle] + [connector]father + [connector]grandfather + [family]; Western names
  collapse to "First Last"). LOCAL to one component. Its own code comment names the target:
  "Single rule ... mirrored by the canonical formatName() formatter later." The codebase
  already knows this must become canonical.
- EF side: formatPersonName (_shared/names.ts) — nickname || full || first. A DIFFERENT rule.
- These never coordinate. "Nico · Joy Tran" is not a bug in either — it's formatPersonName
  preferring nickname, and Joy's nickname field literally holds "Joy Tran". Consistent logic,
  inconsistent output, because there is no single register authority.

WHY IT'S FOUNDATIONAL, not a quick fix: "fully tailorable" name register (D) means the
designer sets, per person, how that person is presented — nickname / first / first+last /
first+last_initial ("Mohammed Q", the last_initial field's purpose) / full-formal (the
patronymic chain). The register must compose at ANY of these, and full-formal IS
assembleFormalName. So the register feature REQUIRES the canonical formatName() first —
building register on top of the two divergent rules deepens the drift the mission forbids.

THE BLOCKER (shared with the dual-TimelineRoom debt): a single formatName() must be callable
from BOTH the Vite frontend (src/) AND the Deno EFs (_shared/) — but Deno EFs cannot import
from src/. There is no shared-code strategy in this repo yet. This is the real architectural
decision gating both this and the TimelineRoom unification: WHERE can code live that both
runtimes import (shared package / generated / dual-safe module)? Must be resolved FIRST.

THE BUILD (once the boundary is solved), in order, no half-ship:
1. Canonical formatName(person, register) — THE single name composer, one home both sides
   reach. Subsumes + retires assembleFormalName (frontend) AND formatPersonName (EF). Full-
   formal register = the patronymic rule moved here; HouseTab imports it (its live preview
   stops owning the rule). This is the formatName() the code comment promises.
2. Register vocabulary as a REGISTRY (global_name_display_modes: slug PK, label, sort_order),
   NOT a 3-slug CHECK — "fully tailorable" earns a registry (the bedding_type registry call,
   made correctly this time). Registers: nickname / first / first_last / first_last_initial /
   full_formal (extensible).
3. global_people.name_display FK -> registry, nullable, default null. On global_people because
   the RLS architecture DICTATES it: global_people has the public-read gate (is_public_display
   policy) + the name-presentation fields (first/last/nickname/last_initial); a_house_people is
   admin-write-only (no public read policy) so a guest-surface display field there would be
   RLS-invisible to guests. Confirmed via pg_policies — not a preference, the table purpose
   forces it. Default null -> current nickname-or-first (privacy-preserving; full_formal is
   deliberate designer opt-in, the one register that exposes more than the privacy default).
4. Thread name_display through the THREE guest select sites only (_shared/names.ts:118
   passengers, _shared/trip.ts:273 room + additional guests, travel-get-trip-confirmation:126
   contacts) — classified: admin/operational reads (trip-admin, engagement-admin, timetracking,
   tasks, team) stay CANONICAL (operators need unambiguous identity; register is guest-surface
   presentation only). Adding name_display to a select is fail-safe (unselected -> null ->
   default), unlike the bedding_type 42703 case (that was a selected-nonexistent column).
5. Admin control: a register picker in the person editor (HouseTab PersonModal, beside the
   name fields), designer-set per person. Without it the feature is half — this is the
   "tailorable by designer" piece.
VERIFY: Nico/Joy/an entourage member each render at their set register across programme +
confirmation + brief; admin surfaces unchanged; HouseTab live preview uses the same formatName.

### [DEBT] Dual TimelineRoom type (EF _shared + frontend) — hand-synced, drifted (P3)

Two independent TimelineRoom definitions: supabase/functions/_shared/timeline.ts (EF timeline
builder) and src/types/typesTimeline.ts (consumed by ImmerseConfirmedSections). Kept in lockstep
by hand — and had drifted: the frontend copy lacked additional_guests, so the programme silently
dropped room co-guests for EVERY shared room (surfaced adding Joy Tran to Nicolas's room bc109ddc;
the Berkeley suite's "+ Jell" was also being dropped, unnoticed). Fixed by adding the field to
both + threading resolved_additional_guests through buildHotelItems -> TimelineRoom -> CardItem ->
webRoomDisplay (which already composed additional guests — the confirmation surface, reading rooms
directly not via timeline, showed them all along; only the programme's timeline path dropped them).
Parallel-ship remains: any future TimelineRoom field must be added twice or it drifts again.
Mission-correct fix is ONE shared type — blocked by the EF/frontend module boundary (Deno EFs
can't import from src/), needs a shared-type strategy (generated, or shared package). Own session.

RECON (this session): confirmed the boundary is real with no existing bridge. vite.config.ts
has NO resolve.alias — the frontend build resolves only src/ + node_modules, cannot reach
supabase/functions/_shared/. The EF side (deno.json import map: esm.sh + npm: specifiers) is a
separate resolution universe. So a shared-directory-both-import-from (the clean option) is NOT
available as-is — it needs a build-setup change (Vite alias into a neutral shared dir, guarding
Deno-style imports out of the browser bundle) OR a codegen/sync approach (one canonical file
copied cross-boundary with a CI drift-check). This is a REPO-WIDE shared-code-strategy decision,
the SAME blocker as the formatName() arc — solve once, both unblock. NOT to be introduced as a
side-effect of a P3 type-dedup. The two TimelineRoom types are currently byte-identical (verified),
so drift risk is low TODAY; the structural fix waits for the deliberate boundary decision. When
taken: TimelineRoom is the ideal FIRST case (pure type, zero runtime) to prove the chosen pattern
before applying it to formatName's harder runtime-logic case.

## 2026-07-05 (S53L — DB integrity session, self-audited)

### [DB] Session intent + honest accounting — verify-against-live-schema-FIRST reaffirmed

INTENT: foundational DB integrity work clear of M's HPGL/rename arcs — close free-text
smells, enforce implied invariants, kill naming drift. Make the foundation honest, not
add features. Six pieces attempted.

METHODOLOGICAL ERROR (the reason this entry matters more than the work): consulted
information_schema per-table intermittently but NEVER read this changelog before starting
DB work — so did not know the travel_immerse_* → travel_overlay_* → engagement/journey
rename campaign was in flight. Built confidently against stale travel_immerse_* names that
were renamed campaigns ago. Same failure class as every rename-audit lesson already logged
here: the live schema is the only truth, git can't show it, and the changelog is the only
record of renames. Consult BOTH before any DB work — not after it breaks.

SOLID (tables outside the rename campaign — verified live, correct):
- website_url → website convergence: renamed on travel_accom_brands, travel_accom_hotels,
  travel_happenings, travel_suppliers (4 tables) + 6 guest-frontend consumer files. Platform
  now uniform on `website` (non-redundant name; the _url suffix is decorative). EF-safe
  (zero EF refs). Shared-DB safe sequence: frontend deploy THEN rename, graceful degradation
  (links briefly absent, never errored). tsc-verified, live-verified.
- is_public ⟹ is_active CHECK on travel_shopping + travel_happenings
  (travel_{shopping,happenings}_public_implies_active). Enforces the two-stage model
  (is_active=lifecycle, is_public=audience) — inactive+public now structurally impossible.
- link_type → engagement_link_type enum (guide/custom parallel-built; extended to the full
  UHNW set: +form, confirmation, document, payment, contact). travel_engagement_links,
  confirmed engagement_id-keyed (current post-5a). NOTE: 5 new enum values have NO distinct
  render yet — assign a link a new type only after its render ships, or the type claims
  meaning the UI ignores.
- Per-surface engagement links: show_on_proposal (default false) + show_on_confirmation
  (default true) on travel_engagement_links. Both EFs filter by them; proposal EF gained
  the links feature it never had. Defaults preserve prior behavior. Both paths verified,
  test-elect reverted.
- opening_hours jsonb (nullable) on travel_dining_venues (the `website` col already existed —
  original "add website" half was a phantom). Shape = Option B (per-day service periods +
  bounded notes), enforced app-layer per existing bullets-jsonb convention. INERT: no
  reader/writer yet — TS type + admin form + card render are the completion (follow-on).

SUSPECT — ran against STALE travel_immerse_* names, must be re-verified + likely redone on
correct tables:
- destination_url_slug format CHECK + per-trip unique index: ran against
  travel_immerse_trip_destination_rows + travel_immerse_rooms — names that no longer exist.
  Live truth: the destination-rows table is now travel_overlay_engagement_destination_rows
  (and/or travel_journey_destinations — the rename split), rooms is travel_overlay_rooms.
  Post-audit, ONLY card_selections_slug_format survives (on
  travel_overlay_engagement_content_card_selections). The two intended constraints
  (destination-rows format+uniqueness, rooms format) are NOT on the live tables — landed on
  ghosts or nowhere. MUST redo on: travel_overlay_engagement_destination_rows (or
  travel_journey_destinations — confirm which holds destination_url_slug), travel_overlay_rooms.
  Design decisions still valid (format ^[a-z0-9]+$ on all slug-bearing tables; per-"trip"
  uniqueness on the canonical/identity table — but the trip_id column is now journey_id/
  engagement_id, so the unique index key must be re-derived on the real column).
- HPGL DB foundation done early this session (house_label_context enum, engagement_houses
  join, Austria seed): a_house_* / engagement_houses may be OUTSIDE the rename path (verify),
  but re-confirm table names before trusting. M owns the HPGL arc — coordinate.

RETRACTED — trip-surface consolidation arc spec (arc_trip_consolidation.md): DISCARD. It
duplicates work M is ACTIVELY building ("one-EF-three-modes read-path consolidation",
referenced in the 07-08 guest-read-reliability entry). Scoped before reading the changelog =
the exact parallel-planning the changelog exists to prevent. Not a contribution; a collision.

LESSON (standing, reaffirmed not new): before ANY DB work — (1) read this changelog for
in-flight rename campaigns, (2) resolve every target table name against information_schema,
(3) THEN act. In-context table names are stale by default in this repo. "Success. No rows
returned" on a DDL against a nonexistent-name table is NOT proof it applied to the table you
meant — verify the constraint/column exists on the LIVE table by its CURRENT name afterward.

## 2026-07-10 (S53P — Stage 6 Phase 2 + EF boundary sweep · INTENTION, recon-frozen)

### [INTENT] Journey column cutover + travel-write-trip dissolution — mission-derived, recon-first

**The intent.** Close Stage 6: rename the three base-table columns trip_id -> journey_id
(travel_bookings NOT NULL/financial, travel_requests, travel_engagements/spine), drop the
7 Phase-1 compat views, and — because the mission forbids shipping an honest column into a
dishonest EF — dissolve travel-write-trip along the engagement-type model. The engagement is
the top-level entity; engagement_type resolves the capability tier (journey / acquisition /
dining / concierge / stay / transport / experience / ...). A writer named after "trip" (a
table that no longer exists) that writes across spine + journey + requests + hosted arm is
itself the debt. D ruling: full mission, "as far as verified-safe takes us."

**The home map (D-ruled).**
- SPINE (type-agnostic, every engagement): set_public_view is the ONLY pure-spine mode in
  the file (writes travel_engagements by id). Payload key -> engagement_id.
- JOURNEY ARM (one capability; a dining engagement never touches it — "dining-only
  engagements have no room for trip anywhere"): create_trip/update_trip/
  update_trip_primary_client (journey CREATION), briefs, days, day_entries, destinations,
  welcome_letters, journey-scoped bookings, aux (until Stage 7 retargets aux to spine as
  ELEMENTS). Payload key -> journey_id. This is the ONLY place "trip" survives, renamed to
  journey. File -> travel-write-journey.
- REQUESTS: cross-cutting, own home. create/update/delete_request.
- HOSTED ARM: link/unlink/remove_programme_guest — S53N independent peer arm, does NOT
  belong in a travel-engagement writer. DEFERRED to own session (logged debt); stays in
  place tonight (no 404).

**Ruling 1 (confirmed): honest-per-meaning payload keys.** NOT a blanket trip_id->journey_id.
Each payload key becomes the name of what its value identifies — journey_id for journey-scoped
modes, engagement_id for set_public_view (spine). create_request already correctly separates
trip_id + engagement_id. A blanket rename would MINT a lie in set_public_view (its value is a
spine id, not a journey_id) — the exact drift the campaign kills.

**RECON FINDINGS (07-10, live) — two corrections to the prior plan, banked before acting:**

1. travel-write-engagement is NOT a mode-dispatcher — grep "case '" returned EMPTY. Its
   reassign_trip path (L448) is inline, not a switch. So "lift set_public_view into the spine
   writer" is NOT a drop-in mode move — that EF's shape must be READ before set_public_view's
   home is decided. Prior plan assumed a switch that isn't there. MUST read
   travel-write-engagement/index.ts before Step 1.

2. The leaf reads are MOSTLY ALREADY CORRECT — Phase 1 threaded the engagement_id:journey_id
   projection-alias pattern through them. Verified clean: travel-read-trip-admin:171,373 and
   _shared/trip.ts:109 all use .eq('journey_id', ...) with the alias. So the prior "two
   live-behind-view leaf bugs" claim is UNVERIFIED and likely wrong. The remaining trip_id
   references cluster on the THREE BASE TABLES (spine/bookings/requests = Category A, the real
   rename targets) + payload keys (Category C) + TS type fields (Category D honesty) + comments.
   _shared/trip.ts:53 (.eq('trip_id', tripId)) still needs its BLOCK read (L50-55) to classify
   which table it targets — spine-base (Category A) vs leaf (bug). Do NOT assume; read it.

**Category map (the classified sweep, per the rename-ripple rule — classify each hit by its
table, never blanket-sed):**
- A (DB column on the 3 renamed base tables -> journey_id): the .eq/.select/.in/.not/.insert
  on travel_bookings, travel_requests, travel_engagements. Includes handleCreateBooking:172
  .insert({trip_id}) — the ONE hard SQL-coupled write in travel-write-trip.
- B (embed hints, invisible-to-tooling): travel-read-expenses:65,208 (travel_journey!trip_id
  -> !journey_id); travel-read-engagement-admin:124 (travel_engagements_trip_id_fkey ->
  _journey_id_fkey, the renamed constraint).
- C (payload keys, tsc-blind loose invoke): the whole travel-write-trip mode surface +
  travel-read-trip-admin mode dispatch + queriesAdminTrip/Requests/Engagements invoke bodies.
  Honest-per-meaning (Ruling 1).
- D (type fields + comments, honesty): Trip*.trip_id type fields, TripDayItem.trip_id,
  url_id->trip_id->house_id comments. Category Z, folds in.

**SEQUENCE (view-protected, one home at a time, rendered-page eyeball between each — the
mission bar "admin/client never in a broken state" made literal; NOT all-at-once):**
- Step 0: DONE — this recon freeze.
- Step 1: read travel-write-engagement; lift set_public_view to spine (payload engagement_id);
  forwarder stays in travel-write-trip until Step 4. Verify: public_view toggle live, old+new path.
- Step 2: extract create/update/delete_request to their home. Verify: request create.
- Step 3: journey writer + COLUMN RENAME together. SQL (3 cols + 3 constraints, one txn;
  indexes already Phase-1-renamed, skip). Flip handleCreateBooking:172. Honest journey_id
  payloads. Category-A caller repoint (classified). Embed hints (B). Rename file
  travel-write-trip -> travel-write-journey. Verify: Sharm 951.60/666.12, Austria destinations,
  guest programme 1d680dcc (6 flights), Yazeed proposal, an admin brief write + booking create.
- Step 4: drop forwarders + 7 compat views. Grep-zero old names. RE-EYEBALL one guest + one
  money surface AFTER drop (the drop is when a missed ref surfaces).

**VERIFICATION DISCIPLINE (standing, reaffirmed): the rendered page is the check, not tsc/grep.
Prove the pattern on ONE file + deploy + eyeball BEFORE scaling. Grep callers for payload keys
(compiler blind to loose invoke). Grep .select() for ! embed hints + old constraint stems.
Read _shared/trip.ts:53's block before classifying it — inspect, never infer.**

DEFERRED (logged, not this session): hosted-arm handler extraction; Trip* TS type-field
honesty may split to its own pass if Step 3 blast radius is large; TimelineRoom dual-type +
formatName() both blocked on the shared-code boundary (vite.config confirmed no resolve.alias —
the boundary is real, no bridge exists).

## 2026-07-10 (S53P — Stage 6 Phase 2: journey column cutover · DB+EF layer SHIPPED, verified live)

### trip_id -> journey_id on the 3 base tables — the un-viewable cutover, closed

**Shipped + live-verified.** The base-table columns a compat view cannot alias on write
are renamed. Money math and guest render both confirmed green post-deploy.

**DB (one transaction):**
- travel_bookings.trip_id -> journey_id (NOT NULL, financial)
- travel_requests.trip_id -> journey_id
- travel_engagements.trip_id -> journey_id (the spine)
- 3 FK constraints renamed *_trip_id_fkey -> *_journey_id_fkey (targets already
  travel_journey, auto-followed from Phase 1)
- Indexes idx_travel_bookings_journey + idx_engagements_journey_id: NO change — already
  named for the target in Phase 1, column auto-followed.

**ORDERING NOTE (learned the hard way):** the SQL was run BEFORE the callers were repointed
(intended order was callers-first). This put the live surface into 42703 until the EF sweep
landed. No data lost, no rollback — the fix was forward (repoint + deploy), which is the
work that was queued anyway. Compat views protected the guest TABLE-name path throughout;
only base-column WRITES/reads were exposed, admin + money surfaces, briefly. For a base-column
rename with no downtime pressure, callers-first is still correct; when inverted, do not roll
back — drive forward.

**EF + shared-module sweep (Category A — DB-column accesses), all deployed --use-api:**
- _shared/trip.ts (guest entry): spine select/not/guard + booking .eq
- _shared/expenses.ts: BOOKING_FINANCIAL_SELECT trip_id -> journey_id  [the 500-causer, below]
- travel-get-trip-confirmation, travel-get-trip-programme: booking select + .eq
- travel-read-trip-admin: 17 accesses (spine + bookings selects/in/not, result-type fields,
  map keys, requests select)
- travel-read-expenses: spine select/not + 2 embed hints (travel_journey!trip_id -> !journey_id)
- travel-read-engagement-admin: spine select + embed hint (constraint-name
  travel_engagements_trip_id_fkey -> _journey_id_fkey) + result-type fields
  (EngagementListQueryRow.trip_id -> journey_id, trip.trip_code -> journey_code)
- travel-write-engagement: EDITABLE_SCALARS whitelist + reassign_trip .update
- travel-write-trip: resolveRoomRow booking select/guard + handleCreateBooking .insert
- travel-get-immerse-proposal: spine select

**VERIFIED LIVE (rendered page + numbers, not tsc):**
- Guest programme 1d680dcc + kH9mP4wRn3x: renders, flights present
- OutlookTab Sharm 89aee7e3: Net Margin 666.12, Commission 951.60, Net Revenue 666.12,
  IATA 285.48 — money math intact through the rename (double-count fix held)
- StudioDashboard money strip

### NEW STANDING RULE — _shared/ modules are the 4th invisible-to-tooling reference class

The per-EF file list is NOT the deploy surface. _shared/*.ts modules bundle into every EF
that imports them and carry their own column-name string references. File-scoped grep over
named EFs misses them; tsc misses them (runtime strings); they surface only as a runtime 500.

PROOF this session: swept 9 named EFs green, deployed, programme rendered — then OutlookTab
500'd on "travel_bookings.trip_id does not exist" because _shared/expenses.ts:26
BOOKING_FINANCIAL_SELECT still said trip_id. Second occurrence same session (_shared/trip.ts
was the first).

MANDATORY after any column rename:
1. grep -rn "<oldcol>" supabase/functions/_shared/   (explicit separate step)
2. classify: DB-column access (flip) vs type field / object-literal key / comment / local (leave)
3. grep -rln "_shared/<module>" supabase/functions/  -> redeploy EVERY importer (bundle = runtime)

Joins the 3 existing classes (loose invoke payloads, pg_proc bodies, PostgREST embed hints).
Dev Standards §VIII.

### ZSH/paste note (tooling, not code)
Multi-line sed pastes into the VS Code integrated zsh terminal fail on `!` (history
expansion) AND on bracketed-paste mangling even after unsetopt banghist. Reliable path for
batch edits: author the change as per-file find/replace in the editor, OR write the script
via editor-tab save (not terminal paste) then `bash file.sh`. Do not fight the line editor.

### STILL OPEN in Phase 2 (not this entry):
- Section C: frontend { trip_id } payload contract -> honest-per-meaning (journey_id for
  journey-scoped, engagement_id for set_public_view). set_public_view -> set_visibility
  duplicate retirement (set_visibility already exists in travel-write-engagement, verified).
  Type-field honesty (Trip*.trip_id, _shared/days.ts:15+64 pair). EF handlers still
  destructure body.trip_id — working, not broken, but the name-lie the mission ends.
- Section D: DROP the 7 compat views (travel_trips + 5 leaf views + travel_trip_guests),
  grep-zero old names, re-eyeball 1 guest + 1 money surface POST-drop (the drop is when a
  missed ref surfaces).
- Then: EF boundary sweep (spine-writer / journey-writer split per engagement_type model) —
  own campaign, queued.