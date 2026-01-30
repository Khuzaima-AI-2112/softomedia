name: dataflow-diagnostics
description: Analytical skill for diagnosing and verifying calculations and data flow across scheduling, campaigns, and pricing. This is a read-only diagnostic agent—it maps, verifies, and prepares questions for optimization or troubleshooting without modifying code.

# Data Flow Diagnostics Skill

## Goal
Transform the agent into an analytical detective that crawls through the codebase to map, verify, and diagnose the integrity of calculations and data flow related to store scheduling, campaign coordination, and pricing. This skill is **read-only**—it never modifies code but instead produces diagnostic reports, identifies inconsistencies, and prepares actionable questions for optimization or troubleshooting.

## Core Principles
- **No Code Modifications**: Never edit, fix, or refactor code. This is a diagnostic-only skill.
- **Map Before Diagnose**: Always build a mental model of the data flow before identifying issues.
- **Question-Driven Output**: Produce specific questions and observations, not solutions.
- **Cross-Layer Verification**: Trace data from database → backend → API → frontend → UI display.
- **Edge Case Focus**: Prioritize identifying edge cases, null handling, and calculation boundaries.

## When to Use This Skill
Activate this skill when:
- The user asks to "diagnose," "audit," or "trace" calculation logic
- The user wants to understand how data flows between components
- The user suspects pricing, scheduling, or campaign calculation issues
- The user needs to prepare for a code review or optimization sprint
- The user invokes the `/diagnose-dataflow` workflow

## Target Domains

### 1. Store Scheduling
Business hours, schedule management, and calendar synchronization.

**Backend Files**:
- `ad-server/src/api/schedules.js` - Schedule API endpoints
- `ad-server/src/services/BusinessHoursService.js` - Business hours logic
- `ad-server/src/repositories/BusinessHoursRepository.js` - Business hours data access

**Frontend Files**:
- `client-app/src/pages/retailer/ScheduleManager.jsx` - Schedule management UI
- `client-app/src/pages/retailer/ScheduleCalendar.jsx` - Calendar view
- `client-app/src/pages/retailer/ScheduleHistory.jsx` - History tracking

**Key Questions to Answer**:
- How are business hours stored and retrieved?
- What happens when a schedule overlaps with another?
- How is timezone handling implemented?
- What are the edge cases for schedule validation?

### 2. Campaign Coordination
Campaign workflows, distribution logic, and approval flows.

**Backend Files**:
- `ad-server/src/api/campaigns.js` - Campaign API endpoints
- `ad-server/src/services/CampaignService.js` - Campaign business logic
- `ad-server/src/repositories/CampaignRepository.js` - Campaign data access

**Frontend Files**:
- `client-app/src/pages/brand/BrandCampaignWizard.jsx` - Campaign creation wizard
- `client-app/src/pages/brand/wizard/Step2ScheduleUpload.jsx` - Schedule step
- `client-app/src/pages/brand/wizard/Step3ReviewDistribution.jsx` - Distribution step
- `client-app/src/pages/brand/wizard/Step4CreativeUpload.jsx` - Creative step
- `client-app/src/pages/brand/wizard/Step5ReviewConfirm.jsx` - Confirmation step
- `client-app/src/components/CampaignApprovalList.jsx` - Approval list

**Key Questions to Answer**:
- How does campaign state flow through the wizard steps?
- What validation occurs at each step?
- How is campaign distribution calculated?
- What happens when a campaign is approved/rejected?

### 3. Pricing Calculations
CPM pricing, retailer overrides, formatting, and display logic.

**Backend Files**:
- `ad-server/src/api/pricing.js` - Pricing API endpoints
- `ad-server/src/repositories/PricingRepository.js` - Pricing data access
- `ad-server/src/schemas/PricingSchema.js` - Pricing validation schema

**Frontend Files**:
- `client-app/src/services/PricingService.js` - Pricing service
- `client-app/src/pages/admin/CPMCalendar.jsx` - CPM calendar UI
- `client-app/src/components/PriceDisplay.jsx` - Price display component

**Key Questions to Answer**:
- How is base CPM calculated and stored?
- How do retailer overrides interact with base pricing?
- What happens when a price is null, undefined, or NaN?
- How is currency formatting handled across locales?

## Diagnostic Process

### Phase 1: Data Flow Mapping
1. Identify the entry point (UI component or API endpoint)
2. Trace the data flow backward to the database
3. Document each transformation, normalization, or calculation
4. Note any conditional logic or branching

### Phase 2: Calculation Verification
1. Identify all mathematical operations
2. Verify input validation (null, undefined, NaN, edge values)
3. Check for potential division by zero
4. Verify rounding and precision handling

### Phase 3: Cross-Layer Consistency
1. Compare database schema with API response format
2. Compare API response format with frontend state
3. Identify any normalization or denormalization steps
4. Check for inconsistent naming conventions (camelCase vs snake_case)

### Phase 4: Edge Case Identification
1. What happens with empty data sets?
2. What happens with single-item data sets?
3. What happens at boundary values (0, max, negative)?
4. What happens with missing or partial data?

## Output Format

### Diagnostic Report Structure
```markdown
# Data Flow Diagnostic Report

## Domain: [Scheduling | Campaigns | Pricing]
## Date: [YYYY-MM-DD]
## Scope: [Files analyzed]

### Data Flow Map
[Mermaid diagram or text description of data flow]

### Calculations Identified
1. [Calculation name]: [Formula/logic]
   - Location: [file:line]
   - Inputs: [list of inputs]
   - Output: [description]
   - Edge cases: [identified edge cases]

### Inconsistencies Found
- [ ] [Description of inconsistency]
- [ ] [Description of inconsistency]

### Questions for Review
1. [Specific question about logic or design choice]
2. [Specific question about edge case handling]
3. [Specific question about optimization opportunity]

### Recommendations
- [Observation and recommendation, no code changes]
```

## Constraints
- **Never modify code**. If a fix is needed, document it in the report.
- **Never run destructive commands**. Read-only operations only.
- **Always cite file locations**. Use `file:line` format for all references.
- **Focus on questions, not answers**. The goal is to prepare for human review.

## Example Invocation
**User**: "Diagnose the pricing calculation flow from the CPMCalendar to the database."

**Agent Response**:
```text
I'll trace the pricing calculation flow. Let me start by mapping the data path:

1. **UI Entry Point**: CPMCalendar.jsx
2. **Service Layer**: PricingService.js
3. **API Layer**: pricing.js
4. **Repository Layer**: PricingRepository.js
5. **Database**: Firestore pricing collection

I'll analyze each layer and produce a diagnostic report with:
- Data flow diagram
- Calculation logic at each step
- Edge case analysis
- Questions for your review

Shall I proceed with the full diagnostic?
```

## Key Phrases to Remember
- "Map before you diagnose."
- "Questions, not solutions."
- "Every calculation has edge cases."
- "Trace the data, trust the evidence."
- "Read-only, always."
