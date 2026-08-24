# Developer IAM & Service Access Guide — `khuzaimai.design@gmail.com`

This guide documents the API verification, GitHub configuration, and GCP IAM role bindings required for onboarded developer **`khuzaimai.design@gmail.com`**.

---

## 1. Status Overview

| Service / Layer | Target Email / Account | Access Status | Required Action / Commands |
| :--- | :--- | :--- | :--- |
| **GitHub Repository** | `khuzaimai.design@gmail.com` | ✅ **Granted** | Collaborator access added to `cfroszte/softomedia-live2026` |
| **GCP APIs Enabled** | `softomedia-live-2026` | ✅ **Verified** | All 8 required APIs are active (Cloud Build, Cloud Run, Firestore, Secret Manager, Gemini API, etc.) |
| **GCP IAM Policy** | `user:khuzaimai.design@gmail.com` | ✅ **Granted** | All 7 required IAM roles granted on project `softomedia-live-2026` |

---

## 2. GCP API Status Verification (Verified Active)

The following required Google Cloud APIs have been verified active on project `softomedia-live-2026`:
* ✅ `cloudbuild.googleapis.com` (Cloud Build API)
* ✅ `run.googleapis.com` (Cloud Run Admin API)
* ✅ `secretmanager.googleapis.com` (Secret Manager API)
* ✅ `artifactregistry.googleapis.com` (Artifact Registry API)
* ✅ `firestore.googleapis.com` & `datastore.googleapis.com` (Cloud Firestore API)
* ✅ `generativelanguage.googleapis.com` (Gemini API)
* ✅ `storage.googleapis.com` (Cloud Storage API)
* ✅ `iam.googleapis.com` & `cloudresourcemanager.googleapis.com` (IAM Resource Manager)

---

## 3. Provisioning Commands for `khuzaimai.design@gmail.com`

To grant `khuzaimai.design@gmail.com` developer access on GCP project `softomedia-live-2026`, execute the following commands in your shell:

```bash
# 1. Select the approved project
gcloud config set project softomedia-live-2026

# 2. Assign Project Viewer access
gcloud projects add-iam-policy-binding softomedia-live-2026 \
  --member="user:khuzaimai.design@gmail.com" \
  --role="roles/viewer"

# 3. Assign Cloud Build Editor (for viewing build logs & triggering CI/CD)
gcloud projects add-iam-policy-binding softomedia-live-2026 \
  --member="user:khuzaimai.design@gmail.com" \
  --role="roles/cloudbuild.builds.editor"

# 4. Assign Cloud Run Developer (for deploying services)
gcloud projects add-iam-policy-binding softomedia-live-2026 \
  --member="user:khuzaimai.design@gmail.com" \
  --role="roles/run.developer"

# 5. Assign Secret Manager Accessor (for loading JWT_SECRET & GEMINI_API_KEY)
gcloud projects add-iam-policy-binding softomedia-live-2026 \
  --member="user:khuzaimai.design@gmail.com" \
  --role="roles/secretmanager.secretAccessor"

# 6. Assign Artifact Registry Reader (for pulling container images)
gcloud projects add-iam-policy-binding softomedia-live-2026 \
  --member="user:khuzaimai.design@gmail.com" \
  --role="roles/artifactregistry.reader"

# 7. Assign Firestore User (for database operations)
gcloud projects add-iam-policy-binding softomedia-live-2026 \
  --member="user:khuzaimai.design@gmail.com" \
  --role="roles/datastore.user"

# 8. Assign Service Account User (for Cloud Run compute service account binding)
gcloud projects add-iam-policy-binding softomedia-live-2026 \
  --member="user:khuzaimai.design@gmail.com" \
  --role="roles/iam.serviceAccountUser"
```

---

## 4. Developer Onboarding Steps for `khuzaimai.design@gmail.com`

Send the following instructions to the developer once IAM bindings are complete:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/cfroszte/softomedia-live2026.git
   cd softomedia-live2026
   ```

2. **One-Command Setup**:
   ```bash
   npm run setup
   cp .env.example .env.development
   ```

3. **GCP CLI Authentication**:
   ```bash
   gcloud auth login
   gcloud config set project softomedia-live-2026
   ```

4. **Verify Access**:
   ```bash
   # Verify Cloud Build log visibility
   gcloud builds list --project=softomedia-live-2026 --limit=5

   # Verify Cloud Run service visibility
   gcloud run services list --project=softomedia-live-2026
   ```
