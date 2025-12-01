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

    emitBinaryExpression(node) {
      const left = this.emit(node.left);
      const right = this.emit(node.right);
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
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
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
      const functionName = typeof node.functionName === 'string' ? node.functionName : this.emit(node.functionName);
      const args = node.arguments.map(a => this.emit(a));
      return `${functionName}(${args.join(', ')})`;
    }

    emitArrayLiteral(node) {
      if (this.options.useShortArraySyntax !== false) {
        // Use short array syntax []
        if (node.elements.length === 0) {
          return '[]';
        }

        const elements = node.elements.map(elem => {
          if (elem.key) {
            return this.emit(elem.key) + ' => ' + this.emit(elem.value);
          } else {
            return this.emit(elem.value);
          }
        });

        return '[' + elements.join(', ') + ']';
      } else {
        // Use array() syntax
        if (node.elements.length === 0) {
          return 'array()';
        }

        const elements = node.elements.map(elem => {
          if (elem.key) {
            return this.emit(elem.key) + ' => ' + this.emit(elem.value);
          } else {
            return this.emit(elem.value);
          }
        });

        return 'array(' + elements.join(', ') + ')';
      }
    }

    emitNew(node) {
      const args = node.arguments.map(a => this.emit(a));
      return `new ${node.className}(${args.join(', ')})`;
    }

    emitTernary(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.thenExpression)} : ${this.emit(node.elseExpression)}`;
    }

    emitNullCoalescing(node) {
      return `${this.emit(node.left)} ?? ${this.emit(node.right)}`;
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
        const useVars = node.useVariables.map(v => '$' + v);
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

    emitStringInterpolation(node) {
      let result = '"';

      for (const part of node.parts) {
        if (typeof part === 'string') {
          result += part.replace(/\\/g, '\\\\')
                        .replace(/"/g, '\\"')
                        .replace(/\$/g, '\\$');
        } else {
          result += '{' + this.emit(part) + '}';
        }
      }

      result += '"';
      return result;
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
