# Pre-deployment Workflow

This workflow defines the mandatory pre-deployment checks for `softomedia-live2026`.

## Steps

1. **Run Pre-deployment Script**: Execute `node verify_predeploy.js` from the repository root.
2. **Grep for Hardcoded URLs**: Search for `https://ad-server-*.run.app` or `https://client-app-*.run.app` in all new/modified files.
3. **Verify GCS Assets**: Confirm GCS demo ad images are unique if assets were modified.
4. **Review Logs**: Check `DEPLOYMENT_LOG.md` for known breakages matching the current change.

## Execution

Run this workflow before any deployment or build process.
