#!/usr/bin/env bash
set -u

GATEWAY="${1:-https://mjhk-tv-gateway.ffadilla-90.workers.dev}"
WORKER="worker-tv-mjhk/src/index.js"
WRANGLER="worker-tv-mjhk/wrangler.jsonc"

echo "=== MJHK TV CORS CONTRACT AUDIT ==="
echo "Gateway: $GATEWAY"
echo

echo "## 1. Worker source: CORS-related contract"
if [[ -f "$WORKER" ]]; then
  grep -nE \
    'cors|CORS|Origin|origin|Access-Control-Allow|OPTIONS|allowed.*origin|allow.*origin|Vary' \
    "$WORKER" | head -220
else
  echo "[FAIL] Missing $WORKER"
fi

echo
echo "## 2. Wrangler/config: origin-related values"
if [[ -f "$WRANGLER" ]]; then
  grep -nEi \
    'origin|cors|allow|5500|5501|5502|5503|mj-harapankita' \
    "$WRANGLER" || true
else
  echo "[WARN] Missing $WRANGLER"
fi

echo
echo "## 3. Repository references to local simulator origins"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  '127\.0\.0\.1:(5500|5501|5502|5503)|localhost:(5500|5501|5502|5503)' \
  worker-tv-mjhk tv-player scripts 2>/dev/null | head -220 || true

probe_get() {
  local origin="$1"
  echo
  echo "--- GET /health | Origin: $origin"
  curl -sS -D - -o /tmp/mjhk-cors-body-$$ \
    --max-time 15 \
    -H "Origin: $origin" \
    "$GATEWAY/health" \
    | grep -Ei \
      '^(HTTP/|access-control-allow-origin:|access-control-allow-methods:|access-control-allow-headers:|access-control-max-age:|vary:|content-type:)'
  printf "Body: "
  cat /tmp/mjhk-cors-body-$$ 2>/dev/null || true
  echo
}

probe_preflight_pair() {
  local origin="$1"
  echo
  echo "--- OPTIONS /v1/pair/claim | Origin: $origin"
  curl -sS -D - -o /dev/null \
    --max-time 15 \
    -X OPTIONS \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" \
    "$GATEWAY/v1/pair/claim" \
    | grep -Ei \
      '^(HTTP/|access-control-allow-origin:|access-control-allow-methods:|access-control-allow-headers:|access-control-max-age:|vary:)'
}

probe_preflight_device() {
  local origin="$1"
  echo
  echo "--- OPTIONS /v1/device/bootstrap | Origin: $origin"
  curl -sS -D - -o /dev/null \
    --max-time 15 \
    -X OPTIONS \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,x-mjhk-device-code" \
    "$GATEWAY/v1/device/bootstrap" \
    | grep -Ei \
      '^(HTTP/|access-control-allow-origin:|access-control-allow-methods:|access-control-allow-headers:|access-control-max-age:|vary:)'
}

echo
echo "## 4. Live deployed Gateway GET /health CORS matrix"
for origin in \
  "http://127.0.0.1:5500" \
  "http://127.0.0.1:5501" \
  "http://127.0.0.1:5502" \
  "http://127.0.0.1:5503" \
  "http://localhost:5500" \
  "http://localhost:5501" \
  "http://localhost:5502" \
  "https://www.mj-harapankita.or.id" \
  "https://mj-harapankita.or.id"
do
  probe_get "$origin"
done

echo
echo "## 5. Live deployed Gateway pairing preflight matrix"
for origin in \
  "http://127.0.0.1:5501" \
  "http://127.0.0.1:5502" \
  "http://127.0.0.1:5503" \
  "https://www.mj-harapankita.or.id"
do
  probe_preflight_pair "$origin"
done

echo
echo "## 6. Device-auth preflight matrix"
for origin in \
  "http://127.0.0.1:5501" \
  "http://127.0.0.1:5502" \
  "http://127.0.0.1:5503" \
  "https://www.mj-harapankita.or.id"
do
  probe_preflight_device "$origin"
done

rm -f /tmp/mjhk-cors-body-$$

echo
echo "## 7. Interpretation checklist"
echo "[CHECK] Allowed origin must receive Access-Control-Allow-Origin equal to the exact request Origin."
echo "[CHECK] Disallowed origin should NOT receive Access-Control-Allow-Origin."
echo "[CHECK] Pairing preflight must allow POST + Content-Type."
echo "[CHECK] Device preflight must allow Authorization + X-MJHK-Device-Code."
echo "[CHECK] No wildcard origin should be introduced for production."
echo "[CHECK] If source allows an origin but deployed Gateway does not, deployment is stale."
echo
echo "=== END CORS CONTRACT AUDIT ==="
