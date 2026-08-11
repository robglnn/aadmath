#!/usr/bin/env bash
# Play whole sessions against a FROZEN build on its own port — immune to the
# other builders hot-editing this tree.
#
#   tools/session-play.sh <out-root> [extra session-play.mjs args…]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:?usage: session-play.sh <out-root> [args…]}"; shift || true
PORT="${SESSION_PORT:-$((4900 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/session-play-build.log 2>&1 || { tail -30 /tmp/session-play-build.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/session-play-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/session-play.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
