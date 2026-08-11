#!/usr/bin/env bash
# Capture a whole session against a FROZEN production build, the way
# tools/critic/snapshot.sh does — several builders hot-edit this tree at once
# and the dev server will reload the page out from under a twenty-shot run.
#
#   tools/session-shot.sh <out-dir> [extra session-shot.mjs args…]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:?usage: session-shot.sh <out-dir> [args…]}"; shift || true
PORT="${SNAPSHOT_PORT:-$((4800 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/session-build.log 2>&1 || { tail -30 /tmp/session-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/session-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/session-shot.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
