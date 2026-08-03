/**
 * JavaScriptEmitter.js - JavaScript Code Generator from JavaScript AST
 * Generates properly formatted JavaScript source code from JavaScriptAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: IL AST -> JS Transformer -> JS AST -> JS Emitter -> JS Source
 */

(function(global) {
  'use strict';

  // Load JavaScriptAST if available
  let JavaScriptAST;
  if (typeof require !== 'undefined') {
    JavaScriptAST = require('./JavaScriptAST.js');
  } else if (global.JavaScriptAST) {
    JavaScriptAST = global.JavaScriptAST;
  }

  /**
   * JavaScript Code Emitter
   * Generates formatted JavaScript code from a JavaScript AST
   */
  class JavaScriptEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '  ';
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
    }

    /**
     * Emit JavaScript code from a JavaScript AST node
     * @param {JavaScriptNode} node - The AST node to emit
     * @returns {string} Generated JavaScript code
     */
    emit(node) {
      if (!node) return '';

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `/* Unknown node type: ${node.nodeType} */`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    // ========================[ COMPILATION UNIT ]========================

    emitCompilationUnit(node) {
      let code = '';

      // Imports
      for (const imp of node.imports) {
        code += this.emit(imp);
      }
      if (node.imports.length > 0) {
        code += this.newline;
      }

      // Top-level statements (including classes and functions)
      for (const stmt of node.statements) {
        const emitted = this.emit(stmt);
        if (emitted) {
          code += emitted;
          // Add newline after top-level functions and classes
          if (stmt.nodeType === 'Method' || stmt.nodeType === 'Class') {
            code += this.newline;
          }
        }
      }

      // Exports
      for (const exp of node.exports) {
        code += this.emit(exp);
      }

      return code;
    }

    emitImportDeclaration(node) {
      let code = 'import ';

      if (node.defaultImport) {
        code += node.defaultImport;
        if (node.namedImports.length > 0 || node.namespaceImport) {
          code += ', ';
        }
      }

      if (node.namespaceImport) {
        code += `* as ${node.namespaceImport}`;
      } else if (node.namedImports.length > 0) {
        const names = node.namedImports.map(imp =>
          imp.alias ? `${imp.name} as ${imp.alias}` : imp.name
        );
        code += `{ ${names.join(', ')} }`;
      }

      code += ` from '${node.moduleName}';`;
      return this.line(code);
    }

    emitExportDeclaration(node) {
      let code = 'export ';
      if (node.isDefault) {
        code += 'default ';
      }
      code += this.emit(node.declaration);
      return code;
    }

    // ========================[ DECLARATIONS ]========================

    emitClass(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = '';
      if (node.isExported) decl += 'export ';
      decl += `class ${node.name}`;

      if (node.baseClass) {
        decl += ` extends ${this.emit(node.baseClass)}`;
      }

      code += this.line(decl + ' {');
      this.indentLevel++;

      for (const member of node.members) {
        code += this.emit(member);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitProperty(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = '';
      if (node.isStatic) decl += 'static ';

      decl += node.name;

      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      code += this.line(`${decl};`);
      return code;
    }

    emitMethod(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.kind === 'get') decl += 'get ';
      else if (node.kind === 'set') decl += 'set ';
      if (node.isAsync) decl += 'async ';
      if (node.isGenerator) decl += '*';

      decl += node.name;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      code += this.line(decl + ' {');
      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitFunction(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = '';
      if (node.isExported) decl += 'export ';
      if (node.isAsync) decl += 'async ';
      decl += 'function ';
      if (node.isGenerator) decl += '*';

      decl += node.name;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      code += this.line(decl + ' {');
      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitConstructor(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      let decl = `constructor(${params.join(', ')})`;

      code += this.line(decl + ' {');
      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitStaticBlock(node) {
      let code = this.line('static {');
      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitParameterDecl(node) {
      let decl = '';
      if (node.isRest) decl += '...';
      decl += node.name;
      if (node.defaultValue) {
        decl += ` = ${this.emit(node.defaultValue)}`;
      }
      return decl;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      return node.statements.map(s => this.emit(s)).join('');
    }

    emitVariableDeclaration(node) {
      let code = `${node.kind} ${node.name}`;
      if (node.initializer) {
        code += ` = ${this.emit(node.initializer)}`;
      }
      return this.line(`${code};`);
    }

    emitExpressionStatement(node) {
      // A statement that *starts* with `{` is parsed as a block statement,
      // not an expression — so a destructuring *assignment* (as opposed to
      // a `const`/`let` destructuring declaration) used as a bare statement,
      // e.g. `{ a, b } = someCall();`, must be parenthesized:
      // `({ a, b } = someCall());`. Without this, the emitted `{` opens what
      // JS parses as a block, `a: v[0]` inside it looks like a label
      // statement, and the next `,` is a syntax error ("Unexpected token
      // ':'"/"Unexpected token ','") — this was breaking every algorithm
      // using object-destructuring assignment as a standalone statement
      // (e.g. blake.js's `{ a: v[0], ... } = G1s_32(...)`).
      const expr = node.expression;
      if (expr && expr.nodeType === 'Assignment' && expr.target && expr.target.nodeType === 'ObjectLiteral') {
        return this.line(`(${this.emit(expr)});`);
      }
      return this.line(`${this.emit(node.expression)};`);
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line(`return ${this.emit(node.expression)};`);
      }
      return this.line('return;');
    }

    emitIf(node) {
      let code = this.line(`if (${this.emit(node.condition)}) {`);
      this.indentLevel++;

      if (node.thenBranch.nodeType === 'Block') {
        code += this.emit(node.thenBranch);
      } else {
        code += this.emit(node.thenBranch);
      }

      this.indentLevel--;
      code += this.line('}');

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          code = code.trimEnd() + ' else ';
          const elseIfCode = this.emit(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code += this.line('else {');
          this.indentLevel++;
          code += this.emit(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      let init = '';
      if (node.initializer) {
        // Handle array of variable declarations (for multi-variable: let i = 0, j = 10)
        if (Array.isArray(node.initializer)) {
          const decls = node.initializer;
          if (decls.length > 0 && decls[0].nodeType === 'VariableDeclaration') {
            const kind = decls[0].kind || 'let';
            const parts = decls.map(d => {
              let part = d.name;
              if (d.initializer) part += ` = ${this.emit(d.initializer)}`;
              return part;
            });
            init = `${kind} ${parts.join(', ')}`;
          } else {
            // Array of expressions (comma operator)
            init = decls.map(d => this.emit(d)).join(', ');
          }
        } else if (node.initializer.nodeType === 'VariableDeclaration') {
          init = `${node.initializer.kind} ${node.initializer.name}`;
          if (node.initializer.initializer) {
            init += ` = ${this.emit(node.initializer.initializer)}`;
          }
        } else {
          init = this.emit(node.initializer);
        }
      }

      const cond = node.condition ? this.emit(node.condition) : '';
      const incr = node.incrementor ? this.emit(node.incrementor) : '';

      let code = this.line(`for (${init}; ${cond}; ${incr}) {`);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitForOf(node) {
      // See JavaScriptAST's JavaScriptForOf.isForIn: this node doubles up
      // for both `for...of` (iterate values) and `for...in` (enumerate keys)
      // — pick the right keyword instead of always emitting `of`.
      const keyword = node.isForIn ? 'in' : 'of';
      let code = this.line(`for (const ${node.variableName} ${keyword} ${this.emit(node.collection)}) {`);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      let code = this.line(`while (${this.emit(node.condition)}) {`);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitDoWhile(node) {
      let code = this.line('do {');
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code = code.trimEnd();
      code += ` } while (${this.emit(node.condition)});${this.newline}`;
      return code;
    }

    emitSwitch(node) {
      let code = this.line(`switch (${this.emit(node.expression)}) {`);
      this.indentLevel++;

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitSwitchCase(node) {
      let code = '';
      if (node.isDefault) {
        code += this.line('default:');
      } else {
        code += this.line(`case ${this.emit(node.label)}:`);
      }

      this.indentLevel++;
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;

      return code;
    }

    emitBreak(node) {
      return this.line('break;');
    }

    emitContinue(node) {
      return this.line('continue;');
    }

    emitThrow(node) {
      return this.line(`throw ${this.emit(node.expression)};`);
    }

    emitTryCatch(node) {
      let code = this.line('try {');
      this.indentLevel++;
      code += this.emit(node.tryBlock);
      this.indentLevel--;
      code += this.line('}');

      for (const catchClause of node.catchClauses) {
        code += this.emit(catchClause);
      }

      if (node.finallyBlock) {
        code += this.line('finally {');
        this.indentLevel++;
        code += this.emit(node.finallyBlock);
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitCatchClause(node) {
      let code = 'catch';
      if (node.variableName) {
        code += ` (${node.variableName})`;
      }
      code += ' {';
      code = this.line(code);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'null') return 'null';
      if (node.literalType === 'undefined') return 'undefined';
      if (node.literalType === 'boolean') return node.value ? 'true' : 'false';
      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }
      if (node.literalType === 'bigint') {
        return `${node.value}n`;
      }
      if (node.literalType === 'regex') {
        return `/${node.pattern}/${node.flags || ''}`;
      }

      // Numeric literal
      return String(node.value);
    }

    emitIdentifier(node) {
      return node.name;
    }

    // ========================[ OPERATOR PRECEDENCE ]========================
    // Standard ECMA-262 binary/logical operator precedence table. Higher number
    // binds tighter. Used to re-insert only the parentheses that are actually
    // required to preserve semantics (minimal reparenthesization), since the
    // AST itself carries no source-text parens/grouping information.

    static OPERATOR_PRECEDENCE = {
      '??': 4,
      '||': 5,
      '&&': 6,
      '|': 7,
      '^': 8,
      '&': 9,
      '==': 10, '!=': 10, '===': 10, '!==': 10,
      '<': 11, '>': 11, '<=': 11, '>=': 11, 'instanceof': 11, 'in': 11,
      '<<': 12, '>>': 12, '>>>': 12,
      '+': 13, '-': 13,
      '*': 14, '/': 14, '%': 14,
      '**': 15
    };

    static RIGHT_ASSOCIATIVE_OPERATORS = new Set(['**']);
    static LOGICAL_OR_AND = new Set(['||', '&&']);

    /**
     * Precedence of an expression node, for deciding whether it needs parens
     * when nested inside a parent expression. Atomic/postfix constructs
     * (literals, identifiers, calls, member access, parenthesized, etc.) sit
     * at the top of the table and never need extra parens as a child.
     */
    getPrecedence(node) {
      if (!node) return 21;
      switch (node.nodeType) {
        case 'SequenceExpression':
          return 1;
        case 'Assignment':
        case 'YieldExpression':
        case 'ArrowFunction':
          return 2;
        case 'Conditional':
          return 3;
        case 'BinaryExpression': {
          const p = JavaScriptEmitter.OPERATOR_PRECEDENCE[node.operator];
          return p !== undefined ? p : 21;
        }
        case 'UnaryExpression':
          // Prefix unary/update (!x, -x, ++x) vs. postfix update (x++)
          return node.isPrefix ? 16 : 17;
        case 'AwaitExpression':
          return 16;
        default:
          // Calls, new, member/element access, literals, identifiers, this/super,
          // array/object literals, template literals, parenthesized expressions,
          // etc. are all atomic at the top of the precedence table.
          return 21;
      }
    }

    /**
     * Emit a child expression of a binary-ish parent, wrapping it in
     * parentheses when its own precedence is lower than the parent's (or
     * equal in a way that would change associativity/meaning if left bare).
     */
    emitOperand(child, parentPrecedence, isRightOperand, parentRightAssociative) {
      const code = this.emit(child);
      const childPrecedence = this.getPrecedence(child);

      const needsParens = parentRightAssociative
        ? (isRightOperand ? childPrecedence < parentPrecedence : childPrecedence <= parentPrecedence)
        : (isRightOperand ? childPrecedence <= parentPrecedence : childPrecedence < parentPrecedence);

      return needsParens ? `(${code})` : code;
    }

    emitBinaryExpression(node) {
      const parentPrecedence = this.getPrecedence(node);
      const rightAssociative = JavaScriptEmitter.RIGHT_ASSOCIATIVE_OPERATORS.has(node.operator);

      let leftCode = this.emitOperand(node.left, parentPrecedence, false, rightAssociative);
      let rightCode = this.emitOperand(node.right, parentPrecedence, true, rightAssociative);

      // ES2020 grammar forbids mixing '??' with an unparenthesized '||'/'&&'
      // operand (and vice versa), even though the precedence numbers above
      // would not otherwise call for parens.
      if (node.operator === '??') {
        if (node.left?.nodeType === 'BinaryExpression' && JavaScriptEmitter.LOGICAL_OR_AND.has(node.left.operator))
          leftCode = `(${this.emit(node.left)})`;
        if (node.right?.nodeType === 'BinaryExpression' && JavaScriptEmitter.LOGICAL_OR_AND.has(node.right.operator))
          rightCode = `(${this.emit(node.right)})`;
      } else if (JavaScriptEmitter.LOGICAL_OR_AND.has(node.operator)) {
        if (node.left?.nodeType === 'BinaryExpression' && node.left.operator === '??')
          leftCode = `(${this.emit(node.left)})`;
        if (node.right?.nodeType === 'BinaryExpression' && node.right.operator === '??')
          rightCode = `(${this.emit(node.right)})`;
      }

      // '**' cannot take an unparenthesized unary expression as its left operand
      // (`-2 ** 2` is a SyntaxError in JavaScript; `(-2) ** 2` is required).
      if (node.operator === '**' && node.left?.nodeType === 'UnaryExpression' && node.left.isPrefix)
        leftCode = `(${this.emit(node.left)})`;

      return `${leftCode} ${node.operator} ${rightCode}`;
    }

    emitUnaryExpression(node) {
      const parentPrecedence = this.getPrecedence(node);
      const operand = this.emitOperand(node.operand, parentPrecedence, false, false);

      if (node.operator === 'typeof' || node.operator === 'void' || node.operator === 'delete') {
        return `${node.operator} ${operand}`;
      }

      if (node.isPrefix) {
        // Avoid token-gluing ambiguity: -(-x) must not print as --x (decrement),
        // and +(+x) must not print as ++x (increment).
        const needsGap = (node.operator === '-' && operand.startsWith('-')) ||
                          (node.operator === '+' && operand.startsWith('+'));
        return needsGap ? `${node.operator} ${operand}` : `${node.operator}${operand}`;
      }
      return `${operand}${node.operator}`;
    }

    emitAssignment(node) {
      const parentPrecedence = this.getPrecedence(node);
      const target = this.emit(node.target);
      const value = this.emitOperand(node.value, parentPrecedence, true, true);
      return `${target} ${node.operator} ${value}`;
    }

    /**
     * Emit the target/callee of a member access, element access, or method call,
     * wrapping it in parentheses if it is not already an atomic (postfix-level)
     * expression — e.g. `(a + b).toString()` needs the parens the AST doesn't
     * otherwise record.
     */
    emitCalleeExpression(target) {
      const code = this.emit(target);
      return this.getPrecedence(target) < 21 ? `(${code})` : code;
    }

    emitMemberAccess(node) {
      const op = node.isOptional ? '?.' : '.';
      return `${this.emitCalleeExpression(node.target)}${op}${node.member}`;
    }

    emitElementAccess(node) {
      return `${this.emitCalleeExpression(node.target)}[${this.emit(node.index)}]`;
    }

    emitCall(node) {
      const args = node.arguments.map(a => this.emit(a));
      if (node.calleeExpression) {
        // Direct call of a callee *value* (IIFE): `(calleeExpression)(args)`.
        // Always parenthesize — required when the callee is itself a
        // function/arrow expression (`(function(){...})()`), and harmless
        // (if redundant) for any other expression shape.
        return `(${this.emit(node.calleeExpression)})(${args.join(', ')})`;
      }
      let code = '';
      if (node.target) {
        code += `${this.emitCalleeExpression(node.target)}.`;
      }
      code += node.methodName;
      code += `(${args.join(', ')})`;
      return code;
    }

    emitNew(node) {
      let code = `new ${node.className}`;
      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitArrayLiteral(node) {
      if (node.elements.length === 0) {
        return '[]';
      }
      const elements = node.elements.map(e => this.emit(e));
      return `[${elements.join(', ')}]`;
    }

    emitObjectLiteral(node) {
      if (node.properties.length === 0) {
        return '{}';
      }
      const props = node.properties.map(p => {
        // Handle spread properties: {...other}
        if (p.spread || p.key === '...') {
          return `...${this.emit(p.value)}`;
        }
        // Quote key if it's not a valid identifier
        const key = this.formatObjectKey(p.key);
        // Accessor property (`get key() {...}` / `set key(v) {...}`): emit
        // real getter/setter syntax instead of a plain `key: function(){}`
        // property — two properties sharing the same literal key name
        // (one for the getter, one for the setter) would otherwise silently
        // collide, with only the last one surviving on the object.
        if ((p.kind === 'get' || p.kind === 'set') && p.value && p.value.nodeType === 'ArrowFunction') {
          const params = `(${p.value.parameters.map(pm => this.emitParameterDecl(pm)).join(', ')})`;
          let body = ' {' + this.newline;
          this.indentLevel++;
          body += this.emit(p.value.body);
          this.indentLevel--;
          body += this.indent() + '}';
          return `${p.kind} ${key}${params}${body}`;
        }
        return `${key}: ${this.emit(p.value)}`;
      });
      return `{ ${props.join(', ')} }`;
    }

    /**
     * Format object key, quoting if necessary
     * @param {string} key - The object key
     * @returns {string} Properly formatted key
     */
    formatObjectKey(key) {
      // Keys aren't always strings (e.g. `{0: 'x'}` carries a numeric key) —
      // coerce up front so `.replace()` below never hits a non-string.
      key = String(key);
      // Check if key is a valid JavaScript identifier
      // Valid identifiers: start with letter, _, or $; contain only letters, digits, _, $
      const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
      if (validIdentifier.test(key)) {
        return key;
      }
      // Numeric keys (`{0: 'x'}` -> "0") are valid unquoted object-literal
      // keys in JavaScript too, distinct from identifier syntax.
      if (/^(?:0|[1-9][0-9]*)$/.test(key)) {
        return key;
      }
      // Quote the key, escaping any special characters
      const escaped = key
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    }

    emitConditional(node) {
      const parentPrecedence = this.getPrecedence(node);
      // The condition (test) must bind at least as tightly as the conditional
      // itself; the branches accept anything down to (and including)
      // assignment-level expressions, only a bare comma expression needs parens.
      const condition = this.emitOperand(node.condition, parentPrecedence, false, false);
      const trueCode = this.getPrecedence(node.trueExpression) < 2 ? `(${this.emit(node.trueExpression)})` : this.emit(node.trueExpression);
      const falseCode = this.getPrecedence(node.falseExpression) < 2 ? `(${this.emit(node.falseExpression)})` : this.emit(node.falseExpression);
      return `${condition} ? ${trueCode} : ${falseCode}`;
    }

    emitArrowFunction(node) {
      // A node originating from a real `function(...) {...}` expression
      // (as opposed to an actual arrow function) must keep `function`
      // syntax: arrows don't bind their own `this`/`arguments`, so emitting
      // e.g. an object-literal method `Feed: function(data) { this._x = ...; }`
      // as `Feed: data => { this._x = ...; }` silently rebinds `this` to
      // whatever's in scope where the object literal is constructed —
      // `undefined` here — turning `this._x` into a crash or no-op.
      if (node.isFunctionExpression) {
        const params = `(${node.parameters.map(p => this.emitParameterDecl(p)).join(', ')})`;
        let body = ' {' + this.newline;
        this.indentLevel++;
        body += this.emit(node.body);
        this.indentLevel--;
        body += this.indent() + '}';
        return `function ${params}${body}`;
      }

      let params;
      if (node.parameters.length === 1) {
        params = node.parameters[0].name;
      } else {
        params = `(${node.parameters.map(p => this.emitParameterDecl(p)).join(', ')})`;
      }

      let body;
      if (node.body.nodeType === 'Block') {
        body = ' {' + this.newline;
        this.indentLevel++;
        body += this.emit(node.body);
        this.indentLevel--;
        body += this.indent() + '}';
      } else if (node.body.nodeType === 'ObjectLiteral') {
        // An arrow function whose expression body is an object literal must be
        // parenthesized: `x => { a: 1 }` parses `{ a: 1 }` as a block
        // containing the labeled statement `a: 1`, not an object — silently
        // turning the arrow into a function that returns undefined (or, if the
        // "labels" aren't valid statements, a syntax error).
        body = `(${this.emit(node.body)})`;
      } else {
        body = this.emit(node.body);
      }

      return `${params} => ${body}`;
    }

    emitThis(node) {
      return 'this';
    }

    emitSuper(node) {
      return 'super';
    }

    emitParenthesized(node) {
      return `(${this.emit(node.expression)})`;
    }

    emitTemplateLiteral(node) {
      let result = '`';
      for (const part of node.parts) {
        result += part.text || '';
        if (part.expression) {
          result += '${' + this.emit(part.expression) + '}';
        }
      }
      result += '`';
      return result;
    }

    emitYieldExpression(node) {
      if (node.delegate) {
        return node.argument ? `yield* ${this.emit(node.argument)}` : 'yield*';
      }
      return node.argument ? `yield ${this.emit(node.argument)}` : 'yield';
    }

    emitChainExpression(node) {
      // Chain expressions just emit their inner expression
      // The optional chaining markers (?.) are handled by MemberAccess/ElementAccess/Call nodes
      return this.emit(node.expression);
    }

    emitSpreadElement(node) {
      return `...${this.emit(node.argument)}`;
    }

    emitAwaitExpression(node) {
      return `await ${this.emit(node.argument)}`;
    }

    emitDeleteExpression(node) {
      return `delete ${this.emit(node.argument)}`;
    }

    emitSequenceExpression(node) {
      const expressions = node.expressions.map(e => this.emit(e));
      return `(${expressions.join(', ')})`;
    }

    // ========================[ DOCUMENTATION ]========================

    emitJSDoc(node) {
      let code = this.line('/**');

      if (node.description) {
        for (const line of node.description.split('\n')) {
          code += this.line(` * ${line.trim()}`);
        }
      }

      for (const param of node.parameters) {
        let paramDoc = ` * @param {${param.type || '*'}} ${param.name}`;
        if (param.description) {
          paramDoc += ` ${param.description}`;
        }
        code += this.line(paramDoc);
      }

      if (node.returns) {
        let returnDoc = ` * @returns {${node.returns.type || '*'}}`;
        if (node.returns.description) {
          returnDoc += ` ${node.returns.description}`;
        }
        code += this.line(returnDoc);
      }

      for (const example of node.examples) {
        code += this.line(' * @example');
        code += this.line(` * ${example}`);
      }

      code += this.line(' */');
      return code;
    }
  }

  // Export
  const exports = { JavaScriptEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.JavaScriptEmitter = JavaScriptEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
