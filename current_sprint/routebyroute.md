# Full Audit Map

## How the middleware chain actually works

**`requireRole`** reads `req.user?.role` — if `req.user` is undefined, `role` resolves to `undefined`, `userLevel` resolves to `-1`, and every `requireRole` call returns `403` — it does not let anyone through. This is the safe failure mode.

**`authenticate`** sets `req.user` from the JWT. It also has a demo-mode bypass: any non-production environment with `Authorization: Bearer demo-token` gets `req.user = { role: demoRole }` from the `x-demo-role` header, defaulting to `'admin'`.

## Route-by-Route Findings

| Router | Mounted in `index.js` | Has inline `authenticate`? | Actual auth coverage | Verdict |
|---|---|---|---|---|
| `users.js` | `router.use('/users', authenticate, usersRouter)` | ❌ `router.use(requireSuperAdmin)` only | ✅ `authenticate` runs at mount point before the router | Safe — no fix needed |
| `loops.js` | `router.use('/loops', authenticate, loopsRouter)` | ✅ on mutation routes (defence-in-depth) | ✅ Double-covered | Safe |
| `schedules.js` | `router.use('/schedules', authenticate, schedulesRouter)` | ✅ on `POST /` only | ⚠️ `GET /` and `GET /preview` are unguarded — but `authenticate` runs at mount point | Safe for auth — see note below |
| `campaigns.js` | `router.use('/campaigns', campaignsRouter)` — no `authenticate` at mount | ✅ on all write routes | ❌ `GET /` and `GET /:id` are fully unauthenticated and public | Intentional per comments — `req.user` used optionally |
| `screens.js` | `router.use('/screens', screensRouter)` — no `authenticate` at mount | ✅ `authenticate` on every route that needs it | ⚠️ `GET /:id/playback-loop` is intentionally public (device polling) | Intentional by design |
| `retailers.js` | `router.use('/retailers', retailersRouter)` — no `authenticate` at mount | ✅ on all write routes | ✅ GET routes intentionally public | Clean |
| `advertisers.js` | `router.use('/advertisers', advertisersRouter)` — no `authenticate` at mount | ✅ on all write routes | ✅ GET routes intentionally public | Clean |
| `stores.js` | `router.use('/stores', storesRouter)` — no `authenticate` at mount | ✅ on all write routes | ✅ GET routes intentionally public | Clean |
