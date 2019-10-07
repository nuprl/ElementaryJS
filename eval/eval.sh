#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time -p find ./userFiles/ -type f -name "*.js" | parallel ./eval.sh`.
# W/O: `time -p find ./userFiles/ -type f -name "*.js" -exec ./eval.sh {} \;`.

if [[ -n $1 ]]; then
  f="${1::-3}.log" # ATTN: Change to '_normal.log' or '_silent.log'.
  node ./compileAndRun.js "$1" &> "$f"
fi
