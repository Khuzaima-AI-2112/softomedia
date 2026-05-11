# Unit Test Plan — Softomedia Live 2026
## UI & Database Functionalities

**Date**: 2026-03-07  
**Scope**: Unit-level tests only (no E2E / integration). Covers React UI components, frontend services, backend repositories, and backend services.  
**Testing Frameworks**: Vitest + React Testing Library (frontend), Jest (backend)

---

## Part A — UI Unit Tests (client-app)

### A1. Reusable Components (`src/components/`)

| # | Component | What to Test | Priority |
|---|-----------|-------------|----------|
| 1 | `GlassCard` | Renders children, applies glass styling classes, forwards props | Low |
| 2 | `KPICard` | Displays label, value, icon; handles missing/zero values | Medium |
| 3 | `StatusBadge` | Correct color mapping per status string (`online`, `offline`, `error`, `active`, `inactive`) | Medium |
| 4 | `TrafficTierBadge` | Maps `low`/`medium`/`high` to correct label & color | Low |
| 5 | `DataTable` | Renders column headers; renders rows from data array; empty state | Medium |
| 6 | `SlotGrid` | Renders 12 slots; distinguishes `available`/`booked`/`blocked`; click handler fires with correct slot index | High |
| 7 | `LoopPreview` | Renders slot sequence; displays campaign name or "empty" labels | Medium |
| 8 | `LoopPreviewModal` | Opens/closes on prop change; renders loop data inside; escape key closes | Medium |
| 9 | `PriceDisplay` | Correctly formats CPM to currency; applies multiplier; handles null pricing | High |
| 10 | `StarRating` | Renders correct filled/empty stars; click handler returns value | Low |
| 11 | `ErrorBoundary` | Catches child render errors; displays fallback UI; does not crash parent | High |
| 12 | `HamburgerMenu` | Toggles open/closed; renders nav links per persona role; closes on outside click | Medium |
| 13 | `PersonaSwitcher` | Lists available personas; changes selection; fires callback | Medium |
| 14 | `GlassChart` | Renders without crashing given valid data; handles empty dataset | Low |
| 15 | `ApprovalActions` | Renders Approve/Reject buttons; fires correct callbacks; disabled state | High |
| 16 | `CampaignApprovalList` | Renders list of campaigns; filters by status; empty state message | Medium |
| 17 | `LocationManager` | Renders location tree; add/edit/delete callbacks | Medium |
| 18 | `SupportTicketModal` | Form validation (required fields); submit fires with correct payload | Medium |
| 19 | `TicketDashboard` | Renders ticket table; status column filtering | Low |
| 20 | `TicketDetail` | Renders ticket fields; comment thread; status change handler | Low |
| 21 | `SafeWidgetLoader` | Renders child widget; catches widget errors without crashing layout | Medium |

### A2. Pages — Admin Dashboard (`src/pages/admin/`)

| # | Page | What to Test | Priority |
|---|------|-------------|----------|
| 1 | Admin Overview | KPI cards render with mock data; loading skeleton shown during fetch | Medium |
| 2 | Screen Management | Table renders screens; "Register Screen" modal opens; delete confirmation dialog | High |
| 3 | Playlist Management | Table view renders; filter by status works; empty state | Medium |
| 4 | Playlist Editor (New) | Form fields render; file upload area present; validation on submit (name required) | High |
| 5 | Playlist Editor (Edit) | Pre-populates fields from props/route; saves changes | High |
| 6 | Loop Management | Date picker changes displayed date; grid renders per-screen rows | High |
| 7 | Loop Builder | Slot grid rendered with 12 slots; sidebar asset list; "Book Slot" modal | High |
| 8 | Loop Analytics | Chart renders with mock impression data; toggle between chart/table view | Medium |
| 9 | Network Map | Map container renders; marker count matches screen count | Low |
| 10 | CPM Calendar (Pricing) | Calendar renders; override modal opens; form validates multiplier range (0.1–5.0) | High |
| 11 | User Management | User table renders; role filter dropdown; add/edit modal form validation | High |
| 12 | Retailer Management | Expandable detail rows; add/edit modal | Medium |
| 13 | Business Hours | Weekly table renders 7 rows; edit form validates time ranges | Medium |
| 14 | Advertiser Management | Table renders; logo picker emoji selection; modal validation | Medium |

### A3. Pages — Brand Dashboard (`src/pages/brand/`)

| # | Page | What to Test | Priority |
|---|------|-------------|----------|
| 1 | Brand Dashboard | KPI row renders campaign stats; empty state tip for new advertisers | Medium |
| 2 | Campaign Wizard | 4-step stepper navigation (forward/back); file upload step; date picker validation (end >= start); budget validation (min 0); success panel on completion | High |

### A4. Pages — Retailer Dashboard (`src/pages/retailer/`)

| # | Page | What to Test | Priority |
|---|------|-------------|----------|
| 1 | Retailer Dashboard | Store list renders; stats displayed | Medium |
| 2 | Schedule Manager | Table view with filter; correct data mapping | Medium |
| 3 | Schedule Calendar | Calendar renders days; events displayed | Low |
| 4 | Playback History | Table renders impression rows; date range filter | Low |

### A5. Pages — Player & Public Routes

| # | Page | What to Test | Priority |
|---|------|-------------|----------|
| 1 | `Player.jsx` | Loading state; renders active playback; connection error state; slot cycling timer | High |
| 2 | `LoopDemoPlayer.jsx` | Loading state; controls overlay toggles; renders slots in sequence | Medium |
| 3 | `Login.jsx` | Form validation (email format, password required); submit calls auth service; error display | High |
| 4 | `Health.jsx` | Service status badges render; dependency checks displayed | Low |

### A6. Frontend Services (`src/services/`)

| # | Service | What to Test | Priority |
|---|---------|-------------|----------|
| 1 | `ApiService.js` | Correct base URL resolution; request/response interceptors; error handling (401 → redirect, 500 → throw) | High |
| 2 | `api.js` | Each API method (get/post/put/delete) calls correct endpoint; query params passed correctly | High |
| 3 | `PricingService.js` | `calculateSlotPrice()` — applies base CPM × traffic tier × date override; handles missing tiers gracefully; currency formatting | High |
| 4 | `TelemetryService.js` | Event tracking fires; batching logic; offline queue | Medium |
| 5 | `SnapshotService.js` | Captures DOM element; returns blob; handles missing element | Low |
| 6 | `authAPI.js` | Login call with credentials; token storage; logout clears token | High |
| 7 | `screenAPI.js` | Fetches screens by retailer; handles empty response | Medium |

### A7. Contexts & Hooks

| # | Module | What to Test | Priority |
|---|--------|-------------|----------|
| 1 | `AuthContext` | Provides user/role; login updates context; logout clears context; persists to localStorage | High |
| 2 | Custom Hooks (×2) | Return correct initial state; update on dependency changes; cleanup on unmount | Medium |

---

## Part B — Database / Backend Unit Tests (ad-server)

### B1. Repository Layer (`src/repositories/`)

> All repositories extend `BaseRepository`. Test the base class thoroughly, then test entity-specific logic.

| # | Repository | What to Test | Priority |
|---|-----------|-------------|----------|
| 1 | `BaseRepository` | `create()` — generates ID, sets `created_at`/`updated_at`; `getById()` — returns doc or null; `update()` — merges fields, updates `updated_at`; `delete()` — removes doc; `getAll()` — returns array; MOCK_STORAGE fallback works correctly | **Critical** |
| 2 | `RetailerRepository` | Inherits CRUD correctly; validates `ret_` prefix on ID | Medium |
| 3 | `StoreRepository` | `getByRetailerId()` — filters stores by FK; handles no-match | High |
| 4 | `ScreenRepository` | `getByStoreId()` — filters by store FK; `updateHeartbeat()` — updates `last_seen` and `status` to online | High |
| 5 | `AdvertiserRepository` | Inherits CRUD; validates `adv_` prefix | Medium |
| 6 | `CampaignRepository` | Inherits CRUD; status transitions are valid | Medium |
| 7 | `LoopRepository` | `getByScreenAndDate()` — composite key lookup; `bookSlot()` — updates slot status from `available` → `booked`; prevents double-booking; `getAvailableSlots()` — returns only `available` slots | **Critical** |
| 8 | `MediaRepository` | Inherits CRUD; stores file metadata | Low |
| 9 | `PlaylistRepository` | `getGlobalPlaylists()` — filters by `is_global: true`; `getByScreenAssignment()` — matches screen ID in assignments array | High |
| 10 | `PricingRepository` | `getGlobalConfig()` — reads singleton doc; `applyOverride()` — merges date override into config; `calculatePrice()` — base × tier × override math; validates multiplier bounds (0.1–5.0) | **Critical** |
| 11 | `ImpressionRepository` | `logImpression()` — creates record with timestamp; `getByDateRange()` — filters correctly | Medium |
| 12 | `UserRepository` | `getByEmail()` — unique lookup; `getByRole()` — filters by role string | High |
| 13 | `BusinessHoursRepository` | `getByStoreId()` — returns weekly hours; validates time format | Medium |
| 14 | `SpecialHoursRepository` | `getByDateRange()` — returns overrides for date window; handles no overrides | Medium |
| 15 | `LocationRepository` | Inherits CRUD | Low |
| 16 | `SchedulingAuditRepository` | `logAction()` — creates audit entry with actor and action type | Low |

### B2. Service Layer (`src/services/`)

| # | Service | What to Test | Priority |
|---|---------|-------------|----------|
| 1 | `AuthService` | `login()` — validates credentials, returns JWT; rejects wrong password; `register()` — hashes password; prevents duplicate email | **Critical** |
| 2 | `LoopGenerationService` | `generateDailyLoops()` — creates loops for each screen × each open hour; respects store business hours; fills global playlist slots; skips closed hours; idempotent (re-run doesn't duplicate) | **Critical** |
| 3 | `LoopGenerator` | Delegates to `LoopGenerationService` correctly | Low |
| 4 | `CampaignService` | `createCampaign()` — validates required fields; sets initial status to `draft`; `bookSlots()` — reserves loop slots and links campaign_id; budget check before booking | High |
| 5 | `PlaylistService` | `createPlaylist()` — validates items array; `assignToScreens()` — updates assignments; `getActiveForScreen()` — returns playlists relevant to a screen ID; global playlist injection logic | High |
| 6 | `BusinessHoursService` | `getHoursForStore()` — returns hours with special-hours overrides merged; `isStoreOpen()` — returns boolean for given datetime; handles timezone edge cases | High |
| 7 | `HeartbeatService` | `processHeartbeat()` — updates screen status to `online`; sets `last_seen` to now; detects stale heartbeats (marks `offline`) | Medium |
| 8 | `BackupService` | `exportCollection()` — serializes to JSON; `importCollection()` — validates schema before write | Low |
| 9 | `SeedService` | `seedAll()` — populates all collections with test data; `clearAll()` — removes test data without affecting production; validates data against schema | Low |

### B3. Middleware Layer (`src/middleware/`)

| # | Middleware | What to Test | Priority |
|---|-----------|-------------|----------|
| 1 | Auth Middleware | Validates JWT in Authorization header; rejects expired tokens; rejects malformed tokens; attaches `req.user` | **Critical** |
| 2 | Role Guard | Allows access for permitted roles; returns 403 for unpermitted roles | High |
| 3 | Rate Limiter | Allows requests under limit; returns 429 when exceeded | Medium |
| 4 | Validation Middleware | Rejects requests that fail Zod schema; passes valid requests through | High |
| 5 | Error Handler | Catches thrown errors; returns structured JSON error response; does not leak stack traces in production | Medium |

### B4. Utility Layer (`src/utils/`)

| # | Utility | What to Test | Priority |
|---|---------|-------------|----------|
| 1 | Circuit Breaker (`ResilienceUtility`) | Closes circuit on success; opens after N failures; half-open state allows retry; resets on recovery | High |
| 2 | ID Generators | Prefix-based IDs (`ret_`, `adv_`, `scr_`, etc.) are unique and correctly formatted | Medium |
| 3 | Date/Time Helpers | Format conversions; timezone handling; hour range generation | Medium |

### B5. API Route Handlers (`src/api/`)

| # | Route Group | What to Test | Priority |
|---|------------|-------------|----------|
| 1 | `/api/screens` | GET returns array; POST validates body (Zod); PUT updates fields; DELETE removes | High |
| 2 | `/api/campaigns` | POST validates advertiser FK; status transitions (draft → pending → live); booking endpoint reserves slots | High |
| 3 | `/api/loops` | GET by screen+date returns correct loop; slot modification updates correctly | High |
| 4 | `/api/pricing/config` | GET returns singleton; PUT validates multiplier bounds; override creation | High |
| 5 | `/api/retailers` | CRUD operations; cascading store relationships | Medium |
| 6 | `/api/advertisers` | CRUD operations; campaign relationship integrity | Medium |
| 7 | `/api/playlists` | CRUD; global flag filtering; screen assignment | Medium |
| 8 | `/api/media` | Upload metadata storage; file type validation | Medium |
| 9 | `/api/users` | CRUD; role-based filtering; email uniqueness | High |
| 10 | `/api/auth` | Login returns token; register creates user; refresh token flow | High |
| 11 | `/health` | Returns 200 with service status | Low |

---

## Part C — Test Execution Strategy

### C1. Priority Tiers

| Tier | Label | Criteria | Target Coverage |
|------|-------|----------|-----------------|
| P0 | **Critical** | Auth, pricing calculations, loop booking, data integrity | 90%+ |
| P1 | **High** | CRUD operations, form validations, player rendering | 80%+ |
| P2 | **Medium** | UI rendering, secondary features, filtering | 70%+ |
| P3 | **Low** | Utility components, demo pages, edge-case displays | 50%+ |

### C2. Mocking Strategy

| Dependency | Mock Approach |
|-----------|---------------|
| Firestore | Use the existing `MOCK_STORAGE` in-memory fallback from `BaseRepository` |
| Cloud Storage | Stub `upload()` / `getSignedUrl()` to return fake URLs |
| Gemini AI Client | Stub with canned responses; test prompt construction separately |
| JWT / bcrypt | Use real libraries in test (fast enough); alternatively stub for speed |
| HTTP / fetch | Use `msw` (Mock Service Worker) or Vitest mocks for API calls in frontend services |
| React Router | Wrap components in `MemoryRouter` with test routes |
| Zustand Store | Reset store between tests; provide initial state via `useStore.setState()` |

### C3. Test File Naming & Location

```
client-app/
  src/
    components/
      GlassCard.test.jsx          ← co-located with component
      SlotGrid.test.jsx
    pages/
      admin/
        ScreenManagement.test.jsx
    services/
      PricingService.test.js

ad-server/
  tests/
    repositories/
      BaseRepository.test.js
      LoopRepository.test.js
    services/
      LoopGenerationService.test.js
      AuthService.test.js
    middleware/
      authMiddleware.test.js
    api/
      screens.test.js
      campaigns.test.js
```

### C4. Estimated Test Counts

| Area | Estimated Test Cases |
|------|---------------------|
| UI Components (A1) | ~80 |
| Admin Pages (A2) | ~55 |
| Brand/Retailer/Player Pages (A3–A5) | ~35 |
| Frontend Services & Hooks (A6–A7) | ~40 |
| Backend Repositories (B1) | ~65 |
| Backend Services (B2) | ~50 |
| Middleware (B3) | ~25 |
| Utilities (B4) | ~15 |
| API Routes (B5) | ~45 |
| **Total** | **~410** |

### C5. Recommended Execution Order

1. **Backend Utilities & Base Repository** — foundation everything else depends on
2. **Backend Middleware** — auth and validation must work before testing routes
3. **Backend Repositories** — verify data layer before services
4. **Backend Services** — business logic depends on repositories
5. **Backend API Routes** — integration of middleware + services
6. **Frontend Services** — API client and pricing logic
7. **Frontend Components** — reusable building blocks
8. **Frontend Pages** — composed views that depend on components and services

---

## Part D — Acceptance Criteria

A test suite is considered **complete** when:

- [ ] All P0 (Critical) tests pass with ≥ 90% line coverage on target files
- [ ] All P1 (High) tests pass with ≥ 80% line coverage
- [ ] No test depends on external network calls or live Firestore
- [ ] Tests run in < 60 seconds total (frontend + backend)
- [ ] CI pipeline (`cloudbuild.yaml`) includes `npm test` for both packages
- [ ] Zero flaky tests (all tests pass 10 consecutive runs)
