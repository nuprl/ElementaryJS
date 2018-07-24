
export class ElementaryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function dot(object: any, index: string) {
  if (typeof object !== 'object') {
    throw new ElementaryRuntimeError('expected an object');
  }
  if (!object.hasOwnProperty(index)) {
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

function assign(operator: string, o: any, x: any, v: any) {
  // NOTE(arjun): I am concerned that this is going to slow code down
  // considerably.
  switch (operator) {
    case '=':
      return o[x] = v;
    case '+=':
      return o[x] += v;
    case '-=':
      return o[x] -= v;
    case '*=':
      return o[x] *= v;
    case '-=':
      return o[x] -= v;
    case '%=':
      return o[x] %= v;
    default:
      elementaryJSBug(`${operator} unsupported (should be caught statically)`);
  }
}

/**
 * The dynamic check for expressions such as `o.x = v` and `o.x += v`.
 */
export function checkObjectAssign(operator: string, o: any, x: any, v: any) {
  if (!o.hasOwnProperty(x)) {
    throw new ElementaryRuntimeError(`${x} is not a member`);
  }
  if (operator === '+=' &&
      ((typeof o.x == 'string' && typeof v === 'string') ||
       (typeof o.x == 'number' && typeof v === 'number'))) {
    return assign(operator, o, x, v);
  }

  if (operator === '=') {
    return assign(operator, o, x, v);
  }

  if (typeof o.x === 'number' && typeof v === 'number') {
    return assign(operator, o, x, v);
  }
  throw new ElementaryRuntimeError(`${x} is not a number`);
}

/**
 * The dynamic check for expressions such as `arr[ix] = v` and `arr[ix] += v`.
 */
export function checkArrayAssign(operator: string, arr: any, ix: any, v: any) {
  if (arr instanceof Array === false) {
    throw new ElementaryRuntimeError(`${arr} is not an array`);
  }
  if (typeof ix !== 'number') {
    throw new ElementaryRuntimeError(`expected array index, found ${ix}`);
  }
  if (ix < 0 || ix >= arr.length) {
    throw new ElementaryRuntimeError(`index out of range`);
  }
  return assign(operator, arr, ix, v);
}

export function checkUpdateOperand(
    opcode: string,
    obj: any,
    member: string) {
  if (obj.hasOwnProperty(member) === false) {
    throw new ElementaryRuntimeError(`${member} is not a member`);
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
