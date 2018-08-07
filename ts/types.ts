// This module defines all the public types that the ElementaryJS package
// exports.

import * as t from 'babel-types';

export type ElementarySyntaxError = {
  line: number,
  message: string
}

export type CompileError = {
  kind: 'error',
  errors: ElementarySyntaxError[]
}

export type CompileOK = {
  kind: 'ok';
  node: t.Program
};

export type CompilerResult = CompileOK | CompileError;

export type TestResult = {
  failed: boolean,
  description: string,
  error?: string
};