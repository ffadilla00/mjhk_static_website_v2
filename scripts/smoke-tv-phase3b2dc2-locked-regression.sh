#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 3B.2D-C2 LOCKED REGRESSION SMOKE ==="

SCRIPTS=(
  "scripts/verify-tv-phase3a-foundation.sh"
  "scripts/verify-tv-phase3a1-zero-transition.sh"
  "scripts/verify-tv-phase3a1-visual-polish.sh"
  "scripts/verify-tv-phase3a1-full-bleed.sh"
  "scripts/verify-tv-phase3a1-production-badge.sh"
  "scripts/verify-tv-phase3b2dc-presentation-binding.sh"
  "scripts/verify-tv-phase3b2dc2-player-bridge.sh"
)

FAIL=0

for script in "${SCRIPTS[@]}"; do
  echo
  if [[ ! -f "$script" ]]; then
    echo "[SKIP] $script tidak tersedia"
    continue
  fi

  echo ">>> $script"
  if bash "$script"; then
    :
  else
    FAIL=$((FAIL+1))
  fi
done

echo
echo "=== LOCKED REGRESSION SUMMARY ==="
echo "FAILED SUITES: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
