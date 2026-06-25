# Product Manager Clarification Questions: Loops, Schedules & Pricing

This document outlines key technical gaps, inconsistencies, and security vulnerabilities identified in the **Softomedia Live 2026** codebase regarding the implementation of loop playback, scheduling, and pricing configuration.

---

## 1. Loop System vs. Player Playlist Delivery Disconnect

### Context & Implementation
* **Documented Behavior ([LOOP_ARCHITECTURE.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/LOOP_ARCHITECTURE.md)):** 
  Loops are hourly cycles consisting of exactly 12 advertising slots (5 seconds duration each, 60 seconds total loop cycle) generated per store-date and approved by the Retailer Admin.
* **Code Implementation ([PlaylistService.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/services/PlaylistService.js)):**
  The physical media player pulls ad rotations from `/api/playlist/:screenId` which is handled by `PlaylistService.getPlaylistForScreen(screenId)`. This service checks:
  1. Dedicated active playlists assigned to the screen in the `playlists` collection.
  2. The system-wide global fallback playlist.
  3. A legacy ad rotation model querying the `ads` collection by matching the current hour string (e.g., `'08:00 AM'`).
  
### The Gap
There is no database reference or integration between `PlaylistService` and the generated/approved `loops` collection. Approved daily loops are completely ignored by the media player's playlist generation logic.

### Question for PM
> **Is the physical media player on screens intended to play the approved hourly loops generated in the Retailer Command Center? If so, should we refactor the player's delivery service to serve approved loops as a fallback/primary source before defaulting to legacy random ad rotation?**

---

## 2. Loops vs. Previews Slot Counts Inconsistency

### Context & Implementation
* **Code Implementation ([schedules.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/schedules.js)):**
  * The schedule preview endpoint (`/api/schedules/preview`) generates simulated slots for the calendar using **6 slots of 10 seconds** duration instead of the strict 12 slots of 5 seconds:
    ```js
    ads: Array(6).fill(null).map((_, i) => ({
        slotString: `${String(h).padStart(2, '0')}:${String(i * 10).padStart(2, '0')}`,
        duration: 10
    }))
    ```
  * The mock schedule route (`GET /api/schedules`) returns rule schemas containing internal contradictions:
    ```js
    rules: {
        loop_duration: 60,
        slot_duration: 5,
        max_ads: 6  // 60 / 5 should be 12, but max_ads is constrained to 6
    }
    ```

### The Inconsistency
The active generation engine (`LoopGenerationService.js`) enforces exactly 12 slots of 5s, whereas the schedule preview API assumes 6 slots of 10s.

### Question for PM
> **What is the canonical loop/slot structure for schedules and previews? Should the schedule preview generate 12 slots of 5 seconds (matching active loops), or are retailers allowed to configure custom loop slot limits (e.g., 6 slots of 10s)?**

---

## 3. Pricing API Overrides Privilege Escalation

### Context & Implementation
* **Code Implementation ([pricing.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/pricing.js#L90-L104)):**
  The global pricing configuration updates (`PUT /api/pricing/config`) require administrative authorization guards. However, the date-specific override creation endpoint does not:
  ```js
  router.post('/overrides', authenticate, async (req, res) => { ... })
  ```

### The Vulnerability
Any authenticated low-privilege user (including standard `advertiser` or `brand` accounts) can invoke `POST /api/pricing/overrides` to inject pricing overrides for any date.

### Question for PM
> **Should the `POST /api/pricing/overrides` endpoint be restricted to `admin` and `superadmin` roles? Allowing advertiser-tier users to inject pricing overrides appears to be a privilege escalation vulnerability.**

---

## 4. Pricing Model Hierarchy and API Parameter Mismatch

### Context & Implementation
* **Documented Behavior ([CPM_PRICING_MODEL.md](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/docs/CPM_PRICING_MODEL.md)):**
  The Base CPM is determined by checking for overrides in this priority order: Screen-Level Override > Store-Level Override > Retailer-Level Override > Global Base CPM.
* **Code Implementation ([pricing.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/pricing.js#L137)):**
  * The calculation route invokes the repository via:
    ```js
    const pricing = await PricingRepository.calculateSlotPrice(hour, screenId);
    ```
    However, [PricingRepository.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/repositories/PricingRepository.js#L140) expects `calculateSlotPrice(hour, dateStr = null)`.
  * The repository parses `screenId` as a date string, causing date override queries to fail or evaluate incorrectly.
  * There is currently **no implementation** in the repository to retrieve and apply screen-level, store-level, or retailer-level base CPM overrides. It only references global base CPM and date multipliers.
  * The `/calculate` API does not accept a `date` query parameter, meaning date multipliers cannot be processed dynamically.

### The Gap
The code treats the screen ID as a date string, completely lacks base CPM override hierarchy resolution, and does not accept a date parameter for calculation.

### Question for PM
> **Should we refactor the pricing calculation logic to support screen, store, and retailer-level overrides as documented in the CPM model? Additionally, should the `/calculate` API be updated to accept a `date` parameter and correctly pass the date separate from the screen ID?**

---

## 5. Loop Generation Business Hours Truncation

### Context & Implementation
* **Code Implementation ([LoopGenerationService.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/services/LoopGenerationService.js)):**
  The generation logic parses opening and closing times by splitting the strings on colons and discarding minutes:
  ```js
  startHour = parseInt(effectiveHours.open_time.split(':')[0], 10);
  endHour = parseInt(effectiveHours.close_time.split(':')[0], 10);
  ```

### The Edge Case
If a store operates on non-hourly boundaries (e.g., 08:30 AM to 09:30 PM), the service generates loops from 8:00 AM to 9:00 PM. This causes active loops to run when the store is closed, and leaves open hours without active schedules.

### Question for PM
> **How should loops be generated when business hours do not align to whole hours (e.g., 8:30 AM – 9:30 PM)? Should we round to the nearest whole hour, generate partial loops, or enforce that business hours must be aligned to whole hours at the UI/validation level?**

---

## 6. Dead / Corrupted Code Hygiene in `loops.js`

### Context & Implementation
* **Code Implementation ([loops.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/loops.js#L211-L217)):**
  Lines 211–217 contain a JSDoc block `/**` that has no closing `*/` tag due to a previous deletion. As a result, the remainder of the route section (up to the next valid comment closure on line 229) is treated as a single comment, containing corrupted and orphaned code blocks.

### Question for User/PM
> **Would you like me to clean up the dead JSDoc block in [loops.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/loops.js) to restore clean repository hygiene?**

---

## 7. Executive Summary & PM-Friendly Conclusion

Here is a simplified, non-technical translation of the key challenges and discrepancies for product-level discussion:

### A. The Disconnected Screen Player (Topic 1)
* **What's happening:** When a Retailer Admin logs in and approves a specific daily schedule or playlist loop, the physical ad player screens do not actually read that loop. Instead, the player defaults to playing generic placeholder playlists or random ads.
* **Product Decision:** Do we want physical store screens to play the custom loop schedules created and approved by Retailer Admins? If so, we need to update the player software to check for and load these approved loops first.

### B. Conflicting Ad Time Limits (Topic 2)
* **What's happening:** The logic that generates ad slots expects exactly **12 ads of 5 seconds each** per hour block. However, the preview calendar shown to users is configured to display **6 ads of 10 seconds each**. This creates visual mismatch and confusion.
* **Product Decision:** Should the calendar preview be updated to match the 12-ad, 5-second rotation model, or do we want to allow retailers to customize these timings (e.g., shorter loops with longer ads)?

### C. Pricing Security Leak (Topic 3)
* **What's happening:** Normal advertisers can technically access administrative pricing settings and create their own custom price overrides for any date.
* **Product Decision:** We should restrict the ability to create price overrides exclusively to system Administrators/Super Admins to prevent unapproved discount injection.

### D. Missing Pricing Options & Lookup Bugs (Topic 4)
* **What's happening:** The pricing model document mentions that we can override default base prices specifically for individual screens, stores, or retailers. Currently, the code has no ability to calculate or fetch these specific overrides, defaulting only to global pricing. In addition, the lookup mechanism gets confused between "dates" and "screens," breaking holiday pricing lookup.
* **Product Decision:** Do we need to build support for screen, store, and retailer pricing overrides in this sprint, and should we correct the code mismatch so holiday price multipliers resolve correctly?

### E. Store Hours with Odd Minutes (Topic 5)
* **What's happening:** If a store opens or closes on a half-hour (for example, opening at 8:30 AM or closing at 9:30 PM), the loop generation system truncates the minutes and generates schedules starting at 8:00 AM or ending at 9:00 PM. This causes ads to be scheduled when the store is closed, or not scheduled when it is open.
* **Product Decision:** How should scheduling handle half-hour boundaries? Should the system round up/down to the nearest hour, schedule shorter loops, or should we restrict the portal so store hours must always align to the exact hour?
---

## 8. Consolidated Questions

Here is the list of key decisions required from the Product Manager:

1. **Screen Playback:** Should physical display screens play the custom hourly loop schedules generated and approved by Retailer Admins? (Currently, screens ignore retailer approvals and play fallback playlists).
2. **Loop Slot Format:** Should schedule previews and loop designs be unified on the standard 12 slots of 5 seconds each, or should they support custom formats (like 6 slots of 10 seconds)?
3. **Price Override Security:** Should the ability to create date-specific pricing overrides be restricted strictly to Administrators and Super Admins? (Currently, any logged-in advertiser can modify them).
4. **Custom Pricing Options:** Do we need to build support for screen-level, store-level, and retailer-level base price overrides in this sprint?
5. **Holiday Price Lookup:** Should we fix the code mismatch causing screen IDs to be mapped as date overrides during pricing calculations?
6. **Odd-Minute Scheduling:** How should schedule generation handle stores opening or closing on half-hours (e.g., 8:30 AM – 9:30 PM)? Should we round the hours, schedule partial loops, or require stores to open/close on exact hours?


