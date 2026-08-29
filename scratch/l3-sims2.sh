#!/usr/bin/env bash
cd /Users/harrison/dev/aadmath
node tools/simulate.mjs 800 900  --unit algebra1-l1 > /tmp/sim-l1.log 2>&1; echo "l1 done $?"
node tools/simulate.mjs 800 1300 --unit algebra1-l2 > /tmp/sim-l2.log 2>&1; echo "l2 done $?"
node tools/simulate.mjs 800 1100 --unit algebra1-l3 > /tmp/sim-l3.log 2>&1; echo "l3 done $?"
node tools/simulate.mjs 600 3600 --course algebra1  > /tmp/sim-course.log 2>&1; echo "course done $?"
