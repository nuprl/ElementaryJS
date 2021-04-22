import { Result } from '../src/index';
import { compileOpts, compileOK, staticError, dynamicError, run } from './test-utils';

describe('ElementaryJS', () => {

  test('Must declare variables', () => {
    expect(staticError(`x = 10`)).toEqual(
      expect.arrayContaining([
        `You must declare variable 'x' before assigning a value to it.`
      ]));
  });

  test('Duplicate let binding', () => {
    expect(staticError(`let x = 0; let x = 1`)).toEqual(
      expect.arrayContaining([
        `unknown: Duplicate declaration "x"`
      ]));
  });

  test('Cannot use var', () => {
    expect(staticError(`var x = 10`)).toEqual(
      expect.arrayContaining([
        `Use 'let' or 'const' to declare a variable.`
      ]));
  });

  test('Can dynamically change types', async () => {
    expect.assertions(2);
    await expect(run(`let x = "foo"; x = 42`)).resolves.toBe(42);
    await expect(run(`let x = 42; x = "foo"`)).resolves.toBe('foo');
  });

  test('Invalid array creation', async () => {
    expect.assertions(4);
    await expect(dynamicError(`let a = new Array();`)).resolves.toMatch(
      `Class constructor ArrayStub cannot be invoked without 'new'`
    );
    await expect(dynamicError(`let a = new Array(1, 2, 3);`)).resolves.toMatch(
      `Class constructor ArrayStub cannot be invoked without 'new'`
    );
    await expect(dynamicError(`let a = Array.create(3.5, 0); a`)).resolves.toMatch(
      'positive integer');
    await expect(dynamicError(`let a = Array.create(0, 0); a`)).resolves.toMatch(
      'positive integer');
  });

  test('Valid array creation', async () => {
    await expect(run(`let a = Array.create(2, 42); a`)).resolves.toEqual([42, 42]);
    await expect(run(`let a = Array.create(3, 0); a`)).resolves.toEqual([0, 0, 0]);
  });

  test('Can lookup members', async() => {
    expect.assertions(6);
    await expect(run(`let obj = { x: 100 }; obj.x = 42`))
      .resolves.toBe(42);
    await expect(run(`let obj = { x: 500 }; obj.x`))
      .resolves.toBe(500);
    await expect(run(`let obj = { x: 16 }; Math.sqrt(obj.x)`))
      .resolves.toBe(4);
    await expect(run(`
      function incr(x) {
        ++x.y;
      }
      let obj = { x: { y: 10 } };
      incr(obj.x);
      obj.x.y
    `)).resolves.toBe(11);
    await expect(run(`function foo() { return { x: 1 }; } ++foo().x`))
      .resolves.toBe(2);
    await expect(run(`function foo() { return { x: 1 }; } foo().x += 1`))
      .resolves.toBe(2);
  });

  test('Can access array members', async () => {
    expect.assertions(2);
    await expect(run(`[0, undefined][1]`))
      .resolves.toBeUndefined();
    await expect(run(`let obj = [10]; obj[0] = 42`))
      .resolves.toBe(42);
  });

  test('Can assign array members', async () => {
    expect.assertions(1);
    await expect(run(`let obj = [10]; obj[0] += 42`))
      .resolves.toBe(52);
  });

  test('Basic successful require', async () => {
    expect.assertions(1);
    await expect(run(`require('myModule');`)).resolves.toEqual({
      method1: expect.any(Function),
      property1: 3
    });
  });

  test('Basic faulty require', async () => {
    expect.assertions(1);
    await expect(dynamicError(`require('myModule1');`))
      .resolves.toMatch(`'myModule1' not found.`);
  });

  test('Require same module over', done => {
    expect.assertions(3);
    const runner = compileOK(`let o = require('myModule'), p = require('myModule');
      o = require('myModule');`);
    runner.run((result: Result) => {
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

  test('Access contents of require', async () => {
    expect.assertions(2);
    await expect(run(`const o = require('myModule'); o.property1;`))
      .resolves.toBe(3);
    await expect(run(`const o = require('myModule'); o.method1();`))
      .resolves.toBe('hi');
  });

  test('Error for undefined accessor of require', async () => {
    expect.assertions(1);
    await expect(dynamicError(`const o = require('myModule'); o.p;`))
      .resolves.toMatch(`Object does not have member 'p'.`);
  });

  test('Change require', async () => {
    expect.assertions(1);
    await expect(run(`let o = require('myModule'); o = require('mySecondModule');`))
      .resolves.toEqual({
        method2: expect.any(Function),
        property2: ['1', '2', '3']
      });
  });

  test('Require after code', async () => {
    expect.assertions(1);
    await expect(run(`let o = 0; o = require('mySecondModule');`)).resolves.toEqual({
      method2: expect.any(Function),
      property2: ['1', '2', '3']
    });
  });

  test('Can update array members', async () => {
    await expect(run(`let obj = [10]; ++obj[0]`))
      .resolves.toBe(11);
  });

  test('Function can return undefined if not required', async () => {
    expect.assertions(1);
    await expect(run(`
      function foo() {};
      foo();
    `)).resolves.toBeUndefined();
  });

  test('Update expression must not duplicate computation', async () => {
    expect.assertions(3);
    await expect(run(`
      let x = [ { y: 2 }, { y: 3 }];
      let i = 0;
      x[++i].y += 3;
      x[1].y
    `)).resolves.toBe(6);
    await expect(run(`
      let x = [ { y: 2 }, { y: 3 }];
      let i = 0;
      ++x[i += 1].y;
      x[1].y
    `)).resolves.toBe(4);
    await expect(run(`
      let x = 3;
      let i = 7;
      x+= ++i;
      x
    `)).resolves.toBe(11);
  });

  test('Accessing member of string', async () => {
    await expect(run(`
      let str = 'test';
      str.length;
    `)).resolves.toBe(4);
  });

  test('Accessing members of anonymous objects', async () => {
    expect.assertions(4);
    await expect(dynamicError(`[].x`))
      .resolves.toMatch(`Object does not have member 'x'.`);
    await expect(dynamicError(`[0, 1][10]`))
        .resolves.toMatch(`Index '10' is out of array bounds.`);
    await expect(run(`[3, 4][1]`)).resolves.toBe(4);
    await expect(run(`[].indexOf`)).resolves.toBeInstanceOf(Function);
  });

  test('Cannot access array non-members', async () => {
    expect.assertions(2);
    await expect(dynamicError(`let a = []; let b = a[0];`))
      .resolves.toMatch(`Index '0' is out of array bounds.`);
    await expect(dynamicError(`let a = []; a[0] = 0;`))
      .resolves.toMatch(`Index '0' is out of array bounds.`);
  });

  test('Array index must be a positive integer', async () => {
    expect.assertions(2);
    await expect(dynamicError(`let a = []; let b = a[3.1415]`))
      .resolves.toMatch(`Array index '3.1415' is not valid.`);
    await expect(dynamicError(`let a = []; let b = a[-1]`))
        .resolves.toMatch(`Array index '-1' is not valid`);
  });

  test('Cannot pass array non-members as arguments to function', async () => {
    expect.assertions(1);
    await expect(dynamicError(`let a = []; Math.abs(a[0]);`))
      .resolves.toMatch(`Index '0' is out of array bounds.`);
  });

  test('Cannot assign array non-members', async () => {
    expect.assertions(1);
    await expect(dynamicError(`let obj = []; obj[10] += 5`))
      .resolves.toMatch(`Index '10' is out of array bounds.`);
  });

  test('Cannot update array non-members', async () => {
    expect.assertions(1);
    await expect(dynamicError(`let obj = []; ++obj[0]`))
      .resolves.toMatch(`Index '0' is out of array bounds.`);
  });

  test('Dynamic error when looking up non-member', async () => {
    expect.assertions(2);
    await expect(dynamicError(`let obj = { x: 500 }; obj.y`))
      .resolves.toMatch(`Object does not have member 'y'.`);
    await expect(dynamicError(`let obj = { x: 500 }; ++obj.y`))
      .resolves.toMatch(`Object does not have member 'y'.`);
  });

  test('Dynamic error when calling non-member function', async () => {
    expect.assertions(1);
    await expect(dynamicError(`let obj = { }; obj.foo(42)`))
      .resolves.toMatch('obj.foo is not a function');
  });

  test('Dynamic error when looking up non-member 2', async () => {
    expect.assertions(1);
    await expect(dynamicError(`let obj = { x: 500 }; obj.y += 1`))
      .resolves.toMatch(`Object does not have member 'y'.`);
  });

  test('Dynamic error when incrementing or decrementing non-number', async () => {
    expect.assertions(2);
    await expect(dynamicError(`let a = {}; --a`))
      .resolves.toMatch("Argument of operator '--' must be a number.");
    await expect(dynamicError(`let a = "foo"; ++a`))
      .resolves.toMatch("Argument of operator '++' must be a number.");
  });

  test('Dynamic error when assigning a value to a non-member', async () => {
    expect.assertions(1);
    await expect(dynamicError(`let obj = {}; obj.y = 0;`))
      .resolves.toMatch(`Object does not have member 'y'.`);
  });

  test('Dynamic error when using non-boolean in if statement', async () => {
    expect.assertions(1);
    await expect(dynamicError('if (42) {}'))
      .resolves.toMatch(`Expected a boolean expression, instead received '42'.`);
  });

  test('Dynamic error when using non-boolean in loop', async () => {
    expect.assertions(3);
    await expect(dynamicError('while (0) {}'))
      .resolves.toMatch(`Expected a boolean expression, instead received '0'.`);
    await expect(dynamicError('do {} while (0);'))
      .resolves.toMatch(`Expected a boolean expression, instead received '0'.`);
    await expect(dynamicError('for (let x = 0; x; ++x) {}'))
      .resolves.toMatch(`Expected a boolean expression, instead received '0'.`);
  });

  test('Can access property when value is undefined', async () => {
    expect.assertions(2);
    await expect(run('let x = {y: undefined}; x.y;')).resolves.toBeUndefined();
    await expect(run('let x = {y: 0}; x.y = undefined; x.y;')).resolves.toBeUndefined();
  });

  test('Cannot use for-of', () => {
    expect(staticError(`let a = [1, 2]; for (x of a) {}`)).toEqual(
      expect.arrayContaining([
        `Do not use for-of loops.`
      ]));
  });

  test('Cannot use for-in', () => {
    expect(staticError(`let a = [1, 2]; for (x in a) {}`)).toEqual(
      expect.arrayContaining([
        `Do not use for-in loops.`
      ]));
  });

  test('Cannot use in', () => {
    expect(staticError(`let a = [1, 2]; if (2 in a) {}`)).toEqual(
      expect.arrayContaining([
        `Do not use the 'in' operator.`
      ]));
  });

  test('Can use iterator for loops', async () => {
    expect.assertions(1);
    await expect(run(`let i = 0; for(i = 0; i < 10; ++i) {} i`))
      .resolves.toBe(10);
  });

  test('Cannot use instanceof', () => {
    expect(staticError(`"foo" instanceof String`)).toEqual(
      expect.arrayContaining([
        `Do not use the 'instanceof' operator.`
      ]));
  });

  test('Preserve operator precedence', async () => {
    expect.assertions(4);
    await expect(run(`3 + 2 * 3`)).resolves.toBe(9);
    await expect(run(`4 * 3 + 2 * 3`)).resolves.toBe(18);
    await expect(run(`4 + 3 * 2 + 3`)).resolves.toBe(13);
    await expect(run(`12 / 3 * 2 + 3`)).resolves.toBe(11);
  });

  test('Dynamic error when mixing types', async () => {
    expect.assertions(2);
    await expect(dynamicError(`let a = {}, b = 1; a + b`))
      .resolves.toMatch("Arguments of operator '+' must both be numbers or strings.");
    await expect(dynamicError(`let a = "foo", b = 1; a - b`))
      .resolves.toMatch("Arguments of operator '-' must both be numbers.");
  });

  test('Dynamic numeric operator check order', async () => {
    expect.assertions(2);
    // The * operator has precedence over -, hence should be dynamic checked first.
    await expect(dynamicError(`let a = "", b = 1, c = {}; a * b - c`))
      .resolves.toMatch("Arguments of operator '*' must both be numbers.");
    await expect(dynamicError(`let a = "", b = 1, c = {}; a / b * c`))
      .resolves.toMatch("Arguments of operator '/' must both be numbers.");
  });

  test('Can use pre-update operator with numbers', async () => {
    expect.assertions(4);
    await expect(run(`let a = { b : 3 }; ++a.b`))
      .resolves.toBe(4);
    await expect(run(`let a = 2; ++a`))
      .resolves.toBe(3);
    await expect(run(`let a = 2; --a`))
      .resolves.toBe(1);
    await expect(run(`
      function foo() {
        return { x: 10 };
      }
      let a = ++foo().x;
      a`)).resolves.toBe(11);
  });

  test('Cannot have literal object member names', () => {
    expect(staticError(`let myObj = { 0: 0 };`)).toEqual(
      expect.arrayContaining([
        `Object member name must be an identifier.`
      ]));
    expect(staticError(`let myObj = { 'Foo': 0 };`)).toEqual(
      expect.arrayContaining([
        `Object member name must be an identifier.`
      ]));
  });

  test('Cannot have duplicate names in object literals', () => {
    expect(staticError(`let myObj = { a: true, a: false };`)).toEqual(
      expect.arrayContaining([
        `Object member name may only be used once; 'a'.`
      ]));
  });

  test('Cannot use post-update operator', () => {
    expect(staticError(`let a = 2; let b = a++;`)).toEqual(
      expect.arrayContaining([
        `Do not use post-increment or post-decrement operators.`
      ]));
    expect(staticError(`let a = 2; let b = a--;`)).toEqual(
      expect.arrayContaining([
        `Do not use post-increment or post-decrement operators.`
      ]));
  });

  test('Cannot use delete', () => {
    expect(staticError(`let a = { b: 1 }; delete a.b;`)).toEqual(
      expect.arrayContaining([
        `Do not use the 'delete' operator.`
      ]));
  });

  test('Cannot use throw', () => {
    expect(staticError(`throw "A user-defined exception.";`)).toEqual(
      expect.arrayContaining([
        `Do not use the 'throw' operator.`
      ]));
  });

  test('No try-catch', () => {
    expect(staticError(`try { let x = 1; } catch (e) {}`)).toEqual(
      expect.arrayContaining([
        `The try-catch statement is not supported.`
      ]));
  });

  test('Can use string concatenation and assignment operator', async () => {
    expect.assertions(1);
    await expect(run(`let a = "hello "; a += "world"`))
      .resolves.toBe('hello world');
  });

  test('Can use arithmetic assignment operators', async () => {
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

  test('Cannot use bitmask assignment operators', () => {
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

  test('Loop body must be a block', () => {
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

  test('Cannot use shift assignment operators', () => {
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

  test('Disallowed comparison operators', () => {
    expect(staticError(`let x = "1", y = 1; x == y`)).toEqual(
      expect.arrayContaining([
        `Do not use the '==' operator; use '===' instead.`
      ]));
    expect(staticError(`let x = "1", y = 1; x != y`)).toEqual(
      expect.arrayContaining([
        `Do not use the '!=' operator; use '!==' instead.`
      ]));
  });

  test('Allowed comparison operators', async () => {
    expect.assertions(4);
    await expect(run(`let x = 1, y = 1; x === y`)).resolves.toBe(true);
    await expect(run(`let x = 2, y = 1; x === y`)).resolves.toBe(false);
    await expect(run(`let x = 1, y = 1; x !== y`)).resolves.toBe(false);
    await expect(run(`let x = 2, y = 1; x !== y`)).resolves.toBe(true);
  });

  test('Call a built-in method', async () => {
    expect.assertions(1);
    await expect(run(`
      let x = [];
      x.push(100);
      x[0]`)).resolves.toBe(100);
  });

  test('Fibonacci of 10', async () => {
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

  test('Can set fields of this in a constructor', done => {
    expect.assertions(2);
    const runner = compileOK(`
      class C { constructor() { this.x = 5; } }
      let r = (new C()).x`);
    runner.run((result: Result) => {
      expect(result.type).toBe('normal');
      expect(runner.g.r).toBe(5);
      done();
    });
  });

  test('Dynamic checks when setting fields of other objects in constructor', async () => {
    expect.assertions(1);
    await expect(dynamicError(`
      class C {
        constructor(o) {
          o.x = 5;
        }
      }
      new C({ })`)).resolves.toMatch(`Object does not have member 'x'.`);
  });

  test('Dynamic check for this.x = y in function nested in constructor', async () => {
    expect.assertions(1);
    await expect(dynamicError(`
      class C {
        constructor() {
          (function() { this.x = 5; })();
        }
      }
      new C()`)).resolves.toMatch(`Cannot access member of non-object value types.`);
  });

  test('Arity-mismatch: too few arguments', async () => {
    expect.assertions(1);
    await expect(dynamicError(`
      function F(x) {}
      F();
    `)).resolves.toMatch(`Function F expected 1 argument but received 0 arguments.`);
  });

  test('Arity-mismatch: too many arguments', async () => {
    expect.assertions(1);
    await expect(dynamicError(`
      function F(x) {}
      F(1,2,3);
    `)).resolves.toMatch(`Function F expected 1 argument but received 3 arguments.`);
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

  test('All conditional branches must be a block', () => {
    expect.assertions(4);
    expect(staticError(`let s = 1; if (true) ++s;`)).toEqual(
      expect.arrayContaining([
        `All branches of an if-statement must be enclosed in braces.`
      ]));
    expect(staticError(`let i = 0; if (true) { ++i; } else ++i;`)).toEqual(
      expect.arrayContaining([
        `All branches of an if-statement must be enclosed in braces.`
    ]));
    compileOK(`let i = 0; if (true) { ++i; } else { ++i; }`);
    expect(staticError(`let i = 0; if (true) { ++i; }
      else if (false) { ++i; } else ++i;`)).toEqual(
      expect.arrayContaining([
        `All branches of an if-statement must be enclosed in braces.`
    ]));
    expect(staticError(`let i = 0; if (true) { ++i; }
      else if (false) ++i; else { ++i; }`)).toEqual(
      expect.arrayContaining([
        `All branches of an if-statement must be enclosed in braces.`
    ]));
    compileOK(`let i = 0; if (true) { ++i; } else if (false) { ++i; } else { ++i; }`);
  });

  test('For statement must have three parts present', async () => {
    expect(staticError(`
      for (;;) {
        break;
      }
    `)).toEqual(expect.arrayContaining([
      `For statement variable initialization must be present.`,
      `For statement termination test must be present and cannot be an assignment expression.`,
      `For statement update expression must be present.`
    ]));
    expect(staticError(`
      for (let i = 0;;) {
        break;
      }
    `)).toEqual(expect.arrayContaining([
      `For statement termination test must be present and cannot be an assignment expression.`,
      `For statement update expression must be present.`
    ]));
    expect(staticError(`
      for (let i = 0; i < 10;) {
        break;
      }
    `)).toEqual(expect.arrayContaining([
      `For statement update expression must be present.`
    ]));
    expect(staticError(`
      for (let i = 0; i = false; ++i) {
        break;
      }
    `)).toEqual(expect.arrayContaining([
      `For statement termination test must be present and cannot be an assignment expression.`,
    ]));
    expect(staticError(`
      for (something(); i < 10; ++i) {
        break;
      }
    `)).toEqual(expect.arrayContaining([
      `For statement variable initialization must be an assignment or a variable declaration.`
    ]));
    await expect(run(`
      let i = 0;
      for (i = 0; i < 3; ++i) {}
      i;
    `)).resolves.toBe(3);
  });

  test('Logical operators short-circuit', async () => {
    // or:
    await expect(run(`true || doesNotExists()`)).resolves.toBe(true);
    await expect(run(`true || 123`)).resolves.toBe(true);
    await expect(run(`false || true`)).resolves.toBe(true);
    await expect(dynamicError(`false || doesNotExists()`)).resolves.toMatch(`doesNotExists is not defined`);
    await expect(dynamicError(`false || 123`)).resolves.toMatch(`Arguments of operator '||' must both be booleans.`);
    await expect(dynamicError(`false || 'as'`)).resolves.toMatch(`Arguments of operator '||' must both be booleans.`);
    await expect(dynamicError(`0 || false`)).resolves.toMatch(`Arguments of operator '||' must both be booleans.`);
    // and:
    await expect(run(`false && doesNotExists()`)).resolves.toBe(false);
    await expect(run(`false && 123`)).resolves.toBe(false);
    await expect(run(`false && true`)).resolves.toBe(false);
    await expect(dynamicError(`true && doesNotExists()`)).resolves.toMatch(`doesNotExists is not defined`);
    await expect(dynamicError(`true && 123`)).resolves.toMatch(`Arguments of operator '&&' must both be booleans.`);
    await expect(dynamicError(`true && 'as'`)).resolves.toMatch(`Arguments of operator '&&' must both be booleans.`);
    await expect(dynamicError(`1 && false`)).resolves.toMatch(`Arguments of operator '&&' must both be booleans.`);
    // function invocation:
    await expect(run(`
      function returnTrue() {
        return true;
      }
      !(returnTrue() || doesNotExists()) && doesNotExists();
    `)).resolves.toBe(false);
  });

  test('Statically reports const violations', () => {
    expect(staticError(`
      const x = 1;
      x = 2;
    `)).toEqual(expect.arrayContaining([
      `Variable is 'const'.`
    ]));
  });

  test('Calls to .split produce a stopified array when needed', async () => {
    expect.assertions(3);
    // Case 1: built-in string method (motivating example for such check).
    await expect(run(`
      'a,b,c'.split(',').filter(x => x === 'b');
    `)).resolves.toEqual(['b']);
    // Case 2: custom object method that doesn't return an [].
    await expect(run(`
      const a = { split: b => b };
      a.split(true);
    `)).resolves.toBe(true);
    // Case 3: custom object method that does return an [].
    await expect(run(`
      const a = { split: b => [b] };
      a.split(true).filter(x => x);
    `)).resolves.toEqual([true]);
  });

  test('Calls to Object.<x> produce a stopified array', async () => {
    expect.assertions(1);
    await expect(run(`
      const o = { a: 0, b: 1, c: 2 },
            keys = Object.keys(o),
            values = Object.values(o),
            entries = Object.entries(o),
            properties = Object.getOwnPropertyNames(o);

      keys.filter(x => true);
      values.filter(x => true);
      entries.filter(x => true);
      properties.filter(x => true);
    `)).resolves.toEqual(['a', 'b', 'c']);
  });

  test('Cannot set .length of arrays', async () => {
    await expect(dynamicError(`[1,2,3].length = 5`,))
    .resolves.toMatch(`Cannot set '.length' of an array.`);
  });

  test('Cannot use computed member expressions on objects', async () => {
    await expect(dynamicError(`let r = {a: 5}[10]`,))
    .resolves.toMatch(`Array indexing called on a non-array value type.`);
  });

  test('Overwriting globals causes runtime error', async () => {
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

  test('Number.parseInt is available', async () => {
    await expect(run(`parseInt("100")`)).resolves.toBe(100);
  });

  test('Number.parseFloat is available', async () => {
    await expect(run(`parseFloat("3.14159")`)).resolves.toBe(3.14159);
  });

  test('Allow arrow functions with expression bodies', async () => {
    await expect(run(`((x) => x + 1)(10)`)).resolves.toBe(11);
  });

  test('Allow arrow functions with block bodies', async () => {
    await expect(run(`(x => { return x + 1; })(10)`)).resolves.toBe(11);
  });

  test('Disallow rest parameters', async () => {
    expect(staticError(`function rest(...args) {}`)).toEqual(
      expect.arrayContaining([
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

      new TestClass().arrowFuncTest();
    `)).resolves.toBe('abcdef');

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

  test('Arrow functions have arity checking', async () => {
    await expect(dynamicError(`
      let a = (a) => 1;
      a();
    `)).resolves.toMatch('Function (anonymous) expected 1 argument but received 0 arguments.');
  })

  test('Arrow functions have no implicit parameters (1)', async () => {
    await expect(dynamicError(`
      let a = {
        b: 0,
        c: () => this.b
       };

       a.c();
    `)).resolves.toMatch(`Cannot access member of non-object value types.`);
  });

  test('Arrow functions have no implicit parameters (2)', async () => {
    await expect(run(`
      let a = {
        b: 0,
        c: (d, e, f) => arguments.length
       };

       a.c(1, 2, 3);
    `)).resolves.toBe(0);
  });

  test('Non-empty switch cases must have braces', () => {
    expect(staticError(`
      let x = 1;
      switch (x) {
        case 1:
          console.log(x);
      }
    `)).toEqual(
      expect.arrayContaining([
        `If a switch case is not empty then it must be in braces.`
      ]));
    compileOK(`
      let x = 1;
      switch (x) {
        case 0:
        case 1: {
          console.log(x);
        }
      }
    `);
  });

  test('Parser should work', async () => {
    await expect(run(`
      parser.parseProgram('let x = 1; let y = x * 2;').kind;
    `)).resolves.toBe('ok');
  });

  test('Infinity is present', async () => {
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

  test('LHS with another assign op', async () => {
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

  test('Dynamic error on calling functions access with brackets', async () => {
    await expect(dynamicError(`
      let obj = {x: (y) => y + 1};
      obj['x'](1);
    `)).resolves.toMatch(`Array indexing called on a non-array value type.`);
    await expect(dynamicError(`
      class A {
        static funcA() {
          return 1;
        }
      }
      A['funcA']();
    `)).resolves.toMatch(`Array indexing called on a non-array value type.`);
  });

  test('Function calls work', async () => {
    await expect(run(`
      class TestClass {
        static testFunc() {
          return 1;
        }
      }
      TestClass.testFunc;
    `)).resolves.toEqual(expect.any(Function));
    await expect(run(`
      class TestClass {
        static testFunc() {
          return 1;
        }
      }
      TestClass.testFunc();
    `)).resolves.toBe(1);
    await expect(run(`
      function makeObj(a) {
        return {
          a: a,
          getA: function() {
            return this.a
          }
        }
      }
      let randomObj = makeObj(220);
      [randomObj.getA(), randomObj.getA];
    `)).resolves.toEqual([220, expect.any(Function)]);
  });

  test('Assignment expression forbidden in certain statements', () => {
    const errStr: string = `Forbidden assignment expression.`;
    expect.assertions(5);
    expect(staticError(`
      let a = 'nonsense', b = false;
      while (a = b) {}
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      do {} while (a = b);
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      if (a = b) {}
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      switch (a = b) {
        case 0: {
          console.log(x);
        }
      }
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      switch (1) {
        case (a = b): {
          console.log(x);
        }
      }
    `)).toEqual(expect.arrayContaining([errStr]));
  });

  test('Assignment expression forbidden in certain expressions', () => {
    const errStr: string = `Forbidden assignment expression.`;
    expect.assertions(5);
    expect(staticError(`
      let a = 'nonsense', b = false;
      const c = true && (a = b);
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      const c = (a = b) || false;
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      const c = (a = b) ? true : false
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      const c = true ? (a = b) : false
    `)).toEqual(expect.arrayContaining([errStr]));
    expect(staticError(`
      let a = 'nonsense', b = false;
      const c = false ? true : (a = b);
    `)).toEqual(expect.arrayContaining([errStr]));
  });

  test('JSON round-trip works', async () => {
    expect.assertions(1);
    await expect(run(`JSON.parse(JSON.stringify({ x: 42 })).x`)).resolves.toBe(42);
  });
});
