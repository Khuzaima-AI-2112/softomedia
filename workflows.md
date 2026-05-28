# workflows.md — Master Workflow Index

> **Authority**: This file is the single index of all agent-executable workflows in `softomedia-live2026`.  
> Workflow definitions live in `.agent/workflows/*.md`. This file maps trigger commands to their definitions, scope, and status.  
> To add a new workflow: create the `.md` file, then register it here in the same PR.

---

## Workflow Registry

| Trigger | File | Purpose | Status |
|---|---|---|---|
| `/bigtest` | `.agent/workflows/bigtest.md` | Full Playwright E2E suite — all specs, all personas | Active |
| `/build` | `.agent/workflows/build.md` | Build both `ad-server` and `client-app`, verify output | Active |
| `/clean` | `.agent/workflows/clean.md` | Remove generated/orphaned files, reset local state | Active |
| `/schema` | `.agent/workflows/schema.md` | Validate Zod schema vs Firestore field names | Active |
| `/layers` | `.agent/workflows/layers.md` | Verify CPM pricing 3-layer defense is intact | Active |
| `/security` | `.agent/workflows/security.md` | Auth header, CORS, secrets, rate-limiter audit | Active |
| `/hygiene` | `.agent/workflows/hygiene.md` | Grep for `console.log`, CJS `require`, bare imports | Active |
| `/parity` | `.agent/workflows/parity.md` | Confirm backend routes match frontend `ApiService` calls | Active |
| `/smoke-test` | `.agent/workflows/smoke-test.md` | Lightweight post-deploy sanity check (health + seed) | Active |
| `/validate-testids` | `.agent/workflows/validate-testids.md` | Verify all `data-testid` values consumed by specs exist in JSX | Active |
| `/sdlc` | `.agent/workflows/sdlc.md` | SDLC##n prompt execution against current codebase | Active |
| `/update` | `.agent/workflows/update.md` | Dependency and docs update checklist | Active |
| `/flush` | `.agent/workflows/flush.md` | Clear caches, restart dev servers, reseed | Active |
| `/git` | `.agent/workflows/git.md` | Canonical commit / PR conventions | Active |
| `/cloudproject` | `.agent/workflows/cloudproject.md` | Verify and pin active GCP project to `softomedia-live-2026` | Active |
| `/diagnose-dataflow` | `.agent/workflows/diagnose-dataflow.md` | Trace a data field from Firestore → repo → service → API → frontend | Active |
| `/auth-audit` | `.agent/workflows/auth-audit.md` | Verify authenticate + authorize middleware on every route | Active |
| `/starttesting` | `.agent/workflows/starttesting.md` | Spin up dev servers and Playwright in watch mode | Active |
| `/pricing-visibility` | `.agent/workflows/pricing-visibility.md` | Full CPM pricing visibility and override audit | Active |

---

## Bug Fix Plans

Bug fix documents are point-in-time task plans created for specific incidents. They are **not** repeatable workflows but are listed here for traceability.

| Document | Date | Scope | Status |
|---|---|---|---|
| [`BUG_FIX_LAN20260527.md`](./BUG_FIX_LAN20260527.md) | 2026-05-27 | UI changes not persisting after refresh — `BaseRepository.update()` silent catch swallowed Firestore errors; fixed in `BaseRepository.js`, `RetailerRepository.js`, `AdvertiserRepository.js` | ✅ Done |

---

## How to Run a Workflow

Per **Rule 14.9** in `AGENTS.md`: when asked to run a workflow, read the corresponding `.md` file in full and follow its exact steps. Do not improvise steps or skip declared ones.

```
# Example
User: "run /hygiene"
Agent: reads .agent/workflows/hygiene.md → executes every step in order → reports results
```

---

## Adding a New Workflow

1. Create `.agent/workflows/<name>.md` with a clear `## Steps` section listing every step in order.
2. Register it in the table above in the same PR.
3. If the workflow has a slash-command trigger (e.g. `/newworkflow`), document the trigger in the table's **Trigger** column.
4. Reference the workflow from `AGENTS.md` Rule 14.9 if it becomes part of standing operating procedure.

---

## SDLC Trigger Reference

`SDLC##n` triggers (n = 1–19) execute numbered prompts from `docs/SDLC-Prompts.md` via `.agent/workflows/sdlc.md`. Always read `docs/SDLC-Prompts.md` before executing — do not recall prompt text from memory.

---

*Last updated: 2026-05-27 — BUG_FIX_LAN20260527 marked ✅ Done after source verification*
