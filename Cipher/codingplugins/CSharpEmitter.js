/**
 * CSharpEmitter.js - C# Code Generator from C# AST
 * Generates properly formatted C# source code from CSharpAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C# AST -> C# Emitter -> C# Source
 */

(function(global) {
  'use strict';

  // Integer types where a constant-literal cast needs `unchecked(...)` protection -
  // see emitCast's comment for why.
  const INTEGER_CAST_TARGET_TYPES = new Set(['sbyte', 'byte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong']);

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

      if (typeof node === 'string') return node;

      // Handle arrays
      if (Array.isArray(node)) {
        return node.map(n => this.emit(n)).filter(s => s).join('');
      }

      // Duck typing fallback for nodes with missing nodeType
      if (!node.nodeType) {
        if (node.statements !== undefined) return this.emitBlock(node);
        if (node.target && node.value && node.operator !== undefined) return this.emitAssignment(node);
        if (node.name && typeof node.name === 'string') return this.emitIdentifier(node);
        // Skip known control objects
        if (node.isMethod !== undefined || node.initStatement !== undefined) return '';
        // Show more debug info for unknown nodes
        const keys = Object.keys(node).slice(0, 5).join(', ');
        console.error(`No emitter for node type: ${node.nodeType} (keys: ${keys})`);
        return '';
      }

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
      // `const` is implicitly static in C# - combining it with an explicit `static`
      // modifier is a syntax error (CS0106), so skip `static` whenever `const` applies.
      if (node.isConst) decl += ' const';
      else {
        if (node.isStatic) decl += ' static';
        if (node.isReadOnly) decl += ' readonly';
      }
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

      // Static constructors have different syntax: static ClassName() with no access modifier
      let decl = '';
      if (node.isStatic) {
        decl = `static ${node.className}`;
      } else {
        decl = `${node.accessModifier} ${node.className}`;
      }

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      // Base/this call (not allowed for static constructors)
      if (!node.isStatic) {
        if (node.baseCall) {
          const baseArgs = node.baseCall.arguments.map(a => this.emit(a));
          decl += ` : base(${baseArgs.join(', ')})`;
        } else if (node.thisCall) {
          const thisArgs = node.thisCall.arguments.map(a => this.emit(a));
          decl += ` : this(${thisArgs.join(', ')})`;
        }
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
          // Additional comma-separated declarators of the SAME type (e.g. JS's
          // `for (let a = 0, b = 1; ...)`) - see CSharpFor.extraDeclarators.
          if (node.extraDeclarators && node.extraDeclarators.length > 0) {
            for (const extra of node.extraDeclarators) {
              init += `, ${extra.name}`;
              if (extra.initializer) init += ` = ${this.emit(extra.initializer)}`;
            }
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

    // Comma-separated expression list - only ever constructed for a for-statement's
    // incrementor clause (see CSharpCommaExpression's doc comment / transformForStatement).
    emitCommaExpression(node) {
      return node.expressions.map(e => this.emit(e)).join(', ');
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
      if (node.literalType === 'char') {
        // Escape char and wrap in single quotes
        const char = String(node.value);
        let escaped = char
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `'${escaped}'`;
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

    // True when `target`'s own emitted code needs wrapping in parentheses before a
    // tighter-binding suffix (`.Member`, `[index]`, `.Method(...)`) is appended -
    // otherwise that suffix silently attaches to only PART of target's expression
    // instead of its whole computed value. Shared by emitMemberAccess/
    // emitElementAccess/emitMethodCall (all three have the identical problem for the
    // identical set of looser-binding node types) - see emitMemberAccess's own doc
    // comment for the Cast/Conditional cases this was written for. A BinaryExpression
    // (covers every C# binary AND logical operator - `+`, `^`, `&&`, `||`, etc., which
    // all share this one AST node type - see CSharpBinaryExpression) has the exact
    // same lower-precedence issue: `a || b.Length` parses as `a || (b.Length)`, not
    // `(a || b).Length` - e.g. `(str.Match(...) || Array.Empty<byte>()).Length` (a
    // transformed JS `(x.match(/re/g) || []).length`) previously emitted the `.Length`
    // bound to only the empty-array fallback on the right (CS0019: `||` on `Match`
    // and `int`).
    // An Assignment binds more loosely still (lowest of all): `a = b.Select(...)
    // .ToArray()` parses its ENTIRE right-hand side as the assignment's value, so
    // chaining a further `.Select(...)`/`.Member`/`[i]` onto an assignment used as a
    // call/member-access TARGET (e.g. a JS `.reverse()` call's mutate-and-return-self
    // semantics reassigning the local before it's spread into another call, as in
    // block/baseking.js's `this.diffusion([...template.reverse()])`) silently
    // extends the assignment's own RHS to include that suffix instead of applying the
    // suffix to the assignment's resulting value - corrupting the (still uint[]-
    // declared) target variable with the suffix's byte[] result (CS0029).
    _targetNeedsParens(target) {
      return target.nodeType === 'Cast' || target.nodeType === 'Conditional' || target.nodeType === 'BinaryExpression' || target.nodeType === 'Assignment';
    }

    emitMemberAccess(node) {
      // A cast binds more loosely than member access - `(T)x.Member` parses as
      // `(T)(x.Member)`, not `((T)x).Member` (same issue emitMethodCall already guards
      // against for `.Method()` targets). Needed e.g. when downcasting a base-typed
      // `this.Algorithm` to read a field only the concrete subclass declares:
      // `((TwofishAlgorithm)this.Algorithm).GMDS0`.
      // A ternary `?:` binds even more loosely than a cast, and has the identical
      // problem: `cond ? a : b.Member` parses as `cond ? a : (b.Member)`, not
      // `(cond ? a : b).Member` - e.g. a `const result = isInverse ? this.Decompress(x)
      // : this.Compress(x);` whose declared type needed a widening cast (see
      // castIfNeeded's array branch/buildParameterConversion) wraps the WHOLE
      // conditional in `.Select(...)`, but without these parens that Select silently
      // attached to only the alternate branch instead (CS0029 - the OTHER, unwrapped
      // branch still mismatches the declared type). See _targetNeedsParens' own doc
      // comment for the (identically-problematic) BinaryExpression case.
      let targetCode = this.emit(node.target);
      if (this._targetNeedsParens(node.target)) {
        targetCode = `(${targetCode})`;
      }
      return `${targetCode}.${node.member}`;
    }

    emitElementAccess(node) {
      const index = this.emit(node.index).replace(/[\r\n]+/g, '').replace(/\s+/g, ' ').trim();
      // Same cast/ternary/binary-binds-more-loosely-than-indexing issue as
      // emitMemberAccess above (see _targetNeedsParens): `(T)x[i]` parses as
      // `(T)(x[i])`, `cond ? a : b[i]` parses as `cond ? a : (b[i])`, and `a || b[i]`
      // parses as `a || (b[i])` - none of `((T)x)[i]`/`(cond ? a : b)[i]`/`(a ||
      // b)[i]`.
      let targetCode = this.emit(node.target);
      if (this._targetNeedsParens(node.target)) {
        targetCode = `(${targetCode})`;
      }
      return `${targetCode}[${index}]`;
    }

    emitRange(node) {
      // C# range syntax: start..end, start.., ..end, or ..
      const start = node.start ? this.emit(node.start) : '';
      const end = node.end ? this.emit(node.end) : '';
      return `${start}..${end}`;
    }

    emitIndexFromEnd(node) {
      // C# 8.0+ index from end syntax: ^n (means n elements from end)
      const index = this.emit(node.index);
      return `^${index}`;
    }

    emitMethodCall(node) {
      let code = '';
      if (node.target) {
        // Wrap casts, ternaries, and binary/logical expressions (see
        // _targetNeedsParens/emitMemberAccess's identical, more fully commented guard)
        // in parentheses when used as a method call target - e.g.
        // (char)x.ToString() should be ((char)x).ToString(), `(cond ? a :
        // b).Select(...)` needs the same protection or the Select binds to only the
        // alternate branch `b` instead of the whole conditional, and `(a ||
        // b).Select(...)` needs it too or Select binds to only `b`.
        let targetCode = this.emit(node.target);
        if (this._targetNeedsParens(node.target)) {
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
      // Defensive: if elementType is null, fallback to object
      const elementType = node.elementType || { toString: () => 'object', isArray: false };

      // For sized array creation, C# requires the size on the first dimension
      // e.g., new uint[4][] not new uint[][4]
      if (node.size) {
        // Get the base type (without array brackets)
        let baseType = elementType;
        let trailingBrackets = '';

        // If element type is itself an array, extract the base and collect trailing brackets
        while (baseType && baseType.isArray) {
          trailingBrackets += '[]';
          baseType = baseType.elementType;
        }

        // Emit as: new BaseType[size] + trailingBrackets
        const baseTypeName = baseType ? baseType.toString() : elementType.toString();
        return `new ${baseTypeName}[${this.emit(node.size)}]${trailingBrackets}`;
      } else if (node.initializer) {
        return `new ${elementType.toString()}[] { ${node.initializer.map(e => this.emit(e)).join(', ')} }`;
      } else {
        return `new ${elementType.toString()}[0]`;
      }
    }

    emitObjectInitializer(node) {
      if (node.isDictionary) {
        // Dictionary<K,V> collection initializer syntax: { { "key", value }, ... }
        // The key can be an arbitrary JS object-literal property name (e.g. a
        // punctuation character like `"` in a Morse-code lookup table) - emit it
        // through the same escaping rules as a normal string literal, otherwise an
        // unescaped quote/backslash in the key breaks out of the C# string literal
        // (CS8997 "unterminated string literal" and cascading syntax errors).
        const escapeKey = (name) => String(name)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        const entries = node.assignments.map(a =>
          `{ "${escapeKey(a.name)}", ${this.emit(a.value)} }`
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

    emitAnonymousObject(node) {
      if (!node.properties || node.properties.length === 0) {
        return 'new { }';
      }
      // C# reserved keywords that need @ prefix when used as identifiers
      const reservedKeywords = new Set([
        'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
        'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default',
        'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern',
        'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if',
        'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long',
        'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
        'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return',
        'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string',
        'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint',
        'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void',
        'volatile', 'while'
      ]);
      const escapeIfReserved = (name) =>
        reservedKeywords.has(name) ? `@${name}` : name;
      const props = node.properties.map(p =>
        `${escapeIfReserved(p.name)} = ${this.emit(p.value)}`
      );
      return `new { ${props.join(', ')} }`;
    }

    emitStringInterpolation(node) {
      // Build C# interpolated string: $"Hello {name}!"
      let result = '$"';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          // String literal part - escape for C# interpolated strings
          result += part
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\{/g, '{{')
            .replace(/\}/g, '}}');
        } else {
          // Expression part - emit and wrap in braces. A bare `cond ? a : b` ternary
          // directly inside a `$"..."` interpolation hole is a hard compile error
          // (CS8361) - the `:` is parsed as ending the interpolation's format-specifier
          // section, not as part of the conditional operator. Parenthesize it (C#'s
          // documented workaround) rather than emit invalid syntax whenever the source
          // JS used a template-literal-embedded ternary (e.g. `` `...${x ? a : b}...` ``).
          const emitted = part.nodeType === 'Conditional' ? `(${this.emit(part)})` : this.emit(part);
          result += '{' + emitted + '}';
        }
      }
      result += '"';
      return result;
    }

    emitCast(node) {
      const rendered = `(${node.type.toString()})(${this.emit(node.expression)})`;
      // ANY cast to an integral type whose operand happens to be a COMPILE-TIME
      // CONSTANT is checked for overflow unconditionally by the C# compiler -
      // independent of any surrounding checked/unchecked context - and rejected
      // with CS0221 ("Der Konstantenwert ... kann nicht in ... konvertiert werden
      // ... verwenden Sie zum Außerkraftsetzen die unchecked-Syntax") the moment the
      // constant's value doesn't fit the target type. This bites in more shapes than
      // it might look like at first: a plain literal (`(int)(0xFFFFFFFF)`, e.g.
      // ISAP's `uint`-range hex mask coerced into `int`); a NEGATED literal (`(byte)
      // (-1)`, e.g. ecc/alamouti-code.js's Alamouti-matrix test vectors - negative
      // numbers are never their own literal token, the parser always builds them as
      // a UnaryExpression wrapping the positive literal); a reference to a `const`
      // field (`(byte)(CHACHA_CONST_0)` / `(uint)(T2)`, e.g. random/chacha.js's
      // 32-bit magic constants and random/well.js's negative tempering constants -
      // both declared `public const int ... = <value>;` elsewhere in the same
      // class); `double`/`float`'s own `PositiveInfinity`/`NegativeInfinity`/`NaN`
      // const members; or an arbitrary constant SUB-EXPRESSION built from any of the
      // above (e.g. block/hpc.js's `(int)(0xFFFFFFFFFFFFFF00UL)`-shaped mask). A
      // non-constant cast (the operand is a genuine runtime variable/expression)
      // never hits this rule in the first place, and `unchecked(...)` is a
      // documented no-op there (C#'s default arithmetic context is already
      // unchecked at runtime) - so rather than re-deriving "is this operand actually
      // a compile-time constant" per-shape (a full constant-folding evaluator, only
      // ever right up to the next shape nobody thought of yet), it's simplest AND
      // safe to wrap every integral-target cast in `unchecked(...)` unconditionally:
      // harmless for the non-constant case, and exactly what the compiler's own
      // CS0221 message suggests for every constant case, matching JS's own silent
      // wraparound numeric semantics besides.
      if (INTEGER_CAST_TARGET_TYPES.has(node.type?.name)) {
        return `unchecked(${rendered})`;
      }
      return rendered;
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
