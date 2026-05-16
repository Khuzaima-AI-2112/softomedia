Digital Screen Network Management Platform
User Roles & Functionalities Specification
Purpose of this document
This document defines the different user roles and their associated functionalities for a digital screen network management platform. It is intended to serve as a functional reference for software designers and developers.

1. Platform Overview
The platform is designed primarily for the retail industry and enables Softomedia and its retail partners to jointly operate a network of digital screens deployed across retail locations.
The network is co-owned by Softomedia and the retailer:
Softomedia operates the platform, commercializes advertising inventory, orchestrates campaigns, and ensures technical reliability.
Retailers co-own the network, host the screens in their stores, validate all content prior to broadcast, and may run their own campaigns.
The broadcasting model is based on a fixed-loop scheduling logic, optimized for retail environments.
This document focuses on the prototype (MVP) required to demonstrate core value and operational feasibility.

2. User Roles Overview
The platform supports the following MVP user roles:
Super Administrator (Softomedia – Platform Owner)
Retailer Administrator (Retail Partner)
Softomedia Content & Campaign Manager
Advertiser / Agency User
Technical Operator (In-house CTO / Ops)
Roles such as advanced analysts or external viewers are considered post-MVP.

3. User Roles & Functionalities
3.1 Super Administrator (Softomedia – Platform Owner)
Description:
Softomedia internal role with full control over the platform, network, monetization, and governance.
Core Functionalities (MVP):
Create and manage retailer accounts
Create and manage advertiser / agency accounts
Full user & role management
Global platform configuration
Screen network ownership and governance
Campaign prioritization rules (paid vs retailer vs internal)
Monetization rules (inventory allocation, pricing logic – high level)
Global analytics and performance dashboards
Audit logs and security oversight

3.2 Retailer Administrator (Retail Partner)
Description:
Represents a retail organization hosting Softomedia screens in its locations.
Core Functionalities (MVP):
Manage retail locations and store profiles
View screens installed in their locations
Validate, approve, or reject advertising content before broadcast
Define local content constraints (categories allowed / excluded)
Launch optional retailer-owned campaigns (store promotions)
View performance metrics limited to their locations
Communicate feedback or issues to Softomedia

3.3 Softomedia Content & Campaign Manager
Description:
Softomedia internal role responsible for operational execution of campaigns and content.
Core Functionalities (MVP):
Upload and manage media assets (ads, promos, HTML5)
Create advertiser and retailer campaigns
Build playlists and assign inventory
Schedule campaigns by retailer, location, screen group, and time
Submit campaigns for retailer validation
Monitor campaign delivery and playback
Manage content lifecycle (active / paused / expired)

3.4 Advertiser / Agency User
Description:
Brands or agencies purchasing ad space from Softomedia.
Core Functionalities (MVP):
Upload ad creatives
Create campaign requests (budget, duration, targeting)
Select preferred retail locations (subject to availability)
Track campaign status (pending approval, live, completed)
View basic campaign performance metrics
Access invoices and campaign summaries

3.5 Technical Operator (In-house CTO / Ops)
Description:
Softomedia technical role managing installation, reliability, and platform stability.
Core Functionalities (MVP):
Register and provision new screens
Assign screens to retailers and locations
Monitor device health (online/offline, last heartbeat)
Remote restart and basic diagnostics
Software updates and configuration
Incident tracking and resolution

4. Core MVP Functional Modules
4.1 Broadcasting & Scheduling Engine (Core MVP)
Broadcasting is based on hourly loops
Each loop contains 12 ads
Each ad has a fixed duration of 5 seconds
Total loop duration: 60 seconds
The loop configuration changes every hour
Scheduling Rules:
Advertisers must submit creatives strictly in 5-second format (video or static image)
No variable ad duration in MVP
Each hour has a predefined loop (playlist)
Loops are generated one day in advance (D-1)

4.2 Campaign & Inventory Management
Centralized inventory management
Inventory allocation per loop and per hour
Distinction between:
Paid advertiser campaigns
Retailer-owned campaigns
Campaign priority rules defined by Softomedia

4.3 Retailer Validation Workflow (Mandatory)
Daily schedules (hourly loops) are generated the day before broadcast
Retailers receive a schedule preview per location
Retailers can:
Approve the full schedule
Reject specific ads
Request replacements
Only approved schedules are eligible for broadcast
Approval status is logged and auditable

4.4 Content Specifications & Compliance
Accepted formats: MP4 (video), JPG/PNG (image)
Fixed duration: 5 seconds
Resolution and aspect ratio enforced per screen type
Automatic rejection if specifications are not met

4.5 Device & Network Monitoring
Real-time screen status
Proof-of-play logging
Offline fallback loop
Alerting for failures

4.6 Analytics (MVP)
Proof-of-play per ad
Loop delivery confirmation
Hourly broadcast logs
Campaign-level summaries

3.7 Viewer / Read-only Analyst (Optional)
Description:
Has access to dashboards and reports without modification rights.
Core Functionalities:
View dashboards and KPIs
Export reports
Access historical performance data
No content or configuration modification rights

4. Cross-Role Functional Modules
These modules may be accessed differently depending on role permissions:
Content Management System (CMS)
Scheduling & Playback Engine
Device Management & Monitoring
Analytics & Reporting
Monetization & Billing
Workflow & Approval Engine
Security, Authentication & Audit Logs

5. Non-Functional Considerations (for Developers)
Role-Based Access Control (RBAC)
Multi-tenant architecture
Scalability for thousands of screens
High availability & offline fallback
Security (encryption, access logs)
API-first design

6. Next Steps (Optional Enhancements)
Audience measurement & sensors integration
Programmatic advertising
AI-driven content optimization
POS and retail media integrations
