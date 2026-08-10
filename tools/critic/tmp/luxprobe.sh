#!/usr/bin/env bash
set -euo pipefail
ROOT=/Users/harrison/dev/aadmath
OUT="${1:?out}"; shift || true
PORT="${PROBE_PORT:-5311}"
cd "$ROOT"
npm run build >/tmp/luxprobe-build.log 2>&1 || { tail -30 /tmp/luxprobe-build.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/luxprobe-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node "$ROOT/tools/critic/tmp/luxprobe.mjs" --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
