#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2E-B SYNC ORCHESTRATOR CORE VERIFY ==="

FILES=(
  "tv-player/assets/js/revision-sync-orchestrator.js"
  "scripts/test-tv-phase3b2e-sync-orchestrator.mjs"
  "tv-player/MJHK_TV_Phase3B2E_B_Sync_Orchestrator.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/revision-sync-orchestrator.js \
  scripts/test-tv-phase3b2e-sync-orchestrator.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

O="tv-player/assets/js/revision-sync-orchestrator.js"

grep -Fq 'await this.#deps.applyCandidate(prepared)' "$O" \
  && pass "Candidate apply gate tersedia" \
  || fail "Candidate apply gate hilang"

grep -Fq 'await this.#deps.promoteCandidate' "$O" \
  && pass "LKG promotion tersedia" \
  || fail "LKG promotion hilang"

APPLY_LINE="$(grep -nF 'await this.#deps.applyCandidate(prepared)' "$O" | head -n1 | cut -d: -f1)"
PROMOTE_LINE="$(grep -nF 'await this.#deps.promoteCandidate' "$O" | head -n1 | cut -d: -f1)"

if [[ -n "$APPLY_LINE" && -n "$PROMOTE_LINE" && "$PROMOTE_LINE" -gt "$APPLY_LINE" ]]; then
  pass "Promotion secara statis terjadi setelah successful apply"
else
  fail "Promotion ordering tidak aman"
fi

grep -Fq 'ack_intent' "$O" \
  && pass "ACK intent tersedia tanpa network ACK" \
  || fail "ACK intent hilang"

if grep -R -Eqi '/revision/ack|ackRevision|GatewayClient|fetch\(' "$O"; then
  fail "3B.2E-B core belum boleh mengirim direct Gateway/ACK network"
else
  pass "Core bebas direct Gateway/ACK network"
fi

if grep -R -Eqi \
  'TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' "$O"; then
  fail "Sync core tidak boleh mengontrol state engine"
else
  pass "Sync core bebas state-engine control"
fi

# Direct Supabase detection only.
# Note: literal "sb_secret_" may legitimately appear inside secret-redaction regex,
# so it must NOT by itself be treated as Supabase access.
if grep -R -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE|SUPABASE_URL|createClient[[:space:]]*\(|@supabase/supabase-js|https://[^"'\'']*\.supabase\.co|/rest/v1/|/storage/v1/' \
  "$O"
then
  fail "Sync core tidak boleh direct Supabase"
else
  pass "Sync core bebas direct Supabase"
fi

# The redaction guard itself SHOULD exist.
grep -Fq 'sb_secret_' "$O" \
  && grep -Fq '[redacted]' "$O" \
  && pass "Supabase secret redaction guard tersedia" \
  || warn "Supabase secret redaction guard tidak terdeteksi"

grep -Fq 'clearCandidate' "$O" \
  && pass "Failed candidate cleanup tersedia" \
  || fail "Candidate cleanup hilang"

grep -Fq '#inFlight' "$O" \
  && pass "Single-flight concurrency guard tersedia" \
  || fail "Single-flight guard hilang"

grep -Fq '[redacted]' "$O" \
  && pass "Error redaction tersedia" \
  || fail "Error redaction hilang"

if node scripts/test-tv-phase3b2e-sync-orchestrator.mjs \
  >/tmp/mjhk-3b2e-b.log 2>&1; then
  pass "Sync orchestrator unit test CLEAN"
else
  fail "Sync orchestrator unit test FAIL"
  cat /tmp/mjhk-3b2e-b.log
fi

[[ -f tv-player/assets/js/engine.js ]] \
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
