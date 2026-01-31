---
description: Validate pricing schema against Zod definitions
---

# Schema Verification Workflow (/schema)

Validate that the pricing configuration conforms to the defined Zod schema.

## Steps

1. **Run Schema Verification** (local mode):
   ```powershell
   node ad-server/scripts/verify_schema.js --local
   ```

2. **Run Schema Verification** (cloud mode):
   ```powershell
   node ad-server/scripts/verify_schema.js
   ```

## What It Checks
- Required fields are present
- Field types are correct
- Nested structures (trafficTiers, dateOverrides) are valid
- No unexpected fields

## Expected Output
```
[SCHEMA_VERIFY] Mode: Local
[SCHEMA_VERIFY] Validating data structure...
✅ SCHEMA VALID: Pricing configuration is logically healthy
```

## If Validation Fails
- Review the specific Zod errors
- Check for missing required fields
- Verify field types match schema expectations
