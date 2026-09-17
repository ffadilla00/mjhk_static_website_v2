#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2B REVISION STORE/LKG VERIFY ==="

FILES=(
  "tv-player/revision-store-diagnostics.html"
  "tv-player/assets/js/revision-store.js"
  "tv-player/assets/js/revision-store-diagnostics.js"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/revision-store.js \
  tv-player/assets/js/revision-store-diagnostics.js
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq 'mjhk.tv.revision.candidate.v1' tv-player/assets/js/revision-store.js \
  && pass "Candidate storage key tersedia" \
  || fail "Candidate storage key tidak ditemukan"

grep -Fq 'mjhk.tv.revision.lkg.v1' tv-player/assets/js/revision-store.js \
  && pass "LKG storage key tersedia" \
  || fail "LKG storage key tidak ditemukan"

grep -Fq 'snapshot_missing_or_invalid' tv-player/assets/js/revision-store.js \
  && pass "Snapshot contract divalidasi" \
  || fail "Snapshot validation tidak ditemukan"

grep -Fq 'crypto.subtle.digest' tv-player/assets/js/revision-store.js \
  && pass "SHA-256 fingerprint tersedia" \
  || fail "Fingerprint integrity check tidak ditemukan"

grep -Fq 'stored_revision_fingerprint_mismatch' tv-player/assets/js/revision-store.js \
  && pass "Corruption detection tersedia" \
  || fail "Corruption detection tidak ditemukan"

grep -Fq 'this.storage.setItem(LKG_KEY, serialized)' tv-player/assets/js/revision-store.js \
  && grep -Fq 'this.storage.removeItem(CANDIDATE_KEY)' tv-player/assets/js/revision-store.js \
  && pass "Candidate promotion ke LKG tersedia" \
  || fail "Candidate promotion tidak lengkap"

grep -Fq 'loadLastKnownGood' tv-player/assets/js/revision-store.js \
  && pass "LKG recovery API tersedia" \
  || fail "LKG recovery API tidak ditemukan"

grep -Fq 'MAX_RECORD_BYTES' tv-player/assets/js/revision-store.js \
  && pass "Revision-store size guard tersedia" \
  || fail "Revision-store size guard tidak ditemukan"

if grep -R -Eqi 'revision.*ack|/revision/ack|ackRevision' \
  tv-player/assets/js/revision-store.js \
  tv-player/assets/js/revision-store-diagnostics.js; then
  fail "3B.2B tidak boleh melakukan revision ACK"
else
  pass "3B.2B tidak melakukan revision ACK"
fi

if grep -R -Eqi 'setState|transitionTo|applyRevision|engine\.' \
  tv-player/assets/js/revision-store.js \
  tv-player/assets/js/revision-store-diagnostics.js; then
  fail "3B.2B tidak boleh mengubah state engine/apply"
else
  pass "3B.2B tidak menyentuh state engine/apply"
fi

if grep -R -Eqi 'console\.(log|info|debug|warn|error)\([^)]*(snapshot|deviceToken|device_token)' \
  tv-player/assets/js/revision-store*.js; then
  fail "Potential snapshot/token logging ditemukan"
else
  pass "Tidak ada snapshot/token value logging"
fi

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' \
  tv-player/assets/js/revision-store*.js; then
  fail "Revision store mengandung service-role"
else
  pass "Revision store bebas service-role"
fi

[[ -f "tv-player/assets/js/engine.js" ]] \
  && pass "Locked engine tetap tersedia" \
  || fail "Locked engine hilang"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
