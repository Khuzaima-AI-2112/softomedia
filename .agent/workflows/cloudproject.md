---
description: Check the current Google Cloud project and set it to softomedia-live-2026
---

# Check and Set Cloud Project

Use this workflow to ensure your environment is targeting the correct Google Cloud project.

// turbo-all
1. **Check Current Project**:
   ```powershell
   gcloud config get-value project
   ```

2. **Set Project**:
   Set the active project to `softomedia-live-2026`.
   ```powershell
   gcloud config set project softomedia-live-2026
   ```

3. **Verify Configuration**:
   ```powershell
   gcloud config list
   ```
