#!/usr/bin/env bash
# go.sh '<json steps>'  — send commands to the long-lived driver and print output
D=/tmp/w13
rm -f $D/done $D/out.txt
echo "$1" > $D/cmd.json
for i in $(seq 1 600); do [ -f $D/done ] && break; sleep 0.5; done
cat $D/out.txt
