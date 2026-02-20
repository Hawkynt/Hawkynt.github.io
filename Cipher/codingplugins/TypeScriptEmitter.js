/**
 * TypeScriptEmitter.js - TypeScript Code Generator from TypeScript AST
 * Generates properly formatted TypeScript source code from TypeScriptAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> TS AST -> TS Emitter -> TS Source
 */

(function(global) {
  'use strict';

  // Load TypeScriptAST if available
  let TypeScriptAST;
  if (typeof require !== 'undefined') {
    TypeScriptAST = require('./TypeScriptAST.js');
  } else if (global.TypeScriptAST) {
    TypeScriptAST = global.TypeScriptAST;
  }

  /**
   * TypeScript Code Emitter
   * Generates formatted TypeScript code from a TypeScript AST
   */
  class TypeScriptEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '  ';
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
    }

    /**
     * Emit TypeScript code from a TypeScript AST node
     * @param {TypeScriptNode} node - The AST node to emit
     * @returns {string} Generated TypeScript code
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

    // ========================[ COMPILATION UNIT ]========================

    emitCompilationUnit(node) {
      let code = '';

      // Imports
      for (const imp of node.imports) {
        code += this.emit(imp);
      }
      if (node.imports.length > 0) {
        code += this.newline;
      }

      // Top-level types
      for (const type of node.types) {
        code += this.emit(type);
        code += this.newline;
      }

      // Top-level statements (including functions)
      for (const stmt of node.statements) {
        const emitted = this.emit(stmt);
        if (emitted) {
          code += emitted;
          // Add newline after top-level functions
          if (stmt.nodeType === 'Method') {
            code += this.newline;
          }
        }
      }

      // Exports
      for (const exp of node.exports) {
        code += this.emit(exp);
      }

      return code;
    }

    emitImportDeclaration(node) {
      let code = 'import ';

      if (node.defaultImport) {
        code += node.defaultImport;
        if (node.namedImports.length > 0 || node.namespaceImport) {
          code += ', ';
        }
      }

      if (node.namespaceImport) {
        code += `* as ${node.namespaceImport}`;
      } else if (node.namedImports.length > 0) {
        const names = node.namedImports.map(imp =>
          imp.alias ? `${imp.name} as ${imp.alias}` : imp.name
        );
        code += `{ ${names.join(', ')} }`;
      }

      code += ` from '${node.moduleName}';`;
      return this.line(code);
    }

    emitExportDeclaration(node) {
      let code = 'export ';
      if (node.isDefault) {
        code += 'default ';
      }
      code += this.emit(node.declaration);
      return code;
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitInterface(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = `interface ${node.name}`;

      if (node.typeParameters.length > 0) {
        decl += `<${node.typeParameters.join(', ')}>`;
      }

      if (node.extends.length > 0) {
        decl += ` extends ${node.extends.map(t => t.toString()).join(', ')}`;
      }

      code += this.line(decl + ' {');
      this.indentLevel++;

      for (const member of node.members) {
        code += this.emit(member);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitTypeAlias(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = `type ${node.name}`;

      if (node.typeParameters.length > 0) {
        decl += `<${node.typeParameters.join(', ')}>`;
      }

      decl += ` = ${node.type.toString()};`;
      code += this.line(decl);
      return code;
    }

    emitClass(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = '';
      if (node.isExported) decl += 'export ';
      if (node.isAbstract) decl += 'abstract ';
      decl += `class ${node.name}`;

      if (node.typeParameters.length > 0) {
        decl += `<${node.typeParameters.join(', ')}>`;
      }

      if (node.baseClass) {
        decl += ` extends ${node.baseClass.toString()}`;
      }

      if (node.implements.length > 0) {
        decl += ` implements ${node.implements.map(i => i.toString()).join(', ')}`;
      }

      code += this.line(decl + ' {');
      this.indentLevel++;

      for (const member of node.members) {
        code += this.emit(member);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ MEMBERS ]========================

    emitProperty(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      let decl = '';
      if (node.accessModifier) decl += `${node.accessModifier} `;
      if (node.isStatic) decl += 'static ';
      if (node.isReadonly) decl += 'readonly ';

      decl += node.name;
      if (node.isOptional) decl += '?';
      decl += `: ${node.type.toString()}`;

      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      code += this.line(`${decl};`);
      return code;
    }

    emitMethod(node) {
      let code = '';

      if (node.jsDoc)
        code += this.emit(node.jsDoc);

      let decl = '';
      if (node.accessModifier) decl += `${node.accessModifier} `;
      if (node.isStatic) decl += 'static ';
      if (node.isAbstract) decl += 'abstract ';
      if (node.isAsync) decl += 'async ';
      if (node.isGetter) decl += 'get ';
      if (node.isSetter) decl += 'set ';

      decl += node.name;

      // Parameters (getters have no params, setters have one param)
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      // Return type (omit for setters as they implicitly return void)
      if (!node.isSetter)
        decl += `: ${node.returnType.toString()}`;

      if (node.isAbstract || !node.body) {
        code += this.line(`${decl};`);
      } else {
        code += this.line(decl + ' {');
        this.indentLevel++;
        if (node.body) {
          code += this.emit(node.body);
        }
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitConstructor(node) {
      let code = '';

      if (node.jsDoc) {
        code += this.emit(node.jsDoc);
      }

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      let decl = `constructor(${params.join(', ')})`;

      code += this.line(decl + ' {');
      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitStaticBlock(node) {
      let code = this.line('static {');
      this.indentLevel++;
      if (node.body) {
        code += this.emit(node.body);
      }
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitParameterDecl(node) {
      let decl = '';
      if (node.isRest) decl += '...';
      decl += node.name;
      if (node.isOptional) decl += '?';
      decl += `: ${node.type.toString()}`;
      if (node.defaultValue) {
        decl += ` = ${this.emit(node.defaultValue)}`;
      }
      return decl;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = '';
      // Handle labeled blocks: label: { ... }
      if (node.label) {
        code += `${node.label}: `;
      }
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      return code;
    }

    emitVariableDeclaration(node) {
      let code = `${node.kind} ${node.name}`;
      if (node.type) {
        code += `: ${node.type.toString()}`;
      }
      if (node.initializer) {
        code += ` = ${this.emit(node.initializer)}`;
      }
      return this.line(`${code};`);
    }

    emitExpressionStatement(node) {
      return this.line(`${this.emit(node.expression)};`);
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line(`return ${this.emit(node.expression)};`);
      }
      return this.line('return;');
    }

    emitIf(node) {
      let code = this.line(`if (${this.emit(node.condition)}) {`);
      this.indentLevel++;

      if (node.thenBranch.nodeType === 'Block') {
        code += this.emit(node.thenBranch);
      } else {
        code += this.emit(node.thenBranch);
      }

      this.indentLevel--;
      code += this.line('}');

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          code = code.trimEnd() + ' else ';
          const elseIfCode = this.emit(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code += this.line('else {');
          this.indentLevel++;
          code += this.emit(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      let init = '';
      if (node.initializer) {
        // Handle array of variable declarations (for multi-variable: let i = 0, j = 10)
        if (Array.isArray(node.initializer)) {
          const decls = node.initializer;
          if (decls.length > 0 && decls[0].nodeType === 'VariableDeclaration') {
            const kind = decls[0].kind || 'let';
            const parts = decls.map(d => {
              let part = d.name;
              if (d.type) part += `: ${d.type.toString()}`;
              if (d.initializer) part += ` = ${this.emit(d.initializer)}`;
              return part;
            });
            init = `${kind} ${parts.join(', ')}`;
          } else {
            // Array of expressions (comma operator)
            init = decls.map(d => this.emit(d)).join(', ');
          }
        } else if (node.initializer.nodeType === 'VariableDeclaration') {
          init = `${node.initializer.kind} ${node.initializer.name}`;
          if (node.initializer.type) {
            init += `: ${node.initializer.type.toString()}`;
          }
          if (node.initializer.initializer) {
            init += ` = ${this.emit(node.initializer.initializer)}`;
          }
        } else {
          init = this.emit(node.initializer);
        }
      }

      const cond = node.condition ? this.emit(node.condition) : '';
      const incr = node.incrementor ? this.emit(node.incrementor) : '';

      let code = this.line(`for (${init}; ${cond}; ${incr}) {`);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitForOf(node) {
      let decl = `const ${node.variableName}`;
      if (node.variableType) {
        decl += `: ${node.variableType.toString()}`;
      }

      let code = this.line(`for (${decl} of ${this.emit(node.collection)}) {`);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      let code = this.line(`while (${this.emit(node.condition)}) {`);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitDoWhile(node) {
      let code = this.line('do {');
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code = code.trimEnd();
      code += ` } while (${this.emit(node.condition)});${this.newline}`;
      return code;
    }

    emitSwitch(node) {
      let code = this.line(`switch (${this.emit(node.expression)}) {`);
      this.indentLevel++;

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitSwitchCase(node) {
      let code = '';
      if (node.isDefault) {
        code += this.line('default:');
      } else {
        code += this.line(`case ${this.emit(node.label)}:`);
      }

      this.indentLevel++;
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;

      return code;
    }

    emitBreak(node) {
      if (node.label)
        return this.line(`break ${node.label};`);
      return this.line('break;');
    }

    emitContinue(node) {
      if (node.label)
        return this.line(`continue ${node.label};`);
      return this.line('continue;');
    }

    emitThrow(node) {
      return this.line(`throw ${this.emit(node.expression)};`);
    }

    emitTryCatch(node) {
      let code = this.line('try {');
      this.indentLevel++;
      code += this.emit(node.tryBlock);
      this.indentLevel--;
      code += this.line('}');

      for (const catchClause of node.catchClauses) {
        code += this.emit(catchClause);
      }

      if (node.finallyBlock) {
        code += this.line('finally {');
        this.indentLevel++;
        code += this.emit(node.finallyBlock);
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitCatchClause(node) {
      let code = 'catch';
      if (node.variableName) {
        code += ` (${node.variableName}`;
        if (node.variableType) {
          code += `: ${node.variableType.toString()}`;
        }
        code += ')';
      }
      code += ' {';
      code = this.line(code);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'null') return 'null';
      if (node.literalType === 'undefined') return 'undefined';
      if (node.literalType === 'boolean') return node.value ? 'true' : 'false';
      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }
      if (node.literalType === 'bigint') {
        return `${node.value}n`;
      }

      // Numeric literal
      return String(node.value);
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

      if (node.operator === 'typeof' || node.operator === 'void' || node.operator === 'delete') {
        return `${node.operator} ${operand}`;
      }

      if (node.isPrefix) {
        return `${node.operator}${operand}`;
      }
      return `${operand}${node.operator}`;
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} ${node.operator} ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      const op = node.isOptional ? '?.' : '.';
      return `${this.emit(node.target)}${op}${node.member}`;
    }

    emitElementAccess(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitCall(node) {
      let code = '';
      if (node.target) {
        code += `${this.emit(node.target)}.`;
      }
      code += node.methodName;

      if (node.typeArguments && node.typeArguments.length > 0) {
        code += `<${node.typeArguments.map(t => t.toString()).join(', ')}>`;
      }

      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitNew(node) {
      let code = `new ${node.type.toString()}`;
      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitArrayLiteral(node) {
      if (node.elements.length === 0) {
        return '[]';
      }
      const elements = node.elements.map(e => this.emit(e));
      return `[${elements.join(', ')}]`;
    }

    emitObjectLiteral(node) {
      if (node.properties.length === 0) {
        return '{}';
      }
      const props = node.properties.map(p => {
        if (p.isSpread)
          return `...${this.emit(p.value)}`;
        // Quote key if it's not a valid identifier
        const key = this.formatObjectKey(p.key);
        return `${key}: ${this.emit(p.value)}`;
      });
      return `{ ${props.join(', ')} }`;
    }

    /**
     * Format object key, quoting if necessary
     * @param {string} key - The object key
     * @returns {string} Properly formatted key
     */
    formatObjectKey(key) {
      // Check if key is a valid JavaScript identifier
      // Valid identifiers: start with letter, _, or $; contain only letters, digits, _, $
      const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
      if (validIdentifier.test(key)) {
        return key;
      }
      // Quote the key, escaping any special characters
      const escaped = key
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    }

    emitAssertion(node) {
      return `${this.emit(node.expression)} as ${node.type.toString()}`;
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.trueExpression)} : ${this.emit(node.falseExpression)}`;
    }

    emitArrowFunction(node) {
      let params;
      if (node.parameters.length === 1 && !node.parameters[0].type) {
        params = node.parameters[0].name;
      } else {
        params = `(${node.parameters.map(p => this.emitParameterDecl(p)).join(', ')})`;
      }

      let returnType = '';
      if (node.returnType) {
        returnType = `: ${node.returnType.toString()}`;
      }

      let body;
      if (node.body.nodeType === 'Block') {
        body = ' {' + this.newline;
        this.indentLevel++;
        body += this.emit(node.body);
        this.indentLevel--;
        body += this.indent() + '}';
      } else {
        body = this.emit(node.body);
      }

      return `${params}${returnType} => ${body}`;
    }

    emitThis(node) {
      return 'this';
    }

    emitSuper(node) {
      return 'super';
    }

    emitTypeOf(node) {
      return `typeof ${this.emit(node.expression)}`;
    }

    emitParenthesized(node) {
      return `(${this.emit(node.expression)})`;
    }

    emitTemplateLiteral(node) {
      let result = '`';
      // Handle new format with quasis and expressions
      if (node.quasis && node.quasis.length > 0) {
        for (let i = 0; i < node.quasis.length; ++i) {
          result += node.quasis[i] || '';
          if (i < node.expressions.length)
            result += '${' + this.emit(node.expressions[i]) + '}';
        }
      } else {
        // Legacy format with parts
        for (const part of node.parts) {
          result += part.text || '';
          if (part.expression)
            result += '${' + this.emit(part.expression) + '}';
        }
      }
      result += '`';
      return result;
    }

    emitAwaitExpression(node) {
      return `await ${this.emit(node.argument)}`;
    }

    emitDeleteExpression(node) {
      return `delete ${this.emit(node.argument)}`;
    }

    emitSpreadElement(node) {
      return `...${this.emit(node.argument)}`;
    }

    emitSequenceExpression(node) {
      const expressions = node.expressions.map(e => this.emit(e));
      return `(${expressions.join(', ')})`;
    }

    emitYieldExpression(node) {
      if (node.delegate) {
        return node.argument ? `yield* ${this.emit(node.argument)}` : 'yield*';
      }
      return node.argument ? `yield ${this.emit(node.argument)}` : 'yield';
    }

    emitChainExpression(node) {
      // Chain expressions just emit their inner expression
      // The optional chaining markers (?.) are handled by MemberAccess/ElementAccess/Call nodes
      return this.emit(node.expression);
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitJSDoc(node) {
      let code = this.line('/**');

      if (node.description) {
        for (const line of node.description.split('\n')) {
          code += this.line(` * ${line.trim()}`);
        }
      }

      for (const param of node.parameters) {
        let paramDoc = ` * @param ${param.name}`;
        if (param.type) {
          paramDoc += ` - ${param.type}`;
        }
        if (param.description) {
          paramDoc += ` ${param.description}`;
        }
        code += this.line(paramDoc);
      }

      if (node.returns) {
        let returnDoc = ' * @returns';
        if (node.returns.type) {
          returnDoc += ` ${node.returns.type}`;
        }
        if (node.returns.description) {
          returnDoc += ` ${node.returns.description}`;
        }
        code += this.line(returnDoc);
      }

      for (const example of node.examples) {
        code += this.line(' * @example');
        code += this.line(` * ${example}`);
      }

      code += this.line(' */');
      return code;
    }
  }

  // Export
  const exports = { TypeScriptEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.TypeScriptEmitter = TypeScriptEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
