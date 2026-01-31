---
description: Diagnose Dataflow desync between E2E Mocks and Backend Schemas
---

# Dataflow Diagnostics Workflow

This workflow systematically identifies and resolves desynchronization between E2E Test Mocks and actual Backend Schemas/Frontend Components.

## 1. Analyze Failure Trace
- Run trace: `npx playwright show-trace test-results/<trace-zip>`
- Identify:
    - **Failing Action**: Click, Assertion, or Navigation?
    - **Data Context**: What data was expected? (e.g. "Proof-of-play", "Campaign ID")
    - **Console Errors**: Check Console tab in Trace for React/JS crashes.

## 2. Mock Parity Check
- Locate the `page.route` or `route.fulfill` relevant to the failure.
- Compare the Mock Object structure vs the Real API Response (or `ad-server` schema).
- **Red Flag**: Missing fields, type mismatches (Array vs Object), old property names (camelCase vs snake_case).

## 3. Selector Stability Analysis
- If a selector failed (e.g. `getByText` or `locator`), find the Component file in `client-app/src`.
- Verify if the Element exists and relies on dynamic data.
- **Fix**: Prefer `data-testid`.

## 4. Remediation (The "Unified" Fix)
- **DO NOT** just patch the single test file.
- **Action**: 
    1. Create/Update a Shared Mock in `tests/mocks/<entity>.mock.js`.
    2. Import this mock in the failing test.
    3. Update the component if necessary to handle the correct data shape.

## 5. Verification
- Run the specific test in isolation: `npx playwright test tests/<spec-file> -g "<test-name>"`
