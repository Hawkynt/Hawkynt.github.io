/**
 * CSharpEmitter.js - C# Code Generator from C# AST
 * Generates properly formatted C# source code from CSharpAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C# AST -> C# Emitter -> C# Source
 */

(function(global) {
  'use strict';

  // Load CSharpAST if available
  let CSharpAST;
  if (typeof require !== 'undefined') {
    CSharpAST = require('./CSharpAST.js');
  } else if (global.CSharpAST) {
    CSharpAST = global.CSharpAST;
  }

  /**
   * C# Code Emitter
   * Generates formatted C# code from a C# AST
   */
  class CSharpEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
      this.braceStyle = options.braceStyle || 'knr'; // 'knr' or 'allman'
    }

    /**
     * Emit C# code from a C# AST node
     * @param {CSharpNode} node - The AST node to emit
     * @returns {string} Generated C# code
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

      // Using directives
      for (const using of node.usings) {
        code += this.emit(using);
      }
      if (node.usings.length > 0) {
        code += this.newline;
      }

      // Namespace
      if (node.namespace) {
        code += this.emit(node.namespace);
      }

      // Top-level types (rare)
      for (const type of node.types) {
        code += this.emit(type);
      }

      return code;
    }

    emitUsingDirective(node) {
      if (node.alias) {
        return this.line(`using ${node.alias} = ${node.namespace};`);
      }
      return this.line(`using ${node.namespace};`);
    }

    emitNamespace(node) {
      let code = this.line(`namespace ${node.name}`);
      code += this.line('{');
      this.indentLevel++;

      for (const type of node.types) {
        code += this.emit(type);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitClass(node) {
      let code = '';

      // XML documentation
      if (node.xmlDoc) {
        code += this.emit(node.xmlDoc);
      }

      // Declaration line
      let decl = node.accessModifier;
      if (node.isStatic) decl += ' static';
      if (node.isAbstract) decl += ' abstract';
      if (node.isSealed) decl += ' sealed';
      if (node.isPartial) decl += ' partial';
      decl += ` class ${node.name}`;

      // Base class and interfaces
      const bases = [];
      if (node.baseClass) bases.push(node.baseClass.toString());
      bases.push(...node.interfaces.map(i => i.toString()));
      if (bases.length > 0) {
        decl += ` : ${bases.join(', ')}`;
      }

      code += this.line(decl);
      code += this.line('{');
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

    emitStruct(node) {
      let code = '';

      if (node.xmlDoc) {
        code += this.emit(node.xmlDoc);
      }

      let decl = node.accessModifier;
      if (node.isReadOnly) decl += ' readonly';
      decl += ` struct ${node.name}`;

      const interfaces = node.interfaces.map(i => i.toString());
      if (interfaces.length > 0) {
        decl += ` : ${interfaces.join(', ')}`;
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

    // ========================[ MEMBERS ]========================

    emitField(node) {
      let code = '';

      if (node.xmlDoc) {
        code += this.emit(node.xmlDoc);
      }

      let decl = node.accessModifier;
      if (node.isStatic) decl += ' static';
      if (node.isConst) decl += ' const';
      else if (node.isReadOnly) decl += ' readonly';
      decl += ` ${node.type.toString()} ${node.name}`;

      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      code += this.line(`${decl};`);
      return code;
    }

    emitProperty(node) {
      let code = '';

      if (node.xmlDoc) {
        code += this.emit(node.xmlDoc);
      }

      let decl = node.accessModifier;
      if (node.isStatic) decl += ' static';
      decl += ` ${node.type.toString()} ${node.name}`;

      // Auto-property
      if (!node.getterBody && !node.setterBody) {
        let accessors = '{ ';
        if (node.hasGetter) accessors += 'get; ';
        if (node.hasSetter) accessors += 'set; ';
        accessors += '}';
        decl += ` ${accessors}`;
        if (node.initializer) {
          decl += ` = ${this.emit(node.initializer)};`;
        }
        code += this.line(decl);
      } else {
        // Full property
        code += this.line(decl);
        code += this.line('{');
        this.indentLevel++;

        if (node.hasGetter) {
          if (node.getterBody) {
            code += this.line('get');
            code += this.emit(node.getterBody);
          } else {
            code += this.line('get;');
          }
        }

        if (node.hasSetter) {
          if (node.setterBody) {
            code += this.line('set');
            code += this.emit(node.setterBody);
          } else {
            code += this.line('set;');
          }
        }

        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    emitMethod(node) {
      let code = '';

      if (node.xmlDoc) {
        code += this.emit(node.xmlDoc);
      }

      let decl = node.accessModifier;
      if (node.isStatic) decl += ' static';
      if (node.isVirtual) decl += ' virtual';
      if (node.isOverride) decl += ' override';
      if (node.isAbstract) decl += ' abstract';
      if (node.isAsync) decl += ' async';

      decl += ` ${node.returnType.toString()} ${node.name}`;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      if (node.isAbstract || !node.body) {
        code += this.line(`${decl};`);
      } else {
        code += this.line(decl);
        code += this.emit(node.body);
      }

      return code;
    }

    emitConstructor(node) {
      let code = '';

      if (node.xmlDoc) {
        code += this.emit(node.xmlDoc);
      }

      let decl = `${node.accessModifier} ${node.className}`;

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      // Base/this call
      if (node.baseCall) {
        const baseArgs = node.baseCall.arguments.map(a => this.emit(a));
        decl += ` : base(${baseArgs.join(', ')})`;
      } else if (node.thisCall) {
        const thisArgs = node.thisCall.arguments.map(a => this.emit(a));
        decl += ` : this(${thisArgs.join(', ')})`;
      }

      code += this.line(decl);
      if (node.body) {
        code += this.emit(node.body);
      } else {
        code += this.line('{');
        code += this.line('}');
      }

      return code;
    }

    emitParameterDecl(node) {
      let decl = '';
      if (node.isRef) decl += 'ref ';
      if (node.isOut) decl += 'out ';
      if (node.isParams) decl += 'params ';
      decl += `${node.type.toString()} ${node.name}`;
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
      let code = `${node.type.toString()} ${node.name}`;
      if (node.initializer) {
        code += ` = ${this.emit(node.initializer)}`;
      }
      return this.line(`${code};`);
    }

    emitExpressionStatement(node) {
      // Skip no-op statements (like "x = x")
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
          // Remove indent from next if
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

    emitForEach(node) {
      let code = this.line(
        `foreach (${node.variableType.toString()} ${node.variableName} in ${this.emit(node.collection)})`
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

      if (node.finallyBlock) {
        code += this.line('finally');
        code += this.emit(node.finallyBlock);
      }

      return code;
    }

    emitCatchClause(node) {
      let code = '';
      if (node.exceptionType) {
        code += this.line(`catch (${node.exceptionType.toString()} ${node.variableName})`);
      } else {
        code += this.line('catch');
      }
      code += this.emit(node.body);
      return code;
    }

    emitRawCode(node) {
      // Emit raw C# code verbatim, with proper indentation
      return this.line(node.code);
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'null') return 'null';
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

      // BigInteger literal - use BigInteger.Parse for very large values
      if (node.isBigInteger) {
        const hexStr = node.value.toString(16).toUpperCase();
        return `BigInteger.Parse("${hexStr}", System.Globalization.NumberStyles.HexNumber)`;
      }

      // Numeric literal
      let result;
      if (node.isHex) {
        // Handle BigInt values that can be converted to hex
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

      // Need parentheses when the operand is a binary-like expression
      // to avoid operator precedence issues like "!x is string" instead of "!(x is string)"
      const needsParens = node.operand.nodeType === 'IsExpression' ||
                          node.operand.nodeType === 'AsExpression' ||
                          node.operand.nodeType === 'BinaryExpression' ||
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
      return `${this.emit(node.target)}.${node.member}`;
    }

    emitElementAccess(node) {
      return `${this.emit(node.target)}[${this.emit(node.index)}]`;
    }

    emitMethodCall(node) {
      let code = '';
      if (node.target) {
        // Wrap casts in parentheses when used as method call target
        // e.g., (char)x.ToString() should be ((char)x).ToString()
        let targetCode = this.emit(node.target);
        if (node.target.nodeType === 'Cast') {
          targetCode = `(${targetCode})`;
        }
        code += `${targetCode}.`;
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

      if (node.arguments.length > 0 || !node.initializer) {
        const args = node.arguments.map(a => this.emit(a));
        code += `(${args.join(', ')})`;
      }

      if (node.initializer) {
        code += ` ${this.emit(node.initializer)}`;
      }

      return code;
    }

    emitArrayCreation(node) {
      // For sized array creation, C# requires the size on the first dimension
      // e.g., new uint[4][] not new uint[][4]
      if (node.size) {
        // Get the base type (without array brackets)
        let baseType = node.elementType;
        let trailingBrackets = '';

        // If element type is itself an array, extract the base and collect trailing brackets
        while (baseType && baseType.isArray) {
          trailingBrackets += '[]';
          baseType = baseType.elementType;
        }

        // Emit as: new BaseType[size] + trailingBrackets
        const baseTypeName = baseType ? baseType.toString() : node.elementType.toString();
        return `new ${baseTypeName}[${this.emit(node.size)}]${trailingBrackets}`;
      } else if (node.initializer) {
        return `new ${node.elementType.toString()}[] { ${node.initializer.map(e => this.emit(e)).join(', ')} }`;
      } else {
        return `new ${node.elementType.toString()}[0]`;
      }
    }

    emitObjectInitializer(node) {
      if (node.isDictionary) {
        // Dictionary<K,V> collection initializer syntax: { { "key", value }, ... }
        const entries = node.assignments.map(a =>
          `{ "${a.name}", ${this.emit(a.value)} }`
        );
        return `{ ${entries.join(', ')} }`;
      } else {
        // Object initializer syntax: { Prop = value, ... }
        const assignments = node.assignments.map(a =>
          a.name ? `${a.name} = ${this.emit(a.value)}` : this.emit(a.value)
        );
        return `{ ${assignments.join(', ')} }`;
      }
    }

    emitCast(node) {
      return `(${node.type.toString()})(${this.emit(node.expression)})`;
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.trueExpression)} : ${this.emit(node.falseExpression)}`;
    }

    emitLambda(node) {
      let params;
      if (node.parameters.length === 1 && !node.parameters[0].type) {
        params = node.parameters[0].name;
      } else {
        params = `(${node.parameters.map(p => {
          if (p.type) return `${p.type.toString()} ${p.name}`;
          return p.name;
        }).join(', ')})`;
      }

      let body;
      if (node.body.nodeType === 'Block') {
        body = this.emit(node.body).trim();
      } else {
        body = this.emit(node.body);
      }

      return `${params} => ${body}`;
    }

    emitThis(node) {
      return 'this';
    }

    emitBase(node) {
      return 'base';
    }

    emitTypeOf(node) {
      return `typeof(${node.type.toString()})`;
    }

    emitIsExpression(node) {
      return `${this.emit(node.expression)} is ${node.type.toString()}`;
    }

    emitAsExpression(node) {
      return `${this.emit(node.expression)} as ${node.type.toString()}`;
    }

    emitParenthesized(node) {
      return `(${this.emit(node.expression)})`;
    }

    emitTupleExpression(node) {
      const elements = node.elements.map(e => {
        if (e.name) return `${e.name}: ${this.emit(e.expression)}`;
        return this.emit(e.expression);
      });
      return `(${elements.join(', ')})`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitXmlDoc(node) {
      let code = '';

      if (node.summary) {
        code += this.line('/// <summary>');
        for (const line of node.summary.split('\n')) {
          code += this.line(`/// ${line.trim()}`);
        }
        code += this.line('/// </summary>');
      }

      for (const param of node.parameters) {
        code += this.line(`/// <param name="${param.name}">${param.description}</param>`);
      }

      if (node.returns) {
        code += this.line(`/// <returns>${node.returns}</returns>`);
      }

      if (node.remarks) {
        code += this.line('/// <remarks>');
        code += this.line(`/// ${node.remarks}`);
        code += this.line('/// </remarks>');
      }

      for (const ex of node.exceptions) {
        code += this.line(`/// <exception cref="${ex.type}">${ex.description}</exception>`);
      }

      return code;
    }
  }

  // Export
  const exports = { CSharpEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CSharpEmitter = CSharpEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
