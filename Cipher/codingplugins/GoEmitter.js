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

    /**
     * Escape Go reserved keywords by appending underscore
     * @param {string} name - The identifier name to escape
     * @returns {string} Escaped name if reserved, original otherwise
     */
    escapeReserved(name) {
      const reserved = ['type', 'func', 'interface', 'struct', 'map', 'range', 'defer', 'go', 'chan', 'select', 'fallthrough', 'default', 'case', 'package', 'import', 'const', 'var'];
      return reserved.includes(name) ? name + '_' : name;
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

      // Handle anonymous embedded fields (for struct embedding/inheritance)
      let field;
      if (node.isEmbedded) {
        // Embedded field: just the type name, no field name
        field = node.type.toString();
      } else {
        field = `${node.name} ${node.type.toString()}`;
      }
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
      const name = node.name ? this.escapeReserved(node.name) : null;
      if (node.isVariadic) {
        return `${name} ...${node.type.toString()}`;
      }
      if (name) {
        return `${name} ${node.type.toString()}`;
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

      const name = this.escapeReserved(node.name);
      let decl = `const ${name}`;
      if (node.type) {
        decl += ` ${node.type.toString()}`;
      }
      decl += ` = ${this.emit(node.value)}`;

      return this.line(decl);
    }

    emitVar(node) {
      const name = this.escapeReserved(node.name);
      if (node.isShortDecl && node.initializer) {
        // := syntax
        return this.line(`${name} := ${this.emit(node.initializer)}`);
      }

      let decl = `var ${name}`;
      if (node.type) {
        decl += ` ${node.type.toString()}`;
      } else if (!node.initializer) {
        // Go requires a type when there's no initializer
        // Use interface{} as fallback (compatible with all Go versions)
        decl += ' interface{}';
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
        const rangeKey = node.rangeKey ? this.escapeReserved(node.rangeKey) : null;
        const rangeValue = node.rangeValue ? this.escapeReserved(node.rangeValue) : null;
        if (rangeKey && rangeValue) {
          forLine += `${rangeKey}, ${rangeValue} := range ${this.emit(node.rangeExpr)}`;
        } else if (rangeKey) {
          forLine += `${rangeKey} := range ${this.emit(node.rangeExpr)}`;
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

      // Handle large numbers that exceed JS Number.MAX_SAFE_INTEGER
      // JavaScript can't represent these exactly, so emit as hex
      if (typeof node.value === 'number' && node.value > 9007199254740991) {
        const hex = Math.round(node.value).toString(16).toUpperCase();
        // Cap at max uint64 if the hex exceeds 16 digits (FFFFFFFFFFFFFFFF)
        if (hex.length > 16)
          return '0xFFFFFFFFFFFFFFFF';
        return `0x${hex}`;
      }

      // BigInt values - emit as-is (they can be arbitrarily large)
      if (typeof node.value === 'bigint') {
        return node.value.toString();
      }

      return String(node.value);
    }

    emitIdentifier(node) {
      return this.escapeReserved(node.name);
    }

    emitBinaryExpression(node) {
      const left = this.emit(node.left);
      const right = this.emit(node.right);
      const op = node.operator;

      // Add parentheses when needed for proper operator precedence
      const leftStr = this.needsParens(node.left, op, 'left') ? `(${left})` : left;
      const rightStr = this.needsParens(node.right, op, 'right') ? `(${right})` : right;
      return `${leftStr} ${op} ${rightStr}`;
    }

    /**
     * Check if an expression needs parentheses in a binary expression
     */
    needsParens(node, parentOp, side) {
      if (!node || node.nodeType !== 'BinaryExpression') return false;

      const childOp = node.operator;

      // Go operator precedence (higher = binds tighter)
      const precedence = {
        '*': 13, '/': 13, '%': 13, '<<': 13, '>>': 13, '&': 13, '&^': 13,
        '+': 12, '-': 12, '|': 12, '^': 12,
        '==': 11, '!=': 11, '<': 11, '<=': 11, '>': 11, '>=': 11,
        '&&': 10,
        '||': 9
      };

      const parentPrec = precedence[parentOp] || 0;
      const childPrec = precedence[childOp] || 0;

      // If child has lower precedence, needs parens
      if (childPrec < parentPrec) return true;

      // If same precedence and right side, needs parens for left-associativity
      if (childPrec === parentPrec && side === 'right') return true;

      // Comparison operators at the same precedence level need parens when chained
      // e.g., (a != nil) == nil must be written with parens; Go doesn't allow chaining comparisons
      const compOps = ['==', '!=', '<', '<=', '>', '>='];
      if (compOps.includes(parentOp) && compOps.includes(childOp)) return true;

      return false;
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
      const args = node.arguments.map(a => this.emit(a).replace(/\s+$/, ''));
      const joined = args.join(', ');

      // Go requires trailing comma on last arg in multi-line call expressions
      if (joined.includes('\n') || joined.length > 120) {
        const indent = this.indent();
        const innerIndent = indent + this.indentString;
        const lines = args.map(a => `${innerIndent}${a},`);
        return `${this.emit(node.function)}(\n${lines.join('\n')}\n${indent})`;
      }

      return `${this.emit(node.function)}(${joined})`;
    }

    emitTypeAssertion(node) {
      let expr = this.emit(node.expression);
      // Add parentheses for compound expressions to ensure correct precedence
      // Type assertions bind tightly, so a >> b.(type) means a >> (b.(type)) not (a >> b).(type)
      if (node.expression.nodeType === 'BinaryExpression' ||
          node.expression.nodeType === 'UnaryExpression') {
        expr = `(${expr})`;
      }
      return `${expr}.(${node.type.toString()})`;
    }

    emitTypeConversion(node) {
      // Check if source expression is interface{}/any - need type assertion instead
      const exprType = node.expression?.goType?.toString() ||
                       node.expression?.type?.toString() || '';
      const targetType = node.type.toString();

      // If source is interface{}/any and target is a slice/concrete type, use assertion
      if ((exprType === 'interface{}' || exprType === 'any') && targetType.startsWith('[]')) {
        return `${this.emit(node.expression)}.(${targetType})`;
      }

      return `${targetType}(${this.emit(node.expression)})`;
    }

    emitCompositeLiteral(node) {
      const typeName = node.type ? node.type.toString() : '';

      if (node.elements.length === 0) {
        return `${typeName}{}`;
      }

      const elements = node.elements.map(e => {
        let code;
        if (e.nodeType === 'KeyValue')
          code = `${this.emit(e.key)}: ${this.emit(e.value)}`;
        else
          code = this.emit(e);
        // Strip trailing whitespace/newlines from emitted elements
        return code.replace(/\s+$/, '');
      });

      // Check if any element contains newlines or total length is very long
      const joined = elements.join(', ');
      const isMultiLine = joined.includes('\n') || joined.length > 120;

      if (isMultiLine) {
        // Go requires trailing comma on last element in multi-line composite literals
        const indent = this.indent();
        const innerIndent = indent + this.indentString;
        const lines = elements.map(el => `${innerIndent}${el},`);
        return `${typeName}{\n${lines.join('\n')}\n${indent}}`;
      }

      return `${typeName}{${joined}}`;
    }

    emitKeyValue(node) {
      return `${this.emit(node.key).replace(/\s+$/, '')}: ${this.emit(node.value).replace(/\s+$/, '')}`;
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

    // ========================[ RAW CODE ]========================

    emitRawCode(node) {
      // Emit raw Go code as-is
      // Single-line code is returned inline (for use in expressions)
      // Multi-line code gets indentation (for use as statements/stubs)
      const lines = node.code.split('\n');
      if (lines.length === 1)
        return node.code;

      let code = '';
      for (const line of lines) {
        code += this.line(line);
      }
      return code;
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
