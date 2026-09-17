#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2D-A SNAPSHOT SCHEMA AUDIT VERIFY ==="

FILES=(
  "tv-player/snapshot-schema-diagnostics.html"
  "tv-player/assets/js/snapshot-shape-inspector.js"
  "tv-player/assets/js/snapshot-schema-diagnostics.js"
  "scripts/test-tv-phase3b2d-schema-audit.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/snapshot-shape-inspector.js \
  tv-player/assets/js/snapshot-schema-diagnostics.js \
  scripts/test-tv-phase3b2d-schema-audit.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq 'MAX_ARRAY_SAMPLE' tv-player/assets/js/snapshot-shape-inspector.js \
  && pass "Array shape sampling dibatasi" \
  || fail "Array sampling guard tidak ditemukan"

grep -Fq 'BLOCKED_KEYS' tv-player/assets/js/snapshot-shape-inspector.js \
  && pass "Blocked-key awareness tersedia" \
  || fail "Blocked-key guard tidak ditemukan"

grep -Fq 'Never expose actual values' tv-player/assets/js/snapshot-shape-inspector.js \
  && pass "Inspector dirancang metadata-only" \
  || fail "Metadata-only marker tidak ditemukan"

if grep -R -Eqi 'revision.*ack|/revision/ack|ackRevision' \
  tv-player/assets/js/snapshot-*.js; then
  fail "3B.2D-A tidak boleh melakukan revision ACK"
else
  pass "3B.2D-A tidak melakukan revision ACK"
fi

if grep -R -Eqi 'setState|transitionTo|engine\.|applyRevision' \
  tv-player/assets/js/snapshot-*.js; then
  fail "3B.2D-A tidak boleh menyentuh state engine/apply"
else
  pass "3B.2D-A tidak menyentuh state engine/apply"
fi

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' \
  tv-player/assets/js/snapshot-*.js; then
  fail "Schema audit layer mengandung service-role"
else
  pass "Schema audit layer bebas service-role"
fi

node scripts/test-tv-phase3b2d-schema-audit.mjs >/tmp/mjhk-3b2d-audit.log 2>&1
TEST_RC=$?

if [[ "$TEST_RC" -eq 0 ]]; then
  pass "Schema audit unit test CLEAN"
else
  fail "Schema audit unit test FAIL"
  cat /tmp/mjhk-3b2d-audit.log
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
