/**
 * This file is the entrypoint for running ElementaryJS from the command-line.
 * This is not how anyone will usually run ElementaryJS, but it is helpful
 * for debugging.
 */
import * as generator from 'babel-generator';
import * as index from './index';
import * as fs from 'fs';

if (process.argv.length < 3) {
  console.error('ERROR: You must provide specify a file to run.');
  process.exit(1);
}

const code = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

const result = index.compile(code, false);
if (result.kind === 'error') {
  console.log(result);
}
else {
  console.log(generator.default(result.node).code);
}