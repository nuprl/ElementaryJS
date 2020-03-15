#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time find ./userFiles/ -type f -name "*.js" | parallel ./evalOnTest.sh`.
# W/O: `time find ./userFiles/ -type f -name "*.js" -exec ./evalOnTest.sh {} \;`.

if [[ -n $1 ]]; then
  # NOTE: <test file> must be a '.js' file, else in-line tests will be run.
  node ./eval.js "$1" "<test file>" &> "${1::-3}_on_test.log"
fi
