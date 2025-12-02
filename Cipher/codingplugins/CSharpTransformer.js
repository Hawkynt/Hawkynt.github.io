/**
 * CSharpTransformer.js - JavaScript AST to C# AST Transformer
 * Converts type-annotated JavaScript AST to C# AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C# AST -> C# Emitter -> C# Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let CSharpAST;
  if (typeof require !== 'undefined') {
    CSharpAST = require('./CSharpAST.js');
  } else if (global.CSharpAST) {
    CSharpAST = global.CSharpAST;
  }

  const {
    CSharpType, CSharpCompilationUnit, CSharpUsingDirective, CSharpNamespace,
    CSharpClass, CSharpStruct, CSharpField, CSharpProperty, CSharpMethod,
    CSharpConstructor, CSharpParameter, CSharpBlock, CSharpVariableDeclaration,
    CSharpExpressionStatement, CSharpReturn, CSharpIf, CSharpFor, CSharpForEach,
    CSharpWhile, CSharpDoWhile, CSharpSwitch, CSharpSwitchCase, CSharpBreak,
    CSharpContinue, CSharpThrow, CSharpTryCatch, CSharpCatchClause, CSharpRawCode,
    CSharpLiteral, CSharpIdentifier, CSharpBinaryExpression, CSharpUnaryExpression,
    CSharpAssignment, CSharpMemberAccess, CSharpElementAccess, CSharpMethodCall,
    CSharpObjectCreation, CSharpArrayCreation, CSharpObjectInitializer, CSharpCast,
    CSharpConditional, CSharpLambda, CSharpThis, CSharpBase, CSharpTypeOf,
    CSharpIsExpression, CSharpAsExpression, CSharpParenthesized, CSharpTupleExpression,
    CSharpXmlDoc
  } = CSharpAST;

  /**
   * Maps JavaScript/JSDoc types to C# types
   */
  const TYPE_MAP = {
    // Unsigned integers
    'uint8': 'byte', 'byte': 'byte',
    'uint16': 'ushort', 'ushort': 'ushort', 'word': 'ushort',
    'uint32': 'uint', 'uint': 'uint', 'dword': 'uint',
    'uint64': 'ulong', 'ulong': 'ulong', 'qword': 'ulong',
    // Signed integers
    'int8': 'sbyte', 'sbyte': 'sbyte',
    'int16': 'short', 'short': 'short',
    'int32': 'int', 'int': 'int',
    'int64': 'long', 'long': 'long',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'double', 'float64': 'double',
    // In crypto context, JavaScript 'number' typically means uint32 (for bit operations)
    // For floating point, use explicit 'double' or 'float' types
    'number': 'uint',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'string', 'String': 'string',
    'BigInt': 'BigInteger', 'bigint': 'BigInteger',
    'Function': 'Action', 'function': 'Action',  // JS Function -> C# Action/Func
    'void': 'void',
    'object': 'object', 'Object': 'object', 'any': 'object',
    'Array': 'Array', 'array': 'Array'
  };

  /**
   * JavaScript AST to C# AST Transformer
   */
  class CSharpTransformer {
    constructor(options = {}) {
      this.options = options;
      this.typeKnowledge = options.typeKnowledge || null;
      this.parser = options.parser || null;
      this.jsDocParser = options.jsDocParser || null;
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();  // Maps variable name -> CSharpType
      this.classFieldTypes = new Map(); // Maps field name -> CSharpType for this.propName lookups
      this.methodSignatures = new Map(); // Maps "ClassName.MethodName" -> { params: CSharpType[], returnType: CSharpType }
      this.nestedClasses = [];
      this.inlineClasses = [];
      this.currentArrayElementType = null; // Track expected element type for array operations
      this.scopeStack = []; // Stack of variable scopes for nested functions
      this.arrayBufferVariables = new Set(); // Track variables that are ArrayBuffers
    }

    /**
     * Check if a variable name refers to an ArrayBuffer
     */
    isArrayBufferVariable(name) {
      return this.arrayBufferVariables.has(name);
    }

    /**
     * Mark a variable as being an ArrayBuffer (called when we see new ArrayBuffer(...))
     */
    markAsArrayBuffer(node) {
      // This is called from transformNewExpression context
      // We need to find the variable name being assigned to
      // For now, we'll track it via the variable registration
    }

    /**
     * Create a MemoryMarshal.Cast<TFrom, TTo> expression for typed array views
     * MemoryMarshal.Cast<byte, double>(buffer.AsSpan())
     */
    createMemoryMarshalCast(bufferExpr, fromType, toType) {
      // Create: MemoryMarshal.Cast<fromType, toType>(buffer)
      const spanExpr = new CSharpMethodCall(bufferExpr, 'AsSpan', []);
      return new CSharpMethodCall(
        new CSharpIdentifier('MemoryMarshal'),
        `Cast<${fromType}, ${toType}>`,
        [spanExpr]
      );
    }

    /**
     * Register a method's signature for type propagation at call sites
     * @param {string} className - The class name
     * @param {string} methodName - The method name
     * @param {CSharpType[]} paramTypes - Array of parameter types
     * @param {CSharpType} returnType - The return type
     */
    registerMethodSignature(className, methodName, paramTypes, returnType) {
      const key = `${className}.${methodName}`;
      this.methodSignatures.set(key, { params: paramTypes, returnType });
    }

    /**
     * Get a method's parameter types for casting arguments at call sites
     * @param {string} className - The class name
     * @param {string} methodName - The method name
     * @returns {{ params: CSharpType[], returnType: CSharpType }|null}
     */
    getMethodSignature(className, methodName) {
      const key = `${className}.${methodName}`;
      return this.methodSignatures.get(key) || null;
    }

    /**
     * Get inherited method signature from framework types
     * Searches up the inheritance chain for method definitions
     * @param {string} baseClassName - The base class name (e.g., 'BlockCipherAlgorithm', 'IBlockCipherInstance')
     * @param {string} methodName - The method name (e.g., 'CreateInstance', 'Feed', 'Result')
     * @returns {{ params: string[], returns: string }|null}
     */
    getInheritedMethodSignature(baseClassName, methodName) {
      if (!this.typeKnowledge?.frameworkTypes) return null;

      // Check the base class directly
      let classInfo = this.typeKnowledge.frameworkTypes[baseClassName];
      while (classInfo) {
        if (classInfo.methods && classInfo.methods[methodName]) {
          return classInfo.methods[methodName];
        }
        // Walk up the inheritance chain
        if (classInfo.extends) {
          classInfo = this.typeKnowledge.frameworkTypes[classInfo.extends];
        } else {
          break;
        }
      }
      return null;
    }

    /**
     * Get inherited property type from framework types
     * Searches up the inheritance chain for property definitions
     * @param {string} baseClassName - The base class name
     * @param {string} propertyName - The property name
     * @returns {string|null} The property type or null
     */
    getInheritedPropertyType(baseClassName, propertyName) {
      if (!this.typeKnowledge?.frameworkTypes) return null;

      // Check the base class directly
      let classInfo = this.typeKnowledge.frameworkTypes[baseClassName];
      while (classInfo) {
        if (classInfo.properties && classInfo.properties[propertyName]) {
          return classInfo.properties[propertyName];
        }
        // Walk up the inheritance chain
        if (classInfo.extends) {
          classInfo = this.typeKnowledge.frameworkTypes[classInfo.extends];
        } else {
          break;
        }
      }
      return null;
    }

    // ========================[ TYPE KNOWLEDGE HELPERS ]========================

    /**
     * Get return type for an OpCodes method call
     * @param {string} methodName - The method name (e.g., 'RotL32', 'Pack32BE')
     * @returns {CSharpType|null} The return type or null if unknown
     */
    getOpCodesReturnType(methodName) {
      if (!this.typeKnowledge?.opCodesTypes) return null;

      const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
      if (!methodInfo) return null;

      return this.mapTypeFromKnowledge(methodInfo.returns);
    }

    /**
     * Get parameter types for an OpCodes method call
     * @param {string} methodName - The method name
     * @returns {CSharpType[]|null} Array of parameter types or null if unknown
     */
    getOpCodesParamTypes(methodName) {
      if (!this.typeKnowledge?.opCodesTypes) return null;

      const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
      if (!methodInfo) return null;

      return methodInfo.params.map(p => this.mapTypeFromKnowledge(p));
    }

    /**
     * Map a type string from PreciseTypeKnowledge to CSharpType
     * @param {string|object} typeName - Type name like 'byte', 'dword', 'byte[]' or type object with isTuple
     * @returns {CSharpType} The C# type
     */
    mapTypeFromKnowledge(typeName) {
      if (!typeName) return CSharpType.Object();

      // Handle type object with isTuple flag (from JSDoc parsing)
      if (typeof typeName === 'object') {
        if (typeName.isTuple && typeName.tupleElements) {
          return this.createTupleType(typeName.tupleElements);
        }
        // If it's a type object with a name property, extract it
        if (typeName.name) {
          return this.mapTypeFromKnowledge(typeName.name);
        }
        return CSharpType.Object();
      }

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapTypeFromKnowledge(elementTypeName);
        return CSharpType.Array(elementType);
      }

      // Handle tuple syntax: (name: type, name: type, ...)
      if (typeName.startsWith('(') && typeName.endsWith(')')) {
        const tupleElements = this.parseTupleTypeString(typeName);
        if (tupleElements.length > 0) {
          return this.createTupleType(tupleElements);
        }
      }

      // Map crypto type names to C# types
      const typeMap = {
        'byte': CSharpType.Byte(),
        'sbyte': new CSharpType('sbyte'),
        'word': CSharpType.UShort(),
        'ushort': CSharpType.UShort(),
        'short': new CSharpType('short'),
        'dword': CSharpType.UInt(),
        'uint': CSharpType.UInt(),
        'uint8': CSharpType.Byte(),
        'uint16': CSharpType.UShort(),
        'uint32': CSharpType.UInt(),
        'uint64': new CSharpType('ulong'),
        'int': CSharpType.Int(),
        'int8': new CSharpType('sbyte'),
        'int16': new CSharpType('short'),
        'int32': CSharpType.Int(),
        'int64': new CSharpType('long'),
        'qword': new CSharpType('ulong'),
        'long': new CSharpType('long'),
        'float': new CSharpType('float'),
        'float32': new CSharpType('float'),
        'double': CSharpType.Double(),
        'float64': CSharpType.Double(),
        'boolean': CSharpType.Bool(),
        'bool': CSharpType.Bool(),
        'string': CSharpType.String(),
        'void': CSharpType.Void(),
        'Object': CSharpType.Object(),
        'object': CSharpType.Object()
      };

      return typeMap[typeName] || CSharpType.Object();
    }

    /**
     * Parse tuple type string like "(high32: uint32, low32: uint32)"
     * @param {string} tupleStr - The tuple type string
     * @returns {Array<{name: string, type: object}>} Parsed tuple elements
     */
    parseTupleTypeString(tupleStr) {
      // Remove parentheses
      const inner = tupleStr.slice(1, -1).trim();
      if (!inner) return [];

      const elements = [];
      // Split by comma but handle nested types
      const parts = inner.split(',').map(p => p.trim());

      for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx > 0) {
          const name = part.substring(0, colonIdx).trim();
          const typePart = part.substring(colonIdx + 1).trim();
          elements.push({ name, type: { name: typePart } });
        } else if (part) {
          // No type specified, default to uint for crypto context
          elements.push({ name: part.trim(), type: { name: 'uint32' } });
        }
      }
      return elements;
    }

    /**
     * Create a C# tuple type from tuple elements
     * @param {Array<{name: string, type: object}>} elements - Tuple elements
     * @returns {CSharpType} The C# tuple type
     */
    createTupleType(elements) {
      const elementTypes = elements.map(e => ({
        name: e.name,
        type: this.mapTypeFromKnowledge(e.type?.name || e.type || 'uint')
      }));

      // Build tuple type name like "(uint high32, uint low32)"
      const typeStr = '(' + elementTypes.map(e => `${e.type.name} ${e.name}`).join(', ') + ')';
      const tupleType = new CSharpType(typeStr);
      tupleType.isTuple = true;
      tupleType.tupleElements = elementTypes;
      return tupleType;
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
     * Cast method arguments to match expected parameter types from method signature
     * This enables bidirectional type propagation: declaration types flow to call sites
     * @param {Object} calleeObject - The AST node for the object being called on (e.g., 'this')
     * @param {string} methodName - The method name (PascalCase)
     * @param {Array} transformedArgs - Already transformed argument expressions
     * @param {Array} originalArgs - Original AST argument nodes (for type inference)
     * @returns {Array} Arguments with casts added where needed
     */
    castArgumentsToParameterTypes(calleeObject, methodName, transformedArgs, originalArgs) {
      // Determine the class name to look up method signature
      let className = null;

      if (calleeObject.type === 'ThisExpression' && this.currentClass) {
        className = this.currentClass.name;
      } else if (calleeObject.type === 'Identifier' && calleeObject.name === 'this' && this.currentClass) {
        className = this.currentClass.name;
      }
      // Could also handle OpCodes.MethodName, etc. in the future

      if (!className) {
        return transformedArgs; // No signature lookup possible
      }

      const signature = this.getMethodSignature(className, methodName);
      if (!signature || !signature.params || signature.params.length === 0) {
        return transformedArgs; // No signature registered
      }

      const result = [];
      for (let i = 0; i < transformedArgs.length; i++) {
        const arg = transformedArgs[i];
        const expectedType = signature.params[i];

        if (!expectedType) {
          result.push(arg); // No expected type for this parameter
          continue;
        }

        // Infer the actual type of the argument
        const actualType = i < originalArgs.length ? this.inferFullExpressionType(originalArgs[i]) : null;

        // Check if types match or if we need to cast
        if (actualType && this.needsCast(actualType, expectedType)) {
          result.push(new CSharpCast(expectedType, arg));
        } else {
          result.push(arg);
        }
      }

      return result;
    }

    /**
     * Check if a cast is needed between two types
     * @param {CSharpType} fromType - The source type
     * @param {CSharpType} toType - The target type
     * @returns {boolean} True if a cast is needed
     */
    needsCast(fromType, toType) {
      if (!fromType || !toType) return false;
      if (fromType.name === toType.name) return false;

      // Common cases where int -> uint cast is needed
      if (fromType.name === 'int' && toType.name === 'uint') return true;
      if (fromType.name === 'int' && toType.name === 'byte') return true;
      if (fromType.name === 'int' && toType.name === 'ushort') return true;
      if (fromType.name === 'int' && toType.name === 'ulong') return true;

      // uint -> other unsigned types
      if (fromType.name === 'uint' && toType.name === 'byte') return true;
      if (fromType.name === 'uint' && toType.name === 'ushort') return true;

      // long -> smaller types
      if (fromType.name === 'long' && toType.name === 'int') return true;
      if (fromType.name === 'long' && toType.name === 'uint') return true;

      // Widening that C# doesn't do implicitly for unsigned
      if (fromType.name === 'byte' && toType.name === 'uint') return false; // implicit ok
      if (fromType.name === 'ushort' && toType.name === 'uint') return false; // implicit ok

      return false;
    }

    /**
     * Pre-analyze function body to infer variable types from assignments and returns
     * This enables backwards type inference:
     * - if `x = param` where param has known type, then x should have the same type
     * - if `return x` where method returns T[], then x should be T[]
     * @param {Object} bodyNode - The function body AST node
     * @param {CSharpType} [returnType] - The method's return type for backwards inference
     */
    preAnalyzeBody(bodyNode, returnType = null) {
      if (!bodyNode || bodyNode.type !== 'BlockStatement') return;

      // First pass: collect all variable declarations
      const varDecls = new Map(); // varName -> declarator node

      // Type hints from backwards inference
      const varTypeHints = new Map(); // varName -> CSharpType

      const collectVarDecls = (node) => {
        if (!node) return;
        if (node.type === 'VariableDeclaration') {
          for (const decl of node.declarations) {
            if (decl.id?.name) {
              varDecls.set(decl.id.name, decl);
            }
          }
        }
        // Recurse into child nodes
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              child.forEach(collectVarDecls);
            } else if (child.type) {
              collectVarDecls(child);
            }
          }
        }
      };

      const findTypeHints = (node) => {
        if (!node) return;

        // Look for: param = localVar (assignment to parameter)
        if (node.type === 'AssignmentExpression' && node.operator === '=') {
          const left = node.left;
          const right = node.right;
          // If left is a parameter with known type, and right is a local var
          if (left.type === 'Identifier' && right.type === 'Identifier') {
            const paramType = this.getVariableType(left.name);
            if (paramType && varDecls.has(right.name)) {
              // The local var should have same type as parameter
              varTypeHints.set(right.name, paramType);
            }
          }
        }

        // Look for: return localVar (return statement with local variable)
        if (node.type === 'ReturnStatement' && returnType && node.argument) {
          if (node.argument.type === 'Identifier' && varDecls.has(node.argument.name)) {
            // The local var should have same type as return type
            varTypeHints.set(node.argument.name, returnType);
          }
        }

        // Recurse
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              child.forEach(findTypeHints);
            } else if (child.type) {
              findTypeHints(child);
            }
          }
        }
      };

      collectVarDecls(bodyNode);
      findTypeHints(bodyNode);

      // Register the inferred types
      for (const [varName, type] of varTypeHints) {
        this.registerVariableType(varName, type);
      }

      return varTypeHints;
    }

    /**
     * Infer the type of an expression using all available information
     * @param {Object} node - AST node
     * @returns {CSharpType} The inferred type
     */
    inferFullExpressionType(node) {
      if (!node) return CSharpType.Object();

      switch (node.type) {
        case 'Literal':
          return this.inferLiteralType(node);

        case 'Identifier':
          // Check registered variable type first
          const varType = this.getVariableType(node.name);
          if (varType) return varType;
          // Fall back to pattern-based inference
          return this.inferTypeFromName(node.name);

        case 'CallExpression':
          return this.inferCallExpressionType(node);

        case 'MemberExpression':
          return this.inferMemberExpressionType(node);

        case 'ArrayExpression':
          return this.inferArrayExpressionType(node);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.inferBinaryExpressionType(node);

        case 'ConditionalExpression':
          // Use the wider of the consequent and alternate types
          // e.g., condition ? uint : int should be uint (or long in C# mixing rules)
          const consType = this.inferFullExpressionType(node.consequent);
          const altType = this.inferFullExpressionType(node.alternate);
          return this.getWiderType(consType, altType);

        case 'NewExpression':
          return this.inferNewExpressionType(node);

        default:
          return CSharpType.Object();
      }
    }

    /**
     * Infer type from a literal value
     */
    inferLiteralType(node) {
      if (node.value === null) return CSharpType.Object();
      if (typeof node.value === 'boolean') return CSharpType.Bool();
      if (typeof node.value === 'string') return CSharpType.String();
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          // In C#, integer literals are typed based on their value:
          // - Fits in int (-2147483648 to 2147483647) → int
          // - Fits in uint (0 to 4294967295) → uint
          // - Larger → long or ulong
          const INT_MAX = 2147483647;
          const INT_MIN = -2147483648;
          const UINT_MAX = 4294967295;

          if (node.value >= INT_MIN && node.value <= INT_MAX) {
            return CSharpType.Int();
          }
          if (node.value >= 0 && node.value <= UINT_MAX) {
            return CSharpType.UInt();
          }
          // For larger values, use long
          return CSharpType.Long();
        }
        return CSharpType.Double();
      }
      return CSharpType.Object();
    }

    /**
     * Infer type from a method call
     */
    inferCallExpressionType(node) {
      if (node.callee.type === 'MemberExpression') {
        const obj = node.callee.object;
        const method = node.callee.property.name || node.callee.property.value;

        // Check OpCodes methods
        if (obj.type === 'Identifier' && obj.name === 'OpCodes') {
          const returnType = this.getOpCodesReturnType(method);
          if (returnType) return returnType;
        }

        // Check OpCodes nested class methods (e.g., OpCodes.UInt64.add)
        if (obj.type === 'MemberExpression' &&
            obj.object.type === 'Identifier' &&
            obj.object.name === 'OpCodes') {
          const nestedClass = obj.property.name || obj.property.value;
          const fullMethod = `${nestedClass}.${method}`;
          const returnType = this.getOpCodesReturnType(fullMethod);
          if (returnType) return returnType;
        }

        // Math methods - return the type of the first argument
        if (obj.type === 'Identifier' && obj.name === 'Math') {
          if (method === 'min' || method === 'max' || method === 'abs' ||
              method === 'floor' || method === 'ceil' || method === 'round' ||
              method === 'Min' || method === 'Max' || method === 'Abs' ||
              method === 'Floor' || method === 'Ceil' || method === 'Round') {
            if (node.arguments && node.arguments.length > 0) {
              const firstArgType = this.inferFullExpressionType(node.arguments[0]);
              // Math.Floor/Ceil return the same type as input in crypto context
              if (firstArgType?.name !== 'object') {
                return firstArgType;
              }
            }
          }
          // Default to double for Math methods
          return CSharpType.Double();
        }

        // Array methods
        const objType = this.inferFullExpressionType(obj);

        // Special case: new Array(n).fill(value) - the fill value determines element type
        if (method === 'fill' && obj.type === 'NewExpression' &&
            obj.callee.type === 'Identifier' && obj.callee.name === 'Array') {
          // Element type is inferred from fill argument, default to int (since fill(0) is common)
          if (node.arguments && node.arguments.length > 0) {
            const fillArgType = this.inferFullExpressionType(node.arguments[0]);
            if (fillArgType && fillArgType.name !== 'object') {
              return CSharpType.Array(fillArgType);
            }
          }
          return CSharpType.Array(CSharpType.Int()); // Default for fill(0)
        }

        if (objType.isArray) {
          if (method === 'slice' || method === 'concat' || method === 'filter' || method === 'fill') {
            return objType; // Returns same array type
          }
          if (method === 'length') {
            return CSharpType.Int();
          }
          if (method === 'pop' || method === 'shift') {
            return objType.elementType || CSharpType.Object();
          }
        }
      }

      return CSharpType.Object();
    }

    /**
     * Infer type from member access
     */
    inferMemberExpressionType(node) {
      const propName = node.property.name || node.property.value;

      // Array length
      if (propName === 'length') {
        return CSharpType.Int();
      }

      // Check for this.propName - look up class field type
      if (node.object.type === 'ThisExpression') {
        const pascalName = this.toPascalCase(propName);
        const fieldType = this.classFieldTypes.get(pascalName);
        if (fieldType) {
          return fieldType;
        }
      }

      // Get the object's type
      const objType = this.inferFullExpressionType(node.object);

      // Tuple member access - return the element type
      if (objType?.isTuple && objType.tupleElements) {
        const element = objType.tupleElements.find(e => e.name === propName);
        if (element) {
          return element.type;
        }
      }

      // Array indexed access
      if (objType?.isArray && node.computed) {
        return objType.elementType || CSharpType.Object();
      }

      // Check for known variable property types
      if (node.object.type === 'Identifier') {
        const varType = this.getVariableType(node.object.name);
        if (varType?.isArray && node.computed) {
          // array[index] returns element type
          return varType.elementType || CSharpType.Object();
        }
        if (varType?.isTuple && varType.tupleElements) {
          const element = varType.tupleElements.find(e => e.name === propName);
          if (element) {
            return element.type;
          }
        }
      }

      return CSharpType.Object();
    }

    /**
     * Infer type from array expression
     */
    inferArrayExpressionType(node) {
      if (node.elements.length > 0) {
        const firstElemType = this.inferFullExpressionType(node.elements[0]);
        return CSharpType.Array(firstElemType);
      }
      return CSharpType.Array(CSharpType.UInt()); // Default for crypto
    }

    /**
     * Infer type from binary expression
     */
    inferBinaryExpressionType(node) {
      const op = node.operator;

      // Comparison operators return bool
      if (['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(op)) {
        return CSharpType.Bool();
      }

      // Logical operators return bool
      if (['&&', '||'].includes(op)) {
        return CSharpType.Bool();
      }

      // JavaScript >>> 0 idiom: explicitly coerces to unsigned 32-bit
      // This is the key pattern for type inference!
      if (op === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        return CSharpType.UInt();
      }

      // Unsigned right shift (>>>) on uint returns uint
      if (op === '>>>') {
        const leftType = this.inferFullExpressionType(node.left);
        if (leftType?.name === 'uint' || leftType?.name === 'dword') {
          return CSharpType.UInt();
        }
        // In C#, >>> on signed types returns the same signed type promoted to at least int
        // But for crypto purposes, treat >>> as returning uint
        return CSharpType.UInt();
      }

      const leftType = this.inferFullExpressionType(node.left);
      const rightType = this.inferFullExpressionType(node.right);

      // In C#, bitwise and shift operators follow numeric promotion rules
      const isBitwiseOp = ['&', '|', '^', '~'].includes(op);
      const isShiftOp = ['<<', '>>'].includes(op);

      if (isBitwiseOp) {
        // Bitwise ops: result type is the wider of the two operand types
        // uint & long → long (must use getWiderType for proper promotion)
        return this.getWiderType(leftType, rightType);
      }

      if (isShiftOp) {
        // Shift ops: result type is the left operand's type (promoted to at least int)
        const smallTypes = ['byte', 'sbyte', 'short', 'ushort'];
        if (smallTypes.includes(leftType?.name)) {
          return CSharpType.Int();
        }
        return leftType || CSharpType.Int();
      }

      // For arithmetic, use the wider of the two operand types
      return this.getWiderType(leftType, rightType);
    }

    /**
     * Infer type from new expression
     */
    inferNewExpressionType(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;

        // Check if this is a TypedArray view over an ArrayBuffer
        const isBufferView = node.arguments.length > 0 &&
          node.arguments[0].type === 'Identifier' &&
          this.isArrayBufferVariable(node.arguments[0].name);

        // Map JavaScript typed arrays to C# equivalents
        // When creating a view over ArrayBuffer, use Span<T> type
        if (typeName === 'Uint8Array') {
          return isBufferView ? CSharpType.Array(CSharpType.Byte()) : CSharpType.Array(CSharpType.Byte());
        }
        if (typeName === 'Uint16Array') {
          return isBufferView ? new CSharpType('Span', { isGeneric: true, genericArguments: [CSharpType.UShort()] }) : CSharpType.Array(CSharpType.UShort());
        }
        if (typeName === 'Uint32Array') {
          return isBufferView ? new CSharpType('Span', { isGeneric: true, genericArguments: [CSharpType.UInt()] }) : CSharpType.Array(CSharpType.UInt());
        }
        if (typeName === 'Int8Array') {
          return isBufferView ? new CSharpType('Span', { isGeneric: true, genericArguments: [CSharpType.SByte()] }) : CSharpType.Array(CSharpType.SByte());
        }
        if (typeName === 'Int16Array') {
          return isBufferView ? new CSharpType('Span', { isGeneric: true, genericArguments: [CSharpType.Short()] }) : CSharpType.Array(CSharpType.Short());
        }
        if (typeName === 'Int32Array') {
          return isBufferView ? new CSharpType('Span', { isGeneric: true, genericArguments: [CSharpType.Int()] }) : CSharpType.Array(CSharpType.Int());
        }
        if (typeName === 'Float32Array') {
          return isBufferView ? new CSharpType('Span', { isGeneric: true, genericArguments: [CSharpType.Float()] }) : CSharpType.Array(CSharpType.Float());
        }
        if (typeName === 'Float64Array') {
          return isBufferView ? new CSharpType('Span', { isGeneric: true, genericArguments: [CSharpType.Double()] }) : CSharpType.Array(CSharpType.Double());
        }
        if (typeName === 'Array') return CSharpType.Array(CSharpType.UInt());
        if (typeName === 'ArrayBuffer') return CSharpType.Array(CSharpType.Byte());
        // For custom class constructors, return the class type
        return new CSharpType(this.toPascalCase(typeName));
      }

      // Handle member expression callees like new OpCodes._BitStream()
      if (node.callee.type === 'MemberExpression') {
        const propName = node.callee.property.name || node.callee.property.value;
        // Return the class type (PascalCase)
        return new CSharpType(this.toPascalCase(propName));
      }

      return CSharpType.Object();
    }

    /**
     * Infer type from variable/parameter name using patterns
     */
    inferTypeFromName(name) {
      if (!name) return CSharpType.UInt();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return CSharpType.Byte();
      }

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('counter') ||
          lowerName.includes('state') || lowerName.includes('nonce') ||
          lowerName.includes('iv') || lowerName.includes('tag')) {
        return CSharpType.Array(CSharpType.Byte());
      }

      // Integer-related names
      if (lowerName.includes('shift') || lowerName.includes('position') ||
          lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return CSharpType.Int();
      }

      // Default to uint for crypto operations
      return CSharpType.UInt();
    }

    /**
     * Get the wider of two numeric types following C# numeric promotion rules
     */
    getWiderType(type1, type2) {
      if (!type1 || !type2) return type1 || type2 || CSharpType.UInt();

      // C# numeric promotion rules:
      // - uint + uint → uint
      // - uint + int → long (mixed signed/unsigned same width)
      // - uint + smaller unsigned → uint
      // - int + int → int

      const unsignedTypes = ['byte', 'ushort', 'uint', 'ulong'];
      const signedTypes = ['sbyte', 'short', 'int', 'long'];

      const isUnsigned1 = unsignedTypes.includes(type1.name);
      const isUnsigned2 = unsignedTypes.includes(type2.name);

      // Both unsigned - use the wider unsigned type
      if (isUnsigned1 && isUnsigned2) {
        const widths = { 'byte': 8, 'ushort': 16, 'uint': 32, 'ulong': 64 };
        const w1 = widths[type1.name] || 0;
        const w2 = widths[type2.name] || 0;
        return w1 >= w2 ? type1 : type2;
      }

      // Both signed - use the wider signed type
      if (!isUnsigned1 && !isUnsigned2) {
        const widths = { 'sbyte': 8, 'short': 16, 'int': 32, 'long': 64 };
        const w1 = widths[type1.name] || 32;
        const w2 = widths[type2.name] || 32;
        return w1 >= w2 ? type1 : type2;
      }

      // Mixed signed/unsigned - C# promotes to a larger signed type
      // uint + int → long
      // ushort + int → int
      // byte + int → int
      const widths = {
        'byte': 8, 'sbyte': 8,
        'ushort': 16, 'short': 16,
        'uint': 32, 'int': 32,
        'ulong': 64, 'long': 64
      };

      const w1 = widths[type1.name] || 0;
      const w2 = widths[type2.name] || 0;

      // If one is uint (32-bit unsigned) and other is int (32-bit signed), result is long
      if ((type1.name === 'uint' && type2.name === 'int') ||
          (type1.name === 'int' && type2.name === 'uint')) {
        return CSharpType.Long();
      }

      // For other mixed cases, promote to the wider type
      // But if widths are equal, prefer signed
      if (w1 === w2) {
        return signedTypes.includes(type1.name) ? type1 : type2;
      }

      return w1 > w2 ? type1 : type2;
    }

    /**
     * Check if we need to cast from sourceType to targetType
     * @returns {boolean} True if cast is needed
     */
    needsCast(sourceType, targetType) {
      if (!sourceType || !targetType) return false;
      if (sourceType.name === targetType.name) return false;

      // Check if source can be implicitly converted to target
      const implicitConversions = {
        'byte': ['ushort', 'short', 'uint', 'int', 'ulong', 'long', 'float', 'double'],
        'sbyte': ['short', 'int', 'long', 'float', 'double'],
        'ushort': ['uint', 'int', 'ulong', 'long', 'float', 'double'],
        'short': ['int', 'long', 'float', 'double'],
        'uint': ['ulong', 'long', 'double'],
        'int': ['long', 'double'],
        'ulong': ['double'],
        'long': ['double'],
        'float': ['double']
      };

      const allowed = implicitConversions[sourceType.name];
      if (allowed && allowed.includes(targetType.name)) {
        return false; // Implicit conversion allowed
      }

      return true; // Cast needed
    }

    /**
     * Create a cast expression if needed
     */
    createCastIfNeeded(expression, sourceType, targetType) {
      if (!this.needsCast(sourceType, targetType)) {
        return expression;
      }
      return new CSharpCast(targetType, expression);
    }

    /**
     * Transform a JavaScript AST to a C# AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {CSharpCompilationUnit} C# AST
     */
    transform(jsAst) {
      const unit = new CSharpCompilationUnit();

      // Standard usings for crypto code
      unit.usings.push(new CSharpUsingDirective('System'));
      unit.usings.push(new CSharpUsingDirective('System.Collections.Generic'));
      unit.usings.push(new CSharpUsingDirective('System.Linq'));
      unit.usings.push(new CSharpUsingDirective('System.Numerics'));

      // Create namespace
      unit.namespace = new CSharpNamespace(this.options.namespace || 'Generated');

      // Create main class with customizable name
      const mainClassName = this.options.className || 'GeneratedClass';
      const mainClass = new CSharpClass(mainClassName);
      mainClass.xmlDoc = this.createXmlDoc('Generated C# code', 'This file was automatically generated from JavaScript AST');
      unit.namespace.types.push(mainClass);

      // Add Main method
      const mainMethod = new CSharpMethod('Main', CSharpType.Void());
      mainMethod.isStatic = true;
      mainMethod.parameters.push(new CSharpParameter('args', CSharpType.Array(CSharpType.String())));
      mainMethod.xmlDoc = this.createXmlDoc('Main entry point for testing');
      mainMethod.body = new CSharpBlock();
      mainMethod.body.statements.push(
        new CSharpExpressionStatement(
          new CSharpMethodCall(new CSharpIdentifier('Console'), 'WriteLine', [CSharpLiteral.String('Generated code execution')])
        )
      );
      mainClass.members.push(mainMethod);

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, mainClass);
        }
      }

      // Add nested classes generated during transformation
      for (const nc of this.nestedClasses) {
        mainClass.nestedTypes.push(nc);
      }

      // Add inline classes
      for (const ic of this.inlineClasses) {
        mainClass.nestedTypes.push(ic);
      }

      return unit;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetClass) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetClass);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetClass);
          break;

        case 'ExpressionStatement':
          this.transformExpressionStatement(node, targetClass);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetClass);
          break;

        default:
          // Silently skip unhandled top-level node types (e.g. IfStatement IIFE guards)
          break;
      }
    }

    /**
     * Transform a variable declaration (const/let/var)
     */
    transformVariableDeclaration(node, targetClass) {
      const isConst = node.kind === 'const';

      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Handle ObjectPattern destructuring - skip (imports framework types)
        if (decl.id.type === 'ObjectPattern') {
          // e.g., const { RegisterAlgorithm, CategoryType } = AlgorithmFramework
          // These are just imports - skip them, the types are used directly
          continue;
        }

        // Handle ArrayPattern destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const fieldName = this.toPascalCase(elem.name);
              const indexExpr = new CSharpElementAccess(sourceExpr, CSharpLiteral.Int(i));
              const fieldType = CSharpType.Var();

              const field = new CSharpField(fieldName, fieldType);
              field.isStatic = true;
              field.isReadOnly = isConst;
              field.initializer = indexExpr;
              targetClass.members.push(field);

              this.variableTypes.set(elem.name, fieldType);
            }
          }
          continue;
        }

        const name = decl.id.name;
        if (!name) continue;

        // Check if this is an object literal defining a namespace/static class
        if (decl.init.type === 'ObjectExpression') {
          const staticClass = this.transformObjectToStaticClass(name, decl.init);
          if (staticClass) {
            targetClass.nestedTypes.push(staticClass);
          }
        }
        // Check if this is an IIFE (immediately invoked function expression)
        else if (decl.init.type === 'CallExpression' &&
                 (decl.init.callee.type === 'FunctionExpression' ||
                  decl.init.callee.type === 'ArrowFunctionExpression')) {
          // IIFE pattern: check if it returns something (result assigned to variable)
          // vs. just executing code (side effects only)
          const returnValue = this.getIIFEReturnValue(decl.init);
          if (returnValue) {
            // First extract any local declarations from the IIFE as private static fields
            this.extractIIFELocalDeclarations(decl.init, targetClass);

            // IIFE returns a value - create a static field with that value
            const fieldType = this.inferFullExpressionType(returnValue) || new CSharpType('object');
            const field = new CSharpField(this.toPascalCase(name), fieldType);
            field.isStatic = true;
            field.isReadOnly = isConst;
            field.initializer = this.transformExpression(returnValue);
            targetClass.members.push(field);
          } else {
            // IIFE just executes code - extract content as top-level declarations
            this.transformIIFE(decl.init, targetClass);
          }
        }
        // Handle simple literals and expressions as static fields/constants
        else if (decl.init.type === 'Literal' ||
                 decl.init.type === 'ArrayExpression' ||
                 decl.init.type === 'UnaryExpression' ||
                 decl.init.type === 'BinaryExpression' ||
                 decl.init.type === 'CallExpression' ||
                 decl.init.type === 'NewExpression') {
          const fieldType = this.inferFullExpressionType(decl.init) || new CSharpType('object');
          const field = new CSharpField(this.toPascalCase(name), fieldType);
          field.isStatic = true;
          field.isReadOnly = isConst;
          field.initializer = this.transformExpression(decl.init);
          targetClass.members.push(field);

          // Register the variable type for later lookups
          this.variableTypes.set(name, fieldType);
        }
        // Handle function expressions as static methods
        else if (decl.init.type === 'FunctionExpression' || decl.init.type === 'ArrowFunctionExpression') {
          const method = this.transformFunctionToMethod(name, decl.init);
          method.isStatic = true;
          targetClass.members.push(method);
        }
      }
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

      // Check the last statement
      const lastStmt = body[body.length - 1];
      if (lastStmt.type === 'ReturnStatement' && lastStmt.argument) {
        return lastStmt.argument;
      }

      return null;
    }

    /**
     * Extract local variable declarations from an IIFE and add them as static fields
     * Used when an IIFE returns a value that references its local variables
     */
    extractIIFELocalDeclarations(callNode, targetClass) {
      const func = callNode.callee;
      if (!func.body || func.body.type !== 'BlockStatement') {
        return;
      }

      const body = func.body.body;
      if (!body || body.length === 0) return;

      for (const stmt of body) {
        if (stmt.type === 'VariableDeclaration') {
          const isConst = stmt.kind === 'const';
          for (const decl of stmt.declarations) {
            if (!decl.init || !decl.id.name) continue;

            // Skip the return statement's variable if it matches
            const name = decl.id.name;

            // Create a private static field for each local declaration
            const fieldType = this.inferFullExpressionType(decl.init) || new CSharpType('object');
            const field = new CSharpField(this.toPascalCase(name), fieldType);
            field.accessModifier = 'private';
            field.isStatic = true;
            field.isReadOnly = isConst;
            field.initializer = this.transformExpression(decl.init);
            targetClass.members.push(field);

            // Register for later lookup
            this.variableTypes.set(name, fieldType);
          }
        }
      }
    }

    /**
     * Transform an object literal to a static class
     */
    transformObjectToStaticClass(name, objNode) {
      const staticClass = new CSharpClass(this.toPascalCase(name));
      staticClass.isStatic = true;

      // Set current class context for method transformations
      const prevClass = this.currentClass;
      this.currentClass = staticClass;

      for (const prop of objNode.properties) {
        const propName = prop.key.name || prop.key.value;
        const propValue = prop.value;

        // Copy leading comments from property to value so JSDoc annotations are preserved
        if (prop.leadingComments && !propValue.leadingComments) {
          propValue.leadingComments = prop.leadingComments;
        }

        if (prop.method || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          // Check if this is a constructor function (uses this.* assignments for fields/methods)
          if (this.isConstructorFunction(propValue)) {
            // Generate a nested class instead of a method
            const nestedClass = this.transformConstructorToClass(propName, propValue);
            if (nestedClass) {
              staticClass.nestedTypes.push(nestedClass);
            }
          } else {
            // Regular method
            const method = this.transformFunctionToMethod(propName, propValue);
            staticClass.members.push(method);
          }
        }
        else if (propValue.type === 'ObjectExpression') {
          // Nested static class
          const nestedClass = this.transformObjectToStaticClass(propName, propValue);
          if (nestedClass) {
            staticClass.nestedTypes.push(nestedClass);
          }
        }
        else {
          // Field - check for JSDoc type annotation
          let fieldType = null;
          if (prop.leadingComments) {
            for (const comment of prop.leadingComments) {
              const typeMatch = comment.value && comment.value.match(/@type\s+\{([^}]+)\}/);
              if (typeMatch) {
                fieldType = this.mapType(typeMatch[1].trim());
                break;
              }
            }
          }
          const field = this.transformToField(propName, propValue, fieldType);
          staticClass.members.push(field);
        }
      }

      // Restore previous class context
      this.currentClass = prevClass;

      return staticClass;
    }

    /**
     * Check if a function is a constructor (uses this.* property assignments)
     */
    isConstructorFunction(funcNode) {
      if (!funcNode.body || funcNode.body.type !== 'BlockStatement') return false;

      // Check for @constructor tag in typeInfo
      const typeInfo = funcNode.typeInfo || this.extractTypeInfo(funcNode);
      if (typeInfo?.isConstructor) return true;

      // Count this.* assignments to determine if constructor pattern
      let thisAssignments = 0;
      for (const stmt of funcNode.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          thisAssignments++;
        }
      }

      // If 3+ this.* assignments, treat as constructor
      return thisAssignments >= 3;
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
     * Transform a constructor function to a C# class
     */
    transformConstructorToClass(name, funcNode) {
      const className = this.toPascalCase(name);
      const classNode = new CSharpClass(className);
      classNode.isStatic = false;  // Instance class, not static

      // Set current class context for method transformations
      // This ensures 'this' remains 'this' (not replaced with outer class name)
      const prevClass = this.currentClass;
      this.currentClass = classNode;

      const typeInfo = funcNode.typeInfo || this.extractTypeInfo(funcNode);

      // Create constructor using proper CSharpConstructor node
      const ctor = new CSharpConstructor(className);

      // Push scope for constructor body
      this.pushScope();

      // Add constructor parameters from function parameters
      if (funcNode.params) {
        // First pass: collect all parameters and their types
        const paramInfos = [];
        for (const param of funcNode.params) {
          const paramName = this.toCamelCase(param.name);
          const originalParamName = param.name;
          let paramType = CSharpType.Object();

          if (typeInfo?.params && typeInfo.params.has(param.name)) {
            paramType = this.mapType(typeInfo.params.get(param.name)) || CSharpType.Object();
          }

          // Register parameter type for use in body transformations
          this.registerVariableType(originalParamName, paramType);

          paramInfos.push({ paramName, paramType, isNullable: paramType.isArray || paramType.name === 'object' || paramType.name === 'string' });
        }

        // Second pass: add parameters, only making nullable ones optional if ALL subsequent params are also nullable
        for (let i = 0; i < paramInfos.length; i++) {
          const { paramName, paramType, isNullable } = paramInfos[i];
          const csParam = new CSharpParameter(paramName, paramType);

          // Only add default null if this param and ALL remaining params are nullable
          if (isNullable) {
            const allRemainingNullable = paramInfos.slice(i + 1).every(p => p.isNullable);
            if (allRemainingNullable) {
              csParam.defaultValue = CSharpLiteral.Null();
            }
          }

          ctor.parameters.push(csParam);
        }
      }

      // Parse body - separate fields, methods, and constructor body statements
      const ctorBody = new CSharpBlock();
      const fields = [];
      const methods = [];

      if (funcNode.body && funcNode.body.type === 'BlockStatement') {
        for (const stmt of funcNode.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            const result = this.processThisAssignment(stmt, typeInfo);
            if (result.isMethod) {
              methods.push(result.member);
            } else {
              fields.push(result.member);
              // Add initialization to constructor body
              if (result.initStatement) {
                ctorBody.statements.push(result.initStatement);
              }
            }
          } else {
            // Regular statement goes to constructor body
            const csStmt = this.transformStatement(stmt);
            if (csStmt) {
              if (Array.isArray(csStmt)) {
                ctorBody.statements.push(...csStmt);
              } else {
                ctorBody.statements.push(csStmt);
              }
            }
          }
        }
      }

      ctor.body = ctorBody;

      // Pop scope after constructor body transformation
      this.popScope();

      // Add fields first, then constructor, then methods
      classNode.members.push(...fields);
      classNode.members.push(ctor);
      classNode.members.push(...methods);

      // Restore previous class context
      this.currentClass = prevClass;

      return classNode;
    }

    /**
     * Process a this.property = value assignment
     * Returns {isMethod: boolean, member: CSharpNode, initStatement?: CSharpNode}
     */
    processThisAssignment(stmt, typeInfo) {
      const expr = stmt.expression;
      const propName = expr.left.property.name || expr.left.property.value;
      const pascalName = this.toPascalCase(propName);
      const value = expr.right;

      // Check if assigning a function (method)
      if (value.type === 'FunctionExpression' || value.type === 'ArrowFunctionExpression') {
        // This is a method definition
        // Pass the statement's leading comments to the function expression
        // so that JSDoc annotations (@param, @returns) can be extracted
        if (stmt.leadingComments && !value.leadingComments) {
          value.leadingComments = stmt.leadingComments;
        }
        const method = this.transformFunctionToMethod(propName, value);
        method.isStatic = false;  // Instance method
        return { isMethod: true, member: method };
      }

      // Field assignment
      let fieldType = CSharpType.Object();

      // Try to infer type from JSDoc comments on the statement
      if (typeInfo?.fieldTypes && typeInfo.fieldTypes.has(propName)) {
        fieldType = this.mapType(typeInfo.fieldTypes.get(propName)) || CSharpType.Object();
      } else if (stmt.typeInfo?.type) {
        fieldType = this.mapType(stmt.typeInfo.type) || CSharpType.Object();
      } else if (stmt.leadingComments && stmt.leadingComments.length > 0) {
        // Check for @type annotation in leading comments
        for (const comment of stmt.leadingComments) {
          const typeMatch = comment.value && comment.value.match(/@type\s+\{([^}]+)\}/);
          if (typeMatch) {
            fieldType = this.mapType(typeMatch[1].trim()) || CSharpType.Object();
            break;
          }
        }
        if (fieldType.name === 'object') {
          // Fallback to value inference if @type not found or not recognized
          fieldType = this.inferTypeFromValue(value);
        }
      } else {
        // Infer from value
        fieldType = this.inferTypeFromValue(value);
      }

      // Register field type for this.propName lookups
      this.classFieldTypes.set(pascalName, fieldType);

      const field = new CSharpField(pascalName, fieldType);
      field.accessibility = 'public';

      // Set array element type context before transforming the value
      // This ensures that empty arrays like [] get the correct element type
      const prevArrayElementType = this.currentArrayElementType;
      if (fieldType.isArray) {
        this.currentArrayElementType = fieldType.elementType;
      }

      // Create assignment statement for constructor
      const initExpr = new CSharpAssignment(
        new CSharpMemberAccess(new CSharpThis(), pascalName),
        '=',
        this.transformExpression(value)
      );
      const initStatement = new CSharpExpressionStatement(initExpr);

      // Restore previous context
      this.currentArrayElementType = prevArrayElementType;

      return { isMethod: false, member: field, initStatement };
    }

    /**
     * Infer C# type from a JavaScript value expression
     * For cryptographic code, prefer uint over int for non-negative integers
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return CSharpType.Object();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              // For crypto code, use uint for non-negative integers (0 or positive)
              // This matches the typical pattern in cryptographic code
              if (valueNode.value >= 0) {
                return CSharpType.UInt();
              }
              return CSharpType.Int();
            }
            return CSharpType.Double();
          }
          if (typeof valueNode.value === 'string') return CSharpType.String();
          if (typeof valueNode.value === 'boolean') return CSharpType.Bool();
          return CSharpType.Object();

        case 'ArrayExpression':
          // Try to infer element type from first element
          if (valueNode.elements.length > 0) {
            const elemType = this.inferTypeFromValue(valueNode.elements[0]);
            return CSharpType.Array(elemType);
          }
          // Default to byte[] for empty arrays (common in crypto)
          return CSharpType.Array(CSharpType.Byte());

        case 'ObjectExpression':
          return CSharpType.Object();

        default:
          return CSharpType.Object();
      }
    }

    /**
     * Check if a function body uses the JavaScript 'arguments' object
     * @param {object} node - AST node to check
     * @returns {boolean} True if 'arguments' is used
     */
    usesArgumentsObject(node) {
      if (!node) return false;

      if (node.type === 'Identifier' && node.name === 'arguments')
        return true;

      // Don't descend into nested functions (they have their own arguments)
      if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression')
        return false;

      // Recursively check all properties that might contain AST nodes
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value)
            if (child && typeof child === 'object' && this.usesArgumentsObject(child))
              return true;
        } else if (value && typeof value === 'object') {
          if (this.usesArgumentsObject(value))
            return true;
        }
      }
      return false;
    }

    /**
     * Detect parameters that are used like arrays in the function body
     * Looks for patterns like: param.length, param[index], param.push(), etc.
     * @param {object} bodyNode - Function body AST node
     * @returns {Set<string>} Set of parameter names used like arrays
     */
    detectArrayUsageParams(bodyNode) {
      const arrayParams = new Set();

      const visit = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check for x.length pattern
        if (node.type === 'MemberExpression' &&
            node.object.type === 'Identifier' &&
            node.property.type === 'Identifier' &&
            node.property.name === 'length') {
          arrayParams.add(node.object.name);
        }

        // Check for x[i] indexing pattern
        if (node.type === 'MemberExpression' &&
            node.object.type === 'Identifier' &&
            node.computed === true) {
          arrayParams.add(node.object.name);
        }

        // Check for array methods: x.push(), x.slice(), x.concat(), etc.
        if (node.type === 'CallExpression' &&
            node.callee.type === 'MemberExpression' &&
            node.callee.object.type === 'Identifier') {
          const methodName = node.callee.property.name || node.callee.property.value;
          const arrayMethods = ['push', 'pop', 'shift', 'unshift', 'slice', 'concat',
                               'forEach', 'map', 'filter', 'reduce', 'find', 'indexOf'];
          if (arrayMethods.includes(methodName)) {
            arrayParams.add(node.callee.object.name);
          }
        }

        // Check for spread usage: [...x]
        if (node.type === 'SpreadElement' &&
            node.argument.type === 'Identifier') {
          arrayParams.add(node.argument.name);
        }

        // Recursively visit children (skip nested functions - different scope)
        for (const key in node) {
          if (key === 'type' || key === 'loc' || key === 'range') continue;
          const value = node[key];

          // Skip nested function bodies
          if (node.type === 'FunctionExpression' && key === 'body') continue;
          if (node.type === 'FunctionDeclaration' && key === 'body') continue;
          if (node.type === 'ArrowFunctionExpression' && key === 'body') continue;

          if (Array.isArray(value)) {
            value.forEach(visit);
          } else if (value && typeof value === 'object') {
            visit(value);
          }
        }
      };

      visit(bodyNode);
      return arrayParams;
    }

    /**
     * Transform a function expression to a method
     * @param {string} name - The method name
     * @param {object} funcNode - The function AST node
     * @param {{ params: string[], returns: string }|null} inheritedSig - Optional inherited method signature from base class
     */
    transformFunctionToMethod(name, funcNode, inheritedSig = null) {
      const pascalName = this.toPascalCase(name);

      // Extract type info from JSDoc if available
      const typeInfo = funcNode.typeInfo || this.extractTypeInfo(funcNode);

      // Determine return type - prioritize: 1) JSDoc, 2) inherited signature, 3) inference
      let returnType = this.mapType(typeInfo?.returns);

      // If no JSDoc return type, check inherited signature
      if (!returnType && inheritedSig?.returns) {
        returnType = this.mapTypeFromKnowledge(inheritedSig.returns);
      }

      // Push a new scope for the method body FIRST
      // This prevents variable types from leaking between functions
      this.pushScope();

      // If no explicit return type, check if function has return statements with values
      if (!returnType && funcNode.body) {
        const hasValueReturn = this.hasReturnWithValue(funcNode.body);
        if (!hasValueReturn) {
          returnType = CSharpType.Void();
        } else {
          // Pre-register local variable types for better return type inference
          this.preRegisterLocalVariableTypes(funcNode.body);

          // Try to infer from return statements, default to uint for crypto
          returnType = this.inferReturnType(funcNode.body) || CSharpType.UInt();
        }
      } else if (!returnType) {
        returnType = CSharpType.UInt();
      }

      // Check for tuple return
      if (typeInfo?.returns?.isTuple && typeInfo.returns.tupleElements) {
        returnType = this.createTupleType(typeInfo.returns.tupleElements);
      }

      const method = new CSharpMethod(pascalName, returnType);
      method.isStatic = true;

      // Analyze body for array usage patterns before inferring parameter types
      const arrayUsageParams = funcNode.body ? this.detectArrayUsageParams(funcNode.body) : new Set();

      // Add parameters and register their types
      if (funcNode.params) {
        // First pass: collect all parameters and their types
        const paramInfos = [];
        for (let i = 0; i < funcNode.params.length; i++) {
          const param = funcNode.params[i];
          const paramName = this.toCamelCase(param.name);
          const originalParamName = param.name;
          let paramType;

          // Priority: 1) JSDoc, 2) inherited signature, 3) array usage, 4) name inference
          if (typeInfo?.params && typeInfo.params.has(param.name)) {
            paramType = this.mapType(typeInfo.params.get(param.name));
          } else if (inheritedSig?.params && inheritedSig.params[i]) {
            // Use inherited parameter type from base class
            paramType = this.mapTypeFromKnowledge(inheritedSig.params[i]);
          } else if (arrayUsageParams.has(param.name)) {
            // Parameter is used like an array (.length, indexing, etc.)
            paramType = CSharpType.Array(CSharpType.Byte());
          } else {
            paramType = this.inferParameterType(paramName);
          }

          // Register parameter type for use in body transformations
          this.registerVariableType(originalParamName, paramType);

          paramInfos.push({ paramName, paramType, isNullable: paramType.isArray || paramType.name === 'object' || paramType.name === 'string' });
        }

        // Second pass: add parameters, only making nullable ones optional if ALL subsequent params are also nullable
        for (let i = 0; i < paramInfos.length; i++) {
          const { paramName, paramType, isNullable } = paramInfos[i];
          const csParam = new CSharpParameter(paramName, paramType);

          // Only add default null if this param and ALL remaining params are nullable
          if (isNullable) {
            const allRemainingNullable = paramInfos.slice(i + 1).every(p => p.isNullable);
            if (allRemainingNullable) {
              csParam.defaultValue = CSharpLiteral.Null();
            }
          }

          method.parameters.push(csParam);
        }
      }

      // If function uses 'arguments' object, add a params array parameter
      if (this.usesArgumentsObject(funcNode.body)) {
        const argsParam = new CSharpParameter('args', CSharpType.Array(CSharpType.Object()));
        argsParam.isParams = true;  // Mark as params array
        method.parameters.push(argsParam);
        // Register args type for body transformation
        this.registerVariableType('args', CSharpType.Array(CSharpType.Object()));
      }

      // Add XML documentation
      if (typeInfo?.description) {
        method.xmlDoc = this.createMethodXmlDoc(typeInfo, method.parameters);
      }

      // Register method signature for type propagation at call sites
      if (this.currentClass) {
        const paramTypes = method.parameters.map(p => p.type);
        this.registerMethodSignature(this.currentClass.name, pascalName, paramTypes, returnType);
      }

      // Check for @csharp directive - use native C# code instead of transpiling
      if (typeInfo?.csharpOverride) {
        const block = new CSharpBlock();
        block.statements.push(new CSharpRawCode(typeInfo.csharpOverride));
        method.body = block;
        this.popScope();
        return method;
      }

      // Transform body
      if (funcNode.body) {
        method.body = this.transformFunctionBody(funcNode.body, method);
      }

      // Pop scope when done with method
      this.popScope();

      return method;
    }

    /**
     * Transform a function body to a C# block
     */
    transformFunctionBody(bodyNode, method) {
      const block = new CSharpBlock();

      // Set context for array type inference from return type
      const prevMethod = this.currentMethod;
      this.currentMethod = method;

      // If method returns an array, set the element type for Array construction
      if (method && method.returnType && method.returnType.isArray) {
        this.currentArrayElementType = method.returnType.elementType || CSharpType.UInt();
      }

      // Pre-analyze body to infer variable types from assignments and returns (backwards type inference)
      // This handles patterns like:
      // - const padded = new Array(8).fill(0); bytes = padded; (padded gets bytes' type)
      // - const result = []; return result; (result gets method's return type)
      const returnType = method?.returnType || null;
      this.preAnalyzeBody(bodyNode, returnType);

      if (bodyNode.type === 'BlockStatement') {
        for (const stmt of bodyNode.body) {
          const csStmt = this.transformStatement(stmt);
          if (csStmt) {
            if (Array.isArray(csStmt)) {
              block.statements.push(...csStmt);
            } else {
              block.statements.push(csStmt);
            }
          }
        }
      } else {
        // Arrow function with expression body
        const expr = this.transformExpression(bodyNode);
        block.statements.push(new CSharpReturn(expr));
      }

      // Restore context
      this.currentMethod = prevMethod;
      this.currentArrayElementType = null;

      return block;
    }

    /**
     * Transform a statement
     */
    transformStatement(node) {
      switch (node.type) {
        case 'VariableDeclaration':
          return this.transformLocalVariableDeclaration(node);

        case 'ExpressionStatement': {
          // Special case: arr.push(x) needs to be converted to arr = arr.Append(x).ToArray()
          if (this.isPushCallExpression(node.expression)) {
            return this.transformPushStatementToAssignment(node.expression);
          }
          // Skip super() calls - they are handled in constructor transformation
          const calleeNode = node.expression?.callee;
          const isSuperCall = node.expression?.type === 'CallExpression' &&
              (calleeNode?.type === 'Super' || (calleeNode?.type === 'Identifier' && calleeNode?.name === 'super'));
          if (isSuperCall) {
            return null;
          }
          const expr = this.transformExpression(node.expression);
          // Skip if expression transformed to null (e.g., handled elsewhere)
          return expr ? new CSharpExpressionStatement(expr) : null;
        }

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

        case 'BreakStatement':
          return new CSharpBreak();

        case 'ContinueStatement':
          return new CSharpContinue();

        case 'ThrowStatement':
          return new CSharpThrow(this.transformExpression(node.argument));

        case 'TryStatement':
          return this.transformTryStatement(node);

        case 'BlockStatement':
          const block = new CSharpBlock();
          for (const stmt of node.body) {
            const csStmt = this.transformStatement(stmt);
            if (csStmt) {
              if (Array.isArray(csStmt)) {
                block.statements.push(...csStmt);
              } else {
                block.statements.push(csStmt);
              }
            }
          }
          return block;

        case 'EmptyStatement':
          return null;

        default:
          // Skip unhandled statement types
          return null;
      }
    }

    /**
     * Transform a local variable declaration
     */
    transformLocalVariableDeclaration(node) {
      const results = [];

      // Check for @type annotation in leading comments on the VariableDeclaration node
      let jsdocType = null;
      if (node.leadingComments && node.leadingComments.length > 0) {
        for (const comment of node.leadingComments) {
          const typeMatch = comment.value && comment.value.match(/@type\s+\{([^}]+)\}/);
          if (typeMatch) {
            jsdocType = this.mapType(typeMatch[1].trim());
            break;
          }
        }
      }

      for (const decl of node.declarations) {
        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toCamelCase(elem.name);
              const indexExpr = new CSharpElementAccess(sourceExpr, CSharpLiteral.Int(i));
              const varType = CSharpType.Var();

              this.registerVariableType(elem.name, varType);
              results.push(new CSharpVariableDeclaration(varName, varType, indexExpr));
            }
          }
          continue;
        }

        const name = this.toCamelCase(decl.id.name);
        const originalName = decl.id.name;
        let type = CSharpType.Var();
        let initializer = null;

        if (decl.init) {
          // Check if we have a pre-analyzed type hint from backwards inference
          // (e.g., from assignments like `param = localVar`)
          const preAnalyzedType = this.getVariableType(originalName);

          // First, infer the type of the initializer
          let inferredType = this.inferFullExpressionType(decl.init);

          // If we have a pre-analyzed type and no JSDoc, use pre-analyzed type
          if (!jsdocType && preAnalyzedType && preAnalyzedType.name !== 'var' && preAnalyzedType.name !== 'object') {
            inferredType = preAnalyzedType;
          }

          // If we have a JSDoc @type annotation, use that (highest priority - overrides everything)
          if (jsdocType && jsdocType.name !== 'object') {
            inferredType = jsdocType;
          }

          // Set context for array element type before transforming
          // Save previous value to restore afterward
          const prevArrayElementType = this.currentArrayElementType;
          if (inferredType?.isArray && inferredType.elementType) {
            this.currentArrayElementType = inferredType.elementType;
          }

          // Track if this is an ArrayBuffer creation for TypedArray view detection
          if (decl.init.type === 'NewExpression' &&
              decl.init.callee.type === 'Identifier' &&
              decl.init.callee.name === 'ArrayBuffer') {
            this.arrayBufferVariables.add(originalName);
          }

          initializer = this.transformExpression(decl.init);

          // Restore array element type context
          this.currentArrayElementType = prevArrayElementType;

          // Use inferred type instead of var for better type safety
          if (inferredType && inferredType.name !== 'object') {
            type = inferredType;
          }

          // Cast the initializer if there's a type mismatch that needs explicit casting
          // e.g., ternary ? 1 : 0 returns int but target is uint
          if (type && !type.isArray && initializer) {
            const initExprType = this.inferFullExpressionType(decl.init);
            if (this.needsInitializerCast(initExprType, type, decl.init)) {
              initializer = new CSharpCast(type, initializer);
            }
          }

          // Register the variable's type for later use
          this.registerVariableType(originalName, type);
        } else {
          // No initializer - C# var requires an initializer, so we need an explicit type
          // JSDoc @type has highest priority
          if (jsdocType && jsdocType.name !== 'object') {
            type = jsdocType;
            // Provide a default initializer for the type
            initializer = this.getDefaultValueForType(type);
          } else {
            // Check if we have a pre-analyzed type from forward assignment analysis
            const preAnalyzedType = this.getVariableType(originalName);
            if (preAnalyzedType && preAnalyzedType.name !== 'var' && preAnalyzedType.name !== 'object') {
              type = preAnalyzedType;
              // Provide a default initializer for the type
              initializer = this.getDefaultValueForType(type);
            } else {
              // Fallback to int with default value of 0 (common for loop variables, etc.)
              type = CSharpType.Int();
              initializer = CSharpLiteral.Int(0);
            }
          }
          this.registerVariableType(originalName, type);
        }

        results.push(new CSharpVariableDeclaration(name, type, initializer));
      }

      return results;
    }

    /**
     * Get a default value expression for a type
     */
    getDefaultValueForType(type) {
      if (!type) return CSharpLiteral.Null();

      if (type.isArray) {
        return new CSharpMethodCall(
          new CSharpIdentifier('Array'),
          'Empty',
          [],
          type.elementType
        );
      }

      switch (type.name) {
        case 'int': return CSharpLiteral.Int(0);
        case 'uint': return new CSharpLiteral(0, 'uint');
        case 'byte': return new CSharpCast(CSharpType.Byte(), CSharpLiteral.Int(0));
        case 'sbyte': return new CSharpCast(CSharpType.SByte(), CSharpLiteral.Int(0));
        case 'short': return new CSharpCast(CSharpType.Short(), CSharpLiteral.Int(0));
        case 'ushort': return new CSharpCast(CSharpType.UShort(), CSharpLiteral.Int(0));
        case 'long': return new CSharpLiteral(0, 'long');
        case 'ulong': return new CSharpLiteral(0, 'ulong');
        case 'float': return new CSharpLiteral(0.0, 'float');
        case 'double': return new CSharpLiteral(0.0, 'double');
        case 'bool': return CSharpLiteral.Bool(false);
        case 'string': return CSharpLiteral.Null();
        case 'char': return new CSharpLiteral("'\\0'", 'char');
        default: return CSharpLiteral.Null();
      }
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

        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'ThisExpression':
          // In static methods of static classes, 'this' refers to the class itself
          // But in instance classes (like constructor-generated classes), 'this' stays 'this'
          if (this.currentMethod?.isStatic && this.currentClass?.isStatic) {
            return new CSharpIdentifier(this.currentClass.name);
          }
          return new CSharpThis();

        case 'SequenceExpression':
          // Return the last expression
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        case 'SpreadElement':
          // ...array -> spread into collection (handled in context)
          return this.transformExpression(node.argument);

        case 'Super':
          // super -> base in C#
          return new CSharpBase();

        case 'TemplateLiteral':
          // `Hello ${name}!` -> $"Hello {name}!"
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - C# doesn't support this directly
          // Return a comment placeholder
          return new CSharpIdentifier('/* Object destructuring not supported in C# */');

        default:
          // Return a placeholder identifier for unhandled expression types
          return new CSharpIdentifier(`/* UnhandledExpr: ${node.type} */`);
      }
    }

    transformLiteral(node) {
      if (node.value === null) return CSharpLiteral.Null();
      if (typeof node.value === 'boolean') return CSharpLiteral.Bool(node.value);
      if (typeof node.value === 'string') return CSharpLiteral.String(node.value);

      // Handle BigInt (JavaScript 56n, 48n, etc.)
      if (typeof node.value === 'bigint' || node.bigint) {
        // For large BigInts, we need to preserve the hex representation
        // to avoid precision loss when converting to Number
        const bigValue = typeof node.value === 'bigint' ? node.value : BigInt(node.bigint.slice(0, -1));

        // Check if it fits in various C# types
        if (bigValue >= 0n && bigValue <= 0x7FFFFFFFn) {
          return CSharpLiteral.Int(Number(bigValue));
        }
        if (bigValue >= 0n && bigValue <= 0xFFFFFFFFn) {
          return CSharpLiteral.UInt(Number(bigValue));
        }
        if (bigValue >= 0n && bigValue <= 0x7FFFFFFFFFFFFFFFn) {
          // Fits in long, output as hex with L suffix
          return CSharpLiteral.Hex(bigValue, 'L');
        }
        if (bigValue >= 0n && bigValue <= 0xFFFFFFFFFFFFFFFFn) {
          // Fits in ulong, output as hex with UL suffix
          return CSharpLiteral.Hex(bigValue, 'UL');
        }
        // Very large: use BigInteger
        return CSharpLiteral.BigInteger(bigValue);
      }

      // Numeric
      if (typeof node.value === 'number') {
        const raw = node.raw || String(node.value);

        // Check for hex
        if (raw.startsWith('0x') || raw.startsWith('0X')) {
          return CSharpLiteral.Hex(node.value);
        }

        // Check size for type
        if (Number.isInteger(node.value)) {
          // Small integers (0-255) - use plain int literal (no suffix)
          if (node.value >= 0 && node.value <= 255) {
            return CSharpLiteral.Int(node.value);
          }
          // Medium integers - use int or uint as appropriate
          if (node.value >= 0 && node.value <= 0x7FFFFFFF) {
            return CSharpLiteral.Int(node.value);
          }
          if (node.value >= 0 && node.value <= 0xFFFFFFFF) {
            return CSharpLiteral.UInt(node.value);
          }
          return CSharpLiteral.Long(node.value);
        }

        return CSharpLiteral.Double(node.value);
      }

      return CSharpLiteral.Int(0);
    }

    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to C# equivalents
      if (name === 'undefined') return CSharpLiteral.Null();
      if (name === 'NaN') return new CSharpMemberAccess(new CSharpIdentifier('double'), 'NaN');
      if (name === 'Infinity') return new CSharpMemberAccess(new CSharpIdentifier('double'), 'PositiveInfinity');

      // Handle JavaScript 'arguments' - this is only valid inside functions with rest parameters
      // The function transformation should have converted the function to use params array
      if (name === 'arguments') {
        // Return 'args' which is the conventional C# name for params arrays
        return new CSharpIdentifier('args');
      }

      // Escape C# reserved keywords
      name = this.escapeReservedKeyword(name);

      return new CSharpIdentifier(name);
    }

    transformBinaryExpression(node) {
      let op = node.operator;

      // Map JavaScript operators to C#
      if (op === '===') op = '==';
      if (op === '!==') op = '!=';

      // Handle typeof comparisons: typeof x === "string" -> x is string
      if ((op === '==' || op === '!=') &&
          node.left.type === 'UnaryExpression' && node.left.operator === 'typeof' &&
          node.right.type === 'Literal' && typeof node.right.value === 'string') {
        const typeStr = node.right.value;
        const variable = this.transformExpression(node.left.argument);

        // Map JavaScript type strings to C# type checks
        const typeMap = {
          'string': 'string',
          'number': 'double',  // or could be int, uint, etc.
          'boolean': 'bool',
          'object': 'object',
          'function': 'Delegate',
          'undefined': null  // x === undefined -> x == null (handled separately)
        };

        const csType = typeMap[typeStr];
        if (csType) {
          const isExpr = new CSharpIsExpression(variable, new CSharpType(csType));
          if (op === '!=') {
            // typeof x !== "string" -> !(x is string)
            return new CSharpUnaryExpression('!', isExpr, true);
          }
          return isExpr;
        }
      }

      // Handle JavaScript >>> 0 idiom (converts to uint)
      // This is explicitly a "cast to unsigned 32-bit" operation
      // ALWAYS wrap in a cast because C# type promotion rules differ from JS
      if (op === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        const leftExpr = this.transformExpression(node.left);

        // Check if the transformed expression is already a literal or simple identifier
        // that we know is uint - in that case, skip the cast
        if (leftExpr.nodeType === 'Identifier') {
          const varType = this.getVariableType(node.left.name);
          if (varType?.name === 'uint') {
            return leftExpr;
          }
        }

        // Check if it's a literal that doesn't need casting
        if (leftExpr.nodeType === 'Literal' && typeof leftExpr.value === 'number' &&
            leftExpr.value >= 0 && leftExpr.value <= 0xFFFFFFFF) {
          // Use uint literal suffix
          return new CSharpLiteral(leftExpr.value, 'uint');
        }

        // Always wrap other expressions in a cast to uint
        return new CSharpCast(CSharpType.UInt(), leftExpr);
      }

      // Handle JavaScript || idiom for default values
      // x || y in JS means "if x is falsy, use y"
      // In C#: depends on types
      const leftType = this.inferFullExpressionType(node.left);
      const rightType = this.inferFullExpressionType(node.right);

      if (op === '||') {
        // If both sides are boolean, use normal logical OR
        if (leftType?.name === 'bool' && rightType?.name === 'bool') {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new CSharpBinaryExpression(left, '||', right);
        }

        // For numeric types: x || y -> x != 0 ? x : y
        const numericTypes = ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'long', 'ulong'];
        if (leftType && numericTypes.includes(leftType.name)) {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          // x || y -> x != 0 ? x : y
          const condition = new CSharpBinaryExpression(left, '!=', CSharpLiteral.Int(0));
          return new CSharpConditional(condition, left, right);
        }

        // For reference types: x || y -> x ?? y (null-coalescing)
        // But NOT for non-nullable types like bool return values
        if ((leftType?.isArray || leftType?.name === 'object') && !leftType?.name?.includes('bool')) {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new CSharpBinaryExpression(left, '??', right);
        }
      }

      // Handle JavaScript && with non-boolean types in value context
      // x && y in JS returns x if falsy, otherwise y
      if (op === '&&') {
        // If both sides are boolean, use normal logical AND
        if (leftType?.name === 'bool' && rightType?.name === 'bool') {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new CSharpBinaryExpression(left, '&&', right);
        }

        // For reference types: x && y where result is used as value
        if (leftType?.isArray || leftType?.name === 'object') {
          // Transform `arr && x` to `arr != null ? x : default`
          // But this is complex - for now, just add null check
          const left = this.transformExpression(node.left);
          const nullCheck = new CSharpBinaryExpression(left, '!=', CSharpLiteral.Null());
          const right = this.transformExpression(node.right);
          const result = new CSharpBinaryExpression(nullCheck, '&&', right);
          result.leftNeedsParens = false;
          result.rightNeedsParens = this.childNeedsParens(node.operator, node.right, false);
          return result;
        }
      }

      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // For shift operators, the right operand must be int in C#
      // Strip BigInt() casts from shift amounts - they should remain int
      const isShiftOp = op === '<<' || op === '>>' || op === '>>>';
      if (isShiftOp) {
        // Check if the original right operand was a BigInt (e.g., 56n)
        // This indicates a 64-bit shift operation - need to cast left to ulong
        const originalRight = node.right;
        const isBigIntShift = originalRight.bigint !== undefined ||
                              (originalRight.type === 'Literal' && typeof originalRight.value === 'bigint');

        // Also check if shift amount >= 32 (requires 64-bit operand)
        let shiftAmount = null;
        if (originalRight.type === 'Literal') {
          if (typeof originalRight.value === 'bigint') {
            shiftAmount = Number(originalRight.value);
          } else if (typeof originalRight.value === 'number') {
            shiftAmount = originalRight.value;
          } else if (originalRight.bigint) {
            // Handle node.bigint property (string like "56n")
            shiftAmount = parseInt(originalRight.bigint, 10);
          }
        }

        const needsUlongCast = isBigIntShift || (shiftAmount !== null && shiftAmount >= 32);

        if (needsUlongCast) {
          // Cast left operand to ulong for 64-bit shift operations
          // This ensures proper 64-bit arithmetic in C#
          left = new CSharpCast(CSharpType.ULong(), left);
        }

        // If right is a cast to BigInteger, unwrap it
        if (right.nodeType === 'Cast' && right.type?.name === 'BigInteger') {
          right = right.expression;
        }
        // In C#, shift operators ALWAYS require int for the right operand
        // Cast ALL shift amounts to int except simple numeric literals
        const isSimpleLiteral = right.nodeType === 'Literal' &&
          typeof right.value === 'number' && Number.isInteger(right.value);
        if (!isSimpleLiteral) {
          right = new CSharpCast(CSharpType.Int(), right);
        }
      }

      // For bitwise OR/AND/XOR operations, ensure type compatibility
      const isBitwiseOp = op === '|' || op === '&' || op === '^';
      if (isBitwiseOp) {
        // Handle JS quirk: `x & (1 !== 0)` in JS works because true coerces to 1
        // In C#, we need to convert comparison results to int: (x !== 0) -> (x != 0 ? 1 : 0)
        // But simpler: if the right operand is a comparison like `1 !== 0`, evaluate it
        // and replace with the constant result
        const comparisonOps = ['==', '!=', '===', '!==', '<', '>', '<=', '>='];
        if (node.right.type === 'BinaryExpression' && comparisonOps.includes(node.right.operator) &&
            node.right.left.type === 'Literal' && node.right.right.type === 'Literal') {
          // Constant comparison - evaluate and replace with numeric result
          const leftVal = node.right.left.value;
          const rightVal = node.right.right.value;
          let result;
          switch (node.right.operator) {
            case '===': case '==': result = leftVal === rightVal; break;
            case '!==': case '!=': result = leftVal !== rightVal; break;
            case '<': result = leftVal < rightVal; break;
            case '>': result = leftVal > rightVal; break;
            case '<=': result = leftVal <= rightVal; break;
            case '>=': result = leftVal >= rightVal; break;
            default: result = false;
          }
          // Replace with the numeric value (1 for true, 0 for false)
          right = CSharpLiteral.Int(result ? 1 : 0);
        }

        const leftHasUlong = this.expressionHasUlongType(left);
        const rightHasUlong = this.expressionHasUlongType(right);

        if (leftHasUlong && !rightHasUlong) {
          // Cast right to ulong to match left
          right = new CSharpCast(CSharpType.ULong(), right);
        } else if (rightHasUlong && !leftHasUlong) {
          // Cast left to ulong to match right
          left = new CSharpCast(CSharpType.ULong(), left);
        }
      }

      // Wrap sub-expressions in parentheses if they have lower precedence
      const result = new CSharpBinaryExpression(left, op, right);
      result.leftNeedsParens = this.childNeedsParens(node.operator, node.left, true);
      result.rightNeedsParens = this.childNeedsParens(node.operator, node.right, false);

      return result;
    }

    /**
     * Check if a transformed expression has ulong type
     * Used to ensure type compatibility in bitwise operations
     */
    expressionHasUlongType(expr) {
      if (!expr) return false;

      // Direct ulong cast
      if (expr.nodeType === 'Cast' && expr.type?.name === 'ulong') {
        return true;
      }

      // Binary expression where either side is ulong
      if (expr.nodeType === 'BinaryExpression') {
        return this.expressionHasUlongType(expr.left) || this.expressionHasUlongType(expr.right);
      }

      // Literal with ulong type
      if (expr.nodeType === 'Literal' && expr.literalType === 'ulong') {
        return true;
      }

      return false;
    }

    /**
     * Determine if child expression needs parentheses based on operator precedence
     */
    childNeedsParens(parentOp, childNode, isLeft) {
      if (!childNode) return false;

      // Non-binary expressions don't need parens in most cases
      if (childNode.type !== 'BinaryExpression' && childNode.type !== 'LogicalExpression')
        return false;

      const parentPrec = this.getOperatorPrecedence(parentOp);
      const childPrec = this.getOperatorPrecedence(childNode.operator);

      // If child has lower precedence, it needs parens
      if (childPrec < parentPrec) return true;

      // CRITICAL: Handle JS vs C# precedence mismatch for bitwise vs comparison operators
      // In JavaScript: comparison (!==, ===, etc.) binds tighter than bitwise (&, |, ^)
      // In C#: bitwise (&, |, ^) binds tighter than comparison (==, !=)
      // So `x & 1 !== 0` in JS means `(x & 1) !== 0`, but in C# it means `x & (1 != 0)`
      // We need to add parens when bitwise is child of comparison
      const comparisonOps = ['==', '!=', '===', '!==', '<', '>', '<=', '>='];
      const bitwiseOps = ['&', '|', '^'];
      if (comparisonOps.includes(parentOp) && bitwiseOps.includes(childNode.operator)) {
        return true; // Always add parens for bitwise under comparison in C#
      }

      // If same precedence and on the right, need parens for non-associative operators
      if (childPrec === parentPrec && !isLeft) {
        // Subtraction and division are left-associative
        if (parentOp === '-' || parentOp === '/' || parentOp === '%')
          return true;
        // Shift operators are left-associative
        if (parentOp === '<<' || parentOp === '>>' || parentOp === '>>>')
          return true;
      }

      return false;
    }

    /**
     * Get operator precedence (higher = binds tighter)
     */
    getOperatorPrecedence(op) {
      const precedences = {
        '||': 2,
        '&&': 3,
        '|': 4,
        '^': 5,
        '&': 6,
        '==': 7, '!=': 7, '===': 7, '!==': 7,
        '<': 8, '>': 8, '<=': 8, '>=': 8,
        '<<': 9, '>>': 9, '>>>': 9,
        '+': 10, '-': 10,
        '*': 11, '/': 11, '%': 11,
      };
      return precedences[op] || 0;
    }

    needsParentheses(node, left, right) {
      // Placeholder for complex cases
      return false;
    }

    transformUnaryExpression(node) {
      // Handle typeof operator - JavaScript typeof returns a string
      // typeof x === "string" -> x is string
      if (node.operator === 'typeof') {
        // typeof gets transformed differently - return a special marker
        // The binary expression handler will convert `typeof x === "string"` to `x is string`
        const operand = this.transformExpression(node.argument);
        // Return a special call to indicate this is a typeof check
        // Use GetType().Name for now, but binary handler will optimize
        return new CSharpMethodCall(
          new CSharpMethodCall(operand, 'GetType', []),
          'Name',
          []
        );
      }

      // Handle ! operator
      if (node.operator === '!') {
        // Special case: !/regex/.test(str) -> !Regex.IsMatch(str, pattern)
        // The regex test returns bool, so we can use normal !
        if (node.argument.type === 'CallExpression' &&
            node.argument.callee.type === 'MemberExpression' &&
            node.argument.callee.property.name === 'test' &&
            node.argument.callee.object.type === 'Literal' &&
            node.argument.callee.object.regex) {
          const pattern = node.argument.callee.object.regex.pattern;
          const args = node.argument.arguments.map(a => this.transformExpression(a));
          const regexCall = new CSharpMethodCall(
            new CSharpIdentifier('System.Text.RegularExpressions.Regex'),
            'IsMatch',
            [args[0], CSharpLiteral.String(pattern)]
          );
          return new CSharpUnaryExpression('!', regexCall, true);
        }

        const operand = this.transformExpression(node.argument);
        const operandType = this.inferFullExpressionType(node.argument);

        // For call expressions that return bool, keep normal !
        if (node.argument.type === 'CallExpression') {
          // Most method calls should return bool if used in boolean context
          // So just use normal ! operator
          return new CSharpUnaryExpression('!', operand, true);
        }

        // For numeric types, !x -> x == 0
        const numericTypes = ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'long', 'ulong'];
        if (operandType && numericTypes.includes(operandType.name)) {
          return new CSharpBinaryExpression(operand, '==', CSharpLiteral.Int(0));
        }

        // For arrays/objects, !x -> x == null
        if (operandType?.isArray || operandType?.name === 'object' || operandType?.name === 'string') {
          return new CSharpBinaryExpression(operand, '==', CSharpLiteral.Null());
        }

        // For bool or unknown, use normal !
        return new CSharpUnaryExpression('!', operand, true);
      }

      const operand = this.transformExpression(node.argument);
      return new CSharpUnaryExpression(node.operator, operand, node.prefix);
    }

    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new CSharpUnaryExpression(node.operator, operand, node.prefix);
    }

    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);

      // Infer target type first for array element context propagation
      const targetType = this.inferFullExpressionType(node.left);

      // Set array element type context for the RHS transformation
      const prevArrayElementType = this.currentArrayElementType;
      if (targetType?.isArray && targetType.elementType) {
        this.currentArrayElementType = targetType.elementType;
      }

      let value = this.transformExpression(node.right);

      // Restore previous array element type context
      this.currentArrayElementType = prevArrayElementType;

      // Check for no-op assignments like "x = x" (can happen after removing >>> 0)
      if (target.nodeType === 'Identifier' && value.nodeType === 'Identifier' &&
          target.name === value.name && node.operator === '=') {
        // Return null or a special marker to skip this statement
        return new CSharpAssignment(target, node.operator, value, { isNoop: true });
      }

      // For simple assignments, cast the value to match the target type if needed
      if (node.operator === '=') {
        const valueType = this.inferFullExpressionType(node.right);
        // Cast when types differ and target is a narrower integral type
        value = this.castIfNeeded(value, valueType, targetType);
      }
      // For compound assignments (+=, -=, &=, |=, etc.), the result might need casting
      // because C# does implicit widening but the assignment back to target needs narrowing
      // E.g., uint &= int produces long, which doesn't fit back into uint
      else if (node.operator.length > 1 && node.operator.endsWith('=')) {
        // Decompose: x op= y into x = x op y
        // Get the binary operation result type
        const binaryOp = node.operator.slice(0, -1); // Remove the '=' to get the operator
        // Create a fake binary expression node to infer the result type
        const fakeBinaryNode = { type: 'BinaryExpression', operator: binaryOp, left: node.left, right: node.right };
        const resultType = this.inferBinaryExpressionType(fakeBinaryNode);

        // If the result type differs from target type and needs narrowing, we need to
        // convert the compound assignment to a simple assignment with explicit cast
        if (resultType && targetType && resultType.name !== targetType.name) {
          const needsCast = this.typeNeedsCast(resultType.name, targetType.name);
          if (needsCast) {
            // Convert compound assignment to: target = (targetType)(target op value)
            const leftExpr = this.transformExpression(node.left);
            const binaryExpr = new CSharpBinaryExpression(leftExpr, binaryOp, value);
            const castExpr = new CSharpCast(targetType, binaryExpr);
            return new CSharpAssignment(target, '=', castExpr);
          }
        }
      }

      return new CSharpAssignment(target, node.operator, value);
    }

    /**
     * Check if a type conversion needs an explicit cast
     */
    typeNeedsCast(sourceTypeName, targetTypeName) {
      const narrowingConversions = {
        'int': ['uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'uint': ['int', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'long': ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char', 'ulong'],
        'ulong': ['long', 'int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'double': ['float', 'long', 'int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'BigInteger': ['long', 'ulong', 'int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
      };
      return narrowingConversions[sourceTypeName]?.includes(targetTypeName) || false;
    }

    /**
     * Cast expression to target type if necessary for C# type safety
     */
    castIfNeeded(expr, sourceType, targetType) {
      if (!targetType || !sourceType) return expr;
      if (targetType.name === sourceType.name) return expr;
      if (targetType.name === 'object') return expr;

      // Define which conversions need explicit casts in C#
      const narrowingConversions = {
        // Source type -> target types that need explicit cast
        'int': ['uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'uint': ['int', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'long': ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char', 'ulong'],
        'ulong': ['long', 'int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'double': ['float', 'long', 'int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
        'BigInteger': ['long', 'ulong', 'int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'char'],
      };

      const needsCast = narrowingConversions[sourceType.name]?.includes(targetType.name);
      if (needsCast) {
        return new CSharpCast(targetType, expr);
      }

      return expr;
    }

    transformMemberExpression(node) {
      const target = this.transformExpression(node.object);

      if (node.computed) {
        // Array/dictionary access: obj[index]
        const index = this.transformExpression(node.property);
        return new CSharpElementAccess(target, index);
      }

      // Property access: obj.prop
      const member = node.property.name || node.property.value;

      // Map JavaScript properties to C#
      if (member === 'length') {
        return new CSharpMemberAccess(target, 'Length');
      }

      // For tuple member access, keep original case (camelCase)
      // Detect if target is a method call that might return a tuple
      const targetType = this.inferFullExpressionType(node.object);
      if (targetType?.isTuple) {
        // Tuple members use camelCase in C#
        return new CSharpMemberAccess(target, this.toCamelCase(member));
      }

      return new CSharpMemberAccess(target, this.toPascalCase(member));
    }

    transformCallExpression(node) {
      // Handle super() calls - these should be handled in constructor transformation
      // If we reach here, skip them (return null which will be filtered out)
      // Support both Super node type and Identifier with name "super"
      if (node.callee?.type === 'Super' || (node.callee?.type === 'Identifier' && node.callee?.name === 'super')) {
        // super() calls are handled in transformConstructor via base() chain
        return null;
      }

      const args = node.arguments.map(a => this.transformExpression(a));

      if (node.callee.type === 'MemberExpression') {
        const methodName = node.callee.property.name || node.callee.property.value;

        // Special case: new Array(size).fill(value) -> Enumerable.Repeat(value, size).ToArray()
        if (methodName === 'fill' && node.callee.object.type === 'NewExpression') {
          const newExpr = node.callee.object;
          if (newExpr.callee.name === 'Array' && newExpr.arguments.length >= 1) {
            const size = this.transformExpression(newExpr.arguments[0]);
            let fillValue = args[0] || CSharpLiteral.Int(0);

            // Cast the fill value to the target element type if we know it
            if (this.currentArrayElementType) {
              const elemType = this.currentArrayElementType;
              // If the fill value is a literal 0 and we need a specific type, cast it
              if (fillValue.nodeType === 'Literal' && fillValue.value === 0) {
                fillValue = new CSharpCast(elemType, fillValue);
              }
            }

            const repeatCall = new CSharpMethodCall(
              new CSharpIdentifier('Enumerable'),
              'Repeat',
              [fillValue, size]
            );
            return new CSharpMethodCall(repeatCall, 'ToArray', []);
          }
        }

        const target = this.transformExpression(node.callee.object);

        // Handle regex.test(str) -> Regex.IsMatch(str, pattern)
        if (methodName === 'test' && node.callee.object.type === 'Literal' &&
            node.callee.object.regex) {
          // /pattern/.test(str) -> Regex.IsMatch(str, "pattern")
          const pattern = node.callee.object.regex.pattern;
          return new CSharpMethodCall(
            new CSharpIdentifier('System.Text.RegularExpressions.Regex'),
            'IsMatch',
            [args[0], CSharpLiteral.String(pattern)]
          );
        }

        // Handle string methods
        if (methodName === 'padStart') {
          // str.padStart(length, string) -> str.PadLeft(length, char)
          // JS takes a string, C# takes a char. Convert string literal to char.
          const newArgs = [...args];
          if (newArgs.length >= 2 && newArgs[1].nodeType === 'Literal' &&
              typeof newArgs[1].value === 'string' && newArgs[1].value.length > 0) {
            // Convert string literal to char literal
            newArgs[1] = new CSharpLiteral(`'${newArgs[1].value[0]}'`, 'char');
          } else if (newArgs.length >= 2) {
            // For non-literal strings, take first character: str[0]
            newArgs[1] = new CSharpElementAccess(newArgs[1], CSharpLiteral.Int(0));
          }
          return new CSharpMethodCall(target, 'PadLeft', newArgs);
        }
        if (methodName === 'padEnd') {
          // str.padEnd(length, string) -> str.PadRight(length, char)
          const newArgs = [...args];
          if (newArgs.length >= 2 && newArgs[1].nodeType === 'Literal' &&
              typeof newArgs[1].value === 'string' && newArgs[1].value.length > 0) {
            newArgs[1] = new CSharpLiteral(`'${newArgs[1].value[0]}'`, 'char');
          } else if (newArgs.length >= 2) {
            newArgs[1] = new CSharpElementAccess(newArgs[1], CSharpLiteral.Int(0));
          }
          return new CSharpMethodCall(target, 'PadRight', newArgs);
        }
        if (methodName === 'startsWith') {
          return new CSharpMethodCall(target, 'StartsWith', args);
        }
        if (methodName === 'endsWith') {
          return new CSharpMethodCall(target, 'EndsWith', args);
        }
        if (methodName === 'includes') {
          return new CSharpMethodCall(target, 'Contains', args);
        }
        if (methodName === 'substring') {
          return new CSharpMethodCall(target, 'Substring', args);
        }
        // JS substr(start, length) -> C# Substring(start, length)
        if (methodName === 'substr') {
          return new CSharpMethodCall(target, 'Substring', args);
        }
        if (methodName === 'charAt') {
          // str.charAt(i) -> str[i]
          return new CSharpElementAccess(target, args[0]);
        }
        if (methodName === 'charCodeAt') {
          // str.charCodeAt(i) -> (int)str[i]
          return new CSharpCast(CSharpType.Int(), new CSharpElementAccess(target, args[0]));
        }

        // Handle special JavaScript methods -> C# equivalents
        if (methodName === 'push') {
          // JavaScript array.push() adds to array and returns new length
          // In C#, arrays are fixed size. Options:
          // 1. Use List<T>.Add() - but need to change declaration
          // 2. Use array.Append(x).ToArray() and reassign - creates new array
          // 3. Use Array.Resize() + index assignment
          // For now, use .Append(x).ToArray() pattern which works with LINQ
          // This requires the caller to reassign the result to the array
          // Note: The generated code may need manual adjustment
          const appendCall = new CSharpMethodCall(target, 'Append', args);
          return new CSharpMethodCall(appendCall, 'ToArray', []);
        }
        if (methodName === 'pop') {
          // List.RemoveAt(Count - 1) and return last element
          return this.createPopExpression(target);
        }
        if (methodName === 'fill') {
          // array.fill(value) -> (Array.Fill(array, value), array)[1] or just return array after fill
          // For now, generate a helper that fills in place: ArrayFill(array, value)
          // Or use LINQ: Enumerable.Repeat(value, array.Length).ToArray()
          // Best: return target, but also emit Array.Fill call separately
          // Simplified: just call Array.Fill which modifies in place
          return new CSharpMethodCall(new CSharpIdentifier('Array'), 'Fill', [target, ...args]);
        }
        if (methodName === 'concat') {
          // array.concat(other) -> array.Concat(other).ToArray()
          const concatCall = new CSharpMethodCall(target, 'Concat', args);
          return new CSharpMethodCall(concatCall, 'ToArray', []);
        }
        if (methodName === 'slice') {
          // array.slice(start, end) -> array[start..end] or array.Skip(start).Take(end-start).ToArray()
          if (args.length === 0) {
            // slice() - copy entire array
            return new CSharpMethodCall(target, 'ToArray', []);
          }
          if (args.length === 1) {
            // slice(start) - from start to end
            return new CSharpMethodCall(
              new CSharpMethodCall(target, 'Skip', args),
              'ToArray',
              []
            );
          }
          // slice(start, end)
          const skipCall = new CSharpMethodCall(target, 'Skip', [args[0]]);
          const takeCall = new CSharpMethodCall(skipCall, 'Take', [
            new CSharpBinaryExpression(args[1], '-', args[0])
          ]);
          return new CSharpMethodCall(takeCall, 'ToArray', []);
        }
        if (methodName === 'map') {
          // array.map(fn) -> array.Select(fn).ToArray()
          const selectCall = new CSharpMethodCall(target, 'Select', args);
          return new CSharpMethodCall(selectCall, 'ToArray', []);
        }
        if (methodName === 'filter') {
          // array.filter(fn) -> array.Where(fn).ToArray()
          const whereCall = new CSharpMethodCall(target, 'Where', args);
          return new CSharpMethodCall(whereCall, 'ToArray', []);
        }
        if (methodName === 'reduce') {
          // array.reduce(fn, init) -> array.Aggregate(init, fn)
          if (args.length >= 2) {
            return new CSharpMethodCall(target, 'Aggregate', [args[1], args[0]]);
          }
          return new CSharpMethodCall(target, 'Aggregate', args);
        }
        if (methodName === 'indexOf') {
          return new CSharpMethodCall(new CSharpIdentifier('Array'), 'IndexOf', [target, ...args]);
        }
        if (methodName === 'join') {
          // array.join(sep) -> string.Join(sep, array)
          return new CSharpMethodCall(new CSharpIdentifier('string'), 'Join', [...args, target]);
        }
        if (methodName === 'reverse') {
          // array.reverse() modifies in place; Array.Reverse(array)
          return new CSharpMethodCall(new CSharpIdentifier('Array'), 'Reverse', [target]);
        }
        if (methodName === 'sort') {
          // array.sort() modifies in place; Array.Sort(array)
          return new CSharpMethodCall(new CSharpIdentifier('Array'), 'Sort', [target]);
        }
        if (methodName === 'forEach') {
          // array.forEach(fn) -> use a for loop instead, but for expression context:
          // Array.ForEach(array, fn) - note: only works with Action<T>
          return new CSharpMethodCall(new CSharpIdentifier('Array'), 'ForEach', [target, ...args]);
        }
        if (methodName === 'toString' && args.length === 1) {
          // number.toString(radix) - convert to base string
          // For radix 16: value.ToString("X")
          if (args[0].nodeType === 'Literal' && args[0].value === 16) {
            return new CSharpMethodCall(target, 'ToString', [CSharpLiteral.String('X')]);
          }
        }

        // Handle String.fromCharCode - JS static method
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'String') {
          if (methodName === 'fromCharCode') {
            // String.fromCharCode(code) -> ((char)code).ToString()
            // or for multiple args: new string(new char[] { (char)a, (char)b, ... })
            if (args.length === 1) {
              const charCast = new CSharpCast(CSharpType.Char(), args[0]);
              return new CSharpMethodCall(charCast, 'ToString', []);
            } else {
              // Multiple char codes - create char array and convert to string
              const charArray = new CSharpArrayCreation(CSharpType.Char(), null,
                args.map(a => new CSharpCast(CSharpType.Char(), a)));
              return new CSharpNewExpression(CSharpType.String(), [charArray]);
            }
          }
        }

        // Handle Math methods
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Math') {
          const lowerMethod = methodName.toLowerCase();

          // Math.imul(a, b) - 32-bit integer multiplication (truncates to 32 bits)
          // In C#: (int)((long)a * b)  or just (a * b) if we know they're int32
          if (lowerMethod === 'imul' && args.length === 2) {
            // (int)((long)a * (long)b) - ensures proper truncation to 32 bits
            const longCastA = new CSharpCast(new CSharpType('long'), args[0]);
            const longCastB = new CSharpCast(new CSharpType('long'), args[1]);
            const multiply = new CSharpBinaryExpression(longCastA, '*', longCastB);
            return new CSharpCast(CSharpType.Int(), multiply);
          }

          // Math.floor(x / y) where both are integers -> x / y (integer division in C#)
          if (lowerMethod === 'floor' && args.length === 1) {
            const arg = node.arguments[0];
            if (arg.type === 'BinaryExpression' && arg.operator === '/') {
              const leftType = this.inferFullExpressionType(arg.left);
              const rightType = this.inferFullExpressionType(arg.right);
              const intTypes = ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'long', 'ulong'];
              if (intTypes.includes(leftType?.name) && intTypes.includes(rightType?.name)) {
                // Integer division - just return the division, no Math.floor needed
                return args[0];
              }
            }
            // Not integer division - wrap result in cast to match expected type
            const argType = this.inferFullExpressionType(node.arguments[0]);
            if (argType?.name !== 'double') {
              args[0] = new CSharpCast(CSharpType.Double(), args[0]);
            }
            // Math.Floor returns double, so we'll wrap the whole call in (int) or (uint) cast
            // based on context. For now, return the call - caller may need to cast.
            return new CSharpMethodCall(target, 'Floor', args);
          }

          // Other Math methods - ensure argument is cast to double to avoid ambiguity
          if (lowerMethod === 'ceil' || lowerMethod === 'round' ||
              lowerMethod === 'sqrt' || lowerMethod === 'pow' || lowerMethod === 'log' ||
              lowerMethod === 'exp' || lowerMethod === 'sin' || lowerMethod === 'cos') {
            if (args.length >= 1) {
              const argType = this.inferFullExpressionType(node.arguments[0]);
              if (argType?.name !== 'double') {
                args[0] = new CSharpCast(CSharpType.Double(), args[0]);
              }
            }
          }
        }

        // Handle Object methods
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(arr) - In C# arrays are already fixed-size, just return the array
          // For objects, we could use readonly fields, but for now just return as-is
          if (methodName === 'freeze' && args.length === 1) {
            return args[0];
          }
          // Object.keys(obj) -> obj.Keys or dictionary operations
          if (methodName === 'keys' && args.length === 1) {
            return new CSharpMethodCall(args[0], 'Keys', []);
          }
          // Object.values(obj) -> obj.Values
          if (methodName === 'values' && args.length === 1) {
            return new CSharpMethodCall(args[0], 'Values', []);
          }
          // Object.entries(obj) -> for dictionaries, needs conversion
          if (methodName === 'entries' && args.length === 1) {
            // Return as ToList() for now - may need manual adjustment
            return new CSharpMethodCall(args[0], 'ToList', []);
          }
          // Object.assign(target, ...sources) -> manual merge or spread
          if (methodName === 'assign' && args.length >= 1) {
            // For simple case Object.assign({}, source), just return source
            if (args.length === 2 && args[0].nodeType === 'ObjectCreation') {
              return args[1];
            }
            // Otherwise return first arg (target) - caller needs to handle merging
            return args[0];
          }
        }

        // Apply type propagation: cast arguments to match expected parameter types
        // This handles cases like writeBits(byte & 0xFF, 8) where byte&0xFF is int but uint is expected
        const pascalMethodName = this.toPascalCase(methodName);
        const castedArgs = this.castArgumentsToParameterTypes(node.callee.object, pascalMethodName, args, node.arguments);

        return new CSharpMethodCall(target, pascalMethodName, castedArgs);
      }

      // Simple function call
      const funcName = node.callee.name || 'Unknown';

      // Handle parseInt/parseFloat
      if (funcName === 'parseInt') {
        // parseInt(str, radix) -> int.Parse(str) or Convert.ToInt32(str, radix)
        if (args.length === 2) {
          // Convert.ToInt32(str, radix)
          // Check if first argument is a char (from str[i] or str.charAt(i))
          // If so, we need to convert it to string first: char -> char.ToString()
          const firstArgType = this.inferFullExpressionType(node.arguments[0]);
          let firstArg = args[0];
          if (firstArgType && firstArgType.name === 'char') {
            // Convert char to string: c.ToString()
            firstArg = new CSharpMethodCall(firstArg, 'ToString', []);
          }
          return new CSharpMethodCall(
            new CSharpIdentifier('Convert'),
            'ToInt32',
            [firstArg, args[1]]
          );
        }
        if (args.length === 1) {
          return new CSharpMethodCall(
            new CSharpIdentifier('int'),
            'Parse',
            args
          );
        }
      }
      if (funcName === 'parseFloat') {
        if (args.length >= 1) {
          return new CSharpMethodCall(
            new CSharpIdentifier('double'),
            'Parse',
            [args[0]]
          );
        }
      }

      // Handle type conversion functions
      if (funcName === 'BigInt') {
        // BigInt(x) -> (BigInteger)x or new BigInteger(x)
        // Use cast for simple cases
        if (args.length === 1) {
          return new CSharpCast(new CSharpType('BigInteger'), args[0]);
        }
      }
      if (funcName === 'Number') {
        // Number(x) -> Convert.ToDouble(x) or just (double)x
        if (args.length === 1) {
          return new CSharpCast(CSharpType.Double(), args[0]);
        }
      }
      if (funcName === 'String') {
        // String(x) -> x.ToString() or Convert.ToString(x)
        if (args.length === 1) {
          return new CSharpMethodCall(args[0], 'ToString', []);
        }
      }
      if (funcName === 'Boolean') {
        // Boolean(x) -> (bool)x or Convert.ToBoolean(x)
        if (args.length === 1) {
          return new CSharpCast(CSharpType.Bool(), args[0]);
        }
      }

      // Check if this is a local variable (parameter) being invoked as a delegate
      // In that case, keep the original casing to match the parameter name
      const varType = this.getVariableType(funcName);
      const isFuncType = varType && (
        varType.name === 'Func' || varType.name === 'Action' ||
        varType.name?.startsWith('Func<') || varType.name?.startsWith('Action<')
      );
      if (isFuncType) {
        // This is a delegate parameter - keep original name
        return new CSharpMethodCall(null, funcName, args);
      }

      return new CSharpMethodCall(null, this.toPascalCase(funcName), args);
    }

    transformNewExpression(node) {
      // Get the type name - handle both simple identifiers and member expressions
      let typeName = 'Object';
      if (node.callee.type === 'Identifier') {
        typeName = node.callee.name;
      } else if (node.callee.type === 'MemberExpression') {
        // For OpCodes._BitStream -> _BitStream
        typeName = node.callee.property.name || node.callee.property.value || 'Object';
      }

      const args = node.arguments.map(a => this.transformExpression(a));

      // Handle Array constructor - convert to C# array creation
      if (typeName === 'Array') {
        // new Array(size) -> new T[size]
        // Default element type is uint for crypto code
        let elementType = CSharpType.UInt();

        // If we have context about what type is expected, use that
        if (this.currentArrayElementType) {
          elementType = this.currentArrayElementType;
        }

        if (args.length === 1) {
          // new Array(size)
          return new CSharpArrayCreation(elementType, args[0], null);
        }
        // new Array() with elements would be transformed in transformArrayExpression
        return new CSharpArrayCreation(elementType, CSharpLiteral.Int(0), null);
      }

      // Handle typed arrays
      // Check if argument is an ArrayBuffer variable (view pattern)
      const isBufferView = node.arguments.length > 0 &&
        node.arguments[0].type === 'Identifier' &&
        this.isArrayBufferVariable(node.arguments[0].name);

      // Check if argument is an array literal (initialization with values)
      const hasArrayInit = node.arguments.length > 0 &&
        node.arguments[0].type === 'ArrayExpression';

      if (typeName === 'Uint8Array') {
        if (isBufferView) {
          // new Uint8Array(buffer) -> buffer (it's already byte[])
          return args[0];
        }
        if (hasArrayInit) {
          // new Uint8Array([...]) -> new byte[] { ... }
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.Byte(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.Byte(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'Uint16Array') {
        if (isBufferView) {
          // new Uint16Array(buffer) -> MemoryMarshal.Cast<byte, ushort>(buffer)
          return this.createMemoryMarshalCast(args[0], 'byte', 'ushort');
        }
        if (hasArrayInit) {
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.UShort(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.UShort(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'Uint32Array') {
        if (isBufferView) {
          return this.createMemoryMarshalCast(args[0], 'byte', 'uint');
        }
        if (hasArrayInit) {
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.UInt(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.UInt(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'Int8Array') {
        if (isBufferView) {
          return this.createMemoryMarshalCast(args[0], 'byte', 'sbyte');
        }
        if (hasArrayInit) {
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.SByte(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.SByte(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'Int16Array') {
        if (isBufferView) {
          return this.createMemoryMarshalCast(args[0], 'byte', 'short');
        }
        if (hasArrayInit) {
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.Short(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.Short(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'Int32Array') {
        if (isBufferView) {
          return this.createMemoryMarshalCast(args[0], 'byte', 'int');
        }
        if (hasArrayInit) {
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.Int(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.Int(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'Float32Array') {
        if (isBufferView) {
          return this.createMemoryMarshalCast(args[0], 'byte', 'float');
        }
        if (hasArrayInit) {
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.Float(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.Float(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'Float64Array') {
        if (isBufferView) {
          return this.createMemoryMarshalCast(args[0], 'byte', 'double');
        }
        if (hasArrayInit) {
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new CSharpArrayCreation(CSharpType.Double(), null, elements);
        }
        return new CSharpArrayCreation(CSharpType.Double(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'ArrayBuffer') {
        // ArrayBuffer is conceptually a byte array in C#
        // Track this variable as an ArrayBuffer for later TypedArray view detection
        this.markAsArrayBuffer(node);
        return new CSharpArrayCreation(CSharpType.Byte(), args[0] || CSharpLiteral.Int(0), null);
      }

      // Handle JavaScript Error -> C# Exception
      if (typeName === 'Error') {
        return new CSharpObjectCreation(new CSharpType('Exception'), args);
      }
      if (typeName === 'TypeError') {
        return new CSharpObjectCreation(new CSharpType('ArgumentException'), args);
      }
      if (typeName === 'RangeError') {
        return new CSharpObjectCreation(new CSharpType('ArgumentOutOfRangeException'), args);
      }

      return new CSharpObjectCreation(new CSharpType(typeName), args);
    }

    transformArrayExpression(node) {
      // Infer element type from context or actual elements
      let elementType = null;

      // First, try to infer from actual elements
      let inferredFromElements = null;
      if (node.elements.length > 0 && node.elements[0]) {
        inferredFromElements = this.inferFullExpressionType(node.elements[0]);
      }

      // Use context if available and appropriate
      if (this.currentArrayElementType) {
        // If context is an array type (e.g., uint[]) but elements are NOT arrays,
        // then the context is for a NESTED array and doesn't apply to this literal.
        // E.g., for uint[][] return, context is uint[], but [a, b] where a/b are uint
        // should be uint[], not uint[][]
        const contextIsArray = this.currentArrayElementType.isArray;
        const firstElemIsArray = node.elements[0] && node.elements[0].type === 'ArrayExpression';

        if (contextIsArray && !firstElemIsArray) {
          // Context is for nested arrays but this array has scalar elements
          // Use the inferred type from elements, or the element type of the context
          elementType = inferredFromElements || this.currentArrayElementType.elementType || CSharpType.UInt();
        } else if (!contextIsArray) {
          // Context is a scalar type - use it directly
          elementType = this.currentArrayElementType;
        } else {
          // Both context and elements are arrays - use context
          elementType = this.currentArrayElementType;
        }
      }

      // Fall back to element inference if no context-based type
      if (!elementType && inferredFromElements && inferredFromElements.name !== 'object') {
        elementType = inferredFromElements;
      }

      // Default to uint for crypto context
      if (!elementType) {
        elementType = CSharpType.UInt();
      }

      // For nested arrays, set the context to the element type for child array transformations
      // e.g., if we're building uint[][], the child arrays should use uint as their element type
      const prevArrayElementType = this.currentArrayElementType;
      if (elementType.isArray) {
        this.currentArrayElementType = elementType.elementType;
      } else {
        this.currentArrayElementType = null;
      }

      // Check if any element is a SpreadElement
      const hasSpread = node.elements.some(e => e && e.type === 'SpreadElement');

      if (hasSpread) {
        // Handle arrays with spread elements using Concat/ToArray pattern
        // [a, ...b, c] -> new[] { a }.Concat(b).Append(c).ToArray()
        // [...y] -> y.ToArray() (simple clone case)
        const result = this.transformArrayWithSpread(node, elementType);
        this.currentArrayElementType = prevArrayElementType;
        return result;
      }

      const elements = node.elements.map(e => this.transformExpression(e));

      // Restore the previous context after processing elements
      this.currentArrayElementType = prevArrayElementType;

      // For empty arrays, use Array.Empty<T>() which is more efficient
      // Note: If the array needs mutation (push), caller should use List<T>.
      // The push() handler will use Concat instead to create new arrays.
      if (elements.length === 0) {
        // Array.Empty<T>() is more efficient than new T[0]
        const emptyCall = new CSharpMethodCall(
          new CSharpIdentifier('Array'),
          'Empty',
          []
        );
        emptyCall.typeArguments = [elementType];
        return emptyCall;
      }

      // Cast elements to the target element type if needed
      // This handles cases like: uint[] arr = new uint[] { x & 0xFF, y << 8 };
      // where bit expressions return int but we need uint
      const castedElements = elements.map((elem, i) => {
        const elemExprType = this.inferFullExpressionType(node.elements[i]);
        if (this.needsNarrowingCast(elemExprType, elementType)) {
          return new CSharpCast(elementType, elem);
        }
        return elem;
      });

      return new CSharpArrayCreation(elementType, null, castedElements);
    }

    /**
     * Transform an array expression containing spread elements
     * [a, ...b, c] -> new[] { a }.Concat(b).Append(c).ToArray()
     */
    transformArrayWithSpread(node, elementType) {
      // Special case: [...y] (just a spread) -> y.ToArray() for cloning
      if (node.elements.length === 1 && node.elements[0].type === 'SpreadElement') {
        const spreadArray = this.transformExpression(node.elements[0].argument);
        return new CSharpMethodCall(spreadArray, 'ToArray', []);
      }

      // General case: build up using Concat/Append chain
      let result = null;
      let pendingElements = [];

      const flushPending = () => {
        if (pendingElements.length === 0) return;
        const arr = new CSharpArrayCreation(elementType, null, pendingElements);
        if (result === null) {
          result = arr;
        } else {
          result = new CSharpMethodCall(result, 'Concat', [arr]);
        }
        pendingElements = [];
      };

      for (const elem of node.elements) {
        if (elem && elem.type === 'SpreadElement') {
          flushPending();
          const spreadArray = this.transformExpression(elem.argument);
          if (result === null) {
            result = spreadArray;
          } else {
            result = new CSharpMethodCall(result, 'Concat', [spreadArray]);
          }
        } else if (elem) {
          let transformed = this.transformExpression(elem);
          const elemExprType = this.inferFullExpressionType(elem);
          if (this.needsNarrowingCast(elemExprType, elementType)) {
            transformed = new CSharpCast(elementType, transformed);
          }
          pendingElements.push(transformed);
        }
      }

      flushPending();

      // Ensure we get an array out
      return new CSharpMethodCall(result, 'ToArray', []);
    }

    transformObjectExpression(node) {
      // For simple objects in JavaScript, use Dictionary<string, object> in C#
      const init = new CSharpObjectInitializer(true); // true = dictionary initializer syntax

      for (const prop of node.properties) {
        // Handle spread elements: { ...obj } - skip them for now
        if (prop.type === 'SpreadElement') continue;

        // Handle computed properties: { [expr]: value }
        if (!prop.key) continue;

        const name = prop.key.name || prop.key.value || 'Unknown';
        const value = this.transformExpression(prop.value);
        init.assignments.push({ name: this.toPascalCase(name), value });
      }

      const creation = new CSharpObjectCreation(
        new CSharpType('Dictionary', { isGeneric: true, genericArguments: [CSharpType.String(), CSharpType.Object()] })
      );
      creation.initializer = init;
      return creation;
    }

    transformConditionalExpression(node) {
      // Ternary condition must be bool in C#
      const condition = this.ensureBooleanCondition(node.test);
      return new CSharpConditional(
        condition,
        this.transformExpression(node.consequent),
        this.transformExpression(node.alternate)
      );
    }

    transformFunctionExpression(node) {
      const params = node.params.map(p => {
        // Escape reserved keywords in parameter names
        const paramName = this.escapeReservedKeyword(p.name);
        const param = new CSharpParameter(paramName, null);
        return param;
      });

      let body;
      if (node.body.type === 'BlockStatement') {
        body = this.transformFunctionBody(node.body, null);
      } else {
        body = this.transformExpression(node.body);
      }

      return new CSharpLambda(params, body);
    }

    /**
     * Transform return statement - handles tuple returns and type casting
     */
    transformReturnStatement(node) {
      if (!node.argument) {
        return new CSharpReturn(null);
      }

      // Check if returning an object expression when method returns a tuple
      if (node.argument.type === 'ObjectExpression' &&
          this.currentMethod?.returnType?.isTuple) {
        return new CSharpReturn(this.transformObjectToTupleExpression(node.argument));
      }

      let expr = this.transformExpression(node.argument);

      // Cast return value to method's return type if needed
      // This handles cases like: byte method() { return x & 0xFF; } where x&0xFF is int
      // But NOT for arrays - array element type is handled in transformArrayExpression
      if (this.currentMethod?.returnType && !this.currentMethod.returnType.isArray) {
        const returnType = this.currentMethod.returnType;
        const exprType = this.inferFullExpressionType(node.argument);

        // Cast if return type is a narrower numeric type than expression type
        if (this.needsNarrowingCast(exprType, returnType)) {
          expr = new CSharpCast(returnType, expr);
        }
      }

      return new CSharpReturn(expr);
    }

    /**
     * Check if we need a narrowing cast from exprType to targetType
     */
    needsNarrowingCast(exprType, targetType) {
      if (!exprType || !targetType) return false;

      // Type widths for numeric types
      const typeWidths = {
        'byte': 1, 'sbyte': 1,
        'ushort': 2, 'short': 2,
        'uint': 4, 'int': 4,
        'ulong': 8, 'long': 8,
        'BigInteger': 100  // Arbitrary large value
      };

      const exprWidth = typeWidths[exprType.name] || 0;
      const targetWidth = typeWidths[targetType.name] || 0;

      // If both are numeric and expression is wider than target, we need a cast
      if (exprWidth > 0 && targetWidth > 0 && exprWidth > targetWidth) {
        return true;
      }

      // Handle signed/unsigned conversions at same or different widths
      const signedUnsignedPairs = [
        ['int', 'uint'], ['uint', 'int'],
        ['long', 'ulong'], ['ulong', 'long'],
        ['short', 'ushort'], ['ushort', 'short'],
        ['byte', 'sbyte'], ['sbyte', 'byte'],
        // Cross-width conversions that need explicit casts
        ['long', 'uint'], ['ulong', 'int'],
        ['int', 'long'], ['uint', 'long'],
        ['uint', 'ulong'], ['int', 'ulong'],
      ];

      for (const [from, to] of signedUnsignedPairs) {
        if (exprType.name === from && targetType.name === to) return true;
      }

      return false;
    }

    /**
     * Check if an initializer expression needs a cast to match the target type
     * Specifically handles cases like ternary expressions `? 1 : 0` which return int
     */
    needsInitializerCast(initExprType, targetType, initNode) {
      if (!initExprType || !targetType) return false;

      // If types match exactly, no cast needed
      if (initExprType.name === targetType.name) return false;

      // All signed/unsigned conversions between numeric types need explicit casts in C#
      const numericTypes = ['byte', 'sbyte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong'];
      if (numericTypes.includes(initExprType.name) && numericTypes.includes(targetType.name)) {
        // C# allows implicit widening of unsigned to larger unsigned, signed to larger signed
        // But NOT: uint -> int, int -> uint, long -> uint, etc.
        // For simplicity, always cast when source != target for numeric types
        return true;
      }

      return false;
    }

    /**
     * Transform an object expression to a C# tuple expression
     * { low: x, high: y } -> (x, y)
     */
    transformObjectToTupleExpression(node) {
      const elements = [];

      // Get expected tuple element types from method return type
      const returnType = this.currentMethod?.returnType;
      const tupleElements = returnType?.isTuple ? returnType.tupleElements : null;

      for (let i = 0; i < node.properties.length; i++) {
        const prop = node.properties[i];
        const propName = prop.key.name || prop.key.value;
        let value = this.transformExpression(prop.value);

        // Find matching tuple element by name or index
        let expectedType = null;
        if (tupleElements) {
          const matchByName = tupleElements.find(e => e.name === propName);
          expectedType = matchByName?.type || (tupleElements[i]?.type);
        }

        // Cast if needed to match expected tuple element type
        if (expectedType) {
          const actualType = this.inferFullExpressionType(prop.value);
          if (actualType && this.needsNarrowingCast(actualType, expectedType)) {
            value = new CSharpCast(expectedType, value);
          }
        }

        // CSharpTupleExpression expects {name?, expression} format
        elements.push({ expression: value });
      }

      return new CSharpTupleExpression(elements);
    }

    transformIfStatement(node) {
      // Handle JavaScript truthy conditions - add explicit comparison for non-bool types
      const condition = this.ensureBooleanCondition(node.test);
      const thenBranch = this.transformStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;
      return new CSharpIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forStmt = new CSharpFor();

      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          const decl = node.init.declarations[0];
          forStmt.initializer = new CSharpVariableDeclaration(
            decl.id.name,
            CSharpType.Int(),
            this.transformExpression(decl.init)
          );
        } else {
          forStmt.initializer = this.transformExpression(node.init);
        }
      }

      if (node.test) {
        forStmt.condition = this.transformExpression(node.test);
      }

      if (node.update) {
        forStmt.incrementor = this.transformExpression(node.update);
      }

      forStmt.body = this.transformStatement(node.body);
      if (forStmt.body.nodeType !== 'Block') {
        const block = new CSharpBlock();
        block.statements.push(forStmt.body);
        forStmt.body = block;
      }

      return forStmt;
    }

    /**
     * Transform for-of statement: for (const x of array) { ... }
     * C# equivalent: foreach (var x in array) { ... }
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      let varType = CSharpType.Var();

      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = decl.id.name;
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the iterable
      const iterable = this.transformExpression(node.right);

      // Transform the body
      let body = this.transformStatement(node.body);
      if (body.nodeType !== 'Block') {
        const block = new CSharpBlock();
        block.statements.push(body);
        body = block;
      }

      return new CSharpForEach(varName, varType, iterable, body);
    }

    /**
     * Transform for-in statement: for (const key in object) { ... }
     * C# equivalent: foreach (var key in object.Keys) { ... }
     */
    transformForInStatement(node) {
      // Extract variable name from left side
      let varName = 'key';
      let varType = CSharpType.Var();

      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = decl.id.name;
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the object - for-in iterates over keys
      const object = this.transformExpression(node.right);
      // Access .Keys property for dictionaries or use directly for arrays (index iteration)
      const iterable = new CSharpMemberAccess(object, 'Keys');

      // Transform the body
      let body = this.transformStatement(node.body);
      if (body.nodeType !== 'Block') {
        const block = new CSharpBlock();
        block.statements.push(body);
        body = block;
      }

      return new CSharpForEach(varName, varType, iterable, body);
    }

    /**
     * Transform template literal: `Hello ${name}!` -> $"Hello {name}!"
     * C# uses interpolated strings with $ prefix
     */
    transformTemplateLiteral(node) {
      let formatStr = '';

      for (let i = 0; i < node.quasis.length; ++i) {
        // Escape braces and other special chars in the raw text
        formatStr += node.quasis[i].value.raw.replace(/{/g, '{{').replace(/}/g, '}}');
        if (i < node.expressions.length) {
          // Insert interpolation placeholder
          const expr = this.transformExpression(node.expressions[i]);
          // For simple identifiers, we can emit directly; for complex expressions, wrap
          if (expr.nodeType === 'Identifier') {
            formatStr += `{${expr.name}}`;
          } else {
            // Complex expressions need to be handled carefully
            formatStr += `{${this.emitExpressionInline(expr)}}`;
          }
        }
      }

      // Return as an interpolated string literal
      return new CSharpLiteral('$"' + formatStr + '"', 'interpolated');
    }

    /**
     * Helper to emit a C# expression inline for interpolated strings
     */
    emitExpressionInline(expr) {
      if (!expr) return '';
      if (expr.nodeType === 'Identifier') return expr.name;
      if (expr.nodeType === 'Literal') {
        if (typeof expr.value === 'string') return `"${expr.value}"`;
        return String(expr.value);
      }
      if (expr.nodeType === 'MemberAccess') {
        return `${this.emitExpressionInline(expr.expression)}.${expr.memberName}`;
      }
      if (expr.nodeType === 'MethodCall') {
        const obj = this.emitExpressionInline(expr.expression);
        const args = expr.arguments.map(a => this.emitExpressionInline(a)).join(', ');
        return `${obj}.${expr.methodName}(${args})`;
      }
      // Fallback - use placeholder
      return `/* complex expr */`;
    }

    transformWhileStatement(node) {
      // Handle JavaScript truthy conditions - add explicit comparison
      const condition = this.ensureBooleanCondition(node.test);
      let body = this.transformStatement(node.body);
      if (body.nodeType !== 'Block') {
        const block = new CSharpBlock();
        block.statements.push(body);
        body = block;
      }
      return new CSharpWhile(condition, body);
    }

    /**
     * Ensure an expression is a proper boolean condition for C#
     * JavaScript uses truthy/falsy, C# requires explicit bool
     * @param {Object} node - The JavaScript AST expression node
     * @returns {Object} A C# AST expression that evaluates to bool
     */
    ensureBooleanCondition(node) {
      // If it's already a comparison or logical expression, transform normally
      if (node.type === 'BinaryExpression') {
        const op = node.operator;
        if (['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(op)) {
          return this.transformExpression(node);
        }
        // Bitwise AND used in boolean context: (a & b) -> (a & b) != 0
        if (op === '&') {
          const expr = this.transformExpression(node);
          return new CSharpBinaryExpression(
            new CSharpParenthesized(expr),
            '!=',
            CSharpLiteral.Int(0)
          );
        }
      }

      if (node.type === 'LogicalExpression') {
        // && and || - in C# these require both operands to be bool
        // Transform recursively
        const left = this.ensureBooleanCondition(node.left);
        const right = this.ensureBooleanCondition(node.right);
        return new CSharpBinaryExpression(left, node.operator === '&&' ? '&&' : '||', right);
      }

      if (node.type === 'UnaryExpression' && node.operator === '!') {
        // Special case: !/regex/.test(str) - known to return bool
        if (node.argument.type === 'CallExpression' &&
            node.argument.callee.type === 'MemberExpression' &&
            node.argument.callee.property.name === 'test' &&
            node.argument.callee.object.type === 'Literal' &&
            node.argument.callee.object.regex) {
          // This is a regex test - it returns bool, so use transformExpression
          return this.transformExpression(node);
        }

        // Special case: !someMethodCall() - assume methods used in boolean context return bool
        if (node.argument.type === 'CallExpression') {
          return this.transformExpression(node);
        }

        // !x - if x is non-bool, use x == 0 or x == null
        const argType = this.inferFullExpressionType(node.argument);
        if (argType && !['bool', 'boolean'].includes(argType.name)) {
          // For arrays/objects: !arr -> arr == null
          if (argType.isArray || argType.name === 'object' || argType.name === 'string') {
            return new CSharpBinaryExpression(
              this.transformExpression(node.argument),
              '==',
              CSharpLiteral.Null()
            );
          }

          // For numeric types, use !value -> value == 0
          // BUT: single-letter parameter names might be arrays (e.g., !x || x.length)
          // so only convert to == 0 if we're confident it's numeric
          const numericTypes = ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'long', 'ulong'];
          if (numericTypes.includes(argType.name)) {
            // Check if this is a single-letter identifier - could be an array parameter
            const isSingleLetterIdent = node.argument.type === 'Identifier' &&
                                        node.argument.name.length === 1;

            if (isSingleLetterIdent) {
              // Single-letter params in crypto code are often arrays - use null check
              return new CSharpBinaryExpression(
                this.transformExpression(node.argument),
                '==',
                CSharpLiteral.Null()
              );
            }

            return new CSharpBinaryExpression(
              this.transformExpression(node.argument),
              '==',
              CSharpLiteral.Int(0)
            );
          }
        }
        // Already bool - use normal not
        return this.transformExpression(node);
      }

      // For call expressions, check if they return bool
      if (node.type === 'CallExpression') {
        const type = this.inferFullExpressionType(node);
        if (type?.name === 'bool' || type?.name === 'boolean') {
          return this.transformExpression(node);
        }
      }

      // For identifiers and other expressions, check type and add comparison
      const type = this.inferFullExpressionType(node);
      const expr = this.transformExpression(node);

      // If it's already bool, no change needed
      if (type?.name === 'bool' || type?.name === 'boolean') {
        return expr;
      }

      // For arrays/objects, check != null
      if (type?.isArray || type?.name === 'object') {
        return new CSharpBinaryExpression(expr, '!=', CSharpLiteral.Null());
      }

      // For string, check both null and empty (or just != null for simple check)
      if (type?.name === 'string') {
        return new CSharpBinaryExpression(expr, '!=', CSharpLiteral.Null());
      }

      // For numeric types, add != 0
      const numericTypes = ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'long', 'ulong', 'float', 'double'];
      if (type && numericTypes.includes(type.name)) {
        return new CSharpBinaryExpression(expr, '!=', CSharpLiteral.Int(0));
      }

      // For unknown types that look like method calls returning bool, trust them
      if (node.type === 'CallExpression') {
        return expr;  // Trust method calls - they might return bool
      }

      // For unknown types, assume numeric and add != 0
      // This handles variables that haven't been type-inferred yet
      return new CSharpBinaryExpression(expr, '!=', CSharpLiteral.Int(0));
    }

    transformDoWhileStatement(node) {
      let body = this.transformStatement(node.body);
      if (body.nodeType !== 'Block') {
        const block = new CSharpBlock();
        block.statements.push(body);
        body = block;
      }
      const condition = this.ensureBooleanCondition(node.test);
      return new CSharpDoWhile(body, condition);
    }

    transformSwitchStatement(node) {
      const switchStmt = new CSharpSwitch(this.transformExpression(node.discriminant));

      for (const caseNode of node.cases) {
        const csCase = new CSharpSwitchCase(
          caseNode.test ? this.transformExpression(caseNode.test) : null
        );
        for (const stmt of caseNode.consequent) {
          const csStmt = this.transformStatement(stmt);
          if (csStmt) {
            if (Array.isArray(csStmt)) {
              csCase.statements.push(...csStmt);
            } else {
              csCase.statements.push(csStmt);
            }
          }
        }
        switchStmt.cases.push(csCase);
      }

      return switchStmt;
    }

    transformTryStatement(node) {
      const tryCatch = new CSharpTryCatch();

      tryCatch.tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        const catchClause = new CSharpCatchClause(
          new CSharpType('Exception'),
          node.handler.param?.name || 'ex',
          this.transformStatement(node.handler.body)
        );
        tryCatch.catchClauses.push(catchClause);
      }

      if (node.finalizer) {
        tryCatch.finallyBlock = this.transformStatement(node.finalizer);
      }

      return tryCatch;
    }

    // ========================[ HELPERS ]========================

    transformIIFE(callNode, targetClass) {
      // First, try to find the factory function in UMD pattern
      // UMD pattern: (function(root, factory) { ... })((function(){...})(), function(deps) { ... })
      if (callNode.arguments && callNode.arguments.length >= 2) {
        const factoryArg = callNode.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          // Found UMD factory function - extract from its body
          if (factoryArg.body && factoryArg.body.body) {
            for (const stmt of factoryArg.body.body) {
              this.transformTopLevel(stmt, targetClass);
            }
            return;
          }
        }
      }

      // Simple IIFE pattern - extract from callee's body
      const func = callNode.callee;
      if (func.body && func.body.type === 'BlockStatement') {
        for (const stmt of func.body.body) {
          this.transformTopLevel(stmt, targetClass);
        }
      }
    }

    transformFunctionDeclaration(node, targetClass) {
      const method = this.transformFunctionToMethod(node.id.name, node);
      targetClass.members.push(method);
    }

    transformExpressionStatement(node, targetClass) {
      // Handle IIFE (immediately invoked function expression)
      if (node.expression.type === 'CallExpression') {
        const callee = node.expression.callee;

        // Check for (function(...) { ... })(...) pattern
        if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') {
          this.transformIIFE(node.expression, targetClass);
          return;
        }
      }

      // Handle module exports, global assignments, etc.
      if (node.expression.type === 'AssignmentExpression') {
        const left = node.expression.left;
        const right = node.expression.right;

        // Check for global.X = ... pattern - export the object/function
        if (left.type === 'MemberExpression' &&
            left.object.type === 'Identifier' &&
            (left.object.name === 'global' || left.object.name === 'module' || left.object.name === 'exports')) {
          // Transform right side as a top-level declaration
          const name = left.property.name || left.property.value;
          if (right.type === 'ObjectExpression') {
            const staticClass = this.transformObjectToStaticClass(name, right);
            if (staticClass) {
              targetClass.nestedTypes.push(staticClass);
            }
          } else if (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression') {
            const method = this.transformFunctionToMethod(name, right);
            targetClass.members.push(method);
          } else if (right.type === 'Identifier') {
            // global.OpCodes = OpCodes - this exports a variable we've already processed
            // No action needed, but could add a comment
          }
        }
      }
    }

    transformClassDeclaration(node, targetClass) {
      const csClass = new CSharpClass(node.id.name);
      const baseClassName = node.superClass?.name || null;

      if (node.superClass) {
        csClass.baseClass = new CSharpType(node.superClass.name || 'object');
      }

      // Transform class body - handle different body structures
      const classBody = node.body?.body || node.body || [];
      if (!Array.isArray(classBody)) {
        console.error(`Class ${node.id?.name} has unexpected body structure`);
        targetClass.nestedTypes.push(csClass);
        return;
      }

      for (const item of classBody) {
        if (item.type === 'MethodDefinition') {
          if (item.kind === 'constructor') {
            const ctor = this.transformConstructor(item, csClass, baseClassName);
            if (ctor) csClass.members.push(ctor);
          } else if (item.kind === 'get' || item.kind === 'set') {
            const prop = this.transformAccessor(item, csClass, baseClassName);
            if (prop) csClass.members.push(prop);
          } else {
            // Look up inherited method signature from framework types
            const methodName = item.key.name;
            const inheritedSig = baseClassName ? this.getInheritedMethodSignature(baseClassName, this.toPascalCase(methodName)) : null;
            const method = this.transformFunctionToMethod(methodName, item.value, inheritedSig);
            method.isStatic = item.static;
            csClass.members.push(method);
          }
        } else if (item.type === 'PropertyDefinition' || item.type === 'ClassProperty') {
          const field = this.transformClassProperty(item, baseClassName);
          if (field) csClass.members.push(field);
        } else if (item.type === 'StaticBlock') {
          // Static initialization block - transform to static constructor
          const staticCtor = this.transformStaticBlock(item);
          if (staticCtor) csClass.members.push(staticCtor);
        }
      }

      targetClass.nestedTypes.push(csClass);
    }

    /**
     * Transform a class constructor method
     * @param {object} methodNode - The constructor AST node
     * @param {CSharpClass} csClass - The C# class being built
     * @param {string|null} baseClassName - The base class name for type lookup
     */
    transformConstructor(methodNode, csClass, baseClassName = null) {
      const ctor = new CSharpConstructor(csClass.name);
      const ctorBody = new CSharpBlock(); // Use CSharpBlock instead of plain array

      // Transform parameters - infer types from base class properties
      if (methodNode.value?.params) {
        for (const param of methodNode.value.params) {
          const rawName = param.name || param.left?.name || 'param';
          const paramName = this.escapeReservedKeyword(rawName);

          // Look up property type from base class
          let paramType = null;
          if (baseClassName) {
            const propType = this.getInheritedPropertyType(baseClassName, this.toPascalCase(rawName));
            if (propType) {
              paramType = this.mapTypeFromKnowledge(propType);
            }
          }

          // Fall back to name-based inference
          if (!paramType) {
            paramType = this.inferParameterType(rawName) || CSharpType.Object();
          }

          ctor.parameters.push(new CSharpParameter(paramName, paramType));
        }
      }

      // Transform constructor body
      if (methodNode.value?.body?.body) {
        for (const stmt of methodNode.value.body.body) {
          // Handle super() call - convert to base() chain
          // Support both Super node type and Identifier with name "super"
          const callee = stmt.expression?.callee;
          const isSuperCall = stmt.type === 'ExpressionStatement' &&
              stmt.expression?.type === 'CallExpression' &&
              (callee?.type === 'Super' || (callee?.type === 'Identifier' && callee?.name === 'super'));

          if (isSuperCall) {
            // Wrap arguments in object expected by emitter
            const superArgs = (stmt.expression.arguments || []).map(a => this.transformExpression(a));
            ctor.baseCall = { arguments: superArgs };
            continue;
          }

          const csStmt = this.transformStatement(stmt);
          if (csStmt) ctorBody.statements.push(csStmt);
        }
      }

      ctor.body = ctorBody;
      return ctor;
    }

    /**
     * Transform a getter or setter accessor
     * @param {object} methodNode - The accessor method node
     * @param {CSharpClass} csClass - The C# class being built
     * @param {string|null} baseClassName - The base class name for type lookup
     */
    transformAccessor(methodNode, csClass, baseClassName = null) {
      const propName = this.toPascalCase(methodNode.key?.name || 'Unknown');
      const isGetter = methodNode.kind === 'get';

      // Find or create property
      let prop = csClass.members.find(m => m instanceof CSharpProperty && m.name === propName);
      let isNewProperty = false;
      if (!prop) {
        // Try to get type from base class first
        let propType = null;
        if (baseClassName) {
          const inheritedType = this.getInheritedPropertyType(baseClassName, propName);
          if (inheritedType) {
            propType = this.mapTypeFromKnowledge(inheritedType);
          }
        }

        // Fall back to inference
        if (!propType) {
          propType = isGetter ?
            this.inferReturnType(methodNode.value) || CSharpType.Object() :
            this.inferParameterType(methodNode.value?.params?.[0]) || CSharpType.Object();
        }
        prop = new CSharpProperty(propName, propType);
        prop.isStatic = methodNode.static;
        isNewProperty = true;
      }

      // Transform accessor body
      const body = [];
      if (methodNode.value?.body?.body) {
        for (const stmt of methodNode.value.body.body) {
          const csStmt = this.transformStatement(stmt);
          if (csStmt) body.push(csStmt);
        }
      }

      if (isGetter) {
        prop.getter = body;
      } else {
        prop.setter = body;
      }

      // Return null if property already exists (was just updated)
      return isNewProperty ? prop : null;
    }

    /**
     * Transform a class property definition
     * @param {object} propNode - The property definition node
     * @param {string|null} baseClassName - The base class name for type lookup
     */
    transformClassProperty(propNode, baseClassName = null) {
      const name = this.toPascalCase(propNode.key?.name || 'Unknown');

      // Try to get type from base class first
      let propType = null;
      if (baseClassName) {
        const inheritedType = this.getInheritedPropertyType(baseClassName, name);
        if (inheritedType) {
          propType = this.mapTypeFromKnowledge(inheritedType);
        }
      }

      // Fall back to expression type inference
      if (!propType) {
        propType = this.inferExpressionType(propNode.value) || CSharpType.Object();
      }
      const field = new CSharpField(name, propType);
      field.isStatic = propNode.static;
      if (propNode.value) {
        field.initializer = this.transformExpression(propNode.value);
      }
      return field;
    }

    transformStaticBlock(staticBlockNode) {
      // ES2022 static initialization blocks -> C# static constructor
      // static { code } -> static ClassName() { code }
      const body = staticBlockNode.body;
      const statements = body.map(stmt => this.transformStatement(stmt));

      // Create a static constructor (constructor with static modifier)
      const ctor = new CSharpConstructor(this.currentClass?.name || 'UnknownClass');
      ctor.isStatic = true;
      ctor.body = statements;

      return ctor;
    }

    transformToField(name, valueNode, explicitType = null) {
      const fieldType = explicitType || this.inferExpressionType(valueNode) || CSharpType.Object();
      const field = new CSharpField(this.toPascalCase(name), fieldType);
      field.isStatic = true;

      // For List<T> types with empty array initializer, generate new List<T>() instead of Array.Empty
      if (explicitType && explicitType.name === 'List' && valueNode.type === 'ArrayExpression' && valueNode.elements.length === 0) {
        field.initializer = new CSharpObjectCreation(explicitType, []);
      } else {
        field.initializer = this.transformExpression(valueNode);
      }
      return field;
    }

    // ========================[ TYPE INFERENCE ]========================

    mapType(typeInfo) {
      if (!typeInfo) return null;

      const typeName = typeof typeInfo === 'string' ? typeInfo : typeInfo.name;
      if (!typeName) return null;

      // Handle JSDoc object/tuple return types like "{high64: uint32[], low64: uint32[]}"
      // or "(high64: uint32[], low64: uint32[])" - convert to C# tuples
      // Also handle array of tuples: "(high: uint32, low: uint32)[]"
      if ((typeName.startsWith('{') && (typeName.endsWith('}') || typeName.endsWith('}[]'))) ||
          (typeName.startsWith('(') && (typeName.endsWith(')') || typeName.endsWith(')[]')) && typeName.includes(':'))) {
        // Check if it's an array of tuples
        const isArray = typeName.endsWith('[]');
        const tupleStr = isArray ? typeName.slice(0, -2) : typeName;
        const tupleType = this.parseObjectTypeToTuple(tupleStr);
        if (isArray) {
          return CSharpType.Array(tupleType);
        }
        return tupleType;
      }

      // Handle arrays explicitly (e.g., "uint8[]" or "byte[]" or "uint32[][]")
      // Use recursive mapType to handle nested arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        // Recursively map the element type to handle nested arrays like uint32[][]
        const elementType = this.mapType(elementTypeName) || new CSharpType(elementTypeName);
        return CSharpType.Array(elementType);
      }

      // Check if typeInfo explicitly marks it as array
      if (typeInfo.isArray) {
        // If there's an elementType, recursively map it
        if (typeInfo.elementType) {
          const mappedElement = this.mapType(typeInfo.elementType);
          return CSharpType.Array(mappedElement || CSharpType.Object());
        }
        const mapped = TYPE_MAP[typeName] || typeName;
        const elementType = new CSharpType(mapped);
        return CSharpType.Array(elementType);
      }

      // Handle pre-parsed generic types from the type-aware parser
      // e.g., { name: 'Func', isGeneric: true, genericTypes: [...] }
      if (typeInfo.isGeneric && typeInfo.genericTypes && typeInfo.genericTypes.length > 0) {
        const mappedArgTypes = typeInfo.genericTypes.map(gt => {
          const mapped = this.mapType(gt);
          return mapped || new CSharpType(gt.name || 'object');
        });
        return new CSharpType(typeName, { isGeneric: true, genericArguments: mappedArgTypes });
      }

      // Handle Func<...>, Action<...>, and List<...> generic types from string
      // e.g., "Func<uint32, uint32, uint32>" -> "Func<uint, uint, uint>"
      // e.g., "List<uint8[]>" -> "List<byte[]>"
      if (typeName.startsWith('Func<') || typeName.startsWith('Action<') || typeName.startsWith('List<')) {
        const genericPrefix = typeName.startsWith('Func<') ? 'Func' :
                              typeName.startsWith('Action<') ? 'Action' : 'List';
        const innerContent = typeName.slice(genericPrefix.length + 1, -1); // Remove "Prefix<" and ">"
        const typeArgs = this.splitGenericTypeArgs(innerContent);
        const mappedArgTypes = typeArgs.map(arg => {
          const mapped = this.mapType(arg.trim());
          return mapped || new CSharpType(arg.trim());
        });
        return new CSharpType(genericPrefix, { isGeneric: true, genericArguments: mappedArgTypes });
      }

      const mapped = TYPE_MAP[typeName];
      if (mapped) {
        return new CSharpType(mapped);
      }

      return new CSharpType(typeName);
    }

    /**
     * Split generic type arguments, handling nested generics
     * e.g., "uint32, Func<int32, uint32>, string" -> ["uint32", "Func<int32, uint32>", "string"]
     */
    splitGenericTypeArgs(content) {
      const args = [];
      let current = '';
      let depth = 0;

      for (const char of content) {
        if (char === '<') {
          depth++;
          current += char;
        } else if (char === '>') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      if (current.trim()) {
        args.push(current.trim());
      }

      return args;
    }

    /**
     * Parse JSDoc object type notation to C# tuple
     * e.g., "{high64: uint32[], low64: uint32[]}" -> (uint[] high64, uint[] low64)
     * or "(high64: uint32[], low64: uint32[])" -> (uint[] high64, uint[] low64)
     */
    parseObjectTypeToTuple(typeString) {
      // Remove outer delimiters (braces or parentheses)
      const inner = typeString.slice(1, -1).trim();
      if (!inner) return CSharpType.Object();

      // Split by comma (handling nested types)
      const parts = this.splitTypeProperties(inner);
      if (parts.length < 2) {
        // C# tuples need at least 2 elements, fall back to object
        return CSharpType.Object();
      }

      const elements = [];
      for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;

        const propName = part.slice(0, colonIdx).trim();
        const propType = part.slice(colonIdx + 1).trim();
        const mappedType = this.mapType(propType) || CSharpType.Object();

        elements.push({ name: propName, type: mappedType });
      }

      if (elements.length < 2) {
        return CSharpType.Object();
      }

      return CSharpType.Tuple(elements);
    }

    /**
     * Split type properties, handling nested braces
     */
    splitTypeProperties(str) {
      const parts = [];
      let current = '';
      let depth = 0;

      for (const char of str) {
        if (char === '{' || char === '[' || char === '(') depth++;
        if (char === '}' || char === ']' || char === ')') depth--;

        if (char === ',' && depth === 0) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      if (current.trim()) {
        parts.push(current.trim());
      }

      return parts;
    }

    inferParameterType(paramName) {
      // Handle case where paramName is an AST node instead of string
      if (typeof paramName === 'object') {
        paramName = paramName?.name || paramName?.left?.name || 'param';
      }
      if (typeof paramName !== 'string') {
        return CSharpType.Object();
      }
      // Pattern-based inference for crypto parameters
      const lowerName = paramName.toLowerCase();

      if (lowerName.includes('byte') || lowerName === 'b' || lowerName.match(/^b\d$/))
        return CSharpType.Byte();
      // Array-related parameter names
      if (lowerName.includes('key') || lowerName.includes('data') || lowerName.includes('input') ||
          lowerName.includes('output') || lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('counter') || lowerName.includes('state') ||
          lowerName.includes('nonce') || lowerName.includes('iv') || lowerName.includes('tag'))
        return CSharpType.Array(CSharpType.Byte());
      if (lowerName.includes('shift') || lowerName.includes('position') || lowerName.includes('index') ||
          lowerName === 'n' || lowerName === 'i' || lowerName === 'j')
        return CSharpType.Int();
      if (lowerName.includes('value') || lowerName.includes('word'))
        return CSharpType.UInt();

      return CSharpType.UInt();
    }

    inferExpressionType(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'string') return CSharpType.String();
          if (typeof node.value === 'boolean') return CSharpType.Bool();
          if (typeof node.value === 'number') {
            if (Number.isInteger(node.value)) {
              if (node.value >= 0 && node.value <= 255) return CSharpType.Byte();
              if (node.value >= 0 && node.value <= 0xFFFFFFFF) return CSharpType.UInt();
              return CSharpType.Long();
            }
            return CSharpType.Double();
          }
          return null;

        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const elemType = this.inferExpressionType(node.elements[0]) || CSharpType.UInt();
            return CSharpType.Array(elemType);
          }
          return CSharpType.Array(CSharpType.UInt());

        case 'NewExpression':
          if (node.callee.type === 'Identifier') {
            const typeName = node.callee.name;
            if (typeName === 'Array' || typeName === 'Uint8Array') {
              return CSharpType.Array(CSharpType.Byte());
            }
            if (typeName === 'Uint16Array') {
              return CSharpType.Array(CSharpType.UShort());
            }
            if (typeName === 'Uint32Array') {
              return CSharpType.Array(CSharpType.UInt());
            }
          }
          return null;

        default:
          return null;
      }
    }

    extractTypeInfo(funcNode) {
      // Extract from typeInfo property if available
      if (funcNode.typeInfo) {
        return funcNode.typeInfo;
      }

      // Try to extract from leading comments
      if (funcNode.leadingComments && funcNode.leadingComments.length > 0) {
        for (const comment of funcNode.leadingComments) {
          if (comment.value && comment.value.includes('@')) {
            // Parse JSDoc
            const typeInfo = this.parseJSDocComment(comment.value);
            if (typeInfo) return typeInfo;
          }
        }
      }

      return null;
    }

    /**
     * Parse JSDoc comment into type info
     * @param {string} commentText - The JSDoc comment text
     * @returns {object|null} Type info object with params, returns, description
     */
    parseJSDocComment(commentText) {
      const typeInfo = {
        params: new Map(),
        returns: null,
        description: null,
        isConstructor: false,
        csharpOverride: null  // Native C# code to use instead of transpiling
      };

      // Extract @param {type} name lines
      const paramRegex = /@param\s+\{([^}]+)\}\s+(\w+)/g;
      let match;
      while ((match = paramRegex.exec(commentText)) !== null) {
        const [, typeStr, paramName] = match;
        typeInfo.params.set(paramName, typeStr.trim());
      }

      // Extract @returns {type} or @return {type}
      const returnsRegex = /@returns?\s+\{([^}]+)\}/;
      const returnsMatch = commentText.match(returnsRegex);
      if (returnsMatch) {
        typeInfo.returns = returnsMatch[1].trim();
      }

      // Check for @constructor
      if (/@constructor/i.test(commentText)) {
        typeInfo.isConstructor = true;
      }

      // Extract @csharp directive - native C# code to use instead of transpiling
      // Format: @csharp <C# statement(s)>
      const csharpRegex = /@csharp\s+(.+?)(?=\n\s*\*?\s*@|\n\s*\*\/|$)/s;
      const csharpMatch = commentText.match(csharpRegex);
      if (csharpMatch) {
        typeInfo.csharpOverride = csharpMatch[1].trim();
      }

      // Extract description (first line that isn't an @ tag)
      const descLines = commentText.split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line && !line.startsWith('@'));
      if (descLines.length > 0) {
        typeInfo.description = descLines[0];
      }

      return typeInfo;
    }

    /**
     * Check if an expression is a push() call on an array
     */
    isPushCallExpression(node) {
      if (!node || node.type !== 'CallExpression') return false;
      if (node.callee.type !== 'MemberExpression') return false;
      const methodName = node.callee.property.name || node.callee.property.value;
      return methodName === 'push';
    }

    /**
     * Transform arr.push(x) statement to arr = arr.Append(x).ToArray()
     * Also handles spread: arr.push(...other) -> arr = arr.Concat(other).ToArray()
     */
    transformPushStatementToAssignment(node) {
      const target = this.transformExpression(node.callee.object);

      // Infer the array element type to properly cast arguments
      const arrayType = this.inferFullExpressionType(node.callee.object);
      const elementType = arrayType?.isArray ? arrayType.elementType : null;

      // Build the chain of Append/Concat calls
      let chainExpr = target;
      for (const jsArg of node.arguments) {
        // Handle spread elements: ...array -> Concat(array)
        if (jsArg.type === 'SpreadElement') {
          const spreadArg = this.transformExpression(jsArg.argument);
          chainExpr = new CSharpMethodCall(chainExpr, 'Concat', [spreadArg]);
        } else {
          // Regular element: use Append
          let arg = this.transformExpression(jsArg);

          // Cast the argument to the array element type if needed
          if (elementType && elementType.name !== 'object') {
            const argType = this.inferFullExpressionType(jsArg);
            // Only cast if types differ and we know both types
            if (argType && argType.name !== elementType.name) {
              arg = new CSharpCast(elementType, arg);
            }
          }

          chainExpr = new CSharpMethodCall(chainExpr, 'Append', [arg]);
        }
      }
      const toArrayExpr = new CSharpMethodCall(chainExpr, 'ToArray', []);

      // Create: arr = arr.Append(x).ToArray() or arr = arr.Concat(other).ToArray()
      const assignment = new CSharpAssignment(target, '=', toArrayExpr);
      return new CSharpExpressionStatement(assignment);
    }

    /**
     * Check if a function body has any return statements with values
     */
    hasReturnWithValue(bodyNode) {
      if (!bodyNode) return false;

      const checkNode = (node) => {
        if (!node) return false;

        if (node.type === 'ReturnStatement' && node.argument) {
          return true;
        }

        // Check children
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              for (const item of child) {
                if (item && typeof item === 'object' && checkNode(item)) {
                  return true;
                }
              }
            } else if (checkNode(child)) {
              return true;
            }
          }
        }
        return false;
      };

      return checkNode(bodyNode);
    }

    /**
     * Pre-register local variable types by analyzing variable declarations
     * This allows return type inference to understand what local variables hold
     * @param {object} bodyNode - Function body AST node
     */
    preRegisterLocalVariableTypes(bodyNode) {
      // Track variables declared without initializers
      const uninitializedVars = new Set();

      const visit = (node) => {
        if (!node || typeof node !== 'object') return;

        // Handle variable declarations: const x = ..., let y = ..., var z = ...
        if (node.type === 'VariableDeclaration') {
          for (const decl of node.declarations) {
            if (decl.id.type === 'Identifier') {
              const varName = decl.id.name;
              if (decl.init) {
                const initType = this.inferFullExpressionType(decl.init);
                if (initType && initType.name !== 'object') {
                  this.registerVariableType(varName, initType);
                }
              } else {
                // Track uninitialized variable for later assignment analysis
                uninitializedVars.add(varName);
              }
            }
          }
        }

        // Handle assignments to uninitialized variables anywhere in the code
        // This catches: pool = arrays8, if (...) pool = arrays8, etc.
        if (node.type === 'AssignmentExpression' &&
            node.operator === '=' &&
            node.left.type === 'Identifier') {
          const varName = node.left.name;
          if (uninitializedVars.has(varName) && !this.getVariableType(varName)) {
            const assignedType = this.inferFullExpressionType(node.right);
            if (assignedType && assignedType.name !== 'object') {
              this.registerVariableType(varName, assignedType);
            }
          }
        }

        // Recursively visit children (but skip nested function bodies)
        for (const key in node) {
          if (key === 'type' || key === 'loc' || key === 'range') continue;
          const value = node[key];

          // Skip nested function bodies - they have different scope
          if ((node.type === 'FunctionExpression' ||
               node.type === 'FunctionDeclaration' ||
               node.type === 'ArrowFunctionExpression') && key === 'body') continue;

          if (Array.isArray(value)) {
            value.forEach(visit);
          } else if (value && typeof value === 'object') {
            visit(value);
          }
        }
      };

      visit(bodyNode);
    }

    /**
     * Try to infer return type from return statements in function body
     */
    inferReturnType(bodyNode) {
      if (!bodyNode) return null;

      const returnTypes = [];

      const collectReturns = (node) => {
        if (!node) return;

        if (node.type === 'ReturnStatement' && node.argument) {
          const type = this.inferFullExpressionType(node.argument);
          if (type) {
            returnTypes.push(type);
          }
        }

        // Check children
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              child.forEach(item => {
                if (item && typeof item === 'object') {
                  collectReturns(item);
                }
              });
            } else {
              collectReturns(child);
            }
          }
        }
      };

      collectReturns(bodyNode);

      // Return the first found type (could be improved to find common type)
      return returnTypes.length > 0 ? returnTypes[0] : null;
    }

    // ========================[ UTILITY METHODS ]========================

    toPascalCase(str) {
      if (!str || typeof str !== 'string') return 'Unknown';
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    toCamelCase(str) {
      if (!str || typeof str !== 'string') return 'unknown';
      const result = str.charAt(0).toLowerCase() + str.slice(1);
      return this.escapeReservedKeyword(result);
    }

    /**
     * Escape C# reserved keywords with @ prefix
     */
    escapeReservedKeyword(name) {
      const reservedKeywords = new Set([
        'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
        'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default',
        'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit',
        'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach',
        'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal',
        'is', 'lock', 'long', 'namespace', 'new', 'null', 'object',
        'operator', 'out', 'override', 'params', 'private', 'protected',
        'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
        'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch',
        'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong',
        'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void',
        'volatile', 'while'
      ]);

      if (reservedKeywords.has(name)) {
        return '@' + name;
      }
      return name;
    }

    createXmlDoc(summary, description = null) {
      const doc = new CSharpXmlDoc();
      doc.summary = description ? `${summary}\n${description}` : summary;
      return doc;
    }

    createMethodXmlDoc(typeInfo, parameters) {
      const doc = new CSharpXmlDoc();
      doc.summary = typeInfo.description || '';

      for (const param of parameters) {
        // typeInfo.params can be either a Map or an Array depending on source
        let paramInfo = null;
        if (typeInfo.params instanceof Map) {
          // From parseJSDocComment - Map of name -> typeString
          paramInfo = typeInfo.params.has(param.name) ? { name: param.name, type: typeInfo.params.get(param.name) } : null;
        } else if (Array.isArray(typeInfo.params)) {
          paramInfo = typeInfo.params.find(p => p.name === param.name);
        }
        doc.parameters.push({
          name: param.name,
          description: paramInfo?.description || 'Input parameter'
        });
      }

      if (typeInfo.returns) {
        doc.returns = typeInfo.returns.description || 'Result of the operation';
      }

      return doc;
    }

    createPopExpression(target) {
      // Create: ((Func<T>)(() => { var v = list[list.Count-1]; list.RemoveAt(list.Count-1); return v; }))()
      const lambda = new CSharpLambda([], new CSharpBlock());
      lambda.body.statements.push(
        new CSharpVariableDeclaration(
          '__v',
          CSharpType.Var(),
          new CSharpElementAccess(
            target,
            new CSharpBinaryExpression(
              new CSharpMemberAccess(target, 'Count'),
              '-',
              CSharpLiteral.Int(1)
            )
          )
        )
      );
      lambda.body.statements.push(
        new CSharpExpressionStatement(
          new CSharpMethodCall(
            target,
            'RemoveAt',
            [new CSharpBinaryExpression(
              new CSharpMemberAccess(target, 'Count'),
              '-',
              CSharpLiteral.Int(1)
            )]
          )
        )
      );
      lambda.body.statements.push(new CSharpReturn(new CSharpIdentifier('__v')));

      // Wrap in cast and invoke
      const cast = new CSharpCast(
        new CSharpType('Func', { isGeneric: true, genericArguments: [CSharpType.UInt()] }),
        new CSharpParenthesized(lambda)
      );
      // Use Invoke() method to call the delegate
      return new CSharpMethodCall(new CSharpParenthesized(cast), 'Invoke', []);
    }
  }

  // Export
  const exports = { CSharpTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CSharpTransformer = CSharpTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
