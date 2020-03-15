#!/bin/bash
filterAndWrite () {
  echo 'Filtering and generating final list...'

  for f in $1; do
    if [[ -z "$(node -c "$f" 2>&1 > /dev/null)" ]]; then
      list+="$f"$'\n'
    fi
  done

  echo -n "$list" | sort > tests/"$2".txt
}

cd "$(dirname "$0")"/userFiles || exit
mkdir -p tests

files="$(find . -type f -name '*.js')"

echo 'Gathering candidate assignment 1 files...'
a="$(echo "$files" \
  | xargs grep -Pl '^\s*(?:function +removeBlueAndGreen *\(|let +removeBlueAndGreen *=).+$' \
  | xargs grep -Pl '^\s*(?:function +makeGrayscale *\(|let +makeGrayscale *=).+$' \
  | xargs grep -Pl '^\s*(?:function +highlightEdges *\(|let +highlightEdges *=).+$' \
  | xargs grep -Pl '^\s*(?:function +blur *\(|let +blur *=).+$')"

filterAndWrite "$a" a1

echo 'Gathering candidate assignment 2 files...'
a="$(echo "$files" \
  | xargs grep -Pl '^\s*(?:function +imageMap *\(|let +imageMap *=).+$' \
  | xargs grep -Pl '^\s*(?:function +imageMask *\(|let +imageMask *=).+$' \
  | xargs grep -Pl '^\s*(?:function +blurPixel *\(|let +blurPixel *=).+$' \
  | xargs grep -Pl '^\s*(?:function +blurImage *\(|let +blurImage *=).+$' \
  | xargs grep -Pl '^\s*(?:function +isDark *\(|let +isDark *=).+$' \
  | xargs grep -Pl '^\s*(?:function +darken *\(|let +darken *=).+$' \
  | xargs grep -Pl '^\s*(?:function +isLight *\(|let +isLight *=).+$' \
  | xargs grep -Pl '^\s*(?:function +lighten *\(|let +lighten *=).+$' \
  | xargs grep -Pl '^\s*(?:function +lightenAndDarken *\(|let +lightenAndDarken *=).+$')"

filterAndWrite "$a" a2

echo 'Gathering candidate assignment 3 files...'
a="$(echo "$files" \
  | xargs grep -Pl '^\s*(?:function +generateInput *\(|let +generateInput *=).+$' \
  | xargs grep -Pl '^\s*(?:function +oracle *\(|let +oracle *=).+$')"

filterAndWrite "$a" a3

echo 'Gathering candidate assignment 4 files...'
a="$(echo "$files" \
  | xargs grep -Pl '^\s*class +FluentRestaurants.*$' \
  | xargs grep -Pl '^\s*constructor *\(.+$' \
  | xargs grep -Pl '^\s*fromState *\(.+$' \
  | xargs grep -Pl '^\s*ratingLeq *\(.+$' \
  | xargs grep -Pl '^\s*ratingGeq *\(.+$' \
  | xargs grep -Pl '^\s*category *\(.+$' \
  | xargs grep -Pl '^\s*hasAmbience *\(.+$' \
  | xargs grep -Pl '^\s*bestPlace *\(.+$')"

filterAndWrite "$a" a4

echo 'Gathering candidate assignment 5 files...'
a="$(echo "$files" \
  | xargs grep -Pl '^\s*(?:function +interpExpression *\(|let +interpExpression *=).+$' \
  | xargs grep -Pl '^\s*(?:function +interpStatement *\(|let +interpStatement *=).+$' \
  | xargs grep -Pl '^\s*(?:function +interpProgram *\(|let +interpProgram *=).+$')"

filterAndWrite "$a" a5

echo 'Gathering candidate assignment 6 files...'
a="$(echo "$files" \
  | xargs grep -Pl '^\s*class +Tree.*$' \
  | xargs grep -Pl '^\s*constructor *\(.+$' \
  | xargs grep -Pl '^\s*nearest *\(.+$' \
  | xargs grep -Pl '^\s*extend *\(.+$' \
  | xargs grep -Pl '^\s*add *\(.+$' \
  | xargs grep -Pl '^\s*(?:function +distance *\(|let +distance *=).+$' \
  | xargs grep -Pl '^\s*(?:function +samplePoint *\(|let +samplePoint *=).+$' \
  | xargs grep -Pl '^\s*(?:function +collides *\(|let +collides *=).+$' \
  | xargs grep -Pl '^\s*(?:function +getPath *\(|let +getPath *=).+$' \
  | xargs grep -Pl '^\s*(?:function +plan *\(|let +plan *=).+$')"

filterAndWrite "$a" a6
echo 'DONE.'
