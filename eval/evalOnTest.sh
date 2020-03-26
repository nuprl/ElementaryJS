#!/bin/bash
#WD: "/ElementaryJS/eval".

# W/ GNU PARALLEL: `time sed 's/^./userFiles/' userFiles/tests/a<#>.txt | parallel ./evalOnTest.sh {} userFiles/tests/a<#>.js`.
# W/ <#> as the assignment number. Assumes `hwFiles.sh` has been run.

if [[ -n $1 ]]; then
  f="${1::-3}_on_test.log"
  tf="in-line"
  if [[ -n $2 ]]; then
    tf="$2" # separate file
  fi
  if ! timeout 120 node ./eval.js "$1" "$tf" &> "$f"; then
    echo "SIGTERM" >> "$f"
  fi
fi
