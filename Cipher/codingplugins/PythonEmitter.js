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

      // Handle arrays (list of statements)
      if (Array.isArray(node)) {
        return node.map(n => this.emit(n)).filter(s => s).join('');
      }

      // Handle nodes with missing nodeType
      if (!node.nodeType) {
        // Try to infer type from node properties (duck typing)
        if (node.statements !== undefined) return this.emitBlock(node);
        if (node.target && node.value && node.operator !== undefined) return this.emitAssignment(node);
        if (node.name && typeof node.name === 'string' && Object.keys(node).length <= 3) return this.emitIdentifier(node);
        // Skip known control objects
        if (node.isMethod !== undefined || node.initStatement !== undefined) return '';
        const keys = Object.keys(node).slice(0, 5).join(', ');
        console.error(`No emitter for node type: ${node.nodeType} (keys: ${keys})`);
        return '';
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

    // ========================[ RAW CODE ]========================

    emitRawCode(node) {
      // Emit raw Python code as-is (used for framework stubs)
      // Each line needs proper indentation at module level
      const lines = node.code.split('\n');
      return lines.map(line => this.line(line)).join('') + this.newline;
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

    emitAssignment(node, asExpression = false) {
      const target = this.emit(node.target);
      const value = this.emit(node.value);

      let code = target;

      // Type annotation (only if addTypeHints is enabled and in statement context)
      if (!asExpression && this.addTypeHints && node.type && node.operator === '=') {
        code += `: ${node.type.toString()}`;
      }

      code += ` ${node.operator} ${value}`;

      // In expression context (e.g., inside subscript), don't add line formatting
      if (asExpression) {
        return code;
      }
      return this.line(code);
    }

    /**
     * Emit an assignment as an expression (for use in expression contexts like subscripts)
     * Note: Python 3.8+ has walrus operator := for true assignment expressions,
     * but augmented assignments (+=, -=) cannot be expressions in Python.
     * We emit them inline but this may produce invalid Python for some constructs.
     */
    emitAssignmentAsExpression(node) {
      return this.emitAssignment(node, true);
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

      // else branch (could be another If node for elif, or a Block)
      if (node.elseBranch) {
        // Check if elseBranch is another If node (convert to elif)
        if (node.elseBranch.nodeType === 'If') {
          code += this.line(`elif ${this.emit(node.elseBranch.condition)}:`);
          this.indentLevel++;
          const elifStatements = node.elseBranch.thenBranch?.statements || [];
          if (elifStatements.length > 0) {
            code += this.emit(node.elseBranch.thenBranch);
          } else {
            code += this.line('pass');
          }
          this.indentLevel--;
          // Recursively handle the rest of the elif chain
          if (node.elseBranch.elseBranch) {
            // Create a fake If node to continue the chain
            const fakeIf = { nodeType: 'If', condition: null, thenBranch: null, elseBranch: node.elseBranch.elseBranch };
            if (node.elseBranch.elseBranch.nodeType === 'If') {
              // More elif
              code += this.line(`elif ${this.emit(node.elseBranch.elseBranch.condition)}:`);
              this.indentLevel++;
              const nestedStatements = node.elseBranch.elseBranch.thenBranch?.statements || [];
              if (nestedStatements.length > 0) {
                code += this.emit(node.elseBranch.elseBranch.thenBranch);
              } else {
                code += this.line('pass');
              }
              this.indentLevel--;
              // Continue recursively for deeply nested
              let current = node.elseBranch.elseBranch;
              while (current.elseBranch) {
                if (current.elseBranch.nodeType === 'If') {
                  code += this.line(`elif ${this.emit(current.elseBranch.condition)}:`);
                  this.indentLevel++;
                  const stmts = current.elseBranch.thenBranch?.statements || [];
                  if (stmts.length > 0) {
                    code += this.emit(current.elseBranch.thenBranch);
                  } else {
                    code += this.line('pass');
                  }
                  this.indentLevel--;
                  current = current.elseBranch;
                } else {
                  // Final else block
                  code += this.line('else:');
                  this.indentLevel++;
                  const stmts = current.elseBranch?.statements || [];
                  if (stmts.length > 0) {
                    code += this.emit(current.elseBranch);
                  } else {
                    code += this.line('pass');
                  }
                  this.indentLevel--;
                  break;
                }
              }
            } else {
              // Final else block
              code += this.line('else:');
              this.indentLevel++;
              const elseStmts = node.elseBranch.elseBranch?.statements || [];
              if (elseStmts.length > 0) {
                code += this.emit(node.elseBranch.elseBranch);
              } else {
                code += this.line('pass');
              }
              this.indentLevel--;
            }
          }
        } else {
          // Regular else block
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
          .replace(/\t/g, '\\t')
          .replace(/\0/g, '\\x00');  // Escape null bytes
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
      // First, emit all expressions to check for quote conflicts
      const emittedExprs = node.expressions.map(e => this.emit(e));

      // Check if any expression contains double quotes - if so, use single quotes for f-string
      const hasDoubleQuotes = emittedExprs.some(expr => expr.includes('"'));
      const hasSingleQuotes = emittedExprs.some(expr => expr.includes("'"));

      // Choose quote character: prefer double, but use single if expressions have double quotes
      // If expressions have both, we need to use string concatenation instead
      let quote = '"';
      let altQuote = "'";
      if (hasDoubleQuotes && !hasSingleQuotes) {
        quote = "'";
        altQuote = '"';
      } else if (hasDoubleQuotes && hasSingleQuotes) {
        // Both quote types in expressions - fall back to str.format or concatenation
        // For simplicity, just use double quotes and hope for the best (rare case)
        quote = '"';
        altQuote = "'";
      }

      let result = `f${quote}`;
      for (let i = 0; i < node.parts.length; ++i) {
        // Escape the string part - escape the quote we're using
        let part = (node.parts[i] || '')
          .replace(/\\/g, '\\\\')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\{/g, '{{')   // Escape literal braces in f-strings
          .replace(/\}/g, '}}');

        // Escape the quote character we're using
        if (quote === '"')
          part = part.replace(/"/g, '\\"');
        else
          part = part.replace(/'/g, "\\'");

        result += part;
        if (i < emittedExprs.length)
          result += `{${emittedExprs[i]}}`;
      }
      result += quote;
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

    // Python operator precedence (higher number = higher precedence, binds tighter)
    // Based on: https://docs.python.org/3/reference/expressions.html#operator-precedence
    // Note: Python docs list from lowest to highest, we reverse for easier comparison
    getOperatorPrecedence(op) {
      const precedence = {
        // Exponentiation (highest precedence, binds tightest)
        '**': 14,
        // Unary
        '~': 13,
        // Multiplication
        '*': 12, '/': 12, '//': 12, '%': 12, '@': 12,
        // Addition
        '+': 11, '-': 11,
        // Shift
        '<<': 10, '>>': 10,
        // Bitwise and
        '&': 9,
        // Bitwise xor
        '^': 8,
        // Bitwise or
        '|': 7,
        // Comparisons
        'in': 6, 'not in': 6, 'is': 6, 'is not': 6, '<': 6, '<=': 6, '>': 6, '>=': 6, '==': 6, '!=': 6,
        // Boolean not
        'not': 5,
        // Boolean and
        'and': 4,
        // Boolean or
        'or': 3,
        // Conditional
        'if': 2,
        // Lambda (lowest)
        'lambda': 1
      };
      return precedence[op] || 0;
    }

    emitBinaryExpression(node) {
      const parentPrecedence = this.getOperatorPrecedence(node.operator);
      const parentOp = node.operator;

      // Right-associative operators: only ** (exponentiation) in Python
      const isRightAssociative = parentOp === '**';

      // Emit operands and determine if they need parentheses
      let left = this.emit(node.left);
      let right = this.emit(node.right);

      // Add parentheses to left operand if needed
      if (node.left && node.left.nodeType === 'BinaryExpression') {
        const leftOp = node.left.operator;
        const leftPrecedence = this.getOperatorPrecedence(leftOp);

        // Left operand needs parens when it would be parsed differently without them
        // Examples:
        // - (a + b) * c: + (11) < * (12), without parens → a + b * c → a + (b * c) WRONG, need parens ✓
        // - (a & b) == c: & (9) > == (6), without parens → a & b == c → (a & b) == c CORRECT, no parens
        // - (a + b) + c: + == +, left-associative, → a + b + c → (a + b) + c CORRECT, no parens
        // - (a + b) - c: + (11) == - (11) but different op, need parens for clarity

        const needsParens = leftPrecedence < parentPrecedence ||
                           (leftPrecedence === parentPrecedence && leftOp !== parentOp);

        if (needsParens)
          left = `(${left})`;
      }

      // Add parentheses to right operand if needed
      if (node.right && node.right.nodeType === 'BinaryExpression') {
        const rightOp = node.right.operator;
        const rightPrecedence = this.getOperatorPrecedence(rightOp);

        let needsParens;
        if (isRightAssociative) {
          // For right-associative ops (like **), right operand needs parens if:
          // - Strictly lower precedence
          // - Equal precedence but different operator
          needsParens = rightPrecedence < parentPrecedence ||
                       (rightPrecedence === parentPrecedence && rightOp !== parentOp);
        } else {
          // For left-associative ops, right operand needs parens if:
          // - Lower or EQUAL precedence (to force left-to-right evaluation)
          needsParens = rightPrecedence <= parentPrecedence;
        }

        if (needsParens)
          right = `(${right})`;
      }

      // Map operators
      let op = parentOp;
      if (op === '===') op = '==';
      if (op === '!==') op = '!=';
      if (op === '&&') op = 'and';
      if (op === '||') op = 'or';

      // For bitwise operators, wrap operands with int() to handle floats
      // JavaScript implicitly converts floats to ints for bitwise operations, Python doesn't
      const bitwiseOps = ['&', '|', '^', '<<', '>>', '~'];
      if (bitwiseOps.includes(op)) {
        // Only wrap if not already an int literal or already wrapped with int()
        const needsWrap = (str) => {
          if (/^-?\d+$/.test(str)) return false; // Integer literal
          if (/^0x[\da-fA-F]+$/.test(str)) return false; // Hex literal
          if (/^int\(/.test(str)) return false; // Already wrapped with int()
          return true;
        };
        if (needsWrap(left))
          left = `int(${left})`;
        if (needsWrap(right))
          right = `int(${right})`;
      }

      // For left shift operations in Python:
      // JavaScript truncates shifts to 32-bit, but Python integers are unbounded.
      // HOWEVER: Automatic 32-bit masking can break BigInt operations where
      // large shifts are intentional (e.g., 1 << 128 for cryptographic modular arithmetic).
      //
      // The transpiler handles this as follows:
      // - IL AST operations like RotL32, Shl32 explicitly add 32-bit masking
      // - Raw << operations are NOT masked to preserve BigInt semantics
      // - If 32-bit behavior is needed, the source code should use OpCodes.Shl32
      //
      // This approach:
      // - Preserves BigInt arithmetic (1 << 128 works correctly)
      // - Relies on explicit masking for 32-bit operations (via OpCodes.Shl32)
      if (op === '<<') {
        // Don't automatically mask - let the algorithm handle bit width
        return `${left} ${op} ${right}`;
      }

      return `${left} ${op} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      // Map operators
      let op = node.operator;
      if (op === '!') op = 'not';

      // Handle ++ and -- operators that leaked through
      if (op === '++')
        return `${operand} += 1`;
      if (op === '--')
        return `${operand} -= 1`;

      // Bitwise NOT (~) in Python produces -(x+1), which is negative for positive inputs
      // JavaScript truncates to 32-bit, so ~0 = -1 (0xFFFFFFFF), but Python's ~0 = -1 (unbounded)
      // We need to mask to 32-bit to match JavaScript behavior
      // IMPORTANT: Wrap entire expression in parens to preserve precedence in larger expressions
      // e.g., (~x) + 1 should become ((~int(x)) & 0xFFFFFFFF) + 1, not (~int(x)) & (0xFFFFFFFF + 1)
      if (op === '~') {
        return `((~int(${operand})) & 0xFFFFFFFF)`;
      }

      // Word operators need a space after them (not, await)
      // Note: * for unpacking does NOT need a space: [*arr] not [* arr]
      const wordOperators = ['not', 'await'];
      if (wordOperators.includes(op)) {
        return `${op} ${operand}`;
      }

      return `${op}${operand}`;
    }

    // Fallback for UpdateExpression nodes that weren't transformed
    emitUpdateExpression(node) {
      const operand = this.emit(node.argument);
      const op = node.operator === '++' ? '+= 1' : '-= 1';
      return `${operand} ${op}`;
    }

    emitMemberAccess(node) {
      const objCode = this.emit(node.object);
      // Wrap in parentheses if the object is a complex expression that needs grouping
      const needsParens = node.object?.nodeType === 'BinaryExpression' ||
                          node.object?.nodeType === 'UnaryExpression' ||
                          node.object?.nodeType === 'Conditional' ||
                          node.object?.nodeType === 'ConditionalExpression' ||
                          node.object?.nodeType === 'LogicalExpression' ||
                          node.object?.nodeType === 'Lambda';
      return needsParens ? `(${objCode}).${node.attribute}` : `${objCode}.${node.attribute}`;
    }

    emitSubscript(node) {
      const obj = this.emit(node.object);

      // Handle index specially - if it's an assignment, emit as expression to avoid line formatting
      // Check multiple ways since some nodes might not have proper nodeType set
      let index;
      if (node.index && (
        node.index.nodeType === 'Assignment' ||
        (node.index.operator && node.index.target && node.index.value)  // Duck typing for assignment
      )) {
        index = this.emitAssignmentAsExpression(node.index);
      } else {
        index = this.emit(node.index);
      }

      // Safety: strip any line formatting that leaked through (shouldn't happen but belt & suspenders)
      if (typeof index === 'string') {
        index = index.trim();
      }

      // Check if index contains division which could produce float
      // JavaScript truncates floats for array indices, Python requires int
      const containsDivision = this._containsDivisionOperator(node.index);
      if (containsDivision)
        return `${obj}[int(${index})]`;

      return `${obj}[${index}]`;
    }

    /**
     * Check if an expression contains a division operator that could produce a float
     */
    _containsDivisionOperator(node) {
      if (!node) return false;
      // Check if this node is a binary expression with division
      if (node.nodeType === 'BinaryExpression') {
        if (node.operator === '/') return true;
        // Recursively check operands
        return this._containsDivisionOperator(node.left) || this._containsDivisionOperator(node.right);
      }
      // Check call expressions (like math.floor returns float in some cases)
      if (node.nodeType === 'Call') {
        // Check arguments recursively
        if (node.args && node.args.some(arg => this._containsDivisionOperator(arg)))
          return true;
      }
      // Check nested expressions
      if (node.expression) return this._containsDivisionOperator(node.expression);
      if (node.argument) return this._containsDivisionOperator(node.argument);
      if (node.operand) return this._containsDivisionOperator(node.operand);
      return false;
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
      // Use list() for empty lists so overridden list class takes effect (JSArray)
      if (elements.length === 0)
        return 'list()';
      return `[${elements.join(', ')}]`;
    }

    emitDict(node) {
      const parts = [];

      // Add spread elements first (Python 3.5+ dict unpacking)
      if (node.spreads && node.spreads.length > 0) {
        for (const spread of node.spreads) {
          parts.push(`**${this.emit(spread)}`);
        }
      }

      // Add regular key-value pairs
      for (const item of node.items) {
        parts.push(`${this.emit(item.key)}: ${this.emit(item.value)}`);
      }

      const dictLiteral = `{${parts.join(', ')}}`;
      // Use JSObject wrapper for JavaScript-like attribute access on dicts
      return node.useJSObject ? `JSObject(${dictLiteral})` : dictLiteral;
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
      // Handle variable as either string or AST node
      const varStr = typeof node.variable === 'string' ? node.variable : this.emit(node.variable);
      let code = `[${this.emit(node.expression)} for ${varStr} in ${this.emit(node.iterable)}`;
      if (node.condition) {
        code += ` if ${this.emit(node.condition)}`;
      }
      code += ']';
      return code;
    }

    emitGeneratorExpression(node) {
      // Handle variable as either string or AST node
      const varStr = typeof node.variable === 'string' ? node.variable : this.emit(node.variable);
      let code = `(${this.emit(node.expression)} for ${varStr} in ${this.emit(node.iterable)}`;
      if (node.condition) {
        code += ` if ${this.emit(node.condition)}`;
      }
      code += ')';
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
      // Check for division in slice indices and wrap with int() if needed
      // Python slice indices must be integers, JavaScript truncates floats
      let start = node.start ? this.emit(node.start) : '';
      let stop = node.stop ? this.emit(node.stop) : '';
      let step = node.step ? this.emit(node.step) : '';

      if (start && this._containsDivisionOperator(node.start))
        start = `int(${start})`;
      if (stop && this._containsDivisionOperator(node.stop))
        stop = `int(${stop})`;
      if (step && this._containsDivisionOperator(node.step))
        step = `int(${step})`;

      const stepPart = step ? `:${step}` : '';
      return `${start}:${stop}${stepPart}`;
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
