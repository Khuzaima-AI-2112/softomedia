---
description: Verify and enforce the correct pricing configuration schema
---

# Schema Governance Workflow

This workflow ensures that the pricing configuration in the database adheres to the structural rules defined in `ad-server/src/schemas/PricingSchema.js`.

## Verification Steps

### 1. Local Schema Check
Verify that the current local development configuration is valid.
// turbo
```powershell
node ad-server/scripts/verify_schema.js --local
```

### 2. Cloud Schema Check
Verify that the production environment adheres to the schema.
// turbo
```powershell
node ad-server/scripts/verify_schema.js --cloud
```

## Troubleshooting

If a schema check fails:
1. Review the error output from the script (it uses Zod formatting).
2. Correct the offending document in Firestore or via the Admin UI.
3. Re-run the verification.

## Schema Definition
The source of truth for the schema is [PricingSchema.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/schemas/PricingSchema.js).
