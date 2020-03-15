#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time find ./userFiles/ -type f -name "*.js" | parallel ./evalOn.sh`.
# W/O: `time find ./userFiles/ -type f -name "*.js" -exec ./evalOn.sh {} \;`.

if [[ -n $1 ]]; then
  node ./eval.js "$1" &> "${1::-3}_on.log"
fi
