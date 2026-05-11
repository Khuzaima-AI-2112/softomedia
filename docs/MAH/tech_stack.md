# Softomedia Live 2026 - Tech Stack Documentation

This document outlines the full technology stack for the Softomedia Live ad-serving platform.

## 1. Frontend (client-app)
A modern, performant web application built for administrators, retailers, and advertisers.

*   **Framework**: [React 18](https://reactjs.org/) (Functional components with Hooks)
*   **Build Tool**: [Vite 5](https://vitejs.dev/) for ultra-fast development and optimized production builds.
*   **Styling**: 
    *   [Tailwind CSS v4](https://tailwindcss.com/) for utility-first styling.
    *   Glassmorphism-driven design system with custom `GlassCard` components.
*   **State Management**: 
    *   [Zustand](https://github.com/pmndrs/zustand) for lightweight, predictable global state.
    *   React Context API for theme and auth providers.
*   **Routing**: [React Router v7](https://reactrouter.com/) (Data APIs).
*   **Icons & Assets**: 
    *   [Lucide React](https://lucide.dev/) for consistent, modern icons.
    *   [Material Symbols](https://fonts.google.com/icons) for system-level administrative icons.
*   **Utilities**: 
    *   `html2canvas` for UI-to-image capture (for reports/screenshots).
    *   `react-markdown` for rendering dynamic documentation and guides.

## 2. Backend (ad-server)
A scalable, JSON-based REST API designed for high availability and resilience.

*   **Runtime**: [Node.js](https://nodejs.org/) (ES Modules).
*   **Framework**: [Express.js](https://expressjs.com/).
*   **Security & Auth**:
    *   [JSON Web Token (JWT)](https://jwt.io/) for stateless authentication.
    *   `bcryptjs` for secure password hashing.
    *   `cors` and `helmet` (via best practices) for cross-origin and header security.
    *   `express-rate-limit` for DDoS and brute-force protection.
*   **Validation**: [Zod](https://zod.dev/) for strict TypeScript-like schema validation of API requests and database documents.
*   **AI Integration**: [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) (Gemini Pro) for loop optimization and automated diagnostic analysis.
*   **Resilience**: 
    *   **Circuit Breaker Pattern**: Custom implementation in `ResilienceUtility.js` to protect against Firestore latencies and external API failures.
    *   **Retry Logic**: Exponential backoff for network-dependent operations.

## 3. Database & Persistence
Leveraging Google Cloud's cloud-native serverless databases.

*   **Primary Database**: [Google Cloud Firestore](https://cloud.google.com/firestore) (Native Mode).
    *   NoSQL document store for highly scalable, real-time data access.
    *   Custom **Repository Pattern** for centralized data logic.
*   **Object Storage**: [Google Cloud Storage](https://cloud.google.com/storage).
    *   Used for hosting high-resolution images and videos for ad campaigns.
*   **Local Persistence**: In-memory `MOCK_STORAGE` fallback in `BaseRepository` for offline testing and rapid local prototyping.

## 4. Infrastructure & DevOps (Google Cloud Platform)
Fully automated CI/CD and serverless hosting environment.

*   **Hosting**: [Google Cloud Run](https://cloud.google.com/run).
    *   Containerized services for both the frontend and backend.
    *   Automatic scaling to zero to minimize costs during idle periods.
*   **CI/CD**: [Google Cloud Build](https://cloud.google.com/build).
    *   Automated build, test, and deploy pipelines defined in `cloudbuild.yaml`.
    *   Dockerized build environment for environment parity.
*   **Container Registry**: [Artifact Registry](https://cloud.google.com/artifact-registry).
*   **Secrets Management**: [Google Cloud Secret Manager](https://cloud.google.com/secret-manager).
    *   Centralized storage for `JWT_SECRET`, `GEMINI_API_KEY`, and API credentials.
*   **Environment Verification**: Custom `verify_predeploy.js` script to ensure environment readiness before code live-pushes.

## 5. Testing & Quality Assurance
Multi-layered testing strategy to ensure platform stability.

*   **End-to-End (E2E) Testing**: [Playwright](https://playwright.dev/).
    *   Automated browser testing across multiple viewport sizes and browsers.
*   **Unit & Integration Testing**: 
    *   **Frontend**: [Vitest](https://vitest.dev/) with React Testing Library.
    *   **Backend**: [Jest](https://jestjs.io/).
*   **Diagnostics**: 
    *   **Adversarial Critic**: Automated script to stress-test pricing logic and configuration drift.
    *   **Smoke Tests**: Lightweight health checks run post-deployment.

## 6. Observability
*   **Logging**: [Winston](https://github.com/winstonjs/winston) with transport to Google Cloud Logging.
*   **Health Checks**: `/health` endpoints on all services for real-time monitoring.
*   **Audit Trails**: Automatic `created_at` and `updated_at` timestamps on all Firestore records.
