import { compileOK, staticError } from './test-utils';

describe('ElementaryJS Environments', () => {
  const x: string = `You must initialize the variable 'x' before use.`;

  test('Trivial uninitialized let (+)', () => {
    compileOK(`let x;`);
    compileOK(`let x; x = 1;`);
    compileOK(`let x; x = 1; x;`);
    compileOK(`let x, y; x = undefined; y = x;`);
  });

  test('Trivial uninitialized let (-)', () => {
    expect(staticError(`let x; x;`)).toEqual(expect.arrayContaining([x]));
    expect(staticError(`let x, y = x;`)).toEqual(expect.arrayContaining([x]));
  });

  test('Array Expression (+)', () => {
    compileOK(`let x; x = '1'; [x];`);
  });

  test('Array Expression (-)', () => {
    expect(staticError(`let x; [x];`)).toEqual(expect.arrayContaining([x]));
  });

  test('Uniary operator (+)', () => {
    compileOK(`let x; x = '1'; +x;`);
  });

  test('Uniary operator (-)', () => {
    expect(staticError(`let x; +x;`)).toEqual(expect.arrayContaining([x]));
  });

  test('Update expression (+)', () => {
    compileOK(`let x; x = 1; ++x;`);
  });

  test('Update expression (-)', () => {
    expect(staticError(`let x; ++x;`)).toEqual(expect.arrayContaining([x]));
  });

  test('Basic shadowing (+)', () => {
    compileOK(`let x; { let x = 1; x; }`);
  });

  test('Basic shadowing (-)', () => {
    expect(staticError(`let x; {
      let x = 1; x;
    } x;`)).toEqual(expect.arrayContaining([x]));
  });
});
