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
      rrt = require('./libs/rrt.js'),
      TIMEOUT = 10000; // ms

if (process.argv.length < 3 || process.argv.length > 5) {
  console.error('Invalid number of arguments to \'eval\'.');
  process.exit(1);
}

const input = process.argv[2].trim().toLowerCase(),
      tests = process.argv[3] ? process.argv[3].trim().toLowerCase() : '';

function exitFailure(reason) {
  console.error(`EXIT FAILURE on input ${input}:${reason}`);
}

function exitSuccess(result) {
  console.log(`${result}EXIT SUCCESS on input ${input}`);
}

function run(compileResult, loadedTests) {
  new Promise((resolve, reject) => {
    const tId = global.setTimeout(() => reject(' TIMEOUT'), TIMEOUT);

    compileResult.run(runResult => {
      global.clearTimeout(tId);

      if (runResult.type === 'exception') {
        reject(` ${runResult.value}\n\t${runResult.stack.join('\n\t')}`);
      } else if (!tests) {
        resolve(true);
      } else {
        resolve(rt.enableTests(true)); // Has default timeout.
      }
    });
  }).then(result => {
    if (result) {
      exitSuccess('');
    } else {
      function _runResult(runResult) {
        if (runResult.type === 'exception') { // TODO: Is this even possible?
          exitFailure(` ${runResult.value}\n\t${runResult.stack.join('\n\t')}`);
        } else {
          exitSuccess(`${rt.summary().output}\n`);
        }
      }

      if (loadedTests) {
        compileResult.eval(loadedTests.toString(), _runResult);
      } else { // In-line tests.
        compileResult.run(_runResult);
      }
    }
  }, reason => {
    exitFailure(reason);
    process.exit(1); // Note: This seems wrong.
  }).catch(() => {});
}

readFile(input, (e, f) => {
  if (e) { throw e; }
  const opts = {
          consoleLog: s => console.log(s),
          ejsOff: Boolean(process.argv[4]),
          version: () => console.log(version.EJSVERSION),
          whitelistCode: { lib220, oracle, rrt }
        },
        compileResult = ejs.compile(f.toString(), opts);

  if (compileResult.kind === 'error') {
    return exitFailure(`\n${compileResult.errors.map(e =>
      `- ${e.message} (line ${e.line})`).join('\n')}`);
  }

  if (tests.endsWith('.js')) { // Separate tests.
    readFile(tests, (_e, _f) => {
      if (_e) { throw _e; }
      run(compileResult, _f);
    });
  } else { run(compileResult); }
});
