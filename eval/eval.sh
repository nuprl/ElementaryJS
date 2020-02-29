#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time -p find ./userFiles/ -type f -name "*.js" | parallel ./eval.sh`.
# W/O: `time -p find ./userFiles/ -type f -name "*.js" -exec ./eval.sh {} \;`.

if [[ -n $1 ]]; then
  f="${1::-3}_on.log" # NOTE: Change to '_off.log'.
  if ! timeout 10 node ./compileAndRun.js "$1" &> "$f"; then
    echo "TIMEOUT" >> "$f"
  fi
fi
