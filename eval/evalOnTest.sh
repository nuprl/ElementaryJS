#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time find ./userFiles/ -type f -name "*.js" | parallel ./evalOnTest.sh`.
# W/O: `time find ./userFiles/ -type f -name "*.js" -exec ./evalOnTest.sh {} \;`.

if [[ -n $1 ]]; then
  f="${1::-3}_on_test.log"
  # NOTE: <test file> must be a '.js' file, else in-line tests will be run.
  if ! timeout 120 node ./eval.js "$1" "<test file>" &> "$f"; then
    echo "SIGTERM" >> "$f"
  fi
fi
