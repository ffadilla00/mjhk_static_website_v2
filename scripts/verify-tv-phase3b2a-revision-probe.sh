#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2A REVISION PROBE VERIFY ==="

FILES=(
  "tv-player/revision-diagnostics.html"
  "tv-player/assets/js/revision-client.js"
  "tv-player/assets/js/revision-validator.js"
  "tv-player/assets/js/revision-diagnostics.js"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/revision-client.js \
  tv-player/assets/js/revision-validator.js \
  tv-player/assets/js/revision-diagnostics.js
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq 'desired_revision_id' tv-player/assets/js/revision-client.js \
  && pass "Bootstrap desired_revision_id digunakan" \
  || fail "desired_revision_id wiring tidak ditemukan"

grep -Fq 'routes.revisionById' tv-player/assets/js/revision-client.js \
  && pass "Explicit revision UUID route digunakan" \
  || fail "Explicit revision route tidak digunakan"

grep -Fq 'auth: true' tv-player/assets/js/revision-client.js \
  && pass "Revision fetch memakai device auth" \
  || fail "Revision fetch tidak authenticated"

grep -Fq 'revision_id_mismatch' tv-player/assets/js/revision-validator.js \
  && pass "Revision identity mismatch guard tersedia" \
  || fail "Revision identity mismatch guard tidak ditemukan"

grep -Fq 'config_field_not_detected_yet' tv-player/assets/js/revision-validator.js \
  && pass "Unknown config-shape ditangani sebagai probe warning" \
  || fail "Config-shape probe warning tidak ditemukan"

if grep -R -Eqi 'revision.*ack|ackRevision|/revision/ack' \
  tv-player/assets/js/revision-client.js \
  tv-player/assets/js/revision-validator.js \
  tv-player/assets/js/revision-diagnostics.js; then
  fail "3B.2A tidak boleh melakukan revision ACK"
else
  pass "3B.2A tidak melakukan revision ACK"
fi

if grep -R -Eqi 'engine\.|setState|transitionTo|applyRevision' \
  tv-player/assets/js/revision-client.js \
  tv-player/assets/js/revision-validator.js \
  tv-player/assets/js/revision-diagnostics.js; then
  fail "3B.2A tidak boleh menyentuh state engine/apply"
else
  pass "3B.2A tidak menyentuh state engine/apply"
fi

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' \
  tv-player/assets/js/revision-*.js; then
  fail "Revision browser layer mengandung service-role"
else
  pass "Revision browser layer bebas service-role"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
