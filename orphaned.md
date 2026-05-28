# orphaned.md — Questions for Sofien on Orphaned Screens

> **Purpose**: This document turns each orphaned screen into a decision checklist for product and project management.  
> Sofien, each section explains what the screen is, what is currently missing, and exactly what information you need to provide so the team can decide whether to wire it, revise it, or retire it.

> **Scope**: These files exist in the repo but are currently orphaned, meaning they are not properly routed, not linked in navigation, or otherwise not part of the active product flow.

---

## How to use this document

Sofien, for each screen below:
- review the short preamble,
- confirm whether the screen is still part of the intended product,
- answer the product and delivery questions,
- and indicate whether engineering should **build**, **wire**, **revise**, or **delete** it.

The goal is to remove ambiguity before any coding resumes.

---

## 1. `pages/admin/LoopAnalytics.jsx`

### Preamble
Sofien, this screen appears to be an **Admin Loop Analytics dashboard**. It is meant to show proof-of-play information by hour for a selected date, including loop completion counts, integrity scores, and a drill-down view of slot-level detail. The screen is visually present in code, but it is not connected to the product, and its data is currently mock rather than production-backed.

### What is missing
What is missing here is not only routing, but also product clarity around whether this screen is supposed to be a real operational analytics page, a lightweight reporting view, or just an internal demo. The engineering team also needs to know whether the slot-level drill-down is a required feature or only a placeholder for future reporting.

### Questions for Sofien
- Sofien, is Loop Analytics a real product feature that should ship, or was it only a prototype?
- Sofien, who is the intended user for this screen: admin only, internal ops, or both?
- Sofien, should this be a standalone page in admin navigation, or should it live inside the existing Loop Management flow?
- Sofien, what exact business decisions should a user make from this screen?
- Sofien, which metrics are mandatory at launch: loop completions, integrity score, impressions, slot failures, or something else?
- Sofien, should the hourly drill-down show real slot data from the backend, or is a summary table enough for MVP?
- Sofien, what date range behavior do you want: single day only, multiple days, or custom date range?
- Sofien, should users be able to export the analytics data?
- Sofien, if backend support does not exist yet, do you want this screen deferred or scoped down?

---

## 2. `pages/admin/LoopBuilder.jsx`

### Preamble
Sofien, this screen is a **Loop Builder / Loop Editor** for admins. It appears to let a user open a specific loop, inspect its 12 slots, replace content in those slots, preview the timeline, and approve the loop. The feature appears functionally close to complete, but it is currently disconnected from the active application flow.

### What is missing
What is missing here is mainly workflow definition. The code suggests the screen can work, but the team still needs to know where this screen belongs in the user journey, who is allowed to use it, and what approval rules should govern loop editing.

### Questions for Sofien
- Sofien, is Loop Builder an official admin workflow that should be accessible in production?
- Sofien, from which parent screen should users enter Loop Builder: Loop Management, Screens, Campaigns, or somewhere else?
- Sofien, who is allowed to edit loops: all admins, a subset of admins, or operations staff only?
- Sofien, should loop approval be mandatory before a loop becomes active?
- Sofien, can an approved loop be edited again, or does approval lock it?
- Sofien, should there be version history or rollback for loop changes?
- Sofien, should the preview be considered authoritative playback, or just an approximation?
- Sofien, what should happen if a slot has no assigned asset: allow empty, block approval, or auto-fill?
- Sofien, do you want any guardrails before shipping this, such as approval confirmation or audit logging?

---

## 3. `pages/admin/PlaylistManagement.jsx`

### Preamble
Sofien, this screen is an **Admin Playlist Management** page. It looks like an older management view where users can list playlists, filter them, create new ones, and delete existing ones. However, the current product appears to have moved toward a Loop-based model, so this screen may reflect an older concept that is no longer aligned with the current architecture.

### What is missing
What is missing is a product decision at the highest level: whether playlists still exist as a real concept in Softomedia Live 2026. Without that answer, the team cannot know whether to wire this screen into the product or retire it. It also needs design alignment because the styling is older and inconsistent with the rest of the current UI.

### Questions for Sofien
- Sofien, are Playlists still part of the intended product model, or have Loops fully replaced them?
- Sofien, if Playlists still exist, what is the difference between a Playlist and a Loop in user-facing terms?
- Sofien, who would use Playlist Management, and for what business task?
- Sofien, is this an MVP feature, a post-MVP feature, or a deprecated feature?
- Sofien, should Playlist Management remain an admin-only area?
- Sofien, do playlists need their own navigation entry, or should they be hidden behind another screen?
- Sofien, if this feature is deprecated, do you want it deleted from the repo now or parked for later reference?
- Sofien, if this feature stays, do you want it visually redesigned to match the current admin experience before routing it?

---

## 4. `pages/admin/PlaylistEditor.jsx`

### Preamble
Sofien, this screen is the **Playlist Editor** companion to Playlist Management. It appears to let an admin assemble a playlist from assets, set durations, assign screens or locations, and control whether the playlist is global. It is a substantial screen, but it depends completely on whether the Playlist concept is still active in the product.

### What is missing
What is missing here is both conceptual and workflow clarity. The team does not know whether this editor should exist at all, and if it should, what final rules apply to playlist structure, ownership, publishing, and assignments.

### Questions for Sofien
- Sofien, should Playlist Editor still exist in the product at all?
- Sofien, if yes, what problem does Playlist Editor solve that Loop Builder does not solve?
- Sofien, should a playlist be assignable to screens directly, to locations, or to both?
- Sofien, who owns a playlist once created: admin globally, a retailer, or a brand?
- Sofien, should playlists support draft and published states?
- Sofien, is there a maximum number of assets allowed in one playlist?
- Sofien, should duration rules be flexible per asset, or standardized across playlists?
- Sofien, what does “Global” mean from a product perspective, and when should a user choose it?
- Sofien, if playlists are deprecated, do you want this file deleted together with Playlist Management?

---

## 5. `pages/retailer/ScheduleHistory.jsx`

### Preamble
Sofien, this screen is a **Retailer Schedule History** page. It is designed to show a retailer past approvals, rejections, grouped schedule history, and recent audit activity. This screen looks close to production-ready, but it is not currently wired into the retailer experience.

### What is missing
What is missing is mostly product placement and permission clarity. The team needs to know whether this history view is important enough for launch, how retailers are identified in the flow, and whether export/reporting is required.

### Questions for Sofien
- Sofien, do you want retailers to have access to a schedule history screen in the MVP?
- Sofien, where should this screen live in retailer navigation?
- Sofien, what are the primary retailer use cases here: auditing, dispute resolution, validation, or reporting?
- Sofien, should the retailer automatically see only their own history based on login, with no manual selection?
- Sofien, is CSV export required for launch, or can it wait?
- Sofien, how far back should history go: 7 days, 30 days, 90 days, or all time?
- Sofien, should the retailer see only approvals and rejections, or also edits, overrides, and cancellations?
- Sofien, should this screen include downloadable proof-of-play evidence in the future?

---

## 6. `pages/retailer/ScheduleManager.jsx`

### Preamble
Sofien, this screen is a **Retailer D-1 Schedule Preview / Validation** page. It lets a retailer choose a location and preview the upcoming hourly loop for that location. The screen exists and appears useful, but some displayed values are hardcoded and one of the actions is not yet defined.

### What is missing
What is missing is the exact product behavior. The team needs to know whether this screen is simply informational, whether it supports approvals, and what “Bulk Approve All” is supposed to mean in business terms.

### Questions for Sofien
- Sofien, is this screen intended to be a preview-only page, an approval page, or both?
- Sofien, what does D-1 mean operationally in your workflow: next day only, next scheduled window, or another cutoff?
- Sofien, should users preview one hour at a time, a full day, or both?
- Sofien, what should happen when the retailer presses “Bulk Approve All”?
- Sofien, should approval apply to one location, all visible locations, or an entire day?
- Sofien, do retailers need the ability to reject or comment on a schedule from this screen?
- Sofien, how should date and time be shown: local store timezone, system timezone, or user timezone?
- Sofien, should this screen be a core retailer nav item, or should it sit behind Schedule Calendar?

---

## Midpoint note

**good job Sofien**

The orphaned screens are valuable because they show features that were already imagined, partially built, or nearly completed. The goal now is to turn them into clear decisions instead of leaving them as hidden code paths.

**continue building the product Sofien**

---

## 7. `pages/tech/TechOpsDashboard.jsx`

### Preamble
Sofien, this screen is a **Tech Operator Dashboard**. It is meant to give a technical operator a network-wide view of fleet health, online/offline counts, screen status, and quick actions such as restart and terminal access. It also contains a Design Lab area linking to hamburger-menu experiments. The screen is substantial, but a few actions are undefined and its place in the live product is still unclear.

### What is missing
What is missing is role definition and operational policy. The engineering team needs clear answers on what a Tech Operator is allowed to do, whether these controls are production-grade, and whether the experimental design links belong in a live operational dashboard.

### Questions for Sofien
- Sofien, is Tech Operator a real production persona in the current release scope?
- Sofien, should TechOpsDashboard become the main landing page for that persona, or should Health remain the main page?
- Sofien, what actions should a tech operator actually be allowed to perform from this screen?
- Sofien, should Restart be a real action in production, or only a future feature?
- Sofien, what should the Terminal action do from a product perspective?
- Sofien, do you want the search field to filter only by screen ID, or also by status, location, and device metadata?
- Sofien, should the Design Lab experiment links be visible in production, hidden behind a flag, or removed entirely?
- Sofien, does this screen need audit logging for sensitive actions like restart or terminal access?
- Sofien, who approves the operational safeguards for these actions: product, PM, or engineering lead?

---

## 8. `pages/brand/wizard/Step3ReviewDistribution.jsx`

### Preamble
Sofien, this screen is an **older Brand Wizard step** that appears to combine schedule visualization, campaign impact metrics, configuration summary, and final submission in one place. In the current product, its responsibilities seem to have been split into newer wizard steps, which suggests this file may now be redundant.

### What is missing
What is missing is a final decision on whether this screen still has any unique value. The team needs to know whether there is logic here that should be preserved, extracted, or removed entirely so the wizard does not carry duplicate concepts.

### Questions for Sofien
- Sofien, do you consider this older wizard step deprecated?
- Sofien, should this file be deleted now, or kept temporarily for reference?
- Sofien, is there any part of this older screen that product still wants, such as the loop visualization or impact summary?
- Sofien, does the current wizard already cover all required review-and-confirm behavior?
- Sofien, do you want one consolidated review screen, or is the current split-step approach preferred?
- Sofien, before deletion, do you want a quick product comparison between this old step and the live wizard steps?
- Sofien, if any UI from this screen should survive, which part has the highest product value?

---

## Final decisions needed from Sofien

Sofien, after reviewing all sections above, please give one decision per orphaned file using one of these labels:
- **Ship now**
- **Ship later**
- **Revise first**
- **Delete**

Sofien, for the blocked or ambiguous screens, please also provide:
- the owner persona,
- the core user action,
- the place in navigation,
- the required backend dependency,
- and whether the feature is MVP or post-MVP.

Once those answers are captured, engineering can turn this document into a delivery sequence without guessing.
