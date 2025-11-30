/**
 * CppEmitter.js - C++ Code Generator from C++ AST
 * Generates properly formatted C++ source code from CppAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C++ AST -> C++ Emitter -> C++ Source
 */

(function(global) {
  'use strict';

  // Load CppAST if available
  let CppAST;
  if (typeof require !== 'undefined') {
    CppAST = require('./CppAST.js');
  } else if (global.CppAST) {
    CppAST = global.CppAST;
  }

  /**
   * C++ Code Emitter
   * Generates formatted C++ code from a C++ AST
   */
  class CppEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
      this.braceStyle = options.braceStyle || 'knr'; // 'knr' (K&R) or 'allman'
      this.namingConvention = options.namingConvention || 'snake_case'; // 'snake_case' or 'camelCase'
    }

    /**
     * Emit C++ code from a C++ AST node
     * @param {CppNode} node - The AST node to emit
     * @returns {string} Generated C++ code
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

    openBrace() {
      if (this.braceStyle === 'allman') {
        return `${this.newline}${this.indent()}{${this.newline}`;
      }
      return ` {${this.newline}`;
    }

    closeBrace(semicolon = false) {
      return `${this.indent()}}${semicolon ? ';' : ''}${this.newline}`;
    }

    // ========================[ COMPILATION UNIT ]========================

    emitCompilationUnit(node) {
      let code = '';

      // Pragma directives
      for (const pragma of node.pragmas) {
        code += this.emit(pragma);
      }

      // Include directives
      for (const include of node.includes) {
        code += this.emit(include);
      }
      if (node.includes.length > 0) {
        code += this.newline;
      }

      // Namespaces
      for (const ns of node.namespaces) {
        code += this.emit(ns);
      }

      // Top-level types (rare)
      for (const type of node.types) {
        code += this.emit(type);
      }

      return code;
    }

    emitIncludeDirective(node) {
      if (node.isSystem) {
        return this.line(`#include <${node.header}>`);
      }
      return this.line(`#include "${node.header}"`);
    }

    emitNamespace(node) {
      let code = this.line(`namespace ${node.name} {`);
      this.indentLevel++;

      // Functions
      for (const func of node.functions) {
        code += this.emit(func);
        code += this.newline;
      }

      // Types
      for (const type of node.types) {
        code += this.emit(type);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line(`}  // namespace ${node.name}`);
      return code;
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitClass(node) {
      let code = '';

      // Doxygen documentation
      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      let decl = `class ${node.name}`;

      // Base classes
      if (node.baseClasses.length > 0) {
        const bases = node.baseClasses.map(b => `public ${b.toString()}`);
        decl += ` : ${bases.join(', ')}`;
      }

      code += this.line(decl + ' {');

      // Public section
      if (node.publicMembers.length > 0) {
        code += this.line('public:');
        this.indentLevel++;
        for (const member of node.publicMembers) {
          code += this.emit(member);
          code += this.newline;
        }
        this.indentLevel--;
      }

      // Private section
      if (node.privateMembers.length > 0) {
        code += this.line('private:');
        this.indentLevel++;
        for (const member of node.privateMembers) {
          code += this.emit(member);
          code += this.newline;
        }
        this.indentLevel--;
      }

      // Protected section
      if (node.protectedMembers.length > 0) {
        code += this.line('protected:');
        this.indentLevel++;
        for (const member of node.protectedMembers) {
          code += this.emit(member);
          code += this.newline;
        }
        this.indentLevel--;
      }

      code += this.line('};');
      return code;
    }

    emitStruct(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      code += this.line(`struct ${node.name} {`);
      this.indentLevel++;

      for (const member of node.members) {
        code += this.emit(member);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('};');
      return code;
    }

    // ========================[ MEMBERS ]========================

    emitField(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.isConstexpr) decl += 'constexpr ';
      else if (node.isConst) decl += 'const ';
      if (node.isMutable) decl += 'mutable ';

      decl += `${node.type.toString()} ${node.name}`;

      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      code += this.line(`${decl};`);
      return code;
    }

    emitMethod(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.isVirtual) decl += 'virtual ';
      if (node.isInline) decl += 'inline ';
      if (node.isConstexpr) decl += 'constexpr ';

      decl += `${node.returnType.toString()} ${node.name}`;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      if (node.isConst) {
        decl += ' const';
      }

      if (node.isOverride) {
        decl += ' override';
      }

      if (!node.body) {
        code += this.line(`${decl};`);
      } else {
        code += this.line(decl);
        code += this.emit(node.body);
      }

      return code;
    }

    emitConstructor(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      if (node.isExplicit) decl += 'explicit ';
      decl += node.className;

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      // Initializer list
      if (node.initializerList.length > 0) {
        const inits = node.initializerList.map(init =>
          `${init.member}(${this.emit(init.value)})`
        );
        decl += ` : ${inits.join(', ')}`;
      }

      if (node.isDefault) {
        code += this.line(`${decl} = default;`);
      } else if (node.isDelete) {
        code += this.line(`${decl} = delete;`);
      } else {
        code += this.line(decl);
        if (node.body) {
          code += this.emit(node.body);
        } else {
          code += this.line('{');
          code += this.line('}');
        }
      }

      return code;
    }

    emitDestructor(node) {
      let code = '';
      let decl = '';
      if (node.isVirtual) decl += 'virtual ';
      decl += `~${node.className}()`;

      if (node.isDefault) {
        code += this.line(`${decl} = default;`);
      } else if (node.isDelete) {
        code += this.line(`${decl} = delete;`);
      } else {
        code += this.line(decl);
        if (node.body) {
          code += this.emit(node.body);
        } else {
          code += this.line('{');
          code += this.line('}');
        }
      }

      return code;
    }

    emitParameterDecl(node) {
      let decl = `${node.type.toString()} ${node.name}`;
      if (node.defaultValue) {
        decl += ` = ${this.emit(node.defaultValue)}`;
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
      if (node.isStatic) code += 'static ';
      if (node.isConstexpr) code += 'constexpr ';
      else if (node.isConst) code += 'const ';

      code += `${node.type.toString()} ${node.name}`;

      if (node.initializer) {
        code += ` = ${this.emit(node.initializer)}`;
      }

      return this.line(`${code};`);
    }

    emitExpressionStatement(node) {
      // Skip no-op statements
      if (node.expression && node.expression.isNoop) {
        return '';
      }
      return this.line(`${this.emit(node.expression)};`);
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line(`return ${this.emit(node.expression)};`);
      }
      return this.line('return;');
    }

    emitIf(node) {
      let code = this.line(`if (${this.emit(node.condition)})`);

      if (node.thenBranch.nodeType === 'Block') {
        code += this.emit(node.thenBranch);
      } else {
        this.indentLevel++;
        code += this.emit(node.thenBranch);
        this.indentLevel--;
      }

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          // else if
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
            code += this.emit(node.elseBranch);
            this.indentLevel--;
          }
        }
      }

      return code;
    }

    emitFor(node) {
      let init = '';
      if (node.initializer) {
        if (node.initializer.nodeType === 'VariableDeclaration') {
          init = `${node.initializer.type.toString()} ${node.initializer.name}`;
          if (node.initializer.initializer) {
            init += ` = ${this.emit(node.initializer.initializer)}`;
          }
        } else {
          init = this.emit(node.initializer);
        }
      }

      const cond = node.condition ? this.emit(node.condition) : '';
      const incr = node.incrementor ? this.emit(node.incrementor) : '';

      let code = this.line(`for (${init}; ${cond}; ${incr})`);
      code += this.emit(node.body);
      return code;
    }

    emitRangeFor(node) {
      let code = this.line(
        `for (${node.variableType.toString()} ${node.variableName} : ${this.emit(node.collection)})`
      );
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
      code += ` while (${this.emit(node.condition)});${this.newline}`;
      return code;
    }

    emitSwitch(node) {
      let code = this.line(`switch (${this.emit(node.expression)})`);
      code += this.line('{');
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
      return this.line('break;');
    }

    emitContinue(node) {
      return this.line('continue;');
    }

    emitThrow(node) {
      return this.line(`throw ${this.emit(node.expression)};`);
    }

    emitTryCatch(node) {
      let code = this.line('try');
      code += this.emit(node.tryBlock);

      for (const catchClause of node.catchClauses) {
        code += this.emit(catchClause);
      }

      return code;
    }

    emitCatchClause(node) {
      let code = '';
      if (node.exceptionType) {
        code += this.line(`catch (${node.exceptionType.toString()} ${node.variableName})`);
      } else {
        code += this.line('catch (...)');
      }
      code += this.emit(node.body);
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'nullptr') return 'nullptr';
      if (node.literalType === 'bool') return node.value ? 'true' : 'false';
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
      let left = this.emit(node.left);
      let right = this.emit(node.right);

      // Add parentheses if needed for correct precedence
      if (node.leftNeedsParens) {
        left = `(${left})`;
      }
      if (node.rightNeedsParens) {
        right = `(${right})`;
      }

      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      const needsParens = node.operand.nodeType === 'BinaryExpression' ||
                          node.operand.nodeType === 'Conditional';

      if (node.isPrefix) {
        return needsParens ? `${node.operator}(${operand})` : `${node.operator}${operand}`;
      }
      return `${operand}${node.operator}`;
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} ${node.operator} ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      const op = node.isPointer ? '->' : '.';
      return `${this.emit(node.target)}${op}${node.member}`;
    }

    emitElementAccess(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitFunctionCall(node) {
      let code = '';
      if (node.target) {
        code += `${this.emit(node.target)}.`;
      }
      code += node.functionName;

      if (node.templateArgs && node.templateArgs.length > 0) {
        code += `<${node.templateArgs.map(t => t.toString()).join(', ')}>`;
      }

      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitObjectCreation(node) {
      let code = `${node.type.toString()}`;

      if (node.arguments.length > 0) {
        const args = node.arguments.map(a => this.emit(a));
        code += `(${args.join(', ')})`;
      } else {
        code += '()';
      }

      return code;
    }

    emitArrayCreation(node) {
      if (node.size) {
        // std::vector<T>(size)
        return `std::vector<${node.elementType.toString()}>(${this.emit(node.size)})`;
      } else if (node.initializer) {
        // { elem1, elem2, elem3 }
        return `{ ${node.initializer.map(e => this.emit(e)).join(', ')} }`;
      } else {
        return `std::vector<${node.elementType.toString()}>()`;
      }
    }

    emitInitializerList(node) {
      return `{ ${node.elements.map(e => this.emit(e)).join(', ')} }`;
    }

    emitCast(node) {
      if (node.castType === 'c-style') {
        return `(${node.type.toString()})(${this.emit(node.expression)})`;
      }
      // Use C++ style casts: static_cast, dynamic_cast, etc.
      return `${node.castType}_cast<${node.type.toString()}>(${this.emit(node.expression)})`;
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.trueExpression)} : ${this.emit(node.falseExpression)}`;
    }

    emitLambda(node) {
      let captures = '[]';
      if (node.captures.length > 0) {
        captures = `[${node.captures.join(', ')}]`;
      }

      let params = '';
      if (node.parameters.length > 0) {
        params = `(${node.parameters.map(p => this.emitParameterDecl(p)).join(', ')})`;
      } else {
        params = '()';
      }

      let returnTypeDecl = '';
      if (node.returnType) {
        returnTypeDecl = ` -> ${node.returnType.toString()}`;
      }

      let body;
      if (node.body.nodeType === 'Block') {
        body = this.emit(node.body).trim();
      } else {
        body = `{ return ${this.emit(node.body)}; }`;
      }

      return `${captures}${params}${returnTypeDecl} ${body}`;
    }

    emitThis(node) {
      return 'this';
    }

    emitSizeof(node) {
      return `sizeof(${node.type.toString()})`;
    }

    emitParenthesized(node) {
      return `(${this.emit(node.expression)})`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitDocComment(node) {
      let code = '';

      if (node.brief) {
        code += this.line('/**');
        code += this.line(` * @brief ${node.brief}`);
        if (node.details) {
          code += this.line(' *');
          for (const line of node.details.split('\n')) {
            code += this.line(` * ${line.trim()}`);
          }
        }
      }

      for (const param of node.parameters) {
        code += this.line(` * @param ${param.name} ${param.description}`);
      }

      if (node.returns) {
        code += this.line(` * @return ${node.returns}`);
      }

      if (node.brief) {
        code += this.line(' */');
      }

      return code;
    }
  }

  // Export
  const exports = { CppEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CppEmitter = CppEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
