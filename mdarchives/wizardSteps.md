# wizardSteps.md — Campaign Wizard Step Inventory

> **Purpose**: Per-step screenshot inventory for the Brand Campaign Wizard.
> The wizard lives at a single route (`/dashboard/brand/campaign/new`) and is driven by
> internal React state (`currentStep` 1–5) in `BrandCampaignWizard.jsx` — there are **no
> sub-routes**. Each step must be reached by navigating forward through the wizard UI.

---

## How to Screenshot Wizard Steps

1. Log in as a **brand** persona.
2. Navigate to `/dashboard/brand/campaign/new`.
3. The wizard opens on Step 1. Screenshot it.
4. Fill in the minimum required data for each step and click **Next** to advance.
5. Screenshot each step before advancing.
6. Save to `screenshots/wizard-step-<N>-<slug>.png`.

> **Note**: Steps can only be navigated backwards (clicking completed step buttons) once
> unlocked — forward navigation requires completing each step. Plan your screenshot run
> to go straight through 1 → 5 in a single session.

---

## Wizard Steps

| Step | Name | Description | Source File | Imported by Wizard | Screenshot |
|------|------|-------------|-------------|-------------------|------------|
| 1 | Location | Select retailers, stores & screens | `pages/brand/wizard/Step1LocationScreen.jsx` | ✅ Yes | |
| 2 | Schedule | Set campaign name, date range & budget | `pages/brand/wizard/Step2ScheduleUpload.jsx` | ✅ Yes | |
| 3 | Slots | Select hourly loop slots | `pages/brand/wizard/Step3LoopSlotSelection.jsx` | ✅ Yes | |
| 4 | Creative | Upload ad creative & set duration | `pages/brand/wizard/Step4CreativeUpload.jsx` | ✅ Yes | |
| 5 | Review & Confirm | Review booking summary and submit | `pages/brand/wizard/Step5ReviewConfirm.jsx` | ✅ Yes | |

---

## Orphaned Wizard File

| File | Status |
|------|--------|
| `pages/brand/wizard/Step3ReviewDistribution.jsx` | 🚫 Exists on disk but **not imported** by `BrandCampaignWizard.jsx` — appears to be a superseded draft of a Step 3 variant. Do not attempt to screenshot; confirm with dev whether to delete or wire up. |

---

## Wizard Data Flow

All step components share a single `wizardData` state object owned by `BrandCampaignWizard.jsx`.
Each step receives `data` (read) and `updateData` (write) props. On Step 5 confirmation,
`handleConfirm()` calls `apiService.createCampaign()` then `apiService.bookSlots()` and
navigates back to `/dashboard/brand` on success.

```
Step 1 → selectedRetailers, selectedStores, selectedScreens
Step 2 → campaignName, dateRange, budget
Step 3 → selectedSlots
Step 4 → creativeUrl, creativeDuration
Step 5 → review only (read) → handleConfirm() → POST to backend
```

---

*Last updated: 2026-05-27 — initial inventory; Step3ReviewDistribution confirmed orphaned*
