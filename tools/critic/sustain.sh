#!/usr/bin/env bash
# The sustained-frame gate, against a FROZEN production build.
#
# A fifteen-minute play run is the longest capture in this repo alongside the
# takeover audit, and it is the one where a mid-run Vite full-reload does the
# most damage: the whole point of the measurement is the SLOPE from minute one
# to minute fifteen, and a page that reloads at minute nine resets every
# accumulating counter to zero and reports a perfectly healthy session. Same
# reasoning as snapshot.sh; the stakes here are that the gate would pass a
# build with the exact defect it exists to catch.
#
#   tools/critic/sustain.sh <out-dir> [--minutes 15] [--fps 55]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: sustain.sh <out-dir> [args…]}"; shift || true
PORT="${SUSTAIN_PORT:-$((4800 + RANDOM % 600))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/sustain-build.log 2>&1 || { tail -30 /tmp/sustain-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/sustain-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/sustain.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
