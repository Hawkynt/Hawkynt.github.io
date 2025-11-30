/**
 * GoEmitter.js - Go Code Generator from Go AST
 * Generates properly formatted Go source code from GoAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Go AST -> Go Emitter -> Go Source
 */

(function(global) {
  'use strict';

  // Load GoAST if available
  let GoAST;
  if (typeof require !== 'undefined') {
    GoAST = require('./GoAST.js');
  } else if (global.GoAST) {
    GoAST = global.GoAST;
  }

  /**
   * Go Code Emitter
   * Generates formatted Go code from a Go AST
   */
  class GoEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '\t'; // Go convention: tabs
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
      this.addComments = options.addComments !== undefined ? options.addComments : true;
    }

    /**
     * Emit Go code from a Go AST node
     * @param {GoNode} node - The AST node to emit
     * @returns {string} Generated Go code
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

    // ========================[ FILE STRUCTURE ]========================

    emitFile(node) {
      let code = '';

      // Package declaration
      code += this.line(`package ${node.package}`);
      code += this.newline;

      // Imports
      if (node.imports.length > 0) {
        if (node.imports.length === 1) {
          code += this.emit(node.imports[0]);
        } else {
          code += this.line('import (');
          this.indentLevel++;
          for (const imp of node.imports) {
            code += this.emitImportInGroup(imp);
          }
          this.indentLevel--;
          code += this.line(')');
        }
        code += this.newline;
      }

      // Declarations
      for (const decl of node.declarations) {
        code += this.emit(decl);
        code += this.newline;
      }

      return code;
    }

    emitImport(node) {
      let imp = 'import ';
      if (node.alias) {
        imp += `${node.alias} `;
      } else if (node.isDot) {
        imp += '. ';
      }
      imp += `"${node.path}"`;
      return this.line(imp);
    }

    emitImportInGroup(node) {
      let imp = '';
      if (node.alias) {
        imp = `${node.alias} `;
      } else if (node.isDot) {
        imp = '. ';
      }
      imp += `"${node.path}"`;
      return this.line(imp);
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitStruct(node) {
      let code = '';

      // Doc comment
      if (this.addComments && node.docComment) {
        code += this.line(`// ${node.docComment}`);
      }

      // Struct declaration
      code += this.line(`type ${node.name} struct {`);
      this.indentLevel++;

      // Fields
      for (const field of node.fields) {
        code += this.emit(field);
      }

      this.indentLevel--;
      code += this.line('}');

      // Methods
      for (const method of node.methods) {
        code += this.newline;
        code += this.emit(method);
      }

      return code;
    }

    emitInterface(node) {
      let code = '';

      if (this.addComments && node.docComment) {
        code += this.line(`// ${node.docComment}`);
      }

      code += this.line(`type ${node.name} interface {`);
      this.indentLevel++;

      for (const method of node.methods) {
        // Interface methods don't have bodies
        code += this.emitInterfaceMethod(method);
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitInterfaceMethod(node) {
      let sig = node.name;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      sig += `(${params.join(', ')})`;

      // Results
      if (node.results.length === 0) {
        // No return
      } else if (node.results.length === 1 && !node.results[0].name) {
        // Single unnamed result
        sig += ` ${this.emitTypeOrParam(node.results[0])}`;
      } else {
        // Multiple or named results
        const results = node.results.map(r => this.emitTypeOrParam(r));
        sig += ` (${results.join(', ')})`;
      }

      return this.line(sig);
    }

    emitTypeAlias(node) {
      let code = '';

      if (this.addComments && node.docComment) {
        code += this.line(`// ${node.docComment}`);
      }

      code += this.line(`type ${node.name} = ${node.targetType.toString()}`);
      return code;
    }

    // ========================[ MEMBERS ]========================

    emitField(node) {
      let code = '';

      if (this.addComments && node.docComment) {
        code += this.line(`// ${node.docComment}`);
      }

      let field = `${node.name} ${node.type.toString()}`;
      if (node.tag) {
        field += ` \`${node.tag}\``;
      }

      return this.line(field);
    }

    emitFunc(node) {
      let code = '';

      if (this.addComments && node.docComment) {
        code += this.line(`// ${node.docComment}`);
      }

      let sig = 'func ';

      // Receiver (for methods)
      if (node.receiver) {
        sig += `(${this.emitParameterDecl(node.receiver)}) `;
      }

      sig += node.name;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      sig += `(${params.join(', ')})`;

      // Results
      if (node.results.length === 0) {
        // No return
      } else if (node.results.length === 1 && !node.results[0].name) {
        // Single unnamed result
        sig += ` ${this.emitTypeOrParam(node.results[0])}`;
      } else {
        // Multiple or named results
        const results = node.results.map(r => this.emitTypeOrParam(r));
        sig += ` (${results.join(', ')})`;
      }

      code += this.line(sig + ' {');

      // Body
      if (node.body) {
        this.indentLevel++;
        code += this.emit(node.body);
        this.indentLevel--;
      }

      code += this.line('}');

      return code;
    }

    emitParameterDecl(node) {
      if (node.isVariadic) {
        return `${node.name} ...${node.type.toString()}`;
      }
      if (node.name) {
        return `${node.name} ${node.type.toString()}`;
      }
      return node.type.toString();
    }

    emitTypeOrParam(node) {
      if (node.nodeType === 'Parameter') {
        return this.emitParameterDecl(node);
      }
      return node.toString();
    }

    emitConst(node) {
      let code = '';

      if (this.addComments && node.docComment) {
        code += this.line(`// ${node.docComment}`);
      }

      let decl = `const ${node.name}`;
      if (node.type) {
        decl += ` ${node.type.toString()}`;
      }
      decl += ` = ${this.emit(node.value)}`;

      return this.line(decl);
    }

    emitVar(node) {
      if (node.isShortDecl && node.initializer) {
        // := syntax
        return this.line(`${node.name} := ${this.emit(node.initializer)}`);
      }

      let decl = `var ${node.name}`;
      if (node.type) {
        decl += ` ${node.type.toString()}`;
      }
      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      return this.line(decl);
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = '';
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      return code;
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression));
    }

    emitReturn(node) {
      if (node.results.length === 0) {
        return this.line('return');
      }

      const results = node.results.map(r => this.emit(r));
      return this.line(`return ${results.join(', ')}`);
    }

    emitIf(node) {
      let code = '';

      // if init; condition {
      let ifLine = 'if ';
      if (node.init) {
        ifLine += `${this.emit(node.init).trim()}; `;
      }
      ifLine += `${this.emit(node.condition)} {`;

      code += this.line(ifLine);

      this.indentLevel++;
      code += this.emit(node.thenBranch);
      this.indentLevel--;

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          // else if
          code += this.indent() + '} else ';
          const elseIfCode = this.emitIf(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code += this.line('} else {');
          this.indentLevel++;
          code += this.emit(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      } else {
        code += this.line('}');
      }

      return code;
    }

    emitFor(node) {
      let code = '';

      if (node.isRange) {
        // for range loop
        let forLine = 'for ';
        if (node.rangeKey && node.rangeValue) {
          forLine += `${node.rangeKey}, ${node.rangeValue} := range ${this.emit(node.rangeExpr)}`;
        } else if (node.rangeKey) {
          forLine += `${node.rangeKey} := range ${this.emit(node.rangeExpr)}`;
        } else {
          forLine += `range ${this.emit(node.rangeExpr)}`;
        }
        forLine += ' {';

        code += this.line(forLine);
      } else {
        // Traditional for loop
        let forLine = 'for ';

        if (node.init || node.condition || node.post) {
          if (node.init) {
            forLine += this.emit(node.init).trim();
          }
          forLine += '; ';

          if (node.condition) {
            forLine += this.emit(node.condition);
          }
          forLine += '; ';

          if (node.post) {
            forLine += this.emit(node.post).trim();
          }
        } else if (node.condition) {
          // while-style loop
          forLine += this.emit(node.condition);
        }
        // else: infinite loop

        forLine += ' {';
        code += this.line(forLine);
      }

      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;

      code += this.line('}');

      return code;
    }

    emitSwitch(node) {
      let code = '';

      let switchLine = 'switch ';
      if (node.init) {
        switchLine += `${this.emit(node.init).trim()}; `;
      }
      if (node.expression) {
        switchLine += this.emit(node.expression);
      }
      switchLine += ' {';

      code += this.line(switchLine);

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      code += this.line('}');

      return code;
    }

    emitCase(node) {
      let code = '';

      if (node.isDefault) {
        code += this.line('default:');
      } else {
        const values = node.values.map(v => this.emit(v));
        code += this.line(`case ${values.join(', ')}:`);
      }

      this.indentLevel++;
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;

      return code;
    }

    emitDefer(node) {
      return this.line(`defer ${this.emit(node.call)}`);
    }

    emitGo(node) {
      return this.line(`go ${this.emit(node.call)}`);
    }

    emitBreak(node) {
      if (node.label) {
        return this.line(`break ${node.label}`);
      }
      return this.line('break');
    }

    emitContinue(node) {
      if (node.label) {
        return this.line(`continue ${node.label}`);
      }
      return this.line('continue');
    }

    emitSelect(node) {
      let code = this.line('select {');

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      code += this.line('}');
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'nil') return 'nil';
      if (node.literalType === 'bool') return node.value ? 'true' : 'false';
      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }

      // Numeric literal
      if (node.isHex) {
        return `0x${node.value.toString(16).toUpperCase()}`;
      }

      return String(node.value);
    }

    emitIdentifier(node) {
      return node.name;
    }

    emitBinaryExpression(node) {
      return `${this.emit(node.left)} ${node.operator} ${this.emit(node.right)}`;
    }

    emitUnaryExpression(node) {
      if (node.operator === '<-') {
        // Channel receive
        return `<-${this.emit(node.operand)}`;
      }
      // Handle postfix operators like ... for variadic expansion
      if (node.isPostfix) {
        return `${this.emit(node.operand)}${node.operator}`;
      }
      return `${node.operator}${this.emit(node.operand)}`;
    }

    emitAssignment(node) {
      const targets = node.targets.map(t => this.emit(t));
      const values = node.values.map(v => this.emit(v));
      return `${targets.join(', ')} ${node.operator} ${values.join(', ')}`;
    }

    emitSelectorExpression(node) {
      return `${this.emit(node.target)}.${node.selector}`;
    }

    emitIndexExpression(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitSliceExpression(node) {
      let slice = this.emit(node.target) + '[';
      if (node.low) slice += this.emit(node.low);
      slice += ':';
      if (node.high) slice += this.emit(node.high);
      if (node.max) {
        slice += ':' + this.emit(node.max);
      }
      slice += ']';
      return slice;
    }

    emitCallExpression(node) {
      const args = node.arguments.map(a => this.emit(a));
      return `${this.emit(node.function)}(${args.join(', ')})`;
    }

    emitTypeAssertion(node) {
      return `${this.emit(node.expression)}.(${node.type.toString()})`;
    }

    emitTypeConversion(node) {
      return `${node.type.toString()}(${this.emit(node.expression)})`;
    }

    emitCompositeLiteral(node) {
      const typeName = node.type ? node.type.toString() : '';

      if (node.elements.length === 0) {
        return `${typeName}{}`;
      }

      const elements = node.elements.map(e => {
        if (e.nodeType === 'KeyValue') {
          return `${this.emit(e.key)}: ${this.emit(e.value)}`;
        }
        return this.emit(e);
      });

      return `${typeName}{${elements.join(', ')}}`;
    }

    emitKeyValue(node) {
      return `${this.emit(node.key)}: ${this.emit(node.value)}`;
    }

    emitFuncLit(node) {
      let code = 'func(';

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      code += params.join(', ');
      code += ')';

      // Results
      if (node.results.length === 0) {
        // No return
      } else if (node.results.length === 1 && !node.results[0].name) {
        code += ` ${this.emitTypeOrParam(node.results[0])}`;
      } else {
        const results = node.results.map(r => this.emitTypeOrParam(r));
        code += ` (${results.join(', ')})`;
      }

      code += ' {\n';

      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;

      code += this.indent() + '}';

      return code;
    }

    emitMake(node) {
      let args = [node.type.toString()];
      if (node.size) args.push(this.emit(node.size));
      if (node.capacity) args.push(this.emit(node.capacity));
      return `make(${args.join(', ')})`;
    }

    emitNew(node) {
      return `new(${node.type.toString()})`;
    }

    emitType(node) {
      return node.toString();
    }
  }

  // Export
  const exports = { GoEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.GoEmitter = GoEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
