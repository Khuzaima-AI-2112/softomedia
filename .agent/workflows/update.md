---
description: Update all project documentation to reflect current system state (STREAMLINED)
---

# Complete Documentation Update Workflow

**Documentation Structure**: 13 files (3 root + 10 docs)  
**Last Consolidation**: December 24, 2025

---

## Quick Reference: What to Update

### 🔴 Always Update (Every Deploy)
1. **WHATS_AVAILABLE.md** - Build ID, timestamp, status, latest features
2. **DEPLOY_GUIDE.md** - Build ID, deploy timestamp
3. **TEST_ACCESS.md** - Build ID in status line

### 🟡 Update When Changed
4. **Business_Overview.md** - Metrics, costs, projections (monthly)
5. **Cost_Analysis.md** - Actual costs, build ID (when costs change)
6. **Development_Roadmap.md** - Mark completed items, add new tasks

### 🟢 Update Occasionally  
7. **Quick_Test_Guide.md** - Test scenarios (when features change)
8. **Technical_Architecture.md** - Architecture changes only
9. **INTEGRATION_GUIDE.md** - New API endpoints only

### 📋 Reference Only (Rarely Change)
10. **Admin_User_Guide.md** - Admin workflow changes
11. **Budget_Alerts_Setup.md** - One-time setup guide
12. **Implementation_History.md** - Historical record
13. **PROJECT_RULES.md** - Deployment rules
14. **functional-gap-analysis.md** - Strategic planning reviews
15. **SoftoMediaLive_Complete_Specifications.md** - Master reference
16. **CONSOLIDATION_PLAN.md** - One-time consolidation record

---

## Standard Update Procedure

### Step 1: Get Current System State
```powershell
# Get current build info
gcloud run services describe ad-server --region=us-central1 --format="value(status.latestReadyRevisionName)" --project=softomedia-live-2

gcloud run services describe client-app --region=us-central1 --format="value(status.latestReadyRevisionName)" --project=softomedia-live-2

# Get current timestamp
Get-Date -Format "yyyy-MM-dd HH:mm 'EST'"
```

### Step 2: Update Core Files (3 files - 5 minutes)

#### WHATS_AVAILABLE.md
- Line 3: Last Updated timestamp
- Line 5: Build ID
- Lines 104-115: Latest features section
- Line 277: Final status banner

#### DEPLOY_GUIDE.md (if exists, else DEPLOYMENT_README.md)
- Lines 3-5: Build ID, status, deploy timestamp

#### TEST_ACCESS.md
- Line 25: Build ID in status

### Step 3: Update Cost/Business Docs (Monthly)

#### Cost_Analysis.md
- Lines 3-6: Header with build ID and timestamp
- Current costs in Phase 1 section
- Verify all dollar amounts reflect reality

#### Business_Overview.md
- Build ID reference
- Current metrics (screens, revenue)
- Update projections if significant changes

### Step 4: Update Development Roadmap (Weekly)

#### Development_Roadmap.md
- Mark completed items with `[x]`
- Add new tasks discovered
- Update timeline estimates
- Remove obsolete items

### Step 5: Verify Consistency

Run these checks:
```powershell
# Search for old build IDs
Select-String -Path "*.md","docs/*.md" -Pattern "5625cd63" -List

# Search for old timestamps
Select-String -Path "*.md","docs/*.md" -Pattern "December 23" -List

# Verify URLs are current
Select-String -Path "*.md","docs/*.md" -Pattern "ad-server.*run.app" -List
```

---

## What NOT to Update

❌ **Implementation_History.md** - Historical record, don't change  
❌ **CONSOLIDATION_PLAN.md** - One-time plan, archive  
❌ **SoftoMediaLive_Complete_Specifications.md** - Only for major arch changes

---

## Quick Update Commands

### After Every Deployment
```powershell
# 1. Get build ID
$BUILD_ID = (gcloud run services describe ad-server --region=us-central1 --format="value(metadata.labels.commit-sha)" --project=softomedia-live-2)

# 2. Get timestamp  
$TIMESTAMP = Get-Date -Format "MMMM dd, yyyy - HH:mm 'EST'"

# 3. Update files (do manually or use find-replace)
# - WHATS_AVAILABLE.md
# - DEPLOY_GUIDE.md  
# - TEST_ACCESS.md
```

### Monthly Review
```powershell
# Review costs
gcloud billing accounts get-spend-by-project --billing-account=015B81-E00AF4-9480BF

# Update Cost_Analysis.md and Business_Overview.md
```

---

## File Organization Reference

```
Root (3 files)
├── WHATS_AVAILABLE.md          # System status dashboard
├── DEPLOY_GUIDE.md             # Deployment reference
└── TEST_ACCESS.md              # Test credentials

Docs (13 files)
├── Admin_User_Guide.md         # Admin workflows
├── Budget_Alerts_Setup.md      # Billing setup
├── Business_Overview.md        # Business model
├── CONSOLIDATION_PLAN.md       # Consolidation record
├── Cost_Analysis.md            # Infrastructure costs
├── Development_Roadmap.md      # Future development
├── functional-gap-analysis.md  # Feature gaps
├── Implementation_History.md   # Build history
├── INTEGRATION_GUIDE.md        # API docs
├── PROJECT_RULES.md            # Deployment rules
├── Quick_Test_Guide.md         # Testing guide
├── SoftoMediaLive_Complete_Specifications.md  # Master spec
└── Technical_Architecture.md   # Architecture
```

---

## Completion Checklist

After updates, verify:
- [ ] All build IDs match current production
- [ ] All timestamps are current
- [ ] All URLs point to softomedia-live-2 services
- [ ] Cost figures reflect actual usage
- [ ] No broken internal links
- [ ] No "TBD" or placeholders

---

**Time Estimate**:
- Quick update (deploy): 5 minutes
- Full update (monthly): 30 minutes
- Major update (quarterly): 2 hours
