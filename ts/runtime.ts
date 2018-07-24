
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
  let errorMsg = 'You have encountered a potential bug in ' +
      'ElementaryJS. Please report this to the developers, ' +
      'along with the following stack trace:\n';
  console.error(errorMsg);
  console.trace();
}

export function checkUpdateOperand(
    opcode: string,
    obj: any,
    member: string) {
  console.log(`obj.${member} is of type ${typeof(obj[member])}`);
  if (obj.hasOwnProperty(member) === false) {
    throw new ElementaryRuntimeError(`${member} is not a member`);
  }
  if (typeof(obj[member]) !== 'number') {
    throw new ElementaryRuntimeError(`argument of operator must be a number`);
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
