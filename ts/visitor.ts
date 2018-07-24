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
  elem: State,
  opts: {
    isOnline: boolean
  }
}

// The expression that loads the runtime system.
function rtsExpression(st: S): t.Expression {
  if (st.opts.isOnline) {
    return t.identifier('elementaryjs');
  }
  else {
    return t.callExpression(t.identifier('require'),
      [t.stringLiteral('./runtime')]);
  }
}

function unassign(op: string) {
  switch (op) {
    case '+=': return '+';
    case '-=': return '-';
    case '*=': return '*';
    case '/=': return '/';
    case '%=': return '%';
    default: throw new Error(`should not happen`);
  }
}


function enclosingScopeBlock(path: NodePath<t.Node>): t.Statement[] {
  const parent = path.getFunctionParent().node;
  if (t.isProgram(parent)) {
    return parent.body;
  }
  else if (t.isFunctionExpression(parent) ||
           t.isFunctionDeclaration(parent) ||
           t.isObjectMethod(parent)) {
    return parent.body.body;
  }
  else {
    throw new Error(`parent is a ${parent.type}`);
  }
}

function propertyAsString(node: t.MemberExpression): t.Expression {
  if (node.computed) {
    return node.property;
  }
  else {
    return t.stringLiteral((node.property as t.Identifier).name);
  }
}

export const visitor: Visitor = {
  Program: {
    enter(path, st: S) {
      st.elem = new State([]);
    },
    exit(path, st: S) {
      path.get('body.0').insertBefore(
        t.variableDeclaration('var', [
          t.variableDeclarator(t.identifier('rts'), rtsExpression(st))
        ]));
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
      const parent = path.parent;
      // Some stupid cases to skip: o.x = v and ++o.x
      // In these cases, the l-value is a MemberExpression, but we tackle
      // these in the AssignmentExpression and UpdateExpression cases.
      if ((parent.type === 'UpdateExpression' &&
           (parent as t.UpdateExpression).argument == path.node) ||
          (parent.type === 'AssignmentExpression' &&
           (parent as t.AssignmentExpression).left === path.node)) {
        return;
      }

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
  AssignmentExpression: {
    enter(path, st: S) {
      const allowed = [ '=', '+=', '-=', '*=', '/=', '%=' ];
      const op = path.node.operator;
      if (allowed.includes(op) === false) {
        st.elem.error(path, `Do not use the '${op}' operator.`);
        path.skip();
        return;
      }
      const left = path.node.left;

      if (left.type === 'Identifier') {
        if (op === '=') {
          return;
        }

        path.replaceWith(t.assignmentExpression('=', left,
          t.binaryExpression(unassign(op), left, path.node.right)));
      }
      else if (left.type === 'MemberExpression') {
        // exp.x = rhs => checkMember(exp, 'x', rhs)
        if (op === '=') {
          path.replaceWith(dynCheck('checkMember',
            left.object,
            propertyAsString(left),
            path.node.right));
          path.skip();
        }
        else {
          // exp.x += rhs =>  tmp = exp, tmp.x = tmp.x + rhs
          const tmp = path.scope.generateUidIdentifier('tmp');
          enclosingScopeBlock(path).push(
            t.variableDeclaration('var', [
              t.variableDeclarator(tmp)
            ]));
          path.replaceWith(t.assignmentExpression('=',
            left, t.binaryExpression(unassign(op), left, path.node.right)));
        }
      }
      else {
        st.elem.error(path, `Do not use patterns`);
        path.skip();
        return;
      }
    }
  },
  BinaryExpression(path, st: S) {
    if (path.node.operator == 'in' ||
        path.node.operator == 'instanceof') {
      st.elem.error(path, `Do not use the '` + path.node.operator +
          `' operator.`);
    }
  },
  UnaryExpression(path, st:S) {
    if (path.node.operator == 'delete' ||
        path.node.operator == 'typeof') {
      st.elem.error(path, `Do not use the '` + path.node.operator +
      `' operator.`);
    }
  },
  ThrowStatement(path, st:S) {
    st.elem.error(path, `Do not use the 'throw' operator.`);
  },
  UpdateExpression: {
    enter(path: NodePath<t.UpdateExpression>, st: S) {
      if ((path.node.operator == '++' || path.node.operator == '--') &&
          path.node.prefix == false) {
        st.elem.error(
            path, `Do not use post-increment or post-decrement operators.`);
      }
    },
    exit(path: NodePath<t.UpdateExpression>, st: S) {
      const a = path.node.argument;
      if (a.type === 'Identifier') {
        const check = dynCheck('updateOnlyNumbers',
            t.stringLiteral(path.node.operator),
            a);
        path.replaceWith(t.sequenceExpression(
          [check as t.Expression, path.node]));
        path.skip();
      } else if (a.type === 'MemberExpression') {
        const expr = a as t.MemberExpression;
        let obj = expr.object;
        let member : t.Expression;
        if (expr.computed) {
          member = a.property;
        } else {
          member = t.stringLiteral((a.property as t.Identifier).name);
        }
        // replace with dyn check function that takes in both obj and member.
        path.replaceWith(dynCheck('checkUpdateOperand', 
            t.stringLiteral(path.node.operator),
            obj,
            member));
        path.skip();
      } else if (a.type ==='CallExpression') {
        // Hack: Just run the expression, and check if the result is a number.
        path.replaceWith(dynCheck('checkNumberAndReturn', 
            t.stringLiteral(path.node.operator),
            path.node));
        path.skip();
      } else {
        // Trying to update something that's not an identifier.
        throw new Error(`ElementaryJS Error: trying to update expression of type ${a.type}`);
      }
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
