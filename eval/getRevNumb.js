'use strict';
const fs = require('fs');

if (!process.argv[2]) {
  console.error('Please pass a file path to \'getRevNumb\'.');
  process.exit(1);
}

let path = process.argv[2].split('/'),
    rev = path.pop().split('_');

path = (path.length > 0 ? ((path[0] === '.' ? '' : '.') +
  path.join('/')) : '.') + '/stats.json';

if (rev.length > 2) {
  const hold = rev.pop();
  rev = rev.join('_');
  rev.push('_' + hold);
} else {
  rev[1] = '_' + rev[1];
}

fs.readFile(path, 'utf8', (err, file) => {
  if (err) {
    console.warn(`Read ERROR: ${JSON.stringify(err)}`);
  } else {
    const obj = JSON.parse(file)[rev[0]];
    for (let i = 0; i < obj.revCount; i++) {
      if (obj.revs[i].rev === rev[1]) {
        console.log(i);
        break;
      }
    }
  }
});
