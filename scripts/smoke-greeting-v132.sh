#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-http://127.0.0.1:8787}"
ORIGIN="${2:-http://127.0.0.1:5500}"

ask() {
  local q="$1"
  echo
  echo ">>> $q"
  curl -sS -X POST "$BASE/ask" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    --data "{\"question\":\"$q\"}"
  echo
}

echo "=== HEALTH ==="
curl -sS "$BASE/health"
echo

ask "Assalamualaikum"
ask "Assalamu'alaikum"
ask "Assalamu alaikum"
ask "Salam"
ask "Halo"
ask "Selamat pagi"

ask "Assalamualaikum, ada kajian terdekat?"
ask "Assalamu'alaikum, ada seminar terdekat?"
ask "Assalamualaikum berapa saldo kas MJHK?"
ask "Selamat pagi, bagaimana keuangan September 2026?"
