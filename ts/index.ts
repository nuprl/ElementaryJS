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
import * as useGlobalObject from 'stopify/dist/src/compiler/useGlobalObject';

function getGlobal(): any {
  if (typeof window !== 'undefined') {
    return window;
  }
  else {
    return global;
  }
}

// TODO(arjun): I think these hacks are necessary for eval to work. We either
// do them here or we do them within the implementation of Stopify. I want
// them here for now until I'm certain there isn't a cleaner way.
const theGlobal = getGlobal();
theGlobal.elementaryJS = runtime;
theGlobal.stopify = stopify;

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
    const elementary = applyElementaryJS(code, this.opts);
    if (elementary.kind === 'error') {
      onDone({
        type: 'exception',
        stack: [], // This is correct
        value: elementary.errors.map(x => {
          const l = x.line;
          return `Line ${l}: ${x.message}`
        }).join('\n')
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
  code: string | Node,
  opts: CompilerOpts): CompileError | { kind: 'ok', ast: Program }  {

  try {
    let result : babel.BabelFileResult = { 
      ast: typeof code === 'string' ? babylon.parse(code).program : code
    };
    if (typeof code === 'string') {
      result.code = code;
    }

    result = babel.transformFromAst(result.ast!, result.code!, {
      plugins: [ [visitor.plugin] ],
      ast: true,
      code: true
    });

    result = babel.transformFromAst(result.ast!, result.code!, {
        plugins: [transformClasses],
        ast: true,
        code: false
    });
    // NOTE(arjun): There is some imprecision in the type produced by Babel.
    // I have verified that this cast is safe.
    return {
      ast: (result.ast! as babel.types.File).program,
      kind: 'ok'
    };
  }
  catch (exn) {
    if (exn instanceof visitor.State) {
      return exn;
    }
    return wrapException(exn);
  }
}

function wrapException(exn: any): CompileError {
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

class SudoRunner implements CompileOK {
  public kind: 'ok' = 'ok';
  public g: { [key: string]: any} = { };
  constructor(private code: string) { }

  run(onDone: (result: Result) => void): void {
    try {
      theGlobal.$S = this;
      eval(this.code);
      onDone({ type: 'normal', value: undefined });
    }
    catch (exn) {
      onDone({ type: 'exception', value: exn, stack: [] });
    }
  }
  eval(code: string, onDone: (result: Result) => void): void {
    try {
      onDone({ type: 'normal', value: eval(code) });
    }
    catch (exn) {
      onDone({ type: 'exception', value: exn, stack: [] });
    }
  }

  stop(onStopped: () => void): void {
  }
}

export function compile(
  code: string | Node,
  opts: CompilerOpts): CompileOK | CompileError {

  if (opts.sudo) {
    // In sudo mode, we simply eval code instead of Stopifying it. However, we
    // are using eval in a mode where eval('var x = 1') does not create a global
    // variable x. Therefore, we use the useGlobalObjects transformation from
    // Stopify. This also helps with IDE stability.
    try {
      let result: babel.BabelFileResult =
        typeof code === 'string' ?
        { ast: babylon.parse(code).program } :
        { ast: code };
      result = babel.transformFromAst(result.ast!, result.code!, {
        plugins: [[useGlobalObject.plugin, {}]],
        babelrc: false,
        code: true
      });
      return new SudoRunner(result.code!);
    }
    catch (exn) {
      return wrapException(exn);
    }
  }

  const elementary = applyElementaryJS(code, opts);
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