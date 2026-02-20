/**
 * GoTransformer.js - IL AST to Go AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Go AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Go AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - packageName: Go package name
 *   - useStrictTypes: Enable strict type checking
 *   - useGenerics: Enable generics support
 *   - errorHandling: Enable idiomatic Go error handling
 *   - useContext: Add context.Context parameters
 *   - useCrypto: Use crypto stdlib functions
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

  let GoEmitter;
  if (typeof require !== 'undefined') {
    GoEmitter = require('./GoEmitter.js').GoEmitter;
  } else if (global.GoEmitter) {
    GoEmitter = global.GoEmitter;
  }

  const {
    GoType, GoFile, GoImport, GoStruct, GoInterface, GoTypeAlias,
    GoField, GoFunc, GoParameter, GoConst, GoVar,
    GoBlock, GoExpressionStatement, GoReturn, GoIf, GoFor, GoSwitch, GoCase,
    GoDefer, GoGo, GoBreak, GoContinue, GoSelect,
    GoLiteral, GoIdentifier, GoBinaryExpression, GoUnaryExpression, GoSpread, GoAssignment,
    GoSelectorExpression, GoIndexExpression, GoSliceExpression, GoCallExpression,
    GoTypeAssertion, GoTypeConversion, GoCompositeLiteral, GoKeyValue,
    GoFuncLit, GoMake, GoNew, GoRawCode
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
    // usize/isize from IL (Rust-style platform-sized types) - map to Go's int
    'usize': 'int', 'isize': 'int',
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
      // Accept 'namespace' as alias for 'packageName' for consistency with other transformers
      const packageName = options.packageName || options.namespace || 'cipher';
      this.options = {
        packageName,
        addComments: true,
        useStrictTypes: true,
        // errorHandling disabled by default: adds error returns to constructors
        // but internal calls aren't updated to handle them, causing signature errors
        errorHandling: false,
        useInterfaces: true,
        useGoroutines: true,
        useCrypto: true,
        useGenerics: true,
        // useContext disabled by default: adds context params but calls don't match
        useContext: false,
        useChannels: true,
        ...options
      };
      // Ensure packageName is always set correctly after spread
      this.options.packageName = packageName;
      this.typeKnowledge = options.typeKnowledge || null;
      this.currentStruct = null;
      this.currentFunc = null;
      this.variableTypes = new Map();
      this.structFieldTypes = new Map(); // Maps struct field names to their types
      // Pre-register framework struct field types
      this.structFieldTypes.set('Tests', GoType.Slice(new GoType('TestCase')));
      this.structFieldTypes.set('tests', GoType.Slice(new GoType('TestCase')));
      this.structFieldTypes.set('Documentation', GoType.Slice(new GoType('LinkItem')));
      this.structFieldTypes.set('documentation', GoType.Slice(new GoType('LinkItem')));
      this.structFieldTypes.set('References', GoType.Slice(new GoType('LinkItem')));
      this.structFieldTypes.set('SupportedKeySizes', GoType.Slice(new GoType('KeySize')));
      this.structFieldTypes.set('SupportedBlockSizes', GoType.Slice(new GoType('KeySize')));
      this.methodReturnTypes = new Map(); // Maps method names to their return types
      // Pre-register return types for built-in Go helper functions
      this.methodReturnTypes.set('ParseInt', GoType.Int());
      this.methodReturnTypes.set('ParseFloat', GoType.Float64());
      this.methodReturnTypes.set('ifTruthy', GoType.Interface());
      this.methodReturnTypes.set('firstNonNil', GoType.Interface());
      this.methodReturnTypes.set('makeFilledSlice', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('containsElement', GoType.Bool());
      this.methodReturnTypes.set('indexOfElement', GoType.Int());
      this.methodReturnTypes.set('reduceSlice', GoType.Interface());
      this.methodReturnTypes.set('reduceSliceBytes', GoType.UInt8());
      this.methodReturnTypes.set('reduceSliceUint32', GoType.UInt32());
      this.methodReturnTypes.set('mapSlice', GoType.Interface());
      this.methodReturnTypes.set('filterSlice', GoType.Interface());
      this.methodReturnTypes.set('minUint32', GoType.UInt32());
      this.methodReturnTypes.set('maxUint32', GoType.UInt32());
      this.methodReturnTypes.set('minInt', GoType.Int());
      this.methodReturnTypes.set('maxInt', GoType.Int());
      this.methodReturnTypes.set('getKeys', GoType.Slice(GoType.String()));
      this.methodReturnTypes.set('getValues', GoType.Interface());
      this.methodReturnTypes.set('sliceToString', GoType.String());
      this.methodReturnTypes.set('stringToSlice', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('postIncrInt', GoType.Int());
      this.methodReturnTypes.set('postIncrUint32', GoType.UInt32());
      this.methodReturnTypes.set('postDecrInt', GoType.Int());
      this.methodReturnTypes.set('postDecrUint32', GoType.UInt32());
      this.methodReturnTypes.set('createTestVectors', GoType.Slice(new GoType('TestCase')));
      this.methodReturnTypes.set('CreateTestVectors', GoType.Slice(new GoType('TestCase')));
      this.methodReturnTypes.set('constantTimeCompare', GoType.Int());
      this.methodReturnTypes.set('Result', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('Encode', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('Decode', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('Encrypt', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('Decrypt', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('Compress', GoType.Slice(GoType.UInt8()));
      this.methodReturnTypes.set('Decompress', GoType.Slice(GoType.UInt8()));
      this.methodParamTypes = new Map(); // Maps "methodName:paramIndex" to inferred type from call sites
      this.methodDeclaredParams = new Map(); // Maps "methodName:paramIndex" to declared parameter type
      this.currentFunctionReturnType = null; // Type of current function's return for inferring empty arrays
      this.imports = new Set();
      this.receiverName = 's'; // Default receiver variable name

      // Track framework classes needed for stub generation
      this.frameworkClasses = new Set(); // Base classes used (BlockCipherAlgorithm, etc.)
      this.helperClasses = new Set();    // Helper classes (KeySize, LinkItem, etc.)
      this.enumsUsed = new Set();        // Enums referenced (category_type, etc.)
      this.frameworkFunctions = new Set(); // Framework functions (register_algorithm, etc.)
      // Track renamed fields per struct (to avoid field/method name collisions)
      this.renamedFields = new Map(); // Maps "StructName.OriginalName" -> "RenamedName"
      this.declaredMethodNames = new Map();
      this.methodRenames = new Map();
      this.prescanEmptyArrayVars = new Set();
      this.inMapSelfRefContext = false; // true when inside an object-literal IIFE where 'this' -> map key access
      this.algorithmStructName = null; // Name of the concrete algorithm struct (e.g., 'LEAAlgorithm')
    }

    /**
     * Check if an ObjectExpression (or ObjectLiteral IL node) contains any
     * ThisExpression / ThisPropertyAccess / ThisMethodCall references inside
     * function-valued properties.  When it does, the object must be built
     * imperatively so that 's' (the receiver alias) can be captured in closures.
     */
    _objectExpressionHasThisRef(node) {
      if (!node || !node.properties) return false;
      const walk = (n) => {
        if (!n || typeof n !== 'object') return false;
        if (n.type === 'ThisExpression' || n.ilNodeType === 'ThisExpression') return true;
        if (n.type === 'ThisPropertyAccess' || n.ilNodeType === 'ThisPropertyAccess') return true;
        if (n.type === 'ThisMethodCall' || n.ilNodeType === 'ThisMethodCall') return true;
        // Don't recurse into nested ObjectExpressions that have their own 'this' scope
        // (but DO recurse into FunctionExpression bodies)
        for (const key of Object.keys(n)) {
          if (key === 'type' || key === 'ilNodeType') continue;
          const child = n[key];
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === 'object' && walk(item)) return true;
            }
          } else if (child && typeof child === 'object' && walk(child)) return true;
        }
        return false;
      };
      for (const prop of node.properties) {
        const val = prop.value;
        if (!val) continue;
        const isFn = val.type === 'FunctionExpression' || val.type === 'ArrowFunctionExpression';
        if (isFn && walk(val.body)) return true;
      }
      return false;
    }

    /**
     * Infer the return type string for a ThisMethodCall inside a map-self-ref
     * context.  Returns null when the method doesn't appear to return a value
     * (void), or a simple Go type string otherwise.
     */
    _inferThisMethodCallReturnForMap(node) {
      // Simple heuristic: check the IL return type if present
      const retType = node.returnType || node.inferredReturnType;
      if (retType) {
        const mapped = this.mapType(retType);
        const s = mapped?.toString();
        if (s && s !== '' && s !== 'void') return s;
      }
      // Methods named GenerateByte usually return uint32/uint8; Init returns void
      const name = (node.method || '').toLowerCase();
      if (name === 'init' || name === 'keysetup') return null;
      // Fallback: assume returns interface{}
      return 'interface{}';
    }

    /**
     * Convert a Go AST node to its Go source code string representation.
     * Uses GoEmitter to properly serialize the node instead of relying on toString()
     * which would produce [object Object] for nodes without a custom toString().
     * @param {GoNode} node - The AST node to convert
     * @returns {string} The Go source code for the node
     */
    _nodeToCode(node) {
      if (!node) return '';
      if (typeof node === 'string') return node;
      try {
        const emitter = new GoEmitter({ indent: '', newline: '', addComments: false });
        return emitter.emit(node);
      } catch (e) {
        return String(node);
      }
    }

    /**
     * Transform a slice index, handling negative indices.
     * In JS, arr.slice(0, -1) means arr[0:arr.length-1]. Go doesn't support
     * negative slice indices, so we convert them to len(arr)-N.
     * @param {Object} indexNode - JS AST node for the index
     * @param {Object} arrayNode - JS AST node for the array being sliced
     * @returns {GoNode} - Transformed Go expression for the index
     */
    _transformSliceIndex(indexNode, arrayNode) {
      if (!indexNode) return null;
      // Detect negative numeric literal: -N (UnaryExpression with - and Literal)
      if (indexNode.type === 'UnaryExpression' && indexNode.operator === '-' && indexNode.argument) {
        const arg = indexNode.argument;
        if (arg.type === 'Literal' && typeof arg.value === 'number' && arg.value > 0) {
          // Convert -N to len(arr) - N
          const arr = this.transformExpression(arrayNode);
          const lenCall = new GoCallExpression(new GoIdentifier('len'), [arr]);
          return new GoBinaryExpression(lenCall, '-', GoLiteral.Int(arg.value));
        }
      }
      // Normal index - just transform it
      return this.transformExpression(indexNode);
    }

    /**
     * Safely create a type assertion - never on literals
     * In Go, type assertions are only valid on interface values, not literals
     * @param {GoNode} expression - The expression to assert
     * @param {GoType} type - The type to assert to
     * @returns {GoNode} - Either the assertion or the original expression if it's a literal
     */
    safeTypeAssertion(expression, type) {
      // Never assert on literals - they're already typed in Go
      if (expression.nodeType === 'Literal') {
        // For numeric literals, use type conversion instead if needed
        if (expression.literalType === 'int' || expression.literalType === 'uint32' ||
            expression.literalType === 'float64') {
          // Check if we need to convert the literal to the target type
          const targetName = type?.name || type?.toString();
          if (targetName && expression.literalType !== targetName) {
            return new GoTypeConversion(type, expression);
          }
        }
        return expression;
      }

      // Never assert on composite literals (maps, slices, struct literals) - they're concrete
      if (expression.nodeType === 'CompositeLiteral') {
        return expression;
      }

      // For function call expressions, only skip assertion if the return type is concrete
      // Functions returning interface{}/any DO need type assertions at the call site
      if (expression.nodeType === 'CallExpression') {
        // Check the called method's return type via methodReturnTypes
        const callee = expression.function;
        let returnType = null;
        if (callee?.nodeType === 'SelectorExpression') {
          const methodName = callee.selector?.name || callee.selector;
          if (methodName && this.methodReturnTypes) {
            returnType = this.methodReturnTypes.get(methodName);
          }
        } else if (callee?.nodeType === 'Identifier') {
          const funcName = callee.name;
          if (funcName && this.methodReturnTypes) {
            returnType = this.methodReturnTypes.get(funcName);
          }
        }
        const returnTypeStr = returnType?.toString() || '';
        // If return type is interface{}/any, allow the assertion to proceed
        if (returnTypeStr === 'interface{}' || returnTypeStr === 'any') {
          // Fall through to create the type assertion
        } else {
          // Return type is concrete or unknown - skip assertion
          return expression;
        }
      }

      // Never assert on type conversions - they already produce concrete types
      if (expression.nodeType === 'TypeConversion') {
        return expression;
      }

      // Never assert on make() expressions - they return concrete slice/map types
      if (expression.nodeType === 'Make') {
        return expression;
      }

      // Never assert on binary expressions - arithmetic/comparison produce concrete types
      if (expression.nodeType === 'BinaryExpression') {
        return expression;
      }

      // Never assert on unary expressions - they produce concrete types
      if (expression.nodeType === 'UnaryExpression') {
        return expression;
      }

      // Never assert on slice expressions - they produce concrete slice types
      if (expression.nodeType === 'SliceExpression') {
        return expression;
      }

      // Note: IndexExpression results may need assertion (e.g., map[string]interface{} indexing)

      // Never assert on type assertions - already asserting
      if (expression.nodeType === 'TypeAssertion') {
        return expression;
      }

      // Never assert on new() expressions - they produce concrete pointer types
      if (expression.nodeType === 'New') {
        return expression;
      }

      // Type assertions only work on interface{} values
      // If the expression has a known concrete type, don't add assertion
      const exprType = expression.goType;
      if (exprType) {
        const exprTypeName = exprType.name || exprType.toString();
        const targetTypeName = type?.name || type?.toString();

        // If types match, no assertion needed
        if (exprTypeName === targetTypeName) {
          return expression;
        }

        // If expression type is not interface{}/any, use type conversion instead
        if (exprTypeName !== 'interface{}' && exprTypeName !== 'any') {
          // For numeric type conversions
          if (this.isNumericType(exprTypeName) && this.isNumericType(targetTypeName)) {
            return new GoTypeConversion(type, expression);
          }
          // Already a concrete type, don't assert
          return expression;
        }
      }

      // For index expressions, check if we're asserting on a known type
      if (expression.nodeType === 'IndexExpression') {
        let elemType = expression.goType?.name || expression.goType?.toString();
        const targetTypeName = type?.name || type?.toString();

        // If goType not set, infer element type from the target's known slice/array type
        if (!elemType && expression.target) {
          let containerType = null;
          if (expression.target.nodeType === 'Identifier' && this.variableTypes) {
            containerType = this.variableTypes.get(expression.target.name);
          } else if (expression.target.nodeType === 'SelectorExpression') {
            const fieldName = expression.target.selector?.name || expression.target.selector;
            if (fieldName && this.structFieldTypes)
              containerType = this.structFieldTypes.get(fieldName);
          }
          if (containerType) {
            const ctStr = containerType.name || containerType.toString();
            // Extract element type from slice type like []uint32 -> uint32
            if (ctStr.startsWith('[]'))
              elemType = ctStr.substring(2);
            else if (ctStr.startsWith('map['))
              elemType = null; // map values may be interface{}, let assertion proceed
          }
        }

        if (elemType && (elemType === targetTypeName || (elemType !== 'interface{}' && elemType !== 'any'))) {
          // Types match or source is concrete non-interface: skip assertion
          if (elemType !== targetTypeName && this.isNumericType(elemType) && this.isNumericType(targetTypeName))
            return new GoTypeConversion(type, expression);
          return expression;
        }
      }

      // For identifiers, check if we know the variable's type from context
      if (expression.nodeType === 'Identifier') {
        const varType = this.variableTypes?.get(expression.name);
        if (varType) {
          const varTypeName = varType.name || varType.toString();
          const targetTypeName = type?.name || type?.toString();
          if (varTypeName === targetTypeName) {
            return expression;
          }
          if (varTypeName !== 'interface{}' && varTypeName !== 'any') {
            if (this.isNumericType(varTypeName) && this.isNumericType(targetTypeName)) {
              return new GoTypeConversion(type, expression);
            }
            return expression;
          }
        }
      }

      // For member/selector expressions, check if we know the field type
      if (expression.nodeType === 'SelectorExpression') {
        const fieldType = this.structFieldTypes?.get(expression.field?.name || expression.field);
        if (fieldType) {
          const fieldTypeName = fieldType.name || fieldType.toString();
          const targetTypeName = type?.name || type?.toString();
          if (fieldTypeName === targetTypeName) {
            return expression;
          }
          if (fieldTypeName !== 'interface{}' && fieldTypeName !== 'any') {
            if (this.isNumericType(fieldTypeName) && this.isNumericType(targetTypeName)) {
              return new GoTypeConversion(type, expression);
            }
            return expression;
          }
        }
      }

      return new GoTypeAssertion(expression, type);
    }

    isNumericType(typeName) {
      const numericTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                            'uint', 'uint8', 'uint16', 'uint32', 'uint64',
                            'float32', 'float64', 'byte', 'rune'];
      return numericTypes.includes(typeName);
    }

    /**
     * Ensure a Go condition expression is boolean.
     * Go requires explicit boolean expressions in if/for/while conditions.
     * JS truthiness like `if (value)` must be converted to `if value != 0` etc.
     * @param {Object} astNode - Original AST node (for type inference)
     * @param {Object} condition - Transformed Go expression
     * @returns {Object} Boolean Go expression
     */
    _ensureBooleanCondition(astNode, condition) {
      if (!astNode || !condition) return condition;

      const isComparison = astNode.type === 'BinaryExpression' &&
                           ['==', '===', '!=', '!==', '<', '>', '<=', '>=', 'instanceof', 'in'].includes(astNode.operator);
      const isUnaryNot = astNode.type === 'UnaryExpression' && astNode.operator === '!';
      const isILComparison = ['Equals', 'NotEquals', 'LessThan', 'GreaterThan', 'LessThanOrEqual', 'GreaterThanOrEqual', 'StrictEquals', 'StrictNotEquals'].includes(astNode.ilNodeType);

      if (isComparison || isUnaryNot || isILComparison)
        return condition;

      // Special: AlgorithmFramework/OpCodes truthiness checks -> != nil (they are struct pointers)
      if (condition.nodeType === 'Identifier' &&
          (condition.name === 'algorithmFramework' || condition.name === 'AlgorithmFramework' ||
           condition.name === 'OpCodes' || condition.name === 'opCodes'))
        return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));

      const condType = this.inferFullExpressionType(astNode);
      const typeStr = condType?.toString() || '';

      if (typeStr === 'any' || typeStr === 'interface{}')
        return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));

      if (typeStr === 'bool')
        return condition;

      if (this.isNumericType(typeStr))
        return new GoBinaryExpression(condition, '!=', GoLiteral.Int(0));

      if (typeStr === 'string')
        return new GoBinaryExpression(condition, '!=', GoLiteral.String(''));

      if (condType?.isSlice || condType?.isArray)
        return new GoBinaryExpression(
          new GoCallExpression(new GoIdentifier('len'), [condition]),
          '>', GoLiteral.Int(0)
        );

      if (condType?.isMap)
        return new GoBinaryExpression(
          new GoCallExpression(new GoIdentifier('len'), [condition]),
          '>', GoLiteral.Int(0)
        );

      if (condType?.isPointer || typeStr.startsWith('*'))
        return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));

      // Check simple property access for field type lookup
      const isSimplePropertyAccess = ['ThisPropertyAccess', 'MemberExpression', 'Identifier'].includes(astNode.type);
      if (isSimplePropertyAccess) {
        const propName = astNode.property || astNode.name;
        if (propName) {
          const fieldType = this.structFieldTypes.get(propName) ||
                           this.structFieldTypes.get(this.toPascalCase(propName));
          const fieldTypeStr = fieldType?.toString() || '';
          if (fieldTypeStr === 'any' || fieldTypeStr === 'interface{}')
            return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));
          if (this.isNumericType(fieldTypeStr))
            return new GoBinaryExpression(condition, '!=', GoLiteral.Int(0));
          if (fieldTypeStr === 'string')
            return new GoBinaryExpression(condition, '!=', GoLiteral.String(''));
          if (fieldType?.isSlice || fieldType?.isArray)
            return new GoBinaryExpression(
              new GoCallExpression(new GoIdentifier('len'), [condition]),
              '>', GoLiteral.Int(0)
            );
          return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));
        }
        return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));
      }

      if (typeStr && typeStr !== 'bool')
        return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));

      // Type inference failed - apply heuristic based on expression structure
      if (!typeStr) {
        if (astNode.type === 'BinaryExpression' && ['&', '|', '^', '<<', '>>', '>>>'].includes(astNode.operator))
          return new GoBinaryExpression(condition, '!=', GoLiteral.Int(0));
        if (astNode.type === 'CallExpression' || astNode.type === 'OpCodesCall')
          return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));
        if (astNode.type === 'AssignmentExpression' || astNode.type === 'UpdateExpression')
          return new GoBinaryExpression(condition, '!=', GoLiteral.Int(0));
        if (astNode.type === 'IndexExpression' || astNode.type === 'ArrayAccess')
          return new GoBinaryExpression(condition, '!=', GoLiteral.Int(0));
        return new GoBinaryExpression(condition, '!=', new GoLiteral(null, 'nil'));
      }

      return condition;
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
        case 'Identifier': {
          const varType = this.variableTypes.get(node.name);
          if (varType) return varType;
          // Use IL resultType for non-scalar types (slices, strings, booleans)
          // but not for numeric scalars (IL uses int32 while Go crypto needs uint32)
          const ilType = this.mapILResultType(node.resultType);
          if (ilType && (ilType.isSlice || ilType.name === 'string' || ilType.name === 'bool'))
            return ilType;
          return this.inferTypeFromName(node.name);
        }
        case 'CallExpression':
          return this.inferCallExpressionType(node);
        case 'ArrayExpression': {
          // IL may annotate ArrayExpression with elementType
          if (node.elementType) {
            // Handle both string and object { name: 'type' } formats
            const rawType = typeof node.elementType === 'string' ? node.elementType : node.elementType?.name;
            const typeStr = rawType?.toLowerCase();
            if (typeStr === 'uint8' || typeStr === 'byte') return GoType.Slice(GoType.UInt8());
            if (typeStr === 'uint32' || typeStr === 'long') return GoType.Slice(GoType.UInt32());
            if (typeStr === 'uint16' || typeStr === 'integer') return GoType.Slice(GoType.UInt16());
            if (typeStr === 'int32') {
              // Check if any values exceed INT32_MAX or are negative (unsigned values stored as signed) - use uint32 instead
              const INT32_MAX = 2147483647;
              const hasOverflow = (node.elements || []).some(el =>
                el && el.type === 'Literal' && typeof el.value === 'number' && (el.value > INT32_MAX || el.value < 0)
              );
              return GoType.Slice(hasOverflow ? GoType.UInt32() : GoType.Int32());
            }
            if (typeStr === 'int16') return GoType.Slice(GoType.Int16());
            if (typeStr === 'int8') return GoType.Slice(GoType.Int8());
            if (typeStr === 'float32') return GoType.Slice(GoType.Float32());
            if (typeStr === 'float64' || typeStr === 'double') return GoType.Slice(GoType.Float64());
            if (typeStr === 'uint64') return GoType.Slice(GoType.UInt64());
            if (typeStr === 'int64') {
              const INT64_MAX = 9223372036854775807n;
              const hasOverflow = (node.elements || []).some(el =>
                el && el.type === 'Literal' && typeof el.value === 'bigint' && (el.value > INT64_MAX || el.value < 0n)
              );
              return GoType.Slice(hasOverflow ? GoType.UInt64() : GoType.Int64());
            }
          }
          // Fallback to element inference
          if (node.elements && node.elements.length > 0) {
            const elemType = this.inferFullExpressionType(node.elements[0]);
            return GoType.Slice(elemType);
          }
          return GoType.Slice(GoType.UInt8());
        }
        case 'ArrayLiteral': {
          // ArrayLiteral from TypedArray - use IL's elementType
          if (node.elementType) {
            // Handle both string and object { name: 'type' } formats
            const rawType = typeof node.elementType === 'string' ? node.elementType : node.elementType?.name;
            const typeStr = rawType?.toLowerCase();
            if (typeStr === 'uint8' || typeStr === 'byte') return GoType.Slice(GoType.UInt8());
            if (typeStr === 'uint32' || typeStr === 'long') return GoType.Slice(GoType.UInt32());
            if (typeStr === 'uint16' || typeStr === 'integer') return GoType.Slice(GoType.UInt16());
            if (typeStr === 'int32') {
              // Check if any values exceed INT32_MAX or are negative (unsigned values stored as signed) - use uint32 instead
              const INT32_MAX = 2147483647;
              const hasOverflow = (node.elements || []).some(el =>
                el && el.type === 'Literal' && typeof el.value === 'number' && (el.value > INT32_MAX || el.value < 0)
              );
              return GoType.Slice(hasOverflow ? GoType.UInt32() : GoType.Int32());
            }
            if (typeStr === 'int16') return GoType.Slice(GoType.Int16());
            if (typeStr === 'int8') return GoType.Slice(GoType.Int8());
            if (typeStr === 'float32') return GoType.Slice(GoType.Float32());
            if (typeStr === 'float64' || typeStr === 'double') return GoType.Slice(GoType.Float64());
            if (typeStr === 'uint64') return GoType.Slice(GoType.UInt64());
            if (typeStr === 'int64') {
              const INT64_MAX = 9223372036854775807n;
              const hasOverflow = (node.elements || []).some(el =>
                el && el.type === 'Literal' && typeof el.value === 'bigint' && (el.value > INT64_MAX || el.value < 0n)
              );
              return GoType.Slice(hasOverflow ? GoType.UInt64() : GoType.Int64());
            }
          }
          // Fallback to element inference
          if (node.elements && node.elements.length > 0) {
            const elemType = this.inferFullExpressionType(node.elements[0]);
            return GoType.Slice(elemType);
          }
          return GoType.Slice(GoType.UInt8());
        }
        case 'UnaryExpression':
          // ! operator returns boolean
          if (node.operator === '!') {
            return GoType.Bool();
          }
          return this.inferFullExpressionType(node.argument);
        case 'LogicalExpression': {
          // In Go, && and || only work on booleans and return boolean
          // But in JavaScript, || returns first truthy value, && returns last truthy or first falsy
          // If operands are booleans, return bool; otherwise return operand type or interface{}
          const logLeftType = this.inferFullExpressionType(node.left);
          const logRightType = this.inferFullExpressionType(node.right);
          const logLeftStr = logLeftType?.toString() || '';
          const logRightStr = logRightType?.toString() || '';

          if (logLeftStr === 'bool' && logRightStr === 'bool')
            return GoType.Bool();

          // For || with non-booleans, return type matches operand type (or interface{})
          if (logLeftStr === logRightStr)
            return logLeftType;

          // For || as null-coalescing: prefer concrete type over interface{}
          if (node.operator === '||') {
            const leftIsInterface = logLeftStr === 'interface{}' || logLeftStr === 'any' || logLeftStr === '';
            const rightIsInterface = logRightStr === 'interface{}' || logRightStr === 'any' || logRightStr === '';
            if (leftIsInterface && !rightIsInterface) return logRightType;
            if (!leftIsInterface && rightIsInterface) return logLeftType;
            // Both concrete but different numeric types: use left (JS || returns left if truthy)
            if (!leftIsInterface && !rightIsInterface && this.isNumericType(logLeftStr) && this.isNumericType(logRightStr))
              return logLeftType;
          }

          // For && short-circuit: result type is right operand's type
          if (node.operator === '&&') {
            const leftIsInterface = logLeftStr === 'interface{}' || logLeftStr === 'any' || logLeftStr === '';
            const rightIsInterface = logRightStr === 'interface{}' || logRightStr === 'any' || logRightStr === '';
            if (!rightIsInterface) return logRightType;
            if (!leftIsInterface) return logLeftType;
          }

          // Mixed types - return interface{}
          return GoType.Interface();
        }
        case 'BinaryExpression': {
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

          // Apply type coercion rules matching transformBinaryExpression
          const leftTypeStr = leftType?.name || leftType?.toString() || '';
          const rightTypeStr = rightType?.name || rightType?.toString() || '';
          const ARITHMETIC_OPS = ['+', '-', '*', '/', '%', '+=', '-=', '*=', '/=', '%='];
          const BITWISE_OPS = ['&', '|', '^', '&^', '<<', '>>', '&=', '|=', '^='];

          const isLeftInt = leftTypeStr === 'int';
          const isRightInt = rightTypeStr === 'int';
          const isLeftUint32 = leftTypeStr === 'uint32';
          const isRightUint32 = rightTypeStr === 'uint32';
          const isBitwise = BITWISE_OPS.includes(op);
          const isArithmetic = ARITHMETIC_OPS.includes(op);

          // For int/uint32 mismatch, apply same coercion as transformBinaryExpression
          if (isArithmetic || isBitwise) {
            if ((isLeftInt && isRightUint32) || (isRightInt && isLeftUint32)) {
              // Bitwise: result is uint32 (int cast to uint32)
              // Arithmetic: result is int (uint32 cast to int)
              return isBitwise ? GoType.UInt32() : GoType.Int();
            }
          }

          // When one side is any/interface{} and the other is concrete in bitwise/arithmetic ops,
          // the transform will type-assert the any side, so return the concrete type
          if (isArithmetic || isBitwise) {
            const isLeftAny = !leftTypeStr || leftTypeStr === 'any' || leftTypeStr === 'interface{}';
            const isRightAny = !rightTypeStr || rightTypeStr === 'any' || rightTypeStr === 'interface{}';
            if (isLeftAny && !isRightAny) return rightType;
            if (isRightAny && !isLeftAny) return leftType;
          }

          const widerType = this.getWiderType(leftType, rightType);
          // If Go inference yields any/interface{}, use IL resultType as fallback
          const widerStr = widerType?.name || widerType?.toString() || '';
          if (!widerStr || widerStr === 'any' || widerStr === 'interface{}') {
            const ilType = this.mapILResultType(node.resultType);
            if (ilType && ilType.name !== 'any' && ilType.name !== 'interface{}')
              return ilType;
          }
          return widerType;
        }
        case 'NewExpression': {
          // Get the type name from the callee
          let typeName = node.callee.name;
          if (!typeName && node.callee.type === 'MemberExpression') {
            // Handle AlgorithmFramework.ClassName pattern
            typeName = node.callee.property?.name || node.callee.property;
          }
          if (typeName === 'Array') {
            return GoType.Slice(GoType.Interface());
          }
          // Helper classes are value types, not pointer types
          const HELPER_CLASSES_FOR_TYPE = ['KeySize', 'LinkItem', 'TestCase', 'Vulnerability', 'TestCategory'];
          if (HELPER_CLASSES_FOR_TYPE.includes(typeName)) {
            return new GoType(typeName);
          }
          // new Type() -> &Type{} which is a pointer type
          return GoType.Pointer(new GoType(typeName || 'interface{}'));
        }
        case 'MemberExpression':
        case 'ThisPropertyAccess':
          // Handle computed (index) access: arr[i] should return element type
          if (node.computed) {
            const baseType = this.inferFullExpressionType(node.object);
            // Slice element type is stored in valueType (see GoType.Slice())
            const elemType = baseType?.valueType || baseType?.elementType;
            if (baseType && baseType.isSlice && elemType) {
              return elemType;
            }
            // Fallback - use IL resultType for non-scalar types
            {
              const ilIdxType = this.mapILResultType(node.resultType);
              if (ilIdxType && (ilIdxType.isSlice || ilIdxType.name === 'string' || ilIdxType.name === 'bool'))
                return ilIdxType;
            }
            return GoType.Interface();
          }

          // Check if object type is any/interface{}/map - accessing any property returns interface{}
          // But NOT for this.property access - that should check struct field types
          const isThisAccess = node.object?.type === 'ThisExpression' ||
                               node.type === 'ThisPropertyAccess';
          if (!isThisAccess && node.object) {
            const objBaseType = this.inferFullExpressionType(node.object);
            const objBaseTypeStr = objBaseType?.toString() || '';
            if (objBaseTypeStr === 'any' || objBaseTypeStr === 'interface{}' ||
                objBaseTypeStr.startsWith('map[')) {
              // config.base where config is any/map -> use IL resultType for non-scalar types
              {
                const ilMapType = this.mapILResultType(node.resultType);
                if (ilMapType && (ilMapType.isSlice || ilMapType.name === 'string' || ilMapType.name === 'bool'))
                  return ilMapType;
              }
              return GoType.Interface();
            }
          }

          // For member expressions, first check if we know the struct field type
          let propNameForType = node.property?.name || node.property;
          if (propNameForType && typeof propNameForType === 'string') {
            // Check struct field types first (these are the declared types)
            const fieldType = this.structFieldTypes.get(propNameForType);
            if (fieldType) return fieldType;
            // Check with PascalCase (removing underscore prefix if present)
            let baseName = propNameForType;
            if (baseName.startsWith('_')) baseName = baseName.slice(1);
            const pascalFieldType = this.structFieldTypes.get(
              baseName.charAt(0).toUpperCase() + baseName.slice(1)
            );
            if (pascalFieldType) return pascalFieldType;
            // Also check lowercase version
            const lowerFieldType = this.structFieldTypes.get(baseName.toLowerCase());
            if (lowerFieldType) return lowerFieldType;
            // Use IL resultType for non-scalar types before falling back to name-based heuristics
            const ilMemberType = this.mapILResultType(node.resultType);
            if (ilMemberType && (ilMemberType.isSlice || ilMemberType.name === 'string' || ilMemberType.name === 'bool'))
              return ilMemberType;
            // Fall back to name-based inference
            return this.inferTypeFromName(propNameForType);
          }
          {
            const ilFinalType = this.mapILResultType(node.resultType);
            if (ilFinalType && (ilFinalType.isSlice || ilFinalType.name === 'string' || ilFinalType.name === 'bool'))
              return ilFinalType;
          }
          return GoType.Interface();

        // IL AST node types for cryptographic operations
        case 'PackBytes':
          // PackBytes packs bytes into a uint - return uint type based on bits
          const packBits = node.bits || 32;
          if (packBits === 16) return GoType.UInt16();
          if (packBits === 64) return GoType.UInt64();
          return GoType.UInt32();
        case 'UnpackBytes':
          // UnpackBytes returns a byte slice
          return GoType.Slice(GoType.UInt8());
        case 'HexDecode':
          // HexDecode returns a byte slice
          return GoType.Slice(GoType.UInt8());
        case 'ArrayLength':
          // Array length returns int
          return GoType.Int();
        case 'ArraySlice':
          // Slice of an array - infer element type from array
          const arrType = this.inferFullExpressionType(node.array);
          return arrType;
        case 'ArrayCreation':
          // Array creation returns a slice
          return GoType.Slice(node.elementType ? new GoType(node.elementType) : GoType.UInt8());
        case 'TypedArrayCreation': {
          // TypedArrayCreation - use elementType from IL, with overflow check for int32
          const rawElemType = node.elementType || node.resultType?.replace('[]', '') || 'uint8';
          const elemStr = typeof rawElemType === 'string' ? rawElemType.toLowerCase() : rawElemType;
          if (elemStr === 'int32') {
            // Check if values exceed INT32_MAX -> use uint32
            const INT32_MAX = 2147483647;
            const hasOverflow = (node.elements || []).some(el =>
              el && el.type === 'Literal' && typeof el.value === 'number' && (el.value > INT32_MAX || el.value < 0)
            );
            return GoType.Slice(hasOverflow ? GoType.UInt32() : GoType.Int32());
          }
          if (elemStr === 'uint32') return GoType.Slice(GoType.UInt32());
          if (elemStr === 'uint16') return GoType.Slice(GoType.UInt16());
          if (elemStr === 'uint64') return GoType.Slice(GoType.UInt64());
          if (elemStr === 'int64') return GoType.Slice(GoType.Int64());
          if (elemStr === 'int16') return GoType.Slice(new GoType('int16'));
          if (elemStr === 'float32') return GoType.Slice(new GoType('float32'));
          if (elemStr === 'float64') return GoType.Slice(GoType.Float64());
          return GoType.Slice(GoType.UInt8());
        }
        case 'ArrayFill':
          // ArrayFill creates a filled slice - use result type if available
          if (node.resultType) {
            const fillType = this.mapILResultType(node.resultType);
            if (fillType) return fillType;
          }
          return GoType.Slice(GoType.UInt8());
        case 'ArraySplice': {
          // ArraySplice returns a slice - infer from the array being spliced
          const spliceArrType = node.array ? this.inferFullExpressionType(node.array) : null;
          if (spliceArrType?.isSlice) return spliceArrType;
          // Fall back to resultType
          if (node.resultType) {
            const spliceType = this.mapILResultType(node.resultType);
            if (spliceType) return spliceType;
          }
          return GoType.Slice(GoType.UInt8());
        }
        case 'ArrayConcat': {
          // ArrayConcat returns a slice - infer from the first array
          const concatArrType = node.arrays?.[0] ? this.inferFullExpressionType(node.arrays[0]) : null;
          if (concatArrType?.isSlice) return concatArrType;
          if (node.resultType) {
            const concatType = this.mapILResultType(node.resultType);
            if (concatType) return concatType;
          }
          return GoType.Slice(GoType.UInt8());
        }
        case 'ArrayReverse':
        case 'ArrayCopy':
        case 'ArrayFrom': {
          // These return the same type as their input array
          const inputArr = node.array || node.argument;
          if (inputArr) {
            const inputType = this.inferFullExpressionType(inputArr);
            if (inputType?.isSlice) return inputType;
          }
          if (node.resultType) {
            const arrResultType = this.mapILResultType(node.resultType);
            if (arrResultType) return arrResultType;
          }
          return GoType.Slice(GoType.UInt8());
        }
        case 'BigIntCast':
        case 'BigIntLiteral':
          // BigInt values -> uint64 in Go
          return GoType.UInt64();
        case 'ObjectFreeze':
        case 'ObjectSeal': {
          // Object.freeze(array) / Object.seal(array) - infer type from the inner object/array
          const innerArg = node.object || node.argument || node.arguments?.[0];
          if (innerArg) {
            const innerType = this.inferFullExpressionType(innerArg);
            if (innerType) return innerType;
          }
          // Fall back to resultType with int32->uint32 overflow check for arrays
          if (node.resultType) {
            const rt = node.resultType;
            if (rt === 'int32[]') {
              const INT32_MAX = 2147483647;
              const elems = innerArg?.elements || node.elements || [];
              const hasOverflow = elems.some(el =>
                el && el.type === 'Literal' && typeof el.value === 'number' && (el.value > INT32_MAX || el.value < 0)
              );
              return GoType.Slice(hasOverflow ? GoType.UInt32() : GoType.Int32());
            }
            const frozenType = this.mapILResultType(rt);
            if (frozenType) return frozenType;
          }
          return GoType.Interface();
        }
        case 'TypeConversion':
          // Type conversion returns the target type
          return new GoType(node.targetType || 'uint32');
        case 'BitRotation':
        case 'BitwiseOp':
          // Bit operations return uint32
          return GoType.UInt32();
        case 'ThisMethodCall':
          // Method call - look up registered return type
          if (node.method) {
            const returnType = this.methodReturnTypes.get(node.method) ||
                               this.methodReturnTypes.get(this.toPascalCase(node.method));
            if (returnType) return returnType;
          }
          {
            const ilMethodType = this.mapILResultType(node.resultType);
            if (ilMethodType && (ilMethodType.isSlice || ilMethodType.name === 'string' || ilMethodType.name === 'bool'))
              return ilMethodType;
          }
          return GoType.Interface();
        case 'SpreadElement':
          // Spread element preserves the array type
          return this.inferFullExpressionType(node.argument);

        case 'ObjectExpression':
        case 'ObjectLiteral':
          // Object literal -> map[string]interface{}
          return new GoType('map[string]interface{}');

        case 'TemplateLiteral':
          // Template literals become fmt.Sprintf which returns string
          return GoType.String();

        case 'Cast':
          // Cast returns the target type
          const castTargetType = node.targetType || 'int';
          switch (castTargetType) {
            case 'uint8': case 'byte': return GoType.UInt8();
            case 'uint16': return GoType.UInt16();
            case 'uint32': return GoType.UInt32();
            case 'uint64': return GoType.UInt64();
            case 'int8': return new GoType('int8');
            case 'int16': return new GoType('int16');
            case 'int32': return new GoType('int32');
            case 'int64': return new GoType('int64');
            case 'int': return GoType.Int();
            case 'float32': return new GoType('float32');
            case 'float64': return GoType.Float64();
            case 'bool': return GoType.Bool();
            case 'string': return GoType.String();
            default: return GoType.UInt32();
          }

        case 'Floor':
        case 'Ceil':
        case 'Round':
          // For integer division arguments, floor/ceil return the operand type
          // (Go's integer division already floors for positive numbers)
          // Otherwise they return float64
          {
            const argNode = node.argument || node.arguments?.[0];
            if (argNode?.type === 'BinaryExpression' && argNode.operator === '/') {
              const leftType = this.inferFullExpressionType(argNode.left);
              const rightType = this.inferFullExpressionType(argNode.right);
              const leftName = leftType?.name || '';
              const rightName = rightType?.name || '';
              if ((leftName.startsWith('int') || leftName.startsWith('uint')) &&
                  (rightName.startsWith('int') || rightName.startsWith('uint'))) {
                return this.getWiderType(leftType, rightType);
              }
            }
            return GoType.Int(); // In crypto code, floor typically returns int
          }
        case 'Abs':
        case 'Sin':
        case 'Cos':
        case 'Tan':
        case 'Asin':
        case 'Acos':
        case 'Atan':
        case 'Atan2':
        case 'Sinh':
        case 'Cosh':
        case 'Tanh':
        case 'Exp':
        case 'Cbrt':
        case 'Hypot':
        case 'Sqrt':
        case 'Log':
        case 'Sign':
        case 'Pow':
        case 'Power':
          // Math functions return float64
          return GoType.Float64();

        case 'Fround':
          // Math.fround returns float32
          return new GoType('float32');

        case 'MathConstant':
          // Math constants (PI, E, etc.) are float64
          return GoType.Float64();

        case 'NumberConstant':
          // Number constants - most are float64, some are int
          if (node.name === 'MAX_SAFE_INTEGER' || node.name === 'MIN_SAFE_INTEGER')
            return GoType.Int64();
          return GoType.Float64();

        case 'InstanceOfCheck':
          // instanceof returns boolean
          return GoType.Bool();

        case 'Min':
        case 'Max':
          // Min/Max return numeric type - infer from arguments
          if (node.arguments?.[0]) {
            return this.inferFullExpressionType(node.arguments[0]);
          }
          return GoType.Float64();

        case 'RotateLeft':
        case 'RotateRight':
        case 'Rotation':
          // Bit rotation returns uint32
          return GoType.UInt32();

        case 'MathCall':
          // Math call - check method
          if (node.method === 'imul') return GoType.Int();
          if (node.method === 'abs') return GoType.Float64();
          if (node.method === 'floor' || node.method === 'ceil' || node.method === 'round') return GoType.Float64();
          return GoType.Float64();

        case 'OpCodesCall':
          // OpCodes return types depend on the method
          const opMethod = node.method || '';
          if (opMethod.includes('Pack')) return GoType.UInt32();
          if (opMethod.includes('Unpack')) return GoType.Slice(GoType.UInt8());
          if (opMethod.includes('Rot')) return GoType.UInt32();
          if (opMethod.includes('Xor') && opMethod.includes('Array')) return GoType.Slice(GoType.UInt8());
          // CopyArray/CloneArray returns the same type as the input array
          if (opMethod === 'CopyArray' || opMethod === 'CloneArray') {
            const argNode = node.arguments?.[0];
            if (argNode) {
              const argType = this.inferFullExpressionType(argNode);
              if (argType?.isSlice || argType?.isArray) return argType;
            }
            return GoType.Slice(GoType.UInt8());
          }
          return GoType.UInt32();

        case 'AssignmentExpression':
          // Assignment returns the assigned value type
          return this.inferFullExpressionType(node.right);

        case 'ConditionalExpression':
          // Ternary returns the type of the consequent/alternate
          return this.inferFullExpressionType(node.consequent);

        case 'ArrayReduce': {
          // reduce returns the element type of the array for typed variants
          const reduceArrType = this.inferFullExpressionType(node.array);
          const reduceElemType = reduceArrType?.isSlice ? (reduceArrType.valueType || reduceArrType.elementType) : null;
          if (reduceElemType) return reduceElemType;
          return GoType.Interface();
        }

        case 'ArrayMap':
        case 'ArrayFilter':
          // map/filter preserves the array type
          return this.inferFullExpressionType(node.array);

        case 'ArrayFind':
        case 'ArrayIndexOf':
        case 'ArrayFindIndex': {
          // find returns element type; indexOf/findIndex returns int
          if (node.type === 'ArrayFind') {
            const findArrType = this.inferFullExpressionType(node.array);
            return findArrType?.isSlice ? (findArrType.valueType || findArrType.elementType || GoType.Interface()) : GoType.Interface();
          }
          return GoType.Int();
        }

        default:
          // Fallback: use IL AST's resultType for non-scalar types (slices, strings, booleans)
          // Numeric scalars are not used because IL uses signed types (int32) while Go crypto needs unsigned (uint32)
          {
            // Special handling for int32[] - check for overflow to use uint32 instead
            const rt = node?.resultType;
            if (rt === 'int32[]') {
              const INT32_MAX = 2147483647;
              const elems = node.elements || node.argument?.elements || [];
              const hasOverflow = elems.some(el =>
                el && el.type === 'Literal' && typeof el.value === 'number' && (el.value > INT32_MAX || el.value < 0)
              );
              return GoType.Slice(hasOverflow ? GoType.UInt32() : GoType.Int32());
            }
            const ilDefaultType = this.mapILResultType(rt);
            if (ilDefaultType && (ilDefaultType.isSlice || ilDefaultType.name === 'string' || ilDefaultType.name === 'bool'))
              return ilDefaultType;
          }
          return GoType.Interface();
      }
    }

    /**
     * Maps an IL AST resultType string to a GoType.
     * IL nodes carry resultType annotations (e.g., 'uint32', 'uint8[]', 'bigint', 'boolean')
     * that can be used as a fallback when specific type inference cases aren't handled.
     * @param {string|null} resultType - The IL resultType annotation
     * @returns {GoType|null} The mapped GoType, or null if resultType is missing/unknown
     */
    mapILResultType(resultType) {
      if (!resultType) return null;
      const rt = typeof resultType === 'string' ? resultType : resultType.toString?.() || '';
      if (!rt || rt === 'undefined' || rt === 'null') return null;

      // Array/slice types: "uint8[]", "uint32[]", "int32[][]", etc.
      if (rt.endsWith('[][]')) {
        const elemBase = rt.slice(0, -4);
        const inner = this.mapILResultType(elemBase + '[]');
        return inner ? GoType.Slice(inner) : GoType.Slice(GoType.Slice(GoType.UInt8()));
      }
      if (rt.endsWith('[]')) {
        const elemType = rt.slice(0, -2);
        const goElem = this.mapILResultType(elemType);
        return GoType.Slice(goElem || GoType.UInt8());
      }

      // Scalar types
      switch (rt) {
        case 'uint8': case 'byte': return GoType.UInt8();
        case 'uint16': return GoType.UInt16();
        case 'uint32': return GoType.UInt32();
        case 'uint64': return GoType.UInt64();
        case 'int8': return new GoType('int8');
        case 'int16': return new GoType('int16');
        case 'int32': return new GoType('int32');
        case 'int64': return new GoType('int64');
        case 'int': return GoType.Int();
        case 'float32': return new GoType('float32');
        case 'float64': return GoType.Float64();
        case 'boolean': case 'bool': return GoType.Bool();
        case 'string': return GoType.String();
        case 'bigint': return GoType.UInt64(); // Go doesn't have native bigint; use uint64 as approximation
        case 'number': return GoType.Float64();
        case 'usize': return GoType.Int();
        default: return null;
      }
    }

    inferLiteralType(node) {
      if (node.value === null) return GoType.Interface();
      if (typeof node.value === 'boolean') return GoType.Bool();
      if (typeof node.value === 'string') return GoType.String();
      if (typeof node.value === 'number') {
        return Number.isInteger(node.value) ? GoType.UInt32() : GoType.Float64();
      }
      // BigInt literals
      if (typeof node.value === 'bigint') return GoType.UInt64();
      return GoType.Interface();
    }

    inferTypeFromName(name) {
      if (!name) return GoType.UInt32();
      const lowerName = name.toLowerCase();

      if (lowerName.includes('byte') || lowerName === 'b') {
        return GoType.UInt8();
      }
      // Boolean fields - use strict matching to avoid false positives
      // 'init' matches too broadly (INIT_ROUNDS, initState etc.) so only match exact forms
      // 'encrypt'/'decrypt' matches too broadly (encryptBlock, decryptFunction) so only match exact
      if (lowerName === 'inverse' || lowerName === 'isinverse' ||
          lowerName === 'encrypt' || lowerName === 'decrypt' ||
          lowerName === 'initialized' || lowerName === 'isinitialized' ||
          lowerName.startsWith('is_') || lowerName.startsWith('has_') ||
          // Use original name to check camelCase: isXxx, hasXxx
          (name.startsWith('is') && name.length > 2 && name[2] >= 'A' && name[2] <= 'Z') ||
          (name.startsWith('has') && name.length > 3 && name[3] >= 'A' && name[3] <= 'Z') ||
          // Also match supports/needs patterns
          lowerName.startsWith('supports') || lowerName.startsWith('needs') ||
          // Mid-word boolean indicators: KeyIs128, flagIsSet, etc.
          /(?:[a-z])(?:Is|Has|Should|Can|Will)[A-Z0-9]/.test(name)) {
        return GoType.Bool();
      }
      // IV/nonce fields are typically byte slices
      if (lowerName === 'iv' || lowerName === '_iv' || lowerName === 'nonce' ||
          lowerName === '_nonce') {
        return GoType.Slice(GoType.UInt8());
      }
      // Size/length/count/index fields should be int - check BEFORE block/key/state patterns
      // This handles blockSize, keySize, stateSize etc. which should be int, not []uint8
      // Also catches keyLen, blockLen, dataLen etc.
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName.endsWith('len') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return GoType.Int();
      }
      // Numeric suffixes: names ending with offset/position/number/bits/rounds/etc.
      // These indicate numeric values, not byte slices - check before key/block patterns
      if (lowerName.endsWith('offset') || lowerName.endsWith('pos') ||
          lowerName.endsWith('position') || lowerName.endsWith('idx') ||
          lowerName.endsWith('num') || lowerName.endsWith('nr') ||
          lowerName.endsWith('bits') || lowerName.endsWith('rounds') ||
          lowerName.endsWith('steps') || lowerName.endsWith('shift') ||
          lowerName.endsWith('mask') || lowerName.endsWith('width') ||
          lowerName.endsWith('height') || lowerName.endsWith('depth')) {
        return lowerName.endsWith('mask') ? GoType.UInt32() : GoType.Int();
      }
      // ALL_CAPS prefix constants: MAX_*, MIN_*, NUM_*, TOTAL_* are always numeric
      if (/^(MAX|MIN|NUM|TOTAL)_/i.test(name) && /^[A-Z][A-Z0-9_]*$/.test(name))
        return GoType.UInt32();

      // S-box, LFSR, and similar register/permutation arrays are byte arrays
      // Check before ALL_CAPS to catch SBOX, S_BOX, PERMUTATION, LFSR etc.
      // For 'state' names, skip ALL_CAPS forms like MAX_STATE, INITIAL_STATE
      // which are numeric constants rather than state arrays
      if (lowerName === 's' || lowerName === 'sbox' || lowerName === 's_box' ||
          lowerName.includes('permut') ||
          (lowerName.includes('state') && !/^[A-Z][A-Z0-9_]*$/.test(name)) ||
          lowerName === 'state' ||
          lowerName.includes('lfsr') || lowerName.includes('nfsr') ||
          lowerName === 'cells' || lowerName === 'register' ||
          lowerName.includes('keystream') || lowerName.includes('feedback')) {
        return GoType.Slice(GoType.UInt8());
      }
      // Numeric constant fields: ROUNDS, TOTAL_SUBKEYS, HALF_BLOCK, etc.
      // All-uppercase names with underscores are typically numeric constants
      // sbox/perm already caught above; allow key/block/table through as numeric
      if (/^[A-Z][A-Z0-9_]*$/.test(name) && !lowerName.includes('sbox') &&
          !lowerName.includes('s_box') && !lowerName.includes('permut')) {
        return GoType.UInt32();
      }
      // Block/key/data fields are byte slices - use word-boundary matching
      // Only match when the word appears as a complete segment in camelCase or snake_case
      if (this._nameIndicatesByteSlice(name, lowerName)) {
        return GoType.Slice(GoType.UInt8());
      }
      // Config-like fields should be map[string]interface{}
      if (lowerName === 'config' || lowerName.endsWith('config') ||
          lowerName.endsWith('options') || lowerName.endsWith('settings')) {
        return GoType.Map(GoType.String(), GoType.Interface());
      }
      return GoType.UInt32();
    }

    // Check if a name indicates a byte-slice type using word-boundary-aware matching
    _nameIndicatesByteSlice(name, lowerName) {
      // Exact matches for common byte-slice names
      const exactSliceNames = [
        'key', 'keys', 'data', 'input', 'output', 'block', 'buffer',
        'plaintext', 'ciphertext', 'message', 'digest', 'tag', 'aad',
        'result', 'hash', 'salt', 'seed', 'tweak', 'header', 'payload',
        '_key', '_data', '_input', '_output', '_block', '_buffer',
      ];
      if (exactSliceNames.includes(lowerName))
        return true;
      // Compound names where the last word is a byte-slice word
      // e.g., roundKey, subKey, inputData, outputBlock, masterKey
      if (/(?:key|keys|data|block|buffer|text|hash|salt|nonce)$/i.test(name) &&
          // But NOT when preceded by a numeric/count indicator
          !/(?:num|nr|total|max|min|half)$/i.test(name.replace(/(?:key|keys|data|block|buffer|text|hash|salt|nonce)$/i, '')))
        return true;
      // Names starting with a byte-slice word followed by typical data suffixes
      // e.g., keyBytes, keyData, blockData, inputBuffer
      if (/^(?:key|block|data|input|output)(?:bytes|data|buffer|stream|slice|array|chunk|part|half|left|right|word|words)$/i.test(lowerName))
        return true;
      // plaintext/ciphertext/message/digest/aad anywhere in compound name
      if (lowerName.includes('plaintext') || lowerName.includes('ciphertext') ||
          lowerName.includes('message') || lowerName.includes('digest') ||
          lowerName.includes('aad'))
        return true;
      return false;
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

        // slice/subarray/concat preserve the source array type
        if (method === 'slice' || method === 'subarray' || method === 'concat') {
          const objType = this.inferFullExpressionType(obj);
          if (objType && objType.isSlice) return objType;
        }

        // Check registered method return types for any method call (e.g., instance.Result())
        const registeredMethodType = this.methodReturnTypes.get(method) ||
                                     this.methodReturnTypes.get(this.toPascalCase(method));
        if (registeredMethodType) return registeredMethodType;
      }

      // Handle Identifier call expressions (helper functions)
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name;
        const pascalName = this.toPascalCase(funcName);

        // Check registered method return types first (handles local functions)
        const registeredType = this.methodReturnTypes.get(funcName) ||
                               this.methodReturnTypes.get(pascalName);
        if (registeredType) return registeredType;

        // Go helper functions for byte packing - return uint types
        if (/^pack(16|32|64)(BE|LE)(Slice)?$/i.test(funcName)) {
          const bits = funcName.match(/\d+/)?.[0];
          if (bits === '16') return GoType.UInt16();
          if (bits === '64') return GoType.UInt64();
          return GoType.UInt32();
        }
        // Go helper functions for byte unpacking - return []uint8
        if (/^unpack(16|32|64)(BE|LE)$/i.test(funcName)) {
          return GoType.Slice(GoType.UInt8());
        }
        // len() returns int
        if (funcName === 'len') return GoType.Int();
        // mustHexDecode returns []uint8
        if (funcName === 'mustHexDecode') return GoType.Slice(GoType.UInt8());
        // makeFilledSlice returns []byte
        if (funcName === 'makeFilledSlice') return GoType.Slice(GoType.Byte());
        // xorArrays returns []byte
        if (funcName === 'xorArrays') return GoType.Slice(GoType.Byte());
        // copySlice returns []byte
        if (funcName === 'copySlice') return GoType.Slice(GoType.Byte());
        // make returns the specified type (handled elsewhere)
        if (funcName === 'make') return GoType.Interface();
        // int/uint32/uint8 conversion functions
        if (funcName === 'int') return GoType.Int();
        if (funcName === 'uint32') return GoType.UInt32();
        if (funcName === 'uint8' || funcName === 'byte') return GoType.UInt8();
        if (funcName === 'uint16') return GoType.UInt16();
        if (funcName === 'uint64') return GoType.UInt64();
        if (funcName === 'int32') return GoType.Int32();
        if (funcName === 'int64') return GoType.Int64();
        if (funcName === 'float64') return GoType.Float64();
        if (funcName === 'float32') return GoType.Float32();
        // asciiToBytes returns []byte
        if (funcName === 'asciiToBytes' || funcName === 'ansiToBytes') return GoType.Slice(GoType.Byte());
        // hexToBytes returns []byte
        if (funcName === 'hexToBytes' || funcName === 'hex8ToBytes') return GoType.Slice(GoType.Byte());
        // bytesToHex returns string
        if (funcName === 'bytesToHex' || funcName === 'bytesToHex8') return GoType.String();
        // firstNonNil returns interface{}
        if (funcName === 'firstNonNil' || funcName === 'ifTruthy') return GoType.Interface();
      }

      // Use IL resultType for non-scalar types as fallback for call expressions
      {
        const ilCallType = this.mapILResultType(node.resultType);
        if (ilCallType && (ilCallType.isSlice || ilCallType.name === 'string' || ilCallType.name === 'bool'))
          return ilCallType;
      }
      return GoType.Interface();
    }

    getWiderType(type1, type2) {
      if (!type1 || !type2) return type1 || type2 || GoType.UInt32();

      const widths = {
        'uint8': 8, 'int8': 8,
        'uint16': 16, 'int16': 16,
        'uint32': 32, 'int32': 32, 'int': 32,
        'uint64': 64, 'int64': 64
      };

      const w1 = widths[type1.name] || 32;
      const w2 = widths[type2.name] || 32;

      return w1 >= w2 ? type1 : type2;
    }

    /**
     * Determine if a new type should replace an existing type in method parameter inference.
     * Returns true if:
     * - existingType is generic (interface{}, any)
     * - newType has a larger bit width (e.g., uint32 > uint8)
     * - newType is a slice and existingType is not (or vice versa with better element type)
     */
    shouldReplaceType(existingType, newType) {
      if (!existingType) return true;
      if (!newType) return false;

      const existingName = existingType.name || existingType.toString();
      const newName = newType.name || newType.toString();

      // Always replace generic types
      if (existingName === 'interface{}' || existingName === 'any') return true;

      // If both are integer types, prefer the wider one
      const widths = {
        'uint8': 8, 'int8': 8,
        'uint16': 16, 'int16': 16,
        'uint32': 32, 'int32': 32,
        'uint64': 64, 'int64': 64,
        'int': 32  // platform-dependent, treat as 32
      };

      const existingWidth = widths[existingName];
      const newWidth = widths[newName];

      // Both are integer types - prefer wider
      if (existingWidth && newWidth && newWidth > existingWidth) return true;

      // Both are slice types - check element types
      if (existingType.isSlice && newType.isSlice) {
        const existingElem = existingType.valueType || existingType.elementType;
        const newElem = newType.valueType || newType.elementType;
        if (existingElem && newElem) {
          return this.shouldReplaceType(existingElem, newElem);
        }
      }

      return false;
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

      // Generate framework stub classes at the beginning of file
      const stubs = this.generateFrameworkStubs();
      if (stubs.length > 0) {
        goFile.declarations = [...stubs, ...goFile.declarations];
      }

      // Add collected imports at the beginning
      for (const imp of this.imports) {
        // Use alias for math/bits to avoid shadowing by local 'bits' variable
        const alias = imp === 'math/bits' ? 'mathbits' : null;
        goFile.imports.push(new GoImport(imp, alias));
      }

      return goFile;
    }

    /**
     * Generate stub types for AlgorithmFramework classes used in inheritance
     */
    generateFrameworkStubs() {
      const stubs = [];

      // Framework base type stub definitions (Go syntax using struct embedding)
      const FRAMEWORK_STUBS = {
        'BaseAlgorithm': 'type BaseAlgorithm struct {\n\tName string\n\tDescription string\n\tInventor string\n\tYear int\n\tCategory CategoryType\n\tSubCategory string\n\tSecurityStatus SecurityStatus\n\tComplexity ComplexityType\n\tCountry CountryCode\n\tDocumentation []LinkItem\n\tReferences []LinkItem\n\tKnownVulnerabilities []Vulnerability\n\tTests []TestCase\n\tConfig map[string]interface{}\n}',
        'BlockCipherAlgorithm': 'type BlockCipherAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n\tSupportedBlockSizes []KeySize\n}',
        'StreamCipherAlgorithm': 'type StreamCipherAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n\tSupportedIVSizes []KeySize\n}',
        'HashFunctionAlgorithm': 'type HashFunctionAlgorithm struct {\n\tBaseAlgorithm\n\tOutputSize int\n\tBlockSize int\n}',
        'AsymmetricAlgorithm': 'type AsymmetricAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n}',
        'MacAlgorithm': 'type MacAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n\tOutputSize int\n}',
        'KdfAlgorithm': 'type KdfAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n\tSupportedSaltSizes []KeySize\n}',
        'AeadAlgorithm': 'type AeadAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n\tSupportedNonceSizes []KeySize\n\tSupportedTagSizes []KeySize\n}',
        'CryptoAlgorithm': 'type CryptoAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n}',
        'SymmetricCipherAlgorithm': 'type SymmetricCipherAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n}',
        'AsymmetricCipherAlgorithm': 'type AsymmetricCipherAlgorithm struct {\n\tBaseAlgorithm\n\tSupportedKeySizes []KeySize\n}',
        'EncodingAlgorithm': 'type EncodingAlgorithm struct {\n\tBaseAlgorithm\n}',
        'CompressionAlgorithm': 'type CompressionAlgorithm struct {\n\tBaseAlgorithm\n}',
        'ChecksumAlgorithm': 'type ChecksumAlgorithm struct {\n\tBaseAlgorithm\n\tOutputSize int\n}',
        'ClassicalCipherAlgorithm': 'type ClassicalCipherAlgorithm struct {\n\tBaseAlgorithm\n}',
        'IBlockCipherInstance': 'type IBlockCipherInstance struct {\n\tAlgorithm interface{}\n\tIsInverse bool\n\tKey []byte\n\tInputBuffer []byte\n\tBlockSize int\n\tKeySize int\n}',
        'IStreamCipherInstance': 'type IStreamCipherInstance struct {\n\tAlgorithm interface{}\n\tIsInverse bool\n\tKey []byte\n\tIV []byte\n\tInputBuffer []byte\n}',
        'IHashFunctionInstance': 'type IHashFunctionInstance struct {\n\tAlgorithm interface{}\n\tInputBuffer []byte\n}',
        'IAlgorithmInstance': 'type IAlgorithmInstance struct {\n\tAlgorithm interface{}\n\tIsInverse bool\n\tInputBuffer []byte\n}',
      };

      // Helper struct definitions
      const HELPER_STUBS = {
        'KeySize': 'type KeySize struct {\n\tMinSize int\n\tMaxSize int\n\tStep int\n}',
        'LinkItem': 'type LinkItem struct {\n\tText string\n\tURL string\n}',
        'Vulnerability': 'type Vulnerability struct {\n\tName string\n\tDescription string\n\tMitigation string\n\tURI string\n\tURL string\n\tText string\n\tSeverity string\n}',
        'TestCase': 'type TestCase struct {\n\tText string\n\tURI string\n\tInput interface{}\n\tExpected interface{}\n\tKey interface{}\n\tIV interface{}\n\tNonce interface{}\n\tTag interface{}\n\tAAD interface{}\n\tSalt interface{}\n\tPassword interface{}\n\tInfo interface{}\n\tOutput interface{}\n\tPlaintext interface{}\n\tCiphertext interface{}\n\tHash interface{}\n\tMAC interface{}\n\tSignature interface{}\n\tOutputSize int\n\tBlockSize int\n\tKeySize int\n\tRounds int\n\tSkip int\n\tCount int\n\tMode interface{}\n\tPadding interface{}\n\tAssociatedData interface{}\n\tPublicKey interface{}\n\tPrivateKey interface{}\n\tSeed interface{}\n\tMessage interface{}\n\tDigest interface{}\n\tN interface{}\n\tR interface{}\n\tP interface{}\n\tM interface{}\n\tD interface{}\n\tW interface{}\n\tA interface{}\n\tRows interface{}\n\tCols interface{}\n\tColumns interface{}\n\tAlphabet interface{}\n\tConfig interface{}\n\tParams interface{}\n\tVersion interface{}\n\tVariant interface{}\n\tLevel interface{}\n\tHashAlgorithm interface{}\n\tCounter interface{}\n\tDigits interface{}\n\tShift interface{}\n\tMacSize interface{}\n\tTweak interface{}\n\tParityBits interface{}\n\tRepetitions interface{}\n\tRoundTrip interface{}\n\tSCost interface{}\n\tTCost interface{}\n\tLabel interface{}\n\tOutputLength interface{}\n\tDirection interface{}\n\tTimestamp interface{}\n\tTimestep interface{}\n\tKeyLength interface{}\n\tPadType interface{}\n\tHashFunction interface{}\n\tIterations interface{}\n\tInnerType interface{}\n\tOuterType interface{}\n\tExtended interface{}\n\tShortened interface{}\n\tTimeSteps interface{}\n\tThreshold interface{}\n\tTotalShares interface{}\n\tTestReconstruction interface{}\n\tInverse interface{}\n\tLanguage interface{}\n\tEffectiveBits interface{}\n\tPad interface{}\n\tStepSize interface{}\n\tContext interface{}\n\tCounterBits interface{}\n\tRepetitionCount interface{}\n\tCipher interface{}\n\tCipherName interface{}\n\tTagSize interface{}\n\tTagLength interface{}\n\tMultiplier interface{}\n\tModulo interface{}\n\tPolynomial interface{}\n\tStateSize interface{}\n\tCost interface{}\n\tPasses interface{}\n\tSecret interface{}\n\tSecretKey interface{}\n\tCurve interface{}\n\tRadix interface{}\n\tAD interface{}\n\tCustomization interface{}\n\tOperationMode interface{}\n\tEndian interface{}\n\tReference interface{}\n\tKey2 interface{}\n\tIV1 interface{}\n\tIV2 interface{}\n\tQ interface{}\n\tG interface{}\n\tC interface{}\n\tTweakKey interface{}\n\tUKM interface{}\n\tKEK interface{}\n\tHashBits interface{}\n\tOutputLengthBits interface{}\n\tBlockSizeBits interface{}\n\tBurstLength interface{}\n\tWarmup interface{}\n\tIncrement interface{}\n\tLuxuryLevel interface{}\n\tOtherPublicKey interface{}\n\tForkOutput interface{}\n\tSharing interface{}\n\tWeight interface{}\n\tPositions interface{}\n\tOrder interface{}\n\tBits interface{}\n\tCombinationMode interface{}\n\tLength interface{}\n\tSequence interface{}\n\tValues interface{}\n\tOutputs interface{}\n\tIsDeterministic interface{}\n\tIsInverse interface{}\n}',
      };

      // Enum type definitions
      const ENUM_STUBS = {
        'CategoryType': 'type CategoryType string\nconst (\n\tCategoryBlock CategoryType = "block"\n\tCategoryStream CategoryType = "stream"\n\tCategoryHash CategoryType = "hash"\n\tCategoryAsymmetric CategoryType = "asymmetric"\n\tCategoryMAC CategoryType = "mac"\n\tCategoryKDF CategoryType = "kdf"\n\tCategoryEncoding CategoryType = "encoding"\n\tCategoryCompression CategoryType = "compression"\n\tCategoryChecksum CategoryType = "checksum"\n\tCategoryClassical CategoryType = "classical"\n\tCategorySpecial CategoryType = "special"\n\tCategoryRandom CategoryType = "random"\n\tCategoryPqc CategoryType = "pqc"\n\tCategoryPermutation CategoryType = "permutation"\n\tCategoryEcc CategoryType = "ecc"\n\tCategoryAead CategoryType = "aead"\n\tCategoryModes CategoryType = "modes"\n\tCategoryPadding CategoryType = "padding"\n)',
        'SecurityStatus': 'type SecurityStatus string\nconst (\n\tSecuritySecure SecurityStatus = "secure"\n\tSecurityBroken SecurityStatus = "broken"\n\tSecurityDeprecated SecurityStatus = "deprecated"\n\tSecurityExperimental SecurityStatus = "experimental"\n\tSecurityEducational SecurityStatus = "educational"\n\tSecurityObsolete SecurityStatus = "obsolete"\n)',
        'ComplexityType': 'type ComplexityType string\nconst (\n\tComplexityBeginner ComplexityType = "beginner"\n\tComplexityIntermediate ComplexityType = "intermediate"\n\tComplexityAdvanced ComplexityType = "advanced"\n\tComplexityExpert ComplexityType = "expert"\n\tComplexityResearch ComplexityType = "research"\n)',
        'CountryCode': 'type CountryCode string\nconst (\n\tCountryUS CountryCode = "US"\n\tCountryGB CountryCode = "GB"\n\tCountryDE CountryCode = "DE"\n\tCountryFR CountryCode = "FR"\n\tCountryJP CountryCode = "JP"\n\tCountryCN CountryCode = "CN"\n\tCountryRU CountryCode = "RU"\n\tCountryIL CountryCode = "IL"\n\tCountryBE CountryCode = "BE"\n\tCountryKR CountryCode = "KR"\n\tCountryCH CountryCode = "CH"\n\tCountryAU CountryCode = "AU"\n\tCountryNL CountryCode = "NL"\n\tCountryAT CountryCode = "AT"\n\tCountryCA CountryCode = "CA"\n\tCountrySE CountryCode = "SE"\n\tCountryNO CountryCode = "NO"\n\tCountryDK CountryCode = "DK"\n\tCountryFI CountryCode = "FI"\n\tCountrySG CountryCode = "SG"\n\tCountryIN CountryCode = "IN"\n\tCountryBR CountryCode = "BR"\n\tCountryIT CountryCode = "IT"\n\tCountryUA CountryCode = "UA"\n\tCountryPL CountryCode = "PL"\n\tCountryES CountryCode = "ES"\n\tCountryPT CountryCode = "PT"\n\tCountryMX CountryCode = "MX"\n\tCountryAR CountryCode = "AR"\n\tCountryINTL CountryCode = "INTL"\n\tCountryANCIENT CountryCode = "ANCIENT"\n\tCountryUNKNOWN CountryCode = "UNKNOWN"\n)',
      };

      // Any algorithm class that embeds BaseAlgorithm requires helper classes and all enum types
      // Check if any framework class is present (they all embed BaseAlgorithm directly or indirectly)
      const hasAlgorithmClass = Array.from(this.frameworkClasses).some(fc =>
        FRAMEWORK_STUBS[fc] && FRAMEWORK_STUBS[fc].includes('BaseAlgorithm')
      ) || this.frameworkClasses.has('BaseAlgorithm');

      if (hasAlgorithmClass) {
        // Ensure BaseAlgorithm is in frameworkClasses if any class embeds it
        this.frameworkClasses.add('BaseAlgorithm');
        for (const helper of Object.keys(HELPER_STUBS)) {
          this.helperClasses.add(helper);
        }
        // BaseAlgorithm struct uses CategoryType, SecurityStatus, ComplexityType, CountryCode as field types
        for (const enumName of Object.keys(ENUM_STUBS)) {
          this.enumsUsed.add(enumName);
        }
      }

      // If any enum is used, BaseAlgorithm struct will likely be emitted,
      // which requires ALL enum types and helper types to be defined
      if (this.enumsUsed.size > 0 || this.frameworkClasses.has('BaseAlgorithm')) {
        for (const enumName of Object.keys(ENUM_STUBS)) {
          this.enumsUsed.add(enumName);
        }
        for (const helper of Object.keys(HELPER_STUBS)) {
          this.helperClasses.add(helper);
        }
      }

      // Check for enum usage first (they should come before struct definitions)
      for (const enumName of this.enumsUsed) {
        if (ENUM_STUBS[enumName]) {
          stubs.push({ nodeType: 'RawCode', code: ENUM_STUBS[enumName] });
        }
      }

      // Check for helper classes usage
      for (const helper of this.helperClasses) {
        if (HELPER_STUBS[helper]) {
          stubs.push({ nodeType: 'RawCode', code: HELPER_STUBS[helper] });
        }
      }

      // Check which framework classes are needed - order matters: BaseAlgorithm must come first
      const orderedClasses = ['BaseAlgorithm', ...Array.from(this.frameworkClasses).filter(c => c !== 'BaseAlgorithm')];
      for (const baseClass of orderedClasses) {
        if (FRAMEWORK_STUBS[baseClass]) {
          stubs.push({ nodeType: 'RawCode', code: FRAMEWORK_STUBS[baseClass] });
        }
      }

      // Add framework functions
      if (this.frameworkFunctions.has('register_algorithm') || this.frameworkFunctions.has('RegisterAlgorithm')) {
        stubs.push({ nodeType: 'RawCode', code: 'func RegisterAlgorithm(algo interface{}) {}' });
      }
      if (this.frameworkFunctions.has('algorithm_framework') || this.enumsUsed.size > 0) {
        stubs.push({ nodeType: 'RawCode', code: 'type AlgorithmFramework struct{}\nfunc (af *AlgorithmFramework) Find(name string) interface{} { return nil }\nvar algorithmFramework = &AlgorithmFramework{}' });
        // Register the type so truthiness checks use != nil instead of != 0
        this.variableTypes.set('algorithmFramework', GoType.Pointer(new GoType('AlgorithmFramework')));
      }

      // Add common helper functions used by IL transformations
      const HELPER_FUNCS = `
// Helper functions for transpiled algorithms
func mustHexDecode(s string) []byte { b := make([]byte, len(s)/2); for i := 0; i < len(s); i += 2 { b[i/2] = hexVal(s[i])<<4 | hexVal(s[i+1]) }; return b }
func hexVal(c byte) byte { if c >= '0' && c <= '9' { return c - '0' }; if c >= 'a' && c <= 'f' { return c - 'a' + 10 }; if c >= 'A' && c <= 'F' { return c - 'A' + 10 }; return 0 }
func minInt(a, b int) int { if a < b { return a }; return b }
func maxInt(a, b int) int { if a > b { return a }; return b }
func minUint32(a, b uint32) uint32 { if a < b { return a }; return b }
func maxUint32(a, b uint32) uint32 { if a > b { return a }; return b }
func containsElement(arr []byte, val byte) bool { for _, v := range arr { if v == val { return true } }; return false }
func indexOf(arr []byte, val byte) int { for i, v := range arr { if v == val { return i } }; return -1 }
func reverseSlice(arr []byte) []byte { n := len(arr); r := make([]byte, n); for i, v := range arr { r[n-1-i] = v }; return r }
func sortSlice(arr []byte) []byte { r := make([]byte, len(arr)); copy(r, arr); for i := 0; i < len(r)-1; i++ { for j := 0; j < len(r)-i-1; j++ { if r[j] > r[j+1] { r[j], r[j+1] = r[j+1], r[j] } } }; return r }
func makeFilledSlice(size int, val int) []byte { r := make([]byte, size); for i := range r { r[i] = byte(val) }; return r }
func cloneArray(arr []byte) []byte { r := make([]byte, len(arr)); copy(r, arr); return r }
func cloneArrayUint32(arr []uint32) []uint32 { r := make([]uint32, len(arr)); copy(r, arr); return r }
func uint32SliceToBytes(arr []uint32) []byte { r := make([]byte, len(arr)); for i, v := range arr { r[i] = byte(v) }; return r }
func bytesToUint32Slice(arr []byte) []uint32 { r := make([]uint32, len(arr)); for i, v := range arr { r[i] = uint32(v) }; return r }
func cloneArrayUint16(arr []uint16) []uint16 { r := make([]uint16, len(arr)); copy(r, arr); return r }
func cloneArrayInt(arr []int) []int { r := make([]int, len(arr)); copy(r, arr); return r }
func clearArray(arr []byte) { for i := range arr { arr[i] = 0 } }
func xorArrays(a, b []byte) []byte { r := make([]byte, len(a)); for i := range a { r[i] = a[i] ^ b[i] }; return r }
func stringToBytes(s string) []byte { return []byte(s) }
func bytesToHex(b []byte) string { h := "0123456789abcdef"; r := make([]byte, len(b)*2); for i, v := range b { r[i*2] = h[v>>4]; r[i*2+1] = h[v&0xf] }; return string(r) }
func rotl32(v uint32, n int) uint32 { return (v << uint(n)) | (v >> uint(32-n)) }
func rotr32(v uint32, n int) uint32 { return (v >> uint(n)) | (v << uint(32-n)) }
func rotl16(v uint16, n int) uint16 { return (v << uint(n)) | (v >> uint(16-n)) }
func rotr16(v uint16, n int) uint16 { return (v >> uint(n)) | (v << uint(16-n)) }
func rotl8(v byte, n int) byte { return (v << uint(n)) | (v >> uint(8-n)) }
func rotr8(v byte, n int) byte { return (v >> uint(n)) | (v << uint(8-n)) }
func pack32BE(b0, b1, b2, b3 byte) uint32 { return uint32(b0)<<24 | uint32(b1)<<16 | uint32(b2)<<8 | uint32(b3) }
func pack32LE(b0, b1, b2, b3 byte) uint32 { return uint32(b3)<<24 | uint32(b2)<<16 | uint32(b1)<<8 | uint32(b0) }
func pack16BE(b0, b1 byte) uint16 { return uint16(b0)<<8 | uint16(b1) }
func pack16LE(b0, b1 byte) uint16 { return uint16(b1)<<8 | uint16(b0) }
func unpack32BE(v uint32) []byte { return []byte{byte(v>>24), byte(v>>16), byte(v>>8), byte(v)} }
func unpack32LE(v uint32) []byte { return []byte{byte(v), byte(v>>8), byte(v>>16), byte(v>>24)} }
func unpack16BE(v uint16) []byte { return []byte{byte(v>>8), byte(v)} }
func unpack16LE(v uint16) []byte { return []byte{byte(v), byte(v>>8)} }
func pack32BESlice(b []byte) uint32 { return pack32BE(b[0], b[1], b[2], b[3]) }
func pack32LESlice(b []byte) uint32 { return pack32LE(b[0], b[1], b[2], b[3]) }
func pack16BESlice(b []byte) uint16 { return pack16BE(b[0], b[1]) }
func pack16LESlice(b []byte) uint16 { return pack16LE(b[0], b[1]) }
func pack64BE(b0,b1,b2,b3,b4,b5,b6,b7 byte) uint64 { return uint64(b0)<<56|uint64(b1)<<48|uint64(b2)<<40|uint64(b3)<<32|uint64(b4)<<24|uint64(b5)<<16|uint64(b6)<<8|uint64(b7) }
func pack64LE(b0,b1,b2,b3,b4,b5,b6,b7 byte) uint64 { return uint64(b7)<<56|uint64(b6)<<48|uint64(b5)<<40|uint64(b4)<<32|uint64(b3)<<24|uint64(b2)<<16|uint64(b1)<<8|uint64(b0) }
func unpack64BE(v uint64) []byte { return []byte{byte(v>>56),byte(v>>48),byte(v>>40),byte(v>>32),byte(v>>24),byte(v>>16),byte(v>>8),byte(v)} }
func unpack64LE(v uint64) []byte { return []byte{byte(v),byte(v>>8),byte(v>>16),byte(v>>24),byte(v>>32),byte(v>>40),byte(v>>48),byte(v>>56)} }
func pack64BESlice(b []byte) uint64 { return pack64BE(b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7]) }
func pack64LESlice(b []byte) uint64 { return pack64LE(b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7]) }
// Post-increment helpers (return old value, then increment)
func postIncrInt(p *int) int { old := *p; *p += 1; return old }
func postDecrInt(p *int) int { old := *p; *p -= 1; return old }
func postIncrUint32(p *uint32) uint32 { old := *p; *p += 1; return old }
func postDecrUint32(p *uint32) uint32 { old := *p; *p -= 1; return old }
func postIncrUint16(p *uint16) uint16 { old := *p; *p += 1; return old }
func postIncrInt32(p *int32) int32 { old := *p; *p += 1; return old }
// Pre-increment helpers (increment, then return new value)
func preIncrInt(p *int) int { *p += 1; return *p }
func preDecrInt(p *int) int { *p -= 1; return *p }
func preIncrUint32(p *uint32) uint32 { *p += 1; return *p }
func preDecrUint32(p *uint32) uint32 { *p -= 1; return *p }
func preIncrUint16(p *uint16) uint16 { *p += 1; return *p }
func preIncrInt32(p *int32) int32 { *p += 1; return *p }
// JavaScript short-circuit helpers - || on non-booleans returns first truthy
func firstNonNil(a, b interface{}) interface{} { if a != nil { return a }; return b }
func ifTruthy(a, b interface{}) interface{} { if a != nil { return b }; return nil }
// Type check helpers for JavaScript typeof comparisons
func isTypeString(v any) bool { _, ok := v.(string); return ok }
func isTypeNumber(v any) bool { switch v.(type) { case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64: return true }; return false }
func isTypeBool(v any) bool { _, ok := v.(bool); return ok }
func isTypeObject(v any) bool { if v == nil { return false }; switch v.(type) { case map[string]any, []any, struct{}: return true }; return false }
func isTypeNil(v any) bool { return v == nil }
func isTypeFunc(v any) bool { return false } // Go functions can't be type-checked at runtime like this
// HL64 represents a 64-bit value split into high and low 32-bit words
type HL64 struct { H uint32; L uint32 }
// 64-bit arithmetic helpers for algorithms using high/low word pairs
func add3L64(al, bl, cl uint32) uint64 { return uint64(al) + uint64(bl) + uint64(cl) }
func add3H64(lowSum uint64, ah, bh, ch uint32) uint32 { return uint32(int32(ah) + int32(bh) + int32(ch) + int32(lowSum>>32)) }
func add64_HL(ah, al, bh, bl uint32) HL64 { l := uint64(al) + uint64(bl); h := uint32(int32(ah) + int32(bh) + int32(l>>32)); return HL64{H: h, L: uint32(l)} }
func xor64_HL(ah, al, bh, bl uint32) HL64 { return HL64{H: ah ^ bh, L: al ^ bl} }
func swap64_HL(high, low uint32) HL64 { return HL64{H: low, L: high} }
func rotR64_HL(high, low uint32, n int) HL64 { n &= 63; if n == 0 { return HL64{H: high, L: low} }; if n == 32 { return HL64{H: low, L: high} }; if n < 32 { return HL64{H: (high >> n) | (low << (32 - n)), L: (low >> n) | (high << (32 - n))} }; n -= 32; return HL64{H: (low >> n) | (high << (32 - n)), L: (high >> n) | (low << (32 - n))} }
func rotL64_HL(high, low uint32, n int) HL64 { return rotR64_HL(high, low, 64-n) }
// Array/slice transformation helpers
func mapSlice(arr interface{}, fn interface{}) interface{} { switch a := arr.(type) { case []byte: f := fn.(func(byte) byte); r := make([]byte, len(a)); for i, v := range a { r[i] = f(v) }; return r; case []uint32: f := fn.(func(uint32) uint32); r := make([]uint32, len(a)); for i, v := range a { r[i] = f(v) }; return r; case []int32: f := fn.(func(int32) int32); r := make([]int32, len(a)); for i, v := range a { r[i] = f(v) }; return r; case []int: f := fn.(func(int) int); r := make([]int, len(a)); for i, v := range a { r[i] = f(v) }; return r; case []uint16: f := fn.(func(uint16) uint16); r := make([]uint16, len(a)); for i, v := range a { r[i] = f(v) }; return r; case []int16: f := fn.(func(int16) int16); r := make([]int16, len(a)); for i, v := range a { r[i] = f(v) }; return r; default: return arr } }
func mapSliceBytes(arr []byte, fn func(byte) byte) []byte { r := make([]byte, len(arr)); for i, v := range arr { r[i] = fn(v) }; return r }
func mapSliceUint32(arr []uint32, fn func(uint32) uint32) []uint32 { r := make([]uint32, len(arr)); for i, v := range arr { r[i] = fn(v) }; return r }
func filterSliceBytes(arr []byte, fn func(byte) bool) []byte { r := []byte{}; for _, v := range arr { if fn(v) { r = append(r, v) } }; return r }
func someSliceBytes(arr []byte, fn func(byte) bool) bool { for _, v := range arr { if fn(v) { return true } }; return false }
func everySliceBytes(arr []byte, fn func(byte) bool) bool { for _, v := range arr { if !fn(v) { return false } }; return true }
func reduceSliceBytes(arr []byte, fn func(byte, byte) byte, init byte) byte { acc := init; for _, v := range arr { acc = fn(acc, v) }; return acc }
func reduceSliceUint32(arr []uint32, fn func(uint32, uint32) uint32, init uint32) uint32 { acc := init; for _, v := range arr { acc = fn(acc, v) }; return acc }
// Generic interface{} slice helpers for when element types are unknown
// Accept interface{} for fn to handle both func(interface{}) bool and func(interface{}) interface{} signatures
func _callPredicate(fn interface{}, v interface{}) bool { switch f := fn.(type) { case func(interface{}) bool: return f(v); case func(interface{}) interface{}: r := f(v); switch b := r.(type) { case bool: return b; default: return r != nil }; default: return false } }
func every(arr interface{}, fn interface{}) bool { switch a := arr.(type) { case []byte: for _, v := range a { if !_callPredicate(fn, v) { return false } }; return true; case []uint32: for _, v := range a { if !_callPredicate(fn, v) { return false } }; return true; case []interface{}: for _, v := range a { if !_callPredicate(fn, v) { return false } }; return true; default: return true } }
func some(arr interface{}, fn interface{}) bool { switch a := arr.(type) { case []byte: for _, v := range a { if _callPredicate(fn, v) { return true } }; return false; case []uint32: for _, v := range a { if _callPredicate(fn, v) { return true } }; return false; case []interface{}: for _, v := range a { if _callPredicate(fn, v) { return true } }; return false; default: return false } }
func reduceSlice(arr interface{}, fn interface{}, init interface{}) interface{} { _callReduce := func(f interface{}, a, b interface{}) interface{} { switch rf := f.(type) { case func(interface{}, interface{}) interface{}: return rf(a, b); default: return a } }; switch a := arr.(type) { case []byte: acc := init; for _, v := range a { acc = _callReduce(fn, acc, v) }; return acc; case []uint32: acc := init; for _, v := range a { acc = _callReduce(fn, acc, v) }; return acc; case []interface{}: acc := init; for _, v := range a { acc = _callReduce(fn, acc, v) }; return acc; default: return init } }
func filterSlice(arr interface{}, fn interface{}) interface{} { switch a := arr.(type) { case []byte: r := []byte{}; for _, v := range a { if _callPredicate(fn, v) { r = append(r, v) } }; return r; case []uint32: r := []uint32{}; for _, v := range a { if _callPredicate(fn, v) { r = append(r, v) } }; return r; case []interface{}: r := []interface{}{}; for _, v := range a { if _callPredicate(fn, v) { r = append(r, v) } }; return r; default: return arr } }
func compareArrays(a, b interface{}) int { switch av := a.(type) { case []byte: bv, ok := b.([]byte); if !ok { return -1 }; if len(av) != len(bv) { if len(av) < len(bv) { return -1 }; return 1 }; for i := range av { if av[i] < bv[i] { return -1 } else if av[i] > bv[i] { return 1 } }; return 0; case []uint32: bv, ok := b.([]uint32); if !ok { return -1 }; if len(av) != len(bv) { if len(av) < len(bv) { return -1 }; return 1 }; for i := range av { if av[i] < bv[i] { return -1 } else if av[i] > bv[i] { return 1 } }; return 0; default: return -1 } }
// JavaScript parseInt equivalent
func ParseInt(s interface{}, base ...int) int { str := fmt.Sprintf("%v", s); b := 10; if len(base) > 0 { b = base[0] }; v, _ := strconv.ParseInt(strings.TrimSpace(str), b, 64); return int(v) }
func joinSlice(arr []byte, sep string) string { if len(arr) == 0 { return "" }; r := fmt.Sprintf("%d", arr[0]); for i := 1; i < len(arr); i++ { r += sep + fmt.Sprintf("%d", arr[i]) }; return r }
func spliceSlice(arr []byte, start, deleteCount int, items ...byte) []byte { if start < 0 { start = len(arr) + start }; if start < 0 { start = 0 }; if start > len(arr) { start = len(arr) }; end := start + deleteCount; if end > len(arr) { end = len(arr) }; r := make([]byte, 0, len(arr)-deleteCount+len(items)); r = append(r, arr[:start]...); r = append(r, items...); r = append(r, arr[end:]...); return r }
// Power function helper
func powInt(base, exp int) int { r := 1; for exp > 0 { if exp&1 == 1 { r *= base }; exp >>= 1; base *= base }; return r }
func powUint32(base, exp uint32) uint32 { r := uint32(1); for exp > 0 { if exp&1 == 1 { r *= base }; exp >>= 1; base *= base }; return r }
// String/byte conversion helpers
func asciiToBytes(s string) []byte { return []byte(s) }
func ansiToBytes(s string) []byte { return []byte(s) }
func hexToBytes(s string) []byte { return mustHexDecode(s) }
func hex8ToBytes(s string) []byte { return mustHexDecode(s) }
func bytesToString(b []byte) string { return string(b) }
// Bit manipulation helpers
func bitMask(bits int) uint32 { if bits >= 32 { return 0xFFFFFFFF }; return (1 << uint(bits)) - 1 }
func getBit(value interface{}, bit int) uint8 { switch v := value.(type) { case uint32: return uint8((v >> uint(bit)) & 1); case byte: return (v >> uint(bit)) & 1; case uint16: return uint8((v >> uint(bit)) & 1); case int: return uint8((v >> uint(bit)) & 1); case int32: return uint8((v >> uint(bit)) & 1); default: return 0 } }
func setBit(value uint32, bit int, bitVal uint8) uint32 { if bitVal != 0 { return value | (1 << uint(bit)) }; return value &^ (1 << uint(bit)) }
func unshiftSlice(arr []byte, items ...byte) []byte { return append(items, arr...) }
func gF256Mul(a, b uint8) uint8 { var p uint8; for i := 0; i < 8; i++ { if b&1 != 0 { p ^= a }; hi := a & 0x80; a <<= 1; if hi != 0 { a ^= 0x1B }; b >>= 1 }; return p }
func copySlice(dst, src []byte) []byte { n := len(src); if len(dst) < n { n = len(dst) }; copy(dst[:n], src[:n]); return dst }
func constantTimeCompare(a, b []byte) int { if len(a) != len(b) { return 0 }; var v byte; for i := range a { v |= a[i] ^ b[i] }; if v == 0 { return 1 }; return 0 }
func minSlice(arr interface{}) int { switch a := arr.(type) { case []int: m := a[0]; for _, v := range a[1:] { if v < m { m = v } }; return m; case []uint32: m := a[0]; for _, v := range a[1:] { if v < m { m = v } }; return int(m); case []byte: m := a[0]; for _, v := range a[1:] { if v < m { m = v } }; return int(m); case []interface{}: m := 0; for i, v := range a { iv, _ := v.(int); if i == 0 || iv < m { m = iv } }; return m; default: return 0 } }
func maxSlice(arr interface{}) int { switch a := arr.(type) { case []int: m := a[0]; for _, v := range a[1:] { if v > m { m = v } }; return m; case []uint32: m := a[0]; for _, v := range a[1:] { if v > m { m = v } }; return int(m); case []byte: m := a[0]; for _, v := range a[1:] { if v > m { m = v } }; return int(m); case []interface{}: m := 0; for i, v := range a { iv, _ := v.(int); if i == 0 || iv > m { m = iv } }; return m; default: return 0 } }
func toQWord(v interface{}) uint64 { switch x := v.(type) { case uint64: return x; case int64: return uint64(x); case uint32: return uint64(x); case int32: return uint64(x); case int: return uint64(x); case uint: return uint64(x); case float64: return uint64(x); default: return 0 } }
func concatArrays(arrays ...interface{}) []byte { var r []byte; for _, a := range arrays { switch v := a.(type) { case []byte: r = append(r, v...); case []uint32: for _, x := range v { r = append(r, byte(x)) }; default: } }; return r }
func doubleToBytes(v float64) []byte { bits := math.Float64bits(v); b := make([]byte, 8); for i := 0; i < 8; i++ { b[7-i] = byte(bits >> uint(i*8)) }; return b }
func secureCompare(a, b []byte) int { if constantTimeCompare(a, b) == 1 { return 0 }; return 1 }
func getKeys(m interface{}) []string { switch v := m.(type) { case map[string]interface{}: keys := make([]string, 0, len(v)); for k := range v { keys = append(keys, k) }; return keys; default: return nil } }
func getEntries(m interface{}) [][2]interface{} { switch v := m.(type) { case map[string]interface{}: entries := make([][2]interface{}, 0, len(v)); for k, val := range v { entries = append(entries, [2]interface{}{k, val}) }; return entries; default: return nil } }
func rotL64n(v interface{}, n int) uint64 { x := toQWord(v); return (x << uint(n&63)) | (x >> uint(64-(n&63))) }
func rotR64n(v interface{}, n int) uint64 { x := toQWord(v); return (x >> uint(n&63)) | (x << uint(64-(n&63))) }
func popCountFast(v uint32) int { v = v - ((v >> 1) & 0x55555555); v = (v & 0x33333333) + ((v >> 2) & 0x33333333); return int(((v + (v >> 4)) & 0x0F0F0F0F) * 0x01010101 >> 24) }
func bitCountN(v interface{}) int { switch x := v.(type) { case uint32: return popCountFast(x); case int: return popCountFast(uint32(x)); case uint64: return popCountFast(uint32(x)) + popCountFast(uint32(x>>32)); case byte: return popCountFast(uint32(x)); default: return 0 } }
`;
      stubs.push({ nodeType: 'RawCode', code: HELPER_FUNCS });

      // Helper function joinSlice uses fmt.Sprintf - ensure import is added
      this.addImport('fmt');
      // ParseInt helper uses strconv and strings packages
      this.addImport('strconv');
      this.addImport('strings');
      // doubleToBytes uses math.Float64bits
      this.addImport('math');
      // Note: errors import is added when ErrorCreation nodes are encountered

      return stubs;
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
              // Track for stub generation
              this.frameworkFunctions.add('RegisterAlgorithm');
              // Skip - algorithm registration not needed in Go
              return null;
            }
          }

          // Handle top-level assignment expressions that are class definitions
          // Pattern: X = class extends Y { ... }
          if (node.expression.type === 'AssignmentExpression') {
            const transformed = this.transformAssignmentAsDeclaration(node.expression);
            if (transformed) return transformed;
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

      // Track destructure temp sources so DestructuredProperty/DestructuredElement
      // declarators can look up the original source expression instead of referencing
      // the (skipped) temp variable.
      const destructureTempSources = new Map();

      for (const decl of node.declarations) {
        if (!decl.init) continue;

        const name = decl.id.name;

        // Skip AlgorithmFramework and OpCodes imports
        if (name === 'AlgorithmFramework' || name === 'OpCodes') continue;

        // Handle IL-expanded destructuring temps:
        // The type-aware transpiler expands `const { a, b } = obj` into:
        //   _destructure_N = obj          (ilNodeType: 'DestructureTemp')
        //   a = _destructure_N.a          (ilNodeType: 'DestructuredProperty')
        //   b = _destructure_N.b          (ilNodeType: 'DestructuredProperty')
        // Skip the temp variable but record its source for later property access.
        if (decl.ilNodeType === 'DestructureTemp') {
          destructureTempSources.set(name, decl.init);
          continue;
        }

        // Handle IL-expanded destructured properties: replace _destructure_N.prop
        // with direct access to the original source object.prop
        if (decl.ilNodeType === 'DestructuredProperty' &&
            decl.init?.type === 'MemberExpression' &&
            decl.init.object?.type === 'Identifier' &&
            decl.init.object.name.startsWith('_destructure')) {
          const tempName = decl.init.object.name;
          const sourceInit = destructureTempSources.get(tempName);
          if (sourceInit) {
            // Rewrite init to use the original source instead of the temp
            decl.init = {
              ...decl.init,
              object: sourceInit
            };
          }
        }

        // Handle IL-expanded destructured elements (array destructuring):
        // replace _destructure_N[i] with direct access to sourceArray[i]
        if (decl.ilNodeType === 'DestructuredElement' &&
            decl.init?.type === 'MemberExpression' &&
            decl.init.computed &&
            decl.init.object?.type === 'Identifier' &&
            decl.init.object.name.startsWith('_destructure')) {
          const tempName = decl.init.object.name;
          const sourceInit = destructureTempSources.get(tempName);
          if (sourceInit) {
            decl.init = {
              ...decl.init,
              object: sourceInit
            };
          }
        }

        // Skip framework types that are destructured from AlgorithmFramework
        // These are already defined as Go types in the framework stubs
        const FRAMEWORK_TYPES = [
          'KeySize', 'LinkItem', 'TestCase', 'Vulnerability', 'TestCategory',
          'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode',
          'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
          'SymmetricCipherAlgorithm', 'AsymmetricCipherAlgorithm', 'MacAlgorithm',
          'CompressionAlgorithm', 'EncodingAlgorithm', 'CryptoAlgorithm',
          'ChecksumAlgorithm', 'IBlockCipherInstance', 'IStreamCipherInstance',
          'IHashFunctionInstance', 'IAlgorithmInstance', 'RegisterAlgorithm', 'Algorithm',
          'AeadAlgorithm', 'IAeadInstance', 'Find'
        ];
        if (FRAMEWORK_TYPES.includes(name)) continue;

        // Skip destructured properties that extract from framework modules
        // e.g., RegisterAlgorithm = _destructure_0.RegisterAlgorithm where source was AlgorithmFramework
        if ((decl.ilNodeType === 'DestructuredProperty' || decl.ilNodeType === 'DestructuredElement') &&
            decl.init?.type === 'MemberExpression' &&
            decl.init.object?.type === 'Identifier' &&
            (decl.init.object.name === 'AlgorithmFramework' || decl.init.object.name === 'OpCodes')) {
          continue;
        }

        // Infer type FIRST, then pass it to transformExpression
        // This ensures array literals use the same type as the declared variable
        const type = this.inferFullExpressionType(decl.init);

        // Detect object-literal variables whose function values reference 'this'.
        // In Go, map literals can't contain self-referential closures, so we wrap
        // the initialisation in an IIFE: var X = func() map[string]interface{} { s := ...; return s }()
        const initType = decl.init.type || decl.init.ilNodeType;
        const isObjExpr = initType === 'ObjectExpression' || initType === 'ObjectLiteral';
        if (isObjExpr && this._objectExpressionHasThisRef(decl.init)) {
          const savedInMapSelfRef = this.inMapSelfRefContext;
          this.inMapSelfRefContext = true;

          // Build each property as an imperative assignment: s["key"] = value
          const mapType = GoType.Map(GoType.String(), GoType.Interface());
          const body = new GoBlock();
          // s := make(map[string]interface{})
          const sVar = new GoVar(this.receiverName, null, new GoMake(mapType, null));
          sVar.isShortDecl = true;
          body.statements.push(sVar);

          for (const prop of (decl.init.properties || [])) {
            if (prop.type === 'SpreadElement' || !prop.key) continue;
            const jsKey = typeof prop.key === 'string'
              ? prop.key
              : (prop.key.name || prop.key.value || 'unknown');
            const valExpr = this.transformExpression(prop.value);
            // s["key"] = value
            const target = new GoIndexExpression(
              new GoIdentifier(this.receiverName),
              GoLiteral.String(jsKey)
            );
            body.statements.push(new GoExpressionStatement(new GoAssignment([target], '=', [valExpr])));
          }
          body.statements.push(new GoReturn([new GoIdentifier(this.receiverName)]));

          const iife = new GoCallExpression(
            new GoFuncLit([], [new GoParameter('', mapType)], body),
            []
          );

          this.inMapSelfRefContext = savedInMapSelfRef;

          if (type) {
            this.variableTypes.set(name, type);
            this.variableTypes.set(this.toPascalCase(name), type);
          }
          const goVar = new GoVar(this.toPascalCase(name), mapType, iife);
          declarations.push(goVar);
          continue;
        }

        const value = this.transformExpression(decl.init, type);

        // Register the type for later lookups (e.g., for array element type inference)
        // This is crucial for expressions like SLISCP320_RC[i] to get the correct element type
        if (type) {
          this.variableTypes.set(name, type);
          this.variableTypes.set(this.toPascalCase(name), type);
        }

        // Check if it's a constant (const with literal or Object.freeze)
        // Note: Go doesn't allow const with slice/array/map/interface{} types, so those must be var
        const typeStr = type?.name || type?.toString() || '';
        const isSliceOrMapType = type && (type.isSlice || type.isArray || type.isMap ||
          typeStr.startsWith('[]') || typeStr.startsWith('map['));
        const isInterfaceType = typeStr === 'interface{}' || typeStr === 'any';
        const isGoCompatibleConst = node.kind === 'const' &&
          !isSliceOrMapType &&
          !isInterfaceType &&
          (decl.init.type === 'Literal' ||
           (decl.init.type === 'CallExpression' &&
            decl.init.callee?.type === 'MemberExpression' &&
            decl.init.callee.object?.name === 'Object' &&
            decl.init.callee.property?.name === 'freeze'));

        if (isGoCompatibleConst) {
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

    /**
     * Map JSDoc type annotation to Go type
     * Handles JSDoc-specific syntax like Object, custom types, etc.
     */
    mapJSDocType(jsDocType) {
      if (!jsDocType) return GoType.Interface();

      // Remove nullable prefix/suffix
      let typeName = jsDocType.replace(/^\?/, '').replace(/\?$/, '').trim();

      // Handle union types - use interface{}
      if (typeName.includes('|')) {
        return GoType.Interface();
      }

      // Handle generic array syntax: Array<T>
      const arrayMatch = typeName.match(/^Array<(.+)>$/);
      if (arrayMatch) {
        const elementType = this.mapJSDocType(arrayMatch[1]);
        return GoType.Slice(elementType);
      }

      // Handle array suffix: T[]
      if (typeName.endsWith('[]')) {
        const elementType = this.mapJSDocType(typeName.slice(0, -2));
        return GoType.Slice(elementType);
      }

      // Map common JSDoc types
      // Note: 'number' maps to uint32 because crypto code primarily uses integers
      const JSDOC_TYPE_MAP = {
        'object': GoType.Interface(),
        'any': GoType.Interface(),
        '*': GoType.Interface(),
        'string': GoType.String(),
        'number': GoType.UInt32(), // Crypto code uses integers, not floats
        'boolean': GoType.Bool(),
        'void': null,
        'null': GoType.Interface(),
        'undefined': GoType.Interface(),
        'uint8': GoType.UInt8(),
        'uint16': GoType.UInt16(),
        'uint32': GoType.UInt32(),
        'uint64': GoType.UInt64(),
        'int': GoType.Int(),
        'int8': new GoType('int8'),
        'int16': new GoType('int16'),
        'int32': new GoType('int32'),
        'int64': new GoType('int64'),
        'byte': GoType.UInt8(),
        'uint8array': GoType.Slice(GoType.UInt8()),
        'uint16array': GoType.Slice(GoType.UInt16()),
        'uint32array': GoType.Slice(GoType.UInt32()),
        'buffer': GoType.Slice(GoType.UInt8()),
      };

      const lowerType = typeName.toLowerCase();
      if (JSDOC_TYPE_MAP[lowerType]) {
        return JSDOC_TYPE_MAP[lowerType];
      }

      // For custom types (like AdlerConfig), use interface{} or map
      // Config-like types should be map[string]interface{}
      if (typeName.endsWith('Config') || typeName.endsWith('Options')) {
        return GoType.Map(GoType.String(), GoType.Interface());
      }

      // Use the type name as-is (it may be a struct type)
      return new GoType(typeName);
    }

    getInferredType(node, varName = null) {
      // Try to infer type from value
      if (node.type === 'Literal') {
        if (typeof node.value === 'number') {
          if (Number.isInteger(node.value)) {
            // For integer literals, check variable name for hints
            // Crypto code typically uses uint32 for non-index variables
            if (varName) {
              const lowerName = varName.toLowerCase();
              // Index/count variables should be int
              if (lowerName === 'i' || lowerName === 'j' || lowerName === 'k' ||
                  lowerName.includes('index') || lowerName.includes('count') ||
                  lowerName.includes('length') || lowerName.includes('offset') ||
                  lowerName === 'n' || lowerName === 'len') {
                return GoType.Int();
              }
            }
            // Negative integers must be int (uint32 can't hold negative values)
            if (node.value < 0) return GoType.Int();
            // For crypto code, default integer variables to uint32
            return GoType.UInt32();
          }
          return GoType.Float64();
        }
        if (typeof node.value === 'string') return GoType.String();
        if (typeof node.value === 'boolean') return GoType.Bool();
        if (node.value === null) return GoType.Interface();
      }

      // Infinity identifier -> uint32 (used as sentinel max value in crypto code)
      if (node.type === 'Identifier' && node.name === 'Infinity') {
        return GoType.UInt32();
      }

      // Negative unary expressions (e.g., -1) must be int
      if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument) {
        // -Infinity -> uint32 (used as sentinel min value in crypto code)
        if (node.argument.type === 'Identifier' && node.argument.name === 'Infinity') {
          return GoType.UInt32();
        }
        if (node.argument.type === 'Literal' && typeof node.argument.value === 'number' && Number.isInteger(node.argument.value)) {
          return GoType.Int();
        }
      }

      if (node.type === 'ArrayExpression') {
        // Try to infer element type from array contents
        if (node.elements && node.elements.length > 0) {
          // Check for spread elements
          const hasSpread = node.elements.some(e => e?.type === 'SpreadElement');
          if (hasSpread) {
            // Get type from first spread element
            const spreadElem = node.elements.find(e => e?.type === 'SpreadElement');
            if (spreadElem) {
              const argType = this.inferFullExpressionType(spreadElem.argument);
              // If it's already a slice type, use it
              if (argType?.isSlice || argType?.elementType) {
                return argType;
              }
            }
          }
          // Check if all elements are byte-masked (& 0xFF) - common crypto pattern
          const nonSpreadElems = node.elements.filter(e => e && e.type !== 'SpreadElement');
          if (nonSpreadElems.length > 0 && nonSpreadElems.every(e =>
              e.type === 'BinaryExpression' && e.operator === '&' &&
              ((e.right && e.right.type === 'Literal' && e.right.value === 0xFF) ||
               (e.left && e.left.type === 'Literal' && e.left.value === 0xFF)))) {
            return GoType.Slice(GoType.UInt8());
          }
          // Check if all elements are byte-range values (literals 0-255, byte-masked, or uint8 casts)
          // This handles cases like [0x80], [0x80, 0x00] in crypto padding code
          // and mixed arrays like [OpCodes.AndN(x, 0xFF), xx[1]] in block ciphers
          const isByteExpr = (e) => {
            if (e.type === 'Literal' && typeof e.value === 'number' && Number.isInteger(e.value) && e.value >= 0 && e.value <= 255) return true;
            if (e.type === 'BinaryExpression' && e.operator === '&') return true; // byte-masked
            if (e.ilNodeType === 'And' || e.ilNodeType === 'Mask') return true;
            // Check if element type is already uint8/byte
            const eType = this.inferFullExpressionType(e);
            const eStr = eType?.toString() || '';
            if (eStr === 'uint8' || eStr === 'byte') return true;
            return false;
          };
          // If there are at least some byte-masked elements and the rest are compatible byte-origin expressions
          const hasByteMasks = nonSpreadElems.some(e =>
            (e.type === 'BinaryExpression' && e.operator === '&') || e.ilNodeType === 'And' || e.ilNodeType === 'Mask');
          if (nonSpreadElems.length > 0 && (nonSpreadElems.every(e => isByteExpr(e)) || hasByteMasks)) {
            return GoType.Slice(GoType.UInt8());
          }
          // Infer from first non-spread element
          const firstElem = node.elements.find(e => e && e.type !== 'SpreadElement');
          if (firstElem) {
            const elemType = this.inferFullExpressionType(firstElem);
            return GoType.Slice(elemType);
          }
        }
        // Empty array - use function return type if available (e.g., `let output = []` in method returning []uint8)
        if (this.currentFunctionReturnType && this.currentFunctionReturnType.isSlice) {
          return this.currentFunctionReturnType;
        }
        return GoType.Slice(GoType.UInt8()); // Default to []uint8 for crypto code
      }

      // Use full expression type inference for other cases
      return this.inferFullExpressionType(node);
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

      // Handle inheritance via struct embedding
      if (node.superClass) {
        let baseName = node.superClass.name || node.superClass;

        // Handle AlgorithmFramework.XxxAlgorithm pattern (MemberExpression)
        if (node.superClass.type === 'MemberExpression' &&
            node.superClass.object?.name === 'AlgorithmFramework') {
          baseName = node.superClass.property?.name || node.superClass.property;
        }
        // Handle global.AlgorithmFramework.XxxAlgorithm pattern (nested MemberExpression)
        else if (node.superClass.type === 'MemberExpression' &&
            node.superClass.object?.type === 'MemberExpression' &&
            node.superClass.object?.property?.name === 'AlgorithmFramework') {
          baseName = node.superClass.property?.name || node.superClass.property;
        }

        if (typeof baseName === 'string') {
          // Map known algorithm base classes
          // Keep specific types that have extra fields, map generic types to BaseAlgorithm
          const BASE_CLASS_MAP = {
            // Core base classes
            'Algorithm': 'BaseAlgorithm',
            'CryptoAlgorithm': 'CryptoAlgorithm',
            'SymmetricCipherAlgorithm': 'SymmetricCipherAlgorithm',
            'AsymmetricCipherAlgorithm': 'AsymmetricCipherAlgorithm',
            // Specific algorithm types - keep as-is since they have extra fields
            'BlockCipherAlgorithm': 'BlockCipherAlgorithm',
            'StreamCipherAlgorithm': 'StreamCipherAlgorithm',
            'HashFunctionAlgorithm': 'HashFunctionAlgorithm',
            'AsymmetricAlgorithm': 'AsymmetricAlgorithm',
            'MACAlgorithm': 'MacAlgorithm',
            'MacAlgorithm': 'MacAlgorithm',
            'KDFAlgorithm': 'KdfAlgorithm',
            'KdfAlgorithm': 'KdfAlgorithm',
            'AEADAlgorithm': 'AeadAlgorithm',
            'AeadAlgorithm': 'AeadAlgorithm',
            'ChecksumAlgorithm': 'ChecksumAlgorithm',
            'CompressionAlgorithm': 'CompressionAlgorithm',
            'ClassicalCipherAlgorithm': 'ClassicalCipherAlgorithm',
            'EncodingAlgorithm': 'EncodingAlgorithm',
            'ErrorCorrectionAlgorithm': 'BaseAlgorithm',
            'PaddingAlgorithm': 'BaseAlgorithm',
            'CipherModeAlgorithm': 'BaseAlgorithm',
            'RandomGenerationAlgorithm': 'BaseAlgorithm',
            // Instance classes embed their base types for Algorithm field access
            'IBlockCipherInstance': 'IBlockCipherInstance',
            'IStreamCipherInstance': 'IStreamCipherInstance',
            'IHashFunctionInstance': 'IHashFunctionInstance',
            'IAlgorithmInstance': 'IAlgorithmInstance',
            'IMacInstance': 'IAlgorithmInstance',
            'IKdfInstance': 'IAlgorithmInstance',
            'IAeadInstance': 'IAlgorithmInstance',
            'IErrorCorrectionInstance': 'IAlgorithmInstance',
            'IRandomGeneratorInstance': 'IAlgorithmInstance',
          };
          const mappedBase = BASE_CLASS_MAP[baseName];
          if (mappedBase !== undefined) {
            // Track framework class usage for stub generation
            this.frameworkClasses.add(baseName);
            // Also track the mapped base class if different
            if (mappedBase && mappedBase !== baseName) {
              this.frameworkClasses.add(mappedBase);
            }
            // Algorithm types that embed BaseAlgorithm need it too
            const TYPES_EMBEDDING_BASE = [
              'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
              'AsymmetricAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'AeadAlgorithm',
              'EncodingAlgorithm', 'CompressionAlgorithm', 'ChecksumAlgorithm', 'ClassicalCipherAlgorithm'
            ];
            if (TYPES_EMBEDDING_BASE.includes(mappedBase)) {
              this.frameworkClasses.add('BaseAlgorithm');
              // Track the concrete algorithm struct name for type assertions
              // e.g., LEAAlgorithm extending BlockCipherAlgorithm
              this.algorithmStructName = struct.name;
            }

            if (mappedBase) {
              // Track the mapped base class for context-aware field filtering
              this.currentMappedBase = mappedBase;
              // Add anonymous embedded struct field (Go embedding for inheritance)
              const embeddedField = new GoField(mappedBase, new GoType(mappedBase));
              embeddedField.isEmbedded = true;
              struct.fields.push(embeddedField);
            }
          }
        }
      }

      // Handle both class body structures:
      // - Standard: {type: 'ClassBody', body: [...]}
      // - Unwrapped UMD: array directly
      const members = node.body?.body || node.body || [];

      // Clear struct field types for this class (important when processing multiple classes)
      this.structFieldTypes.clear();
      this.declaredMethodNames.clear();
      this.methodRenames.clear();
      this.prescanEmptyArrayVars.clear();

      // Pre-scan: First extract field types from constructor BEFORE scanning method return types
      // This ensures that when we infer return types, we know the types of instance fields
      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
            this.preScanConstructorFields(member);
            break;
          }
        }
      }

      // Pre-scan: register ALL method return types BEFORE transforming any method bodies
      // This ensures that method calls can be typed correctly even if the target method
      // is defined later in the class (e.g., Result() calling _encryptBlock())
      // Two passes: first pass registers direct return types, second pass resolves
      // forward references (e.g., Result() calls EducationalPomaranch() defined later)
      if (members && members.length > 0) {
        const savedVarTypesForReturnScan = new Map(this.variableTypes);
        for (let pass = 0; pass < 2; ++pass) {
          for (const member of members) {
            if (member.type === 'MethodDefinition' && member.kind === 'method') {
              const methodName = member.key?.name || member.key;
              if (methodName && member.value) {
                // On second pass, skip methods already resolved with specific types
                if (pass === 1) {
                  const existing = this.methodReturnTypes.get(methodName);
                  if (existing && existing.name !== 'interface{}' && existing.name !== 'any')
                    continue;
                }
                const returnTypes = this.inferFunctionReturnType(member.value);
                if (returnTypes.length > 0) {
                  const returnType = returnTypes[0].type;
                  this.methodReturnTypes.set(methodName, returnType);
                  this.methodReturnTypes.set(this.toPascalCase(methodName), returnType);
                }
              }
            }
          }
        }
        this.variableTypes = savedVarTypesForReturnScan;
      }

      // Pre-scan: collect method call sites to infer parameter types from actual arguments
      // This ensures that _encryptWords(words, keyWords) knows that words is []uint32
      // We do TWO passes: first to collect basic call sites, then with known parameter types
      if (members && members.length > 0) {
        this.methodParamTypes.clear();

        // First pass: collect call sites with basic type inference
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.value?.body) {
            const savedVarTypes = new Map(this.variableTypes);
            this.variableTypes.clear();
            this.prescanFunctionBody(member.value.body, false);
            this.collectMethodCallSites(member.value.body);
            this.variableTypes = savedVarTypes;
          }
        }

        // Second pass: re-collect with known parameter types from first pass
        // This handles cases like: words = CopyArray(v) where v's type is now known
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.value?.body) {
            const methodName = member.key?.name || member.key;
            const params = member.value?.params || [];
            const savedVarTypes = new Map(this.variableTypes);
            this.variableTypes.clear();

            // Register known parameter types from first pass
            for (let i = 0; i < params.length; ++i) {
              const paramName = params[i].name;
              const key = `${methodName}:${i}`;
              const knownType = this.methodParamTypes.get(key);
              if (knownType) {
                this.variableTypes.set(paramName, knownType);
              }
            }

            this.prescanFunctionBody(member.value.body, false);
            this.collectMethodCallSites(member.value.body);
            this.variableTypes = savedVarTypes;
          }
        }
      }

      // Pre-scan: collect DECLARED method parameter types BEFORE transforming constructor
      // This ensures that when the constructor calls a method like GetVariantConfig(variant),
      // we know the declared parameter type to add proper type assertions
      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind === 'method') {
            const methodName = member.key?.name || member.key;
            const pascalName = this.toPascalCase(methodName);
            const params = member.value?.params || [];

            for (let i = 0; i < params.length; ++i) {
              const param = params[i];
              // Infer the parameter type using existing inference logic
              const paramType = this.inferParameterType(param, member.value?.body, methodName, i);

              // Store declared parameter type for call-site type assertions
              const declaredKey = `${methodName}:${i}`;
              this.methodDeclaredParams.set(declaredKey, paramType);
              // Also store with PascalCase for lookup
              this.methodDeclaredParams.set(`${pascalName}:${i}`, paramType);
            }
          }
        }
      }

      // Pre-scan: detect field/method name collisions BEFORE transformation
      // This allows member access expressions to use the correct renamed field names
      if (members && members.length > 0) {
        const methodNamesRaw = new Set();
        const propertyNamesRaw = new Set();

        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind === 'method') {
            const pascalName = this.toPascalCase(member.key?.name || member.key);
            methodNamesRaw.add(pascalName);
          } else if (member.type === 'PropertyDefinition') {
            const pascalName = this.toPascalCase(member.key?.name || member.key);
            propertyNamesRaw.add(pascalName);
          } else if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
            // Also scan constructor body for this.x = y assignments
            const body = member.value?.body?.body || [];
            for (const stmt of body) {
              if (stmt.type === 'ExpressionStatement' &&
                  stmt.expression?.type === 'AssignmentExpression' &&
                  (stmt.expression.left?.type === 'MemberExpression' &&
                   stmt.expression.left?.object?.type === 'ThisExpression' ||
                   stmt.expression.left?.type === 'ThisPropertyAccess')) {
                const propName = stmt.expression.left.property?.name ||
                                 stmt.expression.left.property;
                if (propName) {
                  const pascalName = this.toPascalCase(propName);
                  propertyNamesRaw.add(pascalName);
                }
              }
            }
          }
        }

        // Detect collisions and register renames
        for (const propName of propertyNamesRaw) {
          if (methodNamesRaw.has(propName)) {
            this.renamedFields.set(`${struct.name}.${propName}`, propName + '_');
          }
        }
      }

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
              // First extract any fields assigned via this.X = ... in method body
              const methodFields = this.extractSetterFields(member, struct.name);
              if (methodFields && methodFields.length > 0) {
                struct.fields.push(...methodFields);
              }
              const method = this.transformMethod(member, struct.name);
              if (method) {
                struct.methods.push(method);
              }
            } else if (member.kind === 'set') {
              // Setter - extract dynamically created fields from this.fieldName = ...
              const setterFields = this.extractSetterFields(member, struct.name);
              if (setterFields && setterFields.length > 0) {
                struct.fields.push(...setterFields);
              }
              // Don't generate setter method - Go uses direct field access
              // and setter logic gets inlined where needed
            } else if (member.kind === 'get') {
              // Don't generate getter method - Go uses direct field access
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

      // Fix field/method name collisions - in Go, a struct can't have field and method with same name
      // Note: Most collisions are detected early (line 1502-1524), but this catches fields
      // created dynamically in constructors via this.X = ... assignments
      const methodNames = new Set(struct.methods.map(m => m.name));
      for (const field of struct.fields) {
        if (methodNames.has(field.name) && !field.name.endsWith('_')) {
          const originalName = field.name;
          // Append underscore to field name to avoid collision with method
          field.name = field.name + '_';
          // Track the rename (may already be registered from early detection)
          const renameKey = `${struct.name}.${originalName}`;
          if (!this.renamedFields.has(renameKey)) {
            this.renamedFields.set(renameKey, field.name);
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
        for (let i = 0; i < node.value.params.length; ++i) {
          const param = node.value.params[i];
          const paramType = this.inferParameterType(param, node.value.body, 'constructor', i);
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
      // In constructor, 'this' refers to 'result' (the instance being created)
      const savedReceiverName = this.receiverName;
      this.receiverName = 'result';

      // Pre-scan: register all method return types before transforming bodies
      // This ensures method calls can be properly typed even if methods are defined later
      if (node.value && node.value.body && node.value.body.body) {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            const expr = stmt.expression;
            const propName = expr.left.property?.name || expr.left.property;
            const value = expr.right;
            if (value.type === 'FunctionExpression' || value.type === 'ArrowFunctionExpression') {
              // Pre-register method return type
              const returnTypes = this.inferFunctionReturnType(value);
              if (returnTypes.length > 0) {
                const returnType = returnTypes[0].type;
                this.methodReturnTypes.set(propName, returnType);
                this.methodReturnTypes.set(this.toPascalCase(propName), returnType);
              }
            }
          }
        }
      }

      // Now process the body with method return types available
      if (node.value && node.value.body && node.value.body.body) {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            const result = this.processThisAssignment(stmt, structName);
            if (result.isMethod) {
              methods.push(result.method);
            } else {
              // Only add field if it's not a base class field
              if (result.field) {
                fields.push(result.field);
              }
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
      // Restore receiver name
      this.receiverName = savedReceiverName;

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
     * Pre-scan constructor to extract field types without full transformation.
     * This allows method return type inference to know about instance fields.
     */
    preScanConstructorFields(constructorNode) {
      const body = constructorNode.value?.body;
      if (!body) return;

      const statements = body.body || body;
      if (!Array.isArray(statements)) return;

      for (const stmt of statements) {
        // Look for this.property = value assignments
        if (stmt.type !== 'ExpressionStatement') continue;
        const expr = stmt.expression;
        if (expr.type !== 'AssignmentExpression') continue;

        let propName;
        // Check for standard JS MemberExpression with ThisExpression
        if (expr.left.type === 'MemberExpression' && expr.left.object?.type === 'ThisExpression') {
          propName = expr.left.property?.name || expr.left.property;
        }
        // Check for IL AST ThisPropertyAccess pattern
        else if (expr.left.type === 'ThisPropertyAccess') {
          propName = expr.left.property;
        }
        else continue;

        if (!propName) continue;

        // Skip null literal assignments - these are just initializations
        // The actual type will be determined from later assignments in method bodies
        const value = expr.right;
        if (value?.type === 'Literal' && value.value === null) {
          continue;
        }

        // Infer type from the value
        let fieldType = this.inferFieldTypeFromValue(value, propName);

        // Register the field type
        const pascalName = this.toPascalCase(propName);
        this.structFieldTypes.set(pascalName, fieldType);
        this.structFieldTypes.set(propName, fieldType);
      }
    }

    /**
     * Infer field type from its initialization value (lightweight version for pre-scanning)
     */
    inferFieldTypeFromValue(value, propName) {
      // Check known framework field types first
      const lowerName = propName.toLowerCase();
      const FRAMEWORK_FIELD_TYPES = {
        'name': GoType.String(),
        'description': GoType.String(),
        'inventor': GoType.String(),
        'year': GoType.UInt32(),
        'category': new GoType('CategoryType'),
        'subcategory': GoType.String(),
        'securitystatus': new GoType('SecurityStatus'),
        'complexity': new GoType('ComplexityType'),
        'country': new GoType('CountryCode'),
        'documentation': GoType.Slice(new GoType('LinkItem')),
        'references': GoType.Slice(new GoType('LinkItem')),
        'knownvulnerabilities': GoType.Slice(new GoType('Vulnerability')),
        'tests': GoType.Slice(new GoType('TestCase')),
        'testvectors': GoType.Slice(new GoType('TestCase')),
        'supportedkeysizes': GoType.Slice(new GoType('KeySize')),
        'supportedblocksizes': GoType.Slice(new GoType('KeySize')),
        'supportednoncesizes': GoType.Slice(new GoType('KeySize')),
        'keysizes': GoType.Slice(new GoType('KeySize')),
        'blocksizes': GoType.Slice(new GoType('KeySize')),
        'noncesizes': GoType.Slice(new GoType('KeySize')),
        'ivsizes': GoType.Slice(new GoType('KeySize')),
        'supportedivsizes': GoType.Slice(new GoType('KeySize')),
        'supportedtagsizes': GoType.Slice(new GoType('KeySize')),
        'supportedsaltsizes': GoType.Slice(new GoType('KeySize')),
        'supportedoutputsizes': GoType.Slice(new GoType('KeySize')),
        'supportedrounds': GoType.Slice(new GoType('KeySize')),
        'supportedversions': GoType.Slice(new GoType('KeySize')),
        'supportedvariants': GoType.Slice(new GoType('KeySize')),
        'supportedmodes': GoType.Slice(new GoType('KeySize')),
        'tagsizes': GoType.Slice(new GoType('KeySize')),
        'saltsizes': GoType.Slice(new GoType('KeySize')),
        // MAC/AEAD algorithm specific fields
        'supportedmacsizes': GoType.Slice(new GoType('KeySize')),
        'supportedhashsizes': GoType.Slice(new GoType('KeySize')),
        'supportedkeyderivationsizes': GoType.Slice(new GoType('KeySize')),
        'supporteddigestsizes': GoType.Slice(new GoType('KeySize')),
        'supportedsignaturesizes': GoType.Slice(new GoType('KeySize')),
        'supportedinputsizes': GoType.Slice(new GoType('KeySize')),
        'supportedseedsizes': GoType.Slice(new GoType('KeySize')),
        // Numeric fields from algorithm base classes
        'outputsize': GoType.Int(),
        'blocksize': GoType.Int(),
        'statesize': GoType.Int(),
        'rounds': GoType.Int(),
        'digestsize': GoType.Int(),
        'tagsize': GoType.Int(),
        'noncesize': GoType.Int(),
        'saltsize': GoType.Int(),
        'needskey': GoType.Bool(),
        'needsnonce': GoType.Bool(),
        'needsiv': GoType.Bool(),
        'needssalt': GoType.Bool(),
        // Bool fields discovered from algorithm metadata
        'saltrequired': GoType.Bool(),
        'supportscontinuousencoding': GoType.Bool(),
        'supportsdetached': GoType.Bool(),
        'supportserrordetection': GoType.Bool(),
        'roundtrip': GoType.Bool(),
        'firststep': GoType.Bool(),
        'usepadding': GoType.Bool(),
        'extended': GoType.Bool(),
        'evenparity': GoType.Bool(),
        'syndromeextraction': GoType.Bool(),
        'testreconstruction': GoType.Bool(),
        'testmode': GoType.Bool(),
        // String fields discovered from algorithm metadata
        'hashfunction': GoType.String(),
        'alphabet': GoType.String(),
        'default_hash': GoType.String(),
        'defaulthash': GoType.String(),
        'paramset': GoType.String(),
        'paddingchar': GoType.String(),
        'securitynotes': GoType.String(),
        'currentvariant': GoType.String(),
        'uppercase': GoType.String(),
        'lowercase': GoType.String(),
        'currentlevel': GoType.String(),
        'hashalgorithm': GoType.String(),
        'upper_reverse': GoType.String(),
        'lower_reverse': GoType.String(),
        'currentmode': GoType.String(),
        'consonants': GoType.String(),
        'vowels': GoType.String(),
        'language': GoType.String(),
        'rotor_i': GoType.String(),
        'rotor_ii': GoType.String(),
        'rotor_iii': GoType.String(),
        'notch_i': GoType.String(),
        'notch_ii': GoType.String(),
        'notch_iii': GoType.String(),
        'reflector_b': GoType.String(),
        'innertype': GoType.String(),
        'outertype': GoType.String(),
        'interleavetype': GoType.String(),
        'designtype': GoType.String(),
        'errortype': GoType.String(),
        'direction': GoType.String(),
        'digitstring': GoType.String(),
        'prefix': GoType.String(),
        'mgffunction': GoType.String(),
        'paddingtype': GoType.String(),
        // Instance fields that store computed results
        'result': GoType.Slice(GoType.UInt8()),
        'result_': GoType.Slice(GoType.UInt8()),
        'password': GoType.Slice(GoType.UInt8()),
        'inputdata': GoType.Slice(GoType.UInt8()),
        // Map fields for parameter dictionaries
        'mceliece_params': GoType.Map(GoType.String(), GoType.Interface()),
        'dilithium_params': GoType.Map(GoType.String(), GoType.Interface()),
        'falcon_params': GoType.Map(GoType.String(), GoType.Interface()),
        'hqc_params': GoType.Map(GoType.String(), GoType.Interface()),
        'lwe_params': GoType.Map(GoType.String(), GoType.Interface()),
        'ml_dsa_params': GoType.Map(GoType.String(), GoType.Interface()),
        'rsa_params': GoType.Map(GoType.String(), GoType.Interface()),
        'sphincs_params': GoType.Map(GoType.String(), GoType.Interface()),
        'params': GoType.Map(GoType.String(), GoType.Interface()),
        // Vulnerability tracking
        'vulnerabilities': GoType.Slice(new GoType('Vulnerability')),
      };

      if (FRAMEWORK_FIELD_TYPES[lowerName]) {
        return FRAMEWORK_FIELD_TYPES[lowerName];
      }
      // Also try without leading underscores (e.g., _interleaveType -> interleavetype)
      const stripped = lowerName.replace(/^_+/, '');
      if (stripped !== lowerName && FRAMEWORK_FIELD_TYPES[stripped]) {
        return FRAMEWORK_FIELD_TYPES[stripped];
      }

      // Handle null/nil initialization - field needs interface{} to support nil
      if (value && ((value.type === 'Literal' && value.value === null) ||
                    (value.type === 'Literal' && value.literalType === 'nil') ||
                    (value.nodeType === 'Literal' && value.value === null) ||
                    (value.nodeType === 'Literal' && value.literalType === 'nil'))) {
        return GoType.Interface();
      }

      // Handle ObjectExpression values BEFORE name-based inference
      // Object literals should become map[string]interface{} in Go, not slices
      if (value && value.type === 'ObjectExpression' && value.properties && value.properties.length > 0) {
        // Return map type - Go doesn't support inline anonymous struct types
        return GoType.Map(GoType.String(), GoType.Interface());
      }

      // Try name-based inference for common crypto patterns FIRST
      // This correctly handles fields like inputBuffer, key, data which should be []uint8
      const nameBasedType = this.inferTypeFromName(propName);
      const nameTypeStr = nameBasedType?.toString();

      // Detect boolean literal values — always return Bool regardless of name
      const isBoolValue = value && (
        (value.type === 'Literal' && typeof value.value === 'boolean') ||
        (value.ilNodeType === 'Literal' && typeof value.value === 'boolean')
      );
      if (isBoolValue)
        return GoType.Bool();

      // Detect float literal values — return Float64 regardless of name
      // e.g., LEARNING_RATE = 0.001 should be float64, not uint32
      const isFloatLiteral = value && (
        (value.type === 'Literal' && typeof value.value === 'number' && !Number.isInteger(value.value)) ||
        (value.ilNodeType === 'Literal' && typeof value.value === 'number' && !Number.isInteger(value.value))
      );
      if (isFloatLiteral)
        return GoType.Float64();

      // Detect BigInt literal values — return UInt64 regardless of name
      // e.g., this.A = 6364136223846793005n should be uint64, not uint32
      const isBigIntValue = value && (
        (value.type === 'Literal' && typeof value.value === 'bigint') ||
        (value.ilNodeType === 'BigIntLiteral') ||
        (value.ilNodeType === 'BigIntCast') ||
        (value.type === 'TypeConversion' && value.goType?.name === 'uint64') ||
        (value.type === 'CallExpression' && value.callee?.name === 'uint64')
      );
      if (isBigIntValue)
        return GoType.UInt64();

      // Detect integer literal values that exceed uint32 range — return UInt64
      const isLargeIntValue = value && (
        (value.type === 'Literal' && typeof value.value === 'number' &&
         Number.isInteger(value.value) && (value.value > 0xFFFFFFFF || value.value < -2147483648))
      );
      if (isLargeIntValue)
        return GoType.UInt64();

      // If name-based inference returns a slice/array type, trust it over IL annotations
      // UNLESS the actual value is a numeric literal (e.g., this.keyCS = 0, this.HALF_BLOCK = 256)
      // In that case, the value clearly isn't a slice, so don't trust the name heuristic
      const isScalarValue = value && (
        (value.type === 'Literal' && typeof value.value === 'number') ||
        (value.ilNodeType === 'Literal' && typeof value.value === 'number')
      );
      if (nameBasedType && (nameBasedType.isSlice || nameBasedType.isArray) && !isScalarValue) {
        return nameBasedType;
      }

      // Detect calls to known slice-returning functions (makeFilledSlice, cloneArray, etc.)
      if (value && (value.type === 'CallExpression' || value.ilNodeType === 'CallExpression')) {
        const calleeName = value.callee?.name || value.callee?.property?.name || value.callee?.property || '';
        const SLICE_RETURNING_FUNCS = ['makeFilledSlice', 'cloneArray', 'xorArrays', 'reverseSlice',
          'sortSlice', 'stringToBytes', 'asciiToBytes', 'ansiToBytes', 'hexToBytes', 'hex8ToBytes',
          'mustHexDecode', 'filterSliceBytes', 'mapSliceBytes', 'spliceSlice', 'copySlice', 'unshiftSlice'];
        if (SLICE_RETURNING_FUNCS.includes(calleeName))
          return GoType.Slice(GoType.UInt8());
      }

      // For array/slice creating expressions where name didn't match a slice pattern,
      // use expression-based inference. This handles fields like sum0 = new Array(...)
      // where we need to detect it's an array even though name inference returns uint32.
      const ARRAY_CREATING_TYPES = [
        'ArrayCreation', 'ArrayLiteral', 'ArrayExpression',
        'TypedArrayCreation', 'NewExpression'
      ];
      if (value && ARRAY_CREATING_TYPES.includes(value.type)) {
        const exprType = this.inferFullExpressionType(value);
        if (exprType && (exprType.isSlice || exprType.isArray)) {
          return exprType;
        }
      }

      // Use non-slice name-based type if available
      if (nameTypeStr && !nameTypeStr.includes('interface') && nameTypeStr !== 'any') {
        return nameBasedType;
      }

      // Fallback to expression-based inference
      return this.inferFullExpressionType(value) || GoType.Interface();
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt, debug = false) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      // Check for standard JS MemberExpression with ThisExpression
      if (expr.left.type === 'MemberExpression' && expr.left.object?.type === 'ThisExpression') {
        return true;
      }
      // Check for IL AST ThisPropertyAccess pattern
      if (expr.left.type === 'ThisPropertyAccess') {
        return true;
      }
      return false;
    }

    /**
     * Process a this.property = value assignment
     * Returns {isMethod: boolean, field?: GoField, method?: GoFunc, initStatement?: GoNode, skipField?: boolean}
     */
    processThisAssignment(stmt, structName) {
      const expr = stmt.expression;
      // Handle both MemberExpression and ThisPropertyAccess patterns
      let propName;
      if (expr.left.type === 'ThisPropertyAccess') {
        propName = expr.left.property;
      } else {
        propName = expr.left.property.name || expr.left.property.value;
      }
      const pascalName = this.toPascalCase(propName);
      const value = expr.right;

      // Check if assigning a function (method)
      if (value.type === 'FunctionExpression' || value.type === 'ArrowFunctionExpression') {
        // This is a method definition
        const method = this.transformFunctionToMethod(propName, value, structName);
        return { isMethod: true, method };
      }

      // Skip null literal assignments - these are just initializations
      // The actual type will be determined from later assignments in method bodies
      // via extractSetterFields. Go zero-values slices/maps/pointers to nil automatically.
      if (value?.type === 'Literal' && value.value === null) {
        return { isMethod: false, field: null, initStatement: null, skipField: true };
      }

      // Fields from BaseAlgorithm that should NOT be re-declared in the struct
      // (they exist in the embedded base struct)
      // Include both camelCase and lowercase versions for matching
      // Only filter fields that actually exist in the current base class
      const BASE_FIELDS = [
        'name', 'description', 'inventor', 'year', 'category',
        'subCategory', 'subcategory',
        'securityStatus', 'securitystatus',
        'complexity', 'country',
        'documentation', 'references',
        'knownVulnerabilities', 'knownvulnerabilities',
        'tests',
      ];
      const EXTRA_FIELDS_BY_BASE = {
        'BlockCipherAlgorithm': ['supportedKeySizes', 'supportedkeysizes', 'supportedBlockSizes', 'supportedblocksizes'],
        'StreamCipherAlgorithm': ['supportedKeySizes', 'supportedkeysizes', 'supportedIVSizes', 'supportedivsizes'],
        'HashFunctionAlgorithm': ['outputSize', 'outputsize', 'blockSize', 'blocksize'],
        'AsymmetricAlgorithm': ['supportedKeySizes', 'supportedkeysizes'],
        'MacAlgorithm': ['supportedKeySizes', 'supportedkeysizes', 'outputSize', 'outputsize'],
        'KdfAlgorithm': ['supportedKeySizes', 'supportedkeysizes', 'supportedSaltSizes', 'supportedsaltsizes'],
        'AeadAlgorithm': ['supportedKeySizes', 'supportedkeysizes', 'supportedNonceSizes', 'supportednoncesizes', 'supportedTagSizes', 'supportedtagsizes'],
        'CryptoAlgorithm': ['supportedKeySizes', 'supportedkeysizes'],
        'SymmetricCipherAlgorithm': ['supportedKeySizes', 'supportedkeysizes'],
        'AsymmetricCipherAlgorithm': ['supportedKeySizes', 'supportedkeysizes'],
        'ChecksumAlgorithm': ['outputSize', 'outputsize'],
      };
      const extraFields = EXTRA_FIELDS_BY_BASE[this.currentMappedBase] || [];
      const BASE_ALGORITHM_FIELDS = new Set([...BASE_FIELDS, ...extraFields]);

      // Framework enum types - use correct types instead of inference
      // Use lowercase keys for consistent lookup
      // Note: BaseAlgorithm uses value types (not pointers) for all fields
      const FRAMEWORK_FIELD_TYPES = {
        'category': new GoType('CategoryType'),
        'securitystatus': new GoType('SecurityStatus'),
        'complexity': new GoType('ComplexityType'),
        'country': new GoType('CountryCode'),
        'documentation': GoType.Slice(new GoType('LinkItem')),
        'references': GoType.Slice(new GoType('LinkItem')),
        'knownvulnerabilities': GoType.Slice(new GoType('Vulnerability')),
        'supportedkeysizes': GoType.Slice(new GoType('KeySize')),
        'supportedblocksizes': GoType.Slice(new GoType('KeySize')),
        'supportednoncesizes': GoType.Slice(new GoType('KeySize')),
        'supportedivsizes': GoType.Slice(new GoType('KeySize')),
        'supportedtagsizes': GoType.Slice(new GoType('KeySize')),
        'supportedsaltsizes': GoType.Slice(new GoType('KeySize')),
        'supportedoutputsizes': GoType.Slice(new GoType('KeySize')),
        'supportedmacsizes': GoType.Slice(new GoType('KeySize')),
        'supportedhashsizes': GoType.Slice(new GoType('KeySize')),
        'supportedkeyderivationsizes': GoType.Slice(new GoType('KeySize')),
        'supporteddigestsizes': GoType.Slice(new GoType('KeySize')),
        'supportedsignaturesizes': GoType.Slice(new GoType('KeySize')),
        'supportedinputsizes': GoType.Slice(new GoType('KeySize')),
        'supportedseedsizes': GoType.Slice(new GoType('KeySize')),
        'supportedrounds': GoType.Slice(new GoType('KeySize')),
        'supportedversions': GoType.Slice(new GoType('KeySize')),
        'supportedvariants': GoType.Slice(new GoType('KeySize')),
        'supportedmodes': GoType.Slice(new GoType('KeySize')),
        'tagsizes': GoType.Slice(new GoType('KeySize')),
        'saltsizes': GoType.Slice(new GoType('KeySize')),
        // Numeric fields from algorithm base classes
        'outputsize': GoType.Int(),
        'blocksize': GoType.Int(),
        'statesize': GoType.Int(),
        'rounds': GoType.Int(),
        'digestsize': GoType.Int(),
        'tagsize': GoType.Int(),
        'noncesize': GoType.Int(),
        'saltsize': GoType.Int(),
        'needskey': GoType.Bool(),
        'needsnonce': GoType.Bool(),
        'needsiv': GoType.Bool(),
        'needssalt': GoType.Bool(),
        // Bool fields discovered from algorithm metadata
        'saltrequired': GoType.Bool(),
        'supportscontinuousencoding': GoType.Bool(),
        'supportsdetached': GoType.Bool(),
        'supportserrordetection': GoType.Bool(),
        'roundtrip': GoType.Bool(),
        'firststep': GoType.Bool(),
        'usepadding': GoType.Bool(),
        'extended': GoType.Bool(),
        'evenparity': GoType.Bool(),
        'syndromeextraction': GoType.Bool(),
        'testreconstruction': GoType.Bool(),
        'testmode': GoType.Bool(),
        // String fields discovered from algorithm metadata
        'hashfunction': GoType.String(),
        'alphabet': GoType.String(),
        'default_hash': GoType.String(),
        'defaulthash': GoType.String(),
        'paramset': GoType.String(),
        'paddingchar': GoType.String(),
        'securitynotes': GoType.String(),
        'currentvariant': GoType.String(),
        'uppercase': GoType.String(),
        'lowercase': GoType.String(),
        'currentlevel': GoType.String(),
        'hashalgorithm': GoType.String(),
        'upper_reverse': GoType.String(),
        'lower_reverse': GoType.String(),
        'currentmode': GoType.String(),
        'consonants': GoType.String(),
        'vowels': GoType.String(),
        'language': GoType.String(),
        'rotor_i': GoType.String(),
        'rotor_ii': GoType.String(),
        'rotor_iii': GoType.String(),
        'notch_i': GoType.String(),
        'notch_ii': GoType.String(),
        'notch_iii': GoType.String(),
        'reflector_b': GoType.String(),
        'innertype': GoType.String(),
        'outertype': GoType.String(),
        'interleavetype': GoType.String(),
        'designtype': GoType.String(),
        'errortype': GoType.String(),
        'direction': GoType.String(),
        'digitstring': GoType.String(),
        'prefix': GoType.String(),
        'mgffunction': GoType.String(),
        'paddingtype': GoType.String(),
        // Instance fields that store computed results
        'result': GoType.Slice(GoType.UInt8()),
        'result_': GoType.Slice(GoType.UInt8()),
        'password': GoType.Slice(GoType.UInt8()),
        'inputdata': GoType.Slice(GoType.UInt8()),
        // Map fields for parameter dictionaries
        'mceliece_params': GoType.Map(GoType.String(), GoType.Interface()),
        'dilithium_params': GoType.Map(GoType.String(), GoType.Interface()),
        'falcon_params': GoType.Map(GoType.String(), GoType.Interface()),
        'hqc_params': GoType.Map(GoType.String(), GoType.Interface()),
        'lwe_params': GoType.Map(GoType.String(), GoType.Interface()),
        'ml_dsa_params': GoType.Map(GoType.String(), GoType.Interface()),
        'rsa_params': GoType.Map(GoType.String(), GoType.Interface()),
        'sphincs_params': GoType.Map(GoType.String(), GoType.Interface()),
        'params': GoType.Map(GoType.String(), GoType.Interface()),
        'vulnerabilities': GoType.Slice(new GoType('Vulnerability')),
        'tests': GoType.Slice(new GoType('TestCase')),
        'testvectors': GoType.Slice(new GoType('TestCase'))
      };

      // Check if this is a base class field that should not be re-declared
      // Both original camelCase and lowercase versions for comparison
      const lowerName = propName.toLowerCase();
      const isBaseField = BASE_ALGORITHM_FIELDS.has(propName) || BASE_ALGORITHM_FIELDS.has(lowerName);

      // Field assignment - check for JSDoc @type annotation first
      let fieldType = null;

      // Extract type from JSDoc @type annotation if present
      if (stmt.leadingComments && stmt.leadingComments.length > 0) {
        for (const comment of stmt.leadingComments) {
          const text = comment.value || comment;
          const typeMatch = text.match(/@type\s+\{([^}]+)\}/);
          if (typeMatch) {
            const jsDocType = typeMatch[1].trim();
            fieldType = this.mapJSDocType(jsDocType);
            break;
          }
        }
      }

      // Fall back to framework types or inference
      if (!fieldType) {
        // Try with and without leading underscores for framework field lookup
        const strippedLower = lowerName.replace(/^_+/, '');
        if (FRAMEWORK_FIELD_TYPES[lowerName]) {
          fieldType = FRAMEWORK_FIELD_TYPES[lowerName];
        } else if (strippedLower !== lowerName && FRAMEWORK_FIELD_TYPES[strippedLower]) {
          fieldType = FRAMEWORK_FIELD_TYPES[strippedLower];
        } else {
          // Use inferFieldTypeFromValue which applies name-based heuristics first
          fieldType = this.inferFieldTypeFromValue(value, propName);
        }
      }

      // Register field type for later type inference in method bodies
      this.structFieldTypes.set(pascalName, fieldType);
      this.structFieldTypes.set(propName, fieldType);

      // Check if this field name collides with a method (use renamed version if so)
      let finalFieldName = pascalName;
      if (this.currentStruct) {
        const renameKey = `${this.currentStruct.name}.${pascalName}`;
        if (this.renamedFields.has(renameKey)) {
          finalFieldName = this.renamedFields.get(renameKey);
        }
      }

      // Create field (only if not a base class field)
      const field = isBaseField ? null : new GoField(finalFieldName, fieldType);

      // Create initialization statement: result.FieldName = value
      // Pass field type for proper array literal typing
      const resultIdent = new GoIdentifier('result');
      const fieldAccess = new GoSelectorExpression(resultIdent, finalFieldName);
      let initValue = this.transformExpression(value, fieldType);

      // Add type assertion if assigning from any/interface{} to a specific type
      // This handles Identifiers, MemberExpressions (e.g., config["base"]), and other expressions
      const valueType = this.inferFullExpressionType(value);
      const valueTypeStr = valueType?.toString() || '';
      const fieldTypeStr = fieldType?.toString() || '';
      // If source is any/interface{} but target is a specific type, add type assertion
      // BUT: skip if the value is nil (null in JS) - nil cannot have type assertions
      const isNilLiteral = initValue.nodeType === 'Literal' && initValue.value === null;
      if (!isNilLiteral &&
          (valueTypeStr === 'any' || valueTypeStr === 'interface{}') &&
          fieldTypeStr && fieldTypeStr !== 'any' && fieldTypeStr !== 'interface{}') {
        initValue = this.safeTypeAssertion(initValue, fieldType);
      }

      // Add numeric type conversion for mismatched types (e.g., int → uint32)
      const _numTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                         'uint', 'uint8', 'uint16', 'uint32', 'uint64',
                         'float32', 'float64'];
      if (!isNilLiteral && fieldTypeStr !== valueTypeStr &&
          _numTypes.includes(fieldTypeStr) && _numTypes.includes(valueTypeStr)) {
        initValue = new GoTypeConversion(fieldType, initValue);
      }

      const initStatement = new GoExpressionStatement(
        new GoAssignment([fieldAccess], '=', [initValue])
      );

      return { isMethod: false, field, initStatement, skipField: isBaseField };
    }

    /**
     * Transform a function expression to a method with receiver
     */
    transformFunctionToMethod(methodName, funcNode, structName) {
      const pascalName = this.toPascalCase(methodName);
      const func = new GoFunc(pascalName);

      // Set receiver name
      this.receiverName = this.getReceiverName(structName);

      // Add receiver (pointer receiver for methods that might modify state)
      func.receiver = new GoParameter(this.receiverName, GoType.Pointer(new GoType(structName)));

      // Transform parameters
      if (funcNode.params) {
        for (let i = 0; i < funcNode.params.length; ++i) {
          const param = funcNode.params[i];
          const paramType = this.inferParameterType(param, funcNode.body, methodName, i);
          func.parameters.push(new GoParameter(param.name, paramType));
          this.variableTypes.set(param.name, paramType);
        }
      }

      // Determine return type
      func.results = this.inferFunctionReturnType(funcNode);

      // Register method return type for later lookup
      if (func.results.length > 0) {
        const returnType = func.results[0].type;
        this.methodReturnTypes.set(methodName, returnType);
        this.methodReturnTypes.set(pascalName, returnType);
        // Set current function return type for empty array inference
        this.currentFunctionReturnType = returnType;
      }

      // Transform body
      if (funcNode.body) {
        func.body = this.transformBlockStatement(funcNode.body);
      }

      // Clear current function return type
      this.currentFunctionReturnType = null;

      // Clear parameter types
      if (funcNode.params) {
        for (const param of funcNode.params) {
          this.variableTypes.delete(param.name);
        }
      }

      return func;
    }

    transformMethod(node, structName) {
      const originalMethodName = node.key.name; // Keep original for call site lookup
      let methodName = this.toPascalCase(originalMethodName);
      // Detect method-to-method name collisions
      if (structName) {
        if (!this.declaredMethodNames.has(structName)) this.declaredMethodNames.set(structName, new Set());
        var existingNames = this.declaredMethodNames.get(structName);
        if (existingNames.has(methodName)) {
          let suffix = 2;
          while (existingNames.has(methodName + suffix)) suffix++;
          methodName = methodName + suffix;
          this.methodRenames.set(structName + "."+originalMethodName, methodName);
        }
        existingNames.add(methodName);
      }
      const func = new GoFunc(methodName);

      // Set receiver name based on struct
      this.receiverName = this.getReceiverName(structName);

      // Add receiver (pointer receiver for methods that might modify state)
      func.receiver = new GoParameter(this.receiverName, GoType.Pointer(new GoType(structName)));

      // Transform parameters with type inference
      if (node.value && node.value.params) {
        for (let i = 0; i < node.value.params.length; ++i) {
          const param = node.value.params[i];
          // Use original method name for call site lookup (e.g., _encryptWords)
          const paramType = this.inferParameterType(param, node.value.body, originalMethodName, i);
          func.parameters.push(new GoParameter(param.name, paramType));

          // Register parameter type for body transformation
          this.variableTypes.set(param.name, paramType);

          // Store declared parameter type for call-site type assertions
          const declaredKey = `${originalMethodName}:${i}`;
          this.methodDeclaredParams.set(declaredKey, paramType);
          // Also store with PascalCase for lookup
          this.methodDeclaredParams.set(`${methodName}:${i}`, paramType);
        }
      }

      // Determine return type (clear empty array tracking per method to avoid cross-method pollution)
      this.prescanEmptyArrayVars.clear();
      func.results = this.inferFunctionReturnType(node.value);

      // Set current function return type for empty array inference
      if (func.results.length > 0) {
        this.currentFunctionReturnType = func.results[0].type;

        // Fix prescan-inferred array types: if the function returns []uint8 but
        // prescan inferred []uint32 for empty arrays (from push of uint32 values),
        // update them to match the return type
        const retType = this.currentFunctionReturnType;
        if (retType && retType.isSlice && retType.valueType) {
          const retElemName = retType.valueType.name || retType.valueType.toString();
          if (retElemName === 'uint8' || retElemName === 'byte') {
            for (const [varName, varType] of this.variableTypes.entries()) {
              if (varType && varType.isSlice && varType.valueType) {
                const elemName = varType.valueType.name || varType.valueType.toString();
                if ((elemName === 'uint32' || elemName === 'int32') && this.prescanEmptyArrayVars.has(varName)) {
                  this.variableTypes.set(varName, retType);
                }
              }
            }
          }
        }
      }

      // Transform body
      if (node.value && node.value.body) {
        func.body = this.transformBlockStatement(node.value.body);
      }

      // Clear current function return type
      this.currentFunctionReturnType = null;

      // Clear parameter types after transformation
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          this.variableTypes.delete(param.name);
        }
      }

      return func;
    }

    /**
     * Extract dynamically created fields from setter method bodies
     * Scans for patterns like: this.fieldName = new Array(...) or this.fieldName = value
     */
    extractSetterFields(node, structName) {
      const fields = [];
      const seenFields = new Set();

      const scanNode = (n) => {
        if (!n) return;

        // Look for this.fieldName = value patterns
        if (n.type === 'ExpressionStatement' &&
            n.expression?.type === 'AssignmentExpression' &&
            n.expression.operator === '=' &&
            this.isThisPropertyAssignment(n)) {
          const propName = n.expression.left.property?.name || n.expression.left.property;
          const rightNode = n.expression.right;

          // Skip null literal assignments - these are just initializations
          if (rightNode?.type === 'Literal' && rightNode.value === null) {
            return; // Skip this assignment but don't mark field as seen
          }

          if (propName && !seenFields.has(propName)) {
            seenFields.add(propName);

            // Infer type from the assignment, using name-based heuristics first
            let valueType = this.inferFieldTypeFromValue(rightNode, propName);
            const pascalName = this.toPascalCase(propName);

            // For arrays/slices created with new Array(size), look for later element assignments
            // to determine element type. We improve the type if it's interface{} or uint8 (the defaults)
            if (valueType && (valueType.isSlice || valueType.isArray)) {
              const currentElemType = valueType.valueType || valueType.elementType;
              const needsImprovement = !currentElemType || currentElemType.isInterface ||
                  currentElemType.name === 'interface{}' ||
                  currentElemType.name === 'uint8'; // uint8 is the default for ArrayCreation
              if (needsImprovement) {
                const elementType = this.inferArrayElementType(propName, node.value?.body);
                if (elementType && !elementType.isInterface && elementType.name !== 'interface{}' &&
                    elementType.name !== 'uint8') {
                  valueType = GoType.Slice(elementType);
                }
              }
            }

            // Check if this field is already in structFieldTypes (from constructor)
            if (!this.structFieldTypes.has(propName) && !this.structFieldTypes.has(pascalName)) {
              const field = new GoField(pascalName, valueType || GoType.Interface());
              fields.push(field);
              // Register the field type
              this.structFieldTypes.set(pascalName, valueType);
              this.structFieldTypes.set(propName, valueType);
            }
          }
        }

        // Recurse through node properties
        for (const key in n) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (Array.isArray(val)) {
            for (const item of val) {
              if (item && typeof item === 'object') {
                scanNode(item);
              }
            }
          } else if (val && typeof val === 'object') {
            scanNode(val);
          }
        }
      };

      // Scan the setter body
      if (node.value?.body) {
        scanNode(node.value.body);
      }

      return fields;
    }

    /**
     * Infer array element type by scanning for element assignments like arr[i] = value
     */
    inferArrayElementType(arrayName, bodyNode) {
      if (!bodyNode) return null;

      let elementType = null;

      const scanNode = (n) => {
        if (!n || elementType) return;

        // Look for this.arrayName[index] = value patterns
        if (n.type === 'ExpressionStatement' &&
            n.expression?.type === 'AssignmentExpression' &&
            n.expression.operator === '=') {
          const left = n.expression.left;
          // Check for MemberExpression with computed access (array indexing)
          if (left.type === 'MemberExpression' && left.computed) {
            let objectName = null;
            // Handle this.arrayName[i]
            if (left.object?.type === 'ThisPropertyAccess') {
              objectName = left.object.property;
            } else if (left.object?.type === 'MemberExpression' &&
                       left.object.object?.type === 'ThisExpression') {
              objectName = left.object.property?.name || left.object.property;
            }

            if (objectName === arrayName) {
              // Found an element assignment - infer type from the value
              elementType = this.inferFullExpressionType(n.expression.right);
              return;
            }
          }
        }

        // Recurse through node properties
        for (const key in n) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (Array.isArray(val)) {
            for (const item of val) {
              if (item && typeof item === 'object') {
                scanNode(item);
              }
            }
          } else if (val && typeof val === 'object') {
            scanNode(val);
          }
        }
      };

      scanNode(bodyNode);
      return elementType;
    }

    inferParameterType(param, bodyNode, methodName = null, paramIndex = -1) {
      const name = param.name;

      // FIRST: Check for typeof usage - this indicates polymorphic parameter (string|array|etc)
      // Must be checked before call site inference since typeof implies dynamic typing
      // and call sites might be passing specific types to a polymorphic function
      if (bodyNode && bodyNode.body) {
        for (const stmt of bodyNode.body) {
          if (this.hasTypeofCheck(stmt, name)) {
            return this.options.useGenerics ? new GoType('any') : GoType.Interface();
          }
        }
      }

      // Check for IL resultType annotation on parameter (from type-aware-transpiler)
      if (param.resultType === 'boolean' || param.resultType === 'bool')
        return GoType.Bool();

      // Check for boolean parameter names (framework convention)
      const lowerName = name.toLowerCase();
      if (lowerName === 'isinverse' || lowerName === 'inverse' ||
          lowerName === 'isdecrypt' || lowerName === 'decrypt' ||
          lowerName === 'isencode' || lowerName === 'isdecode' ||
          (name.startsWith('is') && name.length > 2 && name[2] === name[2].toUpperCase()))
        return GoType.Bool();

      // Numeric suffix check BEFORE crypto name check
      // blockSize, keyLength, inputOffset, dataCount etc. are numeric, not byte arrays
      const _isNumericSuffix = lowerName.endsWith('size') || lowerName.endsWith('count') ||
          lowerName.endsWith('length') || lowerName.endsWith('len') ||
          lowerName.endsWith('offset') || lowerName.endsWith('index') ||
          lowerName.endsWith('bits') || lowerName.endsWith('rounds') ||
          lowerName.endsWith('num') || lowerName.endsWith('width') ||
          lowerName.endsWith('height') || lowerName.endsWith('depth');
      if (_isNumericSuffix)
        return GoType.Int();

      // Check name-based type inference for crypto parameters EARLY
      // This handles common crypto patterns like plaintext, ciphertext, key, data, etc.
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('buffer') ||
          lowerName.includes('plaintext') || lowerName.includes('ciphertext') ||
          lowerName.includes('message') || lowerName.includes('digest') ||
          lowerName.includes('tag') || lowerName.includes('aad') ||
          lowerName.includes('bytes') || lowerName.includes('nonce') ||
          lowerName === 'iv' || lowerName === 'src' || lowerName === 'dst') {
        return GoType.Slice(GoType.UInt8());
      }

      // Second, check if we have call site type information for this parameter
      // This is the most accurate source since it's based on actual usage
      if (methodName && paramIndex >= 0) {
        const callSiteKey = `${methodName}:${paramIndex}`;
        const callSiteType = this.methodParamTypes.get(callSiteKey);
        if (callSiteType && callSiteType.name !== 'interface{}' && callSiteType.name !== 'any') {
          return callSiteType;
        }
        // Also try with underscore prefix stripped (private method naming)
        if (methodName.startsWith('_')) {
          const altKey = `${methodName.slice(1)}:${paramIndex}`;
          const altType = this.methodParamTypes.get(altKey);
          if (altType && altType.name !== 'interface{}' && altType.name !== 'any') {
            return altType;
          }
        }
      }

      // Check for JSDoc type annotation
      if (param.typeAnnotation) {
        return this.mapType(param.typeAnnotation.type);
      }

      // Name-based numeric parameter inference (before body analysis)
      // Parameters clearly indicating numeric types from name patterns
      if (lowerName === 'offset' || lowerName === 'pos' || lowerName === 'position' ||
          lowerName === 'idx' || lowerName === 'index' || lowerName === 'start' ||
          lowerName === 'end' || lowerName === 'len' || lowerName === 'length' ||
          lowerName === 'size' || lowerName === 'count' || lowerName === 'num' ||
          lowerName === 'shift' || lowerName === 'bits' || lowerName === 'rounds' ||
          lowerName === 'width' || lowerName === 'height' || lowerName === 'depth' ||
          lowerName.endsWith('offset') || lowerName.endsWith('index') ||
          lowerName.endsWith('pos') || lowerName.endsWith('len') ||
          lowerName.endsWith('count') || lowerName.endsWith('size') ||
          lowerName.endsWith('bits') || lowerName.endsWith('rounds'))
        return GoType.Int();

      // Always analyze usage patterns in body to infer types
      if (bodyNode && bodyNode.body) {

        for (const stmt of bodyNode.body) {
          // Look for bitwise operations FIRST: param << n, param >> n, param & x, param | x, param ^ x
          // Bitwise ops are a strong signal of numeric type - must check before map key usage
          if (this.hasBitwiseOperation(stmt, name)) {
            return GoType.UInt32();
          }

          // Look for calls to rotation/bitwise functions with this parameter
          if (this.hasBitFunctionCall(stmt, name)) {
            return GoType.UInt32();
          }

          // Look for arithmetic operations: param + n, param - n, param * n, etc.
          // This indicates numeric type (int), not string
          if (this.hasArithmeticOperation(stmt, name)) {
            return GoType.Int();
          }

          // Look for array access: param[i]
          if (this.hasArrayAccess(stmt, name)) {
            return GoType.Slice(GoType.UInt8());
          }

          // Look for .length property access
          if (this.hasLengthAccess(stmt, name)) {
            return GoType.Slice(GoType.UInt8());
          }

          // Look for map key access: configs[param] - param should be string
          // Checked AFTER bitwise/array since those are more reliable signals
          if (this.hasMapKeyUsage(stmt, name)) {
            return GoType.String();
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

    hasArithmeticOperation(node, varName) {
      if (!node) return false;
      // Check for arithmetic binary expressions: param + N, param - N, param * N, param / N, param % N
      if (node.type === 'BinaryExpression') {
        const arithOps = ['+', '-', '*', '/', '%'];
        if (arithOps.includes(node.operator)) {
          const leftIsVar = node.left.type === 'Identifier' && node.left.name === varName;
          const rightIsVar = node.right.type === 'Identifier' && node.right.name === varName;
          const leftIsNum = node.left.type === 'Literal' && typeof node.left.value === 'number';
          const rightIsNum = node.right.type === 'Literal' && typeof node.right.value === 'number';
          // param + N or N + param (but NOT string + param which is concatenation)
          if ((leftIsVar && rightIsNum) || (rightIsVar && leftIsNum))
            return true;
          // param + otherVar (in arithmetic context, e.g., offset + i)
          if ((leftIsVar || rightIsVar) && node.operator !== '+')
            return true; // Only +/- could be string concat; *, /, % are always numeric
        }
      }
      // Recurse through node properties
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(child => child && typeof child === 'object' && this.hasArithmeticOperation(child, varName)))
            return true;
        } else if (value && typeof value === 'object') {
          if (this.hasArithmeticOperation(value, varName))
            return true;
        }
      }
      return false;
    }

    hasBitwiseOperation(node, varName) {
      if (!node) return false;

      // Check for bitwise binary expressions with this variable
      if (node.type === 'BinaryExpression') {
        const bitwiseOps = ['<<', '>>', '>>>', '&', '|', '^'];
        if (bitwiseOps.includes(node.operator)) {
          // Check if left or right operand is our variable
          if ((node.left.type === 'Identifier' && node.left.name === varName) ||
              (node.right.type === 'Identifier' && node.right.name === varName)) {
            return true;
          }
        }
      }

      // Recurse through node properties
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(child => child && typeof child === 'object' && this.hasBitwiseOperation(child, varName))) {
            return true;
          }
        } else if (value && typeof value === 'object') {
          if (this.hasBitwiseOperation(value, varName)) {
            return true;
          }
        }
      }

      return false;
    }

    hasBitFunctionCall(node, varName) {
      if (!node) return false;

      // Check for calls to rotation/bitwise functions
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        let funcName = '';

        if (callee.type === 'Identifier') {
          funcName = callee.name;
        } else if (callee.type === 'MemberExpression' && callee.property) {
          funcName = callee.property.name || callee.property;
        }

        // List of functions that require uint32 operands
        const uint32Funcs = [
          'RotL32', 'RotR32', 'rotl32', 'rotr32',
          'RotateLeft32', 'RotateLeft', 'RotateRight32', 'RotateRight',
          'Pack32BE', 'Pack32LE', 'pack32BE', 'pack32LE',
          'Unpack32BE', 'Unpack32LE', 'unpack32BE', 'unpack32LE'
        ];

        if (uint32Funcs.some(fn => funcName.includes(fn) || funcName.toLowerCase().includes(fn.toLowerCase()))) {
          // Check if our variable is an argument
          for (const arg of node.arguments || []) {
            if (arg.type === 'Identifier' && arg.name === varName) {
              return true;
            }
          }
        }
      }

      // Recurse through node properties
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(child => child && typeof child === 'object' && this.hasBitFunctionCall(child, varName))) {
            return true;
          }
        } else if (value && typeof value === 'object') {
          if (this.hasBitFunctionCall(value, varName)) {
            return true;
          }
        }
      }

      return false;
    }

    hasMapKeyUsage(node, varName) {
      if (!node) return false;

      // Check for MemberExpression with computed property: configs[variant]
      // This indicates the variable is used as a map key (should be string)
      // BUT NOT when the object is an array/slice (bytes[offset] means offset is an int index, not a string key)
      if (node.type === 'MemberExpression' && node.computed) {
        if (node.property && node.property.type === 'Identifier' && node.property.name === varName) {
          // Check object type - if it's a known array/slice, this is array indexing, not map key access
          const objType = this.inferFullExpressionType(node.object);
          const objTypeStr = objType?.toString() || '';
          if (objType && (objType.isSlice || objType.isArray || objTypeStr.startsWith('[]')))
            return false; // Array indexing, not map key usage
          // Also check by object name - common byte array param names
          const objName = node.object?.name || '';
          const objLower = objName.toLowerCase();
          if (objLower === 'bytes' || objLower === 'data' || objLower === 'input' || objLower === 'output' ||
              objLower === 'block' || objLower === 'buffer' || objLower === 'key' || objLower === 'state' ||
              objLower === 'b' || objLower === 'arr' || objLower === 'array' || objLower === 'src' || objLower === 'dst')
            return false; // Known array parameter names
          return true;
        }
      }

      // Check IL node types for ElementAccess
      if (node.ilNodeType === 'ElementAccess' || node.type === 'ElementAccess') {
        if (node.index && node.index.type === 'Identifier' && node.index.name === varName) {
          // Same check: if the object is a slice/array, this is integer indexing
          const objNode = node.array || node.object;
          const objType = objNode ? this.inferFullExpressionType(objNode) : null;
          const objTypeStr = objType?.toString() || '';
          if (objType && (objType.isSlice || objType.isArray || objTypeStr.startsWith('[]')))
            return false;
          const objName = objNode?.name || '';
          const objLower = objName.toLowerCase();
          if (objLower === 'bytes' || objLower === 'data' || objLower === 'input' || objLower === 'output' ||
              objLower === 'block' || objLower === 'buffer' || objLower === 'key' || objLower === 'state' ||
              objLower === 'b' || objLower === 'arr' || objLower === 'array' || objLower === 'src' || objLower === 'dst')
            return false;
          return true;
        }
      }

      // Recurse through node properties
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(child => child && typeof child === 'object' && this.hasMapKeyUsage(child, varName))) {
            return true;
          }
        } else if (value && typeof value === 'object') {
          if (this.hasMapKeyUsage(value, varName)) {
            return true;
          }
        }
      }

      return false;
    }

    hasTypeofCheck(node, varName) {
      if (!node) return false;

      // Check for typeof varName comparison: typeof x === "string"
      // The pattern is BinaryExpression with UnaryExpression (typeof) as left operand
      if (node.type === 'BinaryExpression' &&
          (node.operator === '===' || node.operator === '==' || node.operator === '!==' || node.operator === '!=') &&
          node.left.type === 'UnaryExpression' &&
          node.left.operator === 'typeof' &&
          node.left.argument.type === 'Identifier' &&
          node.left.argument.name === varName) {
        return true;
      }

      // Also check IL node types for typeof
      if (node.ilNodeType === 'BinaryExpression' &&
          node.left?.ilNodeType === 'UnaryExpression' &&
          node.left?.operator === 'typeof' &&
          node.left?.argument?.name === varName) {
        return true;
      }

      // Recurse through node properties
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(child => child && typeof child === 'object' && this.hasTypeofCheck(child, varName))) {
            return true;
          }
        } else if (value && typeof value === 'object') {
          if (this.hasTypeofCheck(value, varName)) {
            return true;
          }
        }
      }

      return false;
    }

    hasArrayAccess(node, varName) {
      if (!node) return false;

      if (node.type === 'MemberExpression' &&
          node.object.type === 'Identifier' &&
          node.object.name === varName &&
          node.computed) {
        // Check if the property is a string literal - this indicates map access, not array access
        // e.g., config["base"] is map access, not array access
        // e.g., arr[i] or arr[0] IS array access
        const prop = node.property;
        if (prop.type === 'Literal' && typeof prop.value === 'string') {
          return false;  // String key access = map/object access, not array
        }
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
      let fieldName = this.toPascalCase(node.key.name);

      // Check if this field was renamed due to collision with method name
      if (this.currentStruct) {
        const renameKey = `${this.currentStruct.name}.${fieldName}`;
        if (this.renamedFields.has(renameKey)) {
          fieldName = this.renamedFields.get(renameKey);
        }
      }

      const field = new GoField(
        fieldName,
        this.getInferredType(node.value || {})
      );
      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Go package-level init() function
      // Go doesn't have static class blocks, so transform to statements
      // that will be placed in an init() function
      // Handle both array body and object with body property
      const statements = Array.isArray(node.body) ? node.body :
                         (node.body?.body && Array.isArray(node.body.body)) ? node.body.body : [];
      return statements.map(stmt => this.transformStatement(stmt));
    }

    transformClassExpression(node) {
      // ClassExpression -> Go struct literal with embedded methods
      // Go doesn't have classes, use struct with method receivers
      const structName = node.id?.name || 'AnonymousStruct';
      const structDecl = new GoStruct(structName);

      if (node.body?.body) {
        for (const member of node.body.body) {
          if (member.type === 'PropertyDefinition') {
            const field = new GoField(
              this.toPascalCase(member.key.name),
              this.inferType(member.value)
            );
            structDecl.fields.push(field);
          }
        }
      }

      return structDecl;
    }

    transformYieldExpression(node) {
      // Go doesn't have yield - return the argument value
      const argument = node.argument ? this.transformExpression(node.argument) : GoLiteral.Nil();
      return argument;
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

      // Transform parameters with type inference
      if (node.params) {
        for (let i = 0; i < node.params.length; ++i) {
          const param = node.params[i];
          const paramType = this.inferParameterType(param, node.body, node.id.name, i);
          func.parameters.push(new GoParameter(param.name, paramType));

          // Register parameter type for body transformation
          this.variableTypes.set(param.name, paramType);
        }
      }

      // Determine return type (with error if errorHandling enabled)
      func.results = this.inferFunctionReturnType(node);
      if (this.options.errorHandling && func.results.length > 0) {
        func.results.push(new GoParameter('', new GoType('error')));
      }

      // Register function return type for call site lookups
      if (func.results.length > 0) {
        const returnType = func.results[0].type;
        const funcName = node.id.name;
        const pascalName = this.toPascalCase(funcName);
        this.methodReturnTypes.set(funcName, returnType);
        this.methodReturnTypes.set(pascalName, returnType);
        // Set current function return type for empty array inference
        this.currentFunctionReturnType = returnType;
      }

      // Transform body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      // Clear parameter types after transformation
      if (node.params) {
        for (const param of node.params) {
          this.variableTypes.delete(param.name);
        }
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

      // Pre-scan function body to populate variable types before inferring return type
      // This is needed because inferFullExpressionType looks up variables in variableTypes
      this.prescanFunctionBody(funcNode.body);

      // Analyze return statements
      const returns = this.findReturnStatements(funcNode.body);
      if (returns.length === 0) {
        // No return statements found - check typeInfo as fallback
        // This handles stub methods (panic-only bodies) that originally had return values
        if (funcNode.typeInfo?.returns) {
          const ret = funcNode.typeInfo.returns;
          const typeName = typeof ret === 'string' ? ret : ret.name;
          if (typeName) {
            const type = this.mapType(typeName);
            return type ? [new GoParameter('', type)] : [new GoParameter('', new GoType('interface{}'))];
          }
        }
        return []; // void
      }

      // Use first return to infer type
      if (returns[0].argument) {
        const type = this.getInferredType(returns[0].argument);
        return [new GoParameter('', type)];
      }

      return [];
    }

    /**
     * Pre-scan function body to populate variable types before type inference.
     * This handles:
     * 1. Variable declarations with inferred types
     * 2. Empty array declarations - look ahead for push calls to determine element type
     */
    prescanFunctionBody(bodyNode, debug = false) {
      if (!bodyNode) return;

      const statements = bodyNode.body || (Array.isArray(bodyNode) ? bodyNode : [bodyNode]);
      if (debug) console.log('[prescan] statements count:', statements.length);

      for (let i = 0; i < statements.length; ++i) {
        const stmt = statements[i];
        if (!stmt) continue;

        if (stmt.type === 'VariableDeclaration') {
          for (const declarator of stmt.declarations) {
            if (declarator.id.type !== 'Identifier') continue;

            const name = declarator.id.name;
            const init = declarator.init;

            if (init?.type === 'ArrayExpression' && (!init.elements || init.elements.length === 0)) {
              // Empty array - look ahead for push calls to determine element type
              const elemType = this.findPushElementType(name, statements.slice(i + 1));
              if (debug) console.log(`[prescan] Empty array '${name}' -> elemType:`, elemType?.toString());
              const arrayType = elemType ? GoType.Slice(elemType) : GoType.Slice(GoType.UInt8());
              this.variableTypes.set(name, arrayType);
              this.prescanEmptyArrayVars.add(name);
              if (debug) console.log(`[prescan] Set type for '${name}':`, arrayType.toString());
            } else if (init) {
              // Non-empty initialization - infer type
              // Use inferFullExpressionType for binary expressions to apply coercion rules
              let type;
              if (init.type === 'BinaryExpression') {
                type = this.inferFullExpressionType(init);
              } else {
                type = this.getInferredType(init, name);
              }
              if (type) this.variableTypes.set(name, type);
            }
          }
        }

        // Recurse into blocks, if/for bodies, etc.
        if (stmt.body) this.prescanFunctionBody(stmt.body);
        if (stmt.consequent) this.prescanFunctionBody(stmt.consequent);
        if (stmt.alternate) this.prescanFunctionBody(stmt.alternate);
        if (stmt.block) this.prescanFunctionBody(stmt.block);
      }
    }

    /**
     * Look ahead in statements for push calls to an array variable to determine element type.
     * Handles both direct .push(x) and spread .push(...x)
     * IL uses ArrayAppend for .push() operations
     */
    findPushElementType(varName, statements) {
      for (const stmt of statements) {
        if (!stmt) continue;

        // Handle expression statements with ArrayAppend IL nodes (from .push() calls)
        if (stmt.type === 'ExpressionStatement') {
          const expr = stmt.expression;
          // IL uses 'ArrayAppend' for .push() operations
          if (expr?.type === 'ArrayAppend' || expr?.ilNodeType === 'ArrayAppend') {
            const arrayExpr = expr.array;
            if (arrayExpr?.type === 'Identifier' && arrayExpr.name === varName) {
              const valueNode = expr.value;
              if (valueNode?.type === 'SpreadElement') {
                // .push(...x) - get element type from spread array
                const argType = this.inferFullExpressionType(valueNode.argument);
                if (argType?.isSlice && argType.valueType) {
                  return argType.valueType;
                }
              } else {
                // .push(x) - get type of x
                // For small integer literals (0-255), prefer uint8 for crypto byte arrays
                if (valueNode?.type === 'Literal' && typeof valueNode.value === 'number' &&
                    Number.isInteger(valueNode.value) && valueNode.value >= 0 && valueNode.value <= 255) {
                  return GoType.UInt8();
                }
                return this.inferFullExpressionType(valueNode);
              }
            }
          }

          // Handle CallExpression form: array.push(value)
          if (expr?.type === 'CallExpression') {
            const callee = expr.callee;
            if (callee?.type === 'MemberExpression' &&
                callee.property?.name === 'push' &&
                callee.object?.type === 'Identifier' &&
                callee.object.name === varName) {
              const args = expr.arguments;
              if (args && args.length > 0) {
                const firstArg = args[0];
                if (firstArg.type === 'SpreadElement') {
                  const argType = this.inferFullExpressionType(firstArg.argument);
                  if (argType?.isSlice && argType.valueType) {
                    return argType.valueType;
                  }
                } else {
                  return this.inferFullExpressionType(firstArg);
                }
              }
            }
          }
        }

        // Recurse into for loops
        if (stmt.type === 'ForStatement' && stmt.body) {
          const forStmts = stmt.body.body || (Array.isArray(stmt.body) ? stmt.body : [stmt.body]);
          const found = this.findPushElementType(varName, forStmts);
          if (found) return found;
        }

        // Recurse into if statements
        if (stmt.type === 'IfStatement') {
          if (stmt.consequent) {
            const conseqStmts = stmt.consequent.body || [stmt.consequent];
            const found = this.findPushElementType(varName, conseqStmts);
            if (found) return found;
          }
          if (stmt.alternate) {
            const altStmts = stmt.alternate.body || [stmt.alternate];
            const found = this.findPushElementType(varName, altStmts);
            if (found) return found;
          }
        }
      }
      return null;
    }

    /**
     * Collect method call sites to infer parameter types from actual arguments
     * E.g., this._encryptWords(words, keyWords) where words is []uint32
     */
    collectMethodCallSites(node) {
      if (!node) return;

      // Look for IL ThisMethodCall nodes (generated by type-aware-transpiler)
      if (node.type === 'ThisMethodCall' || node.ilNodeType === 'ThisMethodCall') {
        const methodName = node.method;
        const args = node.arguments || [];
        if (methodName && args.length > 0) {
          for (let i = 0; i < args.length; ++i) {
            const arg = args[i];
            const argType = this.inferFullExpressionType(arg);
            if (argType && argType.name !== 'interface{}' && argType.name !== 'any') {
              const key = `${methodName}:${i}`;
              const existingType = this.methodParamTypes.get(key);
              // Set if we don't have a type, or the new type is more specific/wider
              if (!existingType || this.shouldReplaceType(existingType, argType)) {
                this.methodParamTypes.set(key, argType);
              }
            }
          }
        }
      }

      // Also look for original this.methodName(args) CallExpression pattern (pre-IL)
      if (node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee.object?.type === 'ThisExpression') {
        const methodName = node.callee.property?.name || node.callee.property;
        if (methodName && node.arguments?.length > 0) {
          for (let i = 0; i < node.arguments.length; ++i) {
            const arg = node.arguments[i];
            const argType = this.inferFullExpressionType(arg);
            if (argType && argType.name !== 'interface{}' && argType.name !== 'any') {
              const key = `${methodName}:${i}`;
              const existingType = this.methodParamTypes.get(key);
              // Set if we don't have a type, or the new type is more specific/wider
              if (!existingType || this.shouldReplaceType(existingType, argType)) {
                this.methodParamTypes.set(key, argType);
              }
            }
          }
        }
      }

      // Recurse into all child nodes
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child === 'object') {
              this.collectMethodCallSites(child);
            }
          }
        } else if (value && typeof value === 'object') {
          this.collectMethodCallSites(value);
        }
      }
    }

    /**
     * Find an AssignmentExpression nested within an expression tree.
     * Checks the node itself, and left/right children of BinaryExpression/LogicalExpression.
     * Returns the first AssignmentExpression found, or null.
     */
    // Select the appropriate type-specific increment/decrement helper based on operand type
    _getIncrDecrHelper(argNode, isPrefix, isIncrement) {
      const operandType = this.inferFullExpressionType(argNode);
      const typeStr = operandType?.toString() || 'int';
      const suffixMap = {
        'uint32': 'Uint32', 'uint16': 'Uint16', 'int32': 'Int32',
      };
      const suffix = suffixMap[typeStr] || 'Int';
      if (isPrefix)
        return isIncrement ? `preIncr${suffix}` : `preDecr${suffix}`;
      return isIncrement ? `postIncr${suffix}` : `postDecr${suffix}`;
    }

    _findNestedAssignment(node) {
      if (!node) return null;
      const nodeType = node.type || node.ilNodeType;
      if (nodeType === 'AssignmentExpression' && (!node.operator || node.operator === '='))
        return node;
      // Check inside BinaryExpression/LogicalExpression
      if (nodeType === 'BinaryExpression' || nodeType === 'LogicalExpression') {
        return this._findNestedAssignment(node.left) || this._findNestedAssignment(node.right);
      }
      return null;
    }

    findReturnStatements(node, acc = []) {
      if (!node) return acc;

      if (node.type === 'ReturnStatement') {
        acc.push(node);
        return acc;
      }

      // Recurse into body
      if (node.body) {
        if (Array.isArray(node.body)) {
          for (const child of node.body) {
            this.findReturnStatements(child, acc);
          }
        } else {
          this.findReturnStatements(node.body, acc);
        }
      }

      // Recurse into if/else branches
      if (node.consequent) {
        if (Array.isArray(node.consequent)) {
          for (const child of node.consequent) {
            this.findReturnStatements(child, acc);
          }
        } else {
          this.findReturnStatements(node.consequent, acc);
        }
      }
      if (node.alternate) this.findReturnStatements(node.alternate, acc);

      // Recurse into switch cases
      if (node.cases) {
        for (const c of node.cases) {
          if (c.consequent) {
            for (const child of c.consequent) {
              this.findReturnStatements(child, acc);
            }
          }
        }
      }

      // Recurse into try/catch/finally
      if (node.block) this.findReturnStatements(node.block, acc);
      if (node.handler) this.findReturnStatements(node.handler, acc);
      if (node.finalizer) this.findReturnStatements(node.finalizer, acc);

      return acc;
    }

    transformVariableDeclaration(node) {
      const vars = [];

      // Track IL-expanded destructure temp sources for rewriting references
      const destructureTempSources = new Map();

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

        // Handle IL-expanded destructuring from the type-aware transpiler.
        // The IL expands `const { a, b } = obj` into:
        //   _destructure_N = obj          (ilNodeType: 'DestructureTemp')
        //   a = _destructure_N.a          (ilNodeType: 'DestructuredProperty')
        //   b = _destructure_N.b          (ilNodeType: 'DestructuredProperty')
        // And `const [a, b] = arr` into:
        //   _destructure_N = arr          (ilNodeType: 'DestructureTemp')
        //   a = _destructure_N[0]         (ilNodeType: 'DestructuredElement')
        //   b = _destructure_N[1]         (ilNodeType: 'DestructuredElement')
        if (declarator.ilNodeType === 'DestructureTemp') {
          const tempName = declarator.id.name;
          // Record the source expression so subsequent property/element declarators
          // can directly reference the original source instead of the temp
          destructureTempSources.set(tempName, declarator.init);

          // Emit the temp variable so it is available for indexing by subsequent
          // DestructuredElement/DestructuredProperty declarators
          let type = this.inferFullExpressionType(declarator.init) || null;
          let init = this.transformExpression(declarator.init, type);

          // When destructure temp will be indexed (DestructuredElement) or property-accessed
          // (DestructuredProperty), ensure the Go type is concrete enough for those operations.
          // The IL type system may know the exact type, but the Go expression might return
          // interface{} from generic helpers (e.g., mapSlice). Add a type assertion when needed.
          const typeStr = type?.toString() || '';
          const hasElementAccess = node.declarations.some(d =>
            d.ilNodeType === 'DestructuredElement' &&
            d.init?.object?.name === tempName
          );
          const hasPropertyAccess = node.declarations.some(d =>
            d.ilNodeType === 'DestructuredProperty' &&
            d.init?.object?.name === tempName
          );
          if (hasElementAccess || hasPropertyAccess) {
            // Determine the appropriate target type for assertion
            if (!type || typeStr === 'interface{}' || typeStr === 'any') {
              // No concrete type known - use generic indexable types
              if (hasElementAccess) {
                type = GoType.Slice(GoType.Interface());
              } else {
                type = GoType.Map(GoType.String(), GoType.Interface());
              }
            }
            // Add type assertion to ensure Go compiler can verify indexability
            // Use safeTypeAssertion to skip when init is already concrete (e.g., composite literal)
            init = this.safeTypeAssertion(init, type);
          }

          if (type) this.variableTypes.set(tempName, type);
          const goVar = new GoVar(tempName, type, init);
          goVar.isShortDecl = !!init;
          vars.push(goVar);
          continue;
        }

        // Handle IL-expanded destructured properties/elements.
        // The temp variable was already emitted above, so these can reference it directly.
        // Just fall through to normal variable declaration handling - the init expression
        // (e.g., _destructure_N.prop or _destructure_N[0]) will be transformed normally.
        // No rewriting is needed here since the temp exists in scope.

        // Skip arrow function assignments wrapping void operations (e.g., clearOutput = () => ClearArray(...))
        // These are dead code in Go since unused variables are compile errors
        if (declarator.init && (declarator.init.type === 'ArrowFunction' || declarator.init.type === 'ArrowFunctionExpression')) {
          const arrowBody = declarator.init.body;
          if (arrowBody && (arrowBody.type === 'ArrayClear' || arrowBody.ilNodeType === 'ArrayClear')) {
            continue;
          }
        }
        const origName = declarator.id.name;
        const name = this.sanitizeVarName(origName);
        let type = null;
        let init = null;

        // Check if prescan already determined the type (e.g., from push call analysis)
        // Try sanitized name first, then original name (prescan uses original names)
        const prescanType = name ? (this.variableTypes.get(name) || this.variableTypes.get(origName)) : null;
        // Migrate prescan type to sanitized name if needed
        if (prescanType && name !== origName) {
          this.variableTypes.set(name, prescanType);
          this.variableTypes.delete(origName);
        }

        if (declarator.init) {
          // Check if this is an IIFE (immediately invoked function expression)
          if (declarator.init.type === 'CallExpression' &&
              (declarator.init.callee.type === 'FunctionExpression' ||
               declarator.init.callee.type === 'ArrowFunctionExpression')) {
            // Extract return value from IIFE
            const returnValue = this.getIIFEReturnValue(declarator.init);
            if (returnValue) {
              type = prescanType || this.getInferredType(returnValue);
              init = this.transformExpression(returnValue, type);
            }
          } else {
            // Get type FIRST so it can be passed to transformExpression
            // This is important for empty arrays where the type is determined by later push calls
            type = prescanType || this.getInferredType(declarator.init, name);
            init = this.transformExpression(declarator.init, type);

            // For integer literals where we want a specific type, wrap with type conversion
            // This ensures `sum := uint32(0)` instead of `sum := 0` (which would be int)
            if (declarator.init.type === 'Literal' &&
                typeof declarator.init.value === 'number' &&
                Number.isInteger(declarator.init.value) &&
                type && type.name !== 'int') {
              // Detect int32 overflow: value > INT32_MAX should use uint32
              if (type.name === 'int32' && declarator.init.value > 2147483647)
                type = GoType.UInt32();
              init = new GoTypeConversion(type, init);
            }
            // For non-literal integer expressions where Go's := would infer `int`,
            // but the IL type is uint32, wrap with explicit uint32() to prevent
            // type mismatches (e.g., n := 1 << m & 0xFFFFFFFF should be uint32, not int)
            if (type && type.name === 'uint32' &&
                init.nodeType !== 'TypeConversion' &&
                init.nodeType !== 'Literal' &&
                init.nodeType !== 'CallExpression' &&
                init.nodeType !== 'CompositeLiteral' &&
                init.nodeType !== 'TypeAssertion' &&
                declarator.init.type !== 'Literal') {
              init = new GoTypeConversion(type, init);
            }
          }
        }

        // Store variable type for later type inference
        // If init includes a type assertion, use the asserted type as the variable type
        // (e.g., aad := firstNonNil(...).([]uint8) means aad is []uint8, not interface{})
        if (name && init && init.nodeType === 'TypeAssertion' && init.type) {
          type = init.type;
        }
        if (name) {
          if (type) {
            this.variableTypes.set(name, type);
          } else if (!init) {
            // Check if hoisted ternary pre-pass inferred a type
            const hoistedType = declarator._hoistedType;
            if (hoistedType) {
              this.variableTypes.set(name, hoistedType);
              type = hoistedType;
            } else {
              // Uninitialized variable with no type - defaults to interface{}
              this.variableTypes.set(name, GoType.Interface());
              type = GoType.Interface(); // Also set for the GoVar node
            }
          }
        }

        // Detect nil initialization: `result := nil` is invalid Go, use `var result interface{}` instead
        const isNilInit = init && (
          (init.nodeType === 'Literal' && init.value === null) ||
          (init.nodeType === 'Literal' && init.literalType === 'nil')
        );
        if (isNilInit) {
          type = type || GoType.Interface();
          init = null; // Will produce: var result interface{}
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
          // Special handling for ArrayAppend - append result must be assigned
          if (node.expression.type === 'ArrayAppend') {
            const arr = this.transformExpression(node.expression.array);
            let valNode = node.expression.value;
            let needsSpread = node.expression.spread;

            // Unwrap SpreadElement if present
            if (valNode.type === 'SpreadElement') {
              valNode = valNode.argument;
              needsSpread = true;
            }

            // Get array element type for type coercion and struct literal detection
            const arrType = this.inferFullExpressionType(node.expression.array);
            const appendElemType = arrType?.isSlice ? (arrType.valueType || arrType.elementType) : null;

            let val = this.transformExpression(valNode, appendElemType);
            const arrTypeStr = arrType?.toString() || '';
            let elemType = null;
            if (arrType?.isSlice && arrType.elementType) {
              elemType = arrType.elementType;
            } else if (arrTypeStr.startsWith('[]')) {
              const elemTypeStr = arrTypeStr.slice(2);
              elemType = new GoType(elemTypeStr);
            }

            // Check if value needs type assertion (e.g., data is 'any')
            const valType = this.inferFullExpressionType(valNode);
            const valTypeStr = valType?.toString() || '';
            if (needsSpread) {
              // Explicit spread from SpreadElement - always spread
              if (valTypeStr === 'any' || valTypeStr === 'interface{}') {
                const typeAssert = this.safeTypeAssertion(val, GoType.Slice(GoType.UInt8()));
                val = new GoSpread(typeAssert);
              } else {
                val = new GoSpread(val);
              }
            } else if (valTypeStr === 'any' || valTypeStr === 'interface{}') {
              // Value is interface{} but NOT a spread - type assert to element type, don't spread
              if (elemType) {
                val = this.safeTypeAssertion(val, elemType);
              }
            } else if (elemType && valType) {
              // Add type conversion if element type doesn't match value type
              const elemTypeStr = elemType.toString();
              if (elemTypeStr !== valTypeStr && this.isNumericType(elemTypeStr) && this.isNumericType(valTypeStr)) {
                val = new GoTypeConversion(elemType, val);
              }
            }

            const appendCall = new GoCallExpression(new GoIdentifier('append'), [arr, val]);
            return new GoExpressionStatement(new GoAssignment([arr], '=', [appendCall]));
          }
          // Handle chained assignments wrapped in ExpressionStatement
          if (node.expression.type === 'AssignmentExpression') {
            const assignResult = this.transformAssignmentExpression(node.expression);
            if (assignResult.nodeType === 'Block') return assignResult;
            return this._wrapWithHoisted(new GoExpressionStatement(assignResult));
          }
          {
            const expr = this.transformExpression(node.expression);
            return this._wrapWithHoisted(new GoExpressionStatement(expr));
          }
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node);
        case 'EmptyStatement':
          return null;
        case 'AssignmentExpression': {
          // AssignmentExpression used as statement (not wrapped in ExpressionStatement)
          const assignResult = this.transformAssignmentExpression(node);
          // Chained assignments return GoBlock directly
          if (assignResult.nodeType === 'Block') return assignResult;
          return this._wrapWithHoisted(new GoExpressionStatement(assignResult));
        }
        case 'LabeledStatement':
          // label: statement -> Go supports labels
          return this.transformLabeledStatement(node);
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

    transformLabeledStatement(node) {
      // Go supports labels - for now just transform the body (labels rarely needed)
      return this.transformStatement(node.body);
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
        let catchParamName = node.handler.param?.name || 'err';
        // In Go, 'error' is a built-in type name; rename to avoid conflict
        if (catchParamName === 'error') catchParamName = 'err';
        commented.statements.push(new GoExpressionStatement(
          new GoIdentifier(`// Catch block: ${catchParamName}`)
        ));
        const catchBlock = this.transformBlockStatement(node.handler.body);
        commented.statements.push(...catchBlock.statements);
      }

      return commented;
    }

    transformThrowStatement(node) {
      // Go uses panic instead of throw
      // Note: don't add 'fmt' import here - panic doesn't require it
      const arg = node.argument ? this.transformExpression(node.argument) : GoLiteral.String('error');
      return new GoExpressionStatement(
        new GoCallExpression(new GoIdentifier('panic'), [arg])
      );
    }

    transformBlockStatement(node) {
      const block = new GoBlock();

      if (node.body) {
        // Pre-pass: annotate hoisted ternary variables with inferred types
        // Pattern: VarDecl(x, init=null) followed by IfStmt { x = a } else { x = b }
        for (let i = 0; i < node.body.length - 1; ++i) {
          const stmt = node.body[i];
          if (stmt.type !== 'VariableDeclaration') continue;
          const decls = stmt.declarations || [];
          if (decls.length !== 1 || decls[0].init !== null) continue;
          const varName = decls[0].id?.name;
          if (!varName) continue;
          const next = node.body[i + 1];
          if (next.type !== 'IfStatement' || !next.consequent) continue;
          // Check if consequent assigns to varName
          const consBody = next.consequent.body || (next.consequent.type === 'BlockStatement' ? next.consequent.body : [next.consequent]);
          if (!consBody?.length) continue;
          const firstAssign = consBody[0];
          if (firstAssign.type !== 'ExpressionStatement') continue;
          const expr = firstAssign.expression;
          if (!expr || expr.type !== 'AssignmentExpression') continue;
          if (expr.left?.name !== varName) continue;
          // Infer type from the right-hand side
          const rhsType = this.inferFullExpressionType(expr.right);
          if (rhsType && rhsType.toString() !== 'interface{}' && rhsType.toString() !== 'any') {
            // Store the inferred type for transformVariableDeclaration to pick up
            decls[0]._hoistedType = rhsType;
          }
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
      }

      return block;
    }

    transformReturnStatement(node) {
      if (!node.argument) {
        return new GoReturn([]);
      }

      // Handle return with assignment: `return x = expr` -> `x = expr; return x`
      const argType = node.argument.type || node.argument.ilNodeType;
      if (argType === 'AssignmentExpression' && (!node.argument.operator || node.argument.operator === '=')) {
        const assignExpr = this.transformExpression(node.argument);
        const target = this.transformExpression(node.argument.left);
        return new GoBlock([assignExpr, new GoReturn([target])]);
      }

      let returnValue = this.transformExpression(node.argument, this.currentFunctionReturnType);

      // Check if we need type assertion for return value
      // If function return type is specific but return value is interface{}, add type assertion
      // BUT not for nil literals - those can be returned directly
      if (this.currentFunctionReturnType) {
        const isNilLiteral = node.argument.type === 'Literal' && node.argument.value === null;

        // Replace nil with zero value when returning non-nilable type
        if (isNilLiteral) {
          const retStr = this.currentFunctionReturnType.toString();
          if (this.isNumericType(retStr))
            returnValue = GoLiteral.Int(0);
          else if (retStr === 'string')
            returnValue = GoLiteral.String('');
          else if (retStr === 'bool')
            returnValue = new GoLiteral(false, 'false');
        }

        // Handle negative literal overflow for unsigned return types
        // Catches both UnaryExpression(-,1) and Literal(-1) forms
        if (!isNilLiteral) {
          let negativeValue = null;
          if (node.argument.type === 'UnaryExpression' && node.argument.operator === '-' &&
              node.argument.argument?.type === 'Literal' && typeof node.argument.argument.value === 'number')
            negativeValue = node.argument.argument.value;
          else if ((node.argument.type === 'Literal' || node.argument.ilNodeType === 'Literal') &&
                   typeof node.argument.value === 'number' && node.argument.value < 0)
            negativeValue = -node.argument.value;
          if (negativeValue !== null && negativeValue > 0) {
            const retStr = this.currentFunctionReturnType.toString();
            if (retStr === 'uint32' || retStr === 'uint16' || retStr === 'uint8' || retStr === 'uint64') {
              returnValue = negativeValue === 1
                ? new GoRawCode(`^${retStr}(0)`)
                : new GoRawCode(`^${retStr}(${negativeValue - 1})`);
            }
          }
        }

        if (!isNilLiteral) {
          const argType = this.inferFullExpressionType(node.argument);
          const argTypeStr = argType?.toString() || '';
          const returnTypeStr = this.currentFunctionReturnType?.toString() || '';

          if ((argTypeStr === 'interface{}' || argTypeStr === 'any') &&
              returnTypeStr && returnTypeStr !== 'interface{}' && returnTypeStr !== 'any') {
            returnValue = this.safeTypeAssertion(returnValue, this.currentFunctionReturnType);
          }
          // Convert []uint32 -> []uint8 when return type is []uint8
          // This is common in crypto code where internal state uses uint32 but Feed/Result use bytes
          if (argTypeStr === '[]uint32' && returnTypeStr === '[]uint8') {
            returnValue = new GoCallExpression(new GoIdentifier('uint32SliceToBytes'), [returnValue]);
            this._needsUint32SliceToBytes = true;
          }
        }
      }

      return new GoReturn([returnValue]);
    }

    transformIfStatement(node) {
      // Skip framework loading patterns:
      // if (!global.AlgorithmFramework && typeof require !== 'undefined') { global.AlgorithmFramework = require(...); }
      // if (!global.OpCodes && typeof require !== 'undefined') { global.OpCodes = require(...); }
      {
        const _test = node.test;
        // Check for !global.X or global.X patterns in the condition
        const _hasFrameworkRef = (n) => {
          if (!n) return false;
          // Direct: global.AlgorithmFramework or global.OpCodes
          if (n.type === 'MemberExpression' && n.object?.name === 'global' &&
              (n.property?.name === 'AlgorithmFramework' || n.property?.name === 'OpCodes'))
            return true;
          // Negated: !global.X
          if (n.type === 'UnaryExpression' && n.operator === '!' && _hasFrameworkRef(n.argument))
            return true;
          // Logical: !global.X && ...
          if (n.type === 'LogicalExpression' && (_hasFrameworkRef(n.left) || _hasFrameworkRef(n.right)))
            return true;
          return false;
        };
        if (_hasFrameworkRef(_test)) {
          return new GoBlock(); // Empty block - strip the loading pattern
        }
      }

      // Check for nested assignment in condition: `if (a && (x = expr) <= y)` -> hoist assignment
      const nestedAssign = this._findNestedAssignment(node.test);
      if (nestedAssign) {
        // Hoist the assignment before the if, replace assignment in condition with the variable
        const assignTarget = nestedAssign.left;
        const assignValue = nestedAssign.right;
        const hoistedAssign = new GoAssignment(
          this.transformExpression(assignTarget),
          this.transformExpression(assignValue),
          '='
        );
        // Replace the assignment node in-place with just the left side (variable reference)
        // so the condition uses the already-assigned value
        const savedType = nestedAssign.type;
        const savedRight = nestedAssign.right;
        const savedOperator = nestedAssign.operator;
        nestedAssign.type = assignTarget.type;
        nestedAssign.name = assignTarget.name;
        nestedAssign.ilNodeType = assignTarget.ilNodeType;
        Object.assign(nestedAssign, assignTarget);

        const condition = this.transformExpression(node.test);
        const consequent = this.transformStatement(node.consequent);
        const alternate = node.alternate ? this.transformStatement(node.alternate) : null;

        const ifStmt = new GoIfStatement(condition, consequent, alternate);
        return new GoBlock([hoistedAssign, ifStmt]);
      }

      let condition = this.transformExpression(node.test);
      condition = this._ensureBooleanCondition(node.test, condition);

      const thenBranch = this.transformStatement(node.consequent) || new GoBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      return new GoIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forLoop = new GoFor();

      if (node.init) {
        // Register loop variable type based on the init expression type
        if (node.init.type === 'VariableDeclaration') {
          for (const decl of node.init.declarations) {
            if (decl.id?.name && decl.init) {
              // Infer type from the init expression
              let varType = GoType.Int(); // default for loop counters (matches len())

              // For simple numeric literals (0, 1, etc.), use Go's native int
              // This is important for loop counters that compare with len() results
              if ((decl.init.type === 'Literal' || decl.init.ilNodeType === 'Literal') &&
                  typeof decl.init.value === 'number') {
                varType = GoType.Int(); // Use native int for loop counters
              }
              // For complex init expressions, infer type from the expression
              else if (decl.init.resultType) {
                // Check if this is a binary expression with uint32 type
                // (e.g., this.CYCLES - 1) - use that type
                varType = this.mapType(decl.init.resultType);
                // For loop counters, prefer 'int' over 'int32' to match len() return type
                // and avoid type mismatches in loop conditions
                if (varType && (varType.name === 'int32' || varType.name === 'isize'))
                  varType = GoType.Int();
              } else if (decl.init.goType) {
                varType = decl.init.goType;
              } else {
                // Analyze the init expression to determine type
                const initExpr = this.transformExpression(decl.init);
                if (initExpr?.goType) {
                  varType = initExpr.goType;
                }
              }

              this.variableTypes.set(decl.id.name, varType);
            } else if (decl.id?.name) {
              // No init expression, default to int
              this.variableTypes.set(decl.id.name, new GoType('int'));
            }
          }
        }

        const init = this.transformStatement(node.init);
        // If init is an array of variable declarations, take the first one
        forLoop.init = Array.isArray(init) ? init[0] : init;

        // Go only allows short declarations (:=) in for-loop init, never 'var' declarations
        if (forLoop.init?.nodeType === 'Var' && !forLoop.init.isShortDecl) {
          forLoop.init.isShortDecl = true;
          // Ensure there's an initializer for := (can't do `x :=` with no value)
          if (!forLoop.init.initializer && forLoop.init.type) {
            // Provide zero value: int -> 0, uint64 -> uint64(0), etc.
            const typeName = forLoop.init.type.toString();
            if (typeName === 'uint64' || typeName === 'int64') {
              forLoop.init.initializer = new GoTypeConversion(forLoop.init.type, GoLiteral.Int(0));
            } else {
              forLoop.init.initializer = GoLiteral.Int(0);
            }
          }
        }
      }

      if (node.test) {
        // Check if the test contains an assignment expression anywhere
        // (e.g., `for(; v = v >> 8; )` or `for(; (v = v >> 8) != 0; )`)
        // In JS, assignments are expressions; Go can't use assignments as values
        const nestedAssign = this._findNestedAssignment(node.test);
        if (nestedAssign) {
          // We'll set a flag and handle it after body is built
          // Extract: assignment node, and the comparison operator/right if wrapped
          this._forLoopAssignmentTest = {
            assignNode: nestedAssign,
            fullTest: node.test,
          };
        } else {
          forLoop.condition = this.transformExpression(node.test);
          // Go requires boolean conditions in for loops - same conversion as if statements
          forLoop.condition = this._ensureBooleanCondition(node.test, forLoop.condition);
        }
      }

      if (node.update) {
        // For loop post is in statement context - UpdateExpression/UnaryExpression should use simple assignment
        let postExpr;
        const updateType = node.update.type || node.update.ilNodeType;
        const isUpdateExpr = updateType === 'UpdateExpression';
        const isPrefixIncDec = updateType === 'UnaryExpression' &&
          (node.update.operator === '++' || node.update.operator === '--');

        if (isUpdateExpr || isPrefixIncDec) {
          // Both postfix (UpdateExpression) and prefix (UnaryExpression) increment/decrement
          // should use simple assignment in for loop post context
          const operand = this.transformExpression(node.update.argument);
          const one = GoLiteral.Int(1);
          postExpr = node.update.operator === '++'
            ? new GoAssignment([operand], '+=', [one])
            : new GoAssignment([operand], '-=', [one]);
        } else {
          postExpr = this.transformExpression(node.update);
        }
        // Don't wrap in ExpressionStatement - for loop post needs raw expression, not statement
        forLoop.post = postExpr;
      }

      forLoop.body = this.transformStatement(node.body) || new GoBlock();

      // Handle assignment-as-condition: for { assign; if condition { break }; body }
      if (this._forLoopAssignmentTest) {
        const { assignNode, fullTest } = this._forLoopAssignmentTest;
        this._forLoopAssignmentTest = null;
        const assignExpr = this.transformExpression(assignNode);
        const target = this.transformExpression(assignNode.left);

        // Build the break condition
        // If fullTest == assignNode (bare assignment), break when assigned value == 0
        // If fullTest wraps it (e.g., (v = expr) != 0), invert the comparison for break
        let breakCondition;
        const fullTestType = fullTest.type || fullTest.ilNodeType;
        if (fullTest === assignNode) {
          // Bare assignment as condition: break when target == 0
          breakCondition = new GoBinaryExpression(target, '==', GoLiteral.Int(0));
        } else if (fullTestType === 'BinaryExpression' &&
                   (fullTest.operator === '!=' || fullTest.operator === '!==')) {
          // (v = expr) != X -> break when v == X
          const rightVal = this.transformExpression(fullTest.right);
          breakCondition = new GoBinaryExpression(target, '==', rightVal);
        } else if (fullTestType === 'BinaryExpression' &&
                   (fullTest.operator === '==' || fullTest.operator === '===')) {
          // (v = expr) == X -> break when v != X
          const rightVal = this.transformExpression(fullTest.right);
          breakCondition = new GoBinaryExpression(target, '!=', rightVal);
        } else {
          // Unknown wrapper - just break when target is falsy (== 0)
          breakCondition = new GoBinaryExpression(target, '==', GoLiteral.Int(0));
        }

        const breakCheck = new GoIf(
          breakCondition,
          new GoBlock([new GoRawCode('break')]),
          null
        );
        // Prepend assignment + break-check to the body
        const bodyBlock = forLoop.body.nodeType === 'Block' ? forLoop.body : new GoBlock([forLoop.body]);
        bodyBlock.statements.unshift(new GoExpressionStatement(assignExpr), breakCheck);
        forLoop.body = bodyBlock;
        // No condition = infinite loop (Go `for { ... }`)
      }

      return forLoop;
    }

    transformWhileStatement(node) {
      const forLoop = new GoFor();

      // Check for assignment-in-condition (same as for-loop)
      const nestedAssign = node.test ? this._findNestedAssignment(node.test) : null;
      if (nestedAssign) {
        // Convert to: for { assign; if breakCond { break }; body }
        forLoop.body = this.transformStatement(node.body) || new GoBlock();
        const assignExpr = this.transformExpression(nestedAssign);
        const target = this.transformExpression(nestedAssign.left);
        const fullTest = node.test;
        const fullTestType = fullTest.type || fullTest.ilNodeType;

        let breakCondition;
        if (fullTest === nestedAssign) {
          breakCondition = new GoBinaryExpression(target, '==', GoLiteral.Int(0));
        } else if (fullTestType === 'BinaryExpression' && (fullTest.operator === '!=' || fullTest.operator === '!==')) {
          breakCondition = new GoBinaryExpression(target, '==', this.transformExpression(fullTest.right));
        } else if (fullTestType === 'BinaryExpression' && (fullTest.operator === '==' || fullTest.operator === '===')) {
          breakCondition = new GoBinaryExpression(target, '!=', this.transformExpression(fullTest.right));
        } else {
          breakCondition = new GoBinaryExpression(target, '==', GoLiteral.Int(0));
        }

        const breakCheck = new GoIf(breakCondition, new GoBlock([new GoRawCode('break')]), null);
        const bodyBlock = forLoop.body.nodeType === 'Block' ? forLoop.body : new GoBlock([forLoop.body]);
        bodyBlock.statements.unshift(new GoExpressionStatement(assignExpr), breakCheck);
        forLoop.body = bodyBlock;
      } else {
        forLoop.condition = this.transformExpression(node.test);
        forLoop.condition = this._ensureBooleanCondition(node.test, forLoop.condition);
        forLoop.body = this.transformStatement(node.body) || new GoBlock();
      }

      return forLoop;
    }

    /**
     * Transform for-of statement: for (const x of array) { ... }
     * Go equivalent: for _, x := range array { ... }
     *
     * Also handles IL-expanded destructuring:
     *   for (const [a, b] of entries) -> for _, _destructure_N := range entries { a := _destructure_N[0]; b := _destructure_N[1]; ... }
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      let destructureNames = null; // Array of entries for destructuring extraction

      if (node.left.type === 'VariableDeclaration') {
        const declarations = node.left.declarations || [];
        const firstDecl = declarations[0];

        // Check if the IL has already expanded destructuring (DestructureTemp marker)
        if (firstDecl && firstDecl.ilNodeType === 'DestructureTemp') {
          // The temp variable becomes the range value
          varName = firstDecl.id?.name || '_item';
          // Collect the destructured element/property names for extraction in the loop body
          destructureNames = [];
          for (let i = 1; i < declarations.length; ++i) {
            const decl = declarations[i];
            if (decl.ilNodeType === 'DestructuredElement' && decl.id?.name)
              destructureNames.push({ name: decl.id.name, index: i - 1, isElement: true });
            else if (decl.ilNodeType === 'DestructuredProperty' && decl.id?.name) {
              const propName = decl.init?.property?.name || decl.init?.property?.value || decl.id.name;
              destructureNames.push({ name: decl.id.name, propName, isElement: false });
            }
          }
        } else if (firstDecl && firstDecl.id) {
          // Check for non-expanded ArrayPattern/ObjectPattern
          if (firstDecl.id.type === 'ArrayPattern' && firstDecl.id.elements) {
            varName = '_loopItem';
            destructureNames = [];
            firstDecl.id.elements.forEach((el, idx) => {
              if (el && el.name)
                destructureNames.push({ name: el.name, index: idx, isElement: true });
            });
          } else if (firstDecl.id.type === 'ObjectPattern' && firstDecl.id.properties) {
            varName = '_loopItem';
            destructureNames = [];
            for (const prop of firstDecl.id.properties) {
              const name = prop.value?.name || prop.key?.name;
              const propName = prop.key?.name || prop.key?.value;
              if (name)
                destructureNames.push({ name, propName, isElement: false });
            }
          } else {
            varName = firstDecl.id.name || 'item';
          }
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the iterable and body
      const iterable = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new GoBlock();

      // If we have destructuring, prepend extraction statements to the loop body
      if (destructureNames && destructureNames.length > 0) {
        const bodyBlock = body.nodeType === 'Block' ? body : new GoBlock([body]);
        const extractStatements = [];
        for (const entry of destructureNames) {
          let initExpr;
          if (entry.isElement) {
            // Array destructuring: name := loopVar[index]
            initExpr = new GoIndexExpression(
              new GoIdentifier(varName),
              GoLiteral.Int(entry.index)
            );
          } else {
            // Object destructuring: name := loopVar["propName"]
            initExpr = new GoIndexExpression(
              new GoIdentifier(varName),
              GoLiteral.String(entry.propName)
            );
          }
          const goVar = new GoVar(entry.name, null, initExpr);
          goVar.isShortDecl = true;
          extractStatements.push(goVar);
        }
        bodyBlock.statements.unshift(...extractStatements);
      }

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

    /**
     * Transform expression with optional target type hint
     * @param {Object} node - The AST node to transform
     * @param {GoType} [targetType] - Optional target type for type-aware transformation
     */
    transformExpression(node, targetType = null) {
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
          return this.transformArrayExpression(node, targetType);
        case 'ObjectExpression':
          return this.transformObjectExpression(node, targetType);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node, targetType);
        case 'NewExpression':
          return this.transformNewExpression(node, targetType);
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

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Go doesn't have this, transform inner
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression - Go uses struct literals
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Go uses channels for similar patterns
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Go lowercase (unexported) field
          return new GoIdentifier(this.toSnakeCase(node.name));

        // ============== IL AST Node Types ==============

        case 'ParentConstructorCall':
          // Go doesn't have inheritance - embedded struct initialization
          return new GoIdentifier('/* parent constructor */');

        case 'ThisPropertyAccess': {
          // When inside a map-self-ref IIFE, use map key access: s["prop"]
          if (this.inMapSelfRefContext) {
            return new GoIndexExpression(
              new GoIdentifier(this.receiverName),
              GoLiteral.String(node.property)
            );
          }
          // this.prop -> receiver.Prop
          let propName = this.toPascalCase(node.property);

          // Check if this property was renamed due to field/method collision
          if (this.currentStruct) {
            const renameKey = `${this.currentStruct.name}.${propName}`;
            if (this.renamedFields.has(renameKey)) {
              propName = this.renamedFields.get(renameKey);
            }
          }

          return new GoSelectorExpression(
            new GoIdentifier(this.receiverName),
            propName
          );
        }

        case 'ThisMethodCall': {
          // When inside a map-self-ref IIFE, use map key access + type assertion:
          //   s["method"].(func(...) T)(args)
          if (this.inMapSelfRefContext) {
            const rawArgs = node.arguments || [];
            const args = rawArgs.map(a => this.transformExpression(a));
            // Build: s["method"].(func(argTypes) retType)(args)
            // Since we don't know exact function signatures at this point,
            // use a raw code approach for the call
            const argsCode = args.map(a => this._nodeToCode(a)).join(', ');
            const methodAccess = `${this.receiverName}["${node.method}"]`;
            // For zero-arg functions we can omit the func type and just call
            // We need a type assertion to call the value from the map
            // Use a general approach: assert to func(...interface{}) interface{}
            const paramTypes = rawArgs.map(() => 'interface{}').join(', ');
            const returnType = this._inferThisMethodCallReturnForMap(node);
            const funcType = returnType
              ? `func(${paramTypes}) ${returnType}`
              : (rawArgs.length > 0 ? `func(${paramTypes})` : `func()`);
            return new GoRawCode(`${methodAccess}.(${funcType})(${argsCode})`);
          }

          // this.method(...) -> receiver.Method(...)
          const methodName = node.method;
          const rawArgs = node.arguments || [];
          const args = rawArgs.map((a, i) => {
            // Look up expected/declared parameter types BEFORE transforming
            // so we can pass target type context (fixes empty arrays getting []interface{})
            const paramKey = `${methodName}:${i}`;
            let expectedType = this.methodParamTypes.get(paramKey);
            const declaredType = this.methodDeclaredParams.get(paramKey) ||
                                 this.methodDeclaredParams.get(`${this.toPascalCase(methodName)}:${i}`);
            const argTargetType = declaredType || expectedType || null;

            const argExpr = this.transformExpression(a, argTargetType);
            const argType = this.inferFullExpressionType(a);

            // Add type cast if needed (e.g., int to uint32, or any to specific type)
            let argName = argType?.name || argType?.toString() || '';
            // If IL inference returns any/interface{}, try Go-side variable types
            if ((argName === 'any' || argName === 'interface{}') && a?.type === 'Identifier') {
              const goVarType = this.variableTypes.get(a.name);
              if (goVarType) {
                const goVarName = goVarType.name || goVarType.toString();
                if (goVarName !== 'any' && goVarName !== 'interface{}') {
                  argName = goVarName;
                }
              }
            }
            const isAnyType = argName === 'any' || argName === 'interface{}';

            // If argument is any/interface{} and we know the declared parameter type,
            // use type assertion to convert
            if (isAnyType && declaredType) {
              const declaredName = declaredType.name || declaredType.toString();
              if (declaredName !== 'any' && declaredName !== 'interface{}') {
                return this.safeTypeAssertion(argExpr, declaredType);
              }
            }

            // Existing logic for int/uint type mismatches
            if (expectedType && argType) {
              const expectedName = expectedType.name || expectedType.toString();
              if (argName !== expectedName && !argType.isSlice && !expectedType.isSlice) {
                // Check if it's an int/uint type mismatch that needs casting
                const intTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                                  'uint', 'uint8', 'uint16', 'uint32', 'uint64'];
                if (intTypes.includes(argName) && intTypes.includes(expectedName)) {
                  return new GoTypeConversion(expectedType, argExpr);
                }
              }
            }
            return argExpr;
          });
          // Check if this method was renamed due to collision
          let goMethodName = this.toPascalCase(node.method);
          if (this.currentStruct && this.methodRenames.has(this.currentStruct.name + '.' + node.method)) {
            goMethodName = this.methodRenames.get(this.currentStruct.name + '.' + node.method);
          }
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier(this.receiverName), goMethodName),
            args
          );
        }

        case 'HexDecode':
        case 'StringToBytes': {
          const arg = this.transformExpression(node.arguments?.[0] || node.value);
          if (node.type === 'HexDecode') {
            // Use mustHexDecode helper (defined in framework stubs) to avoid error handling
            return new GoCallExpression(
              new GoIdentifier('mustHexDecode'),
              [arg]
            );
          }
          // []byte(string) - type conversion
          return new GoTypeConversion(GoType.Slice(GoType.UInt8()), arg);
        }

        case 'PackBytes': {
          // Use pack32BE/LE helpers (defined in framework stubs)
          // PackBytes: packs individual bytes into a uint (bytes -> uint)
          const rawArgs = node.arguments || node.bytes || [];
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;

          // Check if any argument is a spread element (e.g., ...bytes)
          const hasSpread = rawArgs.some(a => a.type === 'SpreadElement');

          if (hasSpread) {
            // Use slice version: pack32BESlice(bytes) instead of pack32BE(b0, b1, b2, b3)
            // Get the underlying expression from the spread
            const spreadArg = rawArgs.find(a => a.type === 'SpreadElement');
            const arg = this.transformExpression(spreadArg.argument || spreadArg);
            const funcName = bits === 16 ? (isBigEndian ? 'pack16BESlice' : 'pack16LESlice') :
                             bits === 64 ? (isBigEndian ? 'pack64BESlice' : 'pack64LESlice') :
                                           (isBigEndian ? 'pack32BESlice' : 'pack32LESlice');
            return new GoCallExpression(new GoIdentifier(funcName), [arg]);
          }

          const args = rawArgs.map(a => this.transformExpression(a));
          const funcName = bits === 16 ? (isBigEndian ? 'pack16BE' : 'pack16LE') :
                           bits === 64 ? (isBigEndian ? 'pack64BE' : 'pack64LE') :
                                         (isBigEndian ? 'pack32BE' : 'pack32LE');
          return new GoCallExpression(new GoIdentifier(funcName), args);
        }

        case 'UnpackBytes': {
          // Use unpack32BE/LE helpers (defined in framework stubs)
          // UnpackBytes: unpacks a uint into individual bytes (uint -> []byte)
          let args = (node.arguments || []).map(a => this.transformExpression(a));
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;
          const funcName = bits === 16 ? (isBigEndian ? 'unpack16BE' : 'unpack16LE') :
                           bits === 64 ? (isBigEndian ? 'unpack64BE' : 'unpack64LE') :
                                         (isBigEndian ? 'unpack32BE' : 'unpack32LE');

          // Add type conversion if argument type doesn't match expected type
          // unpack16 expects uint16, unpack32 expects uint32, unpack64 expects uint64
          if (node.arguments && node.arguments.length > 0) {
            const argType = this.inferFullExpressionType(node.arguments[0]);
            const argTypeStr = argType?.toString() || '';
            const expectedType = bits === 16 ? 'uint16' : bits === 64 ? 'uint64' : 'uint32';
            if (argTypeStr && argTypeStr !== expectedType) {
              const goExpectedType = bits === 16 ? GoType.UInt16() :
                                     bits === 64 ? GoType.UInt64() : GoType.UInt32();
              // interface{}/any values need type assertion, not type conversion
              if (argTypeStr === 'interface{}' || argTypeStr === 'any')
                args = [this.safeTypeAssertion(args[0], goExpectedType)];
              else
                args = [new GoTypeConversion(goExpectedType, args[0])];
            }
          }
          return new GoCallExpression(new GoIdentifier(funcName), args);
        }

        case 'ArrayCreation': {
          // make([]T, size)
          // Use target type if available, otherwise infer from element type
          const size = node.size ? this.transformExpression(node.size) : GoLiteral.Int(0);
          if (targetType && targetType.isSlice) {
            return new GoMake(targetType, size);
          }
          // Resolve element type from IL node
          let acElemType = GoType.UInt8(); // Default for crypto code
          const rawElemType = typeof node.elementType === 'string'
            ? node.elementType
            : node.elementType?.name;
          if (rawElemType) {
            const et = rawElemType.toLowerCase();
            if (et === 'uint32' || et === 'long') acElemType = GoType.UInt32();
            else if (et === 'uint16' || et === 'integer') acElemType = GoType.UInt16();
            else if (et === 'int32') acElemType = GoType.Int32();
            else if (et === 'int16') acElemType = GoType.Int16();
            else if (et === 'int8') acElemType = GoType.Int8();
            else if (et === 'float32') acElemType = GoType.Float32();
            else if (et === 'float64' || et === 'double') acElemType = GoType.Float64();
            else if (et === 'uint64') acElemType = GoType.UInt64();
            else if (et === 'int64') acElemType = GoType.Int64();
            else if (et === 'uint8' || et === 'byte') acElemType = GoType.UInt8();
          }
          return new GoMake(GoType.Slice(acElemType), size);
        }

        case 'ArrayClear': {
          // Go: loop to zero or re-create slice
          // For simplicity, return a comment indicating clearing needed
          const arrNode = node.array || (node.arguments && node.arguments[0]); const arr = arrNode ? this.transformExpression(arrNode) : new GoIdentifier('array');
          // In Go, clearing is typically done by re-assigning a new slice
          // or using a for loop - we'll use slice re-assignment pattern
          return new GoAssignment([arr], '=', [
            new GoMake(GoType.Slice(GoType.UInt8()), new GoCallExpression(new GoIdentifier('len'), [arr]))
          ]);
        }

        case 'ArrayLength': {
          // len(array)
          const arrNode = node.array || node.argument;
          const arr = this.transformExpression(arrNode);

          // Check if the array is typed as any/interface{} - needs type assertion
          let arrType = this.inferFullExpressionType(arrNode);
          let arrTypeStr = arrType?.toString() || '';
          // If IL inference returns any/interface{}, try Go-side variable types
          if ((arrTypeStr === 'any' || arrTypeStr === 'interface{}') && arrNode?.type === 'Identifier') {
            const goVarType = this.variableTypes.get(arrNode.name);
            if (goVarType && goVarType.toString() !== 'any' && goVarType.toString() !== 'interface{}') {
              arrType = goVarType; arrTypeStr = goVarType.toString();
            }
          }
          if (arrTypeStr === 'any' || arrTypeStr === 'interface{}') {
            // len(data.([]byte)) for any type
            const typeAssert = this.safeTypeAssertion(arr, GoType.Slice(GoType.UInt8()));
            return new GoCallExpression(new GoIdentifier('len'), [typeAssert]);
          }

          return new GoCallExpression(new GoIdentifier('len'), [arr]);
        }

        case 'ArrayAppend': {
          // append(slice, value)
          const arr = this.transformExpression(node.array);
          let val = this.transformExpression(node.value);

          // Get array element type and value type to detect mismatches
          const arrType = this.inferFullExpressionType(node.array);
          const valType = this.inferFullExpressionType(node.value);
          const arrTypeStr = arrType?.toString() || '';
          const valTypeStr = valType?.toString() || '';

          // Extract element type from slice type like []int32 -> int32
          let elemType = null;
          if (arrType?.isSlice && arrType.elementType) {
            elemType = arrType.elementType;
          } else if (arrTypeStr.startsWith('[]')) {
            const elemTypeStr = arrTypeStr.slice(2);
            elemType = new GoType(elemTypeStr);
          }

          // Add type conversion if element type doesn't match value type
          if (elemType && valType) {
            const elemTypeStr = elemType.toString();
            if (elemTypeStr !== valTypeStr && this.isNumericType(elemTypeStr) && this.isNumericType(valTypeStr)) {
              val = new GoTypeConversion(elemType, val);
            }
          }
          return new GoCallExpression(new GoIdentifier('append'), [arr, val]);
        }

        case 'ArraySlice': {
          // slice[start:end]
          const arr = this.transformExpression(node.array);
          const start = node.start ? this._transformSliceIndex(node.start, node.array) : null;
          const end = node.end ? this._transformSliceIndex(node.end, node.array) : null;
          return new GoSliceExpression(arr, start, end);
        }

        case 'ArrayConcat': {
          // append(arr1, arr2...)
          const arr = this.transformExpression(node.array);
          // Infer the target slice type from the transformed first array for type consistency
          // Use the transformed node's type (GoCompositeLiteral carries its slice type)
          // rather than inferFullExpressionType which may disagree with the actual transformed type
          let arrSliceType = null;
          if (arr?.type?.isSlice) arrSliceType = arr.type;
          if (!arrSliceType) arrSliceType = this.inferFullExpressionType(node.array);
          const others = (node.arrays || []).map(a => this.transformExpression(a, arrSliceType));
          let result = arr;
          for (const other of others) {
            result = new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(other)]);
          }
          return result;
        }

        case 'ErrorCreation': {
          // errors.New() or fmt.Errorf()
          this.addImport('errors');
          const msg = node.message ? this.transformExpression(node.message) : GoLiteral.String('error');
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('errors'), 'New'),
            [msg]
          );
        }

        case 'Cast': {
          // Type conversion: int32(value), uint8(value), etc.
          const rawNode = node.arguments?.[0] || node.expression;
          const value = this.transformExpression(rawNode);
          let castTarget = node.targetType || 'int';
          // Detect int32 overflow: if value > INT32_MAX, use uint32 instead
          if (castTarget === 'int32') {
            const rawVal = rawNode?.value;
            // Also check the transformed Go literal value
            const goVal = value?.value;
            if ((typeof rawVal === 'number' && rawVal > 2147483647) ||
                (typeof goVal === 'number' && goVal > 2147483647)) {
              castTarget = 'uint32';
            }
          }
          const goType = castTarget === 'uint64' ? 'uint64' :
                         castTarget === 'uint32' ? 'uint32' :
                         castTarget === 'int32' ? 'int32' :
                         castTarget === 'int64' ? 'int64' :
                         castTarget === 'uint8' || castTarget === 'byte' ? 'uint8' :
                         castTarget === 'uint16' ? 'uint16' :
                         castTarget === 'int16' ? 'int16' :
                         castTarget === 'int8' ? 'int8' :
                         castTarget === 'float64' || castTarget === 'double' ? 'float64' :
                         castTarget === 'float32' || castTarget === 'float' ? 'float32' :
                         castTarget === 'int' ? 'int' : 'int';
          // If source is interface{}/any, use type assertion instead of type conversion
          const srcType = this.inferFullExpressionType(rawNode);
          const srcTypeStr = srcType?.toString() || '';
          if (srcTypeStr === 'interface{}' || srcTypeStr === 'any') {
            return this.safeTypeAssertion(value, new GoType(goType));
          }
          return new GoTypeConversion(new GoType(goType), value);
        }

        case 'MathCall': {
          // Math functions -> math package (import added only when needed)
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const method = node.method;
          switch (method) {
            case 'imul':
              // int32 multiply with overflow - no math import needed
              if (args.length >= 2)
                return new GoBinaryExpression(
                  new GoCallExpression(new GoIdentifier('int32'), [args[0]]),
                  '*',
                  new GoCallExpression(new GoIdentifier('int32'), [args[1]])
                );
              break;
            case 'floor':
              this.addImport('math');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('math'), 'Floor'), args);
            case 'ceil':
              this.addImport('math');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('math'), 'Ceil'), args);
            case 'abs':
              this.addImport('math');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('math'), 'Abs'), args);
            case 'sqrt':
              this.addImport('math');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('math'), 'Sqrt'), args);
            case 'pow':
              this.addImport('math');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('math'), 'Pow'), args);
            case 'min':
              this.addImport('math');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('math'), 'Min'), args);
            case 'max':
              this.addImport('math');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('math'), 'Max'), args);
            case 'random':
              this.addImport('math/rand');
              return new GoCallExpression(new GoSelectorExpression(new GoIdentifier('rand'), 'Float64'), []);
            default:
              this.addImport('math');
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('math'), this.toPascalCase(method)),
                args
              );
          }
        }

        case 'RotateLeft':
        case 'RotateRight': {
          // bits.RotateLeft32 or bits.RotateLeft64
          this.addImport('math/bits');
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          const funcName = node.type === 'RotateLeft' ? `RotateLeft${bits}` : `RotateLeft${bits}`;
          // For RotateRight, negate the amount
          const actualAmount = node.type === 'RotateRight'
            ? new GoUnaryExpression('-', amount)
            : amount;
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('mathbits'), funcName),
            [value, actualAmount]
          );
        }

        case 'OpCodesCall': {
          // OpCodes.XYZ(...) - map to helper functions
          const method = node.method || node.name || node.callee?.property?.name;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          // Map OpCodes methods to Go helpers
          const opCodesMap = {
            'RotL32': 'rotl32', 'RotR32': 'rotr32',
            'RotL16': 'rotl16', 'RotR16': 'rotr16',
            'RotL8': 'rotl8', 'RotR8': 'rotr8',
            'Pack32BE': 'pack32BE', 'Pack32LE': 'pack32LE',
            'Pack16BE': 'pack16BE', 'Pack16LE': 'pack16LE',
            'Unpack32BE': 'unpack32BE', 'Unpack32LE': 'unpack32LE',
            'Unpack16BE': 'unpack16BE', 'Unpack16LE': 'unpack16LE',
            'XorArrays': 'xorArrays',
            'Hex8ToBytes': 'mustHexDecode',
            'BytesToHex8': 'bytesToHex',
            'AnsiToBytes': 'stringToBytes',
            'ClearArray': 'clearArray',
            'CloneArray': 'cloneArray',
            'CopyArray': 'cloneArray',  // CopyArray and CloneArray are synonyms
          };

          // Special handling for CloneArray/CopyArray - use typed version based on argument type
          if (method === 'CloneArray' || method === 'CopyArray') {
            const argNode = node.arguments?.[0];
            if (argNode) {
              const argType = this.inferFullExpressionType(argNode);
              // Determine the appropriate clone function based on element type
              if (argType?.isSlice || argType?.isArray) {
                const elemType = argType.valueType || argType.elementType;
                const elemTypeName = elemType?.name || '';
                if (elemTypeName === 'uint32') {
                  return new GoCallExpression(new GoIdentifier('cloneArrayUint32'), args);
                } else if (elemTypeName === 'uint16') {
                  return new GoCallExpression(new GoIdentifier('cloneArrayUint16'), args);
                } else if (elemTypeName === 'int') {
                  return new GoCallExpression(new GoIdentifier('cloneArrayInt'), args);
                }
              }
            }
            // Default to cloneArray (for []byte)
            return new GoCallExpression(new GoIdentifier('cloneArray'), args);
          }

          const goFunc = opCodesMap[method] || this.toLowerFirst(method);
          return new GoCallExpression(new GoIdentifier(goFunc), args);
        }

        case 'Floor': {
          // Math.floor(x) -> int(math.Floor(float64(x))) for integer context
          // For integer division, Go's int division already floors for positive numbers
          const argNode = node.argument || node.arguments?.[0];
          const argType = this.inferFullExpressionType(argNode);

          // If argument is already an integer division result, just return it
          // (Go's integer division is equivalent to floor for positive numbers)
          if (argNode?.type === 'BinaryExpression' && argNode.operator === '/') {
            const leftType = this.inferFullExpressionType(argNode.left);
            const rightType = this.inferFullExpressionType(argNode.right);
            const leftName = leftType?.name || '';
            const rightName = rightType?.name || '';
            if ((leftName.startsWith('int') || leftName.startsWith('uint')) &&
                (rightName.startsWith('int') || rightName.startsWith('uint'))) {
              // Integer division - Go already floors for positive
              return this.transformExpression(argNode);
            }
          }

          this.addImport('math');
          const arg = this.transformExpression(argNode);

          // Wrap argument in float64() if it's not already a float
          const argName = argType?.name || '';
          let floatArg = arg;
          if (!argName.includes('float')) {
            floatArg = new GoTypeConversion(GoType.Float64(), arg);
          }

          // math.Floor returns float64, wrap in int() for integer context
          const floorCall = new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Floor'),
            [floatArg]
          );
          return new GoTypeConversion(GoType.Int(), floorCall);
        }

        case 'ArrayFill': {
          // Create and fill array - Go: make + loop or use slice literal with repeated value
          const size = node.size ? this.transformExpression(node.size) : GoLiteral.Int(0);
          const value = node.value ? this.transformExpression(node.value) : GoLiteral.Int(0);
          // For simple cases, use makeFilledSlice helper
          return new GoCallExpression(
            new GoIdentifier('makeFilledSlice'),
            [size, value]
          );
        }

        case 'TypeConversion': {
          // Explicit type conversion
          const value = this.transformExpression(node.argument || node.value);
          let targetType = this.mapType(node.targetType || node.toType);
          // Detect int32 overflow: if value > INT32_MAX, use uint32 instead
          if (targetType?.name === 'int32') {
            const rawVal = (node.argument || node.value)?.value;
            if (typeof rawVal === 'number' && rawVal > 2147483647) targetType = GoType.UInt32();
          }
          return new GoTypeConversion(targetType, value);
        }

        case 'BitwiseOp': {
          // Bitwise operation node
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new GoBinaryExpression(left, node.operator, right);
        }

        case 'BitRotation': {
          // Bit rotation - similar to RotateLeft/RotateRight
          this.addImport('math/bits');
          const value = this.transformExpression(node.value);
          const amount = this.transformExpression(node.amount);
          const bits = node.bits || 32;
          const funcName = node.direction === 'left' ? `RotateLeft${bits}` : `RotateLeft${bits}`;
          const actualAmount = node.direction === 'right'
            ? new GoUnaryExpression('-', amount)
            : amount;
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('mathbits'), funcName),
            [value, actualAmount]
          );
        }

        case 'ArrayLiteral': {
          // ArrayLiteral from TypedArray construction or Array literals
          // Use the elementType from the IL node if available
          let elemType = GoType.UInt8(); // Default for crypto code
          if (node.elementType) {
            // Handle both string and object { name: 'type' } formats
            const rawType = typeof node.elementType === 'string' ? node.elementType : node.elementType?.name;
            const typeStr = rawType?.toLowerCase();
            if (typeStr === 'uint8' || typeStr === 'byte') {
              elemType = GoType.UInt8();
            } else if (typeStr === 'uint32' || typeStr === 'long') {
              elemType = GoType.UInt32();
            } else if (typeStr === 'uint16' || typeStr === 'integer') {
              elemType = GoType.UInt16();
            } else if (typeStr === 'int32') {
              // Check if any values exceed INT32_MAX - use uint32 instead
              const INT32_MAX = 2147483647;
              const hasOverflow = (node.elements || []).some(el =>
                el && el.type === 'Literal' && typeof el.value === 'number' && (el.value > INT32_MAX || el.value < 0)
              );
              elemType = hasOverflow ? GoType.UInt32() : GoType.Int32();
            } else if (typeStr === 'int16') {
              elemType = GoType.Int16();
            } else if (typeStr === 'int8') {
              elemType = GoType.Int8();
            } else if (typeStr === 'float32') {
              elemType = GoType.Float32();
            } else if (typeStr === 'float64' || typeStr === 'double') {
              elemType = GoType.Float64();
            } else if (typeStr === 'uint64') {
              elemType = GoType.UInt64();
            } else if (typeStr === 'int64') {
              // Check if any values exceed INT64_MAX - use uint64 instead
              const INT64_MAX = 9223372036854775807n;
              const hasOverflow = (node.elements || []).some(el =>
                el && el.type === 'Literal' && typeof el.value === 'bigint' && (el.value > INT64_MAX || el.value < 0n)
              );
              elemType = hasOverflow ? GoType.UInt64() : GoType.Int64();
            }
            // uint8/byte is the default
          }
          const sliceType = GoType.Slice(elemType);

          // Check for spread elements - need append() instead of composite literal
          const hasSpreadInLiteral = (node.elements || []).some(e => e && e.type === 'SpreadElement');
          if (hasSpreadInLiteral) {
            let result = null;
            const regularElems = [];
            for (const el of (node.elements || [])) {
              if (!el) continue;
              if (el.type === 'SpreadElement') {
                if (regularElems.length > 0) {
                  const lit = new GoCompositeLiteral(sliceType, [...regularElems]);
                  result = result
                    ? new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(lit)])
                    : lit;
                  regularElems.length = 0;
                }
                const arg = this.transformExpression(el.argument);
                if (result) {
                  result = new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(arg)]);
                } else {
                  const emptySlice = new GoCompositeLiteral(sliceType, []);
                  result = new GoCallExpression(new GoIdentifier('append'), [emptySlice, new GoSpread(arg)]);
                }
              } else {
                regularElems.push(this.transformExpression(el, elemType));
              }
            }
            if (regularElems.length > 0) {
              const lit = new GoCompositeLiteral(sliceType, regularElems);
              result = result
                ? new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(lit)])
                : lit;
            }
            return result || new GoCompositeLiteral(sliceType, []);
          }

          const elements = (node.elements || []).map(e => this.transformExpression(e, elemType));
          return new GoCompositeLiteral(sliceType, elements);
        }

        case 'ArrayIncludes': {
          // array.includes(value) -> containsElement(array, value)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new GoCallExpression(new GoIdentifier('containsElement'), [arr, value]);
        }

        case 'ArrayIndexOf': {
          // array.indexOf(value) -> indexOf(array, value)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new GoCallExpression(new GoIdentifier('indexOf'), [arr, value]);
        }

        case 'ArrayMap': {
          // array.map(fn) -> mapSlice(array, fn) - needs helper
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.fn;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new GoCallExpression(new GoIdentifier('mapSlice'), [arr, fn]);
          }
          return arr;
        }

        case 'ArrayFilter': {
          // array.filter(fn) -> filterSlice(array, fn)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new GoCallExpression(new GoIdentifier('filterSlice'), [arr, fn]);
          }
          return arr;
        }

        case 'ArrayForEach': {
          // array.forEach(fn) -> for _, v := range array { fn(v) }
          // Since this is in expression context, return a comment
          return new GoIdentifier('/* forEach not supported in expression context */');
        }

        case 'ArraySort': {
          // array.sort() -> sortSlice(array)
          this.addImport('sort');
          const arr = this.transformExpression(node.array);
          return new GoCallExpression(new GoIdentifier('sortSlice'), [arr]);
        }

        case 'ArrayReduce': {
          // array.reduce(fn, init) -> reduceSlice(array, init, fn)
          // Use typed variant when array element type is known
          const arrType = this.inferFullExpressionType(node.array);
          const arr = this.transformExpression(node.array);
          const initial = node.initial ? this.transformExpression(node.initial) : GoLiteral.Int(0);
          const callback = node.callback || node.reducer;
          if (callback) {
            const elemTypeStr = arrType?.valueType?.name || arrType?.valueType?.toString() || '';
            const isByte = arrType?.isSlice && (elemTypeStr === 'uint8' || elemTypeStr === 'byte');
            const isUint32 = arrType?.isSlice && elemTypeStr === 'uint32';
            if (isByte || isUint32) {
              // Use typed reduce: type the callback parameters
              const savedTypes = new Map();
              if (callback.type === 'ArrowFunctionExpression' || callback.type === 'ArrowFunction' || callback.type === 'FunctionExpression') {
                const params = callback.params || [];
                const paramType = isByte ? GoType.UInt8() : GoType.UInt32();
                for (const p of params) {
                  if (p.name || p.type === 'Identifier') {
                    const pName = p.name || p.value;
                    if (pName) {
                      savedTypes.set(pName, this.variableTypes.get(pName));
                      this.variableTypes.set(pName, paramType);
                    }
                  }
                }
              }
              const fn = this.transformExpression(callback);
              // Restore saved variable types
              for (const [k, v] of savedTypes) {
                if (v === undefined) this.variableTypes.delete(k);
                else this.variableTypes.set(k, v);
              }
              const funcName = isByte ? 'reduceSliceBytes' : 'reduceSliceUint32';
              return new GoCallExpression(new GoIdentifier(funcName), [arr, fn, initial]);
            }
            const fn = this.transformExpression(callback);
            return new GoCallExpression(new GoIdentifier('reduceSlice'), [arr, initial, fn]);
          }
          return initial;
        }

        case 'TypedArrayCreation': {
          // new Uint8Array(size) -> make([]byte, size)
          // new Uint8Array(existingArray) -> append([]byte{}, existingArray...)
          const typeMap = {
            'Uint8Array': GoType.UInt8(),
            'Uint16Array': GoType.UInt16(),
            'Uint32Array': GoType.UInt32(),
            'Int8Array': GoType.Int8(),
            'Int16Array': GoType.Int16(),
            'Int32Array': GoType.Int32(),
            'Float32Array': GoType.Float32(),
            'Float64Array': GoType.Float64()
          };
          // IL node may use 'typedArrayType' or 'arrayType'; also check 'elementType'
          let tacElemType = typeMap[node.typedArrayType] || typeMap[node.arrayType];
          if (!tacElemType && node.elementType) {
            const et = (typeof node.elementType === 'string' ? node.elementType : node.elementType?.name || '').toLowerCase();
            if (et === 'uint32') tacElemType = GoType.UInt32();
            else if (et === 'uint16') tacElemType = GoType.UInt16();
            else if (et === 'int32') tacElemType = GoType.Int32();
            else if (et === 'int16') tacElemType = GoType.Int16();
            else if (et === 'int8') tacElemType = GoType.Int8();
            else if (et === 'float32') tacElemType = GoType.Float32();
            else if (et === 'float64') tacElemType = GoType.Float64();
            else if (et === 'uint64') tacElemType = GoType.UInt64();
            else if (et === 'int64') tacElemType = GoType.Int64();
          }
          const sliceType = GoType.Slice(tacElemType || GoType.UInt8());

          // Check if size argument is an array/slice (copy from source) vs integer (create with size)
          if (node.size) {
            const sizeArgType = this.inferFullExpressionType(node.size);
            const sizeArgTypeStr = sizeArgType?.toString() || '';
            const sizeIsSlice = sizeArgType?.isSlice || sizeArgTypeStr.startsWith('[]');
            // Also detect array-like sources by AST structure:
            // - ArrayExpression is definitely an array
            // - LogicalExpression with ArrayExpression fallback is data || []
            // - Identifier/MemberExpression referencing a parameter/variable that's an array
            const sizeNodeType = node.size.type || node.size.ilNodeType || '';
            const isArrayLikeSource = sizeIsSlice
              || sizeNodeType === 'ArrayExpression' || sizeNodeType === 'ArrayLiteral'
              || (sizeNodeType === 'LogicalExpression' && node.size.right?.type === 'ArrayExpression');
            if (isArrayLikeSource) {
              // new Uint8Array(existingArray) -> append([]T{}, existingArray...)
              const source = this.transformExpression(node.size);
              const emptySlice = new GoCompositeLiteral(sliceType, []);
              const spreadSource = new GoSpread(source);
              return new GoCallExpression(new GoIdentifier('append'), [emptySlice, spreadSource]);
            }
          }

          const size = node.size ? this.transformExpression(node.size) : GoLiteral.Int(0);
          return new GoMake(sliceType, size);
        }

        case 'TypedArraySet': {
          // typedArray.set(source, offset) -> copy(typedArray[offset:], source)
          const array = this.transformExpression(node.array);
          const source = this.transformExpression(node.source);
          if (node.offset) {
            const offset = this.transformExpression(node.offset);
            const sliced = new GoSliceExpression(array, offset, null);
            return new GoCallExpression(new GoIdentifier('copy'), [sliced, source]);
          }
          return new GoCallExpression(new GoIdentifier('copy'), [array, source]);
        }

        case 'TypedArraySubarray': {
          // typedArray.subarray(start, end) -> typedArray[start:end]
          const array = this.transformExpression(node.array);
          const start = node.start ? this._transformSliceIndex(node.start, node.array) : null;
          const end = node.end ? this._transformSliceIndex(node.end, node.array) : null;
          return new GoSliceExpression(array, start, end);
        }

        case 'ArraySplice': {
          // array.splice(start, deleteCount, ...items) -> Go slice manipulation
          // In Go, we need to use append and slice operations
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : null;
          const items = (node.items || []).map(item => this.transformExpression(item));

          // For simple splice with no items and deleteCount, use slice syntax
          if (items.length === 0 && deleteCount) {
            // array.splice(start, deleteCount) returns removed elements
            // Go: array[start:start+deleteCount]
            const endExpr = new GoBinaryExpression(start, '+', deleteCount);
            return new GoSliceExpression(array, start, endExpr);
          }

          // For more complex splices, use spliceSlice helper (always available)
          return new GoCallExpression(new GoIdentifier('spliceSlice'), [array, start, deleteCount || GoLiteral.Int(0), ...items]);
        }

        case 'StringRepeat': {
          // string.repeat(count) -> strings.Repeat(str, count)
          this.addImport('strings');
          const str = this.transformExpression(node.string);
          const count = node.count ? this.transformExpression(node.count) : GoLiteral.Int(1);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'Repeat'),
            [str, count]
          );
        }

        case 'Min': {
          // Math.min(a, b) -> minInt/minUint32 helper based on argument types
          // Handle spread: Math.min(...arr) -> minSlice(arr)
          const rawArgs = node.arguments || [];
          if (rawArgs.length === 1 && rawArgs[0].type === 'SpreadElement') {
            const spreadArg = this.transformExpression(rawArgs[0].argument);
            return new GoCallExpression(new GoIdentifier('minSlice'), [spreadArg]);
          }
          const args = rawArgs.map(a => this.transformExpression(a));
          if (args.length === 0) return GoLiteral.Int(0);
          if (args.length === 1) return args[0];
          const minArgType = rawArgs[0] ? this.inferFullExpressionType(rawArgs[0]) : null;
          const minTypeStr = minArgType?.toString() || '';
          const minHelper = (minTypeStr === 'uint32' || minTypeStr === 'byte' || minTypeStr === 'uint8') ? 'minUint32' : 'minInt';
          // Wrap arguments in explicit type conversion to match helper signature
          const minTargetType = minHelper === 'minUint32' ? GoType.UInt32() : GoType.Int();
          const minCoercedArgs = args.map(a => new GoTypeConversion(minTargetType, a));
          return new GoCallExpression(new GoIdentifier(minHelper), minCoercedArgs);
        }

        case 'Max': {
          // Math.max(a, b) -> maxInt/maxUint32 helper based on argument types
          // Handle spread: Math.max(...arr) -> maxSlice(arr)
          const rawArgs = node.arguments || [];
          if (rawArgs.length === 1 && rawArgs[0].type === 'SpreadElement') {
            const spreadArg = this.transformExpression(rawArgs[0].argument);
            return new GoCallExpression(new GoIdentifier('maxSlice'), [spreadArg]);
          }
          const args = rawArgs.map(a => this.transformExpression(a));
          if (args.length === 0) return GoLiteral.Int(0);
          if (args.length === 1) return args[0];
          const maxArgType = rawArgs[0] ? this.inferFullExpressionType(rawArgs[0]) : null;
          const maxTypeStr = maxArgType?.toString() || '';
          const maxHelper = (maxTypeStr === 'uint32' || maxTypeStr === 'byte' || maxTypeStr === 'uint8') ? 'maxUint32' : 'maxInt';
          // Wrap arguments in explicit type conversion to match helper signature
          const maxTargetType = maxHelper === 'maxUint32' ? GoType.UInt32() : GoType.Int();
          const maxCoercedArgs = args.map(a => new GoTypeConversion(maxTargetType, a));
          return new GoCallExpression(new GoIdentifier(maxHelper), maxCoercedArgs);
        }

        case 'StringTransform': {
          // String transformation operations
          const str = this.transformExpression(node.string || node.argument);
          const operation = node.operation || node.method;
          switch (operation) {
            case 'toLowerCase':
              this.addImport('strings');
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('strings'), 'ToLower'),
                [str]
              );
            case 'toUpperCase':
              this.addImport('strings');
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('strings'), 'ToUpper'),
                [str]
              );
            case 'trim':
              this.addImport('strings');
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('strings'), 'TrimSpace'),
                [str]
              );
            case 'split':
              this.addImport('strings');
              const sep = node.separator ? this.transformExpression(node.separator) : GoLiteral.String('');
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('strings'), 'Split'),
                [str, sep]
              );
            default:
              return str;
          }
        }

        case 'StringIncludes': {
          // string.includes(substr) -> strings.Contains(str, substr)
          this.addImport('strings');
          const str = this.transformExpression(node.string);
          const substr = this.transformExpression(node.substring || node.search);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'Contains'),
            [str, substr]
          );
        }

        case 'StringIndexOf': {
          // string.indexOf(substr) -> strings.Index(str, substr)
          this.addImport('strings');
          const str = this.transformExpression(node.string);
          const substr = this.transformExpression(node.substring || node.search);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'Index'),
            [str, substr]
          );
        }

        case 'StringCharAt': {
          // string.charAt(i) -> string(str[i])
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new GoTypeConversion(GoType.String(), new GoIndexExpression(str, index));
        }

        case 'StringCharCodeAt': {
          // string.charCodeAt(i) -> int(str[i])
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new GoCallExpression(new GoIdentifier('int'), [new GoIndexExpression(str, index)]);
        }

        case 'StringFromCharCode': {
          // String.fromCharCode(code) -> string([]byte{byte(code)})
          const code = this.transformExpression(node.code || node.arguments?.[0]);
          return new GoTypeConversion(
            GoType.String(),
            new GoCompositeLiteral(GoType.Slice(GoType.UInt8()), [
              new GoCallExpression(new GoIdentifier('byte'), [code])
            ])
          );
        }

        case 'ArrayFind': {
          // array.find(fn) -> findElement(array, fn)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new GoCallExpression(new GoIdentifier('findElement'), [arr, fn]);
          }
          return GoLiteral.Nil();
        }

        case 'ArrayFindIndex': {
          // array.findIndex(fn) -> findIndex(array, fn)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new GoCallExpression(new GoIdentifier('findIndex'), [arr, fn]);
          }
          return GoLiteral.Int(-1);
        }

        case 'ArrayEvery': {
          // array.every(fn) -> every(array, fn)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new GoCallExpression(new GoIdentifier('every'), [arr, fn]);
          }
          return GoLiteral.Bool(true);
        }

        case 'ArraySome': {
          // array.some(fn) -> some(array, fn)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new GoCallExpression(new GoIdentifier('some'), [arr, fn]);
          }
          return GoLiteral.Bool(false);
        }

        case 'ArrayReverse': {
          // array.reverse() -> reverseSlice(array)
          const arr = this.transformExpression(node.array);
          return new GoCallExpression(new GoIdentifier('reverseSlice'), [arr]);
        }

        case 'ArrayJoin': {
          // array.join(sep) -> strings.Join(array, sep)
          this.addImport('strings');
          const arr = this.transformExpression(node.array);
          const sep = node.separator ? this.transformExpression(node.separator) : GoLiteral.String('');
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'Join'),
            [arr, sep]
          );
        }

        case 'ArrayPop': {
          // array.pop() -> popSlice(&array) - needs helper that modifies slice
          const arr = this.transformExpression(node.array);
          return new GoCallExpression(new GoIdentifier('popSlice'), [new GoUnaryExpression('&', arr)]);
        }

        case 'ArrayShift': {
          // array.shift() -> shiftSlice(&array) - needs helper
          const arr = this.transformExpression(node.array);
          return new GoCallExpression(new GoIdentifier('shiftSlice'), [new GoUnaryExpression('&', arr)]);
        }

        case 'ArrayPush': {
          // array.push(value) -> array = append(array, value)
          const arr = this.transformExpression(node.array);
          // Infer array element type to pass as context for struct literal detection
          const pushArrType = this.inferFullExpressionType(node.array);
          const pushElemType = pushArrType?.isSlice ? pushArrType.valueType : null;
          let value = this.transformExpression(node.value, pushElemType);

          // Get array element type and value type to detect mismatches
          const arrType = this.inferFullExpressionType(node.array);
          const valType = this.inferFullExpressionType(node.value);
          const arrTypeStr = arrType?.toString() || '';
          const valTypeStr = valType?.toString() || '';

          // Extract element type from slice type like []int32 -> int32
          let elemType = null;
          if (arrType?.isSlice && arrType.elementType) {
            elemType = arrType.elementType;
          } else if (arrTypeStr.startsWith('[]')) {
            const elemTypeStr = arrTypeStr.slice(2);
            elemType = new GoType(elemTypeStr);
          }

          // Add type conversion if element type doesn't match value type
          if (elemType && valType) {
            const elemTypeStr = elemType.toString();
            if (elemTypeStr !== valTypeStr && this.isNumericType(elemTypeStr) && this.isNumericType(valTypeStr)) {
              value = new GoTypeConversion(elemType, value);
            }
          }
          return new GoCallExpression(new GoIdentifier('append'), [arr, value]);
        }

        case 'ArrayUnshift': {
          // array.unshift(value) -> unshiftSlice(&array, value)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new GoCallExpression(new GoIdentifier('unshiftSlice'), [new GoUnaryExpression('&', arr), value]);
        }

        case 'Abs': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Abs'),
            [arg]
          );
        }

        case 'Ceil': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Ceil'),
            [arg]
          );
        }

        case 'Round': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Round'),
            [arg]
          );
        }

        case 'Trunc':
        case 'Truncate': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Trunc'),
            [arg]
          );
        }

        case 'Sign': {
          // Sign function - Go doesn't have built-in, use Copysign(1, x)
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Copysign'),
            [GoLiteral.Float(1.0), arg]
          );
        }

        case 'Sqrt': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Sqrt'),
            [arg]
          );
        }

        case 'Log': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Log'),
            [arg]
          );
        }

        case 'Pow':
        case 'Power': {
          this.addImport('math');
          const base = this.transformExpression(node.base || node.arguments?.[0]);
          const exp = this.transformExpression(node.exponent || node.arguments?.[1]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Pow'),
            [base, exp]
          );
        }

        case 'Random': {
          this.addImport('math/rand');
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('rand'), 'Float64'),
            []
          );
        }

        case 'Sin': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Sin'),
            [arg]
          );
        }

        case 'Cos': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Cos'),
            [arg]
          );
        }

        case 'Tan': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Tan'),
            [arg]
          );
        }

        case 'Asin': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Asin'),
            [arg]
          );
        }

        case 'Acos': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Acos'),
            [arg]
          );
        }

        case 'Atan': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Atan'),
            [arg]
          );
        }

        case 'Atan2': {
          this.addImport('math');
          const y = this.transformExpression(node.arguments?.[0] || node.y);
          const x = this.transformExpression(node.arguments?.[1] || node.x);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Atan2'),
            [y, x]
          );
        }

        case 'Sinh': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Sinh'),
            [arg]
          );
        }

        case 'Cosh': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Cosh'),
            [arg]
          );
        }

        case 'Tanh': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Tanh'),
            [arg]
          );
        }

        case 'Exp': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Exp'),
            [arg]
          );
        }

        case 'Cbrt': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Cbrt'),
            [arg]
          );
        }

        case 'Hypot': {
          this.addImport('math');
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Hypot'),
            args
          );
        }

        case 'Fround': {
          // Math.fround(x) -> float32(x) cast
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(new GoIdentifier('float32'), [arg]);
        }

        case 'MathConstant': {
          // Math constants: PI, E, LN2, LN10, LOG2E, LOG10E, SQRT2, SQRT1_2
          this.addImport('math');
          const mathConstMap = {
            'PI': 'Pi',
            'E': 'E',
            'LN2': 'Ln2',
            'LN10': 'Ln10',
            'LOG2E': 'Log2E',
            'LOG10E': 'Log10E',
            'SQRT2': 'Sqrt2',
          };
          const goConst = mathConstMap[node.name];
          if (goConst)
            return new GoSelectorExpression(new GoIdentifier('math'), goConst);
          // SQRT1_2 has no Go constant - use 1.0 / math.Sqrt2
          if (node.name === 'SQRT1_2')
            return new GoBinaryExpression(
              GoLiteral.Float64(1.0),
              '/',
              new GoSelectorExpression(new GoIdentifier('math'), 'Sqrt2')
            );
          // Fallback: use the literal value
          return GoLiteral.Float64(node.value);
        }

        case 'NumberConstant': {
          // Number constants: MAX_SAFE_INTEGER, MIN_SAFE_INTEGER, MAX_VALUE, MIN_VALUE, EPSILON, POSITIVE_INFINITY, NEGATIVE_INFINITY, NaN
          this.addImport('math');
          switch (node.name) {
            case 'MAX_SAFE_INTEGER':
              return new GoSelectorExpression(new GoIdentifier('math'), 'MaxInt64');
            case 'MIN_SAFE_INTEGER':
              return new GoUnaryExpression('-', new GoSelectorExpression(new GoIdentifier('math'), 'MaxInt64'));
            case 'MAX_VALUE':
              return new GoSelectorExpression(new GoIdentifier('math'), 'MaxFloat64');
            case 'MIN_VALUE':
              return new GoSelectorExpression(new GoIdentifier('math'), 'SmallestNonzeroFloat64');
            case 'EPSILON':
              return GoLiteral.Float64(2.220446049250313e-16);
            case 'POSITIVE_INFINITY':
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('math'), 'Inf'),
                [GoLiteral.Int(1)]
              );
            case 'NEGATIVE_INFINITY':
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('math'), 'Inf'),
                [GoLiteral.Int(-1)]
              );
            case 'NaN':
              return new GoCallExpression(
                new GoSelectorExpression(new GoIdentifier('math'), 'NaN'),
                []
              );
            default:
              // Fallback: use the literal value
              return GoLiteral.Float64(node.value);
          }
        }

        case 'InstanceOfCheck': {
          // value instanceof ClassName -> func() bool { _, ok := value.(ClassName); return ok }()
          const value = this.transformExpression(node.value);
          const className = node.className?.name || node.className?.value || (typeof node.className === 'string' ? node.className : 'interface{}');
          return new GoRawCode(`func() bool { _, ok_ := ${this._nodeToCode(value)}.(${className}); return ok_ }()`);
        }

        case 'Imul': {
          // JavaScript imul - 32-bit integer multiply
          const a = this.transformExpression(node.arguments?.[0]);
          const b = this.transformExpression(node.arguments?.[1]);
          return new GoBinaryExpression(
            new GoCallExpression(new GoIdentifier('int32'), [a]),
            '*',
            new GoCallExpression(new GoIdentifier('int32'), [b])
          );
        }

        case 'HexEncode': {
          // bytes to hex string
          this.addImport('encoding/hex');
          const arg = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('hex'), 'EncodeToString'),
            [arg]
          );
        }

        case 'BytesToString': {
          // []byte to string
          const arg = this.transformExpression(node.value || node.argument || node.bytes);
          return new GoTypeConversion(GoType.String(), arg);
        }

        case 'ObjectKeys': {
          // Object.keys(obj) -> getKeys(obj) helper
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new GoCallExpression(new GoIdentifier('getKeys'), [obj]);
        }

        case 'ObjectValues': {
          // Object.values(obj) -> getValues(obj) helper
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new GoCallExpression(new GoIdentifier('getValues'), [obj]);
        }

        case 'ObjectEntries': {
          // Object.entries(obj) -> getEntries(obj) helper
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new GoCallExpression(new GoIdentifier('getEntries'), [obj]);
        }

        case 'ArrayXor': {
          // XOR two arrays element-wise -> xorArrays(arr1, arr2)
          const arr1 = this.transformExpression(node.left || node.array1 || node.arguments?.[0]);
          const arr2 = this.transformExpression(node.right || node.array2 || node.arguments?.[1]);
          return new GoCallExpression(new GoIdentifier('xorArrays'), [arr1, arr2]);
        }

        case 'BigIntCast': {
          // BigInt(value) -> int64(value) or uint64(value)
          const value = this.transformExpression(node.argument || node.value || node.arguments?.[0]);
          const isSigned = node.signed !== false;
          const goType = isSigned ? 'int64' : 'uint64';
          return new GoCallExpression(new GoIdentifier(goType), [value]);
        }

        case 'BigIntLiteral': {
          // BigInt literal like 0n, 1n, 256n -> uint64(0), uint64(1), uint64(256)
          const val = node.value;
          const numVal = typeof val === 'bigint' ? Number(val) : (val || 0);
          return new GoTypeConversion(GoType.UInt64(), GoLiteral.Int(numVal));
        }

        case 'DataViewCreation': {
          // new DataView(buffer) -> buffer (Go slices are already views)
          const buffer = this.transformExpression(node.buffer || node.arguments?.[0]);
          return buffer;
        }

        case 'DataViewRead': {
          // IL parser may misidentify number.toString(radix) as DataViewRead
          // Detect this: method is 'toString' and offset is the radix argument
          if (node.method === 'toString') {
            this.addImport('fmt');
            const obj = this.transformExpression(node.view);
            const radixVal = node.offset?.value;
            let fmtVerb = '%v';
            if (radixVal === 16) fmtVerb = '%x';
            else if (radixVal === 2) fmtVerb = '%b';
            else if (radixVal === 8) fmtVerb = '%o';
            else if (radixVal === 10) fmtVerb = '%d';
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('fmt'), 'Sprintf'),
              [GoLiteral.String(fmtVerb), obj]
            );
          }
          // dataView.getUint32(offset, littleEndian) -> pack32LE/BE(slice[offset:offset+4])
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const bits = node.bits || 32;
          const littleEndian = node.littleEndian;
          const bytes = bits / 8;
          const endOffset = new GoBinaryExpression(offset, '+', GoLiteral.Int(bytes));
          const slice = new GoSliceExpression(view, offset, endOffset);
          const funcName = bits === 16 ? (littleEndian ? 'pack16LESlice' : 'pack16BESlice') :
                           bits === 64 ? (littleEndian ? 'pack64LESlice' : 'pack64BESlice') :
                                         (littleEndian ? 'pack32LESlice' : 'pack32BESlice');
          return new GoCallExpression(new GoIdentifier(funcName), [slice]);
        }

        case 'DataViewWrite': {
          // dataView.setUint32(offset, value, littleEndian) -> copy(slice[offset:], unpack32LE/BE(value))
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          let value = this.transformExpression(node.value);
          const bits = node.bits || 32;
          const littleEndian = node.littleEndian;
          const funcName = bits === 16 ? (littleEndian ? 'unpack16LE' : 'unpack16BE') :
                           bits === 64 ? (littleEndian ? 'unpack64LE' : 'unpack64BE') :
                                         (littleEndian ? 'unpack32LE' : 'unpack32BE');

          // Add type conversion if value type doesn't match expected type
          if (node.value) {
            const argType = this.inferFullExpressionType(node.value);
            const argTypeStr = argType?.toString() || '';
            const expectedType = bits === 16 ? 'uint16' : bits === 64 ? 'uint64' : 'uint32';
            if (argTypeStr && argTypeStr !== expectedType) {
              const goExpectedType = bits === 16 ? GoType.UInt16() :
                                     bits === 64 ? GoType.UInt64() : GoType.UInt32();
              value = new GoTypeConversion(goExpectedType, value);
            }
          }
          const bytes = new GoCallExpression(new GoIdentifier(funcName), [value]);
          const destSlice = new GoSliceExpression(view, offset, null);
          return new GoCallExpression(new GoIdentifier('copy'), [destSlice, bytes]);
        }

        // IL AST StringInterpolation - `Hello ${name}` -> fmt.Sprintf("Hello %v", name)
        case 'StringInterpolation': {
          this.addImport('fmt');
          let format = '';
          const args = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                format += (part.value || '').replace(/%/g, '%%');
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                format += '%v';
                args.push(this.transformExpression(part.expression));
              }
            }
          }
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('fmt'), 'Sprintf'),
            [GoLiteral.String(format), ...args]
          );
        }

        // IL AST ObjectLiteral - {key: value} -> struct literal or map
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return GoLiteral.Nil();
          // Delegate to transformObjectExpression which handles known struct types
          return this.transformObjectExpression(node, targetType);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> string([]byte{65})
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return GoLiteral.String('');
          if (args.length === 1) {
            // string([]byte{byte(code)})
            return new GoRawCode(`string([]byte{byte(${args[0] ? this._nodeToCode(args[0]) : '0'})})`);
          }
          const bytes = args.map(a => `byte(${a ? this._nodeToCode(a) : '0'})`).join(', ');
          return new GoRawCode(`string([]byte{${bytes}})`);
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> x != nil (Go slices)
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new GoBinaryExpression(value, '!=', GoLiteral.Nil());
        }

        // IL AST ArrowFunction - (x) => expr -> func(x interface{}) interface{} { return expr }
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            // Use pre-set variable type (e.g., from typed reduce/map callbacks) or default to interface{}
            const varType = this.variableTypes.get(name);
            const typeStr = varType ? varType.toString() : 'interface{}';
            return `${name} ${typeStr}`;
          }).join(', ');
          // Determine return type from parameter types (for callbacks with known types)
          const paramTypes = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return this.variableTypes.get(name);
          }).filter(Boolean);
          let bodyCode;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              const block = this.transformBlockStatement(node.body);
              const blockCode = block ? this._nodeToCode(block) : '';
              // Wrap in braces - _nodeToCode on a GoBlock doesn't include { }
              bodyCode = `{\n${blockCode}}`;
            } else {
              // Single expression body
              const bodyType = node.body.type || node.body.ilNodeType;
              if (bodyType === 'AssignmentExpression' && (!node.body.operator || node.body.operator === '=')) {
                // Arrow returning assignment: (x) => x = y  ->  func(x) { x = y; return x }
                const assignExpr = this.transformExpression(node.body);
                const target = this.transformExpression(node.body.left);
                bodyCode = `{\n${this._nodeToCode(assignExpr)}\nreturn ${this._nodeToCode(target)}\n}`;
              } else {
                const expr = this.transformExpression(node.body);
                // If expression is void (GoAssignment from ArrayClear), emit as statement
                if (expr && expr.nodeType === "Assignment") {
                  bodyCode = "{\n" + this._nodeToCode(new GoExpressionStatement(expr)) + "}";
                } else {
                  bodyCode = "{ return " + (expr ? this._nodeToCode(expr) : "nil") + " }";
                }
              }
            }
          } else {
            bodyCode = '{ return nil }';
          }
          const isVoid = node.body && (node.body.type === 'ArrayClear' || node.body.ilNodeType === 'ArrayClear');
          // Use first param type for return type when all params have the same known type
          const knownRetType = paramTypes.length > 0 && paramTypes.every(t => t.toString() === paramTypes[0].toString())
            ? paramTypes[0].toString() : null;
          const retType = isVoid ? '' : (' ' + (knownRetType || 'interface{}'));
          return new GoRawCode(`func(${params})${retType} ${bodyCode}`);
        }

        // IL AST TypeOfExpression - typeof x -> reflect.TypeOf(x).String()
        case 'TypeOfExpression': {
          this.addImport('reflect');
          const value = this.transformExpression(node.argument || node.value);
          return new GoCallExpression(
            new GoSelectorExpression(
              new GoCallExpression(new GoSelectorExpression(new GoIdentifier('reflect'), 'TypeOf'), [value]),
              'String'
            ),
            []
          );
        }

        // IL AST Power - x ** y -> math.Pow(x, y)
        case 'Power': {
          this.addImport('math');
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Pow'),
            [new GoTypeConversion(GoType.Float64(), left), new GoTypeConversion(GoType.Float64(), right)]
          );
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in Go)
        case 'ObjectFreeze': {
          return this.transformExpression(node.value || node.object, targetType);
        }

        // IL AST ObjectSeal - Object.seal(x) -> just return x (no-op in Go)
        case 'ObjectSeal': {
          return this.transformExpression(node.value || node.object, targetType);
        }

        // IL AST ObjectCreate - Object.create(proto) -> map[string]interface{}{}
        case 'ObjectCreate': {
          return new GoCompositeLiteral(
            GoType.Map(GoType.String(), GoType.Interface()),
            []
          );
        }

        // IL AST ObjectMerge - Object.assign(target, ...sources) -> return target (simplified)
        case 'ObjectMerge': {
          return this.transformExpression(node.target);
        }

        // IL AST ObjectHasProperty - Object.hasOwn(obj, prop) -> _, ok := obj[prop]; ok
        case 'ObjectHasProperty': {
          const obj = this.transformExpression(node.object);
          const prop = this.transformExpression(node.property);
          return new GoRawCode(`func() bool { _, ok := ${this._nodeToCode(obj)}[${this._nodeToCode(prop)}]; return ok }()`);
        }

        // IL AST ObjectPropertyNames - Object.getOwnPropertyNames(obj) -> getKeys(obj)
        case 'ObjectPropertyNames': {
          const obj = this.transformExpression(node.object);
          return new GoCallExpression(new GoIdentifier('getKeys'), [obj]);
        }

        // IL AST ObjectFromEntries - Object.fromEntries(entries) -> map from entries
        case 'ObjectFromEntries': {
          const entries = this.transformExpression(node.entries);
          return new GoRawCode(`func() map[string]interface{} { m := make(map[string]interface{}); for _, e := range ${this._nodeToCode(entries)} { m[e[0].(string)] = e[1] }; return m }()`);
        }

        // IL AST ArrayFrom - Array.from(x) -> append([]T{}, x...)
        case 'ArrayFrom': {
          if (node.mapFunction) {
            // Determine element type: prefer targetType from context, then infer from map function
            let elemTypeStr = 'interface{}';

            // If targetType is a slice, use its element type
            if (targetType?.isSlice && targetType.valueType) {
              const targetElemStr = targetType.valueType.toString();
              if (targetElemStr && targetElemStr !== 'interface{}' && targetElemStr !== 'any')
                elemTypeStr = targetElemStr;
            }

            // Otherwise try to infer from the map function's return
            const mapFn = node.mapFunction;
            if (elemTypeStr === 'interface{}' && mapFn) {
              const body = mapFn.body;
              if (body) {
                const retExpr = body.type === 'BlockStatement'
                  ? body.body?.find(s => s.type === 'ReturnStatement')?.argument
                  : body;
                if (retExpr) {
                  const retType = this.inferFullExpressionType(retExpr);
                  const retStr = retType?.toString() || '';
                  if (retStr && retStr !== 'interface{}' && retStr !== 'any')
                    elemTypeStr = retStr;
                }
              }
            }

            // Detect {length: N} pattern: Array.from({length: N}, (_, i) => expr)
            // In Go: func() []T { r := make([]T, N); for i := range r { r[i] = expr }; return r }()
            const iterNode = node.iterable;
            if (iterNode && (iterNode.type === 'ObjectLiteral' || iterNode.type === 'ObjectExpression')) {
              const props = iterNode.properties || [];
              const lengthProp = props.find(p =>
                (p.key === 'length' || p.key?.name === 'length' || p.key?.value === 'length')
              );
              if (lengthProp && props.length === 1) {
                const lengthExpr = this.transformExpression(lengthProp.value);
                const lengthCode = this._nodeToCode(lengthExpr);
                // Get the map function's index parameter name (2nd param)
                const indexParam = mapFn.params?.[1]?.name || 'i';
                // Transform the body using the index variable
                const bodyExpr = mapFn.body?.type === 'BlockStatement'
                  ? mapFn.body.body?.find(s => s.type === 'ReturnStatement')?.argument
                  : mapFn.body;
                if (bodyExpr) {
                  const transformedBody = this.transformExpression(bodyExpr);
                  const bodyCode = this._nodeToCode(transformedBody);
                  return new GoRawCode(`func() []${elemTypeStr} { r := make([]${elemTypeStr}, ${lengthCode}); for ${indexParam} := range r { r[${indexParam}] = ${elemTypeStr}(${bodyCode}) }; return r }()`);
                }
              }
            }

            // General case: Array.from(arr, fn) -> functional map with typed result
            const iterable = this.transformExpression(node.iterable);
            const iterCode = this._nodeToCode(iterable);
            return new GoRawCode(`func() []${elemTypeStr} { var r []${elemTypeStr}; for _, v := range ${iterCode} { r = append(r, ${elemTypeStr}(v)) }; return r }()`);
          }
          const iterable = this.transformExpression(node.iterable);
          const iterCode = this._nodeToCode(iterable);
          return new GoRawCode(`append([]byte{}, ${iterCode}...)`);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> binary.Write
        case 'DataViewWrite': {
          this.addImport('encoding/binary');
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          const order = littleEndian ? 'binary.LittleEndian' : 'binary.BigEndian';
          const viewCode = this._nodeToCode(view);
          const offsetCode = this._nodeToCode(offset);
          const valueCode = this._nodeToCode(value);
          if (method.includes('32'))
            return new GoRawCode(`${order}.PutUint32(${viewCode}[${offsetCode}:], uint32(${valueCode}))`);
          if (method.includes('16'))
            return new GoRawCode(`${order}.PutUint16(${viewCode}[${offsetCode}:], uint16(${valueCode}))`);
          return new GoAssignment(new GoIndexExpression(view, offset), value);
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> binary.Read
        case 'DataViewRead': {
          this.addImport('encoding/binary');
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          const order = littleEndian ? 'binary.LittleEndian' : 'binary.BigEndian';
          const viewCode = this._nodeToCode(view);
          const offsetCode = this._nodeToCode(offset);
          if (method.includes('32') || method.includes('Uint32'))
            return new GoRawCode(`${order}.Uint32(${viewCode}[${offsetCode}:])`);
          if (method.includes('16') || method.includes('Uint16'))
            return new GoRawCode(`${order}.Uint16(${viewCode}[${offsetCode}:])`);
          return new GoIndexExpression(view, offset);
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> int(str[i])
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new GoTypeConversion(new GoType('int'), new GoIndexExpression(str, index));
        }

        // IL AST StringReplace - str.replace(search, replace) -> strings.Replace
        case 'StringReplace': {
          this.addImport('strings');
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue);
          const replace = this.transformExpression(node.replaceValue);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'Replace'),
            [str, search, replace, GoLiteral.Int(-1)]
          );
        }

        // IL AST BufferCreation - new ArrayBuffer(n) -> make([]byte, n)
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new GoMake(new GoType('[]byte'), size);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods
        case 'MathCall': {
          this.addImport('math');
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          if (method === 'imul') {
            // Math.imul(a, b) -> int32(int64(a) * int64(b))
            if (args.length >= 2)
              return new GoRawCode(`int32(int64(${this._nodeToCode(args[0])}) * int64(${this._nodeToCode(args[1])}))`);
          }
          // Default: use math package
          const goMethod = method.charAt(0).toUpperCase() + method.slice(1);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), goMethod),
            args
          );
        }

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> arr[start:end]
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this._transformSliceIndex(node.start, node.array);
          const end = node.end ? this._transformSliceIndex(node.end, node.array) : null;

          return new GoSliceExpression(array, start, end);
        }

        // IL AST StringEndsWith - str.endsWith(suffix) -> strings.HasSuffix(str, suffix)
        case 'StringEndsWith': {
          this.addImport('strings');
          const str = this.transformExpression(node.string || node.object);
          const suffix = this.transformExpression(node.suffix || node.search);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'HasSuffix'),
            [str, suffix]
          );
        }

        // IL AST StringSplit - str.split(delim) -> strings.Split(str, delim)
        case 'StringSplit': {
          this.addImport('strings');
          const str = this.transformExpression(node.string || node.object);
          const separator = node.separator ? this.transformExpression(node.separator) : GoLiteral.String('');
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'Split'),
            [str, separator]
          );
        }

        // IL AST StringStartsWith - str.startsWith(prefix) -> strings.HasPrefix(str, prefix)
        case 'StringStartsWith': {
          this.addImport('strings');
          const str = this.transformExpression(node.string || node.object);
          const prefix = this.transformExpression(node.prefix || node.search);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'HasPrefix'),
            [str, prefix]
          );
        }

        // IL AST StringSubstring - str.substring(start, end) -> str[start:end]
        case 'StringSubstring': {
          const str = this.transformExpression(node.string || node.object);
          const start = node.start ? this.transformExpression(node.start) : null;
          const end = node.end ? this.transformExpression(node.end) : null;
          return new GoSliceExpression(str, start, end);
        }

        // IL AST StringToLowerCase - str.toLowerCase() -> strings.ToLower(str)
        case 'StringToLowerCase': {
          this.addImport('strings');
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'ToLower'),
            [str]
          );
        }

        // IL AST StringToUpperCase - str.toUpperCase() -> strings.ToUpper(str)
        case 'StringToUpperCase': {
          this.addImport('strings');
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'ToUpper'),
            [str]
          );
        }

        // IL AST StringTrim - str.trim() -> strings.TrimSpace(str)
        case 'StringTrim': {
          this.addImport('strings');
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('strings'), 'TrimSpace'),
            [str]
          );
        }

        // IL AST StringConcat - str1.concat(str2, ...) -> str1 + str2 + ...
        case 'StringConcat': {
          const str = this.transformExpression(node.string || node.object);
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return str;
          let result = str;
          for (const arg of args)
            result = new GoBinaryExpression(result, '+', arg);
          return result;
        }

        // IL AST MapCreation - new Map() -> make(map[string]interface{})
        case 'MapCreation': {
          if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
            const kvPairs = node.entries.elements.map(entry => {
              if (entry.elements && entry.elements.length >= 2) {
                const key = this.transformExpression(entry.elements[0]);
                const value = this.transformExpression(entry.elements[1]);
                return new GoKeyValue(key, value || GoLiteral.Nil());
              }
              return null;
            }).filter(p => p !== null);
            return new GoCompositeLiteral(
              GoType.Map(GoType.String(), GoType.Interface()),
              kvPairs
            );
          }
          return new GoMake(new GoType('map[string]interface{}'), null);
        }

        // IL AST MapGet - map.get(key) -> m[key]
        case 'MapGet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new GoIndexExpression(map, key);
        }

        // IL AST MapSet - map.set(key, value) -> m[key] = value
        case 'MapSet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new GoAssignment(new GoIndexExpression(map, key), '=', value);
        }

        // IL AST MapHas - map.has(key) -> _, ok := m[key]; ok pattern
        case 'MapHas': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new GoRawCode(`func() bool { _, ok := ${this._nodeToCode(map)}[${this._nodeToCode(key)}]; return ok }()`);
        }

        // IL AST MapDelete - map.delete(key) -> delete(m, key)
        case 'MapDelete': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new GoCallExpression(new GoIdentifier('delete'), [map, key]);
        }

        // IL AST SetCreation - new Set() -> make(map[T]struct{})
        case 'SetCreation': {
          if (node.values) {
            const values = this.transformExpression(node.values);
            return new GoRawCode(`func() map[interface{}]struct{} { s := make(map[interface{}]struct{}); for _, v := range ${this._nodeToCode(values)} { s[v] = struct{}{} }; return s }()`);
          }
          return new GoMake(new GoType('map[interface{}]struct{}'), null);
        }

        // IL AST CopyArray - [...arr] or Array.from(arr) -> append([]T{}, src...)
        case 'CopyArray': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length >= 1) {
            const src = args[0];
            return new GoRawCode(`append([]byte{}, ${this._nodeToCode(src)}...)`);
          }
          return GoLiteral.Nil();
        }

        // IL AST IsFiniteCheck - Number.isFinite(v) -> !math.IsInf(v, 0) && !math.IsNaN(v)
        case 'IsFiniteCheck': {
          this.addImport('math');
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new GoBinaryExpression(
            new GoUnaryExpression('!', new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('math'), 'IsInf'),
              [value, GoLiteral.Int(0)]
            )),
            '&&',
            new GoUnaryExpression('!', new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('math'), 'IsNaN'),
              [value]
            ))
          );
        }

        // IL AST IsNaNCheck - Number.isNaN(v) -> math.IsNaN(v)
        case 'IsNaNCheck': {
          this.addImport('math');
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'IsNaN'),
            [value]
          );
        }

        // IL AST IsIntegerCheck - Number.isInteger(v) -> v == math.Floor(v)
        case 'IsIntegerCheck': {
          this.addImport('math');
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new GoBinaryExpression(
            value,
            '==',
            new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('math'), 'Floor'),
              [value]
            )
          );
        }

        // IL AST DebugOutput - console.log/warn/error -> fmt.Println(...)
        case 'DebugOutput': {
          this.addImport('fmt');
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          if (args.length === 0)
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('fmt'), 'Println'),
              []
            );
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('fmt'), 'Println'),
            args
          );
        }

        // IL AST Log10 - Math.log10(v) -> math.Log10(v)
        case 'Log10': {
          this.addImport('math');
          const arg = this.transformExpression(node.argument || node.arguments?.[0]);
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('math'), 'Log10'),
            [arg]
          );
        }

        // IL AST ParentMethodCall - super.method(args) -> embedded struct method call
        case 'ParentMethodCall': {
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const methodName = this.toPascalCase(node.method);
          // In Go, parent method calls go through the embedded struct
          if (this.currentStruct) {
            return new GoCallExpression(
              new GoSelectorExpression(
                new GoSelectorExpression(new GoIdentifier(this.currentStruct.name), 'base'),
                methodName
              ),
              args
            );
          }
          // Fallback: call method directly
          return new GoCallExpression(new GoIdentifier(methodName), args);
        }

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
        // Use math.MaxUint32 instead of math.Inf(1) - in crypto code, Infinity is used as
        // a sentinel max value for integer comparisons (e.g., minDistance = Infinity).
        // math.Inf(1) is float64, which causes type mismatches with uint32 variables.
        return new GoTypeConversion(GoType.UInt32(), new GoSelectorExpression(new GoIdentifier('math'), 'MaxUint32'));
      }

      // Rename local variables that shadow Go builtins (e.g., len → length)
      const sanitized = this.sanitizeVarName(name);
      if (sanitized !== name) {
        // Migrate the type mapping to the new name if present
        if (this.variableTypes.has(name)) {
          const existingType = this.variableTypes.get(name);
          this.variableTypes.set(sanitized, existingType);
        }
        name = sanitized;
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
          // Use pre-set variable type (e.g., from typed reduce callbacks) or default to interface{}
          const paramType = this.variableTypes.get(param.name) || GoType.Interface();
          params.push(new GoParameter(param.name, paramType));
        }
      }

      const results = this.inferFunctionReturnType(node);
      const body = this.transformBlockStatement(node.body);

      return new GoFuncLit(params, results, body);
    }

    transformLogicalExpression(node) {
      const operator = node.operator;
      const leftType = this.inferFullExpressionType(node.left);
      const rightType = this.inferFullExpressionType(node.right);
      const leftTypeStr = leftType?.toString() || '';
      const rightTypeStr = rightType?.toString() || '';

      // Check if operands are booleans - use standard Go && and ||
      const leftIsBool = leftTypeStr === 'bool';
      const rightIsBool = rightTypeStr === 'bool';

      if (leftIsBool && rightIsBool) {
        // Both are booleans, standard logical expression
        return this.transformBinaryExpression(node);
      }

      // Non-boolean || - JavaScript short-circuit evaluation
      // a || b means "if a is truthy, return a, else return b"
      if (operator === '||') {
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);

        // For interface{}/any types, check for nil using firstNonNil helper
        if (leftTypeStr === 'any' || leftTypeStr === 'interface{}' ||
            leftTypeStr.startsWith('*') || leftTypeStr.startsWith('[]') ||
            leftTypeStr.startsWith('map')) {
          const call = new GoCallExpression(new GoIdentifier('firstNonNil'), [left, right]);
          // When the operand is a concrete type (slice/map/pointer), add type assertion
          if (leftTypeStr !== 'any' && leftTypeStr !== 'interface{}' && leftType) {
            return new GoTypeAssertion(call, leftType);
          }
          return call;
        }

        // For numeric types, check for non-zero
        if (['int', 'int32', 'int64', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'float64'].includes(leftTypeStr)) {
          // For numbers, treat 0 as falsy - just return left (trusting the pattern)
          return left;
        }

        // Fallback: use firstNonNil helper
        return new GoCallExpression(new GoIdentifier('firstNonNil'), [left, right]);
      }

      // Non-boolean && - JavaScript short-circuit evaluation
      // a && b means "if a is falsy, return a, else return b"
      if (operator === '&&') {
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);

        // For interface{}/any/slice/pointer types with boolean right:
        // Convert to "left != nil && right" for Go-idiomatic boolean expression
        if (leftTypeStr === 'any' || leftTypeStr === 'interface{}' ||
            leftTypeStr.startsWith('*') || leftTypeStr.startsWith('[]')) {
          if (rightIsBool) {
            const nilCheck = new GoBinaryExpression(left, '!=', new GoLiteral(null, 'nil'));
            return new GoBinaryExpression(nilCheck, '&&', right);
          }
          return new GoCallExpression(new GoIdentifier('ifTruthy'), [left, right]);
        }

        // For numeric left with boolean right: convert to "left != 0 && right"
        if (this.isNumericType(leftTypeStr) && rightIsBool) {
          const zeroCheck = new GoBinaryExpression(left, '!=', GoLiteral.Int(0));
          return new GoBinaryExpression(zeroCheck, '&&', right);
        }

        // Fallback: return right (trusting the pattern)
        return right;
      }

      // Other logical operators - delegate to binary expression
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
      // Handle BigInt literals - convert to typed uint64/int64 value
      // Pass BigInt directly to GoLiteral.Hex to preserve full 64-bit precision
      // (avoids Number() which silently truncates values > 2^53)
      if (typeof node.value === 'bigint') {
        const lit = GoLiteral.Hex(node.value, 64);
        return new GoTypeConversion(GoType.UInt64(), lit);
      }
      // Handle undefined - treat same as nil in Go
      if (node.value === undefined) {
        return GoLiteral.Nil();
      }

      return GoLiteral.Nil();
    }

    transformBinaryExpression(node) {
      let operator = node.operator;

      // Map JavaScript operators to Go operators
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle typeof comparisons: typeof x === "string" -> isTypeString(x)
      // This needs to come early before we transform left/right
      const isTypeofLeft = (node.left.type === 'UnaryExpression' && node.left.operator === 'typeof') ||
                           (node.left.type === 'TypeOfExpression' || node.left.ilNodeType === 'TypeOfExpression');
      const isStringRight = (node.right.type === 'Literal' && typeof node.right.value === 'string');
      if ((operator === '==' || operator === '!=') && isTypeofLeft && isStringRight) {
        const typeStr = node.right.value;
        // IL TypeOfExpression uses 'argument', JS UnaryExpression uses 'argument' too
        const argNode = node.left.argument || node.left.value;
        const variable = argNode ? this.transformExpression(argNode) : new GoIdentifier('nil');

        // Map JavaScript type names to Go type check helper functions
        const typeCheckMap = {
          'string': 'isTypeString',
          'number': 'isTypeNumber',
          'boolean': 'isTypeBool',
          'object': 'isTypeObject',
          'undefined': 'isTypeNil',
          'function': 'isTypeFunc'
        };

        const helperName = typeCheckMap[typeStr];
        if (helperName) {
          const typeCheck = new GoCallExpression(new GoIdentifier(helperName), [variable]);
          if (operator === '!=') {
            // typeof x !== "string" -> !isTypeString(x)
            return new GoUnaryExpression('!', typeCheck);
          }
          return typeCheck;
        }
      }

      // Handle 'in' operator: key in object -> func() bool { _, ok := object[key]; return ok }()
      if (operator === 'in') {
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);
        return new GoRawCode(`func() bool { _, ok := ${this._nodeToCode(right)}[${this._nodeToCode(left)}]; return ok }()`);
      }

      // Handle >>> (unsigned right shift) - Go doesn't have it directly
      if (operator === '>>>') {
        // In Go, use regular >> on uint32
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);

        // Cast to uint32, shift, result is uint32
        const leftCasted = new GoTypeConversion(GoType.UInt32(), left);
        return new GoBinaryExpression(leftCasted, '>>', right);
      }

      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Get types of both operands (with Go-side variable type fallback)
      let leftType = this.inferFullExpressionType(node.left);
      let rightType = this.inferFullExpressionType(node.right);
      let leftTypeStr = leftType?.toString() || '';
      let rightTypeStr = rightType?.toString() || '';
      // If IL inference returns any/interface{}/empty, try Go-side variable types
      const _needsFallback = t => !t || t === 'any' || t === 'interface{}';
      if (_needsFallback(leftTypeStr)) {
        const _name = node.left?.type === 'Identifier' ? node.left.name
                    : (node.left?.type === 'MemberExpression' && node.left.property?.name) ? node.left.property.name
                    : null;
        const goVarType = _name ? this.variableTypes.get(_name) : null;
        if (goVarType && !_needsFallback(goVarType.toString())) {
          leftType = goVarType;
          leftTypeStr = goVarType.toString();
        }
      }
      if (_needsFallback(rightTypeStr)) {
        const _name = node.right?.type === 'Identifier' ? node.right.name
                    : (node.right?.type === 'MemberExpression' && node.right.property?.name) ? node.right.property.name
                    : null;
        const goVarType = _name ? this.variableTypes.get(_name) : null;
        if (goVarType && !_needsFallback(goVarType.toString())) {
          rightType = goVarType;
          rightTypeStr = goVarType.toString();
        }
      }

      // Check for int/uint32 mismatch which is common with len() and struct fields
      // len() returns int, but BlockSize/ROUNDS etc are uint32
      const ARITHMETIC_OPS = ['+', '-', '*', '/', '%', '+=', '-=', '*=', '/=', '%='];
      const COMPARISON_OPS = ['<', '>', '<=', '>=', '==', '!='];
      const BITWISE_OPS = ['&', '|', '^', '&^', '<<', '>>', '&=', '|=', '^='];

      // In Go, bare numeric literals (0, 1, 0xFF, etc.) are untyped constants that
      // automatically match any numeric type. Never wrap them with type conversions
      // as that creates typed constants causing mismatches (e.g., uint32 vs int(0)).
      // Bare numeric literals include decimal (0, 1, 255) and hex (0xFF, 0x1234) forms
      const isLeftBareNumericLiteral = left?.nodeType === 'Literal' && (left.literalType === 'int' || left.literalType === 'uint32' || left.literalType === 'float64' || left.literalType === 'uint64');
      const isRightBareNumericLiteral = right?.nodeType === 'Literal' && (right.literalType === 'int' || right.literalType === 'uint32' || right.literalType === 'float64' || right.literalType === 'uint64');


      if (ARITHMETIC_OPS.includes(operator) || COMPARISON_OPS.includes(operator) || BITWISE_OPS.includes(operator)) {
        // Check if we need type coercion
        const isLenCall = node.left.type === 'CallExpression' &&
                          node.left.callee?.name === 'len';
        const isRightUint32 = rightTypeStr === 'uint32';
        const isLeftUint32 = leftTypeStr === 'uint32';
        const isLeftInt = leftTypeStr === 'int';
        const isRightInt = rightTypeStr === 'int';

        // If left is len() (returns int) and right is uint32, cast right to int
        if (isLenCall && isRightUint32) {
          right = new GoTypeConversion(new GoType('int'), right);
        }
        // Check opposite case
        const isRightLenCall = node.right.type === 'CallExpression' &&
                               node.right.callee?.name === 'len';

        if (isRightLenCall && isLeftUint32) {
          left = new GoTypeConversion(new GoType('int'), left);
        }

        // Also handle ArrayLength node type
        if (node.left.type === 'ArrayLength' && isRightUint32) {
          right = new GoTypeConversion(new GoType('int'), right);
        }
        if (node.right.type === 'ArrayLength' && isLeftUint32) {
          left = new GoTypeConversion(new GoType('int'), left);
        }

        // General int/uint32 mismatch handling (e.g., loop var + struct field)
        // For bitwise ops, cast int to uint32 (crypto uses unsigned)
        // For other ops, cast uint32 to int to match Go's len() return type convention
        // IMPORTANT: Never wrap bare numeric literals - they are untyped constants in Go
        const isBitwise = BITWISE_OPS.includes(operator);
        if (isLeftInt && isRightUint32) {
          if (isBitwise) {
            if (!isLeftBareNumericLiteral) left = new GoTypeConversion(GoType.UInt32(), left);
          } else {
            if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int'), right);
          }
        }
        if (isRightInt && isLeftUint32) {
          if (isBitwise) {
            if (!isRightBareNumericLiteral) right = new GoTypeConversion(GoType.UInt32(), right);
          } else {
            if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int'), left);
          }
        }

        // int/uint8 mismatch handling (common with S-box access and loop variables)
        const isLeftUint8 = leftTypeStr === 'uint8';
        const isRightUint8 = rightTypeStr === 'uint8';
        if (isLeftInt && isRightUint8) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int'), right);
        }
        if (isRightInt && isLeftUint8) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int'), left);
        }

        // uint32/uint8 mismatch handling
        if (isLeftUint32 && isRightUint8) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(GoType.UInt32(), right);
        }
        if (isRightUint32 && isLeftUint8) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(GoType.UInt32(), left);
        }

        // int32/uint32 mismatch handling (common with S-box lookups and arithmetic)
        const isLeftInt32 = leftTypeStr === 'int32';
        const isRightInt32 = rightTypeStr === 'int32';
        if (isLeftInt32 && isRightUint32) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(GoType.UInt32(), left);
        }
        if (isRightInt32 && isLeftUint32) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(GoType.UInt32(), right);
        }
        // int32/int mismatch handling
        if (isLeftInt32 && isRightInt) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int32'), right);
        }
        if (isRightInt32 && isLeftInt) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int32'), left);
        }

        // int/uint16 mismatch handling (common with len() and blockSize fields)
        const isLeftUint16 = leftTypeStr === 'uint16';
        const isRightUint16 = rightTypeStr === 'uint16';
        if (isLeftInt && isRightUint16) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int'), right);
        }
        if (isRightInt && isLeftUint16) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int'), left);
        }

        // uint32/uint16 mismatch handling
        if (isLeftUint32 && isRightUint16) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(GoType.UInt32(), right);
        }
        if (isRightUint32 && isLeftUint16) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(GoType.UInt32(), left);
        }

        // uint16/uint8 mismatch handling
        if (isLeftUint16 && isRightUint8) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('uint16'), right);
        }
        if (isRightUint16 && isLeftUint8) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('uint16'), left);
        }

        // int32/uint8 mismatch handling
        if (isLeftInt32 && isRightUint8) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int32'), right);
        }
        if (isRightInt32 && isLeftUint8) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int32'), left);
        }

        // int32/uint16 mismatch handling
        if (isLeftInt32 && isRightUint16) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int32'), right);
        }
        if (isRightInt32 && isLeftUint16) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int32'), left);
        }

        // float64/uint8 mismatch handling
        const isLeftFloat64 = leftTypeStr === 'float64';
        const isRightFloat64 = rightTypeStr === 'float64';
        if (isLeftFloat64 && isRightUint8) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('float64'), right);
        }
        if (isRightFloat64 && isLeftUint8) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('float64'), left);
        }

        // float64/int mismatch handling
        if (isLeftFloat64 && isRightInt) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('float64'), right);
        }
        if (isRightFloat64 && isLeftInt) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('float64'), left);
        }

        // float64/int32 mismatch handling
        if (isLeftFloat64 && isRightInt32) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('float64'), right);
        }
        if (isRightFloat64 && isLeftInt32) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('float64'), left);
        }

        // float64/uint32 mismatch handling
        if (isLeftFloat64 && isRightUint32) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('float64'), right);
        }
        if (isRightFloat64 && isLeftUint32) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('float64'), left);
        }

        // float64/uint16 mismatch handling
        if (isLeftFloat64 && isRightUint16) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('float64'), right);
        }
        if (isRightFloat64 && isLeftUint16) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('float64'), left);
        }

        // 64-bit integer mismatch handling (common in RNG/PRF algorithms)
        const isLeftUint64 = leftTypeStr === 'uint64';
        const isRightUint64 = rightTypeStr === 'uint64';
        const isLeftInt64 = leftTypeStr === 'int64';
        const isRightInt64 = rightTypeStr === 'int64';
        // uint32/uint64 mismatch
        if (isLeftUint32 && isRightUint64) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('uint64'), left);
        }
        if (isRightUint32 && isLeftUint64) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('uint64'), right);
        }
        // int/uint64 mismatch
        if (isLeftInt && isRightUint64) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('uint64'), left);
        }
        if (isRightInt && isLeftUint64) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('uint64'), right);
        }
        // int64/uint64 mismatch
        if (isLeftInt64 && isRightUint64) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('uint64'), left);
        }
        if (isRightInt64 && isLeftUint64) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('uint64'), right);
        }
        // uint64/int mismatch
        if (isLeftUint64 && isRightInt) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('uint64'), right);
        }
        if (isRightUint64 && isLeftInt) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('uint64'), left);
        }
        // uint8/uint64 mismatch
        if (isLeftUint8 && isRightUint64) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('uint64'), left);
        }
        if (isRightUint8 && isLeftUint64) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('uint64'), right);
        }
        // int32/uint64 mismatch
        if (isLeftInt32 && isRightUint64) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('uint64'), left);
        }
        if (isRightInt32 && isLeftUint64) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('uint64'), right);
        }
        // uint8/int64 mismatch
        if (isLeftUint8 && isRightInt64) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int64'), left);
        }
        if (isRightUint8 && isLeftInt64) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int64'), right);
        }
        // int/int64 mismatch
        if (isLeftInt && isRightInt64 && !isBitwise) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int64'), left);
        }
        if (isRightInt && isLeftInt64 && !isBitwise) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int64'), right);
        }
        // uint32/int64 mismatch
        if (isLeftUint32 && isRightInt64) {
          if (!isLeftBareNumericLiteral) left = new GoTypeConversion(new GoType('int64'), left);
        }
        if (isRightUint32 && isLeftInt64) {
          if (!isRightBareNumericLiteral) right = new GoTypeConversion(new GoType('int64'), right);
        }

        // interface{}/any with concrete type - add type assertion
        // This handles cases like: uint32_var % config["modulo"]
        // BUT: literals don't need type assertions - they're auto-typed
        // AND: binary expressions that already have type assertions don't need another one
        const isLeftInterface = leftTypeStr === 'interface{}' || leftTypeStr === 'any';
        const isRightInterface = rightTypeStr === 'interface{}' || rightTypeStr === 'any';
        const isLeftLiteral = left.nodeType === 'Literal';
        const isRightLiteral = right.nodeType === 'Literal';
        // Don't add type assertions to binary expressions - they're already typed from their operands
        const isLeftBinary = left.nodeType === 'BinaryExpression';
        const isRightBinary = right.nodeType === 'BinaryExpression';
        const concreteTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                               'uint', 'uint8', 'uint16', 'uint32', 'uint64',
                               'float32', 'float64'];

        // If right is interface{} and left is concrete, assert right to left's type
        // But don't add type assertion to literals or already-processed binary expressions
        if (isRightInterface && !isRightLiteral && !isRightBinary && concreteTypes.includes(leftTypeStr)) {
          right = this.safeTypeAssertion(right, leftType);
        }
        // If left is interface{} and right is concrete, assert left to right's type
        // But don't add type assertion to literals or already-processed binary expressions
        if (isLeftInterface && !isLeftLiteral && !isLeftBinary && concreteTypes.includes(rightTypeStr)) {
          left = this.safeTypeAssertion(left, rightType);
        }
      }

      return new GoBinaryExpression(left, operator, right);
    }

    transformUnaryExpression(node) {
      // Handle -Infinity specially: emit uint32(0) as minimum sentinel value
      // In crypto code, -Infinity is used as a sentinel for "minimum possible value"
      // in integer comparison patterns (e.g., maxCorr = -Infinity).
      if (node.operator === '-' && node.argument &&
          node.argument.type === 'Identifier' && node.argument.name === 'Infinity') {
        return new GoTypeConversion(GoType.UInt32(), GoLiteral.Int(0));
      }

      const operand = this.transformExpression(node.argument);

      // Handle ++ and -- operators (prefix increment/decrement parsed as UnaryExpression)
      // In expression context, use helper function to return the new value
      if (node.operator === '++' || node.operator === '--') {
        // Prefix increment/decrement: increment first, then return new value
        const addrOf = new GoUnaryExpression('&', operand);
        const helperName = this._getIncrDecrHelper(node.argument, true, node.operator === '++');
        return new GoCallExpression(new GoIdentifier(helperName), [addrOf]);
      }

      // Handle ! operator
      if (node.operator === '!') {
        // If operand is a boolean literal, just return the opposite literal
        if (operand.nodeType === 'Literal' && operand.literalType === 'bool') {
          return GoLiteral.Bool(!operand.value);
        }

        // If operand is already a Go boolean expression (comparison/logical), negate it directly
        // This prevents generating `(data != nil) == nil` from `!Array.isArray(data)`
        if (operand.nodeType === 'BinaryExpression') {
          const compOps = ['==', '!=', '<', '>', '<=', '>='];
          const logicalOps = ['&&', '||'];
          if (compOps.includes(operand.operator)) {
            // Flip the comparison operator: != becomes ==, < becomes >=, etc.
            const flipMap = { '==': '!=', '!=': '==', '<': '>=', '>': '<=', '<=': '>', '>=': '<' };
            return new GoBinaryExpression(operand.left, flipMap[operand.operator], operand.right);
          }
          if (logicalOps.includes(operand.operator)) {
            // !(a && b) -> use !(expr) with parentheses
            return new GoUnaryExpression('!', operand);
          }
        }

        // If operand is already a unary ! expression, double negation cancels out
        if (operand.nodeType === 'UnaryExpression' && operand.operator === '!') {
          return operand.operand;
        }

        // In JavaScript, !data checks for falsy; in Go, must use comparisons based on type
        const operandType = this.inferFullExpressionType(node.argument);
        const typeStr = operandType?.toString() || '';

        // Check if type is any, interface{}, slice, map, or pointer type (which can be nil-checked)
        if (typeStr === 'any' || typeStr === 'interface{}' ||
            typeStr.startsWith('*') || typeStr.startsWith('[]') ||
            typeStr.startsWith('map[')) {
          return new GoBinaryExpression(operand, '==', GoLiteral.Nil());
        }

        // For numeric types, compare to 0
        const numericTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                              'uint', 'uint8', 'uint16', 'uint32', 'uint64',
                              'float32', 'float64', 'byte', 'rune'];
        if (numericTypes.includes(typeStr)) {
          return new GoBinaryExpression(operand, '==', GoLiteral.Int(0));
        }

        // For string types, compare to empty string
        if (typeStr === 'string') {
          return new GoBinaryExpression(operand, '==', GoLiteral.String(''));
        }

        // For bool type, use standard !
        if (typeStr === 'bool') {
          return new GoUnaryExpression('!', operand);
        }

        // For unknown types, try to check for nil (safer than ! operator)
        // This handles cases where type inference failed but it's actually a nullable type
        return new GoBinaryExpression(operand, '==', GoLiteral.Nil());
      }

      // Handle typeof operator - in Go, use reflect.TypeOf().Kind()
      // Standalone typeof is rare (usually in comparisons handled by transformBinaryExpression)
      // For standalone use, return reflect.TypeOf(x).Kind().String()
      if (node.operator === 'typeof') {
        this.addImport('reflect');
        // Build: reflect.TypeOf(operand).Kind().String()
        const typeOfCall = new GoCallExpression(
          new GoSelectorExpression(new GoIdentifier('reflect'), 'TypeOf'),
          [operand]
        );
        const kindCall = new GoCallExpression(
          new GoSelectorExpression(typeOfCall, 'Kind'),
          []
        );
        return new GoCallExpression(
          new GoSelectorExpression(kindCall, 'String'),
          []
        );
      }

      // Handle bitwise NOT operator - JavaScript uses ~ but Go uses ^
      if (node.operator === '~') {
        return new GoUnaryExpression('^', operand);
      }

      return new GoUnaryExpression(node.operator, operand);
    }

    transformUpdateExpression(node, isStatementContext = false) {
      // ++i or i++ (and --i or i--)
      // In Go, ++ and -- are statements, not expressions. When used in expression
      // context (array index, function arg), we need to use helper functions that
      // return the value while performing the side effect.
      const operand = this.transformExpression(node.argument);

      // For statement context (for loop post, standalone expression statement),
      // use simple assignment: i += 1 or i -= 1
      if (isStatementContext) {
        const one = GoLiteral.Int(1);
        if (node.operator === '++') {
          return new GoAssignment([operand], '+=', [one]);
        } else {
          return new GoAssignment([operand], '-=', [one]);
        }
      }

      // For expression context, use helper function with pointer
      // postIncrInt(&i) returns old value, then increments
      // preIncrInt(&i) increments, then returns new value
      const addrOf = new GoUnaryExpression('&', operand);
      const isPrefix = node.prefix === true;
      const isIncrement = node.operator === '++';
      const helperName = this._getIncrDecrHelper(node.argument, isPrefix, isIncrement);

      return new GoCallExpression(new GoIdentifier(helperName), [addrOf]);
    }

    transformAssignmentExpression(node) {
      // Handle array.length = N -> arr = arr[:N] (or arr[:0] for length = 0)
      const leftType = node.left?.type || node.left?.ilNodeType;
      if (leftType === 'ArrayLength' && node.operator === '=') {
        const arrNode = node.left.array || node.left.argument;
        const arr = this.transformExpression(arrNode);
        const newLen = this.transformExpression(node.right);
        // arr.length = 0 -> arr = arr[:0]
        // arr.length = N -> arr = arr[:N]
        return new GoAssignment([arr], '=', [new GoSliceExpression(arr, null, newLen)]);
      }
      // Handle assignment to .length via MemberExpression with property 'length'
      if (node.left?.type === 'MemberExpression' && node.operator === '=' &&
          (node.left.property === 'length' || node.left.property?.name === 'length')) {
        const arr = this.transformExpression(node.left.object);
        const newLen = this.transformExpression(node.right);
        return new GoAssignment([arr], '=', [new GoSliceExpression(arr, null, newLen)]);
      }

      // Handle chained assignments: a = b = c = 0 -> split into: c = 0; b = 0; a = 0
      if (node.right && node.right.type === 'AssignmentExpression' && node.operator === '=') {
        const assignments = [];
        let current = node;
        const targets = [];
        while (current && current.type === 'AssignmentExpression' && current.operator === '=') {
          targets.push(current.left);
          current = current.right;
        }
        // current is now the final value; targets are in order [a, b, c] for a = b = c = val
        const finalValue = current;
        // Assign in reverse: c = val, b = val, a = val
        const stmts = [];
        for (let i = targets.length - 1; i >= 0; --i) {
          stmts.push(new GoExpressionStatement(this.transformAssignmentExpression({
            type: 'AssignmentExpression',
            operator: '=',
            left: targets[i],
            right: finalValue
          })));
        }
        // Return as a block of statements
        return new GoBlock(stmts);
      }

      const target = this.transformExpression(node.left);

      // Infer target type for proper array literal typing
      let targetType = null;
      if (node.left.type === 'ThisPropertyAccess' || node.left.type === 'MemberExpression') {
        // Check if this is an indexed access (slice element assignment)
        if (node.left.computed) {
          // Get the slice type and extract element type
          const sliceType = this.inferFullExpressionType(node.left.object);
          if (sliceType && sliceType.isSlice) {
            targetType = sliceType.valueType || sliceType.elementType;
          }
        } else {
          const propName = node.left.property?.name || node.left.property;
          if (propName) {
            targetType = this.structFieldTypes.get(propName) ||
                         this.structFieldTypes.get(this.toPascalCase(propName));
          }
        }
      } else if (node.left.type === 'Identifier') {
        targetType = this.variableTypes.get(node.left.name);
      }

      let value = this.transformExpression(node.right, targetType);

      // Replace nil with zero value when assigning to non-nilable types
      if (node.operator === '=' && targetType) {
        const isNil = (node.right?.value === null) ||
                      (value?.nodeType === 'Literal' && value?.value === null);
        if (isNil) {
          const tStr = targetType.toString();
          if (this.isNumericType(tStr))
            value = GoLiteral.Int(0);
          else if (tStr === 'string')
            value = GoLiteral.String('');
          else if (tStr === 'bool')
            value = new GoLiteral(false, 'false');
        }
      }

      // Add type conversion for simple '=' assignments if types don't match
      if (node.operator === '=' && targetType) {
        const valueType = this.inferFullExpressionType(node.right);
        const targetTypeStr = targetType?.toString() || '';
        const valueTypeStr = valueType?.toString() || '';
        const numericTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                              'uint', 'uint8', 'uint16', 'uint32', 'uint64',
                              'float32', 'float64'];
        if (targetTypeStr !== valueTypeStr &&
            numericTypes.includes(targetTypeStr) && numericTypes.includes(valueTypeStr)) {
          value = new GoTypeConversion(targetType, value);
        }
        // Add type assertion when assigning interface{} to a concrete type
        if ((valueTypeStr === 'interface{}' || valueTypeStr === 'any') &&
            targetTypeStr && targetTypeStr !== 'interface{}' && targetTypeStr !== 'any') {
          value = this.safeTypeAssertion(value, targetType);
        }
        // Add slice conversion when assigning method call results: []uint32 -> []uint8
        // Only for method calls (e.g., c.Decode(data)), not for make() or literal expressions
        if (valueTypeStr === '[]uint32' && targetTypeStr === '[]uint8' &&
            (node.right?.type === 'ThisMethodCall' || node.right?.type === 'CallExpression' ||
             (node.right?.type === 'MemberExpression' && node.right?.computed))) {
          value = new GoCallExpression(new GoIdentifier('uint32SliceToBytes'), [value]);
          this._needsUint32SliceToBytes = true;
        }
      }

      // Check for compound assignment with type mismatch (e.g., i += t.BlockSize where i is int and BlockSize is uint32)
      const COMPOUND_OPS = ['+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='];
      if (COMPOUND_OPS.includes(node.operator)) {
        let leftType = this.inferFullExpressionType(node.left);
        let rightType = this.inferFullExpressionType(node.right);
        let leftTypeStr = leftType?.toString() || '';
        let rightTypeStr = rightType?.toString() || '';
        // If IL inference returns any/interface{}, try Go-side variable types
        if ((leftTypeStr === 'any' || leftTypeStr === 'interface{}') && node.left?.type === 'Identifier') {
          const goVarType = this.variableTypes.get(node.left.name);
          if (goVarType && goVarType.toString() !== 'any' && goVarType.toString() !== 'interface{}') {
            leftType = goVarType; leftTypeStr = goVarType.toString();
          }
        }
        if ((rightTypeStr === 'any' || rightTypeStr === 'interface{}') && node.right?.type === 'Identifier') {
          const goVarType = this.variableTypes.get(node.right.name);
          if (goVarType && goVarType.toString() !== 'any' && goVarType.toString() !== 'interface{}') {
            rightType = goVarType; rightTypeStr = goVarType.toString();
          }
        }

        // Handle interface{}/any on right side - need type assertion to match left type
        if ((rightTypeStr === 'interface{}' || rightTypeStr === 'any') && leftTypeStr && leftTypeStr !== 'interface{}' && leftTypeStr !== 'any') {
          value = this.safeTypeAssertion(value, leftType);
        }
        // If left is int (common for loop vars) and right is uint32, cast right to int
        else if (leftTypeStr === 'int' && rightTypeStr === 'uint32') {
          value = new GoTypeConversion(new GoType('int'), value);
        }
        // If left is uint32 and right is int, cast right to uint32
        else if (leftTypeStr === 'uint32' && rightTypeStr === 'int') {
          value = new GoTypeConversion(GoType.UInt32(), value);
        }
        // If left is uint32 and right is uint8 (e.g., sum += data[i]), cast right to uint32
        else if (leftTypeStr === 'uint32' && rightTypeStr === 'uint8') {
          value = new GoTypeConversion(GoType.UInt32(), value);
        }
        // If left is uint32 and right is uint16, cast right to uint32
        else if (leftTypeStr === 'uint32' && rightTypeStr === 'uint16') {
          value = new GoTypeConversion(GoType.UInt32(), value);
        }
        // If left is uint32 and right is int32, cast right to uint32
        else if (leftTypeStr === 'uint32' && rightTypeStr === 'int32') {
          value = new GoTypeConversion(GoType.UInt32(), value);
        }
        // If left is int32 and right is uint32, cast right to int32
        else if (leftTypeStr === 'int32' && rightTypeStr === 'uint32') {
          value = new GoTypeConversion(new GoType('int32'), value);
        }
        // If left is int and right is uint8/uint16, cast right to int
        else if (leftTypeStr === 'int' && (rightTypeStr === 'uint8' || rightTypeStr === 'uint16')) {
          value = new GoTypeConversion(new GoType('int'), value);
        }
        // If left is uint64 and right is smaller unsigned type, cast right to uint64
        else if (leftTypeStr === 'uint64' && ['uint8', 'uint16', 'uint32', 'int'].includes(rightTypeStr)) {
          value = new GoTypeConversion(GoType.UInt64(), value);
        }
        // If left is int64 and right is smaller type, cast right to int64
        else if (leftTypeStr === 'int64' && ['int8', 'int16', 'int32', 'int', 'uint8', 'uint16'].includes(rightTypeStr)) {
          value = new GoTypeConversion(new GoType('int64'), value);
        }
        // If left is uint8 and right is uint32/int/int32, cast right to uint8
        else if (leftTypeStr === 'uint8' && ['uint32', 'int', 'int32', 'uint16'].includes(rightTypeStr)) {
          value = new GoTypeConversion(GoType.UInt8(), value);
        }
        // If left is uint16 and right is uint32/int/int32, cast right to uint16
        else if (leftTypeStr === 'uint16' && ['uint32', 'int', 'int32'].includes(rightTypeStr)) {
          value = new GoTypeConversion(GoType.UInt16(), value);
        }
        // General: cast right to left type for any remaining numeric mismatches
        else if (leftTypeStr !== rightTypeStr) {
          const _numericSet = new Set(['int', 'int8', 'int16', 'int32', 'int64',
                                       'uint', 'uint8', 'uint16', 'uint32', 'uint64',
                                       'float32', 'float64']);
          if (_numericSet.has(leftTypeStr) && _numericSet.has(rightTypeStr))
            value = new GoTypeConversion(leftType, value);
        }
      }

      // Add type assertion when assigning interface{} to typed variable
      if (node.operator === '=') {
        let rightType = this.inferFullExpressionType(node.right);
        let rightTypeStr = rightType?.toString() || '';
        // If IL inference returns any/interface{}, try Go-side variable types
        if ((rightTypeStr === 'any' || rightTypeStr === 'interface{}') && node.right?.type === 'Identifier') {
          const goVarType = this.variableTypes.get(node.right.name);
          if (goVarType && goVarType.toString() !== 'any' && goVarType.toString() !== 'interface{}') {
            rightType = goVarType; rightTypeStr = goVarType.toString();
          }
        }

        if (rightTypeStr === 'interface{}' || rightTypeStr === 'any') {
          // Check if target has a known type
          if (targetType && targetType.toString() !== 'interface{}' && targetType.toString() !== 'any') {
            // Don't add type assertion if value is already a type conversion to the correct type
            const isAlreadyConverted = value.nodeType === 'TypeConversion' &&
                                       value.type?.toString() === targetType.toString();
            // Don't add type assertion if value is a nil literal
            const isNilLiteral = value.nodeType === 'Literal' && value.value === null;
            if (!isAlreadyConverted && !isNilLiteral) {
              value = this.safeTypeAssertion(value, targetType);
            }
          }
        }

        // Handle int/uint32 type mismatch for regular assignments
        // e.g., j = uint32(expr) & 255 where j is int
        if (targetType && rightType) {
          const targetTypeStr = targetType.toString();
          if (targetTypeStr === 'int' && rightTypeStr === 'uint32') {
            value = new GoTypeConversion(new GoType('int'), value);
          } else if (targetTypeStr === 'uint32' && rightTypeStr === 'int') {
            value = new GoTypeConversion(GoType.UInt32(), value);
          }
        }
      }

      // Handle >>>= (unsigned right shift assignment) - Go doesn't have this operator
      // Convert x >>>= n to x = uint32(x) >> n
      if (node.operator === '>>>=') {
        const leftCasted = new GoTypeConversion(GoType.UInt32(), target);
        const shiftExpr = new GoBinaryExpression(leftCasted, '>>', value);
        return new GoAssignment([target], '=', [shiftExpr]);
      }

      // Handle <<= and >>= similarly (standard shift assignments are valid in Go)
      // Just pass them through

      return new GoAssignment([target], node.operator, [value]);
    }

    transformMemberExpression(node) {
      // Handle framework enum types - CategoryType.BLOCK -> CategoryBlock
      const FRAMEWORK_ENUMS = {
        'CategoryType': 'Category',
        'SecurityStatus': 'Security',
        'ComplexityType': 'Complexity',
        'CountryCode': 'Country'
      };

      // Map full country names to ISO codes
      const COUNTRY_NAME_TO_ISO = {
        'SINGAPORE': 'SG',
        'UNITED_STATES': 'US',
        'UNITED_KINGDOM': 'GB',
        'GERMANY': 'DE',
        'FRANCE': 'FR',
        'JAPAN': 'JP',
        'CHINA': 'CN',
        'RUSSIA': 'RU',
        'ISRAEL': 'IL',
        'BELGIUM': 'BE',
        'SOUTH_KOREA': 'KR',
        'KOREA': 'KR',
        'SWITZERLAND': 'CH',
        'AUSTRALIA': 'AU',
        'NETHERLANDS': 'NL',
        'AUSTRIA': 'AT',
        'CANADA': 'CA',
        'SWEDEN': 'SE',
        'NORWAY': 'NO',
        'DENMARK': 'DK',
        'FINLAND': 'FI',
        'INDIA': 'IN',
        'BRAZIL': 'BR',
        'ITALY': 'IT',
        'UKRAINE': 'UA',
        'POLAND': 'PL',
        'SPAIN': 'ES',
        'PORTUGAL': 'PT',
        'MEXICO': 'MX',
        'ARGENTINA': 'AR',
        'INTERNATIONAL': 'INTL',
        'MULTI': 'INTL',
        'INT': 'INTL',
        'MULTINATIONAL': 'INTL',
        'ANCIENT': 'ANCIENT',
        'UNKNOWN': 'UNKNOWN'
      };

      // Helper to process enum access and return the identifier
      const processEnumAccess = (enumTypeName, enumValue) => {
        this.enumsUsed.add(enumTypeName);
        const prefix = FRAMEWORK_ENUMS[enumTypeName];
        // Convert BLOCK -> Block, CHECKSUM -> Checksum, but keep US/GB etc for country codes
        let suffix;
        if (enumTypeName === 'CountryCode') {
          const upperValue = enumValue.toUpperCase();
          // Map full country names to ISO codes, or keep as-is if already ISO
          suffix = COUNTRY_NAME_TO_ISO[upperValue] || upperValue;
        } else {
          // Convert BLOCK -> Block, EDUCATIONAL -> Educational
          suffix = enumValue.charAt(0).toUpperCase() + enumValue.slice(1).toLowerCase();
          // Handle special cases where UPPERCASE -> specific mapping
          if (enumValue === 'MAC') suffix = 'MAC';
          if (enumValue === 'KDF') suffix = 'KDF';
          if (enumValue === 'PQC') suffix = 'Pqc';
          if (enumValue === 'ECC') suffix = 'Ecc';
          // CategoryType: MODE (singular) maps to Modes (plural) enum constant
          if (enumTypeName === 'CategoryType' && enumValue === 'MODE') suffix = 'Modes';
          if (enumTypeName === 'CategoryType' && enumValue === 'PADDING_MODES') suffix = 'Padding';
          // SecurityStatus: INSECURE maps to Broken
          if (enumTypeName === 'SecurityStatus' && enumValue === 'INSECURE') suffix = 'Broken';
          // ComplexityType: BASIC/SIMPLE/LOW map to Beginner, MEDIUM to Intermediate, HIGH to Advanced
          if (enumTypeName === 'ComplexityType' && (enumValue === 'BASIC' || enumValue === 'SIMPLE' || enumValue === 'LOW')) suffix = 'Beginner';
          if (enumTypeName === 'ComplexityType' && enumValue === 'MEDIUM') suffix = 'Intermediate';
          if (enumTypeName === 'ComplexityType' && enumValue === 'HIGH') suffix = 'Advanced';
          if (enumTypeName === 'ComplexityType' && enumValue === 'ELEMENTARY') suffix = 'Beginner';
          if (enumTypeName === 'ComplexityType' && enumValue === 'TRIVIAL') suffix = 'Beginner';
        }
        return new GoIdentifier(prefix + suffix);
      };

      // Strip global/globalThis/window prefix: global.X -> X
      // Only for non-computed access (global.X, not window[idx] which may be a local array)
      if (!node.computed && node.object.type === 'Identifier' &&
          (node.object.name === 'global' || node.object.name === 'globalThis' || node.object.name === 'window')) {
        const propName = node.property?.name || node.property;
        // If accessing global.AlgorithmFramework, just skip it
        if (propName === 'AlgorithmFramework')
          return new GoIdentifier('algorithmFramework');
        // For other global.X access, strip global prefix and treat X as an identifier
        return new GoIdentifier(propName);
      }

      // Pattern 1: CategoryType.BLOCK (direct access)
      if (node.object.type === 'Identifier' && FRAMEWORK_ENUMS[node.object.name]) {
        const enumValue = node.property.name || node.property.value;
        return processEnumAccess(node.object.name, enumValue);
      }

      // Pattern 2: AlgorithmFramework.CategoryType.BLOCK (nested access)
      if (node.object.type === 'MemberExpression' &&
          node.object.object?.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework' &&
          FRAMEWORK_ENUMS[node.object.property?.name]) {
        const enumTypeName = node.object.property.name;
        const enumValue = node.property.name || node.property.value;
        return processEnumAccess(enumTypeName, enumValue);
      }

      // Pattern 3: global.AlgorithmFramework.CategoryType.BLOCK (3-level deep access)
      if (node.object.type === 'MemberExpression' &&
          node.object.object?.type === 'MemberExpression' &&
          (node.object.object.property?.name === 'AlgorithmFramework' || node.object.object.property === 'AlgorithmFramework') &&
          FRAMEWORK_ENUMS[node.object.property?.name]) {
        const enumTypeName = node.object.property.name;
        const enumValue = node.property.name || node.property.value;
        return processEnumAccess(enumTypeName, enumValue);
      }

      const object = this.transformExpression(node.object);

      if (node.computed) {
        // array[index] - check if object is interface{}/any type
        let objType = this.inferFullExpressionType(node.object);
        let typeStr = objType?.toString() || '';
        // If IL inference returns any/interface{}, try Go-side variable types
        if ((typeStr === 'any' || typeStr === 'interface{}') && node.object?.type === 'Identifier') {
          const goVarType = this.variableTypes.get(node.object.name);
          if (goVarType) {
            objType = goVarType;
            typeStr = goVarType.toString() || '';
          }
        }
        let index = this.transformExpression(node.property);

        // Check if index is 'any' type but needs to be string for map indexing
        const indexType = this.inferFullExpressionType(node.property);
        const indexTypeStr = indexType?.toString() || '';

        if (typeStr.startsWith('map[string]') && (indexTypeStr === 'any' || indexTypeStr === 'interface{}')) {
          // Need type assertion on index: map[key.(string)]
          index = this.safeTypeAssertion(index, GoType.String());
        } else if (typeStr.startsWith('map[string]') && this.isNumericType(indexTypeStr)) {
          // Numeric index into string-keyed map - convert with fmt.Sprint
          index = new GoCallExpression(new GoIdentifier('fmt.Sprint'), [index]);
        }

        if (typeStr === 'any' || typeStr === 'interface{}') {
          // Check if this is string-key access (map) vs numeric-index access (array)
          const prop = node.property;
          if (prop.type === 'Literal' && typeof prop.value === 'string') {
            // String key access like config["base"] - assert to map[string]interface{}
            const mapType = new GoType('map[string]interface{}');
            const typeAssert = this.safeTypeAssertion(object, mapType);
            return new GoIndexExpression(typeAssert, index);
          }
          // Numeric index access like arr[i] - assert to []uint8
          const typeAssert = this.safeTypeAssertion(object, GoType.Slice(GoType.UInt8()));
          return new GoIndexExpression(typeAssert, index);
        }

        return new GoIndexExpression(object, index);
      } else {
        // object.field
        const field = node.property.name || node.property.value;

        // Handle special properties
        if (field === 'length')
          return new GoCallExpression(new GoIdentifier('len'), [object]);

        // Handle error.message -> error.Error() in Go
        if (field === 'message') {
          const objType = this.inferFullExpressionType(node.object);
          const typeStr = objType?.toString() || '';
          const objName = node.object?.name || '';
          if (typeStr === 'error' || (typeStr.includes('error') && !typeStr.includes('[]')) ||
              objName === 'error' || objName === 'err' || objName === 'e') {
            return new GoCallExpression(
              new GoSelectorExpression(object, 'Error'),
              []
            );
          }
        }

        // Check if object is a map type - use index expression instead of selector
        let objType = this.inferFullExpressionType(node.object);
        let typeStr = objType?.toString() || '';
        // If IL inference returns any/interface{}, try Go-side variable types
        if ((typeStr === 'any' || typeStr === 'interface{}') && node.object?.type === 'Identifier') {
          const goVarType = this.variableTypes.get(node.object.name);
          if (goVarType) {
            objType = goVarType;
            typeStr = goVarType.toString() || '';
          }
        }

        if (typeStr.startsWith('map[string]')) {
          // map[string]interface{} - access as map["field"]
          return new GoIndexExpression(object, GoLiteral.String(field));
        }

        // For any/interface{} types accessing a field, type-assert to map and index
        if (typeStr === 'any' || typeStr === 'interface{}') {
          // config.Base -> config.(map[string]interface{})["base"]
          const mapType = new GoType('map[string]interface{}');
          const typeAssert = this.safeTypeAssertion(object, mapType);
          return new GoIndexExpression(typeAssert, GoLiteral.String(field));
        }

        // In map-self-ref context, this.X -> s["x"] (map key access)
        if (this.inMapSelfRefContext && node.object?.type === 'ThisExpression') {
          return new GoIndexExpression(
            new GoIdentifier(this.receiverName),
            GoLiteral.String(field)
          );
        }

        let fieldName = this.toPascalCase(field);

        // Check if this field was renamed due to field/method collision
        // If object is 'this' (receiver), check against current struct name
        if (node.object?.type === 'ThisExpression' && this.currentStruct) {
          const renameKey = `${this.currentStruct.name}.${fieldName}`;
          if (this.renamedFields.has(renameKey)) {
            fieldName = this.renamedFields.get(renameKey);
          }
        }

        // Handle this.algorithm.X -> receiver.Algorithm.(*ConcreteAlgorithmType).X
        // The embedded instance base (e.g., IBlockCipherInstance) declares Algorithm as interface{},
        // so ALL field accesses require type assertion to the concrete algorithm struct.
        if (this.algorithmStructName &&
            node.object?.type === 'ThisPropertyAccess' &&
            (node.object.property === 'algorithm' || node.object.property === 'Algorithm')) {
          const typeAssert = new GoTypeAssertion(
            object,
            GoType.Pointer(new GoType(this.algorithmStructName))
          );
          return new GoSelectorExpression(typeAssert, fieldName);
        }

        return new GoSelectorExpression(object, fieldName);
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

      // Handle AlgorithmFramework static methods -> instance calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'AlgorithmFramework') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new GoCallExpression(
          new GoSelectorExpression(new GoIdentifier('algorithmFramework'), this.toPascalCase(method)),
          args
        );
      }

      // Handle Array methods (JavaScript built-ins)
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Array') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Array.isArray(x) -> true (in Go, slices are always "arrays")
        // Since Go is statically typed, we know at compile time if it's a slice
        if (method === 'isArray' && args.length === 1)
          return GoLiteral.Bool(true);
        // Array.from(x) -> x (slices don't need conversion)
        if (method === 'from' && args.length >= 1)
          return args[0];
      }

      // Handle String methods (JavaScript built-ins)
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'String') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // String.fromCharCode(code) -> string([]byte{byte(code)})
        if (method === 'fromCharCode' && args.length >= 1) {
          if (args.length === 1) {
            // Single char: string([]byte{byte(code)})
            return new GoTypeConversion(
              GoType.String(),
              new GoCompositeLiteral(GoType.Slice(GoType.UInt8()), [
                new GoCallExpression(new GoIdentifier('byte'), [args[0]])
              ])
            );
          }
          // Multiple chars: string([]byte{byte(a), byte(b), ...})
          const byteExprs = args.map(a => new GoCallExpression(new GoIdentifier('byte'), [a]));
          return new GoTypeConversion(
            GoType.String(),
            new GoCompositeLiteral(GoType.Slice(GoType.UInt8()), byteExprs)
          );
        }
      }

      // Handle Number() type conversion - converts BigInt or other types to number
      if (node.callee.type === 'Identifier' && node.callee.name === 'Number') {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        if (args.length === 1)
          return new GoTypeConversion(GoType.Int(), args[0]);
        return GoLiteral.Int(0);
      }

      // Handle Boolean() type conversion
      if (node.callee.type === 'Identifier' && node.callee.name === 'Boolean') {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        if (args.length === 1)
          return new GoBinaryExpression(args[0], '!=', GoLiteral.Int(0));
        return GoLiteral.Bool(false);
      }

      // Handle special methods
      if (node.callee.type === 'MemberExpression') {
        return this.transformMethodCall(node);
      }

      // Regular function call
      let func = this.transformExpression(node.callee);
      const { args, hoisted } = this._transformArgsWithHoisting(node.arguments);

      // Convert function names to PascalCase to match Go declaration style
      // Function declarations use toPascalCase, so calls must too
      if (node.callee.type === 'Identifier' && func.nodeType === 'Identifier') {
        func = new GoIdentifier(this.toPascalCase(node.callee.name));
      }

      const callExpr = new GoCallExpression(func, args);
      if (hoisted.length > 0) {
        callExpr._hoistedStatements = hoisted;
      }
      return callExpr;
    }

    /**
     * Transform function arguments, hoisting compound assignments out.
     * In JS, `f(a, b += c)` is valid (b += c is an expression returning b's new value).
     * In Go, += is a statement. We hoist: `b += c; f(a, b)`
     */
    _transformArgsWithHoisting(argNodes) {
      const args = [];
      const hoisted = [];
      for (const arg of argNodes) {
        const argType = arg.type || arg.ilNodeType;
        if (argType === 'AssignmentExpression' && arg.operator && arg.operator !== '=') {
          // Compound assignment (+=, -=, etc.) - hoist as statement, use target as arg
          const target = this.transformExpression(arg.left);
          const value = this.transformExpression(arg.right);
          hoisted.push(new GoExpressionStatement(new GoAssignment([target], arg.operator, [value])));
          args.push(this.transformExpression(arg.left)); // Re-transform to get fresh reference
        } else {
          args.push(this.transformExpression(arg));
        }
      }
      return { args, hoisted };
    }

    /**
     * Collect _hoistedStatements from a Go expression tree and wrap a statement.
     * When compound assignments are hoisted from function arguments,
     * they're stored as _hoistedStatements on the CallExpression node.
     * This method collects them and wraps the statement in a block if needed.
     */
    _wrapWithHoisted(stmt) {
      const hoisted = this._collectHoisted(stmt);
      if (hoisted.length === 0) return stmt;
      return new GoBlock([...hoisted, stmt]);
    }

    _collectHoisted(node) {
      if (!node) return [];
      const result = [];
      // Check the expression inside ExpressionStatement
      const expr = node.expression || node;
      if (expr._hoistedStatements) {
        result.push(...expr._hoistedStatements);
        delete expr._hoistedStatements;
      }
      // Check right-hand side of assignments
      if (expr.nodeType === 'Assignment' && expr.values) {
        for (const val of expr.values) {
          if (val._hoistedStatements) {
            result.push(...val._hoistedStatements);
            delete val._hoistedStatements;
          }
        }
      }
      return result;
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
              new GoSelectorExpression(new GoIdentifier('mathbits'), 'RotateLeft32'),
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
              new GoSelectorExpression(new GoIdentifier('mathbits'), 'RotateLeft32'),
              [args[0], negShift]
            );
          }
          break;

        case 'RotL8':
          if (useStdlib) {
            this.addImport('math/bits');
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('mathbits'), 'RotateLeft8'),
              args
            );
          }
          break;

        case 'RotR8':
          if (useStdlib) {
            this.addImport('math/bits');
            const negShift8 = new GoUnaryExpression('-', args[1]);
            return new GoCallExpression(
              new GoSelectorExpression(new GoIdentifier('mathbits'), 'RotateLeft8'),
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

      // For push, defer arg transformation to pass element type context
      let args;
      let pushElemType = null;
      if (methodName === 'push') {
        const pushArrType = this.inferFullExpressionType(node.callee.object);
        const pushArrTypeStr = pushArrType?.toString() || '';
        if (pushArrType?.isSlice && pushArrType.valueType)
          pushElemType = pushArrType.valueType;
        else if (pushArrType?.isSlice && pushArrType.elementType)
          pushElemType = pushArrType.elementType;
        else if (pushArrTypeStr.startsWith('[]'))
          pushElemType = new GoType(pushArrTypeStr.slice(2));
        args = node.arguments.map(arg => this.transformExpression(arg, pushElemType));
      } else {
        args = node.arguments.map(arg => this.transformExpression(arg));
      }

      // Map common methods
      switch (methodName) {
        case 'push': {
          // arr = append(arr, item)
          // Coerce each argument to the element type if needed
          const coercedArgs = args.map((arg, i) => {
            if (!pushElemType) return arg;
            const valType = this.inferFullExpressionType(node.arguments[i]);
            const valTypeStr = valType?.toString() || '';
            const elemTypeStr = pushElemType.toString();
            if (elemTypeStr !== valTypeStr && this.isNumericType(elemTypeStr) && this.isNumericType(valTypeStr))
              return new GoTypeConversion(pushElemType, arg);
            return arg;
          });

          return new GoAssignment(
            [object],
            '=',
            [new GoCallExpression(new GoIdentifier('append'), [object, ...coercedArgs])]
          );
        }

        case 'length':
          return new GoCallExpression(new GoIdentifier('len'), [object]);

        case 'slice': {
          // arr.slice(start, end) -> arr[start:end]
          // Handle negative indices: arr.slice(0, -1) -> arr[:len(arr)-1]
          const jsArgs = node.arguments || [];
          const start = jsArgs.length > 0 ? this._transformSliceIndex(jsArgs[0], node.callee.object) : null;
          const end = jsArgs.length > 1 ? this._transformSliceIndex(jsArgs[1], node.callee.object) : null;
          return new GoSliceExpression(object, start, end);
        }

        case 'subarray': {
          // typedArray.subarray(start, end) -> arr[start:end]
          // Handle negative indices same as slice
          const jsSubArgs = node.arguments || [];
          const start = jsSubArgs.length > 0 ? this._transformSliceIndex(jsSubArgs[0], node.callee.object) : null;
          const end = jsSubArgs.length > 1 ? this._transformSliceIndex(jsSubArgs[1], node.callee.object) : null;
          return new GoSliceExpression(object, start, end);
        }

        case 'fill': {
          // arr.fill(value) -> for i := range arr { arr[i] = value }
          // Simplification: use fillSlice helper
          return new GoCallExpression(new GoIdentifier('fillSlice'), [object, ...args]);
        }

        case 'reverse': {
          // arr.reverse() -> reverseSlice(arr)
          return new GoCallExpression(new GoIdentifier('reverseSlice'), [object]);
        }

        case 'indexOf': {
          // arr.indexOf(val) -> indexOf(arr, val)
          return new GoCallExpression(new GoIdentifier('indexOf'), [object, ...args]);
        }

        case 'includes': {
          // arr.includes(val) -> containsElement(arr, val)
          return new GoCallExpression(new GoIdentifier('containsElement'), [object, ...args]);
        }

        // Map.set(key, value) -> m[key] = value
        case 'set': {
          if (args.length >= 2)
            return new GoAssignment(new GoIndexExpression(object, args[0]), '=', args[1]);
          break;
        }

        // Map.get(key) -> m[key]
        case 'get': {
          if (args.length >= 1)
            return new GoIndexExpression(object, args[0]);
          break;
        }

        // Map.has(key) -> func() bool { _, ok := m[key]; return ok }()
        case 'has': {
          if (args.length >= 1)
            return new GoRawCode(`func() bool { _, ok := ${this._nodeToCode(object)}[${this._nodeToCode(args[0])}]; return ok }()`);
          break;
        }

        // Map.delete(key) -> delete(m, key)
        case 'delete': {
          if (args.length >= 1)
            return new GoCallExpression(new GoIdentifier('delete'), [object, args[0]]);
          break;
        }

        case 'concat': {
          // arr.concat(other) -> append(append([]T{}, arr...), other...)
          if (args.length === 1) {
            return new GoCallExpression(new GoIdentifier('append'), [object, new GoSpread(args[0])]);
          }
          let result = object;
          for (const arg of args) {
            result = new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(arg)]);
          }
          return result;
        }

        case 'toString': {
          this.addImport('fmt');
          // Check for radix argument: number.toString(radix)
          let fmtVerb = '%v';
          if (args.length > 0) {
            const radixVal = args[0]?.value;
            if (radixVal === 16) fmtVerb = '%x';
            else if (radixVal === 2) fmtVerb = '%b';
            else if (radixVal === 8) fmtVerb = '%o';
            else if (radixVal === 10) fmtVerb = '%d';
          }
          return new GoCallExpression(
            new GoSelectorExpression(new GoIdentifier('fmt'), 'Sprintf'),
            [GoLiteral.String(fmtVerb), object]
          );
        }

        default:
          return new GoCallExpression(
            new GoSelectorExpression(object, this.toPascalCase(methodName)),
            args
          );
      }
    }

    /**
     * Transform array expression to Go slice literal
     * @param {Object} node - ArrayExpression node
     * @param {GoType} [targetType] - Optional target slice type
     */
    transformArrayExpression(node, targetType = null) {
      // Determine the slice type to use
      // If targetType is a slice, use it; otherwise infer or use interface{}
      let sliceType;
      if (targetType && targetType.isSlice) {
        sliceType = targetType;
      } else if (node.elements.length > 0) {
        // Infer from first non-null element
        const firstEl = node.elements.find(el => el != null);
        if (firstEl) {
          // Check for known helper class constructors: new KeySize(...), new LinkItem(...), etc.
          const HELPER_CLASS_NAMES = new Set(['KeySize', 'LinkItem', 'Vulnerability', 'TestCase']);
          const calleeName = firstEl.type === 'NewExpression'
            ? (firstEl.callee?.name || firstEl.callee?.property?.name || firstEl.callee?.property)
            : null;
          if (calleeName && HELPER_CLASS_NAMES.has(calleeName)) {
            sliceType = GoType.Slice(new GoType(calleeName));
          } else {
            const elemType = this.inferFullExpressionType(firstEl);
            // For SpreadElement, elemType is already a slice (e.g., []uint8)
            // We want to use that slice type directly, not wrap it (which would make [][]uint8)
            if (firstEl.type === 'SpreadElement' && elemType?.isSlice) {
              sliceType = elemType;
            } else {
              sliceType = GoType.Slice(elemType);
            }
          }
        } else {
          sliceType = GoType.Slice(GoType.Interface());
        }
      } else {
        // Empty array with no target type
        // Try function return type first (e.g., `let output = []` in method returning []uint8)
        if (this.currentFunctionReturnType && this.currentFunctionReturnType.isSlice) {
          sliceType = this.currentFunctionReturnType;
        } else {
          sliceType = targetType || GoType.Slice(GoType.Interface());
        }
      }

      // Check for int32 overflow: if any element > INT32_MAX, upgrade slice to uint32
      if (sliceType?.isSlice && sliceType.valueType?.name === 'int32') {
        const hasOverflow = (node.elements || []).some(el =>
          el && el.type === 'Literal' && typeof el.value === 'number' && el.value > 2147483647
        );
        if (hasOverflow) {
          sliceType = GoType.Slice(GoType.UInt32());
        }
      }
      // Also check nested int32 arrays: [][]int32 where inner arrays have overflow
      if (sliceType?.isSlice && sliceType.valueType?.isSlice && sliceType.valueType.valueType?.name === 'int32') {
        const hasNestedOverflow = (node.elements || []).some(el =>
          el && el.type === 'ArrayExpression' && (el.elements || []).some(inner =>
            inner && inner.type === 'Literal' && typeof inner.value === 'number' && inner.value > 2147483647
          )
        );
        if (hasNestedOverflow) {
          sliceType = GoType.Slice(GoType.Slice(GoType.UInt32()));
        }
      }

      // Check if any element is a spread element
      const hasSpread = node.elements.some(el => el && el.type === 'SpreadElement');

      if (hasSpread) {
        // Use append() for spread elements: append(append([]T{}, arr1...), arr2...)
        let result = null;
        const regularElements = [];

        for (const el of node.elements) {
          if (!el) continue;

          if (el.type === 'SpreadElement') {
            // Flush regular elements first
            if (regularElements.length > 0) {
              const lit = new GoCompositeLiteral(sliceType, [...regularElements]);
              result = result
                ? new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(lit)])
                : lit;
              regularElements.length = 0;
            }
            // Add spread element
            const arg = this.transformExpression(el.argument);
            if (result) {
              result = new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(arg)]);
            } else {
              // First element is a spread, start with empty slice and append
              const emptySlice = new GoCompositeLiteral(sliceType, []);
              result = new GoCallExpression(new GoIdentifier('append'), [emptySlice, new GoSpread(arg)]);
            }
          } else {
            const sliceElemType = sliceType?.isSlice ? sliceType.valueType : null;
            let transformed = this.transformExpression(el, sliceElemType);
            // Add type conversion for numeric mismatches (e.g., uint32 into []uint8)
            if (sliceElemType && el) {
              const actualType = this.inferFullExpressionType(el);
              if (actualType && sliceElemType.name !== actualType.name &&
                  sliceElemType.name && actualType.name &&
                  !actualType.isSlice && !sliceElemType.isSlice) {
                const numericTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                                      'uint', 'uint8', 'uint16', 'uint32', 'uint64'];
                if (numericTypes.includes(sliceElemType.name) && numericTypes.includes(actualType.name))
                  transformed = new GoTypeConversion(sliceElemType, transformed);
              }
            }
            regularElements.push(transformed);
          }
        }

        // Flush remaining regular elements
        if (regularElements.length > 0) {
          const lit = new GoCompositeLiteral(sliceType, regularElements);
          result = result
            ? new GoCallExpression(new GoIdentifier('append'), [result, new GoSpread(lit)])
            : lit;
        }

        return result || new GoCompositeLiteral(sliceType, []);
      }

      // Get element type for proper literal transformation (value vs pointer)
      const elemType = sliceType.isSlice ? sliceType.valueType : null;
      const elements = node.elements.map(el => {
        let transformed = this.transformExpression(el, elemType);
        // Add type conversion if element type doesn't match slice element type
        if (elemType && el) {
          const actualType = this.inferFullExpressionType(el);
          if (actualType && elemType.name !== actualType.name &&
              elemType.name && actualType.name &&
              !actualType.isSlice && !elemType.isSlice) {
            const numericTypes = ['int', 'int8', 'int16', 'int32', 'int64',
                                  'uint', 'uint8', 'uint16', 'uint32', 'uint64'];
            if (numericTypes.includes(elemType.name) && numericTypes.includes(actualType.name)) {
              transformed = new GoTypeConversion(elemType, transformed);
            }
          }
        }
        // If target type is KeySize but element is a number literal, wrap in KeySize struct
        if (elemType?.toString() === 'KeySize' && el.type === 'Literal' && typeof el.value === 'number') {
          return new GoCompositeLiteral(new GoType('KeySize'), [
            new GoKeyValue(new GoIdentifier('MinSize'), GoLiteral.Int(el.value)),
            new GoKeyValue(new GoIdentifier('MaxSize'), GoLiteral.Int(el.value)),
            new GoKeyValue(new GoIdentifier('Step'), GoLiteral.Int(0))
          ]);
        }
        return transformed;
      });
      return new GoCompositeLiteral(sliceType, elements);
    }

    transformObjectExpression(node, targetType = null) {
      // Known framework struct types and their field mappings (JS property name -> Go field name)
      const KNOWN_STRUCT_FIELDS = {
        'TestCase': { text: 'Text', uri: 'URI', input: 'Input', expected: 'Expected', key: 'Key', iv: 'IV', nonce: 'Nonce', outputSize: 'OutputSize', tag: 'Tag', aad: 'AAD', salt: 'Salt', password: 'Password', info: 'Info', output: 'Output', plaintext: 'Plaintext', ciphertext: 'Ciphertext', hash: 'Hash', mac: 'MAC', signature: 'Signature', blockSize: 'BlockSize', keySize: 'KeySize', rounds: 'Rounds', mode: 'Mode', padding: 'Padding', associatedData: 'AssociatedData', publicKey: 'PublicKey', privateKey: 'PrivateKey', seed: 'Seed', message: 'Message', digest: 'Digest', n: 'N', r: 'R', p: 'P', m: 'M', d: 'D', w: 'W', a: 'A', rows: 'Rows', cols: 'Cols', columns: 'Columns', alphabet: 'Alphabet', config: 'Config', params: 'Params', version: 'Version', variant: 'Variant', level: 'Level', hashAlgorithm: 'HashAlgorithm', counter: 'Counter', digits: 'Digits', shift: 'Shift', macSize: 'MacSize', tweak: 'Tweak', parityBits: 'ParityBits', repetitions: 'Repetitions', roundTrip: 'RoundTrip', sCost: 'SCost', tCost: 'TCost', label: 'Label', outputLength: 'OutputLength', direction: 'Direction', timestamp: 'Timestamp', timestep: 'Timestep', keyLength: 'KeyLength', padType: 'PadType', hashFunction: 'HashFunction', iterations: 'Iterations', innerType: 'InnerType', outerType: 'OuterType', extended: 'Extended', shortened: 'Shortened', timeSteps: 'TimeSteps', threshold: 'Threshold', totalShares: 'TotalShares', testReconstruction: 'TestReconstruction', inverse: 'Inverse', language: 'Language', effectiveBits: 'EffectiveBits', pad: 'Pad', stepSize: 'StepSize', context: 'Context', counterBits: 'CounterBits', repetitionCount: 'RepetitionCount', cipher: 'Cipher', cipherName: 'CipherName', tagSize: 'TagSize', tagLength: 'TagLength', multiplier: 'Multiplier', modulo: 'Modulo', polynomial: 'Polynomial', stateSize: 'StateSize', cost: 'Cost', passes: 'Passes', secret: 'Secret', secretKey: 'SecretKey', curve: 'Curve', radix: 'Radix', ad: 'AD', customization: 'Customization', operationMode: 'OperationMode', endian: 'Endian', skip: 'Skip', count: 'Count', reference: 'Reference', key2: 'Key2', iv1: 'IV1', iv2: 'IV2', q: 'Q', g: 'G', c: 'C', tweakKey: 'TweakKey', ukm: 'UKM', kek: 'KEK', hashBits: 'HashBits', outputLengthBits: 'OutputLengthBits', blockSizeBits: 'BlockSizeBits', burstLength: 'BurstLength', warmup: 'Warmup', increment: 'Increment', luxuryLevel: 'LuxuryLevel', otherPublicKey: 'OtherPublicKey', forkOutput: 'ForkOutput', sharing: 'Sharing', weight: 'Weight', positions: 'Positions', order: 'Order', bits: 'Bits', combinationMode: 'CombinationMode', length: 'Length', sequence: 'Sequence', values: 'Values', outputs: 'Outputs', isDeterministic: 'IsDeterministic', isInverse: 'IsInverse' },
        'Vulnerability': { type: 'Name', name: 'Name', text: 'Description', description: 'Description', mitigation: 'Mitigation', uri: 'URI', url: 'URI', severity: 'Severity' },
        'LinkItem': { text: 'Text', uri: 'URL', url: 'URL' },
        'KeySize': { min: 'MinSize', minSize: 'MinSize', max: 'MaxSize', maxSize: 'MaxSize', step: 'Step', stepSize: 'Step' },
      };

      const targetName = targetType?.name || targetType?.toString() || '';
      const structFields = KNOWN_STRUCT_FIELDS[targetName];

      if (structFields) {
        // Emit as typed struct literal: TestCase{Text: "...", Input: []byte{...}}
        const kvPairs = [];
        for (const prop of node.properties) {
          if (prop.type === 'SpreadElement' || !prop.key) continue;
          // Handle both IL ObjectLiteral (prop.key is string) and ES-tree ObjectExpression (prop.key.name)
          const jsKey = typeof prop.key === 'string' ? prop.key : (prop.key.name || prop.key.value || '');
          const goFieldName = structFields[jsKey] || this.toPascalCase(jsKey);
          const value = this.transformExpression(prop.value);
          kvPairs.push(new GoKeyValue(new GoIdentifier(goFieldName), value));
        }
        return new GoCompositeLiteral(new GoType(targetName), kvPairs);
      }

      // Default: convert to map[string]interface{}
      const kvPairs = [];
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement' || !prop.key) continue;
        const key = typeof prop.key === 'string' ? prop.key : (prop.key.name || prop.key.value || 'unknown');
        const value = this.transformExpression(prop.value);
        kvPairs.push(new GoKeyValue(GoLiteral.String(key), value));
      }

      return new GoCompositeLiteral(
        GoType.Map(GoType.String(), GoType.Interface()),
        kvPairs
      );
    }

    transformConditionalExpression(node, targetType = null) {
      // Go doesn't have ternary operator - use an if expression
      // For now, create inline function
      let condition = this.transformExpression(node.test);
      const consequent = this.transformExpression(node.consequent);
      const alternate = this.transformExpression(node.alternate);

      // Go requires boolean conditions - use shared boolean conversion logic
      condition = this._ensureBooleanCondition(node.test, condition);

      // func() T { if cond { return a }; return b }()
      const funcBody = new GoBlock();
      const ifStmt = new GoIf(condition, new GoBlock(), new GoBlock());
      ifStmt.thenBranch.statements.push(new GoReturn([consequent]));
      funcBody.statements.push(ifStmt);
      funcBody.statements.push(new GoReturn([alternate]));

      // Infer return type: prefer targetType from context, then infer from branches
      let returnType = targetType;
      if (!returnType || returnType.toString() === 'interface{}') {
        const conseqType = this.inferFullExpressionType(node.consequent);
        const altType = this.inferFullExpressionType(node.alternate);
        returnType = conseqType;
        if (!returnType || returnType.toString() === 'interface{}')
          returnType = altType;
      }
      if (!returnType || returnType.toString() === 'interface{}') {
        returnType = GoType.Interface();
      }

      // Fix negative literals for unsigned return types (e.g., -1 can't be uint32)
      const retStr = returnType?.toString() || '';
      const _isUnsigned = retStr === 'uint32' || retStr === 'uint16' || retStr === 'uint8' || retStr === 'uint64';
      if (_isUnsigned) {
        const _allStmts = [...(ifStmt.thenBranch?.statements || []), ...(funcBody.statements || [])];
        for (const stmt of _allStmts) {
          if (stmt.nodeType !== 'Return') continue;
          const retVals = stmt.results || stmt.values;
          if (!retVals?.length) continue;
          const val = retVals[0];
          // Check for GoLiteral with negative value
          if (val.nodeType === 'Literal' && typeof val.value === 'number' && val.value < 0) {
            retVals[0] = new GoRawCode(`^${retStr}(${-val.value - 1})`);
          }
          // Check for GoUnaryExpression('-', GoLiteral(n))
          else if (val.nodeType === 'UnaryExpression' && val.operator === '-' &&
                   val.operand?.nodeType === 'Literal' && typeof val.operand.value === 'number' &&
                   val.operand.value > 0) {
            retVals[0] = val.operand.value === 1
              ? new GoRawCode(`^${retStr}(0)`)
              : new GoRawCode(`^${retStr}(${val.operand.value - 1})`);
          }
        }
      }

      const funcLit = new GoFuncLit([], [new GoParameter('', returnType)], funcBody);
      return new GoCallExpression(funcLit, []);
    }

    /**
     * Transform NewExpression to Go composite literal
     * @param {Object} node - NewExpression AST node
     * @param {GoType} [targetType] - Optional target type hint
     */
    transformNewExpression(node, targetType = null) {
      // new Type() -> &Type{} or Type{} or make(...)
      let typeName = node.callee.name;

      // Handle AlgorithmFramework.ClassName pattern
      if (!typeName && node.callee.type === 'MemberExpression') {
        if (node.callee.object?.name === 'AlgorithmFramework') {
          typeName = node.callee.property?.name || node.callee.property;
        } else {
          // Other member expression - use property name
          typeName = node.callee.property?.name || node.callee.property;
        }
      }

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
        // new Array(size) -> make([]T, size)
        // Use target type if available, otherwise fall back to []interface{}
        const size = node.arguments[0] ? this.transformExpression(node.arguments[0]) : GoLiteral.Int(0);
        if (targetType && targetType.isSlice) {
          return new GoMake(targetType, size);
        }
        return new GoMake(GoType.Slice(GoType.Interface()), size);
      }

      // Track framework helper class usage
      const HELPER_CLASSES = ['KeySize', 'LinkItem', 'TestCase', 'Vulnerability', 'TestCategory'];
      if (HELPER_CLASSES.includes(typeName)) {
        this.helperClasses.add(typeName);
      }

      // Handle helper class constructor arguments with named fields
      // new KeySize(16, 32, 8) -> KeySize{MinSize: 16, MaxSize: 32, Step: 8}
      // Note: TestCase constructor is (input, expected, text, uri) per AlgorithmFramework.js
      const HELPER_FIELD_MAPS = {
        'KeySize': ['MinSize', 'MaxSize', 'Step'],
        'LinkItem': ['Text', 'URL'],
        'TestCase': ['Input', 'Expected', 'Text', 'URI', 'Key', 'IV'],
        'Vulnerability': ['Name', 'Description', 'Mitigation'],
        'TestCategory': ['Name', 'Description']
      };

      if (HELPER_CLASSES.includes(typeName) && node.arguments && node.arguments.length > 0) {
        const fieldNames = HELPER_FIELD_MAPS[typeName] || [];
        const keyValues = [];

        // Define expected field types for helper classes
        const HELPER_FIELD_TYPES = {
          'TestCase': [GoType.Slice(GoType.Byte()), GoType.Slice(GoType.Byte()), GoType.String(), GoType.String(), GoType.Slice(GoType.Byte()), GoType.Slice(GoType.Byte())],
          'LinkItem': [GoType.String(), GoType.String()],
          'KeySize': [GoType.Int(), GoType.Int(), GoType.Int()],
          'Vulnerability': [GoType.String(), GoType.String(), GoType.String()],
          'TestCategory': [GoType.String(), GoType.String()]
        };
        const fieldTypes = HELPER_FIELD_TYPES[typeName] || [];

        for (let i = 0; i < node.arguments.length && i < fieldNames.length; ++i) {
          const key = new GoIdentifier(fieldNames[i]);
          const fieldTargetType = fieldTypes[i] || null;
          const value = this.transformExpression(node.arguments[i], fieldTargetType);
          keyValues.push(new GoKeyValue(key, value));
        }
        // Use targetType if it's a known helper struct and different from typeName
        // This handles cases like new LinkItem(...) in a []Vulnerability array
        const KNOWN_STRUCTS = new Set(['KeySize', 'LinkItem', 'TestCase', 'Vulnerability', 'TestCategory']);
        const targetName = targetType?.name || targetType?.toString() || '';
        const effectiveType = (KNOWN_STRUCTS.has(targetName) && targetName !== typeName) ? targetName : typeName;
        return new GoCompositeLiteral(new GoType(effectiveType), keyValues);
      }

      // If there are constructor arguments, call the constructor function
      // new TEAInstance(this, isInverse) -> NewTEAInstance(this, isInverse)
      if (node.arguments && node.arguments.length > 0 && !HELPER_CLASSES.includes(typeName)) {
        const constructorName = `New${typeName}`;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new GoCallExpression(new GoIdentifier(constructorName), args);
      }

      // Default: create struct literal
      // Check if target type is a value type (not pointer)
      const structLit = new GoCompositeLiteral(new GoType(typeName), []);

      // If target type is a non-pointer type, return value literal
      // Otherwise, return pointer literal
      if (targetType && !targetType.isPointer) {
        return structLit;
      }

      return new GoUnaryExpression('&', structLit);
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
      if (typeof str !== 'string') return String(str);
      // Remove leading underscore (JavaScript private field convention)
      // _key -> Key, _value -> Value
      if (str.startsWith('_'))
        str = str.slice(1);

      // Go convention: well-known acronyms should be all-caps when they are the entire name
      const lower = str.toLowerCase();
      const GO_ACRONYMS = ['id', 'url', 'uri', 'ip', 'tcp', 'udp', 'http', 'https', 'html', 'json', 'xml', 'api', 'sql', 'css', 'dns', 'tls', 'ssl', 'ssh', 'rpc', 'uuid'];
      if (GO_ACRONYMS.includes(lower))
        return str.toUpperCase();

      // Go convention: acronym suffixes should be all-caps (e.g., userID, baseURL)
      // Only apply when the acronym starts at a camelCase boundary (uppercase letter)
      // to avoid false matches like "skip" → "SkIP" (ip is not an acronym here)
      for (const acr of ['URL', 'URI', 'ID', 'IP']) {
        const acrLen = acr.length;
        if (lower.endsWith(acr.toLowerCase()) && str.length > acrLen) {
          const acrStart = str.length - acrLen;
          if (str[acrStart] === str[acrStart].toUpperCase() && str[acrStart] !== str[acrStart].toLowerCase())
            return str.charAt(0).toUpperCase() + str.slice(1, acrStart) + acr;
        }
      }

      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    toLowerFirst(str) {
      if (!str) return str;
      return str.charAt(0).toLowerCase() + str.slice(1);
    }

    /**
     * Rename local variables that would shadow Go builtins.
     * e.g., `len` → `length`, `cap` → `capacity`, `new` → `newVal`
     */
    sanitizeVarName(name) {
      // Only rename builtin FUNCTIONS that would cause "cannot call non-function" errors.
      // Go type names (byte, string, int, bool, etc.) can be shadowed by variables safely.
      const GO_BUILTIN_RENAMES = {
        'len': 'length', 'cap': 'capacity', 'copy': 'copyVal',
        'make': 'makeVal', 'new': 'newVal', 'append': 'appendVal',
        'delete': 'deleteVal', 'close': 'closeVal', 'panic': 'panicVal',
        'recover': 'recoverVal', 'print': 'printVal', 'println': 'printlnVal',
        'error': 'err',
      };
      return GO_BUILTIN_RENAMES[name] || name;
    }

    /**
     * Get a safe receiver name for a struct that won't shadow common loop variables.
     * Standard Go convention: first letter lowercase. But if that's i, j, k, n, x, y, v
     * (common loop/temp vars), use more letters to avoid shadowing.
     */
    getReceiverName(structName) {
      const firstChar = this.toLowerFirst(structName)[0];
      const COMMON_VARS = ['i', 'j', 'k', 'n', 'x', 'y', 'v'];
      if (COMMON_VARS.includes(firstChar) && structName.length > 1) {
        // Use first two lowercase letters
        return this.toLowerFirst(structName).substring(0, 2);
      }
      return firstChar;
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
