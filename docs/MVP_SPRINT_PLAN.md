# MVP Development Sprint Plan

This document outlines the development roadmap for the Digital Screen Network Management Platform (MVP), organized into four 2-week sprints.

## Sprint 1: Foundation & Governance
**Focus**: User roles (RBAC) and network structure.

### Deliverables
- [ ] **Multi-tenant Core**: Database schema for softomedia, retailers, and advertisers.
- [ ] **RBAC Module**: Implementation of the 5 MVP roles with specific permissions.
- [ ] **Location Management**: CRUD for retail locations and store profiles.
- [ ] **Super Admin Dashboard**: Global view of retailers and agencies.

### Testing Strategy
- **Unit**: Test permission guards for each role.
- **Integration**: Verify retailer creation automatically initializes default location buckets.
- **Test Case 1.1**: Authenticate as Super Admin -> Create Retailer -> Verify Retailer Admin role can log in.

---

## Sprint 2: Media & Campaign Lifecycle
**Focus**: Asset management and campaign creation.

### Deliverables
- [ ] **CMS Asset Manager**: Upload JPG/PNG/MP4 with automatic 5-second validation.
- [ ] **Campaign Wizard**: Step-by-step creation (advertiser vs retailer campaigns).
- [ ] **Targeting Logic**: Assign campaigns to specific retail locations/groups.
- [ ] **Inventory Tracker**: Basic calculation of available loops/slots per hour.

### Testing Strategy
- **Unit**: Verify 5-second duration enforcement on video uploads.
- **Unit**: Validate file format rejections (e.g., Rejecting .GIF or .MOV).
- **Integration**: Create campaign -> Verify it appears in the "Pending Validation" queue for the assigned retailer.

---

## Sprint 3: The Scheduling Engine & Validation
**Focus**: Loop generation and mandatory retailer approval workflow.

### Deliverables
- [ ] **Loop Generator**: D-1 engine that builds 12-slot, 60-second loops for each hour.
- [ ] **Scheduler**: Orchestrate campaigns based on priority rules (Paid > Retailer > Internal).
- [ ] **Retailer Approval Portal**: UI for retailers to preview, approve, or reject hourly schedules.
- [ ] **Audit Log**: Track approval status and timestamp of all loop validations.

### Testing Strategy
- **Unit**: Test loop filling logic (ensuring no more than 12 ads per loop).
- **Integration**: Generate D-1 loops -> Verify notification sent to Retailer Admin.
- **E2E**: Retailer rejects Ad #4 -> Verify Ad #4 is replaced by fallback/internal ad in that hour's loop.

---

## Sprint 4: Fleet Monitoring & Performance
**Focus**: Screen health and proof-of-play analytics.

### Deliverables
- [ ] **Device Heartbeat**: Real-time monitoring of screen online/offline status.
- [ ] **Technical Ops Dashboard**: Remote restart and health diagnostics.
- [ ] **Proof-of-Play (PoP) Engine**: Logging of every ad broadcast per screen.
- [ ] **MVP Analytics**: Hourly broadcast logs and campaign performance summaries.

### Testing Strategy
- **Unit**: Test offline fallback logic (triggering internal loop if no connection).
- **Integration**: Simulate "Ad Played" signal from player -> Verify database entry in PoP table.
- **E2E**: Disconnect screen -> Verify "OFFLINE" alert in Technical Operator console within < 2 minutes.

---

## Summary of Quality Gates
| Gate | Description | Requirement |
| :--- | :--- | :--- |
| **Linting** | Static analysis | 0 Errors |
| **Unit Coverage** | Code coverage | > 80% on core services |
| **Integrations** | API Contract tests | Pass vs Mock Screen |
| **UX Review** | Manual validation | Approved by Product Owner |
