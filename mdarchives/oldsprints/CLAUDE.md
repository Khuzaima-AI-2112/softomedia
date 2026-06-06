# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**softomedia-live2026** is a digital signage and advertising network platform with CPM-based pricing. It consists of:
- **ad-server**: Node.js/Express backend API with Firestore database
- **client-app**: React/Vite frontend with Tailwind CSS
- **tests**: Playwright E2E test suite

**Project naming distinction**:
- Local package name: `softomedia-live2026`
- GCP Project ID: `softomedia-live-2026`
- **Requirement**: Always include `--project softomedia-live-2026` flag in all gcloud/firebase CLI commands

## Commands

### Development
```bash
# Backend (port 8080)
cd ad-server && npm run dev

# Frontend (port 5173)
cd client-app && npm run dev
```

### Testing
```bash
# Backend unit tests (Jest)
cd ad-server && npm test
cd ad-server && npm run test:coverage

# Frontend unit tests (Vitest)
cd client-app && npm test
cd client-app && npm run test:coverage

# E2E tests (Playwright) - run from root
npm run test:e2e
npm run test:e2e:headed          # with browser visible
npm run test:e2e:ui              # Playwright UI mode

# Run single E2E test file
npx playwright test tests/specific_test.spec.js
```

### Linting
```bash
npm run lint                     # lint both services
cd ad-server && npm run lint
cd client-app && npm run lint
```

### Database
```bash
cd ad-server && npm run seed     # seed Firestore database
```

### Deployment
```bash
gcloud builds submit --config cloudbuild.yaml --project softomedia-live-2026 .
```

## Architecture

```
Client (React/Vite)  →  API (Express)  →  Firestore + Cloud Storage
     :5173                 :8080              GCP Resources
```

### Backend Structure (ad-server/src/)
- **api/**: Route handlers (auth, ads, campaigns, loops, playlists, screens, pricing, etc.)
- **services/**: Business logic (PlaylistService, LoopGenerationService, BusinessHoursService)
- **repositories/**: Data access with BaseRepository pattern for CRUD operations
- **schemas/**: Zod validation schemas
- **utils/**: firestore.js, logger.js (Winston), ResilienceUtility.js

### Frontend Structure (client-app/src/)
- **pages/**: Route pages organized by persona (admin/, brand/, retailer/, tech/)
- **components/**: Reusable UI components
- **services/**: API clients (api.js, PricingService.js, TelemetryService.js)
- **stores/**: Zustand state stores
- **contexts/**: React contexts (AuthContext.jsx)

### Key Domain Concepts
- **Loops**: Pre-generated hourly ad sequences (D-1 scheduling)
- **Playlists**: Fallback content when loops aren't available
- **CPM Pricing**: Traffic tier-based pricing with retailer overrides

## Critical Rules

### Documentation Permanence
- `lessons_learned.md` and `changelog.md` are permanent records - never delete, only append
- Consult `lessons_learned.md` before starting new tasks

### Code Patterns
- **ES Modules**: Use `await import()` for dynamic imports; `__dirname` unavailable (use `fileURLToPath`)
- **Zod v4**: Requires explicit key schema: `z.record(z.string(), ValueSchema)`
- **ESM Mocking**: Define `jest.unstable_mockModule` BEFORE any imports
- **Repository Pattern**: Routes → Services → Repositories (never skip the service layer)
- **Firestore**: Always use async/await, never `.then()` chains

### Testing
- E2E tests run with `workers: 1` (serial) to prevent server overload
- Add `data-testid` attributes to interactive elements following pattern: `[component]-[element]-[action]`
- Use `aria-hidden="true"` on Material Icons inside buttons
- Auth setup requires: `active_persona`, `auth_token`, `auth_user`, `demo_role` in localStorage

### Frontend-Backend Contract
- Backend uses `snake_case`, frontend expects `camelCase` - normalize in repositories
- Use optional chaining (`?.`) and fallbacks for API data
- Vite env vars must be prefixed with `VITE_`

## Workflow Commands

The `.agent/workflows/` directory contains workflow definitions. Key ones:
- **/bigtest**: Full verification suite (lint, security, tests) - analytical mode, generates SRE reports on failure
- **/build**: Commit, push, and deploy to Cloud Run

## Environment Variables

### ad-server
- `JWT_SECRET` (required - no fallbacks allowed)
- `GEMINI_API_KEY` (for AI features)
- `CORS_ORIGINS` (comma-separated list)
- `PORT` (default: 8080)

### client-app
- `VITE_API_URL` (default: http://localhost:8080)

## Key Technical Lessons

1. **Branch coverage > line coverage** for logic-heavy code
2. **Soft validation (warnings) over hard validation (errors)** for user-facing rules
3. **Runtime config injection** for Vite builds (not build-time env vars)
4. **Circuit breaker + exponential backoff with jitter** for external dependencies
5. **Global "deny all" Firestore rules** even when using Admin SDK
6. **Deep health checks** that verify dependencies, not just server up status
