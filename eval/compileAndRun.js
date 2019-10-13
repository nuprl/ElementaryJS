'use strict';
const fs = require('fs'),
      ejs = require('../dist/index.js'),
      version = require('../dist/version.js'),
      lib220 = require('./libs/lib220.js'),
      oracle = require('./libs/oracle.js'),
      rrt = require('./libs/rrt.js');

if (process.argv.length < 3 || process.argv.length > 4) {
  console.error('Invalid number of arguments to \'compileAndRun\'.');
  process.exit(1);
}
const input = process.argv[2];

try {
  const code = fs.readFileSync(input),
        opts = {
          consoleLog: s => console.log(s),
          isSilent: Boolean(process.argv[3]),
          version: () => console.log(version.EJSVERSION),
          whitelistCode: { lib220, oracle, rrt }
        },
        compilerResult = ejs.compile(code.toString(), opts);

  if (compilerResult.kind === 'error') {
    throw compilerResult.errors.map(e => `- ${e.message} (line ${e.line})`).join('\n');
  }

  compilerResult.run(result => {
    if (result.type === 'exception') {
      throw result.value;
    }
    console.log(`EXIT SUCCESS on input ${input}`);
  });
} catch (e) {
  console.error(`EXIT FAILURE on input ${input}: ${e}`);
}
