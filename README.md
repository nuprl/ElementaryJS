# ElementaryJS

[![Build Status](https://travis-ci.org/plasma-umass/ElementaryJS.svg?branch=master)](https://travis-ci.org/plasma-umass/ElementaryJS)

JavaScript without sharp edges. **WARNING: ElementaryJS is not ready for general use.**

# Usage

[FILL] *Describe how to embed in a web page.*

# Building

On initialization or when you update `package.json`:

    yarn install

To build:

    yarn build

To run tests:

    yarn test

# Development

These are the primary files of ElementaryJS:

- `src/types.ts`: Some types we use throughout the codebase.

- `src/visitor.ts`: The heart of the ElementaryJS compiler. This code inserts
  all the static and dynamic checks that ElementaryJS enforces.

- `src/runtime.ts`: The ElementaryJS runtime system. This module has the
  implementations of the dynamic checks that the compiler inserts.

- `src/index.ts`: Entrypoint of the ElementaryJS package. This is the interface to
  ElementaryJS.

- `test/unit-tests.test.ts`: Unit tests.
