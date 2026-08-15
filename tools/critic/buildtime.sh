#!/usr/bin/env bash
# Timing and the ramp-floor joint, against a FROZEN build. See BRIEF.md.
# tree at once and the dev server full-reloads mid-capture. See BRIEF.md.
#
#   tools/critic/buildtime.sh <out-dir>
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-shots/buildtime}"
PORT="${TIME_PORT:-$((5100 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/buildtime-build.log 2>&1 || { tail -30 /tmp/buildtime-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/buildtime-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/buildtime.mjs --url "http://127.0.0.1:$PORT" --out "$OUT"
