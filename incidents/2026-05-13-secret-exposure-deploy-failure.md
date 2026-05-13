# SRE Incident Report: Secret Exposure & Cloud Build Deploy Failure

**Incident ID:** INC-2026-05-13-SECRET-DEPLOY
**Date:** 2026-05-13
**Status:** RESOLVED
**Severity:** High (Security + Production Deploy Blocker)
**Duration:** 09:18 – 10:31 EDT (1h 13m)
**Component:** `ad-server` Cloud Run · `ad-server/cloudbuild.yaml` · `.env.development` · GCP Secret Manager · `src/api/stores.js` · `src/api/pricing.js`
**Reported By:** ChrisFro (SRE Lead)
**Report Prepared By:** Perplexity SRE AI

---

## Executive Summary

On 2026-05-13, Cloud Build step 5 (`deploy-backend`) failed during deployment of `ad-server` revision `ad-server-00067-wxh`, then again on `ad-server-00068-hqc`. The container failed to start and bind to `PORT=8080` within the Cloud Run startup timeout. Investigation uncovered three compounding root causes: (1) the Cloud Build service account lacked `secretmanager.secretAccessor` binding for both `JWT_SECRET` and `GEMINI_API_KEY`; (2) `JWT_SECRET` held an invalid 2-character value in Secret Manager; and (3) `stores.js` and `pricing.js` imported a non-existent named export `authenticate` from `middleware/auth.js`, which exports `requireAuth`. A parallel security finding was also escalated: `.env.development` containing live plaintext values for both secrets had been committed to `main` and was present in git history. All four issues were resolved and a clean deploy was confirmed at 10:31 EDT.

---

## Symptoms & Observations

1. **Cloud Build Error (both builds):** `ERROR: build step 5 "gcr.io/google.com/cloudsdktool/cloud-sdk" failed: step exited with non-zero status: 1`
2. **Cloud Run Error:** `The user-provided container failed to start and listen on the port defined by the PORT=8080 environment variable within the allocated timeout.`
3. **Revisions affected:** `ad-server-00067-wxh` (v2.4.0 tag) and `ad-server-00068-hqc` (v2.4.0 retry)
4. **No crash logs** available for first revision — container exited before writing structured logs
5. **Second revision crash log:**
   ```
   SyntaxError: The requested module '../middleware/auth.js' does not
   provide an export named 'authenticate'
       at ModuleJob._instantiate (node:internal/modules/esm/module_job:123:21)
   ```
6. **Secret Manager audit:** Both secrets existed with ENABLED versions; Cloud Build SA had no binding to either
7. **`.env.development` committed to repo** with plaintext `JWT_SECRET` (64-char hex) and `GEMINI_API_KEY` (39-char key)

---

## Root Cause Analysis

### RCA-1: Cloud Build SA Missing IAM Binding

`ad-server/cloudbuild.yaml` deploys via `gcloud run deploy` with `--set-secrets=JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest`. This requires the Cloud Build service account (`524693967756@cloudbuild.gserviceaccount.com`) to hold `roles/secretmanager.secretAccessor` on both secrets. Neither binding existed. The Cloud Run compute SA (`524693967756-compute@developer.gserviceaccount.com`) was correctly bound — runtime access was not the issue, only build-time injection during revision creation.

### RCA-2: Invalid `JWT_SECRET` Value in Secret Manager

`JWT_SECRET` version 1 contained a value of only 2 characters. A valid JWT secret for HS256 requires a minimum of 32 random characters. The broken value would cause `jsonwebtoken` to reject signing operations or produce trivially weak tokens, resulting in auth endpoint failures at runtime even after the deploy issue was resolved.

### RCA-3: Named Export Mismatch — `authenticate` vs `requireAuth`

`src/api/stores.js` and `src/api/pricing.js` both contained:
```js
import { authenticate } from '../middleware/auth.js';
```
`src/middleware/auth.js` exports `requireAuth`, `requireRole`, `requireOwnership`, and `optionalAuth` — there is no export named `authenticate`. Node.js ESM throws a `SyntaxError` at module instantiation time when a named import does not exist, preventing the entire process from starting. This caused the `PORT=8080` binding timeout on the second revision.

### RCA-4: `.env.development` Committed to `main`

`.gitignore` covered `.env.development.local` (the Vite default) but not `.env.development` (without the `.local` suffix). As a result, `.env.development` was committed and pushed to `main`, exposing both live secret values. The file header itself read `DO NOT COMMIT THIS FILE`. Deletion from the working tree does not remove values from git history.

---

## Timeline

| Time (EDT) | Event |
|---|---|
| 09:18 | Deploy triggered via `v2.4.0` tag; Cloud Build step 5 fails with exit code 1 |
| 09:21 | SRE investigation begins; error identified as Cloud Run startup failure |
| 09:26 | `Dockerfile` and `index.js` reviewed; `PORT=8080` binding confirmed structurally correct |
| 09:27 | PowerShell secret verification scripts executed across all 5 diagnostic blocks |
| 09:30 | Block 3 confirms Cloud Build SA **NOT BOUND** to `JWT_SECRET` and `GEMINI_API_KEY` |
| 09:30 | Block 5 reveals `JWT_SECRET` value is only **2 characters** |
| 09:32 | `.env.development` inspected in repo; live secrets confirmed committed to `main` |
| 09:32 | **Security incident declared** — `GEMINI_API_KEY` rotation initiated in GCP Console |
| 09:40 | `JWT_SECRET` rotated with cryptographically valid 64-char random value pushed to Secret Manager |
| 09:40 | Cloud Build SA granted `roles/secretmanager.secretAccessor` on both secrets |
| 09:41 | `.env.development` removed from branch via `git rm`; pushed to `main` |
| 09:43 | `.gitignore` updated to cover `.env.development`, `.env.production`, `.env.test` |
| 09:44 | Security fixes committed and pushed (`5616aa9`) |
| 09:46 | Git history purged via `git filter-repo --force`; force push completed |
| 09:46 | `v2.4.0` re-triggered; second build fires — revision `ad-server-00068-hqc` |
| 10:16 | Cloud Logging reveals `SyntaxError: authenticate` export missing — **RCA-3 identified** |
| 10:18 | `src/middleware/auth.js` confirmed to export `requireAuth`, not `authenticate` |
| 10:20 | `stores.js` and `pricing.js` confirmed as the only two affected files |
| 10:29 | Fix applied locally — `import { requireAuth as authenticate }` in both files |
| 10:30 | Commit `c7c393d` pushed; `v2.4.1` tag created and pushed |
| 10:31 | Build triggered; deploy confirmed successful — **incident resolved** |

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

### Fix 2 — `JWT_SECRET` Rotated
New 64-character cryptographically random value generated and pushed as version 2 to Secret Manager. Version 1 (2-char invalid value) disabled.

### Fix 3 — `GEMINI_API_KEY` Rotated
Exposed key revoked in GCP Console / Google AI Studio. New key generated and pushed as version 3 to Secret Manager.

### Fix 4 — `.env.development` Removed from Branch
```bash
git rm .env.development
git commit -m "security: remove committed .env.development"
git push origin main
```

### Fix 5 — `.gitignore` Hardened
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

### Fix 7 — Named Export Corrected in `stores.js` and `pricing.js`
```js
// Before (broken)
import { authenticate } from '../middleware/auth.js';

// After (correct)
import { requireAuth as authenticate } from '../middleware/auth.js';
```
Applied to both `src/api/stores.js` and `src/api/pricing.js`. All route handler call sites unchanged — alias preserves local name.

---

## Prevention & Safeguards

1. **`.gitignore` audit standard** — All env file variants must be covered explicitly. The Vite/Node default template only covers `.local` suffixes. Bare `.env.*` files must be added manually. Verify on every new project setup.

2. **Secret Manager as single source of truth** — No secret values should exist outside Secret Manager for production workloads. Local development must use `.env.development.local` (gitignored by Vite default) or an equivalent secrets manager tool.

3. **Cloud Build SA binding checklist** — Any secret added to Secret Manager must immediately receive IAM bindings for both the Cloud Build SA (`*@cloudbuild.gserviceaccount.com`) and Cloud Run compute SA (`*-compute@developer.gserviceaccount.com`) before being referenced in `cloudbuild.yaml`.

4. **Secret value length validation** — Add a pre-deploy validation step to `cloudbuild.yaml`:
```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      JWT_LEN=$(gcloud secrets versions access latest --secret=JWT_SECRET --project=${_PROJECT} | wc -c)
      if [ "$JWT_LEN" -lt 32 ]; then
        echo "ERROR: JWT_SECRET too short ($JWT_LEN chars)"
        exit 1
      fi
      echo "✅ JWT_SECRET length OK"
  id: 'validate-secrets'
  waitFor: ['-']
```

5. **Export name convention** — Named middleware exports should be consistent across the codebase. `auth.js` should either export `authenticate` directly or all importers should use the canonical `requireAuth` name. Recommend renaming the export in `auth.js` to `authenticate` in a follow-up PR to eliminate the alias.

6. **Pre-commit secret scanning** — Install `git-secrets` or `detect-secrets` as a pre-commit hook:
```bash
pip install detect-secrets
detect-secrets scan > .secrets.baseline
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
| 7 | Fix `authenticate` import in `stores.js` and `pricing.js` | ✅ Done |
| 8 | Tag `v2.4.1` and trigger clean deploy | ✅ Done |

---

**Report Prepared By:** Perplexity SRE AI
**Reviewer Required:** ChrisFro (SRE Lead)
