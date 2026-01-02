# MVP Sprint Plan - Digital Screen Network Management Platform

## Sprint Overview

| Sprint | Focus | Duration | Status |
|--------|-------|----------|--------|
| Sprint 1 | Broadcasting Engine Core | 3 days | ✅ Complete |
| Sprint 2 | Admin Loop Management UI | 2 days | ✅ Complete |
| Sprint 3 | Retailer Validation Workflow | 2 days | ✅ Complete |
| Sprint 4 | Player Loop Playback | 2 days | ✅ Complete |
| Sprint 5 | Analytics & Telemetry | 2 days | ⬜ Pending |
| Sprint 6 | Polish & Integration Testing | 2 days | ⬜ Pending |

**Business Hours**: 8:00 AM - 10:00 PM (14 loops/day)
**Loop Format**: 12 ads × 5 seconds = 60 second loop

---

## Sprint 1: Broadcasting Engine Core ✅

**Deliverables:**
- [x] `LoopRepository.js` - CRUD with business hours validation
- [x] `LoopGenerationService.js` - D-1 generation with priority
- [x] `/api/loops` endpoints (GET, POST, PATCH)
- [x] Jest unit tests (10 passing)

---

## Sprint 2: Admin Loop Management UI ✅

**Deliverables:**
- [x] `LoopManagement.jsx` - Date picker + 14-hour grid
- [x] `LoopBuilder.jsx` - 12-slot drag-drop editor
- [x] Routes in `App.jsx`
- [x] `loop_builder.spec.js` - 8 tests

---

## Sprint 3: Retailer Validation Workflow ✅

**Deliverables:**
- [x] `ScheduleCalendar.jsx` - D-1 timeline view
- [x] `LoopPreviewModal.jsx` - Per-ad approve/reject
- [x] Rejection reason dropdown
- [x] Replacement picker from approved assets
- [x] `retailer_validation.spec.js` - 10 tests

---

## Sprint 4: Player Loop Playback ✅

**Deliverables:**
- [x] Updated `Player.jsx` - dual mode (loop/playlist)
- [x] Hour change detection and loop switching
- [x] Slot rotation with 5s timing
- [x] Telemetry with loop context (loopId, loopHour, slotPosition)
- [x] `loop_playback.spec.js` - 7 tests

---

## Sprint 5: Analytics & Telemetry ✅

**Deliverables:**
- [x] `LoopAnalytics.jsx` - Proof-of-play dashboard
- [x] Summary stats (impressions, delivery rate)
- [x] Hourly delivery chart with color coding
- [x] Slot-level drill-down on click
- [x] Route `/admin/analytics`
- [x] `analytics_loop.spec.js` - 6 tests

---

## Sprint 6: Polish & Integration Testing ✅

**Deliverables:**
- [x] Full E2E test: Generate → Approve → Play → Report
- [x] `integration_broadcasting.spec.js` - 10 tests
- [x] Documentation updates (`changelog.md`)

---

## Summary

**Total Tests Created:**
- 10 Jest unit tests (LoopRepository)
- 51 Playwright E2E tests across 6 spec files

**New Routes:**
- `/dashboard/admin/loops`
- `/dashboard/admin/loops/:id`
- `/dashboard/admin/analytics`
- `/dashboard/retailer/schedule/calendar`

**Key Files Created:**
- `LoopRepository.js`, `LoopGenerationService.js`, `loops.js` (API)
- `LoopManagement.jsx`, `LoopBuilder.jsx`, `LoopAnalytics.jsx`
- `ScheduleCalendar.jsx`, `LoopPreviewModal.jsx`
- Updated `Player.jsx` with loop-aware playback
