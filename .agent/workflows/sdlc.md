---
description: Execute numbered SDLC prompts from SDLC-Prompts.md
---

# SDLC Prompt Workflow

This workflow is automatically triggered when you type `SDLC##n` where `n` is a prompt number (1-19).

## How It Works

When you type `SDLC##n` (e.g., `SDLC##1`, `SDLC##12`):

1. I will open and read the `SDLC-Prompts.md` file
2. I will locate the prompt with the specified number
3. I will extract the full prompt text for that number
4. I will execute that prompt against the current codebase

## Available Prompts

The SDLC-Prompts.md file contains 19 comprehensive prompts organized by frequency:

### ⭐ High-Frequency Prompts (Every Sprint/Deployment)
- **SDLC##1**: Architecture and Code Quality Review
- **SDLC##2**: Deployment-Readiness / Glue Issues Review
- **SDLC##3**: Build Artifacts, File Inclusion & Caching Review
- **SDLC##4**: Test Strategy & Coverage Review
- **SDLC##5**: Observability, Logging, and On-Call Readiness
- **SDLC##6**: Security & Secrets Hygiene Review
- **SDLC##7**: API Contract & Integration Review

### 📋 Medium-Frequency Prompts (Monthly or Before Major Releases)
- **SDLC##8**: Release & Change Management Review
- **SDLC##9**: Performance, Load & Capacity Review
- **SDLC##10**: Reliability Engineering Review (SLOs, Error Budgets, Rollouts)
- **SDLC##11**: Database Deployment & Wipe Strategy
- **SDLC##12**: Firebase Production Readiness, Deployment & Security Review

### 🔧 Low-Frequency Prompts (Quarterly or Special Occasions)
- **SDLC##13**: Requirements & Scope Validation
- **SDLC##14**: Incident Response + Postmortem Learning
- **SDLC##15**: Dependency / Supply Chain Security & License Compliance
- **SDLC##16**: Data Governance, Privacy, and Retention Review
- **SDLC##17**: Accessibility & UX Production Readiness
- **SDLC##18**: Architecture Decision Records (ADR) + Technical Decision Quality Gate
- **SDLC##19**: App & Infrastructure Evolution Narrative

## Example Usage

Simply type in chat:
- `SDLC##1` - Runs Architecture and Code Quality Review
- `SDLC##2` - Runs Deployment-Readiness Review
- `SDLC##12` - Runs Firebase Production Readiness Review

## Notes

- Most prompts are optimized for **Claude Opus 4.5 (Thinking)** for best results
- Prompts will be executed with full access to the current codebase
- Results may include implementation plans, checklists, and concrete action items
