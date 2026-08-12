#!/usr/bin/env bash
# The hand-built proof, against a FROZEN build — several builders hot-edit this
# tree at once and the dev server full-reloads mid-capture. See BRIEF.md.
#
#   tools/critic/handbuild.sh <out-dir>
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-shots/handbuild}"
PORT="${HAND_PORT:-$((4700 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/handbuild-build.log 2>&1 || { tail -30 /tmp/handbuild-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/handbuild-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/handbuild.mjs --url "http://127.0.0.1:$PORT" --out "$OUT"
