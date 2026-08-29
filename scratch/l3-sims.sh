#!/usr/bin/env bash
cd /Users/harrison/dev/aadmath
for spec in "--unit algebra1-l1:800:900" "--unit algebra1-l2:800:1300" "--unit algebra1-l3:800:1100"; do
  sel="${spec%%:*}"; rest="${spec#*:}"; L="${rest%%:*}"; B="${rest##*:}"
  echo "##### $sel  learners=$L budget=$B"
  node tools/simulate.mjs "$L" "$B" $sel 2>&1 | grep -E "true mastery|lowest|quintile|hollow|engine declared|mean hidden|every one of|PASS|FAIL|sitting|sessions|median .*min" | head -30
  echo
done
echo "##### --course algebra1  learners=600 budget=3600"
node tools/simulate.mjs 600 3600 --course algebra1 2>&1 | tail -45
