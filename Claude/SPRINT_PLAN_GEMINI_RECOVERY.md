# Sprint Plan: Gemini API Stabilization & Hardening
**Created:** 2026-01-25
**Status:** ⚠️ **ON HOLD - Bug Still Active (23:39)** - Must fix current outage first
**Team:** SRE + Backend + QA
**Duration:** 3 Sprints (6 weeks) - starts AFTER bug is resolved

---

## 🚨 STOP: FIX THE ACTIVE BUG FIRST

**This sprint plan is for prevention AFTER we fix the current 12+ hour outage.**

As of 23:39, the feature is **STILL returning 500 errors**. The "resolution" claimed at 14:07 was FALSE.

**Before starting Sprint 1, you MUST:**
1. ✅ Check production Cloud Run logs for actual Gemini API error
2. ✅ Identify root cause (API key invalid/missing, quota, permissions, etc.)
3. ✅ Deploy the actual fix
4. ✅ Verify feature works in production (user testing)
5. ✅ Monitor for 1 hour with no errors

**See:** [CRITICAL_ACTIONS_IMMEDIATE.md](CRITICAL_ACTIONS_IMMEDIATE.md) for emergency debug steps.

**DO NOT start this sprint plan until the feature is actually working.**

---

## 🎯 OVERALL OBJECTIVES

1. **Eliminate Root Causes** of today's production incidents
2. **Implement Defense-in-Depth** for AI service reliability
3. **Establish Monitoring & Alerting** to detect failures before users do
4. **Prevent Similar Incidents** across all external API integrations

---

## 📊 INCIDENT ROOT CAUSE SUMMARY

### Primary Root Causes (Must Fix)
1. ❌ **Environment Parity Failure**: Dev-only security controls deployed to production
2. ❌ **Configuration Drift**: Secrets not validated in deployment pipeline
3. ❌ **Missing Smoke Tests**: AI endpoints not included in health checks
4. ❌ **Startup Blindness**: App starts "successfully" with broken dependencies
5. ❌ **Local Filesystem Assumptions**: Non-cloud-native patterns (local logs, files)

### Contributing Factors
- No AI-specific alerting or dashboards
- Manual secret management process
- Incomplete test coverage (unit tests exist, E2E tests missing)
- No cost/quota monitoring for Gemini API

---

## 🏃 SPRINT 1: CRITICAL FIXES & IMMEDIATE HARDENING (Week 1-2)

**Goal:** Make the system production-grade and prevent recurrence of today's incidents

### Epic 1.1: Startup Validation & Fast-Fail
**Priority:** P0 (Critical)
**Owner:** Backend Lead

#### Story 1.1.1: Implement Startup Health Checks
**As a** SRE team member
**I want** the application to fail fast at startup if critical dependencies are missing
**So that** we never deploy a broken service that appears healthy

**Tasks:**
- [ ] Create `ad-server/startup-validator.js` module
  - Check `GEMINI_API_KEY` presence and format (starts with expected prefix)
  - Check `JWT_SECRET` presence and minimum length
  - Check `NODE_ENV` is set
  - Verify GCS bucket accessibility
  - Test Gemini API connectivity with sample request
- [ ] Integrate into `ad-server/index.js` before server starts listening
- [ ] Add timeout (30s) for startup checks
- [ ] Exit with code 1 and descriptive error if validation fails
- [ ] Add startup validation logs to Cloud Logging

**Acceptance Criteria:**
```javascript
// If GEMINI_API_KEY is missing in production:
✓ App logs: "FATAL: GEMINI_API_KEY required in production"
✓ App exits with code 1 (Cloud Run shows deployment failed)
✓ Health check endpoint returns 503 until validation passes
✓ Startup completes in <30s with all dependencies healthy
```

**Test Plan:**
- Unit test: startup-validator.js with missing/invalid secrets
- Integration test: Deploy to staging without GEMINI_API_KEY (should fail)
- Integration test: Deploy with valid config (should succeed)

---

#### Story 1.1.2: Environment-Aware Configuration
**As a** developer
**I want** configuration to automatically adapt to dev/staging/production
**So that** dev-only controls never leak into production

**Tasks:**
- [ ] Create `ad-server/config/environment.js`
  - Export validated config object based on `NODE_ENV`
  - Throw errors for missing required vars per environment
  - Document all environment variables in README
- [ ] Refactor `ai-guardrails.js` to use environment config
  - Remove any hardcoded IP checks
  - Apply rate limits per environment (dev: 1000/day, prod: 100/day)
- [ ] Add config validation to startup checks
- [ ] Create `.env.example` files for all environments

**Acceptance Criteria:**
```javascript
✓ Development: No IP restrictions, verbose logging, high rate limits
✓ Production: Rate limiting enabled, minimal logging, production timeouts
✓ Staging: Production-like config with relaxed rate limits for testing
✓ App refuses to start with ambiguous/missing NODE_ENV
```

---

### Epic 1.2: Cloud-Native Refactoring
**Priority:** P0 (Critical)
**Owner:** Backend Team

#### Story 1.2.1: Remove Local Filesystem Dependencies
**As a** SRE
**I want** all persistent data stored in cloud services
**So that** containers can restart/scale without data loss

**Tasks:**
- [ ] Replace local debug logging with Cloud Logging
  - Remove hardcoded path: `C:\Users\ChrisFro\.gemini\...` (ghost-api.js:17)
  - Use `@google-cloud/logging` SDK
  - Add structured logging with trace IDs
- [ ] Migrate usage stats to Firestore
  - Create `usage_stats` collection
  - Schema: `{ date: string, count: number, requests: array }`
  - Add transaction support for concurrent increments
- [ ] Remove `fs.writeFileSync` / `fs.appendFileSync` calls
- [ ] Update tests to mock Cloud Logging/Firestore

**Acceptance Criteria:**
```
✓ No fs.writeFileSync or fs.appendFileSync in ghost-api.js
✓ All logs visible in Cloud Logging with structured fields
✓ Usage stats persist across container restarts
✓ Usage stats correct under concurrent load (10 req/sec test)
```

**Files Changed:**
- `ad-server/routes/ghost-api.js` (refactor logging + stats)
- `ad-server/package.json` (add @google-cloud/logging)

---

#### Story 1.2.2: GCS Archival Resilience
**As a** product owner
**I want** ticket archival to never fail silently
**So that** we retain all customer support data for legal/quality purposes

**Tasks:**
- [ ] Add retry logic to GCS uploads (3 attempts with exponential backoff)
- [ ] Log failures with ERROR level and structured data
- [ ] Add Cloud Monitoring metric: `ghost_api/archival_failures`
- [ ] Create alert: >5 archival failures in 1 hour
- [ ] Optional: Queue failed uploads to Cloud Tasks for retry

**Acceptance Criteria:**
```
✓ Transient GCS errors (network blip) retry automatically
✓ Permanent failures (quota exceeded) logged with ERROR
✓ Alert fires when archival failure rate exceeds threshold
✓ Manual intervention possible via Cloud Tasks console
```

---

### Epic 1.3: Deployment Pipeline Hardening
**Priority:** P0 (Critical)
**Owner:** SRE Team

#### Story 1.3.1: Enhanced Pre-Deployment Validation
**As a** SRE
**I want** the deployment pipeline to catch configuration errors before deploy
**So that** broken configs never reach production

**Tasks:**
- [ ] Expand `cloudbuild.yaml` secret validation (already exists at line 15)
  - Verify secret VALUES are not empty (currently only checks existence)
  - Add version/timestamp check to ensure secrets are recent
- [ ] Add config drift detection
  - Compare deployed env vars against expected baseline
  - Fail if critical vars are missing
- [ ] Validate Cloud Run service quotas before deploy
  - Check Gemini API quota remaining
  - Check GCS bucket permissions
- [ ] Add deployment checklist to CONTRIBUTING.md

**Acceptance Criteria:**
```
✓ Deployment fails if GEMINI_API_KEY is empty string
✓ Deployment fails if secret hasn't been updated in >90 days (rotation policy)
✓ Warning logged if Gemini quota <20% remaining
✓ All checks complete in <60s
```

---

#### Story 1.3.2: AI Endpoint Smoke Tests
**As a** QA engineer
**I want** AI functionality tested in every deployment
**So that** regressions are caught before users report them

**Tasks:**
- [ ] Add smoke test to `cloudbuild.yaml` after ad-server deploy (after line 94)
  - POST to `/ghost-api/analyze` with minimal valid payload
  - Verify HTTP 200 response
  - Verify response contains `answer` field with non-empty text
  - Timeout: 30s
- [ ] Add smoke test to `/bigtest` workflow
  - Include in Phase 4 (Smoke Test) section
  - Test both happy path and error handling (400 for invalid input)
- [ ] Create `tests/smoke/ghost-api.smoke.test.js`
  - Uses actual production endpoint (not mocked)
  - Counts against daily rate limit (acceptable for CI)

**Acceptance Criteria:**
```bash
✓ Smoke test runs after every production deployment
✓ Deployment rollback triggered if smoke test fails
✓ Smoke test completes in <30s
✓ Test covers: valid request, invalid request, rate limit check
```

**Implementation Example:**
```yaml
# Add to cloudbuild.yaml after line 94 (after health check)
echo "🧪 Smoke Testing Ghost AI..."
SMOKE_RESPONSE=$(curl -s -X POST "$$SERVICE_URL/ghost-api/analyze" \
  -H "Content-Type: application/json" \
  -d '{"persona":"CRM_buyer_persona","steps":[{"url":"/test","note":"CI smoke test"}]}')

if ! echo "$$SMOKE_RESPONSE" | grep -q "answer"; then
  echo "❌ Smoke test FAILED: No 'answer' field in response"
  exit 1
fi

echo "✅ Ghost AI smoke test PASSED"
```

---

### Epic 1.4: Monitoring & Alerting Foundation
**Priority:** P1 (High)
**Owner:** SRE Team

#### Story 1.4.1: AI Service Observability Dashboard
**As a** SRE on-call
**I want** a centralized dashboard for AI service health
**So that** I can quickly diagnose issues during incidents

**Tasks:**
- [ ] Create Cloud Monitoring dashboard: "Ghost AI - Production"
  - Panel 1: Request volume (success vs error)
  - Panel 2: Latency (p50, p95, p99)
  - Panel 3: Daily usage quota (against 100/day limit)
  - Panel 4: Gemini API errors by type
  - Panel 5: Rate limit rejections
  - Panel 6: GCS archival success rate
- [ ] Add custom metrics to `ghost-api.js`
  - `ghost_api/requests_total` (counter, labels: status, persona)
  - `ghost_api/latency` (histogram)
  - `ghost_api/daily_usage` (gauge)
  - `ghost_api/gemini_api_errors` (counter, labels: error_type)
- [ ] Export dashboard as JSON to `monitoring/dashboards/ghost-ai.json`

**Acceptance Criteria:**
```
✓ Dashboard shows real-time data with <1min delay
✓ Historical data retained for 30 days
✓ Dashboard accessible to entire SRE team
✓ Mobile-friendly layout for on-call response
```

---

#### Story 1.4.2: Critical Alerting Policies
**As a** SRE on-call
**I want** to be alerted BEFORE users notice problems
**So that** we maintain SLA and customer trust

**Tasks:**
- [ ] Create alerting policies in Cloud Monitoring:
  1. **P0 Alert: AI Service Unavailable**
     - Condition: >5% of requests return 503 in 5min window
     - Notification: PagerDuty + Slack #incidents
  2. **P1 Alert: High Error Rate**
     - Condition: >10% of requests return 500 in 15min window
     - Notification: Slack #sre-alerts
  3. **P1 Alert: Gemini API Key Invalid**
     - Condition: Gemini API returns 401/403 errors
     - Notification: Slack #sre-alerts + email
  4. **P2 Alert: Approaching Rate Limit**
     - Condition: >80 requests in current 24hr window
     - Notification: Slack #engineering (warning only)
  5. **P2 Alert: High Latency**
     - Condition: p95 latency >20s for 10min
     - Notification: Slack #performance
- [ ] Document runbook for each alert in `docs/runbooks/`
- [ ] Test alerts with synthetic failures (chaos engineering)

**Acceptance Criteria:**
```
✓ Alerts tested and firing correctly in staging
✓ Mean-time-to-alert (MTTA) <2min for P0 issues
✓ No false positives during 1-week monitoring period
✓ Runbooks linked in alert descriptions
```

---

## 🏃 SPRINT 2: TESTING & RESILIENCE (Week 3-4)

**Goal:** Achieve comprehensive test coverage and implement resilience patterns

### Epic 2.1: Comprehensive Test Coverage
**Priority:** P1 (High)
**Owner:** QA + Backend

#### Story 2.1.1: Expand Unit Test Suite
**As a** developer
**I want** full unit test coverage for error paths
**So that** edge cases are caught in CI, not production

**Tasks:**
- [ ] Expand `ad-server/tests/ghost-api.test.js`:
  - Test case: Missing GEMINI_API_KEY (503 response)
  - Test case: Invalid API key (Gemini returns 401)
  - Test case: Gemini API timeout (504 response)
  - Test case: Rate limit exceeded (429 response)
  - Test case: Invalid persona (defaults to safe persona)
  - Test case: Empty steps array (400 response)
  - Test case: Image too large (400 response)
  - Test case: GCS archival failure (200 but logged error)
- [ ] Add integration tests for startup-validator.js
- [ ] Add tests for environment config module
- [ ] Achieve >90% code coverage for ghost-api routes

**Acceptance Criteria:**
```
✓ All tests pass in CI
✓ Code coverage >90% for ad-server/routes/ghost-api.js
✓ Tests run in <30s
✓ No flaky tests (100 consecutive runs without random failures)
```

---

#### Story 2.1.2: E2E Tests for AI Feature
**As a** QA engineer
**I want** automated browser tests for the complete AI workflow
**So that** we catch UI/integration bugs before deployment

**Tasks:**
- [ ] Create `tests/e2e/ghost-ai.spec.js` (Playwright)
  - Test: User clicks "Start Walkthrough" → AI analyzes → shows results
  - Test: User without auth token → redirected to login
  - Test: AI returns error → user sees friendly error message
  - Test: Rate limit hit → user sees "daily limit reached" message
- [ ] Mock Gemini API responses for deterministic tests
- [ ] Add to CI pipeline (run on every PR)
- [ ] Add visual regression testing for AI response UI

**Acceptance Criteria:**
```
✓ E2E tests cover happy path + 3 error scenarios
✓ Tests run in headless mode in CI (<2min)
✓ Screenshots captured on failure for debugging
✓ Tests use staging environment (not mocked backend)
```

---

### Epic 2.2: Resilience Patterns
**Priority:** P1 (High)
**Owner:** Backend Team

#### Story 2.2.1: Circuit Breaker for Gemini API
**As a** backend engineer
**I want** to prevent cascading failures when Gemini API is degraded
**So that** our app remains partially functional during external outages

**Tasks:**
- [ ] Install `opossum` circuit breaker library
- [ ] Wrap `aiModel.generateContent()` calls in circuit breaker
  - Open circuit after 5 consecutive failures
  - Half-open after 30s cooldown period
  - Close circuit after 2 successful requests
- [ ] Return cached/fallback response when circuit is open
  - Fallback: "AI service temporarily unavailable. Your request has been queued for later processing."
- [ ] Add metric: `ghost_api/circuit_breaker_state` (closed/open/half-open)
- [ ] Add to dashboard

**Acceptance Criteria:**
```
✓ Circuit opens after 5 Gemini API failures in 60s
✓ User receives friendly fallback message (not 500 error)
✓ Circuit closes automatically when Gemini recovers
✓ Metric reflects circuit state changes in real-time
```

---

#### Story 2.2.2: Request Timeout Enforcement
**As a** SRE
**I want** all external API calls to have hard timeouts
**So that** slow upstream services don't cause our app to hang

**Tasks:**
- [ ] Add timeout to Gemini API calls (currently uses middleware timeout)
  - Use `AbortController` with 20s timeout
  - Separate from Express middleware timeout (25s)
- [ ] Add timeout to GCS operations
  - Upload: 10s timeout
  - Download: 5s timeout
  - List: 5s timeout
- [ ] Add retry logic with exponential backoff (3 retries, 1s, 2s, 4s delays)
- [ ] Log all timeouts with structured context (operation, duration, payload size)

**Acceptance Criteria:**
```
✓ Gemini API call times out after 20s (not 25s middleware timeout)
✓ GCS operations never block for >10s
✓ Retries occur automatically on transient failures
✓ Timeout errors return 504 Gateway Timeout (not 500)
```

---

#### Story 2.2.3: Graceful Degradation for Missing Features
**As a** product manager
**I want** users to see maintenance messages instead of error screens
**So that** we maintain professional UX during outages

**Tasks:**
- [ ] Add feature flag: `AI_ENABLED` (default: true)
- [ ] Update client-app to check feature availability
  - Show "Feature under maintenance" badge if disabled
  - Hide "Start Walkthrough" button gracefully
- [ ] Add admin endpoint: `POST /admin/features/toggle`
  - Requires admin JWT
  - Toggles features without redeployment
- [ ] Store feature flags in Firestore (real-time updates)
- [ ] Add to ops runbook: "How to disable AI feature during incident"

**Acceptance Criteria:**
```
✓ Setting AI_ENABLED=false hides feature in UI within 30s
✓ Users see friendly "maintenance" message, not error
✓ Feature can be toggled via API without app restart
✓ Toggle action logged to audit trail
```

---

### Epic 2.3: Cost & Quota Management
**Priority:** P2 (Medium)
**Owner:** Backend + Finance

#### Story 2.3.1: Gemini API Cost Monitoring
**As a** finance/ops team
**I want** to track Gemini API costs in real-time
**So that** we stay within budget and detect anomalies

**Tasks:**
- [ ] Integrate with Google Cloud Billing API
  - Query Gemini API usage daily
  - Store in BigQuery: `usage_analytics.gemini_costs`
- [ ] Create cost dashboard in Data Studio
  - Daily/weekly/monthly spend
  - Cost per request (average)
  - Projected monthly total
- [ ] Set budget alert: >$500/month on Gemini API
- [ ] Add cost attribution labels to API requests (user tier, persona)

**Acceptance Criteria:**
```
✓ Daily cost visible in dashboard (refreshed at midnight)
✓ Alert fires if projected monthly cost >$500
✓ Cost broken down by user tier and persona type
✓ Historical cost data retained for 12 months
```

---

#### Story 2.3.2: Intelligent Rate Limiting
**As a** product manager
**I want** authenticated users to have higher rate limits
**So that** we balance free tier abuse prevention with paid user experience

**Tasks:**
- [ ] Refactor rate limiting to use tiered approach:
  - Anonymous: 10 requests/day
  - Authenticated free: 50 requests/day
  - Authenticated paid: 200 requests/day
  - Admin: Unlimited
- [ ] Store rate limit state in Redis (shared across instances)
- [ ] Add rate limit headers to response:
  - `X-RateLimit-Limit: 50`
  - `X-RateLimit-Remaining: 23`
  - `X-RateLimit-Reset: 1643673600`
- [ ] Update client-app to show remaining quota in UI

**Acceptance Criteria:**
```
✓ Rate limits enforced correctly per user tier
✓ Redis used for distributed counting (works across multiple ad-server instances)
✓ Client UI shows "You have 23 AI requests remaining today"
✓ Limits reset at midnight UTC
```

---

## 🏃 SPRINT 3: LONG-TERM HARDENING & DOCUMENTATION (Week 5-6)

**Goal:** Establish sustainable practices and prevent similar issues across all services

### Epic 3.1: Documentation & Knowledge Sharing
**Priority:** P2 (Medium)
**Owner:** Tech Lead + SRE

#### Story 3.1.1: Operational Runbooks
**As a** on-call engineer
**I want** step-by-step runbooks for common incidents
**So that** I can resolve issues quickly without escalation

**Tasks:**
- [ ] Create `docs/runbooks/ghost-ai-503-unavailable.md`
  - Symptoms, diagnosis steps, resolution
- [ ] Create `docs/runbooks/ghost-ai-500-errors.md`
- [ ] Create `docs/runbooks/ghost-ai-rate-limit-exceeded.md`
- [ ] Create `docs/runbooks/gemini-api-quota-exceeded.md`
- [ ] Create `docs/runbooks/emergency-feature-disable.md`
- [ ] Add links to runbooks in alert notifications
- [ ] Conduct tabletop exercise with on-call team

**Acceptance Criteria:**
```
✓ Each runbook follows standard template (Symptoms → Diagnosis → Resolution)
✓ Runbooks tested by at least 2 team members
✓ Average incident resolution time improves by 30%
✓ Runbooks linked in Cloud Monitoring alert descriptions
```

---

#### Story 3.1.2: Architecture Decision Records (ADRs)
**As a** future developer
**I want** to understand why architectural choices were made
**So that** I don't repeat past mistakes or undo working solutions

**Tasks:**
- [ ] Create `docs/adr/001-gemini-api-integration.md`
  - Why Gemini over other LLMs
  - Why rate limiting chosen
  - Why circuit breaker pattern adopted
- [ ] Create `docs/adr/002-local-to-cloud-migration.md`
  - Why we removed local filesystem dependencies
  - Why Firestore for usage stats (not Redis/Memcache)
- [ ] Create `docs/adr/003-startup-validation-pattern.md`
  - Why fail-fast vs fail-open
  - Why startup checks vs runtime checks
- [ ] Add ADR template to repo

**Acceptance Criteria:**
```
✓ ADRs follow standard format (Context → Decision → Consequences)
✓ Each major architectural decision has an ADR
✓ ADRs reviewed and approved by tech lead
✓ ADRs referenced in code comments where relevant
```

---

#### Story 3.1.3: Developer Onboarding Guide
**As a** new team member
**I want** clear documentation on how to work with AI features
**So that** I can contribute without breaking production

**Tasks:**
- [ ] Create `docs/guides/working-with-ghost-ai.md`
  - How to test locally (with/without real API key)
  - How to run smoke tests
  - How to deploy to staging
  - Common pitfalls and debugging tips
- [ ] Update README.md with:
  - All required environment variables
  - How to set up secrets locally
  - How to run the full test suite
- [ ] Create video walkthrough (10min screen recording)
- [ ] Add to onboarding checklist

**Acceptance Criteria:**
```
✓ New developer can set up local environment in <30min using guide
✓ All environment variables documented with examples
✓ Common errors documented with solutions
✓ Guide reviewed by 2 developers who weren't involved in original implementation
```

---

### Epic 3.2: Platform-Wide External API Standards
**Priority:** P2 (Medium)
**Owner:** Architecture Team

#### Story 3.2.1: External API Integration Checklist
**As a** tech lead
**I want** a standard checklist for integrating any external API
**So that** we avoid repeating today's Gemini API mistakes with future integrations

**Tasks:**
- [ ] Create `EXTERNAL_API_CHECKLIST.md`:
  - [ ] API key stored in Secret Manager (not .env files)
  - [ ] Startup validation for required credentials
  - [ ] Timeout on all external calls (<30s)
  - [ ] Circuit breaker for unreliable APIs
  - [ ] Retry logic with exponential backoff
  - [ ] Monitoring for error rates, latency, costs
  - [ ] Rate limiting to prevent quota exhaustion
  - [ ] Smoke tests in deployment pipeline
  - [ ] Runbook for common failure modes
  - [ ] Cost monitoring and budget alerts
- [ ] Add to pull request template
- [ ] Require checklist completion for architecture reviews

**Acceptance Criteria:**
```
✓ Checklist covers all lessons learned from Gemini incident
✓ Checklist mandatory for all new external API integrations
✓ Historical violations identified (audit existing integrations)
✓ Checklist enforced via PR review guidelines
```

---

#### Story 3.2.2: Audit Existing External Integrations
**As a** security/SRE team
**I want** all existing external APIs audited against new standards
**So that** we proactively fix vulnerabilities before they cause incidents

**Tasks:**
- [ ] Identify all external API integrations:
  - Gemini API ✓ (being fixed)
  - Firebase Auth
  - Google Cloud Storage
  - (any others in codebase)
- [ ] For each integration, verify:
  - Secrets in Secret Manager? (not hardcoded)
  - Startup validation?
  - Timeout enforcement?
  - Error handling and circuit breakers?
  - Monitoring and alerting?
- [ ] Create remediation tickets for non-compliant integrations
- [ ] Track completion in compliance dashboard

**Acceptance Criteria:**
```
✓ All external APIs identified and cataloged
✓ Compliance score calculated for each API (0-100%)
✓ Critical issues (missing secrets, no timeouts) fixed within 2 weeks
✓ All integrations 100% compliant within 6 weeks
```

---

### Epic 3.3: Chaos Engineering & Reliability Testing
**Priority:** P3 (Low - Nice to Have)
**Owner:** SRE Team

#### Story 3.3.1: Chaos Experiments for AI Service
**As a** SRE
**I want** to intentionally break the system in controlled ways
**So that** I verify our resilience measures actually work

**Tasks:**
- [ ] Set up chaos testing framework (Chaos Toolkit or Gremlin)
- [ ] Create chaos experiments:
  1. **Experiment: Gemini API returns 500 errors**
     - Hypothesis: Circuit breaker opens, users see friendly message
  2. **Experiment: Gemini API slow (30s response time)**
     - Hypothesis: Request times out after 20s, returns 504
  3. **Experiment: GEMINI_API_KEY rotated (old key invalid)**
     - Hypothesis: Alert fires within 2min, runbook followed
  4. **Experiment: GCS bucket unavailable**
     - Hypothesis: App continues serving requests, archival fails gracefully
  5. **Experiment: Redis (rate limit store) down**
     - Hypothesis: Rate limiting fails open OR uses in-memory fallback
- [ ] Run experiments in staging monthly
- [ ] Document results and improvements in retrospectives

**Acceptance Criteria:**
```
✓ Each experiment has clear hypothesis and success criteria
✓ Experiments run automatically in staging environment
✓ Failures trigger alerts that on-call team practices resolving
✓ Chaos testing incorporated into quarterly disaster recovery drills
```

---

## 📋 DEFINITION OF DONE

### For Each Story
- [ ] Code changes reviewed and approved (2+ reviewers)
- [ ] Unit tests written and passing (>90% coverage for new code)
- [ ] Integration/E2E tests passing
- [ ] Documentation updated (inline comments, README, runbooks)
- [ ] Deployed to staging and smoke tested
- [ ] Product owner demo/approval
- [ ] Merged to main branch

### For Each Epic
- [ ] All stories completed
- [ ] Epic-level acceptance criteria met
- [ ] Regression testing passed
- [ ] Performance testing passed (load test if applicable)
- [ ] Security review completed (if touching auth/secrets)
- [ ] Deployed to production
- [ ] Monitoring confirms expected behavior (7 day soak test)

### For Sprint Completion
- [ ] All P0/P1 stories completed
- [ ] Retrospective held with lessons documented
- [ ] Next sprint planned
- [ ] Stakeholders notified of completion

---

## 🎯 SUCCESS METRICS

### Sprint 1 Success Criteria
- ✅ Zero production incidents caused by missing environment variables
- ✅ Zero deployments succeed with broken configurations
- ✅ 100% of deployments include AI smoke tests
- ✅ All logs/data stored in cloud services (no local filesystem usage)

### Sprint 2 Success Criteria
- ✅ Code coverage >90% for all AI-related code
- ✅ E2E test suite runs on every PR
- ✅ Circuit breaker prevents cascading failures during Gemini outage simulation
- ✅ Mean-time-to-recovery (MTTR) <10min for known incident types

### Sprint 3 Success Criteria
- ✅ 100% of on-call engineers trained on runbooks
- ✅ Average incident resolution time reduced by 30%
- ✅ All external APIs compliant with integration checklist
- ✅ Zero incidents caused by lack of monitoring/alerting

### Overall Program Success
- ✅ Zero Gemini-related production incidents for 60 consecutive days
- ✅ 99.9% uptime SLA for AI feature
- ✅ Cost per AI request within budget ($0.01/request target)
- ✅ User satisfaction score >4.5/5 for AI feature

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Gemini API quota limits during testing | High | Medium | Use test API key with separate quota, mock responses in CI |
| Breaking changes during refactoring | High | Medium | Feature flags, gradual rollout, comprehensive test coverage |
| Team capacity (other priorities) | Medium | High | Get executive buy-in, dedicate 50% of sprint to this work |
| Third-party dependencies (opossum, etc.) | Low | Low | Evaluate alternatives, have fallback implementations |
| Cloud costs increase due to logging/monitoring | Low | Medium | Set budget alerts, optimize log retention policies |

---

## 📞 TEAM & OWNERSHIP

| Role | Name | Responsibilities |
|------|------|------------------|
| Sprint Lead | TBD | Overall delivery, stakeholder communication |
| Backend Lead | TBD | Code reviews, architecture decisions |
| SRE Lead | TBD | Monitoring, alerting, deployment pipeline |
| QA Lead | TBD | Test strategy, E2E test automation |
| Product Owner | TBD | Prioritization, acceptance criteria, UAT |

---

## 📅 SPRINT SCHEDULE

### Sprint 1: Week of 2026-01-27
- **Day 1-2:** Sprint planning, story refinement, environment setup
- **Day 3-5:** Epic 1.1 (Startup Validation)
- **Day 6-7:** Epic 1.2 (Cloud-Native Refactoring)
- **Day 8-9:** Epic 1.3 (Deployment Pipeline)
- **Day 10:** Epic 1.4 (Monitoring), Sprint Review/Retro

### Sprint 2: Week of 2026-02-10
- **Day 1-2:** Sprint planning, Epic 2.1 kickoff
- **Day 3-6:** Epic 2.1 (Testing)
- **Day 7-9:** Epic 2.2 (Resilience)
- **Day 10:** Epic 2.3 (Cost Management), Sprint Review/Retro

### Sprint 3: Week of 2026-02-24
- **Day 1-2:** Sprint planning, Epic 3.1 kickoff
- **Day 3-5:** Epic 3.1 (Documentation)
- **Day 6-8:** Epic 3.2 (Platform Standards)
- **Day 9:** Epic 3.3 (Chaos Engineering)
- **Day 10:** Final review, retrospective, celebration 🎉

---

## ✅ SIGN-OFF

**Prepared by:** SRE Team Lead
**Date:** 2026-01-25
**Status:** Awaiting Approval

**Approvals Required:**
- [ ] Engineering Director
- [ ] Product Management
- [ ] SRE Manager
- [ ] Finance (for cost/resource allocation)

---

## 📚 APPENDIX: REFERENCE LINKS

- [Incident Report: 403 Forbidden](sre-reports/report-2026-01-25T144800-ghost-ai-incident.md)
- [Incident Report: 500 Server Error](sre-reports/report-2026-01-25T150500-ghost-ai-500.md)
- [Current Implementation: ghost-api.js](ad-server/routes/ghost-api.js)
- [Current Implementation: ai-guardrails.js](ad-server/services/ai-guardrails.js)
- [Deployment Config: cloudbuild.yaml](cloudbuild.yaml)
- [Google Cloud Best Practices: Secret Management](https://cloud.google.com/secret-manager/docs/best-practices)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [SRE Book: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)