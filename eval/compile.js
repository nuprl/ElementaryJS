'use strict';
const ejs = require('../dist/index.js'),
      fs = require('fs'),
      version = require('../dist/version.js');

if (process.argv.length < 3) {
  console.error('Usage: node compile.js input.js');
  process.exit(1);
}
const input = process.argv[2];

try {
  const code = fs.readFileSync(input),
        opts = {
          consoleLog: s => console.log(s),
          isSilent: false,
          version: () => console.log(version.EJSVERSION),
          whitelistCode: {}
        },
        compilerResult = ejs.compile(code.toString(), opts);

  if (compilerResult.kind === 'error') {
    throw compilerResult.errors;
  }

  compilerResult.run(result => {
    if (result.type === 'exception') {
      throw result.stack;
    }
    console.log(`FINAL RESULT: ${result.value}`);
  });
} catch(e) {
  console.error(`Error compiling ${input}`, e);
}
