/**
 * BasicEmitter.js - Basic Code Generator from Basic AST
 * Generates properly formatted Basic source code from BasicAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Basic AST -> Basic Emitter -> Basic Source
 */

(function(global) {
  'use strict';

  // Load BasicAST if available
  let BasicAST;
  if (typeof require !== 'undefined') {
    BasicAST = require('./BasicAST.js');
  } else if (global.BasicAST) {
    BasicAST = global.BasicAST;
  }

  /**
   * Basic Code Emitter
   * Generates formatted Basic code from a Basic AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Emit comments. Default: true
   * - variant: string - Basic dialect. Default: 'FREEBASIC'
   * - upperCase: boolean - Use uppercase keywords. Default: false
   */
  class BasicEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
      this.variant = (options.variant || 'FREEBASIC').toUpperCase();
      this.upperCase = options.upperCase || false;
    }

    /**
     * Emit Basic code from a Basic AST node
     * @param {BasicNode} node - The AST node to emit
     * @returns {string} Generated Basic code
     */
    emit(node) {
      if (!node) return '';

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `' Unknown node type: ${node.nodeType}${this.newline}`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    /**
     * Format keyword with proper casing
     */
    kw(keyword) {
      return this.upperCase ? keyword.toUpperCase() : keyword;
    }

    // ========================[ MODULE ]========================

    emitModule(node) {
      let code = '';

      // Module comment
      if (node.moduleComment && this.options.addComments !== false) {
        code += this.emit(node.moduleComment);
        code += this.newline;
      }

      // Imports
      for (const imp of node.imports) {
        code += this.emit(imp);
      }
      if (node.imports.length > 0) {
        code += this.newline;
      }

      // Module-level attributes
      for (const attr of node.attributes) {
        code += this.emit(attr);
      }
      if (node.attributes.length > 0) {
        code += this.newline;
      }

      // Type declarations
      for (const type of node.types) {
        code += this.emit(type);
        code += this.newline;
      }

      // Module-level declarations
      for (const decl of node.declarations) {
        code += this.emit(decl);
        code += this.newline;
      }

      // Functions/Subs
      for (const func of node.functions) {
        code += this.emit(func);
        code += this.newline;
      }

      return code;
    }

    emitImport(node) {
      if (this.variant === 'VBNET') {
        // VB.NET uses Imports
        let code = this.kw('Imports') + ' ' + node.namespace;
        if (node.alias) {
          code += ' ' + this.kw('As') + ' ' + node.alias;
        }
        return this.line(code);
      } else if (this.variant === 'FREEBASIC') {
        // FreeBASIC uses #include
        return this.line(`#include "${node.namespace}.bi"`);
      } else {
        // Other variants may not have imports
        return '';
      }
    }

    emitAttribute(node) {
      if (this.variant === 'VBNET') {
        let code = '<' + node.name;
        if (node.arguments && node.arguments.length > 0) {
          code += '(' + node.arguments.join(', ') + ')';
        }
        code += '>';
        return this.line(code);
      }
      return '';
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitTypeDeclaration(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Type declaration
      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Type') + ' ' + node.name;

      code += this.line(decl);
      this.indentLevel++;

      for (const field of node.fields) {
        code += this.emit(field);
      }

      this.indentLevel--;
      code += this.line(this.kw('End Type'));

      return code;
    }

    emitField(node) {
      let code = '';

      if (node.visibility && node.visibility !== 'Public') {
        code += node.visibility + ' ';
      }

      code += node.name + ' ' + this.kw('As') + ' ' + node.type.toString();

      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }

      return this.line(code);
    }

    emitClass(node) {
      if (this.variant !== 'VBNET' && this.variant !== 'FREEBASIC' &&
          this.variant !== 'VB6' && this.variant !== 'GAMBAS' && this.variant !== 'XOJO') {
        // Fall back to Type for dialects without OOP
        const typeDecl = {
          nodeType: 'TypeDeclaration',
          name: node.name,
          visibility: node.visibility,
          fields: node.fields,
          docComment: node.docComment
        };
        return this.emitTypeDeclaration(typeDecl);
      }

      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Class') + ' ' + node.name;

      if (node.baseClass) {
        code += this.newline + this.indent() + this.kw('Inherits') + ' ' + node.baseClass;
      }

      if (node.implements && node.implements.length > 0) {
        code += this.newline + this.indent() + this.kw('Implements') + ' ' + node.implements.join(', ');
      }

      code += this.line(decl);
      this.indentLevel++;

      // Fields
      for (const field of node.fields) {
        code += this.emitClassField(field);
      }

      if (node.fields.length > 0 && (node.constructors.length > 0 || node.methods.length > 0)) {
        code += this.newline;
      }

      // Constructors
      for (const ctor of node.constructors) {
        code += this.emit(ctor);
        code += this.newline;
      }

      // Properties
      for (const prop of node.properties) {
        code += this.emit(prop);
        code += this.newline;
      }

      // Methods
      for (const method of node.methods) {
        code += this.emit(method);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line(this.kw('End Class'));

      return code;
    }

    emitClassField(node) {
      let code = node.visibility === 'Public' ? this.kw('Public') + ' ' : this.kw('Private') + ' ';
      code += node.name + ' ' + this.kw('As') + ' ' + node.type.toString();

      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }

      return this.line(code);
    }

    emitProperty(node) {
      let code = '';

      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Property') + ' ' + node.name + '() ' + this.kw('As') + ' ' + node.type.toString();

      code += this.line(decl);
      this.indentLevel++;

      if (node.getter) {
        code += this.line(this.kw('Get'));
        this.indentLevel++;
        code += this.emitBlockContents(node.getter);
        this.indentLevel--;
        code += this.line(this.kw('End Get'));
      }

      if (node.setter) {
        code += this.line(this.kw('Set') + '(' + this.kw('value') + ' ' + this.kw('As') + ' ' + node.type.toString() + ')');
        this.indentLevel++;
        code += this.emitBlockContents(node.setter);
        this.indentLevel--;
        code += this.line(this.kw('End Set'));
      }

      this.indentLevel--;
      code += this.line(this.kw('End Property'));

      return code;
    }

    emitConstructor(node) {
      let code = '';

      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Sub') + ' ' + this.kw('New') + '(';

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += params.join(', ');
      decl += ')';

      code += this.line(decl);

      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line(this.kw('End Sub'));

      return code;
    }

    // ========================[ FUNCTIONS ]========================

    emitFunction(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      let decl = '';
      if (node.visibility) decl += node.visibility + ' ';
      if (node.isShared) decl += this.kw('Shared') + ' ';

      decl += node.isSub ? this.kw('Sub') : this.kw('Function');
      decl += ' ' + node.name + '(';

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += params.join(', ');
      decl += ')';

      if (!node.isSub && node.returnType) {
        decl += ' ' + this.kw('As') + ' ' + node.returnType.toString();
      }

      code += this.line(decl);

      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line(node.isSub ? this.kw('End Sub') : this.kw('End Function'));

      return code;
    }

    emitParameterDecl(node) {
      let decl = '';

      if (node.isByRef) {
        decl += this.kw('ByRef') + ' ';
      } else if (this.variant === 'VBNET' || this.variant === 'VB6') {
        decl += this.kw('ByVal') + ' ';
      }

      if (node.isOptional) {
        decl += this.kw('Optional') + ' ';
      }

      if (node.isParamArray) {
        decl += this.kw('ParamArray') + ' ';
      }

      decl += node.name;

      if (node.type) {
        decl += ' ' + this.kw('As') + ' ' + node.type.toString();
      }

      if (node.defaultValue) {
        decl += ' = ' + this.emit(node.defaultValue);
      }

      return decl;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      return this.emitBlockContents(node);
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

    emitDim(node) {
      let code = '';

      if (node.isConst) {
        code += this.kw('Const') + ' ';
      } else if (node.isStatic) {
        code += this.kw('Static') + ' ';
      } else {
        code += this.kw('Dim') + ' ';
      }

      code += node.name;

      if (node.type) {
        code += ' ' + this.kw('As') + ' ' + node.type.toString();
      }

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code);
    }

    emitAssignment(node) {
      let code = this.emit(node.target);

      code += ' ' + node.operator + ' ';
      code += this.emit(node.value);

      return this.line(code);
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression));
    }

    emitReturn(node) {
      if (node.isExit) {
        return this.line(this.kw('Exit Function'));
      }

      if (node.expression) {
        // In Basic, use function name assignment for return value
        return this.line(this.emit(node.expression));
      }

      return this.line(this.kw('Exit Sub'));
    }

    emitIf(node) {
      let code = '';

      code += this.line(this.kw('If') + ' ' + this.emit(node.condition) + ' ' + this.kw('Then'));
      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;

      // ElseIf branches
      for (const elseIf of node.elseIfBranches) {
        code += this.line(this.kw('ElseIf') + ' ' + this.emit(elseIf.condition) + ' ' + this.kw('Then'));
        this.indentLevel++;
        code += this.emitBlockContents(elseIf.body);
        this.indentLevel--;
      }

      // Else branch
      if (node.elseBranch) {
        code += this.line(this.kw('Else'));
        this.indentLevel++;
        code += this.emitBlockContents(node.elseBranch);
        this.indentLevel--;
      }

      code += this.line(this.kw('End If'));

      return code;
    }

    emitFor(node) {
      let code = this.kw('For') + ' ' + node.variable + ' = ' + this.emit(node.start) + ' ' + this.kw('To') + ' ' + this.emit(node.end);

      if (node.step) {
        code += ' ' + this.kw('Step') + ' ' + this.emit(node.step);
      }

      code = this.line(code);
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line(this.kw('Next') + ' ' + node.variable);

      return code;
    }

    emitForEach(node) {
      let code = this.kw('For Each') + ' ' + node.variable + ' ' + this.kw('In') + ' ' + this.emit(node.collection);

      code = this.line(code);
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line(this.kw('Next'));

      return code;
    }

    emitWhile(node) {
      let code = '';

      if (node.isDoWhile) {
        code += this.line(this.kw('Do'));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop') + ' ' + (node.isUntil ? this.kw('Until') : this.kw('While')) + ' ' + this.emit(node.condition));
      } else {
        code += this.line(this.kw('While') + ' ' + this.emit(node.condition));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Wend'));
      }

      return code;
    }

    emitDoLoop(node) {
      let code = '';

      if (node.testAtTop && node.condition) {
        // Do While/Until...Loop
        code += this.line(this.kw('Do') + ' ' + (node.isWhile ? this.kw('While') : this.kw('Until')) + ' ' + this.emit(node.condition));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop'));
      } else if (node.condition) {
        // Do...Loop While/Until
        code += this.line(this.kw('Do'));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop') + ' ' + (node.isWhile ? this.kw('While') : this.kw('Until')) + ' ' + this.emit(node.condition));
      } else {
        // Infinite loop
        code += this.line(this.kw('Do'));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop'));
      }

      return code;
    }

    emitSelect(node) {
      let code = this.line(this.kw('Select Case') + ' ' + this.emit(node.expression));
      this.indentLevel++;

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      this.indentLevel--;
      code += this.line(this.kw('End Select'));

      return code;
    }

    emitCase(node) {
      let code = '';

      if (node.isElse) {
        code += this.line(this.kw('Case Else'));
      } else {
        const values = node.values.map(v => this.emit(v));
        code += this.line(this.kw('Case') + ' ' + values.join(', '));
      }

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      return code;
    }

    emitTry(node) {
      if (this.variant === 'VBNET' || this.variant === 'FREEBASIC' ||
          this.variant === 'VB6' || this.variant === 'GAMBAS' || this.variant === 'XOJO') {
        let code = this.line(this.kw('Try'));
        this.indentLevel++;
        code += this.emitBlockContents(node.tryBlock);
        this.indentLevel--;

        for (const catchClause of node.catchClauses) {
          code += this.emit(catchClause);
        }

        if (node.finallyBlock) {
          code += this.line(this.kw('Finally'));
          this.indentLevel++;
          code += this.emitBlockContents(node.finallyBlock);
          this.indentLevel--;
        }

        code += this.line(this.kw('End Try'));

        return code;
      } else {
        // Fall back to On Error for legacy dialects
        let code = this.line(this.kw('On Error Resume Next'));
        code += this.emitBlockContents(node.tryBlock);
        return code;
      }
    }

    emitCatch(node) {
      let code = this.kw('Catch');

      if (node.variableName) {
        code += ' ' + node.variableName;
      }

      if (node.exceptionType) {
        code += ' ' + this.kw('As') + ' ' + node.exceptionType;
      }

      code = this.line(code);
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      return code;
    }

    emitExit(node) {
      const exitMap = {
        'For': this.kw('Exit For'),
        'Do': this.kw('Exit Do'),
        'While': this.kw('Exit While'),
        'Sub': this.kw('Exit Sub'),
        'Function': this.kw('Exit Function')
      };

      return this.line(exitMap[node.exitType] || this.kw('Exit'));
    }

    emitContinue(node) {
      // Basic doesn't have continue in most dialects
      // Use comment as placeholder
      return this.line(`' Continue ${node.continueType}`);
    }

    emitThrow(node) {
      if (this.variant === 'VBNET' || this.variant === 'FREEBASIC') {
        return this.line(this.kw('Throw') + ' ' + this.emit(node.exception));
      } else {
        // Use Err.Raise for older dialects
        return this.line(this.kw('Err.Raise') + ' ' + this.emit(node.exception));
      }
    }

    emitOnError(node) {
      let code = this.kw('On Error');

      if (node.mode === 'Resume Next') {
        code += ' ' + this.kw('Resume Next');
      } else if (node.mode === 'GoTo 0') {
        code += ' ' + this.kw('GoTo') + ' 0';
      } else if (node.mode === 'GoTo' && node.label) {
        code += ' ' + this.kw('GoTo') + ' ' + node.label;
      }

      return this.line(code);
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'boolean') {
        return node.value ? this.kw('True') : this.kw('False');
      }

      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/"/g, '""'); // Double quotes for escaping
        return `"${escaped}"`;
      }

      if (node.literalType === 'nothing') {
        return this.kw('Nothing');
      }

      if (node.literalType === 'hex') {
        return `&H${node.value.toString(16).toUpperCase()}`;
      }

      // Numeric literal
      let result = String(node.value);

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
      return `${node.operator} ${operand}`;
    }

    emitMemberAccess(node) {
      return `${this.emit(node.target)}.${node.member}`;
    }

    emitIndexAccess(node) {
      const indices = node.indices.map(i => this.emit(i));
      return `${this.emit(node.target)}(${indices.join(', ')})`;
    }

    emitCall(node) {
      const callee = typeof node.callee === 'string' ? node.callee : this.emit(node.callee);
      const args = node.arguments.map(a => this.emit(a));

      let code = '';
      if (node.useCallKeyword) {
        code += this.kw('Call') + ' ';
      }

      code += `${callee}(${args.join(', ')})`;
      return code;
    }

    emitMethodCall(node) {
      const args = node.arguments.map(a => this.emit(a));
      return `${this.emit(node.target)}.${node.methodName}(${args.join(', ')})`;
    }

    emitNew(node) {
      const args = node.arguments.map(a => this.emit(a));
      return `${this.kw('New')} ${node.typeName}(${args.join(', ')})`;
    }

    emitArrayLiteral(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `{${elements.join(', ')}}`;
    }

    emitCast(node) {
      if (this.variant === 'VBNET') {
        if (node.castType === 'CType' || node.castType === 'DirectCast' || node.castType === 'TryCast') {
          return `${node.castType}(${this.emit(node.expression)}, ${node.targetType.toString()})`;
        }
      }

      // Use CInt, CLng, etc. for simple casts
      const castFuncs = {
        'Byte': 'CByte',
        'Integer': 'CInt',
        'Long': 'CLng',
        'Single': 'CSng',
        'Double': 'CDbl',
        'String': 'CStr',
        'Boolean': 'CBool'
      };

      const func = castFuncs[node.targetType.name] || 'CType';
      return `${func}(${this.emit(node.expression)})`;
    }

    emitConditional(node) {
      if (this.variant === 'VBNET') {
        // VB.NET has If() ternary operator
        return `${this.kw('If')}(${this.emit(node.condition)}, ${this.emit(node.trueExpression)}, ${this.emit(node.falseExpression)})`;
      } else {
        // Use IIf for other dialects
        return `IIf(${this.emit(node.condition)}, ${this.emit(node.trueExpression)}, ${this.emit(node.falseExpression)})`;
      }
    }

    emitLambda(node) {
      if (this.variant === 'VBNET') {
        const params = node.parameters.map(p => this.emitParameterDecl(p));

        let code = node.isSub ? this.kw('Sub') : this.kw('Function');
        code += '(' + params.join(', ') + ')';

        if (node.body.nodeType === 'Block') {
          code += this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.body);
          this.indentLevel--;
          code += this.indent() + (node.isSub ? this.kw('End Sub') : this.kw('End Function'));
        } else {
          code += ' ' + this.emit(node.body);
        }

        return code;
      } else {
        // Other dialects don't support lambdas - use placeholder
        return '/* Lambda not supported */';
      }
    }

    emitAddressOf(node) {
      return `${this.kw('AddressOf')} ${node.target}`;
    }

    emitTypeOf(node) {
      return `${this.kw('TypeOf')} ${this.emit(node.expression)} ${this.kw('Is')} ${node.typeName}`;
    }

    emitWith(node) {
      let code = this.line(this.kw('With') + ' ' + this.emit(node.expression));
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line(this.kw('End With'));

      return code;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ COMMENTS ]========================

    emitComment(node) {
      if (this.options.addComments === false) {
        return '';
      }

      const lines = node.text.split('\n');
      let code = '';

      if (node.isDoc && this.variant === 'VBNET') {
        // XML documentation comments
        for (const line of lines) {
          code += this.line(`''' ${line.trim()}`);
        }
      } else {
        // Regular comments
        for (const line of lines) {
          code += this.line(`' ${line.trim()}`);
        }
      }

      return code;
    }
  }

  // Export
  const exports = { BasicEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.BasicEmitter = BasicEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
