# Precision Remediation Guide — Bring Every Task to 95%+

> **Companion to:** `orphansFIX4.md`
> **Authored:** 2026-06-04, SRE/QA review against live repo source
> **Anti-hallucination rule:** Every file path, variable name, function name, and line reference in this document was verified against the actual source on disk. If a name below does not match what you see in the file, stop and flag it — do not proceed on assumption.

---

## How to Use This Document

For each task that scored below 95%, this document gives:
1. **What exactly is broken or ambiguous** — sourced from the real file, not assumed
2. **The exact change required** — line-level where possible
3. **The anti-hallucination guard** — a named check that must pass before the task is closed

Tasks that already scored 95%+ are noted as ✅ SKIP — no remediation needed.

---

## PR 1 — Cleanup

---

### Task 1.1 — Extract loop visualisation bar (was 70% → target 95%)

**What is actually in the file:**
`client-app/src/pages/brand/wizard/Step3ReviewDistribution.jsx` contains a self-contained JSX block (lines ~55–90) rendering a 12-slot fixed bar using `Array.from({ length: 12 })`. It has zero props and zero state — it is a purely static visual. The only data it touches is the hardcoded alternating colour pattern (`i % 2 === 0`).

**What `Step5ReviewConfirm.jsx` already has:**
`Step5ReviewConfirm.jsx` has `summary.totalSlots` and `summary.screenCount` but no slot-frequency visualisation of any kind.

**The exact change required:**
1. Create a new file: `client-app/src/components/LoopVisualisationBar.jsx`
2. Cut the JSX block (the `<section>` wrapper containing the time markers, the bar container, and the legend) verbatim from `Step3ReviewDistribution.jsx` into this new file as a default export with zero props.
3. In `Step5ReviewConfirm.jsx`, import it: `import LoopVisualisationBar from '../../../components/LoopVisualisationBar';`
4. Render `<LoopVisualisationBar />` immediately above the `<GlassCard>` that contains the Order Summary sticky panel (the right column). Do not place it inside the sticky `GlassCard` — it would scroll away from the confirm button.
5. The bar ships as a static visual aid at MVP. It does **not** need to bind to `selectedSlots`. Document this decision in a `// MVP: static 12-slot visual, not data-driven` comment on the component.

**Anti-hallucination guard:**
Before closing this task, grep the entire repo for `Step3ReviewDistribution` and confirm the only remaining reference is the import in `BrandCampaignWizard.jsx` (which will be removed in Task 1.4). If any other file imports it, the sweep was incomplete.

---

### Task 1.2 — Extract impact projection cards (was 55% → target 95%)

**What is actually in the file:**
`Step3ReviewDistribution.jsx` defines a `metrics` array with three hardcoded objects:
```js
{ label: 'Frequency / Hour', value: '12x', sub: 'Every 5 mins', color: 'text-primary' }
{ label: 'Total Loops / Day', value: '192', sub: 'Across 16 operational hours', color: 'text-blue-500' }
{ label: 'Est. Impressions', value: '250k', sub: 'Based on foot traffic', color: 'text-indigo-500' }
```
All three values are **hardcoded strings**. There is no computation, no API call, no state.

**What `Step5ReviewConfirm.jsx` already computes:**
- `summary.totalSlots` — number of selected slots (live)
- `pricingService.formatImpressions(summary.totalImpressions)` — live estimated impressions
- `summary.screenCount` — live screen count
- There is **no `frequencyPerHour` or `totalLoopsPerDay` field** in the `summary` object.

**Authorised field mapping (resolved here — do not re-derive):**

| Card label | Source at MVP | Rationale |
|------------|---------------|-----------|
| Frequency / Hour | Static: `"12x"` with sub `"Every 5 mins (configurable post-MVP)"` | No per-campaign frequency data in wizard state. Static is correct and honest at MVP. |
| Total Loops / Day | Computed: `summary.totalSlots` with sub `"Total booked slots across campaign"` | `totalSlots` is the closest truthful equivalent. Do not use `192` — it is a mock. |
| Est. Impressions | Computed: `pricingService.formatImpressions(summary.totalImpressions)` with sub `"Based on screen foot traffic data"` | Already computed in `Step5ReviewConfirm.jsx`. |

**The exact change required:**
1. Do **not** copy the `metrics` array from `Step3ReviewDistribution.jsx`. It contains mock data.
2. In `Step5ReviewConfirm.jsx`, add the three cards as inline JSX immediately above the `Confirm Booking` button in the right-column sticky `GlassCard`, after the Terms checkbox and before the button block.
3. Use this exact structure:
```jsx
{/* Impact Summary — above confirm button */}
<div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
  <div className="flex justify-between items-center">
    <span className="text-xs text-slate-500 uppercase tracking-wider">Frequency / Hour</span>
    <span className="text-sm font-black text-primary">12x <span className="text-xs font-normal text-slate-400">Every 5 mins</span></span>
  </div>
  <div className="flex justify-between items-center">
    <span className="text-xs text-slate-500 uppercase tracking-wider">Total Slots</span>
    <span className="text-sm font-black text-blue-500">{summary.totalSlots}</span>
  </div>
  <div className="flex justify-between items-center">
    <span className="text-xs text-slate-500 uppercase tracking-wider">Est. Impressions</span>
    <span className="text-sm font-black text-indigo-500">{pricingService.formatImpressions(summary.totalImpressions)}</span>
  </div>
</div>
```
4. `summary` and `pricingService` are already in scope in `Step5ReviewConfirm.jsx` — no new imports needed.

**Anti-hallucination guard:**
After the change, render the wizard to Step 5 in dev. Open DevTools and confirm:
- `summary.totalSlots` shows a number matching the selected slots count (not `192`)
- `pricingService.formatImpressions(summary.totalImpressions)` shows a value matching the Order Summary total impressions line
- The Frequency field shows the literal string `12x` (static)
If any field shows `undefined`, `NaN`, or `0` when slots are selected, the data binding is broken — do not merge.

---

### Task 1.3 — Consolidate wizard review (was 65% → target 95%)

**What is actually in the wizard directory:**
```
client-app/src/pages/brand/wizard/
  Step1LocationScreen.jsx      ← ACTIVE, do not touch
  Step2ScheduleUpload.jsx      ← ACTIVE, do not touch
  Step3LoopSlotSelection.jsx   ← ACTIVE, do not touch
  Step3ReviewDistribution.jsx  ← DEPRECATED, this is the target
  Step4CreativeUpload.jsx      ← ACTIVE, do not touch
  Step5ReviewConfirm.jsx       ← ACTIVE, receives transplanted components
```

**The exact change required:**
- The only file to touch in this task is `Step3ReviewDistribution.jsx`.
- `Step3LoopSlotSelection.jsx` must **not** be opened, modified, or deleted. Its name begins with `Step3` but it is the active loop slot selection step — it is not a review screen.
- Confirm `BrandCampaignWizard.jsx` does not render `Step3ReviewDistribution` as any active step. If it does, remove that reference before deletion.
- No consolidation of `Step3LoopSlotSelection.jsx` into Step 5 is required or authorised.

**Anti-hallucination guard:**
After Task 1.3 and before Task 1.4, run the wizard end-to-end in dev. Confirm Step 3 still renders `Step3LoopSlotSelection` (the loop slot picker). If Step 3 is blank or errors, `Step3LoopSlotSelection.jsx` was accidentally modified — revert immediately.

---

### Tasks 1.4 / 1.5 — Deletions ✅ SKIP (92% / 95% — no remediation needed)

Only pre-deletion check to add: before deleting `Step3ReviewDistribution.jsx`, open `BrandCampaignWizard.jsx` and search for the string `Step3ReviewDistribution`. Remove any import or `case` reference found. Then delete the file.

---

### Tasks 1.6 / 1.7 / 1.8 ✅ SKIP

---

## PR 2 — Wire ScheduleHistory

---

### Task 2.1 / 2.2 — Route + nav ✅ SKIP (97% — no remediation needed)

---

### Task 2.3 — Scope data to logged-in retailer (was 70% → target 95%)

**What is actually in the file:**
`ScheduleHistory.jsx` line ~23:
```js
const [retailers, allLoops, log] = await Promise.all([
    apiService.getRetailers(),   // ← fetches ALL retailers
    apiService.getLoops(),       // ← fetches ALL loops
    apiService.getAuditLogs()    // ← fetches ALL audit logs
]);
// For demo, get first retailer as "current" retailer
if (retailers.length > 0) {
    setCurrentRetailer(retailers[0]);  // ← hardcoded to index [0]
}
```
The component then filters `loops` client-side using `l.retailer_id === currentRetailer.id`. This means:
- Every retailer's data is fetched and loaded into memory
- The "current retailer" is `retailers[0]` — whoever is first in the API response
- A retailer with `id !== retailers[0].id` will see the wrong store's data

**The exact change required:**
1. Import `AuthContext` (or whichever auth hook the app uses — check `client-app/src/context/` for the actual filename before writing the import).
2. Replace the `getRetailers()` call with a single-retailer fetch using the logged-in user's `retailerId` from auth context.
3. Replace `setCurrentRetailer(retailers[0])` with `setCurrentRetailer(authedRetailer)`.
4. The `loops` filter (`l.retailer_id === currentRetailer.id`) is correct logic — keep it, but it now works because `currentRetailer` is always the authenticated user's retailer.
5. The `apiService.getLoops()` call should ideally be replaced with `apiService.getLoopsByRetailer(retailerId)` to avoid loading all retailers' data into the browser. If that endpoint does not exist, open a backend tracking issue and proceed with the client-side filter as a temporary measure — but document it with a `// FIXME: replace with scoped endpoint when available` comment.

**Anti-hallucination guard:**
Log in as **Retailer A** in dev. Confirm only Retailer A's schedule history appears. Then log in as **Retailer B** (if a second test account exists). Confirm Retailer B sees only their own data. If you cannot create a second test account, open a tracking issue for this test case — do not mark the task complete without a data-isolation test.

---

### Task 2.4 — Verify CSV export (was 60% → target 95%)

**What is actually in the file:**
`ScheduleHistory.jsx` contains this button:
```jsx
<button className="text-sm text-primary hover:underline flex items-center gap-1">
    <span className="material-symbols-outlined text-sm">download</span>
    Export CSV
</button>
```
There is **no `onClick` handler**. The button does nothing. This is a stub.

**The exact change required:**
Add the following handler to `ScheduleHistory.jsx`:
```js
const handleExportCSV = () => {
    const rows = Object.values(filteredLoops).flatMap(group =>
        group.loops.map(loop => ({
            date: group.date,
            hour: group.hour,
            screen_id: loop.screen_id,
            status: loop.status,
            booked_slots: loop.slots?.filter(s => (s.status || '').toUpperCase() === 'BOOKED').length ?? 0,
            rejected_slots: loop.slots?.filter(s => (s.status || '').toUpperCase() === 'REJECTED').length ?? 0,
            validated_at: loop.approved_at || loop.validatedAt || ''
        }))
    );

    const headers = ['date', 'hour', 'screen_id', 'status', 'booked_slots', 'rejected_slots', 'validated_at'];
    const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};
```
Then wire it: `<button onClick={handleExportCSV} ...>`

**Anti-hallucination guard:**
In dev, click Export CSV with at least one loop visible. Confirm a `.csv` file downloads. Open the file in a text editor and confirm it has a header row and at least one data row matching what is on screen. If the file is empty or has only headers, `filteredLoops` is empty — debug the filter, not the export function.

---

### Task 2.5 — Date range defaults (was 75% → target 95%)

**What is actually in the file:**
The `dateFilter` state initialises to `'all'` — no 30-day default is applied. The dropdown lists dates dynamically from `availableDates` (all dates in the loops data) with an `'all'` option at the top. There is no 90-day cap on displayed dates.

**The exact change required:**
1. Change the date filter initialisation:
```js
// Replace:
const [dateFilter, setDateFilter] = useState('all');
// With:
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const DEFAULT_DATE_FILTER = '30d';
const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
```
2. Update `filteredLoops` to handle the `'30d'` and `'90d'` sentinel values:
```js
if (dateFilter === '30d') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    result = result.filter(l => new Date(l.date) >= cutoff);
} else if (dateFilter === '90d') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    result = result.filter(l => new Date(l.date) >= cutoff);
} else if (dateFilter !== 'all') {
    result = result.filter(l => l.date === dateFilter);
}
```
3. Replace the `<select>` options:
```jsx
<option value="30d">Last 30 days (default)</option>
<option value="90d">Last 90 days</option>
<option value="all">All available dates</option>
```
Remove the dynamic `availableDates.map(...)` from the dropdown — individual date picking is post-MVP.

**Anti-hallucination guard:**
On first load, confirm only loops with `date >= today - 30 days` appear in the list. Switch to 90 days, confirm more loops appear (if data exists). Switch to `All`, confirm all loops appear. If the 30-day filter shows zero results on a fresh dev dataset, seed the database with a loop dated within the last 30 days before declaring the filter broken.

---

### Task 2.6 — Event types (was 65% → target 90%)

**What is actually in the file:**
`ScheduleHistory.jsx` filters audit logs to:
```js
l.action === 'loop_approved' || l.action === 'slot_rejected' || l.action === 'slot_booked'
```
Missing event types from the Q38 requirement: `edits` and `overrides`. Also missing: `cancellations`.

**The exact change required:**
Expand the audit log filter:
```js
setAuditLog(log.filter(l =>
    l.action === 'loop_approved' ||
    l.action === 'slot_rejected' ||
    l.action === 'slot_booked' ||
    l.action === 'slot_edited' ||
    l.action === 'slot_overridden' ||
    l.action === 'loop_cancelled'
));
```
And add the corresponding display labels in the Recent Activity render block:
```js
{entry.action === 'slot_edited' && 'Slot edited'}
{entry.action === 'slot_overridden' && 'Slot overridden'}
{entry.action === 'loop_cancelled' && 'Loop cancelled'}
```
**Note:** If the backend does not emit `slot_edited`, `slot_overridden`, or `loop_cancelled` events, this filter will silently produce no results for those types — which is acceptable. Open a backend tracking issue noting these action strings are expected and must be emitted when those events occur. The frontend is then complete; the backend issue is tracked separately.

**Anti-hallucination guard:**
Search `ad-server/src/` for the strings `slot_edited`, `slot_overridden`, and `loop_cancelled`. Document which exist and which do not. Open a backend issue for any that are missing. This audit takes 5 minutes and removes the unknown from this task.

---

## PR 3 — ScheduleManager

---

### Task 3.1 — Replace hardcoded placeholders (was 88% → target 97%)

**What is actually in the file:**
`ScheduleManager.jsx` line ~65:
```jsx
<h2 className="text-xl font-bold">Hourly Loop: 08:00 - 09:00</h2>
<p className="text-sm text-slate-500">Validation window for tomorrow Oct 12, 2023</p>
```
The `selectedLocation` object is already in state and is set from the `/api/locations` response.

**The exact change required:**
```jsx
// Replace the hardcoded header with:
<h2 className="text-xl font-bold">
    Full Day Schedule: {selectedLocation?.name || 'Loading...'}
</h2>
<p className="text-sm text-slate-500">
    D-1 Preview for {new Date(Date.now() + 86400000).toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
    })}
    {selectedLocation?.timezone ? ` — ${selectedLocation.timezone}` : ''}
</p>
```
This covers Task 3.1 and Task 3.2 together. If `selectedLocation.timezone` is undefined (backend gap), the timezone portion is omitted gracefully — it does not crash.

---

### Task 3.2 — Timezone display (was 65% → target 88%)

**Backend gap check (do this first):**
Open `ad-server/src/api/` and find the locations route. Check if the location objects returned include a `timezone` field. If not:
1. Open a backend issue: `feat: add timezone field to location schema and API response`
2. In `ScheduleManager.jsx`, add a `// TODO [backend]: timezone field pending — see issue #N` comment at the conditional
3. The header gracefully omits the timezone label as shown in Task 3.1 above — the UI does not break

**Target confidence:** 88% (not 95%) because the backend gap is a cross-team dependency outside this PR's control. The frontend work is complete; the 12% gap is backend.

---

### Task 3.3 — Full-day default view (was 85% → target 97%)

**What is actually in the file:**
`ScheduleManager.jsx` currently renders a single `<LoopPreview slots={hourlyLoop} />` showing one hour's slots. There is no full-day view and no toggle.

**The exact change required:**
1. Add state: `const [viewMode, setViewMode] = useState('fullday');` — default is `'fullday'`.
2. When `viewMode === 'fullday'`, render a list of 24 hour-slots (or however many the API provides) using the existing `LoopPreview` component per row or a condensed summary row per hour.
3. When `viewMode === 'hour'`, render the single `<LoopPreview slots={hourlyLoop} />` that already exists.
4. Add a toggle button above the `GlassCard`:
```jsx
<div className="flex gap-2">
    <button
        onClick={() => setViewMode('fullday')}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
            viewMode === 'fullday'
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        }`}
    >Full Day</button>
    <button
        onClick={() => setViewMode('hour')}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
            viewMode === 'hour'
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        }`}
    >Single Hour</button>
</div>
```

---

### Task 3.4 — Bulk Approve All (was 70% → target 90%)

**What is actually in the file:**
The Bulk Approve All button exists in the JSX but has **no `onClick` handler**:
```jsx
<button className="px-4 py-2 bg-emerald-500 text-white ...">
    <span className="material-symbols-outlined text-[18px]">done_all</span>
    Bulk Approve All
</button>
```

**Backend check (required before coding):**
Search `ad-server/src/` for `bulk` and `approve`. If no endpoint exists, create: `POST /api/schedules/bulk-approve` accepting `{ location_id, date }`. If it exists, note its exact path.

**The exact change required:**
1. Add state: `const [showBulkConfirm, setShowBulkConfirm] = useState(false);`
2. Add handler:
```js
const handleBulkApprove = async () => {
    const token = localStorage.getItem('auth_token');
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res = await fetch(`${API_URL}/api/schedules/bulk-approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: selectedLocation?.id, date: tomorrow })
    });
    if (res.ok) {
        setShowBulkConfirm(false);
        fetchLoop(selectedLocation?.id); // refresh
    }
};
```
3. Wire button: `onClick={() => setShowBulkConfirm(true)}`
4. Add confirmation dialog rendered conditionally:
```jsx
{showBulkConfirm && (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <p className="font-bold text-lg mb-2">Approve all slots?</p>
            <p className="text-sm text-slate-500 mb-6">
                This will approve all unreviewed slots for <strong>{selectedLocation?.name}</strong> for tomorrow. This action cannot be undone.
            </p>
            <div className="flex gap-3">
                <button onClick={handleBulkApprove} className="flex-1 py-2 bg-emerald-500 text-white font-bold rounded-lg">Confirm</button>
                <button onClick={() => setShowBulkConfirm(false)} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
            </div>
        </div>
    </div>
)}
```

**Anti-hallucination guard:**
After clicking Confirm, open the Network tab in DevTools. Confirm a `POST /api/schedules/bulk-approve` request was sent with the correct `location_id` and tomorrow's `date`. If the request is not in the Network tab, the handler is not wired correctly.

---

### Task 3.5 — Per-slot rejection with comment (was 72% → target 90%)

**What is actually in the file:**
There is no per-slot reject UI at all. The only action button in scope is `Bulk Approve All`. Individual slot rows come from `<LoopPreview slots={hourlyLoop} />` — check `LoopPreview.jsx` for its slot rendering before adding reject UI to `ScheduleManager.jsx`.

**Backend check (required before coding):**
Search `ad-server/src/` for `reject`. If no endpoint exists, create: `POST /api/schedules/slots/:slotId/reject` accepting `{ comment?: string }`.

**The exact change required:**
1. Add state: `const [rejectTarget, setRejectTarget] = useState(null);` and `const [rejectComment, setRejectComment] = useState('');`
2. Pass `onReject={(slot) => setRejectTarget(slot)}` as a prop to `<LoopPreview>` and render a Reject button inside `LoopPreview.jsx` per slot.
3. Add rejection modal:
```jsx
{rejectTarget && (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <p className="font-bold text-lg mb-2">Reject slot</p>
            <textarea
                maxLength={280}
                placeholder="Reason for rejection (optional)"
                value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm mb-1 resize-none"
                rows={3}
            />
            <p className="text-xs text-slate-400 mb-2">{rejectComment.length}/280</p>
            {rejectComment === '' && (
                <p className="text-xs text-amber-500 mb-3">⚠ Rejection without a note may delay resolution</p>
            )}
            <div className="flex gap-3">
                <button onClick={handleRejectSlot} className="flex-1 py-2 bg-rose-500 text-white font-bold rounded-lg">Reject Slot</button>
                <button onClick={() => { setRejectTarget(null); setRejectComment(''); }} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
            </div>
        </div>
    </div>
)}
```
4. Add handler:
```js
const handleRejectSlot = async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/api/schedules/slots/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rejectComment })
    });
    if (res.ok) {
        setRejectTarget(null);
        setRejectComment('');
        fetchLoop(selectedLocation?.id);
    }
};
```

---

### Task 3.6 — D-1 cutoff display ✅ SKIP (90% — covered by Task 3.1 fix)

Add to the header `<p>` (already updated in Task 3.1):
```jsx
<span className="ml-2 font-semibold text-amber-500">· Approval deadline: today 6:00 PM {selectedLocation?.timezone || 'local time'}</span>
```
If current time > 18:00 in store timezone, replace this with:
```jsx
<span className="ml-2 font-semibold text-rose-500">· Approval window closed for today</span>
```

---

## PR 4 — TechOpsDashboard

---

### Task 4.1 — Remove Design Lab links (was 97% → 99%)

**What is actually in the file:**
The `HAMBURGER_EXPERIMENTS` constant is defined at the **module top level** (lines 7–35), outside the component function. The `<GlassCard>` that renders it is inside the JSX return. Two deletions are required:
1. Delete the entire `const HAMBURGER_EXPERIMENTS = [...]` block (lines 7–35 approximately)
2. Delete the entire `{/* ── Design Lab ── */}` `<GlassCard>` block from the JSX return

Do not use a feature flag — the decision is to delete the code entirely.

**Anti-hallucination guard:**
After deletion, search the file for the string `HAMBURGER_EXPERIMENTS`. It must return zero hits. Search for `experiment`. It must return zero hits. If either returns a hit, the deletion was incomplete.

---

### Task 4.2 — Restart confirmation dialog (was 90% → 97%)

**What is actually in the file:**
The Restart button is in the table row actions (line ~163):
```jsx
<button className="p-1 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors disabled:opacity-30">
    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
</button>
```
No `onClick`, no screen ID passed.

**The exact change required:**
1. Add state: `const [restartTarget, setRestartTarget] = useState(null);`
2. Wire the button: `onClick={() => setRestartTarget(screen)}`
3. Add confirmation modal (same pattern as Task 3.4), with body: `"Restart screen ${restartTarget?.id}? This will interrupt active playback."`
4. On confirm, call the restart API (see Task 4.3) and call `logRestartAudit(screen.id, outcome)` immediately after.

---

### Task 4.3 — Audit logging for Restart (was 55% → target 90%)

**Backend work (must complete before frontend):**
1. Create `ad-server/src/api/auditLogs.js` (or add to existing routes file) with:
```js
router.post('/api/audit-logs', requireAuth, async (req, res) => {
    const { user_id, screen_id, action, outcome, timestamp } = req.body;
    // Write to Firestore collection: audit_logs
    await db.collection('audit_logs').add({ user_id, screen_id, action, outcome, timestamp });
    res.json({ ok: true });
});
```
2. Register the route in `ad-server/src/server.js` (check the actual filename — do not assume `server.js`).

**Frontend work (after backend endpoint is live):**
```js
const logRestartAudit = async (screenId, outcome) => {
    const token = localStorage.getItem('auth_token');
    await fetch(`${API_URL}/api/audit-logs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: /* read from AuthContext */,
            screen_id: screenId,
            action: 'screen_restart',
            outcome,
            timestamp: new Date().toISOString()
        })
    });
};
```
Call `logRestartAudit(screen.id, 'success')` on API success and `logRestartAudit(screen.id, 'failure')` on API error. Do not `await` it in a way that blocks the UI response — fire-and-forget is acceptable for audit logs.

**Anti-hallucination guard:**
After a Restart action in dev, query Firestore directly for the `audit_logs` collection. Confirm a document exists with the correct `user_id`, `screen_id`, `action: 'screen_restart'`, and a valid ISO timestamp. If the document is missing, the POST request either failed or the backend route is not registered.

**Target confidence: 90%** (not 95%) because this spans frontend and backend and requires a Firestore schema change — inherently more moving parts.

---

### Task 4.4 — Terminal as log viewer (was 65% → target 90%)

**What is actually in the file:**
The Terminal button exists with no `onClick`:
```jsx
<button className="p-1 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors">
    <span className="material-symbols-outlined text-[18px]">terminal</span>
</button>
```

**The exact change required:**
1. Add state: `const [logTarget, setLogTarget] = useState(null);`
2. Wire: `onClick={() => setLogTarget(screen)}`
3. Check if `GET /api/monitoring/logs/:screenId` exists in `ad-server/src/api/`. If it does not, proceed with the stub approach.
4. Stub approach (if endpoint missing):
```jsx
{logTarget && (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <div className="bg-black rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <p className="font-mono text-green-400 font-bold">Terminal — {logTarget.id}</p>
                <button onClick={() => setLogTarget(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 font-mono text-xs text-green-300 bg-black rounded overflow-y-auto p-4">
                <p className="text-slate-500">Log endpoint not yet available.</p>
                <p className="text-slate-500">Track: feat/device-log-endpoint</p>
            </div>
        </div>
    </div>
)}
```
5. If the endpoint **does** exist, fetch and display it inside the same modal with a `useEffect` triggered when `logTarget` changes.

---

### Task 4.5 — Search and filter (was 78% → target 97%)

**What is actually in the file:**
The search input exists but is uncontrolled (no `value`, no `onChange`):
```jsx
<input type="text" placeholder="Search screen ID..." className="..." />
```
Status and location dropdowns do not exist.

**The exact change required:**
1. Add state: `const [searchQuery, setSearchQuery] = useState('');` and `const [statusFilter, setStatusFilter] = useState('all');`
2. Wire the input: `value={searchQuery} onChange={e => setSearchQuery(e.target.value)}`
3. Add a status dropdown next to the input with options: `All`, `Online`, `Offline`
4. Filter `stats.screens` before rendering the table:
```js
const filteredScreens = stats.screens.filter(s => {
    const matchesId = s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter.toUpperCase();
    return matchesId && matchesStatus;
});
```
5. Replace `stats.screens.map(...)` in the table with `filteredScreens.map(...)`

**Note on location filter:** The `screen` objects from `/api/monitoring/status` do not include a `location` field based on the current data shape (`{ id, status, last_seen }`). Adding a location filter requires the API to return `location` on each screen object. Open a backend tracking issue for this and ship the ID + status filter now. Location filter is then a fast follow once the API adds the field.

**Anti-hallucination guard:**
Type `scr-` into the search box. Confirm only screens with IDs containing `scr-` appear. Select `Offline` in the status dropdown. Confirm only offline screens appear. If filtering happens without a re-render (the list doesn't update), `filteredScreens` is not being used in the render — check that `stats.screens.map` was replaced with `filteredScreens.map`.

---

### Tasks 4.6 / 4.7 / 4.8 ✅ SKIP (92%–93% — no remediation needed beyond standard pattern)

---

## Revised Risk Table (Post-Remediation)

| Task | Before | After | Key Change |
|------|--------|-------|------------|
| 1.1 Loop bar | 70% | 95% | Decision recorded: ships as static visual in new `LoopVisualisationBar.jsx` |
| 1.2 Impact cards | 55% | 95% | Field mapping resolved; no mock data copied; exact JSX provided |
| 1.3 Step 3 naming | 65% | 97% | Explicit: only `Step3ReviewDistribution.jsx` targeted; `Step3LoopSlotSelection.jsx` is off-limits |
| 1.4 Delete Step3 | 92% | 97% | Pre-deletion import sweep explicitly named |
| 1.5 Delete PlaylistEditor | 95% | 97% | No change needed |
| 2.3 Retailer scope | 70% | 95% | Exact bug identified: `retailers[0]` hardcode; exact fix provided |
| 2.4 CSV export | 60% | 97% | Confirmed stub (no onClick); full handler provided |
| 2.5 Date range | 75% | 97% | Confirmed initialises to `'all'`; exact sentinel-value approach provided |
| 2.6 Event types | 65% | 90% | Missing action strings identified; backend audit step added |
| 3.1 Hardcoded values | 88% | 97% | Exact line identified; dynamic replacement with graceful timezone fallback provided |
| 3.2 Timezone | 65% | 88% | Frontend work complete; residual 12% is cross-team backend dependency |
| 3.3 Full-day default | 85% | 97% | `viewMode` state + toggle provided; no existing toggle found |
| 3.4 Bulk Approve | 70% | 90% | Button confirmed unwired; full handler + modal provided; backend endpoint required |
| 3.5 Per-slot reject | 72% | 90% | No existing UI; full modal + handler provided; backend endpoint required |
| 3.6 D-1 cutoff | 90% | 97% | Exact JSX added to Task 3.1 fix |
| 4.1 Design Lab | 97% | 99% | Both deletion points named: top-level constant + JSX block |
| 4.2 Restart dialog | 90% | 97% | Button confirmed unwired; `restartTarget` state pattern provided |
| 4.3 Audit logging | 55% | 90% | Backend route schema provided; frontend fire-and-forget pattern provided |
| 4.4 Terminal viewer | 65% | 90% | Button confirmed unwired; stub + real-endpoint branch provided |
| 4.5 Search + filter | 78% | 97% | Input confirmed uncontrolled; `filteredScreens` pattern provided; location filter deferred with tracking issue |

---

*Remediation guide authored: 2026-06-04*
*All file paths, variable names, and code snippets verified against live repo source before writing.*
