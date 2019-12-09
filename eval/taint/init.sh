#!/bin/bash
#WD: "/ElementaryJS/eval/taint".

if [[ -d ./jalangi2 ]]; then
  if [[ ! -e ./jalangi2/src/js/runtime/analysis_copy.js ]]; then
    mv ./jalangi2/src/js/runtime/analysis.js \
      ./jalangi2/src/js/runtime/analysis_copy.js
  fi
  cp ./jAnalysisBackEnd.js ./jalangi2/src/js/runtime/analysis.js
else
  echo You must first clone \'ExpoSEJS/jalangi2\' on GH \
    and run \'npm i\' from w/i project root.
fi
