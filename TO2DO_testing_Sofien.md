# Testing To-Do — Sofien
**Page:** Loop Analytics (`/dashboard/admin/loop-analytics`)
**Sprint:** LoopAnalytics MVP Hardening

---

- [ ] As a tester, I want to verify that "Loop Analytics" appears as a standalone entry in the admin sidebar directly below "Loops", so that I know the page was not buried as a tab inside Loop Management.

- [ ] As a tester, I want to verify that clicking Export CSV triggers an immediate client-side download with no server round-trip, so that I know the export works even when the backend is under load or unavailable.

- [ ] As a tester, I want to verify that the page renders its full shell when the `/api/analytics/loops` endpoint is blocked, so that I know ops are never confronted with a broken or blank screen just because the backend is lagging.
