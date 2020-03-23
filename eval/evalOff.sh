#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time find ./userFiles/ -type f -name "*.js" | parallel ./evalOff.sh`.
# W/O: `time find ./userFiles/ -type f -name "*.js" -exec ./evalOff.sh {} \;`.

if [[ -n $1 ]]; then
  f="${1::-3}_off.log"
  if ! timeout 120 node ./eval.js "$1" "" 1 &> "$f"; then
    echo "SIGTERM" >> "$f"
  fi
fi
