'use strict';
/*
  This file supports compilation and execution of EJS from the command line.
  There are four modes:
    1. Normal/Default.
      $ node <relative path to>/eval.js <script>
    2. Testing: Run user specified tests.
      $ node <relative path to>/eval.js <script> 1
    3. Silent (i.e. off): Suppress EJS errors.
      $ node <relative path to>/eval.js <script> '' 1
    4. Silent Testing: Suppress EJS errors; run user specified tests.
      $ node <relative path to>/eval.js <script> 1 1
*/
const readFile = require('fs').readFile,
      ejs = require('../dist/index.js'),
      rt = require('../dist/runtime.js'),
      version = require('../dist/version.js'),
      lib220 = require('./libs/lib220.js'),
      oracle = require('./libs/oracle.js'),
      rrt = require('./libs/rrt.js');

if (process.argv.length < 3 || process.argv.length > 5) {
  console.error('Invalid number of arguments to \'eval\'.');
  process.exit(1);
}
const input = process.argv[2];

readFile(input, (e, f) => {
  if (e) { throw e; }
  try {
    const opts = {
            consoleLog: s => console.log(s),
            ejsOff: Boolean(process.argv[4]),
            version: () => console.log(version.EJSVERSION),
            whitelistCode: { lib220, oracle, rrt }
          },
          tOn = Boolean(process.argv[3]),
          compileResult = ejs.compile(f.toString(), opts);
    rt.enableTests(tOn);

    if (compileResult.kind === 'error') {
      throw `\n${compileResult.errors.map(e =>
        `- ${e.message} (line ${e.line})`).join('\n')}`;
    }

    compileResult.run(runResult => {
      if (runResult.type === 'exception') {
        throw `${runResult.value}\n\t${runResult.stack.join('\n\t')}`;
      }
      console.log(
        `${tOn ? `${rt.summary().output}\n` : ''}EXIT SUCCESS on input ${input}`
      );
    });
  } catch (e) {
    console.error(`EXIT FAILURE on input ${input}: ${e}`);
  }
});
