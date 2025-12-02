/**
 * PythonEmitter.js - Python Code Generator from Python AST
 * Generates properly formatted Python source code from PythonAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Python AST -> Python Emitter -> Python Source
 */

(function(global) {
  'use strict';

  // Load PythonAST if available
  let PythonAST;
  if (typeof require !== 'undefined') {
    PythonAST = require('./PythonAST.js');
  } else if (global.PythonAST) {
    PythonAST = global.PythonAST;
  }

  /**
   * Python Code Emitter
   * Generates formatted Python code from a Python AST
   */
  class PythonEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '    '; // 4 spaces per PEP 8
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
      this.addTypeHints = options.addTypeHints !== undefined ? options.addTypeHints : true;
      this.addDocstrings = options.addDocstrings !== undefined ? options.addDocstrings : true;
    }

    /**
     * Emit Python code from a Python AST node
     * @param {PythonNode} node - The AST node to emit
     * @returns {string} Generated Python code
     */
    emit(node) {
      if (!node) return '';

      // Handle plain strings (shouldn't happen in proper AST pipeline)
      if (typeof node === 'string') {
        console.error('[ERROR] emit() received plain string instead of AST node');
        console.error('  String:', JSON.stringify(node.substring(0, 100)));
        return node; // Pass through legacy formatted strings
      }

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `# Unknown node type: ${node.nodeType}`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    // ========================[ MODULE ]========================

    emitModule(node) {
      let code = '';

      // Module docstring (only if addDocstrings is enabled)
      if (this.addDocstrings && node.docstring) {
        code += this.line(`"""${node.docstring}"""`);
        code += this.newline;
      }

      // Imports
      for (const imp of node.imports) {
        code += this.emit(imp);
      }
      if (node.imports.length > 0) {
        code += this.newline;
      }

      // Statements
      for (let i = 0; i < node.statements.length; i++) {
        code += this.emit(node.statements[i]);
        // Add blank line between top-level definitions
        if (i < node.statements.length - 1) {
          const current = node.statements[i];
          const next = node.statements[i + 1];
          if ((current.nodeType === 'Class' || current.nodeType === 'Function') &&
              (next.nodeType === 'Class' || next.nodeType === 'Function')) {
            code += this.newline;
          }
        }
      }

      return code;
    }

    emitImport(node) {
      if (node.isFromImport) {
        const items = node.items.map(item =>
          item.alias ? `${item.name} as ${item.alias}` : item.name
        ).join(', ');
        return this.line(`from ${node.module} import ${items}`);
      } else {
        if (node.alias) {
          return this.line(`import ${node.module} as ${node.alias}`);
        }
        return this.line(`import ${node.module}`);
      }
    }

    // ========================[ CLASS ]========================

    emitClass(node) {
      let code = '';

      // Class definition
      let classDef = `class ${node.name}`;
      if (node.baseClasses.length > 0) {
        classDef += `(${node.baseClasses.join(', ')})`;
      }
      classDef += ':';
      code += this.line(classDef);

      this.indentLevel++;

      // Docstring (only if addDocstrings is enabled)
      if (this.addDocstrings && node.docstring) {
        code += this.line(`"""${node.docstring}"""`);
        code += this.newline;
      }

      // Class variables
      for (const classVar of node.classVariables) {
        code += this.emit(classVar);
      }
      if (node.classVariables.length > 0 && node.methods.length > 0) {
        code += this.newline;
      }

      // Methods
      for (let i = 0; i < node.methods.length; i++) {
        code += this.emit(node.methods[i]);
        if (i < node.methods.length - 1) {
          code += this.newline;
        }
      }

      // Empty class needs pass
      if (node.methods.length === 0 && node.classVariables.length === 0) {
        code += this.line('pass');
      }

      this.indentLevel--;
      return code;
    }

    // ========================[ FUNCTION ]========================

    emitFunction(node) {
      let code = '';

      // Decorators
      for (const decorator of node.decorators) {
        code += this.line(`@${decorator}`);
      }

      // Function signature
      let funcDef = node.isAsync ? 'async def ' : 'def ';
      funcDef += `${node.name}(`;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      funcDef += params.join(', ');
      funcDef += ')';

      // Return type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && node.returnType) {
        funcDef += ` -> ${node.returnType.toString()}`;
      }

      funcDef += ':';
      code += this.line(funcDef);

      // Body
      this.indentLevel++;

      // Docstring (only if addDocstrings is enabled)
      if (this.addDocstrings && node.docstring) {
        code += this.line(`"""${node.docstring}"""`);
      }

      // Function body
      if (node.body && node.body.statements.length > 0) {
        code += this.emit(node.body);
      } else {
        code += this.line('pass');
      }

      this.indentLevel--;
      return code;
    }

    emitParameterDecl(node) {
      let param = node.name;
      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && node.type) {
        param += `: ${node.type.toString()}`;
      }
      if (node.defaultValue) {
        param += ` = ${this.emit(node.defaultValue)}`;
      }
      return param;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = '';
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      return code;
    }

    emitAssignment(node) {
      const target = this.emit(node.target);
      const value = this.emit(node.value);

      let code = target;

      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && node.type && node.operator === '=') {
        code += `: ${node.type.toString()}`;
      }

      code += ` ${node.operator} ${value}`;
      return this.line(code);
    }

    emitExpressionStatement(node) {
      if (typeof node.expression === 'string') {
        console.error('[ERROR] ExpressionStatement contains string instead of AST node!');
        console.error('  String value:', JSON.stringify(node.expression.substring(0, 100)));
        return node.expression;
      }

      // For Assignment expressions, emit directly since emitAssignment already adds the line
      if (node.expression && node.expression.nodeType === 'Assignment') {
        return this.emitAssignment(node.expression);
      }

      const expr = this.emit(node.expression);
      return this.line(expr);
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line(`return ${this.emit(node.expression)}`);
      }
      return this.line('return');
    }

    emitIf(node) {
      let code = this.line(`if ${this.emit(node.condition)}:`);

      this.indentLevel++;
      const thenStatements = node.thenBranch?.statements || [];
      if (thenStatements.length > 0) {
        code += this.emit(node.thenBranch);
      } else {
        code += this.line('pass');
      }
      this.indentLevel--;

      // elif branches
      const elifBranches = node.elifBranches || [];
      for (const elifBranch of elifBranches) {
        code += this.line(`elif ${this.emit(elifBranch.condition)}:`);
        this.indentLevel++;
        const elifStatements = elifBranch.body?.statements || [];
        if (elifStatements.length > 0) {
          code += this.emit(elifBranch.body);
        } else {
          code += this.line('pass');
        }
        this.indentLevel--;
      }

      // else branch
      if (node.elseBranch) {
        code += this.line('else:');
        this.indentLevel++;
        const elseStatements = node.elseBranch?.statements || [];
        if (elseStatements.length > 0) {
          code += this.emit(node.elseBranch);
        } else {
          code += this.line('pass');
        }
        this.indentLevel--;
      }

      return code;
    }

    emitFor(node) {
      // Emit the variable - it could be an Identifier node or already a string
      const varStr = typeof node.variable === 'string' ? node.variable : this.emit(node.variable);
      let code = this.line(`for ${varStr} in ${this.emit(node.iterable)}:`);

      this.indentLevel++;
      const bodyStatements = node.body?.statements || [];
      if (bodyStatements.length > 0) {
        code += this.emit(node.body);
      } else {
        code += this.line('pass');
      }
      this.indentLevel--;

      return code;
    }

    emitWhile(node) {
      let code = this.line(`while ${this.emit(node.condition)}:`);

      this.indentLevel++;
      const bodyStatements = node.body?.statements || [];
      if (bodyStatements.length > 0) {
        code += this.emit(node.body);
      } else {
        code += this.line('pass');
      }
      this.indentLevel--;

      return code;
    }

    emitBreak(node) {
      return this.line('break');
    }

    emitContinue(node) {
      return this.line('continue');
    }

    emitRaise(node) {
      return this.line(`raise ${this.emit(node.exception)}`);
    }

    emitTryExcept(node) {
      let code = this.line('try:');

      this.indentLevel++;
      code += this.emit(node.tryBlock);
      this.indentLevel--;

      for (const exceptClause of node.exceptClauses) {
        code += this.emit(exceptClause);
      }

      if (node.finallyBlock) {
        code += this.line('finally:');
        this.indentLevel++;
        code += this.emit(node.finallyBlock);
        this.indentLevel--;
      }

      return code;
    }

    emitExceptClause(node) {
      let code = 'except';
      if (node.exceptionType) {
        code += ` ${node.exceptionType}`;
        if (node.variableName) {
          code += ` as ${node.variableName}`;
        }
      }
      code += ':';
      code = this.line(code);

      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;

      return code;
    }

    emitPass(node) {
      return this.line('pass');
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'None') return 'None';
      if (node.literalType === 'bool') return node.value ? 'True' : 'False';
      if (node.literalType === 'str') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }
      if (node.literalType === 'bytes') {
        return `b"${node.value}"`;
      }
      if (node.literalType === 'hex') {
        return `0x${node.value.toString(16).toUpperCase()}`;
      }
      return String(node.value);
    }

    emitFString(node) {
      // Emit Python f-string: f"text {expr} text {expr} ..."
      let result = 'f"';
      for (let i = 0; i < node.parts.length; ++i) {
        // Escape the string part
        const part = (node.parts[i] || '')
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\{/g, '{{')   // Escape literal braces in f-strings
          .replace(/\}/g, '}}');
        result += part;
        if (i < node.expressions.length) {
          const expr = this.emit(node.expressions[i]);
          result += `{${expr}}`;
        }
      }
      result += '"';
      return result;
    }

    emitIdentifier(node) {
      if (typeof node === 'string') {
        console.error('[ERROR] emitIdentifier received string:', JSON.stringify(node.substring(0, 100)));
        return node;
      }
      if (!node.name) {
        console.error('[ERROR] emitIdentifier node has no name property:', node);
        return 'INVALID_IDENTIFIER';
      }
      if (node.name.includes('\n') || node.name.match(/^\s+/)) {
        console.error('[ERROR] Identifier name contains formatting:', JSON.stringify(node.name.substring(0, 100)));
      }
      return node.name;
    }

    emitBinaryExpression(node) {
      const left = this.emit(node.left);
      const right = this.emit(node.right);

      // Map operators
      let op = node.operator;
      if (op === '===') op = '==';
      if (op === '!==') op = '!=';
      if (op === '&&') op = 'and';
      if (op === '||') op = 'or';

      return `${left} ${op} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      // Map operators
      let op = node.operator;
      if (op === '!') op = 'not';

      // Word operators need a space after them
      const wordOperators = ['not', 'await', '*'];
      if (wordOperators.includes(op)) {
        return `${op} ${operand}`;
      }

      return `${op}${operand}`;
    }

    emitMemberAccess(node) {
      return `${this.emit(node.object)}.${node.attribute}`;
    }

    emitSubscript(node) {
      const obj = this.emit(node.object);
      const index = this.emit(node.index);

      if (obj.includes('\n') || obj.match(/^\s{4}/)) {
        console.error('[ERROR Subscript] Object contains formatting:', JSON.stringify(obj.substring(0, 50)));
      }
      if (index.includes('\n') || index.match(/^\s{4}/)) {
        console.error('[ERROR Subscript] Index contains formatting:', JSON.stringify(index.substring(0, 50)));
      }

      return `${obj}[${index}]`;
    }

    emitCall(node) {
      const func = this.emit(node.func);
      const args = node.args.map(a => this.emit(a));
      const kwargs = node.kwargs.map(kw => `${kw.name}=${this.emit(kw.value)}`);
      const allArgs = [...args, ...kwargs];
      return `${func}(${allArgs.join(', ')})`;
    }

    emitList(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `[${elements.join(', ')}]`;
    }

    emitDict(node) {
      const items = node.items.map(item => `${this.emit(item.key)}: ${this.emit(item.value)}`);
      return `{${items.join(', ')}}`;
    }

    emitTuple(node) {
      const elements = node.elements.map(e => this.emit(e));
      // Single element tuple needs trailing comma
      if (elements.length === 1) {
        return `(${elements[0]},)`;
      }
      return `(${elements.join(', ')})`;
    }

    emitListComprehension(node) {
      let code = `[${this.emit(node.expression)} for ${node.variable} in ${this.emit(node.iterable)}`;
      if (node.condition) {
        code += ` if ${this.emit(node.condition)}`;
      }
      code += ']';
      return code;
    }

    emitConditional(node) {
      return `${this.emit(node.trueExpression)} if ${this.emit(node.condition)} else ${this.emit(node.falseExpression)}`;
    }

    emitLambda(node) {
      const params = node.parameters.map(p => p.name).join(', ');
      return `lambda ${params}: ${this.emit(node.body)}`;
    }

    emitSlice(node) {
      const start = node.start ? this.emit(node.start) : '';
      const stop = node.stop ? this.emit(node.stop) : '';
      const step = node.step ? `:${this.emit(node.step)}` : '';
      return `${start}:${stop}${step}`;
    }

    emitType(node) {
      return node.toString();
    }
  }

  // Export
  const exports = { PythonEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PythonEmitter = PythonEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
