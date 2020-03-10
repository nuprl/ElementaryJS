#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time -p find ./userFiles/ -type f -name "*.js" | parallel ./eval.sh`.
# W/O: `time -p find ./userFiles/ -type f -name "*.js" -exec ./eval.sh {} \;`.

if [[ -n $1 ]]; then
  # NOTE: Change to '_off.log' when silent.
  node ./eval.js "$1" &> "${1::-3}_on.log"
fi
