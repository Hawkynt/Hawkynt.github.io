/**
 * JavaEmitter.js - Java Code Generator from Java AST
 * Generates properly formatted Java source code from JavaAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Java AST -> Java Emitter -> Java Source
 */

(function(global) {
  'use strict';

  // Load JavaAST if available
  let JavaAST;
  if (typeof require !== 'undefined') {
    JavaAST = require('./JavaAST.js');
  } else if (global.JavaAST) {
    JavaAST = global.JavaAST;
  }

  /**
   * Java Code Emitter
   * Generates formatted Java code from a Java AST
   */
  class JavaEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
      this.braceStyle = 'knr'; // Java always uses K&R style
    }

    /**
     * Emit Java code from a Java AST node
     * @param {JavaNode} node - The AST node to emit
     * @returns {string} Generated Java code
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

      // Package declaration
      if (node.packageDeclaration) {
        code += this.emit(node.packageDeclaration);
        code += this.newline;
      }

      // Import declarations
      for (const importDecl of node.imports) {
        code += this.emit(importDecl);
      }
      if (node.imports.length > 0) {
        code += this.newline;
      }

      // Type declarations
      for (const type of node.types) {
        code += this.emit(type);
        code += this.newline;
      }

      return code;
    }

    emitPackageDeclaration(node) {
      return this.line(`package ${node.name};`);
    }

    emitImportDeclaration(node) {
      let code = 'import ';
      if (node.isStatic) code += 'static ';
      code += node.packageName;
      code += ';';
      return this.line(code);
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitClass(node) {
      let code = '';

      // JavaDoc
      if (node.javadoc) {
        code += this.emit(node.javadoc);
      }

      // Declaration line
      let decl = '';
      if (node.accessModifier) decl += node.accessModifier + ' ';
      if (node.isStatic) decl += 'static ';
      if (node.isAbstract) decl += 'abstract ';
      if (node.isFinal) decl += 'final ';
      decl += `class ${node.name}`;

      // Extends and implements
      if (node.extendsClass) {
        decl += ` extends ${node.extendsClass.toString()}`;
      }
      if (node.implementsInterfaces.length > 0) {
        decl += ` implements ${node.implementsInterfaces.map(i => i.toString()).join(', ')}`;
      }

      code += this.line(decl + ' {');
      this.indentLevel++;

      // Nested types first
      for (const nestedType of node.nestedTypes) {
        code += this.emit(nestedType);
        code += this.newline;
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

    emitInterface(node) {
      let code = '';

      if (node.javadoc) {
        code += this.emit(node.javadoc);
      }

      let decl = '';
      if (node.accessModifier) decl += node.accessModifier + ' ';
      decl += `interface ${node.name}`;

      if (node.extendsInterfaces.length > 0) {
        decl += ` extends ${node.extendsInterfaces.map(i => i.toString()).join(', ')}`;
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

    emitField(node) {
      let code = '';

      if (node.javadoc) {
        code += this.emit(node.javadoc);
      }

      let decl = '';
      if (node.accessModifier) decl += node.accessModifier + ' ';
      if (node.isStatic) decl += 'static ';
      if (node.isFinal) decl += 'final ';
      if (node.isVolatile) decl += 'volatile ';
      if (node.isTransient) decl += 'transient ';
      decl += `${node.type.toString()} ${node.name}`;

      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      code += this.line(`${decl};`);
      return code;
    }

    emitMethod(node) {
      let code = '';

      if (node.javadoc) {
        code += this.emit(node.javadoc);
      }

      let decl = '';
      if (node.accessModifier) decl += node.accessModifier + ' ';
      if (node.isStatic) decl += 'static ';
      if (node.isFinal) decl += 'final ';
      if (node.isAbstract) decl += 'abstract ';
      if (node.isSynchronized) decl += 'synchronized ';
      if (node.isNative) decl += 'native ';

      decl += `${node.returnType.toString()} ${node.name}`;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      // Throws clause
      if (node.throwsExceptions.length > 0) {
        decl += ` throws ${node.throwsExceptions.map(t => t.toString()).join(', ')}`;
      }

      if (node.isAbstract || !node.body) {
        code += this.line(`${decl};`);
      } else {
        code += this.line(decl + ' {');
        this.indentLevel++;
        const statements = node.body.statements || node.body.body || (Array.isArray(node.body) ? node.body : []);
        for (const stmt of statements) {
          code += this.emit(stmt);
        }
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitConstructor(node) {
      let code = '';

      if (node.javadoc) {
        code += this.emit(node.javadoc);
      }

      let decl = '';
      if (node.accessModifier) decl += node.accessModifier + ' ';
      decl += node.className;

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      if (node.throwsExceptions.length > 0) {
        decl += ` throws ${node.throwsExceptions.map(t => t.toString()).join(', ')}`;
      }

      code += this.line(decl + ' {');
      this.indentLevel++;

      // Super/this call
      if (node.superCall) {
        const superArgs = node.superCall.arguments.map(a => this.emit(a));
        code += this.line(`super(${superArgs.join(', ')});`);
      } else if (node.thisCall) {
        const thisArgs = node.thisCall.arguments.map(a => this.emit(a));
        code += this.line(`this(${thisArgs.join(', ')});`);
      }

      // Body
      if (node.body) {
        for (const stmt of node.body.statements) {
          code += this.emit(stmt);
        }
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitParameterDecl(node) {
      let decl = '';
      if (node.isFinal) decl += 'final ';
      if (node.isVarArgs) {
        // For varargs, replace [] with ...
        const baseType = node.type.name;
        decl += `${baseType}... ${node.name}`;
      } else {
        decl += `${node.type.toString()} ${node.name}`;
      }
      return decl;
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
      let code = '';
      if (node.isFinal) code += 'final ';
      code += `${node.type.toString()} ${node.name}`;
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
        for (const stmt of node.thenBranch.statements) {
          code += this.emit(stmt);
        }
      } else {
        code += this.emit(node.thenBranch);
      }

      this.indentLevel--;
      code += this.line('}');

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          // else if
          code = code.trimEnd() + ' else ';
          const elseIfCode = this.emit(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code = code.trimEnd() + ' else {' + this.newline;
          this.indentLevel++;
          if (node.elseBranch.nodeType === 'Block') {
            for (const stmt of node.elseBranch.statements) {
              code += this.emit(stmt);
            }
          } else {
            code += this.emit(node.elseBranch);
          }
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      let init = '';
      if (node.initializer) {
        if (node.initializer.nodeType === 'VariableDeclaration') {
          if (node.initializer.isFinal) init += 'final ';
          init += `${node.initializer.type.toString()} ${node.initializer.name}`;
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
      for (const stmt of node.body.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitForEach(node) {
      let code = this.line(
        `for (${node.variableType.toString()} ${node.variableName} : ${this.emit(node.iterable)}) {`
      );
      this.indentLevel++;
      for (const stmt of node.body.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      let code = this.line(`while (${this.emit(node.condition)}) {`);
      this.indentLevel++;
      for (const stmt of node.body.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitDoWhile(node) {
      let code = this.line('do {');
      this.indentLevel++;
      for (const stmt of node.body.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;
      code = code.trimEnd() + this.newline;
      code += this.line(`} while (${this.emit(node.condition)});`);
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
      if (node.label) {
        return this.line(`break ${node.label};`);
      }
      return this.line('break;');
    }

    emitContinue(node) {
      if (node.label) {
        return this.line(`continue ${node.label};`);
      }
      return this.line('continue;');
    }

    emitThrow(node) {
      return this.line(`throw ${this.emit(node.expression)};`);
    }

    emitTryCatch(node) {
      let code = this.line('try {');
      this.indentLevel++;
      for (const stmt of node.tryBlock.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;
      code += this.line('}');

      for (const catchClause of node.catchClauses) {
        code = code.trimEnd();
        code += ` catch (${catchClause.exceptionType.toString()} ${catchClause.variableName}) {${this.newline}`;
        this.indentLevel++;
        for (const stmt of catchClause.body.statements) {
          code += this.emit(stmt);
        }
        this.indentLevel--;
        code += this.line('}');
      }

      if (node.finallyBlock) {
        code = code.trimEnd() + ' finally {' + this.newline;
        this.indentLevel++;
        for (const stmt of node.finallyBlock.statements) {
          code += this.emit(stmt);
        }
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitCatchClause(node) {
      // Handled by emitTryCatch
      return '';
    }

    emitSynchronized(node) {
      let code = this.line(`synchronized (${this.emit(node.expression)}) {`);
      this.indentLevel++;
      for (const stmt of node.block.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'null') return 'null';
      if (node.literalType === 'boolean') return node.value ? 'true' : 'false';
      if (node.literalType === 'string') {
        // Escape string and wrap in quotes
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }
      if (node.literalType === 'char') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'");
        return `'${escaped}'`;
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
      const left = this.emit(node.left);
      const right = this.emit(node.right);
      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);
      if (node.isPrefix) {
        return `${node.operator}${operand}`;
      }
      return `${operand}${node.operator}`;
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} ${node.operator} ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      return `${this.emit(node.target)}.${node.member}`;
    }

    emitArrayAccess(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitMethodCall(node) {
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

    emitObjectCreation(node) {
      let code = `new ${node.type.toString()}`;
      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitArrayCreation(node) {
      if (node.size) {
        return `new ${node.elementType.toString()}[${this.emit(node.size)}]`;
      } else if (node.initializer) {
        return `new ${node.elementType.toString()}[] { ${node.initializer.map(e => this.emit(e)).join(', ')} }`;
      } else {
        return `new ${node.elementType.toString()}[0]`;
      }
    }

    emitCast(node) {
      return `(${node.type.toString()})${this.emit(node.expression)}`;
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.trueExpression)} : ${this.emit(node.falseExpression)}`;
    }

    emitLambda(node) {
      let params;
      if (Array.isArray(node.parameters) && typeof node.parameters[0] === 'string') {
        // Simple parameter names
        params = node.parameters.length === 1 ? node.parameters[0] : `(${node.parameters.join(', ')})`;
      } else {
        // Full parameter declarations
        params = `(${node.parameters.map(p => this.emitParameterDecl(p)).join(', ')})`;
      }

      let body;
      if (node.body.nodeType === 'Block') {
        body = ' {' + this.newline;
        this.indentLevel++;
        for (const stmt of node.body.statements) {
          body += this.emit(stmt);
        }
        this.indentLevel--;
        body += this.indent() + '}';
      } else {
        body = this.emit(node.body);
      }

      return `${params} -> ${body}`;
    }

    emitThis(node) {
      return 'this';
    }

    emitSuper(node) {
      return 'super';
    }

    emitInstanceOf(node) {
      return `${this.emit(node.expression)} instanceof ${node.type.toString()}`;
    }

    emitParenthesized(node) {
      return `(${this.emit(node.expression)})`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitJavaDoc(node) {
      let code = this.line('/**');

      if (node.description) {
        for (const line of node.description.split('\n')) {
          code += this.line(` * ${line.trim()}`);
        }
      }

      if (node.parameters.length > 0 || node.returns || node.throws.length > 0) {
        code += this.line(' *');
      }

      for (const param of node.parameters) {
        code += this.line(` * @param ${param.name} ${param.description}`);
      }

      if (node.returns) {
        code += this.line(` * @return ${node.returns}`);
      }

      for (const throwsClause of node.throws) {
        code += this.line(` * @throws ${throwsClause.type} ${throwsClause.description}`);
      }

      if (node.see && node.see.length > 0) {
        for (const ref of node.see) {
          code += this.line(` * @see ${ref}`);
        }
      }

      if (node.since) {
        code += this.line(` * @since ${node.since}`);
      }

      if (node.deprecated) {
        code += this.line(` * @deprecated ${node.deprecated}`);
      }

      code += this.line(' */');
      return code;
    }
  }

  // Export
  const exports = { JavaEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.JavaEmitter = JavaEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
