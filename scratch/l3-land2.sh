#!/usr/bin/env bash
cd /Users/harrison/dev/aadmath
PORT=4499
npx vite preview --host 127.0.0.1 --port $PORT --strictPort >/tmp/l3l2-serve.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
for loc in en es pl; do
  node tools/critic/landscape.mjs --url "http://127.0.0.1:$PORT" --out "shots/l3-land-$loc" --locales "$loc" > "/tmp/land-$loc.log" 2>&1
  echo "LOCALE $loc EXIT=$?  ok=$(grep -cE '^\s+ok ' /tmp/land-$loc.log) fail=$(grep -cE '^\s+FAIL' /tmp/land-$loc.log)"
done
