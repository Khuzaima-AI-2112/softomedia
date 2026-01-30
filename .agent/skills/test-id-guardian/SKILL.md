name: test-id-guardian
description: Validates that data-testid selectors used in E2E tests actually exist in the component source code. Run this skill before E2E test execution to catch selector mismatches early.

# Test ID Guardian Skill

## Goal
Act as a **reactive validation layer** that catches `data-testid` mismatches before E2E tests run. This skill prevents the frustrating "test timeout → debug → selector doesn't exist" cycle by validating selectors upfront.

## Core Principles
- **Validate Before Execute**: Check selectors before running expensive E2E tests
- **Clear Reporting**: Show exactly which test IDs are missing and where
- **Actionable Feedback**: Suggest fixes for each mismatch
- **Block on Critical**: Option to fail fast if critical selectors are missing

## When to Use This Skill
Activate this skill:
- Before running `npm run test:e2e` or Playwright tests
- When adding the `/validate-testids` workflow
- When E2E tests fail with timeout errors (likely missing selectors)
- As a pre-commit hook for test files

## Operational Guidelines

### Validation Process
1. **Extract Test IDs from Test Files**
   Scan test files for patterns:
   - `[data-testid="..."]`
   - `[data-testid^="..."]` (partial match)
   - `getByTestId("...")`

2. **Search Component Files**
   For each extracted ID, search:
   - `client-app/src/**/*.jsx`
   - `client-app/src/**/*.tsx`
   - `client-app/src/**/*.vue`

3. **Generate Mismatch Report**
   For each missing ID:
   ```
   ❌ MISSING: [data-testid="kpi-card-total-active"]
      Used in: tests/personas.spec.js:44
      Searched: client-app/src/**/*.jsx
      Suggestion: Add data-testid="kpi-card-total-active" to the KPI card component
   ```

4. **Categorize Severity**
   - **CRITICAL**: Hard-coded exact match selectors
   - **WARNING**: Partial match selectors (`^=`, `*=`) that might still work
   - **INFO**: Dynamic selectors that depend on runtime data

### Example Validation Output
```
┌──────────────────────────────────────────────────────────────┐
│                   TEST ID VALIDATION REPORT                   │
├──────────────────────────────────────────────────────────────┤
│ Scanned: 15 test files                                       │
│ Found: 47 unique data-testid selectors                       │
│ Matched: 42 ✅                                                │
│ Missing: 5 ❌                                                 │
└──────────────────────────────────────────────────────────────┘

❌ CRITICAL MISMATCHES (will cause test failures):

  1. kpi-card-total-active
     Test: tests/personas.spec.js:44
     Expected in: KPICard component
     Fix: Change to "kpi-card-active-campaigns" (actual ID in KPICard.jsx:4)

  2. store-downtown-flagship
     Test: tests/personas.spec.js:95
     Expected in: Step1LocationScreen
     Fix: Use partial match [data-testid^="store-"] or add matching seed data

  3. screen-main-entrance-kiosk-a
     Test: tests/personas.spec.js:96
     Expected in: Step1LocationScreen
     Fix: Use partial match [data-testid^="screen-"]

⚠️ WARNINGS (may still work):

  4. wizard-step-* (partial match)
     Test: tests/personas.spec.js:103
     Found similar: wizard-next-step ✅

RECOMMENDATION: Fix 3 critical mismatches before running E2E tests.
```

### Auto-Fix Suggestions
For each mismatch, suggest one of:
1. **Update the test** to use the correct selector
2. **Update the component** to add the missing ID
3. **Use partial matching** for dynamic IDs

### Commands
```bash
# Full validation
/validate-testids

# Validate specific test file
/validate-testids tests/personas.spec.js

# Validate with auto-fix suggestions
/validate-testids --suggest-fixes
```

## Integration
This skill is called by:
- `/bigtest` workflow (Phase 7 pre-check)
- `/starttesting` workflow
- Pre-commit hooks

## Key Phrases to Remember
- "Validate before you wait 5 minutes for timeouts."
- "If it's not in the component, the test will fail."
- "Clear reporting saves debugging time."
