# Complete SDLC & Antigravity Review Prompts Library

> [!NOTE]
> **Automation Shortcut:** To execute a specific prompt from this library, simply type `SDLC##n` in our chat, where `n` is the number of the prompt (e.g., `SDLC##1`). I will then process that prompt using the relevant codebase context.

**Created:** December 30, 2025  
**Total Prompts:** 19  
**Organization:** By estimated usage frequency (High → Medium → Low)  

---

# ⭐ HIGH-FREQUENCY PROMPTS (Use Every Sprint/Deployment)

These prompts address daily development challenges and deployment cycles.

---

## 1. Architecture and Code Quality Review Prompt

**Use When:** After major refactors, during code review bottlenecks, or quarterly architecture health checks  
**Est. Frequency:** Every 2–4 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior software architect conducting a critical code review of our project.

Please perform a comprehensive architectural review covering:

**Architecture Analysis:**
1. Overall design patterns and architectural style
2. Component separation and module coupling
3. Data flow and communication patterns
4. Scalability bottlenecks and limitations
5. Dependency management and circular dependencies

**Code Quality Assessment:**
1. Code organization and structure
2. Naming conventions and readability
3. Error handling and edge cases
4. Performance considerations
5. Security vulnerabilities or risks

**Critical Issues:**
1. Identify 3–5 most pressing architectural problems
2. Assess technical debt accumulated
3. Flag any violation of SOLID principles
4. Point out maintainability concerns

**Strategic Recommendations:**
1. Priority-ranked refactoring roadmap
2. Architectural improvements with justification
3. Testing and documentation gaps
4. Modernization opportunities

**Implementation Path:**
1. Quick wins (1–2 sprint items)
2. Medium-term improvements (1–2 quarters)
3. Long-term strategic changes (6+ months)

Be direct and critical. We want honest assessment, not diplomatic feedback.

---

## 2. Deployment‑Readiness / Glue Issues Review Prompt

**Use When:** Before each production deployment or after incidents related to missing files/wrong URLs  
**Est. Frequency:** Every week  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior software architect and DevOps engineer performing a **deployment‑readiness review** for our project.

Your goal is to prevent a repeat of past production issues by rigorously checking that all components are correctly wired together and deployable.

Context about previous failures:  
- Past errors involved incorrect or inconsistent **URL structures** (broken routes, wrong base paths, missing or extra slashes, wrong HTTP methods, mismatched frontend/backend routes).  
- Some files and assets were **forgotten in build pipelines** (Cloud Build or equivalent), causing missing artifacts at runtime.  
- Additional issues were documented in our **changelogs and "lessons learned" docs**, including configuration mismatches between environments and missing feature flags.

Given the codebase, configuration files, infrastructure definitions, and (if provided) changelogs and lessons‑learned notes, please:

### 1. Endpoint and URL integrity
1. Build a clear list of:  
   - All backend routes (path, method, service/handler).  
   - All frontend routes and navigation paths.  
   - Any external callback or webhook URLs.  
2. Check for:  
   - Routes referenced in the frontend that do not exist in the backend (or vice versa).  
   - Inconsistent URL patterns (trailing slashes, different casing, version prefixes like `/api/v1` vs `/v1`).  
   - Hard‑coded URLs that should be environment‑specific.  
3. Propose concrete fixes for every mismatch and inconsistency you find.

### 2. Build and deployment pipeline coverage
1. Inspect build and deployment definitions (e.g., Cloud Build configs, CI/CD workflows, Dockerfiles, package manifests).  
2. Identify:  
   - Source files, assets, migrations, scripts, or configuration files that are used at runtime but are **not included** in the build or deployment steps.  
   - Steps that depend on files or environment variables that may not exist in some environments.  
3. For each risk, suggest:  
   - The exact pipeline changes required (steps to add/modify/remove).  
   - Any needed checks (for example, "fail build if file X is missing").

### 3. Configuration and environment consistency
1. Compare configuration across environments (dev, staging, prod):  
   - Base URLs, API prefixes, feature flags, secrets, and timeouts.  
2. Flag:  
   - Values that are inconsistent in a way that could break URLs, routing, or external integrations.  
   - Any configuration that is duplicated or hard‑coded in code instead of a config layer.  
3. Recommend how to centralize and validate configuration (for example, typed config, schema validation).

### 4. Regression checks from changelogs and lessons learned
1. From the described historical issues (URL structure, missing build artifacts, etc.), infer a **checklist of concrete failure modes**.  
2. Verify, one by one, whether each failure mode is still possible in the current code and pipeline.  
3. For each item, classify as:  
   - "Still vulnerable – needs fix"  
   - "Mitigated in code"  
   - "Mitigated by process/tooling"  
   and explain why.

### 5. Risk assessment and action plan
1. Summarize the **top 5–10 deployment risks** you've found, ordered by severity and likelihood.  
2. Provide a **checklist** the team can run before each release, focusing on:  
   - Route and URL validation.  
   - Build artifact and asset coverage.  
   - Configuration and environment validation.  
3. Suggest **automated safeguards**:  
   - Tests to add (integration, contract, end‑to‑end).  
   - CI/CD validation steps (linting of routes, schema checks, "unused route" or "missing asset" checks).  
   - Any scripts to ensure that every referenced file or route is covered in the build.

Be explicit, critical, and concrete. Prefer precise findings and step‑by‑step fixes over general advice. If you need to make assumptions, state them clearly. Aim to produce output that can be turned directly into tickets for the next sprint.

---

## 3. Build Artifacts, File Inclusion & Caching Review Prompt

**Use When:** UI rendering failures, missing assets, or after architecture rebuilds  
**Est. Frequency:** As-needed (urgent)  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior DevOps and build systems engineer performing a **build artifact and caching audit** for our rebuilt architecture.

The problem: UI rendering failures and missing resources suggest that critical files—components, assets, styles, configuration, or vendor code—are either:
- Omitted from the build output entirely.
- Cached incorrectly in Cloud Build, serving stale versions.
- Referenced by code but not included in the bundled deliverable.
- Incorrectly excluded by `.gitignore`, `.dockerignore`, or build configuration.

Given the codebase, build configuration (Cloud Build YAML, Webpack/Vite/Parcel config, Dockerfile, package manifests), and any deployment logs or error traces:

### 1. Complete file dependency mapping
1. For the **UI/frontend build**:
   - List all entry points (HTML, JS, CSS, assets).
   - Trace all static file references (images, fonts, data files) and their expected output locations.
   - Identify all module imports and external dependencies.
2. For the **backend/server build** (if applicable):
   - List configuration files, templates, migrations, and scripts needed at runtime.
   - Identify any files referenced by environment variables or dynamic paths.
3. Cross-check: every referenced file should have a clear source location in the repo.

### 2. Build configuration audit
1. Review the **Cloud Build YAML** step-by-step:
   - Does each step include the files it needs? (e.g., `npm install` should run before `npm build`).
   - Are build outputs (dist, build folders) correctly captured and passed to the next step?
   - Are Docker layer caches being used correctly, or are they stale?
2. Review the **frontend bundler config** (webpack.config.js, vite.config.js, etc.):
   - Are all CSS, asset, and image loaders configured?
   - Are entry points and output paths correct?
   - Are all source file patterns included in the bundler input?
3. Review the **Dockerfile** (if containerized):
   - Are build artifacts copied from the correct source (after the build step)?
   - Is the production image including everything needed to serve the UI?
   - Are `.dockerignore` rules too aggressive and excluding necessary files?
4. Review **`.gitignore` and `.dockerignore`**:
   - Are critical UI files accidentally ignored (e.g., `dist/`, `build/`, vendor assets)?
   - Are node_modules handled correctly (excluded from git, but available in build)?

### 3. Missing file detection
1. List every file referenced in the codebase:
   - HTML `<img>`, `<link>`, `<script>` tags.
   - CSS `url()` references (fonts, images, backgrounds).
   - JavaScript `import`, `require()`, and dynamic paths.
   - Configuration files loaded at runtime.
2. Cross-check against the **build output**:
   - Does each referenced file appear in the built artifacts?
   - Are paths correctly resolved (no absolute paths, no missing basePath)?
   - Are generated/transpiled versions (e.g., minified CSS) in the right place?
3. For any missing file, identify:
   - Why it's missing (not copied, wrong path, excluded, not built).
   - The exact build step or config that should include it.

### 4. Cache and staleness investigation
1. Inspect **Cloud Build cache settings**:
   - Is the cache key too broad, causing stale artifacts to be reused across unrelated builds?
   - Are build steps unnecessarily using cache instead of rebuilding?
2. Identify **known caching pitfalls**:
   - Docker layer caching with `package.json` changes (does the npm install layer rebuild?).
   - Webpack/bundler caches that contain old files.
   - CDN or edge-cache headers that serve outdated assets.
3. Propose **cache invalidation strategy**:
   - When should the cache be cleared entirely (e.g., after major dependency upgrades)?
   - What cache keys should be used to ensure fresh builds when necessary?

### 5. UI rendering issues—root cause analysis
1. For each reported UI rendering failure:
   - Reproduce the exact error (network tab, browser console, server logs).
   - Determine if the file is missing, cached stale, or loaded from the wrong path.
   - Trace the call chain: code → file reference → build output → deployment → browser.
2. Common culprits to check:
   - CSS/SCSS not compiled or minified correctly.
   - Images/fonts not copied to the correct output directory.
   - JavaScript module not bundled or tree-shaken incorrectly.
   - Static asset basePath not matching deployment URL.
   - Service worker or build manifest out of sync.

### 6. Remediation roadmap
1. **Immediate fixes** (before next deployment):
   - Identify and add any omitted files to the build configuration.
   - Clear Cloud Build cache and force a full rebuild.
   - Verify all static assets are served from the correct paths.
2. **Short-term improvements** (1–2 sprints):
   - Add validation scripts to CI/CD that verify all referenced files exist in the build output.
   - Implement "source map audit" to verify generated code matches source.
   - Create a test that checks that critical UI files (CSS, images, fonts) load correctly.
3. **Long-term safeguards** (strategic):
   - Document the complete build artifact structure and deployment flow.
   - Implement a "build artifact manifest" (list of all files that should exist post-build).
   - Add CI/CD checks that fail if expected files are missing from the build output.
   - Use bundle size analysis to detect unexpected file size changes (indicator of missing compression or incorrect bundling).

### 7. Pre-deployment verification checklist
Before deploying, verify:
- [ ] All static assets referenced in HTML/CSS/JS exist in the build output.
- [ ] No hardcoded absolute paths; all asset paths are relative or use basePath config.
- [ ] CSS and JS are minified and sourcemaps are present.
- [ ] Images and fonts are optimized and in the correct output folder.
- [ ] `.gitignore` / `.dockerignore` are not excluding critical files.
- [ ] Cloud Build cache has been cleared for this build (or validated to be fresh).
- [ ] Build logs show no warnings about missing files or failed asset processing.
- [ ] A quick manual test loads the UI in a browser and inspects the network tab for 404s.

Be thorough and explicit. Provide exact file paths, configuration snippets, and step-by-step remediation instructions that can be converted directly into engineering tasks.

**Suggested model:** Use **Claude Opus 4.5 (Thinking)** for this review—the thinking capability will help trace complex build dependency chains and spot subtle configuration issues that cause file omissions or caching bugs.

---

## 4. Test Strategy & Coverage Review Prompt

**Use When:** Planning next testing phase, improving flaky tests, or before major releases  
**Est. Frequency:** Every 4–6 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are a staff‑level QA engineer and SDET performing a **test strategy and coverage review** for this project.

Using the codebase, current tests, and any documentation provided:

1. Classify the existing tests by level (unit, integration, contract, E2E, UI, performance, security) and summarize their actual purpose.  
2. Identify critical flows (authentication, payments, data writes, external integrations, background jobs, deployments) and check which are:  
   - Well‑covered by automated tests.  
   - Partially covered.  
   - Not covered at all.  
3. List concrete **gaps** in coverage, focusing on:  
   - Cross‑service interactions and API contracts.  
   - Error/rollback paths and edge cases.  
   - Data migration and schema‑change scenarios.  
4. Propose a **pragmatic test strategy** for the next 2–3 sprints:  
   - Which new tests to add first, and at what level.  
   - Tests that can be removed or simplified to reduce flakiness and maintenance.  
   - Patterns/helpers (factories, test data builders, fixtures) that would make tests easier to write.  
5. Suggest low‑overhead **quality gates** for CI (minimum coverage thresholds, required test suites, smoke tests on main).

Focus on actionable changes, not idealized theory.

---

## 5. Observability, Logging, and On‑Call Readiness Prompt

**Use When:** Setting up monitoring for new features, preparing for on-call rotation, or incident response  
**Est. Frequency:** Every 3–4 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior SRE evaluating the **observability and operability** of this system.

Given the codebase, configuration, and any deployment/monitoring information:

1. Assess how well the system can answer these questions in production:  
   - "Is it healthy right now?"  
   - "What's broken and for whom?"  
   - "Why did this request/job fail?"  
2. Review logging patterns for:  
   - Structured vs unstructured logs.  
   - Over‑logging/under‑logging.  
   - Missing correlation IDs and request context.  
3. Evaluate metrics and tracing (if present):  
   - Key SLIs/SLOs that should exist for this system.  
   - Gaps in metrics for latency, error rates, throughput, resource usage, and queue backlogs.  
4. Propose:  
   - A minimal set of logs, metrics, and traces that would dramatically improve debuggability.  
   - Alerts that should be configured, including clear thresholds and suggested runbooks.  
5. Highlight any risky patterns (silent failures, swallowed exceptions, "best effort" writes with no alerts).

Output concrete recommendations and example snippets for improved logging/metrics where helpful.

---

## 6. Security & Secrets Hygiene Review Prompt

**Use When:** Before production launch, during security audits, or after discovering secrets in code  
**Est. Frequency:** Every 4–8 weeks (or on-demand)  
**Model:** Claude Opus 4.5 (Thinking)

You are an application security engineer performing a **security and secrets hygiene review**.

Using the codebase and configuration files:

1. Scan for obvious security issues, including:  
   - Hard‑coded secrets, API keys, tokens, or passwords.  
   - Insecure default configurations, open CORS rules, or overly permissive auth.  
   - Direct SQL or storage access without parameterization.  
2. Evaluate authentication and authorization flows:  
   - How user identity is established, stored, and propagated.  
   - Where authorization decisions are enforced (and where they might be missing).  
3. Review input handling and validation:  
   - External input sources (HTTP, queues, webhooks, files).  
   - Potential injection, XSS, CSRF, or deserialization risks.  
4. Identify security‑relevant **logging** (for audit trails) and where it is missing or excessive.  
5. Produce a prioritized list of security improvements, categorizing them as:  
   - Critical (must fix before next release).  
   - High (fix within 1–2 sprints).  
   - Medium/low (track as technical debt).

Where possible, suggest concrete patterns or libraries that would remediate the issues.

---

## 7. API Contract & Integration Review Prompt

**Use When:** After frontend/backend teams decouple, API changes break clients, or before major API changes  
**Est. Frequency:** Every 2–3 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are a staff backend engineer and API architect performing an **API contract and integration review**.

Goal: ensure frontend, backend, and third-party integrations cannot drift and break at deploy time.

Given the codebase (frontend + backend), API specs (OpenAPI/Swagger if available), and any integration docs:

1. Enumerate all API surfaces:
   - Internal REST/GraphQL endpoints
   - Webhooks/callbacks
   - Background job payloads
   - Third‑party APIs
2. For each surface, produce a contract table:
   - Endpoint/event name, method, path/topic
   - Required headers/auth
   - Request schema and response schema
   - Error shapes and status codes
3. Identify mismatches and drift:
   - Frontend calls that don't match backend routes or payloads
   - Breaking changes without versioning
   - Undocumented fields relied upon by clients
4. Recommend hardening:
   - Contract tests (consumer-driven if appropriate)
   - API schema validation in CI
   - Versioning and deprecation policy
5. Output an actionable checklist and concrete changes (files/paths) to fix contract issues.

Be direct. Prefer exact diffs and test recommendations over general advice.

---

# 📋 MEDIUM-FREQUENCY PROMPTS (Use Monthly or Before Major Releases)

These address broader SDLC health, reliability, and team readiness.

---

## 8. Release & Change Management Review Prompt

**Use When:** Reviewing release process, improving deployment safety, or reducing hotfixes  
**Est. Frequency:** Every 4–8 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are an experienced engineering manager reviewing our **release and change management process**.

With access to commit history, pull requests, changelogs, and deployment configuration:

1. Analyze how changes flow from local development to production (branching model, merge strategy, environments).  
2. Identify failure modes such as:  
   - Large, risky PRs without proper review.  
   - Frequent hotfixes to production.  
   - Lack of clear ownership or approvals for sensitive areas.  
3. Evaluate the quality of release notes and changelogs:  
   - Are they understandable for engineers, support, and product?  
   - Do they clearly describe risk, impact, and rollback plans?  
4. Recommend improvements to:  
   - Branching strategy and release cadence.  
   - Review and approval rules.  
   - Checklists and templates for PRs and releases.  
5. Propose a practical **"change playbook"** for this team, including:  
   - Steps before merging (tests, linters, checks).  
   - Steps before deployment (smoke tests, feature flag toggles, backup/rollback plan).  
   - Post‑deployment verification.

Favor concrete policy and template suggestions over abstract advice.

---

## 9. Performance, Load & Capacity Review Prompt

**Use When:** Before expected traffic spikes, after performance complaints, or during architecture design  
**Est. Frequency:** Every 6–8 weeks or before major milestones  
**Model:** Claude Opus 4.5 (Thinking)

You are a performance engineer and SRE conducting a **load, capacity, and latency review**.

Given the system architecture, infra configs, and known user flows:

1. Identify the top 5 critical user journeys and the top 5 "expensive" operations.
2. Provide a load test plan:
   - Target RPS / concurrency assumptions
   - Test scenarios and ramp patterns
   - Success criteria (p95/p99 latency, error rate, saturation signals)
3. Identify bottlenecks likely to appear under load:
   - DB query patterns, indexes, hot partitions
   - Cold starts, concurrency limits, connection pools
   - CDN caching, asset delivery, large bundle issues
4. Recommend mitigations:
   - Caching strategy, pagination, batching
   - Rate limiting and backpressure
   - Query/index changes
5. Produce a "capacity worksheet" approach:
   - What to measure, where to instrument, what thresholds trigger scaling

Output a prioritized action plan and minimal set of benchmarks required for a production go/no-go.

---

## 10. Reliability Engineering Review (SLOs, Error Budgets, Rollouts)

**Use When:** Setting up reliability standards, defining SLOs, or after outages  
**Est. Frequency:** Every 6–12 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are an SRE defining **production reliability standards** for this service.

Given the system, current monitoring, and deployment workflow:

1. Propose SLIs/SLOs for:
   - Availability
   - Latency (p95/p99)
   - Correctness (business KPIs / success rates)
2. Define an error budget policy and what engineering actions are triggered when budget burns.
3. Review rollout strategy:
   - Feature flags, canary, phased rollout, rollback signals
4. Identify missing reliability mechanisms:
   - Retries with jitter, idempotency keys
   - Circuit breakers, timeouts, bulkheads
   - Graceful degradation paths
5. Deliver a "Reliability Readiness Checklist" for each release.

Be pragmatic: pick SLOs that match the product stage and team capacity.

---

## 11. Database Deployment & Wipe Strategy Prompt

**Use When:** Planning database changes, implementing safe reset procedures, or setting up DevOps controls  
**Est. Frequency:** Every 3–4 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior full-stack engineer architecting a **safe database deployment and reset workflow** for our application with strict separation between frontend and backend infrastructure.

**The Challenge:**
We need to:
- Deploy database schema changes and migrations safely to production without downtime.
- Provide a secure, audited way to wipe/reset the database (dev, staging, production) without accidental data loss.
- Maintain clear separation: frontend developers should NOT have direct database access or ability to trigger destructive operations.
- Ensure database operations are reproducible, idempotent, and reversible where possible.

Given the codebase, deployment pipeline, database schema, current Firebase or SQL database setup, and team structure:

### 1. Database Migration & Versioning Strategy

1. **Migration System Design:**
   - Define a versioning scheme for database migrations (timestamp-based, semantic versioning, etc.).
   - Design how migrations are tracked and executed (migration table, logs, status tracking).
   - Specify how migrations are authored (SQL scripts, ORM migration tools, infrastructure-as-code).
   - Ensure migrations are:
     - **Idempotent** (safe to run multiple times).
     - **Reversible** (rollback procedure documented and tested).
     - **Tested** (every migration tested in dev/staging before production).

2. **Schema Change Management:**
   - Document the process for adding/modifying/removing tables, collections, indexes, or fields.
   - Define backward compatibility requirements (old app versions must work with new schema during rollout).
   - Specify how long deprecated fields are kept before removal.
   - Plan for gradual migrations (e.g., add column, populate, then remove old column in separate deployment).

3. **Deployment Order & Coordination:**
   - If schema changes are decoupled from code deployment, define the order:
     - Option A: Schema first, then code (code must be backward-compatible).
     - Option B: Code first, then schema (schema must be backward-compatible).
     - Option C: Combined atomic deployment.
   - Document how to handle partial failures (e.g., code deployed but schema migration failed).

### 2. Database Wipe/Reset Procedures

1. **Wipe Strategy by Environment:**

   **Development:**
   - Who can trigger: Any developer.
   - How often: Frequently (daily, as needed).
   - Automation: Developers should be able to wipe their own local dev database easily (script, CLI command).
   - Risk: Low; local data only.

   **Staging:**
   - Who can trigger: Backend/DevOps team only (not frontend developers).
   - How often: Before major test cycles, as needed for test data reset.
   - Automation: Triggered via CLI tool or CI/CD pipeline with approval.
   - Data handling: Reset to known test data set (seeding/fixtures).
   - Risk: Medium; shared environment, but non-production.

   **Production:**
   - Who can trigger: Only on-call SRE or designated ops team (extreme restrictions).
   - How often: Never (or only in catastrophic scenarios with executive approval).
   - Automation: Requires explicit human approval, multi-step confirmation.
   - Risk: Critical; irreversible, affects real users.
   - Backup requirement: Full backup taken before any wipe attempt.

2. **Wipe Command/Tool Design:**
   - Create a dedicated CLI tool or API endpoint (not generic database access) that:
     - Takes environment as parameter (dev/staging/prod with different restrictions).
     - Optionally backs up current data before wiping.
     - Provides clear pre-wipe confirmation (what's being deleted, from where).
     - Logs all wipe operations (who, when, why, what was deleted).
     - Is rate-limited and monitored for abuse.
   - Example: `firebase-wipe --environment=staging --backup --confirm-key=<token>`
   - For SQL: Similar tool wrapping `DELETE FROM` or `TRUNCATE` with safeguards.

3. **Data Reset & Seeding:**
   - Define what "clean state" means for each environment.
   - Create reproducible seed data for staging (test users, sample records, fixtures).
   - Automate seeding post-wipe so environment is immediately usable.
   - Version control seed data so changes are tracked.

### 3. Infrastructure-as-Code & Deployment Pipeline

1. **Database Infrastructure Definition:**
   - Store all database configuration in code (Terraform, CloudFormation, Antigravity config, etc.).
   - Version control:
     - Firestore collection structure and security rules.
     - SQL schema (CREATE TABLE, indexes, constraints).
     - Cloud Functions that manage database operations.
     - IAM policies and service accounts.
   - Document the relationship between code and infrastructure (which code paths depend on what database structure).

2. **Deployment Pipeline Design:**
   - Create a **gated, auditable deployment process**:
     - Schema changes merged to main branch trigger a deployment plan (not auto-deploy).
     - Human review and approval required for schema changes.
     - Automated tests validate schema changes in staging.
     - Production deployment requires separate approval.
   - Stages:
     1. Local development (developer-controlled).
     2. CI/CD testing environment (auto-wipe, auto-reseed, automated tests).
     3. Staging (manual trigger, team access, monitoring).
     4. Production (multi-approval, audit log, monitoring).

3. **Rollback Strategy:**
   - Document how to rollback schema changes if deployment fails.
   - For reversible migrations: automated rollback script.
   - For non-reversible migrations: pre-migration backup restore procedure.
   - Test rollback procedures regularly.

### 4. Access Control & Separation of Concerns

1. **Role-Based Access:**
   - **Frontend Developer:** Read access to dev database; can wipe own dev environment; NO access to staging/prod.
   - **Backend/Platform Engineer:** Full access to dev; limited access to staging (wipe only via tool); read-only or no direct access to prod.
   - **SRE/DevOps:** Full access to staging; emergency access to prod (with logging/approval).
   - **Security/Compliance:** Audit-only access; can view all changes and access logs.

2. **Tooling & Barriers:**
   - Frontend developers do NOT get Firebase console/SQL client credentials for staging/prod.
   - All database operations (wipe, backup, restore) go through:
     - **CLI tool** with role-based permissions.
     - **CI/CD pipeline** with approval gates.
     - **API endpoint** (backend service) that is logged and monitored.
   - Hard barriers:
     - Staging/prod database credentials stored in secrets management (not in code, not in chat, not on laptops).
     - MFA/2FA required for production database access.
     - All prod access logged and reviewable.

3. **Audit & Monitoring:**
   - Log every database operation:
     - Schema changes (who, when, what, why).
     - Wipes/resets (who, when, environment, backup taken).
     - Access attempts (authorized and denied).
   - Alert on:
     - Unauthorized access attempts.
     - Unexpected wipes or deletes.
     - Schema changes in production.

### 5. Tooling & Automation

1. **Developer-Friendly Tools:**
   - **Local reset script:** `npm run db:reset` or `make db-reset` that safely wipes local dev database and reseeds.
   - **Status checker:** `npm run db:status` showing database state, migration version, row counts.
   - **Migration helper:** Tool to generate migration scaffolds.

2. **Staging/Prod Tooling:**
   - **CLI tool** for backend engineers:
     ```
     firebase-ops wipe --env staging --backup
     firebase-ops backup --env prod --output backup.tar.gz
     firebase-ops restore --env staging --from backup.tar.gz
     firebase-ops migrate --env staging --version 2025-01-15
     ```
   - **Web dashboard** (backend-only access):
     - View migration history, backups, wipe logs.
     - Trigger staging wipes with approval workflow.
     - Monitor database health and quota usage.

3. **CI/CD Integration:**
   - Automated schema validation on every pull request.
   - Automated testing of migrations on test database.
   - Staging auto-wipe + reseed on nightly schedule (or manually triggered).
   - Production deployments require manual approval + code review.

### 6. Testing & Validation

1. **Migration Testing:**
   - Every migration must be tested:
     - In isolation (schema change works).
     - With data (migration handles existing data correctly).
     - Backwards compatibility (old code works with new schema).
     - Forwards compatibility (new code works with old schema during rollout).
   - Automated tests run on every commit.

2. **Disaster Recovery Drills:**
   - Regularly test backup/restore procedures (monthly minimum for staging, quarterly for prod).
   - Document findings and update runbooks.
   - Simulate wipe + restore scenarios to verify data integrity.

3. **Load Testing Post-Schema-Change:**
   - After major schema changes (new indexes, denormalization), run load tests to verify performance.
   - Compare before/after metrics (query latency, throughput, resource usage).

### 7. Emergency Procedures & Runbooks

1. **Accidental Data Deletion in Staging:**
   - Runbook: Restore from latest backup, identify cause, implement safeguards to prevent repeat.
   - Timeline: Recover within 1 hour.

2. **Failed Migration in Staging:**
   - Runbook: Rollback to previous schema version, debug, retest, retry deployment.

3. **Production Data Corruption/Anomaly:**
   - Runbook: Isolate affected data, restore from backup, investigate cause, prevent repeat.
   - Escalation: Notify SRE on-call, potentially notify affected users.

4. **Accidental Production Wipe (catastrophic):**
   - Runbook: Restore from latest backup, post-incident review.
   - Prevention: Multiple approval gates, high-friction UI, frequent backups.

### 8. Documentation & Team Onboarding

Provide:
- **Quick-start guide** for developers (local setup, reset, testing).
- **Database schema documentation** (tables, collections, relationships, why this structure).
- **Migration runbook** (how to author, test, deploy a migration).
- **Disaster recovery guide** (backup, restore, rollback procedures).
- **Troubleshooting guide** (common issues, debugging steps, escalation path).
- **Compliance & audit documentation** (who has access, what's logged, retention policy).

### 9. Implementation Timeline & Priorities

Suggest a phased rollout:
1. **Phase 1 (Immediate):** Local dev reset automation, basic CI/CD validation.
2. **Phase 2 (1–2 weeks):** Staging wipe CLI tool, role-based access control, audit logging.
3. **Phase 3 (2–4 weeks):** Migration testing framework, backup/restore automation, runbooks.
4. **Phase 4 (1–2 months):** Production safeguards, monitoring, disaster recovery drills.

Be concrete, pragmatic, and security-conscious. Provide example code, configuration snippets, and specific tool recommendations that can guide implementation. Focus on **making safe operations easy** and **making unsafe operations hard**.

**Suggested model:** Use **Claude Opus 4.5 (Thinking)** for this review—the extended reasoning will help design sound database deployment strategies, anticipate failure modes, and architect proper separation of concerns across teams.

---

## 12. Firebase Production Readiness, Deployment & Security Review Prompt

**Use When:** Before Firebase launch or major Firebase feature changes  
**Est. Frequency:** Every 2–3 months or on-demand  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior SRE and database engineer conducting a **Firebase production readiness audit** for our application.

Your goal is to ensure Firebase is properly configured, secured, monitored, and ready for production traffic with minimal operational risk.

Given access to:
- Firebase project configuration (Firestore, Realtime Database, Authentication, Storage, Cloud Functions, Hosting).
- Security rules (Firestore rules, Storage rules, Database rules).
- IAM policies and service account configurations.
- Deployment configuration and CI/CD pipelines.
- Monitoring, logging, and alerting setup.
- Current database schema, indexes, and data model documentation.

Please conduct the following review:

### 1. Database Architecture & Design Review

1. **Firestore (if used):**
   - Assess the overall collection structure, document hierarchy, and denormalization strategy.
   - Identify potential N+1 query problems, missing composite indexes, or inefficient data access patterns.
   - Check for overly nested subcollections or documents that should be flattened.
   - Review field-level data types and identify any that could cause unnecessary storage or read/write costs.
   - Assess scalability of the current schema for projected traffic and data volume.

2. **Realtime Database (if used):**
   - Evaluate the overall tree structure and branching strategy.
   - Identify potential hot nodes or bottlenecks that could throttle read/write performance.
   - Check for unnecessary data duplication or synchronization overhead.

3. **Data Consistency & Integrity:**
   - Identify fields or collections that should have uniqueness constraints (and how to enforce them).
   - Review transaction design and identify potential race conditions.
   - Assess how soft deletes, archival, or data retention policies are implemented.

### 2. Security Rules Audit

1. **Firestore Security Rules:**
   - Audit read, write, create, delete, and update rules for each collection.
   - Check for overly permissive rules (e.g., `allow read, write: if true;`).
   - Verify that user identity (UID, custom claims) is correctly validated before granting access.
   - Identify missing rules that could allow unauthorized data access or modification.
   - Review rules for time-based access control, IP restrictions, or other conditional logic.
   - Check for rule complexity and maintainability issues.

2. **Storage Rules:**
   - Audit read and write permissions for each storage path.
   - Verify file size limits, content type restrictions, and metadata validation.
   - Check for proper user isolation (users can only access their own files).

3. **Realtime Database Rules:**
   - Audit read and write rules for each path.
   - Verify user identity validation and authorization logic.
   - Check for missing or incomplete rule coverage.

4. **Authentication & Authorization:**
   - Review enabled auth providers (Email/Password, Google, Facebook, etc.) and their security configurations.
   - Check for proper session management, token expiration, and refresh token handling.
   - Verify that custom claims or custom tokens are only issued by trusted backend services.
   - Assess multi-factor authentication (MFA) configuration and enforcement.
   - Review user account lifecycle (signup, email verification, password reset, deletion).

### 3. Infrastructure & Deployment Review

1. **Firebase Project Setup:**
   - Verify that only authorized team members have access to the Firebase console.
   - Check IAM roles for service accounts and users (principle of least privilege).
   - Ensure billing alerts are configured and monitored.
   - Review backup and disaster recovery procedures for critical data.

2. **Cloud Functions Deployment (if used):**
   - Audit the runtime environment, dependencies, and code for security vulnerabilities.
   - Verify that Cloud Functions are triggered only by authorized sources.
   - Check for proper error handling and logging in all functions.
   - Assess cold start times and concurrency limits.
   - Verify that functions have appropriate memory and timeout configurations.
   - Check for secrets management (API keys, credentials stored securely, not in code).

3. **Hosting Deployment:**
   - Review hosting configuration, SSL/TLS setup, and HTTP/2 enablement.
   - Verify that security headers (CSP, HSTS, X-Frame-Options, etc.) are configured.
   - Check for proper cache control headers on static assets and API responses.
   - Assess CDN and edge caching strategy.

4. **API Endpoints & Communication:**
   - If using custom backend APIs (not just Firebase), verify they are properly secured (authentication, authorization, input validation).
   - Check for proper rate limiting and DDoS protection.
   - Verify that all API communication is over HTTPS with certificate pinning (for mobile apps).

### 4. Monitoring, Logging & Alerting

1. **Logging Coverage:**
   - Verify that all critical Firebase operations are logged (authentication, data modifications, security rule violations).
   - Check that Cloud Functions logs are captured and searchable.
   - Assess log retention policies (balance between compliance and cost).
   - Verify that sensitive data is not logged (PII, credentials, tokens).

2. **Metrics & Monitoring:**
   - Review key metrics for database performance (read/write latency, operation count, error rates).
   - Assess monitoring coverage for authentication (failed login attempts, MFA adoption).
   - Check for monitoring of security rule violations and denied requests.
   - Verify that billing and cost metrics are tracked.
   - Identify missing metrics that would improve observability.

3. **Alerting & On-Call Readiness:**
   - Review configured alerts for database performance degradation, high error rates, or security anomalies.
   - Verify alert thresholds are appropriate (not too sensitive, not too late).
   - Check that alerts route to the on-call engineer with clear severity levels.
   - Assess runbooks for common Firebase issues (high latency, quota limits, rule rejections, authentication failures).

### 5. Cost Optimization & Quota Management

1. **Billing & Cost Analysis:**
   - Identify high-cost operations (expensive queries, unnecessary writes, large data transfers).
   - Review usage patterns and projected costs at current growth rate.
   - Assess opportunities for cost reduction (better indexes, caching, batch operations, data archival).

2. **Quota & Limits:**
   - Review Firebase quotas relevant to your app (document writes, read rate, concurrent connections, storage).
   - Identify approaching quotas and plan for scaling.
   - Assess request rate limiting strategy (client-side and server-side).

### 6. Disaster Recovery & Business Continuity

1. **Backup Strategy:**
   - Verify that automated backups are configured for Firestore and Realtime Database.
   - Test backup restoration procedures (document and practice).
   - Assess data recovery time objective (RTO) and recovery point objective (RPO).

2. **Failover & Redundancy:**
   - Review whether critical data is replicated across regions or backup systems.
   - Assess graceful degradation if Firebase becomes unavailable (offline support, fallback logic).

3. **Data Migration & Export:**
   - Verify that data can be exported in a usable format for compliance or future migration.
   - Document the process for exporting user data (GDPR/CCPA compliance).

### 7. Compliance & Data Privacy

1. **Data Residency & Jurisdiction:**
   - Verify that data is stored in a region compliant with your requirements (GDPR, CCPA, etc.).
   - Check if cross-region replication is needed or forbidden.

2. **Data Deletion & Retention:**
   - Verify that user deletion requests are properly handled (all user data removed).
   - Assess data retention policies (automatic deletion of old data, if required).
   - Document the data lifecycle (what data is stored, how long, when it's deleted).

3. **PII & Sensitive Data Handling:**
   - Audit what personally identifiable information (PII) is stored in Firebase.
   - Verify encryption at rest and in transit for sensitive data.
   - Check for proper access controls and audit logs for PII access.

### 8. Production Risk Assessment & Remediation

1. **Critical Issues:**
   - Identify the **top 5–10 production risks**, ordered by severity and likelihood.
   - For each risk, explain the potential impact and provide a concrete remediation step.

2. **Priority-Ranked Remediation Roadmap:**
   - **Critical (must fix before launch):** Security rule vulnerabilities, unencrypted PII, missing authentication.
   - **High (fix before expected peak load):** Missing indexes, inadequate monitoring, insufficient quota.
   - **Medium (fix within 1–2 sprints):** Cost optimizations, improved runbooks, automated scaling.
   - **Low (track as technical debt):** Schema refactoring, non-critical monitoring gaps.

3. **Pre-Production Launch Checklist:**
   - [ ] All security rules reviewed and tested.
   - [ ] IAM roles configured with least privilege.
   - [ ] Monitoring, logging, and alerting configured.
   - [ ] Backup and disaster recovery procedures tested.
   - [ ] Load testing completed; quotas validated.
   - [ ] On-call runbooks and escalation paths documented.
   - [ ] Data privacy and compliance reviewed.
   - [ ] Cost projections reviewed and approved.
   - [ ] Incident response plan documented.

### 9. Operational Runbooks

Provide **concrete runbooks** for common Firebase operational scenarios:
- Handling database quota exceeded errors.
- Responding to security rule rejections or anomalous access patterns.
- Debugging high latency or read/write failures.
- Managing user authentication issues (lockouts, MFA problems).
- Data backup and recovery procedures.
- Scaling database performance (indexes, denormalization, sharding).
- Handling billing spikes or unexpected cost increases.

Be explicit, critical, and thorough. Prioritize actionable findings and provide specific configuration changes, security rule examples, and remediation steps that can be directly implemented or converted to engineering tasks.

**Suggested model:** Use **Claude Opus 4.5 (Thinking)** for this comprehensive review—the extended reasoning will help analyze complex security rules, data model design trade-offs, and identify subtle operational risks.

---

# 🔧 LOW-FREQUENCY PROMPTS (Use Quarterly or Special Occasions)

These address broader team and strategic concerns, or are triggered by specific scenarios.

---

## 13. Requirements & Scope Validation Prompt

**Use When:** Starting a new feature or project, before major rewrites, or when scope is unclear  
**Est. Frequency:** Per feature cycle (every 2–4 weeks if iterating)  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior product manager and solutions architect.  
Review the following requirements and current implementation context.

Goals:  
- Validate that requirements are clear, testable, and technically feasible.  
- Identify gaps, contradictions, or hidden assumptions.  
- Highlight risks that could derail delivery.

Tasks:  
1. Rewrite the requirements as concise, testable user stories with clear acceptance criteria.  
2. Identify ambiguities, conflicts, or missing edge cases and list clarifying questions for the team.  
3. Map each requirement to:  
   - Existing features or modules that already support it.  
   - New work that must be done.  
4. Call out scope creep or "nice‑to‑have" items that should be de‑scoped or moved to a later milestone.  
5. Produce a short, prioritized backlog that could be handed to a team for the next 1–2 sprints.

Be concrete and critical; prefer specific examples of missing detail over vague feedback.

---

## 14. Incident Response + Postmortem Learning Prompt

**Use When:** After major incidents or outages; conducting blameless postmortems  
**Est. Frequency:** Per incident (varies)  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior SRE facilitating an **incident postmortem** and hardening plan.

Given an incident description, timeline, logs, and deployment history:

1. Write a clear incident narrative (what happened, impact, duration, user scope).
2. Build a precise timeline (detection → triage → mitigation → resolution).
3. Identify contributing factors across:
   - Code, testing, deployment, monitoring, runbooks, org/process
4. Distinguish:
   - Root causes vs contributing causes vs triggering event
5. Provide corrective actions:
   - Prevention (code/process)
   - Detection (alerts/monitoring)
   - Mitigation (runbooks/automation)
6. Produce "guardrail" tickets that would have prevented recurrence (CI checks, tests, approval gates).

Avoid blame. Optimize for learning and measurable prevention.

---

## 15. Dependency / Supply Chain Security & License Compliance

**Use When:** Before major releases, quarterly security reviews, or after discovering vulnerable dependencies  
**Est. Frequency:** Every 4–12 weeks  
**Model:** Claude Opus 4.5 (Thinking)

You are a security engineer and build engineer performing a **software supply chain** review.

Using package manifests/lockfiles, CI configuration, and Docker images:

1. Identify dependency risks:
   - Known vulnerabilities (high/critical)
   - Unmaintained packages
   - Typosquatting risk / suspicious packages
2. Review build provenance:
   - Pinned versions, lockfile integrity, reproducible builds
   - Signed artifacts / attestations (if feasible)
3. Review secrets exposure risk in build and runtime images.
4. Review license compliance risks (GPL/AGPL, etc.) for production distribution.
5. Recommend a minimal "dependency governance" setup:
   - Automated scanning in CI
   - Policy thresholds and exception process
   - Update cadence

Output a prioritized remediation plan with exact package-level actions.

---

## 16. Data Governance, Privacy, and Retention Review

**Use When:** Before major data model changes, compliance audits, or user privacy concerns  
**Est. Frequency:** Every 6–12 months or on-demand  
**Model:** Claude Opus 4.5 (Thinking)

You are a senior data engineer and privacy lead reviewing **data governance** for production.

Given data models, Firebase/DB schema, logs, analytics events, and storage:

1. Identify all data categories stored/processed:
   - PII, payment, location, device IDs, tokens, logs
2. Map data flows:
   - Collection → processing → storage → sharing → deletion
3. Define retention and deletion:
   - How long each dataset lives
   - How user deletion requests propagate to all stores
4. Evaluate logging/analytics for PII leakage risk.
5. Provide a compliance-ready checklist:
   - Access controls, auditability, least privilege
   - Data minimization and purpose limitation
   - Backups and deletion implications

Output concrete policy + technical changes (schemas, logging filters, TTL strategies).

---

## 17. Accessibility & UX Production Readiness

**Use When:** Before major UI releases, periodic accessibility audits, or legal/compliance requirement  
**Est. Frequency:** Every 3–6 months  
**Model:** Claude Opus 4.5 (Thinking)

You are an accessibility specialist and senior frontend engineer performing an **a11y + UI robustness** review.

Given the UI codebase and key screens:

1. Identify critical accessibility failures:
   - Keyboard navigation, focus management
   - Color contrast, semantic HTML/ARIA usage
   - Form labels/errors and screen reader flow
2. Identify UI robustness issues:
   - Loading states, empty states, error states
   - Responsive layout breakpoints
   - Slow network and offline behavior
3. Recommend automated checks:
   - Lint rules, CI a11y tests, smoke checks
4. Provide a prioritized fix list with component/file-level guidance.

Optimize for "fix most users' pain fastest."

---

## 18. Architecture Decision Records (ADR) + Technical Decision Quality Gate

**Use When:** Documenting key architectural decisions, quarterly reviews of decision quality  
**Est. Frequency:** Per decision (ongoing)  
**Model:** Claude Opus 4.5 (Thinking)

You are a principal engineer reviewing our **technical decisions** and ensuring they are recorded and defensible.

Given recent architectural changes and constraints:

1. Identify the top decisions that should have ADRs (or updates to existing ADRs).
2. For each decision, write an ADR:
   - Context, decision, alternatives considered, consequences
3. Flag decisions that increase long-term complexity or lock-in without clear benefit.
4. Propose a lightweight "decision quality gate":
   - What decisions require review
   - Required evidence (benchmarks, threat model, migration plan)

Output ADRs in a consistent template ready to commit.

---

## 19. App & Infrastructure Evolution Narrative Prompt

**Use When:** Onboarding new team members, investor/board presentations, or milestone celebrations  
**Est. Frequency:** Every 6–12 months or on-demand  
**Model:** Claude Opus 4.5 (Thinking)

You are a technical historian and data visualization expert creating a **rich interactive HTML narrative** that tells the story of our application's evolution—from inception through architecture rebuilds, deployments, and lessons learned.

**Inputs:**
You have access to:
- Commit history and deployment timeline
- Lessons learned documents and postmortem notes
- Architecture diagrams (text descriptions or existing SVG/images)
- Changelog entries and release notes
- Historical infrastructure configurations
- Design system files and HTML component examples
- Markdown documentation files

**Goal:** Create a **compelling, interactive HTML document** that:
1. Tells a chronological story of the app's evolution
2. Highlights key inflection points (architecture decisions, incidents, major refactors, scaling milestones)
3. Includes rich diagrams and visual timelines
4. Maintains design consistency using the existing design system
5. Is self-contained, shareable, and requires no external dependencies

**Deliverable Structure:**

### 1. Opening Narrative Section
- Hook: "In [month/year], we built the first version of [app]..."
- Key stats: Initial team size, technology choices, core problem solved
- Design: Large hero image/banner, bold typography, compelling opening quote

### 2. Timeline/Phases of Evolution
For each major phase (e.g., "Phase 1: MVP Launch", "Phase 2: Architecture Rebuild", "Phase 3: Scaling & Hardening"):
- **Phase Header**: Name, timeframe, team size
- **What We Built**: Feature highlights, technology stack
- **Challenges We Faced**: Real bottlenecks, incidents, or technical debt
- **What We Learned**: Key lessons and insights
- **Diagrams**: 
  - Architecture diagram (boxes for services, arrows for data flow, with annotations)
  - Timeline showing milestones within the phase
  - Metrics over time (DAU, response latency, errors, deployment frequency)
- **Call-Out Boxes**: Highlight critical decisions (decision name, outcome, impact)

### 3. Architecture Evolution Visuals
Create **side-by-side comparisons** showing how the architecture evolved:
- **"Then vs Now"** sections with before/after diagrams
- Color-coded elements (frontend, backend, database, third-party services)
- Annotations explaining why each change was made

### 4. Key Incidents & Learnings
For each major incident or lesson learned (from postmortems/docs):
- **Incident Title & Date**
- **What Happened**: Brief narrative (1–2 sentences)
- **Impact**: Users affected, downtime, business cost
- **Root Cause**: Clear, concise statement
- **How We Fixed It**: Technical and process changes
- **Lasting Impact**: What changed because of this

Design as **collapsible cards** or **expandable sections** to keep the narrative flowing.

### 5. Technology & Tooling Evolution
- Timeline of tool/framework changes (e.g., "Switched from X to Y in Q3 2024")
- Why each change was made
- Trade-offs and outcomes

### 6. Team & Organizational Growth
- Team size over time (chart)
- Key roles added and why (e.g., "Hired SRE to own reliability")
- Cultural shifts or process changes

### 7. Metrics Dashboard
Create a **visual summary dashboard** showing:
- Deployment frequency (commits merged over time)
- Incident frequency and MTTR trends
- Test coverage growth
- Technical debt reduction/accumulation
- Performance metrics (latency, error rates, uptime)

Use **simple line charts, area charts, or sparklines** (SVG or canvas-based, no external charting library).

### 8. Key Decisions & ADRs
Extract and display the **most important decisions**:
- What was decided
- When and why
- Alternatives considered
- Outcome and impact (known hindsight)

### 9. Lessons Learned Summary
Create a **"Lessons Learned Hall of Fame"** section:
- Most important lessons organized by category (Architecture, Operations, Team, Process)
- For each lesson: what we learned, how it changed us, what we'd do differently

### 10. Future Roadmap
- Next phases or challenges ahead
- Known technical debt to address
- Infrastructure improvements planned

**Design & Visual Requirements:**

1. **Consistency with Existing Design System:**
   - Use colors, typography, and components from the design system folder
   - Import or reference CSS variables and component styles
   - Ensure responsive design (mobile, tablet, desktop)

2. **Diagrams & Visuals:**
   - **Architecture Diagrams**: SVG-based (boxes, arrows, labels) with clear service naming
   - **Timelines**: Vertical or horizontal timelines with key events
   - **Metrics Charts**: Simple, readable charts (line, area, bar) with legend
   - **Comparison Visuals**: Side-by-side "Then vs Now" layouts
   - **Call-Out Boxes**: Colored cards highlighting key insights or decisions
   - **Icons**: Small, clear icons to represent services/technologies (optional)

3. **Interactivity (Optional but Encouraged):**
   - Expandable/collapsible sections for incidents and lessons
   - Hover tooltips on timeline events or metrics
   - Clickable diagram elements that reveal more detail
   - Smooth scrolling navigation to sections
   - "Jump to" navigation menu

4. **Typography & Layout:**
   - Clear visual hierarchy (h1, h2, h3)
   - Ample whitespace and padding
   - Line lengths readable (60–80 chars)
   - Large images and diagrams that don't look cramped

5. **Self-Contained HTML:**
   - All CSS embedded in `<style>` tags
   - All SVG diagrams embedded in the document
   - No external dependencies (no CDNs, no build process)
   - Single HTML file that can be opened in any browser or shared via email

**Data Extraction Instructions:**

Parse and integrate:
- **Commit history**: Extract dates, authors, key changes, deployment frequency
- **Changelog**: Key features by phase, release dates
- **Postmortems/Lessons Learned**: Incident title, date, impact, root cause, fix
- **Architecture docs**: Current and past designs, service names, data flows
- **Design system**: Color palette, typography, component examples
- **Markdown docs**: Key insights from README, architecture docs, decision records

If information is incomplete, make **reasonable inferences** from available data.

**Output Format:**

Generate a **single, well-structured HTML file** with:
- Clear semantic HTML (`<header>`, `<nav>`, `<section>`, `<article>`, `<footer>`)
- Embedded CSS with responsive media queries
- Embedded SVG diagrams
- No external resources or dependencies
- Viewport and character encoding meta tags

**Tone & Style:**

- **Narrative-driven**: Tell a compelling story, not a dry technical document
- **Human-centered**: Highlight challenges the team faced, decisions made under pressure, lessons learned
- **Data-backed**: Use facts from commit history, changelogs, and metrics
- **Celebratory but honest**: Acknowledge wins and failures with equal weight
- **Forward-looking**: End with lessons and implications for the future

Be ambitious with visuals and narrative. This document should be something the team is proud to share with new hires, investors, or partners.

---

# 📖 USAGE GUIDE

## How to Use This Document

1. **Find the Right Prompt:**
   - Start by reviewing the frequency and use-case for each prompt
   - Pick the one(s) that match your current need
   - Copy the full prompt text into your model (Antigravity, Claude, etc.)

2. **Suggested Model for Each:**
   - Most prompts are optimized for **Claude Opus 4.5 (Thinking)**
   - For lighter tasks (Prompts #13, #17), **Claude Sonnet 4.5** works fine
   - For quick edits, use **Claude Sonnet 4.5 (standard)**

3. **Recommended Sequence for a New Project (or Rebuild):**
   - **Week 1:** Prompt #1 (Architecture & Code Quality) + Prompt #2 (Deployment-Readiness)
   - **Week 2:** Prompt #3 (Build Artifacts & Caching) if rendering issues exist
   - **Week 3:** Prompt #11 (Database Deployment & Wipe) to architect safe DB operations
   - **Month 1:** Prompt #12 (Firebase Production Readiness) if Firebase is your backend
   - **Month 2:** Prompt #7 (API Contract & Integration) to validate all integrations
   - **Before Launch:** Prompts #4, #5, #6 (Testing, Observability, Security)
   - **Post-Launch:** Prompts #8–10 (Release Management, Performance, Reliability)

4. **For an Existing Mature Product:**
   - Run Prompt #5 (Observability) every quarter
   - Run Prompt #6 (Security) every 4–6 weeks
   - Run Prompt #15 (Dependency/Supply Chain) every 3 months
   - Use Prompt #14 (Incident Postmortems) after every major incident
   - Review Prompt #18 (ADRs) quarterly

5. **Create Documentation:**
   - Use Prompt #19 (Evolution Narrative) to onboard new team members
   - Use outputs from Prompts #1, #2, #11 to write architecture docs
   - Use outputs from Prompts #14 to build institutional knowledge

## Tips for Best Results

- **Provide Context:** Paste actual code snippets, config files, and logs into the prompts for concrete feedback
- **Iterate:** Run a prompt, review output, then run it again with clarifications
- **Combine:** Chain multiple prompts for comprehensive coverage
  - Example: Run #1 → #2 → #7 → #4 for a complete pre-launch review
- **Export Outputs:** Save valuable insights to your knowledge base or wiki
- **Update Periodically:** As your app evolves, re-run key prompts to track health

---

**Last Updated:** December 30, 2025  
**Total Prompts:** 19  
**Estimated Total Coverage:** ~95% of typical SDLC checkpoints
