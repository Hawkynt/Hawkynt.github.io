/**
 * PhpEmitter.js - PHP Code Generator from PHP AST
 * Generates properly formatted PHP source code from PhpAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> PHP AST -> PHP Emitter -> PHP Source
 */

(function(global) {
  'use strict';

  // Load PhpAST if available
  let PhpAST;
  if (typeof require !== 'undefined') {
    PhpAST = require('./PhpAST.js');
  } else if (global.PhpAST) {
    PhpAST = global.PhpAST;
  }

  /**
   * PHP Code Emitter
   * Generates formatted PHP code from a PHP AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - strictTypes: boolean - Emit declare(strict_types=1). Default: true
   * - addTypeHints: boolean - Emit type hints. Default: true
   * - addDocBlocks: boolean - Emit PHPDoc comments. Default: true
   * - useShortArraySyntax: boolean - Use [] instead of array(). Default: true
   */
  class PhpEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /**
     * Emit PHP code from a PHP AST node
     * @param {PhpNode} node - The AST node to emit
     * @returns {string} Generated PHP code
     */
    emit(node) {
      if (!node) return '';

      if (typeof node === 'string') return node;

      // Handle arrays
      if (Array.isArray(node)) {
        return node.map(n => this.emit(n)).filter(s => s).join('');
      }

      // Duck typing fallback
      if (!node.nodeType) {
        if (node.statements !== undefined) return this.emitBlock(node);
        if (node.target && node.value && node.operator !== undefined) return this.emitAssignment(node);
        if (node.name && typeof node.name === 'string') return this.emitIdentifier(node);
        // Skip known control objects from transformer (not AST nodes)
        if (node.isMethod !== undefined || node.initStatement !== undefined) return '';
        // Show more debug info for unknown nodes
        const keys = Object.keys(node).slice(0, 5).join(', ');
        console.error(`No emitter for node type: ${node.nodeType} (keys: ${keys})`);
        return '';
      }

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

    // ========================[ FILE ]========================

    emitFile(node) {
      let code = '<?php' + this.newline;

      // Strict types declaration
      if (node.strictTypes && this.options.strictTypes !== false) {
        code += this.newline + 'declare(strict_types=1);' + this.newline;
      }

      code += this.newline;

      // Namespace
      if (node.namespace) {
        code += this.emit(node.namespace);
        code += this.newline;
      }

      // Use declarations
      for (const use of node.uses) {
        code += this.emit(use);
      }
      if (node.uses.length > 0) {
        code += this.newline;
      }

      // Items (classes, functions, etc.)
      for (const item of node.items) {
        code += this.emit(item);
        code += this.newline;
      }

      return code;
    }

    emitNamespace(node) {
      return this.line(`namespace ${node.name};`);
    }

    emitUseDeclaration(node) {
      let code = 'use ' + node.fullyQualifiedClassName;
      if (node.alias) {
        code += ' as ' + node.alias;
      }
      return this.line(code + ';');
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitClass(node) {
      let code = '';

      // Doc comment
      if (node.docComment && this.options.addDocBlocks !== false) {
        code += this.emit(node.docComment);
      }

      // Class declaration
      let decl = '';
      if (node.isFinal) decl += 'final ';
      if (node.isAbstract) decl += 'abstract ';
      if (node.isReadonly) decl += 'readonly ';
      decl += 'class ' + node.name;

      if (node.extendsClass) {
        decl += ' extends ' + node.extendsClass;
      }

      if (node.implementsInterfaces.length > 0) {
        decl += ' implements ' + node.implementsInterfaces.join(', ');
      }

      code += this.line(decl);
      code += this.line('{');
      this.indentLevel++;

      // Properties
      for (const property of node.properties) {
        code += this.emit(property);
      }

      if (node.properties.length > 0 && node.methods.length > 0) {
        code += this.newline;
      }

      // Methods
      for (const method of node.methods) {
        code += this.emit(method);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitInterface(node) {
      let code = '';

      if (node.docComment && this.options.addDocBlocks !== false) {
        code += this.emit(node.docComment);
      }

      let decl = 'interface ' + node.name;

      if (node.extendsInterfaces.length > 0) {
        decl += ' extends ' + node.extendsInterfaces.join(', ');
      }

      code += this.line(decl);
      code += this.line('{');
      this.indentLevel++;

      for (const method of node.methods) {
        code += this.emit(method);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitTrait(node) {
      let code = '';

      if (node.docComment && this.options.addDocBlocks !== false) {
        code += this.emit(node.docComment);
      }

      code += this.line('trait ' + node.name);
      code += this.line('{');
      this.indentLevel++;

      for (const property of node.properties) {
        code += this.emit(property);
      }

      if (node.properties.length > 0 && node.methods.length > 0) {
        code += this.newline;
      }

      for (const method of node.methods) {
        code += this.emit(method);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitEnum(node) {
      let code = '';

      if (node.docComment && this.options.addDocBlocks !== false) {
        code += this.emit(node.docComment);
      }

      let decl = 'enum ' + node.name;
      if (node.backingType) {
        decl += ': ' + node.backingType;
      }

      code += this.line(decl);
      code += this.line('{');
      this.indentLevel++;

      for (const enumCase of node.cases) {
        code += this.emit(enumCase);
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitEnumCase(node) {
      let code = 'case ' + node.name;
      if (node.value !== null) {
        code += ' = ' + this.emit(node.value);
      }
      return this.line(code + ';');
    }

    // ========================[ MEMBER DECLARATIONS ]========================

    emitProperty(node) {
      let code = '';

      if (node.docComment && this.options.addDocBlocks !== false) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      if (node.visibility) decl += node.visibility + ' ';
      if (node.isStatic) decl += 'static ';
      if (node.isReadonly) decl += 'readonly ';

      decl += '$' + node.name;

      if (node.type && this.options.addTypeHints !== false) {
        // PHP uses pre-type syntax for properties: public Type $property
        decl = node.visibility + ' ';
        if (node.isStatic) decl += 'static ';
        if (node.isReadonly) decl += 'readonly ';
        decl += node.type.toString() + ' $' + node.name;
      }

      if (node.defaultValue) {
        decl += ' = ' + this.emit(node.defaultValue);
      }

      return this.line(decl + ';');
    }

    emitMethod(node) {
      let code = '';

      if (node.docComment && this.options.addDocBlocks !== false) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      if (node.visibility) decl += node.visibility + ' ';
      if (node.isStatic) decl += 'static ';
      if (node.isFinal) decl += 'final ';
      if (node.isAbstract) decl += 'abstract ';

      decl += 'function ' + node.name;

      // Parameters
      decl += '(';
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += params.join(', ');
      decl += ')';

      // Return type
      if (node.returnType && this.options.addTypeHints !== false) {
        decl += ': ' + node.returnType.toString();
      }

      if (node.isAbstract || !node.body) {
        code += this.line(decl + ';');
      } else {
        code += this.line(decl);
        code += this.line('{');
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitFunction(node) {
      let code = '';

      if (node.docComment && this.options.addDocBlocks !== false) {
        code += this.emit(node.docComment);
      }

      let decl = 'function ' + node.name;

      decl += '(';
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += params.join(', ');
      decl += ')';

      if (node.returnType && this.options.addTypeHints !== false) {
        decl += ': ' + node.returnType.toString();
      }

      code += this.line(decl);
      code += this.line('{');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitParameterDecl(node) {
      let decl = '';

      if (node.type && this.options.addTypeHints !== false) {
        decl += node.type.toString() + ' ';
      }

      if (node.isReference) decl += '&';
      if (node.isVariadic) decl += '...';

      decl += '$' + node.name;

      if (node.defaultValue) {
        decl += ' = ' + this.emit(node.defaultValue);
      }

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

      if (!node || !node.statements) {
        return code;
      }

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      return code;
    }

    emitVariableDeclaration(node) {
      let code = '$' + node.name;

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
      let code = this.line('if (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;
      code += this.line('}');

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          code = code.trimEnd() + ' else';
          const elseIfCode = this.emitIf(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, ' ');
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
      let code = 'for (';
      if (node.init) code += this.emit(node.init);
      code += '; ';
      if (node.test) code += this.emit(node.test);
      code += '; ';
      if (node.update) code += this.emit(node.update);
      code += ') {' + this.newline;

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitForeach(node) {
      let code = 'foreach (' + this.emit(node.iterable) + ' as ';

      if (node.key) {
        code += '$' + node.key + ' => ';
      }

      // Add & for pass-by-reference when the loop variable is modified
      if (node.byReference) {
        code += '&';
      }

      code += '$' + node.value + ') {' + this.newline;

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      let code = this.line('while (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitDoWhile(node) {
      let code = this.line('do {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('} while (' + this.emit(node.condition) + ');');
      return code;
    }

    emitSwitch(node) {
      let code = this.line('switch (' + this.emit(node.expression) + ') {');
      this.indentLevel++;

      for (const caseStmt of node.cases) {
        code += this.emit(caseStmt);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitSwitchCase(node) {
      let code = '';

      if (node.value) {
        code += this.line('case ' + this.emit(node.value) + ':');
      } else {
        code += this.line('default:');
      }

      this.indentLevel++;
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;

      return code;
    }

    emitMatch(node) {
      let code = 'match (' + this.emit(node.expression) + ') {' + this.newline;
      this.indentLevel++;

      for (const arm of node.arms) {
        code += this.emit(arm);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitMatchArm(node) {
      const conditions = node.conditions.map(c => this.emit(c)).join(', ');
      const body = this.emit(node.body);
      return this.line(conditions + ' => ' + body + ',');
    }

    emitBreak(node) {
      let code = 'break';
      if (node.level) {
        code += ' ' + node.level;
      }
      return this.line(code + ';');
    }

    emitContinue(node) {
      let code = 'continue';
      if (node.level) {
        code += ' ' + node.level;
      }
      return this.line(code + ';');
    }

    emitTry(node) {
      let code = this.line('try {');
      this.indentLevel++;
      code += this.emitBlockContents(node.tryBlock);
      this.indentLevel--;
      code += this.line('}');

      for (const catchClause of node.catchClauses) {
        code += this.emit(catchClause);
      }

      if (node.finallyBlock) {
        code += this.line('finally {');
        this.indentLevel++;
        code += this.emitBlockContents(node.finallyBlock);
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitCatch(node) {
      const types = node.exceptionTypes.join('|');
      let code = this.line('catch (' + types + ' $' + node.variableName + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitThrow(node) {
      return this.line('throw ' + this.emit(node.expression) + ';');
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'bool') return node.value ? 'true' : 'false';
      if (node.literalType === 'null') return 'null';

      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `'${escaped}'`;
      }

      return String(node.value);
    }

    emitVariable(node) {
      return '$' + node.name;
    }

    emitIdentifier(node) {
      return node.name;  // Non-variable identifiers (parent, self, static)
    }

    // PHP operator precedence (higher number = higher precedence)
    getOperatorPrecedence(op) {
      const precedences = {
        '||': 1, 'or': 1,
        '&&': 2, 'and': 2,
        '|': 3,
        '^': 4,
        '&': 5,
        '==': 6, '!=': 6, '===': 6, '!==': 6, '<>': 6, '<=>': 6,
        '<': 7, '<=': 7, '>': 7, '>=': 7,
        '<<': 8, '>>': 8,
        '+': 9, '-': 9, '.': 9,
        '*': 10, '/': 10, '%': 10,
        '**': 11
      };
      return precedences[op] || 0;
    }

    emitBinaryExpression(node) {
      const myPrecedence = this.getOperatorPrecedence(node.operator);

      // Emit left operand with parentheses if needed
      let left;
      if (node.left && node.left.nodeType === 'BinaryExpression') {
        const leftPrecedence = this.getOperatorPrecedence(node.left.operator);
        if (leftPrecedence < myPrecedence) {
          left = '(' + this.emit(node.left) + ')';
        } else {
          left = this.emit(node.left);
        }
      } else {
        left = this.emit(node.left);
      }

      // Emit right operand with parentheses if needed
      let right;
      if (node.right && node.right.nodeType === 'BinaryExpression') {
        const rightPrecedence = this.getOperatorPrecedence(node.right.operator);
        // For right operand, also parenthesize if same precedence (left-to-right associativity)
        if (rightPrecedence <= myPrecedence) {
          right = '(' + this.emit(node.right) + ')';
        } else {
          right = this.emit(node.right);
        }
      } else {
        right = this.emit(node.right);
      }

      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      if (node.isPrefix) {
        return `${node.operator}${operand}`;
      } else {
        return `${operand}${node.operator}`;
      }
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} ${node.operator} ${this.emit(node.value)}`;
    }

    emitPropertyAccess(node) {
      return `${this.emit(node.target)}->${node.property}`;
    }

    emitStaticPropertyAccess(node) {
      return `${node.className}::$${node.property}`;
    }

    emitArrayAccess(node) {
      const index = this.emit(node.index).replace(/[\r\n\t]/g, '').trim();
      return `${this.emit(node.target)}[${index}]`;
    }

    emitMethodCall(node) {
      const target = this.emit(node.target);
      const args = node.arguments.map(a => this.emit(a));
      return `${target}->${node.methodName}(${args.join(', ')})`;
    }

    emitStaticMethodCall(node) {
      const args = node.arguments.map(a => this.emit(a));
      return `${node.className}::${node.methodName}(${args.join(', ')})`;
    }

    emitFunctionCall(node) {
      const args = node.arguments.map(a => this.emit(a));

      // Check if function name is a Closure - needs to be wrapped in parentheses for IIFE
      if (typeof node.functionName !== 'string' && node.functionName?.nodeType === 'Closure') {
        const closureCode = this.emit(node.functionName);
        return `(${closureCode})(${args.join(', ')})`;
      }

      // Check if function name is an ArrowFunction - also needs wrapping
      if (typeof node.functionName !== 'string' && node.functionName?.nodeType === 'ArrowFunction') {
        const arrowCode = this.emit(node.functionName);
        return `(${arrowCode})(${args.join(', ')})`;
      }

      const functionName = typeof node.functionName === 'string' ? node.functionName : this.emit(node.functionName);
      return `${functionName}(${args.join(', ')})`;
    }

    emitArrayLiteral(node) {
      if (this.options.useShortArraySyntax !== false) {
        // Use short array syntax []
        if (node.elements.length === 0) {
          return '[]';
        }

        const elements = node.elements.map(elem => {
          // Handle null/undefined elements (sparse arrays) by emitting null
          if (elem == null || (elem.value == null && !elem.key)) {
            return 'null';
          }
          const prefix = elem.spread ? '...' : '';
          if (elem.key) {
            return this.emit(elem.key) + ' => ' + prefix + this.emit(elem.value);
          } else {
            const value = this.emit(elem.value);
            // Handle empty emission (e.g., undefined/null value)
            return prefix + (value || 'null');
          }
        });

        return '[' + elements.join(', ') + ']';
      } else {
        // Use array() syntax
        if (node.elements.length === 0) {
          return 'array()';
        }

        const elements = node.elements.map(elem => {
          // Handle null/undefined elements (sparse arrays) by emitting null
          if (elem == null || (elem.value == null && !elem.key)) {
            return 'null';
          }
          const prefix = elem.spread ? '...' : '';
          if (elem.key) {
            return this.emit(elem.key) + ' => ' + prefix + this.emit(elem.value);
          } else {
            const value = this.emit(elem.value);
            return prefix + (value || 'null');
          }
        });

        return 'array(' + elements.join(', ') + ')';
      }
    }

    emitNew(node) {
      const args = node.arguments.map(a => this.emit(a));
      // Handle class name that might be an object (emit it) instead of a string
      let className = node.className;
      if (typeof className !== 'string') {
        if (className && className.nodeType)
          className = this.emit(className);
        else if (className && className.name)
          className = className.name;
        else if (className && className.identifier)
          className = className.identifier;
        else
          className = String(className);
      }
      return `new ${className}(${args.join(', ')})`;
    }

    emitTernary(node) {
      // PHP 8 requires parentheses around nested ternary expressions
      // To be safe, always wrap ternary sub-expressions in parentheses
      let elseExpr = this.emit(node.elseExpression);
      if (node.elseExpression && node.elseExpression.nodeType === 'Ternary') {
        elseExpr = `(${elseExpr})`;
      }

      let condition = this.emit(node.condition);
      if (node.condition && node.condition.nodeType === 'Ternary') {
        condition = `(${condition})`;
      }

      let thenExpr = this.emit(node.thenExpression);
      if (node.thenExpression && node.thenExpression.nodeType === 'Ternary') {
        thenExpr = `(${thenExpr})`;
      }

      // Wrap the entire ternary in parentheses to avoid operator precedence issues
      // This is especially important when ternaries appear in expressions like "a + (b ? c : d)"
      return `(${condition} ? ${thenExpr} : ${elseExpr})`;
    }

    emitNullCoalescing(node) {
      return `${this.emit(node.left)} ?? ${this.emit(node.right)}`;
    }

    emitShortTernary(node) {
      // PHP Elvis operator: $a ?: $b (returns $a if truthy, else $b)
      // Wrap in parens for operator precedence safety
      return `(${this.emit(node.left)} ?: ${this.emit(node.right)})`;
    }

    emitInstanceof(node) {
      return `${this.emit(node.expression)} instanceof ${node.className}`;
    }

    emitArrowFunction(node) {
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      const body = this.emit(node.body);
      return `fn(${params.join(', ')}) => ${body}`;
    }

    emitClosure(node) {
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      let code = 'function(' + params.join(', ') + ')';

      if (node.useVariables.length > 0) {
        const useVars = node.useVariables.map(v => {
          // Handle by-reference variables (prefixed with &)
          if (v.startsWith('&'))
            return '&$' + v.substring(1);
          return '$' + v;
        });
        code += ' use (' + useVars.join(', ') + ')';
      }

      code += ' {' + this.newline;
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.indent() + '}';

      return code;
    }

    emitCast(node) {
      const typeStr = typeof node.targetType === 'string' ? node.targetType : node.targetType.toString();
      return `(${typeStr})${this.emit(node.expression)}`;
    }

    emitSpreadElement(node) {
      // PHP spread operator: ...array
      return `...${this.emit(node.argument)}`;
    }

    emitStringInterpolation(node) {
      // PHP cannot interpolate function calls or complex expressions in strings
      // Use concatenation instead: "prefix " . expr . " suffix"
      const segments = [];
      let currentString = '';

      for (const part of node.parts) {
        if (typeof part === 'string') {
          currentString += part.replace(/\\/g, '\\\\')
                               .replace(/'/g, "\\'");
        } else {
          // Push current string segment if any
          if (currentString) {
            segments.push(`'${currentString}'`);
            currentString = '';
          }
          // For simple variables, we can use direct emission
          // For complex expressions (function calls, etc.), just emit directly
          const emitted = this.emit(part);
          segments.push(emitted);
        }
      }

      // Push final string segment if any
      if (currentString) {
        segments.push(`'${currentString}'`);
      }

      // Join with . for concatenation
      if (segments.length === 0) return "''";
      if (segments.length === 1) return segments[0];
      return segments.join(' . ');
    }

    emitClassConstant(node) {
      return `${node.className}::${node.constantName}`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ CONSTANTS ]========================

    emitConst(node) {
      let code = '';

      if (node.visibility === 'pub' || node.visibility === 'public') {
        code += 'const ';
      } else {
        code += 'const ';
      }

      code += node.name;

      if (node.value) {
        code += ' = ' + this.emit(node.value);
      }

      code += ';';

      return this.line(code);
    }

    // ========================[ DOCUMENTATION ]========================

    emitDocComment(node) {
      if (this.options.addDocBlocks === false) {
        return '';
      }

      const lines = node.text.split('\n');

      let code = this.line('/**');
      for (const line of lines) {
        code += this.line(' * ' + line.trim());
      }
      code += this.line(' */');

      return code;
    }

    // ========================[ RAW CODE ]========================

    emitRawCode(node) {
      return this.line(node.code);
    }
  }

  // Export
  const exports = { PhpEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PhpEmitter = PhpEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
