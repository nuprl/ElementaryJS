#!/bin/bash
#WD: "/ElementaryJS/eval".
categories=("TIMEOUT"
  "EXIT FAILURE"
  "EXIT SUCCESS"
  "COMPILETIME ERROR"
  "RUNTIME ERROR")
catLists=()
subCat0=("COMPILETIME ERROR" # TIMEOUT
  "RUNTIME ERROR")
subCat1=("COMPILETIME ERROR" # EXIT FAILURE
  "RUNTIME ERROR")
subCat2=("COMPILETIME ERROR" # EXIT SUCCESS
  "RUNTIME ERROR")
subCat3=("RUNTIME ERROR" # COMPILETIME ERROR
  "1 EJS"
  "2 EJS"
  "3 EJS"
  "4 EJS"
  "5 EJS"
  "6 EJS"
  "7 EJS"
  "8 EJS"
  "9 EJS"
  "10 EJS"
  "11 EJS"
  "12 EJS"
  "13 EJS"
  "14 EJS"
  "15 EJS"
  "16 EJS")
# subCat4=() # RUNTIME ERROR

revisions="$(find ./userFiles/ -type f -name "*_off.log")"
echo "EJS is OFF.
$(echo "$revisions" | wc -l) revisions found.

Collecting instances of..."

for i in "${categories[@]}"; do
  echo ..."$i"
  catLists+=("$(echo "$revisions" | xargs grep -HPlr "$i")")
done

echo "Collection complete.

Applying any subcategories and counting..."

for i in {0..3}; do
  list="${catLists["$i"]}"; subCat="subCat$i[@]" # TODO: Do this better.
  echo "${categories["$i"]}": "$(echo "$list" | wc -l)"

  for j in "${!subCat}"; do
    echo "${categories[$i]}" '&&' "$j": "$(echo "$list" | xargs grep -HPlnr "$j" | wc -l)"
  done
done

echo Complete.
