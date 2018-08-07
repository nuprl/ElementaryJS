import { TestResult } from './types';

export class ElementaryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function SafeArray(n: any, v: any) {
  if (arguments.length < 1 || arguments.length > 2) {
    throw new ElementaryRuntimeError('array initialization takes at least one, and at most two arguments');
  } 
  if (arguments.length === 1) v = 0;
  if (typeof n !== 'number' ||
      n < 0 ||
      (n % 1) !== 0) {
    throw new ElementaryRuntimeError('array size must be a non-negative integer');
  }
  let a = new Array(n);
  for (let i = 0; i < a.length; ++i) {
    a[i] = v;
  }
  return a;
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

let tests: TestResult[] = [];

let testsEnabled = false;

let stopifyRunner: any = undefined;

export function enableTests(enable: boolean, runner: any) {
  testsEnabled = enable;
  stopifyRunner = runner;
  tests = [];
}

export function assert(val: boolean) {
  if (typeof val !== 'boolean') {
    throw new Error(`${val} is not a boolean value`);
  }
  if (!val) {
    throw new Error(`Assertion failed`);
  }

  return true;
}

export function test(description: string, testFunction: () => void) {
  if (!testsEnabled) {
    return;
  }
  const now = Date.now(); // performance.now is probably better
  if (typeof stopifyRunner !== 'undefined') {
    stopifyRunner.externalHOF((complete: any) => {
      return (stopifyRunner.runStopifiedCode(
        testFunction,
        (result: any) => {
          if (result.type === 'normal') {
            tests.push({
              failed: false,
              description: description,
              miliElapsed: Date.now() - now,
            });
            complete({ type: 'normal', value: result.value});
          }
          else {
            tests.push({
              failed: true,
              description: description,
              miliElapsed: Date.now() - now,
              error: result.value,
            })
            complete({ type: 'normal', value: result.value});
          }
        }));
    });
    return;
  }
  try {
    testFunction();
    tests.push({
      failed: false,
      description: description,
      miliElapsed: Date.now() - now,
    });
  } catch (e) {
    tests.push({
      failed: true,
      description: description,
      error: e.message,
      miliElapsed: Date.now() - now,
    });

  }
}

export function summary() {
  if (tests.length === 0) {
    return {
      output: `%c◈ You don't seem to have any tests written\n◈ To run a test, begin a function name with 'test'`,
      style: ['color: #e87ce8']
    };
  }
  let output: string[] = [];
  let style: string[] = [];
  let numPassed = 0;
  let numFailed = 0;
  let totalTime = 0;
  for (let result of tests) {
    totalTime += result.miliElapsed;
    if (result.failed) {
      output.push(`%c FAILED %c ${result.description} (${result.miliElapsed.toFixed(0)}ms)\n         ${result.error!}`);
      style.push('background-color: #f44336; font-weight: bold', '');
      numFailed += 1;
      continue;
    }
    output.push(`%c OK %c     ${result.description} (${result.miliElapsed.toFixed(0)}ms)`);
    style.push('background-color: #2ac093; font-weight: bold', '');
    numPassed += 1;
  }
  if (numFailed > 0) {
    output.push(`Tests:     %c${numFailed} failed, %c${numPassed} passed, %c${numPassed + numFailed} total`);
    style.push('color: #f44336; font-weight: bold', 'color: #2ac093; font-weight: bold', 'font-weight: bold');
  } else {
    output.push(`Tests:     %c${numPassed} passed, %c${numPassed + numFailed} total`);
    style.push('color: #2ac093; font-weight: bold', 'font-weight: bold');
  }
  output.push(`%cTime:      ${(totalTime/1000).toFixed(2)}s`);
  style.push('');
  return {
    output: output.join('\n'),
    style: style
  }
}