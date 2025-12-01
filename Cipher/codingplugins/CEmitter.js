/**
 * CEmitter.js - C Code Generator from C AST
 * Generates properly formatted C source code from CAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C AST -> C Emitter -> C Source
 */

(function(global) {
  'use strict';

  // Load CAST if available
  let CAST;
  if (typeof require !== 'undefined') {
    CAST = require('./CAST.js');
  } else if (global.CAST) {
    CAST = global.CAST;
  }

  /**
   * C Code Emitter
   * Generates formatted C code from a C AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Emit comments. Default: true
   */
  class CEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /**
     * Emit C code from a C AST node
     * @param {CNode} node - The AST node to emit
     * @returns {string} Generated C code
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
      let code = '';

      // File header comment
      if (node.headerComment && this.options.addComments !== false) {
        code += this.emit(node.headerComment);
        code += this.newline;
      }

      // Includes
      for (const include of node.includes) {
        code += this.emit(include);
      }
      if (node.includes.length > 0) {
        code += this.newline;
      }

      // Defines
      for (const define of node.defines) {
        code += this.emit(define);
      }
      if (node.defines.length > 0) {
        code += this.newline;
      }

      // Typedefs
      for (const typedef of node.typedefs) {
        code += this.emit(typedef);
      }
      if (node.typedefs.length > 0) {
        code += this.newline;
      }

      // Structs
      for (const struct of node.structs) {
        code += this.emit(struct);
        code += this.newline;
      }

      // Enums
      for (const enumDecl of node.enums) {
        code += this.emit(enumDecl);
        code += this.newline;
      }

      // Function prototypes
      for (const proto of node.prototypes) {
        code += this.emitFunctionPrototype(proto);
      }
      if (node.prototypes.length > 0) {
        code += this.newline;
      }

      // Global variables
      for (const globalVar of node.globals) {
        code += this.emitGlobalVariable(globalVar);
      }
      if (node.globals.length > 0) {
        code += this.newline;
      }

      // Functions
      for (const func of node.functions) {
        code += this.emit(func);
        code += this.newline;
      }

      return code;
    }

    emitInclude(node) {
      if (node.isSystem) {
        return this.line(`#include <${node.path}>`);
      } else {
        return this.line(`#include "${node.path}"`);
      }
    }

    emitDefine(node) {
      if (node.value === null) {
        return this.line(`#define ${node.name}`);
      }

      let value = node.value;
      if (typeof value === 'object' && value.nodeType) {
        value = this.emit(value);
      }

      return this.line(`#define ${node.name} ${value}`);
    }

    emitTypedef(node) {
      let code = 'typedef ';

      if (node.targetType.nodeType === 'Struct') {
        code += this.emit(node.targetType);
        code += ` ${node.name};`;
      } else {
        code += `${this.emit(node.targetType)} ${node.name};`;
      }

      return this.line(code);
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitStruct(node) {
      let code = '';

      // Doc comment
      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      if (node.isTypedef) {
        code += this.line(`typedef struct ${node.tag || ''} {`);
      } else {
        code += this.line(`struct ${node.name} {`);
      }

      this.indentLevel++;

      for (const field of node.fields) {
        code += this.emit(field);
      }

      this.indentLevel--;

      if (node.isTypedef) {
        code += this.line(`} ${node.name};`);
      } else {
        code += this.line('};');
      }

      return code;
    }

    emitField(node) {
      let code = this.emit(node.type) + ' ' + node.name;

      if (node.bitWidth !== null) {
        code += ' : ' + node.bitWidth;
      }

      return this.line(code + ';');
    }

    emitEnum(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      if (node.isTypedef) {
        code += this.line(`typedef enum {`);
      } else {
        code += this.line(`enum ${node.name} {`);
      }

      this.indentLevel++;

      for (let i = 0; i < node.values.length; i++) {
        const value = node.values[i];
        code += this.emit(value);
        if (i < node.values.length - 1) {
          code = code.trimEnd() + ',' + this.newline;
        }
      }

      this.indentLevel--;

      if (node.isTypedef) {
        code += this.line(`} ${node.name};`);
      } else {
        code += this.line('};');
      }

      return code;
    }

    emitEnumValue(node) {
      let code = this.indent() + node.name;
      if (node.value !== null) {
        code += ' = ' + this.emit(node.value);
      }
      return code;
    }

    // ========================[ FUNCTIONS ]========================

    emitFunction(node) {
      let code = '';

      // Doc comment
      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.isInline) decl += 'inline ';
      if (node.isExtern) decl += 'extern ';

      decl += this.emit(node.returnType) + ' ';
      decl += node.name;

      // Parameters
      decl += '(';

      if (node.parameters.length === 0) {
        decl += 'void';
      } else {
        const params = node.parameters.map(p => this.emitParameterDecl(p));
        decl += params.join(', ');
      }

      decl += ')';

      code += this.line(decl + ' {');

      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line('}');

      return code;
    }

    emitFunctionPrototype(node) {
      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.isInline) decl += 'inline ';
      if (node.isExtern) decl += 'extern ';

      decl += this.emit(node.returnType) + ' ';
      decl += node.name;

      // Parameters
      decl += '(';

      if (node.parameters.length === 0) {
        decl += 'void';
      } else {
        const params = node.parameters.map(p => this.emitParameterDecl(p));
        decl += params.join(', ');
      }

      decl += ');';

      return this.line(decl);
    }

    emitParameterDecl(node) {
      return this.emit(node.type) + ' ' + node.name;
    }

    emitGlobalVariable(node) {
      let code = this.emit(node.type) + ' ' + node.name;

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code + ';');
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

    emitVariable(node) {
      let code = this.emit(node.type) + ' ' + node.name;

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
          // else if
          code = code.trimEnd() + ' else ';
          const elseIfCode = this.emitIf(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code = code.trimEnd() + ' else {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      let code = this.indent() + 'for (';

      // Init
      if (node.init) {
        const initCode = this.emit(node.init);
        // Remove trailing semicolon and newline from init
        code += initCode.trim().replace(/;$/, '');
      }
      code += '; ';

      // Condition
      if (node.condition) {
        code += this.emit(node.condition);
      }
      code += '; ';

      // Update
      if (node.update) {
        code += this.emit(node.update);
      }

      code += ') {' + this.newline;

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

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitCase(node) {
      let code = '';

      if (node.isDefault) {
        code += this.line('default:');
      } else {
        code += this.line('case ' + this.emit(node.value) + ':');
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

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'bool') {
        return node.value ? 'true' : 'false';
      }

      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }

      if (node.literalType === 'char') {
        return `'${node.value}'`;
      }

      if (node.literalType === 'null') {
        return 'NULL';
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
      const op = node.isPointer ? '->' : '.';
      return `${this.emit(node.target)}${op}${node.member}`;
    }

    emitArraySubscript(node) {
      return `${this.emit(node.array)}[${this.emit(node.index)}]`;
    }

    emitCall(node) {
      const callee = typeof node.callee === 'string' ? node.callee : this.emit(node.callee);
      const args = node.arguments.map(a => this.emit(a));
      return `${callee}(${args.join(', ')})`;
    }

    emitCast(node) {
      return `(${this.emit(node.type)})${this.emit(node.expression)}`;
    }

    emitSizeof(node) {
      if (node.isType) {
        return `sizeof(${this.emit(node.target)})`;
      } else {
        return `sizeof ${this.emit(node.target)}`;
      }
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.thenExpression)} : ${this.emit(node.elseExpression)}`;
    }

    emitArrayInitializer(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `{${elements.join(', ')}}`;
    }

    emitStructInitializer(node) {
      if (node.fields.length === 0) {
        return '{0}';
      }

      const fields = node.fields.map(f => `.${f.name} = ${this.emit(f.value)}`);
      return `{${fields.join(', ')}}`;
    }

    emitComma(node) {
      const expressions = node.expressions.map(e => this.emit(e));
      return `(${expressions.join(', ')})`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitComment(node) {
      if (this.options.addComments === false) {
        return '';
      }

      if (node.isBlock) {
        const lines = node.text.split('\n');
        let code = this.line('/*');
        for (const line of lines) {
          code += this.line(' * ' + line.trim());
        }
        code += this.line(' */');
        return code;
      } else {
        return this.line('// ' + node.text);
      }
    }
  }

  // Export
  const exports = { CEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CEmitter = CEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
