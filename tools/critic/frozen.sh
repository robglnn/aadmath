#!/usr/bin/env bash
# Run one probe against a frozen build of the CURRENT tree.
#
# Two things this fixes about `snapshot.sh`, both of which cost a round:
#   1. it builds into `dist/`, which every other builder's `npm run build` also
#      empties — two agents capturing at once photograph each other's
#      half-written bundle. This builds into a private directory.
#   2. it serves from a second process, and that process kept disappearing
#      mid-sweep. `_run.mjs` serves the build from inside the probe's own
#      process, so the server cannot outlive or predecease the probe.
#
#   tools/critic/frozen.sh <probe.mjs> [args…]     # --url is appended for you
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROBE="${1:?usage: frozen.sh <probe.mjs> [args…]}"; shift || true
OUTDIR="${FROZEN_DIST:-/tmp/ascent-frozen-$$}"

cd "$ROOT"
echo "building frozen tree → $OUTDIR"
npx vite build --outDir "$OUTDIR" --emptyOutDir >/tmp/frozen-build.log 2>&1 \
  || { tail -30 /tmp/frozen-build.log; exit 1; }

node tools/critic/_run.mjs "$OUTDIR" "$PROBE" "$@"
