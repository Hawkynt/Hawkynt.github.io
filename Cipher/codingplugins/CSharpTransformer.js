/**
 * CSharpTransformer.js - IL AST to C# AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to C# AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → C# AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - namespace: C# namespace name
 *   - className: Main class name
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
    CSharpAssignment, CSharpMemberAccess, CSharpElementAccess, CSharpElementAccessFromEnd, CSharpRange, CSharpMethodCall,
    CSharpObjectCreation, CSharpArrayCreation, CSharpObjectInitializer, CSharpAnonymousObject, CSharpStringInterpolation, CSharpCast,
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
    'Array': 'byte[]', 'array': 'byte[]',  // In crypto context, untyped arrays are typically byte arrays
    // Typed arrays -> C# arrays
    'Uint8Array': 'byte[]', 'Int8Array': 'sbyte[]',
    'Uint16Array': 'ushort[]', 'Int16Array': 'short[]',
    'Uint32Array': 'uint[]', 'Int32Array': 'int[]',
    'Float32Array': 'float[]', 'Float64Array': 'double[]',
    'BigUint64Array': 'ulong[]', 'BigInt64Array': 'long[]'
  };

  /**
   * JavaScript AST to C# AST Transformer
   */
  class CSharpTransformer {
    constructor(options = {}) {
      this.options = options;
      // Default framework types for override detection
      const defaultFrameworkTypes = {
        'Algorithm': {
          methods: {
            'CreateInstance': { params: [{ name: 'isInverse', type: 'bool', defaultValue: 'false' }], returns: 'object' }
          }
        },
        'IAlgorithmInstance': {
          methods: {
            'Feed': { params: [{ name: 'data', type: 'byte[]' }], returns: 'void' },
            'Result': { params: [], returns: 'byte[]' }
          }
        },
        'IBlockCipherInstance': {
          extends: 'IAlgorithmInstance',
          methods: {}
        },
        'IHashFunctionInstance': {
          extends: 'IAlgorithmInstance',
          methods: {}
        },
        'IStreamCipherInstance': {
          extends: 'IAlgorithmInstance',
          methods: {}
        },
        'BlockCipherAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'HashFunctionAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'StreamCipherAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'AeadAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'ChecksumAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'CompressionAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'MacAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'KdfAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'AsymmetricAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'EncodingAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'ClassicalCipherAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'EccAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        },
        'RandomAlgorithm': {
          extends: 'Algorithm',
          methods: {}
        }
      };
      // Merge framework types: always use defaults, then overlay any provided types
      this.typeKnowledge = {
        ...options.typeKnowledge,
        frameworkTypes: {
          ...defaultFrameworkTypes,
          ...(options.typeKnowledge?.frameworkTypes || {})
        }
      };
      this.parser = options.parser || null;
      this.jsDocParser = options.jsDocParser || null;
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();  // Maps variable name -> CSharpType
      this.classFieldTypes = new Map(); // Maps field name -> CSharpType for this.propName lookups
      this.methodSignatures = new Map(); // Maps "ClassName.MethodName" -> { params: CSharpType[], returnType: CSharpType }
      this.nestedClasses = [];
      this.inlineClasses = [];
      this.currentSetterParam = null; // Tracks JS setter parameter name for 'value' replacement
      this.currentArrayElementType = null; // Track expected element type for array operations
      this.scopeStack = []; // Stack of variable scopes for nested functions
      this.arrayBufferVariables = new Set(); // Track variables that are ArrayBuffers
      this.methodDeclaredVars = new Set(); // Track all variables declared in current method for scope collision detection
      this.variableNameMap = new Map(); // Map original JS name -> C# name for renamed variables
      this.jaggedArrayVars = new Set(); // Track variables that are jagged (2D) arrays
      // Track constructor default parameters for each class
      // Maps: className -> [defaultValues] (array of CSharpLiteral/CSharpExpression)
      this.constructorDefaultParams = new Map();
      this.parentAlgorithmClass = null; // Track the outer algorithm class for Instance constructor parameter typing
      // Track properties that conflict with methods - these use backing fields
      // Maps: PascalCase property name -> backing field name (e.g., 'Result' -> '_result')
      this.methodConflictingProperties = new Map();
    }

    /**
     * Check if a variable name refers to an ArrayBuffer
     */
    isArrayBufferVariable(name) {
      return this.arrayBufferVariables.has(name);
    }

    /**
     * Get parameter type from typeInfo.params (handles both Map and array formats)
     * @param {Object} typeInfo - Type info object from JSDoc or IL AST
     * @param {string} paramName - Parameter name to look up
     * @returns {string|null} The type string or null if not found
     */
    getParamType(typeInfo, paramName) {
      if (!typeInfo?.params) return null;

      // Handle Map format (from parseJSDocComment)
      if (typeInfo.params instanceof Map) {
        return typeInfo.params.has(paramName) ? typeInfo.params.get(paramName) : null;
      }

      // Handle array format (from IL AST)
      if (Array.isArray(typeInfo.params)) {
        const param = typeInfo.params.find(p => p.name === paramName);
        if (param?.type) {
          // type could be an object { name: 'uint8', isArray: true, ... } or a string
          if (typeof param.type === 'string') return param.type;
          if (param.type.name) {
            return param.type.isArray ? `${param.type.name}[]` : param.type.name;
          }
        }
        return null;
      }

      return null;
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
     * Pre-register a method's signature before transforming its body
     * This allows cross-method calls to have type information available
     * @param {string} name - The method name
     * @param {Object} funcNode - The function AST node
     * @param {Object} typeInfo - Type information from JSDoc
     */
    preRegisterMethodSignature(name, funcNode, typeInfo) {
      if (!this.currentClass) return;

      const pascalName = this.toPascalCase(name);
      const funcTypeInfo = funcNode.typeInfo || this.extractTypeInfo(funcNode);

      // Detect array usage patterns in the function body for type inference
      const arrayUsageParams = funcNode.body ? this.detectArrayUsageParams(funcNode.body) : new Set();

      // Infer parameter types and build a map for return type inference
      const paramTypes = [];
      const paramTypeMap = new Map();
      if (funcNode.params) {
        for (let i = 0; i < funcNode.params.length; i++) {
          const param = funcNode.params[i];
          const rawParamName = param.name || param.left?.name || 'param';
          let paramType;

          // Priority: 1) JSDoc, 2) array usage detection, 3) scalar usage, 4) name inference
          const jsDocParamType = this.getParamType(funcTypeInfo, rawParamName);
          if (jsDocParamType) {
            paramType = this.mapType(jsDocParamType);
          } else if (arrayUsageParams.has(rawParamName)) {
            const elemType = this.detectArrayElementType(rawParamName, funcNode.body);
            paramType = CSharpType.Array(elemType);
          } else if (param.right && param.right.type === 'Literal') {
            // Parameter has a literal default value - infer type from default
            if (typeof param.right.value === 'boolean') {
              paramType = CSharpType.Bool();
            } else if (typeof param.right.value === 'string') {
              paramType = CSharpType.String();
            } else if (typeof param.right.value === 'number') {
              // Default to int for numeric literals to match C# default
              paramType = CSharpType.Int();
            } else {
              paramType = this.inferParameterType(rawParamName);
            }
          } else if (funcNode.body && this.isUsedAsScalar32Bit(rawParamName, funcNode.body)) {
            paramType = CSharpType.UInt();
          } else {
            paramType = this.inferParameterType(rawParamName);
          }

          paramTypes.push(paramType);
          paramTypeMap.set(rawParamName, paramType);
        }
      }

      // Infer return type
      let returnType = this.mapType(funcTypeInfo?.returns);
      if (!returnType && funcNode.body) {
        // Try to infer from body - check if there are return statements with values
        const hasValueReturn = this.hasReturnWithValue(funcNode.body);
        if (!hasValueReturn) {
          returnType = CSharpType.Void();
        } else {
          // Do a basic inference - look for explicit return type patterns
          // Note: Full inference happens in transformFunctionToMethod, but we need a good estimate here
          // for cross-method type lookups
          // Pass parameter types so return type can be inferred from parameter identifiers
          returnType = this.inferReturnType(funcNode.body, paramTypeMap) || CSharpType.Object();
        }
      } else if (!returnType) {
        returnType = CSharpType.Void();
      }

      this.registerMethodSignature(this.currentClass.name, pascalName, paramTypes, returnType);
    }

    /**
     * Refine method return types after all methods have been registered.
     * This allows methods to look up return types of other methods that were defined later in the source.
     * @param {Array} methods - Array of method nodes with name and funcNode
     */
    refineMethodReturnTypes(methods) {
      if (!this.currentClass) return;

      for (const { name, funcNode } of methods) {
        const pascalName = this.toPascalCase(name);
        const sig = this.getMethodSignature(this.currentClass.name, pascalName);

        // Refine return type if the initial inference was likely incorrect
        // Pre-registration doesn't have full local variable context, so types like 'byte', 'object'
        // might be wrong (especially for crypto code where uint is common)
        // Note: We only refine NON-ARRAY scalar types - array return types are usually correct
        if (sig && sig.returnType && funcNode.body) {
          const currentType = sig.returnType;
          // Only refine scalar types, not arrays
          const shouldRefine = !currentType.isArray && (
            currentType.name === 'object' ||
            currentType.name === 'byte' ||  // Often should be uint in crypto context
            currentType.name === 'dynamic'
          );

          if (shouldRefine) {
            // Push scope to avoid leaking variable types
            this.pushScope();
            // Pre-register local variable types for better inference
            this.preRegisterLocalVariableTypes(funcNode.body);
            // Try to re-infer the return type now that all method signatures are available
            // Use the same fallback logic as transformFunctionToMethod: if inference returns
            // byte/object in crypto context, use uint as default (most crypto ops use 32-bit)
            let refinedType = this.inferReturnType(funcNode.body);
            // In crypto context, byte often should be uint (32-bit operations common)
            // Use same fallback as transformFunctionToMethod
            // BUT don't change if refined type is an array
            if (!refinedType?.isArray && (!refinedType || refinedType.name === 'object' || refinedType.name === 'byte')) {
              // Check if method name suggests a byte return type explicitly
              // Only consider it "returns byte" if it's a getter pattern like "getByte" or "readByte"
              // Not just any method with "byte" in the name (like "generateKeystreamByte")
              const lowerName = name.toLowerCase();
              const explicitlyReturnsByte = lowerName.startsWith('get') && lowerName.includes('byte') ||
                                            lowerName.startsWith('read') && lowerName.includes('byte') ||
                                            lowerName === 'nextbyte';
              // Check if method returns a config/variant object - these should stay as dynamic
              // Pattern: methods named _getVariantConfig, getConfig, _getConfig, etc.
              const returnsConfigObject = lowerName.includes('config') || lowerName.includes('variant') ||
                                          lowerName.includes('options') || lowerName.includes('settings');
              if (returnsConfigObject) {
                refinedType = CSharpType.Dynamic();
              } else if (!explicitlyReturnsByte) {
                refinedType = CSharpType.UInt();
              }
            }
            this.popScope();

            if (refinedType && refinedType.name !== currentType.name) {
              // Update the registered signature with the refined type
              this.registerMethodSignature(this.currentClass.name, pascalName, sig.params, refinedType);
            }
          }
        }
      }
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
        // FALLBACK: Try to find method in any registered class
        for (const [key, sig] of this.methodSignatures) {
          if (key.endsWith('.' + methodName)) {
            return this.applySignatureCasts(sig, transformedArgs, originalArgs, methodName);
          }
        }
        return transformedArgs; // No signature lookup possible
      }

      const signature = this.getMethodSignature(className, methodName);

      if (!signature || !signature.params || signature.params.length === 0) {
        return transformedArgs; // No signature registered
      }

      return this.applySignatureCasts(signature, transformedArgs, originalArgs, methodName);
    }

    /**
     * Apply type casts based on method signature
     * @param {Object} signature - Method signature with params array
     * @param {Array} transformedArgs - Already transformed argument expressions
     * @param {Array} originalArgs - Original AST argument nodes
     * @param {string} methodName - For debugging
     * @returns {Array} Arguments with casts applied
     */
    applySignatureCasts(signature, transformedArgs, originalArgs, methodName) {
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

          // Look for: varName = (uint32)(...) or varName = (uint64)(...)
          // In IL AST, OpCodes.ToUint32 becomes Cast node with targetType 'uint32'
          // These indicate the variable should be unsigned type
          if (left.type === 'Identifier' && varDecls.has(left.name) && right.type === 'Cast') {
            const targetType = right.targetType;
            if (targetType === 'uint32' || targetType === 'uint') {
              varTypeHints.set(left.name, CSharpType.UInt());
            } else if (targetType === 'uint64' || targetType === 'ulong') {
              varTypeHints.set(left.name, CSharpType.ULong());
            } else if (targetType === 'uint16' || targetType === 'ushort') {
              varTypeHints.set(left.name, CSharpType.UShort());
            } else if (targetType === 'uint8' || targetType === 'byte') {
              varTypeHints.set(left.name, CSharpType.Byte());
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
     * Pre-scan method body to detect 2D (jagged) array patterns.
     * Detects patterns like: varName[i] = new Array(...) or varName[i] = [...]
     * or varName[i][j] = ... (double subscript access)
     * @param {Object} bodyNode - Method body AST node
     * @returns {Set<string>} - Set of variable names that are 2D arrays
     */
    preScan2DArrayVars(bodyNode) {
      const jaggedVars = new Set();
      if (!bodyNode) return jaggedVars;

      const scanNode = (node) => {
        if (!node || typeof node !== 'object') return;

        // Pattern 1: varName[i] = new Array(...) or varName[i] = [...] or varName[i] = new Type[...]
        if (node.type === 'AssignmentExpression' && node.operator === '=') {
          const left = node.left;
          const right = node.right;
          // Check if left is array subscript: varName[i]
          if (left?.type === 'MemberExpression' && left.computed) {
            const arrayObj = left.object;
            // Get variable name (support Identifier and local var patterns)
            let varName = null;
            if (arrayObj?.type === 'Identifier') {
              varName = arrayObj.name;
            }
            // Check if right side is array creation
            if (varName && (
              right?.type === 'ArrayCreation' ||
              right?.type === 'ArrayExpression' ||
              right?.type === 'ArrayLiteral' ||
              (right?.type === 'NewExpression' && right.callee?.name === 'Array') ||
              (right?.type === 'CallExpression' && right.callee?.property?.name === 'fill')
            )) {
              jaggedVars.add(varName);
            }
          }
        }

        // Pattern 2: varName[i][j] - double subscript access
        if (node.type === 'MemberExpression' && node.computed) {
          const inner = node.object;
          if (inner?.type === 'MemberExpression' && inner.computed) {
            const arrayObj = inner.object;
            if (arrayObj?.type === 'Identifier') {
              jaggedVars.add(arrayObj.name);
            }
          }
        }

        // Recurse into all child nodes
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              child.forEach(scanNode);
            } else if (child.type) {
              scanNode(child);
            }
          }
        }
      };

      scanNode(bodyNode);
      return jaggedVars;
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

        case 'ThisPropertyAccess':
          // IL AST node for this.property - look up registered field type first
          const propName = node.property?.name || node.property;
          if (propName) {
            const pascalName = this.toPascalCase(propName);
            const fieldType = this.classFieldTypes.get(pascalName);
            if (fieldType) {
              return fieldType;
            }
            // Fall back to name-based inference
            return this.inferTypeFromName(propName);
          }
          return CSharpType.Object();

        case 'ThisMethodCall':
          // IL AST node for this.method() - look up registered method signature
          if (this.currentClass && node.method) {
            const pascalMethod = this.toPascalCase(node.method);
            const sig = this.getMethodSignature(this.currentClass.name, pascalMethod);
            if (sig?.returnType) {
              return sig.returnType;
            }
          }
          return CSharpType.Object();

        case 'SpreadElement':
          // For spread elements, get the element type of the underlying array
          const spreadArrayType = this.inferFullExpressionType(node.argument);
          if (spreadArrayType?.isArray) {
            return spreadArrayType.elementType || CSharpType.Byte();
          }
          return CSharpType.Byte();  // Default to byte for crypto context

        // IL AST node types that need type inference
        case 'PackBytes':
          // Pack operations return uint (32-bit) or ulong (64-bit)
          // OpCodes.Pack32LE returns uint, Pack64LE returns ulong
          return node.bits === 64 ? CSharpType.ULong() : CSharpType.UInt();

        case 'UnpackBytes':
          // Unpack operations return byte[]
          return CSharpType.Array(CSharpType.Byte());

        case 'Cast':
          // Cast returns the target type
          if (node.targetType === 'uint32' || node.targetType === 'uint') return CSharpType.UInt();
          if (node.targetType === 'uint64' || node.targetType === 'ulong') return CSharpType.ULong();
          if (node.targetType === 'int32' || node.targetType === 'int') return CSharpType.Int();
          if (node.targetType === 'int64' || node.targetType === 'long') return CSharpType.Long();
          if (node.targetType === 'uint8' || node.targetType === 'byte') return CSharpType.Byte();
          if (node.targetType === 'uint16' || node.targetType === 'ushort') return CSharpType.UShort();
          return CSharpType.Object();

        case 'RotateLeft':
        case 'RotateRight':
          // BitOperations.RotateLeft/Right returns the unsigned cast type
          // (see transformRotation which casts to uint/ulong based on bits)
          const rotBits = node.bits || 32;
          if (rotBits === 64) return CSharpType.ULong();
          if (rotBits === 16) return CSharpType.UShort();
          if (rotBits === 8) return CSharpType.Byte();
          return CSharpType.UInt(); // Default for 32-bit

        case 'XorN':
          // XOR returns the wider of the operand types
          const xorLeftType = this.inferFullExpressionType(node.arguments?.[0]);
          const xorRightType = this.inferFullExpressionType(node.arguments?.[1]);
          return this.getWiderType(xorLeftType, xorRightType);

        case 'OpCodesCall':
          // Infer return type based on OpCodes method
          switch (node.method) {
            case 'CopyArray':
            case 'XorArrays':
            case 'FillArray':
              // These return the same type as their first argument
              if (node.arguments?.[0]) {
                const argType = this.inferFullExpressionType(node.arguments[0]);
                if (argType?.isArray) return argType;
                // If argument is an identifier, look up its type
                if (node.arguments[0].type === 'Identifier') {
                  const varType = this.getVariableType(node.arguments[0].name);
                  if (varType?.isArray) return varType;
                }
              }
              return CSharpType.Array(CSharpType.Byte());
            case 'ClearArray':
              return CSharpType.Void();
            case 'Pack32LE':
            case 'Pack32BE':
              return CSharpType.UInt();
            case 'Pack64LE':
            case 'Pack64BE':
              return CSharpType.ULong();
            case 'Unpack32LE':
            case 'Unpack32BE':
            case 'Unpack64LE':
            case 'Unpack64BE':
              return CSharpType.Array(CSharpType.Byte());
            case 'Hex32ToDWords':
              return CSharpType.Array(CSharpType.UInt());
            case 'ToDWord':
              return CSharpType.UInt();
            case 'ToUint32':
              return CSharpType.UInt();
            case 'ToUint64':
              return CSharpType.ULong();
            case 'ToInt32':
              return CSharpType.Int();
            case 'Hex8ToBytes':
            case 'AnsiToBytes':
            case 'AsciiToBytes':
              return CSharpType.Array(CSharpType.Byte());
            default:
              return CSharpType.Object();
          }

        case 'ArrayLength':
          // Length property returns int
          return CSharpType.Int();

        case 'ArrayFill':
          // ArrayFill returns an array - element type from node.elementType, node.value, or default to byte
          if (node.elementType) {
            const elemType = this.mapType(node.elementType);
            return CSharpType.Array(elemType);
          }
          if (node.value) {
            const valueType = this.inferFullExpressionType(node.value);
            if (valueType && valueType.name !== 'object') {
              return CSharpType.Array(valueType);
            }
          }
          // Default to byte[] for crypto context
          return CSharpType.Array(CSharpType.Byte());

        case 'ArraySlice':
        case 'ArrayConcat':
        case 'TypedArraySubarray':
          // These return an array of the same element type
          if (node.array) {
            const arrType = this.inferFullExpressionType(node.array);
            if (arrType?.isArray) return arrType;
          }
          return CSharpType.Array(CSharpType.Byte());

        case 'ArrayCreation':
        case 'TypedArrayCreation':
          // Array creation - use element type if available
          if (node.elementType) {
            const elemType = this.mapType(node.elementType);
            return CSharpType.Array(elemType);
          }
          // For crypto code, generic Array defaults to uint (32-bit values)
          // TypedArrayCreation would have a specific arrayType if not generic
          return CSharpType.Array(CSharpType.UInt());

        // Array methods that return bool
        case 'ArrayIncludes':
        case 'ArrayEvery':
        case 'ArraySome':
          return CSharpType.Bool();

        // Array methods that return int
        case 'ArrayIndexOf':
        case 'ArrayFindIndex':
          return CSharpType.Int();

        // String methods that return bool
        case 'StringIncludes':
        case 'StringStartsWith':
        case 'StringEndsWith':
          return CSharpType.Bool();

        // String split returns string[]
        case 'StringSplit':
          return CSharpType.Array(CSharpType.String());

        // String methods that return string
        case 'StringToLowerCase':
        case 'StringToUpperCase':
        case 'StringTrim':
        case 'StringConcat':
        case 'StringCharAt':
        case 'StringSubstring':
        case 'StringRepeat':
        case 'StringReplace':
          return CSharpType.String();

        // String methods that return int
        case 'StringIndexOf':
          return CSharpType.Int();

        // Map operations
        case 'MapHas':
          return CSharpType.Bool();
        case 'MapGet':
          return CSharpType.Object();
        case 'MapCreation':
        case 'MapSet':
        case 'MapDelete':
          return CSharpType.Object();

        // Set creation
        case 'SetCreation':
          return CSharpType.Object();

        // Object utility operations
        case 'ObjectKeys':
        case 'ObjectValues':
        case 'ObjectEntries':
          return CSharpType.Object();
        case 'ObjectCreate':
          return CSharpType.Object();

        // Number checks return bool
        case 'IsFiniteCheck':
        case 'IsNaNCheck':
        case 'IsIntegerCheck':
          return CSharpType.Bool();

        // Random returns double
        case 'Random':
          return CSharpType.Double();

        // CopyArray returns same array type
        case 'CopyArray':
          if (node.array) {
            const arrType = this.inferFullExpressionType(node.array);
            if (arrType?.isArray) return arrType;
          }
          return CSharpType.Array(CSharpType.Byte());

        // DebugOutput returns void (no meaningful type)
        case 'DebugOutput':
          return CSharpType.Object();

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
          // Match C# literal type rules:
          // - In C#, undecorated integer literals are int if they fit in int range
          // - Literals exceeding int but fitting in uint are still int (requires suffix 'u')
          // - Literals exceeding uint use long
          const INT_MIN = -2147483648;
          const INT_MAX = 2147483647;
          const UINT_MAX = 4294967295;

          // C# treats undecorated literals as int if they fit in int range
          if (node.value >= INT_MIN && node.value <= INT_MAX) {
            return CSharpType.Int();
          }
          // Values that exceed int but fit in uint - C# still treats as long unless 'u' suffix
          // However, for our purposes (type checking), we'll treat as uint since that's what we emit
          if (node.value > INT_MAX && node.value <= UINT_MAX) {
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

        // String.fromCharCode returns string
        if (obj.type === 'Identifier' && obj.name === 'String' && method === 'fromCharCode') {
          return CSharpType.String();
        }

        // String.fromCharCode.apply(null, array) returns string
        if (method === 'apply' && obj.type === 'MemberExpression') {
          const innerObj = obj.object;
          const innerMethod = obj.property?.name || obj.property?.value;
          if (innerObj?.type === 'Identifier' && innerObj.name === 'String' && innerMethod === 'fromCharCode') {
            return CSharpType.String();
          }
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

        // Object.freeze(x) returns the same type as x
        if (obj.type === 'Identifier' && obj.name === 'Object') {
          if (method === 'freeze' && node.arguments && node.arguments.length > 0) {
            return this.inferFullExpressionType(node.arguments[0]);
          }
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
          // Array includes/Contains returns bool
          if (method === 'includes' || method === 'Contains') {
            return CSharpType.Bool();
          }
        }

        // String methods return string
        if (objType?.name === 'string') {
          const stringReturningMethods = [
            'substring', 'Substring', 'slice', 'Slice',
            'substr', 'Substr', 'toLowerCase', 'ToLower',
            'toUpperCase', 'ToUpper', 'trim', 'Trim',
            'trimStart', 'TrimStart', 'trimEnd', 'TrimEnd',
            'padStart', 'PadStart', 'padEnd', 'PadEnd',
            'replace', 'Replace', 'repeat',
            'concat', 'Concat', 'normalize', 'Normalize'
          ];
          if (stringReturningMethods.includes(method)) {
            return CSharpType.String();
          }
          // split returns string[]
          if (method === 'split' || method === 'Split') {
            return CSharpType.Array(CSharpType.String());
          }
          // charCodeAt and codePointAt return int
          if (method === 'charCodeAt' || method === 'codePointAt') {
            return CSharpType.Int();
          }
          // indexOf, lastIndexOf return int
          if (method === 'indexOf' || method === 'lastIndexOf' ||
              method === 'IndexOf' || method === 'LastIndexOf') {
            return CSharpType.Int();
          }
          // String includes/Contains, startsWith/StartsWith, endsWith/EndsWith return bool
          if (method === 'includes' || method === 'Contains' ||
              method === 'startsWith' || method === 'StartsWith' ||
              method === 'endsWith' || method === 'EndsWith') {
            return CSharpType.Bool();
          }
        }

        // .toString() / .ToString() returns string
        if (method === 'toString' || method === 'ToString') {
          return CSharpType.String();
        }

        // Check for this.methodName() - look up registered method signature
        if (obj.type === 'ThisExpression' && this.currentClass) {
          const pascalMethod = this.toPascalCase(method);
          const sig = this.getMethodSignature(this.currentClass.name, pascalMethod);
          if (sig?.returnType) {
            return sig.returnType;
          }
        }
      }

      return CSharpType.Object();
    }

    /**
     * Infer type from member access
     */
    inferMemberExpressionType(node) {
      const propName = node.property?.name || node.property?.value;

      // Handle computed access (like arr[0]) - propName might be a number or non-string
      if (propName === undefined || propName === null || typeof propName !== 'string') {
        // For computed array access, try to infer element type
        if (node.computed) {
          const objType = this.inferFullExpressionType(node.object);
          if (objType?.isArray) {
            return objType.elementType || CSharpType.Object();
          }
        }
        return CSharpType.Object();
      }

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
      // Compare with Pascal-cased propName since tuple elements use PascalCase
      if (objType?.isTuple && objType.tupleElements) {
        const pascalPropName = this.toPascalCase(propName);
        const element = objType.tupleElements.find(e => e.name === pascalPropName || e.name === propName);
        if (element) {
          return element.type;
        }
      }

      // Array indexed access
      if (objType?.isArray && node.computed) {
        return objType.elementType || CSharpType.Object();
      }

      // String indexed access returns char
      if (objType?.name === 'string' && node.computed) {
        return CSharpType.Char();
      }

      // Check for known variable property types
      if (node.object.type === 'Identifier') {
        const varType = this.getVariableType(node.object.name);
        if (varType?.isArray && node.computed) {
          // array[index] returns element type
          return varType.elementType || CSharpType.Object();
        }
        if (varType?.isTuple && varType.tupleElements) {
          const pascalPropName = this.toPascalCase(propName);
          const element = varType.tupleElements.find(e => e.name === pascalPropName || e.name === propName);
          if (element) {
            return element.type;
          }
        }
      }

      // Heuristic for crypto tuple-like member access patterns
      // Properties like .left, .right, .Left, .Right on result objects from encrypt/decrypt
      // are typically uint values in cryptographic contexts
      const lowerProp = propName.toLowerCase();
      if (lowerProp === 'left' || lowerProp === 'right') {
        // Check if the object comes from a method call containing encrypt/decrypt
        if (node.object.type === 'Identifier') {
          const objName = node.object.name.toLowerCase();
          if (objName.includes('encrypt') || objName.includes('decrypt') ||
              objName.includes('result') || objName.includes('pair')) {
            return CSharpType.UInt();
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
        let widestType = null;
        let hasSpread = false;

        // Examine ALL elements to find the widest type needed
        for (const elem of node.elements) {
          if (!elem) continue;

          // Handle SpreadElement: [...arr] means we return type of arr
          if (elem.type === 'SpreadElement') {
            hasSpread = true;
            const spreadArrayType = this.inferFullExpressionType(elem.argument);
            if (spreadArrayType?.isArray) {
              // The array contains elements of the spread array's element type
              const elemType = spreadArrayType.elementType || CSharpType.Byte();
              widestType = widestType ? this.getWiderType(widestType, elemType) : elemType;
            }
            continue;
          }

          // Regular element: infer type and combine with widest
          const elemType = this.inferFullExpressionType(elem);
          widestType = widestType ? this.getWiderType(widestType, elemType) : elemType;
        }

        if (widestType) {
          // Special case: if we have int and uint mixed in an array of hex literals,
          // prefer uint[] for crypto code (these are typically 32-bit unsigned constants)
          if (widestType.name === 'long' && !hasSpread) {
            // Check if all elements are 32-bit range - if so, use uint instead of long
            const all32Bit = node.elements.every(elem => {
              if (!elem || elem.type === 'SpreadElement') return true;
              if (elem.type === 'Literal' && typeof elem.value === 'number') {
                return elem.value >= 0 && elem.value <= 0xFFFFFFFF;
              }
              return true; // Non-literals we assume are fine
            });
            if (all32Bit) {
              widestType = CSharpType.UInt();
            }
          }

          // Special case for crypto code: prefer uint[] over int[] when all values are non-negative
          // This handles round constants, S-boxes, and other unsigned crypto constants
          // that are commonly passed to functions expecting uint parameters
          if (widestType.name === 'int' && !hasSpread) {
            const allNonNegative = node.elements.every(elem => {
              if (!elem || elem.type === 'SpreadElement') return true;
              if (elem.type === 'Literal' && typeof elem.value === 'number') {
                return elem.value >= 0;
              }
              if (elem.type === 'UnaryExpression' && elem.operator === '-') {
                return false; // Negative literal
              }
              return true; // Non-literals we assume are fine
            });
            if (allNonNegative) {
              widestType = CSharpType.UInt();
            }
          }

          return CSharpType.Array(widestType);
        }
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

      // Logical AND returns bool
      if (op === '&&') {
        return CSharpType.Bool();
      }

      // JavaScript || can be logical OR (returns bool) or null-coalescing (returns operand type)
      // In the transformer, || on reference types becomes ?? in C#
      // We need to check operand types to determine the result type
      if (op === '||') {
        const leftType = this.inferFullExpressionType(node.left);
        const rightType = this.inferFullExpressionType(node.right);
        // If either operand is bool, it's a logical operation returning bool
        if (leftType?.name === 'bool' || rightType?.name === 'bool') {
          return CSharpType.Bool();
        }
        // For reference types, || becomes ?? and returns the operand type
        return this.getWiderType(leftType, rightType);
      }

      // Null-coalescing operator returns the type of its operands
      if (op === '??') {
        const leftType = this.inferFullExpressionType(node.left);
        const rightType = this.inferFullExpressionType(node.right);
        return this.getWiderType(leftType, rightType);
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
      const isArithmeticOp = ['+', '-', '*', '/', '%'].includes(op);

      // C# numeric promotion: small integer types (byte, sbyte, short, ushort)
      // are ALWAYS promoted to int before arithmetic and bitwise operations.
      // The result is int unless one operand is uint/long/ulong.
      const smallTypes = ['byte', 'sbyte', 'short', 'ushort'];
      const leftIsSmall = smallTypes.includes(leftType?.name);
      const rightIsSmall = smallTypes.includes(rightType?.name);

      if (isBitwiseOp || isArithmeticOp) {
        // If either operand is larger than int, use wider type
        const largerTypes = ['uint', 'long', 'ulong', 'int'];
        if (!leftIsSmall || !rightIsSmall) {
          // At least one operand is int or larger
          return this.getWiderType(leftType, rightType);
        }
        // Both operands are small types - C# promotes to int
        return CSharpType.Int();
      }

      if (isShiftOp) {
        // Shift ops: result type is the left operand's type (promoted to at least int)
        if (leftIsSmall) {
          return CSharpType.Int();
        }
        return leftType || CSharpType.Int();
      }

      // String concatenation: string + anything = string
      if (op === '+') {
        if (leftType?.name === 'string' || rightType?.name === 'string') {
          return CSharpType.String();
        }
      }

      // For other operations, use the wider of the two operand types
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

      // AlgorithmFramework metadata properties
      if (lowerName === 'tests') {
        return CSharpType.Array(new CSharpType('TestCase'));
      }
      if (lowerName === 'documentation' || lowerName === 'references') {
        return CSharpType.Array(new CSharpType('LinkItem'));
      }
      if (lowerName === 'knownvulnerabilities') {
        return CSharpType.Array(new CSharpType('Vulnerability'));
      }
      if (lowerName === 'keysizes' || lowerName === 'blocksizes' || lowerName === 'noncesizes' || lowerName === 'ivsizes' ||
          lowerName === 'supportedkeysizes' || lowerName === 'supportedblocksizes' || lowerName === 'supportednoncesizes' || lowerName === 'supportedivsizes') {
        return CSharpType.Array(new CSharpType('KeySize'));
      }
      if (lowerName === 'notes') {
        return CSharpType.Array(CSharpType.String());
      }
      if (lowerName === 'year' || lowerName === 'checksumsize') {
        return CSharpType.Int();
      }

      // Names ending with "Size" are integers (e.g., OutputSize, BlockSize, KeySize)
      // Check BEFORE array names because 'outputsize' contains 'output'
      if (lowerName.endsWith('size')) {
        return CSharpType.Int();
      }

      // Array-related names (check before single byte to handle 'bytes' vs 'byte')
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('counter') ||
          lowerName.includes('state') || lowerName.includes('nonce') ||
          lowerName.includes('iv') || lowerName.includes('tag') ||
          lowerName.includes('digits') || lowerName.includes('result')) {
        return CSharpType.Array(CSharpType.Byte());
      }

      // Cryptographic S-box and P-box arrays (common in block ciphers)
      // These are typically 32-bit lookup tables (Blowfish, DES, AES, etc.)
      // Patterns like: sbox, sbox1, sBox, SBOX_INIT, pbox, pBox, etc.
      if (/^[sp]box/i.test(lowerName) || /_init$/i.test(name)) {
        return CSharpType.Array(CSharpType.UInt());
      }

      // Single-letter 's' or 'S' in crypto context (RC4 state) is a byte array
      if (lowerName === 's') {
        return CSharpType.Array(CSharpType.Byte());
      }

      // Byte-related names (single byte, not arrays)
      if ((lowerName.includes('byte') && !lowerName.includes('bytes')) ||
          lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return CSharpType.Byte();
      }

      // Integer-related names
      if (lowerName.includes('shift') || lowerName.includes('position') ||
          lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return CSharpType.Int();
      }

      // Cryptographic byte arrays that end in 'text' (check BEFORE generic 'text' string rule)
      // ciphertext, plaintext, etc. are always byte arrays in crypto context
      if (lowerName === 'ciphertext' || lowerName === 'plaintext' ||
          lowerName.endsWith('ciphertext') || lowerName.endsWith('plaintext')) {
        return CSharpType.Array(CSharpType.Byte());
      }

      // String-related names
      // Note: 's' alone is NOT string - in crypto context it's typically S-box (byte array)
      if (lowerName.includes('name') || lowerName.includes('text') ||
          lowerName.includes('message') || lowerName.includes('description') ||
          lowerName.includes('label') || lowerName.includes('title') ||
          lowerName === 'str') {
        return CSharpType.String();
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

      // Create namespace - use same namespace as framework stubs for type visibility
      unit.namespace = new CSharpNamespace(this.options.namespace || 'CipherValidation');

      // Create main class with customizable name (ensure valid C# identifier)
      const mainClassName = this.sanitizeIdentifier(this.options.className || 'GeneratedClass');
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

        case 'ReturnStatement':
          // Module-level return statements (from UMD pattern) should be skipped
          // In C#, there's no module-level return, and the return value is typically
          // an export object that we've already handled
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
                 decl.init.type === 'OpCodesCall' ||
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
            // Check if this is an Algorithm class vs Instance class
            const pascalName = this.toPascalCase(propName);
            const isAlgorithmClass = /Algorithm$|Compression$|Cipher$|Hash$|Checksum$|Encoding$|Random$/.test(pascalName) ||
              (propValue.body?.body?.some(stmt =>
                this.isThisPropertyAssignment(stmt) &&
                stmt.expression?.left?.property?.name?.toLowerCase() === 'name'));

            // Track algorithm class for use when creating instance classes
            // Don't restore it - let it persist for sibling instance classes
            if (isAlgorithmClass) {
              this.parentAlgorithmClass = pascalName;
            }

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
          let paramType = null;

          const jsDocType = this.getParamType(typeInfo, param.name);
          if (jsDocType) {
            paramType = this.mapType(jsDocType);
          }

          // Framework-specific constructor parameter inference
          if (!paramType) {
            const lowerName = originalParamName.toLowerCase();
            if (lowerName === 'algorithm' || lowerName === 'algo') {
              // Use the tracked algorithm class name if available (e.g., LZ77Compression instead of Algorithm)
              // This allows accessing specific algorithm properties in the constructor
              const algorithmClassName = this.parentAlgorithmClass || prevClass?.name || 'Algorithm';
              paramType = new CSharpType(algorithmClassName);
            } else if (lowerName === 'isinverse' || lowerName === 'inverse') {
              paramType = CSharpType.Bool();
            } else if (lowerName === 'config' || lowerName === 'configuration') {
              paramType = CSharpType.Dynamic(); // Use dynamic for late-bound property access
            } else if (lowerName === 'variant' || lowerName === 'mode') {
              paramType = CSharpType.String();
            } else {
              paramType = CSharpType.Object();
            }
          }

          // Register parameter type for use in body transformations
          // Use the camelCased name since that's what C# will use
          this.registerVariableType(paramName, paramType);

          // If the name changed due to camelCase, add mapping so identifier references get transformed
          if (originalParamName !== paramName) {
            this.variableNameMap.set(originalParamName, paramName);
          }

          paramInfos.push({ paramName, paramType, isNullable: paramType.isArray || paramType.name === 'object' || paramType.name === 'dynamic' || paramType.name === 'string' });
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
      // Use TWO-PASS approach for methods:
      // Pass 1: Collect method signatures and register them (so cross-method calls can use type info)
      // Pass 2: Transform method bodies with all signatures available

      const ctorBody = new CSharpBlock();
      const fields = [];
      const methods = [];
      const methodStmts = []; // Store method statements for Pass 2

      const methodNodes = []; // Collect method info for refinement

      if (funcNode.body && funcNode.body.type === 'BlockStatement') {
        // Pass 1: Identify methods and pre-register their signatures
        for (const stmt of funcNode.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            const expr = stmt.expression;
            const value = expr.right;
            if (value.type === 'FunctionExpression' || value.type === 'ArrowFunctionExpression') {
              // This is a method - pre-register its signature
              const propName = expr.left.property.name || expr.left.property.value;
              this.preRegisterMethodSignature(propName, value, typeInfo);
              methodStmts.push(stmt);
              methodNodes.push({ name: propName, funcNode: value });
            } else {
              // This is a field - process immediately
              const result = this.processThisAssignment(stmt, typeInfo);
              // Skip if flagged (e.g., null assignments to non-nullable enum properties)
              if (result.skip) continue;
              if (result.member) {
                fields.push(result.member);
              }
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

        // Pass 1.5: Refine return types now that all methods are registered
        // This handles cases where method A calls method B, but B is defined after A
        this.refineMethodReturnTypes(methodNodes);

        // Pass 2: Transform method bodies (all signatures now registered)
        for (const stmt of methodStmts) {
          const result = this.processThisAssignment(stmt, typeInfo);
          if (result.isMethod) {
            methods.push(result.member);
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

      // Skip null assignments to non-nullable enum properties like SecurityStatus
      const lowerPropName = propName.toLowerCase();
      if (value?.type === 'Literal' && value.value === null && lowerPropName === 'securitystatus') {
        return { isMethod: false, member: null, initStatement: null, skip: true };
      }

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
        case 'ArrayLiteral':  // IL AST alias
          // Try to infer element type from first element using full expression type inference
          // This handles NewExpression, CallExpression, etc. correctly
          if (valueNode.elements && valueNode.elements.length > 0) {
            const firstElem = valueNode.elements.find(e => e != null);
            if (firstElem) {
              const elemType = this.inferFullExpressionType(firstElem);
              if (elemType) {
                // For object arrays, use dynamic[] to allow property access on elements
                if (elemType.name === 'object') {
                  return CSharpType.Array(CSharpType.Dynamic());
                }
                return CSharpType.Array(elemType);
              }
            }
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

        // Check for x.length pattern (JS AST)
        if (node.type === 'MemberExpression' &&
            node.object.type === 'Identifier' &&
            node.property.type === 'Identifier' &&
            node.property.name === 'length') {
          arrayParams.add(node.object.name);
        }

        // Check for x[i] indexing pattern (JS AST)
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

        // IL AST patterns - ArrayLength node
        if (node.type === 'ArrayLength' && node.array?.type === 'Identifier') {
          arrayParams.add(node.array.name);
        }

        // IL AST patterns - ArraySlice, ArrayConcat, ArrayAppend, etc.
        const ilArrayOps = ['ArraySlice', 'ArrayConcat', 'ArrayAppend', 'ArrayClear',
                           'ArrayFill', 'ArrayXor', 'ArrayReverse', 'ArrayIndexOf',
                           'ArrayMap', 'ArrayFilter', 'ArrayReduce', 'ArrayForEach',
                           'ArrayFind', 'ArrayFindIndex', 'ArrayEvery', 'ArraySome',
                           'ArraySort', 'ArrayPop', 'ArrayShift', 'ArrayIncludes',
                           'ArrayJoin', 'TypedArraySet', 'TypedArraySubarray'];
        if (ilArrayOps.includes(node.type) && node.array?.type === 'Identifier') {
          arrayParams.add(node.array.name);
        }

        // IL AST patterns - OpCodesCall with array operations (CopyArray, XorArrays, etc.)
        if (node.type === 'OpCodesCall') {
          const arrayMethods = ['CopyArray', 'XorArrays', 'ClearArray', 'FillArray'];
          if (arrayMethods.includes(node.method) && node.arguments?.[0]?.type === 'Identifier') {
            arrayParams.add(node.arguments[0].name);
          }
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
     * Detect parameters used as dictionary keys (strings) vs array indices (integers)
     * @param {Object} bodyNode - The function body AST node
     * @param {Set<string>} arrayUsageParams - Parameters known to be used as arrays
     * @returns {{stringKeys: Set<string>, arrayIndices: Set<string>}} Sets of parameter names
     */
    detectStringKeyParams(bodyNode, arrayUsageParams = new Set()) {
      const stringParams = new Set();
      const arrayIndexParams = new Set(); // Track params used as array indices

      // First pass: find objects that are used with string literal keys
      // If obj["string"] appears, then obj is a dictionary, not an array
      const objectsWithStringKeys = new Set();
      const findStringKeyObjects = (node) => {
        if (!node || typeof node !== 'object') return;
        // Check for obj["stringLiteral"] pattern
        if (node.type === 'MemberExpression' &&
            node.computed === true &&
            node.property?.type === 'Literal' &&
            typeof node.property.value === 'string') {
          const objName = node.object?.name || node.object?.object?.name;
          if (objName) {
            objectsWithStringKeys.add(objName);
          }
        }
        // Recurse
        for (const key in node) {
          if (key === 'type' || key === 'loc' || key === 'range') continue;
          const value = node[key];
          if (Array.isArray(value)) value.forEach(findStringKeyObjects);
          else if (value && typeof value === 'object') findStringKeyObjects(value);
        }
      };
      findStringKeyObjects(bodyNode);

      const visit = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check for obj[param] where obj is likely a dictionary (has {} initialization or is assigned from one)
        // More specifically, look for patterns like: dictionary[param] or configs[variant]
        // BUT: if obj is known to be an array (or has array-like names), then param is an integer index
        if (node.type === 'MemberExpression' &&
            node.computed === true &&
            node.property?.type === 'Identifier') {
          const objName = node.object?.name || node.object?.object?.name;
          const propName = node.property.name;

          // If the object is used with string literal keys elsewhere, it's a dictionary
          if (objectsWithStringKeys.has(objName)) {
            stringParams.add(propName);
          } else if (arrayUsageParams.has(objName)) {
            // If the object is a known array AND not used with string keys, this is array indexing
            arrayIndexParams.add(propName);
          } else {
            // Check if the object name suggests an array (state, buffer, block, etc.)
            // Use exact match for single-letter names, substring match for longer names
            const arrayLikePatterns = ['state', 'buffer', 'block', 'array', 'data', 'bytes', 'output', 'input',
                                       'key', 'iv', 'nonce', 'result', 'temp', 'workingstate', 'roundkeys',
                                       'subkeys', 'expandedkey', 'sbox', 'rcon', 'table'];
            const exactMatchArrayNames = ['w', 's', 'x', 'y', 'k', 'v', 't', 'a', 'b', 'm', 'n', 'p', 'q', 'r'];
            const lowerObjName = (objName || '').toLowerCase();
            const isArrayLike = arrayLikePatterns.some(pat => lowerObjName.includes(pat)) ||
                                exactMatchArrayNames.includes(lowerObjName);
            if (isArrayLike) {
              arrayIndexParams.add(propName);
            } else {
              stringParams.add(propName);
            }
          }
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
      // Remove array index params from string params (they're integer indices, not string keys)
      for (const param of arrayIndexParams) {
        stringParams.delete(param);
      }
      return { stringKeys: stringParams, arrayIndices: arrayIndexParams };
    }

    /**
     * Check if parameter is used as a scalar 32-bit value (not an array)
     * This detects params used directly in 32-bit operations without being indexed
     * @param {string} paramName - Parameter name to check
     * @param {object} bodyNode - Function body AST node
     * @returns {boolean} True if used as scalar in 32-bit operations
     */
    isUsedAsScalar32Bit(paramName, bodyNode) {
      let usedAsScalar = false;

      const visit = (node) => {
        if (!node || typeof node !== 'object' || usedAsScalar) return;

        // Check if param is used directly in OpCodesCall 32-bit operations
        if (node.type === 'OpCodesCall') {
          const methods32Bit = ['XorN', 'Shr32', 'Shl32', 'RotL32', 'RotR32', 'AndN', 'OrN', 'NotN',
                               'Xor32', 'And32', 'Or32', 'Not32', 'Add32', 'Sub32', 'Mul32'];
          if (methods32Bit.includes(node.method) && node.arguments) {
            for (const arg of node.arguments) {
              if (arg?.type === 'Identifier' && arg.name === paramName) {
                usedAsScalar = true;
                return;
              }
            }
          }
        }

        // Check if param is used in binary expressions that suggest scalar
        if (node.type === 'BinaryExpression') {
          const ops32 = ['>>>', '>>', '<<', '&', '|', '^', '+', '-', '*', '/', '%'];
          if (ops32.includes(node.operator)) {
            const checkIdent = (n) => n?.type === 'Identifier' && n.name === paramName;
            if (checkIdent(node.left) || checkIdent(node.right)) {
              usedAsScalar = true;
              return;
            }
          }
        }

        // Check IL AST nodes that use scalar values
        const scalarOps = ['RotateLeft', 'RotateRight', 'BitwiseXor', 'BitwiseAnd', 'BitwiseOr',
                          'BitwiseNot', 'ShiftLeft', 'ShiftRight', 'ZeroFillRightShift'];
        if (scalarOps.includes(node.type)) {
          const checkIdent = (n) => n?.type === 'Identifier' && n.name === paramName;
          if (checkIdent(node.value) || checkIdent(node.left) || checkIdent(node.right) ||
              (node.arguments && node.arguments.some(checkIdent))) {
            usedAsScalar = true;
            return;
          }
        }

        // Recurse (skip nested functions)
        for (const key in node) {
          if (key === 'type' || key === 'loc' || key === 'range') continue;
          const value = node[key];
          if (node.type === 'FunctionExpression' && key === 'body') continue;
          if (node.type === 'FunctionDeclaration' && key === 'body') continue;
          if (node.type === 'ArrowFunctionExpression' && key === 'body') continue;
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === 'object') visit(value);
        }
      };

      visit(bodyNode);
      return usedAsScalar;
    }

    /**
     * Detect array element type for a parameter based on how elements are used
     * @param {string} paramName - Parameter name to check
     * @param {object} bodyNode - Function body AST node
     * @returns {CSharpType} Element type (byte, uint, etc.)
     */
    detectArrayElementType(paramName, bodyNode) {
      // IMPORTANT: Analyze body usage patterns FIRST before name-based inference
      // This ensures that uint[] arrays used in 32-bit operations are correctly typed
      // even if their parameter name suggests byte[] (e.g., 'k' for keyWords)
      const lowerName = paramName.toLowerCase();

      // Track different types of usage separately - don't short-circuit
      // This allows us to detect conflicting usages and make informed decisions
      let detectedUint = false;  // param[i] used in 32-bit ops (>>>, &, ^, etc.)
      let detectedByte = false;  // param[i] passed to Pack32BE/LE

      const visit = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check for x[i] usage in binary operations that suggest 32-bit types
        // e.g., (v[i] >>> 5) or (v[p] + mx)
        if (node.type === 'BinaryExpression') {
          const checkOperand = (operand) => {
            if (!operand) return;
            // Check for array indexing
            if (operand.type === 'MemberExpression' &&
                operand.object?.type === 'Identifier' &&
                operand.object.name === paramName &&
                operand.computed) {
              // Element is used in binary operation - check operator
              const op = node.operator;
              // 32-bit operations: >>>, >>, <<, &, |, ^, +, -, *, /
              if (['>>>', '>>', '<<', '&', '|', '^', '+', '-', '*', '/', '%'].includes(op)) {
                detectedUint = true;
              }
            }
          };
          checkOperand(node.left);
          checkOperand(node.right);
        }

        // Check for OpCodes.CopyArray(v) followed by 32-bit operations on result
        // Also check if function return type inference indicates uint[]
        if (node.type === 'OpCodesCall' && node.method === 'CopyArray' &&
            node.arguments?.[0]?.type === 'Identifier' &&
            node.arguments[0].name === paramName) {
          // Check if parent context suggests uint type
          // For now, assume 32-bit words if used with CopyArray (common for block ciphers)
          detectedUint = true;
        }

        // Note: Pack functions (Pack32BE, Pack32LE, etc.) have overloads for byte, uint, and int
        // So presence of Pack calls does NOT indicate byte[] type - it works with uint[] too
        // This comment intentionally replaces the old byte-detection logic for Pack calls

        // IL AST PackBytes nodes are typically used with byte arrays, but since we have
        // Pack overloads, we don't use this to force byte[] type inference anymore
        // The name-based heuristics and other patterns will handle type detection

        // Check if param[index] is passed as argument to this.method() calls
        // For crypto code, elements passed to internal methods are typically uint values
        if (node.type === 'CallExpression' &&
            node.callee?.type === 'MemberExpression' &&
            node.callee.object?.type === 'ThisExpression' &&
            node.arguments) {
          for (const arg of node.arguments) {
            if (arg?.type === 'MemberExpression' &&
                arg.object?.type === 'Identifier' &&
                arg.object.name === paramName &&
                arg.computed) {
              // param[i] is passed to this.method() - assume uint for crypto
              detectedUint = true;
            }
          }
        }

        // Recursively visit children
        for (const key in node) {
          if (key === 'type' || key === 'loc' || key === 'range') continue;
          const value = node[key];
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

      // Decision logic for conflicting usages:
      // 1. If uint detected (from 32-bit ops), prefer uint[] - it's the more general type
      //    and can hold byte-range values. This is critical for consistency at call sites.
      // 2. If only byte detected (Pack calls), use byte[]
      // 3. If neither detected, fall through to name-based heuristics
      if (detectedUint) {
        return CSharpType.UInt();
      }
      if (detectedByte) {
        return CSharpType.Byte();
      }

      // Before defaulting to uint, check if parameter name suggests byte[] type
      // This handles cases where key[i] is assigned to intermediate variables
      // before being used in Pack functions (e.g., b0 = key[i]; Pack32BE(b0, ...))
      // NOTE: Single-letter names like 'k', 's' are NOT included here because
      // body analysis should have detected their actual usage (e.g., 32-bit ops = uint[])
      // NOTE: 'state' is NOT included here because crypto state arrays are often uint[]
      // (e.g., ChaCha, Keccak, etc.) and we want to prefer uint[] for consistency
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') || lowerName.includes('block') ||
          lowerName.includes('buffer') || lowerName.includes('bytes') || lowerName.includes('nonce') ||
          lowerName.includes('iv') || lowerName.includes('tag') || lowerName.includes('plaintext') ||
          lowerName.includes('ciphertext') || lowerName.includes('counter') || lowerName.includes('aad') ||
          lowerName.includes('salt') || lowerName.includes('hash') || lowerName.includes('digest') ||
          lowerName.includes('message') || lowerName.includes('seed') || lowerName.includes('secret') ||
          lowerName.includes('src') || lowerName.includes('dst') || lowerName.includes('temp')) {
        return CSharpType.Byte();
      }

      // Default to uint for crypto code - most arrays contain 32-bit words
      return CSharpType.UInt();
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

      // Determine return type
      // For override methods: MUST use inherited signature (C# requires exact match)
      // For non-overrides: prioritize JSDoc, then inference
      let returnType;
      if (inheritedSig?.returns) {
        // For override methods, MUST use inherited return type to maintain compatibility
        returnType = this.mapTypeFromKnowledge(inheritedSig.returns);
      } else {
        // No inherited signature - use JSDoc
        returnType = this.mapType(typeInfo?.returns);
      }

      // Push a new scope for the method body FIRST
      // This prevents variable types from leaking between functions
      this.pushScope();

      // Analyze body for array usage patterns before inferring parameter types
      const arrayUsageParams = funcNode.body ? this.detectArrayUsageParams(funcNode.body) : new Set();
      // Analyze body for string key vs array index usage patterns
      // Pass arrayUsageParams to distinguish between dictionary keys (strings) and array indices (integers)
      const { stringKeys: stringKeyParams, arrayIndices: arrayIndexParams } =
          funcNode.body ? this.detectStringKeyParams(funcNode.body, arrayUsageParams) : { stringKeys: new Set(), arrayIndices: new Set() };

      // FIRST: Register parameter types so they're available for local variable type inference
      const paramInfos = [];
      if (funcNode.params) {
        for (let i = 0; i < funcNode.params.length; i++) {
          const param = funcNode.params[i];
          // Handle AssignmentPattern (default value params like: data = null)
          const rawParamName = param.name || param.left?.name || 'param';
          const paramName = this.toCamelCase(rawParamName);
          const originalParamName = rawParamName;
          let paramType;

          // Priority: 1) JSDoc, 2) inherited signature, 3) array usage, 4) array index usage, 5) string key usage, 6) scalar 32-bit usage, 7) name inference
          const jsDocParamType = this.getParamType(typeInfo, rawParamName);
          if (jsDocParamType) {
            paramType = this.mapType(jsDocParamType);
          } else if (inheritedSig?.params && inheritedSig.params[i]) {
            // Use inherited parameter type from base class
            // params[i] is an object { name, type, defaultValue }
            const inheritedParam = inheritedSig.params[i];
            paramType = this.mapTypeFromKnowledge(typeof inheritedParam === 'string' ? inheritedParam : inheritedParam.type);
          } else if (arrayUsageParams.has(rawParamName)) {
            // Parameter is used like an array (.length, indexing, etc.)
            // Infer element type based on how array elements are used
            const elemType = this.detectArrayElementType(rawParamName, funcNode.body);
            paramType = CSharpType.Array(elemType);
          } else if (arrayIndexParams.has(rawParamName)) {
            // Parameter is used as an array index - should be int for C# array indexing
            paramType = CSharpType.Int();
          } else if (stringKeyParams.has(rawParamName)) {
            // Parameter is used as a dictionary/object key - should be string
            paramType = CSharpType.String();
          } else if (param.right && param.right.type === 'Literal') {
            // Parameter has a literal default value - infer type from default
            if (typeof param.right.value === 'boolean') {
              paramType = CSharpType.Bool();
            } else if (typeof param.right.value === 'string') {
              paramType = CSharpType.String();
            } else if (typeof param.right.value === 'number') {
              // Default to int for numeric literals
              paramType = CSharpType.Int();
            } else {
              paramType = this.inferParameterType(paramName);
            }
          } else if (funcNode.body && this.isUsedAsScalar32Bit(rawParamName, funcNode.body)) {
            // Parameter is used directly in 32-bit operations (not as array) - scalar uint
            paramType = CSharpType.UInt();
          } else {
            paramType = this.inferParameterType(paramName);
          }

          // Register parameter type for use in body transformations and local variable inference
          // Use the camelCased name since that's what C# will use
          this.registerVariableType(paramName, paramType);

          // If the name changed due to camelCase, add mapping so identifier references get transformed
          if (originalParamName !== paramName) {
            this.variableNameMap.set(originalParamName, paramName);
          }

          // Get inherited default value if available
          const inheritedParam = inheritedSig?.params?.[i];
          const inheritedDefaultValue = typeof inheritedParam === 'object' ? inheritedParam.defaultValue : null;

          paramInfos.push({ paramName, paramType, originalParamName, isNullable: paramType.isArray || paramType.name === 'object' || paramType.name === 'string', inheritedDefaultValue });
        }
      }

      // NOW infer return type (after parameters are registered)
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

      // Use 'dynamic' instead of 'object' for method return types
      // This allows property access on return values from methods that return object literals
      // or dictionary lookups (common in JS-to-C# transpilation)
      if (returnType && returnType.name === 'object' && !returnType.isArray) {
        returnType = CSharpType.Dynamic();
      }

      // Check for tuple return
      if (typeInfo?.returns?.isTuple && typeInfo.returns.tupleElements) {
        returnType = this.createTupleType(typeInfo.returns.tupleElements);
      }

      const method = new CSharpMethod(pascalName, returnType);
      // If we have an inherited signature, this is an override method (instance, not static)
      if (inheritedSig) {
        method.isOverride = true;
        method.isStatic = false;
      } else {
        method.isStatic = true;
      }

      // Add parameters to method, using inherited default values or nullable defaults
      for (let i = 0; i < paramInfos.length; i++) {
        const { paramName, paramType, isNullable, inheritedDefaultValue } = paramInfos[i];
        const csParam = new CSharpParameter(paramName, paramType);

        // Use inherited default value from base class if available
        if (inheritedDefaultValue !== null && inheritedDefaultValue !== undefined) {
          // Convert the inherited default value to appropriate C# literal
          if (inheritedDefaultValue === 'false') {
            csParam.defaultValue = CSharpLiteral.Bool(false);
          } else if (inheritedDefaultValue === 'true') {
            csParam.defaultValue = CSharpLiteral.Bool(true);
          } else if (inheritedDefaultValue === 'null') {
            csParam.defaultValue = CSharpLiteral.Null();
          } else if (!isNaN(Number(inheritedDefaultValue))) {
            csParam.defaultValue = CSharpLiteral.Number(Number(inheritedDefaultValue));
          } else {
            csParam.defaultValue = CSharpLiteral.String(inheritedDefaultValue);
          }
        } else if (isNullable) {
          // Fall back to null default for nullable types if ALL remaining params are also nullable/have defaults
          const allRemainingHaveDefaults = paramInfos.slice(i + 1).every(p => p.isNullable || p.inheritedDefaultValue !== null);
          if (allRemainingHaveDefaults) {
            csParam.defaultValue = CSharpLiteral.Null();
          }
        }

        method.parameters.push(csParam);
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

      // Clear method-scoped variable tracking for collision detection
      const prevMethodDeclaredVars = this.methodDeclaredVars;
      this.methodDeclaredVars = new Set();
      const prevVariableNameMap = this.variableNameMap;
      // Copy existing mappings (includes parameter name mappings) into new scope
      this.variableNameMap = new Map(prevVariableNameMap);

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

      // Pre-scan for 2D array patterns to ensure correct jagged array type declarations
      // Detects patterns like: varName[i] = new Array(...) or varName[i][j] = ...
      const prevJaggedArrayVars = this.jaggedArrayVars;
      this.jaggedArrayVars = this.preScan2DArrayVars(bodyNode);

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
      this.methodDeclaredVars = prevMethodDeclaredVars;
      this.variableNameMap = prevVariableNameMap;
      this.jaggedArrayVars = prevJaggedArrayVars;

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
          // Special case: ArrayAppend (from IL transformation) also needs assignment
          if (node.expression?.type === 'ArrayAppend') {
            return this.transformArrayAppendToAssignment(node.expression);
          }
          // Special case: ArrayConcat (from push(...spread) or concat) also needs assignment
          if (node.expression?.type === 'ArrayConcat') {
            return this.transformArrayConcatToAssignment(node.expression);
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

        let name = this.toCamelCase(decl.id.name);
        const originalName = decl.id.name;

        // If the camelCase conversion changed the name (e.g., Nk -> nk),
        // add a mapping so identifier references get transformed correctly
        if (originalName !== name && !this.variableNameMap.has(originalName)) {
          this.variableNameMap.set(originalName, name);
        }

        // Handle variable name collisions - C# doesn't allow redeclaration even in nested scopes
        // JavaScript allows: for(...) { const temp = x; } const temp = y; // different scopes
        // C# doesn't: for-loop variable shadows outer scope, causing CS0136
        // When collision detected, rename and add to map so references get the new name
        if (this.methodDeclaredVars.has(name)) {
          let suffix = 2;
          while (this.methodDeclaredVars.has(`${name}${suffix}`)) {
            ++suffix;
          }
          const newName = `${name}${suffix}`;
          // Map original JS name to renamed C# name for this scope
          this.variableNameMap.set(originalName, newName);
          name = newName;
        }
        this.methodDeclaredVars.add(name);

        let type = CSharpType.Var();
        let initializer = null;

        if (decl.init) {
          // Check if we have a pre-analyzed type hint from backwards inference
          // (e.g., from assignments like `param = localVar`)
          const preAnalyzedType = this.getVariableType(originalName);

          // First, infer the type of the initializer
          let inferredType = this.inferFullExpressionType(decl.init);

          // For empty arrays, use name-based inference since inferFullExpressionType defaults to uint[]
          // Variables like 'output', 'result', 'data' should be byte[] in crypto context
          const isEmptyArray = (decl.init.type === 'ArrayExpression' || decl.init.type === 'ArrayLiteral') &&
                               (!decl.init.elements || decl.init.elements.length === 0);
          if (isEmptyArray) {
            const nameBasedType = this.inferTypeFromName(originalName);
            if (nameBasedType?.isArray) {
              inferredType = nameBasedType;
            }
          }

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
          // EXCEPT for tuples from method calls - use var to let C# infer exact tuple element types
          // This avoids type mismatches like (uint, int) vs (uint, uint)
          const isMethodCallTuple = ['CallExpression', 'MethodCall', 'ThisMethodCall', 'StaticMethodCall'].includes(decl.init.type)
            && inferredType?.isTuple;
          if (inferredType && inferredType.name !== 'object' && !isMethodCallTuple) {
            type = inferredType;
          }

          // Upgrade 1D array to jagged array if pre-scan detected 2D usage pattern
          // e.g., `const m = new Array(s); m[i] = new Array(s);` -> `byte[][] m`
          if (type?.isArray && !type.elementType?.isArray && this.jaggedArrayVars?.has(originalName)) {
            // Convert byte[] to byte[][] (jagged array)
            const baseElementType = type.elementType || CSharpType.Byte();
            const innerArrayType = CSharpType.Array(baseElementType);
            type = CSharpType.Array(innerArrayType);
            // Also need to update the initializer's elementType to emit `new byte[s][]` instead of `new byte[s]`
            if (initializer && initializer.nodeType === 'ArrayCreation') {
              initializer.elementType = innerArrayType;  // byte[] -> emits `new byte[size][]`
            }
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
        const emptyCall = new CSharpMethodCall(
          new CSharpIdentifier('Array'),
          'Empty',
          []
        );
        emptyCall.typeArguments = [type.elementType || CSharpType.Byte()];
        return emptyCall;
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
        case 'ArrayLiteral':  // IL AST alias for ArrayExpression
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

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - C# supports ?. operator
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield return value
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> C# private field with _ prefix convention
          return new CSharpIdentifier('_' + node.name);

        // ===== IL AST Node Types =====
        // These are normalized nodes from the IL AST

        case 'ParentConstructorCall':
          return this.transformParentConstructorCall(node);

        case 'ParentMethodCall':
          return this.transformParentMethodCall(node);

        case 'ThisMethodCall':
          return this.transformThisMethodCall(node);

        case 'ThisPropertyAccess':
          return this.transformThisPropertyAccess(node);

        case 'RotateLeft':
        case 'RotateRight':
          return this.transformRotation(node);

        case 'PackBytes':
          return this.transformPackBytes(node);

        case 'UnpackBytes':
          return this.transformUnpackBytes(node);

        case 'ArrayLength':
          return this.transformArrayLength(node);

        case 'ArrayAppend':
          return this.transformArrayAppend(node);

        case 'ArraySlice':
          return this.transformArraySlice(node);

        case 'ArrayFill':
          return this.transformArrayFill(node);

        case 'ArrayXor':
          return this.transformArrayXor(node);

        case 'ArrayClear':
          return this.transformArrayClear(node);

        case 'ArrayIndexOf':
          if (process.env.DEBUG_INDEXOF) {
            console.log('ArrayIndexOf IL node:', JSON.stringify(node, null, 2).slice(0, 300));
          }
          return this.transformArrayIndexOf(node);

        case 'ArrayIncludes':
          return this.transformArrayIncludes(node);

        case 'ArrayConcat':
          return this.transformArrayConcat(node);

        case 'ArrayJoin':
          return this.transformArrayJoin(node);

        case 'ArrayReverse':
          return this.transformArrayReverse(node);

        case 'ArrayReduce':
          return this.transformArrayReduce(node);

        case 'ArrayMap':
          return this.transformArrayMap(node);

        case 'ArrayFilter':
          return this.transformArrayFilter(node);

        case 'ArrayForEach':
          return this.transformArrayForEach(node);

        case 'ArrayFind':
          return this.transformArrayFind(node);

        case 'ArrayFindIndex':
          return this.transformArrayFindIndex(node);

        case 'ArrayEvery':
          return this.transformArrayEvery(node);

        case 'ArraySome':
          return this.transformArraySome(node);

        case 'ArraySort':
          return this.transformArraySort(node);

        case 'ArrayPop':
          return this.transformArrayPop(node);

        case 'ArrayShift':
          return this.transformArrayShift(node);

        case 'ArrayCreation':
          return this.transformArrayCreation(node);

        case 'TypedArrayCreation':
          return this.transformTypedArrayCreation(node);

        case 'ByteBufferView':
          return this.transformByteBufferView(node);

        case 'HexDecode':
          return this.transformHexDecode(node);

        case 'HexEncode':
          return this.transformHexEncode(node);

        case 'StringToBytes':
          return this.transformStringToBytes(node);

        case 'BytesToString':
          return this.transformBytesToString(node);

        // String operations
        case 'StringCharCodeAt':
          return this.transformStringCharCodeAt(node);

        case 'StringCharAt':
          return this.transformStringCharAt(node);

        case 'StringSubstring':
          return this.transformStringSubstring(node);

        case 'StringRepeat':
          return this.transformStringRepeat(node);

        case 'StringIncludes':
          return this.transformStringIncludes(node);

        case 'StringIndexOf':
          if (process.env.DEBUG_INDEXOF) {
            console.log('StringIndexOf IL node:', JSON.stringify(node, null, 2).slice(0, 300));
          }
          return this.transformStringIndexOf(node);

        case 'StringReplace':
          return this.transformStringReplace(node);

        case 'StringSplit':
          return this.transformStringSplit(node);

        case 'StringTransform':
          return this.transformStringTransform(node);

        // Array operations
        case 'ArrayUnshift':
          return this.transformArrayUnshift(node);

        // Data structures
        case 'MapCreation':
          return this.transformMapCreation(node);

        case 'DataViewCreation':
          return this.transformDataViewCreation(node);

        case 'BufferCreation':
          return this.transformBufferCreation(node);

        case 'Floor':
          return this.transformFloor(node);

        case 'Ceil':
          return this.transformCeil(node);

        case 'Abs':
          return this.transformAbs(node);

        case 'Min':
          return this.transformMin(node);

        case 'Max':
          return this.transformMax(node);

        case 'Pow':
        case 'Power':  // IL AST uses 'Power' from Math.pow
          return this.transformPow(node);

        case 'Round':
          return this.transformRound(node);

        case 'Trunc':
        case 'Truncate':  // IL AST uses 'Truncate' from Math.trunc
          return this.transformTrunc(node);

        case 'Sign':
          return this.transformSign(node);

        case 'Sin':  // IL AST node for Math.sin
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Sin',
            [this.transformExpression(node.argument)]
          );

        case 'Cos':  // IL AST node for Math.cos
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Cos',
            [this.transformExpression(node.argument)]
          );

        case 'Tan':  // IL AST node for Math.tan
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Tan',
            [this.transformExpression(node.argument)]
          );

        case 'Asin':  // IL AST node for Math.asin
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Asin',
            [this.transformExpression(node.argument)]
          );

        case 'Acos':  // IL AST node for Math.acos
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Acos',
            [this.transformExpression(node.argument)]
          );

        case 'Atan':  // IL AST node for Math.atan
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Atan',
            [this.transformExpression(node.argument)]
          );

        case 'Atan2':  // IL AST node for Math.atan2
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Atan2',
            [this.transformExpression(node.arguments[0]), this.transformExpression(node.arguments[1])]
          );

        case 'Sinh':  // IL AST node for Math.sinh
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Sinh',
            [this.transformExpression(node.argument)]
          );

        case 'Cosh':  // IL AST node for Math.cosh
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Cosh',
            [this.transformExpression(node.argument)]
          );

        case 'Tanh':  // IL AST node for Math.tanh
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Tanh',
            [this.transformExpression(node.argument)]
          );

        case 'Exp':  // IL AST node for Math.exp
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Exp',
            [this.transformExpression(node.argument)]
          );

        case 'Cbrt':  // IL AST node for Math.cbrt -> Math.Pow(arg, 1.0/3.0)
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Pow',
            [
              this.transformExpression(node.argument),
              new CSharpBinaryExpression(CSharpLiteral.Double(1.0), '/', CSharpLiteral.Double(3.0))
            ]
          );

        case 'Hypot':  // IL AST node for Math.hypot -> Math.Sqrt(a*a + b*b)
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Sqrt',
            [new CSharpBinaryExpression(
              new CSharpBinaryExpression(this.transformExpression(node.arguments[0]), '*', this.transformExpression(node.arguments[0])),
              '+',
              new CSharpBinaryExpression(this.transformExpression(node.arguments[1]), '*', this.transformExpression(node.arguments[1]))
            )]
          );

        case 'Fround':  // IL AST node for Math.fround -> (float)arg
          return new CSharpCast(new CSharpType('float'), this.transformExpression(node.argument));

        case 'MathConstant': {  // IL AST node for Math constants (PI, E, LN2, etc.)
          switch (node.name) {
            case 'PI':
              return new CSharpMemberAccess(new CSharpIdentifier('Math'), 'PI');
            case 'E':
              return new CSharpMemberAccess(new CSharpIdentifier('Math'), 'E');
            case 'LN2':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', [CSharpLiteral.Double(2)]);
            case 'LN10':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', [CSharpLiteral.Double(10)]);
            case 'LOG2E':
              return new CSharpBinaryExpression(
                CSharpLiteral.Double(1.0),
                '/',
                new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', [CSharpLiteral.Double(2)])
              );
            case 'LOG10E':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log10', [new CSharpMemberAccess(new CSharpIdentifier('Math'), 'E')]);
            case 'SQRT2':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sqrt', [CSharpLiteral.Double(2)]);
            case 'SQRT1_2':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sqrt', [CSharpLiteral.Double(0.5)]);
            default:
              return CSharpLiteral.Double(node.value);
          }
        }

        case 'NumberConstant': {  // IL AST node for Number constants (MAX_SAFE_INTEGER, Infinity, NaN, etc.)
          switch (node.name) {
            case 'MAX_SAFE_INTEGER':
              return new CSharpMemberAccess(new CSharpIdentifier('long'), 'MaxValue');
            case 'MIN_SAFE_INTEGER':
              return new CSharpMemberAccess(new CSharpIdentifier('long'), 'MinValue');
            case 'MAX_VALUE':
              return new CSharpMemberAccess(new CSharpIdentifier('double'), 'MaxValue');
            case 'MIN_VALUE':
              return new CSharpMemberAccess(new CSharpIdentifier('double'), 'Epsilon');
            case 'EPSILON':
              return new CSharpMemberAccess(new CSharpIdentifier('double'), 'Epsilon');
            case 'POSITIVE_INFINITY':
              return new CSharpMemberAccess(new CSharpIdentifier('double'), 'PositiveInfinity');
            case 'NEGATIVE_INFINITY':
              return new CSharpMemberAccess(new CSharpIdentifier('double'), 'NegativeInfinity');
            case 'NaN':
              return new CSharpMemberAccess(new CSharpIdentifier('double'), 'NaN');
            default:
              return CSharpLiteral.Double(node.value);
          }
        }

        case 'InstanceOfCheck': {  // IL AST node for instanceof -> value is ClassName
          const value = this.transformExpression(node.value);
          const className = typeof node.className === 'string' ? node.className : (node.className.name || node.className.value || 'object');
          return new CSharpIsExpression(value, new CSharpType(className));
        }

        case 'Random':
          return this.transformRandom(node);

        case 'Imul':
          return this.transformImul(node);

        case 'Sqrt':  // IL AST node for Math.sqrt
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Sqrt',
            [this.transformExpression(node.argument)]
          );

        case 'Log':  // IL AST node for Math.log
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Log',
            [this.transformExpression(node.argument)]
          );

        case 'Log2':  // IL AST node for Math.log2
          // Math.Log2 is .NET 5+ only, use Math.Log(x) / Math.Log(2) for compatibility
          return new CSharpBinaryExpression(
            new CSharpMethodCall(
              new CSharpIdentifier('Math'),
              'Log',
              [this.transformExpression(node.argument)]
            ),
            '/',
            new CSharpMethodCall(
              new CSharpIdentifier('Math'),
              'Log',
              [CSharpLiteral.Double(2)]
            )
          );

        case 'Log10':  // IL AST node for Math.log10
          return new CSharpMethodCall(
            new CSharpIdentifier('Math'),
            'Log10',
            [this.transformExpression(node.argument)]
          );

        case 'CountLeadingZeros':  // IL AST node for Math.clz32
          return new CSharpMethodCall(
            new CSharpIdentifier('OpCodes'),
            'Clz32',
            [new CSharpCast(CSharpType.UInt(), this.transformExpression(node.argument))]
          );

        case 'Clz32':
          return this.transformClz32(node);

        case 'Cast':
          return this.transformCast(node);

        // IL AST BigIntCast - converts to BigInteger
        case 'BigIntCast':
          return this.transformBigIntCast(node);

        // IL AST TypedArraySet - copies array elements at an offset
        case 'TypedArraySet':
          return this.transformTypedArraySet(node);

        // IL AST TypedArraySubarray - extracts a subarray from an array
        case 'TypedArraySubarray':
          return this.transformTypedArraySubarray(node);

        // IL AST ArraySplice - removes/replaces elements in an array
        case 'ArraySplice':
          return this.transformArraySplice(node);

        // IL AST SetCreation - creates a Set
        case 'SetCreation':
          return this.transformSetCreation(node);

        case 'DestructuringAssignment':
          return this.transformDestructuringAssignment(node);

        // IL AST Error node
        case 'ErrorCreation':
          return new CSharpObjectCreation(
            new CSharpType(node.errorType === 'Error' ? 'Exception' :
                           node.errorType === 'TypeError' ? 'ArgumentException' :
                           node.errorType === 'RangeError' ? 'ArgumentOutOfRangeException' : 'Exception'),
            [node.message ? this.transformExpression(node.message) : CSharpLiteral.String('')]
          );

        // Fallback for unknown OpCodes methods
        case 'OpCodesCall': {
          const args = node.arguments.map(a => this.transformExpression(a));
          // Handle specific OpCodes methods that need special C# translation
          switch (node.method) {
            case 'CopyArray':
              // array.ToArray() creates a shallow copy in C#
              return new CSharpMethodCall(args[0], 'ToArray', []);
            case 'ClearArray':
              // Array.Clear in C#
              return new CSharpMethodCall(
                new CSharpIdentifier('Array'),
                'Clear',
                args
              );
            default:
              // Generic fallback - call method as static helper
              return new CSharpMethodCall(
                new CSharpIdentifier('OpCodes'),
                node.method,
                args
              );
          }
        }

        // MathCall - for unhandled Math.* methods
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          switch (node.method) {
            case 'imul':
              // Math.imul(a, b) → unchecked((uint)(a * b)) for 32-bit integer multiply
              if (args.length >= 2)
                return new CSharpCast(
                  CSharpType.UInt(),
                  new CSharpBinaryExpression(args[0], '*', args[1])
                );
              break;
            case 'abs':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Abs', args);
            case 'floor':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Floor', args);
            case 'ceil':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Ceiling', args);
            case 'round':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Round', args);
            case 'min':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Min', args);
            case 'max':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Max', args);
            case 'pow':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Pow', args);
            case 'sqrt':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sqrt', args);
            case 'log':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', args);
            case 'log10':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log10', args);
            case 'exp':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Exp', args);
            case 'sin':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sin', args);
            case 'cos':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Cos', args);
            case 'random':
              // C# uses Random class
              return new CSharpMethodCall(
                new CSharpObjectCreation(new CSharpType('Random'), []),
                'NextDouble',
                []
              );
            case 'trunc':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Truncate', args);
            case 'sign':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sign', args);
            case 'clz32':
              // Count leading zeros - use OpCodes.Clz32 for .NET compatibility
              return new CSharpMethodCall(new CSharpIdentifier('OpCodes'), 'Clz32', [
                new CSharpCast(CSharpType.UInt(), args[0])
              ]);
            case 'tan':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Tan', args);
            case 'asin':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Asin', args);
            case 'acos':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Acos', args);
            case 'atan':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Atan', args);
            case 'atan2':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Atan2', args);
            case 'sinh':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sinh', args);
            case 'cosh':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Cosh', args);
            case 'tanh':
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Tanh', args);
            case 'cbrt':
              // Math.cbrt -> Math.Pow(arg, 1.0/3.0) for broad .NET compatibility
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Pow', [
                args[0],
                new CSharpBinaryExpression(CSharpLiteral.Double(1.0), '/', CSharpLiteral.Double(3.0))
              ]);
            case 'hypot':
              // Math.hypot(a,b) -> Math.Sqrt(a*a + b*b)
              if (args.length >= 2)
                return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sqrt', [
                  new CSharpBinaryExpression(
                    new CSharpBinaryExpression(args[0], '*', args[0]),
                    '+',
                    new CSharpBinaryExpression(args[1], '*', args[1])
                  )
                ]);
              return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Abs', args);
            case 'fround':
              // Math.fround(arg) -> (float)arg
              return new CSharpCast(new CSharpType('float'), args[0]);
            case 'log2':
              // Math.log2(x) -> Math.Log(x) / Math.Log(2)
              return new CSharpBinaryExpression(
                new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', args),
                '/',
                new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', [CSharpLiteral.Double(2)])
              );
            default:
              // Fallback to Math.Method
              return new CSharpMethodCall(new CSharpIdentifier('Math'), node.method, args);
          }
        }

        // IL AST StringInterpolation - `Hello ${name}` -> $"Hello {name}"
        case 'StringInterpolation': {
          // Build parts array for CSharpStringInterpolation (handles emission properly)
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value) parts.push(part.value);
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                const expr = this.transformExpression(part.expression);
                if (expr) parts.push(expr);
              }
            }
          } else if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              if (node.quasis[i]) parts.push(node.quasis[i]);
              if (i < node.expressions.length) {
                const expr = this.transformExpression(node.expressions[i]);
                if (expr) parts.push(expr);
              }
            }
          }
          return new CSharpStringInterpolation(parts);
        }

        // IL AST ObjectLiteral - {key: value} -> new { key = value } or Dictionary
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return CSharpLiteral.Null();

          const props = [];
          let hasNumericKeys = false;
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') continue;
            let key = prop.key?.name || prop.key?.value || prop.key || 'key';
            // Check if key is numeric (number or numeric string)
            if (typeof key === 'number' || (typeof key === 'string' && /^\d+$/.test(key))) {
              hasNumericKeys = true;
            }
            const value = this.transformExpression(prop.value);
            props.push({ name: String(key), value: value || CSharpLiteral.Null() });
          }

          if (props.length === 0)
            return CSharpLiteral.Null();

          // If any keys are numeric, use Dictionary<string, dynamic> instead of anonymous object
          // C# anonymous objects cannot have numeric property names
          if (hasNumericKeys) {
            const init = new CSharpObjectInitializer(true); // true = dictionary initializer syntax
            for (const prop of props) {
              init.assignments.push({ name: prop.name, value: prop.value });
            }
            const creation = new CSharpObjectCreation(
              new CSharpType('Dictionary', { isGeneric: true, genericArguments: [CSharpType.String(), new CSharpType('dynamic')] })
            );
            creation.initializer = init;
            return creation;
          }

          return new CSharpAnonymousObject(props);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> ((char)65).ToString() or string constructor
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return CSharpLiteral.String('');
          if (args.length === 1) {
            // Single char: ((char)code).ToString()
            return new CSharpMethodCall(
              new CSharpParenthesized(new CSharpCast(new CSharpType('char'), args[0])),
              'ToString',
              []
            );
          }
          // Multiple chars: new string(new char[] { (char)c1, (char)c2, ... })
          const charCasts = args.map(a => new CSharpCast(new CSharpType('char'), a));
          return new CSharpObjectCreation(
            new CSharpType('string'),
            [new CSharpArrayCreation(new CSharpType('char'), charCasts)]
          );
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> x is Array or x != null
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          // In C#, we can check if something is an array with "is Array" or just != null for typed arrays
          return new CSharpBinaryExpression(value, '!=', CSharpLiteral.Null());
        }

        // IL AST ArrowFunction - (x) => expr -> inline lambda
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return new CSharpParameter(CSharpType.Object(), name);
          });
          const body = node.body ?
            (node.body.type === 'BlockStatement' ? this.transformFunctionBody(node.body, null) : this.transformExpression(node.body)) :
            null;
          return new CSharpLambda(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> x.GetType().Name or type check
        case 'TypeOfExpression': {
          const arg = this.transformExpression(node.argument);
          return new CSharpMethodCall(
            new CSharpMethodCall(arg, 'GetType', []),
            'ToString',
            []
          );
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (C# has no direct equivalent)
        case 'ObjectFreeze': {
          return this.transformExpression(node.object || node.argument);
        }

        // IL AST ArrayFrom - Array.from(x) -> x.ToArray() or [..x] or just x
        case 'ArrayFrom': {
          const iterable = this.transformExpression(node.iterable);
          // For byte arrays and other typed arrays, just convert to array
          if (node.mapFunction) {
            // Array.from(arr, fn) -> arr.Select(fn).ToArray()
            const mapFn = this.transformExpression(node.mapFunction);
            return new CSharpMethodCall(
              new CSharpMethodCall(iterable, 'Select', [mapFn]),
              'ToArray',
              []
            );
          }
          // Simple case: Array.from(x) -> x.ToArray()
          return new CSharpMethodCall(iterable, 'ToArray', []);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> BinaryPrimitives.Write*
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method; // 'setUint32', 'setUint16', etc.
          const littleEndian = node.littleEndian;

          // Map JS DataView method to C# equivalent
          let writeMethod = 'WriteUInt32';
          if (method === 'setUint16') writeMethod = 'WriteUInt16';
          else if (method === 'setUint8') writeMethod = 'WriteByte';
          else if (method === 'setInt32') writeMethod = 'WriteInt32';
          else if (method === 'setInt16') writeMethod = 'WriteInt16';

          if (littleEndian !== false)
            writeMethod += 'LittleEndian';
          else
            writeMethod += 'BigEndian';

          return new CSharpMethodCall(
            new CSharpIdentifier('BinaryPrimitives'),
            writeMethod,
            [new CSharpMethodCall(view, 'AsSpan', [offset]), value]
          );
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> BinaryPrimitives.Read*
        case 'DataViewRead': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const method = node.method; // 'getUint32', 'getUint16', etc.
          const littleEndian = node.littleEndian;

          // Map JS DataView method to C# equivalent
          let readMethod = 'ReadUInt32';
          if (method === 'getUint16') readMethod = 'ReadUInt16';
          else if (method === 'getUint8') return new CSharpElementAccess(view, offset);
          else if (method === 'getInt32') readMethod = 'ReadInt32';
          else if (method === 'getInt16') readMethod = 'ReadInt16';

          if (littleEndian !== false)
            readMethod += 'LittleEndian';
          else
            readMethod += 'BigEndian';

          return new CSharpMethodCall(
            new CSharpIdentifier('BinaryPrimitives'),
            readMethod,
            [new CSharpMethodCall(view, 'AsSpan', [offset])]
          );
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> (int)str[i]
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new CSharpCast('int', new CSharpElementAccess(str, index));
        }

        // IL AST StringReplace - str.replace(search, replace) -> str.Replace(search, replace)
        case 'StringReplace': {
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue);
          const replace = this.transformExpression(node.replaceValue);
          return new CSharpMethodCall(str, 'Replace', [search, replace]);
        }

        // IL AST BufferCreation - new ArrayBuffer(n) or Buffer.alloc(n) -> new byte[n]
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new CSharpArrayCreation('byte', size);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods
        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          if (method === 'imul') {
            // Math.imul(a, b) -> (int)((long)a * b)
            if (args.length >= 2)
              return new CSharpCast('int',
                new CSharpBinaryExpression(
                  new CSharpCast('long', args[0]),
                  '*',
                  args[1]
                )
              );
          }
          if (method === 'cbrt')
            return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Pow', [
              args[0],
              new CSharpBinaryExpression(CSharpLiteral.Double(1.0), '/', CSharpLiteral.Double(3.0))
            ]);
          if (method === 'hypot' && args.length >= 2)
            return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Sqrt', [
              new CSharpBinaryExpression(
                new CSharpBinaryExpression(args[0], '*', args[0]),
                '+',
                new CSharpBinaryExpression(args[1], '*', args[1])
              )
            ]);
          if (method === 'fround')
            return new CSharpCast(new CSharpType('float'), args[0]);
          if (method === 'log2')
            return new CSharpBinaryExpression(
              new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', args),
              '/',
              new CSharpMethodCall(new CSharpIdentifier('Math'), 'Log', [CSharpLiteral.Double(2)])
            );
          if (method === 'ceil')
            return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Ceiling', args);
          if (method === 'trunc')
            return new CSharpMethodCall(new CSharpIdentifier('Math'), 'Truncate', args);
          // Default: use System.Math
          const mathMethod = method.charAt(0).toUpperCase() + method.slice(1);
          return new CSharpMethodCall(new CSharpIdentifier('Math'), mathMethod, args);
        }

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> arr[start..end] or arr.AsSpan(start, length)
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const end = node.end ? this.transformExpression(node.end) : null;

          if (end)
            return new CSharpMethodCall(array, 'AsSpan', [start, new CSharpBinaryExpression(end, '-', start)]);
          return new CSharpMethodCall(array, 'AsSpan', [start]);
        }

        // ========================[ String Operations - Additional ]========================

        // IL AST StringStartsWith - str.startsWith(prefix) -> str.StartsWith(prefix)
        case 'StringStartsWith': {
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.searchValue || node.search || node.prefix);
          return new CSharpMethodCall(str, 'StartsWith', [search]);
        }

        // IL AST StringEndsWith - str.endsWith(suffix) -> str.EndsWith(suffix)
        case 'StringEndsWith': {
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.searchValue || node.search || node.suffix);
          return new CSharpMethodCall(str, 'EndsWith', [search]);
        }

        // IL AST StringToLowerCase - str.toLowerCase() -> str.ToLowerInvariant()
        case 'StringToLowerCase': {
          const str = this.transformExpression(node.string || node.value);
          return new CSharpMethodCall(str, 'ToLowerInvariant', []);
        }

        // IL AST StringToUpperCase - str.toUpperCase() -> str.ToUpperInvariant()
        case 'StringToUpperCase': {
          const str = this.transformExpression(node.string || node.value);
          return new CSharpMethodCall(str, 'ToUpperInvariant', []);
        }

        // IL AST StringTrim - str.trim() -> str.Trim()
        case 'StringTrim': {
          const str = this.transformExpression(node.string || node.value);
          return new CSharpMethodCall(str, 'Trim', []);
        }

        // IL AST StringConcat - string.concat(s1, s2) -> string.Concat(s1, s2) or s1 + s2
        case 'StringConcat': {
          const str = this.transformExpression(node.string || node.value);
          const args = (node.args || node.strings || node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return str;
          // Use string.Concat for multiple arguments
          return new CSharpMethodCall(
            new CSharpIdentifier('string'),
            'Concat',
            [str, ...args]
          );
        }

        // ========================[ Map/Dictionary Operations ]========================

        // IL AST MapGet - map.get(key) -> dict[key]
        case 'MapGet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new CSharpElementAccess(map, [key]);
        }

        // IL AST MapSet - map.set(key, value) -> dict[key] = value
        case 'MapSet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new CSharpAssignment(
            new CSharpElementAccess(map, [key]),
            '=',
            value
          );
        }

        // IL AST MapHas - map.has(key) -> dict.ContainsKey(key)
        case 'MapHas': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new CSharpMethodCall(map, 'ContainsKey', [key]);
        }

        // IL AST MapDelete - map.delete(key) -> dict.Remove(key)
        case 'MapDelete': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new CSharpMethodCall(map, 'Remove', [key]);
        }

        // ========================[ Object Utility Operations ]========================

        // IL AST ObjectKeys - Object.keys(obj) -> dict.Keys.ToArray()
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object || node.argument || node.arguments?.[0]);
          return new CSharpMethodCall(
            new CSharpMemberAccess(obj, 'Keys'),
            'ToArray',
            []
          );
        }

        // IL AST ObjectValues - Object.values(obj) -> dict.Values.ToArray()
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object || node.argument || node.arguments?.[0]);
          return new CSharpMethodCall(
            new CSharpMemberAccess(obj, 'Values'),
            'ToArray',
            []
          );
        }

        // IL AST ObjectEntries - Object.entries(obj) -> dict.Select(kv => new { kv.Key, kv.Value }).ToArray()
        case 'ObjectEntries': {
          const obj = this.transformExpression(node.object || node.argument || node.arguments?.[0]);
          const kvParam = new CSharpParameter('kv', null);
          const kvBody = new CSharpAnonymousObject([
            { name: 'Key', value: new CSharpMemberAccess(new CSharpIdentifier('kv'), 'Key') },
            { name: 'Value', value: new CSharpMemberAccess(new CSharpIdentifier('kv'), 'Value') }
          ]);
          const selectCall = new CSharpMethodCall(obj, 'Select', [new CSharpLambda([kvParam], kvBody)]);
          return new CSharpMethodCall(selectCall, 'ToArray', []);
        }

        // IL AST ObjectCreate - Object.create(proto) -> new Dictionary<string, object>()
        case 'ObjectCreate': {
          const dictType = new CSharpType('Dictionary', [CSharpType.String(), CSharpType.Object()]);
          return new CSharpObjectCreation(dictType, []);
        }

        // ========================[ Utility Operations ]========================

        // IL AST DebugOutput - console.log/warn/error -> Console.Error.WriteLine(...)
        case 'DebugOutput': {
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const level = node.level || node.method || 'log';
          // Use Console.Error.WriteLine for debug output in C#
          const consoleStream = (level === 'error' || level === 'warn')
            ? new CSharpMemberAccess(new CSharpIdentifier('Console'), 'Error')
            : new CSharpMemberAccess(new CSharpIdentifier('Console'), 'Error');
          return new CSharpMethodCall(consoleStream, 'WriteLine', args);
        }

        // IL AST IsFiniteCheck - Number.isFinite(v) -> !double.IsInfinity(v) && !double.IsNaN(v)
        case 'IsFiniteCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new CSharpBinaryExpression(
            new CSharpUnaryExpression(
              '!',
              new CSharpMethodCall(new CSharpIdentifier('double'), 'IsInfinity', [value])
            ),
            '&&',
            new CSharpUnaryExpression(
              '!',
              new CSharpMethodCall(new CSharpIdentifier('double'), 'IsNaN', [value])
            )
          );
        }

        // IL AST IsNaNCheck - Number.isNaN(v) -> double.IsNaN(v)
        case 'IsNaNCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new CSharpMethodCall(new CSharpIdentifier('double'), 'IsNaN', [value]);
        }

        // IL AST IsIntegerCheck - Number.isInteger(v) -> Math.Floor(v) == v
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new CSharpBinaryExpression(
            new CSharpMethodCall(new CSharpIdentifier('Math'), 'Floor', [new CSharpCast(CSharpType.Double(), value)]),
            '==',
            value
          );
        }

        // IL AST CopyArray - array copy -> (T[])arr.Clone() or arr.ToArray()
        case 'CopyArray': {
          const arr = this.transformExpression(node.array || node.arguments?.[0]);
          return new CSharpMethodCall(arr, 'ToArray', []);
        }

        default:
          // Log warning for unhandled expression types to aid debugging
          const safeStringify = (obj) => {
            try {
              return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v, 2).substring(0, 200);
            } catch (e) { return '[stringify error]'; }
          };
          console.warn(`[CSharpTransformer] Unhandled expression type: ${node.type}`, safeStringify(node));
          // Return a placeholder that will cause compilation to fail with clear message
          return new CSharpIdentifier(`UNHANDLED_EXPRESSION_${node.type}`);
          // Note: This will cause C# compilation to fail with a clear error indicating what's missing
      }
    }

    transformLiteral(node) {
      if (node.value === null) return CSharpLiteral.Null();
      // Handle undefined - treat same as null in C#
      if (node.value === undefined) return CSharpLiteral.Null();
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

        // Check size for type - match C# literal default rules
        // In C#, undecorated integer literals are int if they fit in int range
        if (Number.isInteger(node.value)) {
          const INT_MIN = -2147483648;
          const INT_MAX = 2147483647;
          const UINT_MAX = 0xFFFFFFFF;

          // Values that fit in int range - use int (C# default)
          if (node.value >= INT_MIN && node.value <= INT_MAX) {
            return CSharpLiteral.Int(node.value);
          }
          // Values that exceed int but fit in uint - use uint with 'u' suffix
          if (node.value > INT_MAX && node.value <= UINT_MAX) {
            return CSharpLiteral.UInt(node.value);
          }
          // Larger values - use long
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

      // Check if this variable was renamed to avoid C# scope collision
      if (this.variableNameMap.has(name)) {
        name = this.variableNameMap.get(name);
      }

      // Inside setter body, replace JS parameter name with C# 'value'
      if (this.currentSetterParam && name === this.currentSetterParam) {
        name = 'value';
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
          // Check if we already know the variable's type - if it's incompatible,
          // the check is always false (or always true for !=)
          const varType = this.inferFullExpressionType(node.left.argument);
          if (varType) {
            // If we're checking for string but the type is array, result is always false
            if (csType === 'string' && varType.isArray) {
              return CSharpLiteral.Bool(op === '!=');
            }
            // If we're checking for number but the type is array, result is always false
            if ((csType === 'double' || csType === 'int' || csType === 'uint') && varType.isArray) {
              return CSharpLiteral.Bool(op === '!=');
            }
          }

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

      // Handle string/char comparisons with relational operators
      // In C#, strings can't use <, >, <=, >= directly - need string.Compare()
      // But chars CAN use relational operators directly
      const isRelationalOp = ['<', '>', '<=', '>='].includes(op);
      if (isRelationalOp) {
        const leftType = this.inferFullExpressionType(node.left);
        const rightType = this.inferFullExpressionType(node.right);

        // Check type categories
        const isLeftChar = leftType?.name === 'char';
        const isRightChar = rightType?.name === 'char';
        const isLeftString = leftType?.name === 'string';
        const isRightString = rightType?.name === 'string';
        const isLeftSingleCharLiteral = node.left?.type === 'Literal' && typeof node.left.value === 'string' && node.left.value.length === 1;
        const isRightSingleCharLiteral = node.right?.type === 'Literal' && typeof node.right.value === 'string' && node.right.value.length === 1;

        // Strategy: Only use char comparison when we're CERTAIN both sides are chars
        // - Both sides are single-char literals
        // - One side is confirmed char type and other is single-char literal
        // - Both sides are confirmed char types
        // Otherwise, use string.Compare() for safety
        const shouldUseCharComparison =
          (isLeftChar && isRightChar) ||
          (isLeftChar && isRightSingleCharLiteral) ||
          (isRightChar && isLeftSingleCharLiteral) ||
          (isLeftSingleCharLiteral && isRightSingleCharLiteral);

        if (shouldUseCharComparison) {
          // Convert single-char strings to char literals for direct comparison
          let leftExpr = left;
          let rightExpr = right;

          if (isLeftSingleCharLiteral) {
            leftExpr = CSharpLiteral.Char(node.left.value);
          }
          if (isRightSingleCharLiteral) {
            rightExpr = CSharpLiteral.Char(node.right.value);
          }

          const result = new CSharpBinaryExpression(leftExpr, op, rightExpr);
          return result;
        }

        // For actual multi-char string comparisons, use string.Compare()
        const isLeftActualString = this.isStringExpression(left, node.left) && !isLeftChar;
        const isRightActualString = this.isStringExpression(right, node.right) && !isRightChar;
        if ((isLeftActualString || isRightActualString) && !isLeftChar && !isRightChar) {
          // Convert str1 op str2 to string.Compare(str1, str2) op 0
          const compareCall = new CSharpMethodCall(
            new CSharpIdentifier('string'),
            'Compare',
            [left, right]
          );
          const result = new CSharpBinaryExpression(compareCall, op, CSharpLiteral.Int(0));
          return result;
        }
      }

      // Wrap sub-expressions in parentheses if they have lower precedence
      const result = new CSharpBinaryExpression(left, op, right);
      result.leftNeedsParens = this.childNeedsParens(node.operator, node.left, true);
      result.rightNeedsParens = this.childNeedsParens(node.operator, node.right, false);

      return result;
    }

    /**
     * Check if an expression represents a string type
     * @param {object} csExpr - The transformed C# expression
     * @param {object} jsNode - The original JavaScript AST node
     * @returns {boolean}
     */
    isStringExpression(csExpr, jsNode) {
      // Check if transformed expression is a string literal
      if (csExpr?.nodeType === 'Literal' && typeof csExpr.value === 'string') {
        return true;
      }

      // Check if original node is a string literal
      if (jsNode?.type === 'Literal' && typeof jsNode.value === 'string') {
        return true;
      }

      // Check inferred type
      const inferredType = this.inferFullExpressionType(jsNode);
      if (inferredType?.name === 'string') {
        return true;
      }

      // Check if it's a .ToString() call
      if (csExpr?.nodeType === 'MethodCall' && csExpr.method === 'ToString') {
        return true;
      }

      return false;
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
        // Special case: !IsArrayCheck -> x == null (invert the != null check)
        if (node.argument.type === 'IsArrayCheck' || node.argument.ilNodeType === 'IsArrayCheck') {
          const value = this.transformExpression(node.argument.value);
          return new CSharpBinaryExpression(value, '==', CSharpLiteral.Null());
        }

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

        // If the operand is already a binary expression (like x != null), just wrap with !
        if (operand?.nodeType === 'BinaryExpression') {
          return new CSharpUnaryExpression('!', operand, true);
        }

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
      // Skip assigning null to non-nullable enum properties like SecurityStatus
      if (node.right?.type === 'Literal' && node.right.value === null) {
        // Handle ThisPropertyAccess (type for this.property assignments)
        if (node.left?.type === 'ThisPropertyAccess' || node.left?.ilNodeType === 'ThisPropertyAccess') {
          const propName = (typeof node.left.property === 'string' ? node.left.property : node.left.property?.name || '').toLowerCase();
          // SecurityStatus is a non-nullable enum, skip null assignments
          if (propName === 'securitystatus') {
            return null; // Skip this assignment
          }
        }
        // Also handle regular MemberExpression (this.x)
        if (node.left?.type === 'MemberExpression' && node.left.property) {
          const propName = (typeof node.left.property === 'string' ? node.left.property : node.left.property?.name || '').toLowerCase();
          if (propName === 'securitystatus') {
            return null; // Skip this assignment
          }
        }
      }

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

      // Never cast arrays to scalar types or vice versa - this is always wrong
      // e.g., don't cast int[] to uint
      if (sourceType.isArray !== targetType.isArray) return expr;

      // char to string requires .ToString(), not a cast
      if (sourceType.name === 'char' && targetType.name === 'string') {
        return new CSharpMethodCall(expr, 'ToString', []);
      }

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
      // Handle AlgorithmFramework enum constants and types
      // These are things like CategoryType.BLOCK, SecurityStatus.SECURE, etc.
      const ENUM_CLASSES = new Set([
        'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'
      ]);

      // Known framework classes that should be used directly
      const FRAMEWORK_TYPES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase'
      ]);

      // Handle AlgorithmFramework.X pattern - strip the AlgorithmFramework. prefix
      // e.g., AlgorithmFramework.CategoryType -> CategoryType identifier
      // e.g., AlgorithmFramework.KeySize -> KeySize identifier
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        const propName = node.property.name || node.property.value;

        // For enums, return the enum identifier
        if (ENUM_CLASSES.has(propName))
          return new CSharpIdentifier(propName);

        // For helper classes, return the class name
        if (FRAMEWORK_TYPES.has(propName))
          return new CSharpIdentifier(propName);

        // For other properties, return as identifier
        return new CSharpIdentifier(propName);
      }

      // Handle AlgorithmFramework.CategoryType.BLOCK pattern (nested)
      // e.g., AlgorithmFramework.CategoryType.BLOCK -> CategoryType.BLOCK
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {

        const middleProp = node.object.property.name || node.object.property.value;
        const outerProp = node.property.name || node.property.value;

        // For enum constants, return EnumType.VALUE
        if (ENUM_CLASSES.has(middleProp))
          return new CSharpMemberAccess(new CSharpIdentifier(middleProp), outerProp);

        // For other nested access, just return the outer property
        return new CSharpIdentifier(outerProp);
      }

      // Handle direct enum access like CategoryType.BLOCK (after destructuring)
      if (node.object && node.object.type === 'Identifier' && ENUM_CLASSES.has(node.object.name)) {
        let enumValue = node.property.name || node.property.value;
        // Map invalid enum values to valid ones
        // ComplexityType.BASIC doesn't exist in framework - map to BEGINNER
        if (node.object.name === 'ComplexityType' && enumValue === 'BASIC')
          enumValue = 'BEGINNER';
        return new CSharpMemberAccess(new CSharpIdentifier(node.object.name), enumValue);
      }

      const target = this.transformExpression(node.object);

      if (node.computed) {
        // Array/dictionary access: obj[index]
        const index = this.transformExpression(node.property);

        // Check if target is a char type - if so, don't index it
        // In JS, "c"[0] returns "c", but in C# char[0] is invalid
        const targetType = this.inferFullExpressionType(node.object);
        if (targetType?.name === 'char') {
          // For char[0], just return the char itself
          if (node.property?.type === 'Literal' && node.property.value === 0) {
            return target;
          }
          // For other indices on a char, this is an error in the source
          // but we'll just return the target to avoid crashes
          return target;
        }

        // Check if we're indexing a single-char string literal with [0]
        // "A"[0] in JS should become 'A' char literal in C#
        if (node.object?.type === 'Literal' &&
            typeof node.object.value === 'string' &&
            node.object.value.length === 1 &&
            node.property?.type === 'Literal' &&
            node.property.value === 0) {
          return CSharpLiteral.Char(node.object.value);
        }

        // C# requires int for array indices. Cast uint expressions to int.
        const indexExpr = this.ensureIntIndex(index, node.property);
        return new CSharpElementAccess(target, indexExpr);
      }

      // Property access: obj.prop
      const member = node.property.name || node.property.value;

      // Map JavaScript properties to C#
      if (member === 'length') {
        return new CSharpMemberAccess(target, 'Length');
      }

      // For tuple member access, use PascalCase to match tuple field declarations
      // Detect if target is a method call that might return a tuple
      const targetType = this.inferFullExpressionType(node.object);
      if (targetType?.isTuple) {
        // C# tuple members must match the case used in the tuple declaration (PascalCase)
        return new CSharpMemberAccess(target, this.toPascalCase(member));
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
        // Handle both JS AST (NewExpression) and IL AST (ArrayCreation/TypedArrayCreation)
        if (methodName === 'fill') {
          const arrayObj = node.callee.object;
          const objType = arrayObj?.type;

          // Check for JS NewExpression: new Array(size)
          if (objType === 'NewExpression' && arrayObj.callee?.name === 'Array' && arrayObj.arguments?.length >= 1) {
            const size = this.transformExpression(arrayObj.arguments[0]);
            let fillValue = args[0] || CSharpLiteral.Int(0);
            if (this.currentArrayElementType) {
              const elemType = this.currentArrayElementType;
              if (fillValue.nodeType === 'Literal' && fillValue.value === 0) {
                fillValue = new CSharpCast(elemType, fillValue);
              }
            }
            // Enumerable.Repeat requires int for count parameter
            const intSize = new CSharpCast(CSharpType.Int(), size);
            const repeatCall = new CSharpMethodCall(new CSharpIdentifier('Enumerable'), 'Repeat', [fillValue, intSize]);
            return new CSharpMethodCall(repeatCall, 'ToArray', []);
          }

          // Check for IL ArrayCreation: { type: 'ArrayCreation', size: ... }
          if (objType === 'ArrayCreation' && arrayObj.size) {
            const size = this.transformExpression(arrayObj.size);
            let fillValue = args[0] || CSharpLiteral.Int(0);
            // Determine element type from the array creation
            let elemType = this.currentArrayElementType;
            if (!elemType && arrayObj.elementType) {
              elemType = this.transformType(arrayObj.elementType);
            }
            if (!elemType) {
              elemType = CSharpType.Byte(); // Default for crypto algorithms
            }
            // Cast fill value to element type
            if (fillValue.nodeType === 'Literal' && (fillValue.value === 0 || fillValue.value === 255)) {
              fillValue = new CSharpCast(elemType, fillValue);
            }
            // Enumerable.Repeat requires int for count parameter
            const intSize = new CSharpCast(CSharpType.Int(), size);
            const repeatCall = new CSharpMethodCall(new CSharpIdentifier('Enumerable'), 'Repeat', [fillValue, intSize]);
            return new CSharpMethodCall(repeatCall, 'ToArray', []);
          }

          // Check for IL TypedArrayCreation: { type: 'TypedArrayCreation', size: ... }
          if (objType === 'TypedArrayCreation' && arrayObj.size) {
            const size = this.transformExpression(arrayObj.size);
            let fillValue = args[0] || CSharpLiteral.Int(0);
            let elemType = this.currentArrayElementType;
            if (!elemType && arrayObj.elementType) {
              elemType = this.transformType(arrayObj.elementType);
            }
            if (!elemType) {
              elemType = CSharpType.Byte();
            }
            if (fillValue.nodeType === 'Literal' && (fillValue.value === 0 || fillValue.value === 255)) {
              fillValue = new CSharpCast(elemType, fillValue);
            }
            // Enumerable.Repeat requires int for count parameter
            const intSize = new CSharpCast(CSharpType.Int(), size);
            const repeatCall = new CSharpMethodCall(new CSharpIdentifier('Enumerable'), 'Repeat', [fillValue, intSize]);
            return new CSharpMethodCall(repeatCall, 'ToArray', []);
          }
        }

        const target = this.transformExpression(node.callee.object);

        // Handle Function.apply(thisArg, argsArray) pattern
        // Common: String.fromCharCode.apply(null, array) -> new string(array.Select(x => (char)x).ToArray())
        if (methodName === 'apply' && node.callee.object?.type === 'MemberExpression') {
          const outerObj = node.callee.object;
          const innerMethodName = outerObj.property?.name || outerObj.property?.value;
          const objName = outerObj.object?.name;

          // String.fromCharCode.apply(null, array) -> new string(array.Select(x => (char)x).ToArray())
          if (objName === 'String' && innerMethodName === 'fromCharCode' && args.length >= 2) {
            // args[0] is thisArg (null), args[1] is the array of char codes
            const arrayExpr = args[1];
            // Infer element type from array (typically byte[] or uint[])
            let elemType = CSharpType.Byte(); // Default to byte for char code arrays
            if (arrayExpr.csType?.elementType) {
              elemType = arrayExpr.csType.elementType;
            } else if (arrayExpr.nodeType === 'Identifier') {
              const varType = this.variableTypes.get(arrayExpr.name);
              if (varType?.elementType)
                elemType = varType.elementType;
            }
            // Generate: new string(array.Select(x => (char)x).ToArray())
            const lambda = new CSharpLambda(
              [new CSharpParameter('x', elemType)],
              new CSharpCast(CSharpType.Char(), new CSharpIdentifier('x'))
            );
            const selectCall = new CSharpMethodCall(arrayExpr, 'Select', [lambda]);
            const toArrayCall = new CSharpMethodCall(selectCall, 'ToArray', []);
            return new CSharpObjectCreation(CSharpType.String(), [toArrayCall]);
          }

          // func.apply(thisArg, argsArray) -> thisArg becomes receiver, spread args
          // For other .apply() calls, fall through to normal processing
        }

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
            // Convert string literal to char literal - store just the char, emitter adds quotes
            newArgs[1] = new CSharpLiteral(newArgs[1].value[0], 'char');
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
            // Convert string literal to char literal - store just the char, emitter adds quotes
            newArgs[1] = new CSharpLiteral(newArgs[1].value[0], 'char');
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
          // BUT if target is already a char (from string[i] access), just return it
          const targetType = this.inferFullExpressionType(node.callee.object);
          if (targetType?.name === 'char') {
            return target;
          }
          return new CSharpElementAccess(target, args[0]);
        }
        if (methodName === 'charCodeAt') {
          // str.charCodeAt(i) -> (int)str[i]
          // BUT if target is already a char (from string[i] access), just cast it: (int)char
          const targetType = this.inferFullExpressionType(node.callee.object);
          if (targetType?.name === 'char') {
            // Already a char, just cast to int
            return new CSharpCast(CSharpType.Int(), target);
          }
          // Handle single-char string literal: 'A'.charCodeAt(0) -> (int)'A'
          const objNode = node.callee.object;
          if (objNode?.type === 'Literal' &&
              typeof objNode.value === 'string' &&
              objNode.value.length === 1 &&
              node.arguments[0]?.type === 'Literal' &&
              node.arguments[0].value === 0) {
            return new CSharpCast(CSharpType.Int(), CSharpLiteral.Char(objNode.value));
          }
          return new CSharpCast(CSharpType.Int(), new CSharpElementAccess(target, args[0]));
        }
        if (methodName === 'toUpperCase') {
          // str.toUpperCase() -> str.ToUpper()
          return new CSharpMethodCall(target, 'ToUpper', []);
        }
        if (methodName === 'toLowerCase') {
          // str.toLowerCase() -> str.ToLower()
          return new CSharpMethodCall(target, 'ToLower', []);
        }
        if (methodName === 'trim') {
          return new CSharpMethodCall(target, 'Trim', []);
        }
        if (methodName === 'trimStart' || methodName === 'trimLeft') {
          return new CSharpMethodCall(target, 'TrimStart', []);
        }
        if (methodName === 'trimEnd' || methodName === 'trimRight') {
          return new CSharpMethodCall(target, 'TrimEnd', []);
        }
        if (methodName === 'padStart') {
          // str.padStart(length, char) -> str.PadLeft(length, char)
          return new CSharpMethodCall(target, 'PadLeft', args);
        }
        if (methodName === 'padEnd') {
          // str.padEnd(length, char) -> str.PadRight(length, char)
          return new CSharpMethodCall(target, 'PadRight', args);
        }
        if (methodName === 'startsWith') {
          return new CSharpMethodCall(target, 'StartsWith', args);
        }
        if (methodName === 'endsWith') {
          return new CSharpMethodCall(target, 'EndsWith', args);
        }
        if (methodName === 'replace' || methodName === 'replaceAll') {
          // str.replace(search, replacement) -> str.Replace(search, replacement)
          // C# requires both arguments to be strings or both to be chars
          const newArgs = [...args];
          // If first arg is a number, convert to string - e.g., 0 -> "0"
          if (newArgs[0]?.nodeType === 'Literal' && typeof newArgs[0].value === 'number') {
            newArgs[0] = CSharpLiteral.String(String(newArgs[0].value));
          }
          // If first arg is a cast to char from number, convert to string
          if (newArgs[0]?.nodeType === 'Cast' && newArgs[0].type?.name === 'char' &&
              newArgs[0].expression?.nodeType === 'Literal' && typeof newArgs[0].expression?.value === 'number') {
            newArgs[0] = CSharpLiteral.String(String.fromCharCode(newArgs[0].expression.value));
          }
          // Ensure second arg is also a string if first was converted
          if (newArgs[1]?.nodeType === 'Literal' && typeof newArgs[1].value === 'number') {
            newArgs[1] = CSharpLiteral.String(String(newArgs[1].value));
          }
          return new CSharpMethodCall(target, 'Replace', newArgs);
        }
        if (methodName === 'split') {
          // str.split(delimiter) -> str.Split(delimiter)
          return new CSharpMethodCall(target, 'Split', args);
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
          // array.fill(value) -> OpCodes.Fill(array, value) for .NET Framework compatibility
          // Note: Array.Fill is .NET Core 2.0+ only
          return new CSharpMethodCall(new CSharpIdentifier('OpCodes'), 'Fill', [target, ...args]);
        }
        if (methodName === 'concat') {
          // array.concat(other) -> array.Concat(other).ToArray()
          const concatCall = new CSharpMethodCall(target, 'Concat', args);
          return new CSharpMethodCall(concatCall, 'ToArray', []);
        }
        if (methodName === 'slice') {
          // array.slice(start, end) -> OpCodes.SliceArray for .NET compatibility
          if (args.length === 0) {
            // slice() - copy entire array
            return new CSharpMethodCall(target, 'ToArray', []);
          }
          if (args.length === 1) {
            // slice(start) - from start to end
            return new CSharpMethodCall(
              new CSharpIdentifier('OpCodes'),
              'SliceArray',
              [target, args[0], new CSharpMemberAccess(target, 'Length')]
            );
          }
          // slice(start, end)
          return new CSharpMethodCall(
            new CSharpIdentifier('OpCodes'),
            'SliceArray',
            [target, args[0], args[1]]
          );
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
          // Check if target is a string type - use string.IndexOf instead of Array.IndexOf
          const targetType = this.inferFullExpressionType(node.callee.object);
          // Debug logging
          if (process.env.DEBUG_INDEXOF) {
            console.log('indexOf target:', JSON.stringify(node.callee.object, null, 2).slice(0, 200));
            console.log('indexOf targetType:', targetType);
            console.log('Field types:', [...this.classFieldTypes.entries()]);
          }
          if (targetType?.name === 'string') {
            return new CSharpMethodCall(target, 'IndexOf', args);
          }
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
              return new CSharpObjectCreation(CSharpType.String(), [charArray]);
            }
          }
        }

        // Handle Array.isArray - JS static method
        // In C#, arrays are statically typed, so Array.isArray(x) becomes a null check
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Array') {
          if (methodName === 'isArray') {
            // Array.isArray(x) -> x != null (since C# has static typing, we just check for null)
            // For arrays in C#, if the type is already an array, we just need null check
            if (args.length >= 1) {
              return new CSharpBinaryExpression(args[0], '!=', CSharpLiteral.Null());
            }
            // If no arguments, return false
            return CSharpLiteral.Bool(false);
          }
          // Handle Array.from() - JS static method
          // In C#: just return the array argument (since typed arrays are the norm)
          // Array.from(x) -> x (or x.ToArray() for enumerables)
          if (methodName === 'from') {
            if (args.length >= 1) {
              // If the argument is already a typed array, just return it
              const argType = this.inferFullExpressionType(node.arguments[0]);
              if (argType?.isArray) {
                return args[0];
              }
              // For enumerables, use .ToArray()
              return new CSharpMethodCall(args[0], 'ToArray', []);
            }
            // If no arguments, return empty array
            return new CSharpArrayCreation(CSharpType.Byte(), CSharpLiteral.Int(0));
          }
        }

        // Handle Number.isInteger - JS static method
        // In C#: OpCodes.IsInteger(x) or x == Math.Floor(x)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Number') {
          if (methodName === 'isInteger') {
            // Number.isInteger(x) -> OpCodes.IsInteger(x)
            if (args.length >= 1) {
              return new CSharpMethodCall(new CSharpIdentifier('OpCodes'), 'IsInteger', [args[0]]);
            }
            return CSharpLiteral.Bool(false);
          }
          // Number.isFinite(x) -> !double.IsInfinity(x) && !double.IsNaN(x)
          if (methodName === 'isFinite') {
            if (args.length >= 1) {
              const isInfinity = new CSharpMethodCall(new CSharpIdentifier('double'), 'IsInfinity', [args[0]]);
              const isNaN = new CSharpMethodCall(new CSharpIdentifier('double'), 'IsNaN', [args[0]]);
              const notInfinity = new CSharpUnaryExpression('!', isInfinity);
              const notNaN = new CSharpUnaryExpression('!', isNaN);
              return new CSharpBinaryExpression(notInfinity, '&&', notNaN);
            }
            return CSharpLiteral.Bool(false);
          }
          // Number.isNaN(x) -> double.IsNaN(x)
          if (methodName === 'isNaN') {
            if (args.length >= 1) {
              return new CSharpMethodCall(new CSharpIdentifier('double'), 'IsNaN', [args[0]]);
            }
            return CSharpLiteral.Bool(true);
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

      // Check if this is a local variable being invoked (could be a delegate, lambda, or function reference)
      // In that case, keep the original casing to match the variable name
      const varType = this.getVariableType(funcName);
      if (varType) {
        // This is a local variable - keep original name (it could be an arrow function, delegate, etc.)
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

      let args = node.arguments.map(a => this.transformExpression(a));

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

      // Check if argument is an existing array (copy pattern)
      // new Uint8Array(existingArray) should become existingArray.ToArray()
      const isArrayCopy = node.arguments.length === 1 && node.arguments[0] && (() => {
        const arg = node.arguments[0];
        // Check by type annotation
        if (arg.inferredType?.endsWith?.('[]') || arg.inferredType?.startsWith?.('uint8[')) return true;
        // Check member access patterns like this._key, this._nonce
        if (arg.type === 'MemberExpression' && arg.property) {
          const propName = arg.property.name || arg.property.value || '';
          const lowerName = propName.toLowerCase();
          if (lowerName.startsWith('_') ||
              lowerName.includes('key') ||
              lowerName.includes('nonce') ||
              lowerName.includes('iv') ||
              lowerName.includes('buffer') ||
              lowerName.includes('data') ||
              lowerName.includes('bytes')) return true;
        }
        // Check for array variables by type
        if (arg.type === 'Identifier') {
          const varType = this.variableTypes?.get?.(arg.name);
          if (varType?.endsWith?.('[]') || varType?.includes?.('Array')) return true;
        }
        return false;
      })();

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
        if (isArrayCopy && args[0]) {
          // new Uint8Array(existingArray) -> existingArray.ToArray()
          return new CSharpMethodCall(args[0], 'ToArray', []);
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
        if (isArrayCopy && args[0]) {
          return new CSharpMethodCall(args[0], 'ToArray', []);
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
        if (isArrayCopy && args[0]) {
          return new CSharpMethodCall(args[0], 'ToArray', []);
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
        if (isArrayCopy && args[0]) {
          return new CSharpMethodCall(args[0], 'ToArray', []);
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
        if (isArrayCopy && args[0]) {
          return new CSharpMethodCall(args[0], 'ToArray', []);
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
        if (isArrayCopy && args[0]) {
          return new CSharpMethodCall(args[0], 'ToArray', []);
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
        if (isArrayCopy && args[0]) {
          return new CSharpMethodCall(args[0], 'ToArray', []);
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
        if (isArrayCopy && args[0]) {
          return new CSharpMethodCall(args[0], 'ToArray', []);
        }
        return new CSharpArrayCreation(CSharpType.Double(), args[0] || CSharpLiteral.Int(0), null);
      }
      if (typeName === 'ArrayBuffer') {
        // ArrayBuffer is conceptually a byte array in C#
        // Track this variable as an ArrayBuffer for later TypedArray view detection
        this.markAsArrayBuffer(node);
        return new CSharpArrayCreation(CSharpType.Byte(), args[0] || CSharpLiteral.Int(0), null);
      }

      // Handle TestCase constructor - first two arguments are byte[] arrays
      // Clear the outer array element type context to prevent TestCase[] from leaking into byte[] args
      if (typeName === 'TestCase') {
        const prevArrayElementType = this.currentArrayElementType;

        // First two args are byte[] (input, expected)
        this.currentArrayElementType = CSharpType.Byte();
        const arg0 = node.arguments[0] ? this.transformExpression(node.arguments[0]) : null;
        const arg1 = node.arguments[1] ? this.transformExpression(node.arguments[1]) : null;

        // Remaining args are strings (description, source)
        this.currentArrayElementType = null;
        const arg2 = node.arguments[2] ? this.transformExpression(node.arguments[2]) : null;
        const arg3 = node.arguments[3] ? this.transformExpression(node.arguments[3]) : null;

        this.currentArrayElementType = prevArrayElementType;

        const ctorArgs = [arg0, arg1, arg2, arg3].filter(a => a !== null);
        return new CSharpObjectCreation(new CSharpType('TestCase'), ctorArgs);
      }

      // Handle KeySize constructor - all arguments are int, not uint
      if (typeName === 'KeySize') {
        const intArgs = node.arguments.map(arg => {
          const transformed = this.transformExpression(arg);
          // Convert uint literals to int literals
          if (transformed instanceof CSharpLiteral && typeof transformed.value === 'number') {
            return CSharpLiteral.Int(transformed.value);
          }
          return transformed;
        });
        return new CSharpObjectCreation(new CSharpType('KeySize'), intArgs);
      }

      // Handle JavaScript Error types -> C# Exception types
      if (typeName === 'Error') {
        return new CSharpObjectCreation(new CSharpType('Exception'), args);
      }
      if (typeName === 'TypeError') {
        return new CSharpObjectCreation(new CSharpType('ArgumentException'), args);
      }
      if (typeName === 'RangeError') {
        return new CSharpObjectCreation(new CSharpType('ArgumentOutOfRangeException'), args);
      }
      if (typeName === 'SyntaxError') {
        return new CSharpObjectCreation(new CSharpType('FormatException'), args);
      }
      if (typeName === 'ReferenceError') {
        return new CSharpObjectCreation(new CSharpType('NullReferenceException'), args);
      }

      // If no arguments provided but class has constructor with default params,
      // explicitly provide the defaults (fixes static member init issue)
      if (args.length === 0 && this.constructorDefaultParams.has(typeName)) {
        args = this.constructorDefaultParams.get(typeName);
      }

      return new CSharpObjectCreation(new CSharpType(typeName), args);
    }

    transformArrayExpression(node) {
      // Infer element type from context or actual elements
      let elementType = null;

      // First, try to infer from actual elements (examines ALL elements to find widest type)
      let inferredFromElements = null;
      if (node.elements.length > 0) {
        const arrayType = this.inferArrayExpressionType(node);
        if (arrayType?.isArray && arrayType.elementType) {
          inferredFromElements = arrayType.elementType;
        }
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

      // Default to byte for crypto context (most common for test vectors)
      // Non-empty arrays infer type from elements; empty arrays default to byte
      if (!elementType) {
        elementType = node.elements.length === 0 ? CSharpType.Byte() : CSharpType.UInt();
      }

      // Set the element type context for child element transformations
      // e.g., for uint[][], child arrays should use uint as their element type
      // e.g., for TestCase[], child objects should transform to TestCase constructors
      const prevArrayElementType = this.currentArrayElementType;
      if (elementType.isArray) {
        this.currentArrayElementType = elementType.elementType;
      } else {
        // Keep the element type for non-array types (e.g., TestCase, LinkItem)
        // so transformObjectExpression can convert object literals to constructor calls
        this.currentArrayElementType = elementType;
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
        const srcNode = node.elements[i];
        const elemExprType = this.inferFullExpressionType(srcNode);

        // Special case: negative literals in unsigned context
        // -1 in uint context -> 0xFFFFFFFFu instead of (uint)-1 which requires unchecked
        // Check both direct negative literals and unary minus expressions
        const isNegativeLiteral = (elem.nodeType === 'Literal' && typeof elem.value === 'number' && elem.value < 0);
        const isUnaryMinus = (elem.nodeType === 'Unary' || elem.nodeType === 'UnaryExpression') &&
                             elem.operator === '-' && elem.operand?.nodeType === 'Literal';
        const negValue = isNegativeLiteral ? elem.value :
                         (isUnaryMinus ? -elem.operand.value : null);

        if (elementType.name === 'uint' && negValue !== null && negValue < 0) {
          // Convert negative value to unsigned representation
          const unsignedValue = (negValue >>> 0); // JavaScript trick to get unsigned
          return CSharpLiteral.UInt(unsignedValue);
        }
        if (elementType.name === 'ulong' && negValue !== null && negValue < 0) {
          // For ulong, use BigInt for proper conversion
          const unsignedValue = BigInt(negValue) + BigInt(0x10000000000000000n);
          return CSharpLiteral.Hex(unsignedValue, 'UL');
        }

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
      // Check if we're in an array context that expects specific types
      const expectedType = this.currentArrayElementType;

      // Handle TestCase objects: { text: ..., uri: ..., input: ..., expected: ... }
      if (expectedType?.name === 'TestCase') {
        return this.transformObjectToTestCase(node);
      }

      // Handle LinkItem objects: { title: ..., url: ... }
      if (expectedType?.name === 'LinkItem') {
        return this.transformObjectToLinkItem(node);
      }

      // Handle KeySize objects: { minSize: ..., maxSize: ..., step: ... }
      if (expectedType?.name === 'KeySize') {
        return this.transformObjectToKeySize(node);
      }

      // Handle Vulnerability objects: { name: ..., mitigation: ... }
      if (expectedType?.name === 'Vulnerability') {
        return this.transformObjectToVulnerability(node);
      }

      // For simple objects in JavaScript, use Dictionary<string, object> in C#
      const init = new CSharpObjectInitializer(true); // true = dictionary initializer syntax

      for (const prop of node.properties) {
        // Handle spread elements: { ...obj } - skip them for now
        if (prop.type === 'SpreadElement') continue;

        // Handle computed properties: { [expr]: value }
        if (!prop.key) continue;

        let name = prop.key.name || prop.key.value || 'Unknown';
        // Strip surrounding quotes from string literal keys (e.g., "'16'" -> "16")
        if (typeof name === 'string' && name.length >= 2) {
          const first = name[0];
          const last = name[name.length - 1];
          if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
            name = name.slice(1, -1);
          }
        }
        const value = this.transformExpression(prop.value);
        init.assignments.push({ name: this.toPascalCase(name), value });
      }

      const creation = new CSharpObjectCreation(
        new CSharpType('Dictionary', { isGeneric: true, genericArguments: [CSharpType.String(), CSharpType.Object()] })
      );
      creation.initializer = init;
      return creation;
    }

    /**
     * Transform object literal to TestCase constructor call
     */
    transformObjectToTestCase(node) {
      // Get properties from the object
      const props = {};
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') continue;
        const name = (prop.key.name || prop.key.value || '').toLowerCase();
        props[name] = prop.value;
      }

      // Save and clear array element context - nested arrays should use their own types
      const prevArrayElementType = this.currentArrayElementType;

      // TestCase(byte[] input, byte[] expected, string desc, string source)
      // Input/Expected are byte arrays, not TestCase arrays
      this.currentArrayElementType = CSharpType.Byte();
      const inputExpr = props.input ? this.transformExpression(props.input) : new CSharpLiteral('null', 'null');
      const expectedExpr = props.expected ? this.transformExpression(props.expected) : new CSharpLiteral('null', 'null');

      // Text/Uri are strings
      this.currentArrayElementType = null;
      const descExpr = props.text ? this.transformExpression(props.text) : new CSharpLiteral('""', 'string');
      const sourceExpr = props.uri ? this.transformExpression(props.uri) : new CSharpLiteral('""', 'string');

      // Restore context
      this.currentArrayElementType = prevArrayElementType;

      return new CSharpObjectCreation(new CSharpType('TestCase'), [inputExpr, expectedExpr, descExpr, sourceExpr]);
    }

    /**
     * Transform object literal to LinkItem constructor call
     */
    transformObjectToLinkItem(node) {
      const props = {};
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') continue;
        const name = (prop.key.name || prop.key.value || '').toLowerCase();
        props[name] = prop.value;
      }

      // LinkItem(string title, string url)
      const titleExpr = props.title ? this.transformExpression(props.title) : new CSharpLiteral('""', 'string');
      const urlExpr = props.url ? this.transformExpression(props.url) : new CSharpLiteral('""', 'string');

      return new CSharpObjectCreation(new CSharpType('LinkItem'), [titleExpr, urlExpr]);
    }

    /**
     * Transform object literal to KeySize constructor call
     */
    transformObjectToKeySize(node) {
      const props = {};
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') continue;
        const name = (prop.key.name || prop.key.value || '').toLowerCase();
        props[name] = prop.value;
      }

      // KeySize(int min, int max, int step) - all parameters are int, not uint
      // Force int type for literals since crypto context defaults to uint
      const transformToInt = (expr) => {
        if (!expr) return CSharpLiteral.Int(0);
        const transformed = this.transformExpression(expr);
        // If it's a uint literal, cast to int
        if (transformed instanceof CSharpLiteral && typeof transformed.value === 'number') {
          return CSharpLiteral.Int(transformed.value);
        }
        return transformed;
      };

      const minExpr = transformToInt(props.minsize);
      const maxExpr = transformToInt(props.maxsize);
      const stepExpr = props.step ? transformToInt(props.step) : CSharpLiteral.Int(1);

      return new CSharpObjectCreation(new CSharpType('KeySize'), [minExpr, maxExpr, stepExpr]);
    }

    /**
     * Transform object literal to Vulnerability constructor call
     */
    transformObjectToVulnerability(node) {
      const props = {};
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') continue;
        const name = (prop.key.name || prop.key.value || '').toLowerCase();
        props[name] = prop.value;
      }

      // Vulnerability(string name, string description, string mitigation)
      const nameExpr = props.name ? this.transformExpression(props.name) : new CSharpLiteral('""', 'string');
      const descExpr = props.description ? this.transformExpression(props.description) : new CSharpLiteral('""', 'string');
      const mitigationExpr = props.mitigation ? this.transformExpression(props.mitigation) : new CSharpLiteral('""', 'string');

      return new CSharpObjectCreation(new CSharpType('Vulnerability'), [nameExpr, descExpr, mitigationExpr]);
    }

    transformConditionalExpression(node) {
      // Ternary condition must be bool in C#
      const condition = this.ensureBooleanCondition(node.test);

      // Optimization: if condition is always true/false, eliminate the ternary
      if (condition?.nodeType === 'Literal' && condition.value === true) {
        return this.transformExpression(node.consequent);
      }
      if (condition?.nodeType === 'Literal' && condition.value === false) {
        return this.transformExpression(node.alternate);
      }

      // Handle Array.isArray(x) ? x : convert(x) pattern
      // When x is already known to be an array type, simplify to x ?? Array.Empty<T>()
      if (node.test.type === 'CallExpression' &&
          node.test.callee?.type === 'MemberExpression' &&
          node.test.callee.object?.name === 'Array' &&
          node.test.callee.property?.name === 'isArray') {
        const arg = node.test.arguments?.[0];
        if (arg && node.consequent.type === 'Identifier' && arg.type === 'Identifier' &&
            node.consequent.name === arg.name) {
          // Pattern: Array.isArray(x) ? x : ...
          // If x is already an array type, just return x ?? Array.Empty<T>()
          const argType = this.inferFullExpressionType(arg);
          if (argType?.isArray) {
            const xExpr = this.transformExpression(node.consequent);
            // Use null coalescing with empty array: x ?? Array.Empty<T>()
            const elemType = argType.elementType || CSharpType.Byte();
            const emptyCall = new CSharpMethodCall(
              new CSharpIdentifier('Array'),
              'Empty',
              []
            );
            emptyCall.typeArguments = [elemType];
            return new CSharpBinaryExpression(xExpr, '??', emptyCall);
          }
        }
      }

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

      // Check if returning an object expression - convert to tuple
      // This handles patterns like: return { left, right }; -> return (left, right);
      if (node.argument.type === 'ObjectExpression') {
        // If explicitly marked as tuple return type, use that
        if (this.currentMethod?.returnType?.isTuple) {
          return new CSharpReturn(this.transformObjectToTupleExpression(node.argument));
        }
        // Otherwise, detect simple object literals that should become tuples
        // A simple object literal has no spread elements and all properties are simple values
        const props = node.argument.properties;
        const isSimpleTupleLike = props && props.length >= 2 &&
          props.every(p => p.type !== 'SpreadElement' && p.key && !p.computed);
        if (isSimpleTupleLike) {
          return new CSharpReturn(this.transformObjectToTupleExpression(node.argument));
        }
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
        // Include property name for named tuple access (e.g., result.Left, result.Right)
        const tupleName = this.toPascalCase(propName);
        elements.push({ name: tupleName, expression: value });
      }

      return new CSharpTupleExpression(elements);
    }

    transformIfStatement(node) {
      // Handle JavaScript truthy conditions - add explicit comparison for non-bool types
      const condition = this.ensureBooleanCondition(node.test);

      // Dead code elimination: if condition is known to be false, skip the then branch
      if (condition?.nodeType === 'Literal' && condition.value === false) {
        // Return the else branch if it exists, otherwise return empty/null
        if (node.alternate) {
          return this.transformStatement(node.alternate);
        }
        // Return an empty statement (or null to omit)
        return null;
      }

      // If condition is known to be true, skip the if and just return the then branch
      if (condition?.nodeType === 'Literal' && condition.value === true) {
        return this.transformStatement(node.consequent);
      }

      const thenBranch = this.transformStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;
      return new CSharpIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forStmt = new CSharpFor();

      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          const decl = node.init.declarations[0];
          const varName = decl.id.name;
          let initExpr = this.transformExpression(decl.init);

          // For loop counters should be int for proper comparison with >= 0
          // Cast the initializer if it's not already int
          // Note: uint + int returns 'long' per C# promotion rules, so we need to cast that too
          const initType = this.inferFullExpressionType(decl.init);
          if (initType && initType.name !== 'int' &&
              ['uint', 'ulong', 'long', 'ushort', 'byte'].includes(initType.name)) {
            initExpr = new CSharpCast(CSharpType.Int(), initExpr);
          }

          // Register the loop variable type so it can be looked up when used in the loop body
          this.registerVariableType(varName, CSharpType.Int());

          forStmt.initializer = new CSharpVariableDeclaration(
            varName,
            CSharpType.Int(),
            initExpr
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

      // Save variable name mapping before processing body
      // Variables declared in the for-loop body are block-scoped in JS
      // so references inside the loop should map to their local names
      // But C# requires unique names across the entire method (CS0136),
      // so we DON'T restore methodDeclaredVars - only restore the name map
      const prevVariableNameMap = new Map(this.variableNameMap);

      forStmt.body = this.transformStatement(node.body);
      if (forStmt.body.nodeType !== 'Block') {
        const block = new CSharpBlock();
        block.statements.push(forStmt.body);
        forStmt.body = block;
      }

      // Restore name map for proper scoped reference resolution
      // methodDeclaredVars is NOT restored - C# needs unique names method-wide
      this.variableNameMap = prevVariableNameMap;

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

      // Escape reserved keywords (e.g., "byte" -> "@byte")
      const escapedName = this.escapeReservedKeyword(varName);

      // Transform the iterable
      const iterable = this.transformExpression(node.right);

      // Infer the element type from the iterable for proper type tracking
      // This ensures that foreach (var c in string) knows c is a char
      const iterableType = this.inferFullExpressionType(node.right);
      let elementType = CSharpType.Object();
      if (iterableType?.name === 'string') {
        // Iterating over a string yields chars
        elementType = CSharpType.Char();
      } else if (iterableType?.isArray && iterableType.elementType) {
        // Iterating over an array yields the element type
        elementType = iterableType.elementType;
      } else if (iterableType?.elementType) {
        elementType = iterableType.elementType;
      }

      // Save variable name mapping before processing body
      // C# requires unique names across the entire method (CS0136)
      // so we DON'T restore methodDeclaredVars - only restore the name map
      const prevVariableNameMap = new Map(this.variableNameMap);

      // Register the loop variable with the inferred element type
      // so that char[0] can be detected and handled correctly
      this.variableTypes.set(varName, elementType);
      this.variableTypes.set(escapedName, elementType);

      // Transform the body
      let body = this.transformStatement(node.body);
      if (body.nodeType !== 'Block') {
        const block = new CSharpBlock();
        block.statements.push(body);
        body = block;
      }

      // Restore name map for proper scoped reference resolution
      this.variableNameMap = prevVariableNameMap;

      return new CSharpForEach(escapedName, varType, iterable, body);
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

      // Escape reserved keywords
      varName = this.escapeReservedKeyword(varName);

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

      // Handle CSharpThis
      if (expr.nodeType === 'This') {
        return 'this';
      }

      if (expr.nodeType === 'Identifier') return expr.name;

      if (expr.nodeType === 'Literal' || expr.literalType !== undefined) {
        // CSharpLiteral has literalType instead of nodeType for type detection
        if (expr.literalType === 'string' || typeof expr.value === 'string') {
          // Escape string value and wrap in quotes
          const escaped = String(expr.value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          return `"${escaped}"`;
        }
        if (expr.literalType === 'null') return 'null';
        if (expr.literalType === 'bool') return expr.value ? 'true' : 'false';
        return String(expr.value);
      }

      if (expr.nodeType === 'MemberAccess') {
        // CSharpMemberAccess uses 'target' and 'member' properties
        const target = this.emitExpressionInline(expr.target);
        const memberName = this.toPascalCase(expr.member || expr.memberName || 'Unknown');
        return `${target}.${memberName}`;
      }

      if (expr.nodeType === 'MethodCall') {
        // CSharpMethodCall uses 'target' property
        const obj = this.emitExpressionInline(expr.target || expr.expression);
        const args = (expr.arguments || []).map(a => this.emitExpressionInline(a)).join(', ');
        const methodName = expr.methodName || expr.member || 'Unknown';
        return `${obj}.${methodName}(${args})`;
      }

      if (expr.nodeType === 'Conditional') {
        // Ternary expression: condition ? trueExpr : falseExpr
        const cond = this.emitExpressionInline(expr.condition);
        const trueExpr = this.emitExpressionInline(expr.trueExpression);
        const falseExpr = this.emitExpressionInline(expr.falseExpression);
        return `(${cond} ? ${trueExpr} : ${falseExpr})`;
      }

      if (expr.nodeType === 'Binary' || expr.nodeType === 'BinaryExpression') {
        const left = this.emitExpressionInline(expr.left);
        const right = this.emitExpressionInline(expr.right);
        return `(${left} ${expr.operator} ${right})`;
      }

      if (expr.nodeType === 'Cast') {
        const inner = this.emitExpressionInline(expr.expression);
        const typeName = expr.type?.name || expr.type?.toString() || 'object';
        return `((${typeName})${inner})`;
      }

      if (expr.nodeType === 'Parenthesized') {
        return `(${this.emitExpressionInline(expr.expression)})`;
      }

      if (expr.nodeType === 'ElementAccess') {
        const target = this.emitExpressionInline(expr.target);
        const index = this.emitExpressionInline(expr.index);
        return `${target}[${index}]`;
      }

      if (expr.nodeType === 'Unary' || expr.nodeType === 'UnaryExpression') {
        const operand = this.emitExpressionInline(expr.operand);
        if (expr.prefix) {
          return `(${expr.operator}${operand})`;
        }
        return `(${operand}${expr.operator})`;
      }

      // Fallback - use placeholder
      return `/* complex expr: ${expr.nodeType || 'unknown'} */`;
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
        // Special case: !IsArrayCheck -> x == null (invert the != null check)
        const argType = node.argument?.type || node.argument?.ilNodeType;
        if (argType === 'IsArrayCheck') {
          const value = this.transformExpression(node.argument.value);
          return new CSharpBinaryExpression(value, '==', CSharpLiteral.Null());
        }

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
        const inferredArgType = this.inferFullExpressionType(node.argument);
        if (inferredArgType && !['bool', 'boolean'].includes(inferredArgType.name)) {
          // For arrays/objects: !arr -> arr == null
          if (inferredArgType.isArray || inferredArgType.name === 'object' || inferredArgType.name === 'string') {
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
          if (numericTypes.includes(inferredArgType.name)) {
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

      // If the transformed expression is already a comparison, don't wrap it again
      // This prevents issues like (data != null) != null
      if (expr.nodeType === 'BinaryExpression') {
        const comparisonOps = ['==', '!=', '<', '>', '<=', '>='];
        if (comparisonOps.includes(expr.operator)) {
          return expr;
        }
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

    /**
     * Collect instance property assignments from constructor body (this.X = value patterns)
     * @param {object} constructorNode - The constructor method definition node
     * @param {string|null} baseClassName - The base class name to check for inherited properties
     * @returns {Map<string, object>} Map of property name -> { type: inferred type, initialValue: initial value node }
     */
    collectConstructorPropertyAssignments(constructorNode, baseClassName = null) {
      const properties = new Map();

      // Handle both ESTree format (value.body.body) and IL format (body.statements)
      let body = constructorNode?.value?.body?.body || constructorNode?.body?.statements || constructorNode?.body?.body || [];

      for (const stmt of body) {
        // Look for ExpressionStatement containing AssignmentExpression
        if (stmt.type !== 'ExpressionStatement') continue;
        const expr = stmt.expression;
        if (!expr || expr.type !== 'AssignmentExpression' || expr.operator !== '=') continue;

        // Check if left side is this.X
        // Handle both ESTree format (MemberExpression) and IL format (ThisPropertyAccess)
        const left = expr.left;
        let propName = null;

        if (left?.type === 'ThisPropertyAccess') {
          // IL format: ThisPropertyAccess has .property with the property name
          propName = left.property?.name || left.property;
        } else if (left?.type === 'MemberExpression') {
          // ESTree format: MemberExpression with object = ThisExpression
          if (!left.object || (left.object.type !== 'ThisExpression' && left.object.name !== 'this')) continue;
          propName = left.property?.name || left.property?.value;
        } else {
          continue;
        }
        if (!propName) continue;

        // Skip if this property is inherited from base class (already declared there)
        // Check type knowledge first
        if (baseClassName) {
          const inheritedType = this.getInheritedPropertyType(baseClassName, this.toPascalCase(propName));
          if (inheritedType) continue;
        }

        // Also skip known framework base class properties
        const lowerPropName = propName.toLowerCase();
        const knownBaseProps = [
          // Algorithm base class properties
          'name', 'description', 'inventor', 'year', 'category', 'subcategory',
          'securitystatus', 'complexity', 'country', 'checksumsize', 'documentation',
          'notes', 'tests', 'references', 'knownvulnerabilities', 'config',
          'supportedkeysizes', 'supportedblocksizes',
          // IAlgorithmInstance base class properties
          'algorithm', 'config', 'a', 'b',
          // IBlockCipherInstance, IStreamCipherInstance properties
          'key', 'iv', 'nonce',
          // Other common inherited properties
          'salt', 'iterations', 'outputlength', 'outputsize', 'seed'
        ];
        if (knownBaseProps.includes(lowerPropName)) continue;

        // Store the property with its initial value for type inference
        if (!properties.has(propName)) {
          properties.set(propName, {
            name: propName,
            initialValue: expr.right
          });
        }
      }

      return properties;
    }

    /**
     * Infer the C# type for a property based on its initial value
     * Handles constructor parameters, Array.Empty calls, etc.
     */
    inferPropertyType(initialValue, constructorNode, propName) {
      if (!initialValue) {
        return this.inferTypeFromName(propName) || CSharpType.Dynamic();
      }

      // Priority: Check for well-known AlgorithmFramework property names FIRST
      // These have specific types that should override element-based inference
      // Note: SupportedOutputSizes is NOT included because it has inconsistent formats
      // across algorithms (int[], KeySize[], or object literals)
      const lowerName = propName?.toLowerCase();
      const knownMetadataProps = [
        'tests', 'documentation', 'references', 'knownvulnerabilities',
        'keysizes', 'blocksizes', 'noncesizes', 'ivsizes',
        'supportedkeysizes', 'supportedblocksizes', 'supportednoncesizes',
        'supportedivsizes', 'notes'
      ];
      if (lowerName && knownMetadataProps.includes(lowerName)) {
        return this.inferTypeFromName(propName);
      }

      // Case 0: null literal - use dynamic type
      // When property is initialized to null, use dynamic to allow:
      //   1. Null assignment without type mismatch
      //   2. Property access (for object literals like { k1, k2, k3 })
      //   3. Later assignments of any type (string, object, etc.)
      // Name-based inference would default to uint for unknown names, which doesnt support null
      if (initialValue.type === 'Literal' && initialValue.value === null) {
        return CSharpType.Dynamic();
      }

      // Case 1: Value is an Identifier - check if it's a constructor parameter
      if (initialValue.type === 'Identifier') {
        const paramName = initialValue.name;
        const params = constructorNode?.value?.params || constructorNode?.params || [];

        for (const param of params) {
          const pName = param.name || param.left?.name;
          if (pName === paramName) {
            // Check for type annotation or infer from name/default
            const lowerName = pName.toLowerCase();
            if (lowerName === 'isinverse' || lowerName === 'inverse') {
              return CSharpType.Bool();
            }
            if (lowerName === 'algorithm' || lowerName === 'algo') {
              return new CSharpType('Algorithm');
            }
            // Check for default value type
            const defaultValue = param.right || param.defaultValue;
            if (defaultValue) {
              if (typeof defaultValue.value === 'boolean') return CSharpType.Bool();
              if (typeof defaultValue.value === 'number') return CSharpType.Int();
              if (typeof defaultValue.value === 'string') return CSharpType.String();
            }
          }
        }
      }

      // Case 2: Call expression - check for Array.Empty<T>() pattern
      if (initialValue.type === 'CallExpression') {
        const callee = initialValue.callee;

        // Handle Array.Empty<T>() or similar patterns
        if (callee?.type === 'MemberExpression' && callee.object?.name === 'Array') {
          if (callee.property?.name === 'Empty') {
            // Check for type arguments
            if (initialValue.typeArguments?.length > 0) {
              const elemType = this.mapType(initialValue.typeArguments[0]) || CSharpType.Byte();
              return CSharpType.Array(elemType);
            }
            return CSharpType.Array(CSharpType.Byte());
          }
        }

        // Handle new Array() or Array.from() - use uint[] for crypto code
        if (callee?.name === 'Array' || (callee?.type === 'Identifier' && callee.name === 'Array')) {
          return CSharpType.Array(CSharpType.UInt());
        }
      }

      // Case 3: Array literal []
      if (initialValue.type === 'ArrayExpression') {
        if (initialValue.elements?.length > 0) {
          const elemType = this.inferExpressionType(initialValue.elements[0]);
          return elemType ? CSharpType.Array(elemType) : CSharpType.Array(CSharpType.Byte());
        }
        // Empty array - use name inference
        const nameType = this.inferTypeFromName(propName);
        if (nameType?.isArray) return nameType;
        return CSharpType.Array(CSharpType.Byte());
      }

      // Case 4: Try general expression type inference
      // Use inferFullExpressionType to handle IL AST nodes (ArrayCreation, TypedArrayCreation, etc.)
      const exprType = this.inferFullExpressionType(initialValue);
      if (exprType && exprType.name !== 'object') return exprType;

      // Case 5: Fall back to name-based inference
      return CSharpType.Dynamic();
    }

    transformClassDeclaration(node, targetClass) {
      const csClass = new CSharpClass(node.id.name);

      // Extract base class name - handle both Identifier and MemberExpression
      // e.g., "BlockCipherAlgorithm" or "AlgorithmFramework.BlockCipherAlgorithm"
      const extractClassName = (superClass) => {
        if (!superClass) return null;
        if (superClass.type === 'Identifier') return superClass.name;
        if (superClass.type === 'MemberExpression') {
          // Get the rightmost property name (e.g., BlockCipherAlgorithm from AlgorithmFramework.BlockCipherAlgorithm)
          return superClass.property?.name || superClass.property?.value || null;
        }
        return null;
      };

      const baseClassName = extractClassName(node.superClass);

      if (node.superClass && baseClassName) {
        csClass.baseClass = new CSharpType(baseClassName);
      } else if (node.superClass) {
        csClass.baseClass = new CSharpType('object');
      }

      // Track algorithm class for instance constructor parameter typing
      // Check if this is an Algorithm class (vs Instance class) by:
      // 1. Class name pattern (ends with Algorithm/Compression/Cipher/Hash/etc.) but NOT Instance
      // 2. Base class is an Algorithm type (like CompressionAlgorithm) but NOT an Instance type (like IAlgorithmInstance)
      const className = node.id.name;
      const isInstanceClass = /Instance$/.test(className) || (baseClassName && /Instance$/.test(baseClassName));
      const isAlgorithmClass = !isInstanceClass && (
        /Algorithm$|Compression$|Cipher$|Hash$|Checksum$|Encoding$|Random$/.test(className) ||
        (baseClassName && /Algorithm$|Cipher$|Hash$|Checksum$|Encoding$|Random$/.test(baseClassName))
      );

      if (isAlgorithmClass) {
        this.parentAlgorithmClass = className;
      }

      // Transform class body - handle different body structures
      const classBody = node.body?.body || node.body || [];
      if (!Array.isArray(classBody)) {
        console.error(`Class ${node.id?.name} has unexpected body structure`);
        targetClass.nestedTypes.push(csClass);
        return;
      }

      // Set current class EARLY for method signature registration
      // This is needed so that property type inference from method calls works
      const prevClass = this.currentClass;
      this.currentClass = csClass;
      // Clear method-conflicting properties map for new class
      this.methodConflictingProperties.clear();

      // Pre-register all method signatures BEFORE constructor property processing
      // This allows property assignments like this.RoundKeys = this._expandKey(key)
      // to correctly infer type from method return type
      const methodNodes = [];
      for (const item of classBody) {
        if (item.type === 'MethodDefinition' && item.kind !== 'constructor' && item.kind !== 'get' && item.kind !== 'set') {
          const methodName = item.key.name;
          // Pre-register signature so property type inference can use it
          this.preRegisterMethodSignature(methodName, item.value, null);
          methodNodes.push({ name: methodName, funcNode: item.value });
        }
      }

      // Refine return types now that all methods are registered
      // This handles cases where method A calls method B, but B is defined after A
      this.refineMethodReturnTypes(methodNodes);

      // First pass: Find constructor and collect instance property assignments
      const constructorNode = classBody.find(item =>
        item.type === 'MethodDefinition' && item.kind === 'constructor'
      );

      // Pre-collect accessor property names to identify backing fields
      const accessorPropertyNames = new Set();
      for (const item of classBody) {
        if (item.type === 'MethodDefinition' && (item.kind === 'get' || item.kind === 'set')) {
          const propName = item.key?.name;
          if (propName) {
            accessorPropertyNames.add(this.toPascalCase(propName));
          }
        }
      }

      // Pre-collect method names (in PascalCase) to avoid generating properties that conflict with methods
      const methodNamesSet = new Set();
      for (const item of classBody) {
        if (item.type === 'MethodDefinition' && item.kind !== 'constructor' && item.kind !== 'get' && item.kind !== 'set') {
          methodNamesSet.add(this.toPascalCase(item.key.name));
        }
      }

      if (constructorNode) {
        const ctorProperties = this.collectConstructorPropertyAssignments(constructorNode, baseClassName);

        // Generate auto-property declarations for each collected property
        for (const [propName, propInfo] of ctorProperties) {
          const csPropName = this.toPascalCase(propName);

          // Check if method with same name exists (e.g., Result() method vs this.Result property)
          // In this case, create a private backing field with underscore prefix instead of skipping
          if (methodNamesSet.has(csPropName)) {
            // Generate a private backing field for the property to avoid conflict with method
            const backingFieldName = '_' + propName.charAt(0).toLowerCase() + propName.slice(1);
            let propType = this.inferPropertyType(propInfo.initialValue, constructorNode, propName);
            if (propType) propType.isNullable = true;

            // Register the backing field name for transforming this.propName references
            this.classFieldTypes.set(csPropName, propType);
            this.classFieldTypes.set(backingFieldName, propType);
            // Register the conflict so transformThisPropertyAccess knows to use the backing field
            this.methodConflictingProperties.set(csPropName, backingFieldName);

            const field = new CSharpField(backingFieldName, propType);
            field.accessModifier = 'private';
            if (propInfo.initialValue) {
              field.initializer = this.transformExpression(propInfo.initialValue);
            }
            csClass.members.push(field);
            continue;
          }

          // Check if property already declared (e.g., via getter/setter)
          const existingProp = csClass.members.find(m =>
            (m instanceof CSharpProperty || m.nodeType === 'Property') && m.name === csPropName
          );
          if (existingProp) continue;

          // Check for backing fields (e.g., _key for accessor 'key')
          // If property name starts with underscore and the non-underscore version has an accessor
          if (propName.startsWith('_')) {
            const accessorName = this.toPascalCase(propName.substring(1));
            if (accessorPropertyNames.has(accessorName)) {
              // This is a backing field - infer type from the accessor property, not the initial value
              // First try to get the type from the accessor, then fall back to inference
              let propType = null;

              // Find the accessor getter or setter to determine type
              for (const item of classBody) {
                if (item.type === 'MethodDefinition' && item.key?.name === propName.substring(1)) {
                  if (item.kind === 'get') {
                    propType = this.inferReturnType(item.value);
                  } else if (item.kind === 'set' && item.value?.params?.[0]) {
                    propType = this.inferParameterType(item.value.params[0]);
                  }
                  if (propType) break;
                }
              }

              // Fall back to property name-based inference, then initial value
              if (!propType) {
                propType = this.inferTypeFromName(propName.substring(1)) ||
                           this.inferPropertyType(propInfo.initialValue, constructorNode, propName);
              }

              // Make nullable if it can be null (for reference types)
              if (propType) {
                propType.isNullable = true;
              }

              this.classFieldTypes.set(csPropName, propType);

              const field = new CSharpField(csPropName, propType);
              field.accessModifier = 'private';
              // DON'T use initialValue for backing fields - the initialValue comes from
              // the setter body which references the setter parameter (e.g., shiftAmount)
              // that doesn't exist at field initialization time.
              // The setter will properly initialize the field when called.
              csClass.members.push(field);
              continue;
            }
          }

          // Infer type from initial value
          let propType = this.inferPropertyType(propInfo.initialValue, constructorNode, propName);

          // Register field type for this.propName lookups in constructor body
          // This is crucial so that transformAssignmentExpression can find the type
          // when processing the actual assignment this.propName = value
          this.classFieldTypes.set(csPropName, propType);

          // Create auto-property
          const prop = new CSharpProperty(csPropName, propType);
          prop.hasGetter = true;
          prop.hasSetter = true;
          prop.getterBody = null; // Auto-property
          prop.setterBody = null;
          csClass.members.push(prop);
        }
      }

      // Transform all class members (signatures already pre-registered above)
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
            // Only set isStatic from source if this isn't an override method
            // (override methods must be instance methods, not static)
            if (!inheritedSig)
              method.isStatic = item.static;
            csClass.members.push(method);
          }
        } else if (item.type === 'PropertyDefinition' || item.type === 'ClassProperty') {
          const field = this.transformClassProperty(item, baseClassName);
          if (field) csClass.members.push(field);
        } else if (item.type === 'StaticBlock') {
          // Static initialization block - transform to static constructor
          const staticCtor = this.transformStaticBlock(item, csClass.name);
          if (staticCtor) csClass.members.push(staticCtor);
        }
      }

      // Restore previous class context
      this.currentClass = prevClass;

      // Third pass: Collect property assignments from ALL methods and declare missing ones
      const allPropertyAssignments = this.collectAllMethodPropertyAssignments(classBody, baseClassName);
      for (const [propName, propInfo] of allPropertyAssignments) {
        const csPropName = this.toPascalCase(propName);

        // Check if property, field, or method already declared with same name
        // This prevents generating a property that conflicts with an existing method (e.g., Result property vs Result() method)
        const existingMember = csClass.members.find(m =>
          (m instanceof CSharpProperty || m.nodeType === 'Property' ||
           m instanceof CSharpField || m.nodeType === 'Field' ||
           m instanceof CSharpMethod || m.nodeType === 'Method') && m.name === csPropName
        );
        if (existingMember) continue;

        // Check for backing fields (e.g., _key for accessor 'key')
        // If property name starts with underscore and the non-underscore version has an accessor
        if (propName.startsWith('_')) {
          const accessorName = this.toPascalCase(propName.substring(1));
          if (accessorPropertyNames.has(accessorName)) {
            // This is a backing field - infer type from the accessor property, not the initial value
            let propType = null;

            // Find the accessor getter or setter to determine type
            for (const item of classBody) {
              if (item.type === 'MethodDefinition' && item.key?.name === propName.substring(1)) {
                if (item.kind === 'get') {
                  propType = this.inferReturnType(item.value);
                } else if (item.kind === 'set' && item.value?.params?.[0]) {
                  propType = this.inferParameterType(item.value.params[0]);
                }
                if (propType) break;
              }
            }

            // Fall back to property name-based inference, then initial value
            if (!propType) {
              propType = this.inferTypeFromName(propName.substring(1)) ||
                         (propInfo.initialValue ? this.inferExpressionType(propInfo.initialValue) : null) ||
                         CSharpType.Dynamic();
            }

            // Make nullable if it can be null (for reference types)
            if (propType && !propType.isPrimitive) {
              propType.isNullable = true;
            }

            this.classFieldTypes.set(csPropName, propType);

            const field = new CSharpField(csPropName, propType);
            field.accessModifier = 'private';
            // DON'T use initialValue for backing fields - the initialValue comes from
            // the setter body which references the setter parameter that doesn't exist
            // at field initialization time. The setter will initialize the field.
            csClass.members.unshift(field);
            continue;
          }
        }

        // Infer type from initial value
        let propType = propInfo.initialValue ?
          this.inferExpressionType(propInfo.initialValue) || CSharpType.Dynamic() :
          CSharpType.Dynamic();

        // Register field type
        this.classFieldTypes.set(csPropName, propType);

        // Create auto-property
        const prop = new CSharpProperty(csPropName, propType);
        prop.hasGetter = true;
        prop.hasSetter = true;
        prop.getterBody = null;
        prop.setterBody = null;
        csClass.members.unshift(prop); // Add at beginning so declarations come before methods
      }

      targetClass.nestedTypes.push(csClass);
    }

    /**
     * Collect all this.X = ... assignments from all methods in a class
     * This catches properties assigned in methods other than the constructor
     */
    collectAllMethodPropertyAssignments(classBody, baseClassName = null) {
      const properties = new Map();

      const knownBaseProps = [
        'name', 'description', 'inventor', 'year', 'category', 'subcategory',
        'securitystatus', 'complexity', 'country', 'checksumsize', 'documentation',
        'notes', 'tests', 'references', 'knownvulnerabilities', 'config',
        'supportedkeysizes', 'supportedblocksizes',
        'algorithm', 'a', 'b', 'key', 'iv', 'nonce',
        'salt', 'iterations', 'outputlength', 'outputsize', 'seed'
      ];

      for (const item of classBody) {
        if (item.type !== 'MethodDefinition') continue;

        // Get method body statements
        const body = item.value?.body?.body || item.body?.statements || [];

        // Recursively collect this.X = ... assignments
        this._collectThisAssignments(body, properties, knownBaseProps, baseClassName);
      }

      return properties;
    }

    /**
     * Recursively collect this.X = ... assignments from statements
     */
    _collectThisAssignments(statements, properties, knownBaseProps, baseClassName) {
      if (!Array.isArray(statements)) return;

      for (const stmt of statements) {
        if (!stmt) continue;

        // Handle ExpressionStatement with AssignmentExpression
        if (stmt.type === 'ExpressionStatement') {
          const expr = stmt.expression;
          if (expr?.type === 'AssignmentExpression' && expr.operator === '=') {
            const propName = this._extractThisPropertyName(expr.left);
            if (propName && !knownBaseProps.includes(propName.toLowerCase())) {
              // Skip inherited properties
              if (baseClassName) {
                const inheritedType = this.getInheritedPropertyType(baseClassName, this.toPascalCase(propName));
                if (inheritedType) continue;
              }
              if (!properties.has(propName)) {
                properties.set(propName, { name: propName, initialValue: expr.right });
              }
            }
          }
        }

        // Handle IfStatement directly
        if (stmt.type === 'IfStatement') {
          if (stmt.consequent?.body) {
            this._collectThisAssignments(stmt.consequent.body, properties, knownBaseProps, baseClassName);
          } else if (stmt.consequent) {
            this._collectThisAssignments([stmt.consequent], properties, knownBaseProps, baseClassName);
          }
          if (stmt.alternate) {
            if (stmt.alternate.type === 'IfStatement') {
              this._collectThisAssignments([stmt.alternate], properties, knownBaseProps, baseClassName);
            } else if (stmt.alternate.body) {
              this._collectThisAssignments(stmt.alternate.body, properties, knownBaseProps, baseClassName);
            } else {
              this._collectThisAssignments([stmt.alternate], properties, knownBaseProps, baseClassName);
            }
          }
          continue; // Already handled, skip other checks
        }

        // Recurse into other blocks (for, while, etc.)
        if (stmt.consequent?.body) this._collectThisAssignments(stmt.consequent.body, properties, knownBaseProps, baseClassName);
        if (stmt.body?.body) this._collectThisAssignments(stmt.body.body, properties, knownBaseProps, baseClassName);
        if (stmt.body && Array.isArray(stmt.body)) this._collectThisAssignments(stmt.body, properties, knownBaseProps, baseClassName);
        if (stmt.block?.body) this._collectThisAssignments(stmt.block.body, properties, knownBaseProps, baseClassName);
      }
    }

    /**
     * Extract property name from this.X access pattern
     */
    _extractThisPropertyName(node) {
      if (!node) return null;

      if (node.type === 'ThisPropertyAccess') {
        return node.property?.name || node.property;
      }

      if (node.type === 'MemberExpression') {
        if (node.object?.type === 'ThisExpression' || node.object?.name === 'this') {
          return node.property?.name || node.property?.value;
        }
      }

      return null;
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
        const defaultParams = []; // Track defaults for constructor
        for (const param of methodNode.value.params) {
          let rawName, defaultValue;

          // Handle parameters with default values
          // Format 1: AssignmentPattern (standard ESTree)
          // Format 2: Identifier with defaultValue property (custom parser)
          if (param.type === 'AssignmentPattern') {
            rawName = param.left?.name || 'param';
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            rawName = param.name || 'param';
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            rawName = param.name || param.left?.name || 'param';
            defaultValue = null;
          }

          const paramName = this.escapeReservedKeyword(rawName);

          // Look up property type from base class
          let paramType = null;
          if (baseClassName) {
            const propType = this.getInheritedPropertyType(baseClassName, this.toPascalCase(rawName));
            if (propType) {
              paramType = this.mapTypeFromKnowledge(propType);
            }
          }

          // Framework-specific constructor parameter inference
          if (!paramType) {
            const lowerName = rawName.toLowerCase();
            // Common framework constructor parameter patterns
            if (lowerName === 'algorithm' || lowerName === 'algo') {
              // Use the tracked algorithm class name if available (e.g., LZ77Compression instead of Algorithm)
              // This allows accessing specific algorithm properties in the constructor
              const algorithmClassName = this.parentAlgorithmClass || 'Algorithm';
              paramType = new CSharpType(algorithmClassName);
            } else if (lowerName === 'isinverse' || lowerName === 'inverse') {
              paramType = CSharpType.Bool();
            } else if (lowerName === 'config' || lowerName === 'configuration') {
              paramType = CSharpType.Dynamic(); // Use dynamic for late-bound property access
            } else if (lowerName === 'variant' || lowerName === 'mode') {
              paramType = CSharpType.String();
            }
          }

          // Fall back to name-based inference
          if (!paramType) {
            paramType = this.inferParameterType(rawName) || CSharpType.Object();
          }

          // When there's a default value, ensure type compatibility
          // If the inferred type doesn't match the default value type, use the default value's type
          if (defaultValue) {
            const defaultType = this.getNodeType(defaultValue);
            if (defaultType) {
              // Check for type mismatch between parameter type and default value
              const isParamNumeric = ['byte', 'sbyte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'float', 'double'].includes(paramType?.name);
              const isDefaultString = defaultType.name === 'string';
              const isDefaultNumeric = ['byte', 'sbyte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'float', 'double'].includes(defaultType.name);
              const isParamString = paramType?.name === 'string';

              // If parameter is numeric but default is a string, use string type
              if (isParamNumeric && isDefaultString) {
                paramType = CSharpType.String();
              }
              // If parameter is string but default is numeric, keep string but convert default
              else if (isParamString && isDefaultNumeric && defaultValue.nodeType === 'Literal') {
                defaultValue = CSharpLiteral.String(String(defaultValue.value));
              }
            }
          }

          const csParam = new CSharpParameter(paramName, paramType);
          if (defaultValue) {
            csParam.defaultValue = defaultValue;
            defaultParams.push(defaultValue);
          }
          ctor.parameters.push(csParam);
        }

        // Store constructor defaults for later use in static member initialization
        if (defaultParams.length > 0) {
          this.constructorDefaultParams.set(csClass.name, defaultParams);
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

          // Also handle ParentConstructorCall from IL transformer
          const isParentCtorCall = stmt.type === 'ExpressionStatement' &&
              stmt.expression?.type === 'ParentConstructorCall';

          if (isSuperCall) {
            // Wrap arguments in object expected by emitter
            const superArgs = (stmt.expression.arguments || []).map(a => this.transformExpression(a));
            ctor.baseCall = { arguments: superArgs };
            continue;
          }

          if (isParentCtorCall) {
            // Handle IL-transformed parent constructor call
            const superArgs = (stmt.expression.arguments || []).map(a => this.transformExpression(a));
            ctor.baseCall = { arguments: superArgs };
            continue;
          }

          const csStmt = this.transformStatement(stmt);
          if (csStmt) {
            // Handle case where transformStatement returns an array (e.g., multiple variable declarations)
            if (Array.isArray(csStmt)) {
              ctorBody.statements.push(...csStmt);
            } else {
              ctorBody.statements.push(csStmt);
            }
          }
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

        // Fall back to inference - use property name first for better type accuracy
        if (!propType) {
          // First try inferring from the property name itself (e.g., 'key' -> byte[])
          const originalPropName = methodNode.key?.name || '';
          propType = this.inferTypeFromName(originalPropName);

          // If that just returns default uint, try more specific inference
          if (!propType || (propType.name === 'uint' && !originalPropName.toLowerCase().includes('uint'))) {
            propType = isGetter ?
              this.inferReturnType(methodNode.value) || CSharpType.Object() :
              this.inferParameterType(methodNode.value?.params?.[0]) || CSharpType.Object();
          }
        }
        prop = new CSharpProperty(propName, propType);
        prop.isStatic = methodNode.static;
        isNewProperty = true;
      }

      // Transform accessor body
      const bodyBlock = new CSharpBlock();
      if (methodNode.value?.body?.body) {
        // For setters, track the JS parameter name so we can replace it with 'value'
        const prevSetterParam = this.currentSetterParam;
        if (!isGetter && methodNode.value?.params?.[0]?.name) {
          this.currentSetterParam = methodNode.value.params[0].name;
        }

        for (const stmt of methodNode.value.body.body) {
          const csStmt = this.transformStatement(stmt);
          if (csStmt) {
            // Handle case where transformStatement returns an array (e.g., multiple variable declarations)
            if (Array.isArray(csStmt)) {
              bodyBlock.statements.push(...csStmt);
            } else {
              bodyBlock.statements.push(csStmt);
            }
          }
        }

        // Restore previous setter param (for nested cases)
        this.currentSetterParam = prevSetterParam;
      }

      if (isGetter) {
        prop.hasGetter = true;
        prop.getterBody = bodyBlock;
      } else {
        prop.hasSetter = true;
        prop.setterBody = bodyBlock;
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

    transformStaticBlock(staticBlockNode, className = null) {
      // ES2022 static initialization blocks -> C# static constructor
      // static { code } -> static ClassName() { code }
      // StaticBlock node has a body property that is a BlockStatement
      // So we need to access node.body.body to get the actual statements array
      const statements = staticBlockNode.body?.body || staticBlockNode.body || [];

      // Create a CSharpBlock for the constructor body
      const block = new CSharpBlock();

      if (Array.isArray(statements)) {
        for (const stmt of statements) {
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            // Handle case where transformStatement returns an array (e.g., multiple variable declarations)
            if (Array.isArray(transformed)) {
              block.statements.push(...transformed);
            } else {
              block.statements.push(transformed);
            }
          }
        }
      }

      // Create a static constructor (constructor with static modifier)
      // Use provided className parameter, fallback to currentClass, then 'UnknownClass'
      const ctorClassName = className || this.currentClass?.name || 'UnknownClass';
      const ctor = new CSharpConstructor(ctorClassName);
      ctor.isStatic = true;
      ctor.body = block;

      return ctor;
    }

    transformClassExpression(node) {
      // ClassExpression -> C# doesn't have anonymous classes directly
      // Use a lambda or local class pattern
      const className = node.id?.name || 'AnonymousClass';
      const classDecl = new CSharpClass(className);

      if (node.superClass) {
        classDecl.baseType = this.transformExpression(node.superClass);
      }

      if (node.body?.body) {
        for (const member of node.body.body) {
          const transformed = this.transformClassMember(member);
          if (transformed)
            classDecl.members.push(transformed);
        }
      }

      return classDecl;
    }

    transformYieldExpression(node) {
      // yield -> yield return in C# (represented as return for now)
      const argument = node.argument ? this.transformExpression(node.argument) : CSharpLiteral.Null();
      // Use a return statement as placeholder since CSharpYieldReturn doesn't exist
      return new CSharpReturn(argument);
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
        // Handle mapped types that are arrays (e.g., 'byte[]' from 'Uint8Array')
        if (mapped.endsWith('[]')) {
          const elementTypeName = mapped.slice(0, -2);
          return CSharpType.Array(new CSharpType(elementTypeName));
        }
        return new CSharpType(mapped);
      }

      // Algorithm-specific config types (e.g., AdlerConfig, SHA1Config) are custom JSDoc typedefs
      // Map them to 'dynamic' since they're just plain objects in JavaScript
      if (typeName.endsWith('Config')) {
        return CSharpType.Dynamic();
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

      // Names ending with "Size" or "Length" are integers - check FIRST to avoid false byte[] matches
      // Examples: keySize, blockSize, outputSize, messageLength (not arrays despite containing 'key', 'block', 'output', 'message')
      if (lowerName.endsWith('size') || lowerName.endsWith('length')) {
        return CSharpType.Int();
      }

      // Array-related parameter names (check before single byte)
      // "keyBytes", "dataBytes" etc. should return byte[] not byte
      if (lowerName.includes('key') || lowerName.includes('data') || lowerName.includes('input') ||
          lowerName.includes('output') || lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('counter') || lowerName.includes('state') ||
          lowerName.includes('nonce') || lowerName.includes('iv') || lowerName.includes('tag') ||
          lowerName.includes('message') || lowerName.includes('text') || lowerName.includes('plain') ||
          lowerName.includes('cipher') || lowerName.includes('digest') || lowerName.includes('hash'))
        return CSharpType.Array(CSharpType.Byte());
      // Single byte parameter (must come after array check)
      if (lowerName.includes('byte') || lowerName === 'b' || lowerName.match(/^b\d$/))
        return CSharpType.Byte();
      if (lowerName.includes('shift') || lowerName.includes('position') || lowerName.includes('index') ||
          lowerName === 'n' || lowerName === 'i' || lowerName === 'j')
        return CSharpType.Int();
      if (lowerName.includes('value') || lowerName.includes('word'))
        return CSharpType.UInt();
      // Boolean-like parameter names (common in crypto: encrypt/decrypt flags)
      if (lowerName.includes('decrypt') || lowerName.includes('encrypt') || lowerName.includes('inverse') ||
          lowerName.includes('encode') || lowerName.includes('decode') || lowerName.startsWith('is') ||
          lowerName.startsWith('has') || lowerName.startsWith('can') || lowerName.startsWith('should'))
        return CSharpType.Bool();

      // String-like parameter names (common for variant selectors, modes, formats)
      if (lowerName.includes('variant') || lowerName.includes('mode') || lowerName.includes('format') ||
          lowerName.includes('name') || lowerName.includes('type') || lowerName.includes('algorithm') ||
          lowerName.includes('string') || lowerName.includes('str'))
        return CSharpType.String();

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
              // For crypto code, use uint as default for non-negative values
              // This avoids narrowing issues with bitwise operations which return uint
              if (node.value < 0 && node.value >= -2147483648) return CSharpType.Int();
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
            // new Array(size) defaults to uint[] for crypto code (32-bit values are common)
            if (typeName === 'Array') {
              return CSharpType.Array(CSharpType.UInt());
            }
            // Typed arrays map to their specific element types
            if (typeName === 'Uint8Array') {
              return CSharpType.Array(CSharpType.Byte());
            }
            if (typeName === 'Uint16Array') {
              return CSharpType.Array(CSharpType.UShort());
            }
            if (typeName === 'Uint32Array') {
              return CSharpType.Array(CSharpType.UInt());
            }
            // Handle AlgorithmFramework types like KeySize, LinkItem, TestCase, Vulnerability
            if (['KeySize', 'LinkItem', 'TestCase', 'Vulnerability'].includes(typeName)) {
              return new CSharpType(typeName);
            }
            // Return the constructor type for other custom types
            return new CSharpType(this.toPascalCase(typeName));
          }
          // Handle MemberExpression callees like new AlgorithmFramework.KeySize(...)
          if (node.callee.type === 'MemberExpression') {
            const propName = node.callee.property?.name || node.callee.property?.value;
            if (propName) {
              // Handle AlgorithmFramework types
              if (['KeySize', 'LinkItem', 'TestCase', 'Vulnerability'].includes(propName)) {
                return new CSharpType(propName);
              }
              // Return the constructor type for other custom types
              return new CSharpType(this.toPascalCase(propName));
            }
          }
          return null;

        case 'ObjectExpression':
          // Object literals are typed as dynamic to allow property access
          return CSharpType.Dynamic();

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
                let initType = this.inferFullExpressionType(decl.init);
                // For empty arrays, use name-based inference (output, result, data -> byte[])
                const isEmptyArray = (decl.init.type === 'ArrayExpression' || decl.init.type === 'ArrayLiteral') &&
                                     (!decl.init.elements || decl.init.elements.length === 0);
                if (isEmptyArray) {
                  const nameBasedType = this.inferTypeFromName(varName);
                  if (nameBasedType?.isArray) {
                    initType = nameBasedType;
                  }
                }
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
          // Also handle type upgrades for already-initialized variables
          // If a variable was initialized to int (e.g., left = 0) but later assigned uint,
          // upgrade the type to uint to avoid narrowing conversion errors
          const currentType = this.getVariableType(varName);
          if (currentType?.name === 'int') {
            const assignedType = this.inferFullExpressionType(node.right);
            if (assignedType?.name === 'uint') {
              // Upgrade from int to uint - the later assignment requires uint
              this.registerVariableType(varName, CSharpType.UInt());
            }
          }
        }

        // Handle array.push(...args) to infer element type from pushed values
        // This catches: result.push(...bytes) where bytes is byte[]
        if (node.type === 'CallExpression' &&
            node.callee?.type === 'MemberExpression' &&
            node.callee.property?.name === 'push' &&
            node.callee.object?.type === 'Identifier' &&
            node.arguments?.length > 0) {
          const varName = node.callee.object.name;
          // Check what's being pushed and update array element type
          for (const arg of node.arguments) {
            if (arg?.type === 'SpreadElement') {
              // result.push(...bytes) - bytes is an array, so element type = bytes' element type
              const spreadType = this.inferFullExpressionType(arg.argument);
              if (spreadType?.isArray && spreadType.elementType) {
                // Update the variable's array type to use this element type
                const currentType = this.getVariableType(varName);
                if (currentType?.isArray && currentType.elementType?.name === 'uint' &&
                    spreadType.elementType.name === 'byte') {
                  // Override uint[] default with byte[] from spread
                  this.registerVariableType(varName, CSharpType.Array(spreadType.elementType));
                }
              }
            } else {
              // result.push(value) - value is an element, so element type = value's type
              const elemType = this.inferFullExpressionType(arg);
              if (elemType && elemType.name !== 'object') {
                const currentType = this.getVariableType(varName);
                // If array was defaulted to uint[] but we're pushing bytes, update it
                if (currentType?.isArray && currentType.elementType?.name === 'uint' &&
                    elemType.name === 'byte') {
                  this.registerVariableType(varName, CSharpType.Array(elemType));
                }
              }
            }
          }
        }

        // Handle IL AST ArrayConcat nodes (from push(...spread))
        // This catches: result = result.Concat(bytes) where bytes is byte[]
        if (node.type === 'ArrayConcat' &&
            node.array?.type === 'Identifier') {
          const varName = node.array.name;
          for (const arr of (node.arrays || [])) {
            const arrType = this.inferFullExpressionType(arr);
            if (arrType?.isArray && arrType.elementType) {
              const currentType = this.getVariableType(varName);
              // If array was defaulted to uint[] but we're concatenating byte[], update it
              if (currentType?.isArray && currentType.elementType?.name === 'uint' &&
                  arrType.elementType.name === 'byte') {
                this.registerVariableType(varName, CSharpType.Array(arrType.elementType));
              }
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
    inferReturnType(bodyNode, paramTypeMap = null) {
      if (!bodyNode) return null;

      const returnTypes = [];

      // Collect variable declarations for tracing return identifiers
      const varDeclarations = new Map();
      const collectVarDeclarations = (node) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'VariableDeclaration') {
          for (const decl of node.declarations || []) {
            if (decl.id?.name && decl.init) {
              varDeclarations.set(decl.id.name, decl.init);
            }
          }
        }
        for (const key of Object.keys(node)) {
          if (key === 'type') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            for (const item of child) collectVarDeclarations(item);
          } else if (child && typeof child === 'object') {
            collectVarDeclarations(child);
          }
        }
      };
      collectVarDeclarations(bodyNode);

      const collectReturns = (node) => {
        if (!node) return;

        if (node.type === 'ReturnStatement' && node.argument) {
          // Check if returning an object expression - treat as tuple
          if (node.argument.type === 'ObjectExpression') {
            const props = node.argument.properties;
            const isSimpleTupleLike = props && props.length >= 2 &&
              props.every(p => p.type !== 'SpreadElement' && p.key && !p.computed);
            if (isSimpleTupleLike) {
              // Create tuple type from object properties
              const tupleElements = props.map(p => {
                const propName = this.toPascalCase(p.key.name || p.key.value);
                const propType = this.inferFullExpressionType(p.value) || CSharpType.UInt();
                return { name: propName, type: propType };
              });
              const typeStr = '(' + tupleElements.map(e => `${e.type.name} ${e.name}`).join(', ') + ')';
              const tupleType = new CSharpType(typeStr);
              tupleType.isTuple = true;
              tupleType.tupleElements = tupleElements;
              returnTypes.push(tupleType);
              return;
            }
          }

          let type = null;

          // For identifiers, first check parameter and variable type maps before falling back
          if (node.argument.type === 'Identifier') {
            const varName = node.argument.name;

            // First check if it's a parameter with known type
            if (paramTypeMap && paramTypeMap.has(varName)) {
              type = paramTypeMap.get(varName);
            } else {
              // Check if it's a local variable - trace to its declaration
              const initExpr = varDeclarations.get(varName);
              if (initExpr) {
                // If declaration is empty array [], use name-based inference
                // since empty arrays default to uint[] but variables like 'result', 'output' should be byte[]
                const isEmptyArray = (initExpr.type === 'ArrayExpression' || initExpr.type === 'ArrayLiteral') &&
                                     (!initExpr.elements || initExpr.elements.length === 0);
                if (isEmptyArray) {
                  type = this.inferTypeFromName(varName);
                } else {
                  type = this.inferFullExpressionType(initExpr);
                }
              }
            }
          }

          // Fall back to standard expression type inference
          if (!type || type.name === 'object') {
            type = this.inferFullExpressionType(node.argument);
          }

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
      const result = str.charAt(0).toUpperCase() + str.slice(1);
      return this.sanitizeIdentifier(result);
    }

    toCamelCase(str) {
      if (!str || typeof str !== 'string') return 'unknown';
      const result = str.charAt(0).toLowerCase() + str.slice(1);
      return this.sanitizeIdentifier(result);
    }

    /**
     * Sanitize C# identifiers - handles reserved keywords, invalid characters, and invalid starting characters
     * C# identifiers can only contain letters, digits, and underscores, and cannot start with a digit
     */
    sanitizeIdentifier(name) {
      if (!name) return name;

      // Remove quotes if present (e.g., 'CRC-8-SMBUS' -> CRC-8-SMBUS)
      name = name.replace(/^['"]|['"]$/g, '');

      // Replace hyphens and other invalid characters with underscores
      // Valid C# identifier chars: letters, digits, underscores
      name = name.replace(/[^a-zA-Z0-9_]/g, '_');

      // Handle identifiers starting with digits by prefixing with underscore
      if (/^[0-9]/.test(name))
        name = '_' + name;

      // Collapse multiple underscores
      name = name.replace(/_+/g, '_');

      // Remove trailing underscores
      name = name.replace(/_+$/, '');

      return this.escapeReservedKeyword(name);
    }

    /**
     * Get the type of a C# AST node
     * @param {object} node - C# AST node
     * @returns {CSharpType|null} The type of the node, or null if unknown
     */
    getNodeType(node) {
      if (!node) return null;

      // Direct type property (e.g., from CSharpCast)
      if (node.type && node.type.name) return node.type;

      // For literals, infer from value
      if (node.nodeType === 'Literal') {
        if (node.literalType === 'string') return CSharpType.String();
        if (node.literalType === 'char') return CSharpType.Char();
        if (node.literalType === 'bool') return CSharpType.Bool();
        if (typeof node.value === 'string') return CSharpType.String();
        if (typeof node.value === 'boolean') return CSharpType.Bool();
        if (typeof node.value === 'number') {
          if (Number.isInteger(node.value)) {
            if (node.value >= 0 && node.value <= 0xFFFFFFFF) return CSharpType.UInt();
            return CSharpType.Long();
          }
          return CSharpType.Double();
        }
        return null;
      }

      // For identifiers, look up in variable types
      if (node.nodeType === 'Identifier' && node.name) {
        return this.variableTypes.get(node.name) || null;
      }

      return null;
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

    // ===== IL AST Node Transformers =====

    /**
     * Transform ParentConstructorCall to C# : base(...) - handled in constructor context
     * When appearing outside constructor body (should not happen), return null
     */
    transformParentConstructorCall(node) {
      // In C#, parent constructor calls are part of constructor declaration ": base(...)"
      // They should be handled in transformConstructor, not here
      // If we get here, the call is in a non-constructor context - return null to skip it
      // The emitter will ignore null values
      return null;
    }

    /**
     * Transform ParentMethodCall to base.Method(...)
     */
    transformParentMethodCall(node) {
      const methodName = this.toPascalCase(node.method || 'Method');
      const args = (node.arguments || []).map(arg => this.transformExpression(arg)).filter(a => a);
      return new CSharpMethodCall(new CSharpBase(), methodName, args);
    }

    /**
     * Transform ThisMethodCall to this.Method(...)
     */
    transformThisMethodCall(node) {
      const methodName = this.toPascalCase(node.method || 'Method');
      const transformedArgs = (node.arguments || []).map(arg => this.transformExpression(arg)).filter(a => a);

      // Apply argument type casting based on method signature
      const calleeObject = { type: 'ThisExpression' };
      const castedArgs = this.castArgumentsToParameterTypes(
        calleeObject,
        methodName,
        transformedArgs,
        node.arguments || []
      );

      return new CSharpMethodCall(new CSharpThis(), methodName, castedArgs);
    }

    /**
     * Transform ThisPropertyAccess to this.Property
     * Uses backing field name if property conflicts with a method
     */
    transformThisPropertyAccess(node) {
      const propName = this.toPascalCase(node.property || 'Property');

      // Check if this property conflicts with a method and needs to use backing field
      if (this.methodConflictingProperties.has(propName)) {
        const backingFieldName = this.methodConflictingProperties.get(propName);
        return new CSharpMemberAccess(new CSharpThis(), backingFieldName);
      }

      return new CSharpMemberAccess(new CSharpThis(), propName);
    }

    /**
     * Transform rotation operations using OpCodes helper methods for compatibility
     * Uses OpCodes.RotL32/RotR32/RotL64/RotR64 which work with all .NET versions
     */
    transformRotation(node) {
      const value = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // Use OpCodes rotation methods for broad .NET compatibility
      // These are defined in the framework stubs and work everywhere
      let methodName;
      let castType;

      if (bits === 64) {
        methodName = isLeft ? 'RotL64' : 'RotR64';
        castType = CSharpType.ULong();
      } else if (bits === 32) {
        methodName = isLeft ? 'RotL32' : 'RotR32';
        castType = CSharpType.UInt();
      } else if (bits === 16) {
        methodName = isLeft ? 'RotL16' : 'RotR16';
        castType = CSharpType.UShort();
      } else {
        methodName = isLeft ? 'RotL8' : 'RotR8';
        castType = CSharpType.Byte();
      }

      const castValue = new CSharpCast(castType, value);
      return new CSharpMethodCall(
        new CSharpIdentifier('OpCodes'),
        methodName,
        [castValue, amount]
      );
    }

    /**
     * Transform PackBytes to OpCodes.PackXXYY method call
     * Uses OpCodes helper methods for correct type handling (returns uint/ulong)
     */
    transformPackBytes(node) {
      const rawArgs = node.arguments || node.bytes || [];
      const bits = node.bits || 32;
      const isBigEndian = node.endian === 'big';
      const byteCount = bits / 8;

      // Determine method name based on bit size and endianness
      const methodName = `Pack${bits}${isBigEndian ? 'BE' : 'LE'}`;

      // Check if we have a spread element (e.g., Pack32BE(...bytes))
      if (rawArgs.length === 1 && rawArgs[0]?.type === 'SpreadElement') {
        const spreadArg = this.transformExpression(rawArgs[0].argument);
        // Generate: OpCodes.Pack32BE(arr[0], arr[1], arr[2], arr[3]) or similar
        const indexAccesses = [];
        for (let i = 0; i < byteCount; ++i) {
          indexAccesses.push(new CSharpElementAccess(spreadArg, CSharpLiteral.Int(i)));
        }
        return new CSharpMethodCall(new CSharpIdentifier('OpCodes'), methodName, indexAccesses);
      }

      // Handle both IL AST (arguments array) and legacy (bytes property)
      // Cast all arguments to byte to avoid ambiguity with overloads
      const bytes = rawArgs.map(b => {
        const expr = this.transformExpression(b);
        // Cast literals to byte to ensure correct overload resolution
        // This handles cases like Pack32LE(data[0], data[1], 0, 0)
        // where data[0] is byte but 0 is int
        if (expr.nodeType === 'Literal' && typeof expr.value === 'number') {
          return new CSharpCast(CSharpType.Byte(), expr);
        }
        return expr;
      });

      if (bytes.length === 0) return CSharpLiteral.UInt(0);

      // Always use OpCodes method call for correct type handling
      // OpCodes.Pack32LE returns uint, Pack64LE returns ulong
      return new CSharpMethodCall(new CSharpIdentifier('OpCodes'), methodName, bytes);
    }

    /**
     * Transform UnpackBytes to inline byte array extraction
     * Creates: new byte[] { (byte)(v >> high), ..., (byte)(v) }
     */
    transformUnpackBytes(node) {
      // Handle both IL AST (arguments array) and legacy (value property)
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const bits = node.bits || 32;
      const isBigEndian = node.endian === 'big';
      const byteCount = bits / 8;

      // If a specific index is requested, extract single byte
      if (node.index !== undefined) {
        let shiftAmount;
        if (isBigEndian) {
          shiftAmount = (byteCount - 1 - node.index) * 8;
        } else {
          shiftAmount = node.index * 8;
        }
        let result = value;
        if (shiftAmount > 0) {
          result = new CSharpBinaryExpression(value, '>>', CSharpLiteral.Int(shiftAmount));
        }
        const masked = new CSharpBinaryExpression(result, '&', CSharpLiteral.Int(0xFF));
        return new CSharpCast(CSharpType.Byte(), masked);
      }

      // Generate full byte array: new byte[] { (byte)(v >> X), (byte)(v >> Y), ... }
      const elements = [];
      for (let i = 0; i < byteCount; ++i) {
        let shiftAmount;
        if (isBigEndian) {
          shiftAmount = (byteCount - 1 - i) * 8;
        } else {
          shiftAmount = i * 8;
        }
        let byteExpr = value;
        if (shiftAmount > 0) {
          byteExpr = new CSharpBinaryExpression(value, '>>', CSharpLiteral.Int(shiftAmount));
        }
        const masked = new CSharpBinaryExpression(byteExpr, '&', CSharpLiteral.Int(0xFF));
        elements.push(new CSharpCast(CSharpType.Byte(), masked));
      }

      return new CSharpArrayCreation(CSharpType.Byte(), null, elements);
    }

    /**
     * Transform ArrayLength to .Length or .Count
     */
    transformArrayLength(node) {
      const array = this.transformExpression(node.array);
      // Arrays use .Length, Lists use .Count
      // Default to Length for byte arrays
      return new CSharpMemberAccess(array, 'Length');
    }

    /**
     * Transform ArrayAppend to arr.Append(value).ToArray() or arr.Concat(value).ToArray()
     * Note: This creates a new array, caller must handle assignment if needed
     * Uses Concat when value is a SpreadElement or array type, Append for single elements
     */
    transformArrayAppend(node) {
      const array = this.transformExpression(node.array);

      // Check if value is a SpreadElement (from arr.push(...other))
      const isSpread = node.value && node.value.type === 'SpreadElement';
      const actualValue = isSpread ? node.value.argument : node.value;
      let value = this.transformExpression(actualValue);

      // Infer the array element type to properly cast the value
      const arrayType = this.inferFullExpressionType(node.array);
      const elementType = arrayType?.elementType;
      const valueType = this.inferFullExpressionType(actualValue);

      // Determine if we should use Concat (for arrays) or Append (for single elements)
      const useConcat = isSpread || (valueType && valueType.isArray);

      if (!useConcat) {
        // Cast value to element type if needed (e.g., int to byte for byte[])
        // In C#, byte operations (^, +, -, &, |) produce int, so always cast expressions to byte when appending to byte[]
        if (elementType && elementType.name !== 'object' && elementType.name !== 'dynamic') {
          const needsCast = (valueType && valueType.name !== elementType.name) ||
                            (elementType.name === 'byte' && actualValue.type === 'BinaryExpression');
          if (needsCast)
            value = new CSharpCast(elementType, value);
        }
      }

      // Use Concat for arrays, Append for single elements
      const methodName = useConcat ? 'Concat' : 'Append';
      const methodCall = new CSharpMethodCall(array, methodName, [value]);
      return new CSharpMethodCall(methodCall, 'ToArray', []);
    }

    /**
     * Transform ArrayAppend statement to arr = arr.Append(value).ToArray()
     * or arr = arr.Concat(value).ToArray() when appending arrays
     */
    transformArrayAppendToAssignment(node) {
      const target = this.transformExpression(node.array);

      // Check if value is a SpreadElement (from arr.push(...other))
      const isSpread = node.value && node.value.type === 'SpreadElement';
      const actualValue = isSpread ? node.value.argument : node.value;
      let value = this.transformExpression(actualValue);

      // Infer the array element type to properly cast the value
      const arrayType = this.inferFullExpressionType(node.array);
      const elementType = arrayType?.elementType;
      const valueType = this.inferFullExpressionType(actualValue);

      // Determine if we should use Concat (for arrays) or Append (for single elements)
      const useConcat = isSpread || (valueType && valueType.isArray);

      if (!useConcat) {
        // Cast value to element type if needed (e.g., int to byte for byte[])
        // In C#, byte operations (^, +, -, &, |) produce int, so always cast expressions to byte when appending to byte[]
        if (elementType && elementType.name !== 'object' && elementType.name !== 'dynamic') {
          const needsCast = (valueType && valueType.name !== elementType.name) ||
                            (elementType.name === 'byte' && actualValue.type === 'BinaryExpression');
          if (needsCast)
            value = new CSharpCast(elementType, value);
        }
      }

      // Build: arr = arr.Concat(value).ToArray() or arr = arr.Append(value).ToArray()
      const methodName = useConcat ? 'Concat' : 'Append';
      const methodCall = new CSharpMethodCall(target, methodName, [value]);
      const toArrayExpr = new CSharpMethodCall(methodCall, 'ToArray', []);
      const assignment = new CSharpAssignment(target, '=', toArrayExpr);
      return new CSharpExpressionStatement(assignment);
    }

    /**
     * Transform ArrayConcat statement to arr = arr.Concat(other).ToArray()
     * Used when push(...spread) is converted to ArrayConcat in IL AST
     */
    transformArrayConcatToAssignment(node) {
      const target = this.transformExpression(node.array);
      let result = target;

      for (const arr of (node.arrays || [])) {
        const other = this.transformExpression(arr);
        result = new CSharpMethodCall(result, 'Concat', [other]);
      }

      // Build: arr = arr.Concat(other).ToArray()
      const toArrayExpr = new CSharpMethodCall(result, 'ToArray', []);
      const assignment = new CSharpAssignment(target, '=', toArrayExpr);
      return new CSharpExpressionStatement(assignment);
    }

    /**
     * Transform ArraySlice to OpCodes.SliceArray for broad .NET compatibility
     * Uses helper methods instead of C# 8+ range syntax (arr[start..end])
     */
    transformArraySlice(node) {
      const array = this.transformExpression(node.array);

      // Check if a node represents a negative expression
      const isNegativeExpression = (n) => {
        if (!n) return false;
        // UnaryExpression with - operator: -ACE_TAG_SIZE
        if (n.type === 'UnaryExpression' && n.operator === '-') return true;
        // Negative literal: -16
        if (n.type === 'Literal' && typeof n.value === 'number' && n.value < 0) return true;
        // Cast wrapping negative expression
        if (n.type === 'Cast' && isNegativeExpression(n.expression || n.argument)) return true;
        return false;
      };

      // Extract positive value from negative expression
      const getPositiveExpression = (n) => {
        if (!n) return null;
        // UnaryExpression with - operator: -expr -> expr
        if (n.type === 'UnaryExpression' && n.operator === '-') {
          return this.transformExpression(n.argument);
        }
        // Negative literal: -16 -> 16
        if (n.type === 'Literal' && typeof n.value === 'number' && n.value < 0) {
          return CSharpLiteral.Int(Math.abs(n.value));
        }
        // Cast wrapping negative expression
        if (n.type === 'Cast') {
          const innerExpr = n.expression || n.argument;
          if (isNegativeExpression(innerExpr)) {
            return getPositiveExpression(innerExpr);
          }
        }
        return null;
      };

      // Ensure expression is cast to int for array indexing
      const ensureInt = (expr) => {
        if (!expr) return expr;
        if (expr.nodeType === 'BinaryExpression' ||
            (expr.nodeType === 'MemberAccess' && this.mightBeUint(expr)) ||
            (expr.nodeType === 'Identifier' && this.mightBeUint(expr))) {
          return new CSharpCast(CSharpType.Int(), expr);
        }
        return expr;
      };

      // Determine start index
      let startExpr;
      if (node.start && isNegativeExpression(node.start)) {
        // Negative start: arr.slice(-n) -> start = arr.Length - n
        const positiveStart = getPositiveExpression(node.start);
        startExpr = new CSharpBinaryExpression(
          new CSharpMemberAccess(array, 'Length'),
          '-',
          ensureInt(positiveStart)
        );
      } else {
        startExpr = node.start ? ensureInt(this.transformExpression(node.start)) : CSharpLiteral.Int(0);
      }

      // Determine end index
      let endExpr;
      if (node.end && isNegativeExpression(node.end)) {
        // Negative end: arr.slice(0, -n) -> end = arr.Length - n
        const positiveEnd = getPositiveExpression(node.end);
        endExpr = new CSharpBinaryExpression(
          new CSharpMemberAccess(array, 'Length'),
          '-',
          ensureInt(positiveEnd)
        );
      } else if (node.end) {
        endExpr = ensureInt(this.transformExpression(node.end));
      } else {
        // No end specified: arr.slice(start) -> end = arr.Length
        endExpr = new CSharpMemberAccess(array, 'Length');
      }

      // Use OpCodes.SliceArray for .NET compatibility
      return new CSharpMethodCall(
        new CSharpIdentifier('OpCodes'),
        'SliceArray',
        [array, startExpr, endExpr]
      );
    }

    /**
     * Check if an expression might produce uint type
     */
    mightBeUint(expr) {
      if (!expr) return false;
      // Check for known uint-returning property names
      if (expr.nodeType === 'MemberAccess') {
        const propName = expr.member?.name || expr.member || '';
        const lowerName = propName.toLowerCase();
        if (lowerName.includes('size') || lowerName.includes('rounds') ||
            lowerName.includes('delta') || lowerName === 'blocksize' ||
            lowerName === 'keysize') {
          return true;
        }
      }
      return false;
    }

    /**
     * Ensure an index expression is int type for C# array indexing
     * C# requires int for array indices, not uint
     * @param {Object} csExpr - Already-transformed C# expression
     * @param {Object} jsNode - Original JS AST node for type inference
     * @returns {Object} C# expression with (int) cast if needed
     */
    ensureIntIndex(csExpr, jsNode) {
      if (!csExpr) return csExpr;

      // Integer literals are already int
      if (csExpr.nodeType === 'Literal' && typeof csExpr.value === 'number') {
        return csExpr;
      }

      // For identifiers, check the registered variable type
      if (csExpr.nodeType === 'Identifier') {
        const name = csExpr.name || '';
        // Check registered variable type first
        const varType = this.getVariableType(name) || this.getVariableType(name.toLowerCase());
        if (varType) {
          if (varType.name === 'int' || varType.name === 'Int32') {
            return csExpr; // Already int, no cast needed
          }
          if (varType.name === 'uint' || varType.name === 'UInt32' ||
              varType.name === 'ulong' || varType.name === 'UInt64') {
            return new CSharpCast(CSharpType.Int(), csExpr);
          }
        }
      }

      // Infer type from original JS node to see if it might be uint
      const exprType = jsNode ? this.inferFullExpressionType(jsNode) : null;
      const needsCast = exprType?.name === 'uint' ||
                        exprType?.name === 'ulong' ||
                        this.mightBeUint(csExpr) ||
                        this.expressionMightBeUint(csExpr);

      if (needsCast) {
        return new CSharpCast(CSharpType.Int(), csExpr);
      }

      return csExpr;
    }

    /**
     * Check if a C# expression might be uint type
     */
    expressionMightBeUint(expr) {
      if (!expr) return false;

      // Binary expressions with bitwise ops often produce uint
      if (expr.nodeType === 'BinaryExpression') {
        const op = expr.operator;
        if (['&', '|', '^', '>>>', '>>', '<<'].includes(op)) {
          return true;
        }
        // Also check operands recursively
        return this.expressionMightBeUint(expr.left) || this.expressionMightBeUint(expr.right);
      }

      // Identifiers with uint-related names
      if (expr.nodeType === 'Identifier') {
        const name = expr.name?.toLowerCase() || '';
        if (name.includes('uint') || name === 'i' || name === 'j') {
          // i and j are typically int, but if they're used in uint context, need check
          return false;  // Assume int for common loop counters
        }
      }

      // Member access to uint properties
      if (expr.nodeType === 'MemberAccess') {
        return this.mightBeUint(expr);
      }

      return false;
    }

    /**
     * Transform ArrayFill to appropriate C# code
     * JavaScript: array.fill(value) returns the filled array
     * C#: Array.Fill(array, value) returns void
     *
     * For new Array(size).fill(value), use Enumerable.Repeat(value, size).ToArray()
     * For existing array.fill(value), we must use Array.Fill which mutates in-place
     */
    transformArrayFill(node) {
      const arrayNode = node.array;

      // Check if this is filling a newly created array: new Array(size).fill(value)
      // In this case, we can use Enumerable.Repeat(value, size).ToArray()
      if (arrayNode?.type === 'ArrayCreation' || arrayNode?.type === 'TypedArrayCreation') {
        const sizeExpr = arrayNode.size || arrayNode.length;
        if (sizeExpr) {
          const size = this.transformExpression(sizeExpr);
          let fillValue = this.transformExpression(node.value);

          // Determine element type and cast fill value if needed
          let elemType = null;
          if (arrayNode.elementType) {
            elemType = this.mapTypeFromKnowledge(arrayNode.elementType);
          } else if (node.elementType) {
            elemType = this.mapTypeFromKnowledge(node.elementType);
          }
          if (!elemType) {
            elemType = CSharpType.Byte(); // Default for crypto algorithms
          }

          // Cast literal 0 or 255 to element type for proper overload resolution
          if (fillValue.nodeType === 'Literal' && (fillValue.value === 0 || fillValue.value === 255)) {
            fillValue = new CSharpCast(elemType, fillValue);
          }

          const repeatCall = new CSharpMethodCall(
            new CSharpIdentifier('Enumerable'),
            'Repeat',
            [fillValue, size]
          );
          return new CSharpMethodCall(repeatCall, 'ToArray', []);
        }
      }

      // For existing arrays, use OpCodes.Fill which mutates in-place
      // Note: This doesn't return the array like JavaScript, but in most contexts
      // the return value isn't used in variable declaration
      // Using OpCodes.Fill for .NET Framework compatibility (Array.Fill is .NET Core 2.0+)
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      // OpCodes.Fill(array, value)
      return new CSharpMethodCall(
        new CSharpIdentifier('OpCodes'),
        'Fill',
        [array, value]
      );
    }

    /**
     * Transform ArrayXor to helper method or inline loop
     */
    transformArrayXor(node) {
      // Handle both IL format (node.arguments) and legacy format (node.left/right)
      const left = this.transformExpression(node.arguments?.[0] || node.left);
      const right = this.transformExpression(node.arguments?.[1] || node.right);
      // XorArrays(left, right)
      return new CSharpMethodCall(null, 'XorArrays', [left, right]);
    }

    /**
     * Transform ArrayClear to Array.Clear with full parameters for .NET compatibility
     * Uses Array.Clear(array, 0, array.Length) which works with all .NET versions
     */
    transformArrayClear(node) {
      // Handle both IL format (node.arguments) and legacy format (node.array)
      const array = this.transformExpression(node.arguments?.[0] || node.array);
      // Array.Clear(array, 0, array.Length) - compatible with .NET Framework and .NET Core
      return new CSharpMethodCall(
        new CSharpIdentifier('Array'),
        'Clear',
        [array, CSharpLiteral.Int(0), new CSharpMemberAccess(array, 'Length')]
      );
    }

    /**
     * Transform ArrayIndexOf to Array.IndexOf
     */
    transformArrayIndexOf(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      const args = [array, value];
      if (node.start) {
        args.push(this.transformExpression(node.start));
      }
      return new CSharpMethodCall(
        new CSharpIdentifier('Array'),
        'IndexOf',
        args
      );
    }

    /**
     * Transform ArrayIncludes to array.Contains()
     */
    transformArrayIncludes(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      return new CSharpMethodCall(array, 'Contains', [value]);
    }

    /**
     * Transform ArrayConcat to array.Concat(...).ToArray()
     */
    transformArrayConcat(node) {
      const array = this.transformExpression(node.array);
      let result = array;
      for (const arr of (node.arrays || [])) {
        const other = this.transformExpression(arr);
        result = new CSharpMethodCall(result, 'Concat', [other]);
      }
      return new CSharpMethodCall(result, 'ToArray', []);
    }

    /**
     * Transform ArrayJoin to string.Join()
     */
    transformArrayJoin(node) {
      const array = this.transformExpression(node.array);
      const separator = node.separator
        ? this.transformExpression(node.separator)
        : CSharpLiteral.String(',');
      return new CSharpMethodCall(
        new CSharpIdentifier('string'),
        'Join',
        [separator, array]
      );
    }

    /**
     * Transform ArrayReverse to Array.Reverse()
     */
    transformArrayReverse(node) {
      const array = this.transformExpression(node.array);
      return new CSharpMethodCall(
        new CSharpIdentifier('Array'),
        'Reverse',
        [array]
      );
    }

    /**
     * Transform ArrayReduce to LINQ Aggregate
     * JS: array.reduce((acc, item) => acc + item, initialValue)
     * C#: array.Aggregate(initialValue, (acc, item) => acc + item)
     */
    transformArrayReduce(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      const args = [];

      if (node.initialValue) {
        args.push(this.transformExpression(node.initialValue));
      }
      args.push(callback);

      return new CSharpMethodCall(array, 'Aggregate', args);
    }

    /**
     * Transform ArrayMap to LINQ Select().ToArray()
     * JS: array.map(x => f(x))
     * C#: array.Select(x => f(x)).ToArray()
     */
    transformArrayMap(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      const selectCall = new CSharpMethodCall(array, 'Select', [callback]);
      return new CSharpMethodCall(selectCall, 'ToArray', []);
    }

    /**
     * Transform ArrayFilter to LINQ Where().ToArray()
     * JS: array.filter(x => predicate(x))
     * C#: array.Where(x => predicate(x)).ToArray()
     */
    transformArrayFilter(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      const whereCall = new CSharpMethodCall(array, 'Where', [callback]);
      return new CSharpMethodCall(whereCall, 'ToArray', []);
    }

    /**
     * Transform ArrayForEach to Array.ForEach or foreach loop
     * JS: array.forEach(x => doSomething(x))
     * C#: Array.ForEach(array, x => doSomething(x))
     */
    transformArrayForEach(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new CSharpMethodCall(
        new CSharpIdentifier('Array'),
        'ForEach',
        [array, callback]
      );
    }

    /**
     * Transform ArrayFind to LINQ FirstOrDefault
     * JS: array.find(x => predicate(x))
     * C#: array.FirstOrDefault(x => predicate(x))
     */
    transformArrayFind(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new CSharpMethodCall(array, 'FirstOrDefault', [callback]);
    }

    /**
     * Transform ArrayFindIndex to Array.FindIndex
     * JS: array.findIndex(x => predicate(x))
     * C#: Array.FindIndex(array, x => predicate(x))
     */
    transformArrayFindIndex(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new CSharpMethodCall(
        new CSharpIdentifier('Array'),
        'FindIndex',
        [array, callback]
      );
    }

    /**
     * Transform ArrayEvery to LINQ All
     * JS: array.every(x => predicate(x))
     * C#: array.All(x => predicate(x))
     */
    transformArrayEvery(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new CSharpMethodCall(array, 'All', [callback]);
    }

    /**
     * Transform ArraySome to LINQ Any
     * JS: array.some(x => predicate(x))
     * C#: array.Any(x => predicate(x))
     */
    transformArraySome(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new CSharpMethodCall(array, 'Any', [callback]);
    }

    /**
     * Transform ArraySort to Array.Sort
     * JS: array.sort(compareFn)
     * C#: Array.Sort(array, compareFn) or Array.Sort(array)
     */
    transformArraySort(node) {
      const array = this.transformExpression(node.array);
      const args = [array];

      if (node.compareFn) {
        args.push(this.transformCallback(node.compareFn));
      }

      return new CSharpMethodCall(
        new CSharpIdentifier('Array'),
        'Sort',
        args
      );
    }

    /**
     * Transform callback function to C# lambda
     * Handles both ArrowFunctionExpression and FunctionExpression
     */
    transformCallback(callback) {
      if (!callback) return null;

      // If it's already transformed, return as-is
      if (callback.nodeType) {
        return callback;
      }

      // For arrow functions and function expressions
      if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
        const params = (callback.params || []).map(p => {
          const paramName = this.escapeReservedKeyword(p.name || p);
          return new CSharpParameter(paramName, null);
        });

        let body;
        if (callback.body.type === 'BlockStatement') {
          body = this.transformFunctionBody(callback.body, null);
        } else {
          body = this.transformExpression(callback.body);
        }

        return new CSharpLambda(params, body);
      }

      // For identifiers (reference to existing function)
      if (callback.type === 'Identifier') {
        return this.transformIdentifier(callback);
      }

      // Fallback - try to transform as expression
      return this.transformExpression(callback);
    }

    /**
     * Transform ArrayPop - removes last element (in-place for List, needs workaround for arrays)
     */
    transformArrayPop(node) {
      const array = this.transformExpression(node.array);
      // For List<T>: list.RemoveAt(list.Count - 1)
      return new CSharpMethodCall(array, 'RemoveAt', [
        new CSharpBinaryExpression(
          new CSharpMemberAccess(array, 'Count'),
          '-',
          CSharpLiteral.Int(1)
        )
      ]);
    }

    /**
     * Transform ArrayShift - removes first element
     */
    transformArrayShift(node) {
      const array = this.transformExpression(node.array);
      // For List<T>: list.RemoveAt(0)
      return new CSharpMethodCall(array, 'RemoveAt', [CSharpLiteral.Int(0)]);
    }

    /**
     * Transform ArrayCreation to new T[size]
     */
    transformArrayCreation(node) {
      const size = node.size ? this.transformExpression(node.size) : CSharpLiteral.Int(0);
      // Default to uint32 for crypto code (new Array(n) typically holds 32-bit values)
      const elementType = node.elementType || 'uint32';

      const typeMap = {
        'uint8': CSharpType.Byte(),
        'byte': CSharpType.Byte(),
        'uint16': CSharpType.UShort(),
        'uint32': CSharpType.UInt(),
        'uint': CSharpType.UInt(),
        'uint64': CSharpType.ULong(),
        'int8': CSharpType.SByte(),
        'int16': CSharpType.Short(),
        'int32': CSharpType.Int(),
        'int': CSharpType.Int(),
        'int64': CSharpType.Long()
      };

      const csharpType = typeMap[elementType] || CSharpType.UInt();
      return new CSharpArrayCreation(csharpType, size);
    }

    /**
     * Transform TypedArrayCreation to new T[size] or .ToArray() for copy pattern
     */
    transformTypedArrayCreation(node) {
      const arrayType = node.arrayType || 'Uint8Array';

      // Check if this is an array copy pattern:
      // new Uint8Array(existingArray) -> existingArray.ToArray()
      const sizeNode = node.size;
      if (sizeNode && this.isArrayCopyPattern(sizeNode)) {
        const sourceArray = this.transformExpression(sizeNode);
        return new CSharpMethodCall(sourceArray, 'ToArray', []);
      }

      const size = sizeNode ? this.transformExpression(sizeNode) : CSharpLiteral.Int(0);

      const typeMap = {
        'Uint8Array': CSharpType.Byte(),
        'Uint16Array': CSharpType.UShort(),
        'Uint32Array': CSharpType.UInt(),
        'Uint8ClampedArray': CSharpType.Byte(),
        'Int8Array': CSharpType.SByte(),
        'Int16Array': CSharpType.Short(),
        'Int32Array': CSharpType.Int(),
        'Float32Array': CSharpType.Float(),
        'Float64Array': CSharpType.Double(),
        'BigUint64Array': CSharpType.ULong(),
        'BigInt64Array': CSharpType.Long()
      };

      const csharpType = typeMap[arrayType] || CSharpType.Byte();
      return new CSharpArrayCreation(csharpType, size);
    }

    /**
     * Check if a node represents an array copy pattern (source array, not a size)
     */
    isArrayCopyPattern(node) {
      if (!node) return false;

      // Check by type annotation
      if (node.resultType) {
        const typeStr = typeof node.resultType === 'string' ? node.resultType :
          (node.resultType.name || node.resultType.toString?.() || '');
        if (typeStr.endsWith('[]') || typeStr.includes('Array') ||
            typeStr.startsWith('uint8[') || typeStr.startsWith('Uint8')) {
          return true;
        }
      }

      // Check member access patterns like this._key, this._nonce
      if (node.type === 'MemberExpression' || node.type === 'ThisPropertyAccess') {
        // For ThisPropertyAccess, property can be a string directly
        const propName = typeof node.property === 'string' ? node.property :
          (node.property?.name || node.property?.value || node.propertyName || node.name || '');
        const lowerName = propName.toLowerCase();
        if (lowerName.startsWith('_') ||
            lowerName.includes('key') ||
            lowerName.includes('nonce') ||
            lowerName.includes('iv') ||
            lowerName.includes('buffer') ||
            lowerName.includes('data') ||
            lowerName.includes('bytes') ||
            lowerName.includes('input') ||
            lowerName.includes('output') ||
            lowerName.includes('state') ||
            lowerName.includes('array')) {
          return true;
        }
      }

      // Check for identifiers with array-like names or types
      if (node.type === 'Identifier') {
        const varType = this.variableTypes?.get?.(node.name);
        if (varType?.endsWith?.('[]') || varType?.includes?.('Array')) {
          return true;
        }
        const lowerName = (node.name || '').toLowerCase();
        if (lowerName.includes('key') || lowerName.includes('buffer') ||
            lowerName.includes('data') || lowerName.includes('bytes')) {
          return true;
        }
      }

      return false;
    }

    /**
     * Transform ByteBufferView to Span<T> or direct array access
     */
    transformByteBufferView(node) {
      const buffer = this.transformExpression(node.buffer);
      const offset = node.offset ? this.transformExpression(node.offset) : CSharpLiteral.Int(0);

      // Use AsSpan or slice: buffer.AsSpan(offset)
      return new CSharpMethodCall(buffer, 'AsSpan', [offset]);
    }

    /**
     * Transform HexDecode to OpCodes.Hex8ToBytes for .NET compatibility
     */
    transformHexDecode(node) {
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      // OpCodes.Hex8ToBytes works with all .NET versions
      return new CSharpMethodCall(
        new CSharpIdentifier('OpCodes'),
        'Hex8ToBytes',
        [value]
      );
    }

    /**
     * Transform HexEncode to OpCodes.BytesToHex8 for .NET compatibility
     */
    transformHexEncode(node) {
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      // OpCodes.BytesToHex8 works with all .NET versions
      return new CSharpMethodCall(
        new CSharpIdentifier('OpCodes'),
        'BytesToHex8',
        [value]
      );
    }

    /**
     * Transform StringToBytes to System.Text.Encoding.ASCII/UTF8.GetBytes
     */
    transformStringToBytes(node) {
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const encoding = node.encoding || 'ascii';
      // System.Text.Encoding.ASCII.GetBytes(str) or UTF8.GetBytes(str)
      const encodingName = encoding === 'utf8' ? 'UTF8' : 'ASCII';
      return new CSharpMethodCall(
        new CSharpMemberAccess(
          new CSharpMemberAccess(
            new CSharpMemberAccess(
              new CSharpIdentifier('System'),
              'Text'
            ),
            'Encoding'
          ),
          encodingName
        ),
        'GetBytes',
        [value]
      );
    }

    /**
     * Transform BytesToString to System.Text.Encoding.ASCII/UTF8.GetString
     */
    transformBytesToString(node) {
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const encoding = node.encoding || 'ascii';
      const encodingName = encoding === 'utf8' ? 'UTF8' : 'ASCII';
      return new CSharpMethodCall(
        new CSharpMemberAccess(
          new CSharpMemberAccess(
            new CSharpMemberAccess(
              new CSharpIdentifier('System'),
              'Text'
            ),
            'Encoding'
          ),
          encodingName
        ),
        'GetString',
        [value]
      );
    }

    /**
     * Transform Floor to Math.Floor with cast
     */
    transformFloor(node) {
      const arg = this.transformExpression(node.argument);
      const floorResult = new CSharpMethodCall(
        new CSharpIdentifier('Math'),
        'Floor',
        [new CSharpCast(CSharpType.Double(), arg)]
      );
      // Use int as default (matches transformCeil behavior)
      // If uint is needed, the assignment context will handle proper casting
      return new CSharpCast(CSharpType.Int(), floorResult);
    }

    /**
     * Transform Ceil to Math.Ceiling
     */
    transformCeil(node) {
      const arg = this.transformExpression(node.argument);
      const ceilResult = new CSharpMethodCall(
        new CSharpIdentifier('Math'),
        'Ceiling',
        [new CSharpCast(CSharpType.Double(), arg)]
      );
      return new CSharpCast(CSharpType.Int(), ceilResult);
    }

    /**
     * Transform Abs to Math.Abs
     */
    transformAbs(node) {
      const arg = this.transformExpression(node.argument);
      return new CSharpMethodCall(
        new CSharpIdentifier('Math'),
        'Abs',
        [arg]
      );
    }

    /**
     * Transform Min to Math.Min
     */
    transformMin(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      if (args.length === 0) return CSharpLiteral.Int(0);
      if (args.length === 1) return args[0];

      // Chain Math.Min calls: Math.Min(a, Math.Min(b, c))
      let result = args[args.length - 1];
      for (let i = args.length - 2; i >= 0; --i) {
        result = new CSharpMethodCall(
          new CSharpIdentifier('Math'),
          'Min',
          [args[i], result]
        );
      }
      return result;
    }

    /**
     * Transform Max to Math.Max
     */
    transformMax(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      if (args.length === 0) return CSharpLiteral.Int(0);
      if (args.length === 1) return args[0];

      // Chain Math.Max calls
      let result = args[args.length - 1];
      for (let i = args.length - 2; i >= 0; --i) {
        result = new CSharpMethodCall(
          new CSharpIdentifier('Math'),
          'Max',
          [args[i], result]
        );
      }
      return result;
    }

    /**
     * Transform Pow to Math.Pow
     */
    transformPow(node) {
      const base = this.transformExpression(node.base);
      const exponent = this.transformExpression(node.exponent);
      return new CSharpMethodCall(
        new CSharpIdentifier('Math'),
        'Pow',
        [base, exponent]
      );
    }

    /**
     * Transform Round to Math.Round
     */
    transformRound(node) {
      const arg = this.transformExpression(node.argument);
      const roundResult = new CSharpMethodCall(
        new CSharpIdentifier('Math'),
        'Round',
        [new CSharpCast(CSharpType.Double(), arg)]
      );
      return new CSharpCast(CSharpType.Int(), roundResult);
    }

    /**
     * Transform Trunc to Math.Truncate
     */
    transformTrunc(node) {
      const arg = this.transformExpression(node.argument);
      const truncResult = new CSharpMethodCall(
        new CSharpIdentifier('Math'),
        'Truncate',
        [new CSharpCast(CSharpType.Double(), arg)]
      );
      return new CSharpCast(CSharpType.Int(), truncResult);
    }

    /**
     * Transform Sign to Math.Sign
     */
    transformSign(node) {
      const arg = this.transformExpression(node.argument);
      return new CSharpMethodCall(
        new CSharpIdentifier('Math'),
        'Sign',
        [arg]
      );
    }

    /**
     * Transform Random to new Random().NextDouble()
     */
    transformRandom(node) {
      // Random.Shared.NextDouble() in .NET 6+
      return new CSharpMethodCall(
        new CSharpMemberAccess(new CSharpIdentifier('Random'), 'Shared'),
        'NextDouble',
        []
      );
    }

    /**
     * Transform Imul to (int)((int)a * (int)b)
     */
    transformImul(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      const castLeft = new CSharpCast(CSharpType.Int(), left);
      const castRight = new CSharpCast(CSharpType.Int(), right);
      const mult = new CSharpBinaryExpression(castLeft, '*', castRight);
      return new CSharpCast(CSharpType.Int(), mult);
    }

    /**
     * Transform Clz32 to OpCodes.Clz32 for .NET compatibility
     */
    transformClz32(node) {
      const arg = this.transformExpression(node.argument);
      // Use OpCodes.Clz32 for broad .NET compatibility
      return new CSharpMethodCall(
        new CSharpIdentifier('OpCodes'),
        'Clz32',
        [new CSharpCast(CSharpType.UInt(), arg)]
      );
    }

    /**
     * Transform Cast to C# cast
     */
    transformCast(node) {
      const expr = this.transformExpression(node.arguments?.[0] || node.expression);
      const targetType = node.targetType || 'uint';

      const typeMap = {
        'uint8': CSharpType.Byte(),
        'byte': CSharpType.Byte(),
        'uint16': CSharpType.UShort(),
        'ushort': CSharpType.UShort(),
        'uint32': CSharpType.UInt(),
        'uint': CSharpType.UInt(),
        'uint64': CSharpType.ULong(),
        'ulong': CSharpType.ULong(),
        'int8': CSharpType.SByte(),
        'sbyte': CSharpType.SByte(),
        'int16': CSharpType.Short(),
        'short': CSharpType.Short(),
        'int32': CSharpType.Int(),
        'int': CSharpType.Int(),
        'int64': CSharpType.Long(),
        'long': CSharpType.Long(),
        'float': CSharpType.Float(),
        'double': CSharpType.Double()
      };

      const csharpType = typeMap[targetType] || CSharpType.UInt();
      return new CSharpCast(csharpType, expr);
    }

    /**
     * Transform BigIntCast - cast to BigInteger
     * IL AST: { type: 'BigIntCast', argument: expr }
     */
    transformBigIntCast(node) {
      const expr = this.transformExpression(node.argument);
      // Cast to BigInteger: (BigInteger)expr or new BigInteger(expr)
      return new CSharpCast(new CSharpType('BigInteger'), expr);
    }

    /**
     * Transform TypedArraySet - copies source array into target at offset
     * IL AST: { type: 'TypedArraySet', array: targetExpr, source: sourceExpr, offset: offsetExpr }
     * In C#: Array.Copy(source, 0, target, offset, source.Length)
     */
    transformTypedArraySet(node) {
      const target = this.transformExpression(node.array);
      const source = this.transformExpression(node.source);
      // Default offset to 0 if not specified
      const offset = node.offset != null
        ? this.transformExpression(node.offset)
        : CSharpLiteral.Int(0);

      // Array.Copy(source, 0, target, offset, source.Length)
      return new CSharpMethodCall(
        new CSharpIdentifier('Array'),
        'Copy',
        [
          source,
          CSharpLiteral.Int(0),
          target,
          offset,
          new CSharpMemberAccess(source, 'Length')
        ]
      );
    }

    /**
     * Transform TypedArraySubarray - extracts a subarray from an array
     * IL AST: { type: 'TypedArraySubarray', array: expr, begin: expr, end: expr }
     * Uses OpCodes.SliceArray for .NET compatibility instead of C# 8+ range syntax
     */
    transformTypedArraySubarray(node) {
      const array = this.transformExpression(node.array);
      const begin = this.transformExpression(node.begin);
      const end = node.end
        ? this.transformExpression(node.end)
        : new CSharpMemberAccess(array, 'Length');

      // Use OpCodes.SliceArray for .NET compatibility
      return new CSharpMethodCall(
        new CSharpIdentifier('OpCodes'),
        'SliceArray',
        [array, begin, end]
      );
    }

    /**
     * Transform ArraySplice - removes/replaces elements from an array
     * IL AST: { type: 'ArraySplice', array: expr, start: expr, deleteCount: expr, items?: expr[] }
     * In C#: For List<T> use RemoveRange/InsertRange; for arrays need to create new array
     * For simplicity, convert to list operations or use LINQ
     */
    transformArraySplice(node) {
      const array = this.transformExpression(node.array);
      const start = this.transformExpression(node.start);
      const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : CSharpLiteral.Int(0);

      // If there are items to insert, this is a more complex operation
      if (node.items && node.items.length > 0) {
        // array.ToList() with modifications
        // This returns what was removed, but we'll handle the mutation as well
        const items = node.items.map(i => this.transformExpression(i));
        // Emit a comment indicating this needs review
        return new CSharpMethodCall(
          array,
          'GetRange',
          [start, deleteCount]
        );
      }

      // Simple case: just remove elements (returns removed elements)
      // Use GetRange to return what would be spliced, then RemoveRange for mutation
      return new CSharpMethodCall(
        array,
        'GetRange',
        [start, deleteCount]
      );
    }

    /**
     * Transform SetCreation - creates a Set (HashSet in C#)
     * IL AST: { type: 'SetCreation', values: expr[] | null }
     */
    transformSetCreation(node) {
      // new HashSet<T>() or new HashSet<T>(initialValues)
      if (node.values && node.values.length > 0) {
        const elements = node.values.map(v => this.transformExpression(v));
        // Infer element type from first element
        const elemType = this.inferFullExpressionType(node.values[0]) || CSharpType.Int();
        const setType = new CSharpType('HashSet', [elemType]);
        return new CSharpObjectCreation(setType, [
          new CSharpArrayCreation(elemType, elements)
        ]);
      }

      // Empty set - default to int
      return new CSharpObjectCreation(
        new CSharpType('HashSet', [CSharpType.Int()]),
        []
      );
    }

    /**
     * Transform DestructuringAssignment - fallback
     */
    transformDestructuringAssignment(node) {
      if (node.source) {
        return this.transformExpression(node.source);
      }
      return CSharpLiteral.Null();
    }

    // ==================== String Operations ====================

    /**
     * Transform StringCharCodeAt - string.charCodeAt(index) → (int)string[index]
     * IL AST: { type: 'StringCharCodeAt', string: expr, index: expr }
     * Special case: if the string is already a char (from foreach iteration),
     * just cast to int without indexing: (int)char
     */
    transformStringCharCodeAt(node) {
      const str = this.transformExpression(node.string);
      const index = this.transformExpression(node.index);

      // Check if the string is already a char type (e.g., from foreach over string)
      const strType = this.inferFullExpressionType(node.string);
      if (strType?.name === 'char') {
        // Already a char, just cast to int - no indexing needed
        return new CSharpCast(CSharpType.Int(), str);
      }

      // (int)string[index]
      return new CSharpCast(
        CSharpType.Int(),
        new CSharpElementAccess(str, [index])
      );
    }

    /**
     * Transform StringCharAt - string.charAt(index) → string[index].ToString()
     * IL AST: { type: 'StringCharAt', string: expr, index: expr }
     * Special case: if the string is already a char (from foreach iteration),
     * just call ToString() on it without indexing: char.ToString()
     */
    transformStringCharAt(node) {
      const str = this.transformExpression(node.string);
      const index = this.transformExpression(node.index);

      // Check if the string is already a char type (e.g., from foreach over string)
      const strType = this.inferFullExpressionType(node.string);
      if (strType?.name === 'char') {
        // Already a char, just call ToString() - no indexing needed
        return new CSharpMethodCall(str, 'ToString', []);
      }

      // string[index].ToString()
      return new CSharpMethodCall(
        new CSharpElementAccess(str, [index]),
        'ToString',
        []
      );
    }

    /**
     * Transform StringSubstring - string.substring(start, end) → string.Substring(start, end - start)
     * IL AST: { type: 'StringSubstring', string: expr, start: expr, end?: expr }
     */
    transformStringSubstring(node) {
      const str = this.transformExpression(node.string);
      const start = this.transformExpression(node.start);

      if (node.end) {
        const end = this.transformExpression(node.end);
        // string.Substring(start, end - start)
        return new CSharpMethodCall(
          str,
          'Substring',
          [start, new CSharpBinaryExpression(end, '-', start)]
        );
      }

      // string.Substring(start) - to end of string
      return new CSharpMethodCall(str, 'Substring', [start]);
    }

    /**
     * Transform StringRepeat - string.repeat(count) → string.Concat(Enumerable.Repeat(string, count))
     * IL AST: { type: 'StringRepeat', string: expr, count: expr }
     */
    transformStringRepeat(node) {
      const str = this.transformExpression(node.string);
      const count = this.transformExpression(node.count);
      // string.Concat(Enumerable.Repeat(str, count))
      return new CSharpMethodCall(
        new CSharpIdentifier('string'),
        'Concat',
        [
          new CSharpMethodCall(
            new CSharpIdentifier('Enumerable'),
            'Repeat',
            [str, count]
          )
        ]
      );
    }

    /**
     * Transform StringIncludes - string.includes(search) → string.Contains(search)
     * IL AST: { type: 'StringIncludes', string: expr, searchValue: expr }
     */
    transformStringIncludes(node) {
      const str = this.transformExpression(node.string);
      const search = this.transformExpression(node.searchValue);
      return new CSharpMethodCall(str, 'Contains', [search]);
    }

    /**
     * Transform StringIndexOf - string.indexOf(search) → string.IndexOf(search)
     * IL AST: { type: 'StringIndexOf', string: expr, searchValue: expr }
     */
    transformStringIndexOf(node) {
      const str = this.transformExpression(node.string);
      const search = this.transformExpression(node.searchValue);
      return new CSharpMethodCall(str, 'IndexOf', [search]);
    }

    /**
     * Transform StringReplace - string.replace(search, replace) → string.Replace(search, replace)
     * IL AST: { type: 'StringReplace', string: expr, searchValue: expr, replaceValue: expr }
     */
    transformStringReplace(node) {
      const str = this.transformExpression(node.string);
      const search = this.transformExpression(node.searchValue);
      const replace = this.transformExpression(node.replaceValue);
      return new CSharpMethodCall(str, 'Replace', [search, replace]);
    }

    /**
     * Transform StringSplit - string.split(separator) → string.Split(separator)
     * IL AST: { type: 'StringSplit', string: expr, separator: expr }
     */
    transformStringSplit(node) {
      const str = this.transformExpression(node.string);
      const separator = this.transformExpression(node.separator);
      return new CSharpMethodCall(str, 'Split', [separator]);
    }

    /**
     * Transform StringTransform - string.toUpperCase()/toLowerCase()
     * IL AST: { type: 'StringTransform', string: expr, method: 'toUpperCase' | 'toLowerCase' }
     */
    transformStringTransform(node) {
      const str = this.transformExpression(node.string);
      const method = node.method === 'toUpperCase' ? 'ToUpper' :
                     node.method === 'toLowerCase' ? 'ToLower' :
                     node.method === 'trim' ? 'Trim' :
                     node.method === 'trimStart' ? 'TrimStart' :
                     node.method === 'trimEnd' ? 'TrimEnd' : node.method;
      return new CSharpMethodCall(str, method, []);
    }

    // ==================== Array Operations ====================

    /**
     * Transform ArrayUnshift - array.unshift(value) → inserts at beginning
     * IL AST: { type: 'ArrayUnshift', array: expr, value: expr }
     * In C#, arrays have fixed size. We use List<T>.Insert(0, value) pattern.
     * Returns the new array (list converted back to array).
     */
    transformArrayUnshift(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);

      // Infer element type from the array or value
      let elementType = CSharpType.Object();  // Default fallback
      const arrayType = this.inferFullExpressionType(node.array);
      if (arrayType?.isArray && arrayType.elementType) {
        elementType = arrayType.elementType;
      } else {
        const valueType = this.inferFullExpressionType(node.value);
        if (valueType && !valueType.isArray) {
          elementType = valueType;
        }
      }

      // This is tricky - C# arrays are fixed size. We'll use LINQ:
      // new[] { value }.Concat(array).ToArray()
      return new CSharpMethodCall(
        new CSharpMethodCall(
          new CSharpArrayCreation(elementType, null, [value]),
          'Concat',
          [array]
        ),
        'ToArray',
        []
      );
    }

    // ==================== Data Structures ====================

    /**
     * Transform MapCreation - new Map() → new Dictionary<K,V>()
     * IL AST: { type: 'MapCreation', entries: expr | null, keyType: string, valueType: string }
     */
    transformMapCreation(node) {
      // Determine key/value types
      const keyType = node.keyType === 'string' ? CSharpType.String() :
                      node.keyType === 'int' || node.keyType === 'int32' ? CSharpType.Int() :
                      CSharpType.Object();

      const valueType = node.valueType === 'uint8[]' || node.valueType === 'byte[]' ? CSharpType.Array(CSharpType.Byte()) :
                        node.valueType === 'string' ? CSharpType.String() :
                        node.valueType === 'int' || node.valueType === 'int32' ? CSharpType.Int() :
                        CSharpType.Object();

      const dictType = new CSharpType('Dictionary', [keyType, valueType]);
      const creation = new CSharpObjectCreation(dictType, []);

      if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
        // new Dictionary<K,V> { { key1, value1 }, { key2, value2 }, ... }
        const initializer = new CSharpObjectInitializer(true); // isDictionary = true
        node.entries.elements.forEach(entry => {
          if (entry.elements && entry.elements.length >= 2) {
            const key = this.transformExpression(entry.elements[0]);
            const val = this.transformExpression(entry.elements[1]);
            initializer.assignments.push({ name: key, value: val });
          }
        });
        creation.initializer = initializer;
      }

      return creation;
    }

    /**
     * Transform DataViewCreation - new DataView(buffer) → buffer as byte[]
     * IL AST: { type: 'DataViewCreation', buffer: expr }
     * In C#, we use byte arrays directly with BitConverter for endian operations
     */
    transformDataViewCreation(node) {
      // DataView in JS is for reading/writing typed values from ArrayBuffer
      // In C#, we typically just use byte[] with BitConverter
      if (node.buffer) {
        return this.transformExpression(node.buffer);
      }
      // Create new byte array if size is specified
      return new CSharpArrayCreation(CSharpType.Byte(), []);
    }

    /**
     * Transform BufferCreation - new ArrayBuffer(size) → new byte[size]
     * IL AST: { type: 'BufferCreation', size: expr }
     */
    transformBufferCreation(node) {
      const size = this.transformExpression(node.size);
      // new byte[size]
      return new CSharpArrayCreation(CSharpType.Byte(), size, null);
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
