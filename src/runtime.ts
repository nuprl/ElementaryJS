import { EJSVERSION } from './version';
import { TestResult } from './types';
import * as stopify from '@stopify/stopify';

let ejsOff: boolean = false;
export function disableEJS() { ejsOff = true; }

export function version() { return EJSVERSION; }

export class ElementaryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function errorHandle(err: string, check: string, line?: number) {
  if (!ejsOff) { // Normal EJS
    throw new ElementaryRuntimeError(err);
  }
  // tslint:disable-next-line:no-console
  console.warn(`EJS RUNTIME ERROR SUPPRESSED ${check}${line ? ` at ${line}` : ''}: ${err}`);
}

export function elementaryJSBug(msg: string) {
  errorHandle(`You have encountered a potential bug in ElementaryJS.
Please report this to the developers along with the following message:
  ${msg}`, 'elementaryJSBug');
}

class ArrayStub {
  constructor() {
    // TODO: Can this message actually be triggered?
    errorHandle(`Use 'Array.create(length, init)'.`, 'Array constructor');
  }

  static create(n: any, v: any) {
    if (arguments.length !== 2) {
      errorHandle(`'.create' expects 2 arguments, received ${arguments.length}.`, 'Array.create');
    }
    if (!Number.isInteger(n) || n < 1) {
      errorHandle('Array size must be a positive integer.', 'Array.create');
    }

    const a = new Array(n);
    for (let i = 0; i < a.length; ++i) {
      a[i] = v;
    }
    return stopifyArray(a);
  }
}
export { ArrayStub as Array };

export function stopifyArray(array: any[]) {
  const maybeRunner = getRunner();
  if (maybeRunner.kind === 'error') {
    return elementaryJSBug('Stopify not loaded.');
  }
  // TODO(arjun): Why may runner be undefined?
  return maybeRunner.value.runner!.g.$stopifyArray(array);
}

export function stopifyObjectArrayRecur(obj: any) {
  if (typeof obj !== 'object') { // if not object, just return given
    return obj;
  }
  if (!Array.isArray(obj)) { // if it's not an array
    for (const key in obj) { // go through each property of object
      if (obj.hasOwnProperty(key)) {
        obj[key] = stopifyObjectArrayRecur(obj[key]); // stopify each field of object
      }
    }
    return obj; // return the object
  }
  // if it's an array
  for (let i = 0; i < obj.length; i++) { // go through each index of array
    obj[i] = stopifyObjectArrayRecur(obj[i]); // stopify each thing in array
  }
  return stopifyArray(obj); // since it's array, stopify the whole array
}

// ---------- DYNAMIC CHECKS ---------- //

export function checkCall(object: any, field: string, args: any[]) {
  if (typeof object === 'string' && field === 'split') {
    return stopifyArray(object.split(args[0]));
  } else if (field === 'split') {
    const result = object.split(...args);
    return Array.isArray(result) ? stopifyArray(result) : result;
  } else if (typeof object === 'function' && object.name === 'Object') {
    return stopifyArray(object[field](args[0]));
  }
  elementaryJSBug(`In 'checkCall' with ${field} on ${typeof object}.`);
}

export function checkIfBoolean(value: any, operator: '||' | '&&' | undefined, line: number) {
  if (typeof value !== 'boolean' && !operator) { // for the if statement
    errorHandle(`Expected a boolean expression, instead received '${value}'.`, 'checkIfBoolean',
      line);
  } else if (typeof value !== 'boolean') {
    errorHandle(`Arguments of operator '${operator}' must both be booleans.`, 'checkIfBoolean',
      line);
  }
  return value;
}

export function arrayBoundsCheck(object: any, index: string, line: number) {
  if (!Array.isArray(object)) {
    errorHandle('Array indexing called on a non-array value type.', 'arrayBoundsCheck', line);
  }
  if (typeof index !== 'number' || index < 0 || (index % 1) !== 0) {
    errorHandle(`Array index '${index}' is not valid.`, 'arrayBoundsCheck', line);
  }
  if (object && index >= object.length) {
    errorHandle(`Index '${index}' is out of array bounds.`, 'arrayBoundsCheck', line);
  }
  return object && object[index];
}

export function dot(object: any, index: string, line: number) {
  if (typeof object !== 'object'  &&
      typeof object !== 'string'  &&
      typeof object !== 'boolean' &&
      typeof object !== 'number'  &&
      typeof object !== 'function') {
    errorHandle('Cannot access member of non-object value types.', 'dot', line);
  }
  if (object && !object.hasOwnProperty(index) && typeof object[index] !== 'function') {
    errorHandle(`Object does not have member '${index}'.`, 'dot', line);
  }
  if (typeof object === 'string' && index === 'split') {
    return function(sep: string) {
      return stopifyArray(object.split(sep));
    };
  }
  return object && object[index];
}

export function updateOnlyNumbers(opcode: string, object: any, line: number) {
  if (typeof object !== 'number') {
    errorHandle(`Argument of operator '${opcode}' must be a number.`, 'updateOnlyNumbers', line);
  }
}

export function checkMember(o: any, k: any, v: any, line: number) {
  if (Array.isArray(o)) {
    errorHandle(`Cannot set '.${k}' of an array.`, 'checkMember', line);
  }
  dot(o, k, line);
  return o && (o[k] = v);
}

export function checkArray(o: any, k: any, v: any, line: number) {
  arrayBoundsCheck(o, k, line);
  return o && (o[k] = v);
}

export function checkUpdateOperand(opcode: string, obj: any, member: string | number, line: number) {
  if (obj && !obj.hasOwnProperty(member)) {
    if (typeof member === 'number') {
      errorHandle(`Index '${member}' is out of array bounds.`, 'checkUpdateOperand', line);
    } else {
      errorHandle(`Object does not have member '${member}'.`, 'checkUpdateOperand', line);
    }
  }
  if (obj && typeof obj[member] !== 'number') {
    errorHandle(`Argument of operator '${opcode}' must be a number.`, 'checkUpdateOperand', line);
  }
  if (opcode === '++') {
    return obj && (++obj[member]);
  } else if (opcode === '--') {
    return obj && (--obj[member]);
  } else {
    // This will only happen if there is an update expression with an opcode other than ++ or --.
    return elementaryJSBug(`In 'checkUpdateOperand'.`);
  }
}

export function applyNumOrStringOp(op: string, lhs: any, rhs: any, line: number) {
  if (!((typeof lhs === 'string' && typeof rhs === 'string') ||
      (typeof lhs === 'number' && typeof rhs === 'number'))) {
    errorHandle(`Arguments of operator '${op}' must both be numbers or strings.`,
      'applyNumOrStringOp', line);
  }
  switch (op) {
    case '+': {
      return (lhs as any) + (rhs as any);
    } break;
    default: {
      elementaryJSBug(`In 'applyNumOrStringOp' with '${op}'.`);
    }
  }
}

export function applyNumOp(op: string, lhs: any, rhs: any, line: number) {
  if (!(typeof (lhs) === 'number' && typeof (rhs) === 'number')) {
    errorHandle(`Arguments of operator '${op}' must both be numbers.`, 'applyNumOp', line);
  }
  switch (op) {
    case '-': {
      return (lhs - rhs);
    } break;
    case '/': {
      return (lhs / rhs);
    } break;
    case '*': {
      return (lhs * rhs);
    } break;
    case '>': {
      return (lhs > rhs);
    } break;
    case '<': {
      return (lhs < rhs);
    } break;
    case '>=': {
      return (lhs >= rhs);
    } break;
    case '<=': {
      return (lhs <= rhs);
    } break;
    case '>>': {
      return (lhs >> rhs);
    } break;
    case '>>>': {
      return (lhs >>> rhs);
    } break;
    case '<<': {
      return (lhs << rhs);
    } break;
    case '|': {
      return (lhs | rhs);
    } break;
    case '&': {
      return (lhs & rhs);
    } break;
    case '^': {
      return (lhs ^ rhs);
    } break;
    case '%': {
      return (lhs % rhs);
    } break;
    default: {
      elementaryJSBug(`In 'applyNumOp' with '${op}'.`);
      return 0;
    }
  }
}

export function arityCheck(name: string, expected: number, actual: number, line: number) {
  if (expected !== actual) {
    const expectedStr = `${expected} argument${expected === 1 ? '' : 's'}`,
          actualStr = `${actual} argument${actual === 1 ? '' : 's'}`;
    errorHandle(`Function ${name} expected ${expectedStr} but received ${actualStr}.`,
      'arityCheck', line);
  }
}

// ---------- TEST SUPPPORT ---------- //

export class ElementaryTestingError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type EncapsulatedRunner = {
  runner: stopify.AsyncRun | undefined,
  isRunning: boolean,
  onStopped: () => void
};

let tests: TestResult[] = [],
    testsEnabled: boolean = false,
    timeoutMilli: number = 5000,
    stopifyRunner: EncapsulatedRunner = {
      runner: undefined,
      isRunning: false,
      onStopped: () => {}
    };

export function getRunner(): { kind: 'ok', value: EncapsulatedRunner } | { kind: 'error' }  {
  if (!stopifyRunner.runner) {
    return { kind: 'error' };
  }
  return { kind: 'ok', value: stopifyRunner };
}

export function setRunner(runner: stopify.AsyncRun) {
  stopifyRunner = {
    runner: runner,
    isRunning: false,
    onStopped: () => {}
  };
}

/**
 * Enable/Disable testing; it clears out previous tests and starts anew.
 *
 * @param {boolean} enable
 * @param {number} timeout
 */
export function enableTests(enable: boolean, timeout: number = 5000) {
  testsEnabled = enable;
  tests = [];
  timeoutMilli = timeout;
}

/**
 * Assertions to be used in function passed into test.
 *
 * @param {boolean} val
 * @returns true if val is true otherwise throws Error
 */
export function assert(val: boolean) {
  if (typeof val !== 'boolean') {
    throw new ElementaryTestingError(`Assertion argument '${val}' is not a boolean value.`);
  } else if (!val) {
    throw new ElementaryTestingError('Assertion failed.');
  }
  return true;
}

/**
 * Test function to be used for testing.
 * Only runs if testing is enabled and uses a stopify runner to run test if given a stopify runner.
 * Once test is run, it saves the result and the summary function will output the result.
 *
 * @param {string} description
 * @param {() => void} testFunction
 */
export function test(description: string, testFunction: () => void) {
  if (!testsEnabled) {
    return;
  }
  const runner = stopifyRunner.runner!,
        // NOTE(arjun): Using Stopify internals
        runtime = (runner as any).continuationsRTS,
        suspend = (runner as any).suspendRTS;
  return runtime.captureCC((k: any) => {
    return runtime.endTurn((onDone: any) => {
      let done = false;
      const timerID = setTimeout(() => {
        runner.pause(() => {
          if (done) { return; }
          suspend.continuation = k;
          suspend.onDone = onDone;
          tests.push({
            failed: true,
            error: 'Time limit exceeded.',
            description
          });
          setImmediate(() => runner.resume());
        });
      }, timeoutMilli);
      return runner.runStopifiedCode(testFunction, (result: any) => {
        if (result.type === 'normal') {
          tests.push({
            failed: false,
            description
          });
        } else {
          tests.push({
            failed: true,
            error: result.value,
            description
          });
        }
        clearTimeout(timerID);
        done = true;
        runtime.runtime(() => k({
          type: 'normal',
          value: undefined
        }), onDone);
      });
    });
  });
}

/**
 * To be used after all tests are run to get the summary of all tests.
 * Output can be styled with the hasStyles argument.
 *
 * @param {boolean} hasStyles to determine whether it needs styling (for console.log)
 * @returns an object with output (string) and style (array of string).
 * If hasStyles is false, object will contain proper output string in output
 * field and no styling. If hasStyling is true, markers are placed in output
 * and styling is given in the style field to be used in console.log.
 */
export function summary(hasStyles: boolean) {
  if (!testsEnabled) {
    return {
      output: 'Test not enabled.',
      style: []
    }
  }
  const styleMark = hasStyles ? '%c' : ''
  if (tests.length === 0) {
    enableTests(false);
    return {
      output: `${styleMark}◈ You do not seem to have any tests written.\n◈ To run a test, begin a function name with 'test'.`,
      style: hasStyles ? ['color: #e87ce8'] : []
    };
  }
  const output: string[] = [],
        style: string[] = [];
  let numPassed: number = 0,
      numFailed: number = 0;
  for (const result of tests) {
    if (result.failed) {
      output.push(`${styleMark} FAILED ${styleMark} ${result.description}\n         ${result.error!}`);
      hasStyles && style.push('background-color: #f44336; font-weight: bold', '');
      numFailed += 1;
      continue;
    }
    output.push(`${styleMark} OK ${styleMark}     ${result.description}`);
    hasStyles && style.push('background-color: #2ac093; font-weight: bold', '');
    numPassed += 1;
  }
  if (numFailed > 0) {
    output.push(`Tests:     ${styleMark}${numFailed} failed, ${styleMark}${numPassed} passed, ${styleMark}${numPassed + numFailed} total.`);
    hasStyles && style.push('color: #f44336; font-weight: bold', 'color: #2ac093; font-weight: bold', 'font-weight: bold');
  } else {
    output.push(`Tests:     ${styleMark}${numPassed} passed, ${styleMark}${numPassed + numFailed} total.`);
    hasStyles && style.push('color: #2ac093; font-weight: bold', 'font-weight: bold');
  }
  enableTests(false);
  return {
    output: output.join('\n'),
    style
  }
}
