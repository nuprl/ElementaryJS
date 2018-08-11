// This module is the entrypoint of the ElementaryJS package. It is written
// for both Node and web browsers. i.e., it does not provide functions to
// read code from files.
import * as babel from 'babel-core';
import { Node } from 'babel-types';
import * as babylon from 'babylon';
import * as visitor from './visitor';
import { CompileOK, CompileError } from './types';

export { CompileOK, CompileError } from './types';

/**
 * 
 * @param code the program to compile
 * @param isOnline running online or offline?
 */
export function compile(
  code: string | Node, 
  isOnline: boolean): CompileOK | CompileError {
  try {
    // Babylon is the parser that Babel uses internally.
    const ast = typeof code === 'string' ? 
      babylon.parse(code).program : code;
    const babelResult = babel.transformFromAst(ast, undefined, {
      plugins: [[visitor.plugin, { isOnline }]],
      ast: true,
      code: false
    });
    return {
      kind: 'ok',
      // NOTE(arjun): There is some imprecision in the type produced by Babel.
      // I have verified that this cast is safe.
      node: (babelResult.ast! as babel.types.File).program
    };
  }
  catch (exn) {
    if (exn instanceof visitor.State) {
      return exn;
    }

    if (exn instanceof SyntaxError) {
      const groups = /^(.*) \((\d+):(\d+)\)$/.exec(exn.message);
      if (groups === null) {
        // NOTE(arjun): I don't think this can happen, but you never know with
        // JavaScript.
        return {
          kind: 'error',
          errors: [ { line: 0, message: exn.message } ]
        };
      }
      return {
        kind: 'error',
        errors: [ { line: Number(groups[2]), message: groups[1] } ]
      };
    }
    // NOTE(arjun): What else could it be?
    return {
      kind: 'error',
      errors: [ { line: 0, message: exn.message } ]
    };
  }
}