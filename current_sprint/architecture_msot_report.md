# Architectural Review: Multiple Sources of Truth (MSOT)

Based on a codebase scan, the fragmented "active_persona vs demo_role" pattern in test fixtures is just one symptom of a broader architectural pattern. We have several significant instances of Multiple Sources of Truth (MSOT) along other vectors. 

Below is a map of these vectors and the associated technical debt.

---

## 1. Auth State and Persona Identities
Even after resolving the `active_persona`/`demo_role` conflict in the E2E test fixtures, the production frontend codebase still fragments the source of truth for "who the user is."

* **The Problem:** 
  The app provides a centralized `AuthContext.jsx` intended to be the single source of truth for the current user session (`user.role`). However, several components bypass this entirely and read directly from local storage.
* **Instances:**
  - `client-app/src/pages/retailer/ScheduleCalendar.jsx` (lines 82, 111, 139): `const role = localStorage.getItem('active_persona');`
  - `client-app/src/pages/LoopDemoPlayer.jsx` (line 20): `return localStorage.getItem('demo_role') || localStorage.getItem('active_persona')`
  - `client-app/src/services/api.js` (line 200): Intercepts fetch calls by looking for `localStorage.getItem('demo_role') || localStorage.getItem('active_persona')`.

> [!WARNING]
> By bypassing the React `AuthContext`, these components will not react to state changes (like a user logging out or switching personas) unless a hard page reload occurs.

## 2. API Communication & Request Headers
The application has a central `APIClient` class, but it is not universally adopted.

* **The Problem:** 
  `client-app/src/services/api.js` defines an `APIClient` instance with request interceptors that automatically append `Authorization` and `x-demo-role` headers to every outbound request. However, large portions of the frontend ignore this client and use native `fetch()`.
* **Instances:**
  - `client-app/src/pages/admin/AILog.jsx`
  - `client-app/src/pages/Player.jsx`
  - `client-app/src/pages/tech/TechOpsDashboard.jsx`
  - `client-app/src/pages/tickets/TicketDashboard.jsx`
* **Consequence:** 
  Developers using raw `fetch()` must manually duplicate header logic, authentication tokens, and the `API_URL` prefix. If the auth mechanism changes (e.g., from `x-demo-role` to standard JWTs), every raw `fetch` call will break.

## 3. Environment & API URL Pathing
There is a central configuration file (`client-app/src/config.js`) that defines `API_URL` (falling back to `http://localhost:8080`).

* **The Problem:**
  While components import `API_URL`, the *pathing* structure is duplicated and fragmented.
* **Instances:**
  - Most components: ``fetch(`${API_URL}/api/...`)``
  - Ghost API calls: ``fetch(`${API_URL}/ghost-api/...`)``
  - `SupportTicketModal.jsx`: Uses string manipulation to fix bad pathing: ``fetch(`${API_URL.replace('/api', '')}/ghost-api/tickets`)``

## 4. Role Strings (RBAC)
Role strings are hardcoded magic strings scattered throughout the entire stack.

* **The Problem:** 
  There is no central `Roles` enum. The definitions of "what roles exist" are redefined wherever they are used.
* **Instances:**
  - Backend: `if (role === 'admin' || role === 'superadmin')` (`invoices.js`, `screens.js`, `users.js`).
  - Frontend: `const isSuperAdmin = user?.role === 'superadmin';` (`Overview.jsx`, `UserManagement.jsx`).
  - Frontend Dropdowns: Hardcoded strings like `'retaileradmin'` and `'advertiser'` in `UserManagement.jsx`.

> [!TIP]
> **Recommendation:** Create a `shared/enums/roles.js` (or similar) that both the Node.js backend and React frontend can import to centralize the role taxonomy.

## 5. Domain Schemas and Data Validation
The shape of your domain entities (Advertiser, Retailer, Campaign) is defined implicitly in multiple places.

* **The Problem:**
  With the exception of `PricingSchema.js`, there is no centralized validation layer (like Joi or Zod) in the backend `schemas/` directory.
* **Instances:**
  - `ad-server/src/api/advertisers.js`: Hardcodes validation rules directly in the Express route handler (`if (!name || typeof name !== 'string') { ... }`).
  - Frontend components duplicate these assumptions in their form validation states.
  - Test fixtures `tests/fixtures/factories.js` assume a shape.
* **Consequence:** 
  If a new required field is added to "Advertiser", it must be manually updated in the Express route handler, the Frontend forms, and the E2E test factories.

---

## Summary
The codebase relies heavily on **Implicit Contracts** rather than **Centralized Truths**. To achieve greater stability and eliminate cascade failures (like the PR #46 auth state bug), the architecture should transition toward:
1. A strict `eslint` rule blocking native `fetch` in favor of `apiClient`.
2. A single `RoleEnum` shared across the stack.
3. Centralized `Zod` or `Joi` schemas for data validation on the backend.
4. Forbidding direct `localStorage` reads in UI components in favor of `useAuth()` context hooks.
