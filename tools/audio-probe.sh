#!/usr/bin/env bash
# Record the real game's master bus off a frozen build, exactly the way
# snapshot.sh photographs it. Same reason: several builders edit this tree at
# once and a dev-server reload mid-recording produces a silence that is about
# the build process, not about the game.
#
#   tools/audio-probe.sh <out-dir>
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:?usage: audio-probe.sh <out-dir>}"; shift || true
PORT="${PROBE_PORT:-$((4900 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/audio-build.log 2>&1 || { tail -30 /tmp/audio-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/audio-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/audio-probe.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
