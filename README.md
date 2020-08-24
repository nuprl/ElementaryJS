# ElementaryJS

[![Build Status](https://api.travis-ci.org/umass-compsci220/ElementaryJS.svg?branch=master)](https://travis-ci.org/umass-compsci220/ElementaryJS)

JavaScript without sharp edges. **WARNING: ElementaryJS is not ready for general use.**

## Usage

[FILL] *Describe how to embed in a web page.*

## Building

On initialization (or when you update `package.json`):

    yarn install

To build:

    yarn build

To lint:

    yarn lint

To test:

    yarn test

## Development

- `src/types.ts`: Types used throughout the codebase.

- `src/visitor.ts`: The heart of the ElementaryJS compiler. This code performs static checks and inserts dynamic checks that ElementaryJS enforces.

- `src/runtime.ts`: The ElementaryJS runtime system. This module has the implementations of the dynamic checks that the compiler inserts.

- `src/index.ts`: Entrypoint of the ElementaryJS package. This is the interface to ElementaryJS.

- `tests/`: Unit tests.

- `eval/`: Scripts and files used for evaluating ElementaryJS effectiveness.
