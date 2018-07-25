
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