#!/usr/bin/env bash
# Capture against a FROZEN production build instead of the dev server.
#
# Several builders hot-edit the same tree at once, so Vite regularly full-reloads
# the page mid-capture and Playwright dies with "Execution context was destroyed".
# That is an artefact of the build process, not a defect in the game — judging it
# as one wastes a round. This builds the current tree, serves it on its own port,
# captures, and tears the server down.
#
#   tools/critic/snapshot.sh <out-dir> [extra shoot.mjs args…]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: snapshot.sh <out-dir> [args…]}"; shift || true
PORT="${SNAPSHOT_PORT:-$((4200 + RANDOM % 600))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/snapshot-build.log 2>&1 || { tail -30 /tmp/snapshot-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/snapshot-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/shoot.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
