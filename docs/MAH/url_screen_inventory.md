# URL & Screen Inventory - Softomedia Live 2026

This inventory provides a comprehensive map of all application routes, user access levels, and UI states for QA and auditing purposes.

## 1. Public & Player Routes
These routes are accessible without a standard dashboard session, primarily for playback hardware or public demonstrations.

| # | URL Path | Page / Screen Name | User Role(s) | Auth Required | Page State / Variant | Notes |
|---|----------|--------------------|--------------|---------------|----------------------|-------|
| 1 | `/player` | Live Screen Player | Screen / Guest | No | Loading, Empty (No Loop), Active Playback, Error (Connection) | The primary playback engine for physical hardware. Reads from `loops` and `media`. |
| 2 | `/player/demo` | Loop Demo Player | Guest / Brand | No | Loading, Active Playback, Controls Overlay | A simulation of the player for advertisers to preview their campaigns. |
| 3 | `/` | Root Redirect | All | No | Redirect | Redirects to `/dashboard`. |

## 2. Administrative Dashboard (Admin Persona)
Protected routes for platform-wide management.

| # | URL Path | Page / Screen Name | User Role(s) | Auth Required | Page State / Variant | Notes |
|---|----------|--------------------|--------------|---------------|----------------------|-------|
| 4 | `/dashboard/admin` | Admin Overview | Admin | Yes | Loading, Populated (KPIs) | High-level network health and performance metrics. Reads multiple collections. |
| 5 | `/dashboard/admin/screens` | Screen Management | Admin | Yes | Loading, Table View, Empty, Modal (Register Screen), Confirm Delete | Fleet monitoring and provisioning. Reads/Writes `screens`. |
| 6 | `/dashboard/admin/playlists`| Playlist Management| Admin | Yes | Loading, Table View, Filtered | List of all global and assigned playlists. Reads `playlists`. |
| 7 | `/dashboard/admin/playlists/new` | Playlist Editor (Create)| Admin | Yes | Form (Empty), File Uploading, Saving | Drag-and-drop playlist builder. Writes to `playlists` and `media`. |
| 8 | `/dashboard/admin/playlists/:id` | Playlist Editor (Edit) | Admin | Yes | Form (Populated), Loading | Edit existing playlist metadata and sequence. |
| 9 | `/dashboard/admin/loops` | Loop Management | Admin | Yes | Loading, Date Picker, Grid View | Daily scheduling grid for screens. Reads `loops`. |
| 10| `/dashboard/admin/loops/:id`| Loop Builder | Admin | Yes | Loading, Slot Grid, Sidebar (Assets), Modal (Book Slot) | Manual slot booking and override tool. Writes to `loops`. |
| 11| `/dashboard/admin/analytics`| Loop Analytics | Admin | Yes | Loading, Chart View, Table View | Impression and play-count tracking. Reads `impressions`. |
| 12| `/dashboard/admin/map` | Network Map | Admin | Yes | Map View, Marker Cluster, Sidebar info | Visual display of screen locations. Reads `screens` and `stores`. |
| 13| `/dashboard/admin/pricing` | CPM Calendar | Admin | Yes | Calendar View, List View, Modal (Edit Config) | Dynamic pricing management. Reads/Writes `pricing_config`. |
| 14| `/dashboard/admin/users` | User Management | Admin | Yes | Table View, Empty, Modal (Add/Edit User), Role Filter | IAM control. Reads/Writes `users`. |
| 15| `/dashboard/admin/retailers`| Retailer Management| Admin | Yes | Table View, Detail View (Expandable), Modal (Add/Edit) | B2B relationship management. Reads/Writes `retailers` and `stores`. |
| 16| `/dashboard/admin/hours` | Business Hours | Admin | Yes | Loading, Weekly Table, Form (Edit) | Global Store availability settings. Reads/Writes `store_default_hours`. |
| 17| `/dashboard/admin/advertisers`| Advertiser Management| Admin | Yes | Table View, Modal (Add/Edit), Logo Picker | Brand/Agency management. Reads/Writes `advertisers`. |
| 18| `/dashboard/admin/ai-log` | AI Diagnostic Log | Admin | Yes | Loading, Streaming Text, Analysis Result | Gemini-powered system health analysis. Interfaces with AI Client. |

## 3. Advertiser Dashboard (Brand Persona)
Routes for brands to manage their ad spend and creatives.

| # | URL Path | Page / Screen Name | User Role(s) | Auth Required | Page State / Variant | Notes |
|---|----------|--------------------|--------------|---------------|----------------------|-------|
| 19| `/dashboard/brand` | Brand Dashboard | Advertiser | Yes | Loading, KPI Row, Empty (Tip), Table View | Overview of active campaigns and spend. Reads `campaigns`. |
| 20| `/dashboard/brand/campaign/new` | Campaign Wizard | Advertiser | Yes | Stepper (1-4), File Upload, Date Picker, Success Panel | End-to-end booking flow for new ads. Writes to `campaigns` and `loops`. |

## 4. Retailer Dashboard (Retailer Persona)
Routes for store owners to manage their local network.

| # | URL Path | Page / Screen Name | User Role(s) | Auth Required | Page State / Variant | Notes |
|---|----------|--------------------|--------------|---------------|----------------------|-------|
| 21| `/dashboard/retailer` | Retailer Dashboard | Retailer | Yes | Loading, Stats, Store List | Performance and uptime for specific retailer stores. |
| 22| `/dashboard/retailer/schedule`| Schedule Manager | Retailer | Yes | Loading, Table View, Filter | View what's playing on specific screens. |
| 23| `/dashboard/retailer/schedule/calendar`| Schedule Calendar | Retailer | Yes | Calendar View | Timeline view of content scheduling. |
| 24| `/dashboard/retailer/history`| Playback History | Retailer | Yes | Table View, CSV Export? | Historical logs of screen impressions. |

## 5. Technical & Support Routes
System-level monitoring and ticket management.

| # | URL Path | Page / Screen Name | User Role(s) | Auth Required | Page State / Variant | Notes |
|---|----------|--------------------|--------------|---------------|----------------------|-------|
| 25| `/dashboard/tech` | Tech Ops | Tech / Admin | Yes | Hardware Stats, Error Log, Health Badges | Real-time monitoring of screen fleet. |
| 26| `/dashboard/health` | System Health | SRE / Admin | Yes | Service Status, Dependency Test, Latency Graph | Latency and connectivity checks for API/DB. |
| 27| `/dashboard/tickets` | Ticket Dashboard | Tech / Admin | Yes | Table View, Status Columns, Filter | Support queue for hardware/content issues. |
| 28| `/dashboard/tickets/:id`| Ticket Detail | Tech / Admin | Yes | Reading Mode, Comment Thread, Status Change | Granular ticket management. |

## Technical Implementation Details

### 1. Lazy Loading & Code Splitting
The platform uses **React.lazy** for almost all top-level components to ensure fast initial bundle loads.
- Components are wrapped in a global `Suspense` boundary in `App.jsx`.
- Fallback UI: A fullscreen dark/light themed spinner.

### 2. Authentication & Guarding
- **Auth Guard**: Handled within `DashboardLayout.jsx`. 
- **Persona Context**: User roles are managed via `AuthContext.js` and persisted in `localStorage`.
- **Automatic Redirection**: Accessing `/dashboard` without a sub-path automatically redirects the user based on their specific `persona` (e.g., `/dashboard/admin`).

### 3. Layouts & Shells
- **Dashboard Shell**: All routes under `/dashboard/*` share the `DashboardLayout`, which includes:
    - Sticky unified header with `AdManager` branding.
    - `HamburgerMenu` for mobile-responsive navigation.
    - `PersonaSwitcher` (Demo Feature) for quick role swapping.
    - `SafeWidgetLoader` for ghost/AI assistant overlay.
    - Error Boundary wrapping the entire main content `Outlet`.

### 4. Catch-all / 404 Routes
- There is currently no explicit 404 page; however, `DashboardLayout` includes a top-level `ErrorBoundary` to catch rendering failures. 
- The router handles internal redirects for root paths but relies on standard browser handling for undefined top-level paths outside of `/dashboard` and `/player`.
