#!/usr/bin/env bash
# usage: c.sh '<json array of commands>'
set -e
echo "$1" > /tmp/cold/cmd.json
for i in $(seq 1 200); do
  if [ /tmp/cold/out.json -nt /tmp/cold/cmd.json ]; then break; fi
  sleep 0.4
done
cat /tmp/cold/out.json
