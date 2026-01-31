---
description: Clean build artifacts and caches
---

# Clean Workflow (/clean)

Remove build artifacts, caches, and temporary files.

## Steps

1. **Remove node_modules** (if requested):
   ```powershell
   Remove-Item -Recurse -Force ad-server/node_modules -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force client-app/node_modules -ErrorAction SilentlyContinue
   ```

2. **Remove build outputs**:
   ```powershell
   Remove-Item -Recurse -Force client-app/dist -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force ad-server/dist -ErrorAction SilentlyContinue
   ```

3. **Remove coverage reports**:
   ```powershell
   Remove-Item -Recurse -Force ad-server/coverage -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force client-app/coverage -ErrorAction SilentlyContinue
   ```

4. **Reinstall dependencies**:
   ```powershell
   cd ad-server && npm install
   cd ../client-app && npm install
   ```

## Safety
- Always confirm before deleting node_modules
- This operation requires reinstalling dependencies afterwards
