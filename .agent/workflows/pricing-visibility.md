---
description: Ensure all pricing multipliers are visible in the Super Admin UI before implementation
---

# Pricing Visibility Workflow

This workflow ensures that any pricing factor affecting CPM calculations is visible and editable in the Super Admin interface.

## The Golden Rule

> **If the user can't see it, the user can't debug it.**

Every multiplier that affects the final slot price MUST be visible in the Super Admin Pricing Calendar UI.

---

## Pre-Implementation Checklist

Before adding ANY new pricing factor, answer these questions:

### 1. Visibility Check
- [ ] Is there a UI element showing this multiplier's current value?
- [ ] Can the Super Admin edit this value directly?
- [ ] Is the multiplier's effect explained in a tooltip or label?

### 2. Formula Transparency
- [ ] Is the calculation formula documented in `docs/CPM_PRICING_MODEL.md`?
- [ ] Does the hover/tooltip on "Avg Slot CPM" explain all factors?
- [ ] Are all multipliers listed in order of application?

### 3. Debug Accessibility
- [ ] Can the value be inspected in browser console?
- [ ] Is it logged in `[PricingService]` debug output?
- [ ] Is there a validation warning if value is unusual?

---

## Current Approved Multipliers

| Multiplier | UI Location | Editable | Range |
|------------|-------------|----------|-------|
| Base CPM | Header card, pencil icon | ✅ Yes | $0.01 - $100 |
| Traffic Tier | Hourly dropdown | ✅ Yes | 0.5x - 1.5x |
| Date Override | Date Override section | ✅ Yes | 0.5x - 2.0x |

---

## Removed/Deprecated Multipliers

| Multiplier | Reason Removed | Date |
|------------|----------------|------|
| Store Traffic (1.25x/1.0x/0.8x) | Hidden from UI, caused confusion | 2026-01-11 |
| Retailer Overrides | Cleared on base CPM change | 2026-01-11 |

---

## Adding a New Multiplier

### Step 1: Design UI First
```
Before writing ANY backend code:
1. Create a mockup of where the multiplier will appear
2. Get Super Admin approval on the design
3. Determine how they will edit it
```

### Step 2: Implement with Visibility
```javascript
// ❌ WRONG - Hidden multiplier
const price = baseCPM * hiddenFactor;

// ✅ CORRECT - Visible multiplier with logging
const price = baseCPM * trafficTier.multiplier;
console.log(`[PricingService] Applied traffic tier: ${trafficTier.multiplier}x`);
```

### Step 3: Add Validation
```javascript
validateConfiguration() {
    // Warn if any factor is outside expected range
    if (multiplier < 0.5 || multiplier > 2.0) {
        console.warn(`[PRICING_ALERT] Unusual multiplier: ${multiplier}`);
    }
}
```

### Step 4: Update Documentation
- Add to `docs/CPM_PRICING_MODEL.md`
- Add to this workflow's "Approved Multipliers" table
- Update `lessons_learned.md` with the change

---

## Audit Command

Run this periodically to ensure all factors are visible:

```javascript
// In browser console
function auditPricingFactors() {
    const factors = [
        { name: 'Base CPM', value: pricingService.config?.baseCPM, uiVisible: true },
        { name: 'Traffic Tiers', value: pricingService.config?.trafficTiers, uiVisible: true },
        { name: 'Date Overrides', value: pricingService.config?.dateOverrides, uiVisible: true },
        { name: 'Retailer Overrides', value: pricingService.config?.retailerOverrides, uiVisible: false },
        { name: 'Store Traffic', value: 'REMOVED', uiVisible: false }
    ];
    
    console.table(factors);
    
    const hidden = factors.filter(f => !f.uiVisible && f.value && f.value !== 'REMOVED');
    if (hidden.length > 0) {
        console.error('⚠️ HIDDEN FACTORS DETECTED:', hidden);
    } else {
        console.log('✅ All pricing factors are visible in UI');
    }
}
auditPricingFactors();
```

---

## Related Files

- `client-app/src/services/PricingService.js` - Calculation logic
- `client-app/src/pages/admin/CPMCalendar.jsx` - UI display
- `docs/CPM_PRICING_MODEL.md` - Formula documentation
- `incidents/2026-01-11-cpm-calculation-mismatch.md` - Original bug report
