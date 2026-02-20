/**
 * RustEmitter.js - Rust Code Generator from Rust AST
 * Generates properly formatted Rust source code from RustAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Rust AST -> Rust Emitter -> Rust Source
 */

(function(global) {
  'use strict';

  // Load RustAST if available
  let RustAST;
  if (typeof require !== 'undefined') {
    RustAST = require('./RustAST.js');
  } else if (global.RustAST) {
    RustAST = global.RustAST;
  }

  /**
   * Rust Code Emitter
   * Generates formatted Rust code from a Rust AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Emit doc comments (///). Default: true
   */
  class RustEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /**
     * Emit Rust code from a Rust AST node
     * @param {RustNode} node - The AST node to emit
     * @returns {string} Generated Rust code
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

    // ========================[ MODULE ]========================

    emitModule(node) {
      let code = '';

      // File header comment
      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Attributes
      for (const attr of node.attributes) {
        code += this.emit(attr);
      }

      // Use declarations
      for (const use of node.uses) {
        code += this.emit(use);
      }
      if (node.uses.length > 0) {
        code += this.newline;
      }

      // Items (structs, functions, etc.)
      for (const item of node.items) {
        code += this.emit(item);
        code += this.newline;
      }

      return code;
    }

    emitUseDeclaration(node) {
      let code = 'use ' + node.path;

      if (node.items && Array.isArray(node.items)) {
        code += '::{' + node.items.join(', ') + '}';
      } else if (node.isWildcard) {
        code += '::*';
      }

      if (node.alias) {
        code += ' as ' + node.alias;
      }

      return this.line(code + ';');
    }

    emitAttribute(node) {
      let code = node.isOuter ? '#[' : '#![';
      code += node.name;

      if (node.arguments && node.arguments.length > 0) {
        code += '(' + node.arguments.join(', ') + ')';
      }

      code += ']';
      return this.line(code);
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitStruct(node) {
      let code = '';

      // Doc comment
      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Attributes
      for (const attr of node.attributes) {
        code += this.emit(attr);
      }

      // Declaration line
      let decl = node.visibility ? node.visibility + ' ' : '';
      decl += 'struct ' + node.name;

      if (node.isUnit) {
        code += this.line(decl + ';');
      } else if (node.isTuple) {
        // Tuple struct
        const fields = node.fields.map(f => f.type.toString()).join(', ');
        code += this.line(decl + '(' + fields + ');');
      } else {
        // Regular struct
        code += this.line(decl + ' {');
        this.indentLevel++;

        for (const field of node.fields) {
          code += this.emit(field);
        }

        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitStructField(node) {
      let code = '';

      if (node.visibility) {
        code += node.visibility + ' ';
      }

      code += node.name + ': ' + (node.type ? node.type.toString() : '_');
      return this.line(code + ',');
    }

    emitEnum(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      for (const attr of node.attributes) {
        code += this.emit(attr);
      }

      let decl = node.visibility ? node.visibility + ' ' : '';
      decl += 'enum ' + node.name;

      code += this.line(decl + ' {');
      this.indentLevel++;

      for (const variant of node.variants) {
        code += this.emit(variant);
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitEnumVariant(node) {
      let code = node.name;

      if (node.tupleFields && node.tupleFields.length > 0) {
        code += '(' + node.tupleFields.map(t => t.toString()).join(', ') + ')';
      } else if (node.fields && node.fields.length > 0) {
        code += ' { ' + node.fields.map(f => f.name + ': ' + f.type.toString()).join(', ') + ' }';
      }

      if (node.discriminant !== null) {
        code += ' = ' + node.discriminant;
      }

      return this.line(code + ',');
    }

    emitImpl(node) {
      let code = '';

      let decl = 'impl ';
      if (node.traitName) {
        decl += node.traitName + ' for ';
      }
      decl += node.typeName;

      code += this.line(decl + ' {');
      this.indentLevel++;

      for (const method of node.methods) {
        code += this.emit(method);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    // ========================[ FUNCTIONS ]========================

    emitFunction(node) {
      let code = '';

      // Doc comment
      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Attributes
      for (const attr of node.attributes) {
        code += this.emit(attr);
      }

      // Declaration line
      let decl = '';
      if (node.visibility) decl += node.visibility + ' ';
      if (node.isConst) decl += 'const ';
      if (node.isAsync) decl += 'async ';
      if (node.isUnsafe) decl += 'unsafe ';
      decl += 'fn ' + node.name;

      // Parameters
      decl += '(';

      if (node.selfParameter) {
        decl += node.selfParameter;
        if (node.parameters.length > 0) {
          decl += ', ';
        }
      }

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += params.join(', ');
      decl += ')';

      // Return type
      if (node.returnType && node.returnType.name !== '()') {
        decl += ' -> ' + node.returnType.toString();
      }

      code += this.line(decl + ' {');

      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line('}');

      return code;
    }

    emitParameterDecl(node) {
      let decl = '';
      if (node.isMutable) decl += 'mut ';
      decl += node.name + ': ' + node.type.toString();
      return decl;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = this.line('{');
      this.indentLevel++;
      code += this.emitBlockContents(node);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitBlockContents(node) {
      let code = '';

      // Handle undefined or missing statements array
      if (!node || !node.statements) {
        return code;
      }

      for (let i = 0; i < node.statements.length; i++) {
        const stmt = node.statements[i];
        code += this.emit(stmt);
      }

      return code;
    }

    emitLet(node) {
      let code = 'let ';
      if (node.isMutable) code += 'mut ';
      code += node.pattern;

      if (node.type) {
        code += ': ' + node.type.toString();
      }

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code + ';');
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression) + ';');
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line('return ' + this.emit(node.expression) + ';');
      }
      return this.line('return;');
    }

    emitIf(node) {
      let code = this.line('if ' + this.emit(node.condition) + ' {');
      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;
      code += this.line('}');

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          // else if
          code = code.trimEnd() + ' else ';
          const elseIfCode = this.emitIf(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code += this.line('else {');
          this.indentLevel++;
          code += this.emitBlockContents(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      // Pattern can be a string or a RustNode (RustIdentifier)
      const pattern = typeof node.pattern === 'string' ? node.pattern : this.emit(node.pattern);
      let code = this.line('for ' + pattern + ' in ' + this.emit(node.iterator) + ' {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      let code = this.line('while ' + this.emit(node.condition) + ' {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitLoop(node) {
      let code = '';
      if (node.label) {
        code += this.line("'" + node.label + ': loop {');
      } else {
        code += this.line('loop {');
      }
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitMatch(node) {
      let code = this.line('match ' + this.emit(node.expression) + ' {');
      this.indentLevel++;

      for (const arm of node.arms) {
        code += this.emit(arm);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitMatchArm(node) {
      let code = this.indent() + this.emit(node.pattern);

      if (node.guard) {
        code += ' if ' + this.emit(node.guard);
      }

      code += ' => ';

      if (node.body.nodeType === 'Block') {
        // Filter out break statements (from JS switch) and check for multi-statement blocks
        const stmts = (node.body.statements || []).filter(s => s.nodeType !== 'Break');

        if (stmts.length === 0) {
          // Empty block
          code += '{},' + this.newline;
        } else if (stmts.length === 1) {
          // Single statement - can be inline
          code += this.emit(stmts[0]).trim();
          // Remove trailing semicolon for expression-like statements
          if (code.endsWith(';')) {
            code = code.slice(0, -1);
          }
          code += ',' + this.newline;
        } else {
          // Multi-statement block needs braces
          code += '{' + this.newline;
          this.indentLevel++;
          for (const stmt of stmts) {
            code += this.emit(stmt);
          }
          this.indentLevel--;
          code += this.indent() + '}' + this.newline;
        }
      } else {
        code += this.emit(node.body) + ',' + this.newline;
      }

      return code;
    }

    emitBreak(node) {
      let code = 'break';
      if (node.label) {
        code += " '" + node.label;
      }
      if (node.expression) {
        code += ' ' + this.emit(node.expression);
      }
      return this.line(code + ';');
    }

    emitContinue(node) {
      let code = 'continue';
      if (node.label) {
        code += " '" + node.label;
      }
      return this.line(code + ';');
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'bool') return node.value ? 'true' : 'false';
      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        // Use .to_string() to convert &str to String for owned string fields
        return `"${escaped}".to_string()`;
      }
      if (node.literalType === 'str') {
        // Raw &str without conversion (for function parameters, etc.)
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }
      if (node.literalType === 'char') {
        const ch = String(node.value);
        const escaped = ch
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `'${escaped}'`;
      }

      // Numeric literal
      let result;
      if (node.literalType === 'hex') {
        result = `0x${node.value.toString(16).toUpperCase()}`;
      } else {
        result = String(node.value);
      }

      if (node.suffix) {
        result += node.suffix;
      }

      return result;
    }

    emitIdentifier(node) {
      return node.name;
    }

    emitBinaryExpression(node) {
      const left = this.emit(node.left);
      const right = this.emit(node.right);
      const op = node.operator;

      // Wrapping arithmetic for cryptographic code (prevents overflow panics)
      // Use .wrapping_add(), .wrapping_sub(), .wrapping_mul() for +, -, *
      if (op === '+') {
        return `${this.wrapForMethodCall(left, node.left)}.wrapping_add(${right})`;
      }
      if (op === '-') {
        return `${this.wrapForMethodCall(left, node.left)}.wrapping_sub(${right})`;
      }
      if (op === '*') {
        return `${this.wrapForMethodCall(left, node.left)}.wrapping_mul(${right})`;
      }

      // For other operators, add parentheses when needed for precedence
      const leftStr = this.needsParens(node.left, op, 'left') ? `(${left})` : left;
      const rightStr = this.needsParens(node.right, op, 'right') ? `(${right})` : right;
      return `${leftStr} ${op} ${rightStr}`;
    }

    /**
     * Wrap expression in parentheses if needed for method call
     */
    wrapForMethodCall(code, node) {
      // Binary expressions and casts need parentheses before method calls
      if (node && (node.nodeType === 'BinaryExpression' || node.nodeType === 'Cast')) {
        return `(${code})`;
      }
      return code;
    }

    /**
     * Check if an expression needs parentheses in a binary expression
     */
    needsParens(node, parentOp, side) {
      if (!node || node.nodeType !== 'BinaryExpression') return false;

      const childOp = node.operator;

      // Precedence table (higher = binds tighter)
      const precedence = {
        '*': 13, '/': 13, '%': 13,
        '+': 12, '-': 12,
        '<<': 11, '>>': 11,
        '<': 10, '<=': 10, '>': 10, '>=': 10,
        '==': 9, '!=': 9,
        '&': 8,
        '^': 7,
        '|': 6,
        '&&': 5,
        '||': 4
      };

      const parentPrec = precedence[parentOp] || 0;
      const childPrec = precedence[childOp] || 0;

      // If child has lower precedence, needs parens
      if (childPrec < parentPrec) return true;

      // If same precedence and right side, needs parens for left-associativity
      if (childPrec === parentPrec && side === 'right') return true;

      return false;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      // Space for 'ref' and 'ref mut'
      if (node.operator === '&' || node.operator === '&mut') {
        return `${node.operator} ${operand}`;
      }

      return `${node.operator}${operand}`;
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} ${node.operator} ${this.emit(node.value)}`;
    }

    emitFieldAccess(node) {
      return `${this.emit(node.target)}.${node.field}`;
    }

    emitIndex(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitMethodCall(node) {
      // Cast expressions need parentheses before method calls
      if (!node.target) return `/* null target */.${node.methodName ?? 'unknown'}()`;
      let target = this.emit(node.target);
      if (node.target.nodeType === 'Cast') {
        target = '(' + target + ')';
      }
      let code = target + '.' + node.methodName;

      if (node.turbofish) {
        code += '::' + node.turbofish;
      }

      const args = node.arguments.map(a => this.emit(a));
      code += '(' + args.join(', ') + ')';
      return code;
    }

    emitCall(node) {
      const callee = this.emit(node.callee);
      const args = node.arguments.map(a => this.emit(a));
      return `${callee}(${args.join(', ')})`;
    }

    emitStructLiteral(node) {
      let code = node.typeName + ' {';

      if (node.fields.length > 0) {
        code += ' ';
        const fields = node.fields.map(f => `${f.name}: ${this.emit(f.value)}`);
        code += fields.join(', ');
        code += ' ';
      }

      if (node.spread) {
        code += '..';
        code += this.emit(node.spread);
        code += ' ';
      }

      code += '}';
      return code;
    }

    emitArrayLiteral(node) {
      if (node.repeatValue !== null && node.repeatCount !== null) {
        return `[${this.emit(node.repeatValue)}; ${this.emit(node.repeatCount)}]`;
      }

      const elements = node.elements.map(e => this.emit(e));
      return `[${elements.join(', ')}]`;
    }

    emitVecMacro(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `vec![${elements.join(', ')}]`;
    }

    emitCast(node) {
      if (!node.expression) return `/* null cast */ 0 as ${node.targetType?.toString() ?? '_'}`;
      const exprCode = this.emit(node.expression);
      // Need parentheses for complex expressions to ensure correct operator precedence
      // e.g., (j & 3u32) as usize, not j & 3u32 as usize (which parses as j & (3u32 as usize))
      const needsParens = node.expression.nodeType === 'BinaryExpression' ||
                          node.expression.nodeType === 'UnaryExpression' ||
                          node.expression.nodeType === 'ConditionalExpression' ||
                          node.expression.nodeType === 'Cast';
      if (needsParens) {
        return `(${exprCode}) as ${node.targetType.toString()}`;
      }
      return `${exprCode} as ${node.targetType.toString()}`;
    }

    emitReference(node) {
      const op = node.isMutable ? '&mut ' : '&';
      return `${op}${this.emit(node.expression)}`;
    }

    emitDereference(node) {
      return `*${this.emit(node.expression)}`;
    }

    emitRange(node) {
      let code = '';
      if (node.start) code += this.emit(node.start);
      code += node.isInclusive ? '..=' : '..';
      if (node.end) code += this.emit(node.end);
      return code;
    }

    emitTuple(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `(${elements.join(', ')})`;
    }

    emitClosure(node) {
      let code = '';
      if (node.isMove) code += 'move ';

      code += '|';
      const params = node.parameters.map(p => {
        // Handle both string parameters and RustParameter objects
        let param = typeof p === 'string' ? p : p.name;
        if (p && p.type) param += ': ' + p.type.toString();
        return param;
      });
      code += params.join(', ');
      code += '| ';

      if (node.body) {
        code += this.emit(node.body);
      } else {
        code += '{ /* empty body */ }';
      }

      return code;
    }

    emitMacroCall(node) {
      // Handle tokens that might be RustNodes or strings
      let tokens = node.tokens;
      // Use separator from node (default ', ', or '; ' for vec repeat)
      const separator = node.separator || ', ';
      if (tokens && typeof tokens === 'object' && tokens.nodeType) {
        tokens = this.emit(tokens);
      } else if (Array.isArray(tokens)) {
        tokens = tokens.map(t => t && typeof t === 'object' && t.nodeType ? this.emit(t) : (t ?? '')).join(separator);
      }
      // Remove trailing ! from macroName if present (emitter adds it)
      const macroName = node.macroName.endsWith('!') ? node.macroName.slice(0, -1) : node.macroName;
      // vec! and array macros use brackets, most others use parentheses
      const useBrackets = ['vec', 'array', 'arr'].includes(macroName.toLowerCase());
      return useBrackets ? `${macroName}![${tokens}]` : `${macroName}!(${tokens})`;
    }

    emitIfExpression(node) {
      let code = 'if ' + this.emit(node.condition) + ' { ' + this.emit(node.thenExpression) + ' }';

      if (node.elseExpression) {
        code += ' else { ' + this.emit(node.elseExpression) + ' }';
      }

      return code;
    }

    emitBlockExpression(node) {
      return this.emit(node.block);
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ CONSTANTS ]========================

    emitConst(node) {
      let code = '';

      // Visibility
      if (node.visibility === 'pub') {
        code += 'pub ';
      }

      // const NAME: Type = value;
      code += `const ${node.name}`;

      if (node.type) {
        code += `: ${this.emit(node.type)}`;
      }

      if (node.value) {
        code += ` = ${this.emit(node.value)}`;
      }

      code += ';';

      return this.line(code);
    }

    // ========================[ DOCUMENTATION ]========================

    emitDocComment(node) {
      // Skip doc comments if addComments option is false
      if (this.options.addComments === false) {
        return '';
      }

      const lines = node.text.split('\n');
      const prefix = node.isOuter ? '/// ' : '//! ';

      let code = '';
      for (const line of lines) {
        code += this.line(prefix + line.trim());
      }

      return code;
    }
  }

  // Export
  const exports = { RustEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.RustEmitter = RustEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
