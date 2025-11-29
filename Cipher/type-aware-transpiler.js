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
        examples: [],
        csharpOverride: null  // Native C# code to use instead of transpiling
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
      // Capture type in braces, then everything after (optional dash is common but not required)
      const returnMatch = cleaned.match(/@returns?\s+\{([^}]+)\}\s*(.*)/);
      if (returnMatch) {
        let returnType = this.parseType(returnMatch[1]);
        // Description may start with optional "- " prefix
        let description = (returnMatch[2] || '').replace(/^-\s*/, '');

        // Check for Object type with tuple-like description
        // Supports both {propName: type, propName: type} and {prop, prop} formats
        if (returnType.name === 'Object' && description) {
          const tuplePattern = /\{([^}]+)\}/;
          const tupleMatch = description.match(tuplePattern);
          if (tupleMatch) {
            const tupleContent = tupleMatch[1];
            // Parse comma-separated pairs
            const pairs = tupleContent.split(',').map(p => p.trim()).filter(p => p);
            const tupleParts = [];
            for (const pair of pairs) {
              const colonIdx = pair.indexOf(':');
              if (colonIdx > 0) {
                // Format: "propName: type"
                const propName = pair.substring(0, colonIdx).trim();
                const propType = pair.substring(colonIdx + 1).trim();
                tupleParts.push({ name: propName, type: this.parseType(propType) });
              } else {
                // Format: just "propName" - default to uint for crypto operations
                const propName = pair.trim();
                if (propName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(propName)) {
                  tupleParts.push({ name: propName, type: this.parseType('uint') });
                }
              }
            }
            if (tupleParts.length > 0) {
              // Create a tuple type
              returnType = {
                name: 'tuple',
                isTuple: true,
                tupleElements: tupleParts,
                isArray: false,
                isOptional: false,
                isUnion: false,
                unionTypes: [],
                isGeneric: false,
                genericTypes: [],
                isNullable: false
              };
            }
          }
        }

        result.returns = {
          type: returnType,
          description: description
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

      // Parse @csharp directive - native C# code to use instead of transpiling
      // Format: @csharp <C# statement(s)>
      // Stop at next @ tag or end of comment
      const csharpRegex = /@csharp\s+(.+?)(?=\n\s*@|\n*$)/s;
      const csharpMatch = cleaned.match(csharpRegex);
      if (csharpMatch) {
        result.csharpOverride = csharpMatch[1].trim();
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
        'Checksum16': { params: ['byte[]'], returns: 'word', description: 'Calculate 16-bit checksum' },

        // Tuple-returning operations
        'Split64': { params: ['double'], returns: '(high32: uint32, low32: uint32)', description: 'Split 64-bit float to two 32-bit components' },
        'SplitNibbles': { params: ['byte'], returns: '(high: uint8, low: uint8)', description: 'Split byte into high and low nibbles' },
        'Combine64': { params: ['dword', 'dword'], returns: 'double', description: 'Combine two 32-bit to 64-bit float' }
      };

      // AlgorithmFramework.js class types and interfaces
      this.frameworkTypes = {
        // Base classes
        'Algorithm': {
          properties: {
            'name': 'string',
            'description': 'string',
            'inventor': 'string',
            'year': 'int',
            'category': 'CategoryType',
            'subCategory': 'string',
            'securityStatus': 'SecurityStatus',
            'complexity': 'ComplexityType',
            'country': 'CountryCode',
            'documentation': 'LinkItem[]',
            'references': 'LinkItem[]',
            'knownVulnerabilities': 'Vulnerability[]',
            'tests': 'object[]'
          },
          methods: {
            'CreateInstance': { params: ['bool'], returns: 'IAlgorithmInstance' }
          }
        },

        'BlockCipherAlgorithm': {
          extends: 'Algorithm',
          properties: {
            'SupportedKeySizes': 'KeySize[]',
            'SupportedBlockSizes': 'KeySize[]',
            'Tables': 'object'
          },
          methods: {
            'CreateInstance': { params: ['bool'], returns: 'IBlockCipherInstance' }
          }
        },

        'IBlockCipherInstance': {
          extends: 'IAlgorithmInstance',
          properties: {
            'BlockSize': 'int',
            'KeySize': 'int',
            'key': 'byte[]',
            'iv': 'byte[]',
            'IsInverse': 'bool',
            'InputBuffer': 'byte[]',
            'RoundKeys': 'byte[]',
            'Rounds': 'int'
          },
          methods: {
            'Feed': { params: ['byte[]'], returns: 'void' },
            'Result': { params: [], returns: 'byte[]' },
            'EncryptBlock': { params: ['byte[]'], returns: 'byte[]' },
            'DecryptBlock': { params: ['byte[]'], returns: 'byte[]' },
            'Dispose': { params: [], returns: 'void' }
          }
        },

        'IAlgorithmInstance': {
          properties: {
            'IsInverse': 'bool',
            'InputBuffer': 'byte[]'
          },
          methods: {
            'Feed': { params: ['byte[]'], returns: 'void' },
            'Result': { params: [], returns: 'byte[]' },
            'Dispose': { params: [], returns: 'void' }
          }
        },

        'HashFunctionAlgorithm': {
          extends: 'Algorithm',
          properties: {
            'SupportedOutputSizes': 'KeySize[]'
          },
          methods: {
            'CreateInstance': { params: ['bool'], returns: 'IHashFunctionInstance' }
          }
        },

        'IHashFunctionInstance': {
          extends: 'IAlgorithmInstance',
          properties: {
            'OutputSize': 'int'
          },
          methods: {
            'Feed': { params: ['byte[]'], returns: 'void' },
            'Result': { params: [], returns: 'byte[]' }
          }
        },

        'CompressionAlgorithm': {
          extends: 'Algorithm',
          methods: {
            'CreateInstance': { params: ['bool'], returns: 'ICompressionInstance' }
          }
        },

        'ICompressionInstance': {
          extends: 'IAlgorithmInstance',
          properties: {
            'IsInverse': 'bool',
            'InputBuffer': 'byte[]'
          },
          methods: {
            'Feed': { params: ['byte[]'], returns: 'void' },
            'Result': { params: [], returns: 'byte[]' }
          }
        },

        'StreamCipherAlgorithm': {
          extends: 'Algorithm',
          methods: {
            'CreateInstance': { params: ['bool'], returns: 'IStreamCipherInstance' }
          }
        },

        'IStreamCipherInstance': {
          extends: 'IAlgorithmInstance',
          properties: {
            'key': 'byte[]',
            'iv': 'byte[]',
            'IsInverse': 'bool'
          },
          methods: {
            'Feed': { params: ['byte[]'], returns: 'void' },
            'Result': { params: [], returns: 'byte[]' }
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
      this.lastJSDocComment = null; // Track the last JSDoc comment seen
      this.pendingComments = []; // Track all comments between tokens
      this.classHierarchy = new Map(); // Maps class names to their base classes
      this.classMembers = new Map(); // Maps class names to their member type signatures
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

      let ast = this.parseProgram();

      // Unwrap UMD/IIFE module patterns to extract inner factory function
      ast = this.unwrapModulePatterns(ast);

      // Multi-pass type narrowing until convergence
      this.performTypeNarrowing(ast);

      return ast;
    }

    /**
     * Unwrap UMD (Universal Module Definition) and IIFE patterns
     * Extracts the factory function body from patterns like:
     *   (function(root, factory) { ... })(globalThis, function(deps) { ...actual code... })
     * @param {Object} ast - Parsed AST
     * @returns {Object} Unwrapped AST or original if not a module pattern
     */
    unwrapModulePatterns(ast) {
      if (!ast || !ast.body || ast.body.length === 0) return ast;

      // Check if program consists primarily of a single IIFE call expression
      const mainStatements = ast.body.filter(stmt =>
        stmt.type !== 'EmptyStatement' &&
        !(stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'Literal')
      );

      if (mainStatements.length !== 1) return ast;

      const stmt = mainStatements[0];

      // Pattern 1: ExpressionStatement containing CallExpression
      if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'CallExpression') {
        const unwrapped = this.tryUnwrapUMD(stmt.expression);
        if (unwrapped) {
          console.error('📦 Unwrapped UMD module pattern');
          return unwrapped;
        }
      }

      return ast;
    }

    /**
     * Try to unwrap a UMD CallExpression pattern
     * @param {Object} callExpr - CallExpression AST node
     * @returns {Object|null} Unwrapped Program AST or null if not a UMD pattern
     */
    tryUnwrapUMD(callExpr) {
      // UMD pattern: (function(root, factory) { ... })(globalThisExpr, factoryFunction)
      // The callee is a parenthesized FunctionExpression
      const callee = callExpr.callee;
      const args = callExpr.arguments || [];

      // Callee must be a FunctionExpression (the UMD wrapper)
      if (!callee || callee.type !== 'FunctionExpression') return null;

      // The wrapper typically has 2 parameters: root and factory
      const wrapperParams = callee.params || [];
      if (wrapperParams.length < 2) return null;

      // Check if the second parameter is named 'factory' (common UMD convention)
      const factoryParamName = wrapperParams[1]?.name;
      if (!factoryParamName) return null;

      // Find the factory function in the call arguments (typically second argument)
      // args[0] = globalThis/window/global expression
      // args[1] = factory function
      let factoryFn = null;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.type === 'FunctionExpression' || arg.type === 'ArrowFunctionExpression') {
          // Check if this function has parameters matching the expected dependencies
          // (AlgorithmFramework, OpCodes, etc.)
          const params = arg.params || [];
          if (params.length >= 1) {
            // This is likely the factory function
            factoryFn = arg;
            break;
          }
        }
      }

      if (!factoryFn) return null;

      // Extract the factory function's body
      const factoryBody = factoryFn.body;
      if (!factoryBody) return null;

      // If the factory body is a BlockStatement, extract its statements
      let statements = [];
      if (factoryBody.type === 'BlockStatement') {
        statements = factoryBody.body || [];
      } else {
        // Arrow function with expression body
        statements = [{ type: 'ReturnStatement', argument: factoryBody }];
      }

      // Filter out "use strict" directives and dependency validation checks
      const filteredStatements = statements.filter(stmt => {
        // Keep "use strict"
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression?.type === 'Literal' &&
            stmt.expression?.value === 'use strict') {
          return false; // Skip, C# doesn't need this
        }

        // Skip dependency validation: if (!Dependency) throw ...
        if (stmt.type === 'IfStatement' &&
            stmt.test?.type === 'UnaryExpression' &&
            stmt.test?.operator === '!' &&
            stmt.consequent?.type === 'ThrowStatement') {
          return false;
        }

        return true;
      });

      // Skip destructuring from AlgorithmFramework (const { ... } = AlgorithmFramework)
      // These are framework imports that need different handling
      const processedStatements = filteredStatements.filter(stmt => {
        if (stmt.type === 'VariableDeclaration') {
          const decl = stmt.declarations?.[0];
          if (decl?.id?.type === 'ObjectPattern' &&
              decl?.init?.type === 'Identifier' &&
              decl?.init?.name === 'AlgorithmFramework') {
            // Store the destructured names for reference
            this.frameworkImports = new Set();
            for (const prop of decl.id.properties || []) {
              if (prop.key?.name) {
                this.frameworkImports.add(prop.key.name);
              }
            }
            return false; // Skip this statement
          }
        }
        return true;
      });

      // Create a new Program with the extracted statements
      return {
        type: 'Program',
        body: processedStatements,
        sourceType: 'module',
        isUnwrappedModule: true,
        factoryParams: factoryFn.params?.map(p => p.name) || []
      };
    }

    /**
     * Perform multi-pass type narrowing until convergence
     * Each pass narrows types based on usage context, continuing until no changes occur
     */
    performTypeNarrowing(ast) {
      const MAX_ITERATIONS = 10;
      let iteration = 0;
      let typesChanged = true;

      // console.error(`DEBUG: Starting multi-pass type narrowing...`);

      while (typesChanged && iteration < MAX_ITERATIONS) {
        typesChanged = false;
        iteration++;

        const changeCount = this.narrowTypesPass(ast);
        if (changeCount > 0) {
          typesChanged = true;
          // console.error(`DEBUG: Pass ${iteration}: ${changeCount} types narrowed`);
        }
      }

      // console.error(`DEBUG: Type narrowing completed after ${iteration} passes (${this.typeAnnotations.size} types inferred)`);
    }

    /**
     * Single pass of type narrowing
     * Returns the number of types that were narrowed
     */
    narrowTypesPass(node, context = {}) {
      if (!node || typeof node !== 'object') return 0;

      let changeCount = 0;

      // Handle different node types
      switch (node.type) {
        case 'ClassDeclaration':
          // Track class inheritance hierarchy
          if (node.id && node.id.name) {
            const className = node.id.name;

            // Track base class if present
            if (node.superClass) {
              const baseName = node.superClass.name || (node.superClass.property ? node.superClass.property.name : null);
              if (baseName) {
                this.classHierarchy.set(className, baseName);
              }
            }

            // Collect member signatures from this class
            const members = new Map();
            if (node.body && node.body.body) {
              node.body.body.forEach(member => {
                if (member.key && member.key.name && member.value) {
                  // Store member with its type info
                  const memberName = member.key.name;
                  if (member.value.typeInfo) {
                    members.set(memberName, member.value.typeInfo);
                  }
                }
              });
            }
            this.classMembers.set(className, members);
          }
          break;

        case 'VariableDeclarator':
          if (node.id && node.init) {
            const existing = this.typeAnnotations.get(node.id);
            const currentType = existing?.type || 'object';
            const inferredType = this.inferExpressionType(node.init, context);

            // Only update if we're narrowing from 'object' to something more specific
            // Never widen types or change between non-object types
            if (currentType === 'object' && inferredType !== 'object') {
              this.typeAnnotations.set(node.id, { type: inferredType, source: 'assignment' });
              if (node.id.name) context[node.id.name] = inferredType;
              changeCount++;
            }
          }
          break;

        case 'AssignmentExpression':
          // Infer type from right side to left side
          if (node.left && node.right) {
            const rightType = this.inferExpressionType(node.right, context);
            if (node.left.type === 'Identifier') {
              const existing = this.typeAnnotations.get(node.left);
              const currentType = existing?.type || 'object';
              if (currentType === 'object' && rightType !== 'object') {
                this.typeAnnotations.set(node.left, { type: rightType, source: 'assignment' });
                if (node.left.name) context[node.left.name] = rightType;
                changeCount++;
              }
            } else if (node.left.type === 'MemberExpression') {
              // Handle array element assignment: arr[i] = value
              const arrayType = this.inferExpressionType(node.left.object, context);
              if (arrayType && arrayType.isArray && arrayType !== 'object') {
                const existing = this.typeAnnotations.get(node.left.object);
                if (!existing || existing.type === 'object') {
                  this.typeAnnotations.set(node.left.object, { type: arrayType, source: 'array_assignment' });
                  changeCount++;
                }
              }
            }
          }
          break;

        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
          // Analyze function return type from JSDoc or return statements
          if (!this.typeAnnotations.has(node)) {
            const returnType = this._analyzeReturnType(node);
            if (returnType && returnType !== 'object') {
              this.typeAnnotations.set(node, { type: returnType, source: 'jsdoc' });
              changeCount++;
            }
          }

          // Add parameters to context
          if (node.params) {
            node.params.forEach(param => {
              if (param.type === 'Identifier' && param.name) {
                // First try JSDoc, then fall back to usage-based inference
                let paramType = this._extractJSDocParamType(node, param.name);
                let typeSource = 'jsdoc';
                if (!paramType) {
                  paramType = this._inferParameterTypeFromUsage(node, param.name);
                  typeSource = 'inferred';
                }
                paramType = paramType || 'object';
                if (!this.typeAnnotations.has(param) && paramType !== 'object') {
                  this.typeAnnotations.set(param, { type: paramType, source: typeSource });
                  context[param.name] = paramType;
                  changeCount++;
                }
              }
            });
          }
          break;
      }

      // Recursively process children
      for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'comments') continue;
        const value = node[key];

        if (Array.isArray(value)) {
          value.forEach(child => {
            changeCount += this.narrowTypesPass(child, { ...context });
          });
        } else if (value && typeof value === 'object') {
          changeCount += this.narrowTypesPass(value, { ...context });
        }
      }

      return changeCount;
    }

    /**
     * Helper to analyze return type from JSDoc or return statements
     */
    _analyzeReturnType(funcNode) {
      // Check for JSDoc return type
      if (funcNode.typeInfo && funcNode.typeInfo.returns) {
        return funcNode.typeInfo.returns;
      }

      // TODO: Analyze actual return statements in function body
      return 'object';
    }

    /**
     * Helper to extract JSDoc parameter type
     */
    _extractJSDocParamType(funcNode, paramName) {
      if (funcNode.typeInfo && funcNode.typeInfo.params) {
        return funcNode.typeInfo.params.get(paramName);
      }
      return null;
    }

    /**
     * Infer parameter type from usage patterns within the function body.
     * Looks for array-like usage (.length, indexing, array methods).
     * @param {Object} funcNode - The function AST node
     * @param {string} paramName - The parameter name to analyze
     * @returns {string|null} Inferred type or null
     */
    _inferParameterTypeFromUsage(funcNode, paramName) {
      if (!funcNode.body) return null;

      let hasArrayUsage = false;
      let hasLengthAccess = false;
      let hasIndexAccess = false;

      const analyzeNode = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check for param.length access
        if (node.type === 'MemberExpression' &&
            node.object && node.object.type === 'Identifier' &&
            node.object.name === paramName &&
            node.property && node.property.name === 'length') {
          hasLengthAccess = true;
        }

        // Check for param[index] access
        if (node.type === 'MemberExpression' &&
            node.computed === true &&
            node.object && node.object.type === 'Identifier' &&
            node.object.name === paramName) {
          hasIndexAccess = true;
        }

        // Check for array method calls (push, pop, slice, etc.)
        if (node.type === 'CallExpression' &&
            node.callee && node.callee.type === 'MemberExpression' &&
            node.callee.object && node.callee.object.type === 'Identifier' &&
            node.callee.object.name === paramName) {
          const method = node.callee.property && node.callee.property.name;
          if (['push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'concat', 'indexOf', 'includes', 'fill'].includes(method)) {
            hasArrayUsage = true;
          }
        }

        // Recursively analyze children
        for (const key in node) {
          if (key === 'loc' || key === 'range' || key === 'comments') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(analyzeNode);
          } else if (value && typeof value === 'object') {
            analyzeNode(value);
          }
        }
      };

      analyzeNode(funcNode.body);

      // If we see length access or index access, it's likely an array
      if (hasArrayUsage || hasLengthAccess || hasIndexAccess) {
        // Default to byte[] for cryptographic code where arrays are common
        return 'byte[]';
      }

      return null;
    }

    /**
     * Look up method type from class hierarchy (follows inheritance chain)
     * @param {string} className - The class to search in
     * @param {string} memberName - The member/method name to find
     * @returns {Object|null} Type info from base class or null
     */
    _lookupInheritedMemberType(className, memberName) {
      // Check current class first
      if (this.classMembers.has(className)) {
        const members = this.classMembers.get(className);
        if (members.has(memberName)) {
          return members.get(memberName);
        }
      }

      // Walk up the inheritance chain
      if (this.classHierarchy.has(className)) {
        const baseName = this.classHierarchy.get(className);
        return this._lookupInheritedMemberType(baseName, memberName);
      }

      return null;
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
        // Skip and collect comments at the program level
        const leadingComments = this.skipComments();
        if (!this.currentToken) break;

        const stmt = this.parseStatement();
        if (stmt) {
          // Attach leading comments to the statement node
          if (leadingComments && leadingComments.length > 0) {
            stmt.leadingComments = leadingComments;
          }
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
        // Skip and collect comments at block level
        const leadingComments = this.skipComments();

        // Check again after skipping comments
        if (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
          const stmt = this.parseStatement();
          if (stmt) {
            // Attach leading comments to the statement node
            if (leadingComments && leadingComments.length > 0) {
              stmt.leadingComments = leadingComments;
            }
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
     * Parse number (supports decimal, hex 0x, octal 0o, binary 0b)
     */
    parseNumber() {
      const tokenValue = this.currentToken.value;
      // Use Number() to correctly parse hex (0x), octal (0o), binary (0b), and decimal
      // parseFloat doesn't handle hex/octal/binary literals correctly
      const numValue = Number(tokenValue);
      const node = { type: 'Literal', value: numValue, raw: tokenValue };
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

        // Capture JSDoc comment before this property
        const jsDoc = this.consumeJSDoc();

        // Parse key (can be identifier, string, number, or keyword)
        if (this.currentToken.type === 'IDENTIFIER') {
          property.key = this.parseIdentifier();

          this.skipComments();

          // Check for ES6 method shorthand syntax (e.g., { getValue() { ... } })
          if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '(') {
            // Method shorthand: parse as function
            const params = this.parseParameterList();
            this.skipComments();
            const body = this.parseBlockStatement();

            property.value = {
              type: 'FunctionExpression',
              params,
              body
            };
            property.method = true;
          }
          // Check for shorthand property syntax (e.g., {func1, func2})
          else if (this.currentToken && this.currentToken.type === 'PUNCTUATION' &&
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

        // Attach JSDoc type information if available
        if (jsDoc) {
          // Store JSDoc on the property node
          property.jsDoc = jsDoc;

          // Create leadingComments from jsDoc so transformer can access @type
          if (this.lastJSDocRawComment) {
            property.leadingComments = property.leadingComments || [];
            property.leadingComments.push({ type: 'CommentBlock', value: this.lastJSDocRawComment });
            this.lastJSDocRawComment = null;
          }

          // If the property value is a function, attach type info
          if (property.value && property.value.type === 'FunctionExpression') {
            property.value.typeInfo = {
              params: new Map(jsDoc.params.map(p => [p.name, p.type])),
              returns: jsDoc.returns ? jsDoc.returns.type : null,
              csharpOverride: jsDoc.csharpOverride || null  // Native C# code override
            };

            // Attach type info to function parameters
            if (property.value.params) {
              property.value.params.forEach((param, index) => {
                if (jsDoc.params[index] && param.type === 'Identifier') {
                  this.typeAnnotations.set(param, {
                    type: jsDoc.params[index].type,
                    source: 'jsdoc'
                  });
                }
              });
            }

            // Store return type in type annotations
            if (jsDoc.returns) {
              this.typeAnnotations.set(property.value, {
                type: jsDoc.returns.type,
                source: 'jsdoc'
              });
            }
          }
        }

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
        // Skip comments before parsing each argument
        this.skipComments();
        
        // Check if we hit the closing paren after skipping comments
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ')') {
          break;
        }
        
        // Handle spread syntax (...expression)
        if (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '...') {
          this.advance(); // consume '...'
          args.push({
            type: 'SpreadElement',
            argument: this.parseAssignmentExpression()
          });
        } else {
          args.push(this.parseAssignmentExpression());
        }
        
        // Skip comments after the argument
        this.skipComments();
        
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
          this.advance(); // consume ','
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
     * Skip any comment tokens and collect them for attachment to the next statement
     * @returns {Array} Collected comments (for attachment to nodes)
     */
    skipComments() {
      const collected = [];
      while (this.currentToken &&
             (this.currentToken.type === 'COMMENT_SINGLE' || this.currentToken.type === 'COMMENT_MULTI')) {

        // Collect comment for attachment to nodes
        collected.push({
          type: this.currentToken.type === 'COMMENT_MULTI' ? 'Block' : 'Line',
          value: this.currentToken.value
        });

        // Capture JSDoc comments (/** ... */)
        if (this.currentToken.type === 'COMMENT_MULTI' && this.currentToken.value.startsWith('/**')) {
          this.lastJSDocComment = this.currentToken.value;
        }

        this.advance();
      }
      // Also store in pendingComments for alternate access
      this.pendingComments = collected;
      return collected;
    }

    /**
     * Consume and parse the last JSDoc comment if available
     * Returns parsed JSDoc info or null
     */
    consumeJSDoc() {
      if (this.lastJSDocComment) {
        const jsDoc = this.jsDocParser.parseJSDoc(this.lastJSDocComment);
        this.lastJSDocRawComment = this.lastJSDocComment; // Store raw comment for leadingComments
        this.lastJSDocComment = null; // Clear after consumption
        return jsDoc;
      }
      return null;
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
     * NOTE: This method is now deprecated - JSDoc extraction happens in parseObjectExpression
     * Keeping for compatibility but it does nothing now
     */
    parseMethodWithTypes(node) {
      // JSDoc extraction now happens in parseObjectExpression via consumeJSDoc()
      // This method is kept for backward compatibility but does no work
      return node;
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
          // Check context first (function parameters, local variables)
          if (context[node.name]) {
            return context[node.name];
          }
          // Check type annotations
          if (this.typeAnnotations.has(node)) {
            return this.typeAnnotations.get(node).type;
          }
          // Fallback to type knowledge
          return this.typeKnowledge.inferType(node.name, context);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.inferBinaryExpressionType(node, context);

        case 'UnaryExpression':
          return this.inferUnaryExpressionType(node, context);

        case 'UpdateExpression':
          // ++x, x++, --x, x-- always return number
          return { name: 'number' };

        case 'AssignmentExpression':
          // Assignment returns the type of the right side
          return this.inferExpressionType(node.right, context);

        case 'ConditionalExpression':
          // a ? b : c - infer from consequent (could merge both branches)
          return this.inferExpressionType(node.consequent, context);

        case 'NewExpression':
          // new Array(), new List(), etc.
          if (node.callee.name === 'Array' || node.callee.name === 'List') {
            return { name: 'any[]', isArray: true };
          }
          return { name: node.callee.name || 'object' };

        default:
          return { name: 'any' };
      }
    }

    /**
     * Infer type for binary expressions
     */
    inferBinaryExpressionType(node, context) {
      const left = this.inferExpressionType(node.left, context);
      const right = this.inferExpressionType(node.right, context);

      switch (node.operator) {
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
        case '<<':
        case '>>':
        case '>>>':
        case '&':
        case '|':
        case '^':
          // Bitwise and arithmetic operators return number (or preserve specific type)
          if (left.name !== 'any' && left.name !== 'string') return left;
          if (right.name !== 'any' && right.name !== 'string') return right;
          return { name: 'number' };

        case '==':
        case '===':
        case '!=':
        case '!==':
        case '<':
        case '>':
        case '<=':
        case '>=':
        case '&&':
        case '||':
          // Comparison and logical operators return boolean
          return { name: 'boolean' };

        default:
          return { name: 'any' };
      }
    }

    /**
     * Infer type for unary expressions
     */
    inferUnaryExpressionType(node, context) {
      switch (node.operator) {
        case '!':
          return { name: 'boolean' };
        case '+':
        case '-':
        case '~':
          return { name: 'number' };
        case 'typeof':
          return { name: 'string' };
        case 'void':
          return { name: 'void' };
        default:
          return this.inferExpressionType(node.argument, context);
      }
    }

    /**
     * Infer type for method/function calls
     */
    inferCallExpressionType(node, context) {
      if (node.callee.type === 'MemberExpression') {
        const objectName = node.callee.object.name;
        const methodName = node.callee.property.name;

        // First, try to find the actual function definition with JSDoc
        // Look through all parsed object properties for OpCodes.methodName
        for (const [annotatedNode, typeInfo] of this.typeAnnotations.entries()) {
          if (annotatedNode.type === 'FunctionExpression' &&
              typeInfo.type && typeInfo.type.name) {
            // Check if this is the method we're calling
            // We need to match by finding the property name in parent context
            // For now, use the methodName from typeInfo if available
            if (typeInfo.source === 'jsdoc' && typeInfo.type) {
              // This function has JSDoc - check if it matches our call
              // We'd need parent context to properly match, but for OpCodes we can check the method name
              // This is a simplified approach - ideally we'd track function->method name mapping
            }
          }
        }

        // Fallback to hardcoded OpCodes signatures
        if (objectName === 'OpCodes') {
          const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
          if (methodInfo) {
            return this.jsDocParser.parseType(methodInfo.returns);
          }
        }

        // Check for array methods
        const objectType = this.inferExpressionType(node.callee.object, context);
        if (objectType.isArray || (objectType.name && objectType.name.endsWith('[]'))) {
          if (methodName === 'slice' || methodName === 'concat' || methodName === 'filter' || methodName === 'map') {
            return objectType; // Returns same array type
          }
          if (methodName === 'pop' || methodName === 'shift') {
            // Returns element type
            if (objectType.elementType) return objectType.elementType;
            if (objectType.name && objectType.name.endsWith('[]')) {
              const elementTypeName = objectType.name.slice(0, -2);
              return { name: elementTypeName };
            }
          }
          if (methodName === 'push' || methodName === 'unshift') {
            return { name: 'int' }; // Returns new length
          }
          if (methodName === 'join') {
            return { name: 'string' };
          }
        }

        // String methods
        if (objectType.name === 'string') {
          if (methodName === 'substring' || methodName === 'substr' || methodName === 'slice' ||
              methodName === 'toLowerCase' || methodName === 'toUpperCase' || methodName === 'trim') {
            return { name: 'string' };
          }
          if (methodName === 'split') {
            return { name: 'string[]', isArray: true, elementType: { name: 'string' } };
          }
          if (methodName === 'indexOf' || methodName === 'lastIndexOf') {
            return { name: 'int' };
          }
          if (methodName === 'charCodeAt') {
            return { name: 'int' };
          }
        }
      }

      // Direct function call
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name;

        // Check for constructors
        if (funcName === 'Array') {
          return { name: 'any[]', isArray: true };
        }
        if (funcName === 'String') {
          return { name: 'string' };
        }
        if (funcName === 'Number') {
          return { name: 'number' };
        }
        if (funcName === 'Boolean') {
          return { name: 'boolean' };
        }
      }

      return { name: 'any' };
    }

    /**
     * Infer type for member expressions (obj.prop or obj[index])
     */
    inferMemberExpressionType(node, context) {
      const objectType = this.inferExpressionType(node.object, context);

      // Handle array indexing: arr[i] returns element type
      if (node.computed) {
        if (objectType.isArray && objectType.elementType) {
          return objectType.elementType;
        }
        if (objectType.name && objectType.name.endsWith('[]')) {
          // Extract element type from "type[]" format
          const elementTypeName = objectType.name.slice(0, -2);
          return { name: elementTypeName };
        }
        // Default for indexed access
        return { name: 'any' };
      }

      // Handle property access
      const propertyName = node.property.name || node.property.value;

      // Array properties
      if (objectType.isArray || (objectType.name && objectType.name.endsWith('[]'))) {
        if (propertyName === 'length') {
          return { name: 'int' };
        }
        if (propertyName === 'push' || propertyName === 'pop' || propertyName === 'shift' ||
            propertyName === 'unshift' || propertyName === 'slice' || propertyName === 'splice') {
          // These are methods - would need full method signature handling
          return { name: 'function' };
        }
      }

      // String properties
      if (objectType.name === 'string') {
        if (propertyName === 'length') {
          return { name: 'int' };
        }
      }

      // Check framework class properties
      const objectName = node.object.name;
      if (objectName && this.typeKnowledge.frameworkTypes[objectName]) {
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
   * Generates properly typed code using LanguagePlugin system only
   */
  class TypeAwareCodeGenerator {
    constructor(languagePlugin, parser, options = {}) {
      if (!languagePlugin || typeof languagePlugin === 'string') {
        throw new Error('TypeAwareCodeGenerator requires a LanguagePlugin instance. Legacy string mode is no longer supported.');
      }

      this.languagePlugin = languagePlugin;
      this.parser = parser;
      this.typeKnowledge = parser.typeKnowledge;
      this.indentLevel = 0;
      this.targetLanguage = languagePlugin.name.toLowerCase();
      this.indentString = languagePlugin.options.indent || '  ';
      this.options = options;
    }

    /**
     * Generate code using LanguagePlugin only
     */
    generate(ast) {
      const result = this.languagePlugin.GenerateFromAST(ast, {
        parser: this.parser,
        typeKnowledge: this.typeKnowledge,
        indent: this.indentString,
        useAstPipeline: true,  // Use new AST pipeline for better type handling
        className: this.options.className,  // Pass through class name
        namespace: this.options.namespace   // Pass through namespace
      });

      if (!result.success) {
        throw new Error(`Code generation failed: ${result.error}`);
      }

      return result.code;
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
     * @param {string} jsCode - JavaScript source code
     * @param {LanguagePlugin} languagePlugin - LanguagePlugin instance for code generation
     * @param {Object} options - Transpilation options
     */
    transpile(jsCode, languagePlugin, options = {}) {
      try {
        // Validate input
        if (!languagePlugin || typeof languagePlugin !== 'object' || typeof languagePlugin.GenerateFromAST !== 'function') {
          throw new Error('transpile() requires a valid LanguagePlugin instance. Legacy string mode is no longer supported.');
        }
        
        // Parse JavaScript to AST with type information
        this.parser = new TypeAwareJSASTParser(jsCode);
        const ast = this.parser.parse();
        
        // Remove test vectors if requested
        if (options.includeTestVectors === false) {
          this.removeTestVectors(ast);
        }

        // Generate code using LanguagePlugin
        this.generator = new TypeAwareCodeGenerator(languagePlugin, this.parser, options);
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
            console.error(`🔍 Found AlgorithmFramework class: ${node.id?.name}`);
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
          console.error(`🗑️ Removing this.tests assignment in ${classNode.id?.name} constructor`);
          return false;
        }
        return true;
      });

      const removedCount = originalLength - constructor.value.body.body.length;
      if (removedCount > 0) {
        console.error(`✅ Removed ${removedCount} test vector assignment(s) from ${classNode.id?.name}`);
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
     * @param {LanguagePlugin} languagePlugin - LanguagePlugin instance for code generation
     * @param {string} jsCode - JavaScript source code to convert
     * @param {Object} options - Generation options
     * @returns {Object} Conversion result with success flag and generated code
     */
    static transpileFromSource(languagePlugin, jsCode, options = {}) {
      const instance = new TypeAwareJSTranspiler();
      return instance.transpile(jsCode, languagePlugin, options);
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
