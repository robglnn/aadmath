#!/usr/bin/env bash
# Every build critic, against ONE frozen build. Several builders hot-edit this
# tree at once and the dev server full-reloads mid-capture; and building three
# times over costs three minutes for no reason. See BRIEF.md.
#
#   tools/critic/buildall.sh <out-root> [script…]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-shots/build}"; shift || true
SCRIPTS=("$@")
[ ${#SCRIPTS[@]} -eq 0 ] && SCRIPTS=(handbuild buildtime buildworth)
PORT="${BUILD_PORT:-$((5900 + RANDOM % 400))}"

cd "$ROOT"
echo "building frozen snapshot…"
npm run build >/tmp/buildall-build.log 2>&1 || { tail -30 /tmp/buildall-build.log; exit 1; }

npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/buildall-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

fail=0
for s in "${SCRIPTS[@]}"; do
  echo ""
  echo "======================================================== $s"
  node "tools/critic/$s.mjs" --url "http://127.0.0.1:$PORT" --out "$OUT-$s" || fail=1
done
exit $fail
