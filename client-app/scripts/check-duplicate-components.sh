#!/usr/bin/env bash
# check-duplicate-components.sh
#
# Prevents the same filename from existing in BOTH:
#   client-app/src/components/
#   client-app/src/pages/  (any depth)
#
# This pattern caused a silent duplicate-implementation bug in Sprint 10-11
# (CampaignApprovalList, TicketDashboard, TicketDetail). This script ensures
# it can never happen again.
#
# Usage:
#   bash scripts/check-duplicate-components.sh          # from client-app/
#   bash client-app/scripts/check-duplicate-components.sh  # from repo root
#
# Exit codes:
#   0  — no duplicates found
#   1  — one or more duplicates found (lists offending files)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPONENTS_DIR="$CLIENT_ROOT/src/components"
PAGES_DIR="$CLIENT_ROOT/src/pages"

if [[ ! -d "$COMPONENTS_DIR" || ! -d "$PAGES_DIR" ]]; then
  echo "[check-duplicates] ERROR: could not find src/components or src/pages under $CLIENT_ROOT" >&2
  exit 1
fi

# Collect basenames from components/ (one level deep, JSX/JS/TSX/TS only)
mapfile -t COMPONENT_FILES < <(find "$COMPONENTS_DIR" -maxdepth 1 -type f \( -name '*.jsx' -o -name '*.js' -o -name '*.tsx' -o -name '*.ts' \) -exec basename {} \;)

DUPLICATES=()

for fname in "${COMPONENT_FILES[@]}"; do
  # Search for the same filename anywhere under pages/
  matches=$(find "$PAGES_DIR" -name "$fname" -type f 2>/dev/null)
  if [[ -n "$matches" ]]; then
    while IFS= read -r match; do
      DUPLICATES+=("  components/$fname  ⇔  ${match#$CLIENT_ROOT/src/}")
    done <<< "$matches"
  fi
done

if [[ ${#DUPLICATES[@]} -eq 0 ]]; then
  echo "[check-duplicates] ✅  No duplicate filenames found between components/ and pages/."
  exit 0
fi

echo "" >&2
echo "[check-duplicates] ❌  DUPLICATE FILENAMES DETECTED" >&2
echo "" >&2
echo "  The following files share the same name in both components/ and pages/." >&2
echo "  This causes silent split-implementation bugs. Resolve before committing:" >&2
echo "" >&2
for dup in "${DUPLICATES[@]}"; do
  echo "$dup" >&2
done
echo "" >&2
echo "  Resolution options:" >&2
echo "    A) Keep components/ as source of truth — replace pages/ copy with a re-export:" >&2
echo "       export { default } from '../../components/YourComponent.jsx';" >&2
echo "    B) Keep pages/ as source of truth — delete the components/ copy and update all importers." >&2
echo "    C) Rename one file if they genuinely serve different purposes." >&2
echo "" >&2
exit 1
