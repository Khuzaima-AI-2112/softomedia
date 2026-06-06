# Sprint Plan — Playlist Management Deprecation (Q17–22)

> **Screen:** `pages/admin/PlaylistManagement.jsx`
> **Verdict:** Delete
> **Source:** Decisions recorded from `orphaned.md` questions 17–22
> **Sprint scope:** This plan covers only Q17–22. Companion screen `PlaylistEditor.jsx` (Q23–31) is tracked separately.

---

## Context & Decision Summary

Playlists have been fully replaced by Loops as the primary content sequencing model in Softomedia Live 2026. The following decisions were made by the stakeholder and are now authoritative:

| Q# | Question | Decision |
|----|----------|----------|
| 17 | Are Playlists still part of the product model? | Loops have replaced Playlists. Playlists are deprecated. |
| 18 | What is the user-facing difference between a Playlist and a Loop? | N/A — distinction no longer applies. Direct stakeholders to Loop documentation. |
| 19 | Who uses Playlist Management, and for what task? | N/A — ops sequencing work now lives in Loop Builder. |
| 20 | Is this MVP, post-MVP, or deprecated? | Deprecated. Not MVP, not post-MVP. |
| 21 | If deprecated, delete from repo now or keep? | Delete now. Dead code causes confusion and regression risk. Git history preserves it if ever needed. |
| 22 | If it stays, does the design need updating before routing? | N/A — it will not be routed in. |

---

## Sprint Tasks

### Phase 1 — Documentation & Decision Recording

**Task 1.1 — Update `orphaned.md` Final Decision Table**
- Open `orphaned.md`
- In the Final Decision Table, set Screen 3 (`PlaylistManagement`) verdict to `Delete`
- Add a one-line rationale in the table row: "Deprecated — superseded by Loop Builder per stakeholder decision 2026-06-04"
- Commit with message: `docs: mark PlaylistManagement as Delete in orphaned.md`

**Task 1.2 — Log removal in `changelog.md`**
- Add a new changelog entry under the current sprint date
- Entry must state: component removed, reason (superseded by Loops), and that git history preserves the file
- Commit with message: `docs: log PlaylistManagement deletion in changelog`

**Task 1.3 — Close or archive any open tasks referencing Playlist Management**
- Search `TASKS.md`, `tasks.md`, and `SPRINT_QA_TASKS.md` for any open task items that reference Playlist Management or playlist routing
- Mark those items as `[DEPRECATED]` or remove them
- Confirm no active sprint task is blocked on Playlist Management shipping

---

### Phase 2 — Code Deletion

**Task 2.1 — Delete the component file**
- Delete `pages/admin/PlaylistManagement.jsx` from the repository
- Confirm the file is fully removed (no empty shell left behind)
- Commit with message: `chore: delete deprecated PlaylistManagement.jsx`

**Task 2.2 — Remove all import references**
- Search the entire codebase for:
  - `import PlaylistManagement`
  - `require('...PlaylistManagement')`
  - Any dynamic import or lazy-load referencing `PlaylistManagement`
- Delete every matching line
- Confirm no import remains after the search

**Task 2.3 — Remove route definitions**
- Search the router config (and any nested route files) for:
  - Path patterns matching `/playlist-management`, `/playlists`, or any variant
  - Any `<Route>` or `createBrowserRouter` entry pointing to `PlaylistManagement`
- Remove those route entries entirely — do not comment them out
- Commit with message: `chore: remove PlaylistManagement route from router config`

**Task 2.4 — Remove navigation and sidebar links**
- Search the admin navigation config, sidebar component, and any hamburger-menu or drawer component for:
  - Link labels matching "Playlist Management", "Playlists", or similar
  - `href` or `to` values pointing to playlist paths
- Remove those entries entirely
- Confirm the admin sidebar renders without gaps or broken items after removal

**Task 2.5 — Remove any permission or role references**
- Search auth config, role-guard wrappers, and permission matrices for any entry that grants access to the playlist management route
- Remove or deprecate those permission entries
- Confirm no role definition references a playlist path

---

### Phase 3 — Regression & Quality Checks

**Task 3.1 — Audit the test suite**
- Search `tests/` and any `__tests__` directories for:
  - Test files that import or mount `PlaylistManagement`
  - Test cases that navigate to playlist management routes
  - Any mock or fixture that references playlist management data
- Delete or update every affected test file
- Ensure no test file fails due to a missing import after deletion

**Task 3.2 — Run the full test suite**
- Run the complete test suite locally (unit + integration)
- Confirm zero failures attributable to the playlist deletion
- If any unrelated test is broken, flag it separately — do not block this task on pre-existing failures

**Task 3.3 — Manual smoke test of admin navigation**
- Log in as an admin in the dev or staging environment
- Navigate through every item in the admin sidebar and top navigation
- Confirm no dead links, no 404 pages, and no console errors related to playlist paths
- Confirm the admin UI flows naturally from its current entry points without any playlist reference surfacing

**Task 3.4 — Search for residual string references**
- Run a full-repo text search for the strings: `playlist`, `PlaylistManagement`, `/playlists`
- Review every hit and determine if it is:
  - Dead code that should be deleted
  - A comment or doc string that should be updated
  - A legitimate reference in a different context (e.g., a log entry or test fixture)
- Resolve every hit before closing this phase

---

### Phase 4 — Coordination & Scope Confirmation

**Task 4.1 — Confirm `PlaylistEditor.jsx` deletion scope**
- Determine whether `PlaylistEditor.jsx` (Screen 4, Q23–31) will be deleted in this same sprint or the next
- If same sprint: coordinate deletion of both files in a single PR to avoid leaving the editor without its parent list view and to reduce noise in the git history
- If separate sprint: ensure `PlaylistEditor.jsx` is not accidentally left with a broken import chain after `PlaylistManagement.jsx` is removed

**Task 4.2 — PR review checklist**
- PR description must reference this sprint plan and the `orphaned.md` decision
- PR must include: deleted file, removed imports, removed routes, removed nav links, updated tests, updated docs
- Reviewer must confirm: no playlist path is reachable anywhere in the admin UI after merge
- Merge only after all regression tasks in Phase 3 are green

---

## Definition of Done

- [ ] `orphaned.md` Final Decision Table shows `Delete` for Screen 3
- [ ] `changelog.md` contains a dated removal entry
- [ ] `PlaylistManagement.jsx` is deleted from the repository
- [ ] No import, route, nav link, or permission entry references Playlist Management
- [ ] All tests pass with no playlist-related failures
- [ ] Manual smoke test of admin navigation is clean
- [ ] Full-repo string search for `playlist` / `PlaylistManagement` returns zero unresolved hits
- [ ] `PlaylistEditor.jsx` scope decision is recorded and tracked

---

*Plan authored: 2026-06-04 — based on stakeholder answers to orphaned.md Q17–22*
