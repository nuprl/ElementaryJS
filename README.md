# ElementaryJS

** WARNING: ElementaryJS is not ready for general use.**

JavaScript without sharp edges.

# Usage

[FILL] Describe how to embed in a web page

# Building

On initialization or when you update `package.json`:

    yarn install

To build:

    yarn run build

To run tests:

    yarn run test

# Development

These are the primary files of ElementaryJS:

- `ts/types.ts`: Some types we use throughout the codebase.

- `ts/visitor.ts`: The heart of the ElementaryJS compiler. This code inserts
  all the static and dynamic checks that ElementaryJS enforces.

- `ts/runtime.ts`: The ElementaryJS runtime system. This module has the
  implementations of the dynamic checks that the compiler inserts.

- `ts/unit-tests.test.ts`: Unit tests.

- `ts/sandbox.ts`: A convenient sandbox for testing.

- `ts/index.ts`: Entrypoint of the ElementaryJS package. This is the interface to
  ElementaryJS.

- `ts/bin.ts`: Runs ElementaryJS from the command-line (`yarn run run file-to-run.js`). This
  may help you debug the compiler, but it is not how ElementaryJS will typically
  be used.
