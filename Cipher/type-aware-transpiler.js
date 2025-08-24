#!/usr/bin/env node
/*
 * Type-Aware JavaScript AST Transpiler
 * Enhanced version with JSDoc parsing and type inference
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  /**
   * JSDoc Comment Parser
   * Extracts type information from JSDoc comments
   */
  class JSDocParser {
    constructor() {
      this.typeCache = new Map();
    }

    /**
     * Parse JSDoc comment and extract type information
     * @param {string} comment - JSDoc comment text
     * @returns {Object} Parsed JSDoc information
     */
    parseJSDoc(comment) {
      const result = {
        description: '',
        params: [],
        returns: null,
        type: null,
        throws: [],
        examples: []
      };

      if (!comment) return result;

      // Handle case where comment is an AST node instead of a string
      if (typeof comment === 'object' && comment.value) {
        comment = comment.value;
      }
      
      // Handle case where comment is not a string
      if (typeof comment !== 'string') {
        return result;
      }

      // Clean up comment (remove /* */ and leading *)
      const cleaned = comment
        .replace(/^\/\*\*?/, '')
        .replace(/\*\/$/, '')
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, ''))
        .join('\n');

      // Extract description (first part before @tags)
      const descMatch = cleaned.match(/^([^@]*)/);
      if (descMatch) {
        result.description = descMatch[1].trim();
      }

      // Parse @param tags
      const paramRegex = /@param\s+\{([^}]+)\}\s+(\w+)(?:\s+-\s+(.*))?/g;
      let paramMatch;
      while ((paramMatch = paramRegex.exec(cleaned)) !== null) {
        result.params.push({
          type: this.parseType(paramMatch[1]),
          name: paramMatch[2],
          description: paramMatch[3] || ''
        });
      }

      // Parse @returns tag
      const returnMatch = cleaned.match(/@returns?\s+\{([^}]+)\}(?:\s+-?\s+(.*))?/);
      if (returnMatch) {
        result.returns = {
          type: this.parseType(returnMatch[1]),
          description: returnMatch[2] || ''
        };
      }

      // Parse @type tag
      const typeMatch = cleaned.match(/@type\s+\{([^}]+)\}/);
      if (typeMatch) {
        result.type = this.parseType(typeMatch[1]);
      }

      // Parse @throws tags
      const throwsRegex = /@throws?\s+\{([^}]+)\}(?:\s+-?\s+(.*))?/g;
      let throwsMatch;
      while ((throwsMatch = throwsRegex.exec(cleaned)) !== null) {
        result.throws.push({
          type: throwsMatch[1],
          description: throwsMatch[2] || ''
        });
      }

      return result;
    }

    /**
     * Parse type string into structured type information
     * @param {string} typeStr - Type string from JSDoc
     * @returns {Object} Parsed type information
     */
    parseType(typeStr) {
      if (this.typeCache.has(typeStr)) {
        return this.typeCache.get(typeStr);
      }

      const type = {
        name: typeStr,
        isArray: false,
        isOptional: false,
        isUnion: false,
        unionTypes: [],
        isGeneric: false,
        genericTypes: [],
        isNullable: false
      };

      // Handle optional types (Type?)
      if (typeStr.endsWith('?')) {
        type.isOptional = true;
        type.isNullable = true;
        typeStr = typeStr.slice(0, -1);
      }

      // Handle arrays (Type[] or Array<Type>)
      if (typeStr.endsWith('[]')) {
        type.isArray = true;
        type.elementType = this.parseType(typeStr.slice(0, -2));
      } else if (typeStr.startsWith('Array<') && typeStr.endsWith('>')) {
        type.isArray = true;
        type.elementType = this.parseType(typeStr.slice(6, -1));
      }

      // Handle union types (Type1|Type2)
      if (typeStr.includes('|')) {
        type.isUnion = true;
        type.unionTypes = typeStr.split('|').map(t => this.parseType(t.trim()));
      }

      // Handle generic types (Map<K,V>, Promise<T>)
      const genericMatch = typeStr.match(/^(\w+)<(.+)>$/);
      if (genericMatch) {
        type.isGeneric = true;
        type.name = genericMatch[1];
        type.genericTypes = genericMatch[2].split(',').map(t => this.parseType(t.trim()));
      }

      // Clean up basic type name
      if (!type.isArray && !type.isUnion && !type.isGeneric) {
        type.name = typeStr.trim();
      }

      this.typeCache.set(typeStr, type);
      return type;
    }
  }

  /**
   * Precise Type System for Cryptographic Operations
   * Handles specific bit-width types and forward/backward type inference
   */
  class PreciseTypeKnowledge {
    constructor() {
      this.initializeTypeDatabase();
      this.typeConstraints = new Map(); // Variable name -> inferred type constraints
      this.forwardInferences = new Map(); // Expression -> result type
      this.backwardInferences = new Map(); // Variable -> required type from usage
    }

    initializeTypeDatabase() {
      // Precise OpCodes.js method signatures with specific bit-width types
      this.opCodesTypes = {
        // 8-bit operations (byte)
        'RotL8': { params: ['byte', 'int'], returns: 'byte', description: '8-bit rotate left' },
        'RotR8': { params: ['byte', 'int'], returns: 'byte', description: '8-bit rotate right' },
        
        // 16-bit operations (word/short)
        'RotL16': { params: ['word', 'int'], returns: 'word', description: '16-bit rotate left' },
        'RotR16': { params: ['word', 'int'], returns: 'word', description: '16-bit rotate right' },
        
        // 32-bit operations (dword/int)
        'RotL32': { params: ['dword', 'int'], returns: 'dword', description: '32-bit rotate left' },
        'RotR32': { params: ['dword', 'int'], returns: 'dword', description: '32-bit rotate right' },
        
        // Packing operations - 4 bytes to 32-bit
        'Pack32BE': { params: ['byte', 'byte', 'byte', 'byte'], returns: 'dword', description: 'Pack 4 bytes to 32-bit big-endian' },
        'Pack32LE': { params: ['byte', 'byte', 'byte', 'byte'], returns: 'dword', description: 'Pack 4 bytes to 32-bit little-endian' },
        'Pack16BE': { params: ['byte', 'byte'], returns: 'word', description: 'Pack 2 bytes to 16-bit big-endian' },
        'Pack16LE': { params: ['byte', 'byte'], returns: 'word', description: 'Pack 2 bytes to 16-bit little-endian' },
        
        // Unpacking operations - 32-bit to 4 bytes
        'Unpack32BE': { params: ['dword'], returns: 'byte[]', description: 'Unpack 32-bit to 4 bytes big-endian' },
        'Unpack32LE': { params: ['dword'], returns: 'byte[]', description: 'Unpack 32-bit to 4 bytes little-endian' },
        'Unpack16BE': { params: ['word'], returns: 'byte[]', description: 'Unpack 16-bit to 2 bytes big-endian' },
        'Unpack16LE': { params: ['word'], returns: 'byte[]', description: 'Unpack 16-bit to 2 bytes little-endian' },
        
        // Byte manipulation
        'GetByte': { params: ['dword', 'int'], returns: 'byte', description: 'Extract byte from 32-bit value' },
        'SetByte': { params: ['dword', 'int', 'byte'], returns: 'dword', description: 'Set byte in 32-bit value' },
        'GetWord': { params: ['dword', 'int'], returns: 'word', description: 'Extract word from 32-bit value' },
        'SetWord': { params: ['dword', 'int', 'word'], returns: 'dword', description: 'Set word in 32-bit value' },
        
        // String/array conversion
        'AnsiToBytes': { params: ['string'], returns: 'byte[]', description: 'Convert ANSI string to bytes' },
        'AsciiToBytes': { params: ['string'], returns: 'byte[]', description: 'Convert ASCII string to bytes' },
        'Hex8ToBytes': { params: ['string'], returns: 'byte[]', description: 'Convert hex string to bytes (8-bit)' },
        'Hex4ToBytes': { params: ['string'], returns: 'byte[]', description: 'Convert hex string to bytes (4-bit)' },
        'BytesToAnsi': { params: ['byte[]'], returns: 'string', description: 'Convert bytes to ANSI string' },
        'BytesToAscii': { params: ['byte[]'], returns: 'string', description: 'Convert bytes to ASCII string' },
        'BytesToHex': { params: ['byte[]'], returns: 'string', description: 'Convert bytes to hex string' },
        
        // Array operations
        'XorArrays': { params: ['byte[]', 'byte[]'], returns: 'byte[]', description: 'XOR two byte arrays' },
        'CopyArray': { params: ['byte[]'], returns: 'byte[]', description: 'Copy byte array' },
        'ClearArray': { params: ['byte[]'], returns: 'void', description: 'Clear byte array' },
        'CompareArrays': { params: ['byte[]', 'byte[]'], returns: 'boolean', description: 'Compare byte arrays' },
        'ConcatArrays': { params: ['byte[]', 'byte[]'], returns: 'byte[]', description: 'Concatenate byte arrays' },
        
        // Bitwise operations
        'SwapBytes': { params: ['word'], returns: 'word', description: 'Swap bytes in 16-bit value' },
        'SwapWords': { params: ['dword'], returns: 'dword', description: 'Swap words in 32-bit value' },
        'ReverseBits': { params: ['byte'], returns: 'byte', description: 'Reverse bits in byte' },
        'CountBits': { params: ['dword'], returns: 'int', description: 'Count set bits' },
        
        // Galois Field operations
        'GF256Mul': { params: ['byte', 'byte'], returns: 'byte', description: 'GF(256) multiplication' },
        'GF256Inv': { params: ['byte'], returns: 'byte', description: 'GF(256) inverse' },
        'GF256Pow': { params: ['byte', 'byte'], returns: 'byte', description: 'GF(256) power' },
        'GFMul': { params: ['dword', 'dword', 'dword', 'int'], returns: 'dword', description: 'Generic GF multiplication' },
        
        // 64-bit operations (qword/long)
        'UInt64.create': { params: ['dword', 'dword'], returns: 'qword', description: 'Create 64-bit from two 32-bit' },
        'UInt64.add': { params: ['qword', 'qword'], returns: 'qword', description: '64-bit addition' },
        'UInt64.sub': { params: ['qword', 'qword'], returns: 'qword', description: '64-bit subtraction' },
        'UInt64.mul': { params: ['qword', 'qword'], returns: 'qword', description: '64-bit multiplication' },
        'UInt64.rotr': { params: ['qword', 'int'], returns: 'qword', description: '64-bit rotate right' },
        'UInt64.rotl': { params: ['qword', 'int'], returns: 'qword', description: '64-bit rotate left' },
        'UInt64.xor': { params: ['qword', 'qword'], returns: 'qword', description: '64-bit XOR' },
        'UInt64.and': { params: ['qword', 'qword'], returns: 'qword', description: '64-bit AND' },
        'UInt64.or': { params: ['qword', 'qword'], returns: 'qword', description: '64-bit OR' },
        'UInt64.shr': { params: ['qword', 'int'], returns: 'qword', description: '64-bit shift right' },
        'UInt64.shl': { params: ['qword', 'int'], returns: 'qword', description: '64-bit shift left' },
        'UInt64.high': { params: ['qword'], returns: 'dword', description: 'Get high 32 bits' },
        'UInt64.low': { params: ['qword'], returns: 'dword', description: 'Get low 32 bits' },
        
        // Floating point operations
        'Float32ToBytes': { params: ['float'], returns: 'byte[]', description: 'Convert 32-bit float to bytes' },
        'BytesToFloat32': { params: ['byte[]'], returns: 'float', description: 'Convert bytes to 32-bit float' },
        'Float64ToBytes': { params: ['double'], returns: 'byte[]', description: 'Convert 64-bit double to bytes' },
        'BytesToFloat64': { params: ['byte[]'], returns: 'double', description: 'Convert bytes to 64-bit double' },
        
        // Endianness operations
        'SwapEndian16': { params: ['word'], returns: 'word', description: 'Swap endianness of 16-bit value' },
        'SwapEndian32': { params: ['dword'], returns: 'dword', description: 'Swap endianness of 32-bit value' },
        'SwapEndian64': { params: ['qword'], returns: 'qword', description: 'Swap endianness of 64-bit value' },
        
        // Hash operations
        'CRC32': { params: ['byte[]'], returns: 'dword', description: 'Calculate CRC32' },
        'CRC16': { params: ['byte[]'], returns: 'word', description: 'Calculate CRC16' },
        'Checksum8': { params: ['byte[]'], returns: 'byte', description: 'Calculate 8-bit checksum' },
        'Checksum16': { params: ['byte[]'], returns: 'word', description: 'Calculate 16-bit checksum' }
      };

      // AlgorithmFramework.js class types and interfaces
      this.frameworkTypes = {
        // Base classes
        'Algorithm': {
          properties: {
            'name': 'string',
            'description': 'string',
            'inventor': 'string',
            'year': 'number',
            'category': 'CategoryType',
            'securityStatus': 'SecurityStatus',
            'complexity': 'ComplexityType'
          },
          methods: {
            'CreateInstance': { params: ['boolean'], returns: 'IAlgorithmInstance' }
          }
        },
        
        'BlockCipherAlgorithm': {
          extends: 'SymmetricCipherAlgorithm',
          properties: {
            'SupportedKeySizes': 'KeySize[]',
            'SupportedBlockSizes': 'KeySize[]'
          }
        },

        'IBlockCipherInstance': {
          extends: 'IAlgorithmInstance',
          properties: {
            'BlockSize': 'number',
            'KeySize': 'number',
            'key': 'number[]',
            'iv': 'number[]'
          },
          methods: {
            'Feed': { params: ['number[]'], returns: 'void' },
            'Result': { params: [], returns: 'number[]' }
          }
        },

        'HashFunctionAlgorithm': {
          extends: 'Algorithm',
          properties: {
            'SupportedOutputSizes': 'KeySize[]'
          }
        },

        'IHashFunctionInstance': {
          extends: 'IAlgorithmInstance',
          properties: {
            'OutputSize': 'number'
          }
        }
      };

      // Enhanced cryptographic patterns with precise types
      this.patternTypes = {
        // Variable name patterns → types
        namePatterns: [
          { pattern: /key|Key/, type: 'byte[]' },
          { pattern: /iv|IV|nonce/, type: 'byte[]' },
          { pattern: /block|Block/, type: 'byte[]' },
          { pattern: /data|Data/, type: 'byte[]' },
          { pattern: /state|State/, type: 'dword[]' },
          { pattern: /sbox|SBox|sBox/, type: 'byte[]' },
          { pattern: /matrix|Matrix/, type: 'byte[][]' },
          { pattern: /hash|Hash|digest|Digest/, type: 'byte[]' },
          { pattern: /size|Size|length|Length/, type: 'int' },
          { pattern: /count|Count|rounds|Rounds/, type: 'int' },
          { pattern: /index|Index|pos|position/, type: 'int' },
          { pattern: /byte|Byte/, type: 'byte' },
          { pattern: /word|Word/, type: 'word' },
          { pattern: /dword|DWord|Dword/, type: 'dword' },
          { pattern: /qword|QWord|Qword/, type: 'qword' },
          { pattern: /temp|Temp|tmp|Tmp/, type: 'dword' }, // Commonly used for intermediate calculations
          { pattern: /mask|Mask/, type: 'dword' },
          { pattern: /shift|Shift/, type: 'int' },
          { pattern: /rotate|Rotate|rot|Rot/, type: 'int' }
        ],

        // Method name patterns → return types
        methodPatterns: [
          { pattern: /encrypt|Encrypt/, type: 'byte[]' },
          { pattern: /decrypt|Decrypt/, type: 'byte[]' },
          { pattern: /hash|Hash/, type: 'byte[]' },
          { pattern: /compute|Compute/, type: 'byte[]' },
          { pattern: /generate|Generate/, type: 'byte[]' },
          { pattern: /create|Create/, type: 'Object' },
          { pattern: /setup|Setup|init|Init/, type: 'void' },
          { pattern: /validate|Validate|verify|Verify/, type: 'boolean' },
          { pattern: /process|Process/, type: 'byte[]' },
          { pattern: /pack|Pack/, type: 'dword' },
          { pattern: /unpack|Unpack/, type: 'byte[]' },
          { pattern: /swap|Swap/, type: 'dword' },
          { pattern: /rotate|Rotate/, type: 'dword' }
        ],

        // Literal value patterns → types
        literalPatterns: [
          { pattern: value => value >= 0 && value <= 255, type: 'byte' },
          { pattern: value => value >= 0 && value <= 65535, type: 'word' },
          { pattern: value => value >= 0 && value <= 4294967295, type: 'dword' },
          { pattern: value => typeof value === 'number' && value % 1 !== 0, type: 'float' },
          { pattern: value => typeof value === 'string', type: 'string' },
          { pattern: value => typeof value === 'boolean', type: 'boolean' }
        ]
      };

      // Type hierarchy and compatibility
      this.typeHierarchy = {
        'byte': { bits: 8, signed: false, category: 'integer', canPromoteTo: ['word', 'dword', 'qword', 'float', 'double'] },
        'sbyte': { bits: 8, signed: true, category: 'integer', canPromoteTo: ['short', 'int', 'long', 'float', 'double'] },
        'word': { bits: 16, signed: false, category: 'integer', canPromoteTo: ['dword', 'qword', 'float', 'double'] },
        'short': { bits: 16, signed: true, category: 'integer', canPromoteTo: ['int', 'long', 'float', 'double'] },
        'dword': { bits: 32, signed: false, category: 'integer', canPromoteTo: ['qword', 'double'] },
        'int': { bits: 32, signed: true, category: 'integer', canPromoteTo: ['long', 'double'] },
        'qword': { bits: 64, signed: false, category: 'integer', canPromoteTo: ['double'] },
        'long': { bits: 64, signed: true, category: 'integer', canPromoteTo: ['double'] },
        'float': { bits: 32, signed: true, category: 'float', canPromoteTo: ['double'] },
        'double': { bits: 64, signed: true, category: 'float', canPromoteTo: [] },
        'boolean': { bits: 1, signed: false, category: 'boolean', canPromoteTo: [] },
        'string': { bits: -1, signed: false, category: 'string', canPromoteTo: [] },
        'void': { bits: 0, signed: false, category: 'void', canPromoteTo: [] }
      };
    }

    /**
     * Forward type inference: propagate types from expressions to assignments
     * @param {Object} assignmentNode - AST node for assignment
     * @param {Object} context - Context information
     */
    forwardInferType(assignmentNode, context = {}) {
      if (assignmentNode.type === 'AssignmentExpression' || assignmentNode.type === 'VariableDeclarator') {
        const leftType = this.inferExpressionType(assignmentNode.left || assignmentNode.id, context);
        const rightType = this.inferExpressionType(assignmentNode.right || assignmentNode.init, context);
        
        // Store forward inference
        const targetName = (assignmentNode.left || assignmentNode.id).name;
        this.forwardInferences.set(targetName, rightType);
        
        // Add type constraint
        this.addTypeConstraint(targetName, rightType, 'forward');
        
        return rightType;
      }
      
      return null;
    }

    /**
     * Backward type inference: propagate types from function signatures to arguments
     * @param {Object} callNode - AST node for function call
     * @param {Object} context - Context information
     */
    backwardInferType(callNode, context = {}) {
      if (callNode.type === 'CallExpression' && callNode.callee.type === 'MemberExpression') {
        const objectName = callNode.callee.object.name;
        const methodName = callNode.callee.property.name;
        
        if (objectName === 'OpCodes' && this.opCodesTypes[methodName]) {
          const methodInfo = this.opCodesTypes[methodName];
          
          // Infer types for each argument based on parameter types
          callNode.arguments.forEach((arg, index) => {
            if (methodInfo.params[index] && arg.type === 'Identifier') {
              const expectedType = methodInfo.params[index];
              this.backwardInferences.set(arg.name, expectedType);
              this.addTypeConstraint(arg.name, expectedType, 'backward');
            }
          });
          
          return methodInfo.returns;
        }
      }
      
      return null;
    }

    /**
     * Add type constraint for a variable
     * @param {string} varName - Variable name
     * @param {string} type - Inferred type
     * @param {string} source - Source of inference ('forward', 'backward', 'pattern', 'literal')
     */
    addTypeConstraint(varName, type, source) {
      if (!this.typeConstraints.has(varName)) {
        this.typeConstraints.set(varName, []);
      }
      
      this.typeConstraints.get(varName).push({
        type: type,
        source: source,
        confidence: this.getConfidenceScore(type, source)
      });
    }

    /**
     * Get confidence score for type inference
     * @param {string} type - Type name
     * @param {string} source - Source of inference
     * @returns {number} Confidence score (0-100)
     */
    getConfidenceScore(type, source) {
      const sourceConfidence = {
        'signature': 100,  // Known method signature
        'forward': 95,     // Forward propagation from assignment
        'backward': 90,    // Backward propagation from function call
        'literal': 85,     // Inferred from literal value
        'pattern': 70,     // Pattern-based inference
        'default': 50      // Default/fallback
      };
      
      return sourceConfidence[source] || sourceConfidence.default;
    }

    /**
     * Resolve final type for a variable considering all constraints
     * @param {string} varName - Variable name
     * @returns {string} Resolved type
     */
    resolveType(varName) {
      const constraints = this.typeConstraints.get(varName);
      if (!constraints || constraints.length === 0) {
        return 'dword'; // Default for unknown types in crypto context
      }
      
      // Sort by confidence and take highest confidence type
      constraints.sort((a, b) => b.confidence - a.confidence);
      const bestType = constraints[0].type;
      
      // Check for type conflicts and resolve them
      const uniqueTypes = [...new Set(constraints.map(c => c.type))];
      if (uniqueTypes.length > 1) {
        return this.resolveTypeConflict(uniqueTypes, constraints);
      }
      
      return bestType;
    }

    /**
     * Resolve conflicts between multiple inferred types
     * @param {string[]} types - Conflicting types
     * @param {Object[]} constraints - All constraints with confidence scores
     * @returns {string} Resolved type
     */
    resolveTypeConflict(types, constraints) {
      // Rule 1: If we have specific OpCodes signature info, trust it most
      const signatureConstraints = constraints.filter(c => c.source === 'signature');
      if (signatureConstraints.length > 0) {
        return signatureConstraints[0].type;
      }
      
      // Rule 2: Promote to largest compatible type
      const hierarchy = ['byte', 'word', 'dword', 'qword', 'float', 'double'];
      let maxType = types[0];
      for (const type of types) {
        if (hierarchy.indexOf(type) > hierarchy.indexOf(maxType)) {
          maxType = type;
        }
      }
      
      return maxType;
    }

    /**
     * Infer type for a variable or parameter based on name and context
     * @param {string} name - Variable/parameter name
     * @param {Object} context - AST context information
     * @returns {string} Inferred type
     */
    inferType(name, context = {}) {
      // Check for existing type constraints
      if (this.typeConstraints.has(name)) {
        return this.resolveType(name);
      }
      
      // Check OpCodes method calls
      if (context.isMethodCall && context.object === 'OpCodes') {
        const methodInfo = this.opCodesTypes[context.method];
        if (methodInfo) {
          return methodInfo.returns;
        }
      }

      // Check framework class context
      if (context.className && this.frameworkTypes[context.className]) {
        const classInfo = this.frameworkTypes[context.className];
        if (context.propertyName && classInfo.properties) {
          return classInfo.properties[context.propertyName] || 'dword';
        }
        if (context.methodName && classInfo.methods) {
          const methodInfo = classInfo.methods[context.methodName];
          return methodInfo ? methodInfo.returns : 'dword';
        }
      }

      // Pattern-based inference
      for (const patternInfo of this.patternTypes.namePatterns) {
        if (patternInfo.pattern.test(name)) {
          this.addTypeConstraint(name, patternInfo.type, 'pattern');
          return patternInfo.type;
        }
      }

      // Default fallback
      return 'dword';
    }

    /**
     * Get parameter types for a method call
     * @param {string} object - Object name (e.g., 'OpCodes')
     * @param {string} method - Method name
     * @returns {string[]} Array of parameter types
     */
    getMethodParameterTypes(object, method) {
      if (object === 'OpCodes' && this.opCodesTypes[method]) {
        return this.opCodesTypes[method].params;
      }

      // Check framework methods
      for (const classInfo of Object.values(this.frameworkTypes)) {
        if (classInfo.methods && classInfo.methods[method]) {
          return classInfo.methods[method].params;
        }
      }

      return [];
    }

    /**
     * Map JavaScript type to target language type with precise bit-width mapping
     * @param {string} jsType - JavaScript type
     * @param {string} targetLanguage - Target language
     * @returns {string} Mapped type in target language
     */
    mapType(jsType, targetLanguage) {
      const typeMappings = {
        java: {
          'byte': 'byte',
          'sbyte': 'byte', 
          'word': 'short',
          'short': 'short',
          'dword': 'int',
          'int': 'int',
          'qword': 'long',
          'long': 'long',
          'float': 'float',
          'double': 'double',
          'boolean': 'boolean',
          'string': 'String',
          'void': 'void',
          'byte[]': 'byte[]',
          'word[]': 'short[]',
          'dword[]': 'int[]',
          'qword[]': 'long[]',
          'Object': 'Object',
          'CategoryType': 'CategoryType',
          'SecurityStatus': 'SecurityStatus',
          'IAlgorithmInstance': 'IAlgorithmInstance'
        },
        csharp: {
          'byte': 'byte',
          'sbyte': 'sbyte',
          'word': 'ushort',
          'short': 'short', 
          'dword': 'uint',
          'int': 'int',
          'qword': 'ulong',
          'long': 'long',
          'float': 'float',
          'double': 'double',
          'boolean': 'bool',
          'string': 'string',
          'void': 'void',
          'byte[]': 'byte[]',
          'word[]': 'ushort[]',
          'dword[]': 'uint[]',
          'qword[]': 'ulong[]',
          'Object': 'object',
          'CategoryType': 'CategoryType',
          'SecurityStatus': 'SecurityStatus',
          'IAlgorithmInstance': 'IAlgorithmInstance'
        },
        cpp: {
          'byte': 'uint8_t',
          'sbyte': 'int8_t',
          'word': 'uint16_t',
          'short': 'int16_t',
          'dword': 'uint32_t',
          'int': 'int32_t',
          'qword': 'uint64_t',
          'long': 'int64_t',
          'float': 'float',
          'double': 'double',
          'boolean': 'bool',
          'string': 'std::string',
          'void': 'void',
          'byte[]': 'std::vector<uint8_t>',
          'word[]': 'std::vector<uint16_t>',
          'dword[]': 'std::vector<uint32_t>',
          'qword[]': 'std::vector<uint64_t>',
          'Object': 'std::any',
          'CategoryType': 'CategoryType',
          'SecurityStatus': 'SecurityStatus'
        },
        typescript: {
          'byte': 'number',
          'sbyte': 'number',
          'word': 'number',
          'short': 'number',
          'dword': 'number',
          'int': 'number',
          'qword': 'bigint',
          'long': 'bigint',
          'float': 'number',
          'double': 'number',
          'boolean': 'boolean',
          'string': 'string',
          'void': 'void',
          'byte[]': 'Uint8Array',
          'word[]': 'Uint16Array',
          'dword[]': 'Uint32Array',
          'qword[]': 'BigUint64Array',
          'Object': 'object',
          'CategoryType': 'CategoryType',
          'SecurityStatus': 'SecurityStatus'
        },
        python: {
          'byte': 'int',
          'sbyte': 'int',
          'word': 'int',
          'short': 'int',
          'dword': 'int',
          'int': 'int',
          'qword': 'int',
          'long': 'int',
          'float': 'float',
          'double': 'float',
          'boolean': 'bool',
          'string': 'str',
          'void': 'None',
          'byte[]': 'bytes',
          'word[]': 'List[int]',
          'dword[]': 'List[int]',
          'qword[]': 'List[int]',
          'Object': 'object',
          'CategoryType': 'CategoryType',
          'SecurityStatus': 'SecurityStatus'
        }
      };

      const mapping = typeMappings[targetLanguage];
      return mapping ? (mapping[jsType] || jsType) : jsType;
    }
  }

  /**
   * Enhanced AST Parser with Type Awareness
   * Extends the original parser to extract and use type information
   */
  class TypeAwareJSASTParser {
    constructor(code) {
      this.code = code;
      this.tokens = [];
      this.position = 0;
      this.currentToken = null;
      this.jsDocParser = new JSDocParser();
      this.typeKnowledge = new PreciseTypeKnowledge();
      this.typeAnnotations = new Map(); // Store type information for nodes
    }

    /**
     * Modern JavaScript tokenizer with proper context-sensitive parsing
     */
    tokenize() {
      this.tokens = [];
      this.normalizedCode = this.code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      let pos = 0;
      let line = 1;
      let column = 1;
      
      while (pos < this.normalizedCode.length) {
        // Skip whitespace but track line/column
        if (this.isWhitespace(pos, this.normalizedCode)) {
          if (this.normalizedCode[pos] === '\n') {
            line++;
            column = 1;
          } else {
            column++;
          }
          pos++;
          continue;
        }
        
        let token = this.scanToken(pos, line, column);
        if (token) {
          this.tokens.push(token);
          pos = token.end;
          column += token.value.length;
          
          // Update line/column for multi-line tokens
          for (let i = 0; i < token.value.length; i++) {
            if (token.value[i] === '\n') {
              line++;
              column = 1;
            }
          }
        } else {
          // Skip unknown character
          console.warn(`Skipping character at position ${pos}: '${this.normalizedCode[pos]}'`);
          pos++;
          column++;
        }
      }
      
      return this.tokens;
    }
    
    isWhitespace(pos, normalizedCode) {
      return /\s/.test(normalizedCode[pos]);
    }
    
    scanToken(pos, line, column) {
      const char = this.normalizedCode[pos];
      const next = this.normalizedCode[pos + 1];
      
      // Multi-character operators and comments
      if (char === '/' && next === '/') {
        return this.scanSingleLineComment(pos);
      }
      if (char === '/' && next === '*') {
        return this.scanMultiLineComment(pos);
      }
      
      // Shebang (only at very start)
      if (pos === 0 && char === '#' && next === '!') {
        return this.scanShebang(pos);
      }
      
      // String literals
      if (char === '"' || char === "'") {
        return this.scanString(pos, char);
      }
      
      // Template literals
      if (char === '`') {
        return this.scanTemplateLiteral(pos);
      }
      
      // Regular expression literals (context-sensitive)
      if (char === '/' && this.canStartRegex()) {
        return this.scanRegex(pos);
      }
      
      // Numbers
      if (this.isDigit(char) || (char === '.' && this.isDigit(next))) {
        return this.scanNumber(pos);
      }
      
      // Identifiers and keywords
      if (this.isIdentifierStart(char)) {
        return this.scanIdentifier(pos);
      }
      
      // Multi-character operators
      const multiOp = this.scanMultiCharOperator(pos);
      if (multiOp) return multiOp;
      
      // Single-character tokens
      return this.scanSingleChar(pos);
    }
    
    scanSingleLineComment(pos) {
      let end = pos + 2;
      while (end < this.normalizedCode.length && this.normalizedCode[end] !== '\n') {
        end++;
      }
      return {
        type: 'COMMENT_SINGLE',
        value: this.normalizedCode.slice(pos, end),
        position: pos,
        end: end
      };
    }
    
    scanMultiLineComment(pos) {
      let end = pos + 2;
      while (end < this.normalizedCode.length - 1) {
        if (this.normalizedCode[end] === '*' && this.normalizedCode[end + 1] === '/') {
          end += 2;
          break;
        }
        end++;
      }
      return {
        type: 'COMMENT_MULTI',
        value: this.normalizedCode.slice(pos, end),
        position: pos,
        end: end
      };
    }
    
    scanShebang(pos) {
      let end = pos + 2;
      while (end < this.normalizedCode.length && this.normalizedCode[end] !== '\n') {
        end++;
      }
      return {
        type: 'SHEBANG',
        value: this.normalizedCode.slice(pos, end),
        position: pos,
        end: end
      };
    }
    
    scanString(pos, quote) {
      let end = pos + 1;
      while (end < this.normalizedCode.length) {
        const char = this.normalizedCode[end];
        if (char === quote) {
          end++;
          break;
        }
        if (char === '\\') {
          end += 2; // Skip escaped character
        } else {
          end++;
        }
      }
      return {
        type: 'STRING',
        value: this.normalizedCode.slice(pos, end),
        position: pos,
        end: end
      };
    }
    
    scanTemplateLiteral(pos) {
      let end = pos + 1;
      while (end < this.normalizedCode.length) {
        const char = this.normalizedCode[end];
        if (char === '`') {
          end++;
          break;
        }
        if (char === '\\') {
          end += 2; // Skip escaped character
        } else {
          end++;
        }
      }
      return {
        type: 'TEMPLATE_LITERAL',
        value: this.normalizedCode.slice(pos, end),
        position: pos,
        end: end
      };
    }
    
    scanRegex(pos) {
      let end = pos + 1;
      let inCharacterClass = false;
      
      while (end < this.normalizedCode.length) {
        const char = this.normalizedCode[end];
        
        if (char === '\\') {
          end += 2; // Skip escaped character
          continue;
        }
        
        if (char === '[' && !inCharacterClass) {
          inCharacterClass = true;
        } else if (char === ']' && inCharacterClass) {
          inCharacterClass = false;
        } else if (char === '/' && !inCharacterClass) {
          // End of regex found (not inside character class)
          end++;
          // Scan flags
          while (end < this.normalizedCode.length && /[gimuy]/.test(this.normalizedCode[end])) {
            end++;
          }
          break;
        } else if (char === '\n') {
          break; // Invalid regex
        }
        
        end++;
      }
      
      return {
        type: 'REGEX',
        value: this.normalizedCode.slice(pos, end),
        position: pos,
        end: end
      };
    }
    
    scanNumber(pos) {
      let end = pos;
      
      // Handle hex, binary, octal
      if (this.normalizedCode[end] === '0' && end + 1 < this.normalizedCode.length) {
        const prefix = this.normalizedCode[end + 1].toLowerCase();
        if (prefix === 'x') {
          end += 2;
          while (end < this.normalizedCode.length && /[0-9a-fA-F]/.test(this.normalizedCode[end])) {
            end++;
          }
          // Check for BigInt suffix 'n' for hex numbers
          const isBigInt = (end < this.normalizedCode.length && this.normalizedCode[end] === 'n');
          if (isBigInt) {
            end++; // Include the 'n' in the token
          }
          return { 
            type: isBigInt ? 'BIGINT' : 'NUMBER', 
            value: this.normalizedCode.slice(pos, end), 
            position: pos, 
            end: end 
          };
        }
        if (prefix === 'b') {
          end += 2;
          while (end < this.normalizedCode.length && /[01]/.test(this.normalizedCode[end])) {
            end++;
          }
          // Check for BigInt suffix 'n' for binary numbers
          const isBigInt = (end < this.normalizedCode.length && this.normalizedCode[end] === 'n');
          if (isBigInt) {
            end++; // Include the 'n' in the token
          }
          return { 
            type: isBigInt ? 'BIGINT' : 'NUMBER', 
            value: this.normalizedCode.slice(pos, end), 
            position: pos, 
            end: end 
          };
        }
        if (prefix === 'o') {
          end += 2;
          while (end < this.normalizedCode.length && /[0-7]/.test(this.normalizedCode[end])) {
            end++;
          }
          // Check for BigInt suffix 'n' for octal numbers
          const isBigInt = (end < this.normalizedCode.length && this.normalizedCode[end] === 'n');
          if (isBigInt) {
            end++; // Include the 'n' in the token
          }
          return { 
            type: isBigInt ? 'BIGINT' : 'NUMBER', 
            value: this.normalizedCode.slice(pos, end), 
            position: pos, 
            end: end 
          };
        }
      }
      
      // Regular decimal number
      while (end < this.normalizedCode.length && this.isDigit(this.normalizedCode[end])) {
        end++;
      }
      
      // Decimal point
      if (end < this.normalizedCode.length && this.normalizedCode[end] === '.') {
        end++;
        while (end < this.normalizedCode.length && this.isDigit(this.normalizedCode[end])) {
          end++;
        }
      }
      
      // Exponent
      if (end < this.normalizedCode.length && /[eE]/.test(this.normalizedCode[end])) {
        end++;
        if (end < this.normalizedCode.length && /[+-]/.test(this.normalizedCode[end])) {
          end++;
        }
        while (end < this.normalizedCode.length && this.isDigit(this.normalizedCode[end])) {
          end++;
        }
      }
      
      // Check for BigInt suffix 'n'
      const isBigInt = (end < this.normalizedCode.length && this.normalizedCode[end] === 'n');
      if (isBigInt) {
        end++; // Include the 'n' in the token
      }
      
      return {
        type: isBigInt ? 'BIGINT' : 'NUMBER',
        value: this.normalizedCode.slice(pos, end),
        position: pos,
        end: end
      };
    }
    
    scanIdentifier(pos) {
      let end = pos;
      while (end < this.normalizedCode.length && this.isIdentifierPart(this.normalizedCode[end])) {
        end++;
      }
      
      const value = this.normalizedCode.slice(pos, end);
      const keywords = new Set([
        'class', 'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
        'return', 'this', 'new', 'static', 'get', 'set', 'async', 'await',
        'export', 'import', 'default', 'from', 'as', 'extends', 'constructor',
        'throw', 'typeof', 'undefined', 'null', 'true', 'false', 'break',
        'continue', 'try', 'catch', 'finally', 'switch', 'case', 'do', 'with',
        'in', 'of', 'instanceof', 'delete', 'void'
      ]);
      
      return {
        type: keywords.has(value) ? 'KEYWORD' : 'IDENTIFIER',
        value: value,
        position: pos,
        end: end
      };
    }
    
    scanMultiCharOperator(pos) {
      const operators = [
        '>>>=', '===', '!==', '>>>', '<<<', '>>=', '<<=', '&&', '||',
        '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
        '==', '!=', '<=', '>=', '>>', '<<', '=>', '...', '?.'
      ];
      
      for (const op of operators) {
        if (this.normalizedCode.substr(pos, op.length) === op) {
          return {
            type: op === '=>' ? 'ARROW' : 'OPERATOR',
            value: op,
            position: pos,
            end: pos + op.length
          };
        }
      }
      
      return null;
    }
    
    scanSingleChar(pos) {
      const char = this.normalizedCode[pos];
      
      if ('(){}[];,.:?'.includes(char)) {
        return {
          type: 'PUNCTUATION',
          value: char,
          position: pos,
          end: pos + 1
        };
      }
      
      if ('+-*/%<>=!&|^~'.includes(char)) {
        return {
          type: 'OPERATOR',
          value: char,
          position: pos,
          end: pos + 1
        };
      }
      
      return null;
    }
    
    canStartRegex() {
      // Improved heuristic: regex can start after certain operators, keywords, or punctuation
      // but not after identifiers, numbers, or closing parentheses/brackets (where it would be division)
      if (this.tokens.length === 0) return true;
      
      const lastToken = this.tokens[this.tokens.length - 1];
      
      // Cannot be regex after identifiers or numbers (division)
      if (lastToken.type === 'IDENTIFIER' || lastToken.type === 'NUMBER') {
        return false;
      }
      
      // Cannot be regex after closing punctuation (division)  
      if (lastToken.type === 'PUNCTUATION' && [')', ']', '}'].includes(lastToken.value)) {
        return false;
      }
      
      // Can be regex after these operators and keywords
      if (lastToken.type === 'OPERATOR' && ['=', '==', '===', '!=', '!==', '(', '[', '{', ',', ';', ':', '?', '!', '&', '|', '^', '~', '+', '-', '*', '%', '<', '>', '<=', '>=', '<<', '>>', '>>>', '&&', '||'].includes(lastToken.value)) {
        return true;
      }
      
      if (lastToken.type === 'KEYWORD' && ['return', 'throw', 'case', 'in', 'of', 'delete', 'void', 'typeof', 'new', 'instanceof'].includes(lastToken.value)) {
        return true;
      }
      
      if (lastToken.type === 'PUNCTUATION' && ['(', '[', '{', ',', ';', ':'].includes(lastToken.value)) {
        return true;
      }
      
      if (lastToken.type === 'ARROW') {
        return true;
      }
      
      return false;
    }
    
    isDigit(char) {
      return /[0-9]/.test(char);
    }
    
    isIdentifierStart(char) {
      return /[a-zA-Z_$]/.test(char);
    }
    
    isIdentifierPart(char) {
      return /[a-zA-Z0-9_$]/.test(char);
    }

    /**
     * Parse tokens into AST
     */
    parse() {
      if (this.tokens.length === 0) {
        this.tokenize();
      }
      this.position = 0;
      this.currentToken = this.tokens[0];
      
      return this.parseProgram();
    }

    /**
     * Parse a complete program
     */
    parseProgram() {
      const statements = [];
      
      // Skip shebang line if present
      if (this.currentToken && this.currentToken.type === 'SHEBANG') {
        this.nextToken();
      }
      
      while (this.currentToken) {
        // Skip comments at the program level
        this.skipComments();
        if (!this.currentToken) break;
        
        const stmt = this.parseStatement();
        if (stmt) {
          statements.push(stmt);
        }
      }
      
      return {
        type: 'Program',
        body: statements
      };
    }

    /**
     * Parse a statement
     */
    parseStatement() {
      if (!this.currentToken) return null;
      
      // Skip comments at statement level
      this.skipComments();
      if (!this.currentToken) return null;
      
      switch (this.currentToken.type) {
        case 'COMMENT_SINGLE':
        case 'COMMENT_MULTI':
          return this.parseComment();
        case 'KEYWORD':
          switch (this.currentToken.value) {
            case 'class': return this.parseClass();
            case 'function': return this.parseFunction();
            case 'const':
            case 'let':
            case 'var': return this.parseVariableDeclaration();
            case 'if': return this.parseIfStatement();
            case 'for': return this.parseForStatement();
            case 'while': return this.parseWhileStatement();
            case 'do': return this.parseDoWhileStatement();
            case 'try': return this.parseTryStatement();
            case 'throw': return this.parseThrowStatement();
            case 'break': return this.parseBreakStatement();
            case 'continue': return this.parseContinueStatement();
            case 'switch': return this.parseSwitchStatement();
            case 'return': return this.parseReturnStatement();
            case 'export': return this.parseExportStatement();
            case 'import': return this.parseImportStatement();
            default: return this.parseExpressionStatement();
          }
        case 'PUNCTUATION':
          if (this.currentToken.value === '{') {
            return this.parseBlockStatement();
          }
          return this.parseExpressionStatement();
        default:
          return this.parseExpressionStatement();
      }
    }

    /**
     * Parse a class declaration
     */
    parseClass() {
      const node = { type: 'ClassDeclaration' };
      
      this.consume('KEYWORD', 'class');
      node.id = this.parseIdentifier();
      
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'extends') {
        this.advance();
        // Parse the superclass which can be either an Identifier or MemberExpression
        node.superClass = this.parseMemberOrIdentifier();
      }
      
      this.consume('PUNCTUATION', '{');
      
      node.body = [];
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        this.skipComments(); // Skip any comments before class members
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}') {
          break; // Exit if we encounter closing brace after skipping comments
        }
        
        const member = this.parseClassMember();
        if (member) {
          node.body.push(member);
        }
      }
      
      this.consume('PUNCTUATION', '}');
      
      return node;
    }

    /**
     * Parse a class expression
     */
    parseClassExpression() {
      const node = { type: 'ClassExpression' };
      
      this.consume('KEYWORD', 'class');
      
      // Class expressions can have optional names
      if (this.currentToken && this.currentToken.type === 'IDENTIFIER') {
        node.id = this.parseIdentifier();
      } else {
        node.id = null;
      }
      
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'extends') {
        this.advance();
        // Parse the superclass which can be either an Identifier or MemberExpression
        node.superClass = this.parseMemberOrIdentifier();
      }
      
      this.consume('PUNCTUATION', '{');
      
      node.body = [];
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        const method = this.parseClassMethod();
        if (method) {
          node.body.push(method);
        }
      }
      
      this.consume('PUNCTUATION', '}');
      
      return node;
    }

    /**
     * Parse a class member (method or field)
     */
    parseClassMember() {
      // Look ahead to determine if this is a field declaration or method
      let lookahead = this.position;
      
      // Skip 'static' if present
      if (this.tokens[lookahead] && this.tokens[lookahead].type === 'KEYWORD' && this.tokens[lookahead].value === 'static') {
        lookahead++; // Move past 'static'
      }
      
      // Look for identifier followed by = (field) or ( (method)
      if (lookahead < this.tokens.length - 1) {
        const identifierToken = this.tokens[lookahead];
        const nextToken = this.tokens[lookahead + 1];
        
        if (identifierToken && identifierToken.type === 'IDENTIFIER' && 
            nextToken && nextToken.type === 'OPERATOR' && nextToken.value === '=') {
          // This is a field declaration like: static FIELD = value;
          return this.parseClassField();
        }
      }
      
      // Otherwise, it's a method
      return this.parseClassMethod();
    }

    /**
     * Parse a class field declaration
     */
    parseClassField() {
      const node = { 
        type: 'FieldDefinition',
        static: false,
        key: null,
        value: null
      };
      
      // Handle 'static' modifier
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'static') {
        node.static = true;
        this.advance();
      }
      
      // Parse field name
      if (this.currentToken && this.currentToken.type === 'IDENTIFIER') {
        node.key = this.parseIdentifier();
      } else {
        throw new Error(`Expected field name, got: ${this.currentToken ? this.currentToken.type : 'EOF'}`);
      }
      
      // Expect '=' for initialization
      this.consume('OPERATOR', '=');
      
      // Parse the initial value
      node.value = this.parseExpression();
      
      // Expect semicolon
      this.expectSemicolon();
      
      return node;
    }

    /**
     * Parse a class method with type information
     */
    parseClassMethod() {
      const node = { type: 'MethodDefinition' };
      
      // Handle static, get, set modifiers (can be combined)
      while (this.currentToken && this.currentToken.type === 'KEYWORD') {
        if (this.currentToken.value === 'static') {
          node.static = true;
          this.advance();
        } else if (this.currentToken.value === 'get') {
          node.kind = 'get';
          this.advance();
        } else if (this.currentToken.value === 'set') {
          node.kind = 'set';
          this.advance();
        } else {
          break; // Exit if we encounter a keyword that's not a modifier
        }
      }
      
      if (!node.kind) {
        node.kind = 'method';
      }
      
      // Constructor or method name
      if (this.currentToken && (this.currentToken.type === 'IDENTIFIER' || 
          (this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'constructor'))) {
        if (this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'constructor') {
          node.key = { type: 'Identifier', name: 'constructor' };
          node.kind = 'constructor';
          this.advance();
        } else {
          node.key = this.parseIdentifier();
          if (node.key.name === 'constructor') {
            node.kind = 'constructor';
          }
        }
      }
      
      // Parse function
      node.value = this.parseFunctionExpression();
      
      // Extract type information for this method
      return this.parseMethodWithTypes(node);
    }

    /**
     * Parse array pattern for destructuring [a, b, c]
     */
    parseArrayPattern() {
      const node = { type: 'ArrayPattern', elements: [] };
      
      this.consume('PUNCTUATION', '[');
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ']')) {
        if (this.currentToken.type === 'IDENTIFIER') {
          node.elements.push(this.parseIdentifier());
        } else {
          // Handle empty elements or other patterns
          node.elements.push(null);
        }
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
        }
      }
      
      this.consume('PUNCTUATION', ']');
      
      return node;
    }

    /**
     * Parse object pattern for destructuring {a, b, c}
     */
    parseObjectPattern() {
      const node = { type: 'ObjectPattern', properties: [] };
      
      this.consume('PUNCTUATION', '{');
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        const property = { type: 'Property' };
        
        if (this.currentToken.type === 'IDENTIFIER') {
          const id = this.parseIdentifier();
          property.key = id;
          property.value = id; // shorthand property
          property.shorthand = true;
        } else {
          throw new Error(`Expected identifier in object pattern, got: ${this.currentToken.type}`);
        }
        
        node.properties.push(property);
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
        }
      }
      
      this.consume('PUNCTUATION', '}');
      
      return node;
    }

    /**
     * Parse variable declaration
     */
    parseVariableDeclaration(consumeSemicolon = true) {
      const node = { type: 'VariableDeclaration' };
      
      node.kind = this.currentToken.value; // const, let, var
      this.advance();
      
      node.declarations = [];
      
      do {
        const declarator = { type: 'VariableDeclarator' };
        
        // Check for array destructuring pattern [a, b] = ...
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '[') {
          declarator.id = this.parseArrayPattern();
        } 
        // Check for object destructuring pattern {a, b} = ...
        else if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '{') {
          declarator.id = this.parseObjectPattern();
        } 
        else {
          // Regular identifier
          declarator.id = this.parseIdentifier();
        }
        
        if (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '=') {
          this.advance();
          declarator.init = this.parseExpression();
        }
        
        node.declarations.push(declarator);
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
        } else {
          break;
        }
      } while (this.currentToken);
      
      if (consumeSemicolon && this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ';') {
        this.advance();
      }
      
      return node;
    }

    /**
     * Parse function declaration
     */
    parseFunction() {
      const node = { type: 'FunctionDeclaration' };
      
      this.consume('KEYWORD', 'function');
      node.id = this.parseIdentifier();
      node.params = this.parseParameterList();
      node.body = this.parseBlockStatement();
      
      return node;
    }

    /**
     * Parse function expression
     */
    parseFunctionExpression() {
      const node = { type: 'FunctionExpression' };
      
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'function') {
        this.advance();
      }
      
      node.params = this.parseParameterList();
      
      if (this.currentToken && this.currentToken.type === 'ARROW') {
        node.type = 'ArrowFunctionExpression';
        this.advance();
      }
      
      node.body = this.parseBlockStatement();
      
      return node;
    }

    /**
     * Parse parameter list
     */
    parseParameterList() {
      const params = [];
      
      this.consume('PUNCTUATION', '(');
      this.skipComments();
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ')')) {
        this.skipComments();
        
        // Parse parameter name
        const param = this.parseIdentifier();
        
        this.skipComments();
        
        // Check for default value (e.g., param = defaultValue)
        if (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '=') {
          this.advance(); // consume '='
          
          // Parse default value as full assignment expression
          this.skipComments();
          const defaultValue = this.parseAssignmentExpression();
          param.defaultValue = defaultValue;
        }
        
        params.push(param);
        
        this.skipComments();
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
          this.skipComments();
        }
      }
      
      this.consume('PUNCTUATION', ')');
      
      return params;
    }

    /**
     * Parse block statement
     */
    parseBlockStatement() {
      const node = { type: 'BlockStatement', body: [] };
      
      this.consume('PUNCTUATION', '{');
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        // Skip comments at block level
        this.skipComments();
        
        // Check again after skipping comments
        if (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
          const stmt = this.parseStatement();
          if (stmt) {
            node.body.push(stmt);
          }
        }
      }
      
      this.consume('PUNCTUATION', '}');
      
      return node;
    }

    /**
     * Parse expression statement
     */
    parseExpressionStatement() {
      const node = { type: 'ExpressionStatement' };
      node.expression = this.parseExpression();
      
      if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ';') {
        this.advance();
      }
      
      return node;
    }

    /**
     * Parse expression (handles comma/sequence operator)
     */
    parseExpression() {
      const expressions = [this.parseAssignmentExpression()];
      
      while (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
        this.advance(); // consume ','
        this.skipComments();
        expressions.push(this.parseAssignmentExpression());
      }
      
      if (expressions.length === 1) {
        return expressions[0];
      }
      
      return {
        type: 'SequenceExpression',
        expressions: expressions
      };
    }

    /**
     * Parse assignment expression
     */
    parseAssignmentExpression() {
      let left = this.parseConditionalExpression();
      
      // Check for arrow function: identifier => expression or (params) => expression
      if (this.currentToken && this.currentToken.type === 'ARROW') {
        // Convert left side to parameters
        let params = [];
        if (left.type === 'Identifier') {
          // Single parameter without parentheses
          params = [left];
        } else if (left.type === 'SequenceExpression') {
          // Multiple parameters from parentheses (parsed as sequence)
          params = left.expressions || [];
        } else {
          // Assume single expression parameter
          params = [left];
        }
        
        const node = { type: 'ArrowFunctionExpression' };
        node.params = params;
        this.advance(); // consume '=>'
        
        // Parse function body (expression or block)
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '{') {
          node.body = this.parseBlockStatement();
          node.expression = false;
        } else {
          node.body = this.parseAssignmentExpression();
          node.expression = true;
        }
        
        return node;
      }
      
      // Regular assignment expression
      if (this.currentToken && this.currentToken.type === 'OPERATOR' && 
          ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>='].includes(this.currentToken.value)) {
        const node = { type: 'AssignmentExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseAssignmentExpression();
        return node;
      }
      
      return left;
    }

    /**
     * Parse conditional expression (ternary operator: condition ? true : false)
     */
    parseConditionalExpression() {
      let left = this.parseLogicalOrExpression();
      
      if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '?') {
        const node = { type: 'ConditionalExpression' };
        node.test = left;
        this.advance(); // consume '?'
        node.consequent = this.parseAssignmentExpression();
        this.expect('PUNCTUATION', ':');
        node.alternate = this.parseAssignmentExpression();
        return node;
      }
      
      return left;
    }

    /**
     * Parse logical OR expression
     */
    parseLogicalOrExpression() {
      let left = this.parseLogicalAndExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '||') {
        const node = { type: 'LogicalExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseLogicalAndExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse logical AND expression
     */
    parseLogicalAndExpression() {
      let left = this.parseBitwiseOrExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '&&') {
        const node = { type: 'LogicalExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseBitwiseOrExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse bitwise OR expression
     */
    parseBitwiseOrExpression() {
      let left = this.parseBitwiseXorExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '|') {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseBitwiseXorExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse bitwise XOR expression
     */
    parseBitwiseXorExpression() {
      let left = this.parseBitwiseAndExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '^') {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseBitwiseAndExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse bitwise AND expression
     */
    parseBitwiseAndExpression() {
      let left = this.parseEqualityExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '&') {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseEqualityExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse equality expression
     */
    parseEqualityExpression() {
      let left = this.parseRelationalExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && 
             ['==', '!=', '===', '!=='].includes(this.currentToken.value)) {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseRelationalExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse relational expression
     */
    parseRelationalExpression() {
      let left = this.parseShiftExpression();
      
      while (this.currentToken && 
             ((this.currentToken.type === 'OPERATOR' && ['<', '>', '<=', '>='].includes(this.currentToken.value)) ||
              (this.currentToken.type === 'KEYWORD' && ['in', 'instanceof'].includes(this.currentToken.value)))) {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseShiftExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse shift expression
     */
    parseShiftExpression() {
      let left = this.parseAdditiveExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && 
             ['<<', '>>', '>>>'].includes(this.currentToken.value)) {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseAdditiveExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse additive expression
     */
    parseAdditiveExpression() {
      let left = this.parseMultiplicativeExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && 
             ['+', '-'].includes(this.currentToken.value)) {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseMultiplicativeExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse multiplicative expression
     */
    parseMultiplicativeExpression() {
      let left = this.parseUnaryExpression();
      
      while (this.currentToken && this.currentToken.type === 'OPERATOR' && 
             ['*', '/', '%'].includes(this.currentToken.value)) {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseUnaryExpression();
        left = node;
      }
      
      return left;
    }

    /**
     * Parse unary expression
     */
    parseUnaryExpression() {
      // Handle unary operators (OPERATOR type)
      if (this.currentToken && this.currentToken.type === 'OPERATOR' && 
          ['+', '-', '!', '~', '++', '--'].includes(this.currentToken.value)) {
        const node = { type: 'UnaryExpression' };
        node.operator = this.currentToken.value;
        node.prefix = true;
        this.advance();
        node.argument = this.parseUnaryExpression();
        return node;
      }
      
      // Handle unary keywords (KEYWORD type)
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && 
          ['delete', 'typeof', 'void'].includes(this.currentToken.value)) {
        const node = { type: 'UnaryExpression' };
        node.operator = this.currentToken.value;
        node.prefix = true;
        this.advance();
        node.argument = this.parseUnaryExpression();
        return node;
      }
      
      return this.parsePostfixExpression();
    }

    /**
     * Parse postfix expression
     */
    parsePostfixExpression() {
      let left = this.parseCallExpression();
      
      if (this.currentToken && this.currentToken.type === 'OPERATOR' && 
          ['++', '--'].includes(this.currentToken.value)) {
        const node = { type: 'UpdateExpression' };
        node.operator = this.currentToken.value;
        node.prefix = false;
        node.argument = left;
        this.advance();
        return node;
      }
      
      return left;
    }

    /**
     * Parse call expression
     */
    parseCallExpression() {
      let left = this.parseMemberExpression();
      
      while (this.currentToken && this.currentToken.type === 'PUNCTUATION' && 
             (['(', '.', '['].includes(this.currentToken.value))) {
        if (this.currentToken.value === '(') {
          // Function call
          const node = { type: 'CallExpression' };
          node.callee = left;
          node.arguments = this.parseArgumentList();
          left = node;
        } else if (this.currentToken.value === '.') {
          // Member access
          const node = { type: 'MemberExpression' };
          node.object = left;
          this.advance(); // consume '.'
          this.skipComments(); // Skip comments after the dot
          node.property = this.parseIdentifier();
          node.computed = false;
          left = node;
        } else if (this.currentToken.value === '[') {
          // Computed member access
          const node = { type: 'MemberExpression' };
          node.object = left;
          this.advance(); // consume '['
          this.skipComments(); // Skip comments after the bracket
          node.property = this.parseExpression();
          this.consume('PUNCTUATION', ']');
          node.computed = true;
          left = node;
        }
      }
      
      return left;
    }

    /**
     * Parse member expression
     */
    parseMemberExpression() {
      let left = this.parsePrimaryExpression();
      
      while (this.currentToken && 
             ((this.currentToken.type === 'PUNCTUATION' && ['.', '['].includes(this.currentToken.value)) ||
              (this.currentToken.type === 'OPERATOR' && this.currentToken.value === '?.'))) {
        const node = { type: 'MemberExpression' };
        node.object = left;
        
        if (this.currentToken.value === '.') {
          this.advance();
          this.skipComments(); // Skip comments after the dot
          node.property = this.parsePropertyName();
          node.computed = false;
        } else if (this.currentToken.value === '?.') {
          node.optional = true;
          this.advance(); // consume '?.'
          this.skipComments();
          
          // Check if this is optional computed access (?.[...]) 
          if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '[') {
            this.advance(); // consume '['
            this.skipComments();
            node.property = this.parseExpression();
            this.consume('PUNCTUATION', ']');
            node.computed = true;
          } else {
            // Optional property access (?.prop)
            node.property = this.parsePropertyName();
            node.computed = false;
          }
        } else { // '['
          this.advance();
          this.skipComments(); // Skip comments after the bracket
          node.property = this.parseExpression();
          this.consume('PUNCTUATION', ']');
          node.computed = true;
        }
        
        left = node;
      }
      
      return left;
    }

    /**
     * Parse primary expression
     */
    parsePrimaryExpression() {
      if (!this.currentToken) return null;
      
      // Skip any comments before parsing expressions
      this.skipComments();
      if (!this.currentToken) return null;
      
      switch (this.currentToken.type) {
        case 'IDENTIFIER':
          return this.parseIdentifier();
        case 'NUMBER':
          return this.parseNumber();
        case 'BIGINT':
          return this.parseBigInt();
        case 'STRING':
          return this.parseString();
        case 'TEMPLATE_LITERAL':
          return this.parseTemplateLiteral();
        case 'REGEX':
          return this.parseRegex();
        case 'KEYWORD':
          if (this.currentToken.value === 'this') {
            this.advance();
            return { type: 'ThisExpression' };
          } else if (this.currentToken.value === 'new') {
            return this.parseNewExpression();
          } else if (this.currentToken.value === 'function') {
            return this.parseFunctionExpression();
          } else if (this.currentToken.value === 'class') {
            return this.parseClassExpression();
          } else if (this.currentToken.value === 'typeof') {
            this.advance();
            return {
              type: 'UnaryExpression',
              operator: 'typeof',
              argument: this.parseUnaryExpression(),
              prefix: true
            };
          } else if (['undefined', 'null', 'true', 'false'].includes(this.currentToken.value)) {
            const value = this.currentToken.value;
            this.advance();
            return {
              type: 'Literal',
              value: value === 'undefined' ? undefined : 
                     value === 'null' ? null :
                     value === 'true' ? true :
                     value === 'false' ? false : value
            };
          }
          break;
        case 'PUNCTUATION':
          if (this.currentToken.value === '(') {
            this.advance();
            
            // Check if parentheses are empty
            if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ')') {
              this.advance();
              return { type: 'SequenceExpression', expressions: [] };
            }
            
            // Parse first expression
            let expr = this.parseAssignmentExpression();
            
            // Check for comma-separated expressions (potential arrow function params)
            if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
              const expressions = [expr];
              
              while (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
                this.advance(); // consume ','
                expressions.push(this.parseAssignmentExpression());
              }
              
              this.consume('PUNCTUATION', ')');
              return {
                type: 'SequenceExpression',
                expressions: expressions
              };
            }
            
            this.consume('PUNCTUATION', ')');
            return expr;
          } else if (this.currentToken.value === '[') {
            return this.parseArrayExpression();
          } else if (this.currentToken.value === '{') {
            return this.parseObjectExpression();
          }
          break;
      }
      
      throw new Error(`Unexpected token: ${this.currentToken.type} ${this.currentToken.value}`);
    }

    /**
     * Parse property name (can be identifier or keyword)
     */
    parsePropertyName() {
      if (!this.currentToken || (this.currentToken.type !== 'IDENTIFIER' && this.currentToken.type !== 'KEYWORD')) {
        throw new Error(`Expected property name, got: ${this.currentToken ? this.currentToken.type : 'EOF'}`);
      }
      
      const node = { type: 'Identifier', name: this.currentToken.value };
      this.advance();
      return node;
    }

    /**
     * Parse identifier
     */
    parseIdentifier() {
      if (!this.currentToken || this.currentToken.type !== 'IDENTIFIER') {
        throw new Error(`Expected identifier, got: ${this.currentToken ? this.currentToken.type : 'EOF'}`);
      }
      
      const node = { type: 'Identifier', name: this.currentToken.value };
      this.advance();
      return node;
    }

    /**
     * Parse number
     */
    parseNumber() {
      const node = { type: 'Literal', value: parseFloat(this.currentToken.value) };
      this.advance();
      return node;
    }

    /**
     * Parse BigInt
     */
    parseBigInt() {
      // Remove the 'n' suffix and convert to BigInt
      const valueStr = this.currentToken.value.slice(0, -1); // Remove 'n'
      const node = { 
        type: 'Literal', 
        value: BigInt(valueStr),
        bigint: valueStr + 'n'
      };
      this.advance();
      return node;
    }

    /**
     * Parse string
     */
    parseString() {
      const node = { type: 'Literal', value: this.currentToken.value.slice(1, -1) };
      this.advance();
      return node;
    }

    /**
     * Parse regex literal
     */
    parseRegex() {
      const regexValue = this.currentToken.value;
      this.advance();
      
      // Extract pattern and flags from regex literal like /pattern/flags
      let pattern = regexValue;
      let flags = '';
      
      if (regexValue.startsWith('/')) {
        const lastSlash = regexValue.lastIndexOf('/');
        if (lastSlash > 0) {
          pattern = regexValue.slice(1, lastSlash);
          flags = regexValue.slice(lastSlash + 1);
        }
      }
      
      return { 
        type: 'Literal', 
        value: new RegExp(pattern, flags),
        regex: {
          pattern: pattern,
          flags: flags
        }
      };
    }

    /**
     * Parse template literal
     */
    parseTemplateLiteral() {
      const rawValue = this.currentToken.value;
      // Remove backticks and parse template expressions
      const value = rawValue.slice(1, -1);
      
      // For now, treat as a simple literal (can be enhanced later for expression interpolation)
      const node = { 
        type: 'TemplateLiteral',
        value: value,
        raw: rawValue,
        expressions: [],
        quasis: [{
          type: 'TemplateElement',
          value: { raw: value, cooked: value },
          tail: true
        }]
      };
      
      this.advance();
      return node;
    }

    /**
     * Parse array expression
     */
    parseArrayExpression() {
      const node = { type: 'ArrayExpression', elements: [] };
      
      this.consume('PUNCTUATION', '[');
      this.skipComments(); // Skip any comments after opening bracket
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ']')) {
        // Skip comments before each element
        this.skipComments();
        
        // Check if we hit the closing bracket after skipping comments
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ']') {
          break;
        }
        
        // Handle spread syntax (...expression)
        if (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '...') {
          this.advance(); // consume '...'
          node.elements.push({
            type: 'SpreadElement',
            argument: this.parseAssignmentExpression()
          });
        } else {
          node.elements.push(this.parseAssignmentExpression());
        }
        
        // Skip comments after the element
        this.skipComments();
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
          this.skipComments(); // Skip comments after comma
        }
      }
      
      this.consume('PUNCTUATION', ']');
      
      return node;
    }

    /**
     * Parse object expression (object literal)
     */
    parseObjectExpression() {
      const node = { type: 'ObjectExpression', properties: [] };
      
      this.consume('PUNCTUATION', '{');
      this.skipComments(); // Skip any comments after opening brace
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        // Skip comments between properties
        this.skipComments();
        
        // Check if we hit the closing brace after skipping comments
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}') {
          break;
        }
        
        // Parse property (key: value)
        const property = { type: 'Property' };
        
        // Parse key (can be identifier, string, number, or keyword)
        if (this.currentToken.type === 'IDENTIFIER') {
          property.key = this.parseIdentifier();
          
          // Check for shorthand property syntax (e.g., {func1, func2})
          this.skipComments();
          if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && 
              (this.currentToken.value === ',' || this.currentToken.value === '}')) {
            // Shorthand property: {key} means {key: key}
            property.value = { type: 'Identifier', name: property.key.name };
            property.shorthand = true;
          } else {
            // Regular property: key: value
            this.expect('PUNCTUATION', ':');
            this.skipComments(); // Skip comments after colon
            property.value = this.parseAssignmentExpression();
          }
        } else if (this.currentToken.type === 'STRING') {
          property.key = { type: 'Literal', value: this.currentToken.value };
          this.advance();
          this.skipComments(); // Skip comments before colon
          this.expect('PUNCTUATION', ':');
          this.skipComments(); // Skip comments after colon
          property.value = this.parseAssignmentExpression();
        } else if (this.currentToken.type === 'NUMBER') {
          property.key = { type: 'Literal', value: this.currentToken.value };
          this.advance();
          this.skipComments(); // Skip comments before colon
          this.expect('PUNCTUATION', ':');
          this.skipComments(); // Skip comments after colon
          property.value = this.parseAssignmentExpression();
        } else if (this.currentToken.type === 'KEYWORD') {
          // Check for getter/setter syntax (get key() or set key())
          if (this.currentToken.value === 'get' || this.currentToken.value === 'set') {
            property.kind = this.currentToken.value;
            this.advance(); // consume 'get' or 'set'
            this.skipComments();
            
            // Parse the property name after get/set
            if (this.currentToken.type === 'IDENTIFIER') {
              property.key = this.parseIdentifier();
            } else if (this.currentToken.type === 'STRING') {
              property.key = { type: 'Literal', value: this.currentToken.value };
              this.advance();
            } else {
              throw new Error(`Expected property name after ${property.kind}`);
            }
            
            // Parse the function parameters and body
            this.skipComments();
            const params = this.parseParameterList();
            this.skipComments();
            const body = this.parseBlockStatement();
            
            property.value = {
              type: 'FunctionExpression',
              params,
              body
            };
            property.method = true;
          } else {
            // Keywords can be used as object property names in JavaScript
            property.key = { type: 'Identifier', name: this.currentToken.value };
            this.advance();
            this.skipComments(); // Skip comments before colon
            this.expect('PUNCTUATION', ':');
            this.skipComments(); // Skip comments after colon
            property.value = this.parseExpression();
          }
        } else {
          throw new Error(`Unexpected token in object key: ${this.currentToken.type} ${this.currentToken.value}`);
        }
        if (!property.hasOwnProperty('method')) {
          property.method = false;
        }
        if (!property.hasOwnProperty('shorthand')) {
          property.shorthand = false;
        }
        property.computed = false;
        
        node.properties.push(property);
        
        this.skipComments(); // Skip comments after property value
        
        // Handle comma separator
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
          this.skipComments(); // Skip comments after comma
        }
      }
      
      this.consume('PUNCTUATION', '}');
      
      return node;
    }

    /**
     * Parse new expression
     */
    parseNewExpression() {
      this.consume('KEYWORD', 'new');
      
      const node = { type: 'NewExpression' };
      node.callee = this.parseMemberExpression();
      node.arguments = this.parseArgumentList();
      
      return node;
    }

    /**
     * Parse argument list
     */
    parseArgumentList() {
      const args = [];
      
      this.consume('PUNCTUATION', '(');
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ')')) {
        // Handle spread syntax (...expression)
        if (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '...') {
          this.advance(); // consume '...'
          args.push({
            type: 'SpreadElement',
            argument: this.parseExpression()
          });
        } else {
          args.push(this.parseExpression());
        }
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
        }
      }
      
      this.consume('PUNCTUATION', ')');
      
      return args;
    }

    /**
     * Parse comment
     */
    parseComment() {
      const node = { type: 'Comment', value: this.currentToken.value };
      this.advance();
      return node;
    }

    /**
     * Parse return statement
     */
    parseReturnStatement() {
      const node = { type: 'ReturnStatement' };
      
      this.consume('KEYWORD', 'return');
      
      if (this.currentToken && 
          !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ';')) {
        node.argument = this.parseExpression();
      }
      
      if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ';') {
        this.advance();
      }
      
      return node;
    }

    /**
     * Advance to next token
     */
    advance() {
      this.position++;
      this.currentToken = this.position < this.tokens.length ? this.tokens[this.position] : null;
    }

    /**
     * Alias for advance() to match common parser patterns
     */
    nextToken() {
      this.advance();
    }

    /**
     * Skip any comment tokens
     */
    skipComments() {
      while (this.currentToken && 
             (this.currentToken.type === 'COMMENT_SINGLE' || this.currentToken.type === 'COMMENT_MULTI')) {
        this.advance();
      }
    }

    /**
     * Consume a specific token
     */
    consume(expectedType, expectedValue = null) {
      // Skip comments first
      this.skipComments();
      
      if (!this.currentToken || this.currentToken.type !== expectedType) {
        throw new Error(`Expected ${expectedType}, got: ${this.currentToken ? this.currentToken.type : 'EOF'}`);
      }
      
      if (expectedValue !== null && this.currentToken.value !== expectedValue) {
        throw new Error(`Expected ${expectedValue}, got: ${this.currentToken.value}`);
      }
      
      this.advance();
      this.skipComments(); // Skip comments after advancing
    }

    /**
     * Alias for consume method - expect a specific token
     */
    expect(expectedType, expectedValue = null) {
      return this.consume(expectedType, expectedValue);
    }

    /**
     * Expect a semicolon (optional in many cases)
     */
    expectSemicolon() {
      if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ';') {
        this.advance();
      }
      // In JavaScript, semicolons are often optional due to ASI (Automatic Semicolon Insertion)
    }

    /**
     * Parse member expression or simple identifier
     * Handles both "identifier" and "object.property" patterns
     */
    parseMemberOrIdentifier() {
      let node = this.parseIdentifier();
      
      // Check for member access (e.g., AlgorithmFramework.Algorithm)
      while (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '.') {
        this.advance(); // consume '.'
        const property = this.parseIdentifier();
        node = {
          type: 'MemberExpression',
          object: node,
          property: property,
          computed: false
        };
      }
      
      return node;
    }

    /**
     * Enhanced method parsing with JSDoc type extraction
     */
    parseMethodWithTypes(node) {
      // Look for preceding JSDoc comment
      let jsDocComment = null;
      
      // In a real implementation, we'd need to track comments during tokenization
      // For now, we'll simulate this
      if (node.key && node.key.name) {
        // This would normally be extracted during tokenization
        jsDocComment = this.extractJSDocForMethod(node.key.name);
      }

      if (jsDocComment) {
        const jsDocInfo = this.jsDocParser.parseJSDoc(jsDocComment);
        
        // Attach type information to the node
        this.typeAnnotations.set(node, {
          jsDoc: jsDocInfo,
          paramTypes: jsDocInfo.params.map(p => p.type),
          returnType: jsDocInfo.returns ? jsDocInfo.returns.type : null
        });

        // Attach type info to parameters
        if (node.value && node.value.params) {
          node.value.params.forEach((param, index) => {
            if (jsDocInfo.params[index]) {
              this.typeAnnotations.set(param, {
                type: jsDocInfo.params[index].type,
                description: jsDocInfo.params[index].description
              });
            }
          });
        }
      }

      return node;
    }

    /**
     * Extract JSDoc comment for a method (placeholder implementation)
     * In a real implementation, this would be done during tokenization
     */
    extractJSDocForMethod(methodName) {
      // This is a simplified approach - in practice, you'd track comment tokens
      // and associate them with the following declarations during parsing
      const jsDocPatterns = {
        'RotL32': `/**
         * Rotate left (circular left shift) for 32-bit values
         * @param {number} value - 32-bit value to rotate
         * @param {number} positions - Number of positions to rotate (0-31)
         * @returns {number} Rotated 32-bit value
         */`,
        'Feed': `/**
         * Feed data to the algorithm instance
         * @param {number[]} data - Input data bytes
         * @returns {void}
         */`,
        'Result': `/**
         * Get the result of the algorithm processing
         * @returns {number[]} Output data bytes
         */`,
        'CreateInstance': `/**
         * Create a new algorithm instance
         * @param {boolean} isInverse - Whether to create inverse operation instance
         * @returns {IAlgorithmInstance} Algorithm instance or null if not supported
         */`
      };

      return jsDocPatterns[methodName] || null;
    }

    /**
     * Infer types for variables and expressions
     */
    inferExpressionType(node, context = {}) {
      if (this.typeAnnotations.has(node)) {
        return this.typeAnnotations.get(node).type;
      }

      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'number') return { name: 'number' };
          if (typeof node.value === 'string') return { name: 'string' };
          if (typeof node.value === 'boolean') return { name: 'boolean' };
          return { name: 'any' };

        case 'ArrayExpression':
          // Infer array element type from first element
          if (node.elements.length > 0) {
            const elementType = this.inferExpressionType(node.elements[0], context);
            return { name: elementType.name + '[]', isArray: true, elementType };
          }
          return { name: 'any[]', isArray: true };

        case 'CallExpression':
          return this.inferCallExpressionType(node, context);

        case 'MemberExpression':
          return this.inferMemberExpressionType(node, context);

        case 'Identifier':
          return this.typeKnowledge.inferType(node.name, context);

        default:
          return { name: 'any' };
      }
    }

    /**
     * Infer type for method/function calls
     */
    inferCallExpressionType(node, context) {
      if (node.callee.type === 'MemberExpression') {
        const objectName = node.callee.object.name;
        const methodName = node.callee.property.name;
        
        if (objectName === 'OpCodes') {
          const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
          if (methodInfo) {
            return this.jsDocParser.parseType(methodInfo.returns);
          }
        }
      }

      return { name: 'any' };
    }

    /**
     * Infer type for member expressions (obj.prop)
     */
    inferMemberExpressionType(node, context) {
      const objectName = node.object.name;
      const propertyName = node.property.name;
      
      // Check framework class properties
      if (this.typeKnowledge.frameworkTypes[objectName]) {
        const classInfo = this.typeKnowledge.frameworkTypes[objectName];
        if (classInfo.properties && classInfo.properties[propertyName]) {
          return this.jsDocParser.parseType(classInfo.properties[propertyName]);
        }
      }

      return { name: 'any' };
    }

    /**
     * Get type information for a node
     */
    getTypeInfo(node) {
      return this.typeAnnotations.get(node) || null;
    }

    /**
     * Parse if statement
     */
    parseIfStatement() {
      this.advance(); // consume 'if'
      this.skipComments();
      this.expect('PUNCTUATION', '(');
      this.skipComments();
      const test = this.parseExpression();
      this.skipComments();
      this.expect('PUNCTUATION', ')');
      this.skipComments();
      const consequent = this.parseStatement();
      
      let alternate = null;
      this.skipComments();
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'else') {
        this.advance(); // consume 'else'
        this.skipComments();
        alternate = this.parseStatement();
      }
      
      return {
        type: 'IfStatement',
        test,
        consequent,
        alternate
      };
    }

    /**
     * Parse for statement (for loop)
     */
    parseForStatement() {
      this.advance(); // consume 'for'
      
      // Skip any comments after 'for'
      this.skipComments();
      
      if (!this.currentToken || this.currentToken.type !== 'PUNCTUATION' || this.currentToken.value !== '(') {
        throw new Error(`Expected '(' after 'for', got: ${this.currentToken ? this.currentToken.type + ' ' + this.currentToken.value : 'EOF'}`);
      }
      
      this.advance(); // consume '('
      
      // Parse init (can be variable declaration or expression)
      let init = null;
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && 
          ['var', 'let', 'const'].includes(this.currentToken.value)) {
        init = this.parseVariableDeclaration(false); // don't consume semicolon
      } else if (this.currentToken && this.currentToken.value !== ';') {
        init = this.parseExpression();
      }
      
      // Check for for...of or for...in loops
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && 
          (this.currentToken.value === 'of' || this.currentToken.value === 'in')) {
        const kind = this.currentToken.value;
        this.advance(); // consume 'of' or 'in'
        const right = this.parseExpression();
        this.expect('PUNCTUATION', ')');
        const body = this.parseStatement();
        
        return {
          type: kind === 'of' ? 'ForOfStatement' : 'ForInStatement',
          left: init,
          right: right,
          body: body
        };
      }
      
      // Traditional for loop
      this.expect('PUNCTUATION', ';');
      
      // Parse test condition
      let test = null;
      if (this.currentToken && this.currentToken.value !== ';') {
        test = this.parseExpression();
      }
      this.expect('PUNCTUATION', ';');
      
      // Parse update expression
      let update = null;
      if (this.currentToken && this.currentToken.value !== ')') {
        update = this.parseExpression();
      }
      this.expect('PUNCTUATION', ')');
      
      // Parse body
      const body = this.parseStatement();
      
      return {
        type: 'ForStatement',
        init,
        test,
        update,
        body
      };
    }

    /**
     * Parse while statement
     */
    parseWhileStatement() {
      this.advance(); // consume 'while'
      this.expect('PUNCTUATION', '(');
      const test = this.parseExpression();
      this.expect('PUNCTUATION', ')');
      const body = this.parseStatement();
      
      return {
        type: 'WhileStatement',
        test,
        body
      };
    }

    /**
     * Parse do-while statement
     */
    parseDoWhileStatement() {
      this.advance(); // consume 'do'
      const body = this.parseStatement();
      this.expect('KEYWORD', 'while');
      this.expect('PUNCTUATION', '(');
      const test = this.parseExpression();
      this.expect('PUNCTUATION', ')');
      this.expectSemicolon();
      
      return {
        type: 'DoWhileStatement',
        body,
        test
      };
    }

    /**
     * Parse try statement
     */
    parseTryStatement() {
      this.advance(); // consume 'try'
      const block = this.parseBlockStatement();
      
      let handler = null;
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'catch') {
        this.advance(); // consume 'catch'
        this.expect('PUNCTUATION', '(');
        const param = this.parseIdentifier();
        this.expect('PUNCTUATION', ')');
        const body = this.parseBlockStatement();
        
        handler = {
          type: 'CatchClause',
          param,
          body
        };
      }
      
      let finalizer = null;
      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'finally') {
        this.advance(); // consume 'finally'
        finalizer = this.parseBlockStatement();
      }
      
      return {
        type: 'TryStatement',
        block,
        handler,
        finalizer
      };
    }

    /**
     * Parse throw statement
     */
    parseThrowStatement() {
      this.advance(); // consume 'throw'
      const argument = this.parseExpression();
      this.expect('PUNCTUATION', ';');
      
      return {
        type: 'ThrowStatement',
        argument
      };
    }

    /**
     * Parse break statement
     */
    parseBreakStatement() {
      this.advance(); // consume 'break'
      
      let label = null;
      if (this.currentToken && this.currentToken.type === 'IDENTIFIER') {
        label = this.parseIdentifier();
      }
      
      this.expect('PUNCTUATION', ';');
      
      return {
        type: 'BreakStatement',
        label
      };
    }

    /**
     * Parse continue statement
     */
    parseContinueStatement() {
      this.advance(); // consume 'continue'
      
      let label = null;
      if (this.currentToken && this.currentToken.type === 'IDENTIFIER') {
        label = this.parseIdentifier();
      }
      
      this.expect('PUNCTUATION', ';');
      
      return {
        type: 'ContinueStatement',
        label
      };
    }

    /**
     * Parse export statement
     */
    parseExportStatement() {
      const node = { type: 'ExportDeclaration' };
      this.advance(); // consume 'export'
      
      // Handle different export patterns
      if (this.currentToken && this.currentToken.type === 'KEYWORD') {
        if (this.currentToken.value === 'default') {
          this.advance(); // consume 'default'
          node.default = true;
          node.declaration = this.parseStatement();
        } else if (this.currentToken.value === 'function' || this.currentToken.value === 'class') {
          node.declaration = this.parseStatement();
        }
      } else if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '{') {
        // Named exports: export { foo, bar }
        node.specifiers = this.parseExportSpecifiers();
      } else {
        // Expression export
        node.declaration = this.parseExpression();
      }
      
      return node;
    }

    /**
     * Parse import statement
     */
    parseImportStatement() {
      const node = { type: 'ImportDeclaration' };
      this.advance(); // consume 'import'
      
      // Simple implementation - just skip to semicolon or end of line
      while (this.currentToken && 
             !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ';') &&
             this.currentToken.type !== 'NEWLINE') {
        this.advance();
      }
      
      if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ';') {
        this.advance();
      }
      
      return node;
    }

    /**
     * Parse export specifiers
     */
    parseExportSpecifiers() {
      const specifiers = [];
      this.consume('PUNCTUATION', '{');
      
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        if (this.currentToken.type === 'IDENTIFIER') {
          specifiers.push({
            type: 'ExportSpecifier',
            local: this.parseIdentifier()
          });
        }
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance();
        }
      }
      
      this.consume('PUNCTUATION', '}');
      return specifiers;
    }

    /**
     * Parse switch statement
     */
    parseSwitchStatement() {
      this.advance(); // consume 'switch'
      this.expect('PUNCTUATION', '(');
      const discriminant = this.parseExpression();
      this.expect('PUNCTUATION', ')');
      this.expect('PUNCTUATION', '{');
      
      const cases = [];
      while (this.currentToken && this.currentToken.value !== '}') {
        this.skipComments(); // Skip comments at the switch case level
        if (!this.currentToken || this.currentToken.value === '}') break;
        
        if (this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'case') {
          this.advance(); // consume 'case'
          const test = this.parseExpression();
          this.expect('PUNCTUATION', ':');
          
          const consequent = [];
          while (this.currentToken && this.currentToken.value !== 'case' && 
                 this.currentToken.value !== 'default' && this.currentToken.value !== '}') {
            this.skipComments();
            if (!this.currentToken || this.currentToken.value === 'case' || 
                this.currentToken.value === 'default' || this.currentToken.value === '}') {
              break;
            }
            consequent.push(this.parseStatement());
          }
          
          cases.push({
            type: 'SwitchCase',
            test,
            consequent
          });
        } else if (this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'default') {
          this.advance(); // consume 'default'
          this.expect('PUNCTUATION', ':');
          
          const consequent = [];
          while (this.currentToken && this.currentToken.value !== 'case' && 
                 this.currentToken.value !== 'default' && this.currentToken.value !== '}') {
            this.skipComments();
            if (!this.currentToken || this.currentToken.value === 'case' || 
                this.currentToken.value === 'default' || this.currentToken.value === '}') {
              break;
            }
            consequent.push(this.parseStatement());
          }
          
          cases.push({
            type: 'SwitchCase',
            test: null, // default case
            consequent
          });
        } else {
          break;
        }
      }
      
      this.expect('PUNCTUATION', '}');
      
      return {
        type: 'SwitchStatement',
        discriminant,
        cases
      };
    }

    // Include all original parser methods here...
    // [All the tokenize, parse, parseClass, parseMethod, etc. methods from the original parser]
  }

  /**
   * Enhanced Code Generator with Type Information
   * Generates properly typed code for target languages
   */
  class TypeAwareCodeGenerator {
    constructor(targetLanguage, parser) {
      this.targetLanguage = targetLanguage;
      this.parser = parser;
      this.typeKnowledge = parser.typeKnowledge;
      this.indentLevel = 0;
      this.indentString = '  ';
      
      // Language-specific type mappings with precise bit-width types
      this.typeMap = {
        java: {
          'byte': 'byte',
          'word': 'short', 
          'dword': 'int',
          'qword': 'long',
          'byte[]': 'byte[]',
          'word[]': 'short[]',
          'dword[]': 'int[]',
          'qword[]': 'long[]',
          'string': 'String',
          'boolean': 'boolean'
        },
        csharp: {
          'byte': 'byte',
          'word': 'ushort',
          'dword': 'uint', 
          'qword': 'ulong',
          'byte[]': 'byte[]',
          'word[]': 'ushort[]',
          'dword[]': 'uint[]',
          'qword[]': 'ulong[]',
          'string': 'string',
          'boolean': 'bool'
        },
        cpp: {
          'byte': 'uint8_t',
          'word': 'uint16_t',
          'dword': 'uint32_t',
          'qword': 'uint64_t',
          'byte[]': 'std::vector<uint8_t>',
          'word[]': 'std::vector<uint16_t>',
          'dword[]': 'std::vector<uint32_t>',
          'qword[]': 'std::vector<uint64_t>',
          'string': 'std::string',
          'boolean': 'bool'
        },
        rust: {
          'byte': 'u8',
          'word': 'u16',
          'dword': 'u32',
          'qword': 'u64',
          'byte[]': 'Vec<u8>',
          'word[]': 'Vec<u16>',
          'dword[]': 'Vec<u32>',
          'qword[]': 'Vec<u64>',
          'string': 'String',
          'boolean': 'bool'
        },
        kotlin: {
          'byte': 'Byte',
          'word': 'Short',
          'dword': 'Int',
          'qword': 'Long',
          'byte[]': 'ByteArray',
          'word[]': 'ShortArray',
          'dword[]': 'IntArray',
          'qword[]': 'LongArray',
          'string': 'String',
          'boolean': 'Boolean'
        },
        go: {
          'byte': 'uint8',
          'word': 'uint16',
          'dword': 'uint32',
          'qword': 'uint64',
          'byte[]': '[]uint8',
          'word[]': '[]uint16',
          'dword[]': '[]uint32',
          'qword[]': '[]uint64',
          'string': 'string',
          'boolean': 'bool'
        },
        perl: {
          'byte': 'scalar',
          'word': 'scalar',
          'dword': 'scalar',
          'qword': 'scalar',
          'byte[]': 'array_ref',
          'word[]': 'array_ref',
          'dword[]': 'array_ref',
          'qword[]': 'array_ref',
          'string': 'scalar',
          'boolean': 'scalar'
        },
        freebasic: {
          'byte': 'UByte',
          'word': 'UShort',
          'dword': 'UInteger',
          'qword': 'ULongInt',
          'byte[]': 'UByte Ptr',
          'word[]': 'UShort Ptr',
          'dword[]': 'UInteger Ptr',
          'qword[]': 'ULongInt Ptr',
          'string': 'String',
          'boolean': 'Boolean'
        },
        delphi: {
          'byte': 'Byte',
          'word': 'Word',
          'dword': 'Cardinal',
          'qword': 'UInt64',
          'byte[]': 'TBytes',
          'word[]': 'array of Word',
          'dword[]': 'array of Cardinal',
          'qword[]': 'array of UInt64',
          'string': 'string',
          'boolean': 'Boolean'
        },
        python: {
          'byte': 'int',
          'word': 'int',
          'dword': 'int', 
          'qword': 'int',
          'byte[]': 'bytes',
          'word[]': 'List[int]',
          'dword[]': 'List[int]',
          'qword[]': 'List[int]',
          'string': 'str',
          'boolean': 'bool'
        }
      };
    }

    /**
     * Generate typed method signature
     */
    generateTypedMethod(node) {
      const typeInfo = this.parser.getTypeInfo(node);
      
      switch (this.targetLanguage) {
        case 'java':
          return this.generateJavaMethod(node, typeInfo);
        case 'csharp':
          return this.generateCSharpMethod(node, typeInfo);
        case 'cpp':
          return this.generateCppMethod(node, typeInfo);
        case 'rust':
          return this.generateRustMethod(node, typeInfo);
        case 'kotlin':
          return this.generateKotlinMethod(node, typeInfo);
        case 'go':
          return this.generateGoMethod(node, typeInfo);
        case 'perl':
          return this.generatePerlMethod(node, typeInfo);
        case 'freebasic':
          return this.generateFreeBASICMethod(node, typeInfo);
        case 'delphi':
          return this.generateDelphiMethod(node, typeInfo);
        case 'python':
          return this.generatePythonMethod(node, typeInfo);
        default:
          return this.generateJavaScriptMethod(node);
      }
    }

    /**
     * Generate Java method with proper types
     */
    generateJavaMethod(node, typeInfo) {
      let code = 'public ';
      
      if (node.static) code += 'static ';
      
      // Determine return type
      let returnType = 'void';
      if (typeInfo && typeInfo.returnType) {
        returnType = this.typeKnowledge.mapType(typeInfo.returnType.name, 'java');
      } else if (node.key.name === 'CreateInstance') {
        returnType = 'IAlgorithmInstance';
      } else if (node.key.name === 'Result') {
        returnType = 'byte[]';
      }
      
      code += `${returnType} ${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'Object';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.typeKnowledge.mapType(typeInfo.paramTypes[index].name, 'java');
          } else {
            // Infer from parameter name
            paramType = this.inferParameterType(param.name, 'java');
          }
          
          params.push(`${paramType} ${param.name}`);
        });
      }
      
      code += params.join(', ') + ')';
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate C# method with proper types
     */
    generateCSharpMethod(node, typeInfo) {
      let code = 'public ';
      
      if (node.static) code += 'static ';
      
      // Determine return type
      let returnType = 'void';
      if (typeInfo && typeInfo.returnType) {
        returnType = this.typeKnowledge.mapType(typeInfo.returnType.name, 'csharp');
      } else if (node.key.name === 'CreateInstance') {
        returnType = 'IAlgorithmInstance';
      } else if (node.key.name === 'Result') {
        returnType = 'byte[]';
      }
      
      code += `${returnType} ${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'object';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.typeKnowledge.mapType(typeInfo.paramTypes[index].name, 'csharp');
          } else {
            paramType = this.inferParameterType(param.name, 'csharp');
          }
          
          params.push(`${paramType} ${param.name}`);
        });
      }
      
      code += params.join(', ') + ')';
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate C++ method with proper types
     */
    generateCppMethod(node, typeInfo) {
      // Determine return type
      let returnType = 'void';
      if (typeInfo && typeInfo.returnType) {
        returnType = this.typeKnowledge.mapType(typeInfo.returnType.name, 'cpp');
      } else if (node.key.name === 'Result') {
        returnType = 'std::vector<uint8_t>';
      }
      
      let code = `${returnType} ${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'auto';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.typeKnowledge.mapType(typeInfo.paramTypes[index].name, 'cpp');
          } else {
            paramType = this.inferParameterType(param.name, 'cpp');
          }
          
          params.push(`${paramType} ${param.name}`);
        });
      }
      
      code += params.join(', ') + ')';
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate TypeScript method with proper types
     */
    generateTypeScriptMethod(node, typeInfo) {
      let code = '';
      
      if (node.static) code += 'static ';
      
      code += `${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'any';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.typeKnowledge.mapType(typeInfo.paramTypes[index].name, 'typescript');
          } else {
            paramType = this.inferParameterType(param.name, 'typescript');
          }
          
          params.push(`${param.name}: ${paramType}`);
        });
      }
      
      code += params.join(', ') + ')';
      
      // Add return type
      if (typeInfo && typeInfo.returnType) {
        const returnType = this.typeKnowledge.mapType(typeInfo.returnType.name, 'typescript');
        code += `: ${returnType}`;
      } else if (node.key.name === 'Result') {
        code += ': number[]';
      } else {
        code += ': void';
      }
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Infer parameter type from name and target language
     */
    inferParameterType(paramName, targetLanguage) {
      const jsType = this.typeKnowledge.inferType(paramName);
      return this.typeKnowledge.mapType(jsType, targetLanguage);
    }

    /**
     * Generate typed variable declaration
     */
    generateTypedVariableDeclaration(node) {
      switch (this.targetLanguage) {
        case 'java':
        case 'csharp':
        case 'cpp':
          return this.generateStaticallyTypedVariable(node);
        case 'typescript':
          return this.generateTypeScriptVariable(node);
        default:
          return this.generateJavaScriptVariable(node);
      }
    }

    generateStaticallyTypedVariable(node) {
      return node.declarations.map(decl => {
        // Infer type from initializer or name
        let type = 'auto';
        if (decl.init) {
          const inferredType = this.parser.inferExpressionType(decl.init);
          type = this.typeKnowledge.mapType(inferredType.name || 'dword', this.targetLanguage);
        } else {
          const nameBasedType = this.typeKnowledge.inferType(decl.id.name);
          type = this.typeKnowledge.mapType(nameBasedType, this.targetLanguage);
        }

        let code = `${type} ${decl.id.name}`;
        if (decl.init) {
          code += ' = ' + this.generateNode(decl.init);
        }
        return code;
      }).join(', ');
    }

    generateTypeScriptVariable(node) {
      return node.declarations.map(decl => {
        let code = decl.id.name;
        
        // Add type annotation if we can infer it
        if (decl.init) {
          const inferredType = this.parser.inferExpressionType(decl.init);
          if (inferredType.name !== 'any') {
            const tsType = this.typeKnowledge.mapType(inferredType.name, 'typescript');
            code += `: ${tsType}`;
          }
        }
        
        if (decl.init) {
          code += ' = ' + this.generateNode(decl.init);
        }
        return code;
      }).join(', ');
    }

    generateJavaScriptVariable(node) {
      return node.declarations.map(decl => {
        let code = decl.id.name;
        if (decl.init) {
          code += ' = ' + this.generateNode(decl.init);
        }
        return code;
      }).join(', ');
    }

    // Include all other generation methods...
    // [All the other generateNode, generateClass, etc. methods]

    /**
     * Generate node based on type
     */
    generateNode(node) {
      if (!node) return '';
      
      switch (node.type) {
        case 'Program':
          return this.generateProgram(node);
        case 'ClassDeclaration':
          return this.generateClass(node);
        case 'MethodDefinition':
          return this.generateTypedMethod(node);
        case 'FunctionDeclaration':
          return this.generateFunction(node);
        case 'VariableDeclaration':
          return `${node.kind} ${this.generateTypedVariableDeclaration(node)};`;
        case 'BlockStatement':
          return this.generateBlockStatement(node);
        case 'ExpressionStatement':
          return this.generateNode(node.expression) + ';';
        case 'ReturnStatement':
          return 'return' + (node.argument ? ' ' + this.generateNode(node.argument) : '') + ';';
        case 'AssignmentExpression':
          return this.generateNode(node.left) + ' ' + node.operator + ' ' + this.generateNode(node.right);
        case 'BinaryExpression':
          return this.generateTypedBinaryExpression(node);
        case 'CallExpression':
          return this.generateEnhancedCallExpression(node);
        case 'MemberExpression':
          if (node.computed) {
            return this.generateNode(node.object) + '[' + this.generateNode(node.property) + ']';
          } else {
            const objectCode = this.generateNode(node.object);
            const propertyCode = this.generateNode(node.property);
            
            // Handle 'this' keyword mapping
            if (objectCode === 'this' && this.targetLanguage === 'python') {
              return 'self.' + propertyCode;
            }
            
            return objectCode + '.' + propertyCode;
          }
        case 'Identifier':
          return node.name;
        case 'Literal':
          if (typeof node.value === 'string') {
            return `"${node.value}"`;
          } else if (typeof node.value === 'number') {
            // Handle hex literals and large numbers based on target language
            if (this.targetLanguage === 'java' && node.value > 2147483647) {
              return node.value + 'L'; // Java long literal
            } else if (this.targetLanguage === 'cpp' && node.value > 4294967295) {
              return node.value + 'ULL'; // C++ unsigned long long
            }
            return String(node.value);
          }
          return String(node.value);
        case 'ThisExpression':
          return this.targetLanguage === 'python' ? 'self' : 'this';
        case 'ArrayExpression':
          const elements = node.elements.map(elem => this.generateNode(elem)).join(', ');
          switch (this.targetLanguage) {
            case 'java':
              return `new int[]{${elements}}`; // Simplified - should use proper type
            case 'csharp':
              return `new int[]{${elements}}`; // Simplified - should use proper type
            case 'cpp':
              return `{${elements}}`; // C++ brace initialization
            case 'python':
              return `[${elements}]`;
            default:
              return `[${elements}]`;
          }
        case 'ObjectExpression':
          const properties = node.properties.map(prop => {
            const key = prop.key.type === 'Identifier' ? prop.key.name : this.generateNode(prop.key);
            const value = this.generateNode(prop.value);
            
            switch (this.targetLanguage) {
              case 'python':
                return `"${key}": ${value}`;
              default:
                return `${key}: ${value}`;
            }
          }).join(', ');
          
          switch (this.targetLanguage) {
            case 'python':
              return `{${properties}}`;
            default:
              return `{${properties}}`;
          }
        case 'NewExpression':
          const className = this.generateNode(node.callee);
          const args = node.arguments.map(arg => this.generateNode(arg)).join(', ');
          
          switch (this.targetLanguage) {
            case 'python':
              return `${className}(${args})`;
            default:
              return `new ${className}(${args})`;
          }
        case 'UnaryExpression':
          if (node.prefix) {
            return node.operator + this.generateNode(node.argument);
          } else {
            return this.generateNode(node.argument) + node.operator;
          }
        case 'UpdateExpression':
          if (node.prefix) {
            return node.operator + this.generateNode(node.argument);
          } else {
            return this.generateNode(node.argument) + node.operator;
          }
        case 'LogicalExpression':
          const leftLogical = this.generateNode(node.left);
          const rightLogical = this.generateNode(node.right);
          const operator = this.targetLanguage === 'python' ? 
            this.mapPythonOperator(node.operator) : node.operator;
          return `${leftLogical} ${operator} ${rightLogical}`;
        case 'ForStatement':
          return this.generateForStatement(node);
        case 'IfStatement':
          return this.generateIfStatement(node);
        case 'WhileStatement':
          return this.generateWhileStatement(node);
        case 'Comment':
          // Skip comments in generated code or handle them appropriately
          return '';
        default:
          return `/* Unsupported node type: ${node.type} */`;
      }
    }

    /**
     * Generate class declaration
     */
    generateClass(node) {
      switch (this.targetLanguage) {
        case 'java':
          return this.generateJavaClass(node);
        case 'csharp':
          return this.generateCSharpClass(node);
        case 'cpp':
          return this.generateCppClass(node);
        case 'typescript':
          return this.generateTypeScriptClass(node);
        case 'python':
          return this.generatePythonClass(node);
        default:
          return this.generateJavaScriptClass(node);
      }
    }

    /**
     * Generate Java class
     */
    generateJavaClass(node) {
      let code = `public class ${node.id.name}`;
      
      if (node.superClass) {
        code += ` extends ${node.superClass.name}`;
      }
      
      code += ' {\n';
      
      for (const method of node.body) {
        code += this.indent(this.generateNode(method)) + '\n\n';
      }
      
      code += '}';
      return code;
    }

    /**
     * Generate C# class
     */
    generateCSharpClass(node) {
      let code = `public class ${node.id.name}`;
      
      if (node.superClass) {
        code += ` : ${node.superClass.name}`;
      }
      
      code += ' {\n';
      
      for (const method of node.body) {
        code += this.indent(this.generateNode(method)) + '\n\n';
      }
      
      code += '}';
      return code;
    }

    /**
     * Generate C++ class
     */
    generateCppClass(node) {
      let code = `class ${node.id.name}`;
      
      if (node.superClass) {
        code += ` : public ${node.superClass.name}`;
      }
      
      code += ' {\npublic:\n';
      
      for (const method of node.body) {
        code += this.indent(this.generateNode(method)) + '\n\n';
      }
      
      code += '};';
      return code;
    }

    /**
     * Generate TypeScript class
     */
    generateTypeScriptClass(node) {
      let code = `class ${node.id.name}`;
      
      if (node.superClass) {
        code += ` extends ${node.superClass.name}`;
      }
      
      code += ' {\n';
      
      for (const method of node.body) {
        code += this.indent(this.generateNode(method)) + '\n\n';
      }
      
      code += '}';
      return code;
    }

    /**
     * Generate Python class
     */
    generatePythonClass(node) {
      let code = `class ${node.id.name}`;
      
      if (node.superClass) {
        if (node.superClass.type === 'MemberExpression') {
          // Handle AlgorithmFramework.Algorithm -> Algorithm
          code += `(${node.superClass.property.name})`;
        } else {
          code += `(${node.superClass.name})`;
        }
      }
      
      code += ':\n';
      
      if (node.body.length === 0) {
        code += this.indent('pass\n');
      } else {
        for (const method of node.body) {
          code += this.indent(this.generateNode(method)) + '\n\n';
        }
      }
      
      return code;
    }

    /**
     * Generate JavaScript class (fallback)
     */
    generateJavaScriptClass(node) {
      let code = `class ${node.id.name}`;
      
      if (node.superClass) {
        code += ` extends ${node.superClass.name}`;
      }
      
      code += ' {\n';
      
      for (const method of node.body) {
        code += this.indent(this.generateNode(method)) + '\n\n';
      }
      
      code += '}';
      return code;
    }

    /**
     * Generate C++ method with proper types
     */
    generateCppMethod(node, typeInfo) {
      // Determine return type
      let returnType = 'void';
      if (typeInfo && typeInfo.returnType) {
        returnType = this.typeKnowledge.mapType(typeInfo.returnType.name, 'cpp');
      } else if (node.key.name === 'Result') {
        returnType = 'std::vector<uint8_t>';
      }
      
      let code = `${returnType} ${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'auto';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.typeKnowledge.mapType(typeInfo.paramTypes[index].name, 'cpp');
          } else {
            paramType = this.inferParameterType(param.name, 'cpp');
          }
          
          params.push(`${paramType} ${param.name}`);
        });
      }
      
      code += params.join(', ') + ')';
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate Rust method with proper types
     */
    generateRustMethod(node, typeInfo) {
      // Determine return type
      let returnType = '()';
      if (typeInfo && typeInfo.returnType) {
        returnType = this.mapType(typeInfo.returnType.name, 'rust');
      } else if (node.key.name === 'process') {
        returnType = 'Vec<u8>';
      }
      
      let code = `fn ${this.toSnakeCase(node.key.name)}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'Vec<u8>';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.mapType(typeInfo.paramTypes[index].name, 'rust');
          } else {
            paramType = this.inferParameterType(param.name, 'rust');
          }
          
          params.push(`${param.name}: ${paramType}`);
        });
      }
      
      code += params.join(', ') + `) -> ${returnType}`;
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate Kotlin method with proper types
     */
    generateKotlinMethod(node, typeInfo) {
      let code = 'fun ';
      
      // Determine return type
      let returnType = 'Unit';
      if (typeInfo && typeInfo.returnType) {
        returnType = this.mapType(typeInfo.returnType.name, 'kotlin');
      } else if (node.key.name === 'process') {
        returnType = 'ByteArray';
      }
      
      code += `${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'ByteArray';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.mapType(typeInfo.paramTypes[index].name, 'kotlin');
          } else {
            paramType = this.inferParameterType(param.name, 'kotlin');
          }
          
          params.push(`${param.name}: ${paramType}`);
        });
      }
      
      code += params.join(', ') + `): ${returnType}`;
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate Go method with proper types
     */
    generateGoMethod(node, typeInfo) {
      let code = `func ${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = '[]uint8';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.mapType(typeInfo.paramTypes[index].name, 'go');
          } else {
            paramType = this.inferParameterType(param.name, 'go');
          }
          
          params.push(`${param.name} ${paramType}`);
        });
      }
      
      code += params.join(', ') + ')';
      
      // Determine return type
      if (typeInfo && typeInfo.returnType) {
        const returnType = this.mapType(typeInfo.returnType.name, 'go');
        code += ` ${returnType}`;
      } else if (node.key.name === 'process') {
        code += ' []uint8';
      }
      
      if (node.value.body) {
        code += ' ' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate Perl method with proper types
     */
    generatePerlMethod(node, typeInfo) {
      let code = `sub ${node.key.name} {\n`;
      code += '  my (';
      
      // Generate parameter list
      const params = ['$self'];
      if (node.value.params) {
        node.value.params.forEach(param => {
          params.push(`$${param.name}`);
        });
      }
      
      code += params.join(', ') + ') = @_;\n';
      
      if (node.value.body) {
        code += this.generateNode(node.value.body);
      }
      
      code += '}';
      return code;
    }

    /**
     * Generate FreeBASIC method with proper types
     */
    generateFreeBASICMethod(node, typeInfo) {
      let code = '';
      
      // Determine return type
      let returnType = '';
      if (typeInfo && typeInfo.returnType) {
        returnType = ` As ${this.mapType(typeInfo.returnType.name, 'freebasic')}`;
      } else if (node.key.name === 'process') {
        returnType = ' As UByte Ptr';
      }
      
      if (returnType) {
        code = 'Function ';
      } else {
        code = 'Sub ';
      }
      
      code += `${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'UByte Ptr';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.mapType(typeInfo.paramTypes[index].name, 'freebasic');
          } else {
            paramType = this.inferParameterType(param.name, 'freebasic');
          }
          
          params.push(`${param.name} As ${paramType}`);
        });
      }
      
      code += params.join(', ') + ')' + returnType;
      
      if (node.value.body) {
        code += '\n' + this.generateNode(node.value.body);
      }
      
      code += returnType ? '\nEnd Function' : '\nEnd Sub';
      return code;
    }

    /**
     * Generate Delphi method with proper types
     */
    generateDelphiMethod(node, typeInfo) {
      let code = '';
      
      // Determine return type
      let returnType = '';
      if (typeInfo && typeInfo.returnType) {
        returnType = this.mapType(typeInfo.returnType.name, 'delphi');
      } else if (node.key.name === 'process') {
        returnType = 'TBytes';
      }
      
      if (returnType) {
        code = 'function ';
      } else {
        code = 'procedure ';
      }
      
      code += `${node.key.name}(`;
      
      // Generate parameter list with types
      const params = [];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'TBytes';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.mapType(typeInfo.paramTypes[index].name, 'delphi');
          } else {
            paramType = this.inferParameterType(param.name, 'delphi');
          }
          
          params.push(`${param.name}: ${paramType}`);
        });
      }
      
      code += params.join('; ') + ')';
      
      if (returnType) {
        code += `: ${returnType}`;
      }
      
      code += ';';
      
      if (node.value.body) {
        code += '\n' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate Python method with proper types
     */
    generatePythonMethod(node, typeInfo) {
      let code = `def ${this.toPythonCase(node.key.name)}(`;
      
      // Generate parameter list with types
      const params = ['self'];
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          let paramType = 'bytes';
          
          if (typeInfo && typeInfo.paramTypes && typeInfo.paramTypes[index]) {
            paramType = this.mapType(typeInfo.paramTypes[index].name, 'python');
          } else {
            paramType = this.inferParameterType(param.name, 'python');
          }
          
          params.push(`${this.toPythonCase(param.name)}: ${paramType}`);
        });
      }
      
      code += params.join(', ') + ')';
      
      // Determine return type
      if (typeInfo && typeInfo.returnType) {
        const returnType = this.mapType(typeInfo.returnType.name, 'python');
        code += ` -> ${returnType}`;
      } else if (node.key.name === 'process') {
        code += ' -> bytes';
      }
      
      code += ':';
      
      if (node.value.body) {
        code += '\n' + this.generateNode(node.value.body);
      }
      
      return code;
    }

    /**
     * Generate enhanced method call with OpCodes mapping
     */
    generateEnhancedCallExpression(node) {
      if (node.callee.type === 'MemberExpression' && 
          node.callee.object.name === 'OpCodes') {
        
        const methodName = node.callee.property.name;
        
        switch (this.targetLanguage) {
          case 'java':
            return `OpCodes.${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'csharp':
            return `OpCodes.${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'cpp':
            return `OpCodes::${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'rust':
            return `op_codes::${this.toSnakeCase(methodName)}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'kotlin':
            return `OpCodes.${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'go':
            return `opcodes.${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'perl':
            return `OpCodes::${this.toPythonCase(methodName)}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'freebasic':
            return `OpCodes.${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'delphi':
            return `OpCodes.${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          case 'python':
            return `op_codes.${this.toPythonCase(methodName)}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
          default:
            return `OpCodes.${methodName}(${node.arguments.map(arg => this.generateNode(arg)).join(', ')})`;
        }
      }
      
      // Regular method call
      return this.generateNode(node.callee) + '(' + node.arguments.map(arg => this.generateNode(arg)).join(', ') + ')';
    }

    /**
     * Convert camelCase to snake_case for Python
     */
    toPythonCase(name) {
      return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }

    /**
     * Convert camelCase to snake_case for Rust
     */
    toSnakeCase(name) {
      return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }

    /**
     * Map type from internal representation to target language
     */
    mapType(internalType, targetLanguage) {
      if (this.typeMap[targetLanguage] && this.typeMap[targetLanguage][internalType]) {
        return this.typeMap[targetLanguage][internalType];
      }
      
      // Fallback mappings
      const fallbackMap = {
        'byte': { rust: 'u8', go: 'uint8', kotlin: 'Byte', perl: 'scalar', freebasic: 'UByte', delphi: 'Byte' },
        'word': { rust: 'u16', go: 'uint16', kotlin: 'Short', perl: 'scalar', freebasic: 'UShort', delphi: 'Word' },
        'dword': { rust: 'u32', go: 'uint32', kotlin: 'Int', perl: 'scalar', freebasic: 'UInteger', delphi: 'Cardinal' },
        'qword': { rust: 'u64', go: 'uint64', kotlin: 'Long', perl: 'scalar', freebasic: 'ULongInt', delphi: 'UInt64' },
        'byte[]': { rust: 'Vec<u8>', go: '[]uint8', kotlin: 'ByteArray', perl: 'array_ref', freebasic: 'UByte Ptr', delphi: 'TBytes' }
      };
      
      return fallbackMap[internalType]?.[targetLanguage] || internalType;
    }

    /**
     * Generate typed binary expression
     */
    generateTypedBinaryExpression(node) {
      const left = this.generateNode(node.left);
      const right = this.generateNode(node.right);
      
      // Handle bitwise operations that might need casting in some languages
      if (['&', '|', '^', '<<', '>>', '>>>'].includes(node.operator)) {
        switch (this.targetLanguage) {
          case 'java':
          case 'csharp':
            // These languages handle bitwise ops well
            return `${left} ${node.operator} ${right}`;
          case 'cpp':
            // C++ might need explicit casting for some ops
            return `${left} ${node.operator} ${right}`;
          case 'python':
            // Python handles big integers automatically
            if (node.operator === '>>>') {
              // Python doesn't have >>> operator, need to simulate
              return `(${left} >> ${right}) & ((1 << (32 - ${right})) - 1)`;
            }
            return `${left} ${this.mapPythonOperator(node.operator)} ${right}`;
          default:
            return `${left} ${node.operator} ${right}`;
        }
      }
      
      return `${left} ${node.operator} ${right}`;
    }

    /**
     * Map operators to Python equivalents
     */
    mapPythonOperator(operator) {
      const mapping = {
        '===': '==',
        '!==': '!=',
        '&&': 'and',
        '||': 'or'
      };
      return mapping[operator] || operator;
    }

    /**
     * Generate language-specific headers and imports
     */
    generateHeader() {
      switch (this.targetLanguage) {
        case 'java':
          return `// Generated Java code from JavaScript AST
import java.util.*;

`;
        case 'csharp':
          return `// Generated C# code from JavaScript AST
using System;
using System.Collections.Generic;

`;
        case 'cpp':
          return `// Generated C++ code from JavaScript AST
#include <vector>
#include <cstdint>
#include <string>

`;
        case 'python':
          return `# Generated Python code from JavaScript AST
from typing import List, Optional
import op_codes

`;
        case 'typescript':
          return `// Generated TypeScript code from JavaScript AST

`;
        default:
          return `// Generated JavaScript code from AST

`;
      }
    }

    /**
     * Generate complete program with header
     */
    generateProgram(node) {
      let code = this.generateHeader();
      code += node.body.map(stmt => this.generateNode(stmt)).join('\n\n');
      return code;
    }

    /**
     * Generate block statement
     */
    generateBlockStatement(node) {
      if (this.targetLanguage === 'python') {
        return node.body.map(stmt => this.generateNode(stmt)).join('\n');
      } else {
        return '{\n' + node.body.map(stmt => this.indent(this.generateNode(stmt))).join('\n') + '\n}';
      }
    }

    /**
     * Add indentation
     */
    indent(code) {
      return code.split('\n').map(line => this.indentString + line).join('\n');
    }

    /**
     * Generate for statement
     */
    generateForStatement(node) {
      switch (this.targetLanguage) {
        case 'python':
          // Convert JavaScript for loop to Python equivalent
          if (node.init && node.test && node.update) {
            const init = this.generateNode(node.init).replace(/let |const |var /, '');
            const test = this.generateNode(node.test);
            const update = this.generateNode(node.update);
            
            // Try to convert simple for loops to Python range
            if (init.includes(' = 0') && test.includes(' < ') && update.includes('++')) {
              const variable = init.split(' = ')[0];
              const limit = test.split(' < ')[1];
              return `for ${variable} in range(${limit}):\n${this.indent(this.generateNode(node.body))}`;
            }
          }
          
          // Fallback to while loop equivalent
          let code = '';
          if (node.init) code += this.generateNode(node.init) + '\n';
          code += `while ${this.generateNode(node.test)}:\n`;
          code += this.indent(this.generateNode(node.body));
          if (node.update) {
            code += '\n' + this.indent(this.generateNode(node.update));
          }
          return code;
          
        default:
          const init = node.init ? this.generateNode(node.init) : '';
          const test = node.test ? this.generateNode(node.test) : '';
          const update = node.update ? this.generateNode(node.update) : '';
          
          return `for (${init}; ${test}; ${update}) ${this.generateNode(node.body)}`;
      }
    }

    /**
     * Generate if statement
     */
    generateIfStatement(node) {
      switch (this.targetLanguage) {
        case 'python':
          let pythonCode = `if ${this.generateNode(node.test)}:\n`;
          pythonCode += this.indent(this.generateNode(node.consequent));
          
          if (node.alternate) {
            if (node.alternate.type === 'IfStatement') {
              pythonCode += '\nel' + this.generateNode(node.alternate);
            } else {
              pythonCode += '\nelse:\n';
              pythonCode += this.indent(this.generateNode(node.alternate));
            }
          }
          
          return pythonCode;
          
        default:
          let jsCode = `if (${this.generateNode(node.test)}) ${this.generateNode(node.consequent)}`;
          
          if (node.alternate) {
            jsCode += ` else ${this.generateNode(node.alternate)}`;
          }
          
          return jsCode;
      }
    }

    /**
     * Generate while statement
     */
    generateWhileStatement(node) {
      switch (this.targetLanguage) {
        case 'python':
          return `while ${this.generateNode(node.test)}:\n${this.indent(this.generateNode(node.body))}`;
        default:
          return `while (${this.generateNode(node.test)}) ${this.generateNode(node.body)}`;
      }
    }

    /**
     * Generate function declaration with proper types
     */
    generateFunction(node) {
      switch (this.targetLanguage) {
        case 'python':
          const params = node.params.map(p => p.name).join(', ');
          return `def ${node.id.name}(${params}):\n${this.indent(this.generateNode(node.body))}`;
        case 'typescript':
          const tsParams = node.params.map(p => {
            const paramType = this.typeKnowledge.inferType(p.name);
            const mappedType = this.typeKnowledge.mapType(paramType, 'typescript');
            return `${p.name}: ${mappedType}`;
          }).join(', ');
          
          return `function ${node.id.name}(${tsParams}): void ${this.generateNode(node.body)}`;
        default:
          const jsParams = node.params.map(p => p.name).join(', ');
          return `function ${node.id.name}(${jsParams}) ${this.generateNode(node.body)}`;
      }
    }

    /**
     * Generate main output
     */
    generate(ast) {
      return this.generateNode(ast);
    }
  }

  /**
   * Enhanced Transpiler with Type Awareness
   */
  class TypeAwareJSTranspiler {
    constructor() {
      this.parser = null;
      this.generator = null;
    }

    /**
     * Transpile JavaScript code to target language with type information
     */
    transpile(jsCode, targetLanguage, options = {}) {
      try {
        // Parse JavaScript to AST with type information
        this.parser = new TypeAwareJSASTParser(jsCode);
        const ast = this.parser.parse();
        
        // Remove test vectors if requested
        if (options.includeTestVectors === false) {
          this.removeTestVectors(ast);
        }
        
        // If target language is 'ast', return the AST directly
        if (targetLanguage === 'ast') {
          return {
            success: true,
            code: '', // No code generated, just AST
            ast: ast,
            typeInfo: this.parser.typeAnnotations
          };
        }
        
        // Generate code in target language with types
        this.generator = new TypeAwareCodeGenerator(targetLanguage, this.parser);
        const generatedCode = this.generator.generate(ast);
        
        return {
          success: true,
          code: generatedCode,
          ast: ast,
          typeInfo: this.parser.typeAnnotations
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          ast: null
        };
      }
    }

    /**
     * Remove test vectors from AST
     * Specifically removes this.tests = [...] assignments in constructors
     * of classes that derive from AlgorithmFramework.Algorithm
     */
    removeTestVectors(ast) {
      const removeFromNode = (node) => {
        if (!node || typeof node !== 'object') return;

        // Handle class declarations - look for classes extending Algorithm types
        if (node.type === 'ClassDeclaration' && node.superClass) {
          const isAlgorithmClass = this.isAlgorithmFrameworkClass(node.superClass);
          if (isAlgorithmClass) {
            console.log(`🔍 Found AlgorithmFramework class: ${node.id?.name}`);
            this.removeTestAssignmentsFromClass(node);
          }
        }

        // Recursively process child nodes
        for (const key in node) {
          if (node.hasOwnProperty(key) && key !== 'parent') {
            const child = node[key];
            if (Array.isArray(child)) {
              child.forEach(removeFromNode);
            } else if (child && typeof child === 'object') {
              removeFromNode(child);
            }
          }
        }
      };

      removeFromNode(ast);
    }

    /**
     * Check if a class extends AlgorithmFramework.Algorithm or its derivatives
     */
    isAlgorithmFrameworkClass(superClass) {
      if (!superClass) return false;

      // Handle MemberExpression (e.g., AlgorithmFramework.Algorithm)
      if (superClass.type === 'MemberExpression') {
        return superClass.object?.name === 'AlgorithmFramework' || 
               superClass.property?.name?.includes('Algorithm');
      }

      // Handle Identifier (e.g., CryptoAlgorithm, BlockCipherAlgorithm, etc.)
      if (superClass.type === 'Identifier') {
        const algorithmTypes = [
          'Algorithm', 'CryptoAlgorithm', 'SymmetricCipherAlgorithm', 
          'AsymmetricCipherAlgorithm', 'BlockCipherAlgorithm', 'StreamCipherAlgorithm',
          'EncodingAlgorithm', 'CompressionAlgorithm', 'ErrorCorrectionAlgorithm',
          'HashFunctionAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'PaddingAlgorithm',
          'CipherModeAlgorithm', 'AeadAlgorithm', 'RandomGenerationAlgorithm'
        ];
        return algorithmTypes.includes(superClass.name);
      }

      return false;
    }

    /**
     * Remove this.tests = [...] assignments from class constructors
     */
    removeTestAssignmentsFromClass(classNode) {
      // Handle different class body structures
      let classMembers;
      if (classNode.body && Array.isArray(classNode.body)) {
        // Direct array structure
        classMembers = classNode.body;
      } else if (classNode.body && classNode.body.body && Array.isArray(classNode.body.body)) {
        // Nested body structure
        classMembers = classNode.body.body;
      } else {
        return;
      }

      // Find constructor method
      const constructor = classMembers.find(member => {
        return member.type === 'MethodDefinition' && 
               (member.kind === 'constructor' || member.key?.name === 'constructor');
      });

      if (!constructor || !constructor.value || !constructor.value.body || !constructor.value.body.body) {
        return;
      }

      const statements = constructor.value.body.body;
      
      // Filter out this.tests = [...] assignments
      const originalLength = statements.length;
      constructor.value.body.body = statements.filter(stmt => {
        if (stmt.type === 'ExpressionStatement' && 
            stmt.expression.type === 'AssignmentExpression' &&
            stmt.expression.left.type === 'MemberExpression' &&
            stmt.expression.left.object?.type === 'ThisExpression' &&
            stmt.expression.left.property?.name === 'tests') {
          console.log(`🗑️ Removing this.tests assignment in ${classNode.id?.name} constructor`);
          return false;
        }
        return true;
      });

      const removedCount = originalLength - constructor.value.body.body.length;
      if (removedCount > 0) {
        console.log(`✅ Removed ${removedCount} test vector assignment(s) from ${classNode.id?.name}`);
      }
    }

    /**
     * Get type information for the last parsed code
     */
    getTypeInformation() {
      return this.parser ? this.parser.typeAnnotations : null;
    }

    /**
     * Get inferred types for all identifiers in the code
     */
    getInferredTypes() {
      if (!this.parser) return {};
      
      const types = {};
      for (const [node, typeInfo] of this.parser.typeAnnotations) {
        if (node.type === 'Identifier') {
          types[node.name] = typeInfo;
        }
      }
      return types;
    }

    /**
     * Static method for compatibility with multi-language generator
     * @param {string} targetLanguage - Target language key
     * @param {string} jsCode - JavaScript source code to convert
     * @param {Object} options - Generation options
     * @returns {Object} Conversion result with success flag and generated code
     */
    static transpileFromSource(targetLanguage, jsCode, options = {}) {
      const instance = new TypeAwareJSTranspiler();
      return instance.transpile(jsCode, targetLanguage, options);
    }
  }

  // Export the enhanced transpiler
  const TypeAwareJSASTTranspiler = {
    TypeAwareJSASTParser,
    TypeAwareCodeGenerator,
    TypeAwareJSTranspiler,
    JSDocParser,
    PreciseTypeKnowledge
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TypeAwareJSASTTranspiler;
  } else if (typeof global !== 'undefined') {
    global.TypeAwareJSASTTranspiler = TypeAwareJSASTTranspiler;
  } else if (typeof window !== 'undefined') {
    window.TypeAwareJSASTTranspiler = TypeAwareJSASTTranspiler;
  }

})(typeof global !== 'undefined' ? global : this);
