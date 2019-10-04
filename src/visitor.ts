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
 */
import * as t from 'babel-types';
import { NodePath } from 'babel-traverse';
import { ElementarySyntaxError, CompileError } from './types';

const assignmentOperators = ['=', '+=', '-=', '*=', '/=', '%='],
      comparisonOperators = ['===', '!=='],
      numOperators = ['<=', '>=', '<', '>', '<<', '>>', '>>>', '-', '*', '/', '%', '&', '|', '^'],
      numOrStringOperators = ['+'],
      allowedBinaryOperators = comparisonOperators.concat(numOrStringOperators, numOperators);

// This is the visitor state, which includes a list of errors.
// We throw this object if something goes wrong.
// Clients of ElementaryJS only rely on the CompileError interface.
export class State implements CompileError {
  public static isSilent: boolean = false;

  // Allows clients to discriminate between CompileError and CompileResult.
  public kind: 'error' = 'error';
  public inConstructor: boolean = false;
  public inConstructorStack: boolean[] = [];

  constructor(public errors: ElementarySyntaxError[]) {}

  // Convenience method to add a new error
  error(path: NodePath<t.Node>, message: string) {
    this.errors.push({ line: path.node.loc.start.line, message: message });
  }

  // Convenience: object prints reasonably for debugging the implementation of ElementaryJS.
  toString() {
    return this.errors.length === 0 ? 'class State in ElementaryJS with no errors' :
      this.errors.map(x => `- ${x.message} (line ${x.line})`).join('\n');
  }
}

interface S {
  elem: State
}

function dynCheck(name: string, loc: t.SourceLocation, ...args: t.Expression[]): t.CallExpression {
  const f = t.memberExpression(t.identifier('rts'), t.identifier(name), false),
        c = t.callExpression(f, args);
  c.loc = loc;
  return c;
}

function unassign(op: string) {
  switch (op) {
    // Allowed:
    case '+=': return '+';
    case '-=': return '-';
    case '*=': return '*';
    case '/=': return '/';
    case '%=': return '%';
    // Disallowed (st.elem.error), but still desugar:
    case '<<=': return '<<';
    case '>>=': return '>>';
    case '>>>=': return '>>>';
    case '&=': return '&';
    case '^=': return '^';
    case '|=': return '|';
    default: throw new Error(`unexpected operator type '${op}'`);
  }
}

function functionBody(node: t.Function | t.Program): t.Statement[] {
  if (node.type === 'Program') {
    return node.body;
  } else if (t.isFunctionExpression(node) ||
              t.isFunctionDeclaration(node) ||
              t.isClassMethod(node) ||
              t.isObjectMethod(node)) {
    return node.body.body;
  } else {
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
  } else {
    throw new Error(`parent is a ${parent.type}`);
  }
}

function propertyAsString(node: t.MemberExpression): t.Expression {
  return node.computed ? node.property : t.stringLiteral((node.property as t.Identifier).name);
}

function lvalIds(lval: t.LVal): t.Identifier[]  {
  // TODO(arjun): Not exactly right, but we don't support patterns anyway
  return lval.type === 'Identifier' ? [lval] : [];
}

const visitor = {
  Program: {
    enter(path: NodePath<t.Program>, st: S) {
        st.elem = new State([]);
        // Insert "use strict" if needed
        if (path.node.directives === undefined) {
          path.node.directives = [];
        }
        if (!path.node.directives.some(d => d.value.value === 'use strict')) {
          path.node.directives.push(t.directive(t.directiveLiteral('use strict')));
        }
    },
    exit(path: NodePath<t.Program>, st: S) {
      if (path.node.body.length !== 0) {
        path.get('body.0').insertBefore(
          t.variableDeclaration('var', [
            t.variableDeclarator(t.identifier('rts'),
              t.identifier('elementaryjs'))
          ]));
      }
      path.stop();

      const l = st.elem.errors.length;
      if (l > 0) {
        if (State.isSilent) {
          console.warn(`${l} EJS COMPILETIME ERROR${l > 1 ? 'S': '' }:\n${st.elem.toString()}`);
        } else {
          throw st.elem;
        }
      }
    }
  },
  Function: {
    enter(path: NodePath<t.Function>, st: S) {
      if (path.node.params.length &&
          path.node.params[path.node.params.length - 1].type === 'RestElement') {
        st.elem.error(path, 'The rest parameter is not supported.');
      }
      const inCtor = path.node.type === 'ClassMethod' && path.node.kind === 'constructor';
      st.elem.inConstructorStack.push(st.elem.inConstructor);
      st.elem.inConstructor = inCtor;
    },
    exit(path: NodePath<t.Function>, st: S) {
      st.elem.inConstructor = st.elem.inConstructorStack.pop()!
      if (path.has('shadow')) {
        //  Note(Sam L.) Babel arrow function transform leave shadow as true when
        // it transforms an arrow function to a function.
        // Babel's shadow functions are just traditional functions but act like
        // arrow functions (i.e has lexical binding of this and arguments)
        // It's to let other plugins see if additional transform needs to be done
        // on these functions. The classes transform would assume the arity
        // checking we did was using lexical binding of arguments, but we're not.
        (path.node as any).shadow = undefined; // therefore this is set to undefined
      }

      // Inserts the expression `dynCheck(N, arguments.length, name)` at the
      // top of the function, where N is the number of declared arguments
      // and name is the name of the function or '(anonymous').
      const body = functionBody(path.node),
            id = path.node.id,
            expected = t.numericLiteral(path.node.params.length),
            actual = t.memberExpression(t.identifier('arguments'), t.identifier('length'), false),
            name = t.stringLiteral(id ? id.name : '(anonymous)');
      body.unshift(t.expressionStatement(
        dynCheck('arityCheck', path.node.loc, name, expected, actual)));
      path.skip();
    },
  },
  VariableDeclarator(path: NodePath<t.VariableDeclarator>, st: S) {
    if (path.node.id.type !== 'Identifier') {
      // TODO(arjun): This is an awful error message!
      st.elem.error(path, 'Do not use destructuring patterns.');
      // The remaining checks assume that the program is binding a simple identifier.
      return;
    }
    if (!t.isExpression(path.node.init)) {
      st.elem.error(path, `You must initialize the variable '${path.node.id.name}'.`);
    }
  },
  CallExpression: {
    exit(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      if (callee.type === 'MemberExpression' &&
          callee.computed === false &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'split') {
        path.replaceWith(dynCheck('checkCall', path.node.loc,
          callee.object,
          propertyAsString(callee),
          t.arrayExpression(path.node.arguments)));
        path.skip();
      }
    }
  },
  ObjectExpression(path: NodePath<t.ObjectExpression>, st: S) {
    const propertyNames = new Set();
    for (let i = 0; i < path.node.properties.length; ++i) {
      const prop = path.node.properties[i];
      if (prop.type === 'ObjectProperty') {
        if (prop.key.type !== 'Identifier') {
          st.elem.error(path, 'Object member name must be an identifier.');
        } else {
          propertyNames.has(prop.key.name) ? st.elem.error(path,
            `Object member name may only be used once; ${prop.key.name}.`) :
            propertyNames.add(prop.key.name);
        }
      }
    }
  },
  MemberExpression: {
    exit(path: NodePath<t.MemberExpression>) {
      const parent = path.parent;
      // Some stupid cases to skip: o.x = v and ++o.x
      // In these cases, the l-value is a MemberExpression, but we tackle
      // these in the AssignmentExpression and UpdateExpression cases.
      if ((t.isUpdateExpression(parent) && parent.argument === path.node) ||
          (t.isAssignmentExpression(parent) && parent.left === path.node)) {
        return;
      }
      if (t.isCallExpression(parent) && parent.callee === path.node) {
        // This MemberExpression is the callee in a CallExpression, i.e., obj.method(...).
        // We can simply leave this intact. JavaScript will throw an exception
        // with a reasonable error message if obj.method is not a function.
        return;
      }
      const o = path.node.object,
            p = path.node.property;
      if (path.node.computed === false) {
        if (!t.isIdentifier(p)) {
          // This should never happen
          throw new Error('ElementaryJS expected id. in MemberExpression');
        }
        path.replaceWith(dynCheck('dot', o.loc, o, t.stringLiteral(p.name)));
      } else {
        path.replaceWith(dynCheck('arrayBoundsCheck', o.loc, o, p));
      }
      path.skip();
    }
  },
  AssignmentExpression: {
    enter(path: NodePath<t.AssignmentExpression>, st: S) {
      const { operator: op, left, right } = path.node;
      if (left.type === 'Identifier') {
        if (!path.scope.hasBinding(left.name)) {
          st.elem.error(path,
            `You must declare variable '${left.name}' before assigning a value to it.`);
        }
      }
      if (!assignmentOperators.includes(op)) {
        st.elem.error(path, `Do not use the '${op}' operator.`);
      }
      if (!t.isIdentifier(left) && !t.isMemberExpression(left)) {
        st.elem.error(path, 'Do not use patterns');
        return;
      }

      if (op === '=') {
        return;
      }

      // Desugar everything that is not '='
      if (t.isIdentifier(left)) {
        path.replaceWith(t.assignmentExpression('=', left,
          t.binaryExpression(unassign(op), left, right)));
      } else {
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
                t.memberExpression(tmp, t.isUpdateExpression(left.property) ?
                  left.property.argument : left.property, left.computed),
                path.node.right))]));
      }
    },
    exit(path: NodePath<t.AssignmentExpression>, st: S) {
      const { left, right } = path.node;
      if (path.node.operator !== '=') {
        throw new Error('desugaring error');
      }
      if (!t.isIdentifier(left) && !t.isMemberExpression(left)) {
        throw new Error('syntactic check error');
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
          dynCheck('checkMember', left.object.loc, left.object, propertyAsString(left), right));
      }
      path.skip();
    }
  },
  LogicalExpression: { // logical expressions only has && and || as operators
    exit(path: NodePath<t.LogicalExpression>, st: S) {
      const operatorString = t.stringLiteral(path.node.operator);
      path.replaceWith(t.logicalExpression(
        path.node.operator,
        dynCheck('checkIfBoolean', path.node.left.loc, path.node.left, operatorString),
        dynCheck('checkIfBoolean', path.node.right.loc, path.node.right, operatorString)
      ));
      path.skip();
    }
  },
  BinaryExpression: {
    enter(path: NodePath<t.BinaryExpression>, st: S) {
      const op = path.node.operator;
      if (op === '==') {
        st.elem.error(path, `Do not use the '==' operator. Use '===' instead.`);
      } else if (op === '!=') {
        st.elem.error(path, `Do not use the '!=' operator. Use '!==' instead.`);
      } else if (!(allowedBinaryOperators.includes(op))) {
        st.elem.error(path, `Do not use the '${op}' operator.`);
      }
    },
    exit(path: NodePath<t.BinaryExpression>, st: S) {
      // Original: a + b
      const op = path.node.operator,
            opName = t.stringLiteral(op);
      if (numOrStringOperators.includes(op)) {
        // Transformed: applyNumOrStringOp('+', a, b);
        path.replaceWith(dynCheck('applyNumOrStringOp',
          path.node.loc,
          opName,
          path.node.left,
          path.node.right));
        path.skip();
      } else if (numOperators.includes(op)) {
        // Transformed: applyNumOp('+', a, b);
        path.replaceWith(dynCheck('applyNumOp',
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
      st.elem.error(path, `Do not use the '${path.node.operator}' operator.`);
    }
  },
  UpdateExpression: {
    enter(path: NodePath<t.UpdateExpression>, st: S) {
      if (path.node.prefix === false) {
        st.elem.error(path, 'Do not use post-increment or post-decrement operators.');
      }
    },
    exit(path: NodePath<t.UpdateExpression>, st: S) {
      const a = path.node.argument;
      if (a.type !== 'Identifier' && a.type !== 'MemberExpression') {
        throw new Error('not an l-value in update expression');
      }
      const opName = t.stringLiteral(path.node.operator);
      if (t.isIdentifier(a)) {
        // ++x ==> updateOnlyNumbers(++x), x
        const check = dynCheck('updateOnlyNumbers', path.node.loc, opName, a);
        path.replaceWith(t.sequenceExpression([check, path.node]));
      } else {
        // replace with dyn check function that takes in both obj and member.
        path.replaceWith(dynCheck('checkUpdateOperand',
          path.node.loc,
          opName,
          a.object,
          propertyAsString(a)));
      }
      path.skip();
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
      st.elem.error(path, 'for statement variable initialization must be present');
    }
    if (path.node.init !== null &&
      !t.isAssignmentExpression(path.node.init) &&
      !t.isVariableDeclaration(path.node.init)) {
      st.elem.error(path,
        'for statement variable initialization must be an assignment or a variable declaration');
    }
    if (path.node.test === null) {
      st.elem.error(path, 'for statement termination test must be present');
    }
    if (path.node.update === null) {
      st.elem.error(path, 'for statement update expression must be present');
    }
    if (!t.isBlockStatement(path.node.body)) {
      st.elem.error(path, 'Loop body must be enclosed in braces.');
    }
  },
  WhileStatement(path: NodePath<t.WhileStatement>, st: S) {
    if (!t.isBlockStatement(path.node.body)) {
      st.elem.error(path, 'Loop body must be enclosed in braces.');
    }
  },
  DoWhileStatement(path: NodePath<t.DoWhileStatement>, st: S) {
    if (!t.isBlockStatement(path.node.body)) {
      st.elem.error(path, 'Loop body must be enclosed in braces.');
    }
  },
  IfStatement: {
    enter(path: NodePath<t.IfStatement>, st: S) {
      if (!t.isBlockStatement(path.node.consequent) && path.node.alternate === null) {
        st.elem.error(path, 'if statement body must be enclosed in braces.');
      } else if (!t.isBlockStatement(path.node.consequent) &&
                  !t.isBlockStatement(path.node.alternate)) {
        st.elem.error(path, 'Body of if-else statement must be enclosed in braces.');
      }
    },
    exit(path: NodePath<t.IfStatement>, st: S) {
      // if (a) => if (checkIfBoolean(a))
      const a = path.node.test,
            check = dynCheck('checkIfBoolean', path.node.loc, a),
            consequent = path.node.consequent,
            alternate = path.node.alternate,
            replacement = t.ifStatement(check, consequent, alternate);
      replacement.loc = path.node.loc;
      path.replaceWith(replacement);
      path.skip();
    }
  },
  VariableDeclaration(path: NodePath<t.VariableDeclaration>, st: S) {
    // Arrow transform uses "var" declarations, we can skip over them instead
    if ((path.node as any)._generated && path.node.kind === 'var') {
      return;
    }
    if (path.node.kind !== 'let' && path.node.kind !== 'const') {
      st.elem.error(path, `Use 'let' or 'const' to declare a variable.`);
    }
    if (path.node.kind === 'const') {
      const names = path.node.declarations
        .map(x => lvalIds(x.id))
        .reduce((arr1, arr2) => arr1.concat(arr2), []);
      for (const x of names) {
        const violations = path.scope.bindings[x.name].constantViolations;
        if (violations.length > 0) {
          st.elem.error(violations[0], `variable is 'const'`);
        }
      }
    }
  },
  ThrowStatement(path: NodePath<t.ThrowStatement>, st: S) {
    st.elem.error(path, `Do not use the 'throw' operator.`);
  },
  WithStatement(path: NodePath<t.WithStatement>, st: S) {
    st.elem.error(path, `Do not use the 'with' statement.`);
  },
  ForOfStatement(path: NodePath<t.ForOfStatement>, st: S) {
    st.elem.error(path, 'Do not use for-of loops.');
  },
  ForInStatement(path: NodePath<t.ForInStatement>, st: S) {
    st.elem.error(path, 'Do not use for-in loops.');
  }
}

// Allows ElementaryJS to be used as a Babel plugin.
export function plugin(isSilent: boolean) {
  State.isSilent = isSilent;
  return function() { return { visitor: visitor }; };
}
