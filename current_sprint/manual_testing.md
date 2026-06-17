# Manual Testing & Full Lifecycle Demo Guide

Yes, absolutely. The platform is specifically wired to allow you to do exactly this end-to-end demo, but you don't do it all from just the Super Admin dashboard.

Because this is a multi-tenant MVP, the developers built a built-in Persona Switcher (the colored buttons at the top of the UI) specifically so you can demo the full lifecycle seamlessly without having to log in and out.

Here is the exact "Gold Path" script you can use to give a full, flawless demo today:

### 1. Act 1: The Super Admin (Setup)
- Select the **Super Admin** Persona.
- Go to **Retailer Management**: Add a new Retailer, then add a Store location under them.
- Go to **Screen Management**: Register a new Screen and assign it to the Store you just created.
- Go to **Advertiser Management**: Add a new Advertiser/Brand.
- Go to **Loop Management**: Click **Generate Loops** to create broadcast inventory for the target date. *(Critical: You must generate loops before an advertiser can book slots).*

### 2. Act 2: The Advertiser (Content & Campaigns)
- Click the Persona Switcher to become the **Advertiser / Brand**.
- Notice how your dashboard completely shifts.
- Click **New Campaign** to open the `CampaignWizard`.
- Select the exact Retailer and Dates you just set up, upload an ad creative (MP4 or JPG), and submit it. *(The system will constrain the advertiser from picking locations they aren't allowed to).*

### 3. Act 3: The Retailer (Validation & Brand Safety)
- Click the Persona Switcher to become the **Retailer**.
- Go to the **Campaign Approvals** or **Schedule Manager** tab.
- You will see the Advertiser's submitted content waiting in the queue.
- Click **Approve** *(This demonstrates the mandatory Brand Safety Validation rule)*.

### 4. Act 4: The Admin (Scheduling & Broadcasting)
- Click the Persona Switcher to go back to **Admin**.
- Navigate to **Loop Management** / **Loop Builder** (`/dashboard/admin/loops`).
- You can now show the audience the generated 12-slot, 60-second broadcast loop for that specific screen, and visually prove that the Advertiser's content was slotted securely into the schedule only after the retailer approved it.

### 5. Act 5: The Playback Demo (Visual Proof)
- Switch to the **Super Admin** Persona.
- Go to the **Demo Player** using the navigation menu.
- Use the drop-down cascade to select the exact Retailer, Store, and Screen you configured.
- Select the demonstration date and click **Play Full Day**.
- Watch the 12-slot hourly loop cycle through, proving that the mock creative renders exactly where the advertiser booked it.

The codebase fully supports all of these CRUD operations and playback visualisations natively right now. You are ready to give this demo.

---

## 6. QA Notes: Running on a Live Server (Staging/Production)

By default, the Persona Switcher relies on an `x-demo-role` HTTP header and a `Bearer demo-token` to seamlessly bypass the real JWT login system. 

The backend (`ad-server/src/middleware/auth.js`) has this strict safeguard built in:
`const isDemoAllowed = process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';`

**What this means for QA and Deployment:**
1. **Production Mode:** If you deploy to a live environment normally (`NODE_ENV=production`), the Persona Switcher will intentionally **fail** and return `401 Unauthorized` errors. This is an active security measure to ensure real production data cannot be manipulated.
2. **Live Presentation / Staging Mode:** If you deploy to a live staging server and want to give a public URL demo to a client, you MUST add `ALLOW_DEMO_MODE=true` into the environment variables. This safely unlocks the Persona Switcher bypass on the live URL.
