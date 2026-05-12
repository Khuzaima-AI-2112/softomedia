<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# create a sprint plan to fix the remaining bugs

Now I have everything needed. Here is the remediation sprint plan scoped exclusively to the remaining unfixed and partially fixed bugs.

***

# Softomedia Live 2026 — Bug Remediation Sprint Plan

**Scope:** 10 remaining issues (4 ❌ Not Fixed · 5 ⚠️ Partial · 1 unverified)
**Stack:** React 18 + Vite 5 · Express.js · Firestore · Zustand
**Test Framework:** Playwright (E2E) · Jest (unit)[^1]
**Repo:** [cfroszte/softomedia-live2026](https://github.com/cfroszte/softomedia-live2026)

***

## Sprint A — IAM Write Path Defects (Week 1)

### Goal

Close the two remaining partial bugs in the user management write path: the `superadmin` role being locked out of `GET /api/users`, and deleted users staying visible in the table after soft-delete.

### In-Scope

| ID | Summary | Type |
| :-- | :-- | :-- |
| BUG-02 | `GET /api/users` blocks `superadmin` with 403 | ⚠️ Partial |
| BUG-03 | Deleted users remain in table after soft-delete | ⚠️ Partial |

### Files to Change

| File | Change Required |
| :-- | :-- |
| [`ad-server/src/api/users.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/ad-server/src/api/users.js) | Line: `requireRole(['admin'])` → `requireRole(['admin', 'superadmin'])` on the `GET /` route |
| [`client-app/src/pages/admin/UserManagement.jsx`](https://github.com/cfroszte/softomedia-live2026/blob/main/client-app/src/pages/admin/UserManagement.jsx) | Add `.filter(u => u.status !== 'inactive')` before `.map()` in the table render |

### Defined Tests

**File:** `tests/users_crud.spec.js`[^1]

```
TEST: superadmin can list all users
  GIVEN: logged in as superadmin
  WHEN:  navigate to /dashboard/admin/users
  THEN:  GET /api/users returns 200 (not 403)
  AND:   user rows are visible in the table

TEST: deleted user row is removed from table immediately
  GIVEN: Users table has user "Delete Me"
  WHEN:  trash icon clicked → confirm
  THEN:  row for "Delete Me" disappears from the table
  AND:   row does NOT reappear on re-render without hard refresh
  AND:   Firestore document status = 'inactive'
```


### Sprint A Exit Gate

- [ ] `GET /api/users` returns `200` when authenticated as `superadmin`
- [ ] New user created by `superadmin` appears in table immediately after submission
- [ ] Deleted user row is absent from the table without requiring a page refresh
- [ ] `users_crud.spec.js` passes all cases

***

## Sprint B — Soft-Delete Data Integrity (Week 1)

### Goal

Replace the hard-delete in `BaseRepository` for Retailers and Advertisers with a true soft-delete (`status: 'inactive'`) to protect referential integrity for campaigns, loops, and screens.

### In-Scope

| ID | Summary | Type |
| :-- | :-- | :-- |
| BUG-05 | Remove Retailer performs hard-delete | ⚠️ Partial |
| BUG-08 | Remove Advertiser performs hard-delete | ⚠️ Partial |

### Files to Change

| File | Change Required |
| :-- | :-- |
| [`ad-server/src/repositories/BaseRepository.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/ad-server/src/repositories/BaseRepository.js) | Override `delete()` in `RetailerRepository` and `AdvertiserRepository` to `PATCH status: 'inactive'` instead of destroying the document |
| `ad-server/src/api/retailers.js` | Ensure `DELETE /api/retailers/:id` calls soft-delete, returns `200` with `{ status: 'inactive' }` |
| `ad-server/src/api/advertisers.js` | Same as above for advertisers |

### Defined Tests

**File:** `tests/retailer_validation.spec.js` · `tests/advertiser_crud.spec.js`[^1]

```
TEST: Remove Retailer soft-deletes — does not destroy document
  WHEN:  Remove Retailer confirmed
  THEN:  DELETE /api/retailers/:id returns 200
  AND:   Firestore retailers document still exists with status='inactive'
  AND:   associated stores documents are intact (not deleted)
  AND:   campaigns referencing retailer_id are intact

TEST: Remove Advertiser soft-deletes — does not destroy document
  WHEN:  Remove Advertiser confirmed
  THEN:  Firestore advertisers document status = 'inactive'
  AND:   campaigns referencing advertiser_id are intact
```


### Sprint B Exit Gate

- [ ] `DELETE /api/retailers/:id` sets Firestore `status: 'inactive'` — document still exists after call
- [ ] `DELETE /api/advertisers/:id` same behaviour
- [ ] Zero orphan campaigns after a retailer or advertiser is removed
- [ ] No hard-delete path reachable for either entity via the UI

***

## Sprint C — Brand Dashboard Logic Fixes (Week 2)

### Goal

Fix the Campaign Edit pre-fill flow (route path mismatch + wizard read from Zustand) and implement the client-side date-window status derivation for the Campaign Status column.

### In-Scope

| ID | Summary | Type |
| :-- | :-- | :-- |
| BUG-12 | Campaign Edit — route mismatch; wizard pre-fill unconfirmed | ⚠️ Partial |
| BUG-13 | Campaign Status column shows raw DB value — no date logic | ❌ Not Fixed |

### Files to Change

| File | Change Required |
| :-- | :-- |
| [`client-app/src/App.jsx`](https://github.com/cfroszte/softomedia-live2026/blob/main/client-app/src/App.jsx) | Confirm route is `/dashboard/brand/campaign/:id/edit` (not `/brand/campaign/:id/edit`) |
| `client-app/src/pages/brand/BrandDashboard.jsx` | Update `navigate()` call to match the corrected route path |
| `client-app/src/pages/brand/BrandCampaignWizard.jsx` | Read `editMode` + `campaignData` from Zustand; pre-fill all form fields on mount |
| `client-app/src/pages/brand/BrandDashboard.jsx` | Replace raw `campaign.status` render with a `deriveStatus(campaign)` helper |

### `deriveStatus()` Logic to Implement

```js
const deriveStatus = (campaign) => {
  const today = new Date();
  const start = new Date(campaign.start_date);
  const end = new Date(campaign.end_date);
  if (today < start) return 'Scheduled';
  if (today > end)   return 'Completed';
  if (campaign.status === 'paused') return 'Paused';
  return 'Live';
};
```


### Defined Tests

**File:** `tests/campaign_edit.spec.js`[^1]

```
TEST: Edit navigates to correct URL
  GIVEN: /dashboard/brand with one campaign in table
  WHEN:  click Edit on campaign row
  THEN:  URL = /dashboard/brand/campaign/:id/edit

TEST: Edit wizard is pre-filled with existing campaign data
  THEN:  name, start_date, end_date, budget, creative_url fields
         are pre-populated with the campaign's current values

TEST: Status = 'Live' only when today is within campaign window
  GIVEN: campaign { status:'live', start_date: yesterday, end_date: tomorrow }
  THEN:  Status column displays 'Live'

TEST: Status = 'Completed' when end_date is in the past
  GIVEN: campaign { status:'live', end_date: last week }
  THEN:  Status column displays 'Completed'

TEST: Status = 'Scheduled' for future campaign
  GIVEN: campaign { status:'scheduled', start_date: next month }
  THEN:  Status column displays 'Scheduled'
```


### Sprint C Exit Gate

- [ ] Clicking Edit navigates to `/dashboard/brand/campaign/:id/edit`
- [ ] All campaign fields pre-filled in the wizard via Zustand `campaignData`
- [ ] `PUT /api/campaigns/:id` called on save, returns `200`
- [ ] Status column reflects computed value for all 4 states (Live, Scheduled, Completed, Paused)
- [ ] `campaign_edit.spec.js` passes all cases

***

## Sprint D — Retailer \& Location Fixes (Week 2)

### Goal

Add the missing "Go Back" button on the retailer history view, verify and fix the Add Location store creation flow, and complete the Schedule Calendar auth context injection.

### In-Scope

| ID | Summary | Type |
| :-- | :-- | :-- |
| BUG-17 | "Go Back" button absent from Retailer Dashboard history view | ❌ Not Fixed |
| BUG-18 | Add Location does not create a Store record | ❌ Unverified |
| BUG-16 | Schedule Calendar hardcodes `userId: 'retailer_demo'` instead of live auth | ⚠️ Minor |

### Files to Change

| File | Change Required |
| :-- | :-- |
| [`client-app/src/pages/retailer/RetailerDashboard.jsx`](https://github.com/cfroszte/softomedia-live2026/blob/main/client-app/src/pages/retailer/RetailerDashboard.jsx) | Add a "← Go Back" button that calls `navigate('/dashboard/retailer')` |
| [`client-app/src/App.jsx`](https://github.com/cfroszte/softomedia-live2026/blob/main/client-app/src/App.jsx) | Confirm `/dashboard/retailer/history` route is registered |
| `client-app/src/pages/admin/LocationManager.jsx` | Verify `handleAddLocation()` calls `POST /api/stores` with `retailer_id` from context — fix if broken |
| [`client-app/src/pages/retailer/ScheduleCalendar.jsx`](https://github.com/cfroszte/softomedia-live2026/blob/main/client-app/src/pages/retailer/ScheduleCalendar.jsx) | Replace hardcoded `'retailer_demo'` with `useAuth().user.uid` |

### Defined Tests

**Files:** `tests/add_location.spec.js` · extend `tests/retailer_validation.spec.js`[^1]

```
TEST: Go Back from /dashboard/retailer/history navigates to dashboard
  GIVEN: /dashboard/retailer/history
  WHEN:  click "Go Back"
  THEN:  URL = /dashboard/retailer

TEST: Add Location creates a Firestore store document
  GIVEN: superadmin has selected Retailer context
  WHEN:  submit Add Location form with name="New QA Store"
  THEN:  POST /api/stores returns 201
  AND:   new store appears in store selector
  AND:   Firestore stores document has retailer_id = selected retailer

TEST: Schedule Calendar approve sends real user ID
  GIVEN: logged in as retaileradmin
  WHEN:  click Approve All
  THEN:  PATCH /api/loops/:id/approve body contains userId = auth user's uid
         (not 'retailer_demo')
```


### Sprint D Exit Gate

- [ ] "Go Back" button present in DOM on `/dashboard/retailer/history`
- [ ] Navigation assertion passes: Go Back → `/dashboard/retailer`
- [ ] `POST /api/stores` returns `201` with correct `retailer_id`
- [ ] Schedule Calendar approve call contains live `userId` from auth
- [ ] `add_location.spec.js` passes all cases

***

## Sprint E — Data Audit \& Environment Cleanup (Week 3)

### Goal

Clear mock seed data from production-facing selectors and verify the Tech Ops dashboard is not inadvertently re-scoped.

### In-Scope

| ID | Summary | Type |
| :-- | :-- | :-- |
| AUDIT-01 | Mock seed data leaking into store selectors | ❌ Not Completed |

### Steps

1. **Identify orphans** — run `GET /api/stores` with no filter; cross-reference every `retailer_id` against `GET /api/retailers`
2. **Inspect seed file** — read `ad-server/seed.js` for pre-seeded store records not linked to real retailers
3. **Set environment flag** — add `DISABLE_MOCK_STORAGE=true` to `.env.production` and `.env.test`
4. **Verify Tech Ops** — confirm `GET /api/monitoring/status` still aggregates all screens after the flag is set (no regression on BUG-20)

### Defined Tests

```
TEST: No orphan stores appear in Player store selector
  GIVEN: DISABLE_MOCK_STORAGE=true
  WHEN:  /player → Select Store dropdown populated
  THEN:  only stores with a valid matching retailer_id appear
  AND:   no stores from MOCK_STORAGE seed data are present

TEST: Tech Ops counts unchanged after mock storage disabled
  GIVEN: DISABLE_MOCK_STORAGE=true
  WHEN:  /dashboard/tech
  THEN:  screen count matches Firestore screens collection count
         (not inflated by mock seed records)
```


### Sprint E Exit Gate

- [ ] `DISABLE_MOCK_STORAGE=true` set in all non-local environments
- [ ] Zero orphan store records returned by `GET /api/stores`
- [ ] Store selector in `/player` shows only real, retailer-linked stores
- [ ] Tech Ops aggregate counts unchanged and correct post-cleanup

***

## Full Remediation Scorecard

| Sprint | Bugs | Owner Focus | Est. Days |
| :-- | :-- | :-- | :-- |
| Sprint A | BUG-02, BUG-03 | Back-end role gate + front-end filter | 1 day |
| Sprint B | BUG-05, BUG-08 | Repository soft-delete override | 1 day |
| Sprint C | BUG-12, BUG-13 | Brand wizard + status logic | 2 days |
| Sprint D | BUG-17, BUG-18, BUG-16 | Retailer nav + location API + auth | 2 days |
| Sprint E | AUDIT-01 | Environment config + data audit | 1 day |
| **Total** | **10 issues** |  | **~7 dev days** |

### SRE Acceptance Criteria (All Sprints)

All criteria carry over from the original plan:[^1]

- 100% Playwright happy-path pass rate
- Zero unhandled Promise rejections in browser console during test runs
- All destructive actions use soft-delete — confirmed by Firestore document inspection
- No `MOCK_STORAGE` seed data visible in production-facing selectors
- Campaign status derived client-side — never raw DB value

<div align="center">⁂</div>

[^1]: Softomedia-Live-2026-QA-Sprint-Plan.md

