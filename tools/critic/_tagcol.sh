#!/usr/bin/env bash
# The tag-collision probe, against a FROZEN COPY of the build, on its own port.
#
# Same reason snapshot.sh exists — several builders hot-edit this tree at once —
# but one step further: `dist/` itself is shared, and a concurrent `npm run
# build` from another agent empties it out from under a running `vite preview`,
# which is how a capture run dies half way with ERR_CONNECTION_REFUSED. So the
# build is copied somewhere nobody else knows about and served from there.
#
#   tools/critic/_tagcol.sh <out-dir> [extra _tagcol.mjs args…]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: _tagcol.sh <out-dir> [args…]}"; shift || true
PORT="${TAGCOL_PORT:-$((4800 + RANDOM % 300))}"
SNAP="$(mktemp -d /tmp/tagcol-XXXXXX)"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/tagcol-build.log 2>&1 || { tail -30 /tmp/tagcol-build.log; exit 1; }
cp -R dist/. "$SNAP/"

( cd "$SNAP" && python3 -m http.server "$PORT" --bind 127.0.0.1 ) >/tmp/tagcol-serve.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$SNAP"' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

node tools/critic/_tagcol.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
