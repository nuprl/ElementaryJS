#!/bin/bash
#WD: "/ElementaryJS/eval".

mkdir libs
curl -K ./fetchLibs.txt
echo "Libraries downloaded.
You must edit them s.t. they can be 'required' by 'eval.js'."
