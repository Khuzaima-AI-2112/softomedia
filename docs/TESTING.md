# Testing Protocol

**Goal**: Ensure reproducible test results by managing environment state strictly.

## ⚠️ Critical Rule: "Stop the World"
Before running ANY test suite (Unit, Integration, or E2E), you **MUST** stop all running logic servers to prevent port conflicts and state pollution.

```bash
# Windows (PowerShell)
npx -y kill-port 8080 5174
```

## 1. Observability Verification (Backend)
Tests the SRE endpoints (`/api/telemetry/error`) to ensure the server is monitoring-ready.

**Command**:
```bash
# 1. Stop existing servers
npx -y kill-port 8080 5174

# 2. Start Ad Server
npm start --prefix ad-server

# 3. Run Verify Script (in new terminal)
node tests/verify_observability.js
```

## 2. E2E Regression (Frontend + Backend)
Uses Playwright to test the full user journey.

**Command**:
```bash
# 1. Stop everything
npx -y kill-port 8080 5174

# 2. Run Playwright (Auto-starts dev servers)
npx playwright test
```

## 3. Unit Tests
**Command**:
```bash
npm test
```
