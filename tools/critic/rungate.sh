#!/usr/bin/env bash
# Run one critic against a FROZEN build on a private port, then tear it down.
#
# The same reason tools/critic/snapshot.sh exists — several builders hot-edit
# this tree at once and a dev server full-reloads mid-capture — plus one more:
# a long gate outlives the shell that started a shared preview server, and a
# matrix that reports ERR_CONNECTION_REFUSED for nine viewports has measured
# the harness rather than the game.
#
#   tools/critic/rungate.sh <script.mjs> [args…]      # builds, serves, runs
#   NOBUILD=1 tools/critic/rungate.sh <script.mjs>    # reuse the current dist
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${1:?usage: rungate.sh <script.mjs> [args…]}"; shift || true
PORT="${GATE_PORT:-$((4300 + RANDOM % 600))}"

cd "$ROOT"
if [ -z "${NOBUILD:-}" ]; then
  echo "building frozen snapshot…"
  npm run build >/tmp/rungate-build.log 2>&1 || { tail -30 /tmp/rungate-build.log; exit 1; }
fi

# A SUPERVISOR, NOT A SERVER.
#
# These gates run for the better part of an hour, and a preview process that
# dies at minute fifty turns the last nine viewports into ERR_CONNECTION_REFUSED
# — which reads exactly like a layout failure in the summary and is not one.
# Restart it, quietly, for as long as the gate is still running.
(
  while true; do
    npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >>/tmp/rungate-preview-$PORT.log 2>&1
    sleep 1
  done
) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; pkill -f "vite preview .*--port $PORT" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node "$SCRIPT" --url "http://127.0.0.1:$PORT" "$@"
