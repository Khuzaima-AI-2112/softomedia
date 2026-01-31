---
description: Commit, push, and deploy the project to Google Cloud
---

# Build and Deploy Workflow

Use this workflow to sync your local changes with GitHub and trigger a production deployment to Cloud Run.

## Pre-flight Checks
Before deploying, ensure:
- All tests pass (`npm test` in both ad-server and client-app)
- No lint errors (`npm run lint`)
- Pre-deploy verification passes

## Steps

1. **Pre-deployment Check**:
   ```powershell
   node verify_predeploy.js
   ```

2. **Commit Changes**:
   Stage and commit all changes with a descriptive snapshot name.
   ```powershell
   git add .
   $msg = "Deployment Snapshot: " + (Get-Date -Format 'yyyy-MM-dd HH:mm')
   git commit -m "$msg"
   ```

3. **Push to GitHub**:
   Sync with the remote repository.
   ```powershell
   git push
   ```

4. **Trigger Cloud Build**:
   Submit the build to the `softomedia-live-2026` project.
   ```powershell
   gcloud builds submit --config cloudbuild.yaml --project softomedia-live-2026 .
   ```

5. **Monitor Deployment**:
   After the build completes, verify the service health via the URLs provided in the build output.

## Safety Notes
- NEVER deploy without running tests first
- ALWAYS verify the pre-deploy check passes
- Monitor the Cloud Build logs for any failures
