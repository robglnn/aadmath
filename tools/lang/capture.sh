#!/usr/bin/env bash
# Capture the language pass in all three locales against a FROZEN build.
#
# One server, three sessions, one report. Built once so the three locales are
# photographs of the same tree — with several builders hot-editing at the same
# time, three separate snapshot.sh runs are three different games.
#
#   tools/lang/capture.sh <out-prefix>
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-shots/lang}"
PORT="${LANG_PORT:-4791}"
cd "$ROOT"

npm run build >/tmp/lang-build.log 2>&1 || { tail -20 /tmp/lang-build.log; exit 1; }
# A plain static server over dist/. `vite preview` kept being torn down
# mid-run in this environment, which reads as a broken game and is not one.
(cd dist && python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/lang-preview.log 2>&1) &
SERVER=$!
trap 'kill -9 $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done

for L in en es pl; do
  echo "=== session $L ==="
  node tools/critic/session-drive.mjs --url "http://127.0.0.1:$PORT" \
    --out "$OUT-$L" --loc "$L" --mode wrong 2>&1 | tail -3
done
echo "=== report ==="
node tools/critic/report-shots.mjs --url "http://127.0.0.1:$PORT" --out "$OUT-report" 2>&1 | tail -3
