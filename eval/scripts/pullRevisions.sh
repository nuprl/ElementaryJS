#!/bin/bash
#WD: "/ElementaryJS".
#Requires line-separated list of users (L23); use "gsutil ls [bucket url] > users.txt" to generate.

mkdir userFiles
cd userFiles || exit

while IFS= read -r user; do
  id="$(md5sum <<< "$user" | cut -b-6)"

  gsutil -m ls -a $user > "./files.txt"
  node ../eval/scripts/processFilePaths.js

  mkdir "$id"
  cd "$id" || exit

  while IFS= read -r file; do
    read -ra array <<< "$file"
    # gsutil cp -Ar "${array[0]}" "${array[1]}"
  done < "../files.txt"

  cd ..
done < "../users.txt"

cd ..
rm ./userFiles/files.txt
