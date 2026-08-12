#!/usr/bin/env bash
# Run any critic script against a FROZEN production build on its own port.
# Several builders hot-edit this tree at once and the dev server full-reloads
# mid-run, which kills Playwright with "Execution context was destroyed" and
# looks exactly like a defect in the game. See BRIEF.md.
#
#   tools/critic/frozen-run.sh tools/critic/coldplay.mjs [extra args…]
#
# The script is invoked with --url <frozen server> appended.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${1:?usage: frozen-run.sh <script.mjs> [args…]}"; shift || true
PORT="${FROZEN_PORT:-$((4300 + RANDOM % 400))}"

cd "$ROOT"
npm run build >/tmp/frozen-build.log 2>&1 || { tail -30 /tmp/frozen-build.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/frozen-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done
node "$SCRIPT" "$@" --url "http://127.0.0.1:$PORT"
