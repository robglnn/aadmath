#!/usr/bin/env bash
# rungate.sh, plus the one thing it does not do: take the build OUT of the tree.
#
# `vite preview` serves `dist/` live, so a fifteen-minute gate run and another
# lane's `npm run build` in minute nine share a directory. The frozen snapshot
# is then not frozen, and half the readings are about a tree nobody measured.
# This copies the built `dist/` to a private directory first and serves THAT.
#
#   tools/critic/_laneFfrozen.sh <script.mjs> [args…]
#   NOBUILD=1 tools/critic/_laneFfrozen.sh <script.mjs>   # reuse the current dist
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${1:?usage: _laneFfrozen.sh <script.mjs> [args…]}"; shift || true
PORT="${GATE_PORT:-$((4800 + RANDOM % 400))}"
SNAP="${SNAP_DIR:-/tmp/laneF-snap-$PORT}"

cd "$ROOT"
if [ -z "${NOBUILD:-}" ]; then
  echo "building frozen snapshot…"
  npm run build >/tmp/laneF-build.log 2>&1 || { tail -30 /tmp/laneF-build.log; exit 1; }
fi
rm -rf "$SNAP"; mkdir -p "$SNAP"
cp -R dist/. "$SNAP/"
echo "serving a private copy of dist at $SNAP on :$PORT"

( cd "$SNAP" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/laneF-serve-$PORT.log 2>&1 ) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node "$SCRIPT" --url "http://127.0.0.1:$PORT" "$@"
