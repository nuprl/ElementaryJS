#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time find ./userFiles/ -type f -name "*.js" | parallel ./evalOff.sh`.
# W/O: `time find ./userFiles/ -type f -name "*.js" -exec ./evalOff.sh {} \;`.

if [[ -n $1 ]]; then
  node ./eval.js "$1" "" 1 &> "${1::-3}_off.log"
fi
