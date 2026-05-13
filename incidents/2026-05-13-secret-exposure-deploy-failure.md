# SRE Incident Report: Secret Exposure & Cloud Build Deploy Failure

**Date:** 2026-05-13
**Incident ID:** INC-2026-05-13-SECRET-DEPLOY
**Status:** RESOLVED
**Severity:** High (Security + Production Deploy Blocker)
**Component:** `ad-server` Cloud Run, `ad-server/cloudbuild.yaml`, `.env.development`, GCP Secret Manager

---

## Executive Summary

On 2026-05-13, Cloud Build step 5 (`deploy-backend`) failed with a non-zero exit code during deployment of `ad-server` revision `ad-server-00067-wxh`. The container failed to start and bind to `PORT=8080` within the Cloud Run startup timeout. Investigation revealed two compounding root causes: (1) the Cloud Build service account lacked `secretmanager.secretAccessor` binding for both `JWT_SECRET` and `GEMINI_API_KEY`, preventing proper secret injection via `--set-secrets` at deploy time; and (2) `JWT_SECRET` had a stored value of only 2 characters — an invalid token secret that would cause runtime auth failures. A parallel security finding was also made: `.env.development` containing live values for both `JWT_SECRET` and `GEMINI_API_KEY` had been committed directly to the `main` branch and was present in git history.

---

## Symptoms & Observations

1. **Cloud Build Error:** `ERROR: build step 5 "gcr.io/google.com/cloudsdktool/cloud-sdk" failed: step exited with non-zero status: 1`
2. **Cloud Run Error:** `The user-provided container failed to start and listen on the port defined by the PORT=8080 environment variable within the allocated timeout.`
3. **Revision:** `ad-server-00067-wxh` — failed, did not serve traffic
4. **No crash logs available** in Cloud Logging for the failed revision (container exited before writing structured logs)
5. **Secret Manager audit:** Both `JWT_SECRET` and `GEMINI_API_KEY` existed with ENABLED versions, but Cloud Build SA was not bound to either secret
6. **`.env.development` committed to repo** containing plaintext `JWT_SECRET` (64-char hex) and `GEMINI_API_KEY` (39-char API key)

---

## Root Cause Analysis (RCA)

### 1. Cloud Build SA Missing `secretmanager.secretAccessor` Binding

`ad-server/cloudbuild.yaml` deploys via `gcloud run deploy` with `--set-secrets=JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest`. This requires the Cloud Build service account (`524693967756@cloudbuild.gserviceaccount.com`) to hold `roles/secretmanager.secretAccessor` on both secrets. Neither binding existed, causing the deploy step to fail when attempting to resolve secrets during revision creation. The Cloud Run compute SA (`524693967756-compute@developer.gserviceaccount.com`) was correctly bound — runtime access was not the issue, only build-time injection.

### 2. Invalid `JWT_SECRET` Value in Secret Manager

`JWT_SECRET` version 1 contained a value of only 2 characters. A valid JWT secret requires a minimum of 32 random characters for HS256 security. The broken value would cause `jsonwebtoken` to either reject signing operations or produce trivially weak tokens, resulting in auth endpoint failures at runtime even after the deploy issue was resolved.

### 3. `.env.development` Committed to `main` Branch

`.gitignore` covered `.env.development.local` but not `.env.development` (without the `.local` suffix). As a result, `.env.development` was committed to the repository and pushed to `main`, exposing:
- `JWT_SECRET=8e3407d4aa1e577b2d32d1a7ffbcf1a4369428cf089015b87a6048e438e861de`
- `GEMINI_API_KEY=AIzaSyAYgmZKRaGIiLjtNWCNmA2sTR2gPIxMV5o`

Both values remained accessible in git history even after the file was deleted from the working tree.

---

## Timeline

| Time (EDT) | Event |
|---|---|
| 09:18 | Deploy triggered; Cloud Build step 5 fails with exit code 1 |
| 09:21 | SRE investigation begins; error identified as Cloud Run startup failure |
| 09:26 | `ad-server/Dockerfile` and `index.js` reviewed; port binding confirmed correct |
| 09:27 | PowerShell secret verification scripts executed |
| 09:30 | Block 3 confirms Cloud Build SA NOT BOUND to `JWT_SECRET` and `GEMINI_API_KEY` |
| 09:30 | Block 5 reveals `JWT_SECRET` value is only 2 characters |
| 09:32 | `.env.development` inspected; live secrets confirmed committed to repo |
| 09:32 | Security incident declared — `GEMINI_API_KEY` rotation initiated |
| 09:40 | `JWT_SECRET` rotated with cryptographically valid 64-char value |
| 09:40 | Cloud Build SA granted `secretmanager.secretAccessor` on both secrets |
| 09:41 | `.env.development` removed from branch via `git rm` and pushed |
| 09:43 | `.gitignore` updated to cover `.env.development`, `.env.production`, `.env.test` |
| 09:44 | Fix committed and pushed to `main` (commit `5616aa9`) |
| 09:46 | Git history purged via `git filter-repo`; force push completed |
| 09:46 | Incident resolved |

---

## Resolution & Fixes

### Fix 1 — Cloud Build SA IAM Binding
```powershell
$CB_SA = "524693967756@cloudbuild.gserviceaccount.com"
foreach ($SECRET in @("JWT_SECRET", "GEMINI_API_KEY")) {
    gcloud secrets add-iam-policy-binding $SECRET `
        --project=softomedia-live-2026 `
        --member="serviceAccount:$CB_SA" `
        --role="roles/secretmanager.secretAccessor"
}
```

### Fix 2 — JWT_SECRET Rotated
New 64-character cryptographically random value generated and pushed as version 2 to Secret Manager. Old version 1 (2-char invalid value) disabled.

### Fix 3 — GEMINI_API_KEY Rotated
Exposed key revoked in GCP Console. New key generated and pushed as version 3 to Secret Manager.

### Fix 4 — `.env.development` Removed from Branch
```bash
git rm .env.development
git commit -m "security: remove committed .env.development"
git push origin main
```

### Fix 5 — `.gitignore` Hardened
Added explicit entries for bare env files (without `.local` suffix):
```
# Bare env files (no .local suffix)
.env.development
.env.production
.env.test
```

### Fix 6 — Git History Purged
```bash
git filter-repo --path .env.development --invert-paths --force
git push origin main --force
```

---

## Prevention & Safeguards

1. **`.gitignore` coverage audit** — All env file variants (with and without `.local` suffix) must be covered. The standard Vite/Node `.gitignore` template only covers `.local` suffixes; bare `.env.*` files must be added explicitly.
2. **Secret Manager as single source of truth** — No secret values should exist outside Secret Manager for production. Development values must use `.env.development.local` (gitignored by default) or a secrets manager equivalent.
3. **Cloud Build SA binding checklist** — Any new secret added to Secret Manager must immediately receive IAM bindings for both the Cloud Build SA and Cloud Run compute SA before being referenced in `cloudbuild.yaml`.
4. **Secret value length validation** — Before deploying, verify secret values have non-trivial length. `JWT_SECRET` must be ≥ 32 characters. Consider adding a pre-deploy validation step to `cloudbuild.yaml` that checks secret length.
5. **Pre-commit hook** — Add `git-secrets` or `detect-secrets` as a pre-commit hook to block accidental credential commits at the source.
6. **Proposed `cloudbuild.yaml` validation step:**
```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      JWT_LEN=$(gcloud secrets versions access latest --secret=JWT_SECRET --project=${_PROJECT} | wc -c)
      if [ "$JWT_LEN" -lt 32 ]; then
        echo "ERROR: JWT_SECRET is too short ($JWT_LEN chars). Minimum 32 required."
        exit 1
      fi
      echo "✅ JWT_SECRET length OK ($JWT_LEN chars)"
  id: 'validate-secrets'
  waitFor: ['-']
```

---

## Full Incident Checklist

| Step | Action | Status |
|---|---|---|
| 1 | Rotate `GEMINI_API_KEY` in GCP Console | ✅ Done |
| 2 | Rotate `JWT_SECRET` in Secret Manager | ✅ Done |
| 3 | Bind Cloud Build SA to both secrets | ✅ Done |
| 4 | Delete `.env.development` from branch | ✅ Done |
| 5 | Harden `.gitignore` | ✅ Done |
| 6 | Purge `.env.development` from git history | ✅ Done |
| 7 | Re-trigger Cloud Build deploy | ✅ Done |

---

**Report Prepared By:** Perplexity SRE AI (gray-hair QA/SRE)
**Reviewer Required:** ChrisFro (SRE Lead)
