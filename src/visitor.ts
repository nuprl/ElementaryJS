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
 *       st.elem.error(<message>);
 *     // If the node is totally crazy and will break everything else, consider
 *     // using path.skip() to give up processing this part of the AST. You
 *     // can also use path.stop() to stop all further error-checks.
 *
 *     // If you are going to desugar this node, do it here and *do not*
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
import { CompileError, ElementarySyntaxError, Environment } from './types';

interface S { elem: State }

// This is the visitor state, which includes a list of errors.
// We throw this object if something goes wrong.
// Clients of ElementaryJS only rely on the CompileError interface.
export class State implements CompileError {
  public static ejsOff: boolean = false;

  // Allows clients to discriminate between CompileError and CompileResult.
  public kind: 'error' = 'error';
  public inConstructor: boolean = false;
  public inConstructorStack: boolean[] = [];

  constructor(public errors: ElementarySyntaxError[]) {}

  // Convenience method to add a new error
  public error(path: NodePath<t.Node>, message: string): void {
    this.errors.push({ line: path.node.loc.start.line, message });
  }

  // Convenience: object prints reasonably for debugging the implementation of ElementaryJS.
  public toString(): string {
    return this.errors.length === 0 ? 'class State in ElementaryJS with no errors' :
      this.errors.map(x => `- ${x.message} (line ${x.line})`).join('\n');
  }
}

class EnvironmentList {
  private list: (Environment | null)[][];
  private rootIf: Environment[];
  private rootSw: Environment[];

  constructor(e: Environment[]) {
    if (e.length !== 1) {
      throw Error('EnvironmentList: Global environment must be of size 1.');
    }
    this.list = [e];
    this.rootIf = [];
    this.rootSw = [];
  }

  private peek(): number {
    for (var i: number = this.list.length - 1;
      i > 0 && this.list[i].every(e => !e); i--) {}
    return i;
  }

  private pushIndex(): number {
    for (var i: number = this.list.length - 1;
      i > 0 && this.list[i].every(e => e); i--) {}
    return i;
  }

  private setA(s: Set<t.Identifier>, id: t.Identifier): void {
    if (s.has(id)) {
      throw Error(`EnvironmentList.prototype.setA: Identifier ${id} already in ${s}.`);
    }
    s.add(id);
  }

  private setI(s1: Set<t.Identifier>, s2: Set<t.Identifier>): Set<t.Identifier> {
    const i: Set<t.Identifier> = new Set();
    for (const id of s1) {
      if (s2.has(id)) {
        i.add(id);
      }
    }
    return i;
  }

  private setU(s1: Set<t.Identifier>, s2: Set<t.Identifier>): Set<t.Identifier> {
    const u: Set<t.Identifier> = new Set(s1);
    for (const id of s2) {
      u.add(id);
    }
    return u;
  }

  private squashIndex(): number {
    return this.list[this.list.length - 1].findIndex(e => !e) < 0 ? 0 :
      this.list[this.list.length - 1].findIndex(e => !e);
  }

  public addI(id: t.Identifier): void {
    this.setA(this.peekEnvironment().I, id);
  }

  public addU(id: t.Identifier): void {
    this.setA(this.peekEnvironment().U, id);
  }

  public peekEnvironment(): Environment {
    const e: (Environment | null)[] = this.list[this.peek()];
    for (var i: number = e.length - 1; !e[i]; i--) {}
    return e[i]!;
  }

  public pushEnvironment(name: string): void {
    const i: number = this.pushIndex();
    if (i && (name === 'IfStatement' || name === 'SwitchCase')) {
      const E: (Environment | null)[] = this.list[i],
            j: number = E.findIndex(_e => !_e),
            e: Environment = name === 'IfStatement' ?
              this.rootIf[this.rootIf.length - 1] : this.rootSw[this.rootSw.length - 1];
      this.list[i][j] = {
        name,
        I: new Set(e.I),
        U: new Set(e.U)
      };
    } else {
      this.list.push([{
        name,
        I: new Set(this.peekEnvironment().I),
        U: new Set(this.peekEnvironment().U)
      }]);
    }
  }

  public pushNull(e: null[], name: string): void {
    this.list.push(e);
    if (name === 'SwitchStatement') {
      this.rootSw.push(this.peekEnvironment());
    } else if (name !== 'IfStatement') {
      this.rootIf.push(this.peekEnvironment());
    }
  }

  public popList(): void {
    if (!this.list.pop()) {
      throw Error('EnvironmentList.prototype.popList: Environment list is empty.');
    } else if (!this.list.length) {
      throw Error('EnvironmentList.prototype.popList: Popped global environment.');
    }
  }

  public popRoot(isIf: boolean): void {
    if (isIf && !this.rootIf.pop()) {
      throw Error('EnvironmentList.prototype.popRoot: If root environment list is empty.');
    } else if (!isIf && !this.rootSw.pop()) {
      throw Error('EnvironmentList.prototype.popRoot: Switch root environment list is empty.');
    }
  }

  public squash(isIf: boolean = false, name?: string): void {
    if (this.list[this.list.length - 1].includes(null)) {
      this.popList();
    } else {
      const toSquash: (Environment | null)[] = this.list.pop()!,
            env: Environment | null = isIf ?
              this.list[this.list.length - 1][this.squashIndex()] : this.peekEnvironment();

      let iSet: Set<t.Identifier> = new Set(toSquash[0]!.I),
          uSet: Set<t.Identifier> = new Set(toSquash[0]!.U);

      if (toSquash.length > 1) {
        for (let i = 1; i < toSquash.length; i++) {
          iSet = this.setI(iSet, new Set(toSquash[i]!.I));
          uSet = this.setU(uSet, new Set(toSquash[i]!.U));
        }
      }
      if (env) {
        iSet.forEach(id => {
          if (env.I.has(id) && env.U.has(id)) {
            throw Error('EnvironmentList.prototype.squash: ID found in both sets.');
          }
          if (!env.I.has(id) && !env.U.has(id)) { iSet.delete(id); }
        });
        uSet.forEach(id => {
          if (env.I.has(id) && env.U.has(id)) {
            throw Error('EnvironmentList.prototype.squash: ID found in both sets.');
          }
          // Checking the just the U set would be sufficient here.
          if (!env.I.has(id) && !env.U.has(id)) { uSet.delete(id); }
        });

        env.I = iSet; env.U = uSet;
      } else {
        this.list[this.list.length - 1][this.squashIndex()] = {
          name: name || '<empty>',
          I: iSet,
          U: uSet
        };
      }
    }
  }

  public swap(id: t.Identifier): void {
    const envU: Set<t.Identifier> = this.peekEnvironment().U,
          envI: Set<t.Identifier> = this.peekEnvironment().I;

    if (!envU.has(id)) { // Redundant; we check if an ID is in U before call.
      throw Error(`EnvironmentList.prototype.swap: Identifier ${id} cannot be found in ${envU}.`);
    } else if (envI.has(id)) {
      throw Error(`EnvironmentList.prototype.swap: Identifier ${id} already in ${envI}.`);
    } else {
      envU.delete(id);
      envI.add(id);
    }
  }
}

const assignmentOperators: string[] = ['=', '+=', '-=', '*=', '/=', '%='],
      comparisonOperators: string[] = ['===', '!=='],
      numOperators: string[] = ['<=', '>=', '<', '>', '<<', '>>', '>>>', '-', '*', '/', '%', '&', '|', '^'],
      numOrStringOperators: string[] = ['+'],
      allowedBinaryOperators: string[] = comparisonOperators.concat(numOrStringOperators, numOperators);
let envList: EnvironmentList; // Initialized on AST entrance (i.e., Visitor.Program.enter).

function dynCheck(name: string, loc: t.SourceLocation, ...args: t.Expression[]): t.CallExpression {
  args.push(t.numericLiteral(loc.start.line)); // line numb is last arg to any dyn check
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
      envList = new EnvironmentList([{
        name: path.node.type,
        I: new Set(),
        U: new Set()
      }]);
      // Insert 'use strict' if needed
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
        if (State.ejsOff) {
          console.warn( // tslint:disable-line:no-console
            `${l} EJS COMPILETIME ERROR${l > 1 ? 'S': '' } SUPPRESSED:\n${st.elem.toString()}`);
        } else {
          throw st.elem;
        }
      }
    }
  },
  Function: {
    enter(path: NodePath<t.Function>, st: S) {
      if (path.node.params.length &&
          t.isRestElement(path.node.params[path.node.params.length - 1])) {
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
      st.elem.error(path, 'Do not use destructuring patterns.');
      return;
    }
    // NOTE(joseph): Here we have: (getOwnBindingIdentifier === getBindingIdentifier === path.node.id).
    t.isExpression(path.node.init) ? envList.addI(path.node.id) : envList.addU(path.node.id);
  },
  CallExpression: {
    exit(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      if (!t.isMemberExpression(callee) || callee.computed || !t.isIdentifier(callee.property)) {
        return;
      }
      const o = callee.object,
            p = callee.property;
      if (p.name === 'split' || // string split
          t.isIdentifier(o) && o.name === 'Object' && // Cases where `Object.<x>` returns an [].
          (p.name === 'getOwnPropertyNames' || p.name === 'entries' ||
            p.name === 'values' || p.name === 'keys')) {
        path.replaceWith(dynCheck('checkCall', path.node.loc, o, propertyAsString(callee),
          t.arrayExpression(path.node.arguments)));
        path.skip();
      }
    }
  },
  ObjectExpression(path: NodePath<t.ObjectExpression>, st: S) {
    const propertyNames = new Set();
    for (let i = 0; i < path.node.properties.length; ++i) {
      const prop = path.node.properties[i];
      if (t.isObjectProperty(prop)) {
        if (!t.isIdentifier(prop.key)) {
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
      // Some stupid cases to skip: `o.x = v` and `++o.x`.
      // In these cases, the l-value is a MemberExpression.
      // We tackle these in the AssignmentExpression and UpdateExpression cases.
      if ((t.isUpdateExpression(parent) && parent.argument === path.node) ||
          (t.isAssignmentExpression(parent) && parent.left === path.node)) {
        return;
      }
      const o = path.node.object,
            p = path.node.property;
      if (path.node.computed) {
        path.replaceWith(dynCheck('arrayBoundsCheck', o.loc, o, p));
        path.skip();
        return;
      }
      // path.node.computed is false onwards
      if (!t.isIdentifier(p)) {
        // This should never happen.
        throw new Error(`ElementaryJS expected id. in MemberExpression`);
      }
      if (t.isCallExpression(parent) && parent.callee === path.node) {
        // This MemberExpression is the callee in a CallExpression, i.e., obj.method(...).
        // We can simply leave this intact.
        // JS will throw a reasonable error message if obj.method is not a function.
        return;
      }
      path.replaceWith(dynCheck('dot', p.loc, o, t.stringLiteral(p.name)));
      path.skip();
    }
  },
  AssignmentExpression: {
    enter(path: NodePath<t.AssignmentExpression>, st: S) {
      const { operator: op, left, right } = path.node;
      if (t.isIdentifier(left) && !path.scope.hasBinding(left.name)) {
        st.elem.error(path,
          `You must declare variable '${left.name}' before assigning a value to it.`);
      }
      if (!assignmentOperators.includes(op)) {
        st.elem.error(path, `Do not use the '${op}' operator.`);
      }
      if (!t.isIdentifier(left) && !t.isMemberExpression(left)) {
        st.elem.error(path, 'Do not use patterns');
        return;
      } else if (t.isLogicalExpression(path.parent)
        || t.isBinaryExpression(path.parent) || t.isUnaryExpression(path.parent)
        || t.isConditionalExpression(path.parent) || t.isIfStatement(path.parent)
        // Since we require braces, the following checks are sufficient.
        || t.isWhileStatement(path.parent) || t.isDoWhileStatement(path.parent)
        || t.isSwitchStatement(path.parent) || t.isSwitchCase(path.parent)) {
        st.elem.error(path, 'Forbidden assignment expression');
        return;
      } else if (op === '=') {
        return; // Desugar everything that is not '='
      }

      // We have to manually assign the `loc` obj for potential future dyn checks.
      if (t.isIdentifier(left)) {
        if (envList.peekEnvironment().U.has(path.scope.getBindingIdentifier(left.name))) {
          st.elem.error(path, `You must initialize the variable '${left.name}' before use.`);
        }
        const a = t.assignmentExpression('=', left,
                    t.binaryExpression(unassign(op), left, right));
        a.right.loc = right.loc;
        path.replaceWith(a);
      } else { // exp.x += rhs => tmp = exp, tmp.x = tmp.x + rhs
        const tmp = path.scope.generateUidIdentifier('tmp'),
              a1 = t.assignmentExpression('=', tmp, left.object),
              a2 = t.assignmentExpression('=',
                t.memberExpression(tmp, left.property, left.computed),
                t.binaryExpression(unassign(op),
                  t.memberExpression(tmp, t.isUpdateExpression(left.property) ?
                    left.property.argument : left.property, left.computed),
                  path.node.right));

        enclosingScopeBlock(path).push(
          t.variableDeclaration('var', [t.variableDeclarator(tmp)]));
        a1.left.loc = left.loc;
        a2.right.loc = right.loc;
        path.replaceWith(t.sequenceExpression([a1, a2]));
      }
    },
    exit(path: NodePath<t.AssignmentExpression>, st: S) {
      const { left, right } = path.node;
      if (path.node.operator !== '=') {
        throw new Error('desugaring error');
      } else if (!t.isIdentifier(left) && !t.isMemberExpression(left)) {
        throw new Error('syntactic check error');
      } else if (t.isIdentifier(left)) {
        if (envList.peekEnvironment().U.has(path.scope.getBindingIdentifier(left.name))) {
          envList.swap(path.scope.getBindingIdentifier(left.name));
        }
        return;
      } else if (st.elem.inConstructor && left.object.type === 'ThisExpression') {
        return;
      } else if (left.computed) { // exp[x] = rhs => checkArray(exp, x, rhs)
        path.replaceWith(
          dynCheck('checkArray', left.object.loc, left.object, left.property, right));
      } else { // exp.x = rhs => checkMember(exp, 'x', rhs)
        path.replaceWith(
          dynCheck('checkMember', left.object.loc, left.object, propertyAsString(left), right));
      }
      path.skip();
    }
  },
  LogicalExpression: { // logical expressions only have '&&' and '||' as operators
    exit(path: NodePath<t.LogicalExpression>, st: S) {
      const l = path.node.left,
            r = path.node.right,
            opStr = t.stringLiteral(path.node.operator),
            newNode = t.logicalExpression(path.node.operator,
              dynCheck('checkIfBoolean', l.loc, l, opStr),
              dynCheck('checkIfBoolean', r.loc, r, opStr));
      newNode.loc = path.node.loc; // In case of >= 3 in 1 expression.
      path.replaceWith(newNode);
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
      // Original: a <op> b
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
        // Transformed: applyNumOp('*', a, b);
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
    if (path.node.operator === 'delete') {
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
      if (!t.isIdentifier(a) && !t.isMemberExpression(a)) {
        throw new Error('not an l-value in update expression');
      }
      const opName = t.stringLiteral(path.node.operator);
      if (t.isIdentifier(a)) {
        // ++x ==> updateOnlyNumbers(++x), x
        path.replaceWith(t.sequenceExpression([
          dynCheck('updateOnlyNumbers', path.node.loc, opName, a),
          path.node]));
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
    if (t.isBreakStatement(path.parent) || t.isContinueStatement(path.parent) ||
        t.isLabeledStatement(path.parent)) {
      return;
    }

    if (path.node.name === 'Array') {
      path.replaceWith(t.memberExpression(t.identifier('rts'), path.node, false));
      path.skip();
    } else if (envList.peekEnvironment().U.has(path.scope.getBindingIdentifier(path.node.name))) {
      st.elem.error(path, `You must initialize the variable '${path.node.name}' before use.`);
    }
  },
  ForStatement: {
    enter(path: NodePath<t.ForStatement>, st: S) {
      if (path.node.init === null) {
        st.elem.error(path, 'for statement variable initialization must be present');
      }
      if (path.node.init !== null &&
          !t.isAssignmentExpression(path.node.init) &&
          !t.isVariableDeclaration(path.node.init)) {
        st.elem.error(path,
          'for statement variable initialization must be an assignment or a variable declaration');
      }
      if (path.node.test === null || t.isAssignmentExpression(path.node.test)) {
        st.elem.error(path,
          'for statement termination test must be present and cannot be an assignment expression');
      }
      if (path.node.update === null) {
        st.elem.error(path, 'for statement update expression must be present');
      }
      if (!t.isBlockStatement(path.node.body)) {
        st.elem.error(path, 'Loop body must be enclosed in braces.');
      }
    },
    exit(path: NodePath<t.ForStatement>, st: S) {
      const check = dynCheck('checkIfBoolean', path.node.loc, path.node.test ||
              t.nullLiteral(), t.nullLiteral()),
            body = t.isBlockStatement(path.node.body) ?
              path.node.body : t.blockStatement([path.node.body]),
            replacement = t.forStatement(path.node.init, check, path.node.update, body);
      replacement.loc = path.node.loc;
      path.replaceWith(replacement);
      path.skip();
    }
  },
  WhileStatement: {
    enter(path: NodePath<t.WhileStatement>, st: S) {
      if (!t.isBlockStatement(path.node.body)) {
        st.elem.error(path, 'Loop body must be enclosed in braces.');
      }
    },
    exit(path: NodePath<t.WhileStatement>, st: S) {
      const check = dynCheck('checkIfBoolean', path.node.loc, path.node.test, t.nullLiteral()),
            body = t.isBlockStatement(path.node.body) ?
              path.node.body : t.blockStatement([path.node.body]),
            replacement = t.whileStatement(check, body);
      replacement.loc = path.node.loc;
      path.replaceWith(replacement);
      path.skip();
    }
  },
  DoWhileStatement: {
    enter(path: NodePath<t.DoWhileStatement>, st: S) {
      if (!t.isBlockStatement(path.node.body)) {
        st.elem.error(path, 'Loop body must be enclosed in braces.');
      }
    },
    exit(path: NodePath<t.WhileStatement>, st: S) {
      const check = dynCheck('checkIfBoolean', path.node.loc, path.node.test, t.nullLiteral()),
            body = t.isBlockStatement(path.node.body) ?
              path.node.body : t.blockStatement([path.node.body]),
            replacement = t.doWhileStatement(check, body);
      replacement.loc = path.node.loc;
      path.replaceWith(replacement);
      path.skip();
    }
  },
  IfStatement: {
    enter(path: NodePath<t.IfStatement>, st: S) {
      if (!t.isBlockStatement(path.node.consequent) || path.node.alternate &&
          !t.isBlockStatement(path.node.alternate) && !t.isIfStatement(path.node.alternate)) {
        st.elem.error(path, 'All branches of an if-statement must be enclosed in braces.');
        path.skip();
      }
      /*
        Yes, this else-if is very bad.
        However, `path.skip` in the exit node is not working as intended.
        This was first seen in the fix for #171.
        Needs more investigation...
      */
      else if (!t.isCallExpression(path.node.test) ||
          !t.isMemberExpression(path.node.test.callee) ||
          !t.isIdentifier(path.node.test.callee.object) ||
          !t.isIdentifier(path.node.test.callee.property) ||
          path.node.test.callee.object.name !== 'rts' ||
          path.node.test.callee.property.name !== 'checkIfBoolean') {
        envList.pushNull([null, null], path.parent.type);
      }
    },
    exit(path: NodePath<t.IfStatement>, st: S) {
      path.node.alternate ? (t.isIfStatement(path.parent) ? envList.squash(true) :
        envList.squash()) : envList.popList();
      !t.isIfStatement(path.parent) && envList.popRoot(true);
      // if (a) => if (checkIfBoolean(a))
      const check = dynCheck('checkIfBoolean', path.node.loc, path.node.test, t.nullLiteral()),
            consequent = t.isBlockStatement(path.node.consequent) ?
              path.node.consequent : t.blockStatement([path.node.consequent]),
            alternate = path.node.alternate && (t.isBlockStatement(path.node.alternate) ?
              path.node.alternate : t.blockStatement([path.node.alternate])),
            replacement = t.ifStatement(check, consequent, alternate);
      replacement.loc = path.node.loc;
      path.replaceWith(replacement);
      path.skip();
    }
  },
  VariableDeclaration(path: NodePath<t.VariableDeclaration>, st: S) {
    // Arrow transform uses 'var' declarations, we can skip over them instead
    if ((path.node as any)._generated && path.node.kind === 'var') {
      path.skip();
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
  BlockStatement: {
    enter(path: NodePath<t.BlockStatement>, st: S) {
      envList.pushEnvironment(path.parent.type);
    },
    exit(path: NodePath<t.BlockStatement>, st: S) {
      if (t.isProgram(path.parent) || t.isBlockStatement(path.parent) ||
          t.isDoWhileStatement(path.parent)) {
        envList.squash();
      } else if (!t.isSwitchCase(path.parent) && !t.isIfStatement(path.parent)) {
        envList.popList();
      }
    }
  },
  SwitchStatement: {
    enter(path: NodePath<t.SwitchStatement>, st: S) {
      envList.pushNull((new Array(path.node.cases.filter(c =>
        c.consequent.length).length)).fill(null), path.node.type);
    },
    exit(path: NodePath<t.SwitchStatement>, st: S) {
      path.node.cases.some(c => !c.test) ? envList.squash() : envList.popList();
      envList.popRoot(false);
    }
  },
  SwitchCase(path: NodePath<t.SwitchCase>, st: S) {
    if (path.node.consequent.length > 1 || path.node.consequent.length === 1 &&
        !t.isBlockStatement(path.node.consequent[0])) {
      st.elem.error(path, `If a switch case is not empty then it must be in braces.`);
    }
  },
  TryStatement(path: NodePath<t.TryStatement>, st: S) {
    st.elem.error(path, `The try-catch statment is not supported.`);
    path.skip();
  },
  ThrowStatement(path: NodePath<t.ThrowStatement>, st: S) {
    st.elem.error(path, `Do not use the 'throw' operator.`);
    path.skip();
  },
  WithStatement(path: NodePath<t.WithStatement>, st: S) {
    st.elem.error(path, `Do not use the 'with' statement.`);
    path.skip();
  },
  ForOfStatement(path: NodePath<t.ForOfStatement>, st: S) {
    st.elem.error(path, 'Do not use for-of loops.');
    path.skip();
  },
  ForInStatement(path: NodePath<t.ForInStatement>, st: S) {
    st.elem.error(path, 'Do not use for-in loops.');
    path.skip();
  }
};

// Allows ElementaryJS to be used as a Babel plugin.
export function plugin(ejsOff: boolean) {
  State.ejsOff = ejsOff;
  return function() { return { visitor: visitor }; };
}
