#!/usr/bin/env bash
# The takeover audit, against a FROZEN production build.
#
# A fifteen-minute play run is the longest capture in this repo, which makes it
# the one most certain to be killed by another builder saving a file: Vite
# full-reloads the page and Playwright dies with "Execution context was
# destroyed" twelve minutes in. Same reasoning as snapshot.sh, higher stakes.
#
#   tools/critic/takeover.sh <out-dir> [--minutes 15] [--loc es]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: takeover.sh <out-dir> [args…]}"; shift || true
PORT="${TAKEOVER_PORT:-$((4200 + RANDOM % 600))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/takeover-build.log 2>&1 || { tail -30 /tmp/takeover-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/takeover-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/takeover.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
