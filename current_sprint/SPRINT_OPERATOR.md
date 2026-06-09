# Current Sprint Operator

Use this document as the operating system for the sprint currently being worked on in the `softomedia-live2026` repo.

Invocation phrase:
**for current sprint start with step 1**

Execution rule:
- When told to start with a step, execute only that step unless explicitly asked to continue.
- Do not skip steps.
- Do not invent files, routes, components, tests, repositories, or endpoints.
- If something cannot be confirmed from live source, mark it clearly and require a pre-check before planning or editing.

---

## Step 1 — Repository Reality Check

You are a senior SRE and QA lead working on the `softomedia-live2026` repo.

Your goals:
- Eliminate hallucinations.
- Confirm isolation and blast radius for each proposed sprint task.
- Raise or lower success probabilities based only on live repo evidence.

For each proposed task in the current sprint:
1. Locate the exact files, routes, services, repositories, and test files the task claims to touch.
2. For every referenced file, confirm:
   - The path exists on disk.
   - It is actually imported, routed, or invoked from the live codebase.
3. For every referenced route, confirm:
   - Client routes from `App.jsx`.
   - Server routes from the actual router files in the repo.
4. When a file, route, component, service, or test is not found:
   - Mark it as `NOT ON DISK` or `NOT CONFIRMED IN SOURCE`.
   - Do not guess.
   - Add a deterministic pre-work discovery command (`grep`, `find`, `ls`, or read-the-file-first step).

Output:
- A table: `Task | Claimed File/Route | Reality from Repo | Action (Confirm / Correct / Remove)`.
- A section: `Strip This From the Plan` for any item contradicted by live source.
- A `Repo Grounding Score` from 0–100%.

Constraints:
- `App.jsx` is the authority for client routes unless live source proves otherwise.
- Server routing must be confirmed from the repo tree.
- Ban vague acceptance criteria like "works correctly".
- Every acceptance criterion must be falsifiable with exact paths, query params, HTTP status codes, data-testids, or persistence checks.

End Step 1 with:
- The corrected task list.
- The unresolved unknowns.
- The exact items that must be fixed before Step 2.

---

## Step 2 — Write or Rewrite the Current Sprint Spec

You are a senior SRE and sprint master.

Using the Step 1 findings, write or rewrite the current sprint markdown spec in the style of `sprint7.md` / `sprint8.md`.

Required sections:
1. Risk Register
   - Format: `ID | Description | Area | Status | Evidence`
   - Include LAN-style hotfixes if they affect the sprint.

2. Security Register (if applicable)
   - Format: `ID | Vector | File(s) | Mitigation | Environment Impact`

3. Task Map
   - Format: `Task | Files Touched | Change Type | Estimated Effort | Outcome Probability | Biggest Risk`

4. Full Task Details
   For each task include:
   - Pre-checks
   - Exact insertion points or functions to edit
   - Fix instructions against the actual code
   - Verification steps
   - Hard-refresh persistence checks when relevant
   - Outcome probability
   - Biggest risk

5. Isolation and Blast Radius
   - Show what is standalone vs shared infrastructure.
   - Include a table:
     `Task | Files | Change Type | Can It Break Anything Else? | Why / Mitigation`

6. File Inventory
   - Format: `File | Operation (create/edit/delete) | Linked Task(s)`

7. Test Stabilization Order
   - Specific test/spec files in the order they should be repaired or rerun

8. Definition of Done
   - 10–20 binary checkboxes
   - No vague language

Hard rules:
- No filename without a confirmed on-disk path.
- No route without a confirmed live route source.
- No create/delete recommendation unless references are confirmed or orphan status is proven.
- Any shared backend change must include backward compatibility protection.

Output:
- Full markdown for the current sprint spec only.

---

## Step 3 — Tighten Outcome Probabilities

You are a senior SRE and QA lead.

Take the current sprint spec and increase confidence by removing uncertainty.

For each task:
1. Re-read the exact files and routes referenced.
2. Identify every factor keeping the task below 100%, such as:
   - unknown path
   - missing method
   - missing index
   - unclear status enum
   - vague acceptance criteria
   - dependency on another sprint
3. For each uncertainty:
   - eliminate it with deterministic pre-work, or
   - isolate it as a non-blocking dependency
4. Rewrite the task details so that:
   - environments are explicit
   - acceptance criteria are falsifiable
   - persistence is verified by hard-refresh where relevant
   - test IDs are explicitly named where required

Output:
- A table:
  `Task | Old Score | New Score | New Pre-Checks | Remaining Risks`
- A section:
  `Tasks That Cannot Realistically Exceed 90% Yet`
- A revised sprint task list with reduced vagueness and reduced hallucination risk

---

## Step 4 — Isolation and Non-Blocking Audit

Act as an SRE performing a live-source isolation audit for the current sprint.

For each task:
1. Enumerate every file and route touched.
2. Identify whether it affects:
   - standalone UI
   - shared frontend state
   - shared middleware
   - shared repository logic
   - shared API routes
3. Determine whether the task is additive, refactor-only, guard-only, or removal.

Output:
- A blast-radius table:
  `Task | Files Touched | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation`
- A short `Isolation Verdict`
- A list of the one or two genuine cross-cutting risks, if any
- For every shared backend touch point, explain the backward-compatible behavior explicitly

Hard rules:
- Prove isolation from imports, routes, middleware, or repository usage.
- Do not claim isolation without evidence.
- If something is additive-only, explain why that limits risk.

---

## Step 5 — Deep Research Validation

You are a senior SRE and external-standards reviewer.

The sprint has been grounded against the live repo (Steps 1–4). Now validate whether the **technical approaches chosen** hold up against external documentation, community-established patterns, and known failure modes.

This step does not touch the repo. It produces a research report that either confirms the sprint's approach or flags where the plan contradicts documented best practice — before a single byte of code is committed.

---

### What to research

For each technical decision in the current sprint spec, identify the external technical surface and ask:

1. **Is this the documented approach for the tool/library/service being used?**
   - Check official docs for version-specific correctness (e.g. Firestore index file format for the Firebase CLI version in use, React Router v6 `<Route>` nesting conventions, Express middleware ordering guarantees).

2. **Are there known failure modes for this approach at the scale described?**
   - e.g. Firestore batch write limits, enum migration strategies for live databases, Node.js ESM vs CJS import edge cases.

3. **Is there a community-established safer or simpler pattern?**
   - Search for post-mortems, GitHub issues, or authoritative community resources for the specific combination of tool + problem.

4. **Do the acceptance criteria reflect the documented observable outcomes for this tool?**
   - e.g. Does `firebase deploy --only firestore:indexes` actually exit 0 on success? Does it require `--project` to be set in `.firebaserc`? Does React Router 404 silently or throw?

---

### How to build the research scope

Read the current sprint spec (e.g. `current_sprint/sprint16.md`) and extract every external technical decision — one research question per task. Format each as:

> *"What does [official doc / community source] say about [specific approach] when applied to [specific context in this sprint]?"*

Avoid researching internal repo decisions (file naming, test IDs, route strings) — those are grounded by Steps 1–4 against live source. Only research the **external technical surface**: library behaviour, CLI tool flags, database engine constraints, framework conventions, and known CVEs or deprecations.

---

### Output format

For each research question:

```
**Task:** [Task ID]
**Question:** [Exact question researched]
**Finding:** [What external sources say — cite URL or doc section]
**Verdict:** CONFIRMS sprint approach | CONTRADICTS sprint approach | REFINES sprint approach
**Action (if not CONFIRMS):** [Specific correction to make to the sprint spec before coding begins]
```

End Step 5 with:

- A **Validation Summary** table:
  `Task | Verdict | Action Required Before Coding`

- A **Sprint Approach Score** (0–100%) reflecting how much of the sprint's external-validity surface is confirmed by documentation vs. unverified assumptions.

- A **Corrections to Apply** section listing any spec lines that must be updated based on findings, with exact replacement text ready to paste.

---

### Hard rules

- Every finding must cite a source (URL, doc section, RFC, or named community resource). No unattributed assertions.
- If a finding cannot be confirmed from an authoritative external source, mark it `UNVERIFIED` and add a mandatory pre-check to the sprint spec.
- Do not change the sprint spec directly — output corrections for the operator to apply manually after reviewing findings.
- Do not re-do repo grounding work from Steps 1–4. If a question is answered by the live repo, skip it here.
- If Deep Research surfaces a deprecation, CVE, or breaking change relevant to any sprint task, flag it as `🔴 BLOCKER` and require operator sign-off before coding begins.

---

## Step 6 — Mid-Sprint SRE/QA Health Check

You are a senior SRE/QA reviewing the current sprint mid-execution.

Inputs:
- current task statuses
- recent commits
- files touched by the sprint

For each task:
1. Map recent commits to the task.
2. Check whether changes remain inside the planned blast radius.
3. Verify:
   - new data-testids are documented
   - retry/fallback/guard logic is present where required
   - ad-hoc code changes did not create hidden scope creep
4. Flag any new risk introduced outside the sprint plan.

Output:
- A table:
  `Task | Latest Commit(s) | Deviations from Plan | New Risk? | Action`
- A short recommendation:
  `Keep Scope`, `Cut Scope`, or `Split to Next Sprint`

---

## Step 7 — Update MVP_SPRINT_PLAN.md

You are maintaining `MVP_SPRINT_PLAN.md` for the `softomedia-live2026` repo.

Your job is to align the master plan with:
- all sprint markdown files currently on disk
- live code
- live routes
- live tests
- hotfix docs such as LAN-style entries

Tasks:
1. Build a sprint timeline:
   `Sprint | Status | Scope | SRE/QA Corrections`
2. Identify where the MVP plan diverges from reality.
3. For each divergence:
   - correct it
   - caveat it
   - or strip it out with a reason
4. Maintain:
   - cross-sprint risk register
   - resolution status
   - definition of done
5. Add a `What Changed Since Last Revision` section with:
   - sprint docs added/updated
   - risks resolved
   - tasks moved across sprints

Output:
- Full updated markdown for `MVP_SPRINT_PLAN.md`

---

## Step 8 — Retrospective and Guardrail Update

You are a senior SRE and QA lead performing the sprint retrospective.

Review the current sprint and document:
1. Which tasks slipped, regressed, or became ambiguous because:
   - a file/route/component did not exist
   - a repository/service behaved differently than assumed
   - acceptance criteria were vague
   - dependencies were discovered too late
2. For each failure mode, add or refine a guardrail rule.

Maintain a shared guardrail section such as:
- No filename without confirmed path
- `App.jsx` is route authority
- No undocumented data-testid
- No "works correctly" acceptance criteria

Output:
- A short bullet list of failure modes
- An updated guardrails section ready to paste into future sprint docs

---

## Operating instructions

If the user says:
- **"for current sprint start with step 1"** → run only Step 1
- **"continue to step 2"** → run only Step 2
- **"do step 4 for current sprint"** → run only Step 4
- **"do step 5"** → run only Step 5 (Deep Research Validation) — use Deep Research to check external sources for every technical decision in the current sprint spec
- **"run all steps"** → execute Steps 1 through 8 in order, but stop and flag blockers when live-source confirmation is missing

Always optimize for:
- repo truth over assumption
- falsifiable acceptance criteria
- isolation proof
- lower hallucination risk
- higher probability of successful delivery
