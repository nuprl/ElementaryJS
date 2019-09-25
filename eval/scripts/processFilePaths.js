'use strict';
const fs = require('fs');
// Brittle script to process file paths from GCP. Invoked from Bash script.
fs.readFile(`${process.cwd()}/files.txt`, 'utf8', (err, file) => {
  if (err) {
    console.warn(`Read ERROR: ${JSON.stringify(err)}`);
  } else {
    file = file.split('\n');
    file.pop(); // Trailing newline.
    file.forEach((path, index, array) => {
      array[index] =
        `${path} .${path.substring(path.lastIndexOf('/'), path.lastIndexOf('.'))}_${path.substring(path.lastIndexOf('#') + 1)}.js`;
    });
    file = file.join('\n');

    fs.writeFile(`${process.cwd()}/files.txt`, file, (err) => {
      if (err) {
        console.warn(`Write ERROR: ${JSON.stringify(err)}`);
      }
    });
  }
});
