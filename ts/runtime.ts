
export class ElementaryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function dot(object: any, index: string | number) {
  if (typeof object !== 'object') {
    throw new ElementaryRuntimeError('expected an object');
  }
  if (object[index] === undefined) {
    if (typeof index === 'number') {
      throw new ElementaryRuntimeError(
        `Index ${index} does not exist in array`);
    } else {
      throw new ElementaryRuntimeError(`${index} is not a member`);
    }
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
  if (typeof(obj[member]) !== 'number') {
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
  if (!((typeof(lhs) === "string" && typeof(rhs) === "string") ||
      (typeof(lhs) === "number" && typeof(rhs) === "number"))) {
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
  if (!(typeof(lhs) === "number" && typeof(rhs) === "number")) {
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

let tests: {
  failed: boolean,
  description: string,
  error: string,
  miliElapsed: number
}[] = [];

var testsEnabled = false;

export function enableTests(enable: boolean) {
  testsEnabled = enable;
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
  const start = Date.now(); // I should use perfomance.now but I don't think it matters that much
  try { // I just want some cool numbers showing up
      testFunction();
      const end = Date.now(); 
      tests.push({
          failed: false,
          description: description,
          error: '',
          miliElapsed: end - start,
      });
  } catch (e) {
      const end = Date.now();
      tests.push({
          failed: true,
          description: description,
          error: e.message,
          miliElapsed: end - start,
      });

  }
}

export function summary() {
  if (tests.length === 0) {
      console.log(`%c◈ You don't seem to have any tests written`, 'color: #e87ce8');
      console.log(`%c◈ To run a test, begin a function name with 'test'`, 'color: #e87ce8');
      return;
  }
  let numPassed = 0;
  let numFailed = 0;
  let totalMili = 0;
  for (let result of tests) {
      totalMili += result.miliElapsed;
      if (result.failed) {
          console.log(
              `%c FAILED %c ${result.description} (${result.miliElapsed.toFixed(0)}ms)\n${result.error}`,
              'background-color: #f44336; font-weight: bold',
              'color: inherit; background-color: inherit'
          );
          numFailed += 1;
          continue;
      }
      console.log(
          `%c OK %c ${result.description} (${result.miliElapsed.toFixed(0)}ms)`,
          'background-color: #2ac093; font-weight: bold',
          'color: inherit; background-color: inherit'
      );
      numPassed += 1;
  }
  console.log(`Tests:     %c${numFailed} failed, %c${numPassed} passed, %c${numPassed + numFailed} total`,
  'color: #f44336; font-weight: bold', 'color: #2ac093; font-weight: bold', 'font-weight: bold'
  );
  console.log(`Time:      ${(totalMili / 1000).toFixed(2)}s`);
  tests = [];
}