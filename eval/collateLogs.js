'use strict';
const readFile = require('fs').readFile;

readFile('./stats.json', 'utf8', (err, file) => {
  if (err) {
    console.warn(`Read ERROR: ${JSON.stringify(err)}`);
  } else {
    const keys = Object.keys(JSON.parse(file));
    console.log(keys.shift() && keys.join('\n'));
  }
});
