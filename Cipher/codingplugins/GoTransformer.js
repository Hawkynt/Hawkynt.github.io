/**
 * GoTransformer.js - JavaScript AST to Go AST Transformer
 * Converts type-annotated JavaScript AST to Go AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Go AST -> Go Emitter -> Go Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let GoAST;
  if (typeof require !== 'undefined') {
    GoAST = require('./GoAST.js');
  } else if (global.GoAST) {
    GoAST = global.GoAST;
  }

  const {
    GoType, GoFile, GoImport, GoStruct, GoInterface, GoTypeAlias,
    GoField, GoFunc, GoParameter, GoConst, GoVar,
    GoBlock, GoExpressionStatement, GoReturn, GoIf, GoFor, GoSwitch, GoCase,
    GoDefer, GoGo, GoBreak, GoContinue, GoSelect,
    GoLiteral, GoIdentifier, GoBinaryExpression, GoUnaryExpression, GoAssignment,
    GoSelectorExpression, GoIndexExpression, GoSliceExpression, GoCallExpression,
    GoTypeAssertion, GoTypeConversion, GoCompositeLiteral, GoKeyValue,
    GoFuncLit, GoMake, GoNew
  } = GoAST;

  /**
   * Maps JavaScript/JSDoc types to Go types
   */
  const TYPE_MAP = {
    'uint8': 'uint8', 'byte': 'uint8',
    'uint16': 'uint16', 'ushort': 'uint16', 'word': 'uint16',
    'uint32': 'uint32', 'uint': 'uint32', 'dword': 'uint32',
    'uint64': 'uint64', 'ulong': 'uint64', 'qword': 'uint64',
    'int8': 'int8', 'sbyte': 'int8',
    'int16': 'int16', 'short': 'int16',
    'int32': 'int32', 'int': 'int32',
    'int64': 'int64', 'long': 'int64',
    'float': 'float32', 'float32': 'float32',
    'double': 'float64', 'float64': 'float64',
    'number': 'uint32', // In crypto context
    'boolean': 'bool', 'bool': 'bool',
    'string': 'string', 'String': 'string',
    'void': '', // No return type in Go
    'object': 'interface{}', 'Object': 'interface{}', 'any': 'interface{}'
  };

  /**
   * JavaScript AST to Go AST Transformer
   */
  class GoTransformer {
    constructor(options = {}) {
      this.options = {
        packageName: 'main',
        addComments: true,
        useStrictTypes: true,
        errorHandling: true,
        useInterfaces: true,
        useGoroutines: true,
        useCrypto: true,
        useGenerics: true,
        useContext: true,
        useChannels: true,
        ...options
      };
      this.typeKnowledge = options.typeKnowledge || null;
      this.currentStruct = null;
      this.currentFunc = null;
      this.variableTypes = new Map();
      this.imports = new Set();
      this.receiverName = 's'; // Default receiver variable name
    }

    /**
     * Map type from knowledge
     */
    mapTypeFromKnowledge(typeName) {
      if (!typeName) {
        return this.options.useStrictTypes ? GoType.UInt32() : GoType.Interface();
      }

      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapTypeFromKnowledge(elementTypeName);
        return GoType.Slice(elementType);
      }

      const typeMap = {
        'byte': GoType.UInt8(),
        'uint8': GoType.UInt8(),
        'uint16': GoType.UInt16(),
        'uint32': GoType.UInt32(),
        'uint64': GoType.UInt64(),
        'int8': GoType.Int8(),
        'int16': GoType.Int16(),
        'int32': GoType.Int32(),
        'int64': GoType.Int64(),
        'float32': GoType.Float32(),
        'float64': GoType.Float64(),
        'bool': GoType.Bool(),
        'string': GoType.String(),
        'dword': GoType.UInt32(),
        'word': GoType.UInt16(),
        'qword': GoType.UInt64()
      };

      const mapped = typeMap[typeName];
      if (mapped) return mapped;

      // Unknown type - use interface{} if not strict, or generic if using generics
      if (this.options.useStrictTypes) {
        return this.options.useGenerics ? new GoType('any') : GoType.UInt32();
      }
      return GoType.Interface();
    }

    /**
     * Get OpCodes return type
     */
    getOpCodesReturnType(methodName) {
      if (!this.typeKnowledge?.opCodesTypes) return null;
      const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
      if (!methodInfo) return null;
      return this.mapTypeFromKnowledge(methodInfo.returns);
    }

    /**
     * Infer full expression type
     */
    inferFullExpressionType(node) {
      if (!node) return GoType.Interface();

      switch (node.type) {
        case 'Literal':
          return this.inferLiteralType(node);
        case 'Identifier':
          const varType = this.variableTypes.get(node.name);
          if (varType) return varType;
          return this.inferTypeFromName(node.name);
        case 'CallExpression':
          return this.inferCallExpressionType(node);
        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const elemType = this.inferFullExpressionType(node.elements[0]);
            return GoType.Slice(elemType);
          }
          return GoType.Slice(GoType.UInt8());
        case 'BinaryExpression':
          const op = node.operator;
          if (['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(op)) {
            return GoType.Bool();
          }
          if (['&&', '||'].includes(op)) {
            return GoType.Bool();
          }
          if (op === '>>>') {
            return GoType.UInt32();
          }
          const leftType = this.inferFullExpressionType(node.left);
          const rightType = this.inferFullExpressionType(node.right);
          return this.getWiderType(leftType, rightType);
        case 'NewExpression':
          if (node.callee.name === 'Array') {
            return GoType.Slice(GoType.Interface());
          }
          return new GoType(node.callee.name);
        default:
          return GoType.Interface();
      }
    }

    inferLiteralType(node) {
      if (node.value === null) return GoType.Interface();
      if (typeof node.value === 'boolean') return GoType.Bool();
      if (typeof node.value === 'string') return GoType.String();
      if (typeof node.value === 'number') {
        return Number.isInteger(node.value) ? GoType.UInt32() : GoType.Float64();
      }
      return GoType.Interface();
    }

    inferTypeFromName(name) {
      if (!name) return GoType.UInt32();
      const lowerName = name.toLowerCase();

      if (lowerName.includes('byte') || lowerName === 'b') {
        return GoType.UInt8();
      }
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('buffer')) {
        return GoType.Slice(GoType.UInt8());
      }
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j') {
        return GoType.Int();
      }
      return GoType.UInt32();
    }

    inferCallExpressionType(node) {
      if (node.callee.type === 'MemberExpression') {
        const obj = node.callee.object;
        const method = node.callee.property.name;

        if (obj.type === 'Identifier' && obj.name === 'OpCodes') {
          const returnType = this.getOpCodesReturnType(method);
          if (returnType) return returnType;
        }

        if (method === 'length') return GoType.Int();
      }
      return GoType.Interface();
    }

    getWiderType(type1, type2) {
      if (!type1 || !type2) return type1 || type2 || GoType.UInt32();

      const widths = {
        'uint8': 8, 'int8': 8,
        'uint16': 16, 'int16': 16,
        'uint32': 32, 'int32': 32,
        'uint64': 64, 'int64': 64
      };

      const w1 = widths[type1.name] || 32;
      const w2 = widths[type2.name] || 32;

      return w1 >= w2 ? type1 : type2;
    }

    /**
     * Transform JavaScript AST to Go AST
     * @param {Object} jsAst - JavaScript AST
     * @returns {GoFile} Go AST
     */
    transform(jsAst) {
      const goFile = new GoFile();
      goFile.package = this.options.packageName || 'main';

      // Transform program body
      if (jsAst.type === 'Program' && jsAst.body) {
        for (const node of jsAst.body) {
          const transformed = this.transformTopLevel(node);
          if (transformed) {
            if (Array.isArray(transformed)) {
              goFile.declarations.push(...transformed);
            } else {
              goFile.declarations.push(transformed);
            }
          }
        }
      }

      // Add collected imports at the beginning
      for (const imp of this.imports) {
        goFile.imports.push(new GoImport(imp));
      }

      return goFile;
    }

    /**
     * Transform top-level node
     */
    transformTopLevel(node) {
      if (!node) return null;

      switch (node.type) {
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);

        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);

        case 'VariableDeclaration':
          return this.transformTopLevelVariableDeclaration(node);

        case 'ExpressionStatement':
          // Handle IIFE wrappers - extract content from inside
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            // UMD pattern: (function(root, factory) { ... })(...)
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              // Extract and process IIFE body content (pass full CallExpression for UMD detection)
              return this.transformIIFEContent(callee, node.expression);
            }

            // Handle RegisterAlgorithm calls
            if (callee.type === 'Identifier' && callee.name === 'RegisterAlgorithm') {
              // Skip - algorithm registration not needed in Go
              return null;
            }
          }

          // Other expression statements at top level are usually side effects
          return null;

        case 'IfStatement':
          // Top-level if statements are usually guard clauses - skip
          return null;

        default:
          return null;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     * Handles multiple patterns:
     * - Simple: (function(global) { ... })(globalThis)
     * - UMD: (function(root, factory) { ... })((function(){...})(), function(deps) { ... })
     */
    transformIIFEContent(calleeNode, callExpr) {
      // First, try to find the factory function in UMD pattern
      // UMD pattern: the second argument is usually the factory function
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          // Found UMD factory function - extract from its body
          return this.extractDeclarationsFromBody(factoryArg.body?.body || []);
        }
      }

      // Simple IIFE pattern: extract from callee's body
      if (!calleeNode.body || !calleeNode.body.body) return null;
      return this.extractDeclarationsFromBody(calleeNode.body.body);
    }

    /**
     * Extract declarations from a function body
     */
    extractDeclarationsFromBody(bodyStatements) {
      const declarations = [];

      for (const stmt of bodyStatements) {
        // Skip 'use strict' and other expression statements
        if (stmt.type === 'ExpressionStatement') {
          // But handle assignment expressions that might be class definitions
          if (stmt.expression.type === 'AssignmentExpression') {
            const transformed = this.transformAssignmentAsDeclaration(stmt.expression);
            if (transformed) {
              if (Array.isArray(transformed)) {
                declarations.push(...transformed);
              } else {
                declarations.push(transformed);
              }
            }
          }
          continue;
        }

        // Process class declarations
        if (stmt.type === 'ClassDeclaration') {
          const transformed = this.transformClassDeclaration(stmt);
          if (transformed) declarations.push(transformed);
          continue;
        }

        // Process function declarations
        if (stmt.type === 'FunctionDeclaration') {
          const transformed = this.transformFunctionDeclaration(stmt);
          if (transformed) declarations.push(transformed);
          continue;
        }

        // Process variable declarations (const/let/var)
        if (stmt.type === 'VariableDeclaration') {
          const transformed = this.transformTopLevelVariableDeclaration(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              declarations.push(...transformed);
            } else {
              declarations.push(transformed);
            }
          }
          continue;
        }

        // Skip if statements (usually feature detection)
        if (stmt.type === 'IfStatement') continue;
      }

      return declarations.length > 0 ? declarations : null;
    }

    /**
     * Transform an assignment expression that might be a class definition
     * e.g., const MyClass = class { ... }
     */
    transformAssignmentAsDeclaration(expr) {
      // Handle class expressions assigned to variables
      if (expr.right && expr.right.type === 'ClassExpression') {
        // Create a ClassDeclaration-like node
        const classNode = {
          type: 'ClassDeclaration',
          id: expr.left,
          body: expr.right.body,
          superClass: expr.right.superClass
        };
        return this.transformClassDeclaration(classNode);
      }
      return null;
    }

    transformTopLevelVariableDeclaration(node) {
      // Transform top-level const/let/var to Go const or var
      const declarations = [];

      for (const decl of node.declarations) {
        if (!decl.init) continue;

        const name = decl.id.name;

        // Skip AlgorithmFramework and OpCodes imports
        if (name === 'AlgorithmFramework' || name === 'OpCodes') continue;

        // Check if it's a constant (const with literal or Object.freeze)
        const isConst = node.kind === 'const' &&
          (decl.init.type === 'Literal' ||
           decl.init.type === 'ArrayExpression' ||
           (decl.init.type === 'CallExpression' &&
            decl.init.callee.type === 'MemberExpression' &&
            decl.init.callee.object.name === 'Object' &&
            decl.init.callee.property.name === 'freeze'));

        const value = this.transformExpression(decl.init);
        const type = this.inferFullExpressionType(decl.init);

        if (isConst) {
          const goConst = new GoConst(this.toPascalCase(name), type, value);
          declarations.push(goConst);
        } else {
          const goVar = new GoVar(this.toPascalCase(name), type, value);
          declarations.push(goVar);
        }
      }

      return declarations.length > 0 ? declarations : null;
    }

    /**
     * Transform any JavaScript AST node to Go AST
     */
    transformNode(node) {
      if (!node) return null;

      const methodName = `transform${node.type}`;
      if (typeof this[methodName] === 'function') {
        return this[methodName](node);
      }

      return null;
    }

    // ========================[ TYPE MAPPING ]========================

    mapType(typeName) {
      if (!typeName) return GoType.Interface();

      // Handle array types
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return GoType.Slice(elementType);
      }

      // Map basic types
      const mapped = TYPE_MAP[typeName.toLowerCase()];
      if (mapped) {
        if (mapped === '') return null; // void
        return new GoType(mapped);
      }

      return new GoType(typeName);
    }

    getInferredType(node) {
      // Try to infer type from value
      if (node.type === 'Literal') {
        if (typeof node.value === 'number') {
          return Number.isInteger(node.value) ? GoType.Int() : GoType.Float64();
        }
        if (typeof node.value === 'string') return GoType.String();
        if (typeof node.value === 'boolean') return GoType.Bool();
        if (node.value === null) return GoType.Interface();
      }

      if (node.type === 'ArrayExpression') {
        return GoType.Slice(GoType.Interface());
      }

      return GoType.Interface();
    }

    addImport(packagePath) {
      this.imports.add(packagePath);
    }

    // ========================[ DECLARATIONS ]========================

    transformClassDeclaration(node) {
      const struct = new GoStruct(this.toPascalCase(node.id.name));
      if (this.options.addComments) {
        struct.docComment = `${struct.name} represents the ${node.id.name} class`;
      }

      this.currentStruct = struct;

      // Handle both class body structures:
      // - Standard: {type: 'ClassBody', body: [...]}
      // - Unwrapped UMD: array directly
      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Constructor -> New function + extract fields
              const result = this.transformConstructor(member, struct.name);
              if (result) {
                // result contains: newFunc, fields, methods
                if (result.fields) {
                  struct.fields.push(...result.fields);
                }
                if (result.newFunc) {
                  struct.methods.push(result.newFunc);
                }
                if (result.methods) {
                  struct.methods.push(...result.methods);
                }
              }
            } else if (member.kind === 'method') {
              // Method -> receiver function
              const method = this.transformMethod(member, struct.name);
              if (method) {
                struct.methods.push(method);
              }
            }
          } else if (member.type === 'PropertyDefinition') {
            // Property -> field
            const field = this.transformProperty(member);
            if (field) {
              struct.fields.push(field);
            }
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> Go package-level init() function
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              struct.staticInitStatements = struct.staticInitStatements || [];
              struct.staticInitStatements.push(...initStatements);
            }
          }
        }
      }

      this.currentStruct = null;
      return struct;
    }

    transformConstructor(node, structName) {
      const func = new GoFunc(`New${structName}`);
      if (this.options.addComments) {
        func.docComment = `New${structName} creates a new ${structName} instance`;
      }

      // Add error return if errorHandling is enabled
      if (this.options.errorHandling) {
        func.results = [
          new GoParameter('', GoType.Pointer(new GoType(structName))),
          new GoParameter('', new GoType('error'))
        ];
      } else {
        func.results = [new GoParameter('', GoType.Pointer(new GoType(structName)))];
      }

      const body = new GoBlock();
      const fields = [];
      const methods = [];

      // Add constructor parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramType = this.inferParameterType(param, node.value.body);
          func.parameters.push(new GoParameter(param.name, paramType));
          this.variableTypes.set(param.name, paramType);
        }
      }

      // Create instance: result := &StructName{}
      const resultDecl = new GoVar('result', null, new GoUnaryExpression(
        '&',
        new GoCompositeLiteral(new GoType(structName), [])
      ));
      resultDecl.isShortDecl = true;
      body.statements.push(resultDecl);

      // Process constructor body - extract fields and methods from this.property assignments
      if (node.value && node.value.body && node.value.body.body) {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            const result = this.processThisAssignment(stmt, structName);
            if (result.isMethod) {
              methods.push(result.method);
            } else {
              fields.push(result.field);
              // Add initialization to constructor body
              if (result.initStatement) {
                body.statements.push(result.initStatement);
              }
            }
          } else {
            // Regular statement goes to constructor body
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                body.statements.push(...transformed);
              } else {
                body.statements.push(transformed);
              }
            }
          }
        }
      }

      // Return result (with nil error if errorHandling enabled)
      if (this.options.errorHandling) {
        body.statements.push(new GoReturn([
          new GoIdentifier('result'),
          GoLiteral.Nil()
        ]));
      } else {
        body.statements.push(new GoReturn([new GoIdentifier('result')]));
      }

      func.body = body;

      // Clear parameter types
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          this.variableTypes.delete(param.name);
        }
      }

      return { newFunc: func, fields, methods };
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
     * Process a this.property = value assignment
     * Returns {isMethod: boolean, field?: GoField, method?: GoFunc, initStatement?: GoNode}
     */
    processThisAssignment(stmt, structName) {
      const expr = stmt.expression;
      const propName = expr.left.property.name || expr.left.property.value;
      const pascalName = this.toPascalCase(propName);
      const value = expr.right;

      // Check if assigning a function (method)
      if (value.type === 'FunctionExpression' || value.type === 'ArrowFunctionExpression') {
        // This is a method definition
        const method = this.transformFunctionToMethod(propName, value, structName);
        return { isMethod: true, method };
      }

      // Field assignment
      let fieldType = this.inferFullExpressionType(value);

      // Create field
      const field = new GoField(pascalName, fieldType);

      // Create initialization statement: result.FieldName = value
      const resultIdent = new GoIdentifier('result');
      const fieldAccess = new GoSelectorExpression(resultIdent, pascalName);
      const initValue = this.transformExpression(value);
      const initStatement = new GoExpressionStatement(
        new GoAssignment([fieldAccess], '=', [initValue])
      );

      return { isMethod: false, field, initStatement };
    }

    /**
     * Transform a function expression to a method with receiver
     */
    transformFunctionToMethod(methodName, funcNode, structName) {
      const pascalName = this.toPascalCase(methodName);
      const func = new GoFunc(pascalName);

      // Set receiver name
      this.receiverName = this.toLowerFirst(structName)[0];

      // Add receiver (pointer receiver for methods that might modify state)
      func.receiver = new GoParameter(this.receiverName, GoType.Pointer(new GoType(structName)));

      // Transform parameters
      if (funcNode.params) {
        for (const param of funcNode.params) {
          const paramType = this.inferParameterType(param, funcNode.body);
          func.parameters.push(new GoParameter(param.name, paramType));
          this.variableTypes.set(param.name, paramType);
        }
      }

      // Determine return type
      func.results = this.inferFunctionReturnType(funcNode);

      // Transform body
      if (funcNode.body) {
        func.body = this.transformBlockStatement(funcNode.body);
      }

      // Clear parameter types
      if (funcNode.params) {
        for (const param of funcNode.params) {
          this.variableTypes.delete(param.name);
        }
      }

      return func;
    }

    transformMethod(node, structName) {
      const methodName = this.toPascalCase(node.key.name);
      const func = new GoFunc(methodName);

      // Set receiver name based on struct
      this.receiverName = this.toLowerFirst(structName)[0];

      // Add receiver (pointer receiver for methods that might modify state)
      func.receiver = new GoParameter(this.receiverName, GoType.Pointer(new GoType(structName)));

      // Transform parameters with type inference
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramType = this.inferParameterType(param, node.value.body);
          func.parameters.push(new GoParameter(param.name, paramType));

          // Register parameter type for body transformation
          this.variableTypes.set(param.name, paramType);
        }
      }

      // Determine return type
      func.results = this.inferFunctionReturnType(node.value);

      // Transform body
      if (node.value && node.value.body) {
        func.body = this.transformBlockStatement(node.value.body);
      }

      // Clear parameter types after transformation
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          this.variableTypes.delete(param.name);
        }
      }

      return func;
    }

    inferParameterType(param, bodyNode) {
      // Try to infer from usage in body
      const name = param.name;

      // Check for JSDoc type annotation
      if (param.typeAnnotation) {
        return this.mapType(param.typeAnnotation.type);
      }

      // Analyze usage patterns in body if useStrictTypes is enabled
      if (this.options.useStrictTypes && bodyNode && bodyNode.body) {
        for (const stmt of bodyNode.body) {
          // Look for array access: param[i]
          if (this.hasArrayAccess(stmt, name)) {
            return GoType.Slice(GoType.UInt8());
          }

          // Look for .length property access
          if (this.hasLengthAccess(stmt, name)) {
            return GoType.Slice(GoType.UInt8());
          }
        }
      }

      // Default based on strictness
      if (this.options.useStrictTypes) {
        // Use 'any' if generics enabled, otherwise interface{}
        return this.options.useGenerics ? new GoType('any') : GoType.Interface();
      }
      return GoType.Interface();
    }

    hasArrayAccess(node, varName) {
      if (!node) return false;

      if (node.type === 'MemberExpression' &&
          node.object.type === 'Identifier' &&
          node.object.name === varName &&
          node.computed) {
        return true;
      }

      // Recurse through node properties
      for (const key in node) {
        if (key === 'type' || key === 'loc') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(child => child && this.hasArrayAccess(child, varName))) {
            return true;
          }
        } else if (value && typeof value === 'object') {
          if (this.hasArrayAccess(value, varName)) {
            return true;
          }
        }
      }

      return false;
    }

    hasLengthAccess(node, varName) {
      if (!node) return false;

      if (node.type === 'MemberExpression' &&
          node.object.type === 'Identifier' &&
          node.object.name === varName &&
          node.property.name === 'length') {
        return true;
      }

      // Recurse
      for (const key in node) {
        if (key === 'type' || key === 'loc') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(child => child && this.hasLengthAccess(child, varName))) {
            return true;
          }
        } else if (value && typeof value === 'object') {
          if (this.hasLengthAccess(value, varName)) {
            return true;
          }
        }
      }

      return false;
    }

    transformProperty(node) {
      const field = new GoField(
        this.toPascalCase(node.key.name),
        this.getInferredType(node.value || {})
      );
      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Go package-level init() function
      // Go doesn't have static class blocks, so transform to statements
      // that will be placed in an init() function
      return node.body.map(stmt => this.transformStatement(stmt));
    }

    transformFunctionDeclaration(node) {
      const func = new GoFunc(this.toPascalCase(node.id.name));
      if (this.options.addComments) {
        func.docComment = `${func.name} ${node.id.name} function`;
      }

      this.currentFunc = func;

      // Add context.Context as first parameter if useContext is enabled
      if (this.options.useContext) {
        this.addImport('context');
        func.parameters.push(new GoParameter('ctx', new GoType('context.Context')));
      }

      // Transform parameters
      if (node.params) {
        for (const param of node.params) {
          func.parameters.push(this.transformParameter(param));
        }
      }

      // Determine return type (with error if errorHandling enabled)
      func.results = this.inferFunctionReturnType(node);
      if (this.options.errorHandling && func.results.length > 0) {
        func.results.push(new GoParameter('', new GoType('error')));
      }

      // Transform body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      this.currentFunc = null;
      return func;
    }

    transformParameter(param) {
      const name = param.name || 'param';
      let type = GoType.Interface();

      // Try to get type from JSDoc or annotations
      if (param.typeAnnotation) {
        type = this.mapType(param.typeAnnotation.type);
      }

      return new GoParameter(name, type);
    }

    inferFunctionReturnType(funcNode) {
      // Check for explicit return type annotation
      if (funcNode.returnType) {
        const type = this.mapType(funcNode.returnType);
        return type ? [new GoParameter('', type)] : [];
      }

      // Analyze return statements
      const returns = this.findReturnStatements(funcNode.body);
      if (returns.length === 0) {
        return []; // void
      }

      // Use first return to infer type
      if (returns[0].argument) {
        const type = this.getInferredType(returns[0].argument);
        return [new GoParameter('', type)];
      }

      return [];
    }

    findReturnStatements(node, acc = []) {
      if (!node) return acc;

      if (node.type === 'ReturnStatement') {
        acc.push(node);
        return acc;
      }

      // Recurse
      if (node.body) {
        if (Array.isArray(node.body)) {
          for (const child of node.body) {
            this.findReturnStatements(child, acc);
          }
        } else {
          this.findReturnStatements(node.body, acc);
        }
      }

      return acc;
    }

    transformVariableDeclaration(node) {
      const vars = [];

      for (const declarator of node.declarations) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (declarator.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (declarator.id.type === 'ArrayPattern') {
          const sourceExpr = declarator.init ? this.transformExpression(declarator.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < declarator.id.elements.length; ++i) {
              const elem = declarator.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = elem.name;
              const indexExpr = new GoIndexExpression(sourceExpr, GoLiteral.Int(i));
              const goVar = new GoVar(varName, null, indexExpr);
              goVar.isShortDecl = true; // Use :=
              vars.push(goVar);
            }
          }
          continue;
        }

        const name = declarator.id.name;
        let type = null;
        let init = null;

        if (declarator.init) {
          // Check if this is an IIFE (immediately invoked function expression)
          if (declarator.init.type === 'CallExpression' &&
              (declarator.init.callee.type === 'FunctionExpression' ||
               declarator.init.callee.type === 'ArrowFunctionExpression')) {
            // Extract return value from IIFE
            const returnValue = this.getIIFEReturnValue(declarator.init);
            if (returnValue) {
              init = this.transformExpression(returnValue);
              type = this.getInferredType(returnValue);
            }
          } else {
            init = this.transformExpression(declarator.init);
            type = this.getInferredType(declarator.init);
          }
        }

        const goVar = new GoVar(name, type, init);
        goVar.isShortDecl = !!init; // Use := if initialized
        vars.push(goVar);
      }

      return vars;
    }

    // ========================[ STATEMENTS ]========================

    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'BlockStatement':
          return this.transformBlockStatement(node);
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
        case 'BreakStatement':
          return new GoBreak();
        case 'ContinueStatement':
          return new GoContinue();
        case 'ExpressionStatement':
          return new GoExpressionStatement(this.transformExpression(node.expression));
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node);
        case 'EmptyStatement':
          return null;
        default:
          console.warn(`Unhandled statement type: ${node.type}`);
          return null;
      }
    }

    transformDoWhileStatement(node) {
      // Go doesn't have do-while, convert to: for { body; if !condition { break } }
      const body = this.transformStatement(node.body) || new GoBlock();
      const condition = this.transformExpression(node.test);

      const forLoop = new GoFor();
      const forBody = body instanceof GoBlock ? body : new GoBlock();

      // Add break if condition is false
      const notCondition = new GoUnaryExpression('!', condition);
      const breakIf = new GoIf(notCondition, new GoBlock(), null);
      breakIf.thenBranch.statements.push(new GoBreak());
      forBody.statements.push(breakIf);

      forLoop.body = forBody;
      return forLoop;
    }

    transformTryStatement(node) {
      // Go doesn't have try-catch, use defer/recover pattern
      // For now, just transform the block and add error handling comments
      const block = this.transformBlockStatement(node.block);

      // Add comment about error handling
      const commented = new GoBlock();
      commented.statements.push(new GoExpressionStatement(
        new GoIdentifier('// TODO: Add error handling for try-catch')
      ));
      commented.statements.push(...block.statements);

      if (node.handler) {
        commented.statements.push(new GoExpressionStatement(
          new GoIdentifier(`// Catch block: ${node.handler.param?.name || 'err'}`)
        ));
        const catchBlock = this.transformBlockStatement(node.handler.body);
        commented.statements.push(...catchBlock.statements);
      }

      return commented;
    }

    transformThrowStatement(node) {
      // Go uses panic instead of throw
      this.addImport('fmt');
      const arg = node.argument ? this.transformExpression(node.argument) : GoLiteral.String('error');
      return new GoExpressionStatement(
        new GoCallExpression(new GoIdentifier('panic'), [arg])
      );
    }

    transformBlockStatement(node) {
      const block = new GoBlock();

      if (node.body) {
        for (const stmt of node.body) {
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              block.statements.push(...transformed);
            } else {
              block.statements.push(transformed);
            }
          }
        }
      }

      return block;
    }

    transformReturnStatement(node) {
      const results = node.argument ? [this.transformExpression(node.argument)] : [];
      return new GoReturn(results);
    }

    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new GoBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      return new GoIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forLoop = new GoFor();

      if (node.init) {
        const init = this.transformStatement(node.init);
        // If init is an array of variable declarations, take the first one
        forLoop.init = Array.isArray(init) ? init[0] : init;
      }

      if (node.test) {
        forLoop.condition = this.transformExpression(node.test);
      }

      if (node.update) {
        forLoop.post = new GoExpressionStatement(this.transformExpression(node.update));
      }

      forLoop.body = this.transformStatement(node.body) || new GoBlock();

      return forLoop;
    }

    transformWhileStatement(node) {
      const forLoop = new GoFor();
      forLoop.condition = this.transformExpression(node.test);
      forLoop.body = this.transformStatement(node.body) || new GoBlock();
      return forLoop;
    }

    /**
     * Transform for-of statement: for (const x of array) { ... }
     * Go equivalent: for _, x := range array { ... }
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = decl.id.name;
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the iterable and body
      const iterable = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new GoBlock();

      // Go range loop: for _, varName := range iterable { body }
      const forLoop = new GoFor();
      forLoop.isRange = true;
      forLoop.rangeKey = '_';
      forLoop.rangeValue = varName;
      forLoop.rangeExpr = iterable;
      forLoop.body = body;

      return forLoop;
    }

    /**
     * Transform for-in statement: for (const key in object) { ... }
     * Go equivalent: for key := range object { ... }
     */
    transformForInStatement(node) {
      // Extract variable name from left side
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = decl.id.name;
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the object and body
      const object = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new GoBlock();

      // Go range loop: for key := range object { body }
      const forLoop = new GoFor();
      forLoop.isRange = true;
      forLoop.rangeKey = varName;
      forLoop.rangeValue = null; // Only key for for-in
      forLoop.rangeExpr = object;
      forLoop.body = body;

      return forLoop;
    }

    transformSwitchStatement(node) {
      const switchStmt = new GoSwitch(this.transformExpression(node.discriminant));

      for (const caseNode of node.cases) {
        const goCase = new GoCase(
          caseNode.test ? [this.transformExpression(caseNode.test)] : []
        );

        for (const stmt of caseNode.consequent) {
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              goCase.statements.push(...transformed);
            } else {
              goCase.statements.push(transformed);
            }
          }
        }

        switchStmt.cases.push(goCase);
      }

      return switchStmt;
    }

    // ========================[ EXPRESSIONS ]========================

    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);
        case 'Identifier':
          return this.transformIdentifier(node);
        case 'BinaryExpression':
          return this.transformBinaryExpression(node);
        case 'LogicalExpression':
          return this.transformLogicalExpression(node);
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);
        case 'MemberExpression':
          return this.transformMemberExpression(node);
        case 'CallExpression':
          return this.transformCallExpression(node);
        case 'ArrayExpression':
          return this.transformArrayExpression(node);
        case 'ObjectExpression':
          return this.transformObjectExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'NewExpression':
          return this.transformNewExpression(node);
        case 'ThisExpression':
          return new GoIdentifier(this.receiverName);
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
          return this.transformFunctionExpression(node);
        case 'SequenceExpression':
          // a, b, c -> only return last value
          return this.transformExpression(node.expressions[node.expressions.length - 1]);
        case 'SpreadElement':
          // ...array -> array... in Go (variadic)
          return this.transformSpreadElement(node);
        case 'Super':
          // super -> embedded struct access (Go doesn't have inheritance)
          return this.transformSuper(node);
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);
        case 'ObjectPattern':
          // Object destructuring - Go doesn't support this directly
          // Return a comment placeholder
          return new GoIdentifier('/* Object destructuring not supported in Go */');
        default:
          console.warn(`Unhandled expression type: ${node.type}`);
          return new GoIdentifier('nil');
      }
    }

    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Go equivalents
      if (name === 'undefined' || name === 'null') return GoLiteral.Nil();
      if (name === 'NaN') {
        this.addImport('math');
        return new GoSelectorExpression(new GoIdentifier('math'), 'NaN');
      }
      if (name === 'Infinity') {
        this.addImport('math');
        return new GoSelectorExpression(new GoIdentifier('math'), 'Inf');
      }

      // Escape Go reserved keywords
      const reserved = ['type', 'func', 'interface', 'struct', 'map', 'range', 'defer', 'go', 'chan', 'select', 'fallthrough', 'default', 'case'];
      if (reserved.includes(name)) {
        name = name + '_';
      }

      return new GoIdentifier(name);
    }

    transformFunctionExpression(node) {
      // Transform to anonymous function
      const params = [];
      if (node.params) {
        for (const param of node.params) {
          const paramType = GoType.Interface();
          params.push(new GoParameter(param.name, paramType));
        }
      }

      const results = this.inferFunctionReturnType(node);
      const body = this.transformBlockStatement(node.body);

      return new GoFuncLit(params, results, body);
    }

    transformLogicalExpression(node) {
      // LogicalExpression is separate from BinaryExpression in some parsers
      return this.transformBinaryExpression(node);
    }

    transformLiteral(node) {
      if (typeof node.value === 'number') {
        return Number.isInteger(node.value)
          ? GoLiteral.Int(node.value)
          : GoLiteral.Float64(node.value);
      }
      if (typeof node.value === 'string') {
        return GoLiteral.String(node.value);
      }
      if (typeof node.value === 'boolean') {
        return GoLiteral.Bool(node.value);
      }
      if (node.value === null) {
        return GoLiteral.Nil();
      }

      return GoLiteral.Nil();
    }

    transformBinaryExpression(node) {
      let operator = node.operator;

      // Map JavaScript operators to Go operators
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle >>> (unsigned right shift) - Go doesn't have it directly
      if (operator === '>>>') {
        // In Go, use regular >> on uint32
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);

        // Cast to uint32, shift, result is uint32
        const leftCasted = new GoTypeConversion(GoType.UInt32(), left);
        return new GoBinaryExpression(leftCasted, '>>', right);
      }

      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new GoBinaryExpression(left, operator, right);
    }

    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new GoUnaryExpression(node.operator, operand);
    }

    transformUpdateExpression(node) {
      // ++i or i++
      const operand = this.transformExpression(node.argument);
      const one = GoLiteral.Int(1);

      if (node.operator === '++') {
        return new GoAssignment([operand], '+=', [one]);
      } else {
        return new GoAssignment([operand], '-=', [one]);
      }
    }

    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);
      const value = this.transformExpression(node.right);
      return new GoAssignment([target], node.operator, [value]);
    }

    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // array[index]
        const index = this.transformExpression(node.property);
        return new GoIndexExpression(object, index);
      } else {
        // object.field
        const field = node.property.name || node.property.value;

        // Handle special properties
        if (field === 'length')
          return new GoCallExpression(new GoIdentifier('len'), [object]);

        return new GoSelectorExpression(object, this.toPascalCase(field));
      }
    }

    transformCallExpression(node) {
      // Handle OpCodes calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle Object methods (JavaScript built-ins)
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Object') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Object.freeze(x) -> x (Go doesn't have freeze)
        if (method === 'freeze' && args.length === 1)
          return args[0];
        // Object.keys(obj) -> getKeys(obj) - needs helper
        if (method === 'keys' && args.length === 1)
          return new GoCallExpression(new GoIdentifier('getKeys'), args);
        // Object.values(obj) -> getValues(obj)
        if (method === 'values' && args.length === 1)
          return new GoCallExpression(new GoIdentifier('getValues'), args);
        // Object.entries(obj) -> getEntries(obj)
        if (method === 'entries' && args.length === 1)
          return new GoCallExpression(new GoIdentifier('getEntries'), args);
        // Object.assign -> return target
        if (method === 'assign' && args.length >= 1)
          return args[0];
      }

      // Handle special methods
      if (node.callee.type === 'MemberExpression') {
        return this.transformMethodCall(node);
      }

      // Regular function call
      const func = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));
      return new GoCallExpression(func, args);
    }

    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Use crypto packages if useCrypto is enabled
      const useStdlib = this.options.useCrypto;

      // Map OpCodes methods to Go equivalents
      switch (methodName) {
        case 'Pack32LE':
          if (useStdlib) {
            this.addImport('encoding/binary');
            // binary.LittleEndian.PutUint32(buf, value)
            return new GoCallExpression(
              new GoSelectorExpression(
                new GoSelectorExpression(new GoIdentifier('binary'), 'LittleEndian'),
                'Uint32'
              ),
              args
            );
          }
          break;

        case 'Pack32BE':
          if (useStdlib) {
            this.addImport('encoding/binary');
            return new GoCallExpression(
              new GoSelectorExpression(
                new GoSelectorExpression(new GoIdentifier('binary'), 'BigEndian'),
                'Uint32'
              ),
              args
            );
          }
          break;

        case 'Unpack32LE':
          if (useStdlib) {
            this.addImport('encoding/binary');
            return new GoCallExpression(
              new GoSelectorExpression(
                new GoSelectorExpression(new GoIdentifier('binary'), 'LittleEndian'),
                'Uint32'
              ),
              args
            );
          }
          break;

        case 'Unpack32BE':
          if (useStdlib) {
            this.addImport('encoding/binary');
            return new GoCallExpression(
              new GoSelectorExpression(
                new GoSelectorExpression(new GoIdentifier('binary'), 'BigEndian'),
                'Uint32'
              ),
              args
            );
          }
          break;

        case 'RotL32':
          if (useStdlib) {
            this.addImport('math/bits');
            // bits.RotateLeft32(value, shift)
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('bits'), 'RotateLeft32'),
              args
            );
          }
          break;

        case 'RotR32':
          if (useStdlib) {
            this.addImport('math/bits');
            // bits.RotateLeft32(value, -shift)
            const negShift = new GoUnaryExpression('-', args[1]);
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('bits'), 'RotateLeft32'),
              [args[0], negShift]
            );
          }
          break;

        case 'RotL8':
          if (useStdlib) {
            this.addImport('math/bits');
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('bits'), 'RotateLeft8'),
              args
            );
          }
          break;

        case 'RotR8':
          if (useStdlib) {
            this.addImport('math/bits');
            const negShift8 = new GoUnaryExpression('-', args[1]);
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('bits'), 'RotateLeft8'),
              [args[0], negShift8]
            );
          }
          break;

        case 'Hex8ToBytes':
          if (useStdlib) {
            this.addImport('encoding/hex');
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('hex'), 'DecodeString'),
              args
            );
          }
          break;

        case 'BytesToHex8':
          if (useStdlib) {
            this.addImport('encoding/hex');
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('hex'), 'EncodeToString'),
              args
            );
          }
          break;

        case 'XorArrays':
          // Manual XOR loop in Go (no stdlib equivalent)
          return new GoCallExpression(
            new GoIdentifier('XorArrays'), // Helper function needed
            args
          );

        case 'ClearArray':
          // for i := range arr { arr[i] = 0 }
          return new GoCallExpression(
            new GoIdentifier('ClearArray'), // Helper function needed
            args
          );

        case 'AnsiToBytes':
          // []byte(string)
          return new GoTypeConversion(
            GoType.Slice(GoType.UInt8()),
            args[0]
          );

        default:
          // Unknown OpCodes method - fallback to custom implementation
          break;
      }

      // If useCrypto is false or method not in stdlib, use custom implementation
      return new GoCallExpression(
        new GoIdentifier(methodName),
        args
      );
    }

    transformMethodCall(node) {
      const object = this.transformExpression(node.callee.object);
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map common methods
      switch (methodName) {
        case 'push':
          // arr = append(arr, item)
          return new GoAssignment(
            [object],
            '=',
            [new GoCallExpression(new GoIdentifier('append'), [object, ...args])]
          );

        case 'length':
          return new GoCallExpression(new GoIdentifier('len'), [object]);

        case 'toString':
          this.addImport('fmt');
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('fmt'), 'Sprintf'),
            [GoLiteral.String('%v'), object]
          );

        default:
          return new GoCallExpression(
            new GoSelectorExpression(object, this.toPascalCase(methodName)),
            args
          );
      }
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => this.transformExpression(el));
      return new GoCompositeLiteral(GoType.Slice(GoType.Interface()), elements);
    }

    transformObjectExpression(node) {
      const kvPairs = [];
      for (const prop of node.properties) {
        // Skip spread elements - Go doesn't have direct equivalent
        if (prop.type === 'SpreadElement' || !prop.key) continue;
        const key = prop.key.name || prop.key.value || 'unknown';
        const value = this.transformExpression(prop.value);
        kvPairs.push(new GoKeyValue(GoLiteral.String(key), value));
      }

      return new GoCompositeLiteral(
        GoType.Map(GoType.String(), GoType.Interface()),
        kvPairs
      );
    }

    transformConditionalExpression(node) {
      // Go doesn't have ternary operator - use an if expression
      // For now, create inline function
      const condition = this.transformExpression(node.test);
      const consequent = this.transformExpression(node.consequent);
      const alternate = this.transformExpression(node.alternate);

      // func() T { if cond { return a }; return b }()
      const funcBody = new GoBlock();
      const ifStmt = new GoIf(condition, new GoBlock(), new GoBlock());
      ifStmt.thenBranch.statements.push(new GoReturn([consequent]));
      funcBody.statements.push(ifStmt);
      funcBody.statements.push(new GoReturn([alternate]));

      const funcLit = new GoFuncLit([], [new GoParameter('', GoType.Interface())], funcBody);
      return new GoCallExpression(funcLit, []);
    }

    transformNewExpression(node) {
      // new Type() -> &Type{} or make(...)
      const typeName = node.callee.name;

      // Map TypedArrays to Go slices
      const typedArrayMap = {
        'Uint8Array': GoType.UInt8(),
        'Uint16Array': GoType.UInt16(),
        'Uint32Array': GoType.UInt32(),
        'Int8Array': GoType.Int8(),
        'Int16Array': GoType.Int16(),
        'Int32Array': GoType.Int32(),
        'Float32Array': GoType.Float32(),
        'Float64Array': GoType.Float64()
      };

      if (typedArrayMap[typeName]) {
        const hasArrayInit = node.arguments.length > 0 &&
          node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // new Uint8Array([1, 2, 3]) -> []byte{1, 2, 3}
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new GoCompositeLiteral(GoType.Slice(typedArrayMap[typeName]), elements);
        }

        // new Uint8Array(n) -> make([]byte, n)
        const size = node.arguments[0] ? this.transformExpression(node.arguments[0]) : GoLiteral.Int(0);
        return new GoMake(GoType.Slice(typedArrayMap[typeName]), size);
      }

      if (typeName === 'Array') {
        // new Array(size) -> make([]interface{}, size)
        const size = node.arguments[0] ? this.transformExpression(node.arguments[0]) : GoLiteral.Int(0);
        return new GoMake(GoType.Slice(GoType.Interface()), size);
      }

      // Default: create pointer to struct
      return new GoUnaryExpression('&', new GoCompositeLiteral(new GoType(typeName), []));
    }

    /**
     * Transform spread element: ...array -> array...
     * Go variadic syntax
     */
    transformSpreadElement(node) {
      const argument = this.transformExpression(node.argument);
      // In Go, variadic expansion is done with "..."
      // This creates a special node that emitter will handle
      const spread = new GoUnaryExpression('...', argument);
      spread.isPostfix = true; // The ... comes after the argument in Go
      return spread;
    }

    /**
     * Transform super expression
     * Go doesn't have inheritance, but we can use embedded structs
     */
    transformSuper(node) {
      // If we're in a struct with a base class, access the embedded struct
      if (this.currentStruct && this.currentStruct.baseClass) {
        return new GoSelectorExpression(
          new GoIdentifier(this.receiverName),
          this.toPascalCase(this.currentStruct.baseClass)
        );
      }
      // Fallback - just use receiver
      return new GoIdentifier(this.receiverName);
    }

    /**
     * Transform template literal: `Hello ${name}!` -> fmt.Sprintf("Hello %v!", name)
     */
    transformTemplateLiteral(node) {
      this.addImport('fmt');

      let formatStr = '';
      const args = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        formatStr += node.quasis[i].value.raw.replace(/%/g, '%%'); // Escape %
        if (i < node.expressions.length) {
          formatStr += '%v';
          args.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new GoCallExpression(
        new GoSelectorExpression(new GoIdentifier('fmt'), 'Sprintf'),
        [GoLiteral.String(formatStr), ...args]
      );
    }

    // ========================[ UTILITIES ]========================

    toPascalCase(str) {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    toLowerFirst(str) {
      if (!str) return str;
      return str.charAt(0).toLowerCase() + str.slice(1);
    }

    /**
     * Get the return value from an IIFE if it has one
     */
    getIIFEReturnValue(callNode) {
      const func = callNode.callee;
      if (!func.body || func.body.type !== 'BlockStatement') {
        // Arrow function with expression body - the body IS the return value
        if (func.body) return func.body;
        return null;
      }

      // Look for a return statement at the end of the function body
      const body = func.body.body;
      if (!body || body.length === 0) return null;

      const lastStmt = body[body.length - 1];
      if (lastStmt.type === 'ReturnStatement' && lastStmt.argument)
        return lastStmt.argument;

      return null;
    }
  }

  // Export
  const exports = { GoTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.GoTransformer = GoTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
