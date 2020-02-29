#!/bin/bash
#WD: "/ElementaryJS/eval".
# Requires line-separated list of users (L26); use "gsutil ls [bucket url] > users.txt" to generate.

# NOTE: This is too inefficient to scale effectively. Eliminating the reads and writes to 'files.txt',
#   as well as the separate node script will speed things up.

mkdir userFiles
cd userFiles || exit

while IFS= read -r user; do
  id="$(md5sum <<< "$user" | cut -b-6)"

  gsutil -m ls -a $user > "./files.txt"
  node ../pullRevisions.js ./files.txt

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
