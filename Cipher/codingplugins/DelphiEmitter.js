/**
 * DelphiEmitter.js - Delphi Code Generator from Delphi AST
 * Generates properly formatted Delphi/Pascal source code from DelphiAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Delphi AST -> Delphi Emitter -> Delphi Source
 */

(function(global) {
  'use strict';

  // Load DelphiAST if available
  let DelphiAST;
  if (typeof require !== 'undefined') {
    DelphiAST = require('./DelphiAST.js');
  } else if (global.DelphiAST) {
    DelphiAST = global.DelphiAST;
  }

  /**
   * Delphi Code Emitter
   * Generates formatted Delphi code from a Delphi AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '  ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Emit documentation comments. Default: true
   */
  class DelphiEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '  ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /**
     * Emit Delphi code from a Delphi AST node
     * @param {DelphiNode} node - The AST node to emit
     * @returns {string} Generated Delphi code
     */
    emit(node) {
      if (!node) return '';

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `{ Unknown node type: ${node.nodeType} }`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    // ========================[ UNIT ]========================

    emitUnit(node) {
      let code = '';

      // Unit header
      code += `unit ${node.name};${this.newline}${this.newline}`;

      // Interface section
      code += 'interface' + this.newline + this.newline;

      if (node.interfaceSection) {
        code += this.emitInterfaceSection(node.interfaceSection);
      }

      // Implementation section
      code += this.newline + 'implementation' + this.newline + this.newline;

      if (node.implementationSection) {
        code += this.emitImplementationSection(node.implementationSection);
      }

      // Initialization (optional)
      if (node.initializationSection) {
        code += this.newline + 'initialization' + this.newline;
        code += this.emit(node.initializationSection);
      }

      // Finalization (optional)
      if (node.finalizationSection) {
        code += this.newline + 'finalization' + this.newline;
        code += this.emit(node.finalizationSection);
      }

      // End
      code += this.newline + 'end.' + this.newline;

      return code;
    }

    emitInterfaceSection(node) {
      let code = '';

      // Uses clause
      for (const use of node.uses) {
        code += this.emit(use);
      }
      if (node.uses.length > 0) {
        code += this.newline;
      }

      // Type declarations
      if (node.types.length > 0) {
        code += 'type' + this.newline;
        this.indentLevel++;
        for (const type of node.types) {
          code += this.emit(type);
          code += this.newline;
        }
        this.indentLevel--;
        code += this.newline;
      }

      // Constant declarations
      if (node.constants.length > 0) {
        code += 'const' + this.newline;
        this.indentLevel++;
        for (const constant of node.constants) {
          code += this.emit(constant);
        }
        this.indentLevel--;
        code += this.newline;
      }

      // Variable declarations
      if (node.variables.length > 0) {
        code += 'var' + this.newline;
        this.indentLevel++;
        for (const variable of node.variables) {
          code += this.emit(variable);
        }
        this.indentLevel--;
        code += this.newline;
      }

      // Forward declarations for functions and procedures
      for (const func of node.functions) {
        code += this.emitFunctionDeclaration(func);
      }

      for (const proc of node.procedures) {
        code += this.emitProcedureDeclaration(proc);
      }

      return code;
    }

    emitImplementationSection(node) {
      let code = '';

      // Uses clause
      for (const use of node.uses) {
        code += this.emit(use);
      }
      if (node.uses.length > 0) {
        code += this.newline;
      }

      // Function and procedure implementations
      for (const func of node.functions) {
        if (func.body) {
          code += this.emitFunctionImplementation(func);
          code += this.newline;
        }
      }

      for (const proc of node.procedures) {
        if (proc.body) {
          code += this.emitProcedureImplementation(proc);
          code += this.newline;
        }
      }

      return code;
    }

    emitUsesClause(node) {
      return `uses ${node.units.join(', ')};${this.newline}`;
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitClass(node) {
      let code = this.line(`${node.name} = class(${node.heritage || 'TObject'})`);

      // Private section
      const privateFields = node.fields.filter(f => f.visibility === 'private');
      if (privateFields.length > 0) {
        this.indentLevel++;
        code += this.line('private');
        this.indentLevel++;
        for (const field of privateFields) {
          code += this.emit(field);
        }
        this.indentLevel -= 2;
      }

      // Public section
      this.indentLevel++;
      code += this.line('public');
      this.indentLevel++;

      // Constructors
      for (const ctor of node.constructor_methods) {
        code += this.emitConstructorDeclaration(ctor);
      }

      // Destructors
      for (const dtor of node.destructor_methods) {
        code += this.emitDestructorDeclaration(dtor);
      }

      // Methods
      for (const method of node.methods) {
        code += this.emitMethodDeclaration(method);
      }

      // Properties
      for (const prop of node.properties) {
        code += this.emit(prop);
      }

      this.indentLevel -= 2;
      code += this.line('end;');

      // Method implementations
      for (const ctor of node.constructor_methods) {
        if (ctor.body) {
          code += this.newline;
          code += this.emitConstructorImplementation(ctor, node.name);
        }
      }

      for (const dtor of node.destructor_methods) {
        if (dtor.body) {
          code += this.newline;
          code += this.emitDestructorImplementation(dtor, node.name);
        }
      }

      for (const method of node.methods) {
        if (method.body) {
          code += this.newline;
          code += this.emitMethodImplementation(method, node.name);
        }
      }

      return code;
    }

    emitRecord(node) {
      let code = this.line(`${node.name} = record`);

      this.indentLevel++;
      for (const field of node.fields) {
        code += this.emit(field);
      }
      this.indentLevel--;

      code += this.line('end;');

      return code;
    }

    emitField(node) {
      return this.line(`${node.name}: ${this.emit(node.type)};`);
    }

    emitProperty(node) {
      let code = `${node.name}: ${this.emit(node.type)}`;

      if (node.getter) {
        code += ` read ${node.getter}`;
      }

      if (node.setter) {
        code += ` write ${node.setter}`;
      }

      return this.line(code + ';');
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ ROUTINES ]========================

    emitFunctionDeclaration(func) {
      let code = this.indent() + 'function ' + func.name;

      // Parameters
      if (func.parameters.length > 0) {
        code += '(';
        const params = func.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      // Return type
      code += ': ' + this.emit(func.returnType);

      // Directives
      if (func.directives.length > 0) {
        code += '; ' + func.directives.join('; ');
      }

      code += ';' + this.newline;

      return code;
    }

    emitFunctionImplementation(func) {
      let code = 'function ' + func.name;

      // Parameters
      if (func.parameters.length > 0) {
        code += '(';
        const params = func.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      // Return type
      code += ': ' + this.emit(func.returnType) + ';' + this.newline;

      // Local variables
      const localVars = this.extractLocalVariables(func.body);
      if (localVars.length > 0) {
        code += 'var' + this.newline;
        this.indentLevel++;
        for (const varDecl of localVars) {
          code += this.emit(varDecl);
        }
        this.indentLevel--;
      }

      // Body
      code += 'begin' + this.newline;
      if (func.body) {
        this.indentLevel++;
        code += this.emitBlockContents(func.body);
        this.indentLevel--;
      }
      code += 'end;' + this.newline;

      return code;
    }

    emitProcedureDeclaration(proc) {
      let code = this.indent() + 'procedure ' + proc.name;

      // Parameters
      if (proc.parameters.length > 0) {
        code += '(';
        const params = proc.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      // Directives
      if (proc.directives.length > 0) {
        code += '; ' + proc.directives.join('; ');
      }

      code += ';' + this.newline;

      return code;
    }

    emitProcedureImplementation(proc) {
      let code = 'procedure ' + proc.name;

      // Parameters
      if (proc.parameters.length > 0) {
        code += '(';
        const params = proc.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      code += ';' + this.newline;

      // Local variables
      const localVars = this.extractLocalVariables(proc.body);
      if (localVars.length > 0) {
        code += 'var' + this.newline;
        this.indentLevel++;
        for (const varDecl of localVars) {
          code += this.emit(varDecl);
        }
        this.indentLevel--;
      }

      // Body
      code += 'begin' + this.newline;
      if (proc.body) {
        this.indentLevel++;
        code += this.emitBlockContents(proc.body);
        this.indentLevel--;
      }
      code += 'end;' + this.newline;

      return code;
    }

    emitMethodDeclaration(method) {
      const prefix = method.isFunction ? 'function' : 'procedure';
      let code = this.indent() + prefix + ' ' + method.name;

      // Parameters
      if (method.parameters.length > 0) {
        code += '(';
        const params = method.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      // Return type
      if (method.isFunction && method.returnType) {
        code += ': ' + this.emit(method.returnType);
      }

      // Directives
      if (method.directives.length > 0) {
        code += '; ' + method.directives.join('; ');
      }

      code += ';' + this.newline;

      return code;
    }

    emitMethodImplementation(method, className) {
      const prefix = method.isFunction ? 'function' : 'procedure';
      let code = prefix + ' ' + className + '.' + method.name;

      // Parameters
      if (method.parameters.length > 0) {
        code += '(';
        const params = method.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      // Return type
      if (method.isFunction && method.returnType) {
        code += ': ' + this.emit(method.returnType);
      }

      code += ';' + this.newline;

      // Local variables
      const localVars = this.extractLocalVariables(method.body);
      if (localVars.length > 0) {
        code += 'var' + this.newline;
        this.indentLevel++;
        for (const varDecl of localVars) {
          code += this.emit(varDecl);
        }
        this.indentLevel--;
      }

      // Body
      code += 'begin' + this.newline;
      if (method.body) {
        this.indentLevel++;
        code += this.emitBlockContents(method.body);
        this.indentLevel--;
      }
      code += 'end;' + this.newline;

      return code;
    }

    emitConstructorDeclaration(ctor) {
      let code = this.indent() + 'constructor ' + ctor.name;

      // Parameters
      if (ctor.parameters.length > 0) {
        code += '(';
        const params = ctor.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      code += ';' + this.newline;

      return code;
    }

    emitConstructorImplementation(ctor, className) {
      let code = 'constructor ' + className + '.' + ctor.name;

      // Parameters
      if (ctor.parameters.length > 0) {
        code += '(';
        const params = ctor.parameters.map(p => this.emitParameterDecl(p));
        code += params.join('; ');
        code += ')';
      }

      code += ';' + this.newline;

      // Local variables
      const localVars = this.extractLocalVariables(ctor.body);
      if (localVars.length > 0) {
        code += 'var' + this.newline;
        this.indentLevel++;
        for (const varDecl of localVars) {
          code += this.emit(varDecl);
        }
        this.indentLevel--;
      }

      // Body
      code += 'begin' + this.newline;
      if (ctor.body) {
        this.indentLevel++;
        code += this.emitBlockContents(ctor.body);
        this.indentLevel--;
      }
      code += 'end;' + this.newline;

      return code;
    }

    emitDestructorDeclaration(dtor) {
      let code = this.indent() + 'destructor ' + dtor.name + ';';
      if (dtor.isOverride) {
        code = this.indent() + 'destructor ' + dtor.name + '; override;';
      }
      code += this.newline;

      return code;
    }

    emitDestructorImplementation(dtor, className) {
      let code = 'destructor ' + className + '.' + dtor.name + ';' + this.newline;

      // Body
      code += 'begin' + this.newline;
      if (dtor.body) {
        this.indentLevel++;
        code += this.emitBlockContents(dtor.body);
        this.indentLevel--;
      }
      code += 'end;' + this.newline;

      return code;
    }

    emitParameterDecl(param) {
      let code = '';

      if (param.isVar) code += 'var ';
      if (param.isConst) code += 'const ';
      if (param.isOut) code += 'out ';

      code += param.name + ': ' + this.emit(param.type);

      if (param.defaultValue) {
        code += ' = ' + this.emit(param.defaultValue);
      }

      return code;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = this.line('begin');
      this.indentLevel++;
      code += this.emitBlockContents(node);
      this.indentLevel--;
      code += this.line('end;');
      return code;
    }

    emitBlockContents(node) {
      let code = '';

      if (!node || !node.statements) {
        return code;
      }

      for (const stmt of node.statements) {
        // Skip variable declarations - they go in var section
        if (stmt.nodeType === 'VarDeclaration') {
          continue;
        }

        code += this.emit(stmt);
      }

      return code;
    }

    extractLocalVariables(block) {
      const vars = [];

      if (!block || !block.statements) {
        return vars;
      }

      for (const stmt of block.statements) {
        if (stmt.nodeType === 'VarDeclaration') {
          vars.push(stmt);
        }
      }

      return vars;
    }

    emitVarDeclaration(node) {
      let code = `${node.name}: ${this.emit(node.type)}`;

      if (node.initializer) {
        code += ` = ${this.emit(node.initializer)}`;
      }

      return this.line(code + ';');
    }

    emitConstDeclaration(node) {
      let code = node.name;

      if (node.type) {
        code += ': ' + this.emit(node.type);
      }

      code += ' = ' + this.emit(node.value);

      return this.line(code + ';');
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression) + ';');
    }

    emitAssignment(node) {
      return this.line(`${this.emit(node.target)} := ${this.emit(node.value)};`);
    }

    emitIf(node) {
      let code = this.line('if ' + this.emit(node.condition) + ' then');

      this.indentLevel++;
      if (node.thenBranch.nodeType === 'Block') {
        code += this.emitBlock(node.thenBranch);
      } else {
        code += this.emit(node.thenBranch);
      }
      this.indentLevel--;

      if (node.elseBranch) {
        code += this.line('else');
        this.indentLevel++;
        if (node.elseBranch.nodeType === 'Block') {
          code += this.emitBlock(node.elseBranch);
        } else {
          code += this.emit(node.elseBranch);
        }
        this.indentLevel--;
      }

      return code;
    }

    emitFor(node) {
      const direction = node.isDownto ? 'downto' : 'to';
      let code = this.line(`for ${node.variable} := ${this.emit(node.startValue)} ${direction} ${this.emit(node.endValue)} do`);

      this.indentLevel++;
      if (node.body && node.body.nodeType === 'Block') {
        code += this.emitBlock(node.body);
      } else {
        code += this.emit(node.body);
      }
      this.indentLevel--;

      return code;
    }

    emitForIn(node) {
      let code = this.line(`for ${node.variable} in ${this.emit(node.collection)} do`);

      this.indentLevel++;
      if (node.body && node.body.nodeType === 'Block') {
        code += this.emitBlock(node.body);
      } else {
        code += this.emit(node.body);
      }
      this.indentLevel--;

      return code;
    }

    emitWhile(node) {
      let code = this.line('while ' + this.emit(node.condition) + ' do');

      this.indentLevel++;
      if (node.body && node.body.nodeType === 'Block') {
        code += this.emitBlock(node.body);
      } else {
        code += this.emit(node.body);
      }
      this.indentLevel--;

      return code;
    }

    emitRepeat(node) {
      let code = this.line('repeat');

      this.indentLevel++;
      if (node.body) {
        code += this.emitBlockContents(node.body);
      }
      this.indentLevel--;

      code += this.line('until ' + this.emit(node.condition) + ';');

      return code;
    }

    emitCase(node) {
      let code = this.line('case ' + this.emit(node.expression) + ' of');

      this.indentLevel++;
      for (const branch of node.branches) {
        code += this.emit(branch);
      }

      if (node.elseBranch) {
        code += this.line('else');
        this.indentLevel++;
        if (node.elseBranch.nodeType === 'Block') {
          code += this.emitBlockContents(node.elseBranch);
        } else {
          code += this.emit(node.elseBranch);
        }
        this.indentLevel--;
      }

      this.indentLevel--;
      code += this.line('end;');

      return code;
    }

    emitCaseBranch(node) {
      const values = node.values.map(v => this.emit(v)).join(', ');
      let code = this.line(values + ':');

      this.indentLevel++;
      if (node.statement && node.statement.nodeType === 'Block') {
        code += this.emitBlockContents(node.statement);
      } else {
        code += this.emit(node.statement);
      }
      this.indentLevel--;

      return code;
    }

    emitTry(node) {
      let code = this.line('try');

      this.indentLevel++;
      if (node.tryBlock) {
        code += this.emitBlockContents(node.tryBlock);
      }
      this.indentLevel--;

      if (node.exceptBlock) {
        code += this.line('except');
        this.indentLevel++;
        code += this.emit(node.exceptBlock);
        this.indentLevel--;
      }

      if (node.finallyBlock) {
        code += this.line('finally');
        this.indentLevel++;
        code += this.emitBlockContents(node.finallyBlock);
        this.indentLevel--;
      }

      code += this.line('end;');

      return code;
    }

    emitExceptBlock(node) {
      let code = '';

      for (const handler of node.handlers) {
        code += this.emit(handler);
      }

      if (node.elseBlock) {
        code += this.line('else');
        this.indentLevel++;
        code += this.emitBlockContents(node.elseBlock);
        this.indentLevel--;
      }

      return code;
    }

    emitExceptionHandler(node) {
      let code = 'on ';

      if (node.variableName) {
        code += node.variableName + ': ';
      }

      code += node.exceptionType + ' do';
      code = this.line(code);

      this.indentLevel++;
      if (node.body && node.body.nodeType === 'Block') {
        code += this.emitBlockContents(node.body);
      } else {
        code += this.emit(node.body);
      }
      this.indentLevel--;

      return code;
    }

    emitRaise(node) {
      if (node.exception) {
        return this.line('raise ' + this.emit(node.exception) + ';');
      }
      return this.line('raise;');
    }

    emitExit(node) {
      if (node.returnValue) {
        return this.line('Exit(' + this.emit(node.returnValue) + ');');
      }
      return this.line('Exit;');
    }

    emitBreak(node) {
      return this.line('Break;');
    }

    emitContinue(node) {
      return this.line('Continue;');
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'boolean') {
        return node.value ? 'True' : 'False';
      }

      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/'/g, "''");
        return `'${escaped}'`;
      }

      if (node.literalType === 'char') {
        return `'${node.value}'`;
      }

      if (node.literalType === 'hex') {
        return `$${node.value.toString(16).toUpperCase()}`;
      }

      if (node.literalType === 'nil') {
        return 'nil';
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
      return `${node.operator} ${operand}`;
    }

    emitFieldAccess(node) {
      return `${this.emit(node.target)}.${node.field}`;
    }

    emitArrayAccess(node) {
      const indices = Array.isArray(node.index) ?
        node.index.map(i => this.emit(i)).join(', ') :
        this.emit(node.index);

      return `${this.emit(node.target)}[${indices}]`;
    }

    emitCall(node) {
      const callee = this.emit(node.callee);
      const args = node.arguments.map(a => this.emit(a));
      return `${callee}(${args.join(', ')})`;
    }

    emitTypeCast(node) {
      return `${this.emit(node.type)}(${this.emit(node.expression)})`;
    }

    emitTypeCheck(node) {
      return `${this.emit(node.expression)} is ${node.type}`;
    }

    emitTypeCastAs(node) {
      return `${this.emit(node.expression)} as ${node.type}`;
    }

    emitArrayLiteral(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `[${elements.join(', ')}]`;
    }

    emitSetLiteral(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `[${elements.join(', ')}]`;
    }

    emitRange(node) {
      return `${this.emit(node.start)}..${this.emit(node.end)}`;
    }

    emitWith(node) {
      const exprs = node.expressions.map(e => this.emit(e)).join(', ');
      let code = this.line(`with ${exprs} do`);

      this.indentLevel++;
      if (node.body && node.body.nodeType === 'Block') {
        code += this.emitBlock(node.body);
      } else {
        code += this.emit(node.body);
      }
      this.indentLevel--;

      return code;
    }

    // ========================[ COMMENTS ]========================

    emitComment(node) {
      if (this.options.addComments === false) {
        return '';
      }

      if (node.isDocumentation) {
        // XML documentation comment
        return this.line(`/// ${node.text}`);
      }

      // Regular comment
      return this.line(`{ ${node.text} }`);
    }
  }

  // Export
  const exports = { DelphiEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.DelphiEmitter = DelphiEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
