'use strict';
const readFile = require('fs').readFile;

readFile('./stats.json', 'utf8', (err, file) => {
  if (err) {
    console.warn(`Read ERROR: ${JSON.stringify(err)}`);
  } else {
    console.log(Object.keys(JSON.parse(file)).filter(f => f !== '_total_').join('\n'));
  }
});
