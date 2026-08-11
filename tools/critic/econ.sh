#!/usr/bin/env bash
# The economy probe, against a FROZEN build on its own port — same reasoning as
# tools/critic/snapshot.sh: several builders hot-edit this tree at once.
#
#   tools/critic/econ.sh [extra econ.mjs args…]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${SNAPSHOT_PORT:-$((4800 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/econ-build.log 2>&1 || { tail -30 /tmp/econ-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/econ-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/econ.mjs --url "http://127.0.0.1:$PORT" "$@"
