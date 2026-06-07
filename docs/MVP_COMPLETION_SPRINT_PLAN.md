# MVP Completion Sprint Plan
## Digital Screen Network Management Platform
### Sprints 13–16 — Closing the 22% Gap to 100% MVP

> **Baseline**: Sprints 1–12 are complete. Per repo-grounded audit on 2026-06-06, current MVP
> completion is **78%**. The four gaps identified from
> `docs/Digital Screen Network Management Platform (MVP).md` are:
> 1. Content upload + format/spec enforcement (§4.4)
> 2. Advertiser self-service portal (§3.4)
> 3. Monetization rules + pricing config UI (§4.2 / `CPM_PRICING_MODEL.md`)
> 4. Audit logs UI + remote restart / incident tracking (§3.1, §3.5)
>
> These four sprints close every gap. No sprint assumes a file exists unless confirmed on disk.
> Every acceptance criterion is falsifiable (status codes, `data-testid` attrs, query params).

---

## Sprint Overview

| Sprint | Focus | Duration | Status |
|--------|-------|----------|--------|
| Sprint 1–12 | Core platform (broadcasting, validation, player, analytics, CRUD, monitoring) | Done | ✅ Complete |
| **Sprint 13** | **Content Upload & Spec Enforcement** | **3 days** | ⬜ Pending |
| **Sprint 14** | **Advertiser Self-Service Portal** | **3 days** | ⬜ Pending |
| **Sprint 15** | **Monetization, Pricing Config & Billing** | **3 days** | ⬜ Pending |
| **Sprint 16** | **Audit Logs, Remote Restart & MVP Hardening** | **2 days** | ⬜ Pending |

**Target**: 100% MVP on merge of Sprint 16.

---

## Sprint 13: Content Upload & Spec Enforcement ⬜

**MVP Requirement**: §4.4 — Accepted formats MP4/JPG/PNG; fixed 5-second duration; resolution
and aspect ratio enforced per screen type; automatic rejection if specs are not met.

**Pre-work discovery (run before coding):**
```bash
# Confirm whether an asset/media upload route already exists
grep -rn "upload\|multer\|mediaAsset\|assets" ad-server/src/api/ --include="*.js" | head -40
find . -path '*MediaUpload*' -o -path '*AssetUpload*' -o -path '*assets.js*' | grep -v node_modules
# Confirm ApiService.uploadMedia() caller and destination
grep -n "uploadMedia" client-app/src/services/ApiService.js
```

**Deliverables:**

### Server
- [ ] `ad-server/src/api/assets.js` — if not on disk, create it
  - `POST /api/assets/upload` — accepts `multipart/form-data`; validates MIME type
    (MP4, JPG, PNG only), duration ≤ 5.5 s (ffprobe), max file size 50 MB
  - Returns `201 { assetId, url, duration, width, height }` on pass
  - Returns `422 { error, field }` on spec violation (wrong format, duration > 5s, wrong resolution)
  - `GET /api/assets` — paginated list, filterable by `?status=approved|rejected|pending`
  - `PATCH /api/assets/:id` — update status (admin only); returns `200 { assetId, status }`
  - `DELETE /api/assets/:id` — soft-delete; returns `204`
  - All mutating routes protected by `requireAuth` + `requireRole('admin','campaign_manager')`
- [ ] `ad-server/src/services/MediaValidationService.js`
  - `validateFormat(filePath)` → throws if MIME ∉ {mp4, jpg, jpeg, png}
  - `validateDuration(filePath)` → throws if duration > 5.5 s (ffprobe or fluent-ffmpeg)
  - `validateResolution(filePath, screenType)` → throws if aspect ratio mismatches screen profile
  - Auto-rejection: asset `status` set to `rejected` with `rejection_reason` populated on failure
- [ ] `ad-server/src/repositories/AssetRepository.js`
  - `create()`, `findAll()`, `findById()`, `updateStatus()`, `softDelete()`

### Client
- [ ] `client-app/src/pages/admin/MediaLibrary.jsx`
  - Drag-and-drop upload zone (`data-testid="upload-dropzone"`)
  - Live spec validation feedback before server call: file type badge, duration badge
  - Asset grid: thumbnail, status chip (pending / approved / rejected), rejection reason tooltip
  - Route: `/dashboard/admin/media-library` registered in `App.jsx`
- [ ] `client-app/src/pages/admin/MediaLibrary.jsx` upload flow triggers `ApiService.uploadMedia()`
  (already confirmed to exist); wire response to asset grid

### Acceptance Criteria (all falsifiable)
- `POST /api/assets/upload` with a 5 s MP4 → `201 { assetId }` and `status: 'pending'`
- `POST /api/assets/upload` with a 10 s MP4 → `422 { error: 'Duration exceeds 5 seconds', field: 'duration' }`
- `POST /api/assets/upload` with a `.gif` → `422 { error: 'Unsupported format', field: 'mimeType' }`
- `DELETE /api/assets/:id` as role `retailer` → `403`
- `data-testid="upload-dropzone"` present in `MediaLibrary.jsx` DOM
- `data-testid="asset-status-chip"` shows `rejected` + reason when server returns rejection

### Tests
- [ ] `asset_upload.spec.js` — minimum 8 tests covering format pass, format fail, duration fail,
  resolution fail, role guard (retailer → 403), admin delete, paginated list

---

## Sprint 14: Advertiser Self-Service Portal ⬜

**MVP Requirement**: §3.4 — Advertisers can upload creatives, create campaign requests, select
preferred locations, track status, view basic performance metrics, access invoices.

**Pre-work discovery (run before coding):**
```bash
# Confirm advertiser role value used in requireRole()
grep -rn "requireRole\|advertiser" ad-server/src/middleware/ --include="*.js"
# Confirm campaign routes already on disk
find . -path '*campaigns.js*' | grep -v node_modules
grep -n "campaigns\|campaign" ad-server/src/api/advertisers.js | head -20
# Check if advertiser login produces a JWT with role='advertiser'
grep -n "role\|advertiser" ad-server/src/api/auth.js | head -20
```

**Deliverables:**

### Server
- [ ] `ad-server/src/api/campaigns.js` — if not on disk, create it
  - `POST /api/campaigns` — create campaign request; body: `{ name, advertiserId, budget,
    startDate, endDate, targetLocationIds[], creativeAssetIds[] }`; returns `201 { campaignId, status: 'pending_approval' }`
  - `GET /api/campaigns` — list; scoped by `req.user.role`: advertiser sees own only, admin sees all
  - `GET /api/campaigns/:id` — detail; `403` if advertiser requests another advertiser's campaign
  - `PATCH /api/campaigns/:id/status` — admin only; valid transitions:
    `pending_approval → approved`, `approved → live`, `live → completed`, any → `paused`
  - Returns `400 { error: 'Invalid status transition' }` for illegal moves
- [ ] `ad-server/src/repositories/CampaignRepository.js`
  - `create()`, `findAll({ advertiserId })`, `findById()`, `updateStatus()`

### Client
- [ ] `client-app/src/pages/advertiser/AdvertiserDashboard.jsx`
  - KPI row: active campaigns, total impressions, total spend (data-testid attrs required)
  - Campaign list table with status chips
  - Route: `/dashboard/advertiser` registered in `App.jsx`
- [ ] `client-app/src/pages/advertiser/CampaignRequest.jsx`
  - Multi-step form: (1) Campaign details, (2) Select locations from available inventory,
    (3) Attach creatives from MediaLibrary, (4) Review + submit
  - `data-testid="campaign-request-form"`, `data-testid="submit-campaign-btn"`
  - Route: `/dashboard/advertiser/campaigns/new` registered in `App.jsx`
- [ ] `client-app/src/pages/advertiser/CampaignDetail.jsx`
  - Status timeline, basic delivery metrics (impressions, delivery rate pulled from telemetry)
  - `data-testid="campaign-status-badge"`, `data-testid="campaign-impressions-count"`
  - Route: `/dashboard/advertiser/campaigns/:id` registered in `App.jsx`
- [ ] `App.jsx` — add `requireRole('advertiser')` guard on all `/dashboard/advertiser/*` routes

### Acceptance Criteria (all falsifiable)
- `POST /api/campaigns` as role `advertiser` → `201 { campaignId, status: 'pending_approval' }`
- `GET /api/campaigns` as role `advertiser` → returns only that advertiser's own campaigns
- `GET /api/campaigns/:otherId` as a different advertiser → `403`
- `PATCH /api/campaigns/:id/status` body `{ status: 'live' }` when current status is
  `pending_approval` → `400 { error: 'Invalid status transition' }`
- `GET /dashboard/advertiser` as role `admin` → `403` (route guard fires)
- `data-testid="campaign-request-form"` present in `CampaignRequest.jsx` DOM
- `data-testid="campaign-status-badge"` shows `pending_approval` immediately after submit

### Tests
- [ ] `advertiser_portal.spec.js` — minimum 10 tests covering campaign CRUD, role isolation
  (advertiser cannot see other advertiser's campaigns), status transition guards, UI testids

---

## Sprint 15: Monetization, Pricing Config & Billing ⬜

**MVP Requirement**: §3.1 monetization rules; §4.2 campaign priority rules (paid vs retailer vs
internal); `CPM_PRICING_MODEL.md` pricing logic surfaced in UI; §3.4 advertiser invoice access.

**Pre-work discovery (run before coding):**
```bash
# Confirm PricingService.js location and exports
find . -path '*PricingService*' | grep -v node_modules
grep -n "export\|CPM\|rate\|pricing" ad-server/src/services/PricingService.js 2>/dev/null | head -30
# Confirm billing / invoice routes
grep -rn "invoice\|billing\|payment" ad-server/src/api/ --include="*.js" | head -20
# Confirm campaign priority field in LoopGenerationService
grep -n "priority\|paid\|retailer\|internal" ad-server/src/services/LoopGenerationService.js | head -20
```

**Deliverables:**

### Server
- [ ] `ad-server/src/api/pricing.js`
  - `GET /api/pricing/config` — returns current CPM rates, inventory allocation rules, priority
    weights; admin only; `403` for all other roles
  - `PATCH /api/pricing/config` — update CPM rate or allocation percentage; validates that
    paid + retailer + internal allocation percentages sum to 100; returns `400` if not
  - `GET /api/pricing/estimate` — query params `?slots=N&cpm=X`; returns estimated cost;
    accessible by `advertiser` and `admin` roles
- [ ] `ad-server/src/api/invoices.js`
  - `POST /api/invoices/generate` — admin only; generates invoice for completed campaign;
    returns `201 { invoiceId, totalCpm, impressionsDelivered, amount }`
  - `GET /api/invoices` — advertiser sees own invoices only; admin sees all
  - `GET /api/invoices/:id/pdf` — returns PDF blob (or signed URL); `403` if wrong advertiser
- [ ] Wire `LoopGenerationService.js` priority order: `paid > retailer > internal` if not already
  enforced — confirm via `grep` first; patch only if the guard is missing

### Client
- [ ] `client-app/src/pages/admin/PricingConfig.jsx`
  - CPM rate input per screen type, allocation sliders (paid / retailer / internal) that
    must sum to 100% with live validation
  - `data-testid="pricing-save-btn"` disabled until sum === 100%
  - Route: `/dashboard/admin/pricing` registered in `App.jsx`
- [ ] `client-app/src/pages/advertiser/Invoices.jsx`
  - Invoice list table: campaign name, period, impressions, CPM, total amount, download PDF btn
  - `data-testid="invoice-download-btn"` per row
  - Route: `/dashboard/advertiser/invoices` registered in `App.jsx`

### Acceptance Criteria (all falsifiable)
- `PATCH /api/pricing/config` with `{ paid: 60, retailer: 30, internal: 20 }` → `400
  { error: 'Allocation must sum to 100' }`
- `PATCH /api/pricing/config` with `{ paid: 60, retailer: 30, internal: 10 }` → `200`
- `GET /api/pricing/config` as role `retailer` → `403`
- `GET /api/pricing/estimate?slots=12&cpm=5` → `200 { estimatedCost: 0.60 }`
- `GET /api/invoices` as advertiser A → does not include invoices belonging to advertiser B
- `data-testid="pricing-save-btn"` is `disabled` when allocation sliders do not sum to 100

### Tests
- [ ] `pricing_billing.spec.js` — minimum 8 tests covering CPM config CRUD, allocation
  validation, estimate calculation, invoice generation, role isolation

---

## Sprint 16: Audit Logs, Remote Restart & MVP Hardening ⬜

**MVP Requirement**: §3.1 audit logs and security oversight; §3.5 remote restart and basic
diagnostics; Sprint 6–style full E2E coverage of the new portal surface.

**Pre-work discovery (run before coding):**
```bash
# Confirm whether an audit middleware / table already exists
grep -rn "audit\|AuditLog\|audit_log" ad-server/src/ --include="*.js" | head -20
# Confirm screens.js has a restart/reboot endpoint
grep -n "restart\|reboot\|diagnostic" ad-server/src/api/screens.js | head -10
# Confirm App.jsx has audit log route
grep -n "audit\|AuditLog" client-app/src/App.jsx
```

**Deliverables:**

### Audit Logs
- [ ] `ad-server/src/middleware/auditLogger.js` — if not on disk, create it
  - Middleware that writes `{ actor, role, action, targetEntity, targetId, timestamp, ip }`
    to `audit_logs` table on every mutating request (POST/PATCH/DELETE)
  - Mount in `ad-server/src/server.js` after auth middleware
- [ ] `ad-server/src/api/audit.js`
  - `GET /api/audit` — super admin only; supports `?actorId=&action=&from=&to=&page=`
  - Returns paginated list; `403` for all non-super-admin roles
- [ ] `client-app/src/pages/admin/AuditLog.jsx`
  - Filter bar: actor, action type, date range
  - Table: timestamp, actor, role, action, target entity, IP
  - `data-testid="audit-log-table"`, `data-testid="audit-filter-apply-btn"`
  - Route: `/dashboard/admin/audit` registered in `App.jsx`

### Remote Restart / Diagnostics
- [ ] Add to `ad-server/src/api/screens.js` (already confirmed on disk):
  - `POST /api/screens/:id/restart` — admin / tech_operator only; sets screen
    `status = 'restarting'` and logs to audit; returns `202 { message: 'Restart command queued' }`
  - `GET /api/screens/:id/diagnostics` — returns `{ lastHeartbeat, uptime, firmwareVersion,
    loopPlaybackStatus }`; `403` for retailer role
- [ ] `client-app/src/pages/admin/ScreenManagement.jsx` (confirmed on disk) — add:
  - "Restart" button per screen row → calls `POST /api/screens/:id/restart`
  - "Diagnostics" expandable row → calls `GET /api/screens/:id/diagnostics`
  - `data-testid="restart-btn-{screenId}"`, `data-testid="diagnostics-panel-{screenId}"`

### MVP Hardening
- [ ] Pre-deployment checklist items from `docs/PREDEPLOYMENT_CHECKLIST.md` — audit and close
  any open items not yet addressed
- [ ] `integration_mvp_full.spec.js` — full E2E covering:
  1. Super Admin creates retailer + advertiser accounts
  2. Content Manager uploads a valid MP4 asset → `201`
  3. Content Manager uploads an invalid 10 s MP4 → `422`
  4. Advertiser logs in, creates campaign request → status `pending_approval`
  5. Admin approves campaign → status `live`
  6. Loop generated D-1 including paid campaign slot
  7. Retailer validates loop → approves
  8. Player picks up loop and plays → telemetry `POST /api/telemetry/impression` → `201`
  9. Admin views `LoopAnalytics.jsx` → impressions count > 0
  10. Admin generates invoice → `201 { invoiceId }`
  11. Advertiser views invoice in `Invoices.jsx`
  12. Admin views audit log → all 11 actions above appear as rows

### Acceptance Criteria (all falsifiable)
- `POST /api/screens/:id/restart` as role `retailer` → `403`
- `POST /api/screens/:id/restart` as role `tech_operator` → `202`
- `GET /api/audit` as role `retailer` → `403`
- `GET /api/audit?action=PATCH_SCREEN&from=2026-01-01` as super admin → `200` array of matching entries
- `data-testid="audit-log-table"` renders at least one row after the E2E flow above runs
- `data-testid="restart-btn-{screenId}"` present in `ScreenManagement.jsx` for every screen row

### Tests
- [ ] `audit_restart.spec.js` — minimum 8 tests
- [ ] `integration_mvp_full.spec.js` — 12-step E2E (listed above)

---

## Summary

### New Routes to Register in `App.jsx`

| Route | Component | Role Guard |
|-------|-----------|------------|
| `/dashboard/admin/media-library` | `MediaLibrary.jsx` | `admin`, `campaign_manager` |
| `/dashboard/admin/pricing` | `PricingConfig.jsx` | `admin` |
| `/dashboard/admin/audit` | `AuditLog.jsx` | `super_admin` |
| `/dashboard/advertiser` | `AdvertiserDashboard.jsx` | `advertiser` |
| `/dashboard/advertiser/campaigns/new` | `CampaignRequest.jsx` | `advertiser` |
| `/dashboard/advertiser/campaigns/:id` | `CampaignDetail.jsx` | `advertiser` |
| `/dashboard/advertiser/invoices` | `Invoices.jsx` | `advertiser` |

### New API Routes to Register in Server Router

| Method | Path | File | Guard |
|--------|------|------|-------|
| POST | `/api/assets/upload` | `assets.js` | `requireAuth`, `requireRole('admin','campaign_manager')` |
| GET/DELETE/PATCH | `/api/assets` | `assets.js` | `requireAuth` |
| POST/GET/PATCH | `/api/campaigns` | `campaigns.js` | `requireAuth` |
| GET/PATCH | `/api/pricing/config` | `pricing.js` | `requireRole('admin')` |
| GET | `/api/pricing/estimate` | `pricing.js` | `requireAuth` |
| POST/GET | `/api/invoices` | `invoices.js` | `requireAuth` |
| GET | `/api/invoices/:id/pdf` | `invoices.js` | `requireAuth` |
| GET | `/api/audit` | `audit.js` | `requireRole('super_admin')` |
| POST | `/api/screens/:id/restart` | `screens.js` | `requireRole('admin','tech_operator')` |
| GET | `/api/screens/:id/diagnostics` | `screens.js` | `requireAuth` |

### New Files to Create

| File | Sprint |
|------|--------|
| `ad-server/src/api/assets.js` | 13 |
| `ad-server/src/services/MediaValidationService.js` | 13 |
| `ad-server/src/repositories/AssetRepository.js` | 13 |
| `client-app/src/pages/admin/MediaLibrary.jsx` | 13 |
| `ad-server/src/api/campaigns.js` | 14 |
| `ad-server/src/repositories/CampaignRepository.js` | 14 |
| `client-app/src/pages/advertiser/AdvertiserDashboard.jsx` | 14 |
| `client-app/src/pages/advertiser/CampaignRequest.jsx` | 14 |
| `client-app/src/pages/advertiser/CampaignDetail.jsx` | 14 |
| `ad-server/src/api/pricing.js` | 15 |
| `ad-server/src/api/invoices.js` | 15 |
| `client-app/src/pages/admin/PricingConfig.jsx` | 15 |
| `client-app/src/pages/advertiser/Invoices.jsx` | 15 |
| `ad-server/src/middleware/auditLogger.js` | 16 |
| `ad-server/src/api/audit.js` | 16 |
| `client-app/src/pages/admin/AuditLog.jsx` | 16 |

### Files to Patch (confirmed on disk)

| File | Sprint | Change |
|------|--------|--------|
| `ad-server/src/api/screens.js` | 16 | Add `POST /:id/restart` and `GET /:id/diagnostics` |
| `client-app/src/pages/admin/ScreenManagement.jsx` | 16 | Add restart btn + diagnostics panel |
| `client-app/src/App.jsx` | 13–16 | Register 7 new routes with role guards |

### Test Files to Create

| File | Sprint | Min Tests |
|------|--------|-----------|
| `asset_upload.spec.js` | 13 | 8 |
| `advertiser_portal.spec.js` | 14 | 10 |
| `pricing_billing.spec.js` | 15 | 8 |
| `audit_restart.spec.js` | 16 | 8 |
| `integration_mvp_full.spec.js` | 16 | 12 |

**Estimated new test count**: 46 tests (bringing total from 51 → ~97)

---

*Generated: 2026-06-06. Grounded against live repo audit on same date.*
*Every "confirmed on disk" annotation refers to files verified via GitHub MCP in Sprint 11–12 sessions.*
*Run all pre-work `grep`/`find` discovery steps before writing a single line of implementation code.*
