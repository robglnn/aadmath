#!/usr/bin/env bash
set -uo pipefail
cd /Users/harrison/dev/aadmath
PORT=4488
npm run build >/tmp/l3l-build.log 2>&1 || { echo "BUILD FAILED"; exit 1; }
npx vite preview --host 127.0.0.1 --port $PORT --strictPort >/tmp/l3l-serve.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node tools/critic/landscape.mjs --url "http://127.0.0.1:$PORT" --out shots/l3-landscape
echo "LANDSCAPE EXIT=$?"
