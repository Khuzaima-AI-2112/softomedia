---
description: Start local server and infrastructure needed for local testing
---

# Start Local Testing Environment

Use this workflow to spin up the full local stack for testing.

// turbo-all
1. **Start Ad Server**:
   Launches the backend server in a new window.
   ```powershell
   Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ad-server; npm run dev"
   ```

2. **Start Client Application**:
   Launches the Vite frontend in a new window.
   ```powershell
   Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client-app; npm run dev"
   ```

3. **Status Check**:
   Wait a moment for servers to initialize, then verify ports.
   ```powershell
   Start-Sleep -Seconds 5
   Get-NetTCPConnection -LocalPort 8080, 5173 -ErrorAction SilentlyContinue | Select-Object LocalPort, State
   ```
