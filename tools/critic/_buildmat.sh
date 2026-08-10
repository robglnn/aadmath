#!/usr/bin/env bash
# Frozen-build wrapper for the material probe (see _buildmat.mjs).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: _buildmat.sh <out-dir>}"; shift || true
PORT="${SNAPSHOT_PORT:-$((5300 + RANDOM % 400))}"
cd "$ROOT"
npm run build >/tmp/matbuild.log 2>&1 || { tail -30 /tmp/matbuild.log; exit 1; }
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/matpreview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node tools/critic/_buildmat.mjs --url "http://127.0.0.1:$PORT" --out "$OUT" "$@"
