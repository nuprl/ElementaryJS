import { compile } from './index';
import { sandbox } from './sandbox';
import { default as generator } from 'babel-generator';

// Helps write test cases that expect the program to terminate normally.
// The result is the final value of the program.
function run(code: string): any {
  const result = compile(code);
  if (result.kind === 'error') {
    throw result;
  }
  const v = sandbox(code);
  if (v.kind === 'exception') {
    throw v.value;
  }
  return v.value;
}

// Helps write test cases for dynamic errors. The returned string is the
// value of the .message field of any exception that the code raises.
// A test case should check that the message is reasonable, or it could have
// been some other kind of failure.
function dynamicError(code: string): string {
  const result = compile(code);
  if (result.kind === 'error') {
    throw result;
  }

  const compiledCode = generator(result.node, { }).code;
  const v = sandbox(compiledCode);
  if (v.kind === 'exception') {
    if (typeof v.value.message !== 'string') {
      throw new Error(`no error message`);
    }
    return v.value.message;
  }
  throw new Error(`expected dynamic error, got result ${v.value}`);
}

// Helps write test cases that check for static errors. The result
// is the array of error messages produced by ElementaryJS.
function staticError(code: string): string[] {
  const result = compile(code);
  if (result.kind === 'ok') {
    throw new Error(`expected a static error, but none produced`);
  }
  return result.errors.map(x => x.message);
}

test('cannot use var', () => {
  expect(staticError(`var x = 10`)).toEqual(
    expect.arrayContaining([
      `Use 'let' or 'const' to declare a variable.`
    ]));
});

test('cannot use switch', () => {
  expect(staticError(`switch (5) { case 5: }`)).toEqual(
    expect.arrayContaining([
      expect.stringMatching(`Do not use the 'switch' statement.`)
    ]));
});

test('can lookup members', () => {
  expect(run(`let obj = { x: 500 }; obj.x`))
    .toBe(500);
});

test('dynamic error when looking up non-member', () => {
  expect(dynamicError(`let obj = { x: 500 }; obj.y`))
    .toMatch('y is not a member');
});

test('cannot use for-of', () => {
  expect(staticError(`let a = [1, 2]; for (x of a) {}`)).toEqual(
    expect.arrayContaining([
    `Do not use for-of loops.`
    ]));
});

test('cannot use for-in', () => {
  expect(staticError(`let a = [1, 2]; for (x in a) {}`)).toEqual(
    expect.arrayContaining([
    `Do not use for-in loops.`
    ]));
});

test('cannot use in', () => {
  expect(staticError(`let a = [1, 2]; if (2 in a) {}`)).toEqual(
    expect.arrayContaining([
    `Do not use the 'in' operator.`
    ]));
});

test('can use iterator for loops', () => {
  expect(run(`let i = 0; for(i = 0; i < 10; ++i) {} i`))
    .toBe(10);
});

test('cannot use instanceof', () => {
  expect(staticError(`"foo" instanceof String`)).toEqual(
    expect.arrayContaining([
    `Do not use the 'instanceof' operator.`
    ]));
});


test('cannot use post-increment operator', () => {
  expect(run(`let a = 2; ++a`))
    .toBe(3);
  expect(run(`let a = 2; --a`))
    .toBe(1);

  expect(staticError(`let a = 2; let b = a++;`)).toEqual(
    expect.arrayContaining([
    `Do not use post-increment or post-decrement operators.`
    ]));
  expect(staticError(`let a = 2; let b = a--;`)).toEqual(
    expect.arrayContaining([
    `Do not use post-increment or post-decrement operators.`
    ]));
});

test('cannot use delete', () => {
  expect(staticError(`let a = { b: 1 }; delete a.b;`)).toEqual(
    expect.arrayContaining([
    `Do not use the 'delete' operator.`
    ]));
});

test('cannot use typeof', () => {
  expect(staticError(`let a = 2; let b = typeof a;`)).toEqual(
    expect.arrayContaining([
    `Do not use the 'typeof' operator.`
    ]));
});

test('cannot use throw', () => {
  expect(staticError(`throw "A user-defined exception.";`)).toEqual(
    expect.arrayContaining([
    `Do not use the 'throw' operator.`
    ]));
});

