---
description: Validate that E2E test auth setup matches the app's AuthContext requirements
---

# Test Auth Guardian - Validate Auth Contract

**Run this when tests fail with redirect-to-login or unauthorized errors.**

## What This Does

1. **Parses** auth requirements from AuthContext.jsx
2. **Compares** with what global.setup.js injects
3. **Reports** any missing localStorage/sessionStorage keys

## Auth Contract for This Project

The app requires these localStorage keys:

```javascript
{
    'auth_token': 'demo-token',
    'auth_user': JSON.stringify({
        id: 'user-{persona}',
        email: '{persona}@softomedia.com',
        role: '{persona}'
    }),
    'active_persona': '{persona}',  // brand/admin/retailer
    'demo_role': '{persona}'
}
```

## Validation Process

```powershell
# Step 1: Find localStorage.getItem calls in auth files
Get-Content client-app/src/contexts/AuthContext.jsx |
    Select-String "localStorage\.getItem\(['""]([^'""]+)['""]\)" -AllMatches

# Step 2: Find localStorage.setItem calls in test setup
Get-Content tests/global.setup.js |
    Select-String "localStorage\.setItem\(['""]([^'""]+)['""]\)" -AllMatches

# Step 3: Compare and report missing
```

## Example Output

```
┌──────────────────────────────────────────────────────────────┐
│                  AUTH CONTRACT VALIDATION                     │
├──────────────────────────────────────────────────────────────┤
│ App expects: 4 localStorage keys                             │
│ Test sets: 4 localStorage keys                               │
│ Match: COMPLETE ✅                                            │
└──────────────────────────────────────────────────────────────┘

REQUIRED BY APP (AuthContext.jsx):
  ✅ auth_token     - Set in global.setup.js
  ✅ auth_user      - Set in global.setup.js
  ✅ active_persona - Set in global.setup.js
  ✅ demo_role      - Set in global.setup.js
```

## When to Use

- When tests redirect to login unexpectedly
- After modifying AuthContext.jsx
- After adding new localStorage keys to auth
- Before running E2E tests

## Key Files

**App Auth** (requirements):
- `client-app/src/contexts/AuthContext.jsx`

**Test Setup** (must match):
- `tests/global.setup.js`
- `tests/.auth/*.json`

---

**Running validation now...**
