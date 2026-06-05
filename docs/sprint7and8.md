# Sprint 7 & 8 — SRE/QA Grounded Plan
**Repo:** `cfroszte/softomedia-live2026`
**Author perspective:** Senior SRE + QA Lead
**Generated:** 2026-06-05
**Basis:** Live code audit of Player.jsx (15,479 bytes), LoopManagement.jsx (13,683 bytes), LoopBuilder.jsx (21,218 bytes), LoopAnalytics.jsx (22,891 bytes), ScheduleCalendar.jsx (14,241 bytes), ScheduleHistory.jsx (20,355 bytes), ScheduleManager.jsx (24,906 bytes), RetailerManagement.jsx (50,256 bytes), BrandCampaignWizard flow (Step1–Step5), MVP spec `docs/Digital Screen Network Management Platform (MVP).md`

---

## Critical Pre-Sprint Findings (SRE Flags)

> These are not tasks — they are **risks that could invalidate sprint work** if ignored.

| ID | Risk | Severity | File |
|----|------|----------|------|
| R1 | `Player.jsx` re-runs full `initializePlayer` on every hour change (dep array includes `currentHour`). This means re-registration every hour — potential screen ID churn and duplicate heartbeats | 🔴 HIGH | `Player.jsx` L91 |
| R2 | Loop fetch uses `/api/loops?date=...` returning ALL loops for the day, filtered client-side. At scale (100+ screens polling simultaneously on the hour) this is an N×full-dataset query with no pagination or scope filter | 🔴 HIGH | `Player.jsx` L45 |
| R3 | `initializePlayer` has no retry logic. A single network blip on startup sets `status='error'` permanently — screen goes dark with no recovery path | 🔴 HIGH | `Player.jsx` L128 |
| R4 | Approval status check (`l.status === 'APPROVED'`) is string-matched client-side only. Backend `LoopRepository` uses mixed-case status strings — confirm `'APPROVED'` vs `'approved'` is consistent or this silently fails | 🟡 MEDIUM | `Player.jsx` L53, `LoopRepository.js` |
| R5 | `ScheduleManager.jsx` (24,906 bytes) bulk-approve calls `/api/locations/:id/loops/approve-all` — endpoint marked FIXME/unconfirmed in commit message. If this 404s, no error is surfaced to the retailer | 🟡 MEDIUM | `ScheduleManager.jsx` |
| R6 | `TechOpsDashboard` audit log POSTs `user_id` from `localStorage` — this was flagged in the commit but localStorage is blocked in sandboxed iframes. Production env may differ but the pattern is fragile | 🟡 MEDIUM | `TechOpsDashboard.jsx` |
| R7 | `PlaylistEditor.jsx` (15,681 bytes) still exists in `pages/admin/` with no route. Dead code that imports and may reference services that have since changed — silent import-time errors possible in some bundlers | 🟢 LOW | `pages/admin/PlaylistEditor.jsx` |

---

## Sprint 7 — Playback Gate + Resilience + Content Compliance

**Goal:** Make the approval workflow actually gate broadcast (the core platform promise), harden Player against network failures, and add upload-time content validation.

**Duration estimate:** 3 days
**Risk level:** HIGH — Player.jsx touches production broadcast

---

### Task 7.1 — Fix Player re-registration on hour change

**File:** `client-app/src/pages/Player.jsx`
**Type:** Bug fix (SRE R1)
**Lines:** `useEffect` dep array at ~L91, `initializePlayer` function

**Problem:** `initializePlayer` is in a `useEffect` with `currentHour` in its dependency array. Every hour, the player re-registers the screen (`POST /api/screens/register`), re-fetches the loop, and resets state. This is architecturally wrong — registration should happen once on mount; loop switching should be a separate lighter operation.

**Fix:**
- Split into two effects: (1) `initializePlayer` runs once on mount — `[]` dep array, no `currentHour`. (2) `switchLoop` runs on `currentHour` change only — fetches new loop, calls `setCurrentLoop` and `setCurrentSlotIndex(0)`. No re-registration.
- Add a `hasInitialized` ref guard to prevent double-fire in React StrictMode.

**Hallucination risk:** `fetchCurrentLoop` is already defined as a `useCallback` at L39 but is also duplicated inline inside `initializePlayer` at L103–L116. Do not assume they are identical — read both before editing. The inline version does NOT call `fetchCurrentLoop`; it duplicates the logic.

**Verification:** After fix, simulate hour boundary in dev tools — confirm `POST /api/screens/register` fires exactly once on page load, not on hour tick.

---

### Task 7.2 — Add startup retry with exponential backoff

**File:** `client-app/src/pages/Player.jsx`
**Type:** Resilience (SRE R3)

**Problem:** Any network failure in `initializePlayer` (registration, loop fetch, playlist fetch) immediately sets `status='error'` with no recovery. A screen that boots during a brief API blip stays dark forever until manually refreshed.

**Fix:**
- Wrap `initializePlayer` in a retry loop: max 5 attempts, backoff `[2s, 4s, 8s, 16s, 30s]`.
- Add `status='retrying'` with attempt count displayed on screen.
- After max retries exhausted, attempt playlist-only fallback before setting `status='error'`.
- Do NOT retry the telemetry/heartbeat path — those already use `sendBeacon` which is fire-and-forget.

**Hallucination risk:** There is no existing retry utility in the codebase — do not import one that doesn't exist. Implement inline with `setTimeout` wrapped in a `for` loop or recursive async function.

**Verification:** Mock `fetch` to fail 3 times then succeed — confirm player reaches `playing` state on 4th attempt.

---

### Task 7.3 — Fix loop fetch scope (server-side filter)

**File:** `client-app/src/pages/Player.jsx` + **backend** `server/routes/loops.js`
**Type:** Performance / correctness (SRE R2)

**Problem:** Player fetches ALL loops for today (`/api/loops?date=2026-06-05`) and filters client-side for current hour and APPROVED status. Every screen does this every hour. At 100 screens, that's 100 full-day datasets per hour.

**Fix:**
- Add `hour` and `status` query params to the loops endpoint: `/api/loops?date=...&hour=...&status=APPROVED`
- Backend: `loops.js` — add `WHERE hour = ? AND status = ?` to the query if params are present (additive, backward-compatible)
- Player: update fetch URL to include `&hour=${hour}&status=APPROVED`

**Hallucination risk:** Do not assume `loops.js` uses a specific ORM. Read the file before editing — it may use raw SQL, Knex, Sequelize, or Mongoose. The fix must match the existing query pattern.

**FIXME marker to add:** `// FIXME: confirm 'APPROVED' case matches LoopRepository status enum` (SRE R4)

**Verification:** In dev, confirm response for `/api/loops?date=X&hour=Y&status=APPROVED` returns only matching loops, not full day.

---

### Task 7.4 — Offline fallback loop

**File:** `client-app/src/pages/Player.jsx`
**Type:** Feature (MVP §4.5)

**Problem:** When both loop fetch and playlist fetch fail (network down), player hits `status='error'` or `status='no_content'`. The MVP spec requires an "offline fallback loop" — a static set of assets that plays without network.

**Fix:**
- Define a `FALLBACK_SLOTS` constant at the top of `Player.jsx` — array of 12 objects with hardcoded public asset URLs (Softomedia branding/placeholder images, or a `data:` URI SVG).
- In `initializePlayer`, after all retries exhausted: `setCurrentLoop({ id: 'fallback', hour: null, slots: FALLBACK_SLOTS })`, `setPlaybackMode('loop')`, `setStatus('playing')`.
- Add a visible `data-testid="fallback-mode-banner"` overlay in the player UI when `currentLoop.id === 'fallback'`.
- Heartbeat continues during fallback — the screen is "online" even if content is fallback.

**Hallucination risk:** Do not reference an existing `FALLBACK_PLAYLIST` or `DEFAULT_CONTENT` constant — there is none. Check `config.js` first to see if a fallback URL is defined there before hardcoding.

**Verification:** Disconnect network in DevTools → confirm player switches to fallback loop within one retry cycle, heartbeats continue.

---

### Task 7.5 — Content spec validation on asset upload

**File:** Asset upload component (locate via `grep -r "upload" client-app/src --include="*.jsx" -l`)
**Type:** Feature (MVP §4.4)

**Problem:** The spec mandates MP4/JPG/PNG only, fixed 5s duration, resolution enforcement. Currently no client-side validation exists on upload.

**Fix:**
- On file input `change` event: check `file.type` against `['video/mp4', 'image/jpeg', 'image/png']` — reject others immediately with inline error.
- For MP4: use `<video>` element with `onloadedmetadata` to read `duration` — if `duration > 5.5s`, reject with message "Video must be exactly 5 seconds".
- For images: use `<img>` with `onload` to read `naturalWidth × naturalHeight` — warn (not block) if not matching expected screen resolution.
- Do NOT block on resolution mismatch — warn only, per "automatic rejection" being a backend concern.

**Hallucination risk:** The upload component path is UNKNOWN — it must be located via grep before editing. Do not assume it is `AssetUpload.jsx` or `MediaUpload.jsx`. It may be embedded inside `AdvertiserManagement.jsx` (36,181 bytes) or `RetailerManagement.jsx` (50,256 bytes).

**Verification:** Attempt to upload a 10s MP4 — confirm rejection. Upload a valid 5s MP4 — confirm passes. Upload a `.gif` — confirm rejection.

---

### Task 7.6 — Surface approval status in LoopManagement grid

**File:** `client-app/src/pages/admin/LoopManagement.jsx` (13,683 bytes)
**Type:** UX / observability

**Problem:** Admin has no at-a-glance view of which loops are APPROVED vs PENDING vs REJECTED. Player silently skips unapproved loops — if all loops for an hour are pending, screens fall back to playlist with no admin alert.

**Fix:**
- Add `StatusBadge` component (already exists in `LoopBuilder.jsx` — import from there or extract to `components/StatusBadge.jsx`).
- In the loop grid row, render badge next to the hour: `APPROVED` (green), `PENDING` (amber), `REJECTED` (red), `DRAFT` (grey).
- Add a warning banner at the top of the page if any loop for today's remaining hours has status !== `APPROVED`.

**Hallucination risk:** `StatusBadge` component — verify it is exported from `LoopBuilder.jsx` before importing. It may be defined locally/inline only. If not exported, extract it to `src/components/StatusBadge.jsx` first.

**Verification:** Create a loop in PENDING status — confirm badge shows amber in grid and warning banner appears.

---

### Task 7.7 — Fix docs: changelog.md + MVP_SPRINT_PLAN.md

**Files:** `docs/changelog.md`, `docs/MVP_SPRINT_PLAN.md`
**Type:** Documentation debt

**changelog.md:** Append entries for:
- Sprint 5 (LoopAnalytics hardened, mock data removed, CSV export)
- Sprint 6 (ScheduleHistory wired, ScheduleManager D-1 workflow, TechOpsDashboard)
- Sprint 7 (playback gate, retry resilience, fallback loop, content validation)

**MVP_SPRINT_PLAN.md:** Reconcile:
- Sprint 3: `ScheduleCalendar.jsx` DOES exist (14,241 bytes) — Sprint 3 claim is valid. Update note to clarify `ScheduleManager.jsx` and `ScheduleHistory.jsx` are Sprint 6 additions, not replacements.
- Sprint 5 route: plan says `/admin/analytics`, actual route is `/dashboard/admin/loop-analytics` — correct the plan.
- Sprint 6: mark tests as UNVERIFIED — spec files not confirmed in commit history.

**Hallucination risk:** Do not assume `changelog.md` exists or has a specific format. Check if the file exists at `docs/changelog.md` before writing. It may not exist yet.

**Verification:** Both files committed, no broken markdown table syntax.

---

### Task 7.8 — Delete PlaylistEditor.jsx

**File:** `client-app/src/pages/admin/PlaylistEditor.jsx` (15,681 bytes)
**Type:** Dead code removal (SRE R7)

**Verification pre-conditions (must ALL pass before delete):**
1. `grep -r "PlaylistEditor" client-app/src --include="*.jsx" --include="*.js" --include="*.ts"` → zero results outside the file itself
2. `grep -r "PlaylistEditor" client-app/src --include="*.jsx" App.jsx` → not in route list
3. No open PR referencing this file

**Hallucination risk:** Do not assume it is unrouted because earlier audits said so — re-run the grep at delete time. The codebase changes between sessions.

---

## Sprint 8 — Campaign Handoff + Retailer Constraints + Billing Stub

**Goal:** Close the campaign-to-retailer validation handoff (currently campaigns are created but never formally submitted for validation), add basic retailer content category controls, and add an invoice/summary stub for advertisers.

**Duration estimate:** 3 days
**Risk level:** MEDIUM — touches BrandCampaignWizard (multi-step form) and RetailerManagement (50,256 bytes — largest file in project)

---

### Task 8.1 — Add "Submit for Validation" step to BrandCampaignWizard

**Files:** `client-app/src/pages/brand/BrandCampaignWizard.jsx` + Step5ReviewConfirm.jsx
**Type:** Feature (MVP §3.3, §4.3)

**Problem:** The wizard ends at Step 5 (Review & Confirm) which creates the campaign. But the MVP spec requires campaigns to be explicitly "submitted for retailer validation" — a handoff state where the retailer can see it in their ScheduleManager. Currently a created campaign has no `pendingValidation` status transition.

**Fix:**
- After `POST /api/campaigns` succeeds in Step 5, fire a second call: `PATCH /api/campaigns/:id/status` with `{ status: 'PENDING_VALIDATION' }`.
- Add a Step 6 confirmation screen (not a new wizard step — a success overlay): "Campaign submitted for retailer validation. You'll be notified once approved."
- `FIXME`: Backend `PATCH /api/campaigns/:id/status` endpoint may not exist — add a 404 guard and log a warning without blocking the campaign creation success state.

**Hallucination risk:** Do not assume the campaign create endpoint returns the new campaign ID in a specific field. Read `Step5ReviewConfirm.jsx` to find the actual API call and response shape before writing the PATCH call.

**Verification:** Create a test campaign → confirm it appears in ScheduleManager with status `PENDING_VALIDATION`. Confirm Step 5 success state is not broken if the PATCH 404s.

---

### Task 8.2 — Retailer content category exclusions

**File:** `client-app/src/pages/admin/RetailerManagement.jsx` (50,256 bytes)
**Type:** Feature (MVP §3.2)

**Problem:** The spec states retailers can "define local content constraints (categories allowed/excluded)." No such UI exists. This is critical for retailers who may not want competitor advertising or age-restricted content.

**Fix:**
- In the retailer edit modal/form (locate the edit form inside `RetailerManagement.jsx`), add a multi-select or tag input for "Excluded Content Categories".
- Categories list: `['alcohol', 'gambling', 'competitor', 'political', 'adult', 'food & beverage', 'automotive', 'finance']` — hardcoded for MVP.
- On save, include `excluded_categories: string[]` in the `PATCH /api/retailers/:id` payload.
- `FIXME`: Backend retailer schema must accept `excluded_categories` — add a note that this field needs backend migration if not present.

**Hallucination risk:** `RetailerManagement.jsx` is 50,256 bytes — the largest file in the project. Do not read and rewrite the whole file. Locate the specific edit form section via grep before editing. Only touch the relevant block.

**Verification:** Save exclusions for a retailer → verify they persist (GET retailer returns `excluded_categories`). Confirm LoopGenerationService excludes matching campaign categories when generating loops for that retailer.

---

### Task 8.3 — Wire category exclusions into LoopGenerationService

**File:** `server/services/LoopGenerationService.js`
**Type:** Feature (backend, companion to 8.2)

**Problem:** Even if category exclusions are saved per retailer, `LoopGenerationService` doesn't read them when generating loops — so excluded campaigns still appear in generated slots.

**Fix:**
- In the loop generation function, after fetching available campaigns, add a filter step: remove any campaign whose `category` is in the retailer's `excluded_categories` array.
- Fetch retailer `excluded_categories` at generation time via `LoopRepository` or a direct DB call.
- If `excluded_categories` field doesn't exist in the DB schema yet, add a null-safe fallback: `const excluded = retailer.excluded_categories || []`.

**Hallucination risk:** Do not assume the function name `generateLoopsForDate` — read the file first. Also do not assume campaign objects have a `category` field — verify the campaign schema in `DATABASE_SCHEMA.md` or the actual DB model before writing the filter.

**Verification:** Seed a campaign with `category: 'alcohol'`, set retailer exclusion to `['alcohol']`, generate loops → confirm no alcohol campaign appears in any slot.

---

### Task 8.4 — Advertiser invoice/campaign summary stub

**File:** `client-app/src/pages/brand/CampaignSummary.jsx` (new file)
**Type:** Feature stub (MVP §3.4)

**Problem:** The spec requires advertisers to "access invoices and campaign summaries." Currently no such view exists.

**Fix:**
- Create `client-app/src/pages/brand/CampaignSummary.jsx`.
- Display: Campaign name, status badge, date range, location count, total slots booked, estimated impressions (from `pricingService` — already used in Step5).
- Invoice section: static placeholder — "Invoice will be generated upon campaign completion. Contact billing@softomedia.com."
- Add route in `App.jsx`: `brand/campaigns/:id/summary`.
- Add "View Summary" button in brand dashboard (locate `BrandDashboard.jsx` — verify it exists before editing).

**Hallucination risk:** `BrandDashboard.jsx` — verify path before editing. Do not assume its internal structure.

**Verification:** Navigate to `/dashboard/brand/campaigns/test-id/summary` → renders without crash. Campaign data displays correctly. Invoice section shows placeholder.

---

### Task 8.5 — Confirm/fix bulk-approve backend endpoint

**File:** `server/routes/` (locate loops or locations route file) + `client-app/src/pages/retailer/ScheduleManager.jsx`
**Type:** Bug fix / backend gap (SRE R5)

**Problem:** `ScheduleManager.jsx` calls `POST /api/locations/:id/loops/approve-all` but this endpoint has a live FIXME comment suggesting it may not be fully implemented. If it 404s, the retailer gets no feedback.

**Fix (frontend):**
- Wrap the `approve-all` fetch in a try/catch with explicit 404 detection.
- On 404: show inline error "Bulk approval not yet available — please approve slots individually."

**Fix (backend — if endpoint missing):**
- Add `POST /locations/:id/loops/approve-all` to the appropriate route file.
- Logic: find all loops for `location_id` and `date` (from body) with status `PENDING` → set all to `APPROVED` → return count.

**Hallucination risk:** The endpoint may already be working. Before adding a new endpoint, run `grep -r "approve-all" server/` to check if it exists.

**Verification:** POST to endpoint with valid location + date → returns `{ approved: N }`. Frontend shows success count.

---

### Task 8.6 — Per-slot rejection comment persistence check

**File:** `client-app/src/pages/retailer/ScheduleManager.jsx` + `ScheduleHistory.jsx`
**Type:** Bug verification

**Problem:** Per-slot rejection with comment calls `POST /api/loops/:loopId/reject` with `{ reason }`. Verify this endpoint actually persists the reason and that it's retrievable in `ScheduleHistory.jsx`.

**Fix (if not persisting):**
- Confirm backend stores `rejection_reason` on the loop/slot record.
- In `ScheduleHistory.jsx`, display `rejection_reason` in the activity log when event type is `loop_rejected`.

**Hallucination risk:** Do not assume `rejection_reason` is returned in the loops GET response — check the actual API response shape in `ScheduleHistory.jsx` to see what fields are consumed.

**Verification:** Reject a slot with reason "Wrong brand" → navigate to Schedule History → confirm reason appears in the log.

---

## Vulnerability Register

| ID | Type | Location | Description | Fix Sprint |
|----|------|----------|-------------|------------|
| V1 | Information disclosure | `Player.jsx` debug overlay | `data-testid="ad-debug-overlay"` renders loop hour, slot position, duration on-screen in production | Sprint 7 |
| V2 | Auth bypass risk | `Player.jsx` L74 | `screen_id` read from `?screen_id=` URL param with fallback to `'demo-screen-01'`. Any browser can register as an arbitrary screen | Sprint 7 |
| V3 | Unvalidated redirect | `Player.jsx` asset URL | `slot.url` used directly without validation — compromised backend could inject `javascript:` URI | Sprint 7 |
| V4 | CSRF exposure | `ScheduleManager.jsx` approve/reject | POST calls use no CSRF token | Sprint 8 |
| V5 | localStorage fragility | `TechOpsDashboard.jsx` | `user_id` from `localStorage` — blocked in sandboxed iframes | Sprint 7 |
| V6 | No rate limiting | `Player.jsx` heartbeat | Heartbeat every 30s × N screens with no 429 backoff | Sprint 8 |

---

## Hallucination Risk Summary

| Task | Risk | Mitigation |
|------|------|-----------|
| 7.1 | `fetchCurrentLoop` and inline loop logic assumed identical — they are NOT | Read both before editing |
| 7.3 | `loops.js` ORM assumed — unknown until file is read | Read `server/routes/loops.js` first |
| 7.5 | Upload component filename assumed — it is UNKNOWN | Grep `client-app/src` for file input patterns first |
| 8.2 | Edit form structure in 50KB `RetailerManagement.jsx` assumed | Grep for form/modal section, edit minimally |
| 8.3 | Function name in `LoopGenerationService.js` assumed | Read file header before writing |
| 8.3 | Campaign `category` field assumed to exist | Check `DATABASE_SCHEMA.md` first |
| 8.4 | `BrandDashboard.jsx` existence and structure assumed | Verify path via directory listing |
| 8.5 | `approve-all` endpoint assumed missing | `grep -r "approve-all" server/` first |

---

## Definition of Done

**Sprint 7 complete when:**
- [ ] Player re-registration bug fixed (7.1) — verified by network log
- [ ] Startup retry confirmed working (7.2) — verified by mock failure test
- [ ] Loop fetch scoped to hour+status (7.3) — verified by API response
- [ ] Offline fallback loop plays when network down (7.4) — verified by DevTools network block
- [ ] Asset upload rejects non-MP4/JPG/PNG and >5s video (7.5) — verified manually
- [ ] LoopManagement shows approval status badges (7.6) — verified by visual check
- [ ] changelog.md and MVP_SPRINT_PLAN.md updated (7.7) — committed
- [ ] PlaylistEditor.jsx deleted with grep pre-check passed (7.8) — committed

**Sprint 8 complete when:**
- [ ] Campaign status transitions to PENDING_VALIDATION after wizard submit (8.1)
- [ ] Retailer category exclusions save and display (8.2)
- [ ] LoopGenerationService respects category exclusions (8.3) — verified by seed test
- [ ] CampaignSummary.jsx renders at route (8.4)
- [ ] Bulk approve endpoint confirmed working or 404 handled gracefully (8.5)
- [ ] Rejection reason visible in ScheduleHistory (8.6)
