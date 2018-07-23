
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

export function mustBeNumber(object: any) {
  if (typeof object !== 'number') {
    throw new ElementaryRuntimeError(`argument of operator must be a numer`);
  }
  return object;
}