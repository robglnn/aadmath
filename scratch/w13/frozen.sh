#!/usr/bin/env bash
# Run ANY critic script against a frozen production build, the way snapshot.sh
# does for shoot.mjs. Several builders hot-edit this tree at once; the dev server
# full-reloads mid-capture and the harness dies on "Execution context destroyed".
#
#   scratch/w13/frozen.sh tools/critic/coldplay.mjs --out shots/x
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${1:?usage: frozen.sh <critic.mjs> [args…]}"; shift || true
PORT="${FROZEN_PORT:-$((4800 + RANDOM % 400))}"

cd "$ROOT"
npm run build >/tmp/w13-build.log 2>&1 || { tail -30 /tmp/w13-build.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/w13-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done
node "$SCRIPT" --url "http://127.0.0.1:$PORT" "$@"
