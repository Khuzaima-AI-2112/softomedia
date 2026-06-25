# SRE Incident Report - /bigtest Failure

**Timestamp:** 2026-06-25T04:36:00-04:00
**Failed Phase:** Phase 4: Smoke Test (`/smoke-test`)
**Command:** `node verify_predeploy.js`

## Root Cause
The `node verify_predeploy.js` command failed with exit code 1 (`MODULE_NOT_FOUND`). The script `verify_predeploy.js` does not exist in the root directory, nor does it exist in the `ad-server/scripts/` directory.

## Impact
The liveness and config integrity smoke test cannot be executed. This leaves a gap in the deployment verification pipeline.

## Proposed Fix
1. Remove `node verify_predeploy.js` from the `/bigtest` and `/smoke-test` workflows if the script is deprecated.
2. OR: Restore/create `verify_predeploy.js` if it was accidentally deleted.
