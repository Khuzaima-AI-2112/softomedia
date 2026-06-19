# Massive E2E Playbook: Dual-Strategy Testing

This playbook documents the definitive workflows for validating the Softomedia application. We employ a **dual-strategy** approach: deterministic local testing via Playwright, and exploratory cloud-based testing using the Antigravity Browser Subagent.

---

## Strategy 1: Local Deterministic Testing (Playwright)
Playwright serves as the fast, codified safety net. It runs locally against isolated frontend and backend instances.

### ⚠️ Local Prerequisites & Troubleshooting
1. **Never run `npm audit fix`** immediately before running E2E tests, as it can destabilize package locks mid-test.
2. **Missing locators (`data-testid`):** If tests hang indefinitely on component checks, UI refactoring may have stripped out the test IDs.
   * **The Quick Fix:** Identify the missing locator via test output and add it back into the target `.jsx` component. Reference the `playwright_testids_checklist.md` to see the full manifest of 110+ required locators.
   * **The Architectural Fix (Page Object Model):** Do not hardcode strings like `'[data-testid="btn-add-retailer"]'` into your `.spec.js` scripts. Abstract all selectors into central dictionary files (e.g., `admin_locators.js`) so that a single change propagates instantly across all 16 test phases. *(See `playwright_db_setup.md` for the full sprint plan).*
   * **The Visual Database (Future Goal):** Integrate **Storybook** with a visual regression tool like **Chromatic**. This renders your components locally in an isolated visual database. It prevents designers or developers from accidentally deleting `data-testid` attributes because the test runner highlights the DOM nodes visually before pushing to `main`.
3. **Refresh Authentication:** If the tests immediately fail with `403 Forbidden` during setup/teardown, your local JWT tokens have expired. Run the `/validate-testids` workflow to refresh your `.auth/` JSON tokens.
4. **Superadmin RBAC Bypass:** Destructive API routes (like `DELETE /api/campaigns`) strictly require the `superadmin` role. Ensure `tests/demo_wizard/00_seed.setup.js` specifically injects `'x-demo-role': 'superadmin'` in header fetches to prevent auth failures.
5. **Local Infrastructure:** Run `/starttesting` to ensure you are hitting local databases/emulators and not mutating production Cloud Firestore data.
6. **Manual Server Booting:** Always boot servers manually. Playwright's `webServer` auto-boot block frequently hangs on `npx kill-port`.

### Step 1: Prepare the Ad Server (Terminal 1)
The backend MUST run on port `3001` to match Playwright API expectations.
```powershell
cd C:\path\to\softomedia-live2026\ad-server
$env:PORT="3001"
$env:NODE_ENV="development"
$env:ALLOW_DEMO_MODE="true"
npm start
```

### Step 2: Prepare the Client Application (Terminal 2)
The frontend MUST run on port `5173`.
```powershell
cd C:\path\to\softomedia-live2026\client-app
npm run dev
```

### Step 3: Run the Massive E2E Suite (Terminal 3)
Use `cmd /c` to cleanly marshal PowerShell output streams.
```powershell
cd C:\path\to\softomedia-live2026
$env:ALLOW_DEMO_MODE="true"
$env:NODE_ENV="development"

# Run the full suite (all 16 phases)
cmd /c "npx playwright test --project=demo-wizard 2>&1"

# Or run Tier 1 MVP only (Phases 0-3):
cmd /c "npx playwright test --project=demo-wizard --grep ""Phase [0-3]"" 2>&1"
```

### Step 4: View the Report
```powershell
cmd /c "npx playwright show-report 2>&1"
```

---

## Strategy 2: Cloud Exploratory Testing (Antigravity Subagent)
The **Antigravity Browser Subagent** acts like a human QA tester to verify the live deployed application. It is immune to minor DOM locator changes (like missing `data-testid` attributes) and doesn't require spoofed JWT `.auth` states. 

**Note on Background Execution Times:** Subagent testing occurs headlessly. Tasks that involve highly repetitive data entry (like entering multiple stores/screens) may take several minutes to process as the subagent sequentially parses DOM structures, types values, and waits for animations. Do **not** cancel the agent early if it appears stuck; it requires roughly 15-30 seconds per UI form submission iteration.

### Step-by-Step Execution
1. Provide the Antigravity Agent with the active URL (e.g., `http://localhost:5173` or `https://live.softomedia.com`).
2. Provide a prompt simulating a human task:
   > *"Launch the browser subagent, navigate to the URL, log in as Super Admin. Create a new Campaign for Retailer X lasting 3 weeks... Return successfully once verified."*
3. The Subagent will visually navigate the real site and autonomously report on real-world functionality with screenshots.
