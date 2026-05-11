# SoftoMedia - TODO List

## 🔴 Deferred Technical Decisions

### Email Provider Selection
**Status**: Decision deferred
**Options**:
- SendGrid (easier setup, good templates)
- AWS SES (cheaper at scale, requires more config)
- Mailgun (middle ground)

**Required For**:
- User invitation emails (State 17)
- Password reset flow
- Campaign notifications
- Payment receipts

**Decision Deadline**: Before Phase 1 completion

---

### Payment Integration
**Status**: Decision deferred
**Primary Option**: Stripe Connect
**Use Cases**:
- Retailer monthly payouts
- Brand campaign billing
- Transaction fees (platform revenue)

**Research Needed**:
- Stripe Connect vs. Stripe Payments
- International payment support
- ACH vs. Wire transfer options
- Fee structure (2.9% + $0.30 standard?)

**Decision Deadline**: Before retailer earnings feature (Phase 3)

---

## 🎬 Missing User Journey States

### States 1-4: Screen Player Experience (10-foot UI)
**Priority**: Medium (not blocking dashboard work)

#### State 1: The Pairing Flow
- [ ] Create pairing QR code generation
- [ ] Build pairing confirmation UI (mobile)
- [ ] Implement device linking backend
- [ ] Design pairing success animation

#### State 2: The "Attract Loop" (Idle State)
- [ ] Create screensaver/attract loop design
- [ ] Build branded idle animation
- [ ] Implement motion graphics (breathing gradient)
- [ ] Add "Powered by SoftoMedia" branding

#### State 3: The "Playing" State
- [ ] Build fullscreen ad player (1080p)
- [ ] Implement smooth ad transitions
- [ ] Add progress bar/timer overlay
- [ ] Create fade-in/fade-out animations
- [ ] Test video playback performance

#### State 4: The "Offline" State
- [ ] Design connection lost screen
- [ ] Add reconnection logic
- [ ] Build retry countdown UI
- [ ] Create diagnostic overlay for troubleshooting

**Tech Stack (10-foot UI)**:
- Deep Obsidian background `#111827`
- Midnight Blue gradients
- High contrast white text
- Breathing animation (already in design tokens)

---

### State 11: The "Create Campaign" Wizard
**Priority**: High (needed for State 8 enhancement)

- [ ] Multi-step form UI (upload → details → targeting → review)
- [ ] Drag-and-drop video upload with preview
- [ ] Screen selection interface (map + list)
- [ ] Budget allocation calculator
- [ ] Campaign scheduler (start/end dates)
- [ ] Credit card payment integration (pending Stripe decision)

---

### State 13: The "Campaign Adjustment" Interface
**Priority**: Medium

- [ ] Pause/resume campaign controls
- [ ] Budget adjustment slider
- [ ] Screen targeting editor
- [ ] Real-time spend tracker
- [ ] Alert threshold settings

---

### State 15: The Admin "Configuration" Panel
**Priority**: Low (admin-only features)

- [ ] Platform settings (fees, rates, limits)
- [ ] Email template editor
- [ ] System health dashboard
- [ ] User role management
- [ ] API key generation

---

### State 16: The Retailer "Earnings Detail" View
**Priority**: Medium (extends State 10)

- [ ] Monthly earnings breakdown
- [ ] Payment history table
- [ ] Tax document downloads (1099 forms)
- [ ] Payout method settings (bank account)
- [ ] Earnings projection calculator

---

### State 19: The "Onboarding" Sequence
**Priority**: High (improves UX)

- [ ] Welcome tour for new users
- [ ] Interactive tutorial overlays
- [ ] Progress checklist (pair screen, upload ad, etc.)
- [ ] Video walkthrough embeds
- [ ] Skip/dismiss functionality

---

## 🔧 Backend Implementation Roadmap

### Phase 1: Foundation (Week 1) - IN PROGRESS
**Decisions Confirmed**:
- ✅ Real-time alerts: Firebase Cloud Messaging (FCM)
- ✅ Video processing: Cloud Functions

**Tasks**:
- [ ] Enhance `users` collection schema
- [ ] Create `retailers` collection
- [ ] Create `brands` collection
- [ ] Create `invitations` collection
- [ ] Implement `POST /api/users/invite` endpoint
- [ ] Implement `POST /api/users/accept-invitation` endpoint
- [ ] Add `requireRole()` middleware
- [ ] Add `requireOwnership()` middleware
- [ ] Update Firestore security rules
- [ ] Test invitation email flow (placeholder until email provider chosen)

---

### Phase 2: Campaign System (Week 2)
- [ ] Implement `POST /api/campaigns/create` with video upload
- [ ] Set up Cloud Function for video transcoding
- [ ] Generate thumbnails from video first frame
- [ ] Create `GET /api/campaigns` with filtering
- [ ] Create `PUT /api/campaigns/:id` for updates
- [ ] Create `DELETE /api/campaigns/:id`
- [ ] Implement campaign-to-screen assignment logic
- [ ] Add campaign approval workflow (admin review)

---

### Phase 3: Dashboard APIs (Week 3)
- [ ] Implement `GET /api/dashboard/brand/:brand_id`
- [ ] Implement `GET /api/dashboard/retailer/:retailer_id`
- [ ] Implement `GET /api/screens/management` (with filters)
- [ ] Implement `GET /api/campaigns/:id/report` (State 12 data)
- [ ] Create earnings calculation Cloud Function
- [ ] Build screen location mapping endpoint
- [ ] Add performance aggregation logic
- [ ] Create heatmap data generator

---

### Phase 4: Real-Time & Polish (Week 4)
- [ ] Set up Firebase Cloud Messaging (FCM)
- [ ] Create offline detection Cloud Function (runs every 5 min)
- [ ] Implement `GET /api/screens/:screenId/diagnostics`
- [ ] Add WebSocket endpoint for live dashboard updates (optional)
- [ ] Build notification preferences API
- [ ] Add rate limiting (express-rate-limit)
- [ ] Implement API request logging
- [ ] Performance optimization (caching, indexes)

---

## 🎨 UI/UX Polish Tasks

### Design System Enhancements
- [ ] Add Modal component (centered overlay)
- [ ] Add BreathingGradient component (animated background)
- [ ] Add ToastNotification improvements (stacking, queue)
- [ ] Create LoadingSpinner component
- [ ] Add Tooltip component
- [ ] Build Dropdown/Select component
- [ ] Create DatePicker component (for campaigns)

### Accessibility
- [ ] Add ARIA labels to all interactive elements
- [ ] Keyboard navigation support
- [ ] Screen reader testing
- [ ] Color contrast validation (WCAG AA)
- [ ] Focus indicators on all buttons/inputs

### Responsive Design
- [ ] Test all dashboards on mobile (320px - 768px)
- [ ] Test tablet views (768px - 1024px)
- [ ] Optimize touch targets for mobile (min 44x44px)
- [ ] Add mobile navigation drawer
- [ ] Test player UI on various screen sizes

### Animations
- [ ] Add page transition animations
- [ ] Improve loading states (skeleton screens)
- [ ] Polish button hover effects
- [ ] Add micro-interactions on status changes
- [ ] Optimize animation performance (60fps)

---

## 🚀 Performance & Cost Optimization

### Video/Image Caching (CRITICAL - Reduces Costs by 95%)
**Priority**: High (should be done before production deployment)

**Problem**: 
- Videos re-download every time signed URLs expire
- 100 screens = ~$450/month in unnecessary egress costs
- Images also re-downloaded frequently

**Solution Options**:

#### Option 1: Service Worker Caching (Recommended for Player)
- [ ] Create Service Worker for player app
- [ ] Implement Cache API for video files
- [ ] Set cache duration to 24-48 hours
- [ ] Handle cache invalidation when playlist changes
- [ ] Test cache performance on actual screens

**Implementation**:
```javascript
// client-app/public/sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/video/') || 
      event.request.url.includes('.mp4') ||
      event.request.url.includes('.png')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          return caches.open('media-v1').then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
```

**Cost Impact**: $450/month → $23/month (95% reduction)

#### Option 2: Cloud CDN (Recommended for Scale)
- [ ] Enable Cloud CDN for video bucket
- [ ] Configure cache headers (Cache-Control: max-age=86400)
- [ ] Test CDN performance from various locations
- [ ] Monitor CDN hit rate

**Cost Impact**: $450/month → $5-10/month (98% reduction)

#### Option 3: Hybrid Approach (Best of Both)
- [ ] Cloud CDN for initial caching at edge
- [ ] Service Worker for local browser caching
- [ ] Combined approach = maximum efficiency

**Decision Deadline**: Before 100 screens deployed

---

## 📊 Analytics & Monitoring


### Implementation
- [ ] Set up Google Analytics 4
- [ ] Add custom event tracking (button clicks, page views)
- [ ] Implement error tracking (Sentry)
- [ ] Create dashboard for key metrics
- [ ] Set up uptime monitoring (UptimeRobot or Pingdom)
- [ ] Configure alerts for critical errors

### Key Metrics to Track
- [ ] User sign-ups by role (retailer/brand/admin)
- [ ] Campaign creation rate
- [ ] Screen registration rate
- [ ] Ad impressions per day
- [ ] Average session duration
- [ ] Bounce rate by page
- [ ] API error rates

---

## 🧪 Testing

### Unit Tests
- [ ] API endpoint tests (Jest/Mocha)
- [ ] React component tests (React Testing Library)
- [ ] Utility function tests
- [ ] Authentication middleware tests

### Integration Tests
- [ ] End-to-end user flows (Playwright/Cypress)
- [ ] Campaign creation flow
- [ ] User invitation flow
- [ ] Screen pairing flow
- [ ] Payment processing (test mode)

### Performance Tests
- [ ] Load testing (Artillery/k6)
- [ ] Database query optimization
- [ ] Frontend bundle size analysis
- [ ] Lighthouse score > 90

---

## 🚀 Production Deployment

### Pre-Launch Checklist
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] Firestore indexes created
- [ ] Cloud Storage CORS configured
- [ ] IAM roles and permissions set
- [ ] Backup strategy implemented
- [ ] Error monitoring active
- [ ] Load balancer configured

### Security Hardening
- [ ] Rate limiting on all endpoints
- [ ] SQL injection prevention (N/A - using Firestore)
- [ ] XSS protection headers
- [ ] CSRF tokens on forms
- [ ] Content Security Policy (CSP)
- [ ] Regular dependency updates
- [ ] Penetration testing

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guides for each role
- [ ] Admin troubleshooting guide
- [ ] Developer onboarding docs
- [ ] Incident response playbook

---

## 💰 Business & Legal

### Deferred Until Payment Integration
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Advertiser Agreement
- [ ] Retailer Agreement
- [ ] GDPR compliance review
- [ ] Tax reporting setup (1099 generation)
- [ ] Refund policy

### Marketing Site
- [ ] Landing page (softomedia.com)
- [ ] Pricing page
- [ ] Case studies / testimonials
- [ ] Demo video
- [ ] Blog setup
- [ ] SEO optimization

---

## 📅 Timeline Summary

**Current Status**: Projects 1, 2, 3 complete (frontend)

**Next 4 Weeks**:
- Week 1: Backend Phase 1 (user management)
- Week 2: Backend Phase 2 (campaigns)
- Week 3: Backend Phase 3 (dashboards)
- Week 4: Backend Phase 4 (real-time)

**Weeks 5-8** (after backend complete):
- States 1-4 (player UI)
- States 11, 13, 15, 16, 19 (missing workflows)
- Testing & polish
- Production deployment

**Deferred to Post-Launch**:
- Email provider selection → implement during Week 1
- Payment integration → implement during Week 5-6
- Full marketing site → post-MVP

---

## 🎯 Current Sprint Focus

**This Week**:
1. ✅ Complete Projects 1-3 frontend
2. ✅ Create backend architecture plan
3. 🔄 Begin Phase 1 backend implementation
4. ⏳ Set up FCM for real-time alerts

**Next Week**:
- Campaign video upload system
- Cloud Function video transcoding
- Campaign management endpoints

---

## 📝 Notes

- All "deferred decisions" should be revisited before their respective phases
- States 1-4 can be built in parallel with backend work by different developer
- Email provider needed by end of Week 1 to test invitation flow
- Payment integration can wait until retailer earnings feature (Week 5+)
- Prioritize backend completion before new frontend states

---

**Last Updated**: 2025-12-23
**Status**: Backend architecture plan approved, Phase 1 ready to start
