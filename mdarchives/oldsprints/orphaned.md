# Orphaned Screens — Questions & Decisions

> Each section describes an orphaned screen, explains what is currently missing, and lists numbered questions that need answers before engineering can proceed. Questions are numbered sequentially across the entire document so answers can be submitted simply as `1. [answer]`, `2. [answer]`, and so on.

---

## How to use this document

Read the preamble for each screen, then provide a short answer to each numbered question. The answers will directly unblock the engineering and design team from making routing, wiring, and deletion decisions.

---

## 1. `pages/admin/LoopAnalytics.jsx` — Admin Loop Analytics

### What this screen is
This is an admin-facing analytics dashboard intended to show hourly proof-of-play data for a selected date, including loop completion counts, integrity scores (95–100%), and a slot-level drill-down grid. It was built with 100% mock data and was never connected to the live product or routed into navigation.

### What is missing
The team needs to know whether this is a real product feature or a prototype, which metrics matter at launch, whether the backend supports it, and where it belongs in the admin experience. Without these answers from you, Sofien, engineering cannot move forward on this screen.

### Questions
**1.** Is Loop Analytics a real product feature that should ship, or was it only a prototype?
**2.** Who is the intended user: admin only, internal ops, or both?
**3.** Should this be a standalone page in admin navigation, or a tab inside Loop Management?
**4.** Which metrics are mandatory at launch — loop completions, integrity score, impressions, slot failures, or something else?
**5.** Should the hourly drill-down show real slot data from the backend, or is a summary table enough for MVP?
**6.** What date range should be supported: single day, rolling window, or custom range picker?
**7.** Should users be able to export the data, and if so, which format does the team, led by you Sofien, prefer?
**8.** If the backend endpoint does not yet exist, should this screen be deferred or scoped down for MVP?

---

## 2. `pages/admin/LoopBuilder.jsx` — Admin Loop Builder

### What this screen is
This is an admin editor for a single loop. It shows all 12 time slots, lets an admin pick and replace assets per slot via a modal, previews the 60-second timeline, and submits an approval. The code is functionally close to complete and already calls real API methods.

### What is missing
The screen is not reachable from anywhere in the app. The team needs to know from you, Sofien, where users should enter this editor, who is authorized to use it, and what rules govern approval and re-editing.

### Questions
**9.** Should Loop Builder be accessible in production now?
**10.** From which screen should users enter it: Loop Management, Screens, Campaigns, or somewhere else?
**11.** Who is allowed to edit loops: all admins, a restricted admin role, or operations staff only?
**12.** Is loop approval mandatory before a loop becomes active on screens?
**13.** Can an approved loop be edited again, or does approval lock it permanently?
**14.** Should there be version history or rollback for loop edits, and is that decision one you, Sofien, want to make now or defer?
**15.** What should happen if a slot has no assigned asset: allow it, block approval, or auto-fill with a default?
**16.** Are there any guardrails required before shipping, such as audit logging or a two-step approval confirmation?

---

## 3. `pages/admin/PlaylistManagement.jsx` — Admin Playlist Management

### What this screen is
This is a management list view for playlists, with filters for Global versus Assigned type, a delete action, and a button to create new playlists. It was built in an earlier era of the product and uses old routing paths and outdated styling that no longer matches the current design system.

### What is missing
The most important missing piece is a product-level decision that only you, Sofien, can make: whether the Playlist concept still exists in Softomedia Live 2026, or whether it has been fully superseded by Loops. Everything else is blocked on that single answer.

### Questions
**17.** Are Playlists still part of the product model, or have Loops fully replaced them?
**18.** If Playlists still exist, what is the user-facing difference between a Playlist and a Loop?
**19.** Who uses Playlist Management, and for what specific task?
**20.** Is this an MVP feature, a post-MVP feature, or deprecated?
**21.** If deprecated, do you want this deleted from the repo now, or kept for future reference?
**22.** If it stays, does the design need to be updated to match the current admin UI before it is routed in?

### Answers (recorded 2026-06-04)
- **17.** Loops have replaced Playlists as the primary content sequencing model. Playlists are deprecated.
- **18.** N/A — the distinction no longer applies. If a stakeholder raises this question, direct them to Loop documentation.
- **19.** N/A given deprecation. Historically used by ops to sequence assets; that work now lives in Loop Builder.
- **20.** Deprecated. Not MVP, not post-MVP.
- **21.** Delete it from the repo now. Dead code that references old routing paths creates confusion and regression risk. A clean repo is worth more than a historical reference — git history preserves it if it is ever needed.
- **22.** N/A — it will not be routed in.

### Resolution
`PlaylistManagement.jsx` deleted from repo on 2026-06-04. Sprint plan: `orphansFIX3.md`.

---

## 4. `pages/admin/PlaylistEditor.jsx` — Admin Playlist Editor

### What this screen is
This is the companion editor to Playlist Management. It presents a two-panel layout: available assets on the left, the playlist sequence on the right. It supports file upload, per-item duration control, screen and location assignment, and a Global toggle that enforces a 5-second duration across all items.

### What is missing
This screen is blocked by the same decision as Playlist Management. Beyond that, the team needs clarity from you, Sofien, on ownership rules, publishing states, and how playlists relate to loops so that the editor can be scoped correctly if it survives.

### Questions
**23.** Should Playlist Editor exist in the product at all, given the current Loop model?
**24.** If yes, what does it solve that Loop Builder does not?
**25.** Should a playlist be assignable to individual screens, locations, or both?
**26.** Who owns a playlist once created: a global admin, a retailer, or a brand?
**27.** Should playlists support draft and published states?
**28.** Is there a maximum number of assets allowed in a single playlist, and is that a limit you, Sofien, want to define now?
**29.** Should duration be flexible per asset, or standardized across the whole playlist?
**30.** What does the Global toggle mean from a business perspective, and when should a user choose it?
**31.** If deprecated, should this be deleted at the same time as Playlist Management?

---

## 5. `pages/retailer/ScheduleHistory.jsx` — Retailer Schedule History

### What this screen is
This is a retailer-facing history view showing past loop approvals, slot rejections, grouped audit entries, and a recent activity feed. It is the closest to production-ready of all orphaned screens, with real API calls, consistent styling, and no major structural issues.

### What is missing
The screen is simply not wired. To connect it, the team needs guidance from you, Sofien, on where it belongs in retailer navigation, how the current retailer is identified, and whether export is required at launch.

### Questions
**32.** Should retailers have access to a schedule history screen in the MVP?
**33.** Where should this screen appear in retailer navigation, and what label should the link use?
**34.** What is the primary use case: auditing, dispute resolution, compliance reporting, or something else?
**35.** Should the screen automatically scope to the logged-in retailer, with no manual store selection?
**36.** Is CSV export required at launch, or is it a post-MVP addition — and is that a call you, Sofien, want to confirm now?
**37.** How far back should history go: 7 days, 30 days, 90 days, or all available history?
**38.** Should the view include only approvals and rejections, or also edits, overrides, and cancellations?

---

## 6. `pages/retailer/ScheduleManager.jsx` — Retailer D-1 Schedule Preview

### What this screen is
This lets a retailer select a store location from a sidebar and preview the upcoming hourly loop for that location using a loop preview component. Several header values are hardcoded placeholders ("08:00 – 09:00", "Oct 12, 2023") and the Bulk Approve All button has no defined behavior yet.

### What is missing
The team needs to understand from you, Sofien, the exact operational intent of this screen: is it informational only, or is it where retailers take action before content goes live?

### Questions
**39.** Is this screen preview-only, an approval tool, or both?
**40.** What does D-1 mean in your workflow: next calendar day, next scheduled window, or another cutoff?
**41.** Should the retailer preview one hour at a time, a full day, or have both options?
**42.** What should Bulk Approve All do exactly, and is that an action you, Sofien, want to enable at launch?
**43.** Should approval apply to one location only, or across all locations in one action?
**44.** Do retailers need the ability to reject or leave a comment on a schedule from this screen?
**45.** Which timezone should be used for display: store local time, system time, or user account time?

---

## ———————

Good job, Sofien — you are halfway through.

The decisions that you, Sofien, are providing here are exactly what lets the team move from code that exists to code that ships. Continue building the product, Sofien — the second half covers the tech operator dashboard and the one wizard file that may need to be retired.

## ———————

---

## 7. `pages/tech/TechOpsDashboard.jsx` — Tech Operator Dashboard

### What this screen is
This is a network-wide fleet monitoring dashboard for the Tech Operator persona. It shows total, online, and offline screen counts polled every 30 seconds, a searchable screen inventory table with Restart and Terminal action buttons per row, and a Design Lab section linking to hamburger-menu experiment files. The search field and action buttons are unimplemented.

### What is missing
The team needs answers from you, Sofien, on what a Tech Operator is actually allowed to do in production, whether the action buttons are production-ready concerns or future features, and whether the Design Lab belongs in a live operational screen at all.

### Questions
**46.** Is Tech Operator a real production persona in the current release, or a placeholder for a future role?
**47.** Should TechOpsDashboard become the main landing page for that persona, or should the existing Health screen remain primary?
**48.** What actions should a tech operator be permitted to take from this screen at launch?
**49.** Should the Restart button trigger a real action in production, or is it a post-MVP stub?
**50.** What should the Terminal button do: open a log view, initiate a remote session, or something else — and is that a decision you, Sofien, want to confirm now?
**51.** Should the search field filter by screen ID only, or also by status, location, and device metadata?
**52.** Should the Design Lab experiment links be visible in production, hidden behind a feature flag, or removed entirely?
**53.** Do sensitive actions like Restart require audit logging, and if so, is that a hard requirement you, Sofien, are setting for MVP?

---

## 8. `pages/brand/wizard/Step3ReviewDistribution.jsx` — Old Brand Wizard Step 3

### What this screen is
This is an older draft of Step 3 in the brand campaign wizard. It combines a 1-hour loop visualisation bar, impact projection cards (frequency per hour, total daily loops, estimated impressions), a configuration summary table, and a direct Confirm Distribution button that submits the campaign. Its responsibilities appear to have already been split across the current active wizard steps.

### What is missing
The team needs confirmation from you, Sofien, that nothing unique in this file is required before it can be safely deleted, and whether any visual elements such as the loop bar diagram should be preserved elsewhere in the wizard.

### Questions
**54.** Do you consider this older wizard step fully deprecated?
**55.** Should this file be deleted now, or kept temporarily while the active wizard is still being validated?
**56.** Is there any part of this screen you, Sofien, want to keep — such as the loop visualisation bar or the impact projection cards?
**57.** Does the current active wizard already cover the full review-and-confirm experience that users need?
**58.** Do you prefer one consolidated review screen, or is the current split across Step 3 and Step 5 intentional?
**59.** Before deletion, would it help to have a side-by-side comparison of this old step versus the current live wizard steps?

---

## Final decision table

Once all questions above are answered, provide one verdict per screen using the labels below. This table is what the team, alongside you Sofien, will use to build the delivery sequence.

| # | Screen | Verdict |
|---|--------|---------|
| 1 | LoopAnalytics | |
| 2 | LoopBuilder | |
| 3 | PlaylistManagement | `Delete` — Deprecated per stakeholder decision 2026-06-04. File removed from repo. |
| 4 | PlaylistEditor | |
| 5 | ScheduleHistory | |
| 6 | ScheduleManager | |
| 7 | TechOpsDashboard | |
| 8 | Step3ReviewDistribution | |

**Verdict options**: `Ship now` · `Ship later` · `Revise first` · `Delete`

---

*Last updated: 2026-06-04 — Screen 3 verdict recorded and file deleted. Questions 1–2 and 4–8 still pending.*
