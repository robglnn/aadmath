#!/usr/bin/env bash
# Run the leak probe against a FROZEN, UNMINIFIED build.
#
# Frozen because several builders hot-edit this tree at once and Vite full-reloads
# the page mid-run — the probe died at minute one with "Execution context was
# destroyed", which is the build process, not the game.
# Unminified because the whole point of the probe is the JS stack that inserted
# the node, and `t.appendChild(r)` names nobody.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PROBE_PORT:-$((4900 + RANDOM % 300))}"
cd "$ROOT"
SERVER=""
trap 'kill $SERVER 2>/dev/null || true' EXIT

# Build until the frozen bundle actually BOOTS. Other builders are editing this
# tree while we run; a build taken across a half-saved file gives a bundle that
# throws on the first frame, and a fifteen-minute probe against it is fifteen
# minutes of nothing. Once a bundle boots it is frozen and immune.
for attempt in 1 2 3 4 5 6; do
  echo "building unminified probe bundle (attempt $attempt)…"
  if npx vite build --minify false --outDir scratch/perf/dist-probe >/tmp/probe-build.log 2>&1; then
    [ -n "$SERVER" ] && { kill $SERVER 2>/dev/null || true; sleep 1; }
    npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort --outDir scratch/perf/dist-probe >/tmp/probe-preview.log 2>&1 &
    SERVER=$!
    for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
    if node "$ROOT/scratch/perf/bootcheck.mjs" "http://127.0.0.1:$PORT"; then break; fi
  else
    tail -20 /tmp/probe-build.log
  fi
  echo "  the tree was mid-edit; waiting 45 s and rebuilding"
  sleep 45
done

node "$ROOT/scratch/perf/leakprobe.mjs" --url "http://127.0.0.1:$PORT" "$@"
