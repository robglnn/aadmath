#!/usr/bin/env bash
# Frozen capture that survives a tree full of other builders.
#
# snapshot.sh serves the live `dist/` with `vite preview`; with several agents
# building the same checkout at once that directory is rewritten underneath the
# server and the server itself gets caught by other people's cleanup. This
# copies the build somewhere private first and serves it with a plain static
# server, so a capture is a photograph of one known bundle.
#
#   tools/build-shot.sh <out-dir> [extra shoot.mjs args…]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:?usage: build-shot.sh <out-dir> [args…]}"; shift || true
PORT="${SHOT_PORT:-5311}"
SNAP="${TMPDIR:-/tmp}/ascent-snap-$$"

cd "$ROOT"
npm run build >"$SNAP.build.log" 2>&1 || { tail -30 "$SNAP.build.log"; exit 1; }
rm -rf "$SNAP"; cp -R dist "$SNAP"

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SNAP" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$SNAP" "$SNAP.build.log"' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.4; done

node tools/critic/shoot.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
