# Digital Screen Network Management Platform - User Training Guide

Welcome to the Softomedia Digital Screen Network. This guide tracks the core workflows for **Admins**, **Brands**, **Retailers**, and **Tech Ops**.

---

## 🔐 Accessing the Platform

Use the **Persona Switcher** in the top-right corner of the dashboard to toggle between roles for demonstration and training purposes:
- **Admin**: Full network control.
- **Brand**: Ad campaign creation.
- **Retailer**: Store-level schedule view.
- **Tech**: System health monitoring.

---

## 🏢 For Super Admins
**Goal**: Manage the network fleet and orchestrate daily broadcasts.

### 1. Network Overview & Map
- Navigate to **Dashboard > Overview**.
- Use the **Network Map** button to see a geospatial view of all active screens.
- Use the **New Retailer** button to onboard a new retail partner (opens the registration modal).

### 2. Managing Screens
- Navigate to **Dashboard > Screens**.
- **Add Screen**: Click "Register Screen" to provision a new device.
- **Delete Screen**: Click the **Trash Icon** next to a screen to permanently remove it (requires confirmation).
- **Status**: Monitor online/offline status in real-time.

### 3. Orchestration (Loop Generation)
- Navigate to **Dashboard > Loops**.
- Select a **Target Date** using the date picker.
- Click **"Generate Loops for [Date]"** to create the D-1 broadcast schedule.
- Once generated, you can click "View Builder" to manually adjust specific slots.

---

## 🎨 For Brands & Advertisers
**Goal**: Create and launch advertising campaigns.

### Creating a New Campaign
1.  **Navigate**: Go to **Brand Dashboard** and click **"New Campaign"**.
2.  **Step 1: Locations**: Select the screens or regions where you want your ad to play.
3.  **Step 2: Schedule & Creative**:
    -   **Dates**: Pick your **Start Date** and **End Date** to define the campaign duration.
    -   **Upload**: Drag & drop your creative asset (Image or MP4).
        -   *Note: Ideally 5 seconds. If longer/shorter, you will see a warning but can proceed.*
    -   **Frequency**: Choose how often your ad plays per loop (e.g., **1x**, **2x**, or **3x**).
4.  **Step 3: Review**: Check the "Loop Distribution" preview to see exactly when your ad will air.
5.  **Launch**: Click **"Submit Campaign"** to send it for approval.

---

## 🏪 For Retail Partners
**Goal**: View what is playing in your store.

### Checking the Schedule
- Navigate to **Retailer Dashboard**.
- **Calendar**: View your monthly ad schedule.
- **Approvals**: If enabled, approve or reject third-party ads requested for your screens.

---

## 🛠️ For Tech Ops
**Goal**: Ensure system reliability and uptime.

### Health & Diagnostics
- **System Health** (`/dashboard/health`): Check the status of the Ad Server API, Cloud Storage, and Authentication services.
- **Tech Ops Dashboard** (`/dashboard/tech`): View a live inventory of all screens, identifying connection lost (`> 2m`) devices.

### Player Debugging
- Access the player directly at `/player`.
- **Dual Mode**:
    - **Loop Mode**: Plays the scheduled 12-slot loop during business hours (8 AM - 10 PM).
    - **Playlist Mode**: Falls back to a default playlist after hours or if no loop is generated.

---

## 🆘 Support
For technical issues, please contact the Softomedia SRE Team or check the **System Health** dashboard.
