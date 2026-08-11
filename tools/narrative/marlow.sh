#!/usr/bin/env bash
# Frozen-build capture for Marlow's state awareness: builds the current tree,
# serves it on its own port, plays three cadets x three locales through the real
# game, tears the server down. Immune to the concurrent HMR that kills captures
# against the dev server.
#
#   tools/narrative/marlow.sh <out-dir>
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: marlow.sh <out-dir>}"; shift || true
PORT="${SNAPSHOT_PORT:-$((5300 + RANDOM % 400))}"
URL="http://127.0.0.1:$PORT"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/marlow-build.log 2>&1 || { tail -40 /tmp/marlow-build.log; exit 1; }

SERVER=""
cleanup() { [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null; }
trap cleanup EXIT

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/marlow-preview.log 2>&1 &
SERVER=$!
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "$URL/" && break
  sleep 0.5
done
curl -sf -o /dev/null "$URL/" || { echo "preview never came up on $PORT"; cat /tmp/marlow-preview.log; exit 1; }

node tools/narrative/marlow.mjs --url "$URL" --out "$OUT" "$@"
