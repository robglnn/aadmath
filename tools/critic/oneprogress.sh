#!/usr/bin/env bash
# THE ONE-NUMBER GATE, against a FROZEN build.
#
# `oneprogress.mjs` plays a whole session — several minutes of real keys — and
# several builders hot-edit this tree at once. A Vite full-reload halfway through
# does not merely kill the capture: it leaves the HUD tweening from a state that
# no longer exists, and this gate has already reported "WORLD REPAIRED -272%"
# for exactly that reason. A frozen build cannot be edited underneath the run,
# so the only failures it can report are real ones.
#
#   tools/critic/oneprogress.sh <out-dir> [extra oneprogress.mjs args…]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: oneprogress.sh <out-dir> [args…]}"; shift || true
PORT="${SNAPSHOT_PORT:-$((4800 + RANDOM % 600))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/oneprogress-build.log 2>&1 || { tail -30 /tmp/oneprogress-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/oneprogress-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/oneprogress.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
