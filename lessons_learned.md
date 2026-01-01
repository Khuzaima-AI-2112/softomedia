# Lessons Learned

Objectives: Document errors, bugs, and mistakes so we do not make them again.

## Development Lessons

### [2026-01-01] Ad Rotation Safety
- **Issue**: Client player rotation was ambiguous (defaulting to 10s) and lacked background syncing for hourly schedules.
- **Root Cause**: Hardcoded fallback values in `Player.jsx` and missing polling mechanism.
- **Prevention**: Forces 5-second rotation and implemented 60-second back-end polling to stay synced with `hourlyLoop`.

### [2026-01-01] Auth to Persona Refactoring
- **Issue**: Traditional login/redirect patterns blocked the seamless switching required for "Persona Mode" demos.
- **Root Cause**: `ProtectedRoute` was hardcoded to check for a `user` object and return a `/login` redirect.
- **Prevention**: Removed `ProtectedRoute` entirely. Refactored `AuthContext` to manage `persona` state with local storage persistence, ensuring all routes are accessible while the UI adapts based on the active persona.

---
*Note: This file is a permanent project record. Do not delete or purge entries.*
