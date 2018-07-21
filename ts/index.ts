// This module is the entrypoint of the ElementaryJS package. It is written
// for both Node and web browsers. i.e., it does not provide functions to
// read code from files.
import * as babel from 'babel-core';
import { Node } from 'babel-types';
import * as visitor from './visitor';
import { CompileOK, CompileError } from './types';

function compileAst(node: Node) {
  return  babel.transformFromAst(node, undefined, {
    plugins: [visitor.plugin],
    ast: true,
    code: false
  }).ast!;
}

function compileCode(code:string) {
  return  babel.transform(code, {
    plugins: [visitor.plugin],
    ast: true,
    code: false
  }).ast!;
}

export function compile(program: string | Node): CompileOK | CompileError {
  try {
    return {
      kind: 'ok',
      node: typeof program === 'string' ?
        compileCode(program) : compileAst(program)
    };
  }
  catch (exn) {
    if (exn instanceof visitor.State) {
      return exn;
    }
    throw exn;
  }
}