import { EJSVERSION } from './version';
import { TestResult } from './types';
import * as stopify from '@stopify/stopify';

let isSilent: boolean = false;
export function runSilent() { isSilent = true; }

export function version() {
  return EJSVERSION;
}

export class ElementaryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function errorHandle(err: string, check: string) {
  if (!isSilent) { // Normal EJS
    throw new ElementaryRuntimeError(err);
  }
  console.warn(`EJS RUNTIME ERROR ${check}: ${err}`);
}

export function elementaryJSBug(what: string) {
  // TODO(arjun): We should save the trace ourselves
  errorHandle('You have encountered a potential bug in ' +
    'ElementaryJS. Please report this to the developers, ' +
    'along with the following stack trace:\n' + console.trace(), 'elementaryJSBug');
}

class ArrayStub {
  constructor() {
    // TODO: Can this message actually be triggered?
    errorHandle('use Array.create(length, init)', 'Array constructor');
  }

  static create(n: any, v: any) {
    if (arguments.length !== 2) {
      errorHandle(`.create expects 2 arguments, received ${arguments.length}`, 'Array.create');
    }
    if (typeof n !== 'number' || (n | 0) !== n || n <= 0) {
      errorHandle('array size must be a positive integer', 'Array.create');
    }

    let a = new Array(n);
    for (let i = 0; i < a.length; ++i) {
      a[i] = v;
    }
    return stopifyArray(a);
  }
}

export { ArrayStub as Array };

export function checkIfBoolean(value: any, operator: '||' | '&&'  | undefined) {
  if (typeof value !== 'boolean' && typeof operator === 'undefined') { // for the if statement
    errorHandle(`expected a boolean expression, instead received '${value}'`, 'checkIfBoolean');
  } else if (typeof value !== 'boolean') {
    errorHandle(`arguments of operator '${operator}' must both be booleans`, 'checkIfBoolean');
  }
  return value;
}

export function arrayBoundsCheck(object: any, index: string) {
  if (!Array.isArray(object)) {
    errorHandle('array indexing called on a non-array value type', 'arrayBoundsCheck');
  }
  if (typeof index !== 'number' || index < 0 || (index % 1) !== 0) {
    errorHandle(`array index '${index}' is not valid`, 'arrayBoundsCheck');
  }
  if (object[index] === undefined) {
    errorHandle(`index '${index}' is out of array bounds`, 'arrayBoundsCheck');
  }
  return object[index];
}

export function dot(object: any, index: string) {
  if (typeof object !== 'object'  &&
      typeof object !== 'string'  &&
      typeof object !== 'boolean' &&
      typeof object !== 'number') {
    errorHandle('cannot access member of non-object value types', 'dot');
  }
  if (!object.hasOwnProperty(index)) {
    errorHandle(`object does not have member '${index}'`, 'dot');
  }
  if (typeof object === 'string' && index === 'split') {
    return function(sep: string) {
      return stopifyArray(object.split(sep));
    };
  }

  return object[index];
}

export function checkCall(object: any, field: string, args: any[]) {
  if (typeof object === 'string' && field === 'split') {
    return stopifyArray(object.split(args[0]));
  }
  elementaryJSBug(`checkCall with ${field} on ${typeof object}`);
}

export function stopifyArray(array: any[]) {
  const maybeRunner = getRunner();
  if (maybeRunner.kind === 'error') {
    return elementaryJSBug(`Stopify not loaded`);
  }
  // TODO(arjun): Why may runner be undefined?
  return maybeRunner.value.runner!.g.$stopifyArray(array);
}

export function stopifyObjectArrayRecur(obj: any) {
  if (typeof obj !== 'object') { // if not object, just return given
    return obj;
  }
  if (!Array.isArray(obj)) { // if it's not an array
    for (let key in obj) { // go through each property of object
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

export function updateOnlyNumbers(opcode: string, object: any) {
  if (typeof object !== 'number') {
    // TODO(joydeepb): Figure out how to print the operator.
    errorHandle(`argument of operator '${opcode}' must be a number`, 'updateOnlyNumbers');
  }
}

export function checkNumberAndReturn(opcode: string, object: any) {
  if (typeof object !== 'number') {
    // TODO(joydeepb): Figure out how to print the operator.
    errorHandle(`argument of operator '${opcode}' must be a number`, 'checkNumberAndReturn');
  }
  return object;
}

export function checkMember(o: any, k: any, v: any) {
  if (Array.isArray(o)) {
    errorHandle(`cannot set .${k} of an array`, 'checkMember');
  }
  dot(o, k);
  return (o[k] = v);
}

export function checkArray(o: any, k: any, v: any) {
  arrayBoundsCheck(o, k);
  return (o[k] = v);
}

export function checkUpdateOperand(opcode: string, obj: any, member: string | number) {
  if (!obj.hasOwnProperty(member)) {
    if (typeof member === 'number') {
      errorHandle(`index '${member}' is out of array bounds`, 'checkUpdateOperand');
    } else {
      errorHandle(`object does not have member '${member}'`, 'checkUpdateOperand');
    }
  }
  if (typeof obj[member] !== 'number') {
    errorHandle(`argument of operator '${opcode}' must be a number`, 'checkUpdateOperand');
  }
  if (opcode === '++') {
    return (++obj[member]);
  } else if (opcode === '--') {
    return (--obj[member]);
  } else {
    // This will only happen if there is an update expression with an opcode other than ++ or --.
    return elementaryJSBug('UpdateOperand dynamic check');
  }
}

export function applyNumOrStringOp(op: string, lhs: any, rhs: any) {
  if (!((typeof lhs === 'string' && typeof rhs === 'string') ||
      (typeof lhs === 'number' && typeof rhs === 'number'))) {
    errorHandle(`arguments of operator '${op}' must both be numbers or strings`,
      'applyNumOrStringOp');
  }
  switch (op) {
    case '+': {
      return <any> lhs + <any> rhs;
    } break;
    default: {
      elementaryJSBug(`applyNumOrStringOp '${op}'`);
    }
  }
}

export function applyNumOp(op: string, lhs: any, rhs: any) {
  if (!(typeof (lhs) === 'number' && typeof (rhs) === 'number')) {
    errorHandle(`arguments of operator '${op}' must both be numbers`, 'applyNumOp');
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
      elementaryJSBug(`applyNumOp '${op}'`);
      return 0;
    }
  }
}

export function arityCheck(name: string, expected: number, actual: number) {
  if (expected !== actual) {
    const expectedStr = `${expected} argument${expected === 1 ? '' : 's'}`,
          actualStr = `${actual} argument${actual === 1 ? '' : 's'}`;
    errorHandle(`function ${name} expected ${expectedStr} but received ${actualStr}`,
      'arityCheck');
  }
}

export class ElementaryTestingError extends Error {
  constructor(message: string) {
    super(message);
  }
}

let tests: TestResult[] = [];

let testsEnabled: boolean = false;

export type EncapsulatedRunner = {
  runner: stopify.AsyncRun | undefined,
  isRunning: boolean,
  onStopped: () => void
};

let stopifyRunner: EncapsulatedRunner = {
  runner: undefined,
  isRunning: false,
  onStopped: () => {}
};

export function getRunner(): { kind: 'ok', value: EncapsulatedRunner } | { kind: 'error' }  {
  if (stopifyRunner.runner === undefined) {
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

let timeoutMilli: number = 5000;
/**
 * Enable/Disable testing and sets a stopify runner if needed.
 * It clears out previous tests and starts anew.
 *
 * @param {boolean} enable
 * @param {*} runner
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
    throw new ElementaryTestingError(`assertion argument '${val}' is not a boolean value`);
  }
  if (!val) {
    throw new ElementaryTestingError('assertion failed');
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
  const runner = stopifyRunner.runner!;
  // NOTE(arjun): Using Stopify internals
  const runtime = (runner as any).continuationsRTS;
  const suspend = (runner as any).suspendRTS;
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
            error: 'time limit exceeded',
            description: description
          });
          setImmediate(() => runner.resume());
        });
      }, timeoutMilli);
      return runner.runStopifiedCode(testFunction, (result: any) => {
        if (result.type === 'normal') {
          tests.push({
            failed: false,
            description: description,
          });
        } else {
          tests.push({
            failed: true,
            description: description,
            error: result.value,
          });
        }
        clearTimeout(timerID);
        done = true;
        runtime.runtime(() => k({ type: 'normal', value: undefined }), onDone);
      });
    });
  });
}

/**
 * To be used after all tests are run to get the summary of all tests.
 * Output can be styled with the hasStyles argument.
 *
 * @param {boolean} hasStyles to determine whether it needs styling (for console.log)
 * @returns an object with output (string) and style, (array of string).
 * If hasStyles is false, object will contain proper output string in output
 * field and no styling. If hasStyling is true, markers are placed in output
 * and styling is given in the style field to be used in console.log
 */
export function summary(hasStyles: boolean) {
  if (!testsEnabled) {
    return {
      output: `Test not enabled`,
      style: []
    }
  }
  const styleMark = hasStyles ? '%c' : ''
  if (tests.length === 0) {
    enableTests(false);
    return {
      output: `${styleMark}◈ You don't seem to have any tests written\n◈ To run a test, begin a function name with 'test'`,
      style: hasStyles ? ['color: #e87ce8'] : []
    };
  }
  let output: string[] = [],
      style: string[] = [],
      numPassed: number = 0,
      numFailed: number = 0;
  for (let result of tests) {
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
    output.push(`Tests:     ${styleMark}${numFailed} failed, ${styleMark}${numPassed} passed, ${styleMark}${numPassed + numFailed} total`);
    hasStyles && style.push('color: #f44336; font-weight: bold', 'color: #2ac093; font-weight: bold', 'font-weight: bold');
  } else {
    output.push(`Tests:     ${styleMark}${numPassed} passed, ${styleMark}${numPassed + numFailed} total`);
    hasStyles && style.push('color: #2ac093; font-weight: bold', 'font-weight: bold');
  }
  enableTests(false);
  return {
    output: output.join('\n'),
    style: style
  }
}
