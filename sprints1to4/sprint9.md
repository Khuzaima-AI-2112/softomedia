# Sprint 9 — Planning

**Sprint:** 9  
**Status:** Planning  
**Guardrails authority:** [`docs/sprint8-sre-retro.md`](./sprint8-sre-retro.md)  
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)  
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)

---

## Four SRE/QA Rules

These rules are mandatory for every story in this sprint.

1. **No service call without source verification**  
   Every `apiService.X()` call must name the exact existing file and method signature that implements it. If the method does not exist, add a sub-task to create it before UI wiring.

2. **Router file is the API authority**  
   Every API story must list the exact `METHOD /path → body shape` as confirmed in `docs/API_ROUTES.md` and the Express router source file. No frontend endpoint may be written from memory.

3. **Mutation auth must be falsifiable**  
   Every `POST`, `PUT`, `PATCH`, or `DELETE` acceptance criterion must explicitly state the required middleware guard, e.g. `requireRole('retaileradmin') confirmed`.

4. **Enums and sprint docs must be canonical**  
   All workflow/status values must match the `docs/DATABASE_SCHEMA.md` enum definitions exactly (lowercase, underscore-separated). This file lives at `docs/sprint9.md` per GUARDRAIL-5.

---

## Guardrails Checklist

Before any story is marked **Ready for implementation**, confirm all five boxes:

| Rule | Required check | ✓ |
|---|---|---|
| **GUARDRAIL-1** Service method exists | Every `apiService.X()` call verified in `ApiService.js` source | ☐ |
| **GUARDRAIL-2** Route contract exists | HTTP method, path, body shape confirmed in `docs/API_ROUTES.md` | ☐ |
| **GUARDRAIL-3** Auth guard named in AC | Mutation routes explicitly state `requireRole('X') confirmed` | ☐ |
| **GUARDRAIL-4** Enum values canonical | Status strings match schema; grep returns zero uppercase variants at close | ☐ |
| **GUARDRAIL-5** Doc placement | This file is at `docs/sprint9.md`; linked from `docs/MVP_SPRINT_PLAN.md` | ☐ |

---

## Carry-over Pre-conditions (from Sprint 8 Retro §5)

These must be completed before or during Sprint 9:

- [ ] **ENUM-AUDIT-1** — migrate `loops.status` from uppercase (`APPROVED`, `DRAFT`, `LOCKED`) to lowercase (`approved`, `draft`, `locked`) across Firestore writes and all read filters.
- [ ] **ENUM-AUDIT-2** — migrate `playlists.status` from uppercase (`ACTIVE`, `DRAFT`) to lowercase (`active`, `draft`).
- [ ] **Confirm unconfirmed routes** — resolve the four ⚠️ FIXME entries in `docs/API_ROUTES.md` (loop reject, bulk approve, audit-log, screen logs). Each must be either registered in the router or removed from the frontend.
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 9 entry linking to this file.

---

## Backlog

### S9-1 · Telemetry impression Phase 2 — Firestore persistence

**Priority:** High  
**Files:** `ad-server/src/api/telemetry.js`, `ad-server/src/services/impressionService.js` (new)

**Context:** `POST /api/telemetry/impression` (added S8-7) currently logs via Winston only. The `impressions` Firestore collection schema is now defined in `docs/DATABASE_SCHEMA.md`.

**Acceptance criteria:**
- `POST /api/telemetry/impression` persists a document to the `impressions` Firestore collection with fields: `impression_id` (uuid), `campaign_id`, `screen_id`, `asset_id`, `loop_id`, `played_at`, `recorded_at` (server time).
- Route: `POST /api/telemetry/impression → { screen_id, campaign_id, asset_id?, loop_id?, played_at? }` — confirmed in `telemetry.js`.
- Auth guard: `requireAuth` confirmed on route (device token, not role-based).
- Returns `201 { status: 'recorded', impression_id }` on success (unchanged from Phase 1).
- Winston log retained alongside Firestore write.
- If Firestore write fails, returns `500` with error; does not silently swallow.
- Unit test: mock Firestore, assert document shape matches schema.

**GUARDRAIL checks:**
- [ ] G1: `impressionService.save()` — new file, sub-task required
- [ ] G2: `POST /api/telemetry/impression → { screen_id, campaign_id, ... }` confirmed in `telemetry.js`
- [ ] G3: Auth guard — `requireAuth` (device-level, not role). Confirmed.
- [ ] G4: No status enum involved in this story.

---

### S9-2 · ENUM-AUDIT-1 — canonicalise `loops.status` to lowercase

**Priority:** High (data integrity — Player and schedule UI both read this field)  
**Files:** `ad-server/src/api/loops.js`, `ad-server/src/services/loopService.js`, any component that reads `loop.status`

**Acceptance criteria:**
- All Firestore writes to `loops.status` use lowercase values: `approved`, `draft`, `locked`.
- All read-side filters (e.g., `where('status', '==', 'APPROVED')`) updated to lowercase equivalents.
- `grep -r "'APPROVED'\|'DRAFT'\|'LOCKED'" --include="*.js" --include="*.jsx"` returns zero results outside test fixtures.
- Auth guard on any mutation route: `requireRole('retaileradmin') confirmed`.
- No Firestore migration script required at MVP scale — new writes use lowercase; existing documents are tolerated but noted.

**GUARDRAIL checks:**
- [ ] G3: Any PATCH route touching `loops.status` must confirm `requireRole('retaileradmin')`.
- [ ] G4: Canonical values `approved | draft | locked` per `docs/DATABASE_SCHEMA.md`.

---

### S9-3 · Resolve unconfirmed routes (loops reject + bulk approve + audit-log + screen logs)

**Priority:** Medium  
**Files:** `ad-server/src/api/loops.js`, new `ad-server/src/api/audit.js`

**Acceptance criteria:**
- `POST /api/loops/:loopId/reject { reason }` — registered in `loops.js`, `requireRole('retaileradmin')` confirmed, `docs/API_ROUTES.md` FIXME removed.
- `POST /api/locations/:id/loops/approve-all` — registered in `loops.js`, `requireRole('retaileradmin')` confirmed, FIXME removed.
- `POST /api/audit-log` — registered (new `audit.js` router or appended to existing), `requireAuth` confirmed, FIXME in `TechOpsDashboard.jsx` replaced with real call.
- `GET /api/screens/:id/logs` — either registered (stub returning last N log lines) or the frontend FIXME comment is updated to "post-MVP — not in Sprint 9".
- `docs/API_ROUTES.md` updated to remove all ⚠️ FIXME markers for resolved routes.

**GUARDRAIL checks:**
- [ ] G2: All four routes confirmed in router source before frontend wiring.
- [ ] G3: Every mutation route names its guard.

---

*Sprint 9 doc created 2026-06-05 as part of Sprint 8 retro pre-conditions.*
