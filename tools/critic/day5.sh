#!/usr/bin/env bash
# Play five real days against a FROZEN, PRIVATE copy of the build.
#
# snapshot.sh serves `dist/` in place. That is fine for a thirty-second capture
# and useless for a twenty-five minute one: several builders hot-edit this tree
# at once, and the first `npm run build` any of them runs empties `dist/` under
# the running server. Two days into a five-day run the page stops loading and
# the harness reports a failure that belongs to the build process. So the build
# is COPIED somewhere nobody else writes, and served from there.
#
#   tools/critic/day5.sh <out-dir> [extra day5.mjs args…]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-shots/day5}"; shift || true
PORT="${DAY5_PORT:-$((4900 + RANDOM % 400))}"
SERVE="$(mktemp -d /tmp/ascent-day5-XXXXXX)"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/day5-build.log 2>&1 || { tail -30 /tmp/day5-build.log; exit 1; }
cp -R dist/. "$SERVE/"

( cd "$SERVE" && python3 -m http.server "$PORT" --bind 127.0.0.1 ) >/tmp/day5-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$SERVE"' EXIT

for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node tools/critic/day5.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
