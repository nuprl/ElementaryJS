/* This module contains the primary visitor that enforces the static checks
 * and inserts the dynamic checks of ElementaryJS. To the extent possible,
 * the visitor does not throw an exception if a static check fails. Instead,
 * it accumulates a list of errors in visitor state. Once the visitor
 * reaches the end, it throws the list of errors if it is non-empty.
 *
 * Guidelines on how to implement new checks:
 *
 * NodeType: {
 *   enter(path, st: S): {
 *     // Implement any static checks here by adding an error message by
 *     st.elem.error(<message>);
 *     // If the node is totally crazy and will break everything else, consider
 *     // using path.skip() to give up processing this part of the AST. You
 *     // can also use path.stop() to stop all further error-checks.
 *
 *     // If you are going to desugar this node, do it here and  *do not*
 *     // use path.skip(). i.e., desugaring needs to revisit the node.
 *   },
 *   exit(path, st: S): {
 *     // If you're going to implement a dynamic check, do it here and call
 *     // path.skip() to avoid checking generated code.
 *   }
 * }
 * 
 */

import * as t from 'babel-types';
import { NodePath } from 'babel-traverse';
import { ElementarySyntaxError, CompileError } from './types';

let comparisonOperators = [
  "===",
  "!=="
];
let numOrStringOperators = [
  "+",
];
let numOperators = [
  "<=",
  ">=",
  "<",
  ">",
  "<<",
  ">>",
  ">>>",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^"
];
let allowedBinaryOperators = comparisonOperators.concat(numOrStringOperators, numOperators);

// This is the visitor state, which includes a list of errors. We throw
// this object if something goes wrong.Clients of ElementaryJS only rely on the
// CompileError interface.
export class State implements CompileError {

  // Allows clients to discriminate between CompileError and CompileResult.
  public kind: 'error' = 'error';
  public inConstructor: boolean = false;
  public inConstructorStack: boolean[] = [];

  constructor(public errors: ElementarySyntaxError[]) {
  }

  // Convenience method to add a new error
  error(path: NodePath<t.Node>, message: string) {
    this.errors.push({ line: path.node.loc.start.line, message: message });
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
          const l = x.line;
          return `- ${x.message} (line ${l})`
        }).join('\n');
    }
  }
}

function dynCheck(name: string, loc: t.SourceLocation, ...args: t.Expression[]): t.CallExpression {
  const f = t.memberExpression(t.identifier('rts'), t.identifier(name), false);
  const c = t.callExpression(f, args);
  // Use the location of the first argument to the dynamic check as the location
  // of CallExpression, which is what Stopify uses to report stack traces.
  // This should be good enough for most cases. If we need finer control, we
  // could add an optional SourceLocation argument to the dynCheck function.
  c.loc = loc;
  return c;
}

interface S {
  elem: State,
  opts: {
    isOnline: boolean,
    runTests: boolean,
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
    default: throw new Error(`unexpected operator type '${op}'`);
  }
}

export function functionBody(node: t.Function | t.Program): t.Statement[] {
  if (node.type === 'Program') {
    return node.body;
  }
  else if (t.isFunctionExpression(node) ||
           t.isFunctionDeclaration(node) ||
           t.isClassMethod(node) ||
           t.isObjectMethod(node)) {
    return node.body.body;
  }
  else {
    throw new Error(`node is a ${node.type}`);
  }
}

function enclosingScopeBlock(path: NodePath<t.Node>): t.Statement[] {
  const parent = path.getFunctionParent().node;
  if (t.isProgram(parent) ||
    t.isClassMethod(parent) ||
    t.isFunctionExpression(parent) ||
    t.isFunctionDeclaration(parent) ||
    t.isObjectMethod(parent)) {
    return functionBody(parent);
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

export const visitor = {
  Program: {
    enter(path: NodePath<t.Program>, st: S) {
      st.elem = new State([]);
    },
    exit(path: NodePath<t.Program>, st: S) {
      if (path.node.body.length !== 0) {
        path.get('body.0').insertBefore(
          t.variableDeclaration('var', [
            t.variableDeclarator(t.identifier('rts'), rtsExpression(st))
          ]));
      }
      path.stop();

      if (st.elem.errors.length > 0) {
        throw st.elem;
      }
    }
  },
  Function: {
    enter(path: NodePath<t.Function>, st: S) {
      const inCtor = path.node.type === 'ClassMethod' &&
        path.node.kind === 'constructor';
      st.elem.inConstructorStack.push(st.elem.inConstructor);
      st.elem.inConstructor = inCtor;
    },
    exit(path: NodePath<t.Function>, st: S) {
      st.elem.inConstructor = st.elem.inConstructorStack.pop()!

      // Inserts the expression `dynCheck(N, arguments.length, name)` at the
      // top of the function, where N is the number of declared arguments
      // and name is the name of the function or '(anonymous').
      const body = functionBody(path.node);
      const id = path.node.id;
      const expected = t.numericLiteral(path.node.params.length);
      const actual = t.memberExpression(t.identifier('arguments'), 
        t.identifier('length'), false);
      const name = t.stringLiteral(id ? id.name : '(anonymous)');
      body.unshift(t.expressionStatement(
        dynCheck('arityCheck', path.node.loc, name, expected, actual)));

      path.skip();
    },
  },
  VariableDeclarator(path: NodePath<t.VariableDeclarator>, st: S) {
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
      if ((t.isUpdateExpression(parent) && parent.argument == path.node) ||
          (t.isAssignmentExpression(parent) && parent.left === path.node)) {
        return;
      }
      if (t.isCallExpression(parent) && parent.callee === path.node) {
        // This MemberExpression is the callee in a CallExpression, i.e.,
        // obj.method(...).
        // We can simply leave this intact. JavaScript will throw an exception
        // with a reasonable error message if obj.method is not a function.
        return;
      }
      const o = path.node.object;
      const p = path.node.property;
      if (path.node.computed === false) {
        if (!t.isIdentifier(p)) {
          // This should never happen
          throw new Error(`ElementaryJS expected id. in MemberExpression`);
        }
        path.replaceWith(dynCheck('dot', o.loc, o, t.stringLiteral(p.name)));
        path.skip();
      } else {
        path.replaceWith(dynCheck('arrayBoundsCheck', o.loc, o, p));
        path.skip();
      }
    }
  },
  AssignmentExpression: {
    enter(path: NodePath<t.AssignmentExpression>, st: S) {
      // Disallow certain operators and patterns
      const allowed = ['=', '+=', '-=', '*=', '/=', '%='];
      const { operator: op, left, right } = path.node;
      if (allowed.includes(op) === false) {
        st.elem.error(path, `Do not use the '${op}' operator.`);
        path.skip();
        return;
      }
      if (!t.isIdentifier(left) && !t.isMemberExpression(left)) {
        st.elem.error(path, `Do not use patterns`);
        path.skip();
        return;
      }

      if (op === '=') {
        return;
      }

      // Desugar everything that is not '='
      if (t.isIdentifier(left)) {
        path.replaceWith(t.assignmentExpression('=', left,
          t.binaryExpression(unassign(op), left, right)));
      }
      else {
        // exp.x += rhs =>  tmp = exp, tmp.x = tmp.x + rhs
        const tmp = path.scope.generateUidIdentifier('tmp');
        enclosingScopeBlock(path).push(
          t.variableDeclaration('var', [
            t.variableDeclarator(tmp)
          ]));
        path.replaceWith(
          t.sequenceExpression([
            t.assignmentExpression('=', tmp, left.object),
            t.assignmentExpression('=',
              t.memberExpression(tmp, left.property, left.computed),
              t.binaryExpression(unassign(op),
                t.memberExpression(tmp, left.property, left.computed),
                path.node.right))]));
      }
    },
    exit(path: NodePath<t.AssignmentExpression>, st: S) {
      const { left, right } = path.node;
      if (path.node.operator !== '=') {
        throw new Error(`desugaring error`);
      }
      if (!t.isIdentifier(left) && !t.isMemberExpression(left)) {
        throw new Error(`syntactic check error`);
      }


      if (t.isIdentifier(left)) {
        return;
      }

      if (st.elem.inConstructor && left.object.type === 'ThisExpression') {
        return;
      }

      if (left.computed) {
        // exp[x] = rhs => checkArray(exp, x, rhs)
        path.replaceWith(
          dynCheck('checkArray', left.object.loc, left.object, left.property, right));
      } else {
        // exp.x = rhs => checkMember(exp, 'x', rhs)
        path.replaceWith(
          dynCheck('checkMember', left.object.loc, left.object, propertyAsString(left),
            right));
      }
      path.skip();
    }
  },
  LogicalExpression: { // logical expressions only has && and || as operators
    exit(path: NodePath<t.LogicalExpression>, st: S) {
      let op = path.node.operator;
      let opName = t.stringLiteral(op);
      path.replaceWith(dynCheck(
        'applyBinaryBooleanOp',
        path.node.loc,
        opName,
        path.node.left,
        path.node.right, 
      ));
      path.skip();
    }
  },
  BinaryExpression: {
    enter(path: NodePath<t.BinaryExpression>, st: S) {
      let op = path.node.operator;
      if (op === '==') {
        st.elem.error(path, `Do not use the '==' operator. Use '===' instead.`);
        path.skip();
      } else if (op === '!=') {
        st.elem.error(path, `Do not use the '!=' operator. Use '!==' instead.`);
        path.skip();
      } else if (!(allowedBinaryOperators.includes(op))) {
        st.elem.error(path, `Do not use the '${op}' operator.`);
        path.skip();
      }
    },
    exit(path: NodePath<t.BinaryExpression>, st: S) {
      // Original: a + b
      let op = path.node.operator;
      let opName = t.stringLiteral(op);
      if (numOrStringOperators.includes(op)) {
        // Transformed: applyNumOrStringOp('+', a, b);
        path.replaceWith(dynCheck("applyNumOrStringOp",
          path.node.loc,
          opName,
          path.node.left,
          path.node.right));
        path.skip();
      } else if (numOperators.includes(op)) {
        // Transformed: applyNumOp('+', a, b);
        path.replaceWith(dynCheck("applyNumOp",
          path.node.loc,
          opName,
          path.node.left,
          path.node.right));
        path.skip();
      }
    }
  },
  UnaryExpression(path: NodePath<t.UnaryExpression>, st: S) {
    if (path.node.operator == 'delete') {
      st.elem.error(path, `Do not use the '` + path.node.operator +
        `' operator.`);
    }
  },
  UpdateExpression: {
    enter(path: NodePath<t.UpdateExpression>, st: S) {
      // Static checks
      if (path.node.prefix == false) {
        st.elem.error(
          path, `Do not use post-increment or post-decrement operators.`);
        return;
      }

    },
    exit(path: NodePath<t.UpdateExpression>, st: S) {
      const a = path.node.argument;
      if (a.type !== 'Identifier' && a.type !== 'MemberExpression') {
        throw new Error(`not an l-value in update expression`);
      }
      let opName = t.stringLiteral(path.node.operator);
      if (t.isIdentifier(a)) {
        // ++x ==> updateOnlyNumbers(++x), x
        const check = dynCheck('updateOnlyNumbers',
          path.node.loc,
          opName,
          a);
        path.replaceWith(t.sequenceExpression([check, path.node]));
        path.skip();
      } else {
        // replace with dyn check function that takes in both obj and member.
        path.replaceWith(dynCheck('checkUpdateOperand',
          path.node.loc,
          opName,
          a.object,
          propertyAsString(a)));
        path.skip();
      }
    }
  },
  ReferencedIdentifier(path: NodePath<t.Identifier>, st: S) {
    // Babel AST is not well-designed here.
    const parentType = path.parent.type;
    if (parentType === 'BreakStatement' ||
        parentType === 'ContinueStatement' ||
        parentType === 'LabeledStatement') {
      return;
    }

    if (path.node.name === 'Array') {
      const e = t.memberExpression(t.identifier('rts'), path.node, false);
      path.replaceWith(e);
      path.skip();
    }
  },
  ForStatement(path: NodePath<t.ForStatement>, st: S) {
    if (path.node.init === null) {
      st.elem.error(path, `for statement variable initialization must be present`);
    }
    if (path.node.init !== null && 
      !t.isAssignmentExpression(path.node.init) && 
      !t.isVariableDeclaration(path.node.init)) {
      st.elem.error(path, `for statement variable initialization must be an assignment or a variable declaration`);
    }
    if (path.node.test === null) {
      st.elem.error(path, `for statement termination test must be present`);
    }
    if (path.node.update === null) {
      st.elem.error(path, `for statement update expression must be present`);
    }
    if (!t.isBlockStatement(path.node.body)) {
      st.elem.error(path, `Loop body must be enclosed in braces.`);
    }
  },
  WhileStatement(path: NodePath<t.WhileStatement>, st: S) {
    if (!t.isBlockStatement(path.node.body)) {
      st.elem.error(path, `Loop body must be enclosed in braces.`);
    }
  },
  DoWhileStatement(path: NodePath<t.DoWhileStatement>, st: S) {
    if (!t.isBlockStatement(path.node.body)) {
      st.elem.error(path, `Loop body must be enclosed in braces.`);
    }
  },
  IfStatement(path: NodePath<t.IfStatement>, st: S) {
    if (!t.isBlockStatement(path.node.consequent) && path.node.alternate === null) {
      st.elem.error(path, `if statement body must be enclosed in braces.`);
      return;
    }
    if (!t.isBlockStatement(path.node.consequent) && !t.isBlockStatement(path.node.alternate)) {
      st.elem.error(path, `Body of if-else statement must be enclosed in braces.`);
    }
  },
  BreakStatement(path: NodePath<t.BreakStatement>, st: S) {
    if (path.node.label !== null) {
      st.elem.error(path, `break statement must not have label`);
    }
  },
  ContinueStatement(path: NodePath<t.ContinueStatement>, st: S) {
    if (path.node.label !== null) {
      st.elem.error(path, `continue statement must not have label`);
    }
  },
  VariableDeclaration(path: NodePath<t.VariableDeclaration>, st: S) {
    if (path.node.kind !== 'let' && path.node.kind !== 'const') {
      st.elem.error(path, `Use 'let' or 'const' to declare a variable.`);
    }
  },
  ThrowStatement(path: NodePath<t.ThrowStatement>, st: S) {
    st.elem.error(path, `Do not use the 'throw' operator.`);
  },
  WithStatement(path: NodePath<t.WithStatement>, st: S) {
    st.elem.error(path, `Do not use the 'with' statement.`);
  },
  SwitchStatement(path: NodePath<t.SwitchStatement>, st: S) {
    st.elem.error(path, `Do not use the 'switch' statement.`);
  },
  LabeledStatement(path: NodePath<t.LabeledStatement>, st: S) {
    st.elem.error(path, `Do not use labels to alter control-flow`);
  },
  ForOfStatement(path: NodePath<t.ForOfStatement>, st: S) {
    st.elem.error(path, `Do not use for-of loops.`);
  },
  ForInStatement(path: NodePath<t.ForInStatement>, st: S) {
    st.elem.error(path, `Do not use for-in loops.`);
  }
}

// Allows ElementaryJS to be used as a Babel plugin.
export function plugin() {
  return { visitor: visitor };
}
