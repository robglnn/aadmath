#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PLAY_PORT:-4913}"
cd "$ROOT"
npm run build >/tmp/w13-pbuild.log 2>&1 || { tail -30 /tmp/w13-pbuild.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/w13-ppreview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node scratch/w13/play15.mjs --url "http://127.0.0.1:$PORT" "$@"
