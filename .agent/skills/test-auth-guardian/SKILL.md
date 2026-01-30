name: test-auth-guardian
description: Validates that E2E test authentication setup matches the application's actual auth requirements. Prevents auth-related test failures by ensuring global.setup.js injects all required localStorage/sessionStorage values.

# Test Auth Guardian Skill

## Goal
Ensure that E2E test authentication setup **exactly matches** what the application expects. This skill prevents the "tests run but pages don't load" scenario caused by incomplete or stale auth injection.

## Core Principles
- **Contract Validation**: Auth setup must match the app's AuthContext requirements
- **Complete State**: Inject ALL required tokens, user objects, and flags
- **Sync Detection**: Detect when auth implementation changes but tests don't update
- **Clear Guidance**: When mismatches found, show exactly what's missing

## When to Use This Skill
Activate this skill:
- Before running E2E tests
- When `AuthContext.jsx`, `authAPI.js`, or similar files change
- When tests fail with redirect-to-login or unauthorized errors
- When adding new auth-related localStorage keys

## Operational Guidelines

### Validation Process
1. **Parse Auth Requirements from App**
   Scan auth-related files for localStorage/sessionStorage usage:
   ```javascript
   // Look for patterns like:
   localStorage.getItem('auth_token')
   localStorage.getItem('auth_user')
   localStorage.getItem('active_persona')
   sessionStorage.getItem('demo_mode')
   ```

2. **Parse Auth Setup from Tests**
   Scan `global.setup.js` (or equivalent) for what values are set:
   ```javascript
   // Look for patterns like:
   localStorage.setItem('auth_token', ...)
   localStorage.setItem('auth_user', ...)
   ```

3. **Compare and Report**
   Generate a mismatch report:
   ```
   ┌──────────────────────────────────────────────────────────────┐
   │                  AUTH CONTRACT VALIDATION                     │
   ├──────────────────────────────────────────────────────────────┤
   │ App expects: 4 localStorage keys                             │
   │ Test sets: 2 localStorage keys                               │
   │ Match: INCOMPLETE ❌                                          │
   └──────────────────────────────────────────────────────────────┘

   REQUIRED BY APP (AuthContext.jsx):
     ✅ auth_token     - Set in global.setup.js ✓
     ❌ auth_user      - NOT SET (line 12: JSON.parse(localStorage.getItem('auth_user')))
     ❌ demo_role      - NOT SET (line 38: localStorage.getItem('demo_role'))
     ✅ active_persona - Set in global.setup.js ✓

   RECOMMENDED FIX:
   Add to tests/global.setup.js:
     localStorage.setItem('auth_user', JSON.stringify({
         id: 'user-test',
         email: 'test@example.com',
         role: persona
     }));
     localStorage.setItem('demo_role', persona);
   ```

### File Locations to Scan
**App Auth Files** (requirements source):
- `client-app/src/contexts/AuthContext.jsx`
- `client-app/src/services/authAPI.js`
- `client-app/src/hooks/useAuth.js`
- Any file with `localStorage.*auth` or `sessionStorage.*auth`

**Test Auth Files** (setup source):
- `tests/global.setup.js`
- `tests/fixtures/auth.js`
- `tests/.auth/*.json` (generated state files)
- `playwright.config.js` (storageState references)

### Auto-Detection of Auth Changes
When auth implementation files change:
```
⚠️ AUTH CONTRACT CHANGE DETECTED

Modified: client-app/src/contexts/AuthContext.jsx

CHANGES:
+ Added: localStorage.getItem('session_expiry') on line 47
+ Added: localStorage.getItem('refresh_token') on line 52

ACTION REQUIRED:
Update tests/global.setup.js to include:
  localStorage.setItem('session_expiry', Date.now() + 3600000);
  localStorage.setItem('refresh_token', 'demo-refresh-token');

Would you like me to update global.setup.js now?
```

### Standard Auth Contract
For this project (Softomedia), the auth contract is:
```javascript
// Required localStorage keys
{
    'auth_token': 'demo-token',           // JWT or demo token
    'auth_user': JSON.stringify({         // User object
        id: 'user-{persona}',
        email: '{persona}@softomedia.com',
        name: 'Test {Persona}',
        role: '{persona}'
    }),
    'active_persona': '{persona}',        // Current persona (brand/admin/retailer)
    'demo_role': '{persona}'              // Backend bypass role
}
```

## Example Interactions

### Example 1: Missing Auth Keys
**Scenario**: Tests fail with redirect to login

**Agent Analysis**:
```text
I analyzed the auth contract between your app and test setup:

APP REQUIREMENTS (from AuthContext.jsx):
  Line 12: auth_user = JSON.parse(localStorage.getItem('auth_user'))
  Line 30: auth_token = localStorage.getItem('auth_token')
  Line 38: demo_role = localStorage.getItem('demo_role')

TEST SETUP (from global.setup.js):
  Line 25: sets active_persona ✅
  MISSING: auth_user ❌
  MISSING: auth_token ❌
  MISSING: demo_role ❌

This explains why tests see the login screen - the app thinks no one is logged in.

RECOMMENDED FIX:
Update global.setup.js to inject complete auth state. 
Shall I apply this fix?
```

### Example 2: Auth Contract Drift
**Scenario**: Dev adds new auth requirement

**Agent Detection**:
```text
I noticed you added a new localStorage check in AuthContext.jsx:

+ const sessionExpiry = localStorage.getItem('session_expiry');
+ if (sessionExpiry && Date.now() > parseInt(sessionExpiry)) {
+     logout();
+ }

This means E2E tests need to set 'session_expiry' to a future timestamp.
Otherwise, the auth state will be considered expired.

Shall I update global.setup.js to include:
  localStorage.setItem('session_expiry', String(Date.now() + 86400000));
```

## Commands
```bash
# Full auth validation
/validate-auth

# Check specific auth file
/validate-auth AuthContext.jsx

# Auto-fix detected issues
/validate-auth --fix
```

## Integration
This skill is called by:
- `/bigtest` workflow (Phase 7 pre-check)
- When `AuthContext.jsx` or auth files are modified
- When E2E tests fail with auth-related errors

## Key Phrases to Remember
- "The test must mimic the login, not skip it."
- "If the app reads it, the test must write it."
- "Auth drift is silent until tests break."
