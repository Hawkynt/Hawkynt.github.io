/**
 * RubyTransformer.js - JavaScript AST to Ruby AST Transformer
 * Converts type-annotated JavaScript AST to Ruby AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Ruby AST -> Ruby Emitter -> Ruby Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let RubyAST;
  if (typeof require !== 'undefined') {
    RubyAST = require('./RubyAST.js');
  } else if (global.RubyAST) {
    RubyAST = global.RubyAST;
  }

  const {
    RubyType, RubyModule, RubyRequire, RubyMagicComment,
    RubyClass, RubyModuleDef, RubyAttribute,
    RubyMethod, RubyParameter, RubyBlock, RubyAssignment, RubyExpressionStatement,
    RubyReturn, RubyIf, RubyCase, RubyWhen, RubyFor, RubyWhile, RubyLoop,
    RubyBreak, RubyNext, RubyRaise, RubyBegin, RubyRescue,
    RubyLiteral, RubyIdentifier, RubyBinaryExpression, RubyUnaryExpression,
    RubyMethodCall, RubyArrayLiteral, RubyHashLiteral, RubyRange,
    RubyStringInterpolation, RubyBlockExpression, RubyLambda, RubyIndex,
    RubyConditional, RubySplat, RubyConstantAccess, RubyYield, RubySuper,
    RubyDocComment, RubyConstant
  } = RubyAST;

  /**
   * Maps JavaScript/JSDoc types to Ruby types
   */
  const TYPE_MAP = {
    // Integer types
    'uint8': 'Integer', 'byte': 'Integer',
    'uint16': 'Integer', 'ushort': 'Integer', 'word': 'Integer',
    'uint32': 'Integer', 'uint': 'Integer', 'dword': 'Integer',
    'uint64': 'Integer', 'ulong': 'Integer', 'qword': 'Integer',
    'int8': 'Integer', 'sbyte': 'Integer',
    'int16': 'Integer', 'short': 'Integer',
    'int32': 'Integer', 'int': 'Integer',
    'int64': 'Integer', 'long': 'Integer',
    // Floating point
    'float': 'Float', 'float32': 'Float',
    'double': 'Float', 'float64': 'Float',
    'number': 'Integer', // In crypto context, typically integer operations
    // Other
    'boolean': 'TrueClass', 'bool': 'TrueClass',
    'string': 'String', 'String': 'String',
    'void': 'NilClass',
    'object': 'Hash',
    'Array': 'Array'
  };

  /**
   * JavaScript AST to Ruby AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '  ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Add documentation comments. Default: true
   * - useFrozenStringLiteral: boolean - Add frozen_string_literal magic comment. Default: true
   * - useSymbolKeys: boolean - Use symbols for hash keys. Default: true
   * - useModernSyntax: boolean - Use Ruby 3+ syntax features. Default: true
   */
  class RubyTransformer {
    constructor(options = {}) {
      this.options = options;
      this.currentClass = null;
      this.variableTypes = new Map();
      this.scopeStack = [];
      this.requires = new Set();
    }

    /**
     * Convert name to snake_case (Ruby convention for methods/variables)
     */
    toSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }

    /**
     * Convert name to CamelCase (Ruby convention for classes/modules)
     */
    toCamelCase(str) {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (Ruby convention for constants)
     */
    toScreamingSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      return str
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .replace(/^_/, '');
    }

    /**
     * Map JavaScript type string to Ruby type
     */
    mapType(typeName) {
      if (!typeName) return RubyType.Integer();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return RubyType.Array(elementType);
      }

      const rubyTypeName = TYPE_MAP[typeName] || typeName;

      const typeMap = {
        'Integer': RubyType.Integer(),
        'Float': RubyType.Float(),
        'String': RubyType.String(),
        'Symbol': RubyType.Symbol(),
        'TrueClass': RubyType.TrueClass(),
        'FalseClass': RubyType.FalseClass(),
        'NilClass': RubyType.NilClass()
      };

      return typeMap[rubyTypeName] || new RubyType(rubyTypeName);
    }

    /**
     * Register a variable's type
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get a registered variable's type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Push a new scope
     */
    pushScope() {
      this.scopeStack.push(new Map(this.variableTypes));
    }

    /**
     * Pop scope
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.variableTypes = this.scopeStack.pop();
      }
    }

    /**
     * Infer Ruby type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return RubyType.Integer();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return RubyType.Integer();
      }

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        return RubyType.Array(RubyType.Integer());
      }

      // Index/length names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return RubyType.Integer();
      }

      return RubyType.Integer();
    }

    /**
     * Transform a JavaScript AST to a Ruby AST
     */
    transform(jsAst) {
      const module = new RubyModule();

      // Add frozen_string_literal magic comment
      if (this.options.useFrozenStringLiteral !== false) {
        module.magicComments.push(
          new RubyMagicComment('frozen_string_literal', 'true')
        );
      }

      // Add module doc comment
      if (this.options.addComments !== false) {
        const docComment = new RubyDocComment(
          'Generated Ruby code from JavaScript AST\nThis file was automatically generated',
          true
        );
        module.docComment = docComment;
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      return module;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetModule) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetModule);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetModule);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetModule);
          break;

        case 'ExpressionStatement':
          // Handle IIFE wrappers
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              this.transformIIFEContent(callee, node.expression, targetModule);
            }
          }
          break;

        default:
          break;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     */
    transformIIFEContent(calleeNode, callExpr, targetModule) {
      let bodyStatements = [];

      // UMD pattern: second argument is factory function
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          bodyStatements = factoryArg.body?.body || [];
        }
      }

      // Simple IIFE pattern
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        if (stmt.type === 'ExpressionStatement') continue;
        if (stmt.type === 'ClassDeclaration') {
          this.transformClassDeclaration(stmt, targetModule);
          continue;
        }
        if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetModule);
          continue;
        }
        if (stmt.type === 'VariableDeclaration') {
          this.transformVariableDeclaration(stmt, targetModule);
          continue;
        }
        if (stmt.type === 'IfStatement') continue;
      }
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetModule) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        if (decl.id.type === 'ObjectPattern') continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // Ruby supports multiple assignment: a, b, c = arr
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new RubyArrayAccess(sourceExpr, RubyLiteral.Int(i));
              const constDecl = new RubyConstant(this.toScreamingSnakeCase(elem.name), indexExpr);
              targetModule.items.push(constDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check for class-like objects
        if (decl.init.type === 'ObjectExpression') {
          const rubyClass = this.transformObjectToClass(name, decl.init);
          if (rubyClass) {
            targetModule.items.push(rubyClass);
          }
        }
        // Simple constants
        else if (decl.init.type === 'Literal' ||
                 decl.init.type === 'ArrayExpression' ||
                 decl.init.type === 'UnaryExpression' ||
                 decl.init.type === 'BinaryExpression') {
          const constDecl = new RubyConstant(
            this.toScreamingSnakeCase(name),
            this.transformExpression(decl.init)
          );
          targetModule.items.push(constDecl);
        }
      }
    }

    /**
     * Transform an object literal to a Ruby class
     */
    transformObjectToClass(name, objNode) {
      const rubyClass = new RubyClass(this.toCamelCase(name));

      const prevClass = this.currentClass;
      this.currentClass = rubyClass;

      for (const prop of objNode.properties) {
        const propName = prop.key.name || prop.key.value;
        const propValue = prop.value;

        if (prop.method || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          // Method
          const method = this.transformFunctionToMethod(propName, propValue);
          rubyClass.methods.push(method);
        } else {
          // Class variable
          const identifier = new RubyIdentifier(this.toSnakeCase(propName));
          identifier.isClass = true;
          const assignment = new RubyAssignment(
            identifier,
            this.transformExpression(propValue)
          );
          rubyClass.classVariables.push(assignment);
        }
      }

      this.currentClass = prevClass;
      return rubyClass;
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetModule) {
      const funcName = this.toSnakeCase(node.id.name);
      const func = new RubyMethod(funcName);

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          func.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetModule.items.push(func);
    }

    /**
     * Transform a function to a method
     */
    transformFunctionToMethod(name, funcNode) {
      const methodName = this.toSnakeCase(name);
      const method = new RubyMethod(methodName);

      // Parameters
      if (funcNode.params) {
        for (const param of funcNode.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          method.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (funcNode.body) {
        method.body = this.transformBlockStatement(funcNode.body);
      }

      return method;
    }

    /**
     * Transform a class declaration to a Ruby class
     */
    transformClassDeclaration(node, targetModule) {
      const className = this.toCamelCase(node.id.name);
      const rubyClass = new RubyClass(className);

      const prevClass = this.currentClass;
      this.currentClass = rubyClass;

      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        const instanceVars = [];

        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Extract instance variables from constructor
              const { fields, initStatements } = this.extractFieldsFromConstructor(member);
              instanceVars.push(...fields);

              // Create initialize method
              const initMethod = this.transformConstructor(member, initStatements, fields);
              rubyClass.methods.push(initMethod);
            } else {
              // Regular method
              const method = this.transformMethodDefinition(member);
              rubyClass.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Field
            const fieldName = this.toSnakeCase(member.key.name);
            instanceVars.push(fieldName);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> Ruby module-level statements
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              rubyClass.staticInitStatements = rubyClass.staticInitStatements || [];
              rubyClass.staticInitStatements.push(...initStatements);
            }
          }
        }

        // Add attr_accessor for instance variables
        if (instanceVars.length > 0) {
          const symbols = instanceVars.map(name => `:${name}`);
          rubyClass.attributes.push(new RubyAttribute('accessor', symbols));
        }
      }

      this.currentClass = prevClass;

      targetModule.items.push(rubyClass);
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];
      const initStatements = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return { fields, initStatements };

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = expr.left.property.name || expr.left.property.value;

          let fieldName = this.toSnakeCase(propName);
          if (fieldName.startsWith('_')) fieldName = fieldName.substring(1);

          fields.push(fieldName);
          initStatements.push(stmt);
        }
      }

      return { fields, initStatements };
    }

    /**
     * Transform a constructor to an initialize method
     */
    transformConstructor(node, fieldInitStatements = [], fields = []) {
      const initMethod = new RubyMethod('initialize');

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          initMethod.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      const body = new RubyBlock();

      if (node.value && node.value.body && node.value.body.type === 'BlockStatement') {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            // Transform to @variable assignment
            const expr = stmt.expression;
            const propName = expr.left.property.name || expr.left.property.value;
            let fieldName = this.toSnakeCase(propName);
            if (fieldName.startsWith('_')) fieldName = fieldName.substring(1);

            const identifier = new RubyIdentifier(fieldName);
            identifier.isInstance = true;

            const assignment = new RubyAssignment(
              identifier,
              this.transformExpression(expr.right)
            );
            body.statements.push(assignment);
          } else {
            const rubyStmt = this.transformStatement(stmt);
            if (rubyStmt) {
              if (Array.isArray(rubyStmt))
                body.statements.push(...rubyStmt);
              else
                body.statements.push(rubyStmt);
            }
          }
        }
      }

      initMethod.body = body;
      return initMethod;
    }

    /**
     * Transform a method definition
     */
    transformStaticBlock(node) {
      // ES2022 static block -> Ruby module-level statements
      // Ruby doesn't have static class blocks, so transform to statements
      return node.body.map(stmt => this.transformStatement(stmt));
    }

    transformMethodDefinition(node) {
      const methodName = this.toSnakeCase(node.key.name);
      const method = new RubyMethod(methodName);

      method.isClassMethod = node.static;

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          method.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      return method;
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new RubyBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const rubyStmt = this.transformStatement(stmt);
          if (rubyStmt) {
            if (Array.isArray(rubyStmt)) {
              block.statements.push(...rubyStmt);
            } else {
              block.statements.push(rubyStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement (handles all 16+ critical statement types)
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'VariableDeclaration':
          return this.transformLetStatement(node);

        case 'ExpressionStatement':
          return this.transformExpressionStatementNode(node);

        case 'ReturnStatement':
          return this.transformReturnStatement(node);

        case 'IfStatement':
          return this.transformIfStatement(node);

        case 'ForStatement':
          return this.transformForStatement(node);

        case 'ForOfStatement':
          return this.transformForOfStatement(node);

        case 'ForInStatement':
          return this.transformForInStatement(node);

        case 'WhileStatement':
          return this.transformWhileStatement(node);

        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        case 'SwitchStatement':
          return this.transformSwitchStatement(node);

        case 'TryStatement':
          return this.transformTryStatement(node);

        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        case 'BlockStatement':
          return this.transformBlockStatement(node);

        case 'BreakStatement':
          return new RubyBreak();

        case 'ContinueStatement':
          return new RubyNext();

        default:
          return null;
      }
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      // Ruby: loop do ... break unless condition end
      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const condition = this.transformExpression(node.test);
      const breakUnless = new RubyIf(condition, new RubyBlock([new RubyBreak()]), null);
      breakUnless.isUnless = true;
      bodyBlock.statements.push(breakUnless);

      return new RubyLoop(bodyBlock);
    }

    /**
     * Transform a switch statement to case/when
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const caseStmt = new RubyCase(discriminant);

      for (const caseNode of node.cases) {
        if (caseNode.test) {
          const pattern = this.transformExpression(caseNode.test);
          const whenBody = new RubyBlock();

          for (const stmt of caseNode.consequent) {
            const rubyStmt = this.transformStatement(stmt);
            if (rubyStmt) {
              if (Array.isArray(rubyStmt)) {
                whenBody.statements.push(...rubyStmt);
              } else {
                whenBody.statements.push(rubyStmt);
              }
            }
          }

          const whenClause = new RubyWhen([pattern], whenBody);
          caseStmt.whenBranches.push(whenClause);
        } else {
          // Default case (else)
          const elseBody = new RubyBlock();
          for (const stmt of caseNode.consequent) {
            const rubyStmt = this.transformStatement(stmt);
            if (rubyStmt) {
              if (Array.isArray(rubyStmt)) {
                elseBody.statements.push(...rubyStmt);
              } else {
                elseBody.statements.push(rubyStmt);
              }
            }
          }
          caseStmt.elseBranch = elseBody;
        }
      }

      return caseStmt;
    }

    /**
     * Transform a try-catch statement to begin/rescue
     */
    transformTryStatement(node) {
      const beginBlock = new RubyBegin();
      beginBlock.tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        const exceptionType = node.handler.param ? null : ['StandardError'];
        const varName = node.handler.param ? this.toSnakeCase(node.handler.param.name) : 'e';
        const rescueBody = this.transformStatement(node.handler.body);

        const rescueClause = new RubyRescue(exceptionType, varName, rescueBody);
        beginBlock.rescueClauses.push(rescueClause);
      }

      if (node.finalizer) {
        beginBlock.ensureBlock = this.transformStatement(node.finalizer);
      }

      return beginBlock;
    }

    /**
     * Transform a throw statement to raise
     */
    transformThrowStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) : RubyLiteral.String('error');
      return new RubyRaise(RubyLiteral.String('StandardError'), expr);
    }

    /**
     * Transform a let statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = this.toSnakeCase(decl.id.name);
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
        }

        const assignment = new RubyAssignment(
          new RubyIdentifier(varName),
          initializer || RubyLiteral.Nil()
        );

        statements.push(assignment);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new RubyExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new RubyReturn(expr);
      }

      return new RubyReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new RubyBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new RubyIf(condition, thenBlock, [], elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // Convert to while loop
      const whileLoop = new RubyWhile(
        node.test ? this.transformExpression(node.test) : RubyLiteral.True(),
        this.transformStatement(node.body) || new RubyBlock()
      );

      const statements = [];
      if (node.init) {
        const initStmt = this.transformStatement(node.init);
        if (initStmt) {
          if (Array.isArray(initStmt)) {
            statements.push(...initStmt);
          } else {
            statements.push(initStmt);
          }
        }
      }

      statements.push(whileLoop);

      if (node.update && whileLoop.body.nodeType === 'Block') {
        const updateStmt = new RubyExpressionStatement(this.transformExpression(node.update));
        whileLoop.body.statements.push(updateStmt);
      }

      return statements.length === 1 ? statements[0] : statements;
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RubyWhile(condition, bodyBlock);
    }

    /**
     * Transform a for-of statement
     */
    transformForOfStatement(node) {
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      const iterable = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      // Use .each block instead of for loop
      const eachCall = new RubyMethodCall(
        iterable,
        'each',
        [],
        new RubyBlockExpression(
          [new RubyParameter(varName)],
          bodyBlock
        )
      );

      return new RubyExpressionStatement(eachCall);
    }

    /**
     * Transform a for-in statement
     */
    transformForInStatement(node) {
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      const object = this.transformExpression(node.right);
      const keysCall = new RubyMethodCall(object, 'keys', []);

      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const eachCall = new RubyMethodCall(
        keysCall,
        'each',
        [],
        new RubyBlockExpression(
          [new RubyParameter(varName)],
          bodyBlock
        )
      );

      return new RubyExpressionStatement(eachCall);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new RubyBlock();
      if (stmt) {
        if (Array.isArray(stmt)) {
          block.statements.push(...stmt);
        } else {
          block.statements.push(stmt);
        }
      }
      return block;
    }

    /**
     * Transform an expression (handles all 19+ critical expression types)
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);

        case 'Identifier':
          return this.transformIdentifier(node);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);

        case 'UnaryExpression':
          return this.transformUnaryExpression(node);

        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        case 'MemberExpression':
          return this.transformMemberExpression(node);

        case 'CallExpression':
          return this.transformCallExpression(node);

        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        case 'NewExpression':
          return this.transformNewExpression(node);

        case 'ThisExpression':
          return new RubyIdentifier('self');

        case 'Super':
          return new RubyIdentifier('super');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        case 'SpreadElement':
          return this.transformSpreadElement(node);

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - Ruby doesn't support this directly
          // Return a comment placeholder
          return new RubyIdentifier('# Object destructuring not supported in Ruby');

        default:
          return null;
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords
      if (name === 'undefined') return RubyLiteral.Nil();
      if (name === 'null') return RubyLiteral.Nil();

      return new RubyIdentifier(this.toSnakeCase(name));
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return RubyLiteral.Integer(node.value);
        }
        return RubyLiteral.Float(node.value);
      }

      if (typeof node.value === 'string') {
        return RubyLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return node.value ? RubyLiteral.True() : RubyLiteral.False();
      }

      if (node.value === null) {
        return RubyLiteral.Nil();
      }

      return RubyLiteral.Nil();
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      let operator = node.operator;
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';
      if (operator === '>>>') operator = '>>';

      return new RubyBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new RubyUnaryExpression(node.operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      const assignment = new RubyAssignment(left, right);
      assignment.operator = node.operator;
      return assignment;
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      const op = node.operator === '++' ? '+=' : '-=';
      const assignment = new RubyAssignment(operand, RubyLiteral.Integer(1));
      assignment.operator = op;
      return assignment;
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        const index = this.transformExpression(node.property);
        return new RubyIndex(object, index);
      } else {
        const methodName = node.property.name || node.property.value;

        // Handle special properties
        if (methodName === 'length') {
          return new RubyMethodCall(object, 'length', []);
        }

        // Instance variable access for this.x
        if (node.object.type === 'ThisExpression') {
          let fieldName = this.toSnakeCase(methodName);
          if (fieldName.startsWith('_')) fieldName = fieldName.substring(1);
          const identifier = new RubyIdentifier(fieldName);
          identifier.isInstance = true;
          return identifier;
        }

        // Method call with no arguments
        return new RubyMethodCall(object, this.toSnakeCase(methodName), []);
      }
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle OpCodes calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const methodName = this.toSnakeCase(method);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        return new RubyMethodCall(object, methodName, args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // In Ruby, function calls are method calls
      return new RubyMethodCall(null, callee.name || 'call', args);
    }

    /**
     * Transform OpCodes calls to Ruby equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Ruby
      switch (methodName) {
        case 'RotL32':
        case 'RotR32':
        case 'RotL8':
        case 'RotR8':
          // Ruby bitwise rotation
          const direction = methodName.includes('RotL') ? '<<' : '>>';
          const bits = methodName.includes('8') ? 8 : 32;
          const oppDirection = methodName.includes('RotL') ? '>>' : '<<';
          return new RubyBinaryExpression(
            new RubyBinaryExpression(args[0], direction, args[1]),
            '|',
            new RubyBinaryExpression(args[0], oppDirection, new RubyBinaryExpression(RubyLiteral.Integer(bits), '-', args[1]))
          );

        case 'Pack32LE':
        case 'Pack32BE':
        case 'Pack16LE':
        case 'Pack16BE':
          // Ruby pack
          const format = methodName.includes('LE') ? 'V' : 'N';
          return new RubyMethodCall(new RubyArrayLiteral(args), 'pack', [RubyLiteral.String(format)]);

        case 'Unpack32LE':
        case 'Unpack32BE':
        case 'Unpack16LE':
        case 'Unpack16BE':
          const unpackFormat = methodName.includes('LE') ? 'V' : 'N';
          return new RubyMethodCall(args[0], 'unpack', [RubyLiteral.String(unpackFormat)]);

        case 'XorArrays':
          return new RubyMethodCall(
            new RubyMethodCall(args[0], 'zip', [args[1]]),
            'map',
            [],
            new RubyBlockExpression(
              [new RubyParameter('a'), new RubyParameter('b')],
              this.wrapInBlock(new RubyExpressionStatement(
                new RubyBinaryExpression(new RubyIdentifier('a'), '^', new RubyIdentifier('b'))
              ))
            )
          );

        case 'ClearArray':
          return new RubyMethodCall(args[0], 'fill', [RubyLiteral.Integer(0)]);

        case 'Hex8ToBytes':
          return new RubyMethodCall(
            new RubyMethodCall(new RubyArrayLiteral([args[0]]), 'pack', [RubyLiteral.String('H*')]),
            'bytes',
            []
          );

        case 'BytesToHex8':
          return new RubyMethodCall(
            new RubyMethodCall(args[0], 'pack', [RubyLiteral.String('C*')]),
            'unpack1',
            [RubyLiteral.String('H*')]
          );

        case 'AnsiToBytes':
          return new RubyMethodCall(args[0], 'bytes', []);

        default:
          return new RubyMethodCall(null, this.toSnakeCase(methodName), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      return new RubyArrayLiteral(elements);
    }

    /**
     * Transform an object expression to hash literal
     */
    transformObjectExpression(node) {
      const pairs = [];
      for (const prop of node.properties) {
        if (!prop.key) continue;

        const key = prop.key.name || prop.key.value || 'unknown';
        const value = this.transformExpression(prop.value);

        // Use symbols for keys
        const keyExpr = this.options.useSymbolKeys !== false
          ? RubyLiteral.Symbol(this.toSnakeCase(key))
          : RubyLiteral.String(key);

        pairs.push({ key: keyExpr, value });
      }

      return new RubyHashLiteral(pairs);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;

        // TypedArrays
        const typedArrayMap = {
          'Uint8Array': 'Array',
          'Uint16Array': 'Array',
          'Uint32Array': 'Array',
          'Int8Array': 'Array',
          'Int16Array': 'Array',
          'Int32Array': 'Array',
          'Array': 'Array'
        };

        if (typedArrayMap[typeName]) {
          if (node.arguments.length > 0) {
            const size = this.transformExpression(node.arguments[0]);
            return new RubyMethodCall(new RubyIdentifier('Array'), 'new', [size]);
          }
          return new RubyArrayLiteral([]);
        }

        const className = this.toCamelCase(typeName);
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new RubyMethodCall(new RubyIdentifier(className), 'new', args);
      }

      return null;
    }

    /**
     * Transform a conditional expression (ternary)
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const thenExpr = this.transformExpression(node.consequent);
      const elseExpr = this.transformExpression(node.alternate);

      return new RubyConditional(condition, thenExpr, elseExpr);
    }

    /**
     * Transform a function expression to lambda
     */
    transformFunctionExpression(node) {
      const params = node.params ? node.params.map(p => {
        const paramName = this.toSnakeCase(p.name);
        const paramType = this.inferTypeFromName(p.name);
        return new RubyParameter(paramName, paramType);
      }) : [];

      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          body = this.wrapInBlock(new RubyExpressionStatement(this.transformExpression(node.body)));
        }
      }

      return new RubyLambda(params, body);
    }

    /**
     * Transform spread element
     */
    transformSpreadElement(node) {
      const splatExpr = new RubySplat(this.transformExpression(node.argument));
      return splatExpr;
    }

    /**
     * Transform template literal to string interpolation
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        const text = node.quasis[i].value.raw;
        if (text) parts.push(text);

        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new RubyStringInterpolation(parts);
    }
  }

  // Export
  const exports = { RubyTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.RubyTransformer = RubyTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
