#!/usr/bin/env bash
# gate.sh <dist-dir> <gate.mjs> [args…]
#
# Serve a frozen bundle and run one critic against it, with the server's whole
# life inside this one process. A preview server started as a separate
# background job gets reaped between steps and every frame of the gate then
# fails with ERR_CONNECTION_REFUSED — which looks exactly like a broken game
# and is not one.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="$1"; GATE="$2"; shift 2
PORT="${GATE_PORT:-$((5400 + RANDOM % 400))}"
cd "$ROOT"
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort --outDir "$DIST" >/tmp/gate-serve.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
node "$GATE" --url "http://127.0.0.1:$PORT" "$@"
echo "GATE EXIT=$?"
