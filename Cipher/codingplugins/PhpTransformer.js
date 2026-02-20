/**
 * PhpTransformer.js - IL AST to PHP AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to PHP AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → PHP AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - strictTypes: Enable strict_types declaration
 *   - namespace: PHP namespace
 *   - addDocBlocks: Include PHPDoc blocks
 *   - useArrowFunctions: Use arrow functions (PHP 7.4+)
 */

(function(global) {
  'use strict';

  // Load dependencies
  let PhpAST;
  if (typeof require !== 'undefined') {
    PhpAST = require('./PhpAST.js');
  } else if (global.PhpAST) {
    PhpAST = global.PhpAST;
  }

  const {
    PhpType, PhpFile, PhpNamespace, PhpUseDeclaration,
    PhpClass, PhpInterface, PhpTrait, PhpEnum, PhpEnumCase,
    PhpProperty, PhpMethod, PhpFunction, PhpParameter,
    PhpBlock, PhpVariableDeclaration, PhpExpressionStatement,
    PhpReturn, PhpIf, PhpFor, PhpForeach, PhpWhile, PhpDoWhile,
    PhpSwitch, PhpSwitchCase, PhpMatch, PhpMatchArm,
    PhpBreak, PhpContinue, PhpTry, PhpCatch, PhpThrow,
    PhpLiteral, PhpVariable, PhpIdentifier, PhpBinaryExpression, PhpUnaryExpression,
    PhpAssignment, PhpPropertyAccess, PhpStaticPropertyAccess, PhpArrayAccess,
    PhpMethodCall, PhpStaticMethodCall, PhpFunctionCall,
    PhpArrayLiteral, PhpNew, PhpTernary, PhpNullCoalescing, PhpShortTernary,
    PhpInstanceof, PhpArrowFunction, PhpClosure, PhpCast,
    PhpStringInterpolation, PhpClassConstant, PhpDocComment, PhpConst, PhpRawCode,
    PhpSpreadElement
  } = PhpAST;

  /**
   * PHP reserved words that need to be escaped
   */
  const PHP_RESERVED_WORDS = new Set([
    'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
    'class', 'clone', 'const', 'continue', 'declare', 'default', 'die', 'do',
    'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach',
    'endif', 'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'final',
    'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if',
    'implements', 'include', 'include_once', 'instanceof', 'insteadof',
    'interface', 'isset', 'list', 'match', 'namespace', 'new', 'or', 'print',
    'private', 'protected', 'public', 'readonly', 'require', 'require_once',
    'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
    'var', 'while', 'xor', 'yield', 'yield_from',
    // Also common functions that might clash
    'true', 'false', 'null', 'self', 'parent'
  ]);

  /**
   * Maps JavaScript/IL types to PHP types
   */
  const TYPE_MAP = {
    // Unsigned integers (PHP doesn't distinguish, map to int)
    'uint8': 'int', 'byte': 'int',
    'uint16': 'int', 'ushort': 'int', 'word': 'int',
    'uint32': 'int', 'uint': 'int', 'dword': 'int',
    'uint64': 'int', 'ulong': 'int', 'qword': 'int',
    // Signed integers
    'int8': 'int', 'sbyte': 'int',
    'int16': 'int', 'short': 'int',
    'int32': 'int', 'int': 'int',
    'int64': 'int', 'long': 'int',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'float', 'float64': 'float',
    // JavaScript number maps to int|float
    'number': 'int',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'string', 'String': 'string',
    'void': 'void',
    'object': 'object',
    'array': 'array',
    'Array': 'array',
    'mixed': 'mixed',
    'null': 'null',
    'never': 'never'
  };

  /**
   * JavaScript AST to PHP AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - strictTypes: boolean - Add declare(strict_types=1). Default: true
   * - addTypeHints: boolean - Add type hints to parameters/returns. Default: true
   * - addDocBlocks: boolean - Add PHPDoc comments. Default: true
   * - useShortArraySyntax: boolean - Use [] instead of array(). Default: true
   * - useNullCoalescing: boolean - Use ?? operator. Default: true
   * - useMatchExpressions: boolean - Use match() instead of switch. Default: true
   * - useArrowFunctions: boolean - Use fn() => syntax. Default: true
   * - useConstructorPromotion: boolean - Use constructor property promotion. Default: true
   * - useReadonlyProperties: boolean - Use readonly keyword. Default: true
   */
  // Framework base classes that need stub packages
  const FRAMEWORK_CLASSES = new Set([
    'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
    'AsymmetricAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'ChecksumAlgorithm',
    'ClassicalCipherAlgorithm', 'CompressionAlgorithm', 'EncodingAlgorithm',
    'EccAlgorithm', 'SpecialAlgorithm',
    'IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance',
    'IAlgorithmInstance'
  ]);

  class PhpTransformer {
    constructor(options = {}) {
      this.options = options;
      this.currentClass = null;
      this.variableTypes = new Map();  // Maps variable name -> PhpType
      this.classFieldTypes = new Map(); // Maps field name -> PhpType
      this.nestedItems = [];
      this.scopeStack = [];
      this.frameworkClasses = new Set(); // Track framework classes for stub generation
      this.declaredConstants = new Map(); // Maps original name -> PHP constant name (SCREAMING_SNAKE_CASE)
      this.arrayProperties = new Set();   // Track properties that hold JS object literals (PHP arrays)
      this.closureVariables = new Set();  // Track variables that hold functions/closures
      this.classInstances = new Set();    // Track variables that are instances of classes (from new X())

      // Enum objects (CategoryType, SecurityStatus, etc.)
      this.ENUM_OBJECTS = new Set([
        'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'
      ]);

      // Framework helper types (KeySize, LinkItem, etc.)
      this.FRAMEWORK_TYPES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase', 'AuthResult'
      ]);

      // Properties that are declared in framework base classes and should not be re-declared
      // These come from Algorithm, IAlgorithmInstance, and their subclasses
      this.BASE_CLASS_PROPERTIES = new Set([
        // From Algorithm base class
        'name', 'tests', 'description', 'inventor', 'year', 'category',
        'subCategory', 'sub_category', 'securityStatus', 'security_status',
        'complexity', 'country', 'documentation', 'references',
        'knownVulnerabilities', 'known_vulnerabilities', 'notes',
        'checksum_size', 'supported_block_sizes', 'supported_key_sizes',
        'block_size', 'supported_tag_sizes', 'supports_detached', 'rounds',
        'supported_nonce_sizes', 'test_vectors', 'sbox', 'round_constants',
        'rounds_config', 'num_rounds', 'key_schedule', 'state_size',
        'is_deterministic', 'is_cryptographically_secure', 'supported_seed_sizes',
        'supported_output_sizes', 'requires_iv', 'supported_iv_sizes',
        'vulnerabilities', 'hash_size', 'variant', 'rate',
        // Additional Algorithm properties from test_vectors_php.js
        'register_a_size', 'register_b_size', 'register_c_size', 'total_state_size',
        'lfsr_count', 'lfsr_lengths', 'sbox_count', 'init_rounds', 'default_lfsr_sizes',
        'max_word_size', 'mask31', 'lfsr_size', 's0', 'd',
        // From IAlgorithmInstance base class
        'algorithm', 'isInverse', 'is_inverse', 'digits', 'key', '_key',
        'iv', '_iv', 'input_buffer', 'key_size', 'nonce', 'round_keys',
        'public_key', 'private_key', 'key_data', 'current_params',
        'associated_data', 'aad', 'alphabet', 'tag_size', 'security_level',
        'output_buffer', 'nonce_size', 'parameter_set', 'state',
        'keystream_buffer', 'buffer_index', 'counter', 'initialized',
        'phi', 'output_size', 'outputSize', 'tag', 'result', 'block_cipher',
        'ready', 'buffer',
        // Additional IAlgorithmInstance single-letter and common properties
        's1', 'n', 'multiplier', 'k', 'tweak', 'x', 'm', 'a', 'b', 'h', 's',
        'length', 'key1', 'increment', 'golden_gamma', 'mix_const_1',
        'supports_continuous_encoding', 'supports_rateless',
        // Single letter properties (i, j, etc. used in RC4/VMPC style algorithms)
        'i', 'j', 'c', 'p', 'q', 'r', 't', 'u', 'v', 'w', 'y', 'z'
      ]);
    }

    /**
     * Generate stub classes for framework base classes
     */
    _generateFrameworkStubs() {
      // Skip framework stubs if runtime provides them (e.g., test harness)
      if (this.options.skipFrameworkStubs)
        return [];

      const stubs = [];

      for (const className of this.frameworkClasses) {
        const phpClass = new PhpClass(className);
        phpClass.properties = [];
        phpClass.methods = [];

        // Add constructor that initializes parent if needed
        const constructor = new PhpMethod('__construct');
        constructor.visibility = 'public';
        constructor.body = new PhpBlock();
        constructor.body.statements = [];
        phpClass.methods.push(constructor);

        stubs.push(phpClass);
      }

      // Also generate helper types that are used but not defined
      for (const typeName of this.FRAMEWORK_TYPES) {
        const phpClass = new PhpClass(typeName);
        phpClass.properties = [];
        phpClass.methods = [];

        const constructor = new PhpMethod('__construct');
        constructor.visibility = 'public';
        constructor.body = new PhpBlock();
        constructor.body.statements = [];
        phpClass.methods.push(constructor);

        stubs.push(phpClass);
      }

      return stubs;
    }

    /**
     * Escape PHP reserved words by appending underscore
     */
    escapeReservedWord(name) {
      if (PHP_RESERVED_WORDS.has(name.toLowerCase())) {
        return name + '_';
      }
      return name;
    }

    /**
     * Convert name to snake_case (PHP convention for functions/variables)
     */
    toSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      // Only insert underscore at lowercase→uppercase transitions (not for ALL_CAPS)
      // Handle sequences like "parseHTMLTag" → "parse_html_tag"
      const snakeCased = str
        .replace(/([a-z])([A-Z])/g, '$1_$2')  // lowercase followed by uppercase
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')  // uppercase sequence followed by capital+lowercase
        .toLowerCase();
      return this.escapeReservedWord(snakeCased);
    }

    /**
     * Convert name to PascalCase (PHP convention for classes)
     */
    toPascalCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str.name || str.id?.name || str);
      const pascalCased = str.charAt(0).toUpperCase() + str.slice(1);
      return this.escapeReservedWord(pascalCased);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (PHP convention for constants)
     */
    toScreamingSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      // Only insert underscore at lowercase→uppercase transitions
      const screaming = str
        .replace(/([a-z])([A-Z])/g, '$1_$2')  // lowercase followed by uppercase
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')  // uppercase sequence followed by capital+lowercase
        .toUpperCase();
      return this.escapeReservedWord(screaming);
    }

    /**
     * Map JavaScript type string to PHP type
     */
    mapType(typeName) {
      if (!typeName) return PhpType.Mixed();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return PhpType.TypedArray(elementType);
      }

      const phpTypeName = TYPE_MAP[typeName] || typeName;

      // Map to PHP types
      const typeMap = {
        'int': PhpType.Int(),
        'float': PhpType.Float(),
        'string': PhpType.String(),
        'bool': PhpType.Bool(),
        'array': PhpType.Array(),
        'object': PhpType.Object(),
        'mixed': PhpType.Mixed(),
        'void': PhpType.Void(),
        'null': PhpType.Null(),
        'callable': PhpType.Callable(),
        'iterable': PhpType.Iterable(),
        'never': PhpType.Never()
      };

      return typeMap[phpTypeName] || new PhpType(phpTypeName);
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
     * Infer PHP type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return PhpType.Mixed();

      const lowerName = name.toLowerCase();

      // Integer-related names (check FIRST - size/length/count/len override other patterns)
      // e.g., key_size, key_len, total_bytes should be int even though they contain 'key'/'bytes'
      // Note: 'bits' is NOT included here - in crypto code, 'bits' is usually an array of bit values
      if (lowerName.includes('size') || lowerName.includes('length') ||
          lowerName.includes('_len') || lowerName.endsWith('len') ||
          lowerName.includes('index') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n' ||
          lowerName === 'rounds' || lowerName === 'shift' ||
          lowerName === 'offset' || lowerName === 'position' ||
          lowerName === 'total' || lowerName.startsWith('num_') ||
          lowerName.includes('_num') || lowerName === 'seed') {
        return PhpType.Int();
      }

      // Array-related names: 'bits' in crypto code means array of bit values (0/1)
      if (lowerName === 'bits') {
        return PhpType.Array();
      }

      // Array-related names (check AFTER size/length patterns)
      // Names that CLEARLY indicate arrays (plural forms, explicit array suffixes)
      // Avoid single words like 'key', 'data', 'block' which might be single elements
      if (lowerName.endsWith('bytes') || lowerName.endsWith('array') ||
          lowerName.endsWith('buffer') || lowerName.endsWith('s') && (
            lowerName.includes('key') || lowerName.includes('word') ||
            lowerName.includes('block') || lowerName.includes('byte')
          ) ||
          lowerName.includes('input_') && lowerName.includes('buffer') ||
          lowerName.includes('output_') && lowerName.includes('buffer') ||
          lowerName === 'state' || lowerName.includes('state_') ||
          lowerName === 'nonce' || lowerName === 'iv' ||
          lowerName === 'counter' || lowerName === 'tag') {
        return PhpType.Array(); // Byte arrays are PHP arrays
      }

      // Single byte names
      // Only match explicit 'byte' parameter name
      // Note: 'b' excluded as it can mean 'block' (array) in crypto code
      if (lowerName === 'byte' || /^b\d$/.test(lowerName)) {
        return PhpType.Int();
      }

      // Single letter names that are typically loop indices
      // Note: 'k' is excluded as it often means 'key' (an array) in crypto code
      if (/^[ijlmn]$/.test(lowerName)) {
        return PhpType.Int();
      }

      // Default to mixed for unknown types - safer than assuming int
      return PhpType.Mixed();
    }

    /**
     * Infer PHP type from a default value expression
     * @param {Object} node - The default value AST node
     * @returns {PhpType|null} The inferred type or null if cannot determine
     */
    inferTypeFromDefaultValue(node) {
      if (!node) return null;

      // Boolean literals
      if (node.type === 'Literal' || node.type === 'BooleanLiteral') {
        if (typeof node.value === 'boolean') return PhpType.Bool();
        if (typeof node.value === 'number') {
          return Number.isInteger(node.value) ? PhpType.Int() : PhpType.Float();
        }
        if (typeof node.value === 'string') return PhpType.String();
        if (node.value === null) return null; // Null doesn't tell us the type
      }

      // Array expressions
      if (node.type === 'ArrayExpression' || node.type === 'ArrayLiteral') {
        return PhpType.Array();
      }

      // Object expressions become arrays in PHP
      if (node.type === 'ObjectExpression' || node.type === 'ObjectLiteral') {
        return PhpType.Array();
      }

      // Identifier for boolean keywords
      if (node.type === 'Identifier') {
        if (node.name === 'true' || node.name === 'false') return PhpType.Bool();
        if (node.name === 'null') return null;
      }

      return null; // Cannot determine type
    }

    /**
     * Transform a JavaScript AST to a PHP AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {PhpFile} PHP AST
     */
    transform(jsAst) {
      const file = new PhpFile();

      // Configure strict types
      if (this.options.strictTypes !== false) {
        file.strictTypes = true;
      }

      // Add namespace if configured
      if (this.options.namespace) {
        file.namespace = new PhpNamespace(this.options.namespace);
      }

      // Add doc comment
      if (this.options.addDocBlocks !== false) {
        const docComment = new PhpDocComment(
          `Generated PHP code\nThis file was automatically generated from JavaScript AST`
        );
        file.items.unshift(docComment);
      }

      // Pre-pass: collect all constant declarations before transforming
      // This ensures identifiers in class methods can reference constants defined later
      if (jsAst.type === 'Program') {
        this._collectConstantsPrepass(jsAst.body);
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, file);
        }
      }

      // Add nested items
      for (const nested of this.nestedItems) {
        file.items.push(nested);
      }

      // Add framework stubs at the beginning (after doc comment if present)
      const stubs = this._generateFrameworkStubs();
      if (stubs.length > 0) {
        // Find insert position (after doc comment if present)
        let insertPos = 0;
        if (file.items.length > 0 && file.items[0].nodeType === 'DocComment')
          insertPos = 1;
        file.items.splice(insertPos, 0, ...stubs);
      }

      return file;
    }

    /**
     * Check if an initializer expression represents a constant value
     * (literal, array, Object.freeze(), etc.)
     * @private
     */
    _isConstantInitializer(initNode) {
      if (!initNode) return false;

      const initType = initNode.type;

      // Literals are always constant
      if (initType === 'Literal') {
        return true;
      }

      // UnaryExpression is constant if operand is constant (e.g., -1, !true)
      if (initType === 'UnaryExpression') {
        return this._isConstantInitializer(initNode.argument);
      }

      // BinaryExpression is constant only if both operands are constant
      // (no function calls like floor(), ceil(), etc.)
      if (initType === 'BinaryExpression') {
        return this._isConstantInitializer(initNode.left) &&
               this._isConstantInitializer(initNode.right);
      }

      // ArrayExpression is constant only if all elements are constants
      if (initType === 'ArrayExpression') {
        if (!initNode.elements || initNode.elements.length === 0) return true;
        return initNode.elements.every(el => {
          if (!el) return true; // sparse array holes
          return this._isConstantInitializer(el);
        });
      }

      // ObjectExpression - PHP constants cannot contain closures
      // Check all property values for functions
      if (initType === 'ObjectExpression') {
        if (!initNode.properties || initNode.properties.length === 0) return true;
        return initNode.properties.every(prop => {
          const valueType = prop.value?.type;
          // Reject if any value is a function
          if (valueType === 'FunctionExpression' ||
              valueType === 'ArrowFunctionExpression' ||
              valueType === 'FunctionDeclaration') {
            return false;
          }
          // Recursively check for nested objects/arrays
          return this._isConstantInitializer(prop.value);
        });
      }

      // Object.freeze([...]) or Object.freeze({...}) pattern
      if (initType === 'CallExpression') {
        const callee = initNode.callee;
        if (callee?.type === 'MemberExpression' &&
            callee.object?.name === 'Object' &&
            callee.property?.name === 'freeze') {
          // Check if argument is a constant array or object literal
          const arg = initNode.arguments?.[0];
          if (arg) {
            return this._isConstantInitializer(arg);
          }
        }
      }

      return false;
    }

    /**
     * Collect all variables that are reassigned in the AST
     * Variables that are reassigned cannot be PHP constants
     * @private
     */
    _collectReassignedVariables(nodes, reassigned = new Set()) {
      for (const node of nodes) {
        this._collectReassignedFromNode(node, reassigned);
      }
      return reassigned;
    }

    /**
     * Recursively find all variables that are reassigned (appear on left side of assignment)
     * @private
     */
    _collectReassignedFromNode(node, reassigned) {
      if (!node) return;

      // Check for assignment expressions to identifiers
      if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
        const leftNode = node.type === 'AssignmentExpression' ? node.left : node.argument;
        if (leftNode?.type === 'Identifier') {
          reassigned.add(leftNode.name);
        }
      }

      // Recursively check all child nodes
      if (Array.isArray(node.body)) {
        for (const child of node.body) {
          this._collectReassignedFromNode(child, reassigned);
        }
      } else if (node.body) {
        this._collectReassignedFromNode(node.body, reassigned);
      }

      // Check expression statements
      if (node.expression) {
        this._collectReassignedFromNode(node.expression, reassigned);
      }

      // Check block statements
      if (node.type === 'BlockStatement' && node.body) {
        for (const stmt of node.body) {
          this._collectReassignedFromNode(stmt, reassigned);
        }
      }

      // Check function/method bodies
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' ||
          node.type === 'ArrowFunctionExpression' || node.type === 'MethodDefinition') {
        const bodyNode = node.body || node.value?.body;
        if (bodyNode) {
          this._collectReassignedFromNode(bodyNode, reassigned);
        }
      }

      // Check if statements
      if (node.type === 'IfStatement') {
        this._collectReassignedFromNode(node.consequent, reassigned);
        if (node.alternate) {
          this._collectReassignedFromNode(node.alternate, reassigned);
        }
        if (node.test) {
          this._collectReassignedFromNode(node.test, reassigned);
        }
      }

      // Check for loops
      if (node.type === 'ForStatement' || node.type === 'WhileStatement' ||
          node.type === 'DoWhileStatement' || node.type === 'ForInStatement' ||
          node.type === 'ForOfStatement') {
        this._collectReassignedFromNode(node.body, reassigned);
        if (node.init) this._collectReassignedFromNode(node.init, reassigned);
        if (node.update) this._collectReassignedFromNode(node.update, reassigned);
        if (node.test) this._collectReassignedFromNode(node.test, reassigned);
      }

      // Check class declarations
      if (node.type === 'ClassDeclaration' && node.body?.body) {
        for (const member of node.body.body) {
          this._collectReassignedFromNode(member, reassigned);
        }
      }

      // Check IIFE wrappers (both as expression statements and plain call expressions)
      if (node.type === 'ExpressionStatement' && node.expression?.type === 'CallExpression') {
        const callee = node.expression.callee;
        if (callee?.type === 'FunctionExpression' || callee?.type === 'ArrowFunctionExpression') {
          this._collectReassignedFromNode(callee, reassigned);
        }
        // Also check arguments (for UMD pattern factory function)
        if (node.expression.arguments) {
          for (const arg of node.expression.arguments) {
            this._collectReassignedFromNode(arg, reassigned);
          }
        }
      }

      // Check CallExpression directly (for IIFEs in variable initializers like `const x = (() => {...})()`)
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee?.type === 'FunctionExpression' || callee?.type === 'ArrowFunctionExpression') {
          this._collectReassignedFromNode(callee, reassigned);
        }
        // Check all arguments
        if (node.arguments) {
          for (const arg of node.arguments) {
            this._collectReassignedFromNode(arg, reassigned);
          }
        }
      }

      // Check VariableDeclaration - look at initializers (including IIFE patterns)
      if (node.type === 'VariableDeclaration' && node.declarations) {
        for (const decl of node.declarations) {
          if (decl.init) {
            this._collectReassignedFromNode(decl.init, reassigned);
          }
        }
      }

      // Check try-catch
      if (node.type === 'TryStatement') {
        this._collectReassignedFromNode(node.block, reassigned);
        if (node.handler) this._collectReassignedFromNode(node.handler.body, reassigned);
        if (node.finalizer) this._collectReassignedFromNode(node.finalizer, reassigned);
      }

      // Check switch statements
      if (node.type === 'SwitchStatement' && node.cases) {
        for (const caseNode of node.cases) {
          if (caseNode.consequent) {
            for (const stmt of caseNode.consequent) {
              this._collectReassignedFromNode(stmt, reassigned);
            }
          }
        }
      }

      // Check return statements
      if (node.type === 'ReturnStatement' && node.argument) {
        this._collectReassignedFromNode(node.argument, reassigned);
      }

      // Check object expressions (object literals may contain functions with assignments)
      if (node.type === 'ObjectExpression' && node.properties) {
        for (const prop of node.properties) {
          if (prop.value) {
            this._collectReassignedFromNode(prop.value, reassigned);
          }
        }
      }

      // Check array expressions
      if (node.type === 'ArrayExpression' && node.elements) {
        for (const elem of node.elements) {
          if (elem) {
            this._collectReassignedFromNode(elem, reassigned);
          }
        }
      }
    }

    /**
     * Pre-pass to collect all constant declarations from the AST
     * This ensures constants are known before transforming class methods that use them
     * @private
     */
    _collectConstantsPrepass(nodes) {
      // First, collect all variables that are reassigned
      this.reassignedVariables = this._collectReassignedVariables(nodes);

      // Then collect constants, excluding reassigned variables
      for (const node of nodes) {
        this._collectConstantsFromNode(node);
      }
    }

    /**
     * Recursively collect constants from a node
     * @private
     */
    _collectConstantsFromNode(node) {
      if (!node) return;

      // Check for variable declarations that will become constants
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (!decl.init || !decl.id || decl.id.type !== 'Identifier') continue;

          const name = decl.id.name;

          // Skip if this variable is reassigned anywhere - cannot be a PHP constant
          if (this.reassignedVariables && this.reassignedVariables.has(name))
            continue;

          // Check if this declaration will be transformed to a constant
          if (this._isConstantInitializer(decl.init)) {
            const phpConstName = this.toScreamingSnakeCase(name);
            this.declaredConstants.set(name, phpConstName);
          }
        }
      }

      // Handle IIFE wrappers - look inside them
      if (node.type === 'ExpressionStatement' && node.expression?.type === 'CallExpression') {
        const callee = node.expression.callee;
        if (callee?.type === 'FunctionExpression' || callee?.type === 'ArrowFunctionExpression') {
          // Collect from IIFE body
          const body = callee.body;
          if (body?.type === 'BlockStatement' && body.body) {
            for (const stmt of body.body) {
              this._collectConstantsFromNode(stmt);
            }
          }
        }
      }

      // Handle array destructuring
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.id?.type === 'ArrayPattern' && decl.init) {
            for (const elem of decl.id.elements) {
              if (elem?.name) {
                // Skip if this variable is reassigned anywhere
                if (this.reassignedVariables && this.reassignedVariables.has(elem.name))
                  continue;
                const phpConstName = this.toScreamingSnakeCase(elem.name);
                this.declaredConstants.set(elem.name, phpConstName);
              }
            }
          }
        }
      }
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
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
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

      // Simple IIFE pattern
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        if (stmt.type === 'ExpressionStatement') continue;
        if (stmt.type === 'ReturnStatement') continue; // Skip module-level returns (UMD pattern)
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
        if (stmt.type === 'IfStatement') continue;
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
        // PHP supports list() unpacking: [$a, $b, $c] = $arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const phpConstName = this.toScreamingSnakeCase(elem.name);
              const indexExpr = new PhpArrayAccess(sourceExpr, PhpLiteral.Int(i));
              const constDecl = new PhpConst(phpConstName, null, indexExpr);
              targetFile.items.push(constDecl);
              // Track constant so references use constant name (no $ prefix)
              this.declaredConstants.set(elem.name, phpConstName);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check if this is a constant (using the same logic as _isConstantInitializer)
        // But skip if the variable is reassigned anywhere - it cannot be a PHP constant
        if (this._isConstantInitializer(decl.init) &&
            !(this.reassignedVariables && this.reassignedVariables.has(name))) {
          const phpConstName = this.toScreamingSnakeCase(name);

          // For Object.freeze(), extract the inner value
          let valueNode = decl.init;
          if (decl.init.type === 'CallExpression' &&
              decl.init.callee?.type === 'MemberExpression' &&
              decl.init.callee.object?.name === 'Object' &&
              decl.init.callee.property?.name === 'freeze') {
            valueNode = decl.init.arguments?.[0] || decl.init;
          }

          // Track constants that are ObjectExpressions as arrays for proper access syntax
          const valueNodeType = valueNode?.type || valueNode?.ilNodeType;
          if (valueNodeType === 'ObjectExpression') {
            this.arrayProperties.add(name);
            this.arrayProperties.add(phpConstName);
          }

          const constDecl = new PhpConst(
            phpConstName,
            this.inferTypeFromValue(valueNode),
            this.transformExpression(valueNode)
          );
          targetFile.items.push(constDecl);
          // Track constant so references use constant name (no $ prefix)
          this.declaredConstants.set(name, phpConstName);
        } else {
          // Non-constant initializer (function call, new expression, etc.)
          // Create a global variable assignment
          const varName = this.toSnakeCase(name);

          // Track module-level variables assigned from object expressions or method calls as arrays
          // JS objects become PHP associative arrays
          const initType = decl.init?.type || decl.init?.ilNodeType;
          if (initType === 'ObjectExpression' ||
              initType === 'CallExpression' ||
              initType === 'ThisMethodCall' ||
              initType === 'MethodCall' ||
              initType === 'StaticMethodCall') {
            // Add both original name and snake_case name to arrayProperties
            this.arrayProperties.add(name);
            this.arrayProperties.add(varName);
          }

          const initializer = this.transformExpression(decl.init);
          const assignment = new PhpAssignment(
            new PhpVariable(varName),
            '=',
            initializer
          );
          targetFile.items.push(new PhpExpressionStatement(assignment));
          // Track as a module-level variable (still uses $ prefix)
          this.moduleVariables = this.moduleVariables || new Set();
          this.moduleVariables.add(name);
        }
      }
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetFile) {
      const funcName = this.toSnakeCase(node.id.name);
      const func = new PhpFunction(funcName);

      // Track function name as module-level (for use as callback references)
      // In PHP, function names used as values need global access
      this.moduleVariables = this.moduleVariables || new Set();
      this.moduleVariables.add(node.id.name);

      // Infer return type from annotation or from return statements
      if (node.returnType) {
        func.returnType = this.mapType(node.returnType);
      } else if (node.body) {
        const hasReturn = this.hasReturnWithValue(node.body);
        if (hasReturn) {
          const returnType = this.inferReturnType(node.body);
          func.returnType = returnType || PhpType.Mixed();
        } else {
          func.returnType = PhpType.Void();
        }
      } else {
        func.returnType = PhpType.Void();
      }

      // Parameters
      const paramNames = new Set();
      if (node.params) {
        for (const param of node.params) {
          // Handle default parameter values (AssignmentPattern in JS AST)
          let actualParam = param;
          let defaultValue = null;

          if (param.type === 'AssignmentPattern') {
            actualParam = param.left;
            defaultValue = this.transformExpression(param.right);
          }

          const paramName = this.toSnakeCase(actualParam.name);
          paramNames.add(actualParam.name);
          let paramType = null;

          // Use typeAnnotation if available
          if (actualParam.typeAnnotation) {
            paramType = this.mapType(actualParam.typeAnnotation);
          } else if (param.type === 'AssignmentPattern' && param.right) {
            // Infer type from default value first (more reliable than name)
            paramType = this.inferTypeFromDefaultValue(param.right) || this.inferTypeFromName(actualParam.name);
          } else {
            paramType = this.inferTypeFromName(actualParam.name);
          }

          const phpParam = new PhpParameter(paramName, paramType);
          if (defaultValue) {
            phpParam.defaultValue = defaultValue;
          }
          func.parameters.push(phpParam);

          this.registerVariableType(actualParam.name, paramType);
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);

        // Find module-level variables and enum objects used in this function and add global statements
        const usedIdentifiers = this._findIdentifiersInNode(node.body);
        const globalStatements = [];
        const addedGlobals = new Set();

        for (const varName of usedIdentifiers) {
          // Skip if it's a parameter (already in scope)
          if (paramNames.has(varName)) continue;

          // Check if it's a module-level variable
          if (this.moduleVariables && this.moduleVariables.has(varName)) {
            const phpVarName = this.toSnakeCase(varName);
            if (!addedGlobals.has(phpVarName)) {
              globalStatements.push(new PhpRawCode(`global $${phpVarName};`));
              addedGlobals.add(phpVarName);
            }
          }

          // Check if it's an enum object (CategoryType, SecurityStatus, etc.)
          if (this.ENUM_OBJECTS.has(varName)) {
            const phpVarName = this.toSnakeCase(varName);
            if (!addedGlobals.has(phpVarName)) {
              globalStatements.push(new PhpRawCode(`global $${phpVarName};`));
              addedGlobals.add(phpVarName);
            }
          }
        }

        // Insert global statements at the beginning of the function body
        if (globalStatements.length > 0 && func.body && func.body.statements) {
          func.body.statements.unshift(...globalStatements);
        }
      }

      targetFile.items.push(func);
    }

    /**
     * Find all identifier names used in a node (for global variable detection)
     * @private
     */
    _findIdentifiersInNode(node, found = new Set()) {
      if (!node) return found;

      if (node.type === 'Identifier') {
        found.add(node.name);
      }

      // Recursively search all properties
      for (const key of Object.keys(node)) {
        if (key === 'type') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const item of value)
            if (item && typeof item === 'object')
              this._findIdentifiersInNode(item, found);
        } else if (value && typeof value === 'object') {
          this._findIdentifiersInNode(value, found);
        }
      }

      return found;
    }

    /**
     * Transform a class declaration to PHP class
     */
    transformClassDeclaration(node, targetFile) {
      const className = this.toPascalCase(node.id.name);
      const phpClass = new PhpClass(className);

      // Handle inheritance
      if (node.superClass) {
        let superClassName;
        if (node.superClass.type === 'MemberExpression') {
          // Handle AlgorithmFramework.BlockCipherAlgorithm -> BlockCipherAlgorithm
          superClassName = node.superClass.property?.name || node.superClass.property;
        } else {
          superClassName = node.superClass.name || node.superClass.id?.name || node.superClass;
        }
        phpClass.extendsClass = this.toPascalCase(superClassName);

        // Track framework classes for stub generation
        if (superClassName && FRAMEWORK_CLASSES.has(superClassName))
          this.frameworkClasses.add(superClassName);
      }

      const prevClass = this.currentClass;
      this.currentClass = phpClass;

      // Pre-pass: collect all properties used across all methods
      // This ensures all this.x assignments result in declared properties
      const allPropertyUsages = this.extractAllClassProperties(node);
      const declaredProperties = new Set();

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

      // Track used method names to avoid collisions
      // Cases: setter "set key()" and method "SetKey()" both becoming "set_key"
      // Cases: "get Key()" and "get key()" both becoming "get_key" (JS is case-sensitive, PHP snake_case isn't)
      const usedMethodNames = new Set(['__construct']);

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Constructor: extract properties and create constructor
              const { properties, initStatements } = this.extractPropertiesFromConstructor(member);

              for (const prop of properties) {
                phpClass.properties.push(prop);
                declaredProperties.add(prop.name);
              }

              const ctor = this.transformConstructor(member, className, initStatements);
              phpClass.methods.push(ctor);
            } else if (member.kind === 'get') {
              // Getter: transform to get_property_name() method
              const method = this.transformGetterMethod(member);
              // Skip if this would be a duplicate (e.g., JS has both "get Key()" and "get key()")
              if (!usedMethodNames.has(method.name)) {
                usedMethodNames.add(method.name);
                phpClass.methods.push(method);
              }
            } else if (member.kind === 'set') {
              // Setter: transform to set_property_name() method
              const method = this.transformSetterMethod(member);
              // Skip if this would be a duplicate (e.g., JS has both "set Key()" and "set key()")
              if (!usedMethodNames.has(method.name)) {
                usedMethodNames.add(method.name);
                phpClass.methods.push(method);
              }
            } else {
              // Regular method - check for name collision with getter/setter
              const method = this.transformMethodDefinition(member);
              // If the method name would collide with a getter/setter, rename it
              if (usedMethodNames.has(method.name)) {
                method.name = method.name + '_impl';
              }
              usedMethodNames.add(method.name);
              phpClass.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') {
            // Field - skip duplicates (e.g., JS "lstar" and "Lstar" both becoming "$lstar")
            // Note: 'FieldDefinition' is from TypeAwareJSASTParser, 'PropertyDefinition' from acorn
            const property = this.transformPropertyDefinition(member);
            if (!declaredProperties.has(property.name)) {
              phpClass.properties.push(property);
              declaredProperties.add(property.name);
            }
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> PHP doesn't have static class blocks
            // Transform to statements in a static initialization method or skip
            const initStatements = this.transformStaticBlock(member);
            if (initStatements && initStatements.length > 0) {
              phpClass.staticInitStatements = phpClass.staticInitStatements || [];
              phpClass.staticInitStatements.push(...initStatements);
            }
          }
        }
      }

      // Add any properties that were used but not declared
      // This prevents "Creation of dynamic property" deprecation warnings in PHP 8.2+
      // DEBUG: console.error('Class:', className, 'allPropertyUsages:', allPropertyUsages.size, 'declared:', declaredProperties.size);
      for (const [propName, propType] of allPropertyUsages) {
        // Preserve ALL_CAPS property names, convert others to snake_case
        const isAllCaps = /^[A-Z][A-Z0-9_]*$/.test(propName);
        let snakeName = isAllCaps ? propName : this.toSnakeCase(propName);
        if (snakeName.startsWith('_')) snakeName = snakeName.substring(1);

        // Also try the original name (without snake_case conversion)
        const origSnakeName = snakeName;

        // Skip properties inherited from base classes to avoid type/visibility conflicts
        if (this.BASE_CLASS_PROPERTIES.has(snakeName) ||
            this.BASE_CLASS_PROPERTIES.has(propName)) {
          continue;
        }

        if (!declaredProperties.has(snakeName)) {
          // Determine appropriate type and default value
          let finalType = propType || PhpType.Mixed();
          let defaultValue;

          if (propType && propType.name === 'array') {
            // Arrays can have empty array default
            defaultValue = new PhpArrayLiteral([]);
          } else {
            // All other types get null default, which requires nullable type
            defaultValue = PhpLiteral.Null();
            // Make type nullable if it's not already and is not 'mixed'
            if (finalType.name !== 'mixed' && !finalType.nullable) {
              finalType = PhpType.Nullable(finalType);
            }
          }

          const property = new PhpProperty(snakeName, finalType);
          property.visibility = propName.startsWith('_') ? 'private' : 'public';
          property.defaultValue = defaultValue;
          phpClass.properties.push(property);
          declaredProperties.add(snakeName);
          // DEBUG: console.error('  Added property:', snakeName, 'from', propName);
        }
      }

      this.currentClass = prevClass;

      targetFile.items.push(phpClass);
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      // Handle both standard AST (MemberExpression with ThisExpression) and
      // TypeAware AST (ThisPropertyAccess)
      if (expr.left.type === 'ThisPropertyAccess') return true;
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Recursively find all this.property assignments in a node
     * Also tracks local variables assigned from object expressions/method calls
     * so that subsequent this.X = localVar['prop'] can be detected
     */
    findThisPropertyAssignments(node, found = new Map()) {
      if (!node) return found;

      // Track local variable declarations assigned from objects/method calls
      // This enables detecting this.X = localVar['prop'] where localVar is an object
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations || []) {
          if (decl.id?.name && decl.init) {
            const initType = decl.init.type || decl.init.ilNodeType;
            if (initType === 'ObjectExpression' ||
                initType === 'CallExpression' ||
                initType === 'ThisMethodCall' ||
                initType === 'MethodCall' ||
                initType === 'StaticMethodCall') {
              this.arrayProperties.add(decl.id.name);
              this.arrayProperties.add(this.toSnakeCase(decl.id.name));
            }
          }
        }
      }

      // Check if this is a this.property = value assignment
      // Handle both standard AST (MemberExpression with ThisExpression) and
      // TypeAware AST (ThisPropertyAccess)
      if (node.type === 'AssignmentExpression') {
        let propName = null;

        // Standard AST: MemberExpression with ThisExpression
        if (node.left?.type === 'MemberExpression' &&
            node.left?.object?.type === 'ThisExpression') {
          propName = node.left.property?.name || node.left.property?.value;
        }
        // TypeAware AST: ThisPropertyAccess
        // The property field can be either a string or an object with a name property
        else if (node.left?.type === 'ThisPropertyAccess') {
          propName = typeof node.left.property === 'string'
            ? node.left.property
            : (node.left.property?.name || node.left.propertyName || node.left.name);
        }

        if (propName) {
          // Track array property assignments BEFORE the found.has check
          // A property can be assigned null initially and then assigned from a method call later
          // We need to detect ALL CallExpression/ObjectExpression assignments, not just the first one
          const rightType = node.right?.type || node.right?.ilNodeType;

          // Check if right side is a member expression (property access) on a known array/object
          // Both computed (arr['prop']) and non-computed (arr.prop) should be handled
          // If accessing a property of a known array/object, the result is also an array/object
          let isArrayElementAccess = false;
          if (rightType === 'MemberExpression') {
            // Check for direct identifier (e.g., keyPair.privateKey)
            let baseVar = node.right.object?.name ||
                          (node.right.object?.type === 'Identifier' ? node.right.object.name : null);

            // Also handle this.property access (e.g., this.HQC_PARAMS[key])
            if (!baseVar && node.right.object?.type === 'MemberExpression' &&
                node.right.object.object?.type === 'ThisExpression') {
              baseVar = node.right.object.property?.name || node.right.object.property?.value;
            }
            // Also handle ThisPropertyAccess (TypeAware AST)
            if (!baseVar && node.right.object?.type === 'ThisPropertyAccess') {
              baseVar = node.right.object.propertyName || node.right.object.property?.name || node.right.object.property;
            }

            if (baseVar) {
              const snakeBaseVar = this.toSnakeCase(baseVar);
              isArrayElementAccess = this.arrayProperties.has(baseVar) ||
                                     this.arrayProperties.has(snakeBaseVar);
            }
          }

          // Check if right side is an identifier that's already tracked as an array
          // This handles: this.tables = RijndaelTables (where RijndaelTables is tracked)
          let isKnownArrayIdentifier = false;
          if (rightType === 'Identifier' && node.right.name) {
            isKnownArrayIdentifier = this.arrayProperties.has(node.right.name) ||
                                     this.arrayProperties.has(this.toSnakeCase(node.right.name));
          }

          if (rightType === 'ObjectExpression' ||
              rightType === 'CallExpression' ||
              rightType === 'ThisMethodCall' ||
              rightType === 'MethodCall' ||
              rightType === 'StaticMethodCall' ||
              isArrayElementAccess ||
              isKnownArrayIdentifier) {
            this.arrayProperties.add(propName);
          }

          // Only add to found if not already present (for type inference)
          if (!found.has(propName)) {
            // Try to infer type from the assigned value
            let inferredType = this.inferTypeFromValue(node.right);
            // Check for null initialization
            if (node.right?.type === 'Literal' && node.right?.value === null) {
              const baseType = this.inferTypeFromName(propName);
              // mixed already includes null, cannot be made nullable
              inferredType = baseType.name === 'mixed' ? baseType : PhpType.Nullable(baseType);
            }
            found.set(propName, inferredType);
          }
        }
      }

      // Recursively search in all properties
      for (const key of Object.keys(node)) {
        if (key === 'type') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              this.findThisPropertyAssignments(item, found);
            }
          }
        } else if (value && typeof value === 'object') {
          this.findThisPropertyAssignments(value, found);
        }
      }

      return found;
    }

    /**
     * Extract all properties used in a class from all methods
     */
    extractAllClassProperties(classNode) {
      const allProperties = new Map();

      const members = classNode.body?.body || classNode.body || [];

      for (const member of members) {
        if (member.type === 'MethodDefinition') {
          const methodBody = member.value?.body;
          if (methodBody) {
            this.findThisPropertyAssignments(methodBody, allProperties);
          }
        }
      }

      return allProperties;
    }

    /**
     * Extract properties from constructor's this.x = y assignments
     */
    extractPropertiesFromConstructor(node) {
      const properties = [];
      const initStatements = [];
      const seenProperties = new Set(); // Track properties to avoid duplicates (e.g., this.x = 1; this.x = 2;)

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return { properties, initStatements };

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          // Handle both standard AST and TypeAware AST
          let propName;
          if (expr.left.type === 'ThisPropertyAccess') {
            propName = typeof expr.left.property === 'string'
              ? expr.left.property
              : (expr.left.property?.name || expr.left.propertyName || expr.left.name);
          } else {
            propName = expr.left.property.name || expr.left.property.value;
          }
          const isPrivate = propName && propName.startsWith('_');

          // Preserve ALL_CAPS property names, convert others to snake_case
          const isAllCaps = propName && /^[A-Z][A-Z0-9_]*$/.test(propName);
          let fieldName = isAllCaps ? propName : this.toSnakeCase(propName || '');
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          const value = expr.right;
          let fieldType = this.inferTypeFromValue(value);

          // Check for type annotation
          if (value.typeAnnotation) {
            fieldType = this.mapType(value.typeAnnotation);
          }

          // Handle null initializations
          if (value.type === 'Literal' && value.value === null) {
            const baseType = this.inferTypeFromName(propName);
            // mixed already includes null, cannot be made nullable
            fieldType = baseType.name === 'mixed' ? baseType : PhpType.Nullable(baseType);
          }

          // Skip properties inherited from base classes to avoid type conflicts
          if (this.BASE_CLASS_PROPERTIES.has(fieldName) ||
              this.BASE_CLASS_PROPERTIES.has(propName)) {
            continue;
          }

          // Skip if this property was already declared (duplicate assignments in constructor)
          if (!seenProperties.has(fieldName)) {
            seenProperties.add(fieldName);
            const property = new PhpProperty(fieldName, fieldType);
            property.visibility = isPrivate ? 'private' : 'public';
            properties.push(property);
            this.classFieldTypes.set(fieldName, fieldType);
          }

          initStatements.push(stmt);
        }
      }

      return { properties, initStatements };
    }

    /**
     * Transform a constructor
     */
    transformConstructor(node, className, fieldInitStatements = []) {
      const ctor = new PhpMethod('__construct');
      ctor.returnType = null; // Constructors don't have return types

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          // Handle default parameter values:
          // - Standard AST uses AssignmentPattern with left/right
          // - TypeAware AST puts defaultValue directly on Identifier
          let actualParam = param;
          let defaultValue = null;

          if (param.type === 'AssignmentPattern') {
            actualParam = param.left;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            // TypeAware AST format: defaultValue is directly on the param
            defaultValue = this.transformExpression(param.defaultValue);
          }

          const paramName = this.toSnakeCase(actualParam.name);
          let paramType = null;

          if (actualParam.typeAnnotation) {
            paramType = this.mapType(actualParam.typeAnnotation);
          } else if (param.type === 'AssignmentPattern' && param.right) {
            paramType = this.inferTypeFromDefaultValue(param.right) || this.inferTypeFromName(actualParam.name);
          } else if (param.defaultValue) {
            paramType = this.inferTypeFromDefaultValue(param.defaultValue) || this.inferTypeFromName(actualParam.name);
          } else {
            paramType = this.inferTypeFromName(actualParam.name);
          }

          const phpParam = new PhpParameter(paramName, paramType);
          if (defaultValue) {
            phpParam.defaultValue = defaultValue;
          }
          ctor.parameters.push(phpParam);

          this.registerVariableType(actualParam.name, paramType);
        }
      }

      // Body
      const body = new PhpBlock();

      if (node.value && node.value.body && node.value.body.type === 'BlockStatement') {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            // Transform property assignment
            const expr = stmt.expression;
            // Handle both standard AST and TypeAware AST
            let propName;
            if (expr.left.type === 'ThisPropertyAccess') {
              propName = typeof expr.left.property === 'string'
                ? expr.left.property
                : (expr.left.property?.name || expr.left.propertyName || expr.left.name);
            } else {
              propName = expr.left.property.name || expr.left.property.value;
            }
            // Preserve ALL_CAPS property names, convert others to snake_case
            const isAllCaps = /^[A-Z][A-Z0-9_]*$/.test(propName);
            let fieldName = isAllCaps ? propName : this.toSnakeCase(propName);
            if (fieldName.startsWith('_'))
              fieldName = fieldName.substring(1);

            const target = new PhpPropertyAccess(
              new PhpVariable('this'),
              fieldName
            );
            const value = this.transformExpression(expr.right);
            const assignment = new PhpAssignment(target, '=', value);
            body.statements.push(new PhpExpressionStatement(assignment));
          } else {
            // Transform other statements
            const phpStmt = this.transformStatement(stmt);
            if (phpStmt) {
              if (Array.isArray(phpStmt))
                body.statements.push(...phpStmt);
              else
                body.statements.push(phpStmt);
            }
          }
        }
      }

      // Find module-level variables and enum objects used in constructor and add global statements
      if (node.value && node.value.body) {
        const usedIdentifiers = this._findIdentifiersInNode(node.value.body);
        const globalStatements = [];
        const addedGlobals = new Set();

        // Collect parameter names to exclude from global statements
        const paramNames = new Set();
        if (node.value.params) {
          for (const param of node.value.params) {
            let pName = param.type === 'AssignmentPattern' ? param.left.name : param.name;
            if (pName) paramNames.add(pName);
          }
        }

        for (const varName of usedIdentifiers) {
          // Skip if it's a parameter (already in scope)
          if (paramNames.has(varName)) continue;

          // Check if it's a module-level variable
          if (this.moduleVariables && this.moduleVariables.has(varName)) {
            const phpVarName = this.toSnakeCase(varName);
            if (!addedGlobals.has(phpVarName)) {
              globalStatements.push(new PhpRawCode(`global $${phpVarName};`));
              addedGlobals.add(phpVarName);
            }
          }

          // Check if it's an enum object (CategoryType, SecurityStatus, etc.)
          if (this.ENUM_OBJECTS.has(varName)) {
            const phpVarName = this.toSnakeCase(varName);
            if (!addedGlobals.has(phpVarName)) {
              globalStatements.push(new PhpRawCode(`global $${phpVarName};`));
              addedGlobals.add(phpVarName);
            }
          }
        }

        // Insert global statements at the beginning of the constructor body
        if (globalStatements.length > 0 && body.statements) {
          body.statements.unshift(...globalStatements);
        }
      }

      ctor.body = body;
      return ctor;
    }

    /**
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toSnakeCase(node.key.name);
      const method = new PhpMethod(methodName);

      // Visibility
      method.visibility = 'public';
      if (node.static) {
        method.isStatic = true;
      }

      // Return type from annotation or inference
      if (node.value && node.value.returnType) {
        method.returnType = this.mapType(node.value.returnType);
      } else if (node.value && node.value.body) {
        const hasReturn = this.hasReturnWithValue(node.value.body);
        if (hasReturn) {
          const returnType = this.inferReturnType(node.value.body);
          if (returnType) {
            method.returnType = returnType;
          } else {
            method.returnType = PhpType.Void();
          }
        } else {
          method.returnType = PhpType.Void();
        }
      } else {
        method.returnType = PhpType.Void();
      }

      // Parameters
      const paramNames = new Set();
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          // Handle default parameter values:
          // - Standard AST uses AssignmentPattern with left/right
          // - TypeAware AST puts defaultValue directly on Identifier
          let actualParam = param;
          let defaultValue = null;

          if (param.type === 'AssignmentPattern') {
            actualParam = param.left;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            // TypeAware AST format: defaultValue is directly on the param
            defaultValue = this.transformExpression(param.defaultValue);
          }

          const paramName = this.toSnakeCase(actualParam.name);
          paramNames.add(actualParam.name);
          let paramType = null;

          if (actualParam.typeAnnotation) {
            paramType = this.mapType(actualParam.typeAnnotation);
          } else if (param.type === 'AssignmentPattern' && param.right) {
            paramType = this.inferTypeFromDefaultValue(param.right) || this.inferTypeFromName(actualParam.name);
          } else if (param.defaultValue) {
            paramType = this.inferTypeFromDefaultValue(param.defaultValue) || this.inferTypeFromName(actualParam.name);
          } else {
            paramType = this.inferTypeFromName(actualParam.name);
          }

          const phpParam = new PhpParameter(paramName, paramType);
          if (defaultValue) {
            phpParam.defaultValue = defaultValue;
          }
          method.parameters.push(phpParam);

          this.registerVariableType(actualParam.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        // BEFORE transforming body, detect which array parameters are modified
        // and mark them as pass-by-reference
        for (const phpParam of method.parameters) {
          // Only check array-type parameters (most common case needing reference)
          const paramType = phpParam.type;
          const typeName = paramType?.name || (typeof paramType === 'string' ? paramType : '');
          const isArrayType = paramType && (
            typeName === 'array' ||
            (paramType.isArray && paramType.isArray()) ||
            typeName === 'mixed' // mixed could be array
          );

          // Single-letter params like s, k, t, v are often state arrays in crypto code
          const isSingleLetterParam = phpParam.name.length === 1 && /^[a-z]$/.test(phpParam.name);
          // Also check common array param names
          const lowerName = phpParam.name.toLowerCase();
          const isLikelyArrayParam = isSingleLetterParam ||
            lowerName.includes('state') || lowerName.includes('block') ||
            lowerName.includes('key') || lowerName.includes('data') ||
            lowerName.includes('input') || lowerName.includes('output') ||
            lowerName.includes('buffer') || lowerName.includes('bytes') ||
            lowerName.includes('arr') || lowerName === 'ka' || lowerName === 'kb';

          // Find original JS param name (reverse the snake_case)
          let originalName = null;
          for (const param of node.value.params) {
            const p = param.type === 'AssignmentPattern' ? param.left : param;
            if (this.toSnakeCase(p.name) === phpParam.name) {
              originalName = p.name;
              break;
            }
          }

          // Use _isArrayElementModifiedInBody to specifically detect arr[i] = x patterns
          // Direct reassignment like k = k % 31 should NOT trigger pass-by-reference
          if (originalName && this._isArrayElementModifiedInBody(originalName, node.value.body)) {
            // If array or likely-array parameter has its ELEMENTS modified, pass by reference
            if (isArrayType || isLikelyArrayParam) {
              phpParam.isReference = true;
            }
          }
        }

        method.body = this.transformBlockStatement(node.value.body);

        // Find module-level variables and enum objects used in this method and add global statements
        const usedIdentifiers = this._findIdentifiersInNode(node.value.body);
        const globalStatements = [];
        const addedGlobals = new Set();

        for (const varName of usedIdentifiers) {
          // Skip if it's a parameter (already in scope)
          if (paramNames.has(varName)) continue;

          // Check if it's a module-level variable
          if (this.moduleVariables && this.moduleVariables.has(varName)) {
            const phpVarName = this.toSnakeCase(varName);
            if (!addedGlobals.has(phpVarName)) {
              globalStatements.push(new PhpRawCode(`global $${phpVarName};`));
              addedGlobals.add(phpVarName);
            }
          }

          // Check if it's an enum object (CategoryType, SecurityStatus, etc.)
          // These are defined in the stub file and need global access in methods
          if (this.ENUM_OBJECTS.has(varName)) {
            const phpVarName = this.toSnakeCase(varName);
            if (!addedGlobals.has(phpVarName)) {
              globalStatements.push(new PhpRawCode(`global $${phpVarName};`));
              addedGlobals.add(phpVarName);
            }
          }
        }

        // Insert global statements at the beginning of the method body
        if (globalStatements.length > 0 && method.body && method.body.statements) {
          method.body.statements.unshift(...globalStatements);
        }
      }

      return method;
    }

    /**
     * Transform a getter method definition to get_property_name()
     * JavaScript: get key() { return this._key; }
     * PHP:        public function get_key(): mixed { return $this->_key; }
     */
    transformGetterMethod(node) {
      const propertyName = this.toSnakeCase(node.key.name);
      const methodName = 'get_' + propertyName;
      const method = new PhpMethod(methodName);

      method.visibility = 'public';
      if (node.static) {
        method.isStatic = true;
      }

      // Return type from annotation or inference
      if (node.value && node.value.returnType) {
        method.returnType = this.mapType(node.value.returnType);
      } else if (node.value && node.value.body) {
        const returnType = this.inferReturnType(node.value.body);
        method.returnType = returnType || PhpType.Mixed();
      } else {
        method.returnType = PhpType.Mixed();
      }

      // No parameters for getters

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      return method;
    }

    /**
     * Transform a setter method definition to set_property_name(value)
     * JavaScript: set key(value) { this._key = value; }
     * PHP:        public function set_key($value): void { $this->_key = $value; }
     */
    transformSetterMethod(node) {
      const propertyName = this.toSnakeCase(node.key.name);
      const methodName = 'set_' + propertyName;
      const method = new PhpMethod(methodName);

      method.visibility = 'public';
      if (node.static) {
        method.isStatic = true;
      }

      // Setters return void
      method.returnType = PhpType.Void();

      // Parameters (setter has one parameter)
      if (node.value && node.value.params && node.value.params.length > 0) {
        for (const param of node.value.params) {
          // Handle default parameter values:
          // - Standard AST uses AssignmentPattern with left/right
          // - TypeAware AST puts defaultValue directly on Identifier
          let actualParam = param;
          let defaultValue = null;

          if (param.type === 'AssignmentPattern') {
            actualParam = param.left;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            // TypeAware AST format: defaultValue is directly on the param
            defaultValue = this.transformExpression(param.defaultValue);
          }

          const paramName = this.toSnakeCase(actualParam.name);
          let paramType = null;

          if (actualParam.typeAnnotation) {
            paramType = this.mapType(actualParam.typeAnnotation);
          } else if (param.type === 'AssignmentPattern' && param.right) {
            paramType = this.inferTypeFromDefaultValue(param.right) || this.inferTypeFromName(actualParam.name) || PhpType.Mixed();
          } else if (param.defaultValue) {
            paramType = this.inferTypeFromDefaultValue(param.defaultValue) || this.inferTypeFromName(actualParam.name) || PhpType.Mixed();
          } else {
            // Try to infer from property name or use mixed
            paramType = this.inferTypeFromName(actualParam.name) || PhpType.Mixed();
          }

          const phpParam = new PhpParameter(paramName, paramType);
          if (defaultValue) {
            phpParam.defaultValue = defaultValue;
          }
          method.parameters.push(phpParam);

          this.registerVariableType(actualParam.name, paramType);
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
     * NOTE: Does not recurse into nested function/arrow expressions,
     * only checks returns at the current function scope
     */
    hasReturnWithValue(bodyNode) {
      if (!bodyNode) return false;

      // Types that introduce a new scope - don't recurse into these
      const nestedFunctionTypes = new Set([
        'FunctionExpression',
        'ArrowFunctionExpression',
        'FunctionDeclaration',
        'MethodDefinition'
      ]);

      const check = (node) => {
        if (!node) return false;
        if (node.type === 'ReturnStatement' && node.argument) return true;

        // Don't recurse into nested functions - their returns don't affect outer scope
        if (nestedFunctionTypes.has(node.type)) return false;

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
     * NOTE: Does not recurse into nested function/arrow expressions,
     * only checks returns at the current function scope
     */
    inferReturnType(bodyNode) {
      if (!bodyNode) return null;

      // Types that introduce a new scope - don't recurse into these
      const nestedFunctionTypes = new Set([
        'FunctionExpression',
        'ArrowFunctionExpression',
        'FunctionDeclaration',
        'MethodDefinition'
      ]);

      const returnTypes = [];
      const hasNullReturn = { value: false };
      const collect = (node) => {
        if (!node) return;
        if (node.type === 'ReturnStatement') {
          if (!node.argument || (node.argument.type === 'Literal' && node.argument.value === null)) {
            hasNullReturn.value = true;
          } else {
            returnTypes.push(this.inferTypeFromValue(node.argument));
          }
        }

        // Don't recurse into nested functions - their returns don't affect outer scope
        if (nestedFunctionTypes.has(node.type)) return;

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

      if (returnTypes.length === 0) {
        return hasNullReturn.value ? PhpType.Null() : null;
      }

      // Get the first non-null return type
      const primaryType = returnTypes[0];

      // If there's also a null return, make it nullable
      if (hasNullReturn.value) {
        // If the type is already nullable or mixed, return as-is
        if (primaryType.name === 'mixed' || primaryType.name === 'null' || primaryType.isNullable) {
          return primaryType;
        }
        return PhpType.Nullable(primaryType);
      }

      return primaryType;
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const rawName = node.key.name;
      // Preserve ALL_CAPS property names, convert others to snake_case
      const isAllCaps = /^[A-Z][A-Z0-9_]*$/.test(rawName);
      const propertyName = isAllCaps ? rawName : this.toSnakeCase(rawName);
      let propertyType = PhpType.Mixed();

      if (node.value) {
        if (node.value.typeAnnotation) {
          propertyType = this.mapType(node.value.typeAnnotation);
        } else {
          propertyType = this.inferTypeFromValue(node.value);
        }
      }

      const property = new PhpProperty(propertyName, propertyType);
      this.classFieldTypes.set(propertyName, propertyType);

      // Handle static properties
      if (node.static) {
        property.isStatic = true;
      }

      // Set default value if present
      if (node.value) {
        property.defaultValue = this.transformExpression(node.value);
      }

      // Handle visibility (private/public based on name convention)
      property.visibility = rawName.startsWith('_') ? 'private' : 'public';

      return property;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> PHP module-level statements
      // PHP doesn't have static class blocks, so transform to statements
      // node.body is a BlockStatement, so access its body property
      const statements = node.body?.body || node.body || [];
      if (Array.isArray(statements)) {
        return statements.map(stmt => this.transformStatement(stmt)).filter(s => s);
      }
      return [];
    }

    transformClassExpression(node) {
      // ClassExpression -> PHP anonymous class (PHP 7+)
      // For now, return a comment placeholder as PhpAnonymousClass is not defined
      // This is rarely used in cryptographic code
      return new PhpIdentifier('/* Anonymous class not yet supported */');
    }

    transformYieldExpression(node) {
      // PHP has yield for generators - return argument for now
      const argument = node.argument ? this.transformExpression(node.argument) : PhpLiteral.Null();
      return argument;
    }

    /**
     * Infer PHP type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return PhpType.Mixed();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              return PhpType.Int();
            }
            return PhpType.Float();
          }
          if (typeof valueNode.value === 'string') return PhpType.String();
          if (typeof valueNode.value === 'boolean') return PhpType.Bool();
          if (valueNode.value === null) return PhpType.Null();
          return PhpType.Mixed();

        case 'ArrayExpression':
          return PhpType.Array();

        case 'CallExpression': {
          // Check if this is a string-returning function
          const funcName = valueNode.callee?.name ||
                           valueNode.callee?.property?.name ||
                           valueNode.name;

          // Functions that return strings
          const stringFunctions = ['substr', 'substring', 'slice', 'charAt', 'trim',
                                   'toLowerCase', 'toUpperCase', 'toString', 'replace',
                                   'concat', 'repeat', 'padStart', 'padEnd',
                                   'String', 'fromCharCode', 'chr', 'strtolower', 'strtoupper',
                                   'hex2bin', 'bin2hex', 'str_repeat', 'implode', 'join',
                                   'preg_replace', 'str_replace', 'ltrim', 'rtrim', 'chop',
                                   'ucfirst', 'lcfirst', 'ucwords', 'strrev', 'str_pad'];
          // Functions that return arrays (split returns array, not string)
          const arrayFunctions = ['split', 'explode', 'array_map', 'array_filter',
                                  'array_values', 'array_keys', 'Array', 'Object.keys',
                                  'Object.values', 'Object.entries', 'preg_split',
                                  'preg_match_all', 'str_split', 'range', 'array_fill'];

          if (funcName && arrayFunctions.includes(funcName))
            return PhpType.Array();
          if (funcName && stringFunctions.includes(funcName))
            return PhpType.String();

          return PhpType.Mixed();
        }

        case 'BinaryExpression':
          // String concatenation
          if (valueNode.operator === '+') {
            // Check if either operand is a string
            const leftType = this.inferTypeFromValue(valueNode.left);
            const rightType = this.inferTypeFromValue(valueNode.right);
            if (leftType.name === 'string' || rightType.name === 'string') {
              return PhpType.String();
            }
          }
          return PhpType.Mixed();

        default:
          return PhpType.Mixed();
      }
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new PhpBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const phpStmt = this.transformStatement(stmt);
          if (phpStmt) {
            if (Array.isArray(phpStmt)) {
              block.statements.push(...phpStmt);
            } else {
              block.statements.push(phpStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement (16 critical statement types)
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
          return new PhpBreak();

        case 'ContinueStatement':
          return new PhpContinue();

        case 'EmptyStatement':
          return null;

        default:
          return null;
      }
    }

    /**
     * Transform a variable declaration statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = this.toSnakeCase(decl.id.name);
        let varType = null;
        let initializer = null;

        if (decl.init) {
          // Track local variables assigned from method calls or object expressions as arrays
          // JS objects and method-returned objects become PHP associative arrays
          const initType = decl.init.type || decl.init.ilNodeType;

          // Check if init is a computed member expression (array element access)
          const isArrayAccess = initType === 'MemberExpression' && decl.init.computed;
          let isArrayElementAccess = false;

          if (isArrayAccess) {
            // Check if any part of the chain originates from this.property or an identifier
            // This handles patterns like this.keySchedule['roundKeys'][round]
            let checkObj = decl.init.object;
            while (checkObj) {
              if (checkObj.type === 'ThisExpression' ||
                  checkObj.type === 'Identifier' ||
                  checkObj.type === 'ThisPropertyAccess') {
                // ThisPropertyAccess is a terminal - it represents this.propertyName
                // and doesn't have an .object property
                isArrayElementAccess = true;
                break;
              }
              if (checkObj.type === 'MemberExpression') {
                checkObj = checkObj.object;
              } else {
                break;
              }
            }
          }

          // Check if init is a property access on 'this' that's a known array
          // E.g., const params = this.current_params (where current_params is an array)
          let isKnownArrayProperty = false;
          if (initType === 'MemberExpression' && decl.init.object?.type === 'ThisExpression') {
            const propName = decl.init.property?.name || decl.init.property?.value;
            if (propName) {
              isKnownArrayProperty = this.arrayProperties.has(propName) ||
                                     this.arrayProperties.has(this.toSnakeCase(propName));
            }
          }
          if (initType === 'ThisPropertyAccess') {
            const propName = decl.init.propertyName || decl.init.property?.name ||
                           (typeof decl.init.property === 'string' ? decl.init.property : null);
            if (propName) {
              isKnownArrayProperty = this.arrayProperties.has(propName) ||
                                     this.arrayProperties.has(this.toSnakeCase(propName));
            }
          }
          // Check if init is a known identifier that's an array
          let isKnownArrayIdentifier = false;
          if (initType === 'Identifier' && decl.init.name) {
            isKnownArrayIdentifier = this.arrayProperties.has(decl.init.name) ||
                                     this.arrayProperties.has(this.toSnakeCase(decl.init.name));
          }

          if (initType === 'ObjectExpression' ||
              initType === 'CallExpression' ||
              initType === 'ThisMethodCall' ||
              initType === 'MethodCall' ||
              initType === 'StaticMethodCall' ||
              isArrayElementAccess ||
              isKnownArrayProperty ||
              isKnownArrayIdentifier) {
            // Add both original name and snake_case name to arrayProperties
            this.arrayProperties.add(decl.id.name);
            this.arrayProperties.add(varName);
          }

          // Track variables assigned functions/closures (needed for proper call syntax in PHP)
          if (initType === 'FunctionExpression' ||
              initType === 'ArrowFunctionExpression') {
            this.closureVariables.add(decl.id.name);
            this.closureVariables.add(varName);
          }

          // Track variables assigned from new ClassName() - these are class instances, not arrays
          // Property access on them should use -> not ['...']
          if (initType === 'NewExpression') {
            this.classInstances.add(decl.id.name);
            this.classInstances.add(varName);
          }

          initializer = this.transformExpression(decl.init);

          if (decl.id.typeAnnotation) {
            varType = this.mapType(decl.id.typeAnnotation);
          } else {
            varType = this.inferTypeFromValue(decl.init);
          }
        } else {
          // No initializer - in PHP we need a default value
          // Use null as the default (PHP doesn't have uninitialized variable declarations)
          initializer = PhpLiteral.Null();
          varType = this.inferTypeFromName(decl.id.name);
        }

        const varDecl = new PhpVariableDeclaration(varName, varType, initializer);
        this.registerVariableType(decl.id.name, varType);
        statements.push(new PhpExpressionStatement(
          new PhpAssignment(new PhpVariable(varName), '=', initializer)
        ));
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new PhpExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new PhpReturn(expr);
      }

      return new PhpReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new PhpBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new PhpIf(condition, thenBlock, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      const init = node.init ? this.transformExpression(node.init) : null;
      const test = node.test ? this.transformExpression(node.test) : null;
      const update = node.update ? this.transformExpression(node.update) : null;
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpFor(init, test, update, bodyBlock);
    }

    /**
     * Check if a variable is modified within a node (for pass-by-reference detection)
     * This detects both direct assignment (varName = x) and element assignment (varName[i] = x)
     * @private
     */
    _isVariableModifiedInBody(varName, bodyNode) {
      if (!bodyNode) return false;

      // Check for assignment to varName[index]
      if (bodyNode.type === 'AssignmentExpression' ||
          bodyNode.type === 'UpdateExpression') {
        const left = bodyNode.left || bodyNode.argument;
        // varName[index] = value or varName.property = value
        if (left && left.type === 'MemberExpression') {
          const objName = left.object?.name;
          if (objName === varName)
            return true;
        }
        // Direct assignment to varName
        if (left && left.type === 'Identifier' && left.name === varName)
          return true;
      }

      // Recursively check child nodes
      for (const key of Object.keys(bodyNode)) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = bodyNode[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object' && this._isVariableModifiedInBody(varName, item))
              return true;
          }
        } else if (value && typeof value === 'object') {
          if (this._isVariableModifiedInBody(varName, value))
            return true;
        }
      }

      return false;
    }

    /**
     * Check if an array variable has its ELEMENTS modified within a node
     * This specifically detects varName[index] = value patterns, NOT direct reassignment
     * Used for pass-by-reference detection for array parameters
     * @private
     */
    _isArrayElementModifiedInBody(varName, bodyNode) {
      if (!bodyNode) return false;

      // Check for assignment to varName[index] or varName.property
      if (bodyNode.type === 'AssignmentExpression' ||
          bodyNode.type === 'UpdateExpression') {
        const left = bodyNode.left || bodyNode.argument;
        // varName[index] = value or varName.property = value
        if (left && left.type === 'MemberExpression') {
          const objName = left.object?.name;
          if (objName === varName)
            return true;
        }
        // NOT direct assignment - that doesn't modify array elements
      }

      // Recursively check child nodes
      for (const key of Object.keys(bodyNode)) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = bodyNode[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object' && this._isArrayElementModifiedInBody(varName, item))
              return true;
          }
        } else if (value && typeof value === 'object') {
          if (this._isArrayElementModifiedInBody(varName, value))
            return true;
        }
      }

      return false;
    }

    /**
     * Transform a for-of statement
     */
    transformForOfStatement(node) {
      let varName = 'item';
      let originalVarName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          originalVarName = decl.id.name;
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        originalVarName = node.left.name;
        varName = this.toSnakeCase(node.left.name);
      }

      let iterable = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      // Check if the loop variable is modified within the body - if so, use pass-by-reference
      const byReference = this._isVariableModifiedInBody(originalVarName, node.body);

      // In PHP, foreach doesn't work on strings - need to use str_split()
      // Check if the iterable is a string by looking at the original node type
      let isStringIterable = false;
      if (node.right.resultType === 'string') {
        isStringIterable = true;
      } else if (node.right.type === 'Identifier') {
        const varType = this.getVariableType(node.right.name);
        isStringIterable = varType && varType.name === 'string';
      } else if (node.right.type === 'CallExpression') {
        // Check if the function returns a string
        const funcName = node.right.callee?.property?.name || node.right.callee?.name;
        const stringFunctions = ['substr', 'substring', 'slice', 'trim', 'toLowerCase',
                                 'toUpperCase', 'replace', 'preg_replace', 'strtolower',
                                 'strtoupper', 'str_repeat'];
        if (funcName && stringFunctions.includes(funcName))
          isStringIterable = true;
      }

      // Check variable name heuristics for strings
      if (!isStringIterable && node.right.type === 'Identifier') {
        const lowerName = node.right.name.toLowerCase();
        if (lowerName.includes('input') || lowerName.includes('string') ||
            lowerName.includes('text') || lowerName.includes('str') ||
            lowerName === 'normalized' || lowerName.endsWith('normalized'))
          isStringIterable = true;
      }

      // If iterating over a string, wrap in str_split()
      if (isStringIterable)
        iterable = new PhpFunctionCall('str_split', [iterable]);

      return new PhpForeach(iterable, varName, bodyBlock, null, byReference);
    }

    /**
     * Transform a for-in statement
     */
    transformForInStatement(node) {
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      const object = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpForeach(object, varName, bodyBlock);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpDoWhile(condition, bodyBlock);
    }

    /**
     * Transform a switch statement
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const switchStmt = new PhpSwitch(discriminant);

      for (const caseNode of node.cases) {
        const testExpr = caseNode.test ? this.transformExpression(caseNode.test) : null;
        const statements = [];

        for (const stmt of caseNode.consequent) {
          const phpStmt = this.transformStatement(stmt);
          if (phpStmt) {
            if (Array.isArray(phpStmt)) {
              statements.push(...phpStmt);
            } else {
              statements.push(phpStmt);
            }
          }
        }

        const caseStmt = new PhpSwitchCase(testExpr, statements);
        switchStmt.cases.push(caseStmt);
      }

      return switchStmt;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      const tryBlock = this.transformStatement(node.block);
      const tryStmt = new PhpTry(tryBlock);

      if (node.handler) {
        const exceptionType = node.handler.param?.typeAnnotation || 'Exception';
        const varName = node.handler.param ? this.toSnakeCase(node.handler.param.name) : 'e';
        const catchBody = this.transformStatement(node.handler.body);

        const catchClause = new PhpCatch([exceptionType], varName, catchBody);
        tryStmt.catchClauses.push(catchClause);
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformStatement(node.finalizer);
      }

      return tryStmt;
    }

    /**
     * Transform a throw statement
     */
    transformThrowStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) :
        new PhpNew('Exception', [PhpLiteral.String('Error')]);
      return new PhpThrow(expr);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new PhpBlock();
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
     * Transform an expression (19 critical expression types)
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
          return new PhpVariable('this');

        case 'Super':
          return new PhpIdentifier('parent');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        case 'SpreadElement':
          return this.transformSpreadElement(node);

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'ChainExpression':
          return this.transformExpression(node.expression);

        case 'ObjectPattern':
          // Object destructuring - PHP doesn't support this directly
          // Return a comment placeholder
          return new PhpIdentifier('/* Object destructuring not supported in PHP */');

        case 'ClassExpression':
          // Anonymous class expression - PHP has anonymous classes
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - PHP has generators
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> PHP private property (PHP 8.1+)
          return new PhpVariable(this.toSnakeCase(node.name));

        case 'VariableDeclaration': {
          // Handle variable declarations in expression context (e.g., for loop init)
          // In PHP, we just use assignment expressions
          const assignments = [];
          for (const decl of node.declarations) {
            if (decl.init) {
              const varName = this.toSnakeCase(decl.id.name);

              // Track local variables assigned from method calls or object expressions as arrays
              // JS objects and method-returned objects become PHP associative arrays
              const initType = decl.init.type || decl.init.ilNodeType;

              // Check if initializer is an array element access (e.g., this.keySchedule['roundKeys'][round])
              const isArrayAccess = initType === 'MemberExpression' && decl.init.computed;
              let isArrayElementAccess = false;
              if (isArrayAccess) {
                let checkObj = decl.init.object;
                while (checkObj) {
                  if (checkObj.type === 'ThisExpression' ||
                      checkObj.type === 'Identifier' ||
                      checkObj.type === 'ThisPropertyAccess') {
                    // ThisPropertyAccess is a terminal - it represents this.propertyName
                    isArrayElementAccess = true;
                    break;
                  }
                  if (checkObj.type === 'MemberExpression') {
                    checkObj = checkObj.object;
                  } else {
                    break;
                  }
                }
              }

              if (initType === 'ObjectExpression' ||
                  initType === 'CallExpression' ||
                  initType === 'ThisMethodCall' ||
                  initType === 'MethodCall' ||
                  initType === 'StaticMethodCall' ||
                  isArrayElementAccess) {
                this.arrayProperties.add(varName);
              }

              assignments.push(new PhpAssignment(
                new PhpVariable(varName),
                '=',
                this.transformExpression(decl.init)
              ));
            }
          }
          // Return single assignment or sequence
          if (assignments.length === 1) return assignments[0];
          if (assignments.length > 1) {
            // Return as sequence expression using comma operator
            return assignments.reduce((left, right) =>
              new PhpBinaryExpression(left, ',', right)
            );
          }
          return new PhpLiteral.Null();
        }

        // ============== IL AST Node Types ==============

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

        // Pack/Unpack operations
        case 'PackBytes':
          return this.transformPackBytes(node);

        case 'UnpackBytes':
          return this.transformUnpackBytes(node);

        // Array operations
        case 'ArrayLength':
          return this.transformArrayLength(node);

        case 'ArrayAppend':
          return this.transformArrayAppend(node);

        case 'ArrayPop':
          return new PhpFunctionCall('array_pop', [this.transformExpression(node.array)]);

        case 'ArrayShift':
          return new PhpFunctionCall('array_shift', [this.transformExpression(node.array)]);

        case 'ArrayUnshift':
          return new PhpFunctionCall('array_unshift', [
            this.transformExpression(node.array),
            this.transformExpression(node.value)
          ]);

        case 'ArrayFill':
          return this.transformArrayFill(node);

        case 'ArraySlice':
          return this.transformArraySlice(node);

        case 'ArraySplice':
          return this.transformArraySplice(node);

        case 'ArrayConcat':
          return new PhpFunctionCall('array_merge', [
            this.transformExpression(node.array),
            ...node.arrays.map(a => this.transformExpression(a))
          ]);

        case 'ArrayIndexOf':
          return new PhpFunctionCall('array_search', [
            this.transformExpression(node.value),
            this.transformExpression(node.array)
          ]);

        case 'ArrayIncludes':
          return new PhpFunctionCall('in_array', [
            this.transformExpression(node.value),
            this.transformExpression(node.array),
            PhpLiteral.Bool(true) // strict mode
          ]);

        case 'ArrayJoin':
          return new PhpFunctionCall('implode', [
            node.separator ? this.transformExpression(node.separator) : PhpLiteral.String(''),
            this.transformExpression(node.array)
          ]);

        case 'ArrayReverse':
          return new PhpFunctionCall('array_reverse', [this.transformExpression(node.array)]);

        case 'ArrayXor':
          return this.transformArrayXor(node);

        case 'ArrayClear':
          return new PhpFunctionCall('sodium_memzero', [this.transformExpression(node.arguments[0])]);

        // Array iteration methods (forEach, map, filter, etc.)
        case 'ArrayForEach':
          return this.transformArrayForEach(node);

        case 'ArrayMap':
          return this.transformArrayMap(node);

        case 'ArrayFilter':
          return this.transformArrayFilter(node);

        case 'ArraySome':
          return this.transformArraySome(node);

        case 'ArrayEvery':
          return this.transformArrayEvery(node);

        case 'ArrayFind':
          return this.transformArrayFind(node);

        case 'ArrayFindIndex':
          return this.transformArrayFindIndex(node);

        case 'ArrayReduce':
          return this.transformArrayReduce(node);

        case 'ArraySort':
          return this.transformArraySort(node);

        // Array creation
        case 'ArrayCreation':
          return this.transformArrayCreation(node);

        case 'ArrayLiteral':
          return new PhpArrayLiteral(node.elements.map(e => ({ key: null, value: this.transformExpression(e) })));

        case 'TypedArrayCreation':
          return this.transformTypedArrayCreation(node);

        case 'BufferCreation':
          return new PhpFunctionCall('str_repeat', [
            PhpLiteral.String('\0'),
            this._ensureIntSize(this.transformExpression(node.size))
          ]);

        case 'DataViewCreation':
          // new DataView(buffer) -> just use the buffer (PHP uses strings/arrays as buffers)
          if (node.buffer) {
            return this.transformExpression(node.buffer);
          }
          return new PhpFunctionCall('str_repeat', [PhpLiteral.String('\0'), PhpLiteral.Int(0)]);

        case 'MapCreation': {
          // new Map() -> [] (PHP associative array)
          // new Map([entries]) -> [k1 => v1, k2 => v2, ...]
          if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
            const pairs = node.entries.elements.map(entry => {
              if (entry.elements && entry.elements.length >= 2) {
                const key = this.transformExpression(entry.elements[0]);
                const value = this.transformExpression(entry.elements[1]);
                return { key, value };
              }
              return null;
            }).filter(p => p !== null);
            return new PhpArrayLiteral(pairs);
          }
          return new PhpArrayLiteral([]);
        }

        case 'MapSet': {
          // map.set(key, value) -> $map[$key] = $value
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new PhpAssignment(
            new PhpArrayAccess(map, key),
            '=',
            value
          );
        }

        case 'MapGet': {
          // map.get(key) -> $map[$key]
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new PhpArrayAccess(map, key);
        }

        case 'MapHas': {
          // map.has(key) -> array_key_exists($key, $map) or isset($map[$key])
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new PhpFunctionCall('array_key_exists', [key, map]);
        }

        case 'MapDelete': {
          // map.delete(key) -> unset($map[$key])
          // Since unset is a statement, we need to wrap in a closure or use alternative
          // For expression context, use array_filter or just return the assignment
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new PhpFunctionCall('unset', [new PhpArrayAccess(map, key)]);
        }

        case 'MapSize': {
          // map.size -> count($map)
          const map = this.transformExpression(node.map);
          return new PhpFunctionCall('count', [map]);
        }

        case 'MapClear': {
          // map.clear() -> $map = []
          const map = this.transformExpression(node.map);
          return new PhpAssignment(map, '=', new PhpArrayLiteral([]));
        }

        // Set operations
        case 'SetCreation': {
          // new Set() -> [] (use PHP array - check with in_array for membership)
          // new Set([values]) -> array_values(array_unique([...]))
          if (node.values && node.values.elements && node.values.elements.length > 0) {
            const elements = node.values.elements.map(el => ({
              key: null,
              value: this.transformExpression(el)
            }));
            // array_unique to ensure uniqueness like Set does
            return new PhpFunctionCall('array_values', [
              new PhpFunctionCall('array_unique', [new PhpArrayLiteral(elements)])
            ]);
          }
          return new PhpArrayLiteral([]);
        }

        case 'SetAdd': {
          // set.add(value) -> use array if not present
          // This is tricky - could use if (!in_array($val, $set)) $set[] = $val;
          // For expression context, return a function call pattern
          const set = this.transformExpression(node.set);
          const value = this.transformExpression(node.value);
          // Use array_push for simplicity - duplicates would need to be handled elsewhere
          return new PhpFunctionCall('array_push', [set, value]);
        }

        case 'SetHas': {
          // set.has(value) -> in_array($value, $set, true)
          const set = this.transformExpression(node.set);
          const value = this.transformExpression(node.value);
          return new PhpFunctionCall('in_array', [value, set, PhpLiteral.Bool(true)]);
        }

        case 'SetDelete': {
          // set.delete(value) -> remove value from array
          // ($key = array_search($val, $set)) !== false ? array_splice($set, $key, 1) : false
          const set = this.transformExpression(node.set);
          const value = this.transformExpression(node.value);
          // Simplified: use array_filter
          return new PhpFunctionCall('array_values', [
            new PhpFunctionCall('array_filter', [
              set,
              new PhpArrowFunction(
                [new PhpParameter('v')],
                new PhpBinaryExpression(new PhpVariable('v'), '!==', value)
              )
            ])
          ]);
        }

        case 'SetSize': {
          // set.size -> count($set)
          const set = this.transformExpression(node.set);
          return new PhpFunctionCall('count', [set]);
        }

        case 'SetClear': {
          // set.clear() -> $set = []
          const set = this.transformExpression(node.set);
          return new PhpAssignment(set, '=', new PhpArrayLiteral([]));
        }

        // Math operations
        case 'Floor':
          return new PhpFunctionCall('floor', [this.transformExpression(node.argument)]);

        case 'Ceil':
          return new PhpFunctionCall('ceil', [this.transformExpression(node.argument)]);

        case 'Round':
          return new PhpFunctionCall('round', [this.transformExpression(node.argument)]);

        case 'Abs':
          return new PhpFunctionCall('abs', [this.transformExpression(node.argument)]);

        case 'Min':
          return new PhpFunctionCall('min', node.arguments.map(a => this.transformExpression(a)));

        case 'Max':
          return new PhpFunctionCall('max', node.arguments.map(a => this.transformExpression(a)));

        case 'Power':
          return new PhpBinaryExpression(
            this.transformExpression(node.base),
            '**',
            this.transformExpression(node.exponent)
          );

        case 'Sqrt':
          return new PhpFunctionCall('sqrt', [this.transformExpression(node.argument)]);

        case 'Random':
          return new PhpBinaryExpression(
            new PhpFunctionCall('mt_rand', []),
            '/',
            new PhpFunctionCall('mt_getrandmax', [])
          );

        case 'Truncate':
          return new PhpCast(this.transformExpression(node.argument), 'int');

        case 'Log':
          return new PhpFunctionCall('log', [this.transformExpression(node.argument)]);

        case 'Log2':
          return new PhpBinaryExpression(
            new PhpFunctionCall('log', [this.transformExpression(node.argument)]),
            '/',
            new PhpFunctionCall('log', [PhpLiteral.Int(2)])
          );

        case 'Log10':
          return new PhpFunctionCall('log10', [this.transformExpression(node.argument)]);

        case 'Sin':
          return new PhpFunctionCall('sin', [this.transformExpression(node.argument)]);

        case 'Cos':
          return new PhpFunctionCall('cos', [this.transformExpression(node.argument)]);

        case 'Tan':
          return new PhpFunctionCall('tan', [this.transformExpression(node.argument)]);

        case 'Asin':
          return new PhpFunctionCall('asin', [this.transformExpression(node.argument)]);

        case 'Acos':
          return new PhpFunctionCall('acos', [this.transformExpression(node.argument)]);

        case 'Atan':
          return new PhpFunctionCall('atan', [this.transformExpression(node.argument)]);

        case 'Atan2':
          return new PhpFunctionCall('atan2', node.arguments.map(a => this.transformExpression(a)));

        case 'Sinh':
          return new PhpFunctionCall('sinh', [this.transformExpression(node.argument)]);

        case 'Cosh':
          return new PhpFunctionCall('cosh', [this.transformExpression(node.argument)]);

        case 'Tanh':
          return new PhpFunctionCall('tanh', [this.transformExpression(node.argument)]);

        case 'Exp':
          return new PhpFunctionCall('exp', [this.transformExpression(node.argument)]);

        case 'Cbrt':
          return new PhpBinaryExpression(
            this.transformExpression(node.argument),
            '**',
            new PhpBinaryExpression(PhpLiteral.Int(1), '/', PhpLiteral.Int(3))
          );

        case 'Hypot':
          return new PhpFunctionCall('hypot', node.arguments.map(a => this.transformExpression(a)));

        case 'Sign':
          return new PhpBinaryExpression(
            this.transformExpression(node.argument),
            '<=>',
            PhpLiteral.Int(0)
          );

        case 'Fround':
          return new PhpCast(this.transformExpression(node.argument), 'float');

        case 'MathConstant': {
          const mathConstants = {
            'PI': 'M_PI', 'E': 'M_E', 'LN2': 'M_LN2', 'LN10': 'M_LN10',
            'LOG2E': 'M_LOG2E', 'LOG10E': 'M_LOG10E', 'SQRT2': 'M_SQRT2', 'SQRT1_2': 'M_SQRT1_2'
          };
          return new PhpIdentifier(mathConstants[node.name] || ('M_' + node.name));
        }

        case 'NumberConstant': {
          const numberConstants = {
            'MAX_SAFE_INTEGER': 'PHP_INT_MAX', 'MIN_SAFE_INTEGER': 'PHP_INT_MIN',
            'MAX_VALUE': 'PHP_FLOAT_MAX', 'MIN_VALUE': 'PHP_FLOAT_MIN',
            'EPSILON': 'PHP_FLOAT_EPSILON', 'POSITIVE_INFINITY': 'INF',
            'NEGATIVE_INFINITY': null, 'NaN': 'NAN'
          };
          if (node.name === 'NEGATIVE_INFINITY')
            return new PhpUnaryExpression('-', new PhpIdentifier('INF'), true);
          return new PhpIdentifier(numberConstants[node.name] || 'PHP_INT_MAX');
        }

        case 'InstanceOfCheck':
          return new PhpInstanceof(
            this.transformExpression(node.value),
            node.className
          );

        case 'CountLeadingZeros':
          // PHP doesn't have built-in clz, need to implement or use helper
          return new PhpFunctionCall('count_leading_zeros', [
            this.transformExpression(node.argument),
            PhpLiteral.Int(node.bits || 32)
          ]);

        // String/Bytes conversions
        case 'HexDecode':
          return new PhpFunctionCall('hex2bin', [this.transformExpression(node.arguments[0])]);

        case 'HexEncode':
          return new PhpFunctionCall('bin2hex', [this.transformExpression(node.arguments[0])]);

        case 'StringToBytes':
          // OpCodes.AnsiToBytes() / OpCodes.Utf8ToBytes()
          // PHP: array_values(unpack('C*', $str)) for byte array
          if (node.encoding === 'utf8') {
            // For UTF-8, ensure proper encoding first
            return new PhpFunctionCall('array_values', [
              new PhpFunctionCall('unpack', [
                PhpLiteral.String('C*'),
                new PhpFunctionCall('mb_convert_encoding', [
                  this.transformExpression(node.arguments[0]),
                  PhpLiteral.String('UTF-8')
                ])
              ])
            ]);
          }
          // For ANSI/binary strings
          return new PhpFunctionCall('array_values', [
            new PhpFunctionCall('unpack', [
              PhpLiteral.String('C*'),
              this.transformExpression(node.arguments[0])
            ])
          ]);

        case 'BytesToString':
          // OpCodes.BytesToAnsi() / OpCodes.BytesToUtf8()
          // PHP: pack('C*', ...$bytes) or implode('', array_map('chr', $bytes))
          if (node.encoding === 'utf8') {
            return new PhpFunctionCall('mb_convert_encoding', [
              new PhpFunctionCall('implode', [
                PhpLiteral.String(''),
                new PhpFunctionCall('array_map', [
                  PhpLiteral.String('chr'),
                  this.transformExpression(node.arguments[0])
                ])
              ]),
              PhpLiteral.String('UTF-8')
            ]);
          }
          // For ANSI/binary conversion
          return new PhpFunctionCall('implode', [
            PhpLiteral.String(''),
            new PhpFunctionCall('array_map', [
              PhpLiteral.String('chr'),
              this.transformExpression(node.arguments[0])
            ])
          ]);

        // Cast operations
        case 'Cast':
          return this.transformCast(node);

        // Fallback for unknown OpCodes methods - delegate to OpCodes handler
        case 'OpCodesCall': {
          const methodName = node.method;
          const args = node.arguments.map(a => this.transformExpression(a));

          // Handle known OpCodes methods
          switch (methodName) {
            case 'ConcatArrays':
              return new PhpFunctionCall('array_merge', args);

            case 'CopyArray':
              if (args.length === 1)
                return args[0]; // PHP arrays are copy-on-write
              return new PhpFunctionCall('array_values', args);

            case 'FillArray':
              if (args.length >= 2)
                return new PhpFunctionCall('array_fill', [PhpLiteral.Int(0), this._ensureIntSize(args[0]), args[1]]);
              return new PhpFunctionCall('array_fill', [PhpLiteral.Int(0), this._ensureIntSize(args[0]), PhpLiteral.Int(0)]);

            case 'DoubleToBytes':
              // pack('d', $value)
              return new PhpFunctionCall('unpack', [
                PhpLiteral.String('C*'),
                new PhpFunctionCall('pack', [PhpLiteral.String('d'), args[0]])
              ]);

            case 'FloatToBytes':
              // pack('f', $value)
              return new PhpFunctionCall('unpack', [
                PhpLiteral.String('C*'),
                new PhpFunctionCall('pack', [PhpLiteral.String('f'), args[0]])
              ]);

            default:
              // Unknown method - use snake_case function name
              return new PhpFunctionCall(this.toSnakeCase(methodName), args);
          }
        }

        // Error creation - map JS error types to PHP exception types
        case 'ErrorCreation': {
          const phpExceptionType = node.errorType === 'Error' ? 'Exception' :
                                   node.errorType === 'TypeError' ? 'TypeError' :
                                   node.errorType === 'RangeError' ? 'RangeException' :
                                   'Exception';
          return new PhpNew(
            phpExceptionType,  // String, not PhpIdentifier
            [node.message ? this.transformExpression(node.message) : PhpLiteral.String('')]
          );
        }

        // MathCall - for unhandled Math.* methods
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          switch (node.method) {
            case 'imul':
              // Math.imul(a, b) → (($a * $b) & 0xFFFFFFFF) for 32-bit integer multiply
              if (args.length >= 2)
                return new PhpBinaryExpression(
                  new PhpBinaryExpression(args[0], '*', args[1]),
                  '&',
                  PhpLiteral.Int(0xFFFFFFFF)
                );
              break;
            case 'abs':
              return new PhpFunctionCall('abs', args);
            case 'floor':
              return new PhpFunctionCall('floor', args);
            case 'ceil':
              return new PhpFunctionCall('ceil', args);
            case 'round':
              return new PhpFunctionCall('round', args);
            case 'min':
              return new PhpFunctionCall('min', args);
            case 'max':
              return new PhpFunctionCall('max', args);
            case 'pow':
              return new PhpBinaryExpression(args[0], '**', args[1]);
            case 'sqrt':
              return new PhpFunctionCall('sqrt', args);
            case 'log':
              return new PhpFunctionCall('log', args);
            case 'log2':
              return new PhpBinaryExpression(
                new PhpFunctionCall('log', args),
                '/',
                new PhpFunctionCall('log', [PhpLiteral.Int(2)])
              );
            case 'log10':
              return new PhpFunctionCall('log10', args);
            case 'trunc':
              return new PhpCast(args[0], 'int');
            case 'random':
              return new PhpBinaryExpression(
                new PhpFunctionCall('mt_rand', []),
                '/',
                new PhpFunctionCall('mt_getrandmax', [])
              );
            case 'sign':
              // sign(x) = x > 0 ? 1 : (x < 0 ? -1 : 0)
              return new PhpTernary(
                new PhpBinaryExpression(args[0], '>', PhpLiteral.Int(0)),
                PhpLiteral.Int(1),
                new PhpTernary(
                  new PhpBinaryExpression(args[0], '<', PhpLiteral.Int(0)),
                  PhpLiteral.Int(-1),
                  PhpLiteral.Int(0)
                )
              );
            case 'clz32':
              // Count leading zeros - custom function needed
              return new PhpFunctionCall('count_leading_zeros', [args[0], PhpLiteral.Int(32)]);
            default:
              // Fallback to lowercase function name
              return new PhpFunctionCall(node.method.toLowerCase(), args);
          }
        }

        // ========================[ String IL Node Types ]========================

        case 'StringReplace': {
          // string.replace(search, replacement) -> str_replace or preg_replace
          const strExpr = this.transformExpression(node.string || node.object);
          const searchNode = node.searchValue || node.search || node.pattern;
          const replaceNode = node.replaceValue || node.replacement;

          // Handle regex patterns - use preg_replace
          if (searchNode && searchNode.type === 'Literal' && searchNode.regex) {
            // Regex literal: /pattern/flags
            const pattern = searchNode.regex.pattern || '';
            const flags = searchNode.regex.flags || '';
            let phpFlags = '';
            if (flags.includes('i')) phpFlags += 'i';
            if (flags.includes('m')) phpFlags += 'm';
            if (flags.includes('s')) phpFlags += 's';
            // Escape / in pattern for PCRE
            const escapedPattern = pattern.replace(/\//g, '\\/');
            const phpPattern = '/' + escapedPattern + '/' + phpFlags;
            return new PhpFunctionCall('preg_replace', [
              PhpLiteral.String(phpPattern),
              replaceNode ? this.transformExpression(replaceNode) : PhpLiteral.String(''),
              strExpr
            ]);
          }

          // Transform the search expression
          const searchExpr = searchNode ? this.transformExpression(searchNode) : null;
          const replaceExpr = replaceNode ? this.transformExpression(replaceNode) : PhpLiteral.String('');

          // If transformed search is a regex pattern string (starts with /), use preg_replace
          if (searchExpr && searchExpr.nodeType === 'Literal' && searchExpr.literalType === 'string') {
            const searchValue = searchExpr.value;
            if (typeof searchValue === 'string' && searchValue.startsWith('/') && searchValue.length > 2) {
              // It's a regex pattern string
              return new PhpFunctionCall('preg_replace', [searchExpr, replaceExpr, strExpr]);
            }
          }

          // Regular str_replace for non-regex patterns
          // If searchExpr is null, default to empty string
          return new PhpFunctionCall('str_replace', [
            searchExpr || PhpLiteral.String(''),
            replaceExpr,
            strExpr
          ]);
        }

        case 'StringRepeat':
          // string.repeat(count) -> str_repeat($str, $count)
          return new PhpFunctionCall('str_repeat', [
            this.transformExpression(node.string || node.object),
            this._ensureIntSize(this.transformExpression(node.count))
          ]);

        case 'StringIndexOf': {
          // string.indexOf(search, start?) -> strpos($str, $search, $start?) or false
          const str = this.transformExpression(node.string || node.object);
          const search = this.transformExpression(node.search);
          const args = [str, search];
          if (node.start) args.push(this.transformExpression(node.start));
          return new PhpFunctionCall('strpos', args);
        }

        case 'StringSplit':
          // string.split(separator) -> explode($separator, $str)
          return new PhpFunctionCall('explode', [
            node.separator ? this.transformExpression(node.separator) : PhpLiteral.String(''),
            this.transformExpression(node.string || node.object)
          ]);

        case 'StringSubstring': {
          // string.substring(start, end?) -> substr($str, $start, $length?)
          const str = this.transformExpression(node.string || node.object);
          const start = node.start ? this.transformExpression(node.start) : PhpLiteral.Int(0);
          const args = [str, start];
          if (node.end) {
            const end = this.transformExpression(node.end);
            // length = end - start
            args.push(new PhpBinaryExpression(end, '-', start));
          }
          return new PhpFunctionCall('substr', args);
        }

        case 'StringCharAt':
          // string.charAt(index) -> substr($str, $index, 1)
          return new PhpFunctionCall('substr', [
            this.transformExpression(node.string || node.object),
            this.transformExpression(node.index),
            PhpLiteral.Int(1)
          ]);

        case 'StringCharCodeAt':
          // string.charCodeAt(index) -> ord(substr($str, $index, 1))
          return new PhpFunctionCall('ord', [
            new PhpFunctionCall('substr', [
              this.transformExpression(node.string || node.object),
              this.transformExpression(node.index),
              PhpLiteral.Int(1)
            ])
          ]);

        case 'StringToUpperCase':
          // string.toUpperCase() -> strtoupper($str)
          return new PhpFunctionCall('strtoupper', [
            this.transformExpression(node.string || node.object || node.argument)
          ]);

        case 'StringToLowerCase':
          // string.toLowerCase() -> strtolower($str)
          return new PhpFunctionCall('strtolower', [
            this.transformExpression(node.string || node.object || node.argument)
          ]);

        case 'StringTrim':
          // string.trim() -> trim($str)
          return new PhpFunctionCall('trim', [
            this.transformExpression(node.string || node.object || node.argument)
          ]);

        case 'StringTransform': {
          // Generic string transform - route to specific methods
          const strExpr = this.transformExpression(node.string || node.object);
          switch (node.method) {
            case 'toLowerCase':
              return new PhpFunctionCall('strtolower', [strExpr]);
            case 'toUpperCase':
              return new PhpFunctionCall('strtoupper', [strExpr]);
            case 'trim':
              return new PhpFunctionCall('trim', [strExpr]);
            case 'trimStart':
            case 'trimLeft':
              return new PhpFunctionCall('ltrim', [strExpr]);
            case 'trimEnd':
            case 'trimRight':
              return new PhpFunctionCall('rtrim', [strExpr]);
            default:
              // Fallback - just return the string
              return strExpr;
          }
        }

        case 'StringStartsWith':
          // string.startsWith(prefix) -> str_starts_with($str, $prefix) (PHP 8+)
          return new PhpFunctionCall('str_starts_with', [
            this.transformExpression(node.string || node.object),
            this.transformExpression(node.prefix || node.search)
          ]);

        case 'StringEndsWith':
          // string.endsWith(suffix) -> str_ends_with($str, $suffix) (PHP 8+)
          return new PhpFunctionCall('str_ends_with', [
            this.transformExpression(node.string || node.object),
            this.transformExpression(node.suffix || node.search)
          ]);

        case 'StringIncludes':
          // string.includes(substr) -> str_contains($str, $substr) (PHP 8+)
          return new PhpFunctionCall('str_contains', [
            this.transformExpression(node.string || node.object),
            this.transformExpression(node.searchValue || node.searchString || node.search || node.substring)
          ]);

        // ========================[ Additional IL Node Types ]========================

        case 'BigIntCast':
          // BigInt(value) -> PHP handles large integers using GMP or BCMath
          // For basic usage, just cast to int
          return new PhpCast(
            this.transformExpression(node.value || node.argument || (node.arguments && node.arguments[0])),
            'int'
          );

        case 'TypedArraySet': {
          // typedArray.set(source, offset?) -> array_splice($arr, $offset, count($source), $source)
          const target = this.transformExpression(node.target || node.array);
          const source = this.transformExpression(node.source || node.values);
          const offset = node.offset ? this.transformExpression(node.offset) : PhpLiteral.Int(0);
          return new PhpFunctionCall('array_splice', [
            target,
            offset,
            new PhpFunctionCall('count', [source]),
            source
          ]);
        }

        case 'TypedArraySubarray': {
          // array.subarray(begin, end) -> array_slice($arr, begin, end-begin)
          const array = this.transformExpression(node.array);
          const begin = node.begin ? this.transformExpression(node.begin) : PhpLiteral.Int(0);
          if (node.end) {
            const end = this.transformExpression(node.end);
            const length = new PhpBinaryExpression(end, '-', begin);
            return new PhpFunctionCall('array_slice', [array, begin, length]);
          } else {
            return new PhpFunctionCall('array_slice', [array, begin]);
          }
        }

        // IL AST StringInterpolation - `Hello ${name}` -> "Hello " . $name . "!"
        case 'StringInterpolation': {
          // Build parts array for PhpStringInterpolation (handles emission properly)
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
          return new PhpStringInterpolation(parts);
        }

        // IL AST ObjectLiteral - {key: value} -> ['key' => value]
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new PhpArrayLiteral([]);

          const elements = [];
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') continue;
            const key = prop.key?.name || prop.key?.value || prop.key || 'key';
            const value = this.transformExpression(prop.value);
            elements.push({
              key: PhpLiteral.String(key),
              value: value || PhpLiteral.Null()
            });
          }
          return new PhpArrayLiteral(elements);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> chr(65)
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return PhpLiteral.String('');
          if (args.length === 1)
            return new PhpFunctionCall('chr', args);
          // Multiple chars: implode('', array_map('chr', [c1, c2, ...]))
          return new PhpFunctionCall('implode', [
            PhpLiteral.String(''),
            new PhpFunctionCall('array_map', [
              PhpLiteral.String('chr'),
              new PhpArrayLiteral(args)
            ])
          ]);
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> is_array(x)
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new PhpFunctionCall('is_array', [value]);
        }

        // IL AST IsIntegerCheck - Number.isInteger(x) -> is_int(x)
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new PhpFunctionCall('is_int', [value]);
        }

        // IL AST IsNaNCheck - Number.isNaN(x) -> is_nan(x)
        case 'IsNaNCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new PhpFunctionCall('is_nan', [value]);
        }

        // IL AST IsFiniteCheck - Number.isFinite(x) -> is_finite(x)
        case 'IsFiniteCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new PhpFunctionCall('is_finite', [value]);
        }

        // IL AST DebugOutput - console.log/warn/error -> can be stripped or converted to error_log
        case 'DebugOutput': {
          // For production PHP, debug output can be stripped or converted to error_log
          // Use error_log for debugging, or just return a comment
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const method = node.method || node.level || 'log';

          // Convert to error_log with appropriate prefix
          if (args.length === 0)
            return new PhpFunctionCall('error_log', [PhpLiteral.String('')]);

          // For single argument, just log it
          if (args.length === 1)
            return new PhpFunctionCall('error_log', [args[0]]);

          // For multiple arguments, concatenate them
          let message = args[0];
          for (let i = 1; i < args.length; ++i) {
            message = new PhpBinaryExpression(
              new PhpBinaryExpression(message, '.', PhpLiteral.String(' ')),
              '.',
              args[i]
            );
          }
          return new PhpFunctionCall('error_log', [message]);
        }

        // IL AST ArrowFunction - (x) => expr -> fn($x) => expr or function($x) { ... }
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return new PhpParameter(name);
          });

          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              // PHP arrow functions can only be single expressions; use closure for blocks
              const bodyBlock = this.transformBlockStatement(node.body);
              const closure = new PhpClosure(params, bodyBlock);

              // Collect free variables that need to be captured with 'use'
              const paramNames = new Set(params.map(p => p.name));
              const referencedVars = this._collectReferencedIdentifiers(node.body);
              const localVars = this._collectLocalDeclarations(node.body);
              const modifiedVars = this._collectModifiedIdentifiers(node.body);

              const builtins = new Set(['this', 'null', 'true', 'false', 'undefined', 'NaN', 'Infinity',
                                        'Math', 'Array', 'Object', 'String', 'Number', 'Boolean',
                                        'OpCodes', 'AlgorithmFramework']);
              const freeVars = [];
              for (const varName of referencedVars) {
                if (!paramNames.has(varName) && !localVars.has(varName) && !builtins.has(varName)) {
                  const snakeName = this.toSnakeCase(varName);
                  if (modifiedVars.has(varName))
                    freeVars.push('&' + snakeName);
                  else
                    freeVars.push(snakeName);
                }
              }
              closure.useVariables = [...new Set(freeVars)];
              return closure;
            }
            // Single expression - use arrow function
            const body = this.transformExpression(node.body);
            return new PhpArrowFunction(params, body);
          }

          // No body - return empty arrow function
          return new PhpArrowFunction(params, PhpLiteral.Null());
        }

        // IL AST TypeOfExpression - typeof x -> gettype(x)
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new PhpFunctionCall('gettype', [value]);
        }

        // IL AST Power - x ** y -> pow(x, y) or x ** y
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new PhpBinaryExpression(left, '**', right);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in PHP)
        case 'ObjectFreeze': {
          // IL node uses 'object' property, not 'value'
          return this.transformExpression(node.object || node.value || node.argument);
        }

        // IL AST ArrayFrom - Array.from(x) -> (array)$x or array_values($x)
        case 'ArrayFrom': {
          const iterable = this.transformExpression(node.iterable);
          if (node.mapFunction) {
            // Array.from(arr, fn) -> array_map(fn, arr)
            const mapFn = this.transformExpression(node.mapFunction);
            return new PhpFunctionCall('array_map', [mapFn, iterable]);
          }
          return new PhpFunctionCall('array_values', [iterable]);
        }

        // IL AST ObjectKeys - Object.keys(obj) -> array_keys($obj)
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object);
          return new PhpFunctionCall('array_keys', [obj]);
        }

        // IL AST ObjectValues - Object.values(obj) -> array_values($obj)
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object);
          return new PhpFunctionCall('array_values', [obj]);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> array pairs
        case 'ObjectEntries': {
          // PHP doesn't have direct equivalent, use array_map with array_keys
          const obj = this.transformExpression(node.object);
          // Returns array of [key, value] pairs using closure
          return new PhpFunctionCall('array_map', [
            new PhpClosure(
              [new PhpParameter('k'), new PhpParameter('v')],
              new PhpReturn(new PhpArrayLiteral([new PhpVariable('k'), new PhpVariable('v')])),
              []
            ),
            new PhpFunctionCall('array_keys', [obj]),
            obj
          ]);
        }

        // IL AST ObjectCreate - Object.create(proto) -> clone or new class
        case 'ObjectCreate': {
          // In PHP, we can use clone for object copying or just return empty array/object
          const proto = this.transformExpression(node.prototype);
          if (node.properties) {
            // Object.create(proto, properties) - create with properties
            return new PhpFunctionCall('array_merge', [
              new PhpCast('array', proto),
              this.transformExpression(node.properties)
            ]);
          }
          // Simple case: just clone or cast
          return new PhpCast('array', proto);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> pack() based
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          // PHP pack format codes
          let fmt = method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';

          // $view[$offset] = substr(pack(fmt, value), 0, size)
          const packed = new PhpFunctionCall('pack', [PhpLiteral.String(fmt), value]);
          const size = method.includes('32') ? 4 : method.includes('16') ? 2 : 1;

          if (size === 1)
            return new PhpAssignment(new PhpArrayAccess(view, offset), packed);

          return new PhpFunctionCall('array_splice', [
            view, offset, PhpLiteral.Int(size),
            new PhpFunctionCall('array_values', [
              new PhpFunctionCall('unpack', [PhpLiteral.String('C*'), packed])
            ])
          ]);
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> unpack() based
        // NOTE: IL transformer may incorrectly generate DataViewRead for toString() calls
        case 'DataViewRead': {
          const method = node.method;

          // Handle misclassified toString() calls on numbers
          // The IL transformer sometimes generates DataViewRead with method='toString'
          // when it should be a Cast to string
          if (method === 'toString') {
            const value = this.transformExpression(node.view);
            return new PhpCast(value, 'string');
          }

          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const littleEndian = node.littleEndian !== false;

          if (method === 'getUint8')
            return new PhpArrayAccess(view, offset);

          // PHP unpack format codes
          let fmt = method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';

          const size = method.includes('32') ? 4 : method.includes('16') ? 2 : 1;
          const sliced = new PhpFunctionCall('array_slice', [view, offset, PhpLiteral.Int(size)]);
          const packed = new PhpFunctionCall('pack', [PhpLiteral.String('C*'), new PhpSpreadElement(sliced)]);
          return new PhpArrayAccess(
            new PhpFunctionCall('unpack', [PhpLiteral.String(fmt), packed]),
            PhpLiteral.Int(1)
          );
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> ord($str[$i])
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new PhpFunctionCall('ord', [new PhpArrayAccess(str, index)]);
        }

        // IL AST StringReplace - str.replace(search, replace) -> str_replace(search, replace, str)
        case 'StringReplace': {
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue);
          const replace = this.transformExpression(node.replaceValue);
          return new PhpFunctionCall('str_replace', [search, replace, str]);
        }

        // IL AST BufferCreation - new ArrayBuffer(n) -> array_fill(0, n, 0)
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new PhpFunctionCall('array_fill', [PhpLiteral.Int(0), size, PhpLiteral.Int(0)]);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods
        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          if (method === 'imul') {
            // Math.imul(a, b) -> (int)(($a * $b) & 0xFFFFFFFF) - ((($a * $b) & 0x80000000) ? 0x100000000 : 0)
            if (args.length >= 2) {
              const mul = new PhpBinaryExpression(args[0], '*', args[1]);
              const masked = new PhpBinaryExpression(mul, '&', PhpLiteral.Hex(0xFFFFFFFF));
              return new PhpCast('int', masked);
            }
          }
          // Default: use math function directly
          return new PhpFunctionCall(method, args);
        }

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> array_slice(arr, start, end-start)
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const end = node.end ? this.transformExpression(node.end) : null;

          if (end)
            return new PhpFunctionCall('array_slice', [array, start, new PhpBinaryExpression(end, '-', start)]);
          return new PhpFunctionCall('array_slice', [array, start]);
        }

        default:
          // Log warning for unhandled expression types to aid debugging
          const safeStringify = (obj) => {
            try {
              return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v, 2).substring(0, 200);
            } catch (e) { return '[stringify error]'; }
          };
          console.warn(`[PhpTransformer] Unhandled expression type: ${node.type}`, safeStringify(node));
          // Return a placeholder that will cause parse errors with clear indication
          return new PhpIdentifier(`UNHANDLED_EXPRESSION_${node.type}`);
      }
    }

    // ============== IL AST Node Transform Methods ==============

    /**
     * Transform ParentConstructorCall → parent::__construct(...)
     */
    transformParentConstructorCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PhpStaticMethodCall('parent', '__construct', args);
    }

    /**
     * Transform ParentMethodCall → parent::methodName(...)
     */
    transformParentMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PhpStaticMethodCall('parent', this.toSnakeCase(node.method), args);
    }

    /**
     * Transform ThisMethodCall → $this->methodName(...)
     */
    transformThisMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PhpMethodCall(
        new PhpVariable('this'),
        this.toSnakeCase(node.method),
        args
      );
    }

    /**
     * Transform ThisPropertyAccess → $this->propertyName
     */
    transformThisPropertyAccess(node) {
      const rawPropName = typeof node.property === 'string'
        ? node.property
        : (node.property?.name || node.propertyName || node.name || '');

      // Preserve ALL_CAPS property names, convert others to snake_case
      const isAllCaps = /^[A-Z][A-Z0-9_]*$/.test(rawPropName);
      let propertyName = isAllCaps ? rawPropName : this.toSnakeCase(rawPropName);

      // Remove leading underscore for property access
      if (propertyName.startsWith('_'))
        propertyName = propertyName.substring(1);

      if (node.computed) {
        return new PhpArrayAccess(new PhpVariable('this'), new PhpVariable(propertyName));
      }
      return new PhpPropertyAccess(new PhpVariable('this'), propertyName);
    }

    /**
     * Transform rotation operations
     */
    transformRotation(node) {
      const value = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // (($value << $amount) | ($value >> ($bits - $amount))) & $mask
      const mask = bits === 32 ? 0xFFFFFFFF : (bits === 64 ? 0xFFFFFFFFFFFFFFFFn : ((1 << bits) - 1));

      const rotated = new PhpBinaryExpression(
        new PhpBinaryExpression(value, isLeft ? '<<' : '>>', amount),
        '|',
        new PhpBinaryExpression(value, isLeft ? '>>' : '<<',
          new PhpBinaryExpression(PhpLiteral.Int(bits), '-', amount))
      );

      return new PhpBinaryExpression(
        rotated,
        '&',
        PhpLiteral.Int(mask)
      );
    }

    /**
     * Transform PackBytes → bitwise operations to combine bytes into integer
     * PHP's pack() returns binary string, not integer - use bitwise ops instead
     */
    transformPackBytes(node) {
      const args = node.arguments || [];
      const bits = node.bits || 32;
      const endian = node.endian || 'big';

      // Check for compile-time constant: PackBytes(SpreadElement(HexDecode("...")))
      if (args.length === 1 && args[0].type === 'SpreadElement') {
        const spreadArg = args[0].argument;
        if (spreadArg && (spreadArg.type === 'HexDecode' || spreadArg.ilNodeType === 'HexDecode')) {
          const hexArg = spreadArg.arguments?.[0];
          if (hexArg && hexArg.type === 'Literal' && typeof hexArg.value === 'string') {
            const hexStr = hexArg.value;
            // Compute the integer value from hex string
            const intValue = parseInt(hexStr, 16);
            if (!isNaN(intValue)) {
              // Return as hex literal for readability
              return PhpLiteral.Int(intValue);
            }
          }
        }
      }

      // Transform all arguments
      const transformedArgs = args.map(a => this.transformExpression(a));

      // Build bitwise expression: (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
      // PhpBinaryExpression constructor: (left, operator, right)
      if (bits === 16) {
        if (transformedArgs.length >= 2) {
          if (endian === 'little') {
            // Little-endian: b0 | (b1 << 8)
            return new PhpBinaryExpression(
              transformedArgs[0],
              '|',
              new PhpBinaryExpression(transformedArgs[1], '<<', PhpLiteral.Int(8))
            );
          } else {
            // Big-endian: (b0 << 8) | b1
            return new PhpBinaryExpression(
              new PhpBinaryExpression(transformedArgs[0], '<<', PhpLiteral.Int(8)),
              '|',
              transformedArgs[1]
            );
          }
        }
      } else if (bits === 32) {
        if (transformedArgs.length >= 4) {
          if (endian === 'little') {
            // Little-endian: b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
            return new PhpBinaryExpression(
              new PhpBinaryExpression(
                new PhpBinaryExpression(
                  transformedArgs[0],
                  '|',
                  new PhpBinaryExpression(transformedArgs[1], '<<', PhpLiteral.Int(8))
                ),
                '|',
                new PhpBinaryExpression(transformedArgs[2], '<<', PhpLiteral.Int(16))
              ),
              '|',
              new PhpBinaryExpression(transformedArgs[3], '<<', PhpLiteral.Int(24))
            );
          } else {
            // Big-endian: (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
            return new PhpBinaryExpression(
              new PhpBinaryExpression(
                new PhpBinaryExpression(
                  new PhpBinaryExpression(transformedArgs[0], '<<', PhpLiteral.Int(24)),
                  '|',
                  new PhpBinaryExpression(transformedArgs[1], '<<', PhpLiteral.Int(16))
                ),
                '|',
                new PhpBinaryExpression(transformedArgs[2], '<<', PhpLiteral.Int(8))
              ),
              '|',
              transformedArgs[3]
            );
          }
        }
      }

      // Fallback: single byte or unsupported
      if (transformedArgs.length === 1) {
        return transformedArgs[0];
      }

      // Default fallback - should not normally reach here
      return new PhpFunctionCall('pack', [
        PhpLiteral.String('C*'),
        ...transformedArgs
      ]);
    }

    /**
     * Transform UnpackBytes → bitwise operations to extract bytes from integer
     * Returns array of bytes
     */
    transformUnpackBytes(node) {
      const args = node.arguments || [];
      const bits = node.bits || 32;
      const endian = node.endian || 'big';

      if (args.length === 0) {
        return new PhpArrayLiteral([]);
      }

      const value = this.transformExpression(args[0]);

      // Build array of extracted bytes
      // PhpBinaryExpression constructor: (left, operator, right)
      // Note: Using >> 0 for low byte ensures proper parenthesization when value contains | operator
      if (bits === 16) {
        if (endian === 'little') {
          // Little-endian: [(v >> 0) & 0xFF, (v >> 8) & 0xFF]
          return new PhpArrayLiteral([
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(0)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(8)), '&', PhpLiteral.Int(0xFF)) }
          ]);
        } else {
          // Big-endian: [(v >> 8) & 0xFF, (v >> 0) & 0xFF]
          return new PhpArrayLiteral([
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(8)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(0)), '&', PhpLiteral.Int(0xFF)) }
          ]);
        }
      } else if (bits === 32) {
        if (endian === 'little') {
          // Little-endian: [(v >> 0) & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]
          // Note: Using >> 0 for first byte ensures proper parenthesization when value contains | operator
          return new PhpArrayLiteral([
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(0)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(8)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(16)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(24)), '&', PhpLiteral.Int(0xFF)) }
          ]);
        } else {
          // Big-endian: [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, (v >> 0) & 0xFF]
          // Note: Using >> 0 for last byte ensures proper parenthesization when value contains | operator
          return new PhpArrayLiteral([
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(24)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(16)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(8)), '&', PhpLiteral.Int(0xFF)) },
            { key: null, value: new PhpBinaryExpression(new PhpBinaryExpression(value, '>>', PhpLiteral.Int(0)), '&', PhpLiteral.Int(0xFF)) }
          ]);
        }
      }

      // Fallback for unsupported bit sizes
      return new PhpFunctionCall('unpack', [
        PhpLiteral.String('C*'),
        value
      ]);
    }

    /**
     * Transform ArrayLength → count($arr) or strlen($str)
     */
    transformArrayLength(node) {
      const array = this.transformExpression(node.array);

      // Check if the array is actually a string - use strlen() instead of count()
      let isString = false;
      if (node.array.resultType === 'string') {
        isString = true;
      }

      // Get variable name from various node types
      let varName = null;
      if (node.array.type === 'Identifier') {
        varName = node.array.name;
      } else if (node.array.nodeType === 'VariableReference') {
        varName = node.array.name;
      } else if (node.array.name) {
        varName = node.array.name;
      }

      if (varName && !isString) {
        const varType = this.getVariableType(varName);
        isString = varType && varType.name === 'string';

        // Also check for common string variable name patterns (be conservative)
        if (!isString) {
          const lowerVarName = varName.toLowerCase();
          // Only use very specific string patterns - avoid 'output', 'input' as they're often arrays
          // Exception: 'result' can be a string in many crypto algorithms
          // Note: 'plaintext', 'ciphertext', 'result' can be either string or array - removed to be safe
          const stringVarPatterns = ['encoded', 'decoded', 'text', 'string',
                                     'html', 'json', 'xml', 'iban',
                                     'prefix', 'suffix', 'separator', 'keyword',
                                     'alphabet', 'charset', 'bitstring', 'normalized'];
          // Exclude array-like patterns (these override string patterns if they conflict)
          const arrayVarPatterns = ['parts', 'bytes', 'data', 'chunks', 'blocks', 'items',
                                    'elements', 'array', 'list', 'buffer', 'state',
                                    'output', 'input', 'resultbytes', 'outputbytes'];
          const isArrayPattern = arrayVarPatterns.some(p => lowerVarName === p || lowerVarName.endsWith(p));

          // Only match exact names or _text, _string suffixes, but not array patterns
          if (!isArrayPattern &&
              (stringVarPatterns.includes(lowerVarName) ||
               lowerVarName.endsWith('_string') || lowerVarName.endsWith('_text') ||
               lowerVarName.endsWith('_str') || lowerVarName.endsWith('str') ||
               lowerVarName === 'encodedstr' || lowerVarName === 'decodedstr' ||
               lowerVarName === 'resultstr' || lowerVarName === 'outputstr'))
            isString = true;
        }
      }

      if (!varName && !isString && (node.array.type === 'MemberExpression' || node.array.type === 'ThisPropertyAccess')) {
        // Handle property access like $this->data or $obj->field
        let propName = node.array.property?.name || node.array.property?.value;
        // Handle ThisPropertyAccess where property might be a string directly
        if (!propName && typeof node.array.property === 'string') {
          propName = node.array.property;
        }
        if (propName) {
          // Check classFieldTypes for property type (try both original and snake_case)
          const snakePropName = this.toSnakeCase(propName);
          let fieldType = this.classFieldTypes.get(propName) || this.classFieldTypes.get(snakePropName);
          if (fieldType && fieldType.name === 'string') {
            isString = true;
          }
          // Common string property names heuristic - apply even without resultType
          const stringPropertyNames = ['data', 'text', 'input', 'output', 'message', 'content',
                                       'str', 'string', 'encoded', 'decoded',
                                       'prefix', 'suffix', 'separator', 'iban', 'code',
                                       'initial_key', 'extended_key', 'key_str', 'alphabet',
                                       'plaintext', 'ciphertext', 'result_str', 'input_str',
                                       'polybius_chars', 'keyword', 'decoded_data', 'encoded_data',
                                       'processed_key', 'prepared_key', 'normalized_input',
                                       'bit_string', 'bits', 'encoded_str', 'decoded_str',
                                       // Also handle names with _ prefix (camelCase from JS)
                                       '_initialKey', '_extendedKey', '_keyStr', '_alphabet',
                                       '_plaintext', '_ciphertext', '_resultStr', '_inputStr'];
          // Array property names to exclude
          const arrayPropertyNames = ['bytes', 'buffer', 'parts', 'chunks', 'blocks',
                                      'items', 'elements', 'values', 'keys', 'state'];
          // Normalize: remove leading underscore and convert to snake_case
          let normalizedProp = propName.startsWith('_') ? propName.substring(1) : propName;
          const snakeProp = this.toSnakeCase(normalizedProp);
          const isArrayProp = arrayPropertyNames.some(p => snakeProp === p || snakeProp.endsWith('_' + p));

          if (!isString && !isArrayProp && (stringPropertyNames.includes(propName) ||
                            stringPropertyNames.includes(snakeProp) ||
                            stringPropertyNames.includes('_' + normalizedProp) ||
                            snakeProp.endsWith('_key') || snakeProp.endsWith('_str') ||
                            snakeProp.endsWith('_text') || snakeProp.endsWith('_string'))) {
            // For known string property names, use strlen
            isString = true;
          }
        }
      }

      if (isString)
        return new PhpFunctionCall('strlen', [array]);

      // Use count() for arrays
      return new PhpFunctionCall('count', [array]);
    }

    /**
     * Transform ArrayAppend → $arr[] = $value or array_push
     * For spread elements: $arr = array_merge($arr, $spread)
     */
    transformArrayAppend(node) {
      const array = this.transformExpression(node.array);

      // Check if value is a SpreadElement
      if (node.value && node.value.type === 'SpreadElement') {
        // arr.push(...spread) -> $arr = array_merge($arr, $spread)
        const spreadValue = this.transformExpression(node.value.argument);
        return new PhpAssignment(
          array,
          '=',
          new PhpFunctionCall('array_merge', [array, spreadValue])
        );
      }

      const value = this.transformExpression(node.value);
      return new PhpFunctionCall('array_push', [array, value]);
    }

    /**
     * Transform ArrayFill
     */
    transformArrayFill(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      const start = node.start ? this.transformExpression(node.start) : PhpLiteral.Int(0);
      const end = node.end ? this.transformExpression(node.end) : new PhpFunctionCall('count', [array]);

      return new PhpFunctionCall('array_fill', [this._ensureIntSize(start), this._ensureIntSize(end), value]);
    }

    /**
     * Transform ArraySlice
     */
    transformArraySlice(node) {
      const array = this.transformExpression(node.array);
      const args = [array];

      if (node.start) {
        args.push(this.transformExpression(node.start));
      } else {
        args.push(PhpLiteral.Int(0));
      }

      if (node.end) {
        args.push(this.transformExpression(node.end));
      }

      return new PhpFunctionCall('array_slice', args);
    }

    /**
     * Transform ArraySplice
     */
    transformArraySplice(node) {
      const array = this.transformExpression(node.array);
      const args = [
        array,
        this.transformExpression(node.start)
      ];

      if (node.deleteCount !== null) {
        args.push(this.transformExpression(node.deleteCount));
      }

      if (node.items && node.items.length > 0) {
        args.push(...node.items.map(i => this.transformExpression(i)));
      }

      return new PhpFunctionCall('array_splice', args);
    }

    /**
     * Transform ArrayXor
     */
    transformArrayXor(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      const xorFunc = new PhpArrowFunction(
        [new PhpParameter('a'), new PhpParameter('b')],
        new PhpBinaryExpression(new PhpVariable('a'), '^', new PhpVariable('b'))
      );
      return new PhpFunctionCall('array_map', [xorFunc, ...args]);
    }

    /**
     * Transform ArrayForEach → array_walk($arr, fn($x) => ...)
     * JS: array.forEach(x => doSomething(x))
     * PHP: array_walk($array, fn($x) => doSomething($x))
     */
    transformArrayForEach(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new PhpFunctionCall('array_walk', [array, callback]);
    }

    /**
     * Transform ArrayMap → array_map(fn($x) => ..., $arr)
     * JS: array.map(x => transform(x))
     * PHP: array_map(fn($x) => transform($x), $array)
     */
    transformArrayMap(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new PhpFunctionCall('array_map', [callback, array]);
    }

    /**
     * Transform ArrayFilter → array_filter($arr, fn($x) => ...)
     * JS: array.filter(x => predicate(x))
     * PHP: array_filter($array, fn($x) => predicate($x))
     */
    transformArrayFilter(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      return new PhpFunctionCall('array_filter', [array, callback]);
    }

    /**
     * Transform ArraySome → check if any element matches
     * JS: array.some(x => predicate(x))
     * PHP: count(array_filter($array, fn($x) => predicate($x))) > 0
     */
    transformArraySome(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      const filtered = new PhpFunctionCall('array_filter', [array, callback]);
      const counted = new PhpFunctionCall('count', [filtered]);
      return new PhpBinaryExpression(counted, '>', PhpLiteral.Int(0));
    }

    /**
     * Transform ArrayEvery → check if all elements match
     * JS: array.every(x => predicate(x))
     * PHP: count(array_filter($array, fn($x) => !predicate($x))) === 0
     */
    transformArrayEvery(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      // Negate the callback result to find non-matching elements
      const negatedCallback = new PhpArrowFunction(
        callback.parameters,
        new PhpUnaryExpression('!', callback.body)
      );
      const filtered = new PhpFunctionCall('array_filter', [array, negatedCallback]);
      const counted = new PhpFunctionCall('count', [filtered]);
      return new PhpBinaryExpression(counted, '===', PhpLiteral.Int(0));
    }

    /**
     * Transform ArrayFind → find first matching element
     * JS: array.find(x => predicate(x))
     * PHP: array_values(array_filter($array, fn($x) => predicate($x)))[0] ?? null
     */
    transformArrayFind(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      const filtered = new PhpFunctionCall('array_filter', [array, callback]);
      const values = new PhpFunctionCall('array_values', [filtered]);
      const first = new PhpArrayAccess(values, PhpLiteral.Int(0));
      return new PhpNullCoalescing(first, PhpLiteral.Null());
    }

    /**
     * Transform ArrayFindIndex → find index of first matching element
     * JS: array.findIndex(x => predicate(x))
     * PHP: array_search(true, array_map(fn($x) => predicate($x), $array))
     */
    transformArrayFindIndex(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      const mapped = new PhpFunctionCall('array_map', [callback, array]);
      const search = new PhpFunctionCall('array_search', [PhpLiteral.Bool(true), mapped, PhpLiteral.Bool(true)]);
      // array_search returns false if not found, convert to -1
      return new PhpTernary(
        new PhpBinaryExpression(search, '===', PhpLiteral.Bool(false)),
        PhpLiteral.Int(-1),
        search
      );
    }

    /**
     * Transform ArrayReduce → array_reduce($arr, fn($acc, $x) => ..., $initial)
     * JS: array.reduce((acc, x) => combine(acc, x), initial)
     * PHP: array_reduce($array, fn($acc, $x) => combine($acc, $x), $initial)
     */
    transformArrayReduce(node) {
      const array = this.transformExpression(node.array);
      const callback = this.transformCallback(node.callback);
      const initial = node.initialValue ? this.transformExpression(node.initialValue) : PhpLiteral.Null();
      return new PhpFunctionCall('array_reduce', [array, callback, initial]);
    }

    /**
     * Transform ArraySort → usort($array, fn($a, $b) => ...)
     * JS: array.sort((a, b) => compare(a, b))
     * PHP: usort($array, fn($a, $b) => compare($a, $b))
     * Note: PHP usort modifies in place and returns bool, not the array
     */
    transformArraySort(node) {
      const array = this.transformExpression(node.array);
      if (node.compareFn) {
        const callback = this.transformCallback(node.compareFn);
        return new PhpFunctionCall('usort', [array, callback]);
      }
      // Default sort
      return new PhpFunctionCall('sort', [array]);
    }

    /**
     * Transform a callback (arrow function or function expression) to PHP
     */
    transformCallback(callback) {
      if (!callback) return new PhpArrowFunction([], PhpLiteral.Null());

      // Handle callbacks that are identifiers (like Number, String, Boolean)
      if (callback.type === 'Identifier') {
        // Map common JavaScript built-in functions to PHP equivalents
        const builtinMapping = {
          'Number': 'intval',
          'String': 'strval',
          'Boolean': 'boolval',
          'parseInt': 'intval',
          'parseFloat': 'floatval'
        };
        const phpFunc = builtinMapping[callback.name] || this.toSnakeCase(callback.name);
        return new PhpLiteral(`'${phpFunc}'`);
      }

      // Handle member expressions like Math.floor
      if (callback.type === 'MemberExpression' && !callback.body) {
        const expr = this.transformExpression(callback);
        // Wrap in a lambda
        const param = new PhpParameter('x');
        return new PhpArrowFunction([param], new PhpFunctionCall(expr, [new PhpVariable('x')]));
      }

      // Get parameters
      const params = (callback.params || []).map(p => {
        const name = this.toSnakeCase(p.name || 'x');
        return new PhpParameter(name);
      });

      // Transform body - handle case where callback has no body
      if (!callback.body) {
        // Fallback for unexpected callback format
        return new PhpArrowFunction(params, PhpLiteral.Null());
      }

      let body;
      if (callback.body.type === 'BlockStatement') {
        // For block statements, we need the last expression as return value
        // PHP arrow functions can only have a single expression
        // Fall back to closure for complex bodies
        const stmts = callback.body.body;
        if (stmts.length === 1 && stmts[0].type === 'ReturnStatement') {
          body = this.transformExpression(stmts[0].argument);
        } else {
          // Complex body - use a closure instead
          const phpBlock = this.transformBlockStatement(callback.body);
          return new PhpClosure(params, phpBlock);
        }
      } else {
        body = this.transformExpression(callback.body);
      }

      return new PhpArrowFunction(params, body);
    }

    /**
     * Ensure size expression is cast to int for PHP functions that require int
     * (e.g., array_fill, str_repeat)
     */
    _ensureIntSize(size) {
      // If it's already an int literal, no cast needed
      if (size.nodeType === 'Literal' && size.literalType === 'int')
        return size;
      // If it's a cast to int already, no need to double-cast
      if (size.nodeType === 'Cast' && (size.targetType === 'int' || size.targetType?.name === 'int'))
        return size;
      // Cast to int to handle float results from division
      return new PhpCast(size, 'int');
    }

    /**
     * Transform ArrayCreation → array_fill(0, (int)$size, 0)
     */
    transformArrayCreation(node) {
      const size = this.transformExpression(node.size);
      return new PhpFunctionCall('array_fill', [
        PhpLiteral.Int(0),
        this._ensureIntSize(size),
        PhpLiteral.Int(0)
      ]);
    }

    /**
     * Transform TypedArrayCreation → SplFixedArray or simple array
     */
    transformTypedArrayCreation(node) {
      // Handle ambiguous case: type-aware-transpiler sets BOTH buffer AND size for Identifiers
      // We need to determine from the name/type whether this is a size (integer) or buffer (array)
      if (node.buffer && node.size && node.buffer === node.size) {
        // Same node is set for both - need to determine from context
        const argNode = node.buffer;
        const argName = argNode.name || '';

        // SCREAMING_SNAKE_CASE constants are typically integer sizes
        if (/^[A-Z][A-Z0-9_]*$/.test(argName)) {
          const size = this.transformExpression(argNode);
          return new PhpFunctionCall('array_fill', [
            PhpLiteral.Int(0),
            this._ensureIntSize(size),
            PhpLiteral.Int(0)
          ]);
        }

        // Names suggesting integer size
        const lowerArgName = argName.toLowerCase();
        if (lowerArgName.includes('size') || lowerArgName.includes('length') ||
            lowerArgName.includes('count') || lowerArgName === 'n' ||
            lowerArgName === 'len' || lowerArgName === 'num' ||
            lowerArgName.includes('capacity') || lowerArgName.includes('chunk')) {
          const size = this.transformExpression(argNode);
          return new PhpFunctionCall('array_fill', [
            PhpLiteral.Int(0),
            this._ensureIntSize(size),
            PhpLiteral.Int(0)
          ]);
        }

        // Names suggesting array buffer - treat as buffer copy
        if (lowerArgName.includes('key') || lowerArgName.includes('data') ||
            lowerArgName.includes('buffer') || lowerArgName.includes('bytes') ||
            lowerArgName.includes('array') || lowerArgName.includes('block') ||
            lowerArgName.includes('state') || lowerArgName.includes('nonce') ||
            lowerArgName.includes('iv') || lowerArgName === '_key' ||
            lowerArgName === '_iv' || lowerArgName === '_nonce' ||
            lowerArgName.includes('aad') || lowerArgName.includes('tag') ||
            lowerArgName.includes('input') || lowerArgName.includes('output') ||
            lowerArgName.includes('plaintext') || lowerArgName.includes('ciphertext') ||
            lowerArgName.includes('message') || lowerArgName.includes('result') ||
            lowerArgName.includes('digest') || lowerArgName.includes('hash')) {
          const buffer = this.transformExpression(argNode);
          return new PhpFunctionCall('array_values', [buffer]);
        }

        // Default for ambiguous Identifiers: assume it's a size (most common case for constants)
        const size = this.transformExpression(argNode);
        return new PhpFunctionCall('array_fill', [
          PhpLiteral.Int(0),
          this._ensureIntSize(size),
          PhpLiteral.Int(0)
        ]);
      }

      // Check if this is a buffer copy (new Uint8Array(existingArray))
      if (node.buffer) {
        const buffer = this.transformExpression(node.buffer);
        // Copy array: array_values($buffer) or just [...$buffer]
        return new PhpFunctionCall('array_values', [buffer]);
      }

      const size = node.size ? this.transformExpression(node.size) : null;

      if (size) {
        // BinaryExpression indicates arithmetic (e.g., count($arr) + 16) - this is a size, not a buffer
        if (size.nodeType === 'BinaryExpression') {
          return new PhpFunctionCall('array_fill', [
            PhpLiteral.Int(0),
            this._ensureIntSize(size),
            PhpLiteral.Int(0)
          ]);
        }

        // Check if size is a literal number - if so, use array_fill
        // If size is a variable/expression that could be an array, it might be a copy operation
        if (size.nodeType === 'Literal' && size.literalType === 'int') {
          // Create fixed-size array initialized with zeros
          return new PhpFunctionCall('array_fill', [
            PhpLiteral.Int(0),
            size,
            PhpLiteral.Int(0)
          ]);
        }

        // Ternary/Conditional expressions are always sizes (choosing between two integer values)
        // e.g., new Uint8Array(condition ? 48 : 32)
        if (size.nodeType === 'Ternary' || size.nodeType === 'ConditionalExpression') {
          return new PhpFunctionCall('array_fill', [
            PhpLiteral.Int(0),
            this._ensureIntSize(size),
            PhpLiteral.Int(0)
          ]);
        }

        // If size is a function call that returns an array (like array_slice),
        // this is a copy operation, not a size
        if (size.nodeType === 'FunctionCall') {
          const funcName = typeof size.functionName === 'string' ? size.functionName :
                           (size.functionName?.name || '');
          // Functions that return integers (size, not buffer)
          const intFunctions = ['count', 'strlen', 'sizeof', 'mb_strlen', 'ord'];
          if (intFunctions.includes(funcName)) {
            return new PhpFunctionCall('array_fill', [
              PhpLiteral.Int(0),
              this._ensureIntSize(size),
              PhpLiteral.Int(0)
            ]);
          }
          const arrayFunctions = ['array_slice', 'array_values', 'array_merge',
                                  'array_map', 'array_filter', 'array_keys',
                                  'array_reverse', 'array_unique', 'array_chunk'];
          if (arrayFunctions.includes(funcName)) {
            // This is copying an array, just return the function call result
            return new PhpFunctionCall('array_values', [size]);
          }
        }

        // For non-literal sizes, we need to be careful - it could be:
        // 1. A variable holding a number (size): new Uint8Array(size)
        // 2. A variable holding an array (copy): new Uint8Array(existingArray)
        // Since we can't always tell, use a conditional approach or just array_fill
        // In most crypto code, passing an array to Uint8Array means "copy this"
        // So let's check if it's a member expression or variable that likely refers to an array
        if (size.nodeType === 'Variable' || size.nodeType === 'PropertyAccess' ||
            size.nodeType === 'ArrayAccess' || size.nodeType === 'MethodCall' ||
            size.nodeType === 'Identifier') {
          // Could be either size or buffer - check name patterns
          const sizeStr = size.name || (size.property) || '';
          const lowerName = String(sizeStr).toLowerCase();

          // Check for SCREAMING_SNAKE_CASE constants - these are typically integer sizes
          if (/^[A-Z][A-Z0-9_]*$/.test(sizeStr)) {
            return new PhpFunctionCall('array_fill', [
              PhpLiteral.Int(0),
              this._ensureIntSize(size),
              PhpLiteral.Int(0)
            ]);
          }

          // Names that suggest an integer count
          if (lowerName.includes('size') || lowerName.includes('length') ||
              lowerName.includes('count') || lowerName === 'n' ||
              lowerName === 'len' || lowerName === 'num') {
            return new PhpFunctionCall('array_fill', [
              PhpLiteral.Int(0),
              this._ensureIntSize(size),
              PhpLiteral.Int(0)
            ]);
          }

          // Names that suggest an array to copy
          if (lowerName.includes('key') || lowerName.includes('data') ||
              lowerName.includes('buffer') || lowerName.includes('bytes') ||
              lowerName.includes('array') || lowerName.includes('block') ||
              lowerName.includes('state') || lowerName.includes('nonce') ||
              lowerName.includes('iv') || lowerName === '_key' ||
              lowerName === '_iv' || lowerName === '_nonce' ||
              lowerName.includes('aad') || lowerName.includes('tag') ||
              lowerName.includes('input') || lowerName.includes('output') ||
              lowerName.includes('plaintext') || lowerName.includes('ciphertext') ||
              lowerName.includes('message') || lowerName.includes('result') ||
              lowerName.includes('digest') || lowerName.includes('hash')) {
            return new PhpFunctionCall('array_values', [size]);
          }
        }

        // Default: When we can't determine, use a runtime check:
        // is_array($x) ? array_values($x) : array_fill(0, $x, 0)
        // But this adds complexity, so for now assume array if name doesn't suggest count
        // Most TypedArray(variable) usages in crypto code are copying arrays, not creating by size
        return new PhpFunctionCall('array_values', [size]);
      }

      return new PhpArrayLiteral([]);
    }

    /**
     * Transform Cast operations
     */
    transformCast(node) {
      // CRITICAL FIX: Read from node.arguments?.[0] || node.expression (same bug pattern as C#)
      const value = this.transformExpression(node.arguments?.[0] || node.expression);
      const targetType = node.targetType || 'int';

      switch (targetType) {
        case 'uint32':
        case 'int32':
        case 'int':
          return new PhpBinaryExpression(
            new PhpCast(value, 'int'),
            '&',
            PhpLiteral.Int(0xFFFFFFFF)
          );
        case 'uint8':
        case 'byte':
          return new PhpBinaryExpression(
            new PhpCast(value, 'int'),
            '&',
            PhpLiteral.Int(0xFF)
          );
        case 'uint16':
          return new PhpBinaryExpression(
            new PhpCast(value, 'int'),
            '&',
            PhpLiteral.Int(0xFFFF)
          );
        default:
          return new PhpCast(value, 'int');
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to PHP equivalents
      if (name === 'undefined') return PhpLiteral.Null();
      if (name === 'null') return PhpLiteral.Null();
      if (name === 'NaN') return new PhpFunctionCall('NAN', []);
      if (name === 'Infinity') return new PhpFunctionCall('INF', []);

      // Check if this is a declared constant (no $ prefix in PHP)
      if (this.declaredConstants.has(name)) {
        return new PhpIdentifier(this.declaredConstants.get(name));
      }

      return new PhpVariable(this.toSnakeCase(name));
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      // Handle regex literals - /pattern/flags
      if (node.regex) {
        const pattern = node.regex.pattern || '';
        const flags = node.regex.flags || '';
        // Build PHP PCRE pattern - wrap in delimiters and add flags
        let phpFlags = '';
        if (flags.includes('i')) phpFlags += 'i';
        if (flags.includes('m')) phpFlags += 'm';
        if (flags.includes('s')) phpFlags += 's';
        // PHP uses / as delimiter, escape any / in the pattern
        const escapedPattern = pattern.replace(/\//g, '\\/');
        return PhpLiteral.String('/' + escapedPattern + '/' + phpFlags);
      }

      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return PhpLiteral.Int(node.value);
        }
        return PhpLiteral.Float(node.value);
      }

      if (typeof node.value === 'string') {
        return PhpLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return PhpLiteral.Bool(node.value);
      }

      if (node.value === null) {
        return PhpLiteral.Null();
      }
      // Handle undefined - treat same as null in PHP
      if (node.value === undefined) {
        return PhpLiteral.Null();
      }

      return PhpLiteral.Null();
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      // Handle typeof comparisons - PHP doesn't have typeof operator
      // typeof x === 'string' → is_string($x)
      // typeof x !== 'string' → !is_string($x)
      if ((node.operator === '===' || node.operator === '==' ||
           node.operator === '!==' || node.operator === '!=') &&
          node.left.type === 'UnaryExpression' && node.left.operator === 'typeof' &&
          node.right.type === 'Literal' && typeof node.right.value === 'string') {

        const operand = this.transformExpression(node.left.argument);
        const typeStr = node.right.value;
        const isNegated = node.operator === '!==' || node.operator === '!=';

        let typeCheck;
        switch (typeStr) {
          case 'string':
            typeCheck = new PhpFunctionCall('is_string', [operand]);
            break;
          case 'number':
            typeCheck = new PhpFunctionCall('is_numeric', [operand]);
            break;
          case 'boolean':
            typeCheck = new PhpFunctionCall('is_bool', [operand]);
            break;
          case 'object':
            // PHP: object or array (JS arrays are objects)
            typeCheck = new PhpBinaryExpression(
              new PhpFunctionCall('is_object', [operand]),
              '||',
              new PhpFunctionCall('is_array', [operand])
            );
            break;
          case 'function':
            typeCheck = new PhpFunctionCall('is_callable', [operand]);
            break;
          case 'undefined':
            // For undefined, use the correct operator directly to avoid precedence issues
            // typeof x !== 'undefined' -> $x !== null (not !($x === null))
            typeCheck = new PhpBinaryExpression(operand, isNegated ? '!==' : '===', PhpLiteral.Null());
            if (isNegated) return typeCheck;  // Already handled negation
            break;
          default:
            // Fall back to gettype comparison for unknown types
            typeCheck = new PhpBinaryExpression(
              new PhpFunctionCall('gettype', [operand]),
              '===',
              PhpLiteral.String(typeStr)
            );
        }

        if (isNegated)
          return new PhpUnaryExpression('!', typeCheck, true);

        return typeCheck;
      }

      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      let operator = node.operator;
      if (operator === '===') operator = '===';
      if (operator === '!==') operator = '!==';
      if (operator === '>>>' || operator === '>>>') operator = '>>';

      // Handle JavaScript || used for default/fallback values -> PHP ?:
      // JavaScript || returns the first truthy value, PHP || returns boolean
      // PHP's ?: (Elvis operator) behaves like JS ||: returns left if truthy, else right
      if (operator === '||') {
        const leftType = node.left.type;

        // Use Elvis operator (?:) when || is used for value fallback, not boolean logic
        // This includes: array access, property access, variables, function calls
        const isValueContext = leftType === 'MemberExpression' ||
                               leftType === 'Identifier' ||
                               leftType === 'ThisPropertyAccess' ||
                               leftType === 'CallExpression' ||
                               leftType === 'ComputedMemberExpression';

        if (isValueContext) {
          // Use PHP Elvis operator for truthy fallback (like JS ||)
          return new PhpShortTernary(left, right);
        }
      }

      // Handle JavaScript 'in' operator: key in object -> array_key_exists($key, $obj) or isset($obj[$key])
      if (operator === 'in') {
        // left is the key, right is the object/array
        return new PhpFunctionCall('array_key_exists', [left, right]);
      }

      // Handle string concatenation: + with strings should be . in PHP
      if (operator === '+') {
        // Check if either operand is a string literal or string function call
        const leftIsString = this._isStringExpression(node.left, left);
        const rightIsString = this._isStringExpression(node.right, right);

        if (leftIsString || rightIsString) {
          operator = '.';
        }
      }

      return new PhpBinaryExpression(left, operator, right);
    }

    /**
     * Determine if an expression is a string type
     * @private
     */
    _isStringExpression(original, transformed) {
      // Check original AST node for string literal
      if (original && original.type === 'Literal' && typeof original.value === 'string')
        return true;

      // Check transformed PHP node for string literal
      if (transformed && transformed.nodeType === 'Literal' && transformed.literalType === 'string')
        return true;

      // Check for binary expression that results in a string
      // If a BinaryExpression uses + and any operand is a string, the result is a string
      // Also, if the PHP result uses . (concatenation), it's a string
      if (original && original.type === 'BinaryExpression') {
        // If any operand in a + chain is a string, the whole expression is a string
        if (original.operator === '+') {
          if (this._isStringExpression(original.left, null) ||
              this._isStringExpression(original.right, null))
            return true;
        }
      }

      // Check for PHP BinaryExpression with . operator (already string concatenation)
      if (transformed && transformed.nodeType === 'BinaryExpression' && transformed.operator === '.')
        return true;

      // Check for function calls that return strings
      if (transformed && transformed.nodeType === 'FunctionCall') {
        const funcName = typeof transformed.functionName === 'string' ? transformed.functionName :
                         (transformed.functionName?.name || '');
        const stringFunctions = ['hex2bin', 'substr', 'str_repeat', 'implode', 'strtolower',
                                  'strtoupper', 'trim', 'chr', 'sprintf', 'pack', 'base64_decode',
                                  'base64_encode', 'strrev', 'str_pad'];
        if (stringFunctions.includes(funcName))
          return true;
      }

      // Check for string method calls
      if (original && original.type === 'CallExpression') {
        const callee = original.callee;
        if (callee && callee.type === 'MemberExpression') {
          const method = callee.property?.name || callee.property?.value;
          const stringMethods = ['toString', 'charAt', 'substring', 'substr', 'toLowerCase',
                                 'toUpperCase', 'trim', 'padStart', 'padEnd', 'replace', 'replaceAll'];
          if (stringMethods.includes(method))
            return true;
        }
      }

      // Check for variables with string-like names (char, str, text, etc.)
      if (original && original.type === 'Identifier') {
        const lowerName = original.name.toLowerCase();
        if (lowerName.startsWith('char') || lowerName.startsWith('str') ||
            lowerName.startsWith('text') || lowerName === 'result' ||
            lowerName === 'output' || lowerName === 'encoded' ||
            lowerName === 'decoded' || lowerName.endsWith('string') ||
            lowerName.endsWith('char') || lowerName.endsWith('str'))
          return true;
      }

      // Check PHP identifier for similar patterns
      if (transformed && transformed.nodeType === 'Variable') {
        const lowerName = (transformed.name || '').toLowerCase();
        if (lowerName.startsWith('char') || lowerName.startsWith('str') ||
            lowerName.startsWith('text') || lowerName === 'result' ||
            lowerName === 'output' || lowerName === 'encoded' ||
            lowerName === 'decoded' || lowerName.endsWith('string') ||
            lowerName.endsWith('char') || lowerName.endsWith('str'))
          return true;
      }

      // Check for member access to alphabet, charset, characters, etc.
      if (original && original.type === 'MemberExpression') {
        const propName = original.property?.name || original.property?.value;
        if (propName) {
          const lowerProp = String(propName).toLowerCase();
          if (lowerProp.includes('alphabet') || lowerProp.includes('charset') ||
              lowerProp.includes('character') || lowerProp === 'chars' ||
              lowerProp === 'letters' || lowerProp === 'digits' ||
              lowerProp === 'symbols' || lowerProp === 'table')
            return true;
        }
        // Also check if object is alphabet (alphabet[i] returns string)
        const objName = original.object?.name || original.object?.property?.name;
        if (objName) {
          const lowerObj = String(objName).toLowerCase();
          if (lowerObj.includes('alphabet') || lowerObj.includes('charset') ||
              lowerObj.includes('characters') || lowerObj === 'chars')
            return true;
        }
      }

      // Check PHP member access for similar patterns
      if (transformed && (transformed.nodeType === 'PropertyAccess' || transformed.nodeType === 'ArrayAccess')) {
        const propName = transformed.property?.name || transformed.property?.value ||
                         (typeof transformed.property === 'string' ? transformed.property : null);
        if (propName) {
          const lowerProp = String(propName).toLowerCase();
          if (lowerProp.includes('alphabet') || lowerProp.includes('charset') ||
              lowerProp.includes('character') || lowerProp === 'chars' ||
              lowerProp === 'letters' || lowerProp === 'digits')
            return true;
        }
      }

      return false;
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      // Handle JavaScript 'delete' operator -> PHP unset()
      if (node.operator === 'delete') {
        const operand = this.transformExpression(node.argument);
        return new PhpFunctionCall('unset', [operand]);
      }

      const operand = this.transformExpression(node.argument);
      return new PhpUnaryExpression(node.operator, operand, node.prefix);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      // Handle array.length = 0 pattern -> $array = []
      // JS: array.length = 0 clears the array; PHP doesn't support assignment to length
      if (node.left?.type === 'MemberExpression' && node.operator === '=') {
        const propName = node.left.property?.name || node.left.property?.value;
        if (propName === 'length' &&
            node.right?.type === 'Literal' &&
            node.right?.value === 0) {
          // arr.length = 0 -> $arr = []
          const arrayExpr = this.transformExpression(node.left.object);
          return new PhpAssignment(arrayExpr, '=', new PhpArrayLiteral([]));
        }
      }

      // Handle IL ArrayLength node on left side of assignment
      // arr.length = 0 gets converted to ArrayLength IL node
      const leftType = node.left?.type || node.left?.ilNodeType;
      if (leftType === 'ArrayLength' && node.operator === '=') {
        const rightVal = node.right?.value;
        if (rightVal === 0 || rightVal === '0') {
          // arr.length = 0 -> $arr = []
          const arrayExpr = this.transformExpression(node.left.array);
          return new PhpAssignment(arrayExpr, '=', new PhpArrayLiteral([]));
        }
      }

      // Track variables assigned from CallExpression, ObjectExpression, or array access as arrays
      // JS objects and function returns become PHP associative arrays
      if (node.left?.type === 'Identifier' && node.operator === '=') {
        const varName = node.left.name;
        const snakeVarName = this.toSnakeCase(varName);
        const rightType = node.right?.type || node.right?.ilNodeType;

        // Check if right side is a computed member expression (array access)
        // e.g., params = paramTable[$key] - the array element might be an object
        const isArrayAccess = rightType === 'MemberExpression' && node.right.computed;

        // Check if right side is accessing a known array's element
        // If the base array contains objects, the element is also an object (PHP array)
        let isArrayElementAccess = false;
        if (isArrayAccess) {
          // Get the base variable name, handling nested member expressions
          let baseVar = null;
          let baseObj = node.right.object;

          // Traverse nested member expressions to find the root variable or this.property
          while (baseObj) {
            if (baseObj.type === 'Identifier') {
              baseVar = baseObj.name;
              break;
            } else if (baseObj.type === 'ThisExpression') {
              // this.property[...] - check if the property is tracked
              break;
            } else if (baseObj.type === 'MemberExpression' || baseObj.type === 'ThisPropertyAccess') {
              // Check if this specific property path is tracked
              const propName = baseObj.property?.name || baseObj.property?.value ||
                              (typeof baseObj.property === 'string' ? baseObj.property : null);
              if (propName && this.arrayProperties.has(propName)) {
                isArrayElementAccess = true;
                break;
              }
              baseObj = baseObj.object;
            } else {
              break;
            }
          }

          if (baseVar && !isArrayElementAccess) {
            const snakeBaseVar = this.toSnakeCase(baseVar);
            isArrayElementAccess = this.arrayProperties.has(baseVar) ||
                                   this.arrayProperties.has(snakeBaseVar);
          }

          // Heuristic: array element access often returns objects that become PHP arrays
          // Especially for patterns like this.keySchedule[round] or table[index]
          // Be conservative - only apply if not already determined
          if (!isArrayElementAccess && isArrayAccess) {
            // Check if any part of the chain originates from this.property or an identifier
            // This handles deep nesting like this.keySchedule['roundKeys'][round]
            let checkObj = node.right.object;
            while (checkObj) {
              if (checkObj.type === 'ThisExpression' ||
                  checkObj.type === 'Identifier' ||
                  checkObj.type === 'ThisPropertyAccess') {
                // ThisPropertyAccess is a terminal - it represents this.propertyName
                isArrayElementAccess = true;
                break;
              }
              if (checkObj.type === 'MemberExpression') {
                checkObj = checkObj.object;
              } else {
                break;
              }
            }
          }
        }

        if (rightType === 'ObjectExpression' ||
            rightType === 'CallExpression' ||
            rightType === 'ThisMethodCall' ||
            rightType === 'MethodCall' ||
            rightType === 'StaticMethodCall' ||
            isArrayElementAccess) {
          this.arrayProperties.add(varName);
          this.arrayProperties.add(snakeVarName);
        }
      }

      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      // Convert JavaScript-only operators to PHP equivalents
      let operator = node.operator;

      // Unsigned right shift assignment (>>>=) -> regular right shift assignment (>>=)
      // PHP doesn't have unsigned right shift
      if (operator === '>>>=') {
        operator = '>>=';
      }

      // Handle string concatenation: += with strings should become .= in PHP
      if (operator === '+=') {
        // Check if right-hand side is a string or array access to a string array
        let rightIsString = right.nodeType === 'Literal' && right.literalType === 'string';
        // Check if left variable is known to be a string type
        let leftIsString = false;
        if (node.left.type === 'Identifier') {
          const varType = this.getVariableType(node.left.name);
          leftIsString = varType && varType.name === 'string';
        }
        // Check IL type hints
        if (node.right.resultType === 'string' || node.left.resultType === 'string') {
          leftIsString = true;
        }
        // Check if right side is a function call that returns a string
        if (right.nodeType === 'FunctionCall') {
          const stringFunctions = ['strtoupper', 'strtolower', 'chr', 'substr', 'trim', 'ltrim', 'rtrim',
                                    'str_repeat', 'str_pad', 'sprintf', 'implode', 'join', 'strrev',
                                    'ucfirst', 'ucwords', 'lcfirst', 'nl2br', 'number_format'];
          const funcName = typeof right.functionName === 'string' ? right.functionName :
                           (right.functionName?.name || right.functionName?.identifier || '');
          if (stringFunctions.includes(funcName)) {
            rightIsString = true;
          }
        }
        if (rightIsString || leftIsString) {
          operator = '.=';
        }
      }

      return new PhpAssignment(left, operator, right);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new PhpUnaryExpression(node.operator, operand, node.prefix);
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      // Handle Math property access (Math.PI, Math.E, etc.)
      if (node.object.type === 'Identifier' && node.object.name === 'Math' && !node.computed) {
        const prop = node.property.name || node.property.value;
        switch (prop) {
          case 'PI':
            return new PhpIdentifier('M_PI');
          case 'E':
            return new PhpIdentifier('M_E');
          case 'LN2':
            return new PhpIdentifier('M_LN2');
          case 'LN10':
            return new PhpIdentifier('M_LN10');
          case 'LOG2E':
            return new PhpIdentifier('M_LOG2E');
          case 'LOG10E':
            return new PhpIdentifier('M_LOG10E');
          case 'SQRT2':
            return new PhpIdentifier('M_SQRT2');
          case 'SQRT1_2':
            return new PhpIdentifier('M_SQRT1_2');
          default:
            // Unknown Math constant - try as-is
            return new PhpIdentifier('M_' + prop);
        }
      }

      // Handle Number constants (Number.MAX_SAFE_INTEGER, etc.)
      if (node.object.type === 'Identifier' && node.object.name === 'Number' && !node.computed) {
        const prop = node.property.name || node.property.value;
        switch (prop) {
          case 'MAX_SAFE_INTEGER':
            // 2^53 - 1, but PHP uses PHP_INT_MAX
            return new PhpIdentifier('PHP_INT_MAX');
          case 'MIN_SAFE_INTEGER':
            return new PhpIdentifier('PHP_INT_MIN');
          case 'MAX_VALUE':
            return new PhpIdentifier('PHP_FLOAT_MAX');
          case 'MIN_VALUE':
            return new PhpIdentifier('PHP_FLOAT_MIN');
          case 'POSITIVE_INFINITY':
            return new PhpIdentifier('INF');
          case 'NEGATIVE_INFINITY':
            return new PhpUnaryExpression('-', new PhpIdentifier('INF'), true);
          case 'NaN':
            return new PhpIdentifier('NAN');
          case 'EPSILON':
            return new PhpIdentifier('PHP_FLOAT_EPSILON');
          default:
            return new PhpIdentifier('PHP_INT_MAX');
        }
      }

      // Handle global.OpCodes.X or globalThis.OpCodes.X -> OpCodes.X (nested)
      // Also handles global.AlgorithmFramework.X -> X (stripping prefix)
      if (node.object.type === 'MemberExpression' &&
          node.object.object?.type === 'Identifier' &&
          (node.object.object.name === 'global' || node.object.object.name === 'globalThis')) {
        const globalProp = node.object.property?.name || node.object.property?.value;
        const outerProp = node.property.name || node.property.value;

        if (globalProp === 'OpCodes') {
          // global.OpCodes.MASK32 -> call the OpCodes function or return constant
          // This is a method/constant on OpCodes - transform it properly
          const opCodeNode = {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'OpCodes' },
            property: node.property,
            computed: node.computed
          };
          return this.transformMemberExpression(opCodeNode);
        } else if (globalProp === 'AlgorithmFramework') {
          // global.AlgorithmFramework.X -> X (strip prefix)
          if (this.ENUM_OBJECTS.has(outerProp))
            return new PhpVariable(this.toSnakeCase(outerProp));
          if (this.FRAMEWORK_TYPES.has(outerProp))
            return new PhpIdentifier(outerProp);
          return new PhpIdentifier(outerProp);
        }
      }

      // Handle global.X or globalThis.X -> strip prefix for known globals
      if (node.object.type === 'Identifier' &&
          (node.object.name === 'global' || node.object.name === 'globalThis')) {
        const propName = node.property.name || node.property.value;
        // global.OpCodes -> use OpCodes directly (will be available as function calls)
        if (propName === 'OpCodes' || propName === 'AlgorithmFramework')
          return new PhpIdentifier(propName);
        // For other global properties, just return the property name as variable
        return new PhpVariable(this.toSnakeCase(propName));
      }

      // Handle AlgorithmFramework.X pattern - strip AlgorithmFramework prefix
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        const propName = node.property.name || node.property.value;

        // Check if this is an enum object
        if (this.ENUM_OBJECTS.has(propName))
          return new PhpVariable(this.toSnakeCase(propName));

        // Check if this is a framework type (LinkItem, KeySize, etc.)
        if (this.FRAMEWORK_TYPES.has(propName))
          return new PhpIdentifier(propName);

        return new PhpIdentifier(propName);
      }

      // Handle AlgorithmFramework.CategoryType.BLOCK pattern (nested)
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {
        const middleProp = node.object.property.name || node.object.property.value;
        const outerProp = node.property.name || node.property.value;

        // For enums like CategoryType.BLOCK -> return as string literal 'BLOCK'
        if (this.ENUM_OBJECTS.has(middleProp))
          return PhpLiteral.String(outerProp);

        return new PhpPropertyAccess(
          new PhpVariable(this.toSnakeCase(middleProp)),
          outerProp
        );
      }

      const object = this.transformExpression(node.object);

      if (node.computed) {
        const index = this.transformExpression(node.property);
        return new PhpArrayAccess(object, index);
      } else {
        const field = node.property.name || node.property.value;

        // Check if this is an all-caps constant (preserve case)
        const isConstant = /^[A-Z][A-Z0-9_]*$/.test(field);
        let fieldName = isConstant ? field : this.toSnakeCase(field);

        // Remove leading underscore for $this->property access
        if (node.object.type === 'ThisExpression' && fieldName.startsWith('_'))
          fieldName = fieldName.substring(1);

        // Check if the object is known to be an array type - use array access instead
        // This handles JS objects converted to PHP arrays that are then accessed with dot notation
        let isArrayType = false;
        let objectType = null;

        // Common object fields that are almost always from JS objects (become PHP arrays)
        // This heuristic helps when type tracking is incomplete
        const commonObjectFields = ['low', 'high', 'x', 'y', 'z', 'type', 'value', 'key', 'name',
                                    'rotation', 'nskip', 'K2', 'K1', 'ADDITIVE', 'XOR', 'left', 'right',
                                    's00', 's01', 's10', 's11', 'n', 'm', 'w', 'distance', 'matrix',
                                    'C', 'FK', 'ROUNDS', 'RC', 'degree', 'symbol', 'data', 'hi', 'lo',
                                    'tk0', 'tk1', 'tk2', 'buffer', 'p', 'g', 'q', 'N', 't',
                                    'sparse_matrix', 'seeded_random', 'PI', 'op_codes', 'original_size'];

        if (node.object.type === 'Identifier') {
          const varName = node.object.name;
          const snakeVarName = this.toSnakeCase(varName);
          objectType = this.getVariableType(varName);

          // Check if this is an enum value access (CategoryType.BLOCK, etc.)
          // These should return string literals, not static property access
          if (this.ENUM_OBJECTS.has(varName)) {
            // CategoryType.BLOCK -> 'BLOCK' (string literal)
            return PhpLiteral.String(field);
          }

          // Handle OpCodes constants and methods specially
          if (varName === 'OpCodes') {
            // OpCodes.MASK32, OpCodes.MASK64, etc. -> inline the constant values
            const opCodesConstants = {
              'MASK8': '0xFF',
              'MASK16': '0xFFFF',
              'MASK32': '0xFFFFFFFF',
              'MASK64': '0xFFFFFFFFFFFFFFFF'
            };
            if (opCodesConstants[field]) {
              return PhpLiteral.Int(parseInt(opCodesConstants[field]));
            }
            // For other OpCodes properties, return as function call (since OpCodes methods are functions)
            // This shouldn't happen often since most OpCodes.X() are method calls handled elsewhere
            return new PhpFunctionCall(this.toSnakeCase(field), []);
          }

          // Check if this looks like a class name (PascalCase) accessing static property
          // e.g., Sm4Constants.FK -> Sm4Constants::$FK
          const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(varName);
          // Also check if this is a known class from the source (collected during transformation)
          const isKnownClass = this.knownClassNames && this.knownClassNames.has(varName);
          // Exclude framework types that shouldn't be treated as static property access
          const isFrameworkType = this.FRAMEWORK_TYPES && this.FRAMEWORK_TYPES.has(varName);

          if ((isPascalCase || isKnownClass) && !objectType && !isFrameworkType) {
            // This is likely a class name accessing a static property
            // Use static property access: ClassName::$property
            return new PhpStaticPropertyAccess(varName, fieldName);
          }

          // If this variable is a known class instance (from new X()), never treat as array
          const isClassInstance = this.classInstances.has(varName) || this.classInstances.has(snakeVarName);
          if (isClassInstance) {
            isArrayType = false;
          } else {
            // Check both explicit type and if this variable name is in arrayProperties
            // (handles parameters that receive array values with same name)
            // Also check snake_case version for consistency
            isArrayType = (objectType && objectType.name === 'array') ||
                         this.arrayProperties.has(varName) ||
                         this.arrayProperties.has(snakeVarName);
          }

          // For 'mixed' type parameters accessing certain object fields, assume array access
          // But ONLY for fields that are very unlikely to be class properties
          // Skip this heuristic for known class instances
          // Exclude common class property names like 'name', 'type', 'key', 'value', 'data', 'algorithm'
          const safeObjectOnlyFields = ['low', 'high', 'hi', 'lo', 'left', 'right', 'x', 'y', 'z',
                                        'rotation', 'nskip', 'K2', 'K1', 's00', 's01', 's10', 's11',
                                        'tk0', 'tk1', 'tk2', 'original_size'];
          if (!isClassInstance && !isArrayType && objectType && objectType.name === 'mixed' && safeObjectOnlyFields.includes(field))
            isArrayType = true;
        } else if (node.object.type === 'ThisPropertyAccess') {
          // Check type of this.property
          const propName = node.object.propertyName || node.object.property?.name || node.object.property;
          objectType = this.getVariableType('this.' + propName);
          isArrayType = (objectType && objectType.name === 'array') || this.arrayProperties.has(propName);
        } else if (node.object.type === 'MemberExpression' &&
                   node.object.object?.type === 'ThisExpression') {
          // Standard AST: this.property
          const propName = node.object.property?.name || node.object.property?.value;
          objectType = this.getVariableType('this.' + propName);
          isArrayType = (objectType && objectType.name === 'array') || this.arrayProperties.has(propName);
        } else if (node.object.type === 'CallExpression') {
          // Function call results that return objects become PHP arrays
          // Use array access for property access on function return values
          isArrayType = true;
        } else if (node.object.type === 'MemberExpression' && node.object.computed) {
          // Computed member expression (array indexing): arr[i].property
          // If the base array contains objects that become PHP arrays, use array access
          const baseVarName = node.object.object?.name ||
                              (node.object.object?.type === 'Identifier' ? node.object.object.name : null);
          if (baseVarName) {
            const snakeBaseVarName = this.toSnakeCase(baseVarName);
            // Check if base array or its elements are known to be arrays
            isArrayType = this.arrayProperties.has(baseVarName) ||
                          this.arrayProperties.has(snakeBaseVarName);
          }
          // Even without explicit tracking, computed member expressions often access
          // array elements that are JS objects (now PHP arrays)
          // Apply heuristic: common object fields that suggest object/struct access
          if (!isArrayType && commonObjectFields.includes(field))
            isArrayType = true;
        }

        // Heuristic: all-uppercase property names (like SBOX, INV_SBOX, RCON) typically
        // represent constants stored in JS objects that become PHP associative arrays
        // This handles patterns like: tables.SBOX, config.MAX_SIZE, etc.
        if (!isArrayType && /^[A-Z][A-Z0-9_]*$/.test(field)) {
          // But exclude access on 'this' and known class names (which use static properties)
          const isThisAccess = node.object.type === 'ThisExpression' ||
                               node.object.type === 'ThisPropertyAccess';
          const objectName = node.object.name || '';
          const snakeObjectName = objectName ? this.toSnakeCase(objectName) : '';
          const isClassAccess = this.knownClassNames?.has(objectName) ||
                               /^[A-Z][a-zA-Z0-9]*$/.test(objectName);
          // Also check if this is a known class instance
          const isInstanceAccess = this.classInstances.has(objectName) ||
                                   this.classInstances.has(snakeObjectName);
          if (!isThisAccess && !isClassAccess && !isInstanceAccess)
            isArrayType = true;
        }

        // If object is an array type, use array access for the "property"
        if (isArrayType) {
          // Use original field name for array key access (matches object literal keys)
          return new PhpArrayAccess(object, PhpLiteral.String(field));
        }

        return new PhpPropertyAccess(object, fieldName);
      }
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle super() calls - PHP uses parent::__construct()
      if (node.callee.type === 'Super') {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new PhpStaticMethodCall('parent', '__construct', args);
      }

      // Handle OpCodes method calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle AlgorithmFramework.Find() → find()
      // In PHP test harness, find() is a global function
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'AlgorithmFramework') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        // AlgorithmFramework.Find(name) -> find(name)
        // AlgorithmFramework.RegisterAlgorithm(algo) -> register_algorithm(algo)
        return new PhpFunctionCall(this.toSnakeCase(method), args);
      }

      // Handle Array.isArray(x) → is_array($x)
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Array' &&
          (node.callee.property.name === 'isArray' || node.callee.property.value === 'isArray')) {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new PhpFunctionCall('is_array', args);
      }

      // Handle Array.from(x) → just return the argument (it's already an array in PHP context)
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Array' &&
          (node.callee.property.name === 'from' || node.callee.property.value === 'from')) {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return args[0]; // Just return the first argument
      }

      // Handle Uint8Array.from(x), Int32Array.from(x), etc. → array_values(x) or just x
      // TypedArray.from() creates a copy of the array
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          /^(Uint8|Uint16|Uint32|Int8|Int16|Int32|Float32|Float64)Array$/.test(node.callee.object.name) &&
          (node.callee.property.name === 'from' || node.callee.property.value === 'from')) {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        // Return array_values to ensure proper copy
        return new PhpFunctionCall('array_values', [args[0]]);
      }

      // Handle Object.freeze(x) → just return the argument (PHP arrays are copy-on-write)
      // In PHP, passing arrays around already creates copies, so freezing is a no-op
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Object' &&
          (node.callee.property.name === 'freeze' || node.callee.property.value === 'freeze')) {
        if (node.arguments.length >= 1)
          return this.transformExpression(node.arguments[0]);
        return PhpLiteral.Null();
      }

      // Handle Number static methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Number') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        switch (method) {
          case 'isInteger':
          case 'is_integer':
            // Number.isInteger(x) → is_int($x)
            return new PhpFunctionCall('is_int', args);

          case 'isFinite':
          case 'is_finite':
            // Number.isFinite(x) → is_finite($x)
            return new PhpFunctionCall('is_finite', args);

          case 'isNaN':
          case 'is_na_n':
            // Number.isNaN(x) → is_nan($x)
            return new PhpFunctionCall('is_nan', args);

          case 'isSafeInteger':
          case 'is_safe_integer':
            // Number.isSafeInteger(x) → is_int($x) && abs($x) <= PHP_INT_MAX
            // Simplified: just is_int for PHP
            return new PhpFunctionCall('is_int', args);

          case 'parseInt':
          case 'parse_int':
            // Number.parseInt(x, radix?) → intval($x, $radix)
            return new PhpFunctionCall('intval', args);

          case 'parseFloat':
          case 'parse_float':
            // Number.parseFloat(x) → floatval($x)
            return new PhpFunctionCall('floatval', args);

          default:
            // Fallback to function call
            return new PhpFunctionCall(this.toSnakeCase(method), args);
        }
      }

      // Handle Math static methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Math') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        switch (method) {
          case 'floor':
            return new PhpFunctionCall('floor', args);
          case 'ceil':
            return new PhpFunctionCall('ceil', args);
          case 'round':
            return new PhpFunctionCall('round', args);
          case 'abs':
            return new PhpFunctionCall('abs', args);
          case 'min':
            return new PhpFunctionCall('min', args);
          case 'max':
            return new PhpFunctionCall('max', args);
          case 'pow':
            return args.length >= 2
              ? new PhpBinaryExpression(args[0], '**', args[1])
              : new PhpFunctionCall('pow', args);
          case 'sqrt':
            return new PhpFunctionCall('sqrt', args);
          case 'log':
            return new PhpFunctionCall('log', args);
          case 'log2':
            return new PhpBinaryExpression(
              new PhpFunctionCall('log', args),
              '/',
              new PhpFunctionCall('log', [PhpLiteral.Int(2)])
            );
          case 'log10':
            return new PhpFunctionCall('log10', args);
          case 'exp':
            return new PhpFunctionCall('exp', args);
          case 'sin':
            return new PhpFunctionCall('sin', args);
          case 'cos':
            return new PhpFunctionCall('cos', args);
          case 'tan':
            return new PhpFunctionCall('tan', args);
          case 'asin':
            return new PhpFunctionCall('asin', args);
          case 'acos':
            return new PhpFunctionCall('acos', args);
          case 'atan':
            return new PhpFunctionCall('atan', args);
          case 'atan2':
            return new PhpFunctionCall('atan2', args);
          case 'random':
            return new PhpBinaryExpression(
              new PhpFunctionCall('mt_rand', []),
              '/',
              new PhpFunctionCall('mt_getrandmax', [])
            );
          case 'trunc':
            return new PhpCast(args[0], 'int');
          case 'sign':
            // sign(x) = x > 0 ? 1 : (x < 0 ? -1 : 0)
            return new PhpTernary(
              new PhpBinaryExpression(args[0], '>', PhpLiteral.Int(0)),
              PhpLiteral.Int(1),
              new PhpTernary(
                new PhpBinaryExpression(args[0], '<', PhpLiteral.Int(0)),
                PhpLiteral.Int(-1),
                PhpLiteral.Int(0)
              )
            );
          case 'clz32':
            // Count leading zeros - custom function needed
            return new PhpFunctionCall('count_leading_zeros', [args[0], PhpLiteral.Int(32)]);
          case 'imul':
            // Math.imul(a, b) → (($a * $b) & 0xFFFFFFFF)
            if (args.length >= 2)
              return new PhpBinaryExpression(
                new PhpBinaryExpression(args[0], '*', args[1]),
                '&',
                PhpLiteral.Int(0xFFFFFFFF)
              );
            return new PhpFunctionCall('intval', [PhpLiteral.Int(0)]);
          case 'fround':
            // Math.fround(x) → (float)$x (approximate)
            return new PhpCast(args[0], 'float');
          default:
            return new PhpFunctionCall(method.toLowerCase(), args);
        }
      }

      // Handle JSON static methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'JSON') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        switch (method) {
          case 'parse':
            // JSON.parse(x) → json_decode($x, true)
            return new PhpFunctionCall('json_decode', [args[0], PhpLiteral.Bool(true)]);
          case 'stringify':
            // JSON.stringify(x) → json_encode($x)
            return new PhpFunctionCall('json_encode', args);
          default:
            return new PhpFunctionCall(this.toSnakeCase(method), args);
        }
      }

      // Handle Object static methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Object') {
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        switch (method) {
          case 'keys':
            // Object.keys(x) → array_keys($x)
            return new PhpFunctionCall('array_keys', args);
          case 'values':
            // Object.values(x) → array_values($x)
            return new PhpFunctionCall('array_values', args);
          case 'entries':
            // Object.entries(x) → array_map(fn($k, $v) => [$k, $v], array_keys($x), array_values($x))
            // Simplified: use a helper or inline
            return new PhpFunctionCall('array_map', [
              new PhpArrowFunction(
                [new PhpParameter('k'), new PhpParameter('v')],
                new PhpArrayLiteral([
                  { key: null, value: new PhpVariable('k') },
                  { key: null, value: new PhpVariable('v') }
                ])
              ),
              new PhpFunctionCall('array_keys', args),
              new PhpFunctionCall('array_values', args)
            ]);
          case 'assign':
            // Object.assign(target, ...sources) → array_merge($target, ...$sources)
            return new PhpFunctionCall('array_merge', args);
          case 'freeze':
            // Already handled above, but include here for completeness
            return args[0] || PhpLiteral.Null();
          case 'create':
            // Object.create(null) → [] (associative array)
            return new PhpArrayLiteral([]);
          default:
            return new PhpFunctionCall(this.toSnakeCase(method), args);
        }
      }

      // Handle String.fromCharCode(code) → chr($code)
      // Also handle String.fromCharCode(...codes) → implode('', array_map('chr', codes))
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          (node.callee.object.name === 'String' || node.callee.object.name === 'string') &&
          (node.callee.property.name === 'fromCharCode' || node.callee.property.value === 'fromCharCode' ||
           node.callee.property.name === 'from_char_code' || node.callee.property.value === 'from_char_code')) {
        // Check for spread element: String.fromCharCode(...array)
        // This is the common pattern for converting byte arrays to strings
        if (node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement') {
          const arrayArg = this.transformExpression(node.arguments[0].argument);
          const mapped = new PhpFunctionCall('array_map', [PhpLiteral.String('chr'), arrayArg]);
          return new PhpFunctionCall('implode', [PhpLiteral.String(''), mapped]);
        }

        const args = node.arguments.map(arg => this.transformExpression(arg));
        if (args.length === 1) {
          // Single char: String.fromCharCode(code) -> chr($code)
          // Check if argument is an array (requires array_map) or single value (use chr directly)
          const originalArg = node.arguments[0];

          // MemberExpression with computed property (e.g., data[i]) is array element access = single value
          // MemberExpression with non-computed property (e.g., obj.bytes) might be an array property
          if (originalArg && originalArg.type === 'MemberExpression' && originalArg.computed) {
            // Array element access like data[i] - this is a single byte value
            return new PhpFunctionCall('chr', args);
          }

          // Identifier could be an array variable - check type info if available
          if (originalArg && originalArg.type === 'Identifier') {
            // Check if we have type information for this variable
            const varType = this.getVariableType(originalArg.name);
            if (varType && (varType.name === 'array' || varType.name?.endsWith('[]'))) {
              // Known array type - use array_map
              const mapped = new PhpFunctionCall('array_map', [PhpLiteral.String('chr'), args[0]]);
              return new PhpFunctionCall('implode', [PhpLiteral.String(''), mapped]);
            }
            // For identifiers without type info, assume single value (safer default for fromCharCode)
            return new PhpFunctionCall('chr', args);
          }

          // For literals, call expressions, and other single values, use chr directly
          return new PhpFunctionCall('chr', args);
        }
        // Multiple chars: String.fromCharCode(a, b, c) -> implode('', array_map('chr', [$a, $b, $c]))
        const arrayLiteral = new PhpArrayLiteral(args);
        const mapped = new PhpFunctionCall('array_map', [PhpLiteral.String('chr'), arrayLiteral]);
        return new PhpFunctionCall('implode', [PhpLiteral.String(''), mapped]);
      }

      // Handle String.fromCharCode.apply(null, array) → implode('', array_map('chr', $array))
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'MemberExpression' &&
          node.callee.object.object?.type === 'Identifier' &&
          (node.callee.object.object.name === 'String' || node.callee.object.object.name === 'string') &&
          (node.callee.object.property?.name === 'fromCharCode' || node.callee.object.property?.value === 'fromCharCode' ||
           node.callee.object.property?.name === 'from_char_code' || node.callee.object.property?.value === 'from_char_code') &&
          (node.callee.property.name === 'apply' || node.callee.property.value === 'apply')) {
        // String.fromCharCode.apply(null, array) -> implode('', array_map('chr', $array))
        const args = node.arguments.map(arg => this.transformExpression(arg));
        const arrayArg = args.length >= 2 ? args[1] : args[0]; // Second arg is the array
        const mapped = new PhpFunctionCall('array_map', [PhpLiteral.String('chr'), arrayArg]);
        return new PhpFunctionCall('implode', [PhpLiteral.String(''), mapped]);
      }

      // Handle array.push.apply(array, values) → array_push($array, ...$values)
      // This pattern is used to push all elements of one array into another
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'MemberExpression' &&
          (node.callee.object.property?.name === 'push' || node.callee.object.property?.value === 'push') &&
          (node.callee.property.name === 'apply' || node.callee.property.value === 'apply')) {
        // array.push.apply(array, values) -> $array = array_merge($array, $values)
        // The first arg is typically null or the array, second arg is the values array
        const targetArray = this.transformExpression(node.callee.object.object);
        const args = node.arguments.map(arg => this.transformExpression(arg));
        const valuesArray = args.length >= 2 ? args[1] : args[0];
        // Use array_merge for in-place append of all elements
        return new PhpAssignment(
          targetArray,
          '=',
          new PhpFunctionCall('array_merge', [targetArray, valuesArray])
        );
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle common array/string methods that should be PHP functions
        switch (method) {
          case 'slice':
            // arr.slice(start, end) -> array_slice($arr, $start, $end - $start)
            // But PHP uses length, not end index!
            if (args.length >= 2) {
              const length = new PhpBinaryExpression(args[1], '-', args[0]);
              return new PhpFunctionCall('array_slice', [object, args[0], length]);
            }
            return new PhpFunctionCall('array_slice', [object, args[0] || PhpLiteral.Int(0)]);

          case 'push':
            // arr.push(val) -> $arr[] = $val (but we return array_push for single operation)
            // arr.push(...spread) -> $arr = array_merge($arr, $spread)
            // Check if any argument is a spread element
            const hasSpread = node.arguments.some(arg => arg.type === 'SpreadElement');
            if (hasSpread && node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement') {
              // Single spread: arr.push(...spread) -> $arr = array_merge($arr, $spread)
              const spreadArg = this.transformExpression(node.arguments[0].argument);
              return new PhpAssignment(
                object,
                '=',
                new PhpFunctionCall('array_merge', [object, spreadArg])
              );
            }
            return new PhpFunctionCall('array_push', [object, ...args]);

          case 'pop':
            return new PhpFunctionCall('array_pop', [object]);

          case 'shift':
            return new PhpFunctionCall('array_shift', [object]);

          case 'unshift':
            return new PhpFunctionCall('array_unshift', [object, ...args]);

          case 'concat':
            return new PhpFunctionCall('array_merge', [object, ...args]);

          case 'join':
            return new PhpFunctionCall('implode', [args[0] || PhpLiteral.String(''), object]);

          case 'indexOf':
            // arr.indexOf(val) -> array_search($val, $arr) in PHP, but returns false instead of -1
            return new PhpFunctionCall('array_search', [args[0], object]);

          case 'includes':
            return new PhpFunctionCall('in_array', [args[0], object, PhpLiteral.Bool(true)]);

          case 'reverse':
            return new PhpFunctionCall('array_reverse', [object]);

          case 'fill':
            // arr.fill(val, start, end) -> array_fill($start, $end-$start, $val) - but this creates new array
            // For in-place fill, we'd need a different approach
            if (args.length >= 3) {
              const length = new PhpBinaryExpression(args[2], '-', args[1]);
              return new PhpFunctionCall('array_fill', [this._ensureIntSize(args[1]), this._ensureIntSize(length), args[0]]);
            }
            return new PhpFunctionCall('array_fill', [PhpLiteral.Int(0), new PhpFunctionCall('count', [object]), args[0]]);

          case 'map':
            return new PhpFunctionCall('array_map', [args[0], object]);

          case 'filter':
            return new PhpFunctionCall('array_filter', [object, args[0]]);

          case 'reduce':
            return new PhpFunctionCall('array_reduce', [object, args[0], args[1]]);

          case 'forEach':
            // Can't directly translate forEach - need to emit a different structure
            // For now, treat as array_walk
            return new PhpFunctionCall('array_walk', [object, args[0]]);

          case 'charAt':
            // str.charAt(i) -> $str[$i] or substr($str, $i, 1)
            return new PhpArrayAccess(object, args[0]);

          case 'charCodeAt':
            // str.charCodeAt(i) -> ord($str[$i])
            return new PhpFunctionCall('ord', [new PhpArrayAccess(object, args[0])]);

          case 'substring':
          case 'substr':
            return new PhpFunctionCall('substr', [object, ...args]);

          case 'toLowerCase':
            return new PhpFunctionCall('strtolower', [object]);

          case 'toUpperCase':
            return new PhpFunctionCall('strtoupper', [object]);

          case 'split':
            return new PhpFunctionCall('explode', [args[0], object]);

          case 'trim':
            return new PhpFunctionCall('trim', [object]);

          case 'padStart':
            return new PhpFunctionCall('str_pad', [object, args[0], args[1] || PhpLiteral.String(' '), new PhpIdentifier('STR_PAD_LEFT')]);

          case 'padEnd':
            return new PhpFunctionCall('str_pad', [object, args[0], args[1] || PhpLiteral.String(' ')]);

          case 'startsWith':
            return new PhpFunctionCall('str_starts_with', [object, args[0]]);

          case 'endsWith':
            return new PhpFunctionCall('str_ends_with', [object, args[0]]);

          case 'replaceAll':
            return new PhpFunctionCall('str_replace', [args[0], args[1], object]);

          case 'replace':
            // JavaScript replace only replaces first occurrence unless regex with /g
            return new PhpFunctionCall('preg_replace', [args[0], args[1], object, PhpLiteral.Int(1)]);

          case 'match':
            // str.match(regex) -> preg_match($regex, $str, $matches) ? $matches : null
            return new PhpFunctionCall('preg_match', [args[0], object]);

          case 'toString':
            return new PhpCast(object, 'string');

          case 'toFixed':
          case 'to_fixed':
            // number.toFixed(decimals) -> number_format($number, $decimals)
            return new PhpFunctionCall('number_format', [object, args[0] || PhpLiteral.Int(0)]);

          case 'toPrecision':
          case 'to_precision':
            // number.toPrecision(digits) -> sprintf('%.' . $digits . 'g', $number)
            // Simplified: just use number_format
            return new PhpFunctionCall('number_format', [object, args[0] || PhpLiteral.Int(0)]);

          case 'toExponential':
          case 'to_exponential':
            // number.toExponential(digits) -> sprintf('%e', $number)
            return new PhpFunctionCall('sprintf', [PhpLiteral.String('%e'), object]);

          case 'fromCharCode':
          case 'from_char_code':
            // $string->from_char_code(x) or String.fromCharCode(x) -> chr(x) or implode(..., array_map('chr', x))
            // This handles both the original String.fromCharCode and the IL-converted $string->from_char_code
            if (args.length === 1) {
              const origArg = node.arguments?.[0];

              // SpreadElement means array - use array_map
              if (origArg && origArg.type === 'SpreadElement') {
                const arrMapped = new PhpFunctionCall('array_map', [PhpLiteral.String('chr'), args[0]]);
                return new PhpFunctionCall('implode', [PhpLiteral.String(''), arrMapped]);
              }

              // MemberExpression with computed property (e.g., data[i]) is array element access = single byte
              if (origArg && origArg.type === 'MemberExpression' && origArg.computed) {
                return new PhpFunctionCall('chr', args);
              }

              // For identifiers, check if it's a known array type
              if (origArg && origArg.type === 'Identifier') {
                const varType = this.getVariableType(origArg.name);
                if (varType && (varType.name === 'array' || varType.name?.endsWith('[]'))) {
                  const arrMapped = new PhpFunctionCall('array_map', [PhpLiteral.String('chr'), args[0]]);
                  return new PhpFunctionCall('implode', [PhpLiteral.String(''), arrMapped]);
                }
              }

              // Default: single value - use chr directly
              return new PhpFunctionCall('chr', args);
            }
            // Multiple chars: implode('', array_map('chr', [$a, $b, $c]))
            const charArrayLiteral = new PhpArrayLiteral(args);
            const charMapped = new PhpFunctionCall('array_map', [PhpLiteral.String('chr'), charArrayLiteral]);
            return new PhpFunctionCall('implode', [PhpLiteral.String(''), charMapped]);

          default:
            // Fall through to method call
            break;
        }

        const methodName = this.toSnakeCase(method);
        return new PhpMethodCall(object, methodName, args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Check if this is a closure variable call - need to use $varName(...) syntax
      // In PHP, closures stored in variables must be called with the $ prefix
      if (callee.nodeType === 'Variable') {
        const originalName = node.callee.type === 'Identifier' ? node.callee.name : null;
        const snakeName = callee.name;

        // Check if original or snake_case name is a tracked closure variable
        if ((originalName && this.closureVariables.has(originalName)) ||
            this.closureVariables.has(snakeName)) {
          // Pass the Variable directly so emitter outputs $varName(...)
          return new PhpFunctionCall(callee, args);
        }

        // Regular function call - just use the name
        return new PhpFunctionCall(callee.name, args);
      }

      return new PhpFunctionCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to PHP equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      switch (methodName) {
        case 'RotL32':
        case 'RotR32':
          // ($value << $positions) | ($value >> (32 - $positions))
          const value = args[0];
          const positions = args[1];
          const isLeft = methodName === 'RotL32';

          return new PhpBinaryExpression(
            new PhpBinaryExpression(value, isLeft ? '<<' : '>>', positions),
            '|',
            new PhpBinaryExpression(value, isLeft ? '>>' : '<<',
              new PhpBinaryExpression(PhpLiteral.Int(32), '-', positions))
          );

        case 'Pack32LE':
        case 'Pack32BE':
          // pack('V', ...) for little-endian, pack('N', ...) for big-endian
          const format = methodName.endsWith('LE') ? 'V' : 'N';
          return new PhpFunctionCall('pack', [
            PhpLiteral.String(format + '*'),
            ...args
          ]);

        case 'Unpack32LE':
        case 'Unpack32BE':
          const unpackFormat = methodName.endsWith('LE') ? 'V' : 'N';
          return new PhpFunctionCall('unpack', [
            PhpLiteral.String(unpackFormat + '*'),
            args[0]
          ]);

        case 'XorArrays':
          // array_map(fn($a, $b) => $a ^ $b, $arr1, $arr2)
          const xorFunc = new PhpArrowFunction(
            [new PhpParameter('a'), new PhpParameter('b')],
            new PhpBinaryExpression(new PhpVariable('a'), '^', new PhpVariable('b'))
          );
          return new PhpFunctionCall('array_map', [xorFunc, ...args]);

        case 'ClearArray':
          // sodium_memzero($array)
          return new PhpFunctionCall('sodium_memzero', args);

        case 'Hex8ToBytes':
          return new PhpFunctionCall('hex2bin', args);

        case 'BytesToHex8':
          return new PhpFunctionCall('bin2hex', args);

        case 'AnsiToBytes':
          return args[0]; // String is already bytes in PHP

        case 'ConcatArrays':
          // array_merge($arr1, $arr2, ...)
          return new PhpFunctionCall('array_merge', args);

        case 'CopyArray':
          // In PHP, arrays are copy-on-write, so just return the array
          // For explicit copy: array_values($arr) or [...$arr]
          if (args.length === 1)
            return args[0];
          return new PhpFunctionCall('array_values', args);

        case 'FillArray':
          // array_fill(0, $size, $value)
          if (args.length >= 2)
            return new PhpFunctionCall('array_fill', [PhpLiteral.Int(0), this._ensureIntSize(args[0]), args[1]]);
          return new PhpFunctionCall('array_fill', [PhpLiteral.Int(0), this._ensureIntSize(args[0]), PhpLiteral.Int(0)]);

        default:
          return new PhpFunctionCall(this.toSnakeCase(methodName), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = [];
      for (let i = 0; i < node.elements.length; i++) {
        const elem = node.elements[i];
        if (elem) {
          // Check if this is a spread element
          const isSpread = elem.type === 'SpreadElement';
          const value = this.transformExpression(elem);
          elements.push({ key: null, value, spread: isSpread });
        }
      }

      return new PhpArrayLiteral(elements);
    }

    /**
     * Transform an object expression to PHP array
     * JavaScript objects become PHP associative arrays
     * Property access is handled by transformMemberExpression which uses
     * array access syntax when needed
     */
    transformObjectExpression(node) {
      const elements = [];
      for (const prop of node.properties) {
        if (!prop.key) continue;

        const key = prop.key.name || prop.key.value || 'unknown';
        const value = this.transformExpression(prop.value);
        elements.push({
          // Preserve original key name - object property keys should match access names
          // Don't convert to snake_case since property access uses original names
          key: PhpLiteral.String(key),
          value
        });
      }

      return new PhpArrayLiteral(elements);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      // Map JavaScript types to PHP equivalents
      const jsToPhpTypes = {
        'Error': 'Exception',
        'TypeError': 'TypeError',
        'RangeError': 'RangeException',
        'ReferenceError': 'Exception',
        'SyntaxError': 'Exception',
        'Map': 'ArrayObject',
        'Set': 'ArrayObject'
      };

      // Framework types with positional constructor arguments that need
      // to be converted to an associative array for PHP
      // Note: KeySize and LinkItem stubs take positional args, only TestCase needs array
      const FRAMEWORK_POSITIONAL_ARGS = {
        'TestCase': ['input', 'expected', 'text', 'uri']
        // 'LinkItem': positional args work with PHP stub
        // 'KeySize': positional args work with PHP stub
        // 'Vulnerability': ['name', 'severity', 'description', 'mitigation', 'year']
      };

      // Helper to convert positional args to associative array
      const convertToAssociativeArray = (args, paramNames, className) => {
        if (!args || args.length === 0) return [];

        // If first argument is already an object expression, pass as-is
        const firstArg = node.arguments[0];
        if (firstArg && firstArg.type === 'ObjectExpression')
          return args;

        // Convert positional arguments to associative array
        const elements = [];
        for (let i = 0; i < args.length && i < paramNames.length; ++i) {
          elements.push({
            key: PhpLiteral.String(this.toSnakeCase(paramNames[i])),
            value: args[i]
          });
        }
        return [new PhpArrayLiteral(elements)];
      };

      if (node.callee.type === 'Identifier') {
        let className = node.callee.name;
        className = jsToPhpTypes[className] || this.toPascalCase(className);
        let args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle framework types with positional arguments
        if (FRAMEWORK_POSITIONAL_ARGS[className])
          args = convertToAssociativeArray(args, FRAMEWORK_POSITIONAL_ARGS[className], className);

        return new PhpNew(className, args);
      }

      // Handle new AlgorithmFramework.X(...) patterns
      if (node.callee.type === 'MemberExpression') {
        // Check for AlgorithmFramework.X pattern
        if (node.callee.object.type === 'Identifier' &&
            node.callee.object.name === 'AlgorithmFramework') {
          const className = node.callee.property.name || node.callee.property.value;
          let args = node.arguments.map(arg => this.transformExpression(arg));

          // Handle framework types with positional arguments
          if (FRAMEWORK_POSITIONAL_ARGS[className])
            args = convertToAssociativeArray(args, FRAMEWORK_POSITIONAL_ARGS[className], className);

          return new PhpNew(className, args);
        }

        // Handle general member expression callees (e.g., this.SomeClass)
        const callee = this.transformExpression(node.callee);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // If it resolved to an identifier, use it as class name
        if (callee instanceof PhpIdentifier) {
          return new PhpNew(callee.name, args);
        }

        return new PhpNew(callee, args);
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

      return new PhpTernary(condition, thenExpr, elseExpr);
    }

    /**
     * Collect all identifier names referenced in a node (for closure variable capture)
     * @private
     */
    _collectReferencedIdentifiers(node, identifiers = new Set()) {
      if (!node) return identifiers;

      if (node.type === 'Identifier' && node.name && !/^[A-Z]/.test(node.name)) {
        // Only collect non-capitalized identifiers (exclude class names, constants)
        identifiers.add(node.name);
      }

      // Recursively collect from child nodes
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object')
              this._collectReferencedIdentifiers(item, identifiers);
          }
        } else if (value && typeof value === 'object') {
          this._collectReferencedIdentifiers(value, identifiers);
        }
      }

      return identifiers;
    }

    /**
     * Collect identifiers that are modified (assigned to) in a node
     * Used to detect which closure variables need by-reference capture
     * @private
     */
    _collectModifiedIdentifiers(node, modified = new Set()) {
      if (!node) return modified;

      // Check for assignment to identifier
      if (node.type === 'AssignmentExpression' &&
          node.left?.type === 'Identifier' && node.left.name) {
        modified.add(node.left.name);
      }

      // Check for update expressions (++i, i++, etc.)
      if (node.type === 'UpdateExpression' &&
          node.argument?.type === 'Identifier' && node.argument.name) {
        modified.add(node.argument.name);
      }

      // Recursively collect from child nodes (but not into nested functions)
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (value?.type === 'FunctionExpression' || value?.type === 'ArrowFunctionExpression' ||
            value?.type === 'FunctionDeclaration') continue;

        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object')
              this._collectModifiedIdentifiers(item, modified);
          }
        } else if (value && typeof value === 'object') {
          this._collectModifiedIdentifiers(value, modified);
        }
      }

      return modified;
    }

    /**
     * Collect all locally declared variable names in a function body
     * Only includes explicit declarations (var/let/const), not assignments
     * @private
     */
    _collectLocalDeclarations(node, locals = new Set()) {
      if (!node) return locals;

      // Check for explicit variable declarations (var/let/const)
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations || []) {
          if (decl.id?.name)
            locals.add(decl.id.name);
        }
      }

      // Note: We intentionally don't include AssignmentExpression here
      // because JS assignment without var/let/const is NOT a declaration
      // e.g., 'state = 1' assigns to outer 'state', doesn't create local

      // Recursively collect from child nodes (but not into nested functions)
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        // Don't recurse into nested functions
        if (value?.type === 'FunctionExpression' || value?.type === 'ArrowFunctionExpression' ||
            value?.type === 'FunctionDeclaration') continue;

        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object')
              this._collectLocalDeclarations(item, locals);
          }
        } else if (value && typeof value === 'object') {
          this._collectLocalDeclarations(value, locals);
        }
      }

      return locals;
    }

    /**
     * Transform a function expression to PHP closure
     */
    transformFunctionExpression(node) {
      const params = node.params ? node.params.map(p => {
        const paramName = this.toSnakeCase(p.name);
        const paramType = p.typeAnnotation ? this.mapType(p.typeAnnotation) : null;
        return new PhpParameter(paramName, paramType);
      }) : [];

      // Get parameter names for filtering
      const paramNames = new Set(node.params ? node.params.map(p => p.name) : []);

      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          // Arrow function with expression body
          if (this.options.useArrowFunctions !== false) {
            return new PhpArrowFunction(params, this.transformExpression(node.body));
          } else {
            body = this.wrapInBlock(new PhpReturn(this.transformExpression(node.body)));
          }
        }
      }

      // Collect free variables that need to be captured with 'use'
      const referencedVars = this._collectReferencedIdentifiers(node.body);
      const localVars = this._collectLocalDeclarations(node.body);
      const modifiedVars = this._collectModifiedIdentifiers(node.body);

      // Free variables = referenced - params - locals - builtins
      const builtins = new Set(['this', 'null', 'true', 'false', 'undefined', 'NaN', 'Infinity',
                                'Math', 'Array', 'Object', 'String', 'Number', 'Boolean',
                                'OpCodes', 'AlgorithmFramework']);
      const freeVars = [];
      for (const varName of referencedVars) {
        if (!paramNames.has(varName) && !localVars.has(varName) && !builtins.has(varName)) {
          const snakeName = this.toSnakeCase(varName);
          // If the variable is modified inside the closure, mark it with & for by-reference
          if (modifiedVars.has(varName))
            freeVars.push('&' + snakeName);
          else
            freeVars.push(snakeName);
        }
      }

      const closure = new PhpClosure(params, body);
      closure.useVariables = [...new Set(freeVars)]; // Deduplicate

      return closure;
    }

    /**
     * Transform spread element
     */
    transformSpreadElement(node) {
      return this.transformExpression(node.argument);
    }

    /**
     * Transform template literal
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; i++) {
        const text = node.quasis[i].value.raw;
        if (text) parts.push(text);

        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new PhpStringInterpolation(parts);
    }
  }

  // Export
  const exports = { PhpTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PhpTransformer = PhpTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
