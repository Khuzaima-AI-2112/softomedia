# softomedia-live2026 — Digital Screen Network Management Platform

Welcome to **softomedia-live2026**! This repository houses the full-stack Digital Screen Network & Ad Server management platform.

---

## 🏗️ Architecture Overview

The system is structured as a decoupled monorepo containing two core services:

* **Ad Server (`ad-server/`)**: Express.js REST API backend handling campaign management, screen player heartbeats, CPM pricing multipliers, AI generation routines (via Google Gemini), and Firestore integration.
* **Client App (`client-app/`)**: Modern React (Vite) single-page application providing UI dashboards for Super Admins, Brand Managers, and Screen Operators.

---

## 📋 Prerequisites

Before getting started, ensure you have installed:

1. **Node.js**: `v18.x` or `v20.x` (LTS recommended)
2. **npm**: `v9.x` or higher
3. **Google Cloud SDK (`gcloud`)**: Required for Cloud Build & Cloud Run operations (Project ID: `softomedia-live-2026`).
4. **Firebase CLI**: Install via `npm install -g firebase-tools` (used for local Firestore rules emulator).

---

## 🧭 Guided Setup (recommended)

Rather than working through the sections below by hand, run the rollout wizard. It walks
you through every step only a human can do — installs, browser logins, IAM grants, secret
creation — captures the values, writes `.env.development`, and finishes by proving the
rollout on both targets.

```bash
bash scripts/rollout-wizard.sh
```

Twelve stages: tooling → gcloud auth → **project guard** → APIs → Artifact Registry →
Secret Manager → IAM → Cloud Build trigger → `.env.development` → Firestore emulator →
prove local → prove Cloud. It is idempotent and re-runnable; stop with Ctrl-C at any
point and values already saved are offered back as defaults.

> ⚠️ Stage 3 refuses to continue unless `gcloud config get-value project` matches the
> deploy project exactly, and stage 12 re-checks immediately before submitting the build.
> See [`sre-reports/report-2026-06-22T03-52-30.md`](sre-reports/report-2026-06-22T03-52-30.md)
> for the incident that guard exists to prevent.

The manual instructions below remain accurate, and are the reference for anything the
wizard skips.

---

## 🚀 Local Development Quick Start

### 1. One-Command Setup
To install dependencies for all sub-services (`ad-server` and `client-app`) and download Playwright browser binaries, run:
```bash
npm run setup
```

### 2. Environment Configuration
Copy the environment template in the project root:
```bash
cp .env.example .env.development
```

The default `.env.development` configuration:
```env
VITE_API_URL=http://localhost:8080
JWT_SECRET=your-secure-random-jwt-secret
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
NODE_ENV=development
PORT=8080
CLIENT_PORT=5173
ALLOW_DEMO_MODE=true
```

> ⚠️ **Note**: `ad-server` requires `JWT_SECRET` on startup and will exit with an error if it is not set.

### 3. Running the Local Servers
Start the backend server and frontend client in separate terminals (or terminal tabs):

* **Backend (`ad-server`)**:
  ```bash
  npm run dev:server
  ```
  *(Runs Node.js server on `http://localhost:8080`)*

* **Frontend (`client-app`)**:
  ```bash
  npm run dev:client
  ```
  *(Runs Vite dev server on `http://localhost:5173`)*

---

## 🧪 Testing & Verification

### Unit Tests
Run backend Jest unit tests:
```bash
npm run test:unit
```

### End-to-End (E2E) Tests
Run Playwright browser tests (ensure the backend server is running on `http://localhost:8080` first):
```bash
npm run test:e2e
```
* **UI Mode**: `npm run test:e2e:ui`
* **Headed Mode**: `npm run test:e2e:headed`

---

## ☁️ GitHub & Cloud Build Trigger Pipeline

This project uses **Google Cloud Build** triggers connected to the GitHub repository to automate builds and deployments to **Google Cloud Run**.

```
GitHub Push / PR
      │
      ▼
Cloud Build Trigger (softomedia-live-2026)
      │
      ├── Step 0: Pre-deployment & Secret Verification (verify_predeploy.js)
      ├── Step 1-4: Build & Push Docker images (Artifact Registry)
      ├── Step 5: Deploy ad-server to Cloud Run + Poll /health
      ├── Step 6-7: Deploy Firestore Composite Indexes & Security Rules
      └── Step 8: Deploy client-app & Lock CORS Whitelist
```

### Key Secret Dependencies (GCP Secret Manager)
Deployments depend on two secrets stored in GCP Secret Manager under project `softomedia-live-2026`:
1. `JWT_SECRET`: Signing key for authentication tokens.
2. `GEMINI_API_KEY`: Key for AI generation capabilities.

> 🔒 **Security Policy**: Never commit `.env` or production secrets to Git. Secret Manager injects runtime secrets into Cloud Run containers dynamically during Step 5 of Cloud Build.

---

## 📁 Key Project Files & Documentation

* **Environment Setup Guide**: [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md)
* **Developer IAM Onboarding Guide**: [`docs/DEVELOPER_ONBOARDING_IAM.md`](docs/DEVELOPER_ONBOARDING_IAM.md)
* **API Route Specifications**: [`docs/API_ROUTES.md`](docs/API_ROUTES.md)
* **Database & Firestore Schema**: [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)
* **Cloud Build Pipeline**: [`cloudbuild.yaml`](cloudbuild.yaml)
* **Rollout Wizard**: [`scripts/rollout-wizard.sh`](scripts/rollout-wizard.sh)
* **Lessons Learned Log**: [`docs/LESSONS_LEARNED.md`](docs/LESSONS_LEARNED.md)

---

## 🛠️ Troubleshooting & FAQ

### 1. `JWT_SECRET environment variable is not set`
* **Cause**: `ad-server` exited on boot because `JWT_SECRET` was missing.
* **Fix**: Ensure `.env.development` exists in the project root with a defined `JWT_SECRET=your-secret` string (`cp .env.example .env.development`).

### 2. `Not allowed by CORS` Error
* **Cause**: Browser request origin (e.g. `http://localhost:5173`) is not listed in `CORS_ORIGINS`.
* **Fix**: Ensure `CORS_ORIGINS` in `.env.development` includes `http://localhost:5173`.

### 3. Client App Shows `Failed to fetch`
* **Cause**: `client-app` cannot connect to `ad-server`.
* **Fix**: Ensure `ad-server` is running on port 8080 (`npm run dev:server`) and `VITE_API_URL` points to `http://localhost:8080`.

### 4. Port Conflict (EADDRINUSE: 8080 or 5173)
* **Cause**: Another service or orphaned node process is using port 8080 or 5173.
* **Fix**: Identify and terminate the process listening on that port or specify a different `PORT` in `.env.development`.

