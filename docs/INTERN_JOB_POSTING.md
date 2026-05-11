# 💼 Job Posting — Software Engineering Intern
## Softomedia | Digital Signage & Ad Network Platform

---

**Position**: Software Engineering Intern  
**Type**: Part-Time or Full-Time Internship  
**Location**: Remote (US preferred)  
**Duration**: 3–6 months (flexible)  
**Start Date**: Immediate / Rolling  
**Compensation**: Paid — negotiable based on experience

---

## 🚀 About Softomedia

Softomedia is building a **cloud-native digital signage and advertising network platform** — the operating system for out-of-home advertising. Brands create campaigns, Admins orchestrate broadcast schedules, Retailers approve ads for their screens, and Tech Ops monitors the fleet in real time.

The platform runs on **Google Cloud (Cloud Run + Firestore + Cloud Storage)** with a **Node.js/Express** backend, a **React/Vite** frontend, and a CI/CD pipeline through **Google Cloud Build**. This isn't a toy project — it's a live, deployed, multi-persona SaaS product.

---

## 🎯 What You'll Do

You'll be embedded in the core engineering workflow across three focus areas:

### 1. 🧪 QA & Test Engineering
- Write and maintain **Playwright end-to-end tests** across all four user personas (Admin, Brand, Retailer, Tech Ops)
- Expand **Vitest unit tests** for React components and **Jest tests** for backend services
- Identify, document, and regression-test bugs in campaign creation, loop generation, and pricing flows
- Improve test coverage reports and help triage failures in the CI/CD pipeline

### 2. 🔥 Firebase / Firestore Expansion
- Deepen the platform's **Firebase integration** — including Firebase Auth, Firestore Security Rules, and Firebase Analytics or Remote Config
- Design and implement **new Firestore collections and schemas** to support upcoming features (e.g., impressions analytics, user notification preferences, advertiser billing records)
- Write and test **Firestore Security Rules** to enforce role-based access at the database layer
- Seed and maintain realistic test data for development and QA environments

### 3. 🗄️ Database Architecture for New Functionality
- Collaborate on schema design for new domain features (e.g., reporting dashboards, billing/invoicing, multi-region screen groups)
- Implement **repository-layer data access patterns** following our established `BaseRepository` pattern in the backend
- Ensure all new collections have proper **Zod validation schemas** on the API layer
- Document new data models in the project's architecture docs

---

## 🛠️ Tech Stack You'll Work With

| Area | Tech |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Zustand |
| Backend | Node.js, Express, Zod |
| Database | Google Firestore (NoSQL) |
| Firebase Services | Firestore, Cloud Storage, (Auth, Analytics) |
| Testing | Playwright (E2E), Jest, Vitest |
| Cloud Infra | Google Cloud Run, Cloud Build, Secret Manager |
| Dev Tooling | ESLint, Winston logging, GitHub |

---

## 🤖 Vibecoding — Working with Our AI Agent System

We build with AI-assisted development as a first-class part of our workflow — not as a crutch, but as a disciplined practice. We call it **vibecoding**: the craft of directing, auditing, and collaborating with an AI coding agent to ship production-quality work.

As an intern, one of your responsibilities will be to **review and improve our agent infrastructure** — the ruleset that governs how the AI behaves on this codebase.

### What This Looks Like in Practice

Our `.agent/` directory contains the guardrails that shape every AI-assisted change:

| Component | What It Does |
|---|---|
| **Skills** | Behavior modules the agent activates for specific tasks |
| **Workflows** | Step-by-step slash-command protocols (e.g., `/build`, `/bigtest`, `/smoke-test`) |
| **Rules** | Hard constraints the agent must always follow (e.g., never delete `lessons_learned.md`) |

### Current Agent Skills You'll Work With

- **`diligent-coder`** — Enforces approval gates before any build, deploy, or destructive command. No silent execution.
- **`test-driven-developer`** — Ensures every new UI component ships with `data-testid` attributes and a test stub.
- **`test-auth-guardian`** — Validates auth state is correctly set up before E2E tests run.
- **`test-id-guardian`** — Confirms test selectors in Playwright specs actually exist in the component tree.
- **`dataflow-diagnostics`** — Detects schema desync between E2E mocks and backend API contracts.

### What You'll Do in This Area

- **Audit existing skills** for gaps, ambiguity, or outdated behavior
- **Propose and draft new skill definitions** based on recurring pain points you observe
- **Review workflow triggers** to ensure the right guardrails fire at the right time
- **Document insights** in `lessons_learned.md` — our permanent project memory

### The Philosophy

> *"Deliberation is faster than recovery."*

We don't let the agent run unchecked. The intern will be expected to **think critically about AI output** — flagging when it violates a guardrail, suggesting when a new rule is needed, and helping us improve the feedback loop between human intent and agent behavior.

This is rare, practical experience in **AI-augmented software development** — a skill set that will set you apart.

