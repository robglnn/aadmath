#!/usr/bin/env bash
cd /Users/harrison/dev/aadmath
U=http://127.0.0.1:4802
run () { echo ""; echo "######## $1 ########"; date; eval "$2"; echo "EXIT[$1] = $?"; }
run "check:escape"     "node tools/critic/escapekey.mjs --url \$U 2>&1 | tail -22"
run "edge recovery x8" "node scratch/h/_edge.mjs --url \$U --n 8 2>&1 | tail -13"
run "roam AFTER(final)" "node scratch/h/_roam.mjs --url \$U --minutes 4 2>&1 | tail -4"
run "bench"            "node tools/critic/bench.mjs --url \$U 2>&1 | tail -28"
run "traffic steer=route" "node tools/critic/traffic.mjs --url \$U --minutes 18 --steer route --out shots/h-traffic-route 2>&1 | tail -14"
run "check:sustain"    "npm run --silent check:sustain 2>&1 | tail -30"
run "check:layout"     "node tools/critic/landscape.mjs --url \$U --out shots/h-landscape 2>&1 | tail -22"
echo "ALLDONE"
