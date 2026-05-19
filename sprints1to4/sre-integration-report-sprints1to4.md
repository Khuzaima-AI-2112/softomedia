# SRE Integration Report — Sprints 1–4
**Softomedia Live 2026**
**Date:** 2026-05-19 | **Reviewer Role:** Senior SRE

---

## Executive Summary

Sprints 1–4 deliver a functional ad-loop scheduling and playback system. The integration is largely non-breaking and additive. Three gaps require attention before production: an unauthenticated loop endpoint, an unseeded demo-token guard, and insufficient test coverage at 45%.

**Weighted Overall Score: 76%**

---

## Dimension Scores

| Dimension | Score | Verdict |
|-----------|-------|---------|
| Integration Correctness | 88% | Good — one field-name inconsistency |
| Non-Breaking Safety | 95% | Excellent — all changes additive |
| Performance / Efficiency | 72% | Gaps — no caching, no pagination |
| Observability / Error Handling | 78% | Logger present, no alerting pipeline |
| Security Posture | 70% | Loops unauthenticated; demo-token unseeded |
| Test Coverage | 45% | Critical gap — repo layer untested |
| Code Consistency | 82% | Mixed `screenid` / `screen_id` convention |

---

## Sprint 1 — Auth & Infrastructure (91%)

`APIClient` is production-quality. The interceptor chain, `AbortController` timeout, and status-based retry list are all correct.

**Finding:** `demo-token` is unconditionally seeded into `localStorage` on module load. Must be wrapped in `import.meta.env.DEV` guard before any production deployment.

---

## Sprint 2 — Entity Routes (85%)

All four entity routes (retailers, stores, screens, campaigns) are mounted correctly. `ApiService.js` builds query strings correctly via `URLSearchParams`.

**Finding:** `stores.js` returns field `screenid` (no underscore); `screens.js` returns `screen_id` (with underscore). The frontend works around this with a triple-guard but the contract is broken at source.

---

## Sprint 3 — Loops (89%)

The `{ loops, business_hours }` envelope is correctly defined. The dual-spelling normalization fix is confirmed in `loops.js`.

**Finding:** `GET /api/loops` is mounted on the public (unauthenticated) block of `index.js`. Any caller can pull full schedule data without a token. Two-line fix.

---

## Sprint 4 — LoopDemoPlayer (81%)

Cascade selector reset logic is correct. The `selectionComplete` guard properly blocks playback.

**Finding:** No `useRef` cache on cascade dropdowns — re-selecting the same retailer fires a fresh network round-trip every time.

---

## Open Risk Register

| ID | Risk | Priority | Sprint | Status |
|----|------|----------|--------|--------|
| R-01 | `demo-token` seeded unconditionally in production bundle | P1 | 1 | Open |
| R-02 | `screenid` vs `screen_id` field name mismatch at source | P1 | 2 | Open |
| R-03 | `GET /api/loops` on unauthenticated block | P1 | 3 | Open |
| R-04 | Zero unit tests for LoopRepository, BusinessHoursService, LoopGenerationService | P1 | 3 | Open |
| R-05 | No `useRef` cache — cascade re-fires on same retailer | P2 | 4 | Open |
| R-06 | No pagination on list endpoints | P2 | 2 | Deferred |
| R-07 | No token refresh / expiry | P2 | 1 | Deferred |

---

## Recommended Actions (Priority Order)

1. Move `GET /api/loops` behind auth middleware (R-03) — 2 lines
2. Guard `demo-token` seeding with DEV flag (R-01) — 1 line
3. Write unit tests for repo + service layer (R-04) — Sprint 5 ticket
4. Standardize `screenid` → `screen_id` at source in `stores.js` (R-02) — Sprint 5
5. Add `useRef` cache to cascade dropdowns (R-05) — Sprint 5
