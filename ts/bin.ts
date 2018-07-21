import * as babel from 'babel-core';
import * as visitor from './visitor';
import * as fs from 'fs';

export function compile(code: string): string {
  const result = babel.transform(code, {
    plugins: [visitor.plugin],
    ast: false,
    code: true
  });
  return result.code!;
}

console.log(compile(fs.readFileSync(process.argv[2], { encoding: 'utf8' })));