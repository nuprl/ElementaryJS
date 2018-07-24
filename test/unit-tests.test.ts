import { compile } from '../ts/index';
import { sandbox } from '../ts/sandbox';
import { default as generator } from 'babel-generator';

// Helps write test cases that expect the program to terminate normally.
// The result is the final value of the program.
function run(code: string): any {
  const result = compile(code, false);
  if (result.kind === 'error') {
    throw result;
  }
  const compiledCode = generator(result.node, { }).code;
  const v = sandbox(compiledCode);
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
  const result = compile(code, false);
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
  throw new Error(`expected dynamic error, got result ${v.value} with sandbox result.kind = '${v.kind}'`);
}

// Helps write test cases that check for static errors. The result
// is the array of error messages produced by ElementaryJS.
function staticError(code: string): string[] {
  const result = compile(code, false);
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
  expect(run(`let obj = { x: 100 }; obj.x = 42`))
      .toBe(42);
  expect(run(`let obj = { x: 500 }; obj.x`))
    .toBe(500);
  expect(run(`let obj = { x: 16 }; Math.sqrt(obj.x)`))
    .toBe(4);
  let code = `
    function incr(x) {
      ++x.y;
    }
    let obj = { x: { y: 10 } };
    incr(obj.x);
    obj.x.y
  `;
  expect(run(code)).toBe(11);
  expect(run(`function foo() { return { x: 1 }; } ++foo().x`))
    .toBe(2);
  expect(run(`function foo() { return { x: 1 }; } foo().x += 1`))
    .toBe(2);
});

test('can access array members', () => {
  expect(run(`let obj = [10]; obj[0] = 42`))
      .toBe(42);
});

test('can assign array members', () => {
  expect(run(`let obj = [10]; obj[0] += 42`))
      .toBe(52);
});

test('can update array members', () => {
  expect(run(`let obj = [10]; ++obj[0]`))
      .toBe(11);
});

test('updateexpression must not duplicate computation', () => {
  let code = `
    let x = [ { y: 2 }, { y: 3 }];
    let i = 0;
    x[++i].y += 3;
    x[1].y
  `;
  expect(run(code)).toBe(6);
  code = `
    let x = [ { y: 2 }, { y: 3 }];
    let i = 0;
    ++x[i += 1].y;
    x[1].y
  `;
  expect(run(code)).toBe(4);
});

test('cannot assign array non- members', () => {
  expect(dynamicError(`let obj = []; obj[0] += 5`))
    .toMatch('Index 0 does not exist in array');
});

test('cannot update array non- members', () => {
  expect(dynamicError(`let obj = []; ++obj[0]`))
    .toMatch('Index 0 does not exist in array');
});

test('dynamic error when looking up non-member', () => {
  expect(dynamicError(`let obj = { x: 500 }; obj.y`))
    .toMatch('y is not a member');
  expect(dynamicError(`let obj = { x: 500 }; ++obj.y`))
    .toMatch('y is not a member');
});

test('dynamic error when looking up non-member 2', () => {
  expect(dynamicError(`let obj = { x: 500 }; obj.y += 1`))
      .toMatch('y is not a member');
});

test('dynamic error when incrementing or decrementing non-number', () => {
  expect(dynamicError(`let a = {}; --a`))
    .toMatch("argument of operator '--' must be a number");

  expect(dynamicError(`let a = "foo"; ++a`))
    .toMatch("argument of operator '++' must be a number");
});

test('dynamic error when assigning a value to a non-member', () => {
  expect(dynamicError(`let obj = {}; obj.y = 0;`))
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

test('can use pre-update operator with numbers', () => {
  expect(run(`let a = { b : 3 }; ++a.b`))
    .toBe(4);
  expect(run(`let a = 2; ++a`))
    .toBe(3);
  expect(run(`let a = 2; --a`))
    .toBe(1);
  let code = `
    function foo() {
      return { x: 10 };
    }
    let a = ++foo().x;
    a`
  expect(run(code)).toBe(11);
});

test('cannot use post-update operator', () => {
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

test('can use string concatenation and assignment operator', () => {
  expect(run(`let a = "hello "; a += "world"`))
    .toBe("hello world");
});

test('can use arithmetic assignment operators', () => {
  expect(run(`let a = 1; a += 1`))
    .toBe(2);

  expect(run(`let a = 1; a -= 1`))
    .toBe(0);

  expect(run(`let a = 1; a *= 7`))
    .toBe(7);

  expect(run(`let a = 12; a /= 3`))
    .toBe(4);
});

test('cannot use bitmask assignment operators', () => {
  expect(staticError(`let x = 1, y = 2; x &= y;`)).toEqual(
    expect.arrayContaining([
    `Do not use the '&=' operator.`
    ]));

  expect(staticError(`let x = 1, y = 2; x |= y;`)).toEqual(
    expect.arrayContaining([
    `Do not use the '|=' operator.`
    ]));

  expect(staticError(`let x = 1, y = 2; x ^= y;`)).toEqual(
    expect.arrayContaining([
    `Do not use the '^=' operator.`
    ]));
});

test('cannot use shift assignment operators', () => {
  expect(staticError(`let x = 1, y = 2; x >>= y;`)).toEqual(
    expect.arrayContaining([
    `Do not use the '>>=' operator.`
    ]));

  expect(staticError(`let x = 1, y = 2; x <<= y;`)).toEqual(
    expect.arrayContaining([
    `Do not use the '<<=' operator.`
    ]));

  expect(staticError(`let x = 1, y = 2; x >>>= y;`)).toEqual(
    expect.arrayContaining([
    `Do not use the '>>>=' operator.`
    ]));
});

test('gigantic test case', () => {
  let source = `
      // Fibonacci sequence, where fibonacci(0) = 0, 
      function fibonacci(n) {
        if ( (n % 1) != 0) {
          console.error('n must be an integer!');
          return 0;
        }
        if (n < 1) {
          return 0;
        } else if (n == 1) {
          return 1;
        }
        return (fibonacci(n - 1) + fibonacci(n - 2));
      }
      fibonacci(10);
  `;
  expect(run(source)).toBe(55);
});

