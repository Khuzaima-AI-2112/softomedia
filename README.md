# softomedia-live2026 — Digital Screen Network Management Platform

Welcome to **softomedia-live2026**! This repository houses the full-stack Digital Screen Network & Ad Server management platform.

---

## 🏗️ Architecture Overview

The system is structured as a decoupled monorepo containing two core services:

* **Ad Server (`ad-server/`)**: Express.js REST API backend handling campaign management, retailer approval, screen player heartbeats and Proof of Play, CPM pricing, Support Tickets, and Firestore and Cloud Storage persistence. Users sign in with Firebase Authentication; Screens authenticate with their own device keys.
* **Client App (`client-app/`)**: Modern React (Vite) single-page application providing UI dashboards for Super Admins, Brand Managers, and Screen Operators.

---

## 📋 Prerequisites

Before getting started, ensure you have installed:

1. **Node.js**: `v18.x` or `v20.x` (LTS recommended)
2. **npm**: `v9.x` or higher
3. **Google Cloud SDK (`gcloud`)**: Required for Cloud Build & Cloud Run operations (Project ID: `softomedia-live-2026`).
4. **Firebase CLI**: Install via `npm install -g firebase-tools` (used for local Firestore rules emulator).

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
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
NODE_ENV=development
PORT=8080
CLIENT_PORT=5173
```

The demo reset and persona provisioning variables are described in `.env.example`.
There is no demo token, custom JWT or demo mode: every request signs in through
Firebase Authentication (or the Auth emulator locally).

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

Most backend suites sign in for real and need the Firebase emulators; see
[`docs/TESTING.md`](docs/TESTING.md). Firestore and Storage security rules:
```bash
npm run test:rules
```

### Reproducible Demo Baseline

Provision the seven prepared Firebase accounts once, using a password supplied
through a secure environment variable:

```bash
npm --prefix ad-server run provision:demo-personas
```

For each walkthrough, set `GOOGLE_CLOUD_PROJECT`, `DEMO_PROJECT_ID`, and
`DEMO_ASSETS_BUCKET` to that project's Firebase default bucket, then run:

```bash
npm run reset:demo
```

The reset refuses a missing or mismatched project. It replaces only Firestore
documents marked with the `phase-1-demo` reset scope and objects below the
`phase-1-demo/` bucket prefix. Firebase accounts, user profiles, infrastructure,
and unrecognized business records or storage objects are preserved.

Run the complete reset contract against local Auth, Firestore, and Storage
emulators with:

```bash
npm run test:demo-reset
```

### End-to-End (E2E) Tests
Run Playwright browser tests. The script starts the Firebase emulators and both dev servers:
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
Authentication needs no application secret: the server verifies Firebase ID tokens
with its Google Cloud credentials. The retired `JWT_SECRET` (issue #13) and the AI
service's `GEMINI_API_KEY` (issue #12) are no longer used.

> 🔒 **Security Policy**: Never commit `.env` or production secrets to Git. Secret Manager injects runtime secrets into Cloud Run containers dynamically during Step 5 of Cloud Build.

---

## 📁 Key Project Files & Documentation

* **Environment Setup Guide**: [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md)
* **Developer IAM Onboarding Guide**: [`docs/DEVELOPER_ONBOARDING_IAM.md`](docs/DEVELOPER_ONBOARDING_IAM.md)
* **API Route Specifications**: [`docs/API_ROUTES.md`](docs/API_ROUTES.md)
* **Database & Firestore Schema**: [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)
* **Cloud Build Pipeline**: [`cloudbuild.yaml`](cloudbuild.yaml)
* **Lessons Learned Log**: [`docs/LESSONS_LEARNED.md`](docs/LESSONS_LEARNED.md)

---

## 🛠️ Troubleshooting & FAQ

### 1. `Not allowed by CORS` Error
* **Cause**: Browser request origin (e.g. `http://localhost:5173`) is not listed in `CORS_ORIGINS`.
* **Fix**: Ensure `CORS_ORIGINS` in `.env.development` includes `http://localhost:5173`.

### 2. Client App Shows `Failed to fetch`
* **Cause**: `client-app` cannot connect to `ad-server`.
* **Fix**: Ensure `ad-server` is running on port 8080 (`npm run dev:server`) and `VITE_API_URL` points to `http://localhost:8080`.

### 3. Port Conflict (EADDRINUSE: 8080 or 5173)
* **Cause**: Another service or orphaned node process is using port 8080 or 5173.
* **Fix**: Identify and terminate the process listening on that port or specify a different `PORT` in `.env.development`.

