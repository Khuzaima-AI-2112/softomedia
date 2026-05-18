# URLfixNOTES — Cloud Build & URL Hardcoding Fix Archive

**Repository:** `cfroszte/softomedia-live2026`
**Fix Date:** 2026-05-18
**Commits:**
- `b6647c2f631218639cdf963f9e9ac835134dde86` — `cloudbuild.yaml`
- `c8df79c51a64519fc8e466cecdfd8e52024c8836` — `client-app/src/layouts/DashboardLayout.jsx`

---

## Background

An audit of the repository was conducted after reports of the wrong UI being displayed regardless of which repo was built in Cloud Build. The investigation identified three root causes, none related to browser session state (persona/localStorage behavior is intentional for demo use):

1. `VITE_API_URL` was declared as a Docker `ARG` in the client-app `Dockerfile` but was never passed as a `--build-arg` during the Cloud Build image build step. The build-time API URL path was silently broken.
2. `CORS_ORIGINS` was hardcoded to `*` in the `ad-server` Cloud Run deployment, allowing any origin to call the backend in production.
3. `ALLOW_DEMO_MODE` was hardcoded to `true` directly in `cloudbuild.yaml`, with no mechanism to disable it for production triggers.
4. The avatar `<div>` in `DashboardLayout.jsx` used a hardcoded, expiring `lh3.googleusercontent.com` URL instead of reading from the authenticated user object.

---

## Fix 1 — `cloudbuild.yaml`: Pass `VITE_API_URL` as Docker `--build-arg`

**File:** `cloudbuild.yaml`
**Step affected:** `build-client-image`

### Before

```yaml
- name: 'gcr.io/cloud-builders/docker'
  args:
    - 'build'
    - '-t'
    - '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY}/${_SERVICE_CLIENT}:$BUILD_ID'
    - '-f'
    - 'client-app/Dockerfile'
    - 'client-app'
  id: 'build-client-image'
  waitFor: ['verify-predeploy']
```

### After

```yaml
- name: 'gcr.io/cloud-builders/docker'
  args:
    - 'build'
    - '--build-arg'
    - 'VITE_API_URL=${_VITE_API_URL}'
    - '-t'
    - '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY}/${_SERVICE_CLIENT}:$BUILD_ID'
    - '-f'
    - 'client-app/Dockerfile'
    - 'client-app'
  id: 'build-client-image'
  waitFor: ['verify-predeploy']
```

### Why

`client-app/Dockerfile` declares `ARG VITE_API_URL` and sets `ENV VITE_API_URL=$VITE_API_URL` before the `npm run build` step. Without the `--build-arg` being passed, Vite bakes an empty string into the bundle. At runtime `entrypoint.sh` injects the correct URL into `window.ENV`, which `src/config.js` reads first — so production works. However, the build-time fallback chain was always hitting `localhost:8080`, which would cause failures in any environment where `window.ENV` was not available (e.g., SSR, test runners, Playwright tests running against the built bundle).

---

## Fix 2 — `cloudbuild.yaml`: Replace hardcoded `CORS_ORIGINS=*` with dynamic client URL

**File:** `cloudbuild.yaml`
**Steps affected:** `deploy-adserver`, `deploy-client`

### Before (`deploy-adserver` env vars)

```yaml
--set-env-vars "NODE_ENV=production,CORS_ORIGINS=*,BUILD_ID=$BUILD_ID,ALLOW_DEMO_MODE=true"
```

### After (`deploy-adserver` step — resolves previous client URL before deploying)

```bash
# Resolve the existing client-app URL for CORS (falls back to '*' if not yet deployed)
CLIENT_URL=$$(gcloud run services describe ${_SERVICE_CLIENT} --region ${_REGION} --project ${PROJECT_ID} --format='value(status.url)' 2>/dev/null || echo "*")
echo "📍 CORS origin will be: $$CLIENT_URL"

gcloud run deploy ${_SERVICE_ADSERVER} \
  --set-env-vars "NODE_ENV=production,CORS_ORIGINS=$$CLIENT_URL,BUILD_ID=$BUILD_ID,ALLOW_DEMO_MODE=${_ALLOW_DEMO_MODE}" \
  ...
```

### After (`deploy-client` step — tightens CORS once client URL is confirmed)

```bash
# Step 6b: Update ad-server CORS_ORIGINS now that client URL is known
CLIENT_URL=$$(gcloud run services describe ${_SERVICE_CLIENT} --region ${_REGION} --project ${PROJECT_ID} --format='value(status.url)')
echo "🔄 Updating ad-server CORS_ORIGINS to: $$CLIENT_URL"
gcloud run services update ${_SERVICE_ADSERVER} \
  --region ${_REGION} \
  --update-env-vars "CORS_ORIGINS=$$CLIENT_URL"
echo "✅ CORS locked to $$CLIENT_URL"
```

### Why

`CORS_ORIGINS=*` means any website or script can make credentialed requests to the ad-server API. The two-pass approach is necessary because Cloud Run URLs are only fully known after deployment: the first pass uses the previous deployment's URL (or `*` on first-ever deploy), and the second pass in `deploy-client` locks it to the confirmed URL after both services are live.

---

## Fix 3 — `cloudbuild.yaml`: Move `ALLOW_DEMO_MODE` to a substitution variable

**File:** `cloudbuild.yaml`
**Section:** `substitutions`

### Before

```yaml
# Hardcoded in deploy-adserver --set-env-vars:
ALLOW_DEMO_MODE=true
```

### After

```yaml
substitutions:
  _REGION: 'us-central1'
  _ARTIFACT_REGISTRY: 'softomedia'
  _SERVICE_CLIENT: 'client-app'
  _SERVICE_ADSERVER: 'ad-server'
  _ALLOW_DEMO_MODE: 'true'   # Set to 'false' in production Cloud Build triggers
  _VITE_API_URL: ''          # Populated at runtime via entrypoint.sh; ARG pathway kept valid
```

And in `deploy-adserver` env vars:
```yaml
--set-env-vars "NODE_ENV=production,CORS_ORIGINS=$$CLIENT_URL,BUILD_ID=$BUILD_ID,ALLOW_DEMO_MODE=${_ALLOW_DEMO_MODE}"
```

### Why

Hardcoding `ALLOW_DEMO_MODE=true` in the YAML means it is always enabled in every build, including any future production trigger. Moving it to a substitution variable allows a production Cloud Build trigger to override it to `false` via trigger variable configuration in the GCP Console — without touching the YAML file.

---

## Fix 4 — `DashboardLayout.jsx`: Replace hardcoded avatar URL

**File:** `client-app/src/layouts/DashboardLayout.jsx`

### Before

```jsx
<div className="size-10 rounded-full bg-slate-200 bg-center bg-cover border-2 border-primary/20"
    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDIf29faZUd...")' }}>
</div>
```

### After

```jsx
// Derive avatar: prefer user-supplied URL, fall back to initial letter
const avatarUrl = user?.avatarUrl || user?.photoURL || null;
const avatarInitial = user?.name ? user.name[0].toUpperCase()
    : user?.email ? user.email[0].toUpperCase()
    : persona ? persona[0].toUpperCase()
    : '?';

// In JSX:
<div
    className="size-10 rounded-full bg-slate-300 dark:bg-slate-600 bg-center bg-cover border-2 border-primary/20 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-200"
    style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : {}}
    aria-label={user?.name || persona || 'User avatar'}
>
    {!avatarUrl && avatarInitial}
</div>
```

The `useAuth` destructure was also updated to include `user`:

```jsx
// Before:
const { persona, loading } = useAuth();

// After:
const { persona, user, loading } = useAuth();
```

### Why

The `lh3.googleusercontent.com` URL is an expiring signed asset URL. It will silently break when it expires, showing a broken image. The replacement reads `user.avatarUrl` or `user.photoURL` from the auth context (whichever the login flow populates), and falls back gracefully to a text initial so the UI never shows a broken image element.

---

## Files Changed Summary

| File | Change Type | Commit |
|---|---|---|
| `cloudbuild.yaml` | Modified | `b6647c2f` |
| `client-app/src/layouts/DashboardLayout.jsx` | Modified | `c8df79c5` |

---

## What Was NOT Changed

- `client-app/src/config.js` — correctly reads `window.ENV.VITE_API_URL` first; no change needed
- `client-app/entrypoint.sh` — runtime injection is correct and remains the primary mechanism
- `client-app/Dockerfile` — `ARG VITE_API_URL` declaration is correct; the missing piece was the caller
- `client-app/src/contexts/AuthContext.jsx` — localStorage persona persistence is intentional for demo workflows
- `client-app/src/services/api.js` / `ApiService.js` — no hardcoded URLs; both correctly import from `config.js`
