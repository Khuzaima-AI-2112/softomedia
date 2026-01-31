---
description: Code hygiene checks - linting and console.log detection
---

# Operational Hygiene Workflow (/hygiene)

This workflow ensures code quality standards are maintained.

## Phase 1: Linting

1. **Run ESLint on both services**:
   ```powershell
   npm run lint
   ```

   Expected: 0 errors (warnings are acceptable up to threshold of 50)

## Phase 2: Console.log Detection

2. **Scan for debug statements in production code**:
   ```powershell
   # Ad-server
   Get-ChildItem -Path "ad-server/src" -Recurse -Include *.js | Select-String "console\.log"

   # Client-app
   Get-ChildItem -Path "client-app/src" -Recurse -Include *.js,*.jsx | Select-String "console\.log"
   ```

   Note: Some diagnostic logs may be intentional. Review each occurrence.

## Phase 3: Dead Code Detection

3. **Check for unused exports** (optional):
   Review any lint warnings about unused variables or imports.

## Summary
Clean code hygiene means:
- 0 lint errors
- Minimal console.log statements (diagnostic only)
- No unused imports or variables
