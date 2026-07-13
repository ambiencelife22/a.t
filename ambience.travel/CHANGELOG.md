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

## CURRENT TRUTH · state of the schema as of S53R (13 Jul 2026)

> This block is the reconciled ground-truth snapshot. Read it FIRST. It is verified against
> `information_schema` / `pg_catalog` (S53R ground-truth pack), not reconstructed from entries below.
> Entries beneath it are the chronological record (newest-first); where an older entry's claim was
> later found false, it carries an inline `[CORRECTED S53R: ...]` annotation — the claim is preserved,
> not erased, so the record of what was believed stays intact.

**The spine.** `travel_engagements` is the service-agnostic spine (40 rows live), typed by
`engagement_type_id`, self-nesting via `parent_engagement_id`. `travel_trips` is GONE (table).
`travel_overlay_engagements` is GONE (renamed to the spine). `travel_engagement_aux_bookings` is
GONE (Stage 7 — elements are now typed child nodes). 26 inbound FKs to the spine (verified).

**The nine shapes** live in `travel_engagement_types` with a `level` column (`shape` | `element`):
9 shapes (journey, stay, dining, reservation, transport, experience, acquisition, arrangement,
concierge_service) + 13 element types. Confirmed present live.

**Journey capability:** `travel_journey` (7 rows), `confirmed_engagement_id` → spine.
**Overlay:** `travel_overlay_*` (per-engagement authored content). **Hosted arm:** `travel_hosted_*`
(the founder-ratified PEER — do NOT fold into the spine). **Element detail:**
`travel_engagement_transport_detail` / `_dining_detail` (1:1, node-keyed); write path via the three
`create/update/delete_element` RPCs.

**Registries (live):** `travel_lifecycle_statuses` (10–90 ladder + off-ladder 200s),
`travel_itinerary_statuses`, `travel_payment_platforms`, `travel_rate_types`, + Stage-7
`travel_cabin_classes`/`travel_aircraft_types`/`travel_airports`.

**Known open reconciliations (see debts board):** frontend `typesImmerse.ts` still maps 8 shapes
(DB has 9 — concierge routes to journey by fallback · D3); dining element nodes borrow the `dining`
shape slug, split pending (D4); 7 residual `travel_trip_*` index/constraint tokens (D12); `public_view`
still defaults `true`, ruled → `false` (D2); two grammar-law name violations (`travel_aux_driver_details`,
`travel_engagement_aux_passengers` · D12); two residual EF names (`-trip-`, `-programme-` · D13).

**Doc set (S53R):** Universal Doc #4 Mission (canon) · Reference Guide v6 · Dev Standards v3.5 ·
Open Debts board. Reference Guide v5 RETAINED as the cross-product/infra doc. This changelog was
reconciled S53R (deduplicated — the S53Q block was pasted 4×, S53L 3× — false claims corrected inline).

---

## 2026-07-13 (S53R — doc-set rebuild + RLS posture correction + changelog reconcile)

### [DB] Seven RLS-zero-policy tables closed — silent deny-all → explicit admin-only

Ground-truth audit (Q13) found seven tables with RLS enabled and ZERO policies — the silent
deny-all latent bug the S53L standing rule forbids (works only via service-role bypass, empty on
any other path). Added `FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user())`
to: `travel_engagement_expenses`, `travel_expense_items`, `travel_partners`, `travel_task_templates`,
`travel_tasks`, `travel_aux_driver_details`, `travel_journey_welcome_letters`. Verified live: each
moved 0→1 policy. `element_status_events` deliberately LEFT at 0 policies (documented service-role-only
audit log — the one correct deny-all). Used `TO authenticated` (tighter) over the drifted `TO public`
seen on some existing policies. This is the only live schema write of S53R.

### [CANON] Rulings ratified this session (D)

- `public_view` default → `false` (D2). GUARDRAIL: do not touch the 4 currently-public engagements.
- Dining shape/element SPLIT (D4, "mission always") — add a distinct dining element slug, no shared name.
- Grammar law is LAW (not description): tables under the spine are named `travel_engagement*`; the two
  `aux` violations are name-lies to correct (D12).
- The nine shapes confirmed present in `travel_engagement_types` (concierge_service, level='shape').
- SPORTS standards stay in their own doc; Ref Guide v5 retained as cross-product/infra home.

### [PROCESS] Changelog reconciled — deduplicated + false claims corrected

This file was corrupted by copy-paste: the S53Q Stage-7 block appeared 4×, S53L 3×, several others 2×
(~550 lines of pure duplication). Reconciled conservatively: kept the fullest copy of each block, removed
duplicates, preserved every unique entry's wording. The S53O "last travel_trip_* token closed" claim was
found false (7 tokens remain) and is annotated inline `[CORRECTED S53R]` rather than deleted. A
CURRENT-TRUTH header (above) was added as the read-first ground-truth snapshot. Nothing real was removed.

---

## 2026-07-12 (S53Q — Stage 7 Phase 2 COMPLETE: aux table retired, elements are the tree)

### [ARC][DB] travel_engagement_aux_bookings DROPPED — every element now lives solely as a typed engagement-tree node

The flat aux table is gone — not a table, not a view (`to_regclass` returns null). Every
element (flight / dining / airport_transfer / meet_greet) now exists ONLY as a node on
`travel_engagements` (`iteration_label='element'`, `parent_engagement_id` = the confirmed
engagement) + its 1:1 detail row (`travel_engagement_transport_detail` for flights,
`travel_engagement_dining_detail` for dining; bare nodes for transfer/meet_greet). No parallel
source remains. This closes the Stage-7 model: the engagement tree is the single truth for
elements, read + written transactionally. Live Supabase — invisible to git; this is the record.

**Read path (all readers on the tree, verified live):**
- `_shared/engagement.ts` (was `_shared/trip.ts` — renamed, the last trip-named survivor in the
  shared layer; exports `fetchEngagementCore`/`EngagementCore`/`fetchEngagementBookings`).
  `fetchElementsFlat(db, parentEngId)` reads node+detail and flattens to the legacy aux shape
  (a BRIDGE — deleted when consumers read engagement shape directly; do not calcify).
  `fetchOneElementFlat(db, nodeId)` for the write return-shape. `enrichElements(db, elements,
  partyLabel)` — GLOBALIZED passenger/driver/dining enrichment (was inlined verbatim in both
  guest EFs, a live drift risk; now one home).
- `_shared/elementFields.ts` — single field-map (flat↔node/detail) consumed by BOTH read-flatten
  and write-split, so they cannot drift. `detailTableForType(slug)`: flight→transport,
  dining→dining, else bare node.
- The 3 readers (travel-read-journey-admin, travel-get-trip-confirmation, travel-get-trip-programme)
  all read the tree. Guest programme verified live: HRH AMF renders BA269 (LHR→LAX) + all 8
  passengers + dining venues (Mister Nice, China Tang) from the tree.
- Calendar activity read: fixed the journey-vs-engagement filter (elements' parent_engagement_id
  is the CONFIRMED ENGAGEMENT id, not the journey id — resolve journeyId→confirmed_engagement_id
  for the `.in()` filter, group results back by engagement id). Was showing "No itinerary recorded"
  on EVERY trip. Now renders full itineraries; flight detail enriched from transport_detail +
  the airport registry (no aux).

**Write path (transactional RPCs, replace the aux passthrough handlers):**
- 3 SECURITY DEFINER plpgsql functions, each atomic (a function body is one txn — fixes the
  orphan-on-failure + type-change-leak of an app-layer sequential-insert draft):
  - `create_element(p_journey_id uuid, p_patch jsonb) → uuid`: resolves parent
    (journey.confirmed_engagement_id), inserts node (full NOT-NULL spine contract:
    engagement_status_id=confirmed, itinerary_status_id=confirmed, audience=private,
    proposal_visibility=active, is_public=false, iteration_label='element', journey_types='{}'),
    then detail by slug. Free-text→FK resolved in-txn (cabin_class label→id, aircraft_type
    label→id, depart/arrive_airport iata→id). PROVEN live (rolled-back txn: created a flight,
    verify returned cabin_resolved="Business", airport_resolved="DOH").
  - `update_element(p_node_id, p_patch)`: COALESCE keeps existing node values for absent keys;
    on type-change DELETEs mismatched detail + upserts correct (ON CONFLICT node_id).
  - `delete_element(p_node_id)`: DELETE node; detail cascades via node_id FK ON DELETE CASCADE.
- travel-write-journey handleCreate/Update/DeleteAuxBooking now call the RPCs and re-read via
  `fetchOneElementFlat` to return the full flat row (TripDossierSection splices it into state).

**The five-table FK migration (aux was tethered by 5 FKs, all ON DELETE CASCADE except 2 SET NULL
— a naive DROP would have destroyed passengers, drivers, tasks):**
Each tethered table: ADD COLUMN node_id uuid + FK→travel_engagements(id) ON DELETE CASCADE,
backfill via the source_aux_booking_id mapping, repoint code, DROP old aux column.
- travel_engagement_aux_passengers (51 rows) — aux_booking_id → node_id
- travel_aux_driver_details (2 rows) — aux_booking_id → node_id
- travel_tasks (3 linked rows) — aux_booking_id → node_id (nullable; most tasks aren't element-linked)
- travel_journey_day_entries (0 linked) — source_aux_id column dropped (cosmetic)
- travel_engagements.source_aux_booking_id (the mapping itself) — dropped LAST, after all backfills
Backfills all proven clean pre-migration (every linked row mapped to exactly one node, no
multi-node, no orphans).

**The aux_booking_id → node_id API-contract sweep (payload-key honesty, tsc-blind — grep the
callers):** switched the expander + driver-editor + passenger-editor contract from passing the
aux id to passing the node id (which the callers already had as `a.id` / `activity.id` — the flat
rows and calendar activities carry the node id). Touched: CalendarTab (activity_detail body →
node_id; canExpand → activity.is_element; type field source_aux_booking_id → is_element),
queriesAdminJourney (3 mode payloads), both EF handlers (handleActivityDetail /
handleAuxDriverDetails take node id directly, no source_aux_booking_id resolve). The EF calendar
projection now emits `is_element: !a.source_booking_id` (the durable "expandable" flag) instead of
carrying the dropped column.

**Element-selection predicate swap (the one late change to eyeball):** `fetchElementsFlat` filtered
elements by `.not('source_aux_booking_id', 'is', null)`. Column dropped → filter switched to
`.eq('iteration_label', 'element')`. Verified equivalent: all 25 element nodes carry
iteration_label='element' (the create_element/populate contract); the lone non-element child (label
'B') correctly excluded.

**Parity gate (banked, held throughout):** nodes=25, transport=15, dining=5, bare=5, passengers=51,
drivers=2, tasks=3. Tree = source before the drop.

### [PROCESS / LESSONS]
- Supabase editor swallows BEGIN-wrapped multi-statement batches (silent rollback → all-zeros
  verify with no error). Run writes ONE AT A TIME autocommit; `psql -f` for functions. `\gset`/
  `\echo` are psql meta-commands, fail in the editor.
- pre-commit hook enforces the no-else standard — caught an `if(t){}else{}` in enrichElements; guard-clause form (null defaults first, override in `if(t)`) is the fix. The hook is load-bearing.
- Uploaded file snapshots go STALE mid-session — trust tsc errors + live greps over uploads for
  current state (repeatedly bit line-number-based seds; content-targeted seds or editor find/replace
  are safer, and zsh history-expansion breaks `!` in piped seds — hand-edit those in the editor).
- The rendered page is the verification, not tsc/grep (the journey-vs-engagement calendar filter was
  tsc-green while every trip showed "No itinerary").

### STILL OPEN (scoped, non-blocking)
- Type-field honesty (Category Z): TripAuxPassenger/TripAuxDriverDetail `.aux_booking_id` type fields
  + `auxBookingId` variable/prop names still say "aux" but hold node ids — values correct, names stale.
- fetchElementsFlat/fetchOneElementFlat/enrichElements flat-read is a BRIDGE (flattens tree→aux shape
  for cutover); delete when consumers read engagement shape directly.
- engagement.ts:425 — one stale comment still mentions source_aux_booking_id.
- Calendar "Stays" metric (S53I debt, re-confirmed on HRH AMF): flat distinct-hotel count conflates
  properties / principal's stays / room footprint — needs a design decision + EF room-count carry.
- typesImmerse 8→9 shape reconcile (L's border): frontend slug→shape map is 8 shapes; Doc #4 canon is
  9 (Concierge Service split from Arrangement). EF-first.
- Passenger party-primitive migration (passenger_label free-text → global_people) — logged follow-on,
  independent of the retire.

### [ARC][DB+FE] THE NINE — modeled, enforced, rendered (S53Q, same session)

Doc #4 canonizes nine engagement shapes. Verified complete across all three layers:

**Modeled (DB, verified):** `travel_engagement_types` holds exactly 9 `level='shape'` rows —
acquisition, arrangement, concierge_service, dining, experience, journey, reservation, stay,
transport — + 13 `level='element'` rows. Concierge Service is split from Arrangement (both
level='shape'); Doc #4's brokered-vs-ours distinction is real in the registry.

**Spine clean (the retype L scoped — done as a Stage-7 side effect):** L's feared conflation
("20 element-typed top-level engagements") is RESOLVED. Verified live: 14 top-level engagements
(parent_engagement_id IS NULL), ALL 14 are level='shape', 0 element-typed, 0 null-level. The
elements became child nodes when Stage 7 reparented them. The "spine retype" handed to M/Stage 7
is complete — the reparenting did it.

**Enforced (trigger, proven both directions):** `trg_enforce_top_level_shape` (fn
`enforce_top_level_shape`, BEFORE INSERT OR UPDATE, guard-clause form per no-else standard).
Rule: top-level engagements (parent_engagement_id IS NULL) MUST reference a level='shape' type;
children may be any level (an element, or a shape nested in a journey — 6 shape-typed children
exist legitimately). CHECK can't hold the subquery, so it's a trigger (L's scoped design choice).
PROVEN in rolled-back txns: inserting a top-level flight → RAISES 'must be a shape (THE NINE);
got level=element'; inserting a top-level journey → succeeds. NOTE FOR L: this was L's owned
integrity lock; fired this session under D's direct instruction after verifying 0 violators
(Stage 7 cleared them). L: it's live, proven — review the guard form / add any RLS-comment per
your standing convention.

**Rendered (frontend, tsc-verified):** typesImmerse.ts was at 8 shapes; added concierge_service
to the EngagementShape union, ENGAGEMENT_SHAPES array, and SLUG_TO_SHAPE map. Now 9. tsc green —
the Record<EngagementShape,SectionType[]> completeness check passed, so SECTION_REGISTRY handles
the new shape without a gap. (Supersedes the earlier "typesImmerse 8→9 reconcile pending" note.)

**Left deliberately (needs D's call):** SLUG_TO_SHAPE maps `other → arrangement`. `other` is
ambiguous between brokered (arrangement) and ours (concierge_service); left at arrangement as the
safe default, not reclassified without direction.

SUPERSEDES the pre-Stage-7 board items: "THE NINE modeled+enforced (pending)", "spine retype
(handed to M)", "typesImmerse 8→9 reconcile", "enforcement constraint BLOCKED until violators
clear" — all now DONE.

### [SCOPING][honest correction] The flat-read shim — built S53Q, retire WITHIN surface consolidation (NOT standalone)

Correction to my own framing. `fetchElementsFlat` / `fetchOneElementFlat` / `enrichElements`-flatten
were built THIS session (S53Q) as a compatibility shim during the aux-reader cutover: they read the
new node+detail tree and reshape it into the OLD flat aux shape so existing consumers didn't have to
change mid-migration. I flagged it as a "bridge to delete" as if it were external arc work — it is my
own deferred scaffolding, not a discovered legacy violation.

**Is it a violation?** No — not a correctness one. It reads the ONE source (the tree); it is not a
parallel source of truth and is not drift-prone the way the aux TABLE was. It IS a cleanliness debt:
it's shaped as the retired aux contract (booking_type, aux-flavoured fields) rather than a clean
consumer-shaped type — a shim wearing the dead table's clothes. Cleanliness, not correctness.

**Do NOT retire it standalone.** Its heaviest consumer is buildTimeline (_shared/timeline.ts) — the
guest programme's core builder — which is woven through the flat aux vocabulary: `booking_type` is the
type discriminator (hotel/flight/transfer branching, flight detection at line ~390), plus cabin_class /
aircraft_type / origin / destination / passengers / name. The other consumers are the confirmation
`auxBookings` render and the admin dossier/AuxBookingsEditor. ALL of these are inside the
one-engagement-surface consolidation's (Collapse A) blast radius — that campaign rewrites buildTimeline
+ the confirmation render + the section registry to render by stage × shape from the tree.

Retiring the shim now = rewrite buildTimeline to read node+detail, THEN rewrite it again during
consolidation = TWO passes over the guest programme's spine. That is the bandaid the Standards forbid.
The clean move is ONE pass: surface consolidation defines the canonical EngagementElement / timeline-item
shape once, buildTimeline is rewritten once to consume it, and the shim is deleted as part of that work.

**Board reclassification:** "delete flat-read bridge" is NOT independent arc work. It is: retire the
S53Q flat shim WITHIN the one-engagement-surface consolidation (Collapse A), same consumers, one pass.
Do not migrate buildTimeline / confirmation / dossier off the flat shape standalone — you'd touch the
guest surfaces twice.

### [NAMING][arc] "trip must disappear" — guest-facing labels retired (S53Q, same session)

The unified engagement surface (ImmerseEngagementSurface, registry-driven, stage × shape)
was found ALREADY BUILT this session — A3/S53O collapsed ImmerseEngagementPage +
ImmerseDeliveryPage into one surface. So Collapse A (the "one client surface" North Star
piece) is substantially DONE. Remaining arc work is naming discipline ("trip" is a leftover
travel-shaped label that must disappear) + the contained flat shim. Progress this run,
guest-facing labels first (highest visibility):

**Guest EFs renamed (commit 46d30a7):**
- `travel-get-trip-programme` → `travel-get-engagement-programme`
- `travel-get-trip-confirmation` → `travel-get-engagement-confirmation`
Sequence (never a broken state): cp folder to new name → deploy new → repoint the 3 callers
(queriesImmerseDelivery CONFIRMATION_FN/PROGRAMME_FN, ItineraryEditorPage PROGRAMME_FN) →
tsc → deploy → VERIFY LIVE (Alps kF4nP8wRm2x guest programme rendered full: Emirates/flydubai
flights, all passengers + seats + confs, Rosewood Schloss Fuschl rooms) → delete old folders +
delete from Supabase dashboard. Shared-module header comments (engagement.ts/visibility.ts/
names.ts) + the typesImmerse.ts:860 wire comment updated to new names.

**Guest "Trip Brief" → "Engagement Brief" (commit 57231eb):** the last trip-label a guest READS
on the delivery surface. 3 guest-facing sites: tab label (ImmerseDeliveryTabShell brief:),
PDF docType + PDF filename (pdfImmerseBrief). Internal comment refs left for the broader sweep.

**Dead Dest re-export shim removed (commits f56f884, 3153385):** ImmerseDestinationComponents.tsx
was a 15-line re-export shim over the real 415-line ImmerseDestComponents.tsx — NOT a parallel-ship
(no duplication/drift), just a redundant indirection with ZERO real importers (SectionRenderers
already imported the real file; the only ImmerseDestinationComponents refs were comments). Deleted
the shim; fixed stale comment refs in ImmerseEngagementComponents, ImmerseCarouselNav, index.css,
ImmerseDestComponents. tsc green.

**Architecture re-verified this session (live schema, not memory — earlier board was 2 sessions
stale):** the surface consolidation is BUILT — ImmerseEngagementSurface computes (stage, shape),
calls resolveSectionSet, renders proposal=scroll / delivery=tabs, content from SECTION_RENDERERS
(single source). queriesImmerseEngagement is the one orchestrator; queriesImmerseDelivery is its
delivery-half sub-fetch (healthy layering, not parallel-ship). The two old EFs it calls are the
last home of the flat shim (fetchElementsFlat feeds buildTimeline + the confirmation payload) —
shim retires when those EF internals are rewritten, contained to that layer, NOT spread.

**STILL OPEN (naming/cleanliness, none guest-visible):**
- Types still carry trip: TripContact / TripGuides / DeliveryData.
- `Dest` abbreviation (Dest → Destination) if full word wanted — note "destination" is itself
  journey-vocabulary (a destination-within-a-journey).
- Long tail: ~76 structural trip refs, 659 files touching "trip" (much comments/incidental).
- Flat shim: retire within the old programme/confirmation EF internals (contained).

### [DECISION][next campaign] booking_type — element_type honesty + retire vestigial bookings column (decided S53Q, D-ratified, execute next)

Investigated the booking_type field (was slated as a rename slice; turned out to be a modeling
question). LIVE DATA settled it: travel_bookings.booking_type is a text column where ALL 16 rows =
'Hotel' — a frozen constant, not a real discriminator. It is NOT a legitimate parallel use of the
name; it's vestigial. The element type field (flight/dining/transfer, from travel_engagement_types
slug, surfaced via the shim as booking_type) is the ONLY place the field does real discriminating
work.

DECIDED DIRECTION (mission-aligned: name things by what they are; every column earns its place;
no parallel-ship):
1. Elements get an honest type field name: element_type (or category) — NOT booking_type.
2. Retire the vestigial travel_bookings.booking_type column (constant 'Hotel'). "Is this a hotel
   booking" becomes STRUCTURAL (a travel_bookings row with rooms IS a hotel booking), not a
   redundant string check.
3. The 6 discriminators (isHotelElement / isFlightElement / … in typesElements.ts) get rewritten:
   the element ones key on element_type; the isHotelElement-on-bookings checks become structural
   (it's a booking → it's a hotel) or are dropped where they only ever returned true.

WHY NOT DONE THIS SESSION: touches travel_bookings — the money/confirmation/pricing layer (the
confirmation EF selects booking_type, timeline.ts:249/279 filters b.booking_type==='Hotel',
typesBookingFinancial + expenses.ts read it). ~70 booking_type sites across 18 files. A rename of a
live booking-layer column is a staged campaign requiring live-verification of confirmation + pricing
surfaces — deliberately NOT an end-of-session sed. Sequenced as the next dedicated campaign.

UNBLOCKS: the flat-shim retirement (fetchElementsFlat consumers key on booking_type — once the
field is honestly element_type and consumers move, the shim's aux-costume output can be replaced
with a clean EngagementElement shape and fetchElementsFlat/fetchOneElementFlat/enrichElements-flatten
deleted). Do the field decision FIRST, then the shim retires cleanly in the same campaign.

NOTE the two are one campaign: element_type rename + vestigial column retire + shim retirement all
turn on the same field. Do them together, staged, money-layer-verified. NOT piecemeal.

## 2026-07-11 (S53O — DB health + integrity session; runs AFTER S53P Phase 2 cutover)

### [DB] element_status_events built from spec — a documented-but-never-created table

Arc B Phase 3 (2026-06-27 entry) documented element_status_events as a shipped append-only
status-history table. It was NOT created live — only the WRITER shipped (fn_autopromote_on_
confirmation carries INSERT INTO element_status_events). Every status-PROMOTION write (a
confirmation_number first set on a not-yet-confirmed element, across travel_booking_rooms /
travel_bookings / travel_engagement_aux_bookings) hit the phantom table and failed silently,
platform-wide. Invisible until a real promotion fired (a room defaulting to requested getting
a conf number) — already-confirmed elements skip the promote branch, so it never surfaced.

Built from the documented spec (not guessed): (id, element_type, element_id, from_status_id,
to_status_id, changed_by, source, changed_at); polymorphic element_id (no native FK); native
FKs on from/to status; index (element_type, element_id, changed_at DESC); RLS enabled, NO
policies (deny-by-default, service-role-only, matches a_ppd_*). Original trigger works unchanged
once the table exists. Verified live: a real booking (Nicolas, room bc109ddc) inserted clean,
auto-promoted to confirmed, event logged. Phase 3 audit logging functions for the first time.

LESSON: a changelog entry saying "shipped" is NOT proof the live schema matches. Writer (trigger)
and target (table) shipped separately; the gap was invisible to grep (no migrations — schema is
live) and tsc, surfacing only on the promotion path. Cross-check changelog-documented DB objects
against information_schema — proven-necessary "foundation perfect" work.

### [DB] Orphan function dropped — update_travel_immerse_bottom_notes_updated_at  [same event also logged in the S53O consolidated block above — cross-reference, not a second drop]

Referenced travel_immerse_bottom_notes, a table gone since the immerse→overlay rename. No
trigger used it (verified). Flagged db_map v10 §4; closed. The INVERSE of element_status_events:
there a live trigger referenced a never-built table (→ built it); here a live function referenced
a long-dead table (→ dropped it). Two schema-truth lies, opposite directions, both surfaced by
rename-as-audit.

### [DB] 5 set_updated_at triggers renamed off travel_trip_* — set_updated_at trigger tokens closed  [CORRECTED S53R: NOT the last — 7 index/constraint tokens remain, see debts D12]

Trigger NAMES carried travel_trip_* tokens on renamed tables (they fire correctly — name is a
label). Renamed to match their tables: trg_set_updated_at_travel_trip_{aux_bookings,briefs,
day_entries,days,destinations} → _travel_engagement_aux_bookings / _travel_journey_{briefs,
day_entries,days,destinations}. The LAST travel_trip_* token on any DB object — tables, functions,
triggers now all consistent. DEBT (own session): set_updated_at trigger naming is inconsistent
platform-wide (4 different patterns) — a normalization pass, cosmetic, unrelated to the rename arc.

### [DB] Guest visibility untangled from lifecycle status — tg_auto_public_view DROPPED

tg_auto_public_view (fired tg_engagements_public_view on travel_engagements) auto-set public_view
from status on EVERY status change (true for confirmed/paid/in_service, false otherwise). This
FUSED two independent concerns — lifecycle vs guest-visibility — a privacy risk + parallel-ship:
an admin manually hiding a confirmed engagement got SILENTLY RE-EXPOSED on the next status write
(two sources of truth, trigger wins). Conflicted with the manual visibility control + the "only 3
public" debt.

Mission fix (separate concerns, single source, privacy-first): DROPPED trigger + function.
public_view is now SOLELY the deliberate admin control (set_public_view → handleSetPublicView).
Status no longer touches visibility. proposal_visibility (separate column) unaffected. Existing
values preserved (4 public / 9 hidden; DROP stops future auto-writes only). BEHAVIOR SHIFT
(intended): confirmed trips no longer auto-appear — the "only 3 public" rule now HOLDS.

### [STANDARD] no-else sweep across all pg_proc — classified, not blanket-rewritten

D's standard (NEVER else/else-if; guard clauses + early returns) applied to DB functions. Swept
for else tokens: 4 carried them.
- tg_auto_public_view — DROPPED (visibility untangle above); moot.
- derive_tasks_for_engagement — two CASE...ELSE NULL (redundant defaults; CASE returns NULL
  anyway). To fix when next CREATE OR REPLACE'd. NOT folded into S53P (that shipped before this).
- user_suffix — CASE...ELSE 0 in a hex→int hash. DEFERRED: rewrite risks changing existing
  user-facing suffix output; ELSE 0 never fires (input is TO_HEX output). Own careful task.
- tg_sync_trader_current_balance — ambience.SPORTS financial, control-flow IF/ELSE on TG_OP.
  NOT TOUCHED: out of the travel arc's audited domain. Logged for the SPORTS owner.
PRINCIPLE: "the standard says fix it" is not license to rewrite live financial code in an
un-audited domain. Fix what's understood + provably safe; log the rest.

### [DB] In-schema documentation — COMMENT ON the load-bearing core

Made the schema self-documenting for multi-instance work (changelog is narrative; comments are
ground-truth breadcrumbs in pg_proc/pg_class). Every campaign-touched FUNCTION + the load-bearing
core TABLES now carry COMMENT ON:
- Functions: clone_engagement (behavior + remap FKs + KNOWN bedding_type-drop bug + sort_order
  remap constraint), derive_tasks_for_engagement, tg_derive_child_activities,
  fn_autopromote_on_confirmation (the element_status_events history note),
  resolve_and_project_guest_label, recompute_booking_totals (the S53K "DO NOT re-add commission
  writes" warning — the most protective comment in the schema), check_closed_won_commission,
  tg_project_guest_label_on_engagement, enforce_engagement_label_house_match.
- Tables: travel_engagements (THE SPINE — service-agnostic, engagement_type, capability model),
  travel_journey (the journey capability, was travel_trips), travel_bookings + travel_booking_rooms
  (financial core, with inline bug-history: double-count, receipt-anchored commission, deposit=
  awareness-not-receivable), travel_engagement_aux_bookings (Stage-7 element target),
  travel_engagement_types (the 21-shape / 3-pillar taxonomy).
Deliberately LEFT uncommented (restraint, per this changelog's own rule): registries, sports_*
(separate domain), walled PII prefixes, set_updated_at family — self-evident, a comment = noise.

### [DEBT] clone_engagement drops bedding_type on room clone (STANDALONE, S53P did not fold it)

clone_engagement's travel_overlay_rooms INSERT omits bedding_type (column added S53K, post-dating
the function) — every clone silently loses room bedding types. S53P Phase 2 shipped the trip_id→
journey_id cutover WITHOUT folding this in, so it's a standalone open debt (not "fold into Phase
2" as earlier scoped). One-line fix: add bedding_type + r.bedding_type to the room INSERT, next
time the function is CREATE OR REPLACE'd. Noted in the function's COMMENT ON. (Yazeed v3 built by
clone — verify its rooms carry bedding_type; may need manual backfill.)

### [DEBT] Guest-read reliability — silent ?? [] must fail loud (P1, handed to counterpart)

Guest-read EFs use result ?? [] on Promise.all sub-fetches → a transiently FAILED fetch (cold-
start timeout, blip) becomes an empty array → guest sees "Nothing planned today" on a real day.
Same silent-empty CLASS as the leaf-column/flight/hero bugs. LOCK: guest reads fail loud (500),
never silent-empty; [] must mean "genuinely nothing". Strengthens the one-EF-three-modes read-
path consolidation. Handed to counterpart with the read-path work.

### [PROCESS] Session character — rename-as-audit earned its keep, changelog-first corrected course twice

This session opened chasing a single blocked confirmation write and became a foundation-integrity
pass. The rename campaign functioned as a full-platform audit: surfaced + fixed FOUR latent bugs
across the arc (stale PostgREST hint 5b, public_view spine bug Phase 1, this element_status_events
phantom-table, the orphan function), completed one half-shipped feature, removed one privacy
tangle, swept a standard, documented the core. TWICE the changelog corrected a wrong conclusion
mid-session: (1) the trigger bug looked like an orphan to DROP but the changelog proved a real
half-shipped feature to BUILD; (2) Phase 2's DB cutover looked pending but the changelog showed
it already SHIPPED (S53P) — nearly re-did done work. Reaffirms: read the changelog FIRST; live
schema is the only truth; verify against information_schema, not memory.

### [DB/FIXED] clone_engagement bedding_type restored — was silently dropped on every clone

clone_engagement's travel_overlay_rooms INSERT omitted bedding_type (column added S53K,
post-dated the function) — every cloned engagement silently lost room bedding types. FIXED
S53O: bedding_type + r.bedding_type added to the room INSERT (column list + VALUES), nothing
else changed. COMMENT ON updated. Verified live (pg_get_functiondef ~ 'r\.bedding_type' = true).

No backfill needed: checked Yazeed v3 (oQC68jVKgcm) — all 55 rooms had bedding_type NULL AND
bed_config_override NULL, i.e. the SOURCE never had bedding set, so the clone dropped nothing
that existed. The bug was real (would lose data if the source had it) but no data was actually
lost. Discipline note: verified against the data before assuming a backfill — no phantom restore
on values that were never there.

### [DEV STANDARDS / GOTCHA] Re-creating a function from pg_get_functiondef: terminate $function$

pg_get_functiondef() returns a function definition WITHOUT a trailing semicolon after the
closing $function$ delimiter. When round-tripping (edit the dump, CREATE OR REPLACE it), if any
statement FOLLOWS it (e.g. COMMENT ON, or wrapped in BEGIN/COMMIT), the parser stays inside the
function body and throws `42601 syntax error at or near "<next keyword>"` — which rolls back the
WHOLE block. Symptom: the CREATE OR REPLACE appears to run but does not take (verify query returns
false) with no obvious error if the rollback is silent.

FIX: add ';' after the closing $function$ before any following statement. This bit twice on the
clone_engagement fix (two "successful" runs that didn't persist) before the error surfaced.
Add to the batch-edit checklist alongside the ZSH/bracketed-paste note: for functions, run via
`psql -f file.sql` (file-based, no paste truncation, prints the real error+line) rather than
pasting large bodies into the SQL editor.

# S53O — trip_id → journey_id function repoint + verification note

## What was wrong
S53P renamed base-table columns `trip_id → journey_id` (travel_bookings, travel_requests,
travel_engagements) but did NOT repoint the 3 DB functions that referenced the `trip_id` column.
All 3 were silently broken from S53P until fixed S53O. No user hit them in the window
(verified: zero engagements created/status-changed since S53P — "no rows returned").

## What changed (S53O)

### 1. derive_tasks_for_engagement(uuid)  [SECURITY DEFINER, RETURNS void]
- `SELECT trip_id ...` → `SELECT journey_id ...` (from travel_engagements)
- `WHERE b.trip_id = ...` → `WHERE b.journey_id = ...` (travel_bookings)
- local `v_trip_id` → `v_journey_id` (all refs)
- aux loop kept `a.engagement_id = v_journey_id` (engagement_id is the SPINE pointer — correct, unchanged)
- removed two `CASE ... ELSE NULL` (redundant defaults; a CASE with no matching WHEN returns NULL) — no-else standard
- COMMENT ON updated

### 2. tg_derive_child_activities()  [SECURITY DEFINER, trigger fn]
- `NEW.trip_id` → `NEW.journey_id` (single ref)
- fires as trigger `tg_engagements_derive_children` on travel_engagements (AFTER UPDATE OF status)
- calls derive_tasks_for_engagement(NEW.id)
- COMMENT ON updated

### 3. clone_engagement(uuid, text, text)  [RETURNS uuid]
- spine INSERT column list: `... iteration_label, trip_id, person_id ...` → `journey_id`
- spine SELECT: same position → `journey_id`
- (earlier S53O) bedding_type restored to the travel_overlay_rooms INSERT (col list + VALUES)
- `trip_destination_row_id` on travel_overlay_destination_pricing_rows LEFT AS-IS — it is a
  DIFFERENT column, not a trip_id ref (a separate future rename question)
- COMMENT ON updated

## Process notes for future instances
- `pg_get_functiondef` output has NO trailing `;` after the closing `$function$`. When re-creating,
  add `$function$;` or any following statement (COMMENT ON, COMMIT) throws 42601 and rolls back the
  whole block. Symptom: "ran successfully" but change didn't persist (verify returns false).
- Run function replaces via `psql -f file.sql` (file-based, no paste truncation, prints real error+line),
  not by pasting large bodies into the SQL editor.

## HOW TO VERIFY THESE 3 FUNCTIONS STILL WORK (future instance checklist)

### A. Static — no stale trip_id column ref remains (fast, run anytime)
```sql
select proname, pg_get_functiondef(oid) ~ '\mtrip_id\M' as still_has_trip_id_col
from pg_proc
where proname in ('clone_engagement','derive_tasks_for_engagement','tg_derive_child_activities')
order by proname;
-- EXPECT: all three still_has_trip_id_col = false
-- (clone shows false because trip_destination_row_id is NOT a \mtrip_id\M word-boundary match)
```

### B. Static — no else token (derive_tasks)
```sql
select pg_get_functiondef('derive_tasks_for_engagement'::regproc) ~* '\melse\M' as has_else;
-- EXPECT: false
```

### C. Live — clone_engagement round-trips a whole engagement (write-path proof)
Pick any existing engagement id as source. Run in a transaction you ROLL BACK so it leaves no trace:
```sql
BEGIN;
  SELECT clone_engagement(
    (select id from travel_engagements where url_id = 'oQC68jVKgcm'),  -- any real source
    'verify-clone-temp-' || substr(gen_random_uuid()::text,1,8),
    'verify clone'
  ) AS new_id \gset
  -- confirm the clone exists with journey_id copied + children present
  select id, journey_id, engagement_status_id from travel_engagements where id = :'new_id';
  select count(*) as rooms      from travel_overlay_rooms                     where engagement_id = :'new_id';
  select count(*) as dest_rows  from travel_overlay_engagement_destination_rows where engagement_id = :'new_id';
  -- confirm bedding_type carried (if source rooms have it set)
  select count(*) filter (where bedding_type is not null) as rooms_with_bedding
  from travel_overlay_rooms where engagement_id = :'new_id';
ROLLBACK;
-- EXPECT: the SELECT after clone returns 1 row with a non-null journey_id, child counts > 0,
--         no error. (If clone_engagement raised, it would abort here.) ROLLBACK discards the test.
```

### D. Live — derive_tasks + trigger fire on a status change (write-path proof)
The trigger (tg_engagements_derive_children) fires on status change to confirmed/paid/in_service.
Test in a rolled-back transaction so nothing persists:
```sql
BEGIN;
  -- pick a top-level engagement (parent NULL, journey_id set) currently NOT confirmed
  -- set it to confirmed; the trigger should PERFORM derive_tasks_for_engagement with no error
  UPDATE travel_engagements
  SET engagement_status_id = (select id from travel_lifecycle_statuses where slug='confirmed')
  WHERE id = '<a top-level engagement id, parent_engagement_id IS NULL, journey_id NOT NULL>'
  RETURNING id, journey_id, engagement_status_id;
  -- if it returns without error, the trigger + derive_tasks ran clean.
  -- optionally inspect what got derived:
  select count(*) as child_engagements from travel_engagements where parent_engagement_id = '<same id>';
  select count(*) as tasks from travel_tasks where engagement_id = '<same id>';
ROLLBACK;
-- EXPECT: UPDATE returns without "column trip_id does not exist" or any error.
--         Pre-S53O this raised; post-fix it succeeds. ROLLBACK discards.
```

### Interpreting results
- A + B green = the static repoint + no-else are intact.
- C + D running WITHOUT error = the write paths (clone, derive-on-confirm) work end to end.
  These are the paths S53P left broken; a raised "column trip_id does not exist" would mean a
  regression returned. Always test C/D inside BEGIN/ROLLBACK so verification leaves no data.

## 2026-07-11 (S53P — Stage 6 Phase 2 Step 2: journey EF+frontend rename · COMPLETE)

### travel-write-trip / travel-read-trip-admin -> travel-write-journey / travel-read-journey-admin

The journey capability's read+write path renamed top to bottom, verified live, old EFs deleted.
"Trip" as a general label is gone from the read/write path — survives only as trip_code/trip_type
columns and the travel_journey table (journey, not trip).

**Motion (safe-cutover shape, mirrors the compat-view drop):**
1. Step 1 — set_public_view duplicate retired to travel-write-engagement/set_visibility (spine
   concern, not journey). Dead mode+handler removed. File became pure journey.
2. 2a — cp'd both EFs to new journey names, deployed BESIDE old (both live, no break).
3. 2b — frontend rename: git mv queriesAdminTrip->queriesAdminJourney; word-boundary sed for
   Trip*->Journey* types+fns across src/; EF invoke targets, helpers (invokeWriteTrip->
   invokeWriteJourney), payload keys (trip_id->journey_id), tripId locals repointed. Includes
   the _shared/timeline.ts EF-to-EF invoke (the 5th reference class — EF calling EF by string).
4. Verified live: HouseTab dossier (HRH AMF, 3 hotels, 6 rooms, $18,479.83 commission), brief,
   rooms, calendar (multi-week, HRH AMF + Alps spanning July). Money intact, surfaces render.
5. 2d — deleted old travel-write-trip + travel-read-trip-admin EFs (grep-empty gate first),
   git rm'd dirs, final grep-empty confirmed.

**Two bugs surfaced + fixed during the rename (rename-as-free-audit pattern):**
- The transition shim added in 2a was CORRUPTED by the trip_id->journey_id sed into
  `if (body.journey_id && !body.journey_id) body.journey_id = body.journey_id.catch(...)` —
  malformed dead code. DELETED both shims: unnecessary anyway (handlers read journey_id
  natively post-sed; frontend sends journey_id; no translation needed).
- auxJourneyIds dead var in handleCalendar — declared (confirmed_engagement_id set) but the
  activities query uses journeyIds (trip ids) in guard + .in(). Dead BEFORE the rename; F2
  surfaced it. Removed (matches current behavior). LATENT QUESTION LOGGED: should calendar
  activities filter parent_engagement_id by engagement ids not trip ids? Behavior-changing,
  not touched — separate investigation.

**6TH lesson banked — zsh/VS Code terminal is hostile to pasted multi-line scripts:** `!`
history-expansion AND bracketed-paste mangling defeat set +H / unsetopt banghist. RELIABLE
PATH: author edits as (a) per-file find/replace in the editor, (b) single-line piped seds run
one at a time, or (c) a script SAVED via editor tab then `bash file.sh`. NEVER paste a
multi-line script body into the terminal. Cost real time this session before the pattern held.

### STILL OPEN in the broader Phase 2 / boundary sweep:
- travel-write-journey STILL CONTAINS the hosted programme-guest + request modes (D ruled
  home/stay is its own branch). travel-read-journey-admin ALSO contains programme_guests,
  programme_guest_search, requests modes. These are HOME/HOSTED branch concerns living in the
  journey EF — must extract to a hosted writer/reader (travel-write-programme-admin exists;
  requests have no home EF yet). Logged debt. NOT this session.
- Category Z type-field honesty in src/ largely done via the Trip*->Journey* sweep; sweep the
  _shared/days.ts trip_id type field + object key (line 15/64) separately if not caught.

  ---

## 2026-07-11 (S53P — engagement list re-link · Section-C seam closed for the engagement surface)

### travel-read-engagement-admin output key trip_id -> journey_id

Immediately after Step 2, admin showed ALL engagements unlinked (every engagement fell into
the orphan group, none grouped under its journey). Diagnosed WITHOUT touching data first — a
join query proved every travel_engagements.journey_id was populated and matched travel_journey,
FK intact, embed-hint constraint name correct. The data was never broken.

ROOT CAUSE — the Section-C seam, half-crossed. The Step-2 frontend rename swept
queriesAdminEngagements + EngagementsListTab to read row.journey_id (grouping key). But
travel-read-engagement-admin's OUTPUT object still emitted the key as trip_id: r.journey_id
(output keys deliberately left as trip_id, per the 07-10 "Section C deferred" note). So the
frontend read row.journey_id -> undefined -> every row hit `if (row.journey_id == null)` ->
all orphaned. Rendered "all unlinked."

FIX (one line, finishing the seam honestly): output key trip_id -> journey_id in the list
mapping. trip_code stays as the frontend key mapping r.trip?.journey_code (trip_code is the
frontend's display field, journey_code the DB column — correct translation, unchanged).
Deployed travel-read-engagement-admin. Engagements re-link.

CLEANUP: removed duplicate src/queries/queriesAdminTrip.ts — a byte-identical leftover the
Step-2 git mv left behind (or an editor restored post-commit). grep confirmed ZERO importers
before git rm. Parallel-ship eliminated.

CORRECTS the 07-10 entry's "EF outputs still emit trip_id... ALL WORKING" — that was true when
written, but the engagement list was NOT working once the frontend expected journey_id. This
entry closes the output-key seam for the ENGAGEMENT-LIST surface specifically. Other EF
outputs still emit trip_id where their frontends still read trip_id (those ARE working); the
remaining honest-per-meaning output sweep is still the deferred Section-C tail.

LESSON (reinforces rename-as-free-audit): a deliberately-deferred contract seam WILL surface
as a live break the moment one side of it is renamed past the other. When deferring an output
key, grep the consumers first — if any consumer was swept to the new key, the seam is already
crossed and must be finished, not deferred.

### [DEBT · ARCHITECTURE] destination_url_slug is a denormalized string-FK — rooms/cards should link to the destination row by uuid, not by matching a copied slug string

**Surfaced by a "why does this work this way" probe (S53O), not a bug report.** Verifying the
S53L "ghost constraint" debt (which turned out already-resolved) led to the question: why do
multiple rooms share a destination_url_slug? The answer exposed real architectural debt.

**Current shape (works, but wrong):**
travel_overlay_rooms and travel_overlay_engagement_content_card_selections group under a
destination subpage by MATCHING (engagement_id, destination_url_slug string) against
travel_overlay_engagement_destination_rows — NOT by an FK to destination_rows.id. The slug
string is COPIED onto every room option (sb = 3 St Barths options, grossarl2 = 2, etc.). It
renders correctly; data is currently consistent. It is latent debt, not a live break.

**Why it fails the mission — measured against Universal Doc #4 STANDARDS:**

- "Pristine code. No bandaids. No shortcuts. The architecture is the foundation; the foundation
  has to be perfect." A subpage's identity (its slug) lives in TWO places: once authoritatively
  on the destination row, and again as a copied string on every room/card that belongs to it.
  That is the data-layer form of the parallel-ship this codebase already forbids in logic
  ("when a value appears in 2+ places, extract to ONE source; drift is eliminated structurally,
  not by discipline"). A slug is a value; it is currently NOT single-source. Rename a
  destination's slug and every room/card copy is silently stale until each is hand-updated in
  lockstep. That is drift-by-design — the opposite of a perfect foundation.

- "One URL, one experience. No fragmentation." The subpage URL is the spine of the guest
  experience, and its identity is fragmented across the room/card rows that should merely POINT
  at it. The URL should resolve from ONE authored place (the destination row); rooms should
  inherit it, not restate it.

- THE BAR ("would a senior designer recognize craft?"): a string-matched join standing in for a
  uuid foreign key — with a CHECK regex existing precisely BECAUSE the value is a raw
  hand-consistent string rather than a referential id — is the kind of shortcut a senior
  reviewer flags on sight. No FK constraint can protect it: nothing prevents a room carrying a
  slug that no destination row owns.

**Concrete downstream cost already visible:** clone_engagement remaps route_stops.destination_row_id
and rooms.connected_overlay_id BY ID (proper FK remap via the temp id-maps) but carries
destination_url_slug as a LITERAL STRING COPY — the clone works only because the copied slug
happens to still match. Had rooms/cards a real destination_row_id FK, the clone would remap it
cleanly like the others; the string slug is why that part of the clone is fragile.

**Proper fix (own session — foundational, not a side-quest):**
1. Add destination_row_id uuid FK on travel_overlay_rooms + _content_card_selections →
   travel_overlay_engagement_destination_rows(id).
2. Backfill it by the current (engagement_id, slug) match.
3. Repoint the render path (subpage room-grouping) + every query that joins on slug to join on
   the FK; derive the slug THROUGH the relationship.
4. clone_engagement: remap the new destination_row_id via the existing _clone_dest_row_map
   (drops the fragile string-carry).
5. Once all callers read through the FK, DROP the denormalized destination_url_slug from
   rooms/cards (keep it ONLY on destination_rows, its single authoritative home) + drop the two
   now-unneeded format CHECKs there.
Touches: guest render (subpage grouping), clone, and the join-by-slug queries. Guest + money
surfaces in scope → stage + verify live, never a broken state. Own campaign with its own recon.

**Correct as-is (do NOT change):** the format CHECK + UNIQUE(engagement_id, slug) on
destination_rows itself — that table legitimately OWNS the slug and its uniqueness. The debt is
only the COPIES on rooms/cards and the string-join they force.

## 2026-07-11 (S53O — final honesty close: _shared/days.ts + ghost-constraint verify)

### [DONE] _shared/days.ts TripDayItem → JourneyDayItem, trip_id field → journey_id

The last flagged trip-name in the shared layer, closed. Listed as open Category-Z debt in
several prior entries (TripDayItem.trip_id, days.ts:15/64) — now actually done. Self-contained:
grep confirmed NO consumer reads .trip_id off buildDays' output (the field is populated but
unread), so the rename is honesty-only, zero behavior change, zero ripple. Renamed: type
TripDayItem → JourneyDayItem (lines 13/51), field trip_id → journey_id (15), object key (64,
value was already journeyId post-S53P), the header comment. tsc green; grep for trip-token in
days.ts now empty. Redeployed the 3 bundling EFs (travel-get-trip-confirmation,
travel-get-trip-programme, travel-read-journey-admin) per the _shared-bundling rule (a shared-
module edit isn't live until every importer redeploys). NOTE (logged, not chased): buildDays'
journey_id field is populated but unread by any consumer — a candidate dead field, worth a
"is this needed" check someday.

### [VERIFIED CLOSED] S53L "ghost constraint" debt was stale — verify-first prevented a wrong fix

The S53L debt ("destination_url_slug constraints landed on ghost travel_immerse_* names, redo
on real tables") was VERIFIED RESOLVED, no DDL needed. Current live state is correct: format
CHECK (slug IS NULL OR ^[a-z0-9]+$) on all 3 real tables that have the column
(travel_overlay_engagement_destination_rows / _content_card_selections / travel_overlay_rooms);
UNIQUE(engagement_id, destination_url_slug) WHERE NOT NULL correctly scoped to destination_rows
only (the subpage-URL owner); no travel_immerse_* ghost tables exist. CRITICAL: the debt said
"redo the constraints" — but verify-first showed the constraints were already correct, and a
naive redo adding uniqueness to rooms would have BROKEN valid shared-slug rooms (rooms
legitimately share a slug: sb×3 = 3 St Barths options on one subpage). Verify-first before DDL
stopped us fixing a non-problem into a bug. (This probe is also what surfaced the separate
destination_url_slug denormalization debt logged above.)
EOF
Output


========================================================================
PASTE THIS AT THE END OF CHANGELOG.md:
========================================================================

## 2026-07-11 (S53Q — Stage 7 DB layer: the engagement tree, built + populated)

### [DB][ARC] Stage 7 Phase 1 — typed engagement tree created + populated from aux (readers pending)

The typed engagement-tree model's DB layer. travel_engagements is now a typed tree:
every element is a node (engagement_type_id + parent_engagement_id), standalone-vs-child
is only whether parent_engagement_id is null. Element detail is the leaf node's payload
in 1:1 detail tables keyed on the NODE id. Live Supabase — invisible to git; this is the
record. NOT "rename aux -> elements": aux stays as the live source until the readers move
(next session). Greenfield — the tree columns were dormant scaffolding (row counts proved
empty: nodes_from_aux=0 pre-run), so this is population, not a shadow-collapse migration.

5 tables created (all RLS + constraints + COMMENT ON):
- travel_cabin_classes / travel_aircraft_types / travel_airports — reference registries.
  RLS public-read / admin-write (labels non-sensitive; closes the "RLS not enabled"
  advisor finding — registries got RLS-decided at creation, the new standing rule).
  Seeded 4 / 4 / 11. Registry values auto-mapped from the former aux free-text columns
  (cabin_class, aircraft_type, depart/arrive_airport) — all live values matched a seed
  row, zero unmapped.
- travel_engagement_transport_detail / travel_engagement_dining_detail — 1:1 element
  detail, node_id PK REFERENCES travel_engagements(id) ON DELETE CASCADE. Keyed on the
  NODE, NOT engagement_id (engagement_id on aux points at travel_journey = the Stage-1
  drift; node-keyed avoids re-introducing it). RLS admin-only, mirrors the aux posture
  (Admin full access, ALL, authenticated, is_admin_user()) — NO public read; guests reach
  detail via guest EFs (service role), same wall as aux.

Population — 25 element nodes on travel_engagements, one per aux row:
- Parent = travel_journey.confirmed_engagement_id (via aux.engagement_id -> journey ->
  confirmed). Correct on the clone lineage (fcdcec92 has 3 spine engagements; parent
  resolves to the confirmed winner 5857d344, NOT the arbitrary min()). 1:1 on the other 3
  journeys. Pre-flight proved: all 25 resolve exactly one parent, 0 missing, 0 bad.
- Type split: 15 flight -> transport detail, 5 dining -> dining detail, 5 (airport_transfer
  + meet_greet) -> BARE NODES (no detail table; all their data is node-level). Building
  empty detail tables for the bare types would be dead scaffolding (the seat_type restraint,
  applied to whole tables).
- NOT-NULL contract on the spine satisfied: engagement_status_id <- aux.status_id (1:1, all
  25 populated); itinerary_status_id = 'confirmed' (element line = confirmed itinerary,
  node-only concept, flagged decision — could later derive from parent); audience=private,
  proposal_visibility=active, is_public=false (element inherits exposure via parent + guest
  EF, never independently public); iteration_label='element', journey_types='{}'.

Element free-text placed on the DETAIL tables, NOT the node — corrected against live schema:
travel_engagements has no origin/destination/notes/booked_by columns (it's a proposal/
presentation table), so element text lives on detail. Two data traps caught in recon:
(1) origin/destination are the complete route (15/15 flights) while airport codes are sparse
(5/15) — normalizing only codes + dropping origin/destination would have lost the route on
10 flights; both kept, airport FKs are nullable overlay. (2) airline_name is the ONLY airline
signal (airline_supplier_id 0/25) — not dropped as "legacy". travel_seat_types NOT created
(0/25 rows carry seat_type — proven on data).

VERIFY (banked as the aux-retire parity gate): nodes=25, transport=15, dining=5, bare=5,
missing_parent=0, flights_missing_route=0, airline_preserved=1, cabin=5, aircraft=7,
depart=5, arrive=5. Before aux is dropped, the tree must still prove these or a reader
rewire silently lost data.

STATE: data lives in BOTH aux (untouched live source) and the tree (built, dormant, read by
nothing). Safe intended in-between. No guest or money surface touched.

### NEXT — Stage 7 Phase 2 (readers, own session, recon-first)
Rewire the 8 aux readers (typesAuxBookings, TripDossierSection, AuxPassengersEditor, both
guest EFs, travel-read-journey-admin, _shared/trip.ts, travel-write-journey) to read node +
detail; dining venue via the existing enrichment (no parallel-ship). Resolve the calendar
filter (parent_engagement_id journey-vs-engagement ids — now live, behavior-changing). Retire
aux LAST (grep-empty + row-parity gate against the banked numbers; drop dead seat_type with it).
Party-primitive migration for dining guest_name (global_people) is a logged follow-on.

### [PROCESS] Supabase editor swallows BEGIN-wrapped multi-statement batches
The population BEGIN...INSERT...verify batch rolled back silently in the SQL editor — surfaced
as an all-zeros verify with NO error. Root: the editor's own transaction handling fought the
explicit BEGIN. Fix: run write statements ONE AT A TIME under autocommit, verify separately.
Do NOT wrap population in BEGIN/COMMIT in the editor. Stronger form of the existing "editor
returns only the last result set" rule. Also reaffirmed: \echo / psql meta-commands fail in
the editor (strip to SQL comments); every new PostgREST-exposed table gets an explicit RLS
decision at creation, reference tables included (the registry advisor finding).

# S53N Session Log — Property arm: security fix + Property Spine spec (parallel to M's Collapse A)

**Date:** 05 Jul 2026 · repo `ambiencelife22/a.t` on `main` · Supabase `rjobcbpnhymuczjhqzmh`
**Lane:** Property/hosted-guest arm + DB entity reconciliation. Ran PARALLEL to M (Collapse A6–A8 + token spine). Zero lane collisions — confirmed throughout.

---

## SHIPPED + VERIFIED THIS SESSION

### DB entity reconciliation (Engagement Spine spec, phases 0–1)
- **Phase 0** — dropped `s53k_tasks_pre_dismissed`. Correction: spec called it "session scratch"; live read proved it was a 31-row 1:1 backup of `travel_tasks` holding live-engagement task data (Austria, Yazeed). Fully superseded (all 31 IDs present in `travel_tasks`), zero code refs. Snapshot preserved. Verified gone via `pg_class`.
- **Phase 1** — dropped `clients` P0 privacy table (unwalled `passport_number`/`date_of_birth` in public). Correction: spec called it a "pure drop"; live `pg_constraint` showed 2 inbound FKs (`travel_programme_master`, `travel_programme_guests`). Repointed both `client_id` FKs → `global_people` (D-ratified), THEN dropped. `a_ppd_*` KV pattern already covers the sensitive fields (no schema gap). Verified: `clients` gone, both FKs → `global_people`, zero → `clients`.
- **`travel-read-ops-admin`** — verified fully removed (repo + `supabase functions list` + explicit delete confirm). Handover claim held; no action needed.

### Guest-portal credential leak — CLOSED + VERIFIED (the session's main build)
The stay portal (`ProgrammeRoute.tsx`) read `travel_programme_*` tables DIRECTLY from the browser and delivered the FULL payload — alarm codes, wifi password (`Romeu2026`), real address, gated phones — to un-logged-in guests, hiding them only in React render. Secrets sat in the network response regardless. A live privacy hole (physical-property access credentials).

**Fix (pushed to main):**
- New Class B EF `travel-get-stay` (2 modes: `resolve`, `my_stays`). Redacts credential-bearing content SERVER-SIDE on the anon/gated path: Alarm / Arrival / Entry & Keys sections + wifi blocks stripped unless the matching `public_*` flag reveals them; owner/manager phones + maps URLs gated likewise. Authenticated sessions → full access unchanged.
- Honors `_shared/auth.ts` + `_shared/client.ts` security contracts: NO hand-rolled anon client (that construction is private to auth.ts by design); service client built only after caller established (verified user OR anon-viewing-public). First draft violated this; corrected after reading the actual `_shared` files.
- Layering corrected to `EF → types → queries → front`: `ProgrammeRoute` calls the queries layer only (`getStayByUrlId` / `getMyStaysRaw`); `queriesProgramme` owns EF invocation + mapping; `StayResult` discriminated union surfaces EF error codes as typed outcomes. First draft had the component invoking the EF directly — corrected on D's catch.
- **Verified:** anon resolve of `casa-romeu-preview` returns no secrets (`grep` for `Romeu2026`/`Romeu de Corbera` → CLEAN). tsc clean.
- **OUTSTANDING check:** authenticated path (logged-in guest still sees wifi/alarm) — verify manually post-Vercel-deploy. Expected fine (`!gated` skips redaction) but not yet confirmed.

### Designed (design-only, no execution)
- **Property Spine spec** (`ambience_travel_property_spine_spec_05Jul26.pdf`) — full replacement/superset for the April Programme handover. The hosted-guest counterpart to the Engagement Spine spec. Entity model `property → stay → access package`; `travel_property` w/ `management_type` (owned|managed|partner — ambience may manage third-party homes, not just own); in-stay concierge/lifestyle services reference the UNIVERSAL `travel_engagement_types` registry (not local enums); two-tier walled portal; 3-stage rename (DB+EF → types/queries → frontend). Hybrid listing-vs-booking seam (curated listings = local content; actioned bookings = spawned engagements) — mission-led, D-ratified.

---

## RECONCILIATION WITH M'S S53M (Collapse A) — READ THIS

M and I converged on the SAME P0 from two directions:
- **M's logged follow-up #4** = EF-compliance audit: ~15 files make direct `.from()` bypassing EFs. Names `queriesProgramme` + `ProgrammeAdmin` as violators.
- **My session** = closed the guest-read half of exactly that violation on the programme surface.

**Updates to M's EF-compliance debt list:**
- `queriesProgramme` — guest-read path now EF-routed (`travel-get-stay`). REMOVE from violator list for the guest surface. (Profile/ticket/login functions still read `global_*` direct — those remain, separate concern.)
- `ProgrammeAdmin:1338` (`global_profiles`) — STILL a live violation. My fix closed only the GUEST read path; the ADMIN side still reads tables direct. Programme surface is now HALF-compliant.
- The EF-compliance arc M scoped and I started should be unified: my `travel-get-stay` is its first executed slice. The audit doc M proposed (`ambience_travel_ef_compliance_debt_[date].md`) should note the programme guest-read as DONE.

**Naming reconciliation (consistent, logged so it doesn't drift):**
- M ratified `immerse` = brand prefix, retained (client-surface: `ImmerseDeliveryPage`, `DeliveryData`).
- My spec: `programme → stay/property`, `immerse` survives as brand only.
- CONSISTENT: M's `immerse` = design-client delivery surface; my `stay/property` = hosted-guest surface. Both keep `immerse` as essence. No collision.
- **TWO SPINES, one platform, sharing `global_people` + `a_ppd_*`:**
  - ENGAGEMENT spine (M's model): `client → engagement → journey → overlay → delivery`. ambience DESIGNS for a client.
  - PROPERTY spine (my spec): `property → stay → access package`. ambience HOSTS a guest.
  - Do NOT force the property work into the engagement model. They meet at: shared `global_people`, shared `travel_engagement_types` registry, shared `travel_suppliers` (post-reconcile).

**M's "Client = identity only" law — ADOPT.** M ratified: "client" = the person/party (identity); bookings/confirmations/accom/delivery are engagement/delivery data, NOT client data. This applies to the property spine too: `travel_stay_guest.person_id → global_people` is IDENTITY; the stay/access-package is delivery-class. Honors the same law.

---

## LOGGED FOLLOW-UPS (property arm) — sequenced, each its own commit/arc

1. **Verify authenticated path** on the security fix (manual, post-deploy). Small but not done.
2. **Security-fix hardening (2 items):** (a) tighten "any session → full" to "this stay's LINKED guest → full" via `travel_programme_guests.profile_id`; (b) switch inner-tier auth to stay-level `password_hash` (option B — currently all hashes null, session-auth used). Each its own commit.
3. **ProgrammeAdmin EF-compliance** — the admin half of the programme surface still reads tables direct (`global_profiles` + others). Route through EFs. Folds into M's EF-compliance arc.
4. **Property Spine rename** (`programme → stay/property`) — NOW UNBLOCKED: the frontend no longer reads these tables directly (this session cleared the last obstacle). 3-stage sequence in the spec. Coordinate `travel_programme_guests` rename with M-adjacent trip EFs (`travel-write-trip`/`travel-read-trip-admin` read `.profile_id`).
5. **Engagement Spine Phase 2 (supplier reconcile)** — staged w/ ground truth. Bare `suppliers` is orphaned-richer-duplicate (spec's "schism" claim corrected: zero readers — no EF, no frontend). Needs D direction ratification (merge ~11 cols onto `travel_suppliers`, drop bare). Property layer's 3 supplier FKs repoint as part of it.
6. **Em-dash punch-list** — 30 DB columns / ~110 rows with em-dash/curly-quote violations, incl. 2 live-engagement strings (`hero_tagline`, `status_label`). Per-string editorial, not blind replace. Pull strings for review.
7. **`travel_programme_guests` double-pointer** — RESOLVED as non-issue this session: `client_id → global_people` (identity) + `profile_id → auth.users` (login) are distinct correct concerns (residence guests DO log in). Keep both. Consider renaming `profile_id → auth_user_id` for clarity. `master` has only `client_id` (single-table scope).

---

## STANDING (reaffirmed, cross-session)
Every audit + edit holds to: dev standards, seeding standards, universal reference guide, and MISSION (paramount). No bandaids, no shortcuts, no good enough. Fix structure not symptoms. One concern per commit. Inspect-first — this session, 3 assumptions caught wrong by live reads (debris-not-scratch, pure-drop-was-repoint, EF-violated-auth-contract). Verify against ground truth, not code appearance.

---

## FOUNDER RULING (S53N, ratified against the v2 engagement-OS model) — STANDING CANON

**The hosted/property arm is an ENTIRELY SEPARATE THING from the engagement spine.**

Context: two diagrams arrived (M's engagement spine v1, then a v2 "engagement operating
system" model showing `stay` as a capability module + `guests`/`letters`/`contacts`/`tasks`
as cross-cutting OS tables "shared by every engagement, never stored twice"). The v2 model
raised a real fork: is a hosted stay (Casa Romeu) a `stay`-TYPE ENGAGEMENT folded into
travel_immerse_engagements, OR its own peer arm?

**D RULED: entirely separate thing. Peer arm, not a stay-type engagement.**

Rationale (why this is mission-correct, not fragmentation):
- Casa Romeu is ambience-as-HOST (owned/managed property, guest occupancy). No client,
  no proposal, no commission, no design deliverable. The engagement spine models
  client ENGAGEMENTS (ambience-as-DESIGNER). Different relationship = different arm.
- The two arms share ONLY true primitives: global_people (identity — same person,
  different relationships), travel_engagement_types registry, travel_suppliers (post-reconcile).
- They do NOT share guest/letter/section tables. A hosted-stay guest and a design-engagement
  guest are the SAME PERSON (global_people) in DIFFERENT relationship tables (occupancy vs
  engagement party). Separate link tables + one identity source = correct normalization,
  NOT the "stored twice" the mission forbids. "Never stored twice" is satisfied at the
  IDENTITY layer (global_people), which is where it must be.

CONSEQUENCES:
- This session's travel_hosted_* work is CORRECT and PERMANENT — the destination, not a
  way-station. The programme->hosted rename + schema pass + six-table shape all stand.
- The admin rewrite (ProgrammeAdmin + queriesAdminProgramme + 2 admin EFs) is UNBLOCKED:
  the hosted surface is confirmed NOT pending dissolution, so rewriting it to travel_hosted_*
  builds toward the permanent model (satisfies "never build on surfaces pending dissolution").
- Do NOT re-litigate. A future instance seeing the v2 OS diagram may be tempted to fold the
  hosted arm into the spine as a stay-type engagement. D has ruled against this. The hosted
  arm is a peer.

DESIGN PRINCIPLE reinforced (from the ChatGPT observer + v2 model, D-endorsed direction):
- Build the durable FOUNDATION now (spine + shared primitives), add each capability/detail
  MODULE just-in-time when a real engagement demands it. Not speculative. The grayed "future"
  boxes (acquisition, dining detail) are correctly UNBUILT until a real request arrives.
- This applies to the hosted arm too: build to CURRENT six-table reality, no speculative
  generalization toward a hosted-engagement abstraction.

  ## 2026-07-11 (S53Q — client P0 close: visibility audit + gate + not-found)

### [DECISION][VISIBILITY] Public engagements = FOUR, v2 deliberately public (D-adjudicated)
Audit of public_view across all top-level engagements. public_view is the guest gate;
is_public is uniformly false (NOT the control). Four engagements are public and D
ratified this as correct — the earlier "only three public" rule (S53I) is SUPERSEDED:
  - kH9mP4wRn3x (6711b0f3) — London & Beverly Hills 2026
  - kF4nP8wRm2x (5857d344) — Together In The Alps v2 (the confirmed clone winner)
  - oQC68jVKgcm (e14b273f) — Yazeed Honeymoon v3
  - oQC68jVKgcI (da3c4600) — Yazeed Honeymoon v2, kept public DELIBERATELY so the guest
    can compare v2/v3 side by side.
All other engagements correctly public_view=false. NO data changed — the data was already
correct; the documented rule was stale. Recorded so a future audit does NOT re-flag v2 as
a violation and "helpfully" hide a live guest trip. An audit surfaces discrepancies for D
to adjudicate; it does not decide which side of a discrepancy is the error.

### [FIX][immerse] Bad/bare immerse URL renders branded NotFoundPage (was silent redirect)
A bad or bare immerse URL silently window.location.replace'd to the marketing site
(App.tsx immerse-branch fallthrough) — an unexplained teleport, mission-failing (no dead
ends, no unexplained bounce). Now renders the branded NotFoundPage (dark, emblem, "Return
to ambience.travel"). Added NotFoundPage lazy import (fallthrough-last). Verified live:
/thisdoesnotexist99 → "We couldn't find that page."; the bad-id path flows through
ImmerseEngagementRoute → resolver → not-found → NotFoundPage (no second teleport).
Guest dead-end states now consistent: hidden → cream ImmerseNotPublicFallback ("reach out
to your travel designer"), not-found → dark NotFoundPage, both with a way home.

### [VERIFY][visibility] Guest gate confirmed live + stale comment corrected
Guest visibility gate verified end-to-end on a hidden CONFIRMED trip (Sharm NfXkQ2mRp7B →
cream "not publicly visible" screen). Gate chain: travel-get-immerse-proposal returns 403
not_public as the universal first gate for ALL engagements (proposal + confirmed) →
NOT_PUBLIC_SENTINEL → phase:'not-public' → ImmerseNotPublicFallback. checkPublicView in the
two trip EFs is defense-in-depth, not the primary gate. Corrected the stale _shared/
visibility.ts header (claimed 404-indistinguishable; code returns DISTINGUISHABLE 403
not_public / 404 not_found — the distinction is load-bearing for the two branded screens).
Redeployed travel-get-trip-confirmation + travel-get-trip-programme (--use-api).

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

---

## 2026-07-10 (S53P — Stage 6 Phase 2 Section D: compat views DROPPED · CUTOVER COMPLETE)

### The 7 compat views dropped — transitional scaffolding removed, system at rest

**Pre-drop gate (the drop is when a missed reference surfaces, so verify FIRST):**
- pg_class: 7 views confirmed, all dependent_views=0 (no view-on-view, free drop order).
- Full-codebase grep for all 7 OLD names across src/ + supabase/functions/: ZERO live
  references. Every hit was travel_engagement_aux_bookings — the REAL table (aux is Stage 7,
  not renamed, not a view). Phase 1 + Phase 2 repointed every reader to travel_journey_*
  already. The views were load-bearing for nothing.

**Dropped (one txn):** travel_trips, travel_engagement_briefs, travel_engagement_days,
travel_engagement_day_entries, travel_engagement_destinations,
travel_engagement_welcome_letters, travel_trip_guests.

**Post-drop verified (rendered page, immediately):**
- pg_class: zero rows — views gone.
- Guest programme 1d680dcc: renders.
- OutlookTab Sharm 89aee7e3: 666.12 / 951.60 / 285.48 — money intact.
- StudioDashboard money strip: renders.

**STATE: travel_trips no longer exists in ANY form — not a table, not a view. The name is
gone from the database. travel_journey is the only truth. Every reader is on true names with
zero compat scaffolding. The DB+EF layer is COHERENT with the mission model and AT REST for
the first time in the campaign.** The Stage-1 drift (engagement_id meaning two things) is
structurally closed.

### STILL OPEN — Section C + EF boundary sweep (one combined coherent motion, per mission)
Frontend still sends { trip_id } payload keys; EF handlers still destructure body.trip_id;
EF outputs still emit trip_id; frontend types still declare trip_id. ALL WORKING (contract
held end-to-end, tsc green). NOT broken — the remaining name-lie is cosmetic-honesty, not
structural. Per mission ("no line edited twice"), Section C is done AS ONE MOTION with the
EF boundary sweep: rename travel-write-trip -> travel-write-journey, queriesAdminTrip ->
journey, invokeWriteTrip -> invokeWriteJourney, flip payload keys honest-per-meaning
(journey_id journey-scoped, engagement_id for the retired set_public_view duplicate), flip
EF handler destructures + outputs + frontend types in lockstep. set_public_view duplicate
retires to the spine layer (set_visibility already exists in travel-write-engagement). Each
line lands once, in final coherent form.

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

### [DB] 5 set_updated_at triggers renamed off travel_trip_* — set_updated_at trigger names closed  [CORRECTED S53R: NOT the last travel_trip_* token — 7 index/constraint objects remain (travel_trip_guests_pkey, idx_travel_trip_guests_person/_trip, travel_trip_statuses_pkey/_slug_key, + 2 unique-triple indexes). See debts board D12.]

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

---

### [CANON] Universal Document #4 superseded — 12 Jul 2026 (widens travel → lifestyle design)

The Mission evolved. Registering the deltas that bear on live work:

- MISSION widened: "Be the best in the world at designing life's most meaningful moments."
  Travel is now explicitly the center of gravity + the craft-benchmark, NOT the whole.
  Lifestyle design is the discipline. Confirms the service-agnostic-spine reasoning the
  Phase B model-correction already anticipated — now canon.
- NORTH STAR: "One ENGAGEMENT. One URL. One experience." (was "One trip"). The Phase B
  campaign (travel_trips retired as spine → travel_engagements the service-agnostic entity;
  travel_trips → travel_journey the capability module) is now DIRECTLY MANDATED by the North
  Star's wording. The rename is the Mission made structural, not just cleanup.
- THE NINE are canon. Every engagement is one of: Journey, Stay, Dining, Reservation,
  Transport, Experience, Acquisition, Arrangement, Concierge Service.
  - Arrangement = BROKERED (a third party performs it — the supplier/partner path).
  - Concierge Service = OURS (ambience performs it directly — research, appointments, the
    house's direct work, personal assistance).
  - The Arrangement/Concierge Service distinction is "deliberate and load-bearing" (doc's
    words): different fulfillment models, not a label. Never conflate.

### [ARC-pending] travel_engagement_types needs THE NINE — add Concierge Service, split from Arrangement

Schema + registry work, own slice. travel_engagement_types must carry all nine canon types.
Concierge Service is NEW and must be SPLIT from Arrangement (brokered-vs-ours is load-bearing
per Doc #4). Recon-first: read current travel_engagement_types rows/shape against
information_schema, confirm which of the nine already exist, add the missing (incl. Concierge
Service), ensure the type distinction is modeled (not just a label) where fulfillment differs.

### [NOTE] Flat-read is a BRIDGE, not the end state (Phase 2)
The current flat-read path is transitional. Phase 2's end state = consumers on the engagement
shape; the flat-read is DELETED with aux (aux_bookings → elements, Stage 7). Do not build
new consumers assuming flat-read permanence — it is scaffolding with a demolition date.

---

### [STANDING RULE] Every table: RLS + Constraints + Comments (D, S53L)

No table is complete without all three:
1. **RLS with EXPLICIT policies.** RLS-enabled + zero-policies = silent deny-all (a latent bug —
   works only via service-role bypass, silently empty on any other path). Every table declares
   its posture explicitly: public-read where non-sensitive, admin-write, guest-data behind the
   wall. Never rely on omission.
2. **Constraints that enforce real invariants.** Slug format (no free text — `^[a-z0-9_]+$`),
   non-blank CHECKs on required text, FKs for references, enums/registries for bounded value
   spaces, uniqueness where identity. A bare column is a smell.
3. **COMMENTs — self-documenting schema.** COMMENT ON TABLE (what it is, how it relates) +
   COMMENT ON COLUMN for any load-bearing/non-obvious column. The schema explains itself to the
   next instance without a handover.

Applied to travel_engagement_types this session: found RLS-on-zero-policies (deny-all bug) →
added public-read + admin-write; added slug-format + label-nonblank CHECKs; added table +
level + slug comments.

### [SHAPE/ELEMENT SPLIT — Phase B/Stage 7] Progress: classification landed (S53L)

Real work started on the shape-vs-element conflation. travel_engagement_types held BOTH the
nine engagement shapes AND the element types (flight/car/transfer) in one flat list, with the
conflation LIVE on the spine: travel_engagements.engagement_type_id had 15 rows typed 'journey'
(shape) and 15 typed 'flight' (element) — same column, two levels.

DONE this session (additive, non-breaking, no spine retype):
- Added engagement_type_level enum ('shape','element').
- Added travel_engagement_types.level column, NOT NULL, classified all 22 rows:
  9 SHAPES (acquisition, arrangement, concierge_service, dining, experience, journey,
  reservation, stay, transport) + 13 ELEMENTS (airport_transfer, car_rental, car_service,
  cruise, flight, heli_transfer, meet_greet, other, private_jet, public_transport, tour,
  transfer, yacht_charter).
- Added transport + concierge_service shape rows (completing the Nine).
- RLS + constraints + comments (per the new standing rule).

The conflation is now VISIBLE + ENFORCED at the classification level — prerequisite for the
retype. NOT YET DONE (the delicate, sequenced next cuts — each its own gated step, snapshot-first):
- RETYPE THE SPINE: the 15 'flight' + 3 'airport_transfer' + 2 'meet_greet' engagements are
  element-typed and must remap to their correct SHAPE (Transport), with the element detail
  moving DOWN to the element/aux layer. 20 engagements to reclassify. Snapshot + reversible.
- ENFORCE LEVEL-BY-REFERENCE: travel_engagements.engagement_type_id must reference only SHAPE
  rows; travel_engagement_aux_bookings.engagement_type_id only ELEMENT rows. Currently
  unenforced (that's how 'flight' engagements exist). Trigger or filtered-FK.
- RECONCILE WITH EXISTING ELEMENT INFRA (do NOT duplicate): element_status_events.element_type,
  travel_bookings.booking_type, _shared/elementFields.ts already exist as element-layer
  groundwork. The element vocabulary may belong unified with these, not a fresh table.
- 12 CONSUMERS to migrate: typesAuxBookings, typesImmerse, queriesAdminJourney,
  queriesAdminEngagements, ImmerseDetailPage, TripDossierSection, BriefEditorPage,
  EngagementDetailTab, travel-read-engagement-admin, travel-read-journey-admin, _shared/trip.ts,
  _shared/elementFields.ts.
- 'dining' is both a shape AND appears element-ishly — resolve explicitly during retype.

### [CORRECTION + FINDING] Public-read dropped; existing 8-shape code map found (must reconcile to 9)

- RLS CORRECTION: dropped "Public read travel_engagement_types" — grep confirmed ALL consumers
  are service-role EFs (_shared/trip.ts, travel-read-engagement-admin, travel-read-journey-admin)
  or admin surfaces. Nothing needs anon read. Default-closed is correct (the "remove public
  read/write where not needed" pattern). Final posture: Admin write (FOR ALL, covers admin read)
  + service-role EF bypass. Public read was "harmless to expose" but not "needed" — the weaker
  standard. Removed.
- SLUGS JUSTIFIED (were questioned): code branches on slug everywhere (_shared/trip.ts flattens
  by .slug; queriesAdminJourney booking_type = slug is "canonical type field"; typesImmerse has
  a slug→shape map; "never hardcode the list in frontend"). Slug is the canonical contract key;
  UUID is the join mechanic. Keep.
- FINDING (reconciliation the retype MUST do): typesImmerse.ts:260,278 ALREADY has a shape model —
  "the 8 top-level shapes" + "every travel_engagement_types slug (20 rows) maps to one of the 8
  shapes." Code models EIGHT shapes (pre-Concierge-Service-split). Doc #4 (12 Jul) canonizes NINE
  (Concierge Service split from Arrangement = the 9th). My level-classification marked 9 shapes.
  CODE (8) vs TABLE (9) NOW DISAGREE. The retype's first move: reconcile typesImmerse.ts's
  8-shape slug→shape map to the canonical 9, aligned with the new level column. typesImmerse.ts
  is the head-of-work consumer — read it FIRST.

### [CONFIRMED] No extra table created; conflation quantified; element model already exists

NO NEW TABLE was created this session. The shape/element work was ENTIRELY: engagement_type_level
enum + travel_engagement_types.level column + 2 rows (transport, concierge_service) + RLS/CHECKs/
comments. Confirmed: only 2 FKs reference travel_engagement_types (travel_engagements +
travel_engagement_aux_bookings) — no travel_engagement_shapes / travel_element_types exist.

KEY ARCHITECTURE FINDING (from _shared/elementFields.ts): elements do NOT need a second type
registry. The element model is NODE + DETAIL, already built:
- Element type stays engagement_type_id → travel_engagement_types (level='element' rows).
- flat aux_bookings → NODE (travel_engagements) + 1:1 DETAIL (travel_engagement_transport_detail
  for flight, travel_engagement_dining_detail for dining). Bare types (airport_transfer,
  meet_greet) = node only. detailTableForType(slug) selects.
- So the level column I added IS the correct shape/element separation. ONE vocabulary table,
  level-split. NOT two type tables. (Earlier "two separate tables" framing was wrong — corrected.)

CONFLATION QUANTIFIED (travel_engagements.engagement_type_id by level):
- CORRECT (shape): journey 15, dining 5 = 20 genuine shape-engagements.
- MIS-TYPED (element promoted to top-level engagement): flight 15, airport_transfer 3,
  meet_greet 2 = 20 element-engagements that per Stage 7 should be ELEMENTS inside a Transport
  engagement (node+detail), not standalone engagements.

REMAINING WORK (boundary of mine vs M's):
- MINE, DONE: level classification — conflation now visible/queryable. Complete, non-colliding.
- M's STAGE 7: remap the 20 element-engagements → node+detail element model (exactly what
  elementFields.ts describes M building). DO NOT parallel-build.
- BLOCKED until after remap: the level-enforcement constraint (travel_engagements.engagement_type_id
  must reference level='shape' only; aux → level='element' only). Cannot add while 20 engagements
  violate it. Goes on AFTER M's remap clears violators. This is the final integrity lock.
- typesImmerse.ts: 8-shape map → reconcile to canonical 9 (Concierge Service). EFs first, then FE.

### [CONFIRMED] No extra table created; shape/element = level column on the ONE table (correct architecture)

Verified: I created NO new table this arc. Footprint = engagement_type_level enum + level column
+ 2 rows (transport, concierge_service) + RLS/constraints/comments, ALL on the existing
travel_engagement_types. travel_engagement_shapes / travel_element_types do NOT exist and are NOT
needed — elementFields.ts proves the element layer is node+detail (travel_engagements +
travel_engagement_{transport,dining}_detail), NOT a second type registry. Shapes + elements share
ONE vocabulary table, split by level. The classification cut this session was the correct and
complete architecture for this layer.

### [LIVE CONFLATION QUANTIFIED — blocks enforcement until Stage 7 remap]

travel_engagements.engagement_type_id spread by level (the exact violation state):
- journey (shape) 15 ✓  |  dining (shape) 5 ✓   → 20 engagements correctly reference SHAPES
- flight (element) 15 ✗  |  airport_transfer (element) 3 ✗  |  meet_greet (element) 2 ✗
  → 20 engagements INCORRECTLY reference ELEMENTS (the live conflation)

Exactly half the engagements are element-typed top-level engagements — flight/transfer/meet_greet
promoted to engagements instead of being ELEMENTS inside a Transport engagement.

CANNOT add the enforcement constraint ("travel_engagements.engagement_type_id must reference
level='shape'") yet — it would fail on these 20 violators. Enforcement is BLOCKED ON the remap.

REMAINING WORK (correctly characterized, Stage-7-dependent — NOT a fresh table build):
1. REMAP (M's Stage 7, aux→node+detail): the 15 flight + 3 airport_transfer + 2 meet_greet
   engagements → become ELEMENTS (nodes + detail) inside their correct Transport-shape engagement.
   detailTableForType: flight→travel_engagement_transport_detail; bare (airport_transfer,
   meet_greet)→node only.
2. ENFORCE level-by-reference (AFTER remap): engagements→shape rows only; aux/elements→element
   rows only. Trigger or filtered constraint. Blocked until #1 clears the 20 violators.
3. RECONCILE 8→9 shapes in typesImmerse.ts (the frontend slug→shape map is 8; Doc #4 canon is 9).
4. EF-FIRST ordering (D): when the retype happens, _shared/trip.ts + read EFs before frontend.

This session's contribution to the split: the level classification (correct, complete, banked) +
the exact violation map + confirmation that no second table is needed. The remap + enforce are
M's Stage 7, now with level ready to enforce against.

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

## 2026-07-12 (S53Q — Stage 7 Phase 2 COMPLETE: aux table retired, elements are the tree)

### [ARC][DB] travel_engagement_aux_bookings DROPPED — every element now lives solely as a typed engagement-tree node

The flat aux table is gone — not a table, not a view (`to_regclass` returns null). Every
element (flight / dining / airport_transfer / meet_greet) now exists ONLY as a node on
`travel_engagements` (`iteration_label='element'`, `parent_engagement_id` = the confirmed
engagement) + its 1:1 detail row (`travel_engagement_transport_detail` for flights,
`travel_engagement_dining_detail` for dining; bare nodes for transfer/meet_greet). No parallel
source remains. This closes the Stage-7 model: the engagement tree is the single truth for
elements, read + written transactionally. Live Supabase — invisible to git; this is the record.

**Read path (all readers on the tree, verified live):**
- `_shared/engagement.ts` (was `_shared/trip.ts` — renamed, the last trip-named survivor in the
  shared layer; exports `fetchEngagementCore`/`EngagementCore`/`fetchEngagementBookings`).
  `fetchElementsFlat(db, parentEngId)` reads node+detail and flattens to the legacy aux shape
  (a BRIDGE — deleted when consumers read engagement shape directly; do not calcify).
  `fetchOneElementFlat(db, nodeId)` for the write return-shape. `enrichElements(db, elements,
  partyLabel)` — GLOBALIZED passenger/driver/dining enrichment (was inlined verbatim in both
  guest EFs, a live drift risk; now one home).
- `_shared/elementFields.ts` — single field-map (flat↔node/detail) consumed by BOTH read-flatten
  and write-split, so they cannot drift. `detailTableForType(slug)`: flight→transport,
  dining→dining, else bare node.
- The 3 readers (travel-read-journey-admin, travel-get-trip-confirmation, travel-get-trip-programme)
  all read the tree. Guest programme verified live: HRH AMF renders BA269 (LHR→LAX) + all 8
  passengers + dining venues (Mister Nice, China Tang) from the tree.
- Calendar activity read: fixed the journey-vs-engagement filter (elements' parent_engagement_id
  is the CONFIRMED ENGAGEMENT id, not the journey id — resolve journeyId→confirmed_engagement_id
  for the `.in()` filter, group results back by engagement id). Was showing "No itinerary recorded"
  on EVERY trip. Now renders full itineraries; flight detail enriched from transport_detail +
  the airport registry (no aux).

**Write path (transactional RPCs, replace the aux passthrough handlers):**
- 3 SECURITY DEFINER plpgsql functions, each atomic (a function body is one txn — fixes the
  orphan-on-failure + type-change-leak of an app-layer sequential-insert draft):
  - `create_element(p_journey_id uuid, p_patch jsonb) → uuid`: resolves parent
    (journey.confirmed_engagement_id), inserts node (full NOT-NULL spine contract:
    engagement_status_id=confirmed, itinerary_status_id=confirmed, audience=private,
    proposal_visibility=active, is_public=false, iteration_label='element', journey_types='{}'),
    then detail by slug. Free-text→FK resolved in-txn (cabin_class label→id, aircraft_type
    label→id, depart/arrive_airport iata→id). PROVEN live (rolled-back txn: created a flight,
    verify returned cabin_resolved="Business", airport_resolved="DOH").
  - `update_element(p_node_id, p_patch)`: COALESCE keeps existing node values for absent keys;
    on type-change DELETEs mismatched detail + upserts correct (ON CONFLICT node_id).
  - `delete_element(p_node_id)`: DELETE node; detail cascades via node_id FK ON DELETE CASCADE.
- travel-write-journey handleCreate/Update/DeleteAuxBooking now call the RPCs and re-read via
  `fetchOneElementFlat` to return the full flat row (TripDossierSection splices it into state).

**The five-table FK migration (aux was tethered by 5 FKs, all ON DELETE CASCADE except 2 SET NULL
— a naive DROP would have destroyed passengers, drivers, tasks):**
Each tethered table: ADD COLUMN node_id uuid + FK→travel_engagements(id) ON DELETE CASCADE,
backfill via the source_aux_booking_id mapping, repoint code, DROP old aux column.
- travel_engagement_aux_passengers (51 rows) — aux_booking_id → node_id
- travel_aux_driver_details (2 rows) — aux_booking_id → node_id
- travel_tasks (3 linked rows) — aux_booking_id → node_id (nullable; most tasks aren't element-linked)
- travel_journey_day_entries (0 linked) — source_aux_id column dropped (cosmetic)
- travel_engagements.source_aux_booking_id (the mapping itself) — dropped LAST, after all backfills
Backfills all proven clean pre-migration (every linked row mapped to exactly one node, no
multi-node, no orphans).

**The aux_booking_id → node_id API-contract sweep (payload-key honesty, tsc-blind — grep the
callers):** switched the expander + driver-editor + passenger-editor contract from passing the
aux id to passing the node id (which the callers already had as `a.id` / `activity.id` — the flat
rows and calendar activities carry the node id). Touched: CalendarTab (activity_detail body →
node_id; canExpand → activity.is_element; type field source_aux_booking_id → is_element),
queriesAdminJourney (3 mode payloads), both EF handlers (handleActivityDetail /
handleAuxDriverDetails take node id directly, no source_aux_booking_id resolve). The EF calendar
projection now emits `is_element: !a.source_booking_id` (the durable "expandable" flag) instead of
carrying the dropped column.

**Element-selection predicate swap (the one late change to eyeball):** `fetchElementsFlat` filtered
elements by `.not('source_aux_booking_id', 'is', null)`. Column dropped → filter switched to
`.eq('iteration_label', 'element')`. Verified equivalent: all 25 element nodes carry
iteration_label='element' (the create_element/populate contract); the lone non-element child (label
'B') correctly excluded.

**Parity gate (banked, held throughout):** nodes=25, transport=15, dining=5, bare=5, passengers=51,
drivers=2, tasks=3. Tree = source before the drop.

### [PROCESS / LESSONS]
- Supabase editor swallows BEGIN-wrapped multi-statement batches (silent rollback → all-zeros
  verify with no error). Run writes ONE AT A TIME autocommit; `psql -f` for functions. `\gset`/
  `\echo` are psql meta-commands, fail in the editor.
- pre-commit hook enforces the no-else standard — caught an `if(t){}else{}` in enrichElements; guard-clause form (null defaults first, override in `if(t)`) is the fix. The hook is load-bearing.
- Uploaded file snapshots go STALE mid-session — trust tsc errors + live greps over uploads for
  current state (repeatedly bit line-number-based seds; content-targeted seds or editor find/replace
  are safer, and zsh history-expansion breaks `!` in piped seds — hand-edit those in the editor).
- The rendered page is the verification, not tsc/grep (the journey-vs-engagement calendar filter was
  tsc-green while every trip showed "No itinerary").

### STILL OPEN (scoped, non-blocking)
- Type-field honesty (Category Z): TripAuxPassenger/TripAuxDriverDetail `.aux_booking_id` type fields
  + `auxBookingId` variable/prop names still say "aux" but hold node ids — values correct, names stale.
- fetchElementsFlat/fetchOneElementFlat/enrichElements flat-read is a BRIDGE (flattens tree→aux shape
  for cutover); delete when consumers read engagement shape directly.
- engagement.ts:425 — one stale comment still mentions source_aux_booking_id.
- Calendar "Stays" metric (S53I debt, re-confirmed on HRH AMF): flat distinct-hotel count conflates
  properties / principal's stays / room footprint — needs a design decision + EF room-count carry.
- typesImmerse 8→9 shape reconcile (L's border): frontend slug→shape map is 8 shapes; Doc #4 canon is
  9 (Concierge Service split from Arrangement). EF-first.
- Passenger party-primitive migration (passenger_label free-text → global_people) — logged follow-on,
  independent of the retire.

### [ARC][DB+FE] THE NINE — modeled, enforced, rendered (S53Q, same session)

Doc #4 canonizes nine engagement shapes. Verified complete across all three layers:

**Modeled (DB, verified):** `travel_engagement_types` holds exactly 9 `level='shape'` rows —
acquisition, arrangement, concierge_service, dining, experience, journey, reservation, stay,
transport — + 13 `level='element'` rows. Concierge Service is split from Arrangement (both
level='shape'); Doc #4's brokered-vs-ours distinction is real in the registry.

**Spine clean (the retype L scoped — done as a Stage-7 side effect):** L's feared conflation
("20 element-typed top-level engagements") is RESOLVED. Verified live: 14 top-level engagements
(parent_engagement_id IS NULL), ALL 14 are level='shape', 0 element-typed, 0 null-level. The
elements became child nodes when Stage 7 reparented them. The "spine retype" handed to M/Stage 7
is complete — the reparenting did it.

**Enforced (trigger, proven both directions):** `trg_enforce_top_level_shape` (fn
`enforce_top_level_shape`, BEFORE INSERT OR UPDATE, guard-clause form per no-else standard).
Rule: top-level engagements (parent_engagement_id IS NULL) MUST reference a level='shape' type;
children may be any level (an element, or a shape nested in a journey — 6 shape-typed children
exist legitimately). CHECK can't hold the subquery, so it's a trigger (L's scoped design choice).
PROVEN in rolled-back txns: inserting a top-level flight → RAISES 'must be a shape (THE NINE);
got level=element'; inserting a top-level journey → succeeds. NOTE FOR L: this was L's owned
integrity lock; fired this session under D's direct instruction after verifying 0 violators
(Stage 7 cleared them). L: it's live, proven — review the guard form / add any RLS-comment per
your standing convention.

**Rendered (frontend, tsc-verified):** typesImmerse.ts was at 8 shapes; added concierge_service
to the EngagementShape union, ENGAGEMENT_SHAPES array, and SLUG_TO_SHAPE map. Now 9. tsc green —
the Record<EngagementShape,SectionType[]> completeness check passed, so SECTION_REGISTRY handles
the new shape without a gap. (Supersedes the earlier "typesImmerse 8→9 reconcile pending" note.)

**Left deliberately (needs D's call):** SLUG_TO_SHAPE maps `other → arrangement`. `other` is
ambiguous between brokered (arrangement) and ours (concierge_service); left at arrangement as the
safe default, not reclassified without direction.

SUPERSEDES the pre-Stage-7 board items: "THE NINE modeled+enforced (pending)", "spine retype
(handed to M)", "typesImmerse 8→9 reconcile", "enforcement constraint BLOCKED until violators
clear" — all now DONE.

### [SCOPING][honest correction] The flat-read shim — built S53Q, retire WITHIN surface consolidation (NOT standalone)

Correction to my own framing. `fetchElementsFlat` / `fetchOneElementFlat` / `enrichElements`-flatten
were built THIS session (S53Q) as a compatibility shim during the aux-reader cutover: they read the
new node+detail tree and reshape it into the OLD flat aux shape so existing consumers didn't have to
change mid-migration. I flagged it as a "bridge to delete" as if it were external arc work — it is my
own deferred scaffolding, not a discovered legacy violation.

**Is it a violation?** No — not a correctness one. It reads the ONE source (the tree); it is not a
parallel source of truth and is not drift-prone the way the aux TABLE was. It IS a cleanliness debt:
it's shaped as the retired aux contract (booking_type, aux-flavoured fields) rather than a clean
consumer-shaped type — a shim wearing the dead table's clothes. Cleanliness, not correctness.

**Do NOT retire it standalone.** Its heaviest consumer is buildTimeline (_shared/timeline.ts) — the
guest programme's core builder — which is woven through the flat aux vocabulary: `booking_type` is the
type discriminator (hotel/flight/transfer branching, flight detection at line ~390), plus cabin_class /
aircraft_type / origin / destination / passengers / name. The other consumers are the confirmation
`auxBookings` render and the admin dossier/AuxBookingsEditor. ALL of these are inside the
one-engagement-surface consolidation's (Collapse A) blast radius — that campaign rewrites buildTimeline
+ the confirmation render + the section registry to render by stage × shape from the tree.

Retiring the shim now = rewrite buildTimeline to read node+detail, THEN rewrite it again during
consolidation = TWO passes over the guest programme's spine. That is the bandaid the Standards forbid.
The clean move is ONE pass: surface consolidation defines the canonical EngagementElement / timeline-item
shape once, buildTimeline is rewritten once to consume it, and the shim is deleted as part of that work.

**Board reclassification:** "delete flat-read bridge" is NOT independent arc work. It is: retire the
S53Q flat shim WITHIN the one-engagement-surface consolidation (Collapse A), same consumers, one pass.
Do not migrate buildTimeline / confirmation / dossier off the flat shape standalone — you'd touch the
guest surfaces twice.

### [NAMING][arc] "trip must disappear" — guest-facing labels retired (S53Q, same session)

The unified engagement surface (ImmerseEngagementSurface, registry-driven, stage × shape)
was found ALREADY BUILT this session — A3/S53O collapsed ImmerseEngagementPage +
ImmerseDeliveryPage into one surface. So Collapse A (the "one client surface" North Star
piece) is substantially DONE. Remaining arc work is naming discipline ("trip" is a leftover
travel-shaped label that must disappear) + the contained flat shim. Progress this run,
guest-facing labels first (highest visibility):

**Guest EFs renamed (commit 46d30a7):**
- `travel-get-trip-programme` → `travel-get-engagement-programme`
- `travel-get-trip-confirmation` → `travel-get-engagement-confirmation`
Sequence (never a broken state): cp folder to new name → deploy new → repoint the 3 callers
(queriesImmerseDelivery CONFIRMATION_FN/PROGRAMME_FN, ItineraryEditorPage PROGRAMME_FN) →
tsc → deploy → VERIFY LIVE (Alps kF4nP8wRm2x guest programme rendered full: Emirates/flydubai
flights, all passengers + seats + confs, Rosewood Schloss Fuschl rooms) → delete old folders +
delete from Supabase dashboard. Shared-module header comments (engagement.ts/visibility.ts/
names.ts) + the typesImmerse.ts:860 wire comment updated to new names.

**Guest "Trip Brief" → "Engagement Brief" (commit 57231eb):** the last trip-label a guest READS
on the delivery surface. 3 guest-facing sites: tab label (ImmerseDeliveryTabShell brief:),
PDF docType + PDF filename (pdfImmerseBrief). Internal comment refs left for the broader sweep.

**Dead Dest re-export shim removed (commits f56f884, 3153385):** ImmerseDestinationComponents.tsx
was a 15-line re-export shim over the real 415-line ImmerseDestComponents.tsx — NOT a parallel-ship
(no duplication/drift), just a redundant indirection with ZERO real importers (SectionRenderers
already imported the real file; the only ImmerseDestinationComponents refs were comments). Deleted
the shim; fixed stale comment refs in ImmerseEngagementComponents, ImmerseCarouselNav, index.css,
ImmerseDestComponents. tsc green.

**Architecture re-verified this session (live schema, not memory — earlier board was 2 sessions
stale):** the surface consolidation is BUILT — ImmerseEngagementSurface computes (stage, shape),
calls resolveSectionSet, renders proposal=scroll / delivery=tabs, content from SECTION_RENDERERS
(single source). queriesImmerseEngagement is the one orchestrator; queriesImmerseDelivery is its
delivery-half sub-fetch (healthy layering, not parallel-ship). The two old EFs it calls are the
last home of the flat shim (fetchElementsFlat feeds buildTimeline + the confirmation payload) —
shim retires when those EF internals are rewritten, contained to that layer, NOT spread.

**STILL OPEN (naming/cleanliness, none guest-visible):**
- Types still carry trip: TripContact / TripGuides / DeliveryData.
- `Dest` abbreviation (Dest → Destination) if full word wanted — note "destination" is itself
  journey-vocabulary (a destination-within-a-journey).
- Long tail: ~76 structural trip refs, 659 files touching "trip" (much comments/incidental).
- Flat shim: retire within the old programme/confirmation EF internals (contained).

### [DECISION][next campaign] booking_type — element_type honesty + retire vestigial bookings column (decided S53Q, D-ratified, execute next)

Investigated the booking_type field (was slated as a rename slice; turned out to be a modeling
question). LIVE DATA settled it: travel_bookings.booking_type is a text column where ALL 16 rows =
'Hotel' — a frozen constant, not a real discriminator. It is NOT a legitimate parallel use of the
name; it's vestigial. The element type field (flight/dining/transfer, from travel_engagement_types
slug, surfaced via the shim as booking_type) is the ONLY place the field does real discriminating
work.

DECIDED DIRECTION (mission-aligned: name things by what they are; every column earns its place;
no parallel-ship):
1. Elements get an honest type field name: element_type (or category) — NOT booking_type.
2. Retire the vestigial travel_bookings.booking_type column (constant 'Hotel'). "Is this a hotel
   booking" becomes STRUCTURAL (a travel_bookings row with rooms IS a hotel booking), not a
   redundant string check.
3. The 6 discriminators (isHotelElement / isFlightElement / … in typesElements.ts) get rewritten:
   the element ones key on element_type; the isHotelElement-on-bookings checks become structural
   (it's a booking → it's a hotel) or are dropped where they only ever returned true.

WHY NOT DONE THIS SESSION: touches travel_bookings — the money/confirmation/pricing layer (the
confirmation EF selects booking_type, timeline.ts:249/279 filters b.booking_type==='Hotel',
typesBookingFinancial + expenses.ts read it). ~70 booking_type sites across 18 files. A rename of a
live booking-layer column is a staged campaign requiring live-verification of confirmation + pricing
surfaces — deliberately NOT an end-of-session sed. Sequenced as the next dedicated campaign.

UNBLOCKS: the flat-shim retirement (fetchElementsFlat consumers key on booking_type — once the
field is honestly element_type and consumers move, the shim's aux-costume output can be replaced
with a clean EngagementElement shape and fetchElementsFlat/fetchOneElementFlat/enrichElements-flatten
deleted). Do the field decision FIRST, then the shim retires cleanly in the same campaign.

NOTE the two are one campaign: element_type rename + vestigial column retire + shim retirement all
turn on the same field. Do them together, staged, money-layer-verified. NOT piecemeal.

### [ARC][element_type honesty — Stage 1b SHIPPED + timeline structural, Stage 2 column-drop deferred] (S53Q)

Executed the element_type-honesty half of the decided booking_type campaign. Additive-first,
money-layer-safe, verified live. Commits d91d4ef (label fix) / fb7d8d3 (timeline structural),
element migration in dbc089a.

**Stage 1a — shim emits both (additive, non-breaking):** _shared/engagement.ts now emits
element_type alongside booking_type at all 3 output sites (same etObj.slug value). Deployed; nothing
broke.

**Stage 1b — all ELEMENT consumers migrated booking_type → element_type:** timeline buildAuxItems
(AuxLike type + the 390/411/412 reads), typesImmerse ImmerseTripAuxBooking (element type),
queriesAdminJourney TripAuxBooking (+ element_type added to the type, populated from shim),
BriefEditorPage mergedAux, ImmerseConfirmedSections (~10 is*Element(aux.element_type) sites +
groupElementsBySection generic constraint in typesElements.ts — the constraint was the keystone: it
narrowed T to {booking_type,...} and cascaded ~20 errors until renamed), both PDF exporters
(pdfImmerseBrief, pdfImmerseConfirmation). tsc-followed to green — each error mapped the next element
consumer. BOOKING booking_type deliberately UNTOUCHED (that's the vestigial-column half, Stage 2).
VERIFIED LIVE: HRH AMF confirmation + programme, Alps programme — flights (QR/EK/BA/Emirates), dining,
transfers, meet&greet, all rooms render. Deployed both engagement EFs.

**Regression caught + fixed (d91d4ef):** programme flight label rendered lowercase "flight" (raw slug)
because buildAuxItems categoryLabel read a.element_type_label which the shim never emits (only the
type-slug field was renamed, NOT the label — label stays booking_type_label). Reverted the AuxLike
label field + the 411 read to booking_type_label (matches shim). "Flight" capitalized again. LESSON:
when renaming a field, the sibling *_label field is a SEPARATE emission — don't rename it unless the
shim emits the new name.

**Timeline hotel test → structural (fb7d8d3, the one behavioral change):** timeline.ts 249/279
filtered hotels by b.booking_type==='Hotel'. Since travel_bookings.booking_type is the vestigial
constant ('Hotel' × all 16 rows), rewrote to structural: a booking with rooms IS a hotel
(_rooms.length > 0). 249 → .filter(b => (b._rooms?.length ?? 0) > 0); 279 → if (!hasRooms) continue.
VERIFIED LIVE: Rosewood/Waldorf/Berkeley hotels still render on Alps + HRH programme. This removes the
timeline's dependency on the vestigial column.

**Stage 2 (column DROP) DEFERRED — own money-focused pass:** travel_bookings.booking_type column
still read by: OutlookTab:384 (isHotelElement(b.booking_type) — LIVE MONEY tab), the dissolving
TripDossierSection (566/580/581/785/812/842), and 4 EF selects (confirmation:53, journey-admin:134/569,
expenses:26) + journey-admin:730 output + typesBookingFinancial:45 + TripBooking type. To drop: rewrite
OutlookTab's hotel check structural, drop from selects/types, verify Outlook/Studio/pricing NUMBERS,
then DROP COLUMN. Entangled with a live money surface + a dissolving admin surface — deliberately NOT
end-of-session. Timeline (the guest read) is already off it; the remaining readers are admin/money.

**Also still element-side, low-priority:** BriefEditorPage 372/918 + TripDossierSection element reads
still say booking_type (should be element_type). TripDossierSection is the dissolving HouseTab surface
— resolves on its dissolution. BriefEditorPage is live but non-guest-visible.

## 2026-07-12 (S53Q — Stage 7 Phase 2 COMPLETE: aux table retired, elements are the tree)

### [ARC][DB] travel_engagement_aux_bookings DROPPED — every element now lives solely as a typed engagement-tree node

The flat aux table is gone — not a table, not a view (`to_regclass` returns null). Every
element (flight / dining / airport_transfer / meet_greet) now exists ONLY as a node on
`travel_engagements` (`iteration_label='element'`, `parent_engagement_id` = the confirmed
engagement) + its 1:1 detail row (`travel_engagement_transport_detail` for flights,
`travel_engagement_dining_detail` for dining; bare nodes for transfer/meet_greet). No parallel
source remains. This closes the Stage-7 model: the engagement tree is the single truth for
elements, read + written transactionally. Live Supabase — invisible to git; this is the record.

**Read path (all readers on the tree, verified live):**
- `_shared/engagement.ts` (was `_shared/trip.ts` — renamed, the last trip-named survivor in the
  shared layer; exports `fetchEngagementCore`/`EngagementCore`/`fetchEngagementBookings`).
  `fetchElementsFlat(db, parentEngId)` reads node+detail and flattens to the legacy aux shape
  (a BRIDGE — deleted when consumers read engagement shape directly; do not calcify).
  `fetchOneElementFlat(db, nodeId)` for the write return-shape. `enrichElements(db, elements,
  partyLabel)` — GLOBALIZED passenger/driver/dining enrichment (was inlined verbatim in both
  guest EFs, a live drift risk; now one home).
- `_shared/elementFields.ts` — single field-map (flat↔node/detail) consumed by BOTH read-flatten
  and write-split, so they cannot drift. `detailTableForType(slug)`: flight→transport,
  dining→dining, else bare node.
- The 3 readers (travel-read-journey-admin, travel-get-trip-confirmation, travel-get-trip-programme)
  all read the tree. Guest programme verified live: HRH AMF renders BA269 (LHR→LAX) + all 8
  passengers + dining venues (Mister Nice, China Tang) from the tree.
- Calendar activity read: fixed the journey-vs-engagement filter (elements' parent_engagement_id
  is the CONFIRMED ENGAGEMENT id, not the journey id — resolve journeyId→confirmed_engagement_id
  for the `.in()` filter, group results back by engagement id). Was showing "No itinerary recorded"
  on EVERY trip. Now renders full itineraries; flight detail enriched from transport_detail +
  the airport registry (no aux).

**Write path (transactional RPCs, replace the aux passthrough handlers):**
- 3 SECURITY DEFINER plpgsql functions, each atomic (a function body is one txn — fixes the
  orphan-on-failure + type-change-leak of an app-layer sequential-insert draft):
  - `create_element(p_journey_id uuid, p_patch jsonb) → uuid`: resolves parent
    (journey.confirmed_engagement_id), inserts node (full NOT-NULL spine contract:
    engagement_status_id=confirmed, itinerary_status_id=confirmed, audience=private,
    proposal_visibility=active, is_public=false, iteration_label='element', journey_types='{}'),
    then detail by slug. Free-text→FK resolved in-txn (cabin_class label→id, aircraft_type
    label→id, depart/arrive_airport iata→id). PROVEN live (rolled-back txn: created a flight,
    verify returned cabin_resolved="Business", airport_resolved="DOH").
  - `update_element(p_node_id, p_patch)`: COALESCE keeps existing node values for absent keys;
    on type-change DELETEs mismatched detail + upserts correct (ON CONFLICT node_id).
  - `delete_element(p_node_id)`: DELETE node; detail cascades via node_id FK ON DELETE CASCADE.
- travel-write-journey handleCreate/Update/DeleteAuxBooking now call the RPCs and re-read via
  `fetchOneElementFlat` to return the full flat row (TripDossierSection splices it into state).

**The five-table FK migration (aux was tethered by 5 FKs, all ON DELETE CASCADE except 2 SET NULL
— a naive DROP would have destroyed passengers, drivers, tasks):**
Each tethered table: ADD COLUMN node_id uuid + FK→travel_engagements(id) ON DELETE CASCADE,
backfill via the source_aux_booking_id mapping, repoint code, DROP old aux column.
- travel_engagement_aux_passengers (51 rows) — aux_booking_id → node_id
- travel_aux_driver_details (2 rows) — aux_booking_id → node_id
- travel_tasks (3 linked rows) — aux_booking_id → node_id (nullable; most tasks aren't element-linked)
- travel_journey_day_entries (0 linked) — source_aux_id column dropped (cosmetic)
- travel_engagements.source_aux_booking_id (the mapping itself) — dropped LAST, after all backfills
Backfills all proven clean pre-migration (every linked row mapped to exactly one node, no
multi-node, no orphans).

**The aux_booking_id → node_id API-contract sweep (payload-key honesty, tsc-blind — grep the
callers):** switched the expander + driver-editor + passenger-editor contract from passing the
aux id to passing the node id (which the callers already had as `a.id` / `activity.id` — the flat
rows and calendar activities carry the node id). Touched: CalendarTab (activity_detail body →
node_id; canExpand → activity.is_element; type field source_aux_booking_id → is_element),
queriesAdminJourney (3 mode payloads), both EF handlers (handleActivityDetail /
handleAuxDriverDetails take node id directly, no source_aux_booking_id resolve). The EF calendar
projection now emits `is_element: !a.source_booking_id` (the durable "expandable" flag) instead of
carrying the dropped column.

**Element-selection predicate swap (the one late change to eyeball):** `fetchElementsFlat` filtered
elements by `.not('source_aux_booking_id', 'is', null)`. Column dropped → filter switched to
`.eq('iteration_label', 'element')`. Verified equivalent: all 25 element nodes carry
iteration_label='element' (the create_element/populate contract); the lone non-element child (label
'B') correctly excluded.

**Parity gate (banked, held throughout):** nodes=25, transport=15, dining=5, bare=5, passengers=51,
drivers=2, tasks=3. Tree = source before the drop.

### [PROCESS / LESSONS]
- Supabase editor swallows BEGIN-wrapped multi-statement batches (silent rollback → all-zeros
  verify with no error). Run writes ONE AT A TIME autocommit; `psql -f` for functions. `\gset`/
  `\echo` are psql meta-commands, fail in the editor.
- pre-commit hook enforces the no-else standard — caught an `if(t){}else{}` in enrichElements; guard-clause form (null defaults first, override in `if(t)`) is the fix. The hook is load-bearing.
- Uploaded file snapshots go STALE mid-session — trust tsc errors + live greps over uploads for
  current state (repeatedly bit line-number-based seds; content-targeted seds or editor find/replace
  are safer, and zsh history-expansion breaks `!` in piped seds — hand-edit those in the editor).
- The rendered page is the verification, not tsc/grep (the journey-vs-engagement calendar filter was
  tsc-green while every trip showed "No itinerary").

### STILL OPEN (scoped, non-blocking)
- Type-field honesty (Category Z): TripAuxPassenger/TripAuxDriverDetail `.aux_booking_id` type fields
  + `auxBookingId` variable/prop names still say "aux" but hold node ids — values correct, names stale.
- fetchElementsFlat/fetchOneElementFlat/enrichElements flat-read is a BRIDGE (flattens tree→aux shape
  for cutover); delete when consumers read engagement shape directly.
- engagement.ts:425 — one stale comment still mentions source_aux_booking_id.
- Calendar "Stays" metric (S53I debt, re-confirmed on HRH AMF): flat distinct-hotel count conflates
  properties / principal's stays / room footprint — needs a design decision + EF room-count carry.
- typesImmerse 8→9 shape reconcile (L's border): frontend slug→shape map is 8 shapes; Doc #4 canon is
  9 (Concierge Service split from Arrangement). EF-first.
- Passenger party-primitive migration (passenger_label free-text → global_people) — logged follow-on,
  independent of the retire.

### [ARC][DB+FE] THE NINE — modeled, enforced, rendered (S53Q, same session)

Doc #4 canonizes nine engagement shapes. Verified complete across all three layers:

**Modeled (DB, verified):** `travel_engagement_types` holds exactly 9 `level='shape'` rows —
acquisition, arrangement, concierge_service, dining, experience, journey, reservation, stay,
transport — + 13 `level='element'` rows. Concierge Service is split from Arrangement (both
level='shape'); Doc #4's brokered-vs-ours distinction is real in the registry.

**Spine clean (the retype L scoped — done as a Stage-7 side effect):** L's feared conflation
("20 element-typed top-level engagements") is RESOLVED. Verified live: 14 top-level engagements
(parent_engagement_id IS NULL), ALL 14 are level='shape', 0 element-typed, 0 null-level. The
elements became child nodes when Stage 7 reparented them. The "spine retype" handed to M/Stage 7
is complete — the reparenting did it.

**Enforced (trigger, proven both directions):** `trg_enforce_top_level_shape` (fn
`enforce_top_level_shape`, BEFORE INSERT OR UPDATE, guard-clause form per no-else standard).
Rule: top-level engagements (parent_engagement_id IS NULL) MUST reference a level='shape' type;
children may be any level (an element, or a shape nested in a journey — 6 shape-typed children
exist legitimately). CHECK can't hold the subquery, so it's a trigger (L's scoped design choice).
PROVEN in rolled-back txns: inserting a top-level flight → RAISES 'must be a shape (THE NINE);
got level=element'; inserting a top-level journey → succeeds. NOTE FOR L: this was L's owned
integrity lock; fired this session under D's direct instruction after verifying 0 violators
(Stage 7 cleared them). L: it's live, proven — review the guard form / add any RLS-comment per
your standing convention.

**Rendered (frontend, tsc-verified):** typesImmerse.ts was at 8 shapes; added concierge_service
to the EngagementShape union, ENGAGEMENT_SHAPES array, and SLUG_TO_SHAPE map. Now 9. tsc green —
the Record<EngagementShape,SectionType[]> completeness check passed, so SECTION_REGISTRY handles
the new shape without a gap. (Supersedes the earlier "typesImmerse 8→9 reconcile pending" note.)

**Left deliberately (needs D's call):** SLUG_TO_SHAPE maps `other → arrangement`. `other` is
ambiguous between brokered (arrangement) and ours (concierge_service); left at arrangement as the
safe default, not reclassified without direction.

SUPERSEDES the pre-Stage-7 board items: "THE NINE modeled+enforced (pending)", "spine retype
(handed to M)", "typesImmerse 8→9 reconcile", "enforcement constraint BLOCKED until violators
clear" — all now DONE.

### [SCOPING][honest correction] The flat-read shim — built S53Q, retire WITHIN surface consolidation (NOT standalone)

Correction to my own framing. `fetchElementsFlat` / `fetchOneElementFlat` / `enrichElements`-flatten
were built THIS session (S53Q) as a compatibility shim during the aux-reader cutover: they read the
new node+detail tree and reshape it into the OLD flat aux shape so existing consumers didn't have to
change mid-migration. I flagged it as a "bridge to delete" as if it were external arc work — it is my
own deferred scaffolding, not a discovered legacy violation.

**Is it a violation?** No — not a correctness one. It reads the ONE source (the tree); it is not a
parallel source of truth and is not drift-prone the way the aux TABLE was. It IS a cleanliness debt:
it's shaped as the retired aux contract (booking_type, aux-flavoured fields) rather than a clean
consumer-shaped type — a shim wearing the dead table's clothes. Cleanliness, not correctness.

**Do NOT retire it standalone.** Its heaviest consumer is buildTimeline (_shared/timeline.ts) — the
guest programme's core builder — which is woven through the flat aux vocabulary: `booking_type` is the
type discriminator (hotel/flight/transfer branching, flight detection at line ~390), plus cabin_class /
aircraft_type / origin / destination / passengers / name. The other consumers are the confirmation
`auxBookings` render and the admin dossier/AuxBookingsEditor. ALL of these are inside the
one-engagement-surface consolidation's (Collapse A) blast radius — that campaign rewrites buildTimeline
+ the confirmation render + the section registry to render by stage × shape from the tree.

Retiring the shim now = rewrite buildTimeline to read node+detail, THEN rewrite it again during
consolidation = TWO passes over the guest programme's spine. That is the bandaid the Standards forbid.
The clean move is ONE pass: surface consolidation defines the canonical EngagementElement / timeline-item
shape once, buildTimeline is rewritten once to consume it, and the shim is deleted as part of that work.

**Board reclassification:** "delete flat-read bridge" is NOT independent arc work. It is: retire the
S53Q flat shim WITHIN the one-engagement-surface consolidation (Collapse A), same consumers, one pass.
Do not migrate buildTimeline / confirmation / dossier off the flat shape standalone — you'd touch the
guest surfaces twice.

### [NAMING][arc] "trip must disappear" — guest-facing labels retired (S53Q, same session)

The unified engagement surface (ImmerseEngagementSurface, registry-driven, stage × shape)
was found ALREADY BUILT this session — A3/S53O collapsed ImmerseEngagementPage +
ImmerseDeliveryPage into one surface. So Collapse A (the "one client surface" North Star
piece) is substantially DONE. Remaining arc work is naming discipline ("trip" is a leftover
travel-shaped label that must disappear) + the contained flat shim. Progress this run,
guest-facing labels first (highest visibility):

**Guest EFs renamed (commit 46d30a7):**
- `travel-get-trip-programme` → `travel-get-engagement-programme`
- `travel-get-trip-confirmation` → `travel-get-engagement-confirmation`
Sequence (never a broken state): cp folder to new name → deploy new → repoint the 3 callers
(queriesImmerseDelivery CONFIRMATION_FN/PROGRAMME_FN, ItineraryEditorPage PROGRAMME_FN) →
tsc → deploy → VERIFY LIVE (Alps kF4nP8wRm2x guest programme rendered full: Emirates/flydubai
flights, all passengers + seats + confs, Rosewood Schloss Fuschl rooms) → delete old folders +
delete from Supabase dashboard. Shared-module header comments (engagement.ts/visibility.ts/
names.ts) + the typesImmerse.ts:860 wire comment updated to new names.

**Guest "Trip Brief" → "Engagement Brief" (commit 57231eb):** the last trip-label a guest READS
on the delivery surface. 3 guest-facing sites: tab label (ImmerseDeliveryTabShell brief:),
PDF docType + PDF filename (pdfImmerseBrief). Internal comment refs left for the broader sweep.

**Dead Dest re-export shim removed (commits f56f884, 3153385):** ImmerseDestinationComponents.tsx
was a 15-line re-export shim over the real 415-line ImmerseDestComponents.tsx — NOT a parallel-ship
(no duplication/drift), just a redundant indirection with ZERO real importers (SectionRenderers
already imported the real file; the only ImmerseDestinationComponents refs were comments). Deleted
the shim; fixed stale comment refs in ImmerseEngagementComponents, ImmerseCarouselNav, index.css,
ImmerseDestComponents. tsc green.

**Architecture re-verified this session (live schema, not memory — earlier board was 2 sessions
stale):** the surface consolidation is BUILT — ImmerseEngagementSurface computes (stage, shape),
calls resolveSectionSet, renders proposal=scroll / delivery=tabs, content from SECTION_RENDERERS
(single source). queriesImmerseEngagement is the one orchestrator; queriesImmerseDelivery is its
delivery-half sub-fetch (healthy layering, not parallel-ship). The two old EFs it calls are the
last home of the flat shim (fetchElementsFlat feeds buildTimeline + the confirmation payload) —
shim retires when those EF internals are rewritten, contained to that layer, NOT spread.

**STILL OPEN (naming/cleanliness, none guest-visible):**
- Types still carry trip: TripContact / TripGuides / DeliveryData.
- `Dest` abbreviation (Dest → Destination) if full word wanted — note "destination" is itself
  journey-vocabulary (a destination-within-a-journey).
- Long tail: ~76 structural trip refs, 659 files touching "trip" (much comments/incidental).
- Flat shim: retire within the old programme/confirmation EF internals (contained).

### [DECISION][next campaign] booking_type — element_type honesty + retire vestigial bookings column (decided S53Q, D-ratified, execute next)

Investigated the booking_type field (was slated as a rename slice; turned out to be a modeling
question). LIVE DATA settled it: travel_bookings.booking_type is a text column where ALL 16 rows =
'Hotel' — a frozen constant, not a real discriminator. It is NOT a legitimate parallel use of the
name; it's vestigial. The element type field (flight/dining/transfer, from travel_engagement_types
slug, surfaced via the shim as booking_type) is the ONLY place the field does real discriminating
work.

DECIDED DIRECTION (mission-aligned: name things by what they are; every column earns its place;
no parallel-ship):
1. Elements get an honest type field name: element_type (or category) — NOT booking_type.
2. Retire the vestigial travel_bookings.booking_type column (constant 'Hotel'). "Is this a hotel
   booking" becomes STRUCTURAL (a travel_bookings row with rooms IS a hotel booking), not a
   redundant string check.
3. The 6 discriminators (isHotelElement / isFlightElement / … in typesElements.ts) get rewritten:
   the element ones key on element_type; the isHotelElement-on-bookings checks become structural
   (it's a booking → it's a hotel) or are dropped where they only ever returned true.

WHY NOT DONE THIS SESSION: touches travel_bookings — the money/confirmation/pricing layer (the
confirmation EF selects booking_type, timeline.ts:249/279 filters b.booking_type==='Hotel',
typesBookingFinancial + expenses.ts read it). ~70 booking_type sites across 18 files. A rename of a
live booking-layer column is a staged campaign requiring live-verification of confirmation + pricing
surfaces — deliberately NOT an end-of-session sed. Sequenced as the next dedicated campaign.

UNBLOCKS: the flat-shim retirement (fetchElementsFlat consumers key on booking_type — once the
field is honestly element_type and consumers move, the shim's aux-costume output can be replaced
with a clean EngagementElement shape and fetchElementsFlat/fetchOneElementFlat/enrichElements-flatten
deleted). Do the field decision FIRST, then the shim retires cleanly in the same campaign.

NOTE the two are one campaign: element_type rename + vestigial column retire + shim retirement all
turn on the same field. Do them together, staged, money-layer-verified. NOT piecemeal.

### [ARC][element_type honesty — Stage 1b SHIPPED + timeline structural, Stage 2 column-drop deferred] (S53Q)

Executed the element_type-honesty half of the decided booking_type campaign. Additive-first,
money-layer-safe, verified live. Commits d91d4ef (label fix) / fb7d8d3 (timeline structural),
element migration in dbc089a.

**Stage 1a — shim emits both (additive, non-breaking):** _shared/engagement.ts now emits
element_type alongside booking_type at all 3 output sites (same etObj.slug value). Deployed; nothing
broke.

**Stage 1b — all ELEMENT consumers migrated booking_type → element_type:** timeline buildAuxItems
(AuxLike type + the 390/411/412 reads), typesImmerse ImmerseTripAuxBooking (element type),
queriesAdminJourney TripAuxBooking (+ element_type added to the type, populated from shim),
BriefEditorPage mergedAux, ImmerseConfirmedSections (~10 is*Element(aux.element_type) sites +
groupElementsBySection generic constraint in typesElements.ts — the constraint was the keystone: it
narrowed T to {booking_type,...} and cascaded ~20 errors until renamed), both PDF exporters
(pdfImmerseBrief, pdfImmerseConfirmation). tsc-followed to green — each error mapped the next element
consumer. BOOKING booking_type deliberately UNTOUCHED (that's the vestigial-column half, Stage 2).
VERIFIED LIVE: HRH AMF confirmation + programme, Alps programme — flights (QR/EK/BA/Emirates), dining,
transfers, meet&greet, all rooms render. Deployed both engagement EFs.

**Regression caught + fixed (d91d4ef):** programme flight label rendered lowercase "flight" (raw slug)
because buildAuxItems categoryLabel read a.element_type_label which the shim never emits (only the
type-slug field was renamed, NOT the label — label stays booking_type_label). Reverted the AuxLike
label field + the 411 read to booking_type_label (matches shim). "Flight" capitalized again. LESSON:
when renaming a field, the sibling *_label field is a SEPARATE emission — don't rename it unless the
shim emits the new name.

**Timeline hotel test → structural (fb7d8d3, the one behavioral change):** timeline.ts 249/279
filtered hotels by b.booking_type==='Hotel'. Since travel_bookings.booking_type is the vestigial
constant ('Hotel' × all 16 rows), rewrote to structural: a booking with rooms IS a hotel
(_rooms.length > 0). 249 → .filter(b => (b._rooms?.length ?? 0) > 0); 279 → if (!hasRooms) continue.
VERIFIED LIVE: Rosewood/Waldorf/Berkeley hotels still render on Alps + HRH programme. This removes the
timeline's dependency on the vestigial column.

**Stage 2 (column DROP) DEFERRED — own money-focused pass:** travel_bookings.booking_type column
still read by: OutlookTab:384 (isHotelElement(b.booking_type) — LIVE MONEY tab), the dissolving
TripDossierSection (566/580/581/785/812/842), and 4 EF selects (confirmation:53, journey-admin:134/569,
expenses:26) + journey-admin:730 output + typesBookingFinancial:45 + TripBooking type. To drop: rewrite
OutlookTab's hotel check structural, drop from selects/types, verify Outlook/Studio/pricing NUMBERS,
then DROP COLUMN. Entangled with a live money surface + a dissolving admin surface — deliberately NOT
end-of-session. Timeline (the guest read) is already off it; the remaining readers are admin/money.

**Also still element-side, low-priority:** BriefEditorPage 372/918 + TripDossierSection element reads
still say booking_type (should be element_type). TripDossierSection is the dissolving HouseTab surface
— resolves on its dissolution. BriefEditorPage is live but non-guest-visible.

### [ARC][Stage 2 COMPLETE — vestigial booking_type column DROPPED] (S53Q, commit 04ce31c)

The full booking_type campaign is done: element_type honesty (Stage 1b) + this — retiring the
vestigial travel_bookings.booking_type column (constant 'Hotel' × 16 rows).

**Structural hotel checks (replaced booking_type==='Hotel' everywhere):**
- timeline.ts buildHotelItems: the item-builder gate → `!!b.accom_hotel_id || hasRooms` (a booking
  linked to a hotel OR carrying rooms IS a hotel stay). The re-check-in pre-pass filter likewise.
  NOTE: the original `booking_type==='Hotel' || _rooms.length>0` carried real load — some hotel
  bookings have empty _rooms at timeline time — so the structural test MUST include accom_hotel_id,
  not just rooms. (First cut used rooms-only and dropped hotels; accom_hotel_id is the honest signal.)
- OutlookTab isHotel → (b.rooms?.length ?? 0) > 0. pdfImmerseBrief + ImmerseConfirmedSections hotel
  filters → structural. isHotelElement import removed where now unused.

**Column removed from every EF select + type:** confirmation EF, programme EF (line 92 — the one that
bit us), journey-admin (2 selects), expenses shared select; typesBookingFinancial, ImmerseTripBooking,
TripBooking, journey-admin inline type. Then ALTER TABLE travel_bookings DROP COLUMN booking_type.

**VERIFIED LIVE across guest + money:** programme hotels render (HRH Berkeley + Alps Rosewood),
StudioDashboard (pipeline $302,420, commission, margins), OutlookTab (4 HRH bookings, $19,217
commission, rooms, financials), travel-read-expenses 500 cleared. Deployed all EFs importing the
changed shared modules (timeline/engagement/expenses): confirmation, programme, journey-admin,
write-journey, read-expenses.

**CRITICAL LESSON (this stage nearly shipped broken):** the DROP ran while the programme EF select
STILL listed booking_type. A deployed Postgres EF selecting a dropped column does not error loudly —
the whole query returns empty. Result: bookings:[] silently, hotels vanished from the programme with
NO error surfaced in the UI. Diagnosed only by inspecting the raw EF response (no category:'stay',
bookings:[]) → traced to the stale select. RULE FOR COLUMN DROPS: scrub the column from EVERY EF
select AND redeploy ALL importing EFs (incl. shared-module importers) BEFORE running the DROP — never
after. A select of a dropped column empties the query silently. Verify the rendered surface, not just
tsc/deploy — tsc can't see a Postgres select string, and the deploy succeeds fine; only the live
response reveals the empty query.

booking_type→element_type ARC COMPLETE. The field is honestly named on elements; the vestigial
booking column is gone; hotel identity is structural. Mission: name things by what they are, every
column earns its place — satisfied.