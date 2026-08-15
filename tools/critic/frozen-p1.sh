#!/usr/bin/env bash
# Run any P1 probe against a FROZEN production build.
#
# The dev server full-reloads whenever another builder saves, which kills a
# Playwright run mid-drive with "Cannot read properties of undefined". That is
# the build process, not the game. This builds once, serves on its own port,
# runs the probe, and tears the server down.
#
#   tools/critic/frozen-p1.sh <probe.mjs> <out-dir> [extra args…]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROBE="${1:?usage: frozen-p1.sh <probe.mjs> <out-dir> [args…]}"; shift
OUT="${1:?usage: frozen-p1.sh <probe.mjs> <out-dir> [args…]}"; shift || true
PORT="${SNAPSHOT_PORT:-$((4800 + RANDOM % 600))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/p1-build.log 2>&1 || { tail -40 /tmp/p1-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/p1-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node "$PROBE" --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
