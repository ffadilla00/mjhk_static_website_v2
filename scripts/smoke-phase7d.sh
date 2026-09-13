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

ask "Agenda terdekat apa?"
ask "Ada seminar terdekat?"
ask "Ada pelatihan terdekat?"
ask "Ada kegiatan dakwah?"
ask "Ada kajian tafsir Al-Quran?"
ask "Berapa saldo kas MJHK saat ini?"
ask "Berapa pemasukan laporan terbaru?"
ask "Berapa pengeluaran laporan terbaru?"
ask "Bagaimana keuangan September 2026?"
ask "Berapa pemasukan September 2026?"
ask "Berapa total infaq September 2026?"
ask "Bagaimana keuangan tahun 2026?"
ask "Siapa presiden Indonesia?"
