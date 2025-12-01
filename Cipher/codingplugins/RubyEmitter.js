/**
 * RubyEmitter.js - Ruby Code Generator from Ruby AST
 * Generates properly formatted Ruby source code from RubyAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Ruby AST -> Ruby Emitter -> Ruby Source
 */

(function(global) {
  'use strict';

  // Load RubyAST if available
  let RubyAST;
  if (typeof require !== 'undefined') {
    RubyAST = require('./RubyAST.js');
  } else if (global.RubyAST) {
    RubyAST = global.RubyAST;
  }

  /**
   * Ruby Code Emitter
   * Generates formatted Ruby code from a Ruby AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '  ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Emit documentation comments. Default: true
   * - useSymbolKeys: boolean - Use symbols for hash keys. Default: true
   */
  class RubyEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '  ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /**
     * Emit Ruby code from a Ruby AST node
     */
    emit(node) {
      if (!node) return '';

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

      // Magic comments
      for (const magic of node.magicComments) {
        code += this.emit(magic);
      }

      if (node.magicComments.length > 0) {
        code += this.newline;
      }

      // Module doc comment
      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
        code += this.newline;
      }

      // Requires
      for (const req of node.requires) {
        code += this.emit(req);
      }
      if (node.requires.length > 0) {
        code += this.newline;
      }

      // Items
      for (const item of node.items) {
        code += this.emit(item);
        code += this.newline;
      }

      return code;
    }

    emitRequire(node) {
      const keyword = node.isRelative ? 'require_relative' : 'require';
      return this.line(`${keyword} '${node.path}'`);
    }

    emitMagicComment(node) {
      return this.line(`# ${node.name}: ${node.value}`);
    }

    // ========================[ CLASS/MODULE ]========================

    emitClass(node) {
      let code = '';

      // Doc comment
      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Class declaration
      let decl = 'class ' + node.name;
      if (node.superclass) {
        decl += ' < ' + node.superclass;
      }
      code += this.line(decl);

      this.indentLevel++;

      // Includes/extends
      for (const mod of node.modules) {
        code += this.line(`include ${mod}`);
      }

      // Attributes
      for (const attr of node.attributes) {
        code += this.emit(attr);
      }

      if (node.attributes.length > 0) {
        code += this.newline;
      }

      // Constants
      for (const constant of node.constants) {
        code += this.emit(constant);
      }

      // Class variables
      for (const classVar of node.classVariables) {
        code += this.emit(classVar);
      }

      if ((node.constants.length > 0 || node.classVariables.length > 0) && node.methods.length > 0) {
        code += this.newline;
      }

      // Methods
      for (let i = 0; i < node.methods.length; i++) {
        code += this.emit(node.methods[i]);
        if (i < node.methods.length - 1) {
          code += this.newline;
        }
      }

      this.indentLevel--;
      code += this.line('end');

      return code;
    }

    emitModuleDef(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      code += this.line('module ' + node.name);
      this.indentLevel++;

      for (const constant of node.constants) {
        code += this.emit(constant);
      }

      for (let i = 0; i < node.methods.length; i++) {
        code += this.emit(node.methods[i]);
        if (i < node.methods.length - 1) {
          code += this.newline;
        }
      }

      this.indentLevel--;
      code += this.line('end');

      return code;
    }

    emitAttribute(node) {
      const attrType = 'attr_' + node.type;
      return this.line(`${attrType} ${node.names.join(', ')}`);
    }

    // ========================[ METHODS ]========================

    emitMethod(node) {
      let code = '';

      // Doc comment
      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Method declaration
      let decl = 'def ';
      if (node.isClassMethod) {
        decl += 'self.';
      }
      decl += node.name;

      // Parameters
      if (node.parameters.length > 0) {
        const params = node.parameters.map(p => this.emitParameterDecl(p));
        decl += '(' + params.join(', ') + ')';
      }

      // Endless method (Ruby 3+)
      if (node.isEndless && this.options.useModernSyntax !== false && node.body && node.body.statements.length === 1) {
        code += this.line(decl + ' = ' + this.emit(node.body.statements[0]));
        return code;
      }

      code += this.line(decl);

      // Body
      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line('end');

      return code;
    }

    emitParameterDecl(node) {
      let decl = '';

      if (node.isRest) {
        decl += '*';
      } else if (node.isKeywordRest) {
        decl += '**';
      } else if (node.isBlock) {
        decl += '&';
      }

      decl += node.name;

      if (node.isKeyword && !node.isRest && !node.isKeywordRest && !node.isBlock) {
        decl += ':';
      }

      if (node.defaultValue) {
        decl += ' = ' + this.emit(node.defaultValue);
      }

      return decl;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = '';
      if (!node || !node.statements) {
        return code;
      }

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

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

    emitAssignment(node) {
      const target = this.emit(node.target);
      const value = this.emit(node.value);
      return this.line(`${target} ${node.operator} ${value}`);
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression));
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line('return ' + this.emit(node.expression));
      }
      return this.line('return');
    }

    emitIf(node) {
      let code = '';

      // Modifier form (statement if condition)
      if (node.isModifier) {
        const keyword = node.isUnless ? 'unless' : 'if';
        const stmt = this.emit(node.thenBranch.statements[0]);
        code = this.line(stmt.trim() + ' ' + keyword + ' ' + this.emit(node.condition));
        return code;
      }

      // Regular if/unless
      const keyword = node.isUnless ? 'unless' : 'if';
      code = this.line(keyword + ' ' + this.emit(node.condition));

      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;

      // Elsif branches
      for (const elsif of node.elsifBranches) {
        code += this.line('elsif ' + this.emit(elsif.condition));
        this.indentLevel++;
        code += this.emitBlockContents(elsif.body);
        this.indentLevel--;
      }

      // Else branch
      if (node.elseBranch) {
        code += this.line('else');
        this.indentLevel++;
        code += this.emitBlockContents(node.elseBranch);
        this.indentLevel--;
      }

      code += this.line('end');

      return code;
    }

    emitCase(node) {
      let code = this.line('case ' + this.emit(node.expression));

      for (const whenBranch of node.whenBranches) {
        code += this.emit(whenBranch);
      }

      if (node.elseBranch) {
        code += this.line('else');
        this.indentLevel++;
        code += this.emitBlockContents(node.elseBranch);
        this.indentLevel--;
      }

      code += this.line('end');

      return code;
    }

    emitWhen(node) {
      const patterns = node.patterns.map(p => this.emit(p)).join(', ');
      let code = this.line('when ' + patterns);

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      return code;
    }

    emitFor(node) {
      let code = this.line('for ' + node.variable + ' in ' + this.emit(node.iterable));

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      code += this.line('end');

      return code;
    }

    emitWhile(node) {
      const keyword = node.isUntil ? 'until' : 'while';
      let code = this.line(keyword + ' ' + this.emit(node.condition));

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      code += this.line('end');

      return code;
    }

    emitLoop(node) {
      let code = this.line('loop do');

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      code += this.line('end');

      return code;
    }

    emitBreak(node) {
      if (node.expression) {
        return this.line('break ' + this.emit(node.expression));
      }
      return this.line('break');
    }

    emitNext(node) {
      if (node.expression) {
        return this.line('next ' + this.emit(node.expression));
      }
      return this.line('next');
    }

    emitRaise(node) {
      let code = 'raise ';
      if (node.exception) {
        code += this.emit(node.exception);
      }
      if (node.message) {
        code += ', ' + this.emit(node.message);
      }
      return this.line(code);
    }

    emitBegin(node) {
      let code = this.line('begin');

      this.indentLevel++;
      if (node.tryBlock) {
        code += this.emitBlockContents(node.tryBlock);
      }
      this.indentLevel--;

      for (const rescue of node.rescueClauses) {
        code += this.emit(rescue);
      }

      if (node.elseBlock) {
        code += this.line('else');
        this.indentLevel++;
        code += this.emitBlockContents(node.elseBlock);
        this.indentLevel--;
      }

      if (node.ensureBlock) {
        code += this.line('ensure');
        this.indentLevel++;
        code += this.emitBlockContents(node.ensureBlock);
        this.indentLevel--;
      }

      code += this.line('end');

      return code;
    }

    emitRescue(node) {
      let code = 'rescue';

      if (node.exceptionTypes && node.exceptionTypes.length > 0) {
        code += ' ' + node.exceptionTypes.join(', ');
      }

      if (node.variableName) {
        code += ' => ' + node.variableName;
      }

      code = this.line(code);

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'nil') return 'nil';
      if (node.literalType === 'true') return 'true';
      if (node.literalType === 'false') return 'false';

      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }

      if (node.literalType === 'symbol') {
        return `:${node.value}`;
      }

      if (node.literalType === 'regexp') {
        const flags = node.flags || '';
        return `/${node.value}/${flags}`;
      }

      // Numeric
      if (node.literalType === 'integer' || node.literalType === 'float') {
        return String(node.value);
      }

      return String(node.value);
    }

    emitIdentifier(node) {
      let prefix = '';
      if (node.isInstance) prefix = '@';
      else if (node.isClass) prefix = '@@';
      else if (node.isGlobal) prefix = '$';

      return prefix + node.name;
    }

    emitBinaryExpression(node) {
      const left = this.emit(node.left);
      const right = this.emit(node.right);
      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      // Space for 'not'
      if (node.operator === 'not') {
        return `not ${operand}`;
      }

      return `${node.operator}${operand}`;
    }

    emitMethodCall(node) {
      let code = '';

      if (node.receiver) {
        code += this.emit(node.receiver);
        code += node.isSafeNavigation ? '&.' : '.';
      }

      code += node.methodName;

      // Arguments
      if (node.arguments.length > 0) {
        const args = node.arguments.map(a => this.emit(a));
        code += '(' + args.join(', ') + ')';
      }

      // Block
      if (node.block) {
        code += ' ' + this.emit(node.block);
      }

      return code;
    }

    emitArrayLiteral(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `[${elements.join(', ')}]`;
    }

    emitHashLiteral(node) {
      if (node.pairs.length === 0) {
        return '{}';
      }

      const pairs = node.pairs.map(p => {
        const key = this.emit(p.key);
        const value = this.emit(p.value);

        // Modern syntax for symbol keys
        if (p.key.literalType === 'symbol' && this.options.useModernSyntax !== false) {
          return `${p.key.value}: ${value}`;
        }

        return `${key} => ${value}`;
      });

      return `{ ${pairs.join(', ')} }`;
    }

    emitRange(node) {
      const start = this.emit(node.start);
      const end = this.emit(node.end);
      const op = node.isExclusive ? '...' : '..';
      return `${start}${op}${end}`;
    }

    emitStringInterpolation(node) {
      let code = '"';

      for (const part of node.parts) {
        if (typeof part === 'string') {
          code += part;
        } else {
          code += '#{' + this.emit(part) + '}';
        }
      }

      code += '"';
      return code;
    }

    emitBlockExpression(node) {
      // Determine brace style
      const useBraces = node.isBraces || (node.body.statements.length === 1);

      let code = '';

      // Parameters
      if (node.parameters.length > 0) {
        const params = node.parameters.map(p => p.name);
        code += '|' + params.join(', ') + '| ';
      }

      if (useBraces) {
        code = '{ ' + code;

        if (node.body.statements.length === 1) {
          code += this.emit(node.body.statements[0]).trim();
        } else {
          this.indentLevel++;
          code += this.newline;
          code += this.emitBlockContents(node.body);
          this.indentLevel--;
          code += this.indent();
        }

        code += ' }';
      } else {
        code = 'do ' + code;
        code += this.newline;

        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;

        code += this.indent() + 'end';
      }

      return code;
    }

    emitLambda(node) {
      let code = '';

      // Stabby lambda (->)
      if (node.isStabby && this.options.useModernSyntax !== false) {
        code = '->';

        if (node.parameters.length > 0) {
          const params = node.parameters.map(p => p.name);
          code += '(' + params.join(', ') + ')';
        }

        code += ' { ';

        if (node.body.statements.length === 1) {
          code += this.emit(node.body.statements[0]).trim();
        } else {
          this.indentLevel++;
          code += this.newline;
          code += this.emitBlockContents(node.body);
          this.indentLevel--;
          code += this.indent();
        }

        code += ' }';
      } else {
        // lambda { |x| ... }
        code = 'lambda { ';

        if (node.parameters.length > 0) {
          const params = node.parameters.map(p => p.name);
          code += '|' + params.join(', ') + '| ';
        }

        if (node.body.statements.length === 1) {
          code += this.emit(node.body.statements[0]).trim();
        } else {
          this.indentLevel++;
          code += this.newline;
          code += this.emitBlockContents(node.body);
          this.indentLevel--;
          code += this.indent();
        }

        code += ' }';
      }

      return code;
    }

    emitIndex(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitConditional(node) {
      const cond = this.emit(node.condition);
      const thenExpr = this.emit(node.thenExpression);
      const elseExpr = this.emit(node.elseExpression);

      return `${cond} ? ${thenExpr} : ${elseExpr}`;
    }

    emitSplat(node) {
      const prefix = node.isDoubleSplat ? '**' : '*';
      return `${prefix}${this.emit(node.expression)}`;
    }

    emitConstantAccess(node) {
      if (node.namespace) {
        return `${node.namespace}::${node.constant}`;
      }
      return node.constant;
    }

    emitYield(node) {
      if (node.arguments.length > 0) {
        const args = node.arguments.map(a => this.emit(a));
        return `yield(${args.join(', ')})`;
      }
      return 'yield';
    }

    emitSuper(node) {
      if (node.arguments === null) {
        return 'super';
      }
      if (node.arguments.length === 0) {
        return 'super()';
      }
      const args = node.arguments.map(a => this.emit(a));
      return `super(${args.join(', ')})`;
    }

    emitDefined(node) {
      return `defined?(${this.emit(node.expression)})`;
    }

    // ========================[ DOCUMENTATION ]========================

    emitDocComment(node) {
      if (this.options.addComments === false) {
        return '';
      }

      const lines = node.text.split('\n');
      const prefix = node.isYard ? '# ' : '# ';

      let code = '';
      for (const line of lines) {
        code += this.line(prefix + line.trim());
      }

      return code;
    }

    emitConstant(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      code += this.line(`${node.name} = ${this.emit(node.value)}`);

      return code;
    }
  }

  // Export
  const exports = { RubyEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.RubyEmitter = RubyEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
