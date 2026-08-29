#!/usr/bin/env bash
set -u
cd /Users/harrison/dev/aadmath
node tools/critic/traffic.mjs --url http://127.0.0.1:4801 --minutes 18 --out shots/h-traffic-before2 > /tmp/h-traffic-before2.log 2>&1 &
A=$!
node tools/critic/traffic.mjs --url http://127.0.0.1:4802 --minutes 18 --out shots/h-traffic-after  > /tmp/h-traffic-after.log 2>&1 &
B=$!
wait $A; echo "before exit=$?"
wait $B; echo "after exit=$?"
