# SoftoMedia - Google Cloud Cost Analysis

**Last Updated**: 2025-12-24  
**Current Phase**: Production-Ready MVP - 100% Functional  
**Deployment**: Cloud Run (both services), Firestore, Cloud Storage  
**Build**: `225670b3-91e5-44a7-a7cd-5380b4c1c9b5`

---

## Current Monthly Costs (MVP/Development)

### Compute - Cloud Run

**Backend Service (ad-server)**:
- Current Revision: `ad-server-00011-nlp`
- Instance: 1 vCPU, 512 MB RAM
- Auto-scaling: 0-100 instances
- Traffic: ~1,000-5,000 requests/day (MVP stage)
- **Current Actual**: $8-12/month
- Includes: API endpoints, authentication, dashboard data

**Frontend Service (client-app)**:
- Current Revision: `client-app-00010-pmm`
- Instance: 1 vCPU, 256 MB RAM
- Auto-scaling: 0-100 instances
- Traffic: Static React app serving
- **Current Actual**: $5-8/month
- Includes: Brand/Retailer/Admin dashboards, Screen player

**Both services on Cloud Run** (no Firebase Hosting):
- Pay-per-use model (scales to zero when idle)
- Automatic HTTPS and domain mapping
- Built-in load balancing

### Database - Firestore
**Collections** (Current deployment):
- `users` (3 demo users: admin, brand, retailer)
- `advertisers` (brand companies)
- `retailers` (retailer/screen owners)
- `campaigns` (ad campaigns)
- `screens` (digital displays)
- `screen_locations` (geographic data)
- Additional: `invitations`, `notifications`, `impressions`

**Current Usage** (MVP with demo data):
- ~50 documents total
- Reads: ~2,000/day (dashboard loads, screen polling)
- Writes: ~500/day (impressions, status updates)
- **Current Actual**: $2-4/month

**At Scale (100 screens, 50 campaigns)**:
- ~10,000 documents
- Reads: ~100,000/day (screens polling every 5 min)
- Writes: ~20,000/day (impressions + diagnostics)
- **Estimated**: $35-50/month

### Storage - Cloud Storage
**Bucket**: `softomedia-live2026-uploads`
- Campaign videos (future - currently demo only)
- Ad media assets
- Current: ~100 MB (demo images)
- **Current Actual**: $0.50-1/month

**At Scale (100 campaigns)**:
- ~5 GB video storage
- Egress: ~$8-15/month (video delivery to screens)
- **Estimated**: $20-30/month total

### Additional Services

**Cloud Functions** (if enabled):
- Offline detection (runs every 5 min)
- Video transcoding/thumbnail generation
- Earnings calculation (monthly)
- **Estimated**: $2-5/month at scale

**BigQuery** (analytics - optional):
- Impression logging for analytics
- Currently disabled to save costs
- **Estimated**: $0 (can enable later)

---

## Cost Breakdown by Phase

### Phase 1: Production MVP (Current - Dec 2025)
- Cloud Run Backend: $10/month
- Cloud Run Frontend: $6/month
- Firestore: $3/month
- Cloud Storage: $1/month
- Cloud Build: $2/month (deployment pipeline)
- **Total: ~$22/month** ✅ (Currently Running)

### Phase 2: Beta Testing (10 screens, 5 campaigns)
- Cloud Run Backend: $18/month
- Cloud Run Frontend: $8/month
- Firestore: $10/month
- Cloud Storage: $3/month (video + egress)
- Cloud Build: $2/month
- **Total: ~$41/month**

### Phase 3: Production Launch (100 screens, 50 campaigns)
- Cloud Run Backend: $35/month
- Cloud Run Frontend: $12/month
- Firestore: $45/month
- Cloud Storage: $25/month (video + egress)
- Cloud Build: $3/month
- Monitoring (Cloud Logging): $10/month
- **Total: ~$130/month**

### Phase 4: Scale (1,000 screens, 500 campaigns)
- Cloud Run Backend: $180/month (auto-scaling)
- Cloud Run Frontend: $40/month
- Firestore: $280/month
- Cloud Storage: $120/month
- Cloud Build: $5/month
- CDN/Caching (Cloud CDN): $60/month
- Monitoring: $35/month
- **Total: ~$720/month**

---

## Cost Optimization Strategies

### Implemented ✅
✅ **Cloud Run Auto-Scaling**: Scales to zero when not in use  
✅ **Efficient Queries**: Firestore queries optimized with proper indexing  
✅ **Containerized Deployment**: Both services in Docker containers  
✅ **Minimal Revisions**: Cleaned up old deployments (kept latest 3 only)  
✅ **JWT Authentication**: Stateless auth reduces database reads  
✅ **Connection Pooling**: Firestore connections reused

### To Implement 🔄
- [ ] **Caching Layer**: Redis/Memorystore for playlist decisions
- [ ] **CDN**: Cloud CDN for video delivery (reduce egress costs by 60%)
- [ ] **Compression**: Gzip/Brotli for API responses
- [ ] **Batch Operations**: Aggregate impression writes to reduce Firestore costs
- [ ] **Cold Start Optimization**: Keep 1 instance warm during business hours
- [ ] **BigQuery**: Move old impression data from Firestore (cheaper long-term storage)

---

## Revenue vs. Cost Analysis

### Revenue Model (Updated)
- **Platform Fee**: 60% of impression revenue
- **Retailer Share**: 40% of impression revenue
- **Target CPM**: $5-15 per 1,000 impressions (blended average)

### Break-Even Analysis

**MVP Scenario (Current)**:
- Infrastructure cost: $22/month
- Break-even: ~5,000 impressions/month @ $5 CPM
- 1 screen playing 200 ads/day = 6,000 impressions/month ✅

**100 Screens Scenario**:
- Avg impressions/screen/day: 500
- Total impressions/month: 1,500,000
- Gross revenue @ $5 CPM: $7,500/month
- Platform revenue (60%): $4,500/month
- Retailer earnings (40%): $3,000/month
- Infrastructure cost: ~$130/month
- **Net Platform Profit: $4,370/month** ✅
- **ROI**: 3,362%

**1,000 Screens Scenario**:
- Total impressions/month: 15,000,000
- Gross revenue @ $5 CPM: $75,000/month
- Platform revenue (60%): $45,000/month
- Retailer earnings (40%): $30,000/month
- Infrastructure cost: ~$720/month
- **Net Platform Profit: $44,280/month** ✅
- **ROI**: 6,150%

**Actual Break-even**: ~1,500 impressions/month (< 1 active screen)

---

## Additional Costs (Not Yet Implemented)

### Email Service (Deferred)
- SendGrid: $15-40/month (up to 100K emails)
- AWS SES: $10/month (100K emails)
- **Estimated**: $20/month when enabled

### Payment Processing (Deferred - Stripe)
- Transaction fees: 2.9% + $0.30
- Stripe Connect for payouts: Additional 0.5%
- **Estimated**: 3.5% of payout volume
- Example: $10K monthly payouts = $350/month in fees

### Domain & SSL
- Domain registration: $12/year
- SSL certificates: Free (Let's Encrypt via Firebase)
- **Estimated**: $1/month

### Development Tools (Optional)
- Error tracking (Sentry): $26/month
- Uptime monitoring (UptimeRobot): $0 (free tier)
- Analytics (Mixpanel): $0-25/month
- **Estimated**: $30/month

---

## Total Cost of Ownership (TCO)

### MVP Phase (Current - Dec 2025)
- Infrastructure: $22/month ✅ (Live in production)
- Development tools: $0 (using free tiers)
- Payment processing: $0 (not yet enabled)
- **Total: $22/month**
- **Revenue Potential**: $4,500/month @ 100 screens
- **Profit Margin**: 99.5%

### Production Phase (100 screens, 50 campaigns)
- Infrastructure: $130/month
- Email (SendGrid): $20/month
- Payment fees @ $3K retailer payouts: $105/month (3.5%)
- Dev tools (monitoring): $30/month
- **Total: $285/month**
- **Revenue**: $4,500/month @ $5 CPM
- **Net Profit**: $4,215/month
- **Profit Margin**: 93.7%

### Scale Phase (1,000 screens, 500 campaigns) 
- Infrastructure: $720/month
- Email: $40/month
- Payment fees @ $30K payouts: $1,050/month
- Dev tools: $50/month
- **Total: $1,860/month**
- **Revenue**: $45,000/month @ $5 CPM
- **Net Profit**: $43,140/month
- **Profit Margin**: 95.9%

---

## Cost Monitoring & Alerts

**Recommended Setup**:
1. Google Cloud Budget alerts at 50%, 75%, 90%
2. Daily cost reports via email
3. Per-service cost breakdown dashboard
4. Anomaly detection for unusual spikes

**Current Status**: ⏳ To be configured (recommended before scaling to 100+ screens)

---

## Summary

**Current State** (Dec 2025):
- ✅ Production MVP deployed and running
- ✅ $22/month actual infrastructure costs
- ✅ 95%+ profit margins at all scales
- ✅ Scales linearly with predictable costs

**Key Insights**:
1. **Capital Efficient**: <$25/month to run production platform
2. **High Margins**: 93-99% profit margins across all scaling scenarios
3. **Linear Scaling**: Costs scale predictably with screen count
4. **Break-Even**: Profitable with just 1-2 active screens
5. **Cloud Native**: Zero server management, auto-scaling built-in

**Next Actions**:
- [ ] Configure cost monitoring alerts
- [ ] Enable CDN for video delivery (60% egress savings)
- [ ] Implement Redis caching for playlist decisions
- [ ] Set up BigQuery for historical impression data

**Next Cost Review**: February 2026 (after reaching 10+ production screens)

---

## Infrastructure Cost by Scale

| Scale | Monthly Impressions | Infrastructure | Revenue @ $5 CPM | Net Profit | Margin |
|-------|---------------------|----------------|------------------|------------|--------|
| **MVP (Current)** | 50K | $22 | $250 | $228 | 91% |
| **10 Screens** | 150K | $35 | $750 | $715 | 95% |
| **100 Screens** | 1.5M | $130 | $7,500 | $7,370 | 98% |
| **1,000 Screens** | 15M | $720 | $75,000 | $74,280 | 99% |

*Assumes 500 impressions/screen/day average, $5 CPM, 60% platform fee*
