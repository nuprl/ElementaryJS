import * as ejs from './index';
import * as fs from 'fs';
import * as version from './version';

if (process.argv.length < 3) {
  console.error('Usage: node compiler.js input.js');
  process.exit(1);
}
const input = process.argv[2];

try {
  const code = fs.readFileSync(input),
        opts = {
          consoleLog: (str: string) => { console.log(str); },
          version: () => { console.log(version.EJSVERSION); },
          jsonPathOrWhiteList: {
            myModule: `{
              method1: function() {
                return 'hi';
              },
              property1: 3
            }`
          }
        },
        compilerResult = ejs.compile(code.toString(), opts);

  if (compilerResult.kind === 'error') {
    throw compilerResult.errors;
  }
  compilerResult.run((result) => {
    if (result.type === 'exception') {
      throw result.stack;
    }
    console.log(result.value);
  });
} catch(e) {
  console.error(`Error compiling ${input}`, e);
}
