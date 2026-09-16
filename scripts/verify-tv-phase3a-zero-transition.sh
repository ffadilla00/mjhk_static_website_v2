#!/usr/bin/env bash
set -u

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

ENGINE="tv-player/assets/js/engine.js"
STATES="tv-player/assets/js/states.js"

echo "=== MJHK TV PHASE 3A ZERO-STATE TRANSITION VERIFY ==="

[[ -f "$ENGINE" ]] && pass "engine.js tersedia" || fail "engine.js tidak ditemukan"
[[ -f "$STATES" ]] && pass "states.js tersedia" || fail "states.js tidak ditemukan"

node --check "$ENGINE" >/dev/null 2>&1 \
  && pass "engine.js syntax OK" \
  || fail "engine.js syntax ERROR"

grep -Fq 'this.remainingSeconds === 0 && this.runningScenario' "$ENGINE" \
  && pass "Atomic zero transition guard tersedia" \
  || fail "Atomic zero transition guard tidak ditemukan"

grep -Fq 'this.advanceScenario();' "$ENGINE" \
  && pass "Scenario advance tersedia" \
  || fail "Scenario advance tidak ditemukan"

# Runtime regression test against the actual engine source.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$ENGINE" "$TMP/engine.mjs"
cp "$STATES" "$TMP/states.mjs"
sed -i 's#"./states.js"#"./states.mjs"#' "$TMP/engine.mjs"

cat > "$TMP/test.mjs" <<'NODE'
import { TVStateEngine } from './engine.mjs';
import { TV_STATES } from './states.mjs';

globalThis.window = {
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testAtomicTransition(fromState, toState) {
  const engine = new TVStateEngine();
  const emitted = [];
  engine.addEventListener('change', (event) => emitted.push(event.detail));

  engine.runScenario({
    steps: [
      { state: fromState, duration: 1 },
      { state: toState, duration: 5 },
    ],
  });

  emitted.length = 0;
  engine.tick();

  assert(engine.state === toState, `${fromState} did not transition to ${toState}`);
  assert(engine.remainingSeconds === 5, `${toState} duration not loaded atomically`);
  assert(
    !emitted.some((s) => s.state === fromState && s.remainingSeconds === 0),
    `${fromState} emitted an invalid expired 00:00 frame`,
  );
}

testAtomicTransition(TV_STATES.PRE_ADHAN, TV_STATES.ADHAN);
testAtomicTransition(TV_STATES.IQAMAH_COUNTDOWN, TV_STATES.IQAMAH);

console.log('runtime-zero-transition-clean');
NODE

if node "$TMP/test.mjs" 2>/dev/null | grep -Fq 'runtime-zero-transition-clean'; then
  pass "PRE_ADHAN 00:00 langsung transisi ke ADHAN"
  pass "IQAMAH_COUNTDOWN 00:00 langsung transisi ke IQAMAH"
  pass "Tidak ada expired countdown frame yang ter-render"
else
  fail "Runtime zero-transition regression test gagal"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
fi
echo "RESULT: FAIL"
exit 1
