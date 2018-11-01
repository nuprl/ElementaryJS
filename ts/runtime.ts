import { EJSVERSION } from './version';
import { TestResult } from './types';
import timeoutTest from './timeout';
import * as stopify from 'stopify';

export  function version() {
  return EJSVERSION;
}

export class ElementaryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

class ArrayStub {

  constructor() {
    throw new ElementaryRuntimeError(`use Array.create(length, init)`);
  }

  static create(n: any, v: any) {
    if (arguments.length !== 2) {
      throw new ElementaryRuntimeError(`.create expects 2 arguments, received ${arguments.length}`);
    }
  
    if (typeof n !== 'number' || (n | 0) !== n || n <= 0) {
      throw new ElementaryRuntimeError('array size must be a positive integer');
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
  if (typeof(value) === 'boolean') {
    return value;
  }
  if (typeof operator === 'undefined') { // undefined is for the if statement
    throw new ElementaryRuntimeError(`expected a boolean expression, instead received '${value}'`);
  }
  throw new ElementaryRuntimeError(`arguments of operator '${operator}' must both be booleans`);
}

export function arrayBoundsCheck(object: any, index: string) {
  if (object instanceof Array === false) {
    throw new ElementaryRuntimeError('array indexing called on a non-array value type');
  }
  if (typeof index !== 'number' ||
      index < 0 || (index % 1) !== 0) {
    throw new ElementaryRuntimeError(
        `array index '${index}' is not valid`);
  }
  if (object[index] === undefined) {
    throw new ElementaryRuntimeError(
        `index '${index}' is out of array bounds`);
  }
  return object[index];
}

export function dot(object: any, index: string) {
  if (typeof object !== 'object'  && 
      typeof object !== 'string'  && 
      typeof object !== 'boolean' &&
      typeof object !== 'number') {
    throw new ElementaryRuntimeError(`cannot access member of non-object value types`);
  }
  if (object[index] === undefined) {
    throw new ElementaryRuntimeError(`object does not have member '${index}'`);
  }
  if (typeof object === 'string' && index === 'split') {
    return stopifyStringSplit(object);
  }

  return object[index];
}

export function checkCall(object: any, field: string, args: any[]) {
  if (typeof object === 'string' && field === 'split') {
      return stopifyArray(object.split(args[0]));
  }
  else {
    throw elementaryJSBug(`checkCall with ${field} on ${typeof object}`);
  }
}

export function stopifyArray(array: any[]) {
  const maybeRunner = getRunner();
  if (maybeRunner.kind === 'error') {
    throw elementaryJSBug(`Stopify not loaded`);
  }
  // A very undocumented interface!
  return (maybeRunner.value as any).higherOrderFunctions.stopifyArray(array);

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

function stopifyStringSplit(str: string) {
  return function(sep: string) {
    return stopifyArray(str.split(sep));
  };
}

export function updateOnlyNumbers(opcode: string, object: any) {
  if (typeof object !== 'number') {
    // TODO(joydeepb): Figure out how to print the operator.
    throw new ElementaryRuntimeError(`argument of operator '${opcode}' must be a number`);
  }
}

export function checkNumberAndReturn(opcode: string, object: any) {
  if (typeof object !== 'number') {
    // TODO(joydeepb): Figure out how to print the operator.
    throw new ElementaryRuntimeError(`argument of operator '${opcode}' must be a number`);
  }
  return object;
}

export function elementaryJSBug(what: string) {
  // TODO(arjun): We should save the trace ourselves
  let errorMsg = 'You have encountered a potential bug in ' +
    'ElementaryJS. Please report this to the developers, ' +
    'along with the following stack trace:\n';
  console.trace();
  throw new ElementaryRuntimeError(errorMsg);
}

export function checkMember(o: any, k: any, v: any) {
  if (o instanceof Array) {
    throw new ElementaryRuntimeError(`cannot set .${k} of an array`);
  }
  dot(o, k);
  return (o[k] = v);
}

export function checkArray(o: any, k: any, v: any) {
  arrayBoundsCheck(o, k);
  return (o[k] = v);
}

export function checkUpdateOperand(
  opcode: string,
  obj: any,
  member: string | number) {
  if (obj.hasOwnProperty(member) === false) {
    if (typeof member === 'number') {
      throw new ElementaryRuntimeError(
        `index '${member}' is out of array bounds`);
    } else {
      throw new ElementaryRuntimeError(`object does not have member '${member}'`);
    }
  }
  if (typeof (obj[member]) !== 'number') {
    throw new ElementaryRuntimeError(`argument of operator '${opcode}' must be a number`);
  }
  if (opcode === '++') {
    return (++obj[member]);
  } else if (opcode === '--') {
    return (--obj[member]);
  } else {
    // This will only happen if there is an update expression with an opcode other than ++ or --.
    elementaryJSBug('UpdateOperand dynamic check');
    return undefined;
  }
}

export function applyNumOrStringOp(op: string, lhs: any, rhs: any) {
  if (!((typeof (lhs) === "string" && typeof (rhs) === "string") ||
    (typeof (lhs) === "number" && typeof (rhs) === "number"))) {
    throw new ElementaryRuntimeError(
      `arguments of operator '${op}' must both be numbers or strings`);
  }
  switch (op) {
    case "+": {
      return (<any>(lhs) + <any>(rhs));
    } break;
    default: {
      elementaryJSBug(`applyNumOrStringOp '${op}'`);
    }
  }
}
export function applyNumOp(op: string, lhs: any, rhs: any) {
  if (!(typeof (lhs) === "number" && typeof (rhs) === "number")) {
    throw new ElementaryRuntimeError(
      `arguments of operator '${op}' must both be numbers`);
  }
  switch (op) {
    case "-": {
      return (lhs - rhs);
    } break;
    case "/": {
      return (lhs / rhs);
    } break;
    case "*": {
      return (lhs * rhs);
    } break;
    case ">": {
      return (lhs > rhs);
    } break;
    case "<": {
      return (lhs < rhs);
    } break;
    case ">=": {
      return (lhs >= rhs);
    } break;
    case "<=": {
      return (lhs <= rhs);
    } break;
    case ">>": {
      return (lhs >> rhs);
    } break;
    case ">>>": {
      return (lhs >>> rhs);
    } break;
    case "<<": {
      return (lhs << rhs);
    } break;
    case "|": {
      return (lhs | rhs);
    } break;
    case "&": {
      return (lhs & rhs);
    } break;
    case "^": {
      return (lhs ^ rhs);
    } break;
    case "%": {
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
    const expectedStr = `${expected} argument${expected === 1 ? '' : 's'}`;
    const actualStr = `${actual} argument${actual === 1 ? '' : 's'}`;
    throw new ElementaryRuntimeError(
      `function ${name} expected ${expectedStr} but received ${actualStr}`);
  }
}

export class ElementaryTestingError extends Error {
  constructor(message: string) {
    super(message);
  }
}

let tests: TestResult[] = [];

let testsEnabled = false;

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
 * Enable/Disable testing and sets a stopify runner if needed
 * It clears out previous tests and starts anew
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
 * Assertions to be used in function passed into test
 *
 * @param {boolean} val
 * @returns true if val is true otherwise throws Error
 */
export function assert(val: boolean) {
  if (typeof val !== 'boolean') {
    throw new ElementaryTestingError(`assertion argument '${val}' is not a boolean value`);
  }
  if (!val) {
    throw new ElementaryTestingError(`assertion failed`);
  }

  return true;
}
/**
 * Test function to be used for testing
 * Only runs if testing is enabled and uses
 * a stopify runner to run test if given a stopify runner.
 * Once test is run, it saves the result and the summary
 * function will output the result
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
          runner.resume();
        });
      }, timeoutMilli);
      return runner.runStopifiedCode(testFunction, (result: any) => {
        if (result.type === 'normal') {
            tests.push({
            failed: false,
            description: description,
          });
        }
        else {
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
 * Output can be styled with the hasStyles argumnet.
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
  let output: string[] = [];
  let style: string[] = [];
  let numPassed = 0;
  let numFailed = 0;
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
