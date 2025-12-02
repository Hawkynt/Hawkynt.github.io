/**
 * RustTransformer.js - JavaScript AST to Rust AST Transformer
 * Converts type-annotated JavaScript AST to Rust AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Rust AST -> Rust Emitter -> Rust Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let RustAST;
  if (typeof require !== 'undefined') {
    RustAST = require('./RustAST.js');
  } else if (global.RustAST) {
    RustAST = global.RustAST;
  }

  const {
    RustType, RustModule, RustUseDeclaration, RustAttribute,
    RustStruct, RustStructField, RustEnum, RustEnumVariant, RustImpl,
    RustFunction, RustParameter, RustBlock, RustLet, RustExpressionStatement,
    RustReturn, RustIf, RustFor, RustWhile, RustLoop, RustMatch, RustMatchArm,
    RustBreak, RustContinue, RustLiteral, RustIdentifier, RustBinaryExpression,
    RustUnaryExpression, RustAssignment, RustFieldAccess, RustIndex,
    RustMethodCall, RustCall, RustStructLiteral, RustArrayLiteral, RustVecMacro,
    RustCast, RustReference, RustDereference, RustRange, RustTuple, RustClosure,
    RustMacroCall, RustIfExpression, RustBlockExpression, RustDocComment, RustConst
  } = RustAST;

  /**
   * Maps JavaScript/JSDoc types to Rust types
   */
  const TYPE_MAP = {
    // Unsigned integers
    'uint8': 'u8', 'byte': 'u8',
    'uint16': 'u16', 'ushort': 'u16', 'word': 'u16',
    'uint32': 'u32', 'uint': 'u32', 'dword': 'u32',
    'uint64': 'u64', 'ulong': 'u64', 'qword': 'u64',
    // Signed integers
    'int8': 'i8', 'sbyte': 'i8',
    'int16': 'i16', 'short': 'i16',
    'int32': 'i32', 'int': 'i32',
    'int64': 'i64', 'long': 'i64',
    // Floating point
    'float': 'f32', 'float32': 'f32',
    'double': 'f64', 'float64': 'f64',
    // In crypto context, JavaScript 'number' typically means u32 (for bit operations)
    'number': 'u32',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'String', 'String': 'String',
    'void': '()',
    'object': 'HashMap<String, u32>',
    'Array': 'Vec'
  };

  /**
   * JavaScript AST to Rust AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Add doc comments (///). Default: true
   * - useStrictTypes: boolean - Use strict type annotations. Default: true
   * - errorHandling: boolean - Use Result<T, E> for error handling. Default: true
   * - edition: string - Rust edition ('2015', '2018', '2021'). Default: '2021'
   * - useOwnership: boolean - Use proper Rust ownership patterns. Default: true
   * - useTraits: boolean - Generate trait implementations. Default: true
   * - useGenerics: boolean - Use generic types where appropriate. Default: true
   * - useZeroCopy: boolean - Prefer &[u8] over Vec<u8> for read-only data. Default: true
   * - useSIMD: boolean - Enable SIMD optimizations. Default: false
   * - noStd: boolean - Generate code for no_std environments. Default: false
   */
  class RustTransformer {
    constructor(options = {}) {
      this.options = options;
      this.currentStruct = null;
      this.currentImpl = null;
      this.variableTypes = new Map();  // Maps variable name -> RustType
      this.structFieldTypes = new Map(); // Maps field name -> RustType
      this.nestedStructs = [];
      this.scopeStack = [];
    }

    /**
     * Convert name to snake_case (Rust convention for variables/functions)
     */
    toSnakeCase(str) {
      if (!str) return str;
      // Ensure str is a string
      if (typeof str !== 'string') {
        str = String(str);
      }
      return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }

    /**
     * Convert name to PascalCase (Rust convention for types)
     */
    toPascalCase(str) {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (Rust convention for constants)
     */
    toScreamingSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string')
        str = String(str);
      return str
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .replace(/^_/, '');
    }

    /**
     * Map JavaScript type string to Rust type
     */
    mapType(typeName) {
      if (!typeName) return RustType.U32();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        // Use &[T] for zero-copy (read-only), otherwise Vec<T> for owned data
        if (this.options.useZeroCopy) {
          return RustType.Slice(elementType); // &[T] for zero-copy
        } else {
          return RustType.Vec(elementType); // Vec<T> for owned data
        }
      }

      const rustTypeName = TYPE_MAP[typeName] || typeName;

      // Map to Rust types
      const typeMap = {
        'u8': RustType.U8(),
        'u16': RustType.U16(),
        'u32': RustType.U32(),
        'u64': RustType.U64(),
        'i8': RustType.I8(),
        'i16': RustType.I16(),
        'i32': RustType.I32(),
        'i64': RustType.I64(),
        'f32': RustType.F32(),
        'f64': RustType.F64(),
        'bool': RustType.Bool(),
        'String': RustType.String(),
        '()': RustType.Unit()
      };

      return typeMap[rustTypeName] || new RustType(rustTypeName);
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
     * Push a new scope for nested functions
     */
    pushScope() {
      this.scopeStack.push(new Map(this.variableTypes));
    }

    /**
     * Pop scope when leaving nested function
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.variableTypes = this.scopeStack.pop();
      }
    }

    /**
     * Infer Rust type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return RustType.U32();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return RustType.U8();
      }

      // Array-related names (use slices for crypto data if useZeroCopy is enabled)
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        if (this.options.useZeroCopy) {
          return RustType.Slice(RustType.U8()); // &[u8] for zero-copy
        } else {
          return RustType.Vec(RustType.U8()); // Vec<u8> for owned data
        }
      }

      // Integer-related names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return RustType.Usize();
      }

      // Default to u32 for crypto operations
      return RustType.U32();
    }

    /**
     * Transform a JavaScript AST to a Rust AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {RustModule} Rust AST
     */
    transform(jsAst) {
      const module = new RustModule();

      // Add #![no_std] attribute if noStd option is enabled
      if (this.options.noStd) {
        module.attributes.push(new RustAttribute('no_std', [], false)); // false = inner attribute
      }

      // Standard uses for crypto code (skip if noStd is enabled)
      if (!this.options.noStd) {
        module.uses.push(new RustUseDeclaration('std::collections', ['HashMap']));
      }

      // Add module doc comment (respect addComments option)
      if (this.options.addComments !== false) {
        const edition = this.options.edition || '2021';
        const docComment = new RustDocComment(
          `Generated Rust code (Edition ${edition})\nThis file was automatically generated from JavaScript AST`,
          false  // inner doc comment
        );
        module.attributes.push(docComment);
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      // Add nested structs
      for (const nested of this.nestedStructs) {
        module.items.push(nested);
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
            // UMD pattern: (function(root, factory) { ... })(...)
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              // Extract and process IIFE body content
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
     * Handles multiple patterns:
     * - Simple: (function(global) { ... })(globalThis)
     * - UMD: (function(root, factory) { ... })((function(){...})(), function(deps) { ... })
     */
    transformIIFEContent(calleeNode, callExpr, targetModule) {
      let bodyStatements = [];

      // First, try to find the factory function in UMD pattern
      // UMD pattern: the second argument is usually the factory function
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          // Found UMD factory function - extract from its body
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
        if (stmt.type === 'ExpressionStatement') {
          continue;
        }

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

        // Process variable declarations (const/let/var)
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

        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new RustIndexExpression(sourceExpr, RustLiteral.Usize(i));
              const constDecl = new RustConst(
                node.kind === 'const' ? this.toScreamingSnakeCase(elem.name) : varName,
                new RustType('_'), // Type inference
                indexExpr
              );
              targetModule.items.push(constDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check if this is an object literal defining a module/struct
        if (decl.init.type === 'ObjectExpression') {
          const struct = this.transformObjectToStruct(name, decl.init);
          if (struct) {
            targetModule.items.push(struct);
          }
        }
        // Check if this is an IIFE (immediately invoked function expression)
        else if (decl.init.type === 'CallExpression' &&
                 (decl.init.callee.type === 'FunctionExpression' ||
                  decl.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(decl.init);
          if (returnValue) {
            const constDecl = new RustConst(
              this.toScreamingSnakeCase(name),
              this.inferTypeFromValue(returnValue),
              this.transformExpression(returnValue)
            );
            targetModule.items.push(constDecl);
          }
        }
        // Handle simple literals and expressions as static constants
        else if (decl.init.type === 'Literal' ||
                 decl.init.type === 'ArrayExpression' ||
                 decl.init.type === 'UnaryExpression' ||
                 decl.init.type === 'BinaryExpression' ||
                 decl.init.type === 'NewExpression') {
          const constDecl = new RustConst(
            this.toScreamingSnakeCase(name),
            this.inferTypeFromValue(decl.init),
            this.transformExpression(decl.init)
          );
          targetModule.items.push(constDecl);
        }
      }
    }

    /**
     * Transform an object literal to a Rust struct
     */
    transformObjectToStruct(name, objNode) {
      const struct = new RustStruct(this.toPascalCase(name));
      struct.attributes.push(new RustAttribute('derive', ['Debug', 'Clone']));

      // Create impl block for methods
      const impl = new RustImpl(struct.name);

      const prevStruct = this.currentStruct;
      const prevImpl = this.currentImpl;
      this.currentStruct = struct;
      this.currentImpl = impl;

      for (const prop of objNode.properties) {
        const propName = prop.key.name || prop.key.value;
        const propValue = prop.value;

        if (prop.method || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          // Method
          const method = this.transformFunctionToMethod(propName, propValue);
          impl.methods.push(method);
        } else {
          // Field
          const field = this.transformToField(propName, propValue);
          struct.fields.push(field);
        }
      }

      this.currentStruct = prevStruct;
      this.currentImpl = prevImpl;

      // Add impl block if it has methods
      if (impl.methods.length > 0) {
        this.nestedStructs.push(impl);
      }

      return struct;
    }

    /**
     * Transform a field
     */
    transformToField(name, valueNode) {
      const fieldName = this.toSnakeCase(name);
      const fieldType = this.inferTypeFromValue(valueNode);

      const field = new RustStructField(fieldName, fieldType);
      this.structFieldTypes.set(fieldName, fieldType);

      return field;
    }

    /**
     * Infer Rust type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return RustType.U32();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              return valueNode.value >= 0 ? RustType.U32() : RustType.I32();
            }
            return RustType.F64();
          }
          if (typeof valueNode.value === 'string') return RustType.Str();
          if (typeof valueNode.value === 'boolean') return RustType.Bool();
          return RustType.U32();

        case 'ArrayExpression':
          if (valueNode.elements.length > 0) {
            const elemType = this.inferTypeFromValue(valueNode.elements[0]);
            // Always use Vec for array literals (they are owned values)
            // useZeroCopy only affects parameter types and variable inference
            return RustType.Vec(elemType);
          }
          return RustType.Vec(RustType.U8());

        default:
          return RustType.U32();
      }
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetModule) {
      const funcName = this.toSnakeCase(node.id.name);
      const func = new RustFunction(funcName);

      // Infer return type (default to unit)
      func.returnType = RustType.Unit();

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rustParam = new RustParameter(paramName, paramType);
          func.parameters.push(rustParam);

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
      const method = new RustFunction(methodName);

      // Add &self parameter for instance methods
      method.isSelfMethod = true;
      method.selfParameter = '&self';

      // Infer return type
      method.returnType = RustType.Unit();

      // Parameters (excluding self)
      if (funcNode.params) {
        for (const param of funcNode.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rustParam = new RustParameter(paramName, paramType);
          method.parameters.push(rustParam);

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
     * Transform a class declaration to a Rust struct
     */
    transformClassDeclaration(node, targetModule) {
      const className = this.toPascalCase(node.id.name);
      const struct = new RustStruct(className);
      struct.attributes.push(new RustAttribute('derive', ['Debug', 'Clone']));

      const impl = new RustImpl(className);

      const prevStruct = this.currentStruct;
      const prevImpl = this.currentImpl;
      this.currentStruct = struct;
      this.currentImpl = impl;

      // Handle both class body structures:
      // - Standard: {type: 'ClassBody', body: [...]}
      // - Unwrapped UMD: array directly
      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Constructor: extract fields from this.x = y assignments
              const { fields, initStatements } = this.extractFieldsFromConstructor(member);

              // Add fields to struct
              for (const field of fields) {
                struct.fields.push(field);
              }

              // Create 'new' method from constructor
              const ctor = this.transformConstructor(member, initStatements);
              impl.methods.push(ctor);
            } else {
              // Regular method
              const method = this.transformMethodDefinition(member);
              impl.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Field
            const field = this.transformPropertyDefinition(member);
            struct.fields.push(field);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> Rust doesn't have static class blocks
            // Transform to module-level statements or lazy_static
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              struct.staticInitStatements = struct.staticInitStatements || [];
              struct.staticInitStatements.push(...initStatements);
            }
          }
        }
      }

      this.currentStruct = prevStruct;
      this.currentImpl = prevImpl;

      targetModule.items.push(struct);
      if (impl.methods.length > 0) {
        targetModule.items.push(impl);
      }
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
          const isPrivate = propName.startsWith('_');

          // Convert field name to snake_case, removing leading underscore
          let fieldName = this.toSnakeCase(propName);
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          const value = expr.right;

          // Infer field type from value
          let fieldType = this.inferTypeFromValue(value);

          // Special handling for null initializations - use Option<T>
          if (value.type === 'Literal' && value.value === null) {
            const lowerName = propName.toLowerCase();
            if (lowerName.includes('buffer') || lowerName.includes('data') || lowerName.includes('block'))
              fieldType = RustType.Option(RustType.Vec(RustType.U8()));
            else if (lowerName.includes('state') || lowerName === '_h' || lowerName === '_w' ||
                     lowerName === '_m' || lowerName === '_s')
              fieldType = RustType.Option(RustType.Vec(RustType.U32()));
            else if (lowerName.includes('length') || lowerName.includes('count') || lowerName.includes('size'))
              fieldType = RustType.Usize();
            else
              fieldType = RustType.Option(RustType.U32());
          }

          const field = new RustStructField(fieldName, fieldType);
          field.visibility = isPrivate ? 'pub(crate)' : 'pub';
          fields.push(field);
          this.structFieldTypes.set(fieldName, fieldType);

          initStatements.push(stmt);
        }
      }

      return { fields, initStatements };
    }

    /**
     * Transform a constructor to a 'new' method
     */
    transformConstructor(node, fieldInitStatements = []) {
      const ctor = new RustFunction('new');
      ctor.returnType = new RustType('Self');

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rustParam = new RustParameter(paramName, paramType);
          ctor.parameters.push(rustParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Collect field initializers for struct literal
      const fieldInits = [];
      const body = new RustBlock();

      if (node.value && node.value.body && node.value.body.type === 'BlockStatement') {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            // Collect field initializer for struct literal
            const expr = stmt.expression;
            const propName = expr.left.property.name || expr.left.property.value;
            let fieldName = this.toSnakeCase(propName);
            // Remove leading underscore for Rust field names (Rust uses pub(crate) instead)
            if (fieldName.startsWith('_'))
              fieldName = fieldName.substring(1);
            const value = this.transformExpression(expr.right);
            fieldInits.push({ name: fieldName, value });
          } else {
            // Transform other statements
            const rustStmt = this.transformStatement(stmt);
            if (rustStmt) {
              if (Array.isArray(rustStmt))
                body.statements.push(...rustStmt);
              else
                body.statements.push(rustStmt);
            }
          }
        }
      }

      // Create Self { field: value, ... } struct literal as return expression
      const structLiteral = new RustStructLiteral('Self', fieldInits);
      body.statements.push(new RustExpressionStatement(structLiteral));

      ctor.body = body;
      return ctor;
    }

    /**
     * Check if a method body modifies 'this' (needs &mut self)
     */
    methodModifiesThis(bodyNode) {
      if (!bodyNode) return false;

      const check = (node) => {
        if (!node || typeof node !== 'object') return false;

        // Check for this.x = y assignments
        if (node.type === 'AssignmentExpression' &&
            node.left.type === 'MemberExpression' &&
            node.left.object.type === 'ThisExpression') {
          return true;
        }

        // Recursively check all child nodes
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
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toSnakeCase(node.key.name);
      const method = new RustFunction(methodName);

      // Determine self parameter type
      method.isSelfMethod = !node.static;
      if (method.isSelfMethod) {
        // Check if method modifies this -> use &mut self, otherwise &self
        const modifiesThis = this.methodModifiesThis(node.value?.body);
        method.selfParameter = modifiesThis ? '&mut self' : '&self';
      } else {
        method.selfParameter = null;
      }

      // Infer return type from body
      method.returnType = RustType.Unit();
      if (node.value && node.value.body) {
        const hasReturn = this.hasReturnWithValue(node.value.body);
        if (hasReturn) {
          // Try to infer return type
          const returnType = this.inferReturnType(node.value.body);
          if (returnType) {
            method.returnType = returnType;
          }
        }
      }

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rustParam = new RustParameter(paramName, paramType);
          method.parameters.push(rustParam);

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
      // Return first type (could merge types for better inference)
      return returnTypes[0];
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const fieldName = this.toSnakeCase(node.key.name);
      let fieldType = RustType.U32();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      }

      const field = new RustStructField(fieldName, fieldType);
      this.structFieldTypes.set(fieldName, fieldType);

      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Rust module-level statements or lazy_static
      // Rust doesn't have static class blocks, so transform to statements
      return node.body.map(stmt => this.transformStatement(stmt));
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new RustBlock();

      if (node.body && Array.isArray(node.body)) {
        for (let i = 0; i < node.body.length; i++) {
          const stmt = node.body[i];
          const isLast = i === node.body.length - 1;

          const rustStmt = this.transformStatement(stmt);
          if (rustStmt) {
            if (Array.isArray(rustStmt)) {
              block.statements.push(...rustStmt);
            } else {
              block.statements.push(rustStmt);
            }
          }

          // Check if last statement is a return-like expression
          if (isLast && stmt.type === 'ReturnStatement' && stmt.argument) {
            block.hasTrailingExpression = true;
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement
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
          return new RustBreak();

        case 'ContinueStatement':
          return new RustContinue();

        default:
          return null;
      }
    }

    /**
     * Transform a do-while statement to Rust loop with break
     */
    transformDoWhileStatement(node) {
      // Rust doesn't have do-while, use loop { ... if !condition { break; } }
      const body = this.transformStatement(node.body) || new RustBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      // Add condition check at end
      const condition = this.transformExpression(node.test);
      const negatedCondition = new RustUnaryExpression('!', condition);
      const breakIf = new RustIf(negatedCondition, new RustBlock([new RustBreak()]), null);
      bodyBlock.statements.push(breakIf);

      return new RustLoop(bodyBlock);
    }

    /**
     * Transform a switch statement to Rust match expression
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const match = new RustMatch(discriminant);

      for (const caseNode of node.cases) {
        const pattern = caseNode.test ? this.transformExpression(caseNode.test) : new RustIdentifier('_');
        const armBody = new RustBlock();

        // Transform case body
        for (const stmt of caseNode.consequent) {
          const rustStmt = this.transformStatement(stmt);
          if (rustStmt) {
            if (Array.isArray(rustStmt)) {
              armBody.statements.push(...rustStmt);
            } else {
              armBody.statements.push(rustStmt);
            }
          }
        }

        const arm = new RustMatchArm(pattern, armBody);
        match.arms.push(arm);
      }

      return match;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      // Rust uses Result<T, E> pattern, not try-catch
      // For simplicity, wrap in a closure that returns Result
      const tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        // Add comment explaining Rust error handling
        const comment = new RustDocComment('Error handling: Rust uses Result<T, E> instead of try-catch', true);
        return comment;
      }

      return tryBlock;
    }

    /**
     * Transform a throw statement
     */
    transformThrowStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) : new RustLiteral("error", 'str');
      return new RustMacroCall('panic!', expr);
    }

    /**
     * Transform a let statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new RustIndexExpression(sourceExpr, RustLiteral.Usize(i));
              const letStmt = new RustLet(varName, new RustType('_'), indexExpr);
              letStmt.isMutable = node.kind !== 'const';
              this.registerVariableType(elem.name, new RustType('_'));
              statements.push(letStmt);
            }
          }
          continue;
        }

        const varName = this.toSnakeCase(decl.id.name);
        let varType = null;
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
          varType = this.inferTypeFromValue(decl.init);
        } else {
          varType = this.inferTypeFromName(decl.id.name);
        }

        const letStmt = new RustLet(varName, varType, initializer);
        letStmt.isMutable = node.kind !== 'const';

        this.registerVariableType(decl.id.name, varType);
        statements.push(letStmt);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new RustExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new RustReturn(expr);
      }

      return new RustReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new RustBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      // Ensure branches are blocks
      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new RustIf(condition, thenBlock, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // Convert C-style for loop to Rust while loop
      const whileLoop = new RustWhile(
        node.test ? this.transformExpression(node.test) : new RustLiteral(true, 'bool'),
        this.transformStatement(node.body) || new RustBlock()
      );

      // Add init before loop
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

      // Add update at end of loop body
      if (node.update && whileLoop.body.nodeType === 'Block') {
        const updateStmt = new RustExpressionStatement(this.transformExpression(node.update));
        whileLoop.body.statements.push(updateStmt);
      }

      return statements.length === 1 ? statements[0] : statements;
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new RustBlock();

      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RustWhile(condition, bodyBlock);
    }

    /**
     * Transform a for-of statement: for (const x of array) { ... }
     * Rust equivalent: for x in array.iter() { ... }
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      // Transform the iterable - add .iter() for references
      let iterable = this.transformExpression(node.right);

      // Rust for-in loops: for var_name in iterable { body }
      const body = this.transformStatement(node.body) || new RustBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RustFor(new RustIdentifier(varName), iterable, bodyBlock);
    }

    /**
     * Transform a for-in statement: for (const key in object) { ... }
     * Rust equivalent: for key in object.keys() { ... }
     */
    transformForInStatement(node) {
      // Extract variable name from left side
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      // Transform the object - for-in iterates over keys, so use .keys()
      const object = this.transformExpression(node.right);
      const iterable = new RustMethodCall(object, 'keys', []);

      const body = this.transformStatement(node.body) || new RustBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RustFor(new RustIdentifier(varName), iterable, bodyBlock);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new RustBlock();
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
     * Transform an expression
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
          return new RustIdentifier('self');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          // Return the last expression in the sequence
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        case 'SpreadElement':
          // ...array -> array (spread into Vec)
          return this.transformSpreadElement(node);

        case 'Super':
          // super -> self (Rust doesn't have inheritance)
          return new RustIdentifier('self');

        case 'TemplateLiteral':
          // `Hello ${name}!` -> format!("Hello {}!", name)
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - Rust supports destructuring with structs
          // Return a comment placeholder
          return new RustIdentifier('/* Object destructuring pattern */');

        default:
          return null;
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Rust equivalents
      if (name === 'undefined') return new RustIdentifier('None');
      if (name === 'null') return new RustIdentifier('None');
      if (name === 'NaN') return new RustIdentifier('f64::NAN');
      if (name === 'Infinity') return new RustIdentifier('f64::INFINITY');

      // Rust reserved keywords that need renaming
      const rustKeywords = ['type', 'move', 'ref', 'box', 'loop', 'match', 'const', 'static', 'fn', 'let', 'mut', 'trait', 'impl', 'mod', 'pub', 'use', 'as', 'where', 'unsafe', 'extern', 'crate', 'super', 'self', 'Self'];
      if (rustKeywords.includes(name)) {
        name = name + '_';
      }

      return new RustIdentifier(this.toSnakeCase(name));
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          const suffix = node.value >= 0 ? 'u32' : 'i32';
          return RustLiteral.UInt(node.value, suffix);
        }
        return new RustLiteral(node.value, 'float');
      }

      if (typeof node.value === 'string') {
        return RustLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return RustLiteral.Bool(node.value);
      }

      if (node.value === null) {
        return new RustIdentifier('None');
      }

      return new RustLiteral(node.value, 'unknown');
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Map operators
      let operator = node.operator;
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle JavaScript >>> 0 idiom (cast to unsigned)
      if (operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        // In Rust, just cast to u32
        return new RustCast(left, RustType.U32());
      }

      // Unsigned right shift in Rust: value as u32 >> amount
      if (operator === '>>>') {
        // Cast left to u32 for unsigned shift
        left = new RustCast(left, RustType.U32());
        operator = '>>';
      }

      // Handle typeof comparisons
      if ((operator === '==' || operator === '!=') &&
          node.left.type === 'UnaryExpression' && node.left.operator === 'typeof' &&
          node.right.type === 'Literal' && typeof node.right.value === 'string') {
        // typeof checks not directly supported in Rust
        // Return a comment placeholder
        return new RustIdentifier(`/* typeof check: ${node.right.value} */`);
      }

      return new RustBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;
      if (operator === 'typeof') {
        // Rust doesn't have typeof, use type_name
        return new RustMacroCall('std::any::type_name', `&${operand}`);
      }

      return new RustUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new RustAssignment(left, node.operator, right);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      // Rust doesn't have ++ or --, use += 1 or -= 1
      const op = node.operator === '++' ? '+=' : '-=';
      return new RustAssignment(operand, op, new RustLiteral(1, 'int'));
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array indexing
        const index = this.transformExpression(node.property);
        return new RustIndex(object, index);
      } else {
        // Field access
        const field = node.property.name || node.property.value;

        // Handle special properties
        if (field === 'length')
          return new RustMethodCall(object, 'len', []);

        // For self.x fields, remove leading underscore (Rust uses visibility modifiers)
        let fieldName = this.toSnakeCase(field);
        if (node.object.type === 'ThisExpression' && fieldName.startsWith('_'))
          fieldName = fieldName.substring(1);

        return new RustFieldAccess(object, fieldName);
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
        const methodName = this.toSnakeCase(method);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> x (Rust has immutability by default)
          if (method === 'freeze' && args.length === 1)
            return args[0];
          // Object.keys(obj) -> obj.keys().collect::<Vec<_>>()
          if (method === 'keys' && args.length === 1)
            return new RustMethodCall(new RustMethodCall(args[0], 'keys', []), 'collect', []);
          // Object.values(obj) -> obj.values().collect::<Vec<_>>()
          if (method === 'values' && args.length === 1)
            return new RustMethodCall(new RustMethodCall(args[0], 'values', []), 'collect', []);
          // Object.entries(obj) -> obj.iter().collect::<Vec<_>>()
          if (method === 'entries' && args.length === 1)
            return new RustMethodCall(new RustMethodCall(args[0], 'iter', []), 'collect', []);
          // Object.assign -> clone and extend
          if (method === 'assign' && args.length >= 2)
            return new RustMethodCall(args[0], 'clone', []);
        }

        return new RustMethodCall(object, methodName, args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new RustCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to Rust equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Rust equivalents
      switch (methodName) {
        // Rotation operations
        case 'RotL32':
        case 'RotL64':
          return new RustMethodCall(args[0], 'rotate_left', [args[1]]);

        case 'RotR32':
        case 'RotR64':
          return new RustMethodCall(args[0], 'rotate_right', [args[1]]);

        case 'RotL8':
          // Cast to u8, rotate, cast back
          return new RustMethodCall(
            new RustCast(args[0], RustType.U8()),
            'rotate_left',
            [args[1]]
          );

        case 'RotR8':
          return new RustMethodCall(
            new RustCast(args[0], RustType.U8()),
            'rotate_right',
            [args[1]]
          );

        // Byte packing - little endian
        case 'Pack32LE':
          return new RustMethodCall(
            new RustIdentifier('u32'),
            'from_le_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack64LE':
          return new RustMethodCall(
            new RustIdentifier('u64'),
            'from_le_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack16LE':
          return new RustMethodCall(
            new RustIdentifier('u16'),
            'from_le_bytes',
            [new RustArrayLiteral(args)]
          );

        // Byte packing - big endian
        case 'Pack32BE':
          return new RustMethodCall(
            new RustIdentifier('u32'),
            'from_be_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack64BE':
          return new RustMethodCall(
            new RustIdentifier('u64'),
            'from_be_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack16BE':
          return new RustMethodCall(
            new RustIdentifier('u16'),
            'from_be_bytes',
            [new RustArrayLiteral(args)]
          );

        // Byte unpacking - little endian
        case 'Unpack32LE':
          return new RustMethodCall(args[0], 'to_le_bytes', []);

        case 'Unpack64LE':
          return new RustMethodCall(args[0], 'to_le_bytes', []);

        case 'Unpack16LE':
          return new RustMethodCall(args[0], 'to_le_bytes', []);

        // Byte unpacking - big endian
        case 'Unpack32BE':
          return new RustMethodCall(args[0], 'to_be_bytes', []);

        case 'Unpack64BE':
          return new RustMethodCall(args[0], 'to_be_bytes', []);

        case 'Unpack16BE':
          return new RustMethodCall(args[0], 'to_be_bytes', []);

        // Array operations
        case 'XorArrays':
          // Use zip and map: a.iter().zip(b.iter()).map(|(x, y)| x ^ y).collect()
          return new RustCall(new RustIdentifier('xor_arrays'), args);

        case 'ClearArray':
          return new RustMethodCall(args[0], 'fill', [new RustLiteral(0, 'u8')]);

        // Conversion utilities
        case 'Hex8ToBytes':
          return new RustCall(new RustIdentifier('hex_to_bytes'), args);

        case 'BytesToHex8':
          return new RustCall(new RustIdentifier('bytes_to_hex'), args);

        case 'AnsiToBytes':
          // Convert string to bytes
          return new RustMethodCall(args[0], 'as_bytes', []);

        case 'BytesToAnsi':
          // Convert bytes to string
          return new RustCall(
            new RustFieldAccess(new RustIdentifier('String'), 'from_utf8_lossy'),
            [args[0]]
          );

        default:
          // Default to function call with snake_case naming
          return new RustCall(new RustIdentifier(this.toSnakeCase(methodName)), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));

      // Use vec! macro for dynamic arrays
      return new RustVecMacro(elements);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;

        // Map TypedArrays to Rust Vec types
        const typedArrayMap = {
          'Uint8Array': 'u8',
          'Uint16Array': 'u16',
          'Uint32Array': 'u32',
          'Int8Array': 'i8',
          'Int16Array': 'i16',
          'Int32Array': 'i32',
          'Float32Array': 'f32',
          'Float64Array': 'f64'
        };

        if (typedArrayMap[typeName]) {
          const hasArrayInit = node.arguments.length > 0 &&
            node.arguments[0].type === 'ArrayExpression';

          if (hasArrayInit) {
            // new Uint8Array([1, 2, 3]) -> vec![1u8, 2u8, 3u8]
            const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
            return new RustMacroCall('vec', elements);
          }

          // new Uint8Array(n) -> vec![0u8; n]
          const size = node.arguments[0] ? this.transformExpression(node.arguments[0]) : new RustLiteral(0, 'usize');
          return new RustMacroCall('vec', [new RustLiteral(0, typedArrayMap[typeName]), size], true);
        }

        // Handle Array constructor
        if (typeName === 'Array') {
          if (node.arguments.length === 1) {
            // new Array(n) -> Vec::with_capacity(n)
            const size = this.transformExpression(node.arguments[0]);
            return new RustCall(new RustFieldAccess(new RustIdentifier('Vec'), 'with_capacity'), [size]);
          }
          return new RustMacroCall('vec', []);
        }

        const pascalTypeName = this.toPascalCase(typeName);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Call the 'new' method
        return new RustCall(
          new RustFieldAccess(new RustIdentifier(pascalTypeName), 'new'),
          args
        );
      }

      return null;
    }

    /**
     * Transform a conditional expression
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const thenExpr = this.transformExpression(node.consequent);
      const elseExpr = this.transformExpression(node.alternate);

      return new RustIfExpression(condition, thenExpr, elseExpr);
    }

    /**
     * Transform an object expression to Rust struct literal
     */
    transformObjectExpression(node) {
      // For now, use HashMap initialization
      // In a full implementation, we'd need to define a struct first
      const fields = [];
      for (const prop of node.properties) {
        // Handle spread properties and missing keys
        if (!prop.key) {
          // SpreadElement or other property without key
          if (prop.type === 'SpreadElement' && prop.argument) {
            // Skip spread for now - would need to merge
            continue;
          }
          continue;
        }
        const key = prop.key.name || prop.key.value || 'unknown';
        const value = this.transformExpression(prop.value);
        fields.push({ key: this.toSnakeCase(key), value });
      }

      // Create HashMap initialization using insert calls
      // HashMap::new() followed by insert() calls would be emitted by RustEmitter
      return new RustStructLiteral('HashMap::new()', fields);
    }

    /**
     * Transform a function expression to Rust closure
     */
    transformFunctionExpression(node) {
      // Map parameters
      const params = node.params ? node.params.map(p => {
        const paramName = this.toSnakeCase(p.name);
        const paramType = this.inferTypeFromName(p.name);
        return new RustParameter(paramName, paramType);
      }) : [];

      // Transform body
      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          // Arrow function with expression body
          body = this.transformExpression(node.body);
        }
      }

      return new RustClosure(params, body);
    }

    /**
     * Transform logical expression (&&, ||)
     */
    transformLogicalExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new RustBinaryExpression(left, node.operator, right);
    }

    /**
     * Transform spread element: ...array
     * In Rust, this typically means extending a Vec or using iterator
     */
    transformSpreadElement(node) {
      // Just transform the argument - spread handling depends on context
      return this.transformExpression(node.argument);
    }

    /**
     * Transform template literal: `Hello ${name}!` -> format!("Hello {}!", name)
     */
    transformTemplateLiteral(node) {
      let formatStr = '';
      const args = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        formatStr += node.quasis[i].value.raw.replace(/{/g, '{{').replace(/}/g, '}}');
        if (i < node.expressions.length) {
          formatStr += '{}';
          args.push(this.transformExpression(node.expressions[i]));
        }
      }

      // Use format! macro
      return new RustMacroCall('format!', [
        RustLiteral.String(formatStr),
        ...args
      ]);
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
  const exports = { RustTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.RustTransformer = RustTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
