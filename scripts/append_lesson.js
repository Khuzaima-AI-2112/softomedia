const fs = require('fs');

const lesson = `\n
---

## 2026-06-18 — Playwright Phase 03 UI/Test Orchestration Mismatch
**Severity:** Moderate — Playwright suite structurally broken.

**Symptom:**
During Phase 1c of the massive E2E Playwright stabilization, we discovered that \`03_brand_campaign_wizard.spec.js\` attempts to click through multiple Wizard steps (\`wizard-step-1\`, \`wizard-btn-next\`), but the frontend UI component (\`CampaignWizardModal.jsx\`) was refactored into a flattened single-page scrollable form.

### Fix
* **The test logic needs to be rewritten** to reflect the new DOM structure (a single continuous form without \`Next\` buttons for sections).
`;

fs.appendFileSync('docs/LESSONS_LEARNED.md', lesson);
console.log('Appended successfully.');
