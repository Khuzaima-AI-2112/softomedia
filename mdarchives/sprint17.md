# Sprint 17 — Soft-Delete Visibility Fix: Retailers & Advertisers

**Sprint:** 17
**Status:** Planned
**Spec authored:** 2026-06-08
**Grounded against:** HEAD [`c61f82a`](https://github.com/cfroszte/softomedia-live2026/commit/c61f82a719f966ad090467ea1f6ee20d76b98190)
**Guardrails active:** 14 (GUARDRAIL-1 through GUARDRAIL-14)
**Carry-forward source:** QA report — ghost-reappearance bug on retailer and advertiser delete
**Related finding:** `current_sprint/sprint16.md` RISK-S16-9 (`PlaylistRepository.js` ACTIVE query survivor — scheduled for this sprint)

---

## Active Guardrails (copy-forward from S16)

- **GUARDRAIL-1** — `App.jsx` is route authority.
- **GUARDRAIL-2** — No route without confirmed live source.
- **GUARDRAIL-3** — No undocumented `data-testid`.
- **GUARDRAIL-4** — Canonical enum values: lowercase, underscore-separated.
- **GUARDRAIL-5** — No shared middleware change without backward-compatibility proof.
- **GUARDRAIL-6** — No hardcoded API URLs in frontend.
- **GUARDRAIL-7** — `API_ROUTES.md` updated in the same sprint as route creation.
- **GUARDRAIL-8** — `DATABASE_SCHEMA.md` updated before first Firestore write.
- **GUARDRAIL-9** — Read existing files in full before writing spec tasks that touch them.
- **GUARDRAIL-10** — Inspect middleware chain of existing handlers before hardening.
- **GUARDRAIL-11** — Enumerate downstream callers before hardening a public endpoint.
- **GUARDRAIL-12** — Confirm service-layer pattern before creating a service file.
- **GUARDRAIL-13** — Doc and nav stories are blocking, not best-effort.
- **GUARDRAIL-14** — Carry-over risks must have a resolution sprint assigned.

---

## Step 1 Findings Summary

| Finding | Detail |
|---|---|
| `RetailerManagement.jsx` `handleDelete` | Calls `apiService.deleteRetailer(id)`, then filters local React state only. On refresh, `loadData()` re-fetches full list from server — retailer reappears. |
| `RetailerRepository.js` `softDelete` | Sets `status: 'inactive'` + `updated_at`. No `deleted_at` field written. |
| `GET /api/retailers` | Calls `retailerRepository.findAll()` with no filter — returns all documents regardless of status. |
| `RetailerManagement.jsx` status toggle | PATCH sets `status: 'inactive'` for intentional deactivation (same value as soft-delete). The two states are currently indistinguishable in Firestore. |
| `AdvertiserManagement.jsx` `handleDelete` | Same pattern: `apiService.deleteAdvertiser(id)` → local state filter only. |
| `AdvertiserRepository.js` `softDelete` | Sets `status: 'suspended'` + `updated_at`. No `deleted_at` field written. |
| `GET /api/advertisers` | Calls `advertiserRepository.findAll()` with no filter — returns all documents including suspended. |
| `BaseRepository.findAll()` | Accepts `options.where` array; Firestore and memory-fallback paths both honour it. The filter mechanism exists — it is simply not used by the retailer/advertiser list routes. |
| `BaseRepository.delete()` | Hard-deletes from Firestore. Used by screens, users, stores, loops. Those entities are NOT affected by this bug. |
| Success toast timing | Toast fires on any non-throwing `apiService` response. If the backend returns 200 but performs no write, the toast still fires. This is a UX trust issue, not a logic error — the backend does write correctly. |
| `PlaylistRepository.js` ACTIVE survivor | `findActiveByScreen()` and `findGlobalPlaylist()` query `status == 'ACTIVE'` (uppercase). Carried from Sprint 16 RISK-S16-9. Addressed in S17-6. |

---

## Root Cause

The ghost-reappearance bug is a **design mismatch** between the soft-delete strategy and the list query, not an API failure.

`softDelete` on retailers writes `status: 'inactive'` to Firestore — the record persists. The GET list endpoint returns every document with no status filter. On refresh, `loadData()` re-fetches the full unfiltered collection and the soft-deleted retailer reappears.

The additional complication for retailers is that intentional deactivation (PATCH toggle) also sets `status: 'inactive'`. Without a separate marker, the two states cannot be distinguished. The fix introduces `deleted_at` as the canonical deletion marker, separating delete from deactivate cleanly.

For advertisers, `softDelete` already uses a distinct value (`status: 'suspended'`) that is not shared with the deactivation toggle, but the same absence of a list filter means suspended advertisers also reappear on refresh.

---

## Step 3 — Outcome Probability

| Task | Score | What Raises It | What Caps It | Remaining Risks |
|---|---|---|---|---|
| **S17-1** RetailerRepository `softDelete` — add `deleted_at` | 97% | Confirmed write path. `BaseRepository.update()` merge pattern confirmed. 2-field addition. | 3% — GUARDRAIL-8 requires `DATABASE_SCHEMA.md` pre-update (S17-7 dependency). | Must coordinate with S17-3 backfill. |
| **S17-2** AdvertiserRepository `softDelete` — add `deleted_at` | 97% | Same pattern as S17-1. `softDelete` code confirmed in full. | 3% — same doc dependency. | Must coordinate with S17-3 backfill. |
| **S17-3** Filter `deleted_at` from GET list endpoints | 91% | `BaseRepository.findAll()` `options.where` confirmed working for both Firestore and memory paths. | 9% — Firestore `== null` query caveat (documents without the field behave differently than documents with `deleted_at: null`). Pre-check required. | Firestore null-filter behaviour must be verified before deploy. |
| **S17-4** Guard GET `/:id` against deleted records | 96% | Both `GET /:id` routes confirmed — single-document lookup with exists check. Addition of one `deleted_at` guard is additive only. | 4% — must not affect non-deleted records or introduce latency on hot paths. | Low blast radius. |
| **S17-5** Backfill migration script | 85% | `BaseRepository` Firestore batch pattern confirmed from S16 script precedent. | 15% — pre-existing `inactive` retailers may or may not have been intentionally deactivated vs deleted. Risk of false-positive backfill. Option B (conservative) available as fallback. | Must be idempotent. Run in staging first. |
| **S17-6** `PlaylistRepository.js` ACTIVE query fix | 88% | Both methods confirmed in full read during S16. Change is `'ACTIVE'` → `'active'` in two query strings. | 12% — playlist data in Firestore may have mixed casing. Needs backfill for playlist documents written before S13 enum fix. | Atomic with playlist backfill script or confirmed safe by collection scan. |
| **S17-7** Update `DATABASE_SCHEMA.md` | 98% | Documentation-only change. | 2% — must be done before S17-1 writes first `deleted_at` field (GUARDRAIL-8). | Blocking for S17-1 and S17-2 start. |

---

## Step 4 — Isolation and Non-Blocking Audit

### Blast-Radius Table

| Task | Files Touched | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|
| **S17-1** | `RetailerRepository.js` | EDIT — add 2 fields to `softDelete` write | **Yes — shared repository** | **Yes — any caller reading `status` to detect deletion** | `deleted_at` is additive. No existing caller checks for `deleted_at`. Status value (`'inactive'`) unchanged — no downstream breakage. |
| **S17-2** | `AdvertiserRepository.js` | EDIT — add 2 fields to `softDelete` write | **Yes — shared repository** | **Yes — any caller reading `status` to detect deletion** | Same as S17-1. `status: 'suspended'` unchanged. `deleted_at` is a new field. |
| **S17-3** | `ad-server/src/api/retailers.js`, `ad-server/src/api/advertisers.js` | EDIT — add `options.where` to `findAll()` calls | **Yes — shared API routers** | **Yes — changes the list returned to all callers of GET /api/retailers and GET /api/advertisers** | Filter is additive and intentional. Only excluded: records with `deleted_at` set. Non-deleted records (including intentionally-inactive retailers) are unaffected. |
| **S17-4** | `ad-server/src/api/retailers.js`, `ad-server/src/api/advertisers.js` | EDIT — add `deleted_at` guard to GET `/:id` | **Yes — shared API routers** | **No** — only adds a 404 path for deleted records; non-deleted records are unaffected | Guard is purely additive. |
| **S17-5** | `ad-server/scripts/backfill-deleted-retailers.js`, `ad-server/scripts/backfill-deleted-advertisers.js` | CREATE — standalone migration scripts | No | No | Not imported by any runtime code. Explicit operational step. |
| **S17-6** | `ad-server/src/repositories/PlaylistRepository.js` | EDIT — 2 query string values `'ACTIVE'` → `'active'` | **Yes — shared repository** | **Yes — Firestore query correctness during transition window** | Same dual-write risk pattern as S16-1. Needs playlist backfill before production cutover. |
| **S17-7** | `docs/DATABASE_SCHEMA.md` | EDIT — doc only | No | No | Markdown doc. Must be authored before S17-1 / S17-2 first write (GUARDRAIL-8). |

### Shared Infrastructure Touch-Point Analysis

#### `RetailerRepository.js` / `AdvertiserRepository.js` (S17-1, S17-2)

**Callers enumerated (pre-check required):**

```bash
# Retailers — all callers of softDelete, and all code that reads retailer.status
grep -rn "deleteRetailer\|softDelete\|retailer\.status\|status.*inactive" \
  ad-server/src client-app/src --include="*.js" --include="*.jsx"

# Advertisers — same
grep -rn "deleteAdvertiser\|softDelete\|advertiser\.status\|status.*suspended" \
  ad-server/src client-app/src --include="*.js" --include="*.jsx"
```

The `deleted_at` field is new — no existing code references it. Adding it to `softDelete` is additive. The only side effect is that `update()` in `BaseRepository` will include `deleted_at` in the merged document from this point forward.

#### `retailers.js` / `advertisers.js` API Routers (S17-3, S17-4)

**GET / list route change (S17-3):**

```js
// retailers.js — BEFORE
const retailers = await retailerRepository.findAll();

// AFTER
const retailers = await retailerRepository.findAll({
    where: [['deleted_at', '==', null]]
});
```

> ⚠️ **Firestore `== null` caveat:** Firestore's `where('field', '==', null)` matches documents where the field is explicitly set to `null`. It does NOT match documents where the field is absent entirely. Pre-existing retailers that have never had `deleted_at` written will be absent from the field and will therefore pass through the filter (they are correctly returned). Post-S17-1, newly soft-deleted retailers will have `deleted_at` set to an ISO timestamp string — these will be correctly excluded.
>
> **Implication:** The S17-3 filter is safe to deploy before or after S17-5 backfill. Pre-S17 soft-deleted retailers (no `deleted_at` field, `status: 'inactive'`) will continue to reappear until S17-5 backfill sets their `deleted_at`. This is expected behaviour during the migration window.
>
> **Memory fallback path:** `BaseRepository.findAll()` memory filter uses `item[field] === value`. For records with no `deleted_at` key, `item['deleted_at'] === null` evaluates to `false` (key is `undefined`, not `null`). This means the in-memory fallback will incorrectly exclude non-deleted records that lack `deleted_at`. **S17-3 must update the memory-fallback filter to treat absent fields as null:**
>
> ```js
> // BaseRepository.js findAll() memory fallback — update the == comparator:
> if (op === '==') return (item[field] ?? null) === value;
> ```
>
> This one-line change makes `deleted_at == null` correctly match records where the field is absent. It is backward-compatible for all existing `==` filter calls (they use concrete values, not null).

### Isolation Verdict

**Fully isolated (zero cross-feature risk):**
- **S17-4** — Additive 404 guard on single-record GET. Non-deleted records unaffected.
- **S17-5** — Standalone migration scripts. Not imported by runtime.
- **S17-7** — Markdown doc. No runtime impact. Must precede S17-1/S17-2 per GUARDRAIL-8.

**Conditionally isolated (safe with constraints respected):**
- **S17-1 + S17-2** — Must both land before S17-3 is promoted to production, otherwise the filter exists but `deleted_at` is never written.
- **S17-3** — Requires `BaseRepository.js` memory-fallback fix (one line) in same commit. Safe to deploy before backfill for new deletions; pre-existing ghosts resolved by S17-5.
- **S17-6** — Must be atomic with playlist backfill script. Same pattern as S16-1+S16-2.

**No task in Sprint 17 touches shared middleware, auth guards, `AuthContext`, `NetworkErrorBanner`, `SafeWidgetLoader`, `ErrorBoundary`, or any cross-cutting frontend infrastructure.**

**No task in Sprint 17 creates, removes, or renames any API route.**

### Non-Blocking Dependency Map

| Task | Blocks | Blocked By | Non-Blocking? |
|---|---|---|---|
| S17-7 | S17-1, S17-2 start (GUARDRAIL-8) | Nothing | ✅ First task — author immediately |
| S17-1 | S17-3 correctness in production | S17-7 authored | ⚠️ Sequence: after S17-7 |
| S17-2 | S17-3 correctness in production | S17-7 authored | ⚠️ Sequence: after S17-7 |
| S17-3 | QA sign-off | S17-1, S17-2 in production; `BaseRepository.js` fix in same commit | ⚠️ Depends on S17-1, S17-2, and BaseRepository fix |
| S17-4 | Nothing | S17-3 deployed (logical, not hard) | ✅ Can ship with S17-3 |
| S17-5 | QA sign-off on pre-existing ghosts | S17-3 deployed | ⚠️ Run after S17-3 in staging, then production |
| S17-6 | RISK-S16-9 closure | Playlist backfill script in same commit | ⚠️ Atomic with playlist backfill |

**Recommended execution order:**
1. **S17-7** — update `DATABASE_SCHEMA.md` first (GUARDRAIL-8).
2. **S17-1 + S17-2** — add `deleted_at` to both `softDelete` methods.
3. **S17-3 + S17-4** — add `deleted_at` filter to GET routes + GET `/:id` guard + `BaseRepository.js` memory fix — single commit.
4. Deploy S17-1 through S17-4 to staging.
5. **S17-5** — run backfill scripts in staging. Confirm zero ghost records return on refresh.
6. QA sign-off in staging.
7. Promote to production.
8. **S17-5** — run backfill scripts in production.
9. **S17-6** — playlist ACTIVE fix + playlist backfill, staged separately after main fix is stable.

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S17-1 | Retailer soft-delete writes only `status: 'inactive'` — same value as manual deactivation toggle. Deleted retailers reappear on page refresh because `GET /api/retailers` returns all documents. | Backend / Frontend | 🔴 Active — confirmed by QA | `RetailerRepository.js` `softDelete()`; `retailers.js` GET /; `RetailerManagement.jsx` `handleDelete` |
| RISK-S17-2 | Advertiser soft-delete writes only `status: 'suspended'`. `GET /api/advertisers` returns all documents including suspended. Deleted advertisers reappear on refresh. | Backend / Frontend | 🔴 Active — confirmed by QA | `AdvertiserRepository.js` `softDelete()`; `advertisers.js` GET /; `AdvertiserManagement.jsx` `handleDelete` |
| RISK-S17-3 | `BaseRepository.findAll()` memory-fallback `==` comparator treats absent fields as `undefined`, not `null`. A `where: [['deleted_at', '==', null]]` filter would incorrectly exclude non-deleted records in memory mode. | Backend | 🔴 Must fix before S17-3 ships | `BaseRepository.js` `findAll()` memory-fallback branch |
| RISK-S17-4 | Pre-existing soft-deleted retailers and advertisers (created before this sprint) have no `deleted_at` field. S17-3 filter alone will not exclude them. Backfill required. | Firestore data | 🟡 Migration window — expected | Requires S17-5 backfill scripts |
| RISK-S17-5 | Retailers with `status: 'inactive'` may be intentionally deactivated (not deleted). Backfilling all `inactive` retailers with `deleted_at` risks hiding live-but-inactive retailers from the admin list. | Data integrity | 🔴 Requires manual review or conservative backfill strategy | See S17-5 options A and B |
| RISK-S17-6 | `PlaylistRepository.js` `findActiveByScreen()` and `findGlobalPlaylist()` query `status == 'ACTIVE'` (uppercase). Active playlists written post-S13 have lowercase `status: 'active'` — these queries return no results. Carried from RISK-S16-9. | Backend / Firestore | 🟡 Carried — schedule confirmed | `PlaylistRepository.js` |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation | Environment Impact |
|---|---|---|---|---|
| SEC-S17-1 | Deleted retailer records visible to all admin-role users via GET list and GET by ID until fix is deployed. No data exfiltration risk (data is not sensitive), but admin trust in delete action is broken. | `retailers.js`, `RetailerManagement.jsx` | S17-3 filter + S17-4 guard. | All envs until deployed. |
| SEC-S17-2 | Same as SEC-S17-1 for advertisers. | `advertisers.js`, `AdvertiserManagement.jsx` | S17-3 filter + S17-4 guard. | All envs until deployed. |
| SEC-S17-3 | Migration window: between S17-3 deploy and S17-5 backfill completion, pre-existing ghost records continue to reappear for data written before this sprint. | All list endpoints | Run backfill promptly after staging validation. Gate production deploy on staging backfill confirmation. | Staging then Prod |

---

## 3. Task Map

| Task | Description | Files Touched | Change Type | Estimated Effort | Outcome Probability |
|---|---|---|---|---|---|
| S17-7 | Update `DATABASE_SCHEMA.md` — document `deleted_at` field before first write | `docs/DATABASE_SCHEMA.md` | EDIT | 1pt | **98%** |
| S17-1 | Add `deleted_at` to `RetailerRepository.softDelete()` | `ad-server/src/repositories/RetailerRepository.js` | EDIT | 1pt | **97%** |
| S17-2 | Add `deleted_at` to `AdvertiserRepository.softDelete()` | `ad-server/src/repositories/AdvertiserRepository.js` | EDIT | 1pt | **97%** |
| S17-3 | Filter `deleted_at` from GET list routes + fix `BaseRepository.js` memory comparator | `ad-server/src/api/retailers.js`, `ad-server/src/api/advertisers.js`, `ad-server/src/repositories/BaseRepository.js` | EDIT | 2pts | **91%** |
| S17-4 | Guard GET `/:id` routes against returning deleted records | `ad-server/src/api/retailers.js`, `ad-server/src/api/advertisers.js` | EDIT | 1pt | **96%** |
| S17-5 | Backfill migration scripts for pre-existing soft-deleted records | `ad-server/scripts/backfill-deleted-retailers.js`, `ad-server/scripts/backfill-deleted-advertisers.js` | CREATE | 2pts | **85%** |
| S17-6 | Fix `PlaylistRepository.js` ACTIVE query — `'ACTIVE'` → `'active'` + playlist backfill | `ad-server/src/repositories/PlaylistRepository.js`, `ad-server/scripts/backfill-playlist-status.js` | EDIT + CREATE | 2pts | **88%** |

---

## 4. Full Task Details

### S17-7 — Update `DATABASE_SCHEMA.md` (98%) ⚡ FIRST

**Must be authored before any code writes `deleted_at` to Firestore — GUARDRAIL-8.**

**Changes required:**
1. Add `deleted_at` field to the `retailers` collection schema: `deleted_at: string | null — ISO 8601 timestamp set on soft-delete. Absent on non-deleted records. Use as primary deletion marker. status: 'inactive' alone does not indicate deletion.`
2. Add `deleted_at` field to the `advertisers` collection schema: `deleted_at: string | null — ISO 8601 timestamp set on soft-delete. Absent on non-deleted records. status: 'suspended' is preserved for referential integrity; deleted_at is the canonical deletion marker.`
3. Document the deactivate-vs-delete distinction for retailers: `status: 'inactive' without deleted_at = intentionally deactivated (toggle). status: 'inactive' with deleted_at set = soft-deleted. GET /api/retailers filters where deleted_at == null.`
4. Schedule RISK-S17-6 (`PlaylistRepository.js` ACTIVE survivor) under the S17-6 task.

**Acceptance criteria:**
1. `grep "deleted_at" docs/DATABASE_SCHEMA.md` → entries present for both `retailers` and `advertisers` collections.
2. `grep "deactivated\|deleted_at" docs/DATABASE_SCHEMA.md` → deactivate-vs-delete distinction documented.
3. `grep "PlaylistRepository\|ACTIVE survivor" docs/DATABASE_SCHEMA.md` → S17-6 task referenced.

---

### S17-1 — Add `deleted_at` to `RetailerRepository.softDelete()` (97%)

**File:** `ad-server/src/repositories/RetailerRepository.js`

**Pre-check before writing:**
```bash
# Confirm all callers of softDelete and all reads of retailer.status
grep -rn "deleteRetailer\|softDelete\|retailer\.status\|status.*inactive" \
  ad-server/src client-app/src --include="*.js" --include="*.jsx"
```

**Change:**
```js
async softDelete(id) {
    const existing = await this.findById(id);
    if (!existing) {
        throw new Error(`Retailer ${id} not found`);
    }
    const deletedAt = new Date().toISOString();
    try {
        if (this.collection) {
            await this.breaker.execute(() =>
                this.collection.doc(id).set({
                    status: 'inactive',
                    deleted_at: deletedAt,        // ← NEW
                    updated_at: deletedAt
                }, { merge: true })
            );
        }
    } catch (e) {
        logger.error(`softDelete failed for retailers/${id}`, {
            error: e.message,
            breaker_state: this.breaker.state
        });
        throw e;
    }
    return this.update(id, { status: 'inactive', deleted_at: deletedAt });
}
```

`status: 'inactive'` is preserved unchanged. No downstream caller that reads `status` is affected.

**Acceptance criteria:**
1. `grep "deleted_at" ad-server/src/repositories/RetailerRepository.js` → present in `softDelete()`.
2. `grep "status.*inactive" ad-server/src/repositories/RetailerRepository.js` → still present (not removed).
3. After calling `softDelete(id)` in staging: Firestore document for that retailer has both `status: 'inactive'` and `deleted_at` set to a valid ISO timestamp.
4. Retailer with `status: 'inactive'` set via PATCH (deactivation toggle) has no `deleted_at` field.
5. S17-7 committed before this task merges.

---

### S17-2 — Add `deleted_at` to `AdvertiserRepository.softDelete()` (97%)

**File:** `ad-server/src/repositories/AdvertiserRepository.js`

**Pre-check before writing:**
```bash
grep -rn "deleteAdvertiser\|softDelete\|advertiser\.status\|status.*suspended" \
  ad-server/src client-app/src --include="*.js" --include="*.jsx"
```

**Change:**
```js
async softDelete(id) {
    const existing = await this.findById(id);
    if (!existing) {
        throw new Error(`Advertiser ${id} not found`);
    }
    const deletedAt = new Date().toISOString();
    try {
        if (this.collection) {
            await this.breaker.execute(() =>
                this.collection.doc(id).set({
                    status: 'suspended',
                    deleted_at: deletedAt,        // ← NEW
                    updated_at: deletedAt
                }, { merge: true })
            );
        }
    } catch (e) {
        logger.error(`softDelete failed for advertisers/${id}`, {
            error: e.message,
            breaker_state: this.breaker.state
        });
        throw e;
    }
    return this.update(id, { status: 'suspended', deleted_at: deletedAt });
}
```

`status: 'suspended'` is preserved for any campaign integrity checks that reference advertiser status. `deleted_at` is the new canonical deletion marker.

**Acceptance criteria:**
1. `grep "deleted_at" ad-server/src/repositories/AdvertiserRepository.js` → present in `softDelete()`.
2. After calling `softDelete(id)` in staging: Firestore document has both `status: 'suspended'` and `deleted_at` set.
3. Campaign documents referencing the soft-deleted advertiser's ID are unaffected.
4. S17-7 committed before this task merges.

---

### S17-3 — Filter `deleted_at` from GET list routes + fix `BaseRepository.js` memory comparator (91%)

**Files:** `ad-server/src/api/retailers.js`, `ad-server/src/api/advertisers.js`, `ad-server/src/repositories/BaseRepository.js`

**These three files must land in a single atomic commit.**

#### Part A — `BaseRepository.js` memory-fallback fix

```js
// findAll() — memory fallback filter — BEFORE:
if (op === '==') return item[field] === value;

// AFTER:
if (op === '==') return (item[field] ?? null) === value;
```

This makes `deleted_at == null` correctly match records where the field is absent. Backward-compatible: all existing `==` filters use concrete non-null values and are unaffected by `?? null`.

#### Part B — `retailers.js` GET / filter

```js
router.get('/', async (req, res) => {
    try {
        const retailers = await retailerRepository.findAll({
            where: [['deleted_at', '==', null]]
        });
        res.json(retailers);
    } catch (error) {
        logger.error('Failed to fetch retailers:', error);
        res.status(500).json({ error: 'Failed to fetch retailers' });
    }
});
```

#### Part C — `advertisers.js` GET / filter

```js
router.get('/', async (req, res) => {
    try {
        const advertisers = await advertiserRepository.findAll({
            where: [['deleted_at', '==', null]]
        });
        res.json(advertisers);
    } catch (error) {
        logger.error('Failed to fetch advertisers:', error);
        res.status(500).json({ error: 'Failed to fetch advertisers' });
    }
});
```

> ⚠️ **Firestore `where('deleted_at', '==', null)` behaviour:** This matches documents where `deleted_at` is explicitly set to `null`. Documents where the field is absent (non-deleted records written before S17-1) are NOT matched by this query and are correctly returned. Documents where `deleted_at` is an ISO string (newly soft-deleted records) ARE correctly excluded. No composite index is required for this single-field equality filter.

**Pre-check:**
```bash
# Confirm no other callers depend on deleted records appearing in the list
grep -rn "getRetailers\|getAdvertisers" client-app/src --include="*.js" --include="*.jsx"
```

**Acceptance criteria:**
1. `grep "(item\[field\] ?? null)" ad-server/src/repositories/BaseRepository.js` → present.
2. `GET /api/retailers` in staging → no retailers with `deleted_at` set to a non-null value are returned.
3. `GET /api/advertisers` in staging → no advertisers with `deleted_at` set to a non-null value are returned.
4. Retailers with `status: 'inactive'` but no `deleted_at` (intentionally deactivated) still appear in the list.
5. Delete a retailer → refresh → retailer is absent from list. (QA sign-off criterion.)
6. Delete an advertiser → refresh → advertiser is absent from list. (QA sign-off criterion.)
7. Memory-fallback path: `findAll({ where: [['deleted_at', '==', null]] })` returns non-deleted records in unit test with Firestore disabled.
8. `BaseRepository.js`, `retailers.js`, and `advertisers.js` in same commit.

---

### S17-4 — Guard GET `/:id` against returning deleted records (96%)

**Files:** `ad-server/src/api/retailers.js`, `ad-server/src/api/advertisers.js`

```js
// retailers.js GET /:id — AFTER
router.get('/:id', async (req, res) => {
    try {
        const retailer = await retailerRepository.findById(req.params.id);
        if (!retailer || retailer.deleted_at) {
            return res.status(404).json({ error: 'Retailer not found' });
        }
        res.json(retailer);
    } catch (error) {
        logger.error('Failed to fetch retailer:', error);
        res.status(500).json({ error: 'Failed to fetch retailer' });
    }
});

// advertisers.js GET /:id — AFTER (same pattern)
router.get('/:id', async (req, res) => {
    try {
        const advertiser = await advertiserRepository.findById(req.params.id);
        if (!advertiser || advertiser.deleted_at) {
            return res.status(404).json({ error: 'Advertiser not found' });
        }
        res.json(advertiser);
    } catch (error) {
        logger.error('Failed to fetch advertiser:', error);
        res.status(500).json({ error: 'Failed to fetch advertiser' });
    }
});
```

Non-deleted records are completely unaffected — the guard only adds a new 404 path. Hot-path performance is unchanged (no additional Firestore read; `deleted_at` is a field on the already-fetched document).

**Acceptance criteria:**
1. `GET /api/retailers/:id` for a soft-deleted retailer → HTTP 404.
2. `GET /api/advertisers/:id` for a soft-deleted advertiser → HTTP 404.
3. `GET /api/retailers/:id` for an active retailer → HTTP 200, full document returned.
4. `GET /api/retailers/:id` for an intentionally-inactive retailer (no `deleted_at`) → HTTP 200, document returned.

---

### S17-5 — Backfill migration scripts (85%)

**Files:** `ad-server/scripts/backfill-deleted-retailers.js`, `ad-server/scripts/backfill-deleted-advertisers.js`

**Option A — Backfill all `status: 'inactive'` retailers (aggressive)**

Sets `deleted_at = updated_at` for all retailers with `status: 'inactive'` and no `deleted_at`. Risk: hides any retailer that was intentionally deactivated before this sprint.

**Option B — Conservative (recommended)**

Only backfill retailers where there is positive evidence of deletion intent (e.g. the delete button was the only path to `'inactive'` state before toggle was added). If toggle was introduced in an earlier sprint alongside delete, Option A is unsafe — use Option B and let admins review the current inactive list.

> **Determining which option is safe:** Run this query against staging before deciding:
> ```bash
> # Count current inactive retailers and check whether any are legitimately active businesses
> # that were deactivated temporarily
> ```
> If the admin confirms all current `status: 'inactive'` retailers are intended deletions, use Option A. Otherwise use Option B and accept that pre-sprint ghosts will need manual admin cleanup.

**Script structure (idempotent, batched, Option A):**

```js
// ad-server/scripts/backfill-deleted-retailers.js
import { getFirestore } from '../src/utils/firestore.js';

const db = getFirestore();
const BATCH_SIZE = 500;

async function backfill() {
    const snapshot = await db.collection('retailers')
        .where('status', '==', 'inactive')
        .get();

    const toBackfill = snapshot.docs.filter(doc => !doc.data().deleted_at);
    console.log(`Found ${toBackfill.length} retailers to backfill.`);

    for (let i = 0; i < toBackfill.length; i += BATCH_SIZE) {
        const batch = db.batch();
        toBackfill.slice(i, i + BATCH_SIZE).forEach(doc => {
            batch.set(doc.ref, {
                deleted_at: doc.data().updated_at || new Date().toISOString()
            }, { merge: true });
        });
        await batch.commit();
        console.log(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1}.`);
    }
    console.log('Backfill complete.');
}

backfill().catch(err => { console.error(err); process.exit(1); });
```

Same structure for `backfill-deleted-advertisers.js` targeting `status: 'suspended'`.

**Acceptance criteria:**
1. Script is idempotent — re-running it on an already-backfilled collection produces zero writes and exits 0.
2. After staging backfill: `db.collection('retailers').where('status', '==', 'inactive').where('deleted_at', '==', null).get()` → zero documents.
3. After staging backfill: all pre-sprint soft-deleted retailers are absent from `GET /api/retailers`.
4. After staging backfill: retailers intentionally deactivated post-sprint (PATCH toggle) still appear in list.
5. Script exits non-zero on any Firestore write failure.
6. Production backfill run only after staging backfill confirmed complete.

---

### S17-6 — Fix `PlaylistRepository.js` ACTIVE query (88%)

**Carried from RISK-S16-9. File:** `ad-server/src/repositories/PlaylistRepository.js`

**Pre-check:**
```bash
# Confirm both method names and query strings
grep -n "ACTIVE\|findActiveByScreen\|findGlobalPlaylist" \
  ad-server/src/repositories/PlaylistRepository.js

# Confirm playlist documents in staging have lowercase status
# (written post-S13 enum fix in playlists.js)
grep -rn "status.*playlist\|playlist.*status" ad-server/src --include="*.js"
```

**Change:** Replace `'ACTIVE'` with `'active'` in both query strings:

```js
// findActiveByScreen() — BEFORE
.where('status', '==', 'ACTIVE')

// AFTER
.where('status', '==', 'active')

// findGlobalPlaylist() — same change
```

**Playlist backfill script:** `ad-server/scripts/backfill-playlist-status.js`

Same pattern as S17-5: query `status == 'ACTIVE'`, write `status: 'active'` with merge, batched, idempotent. **Must run in staging before S17-6 is promoted to production** — otherwise `findActiveByScreen()` will query for `'active'` but old documents still hold `'ACTIVE'` and will return empty.

**Acceptance criteria:**
1. `grep "'ACTIVE'" ad-server/src/repositories/PlaylistRepository.js` → zero results.
2. `grep "'active'" ad-server/src/repositories/PlaylistRepository.js` → present in both `findActiveByScreen()` and `findGlobalPlaylist()`.
3. After staging backfill: `db.collection('playlists').where('status', '==', 'ACTIVE').get()` → zero documents.
4. After staging backfill: `findActiveByScreen(screenId)` returns the expected playlists for a screen with an active playlist.
5. S17-6 and backfill script in same commit or sequenced deploy with gate.
6. RISK-S16-9 closed in `DATABASE_SCHEMA.md` with reference to this sprint.

---

## 5. Isolation and Blast Radius

| Task | Files | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|
| S17-7 | `docs/DATABASE_SCHEMA.md` | EDIT — doc only | No | No | Markdown doc. Must precede S17-1/S17-2. |
| S17-1 | `RetailerRepository.js` | EDIT — additive field in `softDelete` | **Yes** | No — `deleted_at` is new; no existing caller reads it | `status: 'inactive'` unchanged. |
| S17-2 | `AdvertiserRepository.js` | EDIT — additive field in `softDelete` | **Yes** | No — same rationale as S17-1 | `status: 'suspended'` unchanged. |
| S17-3 | `retailers.js`, `advertisers.js`, `BaseRepository.js` | EDIT — filter added + 1-line comparator fix | **Yes** | **Yes — list responses change** | Filter is correct and intentional. Memory fix is backward-compatible. Single atomic commit. |
| S17-4 | `retailers.js`, `advertisers.js` | EDIT — additive 404 guard | **Yes** | No — non-deleted records unaffected | Purely additive. No performance impact. |
| S17-5 | `scripts/backfill-*.js` | CREATE | No | No | Standalone. Not imported by runtime. Explicit operational step. |
| S17-6 | `PlaylistRepository.js`, `scripts/backfill-playlist-status.js` | EDIT + CREATE | **Yes** | **Yes — playlist queries during migration window** | Atomic with backfill. Staging gate before production. |

### Cross-Cutting Risks

1. **Deactivate-vs-delete ambiguity for pre-existing `inactive` retailers (S17-5):** If Option A backfill is chosen incorrectly, legitimately-deactivated retailers will be hidden from the admin list. Admin must confirm intent before backfill runs. Document the decision in the `§ S17-5 Resolution` section below.

2. **`BaseRepository.js` memory-fallback `??` change (S17-3):** The `?? null` addition to the `==` comparator is backward-compatible by design, but it is a change to a shared foundational utility. Any other `findAll()` call using `==` with a concrete value (not null) is unaffected because `(value ?? null)` is `value` for all non-null, non-undefined values. Verify with the pre-check grep output.

3. **Playlist query miss window (S17-6):** Same dual-write risk pattern as S16-1. Between S17-6 deploy and backfill completion, playlists with uppercase `ACTIVE` status will be invisible to `findActiveByScreen()` and `findGlobalPlaylist()`. Screen scheduling may show no active playlists for affected screens. Mitigated by staging backfill gate.

---

## 6. File Inventory

| File | Operation | Linked Task(s) |
|---|---|---|
| `docs/DATABASE_SCHEMA.md` | EDIT | S17-7 |
| `ad-server/src/repositories/RetailerRepository.js` | EDIT | S17-1 |
| `ad-server/src/repositories/AdvertiserRepository.js` | EDIT | S17-2 |
| `ad-server/src/repositories/BaseRepository.js` | EDIT | S17-3 |
| `ad-server/src/api/retailers.js` | EDIT | S17-3, S17-4 |
| `ad-server/src/api/advertisers.js` | EDIT | S17-3, S17-4 |
| `ad-server/scripts/backfill-deleted-retailers.js` | CREATE | S17-5 |
| `ad-server/scripts/backfill-deleted-advertisers.js` | CREATE | S17-5 |
| `ad-server/src/repositories/PlaylistRepository.js` | EDIT | S17-6 |
| `ad-server/scripts/backfill-playlist-status.js` | CREATE | S17-6 |
| `current_sprint/sprint17.md` | CREATE | This document |

---

## 7. QA Test Cases

| # | Test | Steps | Expected Result |
|---|---|---|---|
| QA-1 | Delete retailer → refresh | Admin deletes retailer → confirms → refreshes page | Retailer absent from list |
| QA-2 | Delete advertiser → refresh | Admin deletes advertiser → confirms → refreshes page | Advertiser absent from list |
| QA-3 | Deactivate retailer (toggle) → refresh | Admin toggles retailer to inactive via status toggle → refreshes | Retailer still visible with Inactive badge |
| QA-4 | GET by ID — deleted retailer | `GET /api/retailers/:id` with a soft-deleted retailer ID | HTTP 404 |
| QA-5 | GET by ID — deleted advertiser | `GET /api/advertisers/:id` with a soft-deleted advertiser ID | HTTP 404 |
| QA-6 | GET by ID — active retailer | `GET /api/retailers/:id` with an active retailer ID | HTTP 200, full document |
| QA-7 | GET by ID — inactive (not deleted) retailer | `GET /api/retailers/:id` with a PATCH-deactivated retailer ID | HTTP 200, document returned |
| QA-8 | Delete retailer with linked stores/screens | Admin deletes retailer that has associated stores and screens | Stores and screens still exist; Firestore document for retailer persists with `deleted_at` set |
| QA-9 | Campaigns referencing deleted advertiser | Campaigns with `advertiser_id` pointing to a soft-deleted advertiser | Campaign documents unaffected; advertiser Firestore document intact |
| QA-10 | Pre-sprint ghost (post-backfill) | After S17-5 backfill, refresh admin retailers page | No pre-sprint soft-deleted retailers appear |

---

## 8. Definition of Done

- [ ] `docs/DATABASE_SCHEMA.md` updated with `deleted_at` field for `retailers` and `advertisers` before any code is merged (GUARDRAIL-8).
- [ ] `grep "deleted_at" ad-server/src/repositories/RetailerRepository.js` → present in `softDelete()`.
- [ ] `grep "deleted_at" ad-server/src/repositories/AdvertiserRepository.js` → present in `softDelete()`.
- [ ] `grep "(item\[field\] ?? null)" ad-server/src/repositories/BaseRepository.js` → present.
- [ ] `GET /api/retailers` in staging → no records with non-null `deleted_at` returned.
- [ ] `GET /api/advertisers` in staging → no records with non-null `deleted_at` returned.
- [ ] `GET /api/retailers/:id` for soft-deleted ID → HTTP 404.
- [ ] `GET /api/advertisers/:id` for soft-deleted ID → HTTP 404.
- [ ] Delete retailer → refresh → retailer absent from admin list. (QA-1 signed off.)
- [ ] Delete advertiser → refresh → advertiser absent from admin list. (QA-2 signed off.)
- [ ] Deactivate retailer (toggle) → refresh → retailer still visible with Inactive badge. (QA-3 signed off.)
- [ ] `BaseRepository.js`, `retailers.js`, and `advertisers.js` in same atomic commit for S17-3.
- [ ] `§ S17-5 Resolution` filled in: Option A or B chosen, reason documented, admin confirmation recorded if Option A selected.
- [ ] `ad-server/scripts/backfill-deleted-retailers.js` and `backfill-deleted-advertisers.js` exist, are idempotent, exit 0 in staging.
- [ ] After staging backfill: `db.collection('retailers').where('status', '==', 'inactive').where('deleted_at', '==', null).get()` → zero documents.
- [ ] Production backfill run only after staging backfill confirmed complete.
- [ ] `grep "'ACTIVE'" ad-server/src/repositories/PlaylistRepository.js` → zero results (S17-6).
- [ ] After playlist backfill in staging: `findActiveByScreen()` returns expected playlists. (S17-6.)
- [ ] RISK-S16-9 closed in `DATABASE_SCHEMA.md` with reference to Sprint 17.
- [ ] All 14 guardrails remain intact — no new violation introduced by any S17 commit.
- [ ] No new `NOT ON DISK` or `NOT CONFIRMED IN SOURCE` items remain unresolved at sprint close.

---

## § S17-5 Resolution

> **Pending** — to be filled in before backfill scripts are run.

```
Pre-existing inactive retailers reviewed: [ YES | NO ]
Count of retailers with status: 'inactive' and no deleted_at in staging: [ N ]
Admin confirmed all are intended deletions: [ YES | NO | PARTIAL ]

Backfill option chosen: [ A — backfill all inactive | B — conservative, manual review ]
Reason:
  [ to be filled before script execution ]

Backfill run in staging: [ DATE ]
Backfill run in production: [ DATE ]
Post-backfill QA-10 signed off: [ YES | NO ]
```

---

*Sprint 17 spec — authored 2026-06-08.*
*Grounded against HEAD `c61f82a`. 14 guardrails active.*
*Files read in full: `RetailerRepository.js`, `AdvertiserRepository.js`, `BaseRepository.js`, `retailers.js` (backend), `advertisers.js` (backend), `RetailerManagement.jsx`, `AdvertiserManagement.jsx`.*
*Root cause confirmed: design mismatch between soft-delete strategy and unfiltered list query. API writes correctly. Fix is backend-only (filter + deleted_at field). No frontend changes required beyond toast copy review.*
*Two genuine cross-cutting risks: deactivate-vs-delete ambiguity for pre-existing inactive retailers; playlist query miss window for S17-6.*
