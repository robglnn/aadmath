#!/usr/bin/env bash
# Frozen-build capture for the narrative surfaces: builds, serves on its own
# port, runs the main critic harness AND the arc-specific capture against the
# same server, tears it down. Same immunity to concurrent HMR as snapshot.sh.
#
# It re-checks the preview between captures and restarts it if it has gone:
# several agents work this tree at once and a stray `pkill vite` from any of
# them would otherwise cost a whole round.
#
#   tools/narrative/snap.sh <out-dir>
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: snap.sh <out-dir>}"; shift || true
PORT="${SNAPSHOT_PORT:-$((4900 + RANDOM % 400))}"
URL="http://127.0.0.1:$PORT"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/narrative-build.log 2>&1 || { tail -40 /tmp/narrative-build.log; exit 1; }

SERVER=""
cleanup() { [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null; }
trap cleanup EXIT

ensure_server() {
  curl -sf -o /dev/null "$URL/" && return 0
  npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/narrative-preview.log 2>&1 &
  SERVER=$!
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "$URL/" && { echo "preview up on $PORT"; return 0; }
    sleep 0.5
  done
  echo "preview never came up on $PORT"; cat /tmp/narrative-preview.log; return 1
}

ensure_server || exit 1
node tools/critic/shoot.mjs --url "$URL" --out "$OUT"
MAIN=$?
ensure_server || exit 1
node tools/narrative/shoot.mjs --url "$URL" --out "$OUT"
NARR=$?
if [ "$NARR" != 0 ]; then
  echo "narrative capture failed — re-checking the server and retrying once"
  ensure_server || exit 1
  node tools/narrative/shoot.mjs --url "$URL" --out "$OUT"
  NARR=$?
fi
echo "main harness exit $MAIN · narrative capture exit $NARR"
[ "$MAIN" = 0 ] && [ "$NARR" = 0 ]
