import { compile } from '../ts/index';
import { sandbox } from '../ts/sandbox';
import * as runtime from '../ts/runtime';
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

// Returns the expected failure message from testing
function testFailure(description: string, errorMsg: string = 'assertion failed') {
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

test('can dynamically change types', () => {
  expect(run(`let x = "foo"; x = 42`)).toBe(42);
  expect(run(`let x = 42; x = "foo"`)).toBe("foo");
});

test('invalid array creation', () => {
  expect(dynamicError(`let a = new Array();`)).toMatch(
    'use Array.create(length, init)'
  );
  expect(dynamicError(`let a = new Array(1, 2, 3);`)).toMatch(
    'use Array.create(length, init)'
  );
  // expect(dynamicError(`let a = Array(2, 1);`)).toMatch(
  //   'use Array.create(length, init)');
  expect(dynamicError(`let a = Array.create(3.5, 0); a`)).toMatch(
    'positive integer');
  });

test('valid array creation', () => {
  expect(run(`let a = Array.create(2, 42); a`)).toEqual([42, 42]);
  expect(run(`let a = Array.create(3, 0); a`)).toEqual([0, 0, 0]);
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

test('function can return undef if not required', () => {
  let code = `
    function foo() {};
    foo();
  `;
  expect(run(code)).toBe(undefined);
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
  code = `
    let x = 3;
    let i = 7;
    x+= ++i;
    x
  `;
  expect(run(code)).toBe(11);
});

test('acessing members of anonymous objects', () => {
  expect(dynamicError(`[].x`))
    .toMatch(`object does not have member 'x'`);
  expect(dynamicError(`[0, 1][10]`))
      .toMatch(`index '10' is out of array bounds`);
  expect(run(`[3, 4][1]`)).toBe(4);
});

test('cannot access array non-members', () => {
  expect(dynamicError(`let a = []; let b = a[0];`))
    .toMatch(`index '0' is out of array bounds`);
  expect(dynamicError(`let a = []; a[0] = 0;`))
    .toMatch(`index '0' is out of array bounds`);
});


test('array index must be a positive integer', () => {
  expect(dynamicError(`let a = []; let b = a[3.1415]`))
    .toMatch(`array index '3.1415' is not valid`);
  expect(dynamicError(`let a = []; let b = a[-1]`))
      .toMatch(`array index '-1' is not valid`);
});

test('cannot assign array non-members', () => {
  expect(dynamicError(`let obj = []; obj[10] += 5`))
    .toMatch(`index '10' is out of array bounds`);
});

test('cannot update array non-members', () => {
  expect(dynamicError(`let obj = []; ++obj[0]`))
    .toMatch(`index '0' is out of array bounds`);
});

test('dynamic error when looking up non-member', () => {
  expect(dynamicError(`let obj = { x: 500 }; obj.y`))
    .toMatch(`object does not have member 'y'`);
  expect(dynamicError(`let obj = { x: 500 }; ++obj.y`))
    .toMatch(`object does not have member 'y'`);
});

test.skip('dynamic error when calling non-member function', () => {
  expect(dynamicError(`let obj = { }; obj.foo(42)`))
    .toMatch('foo is not a member function of obj');
});

test('dynamic error when looking up non-member 2', () => {
  expect(dynamicError(`let obj = { x: 500 }; obj.y += 1`))
    .toMatch(`object does not have member 'y'`);
});

test('dynamic error when incrementing or decrementing non-number', () => {
  expect(dynamicError(`let a = {}; --a`))
    .toMatch("argument of operator '--' must be a number");

  expect(dynamicError(`let a = "foo"; ++a`))
    .toMatch("argument of operator '++' must be a number");
});

test('dynamic error when assigning a value to a non-member', () => {
  expect(dynamicError(`let obj = {}; obj.y = 0;`))
    .toMatch(`object does not have member 'y'`);
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

test('preserve operator precedence', () => {
  expect(run(`3 + 2 * 3`)).toBe(9);
  expect(run(`4 * 3 + 2 * 3`)).toBe(18);
  expect(run(`4 + 3 * 2 + 3`)).toBe(13);
  expect(run(`12 / 3 * 2 + 3`)).toBe(11);
});

test('dynamic error when mixing types', () => {
  expect(dynamicError(`let a = {}, b = 1; a + b`))
    .toMatch("arguments of operator '+' must both be numbers or strings");
  expect(dynamicError(`let a = "foo", b = 1; a - b`))
    .toMatch("arguments of operator '-' must both be numbers");

});

test('dynamic num check order', () => {
  // The * operator has precedence over -, hence should be dyn. checked first.
  expect(dynamicError(`let a = "", b = 1, c = {}; a * b - c`))
    .toMatch("arguments of operator '*' must both be numbers");
  expect(dynamicError(`let a = "", b = 1, c = {}; a / b * c`))
    .toMatch("arguments of operator '/' must both be numbers");
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

test('loop body must be BlockStatement', () => {
  expect(staticError(`for (let i = 0; i < 10; ++i) i;`)).toEqual(
    expect.arrayContaining([
      `Loop body must be enclosed in braces.`
    ]));
  expect(staticError(`let i = 0; while(i < 10) ++i;`)).toEqual(
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

test('allowed comparison operators', () => {
  expect(run(`let x = 1, y = 1; x === y`)).toBe(true);
  expect(run(`let x = 2, y = 1; x === y`)).toBe(false);
  expect(run(`let x = 1, y = 1; x !== y`)).toBe(false);
  expect(run(`let x = 2, y = 1; x !== y`)).toBe(true);
});

test('call a builtin method', () => {
  expect(run(`
    let x = [];
    x.push(100);
    x[0]`)).toBe(100);
});


test('gigantic test case', () => {
  let source = `
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
  `;
  expect(run(source)).toBe(55);
});

test('Run empty program', () => {
  expect(run('')).toBeUndefined();
});

test('Can set fields of this in a constructor', () => {
  expect(run(`
    class C { constructor() { this.x = 5; } }
    (new C()).x`)).toBe(5);
});

test('Dynamic checks when settings fields of other objects in constructor', () => {
  expect(dynamicError(`
    class C { 
      constructor(o) { 
        o.x = 5;
      }
    }
    new C({ })`)).toMatch(`object does not have member 'x'`);
});

test('Dynamic check for this.x = y in function nested in constructor', () => {
  expect(dynamicError(`
    class C { 
      constructor() { 
        (function() { this.x = 5; })();
      }
    }
    new C()`)).toMatch(`object does not have member 'x'`);
});

test('Classes test', () => {
  expect(run(`
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
      console.log("Area of " + s.name() + 
        " with " + s.properties() + 
        " = " + s.area().toString());
    });`));
});

test('if else must be BlockStatement', () => {
  expect(staticError(`let s = 1; if (true) ++s;`)).toEqual(
    expect.arrayContaining([
      `if statement body must be enclosed in braces.`
    ]));
  expect(staticError(`let i = 0; if (true) ++i; else ++i`)).toEqual(
    expect.arrayContaining([
      `Body of if-else statement must be enclosed in braces.`
    ]));
  expect(run(`let i = 0; if (true) { ++i}; i;`)).toBe(1);
  expect(run(`
    let i = 0; 
    if (false) { 
      ++i
    } else {
      i += 2;
    }
    i;
  `)).toBe(2);
});

test('for statement must have three parts present', () => {
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
  expect(run(`
    let i = 0;
    for (i = 0; i < 3; ++i) {}
    i;
  `)).toBe(3);
});

describe('ElementaryJS Testing', () => {

  beforeEach(() => {
    runtime.enableTests(true, undefined);
  });

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

  test('One OK test', () => {
    const description = 'Test 1'
    runtime.test(description, () => {
      return 1;
    });
    expect(runtime.summary(false).output).toBe([
      testOk(description),
      testSummary(0, 1)
    ].join('\n'));
  });

  test('One failed Test', () => {
    const description = 'Failed Test';
    runtime.test(description, () => {
      runtime.assert(false);
    });
    expect(runtime.summary(false).output).toBe([
      testFailure(description),
      testSummary(1, 0)
    ].join('\n'));
  });

  test('One Ok, One failed', () => {
    const okDesc = 'Ok test';
    const failDesc = 'Failed';
    runtime.test(okDesc, () => { return 1; });
    runtime.test(failDesc, () => { runtime.assert(false) });
    expect(runtime.summary(false).output).toBe([
      testOk(okDesc),
      testFailure(failDesc),
      testSummary(1, 1),
    ].join('\n'));
  });

  test('20 tests', () => {
    let output: string[] = [];
    for (let i = 0; i < 10; i++) {
      runtime.test(i.toString(), () => { runtime.assert(true); });
      output.push(testOk(i.toString()));
    }
    for (let i = 10; i < 20; i++) {
      runtime.test(i.toString(), () => { runtime.assert(false); });
      output.push(testFailure(i.toString()));
    }
    output.push(testSummary(10, 10));
    expect(runtime.summary(false).output).toBe(output.join('\n'));
  });

  test('Test not enabled', () => {
    runtime.enableTests(false, undefined);
    runtime.test('Test', () => { runtime.assert(false)});
    expect(runtime.summary(false).output).toMatch(/not enabled/);
  });

  test('Summary twice not allowed', () => {
    runtime.summary(false);
    expect(runtime.summary(false).output).toMatch(/not enabled/);
  });

  test('Timing out', () => {
    runtime.test('infinite loop', () => {
      while (true) {
        1;
      }
    });
    expect(runtime.summary(false).output).toBe([
      testFailure('infinite loop', 'Timed out'),
      testSummary(1,0),
    ].join('\n'));
  })
});