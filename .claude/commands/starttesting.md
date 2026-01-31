---
description: Start development servers and run E2E tests
---

# Start Testing Workflow (/starttesting)

Initialize the development environment and run the full E2E test suite.

## Prerequisites
- Node.js installed
- Dependencies installed (`npm install` in both directories)

## Steps

1. **Start Backend Server** (in background):
   ```powershell
   cd ad-server && npm run dev
   ```
   Wait for: "Server running on port 8080"

2. **Start Frontend Server** (in background):
   ```powershell
   cd client-app && npm run dev
   ```
   Wait for: "Local: http://localhost:5173"

3. **Run E2E Tests**:
   ```powershell
   npm run test:e2e
   ```

4. **Run with UI** (optional):
   ```powershell
   npm run test:e2e:ui
   ```

## Notes
- E2E tests run with `workers: 1` (serial) to prevent server overload
- Auth setup requires localStorage tokens - see `tests/global.setup.js`
