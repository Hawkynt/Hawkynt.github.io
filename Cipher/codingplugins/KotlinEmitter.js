/**
 * KotlinEmitter.js - Kotlin Code Generator from Kotlin AST
 * Generates properly formatted Kotlin source code from KotlinAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Kotlin AST -> Kotlin Emitter -> Kotlin Source
 */

(function(global) {
  'use strict';

  // Load KotlinAST if available
  let KotlinAST;
  if (typeof require !== 'undefined') {
    KotlinAST = require('./KotlinAST.js');
  } else if (global.KotlinAST) {
    KotlinAST = global.KotlinAST;
  }

  /**
   * Kotlin Code Emitter
   * Generates formatted Kotlin code from a Kotlin AST
   */
  class KotlinEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
    }

    /**
     * Emit Kotlin code from a Kotlin AST node
     * @param {KotlinNode} node - The AST node to emit
     * @returns {string} Generated Kotlin code
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

    emitFile(node) {
      let code = '';

      // Package declaration
      if (node.packageDeclaration) {
        code += this.emit(node.packageDeclaration);
        code += this.newline;
      }

      // Import directives
      for (const importDirective of node.imports) {
        code += this.emit(importDirective);
      }
      if (node.imports.length > 0) {
        code += this.newline;
      }

      // Top-level declarations
      for (const decl of node.declarations) {
        code += this.emit(decl);
        code += this.newline;
      }

      return code;
    }

    emitPackageDeclaration(node) {
      return this.line(`package ${node.name}`);
    }

    emitImportDirective(node) {
      if (node.isWildcard) {
        return this.line(`import ${node.path}.*`);
      }
      if (node.alias) {
        return this.line(`import ${node.path} as ${node.alias}`);
      }
      return this.line(`import ${node.path}`);
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitClass(node) {
      let code = '';

      // KDoc
      if (node.kdoc) {
        code += this.emit(node.kdoc);
      }

      // Modifiers and class declaration
      let decl = '';
      if (node.visibility !== 'public') {
        decl += `${node.visibility} `;
      }

      // Modifiers (data, sealed, open, abstract, etc.)
      for (const modifier of node.modifiers) {
        decl += `${modifier} `;
      }

      decl += `class ${node.name}`;

      // Primary constructor
      if (node.primaryConstructor && node.primaryConstructor.parameters.length > 0) {
        const params = node.primaryConstructor.parameters.map(p => {
          let param = '';
          if (p.isVal) param += 'val ';
          if (p.isVar) param += 'var ';
          param += `${p.name}: ${p.type.toString()}`;
          if (p.defaultValue) {
            param += ` = ${this.emit(p.defaultValue)}`;
          }
          return param;
        });
        decl += `(${params.join(', ')})`;
      }

      // Inheritance
      const bases = [];
      if (node.superClass) {
        bases.push(`${node.superClass.toString()}()`);
      }
      bases.push(...node.interfaces.map(i => i.toString()));
      if (bases.length > 0) {
        decl += ` : ${bases.join(', ')}`;
      }

      code += this.line(decl);
      code += this.line('{');
      this.indentLevel++;

      // Companion object
      if (node.companionObject) {
        code += this.emit(node.companionObject);
        code += this.newline;
      }

      // Init blocks
      if (node.initBlocks && node.initBlocks.length > 0) {
        for (const initBlock of node.initBlocks) {
          code += this.line('init');
          code += this.emit(initBlock);
          code += this.newline;
        }
      }

      // Members
      for (const member of node.members) {
        code += this.emit(member);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitDataClass(node) {
      // Data classes are emitted same as regular classes since modifiers are in modifiers array
      return this.emitClass(node);
    }

    emitObject(node) {
      let code = '';

      if (node.kdoc) {
        code += this.emit(node.kdoc);
      }

      let decl = '';
      if (node.visibility !== 'public') {
        decl += `${node.visibility} `;
      }
      decl += `object ${node.name}`;

      // Inheritance
      const bases = [];
      if (node.superClass) {
        bases.push(`${node.superClass.toString()}()`);
      }
      bases.push(...node.interfaces.map(i => i.toString()));
      if (bases.length > 0) {
        decl += ` : ${bases.join(', ')}`;
      }

      code += this.line(decl);
      code += this.line('{');
      this.indentLevel++;

      for (const member of node.members) {
        code += this.emit(member);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitCompanionObject(node) {
      let code = this.line(node.name ? `companion object ${node.name}` : 'companion object');
      code += this.line('{');
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

      if (node.kdoc) {
        code += this.emit(node.kdoc);
      }

      let decl = '';
      if (node.visibility !== 'public') {
        decl += `${node.visibility} `;
      }

      for (const modifier of node.modifiers) {
        decl += `${modifier} `;
      }

      decl += node.isVar ? 'var ' : 'val ';
      decl += node.name;

      if (node.type) {
        decl += `: ${node.type.toString()}`;
      }

      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      code += this.line(decl);
      return code;
    }

    emitFunction(node) {
      let code = '';

      if (node.kdoc) {
        code += this.emit(node.kdoc);
      }

      let decl = '';
      if (node.visibility !== 'public') {
        decl += `${node.visibility} `;
      }

      for (const modifier of node.modifiers) {
        decl += `${modifier} `;
      }

      decl += `fun `;

      // Type parameters
      if (node.typeParameters && node.typeParameters.length > 0) {
        decl += `<${node.typeParameters.join(', ')}> `;
      }

      decl += node.name;

      // Parameters
      const params = node.parameters.map(p => {
        let param = '';
        if (p.isVararg) param += 'vararg ';
        param += `${p.name}: ${p.type.toString()}`;
        if (p.defaultValue) {
          param += ` = ${this.emit(p.defaultValue)}`;
        }
        return param;
      });
      decl += `(${params.join(', ')})`;

      // Return type
      if (node.returnType && node.returnType.name !== 'Unit') {
        decl += `: ${node.returnType.toString()}`;
      }

      // Body
      if (!node.body) {
        code += this.line(decl);
      } else if (node.body.nodeType === 'Block') {
        code += this.line(decl);
        code += this.emit(node.body);
      } else {
        // Single expression body
        code += this.line(`${decl} = ${this.emit(node.body)}`);
      }

      return code;
    }

    emitConstructor(node) {
      let code = '';

      if (node.kdoc) {
        code += this.emit(node.kdoc);
      }

      let decl = '';
      if (node.visibility !== 'public') {
        decl += `${node.visibility} `;
      }

      decl += 'constructor';

      const params = node.parameters.map(p => `${p.name}: ${p.type.toString()}`);
      decl += `(${params.join(', ')})`;

      // Delegation call
      if (node.delegationCall) {
        decl += ` : ${this.emit(node.delegationCall)}`;
      }

      code += this.line(decl);

      if (node.body) {
        code += this.emit(node.body);
      }

      return code;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = this.line('{');
      this.indentLevel++;

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitVariableDeclaration(node) {
      let code = node.isVar ? 'var ' : 'val ';
      code += node.name;

      if (node.type) {
        code += `: ${node.type.toString()}`;
      }

      if (node.initializer) {
        code += ` = ${this.emit(node.initializer)}`;
      }

      return this.line(code);
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression));
    }

    emitReturn(node) {
      let code = 'return';
      if (node.label) {
        code += `@${node.label}`;
      }
      if (node.expression) {
        code += ` ${this.emit(node.expression)}`;
      }
      return this.line(code);
    }

    emitIf(node) {
      let code = this.line(`if (${this.emit(node.condition)})`);

      if (node.thenBranch.nodeType === 'Block') {
        code += this.emit(node.thenBranch);
      } else {
        this.indentLevel++;
        code += this.line(this.emit(node.thenBranch));
        this.indentLevel--;
      }

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          code = code.trimEnd() + this.newline;
          code += this.indent() + 'else ';
          const elseIfCode = this.emit(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code += this.line('else');
          if (node.elseBranch.nodeType === 'Block') {
            code += this.emit(node.elseBranch);
          } else {
            this.indentLevel++;
            code += this.line(this.emit(node.elseBranch));
            this.indentLevel--;
          }
        }
      }

      return code;
    }

    emitWhen(node) {
      let code = '';
      if (node.subject) {
        code += this.line(`when (${this.emit(node.subject)})`);
      } else {
        code += this.line('when');
      }

      code += this.line('{');
      this.indentLevel++;

      for (const entry of node.entries) {
        code += this.emit(entry);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhenEntry(node) {
      let code = '';

      if (node.isElse) {
        code += this.indent() + 'else';
      } else {
        const conditions = node.conditions.map(c => this.emit(c));
        code += this.indent() + conditions.join(', ');
      }

      code += ' -> ';

      if (node.body.nodeType === 'Block') {
        code += this.newline;
        code += this.emit(node.body);
      } else {
        code += this.emit(node.body) + this.newline;
      }

      return code;
    }

    emitFor(node) {
      let code = 'for (';
      code += node.variable;
      if (node.variableType) {
        code += `: ${node.variableType.toString()}`;
      }
      code += ` in ${this.emit(node.iterable)})`;

      code = this.line(code);
      code += this.emit(node.body);
      return code;
    }

    emitWhile(node) {
      let code = this.line(`while (${this.emit(node.condition)})`);
      code += this.emit(node.body);
      return code;
    }

    emitDoWhile(node) {
      let code = this.line('do');
      code += this.emit(node.body);
      code = code.trimEnd();
      code += ` while (${this.emit(node.condition)})${this.newline}`;
      return code;
    }

    emitBreak(node) {
      if (node.label) {
        return this.line(`break@${node.label}`);
      }
      return this.line('break');
    }

    emitContinue(node) {
      if (node.label) {
        return this.line(`continue@${node.label}`);
      }
      return this.line('continue');
    }

    emitThrow(node) {
      return this.line(`throw ${this.emit(node.expression)}`);
    }

    emitTryCatch(node) {
      let code = this.line('try');
      code += this.emit(node.tryBlock);

      for (const catchClause of node.catchClauses) {
        code += this.emit(catchClause);
      }

      if (node.finallyBlock) {
        code += this.line('finally');
        code += this.emit(node.finallyBlock);
      }

      return code;
    }

    emitCatchClause(node) {
      let code = this.line(`catch (${node.parameter.name}: ${node.parameter.type.toString()})`);
      code += this.emit(node.body);
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'null') return 'null';
      if (node.literalType === 'Boolean') return node.value ? 'true' : 'false';
      if (node.literalType === 'String') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }

      // Numeric literal
      let result;
      if (node.isHex) {
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
      return `${this.emit(node.left)} ${node.operator} ${this.emit(node.right)}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      if (node.isPrefix) {
        return `${node.operator}${operand}`;
      }
      return `${operand}${node.operator}`;
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} = ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      const operator = node.isSafe ? '?.' : '.';
      return `${this.emit(node.target)}${operator}${node.member}`;
    }

    emitElementAccess(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitFunctionCall(node) {
      let code = this.emit(node.target);

      if (node.typeArguments && node.typeArguments.length > 0) {
        code += `<${node.typeArguments.map(t => t.toString()).join(', ')}>`;
      }

      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitObjectCreation(node) {
      let code = node.type.toString();
      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitArrayCreation(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `${node.factoryFunction}(${elements.join(', ')})`;
    }

    emitLambda(node) {
      let code = '{ ';

      if (node.parameters.length > 0) {
        // Handle both string[] and KotlinParameter[] formats
        const paramStrings = node.parameters.map(p => {
          if (typeof p === 'string') return p;
          if (p.nodeType === 'Parameter') {
            // KotlinParameter: emit name with optional type
            return p.type ? `${p.name}: ${p.type.toString()}` : p.name;
          }
          return p.name || String(p);
        });
        code += paramStrings.join(', ') + ' -> ';
      }

      if (node.body.nodeType === 'Block') {
        code += '\n';
        this.indentLevel++;
        for (const stmt of node.body.statements) {
          code += this.indent() + this.emit(stmt).trim() + '\n';
        }
        this.indentLevel--;
        code += this.indent();
      } else {
        code += this.emit(node.body);
      }

      code += ' }';
      return code;
    }

    emitRange(node) {
      const start = this.emit(node.start);
      const end = this.emit(node.end);
      const operator = node.isInclusive ? '..' : ' until ';
      return `${start}${operator}${end}`;
    }

    emitStringTemplate(node) {
      let result = '"';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          result += part;
        } else {
          result += '${' + this.emit(part) + '}';
        }
      }
      result += '"';
      return result;
    }

    emitThis(node) {
      if (node.label) {
        return `this@${node.label}`;
      }
      return 'this';
    }

    emitSuper(node) {
      return 'super';
    }

    emitIsExpression(node) {
      const operator = node.isNegated ? '!is' : 'is';
      return `${this.emit(node.expression)} ${operator} ${node.type.toString()}`;
    }

    emitAsExpression(node) {
      const operator = node.isSafe ? 'as?' : 'as';
      return `${this.emit(node.expression)} ${operator} ${node.type.toString()}`;
    }

    emitParenthesized(node) {
      return `(${this.emit(node.expression)})`;
    }

    emitElvis(node) {
      return `${this.emit(node.left)} ?: ${this.emit(node.right)}`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitKDoc(node) {
      let code = '';

      if (node.summary) {
        code += this.line('/**');
        for (const line of node.summary.split('\n')) {
          code += this.line(` * ${line.trim()}`);
        }

        for (const param of node.parameters) {
          code += this.line(` * @param ${param.name} ${param.description}`);
        }

        if (node.returns) {
          code += this.line(` * @return ${node.returns}`);
        }

        if (node.see && node.see.length > 0) {
          for (const see of node.see) {
            code += this.line(` * @see ${see}`);
          }
        }

        code += this.line(' */');
      }

      return code;
    }
  }

  // Export
  const exports = { KotlinEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.KotlinEmitter = KotlinEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
