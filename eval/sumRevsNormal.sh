#!/bin/bash
#WD: "/ElementaryJS/eval".
categories=("TIMEOUT"
  "EXIT FAILURE"
  "EXIT SUCCESS")
catLists=()
subCatSTATIC=("The rest parameter is not supported" # EXIT FAILURE > COMPILETIME
  "Do not use destructuring patterns"
  "You must initialize the variable"
  "Object member name must be an identifier"
  "Object member name may only be used once"
  "You must declare variable"
  "Do not use the '\S+' operator\. [^U]" # Will double count 'throw' below.
  "Do not use patterns"
  "Do not use the '.=' operator\. Use '.==' instead" # Could be expanded.
  "Do not use post-increment or post-decrement operators"
  "for statement " # Could be expanded.
  "enclosed in braces" # Could be expanded.
  "Use 'let' or 'const' to declare a variable"
  "Do not use the 'throw' operator"
  "Do not use the 'with' statement"
  "Do not use for-of loops"
  "Do not use for-in loops")
subCatDYNAMIC=("use Array\.create" # EXIT FAILURE > RUNTIME
  "create expects 2 arguments"
  "array size must be a positive integer"
  "expected a boolean expression, instead received"
  "must both be booleans"
  "array indexing called on a non-array value type"
  "array index " # (is not valid)
  "out of array bounds"
  "cannot access member of non-object value types"
  "object does not have member"
  "must be a number"
  "cannot set ." # (of array)
  "must both be numbers or strings"
  "must both be numbers$"
  "function \S+ expected")

revisions="$(find ./userFiles/ -type f -name "*_normal.log")"
echo "EJS is ON.
$(echo "$revisions" | wc -l) revisions found.

Collecting instances of..."

for i in "${categories[@]}"; do
  echo ..."$i"
  catLists+=("$(echo "$revisions" | xargs grep -HPlr "$i")")
done

echo "Collection complete.

Applying any subcategories and counting..."

for i in {0..2}; do
  list="${catLists["$i"]}"
  echo "${categories[$i]}": "$(echo "$list" | wc -l)"

  if [[ $i -eq 1 ]]; then # EXIT FAILURE
    for j in STATIC DYNAMIC; do
      total=0; subCat="subCat$j[@]" # TODO: Do this better.

      for k in "${!subCat}"; do
        res="$(echo "$list" | xargs grep -HPlnr "$k" | wc -l)"
        (( total += res ))
        echo "${categories[$i]}" "$j" \""$k"\": "$res"
      done
      echo "${categories[$i]}" "$j": "$total"
    done
  fi
done

echo Complete.
