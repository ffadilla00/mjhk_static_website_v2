#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 4E FINAL GATE V2 ==="
echo

bash scripts/verify-tv-phase4e-devices-final-v2.sh
V=$?

echo
bash scripts/audit-tv-phase4e-regression-v2.sh
A=$?

echo
if [ "$V" -eq 0 ] && [ "$A" -eq 0 ]; then
  echo "=============================================="
  echo "PHASE 4E DEVICES: LOCK READY"
  echo "4E-A Devices Overview & Display Profile  PASS"
  echo "4E-B Registration & Pairing              PASS"
  echo "4E-C1 Remote Commands + History          PASS"
  echo "=============================================="
  exit 0
fi

echo "=============================================="
echo "PHASE 4E DEVICES: NOT READY TO LOCK"
echo "verify_exit=$V audit_exit=$A"
echo "=============================================="
exit 1
