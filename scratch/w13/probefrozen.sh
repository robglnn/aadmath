#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${1}"; shift
PORT="${PROBE_PORT:-4931}"
cd "$ROOT"
npm run build >/tmp/w13-qbuild.log 2>&1 || { tail -30 /tmp/w13-qbuild.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/w13-qpreview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node "$SCRIPT" --url "http://127.0.0.1:$PORT" "$@"
