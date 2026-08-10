#!/usr/bin/env bash
# build once, serve on a fixed port, run an arbitrary node script against it
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${FPORT:-4791}"
cd "$ROOT"
npm run build >/tmp/frozen-build.log 2>&1 || { tail -30 /tmp/frozen-build.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/frozen-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
"$@" --url "http://127.0.0.1:$PORT"
