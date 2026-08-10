#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT=$((5500 + RANDOM % 300))
cd "$ROOT"
npm run build >/tmp/eb.log 2>&1 || { tail -30 /tmp/eb.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/ep.log 2>&1 &
S=$!
trap 'kill $S 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node tools/critic/_errcheck.mjs "http://127.0.0.1:$PORT"
