#!/usr/bin/env bash
# Run the hand proof against a FROZEN production build, on its own server.
#
# Same reason snapshot.sh exists: several builders hot-edit this tree at once,
# and a preview server left running between commands gets killed out from under
# a twelve-minute capture. This builds, serves, proves and tears down inside one
# process, so the server cannot outlive — or predecease — the run.
#
#   tools/critic/handproof.sh <out-dir> [extra handproof.mjs args…]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: handproof.sh <out-dir> [args…]}"; shift || true
PORT="${HANDPROOF_PORT:-$((4800 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/handproof-build.log 2>&1 || { tail -30 /tmp/handproof-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/handproof-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/handproof.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
