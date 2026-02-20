/**
 * CTransformer.js - IL AST to C AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to C AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → C AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - standard: C standard (c89, c99, c11, c17, c23)
 *   - addHeaders: Include standard headers
 *   - addComments: Include generated comments
 */
(function(global) {
  'use strict';

  // Load dependencies
  let CAST;
  if (typeof require !== 'undefined') {
    CAST = require('./CAST.js');
  } else if (global.CAST) {
    CAST = global.CAST;
  }

  const {
    CType, CFile, CInclude, CDefine, CTypedef, CStruct, CField, CEnum, CEnumValue,
    CFunction, CParameter, CBlock, CVariable, CExpressionStatement, CReturn,
    CIf, CFor, CWhile, CDoWhile, CSwitch, CCase, CBreak, CContinue,
    CLiteral, CIdentifier, CBinaryExpression, CUnaryExpression, CAssignment,
    CMemberAccess, CArraySubscript, CCall, CCast, CSizeof, CConditional,
    CArrayInitializer, CCompoundLiteral, CStructInitializer, CComma, CComment
  } = CAST;

  /**
   * Maps JavaScript/IL types to C types
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
    // In crypto context, JavaScript 'number' typically means uint32 (for bit operations)
    'number': 'uint32_t',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'char*',
    'void': 'void',
    'size_t': 'size_t',
    'ptrdiff_t': 'ptrdiff_t',
    // Generic types - map to void* in C
    'any': 'void',
    'object': 'void',
    'unknown': 'void'
  };

  /**
   * JavaScript AST to C AST Transformer
   *
   * Supported Options:
   * - standard: C standard ('c89', 'c99', 'c11', 'c17', 'c23')
   * - addComments: Add documentation comments
   * - useStrictTypes: Use strict type annotations
   * - addHeaders: Add standard headers
   * - useConstCorrectness: Use const qualifiers where appropriate
   */
  class CTransformer {
    constructor(options = {}) {
      this.options = options;
      this.standard = options.standard || 'c11';
      this.currentStruct = null;
      this.currentFunction = null;
      this.variableTypes = new Map();  // Maps variable name -> CType
      this.structFieldTypes = new Map(); // Maps field name -> CType
      this.functions = new Map();      // Maps function name -> CFunction
      this.scopeStack = [];
      this.targetFile = null;          // Current CFile being built
      this.generatedStructs = new Map(); // Maps struct signature -> struct name (to avoid duplicates)
      this.anonStructCounter = 0;      // Counter for generating unique anonymous struct names
      this.splitResultVars = new Set(); // Tracks variables initialized from string_split() calls
      this.filterResultVars = new Set(); // Tracks variables initialized from filter_alpha() etc. calls
      this.specialLengthVars = new Map(); // Maps variable name -> length macro name (e.g., 'parts' -> 'string_split_length')
      this.renamedVariables = new Map(); // Maps JS variable name -> renamed C name (for shadow avoidance)
      this.classNames = new Set(); // Tracks known class names for static field access detection
      this.staticClassFields = new Map(); // Maps "ClassName.fieldName" -> module-level constant name
      this.staticClassFieldTypes = new Map(); // Maps "ClassName.fieldName" -> CType for type inference
      this.moduleConstantTypes = new Map(); // Maps constant name (e.g., "sigma") -> CType for module-level constants
      this.constructorDefaults = new Map(); // Maps class name -> array of { name, defaultValue } for parameters with defaults
      this.emptyArrayPushTypes = new Map(); // Maps variable name -> element type for empty arrays with push operations
    }

    /**
     * Convert name to snake_case (C convention)
     * Handles: camelCase -> camel_case, PascalCase -> pascal_case,
     *          SCREAMING_SNAKE -> screaming_snake, ALLCAPS -> allcaps
     */
    toSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);

      // Replace dashes with underscores (e.g., "cross-sha256-r30-short" -> "cross_sha256_r30_short")
      str = str.replace(/-/g, '_');

      // If already all uppercase (like UPPERCASE, SCREAMING_SNAKE_CASE), just lowercase it
      if (str === str.toUpperCase() && /^[A-Z_0-9]+$/.test(str))
        return str.toLowerCase();

      // Handle camelCase and PascalCase: insert underscore before uppercase letters
      // that are preceded by lowercase or followed by lowercase
      return str
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')  // camelCase -> camel_Case
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')  // XMLParser -> XML_Parser
        .toLowerCase();
    }

    /**
     * Convert name to PascalCase (for structs and types)
     */
    toPascalCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (for constants)
     */
    toScreamingSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      return str
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .replace(/^_/, '');
    }

    /**
     * Check if a companion _length variable would collide with existing variables
     * baseName: the original JS variable name (e.g., 'padding')
     * Returns true if there would be a collision
     */
    hasLengthVariableCollision(baseName) {
      // For 'padding', we want to create 'padding_length' in C
      // But if there's a JS variable 'paddingLength', it would also become 'padding_length'
      // Only check for USER-defined variables that would conflict, not our own generated _length vars
      // This allows same-named variables in different scopes to each have their own length
      const camelLengthName = baseName + 'Length'; // paddingLength - user-defined
      // Check if there's a camelCase length variable that the user defined
      // We DON'T check for snake_case _length because that's what WE generate
      // and we want to allow shadowing in nested scopes (like if/else branches)
      return this.variableTypes.has(camelLengthName);
    }

    /**
     * Pre-scan a function/method body to infer types for variables declared without initializers.
     * This finds patterns like: let x; ... x = someValue; and pre-registers x's type.
     */
    preScanVariableTypes(body) {
      if (!body || !body.body) return;

      // Collect variables declared without initializers
      const uninitializedVars = new Set();

      // Find all variable declarations without initializers
      const scanForDeclarations = (node) => {
        if (!node) return;
        if (node.type === 'VariableDeclaration') {
          for (const decl of node.declarations)
            if (!decl.init && decl.id && decl.id.name)
              uninitializedVars.add(decl.id.name);
        }
        // Recurse into block statements and if/else bodies
        if (node.body) {
          if (Array.isArray(node.body))
            for (const stmt of node.body)
              scanForDeclarations(stmt);
          else
            scanForDeclarations(node.body);
        }
        if (node.consequent) scanForDeclarations(node.consequent);
        if (node.alternate) scanForDeclarations(node.alternate);
      };

      // Find first assignment to each uninitialized variable and infer type
      const scanForAssignments = (node) => {
        if (!node) return;
        if (node.type === 'ExpressionStatement' && node.expression?.type === 'AssignmentExpression') {
          const assign = node.expression;
          if (assign.left?.type === 'Identifier' && uninitializedVars.has(assign.left.name)) {
            // Found assignment to an uninitialized variable - infer type from RHS
            const varName = assign.left.name;
            const inferredType = this.inferTypeFromValue(assign.right);
            if (inferredType) {
              this.registerVariableType(varName, inferredType);
              uninitializedVars.delete(varName);
            }
          }
        }
        // Handle IfStatement specifically
        if (node.type === 'IfStatement') {
          if (node.consequent) scanForAssignments(node.consequent);
          if (node.alternate) scanForAssignments(node.alternate);
        }
        // Recurse into block statements and if/else bodies
        if (node.body) {
          if (Array.isArray(node.body))
            for (const stmt of node.body)
              scanForAssignments(stmt);
          else
            scanForAssignments(node.body);
        }
        if (node.consequent) scanForAssignments(node.consequent);
        if (node.alternate) scanForAssignments(node.alternate);
        // Also check for-of loops
        if (node.type === 'ForOfStatement' && node.body)
          scanForAssignments(node.body);
        if (node.type === 'ForStatement' && node.body)
          scanForAssignments(node.body);
        if (node.type === 'WhileStatement' && node.body)
          scanForAssignments(node.body);
      };

      scanForDeclarations(body);
      if (uninitializedVars.size > 0)
        scanForAssignments(body);
    }

    /**
     * Pre-scan class methods to find 2D array field patterns.
     * Detects patterns like: this.field[i][j] or this.field[i] = [...] or new Array(...)
     * Upgrades field type from pointer to pointer-to-pointer.
     * @param {Array} methods - Array of method AST nodes
     * @returns {Set<string>} - Set of field names that are 2D arrays
     */
    preScan2DArrayFields(methods) {
      const twoDArrayFields = new Set();

      const scanNode = (node) => {
        if (!node) return;

        // Helper to extract field name from this property access patterns
        const getThisFieldName = (fieldAccess) => {
          // Pattern A: ThisPropertyAccess (IL AST transformed node)
          if (fieldAccess?.type === 'ThisPropertyAccess')
            return fieldAccess.property;
          // Pattern B: MemberExpression with ThisExpression (raw JS AST)
          if (fieldAccess?.type === 'MemberExpression' && fieldAccess.object?.type === 'ThisExpression')
            return fieldAccess.property?.name || fieldAccess.property?.value;
          return null;
        };

        // Pattern 1: this.field[i][j] - double subscript
        if (node.type === 'MemberExpression' && node.computed) {
          const inner = node.object;
          if (inner?.type === 'MemberExpression' && inner.computed) {
            // inner is field[i], inner.object should be this.field
            const fieldName = getThisFieldName(inner.object);
            if (fieldName) {
              twoDArrayFields.add(fieldName);
              twoDArrayFields.add('_' + fieldName);
            }
          }
        }

        // Pattern 2: this.field[i] = new Array(...) or this.field[i] = [...]
        if (node.type === 'AssignmentExpression') {
          const left = node.left;
          const right = node.right;
          if (left?.type === 'MemberExpression' && left.computed) {
            const fieldName = getThisFieldName(left.object);
            if (fieldName && (
              right?.type === 'NewExpression' && right.callee?.name === 'Array' ||
              right?.type === 'ArrayExpression' ||
              right?.type === 'ArrayLiteral' ||
              right?.type === 'ArrayCreation' ||
              (right?.type === 'CallExpression' && right.callee?.property?.name === 'fill')
            )) {
              twoDArrayFields.add(fieldName);
              twoDArrayFields.add('_' + fieldName);
            }
          }
        }

        // Recurse into all node properties that could contain nested nodes
        for (const key of Object.keys(node)) {
          const val = node[key];
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
              for (const item of val)
                if (item && typeof item === 'object') scanNode(item);
            } else if (val.type) {
              scanNode(val);
            }
          }
        }
      };

      // Scan all methods
      for (const method of methods) {
        if (method.value?.body) scanNode(method.value.body);
        if (method.body) scanNode(method.body);
      }

      return twoDArrayFields;
    }

    /**
     * Pre-scan a function/method body to find parameters used with array subscript notation.
     * This detects patterns like: param[i] or param[0] and marks them as array types.
     * @param {Object} body - The function body AST node
     * @param {Set<string>} paramNames - Set of parameter names to check
     * @returns {Set<string>} - Set of parameter names that are used as arrays
     */
    preScanParameterArrayUsage(body, paramNames) {
      const arrayParams = new Set();

      // Helper to get identifier name from a node (handles both JS AST and IL AST)
      const getIdentifierName = (node) => {
        if (!node) return null;
        if (node.type === 'Identifier') return node.name;
        if (node.type === 'Variable') return node.name;
        return null;
      };

      const scan = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check for MemberExpression with computed: true (array subscript) - JS AST
        // e.g., w1[i], arr[0]
        if (node.type === 'MemberExpression' && node.computed) {
          const name = getIdentifierName(node.object);
          if (name && paramNames.has(name))
            arrayParams.add(name);
        }

        // Check for ElementAccess (IL AST) - array subscript access
        // e.g., v[n-1] becomes ElementAccess with target=v, index=n-1
        if (node.type === 'ElementAccess') {
          const name = getIdentifierName(node.target);
          if (name && paramNames.has(name))
            arrayParams.add(name);
        }

        // Check for MemberAccess with .length (IL AST) - indicates array usage
        if (node.type === 'MemberAccess' && node.member === 'length') {
          const name = getIdentifierName(node.target);
          if (name && paramNames.has(name))
            arrayParams.add(name);
        }

        // Check for ArrayLength (IL AST) - v.length becomes ArrayLength(v)
        if (node.type === 'ArrayLength') {
          const name = getIdentifierName(node.array);
          if (name && paramNames.has(name))
            arrayParams.add(name);
        }

        // Also check CallExpression arguments for array-related operations - JS AST
        // e.g., if a parameter is passed to array manipulation functions
        if (node.type === 'CallExpression') {
          // Check if this is a method call on a parameter (e.g., param.slice())
          if (node.callee?.type === 'MemberExpression') {
            const name = getIdentifierName(node.callee.object);
            if (name && paramNames.has(name)) {
              const methodName = node.callee.property?.name;
              if (methodName === 'slice' || methodName === 'concat' ||
                  methodName === 'push' || methodName === 'pop' ||
                  methodName === 'shift' || methodName === 'unshift' ||
                  methodName === 'forEach' || methodName === 'map' ||
                  methodName === 'filter' || methodName === 'reduce' ||
                  methodName === 'length')
                arrayParams.add(name);
            }
          }
        }

        // Check for Call with array methods (IL AST)
        if (node.type === 'Call') {
          const name = getIdentifierName(node.target);
          if (name && paramNames.has(name)) {
            const methodName = node.methodName;
            if (methodName === 'slice' || methodName === 'concat' ||
                methodName === 'push' || methodName === 'pop' ||
                methodName === 'shift' || methodName === 'unshift' ||
                methodName === 'forEach' || methodName === 'map' ||
                methodName === 'filter' || methodName === 'reduce')
              arrayParams.add(name);
          }
        }

        // Recurse into all child nodes
        for (const key of Object.keys(node)) {
          if (key === 'type' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
          const value = node[key];
          if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
              for (const item of value)
                scan(item);
            } else
              scan(value);
          }
        }
      };

      scan(body);
      return arrayParams;
    }

    /**
     * Pre-scan function body to detect parameters used as integers (bit operations)
     * Returns a Set of parameter names that are used with >> << & | ^ operators directly
     * (not as subscript targets like arr[i], but as scalar values like input >> 7)
     * @param {Object} body - The function body AST node
     * @param {Set<string>} paramNames - Set of parameter names to check
     * @returns {Set<string>} - Set of parameter names that are used as integers
     */
    preScanParameterIntegerUsage(body, paramNames) {
      const integerParams = new Set();

      const scan = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check for binary operations with bit operators on parameters
        // e.g., input >> 7U, key & 127U, value << 3
        if (node.type === 'BinaryExpression' &&
            ['>>', '<<', '&', '|', '^', '>>>', '%'].includes(node.operator)) {
          // If left operand is a direct parameter identifier, it's used as integer
          if (node.left?.type === 'Identifier' && paramNames.has(node.left.name))
            integerParams.add(node.left.name);
          // If right operand is a direct parameter identifier, it's used as integer
          if (node.right?.type === 'Identifier' && paramNames.has(node.right.name))
            integerParams.add(node.right.name);
        }

        // Check for unary operations like ~value (bitwise NOT)
        if (node.type === 'UnaryExpression' && node.operator === '~') {
          if (node.argument?.type === 'Identifier' && paramNames.has(node.argument.name))
            integerParams.add(node.argument.name);
        }

        // Recurse into all child nodes
        for (const key of Object.keys(node)) {
          if (key === 'type' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
          const value = node[key];
          if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
              for (const item of value)
                scan(item);
            } else
              scan(value);
          }
        }
      };

      scan(body);
      return integerParams;
    }

    /**
     * Pre-scan function body to detect element types from push operations on empty arrays.
     * Finds patterns like: const arr = []; arr.push(someValue);
     * Returns a Map of variable name -> element CType
     * @param {Object} body - The function body AST node
     * @returns {Map<string, CType>} - Map of variable names to their element types
     */
    preScanEmptyArrayPushTypes(body) {
      const pushTypes = new Map();
      if (!body || !body.body) return pushTypes;

      // Collect all variable declarations for type lookup
      const localVarTypes = new Map();

      // First, find variables initialized as empty arrays and collect all var types
      const emptyArrayVars = new Set();
      const scanForEmptyArrays = (node) => {
        if (!node) return;
        if (node.type === 'VariableDeclaration' && node.declarations) {
          for (const decl of node.declarations) {
            if (decl.id?.name && decl.init) {
              // Check for empty array: []
              if (decl.init.type === 'ArrayExpression' &&
                  (!decl.init.elements || decl.init.elements.length === 0)) {
                emptyArrayVars.add(decl.id.name);
              }
              // Check for empty ArrayLiteral (IL AST)
              else if (decl.init.type === 'ArrayLiteral' &&
                  (!decl.init.elements || decl.init.elements.length === 0)) {
                emptyArrayVars.add(decl.id.name);
              }
              // For non-empty declarations, try to infer type for later lookup
              else {
                const varType = this.inferTypeFromValue(decl.init);
                if (varType) {
                  localVarTypes.set(decl.id.name, varType);
                }
              }
            }
          }
        }
        // Recurse
        if (node.body) {
          if (Array.isArray(node.body)) node.body.forEach(scanForEmptyArrays);
          else scanForEmptyArrays(node.body);
        }
        if (node.consequent) scanForEmptyArrays(node.consequent);
        if (node.alternate) scanForEmptyArrays(node.alternate);
      };

      // Then, find push calls on those variables
      const scanForPushCalls = (node) => {
        if (!node || typeof node !== 'object') return;

        // Pattern 1: arr.push(value) - JS AST CallExpression
        if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression') {
          const objName = node.callee.object?.name;
          const methodName = node.callee.property?.name;
          if (objName && emptyArrayVars.has(objName) && methodName === 'push' && node.arguments?.length > 0) {
            let argType = null;
            const firstArg = node.arguments[0];

            // Handle spread element: arr.push(...otherArr) - element type is from the spread source
            if (firstArg?.type === 'SpreadElement') {
              const spreadArg = firstArg.argument;
              let spreadType = null;

              // First check local variable types collected in this function
              if (spreadArg?.type === 'Identifier' && localVarTypes.has(spreadArg.name)) {
                spreadType = localVarTypes.get(spreadArg.name);
              } else {
                spreadType = this.inferTypeFromValue(spreadArg);
              }

              // If spread source is a pointer/array, the element type is its base type
              if (spreadType && (spreadType.isPointer || spreadType.isArray) && spreadType.baseType) {
                argType = spreadType.baseType;
              } else {
                // Otherwise use the spread source type directly (e.g., from method calls)
                argType = spreadType;
                // If it's a pointer type, extract the base type
                if (argType && argType.isPointer && argType.baseType) {
                  argType = argType.baseType;
                }
              }
            } else {
              // Regular push argument - infer element type directly
              argType = this.inferTypeFromValue(firstArg);
            }

            if (argType && !pushTypes.has(objName)) {
              // Store the element type (not the pointer type)
              pushTypes.set(objName, argType);
            }
          }
        }

        // Pattern 2: IL AST MethodCall with push
        if (node.type === 'MethodCall' && node.method === 'push') {
          const objName = node.target?.name || node.object?.name;
          if (objName && emptyArrayVars.has(objName) && node.arguments?.length > 0) {
            const argType = this.inferTypeFromValue(node.arguments[0]);
            if (argType && !pushTypes.has(objName)) {
              pushTypes.set(objName, argType);
            }
          }
        }

        // Pattern 3: arr[arr_length++] = value (C-style push emulation)
        if (node.type === 'AssignmentExpression' || node.type === 'Assignment') {
          const left = node.left;
          // Check for arr[something] = value pattern
          if (left?.type === 'MemberExpression' && left.computed) {
            const arrName = left.object?.name;
            if (arrName && emptyArrayVars.has(arrName)) {
              const argType = this.inferTypeFromValue(node.right);
              if (argType && !pushTypes.has(arrName)) {
                pushTypes.set(arrName, argType);
              }
            }
          }
          // IL AST ElementAccess
          if (left?.type === 'ElementAccess') {
            const arrName = left.target?.name || left.array?.name;
            if (arrName && emptyArrayVars.has(arrName)) {
              const argType = this.inferTypeFromValue(node.right || node.value);
              if (argType && !pushTypes.has(arrName)) {
                pushTypes.set(arrName, argType);
              }
            }
          }
        }

        // Pattern 4: IL AST ArrayPush node { type: 'ArrayPush', array, value }
        if (node.type === 'ArrayPush') {
          const arrName = node.array?.name;
          if (arrName && emptyArrayVars.has(arrName) && node.value) {
            const argType = this.inferTypeFromValue(node.value);
            if (argType && !pushTypes.has(arrName)) {
              pushTypes.set(arrName, argType);
            }
          }
        }

        // Pattern 5: IL AST ArrayAppend node { type: 'ArrayAppend', array, value }
        if (node.type === 'ArrayAppend') {
          const arrName = node.array?.name;
          if (arrName && emptyArrayVars.has(arrName) && node.value) {
            let argType = null;

            // Handle spread element: arr.push(...otherArr) -> ArrayAppend with SpreadElement value
            if (node.value.type === 'SpreadElement') {
              const spreadArg = node.value.argument;
              let spreadType = null;

              // First check local variable types collected in this function
              if (spreadArg?.type === 'Identifier' && localVarTypes.has(spreadArg.name)) {
                spreadType = localVarTypes.get(spreadArg.name);
              } else {
                spreadType = this.inferTypeFromValue(spreadArg);
              }

              // If spread source is a pointer/array, the element type is its base type
              if (spreadType && (spreadType.isPointer || spreadType.isArray) && spreadType.baseType) {
                argType = spreadType.baseType;
              } else {
                // Otherwise use the spread source type directly
                argType = spreadType;
                // If it's a pointer type, extract the base type
                if (argType && argType.isPointer && argType.baseType) {
                  argType = argType.baseType;
                }
              }
            } else {
              // Regular value - infer element type directly
              argType = this.inferTypeFromValue(node.value);
            }

            if (argType && !pushTypes.has(arrName)) {
              pushTypes.set(arrName, argType);
            }
          }
        }

        // Recurse into all child nodes
        for (const key of Object.keys(node)) {
          if (key === 'type' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
          const value = node[key];
          if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
              for (const item of value) scanForPushCalls(item);
            } else {
              scanForPushCalls(value);
            }
          }
        }
      };

      // Run both scans
      if (Array.isArray(body.body)) body.body.forEach(scanForEmptyArrays);
      else scanForEmptyArrays(body);
      scanForPushCalls(body);

      return pushTypes;
    }

    /**
     * Try to infer the type of an expression (simple heuristics)
     */
    _getExpressionType(node) {
      if (!node) return null;

      // Literal types
      if (node.type === 'Literal') {
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'number') return 'number';
        if (typeof node.value === 'boolean') return 'bool';
        return null;
      }

      // Member access to known string fields
      if (node.type === 'MemberExpression') {
        const propName = node.property?.name || node.property?.value;
        if (propName && (
          propName.toUpperCase().includes('CASE') ||
          propName.toUpperCase().includes('ALPHABET') ||
          propName.toUpperCase().includes('REVERSE') ||
          propName.toUpperCase().includes('STRING') ||
          propName.toUpperCase().includes('TEXT')
        )) {
          return 'string';
        }
      }

      // Identifier with type annotation
      if (node.type === 'Identifier') {
        if (node.typeAnnotation?.typeAnnotation?.type === 'TSStringKeyword') return 'string';
        if (node.typeAnnotation?.typeAnnotation?.type === 'TSNumberKeyword') return 'number';
      }

      return null;
    }

    /**
     * C reserved words that must be escaped
     */
    static C_RESERVED_WORDS = new Set([
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
      'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
      'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof',
      'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
      'volatile', 'while', 'inline', 'restrict', '_Bool', '_Complex', '_Imaginary',
      // Common standard library names
      'NULL', 'EOF', 'stdin', 'stdout', 'stderr', 'errno',
      // stdint.h types
      'int8_t', 'int16_t', 'int32_t', 'int64_t',
      'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
      'size_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t'
    ]);

    /**
     * Convert name to safe C identifier (snake_case + escape reserved words)
     */
    toSafeCName(str) {
      // Preserve SCREAMING_SNAKE_CASE identifiers that are known module constants
      // These were defined with #define and should be referenced exactly as defined
      if (this.moduleConstantTypes && this.moduleConstantTypes.has(str))
        return str;

      // Check if this is already SCREAMING_SNAKE_CASE and is a known constant
      // (e.g., BLAKE2B_BLOCKBYTES should stay BLAKE2B_BLOCKBYTES, not blake2b_blockbytes)
      if (str === str.toUpperCase() && /^[A-Z_][A-Z_0-9]*$/.test(str))
        return str;

      const snakeName = this.toSnakeCase(str);
      if (CTransformer.C_RESERVED_WORDS.has(snakeName))
        return snakeName + '_';
      return snakeName;
    }

    /**
     * Extract array name for generating companion length variable names
     * Works with CIdentifier (returns name), CMemberAccess (returns member name),
     * and other expressions (returns 'array' as fallback)
     */
    extractArrayName(node) {
      if (!node) return 'array';
      if (node instanceof CIdentifier)
        return node.name;
      if (node instanceof CMemberAccess)
        return node.member;
      // Duck-typing: objects with member property (like CMemberAccess)
      if (node.member)
        return node.member;
      // Duck-typing: objects with name property (like CIdentifier)
      if (node.name)
        return node.name;
      return 'array';
    }

    /**
     * Build a length variable expression for an array.
     * If the array is a member access (self->array), returns a member access (self->array_length).
     * If the array is a simple identifier, returns a simple identifier (array_length).
     * If the array is a function call with known output length, returns a literal.
     */
    buildArrayLengthVar(arrayExpr) {
      // Handle function calls with known output lengths
      if (arrayExpr instanceof CCall) {
        const funcName = arrayExpr.callee?.name || '';
        // Unpack functions return fixed-size arrays
        if (funcName.includes('unpack16') || funcName.includes('pack16'))
          return CLiteral.UInt(2, 'U');
        if (funcName.includes('unpack32') || funcName.includes('pack32'))
          return CLiteral.UInt(4, 'U');
        if (funcName.includes('unpack64') || funcName.includes('pack64'))
          return CLiteral.UInt(8, 'U');
        // array_slice(arr, start, end) returns end - start elements
        if (funcName === 'array_slice' && arrayExpr.arguments && arrayExpr.arguments.length >= 3) {
          const start = arrayExpr.arguments[1];
          const end = arrayExpr.arguments[2];
          return new CBinaryExpression(end, '-', start);
        }
        // For other functions, use the first argument's length if available
        const args = arrayExpr.arguments || arrayExpr.args || [];
        if (args.length > 0) {
          const firstArg = args[0];
          if (firstArg && !(firstArg instanceof CCall))
            return this.buildArrayLengthVar(firstArg);
        }
        // Fallback to array_length (may cause errors, but better than nothing)
        return new CIdentifier('array_length');
      }

      const arrayName = this.extractArrayName(arrayExpr);
      const lengthName = arrayName + '_length';

      // If the array is a member access, the length should also be a member access
      // CMemberAccess(target, member, isPointer)
      if (arrayExpr instanceof CMemberAccess)
        return new CMemberAccess(arrayExpr.target, lengthName, arrayExpr.isPointer);

      // Also check for plain objects with target/member (duck-typing CMemberAccess)
      if (arrayExpr && arrayExpr.target && arrayExpr.member)
        return new CMemberAccess(arrayExpr.target, lengthName, !!arrayExpr.isPointer);

      // Otherwise use a simple identifier
      return new CIdentifier(lengthName);
    }

    /**
     * Map JavaScript type string to C type
     */
    mapType(typeName) {
      if (!typeName) return CType.UInt32();

      // Handle both string and object { name: 'type' } formats
      if (typeof typeName !== 'string')
        typeName = typeName?.name || 'uint32';

      // Handle arrays - convert to pointers
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return CType.Pointer(elementType);
      }

      const cTypeName = TYPE_MAP[typeName] || typeName;

      // Map to C types
      const typeMap = {
        'uint8_t': CType.UInt8(),
        'uint16_t': CType.UInt16(),
        'uint32_t': CType.UInt32(),
        'uint64_t': CType.UInt64(),
        'int8_t': CType.Int8(),
        'int16_t': CType.Int16(),
        'int32_t': CType.Int32(),
        'int64_t': CType.Int64(),
        'bool': CType.Bool(),
        'char*': CType.Pointer(CType.Char()),
        'void': CType.Void(),
        'size_t': CType.SizeT(),
        'ptrdiff_t': CType.PtrDiffT()
      };

      return typeMap[cTypeName] || new CType(cTypeName);
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
     * Infer C type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return CType.UInt32();

      // Handle non-string names (e.g., numeric property access like arr[0])
      if (typeof name !== 'string') return CType.UInt32();

      const lowerName = name.toLowerCase();

      // String-related parameter names - used with OpCodes.AnsiToBytes(str)
      // Should be const char* type
      // Note: Exclude 'plaintext' and 'ciphertext' which are byte arrays, not strings
      if (lowerName === 'str' || lowerName === 'string' ||
          lowerName === 'text' || lowerName === 'message' ||
          lowerName === 'msg' || lowerName === 'ascii' ||
          lowerName === 'input_string' || lowerName === 'input_text' ||
          lowerName.endsWith('string') ||
          (lowerName.endsWith('text') && !lowerName.includes('cipher') && !lowerName.includes('plain')) ||
          lowerName.endsWith('message') || lowerName.endsWith('msg')) {
        const charPtr = CType.Pointer(new CType('char'));
        charPtr.isConst = true;
        return charPtr;
      }

      // Size/Length/Count suffixes - these are always numeric (check BEFORE array patterns)
      // This handles blockSize, keySize, inputLength, roundCount, etc.
      if (lowerName.endsWith('size') || lowerName.endsWith('length') ||
          lowerName.endsWith('count') || lowerName.endsWith('num') ||
          lowerName.endsWith('index') || lowerName.endsWith('offset') ||
          lowerName.endsWith('rounds') || lowerName.endsWith('bits')) {
        return CType.SizeT();
      }

      // Byte-related names (but NOT single-letter 'b' which is often an index)
      // Note: single-letter names like a, b, c, d are commonly used as indices/positions
      // CRITICAL: 'bytes' (plural) is an array pattern and must NOT match here
      // 'keyBytes' should be uint8_t*, not uint8_t!
      if (!lowerName.includes('bytes') && (lowerName.includes('byte') || /^b\d$/.test(lowerName))) {
        return CType.UInt8();
      }

      // Round keys and sub keys are 2D arrays of uint32_t arrays (uint32_t**)
      // Must check BEFORE general 'key' pattern matching
      if (lowerName === 'roundkeys' || lowerName === 'round_keys' ||
          lowerName === 'subkeys' || lowerName === 'sub_keys' ||
          lowerName === 'rk' || lowerName === 'ks') {
        return CType.Pointer(CType.Pointer(CType.UInt32()));
      }
      // CRITICAL: Names ending with 'bit' (singular) are scalar values, not arrays
      // e.g., 'keyBit', 'feedbackBit' are single bit values extracted from arrays
      // Must check BEFORE array patterns since 'keyBit' contains 'key'
      if (lowerName.endsWith('bit') || lowerName.endsWith('_bit')) {
        return CType.UInt32();
      }

      // Array-related names (use pointers for crypto data)
      // Note: 'result' is commonly used for byte array results in crypto operations
      // 'table' is commonly used for lookup tables like decode_table, sbox_table, etc.
      // Added: 'seed', 'nonce', 'iv', 'salt', 'tag', 'mac', 'vector' for crypto operations
      // Added: 'register', 'lfsr', 'nlfsr' for stream cipher registers
      // Added: 'permutation', 'substitution', 'frequencies', 'percentages' for analysis
      // Added: 'aad' (Authenticated Associated Data) for AEAD ciphers
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state') ||
          lowerName === 'result' || lowerName.includes('encoded') ||
          lowerName.includes('decoded') || lowerName.includes('encrypted') ||
          lowerName.includes('decrypted') || lowerName.includes('hash') ||
          lowerName.includes('digest') || lowerName.includes('plaintext') ||
          lowerName.includes('ciphertext') || lowerName.includes('table') ||
          lowerName.includes('sbox') || lowerName.includes('pbox') || lowerName.includes('lookup') ||
          lowerName.includes('array') || lowerName.includes('list') ||
          lowerName.includes('seed') || lowerName.includes('nonce') ||
          lowerName.includes('iv') || lowerName.includes('salt') ||
          lowerName.includes('tag') || lowerName.includes('mac') ||
          lowerName.includes('vector') || lowerName.includes('register') ||
          lowerName.includes('lfsr') || lowerName.includes('nlfsr') ||
          lowerName.includes('permutation') || lowerName.includes('substitution') ||
          lowerName.includes('frequencies') || lowerName.includes('percentages') ||
          lowerName === 'aad') {
        // Tables, sboxes, pboxes and lookup tables typically contain uint32_t values
        const baseType = (lowerName.includes('state') || lowerName.includes('table') ||
                          lowerName.includes('sbox') || lowerName.includes('pbox') || lowerName.includes('lookup'))
                         ? CType.UInt32() : CType.UInt8();
        const pointerType = CType.Pointer(baseType);
        // For input/key parameters, make it const - but NOT for internal buffers
        // 'input_buffer', 'key_buffer', 'round_key', 'sub_key' etc. are internal storage and need to be mutable
        // Also exclude 'stream' and 'keystream' which are mutable output buffers
        // Fields with numeric suffixes like 'key0', 'key1' are derived/internal arrays, not const inputs
        const hasNumericSuffix = /\d+$/.test(lowerName);
        const isBuffer = lowerName.includes('buffer') || lowerName.includes('state') ||
                         lowerName.includes('output') || lowerName.includes('result') ||
                         lowerName.includes('round') || lowerName.includes('sub') ||
                         lowerName.includes('stream') || lowerName.includes('expanded') ||
                         lowerName.includes('schedule') || lowerName.includes('work') ||
                         lowerName.includes('internal') ||
                         hasNumericSuffix;
        if (!isBuffer && (lowerName.includes('input') || lowerName.includes('key') ||
                          lowerName.includes('nonce') || lowerName.includes('iv'))) {
          pointerType.isConst = true;
        }
        return pointerType;
      }

      // Integer-related names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return CType.SizeT();
      }

      // NOTE: We can't infer struct types just from variable names like 'config', 'options', etc.
      // because we can't guarantee the corresponding typedef will be generated.
      // Proper struct type tracking would require flow analysis of assignments.
      // For now, these are typed as uint32_t (opaque handles) or handled elsewhere.

      // Special handling for field names ending with Algorithm or Instance
      // e.g., _desAlgorithm -> DESAlgorithm*, desInstance -> DESInstance*
      // Extract the algorithm/instance name from camelCase field name
      const algorithmMatch = name.match(/^_?([a-z]+)Algorithm$/i);
      if (algorithmMatch) {
        // Extract prefix (e.g., "des" from "_desAlgorithm") and build struct name
        const prefix = algorithmMatch[1];
        const structName = this.toPascalCase(prefix) + 'Algorithm';
        return CType.Pointer(new CType(structName));
      }

      const instanceMatch = name.match(/^_?([a-z]+)Instance$/i);
      if (instanceMatch) {
        const prefix = instanceMatch[1];
        const structName = this.toPascalCase(prefix) + 'Instance';
        return CType.Pointer(new CType(structName));
      }

      // Default to uint32_t for crypto operations
      return CType.UInt32();
    }

    /**
     * Infer return type from function body by analyzing return statements
     */
    inferReturnTypeFromBody(body) {
      if (!body || !body.body) return null;

      // First pass: extract local variable types from declarations
      // Also store the actual initializer AST for direct property lookup
      const localVarTypes = new Map();
      const localVarInitializers = new Map();
      const extractLocalVars = (node) => {
        if (!node) return;
        if (node.type === 'VariableDeclaration' && node.declarations) {
          for (const decl of node.declarations) {
            if (decl.id && decl.id.name && decl.init) {
              // Store the initializer AST for direct lookup
              localVarInitializers.set(decl.id.name, decl.init);

              // Infer type from initializer - especially for object literals
              if (decl.init.type === 'ObjectExpression') {
                // Try to find a matching struct from field names
                const fieldNames = decl.init.properties
                  .filter(p => p.key && (p.key.name || p.key.value))
                  .map(p => p.key.name || p.key.value);

                // Look for a struct with matching fields
                for (const [structName, structDef] of this.generatedStructs) {
                  if (structDef.fields) {
                    const structFieldNames = structDef.fields.map(f => f.name);
                    const snakeFieldNames = fieldNames.map(n => this.toSnakeCase(n));
                    if (snakeFieldNames.every(f => structFieldNames.includes(f))) {
                      localVarTypes.set(decl.id.name, new CType(structName));
                      break;
                    }
                  }
                }
              } else if (decl.init.type === 'ArrayExpression' &&
                         (!decl.init.elements || decl.init.elements.length === 0)) {
                // For empty array initializers, prefer name-based inference for pointer types
                const nameBasedType = this.inferTypeFromName(decl.id.name);
                if (nameBasedType && (nameBasedType.isPointer || nameBasedType.pointerLevel > 0)) {
                  localVarTypes.set(decl.id.name, nameBasedType);
                } else {
                  localVarTypes.set(decl.id.name, CType.Pointer(CType.UInt8()));
                }
              } else if ((decl.init.type === 'Literal' && decl.init.value === null) ||
                         (decl.init.type === 'Identifier' && decl.init.name === 'null')) {
                // For null-initialized variables, prefer name-based inference if it returns a pointer type
                // Note: Some parsers represent null as Identifier with name='null' instead of Literal
                const nameBasedType = this.inferTypeFromName(decl.id.name);
                if (nameBasedType && (nameBasedType.isPointer || nameBasedType.pointerLevel > 0)) {
                  localVarTypes.set(decl.id.name, nameBasedType);
                } else {
                  localVarTypes.set(decl.id.name, CType.Pointer(CType.Void()));
                }
              } else {
                // Use regular type inference for other initializers
                const initType = this.inferTypeFromValue(decl.init);
                if (initType)
                  localVarTypes.set(decl.id.name, initType);
              }
            }
          }
        }
        // Recurse into blocks
        if (node.body) {
          if (Array.isArray(node.body))
            node.body.forEach(extractLocalVars);
          else if (Array.isArray(node.body.body))
            node.body.body.forEach(extractLocalVars);
        }
        if (node.consequent) {
          if (Array.isArray(node.consequent))
            node.consequent.forEach(extractLocalVars);
          else
            extractLocalVars(node.consequent);
        }
        if (node.alternate) extractLocalVars(node.alternate);
        if (node.cases)
          node.cases.forEach(c => c.consequent && c.consequent.forEach(extractLocalVars));
      };
      body.body.forEach(extractLocalVars);

      // Helper to infer type for MemberExpression using local var types
      const inferTypeWithLocals = (node) => {
        if (!node) return null;
        // Check for simple Identifier - look up in localVarTypes first
        if (node.type === 'Identifier') {
          const varType = localVarTypes.get(node.name);
          if (varType) return varType;
          // Fall through to inferTypeFromValue
        }
        if (node.type === 'MemberExpression') {
          const propName = node.property && (node.property.name || node.property.value);
          if (node.object && node.object.type === 'Identifier') {
            const objName = node.object.name;

            // Direct lookup: if we have the initializer AST, find the property value directly
            const initializer = localVarInitializers.get(objName);
            if (initializer && initializer.type === 'ObjectExpression' && initializer.properties) {
              // For computed property access (node.computed=true), we can't know which property
              // is being accessed. But if all properties are object literals with similar structure,
              // we can use any of them to infer the return type.
              if (node.computed && initializer.properties.length > 0) {
                // Find the first property that has an ObjectExpression value
                for (const prop of initializer.properties) {
                  if (prop.value && prop.value.type === 'ObjectExpression') {
                    // Use generateStructTypeForObject to get the actual struct type
                    // This will either find existing struct by signature or create a new one
                    const keyName = prop.key && (prop.key.name || prop.key.value);
                    return this.generateStructTypeForObject(prop.value, keyName);
                  }
                }
              }

              for (const prop of initializer.properties) {
                const keyName = prop.key && (prop.key.name || prop.key.value);
                if (keyName === propName || this.toSnakeCase(keyName) === this.toSnakeCase(propName)) {
                  // Found the property - if its value is an object literal, use generateStructTypeForObject
                  if (prop.value && prop.value.type === 'ObjectExpression') {
                    // Use generateStructTypeForObject to get the actual struct type
                    // This will either find existing struct by signature or create a new one
                    return this.generateStructTypeForObject(prop.value, propName);
                  }
                  // For non-object values, infer from the value
                  return this.inferTypeFromValue(prop.value);
                }
              }
            }

            // Fall back to known type lookup
            const objType = localVarTypes.get(objName);
            if (objType && objType.name) {
              // Look up the struct definition to find the field type
              const structDef = this.generatedStructs.get(objType.name);
              if (structDef && structDef.fields) {
                const snakeProp = this.toSnakeCase(propName);
                for (const field of structDef.fields) {
                  if (field.name === propName || field.name === snakeProp)
                    return field.type;
                }
              }
            }
          }
          // Fall back to regular inference
          return this.inferTypeFromValue(node);
        }
        // For ConditionalExpression, check both branches
        if (node.type === 'ConditionalExpression') {
          const conseqType = inferTypeWithLocals(node.consequent);
          const altType = inferTypeWithLocals(node.alternate);
          // Prefer non-null type
          if (conseqType && conseqType.name !== 'void' && conseqType.name !== 'uint32_t')
            return conseqType;
          if (altType && altType.name !== 'void' && altType.name !== 'uint32_t')
            return altType;
        }
        // For LogicalExpression (||, &&), check both operands
        if (node.type === 'LogicalExpression') {
          const leftType = inferTypeWithLocals(node.left);
          const rightType = inferTypeWithLocals(node.right);
          // Prefer non-null type
          if (leftType && leftType.name !== 'void' && leftType.name !== 'uint32_t')
            return leftType;
          if (rightType && rightType.name !== 'void' && rightType.name !== 'uint32_t')
            return rightType;
        }
        return this.inferTypeFromValue(node);
      };

      // Scan for return statements recursively
      const returnTypes = [];
      const scanNode = (node) => {
        if (!node) return;
        if (node.type === 'ReturnStatement' && node.argument) {
          const inferredType = inferTypeWithLocals(node.argument);
          // Include type if it's not void (but allow void pointers like void*)
          if (inferredType && (inferredType.name !== 'void' || inferredType.isPointer || inferredType.pointerLevel > 0))
            returnTypes.push(inferredType);
        }
        // Recurse into blocks
        if (node.body) {
          if (Array.isArray(node.body))
            node.body.forEach(scanNode);
          else if (Array.isArray(node.body.body))
            node.body.body.forEach(scanNode);
        }
        if (node.consequent) {
          if (Array.isArray(node.consequent))
            node.consequent.forEach(scanNode);
          else
            scanNode(node.consequent);
        }
        if (node.alternate) scanNode(node.alternate);
        if (node.cases)
          node.cases.forEach(c => c.consequent && c.consequent.forEach(scanNode));
      };

      body.body.forEach(scanNode);

      if (returnTypes.length === 0) return null;

      // When we have multiple return types, prefer pointer/array types over scalars
      // This handles cases like: return null; ... return result; (where result is an array)
      // We want the function to return uint8_t* not uint32_t
      const pointerTypes = returnTypes.filter(t => t && (t.isPointer || t.isArray));
      const arrayTypes = returnTypes.filter(t => t && t.isArray);

      // Prefer array types (most specific), then pointer types, then any non-uint32 type
      if (arrayTypes.length > 0) {
        // Convert array type to pointer type for function return
        const arrType = arrayTypes[0];
        // Check both elementType and baseType (CType.Array uses baseType)
        if (arrType.elementType || arrType.baseType) {
          return CType.Pointer(arrType.elementType || arrType.baseType);
        }
        // Fallback: default to uint8_t* for arrays
        return CType.Pointer(CType.UInt8());
      }

      if (pointerTypes.length > 0) {
        return pointerTypes[0];
      }

      // If all returns are scalar, find a non-uint32_t type if possible
      // (uint32_t is often a fallback default, so prefer more specific types)
      const nonDefaultTypes = returnTypes.filter(t =>
        t && t.name !== 'uint32_t' && t.name !== 'void'
      );
      if (nonDefaultTypes.length > 0) {
        return nonDefaultTypes[0];
      }

      // Fall back to first type
      return returnTypes[0];
    }

    /**
     * Transform a JavaScript AST to a C AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {CFile} C AST
     */
    transform(jsAst) {
      const file = new CFile();
      this.targetFile = file;  // Track current file for struct generation
      this.generatedStructs.clear();  // Reset generated structs for this file
      this.anonStructCounter = 0;  // Reset counter

      // Add standard includes
      if (this.options.addHeaders !== false) {
        file.includes.push(new CInclude('stdint.h', true));
        file.includes.push(new CInclude('stdbool.h', true));
        file.includes.push(new CInclude('stddef.h', true));
        file.includes.push(new CInclude('stdlib.h', true));  // malloc, free
        file.includes.push(new CInclude('string.h', true));
        file.includes.push(new CInclude('stdio.h', true));   // sscanf, sprintf, printf
        file.includes.push(new CInclude('ctype.h', true));   // toupper, tolower
      }

      // Add file header comment
      if (this.options.addComments !== false) {
        const standard = this.standard.toUpperCase();
        file.headerComment = new CComment(
          `Generated C code (${standard})\nThis file was automatically generated from JavaScript AST`,
          true
        );
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, file);
        }
      }

      this.targetFile = null;  // Clear reference
      return file;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetFile) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetFile);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetFile);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetFile);
          break;

        case 'ExpressionStatement':
          // Handle IIFE wrappers - extract content from inside
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') {
              this.transformIIFEContent(callee, node.expression, targetFile);
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
    transformIIFEContent(calleeNode, callExpr, targetFile) {
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
        if (stmt.type === 'ExpressionStatement') continue; // Skip 'use strict'
        if (stmt.type === 'ClassDeclaration') {
          this.transformClassDeclaration(stmt, targetFile);
          continue;
        }
        if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetFile);
          continue;
        }
        if (stmt.type === 'VariableDeclaration') {
          this.transformVariableDeclaration(stmt, targetFile);
          continue;
        }
      }
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetFile) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip object destructuring
        if (decl.id.type === 'ObjectPattern') continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new CArraySubscript(sourceExpr, CLiteral.Int(i));
              const globalVar = new CVariable(varName, CType.Auto(), indexExpr);
              globalVar.type.isStatic = true;
              globalVar.type.isConst = node.kind === 'const';
              targetFile.globals.push(globalVar);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Handle literals and constants
        if (decl.init.type === 'Literal' || decl.init.type === 'UnaryExpression' ||
            decl.init.type === 'BinaryExpression') {
          const constName = this.toScreamingSnakeCase(name);
          const value = this.transformExpression(decl.init);
          const type = this.inferTypeFromValue(decl.init);

          const define = new CDefine(constName, value);
          targetFile.defines.push(define);
        }
        // Handle array expressions as constants (including ArrayLiteral from IL AST)
        else if (decl.init.type === 'ArrayExpression' || decl.init.type === 'ArrayLiteral') {
          // Preserve SCREAMING_SNAKE_CASE for module constants like BLAKE2B_IV, SIGMA
          const constName = (name === name.toUpperCase() && /^[A-Z_][A-Z_0-9]*$/.test(name))
            ? name
            : this.toSnakeCase(name);
          const type = this.inferTypeFromValue(decl.init);
          const initializer = this.transformExpression(decl.init);

          const globalVar = new CVariable(constName, type, initializer);
          globalVar.type.isStatic = true;
          globalVar.type.isConst = true;
          targetFile.globals.push(globalVar);

          // Track the type for subscript access type inference (use original name too for lookup)
          this.moduleConstantTypes.set(constName, type);
          if (constName !== name)
            this.moduleConstantTypes.set(name, type);
        }
        // Handle typed array constructors: new Uint32Array([...]), new Uint8Array([...]), etc.
        // Also handles OpCodesCall (IL AST node type for OpCodes.* methods)
        else if (decl.init.type === 'NewExpression' || decl.init.type === 'CallExpression' || decl.init.type === 'OpCodesCall') {
          const calleeName = decl.init.callee?.name || decl.init.callee?.property?.name;
          const typedArrayTypes = ['Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array'];

          if (typedArrayTypes.includes(calleeName) && decl.init.arguments?.length > 0) {
            const arg = decl.init.arguments[0];
            // Handle: new Uint32Array([1, 2, 3])
            if (arg.type === 'ArrayExpression') {
              // Preserve SCREAMING_SNAKE_CASE for module constants
              const constName = (name === name.toUpperCase() && /^[A-Z_][A-Z_0-9]*$/.test(name))
                ? name
                : this.toSnakeCase(name);
              const elemType = this.typedArrayElementType(calleeName);
              const type = CType.Array(elemType, arg.elements.length);
              const initializer = this.transformExpression(arg);

              const globalVar = new CVariable(constName, type, initializer);
              globalVar.type.isStatic = true;
              globalVar.type.isConst = true;
              targetFile.globals.push(globalVar);

              // Track the type for subscript access type inference
              this.moduleConstantTypes.set(constName, type);
              if (constName !== name)
                this.moduleConstantTypes.set(name, type);
            }
          }
          // Handle Object.freeze/seal/assign calls: const S7 = Object.freeze([...])
          else if (decl.init.callee?.type === 'MemberExpression' &&
                   decl.init.callee.object?.name === 'Object' &&
                   ['freeze', 'seal', 'assign'].includes(decl.init.callee.property?.name) &&
                   decl.init.arguments?.length > 0) {
            const innerValue = decl.init.arguments[0];
            if (innerValue.type === 'ArrayExpression' || innerValue.type === 'ArrayLiteral') {
              // Preserve SCREAMING_SNAKE_CASE for module constants like SIGMA, BLAKE2B_IV
              const constName = (name === name.toUpperCase() && /^[A-Z_][A-Z_0-9]*$/.test(name))
                ? name
                : this.toSnakeCase(name);
              const type = this.inferTypeFromValue(innerValue);
              const initializer = this.transformExpression(innerValue);

              const globalVar = new CVariable(constName, type, initializer);
              globalVar.type.isStatic = true;
              globalVar.type.isConst = true;
              targetFile.globals.push(globalVar);

              // Track the type for subscript access type inference
              this.moduleConstantTypes.set(constName, type);
              if (constName !== name)
                this.moduleConstantTypes.set(name, type);

              // Also track the length for array_length lookups
              if (innerValue.elements?.length) {
                this.registerVariableType(constName + '_length', CType.SizeT());
                // Add a #define for the array length (use same case as array reference)
                const lengthDefine = new CDefine(
                  constName + '_length',
                  CLiteral.Int(innerValue.elements.length)
                );
                targetFile.defines.push(lengthDefine);
              }
            }
          }
          // Handle OpCodes.Hex32ToDWords/Hex64ToDQWords/Hex8ToBytes calls
          // IL AST format: { type: 'OpCodesCall', method: 'Hex32ToDWords', arguments: [...] }
          // Raw JS AST format: { callee: { object: { name: 'OpCodes' }, property: { name: 'Hex32ToDWords' } } }
          else if ((decl.init.type === 'OpCodesCall' &&
                    ['Hex32ToDWords', 'Hex64ToDQWords', 'Hex8ToBytes'].includes(decl.init.method) &&
                    decl.init.arguments?.length > 0) ||
                   (decl.init.callee?.type === 'MemberExpression' &&
                    decl.init.callee.object?.name === 'OpCodes' &&
                    ['Hex32ToDWords', 'Hex64ToDQWords', 'Hex8ToBytes'].includes(decl.init.callee.property?.name) &&
                    decl.init.arguments?.length > 0)) {
            // Get method name from either IL AST or raw JS AST
            const methodName = decl.init.method || decl.init.callee.property.name;
            const hexArg = decl.init.arguments[0];

            // Get the hex string value
            let hexString = '';
            if (hexArg.type === 'Literal' && typeof hexArg.value === 'string') {
              hexString = hexArg.value;
            } else if (hexArg.type === 'StringLiteral') {
              hexString = hexArg.value;
            }

            if (hexString) {
              // Preserve SCREAMING_SNAKE_CASE for module constants
              const constName = (name === name.toUpperCase() && /^[A-Z_][A-Z_0-9]*$/.test(name))
                ? name
                : this.toSnakeCase(name);

              let elemType, bytesPerElement, suffix;
              switch (methodName) {
                case 'Hex64ToDQWords':
                  elemType = CType.UInt64();
                  bytesPerElement = 16; // 16 hex chars = 8 bytes = 64 bits
                  suffix = 'ULL';
                  break;
                case 'Hex32ToDWords':
                  elemType = CType.UInt32();
                  bytesPerElement = 8; // 8 hex chars = 4 bytes = 32 bits
                  suffix = 'U';
                  break;
                case 'Hex8ToBytes':
                default:
                  elemType = CType.UInt8();
                  bytesPerElement = 2; // 2 hex chars = 1 byte
                  suffix = '';
                  break;
              }

              // Parse hex string into array of values
              const values = [];
              for (let i = 0; i < hexString.length; i += bytesPerElement) {
                const chunk = hexString.slice(i, i + bytesPerElement);
                if (chunk.length === bytesPerElement) {
                  values.push('0x' + chunk + suffix);
                }
              }

              if (values.length > 0) {
                const type = CType.Array(elemType, values.length);
                const initializer = new CArrayInitializer(values.map(v => new CLiteral(v, 'raw')));

                const globalVar = new CVariable(constName, type, initializer);
                globalVar.type.isStatic = true;
                globalVar.type.isConst = true;
                targetFile.globals.push(globalVar);

                // Track the type for subscript access type inference
                this.moduleConstantTypes.set(constName, type);
                if (constName !== name)
                  this.moduleConstantTypes.set(name, type);

                // Add a #define for the array length
                const lengthDefine = new CDefine(
                  constName + '_length',
                  CLiteral.Int(values.length)
                );
                targetFile.defines.push(lengthDefine);
              }
            }
          }
        }
        // Handle object expressions as global structs (e.g., const Tables = { T0, T1, ... })
        else if (decl.init.type === 'ObjectExpression') {
          // Preserve SCREAMING_SNAKE_CASE for module constants like MAYO_PARAMS, CROSS_PARAMS
          const constName = (name === name.toUpperCase() && /^[A-Z_][A-Z_0-9]*$/.test(name))
            ? name
            : this.toSnakeCase(name);

          // Create a struct type for this object
          const structName = this.toPascalCase(name) + 'T';
          const fields = [];

          for (const prop of decl.init.properties || []) {
            const propName = prop.key?.name || prop.key?.value;
            if (!propName) continue;

            const fieldName = this.toSnakeCase(propName);
            // Property value might be an identifier referencing a hoisted array
            let fieldType;
            if (prop.value?.type === 'Identifier') {
              // Reference to another variable - use pointer type
              fieldType = CType.Pointer(CType.UInt32());
            } else {
              fieldType = this.inferTypeFromValue(prop.value);
            }
            fields.push({ name: fieldName, type: fieldType });
          }

          // Only emit if there are fields
          if (fields.length > 0) {
            // Create struct definition if not exists
            if (!this.emittedStructs?.has(structName)) {
              const struct = new CStruct(structName);
              struct.isTypedef = true;  // Generate as typedef
              // Add fields to the struct (CStruct constructor doesn't take fields param)
              for (const f of fields) {
                struct.fields.push(new CField(f.name, f.type));
              }
              targetFile.structs.push(struct);
              if (!this.emittedStructs) this.emittedStructs = new Set();
              this.emittedStructs.add(structName);
            }

            // Create global variable with initializer
            const initFields = [];
            for (const prop of decl.init.properties || []) {
              const propName = prop.key?.name || prop.key?.value;
              if (!propName) continue;
              // Don't add '.' here - the emitter adds it
              const fieldName = this.toSnakeCase(propName);
              const fieldValue = this.transformExpression(prop.value);
              initFields.push({ name: fieldName, value: fieldValue });
            }

            const globalVar = new CVariable(
              constName,
              new CType(structName),
              new CStructInitializer(initFields)
            );
            globalVar.type.isStatic = true;
            globalVar.type.isConst = node.kind === 'const';
            targetFile.globals.push(globalVar);

            // Track the type for reference resolution
            this.moduleConstantTypes.set(constName, new CType(structName));
            if (constName !== name)
              this.moduleConstantTypes.set(name, new CType(structName));
          }
        }
      }
    }

    /**
     * Get the C element type for a JavaScript typed array constructor
     */
    typedArrayElementType(typedArrayName) {
      switch (typedArrayName) {
        case 'Uint8Array': case 'Uint8ClampedArray': return CType.UInt8();
        case 'Int8Array': return CType.Int8();
        case 'Uint16Array': return CType.UInt16();
        case 'Int16Array': return CType.Int16();
        case 'Uint32Array': return CType.UInt32();
        case 'Int32Array': return CType.Int32();
        case 'Float32Array': return new CType('float');
        case 'Float64Array': return new CType('double');
        case 'BigUint64Array': return CType.UInt64();
        case 'BigInt64Array': return CType.Int64();
        default: return CType.UInt8();
      }
    }

    /**
     * Infer C type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return CType.UInt32();

      switch (valueNode.type) {
        case 'Literal':
          // Handle null literals - they represent pointer types
          if (valueNode.value === null) {
            return CType.Pointer(CType.Void());
          }
          // Handle BigInt literals - 64-bit integers
          if (typeof valueNode.value === 'bigint') {
            const val = valueNode.value;
            if (val < 0n) return CType.Int64();
            return CType.UInt64();
          }
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              return valueNode.value >= 0 ? CType.UInt32() : CType.Int32();
            }
            return new CType('double');
          }
          if (typeof valueNode.value === 'string') return CType.Pointer(CType.Char());
          if (typeof valueNode.value === 'boolean') return CType.Bool();
          return CType.UInt32();

        case 'ArrayExpression':
        case 'ArrayLiteral':
          if (valueNode.elements && valueNode.elements.length > 0) {
            // Handle [...arr] spread - returns same type as arr (pointer copy)
            if (valueNode.elements.length === 1 && valueNode.elements[0]?.type === 'SpreadElement') {
              const spreadArg = valueNode.elements[0].argument;
              const argType = this.inferTypeFromValue(spreadArg);
              // If source is a pointer, return same pointer type
              if (argType && (argType.isPointer || argType.pointerLevel > 0))
                return argType;
              // If source is an array, return pointer to element type
              if (argType && argType.isArray && argType.baseType)
                return CType.Pointer(argType.baseType);
              // Default to uint8_t* for spread of byte arrays
              return CType.Pointer(CType.UInt8());
            }
            // Check if any element is a SpreadElement - these become pointer types
            if (valueNode.elements.some(e => e?.type === 'SpreadElement')) {
              // Multiple spreads or mixed - result is a pointer to element type
              const firstElem = valueNode.elements.find(e => e && e.type !== 'SpreadElement');
              if (firstElem) {
                return CType.Pointer(this.inferTypeFromValue(firstElem));
              }
              return CType.Pointer(CType.UInt8());
            }
            // Check if all literal elements fit in uint8_t (0-255) - common for byte arrays
            // This is important for padding algorithms where [0x80] should be uint8_t[]
            const allByteLiterals = valueNode.elements.every(e => {
              if (!e || e.type !== 'Literal') return false;
              return typeof e.value === 'number' && Number.isInteger(e.value) && e.value >= 0 && e.value <= 255;
            });
            if (allByteLiterals && valueNode.elements.length > 0) {
              return CType.Array(CType.UInt8(), valueNode.elements.length);
            }
            const elemType = this.inferTypeFromValue(valueNode.elements[0]);
            return CType.Array(elemType, valueNode.elements.length);
          }
          return CType.Array(CType.UInt8(), 0);

        // IL AST node for OpCodes.Unpack32BE/LE etc - always returns byte array
        case 'UnpackBytes':
          return CType.Pointer(CType.UInt8());

        case 'CallExpression':
        case 'NewExpression': {
          // Check for String.fromCharCode(...spread) - returns char*
          if (valueNode.callee?.type === 'MemberExpression' &&
              valueNode.callee.object?.name === 'String' &&
              (valueNode.callee.property?.name === 'fromCharCode' || valueNode.callee.property?.value === 'fromCharCode')) {
            const hasSpread = valueNode.arguments?.some(arg => arg.type === 'SpreadElement');
            if (hasSpread) {
              return CType.Pointer(CType.Char());
            }
            // Single char code returns char
            return CType.Char();
          }

          // For NewExpression with direct class name (new ClassName()), return pointer to that type
          if (valueNode.type === 'NewExpression' && valueNode.callee?.type === 'Identifier') {
            const className = valueNode.callee.name;
            // Check if we know this class as a struct
            const structName = this.toPascalCase(className);
            if (this.generatedStructs.has(structName) || this.knownClasses?.has(className)) {
              return CType.Pointer(new CType(structName));
            }
            // Even if not yet registered, assume it's a valid struct type for new expressions
            return CType.Pointer(new CType(structName));
          }

          // Try to infer from function name
          const calleeName = valueNode.callee?.name ||
            valueNode.callee?.property?.name ||
            (valueNode.callee?.type === 'Identifier' ? valueNode.callee.name : null);

          if (calleeName) {
            // Handle BigInt() constructor - returns 64-bit integer
            if (calleeName === 'BigInt') {
              return CType.UInt64();
            }

            // Handle known helper functions that return specific types
            const lowerName = calleeName.toLowerCase();
            if (lowerName === 'ansi_to_bytes' || lowerName === 'ansitobytes' ||
                lowerName === 'hex_to_bytes' || lowerName === 'hextobytes' ||
                lowerName === 'hex8tobytes') {
              return CType.Pointer(CType.UInt8());
            }

            // Pack functions return packed integer types
            if (lowerName === 'pack32be' || lowerName === 'pack32le' || lowerName === 'packbytes' ||
                lowerName === 'pack_bytes' || lowerName === 'pack32_be' || lowerName === 'pack32_le') {
              return CType.UInt32();
            }
            if (lowerName === 'pack16be' || lowerName === 'pack16le' ||
                lowerName === 'pack16_be' || lowerName === 'pack16_le') {
              return CType.UInt16();
            }
            if (lowerName === 'pack64be' || lowerName === 'pack64le' ||
                lowerName === 'pack64_be' || lowerName === 'pack64_le') {
              return CType.UInt64();
            }

            // CopyArray returns the same type as its source argument
            if (lowerName === 'copyarray' || lowerName === 'copy_array' ||
                lowerName === 'copy_array_ret') {
              // For OpCodes.CopyArray(src), infer type from the source argument
              if (valueNode.arguments?.length > 0) {
                const srcArg = valueNode.arguments[0];
                const srcType = this.inferTypeFromValue(srcArg);
                if (srcType && (srcType.isPointer || srcType.isArray)) {
                  return srcType;
                }
                // Check source name for hints
                const srcName = srcArg.name || srcArg.property?.name || '';
                const lowerSrcName = srcName.toLowerCase();
                if (lowerSrcName.includes('word') || lowerSrcName.includes('key') ||
                    lowerSrcName === 'v' || lowerSrcName === 'k') {
                  return CType.Pointer(CType.UInt32());
                }
              }
              // Default to uint32_t* for crypto word arrays
              return CType.Pointer(CType.UInt32());
            }

            // Unpack functions return byte arrays (uint8_t*)
            if (lowerName === 'unpack32_be_ret' || lowerName === 'unpack32_le_ret' ||
                lowerName === 'unpack16_be_ret' || lowerName === 'unpack16_le_ret' ||
                lowerName === 'unpack64_be_ret' || lowerName === 'unpack64_le_ret' ||
                lowerName === 'unpack32beret' || lowerName === 'unpack32leret' ||
                lowerName === 'unpack16beret' || lowerName === 'unpack16leret' ||
                lowerName === 'unpack64beret' || lowerName === 'unpack64leret') {
              return CType.Pointer(CType.UInt8());
            }

            // String helper functions (including JS method names before transformation)
            if (lowerName === 'bytes_to_ansi' || lowerName === 'bytestoansi' ||
                lowerName === 'string_trim' || lowerName === 'stringtrim' ||
                lowerName === 'trim' || lowerName === 'fromcharcode' || lowerName === 'apply' ||
                lowerName === 'filter_alpha' || lowerName === 'filteralpha' ||
                lowerName === 'filter_digits' || lowerName === 'filterdigits' ||
                lowerName === 'remove_whitespace' || lowerName === 'removewhitespace' ||
                lowerName === 'string_concat' || lowerName === 'string_append_char' ||
                lowerName === 'strcat' || lowerName === 'strdup' || lowerName === 'strndup') {
              return CType.Pointer(CType.Char());
            }

            if (lowerName === 'string_split' || lowerName === 'stringsplit' || lowerName === 'split') {
              // string_split/split returns char** (array of strings)
              return CType.Pointer(CType.Pointer(CType.Char()));
            }

            // String method return types from JS - these always return char*
            if (lowerName === 'tostring' || lowerName === 'to_string' ||
                lowerName === 'touppercase' || lowerName === 'to_upper_case' || lowerName === 'toupper' ||
                lowerName === 'tolowercase' || lowerName === 'to_lower_case' || lowerName === 'tolower' ||
                lowerName === 'replace' || lowerName === 'replaceall' ||
                lowerName === 'substring' || lowerName === 'substr') {
              return CType.Pointer(CType.Char());
            }

            // slice - check the object being sliced for proper return type
            if (lowerName === 'slice') {
              // For method calls like obj.slice(start, end), check the object type
              if (valueNode.callee?.type === 'MemberExpression' && valueNode.callee.object) {
                const objType = this.inferTypeFromValue(valueNode.callee.object);
                if (objType && objType.isPointer && objType.baseType) {
                  // Return same pointer type as source array
                  return objType;
                }
                // Check if object name suggests byte array (key, data, bytes, etc.)
                const objName = valueNode.callee.object.name || '';
                const lowerObjName = objName.toLowerCase();
                if (lowerObjName.includes('key') || lowerObjName.includes('byte') ||
                    lowerObjName.includes('data') || lowerObjName.includes('block') ||
                    lowerObjName.includes('input') || lowerObjName.includes('output')) {
                  return CType.Pointer(CType.UInt8());
                }
              }
              // Default to char* for string slices
              return CType.Pointer(CType.Char());
            }

            // Functions ending in _new typically return pointers
            if (calleeName.endsWith('_new') || calleeName.endsWith('New')) {
              // Extract struct name from function name (e.g., anubis_instance_new -> AnubisInstance*)
              const match = calleeName.match(/^(.+?)_?new$/i);
              if (match) {
                const structName = this.toPascalCase(match[1]);
                return CType.Pointer(new CType(structName));
              }
            }

            // Key schedule generation functions return uint32_t** (2D arrays of round keys)
            if (lowerName.includes('generatekeyschedule') || lowerName.includes('generate_key_schedule') ||
                lowerName.includes('expandkey') || lowerName.includes('expand_key') ||
                lowerName.includes('keyschedule') || lowerName.includes('key_schedule') ||
                lowerName.includes('getroundkeys') || lowerName.includes('get_round_keys')) {
              return CType.Pointer(CType.Pointer(CType.UInt32()));
            }

            // Functions that transform arrays typically return pointers
            // e.g., rotate_right, xor_words, encrypt_block, etc.
            if (lowerName.includes('rotate') || lowerName.includes('xor') ||
                lowerName.includes('_fo') || lowerName.includes('_fe') ||
                lowerName.includes('encrypt') || lowerName.includes('decrypt') ||
                lowerName.includes('transform') || lowerName.includes('permute') ||
                lowerName.includes('substitute') || lowerName.includes('_block') ||
                lowerName.includes('mix') || lowerName.includes('shift')) {
              // Crypto transformation functions typically return uint32_t* for word arrays
              return CType.Pointer(CType.UInt32());
            }

            // CreateInstance returns a pointer to an instance of the same type
            // e.g., des_algorithm.CreateInstance() -> DESInstance*
            if (lowerName === 'createinstance' || lowerName === 'create_instance') {
              // Try to get the type from the object being called on
              if (valueNode.callee?.type === 'MemberExpression' && valueNode.callee.object) {
                const objType = this.inferTypeFromValue(valueNode.callee.object);
                if (objType && objType.name) {
                  // Algorithm -> Instance type mapping
                  let typeName = objType.name.replace(/\*/g, '').trim();
                  // DESAlgorithm -> DESInstance
                  typeName = typeName.replace(/Algorithm$/, 'Instance');
                  return CType.Pointer(new CType(typeName));
                }
              }
              // Default to returning a pointer to an unknown instance type
              return CType.Pointer(new CType('void'));
            }
            // Look up known function return types
            const func = this.functions.get(this.toSnakeCase(calleeName));
            if (func && func.returnType && func.returnType.name !== 'void')
              return func.returnType;
          }
          // Default for function calls - assume returns something
          return CType.UInt32();
        }

        case 'Identifier': {
          // Handle null Identifier (some parsers represent null this way instead of as Literal)
          if (valueNode.name === 'null') {
            return CType.Pointer(CType.Void());
          }
          // Look up variable type
          const varType = this.getVariableType(valueNode.name);
          if (varType) return varType;
          return this.inferTypeFromName(valueNode.name);
        }

        case 'MemberExpression': {
          // Handle computed (subscript) access on static class fields: ClassName.Field[index]
          // For 2D arrays like AriaInstance.C[0], return pointer to inner array row
          if (valueNode.computed && valueNode.object && valueNode.object.type === 'MemberExpression') {
            const innerObj = valueNode.object;
            // Check if inner object is ClassName.Property pattern
            if (innerObj.object && innerObj.object.type === 'Identifier' && innerObj.property) {
              const className = innerObj.object.name;
              const fieldName = innerObj.property.name || innerObj.property.value;
              if (this.classNames.has(className)) {
                const staticKey = `${className}.${fieldName}`;
                const fieldType = this.staticClassFieldTypes.get(staticKey);
                if (fieldType) {
                  // For 2D array types, subscript returns pointer to inner element type
                  // e.g., uint32_t[3][4] -> uint32_t[4] -> uint32_t*
                  // CType.Array stores element type in 'baseType', not 'elementType'
                  if (fieldType.isArray && fieldType.baseType) {
                    // For nested arrays, base type is also an array
                    if (fieldType.baseType.isArray)
                      return CType.Pointer(fieldType.baseType.baseType);
                    return CType.Pointer(fieldType.baseType);
                  }
                  if (fieldType.isPointer && fieldType.baseType)
                    return fieldType.baseType;
                }
              }
            }
          }

          // Handle computed (subscript) access on this.field: this.field[index]
          // e.g., this.decodeTable[i] returns element type of decodeTable
          if (valueNode.computed && valueNode.object && valueNode.object.type === 'ThisPropertyAccess') {
            const fieldName = typeof valueNode.object.property === 'string'
              ? valueNode.object.property
              : (valueNode.object.property?.name || valueNode.object.property?.value);
            if (fieldName) {
              let snakeField = this.toSnakeCase(fieldName);
              const strippedField = snakeField.startsWith('_') ? snakeField.substring(1) : snakeField;

              // Look up field type in structFieldTypes
              const fieldType = this.structFieldTypes.get(fieldName) ||
                               this.structFieldTypes.get(snakeField) ||
                               this.structFieldTypes.get(strippedField);
              if (fieldType) {
                // For double pointers (uint32_t**), subscript returns single pointer (uint32_t*)
                // baseType of uint32_t** is already uint32_t*, so return it directly
                if (fieldType.isPointer && fieldType.pointerLevel > 1 && fieldType.baseType) {
                  return fieldType.baseType;
                }
                // For array/pointer types, subscript returns element type
                if (fieldType.isArray && fieldType.baseType) {
                  return fieldType.baseType;
                }
                if (fieldType.isPointer && fieldType.baseType) {
                  return fieldType.baseType;
                }
              }

              // Also check current struct fields
              if (this.currentStruct && this.currentStruct.fields) {
                for (const field of this.currentStruct.fields) {
                  if (field.name === fieldName || field.name === snakeField || field.name === strippedField) {
                    const ft = field.type;
                    // For double pointers (uint32_t**), subscript returns single pointer (uint32_t*)
                    // baseType of uint32_t** is already uint32_t*, so return it directly
                    if (ft && ft.isPointer && ft.pointerLevel > 1 && ft.baseType) {
                      return ft.baseType;
                    }
                    if (ft && ft.isArray && ft.baseType) {
                      return ft.baseType;
                    }
                    if (ft && ft.isPointer && ft.baseType) {
                      return ft.baseType;
                    }
                    return ft;
                  }
                }
              }

              // Fallback: infer from field name
              // Common patterns: decodeTable, encodeTable -> uint8_t elements
              const lowerField = fieldName.toLowerCase();

              // Key-related field names that are arrays of pointers
              if (lowerField.includes('roundkey') || lowerField.includes('round_key') ||
                  lowerField.includes('subkey') || lowerField.includes('sub_key') ||
                  lowerField === 'keys' || lowerField === 'rk') {
                // Round keys are typically arrays of uint32_t arrays, subscripting gives uint32_t*
                return CType.Pointer(CType.UInt32());
              }
              if (lowerField.includes('table') || lowerField.includes('lookup') ||
                  lowerField.includes('map') || lowerField.includes('sbox')) {
                return CType.UInt32(); // Lookup tables typically contain uint32_t
              }
            }
          }

          // Handle computed (subscript) access on local variables: arr[index]
          // e.g., paddedData[paddedData.length - 1] returns element type of paddedData
          if (valueNode.computed && valueNode.object && valueNode.object.type === 'Identifier') {
            const varName = valueNode.object.name;
            const snakeVarName = this.toSnakeCase(varName);
            // Look up variable type from local scope first
            const varType = this.getVariableType(varName) || this.getVariableType(snakeVarName);
            if (varType) {
              // For array/pointer types, subscript returns element type
              if (varType.isArray && varType.baseType)
                return varType.baseType;
              if (varType.isPointer && varType.baseType)
                return varType.baseType;
            }
            // Also check module-level constants (e.g., sigma, s7, s9)
            const constType = this.moduleConstantTypes.get(varName) ||
                              this.moduleConstantTypes.get(snakeVarName) ||
                              this.moduleConstantTypes.get(varName.toLowerCase());
            if (constType) {
              // For 2D array types (e.g., uint8_t[10][16]), subscript returns pointer to inner array element type
              if (constType.isArray && constType.baseType) {
                if (constType.baseType.isArray && constType.baseType.baseType) {
                  // 2D array: sigma[i] returns const uint8_t* (pointer to row)
                  const innerType = CType.Pointer(constType.baseType.baseType);
                  innerType.isConst = true;
                  return innerType;
                }
                // 1D array: subscript returns element type
                return constType.baseType;
              }
              if (constType.isPointer && constType.baseType)
                return constType.baseType;
            }
            // Fallback: infer element type from variable name
            const lowerName = varName.toLowerCase();
            if (lowerName.includes('data') || lowerName.includes('bytes') ||
                lowerName.includes('input') || lowerName.includes('output') ||
                lowerName.includes('buffer') || lowerName.includes('result') ||
                lowerName.includes('key') || lowerName.includes('block'))
              return CType.UInt8();
            return CType.UInt32();
          }

          // For obj.field or self->field access
          if (valueNode.property) {
            const propName = valueNode.property.name || valueNode.property.value;
            if (!propName) break;  // Guard against undefined property names

            // Try to infer the object's type and look up the field type
            if (valueNode.object) {
              // Handle ThisExpression specially - use current struct context
              // this.currentStruct is a CStruct object with fields array directly
              if (valueNode.object.type === 'ThisExpression') {
                let snakeProp = this.toSnakeCase(propName);
                // Strip leading underscore - struct fields are stored without it
                const strippedProp = snakeProp.startsWith('_') ? snakeProp.substring(1) : snakeProp;

                // First try struct fields if populated
                if (this.currentStruct && this.currentStruct.fields && this.currentStruct.fields.length > 0) {
                  for (const field of this.currentStruct.fields) {
                    if (field.name === propName || field.name === snakeProp || field.name === strippedProp)
                      return field.type;
                  }
                }

                // Also check structFieldTypes map (may have types from earlier parsing)
                const fieldType = this.structFieldTypes.get(propName) || this.structFieldTypes.get(snakeProp) || this.structFieldTypes.get(strippedProp);
                if (fieldType) return fieldType;

                // For common pointer-returning property names, return pointer type
                // This is crucial during pre-scan when struct fields aren't yet populated
                const lowerProp = propName.toLowerCase();
                if (lowerProp.includes('data') || lowerProp.includes('result') ||
                    lowerProp.includes('buffer') || lowerProp.includes('output') ||
                    lowerProp.includes('processed') || lowerProp.includes('bytes') ||
                    lowerProp === 'aad') {
                  return CAST.CType.Pointer(CAST.CType.UInt8());
                }

                // Fall back to name-based inference for this.property
                return this.inferTypeFromName(propName);
              }

              const objType = this.inferTypeFromValue(valueNode.object);
              if (objType && objType.name) {
                // Get the struct name - for pointers, use baseType if available
                let structName = objType.name;
                if (objType.isPointer && objType.baseType && objType.baseType.name) {
                  structName = objType.baseType.name;
                }
                // Remove pointer suffix if present
                structName = structName.replace(/\*+$/, '').trim();

                // Look up this struct type to find the field type
                let snakeProp = this.toSnakeCase(propName);
                const strippedProp = snakeProp.startsWith('_') ? snakeProp.substring(1) : snakeProp;
                const structFields = this.structFieldTypes.get(propName) || this.structFieldTypes.get(snakeProp) || this.structFieldTypes.get(strippedProp);
                if (structFields) return structFields;

                // Check if we have a generated struct with this type
                const structDef = this.generatedStructs.get(structName);
                // structDef might be a CStruct object (when stored by name) or a string (when stored by signature)
                if (structDef && typeof structDef === 'object' && structDef.fields) {
                  for (const field of structDef.fields) {
                    if (field.name === propName || field.name === snakeProp || field.name === strippedProp)
                      return field.type;
                  }
                }

                // Also check targetFile.structs as a fallback
                if (this.targetFile && this.targetFile.structs) {
                  for (const s of this.targetFile.structs) {
                    if (s.name === structName && s.fields) {
                      for (const field of s.fields) {
                        if (field.name === propName || field.name === snakeProp || field.name === strippedProp)
                          return field.type;
                      }
                    }
                  }
                }
              }
            }

            return this.inferTypeFromName(propName);
          }
          return CType.UInt32();
        }

        case 'ThisPropertyAccess': {
          // IL AST: this.property - look up struct field type
          const propName = typeof valueNode.property === 'string'
            ? valueNode.property
            : (valueNode.property?.name || valueNode.property?.value);
          if (propName) {
            let snakeProp = this.toSnakeCase(propName);
            // Strip leading underscore - struct fields are stored without it
            const strippedProp = snakeProp.startsWith('_') ? snakeProp.substring(1) : snakeProp;

            // First try struct fields if populated
            if (this.currentStruct && this.currentStruct.fields && this.currentStruct.fields.length > 0) {
              for (const field of this.currentStruct.fields) {
                if (field.name === propName || field.name === snakeProp || field.name === strippedProp)
                  return field.type;
              }
            }

            // Also check structFieldTypes map (may have types from earlier parsing)
            const fieldType = this.structFieldTypes.get(propName) || this.structFieldTypes.get(snakeProp) || this.structFieldTypes.get(strippedProp);
            if (fieldType) return fieldType;

            // For common pointer-returning property names, return pointer type
            // This is crucial during pre-scan when struct fields aren't yet populated
            const lowerProp = propName.toLowerCase();
            if (lowerProp.includes('data') || lowerProp.includes('result') ||
                lowerProp.includes('buffer') || lowerProp.includes('output') ||
                lowerProp.includes('processed') || lowerProp.includes('bytes') ||
                lowerProp === 'aad')
              return CType.Pointer(CType.UInt8());

            // Fall back to name-based inference
            return this.inferTypeFromName(propName);
          }
          return CType.UInt32();
        }

        case 'ConditionalExpression':
          // Infer from consequent (true branch)
          return this.inferTypeFromValue(valueNode.consequent);

        case 'LogicalExpression':
          // For || (OR), infer from left operand since `a || b` returns `a` if truthy
          // This handles patterns like `this.aad || []` where left is a pointer
          if (valueNode.operator === '||') {
            const leftType = this.inferTypeFromValue(valueNode.left);
            if (leftType && (leftType.isPointer || leftType.pointerLevel > 0))
              return leftType;
            // Otherwise try the right operand
            const rightType = this.inferTypeFromValue(valueNode.right);
            if (rightType && (rightType.isPointer || rightType.pointerLevel > 0))
              return rightType;
            return leftType || rightType || CType.UInt32();
          }
          // For && (AND), infer from right operand since `a && b` returns `b` if `a` is truthy
          if (valueNode.operator === '&&') {
            const rightType = this.inferTypeFromValue(valueNode.right);
            if (rightType && (rightType.isPointer || rightType.pointerLevel > 0))
              return rightType;
            // Otherwise try the left operand
            const leftType = this.inferTypeFromValue(valueNode.left);
            if (leftType && (leftType.isPointer || leftType.pointerLevel > 0))
              return leftType;
            return rightType || leftType || CType.UInt32();
          }
          return CType.UInt32();

        case 'BinaryExpression':
          // Comparison operators return bool
          if (['===', '==', '!==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(valueNode.operator))
            return CType.Bool();
          // String concatenation with + operator returns char*
          if (valueNode.operator === '+') {
            const leftType = this.inferTypeFromValue(valueNode.left);
            const rightType = this.inferTypeFromValue(valueNode.right);
            const isLeftString = leftType && (leftType.name === 'char*' || leftType.name === 'const char*' ||
                (leftType.isPointer && (leftType.baseType === 'char' || leftType.baseType?.name === 'char')));
            const isRightString = rightType && (rightType.name === 'char*' || rightType.name === 'const char*' ||
                (rightType.isPointer && (rightType.baseType === 'char' || rightType.baseType?.name === 'char')));
            const isLeftLiteralString = valueNode.left.type === 'Literal' && typeof valueNode.left.value === 'string';
            const isRightLiteralString = valueNode.right.type === 'Literal' && typeof valueNode.right.value === 'string';
            if (isLeftString || isRightString || isLeftLiteralString || isRightLiteralString) {
              // String + anything or anything + string = string
              return CType.Pointer(CType.Char());
            }
          }
          return CType.UInt32();

        case 'UnaryExpression':
          // Numeric operations typically return numbers
          if (['===', '==', '!==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(valueNode.operator))
            return CType.Bool();
          return CType.UInt32();

        case 'ObjectExpression':
          // Generate a struct type for object literals
          return this.generateStructTypeForObject(valueNode);

        case 'ThisMethodCall': {
          // IL AST: this.method() - look up method return type
          const methodName = valueNode.method;
          if (methodName) {
            // Try various name formats to find the method
            const lookups = [
              methodName,                           // Original JS name (e.g., _getVariantConfig)
              this.toSnakeCase(methodName),         // Snake case (e.g., _get_variant_config)
              methodName.replace(/^_/, ''),         // Without leading underscore
              this.toSnakeCase(methodName.replace(/^_/, ''))  // Snake case without underscore
            ];

            for (const lookup of lookups) {
              const func = this.functions.get(lookup);
              if (func && func.returnType && func.returnType.name !== 'void') {
                return func.returnType;
              }
            }

            // If function not found, try to infer from method name patterns
            const lowerMethod = methodName.toLowerCase();

            // Methods returning byte arrays (uint8_t*)
            if (lowerMethod.includes('mac') || lowerMethod.includes('poly1305') ||
                lowerMethod.includes('digest') || lowerMethod.includes('hash') ||
                lowerMethod.includes('tobytes') || lowerMethod.includes('to_bytes') ||
                lowerMethod.includes('getbytes') || lowerMethod.includes('get_bytes') ||
                lowerMethod.includes('biginttobytes') || lowerMethod.includes('bigint_to_bytes') ||
                lowerMethod.includes('inttobytes') || lowerMethod.includes('int_to_bytes') ||
                lowerMethod.includes('generatekey') || lowerMethod.includes('generate_key') ||
                lowerMethod.includes('derive') || lowerMethod.includes('finalize')) {
              // MAC/hash/digest/key generation methods return byte arrays
              return CType.Pointer(CType.UInt8());
            }

            // Block cipher encrypt/decrypt methods operating on data return byte arrays
            // These include _encryptBlock, _decryptBlock, encryptData, decryptData, etc.
            if ((lowerMethod.includes('encrypt') || lowerMethod.includes('decrypt')) &&
                (lowerMethod.includes('block') || lowerMethod.includes('data') ||
                 lowerMethod.includes('byte') || lowerMethod.includes('message'))) {
              return CType.Pointer(CType.UInt8());
            }

            if (lowerMethod.includes('rotate') || lowerMethod.includes('xor') ||
                lowerMethod === '_fo' || lowerMethod === 'fo' ||
                lowerMethod === '_fe' || lowerMethod === 'fe' ||
                lowerMethod.includes('transform') || lowerMethod.includes('permute') ||
                lowerMethod.includes('substitute') ||
                lowerMethod.includes('mix') || lowerMethod.includes('shift') ||
                lowerMethod.includes('words')) {
              // Crypto transformation methods on words typically return uint32_t*
              return CType.Pointer(CType.UInt32());
            }
          }
          return CType.UInt32();
        }

        case 'ArraySlice': {
          // IL AST node for array.slice(start, end)
          // Return the same pointer type as the source array
          if (valueNode.array) {
            const sourceType = this.inferTypeFromValue(valueNode.array);
            // If source is already a pointer type, return it directly
            if (sourceType && sourceType.isPointer) {
              return sourceType;
            }
            // If source is an array type, return pointer to element type
            if (sourceType && sourceType.isArray && sourceType.elementType) {
              return CType.Pointer(sourceType.elementType);
            }
            // Check source array name for byte array hints
            const arrayName = valueNode.array.name || valueNode.array.property?.name || '';
            const lowerArrayName = arrayName.toLowerCase();
            if (lowerArrayName.includes('key') || lowerArrayName.includes('byte') ||
                lowerArrayName.includes('data') || lowerArrayName.includes('block') ||
                lowerArrayName.includes('input') || lowerArrayName.includes('output') ||
                lowerArrayName.includes('buffer')) {
              return CType.Pointer(CType.UInt8());
            }
          }
          // Default to uint8_t* for array slices (common in crypto code)
          return CType.Pointer(CType.UInt8());
        }

        case 'HexDecode': {
          // IL AST node for OpCodes.Hex8ToBytes() - returns byte array
          return CType.Pointer(CType.UInt8());
        }

        case 'StringToBytes': {
          // IL AST node for OpCodes.AnsiToBytes() - returns byte array
          return CType.Pointer(CType.UInt8());
        }

        case 'BytesToString': {
          // IL AST node for OpCodes.BytesToAnsi() - returns string
          return CType.Pointer(new CType('char'));
        }

        case 'ArrayFill': {
          // new Array(n).fill(value) - returns pointer type based on fill value and array
          // For byte-range fill values (0-255), infer uint8_t* (common for byte buffers/padding)
          const fillValue = valueNode.value;
          const fillVal = fillValue?.type === 'Literal' && typeof fillValue.value === 'number'
            ? fillValue.value : null;

          if (valueNode.array?.type === 'TypedArrayCreation') {
            // Typed array creation - use its element type
            return this.inferTypeFromValue(valueNode.array);
          } else if (valueNode.array?.type === 'ArrayCreation') {
            // Generic array creation - use fill value heuristic
            const rawElemType = valueNode.array.elementType;
            if (!rawElemType || rawElemType === 'any' || rawElemType === 'unknown') {
              if (fillVal !== null && fillVal >= 0 && fillVal <= 255) {
                return CType.Pointer(CType.UInt8());
              }
              return CType.Pointer(CType.UInt32());
            }
            const elemType = this.mapType(rawElemType);
            if (elemType.name === 'void')
              return CType.Pointer(CType.UInt32());
            return CType.Pointer(elemType);
          }
          // Default fallback
          if (fillVal !== null && fillVal >= 0 && fillVal <= 255) {
            return CType.Pointer(CType.UInt8());
          }
          return CType.Pointer(CType.UInt32());
        }

        case 'ArrayCreation': {
          // new Array(n) - returns pointer to element type
          // Handle 'any' elementType - default to uint32_t for crypto code
          const rawElemType = valueNode.elementType;
          let elemType;
          if (!rawElemType || rawElemType === 'any' || rawElemType === 'unknown') {
            elemType = CType.UInt32();
          } else {
            elemType = this.mapType(rawElemType);
            if (elemType.name === 'void')
              elemType = CType.UInt32();
          }
          return CType.Pointer(elemType);
        }

        case 'TypedArrayCreation': {
          // new Uint8Array(n), new Uint32Array(n), etc.
          const typeMap = {
            'Uint8Array': CType.UInt8(),
            'Uint16Array': CType.UInt16(),
            'Uint32Array': CType.UInt32(),
            'Uint8ClampedArray': CType.UInt8(),
            'Int8Array': CType.Int8(),
            'Int16Array': CType.Int16(),
            'Int32Array': CType.Int32(),
            'Float32Array': new CType('float'),
            'Float64Array': new CType('double'),
            'BigUint64Array': CType.UInt64(),
            'BigInt64Array': CType.Int64()
          };
          const elemType = typeMap[valueNode.arrayType] || CType.UInt8();
          return CType.Pointer(elemType);
        }

        // Pack operations return packed integer types
        case 'PackBytes':
        case 'Pack32LE':
        case 'Pack32BE':
          return CType.UInt32();

        case 'Pack16LE':
        case 'Pack16BE':
          return CType.UInt16();

        case 'Pack64LE':
        case 'Pack64BE':
          return CType.UInt64();

        case 'OpCodesCall': {
          // IL AST node for OpCodes.* method calls
          const method = valueNode.method;
          if (method === 'CopyArray') {
            // CopyArray(src) returns the same type as src
            if (valueNode.arguments?.length > 0) {
              const srcArg = valueNode.arguments[0];
              const srcType = this.inferTypeFromValue(srcArg);
              if (srcType && (srcType.isPointer || srcType.isArray)) {
                return srcType;
              }
              // If source type is scalar but name suggests array, use uint32_t*
              const srcName = srcArg.name || srcArg.property?.name || '';
              const lowerName = srcName.toLowerCase();
              if (lowerName.includes('word') || lowerName.includes('key') ||
                  lowerName === 'v' || lowerName === 'k') {
                return CType.Pointer(CType.UInt32());
              }
            }
            // Default CopyArray to uint32_t* (common in crypto for word arrays)
            return CType.Pointer(CType.UInt32());
          }
          // Pack operations return packed integer types
          if (method === 'Pack32LE' || method === 'Pack32BE' || method === 'PackBytes') {
            return CType.UInt32();
          }
          if (method === 'Pack16LE' || method === 'Pack16BE') {
            return CType.UInt16();
          }
          if (method === 'Pack64LE' || method === 'Pack64BE') {
            return CType.UInt64();
          }
          // Unpack operations return byte arrays
          if (method && method.startsWith('Unpack')) {
            return CType.Pointer(CType.UInt8());
          }
          // Hex/String to bytes operations
          if (method === 'Hex8ToBytes' || method === 'AnsiToBytes' || method === 'AsciiToBytes') {
            return CType.Pointer(CType.UInt8());
          }
          return CType.UInt32();
        }

        default:
          return CType.UInt32();
      }
    }

    /**
     * Framework-specific property names that should be skipped in C code generation
     * These are metadata properties used by the JS test framework but not needed in C
     */
    static FRAMEWORK_SKIP_PROPERTIES = new Set([
      'tests', 'documentation', 'references', 'known_vulnerabilities',
      'inventor', 'year', 'category', 'sub_category', 'security_status',
      'complexity', 'country', 'name', 'description'
    ]);

    /**
     * Check if a property should be skipped in C code generation
     */
    shouldSkipProperty(propName) {
      const normalized = this.toSnakeCase(propName);
      return CTransformer.FRAMEWORK_SKIP_PROPERTIES.has(normalized);
    }

    /**
     * Generate a struct type for an object expression
     * Creates and registers a struct definition if needed
     * @param {Object} objectNode - ObjectExpression AST node
     * @param {string} hintName - Optional hint for struct name (e.g., variable name)
     * @returns {CType} The struct type
     */
    generateStructTypeForObject(objectNode, hintName = null) {
      if (!objectNode.properties || objectNode.properties.length === 0)
        return CType.UInt32();  // Empty object defaults to uint32_t

      // Build a signature based on field names and types to detect duplicates
      const fieldSignatures = [];
      const fields = [];

      for (const prop of objectNode.properties) {
        if (!prop.key) continue;

        let key = prop.key.name || String(prop.key.value) || 'unknown';
        // Strip surrounding quotes if present
        if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"')))
          key = key.slice(1, -1);

        // Skip framework-specific properties
        if (this.shouldSkipProperty(key)) continue;

        key = this.sanitizeCIdentifier(key);
        const fieldName = this.toSnakeCase(key);

        // Infer field type from value
        let fieldType = CType.UInt32();
        if (prop.value) {
          if (prop.value.type === 'ObjectExpression') {
            // Nested object - recursively generate struct
            fieldType = this.generateStructTypeForObject(prop.value, fieldName);
          } else {
            fieldType = this.inferTypeFromValue(prop.value);
          }
        }

        fieldSignatures.push(`${fieldName}:${fieldType.name}`);
        fields.push({ name: fieldName, type: fieldType });
      }

      // Create signature for deduplication
      const signature = fieldSignatures.sort().join(',');

      // Check if we already generated a struct with this signature
      // Note: generatedStructs stores both signature->name (string) and name->struct (object)
      if (this.generatedStructs.has(signature)) {
        const existingValue = this.generatedStructs.get(signature);
        // Only use if it's a string (signature->name mapping), not an object (name->struct)
        if (typeof existingValue === 'string')
          return new CType(existingValue);
      }

      // Generate struct name
      let structName;
      if (hintName) {
        // Convert to string and ensure it's a valid C identifier
        let hint = String(hintName);
        // If hint starts with a digit, prefix with 'V_' to make it valid
        if (/^\d/.test(hint))
          hint = 'V_' + hint;
        // Remove any non-alphanumeric characters except underscore
        hint = hint.replace(/[^a-zA-Z0-9_]/g, '_');
        structName = this.toPascalCase(hint) + 'T';
      } else {
        structName = 'AnonStruct' + (++this.anonStructCounter);
      }

      // Ensure unique name
      // Only increment if name is actually used (maps to a struct object, not a signature string)
      let finalName = structName;
      let counter = 1;
      while (this.generatedStructs.has(finalName) && typeof this.generatedStructs.get(finalName) === 'object') {
        finalName = structName + counter++;
      }

      // Create and register the struct
      const struct = new CStruct(finalName);
      struct.isTypedef = true;

      for (const { name, type } of fields) {
        const field = new CField(name, type);
        struct.fields.push(field);
        // Add companion _length field for pointer types (array data)
        if (type && (type.isPointer || type.pointerLevel > 0)) {
          const lengthField = new CField(`${name}_length`, CType.SizeT());
          struct.fields.push(lengthField);
        }
      }

      // Add to target file if available
      if (this.targetFile) {
        // Append to structs array - nested types are added first during recursion
        // so they will already be in the array when the parent struct is added
        this.targetFile.structs.push(struct);
      }

      // Remember this struct by its signature
      this.generatedStructs.set(signature, finalName);
      // Also store struct by name for field lookup during type inference
      this.generatedStructs.set(finalName, struct);

      return new CType(finalName);
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetFile) {
      // Push a new scope for function-local variables
      this.pushScope();

      // Macro names that conflict with potential function names
      // These are defined in CEmitter.emitCryptoHelpers
      const macroNames = new Set([
        'to_byte', 'to_uint16', 'to_uint32', 'to_uint64',
        'xor_n', 'or_n', 'and_n', 'not_n',
        'shl32', 'shr32', 'shl64', 'shr64',
        'rotl32', 'rotr32', 'rotl64', 'rotr64',
        'rotl8', 'rotr8', 'rotl16', 'rotr16',
        'get_bit', 'set_bit', 'set_bit_value', 'clear_bit', 'get_byte'
      ]);

      let funcName = this.toSnakeCase(node.id.name);

      // Rename functions that conflict with crypto helper macros
      if (macroNames.has(funcName))
        funcName = funcName + '_fn';

      // Infer return type from typeAnnotation or default to void
      let returnType = CType.Void();
      if (node.returnType || node.typeAnnotation) {
        const typeStr = node.returnType || node.typeAnnotation;
        returnType = this.mapType(typeStr);
      }

      // If still void, try to infer from body return statements
      if (returnType.name === 'void' && node.body) {
        const inferredType = this.inferReturnTypeFromBody(node.body);
        if (inferredType)
          returnType = inferredType;
      }

      const func = new CFunction(funcName, returnType);

      // Parameters
      if (node.params) {
        // Pre-scan the body to find parameters used with array subscript notation
        const paramNames = new Set(node.params.map(p => p.name));
        const arrayUsedParams = node.body
          ? this.preScanParameterArrayUsage(node.body, paramNames)
          : new Set();
        // Pre-scan the body to find parameters used as integers (bit operations)
        const integerUsedParams = node.body
          ? this.preScanParameterIntegerUsage(node.body, paramNames)
          : new Set();

        for (const param of node.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = CType.UInt32();

          // Use type annotation if available
          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          // IMPORTANT: If parameter is used with bit operations (>>, <<, &, |, ^),
          // it's an integer, not an array - override any pointer type inference
          if (integerUsedParams.has(param.name)) {
            // Force integer type, override any array/pointer inference from name
            paramType = CType.UInt32();
          }
          // If this parameter is used with array subscript notation in the body,
          // ensure it's a pointer type (but only if not used as integer)
          else if (arrayUsedParams.has(param.name) && !paramType.isPointer && !paramType.isArray) {
            // Convert scalar type to pointer type (e.g., uint32_t -> uint32_t*)
            paramType = CType.Pointer(paramType);
          }

          // For array/pointer parameters, add companion length param
          const isArrayType = paramType.isArray || paramType.isPointer ||
            (paramType.baseType && (paramType.baseType.name === 'uint8_t' || paramType.baseType.name === 'uint8_t*'));

          const cParam = new CParameter(paramName, paramType);
          func.parameters.push(cParam);

          // Add companion length parameter for array/pointer types
          if (isArrayType || paramType.isPointer) {
            const lengthParam = new CParameter(paramName + '_length', CType.SizeT());
            func.parameters.push(lengthParam);
            // Register the length parameter in scope
            this.registerVariableType(paramName + '_length', CType.SizeT());
            this.registerVariableType(param.name + '_length', CType.SizeT());
          }

          // Register parameter type under both original JS name and snake_case name
          this.registerVariableType(param.name, paramType);
          this.registerVariableType(paramName, paramType);

          // If the parameter name differs from snake_case (e.g., S1 -> s1),
          // register a rename mapping so references to S1 emit as s1
          if (param.name !== paramName) {
            this.renamedVariables.set(param.name, paramName);
          }
        }
      }

      // Body
      if (node.body) {
        // Pre-scan to infer types for variables declared without initializers
        this.preScanVariableTypes(node.body);

        // Pre-scan to infer element types for empty arrays with push operations
        const prevPushTypes = this.emptyArrayPushTypes;
        this.emptyArrayPushTypes = this.preScanEmptyArrayPushTypes(node.body);

        this.currentFunction = func;
        func.body = this.transformBlockStatement(node.body);
        this.currentFunction = null;

        this.emptyArrayPushTypes = prevPushTypes;
      }

      targetFile.functions.push(func);
      this.functions.set(funcName, func);

      // Pop the function scope
      this.popScope();
    }

    /**
     * Transform a class declaration to a C struct
     */
    transformClassDeclaration(node, targetFile) {
      const className = node.id.name; // Original class name (e.g., "AriaInstance")
      const structName = this.toPascalCase(className);
      const struct = new CStruct(structName);
      struct.isTypedef = true;  // Generate as: typedef struct TEAAlgorithm {} TEAAlgorithm;

      // Track class name for static field access detection
      this.classNames.add(className);

      const prevStruct = this.currentStruct;
      this.currentStruct = struct;

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

      const methods = [];
      const fieldNames = new Set(); // Track already added fields to avoid duplicates
      let constructorMember = null; // Track constructor for _new function generation

      // Helper to add field, updating existing field type if new type is more specific
      const addField = (field) => {
        if (!fieldNames.has(field.name)) {
          fieldNames.add(field.name);
          struct.fields.push(field);
          // CRITICAL: Keep structFieldTypes in sync with struct.fields
          this.structFieldTypes.set(field.name, field.type);
        } else {
          // If field already exists, check if we should upgrade its type
          // This handles: constructor has this.pBox = null (uint32_t),
          // but _initialize has this.pBox = [...this.PBOX_INIT] (uint32_t*)
          const newType = field.type;
          const existingField = struct.fields.find(f => f.name === field.name);
          if (!existingField || !newType) return;

          const existingType = existingField.type;
          const existingIsScalar = existingType && !existingType.isPointer && !existingType.isArray;
          const newIsPointer = newType.isPointer || newType.isArray;
          const existingIsVoidPtr = existingType && existingType.isPointer &&
                                    existingType.baseType && existingType.baseType.name === 'void';
          const newIsSpecificPtr = newType.isPointer && newType.baseType &&
                                   newType.baseType.name !== 'void';

          // Upgrade if:
          // 1. Existing is scalar but new is pointer (e.g., uint32_t -> uint32_t*)
          // 2. Existing is void* (null) and new is specific pointer (e.g., void* -> uint32_t*)
          // 3. New has a struct pointer type (original behavior)
          const newIsStructPtr = newType.isPointer && newType.baseType &&
            !['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'char', 'void'].includes(newType.baseType.name);

          if ((existingIsScalar && newIsPointer) ||
              (existingIsVoidPtr && newIsSpecificPtr) ||
              newIsStructPtr) {
            existingField.type = newType;
            this.structFieldTypes.set(field.name, newType);

            // If upgrading to pointer, ensure we have a length companion field
            if (newIsPointer && !fieldNames.has(field.name + '_length')) {
              fieldNames.add(field.name + '_length');
              struct.fields.push(new CField(field.name + '_length', CType.SizeT()));
              this.structFieldTypes.set(field.name + '_length', CType.SizeT());
            }
          }
        }
      };

      if (members && members.length > 0) {
        // Pre-scan pass: analyze method return types BEFORE field extraction
        // This allows inferTypeFromValue to find method return types for field type inference
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind !== 'constructor') {
            const keyName = member.key?.name || member.key?.value || 'method';
            let methodSuffix = '';
            if (member.kind === 'get') methodSuffix = '_get';
            else if (member.kind === 'set') methodSuffix = '_set';
            const methodName = this.toSnakeCase(structName + '_' + keyName) + methodSuffix;

            // Infer return type from body
            let returnType = CType.Void();
            if (member.value && member.value.body) {
              const inferredType = this.inferReturnTypeFromBody(member.value.body);
              if (inferredType)
                returnType = inferredType;
            }

            // Pre-register method return type for lookup during field type inference
            if (returnType && returnType.name !== 'void') {
              this.functions.set(methodName, { returnType: returnType });
              // Also register without struct prefix for this.methodName() calls
              const shortName = this.toSnakeCase(keyName);
              this.functions.set(shortName, { returnType: returnType });
              // Also register with original JS name for this.MethodName() calls
              this.functions.set(keyName, { returnType: returnType });
            }
          }
        }

        // First pass: extract fields from constructor and property/field definitions
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
            constructorMember = member; // Save for _new function generation
            const fields = this.extractFieldsFromConstructor(member);
            for (const field of fields)
              addField(field);

            // Extract constructor parameter defaults for later use when generating new ClassName() calls
            if (member.value && member.value.params) {
              const defaults = [];
              for (const param of member.value.params) {
                if (param.type === 'AssignmentPattern' && param.left && param.right) {
                  // Standard ES6 pattern: (algorithm, level = 'L1')
                  defaults.push({
                    name: param.left.name,
                    defaultValue: param.right
                  });
                } else if (param.type === 'Identifier' && param.defaultValue) {
                  // Type-aware-transpiler pattern: Identifier with defaultValue property
                  defaults.push({
                    name: param.name,
                    defaultValue: param.defaultValue
                  });
                } else {
                  // Required parameter: no default
                  defaults.push({
                    name: param.name || (param.left && param.left.name) || 'arg',
                    defaultValue: null
                  });
                }
              }
              if (defaults.some(d => d.defaultValue !== null)) {
                this.constructorDefaults.set(className, defaults);
              }
            }
          } else if (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') {
            // Handle static fields as module-level constants
            if (member.static) {
              this.emitStaticFieldAsConstant(member, className, targetFile);
            } else {
              const field = this.transformPropertyDefinition(member);
              addField(field);
            }
          }
        }

        // Second pass: scan ALL method bodies for this.property = assignments
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.value && member.value.body) {
            const dynamicFields = this.extractDynamicFieldsFromMethod(member.value.body);
            for (const field of dynamicFields)
              addField(field);
          }
        }

        // 2.5 pass: Detect 2D array fields from double-subscript patterns like this.field[i][j]
        // and upgrade their types from pointer (T*) to pointer-to-pointer (T**)
        const twoDArrayFields = this.preScan2DArrayFields(members);
        if (twoDArrayFields.size > 0) {
          for (const field of struct.fields) {
            if (twoDArrayFields.has(field.name) || twoDArrayFields.has('_' + field.name)) {
              // Upgrade from T* to T** (pointer to pointer)
              if (field.type && field.type.isPointer && !field.type.baseType?.isPointer) {
                const innerType = field.type.baseType || CType.UInt8();
                field.type = CType.Pointer(CType.Pointer(innerType));
                this.structFieldTypes.set(field.name, field.type);
              } else if (field.type && !field.type.isPointer) {
                // Scalar type - upgrade to pointer-to-pointer
                field.type = CType.Pointer(CType.Pointer(field.type));
                this.structFieldTypes.set(field.name, field.type);
              }
            }
          }
        }

        // Third pass: infer field types from member access patterns
        // IMPORTANT: This must happen BEFORE transforming methods so that
        // field types (like algorithm pointer) are set correctly for -> vs . access
        // Note: We need to add struct to targetFile first so findStructWithProperties works
        targetFile.structs.push(struct);
        this.inferFieldTypesFromMemberAccess(struct, members, targetFile);

        // Fourth pass: transform methods
        const generatedMethodNames = new Set(); // Track generated method names to avoid duplicates
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind !== 'constructor') {
              const method = this.transformMethodDefinition(member, structName);
              if (method && !generatedMethodNames.has(method.name)) {
                methods.push(method);
                generatedMethodNames.add(method.name);
              }
            }
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> C doesn't have static blocks
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              struct.staticInitStatements = struct.staticInitStatements || [];
              struct.staticInitStatements.push(...initStatements);
            }
          }
        }
      }

      this.currentStruct = prevStruct;

      // Struct was already added to file in third pass (before method transformation)

      // Add methods as functions and register in functions map for return type lookup
      for (const method of methods) {
        targetFile.functions.push(method);
        // Register method with full CFunction object for complete type info
        this.functions.set(method.name, method);
      }

      // Generate _new constructor function for the struct
      const newFunc = this.generateStructConstructor(structName, struct, constructorMember);
      if (newFunc) {
        targetFile.functions.push(newFunc);
        this.functions.set(newFunc.name, newFunc);
      }
    }

    /**
     * Recursively extract dynamic field assignments (this.property = ...) from method bodies
     */
    extractDynamicFieldsFromMethod(bodyNode) {
      const fields = [];
      const fieldNames = new Set();

      const addDynamicField = (propName, valueNode) => {
        let fieldName = this.toSnakeCase(propName);
        if (fieldName.startsWith('_'))
          fieldName = fieldName.substring(1);

        // CRITICAL: If value is an ObjectExpression, always generate a struct type for it
        // This handles cases like this.subKeys = { k1: ..., k2: ..., k3: ... }
        // where the constructor might have this._subKeys = null first (inferred as uint8_t*)
        // but the setter assigns a proper object structure
        if (valueNode && valueNode.type === 'ObjectExpression' && valueNode.properties && valueNode.properties.length > 0) {
          const structType = this.generateStructTypeForObject(valueNode, propName);
          if (structType && structType.name !== 'uint32_t') {
            // Use pointer to struct for object literal assignments
            const fieldType = CType.Pointer(structType);

            // Update existing field if found, otherwise add new
            const existingField = fields.find(f => f.name === fieldName);
            if (existingField) {
              existingField.type = fieldType;
              this.structFieldTypes.set(fieldName, fieldType);
            } else {
              fieldNames.add(fieldName);
              const field = new CField(fieldName, fieldType);
              fields.push(field);
              this.structFieldTypes.set(fieldName, fieldType);
            }
            return; // Struct type takes precedence, skip other inference
          }
        }

        // Check for null literal - these don't provide type info
        const isNullLiteral = valueNode && (valueNode.type === 'Literal' && valueNode.value === null) ||
                              (valueNode && valueNode.type === 'Identifier' && valueNode.name === 'null');

        // Try value-based inference to get concrete type from assignment
        let valueType = null;
        if (valueNode && !isNullLiteral) {
          valueType = this.inferTypeFromValue(valueNode);
        }

        // Get name-based type as fallback
        let fieldType = this.inferTypeFromName(propName);

        // Prefer value-based type when it provides pointer/array info or different base type
        if (valueType) {
          const valueBaseName = valueType.baseType?.name || valueType.name;
          const currentBaseName = fieldType.baseType?.name || fieldType.name;
          // Use value type if:
          // 1. It's a pointer/array (more specific than scalar)
          // 2. It has a different base type (e.g., value says uint32_t, name says uint8_t)
          if (valueType.isPointer || valueType.isArray || valueBaseName !== currentBaseName) {
            fieldType = valueType;
          }
        }

        // IMPORTANT: If name-based inference returns a pointer type, but value inferred type is scalar,
        // override to use the scalar type. This handles cases like rng_state = 0 or rng_state = x * 31 + y
        // where the name contains 'state' but the value is clearly a scalar integer, not an array.
        if (valueNode && fieldType.isPointer && !isNullLiteral) {
          const litType = this.inferTypeFromValue(valueNode);
          // Scalar type should override pointer inference for:
          // - Literal (e.g., 0, 1, 123)
          // - UnaryExpression (e.g., -1)
          // - BinaryExpression that results in scalar (e.g., x * 31 + y)
          if (litType && !litType.isPointer && !litType.isArray) {
            const scalarExprTypes = ['Literal', 'UnaryExpression', 'BinaryExpression'];
            if (scalarExprTypes.includes(valueNode.type))
              fieldType = litType;
          }
        }

        // Convert array types to pointer types for struct fields (C dynamic arrays need pointers)
        // For 2D arrays, convert to pointer-to-pointer: [[...], ...] should become uint8_t**
        if (fieldType.isArray && fieldType.baseType) {
          // Check if base type is also an array (2D array case)
          if (fieldType.baseType.isArray && fieldType.baseType.baseType) {
            // 2D array: uint8_t[N][M] -> uint8_t**
            fieldType = CType.Pointer(CType.Pointer(fieldType.baseType.baseType));
          } else {
            // 1D array: uint8_t[N] -> uint8_t*
            fieldType = CType.Pointer(fieldType.baseType);
          }
        }

        const isArrayType = fieldType.isPointer || fieldType.isArray ||
          (fieldType.baseType && fieldType.baseType.name === 'uint8_t');

        // Check if field already exists - may need to UPDATE type if we have better info
        if (fieldNames.has(fieldName)) {
          const existingField = fields.find(f => f.name === fieldName);
          const existingType = this.structFieldTypes.get(fieldName);

          // Upgrade field type if new assignment reveals better type info
          // (e.g., first assignment was null inferred as uint8_t*, later assignment is new ClassName())
          if (existingField && existingType && !isNullLiteral) {
            const existingIsScalar = !existingType.isPointer && !existingType.isArray;
            const newIsPointer = fieldType.isPointer || fieldType.isArray;

            // Check if the new type is a more specific pointer type (e.g., uint8_t* -> Blake2bHasher*)
            // A struct pointer (custom type name) is more specific than a primitive pointer
            const existingBaseName = existingType.baseType?.name || existingType.name;
            const newBaseName = fieldType.baseType?.name || fieldType.name;
            const primitiveTypes = ['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'char', 'void', 'bool', 'size_t'];
            const existingIsPrimitive = primitiveTypes.includes(existingBaseName);
            const newIsCustomType = !primitiveTypes.includes(newBaseName) && newBaseName;

            // Upgrade if: scalar->pointer OR primitive-pointer->custom-struct-pointer
            if ((existingIsScalar && newIsPointer) || (existingIsPrimitive && newIsCustomType && newIsPointer)) {
              // Upgrade field type
              existingField.type = fieldType;
              this.structFieldTypes.set(fieldName, fieldType);
              // Add length companion if needed
              if (!fieldNames.has(fieldName + '_length')) {
                fieldNames.add(fieldName + '_length');
                const lengthField = new CField(fieldName + '_length', CType.SizeT());
                fields.push(lengthField);
                this.structFieldTypes.set(fieldName + '_length', CType.SizeT());
              }
            }
          }
          return; // Don't add duplicate field
        }

        fieldNames.add(fieldName);

        const field = new CField(fieldName, fieldType);
        fields.push(field);
        this.structFieldTypes.set(fieldName, fieldType);

        // Add companion length field for array/pointer types
        if (isArrayType && !fieldNames.has(fieldName + '_length')) {
          fieldNames.add(fieldName + '_length');
          const lengthField = new CField(fieldName + '_length', CType.SizeT());
          fields.push(lengthField);
          this.structFieldTypes.set(fieldName + '_length', CType.SizeT());
        }
      };

      // Recursive AST visitor
      const visit = (node) => {
        if (!node) return;

        // CRITICAL: Only process simple assignments (operator === '='), NOT compound assignments (+=, -=, etc.)
        // Compound assignments like this.t0 += BLAKE2S_BLOCKBYTES don't change the field's type.
        // The RHS of compound assignments is the operand, not the new value.
        // E.g., this.t0 += 64 means "add 64 to t0", not "t0 is now of type 64".
        if (this.isThisPropertyAssignment({ type: 'ExpressionStatement', expression: node })) {
          // Skip compound assignments - only process simple '=' assignments
          if (node.operator === '=') {
            const propName = this.getThisPropertyName(node.left);
            if (propName) addDynamicField(propName, node.right);
          }
        } else if (node.type === 'ExpressionStatement' && this.isThisPropertyAssignment(node)) {
          // Skip compound assignments - only process simple '=' assignments
          if (node.expression.operator === '=') {
            const propName = this.getThisPropertyName(node.expression.left);
            if (propName) addDynamicField(propName, node.expression.right);
          }
        }

        // Visit children
        if (node.body) {
          if (Array.isArray(node.body))
            node.body.forEach(visit);
          else
            visit(node.body);
        }
        if (node.consequent) visit(node.consequent);
        if (node.alternate) visit(node.alternate);
        if (node.init) visit(node.init);
        if (node.update) visit(node.update);
        if (node.test) visit(node.test);
        if (node.expression) visit(node.expression);
        if (node.expressions) node.expressions.forEach(visit);
        if (node.left) visit(node.left);
        if (node.right) visit(node.right);
        if (node.argument) visit(node.argument);
        if (node.arguments) node.arguments.forEach(visit);
        if (node.cases) node.cases.forEach(visit);
      };

      visit(bodyNode);
      return fields;
    }

    /**
     * Infer field types by analyzing member access patterns in method bodies.
     * E.g., if this.config.modulo is accessed, config must be a struct with modulo field.
     */
    inferFieldTypesFromMemberAccess(struct, members, targetFile) {
      // Collect all property accesses for each field: fieldName -> Set of accessed properties
      const fieldPropertyAccesses = new Map();

      const scanNode = (node) => {
        if (!node) return;

        // Look for this.fieldName.propertyName patterns
        if (node.type === 'MemberExpression' && !node.computed) {
          // IL AST format: MemberExpression with ThisPropertyAccess object
          // Pattern: { type: 'MemberExpression', object: { type: 'ThisPropertyAccess', property: 'fieldName' }, property: { name: 'propName' } }
          if (node.object && node.object.type === 'ThisPropertyAccess') {
            const fieldName = typeof node.object.property === 'string'
              ? node.object.property
              : (node.object.property?.name || node.object.property?.value);
            const propName = node.property?.name || node.property?.value;
            if (fieldName && propName) {
              const snakeFieldName = this.toSnakeCase(fieldName);
              if (!fieldPropertyAccesses.has(snakeFieldName))
                fieldPropertyAccesses.set(snakeFieldName, new Set());
              fieldPropertyAccesses.get(snakeFieldName).add(propName);
            }
          }
          // JS AST format: Check if object is also MemberExpression: this.field.property
          else if (node.object && node.object.type === 'MemberExpression') {
            const inner = node.object;
            if (inner.object && inner.object.type === 'ThisExpression') {
              const fieldName = inner.property?.name || inner.property?.value;
              const propName = node.property?.name || node.property?.value;
              if (fieldName && propName) {
                const snakeFieldName = this.toSnakeCase(fieldName);
                if (!fieldPropertyAccesses.has(snakeFieldName))
                  fieldPropertyAccesses.set(snakeFieldName, new Set());
                fieldPropertyAccesses.get(snakeFieldName).add(propName);
              }
            }
          }
        }

        // Recurse into child nodes
        if (Array.isArray(node)) {
          node.forEach(scanNode);
        } else if (typeof node === 'object') {
          for (const key of Object.keys(node)) {
            if (key !== 'parent' && key !== 'loc' && key !== 'range' && node[key] && typeof node[key] === 'object')
              scanNode(node[key]);
          }
        }
      };

      // Scan all methods for member access patterns
      for (const member of members) {
        if (member.type === 'MethodDefinition' && member.value?.body)
          scanNode(member.value.body);
      }

      // For each field with property accesses, find matching struct type
      for (const [fieldName, accessedProps] of fieldPropertyAccesses) {
        let field = struct.fields.find(f => f.name === fieldName);

        // If field doesn't exist but is accessed via this.fieldName.property patterns,
        // we need to ADD it to the struct (e.g., this.algorithm.t0 requires an algorithm field)
        if (!field) {
          // Special handling for 'algorithm' field in Instance classes
          // If struct name ends with 'Instance', the algorithm type is the corresponding Algorithm struct
          if (fieldName === 'algorithm' && struct.name.endsWith('Instance')) {
            // Try multiple naming patterns: XxxAlgorithm, XxxCipher, Xxx (without Instance suffix)
            // Also try stripping 'Mode' suffix for patterns like CbcModeInstance → CbcAlgorithm
            const baseName = struct.name.replace(/Instance$/, '');
            const baseNameWithoutMode = baseName.replace(/Mode$/, '');
            const algoNameWithAlgorithm = baseName + 'Algorithm';
            const algoNameWithCipher = baseName + 'Cipher';
            const algoNameWithoutModeAlgorithm = baseNameWithoutMode + 'Algorithm';
            // Check which one exists in the targetFile structs
            let algoTypeName = baseName; // Default fallback
            if (targetFile && targetFile.structs.some(s => s.name === algoNameWithAlgorithm)) {
              algoTypeName = algoNameWithAlgorithm;
            } else if (targetFile && targetFile.structs.some(s => s.name === algoNameWithCipher)) {
              algoTypeName = algoNameWithCipher;
            } else if (targetFile && targetFile.structs.some(s => s.name === algoNameWithoutModeAlgorithm)) {
              algoTypeName = algoNameWithoutModeAlgorithm;
            } else if (targetFile && targetFile.structs.some(s => s.name === baseName)) {
              algoTypeName = baseName;
            }
            const algoType = CType.Pointer(new CType(algoTypeName));
            field = new CField(fieldName, algoType);
            struct.fields.unshift(field); // Add at beginning for visibility
            this.structFieldTypes.set(fieldName, algoType);
            continue; // Type is already set, no need to search for matching struct
          }

          // For other missing fields, try to find a matching struct type
          const matchingStruct = this.findStructWithProperties(accessedProps, targetFile, struct.name);
          if (matchingStruct) {
            const fieldType = CType.Pointer(new CType(matchingStruct.name));
            field = new CField(fieldName, fieldType);
            struct.fields.push(field);
            this.structFieldTypes.set(fieldName, fieldType);
          }
          continue;
        }

        if (field.type.name !== 'uint32_t')
          continue; // Only fix untyped fields

        // Find a struct in targetFile that has all these properties as fields
        // Exclude the current struct to avoid self-reference
        const matchingStruct = this.findStructWithProperties(accessedProps, targetFile, struct.name);
        if (matchingStruct) {
          field.type = new CType(matchingStruct.name);
          this.structFieldTypes.set(fieldName, field.type);
        }
      }
    }

    /**
     * Find a struct in the file that contains all the specified property names as fields
     * Excludes structs by name to avoid self-reference issues
     */
    findStructWithProperties(propertyNames, targetFile, excludeStructName = null) {
      if (!propertyNames || propertyNames.size === 0) return null;

      // Convert property names to snake_case for matching
      const snakeProps = new Set([...propertyNames].map(p => this.toSnakeCase(p)));

      // Look for the smallest struct that has all required properties
      // (smaller structs are more likely to be config/data structs rather than main class structs)
      let bestMatch = null;
      let bestMatchFieldCount = Infinity;

      for (const s of targetFile.structs) {
        // Skip the struct we're currently processing to avoid self-reference
        if (excludeStructName && s.name === excludeStructName) continue;

        // Skip large structs that are likely class representations rather than config structs
        if (s.fields.length > 10) continue;

        const fieldNames = new Set(s.fields.map(f => f.name));
        // Check if all required properties are present as fields
        let allMatch = true;
        for (const prop of snakeProps) {
          if (!fieldNames.has(prop)) {
            allMatch = false;
            break;
          }
        }
        if (allMatch && snakeProps.size > 0 && s.fields.length < bestMatchFieldCount) {
          bestMatch = s;
          bestMatchFieldCount = s.fields.length;
        }
      }

      return bestMatch;
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return fields;

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = this.getThisPropertyName(expr.left);

          if (!propName) continue; // Skip if we couldn't extract the property name

          // Convert field name to snake_case, removing leading underscore
          let fieldName = this.toSnakeCase(propName);
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          const value = expr.right;

          // First, try to extract type from JSDoc comment (/** @type {TypeName} */)
          // Store JSDoc type name for later resolution (after structs are known)
          let fieldType = null;
          let jsDocTypeName = null;
          if (stmt.leadingComments && stmt.leadingComments.length > 0) {
            for (const comment of stmt.leadingComments) {
              const commentText = comment.value || '';
              const typeMatch = commentText.match(/@type\s*\{(\w+)(<[^>]+>)?\}/);
              if (typeMatch) {
                jsDocTypeName = typeMatch[1];
                break;
              }
            }
          }

          // Store pending JSDoc type for later resolution
          if (jsDocTypeName) {
            if (!this.pendingJsDocTypes)
              this.pendingJsDocTypes = new Map();
            this.pendingJsDocTypes.set(fieldName, jsDocTypeName);
          }

          // Fall back to name-based inference for crypto-related fields, otherwise value-based
          if (!fieldType)
            fieldType = this.inferTypeFromName(propName);

          // Try value-based inference if name doesn't give a specific type
          // BUT skip for null literals - they shouldn't override name-based inference
          // (e.g., this.roundKeys = null shouldn't change uint32_t** to void*)
          const isNullLiteral = value && (value.type === 'Literal' && value.value === null) ||
                                (value && value.type === 'Identifier' && value.name === 'null');
          if (fieldType.name === 'uint32_t' && value && !isNullLiteral) {
            const valueType = this.inferTypeFromValue(value);
            // Use value type if it's different, or if it's an array/pointer (even with same base name)
            if (valueType && (valueType.name !== 'uint32_t' || valueType.isArray || valueType.isPointer))
              fieldType = valueType;
          }

          // IMPORTANT: If name-based inference returns a pointer type, but value is a simple literal,
          // override to use the literal's type. This handles cases like key_a = 1 where the name
          // contains 'key' but the value is clearly a single integer, not an array.
          if (value && fieldType.isPointer) {
            const valueType = this.inferTypeFromValue(value);
            // Simple scalar literals should override pointer inference
            if (valueType && !valueType.isPointer && !valueType.isArray &&
                (value.type === 'Literal' || value.type === 'UnaryExpression'))
              fieldType = valueType;
          }

          // IMPORTANT: If value is a 2D array literal and name-based inference returned a single pointer,
          // upgrade to pointer-to-pointer. This handles cases like:
          // this.NLFSR_TAP_POLYNOMIALS = [[0, 5, 17], [0, 2, 18], ...]
          if (value && (value.type === 'ArrayExpression' || value.type === 'ArrayLiteral') &&
              value.elements && value.elements.length > 0 &&
              value.elements[0] && (value.elements[0].type === 'ArrayExpression' || value.elements[0].type === 'ArrayLiteral')) {
            // This is a 2D array literal - ensure we use value-based inference which handles 2D arrays
            const valueType = this.inferTypeFromValue(value);
            if (valueType && valueType.isArray && valueType.baseType && valueType.baseType.isArray) {
              fieldType = valueType; // Let the later conversion handle converting to pointer-to-pointer
            }
          }

          // CRITICAL: If value is an ObjectExpression, always generate a struct type for it
          // This handles cases like this.subKeys = { k1: ..., k2: ..., k3: ... }
          // where name-based inference returns uint8_t* but we need a proper struct pointer
          if (value && value.type === 'ObjectExpression' && value.properties && value.properties.length > 0) {
            const structType = this.generateStructTypeForObject(value, propName);
            if (structType && structType.name !== 'uint32_t') {
              // Use pointer to struct for object literal assignments
              fieldType = CType.Pointer(structType);
            }
          }

          // Convert array types to pointer types for struct fields (C dynamic arrays need pointers)
          // e.g., this.digits = [] should become uint8_t* digits, not uint8_t digits[0]
          // For 2D arrays, convert to pointer-to-pointer: [[...], ...] should become uint8_t**
          if (fieldType.isArray && fieldType.baseType) {
            // Check if base type is also an array (2D array case)
            if (fieldType.baseType.isArray && fieldType.baseType.baseType) {
              // 2D array: uint8_t[N][M] -> uint8_t**
              fieldType = CType.Pointer(CType.Pointer(fieldType.baseType.baseType));
            } else {
              // 1D array: uint8_t[N] -> uint8_t*
              fieldType = CType.Pointer(fieldType.baseType);
            }
          }

          // If name inference returns a pointer type or array type for array-like fields
          const isArrayType = fieldType.isPointer || fieldType.isArray ||
            (fieldType.baseType && fieldType.baseType.name === 'uint8_t');

          const field = new CField(fieldName, fieldType);
          fields.push(field);
          this.structFieldTypes.set(fieldName, fieldType);

          // Add companion length field for array/pointer types
          if (isArrayType) {
            const lengthField = new CField(fieldName + '_length', CType.SizeT());
            fields.push(lengthField);
            this.structFieldTypes.set(fieldName + '_length', CType.SizeT());
          }
        }
      }

      return fields;
    }

    /**
     * Check if a statement is a this.property = value assignment
     * Handles both JS AST (MemberExpression) and IL AST (ThisPropertyAccess) formats
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;

      // IL AST format: { type: 'ThisPropertyAccess', property: 'propName' }
      if (expr.left.type === 'ThisPropertyAccess') return true;

      // JS AST format: { type: 'MemberExpression', object: { type: 'ThisExpression' }, property: {...} }
      if (expr.left.type === 'MemberExpression' && expr.left.object?.type === 'ThisExpression') return true;

      return false;
    }

    /**
     * Extract property name from this.property assignment left-hand side
     * Handles both JS AST and IL AST formats
     */
    getThisPropertyName(leftNode) {
      // IL AST format: { type: 'ThisPropertyAccess', property: 'propName' }
      if (leftNode.type === 'ThisPropertyAccess') {
        return typeof leftNode.property === 'string'
          ? leftNode.property
          : (leftNode.property?.name || leftNode.property?.value);
      }

      // JS AST format: { type: 'MemberExpression', property: { name: 'propName' } }
      if (leftNode.type === 'MemberExpression') {
        return typeof leftNode.property === 'string'
          ? leftNode.property
          : (leftNode.property?.name || leftNode.property?.value);
      }

      return undefined;
    }

    /**
     * Generate a _new constructor function for a struct type
     * Creates: StructName* struct_name_new(params...) { StructName* self = malloc(...); return self; }
     */
    generateStructConstructor(structName, struct, constructorMember) {
      const funcName = this.toSnakeCase(structName) + '_new';
      const returnType = CType.Pointer(new CType(structName));
      const func = new CFunction(funcName, returnType);

      // Build a map of field names to field types from the struct
      const fieldTypeMap = new Map();
      for (const field of struct.fields) {
        fieldTypeMap.set(field.name, field.type);
      }

      // Build a map of parameter names to assigned field names from constructor body
      const paramToFieldMap = new Map();
      if (constructorMember && constructorMember.value && constructorMember.value.body) {
        const body = constructorMember.value.body.body || [];
        for (const stmt of body) {
          // Look for this.fieldName = paramName
          if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AssignmentExpression') {
            const left = stmt.expression.left;
            const right = stmt.expression.right;
            if (left.type === 'MemberExpression' && left.object.type === 'ThisExpression') {
              const fieldName = left.property.name || left.property.value;
              if (right.type === 'Identifier') {
                paramToFieldMap.set(right.name, fieldName);
              }
            }
          }
        }
      }

      // Extract constructor parameters if we have a constructor
      if (constructorMember && constructorMember.value && constructorMember.value.params) {
        for (const param of constructorMember.value.params) {
          const paramName = param.name || (param.left && param.left.name) || 'arg';
          // Infer parameter type from field type if assigned to a field
          let paramType = CType.UInt32();
          if (param.typeAnnotation) {
            paramType = this.convertTypeAnnotation(param.typeAnnotation);
          } else if (paramToFieldMap.has(paramName)) {
            // Use mapping from this.field = param
            const fieldName = paramToFieldMap.get(paramName);
            const snakeFieldName = this.toSnakeCase(fieldName);
            if (fieldTypeMap.has(fieldName)) {
              paramType = fieldTypeMap.get(fieldName);
            } else if (fieldTypeMap.has(snakeFieldName)) {
              paramType = fieldTypeMap.get(snakeFieldName);
            }
          } else {
            // Direct match: if param name matches field name, use field type
            const snakeParamName = this.toSnakeCase(paramName);
            if (fieldTypeMap.has(paramName)) {
              paramType = fieldTypeMap.get(paramName);
            } else if (fieldTypeMap.has(snakeParamName)) {
              paramType = fieldTypeMap.get(snakeParamName);
            } else if (paramName === 'algorithm' && structName.endsWith('Instance')) {
              // Heuristic: algorithm param in Instance class is pointer to Algorithm class
              // Try multiple naming patterns: XxxAlgorithm, XxxCipher, Xxx (without Instance suffix)
              // Also try stripping 'Mode' suffix for patterns like CbcModeInstance → CbcAlgorithm
              const baseName = structName.replace(/Instance$/, '');
              const baseNameWithoutMode = baseName.replace(/Mode$/, '');
              const algoNameWithAlgorithm = baseName + 'Algorithm';
              const algoNameWithCipher = baseName + 'Cipher';
              const algoNameWithoutModeAlgorithm = baseNameWithoutMode + 'Algorithm';
              // Check which one exists in the targetFile structs
              // Default to <Base>Algorithm pattern (most common) - the struct may not be processed yet
              let algoStructName = algoNameWithAlgorithm;
              if (this.targetFile && this.targetFile.structs.some(s => s.name === algoNameWithAlgorithm)) {
                algoStructName = algoNameWithAlgorithm;
              } else if (this.targetFile && this.targetFile.structs.some(s => s.name === algoNameWithCipher)) {
                algoStructName = algoNameWithCipher;
              } else if (this.targetFile && this.targetFile.structs.some(s => s.name === algoNameWithoutModeAlgorithm)) {
                algoStructName = algoNameWithoutModeAlgorithm;
              } else if (this.targetFile && this.targetFile.structs.some(s => s.name === baseName)) {
                algoStructName = baseName;
              }
              paramType = CType.Pointer(new CType(algoStructName));
            }
          }
          func.parameters.push(new CParameter(paramName, paramType));
        }
      }

      // Create function body
      const body = new CBlock();

      // Allocate memory: StructName* self = (StructName*)malloc(sizeof(StructName));
      const structType = new CType(structName);
      const sizeofExpr = new CSizeof(structType, true);
      const mallocCall = new CCall(new CIdentifier('malloc'), [sizeofExpr]);
      const castMalloc = new CCast(CType.Pointer(structType), mallocCall);
      const selfVar = new CVariable('self', CType.Pointer(structType), castMalloc);
      body.statements.push(selfVar);

      // Initialize fields from constructor parameters
      // Check if struct has an algorithm field and constructor has algorithm parameter
      const hasAlgorithmField = struct.fields.some(f => f.name === 'algorithm');
      const hasAlgorithmParam = func.parameters.some(p => p.name === 'algorithm');
      if (hasAlgorithmField && hasAlgorithmParam) {
        // self->algorithm = algorithm;
        const algoAssign = new CExpressionStatement(
          new CAssignment(
            new CMemberAccess(new CIdentifier('self'), 'algorithm', true),
            '=',
            new CIdentifier('algorithm')
          )
        );
        body.statements.push(algoAssign);
      }

      // Return self
      body.statements.push(new CReturn(new CIdentifier('self')));

      func.body = body;
      return func;
    }

    /**
     * Transform a method definition to a C function
     */
    transformMethodDefinition(node, structName) {
      // Push a new scope for method-local variables
      this.pushScope();

      // Handle getter/setter naming - add prefix to avoid conflicts
      let methodSuffix = '';
      if (node.kind === 'get') methodSuffix = '_get';
      else if (node.kind === 'set') methodSuffix = '_set';

      const keyName = node.key?.name || node.key?.value || 'method';
      const methodName = this.toSnakeCase(structName + '_' + keyName) + methodSuffix;

      // Infer return type - first check explicit annotation
      let returnType = CType.Void();
      if (node.value && node.value.returnType) {
        returnType = this.mapType(node.value.returnType);
      }

      // Check if this method should remain void by naming convention
      // Methods like _Feed, Feed, set_*, etc. are action methods that should not return values
      // BUT methods like _processBlock() DO return values (the processed block)
      const methodNameLower = keyName.toLowerCase();
      const isProcessBlockMethod = methodNameLower.includes('process') &&
        (methodNameLower.endsWith('block') || methodNameLower.endsWith('_block'));
      const shouldRemainVoid = !isProcessBlockMethod && (
        node.kind === 'set' ||
        methodNameLower === 'feed' || methodNameLower === '_feed' ||
        methodNameLower.startsWith('set') ||
        methodNameLower.includes('update') ||
        methodNameLower.includes('init') ||
        methodNameLower.includes('reset') ||
        methodNameLower.includes('clear') ||
        methodNameLower.includes('process') ||
        methodNameLower.includes('finalize'));

      // If still void, try to infer from body return statements
      // For methods that "should remain void" (like finalize, init, etc.), we still check
      // if there's an actual return value in the body. If so, use that type.
      // This handles cases like _aceFinalize() which returns an array despite its name.
      if (returnType.name === 'void' && node.value && node.value.body) {
        const inferredType = this.inferReturnTypeFromBody(node.value.body);
        if (inferredType)
          returnType = inferredType;
      }

      // For getters, if still void, try to infer from the property name
      // e.g., get key() should return uint8_t*, get iv() should return uint8_t*
      if (node.kind === 'get' && returnType.name === 'void') {
        // Try name-based inference for common crypto properties
        const nameBasedType = this.inferTypeFromName(keyName);
        if (nameBasedType && nameBasedType.name !== 'uint32_t')
          returnType = nameBasedType;
        else
          returnType = CType.UInt32(); // Default getter return type
      }

      const method = new CFunction(methodName, returnType);

      // Add struct pointer as first parameter (unless static)
      if (!node.static) {
        const selfParam = new CParameter('self', CType.Pointer(new CType(structName)));
        method.parameters.push(selfParam);
      }

      // Parameters
      if (node.value && node.value.params) {
        // Pre-scan the body to find parameters used with array subscript notation
        const paramNames = new Set(node.value.params.map(p => p.name));
        const arrayUsedParams = node.value.body
          ? this.preScanParameterArrayUsage(node.value.body, paramNames)
          : new Set();

        // Pre-scan the body to find parameters used as integers (bit operations)
        const integerUsedParams = node.value.body
          ? this.preScanParameterIntegerUsage(node.value.body, paramNames)
          : new Set();

        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = CType.UInt32();

          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          // IMPORTANT: If parameter is used with bit operations (>>, <<, &, |, ^),
          // it's an integer, not an array - override any pointer type inference
          if (integerUsedParams.has(param.name)) {
            // Force integer type, override any array/pointer inference from name
            paramType = CType.UInt32();
          }
          // If this parameter is used with array subscript notation in the body,
          // ensure it's a pointer type (but only if not used as integer)
          else if (arrayUsedParams.has(param.name) && !paramType.isPointer && !paramType.isArray) {
            // Convert scalar type to pointer type (e.g., uint32_t -> uint32_t*)
            paramType = CType.Pointer(paramType);
          }

          // For array/pointer parameters, add companion length param
          const isArrayType = paramType.isArray || paramType.isPointer ||
            (paramType.baseType && (paramType.baseType.name === 'uint8_t' || paramType.baseType.name === 'uint8_t*'));

          const cParam = new CParameter(paramName, paramType);
          method.parameters.push(cParam);

          // Add companion length parameter for array/pointer types
          if (isArrayType || paramType.isPointer) {
            const lengthParam = new CParameter(paramName + '_length', CType.SizeT());
            method.parameters.push(lengthParam);
            // Register the length parameter in scope so _expandArgsWithLengths can find it
            // Register under both original and snake_case names for lookup flexibility
            this.registerVariableType(paramName + '_length', CType.SizeT());
            this.registerVariableType(param.name + '_length', CType.SizeT());
          }

          // Register parameter type under both original JS name and snake_case name
          this.registerVariableType(param.name, paramType);
          this.registerVariableType(paramName, paramType);

          // If the parameter name differs from snake_case (e.g., S1 -> s1),
          // register a rename mapping so references to S1 emit as s1
          if (param.name !== paramName) {
            this.renamedVariables.set(param.name, paramName);
          }
        }
      }

      // Body
      if (node.value && node.value.body) {
        // Pre-scan to infer types for variables declared without initializers
        this.preScanVariableTypes(node.value.body);

        // Pre-scan to infer element types for empty arrays with push operations
        const prevPushTypes = this.emptyArrayPushTypes;
        this.emptyArrayPushTypes = this.preScanEmptyArrayPushTypes(node.value.body);

        this.currentFunction = method;
        method.body = this.transformBlockStatement(node.value.body);
        this.currentFunction = null;

        this.emptyArrayPushTypes = prevPushTypes;
      }

      // Pop the method scope
      this.popScope();

      return method;
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const keyName = node.key?.name || node.key?.value || 'field';
      const fieldName = this.toSnakeCase(keyName);
      let fieldType = CType.UInt32();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      } else if (node.typeAnnotation) {
        fieldType = this.mapType(node.typeAnnotation);
      }

      const field = new CField(fieldName, fieldType);
      this.structFieldTypes.set(fieldName, fieldType);

      return field;
    }

    /**
     * Emit a static class field as a module-level constant
     * Handles patterns like: static C = Object.freeze([...])
     */
    emitStaticFieldAsConstant(member, className, targetFile) {
      const keyName = member.key?.name || member.key?.value || 'field';
      // Generate constant name: CLASSNAME_FIELDNAME (screaming snake case)
      const constName = this.toScreamingSnakeCase(className) + '_' + this.toScreamingSnakeCase(keyName);

      // Track the mapping for member access resolution
      this.staticClassFields.set(`${className}.${keyName}`, constName);

      // Skip null/undefined initializers - these are placeholder declarations
      if (!member.value || member.value.type === 'Literal' && member.value.value === null)
        return;

      // Unwrap Object.freeze/seal/assign calls to get the actual value
      let valueNode = member.value;
      if (valueNode.type === 'CallExpression' &&
          valueNode.callee?.type === 'MemberExpression' &&
          valueNode.callee?.object?.name === 'Object' &&
          ['freeze', 'seal', 'assign'].includes(valueNode.callee?.property?.name)) {
        valueNode = valueNode.arguments?.[0] || valueNode;
      }

      // Infer the type from the value
      let fieldType = this.inferTypeFromValue(valueNode);

      // Transform the value to C AST
      let cValue;

      // For arrays, emit as static const array
      if (valueNode.type === 'ArrayExpression') {
        // Recursively unwrap nested Object.freeze in array elements
        const unwrapElement = (el) => {
          if (el?.type === 'CallExpression' &&
              el.callee?.type === 'MemberExpression' &&
              el.callee?.object?.name === 'Object' &&
              ['freeze', 'seal', 'assign'].includes(el.callee?.property?.name))
            return el.arguments?.[0] || el;
          return el;
        };

        const elements = (valueNode.elements || []).map(el => {
          const unwrapped = unwrapElement(el);
          return this.transformExpression(unwrapped);
        });

        // Determine array element type
        let elemType = CType.UInt32();
        if (valueNode.elements?.[0]) {
          const firstElem = unwrapElement(valueNode.elements[0]);
          if (firstElem?.type === 'ArrayExpression') {
            // Array of arrays - each inner element is also an array
            const innerElemType = this.inferTypeFromValue(firstElem);
            elemType = innerElemType;
          } else {
            elemType = this.inferTypeFromValue(firstElem);
          }
        }

        // For array of arrays (like AriaInstance.C), each element is a uint32_t[4]
        const isNestedArray = valueNode.elements?.[0] && unwrapElement(valueNode.elements[0])?.type === 'ArrayExpression';

        if (isNestedArray) {
          // Create array of arrays: static const uint32_t ARIA_INSTANCE_C[][4] = {{...}, {...}, {...}}
          const innerSize = unwrapElement(valueNode.elements[0])?.elements?.length || 4;
          const arrayType = CType.Array(CType.Array(CType.UInt32(), innerSize), elements.length);
          cValue = new CArrayInitializer(elements);
          const varDecl = new CVariable(constName, arrayType, cValue);
          varDecl.isConst = true;
          varDecl.isStatic = true;
          targetFile.globals.push(varDecl);
          // Track the type for subscript inference: accessing array[i] returns a pointer to inner array
          this.staticClassFieldTypes.set(`${className}.${keyName}`, arrayType);
          // Also track by constant name for module-level lookup
          this.moduleConstantTypes.set(constName, arrayType);
        } else {
          // Simple 1D array
          const arrayType = CType.Array(elemType, elements.length);
          cValue = new CArrayInitializer(elements);
          const varDecl = new CVariable(constName, arrayType, cValue);
          varDecl.isConst = true;
          varDecl.isStatic = true;
          targetFile.globals.push(varDecl);
          // Track the type for subscript inference
          this.staticClassFieldTypes.set(`${className}.${keyName}`, arrayType);
          // Also track by constant name for module-level lookup
          this.moduleConstantTypes.set(constName, arrayType);
        }
      } else {
        // Scalar value
        cValue = this.transformExpression(valueNode);
        const varDecl = new CVariable(constName, fieldType, cValue);
        varDecl.isConst = true;
        varDecl.isStatic = true;
        targetFile.globals.push(varDecl);
      }
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE
     */
    toScreamingSnakeCase(name) {
      if (!name) return '';
      // First convert to snake_case, then uppercase
      return this.toSnakeCase(name).toUpperCase();
    }

    transformStaticBlock(node) {
      // ES2022 static block -> C global initialization statements
      // C doesn't have static class blocks, so transform to statements
      // node.body is a BlockStatement, so access its body property
      const statements = node.body?.body || node.body || [];
      if (Array.isArray(statements)) {
        return statements.map(stmt => this.transformStatement(stmt)).filter(s => s);
      }
      return [];
    }

    transformClassExpression(node) {
      // ClassExpression -> C struct definition
      const structName = node.id?.name || 'AnonymousStruct';
      const structDecl = new CStruct(structName);

      if (node.body?.body) {
        for (const member of node.body.body) {
          if (member.type === 'PropertyDefinition') {
            const field = new CField(
              this.toSnakeCase(member.key.name),
              this.inferCType(member.value)
            );
            structDecl.fields.push(field);
          }
        }
      }

      return structDecl;
    }

    transformYieldExpression(node) {
      // C doesn't have yield - return the argument value directly
      return node.argument ? this.transformExpression(node.argument) : CLiteral.Null();
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new CBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const cStmt = this.transformStatement(stmt);
          if (cStmt) {
            if (Array.isArray(cStmt)) {
              block.statements.push(...cStmt);
            } else {
              block.statements.push(cStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement
     * CRITICAL: Handles all 16 statement types
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        // 1. VariableDeclaration
        case 'VariableDeclaration':
          return this.transformLocalVariableDeclaration(node);

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
          return this.transformForOfStatement(node);

        // 7. ForInStatement
        case 'ForInStatement':
          return this.transformForInStatement(node);

        // 8. WhileStatement
        case 'WhileStatement':
          return this.transformWhileStatement(node);

        // 9. DoWhileStatement
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        // 10. SwitchStatement
        case 'SwitchStatement':
          return this.transformSwitchStatement(node);

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
          return new CBreak();

        // 15. ContinueStatement
        case 'ContinueStatement':
          return new CContinue();

        // 16. EmptyStatement
        case 'EmptyStatement':
          return null;

        default:
          return null;
      }
    }

    /**
     * Transform a local variable declaration
     */
    transformLocalVariableDeclaration(node) {
      const statements = [];

      for (const decl of node.declarations) {
        // Skip object destructuring
        if (decl.id.type === 'ObjectPattern') continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            // Infer element type from source array
            let elemType = CType.UInt32(); // Default
            if (decl.init) {
              const sourceType = this.inferTypeFromValue(decl.init);
              if (sourceType && sourceType.isPointer && sourceType.baseType) {
                elemType = sourceType.baseType;
              } else if (sourceType && sourceType.isArray && sourceType.baseType) {
                elemType = sourceType.baseType;
              } else if (decl.init.type === 'Identifier') {
                // Check registered variable type
                const varType = this.getVariableType(decl.init.name);
                if (varType && varType.isPointer && varType.baseType) {
                  elemType = varType.baseType;
                } else if (varType && varType.isArray && varType.baseType) {
                  elemType = varType.baseType;
                }
              }
            }

            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSafeCName(elem.name);
              const indexExpr = new CArraySubscript(sourceExpr, CLiteral.Int(i));
              const varDecl = new CVariable(varName, elemType, indexExpr);
              this.registerVariableType(elem.name, elemType);
              statements.push(varDecl);
            }
          }
          continue;
        }

        let varName = this.toSafeCName(decl.id.name);
        let varType = null;
        let initializer = null;

        // Check for variable-function name collision before transforming initializer
        // Example: "const result = des_instance.Result()" would create "uint8_t* result = result(...)"
        // which is invalid in C because the variable shadows the function call
        if (decl.init && decl.init.type === 'CallExpression') {
          const calleeProp = decl.init.callee?.property?.name || decl.init.callee?.property?.value;
          const calleeFuncName = this.toSnakeCase(calleeProp || decl.init.callee?.name || '');
          // Check if variable name would collide with function call name
          if (calleeFuncName && calleeFuncName === varName) {
            const newVarName = varName + '_val';
            this.renamedVariables.set(decl.id.name, newVarName); // Track JS name -> renamed C name
            varName = newVarName; // Rename to avoid collision
          }
        }

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
          if (decl.id.typeAnnotation) {
            varType = this.mapType(decl.id.typeAnnotation);
          } else if (decl.init.type === 'ObjectExpression') {
            // For object literals, pass the variable name as a hint for better struct naming
            varType = this.generateStructTypeForObject(decl.init, decl.id.name);
          } else if (decl.init.type === 'CallExpression' &&
                     decl.init.callee?.type === 'MemberExpression' &&
                     decl.init.callee?.object?.name === 'Object' &&
                     ['freeze', 'seal', 'assign'].includes(decl.init.callee?.property?.name)) {
            // Handle Object.freeze([...]) patterns - type comes from inner array
            const innerValue = decl.init.arguments[0];
            if (innerValue && innerValue.type === 'ArrayExpression') {
              const elements = innerValue.elements || [];
              if (elements.length > 0) {
                // Infer element type from values
                let elemType = CType.UInt32(); // Default
                const numericVals = elements.filter(e => e?.type === 'Literal' && typeof e.value === 'number');
                if (numericVals.length > 0) {
                  const maxVal = Math.max(...numericVals.map(e => e.value));
                  if (maxVal <= 0xFF) elemType = CType.UInt8();
                  else if (maxVal <= 0xFFFF) elemType = CType.UInt16();
                  else if (maxVal <= 0xFFFFFFFF) elemType = CType.UInt32();
                  else elemType = CType.UInt64();
                }
                varType = CType.Pointer(elemType);
              } else {
                varType = CType.Pointer(CType.UInt32());
              }
            }
          } else if (decl.init.type === 'ArrayExpression' &&
                     (!decl.init.elements || decl.init.elements.length === 0)) {
            // For empty array initializers, first check push-based type inference
            // This detects patterns like: const arr = []; arr.push(someValue);
            const varName = decl.id.name;
            const pushElemType = this.emptyArrayPushTypes.get(varName);
            if (pushElemType) {
              // Use element type from push operations
              varType = CType.Pointer(pushElemType);
            } else {
              // Fall back to name-based inference for pointer types
              // These are typically work buffers that get populated via push(), so allocate memory
              const nameBasedType = this.inferTypeFromName(varName);
              if (nameBasedType && (nameBasedType.isPointer || nameBasedType.pointerLevel > 0)) {
                varType = nameBasedType;
              } else {
                varType = CType.Pointer(CType.UInt8());  // Default to uint8_t* for empty arrays
              }
            }
            // Allocate memory for empty arrays since they're typically mutated via push()
            // Use calloc for zero-initialization (common in crypto for security)
            const elemType = varType.baseType || CType.UInt8();
            const elemSize = elemType.name === 'uint64_t' ? 8 :
                            (elemType.name === 'uint32_t' || elemType.name === 'int32_t') ? 4 :
                            (elemType.name === 'uint16_t' || elemType.name === 'int16_t') ? 2 : 1;
            // 256 bytes is a safe default for most crypto operations (keys, blocks, etc.)
            const allocSize = 256 / elemSize;
            initializer = new CCall(new CIdentifier('calloc'), [
              CLiteral.UInt(allocSize, 'U'),
              new CCall(new CIdentifier('sizeof'), [new CIdentifier(elemType.name)])
            ]);
          } else if ((decl.init.type === 'Literal' && decl.init.value === null) ||
                     (decl.init.type === 'Identifier' && decl.init.name === 'null')) {
            // For null-initialized variables, prefer name-based inference if it returns a pointer type
            // This gives us uint8_t* for 'result' instead of void*
            // Note: Some parsers represent null as Identifier with name='null' instead of Literal
            const nameBasedType = this.inferTypeFromName(decl.id.name);
            if (nameBasedType && (nameBasedType.isPointer || nameBasedType.pointerLevel > 0)) {
              varType = nameBasedType;
            } else {
              varType = CType.Pointer(CType.Void());  // Default to void* for null
            }
          } else if (decl.init.type === 'ConditionalExpression') {
            // For ternary expressions like `this.x ? this.x : null`, infer from the non-null branch
            // The consequent (true branch) typically has the meaningful type
            const conseqType = this.inferTypeFromValue(decl.init.consequent);
            const altType = this.inferTypeFromValue(decl.init.alternate);
            // Prefer non-void pointer types
            if (conseqType && (conseqType.isPointer || conseqType.pointerLevel > 0) &&
                conseqType.name !== 'void' && conseqType.baseType?.name !== 'void') {
              varType = conseqType;
            } else if (altType && (altType.isPointer || altType.pointerLevel > 0) &&
                       altType.name !== 'void' && altType.baseType?.name !== 'void') {
              varType = altType;
            } else if (conseqType && conseqType.name !== 'uint32_t') {
              varType = conseqType;
            } else if (altType && altType.name !== 'uint32_t') {
              varType = altType;
            } else {
              // Fall back to name-based inference for the variable name
              varType = this.inferTypeFromName(decl.id.name);
            }
          } else if (decl.init.type === 'LogicalExpression') {
            // For || expressions like `this.aad || []`, infer from the left (non-fallback) operand
            // since JavaScript || returns the left value if truthy
            const leftType = this.inferTypeFromValue(decl.init.left);
            const rightType = this.inferTypeFromValue(decl.init.right);
            // Prefer pointer types from left operand (the primary value)
            if (leftType && (leftType.isPointer || leftType.pointerLevel > 0) &&
                leftType.name !== 'void' && leftType.baseType?.name !== 'void') {
              varType = leftType;
            } else if (rightType && (rightType.isPointer || rightType.pointerLevel > 0) &&
                       rightType.name !== 'void' && rightType.baseType?.name !== 'void') {
              varType = rightType;
            } else if (leftType && leftType.name !== 'uint32_t') {
              varType = leftType;
            } else if (rightType && rightType.name !== 'uint32_t') {
              varType = rightType;
            } else {
              // Fall back to name-based inference for the variable name
              varType = this.inferTypeFromName(decl.id.name);
            }
          } else {
            varType = this.inferTypeFromValue(decl.init);
          }
        } else {
          // No initializer - check for pre-registered type first (from preScan of later assignments)
          const preRegisteredType = this.getVariableType(decl.id.name);
          if (preRegisteredType) {
            varType = preRegisteredType;
          } else if (decl.id.typeAnnotation) {
            varType = this.mapType(decl.id.typeAnnotation);
          } else {
            varType = this.inferTypeFromName(decl.id.name);
          }
        }

        // Strip const qualifier from local variables - JavaScript's const means "can't rebind",
        // not "data is immutable". Local variables initialized from const parameters may be modified.
        if (varType && varType.isConst) {
          // Create a new CType with same properties but isConst = false
          const newType = new CType(varType.name, {
            isPointer: varType.isPointer,
            isConst: false,
            isVolatile: varType.isVolatile,
            isStatic: varType.isStatic,
            isExtern: varType.isExtern,
            isArray: varType.isArray,
            arraySize: varType.arraySize,
            pointerLevel: varType.pointerLevel
          });
          if (varType.baseType) newType.baseType = varType.baseType;
          varType = newType;
        }

        const varDecl = new CVariable(varName, varType, initializer);
        this.registerVariableType(decl.id.name, varType);
        statements.push(varDecl);

        // Generate _length companion for uninitialized pointer variables
        // Handles: let processedBlock; -> uint8_t* processed_block; size_t processed_block_length = 0;
        // This ensures the length variable exists when the pointer is later assigned from a method call
        if (!decl.init && varType && (varType.isPointer || varType.pointerLevel > 0)) {
          const lengthVarName = `${varName}_length`;
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            const lengthInit = CLiteral.UInt(0, 'U');
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            this.registerVariableType(`${varName}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }

        // Track variables initialized from special functions for proper .length handling
        if (decl.init?.type === 'CallExpression') {
          const calleeName = decl.init.callee?.name ||
                             decl.init.callee?.property?.name ||
                             decl.init.callee?.property?.value;
          const lowerCallee = (calleeName || '').toLowerCase();
          // Track string_split results -> use string_split_length
          if (calleeName === 'split' || calleeName === 'string_split') {
            this.splitResultVars.add(decl.id.name);
            this.specialLengthVars.set(decl.id.name, 'string_split_length');
          }
          // Track filter_alpha results -> use filter_alpha_length
          else if (lowerCallee === 'filter_alpha' || lowerCallee === 'filteralpha') {
            this.filterResultVars.add(decl.id.name);
            this.specialLengthVars.set(decl.id.name, 'filter_alpha_length');
          }
          // Track replace with regex that removes characters -> use filter_alpha_length
          else if (calleeName === 'replace' || calleeName === 'replaceAll') {
            // This might be a filter operation, track as filter result
            this.filterResultVars.add(decl.id.name);
            this.specialLengthVars.set(decl.id.name, 'filter_alpha_length');
          }
        }

        // Add companion _length variable for string casts from byte arrays
        // Handles: const str = String.fromCharCode(...data) -> char* str = (char*)data; size_t str_length = data_length;
        if (decl.init?.type === 'CallExpression' &&
            decl.init.callee?.type === 'MemberExpression' &&
            decl.init.callee.object?.name === 'String' &&
            (decl.init.callee.property?.name === 'fromCharCode' || decl.init.callee.property?.value === 'fromCharCode') &&
            decl.init.arguments?.length === 1 &&
            decl.init.arguments[0]?.type === 'SpreadElement') {
          const sourceArg = decl.init.arguments[0].argument;
          if (sourceArg?.type === 'Identifier') {
            const sourceArrayName = this.toSnakeCase(sourceArg.name);
            const lengthVarName = `${varName}_length`;
            const lengthInit = new CIdentifier(`${sourceArrayName}_length`);
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length = 0 for string literal initializations
        // Handles: let str = "" -> char* str = ""; size_t str_length = 0;
        else if (decl.init?.type === 'Literal' && typeof decl.init.value === 'string') {
          const lengthVarName = `${varName}_length`;
          const lengthInit = CLiteral.UInt(decl.init.value.length, '');
          const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
          this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
          statements.push(lengthVar);
        }
        // Add companion _length for spread expressions [...arr] - MUST be before generic ArrayExpression handler
        // Handles: let result = [...block] -> uint8_t* result = block; size_t result_length = block_length;
        else if (decl.init?.type === 'ArrayExpression' &&
                 decl.init.elements?.length === 1 &&
                 decl.init.elements[0]?.type === 'SpreadElement') {
          const spreadArg = decl.init.elements[0].argument;
          if (spreadArg?.type === 'Identifier') {
            const sourceName = spreadArg.name;
            const sourceSnakeName = this.toSnakeCase(sourceName);
            const lengthVarName = `${varName}_length`;
            // Check if source has a length companion, then output the C name
            const sourceCName = this.toSafeCName(sourceName);
            const sourceLengthCamel = `${sourceName}_length`;
            const sourceLengthSnake = `${sourceSnakeName}_length`;
            const sourceLengthCSafe = `${sourceCName}_length`;
            const hasSourceLength = this.getVariableType(sourceLengthCamel) ||
                                    this.getVariableType(sourceLengthSnake) ||
                                    this.getVariableType(sourceLengthCSafe);
            // Always output the C name (what's actually declared)
            const lengthInit = hasSourceLength ? new CIdentifier(sourceLengthCSafe)
                                               : new CIdentifier(sourceLengthSnake);
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            // Register under both JS name and C name for lookup flexibility
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            this.registerVariableType(`${varName}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length = n for array literal initializations (non-spread)
        // Handles: const result = [] -> uint8_t* result = NULL; size_t result_length = 0;
        // Handles: const data = [1, 2, 3] -> uint8_t data[] = {1, 2, 3}; size_t data_length = 3;
        else if (decl.init?.type === 'ArrayExpression' || decl.init?.type === 'ArrayLiteral') {
          const lengthVarName = `${varName}_length`;
          // Skip if a variable with this name already exists (avoid naming collisions)
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            const elemCount = decl.init.elements?.length || 0;
            const lengthInit = CLiteral.UInt(elemCount, 'U');
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for ArraySlice operations
        // Handles: const block = data.slice(i, i + 8) -> uint8_t* block = array_slice(...); size_t block_length = end - start;
        else if (decl.init?.type === 'ArraySlice') {
          const lengthVarName = `${varName}_length`;
          // Skip if a variable with this name already exists (avoid naming collisions)
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            // Calculate length as end - start
            const start = decl.init.start ? this.transformExpression(decl.init.start) : CLiteral.UInt(0, 'U');
            let lengthInit;
            if (decl.init.end) {
              const end = this.transformExpression(decl.init.end);
              lengthInit = new CBinaryExpression(end, '-', start);
            } else {
              // If no end specified, use source array length - start
              const sourceArray = decl.init.array;
              let sourceLengthVar;

              // Handle ThisPropertyAccess (this.inputBuffer -> self->input_buffer_length)
              if (sourceArray?.type === 'ThisPropertyAccess') {
                const propName = typeof sourceArray.property === 'string'
                  ? sourceArray.property
                  : sourceArray.property?.name || sourceArray.property?.value;
                const sourceCName = this.toSafeCName(propName || 'array');
                sourceLengthVar = new CMemberAccess(new CIdentifier('self'), `${sourceCName}_length`, true);
              }
              // Handle MemberExpression (obj.arr -> obj->arr_length or obj.arr_length)
              else if (sourceArray?.type === 'MemberExpression') {
                const propName = sourceArray.property?.name || sourceArray.property?.value;
                const sourceCName = this.toSafeCName(propName || 'array');
                const objExpr = this.transformExpression(sourceArray.object);
                // Check if object uses pointer access
                const isPointer = sourceArray.object?.type === 'ThisExpression' ||
                                  sourceArray.object?.type === 'Identifier';
                sourceLengthVar = new CMemberAccess(objExpr, `${sourceCName}_length`, isPointer);
              }
              // Handle simple Identifier (arr -> arr_length)
              else {
                const sourceName = sourceArray?.name || sourceArray?.property?.name || 'array';
                const sourceCName = this.toSafeCName(sourceName);
                sourceLengthVar = new CIdentifier(`${sourceCName}_length`);
              }

              lengthInit = new CBinaryExpression(sourceLengthVar, '-', start);
            }
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for StringToBytes (ansi_to_bytes) results
        // Handles: const bytes = OpCodes.AnsiToBytes(str) -> uint8_t* bytes = ansi_to_bytes(str); size_t bytes_length = strlen(str);
        else if (decl.init?.type === 'StringToBytes') {
          const lengthVarName = `${varName}_length`;
          // Skip if a variable with this name already exists (avoid naming collisions)
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            // Get the source string argument
            const sourceArg = decl.init.value || (decl.init.arguments && decl.init.arguments[0]);
            let lengthInit;
            if (sourceArg) {
              const transformedSource = this.transformExpression(sourceArg);
              lengthInit = new CCall(new CIdentifier('strlen'), [transformedSource]);
            } else {
              lengthInit = CLiteral.UInt(0, 'U');
            }
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for ArrayFill with ArrayCreation/TypedArrayCreation
        // Handles: const KL = new Array(4).fill(0) -> uint32_t* kl = calloc(4, sizeof(uint32_t)); size_t kl_length = 4;
        else if (decl.init?.type === 'ArrayFill' &&
                 (decl.init.array?.type === 'ArrayCreation' || decl.init.array?.type === 'TypedArrayCreation')) {
          const lengthVarName = `${varName}_length`;
          // Skip if a variable with this name already exists (avoid naming collisions)
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            const size = decl.init.array.size;
            const lengthInit = size ? this.transformExpression(size) : CLiteral.UInt(0, 'U');
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for standalone ArrayCreation/TypedArrayCreation
        // Handles: const arr = new Uint8Array(16) -> uint8_t* arr = malloc(...); size_t arr_length = 16;
        // Also handles: const state = new Uint8Array(data) where data is a pointer -> state_length = data_length
        else if (decl.init?.type === 'ArrayCreation' || decl.init?.type === 'TypedArrayCreation') {
          const lengthVarName = `${varName}_length`;
          // Skip if a variable with this name already exists (avoid naming collisions)
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            const size = decl.init.size;
            let lengthInit;
            // If the size argument is an identifier that's a pointer type, use its _length companion
            // e.g., new Uint8Array(data) where data is uint8_t* should use data_length
            if (size?.type === 'Identifier') {
              const argType = this.getVariableType(size.name);
              if (argType && (argType.isPointer || argType.pointerLevel > 0 || argType.isArray)) {
                const argCName = this.toSafeCName(size.name);
                lengthInit = new CIdentifier(`${argCName}_length`);
              } else {
                lengthInit = size ? this.transformExpression(size) : CLiteral.UInt(0, 'U');
              }
            } else {
              lengthInit = size ? this.transformExpression(size) : CLiteral.UInt(0, 'U');
            }
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for UnpackBytes operations (OpCodes.Unpack32LE, etc.)
        // These have known output sizes: 16-bit → 2 bytes, 32-bit → 4 bytes, 64-bit → 8 bytes
        else if (decl.init?.type === 'UnpackBytes') {
          const bits = decl.init.bits || 32;
          const lengthVarName = `${varName}_length`;
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            const lengthValue = bits === 16 ? 2 : bits === 64 ? 8 : 4;
            const lengthInit = CLiteral.UInt(lengthValue, 'U');
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            this.registerVariableType(`${varName}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for LogicalExpression accessing struct fields
        // Handles: const aadBytes = this._aad || [] -> uint8_t* aad_bytes = self->aad; size_t aad_bytes_length = self->aad_length;
        else if (decl.init?.type === 'LogicalExpression' &&
                 varType && (varType.isPointer || varType.pointerLevel > 0)) {
          const lengthVarName = `${varName}_length`;
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            let lengthInit = CLiteral.UInt(0, 'U');
            // Get source property name from left operand (the struct field)
            const leftNode = decl.init.left;
            if (leftNode?.type === 'ThisPropertyAccess') {
              const propName = typeof leftNode.property === 'string'
                ? leftNode.property
                : (leftNode.property?.name || leftNode.property?.value);
              if (propName) {
                const snakeProp = this.toSnakeCase(propName).replace(/^_/, '');
                lengthInit = new CMemberAccess(new CIdentifier('self'), `${snakeProp}_length`, true);
              }
            } else if (leftNode?.type === 'MemberExpression' &&
                       leftNode.object?.type === 'ThisExpression') {
              const propName = leftNode.property?.name || leftNode.property?.value;
              if (propName) {
                const snakeProp = this.toSnakeCase(propName).replace(/^_/, '');
                lengthInit = new CMemberAccess(new CIdentifier('self'), `${snakeProp}_length`, true);
              }
            }
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            this.registerVariableType(`${varName}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for function/method calls returning arrays
        // Handles: const result = encrypt_block(block, block_length) -> ...; size_t result_length = block_length;
        // For crypto functions, output length typically equals input length (block size preserved)
        else if ((decl.init?.type === 'CallExpression' || decl.init?.type === 'ThisMethodCall' ||
                  decl.init?.type === 'ConditionalExpression') &&
                 varType && (varType.isPointer || varType.pointerLevel > 0)) {
          // Find an array argument with a _length companion to use as output length
          let sourceLengthName = null;

          // Helper to extract call args from CallExpression, ThisMethodCall, or ConditionalExpression branches
          const extractCallArgs = (expr) => {
            if (!expr) return null;
            if ((expr.type === 'CallExpression' || expr.type === 'ThisMethodCall') && expr.arguments) return expr.arguments;
            if (expr.type === 'ConditionalExpression') {
              // Try consequent first, then alternate
              return extractCallArgs(expr.consequent) || extractCallArgs(expr.alternate);
            }
            return null;
          };

          const args = extractCallArgs(decl.init);
          if (args) {
            for (const arg of args) {
              if (arg?.type === 'Identifier') {
                const argName = arg.name;
                const argSnakeName = this.toSnakeCase(argName);
                const argCName = this.toSafeCName(argName);
                const lengthCamel = `${argName}_length`;
                const lengthSnake = `${argSnakeName}_length`;
                const lengthCSafe = `${argCName}_length`;
                // Check if any naming convention is registered
                if (this.getVariableType(lengthCamel) ||
                    this.getVariableType(lengthSnake) ||
                    this.getVariableType(lengthCSafe)) {
                  // Always output the C name (what's actually declared)
                  sourceLengthName = lengthCSafe;
                  break;
                }
              }
            }
          }

          const lengthVarName = `${varName}_length`;
          // Skip if a variable with this name already exists (avoid naming collisions)
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            // Check for unpack functions with known output sizes
            let knownLength = null;
            const extractFuncName = (expr) => {
              if (!expr) return null;
              if (expr.type === 'CallExpression' && expr.callee) {
                return expr.callee.name || (expr.callee.property && expr.callee.property.name);
              }
              if (expr.type === 'ConditionalExpression') {
                return extractFuncName(expr.consequent) || extractFuncName(expr.alternate);
              }
              return null;
            };
            const funcName = extractFuncName(decl.init);
            if (funcName) {
              const lowerFuncName = funcName.toLowerCase().replace(/_/g, '');
              if (lowerFuncName === 'unpack16beret' || lowerFuncName === 'unpack16leret') {
                knownLength = CLiteral.UInt(2, 'U');
              } else if (lowerFuncName === 'unpack32beret' || lowerFuncName === 'unpack32leret') {
                knownLength = CLiteral.UInt(4, 'U');
              } else if (lowerFuncName === 'unpack64beret' || lowerFuncName === 'unpack64leret') {
                knownLength = CLiteral.UInt(8, 'U');
              }
            }
            // Use known length, source length, or default to 0
            const lengthInit = knownLength
              ? knownLength
              : sourceLengthName
                ? new CIdentifier(sourceLengthName)
                : CLiteral.UInt(0, 'U');
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            // Register under both names for lookup flexibility
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            this.registerVariableType(`${varName}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for NewExpression with typed array constructor and array argument
        // Handles: const state = new Uint8Array(data) -> uint8_t* state = malloc(...); size_t state_length = data_length;
        else if (decl.init?.type === 'NewExpression' &&
                 decl.init.callee?.type === 'Identifier' &&
                 ['Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Array'].includes(decl.init.callee.name) &&
                 decl.init.arguments?.length === 1) {
          const arg = decl.init.arguments[0];
          const lengthVarName = `${varName}_length`;
          if (!this.hasLengthVariableCollision(decl.id.name)) {
            let lengthInit;
            // If argument is an identifier that's a pointer type, use its _length companion
            if (arg?.type === 'Identifier') {
              const argType = this.getVariableType(arg.name);
              if (argType && (argType.isPointer || argType.pointerLevel > 0 || argType.isArray)) {
                const argCName = this.toSafeCName(arg.name);
                lengthInit = new CIdentifier(`${argCName}_length`);
              } else {
                // Argument is a size (number)
                lengthInit = this.transformExpression(arg);
              }
            } else if (arg?.type === 'Literal' && typeof arg.value === 'number') {
              lengthInit = this.transformExpression(arg);
            } else {
              lengthInit = this.transformExpression(arg);
            }
            const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
            this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
            this.registerVariableType(`${varName}_length`, CType.SizeT());
            statements.push(lengthVar);
          }
        }
        // Add companion _length for simple identifier assignments to pointer types
        // Handles: let result = block -> uint8_t* result = block; size_t result_length = block_length;
        else if (decl.init?.type === 'Identifier' && varType && (varType.isPointer || varType.pointerLevel > 0)) {
          const sourceName = decl.init.name;
          const sourceSnakeName = this.toSnakeCase(sourceName);
          const sourceCName = this.toSafeCName(sourceName);
          // Check if source has a companion _length variable
          const sourceLengthCamel = `${sourceName}_length`;
          const sourceLengthSnake = `${sourceSnakeName}_length`;
          const sourceLengthCSafe = `${sourceCName}_length`;
          const hasSourceLength = this.getVariableType(sourceLengthCamel) ||
                                  this.getVariableType(sourceLengthSnake) ||
                                  this.getVariableType(sourceLengthCSafe);
          if (hasSourceLength) {
            const lengthVarName = `${varName}_length`;
            // Skip if a variable with this name already exists (avoid naming collisions)
            if (!this.hasLengthVariableCollision(decl.id.name)) {
              // Always output the C name (what's actually declared)
              const lengthInit = new CIdentifier(sourceLengthCSafe);
              const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
              // Register under both names for lookup flexibility
              this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
              this.registerVariableType(`${varName}_length`, CType.SizeT());
              statements.push(lengthVar);
            }
          }
        }
        // Add companion _length for MemberExpression/ThisPropertyAccess assignments to pointer types
        // Handles: let data = self->inputBuffer -> uint8_t* data = self->input_buffer; size_t data_length = self->input_buffer_length;
        // NOTE: Skip computed MemberExpressions (array subscripts like SIGMA[round]) - they don't have member lengths
        else if ((decl.init?.type === 'MemberExpression' || decl.init?.type === 'ThisPropertyAccess') &&
                 varType && (varType.isPointer || varType.pointerLevel > 0) &&
                 !decl.init.computed) {  // Don't try to get length from computed array access
          // Get the member name and construct the length member name
          // ThisPropertyAccess has 'property' as a string directly, MemberExpression has it as an object
          const memberName = typeof decl.init.property === 'string'
            ? decl.init.property
            : (decl.init.property?.name || decl.init.property?.value);
          if (memberName) {
            const memberSnakeName = this.toSnakeCase(memberName);
            const lengthVarName = `${varName}_length`;
            // Skip if a variable with this name already exists (avoid naming collisions)
            if (!this.hasLengthVariableCollision(decl.id.name)) {
              // Create a member access to the length field: self->input_buffer_length
              // For ThisPropertyAccess, the source is 'self' (pointer to struct)
              const sourceObject = decl.init.type === 'ThisPropertyAccess'
                ? new CIdentifier('self')
                : this.transformExpression(decl.init.object);
              const isPointer = decl.init.type === 'ThisPropertyAccess' || this.isPointerType(decl.init.object);
              const lengthInit = new CMemberAccess(sourceObject, `${memberSnakeName}_length`, isPointer);
              const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
              this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
              statements.push(lengthVar);
            }
          }
        }
        // Add companion _length for computed MemberExpression (array subscripts) that access 2D array rows
        // Handles: const s = SIGMA[round] -> const uint8_t* s = SIGMA[round]; size_t s_length = 16;
        // Also handles: const taps = this.NLFSR_TAP_POLYNOMIALS[regIndex] for 2D struct fields
        else if (decl.init?.type === 'MemberExpression' && decl.init.computed &&
                 varType && (varType.isPointer || varType.pointerLevel > 0)) {
          const lengthVarName = `${varName}_length`;

          // Handle subscript on ThisPropertyAccess: this.X[i]
          if (decl.init.object?.type === 'ThisPropertyAccess') {
            const fieldName = typeof decl.init.object.property === 'string'
              ? decl.init.object.property
              : (decl.init.object.property?.name || decl.init.object.property?.value);
            if (fieldName && !this.hasLengthVariableCollision(decl.id.name)) {
              const fieldSnake = this.toSnakeCase(fieldName);
              // For 2D struct fields, we can't easily know the row length dynamically
              // Generate length = 0 as placeholder or look for a row length companion
              const rowLengthFieldName = `${fieldSnake}_row_length`;
              const hasRowLengthField = this.structFieldTypes.has(rowLengthFieldName);

              if (hasRowLengthField) {
                // Use the struct's row length field: self->field_row_length
                const lengthInit = new CMemberAccess(new CIdentifier('self'), rowLengthFieldName, true);
                const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
                this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
                statements.push(lengthVar);
              } else {
                // For 2D array subscripts without explicit row length, generate an estimated length
                // Look at the index expression - if it's used with a specific register index, try to infer
                // Fallback: use a reasonable constant or generate 0 (caller will need to handle)
                // For crypto algorithms with 2D tap polynomials, typical row sizes are 3-6 elements
                const lengthInit = CLiteral.UInt(0, 'U'); // Placeholder - will need runtime determination
                const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
                this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
                statements.push(lengthVar);
              }
            }
          }

          // For 2D array subscript like SIGMA[i], try to find a define for the row length
          else {
            const arrayName = decl.init.object?.name;
            if (arrayName && !this.hasLengthVariableCollision(decl.id.name)) {
              // Look up the array type from module constants to find row length
              // 2D arrays are stored as nested CType.Array: Array(Array(UInt8, 16), 10) for [10][16]
              const arrayType = this.moduleConstantTypes.get(arrayName);
              let rowLength = null;

              // Check for nested array type (2D array)
              if (arrayType && arrayType.baseType && arrayType.baseType.arraySize) {
                // 2D array - baseType is the inner array, its arraySize is the row length
                rowLength = arrayType.baseType.arraySize;
              } else if (arrayType && arrayType.arraySize2) {
                // Alternative storage format with explicit arraySize2
                rowLength = arrayType.arraySize2;
              }

              if (rowLength !== null) {
                const lengthInit = CLiteral.UInt(rowLength, 'U');
                const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
                this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
                statements.push(lengthVar);
              } else {
                // Try the row length define: ARRAYNAME_ROW_LENGTH
                const rowLengthDefine = this.toScreamingSnakeCase(arrayName) + '_ROW_LENGTH';
                const hasRowLengthDefine = this.moduleConstantTypes.has(rowLengthDefine);
                if (hasRowLengthDefine) {
                  const lengthInit = new CIdentifier(rowLengthDefine);
                  const lengthVar = new CVariable(lengthVarName, CType.SizeT(), lengthInit);
                  this.registerVariableType(`${decl.id.name}_length`, CType.SizeT());
                  statements.push(lengthVar);
                }
                // Otherwise, don't generate a length variable for unknown 2D array subscripts
              }
            }
          }
        }
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;
      return new CExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      // If we're at module level (not inside a function), skip return
      // This handles UMD pattern's final return statement
      if (!this.currentFunction) {
        // At module level, skip return statements entirely
        // (UMD pattern returns exports at module level)
        return null;
      }

      // Check if current function returns void (but NOT void*)
      const returnType = this.currentFunction.returnType;
      const isVoidFunction = returnType &&
        (returnType.name === 'void' || returnType.toString() === 'void') &&
        !returnType.isPointer &&
        !(returnType.pointerLevel && returnType.pointerLevel > 0) &&
        !(returnType.toString && returnType.toString().includes('*'));

      // Check if current function returns a pointer type
      // Multiple detection methods for robustness:
      let isPointerFunction = false;

      if (returnType) {
        // Method 1: Check CType flags
        if (returnType.isPointer === true) isPointerFunction = true;
        // Method 2: Check pointer level
        else if (returnType.pointerLevel && returnType.pointerLevel > 0) isPointerFunction = true;
        // Method 3: Check if type name ends with '*'
        else if (returnType.name && returnType.name.endsWith('*')) isPointerFunction = true;
        // Method 4: Check toString() representation
        else if (typeof returnType.toString === 'function') {
          const typeStr = returnType.toString();
          if (typeStr && typeStr.includes('*')) isPointerFunction = true;
        }
        // Method 5: Check if base type suggests pointer (uint8_t often used for byte arrays)
        else if (returnType.name === 'uint8_t' ||
                 (returnType.baseType && returnType.baseType.name === 'uint8_t')) {
          // Functions returning uint8_t without pointer might still be meant to return arrays
          // Check function name patterns
          const funcName = this.currentFunction.name || '';
          const lowerFuncName = funcName.toLowerCase();
          if (lowerFuncName.includes('encode') || lowerFuncName.includes('decode') ||
              lowerFuncName.includes('encrypt') || lowerFuncName.includes('decrypt') ||
              lowerFuncName.includes('result') || lowerFuncName.includes('hash') ||
              lowerFuncName.includes('digest') || lowerFuncName.includes('output')) {
            isPointerFunction = true;
          }
        }
      }

      // Method 6: If returning -1 and function name suggests pointer return
      if (!isPointerFunction && this._isNegativeOne(node.argument)) {
        const funcName = this.currentFunction.name || '';
        const lowerFuncName = funcName.toLowerCase();
        // Functions that typically return byte arrays/pointers
        if (lowerFuncName.includes('encode') || lowerFuncName.includes('decode') ||
            lowerFuncName.includes('encrypt') || lowerFuncName.includes('decrypt') ||
            lowerFuncName.includes('result') || lowerFuncName.includes('hash') ||
            lowerFuncName.includes('digest') || lowerFuncName.includes('output') ||
            lowerFuncName.includes('_string') || lowerFuncName.includes('string_')) {
          isPointerFunction = true;
        }
      }

      // Method 7: More aggressive check - if the emitted return type contains '*' we're a pointer function
      // This catches cases where CType methods worked but flag checks didn't
      if (!isPointerFunction && returnType) {
        try {
          const emitted = returnType.name || '';
          const fullType = returnType.toString ? returnType.toString() : '';
          if (emitted.includes('*') || fullType.includes('*') ||
              (returnType.baseType && returnType.baseType.isPointer)) {
            isPointerFunction = true;
          }
        } catch (e) { /* ignore errors in type checking */ }
      }

      // Method 8: Final fallback - check if ANY return in this function would return a pointer type
      // by looking at registered return types
      if (!isPointerFunction && this._isNegativeOne(node.argument)) {
        const funcName = this.currentFunction.name || '';
        const storedReturnType = this.functionReturnTypes?.get(funcName);
        if (storedReturnType && (storedReturnType.isPointer || storedReturnType.pointerLevel > 0)) {
          isPointerFunction = true;
        }
      }

      // Method 9: Nuclear option - look up in the CFile's prototypes array
      // This catches cases where the function was declared with pointer return type
      // but the current function context doesn't have it properly set
      if (!isPointerFunction && this._isNegativeOne(node.argument)) {
        const funcName = this.currentFunction.name || '';
        if (funcName && this.cFile && this.cFile.prototypes) {
          for (const proto of this.cFile.prototypes) {
            if (proto.name === funcName && proto.returnType) {
              if (proto.returnType.isPointer || proto.returnType.pointerLevel > 0 ||
                  (proto.returnType.name && proto.returnType.name.includes('*'))) {
                isPointerFunction = true;
                break;
              }
            }
          }
        }
        // Also check functions array
        if (!isPointerFunction && funcName && this.cFile && this.cFile.functions) {
          for (const fn of this.cFile.functions) {
            if (fn.name === funcName && fn.returnType) {
              if (fn.returnType.isPointer || fn.returnType.pointerLevel > 0 ||
                  (fn.returnType.name && fn.returnType.name.includes('*'))) {
                isPointerFunction = true;
                break;
              }
            }
          }
        }
      }

      // Method 10: Simplest check - if the current function's return type toString contains '*'
      // This should have been caught earlier but sometimes the type object is weird
      if (!isPointerFunction && this._isNegativeOne(node.argument) && this.currentFunction.returnType) {
        try {
          const typeStr = String(this.currentFunction.returnType);
          if (typeStr.includes('*')) {
            isPointerFunction = true;
          }
        } catch (e) { /* ignore */ }
      }

      if (node.argument) {
        // If function is void, don't return a value
        if (isVoidFunction) {
          return new CReturn();
        }

        // For pointer-returning functions, convert return -1 to return NULL
        if (isPointerFunction && this._isNegativeOne(node.argument)) {
          return new CReturn(CLiteral.Null());
        }

        const expr = this.transformExpression(node.argument);

        // If returning an array initializer, wrap it in a compound literal (C99+)
        // This converts: return {0U}; → return (uint32_t[]){0U};
        if (expr instanceof CArrayInitializer) {
          // Infer element type from the first element or use uint32_t as default
          let elemType = CType.UInt32();
          if (expr.elements && expr.elements.length > 0) {
            const firstElem = expr.elements[0];
            if (firstElem instanceof CLiteral) {
              switch (firstElem.literalType) {
                case 'uint8': elemType = CType.UInt8(); break;
                case 'uint16': elemType = CType.UInt16(); break;
                case 'uint32': elemType = CType.UInt32(); break;
                case 'uint64': elemType = CType.UInt64(); break;
                case 'int': elemType = CType.Int32(); break;
                case 'bool': elemType = CType.Bool(); break;
              }
            }
          }
          // Also check function return type for better inference
          if (returnType && returnType.baseType) {
            const baseName = returnType.baseType.name || returnType.baseType.toString();
            if (baseName.includes('uint8')) elemType = CType.UInt8();
            else if (baseName.includes('uint16')) elemType = CType.UInt16();
            else if (baseName.includes('uint32')) elemType = CType.UInt32();
            else if (baseName.includes('uint64')) elemType = CType.UInt64();
          }
          const arrayType = CType.Array(elemType);
          return new CReturn(new CCompoundLiteral(arrayType, expr));
        }

        return new CReturn(expr);
      }
      // For pointer-returning functions, empty return should return NULL
      if (isPointerFunction) {
        return new CReturn(CLiteral.Null());
      }
      return new CReturn();
    }

    /**
     * Check if a JS AST node represents -1 (UnaryExpression with '-' and 1)
     */
    _isNegativeOne(node) {
      if (!node) return false;
      if (node.type === 'UnaryExpression' && node.operator === '-') {
        if (node.argument && node.argument.type === 'Literal' && node.argument.value === 1) {
          return true;
        }
      }
      return false;
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new CBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      // Ensure branches are blocks
      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new CIf(condition, thenBlock, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      const init = node.init ? this.transformStatement(node.init) : null;
      const condition = node.test ? this.transformExpression(node.test) : null;
      const update = node.update ? this.transformExpression(node.update) : null;
      const body = this.transformStatement(node.body) || new CBlock();

      // Flatten init if it's an array
      const flatInit = (init && Array.isArray(init)) ? init[0] : init;

      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new CFor(flatInit, condition, update, bodyBlock);
    }

    /**
     * Transform a for-of statement (convert to standard for loop)
     */
    transformForOfStatement(node) {
      // for (const x of array) -> for (i = 0; i < array_length; i++) { auto x = array[i]; ... }
      let varName = 'item';
      let origVarName = 'item';  // Original name from IL AST (before safe escaping)
      let varType = 'uint8_t';  // Default element type

      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          origVarName = decl.id.name;
          varName = this.toSafeCName(origVarName);  // Use toSafeCName to escape reserved words like 'char'
          // Try to infer type from annotations or use default
          if (decl.id.typeAnnotation) {
            varType = this.mapTypeAnnotation(decl.id.typeAnnotation);
          }
        }
      } else if (node.left.type === 'Identifier') {
        origVarName = node.left.name;
        varName = this.toSafeCName(origVarName);
      }

      // Transform the array expression
      const arrayExpr = this.transformExpression(node.right);

      // Determine the array length expression
      let arrayLengthExpr;
      let arrayName = '';

      // Get the original variable name from the IL AST for special length macro lookup
      const origArrayName = node.right.type === 'Identifier' ? node.right.name : null;

      if (arrayExpr.nodeType === 'Identifier') {
        arrayName = arrayExpr.name;
        // Check if this variable has a special length macro (from filter_alpha, string_split, etc.)
        if (origArrayName && this.specialLengthVars && this.specialLengthVars.has(origArrayName)) {
          arrayLengthExpr = new CIdentifier(this.specialLengthVars.get(origArrayName));
        } else {
          // Look for companion _length variable
          arrayLengthExpr = new CIdentifier(`${arrayName}_length`);
        }
      } else if (arrayExpr.nodeType === 'MemberAccess') {
        // self->array -> self->array_length
        arrayName = arrayExpr.member;
        arrayLengthExpr = new CMemberAccess(
          arrayExpr.target,
          `${arrayExpr.member}_length`,
          arrayExpr.isPointer
        );
      } else {
        // Fallback: try to use sizeof
        arrayLengthExpr = new CBinaryExpression(
          new CSizeof(arrayExpr, false),
          '/',
          new CSizeof(new CIdentifier(varType), true)
        );
      }

      // Create unique index variable
      const indexVarName = `_idx_${this._forOfCounter || 0}`;
      this._forOfCounter = (this._forOfCounter || 0) + 1;

      const indexVar = new CVariable(indexVarName, CType.SizeT(), CLiteral.UInt(0, ''));

      // Create condition: _idx < array_length
      const condition = new CBinaryExpression(
        new CIdentifier(indexVarName),
        '<',
        arrayLengthExpr
      );

      // Create update: _idx++
      const update = new CUnaryExpression('++', new CIdentifier(indexVarName));
      update.isPrefix = false;

      // Infer element type from the array type BEFORE transforming the body
      // so charCodeAt can detect single char variables
      let elemType = new CType(varType);
      if (node.right.type === 'Identifier') {
        const arrType = this.getVariableType(node.right.name);
        if (arrType) {
          // For array types with baseType, use the baseType as element type
          // This handles uint32_t*[4] -> uint32_t* element type
          if (arrType.isArray && arrType.baseType) {
            elemType = arrType.baseType;
          }
          // For char* (string), element type is char
          else if (arrType.name === 'char' && arrType.isPointer)
            elemType = CType.Char();
          // For char** (string array), element type is char*
          else if (arrType.name === 'char' && arrType.pointerLevel >= 2)
            elemType = CType.Pointer(CType.Char());
          // For uint8_t*, element type is uint8_t
          else if (arrType.name === 'uint8_t' && arrType.isPointer)
            elemType = CType.UInt8();
          // For pointer to pointer (e.g., uint32_t**), element type is pointer (uint32_t*)
          else if (arrType.isPointer && arrType.pointerLevel >= 2 && arrType.baseType) {
            elemType = arrType.baseType;
          }
        }
      }

      // Register the loop variable's type BEFORE transforming body
      // so charCodeAt can detect single chars
      // Register under both the safe name (for C output) and original name (for IL AST lookups)
      this.variableTypes.set(varName, elemType);
      if (origVarName !== varName)
        this.variableTypes.set(origVarName, elemType);

      // Now transform the body (after registering loop var type)
      const body = this.transformStatement(node.body) || new CBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      // Create the loop variable assignment: varType varName = array[_idx];
      const loopVarDecl = new CVariable(
        varName,
        elemType,
        new CArraySubscript(arrayExpr, new CIdentifier(indexVarName))
      );

      // Insert at the beginning of the body
      if (bodyBlock.statements) {
        bodyBlock.statements.unshift(loopVarDecl);
      }

      return new CFor(indexVar, condition, update, bodyBlock);
    }

    /**
     * Transform a for-in statement (not directly supported in C)
     */
    transformForInStatement(node) {
      // for-in is not directly translatable to C - use for loop
      return this.transformForOfStatement(node);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new CBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);
      return new CWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new CBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);
      return new CDoWhile(condition, bodyBlock);
    }

    /**
     * Transform a switch statement
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const switchStmt = new CSwitch(discriminant);

      for (const caseNode of node.cases) {
        const value = caseNode.test ? this.transformExpression(caseNode.test) : null;
        const statements = [];

        for (const stmt of caseNode.consequent) {
          const cStmt = this.transformStatement(stmt);
          if (cStmt) {
            if (Array.isArray(cStmt)) {
              statements.push(...cStmt);
            } else {
              statements.push(cStmt);
            }
          }
        }

        const cCase = new CCase(value, statements);
        switchStmt.cases.push(cCase);
      }

      return switchStmt;
    }

    /**
     * Transform a try statement (C doesn't have try-catch)
     */
    transformTryStatement(node) {
      // Just transform the try block - ignore catch
      return this.transformStatement(node.block);
    }

    /**
     * Transform a throw statement (C doesn't have throw)
     */
    transformThrowStatement(node) {
      // Check if we're in a void function - use simple return
      if (this.currentFunction && this.currentFunction.returnType) {
        const rt = this.currentFunction.returnType;
        // Check for void return type - CType uses .name not .baseType
        if ((rt.name === 'void' || rt.toString() === 'void') && !rt.isPointer) {
          return new CReturn(null);
        }

        // Check if current function returns a pointer type - use NULL instead of -1
        let isPointerFunction = false;

        // Method 1: Check CType flags
        if (rt.isPointer === true) isPointerFunction = true;
        // Method 2: Check pointer level
        else if (rt.pointerLevel && rt.pointerLevel > 0) isPointerFunction = true;
        // Method 3: Check if type name ends with '*'
        else if (rt.name && rt.name.endsWith('*')) isPointerFunction = true;
        // Method 4: Check toString() representation
        else if (typeof rt.toString === 'function') {
          const typeStr = rt.toString();
          if (typeStr && typeStr.includes('*')) isPointerFunction = true;
        }

        // Method 5: Check function name patterns that typically return pointers
        if (!isPointerFunction) {
          const funcName = this.currentFunction.name || '';
          const lowerFuncName = funcName.toLowerCase();
          if (lowerFuncName.includes('encode') || lowerFuncName.includes('decode') ||
              lowerFuncName.includes('encrypt') || lowerFuncName.includes('decrypt') ||
              lowerFuncName.includes('result') || lowerFuncName.includes('hash') ||
              lowerFuncName.includes('digest') || lowerFuncName.includes('output') ||
              lowerFuncName.includes('_string') || lowerFuncName.includes('string_')) {
            // Also check if the return type is uint8_t (commonly used for byte arrays)
            if (rt.name === 'uint8_t' || rt.name === 'char' ||
                (rt.baseType && (rt.baseType.name === 'uint8_t' || rt.baseType.name === 'char'))) {
              isPointerFunction = true;
            }
          }
        }

        // Method 6: Look up in CFile prototypes/functions arrays
        if (!isPointerFunction && this.currentFunction.name && this.cFile) {
          const funcName = this.currentFunction.name;
          if (this.cFile.prototypes) {
            for (const proto of this.cFile.prototypes) {
              if (proto.name === funcName && proto.returnType) {
                if (proto.returnType.isPointer || proto.returnType.pointerLevel > 0 ||
                    (proto.returnType.name && proto.returnType.name.includes('*'))) {
                  isPointerFunction = true;
                  break;
                }
              }
            }
          }
          if (!isPointerFunction && this.cFile.functions) {
            for (const fn of this.cFile.functions) {
              if (fn.name === funcName && fn.returnType) {
                if (fn.returnType.isPointer || fn.returnType.pointerLevel > 0 ||
                    (fn.returnType.name && fn.returnType.name.includes('*'))) {
                  isPointerFunction = true;
                  break;
                }
              }
            }
          }
        }

        if (isPointerFunction) {
          return new CReturn(CLiteral.Null());
        }
      }
      // Convert to return -1 for non-void, non-pointer functions
      return new CReturn(CLiteral.Int(-1));
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new CBlock();
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
     * CRITICAL: Handles all 19 expression types
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
        // 4. LogicalExpression
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);

        // 5. UnaryExpression
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);

        // 6. AssignmentExpression
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        // 7. UpdateExpression
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        // 8. MemberExpression
        case 'MemberExpression':
          return this.transformMemberExpression(node);

        // 9. CallExpression
        case 'CallExpression':
          return this.transformCallExpression(node);

        // 10. ArrayExpression and ArrayLiteral (IL AST type for typed arrays)
        case 'ArrayExpression':
        case 'ArrayLiteral':
          return this.transformArrayExpression(node);

        // 11. ObjectExpression
        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        // 12. NewExpression
        case 'NewExpression':
          return this.transformNewExpression(node);

        // 13. ThisExpression
        case 'ThisExpression':
          return new CIdentifier('self');

        // 13b. Super (treated as parent struct pointer in C)
        case 'Super':
          return new CIdentifier('super');

        // 14. ConditionalExpression
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        // 15. ArrowFunctionExpression
        case 'ArrowFunctionExpression':
        // 16. FunctionExpression
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        // 17. SequenceExpression
        case 'SequenceExpression':
          return this.transformSequenceExpression(node);

        // 18. SpreadElement
        case 'SpreadElement':
          return this.transformSpreadElement(node);

        // 19. TemplateLiteral
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        // 20. ObjectPattern (destructuring)
        case 'ObjectPattern':
          // Object destructuring - C doesn't support this directly
          // Return a comment placeholder
          return new CIdentifier('/* Object destructuring not supported in C */');

        case 'StaticBlock':
          // StaticBlock should only appear as a class member, not as an expression
          // If we encounter it here, skip it (return null)
          return null;

        case 'ChainExpression':
          // Optional chaining a?.b - C doesn't have this
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression - C uses struct literals
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - C doesn't have generators
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> C static/internal field with _ prefix
          return new CIdentifier('_' + this.toSnakeCase(node.name));

        // ===== IL AST Node Types =====
        // These are normalized nodes from the IL AST that represent
        // language-agnostic operations

        // Parent/This access patterns
        case 'ParentConstructorCall':
          return this.transformParentConstructorCall(node);

        case 'ParentMethodCall':
          return this.transformParentMethodCall(node);

        case 'ThisMethodCall':
          return this.transformThisMethodCall(node);

        case 'ThisPropertyAccess':
          return this.transformThisPropertyAccess(node);

        // Rotation operations
        case 'RotateLeft':
        case 'RotateRight':
          return this.transformRotation(node);

        // Byte packing/unpacking
        case 'PackBytes':
          return this.transformPackBytes(node);

        case 'UnpackBytes':
          return this.transformUnpackBytes(node);

        // Array operations
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

        case 'ArrayCreation':
          return this.transformArrayCreation(node);

        case 'TypedArrayCreation':
          return this.transformTypedArrayCreation(node);

        case 'ByteBufferView':
          return this.transformByteBufferView(node);

        // Encoding operations
        case 'HexDecode':
          return this.transformHexDecode(node);

        case 'HexEncode':
          return this.transformHexEncode(node);

        // BigInt cast - just cast the argument to uint64_t
        case 'BigIntCast':
          return new CCast(new CType('uint64_t'), this.transformExpression(node.argument));

        // Math operations
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
          return this.transformPow(node);

        case 'Round':
          return this.transformRound(node);

        case 'Trunc':
          return this.transformTrunc(node);

        case 'Sign':
          return this.transformSign(node);

        case 'Sqrt':
          return new CCall(new CIdentifier('sqrt'), [this.transformExpression(node.argument)]);

        case 'Log':
          return new CCall(new CIdentifier('log'), [this.transformExpression(node.argument)]);

        case 'Log2':
          return new CCall(new CIdentifier('log2'), [this.transformExpression(node.argument)]);

        case 'Log10':
          return new CCall(new CIdentifier('log10'), [this.transformExpression(node.argument)]);

        case 'Sin':
          return new CCall(new CIdentifier('sin'), [this.transformExpression(node.argument)]);

        case 'Cos':
          return new CCall(new CIdentifier('cos'), [this.transformExpression(node.argument)]);

        case 'Tan':
          return new CCall(new CIdentifier('tan'), [this.transformExpression(node.argument)]);

        case 'Asin':
          return new CCall(new CIdentifier('asin'), [this.transformExpression(node.argument)]);

        case 'Acos':
          return new CCall(new CIdentifier('acos'), [this.transformExpression(node.argument)]);

        case 'Atan':
          return new CCall(new CIdentifier('atan'), [this.transformExpression(node.argument)]);

        case 'Atan2':
          return new CCall(new CIdentifier('atan2'), [this.transformExpression(node.arguments[0]), this.transformExpression(node.arguments[1])]);

        case 'Sinh':
          return new CCall(new CIdentifier('sinh'), [this.transformExpression(node.argument)]);

        case 'Cosh':
          return new CCall(new CIdentifier('cosh'), [this.transformExpression(node.argument)]);

        case 'Tanh':
          return new CCall(new CIdentifier('tanh'), [this.transformExpression(node.argument)]);

        case 'Exp':
          return new CCall(new CIdentifier('exp'), [this.transformExpression(node.argument)]);

        case 'Cbrt':
          return new CCall(new CIdentifier('cbrt'), [this.transformExpression(node.argument)]);

        case 'Hypot':
          return new CCall(new CIdentifier('hypot'), [this.transformExpression(node.arguments[0]), this.transformExpression(node.arguments[1])]);

        case 'Fround':
          return new CCast(new CType('float'), this.transformExpression(node.argument));

        case 'MathConstant': {
          const mathConstMap = {
            'PI': 'M_PI', 'E': 'M_E', 'LN2': 'M_LN2', 'LN10': 'M_LN10',
            'LOG2E': 'M_LOG2E', 'LOG10E': 'M_LOG10E', 'SQRT2': 'M_SQRT2', 'SQRT1_2': 'M_SQRT1_2'
          };
          return new CIdentifier(mathConstMap[node.name] || String(node.value));
        }

        case 'NumberConstant': {
          switch (node.name) {
            case 'MAX_SAFE_INTEGER':
            case 'MIN_SAFE_INTEGER':
              return new CIdentifier(node.name === 'MAX_SAFE_INTEGER' ? 'LLONG_MAX' : 'LLONG_MIN');
            case 'MAX_VALUE':
              return new CIdentifier('DBL_MAX');
            case 'MIN_VALUE':
              return new CIdentifier('DBL_MIN');
            case 'EPSILON':
              return new CIdentifier('DBL_EPSILON');
            case 'POSITIVE_INFINITY':
              return new CIdentifier('INFINITY');
            case 'NEGATIVE_INFINITY':
              return new CUnaryExpression('-', new CIdentifier('INFINITY'));
            case 'NaN':
              return new CIdentifier('NAN');
            default:
              return CLiteral.Int(node.value);
          }
        }

        case 'InstanceOfCheck':
          // instanceof not available in C - emit 0 (false)
          return CLiteral.Int(0);

        case 'Random':
          return this.transformRandom(node);

        case 'Imul':
          return this.transformImul(node);

        case 'Clz32':
          return this.transformClz32(node);

        // Type casting
        case 'Cast':
          return this.transformCast(node);

        // Destructuring (should be pre-processed but handle just in case)
        case 'DestructuringAssignment':
          return this.transformDestructuringAssignment(node);

        // IL AST array operations (from type-aware-transpiler normalization)
        case 'ArrayIndexOf':
          return this.transformArrayIndexOf(node);

        case 'ArrayIncludes':
          return this.transformArrayIncludes(node);

        case 'ArrayConcat':
          return this.transformArrayConcat(node);

        case 'ArrayJoin':
          return this.transformArrayJoin(node);

        case 'ArrayReverse':
          return this.transformArrayReverse(node);

        case 'ArrayPush':
          return this.transformArrayPush(node);

        case 'ArrayPop':
          return this.transformArrayPop(node);

        case 'ArrayShift':
          return this.transformArrayShift(node);

        case 'ArraySplice':
          return this.transformArraySplice(node);

        // String/Bytes conversion operations
        case 'StringToBytes':
          return this.transformStringToBytes(node);

        case 'BytesToString':
          return this.transformBytesToString(node);

        // Generic OpCodes calls (from type-aware-transpiler for unknown methods)
        case 'OpCodesCall':
          return this.transformOpCodesCallIL(node);

        // IL AST StringInterpolation - `Hello ${name}` -> sprintf or concatenation
        case 'StringInterpolation': {
          // C needs sprintf or string concatenation
          // For simplicity, build a concatenation if all parts are simple
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value)
                  parts.push(CLiteral.String(part.value));
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                // In C, we'd need sprintf - for now, just include the expression
                parts.push(this.transformExpression(part.expression));
              }
            }
          }
          if (parts.length === 0) return CLiteral.String('');
          if (parts.length === 1) return parts[0];
          // Return first part as placeholder - C doesn't have easy string interpolation
          return parts[0];
        }

        // IL AST ObjectLiteral - {key: value} -> struct initializer or NULL
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new CIdentifier('NULL');
          // C structs need type info; return compound literal placeholder
          const inits = [];
          for (const prop of (node.properties || [])) {
            if (prop.type === 'SpreadElement') continue;
            const value = this.transformExpression(prop.value);
            inits.push(value);
          }
          return new CArrayInitializer(inits);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> char literal
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return CLiteral.String('');
          if (args.length === 1) {
            // (char)code for single char
            return new CCast(CType.Char(), args[0]);
          }
          // Multiple chars: create string array - complex in C
          return new CArrayInitializer(args.map(a => new CCast(CType.Char(), a)));
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> x != NULL
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new CBinaryExpression(value, '!=', new CIdentifier('NULL'));
        }

        // IL AST ArrowFunction - not directly supported in C
        case 'ArrowFunction': {
          // C doesn't have lambdas; return a function pointer placeholder
          return new CIdentifier('/* lambda */');
        }

        // IL AST TypeOfExpression - typeof x -> just return type name string
        case 'TypeOfExpression': {
          // C doesn't have runtime typeof
          return CLiteral.String('unknown');
        }

        // IL AST Power - x ** y -> pow(x, y)
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new CCall('pow', [left, right]);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in C)
        case 'ObjectFreeze': {
          return this.transformExpression(node.value);
        }

        // ===== Array higher-order operations =====

        case 'ArrayEvery':
          return this.transformArrayEvery(node);

        case 'ArrayFilter':
          return this.transformArrayFilter(node);

        case 'ArrayFind':
          return this.transformArrayFind(node);

        case 'ArrayFindIndex':
          return this.transformArrayFindIndex(node);

        case 'ArrayForEach':
          return this.transformArrayForEach(node);

        case 'ArrayFrom':
          return this.transformArrayFrom(node);

        case 'ArrayMap':
          return this.transformArrayMap(node);

        case 'ArrayReduce':
          return this.transformArrayReduce(node);

        case 'ArraySome':
          return this.transformArraySome(node);

        case 'ArraySort':
          return this.transformArraySort(node);

        case 'ArrayUnshift':
          return this.transformArrayUnshift(node);

        // ===== String operations =====

        case 'StringCharAt':
          return this.transformStringCharAt(node);

        case 'StringCharCodeAt':
          return this.transformStringCharCodeAt(node);

        case 'StringEndsWith':
          return this.transformStringEndsWith(node);

        case 'StringIncludes':
          return this.transformStringIncludes(node);

        case 'StringIndexOf':
          return this.transformStringIndexOf(node);

        case 'StringRepeat':
          return this.transformStringRepeat(node);

        case 'StringReplace':
          return this.transformStringReplace(node);

        case 'StringSplit':
          return this.transformStringSplit(node);

        case 'StringStartsWith':
          return this.transformStringStartsWith(node);

        case 'StringSubstring':
          return this.transformStringSubstring(node);

        case 'StringToLowerCase':
          return this.transformStringToLowerCase(node);

        case 'StringToUpperCase':
          return this.transformStringToUpperCase(node);

        case 'StringTrim':
          return this.transformStringTrim(node);

        case 'StringTransform':
          return this.transformStringTransform(node);

        // ===== Buffer/DataView/TypedArray operations =====

        case 'BufferCreation':
          return this.transformBufferCreation(node);

        case 'DataViewCreation':
          return this.transformDataViewCreation(node);

        case 'DataViewRead':
          return this.transformDataViewRead(node);

        case 'DataViewWrite':
          return this.transformDataViewWrite(node);

        case 'TypedArraySet':
          return this.transformTypedArraySet(node);

        case 'TypedArraySubarray':
          return this.transformTypedArraySubarray(node);

        // ===== Map/Set operations =====

        case 'MapCreation':
          return this.transformMapCreation(node);

        case 'MapGet':
          return this.transformMapGet(node);

        case 'MapSet':
          return this.transformMapSet(node);

        case 'MapHas':
          return this.transformMapHas(node);

        case 'MapDelete':
          return this.transformMapDelete(node);

        case 'SetCreation':
          return this.transformSetCreation(node);

        // ===== Utility operations =====

        case 'CopyArray':
          return this.transformCopyArray(node);

        case 'ObjectKeys':
          return this.transformObjectKeys(node);

        case 'ObjectValues':
          return this.transformObjectValues(node);

        case 'ObjectEntries':
          return this.transformObjectEntries(node);

        case 'DebugOutput':
          return this.transformDebugOutput(node);

        case 'ErrorCreation':
          return this.transformErrorCreation(node);

        case 'IsFiniteCheck':
          return this.transformIsFiniteCheck(node);

        case 'IsNaNCheck':
          return this.transformIsNaNCheck(node);

        case 'IsIntegerCheck':
          return this.transformIsIntegerCheck(node);

        case 'AnsiToBytes':
          return this.transformAnsiToBytes(node);

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
          const suffix = node.value >= 0 ? 'U' : '';
          return CLiteral.UInt(node.value, suffix);
        }
        return new CLiteral(node.value, 'float');
      }

      // Handle BigInt values - JavaScript's arbitrary precision integers
      if (typeof node.value === 'bigint') {
        // Convert to hex with ULL suffix for 64-bit, U for 32-bit
        const absVal = node.value < 0 ? -node.value : node.value;
        const hexStr = '0x' + absVal.toString(16);
        const suffix = absVal > 0xFFFFFFFFn ? 'ULL' : 'U';
        const prefix = node.value < 0 ? '-' : '';
        return new CLiteral(prefix + hexStr + suffix, 'raw');
      }

      if (typeof node.value === 'string') {
        // Single-character strings should be char literals in C
        // This is important for comparisons like char >= '0' && char <= '9'
        if (node.value.length === 1)
          return CLiteral.Char(node.value);
        return CLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return CLiteral.Bool(node.value);
      }

      if (node.value === null) {
        return CLiteral.Null();
      }

      // Handle undefined - treat same as null in C
      if (node.value === undefined) {
        return CLiteral.Null();
      }

      return new CLiteral(node.value, 'unknown');
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords and global constants to C equivalents
      if (name === 'undefined') return CLiteral.Null();
      if (name === 'null') return CLiteral.Null();
      if (name === 'Infinity') {
        // Add math.h include for INFINITY macro
        if (this.targetFile && !this.targetFile.includes.some(inc => inc.name === 'math.h'))
          this.targetFile.includes.push(new CInclude('math.h', true));
        return new CIdentifier('INFINITY');
      }
      if (name === 'NaN') {
        if (this.targetFile && !this.targetFile.includes.some(inc => inc.name === 'math.h'))
          this.targetFile.includes.push(new CInclude('math.h', true));
        return new CIdentifier('NAN');
      }

      // Check if this variable was renamed to avoid shadowing
      const renamedName = this.renamedVariables.get(name);
      if (renamedName) {
        return new CIdentifier(renamedName);
      }

      // Use toSafeCName for consistent reserved word escaping
      return new CIdentifier(this.toSafeCName(name));
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

      // Handle JavaScript >>> (unsigned right shift)
      if (operator === '>>>') {
        operator = '>>';
        // Cast left to unsigned for unsigned shift
        left = new CCast(CType.UInt32(), left);
      }

      // Handle comparisons with null/undefined for non-pointer types
      // In JavaScript: value == null or value === null
      // In C: comparing non-pointer (e.g. uint32_t) to NULL is a type error
      // Convert to sentinel value comparison: value == (uint32_t)-1
      if (operator === '==' || operator === '!=') {
        const isLeftNull = (left instanceof CLiteral && left.value === null);
        const isRightNull = (right instanceof CLiteral && right.value === null);

        if (isLeftNull || isRightNull) {
          // Determine which side is the value and infer its type
          const valueNode = isLeftNull ? node.right : node.left;
          const valueExpr = isLeftNull ? right : left;
          const valueType = this.inferTypeFromValue(valueNode);

          // If the value is a non-pointer integer type, use -1 as sentinel instead of NULL
          if (valueType && !valueType.isPointer) {
            const isIntegerType = ['int', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
                                   'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t',
                                   'unsigned', 'signed', 'char'].includes(valueType.baseType);
            if (isIntegerType) {
              // Use -1 cast to the appropriate type as sentinel for "not found" / "undefined"
              const sentinel = new CCast(new CType(valueType.baseType), CLiteral.Int(-1));
              if (isLeftNull)
                left = sentinel;
              else
                right = sentinel;
            }
          }
        }
      }

      // Handle JavaScript || fallback pattern: a || b -> (a) ? (a) : (b)
      // In JavaScript, || returns the first truthy value, not a boolean
      if (operator === '||') {
        // If left is NULL (from unsupported computed property access on struct),
        // just return the right side directly to avoid type mismatch in ternary
        if (left instanceof CLiteral && left.value === null)
          return right;

        // For struct types, the value can never be falsy - just return left
        // Structs always "exist" in C, so || fallback is never needed

        // Check 1: If left operand is a computed member expression on a struct variable
        // e.g., configs[variant] where configs is of type ConfigsT
        if (node.left.type === 'MemberExpression' && node.left.computed &&
            node.left.object?.type === 'Identifier') {
          const objType = this.getVariableType(node.left.object.name);
          // If the object is a non-primitive struct type, the access returns a struct value
          // which can never be falsy in C
          if (objType && !objType.isPointer && objType.name &&
              !['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
                'int8_t', 'int16_t', 'int32_t', 'int64_t',
                'char', 'bool', 'size_t', 'void', 'float', 'double'].includes(objType.name)) {
            return left;
          }
        }

        // Check 2: Direct type inference on left operand
        const leftType = this.inferTypeFromValue(node.left);
        if (leftType && !leftType.isPointer && leftType.name &&
            !['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
              'int8_t', 'int16_t', 'int32_t', 'int64_t',
              'char', 'bool', 'size_t', 'void', 'float', 'double'].includes(leftType.name)) {
          // This is a struct type - can never be falsy, just return left
          return left;
        }

        // For complex expressions that are not simple booleans, use ternary
        // This handles patterns like: obj[key] || obj.default
        return new CConditional(left, left, right);
      }

      // Handle JavaScript && short-circuit pattern: a && b -> (a) ? (b) : (a)
      // In JavaScript, && returns the last truthy value or first falsy
      if (operator === '&&') {
        // For boolean contexts, the standard && works, but for value returns:
        return new CConditional(left, right, left);
      }

      // Handle string concatenation: str1 + str2 or str + char
      // In C, you can't use + for string concatenation, use concat function
      if (operator === '+') {
        const leftType = this.inferTypeFromValue(node.left);
        const rightType = this.inferTypeFromValue(node.right);
        const isLeftString = leftType && (leftType.name === 'char*' || leftType.name === 'const char*' ||
            (leftType.isPointer && (leftType.baseType === 'char' || leftType.baseType?.name === 'char')));
        const isRightString = rightType && (rightType.name === 'char*' || rightType.name === 'const char*' ||
            (rightType.isPointer && (rightType.baseType === 'char' || rightType.baseType?.name === 'char')));
        const isLeftLiteralString = node.left.type === 'Literal' && typeof node.left.value === 'string';
        const isRightLiteralString = node.right.type === 'Literal' && typeof node.right.value === 'string';

        // Check if right side is a single char (from array subscript or char type)
        const isRightChar = rightType && (rightType.name === 'char' || rightType.name === 'uint8_t') && !rightType.isPointer;
        // Also check if right side is a computed MemberExpression on a string (returns char)
        const isRightArraySubscript = node.right.type === 'MemberExpression' && node.right.computed &&
            (isLeftString || isLeftLiteralString);

        if (isLeftString || isLeftLiteralString) {
          if (isRightChar || isRightArraySubscript) {
            // Right side is a single character - use string_append_char
            return new CCall(new CIdentifier('string_append_char'), [left, right]);
          } else if (isRightString || isRightLiteralString) {
            // Both are strings - use string_concat
            return new CCall(new CIdentifier('string_concat'), [left, right]);
          }
          // Default to string_append_char since concatenating string+expression is common
          return new CCall(new CIdentifier('string_append_char'), [left, right]);
        } else if (isRightString || isRightLiteralString) {
          // Left is not string but right is - use string_concat
          return new CCall(new CIdentifier('string_concat'), [left, right]);
        }
      }

      // Handle JavaScript ?? (nullish coalescing): a ?? b
      // In JavaScript, ?? returns b only if a is null/undefined
      // In C: structs and primitives can never be null - just return a
      // For pointers: a != NULL ? a : b
      if (operator === '??') {
        // Infer the type of the left operand
        const leftType = this.inferTypeFromValue(node.left);

        // For struct types, the value can never be null - just return it
        if (leftType && !leftType.isPointer && leftType.name &&
            !['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
              'int8_t', 'int16_t', 'int32_t', 'int64_t',
              'char', 'bool', 'size_t', 'void', 'float', 'double'].includes(leftType.name)) {
          // This is a struct type - can never be null, just return left
          return left;
        }

        // For primitive types that can't be null, also just return left
        if (leftType && !leftType.isPointer) {
          return left;
        }

        // For pointer types, use proper null check: a != NULL ? a : b
        return new CConditional(
          new CBinaryExpression(left, '!=', new CIdentifier('NULL')),
          left,
          right
        );
      }

      return new CBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;
      if (operator === 'typeof') {
        // C is statically typed - typeof checks aren't meaningful at runtime
        // For comparisons like `typeof x === 'number'`, we infer the type statically
        // Return a string that matches common type comparisons to preserve behavior
        const argType = this.inferTypeFromValue(node.argument);
        if (argType) {
          // Map C types to JavaScript typeof strings
          const typeName = argType.name || argType.toString();
          if (typeName.includes('int') || typeName.includes('float') || typeName.includes('double') || typeName.includes('uint'))
            return CLiteral.String('number');
          if (typeName.includes('char*') || typeName === 'string')
            return CLiteral.String('string');
          if (typeName.includes('bool'))
            return CLiteral.String('boolean');
          if (argType.isPointer || typeName.includes('*'))
            return CLiteral.String('object');
        }
        // Default to "undefined" for unknown types - makes !== checks pass
        return CLiteral.String('undefined');
      }

      return new CUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);

      // Check if right side is an array BEFORE transforming it
      const isRightArrayLiteral = node.right.type === 'ArrayExpression' || node.right.type === 'ArrayLiteral';

      let right = this.transformExpression(node.right);

      // Check if left side is a string/pointer type
      const leftType = this.inferTypeFromValue(node.left);
      const isLeftString = leftType && (leftType.name === 'char*' || leftType.name === 'const char*' ||
          leftType.name === 'uint8_t*' || leftType.name === 'const uint8_t*' ||
          (leftType.isPointer && (leftType.baseType === 'char' || leftType.baseType?.name === 'char' ||
                                   leftType.baseType === 'uint8_t' || leftType.baseType?.name === 'uint8_t')));

      // Handle string concatenation: str += char becomes str = string_append_char(str, char)
      // str += str2 becomes str = string_concat(str, str2)
      // In C, you can't use += for string concatenation
      if (node.operator === '+=' && isLeftString) {
        // Check if right side is a single character
        // - MemberExpression with computed access on string array: alphabet[index]
        // - Single character literal: 'a'
        const rightType = this.inferTypeFromValue(node.right);
        const isRightChar = rightType && (rightType.name === 'char' || rightType.name === 'uint8_t') && !rightType.isPointer;
        const isRightArraySubscript = node.right.type === 'MemberExpression' && node.right.computed;
        const isRightCharLiteral = node.right.type === 'Literal' && typeof node.right.value === 'string' && node.right.value.length === 1;

        if (isRightChar || isRightArraySubscript || isRightCharLiteral) {
          // Right side is a single character - use string_append_char
          return new CAssignment(left, '=', new CCall(new CIdentifier('string_append_char'), [left, right]));
        }
        // Convert to: str = string_concat(str, value) for string values
        return new CAssignment(left, '=', new CCall(new CIdentifier('string_concat'), [left, right]));
      }

      // Handle character literal assignment to pointer type: ptr = 'A' -> ptr = "A"
      // In JavaScript, single characters can be assigned to strings, but in C we need string literals
      if (node.operator === '=' && isLeftString) {
        if (node.right.type === 'Literal' && typeof node.right.value === 'string' && node.right.value.length === 1) {
          // Convert single-char literal to string literal for pointer assignment
          right = CLiteral.String(node.right.value);
        }
      }

      // Handle array literal assignment: self->arr = {...} must become self->arr = (type[]){...}
      // In C, bare brace-enclosed initializers are only valid in declarations, not assignments.
      // For assignments, we need C99 compound literals: (type[]){elem1, elem2, ...}
      if (node.operator === '=' && isRightArrayLiteral) {
        // Infer the element type from the array contents or the left-hand side
        let elementType = CType.UInt8(); // Default to uint8_t for byte arrays

        if (node.right.elementType) {
          // IL AST may provide explicit element type
          elementType = this.mapType(node.right.elementType);
        } else if (node.right.elements && node.right.elements.length > 0) {
          // Infer from first non-null element
          const firstElem = node.right.elements.find(e => e != null);
          if (firstElem) {
            const elemType = this.inferTypeFromValue(firstElem);
            if (elemType && !elemType.isPointer) {
              elementType = elemType;
            }
          }
        }

        // Also check if left side hints at the type (e.g., self->key_words should be uint32_t)
        if (leftType && leftType.isPointer && leftType.baseType) {
          const baseTypeName = typeof leftType.baseType === 'string' ? leftType.baseType : leftType.baseType.name;
          if (baseTypeName === 'uint32_t' || baseTypeName === 'int32_t' ||
              baseTypeName === 'uint16_t' || baseTypeName === 'int16_t') {
            elementType = leftType.baseType instanceof CType ? leftType.baseType : new CType(baseTypeName);
          }
        }

        // Check if right is a CArrayInitializer and wrap it in a compound literal
        // Note: CNode subclasses use 'nodeType' property, not 'type'
        if (right && right.nodeType === 'ArrayInitializer') {
          // Use CType.Array for compound literals: (type[]){elem1, elem2, ...}
          const arrayType = CType.Array(elementType);
          right = new CCompoundLiteral(arrayType, right);
        }
      }

      return new CAssignment(left, node.operator, right);
    }

    /**
     * Transform an update expression (++, --)
     * C supports ++/-- both as statements and expressions, so return proper CUnaryExpression
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      if (!operand) return null;

      const unary = new CUnaryExpression(node.operator, operand);
      unary.isPrefix = node.prefix;
      return unary;
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      // Handle global.OpCodes and globalThis.OpCodes - these are always truthy in transpiled code
      // since OpCodes are inlined, so we return 1 (true) for truthiness checks
      if (node.object.type === 'Identifier') {
        const objectName = node.object.name;
        const member = node.property.name || node.property.value;
        if ((objectName === 'global' || objectName === 'globalThis') && member === 'OpCodes')
          return CLiteral.UInt(1, '');  // OpCodes are always available in transpiled code
      }

      // Handle known framework constants - convert to enum or literal values
      if (node.object.type === 'Identifier') {
        const objectName = node.object.name;
        const member = node.property.name || node.property.value;

        // Map framework constants to C enum values
        const frameworkConstants = {
          'ComplexityType': {
            'BEGINNER': 0, 'INTERMEDIATE': 1, 'ADVANCED': 2, 'EXPERT': 3, 'RESEARCH': 4
          },
          'complexity_type': {
            'BEGINNER': 0, 'INTERMEDIATE': 1, 'ADVANCED': 2, 'EXPERT': 3, 'RESEARCH': 4
          },
          'CategoryType': {
            'BLOCK': 0, 'STREAM': 1, 'HASH': 2, 'ASYMMETRIC': 3, 'MAC': 4,
            'KDF': 5, 'COMPRESSION': 6, 'ENCODING': 7, 'CLASSICAL': 8,
            'ECC': 9, 'CHECKSUM': 10, 'SPECIAL': 11, 'AEAD': 12, 'RANDOM': 13
          },
          'SecurityStatus': {
            'SECURE': 0, 'BROKEN': 1, 'DEPRECATED': 2, 'EXPERIMENTAL': 3,
            'EDUCATIONAL': 4, 'OBSOLETE': 5
          },
          'CountryCode': {
            'US': 0, 'UK': 1, 'DE': 2, 'FR': 3, 'RU': 4, 'CN': 5, 'JP': 6,
            'IL': 7, 'BE': 8, 'CH': 9, 'KR': 10, 'UNKNOWN': 255
          }
        };

        if (frameworkConstants[objectName] && frameworkConstants[objectName][member] !== undefined) {
          return CLiteral.UInt(frameworkConstants[objectName][member]);
        }

        // Also handle snake_case versions that IL AST might produce
        const snakeCaseConstants = {
          'complexity_type': frameworkConstants['ComplexityType'],
          'category_type': frameworkConstants['CategoryType'],
          'security_status': frameworkConstants['SecurityStatus'],
          'country_code': frameworkConstants['CountryCode']
        };

        if (snakeCaseConstants[objectName]) {
          // Convert member from SCREAMING_SNAKE_CASE or any format to uppercase
          const upperMember = member.toUpperCase().replace(/[^A-Z0-9]/g, '_');
          if (snakeCaseConstants[objectName][upperMember] !== undefined)
            return CLiteral.UInt(snakeCaseConstants[objectName][upperMember]);
        }

        // Handle static class field access: ClassName.Property -> CLASSNAME_PROPERTY
        if (this.classNames.has(objectName)) {
          const staticKey = `${objectName}.${member}`;
          const constName = this.staticClassFields.get(staticKey);
          if (constName)
            return new CIdentifier(constName);
        }
      }

      const object = this.transformExpression(node.object);
      const member = node.property.name || node.property.value;

      if (node.computed) {
        const index = this.transformExpression(node.property);

        // Check if the object is an array/pointer type - use array subscript
        if (node.object.type === 'Identifier') {
          const varType = this.getVariableType(node.object.name);
          // If it's a pointer type, use array subscript (not struct member access)
          if (varType && varType.isPointer)
            return new CArraySubscript(object, index);
        }

        // If the property is a string literal (like configs["key"]), treat as struct member access
        // Check if the object is a struct type (not array/pointer) first
        const isStructType = (objNode) => {
          if (objNode.type === 'Identifier') {
            const varType = this.getVariableType(objNode.name);
            if (varType && varType.name && !varType.isPointer &&
                !['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'char', 'bool', 'size_t', 'void'].includes(varType.name))
              return true;
          }
          return false;
        };

        // For struct types with numeric key access, convert to member access with v_ prefix
        // e.g., configs[32] -> configs.v_32, configs["32"] -> configs.v_32
        if (node.property.type === 'Literal') {
          const propValue = node.property.value;

          // Handle numeric indices
          if (typeof propValue === 'number') {
            // Check if object is a struct type - use member access with v_ prefix
            if (isStructType(node.object)) {
              const fieldName = `v_${propValue}`;
              const isPointer = this.isPointerType(node.object);
              return new CMemberAccess(object, fieldName, isPointer);
            }
            return new CArraySubscript(object, index);
          }

          // String key like configs["32"] or options["mode"]
          if (typeof propValue === 'string') {
            let keyStr = propValue;
            // Strip surrounding quotes if present (from IL AST)
            if ((keyStr.startsWith("'") && keyStr.endsWith("'")) || (keyStr.startsWith('"') && keyStr.endsWith('"')))
              keyStr = keyStr.slice(1, -1);

            // If key is all numeric, check if we should use struct member or array subscript
            if (/^\d+$/.test(keyStr)) {
              if (isStructType(node.object)) {
                const fieldName = `v_${keyStr}`;
                const isPointer = this.isPointerType(node.object);
                return new CMemberAccess(object, fieldName, isPointer);
              }
              return new CArraySubscript(object, CLiteral.UInt(parseInt(keyStr, 10), 'U'));
            }

            const sanitizedKey = this.sanitizeCIdentifier(keyStr);
            const fieldName = this.toSnakeCase(sanitizedKey);
            const isPointer = this.isPointerType(node.object);
            return new CMemberAccess(object, fieldName, isPointer);
          }
        }

        // For dynamic computed access on struct types, we need special handling
        // e.g., configs[variant] where variant is a parameter
        if (node.object.type === 'Identifier' && isStructType(node.object)) {
          // Dynamic access on struct - emit member access with v_ prefix and index
          // This will generate configs.v_<index> but index needs to be a literal
          // For now, generate a ternary chain for common variants (16, 32, 64)
          const varType = this.getVariableType(node.object.name);
          const isPointer = this.isPointerType(node.object);

          // Create ternary: variant == 16 ? configs.v_16 : variant == 32 ? configs.v_32 : configs.v_64
          return new CConditional(
            new CBinaryExpression(index, '==', CLiteral.UInt(16, 'U')),
            new CMemberAccess(object, 'v_16', isPointer),
            new CConditional(
              new CBinaryExpression(index, '==', CLiteral.UInt(32, 'U')),
              new CMemberAccess(object, 'v_32', isPointer),
              new CMemberAccess(object, 'v_64', isPointer)
            )
          );
        }

        return new CArraySubscript(object, index);
      }

      // Handle .length property - convert to companion length variable/field
      if (member === 'length') {
        // For simple identifiers (parameters/variables), use {name}_length
        if (node.object.type === 'Identifier') {
          const varName = node.object.name;
          const snakeName = this.toSnakeCase(varName);

          // Check if this variable has a special length macro (from filter_alpha, string_split, etc.)
          if (this.specialLengthVars && this.specialLengthVars.has(varName))
            return new CIdentifier(this.specialLengthVars.get(varName));

          const lengthVarName = snakeName + '_length';
          return new CIdentifier(lengthVarName);
        }
        // For member access (struct fields), access the length field
        if (node.object.type === 'MemberExpression') {
          const isPointer = this.isPointerType(node.object.object);
          // Get the field name and append _length
          const innerMember = node.object.property.name || node.object.property.value;
          const lengthFieldName = this.toSnakeCase(innerMember) + '_length';
          const innerObject = this.transformExpression(node.object.object);
          return new CMemberAccess(innerObject, lengthFieldName, isPointer);
        }
      }

      // Regular field access
      let fieldName = this.toSnakeCase(member);

      // Strip leading underscore for struct field access (this.x -> self->x)
      // Private fields like _key are stored as 'key' in C structs
      if ((node.object.type === 'ThisExpression' ||
           (node.object.type === 'Identifier' && node.object.name === 'self')) &&
          fieldName.startsWith('_'))
        fieldName = fieldName.substring(1);

      // Determine if pointer or direct access (use -> for pointers)
      const isPointer = this.isPointerType(node.object);
      return new CMemberAccess(object, fieldName, isPointer);
    }

    /**
     * Check if an expression is a pointer type
     */
    isPointerType(node) {
      // Simple heuristic - could be improved with type tracking
      // ThisExpression -> 'self' which is a pointer to the struct
      if (node.type === 'ThisExpression') return true;
      if (node.type === 'Identifier' && node.name === 'self') return true;

      // Check if an Identifier is a pointer type variable
      // e.g., des_instance is a TripleDESInstance* pointer
      if (node.type === 'Identifier') {
        const varType = this.getVariableType(node.name);
        if (varType && varType.isPointer) return true;
        // Also check if the type name ends with * (pointer type naming convention)
        if (varType && varType.name && varType.name.endsWith('*')) return true;
      }

      // Check if it's a MemberExpression accessing a pointer field
      // e.g., this.algorithm where algorithm is a pointer type
      if (node.type === 'MemberExpression') {
        const member = node.property?.name || node.property?.value;
        if (member) {
          let fieldName = this.toSnakeCase(member);
          // Strip underscore for struct field lookup (fields stored without underscore)
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);
          const fieldType = this.structFieldTypes.get(fieldName);
          if (fieldType && fieldType.isPointer) return true;
        }
      }

      // IL AST: ThisPropertyAccess
      if (node.type === 'ThisPropertyAccess') {
        const propName = typeof node.property === 'string' ? node.property : node.property?.name;
        if (propName) {
          let fieldName = this.toSnakeCase(propName);
          // Strip underscore for struct field lookup (fields stored without underscore)
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);
          const fieldType = this.structFieldTypes.get(fieldName);
          if (fieldType && fieldType.isPointer) return true;
        }
      }

      return false;
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle OpCodes calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle BigInt() constructor calls - convert to C integer literals
      if (node.callee.type === 'Identifier' && node.callee.name === 'BigInt') {
        const arg = node.arguments[0];
        if (arg) {
          // Handle BigInt('0x...') or BigInt(hexString)
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            let hexStr = arg.value;
            // Remove any 'n' suffix if present
            if (hexStr.endsWith('n')) hexStr = hexStr.slice(0, -1);
            // Parse as BigInt and convert to hex literal
            try {
              const val = BigInt(hexStr);
              const absVal = val < 0 ? -val : val;
              const hexLit = '0x' + absVal.toString(16);
              const suffix = absVal > 0xFFFFFFFFn ? 'ULL' : 'U';
              const prefix = val < 0 ? '-' : '';
              return new CLiteral(prefix + hexLit + suffix, 'raw');
            } catch (e) {
              // Fall through to default handling
            }
          }
          // Handle BigInt(number)
          if (arg.type === 'Literal' && typeof arg.value === 'number') {
            const val = BigInt(arg.value);
            const hexStr = '0x' + (val < 0 ? (-val).toString(16) : val.toString(16));
            const suffix = (val > 0xFFFFFFFFn || val < -0x7FFFFFFFn) ? 'ULL' : 'U';
            const prefix = val < 0 ? '-' : '';
            return new CLiteral(prefix + hexStr + suffix, 'raw');
          }
        }
      }

      // Handle Number() constructor calls - convert to C integer cast
      if (node.callee.type === 'Identifier' && node.callee.name === 'Number') {
        const arg = node.arguments[0];
        if (arg) {
          const transformedArg = this.transformExpression(arg);
          // Cast to uint32_t (most common use case for Number() in crypto code)
          return new CCast(CType.UInt32(), transformedArg);
        }
        // Number() with no args -> 0
        return CLiteral.UInt(0, '');
      }

      // Handle Array.isArray() - C knows types at compile time
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Array' &&
          (node.callee.property.name === 'isArray' || node.callee.property.value === 'isArray')) {
        // In C, we know types at compile time - arrays are always arrays
        return CLiteral.Bool(true);
      }

      // Handle Array.from() - convert to array copy or initialization
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Array' &&
          (node.callee.property.name === 'from' || node.callee.property.value === 'from')) {
        // Array.from(source) - just return the source array (already an array in C)
        // Array.from({length: n}, () => init) - handled by returning calloc
        if (node.arguments.length >= 1) {
          const sourceArg = node.arguments[0];
          // Check if it's Array.from({length: n}, mapFn)
          if (sourceArg.type === 'ObjectExpression' && sourceArg.properties) {
            const lengthProp = sourceArg.properties.find(p =>
              (p.key?.name === 'length' || p.key?.value === 'length'));
            if (lengthProp) {
              // Array.from({length: n}, ...) - allocate array of size n
              const lengthExpr = this.transformExpression(lengthProp.value);
              // Return calloc for zero-initialized array
              return new CCall(new CIdentifier('calloc'), [
                lengthExpr,
                new CCall(new CIdentifier('sizeof'), [new CIdentifier('uint8_t')])
              ]);
            }
          }
          // Simple Array.from(arr) - just return the array pointer (shallow copy semantics)
          return this.transformExpression(sourceArg);
        }
        // Empty Array.from() - return NULL
        return new CIdentifier('NULL');
      }

      // Handle Object.freeze/seal/assign([...]) - unwrap and return the inner array as compound literal
      // In local context, these should just become static const arrays
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Object' &&
          ['freeze', 'seal', 'assign'].includes(node.callee.property?.name)) {
        // Get the inner value (first argument for freeze/seal, or rest args for assign)
        const innerValue = node.arguments[0];
        if (innerValue && innerValue.type === 'ArrayExpression') {
          // Transform array elements to get types and values
          const elements = innerValue.elements || [];
          if (elements.length > 0) {
            // Infer element type from first non-null element
            let elemType = CType.UInt32(); // Default
            for (const elem of elements) {
              if (elem && elem.type === 'Literal') {
                if (typeof elem.value === 'number') {
                  // Check if values fit in specific types
                  const maxVal = Math.max(...elements.filter(e => e?.type === 'Literal').map(e => e.value || 0));
                  if (maxVal <= 0xFF) elemType = CType.UInt8();
                  else if (maxVal <= 0xFFFF) elemType = CType.UInt16();
                  else if (maxVal <= 0xFFFFFFFF) elemType = CType.UInt32();
                  else elemType = CType.UInt64();
                  break;
                }
              }
            }
            // Create compound literal: (uint16_t[]){0x0123, 0x4567, ...}
            const transformedElements = elements.map(e => this.transformExpression(e)).filter(e => e);
            const arrayType = CType.Array(elemType);
            return new CCompoundLiteral(arrayType, new CArrayInitializer(transformedElements));
          }
        }
        // If inner value is not an array, just transform it directly
        if (innerValue) {
          return this.transformExpression(innerValue);
        }
      }

      // Handle String.fromCharCode() - convert char codes to char/char* cast
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'String' &&
          (node.callee.property.name === 'fromCharCode' || node.callee.property.value === 'fromCharCode')) {
        // Check if there's a spread element - this means we're converting an array to a string
        const hasSpread = node.arguments.some(arg => arg.type === 'SpreadElement');
        if (hasSpread && node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement') {
          // String.fromCharCode(...bytes) -> (const char*)bytes (byte array to string cast)
          const spreadArg = this.transformExpression(node.arguments[0].argument);
          return new CCast(CType.Pointer(CType.Char()), spreadArg);
        }
        const args = node.arguments.map(arg => this.transformExpression(arg)).filter(a => a);
        // String.fromCharCode(code) -> (char)(code) for single char
        if (args.length === 1 && !hasSpread) {
          return new CCast(CType.Char(), args[0]);
        }
        // For multiple args without spread, need to build a string - return cast of first for now
        return new CCast(CType.Char(), args[0] || CLiteral.UInt(0, ''));
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;

        // Handle console.log/warn/error - convert to no-op or printf
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'console') {
          // For now, convert console methods to comments (effectively no-op)
          // Could also convert to fprintf(stderr, ...) for warn/error
          const args = node.arguments.map(arg => this.transformExpression(arg)).filter(a => a);
          if (method === 'log' || method === 'warn' || method === 'error') {
            // Return a no-op - an empty expression or comment
            // Using (void)0 as a C no-op that works in expression context
            return new CCast(CType.Void(), CLiteral.UInt(0, ''));
          }
        }

        // Handle JavaScript Math methods -> C math.h functions
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Math') {
          const args = node.arguments.map(arg => this.transformExpression(arg)).filter(a => a);
          // Add math.h include if we have a target file
          if (this.targetFile && !this.targetFile.includes.some(inc => inc.name === 'math.h')) {
            this.targetFile.includes.push(new CInclude('math.h', true));
          }
          switch (method) {
            case 'floor':
              return new CCall(new CIdentifier('floor'), args);
            case 'ceil':
              return new CCall(new CIdentifier('ceil'), args);
            case 'abs':
              // Use fabs for floating point, abs for integer
              return new CCall(new CIdentifier('fabs'), args);
            case 'round':
              return new CCall(new CIdentifier('round'), args);
            case 'sqrt':
              return new CCall(new CIdentifier('sqrt'), args);
            case 'pow':
              return new CCall(new CIdentifier('pow'), args);
            case 'min':
              // Use fmin for 2 args; for more, generate nested calls
              if (args.length === 2)
                return new CCall(new CIdentifier('fmin'), args);
              // Nested fmin for multiple args: fmin(a, fmin(b, c))
              return args.reduceRight((acc, arg) =>
                acc === null ? arg : new CCall(new CIdentifier('fmin'), [arg, acc])
              , null);
            case 'max':
              if (args.length === 2)
                return new CCall(new CIdentifier('fmax'), args);
              return args.reduceRight((acc, arg) =>
                acc === null ? arg : new CCall(new CIdentifier('fmax'), [arg, acc])
              , null);
            case 'sin':
              return new CCall(new CIdentifier('sin'), args);
            case 'cos':
              return new CCall(new CIdentifier('cos'), args);
            case 'tan':
              return new CCall(new CIdentifier('tan'), args);
            case 'asin':
              return new CCall(new CIdentifier('asin'), args);
            case 'acos':
              return new CCall(new CIdentifier('acos'), args);
            case 'atan':
              return new CCall(new CIdentifier('atan'), args);
            case 'atan2':
              return new CCall(new CIdentifier('atan2'), args);
            case 'log':
              return new CCall(new CIdentifier('log'), args);
            case 'log2':
              return new CCall(new CIdentifier('log2'), args);
            case 'log10':
              return new CCall(new CIdentifier('log10'), args);
            case 'exp':
              return new CCall(new CIdentifier('exp'), args);
            case 'trunc':
              return new CCall(new CIdentifier('trunc'), args);
            case 'sign':
              // C doesn't have sign, use: (x > 0) - (x < 0)
              const arg = args[0];
              return new CBinaryExpression(
                new CBinaryExpression(arg, '>', CLiteral.Int(0)),
                '-',
                new CBinaryExpression(arg, '<', CLiteral.Int(0))
              );
            case 'clz32':
              // Count leading zeros - use __builtin_clz in GCC
              return new CCall(new CIdentifier('__builtin_clz'), args);
            case 'imul':
              // 32-bit integer multiplication
              return new CCast(CType.Int32(), new CBinaryExpression(args[0], '*', args[1]));
            default:
              // Fallback for unknown Math methods
              return new CCall(new CIdentifier(method), args);
          }
        }

        // Handle JavaScript Number static methods
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Number') {
          const args = node.arguments.map(arg => this.transformExpression(arg)).filter(a => a);
          switch (method) {
            case 'isInteger':
              // For integer types, always true; for float: x == (int)x
              // Since our transpiler primarily uses integer types, return 1 (true)
              // More precise: ((double)(arg) == (double)((int)(arg)))
              return new CBinaryExpression(
                new CCast(CType.Double(), args[0]),
                '==',
                new CCast(CType.Double(), new CCast(CType.Int32(), args[0]))
              );
            case 'isNaN':
              // Add math.h include
              if (this.targetFile && !this.targetFile.includes.some(inc => inc.name === 'math.h'))
                this.targetFile.includes.push(new CInclude('math.h', true));
              return new CCall(new CIdentifier('isnan'), args);
            case 'isFinite':
              if (this.targetFile && !this.targetFile.includes.some(inc => inc.name === 'math.h'))
                this.targetFile.includes.push(new CInclude('math.h', true));
              return new CCall(new CIdentifier('isfinite'), args);
            case 'parseFloat':
              if (this.targetFile && !this.targetFile.includes.some(inc => inc.name === 'stdlib.h'))
                this.targetFile.includes.push(new CInclude('stdlib.h', true));
              return new CCall(new CIdentifier('atof'), args);
            case 'parseInt':
              if (this.targetFile && !this.targetFile.includes.some(inc => inc.name === 'stdlib.h'))
                this.targetFile.includes.push(new CInclude('stdlib.h', true));
              // parseInt(str, radix) -> strtol(str, NULL, radix)
              if (args.length >= 2)
                return new CCall(new CIdentifier('strtol'), [args[0], new CIdentifier('NULL'), args[1]]);
              return new CCall(new CIdentifier('atoi'), [args[0]]);
            default:
              // Fallback for unknown Number methods
              return new CCall(new CIdentifier(this.toSnakeCase(method)), args);
          }
        }

        // Expand args to include _length for array-typed identifiers
        const args = this._expandArgsWithLengths(node.arguments);

        // Handle common array methods specially
        // Handle string methods
        switch (method) {
          case 'charCodeAt': {
            // str.charCodeAt(i) -> (uint32_t)str[i]
            // Special case: if object is a single char (not char*), just cast it
            const indexVal = args[0] || CLiteral.UInt(0, '');
            const isZeroIndex = (indexVal.value === 0 || indexVal.value === '0' ||
                                  (indexVal.nodeType === 'Literal' && indexVal.value === 0));

            // Check if object is a single char variable (not a string/char*)
            if (node.callee.object.type === 'Identifier') {
              const varType = this.getVariableType(node.callee.object.name);
              // If it's a char type without pointer, and index is 0, just cast the char
              if (varType && varType.name === 'char' && !varType.isPointer && isZeroIndex)
                return new CCast(CType.UInt32(), object);
            }

            return new CCast(CType.UInt32(), new CArraySubscript(object, indexVal));
          }
          case 'charAt':
            // str.charAt(i) -> str[i]
            return new CArraySubscript(object, args[0] || CLiteral.UInt(0, ''));
          case 'slice':
            // arr.slice(start, end) -> (arr + start) with implicit length
            // For now, generate a memcpy call: memcpy(dest, arr + start, (end - start) * sizeof(*arr))
            if (args.length >= 2) {
              // Return pointer arithmetic: arr + start
              return new CBinaryExpression(object, '+', args[0]);
            }
            break;
          case 'push': {
            // arr.push(val) or arr.push(...data)
            // Extract array name, handling both simple identifiers and member access
            let arrayName;
            let lengthVarExpr;
            if (object instanceof CIdentifier) {
              arrayName = object.name;
              lengthVarExpr = new CIdentifier(`${arrayName}_length`);
            } else if (object instanceof CMemberAccess) {
              // e.g., self->input_buffer -> self->input_buffer_length
              arrayName = object.member;
              lengthVarExpr = new CMemberAccess(object.target, `${object.member}_length`, object.isPointer);
            } else {
              arrayName = 'arr';
              lengthVarExpr = new CIdentifier('arr_length');
            }

            // Check for spread element BEFORE transformation: arr.push(...data)
            // Need to use node.arguments (original) not args (transformed)
            if (node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement') {
              // arr.push(...data) -> memcpy(arr + arr_length, data, data_length); arr_length += data_length;
              const spreadArg = node.arguments[0].argument;
              const dataExpr = this.transformExpression(spreadArg);
              const dataName = spreadArg?.name || dataExpr?.name || 'data';
              // Convert to snake_case for consistency with C naming
              const dataLengthVar = this.toSnakeCase(dataName) + '_length';

              // Generate: memcpy(arr + arr_length, data, data_length * sizeof(*arr))
              const destPtr = new CBinaryExpression(object, '+', lengthVarExpr);
              const copySize = new CBinaryExpression(
                new CIdentifier(dataLengthVar),
                '*',
                new CSizeof(new CUnaryExpression('*', object), false)
              );
              const memcpyCall = new CCall(new CIdentifier('memcpy'), [destPtr, dataExpr, copySize]);

              // Generate: arr_length += data_length
              const lengthIncr = new CAssignment(
                lengthVarExpr,
                '+=',
                new CIdentifier(dataLengthVar)
              );

              // Return comma expression for both operations
              return new CComma([memcpyCall, lengthIncr]);
            }

            // Single element push: arr.push(val) -> ARRAY_PUSH(arr, arr_length, val)
            const value = args[0];
            if (value) {
              return new CCall(new CIdentifier('ARRAY_PUSH'), [
                object,
                lengthVarExpr,
                value
              ]);
            }
            // If no argument provided, return empty statement
            return new CComment(`push with no argument`);
          }
          case 'length':
            // arr.length - In C, arrays don't have length property
            // Return the associated length variable if it exists
            return new CIdentifier(`${object.name || 'arr'}_length`);
          case 'fill':
            // arr.fill(value) -> memset(arr, value, sizeof(arr))
            return new CCall(new CIdentifier('memset'), [object, args[0] || CLiteral.UInt(0, ''), new CSizeof(object, false)]);

          // Array iteration methods - inline as loops
          case 'some':
          case 'every':
          case 'find':
          case 'findIndex': {
            // arr.some(callback) -> inline loop with early exit
            // Transform the callback body to use the loop variable
            const callback = node.arguments[0];
            if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression')) {
              const loopBody = this.transformArrayIterationCallback(object, callback, method);
              if (loopBody)
                return loopBody;
            }
            // Fallback: generate a call that will need manual implementation
            return new CCall(new CIdentifier(`array_${method}`), [object, ...args]);
          }

          case 'forEach': {
            const callback = node.arguments[0];
            if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression')) {
              const loopBody = this.transformArrayIterationCallback(object, callback, 'forEach');
              if (loopBody)
                return loopBody;
            }
            return new CCall(new CIdentifier('array_foreach'), [object, ...args]);
          }

          case 'map':
          case 'filter': {
            // These create new arrays - more complex to inline
            const callback = node.arguments[0];
            if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression')) {
              const loopBody = this.transformArrayIterationCallback(object, callback, method);
              if (loopBody)
                return loopBody;
            }
            return new CCall(new CIdentifier(`array_${method}`), [object, ...args]);
          }

          case 'indexOf': {
            const searchValue = args[0];
            // Check if this is a string operation (object is a string constant or member access to string field)
            const objectType = this._getExpressionType(node.callee.object);
            if (objectType === 'string' || objectType === 'char*' ||
                (node.callee.object.type === 'MemberExpression' &&
                 node.callee.object.property.name &&
                 (node.callee.object.property.name.includes('CASE') ||
                  node.callee.object.property.name.includes('ALPHABET')))) {
              // String indexOf - use string_index_of(str, char)
              return new CCall(new CIdentifier('string_index_of'), [object, searchValue]);
            }
            // Array indexOf - use array_index_of(arr, len, val)
            const lengthExpr = object.name ? new CIdentifier(`${object.name}_length`) :
                              (object.nodeType === 'MemberAccess' ?
                                new CMemberAccess(object.target, `${object.member}_length`, object.isPointer) :
                                CLiteral.UInt(0, ''));
            return new CCall(new CIdentifier('array_index_of'), [object, lengthExpr, searchValue]);
          }
          case 'includes': {
            const searchValue = args[0];
            // Array includes - use array_includes(arr, len, val)
            const lengthExpr = object.name ? new CIdentifier(`${object.name}_length`) :
                              (object.nodeType === 'MemberAccess' ?
                                new CMemberAccess(object.target, `${object.member}_length`, object.isPointer) :
                                CLiteral.UInt(0, ''));
            return new CCall(new CIdentifier('array_includes'), [object, lengthExpr, searchValue]);
          }

          case 'split': {
            // str.split(delimiter) -> string_split(str, delimiter, &result_length)
            // This returns a char** array and sets result_length
            const delimiter = args[0] || CLiteral.Char(',');
            return new CCall(new CIdentifier('string_split'), [object, delimiter]);
          }

          case 'trim': {
            // str.trim() -> string_trim(str)
            return new CCall(new CIdentifier('string_trim'), [object]);
          }

          case 'toUpperCase':
          case 'to_upper_case': {
            // Check if the object is a single char (e.g., String.fromCharCode(x) returns CCast to char)
            // or an array subscript on a char array which would return a single char
            // CCast nodes have nodeType='Cast' and type is the CType they cast to
            const isCharType = (object.nodeType === 'Cast' && object.type?.name === 'char') ||
                               (object.nodeType === 'Subscript'); // array[i] on char array returns char
            if (isCharType) {
              // char.toUpperCase() -> (char)toupper(char) - use C stdlib toupper
              return new CCast(CType.Char(), new CCall(new CIdentifier('toupper'), [object]));
            }
            // str.toUpperCase() -> to_upper_case(str)
            return new CCall(new CIdentifier('to_upper_case'), [object]);
          }

          case 'toLowerCase':
          case 'to_lower_case': {
            // Check if the object is a single char
            const isCharType = (object.nodeType === 'Cast' && object.type?.name === 'char') ||
                               (object.nodeType === 'Subscript');
            if (isCharType) {
              // char.toLowerCase() -> (char)tolower(char) - use C stdlib tolower
              return new CCast(CType.Char(), new CCall(new CIdentifier('tolower'), [object]));
            }
            // str.toLowerCase() -> to_lower_case(str)
            return new CCall(new CIdentifier('to_lower_case'), [object]);
          }

          case 'replace':
          case 'replaceAll': {
            // str.replace(pattern, replacement) -> string_replace(str, pattern, replacement)
            // Handle RegExp patterns specially
            const patternArg = args[0];
            const replacementArg = args[1] || CLiteral.String('');

            // Check if the original pattern was a regex
            const origPattern = node.arguments[0];
            if (origPattern && origPattern.regex) {
              // RegExp literal like /[^A-Z]/g - convert to special filter function
              const regexPattern = origPattern.regex.pattern;
              const regexFlags = origPattern.regex.flags || '';

              // Special case: /[^A-Z]/g -> filter_alpha (keep only A-Z)
              if (regexPattern === '[^A-Z]' || regexPattern === '[^a-zA-Z]') {
                return new CCall(new CIdentifier('filter_alpha'), [object]);
              }
              // Special case: /[^A-Za-z]/g -> filter_alpha
              if (regexPattern === '[^A-Za-z]') {
                return new CCall(new CIdentifier('filter_alpha'), [object]);
              }
              // Special case: /[^0-9]/g -> filter_digits
              if (regexPattern === '[^0-9]' || regexPattern === '[^\\d]' || regexPattern === '\\D') {
                return new CCall(new CIdentifier('filter_digits'), [object]);
              }
              // Special case: /\\s+/g -> normalize_whitespace or just trim
              if (regexPattern === '\\s+' || regexPattern === '\\s*') {
                return new CCall(new CIdentifier('remove_whitespace'), [object]);
              }
              // Default: use regex replace with pattern string
              return new CCall(new CIdentifier('regex_replace'), [object, CLiteral.String(regexPattern), replacementArg]);
            }

            // Regular string replace
            return new CCall(new CIdentifier('string_replace'), [object, patternArg, replacementArg]);
          }

          case 'apply': {
            // func.apply(null, args) or Obj.func.apply(null, args)
            // Common pattern: String.fromCharCode.apply(null, bytes) -> bytes_to_string(bytes, len)
            // Check if this is String.fromCharCode.apply
            const calleeObj = node.callee.object;
            if (calleeObj && calleeObj.type === 'MemberExpression' &&
                calleeObj.object?.type === 'Identifier' && calleeObj.object.name === 'String' &&
                (calleeObj.property?.name === 'fromCharCode' || calleeObj.property?.value === 'fromCharCode')) {
              // String.fromCharCode.apply(null, bytes) -> bytes_to_string(bytes, bytes_length)
              // The second argument to apply is the byte array
              const bytesArg = node.arguments[1];
              if (bytesArg) {
                const bytesExpr = this.transformExpression(bytesArg);
                const lengthVar = this.buildArrayLengthVar(bytesExpr);
                return new CCall(new CIdentifier('bytes_to_ansi'), [bytesExpr, lengthVar]);
              }
            }
            // Generic apply - transform to direct call with spread
            // func.apply(context, args) where args is an array
            const funcExpr = this.transformExpression(calleeObj);
            return new CCall(funcExpr, args);
          }
        }

        const methodName = this.toSnakeCase(method);

        // If calling a method on self/this, prefix with the current struct name
        const objectName = node.callee.object.type === 'ThisExpression' ? 'self' :
                          (node.callee.object.type === 'Identifier' ? node.callee.object.name : null);

        if (objectName === 'self' || objectName === 'this') {
          // Get current struct name for prefixing
          const structName = this.currentStruct ? this.toSnakeCase(this.currentStruct.name) : '';
          const prefixedMethodName = structName ? `${structName}_${methodName}` : methodName;
          return new CCall(new CIdentifier(prefixedMethodName), [object, ...args]);
        }

        // For non-self objects, try to infer the type and prefix the method name
        // Example: des_algorithm.CreateInstance() -> des_instance_create_instance(des_algorithm)
        let typePrefix = null;

        // Check if object is a local variable with known type
        if (node.callee.object.type === 'Identifier') {
          const varType = this.getVariableType(node.callee.object.name);
          if (varType && varType.name && !['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'char', 'bool', 'size_t', 'void'].includes(varType.name)) {
            // It's a struct type - extract base name without pointer suffix
            let typeName = varType.name.replace(/\*/g, '').trim();
            typePrefix = this.toSnakeCase(typeName);
          }
        }
        // Check if object is a member access like self.des_algorithm
        // Handle both JS AST 'MemberExpression' and IL AST 'ThisPropertyAccess' types
        else if (node.callee.object.type === 'MemberExpression' || node.callee.object.type === 'ThisPropertyAccess') {
          // For ThisPropertyAccess, property is a string directly; for MemberExpression, property is an object with name/value
          const fieldName = typeof node.callee.object.property === 'string'
            ? node.callee.object.property
            : (node.callee.object.property?.name || node.callee.object.property?.value || node.callee.object.propertyName);
          if (fieldName) {
            let snakeFieldName = this.toSnakeCase(fieldName);
            if (snakeFieldName.startsWith('_'))
              snakeFieldName = snakeFieldName.substring(1);

            // FIRST: Check currentStruct.fields for class-scoped field type lookup
            // This ensures we get the correct type when multiple classes have same field name
            let fieldType = null;
            if (this.currentStruct && this.currentStruct.fields) {
              for (const field of this.currentStruct.fields) {
                if (field.name === snakeFieldName || field.name === fieldName || field.name === '_' + snakeFieldName) {
                  fieldType = field.type;
                  break;
                }
              }
            }

            // FALLBACK: Use global structFieldTypes map if not found in currentStruct
            if (!fieldType) {
              fieldType = this.structFieldTypes.get(fieldName) ||
                          this.structFieldTypes.get(snakeFieldName) ||
                          this.structFieldTypes.get('_' + snakeFieldName);
            }

            if (fieldType && fieldType.name) {
              let typeName = fieldType.name.replace(/\*/g, '').trim();
              typePrefix = this.toSnakeCase(typeName);
            }
          }
        }

        // Use type prefix if found, otherwise fallback to bare method name
        const prefixedMethodName = typePrefix ? `${typePrefix}_${methodName}` : methodName;
        return new CCall(new CIdentifier(prefixedMethodName), [object, ...args]);
      }

      // Handle special framework function calls
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg)).filter(a => a);

        switch (funcName) {
          case 'ansi_to_bytes':
          case 'AnsiToBytes':
            // Convert string literal to uint8_t* cast
            return new CCast(CType.Pointer(CType.UInt8()), args[0]);
          case 'test_case_new':
          case 'TestCase':
            // Test cases are not needed in C - return a placeholder/comment
            return CLiteral.Null();
          case 'is_array':
          case 'IsArray':
          case 'Array.isArray':
            // In C, we know types at compile time - arrays are always arrays
            return CLiteral.Bool(true);
          case 'hex_to_bytes':
          case 'HexToBytes':
          case 'Hex8ToBytes':
            return new CCall(new CIdentifier('hex_to_bytes'), args);
          case 'bytes_to_hex':
          case 'BytesToHex':
          case 'BytesToHex8':
            return new CCall(new CIdentifier('bytes_to_hex'), args);
          case 'parseInt':
          case 'parse_int':
            // parseInt(str, radix) -> strtol(str, NULL, radix)
            return new CCall(new CIdentifier('strtol'), [
              args[0] || CLiteral.String('0'),
              CLiteral.Null(),
              args[1] || CLiteral.UInt(10, 'U')
            ]);
          case 'parseFloat':
          case 'parse_float':
            // parseFloat(str) -> strtod(str, NULL)
            return new CCall(new CIdentifier('strtod'), [
              args[0] || CLiteral.String('0'),
              CLiteral.Null()
            ]);
          case 'isNaN':
          case 'is_nan':
            // isNaN(x) -> isnan(x)
            return new CCall(new CIdentifier('isnan'), args);
          case 'isFinite':
          case 'is_finite':
            // isFinite(x) -> isfinite(x)
            return new CCall(new CIdentifier('isfinite'), args);
        }
      }

      // Regular function call - don't expand args with _length because
      // these are calls to local helper functions that don't have _length params.
      // Only instance method calls (ThisMethodCall, ParentMethodCall) have _length params.
      let callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Macro names that conflict with potential function names
      // These are defined in CEmitter.emitCryptoHelpers as 2-argument macros
      // If a local function has the same name (but different arity), rename it to avoid collision
      const macroNames = new Set([
        'to_byte', 'to_uint16', 'to_uint32', 'to_uint64',
        'xor_n', 'or_n', 'and_n', 'not_n',
        'shl32', 'shr32', 'shl64', 'shr64',
        'rotl32', 'rotr32', 'rotl64', 'rotr64',
        'rotl8', 'rotr8', 'rotl16', 'rotr16',
        'get_bit', 'set_bit', 'set_bit_value', 'clear_bit', 'get_byte'
      ]);

      // If calling a function whose name matches a macro, rename it to _fn suffix
      if (node.callee.type === 'Identifier') {
        const funcName = this.toSnakeCase(node.callee.name);
        if (macroNames.has(funcName))
          callee = new CIdentifier(funcName + '_fn');
      }

      return new CCall(callee, args);
    }

    /**
     * Helper to expand arguments with _length for array-typed identifiers and struct field accesses
     */
    _expandArgsWithLengths(jsArgs) {
      const expanded = [];
      for (const arg of jsArgs) {
        const transformed = this.transformExpression(arg);
        expanded.push(transformed);

        // If argument is an Identifier that has a corresponding _length variable in scope,
        // add the length argument automatically for array parameters
        if (arg.type === 'Identifier') {
          const argName = arg.name;
          const snakeName = this.toSnakeCase(argName);
          const argType = this.getVariableType(argName) || this.getVariableType(snakeName);

          // Check for length variable under both naming conventions
          const cArgName = this.toSafeCName(argName);
          const lengthVarCamel = `${argName}_length`;
          const lengthVarSnake = `${snakeName}_length`;
          const lengthVarCSafe = `${cArgName}_length`;
          const lengthType = this.getVariableType(lengthVarCamel) ||
                             this.getVariableType(lengthVarSnake) ||
                             this.getVariableType(lengthVarCSafe);

          // If this is a pointer/array type, add a length argument
          if (argType && (argType.isPointer || argType.isArray)) {
            if (lengthType) {
              // Always output the C name (what's actually declared)
              // This handles: KL -> KL_length, keyData -> key_data_length
              expanded.push(new CIdentifier(lengthVarCSafe));
            } else {
              // No length variable in scope - use 0 as default
              // This happens for pointers initialized from array subscripts (e.g., CONST_ARRAY[0])
              expanded.push(new CLiteral(0));
            }
          }
        }
        // Handle MemberExpression - struct field accesses like self.subKeys.k1 or computed subscripts like arr[i]
        else if (arg.type === 'MemberExpression') {
          // Check if this is a computed subscript (array access)
          if (arg.computed) {
            // Computed subscript like self.roundKeys[0] or arr[i]
            // The result of a subscript on an array of pointers is a pointer that needs a length
            const argType = this.inferTypeFromValue(arg);
            if (argType && (argType.isPointer || argType.pointerLevel > 0)) {
              // For computed subscripts, we don't have a companion length variable
              // Just add 0 as a placeholder
              expanded.push(new CLiteral(0));
            }
          } else {
            // Non-computed field access like self.subKeys.k1
            const fieldName = arg.property?.name || arg.property?.value;
            if (fieldName) {
              // Try to infer if this is a pointer type
              const argType = this.inferTypeFromValue(arg);
              if (argType && (argType.isPointer || argType.pointerLevel > 0)) {
                // Generate companion length access: self->sub_keys->k1_length
                const snakeFieldName = this.toSnakeCase(fieldName);
                const lengthFieldName = `${snakeFieldName}_length`;
                // Clone the transformed expression and append _length to the final property
                if (transformed && transformed.nodeType === 'MemberAccess') {
                  // Create a new member access for the length field
                  // Note: CMemberAccess uses 'target' not 'object'
                  const lengthAccess = new CMemberAccess(transformed.target, lengthFieldName, transformed.isPointer);
                  expanded.push(lengthAccess);
                } else if (transformed && transformed.nodeType === 'ArraySubscript') {
                  // Array subscript was produced from a non-computed MemberExpression
                  // This happens when array field is accessed: self.arr becomes self->arr
                  // Add 0 as placeholder since we can't easily get the length
                  expanded.push(new CLiteral(0));
                }
              }
            }
          }
        }
        // Handle ThisPropertyAccess - direct struct field access like this._key
        else if (arg.type === 'ThisPropertyAccess') {
          const propName = typeof arg.property === 'string'
            ? arg.property
            : (arg.property?.name || arg.property?.value);
          if (propName) {
            // Try to infer if this is a pointer type
            const argType = this.inferTypeFromValue(arg);
            if (argType && (argType.isPointer || argType.pointerLevel > 0)) {
              // Generate companion length access: self->key_length
              let snakeProp = this.toSnakeCase(propName);
              // Strip leading underscore for field naming
              if (snakeProp.startsWith('_'))
                snakeProp = snakeProp.substring(1);
              const lengthFieldName = `${snakeProp}_length`;
              // Use arrow operator since self is a pointer
              const lengthAccess = new CMemberAccess(new CIdentifier('self'), lengthFieldName, true);
              expanded.push(lengthAccess);
            }
          }
        }
        // Handle CallExpression, ThisMethodCall, ParentMethodCall - function call results that might be pointer types
        // e.g., rotate_right(arr) returns uint32_t* and needs a length when passed to another function
        else if (arg.type === 'CallExpression' || arg.type === 'ThisMethodCall' || arg.type === 'ParentMethodCall') {
          // Try to infer the return type of the function call
          const callReturnType = this.inferTypeFromValue(arg);
          if (callReturnType && (callReturnType.isPointer || callReturnType.pointerLevel > 0)) {
            // Function call returns a pointer - add 0 as default length since we can't know the actual length
            expanded.push(new CLiteral(0));
          }
        }
        // Handle ArrayExpression with single spread element: [...this.buffer] -> self->buffer, self->buffer_length
        else if (arg.type === 'ArrayExpression' &&
                 arg.elements?.length === 1 &&
                 arg.elements[0]?.type === 'SpreadElement') {
          const spreadArg = arg.elements[0].argument;
          // Check if the spread argument is a ThisPropertyAccess
          if (spreadArg?.type === 'ThisPropertyAccess') {
            const propName = typeof spreadArg.property === 'string'
              ? spreadArg.property
              : (spreadArg.property?.name || spreadArg.property?.value);
            if (propName) {
              const argType = this.inferTypeFromValue(spreadArg);
              if (argType && (argType.isPointer || argType.pointerLevel > 0)) {
                let snakeProp = this.toSnakeCase(propName);
                if (snakeProp.startsWith('_'))
                  snakeProp = snakeProp.substring(1);
                const lengthFieldName = `${snakeProp}_length`;
                const lengthAccess = new CMemberAccess(new CIdentifier('self'), lengthFieldName, true);
                expanded.push(lengthAccess);
              }
            }
          }
          // Handle Identifier spread: [...buffer] -> buffer, buffer_length
          else if (spreadArg?.type === 'Identifier') {
            const argName = spreadArg.name;
            const snakeName = this.toSnakeCase(argName);
            const argType = this.getVariableType(argName) || this.getVariableType(snakeName);
            if (argType && (argType.isPointer || argType.isArray)) {
              const cArgName = this.toSafeCName(argName);
              expanded.push(new CIdentifier(`${cArgName}_length`));
            }
          }
        }
      }
      return expanded;
    }

    /**
     * Transform IL AST OpCodesCall nodes (for unknown/generic OpCodes methods)
     * These are created by type-aware-transpiler for OpCodes methods not in INLINE/ROTATION/COMPLEX_OPCODES
     */
    transformOpCodesCallIL(node) {
      const methodName = node.method;
      const args = (node.arguments || []).map(arg => this.transformExpression(arg)).filter(a => a);

      // Use the same mapping as transformOpCodesCall
      switch (methodName) {
        case 'PopCountFast':
        case 'PopCount':
        case 'PopCount32':
          return new CCall(new CIdentifier('popcount32'), args);
        case 'PopCount64':
          return new CCall(new CIdentifier('popcount64'), args);
        case 'LFSRStep':
          return new CCall(new CIdentifier('lfsr_step'), args);
        case 'GF2Multiply':
          return new CCall(new CIdentifier('gf2_multiply'), args);
        case 'GF256Multiply':
        case 'GFMultiply':
          return new CCall(new CIdentifier('gf256_multiply'), args);
        case 'GF256Inverse':
          return new CCall(new CIdentifier('gf256_inverse'), args);
        case 'GetBit':
          return new CCall(new CIdentifier('get_bit'), args);
        case 'SetBit':
          // SetBit(x, n, v) takes 3 args - use set_bit_value macro
          // SetBit(x, n) takes 2 args - use set_bit macro (always sets to 1)
          return new CCall(new CIdentifier(args.length === 3 ? 'set_bit_value' : 'set_bit'), args);
        case 'ClearBit':
          return new CCall(new CIdentifier('clear_bit'), args);
        case 'CopyArray': {
          // CopyArray(src) -> copy_array_ret(src, src_length) or copy_array32_ret for uint32_t arrays
          // Returns a newly allocated copy of the array
          if (args.length === 1) {
            const srcArg = args[0];
            // Get the length companion parameter name
            let lengthArg;
            if (srcArg instanceof CIdentifier) {
              lengthArg = new CIdentifier(srcArg.name + '_length');
            } else if (srcArg && srcArg.name) {
              lengthArg = new CIdentifier(srcArg.name + '_length');
            } else {
              // Fallback: use 0 (caller must know the size)
              lengthArg = CLiteral.UInt(0, '');
            }
            // Determine if source is uint32_t* to use type-specific helper
            let helperName = 'copy_array_ret';
            const srcName = srcArg instanceof CIdentifier ? srcArg.name : (srcArg?.name || '');
            const srcType = this.variableTypes.get(srcName);
            if (srcType) {
              const baseName = srcType.baseType?.name || srcType.name || '';
              if (baseName === 'uint32_t' || baseName === 'int32_t') {
                helperName = 'copy_array32_ret';
              } else if (baseName === 'uint64_t' || baseName === 'int64_t') {
                helperName = 'copy_array64_ret';
              } else if (baseName === 'uint16_t' || baseName === 'int16_t') {
                helperName = 'copy_array16_ret';
              }
            }
            return new CCall(new CIdentifier(helperName), [srcArg, lengthArg]);
          }
          return new CCall(new CIdentifier('copy_array'), args);
        }
        default:
          // Default: convert camelCase to snake_case
          return new CCall(new CIdentifier(this.toSnakeCase(methodName)), args);
      }
    }

    /**
     * Transform OpCodes method calls to C equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg)).filter(a => a);

      // Map OpCodes methods to C equivalents
      switch (methodName) {
        // Rotation operations (need inline functions or macros)
        case 'RotL32':
          return new CCall(new CIdentifier('rotl32'), args);
        case 'RotR32':
          return new CCall(new CIdentifier('rotr32'), args);
        case 'RotL64':
          return new CCall(new CIdentifier('rotl64'), args);
        case 'RotR64':
          return new CCall(new CIdentifier('rotr64'), args);
        case 'RotL8':
          return new CCall(new CIdentifier('rotl8'), args);
        case 'RotR8':
          return new CCall(new CIdentifier('rotr8'), args);
        case 'RotL16':
          return new CCall(new CIdentifier('rotl16'), args);
        case 'RotR16':
          return new CCall(new CIdentifier('rotr16'), args);

        // Byte packing
        case 'Pack16LE':
          return new CCall(new CIdentifier('pack16_le'), args);
        case 'Pack16BE':
          return new CCall(new CIdentifier('pack16_be'), args);
        case 'Pack32LE':
          return new CCall(new CIdentifier('pack32_le'), args);
        case 'Pack32BE':
          return new CCall(new CIdentifier('pack32_be'), args);
        case 'Pack64LE':
          return new CCall(new CIdentifier('pack64_le'), args);
        case 'Pack64BE':
          return new CCall(new CIdentifier('pack64_be'), args);

        // Byte unpacking - use _ret versions that return arrays (for value contexts)
        case 'Unpack16LE':
          return new CCall(new CIdentifier('unpack16_le_ret'), args);
        case 'Unpack16BE':
          return new CCall(new CIdentifier('unpack16_be_ret'), args);
        case 'Unpack32LE':
          return new CCall(new CIdentifier('unpack32_le_ret'), args);
        case 'Unpack32BE':
          return new CCall(new CIdentifier('unpack32_be_ret'), args);
        case 'Unpack64LE':
          return new CCall(new CIdentifier('unpack64_le_ret'), args);
        case 'Unpack64BE':
          return new CCall(new CIdentifier('unpack64_be_ret'), args);

        // Array operations
        case 'XorArrays':
          return new CCall(new CIdentifier('xor_arrays'), args);
        case 'ClearArray':
          return new CCall(new CIdentifier('memset'), [args[0], CLiteral.UInt(0, ''), new CSizeof(args[0], false)]);
        case 'CopyArray': {
          // CopyArray(src) -> copy_array_ret(src, src_length) or copy_array32_ret for uint32_t arrays
          // Returns a newly allocated copy of the array
          if (args.length === 1) {
            const srcArg = args[0];
            // Get the length companion parameter name
            let lengthArg;
            if (srcArg instanceof CIdentifier) {
              lengthArg = new CIdentifier(srcArg.name + '_length');
            } else if (srcArg && srcArg.name) {
              lengthArg = new CIdentifier(srcArg.name + '_length');
            } else {
              // Fallback: use 0 (caller must know the size)
              lengthArg = CLiteral.UInt(0, '');
            }
            // Determine if source is uint32_t* to use type-specific helper
            let helperName = 'copy_array_ret';
            const srcName = srcArg instanceof CIdentifier ? srcArg.name : (srcArg?.name || '');
            const srcType = this.variableTypes.get(srcName);
            if (srcType) {
              const baseName = srcType.baseType?.name || srcType.name || '';
              if (baseName === 'uint32_t' || baseName === 'int32_t') {
                helperName = 'copy_array32_ret';
              } else if (baseName === 'uint64_t' || baseName === 'int64_t') {
                helperName = 'copy_array64_ret';
              } else if (baseName === 'uint16_t' || baseName === 'int16_t') {
                helperName = 'copy_array16_ret';
              }
            }
            return new CCall(new CIdentifier(helperName), [srcArg, lengthArg]);
          }
          return new CCall(new CIdentifier('copy_array'), args);
        }
        case 'ArraysEqual':
          return new CCall(new CIdentifier('arrays_equal'), args);
        case 'ConcatArrays':
          return new CCall(new CIdentifier('concat_arrays'), args);
        case 'ArrayIncludes':
          return new CCall(new CIdentifier('array_includes'), args);
        case 'ArrayIndexOf':
          return new CCall(new CIdentifier('array_index_of'), args);

        // Conversion utilities
        case 'Hex8ToBytes':
          return new CCall(new CIdentifier('hex_to_bytes'), args);
        case 'BytesToHex8':
          return new CCall(new CIdentifier('bytes_to_hex'), args);
        case 'AnsiToBytes':
        case 'AsciiToBytes':
          return new CCall(new CIdentifier('ansi_to_bytes'), args);
        case 'BytesToAnsi':
          return new CCall(new CIdentifier('bytes_to_ansi'), args);
        case 'StringToBytes':
          return new CCall(new CIdentifier('ansi_to_bytes'), args);
        case 'BytesToString':
          return new CCall(new CIdentifier('bytes_to_ansi'), args);

        // Bitwise operations (32-bit)
        case 'And32':
          return new CCall(new CIdentifier('and_n'), [
            new CCast(new CType('uint32_t'), args[0]),
            new CCast(new CType('uint32_t'), args[1])
          ]);
        case 'Or32':
          return new CCall(new CIdentifier('or_n'), [
            new CCast(new CType('uint32_t'), args[0]),
            new CCast(new CType('uint32_t'), args[1])
          ]);
        case 'Xor32':
          return new CCall(new CIdentifier('xor_n'), [
            new CCast(new CType('uint32_t'), args[0]),
            new CCast(new CType('uint32_t'), args[1])
          ]);
        case 'Not32':
          return new CCast(new CType('uint32_t'), new CCall(new CIdentifier('not_n'), [
            new CCast(new CType('uint32_t'), args[0])
          ]));

        // Shift operations (32-bit)
        case 'Shl32':
          return new CCall(new CIdentifier('shl32'), args);
        case 'Shr32':
          return new CCall(new CIdentifier('shr32'), args);

        // Shift operations (64-bit)
        case 'Shl64':
          return new CCall(new CIdentifier('shl64'), args);
        case 'Shr64':
          return new CCall(new CIdentifier('shr64'), args);

        // Arithmetic operations (32-bit with overflow wrap)
        case 'Add32':
          return new CCast(new CType('uint32_t'), new CBinaryExpression(
            new CCast(new CType('uint32_t'), args[0]),
            '+',
            new CCast(new CType('uint32_t'), args[1])
          ));
        case 'Sub32':
          return new CCast(new CType('uint32_t'), new CBinaryExpression(
            new CCast(new CType('uint32_t'), args[0]),
            '-',
            new CCast(new CType('uint32_t'), args[1])
          ));
        case 'Mul32':
          return new CCast(new CType('uint32_t'), new CBinaryExpression(
            new CCast(new CType('uint32_t'), args[0]),
            '*',
            new CCast(new CType('uint32_t'), args[1])
          ));

        // Type conversion operations
        case 'ToUint32':
          return new CCast(new CType('uint32_t'), args[0]);
        case 'ToUint16':
          return new CCast(new CType('uint16_t'), args[0]);
        case 'ToUint8':
        case 'ToByte':
          return new CCast(new CType('uint8_t'), args[0]);
        case 'ToUint64':
          return new CCast(new CType('uint64_t'), args[0]);
        case 'ToInt32':
          return new CCast(new CType('int32_t'), args[0]);
        case 'ToInt16':
          return new CCast(new CType('int16_t'), args[0]);
        case 'ToInt8':
          return new CCast(new CType('int8_t'), args[0]);
        case 'ToInt64':
          return new CCast(new CType('int64_t'), args[0]);

        // Bit manipulation operations
        case 'GetBit':
          return new CCall(new CIdentifier('get_bit'), args);
        case 'SetBit':
          // SetBit(x, n, v) takes 3 args - use set_bit_value macro
          // SetBit(x, n) takes 2 args - use set_bit macro (always sets to 1)
          return new CCall(new CIdentifier(args.length === 3 ? 'set_bit_value' : 'set_bit'), args);
        case 'ClearBit':
          return new CCall(new CIdentifier('clear_bit'), args);
        case 'PopCount':
        case 'PopCount32':
          return new CCall(new CIdentifier('popcount32'), args);
        case 'PopCount64':
          return new CCall(new CIdentifier('popcount64'), args);

        // N-suffix operations for BigInt (arbitrary precision) - map to 64-bit operations in C
        case 'ShiftRn':
          // Right shift: value >> positions
          return new CBinaryExpression(
            new CCast(new CType('uint64_t'), args[0]),
            '>>',
            new CCast(new CType('uint32_t'), args[1])
          );
        case 'ShiftLn':
          // Left shift: value << positions
          return new CBinaryExpression(
            new CCast(new CType('uint64_t'), args[0]),
            '<<',
            new CCast(new CType('uint32_t'), args[1])
          );
        case 'AndN':
          // Bitwise AND
          return new CBinaryExpression(
            new CCast(new CType('uint64_t'), args[0]),
            '&',
            new CCast(new CType('uint64_t'), args[1])
          );
        case 'OrN':
          // Bitwise OR
          return new CBinaryExpression(
            new CCast(new CType('uint64_t'), args[0]),
            '|',
            new CCast(new CType('uint64_t'), args[1])
          );
        case 'XorN':
          // Bitwise XOR
          return new CBinaryExpression(
            new CCast(new CType('uint64_t'), args[0]),
            '^',
            new CCast(new CType('uint64_t'), args[1])
          );
        case 'NotN':
          // Bitwise NOT
          return new CUnaryExpression('~', new CCast(new CType('uint64_t'), args[0]));

        // Secure random for cryptographic operations
        case 'SecureRandomBytes':
          return new CCall(new CIdentifier('secure_random_bytes'), args);
        case 'SecureRandomInt':
        case 'SecureRandom':
          // Return random int in range [0, max)
          return new CCall(new CIdentifier('secure_random_int'), args);

        default:
          return new CCall(new CIdentifier(this.toSnakeCase(methodName)), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      // Handle empty arrays - return NULL in C
      if (!node.elements || node.elements.length === 0) {
        return CLiteral.Null();
      }

      // Handle single spread element [...arr] - just return the array directly
      if (node.elements.length === 1 && node.elements[0] && node.elements[0].type === 'SpreadElement') {
        return this.transformExpression(node.elements[0].argument);
      }

      // Handle multiple spread elements - use returning variant for C
      if (node.elements.some(e => e && e.type === 'SpreadElement')) {
        // Count spread elements to select correct concat function
        const spreadCount = node.elements.filter(e => e && e.type === 'SpreadElement').length;

        // For multiple spreads, emit as concat_arrays_ret(a, a_len, b, b_len, ...) which returns a pointer
        const args = [];
        for (const e of node.elements) {
          if (e && e.type === 'SpreadElement') {
            const arr = this.transformExpression(e.argument);
            args.push(arr);
            args.push(this.buildArrayLengthVar(arr));
          } else {
            const elem = e ? this.transformExpression(e) : CLiteral.UInt(0, '');
            args.push(elem);
            args.push(CLiteral.UInt(1, 'U'));  // Single element has length 1
          }
        }

        // Select appropriate concat function based on element count
        let funcName = 'concat_arrays_ret';
        if (spreadCount === 3)
          funcName = 'concat_arrays3_ret';
        else if (spreadCount === 4)
          funcName = 'concat_arrays4_ret';
        else if (spreadCount > 4)
          funcName = `concat_arrays${spreadCount}_ret`;  // May need to add more helpers

        return new CCall(new CIdentifier(funcName), args);
      }

      const elements = node.elements.map(elem => elem ? this.transformExpression(elem) : CLiteral.UInt(0, ''));
      return new CArrayInitializer(elements);
    }

    /**
     * Transform an object expression (to struct initializer)
     */
    transformObjectExpression(node) {
      const fields = [];
      for (const prop of node.properties) {
        if (!prop.key) continue;

        let key = prop.key.name || String(prop.key.value) || 'unknown';

        // Strip surrounding quotes if present (from string literal keys like '16' or "16")
        if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"')))
          key = key.slice(1, -1);

        // Skip framework-specific properties
        if (this.shouldSkipProperty(key)) continue;

        // Sanitize key to be a valid C identifier
        key = this.sanitizeCIdentifier(key);

        const value = this.transformExpression(prop.value);
        const fieldName = this.toSnakeCase(key);
        fields.push({ name: fieldName, value });

        // Add companion _length field for pointer-type values
        const valueType = this.inferTypeFromValue(prop.value);
        if (valueType && (valueType.isPointer || valueType.pointerLevel > 0)) {
          // Try to determine the length from the value expression
          let lengthValue = null;
          if (prop.value?.type === 'ArraySlice') {
            // For slice(start, end), length = end - start
            const start = prop.value.start ? this.transformExpression(prop.value.start) : CLiteral.UInt(0, 'U');
            if (prop.value.end) {
              const end = this.transformExpression(prop.value.end);
              lengthValue = new CBinaryExpression(end, '-', start);
            }
          } else if (prop.value?.type === 'CallExpression' &&
                     (prop.value.callee?.property?.name === 'slice' ||
                      prop.value.callee?.property?.value === 'slice')) {
            // For arr.slice(start, end), length = end - start
            const args = prop.value.arguments || [];
            const start = args[0] ? this.transformExpression(args[0]) : CLiteral.UInt(0, 'U');
            if (args.length >= 2) {
              const end = this.transformExpression(args[1]);
              lengthValue = new CBinaryExpression(end, '-', start);
            }
          } else if (prop.value?.type === 'Identifier') {
            // For identifier, use the companion _length variable
            const sourceName = this.toSnakeCase(prop.value.name);
            lengthValue = new CIdentifier(`${sourceName}_length`);
          }
          if (lengthValue) {
            fields.push({ name: `${fieldName}_length`, value: lengthValue });
          }
        }
      }
      return new CStructInitializer(fields);
    }

    /**
     * Sanitize a string to be a valid C identifier
     * - Prefix with underscore if starts with digit
     * - Replace invalid characters with underscores
     */
    sanitizeCIdentifier(name) {
      if (!name || name.length === 0) return '_unknown';

      // If starts with a digit, prefix with 'v_' (for variant/value)
      if (/^\d/.test(name))
        name = 'v_' + name;

      // Replace any non-alphanumeric (except underscore) with underscore
      name = name.replace(/[^a-zA-Z0-9_]/g, '_');

      // Ensure it doesn't start with underscore followed by uppercase (reserved in C)
      if (/^_[A-Z]/.test(name))
        name = 'c' + name;

      return name;
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;

        // Map TypedArrays to C arrays with malloc
        const typedArrayMap = {
          'Uint8Array': 'uint8_t',
          'Uint16Array': 'uint16_t',
          'Uint32Array': 'uint32_t',
          'Int8Array': 'int8_t',
          'Int16Array': 'int16_t',
          'Int32Array': 'int32_t'
        };

        if (typedArrayMap[typeName]) {
          const arg = node.arguments[0];
          let size = arg ? this.transformExpression(arg) : CLiteral.UInt(0, '');

          // If the argument is an identifier that's a pointer type, use its _length companion
          // e.g., new Uint8Array(data) where data is uint8_t* should use data_length
          if (arg?.type === 'Identifier') {
            const argType = this.getVariableType(arg.name);
            if (argType && (argType.isPointer || argType.pointerLevel > 0 || argType.isArray)) {
              const lengthVarName = this.toSafeCName(arg.name) + '_length';
              size = new CIdentifier(lengthVarName);
            }
          }

          // Generate malloc call: (type*)malloc(size * sizeof(type))
          const sizeofExpr = new CSizeof(new CType(typedArrayMap[typeName]), true);
          const totalSize = new CBinaryExpression(size, '*', sizeofExpr);
          const mallocCall = new CCall(new CIdentifier('malloc'), [totalSize]);
          return new CCast(CType.Pointer(new CType(typedArrayMap[typeName])), mallocCall);
        }

        // Handle Array constructor
        if (typeName === 'Array') {
          const arg = node.arguments[0];
          let size = arg ? this.transformExpression(arg) : CLiteral.UInt(0, '');

          // If the argument is an identifier that's a pointer type, use its _length companion
          if (arg?.type === 'Identifier') {
            const argType = this.getVariableType(arg.name);
            if (argType && (argType.isPointer || argType.pointerLevel > 0 || argType.isArray)) {
              const lengthVarName = this.toSafeCName(arg.name) + '_length';
              size = new CIdentifier(lengthVarName);
            }
          }

          const sizeofExpr = new CSizeof(CType.UInt8(), true);
          const totalSize = new CBinaryExpression(size, '*', sizeofExpr);
          const mallocCall = new CCall(new CIdentifier('malloc'), [totalSize]);
          return new CCast(CType.Pointer(CType.UInt8()), mallocCall);
        }

        // Struct constructor - convert to function call
        // Use _expandArgsWithLengths to include companion _length arguments for arrays
        const funcName = this.toSnakeCase(typeName + '_new');

        // Check if the class has constructor defaults and we're passing fewer args
        const classDefaults = this.constructorDefaults.get(typeName);
        let allArgs = [...node.arguments];
        if (classDefaults && allArgs.length < classDefaults.length) {
          // Pad with default values for missing parameters
          for (let i = allArgs.length; i < classDefaults.length; ++i) {
            const paramDef = classDefaults[i];
            if (paramDef.defaultValue) {
              allArgs.push(paramDef.defaultValue);
            }
          }
        }

        const args = this._expandArgsWithLengths(allArgs);
        return new CCall(new CIdentifier(funcName), args);
      }

      return null;
    }

    /**
     * Transform a conditional expression
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      let thenExpr = this.transformExpression(node.consequent);
      let elseExpr = this.transformExpression(node.alternate);

      // Wrap array initializers in compound literals for use in ternary expressions
      // C requires compound literals for array values in expressions: (type[]){...}
      if (thenExpr instanceof CArrayInitializer) {
        const elemType = this.inferTypeFromValue(node.consequent)?.baseType || CType.UInt8();
        const arrayType = CType.Array(elemType, thenExpr.elements?.length || 0);
        thenExpr = new CCompoundLiteral(arrayType, thenExpr);
      }
      if (elseExpr instanceof CArrayInitializer) {
        const elemType = this.inferTypeFromValue(node.alternate)?.baseType || CType.UInt8();
        const arrayType = CType.Array(elemType, elseExpr.elements?.length || 0);
        elseExpr = new CCompoundLiteral(arrayType, elseExpr);
      }

      return new CConditional(condition, thenExpr, elseExpr);
    }

    /**
     * Transform array iteration methods (some, every, find, forEach, map, filter) to inline loops
     * Returns a C expression that represents the loop result or null if cannot inline
     *
     * NOTE: Full inlining of callbacks with variable references requires statement-level
     * transformation. For now, we generate a stub with a TODO comment and default value.
     */
    transformArrayIterationCallback(arrayNode, callback, method) {
      // Get the callback parameter name (the element variable)
      const params = callback.params || [];
      if (params.length === 0) return null;

      const elementParam = params[0].name;

      // Get array name for the length variable
      let arrayName = 'arr';
      if (arrayNode.name)
        arrayName = arrayNode.name;
      else if (arrayNode.nodeType === 'MemberAccess' && arrayNode.member)
        arrayName = arrayNode.member;

      // Since we can't properly inline callbacks with element variable references
      // at the expression level (would need statement-level transformation),
      // generate a comment explaining the intent and a sensible default

      switch (method) {
        case 'some':
          // For validation checks like .some(ks => ...), default to true to allow
          // the code path to continue (safer for testing)
          return new CIdentifier(`true /* TODO: ${method}(${elementParam} => ...) needs manual implementation */`);

        case 'every':
          return new CIdentifier(`true /* TODO: ${method}(${elementParam} => ...) needs manual implementation */`);

        case 'find':
          return new CIdentifier(`NULL /* TODO: ${method}(${elementParam} => ...) needs manual implementation */`);

        case 'findIndex':
          return new CIdentifier(`-1 /* TODO: ${method}(${elementParam} => ...) needs manual implementation */`);

        case 'forEach':
          // forEach doesn't return a value, just emit a comment
          return new CIdentifier(`/* TODO: forEach(${elementParam} => ...) needs manual implementation */ 0`);

        case 'map':
        case 'filter':
          return new CIdentifier(`NULL /* TODO: ${method}(${elementParam} => ...) needs manual implementation */`);

        default:
          return null;
      }
    }

    /**
     * Transform a function expression (function pointers in C)
     * For simple arrow functions used in callbacks, we try to inline them
     */
    transformFunctionExpression(node) {
      // For arrow functions with simple expression bodies, try to inline
      if (node.body && node.body.type !== 'BlockStatement') {
        // Simple expression body - can potentially be inlined
        const body = this.transformExpression(node.body);
        // Return as a wrapper that indicates this is a lambda expression
        return new CIdentifier(`/* lambda: ${body.name || 'expr'} */`);
      }

      // C doesn't directly support inline functions - return identifier to function
      return new CIdentifier('/* function expression */');
    }

    /**
     * Transform a sequence expression
     */
    transformSequenceExpression(node) {
      const expressions = node.expressions.map(expr => this.transformExpression(expr)).filter(e => e);
      return new CComma(expressions);
    }

    /**
     * Transform a spread element
     */
    transformSpreadElement(node) {
      // Spread not directly supported in C - just return the argument
      return this.transformExpression(node.argument);
    }

    /**
     * Transform a template literal
     */
    transformTemplateLiteral(node) {
      // Convert to sprintf or simple string - simplified for now
      let result = '';
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          result += '%s'; // Placeholder
        }
      }
      return CLiteral.String(result);
    }

    // ===== IL AST Node Transformers =====

    /**
     * Transform ParentConstructorCall to C struct initialization
     * In C, there's no direct parent constructor - we initialize base struct fields
     */
    transformParentConstructorCall(node) {
      // C doesn't have class inheritance like JS
      // For struct "inheritance", we initialize base fields or call base_init function
      const parentClass = node.parentClass || 'base';
      const funcName = this.toSnakeCase(parentClass) + '_init';
      const args = [new CIdentifier('self')];
      // Use _expandArgsWithLengths to include companion _length arguments for arrays
      if (node.arguments) {
        args.push(...this._expandArgsWithLengths(node.arguments));
      }
      return new CCall(new CIdentifier(funcName), args);
    }

    /**
     * Transform ParentMethodCall to C function call
     */
    transformParentMethodCall(node) {
      const parentClass = node.parentClass || 'Base';
      const methodName = node.method || 'method';
      // Use same naming pattern as method definition (line 1700)
      const funcName = this.toSnakeCase(parentClass + '_' + methodName);
      const args = [new CIdentifier('self')];
      // Use _expandArgsWithLengths to include companion _length arguments for arrays
      if (node.arguments) {
        args.push(...this._expandArgsWithLengths(node.arguments));
      }
      return new CCall(new CIdentifier(funcName), args);
    }

    /**
     * Transform ThisMethodCall to self->method(...) style call
     */
    transformThisMethodCall(node) {
      const methodName = node.method || 'method';
      // In C, we typically call struct_method(self, args...)
      // Use current struct name if available
      // IMPORTANT: Use same naming pattern as method definition (line 1700):
      // toSnakeCase(structName + '_' + methodName) to handle leading underscores consistently
      const className = this.currentStruct ? this.currentStruct.name : 'Self';
      const funcName = this.toSnakeCase(className + '_' + methodName);
      const args = [new CIdentifier('self')];
      // Use _expandArgsWithLengths to include companion _length arguments for arrays
      if (node.arguments) {
        args.push(...this._expandArgsWithLengths(node.arguments));
      }
      return new CCall(new CIdentifier(funcName), args);
    }

    /**
     * Transform ThisPropertyAccess to self->property
     */
    transformThisPropertyAccess(node) {
      let propName = this.toSnakeCase(node.property || 'property');
      // Strip leading underscore to match struct field naming (private fields like _key become key)
      if (propName.startsWith('_'))
        propName = propName.substring(1);
      return new CMemberAccess(new CIdentifier('self'), propName, true);
    }

    /**
     * Transform rotation operations
     * C doesn't have built-in rotation - use inline formula
     */
    transformRotation(node) {
      const value = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // Get the appropriate unsigned type
      const typeMap = { 8: 'uint8_t', 16: 'uint16_t', 32: 'uint32_t', 64: 'uint64_t' };
      const cTypeName = typeMap[bits] || 'uint32_t';
      const cType = new CType(cTypeName);

      // Cast value to unsigned type
      const castValue = new CCast(cType, value);

      // Create mask for bit count
      const mask = new CBinaryExpression(CLiteral.UInt(bits, 'U'), '-', CLiteral.UInt(1, 'U'));

      // Masked amount: amount & (bits - 1)
      const maskedAmount = new CBinaryExpression(amount, '&', mask);

      // Complement: bits - maskedAmount
      const complement = new CBinaryExpression(CLiteral.UInt(bits, 'U'), '-', maskedAmount);

      if (isLeft) {
        // Left: (value << amount) | (value >> (bits - amount))
        const leftShift = new CBinaryExpression(castValue, '<<', maskedAmount);
        const rightShift = new CBinaryExpression(castValue, '>>', complement);
        return new CBinaryExpression(leftShift, '|', rightShift);
      } else {
        // Right: (value >> amount) | (value << (bits - amount))
        const rightShift = new CBinaryExpression(castValue, '>>', maskedAmount);
        const leftShift = new CBinaryExpression(castValue, '<<', complement);
        return new CBinaryExpression(rightShift, '|', leftShift);
      }
    }

    /**
     * Transform PackBytes to inline bit shifting
     */
    transformPackBytes(node) {
      // Handle both IL AST (arguments array) and legacy (bytes property)
      const bytes = (node.arguments || node.bytes || []).map(b => this.transformExpression(b));
      const bits = node.bits || 32;
      const isBigEndian = node.endian === 'big';

      if (bytes.length === 0) return CLiteral.UInt(0, 'U');

      // Determine byte order for shifts
      const byteCount = bits / 8;
      let result = null;

      for (let i = 0; i < bytes.length && i < byteCount; ++i) {
        const byteExpr = bytes[i];
        let shiftAmount;

        if (isBigEndian) {
          // Big endian: first byte is most significant
          shiftAmount = (byteCount - 1 - i) * 8;
        } else {
          // Little endian: first byte is least significant
          shiftAmount = i * 8;
        }

        let term;
        if (shiftAmount === 0) {
          term = byteExpr;
        } else {
          term = new CBinaryExpression(byteExpr, '<<', CLiteral.UInt(shiftAmount, 'U'));
        }

        if (result === null) {
          result = term;
        } else {
          result = new CBinaryExpression(result, '|', term);
        }
      }

      return result || CLiteral.UInt(0, 'U');
    }

    /**
     * Transform UnpackBytes to appropriate C helper function call
     * Returns uint8_t* array, not a single byte
     */
    transformUnpackBytes(node) {
      // Handle both IL AST (arguments array) and legacy (value property)
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const bits = node.bits || 32;
      const isBigEndian = node.endian === 'big';
      const index = node.index;

      // If index is specified, we're extracting a single byte
      if (index !== undefined) {
        const byteCount = bits / 8;
        let shiftAmount;

        if (isBigEndian) {
          shiftAmount = (byteCount - 1 - index) * 8;
        } else {
          shiftAmount = index * 8;
        }

        // (value >> shift) & 0xFF
        let result = value;
        if (shiftAmount > 0) {
          result = new CBinaryExpression(value, '>>', CLiteral.UInt(shiftAmount, 'U'));
        }
        return new CBinaryExpression(result, '&', CLiteral.UInt(0xFF, 'U'));
      }

      // Otherwise, return the full byte array using helper function
      // Use the _ret variant that returns uint8_t* for assignment
      const suffix = isBigEndian ? 'be' : 'le';
      const funcName = `unpack${bits}_${suffix}_ret`;
      return new CCall(new CIdentifier(funcName), [value]);
    }

    /**
     * Transform ArrayLength to appropriate C expression
     */
    transformArrayLength(node) {
      // Check if the original array variable has a special length macro (filter_alpha, string_split, etc.)
      const origArrayName = node.array.type === 'Identifier' ? node.array.name : null;
      if (origArrayName && this.specialLengthVars && this.specialLengthVars.has(origArrayName))
        return new CIdentifier(this.specialLengthVars.get(origArrayName));

      const array = this.transformExpression(node.array);
      // In C, arrays don't have built-in length - use a length variable or sizeof
      // For pointers passed to functions, need a separate length parameter
      // Return a variable reference that should be provided: array_length
      return this.buildArrayLengthVar(array);
    }

    /**
     * Transform ArrayAppend to array assignment with index
     */
    transformArrayAppend(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);

      // Check for spread element: arr.push(...data) -> memcpy + length increment
      if (node.value && node.value.type === 'SpreadElement') {
        const spreadArg = node.value.argument;
        const dataExpr = this.transformExpression(spreadArg);
        const dataName = spreadArg?.name || dataExpr?.name || 'data';
        // Convert to snake_case for consistency with C naming
        const dataLengthVar = this.toSnakeCase(dataName) + '_length';

        // Generate: memcpy(arr + arr_length, data, data_length * sizeof(*arr))
        const destPtr = new CBinaryExpression(array, '+', lengthVar);
        const copySize = new CBinaryExpression(
          new CIdentifier(dataLengthVar),
          '*',
          new CSizeof(new CUnaryExpression('*', array), false)
        );
        const memcpyCall = new CCall(new CIdentifier('memcpy'), [destPtr, dataExpr, copySize]);

        // Generate: arr_length += data_length
        const lengthIncr = new CAssignment(lengthVar, '+=', new CIdentifier(dataLengthVar));

        // Return comma expression for both operations
        return new CComma([memcpyCall, lengthIncr]);
      }

      // Single element: array[array_length++] = value
      const value = this.transformExpression(node.value);
      const postIncrement = new CUnaryExpression('++', lengthVar);
      postIncrement.isPrefix = false;
      const subscript = new CArraySubscript(array, postIncrement);
      return new CAssignment(subscript, '=', value);
    }

    /**
     * Transform ArraySlice to memcpy or helper function
     */
    transformArraySlice(node) {
      const array = this.transformExpression(node.array);
      const start = node.start ? this.transformExpression(node.start) : CLiteral.UInt(0, 'U');
      const end = node.end ? this.transformExpression(node.end) : null;

      // Call array_slice helper function - use array_slice_from for single-arg slices
      if (end) {
        return new CCall(new CIdentifier('array_slice'), [array, start, end]);
      } else {
        return new CCall(new CIdentifier('array_slice_from'), [array, start]);
      }
    }

    /**
     * Transform ArrayFill to memset or calloc
     * Handles new Array(n).fill(0) and arr.fill(value) patterns
     */
    transformArrayFill(node) {
      const fillValue = node.value;
      const isZeroFill = fillValue && fillValue.type === 'Literal' && fillValue.value === 0;

      // Check if array is an ArrayCreation or TypedArrayCreation (new Array(n).fill(0) pattern)
      if (node.array && (node.array.type === 'ArrayCreation' || node.array.type === 'TypedArrayCreation')) {
        const size = node.array.size ? this.transformExpression(node.array.size) : CLiteral.UInt(0, 'U');

        // Determine element type
        let elemType;
        if (node.array.type === 'TypedArrayCreation') {
          const typeMap = {
            'Uint8Array': CType.UInt8(),
            'Uint16Array': CType.UInt16(),
            'Uint32Array': CType.UInt32(),
            'Uint8ClampedArray': CType.UInt8(),
            'Int8Array': CType.Int8(),
            'Int16Array': CType.Int16(),
            'Int32Array': CType.Int32(),
            'Float32Array': new CType('float'),
            'Float64Array': new CType('double'),
            'BigUint64Array': CType.UInt64(),
            'BigInt64Array': CType.Int64()
          };
          elemType = typeMap[node.array.arrayType] || CType.UInt32();
        } else {
          // ArrayCreation - infer from elementType or use heuristics
          // For fill values in the byte range (0-255), use uint8_t (common for byte buffers/padding)
          // Otherwise default to uint32_t
          const rawElemType = node.array.elementType;
          if (!rawElemType || rawElemType === 'any' || rawElemType === 'unknown') {
            // Check if fill value is in byte range
            const fillVal = fillValue?.type === 'Literal' && typeof fillValue.value === 'number'
              ? fillValue.value : null;
            if (fillVal !== null && fillVal >= 0 && fillVal <= 255) {
              // Byte-range fill values suggest uint8_t array (padding, buffers)
              elemType = CType.UInt8();
            } else {
              elemType = CType.UInt32();
            }
          } else {
            elemType = this.mapType(rawElemType);
            // Double-check that mapType didn't return void
            if (elemType.name === 'void')
              elemType = CType.UInt32();
          }
        }

        // For zero fill, use calloc which zeros memory automatically
        if (isZeroFill) {
          const callocCall = new CCall(new CIdentifier('calloc'), [size, new CSizeof(elemType, true)]);
          return new CCast(CType.Pointer(elemType), callocCall);
        }

        // For non-zero fill, allocate then memset
        const sizeofExpr = new CSizeof(elemType, true);
        const totalSize = new CBinaryExpression(size, '*', sizeofExpr);
        const mallocCall = new CCall(new CIdentifier('malloc'), [totalSize]);
        const castMalloc = new CCast(CType.Pointer(elemType), mallocCall);

        // memset with the fill value
        const value = this.transformExpression(fillValue);
        const memsetCall = new CCall(new CIdentifier('memset'), [castMalloc, value, totalSize]);

        return memsetCall;
      }

      // Regular arr.fill(value) pattern - array already exists
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(fillValue);

      // Use memset for byte fills
      const lengthVar = this.buildArrayLengthVar(array);

      return new CCall(new CIdentifier('memset'), [array, value, lengthVar]);
    }

    /**
     * Transform ArrayXor to helper function or inline loop
     * IL node structure: { type: 'ArrayXor', arguments: [leftArray, rightArray] }
     */
    transformArrayXor(node) {
      // Debug: log the node structure
      // console.log('ArrayXor node:', JSON.stringify(node, null, 2));

      // Handle both node.left/right (legacy) and node.arguments (current IL structure)
      const leftSource = node.left || (node.arguments && node.arguments[0]);
      const rightSource = node.right || (node.arguments && node.arguments[1]);

      if (!leftSource || !rightSource) {
        // Detailed error message for debugging
        const msg = `ArrayXor: left=${!!leftSource}, right=${!!rightSource}, hasArgs=${!!node.arguments}, argsLen=${node.arguments?.length || 0}`;
        return new CComment(msg);
      }

      const left = this.transformExpression(leftSource);
      const right = this.transformExpression(rightSource);

      // Get length from left array (both should be same length)
      const lengthVar = this.buildArrayLengthVar(left);

      return new CCall(new CIdentifier('array_xor'), [left, right, lengthVar]);
    }

    /**
     * Transform ArrayClear to memset with 0
     * IL node structure: { type: 'ArrayClear', arguments: [arrayExpr] }
     */
    transformArrayClear(node) {
      // Handle both node.array (legacy) and node.arguments[0] (current IL structure)
      const arraySource = node.array || (node.arguments && node.arguments[0]);
      if (!arraySource) {
        // If no array source, return a comment placeholder to avoid broken memset
        return new CComment('ArrayClear: missing array argument');
      }
      const array = this.transformExpression(arraySource);
      if (!array) {
        return new CComment('ArrayClear: failed to transform array');
      }
      const lengthVar = this.buildArrayLengthVar(array);

      return new CCall(new CIdentifier('memset'), [array, CLiteral.UInt(0, 'U'), lengthVar]);
    }

    /**
     * Transform ArrayCreation to malloc
     */
    transformArrayCreation(node) {
      const size = node.size ? this.transformExpression(node.size) : CLiteral.UInt(0, 'U');

      // Handle 'any' elementType - default to uint32_t for crypto code
      const rawElemType = node.elementType;
      let elementType;
      if (!rawElemType || rawElemType === 'any' || rawElemType === 'unknown') {
        elementType = CType.UInt32();
      } else {
        elementType = this.mapType(rawElemType);
        if (elementType.name === 'void')
          elementType = CType.UInt32();
      }

      const sizeofExpr = new CSizeof(elementType, true);
      const totalSize = new CBinaryExpression(size, '*', sizeofExpr);
      const mallocCall = new CCall(new CIdentifier('malloc'), [totalSize]);
      return new CCast(CType.Pointer(elementType), mallocCall);
    }

    /**
     * Transform TypedArrayCreation to malloc with specific type
     */
    transformTypedArrayCreation(node) {
      let size = node.size ? this.transformExpression(node.size) : CLiteral.UInt(0, 'U');
      const arrayType = node.arrayType || 'Uint8Array';

      // If the size argument is an identifier that's a pointer type, use its _length companion
      // e.g., new Uint8Array(data) where data is uint8_t* should use data_length
      if (node.size?.type === 'Identifier') {
        const argType = this.getVariableType(node.size.name);
        if (argType && (argType.isPointer || argType.pointerLevel > 0 || argType.isArray)) {
          const lengthVarName = this.toSafeCName(node.size.name) + '_length';
          size = new CIdentifier(lengthVarName);
        }
      }

      const typeMap = {
        'Uint8Array': 'uint8_t',
        'Uint16Array': 'uint16_t',
        'Uint32Array': 'uint32_t',
        'Uint8ClampedArray': 'uint8_t',
        'Int8Array': 'int8_t',
        'Int16Array': 'int16_t',
        'Int32Array': 'int32_t',
        'Float32Array': 'float',
        'Float64Array': 'double',
        'BigUint64Array': 'uint64_t',
        'BigInt64Array': 'int64_t'
      };

      const cTypeName = typeMap[arrayType] || 'uint8_t';
      const cType = new CType(cTypeName);

      const sizeofExpr = new CSizeof(cType, true);
      const totalSize = new CBinaryExpression(size, '*', sizeofExpr);
      const mallocCall = new CCall(new CIdentifier('malloc'), [totalSize]);
      return new CCast(CType.Pointer(cType), mallocCall);
    }

    /**
     * Transform ByteBufferView - C uses pointers directly
     */
    transformByteBufferView(node) {
      const buffer = this.transformExpression(node.buffer);
      const offset = node.offset ? this.transformExpression(node.offset) : CLiteral.UInt(0, 'U');

      // In C: (type*)(buffer + offset)
      const offsetExpr = new CBinaryExpression(buffer, '+', offset);

      const viewType = node.viewType || 'Uint8Array';
      const typeMap = {
        'Uint8Array': 'uint8_t',
        'Uint16Array': 'uint16_t',
        'Uint32Array': 'uint32_t',
        'Int8Array': 'int8_t',
        'Int16Array': 'int16_t',
        'Int32Array': 'int32_t',
        'Float32Array': 'float',
        'Float64Array': 'double',
        'DataView': 'uint8_t'
      };

      const cTypeName = typeMap[viewType] || 'uint8_t';
      return new CCast(CType.Pointer(new CType(cTypeName)), offsetExpr);
    }

    /**
     * Transform IL AST ArrayIndexOf node
     * IL node: { type: 'ArrayIndexOf', array, value, start }
     * For strings on 'this', use string_index_of; otherwise array_index_of
     */
    transformArrayIndexOf(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);

      // Detect if this is a string operation based on the array source
      // String fields typically have names like UPPERCASE, ALPHABET, etc.
      const arraySource = node.array;
      let isStringOp = false;
      if (arraySource) {
        if (arraySource.type === 'ThisPropertyAccess') {
          const propName = arraySource.property || '';
          if (propName.toUpperCase().includes('CASE') ||
              propName.toUpperCase().includes('ALPHABET') ||
              propName.toUpperCase().includes('STRING') ||
              propName.toUpperCase().includes('TEXT'))
            isStringOp = true;
        }
        // Also check if the array type annotation suggests string
        if (arraySource.inferredType === 'string' || arraySource.inferredType === 'char*')
          isStringOp = true;
      }

      if (isStringOp)
        return new CCall(new CIdentifier('string_index_of'), [array, value]);

      // For arrays, need length parameter
      const lengthVar = this.buildArrayLengthVar(array);
      return new CCall(new CIdentifier('array_index_of'), [array, lengthVar, value]);
    }

    /**
     * Transform IL AST ArrayIncludes node
     * IL node: { type: 'ArrayIncludes', array, value }
     */
    transformArrayIncludes(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      const lengthVar = this.buildArrayLengthVar(array);
      return new CCall(new CIdentifier('array_includes'), [array, lengthVar, value]);
    }

    /**
     * Transform IL AST ArrayConcat node
     * IL node: { type: 'ArrayConcat', array, arrays }
     */
    transformArrayConcat(node) {
      const array = this.transformExpression(node.array);
      const arrays = node.arrays ? node.arrays.map(a => this.transformExpression(a)) : [];
      const lengthVar = this.buildArrayLengthVar(array);

      // Use concat_arrays_ret(a, a_len, b, b_len) which returns a new allocated array
      // This is needed when the result is assigned: self->buffer = self->buffer.concat(data)
      if (arrays.length > 0) {
        const other = arrays[0];
        const otherLen = this.buildArrayLengthVar(other);
        return new CCall(new CIdentifier('concat_arrays_ret'), [array, lengthVar, other, otherLen]);
      }
      return array;
    }

    /**
     * Transform IL AST ArrayJoin node
     * IL node: { type: 'ArrayJoin', array, separator }
     */
    transformArrayJoin(node) {
      const array = this.transformExpression(node.array);
      const separator = node.separator ? this.transformExpression(node.separator) : CLiteral.String(',');
      const lengthVar = this.buildArrayLengthVar(array);
      return new CCall(new CIdentifier('array_join'), [array, lengthVar, separator]);
    }

    /**
     * Transform IL AST ArrayReverse node
     * IL node: { type: 'ArrayReverse', array }
     */
    transformArrayReverse(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      return new CCall(new CIdentifier('array_reverse'), [array, lengthVar]);
    }

    /**
     * Transform IL AST ArrayPush node
     * IL node: { type: 'ArrayPush', array, value }
     */
    transformArrayPush(node) {
      const array = this.transformExpression(node.array);
      const value = node.value ? this.transformExpression(node.value) : CLiteral.UInt(0, 'U');
      // ARRAY_PUSH(arr, arr_length, val) macro
      const lengthVar = this.buildArrayLengthVar(array);
      return new CCall(new CIdentifier('ARRAY_PUSH'), [array, lengthVar, value]);
    }

    /**
     * Transform IL AST ArrayPop node
     * IL node: { type: 'ArrayPop', array }
     */
    transformArrayPop(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      // arr[--arr_length]
      const preDecrement = new CUnaryExpression('--', lengthVar);
      preDecrement.isPrefix = true;
      return new CArraySubscript(array, preDecrement);
    }

    /**
     * Transform IL AST ArrayShift node
     * IL node: { type: 'ArrayShift', array }
     */
    transformArrayShift(node) {
      const array = this.transformExpression(node.array);
      // Return first element - caller needs to handle memmove
      return new CArraySubscript(array, CLiteral.UInt(0, 'U'));
    }

    /**
     * Transform IL AST ArraySplice node
     * IL node: { type: 'ArraySplice', array, start, deleteCount, items }
     */
    transformArraySplice(node) {
      const array = this.transformExpression(node.array);
      const start = node.start ? this.transformExpression(node.start) : CLiteral.UInt(0, 'U');
      const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : CLiteral.UInt(1, 'U');
      const lengthVar = this.buildArrayLengthVar(array);
      // array_splice needs a pointer to length so it can modify it
      const lengthPtr = new CUnaryExpression('&', lengthVar);
      return new CCall(new CIdentifier('array_splice'), [array, lengthPtr, start, deleteCount]);
    }

    /**
     * Transform HexDecode to helper function call
     */
    transformHexDecode(node) {
      const value = this.transformExpression(node.value);
      return new CCall(new CIdentifier('hex_to_bytes'), [value]);
    }

    /**
     * Transform HexEncode to helper function call
     */
    transformHexEncode(node) {
      const value = this.transformExpression(node.value);
      return new CCall(new CIdentifier('bytes_to_hex'), [value]);
    }

    /**
     * Transform StringToBytes IL node to ansi_to_bytes/utf8_to_bytes helper call
     */
    transformStringToBytes(node) {
      // IL node has either node.value or node.arguments[0]
      const valueNode = node.value || (node.arguments && node.arguments[0]);
      if (!valueNode) return new CCall(new CIdentifier('ansi_to_bytes'), [CLiteral.String('')]);
      const value = this.transformExpression(valueNode);
      // Use encoding-specific function if available
      const encoding = node.encoding || 'ascii';
      const fnName = encoding === 'utf8' || encoding === 'utf-8' ? 'utf8_to_bytes' : 'ansi_to_bytes';
      return new CCall(new CIdentifier(fnName), [value]);
    }

    /**
     * Transform BytesToString IL node to bytes_to_ansi/bytes_to_utf8 helper call
     */
    transformBytesToString(node) {
      // IL node has either node.value or node.arguments[0]
      const valueNode = node.value || (node.arguments && node.arguments[0]);
      if (!valueNode) return new CCall(new CIdentifier('bytes_to_ansi'), [CLiteral.Null()]);
      const value = this.transformExpression(valueNode);
      // Use encoding-specific function if available
      const encoding = node.encoding || 'ascii';
      const fnName = encoding === 'utf8' || encoding === 'utf-8' ? 'bytes_to_utf8' : 'bytes_to_ansi';
      return new CCall(new CIdentifier(fnName), [value]);
    }

    /**
     * Transform Floor - C uses (int) cast for integers or floor() from math.h
     */
    transformFloor(node) {
      const arg = this.transformExpression(node.argument);
      // Use integer cast for simple floor on positive values
      // For full floor behavior, use floor() from math.h
      return new CCast(CType.Int32(), arg);
    }

    /**
     * Transform Ceil to ceil() function call
     */
    transformCeil(node) {
      const arg = this.transformExpression(node.argument);
      const ceilResult = new CCall(new CIdentifier('ceil'), [arg]);
      return new CCast(CType.Int32(), ceilResult);
    }

    /**
     * Transform Abs to abs() or fabs()
     */
    transformAbs(node) {
      const arg = this.transformExpression(node.argument);
      // For integers, use abs(); for floats use fabs()
      return new CCall(new CIdentifier('abs'), [arg]);
    }

    /**
     * Transform Min to ternary expression (C doesn't have built-in min)
     */
    transformMin(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      if (args.length === 0) return CLiteral.UInt(0, 'U');
      if (args.length === 1) return args[0];

      // Chain ternaries: a < b ? a : b
      let result = args[args.length - 1];
      for (let i = args.length - 2; i >= 0; --i) {
        const left = args[i];
        const cond = new CBinaryExpression(left, '<', result);
        result = new CConditional(cond, left, result);
      }
      return result;
    }

    /**
     * Transform Max to ternary expression
     */
    transformMax(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      if (args.length === 0) return CLiteral.UInt(0, 'U');
      if (args.length === 1) return args[0];

      // Chain ternaries: a > b ? a : b
      let result = args[args.length - 1];
      for (let i = args.length - 2; i >= 0; --i) {
        const left = args[i];
        const cond = new CBinaryExpression(left, '>', result);
        result = new CConditional(cond, left, result);
      }
      return result;
    }

    /**
     * Transform Pow to pow() function call
     */
    transformPow(node) {
      const base = this.transformExpression(node.base);
      const exponent = this.transformExpression(node.exponent);
      return new CCall(new CIdentifier('pow'), [base, exponent]);
    }

    /**
     * Transform Round to round() or lround()
     */
    transformRound(node) {
      const arg = this.transformExpression(node.argument);
      const roundResult = new CCall(new CIdentifier('lround'), [arg]);
      return roundResult;
    }

    /**
     * Transform Trunc to trunc() or integer cast
     */
    transformTrunc(node) {
      const arg = this.transformExpression(node.argument);
      return new CCast(CType.Int32(), arg);
    }

    /**
     * Transform Sign to inline ternary
     */
    transformSign(node) {
      const arg = this.transformExpression(node.argument);
      // (x > 0) ? 1 : ((x < 0) ? -1 : 0)
      const gtZero = new CBinaryExpression(arg, '>', CLiteral.UInt(0, 'U'));
      const ltZero = new CBinaryExpression(arg, '<', CLiteral.UInt(0, 'U'));
      const inner = new CConditional(ltZero, CLiteral.Int(-1), CLiteral.Int(0));
      return new CConditional(gtZero, CLiteral.Int(1), inner);
    }

    /**
     * Transform Random to rand()
     */
    transformRandom(node) {
      // rand() / (double)RAND_MAX for [0, 1) range
      const randCall = new CCall(new CIdentifier('rand'), []);
      const randMax = new CIdentifier('RAND_MAX');
      const castMax = new CCast(new CType('double'), randMax);
      return new CBinaryExpression(randCall, '/', castMax);
    }

    /**
     * Transform Imul to simple multiplication (C handles 32-bit multiplication natively)
     */
    transformImul(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      // Cast to int32_t for signed multiplication, then result
      const castLeft = new CCast(CType.Int32(), left);
      const castRight = new CCast(CType.Int32(), right);
      const mult = new CBinaryExpression(castLeft, '*', castRight);
      return new CCast(CType.Int32(), mult);
    }

    /**
     * Transform Clz32 to __builtin_clz or inline
     */
    transformClz32(node) {
      const arg = this.transformExpression(node.argument);
      // Use GCC/Clang builtin - on other compilers would need alternative
      // __builtin_clz returns undefined for 0, so handle that case
      const zero = CLiteral.UInt(0, 'U');
      const isZero = new CBinaryExpression(arg, '==', zero);
      const clzCall = new CCall(new CIdentifier('__builtin_clz'), [arg]);
      return new CConditional(isZero, CLiteral.UInt(32, 'U'), clzCall);
    }

    /**
     * Transform Cast to C cast
     * Handles both IL AST (arguments array) and JS AST (expression property) formats
     */
    transformCast(node) {
      // IL AST uses arguments array, JS AST uses expression property
      const exprNode = node.arguments?.[0] || node.expression || node.argument;
      if (!exprNode) {
        // No expression to cast - shouldn't happen but return a placeholder
        return CLiteral.UInt(0, 'U');
      }
      const expr = this.transformExpression(exprNode);
      const targetType = this.mapType(node.targetType || 'uint32');
      return new CCast(targetType, expr);
    }

    /**
     * Transform DestructuringAssignment to sequential assignments
     */
    transformDestructuringAssignment(node) {
      // This should have been normalized by IL AST transformer
      // but handle as fallback - just return the source
      if (node.source) {
        return this.transformExpression(node.source);
      }
      return CLiteral.Null();
    }

    // ===================================================================
    // Array higher-order operations
    // ===================================================================

    /**
     * Transform ArrayEvery - array.every(fn) -> array_every(arr, len, fn)
     * IL node: { type: 'ArrayEvery', array, callback/predicate }
     */
    transformArrayEvery(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.predicate;
      if (callback) {
        const fn = this.transformExpression(callback);
        return new CCall(new CIdentifier('array_every'), [array, lengthVar, fn]);
      }
      // No callback - return true (vacuously true)
      return CLiteral.Bool(true);
    }

    /**
     * Transform ArrayFilter - array.filter(fn) -> array_filter(arr, len, fn)
     * IL node: { type: 'ArrayFilter', array, callback/predicate }
     */
    transformArrayFilter(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.predicate;
      if (callback) {
        const fn = this.transformExpression(callback);
        return new CCall(new CIdentifier('array_filter'), [array, lengthVar, fn]);
      }
      return array;
    }

    /**
     * Transform ArrayFind - array.find(fn) -> array_find(arr, len, fn)
     * IL node: { type: 'ArrayFind', array, callback/predicate }
     */
    transformArrayFind(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.predicate;
      if (callback) {
        const fn = this.transformExpression(callback);
        return new CCall(new CIdentifier('array_find'), [array, lengthVar, fn]);
      }
      return new CIdentifier('NULL');
    }

    /**
     * Transform ArrayFindIndex - array.findIndex(fn) -> array_find_index(arr, len, fn)
     * IL node: { type: 'ArrayFindIndex', array, callback/predicate }
     */
    transformArrayFindIndex(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.predicate;
      if (callback) {
        const fn = this.transformExpression(callback);
        return new CCall(new CIdentifier('array_find_index'), [array, lengthVar, fn]);
      }
      return CLiteral.Int(-1);
    }

    /**
     * Transform ArrayForEach - array.forEach(fn) -> array_for_each(arr, len, fn)
     * IL node: { type: 'ArrayForEach', array, callback }
     */
    transformArrayForEach(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.predicate;
      if (callback) {
        const fn = this.transformExpression(callback);
        return new CCall(new CIdentifier('array_for_each'), [array, lengthVar, fn]);
      }
      return CLiteral.Int(0);
    }

    /**
     * Transform ArrayFrom - Array.from(iterable, mapFn?) -> array_from(src, len) or memcpy
     * IL node: { type: 'ArrayFrom', iterable, mapFunction? }
     */
    transformArrayFrom(node) {
      const iterable = this.transformExpression(node.iterable || node.source);
      if (node.mapFunction) {
        const mapFn = this.transformExpression(node.mapFunction);
        const lengthVar = this.buildArrayLengthVar(iterable);
        return new CCall(new CIdentifier('array_from_map'), [iterable, lengthVar, mapFn]);
      }
      // Simple copy: memcpy into new allocation
      const lengthVar = this.buildArrayLengthVar(iterable);
      return new CCall(new CIdentifier('array_copy'), [iterable, lengthVar]);
    }

    /**
     * Transform ArrayMap - array.map(fn) -> array_map(arr, len, fn)
     * IL node: { type: 'ArrayMap', array, callback }
     */
    transformArrayMap(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.mapFunction;
      if (callback) {
        const fn = this.transformExpression(callback);
        return new CCall(new CIdentifier('array_map'), [array, lengthVar, fn]);
      }
      return array;
    }

    /**
     * Transform ArrayReduce - array.reduce(fn, init) -> array_reduce(arr, len, fn, init)
     * IL node: { type: 'ArrayReduce', array, callback, initialValue? }
     */
    transformArrayReduce(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.reducer;
      const args = [array, lengthVar];
      if (callback)
        args.push(this.transformExpression(callback));
      if (node.initialValue !== undefined && node.initialValue !== null)
        args.push(this.transformExpression(node.initialValue));
      return new CCall(new CIdentifier('array_reduce'), args);
    }

    /**
     * Transform ArraySome - array.some(fn) -> array_some(arr, len, fn)
     * IL node: { type: 'ArraySome', array, callback/predicate }
     */
    transformArraySome(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const callback = node.callback || node.predicate;
      if (callback) {
        const fn = this.transformExpression(callback);
        return new CCall(new CIdentifier('array_some'), [array, lengthVar, fn]);
      }
      return CLiteral.Bool(false);
    }

    /**
     * Transform ArraySort - array.sort(compareFn?) -> qsort(arr, len, sizeof(elem), cmp)
     * IL node: { type: 'ArraySort', array, compareFn? }
     */
    transformArraySort(node) {
      const array = this.transformExpression(node.array);
      const lengthVar = this.buildArrayLengthVar(array);
      const elemSize = new CSizeof(new CUnaryExpression('*', array), false);
      const args = [array, lengthVar, elemSize];
      if (node.compareFn) {
        args.push(this.transformExpression(node.compareFn));
      } else {
        // Default compare function pointer
        args.push(new CIdentifier('compare_default'));
      }
      return new CCall(new CIdentifier('qsort'), args);
    }

    /**
     * Transform ArrayUnshift - array.unshift(value) -> memmove + insert at [0]
     * IL node: { type: 'ArrayUnshift', array, value }
     */
    transformArrayUnshift(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      const lengthVar = this.buildArrayLengthVar(array);
      // memmove(arr + 1, arr, len * sizeof(*arr)); arr[0] = value; ++len;
      return new CCall(new CIdentifier('array_unshift'), [array, new CUnaryExpression('&', lengthVar), value]);
    }

    // ===================================================================
    // String operations
    // ===================================================================

    /**
     * Transform StringCharAt - str.charAt(i) -> str[i]
     * IL node: { type: 'StringCharAt', string, index }
     */
    transformStringCharAt(node) {
      const str = this.transformExpression(node.string || node.value);
      const index = this.transformExpression(node.index);
      return new CArraySubscript(str, index);
    }

    /**
     * Transform StringCharCodeAt - str.charCodeAt(i) -> (unsigned char)str[i]
     * IL node: { type: 'StringCharCodeAt', string, index }
     */
    transformStringCharCodeAt(node) {
      const str = this.transformExpression(node.string || node.value);
      const index = this.transformExpression(node.index);
      return new CCast(CType.UInt8(), new CArraySubscript(str, index));
    }

    /**
     * Transform StringEndsWith - str.endsWith(suffix) -> string_ends_with(str, suffix)
     * IL node: { type: 'StringEndsWith', string, suffix/search }
     */
    transformStringEndsWith(node) {
      const str = this.transformExpression(node.string || node.value);
      const suffix = this.transformExpression(node.suffix || node.search || node.searchValue);
      return new CCall(new CIdentifier('string_ends_with'), [str, suffix]);
    }

    /**
     * Transform StringIncludes - str.includes(sub) -> (strstr(str, sub) != NULL)
     * IL node: { type: 'StringIncludes', string, search/substring }
     */
    transformStringIncludes(node) {
      const str = this.transformExpression(node.string || node.value);
      const search = this.transformExpression(node.search || node.substring);
      const strstrCall = new CCall(new CIdentifier('strstr'), [str, search]);
      return new CBinaryExpression(strstrCall, '!=', new CIdentifier('NULL'));
    }

    /**
     * Transform StringIndexOf - str.indexOf(sub) -> string_index_of(str, sub)
     * IL node: { type: 'StringIndexOf', string, search/substring }
     */
    transformStringIndexOf(node) {
      const str = this.transformExpression(node.string || node.value);
      const search = this.transformExpression(node.search || node.substring);
      return new CCall(new CIdentifier('string_index_of'), [str, search]);
    }

    /**
     * Transform StringRepeat - str.repeat(count) -> string_repeat(str, count)
     * IL node: { type: 'StringRepeat', string, count }
     */
    transformStringRepeat(node) {
      const str = this.transformExpression(node.string || node.value);
      const count = node.count ? this.transformExpression(node.count) : CLiteral.UInt(1, 'U');
      return new CCall(new CIdentifier('string_repeat'), [str, count]);
    }

    /**
     * Transform StringReplace - str.replace(search, replace) -> string_replace(str, search, replace)
     * IL node: { type: 'StringReplace', string, searchValue, replaceValue }
     */
    transformStringReplace(node) {
      const str = this.transformExpression(node.string || node.value);
      const search = this.transformExpression(node.searchValue || node.search);
      const replace = this.transformExpression(node.replaceValue || node.replacement);
      return new CCall(new CIdentifier('string_replace'), [str, search, replace]);
    }

    /**
     * Transform StringSplit - str.split(sep) -> string_split(str, sep)
     * IL node: { type: 'StringSplit', string, separator }
     */
    transformStringSplit(node) {
      const str = this.transformExpression(node.string || node.value || node.object);
      const separator = node.separator ? this.transformExpression(node.separator) : CLiteral.String('');
      return new CCall(new CIdentifier('string_split'), [str, separator]);
    }

    /**
     * Transform StringStartsWith - str.startsWith(prefix) -> strncmp(str, prefix, strlen(prefix)) == 0
     * IL node: { type: 'StringStartsWith', string, prefix/search }
     */
    transformStringStartsWith(node) {
      const str = this.transformExpression(node.string || node.value);
      const prefix = this.transformExpression(node.prefix || node.search || node.searchValue);
      const strlenCall = new CCall(new CIdentifier('strlen'), [prefix]);
      const strncmpCall = new CCall(new CIdentifier('strncmp'), [str, prefix, strlenCall]);
      return new CBinaryExpression(strncmpCall, '==', CLiteral.UInt(0, 'U'));
    }

    /**
     * Transform StringSubstring - str.substring(start, end) -> string_substring(str, start, end)
     * IL node: { type: 'StringSubstring', string, start, end? }
     */
    transformStringSubstring(node) {
      const str = this.transformExpression(node.string || node.value || node.object);
      const start = node.start ? this.transformExpression(node.start) : CLiteral.UInt(0, 'U');
      const args = [str, start];
      if (node.end) {
        const end = this.transformExpression(node.end);
        // length = end - start
        args.push(new CBinaryExpression(end, '-', start));
      }
      return new CCall(new CIdentifier('string_substring'), args);
    }

    /**
     * Transform StringToLowerCase - str.toLowerCase() -> string_to_lower(str)
     * IL node: { type: 'StringToLowerCase', string }
     */
    transformStringToLowerCase(node) {
      const str = this.transformExpression(node.string || node.value);
      return new CCall(new CIdentifier('string_to_lower'), [str]);
    }

    /**
     * Transform StringToUpperCase - str.toUpperCase() -> string_to_upper(str)
     * IL node: { type: 'StringToUpperCase', string }
     */
    transformStringToUpperCase(node) {
      const str = this.transformExpression(node.string || node.value);
      return new CCall(new CIdentifier('string_to_upper'), [str]);
    }

    /**
     * Transform StringTrim - str.trim() -> string_trim(str)
     * IL node: { type: 'StringTrim', string }
     */
    transformStringTrim(node) {
      const str = this.transformExpression(node.string || node.value);
      return new CCall(new CIdentifier('string_trim'), [str]);
    }

    /**
     * Transform StringTransform - dispatches based on transform type
     * IL node: { type: 'StringTransform', string, method/operation }
     */
    transformStringTransform(node) {
      const str = this.transformExpression(node.string || node.argument || node.value);
      const operation = node.operation || node.method;
      switch (operation) {
        case 'toLowerCase':
        case 'to_lower_case':
          return new CCall(new CIdentifier('string_to_lower'), [str]);
        case 'toUpperCase':
        case 'to_upper_case':
          return new CCall(new CIdentifier('string_to_upper'), [str]);
        case 'trim':
          return new CCall(new CIdentifier('string_trim'), [str]);
        case 'trimStart':
        case 'trimLeft':
          return new CCall(new CIdentifier('string_trim_start'), [str]);
        case 'trimEnd':
        case 'trimRight':
          return new CCall(new CIdentifier('string_trim_end'), [str]);
        default:
          // Generic helper: string_<operation>(str)
          return new CCall(new CIdentifier('string_' + this.toSnakeCase(operation || 'transform')), [str]);
      }
    }

    // ===================================================================
    // Buffer/DataView/TypedArray operations
    // ===================================================================

    /**
     * Transform BufferCreation - new ArrayBuffer(size) -> calloc(size, 1)
     * IL node: { type: 'BufferCreation', size }
     */
    transformBufferCreation(node) {
      const size = node.size ? this.transformExpression(node.size) : CLiteral.UInt(0, 'U');
      return new CCall(new CIdentifier('calloc'), [size, CLiteral.UInt(1, 'U')]);
    }

    /**
     * Transform DataViewCreation - new DataView(buffer) -> just use the buffer pointer
     * IL node: { type: 'DataViewCreation', buffer }
     */
    transformDataViewCreation(node) {
      // In C, a DataView is just a pointer to the underlying buffer
      return this.transformExpression(node.buffer);
    }

    /**
     * Transform DataViewRead - view.getUint32(offset, le) -> manual byte reading with shifts
     * IL node: { type: 'DataViewRead', view/dataView, offset, method }
     */
    transformDataViewRead(node) {
      const view = this.transformExpression(node.view || node.dataView);
      const offset = this.transformExpression(node.offset);
      const method = node.method || 'getUint8';
      const littleEndian = node.littleEndian;

      if (method === 'getUint8' || method === 'getInt8')
        return new CArraySubscript(view, offset);

      // Determine type and size
      const typeMap = {
        'getUint16': 'uint16_t', 'getInt16': 'int16_t',
        'getUint32': 'uint32_t', 'getInt32': 'int32_t',
        'getFloat32': 'float', 'getFloat64': 'double',
        'getBigUint64': 'uint64_t', 'getBigInt64': 'int64_t'
      };
      const cType = typeMap[method] || 'uint32_t';
      const fnSuffix = littleEndian ? '_le' : '_be';
      return new CCall(new CIdentifier('read_' + cType + fnSuffix), [view, offset]);
    }

    /**
     * Transform DataViewWrite - view.setUint32(offset, value, le) -> manual byte writing with shifts
     * IL node: { type: 'DataViewWrite', view/dataView, offset, value, method }
     */
    transformDataViewWrite(node) {
      const view = this.transformExpression(node.view || node.dataView);
      const offset = this.transformExpression(node.offset);
      const value = this.transformExpression(node.value);
      const method = node.method || 'setUint8';
      const littleEndian = node.littleEndian;

      if (method === 'setUint8' || method === 'setInt8')
        return new CAssignment(new CArraySubscript(view, offset), '=', value);

      const typeMap = {
        'setUint16': 'uint16_t', 'setInt16': 'int16_t',
        'setUint32': 'uint32_t', 'setInt32': 'int32_t',
        'setFloat32': 'float', 'setFloat64': 'double',
        'setBigUint64': 'uint64_t', 'setBigInt64': 'int64_t'
      };
      const cType = typeMap[method] || 'uint32_t';
      const fnSuffix = littleEndian ? '_le' : '_be';
      return new CCall(new CIdentifier('write_' + cType + fnSuffix), [view, offset, value]);
    }

    /**
     * Transform TypedArraySet - typedArr.set(source, offset) -> memcpy(dest + offset, src, count * sizeof(type))
     * IL node: { type: 'TypedArraySet', array, source, offset? }
     */
    transformTypedArraySet(node) {
      const dest = this.transformExpression(node.array);
      const src = this.transformExpression(node.source);
      const offset = node.offset ? this.transformExpression(node.offset) : CLiteral.UInt(0, 'U');
      const srcLen = this.buildArrayLengthVar(src);
      const elemSize = new CSizeof(new CUnaryExpression('*', dest), false);
      const destPtr = new CBinaryExpression(dest, '+', offset);
      const copySize = new CBinaryExpression(srcLen, '*', elemSize);
      return new CCall(new CIdentifier('memcpy'), [destPtr, src, copySize]);
    }

    /**
     * Transform TypedArraySubarray - typedArr.subarray(start, end) -> pointer arithmetic arr + start
     * IL node: { type: 'TypedArraySubarray', array, start, end? }
     */
    transformTypedArraySubarray(node) {
      const array = this.transformExpression(node.array);
      const start = this.transformExpression(node.start);
      // In C, a subarray is just pointer arithmetic: arr + start
      return new CBinaryExpression(array, '+', start);
    }

    // ===================================================================
    // Map/Set operations (struct-based helpers in C)
    // ===================================================================

    /**
     * Transform MapCreation - new Map() -> map_create()
     * IL node: { type: 'MapCreation', entries? }
     */
    transformMapCreation(node) {
      // C doesn't have built-in maps; use helper struct
      if (node.entries) {
        const entries = this.transformExpression(node.entries);
        return new CCall(new CIdentifier('map_create_from'), [entries]);
      }
      return new CCall(new CIdentifier('map_create'), []);
    }

    /**
     * Transform MapGet - map.get(key) -> map_get(map, key)
     * IL node: { type: 'MapGet', map, key }
     */
    transformMapGet(node) {
      const map = this.transformExpression(node.map);
      const key = this.transformExpression(node.key);
      return new CCall(new CIdentifier('map_get'), [map, key]);
    }

    /**
     * Transform MapSet - map.set(key, value) -> map_set(map, key, value)
     * IL node: { type: 'MapSet', map, key, value }
     */
    transformMapSet(node) {
      const map = this.transformExpression(node.map);
      const key = this.transformExpression(node.key);
      const value = this.transformExpression(node.value);
      return new CCall(new CIdentifier('map_set'), [map, key, value]);
    }

    /**
     * Transform MapHas - map.has(key) -> map_has(map, key)
     * IL node: { type: 'MapHas', map, key }
     */
    transformMapHas(node) {
      const map = this.transformExpression(node.map);
      const key = this.transformExpression(node.key);
      return new CCall(new CIdentifier('map_has'), [map, key]);
    }

    /**
     * Transform MapDelete - map.delete(key) -> map_delete(map, key)
     * IL node: { type: 'MapDelete', map, key }
     */
    transformMapDelete(node) {
      const map = this.transformExpression(node.map);
      const key = this.transformExpression(node.key);
      return new CCall(new CIdentifier('map_delete'), [map, key]);
    }

    /**
     * Transform SetCreation - new Set() -> set_create()
     * IL node: { type: 'SetCreation', values? }
     */
    transformSetCreation(node) {
      if (node.values) {
        const values = this.transformExpression(node.values);
        return new CCall(new CIdentifier('set_create_from'), [values]);
      }
      return new CCall(new CIdentifier('set_create'), []);
    }

    // ===================================================================
    // Utility operations
    // ===================================================================

    /**
     * Transform CopyArray - memcpy(dest, src, len * sizeof(elem))
     * IL node: { type: 'CopyArray', arguments: [src] } or { source, destination }
     */
    transformCopyArray(node) {
      if (node.arguments && node.arguments.length > 0) {
        const src = this.transformExpression(node.arguments[0]);
        const lengthVar = this.buildArrayLengthVar(src);
        return new CCall(new CIdentifier('array_copy'), [src, lengthVar]);
      }
      const src = this.transformExpression(node.source || node.array);
      const lengthVar = this.buildArrayLengthVar(src);
      return new CCall(new CIdentifier('array_copy'), [src, lengthVar]);
    }

    /**
     * Transform ObjectKeys - Object.keys(obj) -> not directly supported in C
     * IL node: { type: 'ObjectKeys', argument/object }
     */
    transformObjectKeys(node) {
      const obj = this.transformExpression(node.argument || node.object);
      // C structs don't have runtime key enumeration; use helper
      return new CCall(new CIdentifier('object_keys'), [obj]);
    }

    /**
     * Transform ObjectValues - Object.values(obj) -> not directly supported in C
     * IL node: { type: 'ObjectValues', argument/object }
     */
    transformObjectValues(node) {
      const obj = this.transformExpression(node.argument || node.object);
      return new CCall(new CIdentifier('object_values'), [obj]);
    }

    /**
     * Transform ObjectEntries - Object.entries(obj) -> not directly supported in C
     * IL node: { type: 'ObjectEntries', argument/object }
     */
    transformObjectEntries(node) {
      const obj = this.transformExpression(node.argument || node.object);
      return new CCall(new CIdentifier('object_entries'), [obj]);
    }

    /**
     * Transform DebugOutput - console.log(...) -> fprintf(stderr, ...)
     * IL node: { type: 'DebugOutput', arguments, level/method }
     */
    transformDebugOutput(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      const level = node.level || node.method || 'log';
      const stream = (level === 'error' || level === 'warn')
        ? new CIdentifier('stderr')
        : new CIdentifier('stderr');
      if (args.length === 0)
        return new CCall(new CIdentifier('fprintf'), [stream, CLiteral.String('\\n')]);
      // Use fprintf with %s format for the first argument
      return new CCall(new CIdentifier('fprintf'), [stream, CLiteral.String('%s\\n'), ...args]);
    }

    /**
     * Transform ErrorCreation - new Error(msg) -> fprintf(stderr, "Error: %s\n", msg) + return error code
     * IL node: { type: 'ErrorCreation', message, errorType? }
     */
    transformErrorCreation(node) {
      const message = node.message ? this.transformExpression(node.message) : CLiteral.String('error');
      // In C, errors are typically handled via return codes; emit fprintf + -1
      return new CCall(new CIdentifier('fprintf'), [
        new CIdentifier('stderr'),
        CLiteral.String('Error: %s\\n'),
        message
      ]);
    }

    /**
     * Transform IsFiniteCheck - Number.isFinite(v) -> isfinite(v)
     * IL node: { type: 'IsFiniteCheck', value/argument }
     */
    transformIsFiniteCheck(node) {
      const value = this.transformExpression(node.value || node.argument || (node.arguments && node.arguments[0]));
      return new CCall(new CIdentifier('isfinite'), [value]);
    }

    /**
     * Transform IsNaNCheck - Number.isNaN(v) -> isnan(v)
     * IL node: { type: 'IsNaNCheck', value/argument }
     */
    transformIsNaNCheck(node) {
      const value = this.transformExpression(node.value || node.argument || (node.arguments && node.arguments[0]));
      return new CCall(new CIdentifier('isnan'), [value]);
    }

    /**
     * Transform IsIntegerCheck - Number.isInteger(v) -> floor(v) == v
     * IL node: { type: 'IsIntegerCheck', value/argument }
     */
    transformIsIntegerCheck(node) {
      const value = this.transformExpression(node.value || node.argument || (node.arguments && node.arguments[0]));
      const floorCall = new CCall(new CIdentifier('floor'), [value]);
      return new CBinaryExpression(floorCall, '==', value);
    }

    /**
     * Transform AnsiToBytes - (unsigned char*)str cast
     * IL node: { type: 'AnsiToBytes', value/arguments }
     */
    transformAnsiToBytes(node) {
      const valueNode = node.value || (node.arguments && node.arguments[0]);
      if (!valueNode) return new CCast(new CType('unsigned char*'), CLiteral.String(''));
      const value = this.transformExpression(valueNode);
      return new CCast(new CType('unsigned char*'), value);
    }
  }

  // Export
  const exports = { CTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CTransformer = CTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
