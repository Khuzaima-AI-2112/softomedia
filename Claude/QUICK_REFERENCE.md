# Quick Reference Card: Gemini API Recovery

**Print this or keep it open while implementing fixes**

---

## 🔴 URGENT: BUG IS STILL ACTIVE (23:39)

**The feature is NOT fixed.** Screenshots show 500 errors are still happening.
**First action:** Check production logs to see the actual Gemini API error.
**See:** [CRITICAL_ACTIONS_IMMEDIATE.md](CRITICAL_ACTIONS_IMMEDIATE.md) for debug steps.

---

## 🚨 WHAT HAPPENED TODAY

| Time | Issue | Root Cause | Impact |
|------|-------|------------|--------|
| Morning (11:06) | Connection refused | Backend not running | 100% outage |
| 13:46 | **403 Forbidden** | IP allowlist blocked production users | 100% outage |
| 14:02 | **500 Server Error** | Unknown - Gemini API failing | 100% outage |
| 14:07 | Claimed "resolved" | ❌ FALSE - Not actually fixed | - |
| 23:39 | **STILL 500 errors** | 🔴 BUG ACTIVE RIGHT NOW | 100% outage |

---

## 🔥 TOP 5 CRITICAL FIXES (Next 48h)

### 1️⃣ Startup Validation
**File:** `ad-server/startup-validator.js` (new)
**Goal:** App refuses to start if config is broken
```javascript
// Check: GEMINI_API_KEY, JWT_SECRET, NODE_ENV
// If missing → console.error() + process.exit(1)
```
**Test:** `unset GEMINI_API_KEY && npm start` → should FAIL

---

### 2️⃣ Smoke Tests in CI/CD
**File:** `cloudbuild.yaml` line ~94
**Goal:** Deployment fails if AI endpoint broken
```bash
curl POST /ghost-api/analyze | grep "answer" || exit 1
```
**Test:** Remove GEMINI_API_KEY → deployment should FAIL

---

### 3️⃣ Remove Local Filesystem
**File:** `ad-server/routes/ghost-api.js`
**Lines to fix:** 17 (hardcoded Windows path), 27 (usage_stats.json)
**Replace with:** Cloud Logging + Firestore
**Test:** No `fs.writeFileSync` or `fs.appendFileSync` in file

---

### 4️⃣ Critical Alerts
**Where:** Cloud Console → Monitoring → Alerting
**Create 3 alerts:**
- AI Service 503 (>5 in 5min) → PagerDuty
- High 500 rate (>10% in 15min) → Slack
- Invalid API key → Email SRE lead

---

### 5️⃣ Enhanced Secret Validation
**File:** `cloudbuild.yaml` line ~15
**Goal:** Verify secrets are not empty
```bash
SECRET_VALUE=$(gcloud secrets versions access...)
if [ -z "$SECRET_VALUE" ]; then exit 1; fi
```

---

## 🎯 SUCCESS CHECKLIST (Before You're Done)

### Startup Validation
- [ ] File created: `ad-server/startup-validator.js`
- [ ] Imported in `ad-server/index.js` before `app.listen()`
- [ ] Tested locally: app exits if key missing
- [ ] Tested locally: app starts if key present
- [ ] Deployed to staging and verified

### Smoke Tests
- [ ] Added to `cloudbuild.yaml` after health check
- [ ] Tested in staging: smoke test runs and passes
- [ ] Tested in staging: deployment fails if test fails
- [ ] Verified test runs in <30s

### Filesystem Migration
- [ ] Removed hardcoded log path (line 17)
- [ ] Replaced with `console.error()` structured logging
- [ ] Removed `usage_stats.json` logic (line 27)
- [ ] Replaced with Firestore
- [ ] Added `@google-cloud/firestore` dependency
- [ ] Tested: logs appear in Cloud Logging
- [ ] Tested: usage stats persist across restarts

### Alerting
- [ ] Alert 1 created: 503 errors
- [ ] Alert 2 created: 500 errors
- [ ] Alert 3 created: Invalid API key
- [ ] All alerts tested in staging
- [ ] Notification channels verified (Slack/email)

### Secret Validation
- [ ] Enhanced validation added to cloudbuild.yaml
- [ ] Tested: empty secret fails deployment
- [ ] Tested: valid secret passes deployment

---

## 🐛 DEBUGGING TIPS

### If startup validation is failing incorrectly...
```bash
# Check env vars are actually set
echo $GEMINI_API_KEY
echo $JWT_SECRET
echo $NODE_ENV

# Run validator directly
node -e "import('./ad-server/startup-validator.js').then(m => m.validateStartup())"
```

### If smoke test is failing...
```bash
# Test endpoint manually
curl -X POST https://your-service.run.app/ghost-api/analyze \
  -H "Content-Type: application/json" \
  -d '{"persona":"CRM_buyer_persona","steps":[{"url":"/test","note":"manual test"}]}'

# Check if it returns "answer" field
# If 503 → GEMINI_API_KEY not set
# If 500 → Check logs for error message
```

### If Cloud Logging isn't showing logs...
```bash
# Verify project ID
gcloud config get-value project

# Check logs manually
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Make sure console.error() is being called (add debug statements)
```

### If Firestore writes are failing...
```bash
# Check Firestore is enabled
gcloud services list --enabled | grep firestore

# Check permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID

# Try writing manually
gcloud firestore collections create test
```

---

## 📋 CODE SNIPPETS (Copy-Paste Ready)

### Startup Validator (Full Implementation)
```javascript
// ad-server/startup-validator.js
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function validateStartup() {
  const errors = [];

  // Required environment variables
  const required = ['GEMINI_API_KEY', 'JWT_SECRET', 'NODE_ENV'];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`${envVar} is required but not set`);
    }
  }

  // Test Gemini API connectivity
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      await model.generateContent('Hello'); // Quick test
      console.log('✅ Gemini API connectivity verified');
    } catch (err) {
      errors.push(`Gemini API validation failed: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('❌ STARTUP VALIDATION FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✅ All startup validations passed');
}
```

### Firestore Usage Stats (Replacement)
```javascript
// In ghost-api.js, replace incrementUsage() function
import { Firestore } from '@google-cloud/firestore';
const firestore = new Firestore({ projectId: 'softomedia-live-2026' });

const incrementUsage = async () => {
  const today = new Date().toISOString().split('T')[0];
  const statsRef = firestore.collection('usage_stats').doc(today);

  try {
    await statsRef.set({
      count: Firestore.FieldValue.increment(1),
      date: today,
      updated: Firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const doc = await statsRef.get();
    return doc.exists ? doc.data().count : 1;
  } catch (e) {
    console.error('[Ghost-AI] Failed to update usage stats:', e);
    return 0; // Fail gracefully
  }
};
```

### Cloud Logging (Replace logError)
```javascript
// In ghost-api.js, replace logError() function
const logError = (err) => {
  console.error('[Ghost-AI] Error:', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    type: err.constructor.name
  });
  // Cloud Logging automatically captures console.error()
};
```

---

## ⚡ KEYBOARD SHORTCUTS

### Testing locally
```bash
# Start server with env check
npm start

# Start without GEMINI_API_KEY (should fail)
env -u GEMINI_API_KEY npm start

# Run tests
npm test

# Check logs
gcloud logging read "resource.type=cloud_run_revision" --limit 10 --format json
```

### Deployment
```bash
# Deploy to staging
gcloud builds submit --config cloudbuild.yaml

# Check deployment status
gcloud run services describe ad-server --region us-central1

# Tail logs
gcloud logging tail "resource.type=cloud_run_revision" --format=json
```

---

## 🔗 QUICK LINKS

### Documentation
- [Executive Summary](EXECUTIVE_SUMMARY.md) - For leadership
- [Full Sprint Plan](SPRINT_PLAN_GEMINI_RECOVERY.md) - All 6 weeks
- [Critical Actions](CRITICAL_ACTIONS_IMMEDIATE.md) - Detailed implementation guide
- [Main README](README.md) - Overview & navigation

### Incident Reports
- [403 Error Report](../sre-reports/report-2026-01-25T144800-ghost-ai-incident.md)
- [500 Error Report](../sre-reports/report-2026-01-25T150500-ghost-ai-500.md)

### Code Files
- [ghost-api.js](../ad-server/routes/ghost-api.js) - Main implementation
- [ai-guardrails.js](../ad-server/services/ai-guardrails.js) - Middleware
- [cloudbuild.yaml](../cloudbuild.yaml) - Deployment config

### External Resources
- [Cloud Logging Docs](https://cloud.google.com/logging/docs)
- [Firestore Quickstart](https://cloud.google.com/firestore/docs/quickstart-servers)
- [Secret Manager Guide](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)

---

## 💬 COMMON QUESTIONS

**Q: Can I start these fixes now or wait for approval?**
A: The 48-hour critical actions can start immediately. They're low-risk fixes that prevent recurrence.

**Q: What if I find more issues during implementation?**
A: Document them in #engineering Slack, add to sprint backlog, don't let them block these 5 critical fixes.

**Q: How do I test Gemini API locally without using quota?**
A: Use mocks in unit tests. For integration testing, use staging environment (acceptable quota usage).

**Q: What if the startup validation makes local dev harder?**
A: Add a `.env.example` file with test values. Devs can copy to `.env` for local work.

**Q: Should I fix other issues I notice in the code?**
A: Only if they're blocking these 5 fixes. Otherwise, create tickets for later sprints.

---

## 📞 HELP & ESCALATION

### Stuck? Try This (In Order)
1. **Check this reference card** - Common solutions above
2. **Search Slack** - Someone may have hit the same issue
3. **Ask in #engineering** - Team can help
4. **Tag relevant lead** - Backend Lead, SRE Manager
5. **Escalate to Tech Lead** - If truly blocked

### Emergency Contacts
- **Production down?** → Follow on-call procedures (not this plan)
- **Can't deploy?** → SRE Manager
- **Cloud permissions?** → DevOps team
- **Code questions?** → Backend Lead

---

**Remember: Done is better than perfect. Ship these 5 fixes, then iterate in the sprints!**

*Last updated: 2026-01-25*