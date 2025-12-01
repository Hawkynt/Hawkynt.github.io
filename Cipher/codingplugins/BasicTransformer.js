/**
 * BasicTransformer.js - JavaScript AST to Basic AST Transformer
 * Converts type-annotated JavaScript AST to Basic AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Basic AST -> Basic Emitter -> Basic Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let BasicAST;
  if (typeof require !== 'undefined') {
    BasicAST = require('./BasicAST.js');
  } else if (global.BasicAST) {
    BasicAST = global.BasicAST;
  }

  const {
    BasicType, BasicModule, BasicImport, BasicAttribute,
    BasicTypeDeclaration, BasicField, BasicClass, BasicProperty, BasicConstructor,
    BasicFunction, BasicParameter, BasicBlock, BasicDim, BasicAssignment,
    BasicExpressionStatement, BasicReturn, BasicIf, BasicFor, BasicForEach,
    BasicWhile, BasicDoLoop, BasicSelect, BasicCase, BasicTry, BasicCatch,
    BasicExit, BasicContinue, BasicThrow, BasicOnError, BasicLiteral, BasicIdentifier,
    BasicBinaryExpression, BasicUnaryExpression, BasicMemberAccess, BasicIndexAccess,
    BasicCall, BasicMethodCall, BasicNew, BasicArrayLiteral, BasicCast, BasicConditional,
    BasicLambda, BasicAddressOf, BasicTypeOf, BasicWith, BasicComment
  } = BasicAST;

  /**
   * Maps JavaScript/JSDoc types to Basic types
   */
  const TYPE_MAP = {
    // Unsigned integers -> Long (Basic doesn't have unsigned types except in some dialects)
    'uint8': 'Byte', 'byte': 'Byte',
    'uint16': 'Integer', 'ushort': 'Integer', 'word': 'Integer',
    'uint32': 'Long', 'uint': 'Long', 'dword': 'Long',
    'uint64': 'LongLong', 'ulong': 'LongLong', 'qword': 'LongLong',
    // Signed integers
    'int8': 'Byte', 'sbyte': 'Byte',
    'int16': 'Integer', 'short': 'Integer',
    'int32': 'Long', 'int': 'Long',
    'int64': 'LongLong', 'long': 'LongLong',
    // Floating point
    'float': 'Single', 'float32': 'Single',
    'double': 'Double', 'float64': 'Double',
    // JavaScript 'number' in crypto context typically means Long
    'number': 'Long',
    // Other
    'boolean': 'Boolean', 'bool': 'Boolean',
    'string': 'String', 'String': 'String',
    'void': '',
    'object': 'Object',
    'Array': 'Array'
  };

  /**
   * JavaScript AST to Basic AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Add comments. Default: true
   * - variant: string - Basic dialect ('FREEBASIC', 'VBNET', 'VB6', etc.). Default: 'FREEBASIC'
   * - upperCase: boolean - Use uppercase keywords. Default: false
   * - strictTypes: boolean - Use strict type annotations. Default: true
   * - useClasses: boolean - Generate classes vs Types. Default: true
   * - useExceptionHandling: boolean - Use Try/Catch vs On Error. Default: true
   */
  class BasicTransformer {
    constructor(options = {}) {
      this.options = options;
      this.variant = (options.variant || 'FREEBASIC').toUpperCase();
      this.currentClass = null;
      this.variableTypes = new Map();  // Maps variable name -> BasicType
      this.scopeStack = [];
    }

    /**
     * Convert name to PascalCase (Basic convention for types, functions)
     */
    toPascalCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);

      // Split on underscores and capitalize each part
      const parts = str.split(/[_\s]+/);
      return parts.map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join('');
    }

    /**
     * Convert name to camelCase (Basic convention for variables)
     */
    toCamelCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);

      const pascal = this.toPascalCase(str);
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    /**
     * Map JavaScript type string to Basic type
     */
    mapType(typeName) {
      if (!typeName) return BasicType.Long();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return BasicType.Array(elementType);
      }

      const basicTypeName = TYPE_MAP[typeName] || typeName;

      // Map to Basic types
      const typeMap = {
        'Byte': BasicType.Byte(),
        'Integer': BasicType.Integer(),
        'Long': BasicType.Long(),
        'LongLong': BasicType.LongLong(),
        'Single': BasicType.Single(),
        'Double': BasicType.Double(),
        'Boolean': BasicType.Boolean(),
        'String': BasicType.String(),
        'Object': BasicType.Object(),
        'Variant': BasicType.Variant()
      };

      return typeMap[basicTypeName] || new BasicType(basicTypeName);
    }

    /**
     * Register a variable's type in the current scope
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
     * Infer Basic type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return BasicType.Long();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return BasicType.Byte();
      }

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        return BasicType.Array(BasicType.Byte());
      }

      // Integer-related names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return BasicType.Integer();
      }

      // Boolean names
      if (lowerName.startsWith('is') || lowerName.startsWith('has') ||
          lowerName.startsWith('can') || lowerName.startsWith('should')) {
        return BasicType.Boolean();
      }

      // String names
      if (lowerName.includes('name') || lowerName.includes('text') ||
          lowerName.includes('str') || lowerName.includes('msg')) {
        return BasicType.String();
      }

      // Default to Long for crypto operations
      return BasicType.Long();
    }

    /**
     * Transform a JavaScript AST to a Basic AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {BasicModule} Basic AST
     */
    transform(jsAst) {
      const module = new BasicModule();

      // Add module comment
      if (this.options.addComments !== false) {
        module.moduleComment = new BasicComment(
          `Generated ${this.variant} code\nThis file was automatically generated from JavaScript AST`,
          false
        );
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
          // Handle IIFE wrappers - extract content from inside
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              this.transformIIFEContent(callee, node.expression, targetModule);
            }
          }
          break;

        default:
          // Skip unhandled top-level node types
          break;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     */
    transformIIFEContent(calleeNode, callExpr, targetModule) {
      let bodyStatements = [];

      // Try to find the factory function in UMD pattern
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          bodyStatements = factoryArg.body?.body || [];
        }
      }

      // Simple IIFE pattern: extract from callee's body
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        // Skip 'use strict' and other expression statements
        if (stmt.type === 'ExpressionStatement') continue;

        // Process class declarations
        if (stmt.type === 'ClassDeclaration') {
          this.transformClassDeclaration(stmt, targetModule);
          continue;
        }

        // Process function declarations
        if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetModule);
          continue;
        }

        // Process variable declarations
        if (stmt.type === 'VariableDeclaration') {
          this.transformVariableDeclaration(stmt, targetModule);
          continue;
        }

        // Skip if statements (usually feature detection)
        if (stmt.type === 'IfStatement') continue;
      }
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetModule) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip ObjectPattern destructuring
        if (decl.id.type === 'ObjectPattern' || decl.id.type === 'ArrayPattern')
          continue;

        const name = decl.id.name;

        // Check if this is an object literal defining a struct/type
        if (decl.init.type === 'ObjectExpression') {
          // Skip - we'll handle these as part of classes
          continue;
        }

        // Handle simple literals as constants
        if (decl.init.type === 'Literal' ||
            decl.init.type === 'ArrayExpression' ||
            decl.init.type === 'UnaryExpression' ||
            decl.init.type === 'BinaryExpression') {
          const dim = new BasicDim(
            this.toPascalCase(name),
            this.inferTypeFromValue(decl.init),
            this.transformExpression(decl.init)
          );
          dim.isConst = node.kind === 'const';
          targetModule.declarations.push(dim);
        }
      }
    }

    /**
     * Infer Basic type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return BasicType.Long();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              if (valueNode.value >= 0 && valueNode.value <= 255) return BasicType.Byte();
              if (valueNode.value >= -32768 && valueNode.value <= 32767) return BasicType.Integer();
              return BasicType.Long();
            }
            return BasicType.Double();
          }
          if (typeof valueNode.value === 'string') return BasicType.String();
          if (typeof valueNode.value === 'boolean') return BasicType.Boolean();
          return BasicType.Long();

        case 'ArrayExpression':
          if (valueNode.elements.length > 0) {
            const elemType = this.inferTypeFromValue(valueNode.elements[0]);
            return BasicType.Array(elemType);
          }
          return BasicType.Array(BasicType.Byte());

        default:
          return BasicType.Long();
      }
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetModule) {
      const funcName = this.toPascalCase(node.id.name);

      // Determine if it's a Sub (void) or Function (returns value)
      const hasReturn = this.hasReturnWithValue(node.body);
      const func = new BasicFunction(funcName, !hasReturn);

      // Infer return type
      if (hasReturn) {
        const returnType = this.inferReturnType(node.body);
        func.returnType = returnType || BasicType.Long();
      }

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = param.typeAnnotation ?
            this.mapType(param.typeAnnotation) :
            this.inferTypeFromName(param.name);
          const basicParam = new BasicParameter(paramName, paramType);
          func.parameters.push(basicParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetModule.functions.push(func);
    }

    /**
     * Transform a class declaration to a Basic Class or Type
     */
    transformClassDeclaration(node, targetModule) {
      const className = this.toPascalCase(node.id.name);

      const useClasses = this.options.useClasses !== false &&
        ['VBNET', 'FREEBASIC', 'VB6', 'GAMBAS', 'XOJO'].includes(this.variant);

      if (useClasses) {
        const cls = new BasicClass(className);
        const prevClass = this.currentClass;
        this.currentClass = cls;

        // Handle both class body structures
        const members = node.body?.body || node.body || [];

        if (members && members.length > 0) {
          for (const member of members) {
            if (member.type === 'MethodDefinition') {
              if (member.kind === 'constructor') {
                // Constructor
                const { fields, ctor } = this.extractFieldsFromConstructor(member);
                cls.fields.push(...fields);
                cls.constructors.push(ctor);
              } else {
                // Regular method
                const method = this.transformMethodDefinition(member);
                cls.methods.push(method);
              }
            } else if (member.type === 'PropertyDefinition') {
              // Field
              const field = this.transformPropertyDefinition(member);
              cls.fields.push(field);
            }
          }
        }

        this.currentClass = prevClass;
        targetModule.declarations.push(cls);
      } else {
        // Use Type/Structure for non-OOP dialects
        const typeDecl = new BasicTypeDeclaration(className);

        const members = node.body?.body || node.body || [];
        if (members && members.length > 0) {
          for (const member of members) {
            if (member.type === 'PropertyDefinition') {
              const field = this.transformPropertyDefinitionToField(member);
              typeDecl.fields.push(field);
            }
          }
        }

        targetModule.types.push(typeDecl);
      }
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];
      const ctor = new BasicConstructor();

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return { fields, ctor };

      // Parameters
      if (node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          ctor.parameters.push(new BasicParameter(paramName, paramType));
          this.registerVariableType(param.name, paramType);
        }
      }

      const body = new BasicBlock();

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = expr.left.property.name || expr.left.property.value;
          let fieldName = this.toCamelCase(propName);

          // Remove leading underscore
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          const value = expr.right;
          let fieldType = this.inferTypeFromValue(value);

          const field = new BasicField(fieldName, fieldType);
          fields.push(field);

          // Add assignment to constructor body
          const assignment = new BasicAssignment(
            new BasicIdentifier(fieldName),
            this.transformExpression(value)
          );
          body.statements.push(assignment);
        } else {
          // Transform other statements
          const stmt2 = this.transformStatement(stmt);
          if (stmt2) {
            if (Array.isArray(stmt2))
              body.statements.push(...stmt2);
            else
              body.statements.push(stmt2);
          }
        }
      }

      ctor.body = body;
      return { fields, ctor };
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
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toPascalCase(node.key.name);

      // Determine if Sub or Function
      const hasReturn = node.value && node.value.body ?
        this.hasReturnWithValue(node.value.body) : false;

      const method = new BasicFunction(methodName, !hasReturn);
      method.isShared = node.static || false;

      // Infer return type
      if (hasReturn) {
        const returnType = this.inferReturnType(node.value.body);
        method.returnType = returnType || BasicType.Long();
      }

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          method.parameters.push(new BasicParameter(paramName, paramType));
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
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const fieldName = this.toCamelCase(node.key.name);
      let fieldType = BasicType.Long();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      }

      return new BasicField(fieldName, fieldType);
    }

    /**
     * Transform a property definition to a field (for Type/Structure)
     */
    transformPropertyDefinitionToField(node) {
      const fieldName = this.toCamelCase(node.key.name);
      let fieldType = BasicType.Long();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      }

      return new BasicField(fieldName, fieldType);
    }

    /**
     * Check if body has return statement with value
     */
    hasReturnWithValue(bodyNode) {
      if (!bodyNode) return false;

      const check = (node) => {
        if (!node) return false;
        if (node.type === 'ReturnStatement' && node.argument) return true;

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            if (value.some(check)) return true;
          } else if (value && typeof value === 'object') {
            if (check(value)) return true;
          }
        }
        return false;
      };

      return check(bodyNode);
    }

    /**
     * Infer return type from return statements
     */
    inferReturnType(bodyNode) {
      if (!bodyNode) return null;

      const returnTypes = [];
      const collect = (node) => {
        if (!node) return;
        if (node.type === 'ReturnStatement' && node.argument) {
          returnTypes.push(this.inferTypeFromValue(node.argument));
        }

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(collect);
          } else if (value && typeof value === 'object') {
            collect(value);
          }
        }
      };

      collect(bodyNode);

      if (returnTypes.length === 0) return null;
      return returnTypes[0];
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new BasicBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const basicStmt = this.transformStatement(stmt);
          if (basicStmt) {
            if (Array.isArray(basicStmt)) {
              block.statements.push(...basicStmt);
            } else {
              block.statements.push(basicStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement - ALL 16 critical statement types
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        // 1. VariableDeclaration
        case 'VariableDeclaration':
          return this.transformDimStatement(node);

        // 2. ExpressionStatement
        case 'ExpressionStatement':
          return this.transformExpressionStatementNode(node);

        // 3. ReturnStatement
        case 'ReturnStatement':
          return this.transformReturnStatement(node);

        // 4. IfStatement
        case 'IfStatement':
          return this.transformIfStatement(node);

        // 5. ForStatement
        case 'ForStatement':
          return this.transformForStatement(node);

        // 6. ForOfStatement
        case 'ForOfStatement':
          return this.transformForEachStatement(node);

        // 7. ForInStatement
        case 'ForInStatement':
          return this.transformForEachStatement(node);

        // 8. WhileStatement
        case 'WhileStatement':
          return this.transformWhileStatement(node);

        // 9. DoWhileStatement
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        // 10. SwitchStatement
        case 'SwitchStatement':
          return this.transformSelectStatement(node);

        // 11. TryStatement
        case 'TryStatement':
          return this.transformTryStatement(node);

        // 12. ThrowStatement
        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        // 13. BlockStatement
        case 'BlockStatement':
          return this.transformBlockStatement(node);

        // 14. BreakStatement
        case 'BreakStatement':
          return new BasicExit('For'); // Context-dependent

        // 15. ContinueStatement
        case 'ContinueStatement':
          return new BasicContinue('For'); // Context-dependent

        // 16. EmptyStatement
        case 'EmptyStatement':
          return null;

        default:
          return null;
      }
    }

    /**
     * Transform a Dim statement
     */
    transformDimStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = this.toCamelCase(decl.id.name);
        let varType = null;
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
          varType = this.inferTypeFromValue(decl.init);
        } else {
          varType = this.inferTypeFromName(decl.id.name);
        }

        const dim = new BasicDim(varName, varType, initializer);
        dim.isConst = node.kind === 'const';

        this.registerVariableType(decl.id.name, varType);
        statements.push(dim);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new BasicExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new BasicReturn(expr);
      }

      return new BasicReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new BasicBlock();

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const ifStmt = new BasicIf(condition, thenBlock);

      // Handle else if and else
      if (node.alternate) {
        if (node.alternate.type === 'IfStatement') {
          // ElseIf
          const elseIfCondition = this.transformExpression(node.alternate.test);
          const elseIfBranch = this.transformStatement(node.alternate.consequent) || new BasicBlock();
          const elseIfBlock = elseIfBranch.nodeType === 'Block' ? elseIfBranch : this.wrapInBlock(elseIfBranch);

          ifStmt.elseIfBranches.push({ condition: elseIfCondition, body: elseIfBlock });

          // Handle further else
          if (node.alternate.alternate) {
            const elseBranch = this.transformStatement(node.alternate.alternate);
            ifStmt.elseBranch = elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch);
          }
        } else {
          // Else
          const elseBranch = this.transformStatement(node.alternate);
          ifStmt.elseBranch = elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch);
        }
      }

      return ifStmt;
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // C-style for: for (let i = 0; i < n; i++)
      let variable = 'i';
      let start = new BasicLiteral(0, 'int');
      let end = new BasicLiteral(10, 'int');
      let step = null;

      // Extract variable from init
      if (node.init && node.init.type === 'VariableDeclaration') {
        const decl = node.init.declarations[0];
        if (decl) {
          variable = this.toCamelCase(decl.id.name);
          if (decl.init) {
            start = this.transformExpression(decl.init);
          }
        }
      }

      // Extract end from test
      if (node.test && node.test.type === 'BinaryExpression') {
        end = this.transformExpression(node.test.right);
      }

      // Extract step from update
      if (node.update) {
        if (node.update.type === 'UpdateExpression') {
          step = node.update.operator === '++' ?
            new BasicLiteral(1, 'int') :
            new BasicLiteral(-1, 'int');
        } else if (node.update.type === 'AssignmentExpression') {
          step = this.transformExpression(node.update.right);
        }
      }

      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const forLoop = new BasicFor(variable, start, end, bodyBlock);
      forLoop.step = step;

      return forLoop;
    }

    /**
     * Transform a for-each statement
     */
    transformForEachStatement(node) {
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toCamelCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toCamelCase(node.left.name);
      }

      const collection = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new BasicForEach(varName, collection, bodyBlock);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new BasicWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const doLoop = new BasicDoLoop(bodyBlock, condition);
      doLoop.isWhile = true;
      doLoop.testAtTop = false; // Do...Loop While

      return doLoop;
    }

    /**
     * Transform a switch statement to Select Case
     */
    transformSelectStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const select = new BasicSelect(discriminant);

      for (const caseNode of node.cases) {
        let values = null;
        if (caseNode.test) {
          values = [this.transformExpression(caseNode.test)];
        }

        const caseBody = new BasicBlock();
        for (const stmt of caseNode.consequent) {
          const basicStmt = this.transformStatement(stmt);
          if (basicStmt) {
            if (Array.isArray(basicStmt)) {
              caseBody.statements.push(...basicStmt);
            } else {
              caseBody.statements.push(basicStmt);
            }
          }
        }

        select.cases.push(new BasicCase(values, caseBody));
      }

      return select;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      const tryStmt = new BasicTry();
      tryStmt.tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        const exceptionVar = node.handler.param ?
          this.toCamelCase(node.handler.param.name) : 'ex';
        const catchBody = this.transformStatement(node.handler.body);
        const catchClause = new BasicCatch('Exception', exceptionVar, catchBody);
        tryStmt.catchClauses.push(catchClause);
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformStatement(node.finalizer);
      }

      return tryStmt;
    }

    /**
     * Transform a throw statement
     */
    transformThrowStatement(node) {
      const expr = node.argument ?
        this.transformExpression(node.argument) :
        new BasicNew('Exception', []);
      return new BasicThrow(expr);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new BasicBlock();
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
     * Transform an expression - ALL 19 critical expression types
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        // 1. Literal
        case 'Literal':
          return this.transformLiteral(node);

        // 2. Identifier
        case 'Identifier':
          return this.transformIdentifier(node);

        // 3. BinaryExpression
        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);

        // 4. UnaryExpression
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);

        // 5. AssignmentExpression
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        // 6. UpdateExpression
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        // 7. MemberExpression
        case 'MemberExpression':
          return this.transformMemberExpression(node);

        // 8. CallExpression
        case 'CallExpression':
          return this.transformCallExpression(node);

        // 9. ArrayExpression
        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        // 10. ObjectExpression
        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        // 11. NewExpression
        case 'NewExpression':
          return this.transformNewExpression(node);

        // 12. ThisExpression
        case 'ThisExpression':
          return new BasicIdentifier('Me');

        // 13. ConditionalExpression
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        // 14. ArrowFunctionExpression
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        // 15. SequenceExpression
        case 'SequenceExpression':
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        // 16. SpreadElement
        case 'SpreadElement':
          return this.transformExpression(node.argument);

        // 17. TemplateLiteral
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        // 18. Super
        case 'Super':
          return new BasicIdentifier('MyBase');

        // 19. MetaProperty (import.meta, new.target)
        case 'MetaProperty':
          return new BasicIdentifier('Unknown');

        default:
          return null;
      }
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          if (node.value >= -32768 && node.value <= 32767)
            return BasicLiteral.Int(node.value);
          return BasicLiteral.Long(node.value);
        }
        return BasicLiteral.Double(node.value);
      }

      if (typeof node.value === 'string') {
        return BasicLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return BasicLiteral.Boolean(node.value);
      }

      if (node.value === null) {
        return BasicLiteral.Nothing();
      }

      return new BasicLiteral(node.value, 'unknown');
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Basic equivalents
      if (name === 'undefined') return BasicLiteral.Nothing();
      if (name === 'null') return BasicLiteral.Nothing();
      if (name === 'true') return BasicLiteral.Boolean(true);
      if (name === 'false') return BasicLiteral.Boolean(false);

      return new BasicIdentifier(this.toCamelCase(name));
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Map operators
      let operator = node.operator;

      // Comparison operators
      if (operator === '===') operator = '=';
      if (operator === '!==') operator = '<>';
      if (operator === '==') operator = '=';
      if (operator === '!=') operator = '<>';

      // Bitwise/logical operators
      if (operator === '&&') operator = 'And';
      if (operator === '||') operator = 'Or';
      if (operator === '!') operator = 'Not';
      if (operator === '&') operator = 'And'; // Bitwise And
      if (operator === '|') operator = 'Or';  // Bitwise Or
      if (operator === '^') operator = 'Xor';

      // Shift operators
      if (operator === '<<') operator = '<<'; // Left shift (VB.NET only)
      if (operator === '>>') operator = '>>'; // Right shift (VB.NET only)
      if (operator === '>>>') operator = '>>'; // Unsigned right shift -> regular shift

      // Modulo
      if (operator === '%') operator = 'Mod';

      return new BasicBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;
      if (operator === '!') operator = 'Not';
      if (operator === 'typeof') {
        // TypeOf is different in Basic
        return new BasicCall(new BasicIdentifier('TypeName'), [operand]);
      }

      return new BasicUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new BasicAssignment(left, right, node.operator);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      // Basic doesn't have ++ or --, use += 1 or -= 1
      const op = node.operator === '++' ? '+=' : '-=';
      return new BasicAssignment(operand, new BasicLiteral(1, 'int'), op);
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array indexing
        const index = this.transformExpression(node.property);
        return new BasicIndexAccess(object, [index]);
      } else {
        // Member access
        const member = node.property.name || node.property.value;

        // Handle special properties
        if (member === 'length') {
          // array.length -> UBound(array) + 1 or array.Length in VB.NET
          if (this.variant === 'VBNET') {
            return new BasicMemberAccess(object, 'Length');
          } else {
            return new BasicBinaryExpression(
              new BasicCall(new BasicIdentifier('UBound'), [object]),
              '+',
              new BasicLiteral(1, 'int')
            );
          }
        }

        return new BasicMemberAccess(object, this.toPascalCase(member));
      }
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle OpCodes method calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        return new BasicMethodCall(object, this.toPascalCase(method), args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new BasicCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to Basic equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Basic helper functions
      // These would need to be implemented in the target Basic code
      const funcName = this.toPascalCase(methodName);
      return new BasicCall(new BasicIdentifier(funcName), args);
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      return new BasicArrayLiteral(elements);
    }

    /**
     * Transform an object expression
     */
    transformObjectExpression(node) {
      // For Basic, we'd typically use a Type or Class instance
      // For now, return a placeholder
      return new BasicIdentifier('ObjectLiteral');
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = this.toPascalCase(node.callee.name);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle TypedArrays
        const typedArrayMap = {
          'Uint8Array': 'Byte',
          'Uint16Array': 'Integer',
          'Uint32Array': 'Long',
          'Int8Array': 'Byte',
          'Int16Array': 'Integer',
          'Int32Array': 'Long'
        };

        if (typedArrayMap[node.callee.name]) {
          // Create array
          if (args.length === 1) {
            // new Uint8Array(n) -> Dim arr(n-1) As Byte
            return new BasicIdentifier(`Array(${typedArrayMap[node.callee.name]})`);
          }
        }

        return new BasicNew(typeName, args);
      }

      return new BasicNew('Object', []);
    }

    /**
     * Transform a conditional expression
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);

      return new BasicConditional(condition, trueExpr, falseExpr);
    }

    /**
     * Transform a function expression to lambda
     */
    transformFunctionExpression(node) {
      const params = node.params ? node.params.map(p => {
        const paramName = this.toCamelCase(p.name);
        const paramType = this.inferTypeFromName(p.name);
        return new BasicParameter(paramName, paramType);
      }) : [];

      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          body = this.transformExpression(node.body);
        }
      }

      const hasReturn = node.body && this.hasReturnWithValue(node.body);
      return new BasicLambda(params, body, !hasReturn);
    }

    /**
     * Transform template literal
     */
    transformTemplateLiteral(node) {
      // Convert to string concatenation
      let result = null;

      for (let i = 0; i < node.quasis.length; ++i) {
        const text = node.quasis[i].value.raw;
        if (text) {
          const strLit = BasicLiteral.String(text);
          result = result ? new BasicBinaryExpression(result, '&', strLit) : strLit;
        }

        if (i < node.expressions.length) {
          const expr = this.transformExpression(node.expressions[i]);
          result = result ? new BasicBinaryExpression(result, '&', expr) : expr;
        }
      }

      return result || BasicLiteral.String('');
    }
  }

  // Export
  const exports = { BasicTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.BasicTransformer = BasicTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
