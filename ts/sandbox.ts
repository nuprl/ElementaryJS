// A simple sandboxing module that is easier to use that Node's own VM sandbox.
import * as vm from 'vm';

export type OK = { kind: 'ok', value: any };
export type Exception = { kind: 'exception', value: any };

export function sandbox(code: string): OK | Exception {
  try {
    const sandbox = { require: require };
    return { kind: 'ok', value: vm.runInNewContext(code, sandbox, { timeout: 2000 }) };
  }
  catch (exn) {
    return { kind: 'exception', value: exn };
  }
}
