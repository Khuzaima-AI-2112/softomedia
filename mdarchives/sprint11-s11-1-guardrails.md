# S11-1 Guardrail Sign-Off — Super Admin CRUD: Users & Retailers

**Story:** S11-1  
**Files touched:**
- `client-app/src/pages/admin/UserManagement.jsx`
- `client-app/src/pages/admin/RetailerManagement.jsx`
- `ad-server/src/api/users.js` (router verified)
- `ad-server/src/api/retailers.js` (router verified)

---

## Router Verification

### users.js

| Route | Method | Guard | Status |
|---|---|---|---|
| `POST /api/users` | Create user | `requireRole('superadmin')` | ✅ |
| `DELETE /api/users/:id` | Soft-delete (status: inactive) | `requireRole('superadmin')` | ✅ |

### retailers.js

| Route | Method | Guard | Status |
|---|---|---|---|
| `POST /api/retailers` | Create retailer | `requireRole('superadmin')` | ✅ |
| `PATCH /api/retailers/:id` | Update retailer | `requireRole('superadmin')` | ✅ |
| `DELETE /api/retailers/:id` | Soft-delete | `requireRole('superadmin')` | ✅ |

---

## data-testid Additions

### UserManagement.jsx

```jsx
// Add user button
<button data-testid="add-user-btn" onClick={handleAddUser}>

// User table rows
<tr data-testid={`user-row-${user.id}`}>

// Delete buttons
<button data-testid={`delete-user-btn-${user.id}`} onClick={() => handleDeleteUser(user.id)}>
```

### RetailerManagement.jsx

```jsx
// Add retailer button
<button data-testid="add-retailer-btn" onClick={handleAddRetailer}>

// Retailer table rows
<tr data-testid={`retailer-row-${retailer.id}`}>

// Delete buttons
<button data-testid={`delete-retailer-btn-${retailer.id}`} onClick={() => handleDeleteRetailer(retailer.id)}>
```

---

## Acceptance Criteria Checklist

- [ ] `POST /api/users` → 201 `{ user_id }` with superadmin header
- [ ] `POST /api/users` without auth → 403
- [ ] `POST /api/users` with duplicate email → 409
- [ ] `DELETE /api/users/:id` → 200 `{ status: 'inactive' }`
- [ ] `POST /api/retailers` → 201 `{ retailer_id }`
- [ ] `PATCH /api/retailers/:id` → 200
- [ ] `DELETE /api/retailers/:id` → 200 `{ status: 'inactive' }`
- [ ] Hard-refresh: created records persist, deleted records absent

## Guardrail Checks

- [ ] G1: All 5 `apiService` methods verified or created in `ApiService.js`
- [ ] G2: All 5 routes confirmed in router source files
- [ ] G3: All mutations confirm `requireRole('superadmin')`
- [ ] G4: `users.status` enum: `active | inactive` (lowercase only)

---

*S11-1 guardrail doc — Sprint 11, 2026-06-06*
