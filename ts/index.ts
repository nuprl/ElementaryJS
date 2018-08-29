// This module is the entrypoint of the ElementaryJS package. It is written
// for both Node and web browsers. i.e., it does not provide functions to
// read code from files.
import * as babel from 'babel-core';
import { Node, Program } from 'babel-types';
import * as babylon from 'babylon';
import * as visitor from './visitor';
import { CompileOK, CompileError, CompilerOpts, Result } from './types';
import * as stopify from 'stopify';
export { CompileOK, CompileError, CompilerOpts, Result } from './types';
import * as runtime from './runtime';
import * as lib220 from './lib220';

// NOTE(arjun): This may not be needed, but I am using require instead of the
// name so that Webpack can statically link.
const transformClasses = require('babel-plugin-transform-es2015-classes');

class ElementaryRunner implements CompileOK {
  public g: { [key: string]: any };
  public kind: 'ok' = 'ok';

  constructor(
    private runner: stopify.AsyncRun & stopify.AsyncEval,
    opts: CompilerOpts) {
    const globals = {
      elementaryjs: runtime,
      console: Object.freeze({
          log: (message: string) => opts.consoleLog(message)
      }),
      test: runtime.test,
      assert: runtime.assert,
      lib220: Object.freeze(lib220),
      version: opts.version,
      Array: runtime.Array,
      Math: Math,
      undefined: undefined,
      Object: Object // Needed for classes
    };

    // We can use .get and .set traps to intercept reads and writes to
    // global variables. Any other trap is useless (I think), since Stopify
    // does not use the global object in any other way.
    const globalProxy = new Proxy(globals, {
        get: (o, k) => {
            if (!Object.hasOwnProperty.call(o, k)) {
                const msg = `${String(k)} is not defined`;
                throw new runtime.ElementaryRuntimeError(msg);
            }
            return (o as any)[k];
        }
    });

    runtime.setRunner(runner);
    runner.g = globalProxy;
    this.g = runner.g;
  }

  run(onDone: (result: Result) => void) {
    this.runner.run(onDone);
  }

  eval(code: string, onDone: (result: Result) => void) {
    const elementary = applyElementaryJS(code);
    if (elementary.kind === 'error') {
      onDone({
        type: 'exception',
        stack: [], // This is correct
        value: elementary.errors.toString()
      });
      return;
    }
    this.runner.evalAsyncFromAst(elementary.ast, onDone);
  }

  stop(onStopped: () => void) {
    this.runner.pause((line) => onStopped());
  }

}

function applyElementaryJS(
  code: string | Node): CompileError | { kind: 'ok', ast: Program }  {

  try {
    // Babylon is the parser that Babel uses internally.
    const ast = typeof code === 'string' ?
      babylon.parse(code).program : code;
    const result1 = babel.transformFromAst(ast,
      typeof code === 'string' && code || undefined, {
      plugins: [ [visitor.plugin] ],
      ast: true,
      code: true
    });
    const result2 = babel.transformFromAst(result1.ast!,
      result1.code!, {
        plugins: [transformClasses],
        ast: true,
        code: false
    });
    // NOTE(arjun): There is some imprecision in the type produced by Babel.
    // I have verified that this cast is safe.
    return {
      ast: (result2.ast! as babel.types.File).program,
      kind: 'ok'
    };
  }
  catch (exn) {
    if (exn instanceof visitor.State) {
      return exn;
    }

    let line: number = 0;
    let message: string = '';

    if (exn instanceof SyntaxError) {
      const groups = /^(.*) \((\d+):(\d+)\)$/.exec(exn.message);
      if (groups === null) {
        // NOTE(arjun): I don't think this can happen, but you never know with
        // JavaScript.
        message = exn.message;
      }
      else {
        line = Number(groups[2]);
        message = groups[1];
      }
    }
    // This can happen due to Babel.
    else if (exn.loc && exn.loc.line) {
      line = Number(exn.loc.line);
      message = exn.message;
    }
    else {
      message = exn.message;
    }

    return {
      kind: 'error',
      errors: [ { line, message } ]
    };
  }
}

export function compile(
  code: string | Node,
  opts: CompilerOpts): CompileOK | CompileError {

  const elementary = applyElementaryJS(code);
  if (elementary.kind === 'error') {
    return elementary;
  }

  const stopified = stopify.stopifyLocallyFromAst(
    elementary.ast,
    undefined, { hofs: 'fill' });
  if (stopified.kind === 'error') {
    return {
      kind: 'error',
      errors: [ { line: 0, message: String(stopified.exception) } ]
    };
  }

  return new ElementaryRunner(stopified, opts);
}