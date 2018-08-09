
export default function timeoutTest(testFunction: () => void, timeout: number) {
  let isNode = false;
  try { 
    isNode = Object.prototype.toString.call(global.process) === '[object process]';
  } catch (error) {}
  // taken from https://www.npmjs.com/package/detect-node

  if (isNode) {
    let vm = require('vm');
    vm.runInNewContext('testFunction();', { testFunction: testFunction }, { timeout: timeout });
    return;
  }
  testFunction();
}