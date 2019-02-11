// This module defines all the public types that the ElementaryJS package
// exports.
export type ElementarySyntaxError = {
  line: number,
  message: string
}

export type CompileError = {
  kind: 'error',
  errors: ElementarySyntaxError[]
}

export type Result =
   {type: 'normal', value: any }
 | { type: 'exception', value: any, stack: string[] }

export type CompileOK = {
  kind: 'ok';
  g: { [key: string]: any},
  run(onDone: (result: Result) => void): void;
  eval(code: string, onDone: (result: Result) => void): void;
  stop(onStopped: () => void): void;
};

export type CompilerResult = CompileOK | CompileError;

export type TestResult = {
  failed: boolean,
  description: string,
  error?: string
};

export type CompilerOpts = {
  consoleLog: (message: string) => void,
  version: () => void,
  whitelistCode: { [key: string]: string }
}
