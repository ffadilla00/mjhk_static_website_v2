#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4C-A PHASE-AWARE UX VERIFIER HOTFIX VERIFY ==="

F="scripts/verify-tv-phase4ca-media-upload-ux.sh"

[[ -f "$F" ]] \
  && pass "Media UX verifier tersedia" \
  || fail "Media UX verifier hilang"

grep -Fq \
  'Real private Storage wiring aktif; readiness guard lama tidak lagi diperlukan' \
  "$F" \
  && pass "Phase-aware Storage invariant tersedia" \
  || fail "Phase-aware invariant hilang"

if bash "$F" >/tmp/mjhk-4ca-phase-aware.log 2>&1
then
  pass "Media UX verifier CLEAN"
else
  fail "Media UX verifier masih FAIL"
  cat /tmp/mjhk-4ca-phase-aware.log
fi

if [[ -f scripts/verify-tv-phase4ca-private-storage-upload.sh ]]; then
  if bash scripts/verify-tv-phase4ca-private-storage-upload.sh \
    >/tmp/mjhk-4ca-private-storage-reg.log 2>&1
  then
    pass "Private Storage verifier CLEAN"
  else
    fail "Private Storage verifier masih FAIL"
    cat /tmp/mjhk-4ca-private-storage-reg.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] \
  && echo "RESULT: CLEAN" \
  && exit 0

echo "RESULT: FAIL"
exit 1
