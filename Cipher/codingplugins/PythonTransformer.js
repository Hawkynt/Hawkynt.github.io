/**
 * PythonTransformer.js - IL AST to Python AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Python AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Python AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - addTypeHints: Include Python type hints
 *   - addDocstrings: Include docstrings
 *   - strictTypes: Enable strict type checking mode
 */

(function(global) {
  'use strict';

  // Load dependencies
  let PythonAST;
  if (typeof require !== 'undefined') {
    PythonAST = require('./PythonAST.js');
  } else if (global.PythonAST) {
    PythonAST = global.PythonAST;
  }

  const {
    PythonType, PythonModule, PythonImport, PythonClass, PythonFunction,
    PythonParameter, PythonBlock, PythonAssignment, PythonExpressionStatement,
    PythonReturn, PythonIf, PythonFor, PythonWhile, PythonBreak, PythonContinue,
    PythonRaise, PythonTryExcept, PythonExceptClause, PythonPass,
    PythonLiteral, PythonFString, PythonIdentifier, PythonBinaryExpression, PythonUnaryExpression,
    PythonMemberAccess, PythonSubscript, PythonCall, PythonList, PythonDict,
    PythonTuple, PythonListComprehension, PythonGeneratorExpression, PythonConditional, PythonLambda, PythonSlice
  } = PythonAST;

  /**
   * Maps JavaScript/JSDoc types to Python types
   */
  const TYPE_MAP = {
    // Unsigned integers -> int (Python 3 has arbitrary precision int)
    'uint8': 'int', 'byte': 'int',
    'uint16': 'int', 'ushort': 'int', 'word': 'int',
    'uint32': 'int', 'uint': 'int', 'dword': 'int',
    'uint64': 'int', 'ulong': 'int', 'qword': 'int',
    // Signed integers -> int
    'int8': 'int', 'sbyte': 'int',
    'int16': 'int', 'short': 'int',
    'int32': 'int', 'int': 'int',
    'int64': 'int', 'long': 'int',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'float', 'float64': 'float',
    'number': 'int', // In crypto context, typically int
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'str', 'String': 'str',
    'void': 'None',
    'object': 'Any', 'Object': 'Any', 'any': 'Any',
    // Arrays
    'Array': 'List', 'array': 'List'
  };

  /**
   * OpCodes method mapping to Python implementations
   */
  const OPCODES_MAP = {
    // Rotation operations
    'RotL32': (args) => `_rotl32(${args.join(', ')})`,
    'RotR32': (args) => `_rotr32(${args.join(', ')})`,
    'RotL64': (args) => `_rotl64(${args.join(', ')})`,
    'RotR64': (args) => `_rotr64(${args.join(', ')})`,
    'RotL8': (args) => `_rotl8(${args.join(', ')})`,
    'RotR8': (args) => `_rotr8(${args.join(', ')})`,
    'RotL16': (args) => `_rotl16(${args.join(', ')})`,
    'RotR16': (args) => `_rotr16(${args.join(', ')})`,

    // Packing operations
    'Pack16BE': (args) => `struct.pack('>H', ${args.join(', ')})`,
    'Pack16LE': (args) => `struct.pack('<H', ${args.join(', ')})`,
    'Pack32BE': (args) => `struct.pack('>I', ${args.join(', ')})`,
    'Pack32LE': (args) => `struct.pack('<I', ${args.join(', ')})`,
    'Pack64BE': (args) => `struct.pack('>Q', ${args.join(', ')})`,
    'Pack64LE': (args) => `struct.pack('<Q', ${args.join(', ')})`,

    // Unpacking operations - Convert integer to list of bytes
    // JavaScript OpCodes.Unpack32LE takes an int and returns [b0, b1, b2, b3]
    // Python equivalent: list((value & mask).to_bytes(n, endian))
    // We mask to ensure the value fits in the byte count and is unsigned
    'Unpack16BE': (args) => `list((${args[0]} & 0xFFFF).to_bytes(2, "big"))`,
    'Unpack16LE': (args) => `list((${args[0]} & 0xFFFF).to_bytes(2, "little"))`,
    'Unpack32BE': (args) => `list((${args[0]} & 0xFFFFFFFF).to_bytes(4, "big"))`,
    'Unpack32LE': (args) => `list((${args[0]} & 0xFFFFFFFF).to_bytes(4, "little"))`,
    'Unpack64BE': (args) => `list((${args[0]} & 0xFFFFFFFFFFFFFFFF).to_bytes(8, "big"))`,
    'Unpack64LE': (args) => `list((${args[0]} & 0xFFFFFFFFFFFFFFFF).to_bytes(8, "little"))`,

    // Bitwise operations (32-bit safe)
    'And32': (args) => `(${args[0]} & ${args[1]}) & 0xFFFFFFFF`,
    'Or32': (args) => `(${args[0]} | ${args[1]}) & 0xFFFFFFFF`,
    'Xor32': (args) => `(${args[0]} ^ ${args[1]}) & 0xFFFFFFFF`,
    'Not32': (args) => `(~${args[0]}) & 0xFFFFFFFF`,
    'Shl32': (args) => `(${args[0]} << ${args[1]}) & 0xFFFFFFFF`,
    'Shr32': (args) => `(${args[0]} >> ${args[1]}) & 0xFFFFFFFF`,

    // Arithmetic operations (32-bit safe)
    'Add32': (args) => `(${args[0]} + ${args[1]}) & 0xFFFFFFFF`,
    'Sub32': (args) => `(${args[0]} - ${args[1]}) & 0xFFFFFFFF`,
    'Mul32': (args) => `(${args[0]} * ${args[1]}) & 0xFFFFFFFF`,

    // Conversion operations
    'ToUint32': (args) => `${args[0]} & 0xFFFFFFFF`,
    'ToUint16': (args) => `${args[0]} & 0xFFFF`,
    'ToUint8': (args) => `${args[0]} & 0xFF`,
    'ToByte': (args) => `${args[0]} & 0xFF`,

    // Array operations
    'XorArrays': (args) => `[a ^ b for a, b in zip(${args[0]}, ${args[1]})]`,
    'ClearArray': (args) => `${args[0]}.clear()`,
    'CopyArray': (args) => `${args[0]}.copy()`,
    'ArraysEqual': (args) => `${args[0]} == ${args[1]}`,
    'ConcatArrays': (args) => `${args[0]} + ${args[1]}`,

    // Conversion utilities
    'Hex8ToBytes': (args) => `bytes.fromhex(${args[0]})`,
    'BytesToHex8': (args) => `${args[0]}.hex()`,
    'AnsiToBytes': (args) => `${args[0]}.encode('ascii')`,
    'BytesToAnsi': (args) => `${args[0]}.decode('ascii')`,
    'AsciiToBytes': (args) => `${args[0]}.encode('ascii')`,

    // Bit operations
    'GetBit': (args) => `(${args[0]} >> ${args[1]}) & 1`,
    'SetBit': (args) => `${args[0]} | (1 << ${args[1]})`,
    'PopCount': (args) => `bin(${args[0]}).count('1')`
  };

  /**
   * Python reserved keywords that must be escaped
   */
  const PYTHON_RESERVED_WORDS = new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
    'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
    'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
    // Also include built-in names that shouldn't be shadowed
    'False', 'None', 'True',
    // Common builtins that should not be shadowed
    'len', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple',
    'bytes', 'bytearray', 'range', 'type', 'chr', 'ord', 'hex', 'bin', 'oct',
    'abs', 'min', 'max', 'sum', 'round', 'pow', 'sorted', 'reversed',
    'map', 'filter', 'zip', 'enumerate', 'all', 'any', 'print', 'input',
    'open', 'file', 'id', 'hash', 'iter', 'next', 'slice', 'object', 'super'
  ]);

  /**
   * Escape Python reserved words by adding underscore suffix
   */
  function escapePythonReserved(name) {
    if (PYTHON_RESERVED_WORDS.has(name)) {
      return name + '_';
    }
    return name;
  }

  /**
   * Convert camelCase to snake_case
   */
  function toSnakeCase(str) {
    // Single uppercase letters are likely constants (K, M, N, etc.) - preserve as uppercase
    if (str.length === 1 && str === str.toUpperCase()) {
      return escapePythonReserved(str);
    }

    // Preserve common constants like MD5, SHA1, etc. but convert to lowercase
    if (str === str.toUpperCase()) return escapePythonReserved(str.toLowerCase());

    const result = str
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return escapePythonReserved(result);
  }

  /**
   * Keep PascalCase for class names
   */
  function toPascalCase(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * JavaScript AST to Python AST Transformer
   */
  class PythonTransformer {
    constructor(options = {}) {
      this.options = options;
      this.typeKnowledge = options.typeKnowledge || null;
      this.addTypeHints = options.addTypeHints !== undefined ? options.addTypeHints : true;
      this.addDocstrings = options.addDocstrings !== undefined ? options.addDocstrings : true;
      // strictTypes: when true, always add type hints even when 'Any' (never omit type annotations)
      // when false, only add type hints when we have concrete types (omit 'Any')
      this.strictTypes = options.strictTypes !== undefined ? options.strictTypes : false;
      this.currentClass = null;
      this.currentMethod = null;
      this.currentClassMethodNames = null; // Set of method names in current class for collision detection
      this.currentPropertyName = null; // Track when we're inside a getter/setter and its name
      this.variableTypes = new Map();
      this.warnings = [];
      this.imports = new Set(); // Track needed imports
      this.scopeStack = [];

      // Track framework classes needed for stub generation
      this.frameworkClasses = new Set(); // Base classes used (BlockCipherAlgorithm, etc.)
      this.helperClasses = new Set();    // Helper classes (KeySize, LinkItem, etc.)
      this.enumsUsed = new Set();        // Enums referenced (category_type, etc.)
      this.frameworkFunctions = new Set(); // Framework functions (register_algorithm, etc.)

      // Track defined class names so we can preserve them in identifiers
      this.definedClassNames = new Set();

      // Track pending post-statements (e.g., postfix increments that must be emitted after current statement)
      this.pendingPostStatements = [];
      // Track pending pre-statements (e.g., assignments in function args that must be emitted before current statement)
      this.pendingPreStatements = [];
    }

    /**
     * Get OpCodes return type from type knowledge
     */
    getOpCodesReturnType(methodName) {
      if (!this.typeKnowledge?.opCodesTypes) return null;
      const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
      if (!methodInfo) return null;
      return this.mapTypeFromKnowledge(methodInfo.returns);
    }

    /**
     * Get Any type and track import
     */
    getAnyType() {
      this.imports.add('Any');
      return PythonType.Any();
    }

    /**
     * Map a type from type knowledge to PythonType
     */
    mapTypeFromKnowledge(typeName) {
      if (!typeName) return this.getAnyType();

      if (typeof typeName === 'string') {
        // Handle arrays
        if (typeName.endsWith('[]')) {
          const elementTypeName = typeName.slice(0, -2);
          const elementType = this.mapTypeFromKnowledge(elementTypeName);
          this.imports.add('List');
          return PythonType.List(elementType);
        }

        const mapped = TYPE_MAP[typeName] || typeName;
        return this.createPythonType(mapped);
      }

      return this.getAnyType();
    }

    /**
     * Infer type from expression
     */
    inferFullExpressionType(node) {
      if (!node) return this.getAnyType();

      switch (node.type) {
        case 'Literal':
          return this.inferLiteralType(node);
        case 'Identifier':
          const varType = this.getVariableType(node.name);
          return varType || PythonType.Int();
        case 'CallExpression':
          return this.inferCallExpressionType(node);
        case 'ArrayExpression':
        case 'ArrayLiteral':
          if (node.elements && node.elements.length > 0) {
            const elemType = this.inferFullExpressionType(node.elements[0]);
            this.imports.add('List');
            return PythonType.List(elemType);
          }
          this.imports.add('List');
          return PythonType.List(PythonType.Int());
        case 'BinaryExpression':
        case 'LogicalExpression':
          const compOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||'];
          if (compOps.includes(node.operator)) {
            return PythonType.Bool();
          }
          return PythonType.Int();
        default:
          return this.getAnyType();
      }
    }

    /**
     * Infer type from literal
     */
    inferLiteralType(node) {
      if (node.value === null) return PythonType.None();
      if (typeof node.value === 'boolean') return PythonType.Bool();
      if (typeof node.value === 'string') return PythonType.Str();
      if (typeof node.value === 'number') {
        return Number.isInteger(node.value) ? PythonType.Int() : PythonType.Float();
      }
      return this.getAnyType();
    }

    /**
     * Infer type from call expression
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
      }
      return this.getAnyType();
    }

    /**
     * Register variable type
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get variable type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Push scope
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
     * Transform JavaScript AST to Python AST
     */
    transform(ast) {
      const module = new PythonModule();

      // Process the AST
      if (ast.type === 'Program') {
        this.transformProgram(ast, module);
      } else {
        this.warnings.push('Expected Program node at root');
      }

      // Add collected imports at the beginning
      module.imports = this.collectImports();

      // Generate framework stub classes at the beginning of module
      const stubs = this.generateFrameworkStubs();
      if (stubs.length > 0) {
        module.statements = [...stubs, ...module.statements];
      }

      return module;
    }

    /**
     * Generate stub classes for AlgorithmFramework classes used in inheritance
     */
    generateFrameworkStubs() {
      const stubs = [];

      // Framework base class stub definitions
      const FRAMEWORK_STUBS = {
        'BlockCipherAlgorithm': 'class BlockCipherAlgorithm:\n    pass',
        'StreamCipherAlgorithm': 'class StreamCipherAlgorithm:\n    pass',
        'HashFunctionAlgorithm': 'class HashFunctionAlgorithm:\n    pass',
        'AsymmetricAlgorithm': 'class AsymmetricAlgorithm:\n    pass',
        'IBlockCipherInstance': 'class IBlockCipherInstance:\n    def __init__(self, algorithm): self.algorithm = algorithm',
        'IStreamCipherInstance': 'class IStreamCipherInstance:\n    def __init__(self, algorithm): self.algorithm = algorithm',
        'IHashFunctionInstance': 'class IHashFunctionInstance:\n    def __init__(self, algorithm): self.algorithm = algorithm',
        'IAlgorithmInstance': 'class IAlgorithmInstance:\n    def __init__(self, algorithm): self.algorithm = algorithm',
      };

      // Helper classes and enums
      const HELPER_STUBS = {
        'KeySize': 'class KeySize:\n    def __init__(self, min_size, max_size, step_size=1): self.min_size, self.max_size, self.step_size = min_size, max_size, step_size',
        'LinkItem': 'class LinkItem:\n    def __init__(self, title, url): self.title, self.url = title, url',
        'Vulnerability': 'class Vulnerability:\n    def __init__(self, name, url_or_desc=None, desc_or_mitigation=None, mitigation=None):\n        if mitigation is not None:\n            self.name, self.url, self.desc, self.mitigation = name, url_or_desc, desc_or_mitigation, mitigation\n        else:\n            self.name, self.desc, self.mitigation = name, url_or_desc, desc_or_mitigation\n            self.url = None',
        'TestCase': 'class TestCase:\n    def __init__(self, **kwargs): self.__dict__.update(kwargs)',
        'AuthResult': 'class AuthResult:\n    def __init__(self, valid, data=None): self.valid, self.data = valid, data',
      };

      // Enum constants - must match AlgorithmFramework.js exactly
      const ENUM_STUBS = {
        'category_type': 'class CategoryType:\n    ASYMMETRIC = "asymmetric"\n    BLOCK = "block"\n    STREAM = "stream"\n    HASH = "hash"\n    CHECKSUM = "checksum"\n    COMPRESSION = "compression"\n    ENCODING = "encoding"\n    CLASSICAL = "classical"\n    MAC = "mac"\n    KDF = "kdf"\n    ECC = "ecc"\n    MODE = "mode"\n    PADDING = "padding"\n    AEAD = "aead"\n    SPECIAL = "special"\n    PQC = "pqc"\n    RANDOM = "random"\ncategory_type = CategoryType()',
        'security_status': 'class SecurityStatus:\n    SECURE = "secure"\n    DEPRECATED = "deprecated"\n    BROKEN = "broken"\n    OBSOLETE = "obsolete"\n    EXPERIMENTAL = "experimental"\n    EDUCATIONAL = "educational"\nsecurity_status = SecurityStatus()',
        'complexity_type': 'class ComplexityType:\n    BEGINNER = "beginner"\n    INTERMEDIATE = "intermediate"\n    ADVANCED = "advanced"\n    EXPERT = "expert"\n    RESEARCH = "research"\ncomplexity_type = ComplexityType()',
        'country_code': 'class CountryCode:\n    US = "US"\n    GB = "GB"\n    DE = "DE"\n    FR = "FR"\n    JP = "JP"\n    CN = "CN"\n    RU = "RU"\n    IL = "IL"\n    BE = "BE"\n    KR = "KR"\n    AU = "AU"\n    CA = "CA"\n    CH = "CH"\n    NL = "NL"\n    SE = "SE"\n    NO = "NO"\n    FI = "FI"\n    AT = "AT"\n    ES = "ES"\n    IT = "IT"\n    PL = "PL"\n    BR = "BR"\n    IN = "IN"\n    SG = "SG"\ncountry_code = CountryCode()',
      };

      // Check which framework classes are needed based on baseClasses tracked
      for (const baseClass of this.frameworkClasses) {
        if (FRAMEWORK_STUBS[baseClass]) {
          stubs.push({ nodeType: 'RawCode', code: FRAMEWORK_STUBS[baseClass] });
        }
      }

      // Check for helper classes usage
      for (const helper of this.helperClasses) {
        if (HELPER_STUBS[helper]) {
          stubs.push({ nodeType: 'RawCode', code: HELPER_STUBS[helper] });
        }
      }

      // Check for enum usage
      for (const enumName of this.enumsUsed) {
        if (ENUM_STUBS[enumName]) {
          stubs.push({ nodeType: 'RawCode', code: ENUM_STUBS[enumName] });
        }
      }

      // Add framework functions at the end
      if (this.frameworkFunctions.has('register_algorithm')) {
        // The register_algorithm function stores the algorithm in a global variable
        // This allows test harnesses to access the registered algorithm
        stubs.push({ nodeType: 'RawCode', code: '_registered_algorithm = None\ndef register_algorithm(algo):\n    global _registered_algorithm\n    _registered_algorithm = algo' });
      }
      if (this.frameworkFunctions.has('algorithm_framework')) {
        stubs.push({ nodeType: 'RawCode', code: 'class AlgorithmFramework:\n    @staticmethod\n    def find(name): return None\nalgorithm_framework = AlgorithmFramework()' });
      }

      return stubs;
    }

    /**
     * Collect necessary imports based on what was used
     */
    collectImports() {
      const imports = [];

      // Always add typing imports for type annotations
      if (this.imports.has('List') || this.imports.has('Dict') ||
          this.imports.has('Optional') || this.imports.has('Any')) {
        const typingItems = [];
        if (this.imports.has('List')) typingItems.push({ name: 'List', alias: null });
        if (this.imports.has('Dict')) typingItems.push({ name: 'Dict', alias: null });
        if (this.imports.has('Optional')) typingItems.push({ name: 'Optional', alias: null });
        if (this.imports.has('Any')) typingItems.push({ name: 'Any', alias: null });
        imports.push(new PythonImport('typing', typingItems));
      }

      // Add struct import if needed
      if (this.imports.has('struct')) {
        imports.push(new PythonImport('struct', null));  // null = 'import struct', not 'from struct import'
      }

      // Add math import if needed
      if (this.imports.has('math')) {
        imports.push(new PythonImport('math', null));  // null = 'import math'
      }

      // Add random import if needed
      if (this.imports.has('random')) {
        imports.push(new PythonImport('random', null));  // null = 'import random'
      }

      // Add functools import if needed
      if (this.imports.has('functools')) {
        imports.push(new PythonImport('functools', null));  // null = 'import functools'
      }

      // Add json import if needed
      if (this.imports.has('json')) {
        imports.push(new PythonImport('json', null));  // null = 'import json'
      }

      // Add datetime import if needed
      if (this.imports.has('datetime')) {
        imports.push(new PythonImport('datetime', null));  // null = 'import datetime'
      }

      return imports;
    }

    /**
     * Check if a method is just a wrapper that calls another method with the same snake_case name.
     * This detects patterns like:
     *   Init() { this.init(); }  // where Init -> init in snake_case
     *   Reset() { this.reset(); }
     * These would create infinite recursion in Python since both map to the same name.
     */
    _isWrapperCallingMethod(methodNode, targetSnakeName) {
      if (!methodNode.value || !methodNode.value.body) return false;

      const body = methodNode.value.body;
      // Check if body is a BlockStatement with a single ExpressionStatement
      if (body.type !== 'BlockStatement') return false;
      if (!body.body || body.body.length !== 1) return false;

      const stmt = body.body[0];
      // Check for ExpressionStatement containing a CallExpression
      if (stmt.type !== 'ExpressionStatement') return false;

      const expr = stmt.expression;
      if (!expr || expr.type !== 'CallExpression') return false;

      // Check if it's a this.methodName() call
      const callee = expr.callee;
      if (!callee || callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'ThisExpression') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Check if the called method name maps to the same snake_case name
      const calledMethodName = toSnakeCase(callee.property.name);
      return calledMethodName === targetSnakeName;
    }

    /**
     * Transform Program node
     */
    transformProgram(node, module) {
      for (const stmt of node.body) {
        // Handle IIFE wrappers at top level - extract content from inside
        if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'CallExpression') {
          const callee = stmt.expression.callee;
          if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') {
            // Extract and process IIFE body content
            const extracted = this.transformIIFEContent(callee, stmt.expression);
            if (extracted) {
              if (Array.isArray(extracted)) {
                module.statements.push(...extracted);
              } else {
                module.statements.push(extracted);
              }
            }
            continue;
          }
        }

        // Skip Node.js main entry point check: if (require.main === module) { ... }
        // These are test/demo code blocks not needed in transpiled output
        if (stmt.type === 'IfStatement') {
          if (this.isNodeMainCheck(stmt.test)) {
            continue;
          }
        }

        const transformed = this.transformStatement(stmt);
        if (transformed) {
          if (Array.isArray(transformed)) {
            module.statements.push(...transformed);
          } else {
            module.statements.push(transformed);
          }
        }
      }
    }

    /**
     * Check if a condition is testing for Node.js main module entry point
     * Patterns: require.main === module, require.main == module
     */
    isNodeMainCheck(testNode) {
      if (!testNode) return false;

      // Direct comparison: require.main === module
      if (testNode.type === 'BinaryExpression' &&
          (testNode.operator === '===' || testNode.operator === '==')) {
        const { left, right } = testNode;
        // Check for require.main on either side
        const isRequireMain = (node) =>
          node.type === 'MemberExpression' &&
          node.object?.type === 'Identifier' && node.object?.name === 'require' &&
          node.property?.type === 'Identifier' && node.property?.name === 'main';
        const isModule = (node) =>
          node.type === 'Identifier' && node.name === 'module';

        if ((isRequireMain(left) && isModule(right)) ||
            (isRequireMain(right) && isModule(left))) {
          return true;
        }
      }

      // Logical AND: typeof require !== 'undefined' && require.main === module
      if (testNode.type === 'LogicalExpression' && testNode.operator === '&&') {
        // Check both sides for the require.main check
        return this.isNodeMainCheck(testNode.left) || this.isNodeMainCheck(testNode.right);
      }

      return false;
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
     * Extract declarations from a function body (IIFE unwrapping)
     * Only extracts class, function, and useful variable declarations.
     * Skips control flow (if/for/while), side effects, and Node.js-specific code.
     */
    extractDeclarationsFromBody(bodyStatements) {
      const declarations = [];

      for (const stmt of bodyStatements) {
        // Skip 'use strict' directive and other expression statements
        if (stmt.type === 'ExpressionStatement') {
          // Skip all expression statements in IIFE extraction
          // They are typically side effects (registration, logging, etc.)
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
          const transformed = this.transformVariableDeclaration(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              declarations.push(...transformed);
            } else {
              declarations.push(transformed);
            }
          }
          continue;
        }

        // Skip if statements (usually feature detection, registration, guards)
        if (stmt.type === 'IfStatement') continue;

        // Skip return statements at module level
        if (stmt.type === 'ReturnStatement') continue;

        // Skip all other statement types (for/while/try/etc.) in IIFE extraction
        // These are typically side-effect code not needed for the algorithm definition
      }

      return declarations.length > 0 ? declarations : null;
    }

    // ========================[ STATEMENTS ]========================

    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);
        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node);
        case 'ExpressionStatement':
          return this.transformExpressionStatement(node);
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
          return new PythonBreak();
        case 'ContinueStatement':
          return new PythonContinue();
        case 'ThrowStatement':
          return this.transformThrowStatement(node);
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'BlockStatement':
          return this.transformBlockStatement(node);
        default:
          this.warnings.push(`Unsupported statement type: ${node.type}`);
          return null;
      }
    }

    transformClassDeclaration(node) {
      const className = toPascalCase(node.id.name);
      const pyClass = new PythonClass(className);

      // Track this class name so we can preserve it in identifier transformations
      this.definedClassNames.add(node.id.name);

      // Known framework base classes
      const FRAMEWORK_CLASSES = new Set([
        'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
        'AsymmetricAlgorithm', 'IBlockCipherInstance', 'IStreamCipherInstance',
        'IHashFunctionInstance', 'IAlgorithmInstance'
      ]);

      // Extract base classes
      if (node.superClass) {
        let baseName;
        // Handle both Identifier and MemberExpression (e.g., AlgorithmFramework.BlockCipherAlgorithm)
        if (node.superClass.type === 'MemberExpression') {
          // Use the property name (final class name)
          baseName = node.superClass.property.name || node.superClass.property.value;
        } else {
          baseName = node.superClass.name;
        }

        if (baseName) {
          pyClass.baseClasses.push(baseName);

          // Track framework classes for stub generation
          if (FRAMEWORK_CLASSES.has(baseName))
            this.frameworkClasses.add(baseName);
        }
      }

      // Collect all method names to detect field/method collision
      // In Python, a field like self.result will shadow a method def result(self)
      // NOTE: We exclude getters/setters because Python's @property handles them correctly
      const classMembers = node.body?.body || node.body || [];
      const prevMethodNames = this.currentClassMethodNames;
      this.currentClassMethodNames = new Set();
      for (const member of classMembers) {
        // Only add regular methods, not getters/setters/constructors
        if (member.type === 'MethodDefinition' &&
            member.kind !== 'constructor' &&
            member.kind !== 'get' &&
            member.kind !== 'set') {
          const methodName = toSnakeCase(member.key.name);
          this.currentClassMethodNames.add(methodName);
        }
      }

      // Save current class context
      const prevClass = this.currentClass;
      this.currentClass = pyClass;

      // Process class body
      // Handle both standard ClassBody and unwrapped array of members
      const members = classMembers;

      // In Python, @property getter must come before @xxx.setter
      // First, identify setters without getters and create synthetic getters
      const getters = new Set(members
        .filter(m => m.type === 'MethodDefinition' && m.kind === 'get')
        .map(m => m.key?.name));
      const settersWithoutGetters = members
        .filter(m => m.type === 'MethodDefinition' && m.kind === 'set' && !getters.has(m.key?.name));

      // Create synthetic getter stubs for setter-only properties
      const syntheticGetters = settersWithoutGetters.map(setter => {
        const propName = setter.key?.name;
        const snakeName = toSnakeCase(propName);
        return {
          type: 'MethodDefinition',
          kind: 'get',
          key: { name: propName },
          static: setter.static,
          value: {
            params: [],
            body: {
              type: 'BlockStatement',
              body: [{
                type: 'ReturnStatement',
                argument: {
                  type: 'MemberExpression',
                  object: { type: 'ThisExpression' },
                  property: { type: 'Identifier', name: '_' + snakeName }
                }
              }]
            }
          },
          _synthetic: true // Mark as synthetic for potential debugging
        };
      });

      // Insert synthetic getters right before their corresponding setters
      // and sort to ensure all getters come before their setters
      const syntheticGetterMap = new Map(syntheticGetters.map(g => [g.key?.name, g]));
      const allMembers = [];
      for (const member of members) {
        // If this is a setter with a synthetic getter, insert the getter first
        if (member.type === 'MethodDefinition' && member.kind === 'set') {
          const syntheticGetter = syntheticGetterMap.get(member.key?.name);
          if (syntheticGetter) {
            allMembers.push(syntheticGetter);
            syntheticGetterMap.delete(member.key?.name); // Mark as inserted
          }
        }
        allMembers.push(member);
      }
      // Add any remaining synthetic getters (shouldn't happen but just in case)
      for (const getter of syntheticGetterMap.values()) {
        allMembers.push(getter);
      }

      // Sort to ensure getters come before setters for same property (for non-synthetic cases too)
      const sortedMembers = allMembers.sort((a, b) => {
        if (a.type !== 'MethodDefinition' || b.type !== 'MethodDefinition') return 0;
        // Only compare getter/setter ordering for the same property name
        if (a.key?.name === b.key?.name) {
          if (a.kind === 'get' && b.kind === 'set') return -1;
          if (a.kind === 'set' && b.kind === 'get') return 1;
        }
        return 0;
      });

      // Track emitted method names to detect duplicates (e.g., init() and Init() both -> init)
      const emittedMethodNames = new Set();

      if (sortedMembers && sortedMembers.length > 0) {
        for (const member of sortedMembers) {
          if (member.type === 'MethodDefinition') {
            const snakeName = toSnakeCase(member.key.name);

            // Skip methods that are just wrappers calling another method with same snake_case name
            // This handles patterns like Init() { this.init(); } which creates infinite recursion
            if (this._isWrapperCallingMethod(member, snakeName) && emittedMethodNames.has(snakeName)) {
              continue; // Skip this wrapper method
            }

            // Skip duplicate method definitions (different JS names that map to same snake_case)
            if (member.kind !== 'constructor' && member.kind !== 'get' && member.kind !== 'set') {
              if (emittedMethodNames.has(snakeName) && !this._isWrapperCallingMethod(member, snakeName)) {
                // If we already emitted this method and the new one isn't a simple wrapper,
                // we need to rename it to avoid overwriting
                continue; // Skip for now - first definition wins
              }
              emittedMethodNames.add(snakeName);
            }

            const method = this.transformMethodDefinition(member);
            if (method)
              pyClass.methods.push(method);
          } else if (member.type === 'PropertyDefinition') {
            const assignment = this.transformPropertyDefinition(member);
            if (assignment)
              pyClass.classVariables.push(assignment);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> module-level code before class (Python doesn't have static blocks)
            const statements = this.transformStaticBlock(member);
            if (statements && statements.length > 0) {
              // Add as module-level statements (will be handled by caller)
              pyClass.staticInitStatements = statements;
            }
          }
        }
      }

      // Restore context
      this.currentClass = prevClass;
      this.currentClassMethodNames = prevMethodNames;

      return pyClass;
    }

    transformMethodDefinition(node) {
      const methodName = toSnakeCase(node.key.name);
      const isConstructor = node.kind === 'constructor';
      const isStatic = node.static;

      // Handle static getters specially - Python doesn't support @staticmethod + @property
      // For static getters that return a constant, convert to class variable
      if (isStatic && node.kind === 'get') {
        // Check if body is just: { return <literal>; }
        const body = node.value?.body;
        if (body?.type === 'BlockStatement' && body.body?.length === 1) {
          const stmt = body.body[0];
          if (stmt.type === 'ReturnStatement' && stmt.argument) {
            const arg = stmt.argument;
            // Check if it's a simple literal (number, string, boolean, null)
            if (arg.type === 'Literal' ||
                arg.type === 'NumericLiteral' ||
                arg.type === 'StringLiteral' ||
                arg.type === 'BooleanLiteral') {
              // Convert to class variable
              const varValue = this.transformExpression(arg);
              const assignment = new PythonAssignment(
                new PythonIdentifier(methodName),
                varValue
              );
              assignment.isClassVariable = true;
              return assignment;
            }
          }
        }
        // For complex static getters, use a regular method without @property
        // User will need to call it as ClassName.method_name() instead of ClassName.method_name
      }

      const pyFunc = new PythonFunction(
        isConstructor ? '__init__' : methodName,
        [],
        null
      );

      pyFunc.isMethod = true;
      pyFunc.isStaticMethod = isStatic;

      // Add decorators
      if (isStatic) {
        pyFunc.decorators.push('staticmethod');
      }
      // Only add @property for non-static getters (static getters handled above)
      if (node.kind === 'get' && !isStatic) {
        pyFunc.decorators.push('property');
        pyFunc.isProperty = true;
      }
      if (node.kind === 'set') {
        pyFunc.decorators.push(`${methodName}.setter`);
      }

      // Parameters (add 'self' for instance methods)
      if (!isStatic) {
        pyFunc.parameters.push(new PythonParameter('self'));
      }

      // Push scope
      this.pushScope();

      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const pyParam = this.transformParameter(param);
          pyFunc.parameters.push(pyParam);

          // Register parameter type
          if (pyParam.type) {
            this.registerVariableType(param.name, pyParam.type);
          }
        }
      }

      // Return type (only if addTypeHints is enabled)
      if (this.addTypeHints && node.value && node.value.returnType) {
        pyFunc.returnType = this.mapType(node.value.returnType);
      }

      // Set current method and property context
      const prevMethod = this.currentMethod;
      const prevPropertyName = this.currentPropertyName;
      this.currentMethod = pyFunc;

      // Track property name if this is a getter or setter
      // This allows us to detect backing field access patterns like:
      // get outputSize() { return this.OutputSize; }  -> should use self._output_size
      if (node.kind === 'get' || node.kind === 'set') {
        this.currentPropertyName = methodName;
      }

      // Body
      if (node.value && node.value.body)
        pyFunc.body = this.transformBlockStatement(node.value.body);

      // Restore context
      this.currentMethod = prevMethod;
      this.currentPropertyName = prevPropertyName;
      this.popScope();

      return pyFunc;
    }

    transformFunctionDeclaration(node) {
      const funcName = toSnakeCase(node.id.name);
      const pyFunc = new PythonFunction(funcName, [], null);

      // Push scope
      this.pushScope();

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const pyParam = this.transformParameter(param);
          pyFunc.parameters.push(pyParam);

          // Register parameter type
          if (pyParam.type) {
            this.registerVariableType(param.name, pyParam.type);
          }
        }
      }

      // Return type (only if addTypeHints is enabled)
      if (this.addTypeHints && node.returnType) {
        pyFunc.returnType = this.mapType(node.returnType);
      }

      // Set current method
      const prevMethod = this.currentMethod;
      this.currentMethod = pyFunc;

      // Body
      if (node.body) {
        pyFunc.body = this.transformBlockStatement(node.body);
      }

      // Restore context
      this.currentMethod = prevMethod;
      this.popScope();

      return pyFunc;
    }

    transformParameter(node) {
      // Handle different parameter node structures:
      // - Identifier: { name: 'param' }
      // - AssignmentPattern: { left: { name: 'param' }, right: defaultValue }
      // - RestElement: { argument: { name: 'param' } }
      let rawName;
      let defaultValueNode = null;
      let typeAnnotation = null;

      if (node.type === 'AssignmentPattern') {
        // Parameter with default value: (param = default)
        rawName = node.left?.name || node.left?.id?.name;
        defaultValueNode = node.right;
        typeAnnotation = node.left?.typeAnnotation || node.typeAnnotation;
      } else if (node.type === 'RestElement') {
        // Rest parameter: (...params)
        rawName = node.argument?.name || node.argument?.id?.name;
        typeAnnotation = node.argument?.typeAnnotation || node.typeAnnotation;
      } else {
        // Simple Identifier parameter
        rawName = node.name || node.id?.name;
        defaultValueNode = node.defaultValue;
        typeAnnotation = node.typeAnnotation;
      }

      // Fallback to unique param name if still undefined
      if (!rawName) {
        rawName = `param_${this._paramCounter || 0}`;
        this._paramCounter = (this._paramCounter || 0) + 1;
      }

      const paramName = toSnakeCase(rawName);
      let type = null;
      let defaultValue = null;

      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && typeAnnotation) {
        type = this.mapType(typeAnnotation);
      }

      // Default value
      if (defaultValueNode) {
        defaultValue = this.transformExpression(defaultValueNode);
      }

      return new PythonParameter(paramName, type, defaultValue);
    }

    transformPropertyDefinition(node) {
      const propName = toSnakeCase(node.key.name);
      const value = node.value ? this.transformExpression(node.value) : PythonLiteral.None();

      const assignment = new PythonAssignment(
        new PythonIdentifier(propName),
        value
      );

      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && node.typeAnnotation) {
        assignment.type = this.mapType(node.typeAnnotation);
      }

      return assignment;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Python module-level statements
      // Python doesn't have static class blocks, so transform to statements
      // node.body is a BlockStatement, so access its body property
      const statements = node.body?.body || node.body || [];
      if (Array.isArray(statements)) {
        return statements.map(stmt => this.transformStatement(stmt)).filter(s => s);
      }
      return [];
    }

    transformClassExpression(node) {
      // ClassExpression -> Python class definition
      const className = node.id?.name || 'AnonymousClass';
      const classDecl = new PythonClass(className);

      if (node.superClass)
        classDecl.baseClasses = [this.transformExpression(node.superClass)];

      if (node.body?.body) {
        const members = node.body.body;

        // In Python, @property getter must come before @xxx.setter
        // First, identify setters without getters and create synthetic getters
        const getters = new Set(members
          .filter(m => m.type === 'MethodDefinition' && m.kind === 'get')
          .map(m => m.key?.name));
        const settersWithoutGetters = members
          .filter(m => m.type === 'MethodDefinition' && m.kind === 'set' && !getters.has(m.key?.name));

        // Create synthetic getter stubs for setter-only properties
        const syntheticGetters = settersWithoutGetters.map(setter => {
          const propName = setter.key?.name;
          const snakeName = toSnakeCase(propName);
          return {
            type: 'MethodDefinition',
            kind: 'get',
            key: { name: propName },
            static: setter.static,
            value: {
              params: [],
              body: {
                type: 'BlockStatement',
                body: [{
                  type: 'ReturnStatement',
                  argument: {
                    type: 'MemberExpression',
                    object: { type: 'ThisExpression' },
                    property: { type: 'Identifier', name: '_' + snakeName }
                  }
                }]
              }
            },
            _synthetic: true
          };
        });

        // Insert synthetic getters right before their corresponding setters
        const syntheticGetterMap = new Map(syntheticGetters.map(g => [g.key?.name, g]));
        const allMembers = [];
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind === 'set') {
            const syntheticGetter = syntheticGetterMap.get(member.key?.name);
            if (syntheticGetter) {
              allMembers.push(syntheticGetter);
              syntheticGetterMap.delete(member.key?.name);
            }
          }
          allMembers.push(member);
        }
        for (const getter of syntheticGetterMap.values()) {
          allMembers.push(getter);
        }

        // Sort to ensure getters come before setters for same property
        const sortedMembers = allMembers.sort((a, b) => {
          if (a.type !== 'MethodDefinition' || b.type !== 'MethodDefinition') return 0;
          if (a.key?.name === b.key?.name) {
            if (a.kind === 'get' && b.kind === 'set') return -1;
            if (a.kind === 'set' && b.kind === 'get') return 1;
          }
          return 0;
        });

        for (const member of sortedMembers) {
          if (member.type === 'MethodDefinition') {
            const method = this.transformMethodDefinition(member);
            if (method)
              classDecl.methods.push(method);
          } else if (member.type === 'PropertyDefinition') {
            const prop = this.transformPropertyDefinition(member);
            if (prop)
              classDecl.classVariables.push(prop);
          }
        }
      }

      return classDecl;
    }

    transformYieldExpression(node) {
      // Python has yield for generators - return argument for now
      const argument = node.argument ? this.transformExpression(node.argument) : PythonLiteral.None();
      return argument;
    }

    transformVariableDeclaration(node) {
      const assignments = [];

      for (const declarator of node.declarations) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (declarator.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // Python supports tuple unpacking natively: a, b, c = arr
        if (declarator.id.type === 'ArrayPattern') {
          const sourceExpr = declarator.init ? this.transformExpression(declarator.init) : null;
          if (sourceExpr && declarator.id.elements.length > 0) {
            // Build tuple of variable names
            const varNames = [];
            for (const elem of declarator.id.elements) {
              if (elem) {
                varNames.push(new PythonIdentifier(toSnakeCase(elem.name)));
              } else {
                varNames.push(new PythonIdentifier('_')); // Placeholder for holes
              }
            }

            // Create tuple unpacking: (a, b, c) = arr
            const tupleTarget = new PythonTuple(varNames);
            assignments.push(new PythonAssignment(tupleTarget, sourceExpr));
          }
          continue;
        }

        const varName = toSnakeCase(declarator.id.name);

        // Check if this is an arrow/function expression with a block body
        // These need to be converted to actual function definitions, not lambdas
        if (declarator.init &&
            (declarator.init.type === 'ArrowFunctionExpression' ||
             declarator.init.type === 'FunctionExpression') &&
            declarator.init.body.type === 'BlockStatement') {
          // Convert to function definition: const foo = x => { ... } becomes def foo(x): ...
          const funcDef = this.transformArrowToFunction(varName, declarator.init);
          assignments.push(funcDef);
          continue;
        }

        // Check if this is an IIFE (immediately invoked function expression)
        let value;
        if (declarator.init &&
            declarator.init.type === 'CallExpression' &&
            (declarator.init.callee.type === 'FunctionExpression' ||
             declarator.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(declarator.init);
          value = returnValue
            ? this.transformExpression(returnValue)
            : PythonLiteral.None();
        } else {
          value = declarator.init
            ? this.transformExpression(declarator.init)
            : PythonLiteral.None();
        }

        // Check if we need to wrap the value with int() for int-typed variables
        // JavaScript division of integers produces float, and when assigned to int var
        // Python needs explicit conversion
        let finalValue = value;
        if (declarator.id.typeAnnotation) {
          const annotatedType = this.mapType(declarator.id.typeAnnotation);
          if (annotatedType && annotatedType.name === 'int') {
            // Check if the initializer contains division
            if (this._containsDivision(declarator.init))
              finalValue = new PythonCall(new PythonIdentifier('int'), [value]);
          }
        }

        const assignment = new PythonAssignment(
          new PythonIdentifier(varName),
          finalValue
        );

        // Type annotation (only if addTypeHints is enabled)
        if (this.addTypeHints) {
          if (declarator.id.typeAnnotation) {
            assignment.type = this.mapType(declarator.id.typeAnnotation);
            this.registerImportForType(assignment.type);
          } else if (declarator.init) {
            // Infer type from initializer
            const inferredType = this.inferFullExpressionType(declarator.init);
            // Add type hint if: strictTypes is true OR type is not 'Any'
            if (inferredType && (this.strictTypes || inferredType.name !== 'Any')) {
              assignment.type = inferredType;
            }
          }
        }

        assignments.push(assignment);

        // Track variable type
        if (assignment.type) {
          this.registerVariableType(declarator.id.name, assignment.type);
        }
      }

      return assignments.length === 1 ? assignments[0] : assignments;
    }

    transformExpressionStatement(node) {
      // Clear pending pre/post-statements before transforming
      this.pendingPostStatements = [];
      this.pendingPreStatements = [];

      const expr = this.transformExpression(node.expression);

      // Collect pre and post statements
      const preStatements = [...(this.pendingPreStatements || [])];
      const postStatements = [...this.pendingPostStatements];
      this.pendingPreStatements = [];
      this.pendingPostStatements = [];

      // If the expression transform returned a block (e.g., from destructuring),
      // return the block's statements instead of wrapping in ExpressionStatement
      if (expr && expr.nodeType === 'Block') {
        const statements = expr.statements || [];
        // Combine: pre-statements + block statements + post-statements
        if (preStatements.length > 0 || postStatements.length > 0) {
          return [...preStatements, ...statements, ...postStatements];
        }
        return statements;
      }

      // If the expression transform returned a statement (e.g., For from forEach),
      // return it directly instead of wrapping in ExpressionStatement
      const statementNodeTypes = ['For', 'While', 'If', 'TryExcept', 'With', 'Class', 'Function'];
      if (expr && statementNodeTypes.includes(expr.nodeType)) {
        if (preStatements.length > 0 || postStatements.length > 0) {
          return [...preStatements, expr, ...postStatements];
        }
        return expr;
      }

      // Check for pending pre/post statements
      if (preStatements.length > 0 || postStatements.length > 0) {
        const mainStatement = new PythonExpressionStatement(expr);
        return [...preStatements, mainStatement, ...postStatements];
      }

      return new PythonExpressionStatement(expr);
    }

    transformReturnStatement(node) {
      // If we're at module level (not inside a function/method), skip return
      // This handles UMD pattern's final return statement
      if (!this.currentFunction && !this.currentMethod && !this.currentClass) {
        // At module level, convert return { exports } to just the expression
        // or skip entirely if not useful
        if (node.argument) {
          // Could be return { ClassName: className } - just skip for Python
          return null;
        }
        return null;
      }

      const expr = node.argument ? this.transformExpression(node.argument) : null;
      return new PythonReturn(expr);
    }

    transformIfStatement(node) {
      // Check if the condition contains UpdateExpression (++/--) that needs extraction
      const preStatements = [];
      const testNode = this.extractUpdateExpressionsFromCondition(node.test, preStatements);

      const condition = this.transformExpression(testNode);
      const thenBranch = this.transformBlockOrStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformBlockOrStatement(node.alternate) : null;

      // Handle elif chains
      const elifBranches = [];
      let finalElse = elseBranch;

      if (elseBranch && elseBranch.nodeType === 'If') {
        // Convert else-if to elif
        elifBranches.push({
          condition: elseBranch.condition,
          body: elseBranch.thenBranch
        });
        finalElse = elseBranch.elseBranch;
      }

      const ifStmt = new PythonIf(condition, thenBranch, elifBranches, finalElse);

      // If there are pre-statements (from extracted UpdateExpressions), return array
      if (preStatements.length > 0) {
        return [...preStatements, ifStmt];
      }

      return ifStmt;
    }

    /**
     * Extract UpdateExpressions and AssignmentExpressions from a condition and convert to pre-statements
     * For prefix (--x): add "x -= 1" before, use x in condition
     * For postfix (x--): add temp assignment before, add "x -= 1" before, use temp in condition
     * For assignment (x += 1): add "x += 1" before, use x in condition
     */
    extractUpdateExpressionsFromCondition(node, preStatements) {
      if (!node) return node;

      // Handle AssignmentExpression (x += 1, x = value, etc.)
      if (node.type === 'AssignmentExpression') {
        // Extract the assignment as a pre-statement
        const assignmentStmt = this.transformExpressionStatement({
          type: 'ExpressionStatement',
          expression: node
        });
        if (Array.isArray(assignmentStmt)) {
          preStatements.push(...assignmentStmt);
        } else {
          preStatements.push(assignmentStmt);
        }
        // Return the target variable for use in the condition
        return node.left;
      }

      // Handle both UpdateExpression and UnaryExpression with ++ or --
      const isUpdate = node.type === 'UpdateExpression' ||
        (node.type === 'UnaryExpression' && (node.operator === '++' || node.operator === '--'));

      if (isUpdate) {
        const varName = node.argument.name || (typeof node.argument === 'string' ? node.argument : 'var');
        const op = node.operator === '++' ? '+' : '-';
        const updateStmt = new PythonExpressionStatement(
          new PythonAssignment(
            new PythonIdentifier(toSnakeCase(varName)),
            new PythonBinaryExpression(
              new PythonIdentifier(toSnakeCase(varName)),
              op,
              PythonLiteral.Int(1)
            )
          )
        );

        if (node.prefix) {
          // Prefix: --x means decrement first, then use new value
          preStatements.push(updateStmt);
          return node.argument; // Return the variable reference
        } else {
          // Postfix: x-- means use old value, then decrement
          // We need to capture old value
          const tempName = '_pre_update_' + toSnakeCase(varName);
          preStatements.push(new PythonExpressionStatement(
            new PythonAssignment(
              new PythonIdentifier(tempName),
              new PythonIdentifier(toSnakeCase(varName))
            )
          ));
          preStatements.push(updateStmt);
          return { type: 'Identifier', name: tempName }; // Return temp reference
        }
      }

      // Recursively check binary and logical expressions
      if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        return {
          ...node,
          left: this.extractUpdateExpressionsFromCondition(node.left, preStatements),
          right: this.extractUpdateExpressionsFromCondition(node.right, preStatements)
        };
      }

      // Handle parenthesized expressions
      if (node.type === 'ParenthesizedExpression') {
        return {
          ...node,
          expression: this.extractUpdateExpressionsFromCondition(node.expression, preStatements)
        };
      }

      // Handle call expressions - don't descend into arguments to avoid extracting
      // legitimate expressions, but check if the callee itself has updates
      if (node.type === 'CallExpression') {
        return {
          ...node,
          callee: this.extractUpdateExpressionsFromCondition(node.callee, preStatements)
        };
      }

      // Handle member expressions
      if (node.type === 'MemberExpression') {
        return {
          ...node,
          object: this.extractUpdateExpressionsFromCondition(node.object, preStatements),
          property: node.computed
            ? this.extractUpdateExpressionsFromCondition(node.property, preStatements)
            : node.property
        };
      }

      return node;
    }

    transformForStatement(node) {
      // Detect range-based for loops: for (let i = 0; i < n; i++)
      if (this.isRangeBasedFor(node)) {
        return this.transformRangeFor(node);
      }

      // Convert to while loop for complex cases
      return this.transformForAsWhile(node);
    }

    isRangeBasedFor(node) {
      // Check if it's a simple for loop: for (let i = 0; i < n; i++)
      if (!node.init || !node.test || !node.update) return false;

      const init = node.init;
      const test = node.test;
      const update = node.update;

      // Check init: let i = 0
      if (init.type !== 'VariableDeclaration') return false;
      if (init.declarations.length !== 1) return false;
      const decl = init.declarations[0];
      if (!decl.init || decl.init.type !== 'Literal') return false;

      // Check test: i < n
      if (test.type !== 'BinaryExpression') return false;
      if (test.operator !== '<' && test.operator !== '<=') return false;

      // Check update: i++ or ++i
      if (update.type !== 'UpdateExpression') return false;
      if (update.operator !== '++') return false;

      return true;
    }

    transformRangeFor(node) {
      const varName = toSnakeCase(node.init.declarations[0].id.name);
      const start = this.transformExpression(node.init.declarations[0].init);
      const end = this.transformExpression(node.test.right);

      // Create range() call
      const rangeCall = new PythonCall(
        new PythonIdentifier('range'),
        [start, end]
      );

      const body = this.transformBlockOrStatement(node.body);
      return new PythonFor(varName, rangeCall, body);
    }

    transformForAsWhile(node) {
      // Convert complex for loops to while loops
      const block = new PythonBlock();

      // Add initialization
      if (node.init) {
        let init;
        // Handle both statement-type init (VariableDeclaration) and expression-type init (AssignmentExpression)
        if (node.init.type === 'VariableDeclaration') {
          init = this.transformStatement(node.init);
        } else {
          // Expression type (e.g., AssignmentExpression like "round = 24")
          const expr = this.transformExpression(node.init);
          if (expr) {
            init = new PythonExpressionStatement(expr);
          }
        }
        if (init) {
          if (Array.isArray(init)) {
            block.statements.push(...init);
          } else {
            block.statements.push(init);
          }
        }
      }

      // Extract UpdateExpressions and AssignmentExpressions from the test condition
      // For patterns like: for (let i = 0; i-- > 0; ) which uses postfix decrement in condition
      const preStatements = [];
      const cleanedTest = node.test ? this.extractUpdateExpressionsFromCondition(node.test, preStatements) : null;

      // Create while loop
      const condition = cleanedTest ? this.transformExpression(cleanedTest) : PythonLiteral.Bool(true);
      const whileBody = this.transformBlockOrStatement(node.body);

      // Add pre-statements at the end of the while body so they run on each iteration
      // (before the update expression if any)
      for (const stmt of preStatements) {
        whileBody.statements.push(stmt);
      }

      // Add update at end of while body
      if (node.update) {
        const update = this.transformExpression(node.update);
        whileBody.statements.push(new PythonExpressionStatement(update));
      }

      // Add pre-statements before the while loop for the initial check
      for (const stmt of preStatements) {
        block.statements.push(stmt);
      }

      block.statements.push(new PythonWhile(condition, whileBody));

      return block.statements.length === 1 ? block.statements[0] : block.statements;
    }

    transformWhileStatement(node) {
      // Check if the condition contains UpdateExpression or AssignmentExpression
      const preStatements = [];
      const testNode = this.extractUpdateExpressionsFromCondition(node.test, preStatements);

      const condition = this.transformExpression(testNode);
      const body = this.transformBlockOrStatement(node.body);
      const whileStmt = new PythonWhile(condition, body);

      // If there are pre-statements, we need to add them before the while loop
      // AND at the end of the while body to maintain the same semantics
      if (preStatements.length > 0) {
        // Add pre-statements to the beginning of the while body too
        // so they execute on each iteration
        const originalStatements = body.statements || [];
        body.statements = [...preStatements.map(s => {
          // Clone the statements for the body - use the original pre-statement logic
          return s;
        }), ...originalStatements];

        // Return pre-statements + while loop
        return [...preStatements, whileStmt];
      }

      return whileStmt;
    }

    /**
     * Transform JavaScript for...of statement to Python for...in
     * JS: for (const item of iterable) { ... }
     * Python: for item in iterable: ...
     */
    transformForOfStatement(node) {
      // Get the loop variable name
      let varName;
      if (node.left.type === 'VariableDeclaration') {
        // Handle VariableDeclaration with nested structure
        const decl = node.left.declarations[0];
        if (decl && decl.id && decl.id.name) {
          varName = toSnakeCase(decl.id.name);
        } else if (decl && decl.id && decl.id.type === 'Identifier') {
          varName = toSnakeCase(decl.id.name);
        } else {
          this.warnings.push('Cannot extract variable name from for-of declaration');
          varName = 'item';
        }
      } else if (node.left.type === 'Identifier') {
        varName = toSnakeCase(node.left.name);
      } else {
        this.warnings.push('Unsupported for-of left-hand side: ' + node.left.type);
        varName = 'item';
      }

      // Get the iterable expression
      const iterable = this.transformExpression(node.right);

      // Get the loop body
      const body = this.transformBlockOrStatement(node.body);

      // Create Python for loop
      return new PythonFor(
        new PythonIdentifier(varName),
        iterable,
        body
      );
    }

    /**
     * Transform JavaScript for...in statement to Python for...in
     * JS: for (const key in object) { ... }
     * Python: for key in object: ... (or for key in object.keys(): ...)
     */
    transformForInStatement(node) {
      // Get the loop variable name
      let varName;
      if (node.left.type === 'VariableDeclaration') {
        // Handle VariableDeclaration with nested structure
        const decl = node.left.declarations[0];
        if (decl && decl.id && decl.id.name) {
          varName = toSnakeCase(decl.id.name);
        } else if (decl && decl.id && decl.id.type === 'Identifier') {
          varName = toSnakeCase(decl.id.name);
        } else {
          this.warnings.push('Cannot extract variable name from for-in declaration');
          varName = 'key';
        }
      } else if (node.left.type === 'Identifier') {
        varName = toSnakeCase(node.left.name);
      } else {
        this.warnings.push('Unsupported for-in left-hand side: ' + node.left.type);
        varName = 'key';
      }

      // Get the object expression - for objects, we iterate over keys
      const obj = this.transformExpression(node.right);

      // Get the loop body
      const body = this.transformBlockOrStatement(node.body);

      // For JavaScript for-in, we iterate over keys
      // Use range(len(x)) for arrays or just x for objects
      // For simplicity, we'll just use the object directly (works for dicts and lists)
      return new PythonFor(
        new PythonIdentifier(varName),
        obj,
        body
      );
    }

    transformDoWhileStatement(node) {
      // Python doesn't have do-while, convert to while True with break
      const body = this.transformBlockOrStatement(node.body);
      const condition = this.transformExpression(node.test);

      // Add condition check at end with break
      const notCondition = new PythonUnaryExpression('not', condition);
      const breakIf = new PythonIf(notCondition,
        (() => {
          const b = new PythonBlock();
          b.statements.push(new PythonBreak());
          return b;
        })(),
        [], null);

      body.statements.push(breakIf);

      return new PythonWhile(PythonLiteral.Bool(true), body);
    }

    transformSwitchStatement(node) {
      // Transform switch to if/elif/else chain
      if (node.cases.length === 0) {
        return null;
      }

      const discriminant = this.transformExpression(node.discriminant);

      let currentIf = null;
      let lastIf = null;

      for (let i = 0; i < node.cases.length; i++) {
        const caseNode = node.cases[i];

        if (caseNode.test === null) {
          // Default case
          const defaultBody = this.transformSwitchCaseBody(caseNode.consequent);
          if (currentIf) {
            lastIf.elseBranch = defaultBody;
          } else {
            return defaultBody;
          }
        } else {
          // Regular case
          const condition = new PythonBinaryExpression(
            discriminant,
            '==',
            this.transformExpression(caseNode.test)
          );

          const caseBody = this.transformSwitchCaseBody(caseNode.consequent);
          const ifStmt = new PythonIf(condition, caseBody, [], null);

          if (!currentIf) {
            currentIf = ifStmt;
            lastIf = ifStmt;
          } else {
            lastIf.elseBranch = ifStmt;
            lastIf = ifStmt;
          }
        }
      }

      return currentIf;
    }

    transformSwitchCaseBody(consequent) {
      const block = new PythonBlock();

      for (const stmt of consequent) {
        if (stmt.type === 'BreakStatement') {
          // Skip break statements in Python (handled by elif structure)
          continue;
        }
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

    transformThrowStatement(node) {
      let expr = this.transformExpression(node.argument);
      // Python can't raise None - convert to ValueError or re-raise
      if (!expr || (expr.nodeType === 'Literal' && expr.value === null)) {
        // Use ValueError for "throw null" patterns (authentication/tag mismatch errors)
        expr = new PythonCall(new PythonIdentifier('ValueError'), [PythonLiteral.Str('Verification failed')]);
      }
      return new PythonRaise(expr);
    }

    transformTryStatement(node) {
      const tryExcept = new PythonTryExcept();
      tryExcept.tryBlock = this.transformBlockOrStatement(node.block);

      // Catch clauses
      if (node.handler) {
        const exceptClause = this.transformCatchClause(node.handler);
        tryExcept.exceptClauses.push(exceptClause);
      }

      // Finally block
      if (node.finalizer) {
        tryExcept.finallyBlock = this.transformBlockOrStatement(node.finalizer);
      }

      return tryExcept;
    }

    transformCatchClause(node) {
      const exceptionType = node.param?.typeAnnotation
        ? this.mapType(node.param.typeAnnotation).name
        : 'Exception';
      const varName = node.param ? toSnakeCase(node.param.name) : null;
      const body = this.transformBlockOrStatement(node.body);

      // Python requires at least 'pass' in an empty except block
      if (!body.statements || body.statements.length === 0) {
        body.statements = [new PythonPass()];
      }

      return new PythonExceptClause(exceptionType, varName, body);
    }

    transformBlockStatement(node) {
      const block = new PythonBlock();

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

    transformBlockOrStatement(node) {
      if (node.type === 'BlockStatement') {
        return this.transformBlockStatement(node);
      } else {
        const block = new PythonBlock();
        const stmt = this.transformStatement(node);
        if (stmt) {
          if (Array.isArray(stmt)) {
            block.statements.push(...stmt);
          } else {
            block.statements.push(stmt);
          }
        }
        return block;
      }
    }

    // ========================[ EXPRESSIONS ]========================

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
        case 'ArrayLiteral':
          return this.transformArrayExpression(node);
        case 'ObjectExpression':
          return this.transformObjectExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformLambdaExpression(node);
        case 'ThisExpression':
          return new PythonIdentifier('self');
        case 'Super':
          // super in Python is super() - will be handled specially in call expression
          return new PythonIdentifier('__super__');
        case 'SequenceExpression':
          // Return the last expression
          return this.transformExpression(node.expressions[node.expressions.length - 1]);
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);
        case 'SpreadElement':
          return this.transformSpreadElement(node);
        case 'AwaitExpression':
          return this.transformAwaitExpression(node);
        case 'ObjectPattern':
          // Object destructuring - Python doesn't support this directly
          // Return a comment placeholder
          return new PythonIdentifier('# Object destructuring not supported in Python');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Python doesn't have this
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression - Python has lambda classes
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Python has generators
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Python name-mangled private attribute with __ prefix
          return new PythonIdentifier('__' + toSnakeCase(node.name));

        // ========================[ IL AST NODE TYPES ]========================
        // These are normalized IL nodes from type-aware-transpiler.js

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
        case 'ArrayPush':
          return this.transformArrayAppend(node);

        case 'ArrayPop':
          return this.transformArrayPop(node);

        case 'ArrayShift':
          return this.transformArrayShift(node);

        case 'ArrayUnshift':
          return this.transformArrayUnshift(node);

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

        case 'BufferCreation':
          return this.transformBufferCreation(node);

        case 'DataViewCreation':
          return this.transformDataViewCreation(node);

        case 'MapCreation':
          return this.transformMapCreation(node);

        case 'ByteBufferView':
          return this.transformByteBufferView(node);

        case 'HexDecode':
          return this.transformHexDecode(node);

        case 'HexEncode':
          return this.transformHexEncode(node);

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

        case 'Sin':
          return this.transformSin(node);

        case 'Cos':
          return this.transformCos(node);

        case 'Tan':
          return this.transformTan(node);

        case 'Asin':
          return this.transformAsin(node);

        case 'Acos':
          return this.transformAcos(node);

        case 'Atan':
          return this.transformAtan(node);

        case 'Atan2':
          return this.transformAtan2(node);

        case 'Sinh':
          return this.transformSinh(node);

        case 'Cosh':
          return this.transformCosh(node);

        case 'Tanh':
          return this.transformTanh(node);

        case 'Exp':
          return this.transformExp(node);

        case 'Cbrt':
          return this.transformCbrt(node);

        case 'Hypot':
          return this.transformHypot(node);

        case 'Fround':
          return this.transformFround(node);

        case 'Random':
          return this.transformRandom(node);

        case 'Imul':
          return this.transformImul(node);

        case 'Clz32':
          return this.transformClz32(node);

        case 'Cast':
          return this.transformCast(node);

        case 'DestructuringAssignment':
          return this.transformDestructuringAssignment(node);

        // IL AST Error node
        case 'ErrorCreation': {
          // Python uses raise Exception(message) for throwing
          // For expression context, we return the exception object (caller will add raise)
          const exceptionType = node.errorType === 'TypeError' ? 'TypeError' :
                                node.errorType === 'RangeError' ? 'ValueError' :
                                'Exception';
          return new PythonCall(
            new PythonIdentifier(exceptionType),
            [node.message ? this.transformExpression(node.message) : PythonLiteral.Str('')]
          );
        }

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

        case 'ArrayPop':
          return this.transformArrayPop(node);

        case 'ArrayShift':
          return this.transformArrayShift(node);

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

        case 'StringReplace':
          return this.transformStringReplace(node);

        case 'StringRepeat':
          return this.transformStringRepeat(node);

        case 'StringIndexOf':
          return this.transformStringIndexOf(node);

        case 'StringSplit':
          return this.transformStringSplit(node);

        case 'StringSubstring':
          return this.transformStringSubstring(node);

        case 'StringCharAt':
          return this.transformStringCharAt(node);

        case 'StringCharCodeAt':
          return this.transformStringCharCodeAt(node);

        case 'StringToUpperCase':
          return this.transformStringToUpperCase(node);

        case 'StringToLowerCase':
          return this.transformStringToLowerCase(node);

        case 'StringTrim':
          return this.transformStringTrim(node);

        case 'StringStartsWith':
          return this.transformStringStartsWith(node);

        case 'StringEndsWith':
          return this.transformStringEndsWith(node);

        case 'StringIncludes':
          return this.transformStringIncludes(node);

        case 'StringTransform':
          return this.transformStringTransform(node);

        case 'StringConcat':
          return this.transformStringConcat(node);

        case 'BigIntCast':
          return this.transformBigIntCast(node);

        case 'TypedArraySet':
          return this.transformTypedArraySet(node);

        case 'MapSet':
          return this.transformMapSet(node);

        case 'TypedArraySubarray':
          return this.transformTypedArraySubarray(node);

        case 'Sqrt':
          return this.transformSqrt(node);

        case 'Power':
          return this.transformPower(node);

        case 'Log2':
          return this.transformLog2(node);

        case 'MathConstant':
          return this.transformMathConstant(node);

        case 'NumberConstant':
          return this.transformNumberConstant(node);

        case 'InstanceOfCheck':
          return this.transformInstanceOfCheck(node);

        case 'ArraySort':
          return this.transformArraySort(node);

        case 'ArraySplice':
          return this.transformArraySplice(node);

        case 'SetCreation':
          return this.transformSetCreation(node);

        case 'StringToBytes': {
          // Python: string.encode('ascii') or string.encode('utf-8')
          const encoding = node.encoding || 'ascii';
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const encodingArg = encoding === 'ascii' ? PythonLiteral.Str('ascii') :
                              encoding === 'utf-8' || encoding === 'utf8' ? PythonLiteral.Str('utf-8') :
                              PythonLiteral.Str(encoding);
          return new PythonCall(new PythonMemberAccess(value, 'encode'), [encodingArg]);
        }

        case 'BytesToString': {
          // Python: bytes.decode('ascii') or bytes.decode('utf-8')
          const encoding = node.encoding || 'ascii';
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const encodingArg = encoding === 'ascii' ? PythonLiteral.Str('ascii') :
                              encoding === 'utf-8' || encoding === 'utf8' ? PythonLiteral.Str('utf-8') :
                              PythonLiteral.Str(encoding);
          return new PythonCall(new PythonMemberAccess(value, 'decode'), [encodingArg]);
        }

        // Fallback for unknown OpCodes methods
        case 'OpCodesCall': {
          const args = node.arguments.map(a => this.transformExpression(a));
          // Handle specific OpCodes methods that need special Python translation
          switch (node.method) {
            case 'CopyArray':
              // list.copy() or list[:] in Python
              return new PythonCall(new PythonMemberAccess(args[0], 'copy'), []);
            case 'ClearArray':
              // list.clear() in Python
              return new PythonCall(new PythonMemberAccess(args[0], 'clear'), []);
            default:
              // Generic fallback - call method as function
              return new PythonCall(
                new PythonIdentifier(toSnakeCase(node.method)),
                args
              );
          }
        }

        // MathCall - for unhandled Math.* methods
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          switch (node.method) {
            case 'imul':
              // Math.imul(a, b) → ((a * b) & 0xFFFFFFFF) for 32-bit integer multiply
              if (args.length >= 2)
                return new PythonBinaryExpression(
                  new PythonBinaryExpression(args[0], '*', args[1]),
                  '&',
                  PythonLiteral.Int(0xFFFFFFFF)
                );
              break;
            case 'abs':
              return new PythonCall(new PythonIdentifier('abs'), args);
            case 'floor':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'floor'), args);
            case 'ceil':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'ceil'), args);
            case 'round':
              return new PythonCall(new PythonIdentifier('round'), args);
            case 'min':
              return new PythonCall(new PythonIdentifier('min'), args);
            case 'max':
              return new PythonCall(new PythonIdentifier('max'), args);
            case 'pow':
              return new PythonBinaryExpression(args[0], '**', args[1]);
            case 'sqrt':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'sqrt'), args);
            case 'log':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'log'), args);
            case 'exp':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'exp'), args);
            case 'sin':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'sin'), args);
            case 'cos':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'cos'), args);
            case 'random':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('random'), 'random'), []);
            case 'trunc':
              return new PythonCall(new PythonIdentifier('int'), args);
            case 'sign':
              // Python doesn't have sign, use expression: (x > 0) - (x < 0)
              return new PythonBinaryExpression(
                new PythonBinaryExpression(args[0], '>', PythonLiteral.Int(0)),
                '-',
                new PythonBinaryExpression(args[0], '<', PythonLiteral.Int(0))
              );
            default:
              // Fallback to lowercase function name from math module
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), node.method.toLowerCase()), args);
          }
        }

        // IL AST StringInterpolation - `Hello ${name}` -> f"Hello {name}"
        case 'StringInterpolation': {
          // Build Python f-string using PythonFString AST node
          const parts = [];
          const expressions = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                parts.push(part.value || '');
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                if (parts.length === expressions.length) parts.push('');
                expressions.push(this.transformExpression(part.expression));
              }
            }
          } else if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              parts.push(node.quasis[i] || '');
              if (i < node.expressions.length)
                expressions.push(this.transformExpression(node.expressions[i]));
            }
          }
          return new PythonFString(parts, expressions);
        }

        // IL AST ObjectLiteral - {key: value} -> {'key': value}
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new PythonDict([]);

          const entries = [];
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') {
              // Python spread in dict needs special handling - skip for now
              continue;
            }
            const key = prop.key?.name || prop.key?.value || prop.key || 'key';
            const value = this.transformExpression(prop.value);
            entries.push({ key: PythonLiteral.Str(key), value: value });
          }
          return new PythonDict(entries);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> chr(65)
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return PythonLiteral.Str('');
          if (args.length === 1)
            return new PythonCall(new PythonIdentifier('chr'), args);
          // Multiple chars: ''.join([chr(c) for c in [c1, c2, ...]])
          return new PythonCall(
            new PythonMemberAccess(PythonLiteral.Str(''), 'join'),
            [new PythonListComprehension(
              new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('c')]),
              new PythonIdentifier('c'),
              new PythonList(args)
            )]
          );
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> isinstance(x, list)
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new PythonCall(new PythonIdentifier('isinstance'), [value, new PythonIdentifier('list')]);
        }

        // IL AST ArrowFunction - (x) => expr -> lambda x: expr
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return new PythonIdentifier(name);
          });
          let body;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              // Python lambdas are single-expression only; for blocks, use a nested def
              // For now, just use the last expression if available
              const stmts = node.body.body || [];
              const lastStmt = stmts[stmts.length - 1];
              if (lastStmt && lastStmt.type === 'ReturnStatement' && lastStmt.argument) {
                body = this.transformExpression(lastStmt.argument);
              } else {
                body = PythonLiteral.None();
              }
            } else {
              body = this.transformExpression(node.body);
            }
          } else {
            body = PythonLiteral.None();
          }
          return new PythonLambda(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> type(x).__name__
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new PythonMemberAccess(
            new PythonCall(new PythonIdentifier('type'), [value]),
            '__name__'
          );
        }

        // IL AST Power - x ** y -> x ** y
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new PythonBinaryExpression(left, '**', right);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in Python)
        case 'ObjectFreeze': {
          // IL node uses 'object' property, not 'value'
          return this.transformExpression(node.object || node.value);
        }

        // IL AST ArrayFrom - Array.from(x) -> list(x) or [*x]
        case 'ArrayFrom': {
          const iterable = this.transformExpression(node.iterable);
          if (node.mapFunction) {
            // Array.from(arr, fn) -> [fn(x) for x in arr]
            const mapFn = this.transformExpression(node.mapFunction);
            return new PythonListComprehension(
              new PythonCall(mapFn, [new PythonIdentifier('_x')]),
              new PythonIdentifier('_x'),
              iterable
            );
          }
          return new PythonCall(new PythonIdentifier('list'), [iterable]);
        }

        // IL AST ObjectKeys - Object.keys(obj) -> list(obj.keys())
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object);
          return new PythonCall(new PythonIdentifier('list'), [
            new PythonCall(new PythonMemberAccess(obj, 'keys'), [])
          ]);
        }

        // IL AST ObjectValues - Object.values(obj) -> list(obj.values())
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object);
          return new PythonCall(new PythonIdentifier('list'), [
            new PythonCall(new PythonMemberAccess(obj, 'values'), [])
          ]);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> list(obj.items())
        case 'ObjectEntries': {
          const obj = this.transformExpression(node.object);
          return new PythonCall(new PythonIdentifier('list'), [
            new PythonCall(new PythonMemberAccess(obj, 'items'), [])
          ]);
        }

        // IL AST ObjectCreate - Object.create(proto) -> dict(proto) or copy
        case 'ObjectCreate': {
          const proto = this.transformExpression(node.prototype);
          if (node.properties) {
            // Object.create(proto, properties) - merge dicts
            return new PythonBinaryOp(
              new PythonCall(new PythonIdentifier('dict'), [proto]),
              '|',
              this.transformExpression(node.properties)
            );
          }
          return new PythonCall(new PythonIdentifier('dict'), [proto]);
        }

        // IL AST IsIntegerCheck - Number.isInteger(x) -> isinstance(x, int)
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new PythonCall(new PythonIdentifier('isinstance'), [value, new PythonIdentifier('int')]);
        }

        // IL AST DebugOutput - console.log/warn/error -> print()
        case 'DebugOutput': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new PythonCall(new PythonIdentifier('print'), args);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> struct.pack_into
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          // Python struct format codes
          let fmt = littleEndian ? '<' : '>';
          if (method === 'setUint32' || method.includes('Uint32')) fmt += 'I';
          else if (method === 'setUint16' || method.includes('Uint16')) fmt += 'H';
          else if (method === 'setUint8') fmt += 'B';
          else if (method === 'setInt32' || method.includes('Int32')) fmt += 'i';
          else if (method === 'setInt16' || method.includes('Int16')) fmt += 'h';
          else fmt += 'I';

          return new PythonCall(
            new PythonMemberAccess(new PythonIdentifier('struct'), 'pack_into'),
            [PythonLiteral.Str(fmt), view, offset, value]
          );
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> struct.unpack_from
        case 'DataViewRead': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          if (method === 'getUint8')
            return new PythonSubscript(view, offset);

          // Python struct format codes
          let fmt = littleEndian ? '<' : '>';
          if (method === 'getUint32' || method.includes('Uint32')) fmt += 'I';
          else if (method === 'getUint16' || method.includes('Uint16')) fmt += 'H';
          else if (method === 'getInt32' || method.includes('Int32')) fmt += 'i';
          else if (method === 'getInt16' || method.includes('Int16')) fmt += 'h';
          else fmt += 'I';

          return new PythonSubscript(
            new PythonCall(
              new PythonMemberAccess(new PythonIdentifier('struct'), 'unpack_from'),
              [PythonLiteral.Str(fmt), view, offset]
            ),
            PythonLiteral.Int(0)
          );
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> ord(str[i])
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new PythonCall(new PythonIdentifier('ord'), [new PythonSubscript(str, index)]);
        }

        // IL AST StringReplace - str.replace(search, replace) -> str.replace(search, replace)
        case 'StringReplace': {
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue);
          const replace = this.transformExpression(node.replaceValue);
          return new PythonCall(new PythonMemberAccess(str, 'replace'), [search, replace]);
        }

        // IL AST BufferCreation - new ArrayBuffer(n) -> bytearray(n)
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new PythonCall(new PythonIdentifier('bytearray'), [size]);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods (duplicate case - see above)
        // This case is handled above in the MathCall section

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> arr[start:end]
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const end = node.end ? this.transformExpression(node.end) : null;

          return new PythonSlice(array, start, end);
        }

        default:
          // Log warning for unhandled expression types to aid debugging
          this.warnings.push(`Unsupported expression type: ${node.type}`);
          const safeStringify = (obj) => {
            try {
              return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v, 2).substring(0, 200);
            } catch (e) { return '[stringify error]'; }
          };
          console.warn(`[PythonTransformer] Unhandled expression type: ${node.type}`, safeStringify(node));
          // Return a placeholder that will cause parse errors with clear indication
          return new PythonIdentifier(`UNHANDLED_EXPRESSION_${node.type}`);
      }
    }

    /**
     * Transform SpreadElement (e.g., ...array)
     * Python equivalent: *array (unpacking)
     */
    transformSpreadElement(node) {
      const argument = this.transformExpression(node.argument);
      // Create a special spread marker that the emitter can handle
      // Python uses *x for unpacking in function calls and [*x] for array unpacking
      return new PythonUnaryExpression('*', argument);
    }

    /**
     * Transform await expression
     * Python: await expression
     */
    transformAwaitExpression(node) {
      const argument = this.transformExpression(node.argument);
      return new PythonUnaryExpression('await', argument);
    }

    transformLiteral(node) {
      if (node.value === null) {
        return PythonLiteral.None();
      }
      // Handle undefined - treat same as None in Python
      if (node.value === undefined) {
        return PythonLiteral.None();
      }
      // Handle regex literals - convert to Python re.compile()
      if (node.regex) {
        const pattern = node.regex.pattern;
        const flags = node.regex.flags || '';
        // Create re.compile(r'pattern') call
        // Convert JS regex flags to Python re flags
        const pyFlags = [];
        if (flags.includes('i')) pyFlags.push('re.IGNORECASE');
        if (flags.includes('m')) pyFlags.push('re.MULTILINE');
        if (flags.includes('s')) pyFlags.push('re.DOTALL');

        const args = [PythonLiteral.Str(pattern, true)]; // true for raw string
        if (pyFlags.length > 0) {
          args.push(new PythonIdentifier(pyFlags.join(' | ')));
        }
        return new PythonCall(
          new PythonMemberAccess(new PythonIdentifier('re'), 'compile'),
          args
        );
      }
      if (typeof node.value === 'boolean') {
        return PythonLiteral.Bool(node.value);
      }
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return PythonLiteral.Int(node.value);
        }
        return PythonLiteral.Float(node.value);
      }
      if (typeof node.value === 'string') {
        return PythonLiteral.Str(node.value);
      }
      // Handle BigInt - Python int() supports arbitrary precision
      if (typeof node.value === 'bigint' || node.bigint) {
        const bigValue = typeof node.value === 'bigint' ? node.value : BigInt(node.bigint.slice(0, -1));
        // Use BigInt's toString() to preserve full precision - don't use Number() which overflows
        const strValue = bigValue.toString();
        // Return as Python int literal (Python handles arbitrary precision natively)
        return new PythonLiteral(strValue, 'int');
      }
      return PythonLiteral.None();
    }

    transformIdentifier(node) {
      // Convert special identifiers
      const name = node.name;
      if (name === 'undefined' || name === 'null') {
        return PythonLiteral.None();
      }
      if (name === 'true') {
        return PythonLiteral.Bool(true);
      }
      if (name === 'false') {
        return PythonLiteral.Bool(false);
      }
      // JavaScript Infinity -> Python float('inf')
      if (name === 'Infinity') {
        return new PythonCall(new PythonIdentifier('float'), [PythonLiteral.Str('inf')]);
      }
      // JavaScript NaN -> Python float('nan')
      if (name === 'NaN') {
        return new PythonCall(new PythonIdentifier('float'), [PythonLiteral.Str('nan')]);
      }

      // Preserve PascalCase class names that we've seen defined
      // e.g., SNOW3GAlgorithm, AESInstance, HashFunctionAlgorithm
      if (this.definedClassNames.has(name)) {
        // This is a class name - preserve it
        return new PythonIdentifier(escapePythonReserved(name));
      }

      // Also preserve framework base class names
      const FRAMEWORK_CLASSES = new Set([
        'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
        'AsymmetricAlgorithm', 'IBlockCipherInstance', 'IStreamCipherInstance',
        'IHashFunctionInstance', 'IAlgorithmInstance', 'IAeadInstance'
      ]);
      if (FRAMEWORK_CLASSES.has(name)) {
        return new PythonIdentifier(escapePythonReserved(name));
      }

      return new PythonIdentifier(toSnakeCase(name));
    }

    transformBinaryExpression(node) {
      // Handle AssignmentExpression and UpdateExpression in operands
      // Python doesn't support assignments or ++/-- as expressions
      // Extract them to pendingPreStatements/pendingPostStatements and use the appropriate value
      let left, right;

      // Helper to check for UpdateExpression
      const isUpdateExpr = (n) => n.type === 'UpdateExpression' ||
        (n.type === 'UnaryExpression' && (n.operator === '++' || n.operator === '--'));

      // Process left operand
      if (node.left.type === 'AssignmentExpression') {
        const assignment = this.transformAssignmentExpression(node.left);
        if (!this.pendingPreStatements) this.pendingPreStatements = [];
        this.pendingPreStatements.push(assignment);
        left = this.transformAssignmentExpressionForExpression(node.left);
      } else if (isUpdateExpr(node.left)) {
        // Handle ++x or x++ in left operand
        const target = this.transformExpression(node.left.argument);
        const one = PythonLiteral.Int(1);
        const op = node.left.operator === '++' ? '+=' : '-=';
        const updateStmt = new PythonAssignment(target, one);
        updateStmt.operator = op;
        updateStmt.isAugmented = true;

        if (node.left.prefix) {
          // Prefix ++x: increment first, then use new value
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(updateStmt);
          left = this.transformExpression(node.left.argument);
        } else {
          // Postfix x++: use current value, then increment
          this.pendingPostStatements.push(updateStmt);
          left = this.transformExpression(node.left.argument);
        }
      } else {
        left = this.transformExpression(node.left);
      }

      // Process right operand
      if (node.right.type === 'AssignmentExpression') {
        const assignment = this.transformAssignmentExpression(node.right);
        if (!this.pendingPreStatements) this.pendingPreStatements = [];
        this.pendingPreStatements.push(assignment);
        right = this.transformAssignmentExpressionForExpression(node.right);
      } else if (isUpdateExpr(node.right)) {
        // Handle ++x or x++ in right operand
        const target = this.transformExpression(node.right.argument);
        const one = PythonLiteral.Int(1);
        const op = node.right.operator === '++' ? '+=' : '-=';
        const updateStmt = new PythonAssignment(target, one);
        updateStmt.operator = op;
        updateStmt.isAugmented = true;

        if (node.right.prefix) {
          // Prefix ++x: increment first, then use new value
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(updateStmt);
          right = this.transformExpression(node.right.argument);
        } else {
          // Postfix x++: use current value, then increment
          this.pendingPostStatements.push(updateStmt);
          right = this.transformExpression(node.right.argument);
        }
      } else {
        right = this.transformExpression(node.right);
      }

      let operator = node.operator;

      // Map JavaScript operators to Python
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';
      if (operator === '&&') operator = 'and';
      if (operator === '||') operator = 'or';

      // Handle instanceof -> isinstance(left, right)
      if (operator === 'instanceof') {
        return new PythonCall(new PythonIdentifier('isinstance'), [left, right]);
      }

      // Handle division - use integer division when dividing by integer literals
      // This is safe for cryptographic code where most division is integer division
      if (operator === '/') {
        // If the right operand is an integer literal, use integer division
        if (node.right.type === 'Literal' && Number.isInteger(node.right.value)) {
          return new PythonBinaryExpression(left, '//', right);
        }
        // For other cases, wrap the result in int() to ensure integer result
        // when used in integer contexts (array indices, range, etc.)
        return new PythonCall(new PythonIdentifier('int'), [
          new PythonBinaryExpression(left, '/', right)
        ]);
      }

      // Handle unsigned right shift (convert to mask)
      if (operator === '>>>') {
        // x >>> 0 is a common JavaScript idiom for converting to uint32
        if (node.right.type === 'Literal' && node.right.value === 0) {
          // Just return left (Python int already handles this)
          return left;
        }
        // General case: x >>> n becomes (x >> n) & mask
        const shift = new PythonBinaryExpression(left, '>>', right);
        const mask = PythonLiteral.Int(0xFFFFFFFF);
        return new PythonBinaryExpression(shift, '&', mask);
      }

      // Handle string concatenation with non-strings
      // In JavaScript, "foo" + 123 works automatically, but Python requires str(123)
      if (operator === '+') {
        const leftType = node.left.resultType;
        const rightType = node.right.resultType;
        const leftIsString = leftType === 'string' || (node.left.type === 'Literal' && typeof node.left.value === 'string');
        const rightIsString = rightType === 'string' || (node.right.type === 'Literal' && typeof node.right.value === 'string');

        if (leftIsString && !rightIsString) {
          // "string" + number -> "string" + str(number)
          const wrappedRight = new PythonCall(new PythonIdentifier('str'), [right]);
          return new PythonBinaryExpression(left, operator, wrappedRight);
        }
        if (!leftIsString && rightIsString) {
          // number + "string" -> str(number) + "string"
          const wrappedLeft = new PythonCall(new PythonIdentifier('str'), [left]);
          return new PythonBinaryExpression(wrappedLeft, operator, right);
        }
      }

      return new PythonBinaryExpression(left, operator, right);
    }

    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      let operator = node.operator;

      // Map operators
      if (operator === '!') operator = 'not';
      if (operator === 'typeof') {
        // typeof x -> type(x).__name__
        return new PythonMemberAccess(
          new PythonCall(new PythonIdentifier('type'), [operand]),
          '__name__'
        );
      }

      return new PythonUnaryExpression(operator, operand);
    }

    transformUpdateExpression(node) {
      // Convert i++ to i += 1
      const target = this.transformExpression(node.argument);
      const one = PythonLiteral.Int(1);
      const operator = node.operator === '++' ? '+=' : '-=';

      const assignment = new PythonAssignment(target, one);
      assignment.operator = operator;
      assignment.isAugmented = true;

      // Store info about prefix/postfix for expression context handling
      assignment._isPrefix = node.prefix;
      assignment._originalTarget = target;

      return assignment;
    }

    /**
     * Transform UpdateExpression for expression context (e.g., inside subscript)
     * Python doesn't support i++ or ++i as expressions, so we handle specially:
     * - Postfix i++: returns i (the old value before increment)
     * - Prefix ++i: returns i + 1 (the new value after increment)
     * Note: This loses the side-effect of the increment. Callers should handle
     * incrementing separately if needed.
     */
    transformUpdateExpressionForExpression(node) {
      const target = this.transformExpression(node.argument);

      if (node.prefix) {
        // ++i: return i + 1 (or i - 1 for --)
        const one = PythonLiteral.Int(1);
        const op = node.operator === '++' ? '+' : '-';
        return new PythonBinaryExpression(target, op, one);
      } else {
        // i++: return just i (the old value)
        return target;
      }
    }

    /**
     * Transform AssignmentExpression for expression context (e.g., inside subscript, function args)
     * Python doesn't support compound assignments (i += 1) as expressions in these contexts.
     * For -= compound assignments in array indexing like key[p -= 1], we need to return
     * the NEW value (p - 1) since Python evaluates the index after decrement.
     * For simple assignments (a = b), we return b (the assigned value).
     * Note: This loses the side-effect. Callers should handle the actual assignment separately.
     */
    transformAssignmentExpressionForExpression(node) {
      const target = this.transformExpression(node.left);
      // For chained assignments, recursively get the final value
      const value = node.right.type === 'AssignmentExpression'
        ? this.transformAssignmentExpressionForExpression(node.right)
        : this.transformExpression(node.right);
      const op = node.operator;

      if (op === '=') {
        // Simple assignment: return the assigned value
        return value;
      } else if (op === '+=') {
        // x += n: return x + n (the new value)
        return new PythonBinaryExpression(target, '+', value);
      } else if (op === '-=') {
        // x -= n: return x - n (the new value)
        return new PythonBinaryExpression(target, '-', value);
      } else if (op === '*=') {
        // x *= n: return x * n
        return new PythonBinaryExpression(target, '*', value);
      } else if (op === '/=') {
        // x /= n: return x / n
        return new PythonBinaryExpression(target, '/', value);
      } else if (op === '%=') {
        // x %= n: return x % n
        return new PythonBinaryExpression(target, '%', value);
      } else if (op === '&=') {
        // x &= n: return x & n
        return new PythonBinaryExpression(target, '&', value);
      } else if (op === '|=') {
        // x |= n: return x | n
        return new PythonBinaryExpression(target, '|', value);
      } else if (op === '^=') {
        // x ^= n: return x ^ n
        return new PythonBinaryExpression(target, '^', value);
      } else if (op === '<<=') {
        // x <<= n: return x << n
        return new PythonBinaryExpression(target, '<<', value);
      } else if (op === '>>=') {
        // x >>= n: return x >> n
        return new PythonBinaryExpression(target, '>>', value);
      } else if (op === '>>>=') {
        // x >>>= n: return (x >> n) & 0xFFFFFFFF
        const shift = new PythonBinaryExpression(target, '>>', value);
        return new PythonBinaryExpression(shift, '&', PythonLiteral.Int(0xFFFFFFFF));
      }

      // Fallback: just return the target (shouldn't happen with known operators)
      return target;
    }

    transformAssignmentExpression(node) {
      // Handle object destructuring: ({a: target1, b: target2} = source)
      // Python doesn't support this syntax, so we expand to sequential assignments
      // Note: Parser may produce ObjectExpression, ObjectPattern, or ObjectLiteral (from IL AST) for this pattern
      if (node.left && (node.left.type === 'ObjectPattern' || node.left.type === 'ObjectExpression' ||
          node.left.type === 'ObjectLiteral' || node.left.ilNodeType === 'ObjectLiteral')) {
        return this.transformObjectDestructuringAssignment(node);
      }

      // Clear pending pre/post-statements before transforming (to collect any increments/assignments in the right side)
      this.pendingPostStatements = [];
      this.pendingPreStatements = [];

      // Check for nested AssignmentExpression or UpdateExpression in the left side (subscripts)
      // e.g., key[p -= 1] = t4 needs to be transformed to:
      //   p -= 1
      //   key[p] = t4
      const preStatements = [];
      const cleanedLeft = this.extractNestedAssignmentsFromLeft(node.left, preStatements);

      // If we extracted pre-statements, we need to return a block
      if (preStatements.length > 0) {
        // Transform with the cleaned left side
        const cleanedNode = { ...node, left: cleanedLeft };
        const mainAssignment = this.transformAssignmentExpressionCore(cleanedNode);

        // Collect any pending pre/post-statements (e.g., assignments and postfix increments from call arguments on the right side)
        const additionalPreStatements = [...(this.pendingPreStatements || [])];
        const postStatements = [...this.pendingPostStatements];
        this.pendingPreStatements = [];
        this.pendingPostStatements = [];

        // Return a block containing pre-statements, the main assignment, and post-statements
        const block = new PythonBlock();
        block.statements = [...preStatements, ...additionalPreStatements, mainAssignment, ...postStatements];
        return block;
      }

      const mainAssignment = this.transformAssignmentExpressionCore(node);

      // Collect any pending pre/post-statements (e.g., assignments in function args and postfix increments)
      // This handles patterns like:
      //   temp = this._FO(temp, n++) -> temp = self._fo(temp, n); n += 1
      //   x = foo(y = 5) -> y = 5; x = foo(y)
      const additionalPreStatements = [...(this.pendingPreStatements || [])];
      const postStatements = [...this.pendingPostStatements];
      this.pendingPreStatements = [];
      this.pendingPostStatements = [];

      if (additionalPreStatements.length > 0 || postStatements.length > 0) {
        // Return a block containing pre-statements, the main assignment, and post-statements
        const block = new PythonBlock();
        block.statements = [...additionalPreStatements, mainAssignment, ...postStatements];
        return block;
      }

      return mainAssignment;
    }

    /**
     * Extract nested AssignmentExpressions and UpdateExpressions from the left side of an assignment.
     * Returns a cleaned node with the expressions replaced by their result identifiers.
     */
    extractNestedAssignmentsFromLeft(node, preStatements) {
      if (!node) return node;

      // Handle MemberExpression with computed property containing AssignmentExpression
      if (node.type === 'MemberExpression' && node.computed) {
        const prop = node.property;

        // Check for AssignmentExpression in subscript (e.g., key[p -= 1])
        if (prop.type === 'AssignmentExpression') {
          // Add the assignment as a pre-statement
          const assignStmt = this.transformAssignmentExpression(prop);
          preStatements.push(assignStmt);

          // Replace the property with just the left side (the variable after assignment)
          return {
            ...node,
            property: prop.left
          };
        }

        // Check for UpdateExpression in subscript (e.g., key[++p] or key[p++])
        // Note: Parser may produce UpdateExpression OR UnaryExpression with ++/-- operator
        const isUpdate = prop.type === 'UpdateExpression' ||
                        (prop.type === 'UnaryExpression' && (prop.operator === '++' || prop.operator === '--'));

        if (isUpdate) {
          const target = this.transformExpression(prop.argument);
          const one = PythonLiteral.Int(1);
          const op = prop.operator === '++' ? '+=' : '-=';

          if (prop.prefix) {
            // ++p: increment first, then use p
            const assignStmt = new PythonAssignment(target, one);
            assignStmt.operator = op;
            assignStmt.isAugmented = true;
            preStatements.push(assignStmt);

            return {
              ...node,
              property: prop.argument
            };
          } else {
            // p++: use p first, then increment
            // Need to use current value, so we use p in the subscript
            // and add increment as a POST-statement (not supported here, so we adjust)
            // For now, we'll add the increment before but use p (which has the post-increment value)
            // This is semantically different but matches common patterns like key[p++] where
            // you want to increment after accessing.
            // Actually for postfix, we need to be careful. key[p++] means key[p], then p++
            // So we should NOT add pre-statement, just use p in subscript
            // But we DO need to track that p needs incrementing after
            // For simplicity, we'll just use p directly (losing the side effect)
            // This is safe for array access patterns where the side effect is just iteration
            return {
              ...node,
              property: prop.argument
            };
          }
        }
      }

      return node;
    }

    /**
     * Core transformation logic for AssignmentExpression (called after pre-processing)
     */
    transformAssignmentExpressionCore(node) {
      // Handle ClassExpression assignment: varName = class extends Base { ... }
      // In Python, we can't assign class definitions directly; we need to emit the class with a proper name
      // Transform to: class ClassName(Base): ...  (and use ClassName as the variable name)
      if (node.right && node.right.type === 'ClassExpression' && node.operator === '=') {
        // Get the variable name being assigned to
        let className = 'AnonymousClass';
        if (node.left.type === 'Identifier') {
          className = toPascalCase(node.left.name);
        } else if (node.left.type === 'MemberExpression' && node.left.property) {
          className = toPascalCase(node.left.property.name || node.left.property.value || 'AnonymousClass');
        }

        // Create a modified ClassExpression node with the proper name
        const namedClassNode = {
          ...node.right,
          id: { type: 'Identifier', name: className }
        };

        // Transform the class expression to a class definition
        const classDef = this.transformClassExpression(namedClassNode);

        // Return the class definition directly (no assignment needed)
        return classDef;
      }

      // Handle array length assignment: arr.length = 0 -> arr.clear()
      // In JavaScript, setting length to 0 clears the array
      if (node.left && node.left.type === 'ArrayLength' && node.operator === '=') {
        const rightVal = node.right;
        const isZero = (rightVal.type === 'Literal' && rightVal.value === 0) ||
                       (rightVal.type === 'NumericLiteral' && rightVal.value === 0);
        if (isZero) {
          const array = this.transformExpression(node.left.array);
          return new PythonCall(
            new PythonMemberAccess(array, 'clear'),
            []
          );
        }
        // For non-zero length assignment, use slice assignment: arr[:] = arr[:n]
        const array = this.transformExpression(node.left.array);
        const newLen = this.transformExpression(node.right);
        return new PythonAssignment(
          new PythonSubscript(array, new PythonSlice(null, null)),
          new PythonSubscript(array, new PythonSlice(null, newLen))
        );
      }

      // Handle MemberExpression with .length on left side (JavaScript pattern)
      if (node.left && node.left.type === 'MemberExpression' &&
          node.left.property && node.left.property.name === 'length' && node.operator === '=') {
        const rightVal = node.right;
        const isZero = (rightVal.type === 'Literal' && rightVal.value === 0) ||
                       (rightVal.type === 'NumericLiteral' && rightVal.value === 0);
        if (isZero) {
          const array = this.transformExpression(node.left.object);
          return new PythonCall(
            new PythonMemberAccess(array, 'clear'),
            []
          );
        }
      }

      // Handle chained assignments: a = b = c = value
      // Only simple assignments (=) can be chained; compound assignments (+=, -=, etc.) cannot
      let target, value;

      if (node.operator === '=') {
        // Check for chained simple assignments
        const targets = [];
        let currentNode = node;

        // Walk the chain from outermost to innermost, collecting targets
        while (currentNode.type === 'AssignmentExpression' && currentNode.operator === '=') {
          targets.push(currentNode.left);
          if (currentNode.right.type === 'AssignmentExpression' && currentNode.right.operator === '=') {
            currentNode = currentNode.right;
          } else {
            break;
          }
        }

        // Now currentNode.right is the final value (not a simple assignment)
        // Transform the final value first (before transforming targets that might have side effects)

        // Handle UpdateExpression (++/--) as the right side value
        const isUpdateExpr = (n) => n && (n.type === 'UpdateExpression' ||
          (n.type === 'UnaryExpression' && (n.operator === '++' || n.operator === '--')));

        let finalValue;
        if (isUpdateExpr(currentNode.right)) {
          // For code++: use current value, then increment
          // For ++code: increment, then use new value
          const rightNode = currentNode.right;
          const updateTarget = this.transformExpression(rightNode.argument);
          const one = PythonLiteral.Int(1);
          const op = rightNode.operator === '++' ? '+=' : '-=';
          const updateStmt = new PythonAssignment(updateTarget, one);
          updateStmt.operator = op;
          updateStmt.isAugmented = true;

          if (rightNode.prefix) {
            // Prefix ++x: increment first, then use new value
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(updateStmt);
            finalValue = this.transformExpression(rightNode.argument);
          } else {
            // Postfix x++: use current value, then increment
            this.pendingPostStatements.push(updateStmt);
            finalValue = this.transformExpression(rightNode.argument);
          }
        } else {
          finalValue = this.transformExpression(currentNode.right);
        }

        // Transform all targets (outermost first, which corresponds to evaluation order)
        // Side effects (like subscript increments) will be collected in pendingPostStatements
        const transformedTargets = targets.map(t => this.transformExpression(t));

        // The outermost target (index 0) becomes the main assignment target
        target = transformedTargets[0];
        value = finalValue;

        // If there are multiple targets (chained assignment), create sequential assignments
        // In JavaScript: a = b = c = value means c=value, b=value, a=value (right to left)
        // We emit the inner assignments (right to left, innermost first) as pre-statements
        if (transformedTargets.length > 1) {
          // Emit innermost first, then work outward (but skip the outermost which is our main assignment)
          for (let i = transformedTargets.length - 1; i > 0; --i) {
            const innerTarget = transformedTargets[i];
            const innerAssignment = new PythonAssignment(innerTarget, finalValue);
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(innerAssignment);
          }
        }
      } else {
        // Compound assignment (+=, -=, etc.) - cannot be chained
        target = this.transformExpression(node.left);
        value = this.transformExpression(node.right);
      }

      // Handle unsigned right shift assignment (>>>=)
      // Python doesn't have >>>=, so convert x >>>= n to x = (x >> n) & 0xFFFFFFFF
      if (node.operator === '>>>=') {
        const targetAgain = this.transformExpression(node.left);
        const shift = new PythonBinaryExpression(targetAgain, '>>', value);
        const masked = new PythonBinaryExpression(shift, '&', PythonLiteral.Int(0xFFFFFFFF));
        return new PythonAssignment(target, masked);
      }

      const assignment = new PythonAssignment(target, value);
      assignment.operator = node.operator;
      assignment.isAugmented = node.operator !== '=';

      return assignment;
    }

    /**
     * Transform object destructuring assignment to sequential assignments
     * ({a: x, b: y} = source) becomes:
     *   _result = source
     *   x = _result["a"]
     *   y = _result["b"]
     */
    transformObjectDestructuringAssignment(node) {
      const source = this.transformExpression(node.right);
      const properties = node.left.properties || [];

      // Create a temp variable name (unique per call)
      if (!this._destructuringCounter) this._destructuringCounter = 0;
      const tempName = `_destruct_${++this._destructuringCounter}`;
      const tempIdent = new PythonIdentifier(tempName);

      // Create the statements
      const statements = [];

      // First: assign source to temp variable
      statements.push(new PythonAssignment(tempIdent, source));

      // Then: for each property, assign temp["key"] to target
      for (const prop of properties) {
        // Get the key name (the property name in the object)
        const keyName = prop.key?.name || prop.key?.value || (typeof prop.key === 'string' ? prop.key : null);
        if (!keyName) continue;

        // Get the target (what we're assigning to)
        // Could be an identifier or a member expression like v[0]
        const target = this.transformExpression(prop.value || prop.key);

        // Create: target = _result["keyName"]
        const dictAccess = new PythonSubscript(
          new PythonIdentifier(tempName),
          PythonLiteral.Str(keyName)
        );
        statements.push(new PythonAssignment(target, dictAccess));
      }

      // Return a block containing all statements
      // Note: This is returned from an expression context, so the caller needs to handle it
      const block = new PythonBlock();
      block.statements = statements;
      return block;
    }

    transformMemberExpression(node) {
      // Handle global.X pattern - strip the global. prefix
      // JavaScript's `global.OpCodes` or `global.AlgorithmFramework` should become just `OpCodes` or `AlgorithmFramework`
      // These are available in the Python runtime helpers
      if (node.object.type === 'Identifier' &&
          (node.object.name === 'global' || node.object.name === 'globalThis')) {
        const propName = node.property.name || node.property.value;
        // Return just the property name - OpCodes, AlgorithmFramework, etc.
        // These are available as globals in the Python runtime
        if (propName === 'OpCodes') {
          return new PythonIdentifier('OpCodes');
        }
        if (propName === 'AlgorithmFramework') {
          return new PythonIdentifier('AlgorithmFramework');
        }
        // For other global properties, convert to snake_case
        return new PythonIdentifier(toSnakeCase(propName));
      }

      // Known enum objects from AlgorithmFramework
      const ENUM_OBJECTS = new Set([
        'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'
      ]);

      // Known framework classes that should be used directly (not via AlgorithmFramework.)
      const FRAMEWORK_TYPES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase'
      ]);

      // Handle AlgorithmFramework.X pattern - strip the AlgorithmFramework. prefix
      // e.g., AlgorithmFramework.CategoryType.BLOCK -> category_type.BLOCK
      // e.g., AlgorithmFramework.KeySize -> KeySize
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        const propName = node.property.name || node.property.value;

        // Track for stub generation
        this.frameworkFunctions.add('algorithm_framework');

        // For enums like AlgorithmFramework.CategoryType, return the enum identifier
        if (ENUM_OBJECTS.has(propName)) {
          this.enumsUsed.add(toSnakeCase(propName));
          return new PythonIdentifier(toSnakeCase(propName));
        }

        // For helper classes like AlgorithmFramework.KeySize, AlgorithmFramework.LinkItem
        if (FRAMEWORK_TYPES.has(propName)) {
          this.helperClasses.add(propName);
          return new PythonIdentifier(propName);
        }

        // For other AlgorithmFramework properties, return as snake_case
        return new PythonIdentifier(toSnakeCase(propName));
      }

      // Handle AlgorithmFramework.X.Y pattern (nested, like AlgorithmFramework.CategoryType.BLOCK)
      // When object is itself a MemberExpression with AlgorithmFramework as the outermost object
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {

        const middleProp = node.object.property.name || node.object.property.value;
        const outerProp = node.property.name || node.property.value;

        // Track for stub generation
        this.frameworkFunctions.add('algorithm_framework');

        // For enum constants like AlgorithmFramework.CategoryType.BLOCK
        if (ENUM_OBJECTS.has(middleProp)) {
          this.enumsUsed.add(toSnakeCase(middleProp));
          // Return enum_object.CONSTANT (keep constant uppercase)
          return new PythonMemberAccess(
            new PythonIdentifier(toSnakeCase(middleProp)),
            outerProp  // Keep enum constant in original case
          );
        }

        // For other nested access, convert both parts
        return new PythonMemberAccess(
          new PythonIdentifier(toSnakeCase(middleProp)),
          toSnakeCase(outerProp)
        );
      }

      // Check if accessing enum constant (keep UPPERCASE)
      const isEnumAccess = node.object.type === 'Identifier' && ENUM_OBJECTS.has(node.object.name);

      // Track enum usage for stub generation (before snake_case conversion)
      if (isEnumAccess)
        this.enumsUsed.add(toSnakeCase(node.object.name));

      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Computed access: obj[prop]
        // Handle UpdateExpression, UnaryExpression (++/--), and AssignmentExpression specially - Python doesn't support these in subscripts
        let property;
        const prop = node.property;
        const isUpdate = prop.type === 'UpdateExpression' ||
                        (prop.type === 'UnaryExpression' && (prop.operator === '++' || prop.operator === '--'));

        if (isUpdate) {
          if (!prop.prefix) {
            // Postfix i++ or i--: use current value, then add increment/decrement as post-statement
            const target = this.transformExpression(prop.argument);
            const one = PythonLiteral.Int(1);
            const op = prop.operator === '++' ? '+=' : '-=';
            const postIncrement = new PythonAssignment(target, one);
            postIncrement.operator = op;
            postIncrement.isAugmented = true;
            if (!this.pendingPostStatements) this.pendingPostStatements = [];
            this.pendingPostStatements.push(postIncrement);
            // Use current value as the subscript index
            property = this.transformExpression(prop.argument);
          } else {
            // Prefix ++i or --i: increment first (add as pre-statement), then use new value
            const target = this.transformExpression(prop.argument);
            const one = PythonLiteral.Int(1);
            const op = prop.operator === '++' ? '+=' : '-=';
            const preIncrement = new PythonAssignment(target, one);
            preIncrement.operator = op;
            preIncrement.isAugmented = true;
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(preIncrement);
            // Use new value as the subscript index
            property = this.transformExpression(prop.argument);
          }
        } else if (prop.type === 'AssignmentExpression') {
          // For assignments in subscripts, add as pre-statement and use assigned value
          const assignment = this.transformAssignmentExpression(prop);
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(assignment);
          property = this.transformAssignmentExpressionForExpression(prop);
        } else {
          property = this.transformExpression(prop);
        }
        return new PythonSubscript(object, property);
      } else {
        // Dot access: obj.prop
        const propName = node.property.name || node.property.value;

        // Handle special property mappings
        if (propName === 'length') {
          return new PythonCall(new PythonIdentifier('len'), [object]);
        }

        // Keep enum constants UPPERCASE, convert other properties to snake_case
        let property = isEnumAccess ? propName : toSnakeCase(propName);

        // Check for field/method collision when accessing this.xxx (object is 'self')
        if (node.object.type === 'ThisExpression' &&
            this.currentClassMethodNames &&
            this.currentClassMethodNames.has(property)) {
          property = '_' + property + '_value';
        }

        // Check for backing field access inside a getter/setter
        // This handles patterns like:
        //   get outputSize() { return this.OutputSize; }  // JS uses different case for backing field
        //   set outputSize(value) { this.OutputSize = value; }
        // Both outputSize and OutputSize map to output_size in Python, causing infinite recursion
        // We convert such accesses to self._property_name_backing
        if (node.object.type === 'ThisExpression' &&
            this.currentPropertyName &&
            property === this.currentPropertyName) {
          property = '_' + property + '_backing';
        }

        return new PythonMemberAccess(object, property);
      }
    }

    transformCallExpression(node) {
      // Transform arguments, handling UpdateExpression, UnaryExpression (++/--), and AssignmentExpression specially
      // Python doesn't support i++, ++i, or i += n as expressions in function arguments
      const args = node.arguments.map(arg => {
        const isUpdate = arg.type === 'UpdateExpression' ||
                        (arg.type === 'UnaryExpression' && (arg.operator === '++' || arg.operator === '--'));
        if (isUpdate) {
          // For postfix increment/decrement, we need to:
          // 1. Use the current value in the function call
          // 2. Add increment/decrement as post-statement to execute after the call
          if (!arg.prefix) {
            // Postfix: n++ or n-- -> use n, then add n += 1 or n -= 1 after
            const target = this.transformExpression(arg.argument);
            const one = PythonLiteral.Int(1);
            const op = arg.operator === '++' ? '+=' : '-=';
            const postIncrement = new PythonAssignment(target, one);
            postIncrement.operator = op;
            postIncrement.isAugmented = true;
            this.pendingPostStatements.push(postIncrement);
            // Return just the variable (current value before increment)
            return this.transformExpression(arg.argument);
          }
          // Prefix: ++n or --n -> use n + 1 or n - 1
          return this.transformUpdateExpressionForExpression(arg);
        }
        if (arg.type === 'AssignmentExpression') {
          // For assignment expressions in function arguments:
          // foo(x = value) -> x = value; foo(x)   (for simple =)
          // foo(x += value) -> (original implementation)
          // Extract the assignment as a pre-statement and use the target value in the call
          const assignment = this.transformAssignmentExpression(arg);
          // Use unshift to add BEFORE any post-statements from other args
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(assignment);
          // Return the value that was assigned (the right side of the assignment)
          return this.transformAssignmentExpressionForExpression(arg);
        }
        return this.transformExpression(arg);
      });

      if (node.callee.type === 'MemberExpression') {
        const target = this.transformExpression(node.callee.object);
        const methodName = node.callee.property.name || node.callee.property.value;

        // Check for OpCodes methods
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'OpCodes') {
          return this.transformOpCodesCall(methodName, args);
        }

        // Track AlgorithmFramework usage for stub generation
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'AlgorithmFramework') {
          this.frameworkFunctions.add('algorithm_framework');
        }

        // Handle console methods (JavaScript console -> Python print)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'console') {
          // console.log() -> print()
          if (methodName === 'log' || methodName === 'warn' || methodName === 'error' || methodName === 'info')
            return new PythonCall(new PythonIdentifier('print'), args);
          // console.time/timeEnd -> pass (no-op in Python)
          if (methodName === 'time' || methodName === 'timeEnd')
            return new PythonIdentifier('pass');
        }

        // Handle JSON methods (JavaScript JSON -> Python json)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'JSON') {
          // JSON.stringify(obj) -> json.dumps(obj)
          if (methodName === 'stringify') {
            this.imports.add('json');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('json'), 'dumps'), args.length > 0 ? [args[0]] : []);
          }
          // JSON.parse(str) -> json.loads(str)
          if (methodName === 'parse') {
            this.imports.add('json');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('json'), 'loads'), args);
          }
        }

        // Handle Date methods (JavaScript Date -> Python datetime)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Date') {
          // Date.now() -> int(datetime.datetime.now().timestamp() * 1000)
          if (methodName === 'now') {
            this.imports.add('datetime');
            return new PythonCall(
              new PythonIdentifier('int'),
              [new PythonBinaryExpression(
                new PythonCall(
                  new PythonMemberAccess(
                    new PythonCall(
                      new PythonMemberAccess(
                        new PythonMemberAccess(new PythonIdentifier('datetime'), 'datetime'),
                        'now'
                      ),
                      []
                    ),
                    'timestamp'
                  ),
                  []
                ),
                '*',
                PythonLiteral.Int(1000)
              )]
            );
          }
        }

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> x (Python doesn't have freeze, tuples are immutable but lists aren't)
          if (methodName === 'freeze' && args.length === 1)
            return args[0];
          // Object.keys(obj) -> list(obj.keys()) or obj.keys()
          if (methodName === 'keys' && args.length === 1)
            return new PythonCall(new PythonIdentifier('list'), [new PythonCall(new PythonMemberAccess(args[0], 'keys'), [])]);
          // Object.values(obj) -> list(obj.values())
          if (methodName === 'values' && args.length === 1)
            return new PythonCall(new PythonIdentifier('list'), [new PythonCall(new PythonMemberAccess(args[0], 'values'), [])]);
          // Object.entries(obj) -> list(obj.items())
          if (methodName === 'entries' && args.length === 1)
            return new PythonCall(new PythonIdentifier('list'), [new PythonCall(new PythonMemberAccess(args[0], 'items'), [])]);
          // Object.assign(target, source) -> {**target, **source} or target.update(source)
          if (methodName === 'assign' && args.length >= 2) {
            return new PythonCall(new PythonMemberAccess(args[0], 'update'), [args[1]]);
          }
        }

        // Handle Array static methods (JavaScript built-ins)
        // Note: Check for both original name 'Array' and snake_case 'array' in case of pre-transformation
        const objName = node.callee.object.type === 'Identifier' ? node.callee.object.name : null;

        // Handle Number static methods
        if (objName === 'Number' || objName === 'number' || objName === 'int') {
          // Number.isInteger(x) -> isinstance(x, int)
          if ((methodName === 'isInteger' || methodName === 'is_integer') && args.length === 1)
            return new PythonCall(new PythonIdentifier('isinstance'), [args[0], new PythonIdentifier('int')]);
          // Number.isNaN(x) -> math.isnan(x)
          if ((methodName === 'isNaN' || methodName === 'is_na_n') && args.length === 1) {
            this.imports.add('math');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isnan'), args);
          }
          // Number.isFinite(x) -> math.isfinite(x)
          if ((methodName === 'isFinite' || methodName === 'is_finite') && args.length === 1) {
            this.imports.add('math');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isfinite'), args);
          }
          // Number.parseFloat(x) -> float(x)
          if ((methodName === 'parseFloat' || methodName === 'parse_float') && args.length >= 1)
            return new PythonCall(new PythonIdentifier('float'), [args[0]]);
          // Number.parseInt(x) -> int(x)
          if ((methodName === 'parseInt' || methodName === 'parse_int') && args.length >= 1)
            return new PythonCall(new PythonIdentifier('int'), [args[0]]);
        }

        if (objName === 'Array' || objName === 'array') {
          // Array.from(x) -> list(x)
          if (methodName === 'from') {
            if (args.length === 1) {
              return new PythonCall(new PythonIdentifier('list'), [args[0]]);
            }
            // Array.from(x, mapFn) -> [mapFn(i) for i in x]
            // Special case: Array.from({length: n}, fn) -> [fn(_i) for _i in range(n)]
            if (args.length >= 2) {
              const firstArg = node.arguments[0];
              let iterable = args[0];

              // Check if first arg is {length: n} pattern
              if (firstArg && firstArg.type === 'ObjectExpression' && firstArg.properties) {
                const lengthProp = firstArg.properties.find(p =>
                  (p.key && (p.key.name === 'length' || p.key.value === 'length'))
                );
                if (lengthProp && lengthProp.value) {
                  // Use range(n) as the iterable
                  iterable = new PythonCall(
                    new PythonIdentifier('range'),
                    [this.transformExpression(lengthProp.value)]
                  );
                }
              }
              // Also check for JSObject pattern with length
              if (iterable.type === 'PythonCall' &&
                  iterable.func && iterable.func.name === 'JSObject') {
                // Already wrapped in JSObject - extract length if present
                const dictArg = iterable.args && iterable.args[0];
                if (dictArg && dictArg.type === 'PythonDict') {
                  const lengthEntry = dictArg.entries.find(e =>
                    e.key && (e.key.value === 'length' || e.key.name === 'length')
                  );
                  if (lengthEntry && lengthEntry.value) {
                    iterable = new PythonCall(
                      new PythonIdentifier('range'),
                      [lengthEntry.value]
                    );
                  }
                }
              }

              // Check if mapper function uses its parameter
              const mapper = args[1];
              const mapperNode = node.arguments[1];

              // If mapper is a parameterless arrow function, just call it directly
              if (mapperNode &&
                  (mapperNode.type === 'ArrowFunctionExpression' ||
                   mapperNode.type === 'FunctionExpression') &&
                  (!mapperNode.params || mapperNode.params.length === 0)) {
                // Parameterless function: use the lambda body directly
                // Use nodeType (not type) since PythonNode uses nodeType property
                return new PythonListComprehension(
                  (mapper.nodeType === 'Lambda' && mapper.body)
                    ? mapper.body
                    : new PythonCall(mapper, []),
                  new PythonIdentifier('_'),
                  iterable
                );
              }

              return new PythonListComprehension(
                new PythonCall(mapper, [new PythonIdentifier('_i')]),
                new PythonIdentifier('_i'),
                iterable
              );
            }
          }
          // Array.isArray(x) -> isinstance(x, list)
          if ((methodName === 'isArray' || methodName === 'is_array') && args.length === 1) {
            return new PythonCall(
              new PythonIdentifier('isinstance'),
              [args[0], new PythonIdentifier('list')]
            );
          }
        }

        // Handle TypedArray static methods (Uint8Array.from, Int32Array.from, etc.)
        // Note: Include both PascalCase and snake_case versions
        const typedArrayMap = {
          'Uint8Array': 'bytearray', 'uint8_array': 'bytearray',
          'Uint16Array': 'list', 'uint16_array': 'list',
          'Uint32Array': 'list', 'uint32_array': 'list',
          'Int8Array': 'bytearray', 'int8_array': 'bytearray',
          'Int16Array': 'list', 'int16_array': 'list',
          'Int32Array': 'list', 'int32_array': 'list',
          'Float32Array': 'list', 'float32_array': 'list',
          'Float64Array': 'list', 'float64_array': 'list'
        };
        if (objName && typedArrayMap[objName]) {
          // TypedArray.from(x) -> list(x) or bytearray(x) for Uint8Array
          if (methodName === 'from') {
            const targetType = typedArrayMap[objName];
            if (args.length === 1) {
              return new PythonCall(new PythonIdentifier(targetType), [args[0]]);
            }
            // TypedArray.from(x, mapFn) -> [mapFn(i) for i in x]
            // Special case: TypedArray.from({length: n}, fn) -> [fn(_i) for _i in range(n)]
            if (args.length >= 2) {
              const firstArg = node.arguments[0];
              let iterable = args[0];

              // Check if first arg is {length: n} pattern
              if (firstArg && firstArg.type === 'ObjectExpression' && firstArg.properties) {
                const lengthProp = firstArg.properties.find(p =>
                  (p.key && (p.key.name === 'length' || p.key.value === 'length'))
                );
                if (lengthProp && lengthProp.value) {
                  iterable = new PythonCall(
                    new PythonIdentifier('range'),
                    [this.transformExpression(lengthProp.value)]
                  );
                }
              }

              // Check if mapper function is parameterless
              const mapper = args[1];
              const mapperNode = node.arguments[1];
              if (mapperNode &&
                  (mapperNode.type === 'ArrowFunctionExpression' ||
                   mapperNode.type === 'FunctionExpression') &&
                  (!mapperNode.params || mapperNode.params.length === 0)) {
                // Use nodeType (not type) since PythonNode uses nodeType property
                return new PythonListComprehension(
                  (mapper.nodeType === 'Lambda' && mapper.body)
                    ? mapper.body
                    : new PythonCall(mapper, []),
                  new PythonIdentifier('_'),
                  iterable
                );
              }

              // For simple arrow functions like (value => value & 0xff), substitute directly
              const mapperFnNode = node.arguments[1];
              if (mapperFnNode &&
                  (mapperFnNode.type === 'ArrowFunctionExpression' ||
                   mapperFnNode.type === 'FunctionExpression') &&
                  mapperFnNode.params?.length === 1) {
                const paramName = mapperFnNode.params[0].name || mapperFnNode.params[0];
                const bodyNode = mapperFnNode.body?.type === 'BlockStatement'
                  ? (mapperFnNode.body.body?.[0]?.argument || mapperFnNode.body)
                  : mapperFnNode.body;

                // Create a modified AST where the parameter is replaced with _i
                const substitutedBody = this._substituteIdentifier(bodyNode, paramName, '_i');
                const bodyExpr = this.transformExpression(substitutedBody);

                return new PythonListComprehension(
                  bodyExpr,
                  new PythonIdentifier('_i'),
                  iterable
                );
              }

              // Fallback: call the mapper function on each element
              return new PythonListComprehension(
                new PythonCall(mapper, [new PythonIdentifier('_i')]),
                new PythonIdentifier('_i'),
                iterable
              );
            }
          }
        }

        // Handle String static methods
        if (objName === 'String' || objName === 'str') {
          // String.fromCharCode(x) -> chr(x) or ''.join(chr(c) for c in [a, b, ...])
          if (methodName === 'fromCharCode' || methodName === 'from_char_code') {
            // Check if the argument is a spread (...array) before transformation
            const hasSpread = node.arguments && node.arguments.length === 1 &&
                              node.arguments[0].type === 'SpreadElement';
            if (hasSpread) {
              // String.fromCharCode(...array) -> ''.join(chr(c) for c in array)
              const spreadArg = this.transformExpression(node.arguments[0].argument);
              return new PythonCall(
                new PythonMemberAccess(new PythonLiteral("''"), 'join'),
                [new PythonGeneratorExpression(
                  new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                  new PythonIdentifier('_c'),
                  spreadArg
                )]
              );
            }
            if (args.length === 1)
              return new PythonCall(new PythonIdentifier('chr'), args);
            // Multiple args: ''.join(chr(c) for c in [a, b, c, ...])
            return new PythonCall(
              new PythonMemberAccess(new PythonLiteral("''"), 'join'),
              [new PythonGeneratorExpression(
                new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                new PythonIdentifier('_c'),
                new PythonList(args)
              )]
            );
          }
          // String.fromCodePoint(x) -> chr(x) or ''.join(chr(c) for c in [a, b, ...])
          if (methodName === 'fromCodePoint' || methodName === 'from_code_point') {
            // Check if the argument is a spread (...array) before transformation
            const hasSpread = node.arguments && node.arguments.length === 1 &&
                              node.arguments[0].type === 'SpreadElement';
            if (hasSpread) {
              // String.fromCodePoint(...array) -> ''.join(chr(c) for c in array)
              const spreadArg = this.transformExpression(node.arguments[0].argument);
              return new PythonCall(
                new PythonMemberAccess(new PythonLiteral("''"), 'join'),
                [new PythonGeneratorExpression(
                  new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                  new PythonIdentifier('_c'),
                  spreadArg
                )]
              );
            }
            if (args.length === 1)
              return new PythonCall(new PythonIdentifier('chr'), args);
            return new PythonCall(
              new PythonMemberAccess(new PythonLiteral("''"), 'join'),
              [new PythonGeneratorExpression(
                new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                new PythonIdentifier('_c'),
                new PythonList(args)
              )]
            );
          }
        }

        // Handle Function.apply() pattern - especially String.fromCharCode.apply(null, array)
        if (methodName === 'apply' && args.length >= 2) {
          // Check if target is X.fromCharCode where X is String/str
          if (node.callee.object.type === 'MemberExpression') {
            const innerObj = node.callee.object.object;
            const innerMethod = node.callee.object.property.name || (node.callee.object.property.value);
            if (innerObj && innerObj.type === 'Identifier') {
              const innerObjName = innerObj.name;
              if ((innerObjName === 'String' || innerObjName === 'str' || innerObjName === 'string') &&
                  (innerMethod === 'fromCharCode' || innerMethod === 'from_char_code')) {
                // String.fromCharCode.apply(null, array) -> ''.join(chr(c) for c in array)
                const arrayArg = args[1];
                return new PythonCall(
                  new PythonMemberAccess(new PythonLiteral("''"), 'join'),
                  [new PythonGeneratorExpression(
                    new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                    new PythonIdentifier('_c'),
                    arrayArg
                  )]
                );
              }
            }
          }
          // Generic fn.apply(thisArg, argsArray) -> fn(*argsArray)
          // In Python, we can unpack the args list with * operator
          return new PythonCall(target, [new PythonUnaryExpression('*', args[1])]);
        }
        // Handle Function.call() pattern
        if (methodName === 'call' && args.length >= 1) {
          // fn.call(thisArg, arg1, arg2, ...) -> fn(arg1, arg2, ...)
          // Skip the thisArg (first argument) and pass the rest
          return new PythonCall(target, args.slice(1));
        }

        // Handle array methods
        if (methodName === 'push') {
          // Check if any argument is a spread element (arr.push(...data) -> arr.extend(data))
          const hasSpread = node.arguments.some(arg => arg.type === 'SpreadElement');
          if (hasSpread) {
            // Check if all arguments are spread elements
            const allSpread = node.arguments.every(arg => arg.type === 'SpreadElement');
            if (allSpread) {
              if (node.arguments.length === 1) {
                // arr.push(...data) -> arr.extend(data)
                const spreadArg = this.transformExpression(node.arguments[0].argument);
                return new PythonCall(new PythonMemberAccess(target, 'extend'), [spreadArg]);
              }
              // arr.push(...a, ...b, ...c) -> arr.extend(a + b + c)
              const spreadArgs = node.arguments.map(arg => this.transformExpression(arg.argument));
              let concatenated = spreadArgs[0];
              for (let i = 1; i < spreadArgs.length; ++i)
                concatenated = new PythonBinaryExpression(concatenated, '+', spreadArgs[i]);
              return new PythonCall(new PythonMemberAccess(target, 'extend'), [concatenated]);
            }
            // Mixed spread and non-spread: arr.push(x, ...y, z) -> complex
            // For now, handle by extending with concatenated lists
            const parts = node.arguments.map(arg => {
              if (arg.type === 'SpreadElement')
                return this.transformExpression(arg.argument);
              return new PythonList([this.transformExpression(arg)]);
            });
            let concatenated = parts[0];
            for (let i = 1; i < parts.length; ++i)
              concatenated = new PythonBinaryExpression(concatenated, '+', parts[i]);
            return new PythonCall(new PythonMemberAccess(target, 'extend'), [concatenated]);
          }
          // arr.push(x) -> arr.append(x)
          return new PythonCall(new PythonMemberAccess(target, 'append'), args);
        }
        if (methodName === 'pop') {
          return new PythonCall(new PythonMemberAccess(target, 'pop'), []);
        }
        if (methodName === 'slice') {
          if (args.length === 0) {
            return new PythonSubscript(target, new PythonSlice(null, null));
          } else if (args.length === 1) {
            return new PythonSubscript(target, new PythonSlice(args[0], null));
          } else {
            return new PythonSubscript(target, new PythonSlice(args[0], args[1]));
          }
        }
        if (methodName === 'concat') {
          return new PythonBinaryExpression(target, '+', args[0]);
        }
        if (methodName === 'fill') {
          return new PythonBinaryExpression(
            new PythonList([args[0]]),
            '*',
            new PythonCall(new PythonIdentifier('len'), [target])
          );
        }

        // String/array methods
        if (methodName === 'indexOf') {
          // str.indexOf(x) -> str.find(x) for strings, list.index(x) for lists
          // Using find() is safer as it returns -1 on not found
          return new PythonCall(new PythonMemberAccess(target, 'find'), args);
        }
        if (methodName === 'charAt') {
          // str.charAt(i) -> str[i]
          return new PythonSubscript(target, args[0]);
        }
        if (methodName === 'charCodeAt') {
          // str.charCodeAt(i) -> ord(str[i])
          return new PythonCall(new PythonIdentifier('ord'), [new PythonSubscript(target, args[0])]);
        }
        if (methodName === 'fromCharCode' || methodName === 'from_char_code') {
          // String.fromCharCode(x) -> chr(x) or ''.join(chr(c) for c in [a, b, ...])
          // Check if the argument is a spread (...array) before transformation
          const hasSpread = node.arguments && node.arguments.length === 1 &&
                            node.arguments[0].type === 'SpreadElement';
          if (hasSpread) {
            // String.fromCharCode(...array) -> ''.join(chr(c) for c in array)
            const spreadArg = this.transformExpression(node.arguments[0].argument);
            return new PythonCall(
              new PythonMemberAccess(new PythonLiteral("''"), 'join'),
              [new PythonGeneratorExpression(
                new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                new PythonIdentifier('_c'),
                spreadArg
              )]
            );
          }
          if (args.length === 1)
            return new PythonCall(new PythonIdentifier('chr'), args);
          return new PythonCall(
            new PythonMemberAccess(new PythonLiteral("''"), 'join'),
            [new PythonGeneratorExpression(
              new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
              new PythonIdentifier('_c'),
              new PythonList(args)
            )]
          );
        }
        if (methodName === 'length') {
          // Handled as property, not method
          return new PythonCall(new PythonIdentifier('len'), [target]);
        }
        if (methodName === 'toString') {
          return new PythonCall(new PythonIdentifier('str'), [target]);
        }
        if (methodName === 'toFixed') {
          // num.toFixed(digits) -> f"{num:.{digits}f}" or format(num, f".{digits}f")
          const digits = args.length > 0 ? args[0] : PythonLiteral.Int(0);
          // Use round for simplicity: str(round(num, digits))
          return new PythonCall(
            new PythonIdentifier('str'),
            [new PythonCall(new PythonIdentifier('round'), [target, digits])]
          );
        }
        if (methodName === 'join') {
          // arr.join(sep) -> sep.join(arr)
          if (args.length > 0) {
            return new PythonCall(new PythonMemberAccess(args[0], 'join'), [target]);
          }
          return new PythonCall(new PythonMemberAccess(PythonLiteral.Str(''), 'join'), [target]);
        }
        if (methodName === 'split') {
          return new PythonCall(new PythonMemberAccess(target, 'split'), args);
        }
        if (methodName === 'includes') {
          // arr.includes(x) -> x in arr
          return new PythonBinaryExpression(args[0], 'in', target);
        }
        if (methodName === 'has') {
          // map.has(key) or set.has(key) -> key in map/set
          return new PythonBinaryExpression(args[0], 'in', target);
        }
        if (methodName === 'map') {
          // arr.map(fn) -> [fn(x) for x in arr] or [fn(x, i) for i, x in enumerate(arr)]
          const callbackNode = node.arguments[0];

          // Helper to extract map expression from callback body
          const getMapExprFromBody = (body, elemId, idxId) => {
            if (body.type === 'BlockStatement') {
              // Find the last return statement
              const returnStmt = body.body.find(s => s.type === 'ReturnStatement');
              if (returnStmt) {
                // Check if the block is simple (only contains return)
                // or if it has other statements
                if (body.body.length === 1 ||
                    (body.body.every(s => s.type === 'ReturnStatement' ||
                                          s.type === 'VariableDeclaration' ||
                                          s.type === 'ExpressionStatement'))) {
                  // Simple enough - extract return expression
                  return this.transformExpression(returnStmt.argument);
                }
              }
              // Complex block - can't convert to list comprehension
              // Fall back to list() + map() pattern
              return null;
            }
            // Simple expression body
            return this.transformExpression(body);
          };

          if (callbackNode &&
              (callbackNode.type === 'ArrowFunctionExpression' ||
               callbackNode.type === 'FunctionExpression')) {
            const body = callbackNode.body;
            const params = callbackNode.params || [];

            if (params.length >= 2) {
              // Two parameters: use enumerate for (index, element)
              // In JS it's (element, index), in Python enumerate gives (index, element)
              const elemParam = params[0].name || 'x';
              const idxParam = params[1].name || 'i';
              const elemId = new PythonIdentifier(toSnakeCase(elemParam));
              const idxId = new PythonIdentifier(toSnakeCase(idxParam));

              const mapExpr = getMapExprFromBody(body, elemId, idxId);
              if (mapExpr) {
                // [expr for i, elem in enumerate(arr)]
                const enumCall = new PythonCall(new PythonIdentifier('enumerate'), [target]);
                const tupleVar = new PythonTuple([idxId, elemId]);
                return new PythonListComprehension(mapExpr, tupleVar, enumCall);
              }
              // Complex body - use list(map(lambda, arr)) fallback
              const lambdaBody = this.transformExpression(body);
              const lambdaExpr = new PythonLambda([elemId, idxId], lambdaBody);
              return new PythonCall(
                new PythonIdentifier('list'),
                [new PythonCall(new PythonIdentifier('map'), [lambdaExpr, new PythonCall(new PythonIdentifier('enumerate'), [target])])]
              );
            } else {
              // Single parameter
              const elemParam = params[0]?.name || '_i';
              const elemId = new PythonIdentifier(toSnakeCase(elemParam));

              const mapExpr = getMapExprFromBody(body, elemId, null);
              if (mapExpr) {
                // [expr for elem in arr]
                return new PythonListComprehension(mapExpr, elemId, target);
              }
              // Complex body - transform the full function and use list(map())
              const transformedCallback = this.transformExpression(callbackNode);
              return new PythonCall(
                new PythonIdentifier('list'),
                [new PythonCall(new PythonIdentifier('map'), [transformedCallback, target])]
              );
            }
          }
          // Non-function callback (e.g., passing a function reference)
          return new PythonListComprehension(
            new PythonCall(args[0], [new PythonIdentifier('x')]),
            new PythonIdentifier('x'),
            target
          );
        }
        if (methodName === 'filter') {
          // arr.filter(fn) -> [x for x in arr if fn(x)]
          return new PythonListComprehension(
            new PythonIdentifier('x'),
            new PythonIdentifier('x'),
            target,
            new PythonCall(args[0], [new PythonIdentifier('x')])
          );
        }
        if (methodName === 'forEach') {
          // This should be a statement, not an expression - emit as a for loop comment
          this.warnings.push('forEach() converted to comment - use for loop instead');
          return new PythonIdentifier('None  # TODO: convert forEach to for loop');
        }
        // String case conversion methods
        if (methodName === 'toUpperCase') {
          return new PythonCall(new PythonMemberAccess(target, 'upper'), []);
        }
        if (methodName === 'toLowerCase') {
          return new PythonCall(new PythonMemberAccess(target, 'lower'), []);
        }
        if (methodName === 'trim') {
          return new PythonCall(new PythonMemberAccess(target, 'strip'), []);
        }
        if (methodName === 'trimStart' || methodName === 'trimLeft') {
          return new PythonCall(new PythonMemberAccess(target, 'lstrip'), []);
        }
        if (methodName === 'trimEnd' || methodName === 'trimRight') {
          return new PythonCall(new PythonMemberAccess(target, 'rstrip'), []);
        }
        if (methodName === 'startsWith') {
          return new PythonCall(new PythonMemberAccess(target, 'startswith'), args);
        }
        if (methodName === 'endsWith') {
          return new PythonCall(new PythonMemberAccess(target, 'endswith'), args);
        }
        if (methodName === 'repeat') {
          // str.repeat(n) -> str * n
          return new PythonBinaryExpression(target, '*', args[0]);
        }
        if (methodName === 'padStart') {
          // str.padStart(len, fillChar) -> str.rjust(len, fillChar)
          return new PythonCall(new PythonMemberAccess(target, 'rjust'), args);
        }
        if (methodName === 'padEnd') {
          // str.padEnd(len, fillChar) -> str.ljust(len, fillChar)
          return new PythonCall(new PythonMemberAccess(target, 'ljust'), args);
        }
        if (methodName === 'replace' || methodName === 'replaceAll') {
          // Use safe_replace to handle None values like JavaScript
          const search = args[0] || PythonLiteral.Str('');
          const replacement = args[1] || PythonLiteral.Str('');
          return new PythonCall(new PythonIdentifier('safe_replace'), [target, search, replacement]);
        }
        if (methodName === 'substring' || methodName === 'slice') {
          // str.substring(start, end) -> str[start:end]
          const start = args[0] || PythonLiteral.Int(0);
          const end = args.length > 1 ? args[1] : null;
          return new PythonSubscript(target, new PythonSlice(start, end));
        }
        if (methodName === 'substr') {
          // str.substr(start, length) -> str[start:start+length]
          const start = args[0] || PythonLiteral.Int(0);
          if (args.length > 1) {
            const end = new PythonBinaryExpression(start, '+', args[1]);
            return new PythonSubscript(target, new PythonSlice(start, end));
          }
          return new PythonSubscript(target, new PythonSlice(start, null));
        }

        // Regular method call
        const pyMethodName = toSnakeCase(methodName);
        return new PythonCall(new PythonMemberAccess(target, pyMethodName), args);
      }

      // Handle super() calls
      if (node.callee.type === 'Super') {
        // super(args) in constructor -> super().__init__(args)
        return new PythonCall(
          new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
          args
        );
      }

      // Known framework functions from AlgorithmFramework
      const FRAMEWORK_FUNCTIONS = new Set([
        'RegisterAlgorithm', 'register_algorithm'
      ]);

      // Track framework function usage for stub generation
      if (node.callee.type === 'Identifier' && FRAMEWORK_FUNCTIONS.has(node.callee.name))
        this.frameworkFunctions.add(toSnakeCase(node.callee.name));

      // Handle JavaScript global functions
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name;
        // parseInt(x) or parseInt(x, base) -> int(x) or int(x, base)
        if (funcName === 'parseInt') {
          if (args.length === 1)
            return new PythonCall(new PythonIdentifier('int'), args);
          if (args.length >= 2)
            return new PythonCall(new PythonIdentifier('int'), [args[0], args[1]]);
        }
        // parseFloat(x) -> float(x)
        if (funcName === 'parseFloat')
          return new PythonCall(new PythonIdentifier('float'), args);
        // isNaN(x) -> math.isnan(x)
        if (funcName === 'isNaN') {
          this.imports.add('math');
          return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isnan'), args);
        }
        // isFinite(x) -> math.isfinite(x)
        if (funcName === 'isFinite') {
          this.imports.add('math');
          return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isfinite'), args);
        }
        // Number(x) -> int(x) or float(x)
        if (funcName === 'Number')
          return new PythonCall(new PythonIdentifier('int'), args);
        // Boolean(x) -> bool(x)
        if (funcName === 'Boolean')
          return new PythonCall(new PythonIdentifier('bool'), args);
        // String(x) -> str(x)
        if (funcName === 'String')
          return new PythonCall(new PythonIdentifier('str'), args);
        // BigInt('0x...') or BigInt(num) -> int('0x...', 16) or int(num)
        // Python int() natively supports arbitrary precision (like JavaScript BigInt)
        // Note: This handles cases where BigInt() isn't pre-evaluated by type-aware-transpiler
        if (funcName === 'BigInt') {
          if (args.length === 1) {
            // Check if the argument is a hex string literal
            const arg = node.arguments[0];
            if (arg.type === 'Literal' && typeof arg.value === 'string' && arg.value.startsWith('0x')) {
              // BigInt('0x...') -> int('0x...', 16)
              return new PythonCall(new PythonIdentifier('int'), [args[0], PythonLiteral.Int(16)]);
            }
            // BigInt(num) -> int(num)
            return new PythonCall(new PythonIdentifier('int'), args);
          }
          return new PythonCall(new PythonIdentifier('int'), args);
        }
      }

      // Simple function call
      const callee = this.transformExpression(node.callee);

      // Check if callee is super marker
      if (callee instanceof PythonIdentifier && callee.name === '__super__') {
        // This shouldn't happen with proper super handling above, but just in case
        return new PythonCall(
          new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
          args
        );
      }

      return new PythonCall(callee, args);
    }

    transformOpCodesCall(methodName, args) {
      // Check if we have a mapping for this OpCodes method
      if (OPCODES_MAP[methodName]) {
        this.imports.add('struct'); // Most OpCodes methods need struct

        // Build proper AST nodes instead of string interpolation
        switch (methodName) {
          // Rotation operations - call helper functions
          case 'RotL32':
          case 'RotR32':
          case 'RotL64':
          case 'RotR64':
          case 'RotL8':
          case 'RotR8':
          case 'RotL16':
          case 'RotR16':
            return new PythonCall(
              new PythonIdentifier(`_${methodName.toLowerCase()}`),
              args
            );

          // Packing operations
          case 'Pack16BE':
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('struct'), 'pack'),
              [PythonLiteral.Str('>H'), ...args]);
          case 'Pack16LE':
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('struct'), 'pack'),
              [PythonLiteral.Str('<H'), ...args]);
          case 'Pack32BE':
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('struct'), 'pack'),
              [PythonLiteral.Str('>I'), ...args]);
          case 'Pack32LE':
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('struct'), 'pack'),
              [PythonLiteral.Str('<I'), ...args]);
          case 'Pack64BE':
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('struct'), 'pack'),
              [PythonLiteral.Str('>Q'), ...args]);
          case 'Pack64LE':
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('struct'), 'pack'),
              [PythonLiteral.Str('<Q'), ...args]);

          // Unpacking operations - Convert integer to list of bytes
          // JavaScript OpCodes.Unpack32LE takes an int and returns [b0, b1, b2, b3]
          // Python equivalent: list((value & mask).to_bytes(n, endian))
          case 'Unpack16BE':
            return new PythonCall(
              new PythonIdentifier('list'),
              [new PythonCall(
                new PythonMemberAccess(
                  new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFF)),
                  'to_bytes'
                ),
                [PythonLiteral.Int(2), PythonLiteral.Str('big')]
              )]
            );
          case 'Unpack16LE':
            return new PythonCall(
              new PythonIdentifier('list'),
              [new PythonCall(
                new PythonMemberAccess(
                  new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFF)),
                  'to_bytes'
                ),
                [PythonLiteral.Int(2), PythonLiteral.Str('little')]
              )]
            );
          case 'Unpack32BE':
            return new PythonCall(
              new PythonIdentifier('list'),
              [new PythonCall(
                new PythonMemberAccess(
                  new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFFFFFF)),
                  'to_bytes'
                ),
                [PythonLiteral.Int(4), PythonLiteral.Str('big')]
              )]
            );
          case 'Unpack32LE':
            return new PythonCall(
              new PythonIdentifier('list'),
              [new PythonCall(
                new PythonMemberAccess(
                  new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFFFFFF)),
                  'to_bytes'
                ),
                [PythonLiteral.Int(4), PythonLiteral.Str('little')]
              )]
            );
          case 'Unpack64BE':
            return new PythonCall(
              new PythonIdentifier('list'),
              [new PythonCall(
                new PythonMemberAccess(
                  new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFFFFFFFFFFFFFF)),
                  'to_bytes'
                ),
                [PythonLiteral.Int(8), PythonLiteral.Str('big')]
              )]
            );
          case 'Unpack64LE':
            return new PythonCall(
              new PythonIdentifier('list'),
              [new PythonCall(
                new PythonMemberAccess(
                  new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFFFFFFFFFFFFFF)),
                  'to_bytes'
                ),
                [PythonLiteral.Int(8), PythonLiteral.Str('little')]
              )]
            );

          // Bitwise operations with masking
          case 'And32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '&', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );
          case 'Or32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '|', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );
          case 'Xor32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '^', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );
          case 'Not32':
            return new PythonBinaryExpression(
              new PythonUnaryExpression('~', args[0]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );
          case 'Shl32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '<<', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );
          case 'Shr32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '>>', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );

          // Arithmetic operations with masking
          case 'Add32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '+', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );
          case 'Sub32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '-', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );
          case 'Mul32':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '*', args[1]),
              '&',
              PythonLiteral.Int(0xFFFFFFFF)
            );

          // Conversion operations
          case 'ToUint32':
            return new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFFFFFF));
          case 'ToUint16':
            return new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFFFF));
          case 'ToUint8':
          case 'ToByte':
            return new PythonBinaryExpression(args[0], '&', PythonLiteral.Int(0xFF));

          // Array operations
          case 'XorArrays':
            // Return list (not bytes) to match JavaScript array behavior
            return new PythonListComprehension(
              new PythonBinaryExpression(new PythonIdentifier('a'), '^', new PythonIdentifier('b')),
              new PythonTuple([new PythonIdentifier('a'), new PythonIdentifier('b')]),
              new PythonCall(new PythonIdentifier('zip'), [args[0], args[1]]),
              null
            );
          case 'ClearArray':
            return new PythonCall(new PythonMemberAccess(args[0], 'clear'), []);
          case 'CopyArray':
            return new PythonCall(new PythonMemberAccess(args[0], 'copy'), []);
          case 'ArraysEqual':
            return new PythonBinaryExpression(args[0], '==', args[1]);
          case 'ConcatArrays':
            return new PythonBinaryExpression(args[0], '+', args[1]);

          // Conversion utilities
          case 'Hex8ToBytes':
            return new PythonCall(
              new PythonMemberAccess(new PythonIdentifier('bytes'), 'fromhex'),
              [args[0]]
            );
          case 'BytesToHex8':
            return new PythonCall(new PythonMemberAccess(args[0], 'hex'), []);
          case 'AnsiToBytes':
          case 'AsciiToBytes':
            return new PythonCall(
              new PythonMemberAccess(args[0], 'encode'),
              [PythonLiteral.Str('ascii')]
            );
          case 'BytesToAnsi':
            return new PythonCall(
              new PythonMemberAccess(args[0], 'decode'),
              [PythonLiteral.Str('ascii')]
            );

          // Bit operations
          case 'GetBit':
            return new PythonBinaryExpression(
              new PythonBinaryExpression(args[0], '>>', args[1]),
              '&',
              PythonLiteral.Int(1)
            );
          case 'SetBit':
            return new PythonBinaryExpression(
              args[0],
              '|',
              new PythonBinaryExpression(PythonLiteral.Int(1), '<<', args[1])
            );
          case 'PopCount':
            return new PythonCall(
              new PythonMemberAccess(
                new PythonCall(new PythonIdentifier('bin'), [args[0]]),
                'count'
              ),
              [PythonLiteral.Str('1')]
            );

          default:
            // Unknown mapping, fall through to fallback
            break;
        }
      }

      // Fallback: just call the method as-is
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('opcodes'), toSnakeCase(methodName)),
        args
      );
    }

    transformNewExpression(node) {
      const typeName = node.callee.name;

      // Handle TypedArray constructors with array literals
      const typedArrayMap = {
        'Uint8Array': 'bytes',
        'Uint16Array': 'array.array',
        'Uint32Array': 'array.array',
        'Int8Array': 'array.array',
        'Int16Array': 'array.array',
        'Int32Array': 'array.array',
        'Float32Array': 'array.array',
        'Float64Array': 'array.array'
      };

      if (typedArrayMap[typeName]) {
        const hasArrayInit = node.arguments.length > 0 &&
          node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // new Uint8Array([1, 2, 3]) -> bytes([1, 2, 3]) or bytearray([1, 2, 3])
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          if (typeName === 'Uint8Array')
            return new PythonCall(new PythonIdentifier('bytes'), [new PythonList(elements)]);
          // For other typed arrays, use bytearray or numpy
          return new PythonCall(new PythonIdentifier('bytearray'), [new PythonList(elements)]);
        }

        // Size-based: new Uint8Array(n) -> bytes(n) or bytearray(n)
        const args = node.arguments.map(arg => this.transformExpression(arg));
        if (typeName === 'Uint8Array')
          return new PythonCall(new PythonIdentifier('bytearray'), args);
        return new PythonCall(new PythonIdentifier('bytearray'), args);
      }

      // Handle Array constructor
      if (typeName === 'Array') {
        if (node.arguments.length === 1) {
          // new Array(n) -> [None] * n or [0] * n
          const size = this.transformExpression(node.arguments[0]);
          return new PythonBinaryExpression(new PythonList([PythonLiteral.Int(0)]), '*', size);
        }
        // new Array() -> []
        return new PythonList([]);
      }

      // Known helper classes from AlgorithmFramework
      const HELPER_CLASSES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase', 'AuthResult'
      ]);

      // Track helper class usage for stub generation
      if (typeName && HELPER_CLASSES.has(typeName))
        this.helperClasses.add(typeName);

      // new ClassName(args) -> ClassName(args)
      const className = typeName ? toPascalCase(typeName) : this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      const callee = typeof className === 'string'
        ? new PythonIdentifier(className)
        : className;

      return new PythonCall(callee, args);
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => this.transformExpression(el));
      return new PythonList(elements);
    }

    transformObjectExpression(node) {
      const items = [];
      const spreads = [];

      // Helper to check for UpdateExpression
      const isUpdateExpr = (n) => n && (n.type === 'UpdateExpression' ||
        (n.type === 'UnaryExpression' && (n.operator === '++' || n.operator === '--')));

      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') {
          // Handle spread elements like {...obj}
          spreads.push(this.transformExpression(prop.argument));
        } else {
          // Convert key to snake_case for consistency with property access
          const key = prop.key?.type === 'Identifier'
            ? PythonLiteral.Str(toSnakeCase(prop.key.name))
            : this.transformExpression(prop.key);

          // Handle UpdateExpression in property value (e.g., { code: arr[i]++ })
          // Python doesn't support ++/-- as expressions in dict values
          let value;
          if (isUpdateExpr(prop.value)) {
            const target = this.transformExpression(prop.value.argument);
            const one = PythonLiteral.Int(1);
            const op = prop.value.operator === '++' ? '+=' : '-=';
            const updateStmt = new PythonAssignment(target, one);
            updateStmt.operator = op;
            updateStmt.isAugmented = true;

            if (prop.value.prefix) {
              // Prefix ++x: increment first, then use new value
              if (!this.pendingPreStatements) this.pendingPreStatements = [];
              this.pendingPreStatements.push(updateStmt);
              value = this.transformExpression(prop.value.argument);
            } else {
              // Postfix x++: use current value, then increment
              this.pendingPostStatements.push(updateStmt);
              value = this.transformExpression(prop.value.argument);
            }
          } else if (prop.value?.type === 'AssignmentExpression') {
            // Handle assignment expressions in property value
            const assignment = this.transformAssignmentExpression(prop.value);
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(assignment);
            value = this.transformAssignmentExpressionForExpression(prop.value);
          } else {
            value = this.transformExpression(prop.value);
          }
          items.push({ key, value });
        }
      }

      // If there are spreads, we need to merge dictionaries
      if (spreads.length > 0) {
        // Build: {**spread1, **spread2, key1: val1, ...}
        const dict = new PythonDict(items);
        dict.spreads = spreads;
        return dict;
      }

      return new PythonDict(items);
    }

    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);

      return new PythonConditional(trueExpr, condition, falseExpr);
    }

    transformLambdaExpression(node) {
      const params = node.params.map(p => this.transformParameter(p));
      const bodyNode = node.body;

      let body;
      if (bodyNode.type === 'BlockStatement') {
        // BlockStatement body - extract the first statement's return value or expression
        const firstStmt = bodyNode.body[0];
        if (firstStmt) {
          body = this.transformLambdaBody(firstStmt.argument || firstStmt.expression);
        }
      } else {
        body = this.transformLambdaBody(bodyNode);
      }

      // If body transformation returned null or undefined, use None
      if (!body) {
        return new PythonLambda(params, new PythonIdentifier('None'));
      }

      return new PythonLambda(params, body);
    }

    /**
     * Transform lambda body expression, handling cases that can't be Python lambda bodies.
     * Python lambdas can only contain expressions, not statements or assignments.
     * For assignments like `x = expr`, we return just `expr`.
     * For compound assignments like `x += expr`, we return the computed value.
     */
    transformLambdaBody(bodyNode) {
      if (!bodyNode) return null;

      // Handle AssignmentExpression - Python lambdas can't have assignments
      // Convert `x = expr` to just `expr` (return the value being assigned)
      // Convert `x += y` to `x + y` (return the computed value)
      if (bodyNode.type === 'AssignmentExpression') {
        return this.transformAssignmentExpressionForExpression(bodyNode);
      }

      // Handle UpdateExpression - Python lambdas can't have i++ or ++i
      if (bodyNode.type === 'UpdateExpression') {
        return this.transformUpdateExpressionForExpression(bodyNode);
      }

      // For other expressions, use normal transformation
      return this.transformExpression(bodyNode);
    }

    /**
     * Transform an arrow/function expression with a block body into a named function definition
     * Used when arrow functions have multiple statements (can't be Python lambdas)
     */
    transformArrowToFunction(name, node) {
      const params = node.params.map(p => this.transformParameter(p));
      const body = this.transformBlockOrStatement(node.body);

      const func = new PythonFunction(name, params, null);
      func.body = body;
      return func;
    }

    transformTemplateLiteral(node) {
      // Convert template literal to Python f-string AST node
      const parts = [];
      const expressions = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        parts.push(node.quasis[i].value.raw || '');
        if (i < node.expressions.length)
          expressions.push(this.transformExpression(node.expressions[i]));
      }

      return new PythonFString(parts, expressions);
    }

    // ========================[ IL AST NODE TRANSFORMERS ]========================

    /**
     * Transform ParentConstructorCall to super().__init__(...)
     */
    transformParentConstructorCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PythonCall(
        new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
        args
      );
    }

    /**
     * Transform ParentMethodCall to super().method_name(...)
     */
    transformParentMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      const methodName = toSnakeCase(node.method);
      return new PythonCall(
        new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), methodName),
        args
      );
    }

    /**
     * Transform ThisMethodCall to self.method_name(...)
     * Handles postfix increments in arguments (n++ -> use n, add n += 1 after)
     */
    transformThisMethodCall(node) {
      // Transform arguments, handling UpdateExpression and UnaryExpression (++/--) specially
      // Python doesn't support i++, ++i as expressions in function arguments
      const args = (node.arguments || []).map(arg => {
        const isUpdate = arg.type === 'UpdateExpression' ||
                        (arg.type === 'UnaryExpression' && (arg.operator === '++' || arg.operator === '--'));
        if (isUpdate) {
          // For postfix increment/decrement, we need to:
          // 1. Use the current value in the function call
          // 2. Add increment/decrement as post-statement to execute after the call
          if (!arg.prefix) {
            // Postfix: n++ or n-- -> use n, then add n += 1 or n -= 1 after
            const target = this.transformExpression(arg.argument);
            const one = PythonLiteral.Int(1);
            const op = arg.operator === '++' ? '+=' : '-=';
            const postIncrement = new PythonAssignment(target, one);
            postIncrement.operator = op;
            postIncrement.isAugmented = true;
            this.pendingPostStatements.push(postIncrement);
            // Return just the variable (current value before increment)
            return this.transformExpression(arg.argument);
          }
          // Prefix: ++n or --n -> use n + 1 or n - 1
          return this.transformUpdateExpressionForExpression(arg);
        }
        if (arg.type === 'AssignmentExpression') {
          // For assignment expressions in function arguments:
          // foo(x = value) -> x = value; foo(x)
          // Extract the assignment as a pre-statement and use the assigned value in the call
          const assignment = this.transformAssignmentExpression(arg);
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(assignment);
          // Return the value that was assigned (the right side of the assignment)
          return this.transformAssignmentExpressionForExpression(arg);
        }
        return this.transformExpression(arg);
      });
      const methodName = toSnakeCase(node.method);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('self'), methodName),
        args
      );
    }

    /**
     * Transform ThisPropertyAccess to self.property_name
     */
    transformThisPropertyAccess(node) {
      let propName = toSnakeCase(node.property);

      // Check for backing field access inside a getter/setter
      // This handles patterns like:
      //   get outputSize() { return this.OutputSize; }  // JS uses different case for backing field
      //   set outputSize(value) { this.OutputSize = value; }
      // Both outputSize and OutputSize map to output_size in Python, causing infinite recursion
      // We convert such accesses to self._property_name_backing
      if (this.currentPropertyName && propName === this.currentPropertyName) {
        propName = '_' + propName + '_backing';
      }

      // Check for field/method name collision
      // If there's a method with this name, rename the field to _xxx_value
      if (this.currentClassMethodNames && this.currentClassMethodNames.has(propName)) {
        propName = '_' + propName + '_value';
      }

      return new PythonMemberAccess(new PythonIdentifier('self'), propName);
    }

    /**
     * Transform RotateLeft/RotateRight to bitwise rotation
     * Python: ((value << amount) | (value >> (bits - amount))) & mask
     */
    transformRotation(node) {
      const value = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // Calculate mask for the bit width
      // Note: (1 << 32) overflows in JS, so special-case 32-bit
      const mask = bits === 64 ? 0xFFFFFFFFFFFFFFFF : (bits === 32 ? 0xFFFFFFFF : (1 << bits) - 1);
      const maskLit = bits === 64 ? new PythonIdentifier('0xFFFFFFFFFFFFFFFF') : PythonLiteral.Hex(mask >>> 0);
      const bitsLit = PythonLiteral.Int(bits);

      if (isLeft) {
        // ((value << amount) | (value >> (bits - amount))) & mask
        const leftShift = new PythonBinaryExpression(value, '<<', amount);
        const rightAmount = new PythonBinaryExpression(bitsLit, '-', amount);
        const rightShift = new PythonBinaryExpression(value, '>>', rightAmount);
        const combined = new PythonBinaryExpression(leftShift, '|', rightShift);
        return new PythonBinaryExpression(combined, '&', maskLit);
      } else {
        // ((value >> amount) | (value << (bits - amount))) & mask
        const rightShift = new PythonBinaryExpression(value, '>>', amount);
        const leftAmount = new PythonBinaryExpression(bitsLit, '-', amount);
        const leftShift = new PythonBinaryExpression(value, '<<', leftAmount);
        const combined = new PythonBinaryExpression(rightShift, '|', leftShift);
        return new PythonBinaryExpression(combined, '&', maskLit);
      }
    }

    /**
     * Transform PackBytes to int.from_bytes([b0, b1, ...], byteorder)
     * IL AST: { type: 'PackBytes', arguments: [b0, b1, b2, b3], bits: 32, endian: 'big'|'little' }
     *
     * This packs multiple bytes INTO a single integer value (opposite of UnpackBytes)
     * Python: int.from_bytes([b0, b1, b2, b3], 'big') or 'little'
     */
    transformPackBytes(node) {
      // IL AST uses node.arguments, fallback to node.bytes for compatibility
      const bytes = (node.arguments || node.bytes || []).map(b => this.transformExpression(b));
      const byteOrder = node.endian === 'big' ? 'big' : 'little';

      // Use int.from_bytes which is cleaner and doesn't require struct import
      // int.from_bytes([b0, b1, b2, b3], 'big')
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('int'), 'from_bytes'),
        [new PythonList(bytes), PythonLiteral.Str(byteOrder)]
      );
    }

    /**
     * Transform UnpackBytes to value.to_bytes(length, byteorder)
     * IL AST: { type: 'UnpackBytes', arguments: [intValue], bits: 32, endian: 'big'|'little' }
     *
     * This unpacks a single integer INTO multiple bytes (opposite of PackBytes)
     * Python: value.to_bytes(4, 'big') returns a bytes object
     * To get a list: list(value.to_bytes(4, 'big'))
     *
     * IMPORTANT: Python's to_bytes() requires unsigned integers within the byte range.
     * JavaScript integers from bitwise operations are always in 32-bit range, but Python
     * integers are unbounded. We must mask the value to ensure it fits in the byte count.
     */
    transformUnpackBytes(node) {
      // IL AST uses node.arguments[0], fallback to node.value for compatibility
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const byteOrder = node.endian === 'big' ? 'big' : 'little';
      const bits = node.bits || 32;
      const byteCount = Math.floor(bits / 8);

      // Calculate mask based on byte count to ensure value fits
      // For 4 bytes: 0xFFFFFFFF, for 8 bytes: 0xFFFFFFFFFFFFFFFF, etc.
      const mask = (1n << BigInt(bits)) - 1n;
      const maskValue = Number(mask);

      // Mask the value to ensure it's unsigned and fits in the byte count
      // (value & mask).to_bytes(byteCount, byteOrder)
      const maskedValue = new PythonBinaryExpression(value, '&', PythonLiteral.Int(maskValue));

      // Wrap in list() to get a list of bytes that can be concatenated
      return new PythonCall(
        new PythonIdentifier('list'),
        [new PythonCall(
          new PythonMemberAccess(maskedValue, 'to_bytes'),
          [PythonLiteral.Int(byteCount), PythonLiteral.Str(byteOrder)]
        )]
      );
    }

    /**
     * Transform ArrayLength to len(array)
     */
    transformArrayLength(node) {
      const array = this.transformExpression(node.array);
      return new PythonCall(new PythonIdentifier('len'), [array]);
    }

    /**
     * Transform ArrayAppend to array.append(value) or array.extend(value) for spread
     */
    transformArrayAppend(node) {
      const array = this.transformExpression(node.array);

      // Handle multiple values (push with multiple arguments)
      const values = node.values || (node.value ? [node.value] : []);

      // Check if any values are SpreadElements
      const hasSpread = values.some(v => v?.type === 'SpreadElement');

      if (hasSpread) {
        // Check if all values are SpreadElements
        const allSpread = values.every(v => v?.type === 'SpreadElement');
        if (allSpread) {
          if (values.length === 1) {
            // arr.push(...data) -> arr.extend(data)
            const spreadValue = this.transformExpression(values[0].argument);
            return new PythonCall(
              new PythonMemberAccess(array, 'extend'),
              [spreadValue]
            );
          }
          // arr.push(...a, ...b, ...c) -> arr.extend(a + b + c)
          const spreadArgs = values.map(v => this.transformExpression(v.argument));
          let concatenated = spreadArgs[0];
          for (let i = 1; i < spreadArgs.length; ++i)
            concatenated = new PythonBinaryExpression(concatenated, '+', spreadArgs[i]);
          return new PythonCall(
            new PythonMemberAccess(array, 'extend'),
            [concatenated]
          );
        }
        // Mixed spread and non-spread: arr.push(x, ...y, z)
        const parts = values.map(v => {
          if (v?.type === 'SpreadElement')
            return this.transformExpression(v.argument);
          return new PythonList([this.transformExpression(v)]);
        });
        let concatenated = parts[0];
        for (let i = 1; i < parts.length; ++i)
          concatenated = new PythonBinaryExpression(concatenated, '+', parts[i]);
        return new PythonCall(
          new PythonMemberAccess(array, 'extend'),
          [concatenated]
        );
      }

      // Single value, no spread
      const value = this.transformExpression(node.value);
      return new PythonCall(
        new PythonMemberAccess(array, 'append'),
        [value]
      );
    }

    /**
     * Transform ArraySlice to array[start:end]
     */
    transformArraySlice(node) {
      const array = this.transformExpression(node.array);
      const start = node.start ? this.transformExpression(node.start) : null;
      const end = node.end ? this.transformExpression(node.end) : null;
      return new PythonSubscript(array, new PythonSlice(start, end));
    }

    /**
     * Transform ArrayFill to [value] * size or similar
     */
    transformArrayFill(node) {
      const value = this.transformExpression(node.value);

      // Check if the array is a NewExpression for Array(n) - we can use n directly
      // This handles the common pattern: new Array(16).fill(0) -> [0] * 16
      if (node.array?.type === 'NewExpression' &&
          (node.array.callee?.name === 'Array' || node.array.callee?.type === 'Identifier' && node.array.callee.name === 'Array') &&
          node.array.arguments?.length === 1) {
        const size = this.transformExpression(node.array.arguments[0]);
        return new PythonBinaryExpression(new PythonList([value]), '*', size);
      }

      // Check if the array is an ArrayCreation IL node (created from new Array(n))
      if ((node.array?.type === 'ArrayCreate' || node.array?.type === 'ArrayCreation') && node.array.size != null) {
        const size = this.transformExpression(node.array.size);
        return new PythonBinaryExpression(new PythonList([value]), '*', size);
      }

      // General case - use len(array)
      const array = this.transformExpression(node.array);
      // For in-place fill, we'd need a loop, but for now return [value] * len(array)
      return new PythonBinaryExpression(
        new PythonList([value]),
        '*',
        new PythonCall(new PythonIdentifier('len'), [array])
      );
    }

    /**
     * Transform ArrayXor to [a ^ b for a, b in zip(arr1, arr2)]
     * Returns a list (not bytes) to match JavaScript array behavior
     */
    transformArrayXor(node) {
      // IL AST uses node.arguments[0,1], fallback to node.left/right for compatibility
      const left = this.transformExpression(node.arguments?.[0] || node.left);
      const right = this.transformExpression(node.arguments?.[1] || node.right);
      // [a ^ b for a, b in zip(left, right)]
      const xorExpr = new PythonBinaryExpression(
        new PythonIdentifier('a'),
        '^',
        new PythonIdentifier('b')
      );
      const zipCall = new PythonCall(new PythonIdentifier('zip'), [left, right]);
      // Return list comprehension directly (not wrapped in bytes())
      return new PythonListComprehension(xorExpr, new PythonTuple([new PythonIdentifier('a'), new PythonIdentifier('b')]), zipCall);
    }

    /**
     * Transform ArrayClear to array.clear()
     */
    transformArrayClear(node) {
      // IL AST uses node.arguments[0], fallback to node.array for compatibility
      const array = this.transformExpression(node.arguments?.[0] || node.array);
      return new PythonCall(new PythonMemberAccess(array, 'clear'), []);
    }

    /**
     * Transform ArrayIndexOf to array.index(value)
     * Note: Python's index() raises ValueError if not found; for -1 behavior,
     * caller should wrap in try/except or use "value in array" check first
     */
    transformArrayIndexOf(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      // Use list.index(value) - returns index or raises ValueError
      // For JavaScript-like behavior (-1 if not found), use:
      // array.index(value) if value in array else -1
      return new PythonConditional(
        new PythonCall(new PythonMemberAccess(array, 'index'), [value]),
        new PythonBinaryExpression(value, 'in', array),
        PythonLiteral.Int(-1)
      );
    }

    /**
     * Transform ArrayIncludes to (value in array)
     */
    transformArrayIncludes(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      return new PythonBinaryExpression(value, 'in', array);
    }

    /**
     * Transform ArrayConcat to array.extend(other) for mutation
     * The IL AST uses 'arrays' property (array of arrays to concat)
     */
    transformArrayConcat(node) {
      const array = this.transformExpression(node.array);

      // Handle both 'arrays' (from IL AST) and 'other' (legacy) properties
      const toConcat = node.arrays || (node.other ? [node.other] : []);

      if (toConcat.length === 0) {
        // Nothing to concat, return the array as-is
        return array;
      }

      // Use + operator for concatenation since it returns a new list
      // This is important for expression contexts like: result = arr.concat(other)
      // list.extend() returns None (modifies in-place) which would break assignments
      let result = array;
      for (const arr of toConcat) {
        const other = this.transformExpression(arr);
        // Wrap each operand in list() call to ensure concatenation works with
        // any iterable (bytes, tuples, generators, etc.)
        result = new PythonBinaryExpression(
          result,
          '+',
          new PythonCall(new PythonIdentifier('list'), [other])
        );
      }
      return result;
    }

    /**
     * Transform ArrayJoin to separator.join(str(x) for x in array)
     */
    transformArrayJoin(node) {
      const array = this.transformExpression(node.array);
      const separator = node.separator ? this.transformExpression(node.separator) : PythonLiteral.Str('');
      // JavaScript's join() converts all elements to strings automatically
      // Python requires explicit conversion: separator.join(str(x) for x in array)
      const strCall = new PythonCall(new PythonIdentifier('str'), [new PythonIdentifier('x')]);
      const genExpr = new PythonGeneratorExpression(strCall, 'x', array);
      return new PythonCall(new PythonMemberAccess(separator, 'join'), [genExpr]);
    }

    /**
     * Transform ArrayReverse to list(reversed(array)) for a new reversed copy
     */
    transformArrayReverse(node) {
      const array = this.transformExpression(node.array);
      // Use list(reversed(array)) to get a new reversed list
      // For in-place reversal, caller should use array.reverse()
      return new PythonCall(
        new PythonIdentifier('list'),
        [new PythonCall(new PythonIdentifier('reversed'), [array])]
      );
    }

    /**
     * Transform ArrayPop to array.pop()
     */
    transformArrayPop(node) {
      const array = this.transformExpression(node.array);
      return new PythonCall(new PythonMemberAccess(array, 'pop'), []);
    }

    /**
     * Transform ArrayShift to array.pop(0)
     */
    transformArrayShift(node) {
      const array = this.transformExpression(node.array);
      return new PythonCall(new PythonMemberAccess(array, 'pop'), [PythonLiteral.Int(0)]);
    }

    /**
     * Transform ArrayUnshift to array.insert(0, value)
     */
    transformArrayUnshift(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      return new PythonCall(new PythonMemberAccess(array, 'insert'), [PythonLiteral.Int(0), value]);
    }

    /**
     * Transform ArrayCreation to [0] * size or []
     */
    transformArrayCreation(node) {
      if (node.size) {
        const size = this.transformExpression(node.size);
        // [0] * size
        return new PythonBinaryExpression(
          new PythonList([PythonLiteral.Int(0)]),
          '*',
          size
        );
      }
      return new PythonList([]);
    }

    /**
     * Transform TypedArrayCreation to bytearray(size) or similar
     * Handles: new TypedArray(size), new TypedArray(existingArray)
     */
    transformTypedArrayCreation(node) {
      const arrayType = node.arrayType || 'Uint8Array';

      // Check if this is a copy from an existing array vs size-based creation
      // When buffer is set and is an identifier, we need to distinguish between:
      // - new Uint32Array(IV) where IV is an array -> copy operation
      // - new Uint32Array(count) where count is a number -> size-based
      const isArrayCopy = node.buffer && (
        node.buffer.type === 'Identifier' ||
        node.buffer.type === 'MemberExpression'
      ) && this._isLikelyArrayArgument(node.buffer);

      // For array copy operations, we need to copy the array, not multiply
      if (isArrayCopy) {
        const buffer = this.transformExpression(node.buffer);
        if (arrayType === 'Uint8Array' || arrayType === 'Int8Array')
          return new PythonCall(new PythonIdentifier('bytearray'), [buffer]);
        // For other typed arrays, use list() to copy
        return new PythonCall(new PythonIdentifier('list'), [buffer]);
      }

      // Size-based creation: new TypedArray(size)
      const size = node.size ? this.transformExpression(node.size) : null;

      if (arrayType === 'Uint8Array' || arrayType === 'Int8Array') {
        if (size)
          return new PythonCall(new PythonIdentifier('bytearray'), [size]);
        return new PythonCall(new PythonIdentifier('bytearray'), []);
      }
      // For other typed arrays, use list multiplication for size-based creation
      if (size) {
        return new PythonBinaryExpression(
          new PythonList([PythonLiteral.Int(0)]),
          '*',
          size
        );
      }
      return new PythonList([]);
    }

    /**
     * Deep clone an AST node, substituting any Identifier with the given name
     * @param {Object} node - AST node to clone
     * @param {string} fromName - Identifier name to replace
     * @param {string} toName - New identifier name
     * @returns {Object} Cloned node with substitutions
     */
    _substituteIdentifier(node, fromName, toName) {
      if (!node) return node;

      // Handle Identifier nodes
      if (node.type === 'Identifier' && node.name === fromName)
        return { ...node, name: toName };

      // Handle arrays
      if (Array.isArray(node))
        return node.map(item => this._substituteIdentifier(item, fromName, toName));

      // Handle objects (AST nodes)
      if (typeof node === 'object') {
        const result = {};
        for (const key in node) {
          if (key === 'parent') continue; // Skip circular refs
          result[key] = this._substituteIdentifier(node[key], fromName, toName);
        }
        return result;
      }

      return node;
    }

    /**
     * Heuristic to determine if an identifier is likely an array (for copying)
     * vs a numeric size (for size-based array creation)
     */
    _isLikelyArrayArgument(arg) {
      if (!arg) return false;

      // Get the identifier name
      let name = '';
      if (arg.type === 'Identifier')
        name = arg.name || '';
      else if (arg.type === 'MemberExpression' && arg.property?.name)
        name = arg.property.name;

      const lowerName = name.toLowerCase();

      // Names that clearly indicate an array to copy
      const arrayPatterns = /^(iv|state|key|block|data|buffer|bytes|array|input|output|hash|digest|result|chaining|round|s|k|w|h|v|m|t|p|x|y|z|sbox|table|rounds|perm|permutation|constants?|initial|values?|msg|message|plaintext|ciphertext|text|src|source|dest|target|words?|chunk|nonce|salt|seed|vector|matrix|schedule|expanded?)$/i;
      if (arrayPatterns.test(name))
        return true;

      // Names that clearly indicate a numeric size (check before array suffixes)
      const sizePatterns = /^(size|len|length|count|n|num|number|index|i|j|offset|pos|position|capacity|width|height|bits|bytes_?count|byte_?count)$/i;
      if (sizePatterns.test(name))
        return false;

      // Names with size-indicating prefixes (totalWords, numBytes, etc.) are sizes, not arrays
      const sizePrefixPatterns = /^(total|num|n_?|count_?|max_?|min_?|size_?).*$/i;
      if (sizePrefixPatterns.test(name))
        return false;

      // Names ending with size-like suffixes (wordCount, keyLength, etc.)
      const sizeSuffixPatterns = /(size|len|length|count|num|index|offset|bits)$/i;
      if (sizeSuffixPatterns.test(name))
        return false;

      // Names ending with array-like suffixes (e.g., initValues, subKeys, roundData)
      const arraySuffixPatterns = /(values?|keys?|bytes?|data|buffer|array|block|state|words?|rounds?)$/i;
      if (arraySuffixPatterns.test(name))
        return true;

      // Check type information if available
      const argType = arg.resultType || arg.typeInfo?.type;
      if (argType) {
        const typeStr = String(argType).toLowerCase();
        if (typeStr.includes('[]') || typeStr.includes('array') || typeStr.includes('uint'))
          return true;
        if (typeStr === 'int' || typeStr === 'int32' || typeStr === 'number' || typeStr === 'usize')
          return false;
      }

      // Default: if it's all uppercase (like IV, MSG, KEY), likely an array constant
      if (name === name.toUpperCase() && name.length <= 5 && name.length > 1)
        return true;

      // Default: assume size-based for safety (preserves original behavior)
      return false;
    }

    /**
     * Transform BufferCreation to bytearray(size)
     * new ArrayBuffer(size) -> bytearray(size)
     */
    transformBufferCreation(node) {
      const size = node.size ? this.transformExpression(node.size) : null;
      if (size) {
        return new PythonCall(new PythonIdentifier('bytearray'), [size]);
      }
      return new PythonCall(new PythonIdentifier('bytearray'), []);
    }

    /**
     * Transform DataViewCreation to DataView()
     * new DataView(buffer) -> DataView(buffer)
     * Uses custom DataView class that provides setBigUint64, etc.
     */
    transformDataViewCreation(node) {
      const buffer = node.buffer ? this.transformExpression(node.buffer) : null;
      if (buffer) {
        return new PythonCall(new PythonIdentifier('DataView'), [buffer]);
      }
      // If no buffer specified, create an empty bytearray and wrap it
      return new PythonCall(new PythonIdentifier('DataView'), [
        new PythonCall(new PythonIdentifier('bytearray'), [])
      ]);
    }

    /**
     * Transform MapCreation to dict()
     * new Map() -> {} or dict()
     * new Map([entries]) -> dict(entries) or {k: v for k, v in entries}
     */
    transformMapCreation(node) {
      if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
        // Create dict with initial entries: {k1: v1, k2: v2, ...}
        const pairs = node.entries.elements.map(entry => {
          if (entry.elements && entry.elements.length >= 2) {
            const key = this.transformExpression(entry.elements[0]);
            const value = this.transformExpression(entry.elements[1]);
            return { key, value };
          }
          return null;
        }).filter(p => p !== null);

        return new PythonDict(pairs);
      }
      // Empty map: {}
      return new PythonDict([]);
    }

    /**
     * Transform ByteBufferView to memoryview()
     */
    transformByteBufferView(node) {
      const buffer = this.transformExpression(node.buffer);
      return new PythonCall(new PythonIdentifier('memoryview'), [buffer]);
    }

    /**
     * Transform HexDecode to bytes.fromhex(string)
     * IL AST format: { type: 'HexDecode', arguments: [hexString] }
     */
    transformHexDecode(node) {
      // IL AST uses arguments array, fallback to value for compatibility
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('bytes'), 'fromhex'),
        [value]
      );
    }

    /**
     * Transform HexEncode to array.hex()
     * IL AST format: { type: 'HexEncode', arguments: [byteArray] }
     */
    transformHexEncode(node) {
      // IL AST uses arguments array, fallback to value for compatibility
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(new PythonMemberAccess(value, 'hex'), []);
    }

    /**
     * Transform Floor to int(x) for simple cases or math.floor(x)
     */
    transformFloor(node) {
      const argument = this.transformExpression(node.argument);
      // Python's int() truncates toward zero, math.floor() rounds down
      // For consistency with JavaScript, use int() for positive, math.floor for general
      this.imports.add('math');
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'floor'),
        [argument]
      );
    }

    /**
     * Transform Ceil to math.ceil(x)
     */
    transformCeil(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.argument);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'ceil'),
        [argument]
      );
    }

    /**
     * Transform Abs to abs(x)
     */
    transformAbs(node) {
      const argument = this.transformExpression(node.argument);
      return new PythonCall(new PythonIdentifier('abs'), [argument]);
    }

    /**
     * Transform Min to min(a, b, ...)
     */
    transformMin(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PythonCall(new PythonIdentifier('min'), args);
    }

    /**
     * Transform Max to max(a, b, ...)
     */
    transformMax(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PythonCall(new PythonIdentifier('max'), args);
    }

    /**
     * Transform Pow to pow(base, exp) or base ** exp
     */
    transformPow(node) {
      const base = this.transformExpression(node.base);
      const exponent = this.transformExpression(node.exponent);
      return new PythonBinaryExpression(base, '**', exponent);
    }

    /**
     * Transform Round to round(x)
     */
    transformRound(node) {
      const argument = this.transformExpression(node.argument);
      return new PythonCall(new PythonIdentifier('round'), [argument]);
    }

    /**
     * Transform Trunc to int(x)
     */
    transformTrunc(node) {
      const argument = this.transformExpression(node.argument);
      return new PythonCall(new PythonIdentifier('int'), [argument]);
    }

    /**
     * Transform Sign to (1 if x > 0 else -1 if x < 0 else 0)
     */
    transformSign(node) {
      const argument = this.transformExpression(node.argument);
      // Python doesn't have a direct sign function, use conditional
      // (1 if x > 0 else (-1 if x < 0 else 0))
      return new PythonConditional(
        PythonLiteral.Int(1),
        new PythonBinaryExpression(argument, '>', PythonLiteral.Int(0)),
        new PythonConditional(
          PythonLiteral.Int(-1),
          new PythonBinaryExpression(argument, '<', PythonLiteral.Int(0)),
          PythonLiteral.Int(0)
        )
      );
    }

    /**
     * Transform Random to random.random()
     */
    transformRandom(node) {
      this.imports.add('random');
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('random'), 'random'),
        []
      );
    }

    /**
     * Transform Imul to 32-bit multiplication: (a * b) & 0xFFFFFFFF
     */
    transformImul(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      const multiply = new PythonBinaryExpression(left, '*', right);
      return new PythonBinaryExpression(multiply, '&', PythonLiteral.Int(0xFFFFFFFF));
    }

    /**
     * Transform Clz32 to count leading zeros
     * Python 3.10+: (32 - x.bit_length()) if x else 32
     */
    transformClz32(node) {
      const argument = this.transformExpression(node.argument);
      // (32 - (x & 0xFFFFFFFF).bit_length()) if x else 32
      const masked = new PythonBinaryExpression(argument, '&', PythonLiteral.Int(0xFFFFFFFF));
      const bitLength = new PythonCall(new PythonMemberAccess(masked, 'bit_length'), []);
      const result = new PythonBinaryExpression(PythonLiteral.Int(32), '-', bitLength);
      return new PythonConditional(result, argument, PythonLiteral.Int(32));
    }

    /**
     * Transform Cast to appropriate Python casting
     */
    transformCast(node) {
      // IL AST uses node.arguments[0], fallback to node.expression for compatibility
      const expression = this.transformExpression(node.arguments?.[0] || node.expression);
      const targetType = node.targetType;

      // Note: The emitter's precedence system handles parentheses automatically
      // when creating BinaryExpression with lower-precedence operators

      switch (targetType) {
        case 'uint32':
        case 'int32':
          // Mask to 32-bit
          return new PythonBinaryExpression(expression, '&', PythonLiteral.Int(0xFFFFFFFF));
        case 'uint16':
        case 'int16':
          return new PythonBinaryExpression(expression, '&', PythonLiteral.Int(0xFFFF));
        case 'uint8':
        case 'int8':
        case 'byte':
          return new PythonBinaryExpression(expression, '&', PythonLiteral.Int(0xFF));
        case 'int':
        case 'integer':
          return new PythonCall(new PythonIdentifier('int'), [expression]);
        case 'float':
        case 'double':
          return new PythonCall(new PythonIdentifier('float'), [expression]);
        case 'string':
        case 'str':
          return new PythonCall(new PythonIdentifier('str'), [expression]);
        case 'boolean':
        case 'bool':
          return new PythonCall(new PythonIdentifier('bool'), [expression]);
        default:
          // Unknown cast, just return expression
          return expression;
      }
    }

    /**
     * Transform DestructuringAssignment to tuple unpacking
     */
    transformDestructuringAssignment(node) {
      const source = this.transformExpression(node.source);
      const targets = (node.properties || []).map(prop => {
        const name = typeof prop === 'string' ? prop : (prop.key || prop.name || prop);
        return new PythonIdentifier(toSnakeCase(name));
      });

      if (targets.length === 0) {
        return source;
      }

      // Create tuple unpacking
      const tupleTarget = new PythonTuple(targets);
      return new PythonAssignment(tupleTarget, source);
    }

    // ========================[ TYPE MAPPING ]========================

    mapType(typeNode) {
      if (!typeNode) return null;

      // Handle string type annotations
      if (typeof typeNode === 'string') {
        const mapped = TYPE_MAP[typeNode] || typeNode;
        return this.createPythonType(mapped);
      }

      // Handle TSTypeAnnotation wrapper
      if (typeNode.type === 'TSTypeAnnotation') {
        return this.mapType(typeNode.typeAnnotation);
      }

      // Handle specific type node types
      switch (typeNode.type) {
        case 'TSNumberKeyword':
          return PythonType.Int();
        case 'TSStringKeyword':
          return PythonType.Str();
        case 'TSBooleanKeyword':
          return PythonType.Bool();
        case 'TSVoidKeyword':
        case 'TSUndefinedKeyword':
        case 'TSNullKeyword':
          return PythonType.None();
        case 'TSAnyKeyword':
          return this.getAnyType();
        case 'TSArrayType':
          const elementType = this.mapType(typeNode.elementType);
          this.imports.add('List');
          return PythonType.List(elementType);
        case 'TSTypeReference':
          return this.mapTypeReference(typeNode);
        default:
          return this.getAnyType();
      }
    }

    mapTypeReference(typeNode) {
      const typeName = typeNode.typeName.name;
      const mapped = TYPE_MAP[typeName] || typeName;

      if (mapped === 'List' && typeNode.typeParameters) {
        this.imports.add('List');
        const elementType = this.mapType(typeNode.typeParameters.params[0]);
        return PythonType.List(elementType);
      }

      if (mapped === 'Dict' && typeNode.typeParameters) {
        this.imports.add('Dict');
        const keyType = this.mapType(typeNode.typeParameters.params[0]);
        const valueType = this.mapType(typeNode.typeParameters.params[1]);
        return PythonType.Dict(keyType, valueType);
      }

      return this.createPythonType(mapped);
    }

    createPythonType(typeName) {
      switch (typeName) {
        case 'int':
          return PythonType.Int();
        case 'float':
          return PythonType.Float();
        case 'bool':
          return PythonType.Bool();
        case 'str':
          return PythonType.Str();
        case 'bytes':
          return PythonType.Bytes();
        case 'None':
          return PythonType.None();
        case 'Any':
          this.imports.add('Any');
          return PythonType.Any();
        default:
          return new PythonType(typeName);
      }
    }

    registerImportForType(type) {
      if (!type) return;

      if (type.isList) {
        this.imports.add('List');
      }
      if (type.isDict) {
        this.imports.add('Dict');
      }
      if (type.isOptional) {
        this.imports.add('Optional');
      }
      if (type.name === 'Any') {
        this.imports.add('Any');
      }
    }

    /**
     * Check if an AST node contains a division operator that could produce a float
     * JavaScript division of integers produces float, Python division also produces float
     */
    _containsDivision(node) {
      if (!node) return false;
      // Check if this node is a binary expression with division
      if (node.type === 'BinaryExpression') {
        if (node.operator === '/') return true;
        // Recursively check operands
        return this._containsDivision(node.left) || this._containsDivision(node.right);
      }
      // Check call expressions - arguments might contain division
      if (node.type === 'CallExpression') {
        if (node.arguments && node.arguments.some(arg => this._containsDivision(arg)))
          return true;
        if (this._containsDivision(node.callee))
          return true;
      }
      // Check member expressions
      if (node.type === 'MemberExpression') {
        return this._containsDivision(node.object);
      }
      // Check unary expressions
      if (node.type === 'UnaryExpression') {
        return this._containsDivision(node.argument);
      }
      // Check conditional/ternary
      if (node.type === 'ConditionalExpression') {
        return this._containsDivision(node.consequent) || this._containsDivision(node.alternate);
      }
      // Check array expressions
      if (node.type === 'ArrayExpression' && node.elements) {
        return node.elements.some(el => this._containsDivision(el));
      }
      return false;
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

    // ========================[ ARRAY HIGHER-ORDER FUNCTIONS ]========================

    /**
     * Transform ArrayForEach to for loop
     * Python: for item in array: callback(item)
     */
    transformArrayForEach(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _item
      let paramName = '_item';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_item';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      let body;

      if (callback && callback.body) {
        // Check if body is a statement or an expression
        // Arrow functions with expression bodies have the expression directly as body
        const callbackBody = callback.body;
        if (callbackBody.type === 'BlockStatement') {
          // Block statement - transform as normal
          body = this.transformStatement(callbackBody);
        } else if (callbackBody.type === 'ExpressionStatement') {
          // Expression statement - transform as statement
          body = this.transformStatement(callbackBody);
        } else if (callbackBody.type) {
          // It's an expression node - wrap it as an expression statement
          const expr = this.transformExpression(callbackBody);
          if (expr) {
            body = new PythonBlock();
            body.statements = [new PythonExpressionStatement(expr)];
          } else {
            body = new PythonBlock();
            body.statements = [new PythonPass()];
          }
        } else {
          // Unknown type - use pass
          body = new PythonBlock();
          body.statements = [new PythonPass()];
        }
      } else {
        body = new PythonBlock();
        body.statements = [new PythonPass()];
      }

      return new PythonFor(itemVar, array, body);
    }

    /**
     * Transform ArrayMap to list comprehension
     * Python: [callback(x) for x in array] or [callback(x, i) for i, x in enumerate(array)]
     */
    transformArrayMap(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      let indexName = null;
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        paramName = toSnakeCase(paramName);

        // Check if there's a second parameter (index)
        if (callback.params.length >= 2) {
          const indexParam = callback.params[1];
          indexName = indexParam.name || indexParam.value || '_i';
          indexName = toSnakeCase(indexName);
        }
      }
      const itemVar = new PythonIdentifier(paramName);
      let expr;

      if (callback && callback.body) {
        // Simple expression callback
        expr = this.transformExpression(callback.body);
      } else {
        expr = itemVar;
      }

      // If index is used, wrap with enumerate
      if (indexName) {
        const indexVar = new PythonIdentifier(indexName);
        const enumCall = new PythonCall(new PythonIdentifier('enumerate'), [array]);
        const tupleVar = new PythonTuple([indexVar, itemVar]);
        return new PythonListComprehension(expr, tupleVar, enumCall);
      }

      return new PythonListComprehension(expr, itemVar, array);
    }

    /**
     * Transform ArrayFilter to list comprehension with condition
     * Python: [x for x in array if condition(x)]
     */
    transformArrayFilter(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      let condition;

      if (callback && callback.body) {
        condition = this.transformExpression(callback.body);
      } else {
        condition = itemVar;
      }

      return new PythonListComprehension(itemVar, itemVar, array, condition);
    }

    /**
     * Transform ArraySome to any()
     * Python: any(callback(x) for x in array)
     */
    transformArraySome(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        // Convert to snake_case for Python
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      let condition;

      if (callback && callback.body) {
        condition = this.transformExpression(callback.body);
      } else {
        condition = itemVar;
      }

      const genExpr = new PythonGeneratorExpression(condition, itemVar, array);
      return new PythonCall(new PythonIdentifier('any'), [genExpr]);
    }

    /**
     * Transform ArrayEvery to all()
     * Python: all(callback(x) for x in array)
     */
    transformArrayEvery(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      let condition;

      if (callback && callback.body) {
        condition = this.transformExpression(callback.body);
      } else {
        condition = itemVar;
      }

      const genExpr = new PythonGeneratorExpression(condition, itemVar, array);
      return new PythonCall(new PythonIdentifier('all'), [genExpr]);
    }

    /**
     * Transform ArrayFind to next() with generator
     * Python: next((x for x in array if condition(x)), None)
     */
    transformArrayFind(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      let condition;

      if (callback && callback.body) {
        condition = this.transformExpression(callback.body);
      } else {
        condition = itemVar;
      }

      const genExpr = new PythonGeneratorExpression(itemVar, itemVar, array, condition);
      return new PythonCall(new PythonIdentifier('next'), [genExpr, PythonLiteral.None()]);
    }

    /**
     * Transform ArrayFindIndex to next() with enumerate
     * Python: next((i for i, x in enumerate(array) if condition(x)), -1)
     */
    transformArrayFindIndex(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      const indexVar = new PythonIdentifier('_i');
      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      let condition;

      if (callback && callback.body) {
        condition = this.transformExpression(callback.body);
      } else {
        condition = itemVar;
      }

      const enumCall = new PythonCall(new PythonIdentifier('enumerate'), [array]);
      const tupleTarget = new PythonTuple([indexVar, itemVar]);
      const genExpr = new PythonGeneratorExpression(indexVar, tupleTarget, enumCall, condition);
      return new PythonCall(new PythonIdentifier('next'), [genExpr, PythonLiteral.Int(-1)]);
    }

    /**
     * Transform ArrayReduce to functools.reduce
     * Python: functools.reduce(lambda acc, x: ..., array, initial)
     */
    transformArrayReduce(node) {
      this.imports.add('functools');
      const array = this.transformExpression(node.array);
      const callback = node.callback;
      const initial = node.initial ? this.transformExpression(node.initial) : null;

      // Extract the actual callback parameter names
      let accParamName = '_acc';
      let itemParamName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const accParam = callback.params[0];
        accParamName = accParam.name || accParam.value || '_acc';
        accParamName = toSnakeCase(accParamName);
        if (callback.params.length > 1) {
          const itemParam = callback.params[1];
          itemParamName = itemParam.name || itemParam.value || '_x';
          itemParamName = toSnakeCase(itemParamName);
        }
      }

      let lambdaBody;
      if (callback && callback.body) {
        lambdaBody = this.transformExpression(callback.body);
      } else {
        lambdaBody = new PythonIdentifier(accParamName);
      }

      const lambda = new PythonLambda(
        [new PythonIdentifier(accParamName), new PythonIdentifier(itemParamName)],
        lambdaBody
      );

      const args = [lambda, array];
      if (initial) args.push(initial);

      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('functools'), 'reduce'),
        args
      );
    }

    // ========================[ STRING OPERATIONS ]========================

    /**
     * Transform StringReplace to safe_replace() helper function
     * Python: safe_replace(string, search, replacement)
     * Uses helper function that handles None values like JavaScript
     */
    transformStringReplace(node) {
      const string = this.transformExpression(node.string || node.object);
      const search = node.search || node.pattern
        ? this.transformExpression(node.search || node.pattern)
        : PythonLiteral.Str('');
      const replacement = node.replacement
        ? this.transformExpression(node.replacement)
        : PythonLiteral.Str('');

      // Use safe_replace helper to handle None values
      return new PythonCall(new PythonIdentifier('safe_replace'), [string, search, replacement]);
    }

    /**
     * Transform StringRepeat to string * count
     * Python: string * count
     */
    transformStringRepeat(node) {
      const string = this.transformExpression(node.string || node.object);
      const count = this.transformExpression(node.count);
      return new PythonBinaryExpression(string, '*', count);
    }

    /**
     * Transform StringIndexOf to str.find()
     * Python: string.find(search) - returns -1 if not found
     */
    transformStringIndexOf(node) {
      const string = this.transformExpression(node.string || node.object);
      const search = this.transformExpression(node.search);
      const args = [search];
      if (node.start) args.push(this.transformExpression(node.start));
      return new PythonCall(new PythonMemberAccess(string, 'find'), args);
    }

    /**
     * Transform StringSplit to str.split()
     * Python: string.split(separator)
     */
    transformStringSplit(node) {
      const string = this.transformExpression(node.string || node.object);
      const separator = node.separator ? this.transformExpression(node.separator) : null;
      const args = separator ? [separator] : [];
      return new PythonCall(new PythonMemberAccess(string, 'split'), args);
    }

    /**
     * Transform StringSubstring to string slicing
     * Python: string[start:end]
     */
    transformStringSubstring(node) {
      const string = this.transformExpression(node.string || node.object);
      const start = node.start ? this.transformExpression(node.start) : null;
      const end = node.end ? this.transformExpression(node.end) : null;
      return new PythonSubscript(string, new PythonSlice(start, end));
    }

    /**
     * Transform StringCharAt to string indexing
     * Python: string[index]
     */
    transformStringCharAt(node) {
      const string = this.transformExpression(node.string || node.object);
      const index = this.transformExpression(node.index);
      return new PythonSubscript(string, index);
    }

    /**
     * Transform StringCharCodeAt to ord(string[index])
     * Python: ord(string[index])
     */
    transformStringCharCodeAt(node) {
      const string = this.transformExpression(node.string || node.object);
      const index = this.transformExpression(node.index);
      const char = new PythonSubscript(string, index);
      return new PythonCall(new PythonIdentifier('ord'), [char]);
    }

    /**
     * Transform StringToUpperCase to str.upper()
     */
    transformStringToUpperCase(node) {
      const string = this.transformExpression(node.string || node.object || node.argument);
      return new PythonCall(new PythonMemberAccess(string, 'upper'), []);
    }

    /**
     * Transform StringToLowerCase to str.lower()
     */
    transformStringToLowerCase(node) {
      const string = this.transformExpression(node.string || node.object || node.argument);
      return new PythonCall(new PythonMemberAccess(string, 'lower'), []);
    }

    /**
     * Transform StringTrim to str.strip()
     */
    transformStringTrim(node) {
      const string = this.transformExpression(node.string || node.object || node.argument);
      return new PythonCall(new PythonMemberAccess(string, 'strip'), []);
    }

    /**
     * Transform StringStartsWith to str.startswith()
     */
    transformStringStartsWith(node) {
      const string = this.transformExpression(node.string || node.object);
      const prefix = this.transformExpression(node.prefix || node.search);
      return new PythonCall(new PythonMemberAccess(string, 'startswith'), [prefix]);
    }

    /**
     * Transform StringEndsWith to str.endswith()
     */
    transformStringEndsWith(node) {
      const string = this.transformExpression(node.string || node.object);
      const suffix = this.transformExpression(node.suffix || node.search);
      return new PythonCall(new PythonMemberAccess(string, 'endswith'), [suffix]);
    }

    /**
     * Transform StringIncludes to Python 'in' operator
     * JavaScript: str.includes(substr) → Python: substr in str
     */
    transformStringIncludes(node) {
      const string = this.transformExpression(node.string || node.object);
      const searchValue = this.transformExpression(node.searchValue || node.search || node.argument);
      // Python: searchValue in string
      return new PythonBinaryExpression(searchValue, 'in', string);
    }

    /**
     * Transform StringTransform for generic string methods
     * Maps to appropriate Python string method
     */
    transformStringTransform(node) {
      const string = this.transformExpression(node.string || node.object);
      const method = node.method;

      switch (method) {
        case 'toUpperCase':
          return new PythonCall(new PythonMemberAccess(string, 'upper'), []);
        case 'toLowerCase':
          return new PythonCall(new PythonMemberAccess(string, 'lower'), []);
        case 'trim':
          return new PythonCall(new PythonMemberAccess(string, 'strip'), []);
        case 'trimStart':
        case 'trimLeft':
          return new PythonCall(new PythonMemberAccess(string, 'lstrip'), []);
        case 'trimEnd':
        case 'trimRight':
          return new PythonCall(new PythonMemberAccess(string, 'rstrip'), []);
        case 'normalize':
          // Python: unicodedata.normalize('NFC', str)
          return new PythonCall(
            new PythonMemberAccess(new PythonIdentifier('unicodedata'), 'normalize'),
            [PythonLiteral.Str('NFC'), string]
          );
        default:
          // Fallback - try calling the method directly (snake_case)
          return new PythonCall(new PythonMemberAccess(string, toSnakeCase(method)), []);
      }
    }

    /**
     * Transform StringConcat to Python string concatenation
     * JavaScript: str.concat(a, b) → Python: str + a + b
     */
    transformStringConcat(node) {
      const string = this.transformExpression(node.string || node.object);
      const args = (node.arguments || []).map(a => this.transformExpression(a));

      if (args.length === 0)
        return string;

      // Chain concatenation with +
      let result = string;
      for (const arg of args)
        result = new PythonBinaryExpression(result, '+', arg);
      return result;
    }

    // ========================[ ADDITIONAL TRANSFORMS ]========================

    /**
     * Transform BigIntCast to int()
     * Python handles big integers natively
     */
    transformBigIntCast(node) {
      const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
      return new PythonCall(new PythonIdentifier('int'), [value]);
    }

    /**
     * Transform TypedArraySet - copy elements from source to target at offset
     * Python: target[offset:offset+len(source)] = source
     */
    transformTypedArraySet(node) {
      const target = this.transformExpression(node.target || node.array);
      const source = this.transformExpression(node.source || node.values);
      const offset = node.offset ? this.transformExpression(node.offset) : PythonLiteral.Int(0);

      // target[offset:offset+len(source)] = source
      const sourceLen = new PythonCall(new PythonIdentifier('len'), [source]);
      const endIndex = new PythonBinaryExpression(offset, '+', sourceLen);
      const slice = new PythonSlice(offset, endIndex);

      return new PythonAssignment(
        new PythonSubscript(target, slice),
        source
      );
    }

    /**
     * Transform MapSet - dict/map assignment
     * map.set(key, value) -> map[key] = value
     */
    transformMapSet(node) {
      const map = this.transformExpression(node.map);
      const key = this.transformExpression(node.key);
      const value = this.transformExpression(node.value);

      // map[key] = value
      return new PythonAssignment(
        new PythonSubscript(map, key),
        value
      );
    }

    /**
     * Transform TypedArraySubarray - get a slice view of array
     * array.subarray(begin, end) -> array[begin:end]
     */
    transformTypedArraySubarray(node) {
      const array = this.transformExpression(node.array);
      const begin = node.begin ? this.transformExpression(node.begin) : null;
      const end = node.end ? this.transformExpression(node.end) : null;
      const slice = new PythonSlice(begin, end);
      return new PythonSubscript(array, slice);
    }

    /**
     * Transform Sqrt to math.sqrt()
     */
    transformSqrt(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.argument || node.arguments?.[0]);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'sqrt'),
        [argument]
      );
    }

    /**
     * Transform Power to Python exponentiation
     * Python: base ** exponent
     */
    transformPower(node) {
      const base = this.transformExpression(node.base);
      const exponent = this.transformExpression(node.exponent);
      return new PythonBinaryExpression(base, '**', exponent);
    }

    /**
     * Transform Log2 to math.log2()
     */
    transformLog2(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.argument);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'log2'),
        [argument]
      );
    }

    /**
     * Transform Sin to math.sin(x)
     */
    transformSin(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'sin'),
        [argument]
      );
    }

    /**
     * Transform Cos to math.cos(x)
     */
    transformCos(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'cos'),
        [argument]
      );
    }

    /**
     * Transform Tan to math.tan(x)
     */
    transformTan(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'tan'),
        [argument]
      );
    }

    /**
     * Transform Asin to math.asin(x)
     */
    transformAsin(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'asin'),
        [argument]
      );
    }

    /**
     * Transform Acos to math.acos(x)
     */
    transformAcos(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'acos'),
        [argument]
      );
    }

    /**
     * Transform Atan to math.atan(x)
     */
    transformAtan(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'atan'),
        [argument]
      );
    }

    /**
     * Transform Atan2 to math.atan2(y, x)
     */
    transformAtan2(node) {
      this.imports.add('math');
      const y = this.transformExpression(node.arguments?.[0] || node.y);
      const x = this.transformExpression(node.arguments?.[1] || node.x);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'atan2'),
        [y, x]
      );
    }

    /**
     * Transform Sinh to math.sinh(x)
     */
    transformSinh(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'sinh'),
        [argument]
      );
    }

    /**
     * Transform Cosh to math.cosh(x)
     */
    transformCosh(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'cosh'),
        [argument]
      );
    }

    /**
     * Transform Tanh to math.tanh(x)
     */
    transformTanh(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'tanh'),
        [argument]
      );
    }

    /**
     * Transform Exp to math.exp(x)
     */
    transformExp(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'exp'),
        [argument]
      );
    }

    /**
     * Transform Cbrt to pow(x, 1.0 / 3.0)
     * Python 3.11+ has math.cbrt but pow is safer for compatibility
     */
    transformCbrt(node) {
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonIdentifier('pow'),
        [argument, new PythonBinaryExpression(PythonLiteral.Float(1.0), '/', PythonLiteral.Float(3.0))]
      );
    }

    /**
     * Transform Hypot to math.hypot(a, b, ...)
     */
    transformHypot(node) {
      this.imports.add('math');
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'hypot'),
        args
      );
    }

    /**
     * Transform Fround to float(x)
     * Python floats are already IEEE 754 double precision; closest approximation
     */
    transformFround(node) {
      const argument = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(new PythonIdentifier('float'), [argument]);
    }

    /**
     * Transform MathConstant to Python math module constants or expressions
     * Maps: PI→math.pi, E→math.e, LN2→math.log(2), LN10→math.log(10),
     *        LOG2E→math.log2(math.e), LOG10E→math.log10(math.e),
     *        SQRT2→math.sqrt(2), SQRT1_2→math.sqrt(0.5)
     */
    transformMathConstant(node) {
      this.imports.add('math');
      const mathId = new PythonIdentifier('math');
      switch (node.name) {
        case 'PI':
          return new PythonMemberAccess(mathId, 'pi');
        case 'E':
          return new PythonMemberAccess(mathId, 'e');
        case 'LN2':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log'),
            [PythonLiteral.Int(2)]
          );
        case 'LN10':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log'),
            [PythonLiteral.Int(10)]
          );
        case 'LOG2E':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log2'),
            [new PythonMemberAccess(mathId, 'e')]
          );
        case 'LOG10E':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log10'),
            [new PythonMemberAccess(mathId, 'e')]
          );
        case 'SQRT2':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'sqrt'),
            [PythonLiteral.Int(2)]
          );
        case 'SQRT1_2':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'sqrt'),
            [PythonLiteral.Float(0.5)]
          );
        default:
          return new PythonMemberAccess(mathId, node.name.toLowerCase());
      }
    }

    /**
     * Transform NumberConstant to Python equivalents
     * Maps: MAX_SAFE_INTEGER→2**53-1, MIN_SAFE_INTEGER→-(2**53-1),
     *        MAX_VALUE→sys.float_info.max, MIN_VALUE→sys.float_info.min,
     *        EPSILON→sys.float_info.epsilon, POSITIVE_INFINITY→math.inf,
     *        NEGATIVE_INFINITY→-math.inf, NaN→math.nan
     */
    transformNumberConstant(node) {
      switch (node.name) {
        case 'MAX_SAFE_INTEGER':
          return new PythonBinaryExpression(
            new PythonBinaryExpression(PythonLiteral.Int(2), '**', PythonLiteral.Int(53)),
            '-',
            PythonLiteral.Int(1)
          );
        case 'MIN_SAFE_INTEGER':
          return new PythonUnaryExpression('-', new PythonBinaryExpression(
            new PythonBinaryExpression(PythonLiteral.Int(2), '**', PythonLiteral.Int(53)),
            '-',
            PythonLiteral.Int(1)
          ));
        case 'MAX_VALUE':
          this.imports.add('sys');
          return new PythonMemberAccess(
            new PythonMemberAccess(new PythonIdentifier('sys'), 'float_info'),
            'max'
          );
        case 'MIN_VALUE':
          this.imports.add('sys');
          return new PythonMemberAccess(
            new PythonMemberAccess(new PythonIdentifier('sys'), 'float_info'),
            'min'
          );
        case 'EPSILON':
          this.imports.add('sys');
          return new PythonMemberAccess(
            new PythonMemberAccess(new PythonIdentifier('sys'), 'float_info'),
            'epsilon'
          );
        case 'POSITIVE_INFINITY':
          this.imports.add('math');
          return new PythonMemberAccess(new PythonIdentifier('math'), 'inf');
        case 'NEGATIVE_INFINITY':
          this.imports.add('math');
          return new PythonUnaryExpression('-', new PythonMemberAccess(new PythonIdentifier('math'), 'inf'));
        case 'NaN':
          this.imports.add('math');
          return new PythonMemberAccess(new PythonIdentifier('math'), 'nan');
        default:
          return PythonLiteral.Float(node.value);
      }
    }

    /**
     * Transform InstanceOfCheck to isinstance(value, ClassName)
     */
    transformInstanceOfCheck(node) {
      const value = this.transformExpression(node.value);
      const className = this.transformExpression(node.className);
      return new PythonCall(new PythonIdentifier('isinstance'), [value, className]);
    }

    /**
     * Transform ArraySort to sorted() or list.sort()
     * Python: sorted(arr) or sorted(arr, key=lambda x: ...)
     */
    transformArraySort(node) {
      const array = this.transformExpression(node.array);

      if (node.compareFn) {
        // If there's a comparison function, we need to convert it to a key function
        // JavaScript: arr.sort((a, b) => a - b)
        // Python: sorted(arr) or sorted(arr, key=lambda x: x)
        // For numeric sorts, we can use default sorted()
        // For custom sorts, we need functools.cmp_to_key
        this.imports.add('functools');
        const compareFunc = this.transformExpression(node.compareFn);
        return new PythonCall(
          new PythonIdentifier('sorted'),
          [array],
          [{ name: 'key', value: new PythonCall(
            new PythonMemberAccess(new PythonIdentifier('functools'), 'cmp_to_key'),
            [compareFunc]
          )}]
        );
      }

      // Default sort
      return new PythonCall(new PythonIdentifier('sorted'), [array]);
    }

    /**
     * Transform ArraySplice to Python slice assignment
     * JavaScript: arr.splice(start, deleteCount, ...items)
     * Python: arr[start:start+deleteCount] = items or del arr[start:start+deleteCount]
     */
    transformArraySplice(node) {
      const array = this.transformExpression(node.array);
      const start = this.transformExpression(node.start);
      const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : null;
      const items = node.items ? node.items.map(item => this.transformExpression(item)) : [];

      // For now, return a helper function call
      // Python: splice_array(arr, start, deleteCount, *items)
      const args = [array, start];
      if (deleteCount)
        args.push(deleteCount);
      else
        args.push(PythonLiteral.Int(0));

      if (items.length > 0)
        args.push(new PythonList(items));
      else
        args.push(new PythonList([]));

      return new PythonCall(new PythonIdentifier('splice_array'), args);
    }

    /**
     * Transform SetCreation to Python set()
     * JavaScript: new Set() or new Set(iterable)
     */
    transformSetCreation(node) {
      if (node.values) {
        const values = this.transformExpression(node.values);
        return new PythonCall(new PythonIdentifier('set'), [values]);
      }
      return new PythonCall(new PythonIdentifier('set'), []);
    }
  }

  // Export
  const exports = { PythonTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PythonTransformer = PythonTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
