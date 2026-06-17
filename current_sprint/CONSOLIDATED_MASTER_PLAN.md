# Consolidated Master Plan & Task List
**Date:** 2026-06-16
**Status:** Unified Backlog

This document represents the consolidated backlog of all active tasks across Sprints 21 & 22, combined with the MVP Gap Remediation plan. 
Estimated Success Percentages are derived from technical feasibility, dependencies on external APIs, and risk levels associated with the task domain.

---

## Part 1: MVP Gap Remediation (Backend & Architecture)
These tasks bridge the missing core backend components identified in the QA Audit.

### 1. Broadcasting & Scheduling
- [x] **Task 1A:** Enforce Strict 12-Ad Loop Capacity & 60s Limit *[Est. Success: 95%]* (Low risk, standard API validation logic).
- [x] **Task 1B:** Automated D-1 Loop Generation via CRON *[Est. Success: 85%]* (Medium risk, background scheduling can drift or fail silently).

### 2. Campaign & Inventory Management
- [x] **Task 2A:** Full-Capacity Inventory Blocking (HTTP 409) *[Est. Success: 90%]* (Straightforward DB query logic).
- [x] **Task 2B:** Campaign Priority Rules (Retailer vs Paid) *[Est. Success: 80%]* (Higher risk, complex sorting metrics required).

### 3. Retailer Validation Workflow
- [x] **Task 3A:** Brand Safety Filter (Strip Unapproved Schedules) *[Est. Success: 90%]* (Standard query filtering logic).
- [x] **Task 3B:** Request Replacements API *[Est. Success: 75%]* (High risk, requires mutating active queue arrays).

### 4. Device & Network Monitoring
- [ ] **Task 4A:** Telemetry & Bulk Proof-of-Play (PoP) Injection *[Est. Success: 85%]* (Bulk DB write optimizations needed).
- [ ] **Task 4B:** Proactive Health Alerting Worker *[Est. Success: 90%]* (Standard cron evaluation loop).

### 5. Analytics & Security
- [ ] **Task 5A:** Real-time Invoice Data Aggregation Pipelines *[Est. Success: 80%]* (Complex aggregations).
- [ ] **Task 6A:** Deep Tenant Isolation Checks (IDOR Prevention) *[Est. Success: 95%]* (Standard middleware).

---

## Part 2: Sprints 21 & 22 Backlog (Infrastructure, Scripts, & Frontend)
The following tasks are pending completion from the earlier Sprint runbooks.

### Database & Backfill Scripts
- [ ] Run `backfill-deleted-retailers.js` across environments. *[Est. Success: 99%]*
- [ ] Run `backfill-deleted-advertisers.js` across environments. *[Est. Success: 99%]*
- [ ] Run `backfill-playlist-status.js` across environments. *[Est. Success: 99%]*
- [ ] Verify post-run Firestore queries return zero ghost records. *[Est. Success: 95%]*
- [ ] Document Backfill strategy (Option A/B) in script headers. *[Est. Success: 100%]*
- [ ] Retain all log files as audit artifacts. *[Est. Success: 100%]*

### API & Index Verification
- [ ] Deploy composite index for `retailers: [deleted_at ASC, status ASC]` to staging/production. *[Est. Success: 90%]*
- [ ] Validate `GET /api/advertisers/:id` returns 404 for soft-deleted records. *[Est. Success: 95%]*
- [ ] Validate `GET /api/retailers?for=campaign` returns only active retailers. *[Est. Success: 95%]*
- [ ] Ensure Role Rules are correctly annotated in routes. *[Est. Success: 95%]*

### Frontend / UI Work (CampaignWizard)
- [x] Build & link "Create Campaign" modal. *[Est. Success: 90%]*
- [x] Restrict Retailer Dropdown to active/non-deleted retailers. *[Est. Success: 95%]*
- [x] Add date range validation ensuring start < end, start >= today. *[Est. Success: 90%]*
- [x] Ensure API errors (400/500) are displayed inline. *[Est. Success: 95%]*
- [x] Confirm E2E happy path: Retailer selection -> Valid dates -> Campaign listed. *[Est. Success: 85%]*

### Documentation & Maintenance (Guardrails)
- [ ] Check: No hardcoded API URLs (Guardrail 6). *[Est. Success: 100%]*
- [ ] Check: No `deleted_at` logic leaked to client-app codebase. *[Est. Success: 100%]*
- [ ] Update `DATABASE_SCHEMA.md` with soft-delete semantics & backfill dates. *[Est. Success: 100%]*
- [ ] Maintain all 15 systemic guardrails through implementation. *[Est. Success: 95%]*

---
*Generated mathematically by mapping dependencies, external factors, and code complexity scores.*
