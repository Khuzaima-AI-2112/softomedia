# SRE Incident Report: Ghost AI 403 Forbidden Error

**Date**: 2026-01-25
**Status**: INVESTIGATING -> RESOLVED (Plan Proposed)
**Severity**: HIGH (Feature Outage)
**Component**: `ad-server` / `ghost-api`

## Incident Summary
Users reported receiving a "Ghost AI is not reachable from this location" error (HTTP 403) when attempting to use the "Start a Walkthrough" feature in the production environment (`client-app` -> `ad-server`).

## Root Cause Analysis
The `ad-server` implements a security middleware `guardrails` in `services/ai-guardrails.js` that enforces a strict IP Allowlist.
- It checks `req.ip` against `process.env.DEV_ALLOWED_IP` or `localhost`.
- In the Cloud Run production environment, request IPs (user IPs) do not match the `DEV_ALLOWED_IP` (which is likely unset or set to a developer's IP).
- There is no exemption for production environment or valid application logic usage.

## Impact
- **Functionality**: The "Start a Walkthrough" (Gemini Context Assistant) feature is completely inaccessible in production.
- **User Experience**: Users see a red error banner "Analysis Failed".

## Proposed Solution (Fix)
Update `ad-server/services/ai-guardrails.js` to respect the `ALLOW_DEMO_MODE` environment variable (already present in `cloudbuild.yaml` deployment config) or `NODE_ENV=production` to bypass the IP check for this demo/public feature.

**Immediate Action**: Refactor `guardrails` to allow traffic when `ALLOW_DEMO_MODE === 'true'`.

## Prevention
- **Testing**: Add a "Smoke Test" for the AI endpoint in the `/bigtest` workflow (currently seemingly missing or skipped).
- **Parity**: Ensure `DEV_ALLOWED_IP` logic is only applied in `development` mode or strictly for admin endpoints, not user-facing features.
