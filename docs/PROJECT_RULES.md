# SoftoMedia Live - Project Rules & Best Practices

**Last Updated**: December 22, 2025  
**Purpose**: Critical rules derived from deployment incidents to prevent recurring mistakes

---

## 🚨 CRITICAL RULES (Must Follow)

### Rule 1: Never Hardcode Configuration
**What**: API URLs, backend URLs, or environment-specific values  
**How**: Use centralized `config.js` or environment variables  
**Why**: The "Split Brain" issue (Player pointing to old backend, Dashboard to new) was caused by hardcoded URLs in 3+ files

**Enforcement**:
- ❌ BAD: `const API_URL = 'https://ad-server-...`
- ✅ GOOD: `import { API_URL } from './config.js'`

---

### Rule 2: Service Deletion Requires Verification
**What**: Before ANY `gcloud run services delete` command  
**How**: 
1. Run `gcloud run services list` first
2. Confirm the service URL matches deletion target
3. Understand: deleting a service deletes ALL revisions
4. Get explicit user approval with service name + URL

**Why**: Accidentally deleted active backend, causing 30-minute outage

**Enforcement**:
```powershell
# ALWAYS run this first:
gcloud run services list --region us-central1

# Then confirm before:
gcloud run services delete SERVICE_NAME --region us-central1
```

---

### Rule 3: Post-Deployment Seed is Mandatory
**What**: After EVERY `gcloud builds submit` with backend changes  
**How**:
1. Wait for deployment completion
2. Immediately run: `Invoke-RestMethod -Uri "$BACKEND_URL/api/debug/seed"`
3. Verify response: `{"status":"seeded"}`

**Why**: Redeployments create empty databases. Skipping seed caused login failures

**Enforcement**:
```powershell
# After gcloud builds submit completes:
Invoke-RestMethod -Uri "https://ad-server-bi477lfjdq-uc.a.run.app/api/debug/seed"
```

---

## ⚠️ IMPORTANT RULES (High Priority)

### Rule 4: Verify GCS Assets, Not Just Filenames
**What**: When uploading files to Google Cloud Storage  
**How**:
1. Verify file exists: `gcloud storage ls gs://bucket/file.png`
2. Check unique sizes: Compare to detect duplicates
3. Visual inspection: Download + view at least one file

**Why**: All 5 "distinct" ad images were copies of same coffee image (748.3kiB each)

**Enforcement**:
```powershell
# Check sizes to detect duplicates:
gcloud storage ls -l gs://softomedia-live2026-ads/
```

---

### Rule 5: Check IAM After Every Deployment
**What**: Verify Cloud Run service has public access  
**How**:
```powershell
# Check policy:
gcloud run services get-iam-policy SERVICE_NAME --region us-central1

# If empty or missing allUsers, add:
gcloud run services add-iam-policy-binding SERVICE_NAME \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

**Why**: Redeployed backend returned "403 Forbidden" due to missing IAM binding

---

### Rule 6: Cache Invalidation is Required
**What**: After deploying image or API changes  
**How**:
1. Hard refresh browser: `Ctrl+Shift+R`
2. Test in Incognito/Private mode
3. Wait 60 minutes for signed URL expiration if images don't update

**Why**: Signed URLs cache for 60 minutes. New GCS images may not appear immediately

---

### Rule 7: Atomic Deployments Only
**What**: ONLY deploy via Cloud Build config  
**How**: Use `gcloud builds submit --config cloudbuild.yaml .`

**NEVER**:
- ❌ Delete Cloud Run services manually
- ❌ Update individual services
- ❌ Change traffic splitting manually

**Why**: Manual service management led to accidental deletion and inconsistent states

---

### Rule 8: GCS Bucket Must Be Publicly Readable
**What**: Make Storage bucket publicly accessible immediately after creation  
**How**:
```powershell
gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

**Why**: Without public read access, player displays black screens - images fail to load from GCS URLs

**Enforcement**:
- Run immediately after `gcloud storage buckets create`
- Verify with test URL: `https://storage.googleapis.com/BUCKET_NAME/demo_ad_1.png`

---

### Rule 9: Seed Endpoint Must Create Admin User
**What**: Always include admin user creation in seed endpoint, don't rely on server startup functions  
**How**:
```javascript
// In /api/debug/seed endpoint:
const usersRef = firestore.collection('users');
const adminSnapshot = await usersRef.where('email', '==', ADMIN_EMAIL).get();

if (adminSnapshot.empty) {
    const hashedPassword = await hashPassword(ADMIN_PASSWORD);
    await usersRef.doc('admin_001').set({
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        name: 'Admin User',
        created_at: new Date().toISOString()
    });
}
```

**Why**: Server startup functions like `bootstrapAdmin()` are unreliable:
- Cloud Run containers restart frequently
- Startup functions may fail silently
- No guarantee they execute before seed endpoint is called

**Enforcement**:
- Admin user creation MUST be in seed endpoint (Step 0, before other data)
- Test login immediately after seeding: `POST /api/auth/login`
- Never assume startup bootstrap worked

---

## 📋 Pre-Deployment Checklist

Before running `gcloud builds submit`:

- [ ] Run `node verify_predeploy.js` (if exists)
- [ ] Verify no hardcoded URLs in new code
- [ ] Confirm GCS assets are unique (if modified)
- [ ] Review `DEPLOYMENT_LOG.md` for past issues

After deployment completes:

- [ ] Run seed endpoint
- [ ] Check IAM policy
- [ ] Test in incognito mode
- [ ] Verify both frontend + backend URLs work

---

## 🔗 Related Files
- `DEPLOYMENT_LOG.md` - History of deployment issues and fixes
- `SoftoMediaLive_Complete_Specifications.md` - Full system specs
- `verify_predeploy.js` - Pre-deployment validation script
- `client-app/src/config.js` - Centralized configuration
