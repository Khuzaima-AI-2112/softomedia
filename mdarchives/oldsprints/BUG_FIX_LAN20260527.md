# BUG FIX — LAN-20260527
**Date:** 2026-05-27  
**Reporter:** QA / Manual Testing  
**Symptom:** UI changes (create, edit, delete, status toggle) appear to work immediately but are lost on page refresh. All four management pages are affected: AdvertiserManagement, RetailerManagement, ScreenManagement, and the Store/BusinessHours sections.

---

## Root Cause

The bug lives in a **single method** — `BaseRepository.update()` in `ad-server/src/repositories/BaseRepository.js`.

```js
// BROKEN — before this fix
async update(id, data) {
    const existing = await this.findById(id) || {};
    const updateData = { ...existing, ...data, updated_at: new Date().toISOString() };

    try {
        if (this.collection) {
            await this.breaker.execute(() => this.collection.doc(id).update(updateData));
        }
    } catch (e) {
        // BUG: Firestore error is silently eaten.
        // Execution continues to the MOCK_STORAGE write below,
        // making the call appear successful when Firestore was never updated.
    }

    MOCK_STORAGE[this.collectionName].set(id, updateData);  // always runs
    return updateData;                                        // always returns success
}
```

**What happens at runtime:**
1. `this.collection.doc(id).update(updateData)` throws — common causes: the document does not yet exist in Firestore (newly seeded data only in mock), a permissions error, or a network error during the Firestore call.
2. The `catch` block swallows the error without logging or re-throwing.
3. `MOCK_STORAGE.set()` runs unconditionally, so the in-memory store is updated and the UI reflects the change.
4. On page refresh, `findAll()` reads from Firestore (which was never written), returning stale data.

**Secondary bug — Firestore `.update()` on non-existent docs:**  
Firestore's `.update()` throws `NOT_FOUND` if the document does not exist. This is the most common trigger — data seeded only into MOCK_STORAGE never makes it to Firestore, so the very first real edit attempt always throws and was always silently swallowed. The fix switches to `.set({ merge: true })` which creates the document if absent and merges fields if present.

---

## Affected Call Chains

| UI Action | Frontend Handler | ApiService | Route | Repository Method |
|---|---|---|---|---|
| Edit advertiser | `handleSubmit` → `updateAdvertiser` | `PUT /api/advertisers/:id` | `advertisers.js PUT /:id` | `BaseRepository.update()` ✗ |
| Toggle advertiser status | `toggleStatus` → `patchAdvertiser` | `PATCH /api/advertisers/:id` | `advertisers.js PATCH /:id` | `BaseRepository.update()` ✗ |
| Edit retailer | `handleRetailerSubmit` → `updateRetailer` | `PUT /api/retailers/:id` | `retailers.js PUT /:id` | `BaseRepository.update()` ✗ |
| Toggle retailer status | `toggleRetailerStatus` → `patchRetailer` | `PATCH /api/retailers/:id` | `retailers.js PATCH /:id` | `RetailerRepository.updateStatus()` → `BaseRepository.update()` ✗ |
| Edit store | `handleStoreSubmit` → `updateStore` | `PUT /api/stores/:id` | `stores.js PUT /:id` | `BaseRepository.update()` ✗ |
| Toggle screen status | `handleStatusToggle` → `updateScreenStatus` | `PATCH /api/screens/:id/status` | `screens.js PATCH /:id/status` | `ScreenRepository.updateStatus()` → `BaseRepository.update()` ✗ |
| Update weekly hours | `handleSaveWeekly` → `updateWeeklyHours` | `PUT /api/stores/:id/weekly-hours` | `stores.js PUT /:id/weekly-hours` | `BusinessHoursRepository.updateDefaultHours()` → `BaseRepository.update()` ✗ |

> **Note:** `BaseRepository.create()` and `BaseRepository.delete()` are NOT affected — `create()` throws on error (no catch), and `delete()` logs but does not silently mislead the caller. `upsert()` already used `set({merge:true})` correctly.

---

## Tasks

### Task 1 — Fix `BaseRepository.update()` ✅ DONE

**File:** `ad-server/src/repositories/BaseRepository.js`

Removed the silent `catch` block. Switched from `.update()` to `.set({ merge: true })`. Error now propagates to the route handler, which returns a proper HTTP 500 to the client.

```js
// FIXED
async update(id, data) {
    const existing = await this.findById(id) || {};
    const updateData = { ...existing, ...data, updated_at: new Date().toISOString() };

    if (this.collection) {
        // set+merge: creates if absent, merges if present — no NOT_FOUND throws.
        // Error propagates to route handler → proper HTTP 500 on failure.
        await this.breaker.execute(() =>
            this.collection.doc(id).set(updateData, { merge: true })
        );
    }

    MOCK_STORAGE[this.collectionName].set(id, updateData);
    return updateData;
}
```

### Task 2 — Fix `RetailerRepository.softDelete()` and `updateStatus()` ✅ DONE

**File:** `ad-server/src/repositories/RetailerRepository.js`

Both methods called `docRef.update()` directly, exposing the same `NOT_FOUND` risk. Replaced with `docRef.set({ ... }, { merge: true })` in both.

### Task 3 — Fix `AdvertiserRepository.softDelete()` ✅ DONE

**File:** `ad-server/src/repositories/AdvertiserRepository.js`

This method already re-threw on error (correct), but still used `.update()`. Replaced with `.set({ ... }, { merge: true })`.

---

## Files Changed

| File | Change |
|---|---|
| `ad-server/src/repositories/BaseRepository.js` | `update()`: remove silent catch, `.update()` → `.set({merge:true})` |
| `ad-server/src/repositories/RetailerRepository.js` | `softDelete()` + `updateStatus()`: `.update()` → `.set({merge:true})` |
| `ad-server/src/repositories/AdvertiserRepository.js` | `softDelete()`: `.update()` → `.set({merge:true})` |

No frontend changes. No route changes. No ApiService changes. All three layers were correct.

---

## Verification Protocol

For each affected action, verify with this exact sequence:

1. **Perform the action** in the UI (edit / toggle / delete)
2. **Check Network tab** — confirm the API request returned `200` or `201`
3. **Hard refresh** (`Ctrl + Shift + R`) — confirm the change persists in the UI
4. **Check Firestore console directly** — open the relevant collection (`advertisers`, `retailers`, `screens`, `stores`, `store_default_hours`) and confirm the document was written with the correct fields and an updated `updated_at` timestamp

The hard-refresh + Firestore direct check is the only reliable confirmation. The optimistic UI update alone was what caused the false positives before this fix.
