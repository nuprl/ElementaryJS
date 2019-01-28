import * as ejs from './index'
import * as fs from 'fs'
import * as version from './version'
import * as whiteList from './whitelist'//We won't import if it comes from the cli

if (process.argv.length < 1) {
  console.error('Usage: ejs input.js [output.js]');
  process.exit(1);
}
const input = process.argv[0],
      output = process.argv[1];//Not used.
//We'll need another cli arg if we want to pass a file, which is the plan


//Where is the appropriate place for this routine?
function whiteListToCode(): string {
  /*
    Iterate through the list of module names,
      for each associted URL,
      grab the code (from fs or from net).
    Write to a new file (or update) the list of modules,
      st they now map to code.

    This will rely heavily on async code, so assuming we'll leverage async/await.
  */
  return "TODO";
}

try {
  const code = fs.readFileSync(input);
  const opts = {
    consoleLog: (str: string) => { console.log(str); },
    version: () => { console.log(version.EJSVERSION); },
    requireWhiteList: whiteListToCode()
  };
  const result = ejs.compile(code.toString(), opts);
} catch(e) {
  console.error(`Error compiling ${input} :` + e.toString);
}
