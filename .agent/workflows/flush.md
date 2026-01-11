---
description: Shut down all local servers, close ports, flush the database and reseed with test data
---

# Flush Development Environment

Use this workflow to reset your local environment to a clean state with fresh test data.

// turbo-all
1. **Shut Down Local Servers**:
   Close processes listening on server ports (8080 and 5173).
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 8080, 5173 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
   ```

2. **Flush Database**:
   Clear all records from the local/dev Firestore project.
   ```powershell
   cd ad-server; node scripts/flush-db.js
   ```

3. **Reseed Database**:
   Populate the database with initial test data.
   ```powershell
   cd ad-server; npm run seed
   ```

4. **Verify Reset**:
   ```powershell
   echo "Local environment has been flushed and reseeded."
   ```
