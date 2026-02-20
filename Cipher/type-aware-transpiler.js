#!/usr/bin/env node
/*
 * Type-Aware JavaScript AST Transpiler
 * Enhanced version with JSDoc parsing and type inference
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  /**
   * BigInt-safe JSON serialization helper
   * Converts BigInt values to strings for serialization
   * @param {*} obj - Object to serialize
   * @returns {string} JSON string
   */
  function safeJSONStringify(obj) {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value
    );
  }

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
      // OpCodes method signatures - dynamically loaded from OpCodes.js JSDoc
      // These are populated by loadTypesFromSource() when available
      this.opCodesTypes = {};

      // Framework class types - dynamically loaded from AlgorithmFramework.js JSDoc
      // These are populated by loadTypesFromSource() when available
      this.frameworkTypes = {};

      // Enhanced cryptographic patterns with precise types
      this.patternTypes = {
        // Variable name patterns removed - types should come from JSDoc, assignments, or OpCodes signatures
        // Name-based guessing caused false type assignments (e.g., "compress(int $with_length = true)")
        namePatterns: [],

        // Method name patterns → return types (framework-based, not name guessing)
        methodPatterns: [
          { pattern: /encrypt|Encrypt/, type: 'uint8[]' },
          { pattern: /decrypt|Decrypt/, type: 'uint8[]' },
          { pattern: /hash|Hash/, type: 'uint8[]' },
          { pattern: /compute|Compute/, type: 'uint8[]' },
          { pattern: /generate|Generate/, type: 'uint8[]' },
          { pattern: /create|Create/, type: 'Object' },
          { pattern: /setup|Setup|init|Init/, type: 'void' },
          { pattern: /validate|Validate|verify|Verify/, type: 'boolean' },
          { pattern: /process|Process/, type: 'uint8[]' },
          { pattern: /pack|Pack/, type: 'uint32' },
          { pattern: /unpack|Unpack/, type: 'uint8[]' },
          { pattern: /swap|Swap/, type: 'uint32' },
          { pattern: /rotate|Rotate/, type: 'uint32' }
        ],

        // Literal value patterns → types
        literalPatterns: [
          { pattern: value => value >= 0 && value <= 255, type: 'uint8' },
          { pattern: value => value >= 0 && value <= 65535, type: 'uint16' },
          { pattern: value => value >= 0 && value <= 4294967295, type: 'uint32' },
          { pattern: value => typeof value === 'number' && value % 1 !== 0, type: 'float64' },
          { pattern: value => typeof value === 'string', type: 'string' },
          { pattern: value => typeof value === 'boolean', type: 'boolean' }
        ]
      };

      // Type hierarchy and compatibility (using IL vocabulary)
      this.typeHierarchy = {
        'uint8': { bits: 8, signed: false, category: 'integer', canPromoteTo: ['uint16', 'uint32', 'uint64', 'float32', 'float64'] },
        'int8': { bits: 8, signed: true, category: 'integer', canPromoteTo: ['int16', 'int32', 'int64', 'float32', 'float64'] },
        'uint16': { bits: 16, signed: false, category: 'integer', canPromoteTo: ['uint32', 'uint64', 'float32', 'float64'] },
        'int16': { bits: 16, signed: true, category: 'integer', canPromoteTo: ['int32', 'int64', 'float32', 'float64'] },
        'uint32': { bits: 32, signed: false, category: 'integer', canPromoteTo: ['uint64', 'float64'] },
        'int32': { bits: 32, signed: true, category: 'integer', canPromoteTo: ['int64', 'float64'] },
        'uint64': { bits: 64, signed: false, category: 'integer', canPromoteTo: ['float64'] },
        'int64': { bits: 64, signed: true, category: 'integer', canPromoteTo: ['float64'] },
        'float32': { bits: 32, signed: true, category: 'float', canPromoteTo: ['float64'] },
        'float64': { bits: 64, signed: true, category: 'float', canPromoteTo: [] },
        'bigint': { bits: -1, signed: true, category: 'integer', canPromoteTo: [] },
        'boolean': { bits: 1, signed: false, category: 'boolean', canPromoteTo: [] },
        'string': { bits: -1, signed: false, category: 'string', canPromoteTo: [] },
        'void': { bits: 0, signed: false, category: 'void', canPromoteTo: [] },
        // Legacy aliases for backward compatibility with transformers that may still use these
        'byte': { bits: 8, signed: false, category: 'integer', canPromoteTo: ['uint16', 'uint32', 'uint64', 'float32', 'float64'] },
        'word': { bits: 16, signed: false, category: 'integer', canPromoteTo: ['uint32', 'uint64', 'float32', 'float64'] },
        'dword': { bits: 32, signed: false, category: 'integer', canPromoteTo: ['uint64', 'float64'] },
        'qword': { bits: 64, signed: false, category: 'integer', canPromoteTo: ['float64'] },
        'int': { bits: 32, signed: true, category: 'integer', canPromoteTo: ['int64', 'float64'] }
      };
    }

    /**
     * Load type information from a JavaScript source file by parsing its JSDoc comments.
     * Populates opCodesTypes for static utility classes or frameworkTypes for class hierarchies.
     * @param {string} sourceCode - The JavaScript source code to parse
     * @param {string} targetType - 'opcodes' for static methods, 'framework' for classes
     */
    loadTypesFromSource(sourceCode, targetType = 'opcodes') {
      const jsDocParser = new JSDocParser();

      // Map JSDoc types to internal type representation
      const normalizeType = (jsDocType) => {
        if (!jsDocType) return null;
        // JSDocParser returns type as object {name, isArray, ...}, extract the name
        const typeName = typeof jsDocType === 'object' ? jsDocType.name : jsDocType;
        if (!typeName) return null;
        const typeMap = {
          'byte': 'uint8', 'word': 'uint16', 'dword': 'uint32', 'qword': 'uint64',
          'sbyte': 'int8', 'short': 'int16', 'int': 'int32', 'long': 'int64',
          'number': 'int32', 'boolean': 'boolean', 'bool': 'boolean',
          'byte[]': 'uint8[]', 'word[]': 'uint16[]', 'dword[]': 'uint32[]', 'qword[]': 'uint64[]',
          'uint8[]': 'uint8[]', 'string': 'string', 'void': 'void', 'object': 'object'
        };
        // Handle array types from JSDocParser
        const baseType = typeMap[typeName] || typeName;
        if (typeof jsDocType === 'object' && jsDocType.isArray) {
          return baseType.endsWith('[]') ? baseType : baseType + '[]';
        }
        return baseType;
      };

      // Find all JSDoc comments followed by function/method definitions
      const jsDocPattern = /\/\*\*[\s\S]*?\*\/\s*(?:(?:static\s+)?(\w+)\s*\(|(?:get|set)\s+(\w+)\s*\(|class\s+(\w+)(?:\s+extends\s+(\w+))?)/g;
      const commentBlockPattern = /\/\*\*([\s\S]*?)\*\//g;

      let match;
      let lastComment = null;
      let lastCommentEnd = 0;

      // Extract all comment blocks with their positions
      const comments = [];
      while ((match = commentBlockPattern.exec(sourceCode)) !== null) {
        comments.push({
          text: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Find declarations and match them with preceding comments
      // Patterns: method(params){, get/set name(){, class Name{, name: function(params){
      const declarationPattern = /(?:static\s+)?(\w+)\s*\([^)]*\)\s*\{|(?:get|set)\s+(\w+)\s*\([^)]*\)\s*\{|class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{|(\w+)\s*:\s*function\s*\([^)]*\)\s*\{/g;

      while ((match = declarationPattern.exec(sourceCode)) !== null) {
        const methodName = match[1] || match[5]; // match[5] is for "name: function(...)" pattern
        const accessorName = match[2];
        const className = match[3];
        const baseClass = match[4];
        const declStart = match.index;

        // Find the closest preceding comment
        const precedingComment = comments.filter(c => c.end <= declStart).pop();

        if (precedingComment && (declStart - precedingComment.end) < 50) {
          const parsed = jsDocParser.parseJSDoc('/**' + precedingComment.text + '*/');

          if (targetType === 'opcodes' && methodName) {
            // Extract method signature for OpCodes-style static methods
            const params = parsed.params.map(p => normalizeType(p.type));
            const returns = normalizeType(parsed.returns?.type);

            if (params.length > 0 || returns) {
              this.opCodesTypes[methodName] = {
                params,
                returns: returns || 'void',
                description: parsed.description || ''
              };
            }
          } else if (targetType === 'framework') {
            if (className) {
              // Initialize class in framework types
              if (!this.frameworkTypes[className]) {
                this.frameworkTypes[className] = {
                  properties: {},
                  methods: {}
                };
              }
              if (baseClass) {
                this.frameworkTypes[className].extends = baseClass;
              }
            }
          }
        }
      }

      // For framework types, also extract property types from @type annotations
      if (targetType === 'framework') {
        const propTypePattern = /\/\*\*\s*@type\s+\{([^}]+)\}\s*\*\/\s*(?:this\.)?(\w+)/g;
        while ((match = propTypePattern.exec(sourceCode)) !== null) {
          const propType = normalizeType(match[1]);
          const propName = match[2];

          // Find which class this property belongs to by looking for preceding class declaration
          const beforeProp = sourceCode.substring(0, match.index);
          const classMatch = beforeProp.match(/class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{[^}]*$/);
          if (classMatch) {
            const owningClass = classMatch[1];
            if (!this.frameworkTypes[owningClass]) {
              this.frameworkTypes[owningClass] = { properties: {}, methods: {} };
            }
            this.frameworkTypes[owningClass].properties[propName] = propType;
          }
        }

        // Extract method signatures with JSDoc from the source code
        // Use brace-counting approach to track class scope
        const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
        const classRanges = [];

        // Find all class declarations and compute their ranges using brace counting
        while ((match = classPattern.exec(sourceCode)) !== null) {
          const className = match[1];
          const baseClass = match[2] || null;
          const classStart = match.index;
          const braceStart = classStart + match[0].length - 1; // Position of opening brace

          // Count braces to find the end of the class
          let braceCount = 1;
          let pos = braceStart + 1;
          while (pos < sourceCode.length && braceCount > 0) {
            const char = sourceCode[pos];
            if (char === '{') ++braceCount;
            else if (char === '}') --braceCount;
            ++pos;
          }

          classRanges.push({
            name: className,
            extends: baseClass,
            start: braceStart,
            end: pos
          });

          // Ensure class is in frameworkTypes
          if (!this.frameworkTypes[className]) {
            this.frameworkTypes[className] = { properties: {}, methods: {} };
          }
          if (baseClass) {
            this.frameworkTypes[className].extends = baseClass;
          }
        }

        // Now find all methods with JSDoc by first extracting all JSDoc blocks
        // then checking if each is followed by a method definition
        const jsDocBlockPattern = /\/\*\*([^*]|\*(?!\/))*\*\//g;
        const jsDocBlocks = [];
        while ((match = jsDocBlockPattern.exec(sourceCode)) !== null) {
          jsDocBlocks.push({
            text: match[0],
            content: match[0].slice(3, -2), // Remove /** and */
            start: match.index,
            end: match.index + match[0].length
          });
        }

        // For each JSDoc block, check if it's followed by a method
        for (const block of jsDocBlocks) {
          // Get text immediately after this JSDoc block
          const afterBlock = sourceCode.substring(block.end, block.end + 200);
          // Check if it starts with whitespace then a method name and opening paren
          const methodMatch = afterBlock.match(/^\s*(\w+)\s*\([^)]*\)\s*\{/);

          if (methodMatch) {
            const methodName = methodMatch[1];
            // Skip if it's a class, function, or constructor keyword
            if (methodName === 'class' || methodName === 'function' || methodName === 'if' || methodName === 'while' || methodName === 'for') continue;

            const methodPos = block.start;

            // Find which class this method belongs to (innermost class containing this position)
            let owningClass = null;
            for (const range of classRanges) {
              if (methodPos > range.start && methodPos < range.end) {
                // This method is inside this class - check if it's the innermost
                if (!owningClass || range.start > classRanges.find(r => r.name === owningClass).start) {
                  owningClass = range.name;
                }
              }
            }

            if (owningClass) {
              const parsed = jsDocParser.parseJSDoc(block.text);

              if (parsed.params.length > 0 || parsed.returns) {
                this.frameworkTypes[owningClass].methods[methodName] = {
                  params: parsed.params.map(p => normalizeType(p.type)),
                  returns: normalizeType(parsed.returns?.type) || 'void'
                };
              }
            }
          }
        }
      }
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
        return 'uint32'; // Default for unknown types in crypto context
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
      const hierarchy = ['uint8', 'uint16', 'uint32', 'uint64', 'float32', 'float64'];
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
          return classInfo.properties[context.propertyName] || 'uint32';
        }
        if (context.methodName && classInfo.methods) {
          const methodInfo = classInfo.methods[context.methodName];
          return methodInfo ? methodInfo.returns : 'uint32';
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
      return 'uint32';
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
    // Shared type knowledge loaded from library files (OpCodes.js, AlgorithmFramework.js)
    static sharedTypeKnowledge = null;

    /**
     * Load type information from library source files.
     * Call this once before parsing algorithm files to populate shared type knowledge.
     * @param {Object} options - Options object with opCodesSource and/or frameworkSource
     * @param {string} options.opCodesSource - Source code of OpCodes.js
     * @param {string} options.frameworkSource - Source code of AlgorithmFramework.js
     */
    static loadTypeLibraries(options = {}) {
      if (!TypeAwareJSASTParser.sharedTypeKnowledge) {
        TypeAwareJSASTParser.sharedTypeKnowledge = new PreciseTypeKnowledge();
      }
      const tk = TypeAwareJSASTParser.sharedTypeKnowledge;

      if (options.opCodesSource) {
        tk.loadTypesFromSource(options.opCodesSource, 'opcodes');
        console.error(`📚 Loaded ${Object.keys(tk.opCodesTypes).length} OpCodes method signatures from JSDoc`);
      }
      if (options.frameworkSource) {
        tk.loadTypesFromSource(options.frameworkSource, 'framework');
        console.error(`📚 Loaded ${Object.keys(tk.frameworkTypes).length} framework class types from JSDoc`);
      }
    }

    constructor(code) {
      this.code = code;
      this.tokens = [];
      this.position = 0;
      this.currentToken = null;
      this.jsDocParser = new JSDocParser();
      // Use shared type knowledge if available, otherwise create new instance
      this.typeKnowledge = TypeAwareJSASTParser.sharedTypeKnowledge || new PreciseTypeKnowledge();
      this.typeAnnotations = new Map(); // Store type information for nodes
      this.lastJSDocComment = null; // Track the last JSDoc comment seen
      this.pendingComments = []; // Track all comments between tokens
      this.classHierarchy = new Map(); // Maps class names to their base classes
      this.classMembers = new Map(); // Maps class names to their member type signatures
      // Scope-based variable type tracking for type inference
      this.scopeStack = [new Map()]; // Stack of variable type maps, global scope at bottom
      this.constantTypes = new Map(); // Module-level constant types
      this.classFieldTypes = new Map(); // Maps "ClassName.fieldName" to type
      this.classMethodReturnTypes = new Map(); // Maps "ClassName.methodName" to return type
    }

    /**
     * Push a new scope onto the scope stack
     * Called when entering a function, class body, or block
     */
    pushScope() {
      this.scopeStack.push(new Map());
    }

    /**
     * Pop the current scope from the stack
     * Called when leaving a function, class body, or block
     */
    popScope() {
      if (this.scopeStack.length > 1)
        this.scopeStack.pop();
    }

    /**
     * Register a variable with its type in the current scope
     * @param {string} name - Variable name
     * @param {string} type - Type string (e.g., 'uint32', 'uint8[]', 'string')
     */
    registerVariableType(name, type) {
      if (!name || !type) return;
      const currentScope = this.scopeStack[this.scopeStack.length - 1];
      currentScope.set(name, type);
    }

    /**
     * Look up a variable's type from current scope up through parent scopes
     * @param {string} name - Variable name
     * @returns {string|null} Type string or null if not found
     */
    lookupVariableType(name) {
      // Check scopes from innermost to outermost
      for (let i = this.scopeStack.length - 1; i >= 0; --i) {
        const scope = this.scopeStack[i];
        if (scope.has(name))
          return scope.get(name);
      }
      // Check module-level constants
      if (this.constantTypes.has(name))
        return this.constantTypes.get(name);
      return null;
    }

    /**
     * Register a module-level constant with its type
     * @param {string} name - Constant name
     * @param {string} type - Type string
     */
    registerConstantType(name, type) {
      if (!name || !type) return;
      this.constantTypes.set(name, type);
    }

    /**
     * Register a class field with its type
     * @param {string} className - Class name
     * @param {string} fieldName - Field name
     * @param {string} type - Type string
     */
    registerClassFieldType(className, fieldName, type) {
      if (!className || !fieldName || !type) return;
      this.classFieldTypes.set(`${className}.${fieldName}`, type);
    }

    /**
     * Look up a class field's type
     * @param {string} className - Class name
     * @param {string} fieldName - Field name
     * @returns {string|null} Type string or null if not found
     */
    lookupClassFieldType(className, fieldName) {
      return this.classFieldTypes.get(`${className}.${fieldName}`) || null;
    }

    /**
     * Register a class method's return type
     * @param {string} className - Class name
     * @param {string} methodName - Method name
     * @param {string} returnType - Return type string
     */
    registerClassMethodReturnType(className, methodName, returnType) {
      if (!className || !methodName || !returnType) return;
      this.classMethodReturnTypes.set(`${className}.${methodName}`, returnType);
    }

    /**
     * Look up a class method's return type
     * @param {string} className - Class name
     * @param {string} methodName - Method name
     * @returns {string|null} Return type string or null if not found
     */
    lookupClassMethodReturnType(className, methodName) {
      return this.classMethodReturnTypes.get(`${className}.${methodName}`) || null;
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
        'return', 'this', 'new', 'static', 'get', 'set', 'async', 'await', 'super',
        'export', 'import', 'default', 'as', 'extends', 'constructor',
        'throw', 'typeof', 'undefined', 'null', 'true', 'false', 'break',
        'continue', 'try', 'catch', 'finally', 'switch', 'case', 'do', 'with',
        'in', 'of', 'instanceof', 'delete', 'void'
        // Note: 'from' is intentionally omitted - it's a contextual keyword in ES6 modules
        // but since we use UMD patterns, we allow 'from' as a regular identifier
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
        '==', '!=', '<=', '>=', '>>', '<<', '=>', '...', '?.',
        '**=', '**'  // Exponentiation operator (ES2016)
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
     * Parse tokens into AST and build IL AST
     * This is the main entry point that performs both phases:
     *   Phase 1: JS Parsing (parseProgram)
     *   Phase 2: IL Building (buildILAST)
     */
    parse() {
      if (this.tokens.length === 0) {
        this.tokenize();
      }
      this.position = 0;
      this.currentToken = this.tokens[0];

      // PHASE 1: Parse JavaScript into plain JS AST
      const jsAst = this.parseProgram();

      // PHASE 2: Build IL AST from JS AST
      const ilAst = this.buildILAST(jsAst);

      return ilAst;
    }

    /**
     * PHASE 2: Build IL AST from JS AST
     * Transforms plain JavaScript AST into Intermediate Language AST with:
     *   1. Module unwrapping - Extract content from IIFE/UMD wrappers
     *   2. Syntax flattening - Normalize prototype methods, constructor functions
     *   3. Type inference - Add typeAnnotation to all typed nodes
     *   4. Constant resolution - Evaluate IIFE-computed constants
     *
     * @param {Object} jsAst - Plain JavaScript AST from Phase 1
     * @returns {Object} IL AST with types and flattened structures
     */
    buildILAST(jsAst) {
      let ilAst = jsAst;

      // Step 1: Unwrap UMD/IIFE module patterns to extract inner factory function
      ilAst = this.unwrapModulePatterns(ilAst);

      // Step 2: Flatten prototype methods and constructor function assignments
      ilAst = this.flattenMethodDefinitions(ilAst);

      // Step 2.5: Hoist IIFE-computed variable initializers
      // Transforms: const X = (() => { const A = ...; return { A }; })()
      // Into: const A = ...; const X = { A };
      ilAst = this.hoistIIFEVariables(ilAst);

      // Step 2.6: Filter out JS-specific module loader functions
      // Removes functions that load dependencies via require/import
      ilAst = this.filterModuleLoaderFunctions(ilAst);

      // Step 3: Normalize JavaScript-specific patterns to IL AST nodes
      // This converts super(), this.x, OpCodes.X(), Math.X(), Array methods, etc.
      ilAst = this.normalizeJSPatterns(ilAst);

      // Step 4: Multi-pass type narrowing until convergence
      this.performTypeNarrowing(ilAst);

      // Mark as IL AST for downstream consumers
      ilAst.isILAST = true;

      return ilAst;
    }

    // ========================[ IL AST BUILDING - JS PATTERN NORMALIZATION ]========================

    /**
     * OpCodes operations that should be inlined to bitwise expressions
     * Maps OpCodes method names to their IL representation
     */
    static INLINE_OPCODES = {
      // XOR operations
      'XorN': { type: 'BinaryExpression', operator: '^' },
      'Xor8': { type: 'BinaryExpression', operator: '^', mask: 0xFF },
      'Xor16': { type: 'BinaryExpression', operator: '^', mask: 0xFFFF },
      'Xor32': { type: 'BinaryExpression', operator: '^', mask: 0xFFFFFFFF },

      // OR operations
      'OrN': { type: 'BinaryExpression', operator: '|' },
      'Or8': { type: 'BinaryExpression', operator: '|', mask: 0xFF },
      'Or16': { type: 'BinaryExpression', operator: '|', mask: 0xFFFF },
      'Or32': { type: 'BinaryExpression', operator: '|', mask: 0xFFFFFFFF },

      // AND operations
      'AndN': { type: 'BinaryExpression', operator: '&' },
      'And8': { type: 'BinaryExpression', operator: '&', mask: 0xFF },
      'And16': { type: 'BinaryExpression', operator: '&', mask: 0xFFFF },
      'And32': { type: 'BinaryExpression', operator: '&', mask: 0xFFFFFFFF },

      // NOT operations
      'NotN': { type: 'UnaryExpression', operator: '~' },
      'Not8': { type: 'UnaryExpression', operator: '~', mask: 0xFF },
      'Not16': { type: 'UnaryExpression', operator: '~', mask: 0xFFFF },
      'Not32': { type: 'UnaryExpression', operator: '~', mask: 0xFFFFFFFF },

      // Shift operations
      'Shl8': { type: 'BinaryExpression', operator: '<<', mask: 0xFF },
      'Shl16': { type: 'BinaryExpression', operator: '<<', mask: 0xFFFF },
      'Shl32': { type: 'BinaryExpression', operator: '<<', mask: 0xFFFFFFFF },
      'Shr8': { type: 'BinaryExpression', operator: '>>', mask: 0xFF },
      'Shr16': { type: 'BinaryExpression', operator: '>>', mask: 0xFFFF },
      'Shr32': { type: 'BinaryExpression', operator: '>>', mask: 0xFFFFFFFF },
      'UShr32': { type: 'BinaryExpression', operator: '>>>' },

      // N-suffix operations for BigInt (arbitrary precision) - no mask needed
      'ShiftLn': { type: 'BinaryExpression', operator: '<<' },
      'ShiftRn': { type: 'BinaryExpression', operator: '>>' },

      // Add/Sub with mask
      'Add32': { type: 'BinaryExpression', operator: '+', mask: 0xFFFFFFFF },
      'Sub32': { type: 'BinaryExpression', operator: '-', mask: 0xFFFFFFFF },
      'Mul32': { type: 'BinaryExpression', operator: '*', mask: 0xFFFFFFFF }
    };

    /**
     * OpCodes operations that become rotation IL nodes
     */
    static ROTATION_OPCODES = {
      'RotL8': { bits: 8, direction: 'left' },
      'RotR8': { bits: 8, direction: 'right' },
      'RotL16': { bits: 16, direction: 'left' },
      'RotR16': { bits: 16, direction: 'right' },
      'RotL32': { bits: 32, direction: 'left' },
      'RotR32': { bits: 32, direction: 'right' },
      'RotL64': { bits: 64, direction: 'left' },
      'RotR64': { bits: 64, direction: 'right' }
    };

    /**
     * OpCodes operations that become helper function calls (complex operations)
     */
    static COMPLEX_OPCODES = {
      'Pack16BE': { type: 'PackBytes', endian: 'big', bits: 16 },
      'Pack16LE': { type: 'PackBytes', endian: 'little', bits: 16 },
      'Pack32BE': { type: 'PackBytes', endian: 'big', bits: 32 },
      'Pack32LE': { type: 'PackBytes', endian: 'little', bits: 32 },
      'Pack64BE': { type: 'PackBytes', endian: 'big', bits: 64 },
      'Pack64LE': { type: 'PackBytes', endian: 'little', bits: 64 },
      'Unpack16BE': { type: 'UnpackBytes', endian: 'big', bits: 16 },
      'Unpack16LE': { type: 'UnpackBytes', endian: 'little', bits: 16 },
      'Unpack32BE': { type: 'UnpackBytes', endian: 'big', bits: 32 },
      'Unpack32LE': { type: 'UnpackBytes', endian: 'little', bits: 32 },
      'Unpack64BE': { type: 'UnpackBytes', endian: 'big', bits: 64 },
      'Unpack64LE': { type: 'UnpackBytes', endian: 'little', bits: 64 },
      'XorArrays': { type: 'ArrayXor' },
      'ClearArray': { type: 'ArrayClear' },
      'Hex8ToBytes': { type: 'HexDecode' },
      'BytesToHex8': { type: 'HexEncode' },
      'AnsiToBytes': { type: 'StringToBytes', encoding: 'ascii' },
      'Utf8ToBytes': { type: 'StringToBytes', encoding: 'utf8' },
      'BytesToAnsi': { type: 'BytesToString', encoding: 'ascii' },
      'BytesToUtf8': { type: 'BytesToString', encoding: 'utf8' },
      'ToUint32': { type: 'Cast', targetType: 'uint32' },
      'ToUint16': { type: 'Cast', targetType: 'uint16' },
      'ToUint8': { type: 'Cast', targetType: 'uint8' },
      'ToByte': { type: 'Cast', targetType: 'uint8' },
      'ToInt32': { type: 'Cast', targetType: 'int32' },
      'ToInt16': { type: 'Cast', targetType: 'int16' },
      'ToInt8': { type: 'Cast', targetType: 'int8' },
      'ToDWord': { type: 'Cast', targetType: 'uint32' },
      'ToQWord': { type: 'Cast', targetType: 'uint64' },
      'ToWord': { type: 'Cast', targetType: 'uint16' },
      'ToInt': { type: 'Cast', targetType: 'int' },
      'ToFloat': { type: 'Cast', targetType: 'float' },
      'ToDouble': { type: 'Cast', targetType: 'double' },
      'ToBool': { type: 'Cast', targetType: 'boolean' },
      'ToString': { type: 'Cast', targetType: 'string' },
      'ConcatArrays': { type: 'OpCodesCall', name: 'ConcatArrays' },
      'CopyArray': { type: 'OpCodesCall', name: 'CopyArray' },
      'CompareArrays': { type: 'OpCodesCall', name: 'CompareArrays' },
      'ConstantTimeCompare': { type: 'OpCodesCall', name: 'ConstantTimeCompare' },
      'SecureCompare': { type: 'OpCodesCall', name: 'SecureCompare' },
      'DoubleToBytes': { type: 'OpCodesCall', name: 'DoubleToBytes' },
      'GetBit': { type: 'OpCodesCall', name: 'GetBit' },
      'GetBitN': { type: 'OpCodesCall', name: 'GetBitN' },
      'SetBit': { type: 'OpCodesCall', name: 'SetBit' },
      'GetByte': { type: 'OpCodesCall', name: 'GetByte' },
      'BitMask': { type: 'OpCodesCall', name: 'BitMask' },
      'PopCountFast': { type: 'OpCodesCall', name: 'PopCountFast' },
      'BitCountN': { type: 'OpCodesCall', name: 'BitCountN' },
      'GF256Mul': { type: 'OpCodesCall', name: 'GF256Mul' }
    };

    /**
     * TypedArray element type mappings for IL nodes
     * Maps JavaScript TypedArray names to precise IL element types
     */
    static TYPED_ARRAY_ELEMENT_TYPES = {
      'Uint8Array': 'uint8',
      'Int8Array': 'int8',
      'Uint8ClampedArray': 'uint8',
      'Uint16Array': 'uint16',
      'Int16Array': 'int16',
      'Uint32Array': 'uint32',
      'Int32Array': 'int32',
      'Float32Array': 'float32',
      'Float64Array': 'float64',
      'BigUint64Array': 'uint64',
      'BigInt64Array': 'int64'
    };

    /**
     * Operation result types for IL nodes
     * Provides precise types for various operations
     */
    static OPERATION_RESULT_TYPES = {
      // Rotation operations return same bit-width unsigned
      'RotateLeft': bits => `uint${bits}`,
      'RotateRight': bits => `uint${bits}`,
      // Pack operations return unsigned int of target size
      'PackBytes': bits => `uint${bits}`,
      // Unpack operations return byte array
      'UnpackBytes': () => 'uint8[]',
      // XOR operations on arrays return byte array
      'ArrayXor': () => 'uint8[]',
      // Hex decode returns byte array
      'HexDecode': () => 'uint8[]',
      // Hex encode returns string
      'HexEncode': () => 'string',
      // String to bytes returns byte array
      'StringToBytes': () => 'uint8[]',
      // Bytes to string returns string
      'BytesToString': () => 'string',
      // Math operations
      'Floor': () => 'int32',
      'Ceil': () => 'int32',
      'Round': () => 'int32',
      'Truncate': () => 'int32',
      'Abs': (_bits, operandType) => operandType || 'float64',
      'Min': (_bits, operandType) => operandType || 'float64',
      'Max': (_bits, operandType) => operandType || 'float64',
      'Sqrt': () => 'float64',
      'Power': () => 'float64',
      'Log': () => 'float64',
      'Log2': () => 'float64',
      'Log10': () => 'float64',
      'Random': () => 'float64',
      'CountLeadingZeros': () => 'int32',
      // Cast operation
      'Cast': bits => `uint${bits || 32}`,
      // Math constants and number constants
      'MathConstant': () => 'float64',
      'NumberConstant': () => 'float64',
      // Instance check
      'InstanceOfCheck': () => 'boolean',
      // Trigonometric and transcendental functions
      'Sin': () => 'float64',
      'Cos': () => 'float64',
      'Tan': () => 'float64',
      'Asin': () => 'float64',
      'Acos': () => 'float64',
      'Atan': () => 'float64',
      'Atan2': () => 'float64',
      'Sinh': () => 'float64',
      'Cosh': () => 'float64',
      'Tanh': () => 'float64',
      'Exp': () => 'float64',
      'Cbrt': () => 'float64',
      'Hypot': () => 'float64',
      'Sign': () => 'int32',
      'Fround': () => 'float32',
      // Array operations
      'ArrayLength': () => 'int32',
      'ArraySlice': elementType => elementType ? `${elementType}[]` : 'uint8[]',
      'ArrayConcat': elementType => elementType ? `${elementType}[]` : 'uint8[]',
      'ArrayPop': elementType => elementType || 'uint8',
      'ArrayShift': elementType => elementType || 'uint8',
      'ArrayIndexOf': () => 'int32',
      'ArrayFindIndex': () => 'int32',
      'ArrayIncludes': () => 'boolean',
      'ArrayEvery': () => 'boolean',
      'ArraySome': () => 'boolean'
    };

    /**
     * IL AST Building Step 3: Normalize JavaScript-specific patterns
     *
     * Converts JavaScript patterns to language-agnostic IL nodes:
     *   - super() calls → ParentConstructorCall
     *   - this.property → ThisPropertyAccess
     *   - this.method() → ThisMethodCall
     *   - OpCodes.XorN() → Inline bitwise expressions
     *   - OpCodes.RotL32() → RotateLeft/RotateRight nodes
     *   - OpCodes.Pack32BE() → PackBytes nodes
     *   - Math.floor() → Floor node
     *   - new Array() → ArrayCreation
     *   - arr.push() → ArrayAppend
     *   - arr.length → ArrayLength
     *   - For-loop multi-declarations → split or normalized
     *   - Destructuring → sequential assignments
     *
     * @param {Object} ast - AST from previous transformation steps
     * @returns {Object} Normalized IL AST
     */
    normalizeJSPatterns(ast) {
      if (!ast) return ast;
      // Reset scope stack for new normalization pass
      this.scopeStack = [new Map()];
      this.constantTypes = new Map();
      this.classFieldTypes = new Map();
      return this._normalizeNode(ast, { inClass: false, className: null, isModuleLevel: true });
    }

    /**
     * Recursively normalize a node and its children
     * @private
     */
    _normalizeNode(node, context) {
      if (!node || typeof node !== 'object') return node;
      if (Array.isArray(node)) {
        return node.map(child => this._normalizeNode(child, context)).filter(n => n !== null);
      }

      // Update context for class declarations
      let newContext = context;
      let pushNewScope = false;

      if (node.type === 'ClassDeclaration' && node.id) {
        newContext = { ...context, inClass: true, className: node.id.name, superClass: node.superClass, isModuleLevel: false };
        pushNewScope = true;
      } else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' ||
                 node.type === 'ArrowFunctionExpression' || node.type === 'MethodDefinition') {
        newContext = { ...context, isModuleLevel: false };
        pushNewScope = true;
      } else if (node.type === 'BlockStatement') {
        // Block statements don't change isModuleLevel but create a scope
        pushNewScope = true;
      }

      // Push scope if entering a new scope
      if (pushNewScope)
        this.pushScope();

      // Register function parameters in the new scope
      if (node.params && (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' ||
                          node.type === 'ArrowFunctionExpression')) {
        this._registerFunctionParameters(node, newContext);
      }

      // Register method return types from JSDoc annotations
      if (node.type === 'MethodDefinition' && context?.className && node.key?.name) {
        const returnType = node.value?.typeInfo?.returns || node.value?.jsDoc?.returns?.type;
        if (returnType)
          this.registerClassMethodReturnType(context.className, node.key.name, returnType);

        // Also register parameters for methods
        if (node.value)
          this._registerFunctionParameters(node.value, newContext);
      }

      // First, normalize children
      const normalized = {};
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'range' || key === 'parent') {
          normalized[key] = node[key];
        } else if (Array.isArray(node[key])) {
          normalized[key] = node[key].map(child => this._normalizeNode(child, newContext)).filter(n => n !== null);
        } else if (node[key] && typeof node[key] === 'object') {
          normalized[key] = this._normalizeNode(node[key], newContext);
        } else {
          normalized[key] = node[key];
        }
      }

      // Now transform the normalized node
      const result = this._transformNode(normalized, newContext);

      // Pop scope if we pushed one
      if (pushNewScope)
        this.popScope();

      return result;
    }

    /**
     * Register function parameter types in scope from JSDoc annotations
     * @private
     */
    _registerFunctionParameters(node, context) {
      for (const param of (node.params || [])) {
        if (param.type === 'Identifier' && param.name) {
          // Get type from JSDoc type annotations only - no name-based fallback
          let paramType = null;

          // Check typeInfo on the function node (from JSDoc parsing)
          if (node.typeInfo?.params?.has(param.name))
            paramType = node.typeInfo.params.get(param.name);

          // Also check the value's typeInfo (for MethodDefinition where typeInfo is on node.value)
          if (!paramType && node.value?.typeInfo?.params?.has(param.name))
            paramType = node.value.typeInfo.params.get(param.name);

          // Check typeAnnotations map as fallback
          if (!paramType && this.typeAnnotations.has(param)) {
            const annotation = this.typeAnnotations.get(param);
            paramType = annotation?.type;
          }

          if (paramType)
            this.registerVariableType(param.name, paramType);
        }
      }
    }

    /**
     * Transform a single node to its IL representation
     * @private
     */
    _transformNode(node, context) {
      switch (node.type) {
        case 'CallExpression':
          return this._transformCallExpression(node, context);

        case 'MemberExpression':
          return this._transformMemberExpression(node, context);

        case 'NewExpression':
          return this._transformNewExpression(node, context);

        case 'VariableDeclaration':
          return this._transformVariableDeclaration(node, context);

        case 'ForStatement':
          return this._transformForStatement(node, context);

        case 'Literal':
          return this._transformLiteral(node, context);

        case 'ArrayExpression':
          return this._transformArrayExpression(node, context);

        case 'BinaryExpression':
          return this._transformBinaryExpression(node, context);

        case 'UnaryExpression':
          return this._transformUnaryExpression(node, context);

        case 'Identifier':
          return this._transformIdentifier(node, context);

        case 'AssignmentExpression':
          return this._transformAssignmentExpression(node, context);

        case 'UpdateExpression':
          return this._transformUpdateExpression(node, context);

        case 'ConditionalExpression':
          return this._transformConditionalExpression(node, context);

        case 'LogicalExpression':
          return this._transformLogicalExpression(node, context);

        case 'ThisExpression':
          return { ...node, ilNodeType: 'ThisExpression' };

        case 'TemplateLiteral':
          return this._transformTemplateLiteral(node, context);

        case 'SpreadElement':
          return this._transformSpreadElement(node, context);

        case 'RestElement':
          return this._transformRestElement(node, context);

        case 'ObjectExpression':
          return this._transformObjectExpression(node, context);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this._transformFunctionExpression(node, context);

        case 'SequenceExpression':
          return this._transformSequenceExpression(node, context);

        case 'AwaitExpression':
          return this._transformAwaitExpression(node, context);

        case 'YieldExpression':
          return this._transformYieldExpression(node, context);

        default:
          return node;
      }
    }

    /**
     * Transform Identifier nodes to add resultType from variable lookup
     * @private
     */
    _transformIdentifier(node, context) {
      const name = node.name;
      if (!name) return node;

      let resultType;

      // Handle special global values first
      if (name === 'Infinity' || name === 'NaN') {
        resultType = 'float64';
      } else if (name === 'undefined') {
        resultType = 'void';
      } else {
        // Look up variable type from scope - no name-based fallback
        resultType = this.lookupVariableType(name);
      }

      return {
        ...node,
        resultType,
        ilNodeType: 'Identifier'
      };
    }

    /**
     * Transform AssignmentExpression to propagate types
     * @private
     */
    _transformAssignmentExpression(node, context) {
      const left = this._transformNode(node.left, context);
      const right = this._transformNode(node.right, context);

      // Get type based on operator
      let resultType;
      const op = node.operator;
      if (op === '=') {
        resultType = right?.resultType;
      } else {
        // Compound assignment: derive type from the implicit binary operator
        const leftType = typeof left?.resultType === 'string' ? left.resultType : '';
        const rightType = typeof right?.resultType === 'string' ? right.resultType : '';
        if (['|=', '&=', '^=', '<<=', '>>='].includes(op)) {
          // Bitwise compound: result is left operand type or int32
          resultType = (leftType && leftType !== 'any' && leftType !== 'number') ? leftType : 'int32';
        } else if (op === '>>>=') {
          // Unsigned right shift always produces uint32
          resultType = 'uint32';
        } else if (['+=', '-=', '*=', '%='].includes(op)) {
          if (op === '+=' && (leftType === 'string' || rightType === 'string'))
            resultType = 'string';
          else if (leftType.includes('float') || rightType.includes('float'))
            resultType = 'float64';
          else if (leftType.includes('64') || rightType.includes('64'))
            resultType = leftType.includes('int') || rightType.includes('int') ? 'int64' : 'uint64';
          else if (leftType && leftType !== 'any' && leftType !== 'number')
            resultType = leftType;
          else if (rightType && rightType !== 'any' && rightType !== 'number')
            resultType = rightType;
          else
            resultType = 'int32';
        } else if (op === '/=') {
          resultType = 'float64';
        } else if (op === '**=') {
          resultType = 'float64';
        } else {
          resultType = right?.resultType;
        }
      }

      // Register variable type if assigning to identifier
      if (node.left?.type === 'Identifier' && node.left.name && resultType)
        this.registerVariableType(node.left.name, resultType);

      // Register class field type if assigning to this.field
      if (node.left?.type === 'MemberExpression' &&
          node.left.object?.type === 'ThisExpression' &&
          context?.className && resultType) {
        const fieldName = node.left.property?.name || node.left.property?.value;
        if (fieldName)
          this.registerClassFieldType(context.className, fieldName, resultType);
      }

      return {
        ...node,
        left,
        right,
        resultType,
        ilNodeType: 'AssignmentExpression'
      };
    }

    /**
     * Transform UpdateExpression (++x, x++, --x, x--)
     * @private
     */
    _transformUpdateExpression(node, context) {
      const argument = this._transformNode(node.argument, context);
      // Update expressions return the same type as the argument (typically numeric)
      const resultType = argument?.resultType || 'uint32';

      return {
        ...node,
        argument,
        resultType,
        ilNodeType: 'UpdateExpression'
      };
    }

    /**
     * Transform ConditionalExpression (ternary operator: a ? b : c)
     * Propagates type from consequent and alternate branches
     * @private
     */
    _transformConditionalExpression(node, context) {
      const test = this._transformNode(node.test, context);
      const consequent = this._transformNode(node.consequent, context);
      const alternate = this._transformNode(node.alternate, context);

      // Determine result type - prefer consequent type, fall back to alternate
      // If both have types and they differ, use a common base type
      let resultType = consequent?.resultType || alternate?.resultType;

      // If both branches have different types, try to find common type
      if (consequent?.resultType && alternate?.resultType &&
          consequent.resultType !== alternate.resultType) {
        resultType = this._getCommonType(consequent.resultType, alternate.resultType);
      }

      return {
        ...node,
        test,
        consequent,
        alternate,
        resultType,
        ilNodeType: 'ConditionalExpression'
      };
    }

    /**
     * Transform LogicalExpression (&& and || operators)
     * @private
     */
    _transformLogicalExpression(node, context) {
      const left = this._transformNode(node.left, context);
      const right = this._transformNode(node.right, context);

      // JavaScript's || and && operators return actual values, not booleans:
      // - a || b returns a if a is truthy, else b
      // - a && b returns a if a is falsy, else b
      // For null-coalescing patterns like `configs[x] || configs["default"]`, the result
      // is the same type as the operands, not boolean.

      // Logical expressions (&&, ||) always return boolean in strongly-typed languages
      // Even though JavaScript uses short-circuit evaluation that returns operand values,
      // for type-safe transpilation targets, these are boolean expressions
      const resultType = 'boolean';

      return {
        ...node,
        left,
        right,
        resultType,
        ilNodeType: 'LogicalExpression'
      };
    }

    /**
     * Transform CallExpression nodes
     * Handles: super(), this.method(), OpCodes.X(), Math.X(), array methods
     * @private
     */
    _transformCallExpression(node, context) {
      const callee = node.callee;

      // super() → ParentConstructorCall
      if (callee && callee.type === 'Super') {
        return {
          type: 'ParentConstructorCall',
          arguments: node.arguments || [],
          parentClass: context.superClass ? (context.superClass.name || context.superClass.property?.name) : null,
          ilNodeType: 'ParentConstructorCall'
        };
      }

      // super.method() → ParentMethodCall
      if (callee && callee.type === 'MemberExpression' && callee.object?.type === 'Super') {
        return {
          type: 'ParentMethodCall',
          method: callee.property?.name || callee.property?.value,
          arguments: node.arguments || [],
          parentClass: context.superClass ? (context.superClass.name || context.superClass.property?.name) : null,
          ilNodeType: 'ParentMethodCall'
        };
      }

      // this.method() → ThisMethodCall
      if (callee && callee.type === 'MemberExpression' && callee.object?.type === 'ThisExpression') {
        const methodName = callee.property?.name || callee.property?.value;
        const resultType = context?.className ?
          this.lookupClassMethodReturnType(context.className, methodName) : null;
        return {
          type: 'ThisMethodCall',
          method: methodName,
          arguments: node.arguments || [],
          resultType,
          ilNodeType: 'ThisMethodCall'
        };
      }

      // Handle already-normalized ThisPropertyAccess callee → ThisMethodCall
      // This happens when children are normalized before the CallExpression is processed
      if (callee && callee.type === 'ThisPropertyAccess') {
        const methodName = callee.property;
        const resultType = context?.className ?
          this.lookupClassMethodReturnType(context.className, methodName) : null;
        return {
          type: 'ThisMethodCall',
          method: methodName,
          arguments: node.arguments || [],
          resultType,
          ilNodeType: 'ThisMethodCall'
        };
      }

      // OpCodes.X() or global.OpCodes.X() → inline or IL node
      const isOpCodesCall = callee && callee.type === 'MemberExpression' && (
        callee.object?.name === 'OpCodes' ||
        (callee.object?.type === 'MemberExpression' && callee.object.property?.name === 'OpCodes')
      );
      if (isOpCodesCall) {
        const methodName = callee.property?.name || callee.property?.value;
        return this._transformOpCodesCall(methodName, node.arguments || [], context);
      }

      // Math.X() → IL node
      if (callee && callee.type === 'MemberExpression' && callee.object?.name === 'Math') {
        const methodName = callee.property?.name || callee.property?.value;
        return this._transformMathCall(methodName, node.arguments || [], context);
      }

      // Array methods: arr.push(), arr.fill(), arr.slice()
      if (callee && callee.type === 'MemberExpression') {
        const methodName = callee.property?.name || callee.property?.value;
        const arrayMethodResult = this._transformArrayMethod(callee.object, methodName, node.arguments || [], context);
        if (arrayMethodResult) return arrayMethodResult;

        // String methods: s.split(), s.charCodeAt(), etc.
        const stringMethodResult = this._transformStringMethod(callee.object, methodName, node.arguments || [], context);
        if (stringMethodResult) return stringMethodResult;

        // DataView methods: view.getUint8(), view.setUint32(), etc.
        const dataViewMethodResult = this._transformDataViewMethod(callee.object, methodName, node.arguments || [], context);
        if (dataViewMethodResult) return dataViewMethodResult;
      }

      // BigInt() constructor - convert to the argument value directly
      // BigInt('0x...') or BigInt(123) → just the numeric value
      if (callee && callee.type === 'Identifier' && callee.name === 'BigInt') {
        const arg = node.arguments?.[0];
        if (arg) {
          // If argument is a string literal, parse it as BigInt
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            let str = arg.value;
            if (str.endsWith('n')) str = str.slice(0, -1);
            try {
              return { type: 'Literal', value: BigInt(str), resultType: 'bigint', ilNodeType: 'BigIntLiteral' };
            } catch (e) { /* fall through */ }
          }
          // If argument is a number, convert to BigInt
          if (arg.type === 'Literal' && typeof arg.value === 'number') {
            return { type: 'Literal', value: BigInt(arg.value), resultType: 'bigint', ilNodeType: 'BigIntLiteral' };
          }
          // If argument is already a BigInt literal, return it
          if (arg.type === 'Literal' && typeof arg.value === 'bigint') {
            return { ...arg, resultType: 'bigint' };
          }
          // For other expressions, wrap in a cast-like construct
          return { type: 'BigIntCast', argument: arg, resultType: 'bigint', ilNodeType: 'BigIntCast' };
        }
      }

      // Handle static method calls: Array.X(), Object.X(), String.X(), Number.X(), console.X()
      if (callee && callee.type === 'MemberExpression' && callee.object?.type === 'Identifier') {
        const objectName = callee.object.name;
        const methodName = callee.property?.name || callee.property?.value;
        const args = (node.arguments || []).map(arg => this._transformNode(arg, context));

        // Array static methods
        if (objectName === 'Array') {
          const staticArrayResult = this._transformArrayStaticMethod(methodName, args, context);
          if (staticArrayResult) return staticArrayResult;
        }

        // Object static methods
        if (objectName === 'Object') {
          const staticObjectResult = this._transformObjectStaticMethod(methodName, args, context);
          if (staticObjectResult) return staticObjectResult;
        }

        // String static methods
        if (objectName === 'String') {
          const staticStringResult = this._transformStringStaticMethod(methodName, args, context);
          if (staticStringResult) return staticStringResult;
        }

        // Number static methods
        if (objectName === 'Number') {
          const staticNumberResult = this._transformNumberStaticMethod(methodName, args, context);
          if (staticNumberResult) return staticNumberResult;
        }

        // console methods - transform to DebugOutput IL node (can be easily stripped or handled by transformers)
        if (objectName === 'console') {
          return {
            type: 'DebugOutput',
            method: methodName, // 'log', 'warn', 'error', 'info', etc.
            arguments: args,
            resultType: 'void',
            ilNodeType: 'DebugOutput'
          };
        }

        // JSON static methods
        if (objectName === 'JSON') {
          if (methodName === 'stringify') {
            return {
              type: 'JsonSerialize',
              value: args[0],
              replacer: args[1] || null,
              space: args[2] || null,
              resultType: 'string',
              ilNodeType: 'JsonSerialize'
            };
          }
          if (methodName === 'parse') {
            return {
              type: 'JsonDeserialize',
              text: args[0],
              reviver: args[1] || null,
              resultType: 'object',
              ilNodeType: 'JsonDeserialize'
            };
          }
        }
      }

      return node;
    }

    /**
     * Transform OpCodes method calls
     * @private
     */
    _transformOpCodesCall(methodName, rawArgs, context) {
      // Transform all arguments first to ensure type information propagates
      const args = rawArgs.map(arg => this._transformNode(arg, context));

      // Helper to determine result type from mask
      const getTypeFromMask = (mask) => {
        if (mask === 0xFF) return 'uint8';
        if (mask === 0xFFFF) return 'uint16';
        if (mask === 0xFFFFFFFF) return 'uint32';
        return 'int32';
      };

      // Check for inline operations (simple bitwise)
      const inlineOp = TypeAwareJSASTParser.INLINE_OPCODES[methodName];
      if (inlineOp) {
        const resultType = inlineOp.mask ? getTypeFromMask(inlineOp.mask) : (args[0]?.resultType || 'int32');

        if (inlineOp.type === 'UnaryExpression') {
          const result = {
            type: 'UnaryExpression',
            operator: inlineOp.operator,
            prefix: true,
            argument: args[0],
            resultType,
            ilNodeType: 'InlinedOpCode'
          };
          if (inlineOp.mask) {
            return {
              type: 'BinaryExpression',
              operator: '&',
              left: result,
              right: { type: 'Literal', value: inlineOp.mask, resultType },
              resultType,
              ilNodeType: 'InlinedOpCode'
            };
          }
          return result;
        }

        if (args.length >= 2) {
          const result = {
            type: 'BinaryExpression',
            operator: inlineOp.operator,
            left: args[0],
            right: args[1],
            resultType,
            ilNodeType: 'InlinedOpCode'
          };
          if (inlineOp.mask) {
            return {
              type: 'BinaryExpression',
              operator: '&',
              left: result,
              right: { type: 'Literal', value: inlineOp.mask, resultType },
              resultType,
              ilNodeType: 'InlinedOpCode'
            };
          }
          return result;
        }
      }

      // Check for rotation operations
      const rotOp = TypeAwareJSASTParser.ROTATION_OPCODES[methodName];
      if (rotOp && args.length >= 2) {
        const nodeType = rotOp.direction === 'left' ? 'RotateLeft' : 'RotateRight';
        const resultTypeFn = TypeAwareJSASTParser.OPERATION_RESULT_TYPES[nodeType];
        const resultType = resultTypeFn ? resultTypeFn(rotOp.bits) : `uint${rotOp.bits}`;
        return {
          type: nodeType,
          bits: rotOp.bits,
          value: args[0],
          amount: args[1],
          resultType,
          ilNodeType: nodeType
        };
      }

      // Check for complex operations (helper functions)
      const complexOp = TypeAwareJSASTParser.COMPLEX_OPCODES[methodName];
      if (complexOp) {
        const resultTypeFn = TypeAwareJSASTParser.OPERATION_RESULT_TYPES[complexOp.type];
        const resultType = resultTypeFn ? resultTypeFn(complexOp.bits, args[0]?.resultType) : `uint${complexOp.bits || 32}`;
        const ilNode = {
          type: complexOp.type,
          arguments: args,
          resultType,
          ilNodeType: complexOp.type
        };
        // Copy additional properties from the operation definition
        for (const key of Object.keys(complexOp)) {
          if (key !== 'type') {
            ilNode[key] = complexOp[key];
          }
        }
        return ilNode;
      }

      // Unknown OpCodes method - keep as-is but mark it
      return {
        type: 'OpCodesCall',
        method: methodName,
        arguments: args,
        resultType: args[0]?.resultType || 'int32',
        ilNodeType: 'OpCodesCall'
      };
    }

    /**
     * Transform Math method calls
     * @private
     */
    _transformMathCall(methodName, args, context) {
      // Helper to get result type for math operations
      const getResultType = (nodeType, operandType) => {
        const resultTypeFn = TypeAwareJSASTParser.OPERATION_RESULT_TYPES[nodeType];
        return resultTypeFn ? resultTypeFn(undefined, operandType) : 'float64';
      };

      // Helper to get the wider type from multiple arguments
      const getWiderType = (argList) => {
        if (!argList || argList.length === 0) return undefined;
        let result = argList[0]?.resultType;
        for (let i = 1; i < argList.length; ++i) {
          const t = argList[i]?.resultType;
          if (t) result = this._getCommonType(result || t, t);
        }
        return result;
      };

      switch (methodName) {
        case 'floor':
          return { type: 'Floor', argument: args[0], resultType: getResultType('Floor'), ilNodeType: 'Floor' };
        case 'ceil':
          return { type: 'Ceil', argument: args[0], resultType: getResultType('Ceil'), ilNodeType: 'Ceil' };
        case 'round':
          return { type: 'Round', argument: args[0], resultType: getResultType('Round'), ilNodeType: 'Round' };
        case 'abs':
          return { type: 'Abs', argument: args[0], resultType: getResultType('Abs', args[0]?.resultType), ilNodeType: 'Abs' };
        case 'min':
          return { type: 'Min', arguments: args, resultType: getResultType('Min', getWiderType(args)), ilNodeType: 'Min' };
        case 'max':
          return { type: 'Max', arguments: args, resultType: getResultType('Max', getWiderType(args)), ilNodeType: 'Max' };
        case 'pow':
          return { type: 'Power', base: args[0], exponent: args[1], resultType: getResultType('Power'), ilNodeType: 'Power' };
        case 'sqrt':
          return { type: 'Sqrt', argument: args[0], resultType: getResultType('Sqrt'), ilNodeType: 'Sqrt' };
        case 'random':
          return { type: 'Random', resultType: getResultType('Random'), ilNodeType: 'Random' };
        case 'trunc':
          return { type: 'Truncate', argument: args[0], resultType: getResultType('Truncate'), ilNodeType: 'Truncate' };
        case 'log':
          return { type: 'Log', argument: args[0], resultType: getResultType('Log'), ilNodeType: 'Log' };
        case 'log2':
          return { type: 'Log2', argument: args[0], resultType: getResultType('Log2'), ilNodeType: 'Log2' };
        case 'log10':
          return { type: 'Log10', argument: args[0], resultType: getResultType('Log10'), ilNodeType: 'Log10' };
        case 'clz32':
          return { type: 'CountLeadingZeros', argument: args[0], bits: 32, resultType: getResultType('CountLeadingZeros'), ilNodeType: 'CountLeadingZeros' };
        case 'sin':
          return { type: 'Sin', argument: args[0], resultType: 'float64', ilNodeType: 'Sin' };
        case 'cos':
          return { type: 'Cos', argument: args[0], resultType: 'float64', ilNodeType: 'Cos' };
        case 'tan':
          return { type: 'Tan', argument: args[0], resultType: 'float64', ilNodeType: 'Tan' };
        case 'asin':
          return { type: 'Asin', argument: args[0], resultType: 'float64', ilNodeType: 'Asin' };
        case 'acos':
          return { type: 'Acos', argument: args[0], resultType: 'float64', ilNodeType: 'Acos' };
        case 'atan':
          return { type: 'Atan', argument: args[0], resultType: 'float64', ilNodeType: 'Atan' };
        case 'atan2':
          return { type: 'Atan2', y: args[0], x: args[1], resultType: 'float64', ilNodeType: 'Atan2' };
        case 'sinh':
          return { type: 'Sinh', argument: args[0], resultType: 'float64', ilNodeType: 'Sinh' };
        case 'cosh':
          return { type: 'Cosh', argument: args[0], resultType: 'float64', ilNodeType: 'Cosh' };
        case 'tanh':
          return { type: 'Tanh', argument: args[0], resultType: 'float64', ilNodeType: 'Tanh' };
        case 'exp':
          return { type: 'Exp', argument: args[0], resultType: 'float64', ilNodeType: 'Exp' };
        case 'cbrt':
          return { type: 'Cbrt', argument: args[0], resultType: 'float64', ilNodeType: 'Cbrt' };
        case 'hypot':
          return { type: 'Hypot', arguments: args, resultType: 'float64', ilNodeType: 'Hypot' };
        case 'sign':
          return { type: 'Sign', argument: args[0], resultType: 'int32', ilNodeType: 'Sign' };
        case 'fround':
          return { type: 'Fround', argument: args[0], resultType: 'float32', ilNodeType: 'Fround' };
        default:
          // Keep as MathCall for other methods
          return { type: 'MathCall', method: methodName, arguments: args, resultType: 'float64', ilNodeType: 'MathCall' };
      }
    }

    /**
     * Transform Array static method calls (Array.from, Array.isArray, Array.of)
     * @private
     */
    _transformArrayStaticMethod(methodName, args, context) {
      switch (methodName) {
        case 'from':
          // Array.from(iterable, mapFn?, thisArg?) → creates array from iterable
          return {
            type: 'ArrayFrom',
            iterable: args[0],
            mapFunction: args[1] || null,
            thisArg: args[2] || null,
            resultType: 'any[]',
            ilNodeType: 'ArrayFrom'
          };
        case 'isArray':
          // Array.isArray(value) → type check
          return {
            type: 'IsArrayCheck',
            value: args[0],
            resultType: 'boolean',
            ilNodeType: 'IsArrayCheck'
          };
        case 'of':
          // Array.of(...elements) → creates array from arguments
          return {
            type: 'ArrayOf',
            elements: args,
            resultType: 'any[]',
            ilNodeType: 'ArrayOf'
          };
        default:
          return null;
      }
    }

    /**
     * Transform Object static method calls (Object.keys, Object.values, Object.entries, etc.)
     * @private
     */
    _transformObjectStaticMethod(methodName, args, context) {
      switch (methodName) {
        case 'keys':
          return {
            type: 'ObjectKeys',
            object: args[0],
            resultType: 'string[]',
            ilNodeType: 'ObjectKeys'
          };
        case 'values':
          return {
            type: 'ObjectValues',
            object: args[0],
            resultType: 'any[]',
            ilNodeType: 'ObjectValues'
          };
        case 'entries':
          return {
            type: 'ObjectEntries',
            object: args[0],
            resultType: 'any[][]',
            ilNodeType: 'ObjectEntries'
          };
        case 'assign':
          // Object.assign(target, ...sources) → merges objects
          return {
            type: 'ObjectMerge',
            target: args[0],
            sources: args.slice(1),
            resultType: 'object',
            ilNodeType: 'ObjectMerge'
          };
        case 'freeze':
          // Object.freeze(obj) → returns frozen object (semantically same object)
          return {
            type: 'ObjectFreeze',
            object: args[0],
            resultType: args[0]?.resultType || 'object',
            ilNodeType: 'ObjectFreeze'
          };
        case 'seal':
          return {
            type: 'ObjectSeal',
            object: args[0],
            resultType: args[0]?.resultType || 'object',
            ilNodeType: 'ObjectSeal'
          };
        case 'create':
          return {
            type: 'ObjectCreate',
            prototype: args[0],
            properties: args[1] || null,
            resultType: 'object',
            ilNodeType: 'ObjectCreate'
          };
        case 'hasOwn':
        case 'hasOwnProperty':
          return {
            type: 'ObjectHasProperty',
            object: args[0],
            property: args[1],
            resultType: 'boolean',
            ilNodeType: 'ObjectHasProperty'
          };
        case 'getOwnPropertyNames':
          return {
            type: 'ObjectPropertyNames',
            object: args[0],
            resultType: 'string[]',
            ilNodeType: 'ObjectPropertyNames'
          };
        case 'fromEntries':
          return {
            type: 'ObjectFromEntries',
            entries: args[0],
            resultType: 'object',
            ilNodeType: 'ObjectFromEntries'
          };
        default:
          return null;
      }
    }

    /**
     * Transform String static method calls (String.fromCharCode, String.fromCodePoint)
     * @private
     */
    _transformStringStaticMethod(methodName, args, context) {
      switch (methodName) {
        case 'fromCharCode':
          return {
            type: 'StringFromCharCodes',
            charCodes: args,
            resultType: 'string',
            ilNodeType: 'StringFromCharCodes'
          };
        case 'fromCodePoint':
          return {
            type: 'StringFromCodePoints',
            codePoints: args,
            resultType: 'string',
            ilNodeType: 'StringFromCodePoints'
          };
        case 'raw':
          // String.raw`template` - raw template literal
          return {
            type: 'StringRaw',
            template: args[0],
            substitutions: args.slice(1),
            resultType: 'string',
            ilNodeType: 'StringRaw'
          };
        default:
          return null;
      }
    }

    /**
     * Transform Number static method calls (Number.isInteger, Number.isNaN, etc.)
     * @private
     */
    _transformNumberStaticMethod(methodName, args, context) {
      switch (methodName) {
        case 'isInteger':
          return {
            type: 'IsIntegerCheck',
            value: args[0],
            resultType: 'boolean',
            ilNodeType: 'IsIntegerCheck'
          };
        case 'isNaN':
          return {
            type: 'IsNaNCheck',
            value: args[0],
            resultType: 'boolean',
            ilNodeType: 'IsNaNCheck'
          };
        case 'isFinite':
          return {
            type: 'IsFiniteCheck',
            value: args[0],
            resultType: 'boolean',
            ilNodeType: 'IsFiniteCheck'
          };
        case 'isSafeInteger':
          return {
            type: 'IsSafeIntegerCheck',
            value: args[0],
            resultType: 'boolean',
            ilNodeType: 'IsSafeIntegerCheck'
          };
        case 'parseInt':
          return {
            type: 'ParseInteger',
            string: args[0],
            radix: args[1] || null,
            resultType: 'int32',
            ilNodeType: 'ParseInteger'
          };
        case 'parseFloat':
          return {
            type: 'ParseFloat',
            string: args[0],
            resultType: 'float64',
            ilNodeType: 'ParseFloat'
          };
        default:
          return null;
      }
    }

    /**
     * Transform DataView method calls (getUint8, setUint32, etc.)
     * @private
     */
    _transformDataViewMethod(viewNode, methodName, args, context) {
      // Transform the view node to get its type
      const transformedView = this._transformNode(viewNode, context);
      const viewType = transformedView?.resultType;

      // Only handle if we know it's a DataView type
      const isDataView = viewType === 'DataView' ||
                          transformedView?.type === 'DataViewCreation' ||
                          transformedView?.ilNodeType === 'DataViewCreation';

      // Map DataView methods to IL nodes
      const getterMethods = {
        'getInt8': { bits: 8, signed: true, resultType: 'int8' },
        'getUint8': { bits: 8, signed: false, resultType: 'uint8' },
        'getInt16': { bits: 16, signed: true, resultType: 'int16' },
        'getUint16': { bits: 16, signed: false, resultType: 'uint16' },
        'getInt32': { bits: 32, signed: true, resultType: 'int32' },
        'getUint32': { bits: 32, signed: false, resultType: 'uint32' },
        'getFloat32': { bits: 32, signed: true, resultType: 'float32' },
        'getFloat64': { bits: 64, signed: true, resultType: 'float64' },
        'getBigInt64': { bits: 64, signed: true, resultType: 'int64' },
        'getBigUint64': { bits: 64, signed: false, resultType: 'uint64' }
      };

      const setterMethods = {
        'setInt8': { bits: 8, signed: true, valueType: 'int8' },
        'setUint8': { bits: 8, signed: false, valueType: 'uint8' },
        'setInt16': { bits: 16, signed: true, valueType: 'int16' },
        'setUint16': { bits: 16, signed: false, valueType: 'uint16' },
        'setInt32': { bits: 32, signed: true, valueType: 'int32' },
        'setUint32': { bits: 32, signed: false, valueType: 'uint32' },
        'setFloat32': { bits: 32, signed: true, valueType: 'float32' },
        'setFloat64': { bits: 64, signed: true, valueType: 'float64' },
        'setBigInt64': { bits: 64, signed: true, valueType: 'int64' },
        'setBigUint64': { bits: 64, signed: false, valueType: 'uint64' }
      };

      // Transform arguments
      const transformedArgs = args.map(arg => this._transformNode(arg, context));

      if (getterMethods[methodName]) {
        const spec = getterMethods[methodName];
        return {
          type: 'DataViewRead',
          view: transformedView,
          method: methodName,
          offset: transformedArgs[0],
          littleEndian: transformedArgs[1] || null, // Optional for 8-bit methods
          bits: spec.bits,
          signed: spec.signed,
          resultType: spec.resultType,
          ilNodeType: 'DataViewRead'
        };
      }

      if (setterMethods[methodName]) {
        const spec = setterMethods[methodName];
        return {
          type: 'DataViewWrite',
          view: transformedView,
          method: methodName,
          offset: transformedArgs[0],
          value: transformedArgs[1],
          littleEndian: transformedArgs[2] || null, // Optional for 8-bit methods
          bits: spec.bits,
          signed: spec.signed,
          valueType: spec.valueType,
          resultType: 'void',
          ilNodeType: 'DataViewWrite'
        };
      }

      // Other DataView methods
      if (methodName === 'buffer' && !args.length) {
        return {
          type: 'DataViewGetBuffer',
          view: transformedView,
          resultType: 'ArrayBuffer',
          ilNodeType: 'DataViewGetBuffer'
        };
      }

      if (methodName === 'byteOffset' && !args.length) {
        return {
          type: 'DataViewGetByteOffset',
          view: transformedView,
          resultType: 'int32',
          ilNodeType: 'DataViewGetByteOffset'
        };
      }

      if (methodName === 'byteLength' && !args.length) {
        return {
          type: 'DataViewGetByteLength',
          view: transformedView,
          resultType: 'int32',
          ilNodeType: 'DataViewGetByteLength'
        };
      }

      return null; // Not a DataView method we handle
    }

    /**
     * Transform array method calls
     * @private
     */
    _transformArrayMethod(arrayNode, methodName, args, context) {
      // Transform the array node to get its type
      const transformedArray = this._transformNode(arrayNode, context);
      const resultType = transformedArray?.resultType;

      // Extract type string, handling both string types and type objects
      // Type objects have shape: { name: 'Uint8Array', isArray: false, ... }
      let resultTypeStr;
      if (typeof resultType === 'string') {
        resultTypeStr = resultType;
      } else if (resultType && typeof resultType === 'object' && resultType.name) {
        resultTypeStr = resultType.name;
      } else {
        resultTypeStr = String(resultType || '');
      }

      // Only handle if the object is an array type (ends with [] or is Array/TypedArray)
      const isArrayType = resultTypeStr.endsWith('[]') ||
                          resultTypeStr.startsWith('Array') ||
                          resultTypeStr === 'Uint8Array' ||
                          resultTypeStr === 'Uint16Array' ||
                          resultTypeStr === 'Uint32Array' ||
                          resultTypeStr === 'Int8Array' ||
                          resultTypeStr === 'Int16Array' ||
                          resultTypeStr === 'Int32Array' ||
                          resultTypeStr === 'Float32Array' ||
                          resultTypeStr === 'Float64Array';

      // If we can determine it's NOT an array type, skip array method handling
      // This prevents treating HashTable.find() as Array.find()
      if (resultTypeStr && !isArrayType && resultType !== null) {
        return null;
      }

      // Try to get element type from the array node if available
      const arrayElementType = arrayNode.elementType || resultTypeStr.replace('[]', '') || 'uint8';
      const arrayResultType = arrayNode.resultType || `${arrayElementType}[]`;

      // Helper to get result type for array operations
      const getResultType = (nodeType, elemType) => {
        const resultTypeFn = TypeAwareJSASTParser.OPERATION_RESULT_TYPES[nodeType];
        return resultTypeFn ? resultTypeFn(elemType) : elemType;
      };

      switch (methodName) {
        case 'push':
          // push() mutates the array in-place, returns new length
          // Preserve all arguments for multi-spread: arr.push(...a, ...b, ...c)
          return { type: 'ArrayAppend', array: arrayNode, value: args[0], values: args, resultType: 'int32', ilNodeType: 'ArrayAppend' };
        case 'pop':
          return { type: 'ArrayPop', array: arrayNode, elementType: arrayElementType, resultType: arrayElementType, ilNodeType: 'ArrayPop' };
        case 'shift':
          return { type: 'ArrayShift', array: arrayNode, elementType: arrayElementType, resultType: arrayElementType, ilNodeType: 'ArrayShift' };
        case 'unshift':
          return { type: 'ArrayUnshift', array: arrayNode, value: args[0], resultType: 'int32', ilNodeType: 'ArrayUnshift' };
        case 'fill':
          return {
            type: 'ArrayFill',
            array: arrayNode,
            value: args[0],
            start: args[1] || null,
            end: args[2] || null,
            elementType: arrayElementType,
            resultType: arrayResultType,
            ilNodeType: 'ArrayFill'
          };
        case 'slice':
          return {
            type: 'ArraySlice',
            array: arrayNode,
            start: args[0] || null,
            end: args[1] || null,
            elementType: arrayElementType,
            resultType: arrayResultType,
            ilNodeType: 'ArraySlice'
          };
        case 'splice':
          return {
            type: 'ArraySplice',
            array: arrayNode,
            start: args[0],
            deleteCount: args[1] || null,
            items: args.slice(2),
            elementType: arrayElementType,
            resultType: arrayResultType,
            ilNodeType: 'ArraySplice'
          };
        case 'concat':
          return { type: 'ArrayConcat', array: arrayNode, arrays: args, elementType: arrayElementType, resultType: arrayResultType, ilNodeType: 'ArrayConcat' };
        case 'indexOf':
          return { type: 'ArrayIndexOf', array: arrayNode, value: args[0], start: args[1] || null, resultType: 'int32', ilNodeType: 'ArrayIndexOf' };
        case 'includes':
          return { type: 'ArrayIncludes', array: arrayNode, value: args[0], resultType: 'boolean', ilNodeType: 'ArrayIncludes' };
        case 'join':
          return { type: 'ArrayJoin', array: arrayNode, separator: args[0] || null, resultType: 'string', ilNodeType: 'ArrayJoin' };
        case 'reverse':
          return { type: 'ArrayReverse', array: arrayNode, elementType: arrayElementType, resultType: arrayResultType, ilNodeType: 'ArrayReverse' };
        case 'sort':
          return { type: 'ArraySort', array: arrayNode, compareFn: args[0] || null, elementType: arrayElementType, resultType: arrayResultType, ilNodeType: 'ArraySort' };
        case 'map':
          // Map result depends on callback, default to same element type
          return { type: 'ArrayMap', array: arrayNode, callback: args[0], elementType: arrayElementType, resultType: arrayResultType, ilNodeType: 'ArrayMap' };
        case 'filter':
          return { type: 'ArrayFilter', array: arrayNode, callback: args[0], elementType: arrayElementType, resultType: arrayResultType, ilNodeType: 'ArrayFilter' };
        case 'forEach':
          return { type: 'ArrayForEach', array: arrayNode, callback: args[0], resultType: 'void', ilNodeType: 'ArrayForEach' };
        case 'reduce':
          // Reduce result type comes from initialValue if provided, otherwise element type
          const reduceResultType = args[1]?.resultType || arrayElementType;
          return { type: 'ArrayReduce', array: arrayNode, callback: args[0], initialValue: args[1] || null, resultType: reduceResultType, ilNodeType: 'ArrayReduce' };
        case 'find':
          // Only treat as Array.find() if callback is a function expression
          if (!args[0] || (args[0].type !== 'ArrowFunctionExpression' && args[0].type !== 'FunctionExpression')) {
            return null; // Not Array.find() - might be HashTable.find() or similar
          }
          return { type: 'ArrayFind', array: arrayNode, callback: args[0], resultType: arrayElementType, ilNodeType: 'ArrayFind' };
        case 'findIndex':
          // Only treat as Array.findIndex() if callback is a function expression
          if (!args[0] || (args[0].type !== 'ArrowFunctionExpression' && args[0].type !== 'FunctionExpression')) {
            return null;
          }
          return { type: 'ArrayFindIndex', array: arrayNode, callback: args[0], resultType: 'int32', ilNodeType: 'ArrayFindIndex' };
        case 'every':
          return { type: 'ArrayEvery', array: arrayNode, callback: args[0], resultType: 'boolean', ilNodeType: 'ArrayEvery' };
        case 'some':
          return { type: 'ArraySome', array: arrayNode, callback: args[0], resultType: 'boolean', ilNodeType: 'ArraySome' };
        case 'set': {
          // TypedArray.set() - copy elements from another array, returns void
          // ONLY handle if we know it's a TypedArray (not Map/Set which also have .set())
          // Include both JS TypedArray names and IL array types (uint8[], int32[], etc.)
          const isTypedArray = resultTypeStr === 'Uint8Array' ||
                               resultTypeStr === 'Uint16Array' ||
                               resultTypeStr === 'Uint32Array' ||
                               resultTypeStr === 'Int8Array' ||
                               resultTypeStr === 'Int16Array' ||
                               resultTypeStr === 'Int32Array' ||
                               resultTypeStr === 'Float32Array' ||
                               resultTypeStr === 'Float64Array' ||
                               resultTypeStr === 'uint8[]' ||
                               resultTypeStr === 'uint16[]' ||
                               resultTypeStr === 'uint32[]' ||
                               resultTypeStr === 'int8[]' ||
                               resultTypeStr === 'int16[]' ||
                               resultTypeStr === 'int32[]' ||
                               resultTypeStr.endsWith('[]');  // Any array type
          if (isTypedArray) {
            return { type: 'TypedArraySet', array: arrayNode, source: args[0], offset: args[1] || null, resultType: 'void', ilNodeType: 'TypedArraySet' };
          }

          // Heuristic: if first argument looks like an array (not a primitive), treat as TypedArraySet
          // TypedArray.set(array, offset) vs Map.set(key, value)
          // Array indicators: ArrayExpression, Identifier with array-like name, CallExpression returning array
          const firstArg = args[0];
          const firstArgType = firstArg?.type || firstArg?.resultType || firstArg?.ilNodeType;
          // Get name for pattern matching - check 'name' (Identifier), 'property' (ThisPropertyAccess/MemberExpression)
          const firstArgName = firstArg?.name || firstArg?.property || '';
          // Match names that start with OR end with array-like patterns
          const arrayNameStartRegex = /^_?(b\d|bytes|data|source|arr|array|ciphertext|plaintext|tag|encrypted|decrypted|block|output|input|buffer|state|key|iv|nonce|result|chunk|msg|message)/i;
          const arrayNameEndRegex = /(bytes|data|array|buffer|block|chunk|state)$/i;
          const matchesArrayName = arrayNameStartRegex.test(firstArgName) || arrayNameEndRegex.test(firstArgName);
          const isFirstArgArray = firstArgType === 'ArrayExpression' ||
                                   firstArgType === 'UnpackBytes' ||  // OpCodes.Unpack32LE etc (returns byte array)
                                   firstArgType === 'PackBytes' ||     // OpCodes.Pack32LE etc (returns byte array)
                                   firstArgType === 'CallExpression' ||  // Any call expression likely returns array for .set()
                                   firstArgType === 'TypedArraySubarray' ||  // arr.subarray() returns TypedArray
                                   firstArgType === 'ArraySlice' ||    // arr.slice() returns array
                                   firstArgType === 'TypedArraySlice' ||  // TypedArray.slice() returns array
                                   firstArgType === 'ThisPropertyAccess' && matchesArrayName ||  // this._nonce, this._key, etc.
                                   (firstArgType && (firstArgType.endsWith('[]') || firstArgType === 'Uint8Array')) ||
                                   matchesArrayName;

          // If first arg looks like array data and second is a number/offset expression, it's TypedArraySet
          const secondArg = args[1];
          const secondArgType = secondArg?.type || secondArg?.ilNodeType;
          // Match offset/index/length variable names: offset, pos, i, index, start, n, len, plen, clen, dlen, size, etc.
          // Also match names ending with pos, len, idx, etc. (e.g., cpos, mlen, srcIdx)
          const offsetNameStartRegex = /^(offset|pos|i|j|k|index|idx|start|n|len|plen|clen|dlen|alen|blen|mlen|size|count)/i;
          const offsetNameEndRegex = /(offset|pos|index|idx|len)$/i;
          const matchesOffsetName = (secondArg?.name && (offsetNameStartRegex.test(secondArg.name) || offsetNameEndRegex.test(secondArg.name)));
          const isSecondArgOffset = !secondArg ||
                                     secondArgType === 'Literal' ||
                                     secondArgType === 'ArrayLength' ||  // arr.length transformed to IL node
                                     secondArgType === 'BinaryExpression' ||  // offset + size, etc.
                                     (secondArgType === 'Identifier' && matchesOffsetName) ||
                                     (secondArgType === 'MemberExpression' && secondArg.property?.name === 'length');
          if (isFirstArgArray && isSecondArgOffset) {
            return { type: 'TypedArraySet', array: arrayNode, source: args[0], offset: args[1] || null, resultType: 'void', ilNodeType: 'TypedArraySet' };
          }

          // For Map.set(key, value), create a MapSet IL node
          if (args.length >= 2) {
            return { type: 'MapSet', map: arrayNode, key: args[0], value: args[1], resultType: 'void', ilNodeType: 'MapSet' };
          }
          return null; // Let it fall through for other cases
        }
        case 'subarray':
          return { type: 'TypedArraySubarray', array: arrayNode, begin: args[0] || null, end: args[1] || null, elementType: arrayElementType, resultType: arrayResultType, ilNodeType: 'TypedArraySubarray' };
        default:
          return null; // Not an array method we handle
      }
    }

    /**
     * Transform string method calls to add resultType
     * @private
     */
    _transformStringMethod(stringNode, methodName, args, context) {
      // Transform the string node to get its type
      const transformedString = this._transformNode(stringNode, context);
      const stringType = transformedString?.resultType;

      // Only handle if the object is a string type
      if (stringType !== 'string') return null;

      switch (methodName) {
        case 'split':
          return {
            type: 'StringSplit',
            string: transformedString,
            separator: args[0] || null,
            resultType: 'string[]',
            ilNodeType: 'StringSplit'
          };
        case 'substring':
        case 'substr':
        case 'slice':
          return {
            type: 'StringSubstring',
            string: transformedString,
            start: args[0] || null,
            end: args[1] || null,
            resultType: 'string',
            ilNodeType: 'StringSubstring'
          };
        case 'toLowerCase':
        case 'toUpperCase':
        case 'trim':
        case 'trimStart':
        case 'trimEnd':
          return {
            type: 'StringTransform',
            string: transformedString,
            method: methodName,
            resultType: 'string',
            ilNodeType: 'StringTransform'
          };
        case 'charAt':
          return {
            type: 'StringCharAt',
            string: transformedString,
            index: args[0] || null,
            resultType: 'string',
            ilNodeType: 'StringCharAt'
          };
        case 'charCodeAt':
          return {
            type: 'StringCharCodeAt',
            string: transformedString,
            index: args[0] || null,
            resultType: 'int32',
            ilNodeType: 'StringCharCodeAt'
          };
        case 'indexOf':
        case 'lastIndexOf':
          return {
            type: 'StringIndexOf',
            string: transformedString,
            searchValue: args[0] || null,
            fromIndex: args[1] || null,
            method: methodName,
            resultType: 'int32',
            ilNodeType: 'StringIndexOf'
          };
        case 'includes':
        case 'startsWith':
        case 'endsWith':
          return {
            type: 'StringIncludes',
            string: transformedString,
            searchValue: args[0] || null,
            method: methodName,
            resultType: 'boolean',
            ilNodeType: 'StringIncludes'
          };
        case 'concat':
          return {
            type: 'StringConcat',
            string: transformedString,
            values: args,
            resultType: 'string',
            ilNodeType: 'StringConcat'
          };
        case 'repeat':
          return {
            type: 'StringRepeat',
            string: transformedString,
            count: args[0] || null,
            resultType: 'string',
            ilNodeType: 'StringRepeat'
          };
        case 'replace':
        case 'replaceAll':
          return {
            type: 'StringReplace',
            string: transformedString,
            searchValue: args[0] || null,
            replaceValue: args[1] || null,
            method: methodName,
            resultType: 'string',
            ilNodeType: 'StringReplace'
          };
        case 'padStart':
        case 'padEnd':
          return {
            type: 'StringPad',
            string: transformedString,
            targetLength: args[0] || null,
            padString: args[1] || null,
            method: methodName,
            resultType: 'string',
            ilNodeType: 'StringPad'
          };
        default:
          return null; // Not a string method we handle
      }
    }

    /**
     * Transform MemberExpression nodes
     * Handles: this.property, arr.length, arr[i]
     * @private
     */
    _transformMemberExpression(node, context) {
      const object = node.object;
      const property = node.property;
      const propertyName = property?.name || property?.value;

      // this.property → ThisPropertyAccess
      if (object?.type === 'ThisExpression') {
        // Look up property type from class field types registry (set during class parsing)
        let resultType = null;
        const className = context?.className;
        if (className && propertyName)
          resultType = this.lookupClassFieldType(className, propertyName);

        return {
          type: 'ThisPropertyAccess',
          property: propertyName,
          computed: node.computed || false,
          resultType,
          ilNodeType: 'ThisPropertyAccess'
        };
      }

      // arr.length → ArrayLength
      if (propertyName === 'length' && !node.computed) {
        return {
          type: 'ArrayLength',
          array: this._transformNode(object, context),
          resultType: 'int32',
          ilNodeType: 'ArrayLength'
        };
      }

      // Math constants: Math.PI, Math.E, Math.LN2, etc. → MathConstant IL node
      const MATH_CONSTANTS = {
        'PI': Math.PI, 'E': Math.E, 'LN2': Math.LN2, 'LN10': Math.LN10,
        'LOG2E': Math.LOG2E, 'LOG10E': Math.LOG10E, 'SQRT2': Math.SQRT2, 'SQRT1_2': Math.SQRT1_2
      };
      if (object?.type === 'Identifier' && object.name === 'Math' && propertyName in MATH_CONSTANTS) {
        return {
          type: 'MathConstant',
          name: propertyName,
          value: MATH_CONSTANTS[propertyName],
          resultType: 'float64',
          ilNodeType: 'MathConstant'
        };
      }

      // Number constants: Number.MAX_SAFE_INTEGER, Number.EPSILON, etc. → NumberConstant IL node
      const NUMBER_CONSTANTS = {
        'MAX_SAFE_INTEGER': Number.MAX_SAFE_INTEGER, 'MIN_SAFE_INTEGER': Number.MIN_SAFE_INTEGER,
        'MAX_VALUE': Number.MAX_VALUE, 'MIN_VALUE': Number.MIN_VALUE,
        'EPSILON': Number.EPSILON, 'POSITIVE_INFINITY': Infinity,
        'NEGATIVE_INFINITY': -Infinity, 'NaN': NaN
      };
      if (object?.type === 'Identifier' && object.name === 'Number' && propertyName in NUMBER_CONSTANTS) {
        return {
          type: 'NumberConstant',
          name: propertyName,
          value: NUMBER_CONSTANTS[propertyName],
          resultType: 'float64',
          ilNodeType: 'NumberConstant'
        };
      }

      // Array indexing: arr[i] → preserve MemberExpression structure with element type
      if (node.computed) {
        const transformedObject = this._transformNode(object, context);
        const transformedProperty = this._transformNode(property, context);

        // Get the array type to extract element type
        let objectType = transformedObject?.resultType;

        // If object is an identifier, look up its type
        if (!objectType && object?.type === 'Identifier' && object.name)
          objectType = this.lookupVariableType(object.name);

        // Extract element type from array type (e.g., "uint8[]" → "uint8")
        let elementType = null;
        if (objectType && typeof objectType === 'string') {
          if (objectType.endsWith('[]'))
            elementType = objectType.slice(0, -2);
          else if (objectType.startsWith('Array<') && objectType.endsWith('>'))
            elementType = objectType.slice(6, -1);
        }

        // Preserve MemberExpression structure for backward compatibility with transformers
        return {
          type: 'MemberExpression',
          object: transformedObject,
          property: transformedProperty,
          computed: true,
          resultType: elementType,
          ilNodeType: 'MemberExpression'
        };
      }

      // General property access - transform and preserve type information
      const transformedObject = this._transformNode(object, context);
      let resultType = null;

      // Try to get property type from object's known type
      let objectType = transformedObject?.resultType;
      if (!objectType && object?.type === 'Identifier' && object.name)
        objectType = this.lookupVariableType(object.name);

      // Known property patterns that apply to any object
      if (propertyName === 'length' || propertyName === 'size' || propertyName === 'count')
        resultType = 'int32';

      return {
        ...node,
        object: transformedObject,
        resultType,
        ilNodeType: 'MemberExpression'
      };
    }

    /**
     * Transform NewExpression nodes
     * Handles: new Array(), new Uint8Array(), new DataView(), etc.
     * @private
     */
    _transformNewExpression(node, context) {
      const callee = node.callee;
      const calleeName = callee?.name;
      const args = node.arguments || [];

      // Helper to create TypedArrayCreation IL node
      // Distinguishes between: new TypedArray(size), new TypedArray([elements]), new TypedArray(buffer)
      const createTypedArrayNode = (arrayType, arg) => {
        // Get precise element type from our mapping
        const elementType = TypeAwareJSASTParser.TYPED_ARRAY_ELEMENT_TYPES[arrayType] || 'uint8';
        const resultType = `${elementType}[]`;

        if (!arg) {
          return { type: 'TypedArrayCreation', arrayType, elementType, resultType, size: null, ilNodeType: 'TypedArrayCreation' };
        }
        // If arg is an array literal, treat as elements (not size)
        if (arg.type === 'ArrayExpression' || arg.type === 'ArrayLiteral') {
          return { type: 'ArrayLiteral', elements: arg.elements || [], elementType, resultType, ilNodeType: 'ArrayLiteral' };
        }
        // If arg is an identifier or member expression, might be a buffer reference
        if (arg.type === 'Identifier' || arg.type === 'MemberExpression') {
          return {
            type: 'TypedArrayCreation',
            arrayType,
            elementType,
            resultType,
            size: arg,
            buffer: arg,
            ilNodeType: 'TypedArrayCreation'
          };
        }
        // Otherwise, treat as size
        return { type: 'TypedArrayCreation', arrayType, elementType, resultType, size: arg, ilNodeType: 'TypedArrayCreation' };
      };

      switch (calleeName) {
        case 'Array':
          if (args.length === 1) {
            // Try to infer element type from context (e.g., variable name patterns)
            // Leave elementType null if no context - let language transformers infer from assignment target
            const inferredElementType = context.expectedElementType || null;
            return {
              type: 'ArrayCreation',
              size: args[0],
              elementType: inferredElementType,
              resultType: inferredElementType ? `${inferredElementType}[]` : null,
              ilNodeType: 'ArrayCreation'
            };
          }
          // For array literals, infer type from first element if available
          if (args.length > 0 && args[0]) {
            const firstEl = args[0];
            let elementType = 'uint8'; // Default for crypto code
            if (firstEl.type === 'Literal') {
              if (typeof firstEl.value === 'number') {
                elementType = Number.isInteger(firstEl.value) && firstEl.value >= 0 && firstEl.value <= 255 ? 'uint8' :
                              Number.isInteger(firstEl.value) && firstEl.value >= 0 && firstEl.value <= 0xFFFFFFFF ? 'uint32' : 'float64';
              } else if (typeof firstEl.value === 'string') {
                elementType = 'string';
              } else if (typeof firstEl.value === 'boolean') {
                elementType = 'boolean';
              }
            } else if (firstEl.resultType) {
              elementType = firstEl.resultType;
            }
            return { type: 'ArrayLiteral', elements: args, elementType, resultType: `${elementType}[]`, ilNodeType: 'ArrayLiteral' };
          }
          return { type: 'ArrayLiteral', elements: args, elementType: 'uint8', resultType: 'uint8[]', ilNodeType: 'ArrayLiteral' };

        case 'Uint8Array':
        case 'Int8Array':
        case 'Uint8ClampedArray':
          return createTypedArrayNode(calleeName, args[0]);

        case 'Uint16Array':
        case 'Int16Array':
          return createTypedArrayNode(calleeName, args[0]);

        case 'Uint32Array':
        case 'Int32Array':
        case 'Float32Array':
        case 'Float64Array':
          return createTypedArrayNode(calleeName, args[0]);

        case 'BigUint64Array':
        case 'BigInt64Array':
          return createTypedArrayNode(calleeName, args[0]);

        case 'ArrayBuffer':
          return { type: 'BufferCreation', size: args[0], resultType: 'ArrayBuffer', ilNodeType: 'BufferCreation' };

        case 'DataView':
          return {
            type: 'DataViewCreation',
            buffer: args[0],
            byteOffset: args[1] || null,
            byteLength: args[2] || null,
            resultType: 'DataView',
            ilNodeType: 'DataViewCreation'
          };

        case 'Map':
          // For crypto code, maps typically use string keys and uint8[] values
          return { type: 'MapCreation', entries: args[0] || null, resultType: 'Map', keyType: 'string', valueType: 'uint8[]', ilNodeType: 'MapCreation' };

        case 'Set':
          // For crypto code, sets typically contain uint8 or uint32 values
          return { type: 'SetCreation', values: args[0] || null, resultType: 'Set', elementType: 'uint32', ilNodeType: 'SetCreation' };

        case 'Error':
        case 'TypeError':
        case 'RangeError':
        case 'ReferenceError':
          return { type: 'ErrorCreation', errorType: calleeName, message: args[0], resultType: calleeName, ilNodeType: 'ErrorCreation' };

        default:
          // Keep as NewExpression but mark it
          node.ilNodeType = 'NewExpression';
          return node;
      }
    }

    /**
     * Transform VariableDeclaration nodes
     * Handles: destructuring patterns, multiple declarators
     * @private
     */
    _transformVariableDeclaration(node, context) {
      const declarations = node.declarations || [];
      const kind = node.kind;
      const transformedDeclarations = [];
      const isModuleLevel = context.isModuleLevel;
      const isConst = kind === 'const';

      for (const decl of declarations) {
        // Handle destructuring: const {a, b} = obj or const [a, b] = arr
        if (decl.id?.type === 'ObjectPattern' || decl.id?.type === 'ArrayPattern') {
          // Create a temporary variable for the source
          const tempName = `_destructure_${this._destructureCounter || 0}`;
          this._destructureCounter = (this._destructureCounter || 0) + 1;

          // Transform and get type of source expression
          const transformedInit = decl.init ? this._transformNode(decl.init, context) : null;
          const sourceType = transformedInit?.resultType;

          // First, assign the source to the temp variable
          transformedDeclarations.push({
            type: 'VariableDeclarator',
            id: { type: 'Identifier', name: tempName, resultType: sourceType },
            init: transformedInit,
            ilNodeType: 'DestructureTemp',
            resultType: sourceType
          });

          if (sourceType)
            this.registerVariableType(tempName, sourceType);

          // Then create individual assignments from the temp
          if (decl.id.type === 'ObjectPattern') {
            for (const prop of (decl.id.properties || [])) {
              const propName = prop.key?.name || prop.key?.value;
              const varName = prop.value?.name || propName;
              transformedDeclarations.push({
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: varName },
                init: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: tempName },
                  property: { type: 'Identifier', name: propName },
                  computed: false
                },
                ilNodeType: 'DestructuredProperty'
              });
            }
          } else if (decl.id.type === 'ArrayPattern') {
            // For array destructuring, element type is the array's element type
            let elementType = null;
            // sourceType can be a string like 'uint8[]' or an object with type info
            const sourceTypeStr = typeof sourceType === 'string' ? sourceType : sourceType?.name;
            if (sourceTypeStr && typeof sourceTypeStr === 'string' && sourceTypeStr.endsWith('[]'))
              elementType = sourceTypeStr.slice(0, -2);

            let index = 0;
            for (const element of (decl.id.elements || [])) {
              if (element) {
                const varName = element.name;
                transformedDeclarations.push({
                  type: 'VariableDeclarator',
                  id: { type: 'Identifier', name: varName, resultType: elementType },
                  init: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: tempName },
                    property: { type: 'Literal', value: index, resultType: 'int32' },
                    computed: true,
                    resultType: elementType
                  },
                  ilNodeType: 'DestructuredElement',
                  resultType: elementType
                });
                if (elementType)
                  this.registerVariableType(varName, elementType);
              }
              ++index;
            }
          }
        } else {
          // Regular declarator - transform init and register type
          const varName = decl.id?.name;
          let transformedInit = decl.init ? this._transformNode(decl.init, context) : null;
          let varType = transformedInit?.resultType || null;

          // No name-based fallback - types must come from values or JSDoc

          // Register the variable type
          if (varName && varType) {
            if (isModuleLevel && isConst)
              this.registerConstantType(varName, varType);
            else
              this.registerVariableType(varName, varType);
          }

          // Create transformed declarator with type info
          const transformedDecl = {
            ...decl,
            init: transformedInit,
            resultType: varType
          };
          if (decl.id) {
            transformedDecl.id = { ...decl.id, resultType: varType };
          }
          transformedDeclarations.push(transformedDecl);
        }
      }

      return {
        type: 'VariableDeclaration',
        kind: kind,
        declarations: transformedDeclarations
      };
    }

    /**
     * Transform ForStatement nodes
     * Handles: multiple declarations in init (for (let i=0, j=0; ...))
     * @private
     */
    _transformForStatement(node, context) {
      const init = node.init;

      // If init is a VariableDeclaration with multiple declarators, we may need to handle it
      // Most languages can handle this, but we mark it for transformers to handle properly
      if (init?.type === 'VariableDeclaration' && init.declarations?.length > 1) {
        node.ilNodeType = 'MultiDeclForStatement';
      }

      return node;
    }

    /**
     * Transform Literal nodes to add resultType based on value type
     * @private
     */
    _transformLiteral(node, context) {
      const value = node.value;
      let resultType;

      if (typeof value === 'number') {
        // Handle special float values first (Infinity, NaN)
        if (!Number.isFinite(value)) {
          resultType = 'float64';
        } else if (!Number.isInteger(value)) {
          // Explicit float (has decimal point)
          resultType = 'float64';
        } else {
          // Integer literals default to int32 (like most typed languages)
          // Only use larger types when value exceeds int32 range
          if (value >= -2147483648 && value <= 2147483647) {
            resultType = 'int32';
          } else if (value >= 0 && value <= 4294967295) {
            resultType = 'uint32';
          } else if (value < -2147483648) {
            resultType = 'int64';
          } else {
            resultType = 'uint64';
          }
        }
      } else if (typeof value === 'bigint') {
        resultType = value >= 0n ? 'uint64' : 'int64';
      } else if (typeof value === 'string') {
        resultType = 'string';
      } else if (typeof value === 'boolean') {
        resultType = 'boolean';
      } else if (value === null) {
        resultType = 'null';
      } else if (value === undefined) {
        resultType = 'void';
      } else if (node.regex) {
        // Regex literal
        resultType = 'regex';
      } else {
        // Unknown literal - use 'object' as more specific than 'any'
        resultType = 'object';
      }

      return {
        ...node,
        resultType,
        ilNodeType: 'Literal'
      };
    }

    /**
     * Transform ArrayExpression nodes to add resultType and elementType
     * @private
     */
    _transformArrayExpression(node, context) {
      // Transform all elements first
      const elements = (node.elements || []).map(el =>
        el ? this._transformNode(el, context) : null
      );

      // Infer element type from elements with type coercion
      let elementType = null;
      for (const el of elements) {
        if (el && el.resultType) {
          const elType = el.resultType;
          if (!elementType) {
            elementType = elType;
          } else if (elementType !== elType) {
            // Type coercion: find common type
            elementType = this._getCommonType(elementType, elType);
          }
        }
      }

      // If no element types found, use int32 as default (consistent with literal default)
      if (!elementType) {
        elementType = 'int32';
      }

      return {
        ...node,
        elements,
        elementType,
        resultType: `${elementType}[]`,
        ilNodeType: 'ArrayLiteral'
      };
    }

    /**
     * Get common type between two types for type coercion
     * @private
     */
    _getCommonType(type1, type2) {
      // Same types
      if (type1 === type2) return type1;

      // Numeric type widening
      const numericTypes = ['uint8', 'uint16', 'uint32', 'uint64', 'int8', 'int16', 'int32', 'int64', 'float32', 'float64'];
      const idx1 = numericTypes.indexOf(type1);
      const idx2 = numericTypes.indexOf(type2);

      if (idx1 >= 0 && idx2 >= 0) {
        // Both numeric - use the larger type
        const isSigned1 = type1.startsWith('int') || type1.startsWith('float');
        const isSigned2 = type2.startsWith('int') || type2.startsWith('float');

        // If one is signed and one unsigned, prefer signed
        if (isSigned1 !== isSigned2) {
          // Use the larger bit width with signed
          const bits1 = parseInt(type1.match(/\d+/)?.[0] || '32');
          const bits2 = parseInt(type2.match(/\d+/)?.[0] || '32');
          const maxBits = Math.max(bits1, bits2);
          return maxBits <= 8 ? 'int8' : maxBits <= 16 ? 'int16' : maxBits <= 32 ? 'int32' : 'int64';
        }

        // Same signedness - use larger type
        return idx1 > idx2 ? type1 : type2;
      }

      // String and anything else -> string
      if (type1 === 'string' || type2 === 'string') return 'string';

      // Fallback to the first type
      return type1;
    }

    /**
     * Transform BinaryExpression nodes to add resultType
     * @private
     */
    _transformBinaryExpression(node, context) {
      const left = this._transformNode(node.left, context);
      const right = this._transformNode(node.right, context);
      const op = node.operator;

      // instanceof → InstanceOfCheck IL node
      if (op === 'instanceof') {
        return {
          type: 'InstanceOfCheck',
          value: left,
          className: right,
          resultType: 'boolean',
          ilNodeType: 'InstanceOfCheck'
        };
      }

      let resultType;

      // Helper to get literal value from right operand
      const getRightValue = () => {
        if (right.type === 'Literal' && typeof right.value === 'number')
          return right.value;
        return null;
      };
      const rightValue = getRightValue();

      // Check for idioms first (common JavaScript type coercion patterns)

      // Idiom: x & 0xff or x & 255 → uint8
      if (op === '&' && (rightValue === 0xff || rightValue === 255)) {
        resultType = 'uint8';
      }
      // Idiom: x & 0xffff or x & 65535 → uint16
      else if (op === '&' && (rightValue === 0xffff || rightValue === 65535)) {
        resultType = 'uint16';
      }
      // Idiom: x & 0xffffffff → uint32
      else if (op === '&' && rightValue === 0xffffffff) {
        resultType = 'uint32';
      }
      // Idiom: x | 0 → int32 (JavaScript ToInt32)
      else if (op === '|' && rightValue === 0) {
        resultType = 'int32';
      }
      // Idiom: x >> 0 → int32 (JavaScript ToInt32)
      else if (op === '>>' && rightValue === 0) {
        resultType = 'int32';
      }
      // Idiom: x >>> 0 → uint32 (JavaScript ToUint32)
      else if (op === '>>>' && rightValue === 0) {
        resultType = 'uint32';
      }
      // Comparison operators always return boolean
      else if (['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(op)) {
        resultType = 'boolean';
      }
      // Logical operators return boolean
      else if (['&&', '||'].includes(op)) {
        resultType = 'boolean';
      }
      // Bitwise operators - return left operand type (unless idiom above)
      else if (['&', '|', '^', '<<', '>>', '>>>'].includes(op)) {
        // >>> always produces uint32 in JavaScript (ToUint32)
        if (op === '>>>') {
          resultType = 'uint32';
        } else {
          const leftType = left.resultType;
          // Return left operand type for bitwise ops
          if (leftType && leftType !== 'any' && leftType !== 'number')
            resultType = leftType;
          else
            resultType = 'int32'; // Default to int32
        }
      }
      // Arithmetic operators
      else if (['+', '-', '*', '%'].includes(op)) {
        // Convert resultType to string for safe comparison (it may be an object)
        const leftType = typeof left.resultType === 'string' ? left.resultType : String(left.resultType || '');
        const rightType = typeof right.resultType === 'string' ? right.resultType : String(right.resultType || '');

        // String concatenation check
        if (op === '+' && (leftType === 'string' || rightType === 'string')) {
          resultType = 'string';
        }
        // If either is float, result is float
        else if (leftType.includes('float') || rightType.includes('float')) {
          resultType = 'float64';
        }
        // If either is 64-bit, result is 64-bit
        else if (leftType.includes('64') || rightType.includes('64')) {
          resultType = leftType.includes('int') || rightType.includes('int') ? 'int64' : 'uint64';
        }
        // Preserve left type if specific, else default to int32
        else if (leftType && leftType !== 'any' && leftType !== 'number') {
          resultType = leftType;
        }
        else if (rightType && rightType !== 'any' && rightType !== 'number') {
          resultType = rightType;
        }
        else {
          resultType = 'int32';
        }
      }
      // Division may produce float
      else if (op === '/') {
        resultType = 'float64';
      }
      // Exponentiation
      else if (op === '**') {
        resultType = 'float64';
      }
      else {
        resultType = left.resultType || right.resultType || 'int32';
      }

      return {
        ...node,
        left,
        right,
        resultType,
        ilNodeType: 'BinaryExpression'
      };
    }

    /**
     * Transform UnaryExpression nodes to add resultType
     * @private
     */
    _transformUnaryExpression(node, context) {
      const argument = this._transformNode(node.argument, context);
      const op = node.operator;

      let resultType;

      if (op === '!') {
        resultType = 'boolean';
      } else if (op === '~') {
        // Bitwise NOT - always returns int32 in JavaScript (ToInt32 then NOT)
        resultType = 'int32';
      } else if (op === '-' || op === '+') {
        // Preserve argument type if specific, else default to int32
        const argType = argument.resultType;
        if (argType && argType !== 'any' && argType !== 'number')
          resultType = argType;
        else
          resultType = 'int32';
      } else if (op === 'typeof') {
        // Transform typeof to a language-agnostic TypeOfExpression IL node
        // This allows target transformers to handle type checking without JS-specific patterns
        return {
          type: 'TypeOfExpression',
          argument,
          resultType: 'string',
          ilNodeType: 'TypeOfExpression',
          // Provide inferred type for optimization (can skip runtime type check)
          inferredType: argument.resultType || null
        };
      } else if (op === 'void') {
        resultType = 'void';
      } else if (op === 'delete') {
        // Transform delete to a language-agnostic DeleteExpression IL node
        return {
          type: 'DeleteExpression',
          argument,
          resultType: 'boolean',
          ilNodeType: 'DeleteExpression'
        };
      } else {
        resultType = argument.resultType || 'int32';
      }

      return {
        ...node,
        argument,
        resultType,
        ilNodeType: 'UnaryExpression'
      };
    }

    // ========================[ IL AST BUILDING - JS-SPECIFIC PATTERN NORMALIZATION ]========================

    /**
     * Transform TemplateLiteral to language-agnostic StringInterpolation IL node
     * Converts JS template strings (`Hello ${name}`) to a normalized format
     * @private
     */
    _transformTemplateLiteral(node, context) {
      const parts = [];
      const quasis = node.quasis || [];
      const expressions = node.expressions || [];

      // Interleave quasis (string parts) and expressions
      for (let i = 0; i < quasis.length; ++i) {
        const quasi = quasis[i];
        // Add static string part if non-empty
        if (quasi.value?.cooked || quasi.value?.raw) {
          const strValue = quasi.value.cooked !== undefined ? quasi.value.cooked : quasi.value.raw;
          if (strValue) {
            parts.push({
              type: 'StringPart',
              value: strValue,
              ilNodeType: 'StringPart'
            });
          }
        }
        // Add expression part if there's a corresponding expression
        if (i < expressions.length) {
          const transformedExpr = this._transformNode(expressions[i], context);
          parts.push({
            type: 'ExpressionPart',
            expression: transformedExpr,
            ilNodeType: 'ExpressionPart'
          });
        }
      }

      return {
        type: 'StringInterpolation',
        parts,
        resultType: 'string',
        ilNodeType: 'StringInterpolation'
      };
    }

    /**
     * Transform SpreadElement to language-agnostic IL node
     * Converts JS spread syntax (...arr) to a normalized format
     * @private
     */
    _transformSpreadElement(node, context) {
      const argument = this._transformNode(node.argument, context);

      // Determine element type from argument type
      let elementType = null;
      const argType = argument?.resultType;
      if (argType && typeof argType === 'string') {
        if (argType.endsWith('[]'))
          elementType = argType.slice(0, -2);
        else if (argType === 'string')
          elementType = 'char';
      }

      return {
        type: 'SpreadElement',
        argument,
        elementType,
        resultType: argType,
        ilNodeType: 'SpreadElement'
      };
    }

    /**
     * Transform RestElement to language-agnostic IL node
     * Converts JS rest syntax (...args) in function parameters to a normalized format
     * @private
     */
    _transformRestElement(node, context) {
      const argument = node.argument;
      const paramName = argument?.name || argument?.value;

      return {
        type: 'RestParameter',
        name: paramName,
        argument: argument ? this._transformNode(argument, context) : null,
        resultType: 'any[]', // Rest parameters are always arrays
        ilNodeType: 'RestParameter'
      };
    }

    /**
     * Transform ObjectExpression to language-agnostic ObjectLiteral IL node
     * @private
     */
    _transformObjectExpression(node, context) {
      const properties = [];

      for (const prop of (node.properties || [])) {
        if (prop.type === 'SpreadElement') {
          // Object spread: { ...other }
          properties.push({
            type: 'ObjectSpread',
            argument: this._transformNode(prop.argument, context),
            ilNodeType: 'ObjectSpread'
          });
        } else if (prop.type === 'Property') {
          // Determine key
          let keyName;
          let computed = prop.computed || false;
          if (prop.key?.type === 'Identifier') {
            keyName = prop.key.name;
          } else if (prop.key?.type === 'Literal') {
            keyName = String(prop.key.value);
          } else {
            keyName = prop.key;
            computed = true;
          }

          // Transform value
          const transformedValue = this._transformNode(prop.value, context);

          // Handle shorthand properties: { x } instead of { x: x }
          const isShorthand = prop.shorthand || false;

          // Handle method definitions: { foo() {} }
          const isMethod = prop.method || (prop.value?.type === 'FunctionExpression' || prop.value?.type === 'ArrowFunctionExpression');

          properties.push({
            type: 'ObjectProperty',
            key: keyName,
            value: transformedValue,
            computed,
            shorthand: isShorthand,
            method: isMethod,
            kind: prop.kind || 'init', // 'init', 'get', or 'set'
            resultType: transformedValue?.resultType,
            ilNodeType: 'ObjectProperty'
          });
        }
      }

      return {
        type: 'ObjectLiteral',
        properties,
        resultType: 'object',
        ilNodeType: 'ObjectLiteral'
      };
    }

    /**
     * Transform FunctionExpression/ArrowFunctionExpression to language-agnostic IL node
     * @private
     */
    _transformFunctionExpression(node, context) {
      const isArrow = node.type === 'ArrowFunctionExpression';
      const params = [];

      // Transform parameters
      for (const param of (node.params || [])) {
        if (param.type === 'RestElement') {
          params.push(this._transformRestElement(param, context));
        } else if (param.type === 'AssignmentPattern') {
          // Default parameter: (x = 5) => ...
          params.push({
            type: 'DefaultParameter',
            name: param.left?.name,
            left: this._transformNode(param.left, context),
            defaultValue: this._transformNode(param.right, context),
            ilNodeType: 'DefaultParameter'
          });
        } else if (param.type === 'ObjectPattern' || param.type === 'ArrayPattern') {
          // Destructuring parameter
          params.push({
            type: 'DestructuringParameter',
            pattern: param,
            ilNodeType: 'DestructuringParameter'
          });
        } else {
          params.push(this._transformNode(param, context));
        }
      }

      // Transform body
      let body = node.body;
      if (body) {
        if (body.type === 'BlockStatement') {
          // Block body - transform each statement
          body = {
            ...body,
            body: (body.body || []).map(stmt => this._transformNode(stmt, context))
          };
        } else {
          // Expression body (arrow function): () => expr
          body = this._transformNode(body, context);
        }
      }

      const result = {
        type: isArrow ? 'ArrowFunction' : 'FunctionExpression',
        params,
        body,
        async: node.async || false,
        generator: node.generator || false,
        expression: node.expression || !node.body?.type || node.body.type !== 'BlockStatement',
        resultType: 'function',
        ilNodeType: isArrow ? 'ArrowFunction' : 'FunctionExpression'
      };

      // Preserve return type annotation from stub methods or JSDoc
      if (node.returnType)
        result.returnType = node.returnType;

      // Preserve typeInfo (e.g., from stub methods)
      if (node.typeInfo)
        result.typeInfo = node.typeInfo;

      return result;
    }

    /**
     * Transform SequenceExpression (comma operator) to language-agnostic IL node
     * @private
     */
    _transformSequenceExpression(node, context) {
      const expressions = (node.expressions || []).map(expr =>
        this._transformNode(expr, context)
      );

      // Result type is the type of the last expression
      const lastExpr = expressions[expressions.length - 1];
      const resultType = lastExpr?.resultType || null;

      return {
        type: 'SequenceExpression',
        expressions,
        resultType,
        ilNodeType: 'SequenceExpression'
      };
    }

    /**
     * Transform AwaitExpression to language-agnostic IL node
     * @private
     */
    _transformAwaitExpression(node, context) {
      const argument = this._transformNode(node.argument, context);

      // Unwrap Promise type if present
      let resultType = argument?.resultType;
      if (resultType && typeof resultType === 'string') {
        if (resultType.startsWith('Promise<') && resultType.endsWith('>'))
          resultType = resultType.slice(8, -1);
      }

      return {
        type: 'AwaitExpression',
        argument,
        resultType,
        ilNodeType: 'AwaitExpression'
      };
    }

    /**
     * Transform YieldExpression to language-agnostic IL node
     * @private
     */
    _transformYieldExpression(node, context) {
      const argument = node.argument ? this._transformNode(node.argument, context) : null;

      return {
        type: 'YieldExpression',
        argument,
        delegate: node.delegate || false, // yield* vs yield
        resultType: argument?.resultType,
        ilNodeType: 'YieldExpression'
      };
    }

    // ========================[ IL AST BUILDING - IIFE VARIABLE HOISTING ]========================

    /**
     * IL AST Building Step 2.5: Hoist IIFE-computed variable initializers
     *
     * Transforms patterns like:
     *   const X = (() => { const A = ...; const B = ...; return { A, B }; })();
     * Into:
     *   const A = ...;
     *   const B = ...;
     *   const X = { A, B };
     *
     * This is necessary because most languages don't support IIFEs (Immediately Invoked
     * Function Expressions) as initializers, but need the inner variables to be accessible.
     *
     * @param {Object} ast - IL AST from previous steps
     * @returns {Object} AST with IIFE variables hoisted
     */
    hoistIIFEVariables(ast) {
      if (!ast || !ast.body) return ast;

      const newBody = [];

      for (const stmt of ast.body) {
        // Check for variable declarations with IIFE initializers
        if (stmt.type === 'VariableDeclaration') {
          const expanded = this._expandIIFEDeclarations(stmt);
          newBody.push(...expanded);
        } else {
          newBody.push(stmt);
        }
      }

      return { ...ast, body: newBody };
    }

    /**
     * Expand a VariableDeclaration that may contain IIFE initializers
     * @private
     */
    _expandIIFEDeclarations(stmt) {
      const results = [];
      const kind = stmt.kind;

      for (const decl of stmt.declarations || []) {
        // Check if the initializer is an IIFE: (() => { ... })() or (function() { ... })()
        const iife = this._extractIIFE(decl.init);
        if (iife) {
          // Extract statements and return value from the IIFE
          const { hoistedStatements, returnValue } = this._processIIFEBody(iife, kind);

          // Add hoisted statements
          results.push(...hoistedStatements);

          // Add the original variable with the return value as its initializer
          if (returnValue) {
            results.push({
              type: 'VariableDeclaration',
              kind: kind,
              declarations: [{
                type: 'VariableDeclarator',
                id: decl.id,
                init: returnValue
              }]
            });
          }
        } else {
          // Not an IIFE, keep as-is
          results.push({
            type: 'VariableDeclaration',
            kind: kind,
            declarations: [decl]
          });
        }
      }

      return results;
    }

    /**
     * Extract IIFE from an expression
     * Handles: (() => { ... })() and (function() { ... })()
     * @private
     */
    _extractIIFE(expr) {
      if (!expr || expr.type !== 'CallExpression') return null;
      if (expr.arguments && expr.arguments.length > 0) return null; // IIFEs don't take arguments

      const callee = expr.callee;
      if (!callee) return null;

      // Check for arrow function or function expression
      if (callee.type === 'ArrowFunctionExpression' || callee.type === 'FunctionExpression') {
        // Must be a no-argument function
        if (!callee.params || callee.params.length === 0) {
          return callee;
        }
      }

      return null;
    }

    /**
     * Process an IIFE body, extracting hoisted statements and return value
     * @private
     */
    _processIIFEBody(iife, kind) {
      const hoistedStatements = [];
      let returnValue = null;

      let body = iife.body;

      // Arrow function with expression body: () => expr
      if (body && body.type !== 'BlockStatement') {
        return { hoistedStatements: [], returnValue: body };
      }

      // Block body: () => { ... }
      if (!body || !body.body) {
        return { hoistedStatements: [], returnValue: null };
      }

      for (const stmt of body.body) {
        if (stmt.type === 'ReturnStatement') {
          // This is the final value - stop hoisting and capture the return
          returnValue = stmt.argument;

          // Unwrap Object.freeze(), Object.seal(), and similar wrappers
          // to get the underlying ObjectExpression
          if (returnValue && returnValue.type === 'CallExpression') {
            const callee = returnValue.callee;
            if (callee && callee.type === 'MemberExpression' &&
                callee.object && callee.object.name === 'Object' &&
                callee.property && ['freeze', 'seal', 'assign'].includes(callee.property.name)) {
              // Extract the first argument (the actual object)
              if (returnValue.arguments && returnValue.arguments.length > 0) {
                returnValue = returnValue.arguments[0];
              }
            }
          }
          break;
        } else if (stmt.type === 'VariableDeclaration') {
          // Hoist variable declarations
          hoistedStatements.push(stmt);
        } else if (stmt.type === 'FunctionDeclaration') {
          // Hoist function declarations
          hoistedStatements.push(stmt);
        } else if (stmt.type === 'ExpressionStatement') {
          // Hoist expression statements (but not side-effect-free ones)
          hoistedStatements.push(stmt);
        } else {
          // Other statements - hoist them too
          hoistedStatements.push(stmt);
        }
      }

      return { hoistedStatements, returnValue };
    }

    // ========================[ IL AST BUILDING - MODULE LOADER FILTERING ]========================

    /**
     * IL AST Building Step 2.6: Filter out JS-specific module loader functions
     *
     * Removes or stubs functions that are JS-specific and load dependencies:
     * - Functions containing 'require', 'AlgorithmFramework', '__dirname'
     * - These are JavaScript runtime functions that don't apply to other languages
     *
     * @param {Object} ast - IL AST from previous steps
     * @returns {Object} AST with module loader functions removed
     */
    filterModuleLoaderFunctions(ast) {
      if (!ast || !ast.body) return ast;

      const newBody = [];

      for (const stmt of ast.body) {
        // Check function declarations for JS-specific patterns
        if (stmt.type === 'FunctionDeclaration') {
          if (this._isJSSpecificFunction(stmt)) {
            // Skip this function entirely
            continue;
          }
        }

        // For class declarations, filter out JS-specific methods
        if (stmt.type === 'ClassDeclaration') {
          stmt.body = this._filterClassBody(stmt.body);
        }

        newBody.push(stmt);
      }

      return { ...ast, body: newBody };
    }

    /**
     * Check if a function/method contains JS-specific code
     * @private
     */
    _isJSSpecificFunction(node) {
      // For MethodDefinition nodes, check the value (FunctionExpression)
      // For FunctionDeclaration nodes, check the body directly
      let bodyToCheck = node.body;
      if (node.type === 'MethodDefinition' && node.value) {
        bodyToCheck = node.value.body || node.value;
      }

      const bodyStr = safeJSONStringify(bodyToCheck || {});

      // Patterns that indicate JS-specific runtime code
      // Note: We allow AlgorithmFramework.EnumType.VALUE references (e.g., AlgorithmFramework.CategoryType.BLOCK)
      // as these are legitimate enum accesses that should be transpiled. We only filter AlgorithmFramework
      // when used in require() or assignment patterns indicating module loading.
      const jsPatterns = [
        /\brequire\s*\(\s*['"][^'"]*AlgorithmFramework/,  // require('...AlgorithmFramework')
        /\brequire\s*\(\s*['"][^'"]*OpCodes/,             // require('...OpCodes')
        /\brequire\b/,           // Node.js require (other modules)
        /\b__dirname\b/,          // Node.js directory
        /\b__filename\b/,         // Node.js filename
        /\bmodule\.exports\b/,    // CommonJS exports
        /\bglobal\.\w+\s*=\s*require/, // global.X = require(...)
      ];

      for (const pattern of jsPatterns) {
        if (pattern.test(bodyStr)) {
          return true;
        }
      }

      return false;
    }

    /**
     * Filter methods from a class body - JS-specific methods become stubs
     * @private
     */
    _filterClassBody(classBody) {
      if (!classBody || !classBody.body) return classBody;

      classBody.body = classBody.body.map(member => {
        if (member.type === 'MethodDefinition') {
          // Check if the method is JS-specific
          if (this._isJSSpecificFunction(member)) {
            // Generate a stub method that throws an error
            return this._createStubMethod(member);
          }
        }
        return member;
      });

      return classBody;
    }

    /**
     * Create a stub method that throws a NotSupportedException
     * @private
     */
    _createStubMethod(methodNode) {
      const methodName = methodNode.key?.name || methodNode.key?.value || 'unknown';

      // Determine if the original method appears to return a value
      const hasReturnValue = this._methodHasReturnValue(methodNode.value?.body);

      // Copy the method signature but replace body with throw statement
      const stubValue = {
        ...methodNode.value,
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ThrowStatement',
            argument: {
              type: 'NewExpression',
              callee: { type: 'Identifier', name: 'Error' },
              arguments: [{
                type: 'Literal',
                value: `Method '${methodName}' requires JavaScript runtime features (require/module loading) and cannot be transpiled to other languages.`,
                raw: `"Method '${methodName}' requires JavaScript runtime features (require/module loading) and cannot be transpiled to other languages."`
              }]
            }
          }]
        }
      };

      // Add type info for return type if the method returns something
      if (hasReturnValue) {
        stubValue.typeInfo = { returns: 'object' };
        stubValue.returnType = 'object';
      }

      return {
        ...methodNode,
        value: stubValue
      };
    }

    /**
     * Check if a method body contains return statements with values
     * @private
     */
    _methodHasReturnValue(body) {
      if (!body) return false;
      const bodyStr = safeJSONStringify(body);
      // Check for return statements that have an argument (not just "return;")
      return /ReturnStatement.*"argument":\s*\{/.test(bodyStr);
    }

    // ========================[ IL AST BUILDING - SYNTAX FLATTENING ]========================

    /**
     * IL AST Building Step 2: Flatten method definition patterns
     *
     * Normalizes different JavaScript method definition styles into unified MethodDefinition nodes:
     *   1. Prototype methods: ClassName.prototype.methodName = function() {...}
     *   2. Constructor function assignments: this.methodName = function() {...}
     *   3. Function constructor patterns: function ClassName() {} + prototype methods
     *
     * This is part of the JS AST → IL AST transformation (Phase 2).
     *
     * @param {Object} ast - JS AST (or partially transformed IL AST)
     * @returns {Object} AST with flattened method definitions
     */
    flattenMethodDefinitions(ast) {
      if (!ast || !ast.body) return ast;

      // Build a map of class names to their ClassDeclaration nodes
      const classMap = new Map();
      for (const stmt of ast.body) {
        if (stmt.type === 'ClassDeclaration' && stmt.id?.name) {
          classMap.set(stmt.id.name, stmt);
        }
      }

      // Also track function constructor patterns: function ClassName() {...}
      const functionConstructorMap = new Map();
      for (const stmt of ast.body) {
        if (stmt.type === 'FunctionDeclaration' && stmt.id?.name) {
          // Check if function name starts with uppercase (convention for constructor functions)
          const name = stmt.id.name;
          if (name[0] === name[0].toUpperCase()) {
            functionConstructorMap.set(name, stmt);
          }
        }
      }

      // Collect prototype assignments to process and remove
      const prototypeAssignments = [];
      const statementsToKeep = [];

      for (const stmt of ast.body) {
        const protoInfo = this.extractPrototypeAssignment(stmt);
        if (protoInfo) {
          prototypeAssignments.push({ stmt, ...protoInfo });
        } else {
          statementsToKeep.push(stmt);
        }
      }

      // Process prototype assignments
      for (const { className, methodName, functionExpr } of prototypeAssignments) {
        // Create a MethodDefinition node
        const methodDef = {
          type: 'MethodDefinition',
          kind: 'method',
          static: false,
          computed: false,
          key: { type: 'Identifier', name: methodName },
          value: functionExpr
        };

        // Try to add to existing class
        if (classMap.has(className)) {
          const classDecl = classMap.get(className);
          if (classDecl.body?.body) {
            classDecl.body.body.push(methodDef);
          } else if (classDecl.body && Array.isArray(classDecl.body)) {
            classDecl.body.push(methodDef);
          }
        }
        // If class doesn't exist but there's a constructor function, synthesize a class
        else if (functionConstructorMap.has(className)) {
          const constructorFunc = functionConstructorMap.get(className);

          // Create a synthetic ClassDeclaration
          const syntheticClass = {
            type: 'ClassDeclaration',
            id: { type: 'Identifier', name: className },
            superClass: null,
            body: {
              type: 'ClassBody',
              body: [
                // Convert the constructor function to a constructor method
                {
                  type: 'MethodDefinition',
                  kind: 'constructor',
                  static: false,
                  computed: false,
                  key: { type: 'Identifier', name: 'constructor' },
                  value: {
                    type: 'FunctionExpression',
                    params: constructorFunc.params || [],
                    body: constructorFunc.body,
                    async: false,
                    generator: false
                  }
                },
                methodDef
              ]
            }
          };

          // Add to class map and replace the function with the class
          classMap.set(className, syntheticClass);

          // Remove the original function from statements and add the class
          const funcIndex = statementsToKeep.findIndex(s => s === constructorFunc);
          if (funcIndex >= 0) {
            statementsToKeep[funcIndex] = syntheticClass;
          }

          // Remove from function map so we don't process it again
          functionConstructorMap.delete(className);
        }
      }

      // Synthesize classes for remaining constructor functions (no prototype methods)
      // that have this.X = ... assignments in their body (e.g., function State() { this.S = [0,0,0,0]; })
      for (const [className, constructorFunc] of functionConstructorMap) {
        const hasThisAssign = (constructorFunc.body?.body || []).some(s =>
          s.type === 'ExpressionStatement' &&
          s.expression?.type === 'AssignmentExpression' &&
          s.expression.left?.type === 'MemberExpression' &&
          s.expression.left.object?.type === 'ThisExpression'
        );
        if (hasThisAssign) {
          const syntheticClass = {
            type: 'ClassDeclaration',
            id: { type: 'Identifier', name: className },
            superClass: null,
            body: {
              type: 'ClassBody',
              body: [
                {
                  type: 'MethodDefinition',
                  kind: 'constructor',
                  static: false,
                  computed: false,
                  key: { type: 'Identifier', name: 'constructor' },
                  value: {
                    type: 'FunctionExpression',
                    params: constructorFunc.params || [],
                    body: constructorFunc.body,
                    async: false,
                    generator: false
                  }
                }
              ]
            }
          };
          classMap.set(className, syntheticClass);
          const funcIndex = statementsToKeep.findIndex(s => s === constructorFunc);
          if (funcIndex >= 0) {
            statementsToKeep[funcIndex] = syntheticClass;
          }
        }
      }

      // Now process this.methodName = function inside constructors
      for (const stmt of statementsToKeep) {
        if (stmt.type === 'ClassDeclaration') {
          this.flattenConstructorFunctionAssignments(stmt);
        }
      }

      ast.body = statementsToKeep;
      return ast;
    }

    /**
     * Extract prototype assignment information from a statement
     * Pattern: ClassName.prototype.methodName = function(...) {...}
     * @param {Object} stmt - Statement node
     * @returns {Object|null} { className, methodName, functionExpr } or null
     */
    extractPrototypeAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return null;

      const expr = stmt.expression;
      if (expr?.type !== 'AssignmentExpression' || expr.operator !== '=') return null;

      const left = expr.left;
      const right = expr.right;

      // Check for MemberExpression pattern: X.prototype.Y
      if (left?.type !== 'MemberExpression') return null;

      // left should be X.prototype.Y which means:
      // left.object = X.prototype (another MemberExpression)
      // left.property = Y (Identifier for method name)
      const protoAccess = left.object;
      const methodNameNode = left.property;

      if (protoAccess?.type !== 'MemberExpression') return null;
      if (protoAccess.property?.name !== 'prototype' && protoAccess.property?.value !== 'prototype') return null;

      // Extract class name from X.prototype
      const classNameNode = protoAccess.object;
      if (classNameNode?.type !== 'Identifier') return null;

      // Extract method name
      const methodName = methodNameNode?.name || methodNameNode?.value;
      if (!methodName) return null;

      // Right side should be a function expression
      if (right?.type !== 'FunctionExpression' && right?.type !== 'ArrowFunctionExpression') return null;

      return {
        className: classNameNode.name,
        methodName: methodName,
        functionExpr: right
      };
    }

    /**
     * Flatten this.methodName = function assignments inside class constructors
     * Converts them to proper MethodDefinitions
     * @param {Object} classDecl - ClassDeclaration node
     */
    flattenConstructorFunctionAssignments(classDecl) {
      const classBody = classDecl.body?.body || classDecl.body || [];

      // Find the constructor
      const constructorIndex = classBody.findIndex(member =>
        member.type === 'MethodDefinition' && member.kind === 'constructor'
      );

      if (constructorIndex === -1) return;

      const constructor = classBody[constructorIndex];
      const constructorBody = constructor.value?.body?.body || [];

      // Collect methods to extract and statements to keep
      const methodsToAdd = [];
      const statementsToKeep = [];

      for (const stmt of constructorBody) {
        const methodInfo = this.extractThisFunctionAssignment(stmt);
        if (methodInfo) {
          // Create a MethodDefinition
          const methodDef = {
            type: 'MethodDefinition',
            kind: 'method',
            static: false,
            computed: false,
            key: { type: 'Identifier', name: methodInfo.methodName },
            value: methodInfo.functionExpr
          };
          methodsToAdd.push(methodDef);
        } else {
          statementsToKeep.push(stmt);
        }
      }

      // Update constructor body
      if (constructor.value?.body?.body) {
        constructor.value.body.body = statementsToKeep;
      }

      // Add extracted methods to class body
      for (const method of methodsToAdd) {
        classBody.push(method);
      }
    }

    /**
     * Extract this.methodName = function assignment from a statement
     * Pattern: this.methodName = function(...) {...}
     * @param {Object} stmt - Statement node
     * @returns {Object|null} { methodName, functionExpr } or null
     */
    extractThisFunctionAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return null;

      const expr = stmt.expression;
      if (expr?.type !== 'AssignmentExpression' || expr.operator !== '=') return null;

      const left = expr.left;
      const right = expr.right;

      // Check for this.X = function pattern
      if (left?.type !== 'MemberExpression') return null;
      if (left.object?.type !== 'ThisExpression') return null;

      const methodName = left.property?.name || left.property?.value;
      if (!methodName) return null;

      // Right side should be a function expression
      if (right?.type !== 'FunctionExpression' && right?.type !== 'ArrowFunctionExpression') return null;

      return {
        methodName: methodName,
        functionExpr: right
      };
    }

    // ========================[ IL AST BUILDING - MODULE UNWRAPPING ]========================

    /**
     * IL AST Building Step 1: Unwrap module patterns
     *
     * Extracts the actual code from UMD (Universal Module Definition) and IIFE wrappers.
     * These patterns are commonly used for browser/Node.js compatibility but obscure the
     * actual algorithm code.
     *
     * Supported patterns:
     *   - UMD: (function(root, factory) { ... })(globalThis, function(deps) { ...code... })
     *   - IIFE: (function() { ...code... })()
     *   - CommonJS wrapper: (function(exports) { ...code... })(module.exports)
     *
     * This is part of the JS AST → IL AST transformation (Phase 2).
     *
     * @param {Object} ast - JS AST from Phase 1
     * @returns {Object} Unwrapped AST or original if not a module pattern
     */
    unwrapModulePatterns(ast) {
      if (!ast || !ast.body || ast.body.length === 0) return ast;

      // Filter out non-essential statements:
      // - Empty statements
      // - String literals (like "use strict")
      // - Module loader patterns: if (!global.X && typeof require !== 'undefined') { global.X = require(...) }
      const mainStatements = ast.body.filter(stmt => {
        if (stmt.type === 'EmptyStatement') return false;
        if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'Literal') return false;
        // Filter out module loader patterns: if (!global.AlgorithmFramework ...) { ... }
        if (stmt.type === 'IfStatement' && this._isModuleLoaderPattern(stmt)) return false;
        return true;
      });

      if (mainStatements.length !== 1) return ast;

      const stmt = mainStatements[0];

      // Pattern 1: ExpressionStatement containing CallExpression
      if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'CallExpression') {
        // Try UMD pattern first (2-parameter factory pattern)
        let unwrapped = this.tryUnwrapUMD(stmt.expression);
        if (unwrapped) {
          console.error('📦 Unwrapped UMD module pattern');
          return unwrapped;
        }

        // Try simple IIFE pattern: (function(global) { ... })(this)
        unwrapped = this.tryUnwrapSimpleIIFE(stmt.expression);
        if (unwrapped) {
          console.error('📦 Unwrapped IIFE module pattern');
          return unwrapped;
        }
      }

      return ast;
    }

    /**
     * Try to unwrap a simple IIFE pattern: (function(global) { ... })(this)
     * @param {Object} callExpr - CallExpression AST node
     * @returns {Object|null} Unwrapped Program AST or null if not an IIFE pattern
     */
    tryUnwrapSimpleIIFE(callExpr) {
      const callee = callExpr.callee;

      // Callee must be a FunctionExpression
      if (!callee || callee.type !== 'FunctionExpression') return null;

      // Simple IIFE typically has 0-1 parameters (e.g., 'global')
      const wrapperParams = callee.params || [];
      if (wrapperParams.length > 1) return null;

      // Extract the function body
      const body = callee.body;
      if (!body || body.type !== 'BlockStatement') return null;

      const statements = body.body || [];

      // Filter out "use strict" directives and module loader patterns
      const filteredStatements = statements.filter(stmt => {
        // Skip "use strict"
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression?.type === 'Literal' &&
            stmt.expression?.value === 'use strict') {
          return false;
        }

        // Skip global export patterns: global.X = Y or global['X'] = Y
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression?.type === 'AssignmentExpression') {
          const left = stmt.expression.left;
          // global.X = Y pattern
          if (left?.type === 'MemberExpression' &&
              left?.object?.type === 'Identifier' &&
              (left?.object?.name === 'global' || left?.object?.name === 'globalThis')) {
            return false;
          }
        }

        // Skip module loader patterns: if (!global.X && typeof require !== 'undefined') ...
        if (this._isModuleLoaderPattern(stmt)) {
          return false;
        }

        // Skip require statements for external dependencies
        if (stmt.type === 'IfStatement' &&
            stmt.consequent?.type === 'BlockStatement' &&
            stmt.consequent.body?.[0]?.type === 'ExpressionStatement' &&
            stmt.consequent.body[0].expression?.type === 'CallExpression' &&
            stmt.consequent.body[0].expression.callee?.name === 'require') {
          return false;
        }

        // Skip destructuring from AlgorithmFramework
        if (stmt.type === 'VariableDeclaration') {
          const decl = stmt.declarations?.[0];
          if (decl?.id?.type === 'ObjectPattern' &&
              decl?.init?.type === 'Identifier' &&
              decl?.init?.name === 'AlgorithmFramework') {
            // Store framework imports for reference
            this.frameworkImports = new Set();
            for (const prop of decl.id.properties || []) {
              if (prop.key?.name) {
                this.frameworkImports.add(prop.key.name);
              }
            }
            return false;
          }
          // Skip global references: const X = global.X or const X = global.OpCodes
          if (decl?.init?.type === 'MemberExpression' &&
              decl?.init?.object?.name === 'global') {
            const propName = decl?.init?.property?.name;
            if (propName === 'OpCodes' || propName === 'AlgorithmFramework') {
              return false;
            }
          }
        }

        return true;
      });

      // Return the unwrapped program
      return {
        type: 'Program',
        body: filteredStatements,
        isUnwrappedModule: true,
      };
    }

    /**
     * Check if a statement is a module loader pattern like:
     * if (!global.AlgorithmFramework && typeof require !== 'undefined') {
     *   global.AlgorithmFramework = require('...');
     * }
     * @private
     */
    _isModuleLoaderPattern(stmt) {
      if (stmt.type !== 'IfStatement') return false;
      const test = stmt.test;
      if (!test) return false;

      // Check for patterns involving 'global.X' or 'typeof require'
      const testStr = this._nodeToString(test);
      if (!testStr) return false;

      // Common module loader patterns
      // Pattern 1: if (!global.X && typeof require !== 'undefined')
      if (testStr.includes('global.') && (testStr.includes('require') || testStr.includes('typeof'))) {
        return true;
      }
      // Pattern 2: if (typeof require !== 'undefined') - simple require check
      if (testStr.includes('typeof require') || testStr.includes('typeof(require)')) {
        return true;
      }
      // Pattern 3: if (!global.X) - simple global check (often contains nested require checks)
      // This catches patterns like: if (!global.AlgorithmFramework) { if (typeof require...) }
      if (testStr.match(/^!global\.\w+$/) || testStr.match(/^!global\[/)) {
        return true;
      }
      // Pattern 4: if (global.Cipher) or if (global.X && ...) - registration patterns
      if (testStr.match(/^global\.\w+$/) || testStr.match(/^global\[/)) {
        return true;
      }
      return false;
    }

    /**
     * Simple node-to-string for pattern detection
     * @private
     */
    _nodeToString(node) {
      if (!node) return '';
      switch (node.type) {
        case 'Identifier':
          return node.name;
        case 'MemberExpression':
          return this._nodeToString(node.object) + '.' + this._nodeToString(node.property);
        case 'UnaryExpression':
          return node.operator + this._nodeToString(node.argument);
        case 'BinaryExpression':
        case 'LogicalExpression':
          return this._nodeToString(node.left) + ' ' + node.operator + ' ' + this._nodeToString(node.right);
        case 'Literal':
          return String(node.value);
        default:
          return safeJSONStringify(node).substring(0, 50);
      }
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
          // This is likely the factory function (may have 0 or more parameters)
          // Some UMD patterns use dependencies via global scope rather than parameters
          factoryFn = arg;
          break;
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
        // Skip "use strict"
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression?.type === 'Literal' &&
            stmt.expression?.value === 'use strict') {
          return false;
        }

        // Skip dependency validation: if (!Dependency) throw ...
        // Handles both direct throw and throw in block
        if (stmt.type === 'IfStatement' &&
            stmt.test?.type === 'UnaryExpression' &&
            stmt.test?.operator === '!') {
          const consequent = stmt.consequent;
          if (consequent?.type === 'ThrowStatement') {
            return false;
          }
          // Also check for throw inside a block: if (...) { throw ...; }
          if (consequent?.type === 'BlockStatement' &&
              consequent.body?.length === 1 &&
              consequent.body[0]?.type === 'ThrowStatement') {
            return false;
          }
        }

        // Skip module loader patterns: if (!global.X && typeof require !== 'undefined') { global.X = require(...) }
        if (stmt.type === 'IfStatement') {
          // Check if this is a module loader pattern by examining the test condition
          const test = stmt.test;
          let isModuleLoader = false;

          // Pattern 1: LogicalExpression with global.X and typeof require check
          if (test?.type === 'LogicalExpression') {
            const left = test.left;
            const right = test.right;
            // Check for !global.X pattern on either side
            if ((left?.type === 'UnaryExpression' && left?.operator === '!' &&
                 left?.argument?.type === 'MemberExpression' &&
                 left?.argument?.object?.name === 'global') ||
                (right?.type === 'UnaryExpression' && right?.operator === '!' &&
                 right?.argument?.type === 'MemberExpression' &&
                 right?.argument?.object?.name === 'global')) {
              isModuleLoader = true;
            }
            // Check for typeof require pattern
            const testStr = this._nodeToString(test);
            if (testStr?.includes('typeof require')) {
              isModuleLoader = true;
            }
          }

          // Pattern 2: Simple !global.X or !AlgorithmFramework check
          if (test?.type === 'UnaryExpression' && test?.operator === '!' &&
              test?.argument?.type === 'MemberExpression' &&
              test?.argument?.object?.name === 'global') {
            isModuleLoader = true;
          }

          // Pattern 3: Simple typeof require !== 'undefined' check (BinaryExpression)
          if (test?.type === 'BinaryExpression') {
            const testStr = this._nodeToString(test);
            if (testStr?.includes('typeof require')) {
              isModuleLoader = true;
            }
          }

          if (isModuleLoader) {
            return false;
          }
        }

        return true;
      });

      // Skip destructuring from AlgorithmFramework (const { ... } = AlgorithmFramework)
      // These are framework imports that need different handling
      // Also skip return statements (module exports in UMD pattern)
      const processedStatements = filteredStatements.filter(stmt => {
        // Skip return statements - these are module exports in UMD pattern
        if (stmt.type === 'ReturnStatement')
          return false;

        if (stmt.type === 'VariableDeclaration') {
          const decl = stmt.declarations?.[0];
          // Skip destructuring from AlgorithmFramework: const { ... } = AlgorithmFramework
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
          // Skip global references: const X = global.X or const X = global.OpCodes
          if (decl?.init?.type === 'MemberExpression' &&
              decl?.init?.object?.name === 'global') {
            const propName = decl?.init?.property?.name;
            if (propName === 'OpCodes' || propName === 'AlgorithmFramework') {
              return false;
            }
          }
          // Skip global scope detection IIFE: var global = (function() { ... return this; })()
          if (decl?.id?.name === 'global' &&
              decl?.init?.type === 'CallExpression' &&
              (decl?.init?.callee?.type === 'FunctionExpression' ||
               decl?.init?.callee?.type === 'ArrowFunctionExpression')) {
            return false;
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
      // Check for JSDoc return type first (highest priority)
      if (funcNode.typeInfo && funcNode.typeInfo.returns)
        return funcNode.typeInfo.returns;

      // Analyze actual return statements in function body
      const body = funcNode.body || funcNode.value?.body;
      if (!body) return 'void';

      const returnTypes = [];
      let hasVoidReturn = false;

      const collectReturnTypes = (node) => {
        if (!node || typeof node !== 'object') return;

        if (node.type === 'ReturnStatement') {
          if (!node.argument) {
            hasVoidReturn = true;
          } else {
            const retType = this.inferExpressionType(node.argument, { funcNode });
            // Extract type name - inferExpressionType returns { name: 'typeName' } objects
            const typeName = retType?.name || (typeof retType === 'string' ? retType : null);
            if (typeName && typeName !== 'object' && typeName !== 'unknown')
              returnTypes.push(typeName);
            else {
              // Try pattern-based inference from return expression
              const patternType = this._inferReturnTypeFromExpression(node.argument);
              if (patternType)
                returnTypes.push(patternType);
            }
          }
          return; // Don't recurse into nested functions from return
        }

        // Don't analyze nested function declarations
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' ||
            node.type === 'ArrowFunctionExpression')
          return;

        // Recurse into child nodes
        for (const key in node) {
          if (key === 'type' || key === 'loc' || key === 'range') continue;
          const child = node[key];
          if (Array.isArray(child))
            child.forEach(collectReturnTypes);
          else if (child && typeof child === 'object')
            collectReturnTypes(child);
        }
      };

      collectReturnTypes(body);

      // Determine final return type
      if (returnTypes.length === 0)
        return hasVoidReturn ? 'void' : 'object';

      // Filter unique types
      const uniqueTypes = [...new Set(returnTypes)];
      if (uniqueTypes.length === 1)
        return uniqueTypes[0];

      // Multiple types - try to find common base or use first non-object type
      // Ensure we only process string types (filter out any non-strings that might have gotten in)
      const nonObjectTypes = uniqueTypes.filter(t => typeof t === 'string' && t !== 'object' && t !== 'unknown');
      if (nonObjectTypes.length === 1)
        return nonObjectTypes[0];

      // Check for numeric type hierarchy (normalize legacy aliases to IL vocabulary)
      const numericTypes = ['byte', 'uint8', 'word', 'uint16', 'dword', 'uint32', 'qword', 'uint64', 'int', 'int32', 'long', 'int64'];
      const foundNumeric = nonObjectTypes.filter(t => numericTypes.includes(t));
      if (foundNumeric.length > 0) {
        // Return the widest numeric type, normalized to IL vocabulary
        const typeOrder = { 'byte': 0, 'uint8': 0, 'word': 1, 'uint16': 1, 'dword': 2, 'uint32': 2, 'int': 2, 'int32': 2, 'qword': 3, 'uint64': 3, 'long': 3, 'int64': 3 };
        const toIL = { 'byte': 'uint8', 'word': 'uint16', 'dword': 'uint32', 'qword': 'uint64', 'int': 'int32', 'long': 'int64' };
        foundNumeric.sort((a, b) => (typeOrder[b] || 0) - (typeOrder[a] || 0));
        const widest = foundNumeric[0];
        return toIL[widest] || widest;
      }

      // Array types take precedence
      const arrayType = nonObjectTypes.find(t => typeof t === 'string' && (t.includes('[]') || t.startsWith('Array')));
      if (arrayType) return arrayType;

      return nonObjectTypes[0] || 'object';
    }

    /**
     * Infer return type from expression patterns
     */
    _inferReturnTypeFromExpression(expr) {
      if (!expr) return null;

      // Literal values
      if (expr.type === 'Literal') {
        if (typeof expr.value === 'boolean') return 'boolean';
        if (typeof expr.value === 'string') return 'string';
        if (typeof expr.value === 'number') {
          if (Number.isInteger(expr.value)) {
            if (expr.value >= 0 && expr.value <= 255) return 'uint8';
            if (expr.value >= 0 && expr.value <= 65535) return 'uint16';
            if (expr.value >= 0 && expr.value <= 4294967295) return 'uint32';
            return 'int32';
          }
          return 'double';
        }
        if (expr.value === null) return 'null';
      }

      // Array expression
      if (expr.type === 'ArrayExpression') {
        if (expr.elements && expr.elements.length > 0) {
          const elemType = this._inferReturnTypeFromExpression(expr.elements[0]);
          if (elemType) return elemType + '[]';
        }
        return 'byte[]';
      }

      // New expression (constructor call)
      if (expr.type === 'NewExpression') {
        const calleeName = expr.callee?.name;
        if (calleeName === 'Uint8Array') return 'uint8[]';
        if (calleeName === 'Uint16Array') return 'uint16[]';
        if (calleeName === 'Uint32Array') return 'uint32[]';
        if (calleeName === 'Int8Array') return 'int8[]';
        if (calleeName === 'Int16Array') return 'int16[]';
        if (calleeName === 'Int32Array') return 'int32[]';
        if (calleeName === 'Array') return 'object[]';
        if (calleeName) return calleeName;
      }

      // This member access - common patterns
      if (expr.type === 'MemberExpression' && expr.object?.type === 'ThisExpression') {
        const propName = expr.property?.name || expr.property?.value;
        if (propName) {
          const lowerName = propName.toLowerCase();
          if (lowerName.includes('state') || lowerName.includes('key') || lowerName.includes('block'))
            return 'uint8[]';
          if (lowerName.includes('size') || lowerName.includes('length') || lowerName.includes('count'))
            return 'int32';
        }
      }

      // Binary expressions with bitwise operators
      if (expr.type === 'BinaryExpression') {
        if (['&', '|', '^', '<<', '>>', '>>>'].includes(expr.operator)) {
          // Check for masking patterns
          if (expr.operator === '&' && expr.right?.type === 'Literal') {
            const mask = expr.right.value;
            if (mask === 0xFF) return 'uint8';
            if (mask === 0xFFFF) return 'uint16';
            if (mask === 0xFFFFFFFF) return 'uint32';
          }
          return 'uint32';
        }
        if (['+', '-', '*', '/', '%'].includes(expr.operator))
          return 'int32';
        if (['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(expr.operator))
          return 'boolean';
        if (['&&', '||'].includes(expr.operator))
          return 'boolean';
      }

      // Call expressions - check method names
      if (expr.type === 'CallExpression') {
        if (expr.callee?.type === 'MemberExpression') {
          const methodName = expr.callee.property?.name;
          if (methodName) {
            if (['slice', 'concat', 'map', 'filter'].includes(methodName)) return 'uint8[]';
            if (['join'].includes(methodName)) return 'string';
            if (['indexOf', 'findIndex', 'length'].includes(methodName)) return 'int32';
            if (['includes', 'every', 'some'].includes(methodName)) return 'boolean';
          }
          // OpCodes calls
          if (expr.callee.object?.name === 'OpCodes') {
            const opName = expr.callee.property?.name;
            if (opName) {
              if (opName.startsWith('RotL') || opName.startsWith('RotR')) return 'uint32';
              if (opName.includes('Pack') || opName.includes('32')) return 'uint32';
              if (opName.includes('Unpack') || opName.includes('ToBytes')) return 'uint8[]';
              if (opName.includes('Hex') && opName.includes('Bytes')) return 'uint8[]';
            }
          }
        }
      }

      // Identifier - check variable name patterns
      if (expr.type === 'Identifier') {
        const name = expr.name.toLowerCase();
        if (name.includes('result') || name.includes('output') || name.includes('hash'))
          return 'uint8[]';
        if (name.includes('size') || name.includes('length') || name.includes('index'))
          return 'int32';
        if (name.includes('flag') || name.includes('valid') || name.includes('ok'))
          return 'boolean';
      }

      return null;
    }

    /**
     * Helper to extract JSDoc parameter type
     */
    _extractJSDocParamType(funcNode, paramName) {
      if (funcNode.typeInfo && funcNode.typeInfo.params) {
        // Handle both Map and plain object params
        const params = funcNode.typeInfo.params;
        if (params instanceof Map)
          return params.get(paramName);
        if (typeof params === 'object' && params !== null)
          return params[paramName];
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
        case 'IDENTIFIER':
          // Check for labeled statement (identifier followed by colon)
          if (this.tokens[this.position + 1] &&
              this.tokens[this.position + 1].type === 'PUNCTUATION' &&
              this.tokens[this.position + 1].value === ':') {
            return this.parseLabeledStatement();
          }
          return this.parseExpressionStatement();
        default:
          return this.parseExpressionStatement();
      }
    }

    /**
     * Parse labeled statement (e.g., label: for (...) { ... })
     */
    parseLabeledStatement() {
      const node = { type: 'LabeledStatement' };
      node.label = this.parseIdentifier();
      this.consume('PUNCTUATION', ':');
      this.skipComments();
      node.body = this.parseStatement();
      return node;
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

      // Use standard Acorn format: { type: 'ClassBody', body: [...] }
      const members = [];
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        this.skipComments(); // Skip any comments before class members

        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}') {
          break; // Exit if we encounter closing brace after skipping comments
        }

        const member = this.parseClassMember();
        if (member) {
          members.push(member);
        }
      }

      // Create ClassBody node to match Acorn's structure
      node.body = {
        type: 'ClassBody',
        body: members
      };

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

      // Use standard Acorn format: { type: 'ClassBody', body: [...] }
      const members = [];
      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        const method = this.parseClassMethod();
        if (method) {
          members.push(method);
        }
      }

      // Create ClassBody node to match Acorn's structure
      node.body = {
        type: 'ClassBody',
        body: members
      };

      this.consume('PUNCTUATION', '}');

      return node;
    }

    /**
     * Parse a class member (method or field)
     */
    parseClassMember() {
      // Consume JSDoc before parsing class member
      const jsDoc = this.consumeJSDoc();

      // Look ahead to determine if this is a field declaration or method
      let lookahead = this.position;

      // Check for static initialization block: static { ... }
      if (this.tokens[lookahead] && this.tokens[lookahead].type === 'KEYWORD' && this.tokens[lookahead].value === 'static') {
        const nextToken = this.tokens[lookahead + 1];
        if (nextToken && nextToken.type === 'PUNCTUATION' && nextToken.value === '{')
          // This is a static initialization block
          return this.parseStaticBlock();

        lookahead++; // Move past 'static'
      }

      // Look for identifier followed by = (field) or ( (method)
      if (lookahead < this.tokens.length - 1) {
        const identifierToken = this.tokens[lookahead];
        const nextToken = this.tokens[lookahead + 1];

        if (identifierToken && identifierToken.type === 'IDENTIFIER' &&
            nextToken && nextToken.type === 'OPERATOR' && nextToken.value === '=') {
          // This is a field declaration like: static FIELD = value;
          const field = this.parseClassField();
          if (jsDoc) {
            field.jsDoc = jsDoc;
            // If JSDoc has @type, store it
            if (jsDoc.type)
              this.typeAnnotations.set(field, { type: jsDoc.type, source: 'jsdoc' });
          }
          return field;
        }
      }

      // Otherwise, it's a method
      const method = this.parseClassMethod();

      // Attach JSDoc to method
      if (jsDoc && method.value) {
        method.jsDoc = jsDoc;
        method.value.jsDoc = jsDoc;
        method.value.typeInfo = {
          params: new Map(jsDoc.params.map(p => [p.name, p.type])),
          returns: jsDoc.returns ? jsDoc.returns.type : null,
          csharpOverride: jsDoc.csharpOverride || null
        };

        // Attach type info to method parameters
        if (method.value.params) {
          method.value.params.forEach((param, index) => {
            if (jsDoc.params[index] && param.type === 'Identifier') {
              this.typeAnnotations.set(param, {
                type: jsDoc.params[index].type,
                source: 'jsdoc'
              });
            }
          });
        }

        // Store return type in type annotations
        if (jsDoc.returns)
          this.typeAnnotations.set(method.value, { type: jsDoc.returns.type, source: 'jsdoc' });
      }

      return method;
    }

    /**
     * Parse static initialization block: static { ... }
     */
    parseStaticBlock() {
      const node = { type: 'StaticBlock', body: [] };

      // Consume 'static'
      this.consume('KEYWORD', 'static');

      // Parse the block body
      node.body = this.parseBlockStatement();

      return node;
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
        } else if (this.currentToken.value === 'get' || this.currentToken.value === 'set') {
          // Look ahead to determine if this is a getter/setter or a method named "get"/"set"
          const nextToken = this.tokens[this.position + 1];
          if (nextToken && nextToken.type === 'IDENTIFIER') {
            // It's a getter/setter (e.g., "get propertyName()" or "set propertyName(value)")
            node.kind = this.currentToken.value;
            this.advance();
          } else if (nextToken && nextToken.type === 'PUNCTUATION' && nextToken.value === '(') {
            // It's a method named "get" or "set" (e.g., "get()" or "set(args)")
            // Don't treat as getter/setter, exit loop to let it be parsed as method name
            break;
          } else {
            // Default: treat as getter/setter keyword
            node.kind = this.currentToken.value;
            this.advance();
          }
        } else {
          break; // Exit if we encounter a keyword that's not a modifier
        }
      }
      
      if (!node.kind) {
        node.kind = 'method';
      }
      
      // Constructor or method name (can be identifier, 'constructor', or 'get'/'set' as method names)
      if (this.currentToken && (this.currentToken.type === 'IDENTIFIER' ||
          (this.currentToken.type === 'KEYWORD' &&
           (this.currentToken.value === 'constructor' || this.currentToken.value === 'get' || this.currentToken.value === 'set')))) {
        if (this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'constructor') {
          node.key = { type: 'Identifier', name: 'constructor' };
          node.kind = 'constructor';
          this.advance();
        } else if (this.currentToken.type === 'KEYWORD' && (this.currentToken.value === 'get' || this.currentToken.value === 'set')) {
          // Method named "get" or "set" (not a getter/setter)
          node.key = { type: 'Identifier', name: this.currentToken.value };
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
     * Parse object pattern for destructuring {a, b, c} or {a: renamed, b: renamed2}
     */
    parseObjectPattern() {
      const node = { type: 'ObjectPattern', properties: [] };

      this.consume('PUNCTUATION', '{');

      while (this.currentToken && !(this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}')) {
        this.skipComments();

        // Check for closing brace after skipping comments
        if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '}') {
          break;
        }

        const property = { type: 'Property' };

        if (this.currentToken.type === 'IDENTIFIER') {
          const key = this.parseIdentifier();
          property.key = key;

          this.skipComments();

          // Check for renamed property: { originalName: newName }
          if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ':') {
            this.advance(); // consume ':'
            this.skipComments();

            // The value can be an identifier or nested pattern
            if (this.currentToken.type === 'IDENTIFIER') {
              property.value = this.parseIdentifier();
            } else if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '{') {
              property.value = this.parseObjectPattern();
            } else if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '[') {
              property.value = this.parseArrayPattern();
            } else {
              throw new Error(`Expected identifier or pattern after ':' in object pattern, got: ${this.currentToken.type}`);
            }
            property.shorthand = false;
          } else {
            // Shorthand property: { a } means { a: a }
            property.value = { type: 'Identifier', name: key.name };
            property.shorthand = true;
          }

          // Check for default value: { a = default } or { a: b = default }
          this.skipComments();
          if (this.currentToken && this.currentToken.type === 'OPERATOR' && this.currentToken.value === '=') {
            this.advance(); // consume '='
            this.skipComments();
            const defaultValue = this.parseAssignmentExpression();
            // Wrap value in AssignmentPattern
            property.value = {
              type: 'AssignmentPattern',
              left: property.value,
              right: defaultValue
            };
          }
        } else {
          throw new Error(`Expected identifier in object pattern, got: ${this.currentToken.type}`);
        }

        node.properties.push(property);

        this.skipComments();
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
          // Use parseAssignmentExpression instead of parseExpression to avoid consuming
          // the comma that separates variable declarators (e.g., const a = 1, b = 2)
          declarator.init = this.parseAssignmentExpression();
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
      // Consume JSDoc before parsing function
      const jsDoc = this.consumeJSDoc();

      const node = { type: 'FunctionDeclaration' };

      this.consume('KEYWORD', 'function');
      node.id = this.parseIdentifier();
      node.params = this.parseParameterList();
      node.body = this.parseBlockStatement();

      // Attach JSDoc type information if available
      if (jsDoc) {
        node.jsDoc = jsDoc;
        node.typeInfo = {
          params: new Map(jsDoc.params.map(p => [p.name, p.type])),
          returns: jsDoc.returns ? jsDoc.returns.type : null,
          csharpOverride: jsDoc.csharpOverride || null
        };

        // Attach type info to function parameters
        if (node.params) {
          node.params.forEach((param, index) => {
            if (jsDoc.params[index] && param.type === 'Identifier') {
              this.typeAnnotations.set(param, {
                type: jsDoc.params[index].type,
                source: 'jsdoc'
              });
            }
          });
        }

        // Store return type in type annotations
        if (jsDoc.returns)
          this.typeAnnotations.set(node, { type: jsDoc.returns.type, source: 'jsdoc' });
      }

      return node;
    }

    /**
     * Parse function expression
     */
    parseFunctionExpression() {
      // Consume JSDoc before parsing function expression
      const jsDoc = this.consumeJSDoc();

      const node = { type: 'FunctionExpression' };

      if (this.currentToken && this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'function')
        this.advance();

      // Handle optional function name (named function expression)
      if (this.currentToken && this.currentToken.type === 'IDENTIFIER') {
        node.id = this.parseIdentifier();
      } else {
        node.id = null;
      }

      node.params = this.parseParameterList();

      if (this.currentToken && this.currentToken.type === 'ARROW') {
        node.type = 'ArrowFunctionExpression';
        this.advance();
      }

      node.body = this.parseBlockStatement();

      // Attach JSDoc type information if available
      if (jsDoc) {
        node.jsDoc = jsDoc;
        node.typeInfo = {
          params: new Map(jsDoc.params.map(p => [p.name, p.type])),
          returns: jsDoc.returns ? jsDoc.returns.type : null,
          csharpOverride: jsDoc.csharpOverride || null
        };

        // Attach type info to function parameters
        if (node.params) {
          node.params.forEach((param, index) => {
            if (jsDoc.params[index] && param.type === 'Identifier') {
              this.typeAnnotations.set(param, {
                type: jsDoc.params[index].type,
                source: 'jsdoc'
              });
            }
          });
        }

        // Store return type in type annotations
        if (jsDoc.returns)
          this.typeAnnotations.set(node, { type: jsDoc.returns.type, source: 'jsdoc' });
      }

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
          ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '**='].includes(this.currentToken.value)) {
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
      let left = this.parseExponentiationExpression();

      while (this.currentToken && this.currentToken.type === 'OPERATOR' &&
             ['*', '/', '%'].includes(this.currentToken.value)) {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = this.currentToken.value;
        this.advance();
        node.right = this.parseExponentiationExpression();
        left = node;
      }

      return left;
    }

    /**
     * Parse exponentiation expression (ES2016 ** operator)
     * Right-associative: 2 ** 3 ** 2 = 2 ** 9 = 512
     */
    parseExponentiationExpression() {
      let left = this.parseUnaryExpression();

      // ** is right-associative, so we recursively parse the right side
      if (this.currentToken && this.currentToken.type === 'OPERATOR' &&
          this.currentToken.value === '**') {
        const node = { type: 'BinaryExpression' };
        node.left = left;
        node.operator = '**';
        this.advance();
        node.right = this.parseExponentiationExpression(); // Right-associative recursion
        return node;
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
          node.property = this.parsePropertyName(); // Allow keywords as property names
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
          } else if (this.currentToken.value === 'super') {
            this.advance();
            return { type: 'Super' };
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
     * Parse string literal with proper escape sequence handling
     */
    parseString() {
      const rawValue = this.currentToken.value.slice(1, -1); // Remove quotes
      const value = this._processEscapeSequences(rawValue);
      const node = { type: 'Literal', value };
      this.advance();
      return node;
    }

    /**
     * Process escape sequences in a string literal
     * @param {string} str - The raw string content (without quotes)
     * @returns {string} The string with escape sequences resolved
     */
    _processEscapeSequences(str) {
      let result = '';
      let i = 0;
      while (i < str.length) {
        if (str[i] === '\\' && i + 1 < str.length) {
          const next = str[i + 1];
          switch (next) {
            case 'n': result += '\n'; i += 2; break;
            case 'r': result += '\r'; i += 2; break;
            case 't': result += '\t'; i += 2; break;
            case 'b': result += '\b'; i += 2; break;
            case 'f': result += '\f'; i += 2; break;
            case 'v': result += '\v'; i += 2; break;
            case '0': result += '\0'; i += 2; break;
            case '\\': result += '\\'; i += 2; break;
            case "'": result += "'"; i += 2; break;
            case '"': result += '"'; i += 2; break;
            case '`': result += '`'; i += 2; break;
            case 'x':
              // Hex escape: \xNN
              if (i + 3 < str.length) {
                const hex = str.slice(i + 2, i + 4);
                if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                  result += String.fromCharCode(parseInt(hex, 16));
                  i += 4;
                  break;
                }
              }
              result += str[i];
              ++i;
              break;
            case 'u':
              // Unicode escape: \uNNNN or \u{N...}
              if (i + 2 < str.length && str[i + 2] === '{') {
                // \u{N...} format
                const closeBrace = str.indexOf('}', i + 3);
                if (closeBrace !== -1) {
                  const hex = str.slice(i + 3, closeBrace);
                  if (/^[0-9a-fA-F]+$/.test(hex)) {
                    result += String.fromCodePoint(parseInt(hex, 16));
                    i = closeBrace + 1;
                    break;
                  }
                }
              } else if (i + 5 < str.length) {
                // \uNNNN format
                const hex = str.slice(i + 2, i + 6);
                if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                  result += String.fromCharCode(parseInt(hex, 16));
                  i += 6;
                  break;
                }
              }
              result += str[i];
              ++i;
              break;
            default:
              // Unknown escape - just include the character after backslash
              result += next;
              i += 2;
              break;
          }
        } else {
          result += str[i];
          ++i;
        }
      }
      return result;
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
      // Remove backticks
      const value = rawValue.slice(1, -1);

      // Parse template literal expressions (${...})
      const expressions = [];
      const quasis = [];
      let currentPos = 0;
      let i = 0;

      while (i < value.length) {
        // Look for ${ pattern
        if (value[i] === '$' && i + 1 < value.length && value[i + 1] === '{') {
          // Add the quasi before this expression
          const quasiText = value.slice(currentPos, i);
          quasis.push({
            type: 'TemplateElement',
            value: { raw: quasiText, cooked: quasiText },
            tail: false
          });

          // Find the matching closing brace, handling nested braces
          let braceCount = 1;
          let exprStart = i + 2;
          let j = exprStart;
          while (j < value.length && braceCount > 0) {
            if (value[j] === '{') braceCount++;
            else if (value[j] === '}') braceCount--;
            if (braceCount > 0) j++;
          }

          // Extract the expression text
          const exprText = value.slice(exprStart, j);

          // Parse the expression by creating a temporary parser
          if (exprText.trim()) {
            try {
              const tempParser = new TypeAwareJSASTParser(exprText + ';');
              tempParser.tokenize();
              tempParser.position = 0;
              tempParser.currentToken = tempParser.tokens[0];
              const exprNode = tempParser.parseExpression();
              if (exprNode) {
                expressions.push(exprNode);
              } else {
                // Fallback: treat as simple identifier
                expressions.push({
                  type: 'Identifier',
                  name: exprText.trim()
                });
              }
            } catch (e) {
              // Fallback: treat as simple identifier if parsing fails
              expressions.push({
                type: 'Identifier',
                name: exprText.trim()
              });
            }
          }

          // Move past the closing brace
          currentPos = j + 1;
          i = currentPos;
        } else if (value[i] === '\\' && i + 1 < value.length) {
          // Skip escaped characters
          i += 2;
        } else {
          i++;
        }
      }

      // Add the final quasi
      const finalQuasiText = value.slice(currentPos);
      quasis.push({
        type: 'TemplateElement',
        value: { raw: finalQuasiText, cooked: finalQuasiText },
        tail: true
      });

      const node = {
        type: 'TemplateLiteral',
        value: value,
        raw: rawValue,
        expressions: expressions,
        quasis: quasis
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
          // Strip surrounding quotes from string token to get the actual key value
          property.key = { type: 'Literal', value: this.currentToken.value.slice(1, -1) };
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
          // BUT: if followed by ':', it's just using get/set as a property name
          if ((this.currentToken.value === 'get' || this.currentToken.value === 'set') &&
              this.tokens[this.position + 1] &&
              !(this.tokens[this.position + 1].type === 'PUNCTUATION' && this.tokens[this.position + 1].value === ':')) {
            property.kind = this.currentToken.value;
            this.advance(); // consume 'get' or 'set'
            this.skipComments();

            // Parse the property name after get/set
            if (this.currentToken.type === 'IDENTIFIER') {
              property.key = this.parseIdentifier();
            } else if (this.currentToken.type === 'STRING') {
              // Strip surrounding quotes from string token to get the actual key value
              property.key = { type: 'Literal', value: this.currentToken.value.slice(1, -1) };
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
            property.value = this.parseAssignmentExpression();
          }
        } else if (this.currentToken.type === 'OPERATOR' && this.currentToken.value === '...') {
          // Object spread syntax: { ...expr }
          this.advance(); // consume '...'
          this.skipComments();
          const argument = this.parseAssignmentExpression();

          // Create SpreadElement node and push directly
          const spreadElement = {
            type: 'SpreadElement',
            argument: argument
          };
          node.properties.push(spreadElement);

          this.skipComments();
          // Handle comma separator
          if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
            this.advance();
            this.skipComments();
          }
          continue; // Skip the normal property push
        } else if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '[') {
          // Computed property name: { [expression]: value }
          this.advance(); // consume '['
          this.skipComments();
          property.key = this.parseAssignmentExpression();
          this.skipComments();
          this.consume('PUNCTUATION', ']');
          property.computed = true;
          this.skipComments();

          // Check for method shorthand with computed property: { [key]() {} }
          if (this.currentToken && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '(') {
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
            // Regular computed property: [key]: value
            this.expect('PUNCTUATION', ':');
            this.skipComments();
            property.value = this.parseAssignmentExpression();
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

      // Check if node already has resultType from IL transformation
      if (node.resultType) {
        return { name: node.resultType };
      }

      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'number') {
            const val = node.value;
            // Handle special float values first
            if (!Number.isFinite(val))
              return { name: 'float64' }; // Infinity or NaN
            // Check for explicit float (has decimal or is result of division)
            if (!Number.isInteger(val))
              return { name: 'float64' };
            // Integer literals default to int32 (like most typed languages)
            // Only use larger types when value exceeds int32 range
            if (val >= -2147483648 && val <= 2147483647)
              return { name: 'int32' };
            if (val >= 0 && val <= 4294967295)
              return { name: 'uint32' };
            if (val < -2147483648)
              return { name: 'int64' };
            return { name: 'uint64' };
          }
          if (typeof node.value === 'string') return { name: 'string' };
          if (typeof node.value === 'boolean') return { name: 'boolean' };
          if (node.value === null) return { name: 'null' };
          if (node.value === undefined) return { name: 'void' };
          return { name: 'object' };

        case 'TemplateLiteral':
          return { name: 'string' };

        case 'Identifier':
          // Handle special global values first
          if (node.name === 'Infinity' || node.name === 'NaN')
            return { name: 'float64' };
          if (node.name === 'undefined')
            return { name: 'void' };

          // Check context first (function parameters, local variables)
          if (context[node.name])
            return context[node.name];

          // Check our variable type tracking
          const varType = this.lookupVariableType(node.name);
          if (varType)
            return { name: varType };

          // Check type annotations
          if (this.typeAnnotations.has(node))
            return this.typeAnnotations.get(node).type;

          // No name-based fallback - use type knowledge
          return this.typeKnowledge.inferType(node.name, context);

        case 'ArrayExpression':
          // Infer array element type from first element
          if (node.elements && node.elements.length > 0) {
            const elementType = this.inferExpressionType(node.elements[0], context);
            return { name: elementType.name + '[]', isArray: true, elementType };
          }
          // For empty arrays, use int32[] as default (consistent with int32 default)
          return { name: 'int32[]', isArray: true, elementType: { name: 'int32' } };

        case 'CallExpression':
          return this.inferCallExpressionType(node, context);

        case 'MemberExpression':
          return this.inferMemberExpressionType(node, context);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.inferBinaryExpressionType(node, context);

        case 'UnaryExpression':
          return this.inferUnaryExpressionType(node, context);

        case 'UpdateExpression':
          // ++x, x++, --x, x-- return the type of the operand
          if (node.argument) {
            const argType = this.inferExpressionType(node.argument, context);
            if (argType.name !== 'object') return argType;
          }
          return { name: 'uint32' };

        case 'AssignmentExpression':
          // Assignment returns the type of the right side
          return this.inferExpressionType(node.right, context);

        case 'ConditionalExpression':
          // a ? b : c - infer from consequent (could merge both branches)
          return this.inferExpressionType(node.consequent, context);

        case 'NewExpression':
          // new Array(), new List(), etc.
          if (node.callee && (node.callee.name === 'Array' || node.callee.name === 'List')) {
            return { name: 'uint8[]', isArray: true, elementType: { name: 'uint8' } };
          }
          return { name: node.callee?.name || 'object' };

        default:
          // Use 'object' as fallback instead of 'any' - more specific
          return { name: 'object' };
      }
    }

    /**
     * Infer type for binary expressions
     */
    inferBinaryExpressionType(node, context) {
      const left = this.inferExpressionType(node.left, context);
      const right = this.inferExpressionType(node.right, context);
      const op = node.operator;

      // Check for idioms first (common JavaScript type coercion patterns)
      const rightValue = this._getLiteralValue(node.right);

      // Idiom: x & 0xff or x & 255 → uint8
      if (op === '&' && (rightValue === 0xff || rightValue === 255))
        return { name: 'uint8' };

      // Idiom: x & 0xffff or x & 65535 → uint16
      if (op === '&' && (rightValue === 0xffff || rightValue === 65535))
        return { name: 'uint16' };

      // Idiom: x & 0xffffffff → uint32
      if (op === '&' && rightValue === 0xffffffff)
        return { name: 'uint32' };

      // Idiom: x | 0 → int32 (JavaScript ToInt32)
      if (op === '|' && rightValue === 0)
        return { name: 'int32' };

      // Idiom: x >> 0 → int32 (JavaScript ToInt32)
      if (op === '>>' && rightValue === 0)
        return { name: 'int32' };

      // Idiom: x >>> 0 → uint32 (JavaScript ToUint32)
      if (op === '>>>' && rightValue === 0)
        return { name: 'uint32' };

      switch (op) {
        // Comparison operators → boolean
        case '==':
        case '===':
        case '!=':
        case '!==':
        case '<':
        case '>':
        case '<=':
        case '>=':
          return { name: 'boolean' };

        // Logical operators: JavaScript returns actual values, not booleans
        case '&&':
        case '||':
          // If both operands are boolean, return boolean
          if (left.name === 'boolean' && right.name === 'boolean')
            return { name: 'boolean' };
          // For || (null-coalescing), return the type of operands
          if (op === '||')
            return left.name !== 'object' ? left : right;
          // For && return right type (a && b returns b when a is truthy)
          return right.name !== 'object' ? right : left;

        // Bitwise operators → left operand type (unless idiom detected above)
        case '&':
        case '|':
        case '^':
        case '<<':
        case '>>':
        case '>>>':
          // Return left operand type for bitwise ops
          if (left.name && left.name !== 'any' && left.name !== 'number')
            return left;
          // If left is generic, use int32 as default
          return { name: 'int32' };

        // Arithmetic operators
        case '+':
          // String concatenation check
          if (left.name === 'string' || right.name === 'string')
            return { name: 'string' };
          // Numeric addition - return left type
          if (left.name && left.name !== 'any' && left.name !== 'number')
            return left;
          if (right.name && right.name !== 'any' && right.name !== 'number')
            return right;
          return { name: 'int32' };

        case '-':
        case '*':
        case '%':
          // Preserve left type for arithmetic
          if (left.name && left.name !== 'any' && left.name !== 'number')
            return left;
          if (right.name && right.name !== 'any' && right.name !== 'number')
            return right;
          return { name: 'int32' };

        case '/':
          // Division may produce float
          return { name: 'float64' };

        case '**':
          // Exponentiation
          return { name: 'float64' };

        default:
          // Unknown operator - use int32 as default
          return { name: 'int32' };
      }
    }

    /**
     * Get literal numeric value from a node, or null if not a literal
     */
    _getLiteralValue(node) {
      if (!node) return null;
      if (node.type === 'Literal' && typeof node.value === 'number')
        return node.value;
      // Handle negative literals like -1
      if (node.type === 'UnaryExpression' && node.operator === '-' &&
          node.argument && node.argument.type === 'Literal' &&
          typeof node.argument.value === 'number')
        return -node.argument.value;
      return null;
    }

    /**
     * Infer type for unary expressions
     */
    inferUnaryExpressionType(node, context) {
      const argType = this.inferExpressionType(node.argument, context);

      switch (node.operator) {
        case '!':
          return { name: 'boolean' };
        case '+':
          // Unary plus converts to number, preserve specific type or use int32
          if (argType.name && argType.name !== 'any' && argType.name !== 'number')
            return argType;
          return { name: 'int32' };
        case '-':
          // Negation - preserve type if specific, use int32 default
          if (argType.name && argType.name !== 'any' && argType.name !== 'number')
            return argType;
          return { name: 'int32' };
        case '~':
          // Bitwise NOT - always returns int32 in JavaScript
          return { name: 'int32' };
        case 'typeof':
          return { name: 'string' };
        case 'void':
          return { name: 'void' };
        default:
          return argType;
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
        if (objectType && (objectType.isArray || (typeof objectType.name === 'string' && objectType.name.endsWith('[]')))) {
          if (methodName === 'slice' || methodName === 'concat' || methodName === 'filter' || methodName === 'map') {
            return objectType; // Returns same array type
          }
          if (methodName === 'pop' || methodName === 'shift') {
            // Returns element type
            if (objectType.elementType) return objectType.elementType;
            if (typeof objectType.name === 'string' && objectType.name.endsWith('[]')) {
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
        if (objectType && objectType.name === 'string') {
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
          return { name: 'uint8[]', isArray: true, elementType: { name: 'uint8' } };
        }
        if (funcName === 'String') {
          return { name: 'string' };
        }
        if (funcName === 'Number') {
          return { name: 'uint32' };
        }
        if (funcName === 'Boolean') {
          return { name: 'boolean' };
        }
      }

      // Use object as fallback for unknown function calls
      return { name: 'object' };
    }

    /**
     * Infer type for member expressions (obj.prop or obj[index])
     */
    inferMemberExpressionType(node, context) {
      const objectType = this.inferExpressionType(node.object, context);

      // Handle indexed access: arr[i] or obj[key]
      if (node.computed) {
        // Array indexing: arr[i] returns element type
        if (objectType && objectType.isArray && objectType.elementType)
          return objectType.elementType;
        if (objectType && typeof objectType.name === 'string' && objectType.name.endsWith('[]')) {
          // Extract element type from "type[]" format
          const elementTypeName = objectType.name.slice(0, -2);
          return { name: elementTypeName };
        }
        // Handle string type directly
        if (typeof objectType === 'string' && objectType.endsWith('[]')) {
          const elementTypeName = objectType.slice(0, -2);
          return { name: elementTypeName };
        }
        // Object/Map indexing: obj[key] returns object (the value type)
        const objectTypeName = typeof objectType === 'string' ? objectType : objectType?.name;

        // Only return uint8 for explicit byte array types (Uint8Array, Buffer, etc.)
        if (objectTypeName === 'uint8[]' || objectTypeName === 'Uint8Array' ||
            objectTypeName === 'Buffer' || objectTypeName === 'byte[]')
          return { name: 'uint8' };

        // For all other indexed access (objects, maps, etc.), return object
        // This allows downstream transformers to properly handle the type
        return { name: 'object' };
      }

      // Handle property access
      const propertyName = node.property.name || node.property.value;
      const objectTypeName = typeof objectType === 'string' ? objectType : objectType?.name;
      const isArray = objectType?.isArray ||
                      (typeof objectTypeName === 'string' && objectTypeName.endsWith('[]'));

      // Array properties
      if (isArray) {
        if (propertyName === 'length')
          return { name: 'int' };
        if (propertyName === 'push' || propertyName === 'pop' || propertyName === 'shift' ||
            propertyName === 'unshift' || propertyName === 'slice' || propertyName === 'splice')
          // These are methods - would need full method signature handling
          return { name: 'function' };
      }

      // String properties
      if (objectTypeName === 'string') {
        if (propertyName === 'length')
          return { name: 'int' };
      }

      // Check framework class properties
      const objectName = node.object.name;
      if (objectName && this.typeKnowledge.frameworkTypes[objectName]) {
        const classInfo = this.typeKnowledge.frameworkTypes[objectName];
        if (classInfo.properties && classInfo.properties[propertyName]) {
          return this.jsDocParser.parseType(classInfo.properties[propertyName]);
        }
      }

      // Try to infer from property name patterns
      const lowerProp = propertyName?.toLowerCase() || '';
      if (lowerProp === 'length' || lowerProp === 'size' || lowerProp === 'count')
        return { name: 'int32' };
      if (lowerProp.startsWith('is') || lowerProp.startsWith('has'))
        return { name: 'boolean' };

      // Fallback to object for unknown properties
      return { name: 'object' };
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
        ...this.options,  // Pass all options through to the language plugin
        parser: this.parser,
        typeKnowledge: this.typeKnowledge,
        indent: this.indentString,
        useAstPipeline: true  // Use new AST pipeline for better type handling
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

        // Generate test runner if requested (global property)
        let testRunnerNode = null;
        if (options.generateTestRunner === true) {
          testRunnerNode = this.extractAndGenerateTestRunner(ast);
        }

        // Generate code using LanguagePlugin
        this.generator = new TypeAwareCodeGenerator(languagePlugin, this.parser, options);
        const generatedCode = this.generator.generate(ast);

        // If test runner was generated, append it to the code
        let finalCode = generatedCode;
        if (testRunnerNode && languagePlugin.generateTestRunner) {
          const testRunnerCode = languagePlugin.generateTestRunner(testRunnerNode);
          if (testRunnerCode) {
            finalCode = generatedCode + '\n\n' + testRunnerCode;
          }
        }
        
        return {
          success: true,
          code: finalCode,
          ast: ast,
          typeInfo: this.parser.typeAnnotations,
          testRunner: testRunnerNode
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
     * Extract test vectors from AST and generate ILTestRunner node (global property)
     * @param {Object} ast - The AST to extract test vectors from
     * @returns {Object|null} ILTestRunner node or null if no tests found
     */
    extractAndGenerateTestRunner(ast) {
      const testRunner = {
        type: 'ILTestRunner',
        ilNodeType: 'ILTestRunner',
        algorithmClasses: [],
        instanceClasses: [],
        tests: []
      };

      const extractFromNode = (node) => {
        if (!node || typeof node !== 'object') return;

        // Handle class declarations - look for classes extending Algorithm types
        if (node.type === 'ClassDeclaration' && node.superClass) {
          const isAlgorithmClass = this.isAlgorithmFrameworkClass(node.superClass);
          if (isAlgorithmClass) {
            const className = node.id?.name;
            if (className) {
              testRunner.algorithmClasses.push(className);
              // Find the Instance class (usually named *Instance)
              const instanceClassName = className.replace(/Algorithm$/, 'Instance');
              testRunner.instanceClasses.push(instanceClassName);

              // Extract tests from this class
              const classTests = this.extractTestsFromClass(node);
              if (classTests && classTests.length > 0) {
                testRunner.tests.push({
                  algorithmClass: className,
                  instanceClass: instanceClassName,
                  testCases: classTests
                });
              }
            }
          }
        }

        // Recursively process child nodes
        for (const key in node) {
          if (node.hasOwnProperty(key) && key !== 'parent') {
            const child = node[key];
            if (Array.isArray(child)) {
              child.forEach(extractFromNode);
            } else if (child && typeof child === 'object') {
              extractFromNode(child);
            }
          }
        }
      };

      extractFromNode(ast);

      return testRunner.tests.length > 0 ? testRunner : null;
    }

    /**
     * Extract test cases from a class's this.tests assignment
     * @param {Object} classNode - The class AST node
     * @returns {Array} Array of test case objects
     */
    extractTestsFromClass(classNode) {
      const tests = [];

      // Handle different class body structures
      let classMembers;
      if (classNode.body && Array.isArray(classNode.body)) {
        classMembers = classNode.body;
      } else if (classNode.body && classNode.body.body && Array.isArray(classNode.body.body)) {
        classMembers = classNode.body.body;
      } else {
        return tests;
      }

      // Find constructor method
      const constructor = classMembers.find(member => {
        return member.type === 'MethodDefinition' &&
               (member.kind === 'constructor' || member.key?.name === 'constructor');
      });

      if (!constructor || !constructor.value || !constructor.value.body || !constructor.value.body.body) {
        return tests;
      }

      const statements = constructor.value.body.body;

      // Find this.tests = [...] assignment
      for (const stmt of statements) {
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression.type === 'AssignmentExpression' &&
            stmt.expression.left.type === 'MemberExpression' &&
            stmt.expression.left.object?.type === 'ThisExpression' &&
            stmt.expression.left.property?.name === 'tests') {

          const testsArray = stmt.expression.right;
          if (testsArray.type === 'ArrayExpression' && testsArray.elements) {
            for (const element of testsArray.elements) {
              const testCase = this.extractTestCase(element);
              if (testCase) {
                tests.push(testCase);
              }
            }
          }
          break;
        }
      }

      return tests;
    }

    /**
     * Extract a single test case from an AST node
     * @param {Object} node - The test case AST node (ObjectExpression or NewExpression)
     * @returns {Object|null} Test case object or null
     */
    extractTestCase(node) {
      if (!node) return null;

      const testCase = {
        input: null,
        expected: null,
        key: null,
        iv: null,
        nonce: null,
        description: null,
        source: null
      };

      // Handle new TestCase(...) constructor call
      if (node.type === 'NewExpression' && node.callee?.name === 'TestCase') {
        const args = node.arguments || [];
        if (args.length >= 2) {
          testCase.input = this.extractByteArray(args[0]);
          testCase.expected = this.extractByteArray(args[1]);
        }
        if (args.length >= 3) {
          testCase.description = this.extractStringLiteral(args[2]);
        }
        if (args.length >= 4) {
          testCase.source = this.extractStringLiteral(args[3]);
        }
        return testCase;
      }

      // Handle object literal { input: [...], expected: [...], ... }
      if (node.type === 'ObjectExpression' && node.properties) {
        for (const prop of node.properties) {
          const key = prop.key?.name || prop.key?.value;
          if (key === 'input' || key === 'text') {
            testCase.input = this.extractByteArray(prop.value);
          } else if (key === 'expected' || key === 'output') {
            testCase.expected = this.extractByteArray(prop.value);
          } else if (key === 'key') {
            testCase.key = this.extractByteArray(prop.value);
          } else if (key === 'iv') {
            testCase.iv = this.extractByteArray(prop.value);
          } else if (key === 'nonce') {
            testCase.nonce = this.extractByteArray(prop.value);
          } else if (key === 'description' || key === 'text') {
            testCase.description = this.extractStringLiteral(prop.value);
          } else if (key === 'source' || key === 'uri') {
            testCase.source = this.extractStringLiteral(prop.value);
          }
        }
        return testCase;
      }

      return null;
    }

    /**
     * Extract byte array from AST node (handles ArrayExpression and OpCodes calls)
     * @param {Object} node - AST node
     * @returns {Array|null} Byte array or null
     */
    extractByteArray(node) {
      if (!node) return null;

      // Direct array literal [0x01, 0x02, ...]
      if (node.type === 'ArrayExpression' && node.elements) {
        return node.elements.map(el => {
          if (el.type === 'Literal') return el.value;
          return 0;
        });
      }

      // OpCodes.Hex8ToBytes("...") or OpCodes.AnsiToBytes("...") or global.OpCodes.X(...)
      const isOpCodesCallForBytes = node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          (node.callee?.object?.name === 'OpCodes' ||
           (node.callee?.object?.type === 'MemberExpression' && node.callee?.object?.property?.name === 'OpCodes'));
      if (isOpCodesCallForBytes) {
        const method = node.callee.property?.name;
        const arg = node.arguments?.[0];

        if (method === 'Hex8ToBytes' && arg?.type === 'Literal') {
          // Convert hex string to bytes
          const hex = arg.value;
          const bytes = [];
          for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
          }
          return bytes;
        }

        if (method === 'AnsiToBytes' && arg?.type === 'Literal') {
          // Convert ASCII string to bytes
          return Array.from(arg.value).map(c => c.charCodeAt(0));
        }
      }

      // System.Text.Encoding.ASCII.GetBytes("...")
      if (node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee?.property?.name === 'GetBytes') {
        const arg = node.arguments?.[0];
        if (arg?.type === 'Literal' && typeof arg.value === 'string') {
          return Array.from(arg.value).map(c => c.charCodeAt(0));
        }
      }

      return null;
    }

    /**
     * Extract string literal from AST node
     * @param {Object} node - AST node
     * @returns {string|null} String value or null
     */
    extractStringLiteral(node) {
      if (!node) return null;
      if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
      }
      if (node.type === 'TemplateLiteral' && node.quasis?.[0]) {
        return node.quasis[0].value?.cooked || node.quasis[0].value?.raw;
      }
      return null;
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
    PreciseTypeKnowledge,

    /**
     * Initialize type libraries by fetching OpCodes.js and AlgorithmFramework.js
     * This is called automatically in browser context, or can be called manually
     * @returns {Promise<void>}
     */
    async initTypeLibraries() {
      if (TypeAwareJSASTParser.sharedTypeKnowledge &&
          Object.keys(TypeAwareJSASTParser.sharedTypeKnowledge.opCodesTypes).length > 0) {
        // Already initialized
        return;
      }

      const options = {};

      try {
        // Fetch OpCodes.js source
        const opCodesResponse = await fetch('./OpCodes.js');
        if (opCodesResponse.ok) {
          options.opCodesSource = await opCodesResponse.text();
        }
      } catch (e) {
        console.warn('Could not fetch OpCodes.js for type extraction:', e);
      }

      try {
        // Fetch AlgorithmFramework.js source
        const frameworkResponse = await fetch('./AlgorithmFramework.js');
        if (frameworkResponse.ok) {
          options.frameworkSource = await frameworkResponse.text();
        }
      } catch (e) {
        console.warn('Could not fetch AlgorithmFramework.js for type extraction:', e);
      }

      if (Object.keys(options).length > 0) {
        TypeAwareJSASTParser.loadTypeLibraries(options);
      }
    },

    /** Flag indicating if type libraries have been initialized */
    typeLibrariesReady: false
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      TypeAwareJSTranspiler,
      TypeAwareJSASTParser,
      TypeAwareCodeGenerator,
      JSDocParser,
      PreciseTypeKnowledge
    };
  } else if (typeof global !== 'undefined') {
    global.TypeAwareJSASTTranspiler = TypeAwareJSASTTranspiler;
  } else if (typeof window !== 'undefined') {
    window.TypeAwareJSASTTranspiler = TypeAwareJSASTTranspiler;

    // Auto-initialize type libraries when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        try {
          await TypeAwareJSASTTranspiler.initTypeLibraries();
          TypeAwareJSASTTranspiler.typeLibrariesReady = true;
          console.log('📚 Type libraries initialized for transpiler');
        } catch (e) {
          console.warn('Failed to initialize type libraries:', e);
        }
      });
    } else {
      // DOM already loaded, initialize immediately
      TypeAwareJSASTTranspiler.initTypeLibraries().then(() => {
        TypeAwareJSASTTranspiler.typeLibrariesReady = true;
        console.log('📚 Type libraries initialized for transpiler');
      }).catch(e => {
        console.warn('Failed to initialize type libraries:', e);
      });
    }
  }

})(typeof global !== 'undefined' ? global : this);
