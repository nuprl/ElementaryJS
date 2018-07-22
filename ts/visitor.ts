// This module contains the primary visitor that enforces the static checks
// and inserts the dynamic checks of ElementaryJS. To the extent possible,
// the visitor does not throw an exception if a static check fails. Instead,
// it accumulates a list of errors in visitor state. Once the visitor
// reaches the end, it throws the list of errors if it is non-empty.

import * as t from 'babel-types';
import { Visitor, NodePath } from 'babel-traverse';
import { ElementarySyntaxError, CompileError } from './types';

// This is the visitor state, which includes a list of errors. We throw
// this object if something goes wrong.Clients of ElementaryJS only rely on the
// CompileError interface.
export class State implements CompileError {

  // Allows clients to discriminate between CompileError and CompileResult.
  public kind: 'error' = 'error';

  constructor(public errors: ElementarySyntaxError[]) {
  }

  // Convenience method to add a new error
  error(path: NodePath<t.Node>, message: string) {
    this.errors.push({ location: path.node.loc, message: message });
  }

  // Convenience: object prints reasonably for debugging the implementation
  // of ElementaryJS.
  toString() {
    if (this.errors.length === 0) {
      return 'class State in ElementaryJS with no errors';
    }
    else {
      return 'class State in ElementaryJS With the following errors:\n' +
        this.errors.map(x => {
          const l = x.location.start.line;
          const c = x.location.start.column;
          return `- ${x.message} (line ${l}, column ${c})`
        }).join('\n');
    }
  }
}

function dynCheck(name: string, ...args: t.Expression[]): t.CallExpression {
  const f = t.memberExpression(t.identifier('rts'), t.identifier(name), false);
  return t.callExpression(f, args);
}

interface S {
  elem: State
}

export const visitor: Visitor = {
  Program: {
    enter(path, st: S) {
      st.elem = new State([]);
    },
    exit(path, st: S) {
      path.get('body.0').insertBefore(
        t.variableDeclaration(
          'var',
          [t.variableDeclarator(
            t.identifier('rts'),
            t.callExpression(
              t.identifier('require'),
              [t.stringLiteral('./runtime')]
            )
          )]
        )
      );
      path.stop();

      if (st.elem.errors.length > 0) {
        throw st.elem;
      }
    }
  },
  VariableDeclaration(path, st: S) {
    if (path.node.kind !== 'let' && path.node.kind !== 'const') {
      st.elem.error(path, `Use 'let' or 'const' to declare a variable.`);
    }
  },
  VariableDeclarator(path, st: S) {
    if (path.node.id.type !== 'Identifier') {
      // TODO(arjun): This is an awful error message!
      st.elem.error(path, `Do not use destructuring patterns.`);
      // The remaining checks assume that the program is binding a simple
      // identifier.
      return;
    }
    if (!t.isExpression(path.node.init)) {
      let x = path.node.id.name;
      st.elem.error(path, `You must initialize the variable '${x}'.`);
    }
  },
  MemberExpression: {
    exit(path: NodePath<t.MemberExpression>) {
      const o = path.node.object;
      const p = path.node.property;
      if (path.node.computed === false) {
        if (p.type !== 'Identifier') {
          // This should never happen
          throw new Error(`ElementaryJS expected id. in MemberExpression`);
        }
        path.replaceWith(dynCheck('dot', o, t.stringLiteral(p.name)));
        path.skip();
      }
    }
  },
  WithStatement(path, st: S) {
    st.elem.error(path, `Do not use the 'with' statement.`);
  },
  SwitchStatement(path, st: S) {
    st.elem.error(path, `Do not use the 'switch' statement.`);
  },
  LabeledStatement(path, st: S) {
    st.elem.error(path, `Do not use labels to alter control-flow`);
  },
  BinaryExpression(path, st: S) {
    if (path.node.operator == 'in' ||
        path.node.operator == 'instanceof') {
      st.elem.error(path, `Do not use the '` + path.node.operator +
          `' operator.`);
    }
  },
  UpdateExpression(path, st: S) {
    if ((path.node.operator == '++' || path.node.operator == '--') &&
        path.node.prefix == false) {
      st.elem.error(path, `Do not use post-increment or post-decrement ` +
          `operators.`);
    }
  },
  ForOfStatement(path, st: S) {
    st.elem.error(path, `Do not use for-of loops.`);
  },
  ForInStatement(path, st: S) {
    st.elem.error(path, `Do not use for-in loops.`);
  },
}

// Allows ElementaryJS to be used as a Babel plugin.
export function plugin() {
  return { visitor: visitor };
}