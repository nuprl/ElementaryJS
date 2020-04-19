import { compile, CompileOK, Result } from '../src/index';

export const compileOpts = {
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

export function compileOK(code: string): CompileOK {
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
export function dynamicError(code: string) {
  return new Promise((resolve, reject) => {
    const result = compile(code, compileOpts);
    if (result.kind === 'error') {
      return reject(result);
    }
    return result.run((result: Result) => {
      return result.type === 'normal' ?
        reject(`Expected exception, got result ${result.value}`) :
        typeof result.value.message !== 'string' ?
          reject(`Expected exception, got result ${result.value}`) :
          resolve(result.value.message);
    });
  });
}

// Helps write test cases that check for static errors. The result
// is the array of error messages produced by ElementaryJS.
export function staticError(code: string): string[] {
  const result = compile(code, compileOpts);
  if (result.kind === 'ok') {
    throw new Error(`expected a static error, but none produced`);
  }
  return result.errors.map(x => x.message);
}

// Helps write test cases that expect the program to terminate normally.
// The result is the final value of the program.
export function run(code: string) {
  return new Promise((resolve, reject) => {
    const runner = compile('', compileOpts);
    if (runner.kind === 'error') {
      return reject(runner);
    }
    runner.run((result: Result) => {
      if (result.type === 'exception') {
        return reject(result.value);
      }
      runner.eval(code, (result: Result) => {
        return result.type === 'exception' ? reject(result.value) :
          resolve(result.value);
      });
    });
  });
}
