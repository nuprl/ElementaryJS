import { Result } from '../src/index';
import * as runtime from '../src/runtime';
import { compileOpts, compileOK, run } from './test-utils';

// Returns the expected failure message from testing
function testFailure(description: string, errorMsg: string = 'Error: Assertion failed.') {
  return ` FAILED  ${description}\n         ${errorMsg}`;
}

// Returns the expected OK message from testing
function testOk(description: string) {
  return ` OK      ${description}`;
}

// Returns the expected test summary given number failed and number passed
function testSummary(failed: number, passed: number) {
  return failed > 0 ?
    `Tests:     ${failed} failed, ${passed} passed, ${failed + passed} total.` :
    `Tests:     ${passed} passed, ${failed + passed} total.`;
}

describe('ElementaryJS Test Mode', () => {

  beforeEach(() => {
    runtime.enableTests(true);
  });

  test('Break out of an infinite loop', async () => {
    runtime.enableTests(true, 2000);
    await expect(run(`
      test('loop forever', function() {
        while(true) {};
      });
    `)).resolves.toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testFailure('loop forever', 'Time limit exceeded.'),
      testSummary(1, 0)
    ].join('\n'));
  });

  test('Break out of an infinite loop and run next test', async () => {
    runtime.enableTests(true, 2000);
    await expect(run(`
      test('loop forever', function() {
        while(true) {};
      });
      test('succeeds', function() {});
    `)).resolves.toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testFailure('loop forever', 'Time limit exceeded.'),
      testOk('succeeds'),
      testSummary(1, 1)
    ].join('\n'));
  }, 3000);

  test('Higher order functions with infinite loop', async () => {
    runtime.enableTests(true, 3000); // time out of 3 seconds
    expect(await run(`
      function takeInFunc(func, arr) {
        const val = func(arr);
        while (true) {}
        return val;
      }
      function adder(num) {
        while (true) {}
        return function(x) { return x + num; };
      }
      test('higher order', function() {
        takeInFunc(function(x) { return 1; }, 1);
      });
      test('adder', function() { adder(1)(2) });
    `)).toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testFailure('higher order', 'Time limit exceeded.'),
      testFailure('adder', 'Time limit exceeded.'),
      testSummary(2, 0)
    ].join('\n'));
  }, 7000); // should take no more than 7 seconds (running two tests)

  test('HOFs running a while', async () => {
    runtime.enableTests(true, 3000); // timeout of 3 seconds
    expect(await run(`
      function hof(func) {
        const newFunc = function(x) { return 2 + func(x); };
        let x = -9999999;
        while (x !== 9999999) {
          x += 1;
        }
        return newFunc;
      }
      test('run a while', function() { hof(function(x) { return x + 1; }); });
    `)).toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testFailure('run a while', 'Time limit exceeded.'),
      testSummary(1, 0),
    ].join('\n'));
  }, 4000); // should take no more than 4 seconds

  test('No tests', () => {
    expect(runtime.summary(false).output).toBe([
      `◈ You do not seem to have any tests written.`,
      `◈ To run a test, begin a function name with 'test'.`
    ].join('\n'));
  });

  test('Assert test', () => {
    expect(runtime.assert(true)).toBe(true);
    expect(() => {
      runtime.assert(false);
    }).toThrow('Assertion failed.');
    expect(() => {
      runtime.assert(2 as any);
    }).toThrow(`Assertion argument '2' is not a boolean value.`);
  });

  test('One OK test', async () => {
    expect(await run(`test('Test 1', function() {});`)).toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testOk('Test 1'),
      testSummary(0, 1)
    ].join('\n'));
  });

  test('One failed Test', async () => {
    expect(await run(`test('Failed Test', function() {
      assert(false);
    });`)).toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testFailure('Failed Test'),
      testSummary(1, 0)
    ].join('\n'));
  });

  test('One OK, One failed', async () => {
    expect(await run(`
      test('Ok test', function() { return 1; });
      test('Failed', function() { assert(false); });
    `)).toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testOk('Ok test'),
      testFailure('Failed'),
      testSummary(1, 1),
    ].join('\n'));
  });

  test('20 tests', async () => {
    expect(await run(`
      for (let i = 0; i < 10; ++i) {
        test(i.toString(), function() { return 1; });
      }
      for (let i = 10; i < 20; ++i) {
        test(i.toString(), function() { assert(false); });
      }
    `)).toBeUndefined();
    const output: string[] = [];
    for (let i = 0; i < 10; i++) {
      output.push(testOk(i.toString()));
    }
    for (let i = 10; i < 20; i++) {
      output.push(testFailure(i.toString()));
    }
    output.push(testSummary(10, 10));
    expect(runtime.summary(false).output).toBe(output.join('\n'));
  });

  test('Tests not enabled', () => {
    runtime.enableTests(false);
    runtime.test('Test', () => { runtime.assert(false); });
    expect(runtime.summary(false).output).toMatch(/not enabled/);
  });

  test('Summary twice not allowed', () => {
    runtime.summary(false);
    expect(runtime.summary(false).output).toMatch(/not enabled/);
  });

  test('Stopify bug: arguments array materialization and boxing interacts poorly', done => {
    const runner = compileOK(`
      let r1 = false,
          r2 = false,
          r3 = false,
          r4 = false;
      function oracle(x) {
        let b = true;
        test('Test 1', function() {
          r1 = x === 900;
        });
        r2 = x === 900;
        test('Test 2', function() {
          r3 = x === 900;
        });
        r4 = x === 900;
      }
      oracle(900);
    `);
    runner.run((result: Result) => {
      expect(runner.g.r1).toBe(true);
      expect(runner.g.r2).toBe(true);
      expect(runner.g.r3).toBe(true);
      expect(runner.g.r4).toBe(true);
      done();
    });
  });
});
