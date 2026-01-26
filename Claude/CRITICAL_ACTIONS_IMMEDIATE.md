# EMERGENCY DEBUG PROTOCOL - BUG IS ACTIVE RIGHT NOW

**Date:** 2026-01-25 23:39
**Status:** 🔴 **CRITICAL OUTAGE IN PROGRESS**
**Current Error:** HTTP 500 "I encountered a ghost in the machine"

---

##

 🚨 STOP - READ THIS FIRST

**The bug from this morning is STILL HAPPENING right now (23:39).**

The SRE report that claimed it was "resolved" at 14:07 was WRONG. Screenshots in `Claude/bugs/` folder show 500 errors are still occurring.

**DO NOT proceed with preventive fixes until we DEBUG and FIX the actual issue.**

---

## 🔥 WHAT YOU NEED TO DO RIGHT NOW

### STEP 1: Check Production Logs (5 minutes) ⚠️ MOST IMPORTANT

**The error message "ghost in the machine" tells us NOTHING. We need the real error.**

**Option A: Using Google Cloud Console (easiest)**
1. Go to https://console.cloud.google.com/run?project=softomedia-live-2026
2. Click on `ad-server` service
3. Click "LOGS" tab
4. In the filter box, type: `"[Ghost-AI]"`
5. Look for lines containing `"Execution Error"` or `"Failed to initialize"`
6. **Screenshot the actual error and share it**

**Option B: Using gcloud CLI**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ad-server AND textPayload:[Ghost-AI]" \
  --project=softomedia-live-2026 \
  --limit=100 \
  --format=json \
  --freshness=1h
```

**What you're looking for:**
- `"API key not valid"` → Key is wrong
- `"quota exceeded"` → Billing/quota issue
- `"permission denied"` → Key lacks permissions
- `"ENOTFOUND"` or network errors → Connectivity issue
- Any other specific error message

**‼️ POST THE ACTUAL ERROR IN #incidents IMMEDIATELY**

---

### STEP 2: Does the Secret Actually Exist? (3 minutes)

```bash
# Check if GEMINI_API_KEY exists in Secret Manager
gcloud secrets describe GEMINI_API_KEY --project=softomedia-live-2026
```

**If you get an error** like "Secret not found":
```bash
# You need to CREATE it (get a key from https://aistudio.google.com/app/apikey first)
echo "PASTE_YOUR_GEMINI_API_KEY_HERE" | \
  gcloud secrets create GEMINI_API_KEY \
    --data-file=- \
    --project=softomedia-live-2026
```

**If it exists,** check the value:
```bash
# Get the value (DON'T share this publicly)
gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=softomedia-live-2026

# Should start with "AIza..." (typical Google API key format)
```

---

### STEP 3: Test the API Key (10 minutes)

**Create a test file to verify the key works:**

```javascript
// test-gemini.js (create this in ad-server directory)
import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  console.log(`Testing key (starts with: ${apiKey.substring(0, 6)}...)`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Hello');
    const response = await result.response;

    console.log('✅ SUCCESS! Response:', response.text());
  } catch (error) {
    console.error('❌ FAILED!');
    console.error('Error:', error.message);
    console.error('Name:', error.name);
    console.error('Code:', error.code);
    console.error('Full:', error);
    process.exit(1);
  }
}

test();
```

**Run it:**
```bash
cd ad-server

# Get the production secret
export GEMINI_API_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=softomedia-live-2026 2>/dev/null)

# Test it
node test-gemini.js
```

**Results:**

✅ **If it works:** Key is valid, problem is in Cloud Run configuration or request format
❌ **If "API key not valid":** Need to get a new key from Google AI Studio
❌ **If "quota exceeded":** Need to enable billing or increase quota
❌ **If "model not found":** Key doesn't have access to gemini-1.5-flash

---

### STEP 4: Is Cloud Run Actually Using the Secret? (5 minutes)

```bash
# Check what's configured in the deployed service
gcloud run services describe ad-server \
  --region=us-central1 \
  --project=softomedia-live-2026 \
  --format="get(spec.template.spec.containers[0].env)"
```

**Look for:** Something like `GEMINI_API_KEY=secret:GEMINI_API_KEY`

**If it's missing:** The deployment didn't inject the secret correctly, even though cloudbuild.yaml has it on line 77.

---

## 🛠️ FIXES (Based on What You Found)

### FIX A: Secret Doesn't Exist or Is Invalid

1. Get a valid Gemini API key: https://aistudio.google.com/app/apikey
2. Create/update the secret:
```bash
echo "YOUR_ACTUAL_KEY_HERE" | gcloud secrets versions add GEMINI_API_KEY \
  --data-file=- \
  --project=softomedia-live-2026
```
3. Redeploy:
```bash
gcloud builds submit --config cloudbuild.yaml --project=softomedia-live-2026
```
4. Wait for deployment to complete (watch health check)
5. **Test in browser**

---

### FIX B: Cloud Run Service Account Doesn't Have Permission

```bash
# Get the service account
SA=$(gcloud run services describe ad-server \
  --region=us-central1 \
  --project=softomedia-live-2026 \
  --format="value(spec.template.spec.serviceAccountName)")

echo "Service account: $SA"

# Grant permission to access secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor" \
  --project=softomedia-live-2026

# Redeploy to pick up permissions
gcloud builds submit --config cloudbuild.yaml --project=softomedia-live-2026
```

---

### FIX C: Quota or Billing Issue

1. Go to: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/overview?project=softomedia-live-2026
2. Check if API is enabled
3. Go to: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=softomedia-live-2026
4. Check quotas
5. Go to: https://console.cloud.google.com/billing?project=softomedia-live-2026
6. Ensure billing is enabled
7. May need to request quota increase

---

### FIX D: Wrong Model or Request Format

**If gemini-1.5-flash doesn't work, try gemini-pro:**

Edit `ad-server/routes/ghost-api.js` line 59:
```javascript
// Change from:
aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// To:
aiModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
```

Deploy and test.

---

## ✅ VERIFY IT'S ACTUALLY FIXED

### Test 1: API Endpoint
```bash
# Replace with your actual service URL
curl -X POST https://ad-server-XXXXX-uc.a.run.app/ghost-api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "persona": "CRM_buyer_persona",
    "steps": [{"url": "/test", "note": "verification test"}]
  }'
```

**Expected:** HTTP 200 with JSON containing `"answer"` field
**NOT:** HTTP 500 with "ghost in machine"

### Test 2: Browser
1. Open your app in Chrome
2. F12 to open DevTools → Network tab
3. Click "Start a Walkthrough"
4. Add a step, click analyze
5. Check Network tab for response

**Success = HTTP 200, user sees AI response**

### Test 3: Logs
```bash
# Watch for success
gcloud logging tail "resource.type=cloud_run_revision" \
  --project=softomedia-live-2026 \
  --format=json | grep -i "ghost"
```

Look for: `Archived ticket: ticket-...` (means it worked)

---

## 📊 AFTER IT'S FIXED - Add Better Logging

**To prevent this again, improve error visibility:**

Edit `ad-server/routes/ghost-api.js` line 156-163:

```javascript
} catch (error) {
    // Log FULL error details (not just message)
    console.error('[Ghost-AI] DETAILED ERROR:', {
        message: error.message,
        name: error.name,
        code: error.code,
        status: error.status,
        stack: error.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    });

    logError(error);

    res.status(500).json({
        error: 'I encountered a ghost in the machine. Please try again.',
        debug: error.message,
        errorType: error.name  // Add this
    });
}
```

This way next time we'll see the REAL error in logs immediately.

---

## 🆘 STILL STUCK?

1. **Check logs first** - The answer is in the Cloud Run logs
2. **Test the key** - Isolate whether it's the key or something else
3. **Screenshot errors** - Share actual error messages, not descriptions
4. **Ask for help** - Post in #incidents with:
   - What you tried
   - Exact error message from logs
   - Screenshots
5. **Don't guess** - Check, don't assume

---

## 📞 ESCALATION

**If stuck after 30 minutes:**
- Post in #incidents with full details
- Tag @engineering-lead
- Include screenshots of logs and errors

**If no GCP access:**
- Ask DevOps/SRE for emergency access NOW
- This is a P0 outage, access should be granted immediately

---

**Next step:** Run STEP 1 (check logs) RIGHT NOW. Everything else depends on knowing the actual error.
