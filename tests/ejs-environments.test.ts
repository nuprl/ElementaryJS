import { compileOK, staticError } from './test-utils';

describe('ElementaryJS Environments', () => {
  test('Trivial uninitialized let (+)', () => {
    compileOK(`let x;`);
    compileOK(`let x; x = 1;`);
  });

  test('Trivial uninitialized let (-)', () => {
    expect(staticError(`let x; x;`)).toEqual(
      expect.arrayContaining([
        `You must initialize the variable 'x' before use.`
      ]));
    expect(staticError(`let x, y = x;`)).toEqual(
      expect.arrayContaining([
        `You must initialize the variable 'x' before use.`
      ]));
  });

  test('Basic shadowing (+)', () => {
    compileOK(`let x; {let x = 1; x;}`);
  });

  test('Basic shadowing (-)', () => {
    expect(staticError(`let x; {let x = 1; x;} x;`)).toEqual(
      expect.arrayContaining([
        `You must initialize the variable 'x' before use.`
      ]));
  });
});
