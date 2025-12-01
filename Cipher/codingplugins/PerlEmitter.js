/**
 * PerlEmitter.js - Perl Code Generator from Perl AST
 * Generates properly formatted Perl source code from PerlAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Perl AST -> Perl Emitter -> Perl Source
 */

(function(global) {
  'use strict';

  // Load PerlAST if available
  let PerlAST;
  if (typeof require !== 'undefined') {
    PerlAST = require('./PerlAST.js');
  } else if (global.PerlAST) {
    PerlAST = global.PerlAST;
  }

  /**
   * Perl Code Emitter
   * Generates formatted Perl code from a Perl AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - useStrict: boolean - Add 'use strict'. Default: true
   * - useWarnings: boolean - Add 'use warnings'. Default: true
   */
  class PerlEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /**
     * Emit Perl code from a Perl AST node
     * @param {PerlNode} node - The AST node to emit
     * @returns {string} Generated Perl code
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

      // Package declaration
      if (node.packageName && node.packageName !== 'main') {
        code += this.line(`package ${node.packageName};`);
        code += this.newline;
      }

      // Pragmas
      for (const pragma of node.pragmas) {
        code += this.line(`${pragma};`);
      }
      if (node.pragmas.length > 0) {
        code += this.newline;
      }

      // Use declarations
      for (const use of node.uses) {
        code += this.emit(use);
      }
      if (node.uses.length > 0) {
        code += this.newline;
      }

      // Statements
      for (const stmt of node.statements) {
        code += this.emit(stmt);
        code += this.newline;
      }

      // End with 1; for modules
      if (node.packageName && node.packageName !== 'main') {
        code += this.newline + this.line('1;');
      }

      return code;
    }

    emitUse(node) {
      let code = node.isRequire ? 'require ' : 'use ';
      code += node.module;

      if (node.version) {
        code += ' ' + node.version;
      }

      if (node.imports && Array.isArray(node.imports)) {
        code += ' qw(' + node.imports.join(' ') + ')';
      }

      return this.line(code + ';');
    }

    // ========================[ PACKAGE/CLASS ]========================

    emitPackage(node) {
      let code = this.line(`package ${node.name};`);
      code += this.newline;

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      code += this.newline + this.line('1;');

      return code;
    }

    emitClass(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      if (node.useModernClass) {
        // Modern Perl 5.38+ class syntax
        code += this.line(`class ${node.name}`);
        if (node.baseClass) {
          code += ' :isa(' + node.baseClass + ')';
        }
        code += ' {' + this.newline;

        this.indentLevel++;

        // Fields
        for (const field of node.fields) {
          code += this.emit(field);
        }

        if (node.fields.length > 0 && node.methods.length > 0) {
          code += this.newline;
        }

        // Methods
        for (const method of node.methods) {
          code += this.emit(method);
          code += this.newline;
        }

        this.indentLevel--;
        code += this.line('}');
      } else {
        // Traditional Moo/Moose style
        code += this.line(`package ${node.name};`);
        code += this.line('use Moo;');

        if (node.baseClass) {
          code += this.line(`extends '${node.baseClass}';`);
        }

        code += this.newline;

        // Fields as 'has' declarations
        for (const field of node.fields) {
          code += this.emitFieldAsMoo(field);
        }

        if (node.fields.length > 0 && node.methods.length > 0) {
          code += this.newline;
        }

        // Methods
        for (const method of node.methods) {
          code += this.emit(method);
          code += this.newline;
        }

        code += this.line('1;');
      }

      return code;
    }

    emitField(node) {
      // For modern class keyword
      let code = this.indent() + 'field $' + node.name;

      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }

      return code + ';' + this.newline;
    }

    emitFieldAsMoo(node) {
      // For Moo/Moose
      let code = this.line(`has ${node.name} => (`);
      this.indentLevel++;

      code += this.line('is => ' + (node.isReadOnly ? '"ro"' : '"rw"') + ',');

      if (node.type) {
        code += this.line(`isa => ${node.type.toString()},`);
      }

      if (node.defaultValue) {
        code += this.line('default => ' + this.emit(node.defaultValue) + ',');
      }

      if (node.isRequired) {
        code += this.line('required => 1,');
      }

      this.indentLevel--;
      code += this.line(');');

      return code;
    }

    // ========================[ SUBROUTINES ]========================

    emitSub(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Subroutine declaration
      let decl = 'sub ' + node.name;

      if (node.useSignatures && node.parameters.length > 0) {
        // Modern Perl signatures
        const params = node.parameters.map(p => this.emitParameterSignature(p));
        decl += ' (' + params.join(', ') + ')';
      }

      code += this.line(decl + ' {');

      this.indentLevel++;

      // Traditional parameter extraction if not using signatures
      if (!node.useSignatures && node.parameters.length > 0) {
        const params = node.parameters.map((p, i) => {
          return `my ${p.sigil}${p.name} = $_[${i}];`;
        });
        code += this.line(params.join(' '));
        code += this.newline;
      }

      // Body
      if (node.body) {
        code += this.emitBlockContents(node.body);
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitParameterSignature(node) {
      let param = node.sigil + node.name;

      if (node.defaultValue) {
        param += ' = ' + this.emit(node.defaultValue);
      }

      return param;
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

    emitVarDeclaration(node) {
      let code = node.declarator + ' ' + node.sigil + node.name;

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
      const keyword = node.isUnless ? 'unless' : 'if';
      let code = this.line(keyword + ' (' + this.emit(node.condition) + ') {');

      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;
      code += this.line('}');

      // elsif branches
      for (const elsif of node.elsifBranches) {
        code = code.trimEnd();
        code += ' elsif (' + this.emit(elsif.condition) + ') {' + this.newline;
        this.indentLevel++;
        code += this.emitBlockContents(elsif.body);
        this.indentLevel--;
        code += this.line('}');
      }

      // else branch
      if (node.elseBranch) {
        code = code.trimEnd();
        code += ' else {' + this.newline;
        this.indentLevel++;
        code += this.emitBlockContents(node.elseBranch);
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitFor(node) {
      if (node.isCStyle) {
        // C-style for loop
        let code = 'for (';
        if (node.init) code += this.emit(node.init).trim();
        code += '; ';
        if (node.condition) code += this.emit(node.condition);
        code += '; ';
        if (node.increment) code += this.emit(node.increment);
        code += ') {' + this.newline;

        this.indentLevel++;
        code = this.line(code.trim());
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line('}');

        return code;
      }

      // foreach loop
      let code = this.line('foreach my ' + node.variable + ' (' + this.emit(node.iterable) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      const keyword = node.isUntil ? 'until' : 'while';

      if (node.isDoWhile) {
        let code = this.line('do {');
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line('} ' + keyword + ' (' + this.emit(node.condition) + ');');
        return code;
      }

      let code = this.line(keyword + ' (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitLast(node) {
      let code = 'last';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitNext(node) {
      let code = 'next';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitRedo(node) {
      let code = 'redo';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitDie(node) {
      return this.line('die ' + this.emit(node.message) + ';');
    }

    emitTry(node) {
      if (node.useModernTry) {
        // Modern try/catch syntax
        let code = this.line('try {');
        this.indentLevel++;
        code += this.emitBlockContents(node.tryBlock);
        this.indentLevel--;
        code += this.line('}');

        if (node.catchBlock) {
          code = code.trimEnd();
          code += ' catch (' + node.catchVariable + ') {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.catchBlock);
          this.indentLevel--;
          code += this.line('}');
        }

        if (node.finallyBlock) {
          code = code.trimEnd();
          code += ' finally {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.finallyBlock);
          this.indentLevel--;
          code += this.line('}');
        }

        return code;
      } else {
        // Try::Tiny style
        let code = this.line('try {');
        this.indentLevel++;
        code += this.emitBlockContents(node.tryBlock);
        this.indentLevel--;
        code += this.line('}');

        if (node.catchBlock) {
          code += this.line('catch {');
          this.indentLevel++;
          code += this.line('my ' + node.catchVariable + ' = $_;');
          code += this.emitBlockContents(node.catchBlock);
          this.indentLevel--;
          code += this.line('};');
        }

        if (node.finallyBlock) {
          code += this.line('finally {');
          this.indentLevel++;
          code += this.emitBlockContents(node.finallyBlock);
          this.indentLevel--;
          code += this.line('};');
        }

        return code;
      }
    }

    emitGiven(node) {
      let code = this.line('given (' + this.emit(node.expression) + ') {');
      this.indentLevel++;

      for (const whenClause of node.whenClauses) {
        code += this.emit(whenClause);
      }

      if (node.defaultClause) {
        code += this.line('default {');
        this.indentLevel++;
        code += this.emitBlockContents(node.defaultClause);
        this.indentLevel--;
        code += this.line('}');
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhen(node) {
      let code = this.line('when (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'undef') {
        return 'undef';
      }

      if (node.literalType === 'number') {
        return String(node.value);
      }

      if (node.literalType === 'hex') {
        return '0x' + node.value.toString(16).toUpperCase();
      }

      if (node.literalType === 'string') {
        const delimiter = node.stringDelimiter || "'";
        let escaped = String(node.value);

        if (delimiter === '"') {
          // Double-quoted string - escape special chars
          escaped = escaped
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\$/g, '\\$')
            .replace(/@/g, '\\@');
        } else {
          // Single-quoted string - only escape single quotes and backslashes
          escaped = escaped
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");
        }

        return delimiter + escaped + delimiter;
      }

      return String(node.value);
    }

    emitIdentifier(node) {
      return node.sigil + node.name;
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

    emitMemberAccess(node) {
      const object = this.emit(node.object);
      let member;

      if (typeof node.member === 'string') {
        member = node.member;
      } else {
        member = this.emit(node.member);
      }

      if (node.accessType === '->') {
        return `${object}->${member}`;
      } else if (node.accessType === '{key}') {
        return `${object}{${member}}`;
      } else if (node.accessType === '[index]') {
        return `${object}[${member}]`;
      }

      return `${object}->${member}`;
    }

    emitSubscript(node) {
      const object = this.emit(node.object);
      const index = this.emit(node.index);

      if (node.subscriptType === 'array') {
        return `${object}[${index}]`;
      } else {
        return `${object}{${index}}`;
      }
    }

    emitCall(node) {
      const callee = typeof node.callee === 'string' ? node.callee : this.emit(node.callee);
      const args = node.args.map(a => this.emit(a));

      if (node.isMethodCall) {
        return `${callee}(${args.join(', ')})`;
      }

      return `${callee}(${args.join(', ')})`;
    }

    emitArray(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `(${elements.join(', ')})`;
    }

    emitHash(node) {
      const pairs = node.pairs.map(p => {
        const key = typeof p.key === 'string' ? p.key : this.emit(p.key);
        const value = this.emit(p.value);
        return `${key} => ${value}`;
      });
      return `(${pairs.join(', ')})`;
    }

    emitAnonSub(node) {
      let code = 'sub';

      if (node.parameters && node.parameters.length > 0) {
        const params = node.parameters.map(p => p.sigil + p.name);
        code += ' (' + params.join(', ') + ')';
      }

      code += ' {' + this.newline;
      this.indentLevel++;

      if (node.body) {
        code += this.emitBlockContents(node.body);
      }

      this.indentLevel--;
      code += this.indent() + '}';

      return code;
    }

    emitBless(node) {
      return `bless ${this.emit(node.reference)}, '${node.className}'`;
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.consequent)} : ${this.emit(node.alternate)}`;
    }

    emitList(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `(${elements.join(', ')})`;
    }

    emitQw(node) {
      return `qw(${node.words.join(' ')})`;
    }

    emitRegex(node) {
      return `/${node.pattern}/${node.modifiers}`;
    }

    emitStringInterpolation(node) {
      let result = '"';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          // String literal part
          result += part
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/@/g, '\\@');
        } else {
          // Expression part - emit as ${expr}
          result += '${' + this.emit(part) + '}';
        }
      }
      result += '"';
      return result;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitPOD(node) {
      let code = this.line('=' + node.podType);
      code += this.newline;
      code += this.line(node.content);
      code += this.newline;
      code += this.line('=cut');
      return code;
    }

    emitComment(node) {
      return this.line('# ' + node.text);
    }
  }

  // Export
  const exports = { PerlEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PerlEmitter = PerlEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
