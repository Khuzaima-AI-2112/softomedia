---
description: Check environment parity between local and cloud configurations
---

# Environment Parity Audit (/parity)

Verify that local configuration matches cloud/production configuration.

## Steps

1. **Run Parity Audit Script**:
   ```powershell
   node ad-server/scripts/parity_audit.js
   ```

2. **Check for Drift**:
   The script will report:
   - Current cloud pricing configuration
   - Any snake_case vs camelCase inconsistencies
   - Missing or extra fields

## Expected Output
- No parity drift detected
- All fields use camelCase (canonical format)
- Schema version matches expected

## If Drift Detected
- Review the specific fields reported
- Determine if migration is needed
- Do NOT auto-fix - document and plan remediation
