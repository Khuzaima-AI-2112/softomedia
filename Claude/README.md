# Claude Folder - Gemini API Recovery Documentation

**Created:** 2026-01-25
**Purpose:** Centralized documentation for Gemini API incident analysis and recovery planning

---

## 📁 FOLDER CONTENTS

### For Executives & Decision Makers
- **[EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)** ⭐ START HERE
  - 3-page overview of incident, impact, and recommended plan
  - Business metrics and ROI analysis
  - Approval checklist and next steps
  - **Read time:** 10 minutes

### For Engineering Leads & PMs
- **[SPRINT_PLAN_GEMINI_RECOVERY.md](SPRINT_PLAN_GEMINI_RECOVERY.md)**
  - Complete 6-week sprint plan (3 sprints)
  - Detailed user stories with acceptance criteria
  - Technical tasks, dependencies, and success metrics
  - **Read time:** 30-45 minutes

### For Engineers (Implementation Team)
- **[CRITICAL_ACTIONS_IMMEDIATE.md](CRITICAL_ACTIONS_IMMEDIATE.md)** 🔥 URGENT
  - 5 critical actions to complete in next 48 hours
  - Step-by-step implementation guides with code samples
  - Success criteria and testing instructions
  - **Read time:** 15 minutes
  - **Implementation time:** 10-12 hours total

---

## 🎯 QUICK START GUIDE

### If you're a...

#### **Executive / Business Stakeholder**
1. Read [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)
2. Review approval checklist
3. Schedule decision meeting for Monday 2026-01-27

#### **Engineering Manager / Tech Lead**
1. Skim [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) for context
2. Deep dive [SPRINT_PLAN_GEMINI_RECOVERY.md](SPRINT_PLAN_GEMINI_RECOVERY.md)
3. Assign team members to epics
4. Review [CRITICAL_ACTIONS_IMMEDIATE.md](CRITICAL_ACTIONS_IMMEDIATE.md) and kick off work

#### **Backend Engineer / SRE**
1. Read [CRITICAL_ACTIONS_IMMEDIATE.md](CRITICAL_ACTIONS_IMMEDIATE.md)
2. Pick one of the 5 critical actions based on your expertise:
   - Action 1: Startup Validation (Backend)
   - Action 2: Smoke Tests (SRE)
   - Action 3: Filesystem Migration (Backend)
   - Action 4: Alerting (SRE)
   - Action 5: Secret Validation (SRE)
3. Start implementation immediately (if approved)

#### **QA Engineer**
1. Read Sprint 2, Epic 2.1 in [SPRINT_PLAN_GEMINI_RECOVERY.md](SPRINT_PLAN_GEMINI_RECOVERY.md)
2. Start planning E2E test scenarios
3. Review existing test coverage

---

## 📊 INCIDENT CONTEXT

### What Happened (Quick Version)
- **When:** 2026-01-25 (today)
- **What:** Gemini AI "Context Assistant" feature completely down
- **Why:** Two cascading configuration failures (403 → 500 errors)
- **Duration:** 12+ hours and counting
- **Status:** 🔴 **STILL BROKEN** (as of 23:39) - claimed "fix" at 14:07 was incorrect

### Root Causes (The Real Problem)
1. Dev security controls deployed to production ❌
2. Missing API credentials in production ❌
3. No smoke tests for AI endpoints ❌
4. App starts with broken dependencies ❌
5. Non-cloud-native code patterns ❌

### Why This Matters
These aren't just Gemini problems - they're **platform-wide gaps** that could affect ANY external integration (Stripe, Analytics, Firebase, etc.). We need to fix the system, not just the symptom.

---

## 🚀 IMPLEMENTATION PHASES

### Phase 1: Stop the Bleeding (48 hours)
**Goal:** Prevent immediate recurrence
**Actions:** 5 critical fixes (see CRITICAL_ACTIONS_IMMEDIATE.md)
**Team:** 2 engineers
**Can start:** Immediately

### Phase 2: Sprint 1 - Critical Hardening (Weeks 1-2)
**Goal:** Make system production-grade
**Focus:** Startup validation, cloud-native refactoring, monitoring
**Team:** 2 full-time engineers
**Start:** Monday 2026-01-27 (pending approval)

### Phase 3: Sprint 2 - Testing & Resilience (Weeks 3-4)
**Goal:** Comprehensive coverage and failure resistance
**Focus:** Tests, circuit breakers, cost monitoring
**Team:** 1.5 full-time engineers
**Start:** 2026-02-10

### Phase 4: Sprint 3 - Platform Standards (Weeks 5-6)
**Goal:** Prevent similar issues across all services
**Focus:** Documentation, standards, audits
**Team:** 1 full-time engineer
**Start:** 2026-02-24

---

## ✅ TRACKING PROGRESS

### Current Status
- [ ] Incident resolved in production ❌ **STILL BROKEN (23:39)**
- [ ] Root cause identified (need to check production logs)
- [x] Emergency response plan documented
- [ ] Production logs checked for actual error
- [ ] Fix deployed and verified
- [ ] Preventive actions implemented
- [ ] Sprint plan execution (pending bug fix)
- [ ] All success metrics achieved

### Where to Track Day-to-Day Work
- **Jira/Project Board:** (Link TBD - create during sprint planning)
- **Daily Standups:** Check progress on current sprint
- **Slack Channel:** #gemini-recovery (or #engineering)
- **This Repo:** Update checkboxes above as milestones complete

---

## 📞 WHO TO CONTACT

### Questions About...
- **Business impact / ROI:** Product Management
- **Technical approach:** Tech Lead / Backend Lead
- **Resource allocation:** Engineering Director
- **Cloud infrastructure:** SRE Manager
- **Testing strategy:** QA Lead
- **Implementation details:** Check code comments or ask in #engineering

### Escalation Path
1. **Blockers:** Tag relevant lead in Slack
2. **Scope changes:** Bring to sprint planning meeting
3. **Urgent production issues:** Follow on-call procedures (this is for planning, not live incidents)

---

## 🔗 RELATED RESOURCES

### Incident Reports (Root Cause)
- [403 Forbidden Incident](../sre-reports/report-2026-01-25T144800-ghost-ai-incident.md)
- [500 Server Error Incident](../sre-reports/report-2026-01-25T150500-ghost-ai-500.md)
- [BigTest Execution Report](../sre-reports/report-2026-01-25T130500-bigtest.md)

### Code References
- [ghost-api.js](../ad-server/routes/ghost-api.js) - Main AI endpoint implementation
- [ai-guardrails.js](../ad-server/services/ai-guardrails.js) - Security middleware
- [cloudbuild.yaml](../cloudbuild.yaml) - Deployment configuration
- [ghost-api.test.js](../ad-server/tests/ghost-api.test.js) - Existing test suite

### External Documentation
- [Google Cloud Secret Manager Best Practices](https://cloud.google.com/secret-manager/docs/best-practices)
- [Circuit Breaker Pattern (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html)
- [SRE Book: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Gemini API Documentation](https://ai.google.dev/docs)

---

## 📝 DOCUMENT MAINTENANCE

### How to Update These Docs
- **Sprint progress:** Update status checkboxes in this README
- **New risks/issues:** Add to sprint plan under Risks & Mitigations
- **Completed actions:** Mark todos as done in CRITICAL_ACTIONS_IMMEDIATE.md
- **Lessons learned:** Add to retrospective section of sprint plan

### Version History
- **v1.0** (2026-01-25): Initial creation after incident resolution
- *Future updates will be noted here*

---

## 🎓 LESSONS LEARNED (So Far)

1. **Environment parity is critical** - Dev controls must not leak to production
2. **Fail fast > fail silent** - App should refuse to start with broken config
3. **Smoke tests are mandatory** - Every deployment must validate core functionality
4. **Cloud-native patterns** - Local filesystem doesn't work in containers
5. **Monitoring beats debugging** - Proactive alerts prevent user-reported incidents

**Full retrospective will be conducted after Sprint 3 completion.**

---

**Remember:** This isn't about blame - it's about building a more resilient system. Every incident is an opportunity to level up our engineering practices. Let's make sure we learn from this! 💪

---

*Last updated: 2026-01-25*
*Maintained by: SRE Team*
