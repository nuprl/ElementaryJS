import { compile, CompileOK, Result } from '../src/index';
import * as runtime from '../src/runtime';

const compileOpts = {
  isOnline: true,
  consoleLog: (message: any) => console.log(message),
  version: () => console.log('No version'),
  whitelistCode: {
    myModule: `function myModule() {
      return {
        method1: function() {
          return 'hi';
        },
        property1: 3
      };
    }`,
    mySecondModule: `function mySecondModule() {
      return {
        method2: function() {
          return 7;
        },
        property2: ['1', '2', '3']
      };
    }`,
    lib220: `function lib220() {
      return {};
    }`,
    oracle: `function oracle() {
      return {};
    }`,
    rrt: `function rrt() {
      return {};
    }`
  }
};

// Helps write test cases that expect the program to terminate normally.
// The result is the final value of the program.
function run(code: string) {
  return new Promise((resolve, reject) => {
    const runner = compile('', compileOpts);
    if (runner.kind === 'error') {
      console.log(`Rejecting ` + code);
      reject(runner);
      return;
    }
    runner.run((result) => {
      if (result.type === 'exception') {
        reject(result.value);
        return;
      }
      runner.eval(code, (result) => {
        if (result.type === 'exception') {
          reject(result.value);
          return;
        }
        resolve(result.value);
      });
    });
  });
}

function compileOK(code: string): CompileOK {
    const result = compile(code, compileOpts);
    if (result.kind === 'error') {
      throw result;
    }
    return result;
}

// Helps write test cases for dynamic errors. The returned string is the
// value of the .message field of any exception that the code raises.
// A test case should check that the message is reasonable, or it could have
// been some other kind of failure.
function dynamicError(code: string) {
  return new Promise((resolve, reject) => {
    const result = compile(code, compileOpts);
    if (result.kind === 'error') {
      reject(result);
      return;
    }

    return result.run((v) => {
      if (v.type === 'normal') {
        reject(`Expected exception, got result ${v.value}`);
        return;
      }
      if (typeof v.value.message !== 'string') {
        reject(`no error message`);
        return;
      }
      return resolve(v.value.message);
    });
  });
}

// Helps write test cases that check for static errors. The result
// is the array of error messages produced by ElementaryJS.
function staticError(code: string): string[] {
  const result = compile(code, compileOpts);
  if (result.kind === 'ok') {
    throw new Error(`expected a static error, but none produced`);
  }
  return result.errors.map(x => x.message);
}

// Returns the expected failure message from testing
function testFailure(description: string, errorMsg: string = 'Error: assertion failed') {
  return ` FAILED  ${description}\n         ${errorMsg}`;
}

// Returns the expected ok message from testing
function testOk(description: string) {
  return ` OK      ${description}`;
}

// Returns the expected test summary given number failed and number passed
function testSummary(failed: number, passed: number) {
  if (failed > 0) {
    return `Tests:     ${failed} failed, ${passed} passed, ${failed + passed} total`;
  }
  return `Tests:     ${passed} passed, ${failed + passed} total`;
}

test('must declare variables', () => {
  expect(staticError(`x = 10`)).toEqual(
    expect.arrayContaining([
      `You must declare variable 'x' before assigning a value to it.`
    ]));
});

test('duplicate let binding', () => {
  expect(compile(`let x = 0; let x = 1`, compileOpts)).toMatchObject({
    kind: 'error',
    errors: [ { line: 1, message: `unknown: Duplicate declaration "x"` } ]
  });
});

test('cannot use var', () => {
  expect(staticError(`var x = 10`)).toEqual(
    expect.arrayContaining([
      `Use 'let' or 'const' to declare a variable.`
    ]));
});

test('can dynamically change types', async () => {
  expect.assertions(2);
  await expect(run(`let x = "foo"; x = 42`)).resolves.toBe(42);
  await expect(run(`let x = 42; x = "foo"`)).resolves.toBe("foo");
});

test('invalid array creation', async () => {
  expect.assertions(3);
  await expect(dynamicError(`let a = new Array();`)).resolves.toMatch(
    `Class constructor ArrayStub cannot be invoked without 'new'`
  );
  await expect(dynamicError(`let a = new Array(1, 2, 3);`)).resolves.toMatch(
    `Class constructor ArrayStub cannot be invoked without 'new'`
  );
  // expect(dynamicError(`let a = Array(2, 1);`)).toMatch(
  //   'use Array.create(length, init)');
  await expect(dynamicError(`let a = Array.create(3.5, 0); a`)).resolves.toMatch(
    'positive integer');
});

test('valid array creation (1)', async () => {
  await expect(run(`let a = Array.create(2, 42); a`)).resolves.toEqual([42, 42]);
});

test('valid array creation (2)', async () => {
  await expect(run(`let a = Array.create(3, 0); a`)).resolves.toEqual([0, 0, 0]);
});

test('can lookup members', async() => {
  expect.assertions(6);
  await expect(run(`let obj = { x: 100 }; obj.x = 42`))
    .resolves.toBe(42);
  await expect(run(`let obj = { x: 500 }; obj.x`))
    .resolves.toBe(500);
  await expect(run(`let obj = { x: 16 }; Math.sqrt(obj.x)`))
    .resolves.toBe(4);
  let code = `
    function incr(x) {
      ++x.y;
    }
    let obj = { x: { y: 10 } };
    incr(obj.x);
    obj.x.y
  `;
  await expect(run(code)).resolves.toBe(11);
  await expect(run(`function foo() { return { x: 1 }; } ++foo().x`))
    .resolves.toBe(2);
  await expect(run(`function foo() { return { x: 1 }; } foo().x += 1`))
    .resolves.toBe(2);
});

test('can access array members', async () => {
  expect.assertions(1);
  await expect(run(`let obj = [10]; obj[0] = 42`))
    .resolves.toBe(42);
});

test('can assign array members', async () => {
  expect.assertions(1);
  await expect(run(`let obj = [10]; obj[0] += 42`))
    .resolves.toBe(52);
});

test('basic successful require', async () => {
  expect.assertions(1);
  await expect(run(`require('myModule');`))
    .resolves.toEqual({
      method1: expect.any(Function),
      property1: 3
    });
});

test('basic faulty require', async () => {
  expect.assertions(1);
  await expect(dynamicError(`require('myModule1');`))
    .resolves.toMatch(`'myModule1' not found.`);
});

test('require same module over', async (done) => {
  expect.assertions(3);
  const runner = compileOK(`let o = require('myModule'), p = require('myModule');
    o = require('myModule');`);
  runner.run(result => {
    expect(result.type).toBe('normal');
    expect(runner.g.o).toEqual({
      method1: expect.any(Function),
      property1: 3
    });
    expect(runner.g.p).toEqual({
      method1: expect.any(Function),
      property1: 3
    })
    done();
  });
});

test('access contents of require', async () => {
  expect.assertions(2);
  await expect(run(`const o = require('myModule'); o.property1;`))
    .resolves.toBe(3);
  await expect(run(`const o = require('myModule'); o.method1();`))
    .resolves.toBe('hi');
});

test('error for undefined accessor of require', async () => {
  expect.assertions(1);
  await expect(dynamicError(`const o = require('myModule'); o.p;`))
    .resolves.toMatch(`object does not have member 'p'`);
});

test('change require', async () => {
  expect.assertions(1);
  await expect(run(`let o = require('myModule'); o = require('mySecondModule');`))
    .resolves.toEqual({
      method2: expect.any(Function),
      property2: ['1', '2', '3']
    });
});

test('require after code', async () => {
  expect.assertions(1);
  await expect(run(`let o = 2 + 2; o = require('mySecondModule');`))
    .resolves.toEqual({
      method2: expect.any(Function),
      property2: ['1', '2', '3']
    });
});

test('can update array members', async () => {
  await expect(run(`let obj = [10]; ++obj[0]`))
    .resolves.toBe(11);
});

test('function can return undefined if not required', async () => {
  expect.assertions(1);
  let code = `
    function foo() {};
    foo();
  `;
  await expect(run(code)).resolves.toBe(undefined);
});

test('update expression must not duplicate computation', async () => {
  expect.assertions(3);
  let code = `
    let x = [ { y: 2 }, { y: 3 }];
    let i = 0;
    x[++i].y += 3;
    x[1].y
  `;
  await expect(run(code)).resolves.toBe(6);
  code = `
    let x = [ { y: 2 }, { y: 3 }];
    let i = 0;
    ++x[i += 1].y;
    x[1].y
  `;
  await expect(run(code)).resolves.toBe(4);
  code = `
    let x = 3;
    let i = 7;
    x+= ++i;
    x
  `;
  await expect(run(code)).resolves.toBe(11);
});

test('accessing member of string', async () => {
  let code = `
    let str = 'test';
    str.length;
  `;
  await  expect(run(code)).resolves.toBe(4);
});

test('accessing members of anonymous objects', async () => {
  expect.assertions(3);
  await expect(dynamicError(`[].x`))
    .resolves.toMatch(`object does not have member 'x'`);
  await expect(dynamicError(`[0, 1][10]`))
      .resolves.toMatch(`index '10' is out of array bounds`);
  await expect(run(`[3, 4][1]`)).resolves.toBe(4);
});

test('cannot access array non-members', async () => {
  expect.assertions(2);
  await expect(dynamicError(`let a = []; let b = a[0];`))
    .resolves.toMatch(`index '0' is out of array bounds`);
  await expect(dynamicError(`let a = []; a[0] = 0;`))
    .resolves.toMatch(`index '0' is out of array bounds`);
});

test('array index must be a positive integer', async () => {
  expect.assertions(2);
  await expect(dynamicError(`let a = []; let b = a[3.1415]`))
    .resolves.toMatch(`array index '3.1415' is not valid`);
  await expect(dynamicError(`let a = []; let b = a[-1]`))
      .resolves.toMatch(`array index '-1' is not valid`);
});

test('cannot pass array non-members as arguments to function', async () => {
  expect.assertions(1);
  await expect(dynamicError(`let a = []; Math.abs(a[0]);`))
    .resolves.toMatch(`index '0' is out of array bounds`);
});

test('cannot assign array non-members', async () => {
  expect.assertions(1);
  await expect(dynamicError(`let obj = []; obj[10] += 5`))
    .resolves.toMatch(`index '10' is out of array bounds`);
});

test('cannot update array non-members', async () => {
  expect.assertions(1);
  await expect(dynamicError(`let obj = []; ++obj[0]`))
    .resolves.toMatch(`index '0' is out of array bounds`);
});

test('dynamic error when looking up non-member', async () => {
  expect.assertions(2);
  await expect(dynamicError(`let obj = { x: 500 }; obj.y`))
    .resolves.toMatch(`object does not have member 'y'`);
    await expect(dynamicError(`let obj = { x: 500 }; ++obj.y`))
    .resolves.toMatch(`object does not have member 'y'`);
});

test('dynamic error when calling non-member function', async () => {
  expect.assertions(1);
  await expect(dynamicError(`let obj = { }; obj.foo(42)`))
    .resolves.toMatch('obj.foo is not a function');
});

test('dynamic error when looking up non-member 2', async () => {
  expect.assertions(1);
  await expect(dynamicError(`let obj = { x: 500 }; obj.y += 1`))
    .resolves.toMatch(`object does not have member 'y'`);
});

test('dynamic error when incrementing or decrementing non-number', async () => {
  expect.assertions(2);
  await expect(dynamicError(`let a = {}; --a`))
    .resolves.toMatch("argument of operator '--' must be a number");

  await expect(dynamicError(`let a = "foo"; ++a`))
    .resolves.toMatch("argument of operator '++' must be a number");
});

test('dynamic error when assigning a value to a non-member', async () => {
  expect.assertions(1);
  await expect(dynamicError(`let obj = {}; obj.y = 0;`))
    .resolves.toMatch(`object does not have member 'y'`);
});

test('dynamic error when using non-boolean in if statement', async () => {
  expect.assertions(1);
  await expect(dynamicError('let x = 0; if (x = 42) { }'))
    .resolves.toMatch(`expected a boolean expression, instead received '42'`);
});

test('Can access property when value is undefined', async () => {
  expect.assertions(2);
  await expect(run('let x = {y: undefined}; x.y;')).resolves.toBe(undefined);
  await expect(run('let x = {y: 0}; x.y = undefined; x.y;')).resolves.toBe(undefined);
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

test('can use iterator for loops', async () => {
  expect.assertions(1);
  await expect(run(`let i = 0; for(i = 0; i < 10; ++i) {} i`))
    .resolves.toBe(10);
});

test('cannot use instanceof', () => {
  expect(staticError(`"foo" instanceof String`)).toEqual(
    expect.arrayContaining([
      `Do not use the 'instanceof' operator.`
    ]));
});

test('preserve operator precedence', async () => {
  expect.assertions(4);
  await expect(run(`3 + 2 * 3`)).resolves.toBe(9);
  await expect(run(`4 * 3 + 2 * 3`)).resolves.toBe(18);
  await expect(run(`4 + 3 * 2 + 3`)).resolves.toBe(13);
  await expect(run(`12 / 3 * 2 + 3`)).resolves.toBe(11);
});

test('dynamic error when mixing types', async () => {
  expect.assertions(2);
  await expect(dynamicError(`let a = {}, b = 1; a + b`))
    .resolves.toMatch("arguments of operator '+' must both be numbers or strings");
    await expect(dynamicError(`let a = "foo", b = 1; a - b`))
    .resolves.toMatch("arguments of operator '-' must both be numbers");
});

test('dynamic num check order', async () => {
  expect.assertions(2);
  // The * operator has precedence over -, hence should be dyn. checked first.
  await expect(dynamicError(`let a = "", b = 1, c = {}; a * b - c`))
    .resolves.toMatch("arguments of operator '*' must both be numbers");
  await expect(dynamicError(`let a = "", b = 1, c = {}; a / b * c`))
    .resolves.toMatch("arguments of operator '/' must both be numbers");
});

test('can use pre-update operator with numbers', async () => {
  expect.assertions(4);
  await expect(run(`let a = { b : 3 }; ++a.b`))
    .resolves.toBe(4);
  await expect(run(`let a = 2; ++a`))
    .resolves.toBe(3);
  await expect(run(`let a = 2; --a`))
    .resolves.toBe(1);
  let code = `
    function foo() {
      return { x: 10 };
    }
    let a = ++foo().x;
    a`
  await expect(run(code)).resolves.toBe(11);
});

test('cannot have literal object member names', () => {
  expect(staticError(`let myObj = { 0: 0 };`)).toEqual(
    expect.arrayContaining([
      `Object member name must be an identifier.`
    ]));
  expect(staticError(`let myObj = { 'Foo': 0 };`)).toEqual(
    expect.arrayContaining([
      `Object member name must be an identifier.`
    ]));
});

test('cannot have duplicate names in object literals', () => {
  expect(staticError(`let myObj = { a: true, a: false };`)).toEqual(
    expect.arrayContaining([
      `Object member name may only be used once; a.`
    ]));
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

test('cannot use throw', () => {
  expect(staticError(`throw "A user-defined exception.";`)).toEqual(
    expect.arrayContaining([
      `Do not use the 'throw' operator.`
    ]));
});

test('can use string concatenation and assignment operator', async () => {
  expect.assertions(1);
  await expect(run(`let a = "hello "; a += "world"`))
    .resolves.toBe("hello world");
});

test('can use arithmetic assignment operators', async () => {
  expect.assertions(4);
  await expect(run(`let a = 1; a += 1`))
    .resolves.toBe(2);

  await expect(run(`let a = 1; a -= 1`))
    .resolves.toBe(0);

  await expect(run(`let a = 1; a *= 7`))
    .resolves.toBe(7);

  await expect(run(`let a = 12; a /= 3`))
    .resolves.toBe(4);
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

test('loop body must be BlockStatement', () => {
  expect(staticError(`for (let i = 0; i < 10; ++i) i;`)).toEqual(
    expect.arrayContaining([
      `Loop body must be enclosed in braces.`
    ]));
  expect(staticError(`let i = 0; while(i < 10) ++i;`)).toEqual(
    expect.arrayContaining([
      `Loop body must be enclosed in braces.`
    ]));
  expect(staticError(`let i = 0; do ++i; while (i < 10)`)).toEqual(
    expect.arrayContaining([
      `Loop body must be enclosed in braces.`
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

test('disallowed comparison operators', () => {
  expect(staticError(`let x = "1", y = 1; x == y`)).toEqual(
    expect.arrayContaining([
      `Do not use the '==' operator. Use '===' instead.`
    ]));
  expect(staticError(`let x = "1", y = 1; x != y`)).toEqual(
    expect.arrayContaining([
      `Do not use the '!=' operator. Use '!==' instead.`
    ]));
});

test('allowed comparison operators', async () => {
  expect.assertions(4);
  await expect(run(`let x = 1, y = 1; x === y`)).resolves.toBe(true);
  await expect(run(`let x = 2, y = 1; x === y`)).resolves.toBe(false);
  await expect(run(`let x = 1, y = 1; x !== y`)).resolves.toBe(false);
  await expect(run(`let x = 2, y = 1; x !== y`)).resolves.toBe(true);
});

test('call a builtin method', async () => {
  expect.assertions(1);
  await expect(run(`
    let x = [];
    x.push(100);
    x[0]`)).resolves.toBe(100);
});

test('fibonacci of 10', async () => {
  await expect(run(`
      // Fibonacci sequence, where fibonacci(0) = 0,
      function fibonacci(n) {
        if ( (n % 1) !== 0) {
          console.error('n must be an integer!');
          return 0;
        }
        if (n < 1) {
          return 0;
        } else if (n === 1) {
          return 1;
        }
        return (fibonacci(n - 1) + fibonacci(n - 2));
      }
      fibonacci(10);
  `)).resolves.toBe(55);
});

test('Run empty program', async () => {
  expect.assertions(1);
  await expect(run('')).resolves.toBeUndefined();
});

test('Can set fields of this in a constructor',  (done) => {
  expect.assertions(2);
  const runner = compileOK(`
    class C { constructor() { this.x = 5; } }
    let r = (new C()).x`);
  runner.run(result => {
    expect(result.type).toBe('normal');
    expect(runner.g.r).toBe(5);
    done();
  });
});

test('Dynamic checks when settings fields of other objects in constructor', async () => {
  expect.assertions(1);
  await expect(dynamicError(`
    class C {
      constructor(o) {
        o.x = 5;
      }
    }
    new C({ })`)).resolves.toMatch(`object does not have member 'x'`);
});

test('Dynamic check for this.x = y in function nested in constructor', async () => {
  expect.assertions(1);
  await expect(dynamicError(`
    class C {
      constructor() {
        (function() { this.x = 5; })();
      }
    }
    new C()`)).resolves.toMatch(`cannot access member of non-object value type`);
});

test('arity-mismatch: too few arguments', async () => {
  expect.assertions(1);
  await expect(dynamicError(`
    function F(x) { }
    F()`)).resolves
    .toMatch(`function F expected 1 argument but received 0 arguments`);
});

test('arity-mismatch: too many arguments', async () => {
  expect.assertions(1);
  await expect(dynamicError(`
    function F(x) { }
    F(1,2,3)`)).resolves
    .toMatch(`function F expected 1 argument but received 3 arguments`);
});

test('Classes test', async () => {
  expect.assertions(1);
  await expect(run(`
    class Rectangle {
      constructor(w, h) {
        if (w === undefined || h === undefined) {
          console.error("ERROR: MUST SPECIFY WIDTH AND HEIGHT");
        }
        this.width = w;
        this.height = h;
      }
      area() {
        return this.width * this.height;
      }
      name() {
        return "rectangle";
      }
      properties() {
        return "width:" + this.width.toString() +
          ", height:" + this.height.toString();
      }
    };

    class Circle {
      constructor(r) {
        if (r === undefined) {
          console.error("ERROR: MUST SPECIFY RADIUS");
        }
        this.radius = r;
      }
      area() {
        return Math.PI * Math.pow(this.radius, 2);
      }
      name() {
        return "circle";
      }
      properties() {
        return "radius:" + this.radius.toString();
      }
    };

    let shapes = [
      new Rectangle(2, 3),
      new Circle(1),
    ];
    shapes.forEach(function(s) {
      let str = "Area of " + s.name() +
        " with " + s.properties() +
        " = " + s.area().toString();
    });`)).resolves.toBeUndefined();
});

test('if else must be BlockStatement', async () => {
  expect.assertions(4);
  expect(staticError(`let s = 1; if (true) ++s;`)).toEqual(
    expect.arrayContaining([
      `if statement body must be enclosed in braces.`
    ]));
  expect(staticError(`let i = 0; if (true) ++i; else ++i`)).toEqual(
    expect.arrayContaining([
      `Body of if-else statement must be enclosed in braces.`
    ]));
    await expect(run(`let i = 0; if (true) { ++i}; i;`)).resolves.toBe(1);
  await expect(run(`
    let i = 0;
    if (false) {
      ++i
    } else {
      i += 2;
    }
    i;
  `)).resolves.toBe(2);
});

test('for statement must have three parts present', async () => {
  expect(staticError(`
    for (;;) {
      break;
    }
  `)).toEqual(expect.arrayContaining([
    `for statement variable initialization must be present`,
    `for statement termination test must be present`,
    `for statement update expression must be present`
  ]));
  expect(staticError(`
    for (let i = 0;;) {
      break;
    }
  `)).toEqual(expect.arrayContaining([
    `for statement termination test must be present`,
    `for statement update expression must be present`
  ]));
  expect(staticError(`
    for (let i = 0; i < 10;) {
      break;
    }
  `)).toEqual(expect.arrayContaining([
    `for statement update expression must be present`
  ]));
  expect(staticError(`
    for (something(); i < 10; ++i) {
      break;
    }
  `)).toEqual(expect.arrayContaining([
    `for statement variable initialization must be an assignment or a variable declaration`
  ]));
  await expect(run(`
    let i = 0;
    for (i = 0; i < 3; ++i) {}
    i;
  `)).resolves.toBe(3);
});

test('logical operators short-circuit', async () => {
  await expect(run(`true || doesNotExists()`)).resolves.toBe(true);
  await expect(run(`true || 123`)).resolves.toBe(true);
  await expect(run(`false || true`)).resolves.toBe(true);
  await expect(dynamicError(`false || doesNotExists()`)).resolves.toMatch(`doesNotExists is not defined`);
  await expect(dynamicError(`false || 123`)).resolves.toMatch(`arguments of operator '||' must both be booleans`);
  await expect(dynamicError(`false || 'as'`)).resolves.toMatch(`arguments of operator '||' must both be booleans`);
  await expect(dynamicError(`0 || false`)).resolves.toMatch(`arguments of operator '||' must both be booleans`);

  await expect(run(`false && doesNotExists()`)).resolves.toBe(false);
  await expect(run(`false && 123`)).resolves.toBe(false);
  await expect(run(`false && true`)).resolves.toBe(false);
  await expect(dynamicError(`true && doesNotExists()`)).resolves.toMatch(`doesNotExists is not defined`);
  await expect(dynamicError(`true && 123`)).resolves.toMatch(`arguments of operator '&&' must both be booleans`);
  await expect(dynamicError(`true && 'as'`)).resolves.toMatch(`arguments of operator '&&' must both be booleans`);
  await expect(dynamicError(`1 && false`)).resolves.toMatch(`arguments of operator '&&' must both be booleans`);

  await expect(run(`
    function returnTrue() {
      return true;
    }
    !(returnTrue() || doesNotExists()) && doesNotExists();
  `)).resolves.toBe(false);
});

test('ElementaryJS statically reports const violations', () => {
  expect(staticError(`
    const x = 1;
    x = 2;
  `)).toEqual(expect.arrayContaining([
    `variable is 'const'`
  ]));
});

test('String.split produces a stopified array', async () => {
  await expect(dynamicError(`
    'a,b,c'.split(',').map(function(x, y, z) { return 0; })
  `)).resolves.toMatch(`function (anonymous) expected 3 arguments but received 1 argument`);
});

test('cannot set .length of arrays', async () => {
  await expect(dynamicError(`[1,2,3].length = 5`,))
  .resolves.toMatch(`cannot set .length of an array`);
});

test('cannot use computed member expressions on objects', async () => {
  await expect(dynamicError(`let r = {a: 5}[10]`,))
  .resolves.toMatch(`array indexing called on a non-array value type`);
});

test('Overwriting globals cause runtime error', async () => {
  await expect(dynamicError(`let test = 1`)).resolves.toMatch(`test is part of the global library, and cannot be overwritten.`);
  await expect(dynamicError(`let lib220 = 1`)).resolves.toMatch(`lib220 is part of the global library, and cannot be overwritten.`);
  await expect(dynamicError(`let assert = 1`)).resolves.toMatch(`assert is part of the global library, and cannot be overwritten.`);
  await expect(dynamicError(`let console = 1`)).resolves.toMatch(`console is part of the global library, and cannot be overwritten.`);
  await expect(dynamicError(`let version = 1`)).resolves.toMatch(`version is part of the global library, and cannot be overwritten.`);
  await expect(dynamicError(`let elementaryjs = 1`)).resolves.toMatch(`elementaryjs is part of the global library, and cannot be overwritten.`);
  await expect(dynamicError(`let undefined = 1`)).resolves.toMatch(`undefined is part of the global library, and cannot be overwritten.`);
  // Array, Object and Math cannot be overwritten and does not throw dynamic error.
  await expect(run(`function rewrite() { let test = 1; return test } rewrite();`)).resolves.toBe(1);
});

test('parseInt is available', async () => {
  await expect(run(`parseInt("100")`)).resolves.toBe(100);
});

test('parseFloat is available', async () => {
  await expect(run(`parseFloat("3.14159")`)).resolves.toBe(3.14159);
});

test('Allow arrow functions with expression bodies', async () => {
  await expect(run(`((x) => x + 1)(10)`)).resolves.toBe(11);
});

test('Allow arrow functions with block bodies', async () => {
  await expect(run(`(x => { return x + 1; })(10)`)).resolves.toBe(11);
});

test('Disallow rest params', async () => {
  expect(staticError(`function rest(...args) {}`)).toEqual(expect.arrayContaining([
    `The rest parameter is not supported.`
  ]));
});

test('Arrow functions inherit this', async () => {
  expect.assertions(2);
  await expect(run(`
  class TestClass {
    constructor() {
      this.data = 'abcde';
    }

    arrowFuncTest() {
      let k = () => {
        return this.data + 'f';
      }
      return k();
    }
  }

  new TestClass().arrowFuncTest();`)).resolves.toBe('abcdef');

  await expect(run(`
  class TestClass {
    constructor() {
      this.data = 1;
    }
    nestedArrow() {
      return (() => (() => this.data)() + 1)();
    }
  }
  new TestClass().nestedArrow();
  `)).resolves.toBe(2);
});

test('Arrow functions has arity checking', async () => {
  await expect(dynamicError(`
  let a = (a) => 1;
  a();
  `)).resolves.toMatch('function (anonymous) expected 1 argument but received 0 arguments');
})

test('Arrow functions have no implicit params (1)', async () => {
  await expect(dynamicError(`
  let a = {
    b: 0,
    c: () => this.b
   };

   a.c();`)).resolves.toMatch(`cannot access member of non-object value types`);
});

test('Arrow functions have no implicit params (2)', async () => {
  await expect(run(`
  let a = {
    b: 0,
    c: (d, e, f) => arguments.length
   };

   a.c(1, 2, 3);`)).resolves.toBe(0);
});

test('Parser should work', async () => {
  await expect(run(`
    parser.parseProgram('let x = 1; let y = x * 2;').kind;
  `)).resolves.toBe('ok');
});

test('Infinity', async () => {
  await expect(run(`
    let max_reducer = function(acc, elem) {
      return (elem > acc) ? elem : acc;
    };
    [1, 5, 3, 0, -1].reduce(max_reducer, -Infinity);
  `)).resolves.toBe(5);
  await expect(run(`
    let max_reducer = function(acc, elem) {
      return (elem > acc) ? elem : acc;
    };
    [].reduce(max_reducer, -Infinity);
  `)).resolves.toBe(-Infinity);
});

test('LHS w/ another assign op', async () => {
  await expect(run(`
    const a = [1, 3, 5, 7];
    let i = 0;
    a[++i] += 3;
    const expected = {a, i};
    expected;
  `)).resolves.toEqual({
    a: [1, 6, 5, 7],
    i: 1
  });
  await expect(run(`
    const a = [1, 3, 5, 7];
    let i = 0;
    a[++i] = a[++i] + 3;
    const expected = {a, i};
    expected;
  `)).resolves.toEqual({
    a: [1, 8, 5, 7],
    i: 2
  });
});

describe('Testing in ElementaryJS', () => {

  beforeEach(() => {
    runtime.enableTests(true);
  });

  test('test can break out of an infinite loop', async () => {
    runtime.enableTests(true, 2000);
    await expect(run(`
      test('loop forever', function() {
        while(true) {};
      })`))
      .resolves.toBe(undefined);
    expect(runtime.summary(false).output).toBe([
      testFailure('loop forever', 'time limit exceeded'),
      testSummary(1, 0)
    ].join('\n'));
  });

  test('test can break out of an infinite loop and run next test', async () => {
    runtime.enableTests(true, 2000);
    await expect(run(`
      test('loop forever', function() {
        while(true) {};
      });
      test('succeeds', function() {
      });

      `))
      .resolves.toBe(undefined);
    expect(runtime.summary(false).output).toBe([
      testFailure(`loop forever`, 'time limit exceeded'),
      testOk('succeeds'),
      testSummary(1, 1)
    ].join('\n'));
  }, 3000);

  test('test with higher order functions with infinite loop', async () => {
    runtime.enableTests(true, 3000); // time out of 3 seconds
    expect(await run(`
      function takeInFunc(func, arr) {
        let val = func(arr);
        while (true) {1; }
        return val
      }
      function adder(num) {
        while (true) {1;}
        return function(x) { return x + num };
      }
      test('higher order', function() {
        takeInFunc(function(x) {return 1}, 1);
      });
      test('adder', function() { adder(1)(2) });
    `)).toBe(undefined);
    expect(runtime.summary(false).output).toBe([
      testFailure('higher order', 'time limit exceeded'),
      testFailure('adder', 'time limit exceeded'),
      testSummary(2, 0)
    ].join('\n'));
  }, 7000); // should take no more than 7 seconds (running two tests)

  test('test with HOFs running a while', async () => {
    runtime.enableTests(true, 3000); // timeout of 3 seconds
    expect(await run(`
      function hof(func) {
        let newFunc = function(x) { return 2 + func(x) };
        let x = -9999999;
        while (x !== 9999999) {
          x += 1;
        }
        return newFunc;
      }
      test('run a while', function() {hof(function(x) {return x + 1})});
    `)).toBeUndefined();
    expect(runtime.summary(false).output).toBe([
      testFailure('run a while', 'time limit exceeded'),
      testSummary(1, 0),
    ].join('\n'));
  }, 4000); // should take no more than 4 seconds

  test('No tests', () => {
    expect(runtime.summary(false).output).toBe([
      `◈ You don't seem to have any tests written`,
      `◈ To run a test, begin a function name with 'test'`
    ].join('\n'));
  });

  test('Assert test', () => {
    expect(runtime.assert(true)).toBe(true);
    expect(() => {
      runtime.assert(false);
    }).toThrow('assertion failed');
    expect(() => {
      runtime.assert(2 as any);
    }).toThrow('not a boolean');
  });

  test('One OK test', async () => {
    expect(await run(`test('Test 1', function() {})`)).toBe(undefined);
    expect(runtime.summary(false).output).toBe([
      testOk('Test 1'),
      testSummary(0, 1)
    ].join('\n'));
  });

  test('One failed Test', async () => {
    expect(await run(`test('Failed Test', function() { assert(false) })`)).toBe(undefined);
    expect(runtime.summary(false).output).toBe([
      testFailure('Failed Test', 'Error: assertion failed'),
      testSummary(1, 0)
    ].join('\n'));
  });

  test('One Ok, One failed', async () => {
    expect(await run(`
      test('Ok test', function() {return 1});
      test('Failed', function() { assert(false)});
    `)).toBe(undefined);
    expect(runtime.summary(false).output).toBe([
      testOk('Ok test'),
      testFailure('Failed', 'Error: assertion failed'),
      testSummary(1, 1),
    ].join('\n'));
  });

  test('20 tests', async () => {
    expect(await run(`
      for (let i = 0; i < 10; ++i) {
        test(i.toString(), function() { return 1});
      }
      for (let i = 10; i < 20; ++i) {
        test(i.toString(), function() { assert(false)});
      }
    `)).toBe(undefined);
    let output: string[] = [];
    for (let i = 0; i < 10; i++) {
      output.push(testOk(i.toString()));
    }
    for (let i = 10; i < 20; i++) {
      output.push(testFailure(i.toString(), 'Error: assertion failed'));
    }
    output.push(testSummary(10, 10));
    expect(runtime.summary(false).output).toBe(output.join('\n'));
  });

  test('Test not enabled', () => {
    runtime.enableTests(false);
    runtime.test('Test', () => { runtime.assert(false)});
    expect(runtime.summary(false).output).toMatch(/not enabled/);
  });

  test('Summary twice not allowed', () => {
    runtime.summary(false);
    expect(runtime.summary(false).output).toMatch(/not enabled/);
  });

  test('Stopify bug: arguments array materialization and boxing interacts poorly', (done) => {
    const runner = compileOK(`
      let r1 = false;
      let r2 = false;
      let r3 = false;
      let r4 = false;
      function oracle(x) {
        let b = true;
        test("Test 1", function() {
          r1 = x === 900;
        });
        r2 = x === 900;
        test("Test 2", function() {
          r3 = x === 900;
        });
        r4 = x === 900;
      }
      oracle(900)
    `);
    runner.run((result) => {
      expect(runner.g.r1).toBe(true);
      expect(runner.g.r2).toBe(true);
      expect(runner.g.r3).toBe(true);
      expect(runner.g.r4).toBe(true);
      done();
    });
  });
});
