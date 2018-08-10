import { EJSVERSION } from './version';
import { TestResult } from './types';
import timeoutTest from './timeout';

export  function version() {
  return EJSVERSION;
}

export class ElementaryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function ArrayStub() {
  throw new ElementaryRuntimeError(`Use Array.create(length, init)`);
}

export { ArrayStub as Array };

(ArrayStub as any).create = function(n: any, v: any) {
  if (arguments.length !== 2) {
    throw new ElementaryRuntimeError('usage: Array.create(length, init)');
  }

  if (typeof n !== 'number' || (n | 0) !== n || n <= 0) {
    throw new ElementaryRuntimeError('array size must be a positive integer');
  }

  let a = new Array(n);
  for (let i = 0; i < a.length; ++i) {
    a[i] = v;
  }
  return a;
}

export function checkNotUndef(v: any) {
  if (v === undefined) {
    throw new ElementaryRuntimeError('return value expected from function');
  }
  return v;
}

export function arrayBoundsCheck(object: any, index: string) {
  if (typeof object !== 'object') {
    throw new ElementaryRuntimeError('expected an array');
  }
  if (typeof index !== 'number' ||
      index < 0 || (index % 1) !== 0) {
    throw new ElementaryRuntimeError(
        `${index} is not a valid array index`);
  }
  if (object[index] === undefined) {
    throw new ElementaryRuntimeError(
        `Index ${index} is out of array bounds`);
  }
  return object[index];
}

export function dot(object: any, index: string) {
  if (typeof object !== 'object') {
    throw new ElementaryRuntimeError('expected an object');
  }
  if (object[index] === undefined) {
    throw new ElementaryRuntimeError(`${index} is not a member`);
  }
  return object[index];
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
        `Index ${member} does not exist in array`);
    } else {
      throw new ElementaryRuntimeError(`${member} is not a member`);
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

export class ElementaryTestingError extends Error {
  constructor(message: string) {
    super(message);
  }
}

let tests: TestResult[] = [];

let testsEnabled = false;

let stopifyRunner: any = undefined;

let timeoutMilli: number = 3000;
/**
 * Enable/Disable testing and sets a stopify runner if needed
 * It clears out previous tests and starts anew
 *
 * @param {boolean} enable
 * @param {*} runner
 */
export function enableTests(enable: boolean, runner: any, timeout: number = 3000) {
  testsEnabled = enable;
  stopifyRunner = runner;
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
    throw new ElementaryTestingError(`${val} is not a boolean value`);
  }
  if (!val) {
    throw new ElementaryTestingError(`Assertion failed`);
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
  if (typeof stopifyRunner !== 'undefined') {
    stopifyRunner.externalHOF((complete: any) => {
      return (stopifyRunner.runStopifiedCode(
        testFunction,
        (result: any) => {
          if (result.type === 'normal') {
            tests.push({
              failed: false,
              description: description,
            });
            complete({ type: 'normal', value: result.value });
          }
          else {
            tests.push({
              failed: true,
              description: description,
              error: result.value,
            })
            complete({ type: 'normal', value: result.value });
          }
        }));
    });
    return;
  }
  try {
    timeoutTest(testFunction, timeoutMili);
    
    tests.push({
      failed: false,
      description: description,
    });

  } catch (e) {
    if (e.message.includes('timed out')) {
      tests.push({
        failed: true,
        description: description,
        error: 'Timed out',
      });
      return;
    }
    tests.push({
      failed: true,
      description: description,
      error: e.message,
    });

  }
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
    enableTests(false, undefined);
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
  enableTests(false, undefined);
  return {
    output: output.join('\n'),
    style: style
  }
}
