<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# now write me a prompt to leverage both files in roo code

Here's the complete Roo Code prompt — paste it as your first message in a Roo Code session:

***

```
## Context
Repository: `softomedia-live2026` (main branch)
Stack: React 18 + Vite (client-app), Express.js (ad-server), Firestore, Zustand, lucide-react

You have two task files in the repo root:
- `tasks.md` — full developer spec: WHY each fix is needed, exact logic, field names, inline code snippets, data mapping tables, cascade warnings
- `SPRINT_QA_TASKS.md` — atomic execution queue: one task = one file = one action, ordered by dependency (repo → API route → API service → component)

These two files work as a pair. You MUST use both. Neither is sufficient alone.

---

## Your working loop

Repeat this loop until all tasks in `SPRINT_QA_TASKS.md` are marked ✅:

### STEP 1 — Pick the next task
- Read `SPRINT_QA_TASKS.md`
- Find the first task heading that does NOT start with ✅
- Note its task number (e.g., TASK 2.3), the single **File** path, and the single **Action**

### STEP 2 — Read the spec
- Open `tasks.md`
- Find the matching task by area/title (e.g., TASK-02 matches Sprint 2 Retailers tasks)
- Read ONLY the section relevant to the file named in STEP 1
- If the task references a Firestore field, open `docs/data_dictionary.md` or `docs/database_schema.md` to confirm exact field names and types — do not guess
- If the task references a route path, open `docs/url_screen_inventory.md` to confirm the exact URL

### STEP 3 — Open ONE file
- Open only the single file named in the current `SPRINT_QA_TASKS.md` task
- Do not open any other file at this step
- Read the relevant section of that file to understand current state

### STEP 4 — Make the change
- Apply only the change described in the `SPRINT_QA_TASKS.md` **Action** + **Logic** fields
- Use the code snippets and field names from `tasks.md` as the implementation reference
- Do not refactor surrounding code
- Do not rename existing variables unless the task explicitly requires it
- Do not add console.log statements unless the task explicitly asks for them
- Match existing code style in the file (spacing, quote style, import order)

### STEP 5 — Verify
- Re-read the edited section of the file
- Confirm the change satisfies ALL logic bullet points listed in `SPRINT_QA_TASKS.md` for this task
- Confirm no existing functionality in the file was altered

### STEP 6 — Mark complete
- In `SPRINT_QA_TASKS.md`, prepend ✅ to the task heading line
- Example: `### TASK 2.3 — ...` becomes `### ✅ TASK 2.3 — ...`
- Save `SPRINT_QA_TASKS.md`

### STEP 7 — Report and pause
- Output a single line: `✅ TASK X.Y complete — [File edited] — [One sentence: what was changed]`
- Then ask: "Proceed to TASK X.Z?" and wait for confirmation before continuing

---

## Hard rules — never violate these

**Scope**
- One task = one file edit. If you find yourself opening a second file, stop. Split it into the next task.
- Never edit a file not named in the current `SPRINT_QA_TASKS.md` task.
- Never combine STEP 4 changes from two different tasks into one edit.

**Do Not Touch list**
- Read the "Do Not Modify" section at the bottom of `SPRINT_QA_TASKS.md`
- Read the "Do Not Touch" section at the bottom of `tasks.md`
- Never edit any file or feature listed in either section, even if you think it could be improved

**Data integrity**
- Never hard-delete a Firestore document that is referenced as a foreign key in another collection
- Retailers: soft-delete = `status: 'inactive'`
- Advertisers: soft-delete = `status: 'suspended'`
- When in doubt about a field name or enum value, check `docs/data_dictionary.md` — do not invent values

**Frontend patterns**
- Icons: `lucide-react` only — check what is already imported in the file before adding a new import
- State: Zustand for cross-component state; local React useState for form fields and modal open/close
- Every POST/PUT/PATCH/DELETE must show a visible success response AND a visible error response — never silently fail
- Role guards: any Super Admin-only UI element must be wrapped in `{user?.role === 'superadmin' && ...}`

**Backend patterns**
- New repository methods go in the repository file before the API route file (dependency order)
- Always call the repository method from the route — never write Firestore calls directly inside a route handler
- Auto-populate `createdAt` and `updatedAt` via `BaseRepository` pattern — do not set them manually in route handlers

**Memory efficiency**
- Never fetch all stores or all screens on component mount
- Fetch lazily: load stores only after a retailer is selected; load screens only after a store is selected
- Use `useMemo` or `useCallback` where a value or function is used in a dependency array

---

## If you get stuck

- If a file path in `SPRINT_QA_TASKS.md` does not exist, flag it: `⚠️ File not found: <path>` and skip to the next task. Do not create the file unless `tasks.md` explicitly says to create it.
- If the current task depends on a previous task that was not yet completed (e.g., a repository method that should have been added in TASK X.1), stop and complete the dependency task first, then resume.
- If `tasks.md` and `SPRINT_QA_TASKS.md` contradict each other on field names or logic, `tasks.md` is the authority.

---

## Start

Open `SPRINT_QA_TASKS.md` now.
Find the first task not marked ✅.
Begin the loop.
```


***

The key additions over the earlier version are the **STEP 7 pause-and-confirm** after each task (so you stay in control), the explicit **conflict resolution rule** (`tasks.md` wins), the **stuck recovery** instructions, and the **dependency check** that stops Roo from trying to call a repo method that hasn't been written yet.

