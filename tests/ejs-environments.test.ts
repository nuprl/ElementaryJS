import { compileOK, staticError } from './test-utils';

describe('ElementaryJS Environments', () => {
  const x: string = `You must initialize the variable 'x' before use.`;

  function compileError(code: string, msg: string = x) {
    expect(staticError(code)).toEqual(expect.arrayContaining([msg]));
  }

  test('Trivial uninitialized let (+)', () => {
    compileOK(`let x;`);
    compileOK(`let x; x = 1;`);
    compileOK(`let x; x = 1; x;`);
  });

  test('Trivial uninitialized let (-)', () => {
    compileError(`let x; x;`);
    compileError(`let x, y = x;`);
  });

  test('Undefined counts (+)', () => {
    compileOK(`let x; x = undefined; x;`);
    compileOK(`let x; x = void 0; x;`);
    compileOK(`let x; x = (() => {})(); x;`);
  });

  test('Array Expression (+)', () => {
    compileOK(`let x; x = '1'; [x];`);
  });

  test('Array Expression (-)', () => {
    compileError(`let x; [x];`);
  });

  test('Unary expression (+)', () => {
    compileOK(`let x; x = '1'; +x;`);
  });

  test('Unary expression (-)', () => {
    compileError(`let x; +x;`);
  });

  test('Update expression (+)', () => {
    compileOK(`let x; x = 1; ++x;`);
  });

  test('Update expression (-)', () => {
    compileError(`let x; ++x;`);
  });

  test('Basic shadowing (+)', () => {
    compileOK(`let x; { let x = 1; x; }`);
  });

  test('Basic shadowing (-)', () => {
    compileError(`let x; { let x = 1; x; } x;`);
  });

  test('Assignment in plain block (+)', () => {
    compileOK(`let x; { x = 1; x; } x;`);
    compileOK(`let x; { { x = 1; x; } x; } x;`);
  });

  test('Assignment in plain block (-)', () => {
    compileError(`let x; { x; x = 1; } x;`);
    compileError(`let x; { x; { x = 1; x; } } x;`);
  });

  test('While loop (+)', () => {
    compileOK(`let x, y = 0;
      while (y < 1) {
        x = 0; x; ++y;
      }
    `);
  });

  test('While loop (-)', () => {
    compileError(`let x, y = 0;
      while (y < 1) {
        x = 0; x; ++y;
      }
      x;
    `);
  });

  test('For loop (+)', () => {
    compileOK(`let x;
      for (x = 0; x < 10; ++x) { console.log(x); }
    `);
    compileOK(`let x, y;
      for (y = 0; y < 1; ++y) {
        x = 0; x; ++y;
      }
    `);
    // shadowing
    compileOK(`let x;
      for (let x = 0; x < 1; ++x) {}
    `);
    // initialize before test
    compileOK(`let x;
      for (x = 0; false; ++x) {}
      x;
    `);
  });

  test('For loop (-)', () => {
    compileError(`let x;
      for (let x = 0; x < 1; ++x) {}
      x;
    `);
    compileError(`let x, y;
      for (y = 0; y < 1; ++y) {
        x = 0; x; ++y;
      }
      x;
    `);
  });

  test('Do while loop (+)', () => {
    compileOK(`let x;
      do {
        x = 0; x;
      } while (false);
      x;
    `);
  });

  test('Function parameter shadowing (+)', () => {
    compileOK(`let x;
      function t(x) {
        return x;
      }
    `);
    compileOK(`let x, y = function t(x) { return x; };`);
    compileOK(`let x;
      class T {
        constructor(x) { this.x = x; }
      }
    `);
  });

  test('Function parameter shadowing (-)', () => {
    compileError(`let x;
      function t(x) {
        return x;
      }
      x;
    `);
    compileError(`let x, y = function t(x) { return x; }; x;`);
    compileError(`let x;
      class T {
        constructor(x) { this.x = x; }
      }
      x;
    `);
  });

  test('Function reference parent scope (+)', () => {
    compileOK(`let x;
      function t() {
        x = 1;
        return x;
      }
    `);
    compileOK(`let x, y = function t() { x = 0; return x; };`);
    compileOK(`let x;
      class T {
        constructor() { x = 0; this.x = x; }
      }
    `);
  });

  test('Function reference parent scope (-)', () => {
    compileError(`let x;
      function t() {
        return x;
      }
    `);
    compileError(`let x, y = function t() { return x; };`);
    compileError(`let x;
      class T {
        constructor() { this.x = x; }
      }
    `);
  });

  test('Function environment popped on exit (+)', () => {
    compileOK(`let x;
      function t() {
        x = 1;
        return x;
      }
      x = t();
      x;
    `);
    compileOK(`let x, y = function t() { x = 0; return x; }; x = y(); x;`);
    compileOK(`let x;
      class T {
        constructor() { x = 0; this.x = x; }
      }
      x = new T();
      x;
    `);
  });

  test('Function environment popped on exit (-)', () => {
    compileError(`let x;
      function t() {
        x = 1;
        return x;
      }
      x;
    `);
    compileError(`let x, y = function t() { x = 0; return x; }; x;`);
    compileError(`let x;
      class T {
        constructor() { x = 0; this.x = x; }
      }
      x;
    `);
    compileError(`let x;
      function t() {
        x = 1;
        return x;
      }
      t(); x;
    `);
    compileError(`let x, y = function t() { x = 0; return x; }; y(); x;`);
    compileError(`let x;
      class T {
        constructor() { x = 0; this.x = x; }
      }
      new T(); x;
    `);
  });

  test('Function environment popped on exit nested (+)', () => {
    compileOK(`
      function t() {
        let x, y = () => { x = 1; x; };
        return y();
      }
    `);
  });

  test('Function environment popped on exit nested (-)', () => {
    compileError(`
      function t() {
        let x, y = () => { x = 1; x; };
        return x;
      }
    `);
  });

  test('If statement without alternate (-)', () => {
    compileError(`let x;
      if (true) {
        x = 0;
      }
      x;
    `);
  });

  test('If statement with alternate (+)', () => {
    compileOK(`let x;
      if (true) {
        x = 0; x;
      } else {
        x = 1; x;
      }
      x;
    `);
    // nested plain block
    compileOK(`let x;
      if (true) {
        { x = 0; x; }
      } else {
        { x = 1; x; }
      }
      x;
    `);
  });

  test('If statement with alternate (-)', () => {
    compileError(`let x;
      if (true) {
        x = 0;
      } else {
        1 + 2;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        1 + 2;
      } else {
        x = 0;
      }
      x;
    `);
  });

  test('If statement with multiple branches (+)', () => {
    compileOK(`let x;
      if (true) {
        x = 0; x;
      } else if (false) {
        x = 0; x;
      } else {
        x = 0; x;
      }
      x;
    `);
  });

  test('If statement with multiple branches (-)', () => {
    compileError(`let x;
      if (true) {
        x = 0;
      } else if (false) {
        1 + 2;
      } else {
        1 + 2;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        1 + 2;
      } else if (false) {
        x = 0;
      } else {
        1 + 2;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        1 + 2;
      } else if (false) {
        1 + 2;
      } else {
        x = 0;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        x = 0;
      } else if (false) {
        x = 0;
      } else {
        1 + 2;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        x = 0;
      } else if (false) {
        1 + 2;
      } else {
        x = 0;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        1 + 2;
      } else if (false) {
        x = 0;
      } else {
        x = 0;
      }
      x;
    `);
  });

  test('If statement with multiple nested branches (+)', () => {
    compileOK(`let x;
      if (true) {
        if (true) {
          if (true) {
            x = 0;
          } else {
            x = 1;
          }
        } else {
          x = 5;
        }
      } else {
       x = 1;
      }
      x;
    `);
    compileOK(`let x;
      if (true) {
        if (true) {
          if (true) {
            x = 0;
          } else if (false) {
            x = 1;
          } else {
            x = 8;
          }
        } else if (false) {
          x = 5;
        } else if (false) {
          x = 5;
        } else {
          x = 9;
        }
      } else if (false) {
        x = 1;
      } else {
        x = 2;
      }
      x;
    `);
  });

  test('If statement with multiple nested branches (-)', () => {
    compileError(`let x;
      if (true) {
        if (true) {
          if (true) {
            x = 0;
          } else {
            1 + 2;
          }
        } else {
          x = 5;
        }
      } else {
       x = 1;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        if (true) {
          if (true) {
            x = 0;
          } else if (false) {
            1 + 2;
          } else {
            x = 8;
          }
        } else if (false) {
          x = 5;
        } else if (false) {
          x = 5;
        } else {
          x = 9;
        }
      } else if (false) {
        x = 1;
      } else {
        x = 2;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        if (true) {
          if (true) {
            x = 0;
          } else if (false) {
            x = 0;
          } else {
            x = 8;
          }
        } else if (false) {
          x = 5;
        } else if (false) {
          1 + 2;
        } else {
          x = 9;
        }
      } else if (false) {
        x = 1;
      } else {
        x = 2;
      }
      x;
    `);
    compileError(`let x;
      if (true) {
        if (true) {
          if (true) {
            x = 0;
          } else if (false) {
            x = 0;
          } else {
            x = 8;
          }
        } else if (false) {
          x = 5;
        } else if (false) {
          x = 1;
        } else {
          x = 9;
        }
      } else if (false) {
        x = 1;
      } else {
        1 + 2;
      }
      x;
    `);
  });

  test('Nested statements (+)', () => {
    compileOK(`let x;
      function t() {
        let x;
        if (true) {
          if (true) {
            x = 0;
          } else {
            do {
              if (false) {
                x = 1;
              } else if (true) {
                x = 2;
              } else {
                x = 1;
              }
              x;
            } while (false);
            x;
          }
        } else if (false) {
          x = 5;
        } else {
          x = 1;
        }
        x;
      }
    `);
     compileOK(`let x;
      function t() {
        let x;
        while(true) {
          if (true) {
            x = 1;
            if (true) {
              1 + 2;
            } else {
              for (let y = 1; x < 0; y += 1) {
                if (false) {
                  x = 1;
                } else if (true) {
                  x = 2;
                } else {
                  x = 1;
                }
              }
              x;
            }
            x;
          } else if (false) {
            x = 5;
          } else {
            x = 1;
          }
          x;
        }
      }
    `);
  });

  test('Nested statements (-)', () => {
    compileError(`let x;
      function t() {
        let x;
        if (true) {
          if (true) {
            x = 0;
          } else {
            do {
              if (false) {
                x = 1;
              } else if (true) {
                1 + 2;
              } else {
                x = 1;
              }
            } while (false);
            x;
          }
        } else if (false) {
          x = 5;
        } else {
          x = 1;
        }
      }
    `);
     compileError(`let x;
      function t() {
        let x;
        while(true) {
          if (true) {
            x = 1;
            if (true) {
              1 + 2;
            } else {
              for (let y = 1; x < 0; y += 1) {
                if (false) {
                  x = 1;
                } else if (true) {
                  x = 2;
                } else {
                  x = 1;
                }
              }
              x;
            }
          } else if (false) {
            x = 5;
          } else {
            x = 1;
          }
        }
        x;
      }
    `);
  });

  test('Deep nesting (+)', () => {
    compileOK(`let x;
      function t() {
        let x;
        if (true) {
          if (true) {
            x = 0;
            if (true) {
              x;
              if (true) {
                x;
                if (true) {
                  x;
                  if (true) {
                    x;
                  }
                }
              }
            }
            x;
          }
        }
      }
    `);
     compileOK(`let x;
      function t() {
        let x;
        {
          if (true) {
            x = 0;
            if (true) {
              x;
              while (x < -1) {
                x;
                if (true) {
                  x;
                  {
                    x;
                  }
                }
              }
            }
            x;
          }
        }
      }
    `);
  });

  test('Deep nesting (-)', () => {
    compileError(`let x;
      function t() {
        let x;
        if (true) {
          if (true) {
            x = 0;
            if (true) {
              x;
              if (true) {
                x;
                if (true) {
                  let x;
                  if (true) {
                    x;
                  }
                }
              }
            }
          }
        }
      }
    `);
     compileError(`let x;
      function t() {
        let x;
        {
          if (true) {
            x = 0;
            if (true) {
              x;
              while (x < -1) {
                x;
                if (true) {
                  x;
                  {
                    x;
                  }
                }
              }
            }
            x;
          }
          x;
        }
      }
    `);
  });

  test('Switch statement (+)', () => {
    compileOK(`let x, y = 0;
      switch (y) {
        case 0: {
          x = 1; x;
        }
      }
    `);
    compileOK(`let x, y = 0;
      switch (y) {
        case 0: {
          x = 1; x;
        }
        case 1:
        case 2: {
          x = 1; x;
        }
      }
    `);
    compileOK(`let x, y = 0;
      switch (y) {
        case 0: {
          x = 1; x;
        }
        case 1:
        case 2: {
          x = 1; x;
        }
        default: {
          x = 1; x;
        }
      }
      x;
    `);
  });

  test('Switch statement (-)', () => {
    compileError(`let x, y = 0;
      switch (y) {
        case 0: {
          x = 1; x;
        }
        case 1: {
          x;
        }
      }
    `);
    compileError(`let x, y = 0;
      switch (y) {
        case 0: {
          x = 1; x;
        }
        case 1:
        case 2: {
          x = 1; x;
        }
      }
      x;
    `);
    compileError(`let x, y = 0;
      switch (y) {
        case 0: {
          1 + 2;
        }
        case 1:
        case 2: {
          x = 1; x;
        }
        default: {
          x = 1; x;
        }
      }
      x;
    `);
  });

  test('Nested switch statements (+)', () => {
    compileOK(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            x = 1; x;
            switch (y) {
              case 0: {
                x;
              }
            }
          }
        }
      }
    `);
    compileOK(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            switch (y) {
              case 0: {
                let x;
              }
            }
            x = 1; x;
          }
        }
      }
    `);
    compileOK(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            switch (y) {
              default: {
                x = 1;
              }
            }
            x;
          }
        }
      }
    `);
  });

  test('Nested switch statements (-)', () => {
    compileError(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            switch (y) {
              case 0: {
                x = 1;
              }
            }
            x;
          }
        }
      }
    `);
    compileError(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            switch (y) {
              case 0: {
                x;
              }
            }
            x = 1;
          }
        }
      }
    `);
    compileError(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            switch (y) {
              default: {
                x = 1;
              }
            }
          }
        }
        x;
      }
    `);
  });

  test('Switch and if (+)', () => {
    compileOK(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            if (true) {
              do {
                x = 1;
              } while (false);
              x;
            } else if (false) {
              x = 1; x;
            } else {
              x = 1;
            }
            switch (y) {
              case 0: {
                x;
              }
            }
          }
        }
      }
    `);
    compileOK(`let x, y = 0;
      {
        switch (y) {
          default:
          case 0: {
            if (true) {
              do {
                x = 1;
              } while (false);
              x;
            } else if (false) {
              x = 1; x;
            } else {
              x = 1;
            }
            switch (y) {
              case 1:
              case 0: {
                x;
              }
            }
          }
        }
        x;
      }
    `);
    compileOK(`let x, y = 0;
      if (true) {
        switch (y) {
          default:
          case 0: {
            if (true) {
              do {
                x = 1;
              } while (false);
              x;
            } else if (false) {
              x = 1; x;
            } else {
              x = 1;
            }
            switch (y) {
              case 1:
              case 0: {
                x;
              }
            }
          }
        }
        x;
      } else if (false) {
        switch (y) {
          default: { x = 1; }
        }
        x;
      } else {
        x = 1;
      }
      x;
    `);
  });

  test('Switch and if (-)', () => {
    compileError(`let x, y = 0;
      {
        switch (y) {
          case 0: {
            if (true) {
              do {
                x = 1;
              } while (false);
              x;
            } else if (false) {
              1 + 2;
            } else {
              x = 1;
            }
            switch (y) {
              case 0: {
                x;
              }
            }
          }
        }
      }
    `);
    compileError(`let x, y = 0;
      {
        switch (y) {
          default:
          case 0: {
            if (true) {
              do {
                x = 1;
              } while (false);
              x;
            } else if (false) {
              x = 1; x;
            } else {
              let x = 1;
            }
            switch (y) {
              case 1:
              case 0: {
                x;
              }
            }
          }
        }
        x;
      }
    `);
    compileError(`let x, y = 0;
      if (true) {
        switch (y) {
          default:
          case 0: {
            if (true) {
              do {
                x = 1;
              } while (false);
              x;
            } else {
              x = 1;
            }
            switch (y) {
              case 1:
              case 0: {
                x;
              }
            }
          }
        }
        x;
      } else if (false) {
        switch (y) {
          default: { let x = 1; }
        }
        x;
      } else {
        x = 1;
      }
      x;
    `);
  });
});
