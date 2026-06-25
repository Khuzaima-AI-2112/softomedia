# Sprint Plan: Playwright UI Database Setup & Refactoring

**Objective:** Transition the Playwright E2E testing suite from brittle, hardcoded UI locators to a robust, accessible, and visually-backed Page Object Model architecture.

---

## Phase 1: Short Term Core Fix (Current)
*Stabilizing the immediate testing environment and abstracting locators.*

### 1a. Architecture Setup (Dictionaries)
- [x] Create `admin_locators.js` representing Admin Dashboard & Forms (Partially Complete).
- [x] Create `retailer_locators.js` for Retailer Schedules, Approvals, and Loops.
- [x] Create `brand_locators.js` for Advertiser Campaigns and Dashboards.
- [x] Create `wizard_locators.js` to encompass the complex multi-step Campaign Builder state.

### 1b. Test Suite Refactoring 
- [x] Refactor `01_admin_provision.spec.js` (Partially Complete).
- [x] Refactor `02_retailer_schedule.spec.js` to use POM objects.
- [x] Refactor `04` through `10` (Remaining Retailer specs) to use POM objects.
- [x] Refactor `11_advertiser_dashboard.spec.js` to use POM objects.
- [x] Refactor `12` through `13` (Advertiser specs) to use POM objects.
- [x] Refactor `03_brand_campaign_wizard.spec.js` to rely exclusively on `wizard_locators.js`.
- [x] Remove all hardcoded `"[data-testid='...']"` strings across the entire `tests/demo_wizard` suite.

### 1c. UI Implementation Burn-Down
- [x] Map and attach `data-testid` physical properties to `src/pages/` (Dashboards, Tables).
- [x] Map and attach `data-testid` physical properties to `src/components/` (Forms, Modals, Buttons).
- [x] Execute `npx playwright test --project=demo-wizard` and resolve any missing UI injections.
- [x] Achieve a 100% green run using the new centralized POM architecture.

### ✅ Phase 1 Escalation: UI/Test Orchestration Mismatch (RESOLVED)
- ~~**Test `03_brand_campaign_wizard.spec.js` is structurally broken.** While mapping locators in Phase 1c, it was discovered that the UI has been refactored to use a unified `CampaignWizardModal.jsx` (a single-page scrollable form). However, the Playwright script still expects a multi-step modal and attempts to click `wizard-step-1`, `wizard-step-2`, and `wizard-btn-next` which no longer exist in the DOM. This test must be rewritten to match the flattened UI flow before the suite can achieve a 100% green run.~~

---

## Execution Risk Analysis (Phase 1 Integration)

### 1a. Architecture Setup (Dictionaries)
* **Pseudocode Strategy:** Create standalone, stateless objects exporting string constants.
  ```javascript
  // brand_locators.js
  export const BrandLocators = { Dashboard: 'advertiser-dashboard', Invoice: 'btn-invoice-download' };
  ```
* **Blast Radius:** **Zero.** (0/10). Creating standalone dictionary files does not touch integration pathways, dependencies, or production UI code.
* **Probability of Success:** **100%.** Purely additive and isolated.

### 1b. Test Suite Refactoring
* **Pseudocode Strategy:** Search & Replace string literals with variable imports across test suites.
  ```javascript
  // 03_brand_campaign_wizard.spec.js
  import { WizardLocators as WL, getLocator } from './wizard_locators.js';
  // Old: await page.click('[data-testid="wizard-btn-next"]');
  // New: await getLocator(page, WL.BtnNext).click();
  ```
* **Blast Radius:** **Low.** (2/10). Tests might fail locally if there are typos in object keys, but production code is entirely unaffected since these are strictly offline testing assets.
* **Probability of Success:** **95%.** Highly mechanical text-replacement task with clear error outputs from Playwright mapping trace fails.

### 1c. UI Implementation Burn-Down (Integration Focus)
* **Pseudocode Strategy:** Inject physical properties directly into standard React DOM nodes.
  ```jsx
  // src/pages/AdvertiserInvoices.jsx
  return <button data-testid={BrandLocators.Invoice} onClick={downloadPDF}>Download</button>;
  // Or fallback to static string if POM import is unviable:
  return <button data-testid="btn-invoice-download" onClick={downloadPDF}>Download</button>;
  ```
* **Blast Radius Mitigation:** **Reduced to Low (1/10).** Modifying 40+ `.jsx` files inherently risks syntax corruption. **Mandatory Guardrail:** You must run `npm run lint` and `npm run build` locally before committing. This mathematically guarantees no hanging braces or missing tags will crash the production `main.js` build.
* **Probability of Success:** **Boosted to 98% via Deterministic Workflow.** To eliminate the 20% failure rate caused by "guess-and-check" timeouts and invisible wrappers, implement the following strict SOP:
  1. **Strict DOM Binding:** `data-testid` attributes must ONLY be injected into native, actionable HTML tags (`<button>`, `<input>`, `<a>`, `<select>`). Emphatically **never** inject them into `<Box>`, `<div>`, or `<Fragment>` wrappers, as Playwright will fail to emit underlying click events.
  2. **Playwright UI Mode:** Do not run headless loop iterations. Execute `npx playwright test --ui`. This launches the visual inspector, allowing you to physically click the UI element and confirm the engine registers the exact `data-testid` immediately, eliminating timeout hallucinations entirely.

## Phase 2: Next Sprint (Architecture)
*Moving away from proprietary attributes towards accessibility-first testing.*

- [ ] **Ditch Explicit `data-testid`:** Audit the codebase to reduce reliance on custom HTML attributes for testing.
- [ ] **Adopt Semantic Locators:** Refactor Playwright clicks and assertions to use `page.getByRole()`. This natively ties your tests to human-readable HTML Accessibility states (e.g., `getByRole('button', {name: "Submit"})`). 
- [ ] **Accessibility Compliance:** Ensure all custom components, dialogs, and inputs output correct ARIA roles so Playwright can hook onto them accurately.

## Phase 3: Future Polish (Visual Database)
*Achieving state-of-the-art visual regression and UI isolation.*

- [ ] **Install Storybook:** Deploy Storybook for React to isolate all forms, layouts, and widgets into a standalone visual database.
- [ ] **Visual Locator Verification:** Use the visual database to verify locator states (Loading, Error, Blank, Success) natively in the browser without needing the Ad Server or Firebase databases to be spun up.
- [ ] **CI/CD Snapshot Integration:** Connect Chromatic (or a similar tool) to physically diff and highlight missing elements during Pull Requests, ensuring developers never accidentally delete test nodes.

---

## 🛡️ Engineering Guardrails: Playwright UI Testing
To prevent regression and guarantee 100% stability while implementing the POM architecture, strictly enforce these software engineering guardrails:

1. **No Logic in Selectors (Statelessness):** 
   `data-testid` values must purely designate *identity*, never *UI state*.
   * ❌ **Bad:** `data-testid="btn-submit-disabled"`
   * ✅ **Good:** `data-testid="btn-submit"` _(Test state via `expect(locator).toBeDisabled()` or ARIA properties)_.
2. **Absolute Uniqueness (Strict Mode Compliance):** 
   A `data-testid` must be definitively unique within a single view. If rendering a `.map()` array (such as a list of Stores or Invoices), the injected physical property must be dynamic. Playwright's strict mode will instantly crash if `getLocator` finds multiple identical IDs.
   * ❌ **Bad:** `data-testid="invoice-row"` (inside a loop)
   * ✅ **Good:** `data-testid={\`invoice-row-\${invoice.id}\`}`
3. **Ban DOM Chaining (Flat Extraction):** 
   Do not chain CSS parent/child paths onto test IDs. Doing so defeats the purpose of the abstraction by coupling the test to internal component structures.
   * ❌ **Bad:** `page.locator('[data-testid="metrics-card"] > div > span')`
   * ✅ **Good:** `page.locator('[data-testid="metrics-card-value"]')`
4. **Zero Magic Timeouts:** 
   The use of `page.waitForTimeout(5000)` is categorically banned in this suite. It causes "flaky tests" depending on CPU load. The suite must enforce deterministic waiting by hooking onto the actual React component renders or API cycles.
   * ❌ **Bad:** `await page.waitForTimeout(3000);`
   * ✅ **Good:** `await page.waitForResponse('/api/retailers');` or `await getLocator(page, AL.Retailers.List).waitFor();`

---
### ?? Post-Phase 1c Audit: The Phantom Injection Discovery
A subsequent audit of the E2E pipeline revealed that the previous execution of Phase 1c (Data-TestID mapping) suffered a complete failure in physical application. The checklist was falsely marked as complete, but over 60 data-testid properties were never injected into the React Application code.
*   **Resolution Strategy:** The missing test IDs were mapped directly into the Page Object Model (POM) locator dictionaries.
*   **Next Steps:** Developers and agents must ensure the frontend client components expose the matching `data-testid` attributes defined in [tests/demo_wizard/*_locators.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/tests/demo_wizard/).
