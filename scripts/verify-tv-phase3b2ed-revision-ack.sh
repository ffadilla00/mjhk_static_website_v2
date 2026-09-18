#!/usr/bin/env bash
set -u
PASS=0; WARN=0; FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2E-D REVISION ACK & RECOVERY VERIFY ==="
FILES=(
  "tv-player/assets/js/revision-ack-outbox.js"
  "tv-player/assets/js/revision-ack-delivery.js"
  "tv-player/assets/js/revision-sync-startup.js"
  "tv-player/assets/js/revision-sync-startup-dependencies.js"
  "scripts/test-tv-phase3b2ed-revision-ack.mjs"
  "tv-player/MJHK_TV_Phase3B2E_D_ACK_Recovery.md"
)
for f in "${FILES[@]}"; do [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"; done
for js in tv-player/assets/js/revision-ack-outbox.js tv-player/assets/js/revision-ack-delivery.js tv-player/assets/js/revision-sync-startup.js tv-player/assets/js/revision-sync-startup-dependencies.js scripts/test-tv-phase3b2ed-revision-ack.mjs; do
  node --check "$js" >/dev/null 2>&1 && pass "$js syntax OK" || fail "$js syntax ERROR"
done
A="tv-player/assets/js/revision-ack-delivery.js"; O="tv-player/assets/js/revision-ack-outbox.js"; S="tv-player/assets/js/revision-sync-startup.js"; D="tv-player/assets/js/revision-sync-startup-dependencies.js"
grep -Fq 'const ACK_PATH = "/v1/device/revision/ack"' "$A" && pass "ACK endpoint contract tersedia" || fail "ACK endpoint contract hilang"
grep -Fq 'auth: true' "$A" && pass "ACK memakai device authentication" || fail "ACK auth tidak ditemukan"
grep -Fq 'stale_revision_ack' "$A" && pass "Stale ACK handling tersedia" || fail "Stale ACK handling hilang"
grep -Fq 'BACKOFF_MS' "$A" && pass "Bounded ACK backoff tersedia" || fail "ACK backoff hilang"
grep -Fq 'revision-ack-outbox.v1' "$O" && pass "Persistent ACK outbox tersedia" || fail "ACK outbox hilang"
grep -Fq 'recoverSuccessAck' "$S" && pass "Already-applied recovery ACK terpasang" || fail "Recovery ACK tidak ditemukan"
grep -Fq 'getLastBootstrap' "$D" && pass "Bootstrap context tersedia untuk recovery" || fail "Bootstrap recovery context hilang"
grep -Fq 'flushPending' "$S" && pass "Pending ACK retry saat startup tersedia" || fail "Pending ACK startup retry hilang"
if grep -R -Eqi 'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'"'"']*\.supabase\.co' tv-player/assets/js/revision-ack*.js; then fail "ACK layer tidak boleh direct Supabase"; else pass "ACK layer bebas direct Supabase"; fi
if grep -R -Eqi 'TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' tv-player/assets/js/revision-ack*.js tv-player/assets/js/revision-sync-startup.js; then fail "ACK layer tidak boleh mengontrol state engine"; else pass "ACK layer bebas state-engine control"; fi
if grep -R -Eqi 'console\.(log|info|debug|warn|error)\([^)]*(deviceToken|device_token|Bearer|snapshot)' tv-player/assets/js/revision-ack*.js; then fail "Potential secret/content logging ditemukan"; else pass "ACK layer bebas secret/content value logging"; fi
if node scripts/test-tv-phase3b2ed-revision-ack.mjs >/tmp/mjhk-3b2ed.log 2>&1; then pass "Revision ACK unit test CLEAN"; else fail "Revision ACK unit test FAIL"; cat /tmp/mjhk-3b2ed.log; fi
if [[ -f scripts/verify-tv-phase3b2ec-player-startup.sh ]]; then if bash scripts/verify-tv-phase3b2ec-player-startup.sh >/tmp/mjhk-3b2ec-reg.log 2>&1; then pass "3B.2E-C regression CLEAN"; else fail "3B.2E-C regression FAIL"; cat /tmp/mjhk-3b2ec-reg.log; fi; fi
[[ -f tv-player/assets/js/engine.js ]] && pass "Locked engine tetap tersedia" || fail "Locked engine hilang"
echo -e "\n=== SUMMARY ===\nPASS: $PASS\nWARN: $WARN\nFAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"; exit 1
