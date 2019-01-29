import * as ejs from './index'
import * as fs from 'fs'
import * as version from './version'

if (process.argv.length < 1) {
  console.error('Usage: ejs input.js [output.js]');
  process.exit(1);
}
const input = process.argv[0],
      output = process.argv[1];

try {
  const code = fs.readFileSync(input);
  const opts = {
    consoleLog: (str: string) => { console.log(str); },
    version: () => { console.log(version.EJSVERSION); }
  };
  const result = ejs.compile(code.toString(), opts);
} catch(e) {
  console.error(`Error compiling ${input} :` + e.toString);
}
