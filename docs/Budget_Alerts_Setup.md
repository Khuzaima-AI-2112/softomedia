# Budget Alerts Setup Guide

**Project**: softomedia-live2026  
**Billing Account**: 015B81-E00AF4-9480BF

## Quick Setup (Cloud Console - Recommended)

### Step 1: Open Budget Alerts Page
Click here: [Create Budget for softomedia-live2026](https://console.cloud.google.com/billing/015B81-E00AF4-9480BF/budgets?project=softomedia-live2026)

### Step 2: Create 4 Budgets

#### Budget 1: Alert at $5
- **Name**: "Alert at $5"
- **Budget Type**: Specified amount
- **Amount**: $5 USD
- **Threshold**: 100%
- **Email notifications**: ✅ Enabled (your billing account email)

#### Budget 2: Alert at $10
- **Name**: "Alert at $10"
- **Budget Type**: Specified amount
- **Amount**: $10 USD
- **Threshold**: 100%
- **Email notifications**: ✅ Enabled

#### Budget 3: Alert at $15
- **Name**: "Alert at $15"
- **Budget Type**: Specified amount
- **Amount**: $15 USD
- **Threshold**: 100%
- **Email notifications**: ✅ Enabled

#### Budget 4: Alert at $20
- **Name**: "Alert at $20"
- **Budget Type**: Specified amount
- **Amount**: $20 USD
- **Threshold**: 100%
- **Email notifications**: ✅ Enabled

---

## What You'll Receive

When your monthly spend reaches each threshold, you'll receive an email:

**Subject**: "Budget alert for 'Alert at $5' in billing account My Billing Account"

**Email will include**:
- Current spend amount
- Budget limit ($5, $10, $15, or $20)
- Percentage of budget used
- Link to view detailed billing

---

## Expected Costs Based on Current Usage

| Month | Expected Cost | Alerts Triggered |
|-------|---------------|------------------|
| **MVP (Current)** | ~$22 | All 4 alerts |
| **10 Screens** | ~$35 | All 4 alerts |
| **100 Screens** | ~$130 | All 4 alerts |

**Note**: With current MVP usage (~$22/month), you'll receive 4 email alerts throughout the month as costs cross each threshold.

---

## Alternative: Command Line Setup (Complex)

If you prefer gcloud CLI:

```bash
# Enable API
gcloud services enable billingbudgets.googleapis.com --project=softomedia-live2026

# Create budgets (one at a time)
gcloud billing budgets create \
  --billing-account=015B81-E00AF4-9480BF \
  --display-name="Alert at $5" \
  --budget-amount=5 \
  --threshold-rule=percent=1.0

# Repeat for $10, $15, $20
```

**Issue**: CLI doesn't easily support email notifications - must configure via Console.

---

## Recommendation

✅ **Use Cloud Console** (5 minutes total)  
❌ Avoid CLI for budget alerts (email config is complex)

Current billing account has full email notification support enabled automatically via Console.
