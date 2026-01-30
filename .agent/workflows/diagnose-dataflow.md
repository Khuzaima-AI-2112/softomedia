---
description: Diagnose and verify calculations and data flow for scheduling, campaigns, and pricing
---

# Data Flow Diagnostics Workflow (`/diagnose-dataflow`)

This workflow activates the **dataflow-diagnostics** skill to perform a read-only audit of calculations and data flow across the store scheduling, campaign coordination, and pricing domains. The output is a diagnostic report with questions and observations—no code is modified.

## Quick Start
Run this workflow when you need to:
- Understand how data flows between backend and frontend
- Identify calculation logic and edge cases
- Prepare questions for optimization or troubleshooting
- Audit data integrity before a major release

---

## Phase 1: Scheduling Domain Audit

### 1.1 Business Hours Data Flow
// turbo
1. **Identify BusinessHoursService logic**:
   ```powershell
   Get-Content "ad-server/src/services/BusinessHoursService.js" | Select-String "function|export|async"
   ```

// turbo
2. **Identify schedule API endpoints**:
   ```powershell
   Get-Content "ad-server/src/api/schedules.js" | Select-String "router\.|app\."
   ```

// turbo
3. **Identify frontend schedule components**:
   ```powershell
   Get-ChildItem "client-app/src/pages/retailer" -Filter "Schedule*.jsx" | ForEach-Object { $_.Name }
   ```

---

## Phase 2: Campaign Domain Audit

### 2.1 Campaign Service Logic
// turbo
4. **Identify CampaignService methods**:
   ```powershell
   Get-Content "ad-server/src/services/CampaignService.js" | Select-String "function|export|async"
   ```

// turbo
5. **Identify campaign wizard steps**:
   ```powershell
   Get-ChildItem "client-app/src/pages/brand/wizard" -Filter "Step*.jsx" | ForEach-Object { $_.Name }
   ```

// turbo
6. **Check campaign approval component**:
   ```powershell
   Get-Content "client-app/src/components/CampaignApprovalList.jsx" | Select-String "approve|reject|pending"
   ```

---

## Phase 3: Pricing Domain Audit

### 3.1 Pricing Repository Logic
// turbo
7. **Identify PricingRepository methods**:
   ```powershell
   Get-Content "ad-server/src/repositories/PricingRepository.js" | Select-String "function|export|async"
   ```

// turbo
8. **Check pricing schema validation**:
   ```powershell
   Get-Content "ad-server/src/schemas/PricingSchema.js" | Select-String "z\."
   ```

### 3.2 Frontend Pricing Service
// turbo
9. **Identify PricingService methods**:
   ```powershell
   Get-Content "client-app/src/services/PricingService.js" | Select-String "function|export|async|=>"
   ```

// turbo
10. **Check CPMCalendar calculations**:
    ```powershell
    Get-Content "client-app/src/pages/admin/CPMCalendar.jsx" | Select-String "calculate|compute|Math\.|parseFloat|parseInt"
    ```

// turbo
11. **Check PriceDisplay formatting**:
    ```powershell
    Get-Content "client-app/src/components/PriceDisplay.jsx" | Select-String "format|toFixed|toLocaleString"
    ```

---

## Phase 4: Generate Diagnostic Report

After completing the above checks, compile findings into a diagnostic report:

12. **Create diagnostic report artifact**:
    - Summarize data flow for each domain
    - List all calculations identified
    - Document edge cases observed
    - Prepare specific questions for human review
    - Note any inconsistencies between layers

---

## Output
The workflow produces a **Diagnostic Report** with:
- Data flow diagrams (text or mermaid)
- Calculation inventory with file:line references
- Edge case analysis
- Questions for optimization/troubleshooting
- Recommendations (no code changes)

---

## Notes
- This is a **read-only** workflow. No files are modified.
- For deeper investigation, invoke the `dataflow-diagnostics` skill directly.
- Use `/layers` workflow for pricing-specific defense-in-depth verification.
