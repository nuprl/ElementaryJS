#!/bin/bash
#WD: "/ElementaryJS/eval/taint".

if [[ -n $1 ]]; then
  cd jalangi2 || exit
  node src/js/commands/direct.js --analysis ../jAnalysisFrontEnd.js ../"$1"
fi
