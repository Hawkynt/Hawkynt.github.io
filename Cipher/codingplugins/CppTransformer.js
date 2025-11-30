/**
 * CppTransformer.js - JavaScript AST to C++ AST Transformer
 * Converts type-annotated JavaScript AST to C++ AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C++ AST -> C++ Emitter -> C++ Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let CppAST;
  if (typeof require !== 'undefined') {
    CppAST = require('./CppAST.js');
  } else if (global.CppAST) {
    CppAST = global.CppAST;
  }

  const {
    CppType, CppCompilationUnit, CppIncludeDirective, CppNamespace,
    CppClass, CppStruct, CppField, CppMethod, CppConstructor, CppDestructor,
    CppParameter, CppBlock, CppVariableDeclaration, CppExpressionStatement,
    CppReturn, CppIf, CppFor, CppRangeFor, CppWhile, CppDoWhile, CppSwitch,
    CppSwitchCase, CppBreak, CppContinue, CppThrow, CppTryCatch, CppCatchClause,
    CppLiteral, CppIdentifier, CppBinaryExpression, CppUnaryExpression,
    CppAssignment, CppMemberAccess, CppElementAccess, CppFunctionCall,
    CppObjectCreation, CppArrayCreation, CppInitializerList, CppCast,
    CppConditional, CppLambda, CppThis, CppSizeof, CppParenthesized,
    CppDocComment
  } = CppAST;

  /**
   * Maps JavaScript/JSDoc types to C++ types
   */
  const TYPE_MAP = {
    // Unsigned integers
    'uint8': 'uint8_t', 'byte': 'uint8_t',
    'uint16': 'uint16_t', 'ushort': 'uint16_t', 'word': 'uint16_t',
    'uint32': 'uint32_t', 'uint': 'uint32_t', 'dword': 'uint32_t',
    'uint64': 'uint64_t', 'ulong': 'uint64_t', 'qword': 'uint64_t',
    // Signed integers
    'int8': 'int8_t', 'sbyte': 'int8_t',
    'int16': 'int16_t', 'short': 'int16_t',
    'int32': 'int32_t', 'int': 'int32_t',
    'int64': 'int64_t', 'long': 'int64_t',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'double', 'float64': 'double',
    // Number in crypto context typically means uint32
    'number': 'uint32_t',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'std::string', 'String': 'std::string',
    'void': 'void',
    'object': 'void', 'Object': 'void', 'any': 'void'
  };

  /**
   * JavaScript AST to C++ AST Transformer
   */
  class CppTransformer {
    constructor(options = {}) {
      this.options = options;
      this.typeKnowledge = options.typeKnowledge || null;
      this.parser = options.parser || null;
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();
      this.classFieldTypes = new Map();
      this.methodSignatures = new Map();
      this.nestedClasses = [];
      this.warnings = [];
      this.scopeStack = [];
      this.currentArrayElementType = null;
    }

    /**
     * Map a type string to CppType
     */
    mapType(typeName) {
      if (!typeName || typeName === 'undefined') return CppType.Auto();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return CppType.Vector(elementType);
      }

      // Map to C++ type
      const cppTypeName = TYPE_MAP[typeName] || typeName;

      // Create basic type
      switch (cppTypeName) {
        case 'uint8_t': return CppType.Byte();
        case 'int8_t': return CppType.SByte();
        case 'uint16_t': return CppType.UShort();
        case 'int16_t': return CppType.Short();
        case 'uint32_t': return CppType.UInt();
        case 'int32_t': return CppType.Int();
        case 'uint64_t': return CppType.ULong();
        case 'int64_t': return CppType.Long();
        case 'float': return CppType.Float();
        case 'double': return CppType.Double();
        case 'bool': return CppType.Bool();
        case 'std::string': return CppType.String();
        case 'void': return CppType.Void();
        default: return new CppType(cppTypeName);
      }
    }

    /**
     * Map type from TypeKnowledge (similar to C# transformer)
     */
    mapTypeFromKnowledge(typeName) {
      if (!typeName) return CppType.Auto();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapTypeFromKnowledge(elementTypeName);
        return CppType.Vector(elementType);
      }

      // Map crypto type names to C++ types
      const typeMap = {
        'byte': CppType.Byte(),
        'sbyte': CppType.SByte(),
        'word': CppType.UShort(),
        'ushort': CppType.UShort(),
        'short': CppType.Short(),
        'dword': CppType.UInt(),
        'uint': CppType.UInt(),
        'uint8': CppType.Byte(),
        'uint16': CppType.UShort(),
        'uint32': CppType.UInt(),
        'uint64': CppType.ULong(),
        'int': CppType.Int(),
        'int8': CppType.SByte(),
        'int16': CppType.Short(),
        'int32': CppType.Int(),
        'int64': CppType.Long(),
        'qword': CppType.ULong(),
        'long': CppType.Long(),
        'float': CppType.Float(),
        'float32': CppType.Float(),
        'double': CppType.Double(),
        'float64': CppType.Double(),
        'boolean': CppType.Bool(),
        'bool': CppType.Bool(),
        'string': CppType.String(),
        'void': CppType.Void()
      };

      return typeMap[typeName] || new CppType(typeName);
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
     * Convert to snake_case naming
     */
    toSnakeCase(name) {
      if (!name) return '';
      if (typeof name !== 'string') return String(name);
      return name
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }

    /**
     * Convert to PascalCase naming
     */
    toPascalCase(name) {
      if (!name) return '';
      if (typeof name !== 'string') return String(name);
      return name.charAt(0).toUpperCase() + name.slice(1).replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
    }

    /**
     * Register a variable's type
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get a variable's type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Infer type from expression (comprehensive)
     */
    inferExpressionType(node, contextFieldName = null) {
      if (!node) return CppType.Auto();

      switch (node.type) {
        case 'Literal':
          if (node.value === null) {
            // Use std::optional<T> for nullable fields
            // Try to infer T from field name context if provided
            if (contextFieldName) {
              const lowerName = contextFieldName.toLowerCase();
              if (lowerName.includes('buffer') || lowerName.includes('data') || lowerName.includes('block'))
                return CppType.Optional(CppType.Vector(CppType.Byte()));
              if (lowerName === 'h' || lowerName === '_h' || lowerName === 'w' || lowerName === '_w' ||
                  lowerName === 'state' || lowerName === '_state')
                return CppType.Optional(CppType.Vector(CppType.UInt()));
            }
            // Default to optional<uint32_t> for crypto context
            return CppType.Optional(CppType.UInt());
          }
          if (typeof node.value === 'boolean') return CppType.Bool();
          if (typeof node.value === 'string') return CppType.String();
          if (typeof node.value === 'number') {
            return Number.isInteger(node.value) ? CppType.UInt() : CppType.Double();
          }
          break;

        case 'Identifier':
          const varType = this.getVariableType(node.name);
          if (varType) return varType;
          return CppType.UInt(); // Default for crypto

        case 'BinaryExpression':
        case 'LogicalExpression':
          // Comparison operators return bool
          if (['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(node.operator)) {
            return CppType.Bool();
          }
          // Logical operators return bool
          if (['&&', '||'].includes(node.operator)) {
            return CppType.Bool();
          }
          // >>> 0 idiom = uint32
          if (node.operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
            return CppType.UInt();
          }
          // For bitwise operations, use the type of the left operand
          const leftType = this.inferExpressionType(node.left);
          if (leftType && leftType.name !== 'auto') return leftType;
          return CppType.UInt(); // Default for crypto operations

        case 'UnaryExpression':
          if (node.operator === '!') return CppType.Bool();
          if (node.operator === '~') {
            const argType = this.inferExpressionType(node.argument);
            return argType || CppType.UInt();
          }
          return this.inferExpressionType(node.argument);

        case 'UpdateExpression':
          return this.inferExpressionType(node.argument);

        case 'AssignmentExpression':
          return this.inferExpressionType(node.right);

        case 'MemberExpression':
          // Array indexed access
          if (node.computed) {
            const objType = this.inferExpressionType(node.object);
            if (objType && objType.isVector) {
              return objType.elementType || CppType.Byte();
            }
          }
          // Property access - check if it's 'length'
          const propName = node.property.name || node.property.value;
          if (propName === 'length') return CppType.Int();

          // Check class fields
          if (node.object.type === 'ThisExpression') {
            const fieldType = this.classFieldTypes.get(this.toPascalCase(propName));
            if (fieldType) return fieldType;
          }
          return CppType.Auto();

        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const elemType = this.inferExpressionType(node.elements[0]);
            return CppType.Vector(elemType);
          }
          // Use current array element type context if available
          if (this.currentArrayElementType) {
            return CppType.Vector(this.currentArrayElementType);
          }
          return CppType.Vector(CppType.Byte());

        case 'NewExpression':
          if (node.callee.type === 'Identifier') {
            const typeName = node.callee.name;
            if (typeName === 'Array') return CppType.Vector(CppType.UInt());
            if (typeName === 'Uint8Array') return CppType.Vector(CppType.Byte());
            if (typeName === 'Uint16Array') return CppType.Vector(CppType.UShort());
            if (typeName === 'Uint32Array') return CppType.Vector(CppType.UInt());
            if (typeName === 'Int8Array') return CppType.Vector(CppType.SByte());
            if (typeName === 'Int16Array') return CppType.Vector(CppType.Short());
            if (typeName === 'Int32Array') return CppType.Vector(CppType.Int());
            return new CppType(this.toPascalCase(typeName));
          }
          break;

        case 'CallExpression':
          // OpCodes methods
          if (node.callee.type === 'MemberExpression' &&
              node.callee.object.type === 'Identifier' &&
              node.callee.object.name === 'OpCodes') {
            const methodName = node.callee.property.name;
            const returnType = this.getOpCodesReturnType(methodName);
            if (returnType) return returnType;
          }

          // Array methods
          if (node.callee.type === 'MemberExpression') {
            const method = node.callee.property.name;
            const objType = this.inferExpressionType(node.callee.object);

            if (objType && objType.isVector) {
              if (['slice', 'concat', 'filter'].includes(method)) {
                return objType; // Returns same vector type
              }
              if (['pop', 'shift'].includes(method)) {
                return objType.elementType || CppType.Byte();
              }
            }

            if (method === 'fill' && node.callee.object.type === 'NewExpression') {
              // new Array(n).fill(value) - infer from fill argument
              if (node.arguments && node.arguments.length > 0) {
                const fillArgType = this.inferExpressionType(node.arguments[0]);
                return CppType.Vector(fillArgType);
              }
            }
          }

          return CppType.Auto();

        case 'ConditionalExpression':
          // Use the type of the consequent (could also check alternate)
          return this.inferExpressionType(node.consequent);

        case 'ThisExpression':
          if (this.currentClass) {
            return new CppType(this.currentClass.name);
          }
          return CppType.Auto();
      }

      return CppType.Auto();
    }

    /**
     * Transform JavaScript AST to C++ AST
     */
    transform(jsAst) {
      try {
        const unit = new CppCompilationUnit();

        // Standard includes
        unit.includes.push(new CppIncludeDirective('cstdint', true));
        unit.includes.push(new CppIncludeDirective('vector', true));
        unit.includes.push(new CppIncludeDirective('array', true));
        unit.includes.push(new CppIncludeDirective('string', true));
        unit.includes.push(new CppIncludeDirective('algorithm', true));
        unit.includes.push(new CppIncludeDirective('cstring', true));
        unit.includes.push(new CppIncludeDirective('bit', true)); // For std::rotl, std::rotr (C++20)
        unit.includes.push(new CppIncludeDirective('memory', true)); // For smart pointers
        unit.includes.push(new CppIncludeDirective('optional', true)); // For nullable values

        // Create namespace
        const ns = new CppNamespace(this.options.namespace || 'generated');
        unit.namespaces.push(ns);

        // Create main class
        const mainClassName = this.options.className || 'GeneratedClass';
        const mainClass = new CppClass(mainClassName);
        ns.types.push(mainClass);

        // Transform the JavaScript AST
        if (jsAst.type === 'Program') {
          if (!jsAst.body) {
            throw new Error('Program node has no body');
          }
          for (const node of jsAst.body) {
            try {
              this.transformTopLevel(node, mainClass);
            } catch (err) {
              console.error(`Error transforming top-level node of type ${node.type}:`, err.message);
              throw err;
            }
          }
        }

        return unit;
      } catch (err) {
        console.error('Transform error:', err);
        throw err;
      }
    }

    /**
     * Transform top-level node
     */
    transformTopLevel(node, targetClass) {
      switch (node.type) {
        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetClass);
          break;

        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetClass);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetClass);
          break;

        case 'ExpressionStatement':
          // Handle IIFE patterns (used by UMD modules)
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') {
              this.transformIIFE(node.expression, targetClass);
            }
          }
          break;

        default:
          // Skip unhandled nodes
          break;
      }
    }

    /**
     * Transform IIFE (Immediately Invoked Function Expression)
     */
    transformIIFE(callExpr, targetClass) {
      // Check for UMD pattern: (function(root, factory) {...})(globalThis, function(deps) {...})
      if (callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          // Extract declarations from factory function body
          if (factoryArg.body && factoryArg.body.body) {
            for (const stmt of factoryArg.body.body) {
              this.transformTopLevelFromIIFE(stmt, targetClass);
            }
            return;
          }
        }
      }

      // Simple IIFE - extract from callee body
      const callee = callExpr.callee;
      if (callee.body && callee.body.body) {
        for (const stmt of callee.body.body) {
          this.transformTopLevelFromIIFE(stmt, targetClass);
        }
      }
    }

    /**
     * Transform statements from inside an IIFE
     */
    transformTopLevelFromIIFE(stmt, targetClass) {
      switch (stmt.type) {
        case 'ClassDeclaration':
          this.transformClassDeclaration(stmt, targetClass);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(stmt, targetClass);
          break;

        case 'VariableDeclaration':
          // Look for class assignments: const X = class { }
          for (const decl of stmt.declarations) {
            if (decl.init && decl.init.type === 'ClassExpression') {
              const classNode = { ...decl.init, id: decl.id };
              this.transformClassDeclaration(classNode, targetClass);
            } else if (decl.init && decl.init.type === 'ObjectExpression') {
              this.transformVariableDeclaration(stmt, targetClass);
            }
          }
          break;

        case 'ExpressionStatement':
          // Handle RegisterAlgorithm calls or other expressions
          if (stmt.expression.type === 'CallExpression') {
            // Check if it's a class instantiation like new XTEAAlgorithm()
            if (stmt.expression.callee.name === 'RegisterAlgorithm') {
              // Skip registration calls
            }
          }
          break;

        case 'ReturnStatement':
          // Skip return statements (often return the class/factory)
          break;

        default:
          // Skip other statements
          break;
      }
    }

    /**
     * Transform function declaration to method
     */
    transformFunctionDeclaration(node, targetClass) {
      const methodName = this.toSnakeCase(node.id.name);

      // Infer return type from JSDoc or function body
      let returnType = CppType.Void();
      if (node.leadingComments) {
        for (const comment of node.leadingComments) {
          const match = comment.value && comment.value.match(/@returns?\s+\{([^}]+)\}/);
          if (match) {
            returnType = this.mapType(match[1].trim());
            break;
          }
        }
      }

      const method = new CppMethod(methodName, returnType);
      method.isStatic = true;

      // Transform parameters
      for (const param of node.params) {
        const paramName = this.toSnakeCase(param.name);
        const paramType = CppType.Auto(); // Will be inferred
        method.parameters.push(new CppParameter(paramName, paramType));
        this.registerVariableType(param.name, paramType);
      }

      // Transform body
      method.body = this.transformBlockStatement(node.body);

      targetClass.publicMembers.push(method);
    }

    /**
     * Transform variable declaration
     */
    transformVariableDeclaration(node, targetClass) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Skip ArrayPattern destructuring
        if (decl.id.type === 'ArrayPattern')
          continue;

        const name = decl.id.name;

        // Check if object literal -> static class
        if (decl.init.type === 'ObjectExpression') {
          const staticClass = this.transformObjectToStaticClass(name, decl.init);
          if (staticClass) {
            targetClass.publicMembers.push(staticClass);
          }
        }
        // Check if this is an IIFE (immediately invoked function expression)
        else if (decl.init.type === 'CallExpression' &&
                 (decl.init.callee.type === 'FunctionExpression' ||
                  decl.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(decl.init);
          if (returnValue) {
            const field = this.transformToField(name, returnValue);
            field.isStatic = true;
            field.isConst = node.kind === 'const';
            targetClass.publicMembers.push(field);
          }
        }
        // Handle simple literals and expressions as static fields
        else if (decl.init.type === 'Literal' ||
                 decl.init.type === 'ArrayExpression' ||
                 decl.init.type === 'UnaryExpression' ||
                 decl.init.type === 'BinaryExpression' ||
                 decl.init.type === 'NewExpression') {
          const field = this.transformToField(name, decl.init);
          field.isStatic = true;
          field.isConst = node.kind === 'const';
          targetClass.publicMembers.push(field);
        }
      }
    }

    /**
     * Transform object to static class
     */
    transformObjectToStaticClass(name, objNode) {
      const className = this.toPascalCase(name);
      const staticClass = new CppClass(className);

      for (const prop of objNode.properties) {
        const propName = prop.key.name || prop.key.value;
        const propValue = prop.value;

        if (prop.method || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          // Method
          const method = this.transformFunctionToMethod(propName, propValue);
          method.isStatic = true;
          staticClass.publicMembers.push(method);
        } else if (propValue.type === 'ObjectExpression') {
          // Nested class
          const nested = this.transformObjectToStaticClass(propName, propValue);
          staticClass.publicMembers.push(nested);
        } else {
          // Field
          const field = this.transformToField(propName, propValue);
          field.isStatic = true;
          field.isConst = true;
          staticClass.publicMembers.push(field);
        }
      }

      return staticClass;
    }

    /**
     * Transform function to method
     */
    transformFunctionToMethod(name, funcNode) {
      const methodName = this.toSnakeCase(name);

      // Extract JSDoc type info
      let returnType = CppType.Auto();
      const paramTypes = new Map();

      if (funcNode.leadingComments) {
        for (const comment of funcNode.leadingComments) {
          if (!comment.value) continue;

          // Parse @returns/@return
          const returnMatch = comment.value.match(/@returns?\s+\{([^}]+)\}/);
          if (returnMatch) {
            returnType = this.mapType(returnMatch[1].trim());
          }

          // Parse @param
          const paramMatches = comment.value.matchAll(/@param\s+\{([^}]+)\}\s+(\w+)/g);
          for (const match of paramMatches) {
            const paramType = this.mapType(match[1].trim());
            const paramName = match[2].trim();
            paramTypes.set(paramName, paramType);
          }
        }
      }

      // Push scope for method
      this.pushScope();

      const method = new CppMethod(methodName, returnType);
      method.isStatic = true;

      // Parameters with type inference
      for (const param of funcNode.params || []) {
        const paramName = param.name ? this.toSnakeCase(param.name) : 'param';
        const originalName = param.name || 'param';
        let paramType = paramTypes.get(originalName) || CppType.Auto();

        // Register parameter type
        this.registerVariableType(originalName, paramType);

        method.parameters.push(new CppParameter(paramName, paramType));
      }

      // Transform body
      if (funcNode.body) {
        if (funcNode.body.type === 'BlockStatement') {
          method.body = this.transformBlockStatement(funcNode.body);
        } else {
          // Arrow function with expression body
          method.body = new CppBlock();
          method.body.statements.push(new CppReturn(this.transformExpression(funcNode.body)));
        }
      } else {
        method.body = new CppBlock();
      }

      // Pop scope
      this.popScope();

      return method;
    }

    /**
     * Transform to field
     */
    transformToField(name, valueNode, explicitType = null) {
      const fieldName = this.toSnakeCase(name);
      const fieldType = explicitType || this.inferExpressionType(valueNode);
      const field = new CppField(fieldName, fieldType);

      if (valueNode) {
        field.initializer = this.transformExpression(valueNode);
      }

      return field;
    }

    /**
     * Transform class declaration
     */
    transformClassDeclaration(node, targetClass) {
      const className = this.toPascalCase(node.id.name);
      const classNode = new CppClass(className);

      // Check for base class
      if (node.superClass) {
        const baseClassName = node.superClass.name || 'Base';
        classNode.baseClasses = [this.toPascalCase(baseClassName)];
      }

      const prevClass = this.currentClass;
      this.currentClass = classNode;

      // Handle both class body structures:
      // - Standard: {type: 'ClassBody', body: [...]}
      // - Unwrapped UMD: array directly
      const members = node.body?.body || node.body || [];

      // First pass: collect fields from constructor assignments
      // Second pass: transform all members
      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Extract fields from constructor before transforming
              this.extractConstructorFields(member, classNode);
              const ctor = this.transformConstructor(className, member);
              classNode.publicMembers.push(ctor);
            } else if (member.kind === 'get') {
              // Getter method
              const getter = this.transformGetter(member);
              classNode.publicMembers.push(getter);
            } else if (member.kind === 'set') {
              // Setter method
              const setter = this.transformSetter(member);
              classNode.publicMembers.push(setter);
            } else {
              const method = this.transformMethodDefinition(member);
              classNode.publicMembers.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Class field
            const field = this.transformPropertyDefinition(member);
            classNode.publicMembers.push(field);
          }
        }
      }

      this.currentClass = prevClass;
      targetClass.publicMembers.push(classNode);
    }

    /**
     * Extract fields from constructor this.field = value assignments
     */
    extractConstructorFields(ctorNode, classNode) {
      if (!ctorNode.value || !ctorNode.value.body || !ctorNode.value.body.body)
        return;

      for (const stmt of ctorNode.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = expr.left.property.name || expr.left.property.value;
          const fieldName = this.toSnakeCase(propName);

          // Skip if already defined
          if (classNode.privateMembers.some(m => m.name === fieldName) ||
              classNode.publicMembers.some(m => m.name === fieldName))
            continue;

          // Infer type from assignment, passing field name for null type inference
          let fieldType = CppType.Auto();
          if (expr.right)
            fieldType = this.inferExpressionType(expr.right, propName);

          const field = new CppField(fieldName, fieldType);

          // Register for later type lookups
          this.classFieldTypes.set(fieldName, fieldType);

          // Decide accessibility based on naming (underscore prefix = private)
          classNode.privateMembers.push(field);
        }
      }
    }

    /**
     * Check if statement is this.property = value
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Transform property definition (class field)
     */
    transformPropertyDefinition(node) {
      const fieldName = this.toSnakeCase(node.key.name);
      let fieldType = CppType.Auto();

      // Try to infer from value
      if (node.value) {
        fieldType = this.inferExpressionType(node.value);
      }

      const field = new CppField(fieldName, fieldType);

      if (node.value) {
        field.initializer = this.transformExpression(node.value);
      }

      return field;
    }

    /**
     * Transform getter method
     */
    transformGetter(node) {
      const methodName = `get_${this.toSnakeCase(node.key.name)}`;
      const returnType = CppType.Auto();

      const method = new CppMethod(methodName, returnType);
      method.isConst = true; // Getters are const in C++

      if (node.value && node.value.body) {
        this.pushScope();
        method.body = this.transformBlockStatement(node.value.body);
        this.popScope();
      }

      return method;
    }

    /**
     * Transform setter method
     */
    transformSetter(node) {
      const methodName = `set_${this.toSnakeCase(node.key.name)}`;

      const method = new CppMethod(methodName, CppType.Void());

      // Setter has one parameter (the value)
      if (node.value && node.value.params && node.value.params.length > 0) {
        const paramName = this.toSnakeCase(node.value.params[0].name);
        method.parameters.push(new CppParameter(paramName, CppType.Auto()));
      }

      if (node.value && node.value.body) {
        this.pushScope();
        method.body = this.transformBlockStatement(node.value.body);
        this.popScope();
      }

      return method;
    }

    /**
     * Transform constructor
     */
    transformConstructor(className, node) {
      const ctor = new CppConstructor(className);

      // Push scope for constructor
      this.pushScope();

      // Parameters with type extraction
      const paramTypes = new Map();
      if (node.leadingComments || node.value.leadingComments) {
        const comments = node.leadingComments || node.value.leadingComments;
        for (const comment of comments) {
          if (!comment.value) continue;
          const paramMatches = comment.value.matchAll(/@param\s+\{([^}]+)\}\s+(\w+)/g);
          for (const match of paramMatches) {
            const paramType = this.mapType(match[1].trim());
            const paramName = match[2].trim();
            paramTypes.set(paramName, paramType);
          }
        }
      }

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const originalName = param.name;
          const paramType = paramTypes.get(originalName) || CppType.Auto();

          // Register parameter type
          this.registerVariableType(originalName, paramType);

          ctor.parameters.push(new CppParameter(paramName, paramType));
        }
      }

      // Body
      if (node.value && node.value.body) {
        ctor.body = this.transformBlockStatement(node.value.body);
      } else {
        // Ensure constructor has a body even if empty
        ctor.body = new CppBlock();
      }

      // Pop scope
      this.popScope();

      return ctor;
    }

    /**
     * Transform method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toSnakeCase(node.key.name);

      // Extract return type from JSDoc if available
      let returnType = CppType.Auto();
      if (node.leadingComments || node.value.leadingComments) {
        const comments = node.leadingComments || node.value.leadingComments;
        for (const comment of comments) {
          if (!comment.value) continue;
          const returnMatch = comment.value.match(/@returns?\s+\{([^}]+)\}/);
          if (returnMatch) {
            returnType = this.mapType(returnMatch[1].trim());
            break;
          }
        }
      }

      const method = new CppMethod(methodName, returnType);
      method.isStatic = node.static || false;

      // Push scope for method
      this.pushScope();

      // Parameters with type extraction
      const paramTypes = new Map();
      if (node.leadingComments || node.value.leadingComments) {
        const comments = node.leadingComments || node.value.leadingComments;
        for (const comment of comments) {
          if (!comment.value) continue;
          const paramMatches = comment.value.matchAll(/@param\s+\{([^}]+)\}\s+(\w+)/g);
          for (const match of paramMatches) {
            const paramType = this.mapType(match[1].trim());
            const paramName = match[2].trim();
            paramTypes.set(paramName, paramType);
          }
        }
      }

      // Parameters with type extraction
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const originalName = param.name;
          const paramType = paramTypes.get(originalName) || CppType.Auto();

          // Register parameter type
          this.registerVariableType(originalName, paramType);

          method.parameters.push(new CppParameter(paramName, paramType));
        }
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      } else {
        // Ensure method has a body even if empty
        method.body = new CppBlock();
      }

      // Pop scope
      this.popScope();

      return method;
    }

    // ========================[ STATEMENTS ]========================

    /**
     * Transform block statement
     */
    transformBlockStatement(node) {
      const block = new CppBlock();

      if (!node || !node.body) {
        return block;
      }

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

      return block;
    }

    /**
     * Transform statement
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'VariableDeclaration':
          return this.transformVariableDeclarationStatement(node);
        case 'ExpressionStatement':
          return new CppExpressionStatement(this.transformExpression(node.expression));
        case 'ReturnStatement':
          return new CppReturn(node.argument ? this.transformExpression(node.argument) : null);
        case 'IfStatement':
          return this.transformIfStatement(node);
        case 'ForStatement':
          return this.transformForStatement(node);
        case 'ForOfStatement':
          return this.transformForOfStatement(node);
        case 'ForInStatement':
          return this.transformForInStatement(node);
        case 'WhileStatement':
          return new CppWhile(this.transformExpression(node.test), this.transformStatement(node.body));
        case 'DoWhileStatement':
          return new CppDoWhile(this.transformStatement(node.body), this.transformExpression(node.test));
        case 'SwitchStatement':
          return this.transformSwitchStatement(node);
        case 'BreakStatement':
          return new CppBreak();
        case 'ContinueStatement':
          return new CppContinue();
        case 'ThrowStatement':
          return new CppThrow(this.transformExpression(node.argument));
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'BlockStatement':
          return this.transformBlockStatement(node);
        default:
          return null;
      }
    }

    /**
     * Transform variable declaration statement
     */
    transformVariableDeclarationStatement(node) {
      const result = [];

      for (const decl of node.declarations) {
        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          // Transform to individual variable declarations
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new CppElementAccess(sourceExpr, CppLiteral.Int(i));
              const varType = CppType.Auto();

              const varDecl = new CppVariableDeclaration(varName, varType, indexExpr);
              varDecl.isConst = node.kind === 'const';

              this.registerVariableType(elem.name, varType);
              result.push(varDecl);
            }
          }
          continue;
        }

        // Skip ObjectPattern destructuring (framework imports)
        if (decl.id.type === 'ObjectPattern')
          continue;

        const varName = this.toSnakeCase(decl.id.name);
        const varType = decl.init ? this.inferExpressionType(decl.init) : CppType.Auto();
        const initializer = decl.init ? this.transformExpression(decl.init) : null;

        const varDecl = new CppVariableDeclaration(varName, varType, initializer);
        varDecl.isConst = node.kind === 'const';

        this.registerVariableType(decl.id.name, varType);
        result.push(varDecl);
      }

      return result;
    }

    /**
     * Transform if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;
      return new CppIf(condition, thenBranch, elseBranch);
    }

    /**
     * Transform for statement
     */
    transformForStatement(node) {
      const forNode = new CppFor();

      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          const decl = node.init.declarations[0];
          const varName = this.toSnakeCase(decl.id.name);
          const varType = this.inferExpressionType(decl.init);
          forNode.initializer = new CppVariableDeclaration(
            varName,
            varType,
            this.transformExpression(decl.init)
          );
        } else {
          forNode.initializer = this.transformExpression(node.init);
        }
      }

      if (node.test) {
        forNode.condition = this.transformExpression(node.test);
      }

      if (node.update) {
        forNode.incrementor = this.transformExpression(node.update);
      }

      forNode.body = this.transformStatement(node.body);
      return forNode;
    }

    /**
     * Transform JavaScript for...of statement to C++ range-based for loop
     * JS: for (const item of iterable) { ... }
     * C++: for (auto& item : iterable) { ... }
     */
    transformForOfStatement(node) {
      // Get the loop variable name
      let varName;
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        varName = this.toSnakeCase(decl.id ? decl.id.name : 'item');
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      } else {
        varName = 'item';
      }

      // Get the iterable expression
      const iterable = this.transformExpression(node.right);

      // Get the loop body
      const body = this.transformStatement(node.body);

      // Create C++ range-based for loop
      const rangeFor = new CppRangeFor(varName, CppType.Auto(), iterable, body);
      rangeFor.isConst = node.left.kind === 'const';
      rangeFor.isReference = true; // Use auto& by default for efficiency
      return rangeFor;
    }

    /**
     * Transform JavaScript for...in statement to C++ range-based for loop with key iteration
     * JS: for (const key in object) { ... }
     * C++: for (const auto& [key, _] : object) { ... } (or iteration over keys)
     */
    transformForInStatement(node) {
      // Get the loop variable name
      let varName;
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        varName = this.toSnakeCase(decl.id ? decl.id.name : 'key');
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      } else {
        varName = 'key';
      }

      // Get the object expression
      const obj = this.transformExpression(node.right);

      // Get the loop body
      const body = this.transformStatement(node.body);

      // For for-in, we iterate over indices (arrays) or keys (maps)
      // Using range-based for with auto for simplicity
      const rangeFor = new CppRangeFor(varName, CppType.Auto(), obj, body);
      rangeFor.isConst = node.left.kind === 'const';
      return rangeFor;
    }

    /**
     * Transform switch statement
     */
    transformSwitchStatement(node) {
      const switchNode = new CppSwitch(this.transformExpression(node.discriminant));

      for (const caseNode of node.cases) {
        const label = caseNode.test ? this.transformExpression(caseNode.test) : null;
        const switchCase = new CppSwitchCase(label);

        for (const stmt of caseNode.consequent) {
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              switchCase.statements.push(...transformed);
            } else {
              switchCase.statements.push(transformed);
            }
          }
        }

        switchNode.cases.push(switchCase);
      }

      return switchNode;
    }

    /**
     * Transform try statement
     */
    transformTryStatement(node) {
      const tryNode = new CppTryCatch();
      tryNode.tryBlock = this.transformBlockStatement(node.block);

      // ESTree uses 'handler' (singular) not 'handlers' (plural)
      if (node.handler) {
        const handler = node.handler;
        const exceptionType = handler.param ? new CppType('std::exception') : null;
        const varName = handler.param ? this.toSnakeCase(handler.param.name) : 'e';
        const catchClause = new CppCatchClause(
          exceptionType,
          varName,
          this.transformBlockStatement(handler.body)
        );
        tryNode.catchClauses.push(catchClause);
      }

      return tryNode;
    }

    // ========================[ EXPRESSIONS ]========================

    /**
     * Transform expression
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);
        case 'Identifier':
          return new CppIdentifier(this.toSnakeCase(node.name));
        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);
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
        case 'NewExpression':
          return this.transformNewExpression(node);
        case 'ArrayExpression':
          return this.transformArrayExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'ThisExpression':
          return new CppThis();
        case 'ObjectExpression':
          return this.transformObjectExpression(node);
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
          // Lambda expression
          return this.transformLambdaExpression(node);
        case 'SequenceExpression':
          // Return the last expression in the sequence
          if (node.expressions && node.expressions.length > 0) {
            return this.transformExpression(node.expressions[node.expressions.length - 1]);
          }
          return new CppIdentifier('/* empty sequence */');
        case 'SpreadElement':
          // In C++, spread is typically handled by container operations
          // e.g., vec.insert(vec.end(), other.begin(), other.end())
          // For now, just transform the argument
          return this.transformExpression(node.argument);
        case 'Super':
          // super in C++ is the base class name - use parent class directly
          return new CppIdentifier('BaseClass');
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);
        case 'ArrayPattern':
          // ArrayPattern on left side of assignment - not a direct expression
          // This shouldn't typically be reached as transformExpression is for right-side values
          return new CppIdentifier(`/* ArrayPattern: destructuring assignment */`);
        case 'ChainExpression':
          // Optional chaining a?.b in C++ doesn't exist directly
          // Transform the inner expression - null checks would need to be explicit
          return this.transformExpression(node.expression);
        case 'ObjectPattern':
          // Object destructuring on left side - similar to ArrayPattern
          return new CppIdentifier(`/* ObjectPattern: destructuring assignment */`);
        default:
          return new CppIdentifier(`/* unknown expression: ${node.type} */`);
      }
    }

    /**
     * Transform object expression to C++ initializer list
     */
    transformObjectExpression(node) {
      // For simple cases, use initializer list
      // For complex cases, might need struct definition
      const elements = [];
      for (const prop of node.properties) {
        // Just add the transformed value expressions to the initializer list
        // C++ brace-initialization doesn't use keys like JS objects
        const value = this.transformExpression(prop.value);
        if (value)
          elements.push(value);
      }
      return new CppInitializerList(elements);
    }

    /**
     * Transform function expression to lambda
     */
    transformLambdaExpression(node) {
      const params = (node.params || []).map(p => {
        const paramName = this.toSnakeCase(p.name);
        return new CppParameter(paramName, CppType.Auto());
      });

      let body;
      if (node.body.type === 'BlockStatement') {
        body = this.transformBlockStatement(node.body);
      } else {
        // Expression body
        body = new CppBlock();
        body.statements.push(new CppReturn(this.transformExpression(node.body)));
      }

      return new CppLambda(params, body);
    }

    /**
     * Transform literal
     */
    transformLiteral(node) {
      if (node.value === null) return CppLiteral.Nullptr();
      if (typeof node.value === 'boolean') return CppLiteral.Bool(node.value);
      if (typeof node.value === 'string') return CppLiteral.String(node.value);
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return CppLiteral.UInt(node.value);
        }
        return CppLiteral.Double(node.value);
      }
      return CppLiteral.Nullptr();
    }

    /**
     * Transform template literal: `Hello ${name}!` -> std::format("Hello {}!", name) or concatenation
     */
    transformTemplateLiteral(node) {
      // Build string concatenation for C++
      // Since std::format is C++20, use string concatenation for wider compatibility
      const parts = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        const raw = node.quasis[i].value.raw;
        if (raw) {
          parts.push(CppLiteral.String(raw));
        }
        if (i < node.expressions.length) {
          // Wrap expression in std::to_string if needed
          const expr = this.transformExpression(node.expressions[i]);
          // Use std::to_string for numeric types (wrap in function call)
          // CppFunctionCall(target, functionName, args) - null target for simple call
          const toStringCall = new CppFunctionCall(null, 'std::to_string', [expr]);
          parts.push(toStringCall);
        }
      }

      if (parts.length === 0) return CppLiteral.String('');
      if (parts.length === 1) return parts[0];

      // Build concatenation expression
      let result = parts[0];
      for (let i = 1; i < parts.length; ++i) {
        result = new CppBinaryExpression(result, '+', parts[i]);
      }
      return result;
    }

    /**
     * Transform binary expression
     */
    transformBinaryExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      // Map === to == and !== to !=
      let operator = node.operator;
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';
      // Map >>> to >> (C++ doesn't have unsigned right shift operator)
      if (operator === '>>>') operator = '>>';

      return new CppBinaryExpression(left, operator, right);
    }

    /**
     * Transform unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new CppUnaryExpression(node.operator, operand, node.prefix);
    }

    /**
     * Transform update expression (++/--)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new CppUnaryExpression(node.operator, operand, node.prefix);
    }

    /**
     * Transform assignment expression
     */
    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);
      const value = this.transformExpression(node.right);
      return new CppAssignment(target, node.operator, value);
    }

    /**
     * Transform member expression
     */
    transformMemberExpression(node) {
      const target = this.transformExpression(node.object);

      if (node.computed) {
        // Array access - property is an expression
        const index = this.transformExpression(node.property);
        return new CppElementAccess(target, index);
      }

      // Non-computed access - property should have name or value
      const member = node.property.name || node.property.value;
      if (!member) {
        console.warn('Member expression has no property name/value:', node);
        return new CppMemberAccess(target, 'unknown', false);
      }

      const memberName = this.toSnakeCase(member);

      // Special case for 'length' property -> size()
      if (member === 'length') {
        return new CppFunctionCall(target, 'size', []);
      }

      // Handle this.member -> this->member (arrow operator for pointers/objects in C++)
      const useArrow = node.object.type === 'ThisExpression';

      return new CppMemberAccess(target, memberName, useArrow);
    }

    /**
     * Transform call expression
     */
    transformCallExpression(node) {
      const args = node.arguments.map(arg => this.transformExpression(arg));

      if (node.callee.type === 'MemberExpression') {
        const target = this.transformExpression(node.callee.object);
        const method = node.callee.property.name;
        const methodName = this.toSnakeCase(method);

        // Handle OpCodes calls - map to C++ std library or custom implementations
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'OpCodes') {
          return this.transformOpCodesCall(method, args);
        }

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> x (C++ doesn't have freeze, use const for immutability)
          if (method === 'freeze' && args.length === 1)
            return args[0];
          // Object.keys(obj) -> get_keys(obj) - needs helper or std::views::keys
          if (method === 'keys' && args.length === 1)
            return new CppFunctionCall(null, 'get_keys', args);
          // Object.values(obj) -> get_values(obj)
          if (method === 'values' && args.length === 1)
            return new CppFunctionCall(null, 'get_values', args);
          // Object.entries(obj) -> to std::vector<std::pair>
          if (method === 'entries' && args.length === 1)
            return new CppFunctionCall(null, 'get_entries', args);
          // Object.assign -> manual copy
          if (method === 'assign' && args.length >= 2)
            return args[0]; // Return target, assume merge happens elsewhere
        }

        // Array methods
        if (method === 'push') {
          return new CppFunctionCall(target, 'push_back', args);
        }
        if (method === 'pop') {
          return new CppFunctionCall(target, 'pop_back', args);
        }
        if (method === 'shift') {
          return new CppFunctionCall(target, 'erase', [
            new CppFunctionCall(target, 'begin', [])
          ]);
        }
        if (method === 'unshift') {
          return new CppFunctionCall(target, 'insert', [
            new CppFunctionCall(target, 'begin', []),
            ...args
          ]);
        }
        if (method === 'fill') {
          return new CppFunctionCall(
            new CppIdentifier('std::fill'),
            null,
            [
              new CppFunctionCall(target, 'begin', []),
              new CppFunctionCall(target, 'end', []),
              ...args
            ]
          );
        }
        if (method === 'slice') {
          // vec.slice(start, end) -> std::vector(vec.begin() + start, vec.begin() + end)
          const startArg = args[0] || new CppLiteral(0, 'int');
          const endArg = args[1] || new CppFunctionCall(target, 'size', []);
          return new CppObjectCreation(
            CppType.Vector(CppType.Byte()), // Will be inferred
            [
              new CppBinaryExpression(
                new CppFunctionCall(target, 'begin', []),
                '+',
                startArg
              ),
              new CppBinaryExpression(
                new CppFunctionCall(target, 'begin', []),
                '+',
                endArg
              )
            ]
          );
        }

        // Handle this-> for member access
        if (node.callee.object.type === 'ThisExpression') {
          return new CppFunctionCall(
            new CppThis(),
            methodName,
            args,
            true // Use arrow operator
          );
        }

        return new CppFunctionCall(target, methodName, args);
      }

      // Simple function call
      const funcName = node.callee.name ? this.toSnakeCase(node.callee.name) : 'unknown';
      return new CppFunctionCall(null, funcName, args);
    }

    /**
     * Transform OpCodes method calls to C++ equivalents
     */
    transformOpCodesCall(methodName, args) {
      // Map OpCodes methods to C++ std library functions
      const opCodesMap = {
        'RotL32': (a) => `std::rotl(static_cast<uint32_t>(${a[0]}), ${a[1]})`,
        'RotR32': (a) => `std::rotr(static_cast<uint32_t>(${a[0]}), ${a[1]})`,
        'RotL8': (a) => `((${a[0]} << ${a[1]}) | (${a[0]} >> (8 - ${a[1]}))) & 0xFF`,
        'RotR8': (a) => `((${a[0]} >> ${a[1]}) | (${a[0]} << (8 - ${a[1]}))) & 0xFF`,
        'Pack32BE': (a) => `((${a[0]} << 24) | (${a[1]} << 16) | (${a[2]} << 8) | ${a[3]})`,
        'Pack32LE': (a) => `(${a[0]} | (${a[1]} << 8) | (${a[2]} << 16) | (${a[3]} << 24))`,
        'Unpack32BE': (a) => {
          // Returns array of bytes - need special handling
          return new CppIdentifier(`/* Unpack32BE(${a[0]}) */`);
        },
        'Unpack32LE': (a) => {
          return new CppIdentifier(`/* Unpack32LE(${a[0]}) */`);
        },
        'XorArrays': (a) => {
          // std::transform with XOR lambda
          return new CppIdentifier(`/* XorArrays */`);
        }
      };

      const argsStr = args.map(a => {
        if (a.constructor.name === 'CppIdentifier') return a.name;
        if (a.constructor.name === 'CppLiteral') return a.value;
        return '/*expr*/';
      });

      if (opCodesMap[methodName]) {
        const result = opCodesMap[methodName](argsStr);
        if (typeof result === 'string') {
          return new CppIdentifier(result);
        }
        return result;
      }

      // Fallback to OpCodes::method call
      return new CppFunctionCall(
        new CppIdentifier('OpCodes'),
        this.toPascalCase(methodName),
        args
      );
    }

    /**
     * Transform new expression
     */
    transformNewExpression(node) {
      const typeName = node.callee.name;

      // Map TypedArrays to C++ std::vector or std::array
      const typedArrayMap = {
        'Uint8Array': CppType.Byte(),
        'Uint16Array': CppType.UShort(),
        'Uint32Array': CppType.UInt(),
        'Int8Array': CppType.SByte(),
        'Int16Array': CppType.Short(),
        'Int32Array': CppType.Int(),
        'Float32Array': CppType.Float(),
        'Float64Array': CppType.Double()
      };

      if (typedArrayMap[typeName]) {
        const hasArrayInit = node.arguments.length > 0 &&
          node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // new Uint8Array([1, 2, 3]) -> std::vector<uint8_t>{1, 2, 3}
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CppArrayCreation(typedArrayMap[typeName], null, elements);
        }

        // new Uint8Array(n) -> std::vector<uint8_t>(n)
        if (node.arguments.length > 0)
          return new CppArrayCreation(typedArrayMap[typeName], this.transformExpression(node.arguments[0]));
        return new CppArrayCreation(typedArrayMap[typeName]);
      }

      if (typeName === 'Array') {
        if (node.arguments.length > 0) {
          return new CppArrayCreation(CppType.UInt(), this.transformExpression(node.arguments[0]));
        }
        return new CppArrayCreation(CppType.UInt());
      }

      // Regular object creation
      const type = new CppType(this.toPascalCase(typeName));
      const args = node.arguments.map(arg => this.transformExpression(arg));
      return new CppObjectCreation(type, args);
    }

    /**
     * Transform array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      const elemType = node.elements.length > 0 ? this.inferExpressionType(node.elements[0]) : CppType.UInt();
      return new CppArrayCreation(elemType, null, elements);
    }

    /**
     * Transform conditional expression
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);
      return new CppConditional(condition, trueExpr, falseExpr);
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
  const exports = { CppTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CppTransformer = CppTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
