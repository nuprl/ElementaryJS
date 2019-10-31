'use strict';
const spawn = require('child_process').spawn;

if (process.argv.length < 4) {
  console.error('Invalid number of arguments to \'processDir\'.');
  process.exit(1);
}

const dirName = process.argv[2].slice(10, 16), // "userFiles/------/"
      revs = process.argv[3].split('\n'),
      stats = {
        _total_: {
          fileCount: 0,
          lineCount: 0,
          revCount: 0
        }
        // methods
      };

let fileName = '',
    fileSuffix = '',
    prevFile = '',
    prevRev = '',
    psList = [];

revs.forEach(line => {
  line = line.split(' ');

  stats._total_.revCount++;
  stats._total_.lineCount += +line[0];

  // We can't just split on '_' since that could be in the filename and split starts from beginning.
  fileName = line[1].substring(0, line[1].lastIndexOf('_'));
  fileSuffix = line[1].substring(line[1].lastIndexOf('_'));


  if (prevFile !== fileName) {
    prevFile = fileName;

    stats._total_.fileCount += 1;
    stats[prevFile] = {
      lineCount: +line[0],
      revCount: 1, // function() { return this.revs.length; }
      revs: [{
        rev: fileSuffix,
        time: +fileSuffix.substring(1, 14),
        lines: +line[0]
      }],
      diffs: []
    };
  } else {
    prevRev = stats[prevFile].revs[stats[prevFile].revs.length - 1];

    stats[prevFile].lineCount += +line[0];
    stats[prevFile].revCount++;
    stats[prevFile].revs.push({
      rev: fileSuffix,
      time: +fileSuffix.substring(1, 14),
      lines: +line[0]
    });

    (function(f1_name, f1_suffix, f2) {
      const diffPs = spawn('diff', [f1_name + f1_suffix, f2]);
      psList.push(diffPs);

      // Ignore stderr listener.
      diffPs.stdout.on('data', diff => {
        stats[f1_name].diffs.push([String(diff), String(diff).match(/\n/g).length]);
      });

      diffPs.on('close', code => {
        psList.splice(psList.indexOf(diffPs), 1);
        if (psList.length < 1) {
          console.log(JSON.stringify(stats, null, 2));
        }
      });
    }(prevFile, prevRev.rev, line[1]));
  }
});
