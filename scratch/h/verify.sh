#!/usr/bin/env bash
cd /Users/harrison/dev/aadmath
U=http://127.0.0.1:4802
run () {
  echo ""
  echo "######## $1 ########"
  date
  eval "$2"
  echo "EXIT[$1] = $?"
}
run "check:traverse" "npm run --silent check:traverse 2>&1 | tail -70"
run "check:escape"   "node tools/critic/escapekey.mjs --url \$U 2>&1 | tail -25"
run "check:reachable" "npm run --silent check:reachable 2>&1 | tail -20"
run "edge recovery x8" "node scratch/h/_edge.mjs --url \$U --n 8 2>&1 | tail -14"
run "roam BEFORE"    "node scratch/h/_roam.mjs --url http://127.0.0.1:4801 --minutes 4 2>&1 | tail -4"
run "roam AFTER"     "node scratch/h/_roam.mjs --url \$U --minutes 4 2>&1 | tail -4"
run "bench"          "node tools/critic/bench.mjs --url \$U 2>&1 | tail -30"
run "check:sustain"  "npm run --silent check:sustain 2>&1 | tail -32"
run "check:layout"   "node tools/critic/landscape.mjs --url \$U --out shots/h-landscape 2>&1 | tail -25"
echo "ALLDONE"
