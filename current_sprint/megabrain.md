# Megabrain: Single Source of Truth (SSOT) Index

This document serves as the absolute index and map of the Single Source of Truth (SSOT) for all aspects of the **Softomedia Live 2026** platform.

## How to Use This Document
* **When to consult:** Reference this document before developing any new feature, debugging an issue, or starting a refactoring task.
* **How to update:** If a new system-wide configuration, singleton class, database schema, or core service is introduced, append a new entry to the appropriate section.
  * **Required fields:** File path/directory link, a clear description of what it governs, and its role as a Single Source of Truth (SSOT).
* **Reference Rules:** Always respect user rules in [.agent/rules/](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/.agent/rules/) (e.g., `permanance-rules.md` for permanent logs, `this-folder.md` for GCP constraints).

---

## 1. Roles, Personas, and Authorization (RBAC)

### Frontend Role Taxonomy & Levels
* **Single Source of Truth:** [roles.js (Frontend)](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/client-app/src/constants/roles.js)
* **Description:** Contains the frontend `ROLES` enum, the `ROLE_HIERARCHY` mapping, and the `normalizeRole` helper function used across all React client components.

### Backend Role Taxonomy & Levels
* **Single Source of Truth:** [roles.js (Backend)](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/constants/roles.js)
* **Description:** Contains the backend `ROLES` enum, the `ROLE_HIERARCHY` mapping, and the `normalizeRole` helper function mirroring the frontend constants to enforce Express route authorization.

### Auth Middleware (JWT & Demo Mode Bypass)
* **Single Source of Truth:** [auth.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/middleware/auth.js)
* **Description:** Governs backend API authentication, JWT token verification, and role-based route authorization. Under demo configuration (`ALLOW_DEMO_MODE=true`), processes simulated user context using incoming `x-demo-role` bypass headers.

### E2E Test Personas & Seeded Resource IDs
* **Single Source of Truth:** [personas.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/tests/fixtures/personas.js)
* **Description:** Defines the list of active mock user personas (`superadmin`, `admin`, `retaileradmin`, `brand`, `advertiser`, `techoperator`) with their stable UIDs, roles, emails, and linked entity IDs. Also lists the exact database seeded IDs (`SEED`) utilized across the Playwright E2E suites.

---

## 2. Networking, API Contracts & Configuration

### API Base URL Configuration
* **Single Source of Truth:** [config.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/client-app/src/config.js)
* **Description:** Centralized endpoint configuration resolving the VITE_API_URL prefix dynamically at runtime.

### HTTP Client Singleton (Authorization & Interceptors)
* **Single Source of Truth:** [api.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/client-app/src/services/api.js)
* **Description:** APIClient singleton managing outbound request interceptors (token injection, x-demo-role headers) and network retries.

### Registered API Endpoints & Auth Requirements
* **Single Source of Truth:** [API_ROUTES.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/API_ROUTES.md)
* **Description:** The definitive table mapping every HTTP verb, route path, required request payload, auth guard middleware, and source file for the Ad Server API.

### Frontend Routing and Path Selection
* **Single Source of Truth:** [App.jsx](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/client-app/src/App.jsx)
* **Description:** Authoritative declaration of all client-side layout routes, nested view structures, and lazy-loaded component endpoints.

---

## 3. Database Schema, Repositories, & Seeding

### Database Repositories (Backend Data Access)
* **Single Source of Truth:** [ad-server/src/repositories/](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/repositories/)
* **Description:** Repository classes (e.g., `AdvertiserRepository.js`, `LoopRepository.js`, `ScreenRepository.js`) acting as the exclusive layer interacting with Firestore documents. No inline Firestore calls allowed in controllers.

### Firestore Collections & Field Attributes
* **Single Source of Truth:** [DATABASE_SCHEMA.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/DATABASE_SCHEMA.md)
* **Description:** Details all Firestore collection shapes, sub-documents (e.g., Slot structures), soft-delete (`deleted_at`) mechanics, lowercase status value enums, and backfill execution rationales.

### Database Composite Indexes
* **Single Source of Truth:** [firestore.indexes.json](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/firestore.indexes.json)
* **Description:** Configures active multi-field composite indexes required by staging/production Firestore queries.

### Resilience Infrastructure (CircuitBreaker)
* **Single Source of Truth:** [ResilienceUtility.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/utils/ResilienceUtility.js)
* **Description:** Resilience infrastructure wrapping Firestore database operations. Implements circuit breakers and backoff retries to handle transient service faults while allowing expected DB codes (`ALREADY_EXISTS`, `NOT_FOUND`) to propagate cleanly without tripping the breaker.

### Seed Service (Demo Data Lifecycle)
* **Single Source of Truth:** [SeedService.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/services/SeedService.js)
* **Description:** Orchestrates backend database seeding, clean teardowns, and resource-safety assertions. Coordinates dynamic slot offsets and default entity creation during testing setup.

---

## 4. Business Logic & Pricing Engine

### Business Hours resolution Services
* **Single Source of Truth:** [BusinessHoursService.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/services/BusinessHoursService.js)
* **Description:** Business service calculating effective opening and closing times for stores including weekly defaults and special holiday overrides.

### CPM Pricing Formula & Multipliers
* **Single Source of Truth:** [CPM_PRICING_MODEL.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/CPM_PRICING_MODEL.md)
* **Description:** Details the master CPM pricing calculation, overrides priority tree, time-of-day traffic tiers, and date/store multipliers.

### Broadcast Loop Structure & Limits
* **Single Source of Truth:** [LOOP_ARCHITECTURE.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/LOOP_ARCHITECTURE.md)
* **Description:** Establishes the 14-hour daily grid, 12-slot hourly limits, 60s total duration restrictions, and fallback broadcasting behaviors.

---

## 5. E2E Testing & Playwright Specifications

### Page Object Model (POM) Locator Mappings (Code-as-Authority)
* **Single Source of Truth:** [tests/demo_wizard/*_locators.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/tests/demo_wizard/)
* **Description:** **Absolute canonical source of truth for all testing IDs/selectors.** Contains the centralized dictionary files mapping physical `data-testid` values for admin dashboards, brand wizards, and retailer views. Downstream specs must load keys from these files directly. (Static markdown checklists are deprecated to prevent synchronization drift).

### Playwright Orchestration Config
* **Single Source of Truth:** [playwright.config.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/playwright.config.js)
* **Description:** Primary orchestration file for Playwright E2E suites. Specifies target browser profiles, parallel workers, timeouts, HTML report generators, and WebServer processes (ad-server and client-app).

### Demo Fixtures & Auth Helpers
* **Single Source of Truth:** [demo.fixtures.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/tests/demo_wizard/demo.fixtures.js)
* **Description:** Shared utility functions mapping high-level test behaviors. Exports user login simulations, dynamic viewport handlers, base URL variables, and standard persona configs.

### Local E2E Testing Strategy & Prerequisites
* **Single Source of Truth:** [massivee2e_playbook.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/massivee2e_playbook.md)
* **Description:** Detailed playbook outlining local test preconditions, JWT refresh workflows, server startup steps, and manual vs. automated testing scripts.

### Full 17-Phase E2E Demo Wizard Flow
* **Single Source of Truth:** [massivee2e.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/massivee2e.md)
* **Description:** Maps out the chronological step-by-step gold path covering all user personas in a unified 17-phase system workflow demonstration.

### E2E Gap Closure & Coverage Verification
* **Single Source of Truth:** [massivee2e_consolidated.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/massivee2e_consolidated.md)
* **Description:** Tracks the coverage analysis mapping frontend routes and backend APIs against explicit Playwright assertions.

### Playwright UI DB Setup plan
* **Single Source of Truth:** [playwright_db_setup.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/playwright_db_setup.md)
* **Description:** Outlines page object model refactoring timeline, ARIA role mapping, and Visual Database (Storybook) specifications.

---

## 6. Sprint Backlog, Operations, & Guardrails

### Active Tasks & Remediation Status
* **Single Source of Truth:** [CONSOLIDATED_MASTER_PLAN.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/CONSOLIDATED_MASTER_PLAN.md)
* **Description:** Combined backlog of current sprint tasks, infrastructure backfills, and MVP gap remediation checklists.

### Sprint Operator Step-by-Step System
* **Single Source of Truth:** [SPRINT_OPERATOR.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/SPRINT_OPERATOR.md)
* **Description:** The SRE/QA lead operational workflow regulating session execution steps, repository checks, and outcome criteria.

### Active Sprint Guardrails
* **Single Source of Truth:** [GUARDRAILS.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/GUARDRAILS.md)
* **Description:** Absolute developer rules covering anti-hallucination checks, atomic migrations, payload standards, and CI gates.

---

## 7. Architectural Decisions & Remediation Plans

### Multiple Sources of Truth (MSOT) Debt Audit
* **Single Source of Truth:** [architecture_msot_report.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/architecture_msot_report.md)
* **Description:** Maps out the duplicate state keys, manual fetch bypasses, role strings fragmentation, and validation gaps across the platform.

### Demo Role vs. Active Persona Key Conflict
* **Single Source of Truth:** [active_personaVSdemo_role.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/active_personaVSdemo_role.md)
* **Description:** ADR explaining the shadowing of active persona keys by demo role defaults, detailing the root causes and correct alignment hooks.

### State Validation Vulnerability Solutions
* **Single Source of Truth:** [state_validation_solution.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/current_sprint/state_validation_solution.md)
* **Description:** Remediation details for frontend ghost state assumptions, silent drops on API mutations, and time-dependent player fallbacks.

### E2E Test Failures Analysis & Silencing Report
* **Single Source of Truth:** [player_loops_problem.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/player_loops_problem.md)
* **Description:** Outlines physical root causes, symptoms, and skipping actions for E2E integration test failures in the primary codebase, including the date-dependent loop lookup conflict.

### SRE Incident Reports
* **Single Source of Truth:** [sre-reports/](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/sre-reports/)
* **Description:** Directory holding post-mortem SRE stability and incident reports generated automatically during Analytical Mode failures in the master verification run.

---

## 8. Permanent Project History Records

### Post-Incident Reviews & Lessons Learned
* **Single Source of Truth:** [LESSONS_LEARNED.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/LESSONS_LEARNED.md)
* **Description:** *Permanent Record.* Actionable post-incident findings, bug reports, and systemic design updates. **Do not overwrite.**

### Project Changelog
* **Single Source of Truth:** [CHANGELOG.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/CHANGELOG.md)
* **Description:** *Permanent Record.* Chronological release notes capturing features, security improvements, and sprint remediations. **Do not overwrite.**

---

## 9. Operational Workflows, Guardrails, & Agent Rules

### Operational Slash Commands & Workflows
* **Single Source of Truth:** [.agent/workflows/](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/.agent/workflows/)
* **Description:** Directory containing standardized markdown workflows (`/build`, `/flush`, `/smoke-test`, `/layers`, `/hygiene`, `/validate-testids`, etc.) that guide agent execution, testing, deployment, and operational procedures.

### Permanent Project Rules & Boundaries
* **Single Source of Truth:** [.agent/rules/](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/.agent/rules/)
* **Description:** Systemic user rules defining documentation permanence constraints (e.g., `permanance-rules.md` protecting LESSONS_LEARNED/CHANGELOG) and explicit deployment boundaries (e.g., `this-folder.md` limiting operations to GCP project `softomedia-live-2026`).
