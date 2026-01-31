---
description: Validate that data-testid selectors in E2E tests exist in component source code
---

# Test ID Guardian - Validate Test IDs

**Run this before E2E tests to catch selector mismatches early.**

## What This Does

1. **Extracts** all `data-testid` selectors from test files
2. **Searches** component files for matching IDs
3. **Reports** any mismatches with suggested fixes

## Validation Process

```powershell
# Step 1: Extract test IDs from E2E tests
Get-Content tests/*.spec.js | Select-String 'data-testid="([^"]+)"' -AllMatches |
    ForEach-Object { $_.Matches.Groups[1].Value } | Sort-Object -Unique

# Step 2: For each ID, check if it exists in components
# Search in client-app/src/**/*.jsx
```

## Example Output

```
┌──────────────────────────────────────────────────────────────┐
│                   TEST ID VALIDATION REPORT                   │
├──────────────────────────────────────────────────────────────┤
│ Scanned: 15 test files                                       │
│ Found: 47 unique data-testid selectors                       │
│ Matched: 42 ✅                                                │
│ Missing: 5 ❌                                                 │
└──────────────────────────────────────────────────────────────┘

❌ CRITICAL MISMATCHES:

  1. kpi-card-total-active
     Test: tests/personas.spec.js:44
     Fix: Change to "kpi-card-active-campaigns" (actual ID)

  2. store-downtown-flagship
     Test: tests/personas.spec.js:95
     Fix: Use partial match [data-testid^="store-"]
```

## When to Use

- Before running `npm run test:e2e`
- When E2E tests fail with timeout errors
- After modifying component data-testid attributes
- As a pre-commit check

## Fix Options

For each mismatch, I will suggest:
1. **Update the test** to use the correct selector
2. **Update the component** to add the missing ID
3. **Use partial matching** for dynamic IDs

---

**Running validation now...**
