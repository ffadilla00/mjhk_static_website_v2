#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2E-A AUDIT PACK VERIFY ==="

FILES=(
  "scripts/audit-tv-phase3b2e-sync-wiring.sh"
  "tv-player/MJHK_TV_Phase3B2E_Sync_Contract.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

grep -Fq 'gateway-client.js' scripts/audit-tv-phase3b2e-sync-wiring.sh \
  && pass "Gateway client audit tersedia" \
  || fail "Gateway client audit hilang"

grep -Fq 'revision-store.js' scripts/audit-tv-phase3b2e-sync-wiring.sh \
  && pass "Revision store audit tersedia" \
  || fail "Revision store audit hilang"

grep -Fq 'presentation-player-bridge.js' scripts/audit-tv-phase3b2e-sync-wiring.sh \
  && pass "Player bridge audit tersedia" \
  || fail "Player bridge audit hilang"

grep -Fq 'revision/ack' scripts/audit-tv-phase3b2e-sync-wiring.sh \
  && pass "ACK contract audit tersedia" \
  || fail "ACK contract audit hilang"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
