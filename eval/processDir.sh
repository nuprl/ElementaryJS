#!/bin/bash
#WD: "/ElementaryJS/eval".

# Get all dirs; find ./userFiles/ -type d -name "[0-9a-f]*"
if [[ -n $1 ]]; then
  cd "$1" || exit
  revs="$(for i in *.js; do wc -l "$i"; done)" # use loop as find doesn't preserve order.
  node ../../processDir.js "$1" "$revs" > stats.json
  cd ..
fi
