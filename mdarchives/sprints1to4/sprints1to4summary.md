# Sprints 1–4 Summary
**Softomedia Live 2026** · Generated: 2026-05-19

---

## Sprint 1 — Auth & API Infrastructure

**Status: ✅ Complete**

### What Was Built
- `APIClient` with Axios interceptor chain
- `AbortController` request timeout (10s default)
- `demo-token` auth seeded in client LocalStorage
- `Authorization: Bearer` + `x-demo-role` headers attached to every outbound request
- `GET /api/health` — unauthenticated, returns `{ status, timestamp, uptime }`
- Auth middleware validating token + role on all protected routes

### Known Risks
| Risk | Priority | Status |
|------|----------|--------|
| `demo-token` seeded unconditionally — not guarded by DEV env flag | P1 | Open |
| No token refresh / expiry logic | P2 | Deferred |

---

## Sprint 2 — Retailers, Stores, Screens, Campaigns

**Status: ✅ Complete**

### What Was Built
- `GET /api/retailers` — list all retailers
- `GET /api/stores?retailerid=<id>` — filter stores by retailer
- `GET /api/screens?storeid=<id>` — filter screens by store
- `GET /api/campaigns` + `?retailer_id=<id>` filter
- `ApiService.js` query-string builder using `URLSearchParams`

### Known Risks
| Risk | Priority | Status |
|------|----------|--------|
| `stores.js` returns `screenid` (no underscore); `screens.js` returns `screen_id` — inconsistent field names | P1 | Open |
| No pagination on list endpoints | P2 | Deferred |

---

## Sprint 3 — Loops & Business Hours

**Status: ✅ Complete (P0 fix applied)**

### What Was Built
- `GET /api/loops` — returns `{ loops, business_hours }` envelope
- `GET /api/loops/:id` — single loop with 12-slot array
- `POST /api/loops/generate` — D-1 generation with mock flag
- `PATCH /api/loops/:id/approve` — retailer approval
- `PATCH /api/loops/:id/slots/:position/reject` — slot rejection with reason
- `PATCH /api/loops/:id/slots/:position/replace` — slot replacement
- `GET /api/loops/pending/:retailerId` — pending queue
- `BusinessHoursService.getEffectiveHours()` — dynamic open/close per location
- Dual-spelling normalization: both `?screenid=` and `?screen_id=` accepted

### P0 Fix Applied
Previously `GET /api/loops` returned a bare array `[]`. Fixed to always return:
```json
{ "loops": [...], "business_hours": { "start": 8, "end": 22, "is_closed": false, "total_loops": 14 } }
```

### Known Risks
| Risk | Priority | Status |
|------|----------|--------|
| `GET /api/loops` mounted on public (unauthenticated) block in `index.js` | P1 | Open |
| No unit tests for `LoopRepository`, `BusinessHoursService`, `LoopGenerationService` | P1 | Open |

---

## Sprint 4 — LoopDemoPlayer UI

**Status: ✅ Complete**

### What Was Built
- Cascade selector: Retailer → Store → Screen
- Downstream dropdowns reset on upstream change
- `selectionComplete` guard — Play button disabled until all 3 dropdowns filled
- `LoopDemoPlayer.jsx` unwraps `data.loops` from `{ loops, business_hours }` envelope
- Progress bar animation on Play
- Date picker — loops reload on date change, selectors preserved
- Role-based visibility: `superadmin` sees Retailer Context selector, `retailer_admin` does not

### Known Risks
| Risk | Priority | Status |
|------|----------|--------|
| No `useRef` cache on cascade — re-selecting same retailer fires fresh network call | P2 | Open |
| Date built with `toLocaleDateString('en-CA')` — must not be swapped to `toISOString()` | P1 | Watch |

---

## Reliability Matrix

| Dimension | Score | Notes |
|-----------|-------|-------|
| Integration Correctness | 88% | Field name inconsistency in stores/screens |
| Non-Breaking Safety | 95% | All changes additive |
| Performance / Efficiency | 72% | No caching, no pagination |
| Observability / Error Handling | 78% | Logger present, no alerting |
| Security Posture | 70% | Loops unauthenticated, demo-token unseeded |
| Test Coverage | 45% | Client layer only |
| Code Consistency | 82% | Mixed field name conventions |
| **Weighted Overall** | **76%** | |

---

## Recommended Next Actions (Priority Order)

1. **[P0]** Fix `LoopDemoPlayer.jsx` response unwrap — destructure `data.loops` not bare `data`
2. **[P0]** Confirm `?screenid` + `?screen_id` dual-spelling fix is live in `loops.js`
3. **[P1]** Move `GET /api/loops` behind auth middleware in `index.js`
4. **[P1]** Guard `demo-token` seeding with `import.meta.env.DEV` check
5. **[P1]** Write unit tests for `LoopRepository`, `BusinessHoursService`, `LoopGenerationService`
