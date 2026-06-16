# Sprint 22 — CampaignWizard Creation Modal, Firestore Index Deploy, and Backfill Execution

**Sprint:** 22
**Status:** Planned
**Spec authored:** 2026-06-16
**Grounded against:** HEAD [`f384e34`](https://github.com/cfroszte/softomedia-live2026/commit/f384e348656f59231e937a097388587df84523be)
**Guardrails active:** 15 (GUARDRAIL-1 through GUARDRAIL-15)
**Carry-forward sources:** `current_sprint/sprint21.md` (S21-5 deferred, S21-4 index deploy deferred, S21-1 execution deferred)

---

## Active Guardrails

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
- **GUARDRAIL-15** — Soft-delete semantics: any soft-delete must write a `deleted_at` marker. List and detail endpoints must filter on `deleted_at`. Status field alone is not a deletion signal.

---

## Carry-Forward Summary

All three S22 tasks were explicitly deferred from S21 for distinct reasons. None are regressions — the system is stable at HEAD. These are the final items needed to close the S17–S21 soft-delete and campaign flow arc.

| Deferred From | Task | Why Deferred |
|---|---|---|
| S21-5 | CampaignWizard creation modal (S22-1) | Frontend build work; out of scope for S21 backend-hardening sprint |
| S21-4 | Firestore composite index deploy (S22-2) | Requires ops deploy window; index change touches live Firestore project |
| S21-1 | Backfill script execution (S22-3) | Requires scheduled ops window + human sign-off on data counts before production |

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S22-1 | `CampaignManagement.jsx` currently has no creation modal. `ApiService.getRetailersForCampaign()` is wired (S21-5) but no UI calls it yet. Campaign creation is not possible from the frontend. | Frontend | 🔴 Must resolve this sprint | `e10e6e1` commit message explicitly defers creation modal to S22 |
| RISK-S22-2 | `GET /api/retailers?for=campaign` runs a Firestore compound query (`deleted_at == null AND status == 'active'`). Without a composite index, this query will fail or cause a full collection scan under production load. | Backend / Infra | 🔴 Must deploy before `?for=campaign` goes live | S21-4 commit `7cde389` names this caveat explicitly |
| RISK-S22-3 | Pre-S17 ghost records (retailers/advertisers soft-deleted before S17 deploy, missing `deleted_at`) remain in Firestore. Backfill scripts are written and staged but not yet executed. No regression is active — ghosts do not currently reappear — but data hygiene is unresolved. | Data | 🟡 No regression; schedule ops window | `backfill-deleted-retailers.js`, `backfill-deleted-advertisers.js` on `main` |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation |
|---|---|---|---|
| SEC-S22-1 | If `?for=campaign` endpoint is called before the composite index is deployed, Firestore SDK may return an unfiltered result set (SDK version dependent) or throw. Either outcome is a functional or data-exposure bug. | `retailers.js` GET / | Deploy index (S22-2) before any production traffic hits `?for=campaign`. |

---

## 3. Task Map

| Task | Files Touched | Change Type | Effort | Biggest Risk |
|---|---|---|---|---|
| S22-1 | `client-app/src/…/CampaignManagement.jsx` (or new modal component) | CREATE/EDIT — frontend modal | 4pts | CampaignWizard source must be read in full before writing (GUARDRAIL-9) |
| S22-2 | `firestore.indexes.json` | EDIT — index declaration + deploy | 1pt | Must deploy to staging first; production deploy requires firebase CLI access |
| S22-3 | None (ops execution only) | RUN — backfill scripts against live Firestore | 1pt | Irreversible if Option A backfills legitimate deactivations; confirm counts before production run |

**Recommended execution order:**
1. **S22-2** — Deploy composite index first. `?for=campaign` is already in production code; the index must precede any load.
2. **S22-3** — Run backfill scripts in staging → confirm counts → run in production.
3. **S22-1** — Build the CampaignWizard modal last; it depends on `?for=campaign` being fully operational (S22-2 done) and the retailer list being clean (S22-3 done).

---

## 4. Full Task Details

### S22-1 — CampaignWizard Creation Modal (Frontend) (88% — provisional until source read)

**Context:** `POST /api/campaigns` (backend) is correct and guarded since S11. `ApiService.getRetailersForCampaign()` is wired to `GET /api/retailers?for=campaign` (S21-5). The missing piece is the React creation UI in `CampaignManagement.jsx` — currently no modal or form exists that calls these.

**Pre-read required before any code is written (GUARDRAIL-9):**
```bash
find client-app/src -name "CampaignManagement*" -o -name "CampaignWizard*" 2>/dev/null
```

Read the file in full. Then assess:

| Check | What to Look For |
|---|---|
| Existing modal scaffold | Is there a commented-out or disabled creation modal? |
| Retailer dropdown | Is `getRetailersForCampaign()` called anywhere, or only `getRetailers()`? |
| `POST /api/campaigns` payload shape | Does the expected body match `campaigns.js` L96 (`advertiser_id`, `status`, `start_date`, `end_date`, `budget`, `screen_type`)? |
| Date range fields | Are `start_date` / `end_date` bound correctly — same value submitted and displayed? |
| API error surfacing | Does the submit path display API 400/422/500 responses inline, or swallow them silently? |
| Confirm button state | Is the confirm/submit button disabled by validation state that doesn't surface a user-visible error? |

**Implementation requirements:**

1. **Retailer dropdown** — populated from `ApiService.getRetailersForCampaign()`. Must not call the unfiltered `getRetailers()`. Show retailer `name` and `id`. Empty state: "No active retailers available."
2. **Date range** — `start_date` and `end_date` fields. Client-side validation: start < end, start ≥ today. Dates displayed in campaign list must match what was submitted.
3. **API error surfacing** — any non-2xx response from `POST /api/campaigns` must display an inline error message. Do not disable the submit button without a visible explanation.
4. **Success path** — on 201 response, close modal and refresh campaign list. Display the new campaign in the list immediately (optimistic update or refetch).
5. **`advertiser_id` source** — must come from `req.user` (JWT) on the backend (already the case in `campaigns.js`). The frontend should not pass `advertiser_id` explicitly if the backend derives it from the token — confirm during source read.

**Acceptance criteria:**
1. User can open a "Create Campaign" modal from `CampaignManagement.jsx`.
2. Retailer dropdown shows only `status='active'`, non-deleted retailers (sourced from `getRetailersForCampaign()`).
3. Date range validation prevents start ≥ end and start < today on the client side.
4. API validation errors (400) are displayed inline — submit button is never silently disabled.
5. On success: modal closes, new campaign appears in the list with correct retailer name and date range.
6. E2E happy path: select Test Retailer A → pick valid date range → submit → campaign appears in list.
7. No hardcoded API URLs (GUARDRAIL-6).

---

### S22-2 — Firestore Composite Index Deploy for `?for=campaign` (99%)

**Context:** `GET /api/retailers?for=campaign` (added in S21-4, commit `7cde389`) runs:
```js
where('deleted_at', '==', null),
where('status',     '==', 'active')
```
Firestore requires a declared composite index for compound queries on different fields. Without it, the Firestore SDK throws `FAILED_PRECONDITION` in production (or in strict emulator mode). The index row is documented in `DATABASE_SCHEMA.md` (S21-7) but the `firestore.indexes.json` declaration and deploy are outstanding.

**Pre-check:**
```bash
cat firestore.indexes.json | grep -A5 '"collectionGroup": "retailers"'
```

If the `retailers` composite index entry is absent, add it following the S16 pattern:

```json
{
  "collectionGroup": "retailers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "deleted_at", "order": "ASCENDING" },
    { "fieldPath": "status",     "order": "ASCENDING" }
  ]
}
```

**Deploy sequence:**
1. Add entry to `firestore.indexes.json`.
2. Deploy to **staging**: `firebase deploy --only firestore:indexes --project <staging-project-id>`
3. Wait for index to build (Firestore console → Indexes tab → status = "Enabled").
4. Run: `curl "https://<staging-host>/api/retailers?for=campaign"` → confirm 200 and active-only results.
5. Deploy to **production**: `firebase deploy --only firestore:indexes --project <prod-project-id>`
6. Confirm production index builds successfully.

**Acceptance criteria:**
1. `firestore.indexes.json` contains a composite index entry for `retailers: [deleted_at ASC, status ASC]`.
2. Staging `?for=campaign` returns 200 with correct filtered results after index build.
3. Production `?for=campaign` returns 200 with no `FAILED_PRECONDITION` errors in Firestore logs.
4. Existing index entries are unchanged — no regressions on `invoices` or `loops` indexes.

---

### S22-3 — Backfill Script Execution (Ops) (95%)

**Context:** Three backfill scripts are on `main` and are idempotent, batched, and documented. They have not been run against staging or production. Pre-S17 ghost records (retailers/advertisers soft-deleted before S17 code deployed, carrying no `deleted_at` field) remain in Firestore. No active regression is present — the API correctly excludes them — but the data hygiene gap means Firestore documents exist that the API treats inconsistently from their intended deletion state.

**Execution protocol:**

#### Step 1 — Staging run

```bash
# From ad-server/
node scripts/backfill-deleted-retailers.js   2>&1 | tee backfill-retailers-staging.log
node scripts/backfill-deleted-advertisers.js 2>&1 | tee backfill-advertisers-staging.log
node scripts/backfill-playlist-status.js     2>&1 | tee backfill-playlists-staging.log
```

After each script exits 0:
```js
// Firestore console query — expected: 0 results each
db.collection('retailers').where('status', '==', 'inactive').where('deleted_at', '==', null).get()
db.collection('advertisers').where('status', '==', 'suspended').where('deleted_at', '==', null).get()
db.collection('playlists').where('status', '==', 'ACTIVE').get()
```

#### Step 2 — Record counts before production run

Before running in production, record:

| Metric | Value |
|---|---|
| Retailers updated in staging | TBD |
| Advertisers updated in staging | TBD |
| Playlists updated in staging | TBD |
| Expected production record count (approximate) | TBD |

If production count is significantly higher than staging count, pause and investigate before proceeding.

#### Step 3 — Production run

```bash
NODE_ENV=production node scripts/backfill-deleted-retailers.js   2>&1 | tee backfill-retailers-prod.log
NODE_ENV=production node scripts/backfill-deleted-advertisers.js 2>&1 | tee backfill-advertisers-prod.log
NODE_ENV=production node scripts/backfill-playlist-status.js     2>&1 | tee backfill-playlists-prod.log
```

Retain all `.log` files as audit artifacts.

**Strategy reminder (Option A — as documented in script headers):**
- All `status='inactive'` retailers with no `deleted_at` → backfilled as ghost records.
- All `status='suspended'` advertisers with no `deleted_at` → backfilled as ghost records.
- If your dataset contains pre-S17 intentional deactivations that must NOT receive `deleted_at`, switch to Option B before running and update `DATABASE_SCHEMA.md`.

**Acceptance criteria:**
1. All three scripts exit 0 in staging.
2. Post-staging Firestore queries return zero ghost records.
3. `GET /api/retailers` and `GET /api/advertisers` in staging return the same active records as before the backfill (no false-positive exclusions).
4. Production scripts exit 0.
5. Post-production Firestore queries return zero ghost records.
6. Log files retained as audit artifacts and linked in the sprint retrospective.

---

## 5. File Inventory

| File | Operation | Task(s) |
|---|---|---|
| `client-app/src/…/CampaignManagement.jsx` (path TBC — confirm via find) | EDIT — add creation modal | S22-1 |
| `client-app/src/…/CampaignWizard.jsx` (if separate component) | EDIT/CREATE | S22-1 |
| `firestore.indexes.json` | EDIT — add retailers composite index entry | S22-2 |
| `docs/DATABASE_SCHEMA.md` | EDIT — confirm index deployed, add backfill run dates | S22-2, S22-3 |
| None (ops execution only) | RUN — backfill scripts | S22-3 |

**Already confirmed DONE — no action required in S22:**
- `RetailerRepository.js`, `AdvertiserRepository.js`, `BaseRepository.js` — all soft-delete logic correct (S17).
- `retailers.js`, `advertisers.js` — list/detail filters, PATCH allowlist, role decision, `?for=campaign` branch (S21).
- `ApiService.getRetailersForCampaign()` — wired to `?for=campaign` (S21-5).
- All backfill scripts — written, idempotent, documented (S21-1).
- `DATABASE_SCHEMA.md` — S21 decisions documented (S21-7).

---

## 6. Non-Blocking Dependency Map

| Task | Blocks | Blocked By | Note |
|---|---|---|---|
| **S22-2** (index deploy) | S22-1 (modal goes live under load) | Nothing (code already merged) | ⚠️ Must deploy before S22-1 ships to production |
| **S22-3** (backfill execution) | S22-1 (clean retailer list for modal) | S22-2 (preferred but not hard dependency) | 🟡 Run after index is confirmed stable |
| **S22-1** (modal) | Sprint close (GUARDRAIL-13) | S22-2, S22-3 (soft deps — modal works without them but retailer list may be dirty) | ⚠️ Build last; depends on scheduler endpoint being fully operational |

**Recommended execution order:**
1. **S22-2** — Index deploy (blocking safety item).
2. **S22-3** — Backfill execution (data hygiene; clean up before UI exposes retailer list).
3. **S22-1** — CampaignWizard modal (end-user feature; build on clean infrastructure).

---

## 7. Test Stabilization Order

1. **Index verification** — after S22-2 index builds. `GET /api/retailers?for=campaign` returns 200 in staging and production with no Firestore errors.
2. **Post-backfill data check** — after S22-3. Confirm zero ghost records via Firestore console queries.
3. **CampaignWizard modal unit tests** — after S22-1 component is built. Retailer dropdown, date validation, error states.
4. **E2E happy path** — after all three tasks complete. Admin → seed Test Retailer A → scheduler picks it up via `?for=campaign` → Campaign Wizard modal → confirm → campaign appears in list.

---

## 8. Definition of Done

### Infrastructure
- [ ] `firestore.indexes.json` has composite index entry for `retailers: [deleted_at ASC, status ASC]`.
- [ ] Index deployed to staging; status = "Enabled" in Firestore console.
- [ ] Index deployed to production; `GET /api/retailers?for=campaign` returns 200 with no `FAILED_PRECONDITION` errors.

### Data hygiene
- [ ] `backfill-deleted-retailers.js` exits 0 in staging and production.
- [ ] `backfill-deleted-advertisers.js` exits 0 in staging and production.
- [ ] `backfill-playlist-status.js` exits 0 in staging and production.
- [ ] Post-run Firestore queries return zero ghost records in both environments.
- [ ] Log files retained as audit artifacts.
- [ ] `DATABASE_SCHEMA.md` updated with backfill run dates and record counts.

### CampaignWizard modal
- [ ] "Create Campaign" modal accessible from `CampaignManagement.jsx`.
- [ ] Retailer dropdown sourced from `getRetailersForCampaign()` — active, non-deleted retailers only.
- [ ] Date range validation: start < end, start ≥ today.
- [ ] API errors (400/500) displayed inline — no silent submit button disable.
- [ ] On success: modal closes, campaign appears in list with correct data.
- [ ] E2E happy path passes: Test Retailer A → valid date range → submit → campaign in list.
- [ ] No hardcoded API URLs (GUARDRAIL-6).
- [ ] `DATABASE_SCHEMA.md` and `API_ROUTES.md` updated if any new route or field shape is introduced (GUARDRAIL-7, GUARDRAIL-8).
- [ ] All 15 guardrails intact; no new violation introduced by any S22 commit.
- [ ] No carry-over risk left without a resolution sprint assigned (GUARDRAIL-14).

---

*Sprint 22 spec — authored 2026-06-16.*
*Grounded against HEAD `f384e34`. Carry-forward items explicitly deferred from S21 (commits `e10e6e1`, `7cde389`, `3b2a732`).*
*15 guardrails active — inherited from S21.*
