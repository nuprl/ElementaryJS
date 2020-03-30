#!/bin/bash
#WD: "/ElementaryJS/eval".

# Get all dirs; find ./userFiles/ -type d -name "[0-9a-f]*"
if [[ -n $1 ]]; then
  cd "$1" || exit
  files="$(node ../../collateLogs.js)"

  for i in $files; do
    for j in _off _on; do # _off_test _on_test
      for k in "$i"_*"$j"\.log; do
        res+="$(cat "$k" 2> /dev/null)"
        res+=$'
----------------------------------------------------------------------------------------------------
'
      done
      echo "$res" > "$i""$j"_master.log
      res=''
    done
  done

  cd ..
fi
