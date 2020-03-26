#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time sed 's/^./userFiles/' userFiles/tests/a<#>.txt | parallel ./evalOffTest.sh {} userFiles/tests/a<#>.js`.
# W/ <#> as the assignment number. Assumes `hwFiles.sh` has been run.

if [[ -n $1 ]]; then
  f="${1::-3}_off_test.log"
  tf="in-line"
  if [[ -n $2 ]]; then
    tf="$2" # separate file
  fi
  if ! timeout 120 node ./eval.js "$1" "$tf" 1 &> "$f"; then
    echo "SIGTERM" >> "$f"
  fi
fi
