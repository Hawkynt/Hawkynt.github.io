/**
 * CppTransformer.js - IL AST to C++ AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to C++ AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → C++ AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - namespace: C++ namespace name
 *   - className: Main class name
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

  let CppEmitter;
  if (typeof require !== 'undefined') {
    CppEmitter = require('./CppEmitter.js').CppEmitter;
  } else if (global.CppEmitter) {
    CppEmitter = global.CppEmitter;
  }

  const {
    CppType, CppCompilationUnit, CppIncludeDirective, CppNamespace,
    CppClass, CppStruct, CppField, CppMethod, CppConstructor, CppDestructor,
    CppParameter, CppBlock, CppVariableDeclaration, CppExpressionStatement,
    CppReturn, CppIf, CppFor, CppRangeFor, CppWhile, CppDoWhile, CppSwitch,
    CppSwitchCase, CppBreak, CppContinue, CppThrow, CppTryCatch, CppCatchClause,
    CppLiteral, CppIdentifier, CppBinaryExpression, CppUnaryExpression,
    CppAssignment, CppMemberAccess, CppElementAccess, CppFunctionCall,
    CppObjectCreation, CppArrayCreation, CppInitializerList, CppMapInitializer, CppCast,
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
   * C++ reserved keywords that must be escaped in identifiers
   */
  const CPP_RESERVED_WORDS = new Set([
    'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor',
    'bool', 'break', 'case', 'catch', 'char', 'char8_t', 'char16_t', 'char32_t',
    'class', 'compl', 'concept', 'const', 'consteval', 'constexpr', 'constinit',
    'const_cast', 'continue', 'co_await', 'co_return', 'co_yield', 'decltype',
    'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit',
    'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline',
    'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq',
    'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected', 'public',
    'register', 'reinterpret_cast', 'requires', 'return', 'short', 'signed',
    'sizeof', 'static', 'static_assert', 'static_cast', 'struct', 'switch',
    'template', 'this', 'thread_local', 'throw', 'true', 'try', 'typedef',
    'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void',
    'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
  ]);

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
      this.currentMethodName = null;
      this.currentMethodReturnType = null;
      this.variableTypes = new Map();
      this.classFieldTypes = new Map();
      this.methodSignatures = new Map();
      this.nestedClasses = [];
      this.warnings = [];
      this.scopeStack = [];
      this.currentArrayElementType = null;
      // Track constructor default parameters for each class
      // Maps: className -> [defaultValues] (array of CppLiteral/CppExpression)
      this.constructorDefaultParams = new Map();

      // Map JS source class names → C++ header class names
      // The JS source uses PascalCase (AeadAlgorithm) but C++ header uses acronym-caps (AEADAlgorithm)
      this.jsToHeaderNameMap = new Map([
        ['AeadAlgorithm', 'AEADAlgorithm'],
        ['IAeadInstance', 'IAEADInstance'],
        ['KdfAlgorithm', 'KDFAlgorithm'],
        ['IKdfInstance', 'IKDFInstance'],
        ['IMacInstance', 'IMACInstance'],
        ['ErrorCorrectionAlgorithm', 'ECCAlgorithm'],
        ['IErrorCorrectionInstance', 'IECCInstance'],
        ['RandomGenerationAlgorithm', 'RandomAlgorithm'],
        ['IRandomGeneratorInstance', 'IRandomInstance'],
        ['AsymmetricCipherAlgorithm', 'AsymmetricAlgorithm'],
        ['CipherModeAlgorithm', 'Algorithm'],
        ['PaddingAlgorithm', 'Algorithm'],
        ['CryptoAlgorithm', 'Algorithm'],
        ['SymmetricCipherAlgorithm', 'BlockCipherAlgorithm'],
        ['BaseAlgorithm', 'Algorithm']
      ]);

      // Known framework class names that should NOT be transformed by toPascalCase
      this.frameworkClassNames = new Set([
        'Algorithm', 'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
        'MacAlgorithm', 'AEADAlgorithm', 'KDFAlgorithm', 'CompressionAlgorithm',
        'EncodingAlgorithm', 'RandomAlgorithm', 'ChecksumAlgorithm', 'ECCAlgorithm',
        'AsymmetricAlgorithm', 'ClassicalAlgorithm',
        'IAlgorithmInstance', 'IBlockCipherInstance', 'IStreamCipherInstance',
        'IHashFunctionInstance', 'IMACInstance', 'IAEADInstance', 'IKDFInstance',
        'ICompressionInstance', 'IRandomInstance', 'IChecksumInstance', 'IECCInstance',
        'IAsymmetricInstance', 'IClassicalInstance',
        'TestCase', 'LinkItem', 'KeySize', 'Vulnerability', 'DynamicConfig',
        'CategoryType', 'SecurityStatus', 'CountryCode', 'ComplexityType'
      ]);

      // Base class virtual method signatures for proper override handling
      // Maps: baseClassName -> { methodName -> { returnType, paramTypes } }
      this.baseClassMethods = new Map([
        ['IAlgorithmInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IBlockCipherInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IHashFunctionInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IChecksumInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['Algorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        // Derived algorithm classes inherit create_instance from Algorithm
        ['BlockCipherAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['StreamCipherAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['HashFunctionAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['MacAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['ChecksumAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['CompressionAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['EncodingAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['RandomAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['AEADAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['KDFAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['ECCAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['AsymmetricAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['ClassicalAlgorithm', new Map([
          ['create_instance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }],
          ['createInstance', { returnType: new CppType('std::optional<void*>'), paramTypes: [CppType.Bool()] }]
        ])],
        ['IAEADInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IKDFInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['ICompressionInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IMACInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IRandomInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IECCInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IAsymmetricInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])],
        ['IClassicalInstance', new Map([
          ['result', { returnType: CppType.Vector(CppType.Byte()), paramTypes: [] }],
          ['feed', { returnType: CppType.Void(), paramTypes: [CppType.Vector(CppType.Byte())] }]
        ])]
      ]);

      // Framework type field types for nested member access inference
      // Maps: typeName -> { fieldName -> CppType }
      this.frameworkTypeFields = new Map([
        ['DynamicConfig', new Map([
          ['description', CppType.String()],
          ['Description', CppType.String()],
          ['sum_bits', CppType.UInt()],
          ['sumBits', CppType.UInt()],
          ['SumBits', CppType.UInt()],
          ['modulo', CppType.UInt()],
          ['Modulo', CppType.UInt()],
          ['base', CppType.UInt()],
          ['Base', CppType.UInt()],
          ['result_bytes', CppType.UInt()],
          ['resultBytes', CppType.UInt()],
          ['ResultBytes', CppType.UInt()],
          ['complexity', new CppType('ComplexityType')],
          ['Complexity', new CppType('ComplexityType')],
          ['tests', CppType.Vector(new CppType('TestCase'))]
        ])],
        ['Algorithm', new Map([
          ['name', CppType.String()],
          ['Name', CppType.String()],
          ['description', CppType.String()],
          ['Description', CppType.String()],
          ['inventor', CppType.String()],
          ['Inventor', CppType.String()],
          ['year', CppType.Int()],
          ['Year', CppType.Int()],
          ['config', new CppType('DynamicConfig')],
          ['Config', new CppType('DynamicConfig')]
        ])],
        ['IAlgorithmInstance', new Map([
          ['config', new CppType('DynamicConfig')],
          ['Config', new CppType('DynamicConfig')],
          ['a', CppType.ULong()],
          ['A', CppType.ULong()],
          ['b', CppType.ULong()],
          ['B', CppType.ULong()]
        ])],
        ['IBlockCipherInstance', new Map([
          ['key', CppType.Vector(CppType.Byte())],
          ['Key', CppType.Vector(CppType.Byte())],
          ['_key', CppType.Vector(CppType.Byte())],
          ['iv', CppType.Vector(CppType.Byte())],
          ['Iv', CppType.Vector(CppType.Byte())],
          ['_iv', CppType.Vector(CppType.Byte())],
          ['input_buffer', CppType.Vector(CppType.Byte())],
          ['inputBuffer', CppType.Vector(CppType.Byte())],
          ['InputBuffer', CppType.Vector(CppType.Byte())],
          ['is_inverse', CppType.Bool()],
          ['isInverse', CppType.Bool()],
          ['IsInverse', CppType.Bool()],
          ['block_size', CppType.UInt()],
          ['blockSize', CppType.UInt()],
          ['BlockSize', CppType.UInt()],
          ['key_size', CppType.UInt()],
          ['keySize', CppType.UInt()],
          ['KeySize', CppType.UInt()]
        ])],
        ['IStreamCipherInstance', new Map([
          ['key', CppType.Vector(CppType.Byte())],
          ['Key', CppType.Vector(CppType.Byte())],
          ['_key', CppType.Vector(CppType.Byte())],
          ['nonce', CppType.Vector(CppType.Byte())],
          ['Nonce', CppType.Vector(CppType.Byte())],
          ['_nonce', CppType.Vector(CppType.Byte())],
          ['iv', CppType.Vector(CppType.Byte())],
          ['Iv', CppType.Vector(CppType.Byte())],
          ['_iv', CppType.Vector(CppType.Byte())]
        ])],
        ['IHashFunctionInstance', new Map([
          ['output_size', CppType.UInt()],
          ['outputSize', CppType.UInt()],
          ['OutputSize', CppType.UInt()],
          ['input_buffer', CppType.Vector(CppType.Byte())],
          ['inputBuffer', CppType.Vector(CppType.Byte())]
        ])]
      ]);
    }

    /**
     * Convert a C++ AST node to its code string representation.
     * Uses CppEmitter to properly serialize nodes instead of relying on toString().
     */
    _nodeToCode(node) {
      if (!node) return '';
      if (typeof node === 'string') return node;
      try {
        const emitter = new CppEmitter({ indent: '', newline: '' });
        return emitter.emit(node);
      } catch (e) {
        return String(node);
      }
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

      // Map JSDoc @typedef {Object} config types to DynamicConfig
      // These are algorithm-specific configuration objects like AdlerConfig, FletcherConfig, etc.
      if (typeName.endsWith('Config') && typeName !== 'DynamicConfig')
        return new CppType('DynamicConfig');

      // Algorithm types are always passed as pointer since they're class references
      // Handles: Algorithm, TEAAlgorithm, XTEAAlgorithm, AdlerAlgorithm, etc.
      if (typeName === 'Algorithm' || typeName.endsWith('Algorithm'))
        return new CppType('Algorithm*');

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

      // Map JSDoc @typedef {Object} config types to DynamicConfig
      if (typeName.endsWith('Config') && typeName !== 'DynamicConfig')
        return new CppType('DynamicConfig');

      // Algorithm types are always passed as pointer
      if (typeName === 'Algorithm' || typeName.endsWith('Algorithm'))
        return new CppType('Algorithm*');

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
     * Infer parameter type from name using common naming conventions
     * This provides C++17 compatible types instead of 'auto'
     * @param {string} name - Parameter name
     * @param {string} methodName - Optional method name for context-aware inference
     */
    inferParameterTypeFromName(name, methodName = null) {
      if (!name) return CppType.Vector(CppType.Byte());

      const lowerName = name.toLowerCase();
      const lowerMethodName = methodName ? methodName.toLowerCase() : '';

      // Context-aware inference for word-based methods (XXTEA, etc.)
      const isWordMethod = lowerMethodName.includes('words') || lowerMethodName.includes('_words');
      if (isWordMethod) {
        // In word methods, 'v' and 'k' parameters are vectors of uint32
        if (lowerName === 'v' || lowerName === 'k') {
          return CppType.ConstRef(CppType.Vector(CppType.UInt()));
        }
        // 'words' parameter is also vector of uint32
        if (lowerName === 'words') {
          return CppType.ConstRef(CppType.Vector(CppType.UInt()));
        }
      }

      // Context-aware inference for calculate_* methods (work with scalar word values)
      const isCalcMethod = lowerMethodName.includes('calculate') || lowerMethodName.startsWith('calc_');
      if (isCalcMethod) {
        // In calculation methods, parameters like z, y, sum, key, p, e are typically uint32 scalars
        if (lowerName === 'z' || lowerName === 'y' || lowerName === 'sum' ||
            lowerName === 'key' || lowerName === 'p' || lowerName === 'e' ||
            lowerName === 'mx' || lowerName === 'm_x') {
          return CppType.UInt();
        }
      }

      // Boolean parameters
      if (lowerName === 'isinverse' || lowerName === 'is_inverse' ||
          lowerName === 'inverse' || lowerName === 'decrypt' ||
          lowerName === 'isdecrypt' || lowerName === 'is_decrypt' ||
          lowerName.startsWith('is_') || lowerName.startsWith('is') && /^is[A-Z]/.test(name)) {
        return CppType.Bool();
      }

      // Algorithm reference parameters
      if (lowerName === 'algorithm' || lowerName === 'algo') {
        return new CppType('Algorithm*');
      }

      // Key/IV/Nonce byte array parameters
      if (lowerName === 'key' || lowerName === 'keybytes' || lowerName === 'key_bytes' ||
          lowerName === 'iv' || lowerName === 'ivbytes' || lowerName === 'iv_bytes' ||
          lowerName === 'nonce' || lowerName === 'noncebytes' || lowerName === 'nonce_bytes' ||
          lowerName === 'data' || lowerName === 'input' || lowerName === 'output' ||
          lowerName === 'block' || lowerName === 'plaintext' || lowerName === 'ciphertext' ||
          lowerName === 'bytes' || lowerName === 'buffer' || lowerName === 'result' ||
          lowerName === 'salt' || lowerName === 'password') {
        return CppType.ConstRef(CppType.Vector(CppType.Byte()));
      }

      // Integer parameters - but NOT in word methods where 'k' is a vector
      if (lowerName === 'size' || lowerName === 'length' || lowerName === 'count' ||
          lowerName === 'index' || lowerName === 'offset' || lowerName === 'rounds' ||
          lowerName === 'bits' || lowerName === 'iterations' || lowerName === 'n' ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'k') {
        return CppType.UInt();
      }

      // String parameters
      if (lowerName === 'name' || lowerName === 'description' || lowerName === 'text' ||
          lowerName === 'message' || lowerName === 'str' || lowerName === 'string' ||
          lowerName === 'variant' || lowerName === 'mode' || lowerName === 'type' ||
          lowerName === 'label' || lowerName === 'format') {
        return CppType.ConstRef(CppType.String());
      }

      // Default to const reference to byte vector for crypto contexts
      return CppType.ConstRef(CppType.Vector(CppType.Byte()));
    }

    /**
     * Check if a type contains 'auto' anywhere (including in template args)
     * C++17 doesn't support 'auto' in template args like std::vector<auto>
     */
    typeContainsAuto(type) {
      if (!type) return false;
      if (type.name === 'auto') return true;
      if (type.templateArgs) {
        for (const arg of type.templateArgs) {
          if (this.typeContainsAuto(arg)) return true;
        }
      }
      return false;
    }

    /**
     * Fix a return type that contains 'auto' anywhere by replacing with appropriate types
     */
    fixAutoInReturnType(type, methodName) {
      if (!type) return type;

      // If the type itself is auto
      if (type.name === 'auto') {
        const inferredType = this.inferReturnTypeFromMethodName(methodName);
        return inferredType || CppType.Vector(CppType.Byte());
      }

      // If it's a vector with auto element type (std::vector<auto>)
      if (type.isVector && type.templateArgs && type.templateArgs.length > 0) {
        if (type.templateArgs[0].name === 'auto') {
          // Replace with byte vector for crypto context
          return CppType.Vector(CppType.Byte());
        }
      }

      return type;
    }

    /**
     * Infer return type from method name using common naming conventions
     * This provides C++17 compatible types instead of 'auto'
     */
    inferReturnTypeFromMethodName(name) {
      if (!name) return null;

      const lowerName = name.toLowerCase();

      // Methods that work with 32-bit words (XXTEA, etc.)
      // Must check before general encrypt/decrypt patterns
      if (lowerName.includes('words') || lowerName.includes('_words') ||
          lowerName === 'get_key_words' || lowerName === 'getkeywords') {
        return CppType.Vector(CppType.UInt());
      }

      // Methods that return byte arrays
      if (lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('encrypt') || lowerName.includes('decrypt') ||
          lowerName.includes('process') || lowerName.includes('transform') ||
          lowerName.includes('hash') || lowerName.includes('digest') ||
          lowerName === 'result' || lowerName === 'feed' ||
          lowerName === 'get_key' || lowerName === 'get_iv' ||
          lowerName === 'get_nonce' || lowerName === 'get_data') {
        return CppType.Vector(CppType.Byte());
      }

      // Methods that return instance pointers
      if (lowerName === 'create_instance' || lowerName === 'createinstance') {
        return CppType.Optional(new CppType('void*'));
      }

      // Methods that return booleans
      if (lowerName.startsWith('is_') || lowerName.startsWith('has_') ||
          lowerName.startsWith('can_') || lowerName === 'validate') {
        return CppType.Bool();
      }

      // Methods that return integers
      if (lowerName.includes('size') || lowerName.includes('length') ||
          lowerName.includes('count') || lowerName.includes('index')) {
        return CppType.UInt();
      }

      // Methods that return strings
      if (lowerName === 'get_name' || lowerName === 'get_description' ||
          lowerName === 'to_string' || lowerName === 'tostring') {
        return CppType.String();
      }

      // Methods that return void (initialization, setup, mutation methods)
      if (lowerName.startsWith('initialize') || lowerName.startsWith('_initialize') ||
          lowerName.startsWith('init_') || lowerName.startsWith('_init_') ||
          lowerName.includes('_init') || lowerName === 'init' ||
          lowerName.startsWith('reset') || lowerName.startsWith('_reset') ||
          lowerName.startsWith('clear_') || lowerName.startsWith('_clear_') ||
          lowerName.startsWith('set_') || lowerName.startsWith('setup') ||
          lowerName === 'clear' || lowerName === 'reset') {
        return CppType.Void();
      }

      return null; // Let caller decide default
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
      const snakeName = name
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
      return this.escapeReservedWord(snakeName);
    }

    /**
     * Escape C++ reserved keywords by appending underscore
     */
    escapeReservedWord(name) {
      if (CPP_RESERVED_WORDS.has(name)) {
        return name + '_';
      }
      return name;
    }

    /**
     * Sanitize identifier for C++ compliance
     * - Prefix with 'C_' if starts with digit
     * - Replace non-alphanumeric chars with underscore
     * - Handle reserved underscore patterns
     */
    sanitizeCppIdentifier(name) {
      if (!name || name.length === 0) return '_unknown';

      // If starts with a digit, prefix with 'C_' (for class/constant)
      if (/^\d/.test(name))
        name = 'C_' + name;

      // Replace any non-alphanumeric (except underscore) with underscore
      name = name.replace(/[^a-zA-Z0-9_]/g, '_');

      // Ensure it doesn't start with underscore followed by uppercase (reserved in C++)
      if (/^_[A-Z]/.test(name))
        name = 'c' + name;

      // Check reserved words after sanitization
      return this.escapeReservedWord(name);
    }

    /**
     * Convert to PascalCase naming (also sanitizes for C++ compliance)
     */
    toPascalCase(name) {
      if (!name) return '';
      if (typeof name !== 'string') return String(name);
      // Map JS source names to C++ header names (e.g., AeadAlgorithm → AEADAlgorithm)
      if (this.jsToHeaderNameMap && this.jsToHeaderNameMap.has(name))
        return this.jsToHeaderNameMap.get(name);
      // Preserve known framework class names exactly as-is
      if (this.frameworkClassNames && this.frameworkClassNames.has(name))
        return name;
      const pascalCase = name.charAt(0).toUpperCase() + name.slice(1).replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
      return this.sanitizeCppIdentifier(pascalCase);
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
     * Check if a type represents a vector/array type
     */
    isVectorType(type) {
      if (!type) return false;
      if (type.isVector) return true;
      if (type.isArray) return true;
      if (type.name === 'std::vector' || type.name === 'vector') return true;
      // Check for template specializations like std::vector<uint8_t>
      if (type.name && type.name.startsWith('std::vector<')) return true;
      // Check for IL AST type names like "uint8[]", "uint8[]|null", etc.
      if (type.name && type.name.includes('[]')) return true;
      return false;
    }

    /**
     * Check if an expression node represents a vector/array type
     */
    isVectorExpression(node) {
      if (!node) return false;

      // Check IL AST resultType property first (from type-aware parser)
      if (node.resultType) {
        if (this.isVectorType(node.resultType)) return true;
      }

      // Check for ThisPropertyAccess nodes with known vector properties
      if (node.type === 'ThisPropertyAccess' || node.ilNodeType === 'ThisPropertyAccess') {
        const propName = node.property;
        // Check registered class field types
        const fieldName = this.toSnakeCase(propName);
        if (this.classFieldTypes?.has(fieldName)) {
          const fieldType = this.classFieldTypes.get(fieldName);
          if (this.isVectorType(fieldType)) return true;
        }
        // Check instance type fields for known vector properties
        const instanceTypes = ['IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance', 'IAlgorithmInstance', 'IAEADInstance', 'IKDFInstance', 'ICompressionInstance', 'IMACInstance', 'IRandomInstance', 'IChecksumInstance', 'IECCInstance', 'IAsymmetricInstance', 'IClassicalInstance'];
        if (this.frameworkTypeFields) {
          for (const instanceType of instanceTypes) {
            const instanceFields = this.frameworkTypeFields.get(instanceType);
            if (instanceFields && instanceFields.has(propName)) {
              const fieldType = instanceFields.get(propName);
              if (this.isVectorType(fieldType)) return true;
            }
          }
        }
      }

      // Check for MemberExpression with ThisExpression (this.property)
      if (node.type === 'MemberExpression' && node.object?.type === 'ThisExpression') {
        const propName = node.property?.name || node.property?.value;
        if (propName) {
          const fieldName = this.toSnakeCase(propName);
          // Check registered class field types
          if (this.classFieldTypes?.has(fieldName)) {
            const fieldType = this.classFieldTypes.get(fieldName);
            if (this.isVectorType(fieldType)) return true;
          }
          // Check by name pattern for known vector fields
          const lowerName = propName.toLowerCase();
          if (lowerName === 'keywords' || lowerName === 'key_words' ||
              lowerName === 'keywords' || lowerName === 'sum0' || lowerName === 'sum1' ||
              lowerName === 'roundkeys' || lowerName === 'subkeys' ||
              lowerName === 'inputbuffer' || lowerName === 'input_buffer' ||
              lowerName === 'sbox' || lowerName === '_key')
            return true;
        }
      }

      // Check for Identifier nodes with registered types
      if (node.type === 'Identifier' && node.name) {
        const varType = this.getVariableType(this.toSnakeCase(node.name));
        if (varType && this.isVectorType(varType)) return true;
      }

      // Fall back to full type inference
      const type = this.inferExpressionType(node);
      return this.isVectorType(type);
    }

    /**
     * Infer field type from assignment expression
     * Handles enum values, function calls, literals, etc.
     */
    inferFieldTypeFromAssignment(fieldName, valueNode) {
      if (!valueNode) return null;

      // Handle enum member access (e.g., CategoryType.BLOCK)
      if (valueNode.type === 'MemberExpression' && valueNode.object?.type === 'Identifier') {
        const enumTypeName = valueNode.object.name;
        // Known framework enums
        const frameworkEnums = ['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'];
        if (frameworkEnums.includes(enumTypeName)) {
          return new CppType(enumTypeName);
        }
      }

      // Handle function calls - infer from function name and context
      if (valueNode.type === 'CallExpression') {
        const callee = valueNode.callee;
        // OpCodes method calls
        if (callee?.type === 'MemberExpression' &&
            callee.object?.name === 'OpCodes') {
          const methodName = callee.property?.name;
          const returnType = this.getOpCodesReturnType(methodName);
          if (returnType) return returnType;
          // Default for pack operations
          if (methodName?.startsWith('Pack32')) return CppType.UInt();
          if (methodName?.startsWith('Pack64')) return CppType.ULong();
        }
      }

      // Handle ArrayCreation IL nodes (e.g., new Array(size))
      if (valueNode.type === 'ArrayCreation' || valueNode.ilNodeType === 'ArrayCreation') {
        // Use the elementType from the IL node
        if (valueNode.elementType) {
          const elemType = this.mapType(valueNode.elementType);
          return CppType.Vector(elemType);
        }
        // Use resultType if available (e.g., "uint8[]")
        if (valueNode.resultType && valueNode.resultType.endsWith('[]')) {
          const elemTypeName = valueNode.resultType.slice(0, -2);
          const elemType = this.mapType(elemTypeName);
          return CppType.Vector(elemType);
        }
        // Fall back to field name inference for generic Array() with size
        // (e.g., new Array(this.CYCLES) for sum0/sum1/keywords/etc.)
        if (fieldName) {
          return this.inferFieldTypeFromName(fieldName);
        }
        // Default to uint8 for generic array creation without field context
        return CppType.Vector(CppType.Byte());
      }

      // Handle array expressions
      if (valueNode.type === 'ArrayExpression') {
        // First check if field name tells us the element type
        if (fieldName) {
          const lowerName = fieldName.toLowerCase();
          // Known framework array fields
          if (lowerName === 'tests') return CppType.Vector(new CppType('TestCase'));
          if (lowerName === 'documentation' || lowerName === 'references')
            return CppType.Vector(new CppType('LinkItem'));
          if (lowerName === 'knownvulnerabilities' || lowerName === 'known_vulnerabilities')
            return CppType.Vector(new CppType('Vulnerability'));
          if (lowerName === 'supportedkeysizes' || lowerName === 'supported_key_sizes' ||
              lowerName === 'supportedblocksizes' || lowerName === 'supported_block_sizes')
            return CppType.Vector(new CppType('KeySize'));
          // Known crypto uint32 arrays
          if (lowerName === 'keywords' || lowerName === 'key_words' ||
              lowerName === 'roundkeys' || lowerName === 'round_keys' ||
              lowerName === 'subkeys' || lowerName === 'sub_keys')
            return CppType.Vector(CppType.UInt());
        }
        if (valueNode.elements?.length > 0) {
          const elemType = this.inferFieldTypeFromAssignment(null, valueNode.elements[0]);
          if (elemType && elemType.name !== 'auto') return CppType.Vector(elemType);
        }
        // Empty array - infer from field name
        return this.inferFieldTypeFromName(fieldName);
      }

      // Handle new expressions (e.g., new KeySize(...), new Array(...))
      if (valueNode.type === 'NewExpression') {
        const typeName = valueNode.callee?.name;
        if (typeName) {
          // new Array(size) - need to infer element type from field name
          if (typeName === 'Array') {
            return this.inferFieldTypeFromName(fieldName);
          }
          // Typed arrays
          if (typeName === 'Uint8Array') return CppType.Vector(CppType.Byte());
          if (typeName === 'Uint16Array') return CppType.Vector(CppType.UShort());
          if (typeName === 'Uint32Array') return CppType.Vector(CppType.UInt());
          if (typeName === 'Int8Array') return CppType.Vector(CppType.SByte());
          if (typeName === 'Int16Array') return CppType.Vector(CppType.Short());
          if (typeName === 'Int32Array') return CppType.Vector(CppType.Int());
          // Other constructors
          return new CppType(this.toPascalCase(typeName));
        }
      }

      // Handle literals
      if (valueNode.type === 'Literal') {
        if (valueNode.value === null) {
          // For null, infer from field name
          return this.inferFieldTypeFromName(fieldName);
        }
        if (typeof valueNode.value === 'boolean') return CppType.Bool();
        if (typeof valueNode.value === 'string') return CppType.String();
        if (typeof valueNode.value === 'number') {
          return Number.isInteger(valueNode.value) ? CppType.UInt() : CppType.Double();
        }
      }

      // Fall back to general expression type inference
      return this.inferExpressionType(valueNode, fieldName);
    }

    /**
     * Infer field type from field name using common naming conventions
     * Used when expression type inference fails or returns 'auto'
     */
    inferFieldTypeFromName(fieldName) {
      if (!fieldName) return CppType.UInt();

      const lowerName = fieldName.toLowerCase();

      // Known framework field types
      const frameworkFields = {
        'category': new CppType('CategoryType'),
        'securitystatus': new CppType('SecurityStatus'),
        'security_status': new CppType('SecurityStatus'),
        'complexity': new CppType('ComplexityType'),
        'country': new CppType('CountryCode'),
        'config': new CppType('DynamicConfig'),
      };
      if (frameworkFields[lowerName]) return frameworkFields[lowerName];

      // Vector of framework types
      if (lowerName === 'tests') return CppType.Vector(new CppType('TestCase'));
      if (lowerName === 'documentation' || lowerName === 'references')
        return CppType.Vector(new CppType('LinkItem'));
      if (lowerName === 'knownvulnerabilities' || lowerName === 'known_vulnerabilities')
        return CppType.Vector(new CppType('Vulnerability'));
      if (lowerName === 'keysizes' || lowerName === 'key_sizes' ||
          lowerName === 'supportedkeysizes' || lowerName === 'supported_key_sizes' ||
          lowerName === 'blocksizes' || lowerName === 'block_sizes' ||
          lowerName === 'supportedblocksizes' || lowerName === 'supported_block_sizes')
        return CppType.Vector(new CppType('KeySize'));

      // Vector of bytes
      if (lowerName === 'key' || lowerName === '_key' ||
          lowerName === 'iv' || lowerName === '_iv' ||
          lowerName === 'nonce' || lowerName === '_nonce' ||
          lowerName === 'inputbuffer' || lowerName === 'input_buffer' ||
          lowerName === 'data' || lowerName === 'buffer' ||
          lowerName === 'block' || lowerName === 'state') {
        return CppType.Vector(CppType.Byte());
      }

      // Vector of uint32 (common crypto arrays for key scheduling, round constants, digits)
      if (lowerName === 'keywords' || lowerName === 'key_words' ||
          lowerName === 'roundkeys' || lowerName === 'round_keys' ||
          lowerName === 'subkeys' || lowerName === 'sub_keys' ||
          lowerName === 'schedule' || lowerName === 'keyschedule' || lowerName === 'key_schedule' ||
          lowerName === 'sum0' || lowerName === 'sum1' || lowerName === 'sum2' ||
          lowerName === 's' || // RC4 S-box state array
          lowerName === 's0' || lowerName === 's1' || lowerName === 's2' || lowerName === 's3' ||
          lowerName === 'k0' || lowerName === 'k1' || lowerName === 'k2' || lowerName === 'k3' ||
          lowerName === 'v' || lowerName === 'w' || lowerName === 'z' ||
          lowerName === 'sbox' || lowerName === 's_box' ||
          lowerName === 'rcon' || lowerName === 'roundconst' || lowerName === 'round_const' ||
          lowerName === 'digits' || lowerName === '_digits') {
        return CppType.Vector(CppType.UInt());
      }

      // String types
      if (lowerName === 'name' || lowerName === 'description' ||
          lowerName === 'inventor' || lowerName === 'subcategory' ||
          lowerName === 'sub_category' || lowerName === 'mode' ||
          lowerName === 'algorithm' || lowerName === 'type' ||
          lowerName === 'padding' || lowerName === 'encoding' ||
          lowerName === 'label' || lowerName === 'text' ||
          lowerName === 'uri' || lowerName === 'url' ||
          lowerName === 'cipher' || lowerName === 'hash') {
        return CppType.String();
      }

      // Boolean types
      if (lowerName === 'isinverse' || lowerName === 'is_inverse' ||
          lowerName.startsWith('is_') || lowerName.startsWith('has_') ||
          lowerName.startsWith('use_') || lowerName.startsWith('enable_') ||
          lowerName === 'inverse' || lowerName === 'encrypt' ||
          lowerName === 'initialized' || lowerName === 'finalized') {
        return CppType.Bool();
      }

      // Integer types
      if (lowerName === 'year' || lowerName === 'rounds' || lowerName === 'r_o_u_n_d_s' ||
          lowerName === 'delta' || lowerName === 'd_e_l_t_a' ||
          lowerName === 'blocksize' || lowerName === 'block_size' ||
          lowerName === 'keysize' || lowerName === 'key_size' ||
          lowerName === 'outputsize' || lowerName === 'output_size' ||
          lowerName === 'size' || lowerName === 'length' || lowerName === 'count' ||
          lowerName === 'offset' || lowerName === 'index' || lowerName === 'pos' ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n' ||
          lowerName === 'bits' || lowerName === 'shift' ||
          lowerName === 'counter' || lowerName === 'round' ||
          lowerName === 'tagsize' || lowerName === 'tag_size' ||
          lowerName === 'taglen' || lowerName === 'tag_len' ||
          lowerName === 'noncesize' || lowerName === 'nonce_size' ||
          lowerName === 'ivsize' || lowerName === 'iv_size' ||
          lowerName === 'statesize' || lowerName === 'state_size') {
        return CppType.UInt();
      }

      // Default to uint32_t for crypto contexts
      return CppType.UInt();
    }

    /**
     * Infer return type from function body by analyzing return statements
     */
    inferReturnTypeFromBody(body) {
      if (!body || !body.body) return null;

      // Scan for return statements recursively
      const returnTypes = [];
      const scanNode = (node) => {
        if (!node) return;
        if (node.type === 'ReturnStatement' && node.argument) {
          // Check for dictionary access pattern: obj[key] || obj[default] or just obj[key]
          const arg = node.argument;
          if (this._isDictionaryAccessPattern(arg)) {
            returnTypes.push(new CppType('DynamicConfig'));
          } else {
            const inferredType = this.inferExpressionType(arg);
            if (inferredType && inferredType.name !== 'void' && inferredType.name !== 'auto')
              returnTypes.push(inferredType);
          }
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

      // Return the first inferred type, or null if no returns with values
      return returnTypes.length > 0 ? returnTypes[0] : null;
    }

    /**
     * Check if expression is a dictionary/map access pattern
     * e.g., configs[key] || configs["default"] or just configs[key]
     */
    _isDictionaryAccessPattern(node) {
      if (!node) return false;
      // Direct dictionary access: obj[key]
      if (node.type === 'MemberExpression' && node.computed) {
        // Check if the object is a vector/array type - if so, it's not a dictionary access
        const objType = this.inferExpressionType(node.object);
        if (objType && objType.isVector) {
          return false;  // It's array subscript, not dictionary access
        }
        return true;
      }
      // Null-coalescing pattern: obj[key] || obj[default]
      if (node.type === 'LogicalExpression' && node.operator === '||') {
        const left = node.left;
        const right = node.right;
        if (left.type === 'MemberExpression' && left.computed &&
            right.type === 'MemberExpression' && right.computed) {
          return true;
        }
      }
      // Conditional with dictionary access: condition ? obj[key1] : obj[key2]
      if (node.type === 'ConditionalExpression') {
        if ((node.consequent.type === 'MemberExpression' && node.consequent.computed) ||
            (node.alternate.type === 'MemberExpression' && node.alternate.computed)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Infer type from expression (comprehensive)
     */
    inferExpressionType(node, contextFieldName = null) {
      if (!node) return CppType.Auto();

      // Handle C++ AST nodes (have nodeType instead of type)
      if (node.nodeType && !node.type) {
        switch (node.nodeType) {
          case 'Literal':
            // CppLiteral has literalType: 'string', 'int', 'uint', 'bool', etc.
            if (node.literalType === 'string') return CppType.String();
            if (node.literalType === 'bool') return CppType.Bool();
            if (node.literalType === 'int') return CppType.Int();
            if (node.literalType === 'uint') return CppType.UInt();
            if (node.literalType === 'long') return CppType.Long();
            if (node.literalType === 'ulong') return CppType.ULong();
            if (node.literalType === 'float') return CppType.Float();
            if (node.literalType === 'double') return CppType.Double();
            if (node.literalType === 'nullptr') return CppType.Optional(CppType.UInt());
            return CppType.Auto();
          case 'Type':
            // Already a CppType
            return node;
          default:
            return CppType.Auto();
        }
      }

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
          // Logical && returns bool, but || can be used for null-coalescing
          if (node.operator === '&&') {
            return CppType.Bool();
          }
          // For ||, check if it's used as null-coalescing (non-boolean operands)
          if (node.operator === '||') {
            const leftType = this.inferExpressionType(node.left);
            // If left operand is not boolean, this is likely null-coalescing
            if (leftType && leftType.name !== 'bool') {
              return leftType;
            }
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

        case 'MemberExpression': {
          // Array indexed access
          if (node.computed) {
            const arrType = this.inferExpressionType(node.object);
            if (arrType && arrType.isVector) {
              return arrType.vectorElement || CppType.Byte();
            }
            // Map subscript access - return the value type (DynamicConfig for dictionary patterns)
            if (arrType && (arrType.name.includes('map') || arrType.name === 'auto')) {
              // Check if the object is a known dictionary/map variable
              if (node.object.type === 'Identifier') {
                const varType = this.variableTypes ? this.variableTypes.get(node.object.name) : null;
                if (varType && varType.name && varType.name.includes('map')) {
                  return new CppType('DynamicConfig');
                }
              }
              // Default to DynamicConfig for computed access on potential maps
              return new CppType('DynamicConfig');
            }
          }
          // Property access - check if it's 'length'
          const propName = node.property.name || node.property.value;
          if (propName === 'length') return CppType.Int();

          // Handle ThisPropertyAccess as object (e.g., this.config.description)
          if (node.object.type === 'ThisPropertyAccess') {
            // Get the type of the this.X property first
            const thisObjType = this.inferExpressionType(node.object);
            if (thisObjType && thisObjType.name && this.frameworkTypeFields && this.frameworkTypeFields.has(thisObjType.name)) {
              const typeFields = this.frameworkTypeFields.get(thisObjType.name);
              if (typeFields.has(propName)) {
                return typeFields.get(propName);
              }
            }
          }

          // Check class fields for direct this.x access
          if (node.object.type === 'ThisExpression') {
            // Fields are stored with snake_case, so look up with snake_case
            const fieldType = this.classFieldTypes.get(this.toSnakeCase(propName));
            if (fieldType) return fieldType;

            // Check framework type fields for this.config, this.a, this.b, this.key, etc
            // Check all instance types since classes may inherit from any of them
            const instanceTypes = ['IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance', 'IAlgorithmInstance', 'IAEADInstance', 'IKDFInstance', 'ICompressionInstance', 'IMACInstance', 'IRandomInstance', 'IChecksumInstance', 'IECCInstance', 'IAsymmetricInstance', 'IClassicalInstance'];
            if (this.frameworkTypeFields) {
              for (const instanceType of instanceTypes) {
                const instanceFields = this.frameworkTypeFields.get(instanceType);
                if (instanceFields && instanceFields.has(propName)) {
                  return instanceFields.get(propName);
                }
              }
            }
          }

          // Handle nested member access like this.config.description
          // First get the type of the object being accessed
          const objType = this.inferExpressionType(node.object);
          if (objType && objType.name && this.frameworkTypeFields && this.frameworkTypeFields.has(objType.name)) {
            const typeFields = this.frameworkTypeFields.get(objType.name);
            if (typeFields.has(propName)) {
              return typeFields.get(propName);
            }
          }

          return CppType.Auto();
        }

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
          // Framework constructor-like function calls (TestCase, KeySize, LinkItem, etc.)
          if (node.callee.type === 'Identifier') {
            const funcName = node.callee.name;
            const frameworkTypes = ['TestCase', 'KeySize', 'LinkItem', 'Vulnerability', 'CountryCode'];
            if (frameworkTypes.includes(funcName)) {
              return new CppType(funcName);
            }
          }

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
                return objType.vectorElement || CppType.Byte();
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

        case 'ObjectExpression':
          // Object literals are config/dict structures - use DynamicConfig for framework
          return new CppType('DynamicConfig');

        case 'ThisExpression':
          if (this.currentClass) {
            return new CppType(this.currentClass.name);
          }
          return CppType.Auto();

        case 'ThisPropertyAccess': {
          // IL AST node for this.property access
          const ilPropName = node.property;

          // Check class fields first (fields are stored with snake_case)
          const classFieldType = this.classFieldTypes.get(this.toSnakeCase(ilPropName));
          if (classFieldType) return classFieldType;

          // Check framework type fields
          if (this.frameworkTypeFields) {
            const instanceFields = this.frameworkTypeFields.get('IAlgorithmInstance');
            if (instanceFields && instanceFields.has(ilPropName)) {
              return instanceFields.get(ilPropName);
            }
          }
          return CppType.Auto();
        }
      }

      return CppType.Auto();
    }

    /**
     * Transform JavaScript AST to C++ AST
     */
    transform(jsAst) {
      try {
        const unit = new CppCompilationUnit();
        this.targetFile = unit; // Store for dynamic include additions

        // Standard includes
        unit.includes.push(new CppIncludeDirective('cstdint', true));
        unit.includes.push(new CppIncludeDirective('vector', true));
        unit.includes.push(new CppIncludeDirective('array', true));
        unit.includes.push(new CppIncludeDirective('string', true));
        unit.includes.push(new CppIncludeDirective('string_view', true)); // For string literals to byte conversion
        unit.includes.push(new CppIncludeDirective('algorithm', true));
        unit.includes.push(new CppIncludeDirective('numeric', true)); // For std::accumulate
        unit.includes.push(new CppIncludeDirective('cstring', true));
        unit.includes.push(new CppIncludeDirective('cmath', true)); // For std::floor, std::ceil, etc.
        // Note: <bit> removed - using inline rotation formulas for C++17 compatibility
        unit.includes.push(new CppIncludeDirective('memory', true)); // For smart pointers
        unit.includes.push(new CppIncludeDirective('optional', true)); // For nullable values
        unit.includes.push(new CppIncludeDirective('map', true)); // For std::map dictionary pattern
        unit.includes.push(new CppIncludeDirective('stdexcept', true)); // For std::runtime_error

        // Create namespace
        const ns = new CppNamespace(this.options.namespace || 'generated');
        unit.namespaces.push(ns);

        // Create main class
        const mainClassName = this.sanitizeCppIdentifier(this.options.className || 'GeneratedClass');
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

      // If still void/auto, try to infer from method name
      if (returnType.name === 'void' || returnType.name === 'auto') {
        const nameInferredType = this.inferReturnTypeFromMethodName(methodName);
        if (nameInferredType) {
          returnType = nameInferredType;
        }
      }

      // Final check: Fix any remaining 'auto' types in return type (C++17 compatibility)
      returnType = this.fixAutoInReturnType(returnType, methodName);

      const method = new CppMethod(methodName, returnType);
      method.isStatic = true;

      // Transform parameters (handle default values - both AST formats)
      for (const param of node.params) {
        let paramId, defaultValue;
        if (param.type === 'AssignmentPattern') {
          paramId = param.left;
          defaultValue = this.transformExpression(param.right);
        } else if (param.defaultValue) {
          paramId = param;
          defaultValue = this.transformExpression(param.defaultValue);
        } else {
          paramId = param;
          defaultValue = null;
        }
        const paramName = this.toSnakeCase(paramId.name);
        const paramType = this.inferParameterTypeFromName(paramId.name, methodName);
        const cppParam = new CppParameter(paramName, paramType);
        if (defaultValue) {
          cppParam.defaultValue = defaultValue;
        }
        method.parameters.push(cppParam);
        this.registerVariableType(paramId.name, paramType);
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

      // If still auto, try to infer from method name (C++17 doesn't support auto in all contexts)
      if (returnType.name === 'auto') {
        const nameInferredType = this.inferReturnTypeFromMethodName(methodName);
        if (nameInferredType) {
          returnType = nameInferredType;
        }
      }

      // Final check: Fix any remaining 'auto' types in return type (C++17 compatibility)
      returnType = this.fixAutoInReturnType(returnType, methodName);

      const method = new CppMethod(methodName, returnType);
      method.isStatic = true;

      // Parameters with type inference
      for (const param of funcNode.params || []) {
        const paramName = param.name ? this.toSnakeCase(param.name) : 'param';
        const originalName = param.name || 'param';
        let paramType = paramTypes.get(originalName) || this.inferParameterTypeFromName(originalName, methodName);

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
        let baseClassName = node.superClass.name;
        // Handle AlgorithmFramework.TypeName pattern (also global.AlgorithmFramework.TypeName)
        if (!baseClassName && node.superClass.type === 'MemberExpression') {
          const propName = node.superClass.property?.name || node.superClass.property?.value;
          const objName = node.superClass.object?.name;
          // Direct: AlgorithmFramework.TypeName
          if (objName === 'AlgorithmFramework' && propName)
            baseClassName = propName;
          // Nested: global.AlgorithmFramework.TypeName (after IIFE unwrap, object is MemberExpression)
          else if (propName)
            baseClassName = propName;
        }
        baseClassName = baseClassName || 'Base';
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
              this.extractMethodFields(member, classNode);
              const getter = this.transformGetter(member);
              classNode.publicMembers.push(getter);
            } else if (member.kind === 'set') {
              // Setter method - extract fields since setters often initialize class fields
              this.extractMethodFields(member, classNode);
              const setter = this.transformSetter(member);
              classNode.publicMembers.push(setter);
            } else {
              // Extract fields from method bodies (e.g., properties assigned in setters)
              this.extractMethodFields(member, classNode);
              const method = this.transformMethodDefinition(member);
              classNode.publicMembers.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Class field
            const field = this.transformPropertyDefinition(member);
            classNode.publicMembers.push(field);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> static initialization (C++17 inline static variables)
            // Or add to a static initializer function
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              classNode.staticInitStatements = classNode.staticInitStatements || [];
              classNode.staticInitStatements.push(...initStatements);
            }
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

      // First, extract JSDoc parameter types from constructor
      const paramTypes = new Map();

      // Try parsed jsDoc first (already structured)
      const jsDoc = ctorNode.jsDoc || ctorNode.value?.jsDoc;
      if (jsDoc && jsDoc.params) {
        for (const param of jsDoc.params) {
          if (param.name && param.type) {
            // param.type is already parsed (e.g., {name: 'AdlerConfig'})
            const typeName = typeof param.type === 'string' ? param.type : (param.type.name || param.type);
            const paramType = this.mapType(typeName);
            paramTypes.set(param.name, paramType);
          }
        }
      }

      // Fallback: extract from raw leadingComments if no parsed jsDoc
      if (paramTypes.size === 0) {
        const comments = ctorNode.leadingComments || ctorNode.value?.leadingComments || [];
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

      // Also get parameter names for reference
      const paramNames = new Set();
      for (const param of ctorNode.value?.params || []) {
        const pName = param.type === 'AssignmentPattern' ? param.left?.name : param.name;
        if (pName) paramNames.add(pName);
      }

      for (const stmt of ctorNode.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = this.getThisPropertyName(expr.left);
          if (!propName) continue;
          const fieldName = this.toSnakeCase(propName);

          // Skip if already defined
          if (classNode.privateMembers.some(m => m.name === fieldName) ||
              classNode.publicMembers.some(m => m.name === fieldName))
            continue;

          let fieldType = null;

          // Check if RHS is a constructor parameter - use JSDoc type if available
          if (expr.right?.type === 'Identifier' && paramNames.has(expr.right.name)) {
            fieldType = paramTypes.get(expr.right.name);
          }

          // If not from parameter, infer from assignment value
          if (!fieldType) {
            fieldType = this.inferFieldTypeFromAssignment(propName, expr.right);
          }

          // C++ doesn't allow 'auto' for non-static class members
          // Fall back to concrete type based on field name
          if (!fieldType || fieldType.name === 'auto') {
            fieldType = this.inferFieldTypeFromName(propName);
          }

          const field = new CppField(fieldName, fieldType);

          // Register for later type lookups
          this.classFieldTypes.set(fieldName, fieldType);

          // Decide accessibility based on naming (underscore prefix = private)
          classNode.privateMembers.push(field);
        }
      }
    }

    /**
     * Extract fields from method body this.field = value assignments
     * Used for methods other than constructors (like setters) that initialize fields
     */
    extractMethodFields(methodNode, classNode) {
      const body = methodNode.value?.body?.body || methodNode.body?.body || [];
      this.extractFieldsFromStatements(body, classNode);
    }

    /**
     * Recursively extract fields from a list of statements
     * Handles nested blocks, if statements, etc.
     * Collects all assignments to infer best type from non-null assignments
     */
    extractFieldsFromStatements(statements, classNode) {
      if (!statements || !Array.isArray(statements)) return;

      // Collect all field assignments first
      const fieldAssignments = new Map(); // fieldName -> [valueNodes]
      this.collectFieldAssignments(statements, fieldAssignments);

      // Now create fields with best inferred types
      for (const [propName, valueNodes] of fieldAssignments) {
        const fieldName = this.toSnakeCase(propName);

        // Skip if already defined
        if (classNode.privateMembers.some(m => m.name === fieldName) ||
            classNode.publicMembers.some(m => m.name === fieldName))
          continue;

        // Find best type from all assignments (prefer non-null types)
        let fieldType = null;
        for (const valueNode of valueNodes) {
          // Skip null/nullptr assignments - they don't tell us the real type
          if (valueNode.type === 'Literal' && valueNode.value === null) continue;
          if (valueNode.type === 'Identifier' && valueNode.name === 'undefined') continue;

          const candidateType = this.inferFieldTypeFromAssignment(propName, valueNode);
          if (candidateType && candidateType.name !== 'auto') {
            fieldType = candidateType;
            break; // Found a good type, use it
          }
        }

        // Fall back to name-based inference if no good type found
        if (!fieldType || fieldType.name === 'auto')
          fieldType = this.inferFieldTypeFromName(propName);

        const field = new CppField(fieldName, fieldType);
        this.classFieldTypes.set(fieldName, fieldType);
        classNode.privateMembers.push(field);
      }
    }

    /**
     * Collect all this.field = value assignments from statements recursively
     */
    collectFieldAssignments(statements, fieldAssignments) {
      if (!statements || !Array.isArray(statements)) return;

      for (const stmt of statements) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = this.getThisPropertyName(expr.left);
          if (!propName) continue;

          if (!fieldAssignments.has(propName))
            fieldAssignments.set(propName, []);
          fieldAssignments.get(propName).push(expr.right);
        }

        // Recurse into nested blocks
        if (stmt.type === 'IfStatement') {
          this.collectFieldAssignments(stmt.consequent?.body || (stmt.consequent ? [stmt.consequent] : []), fieldAssignments);
          this.collectFieldAssignments(stmt.alternate?.body || (stmt.alternate ? [stmt.alternate] : []), fieldAssignments);
        } else if (stmt.type === 'BlockStatement') {
          this.collectFieldAssignments(stmt.body, fieldAssignments);
        } else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement' || stmt.type === 'DoWhileStatement') {
          this.collectFieldAssignments(stmt.body?.body || (stmt.body ? [stmt.body] : []), fieldAssignments);
        } else if (stmt.type === 'ForOfStatement' || stmt.type === 'ForInStatement') {
          this.collectFieldAssignments(stmt.body?.body || (stmt.body ? [stmt.body] : []), fieldAssignments);
        }
      }
    }

    /**
     * Check if statement is this.property = value
     * Handles both standard MemberExpression and IL AST ThisPropertyAccess nodes
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;

      // Handle IL AST ThisPropertyAccess node type
      if (expr.left.type === 'ThisPropertyAccess' || expr.left.ilNodeType === 'ThisPropertyAccess')
        return true;

      // Handle standard MemberExpression with ThisExpression
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Get property name from this.property assignment left-hand side
     */
    getThisPropertyName(leftNode) {
      // Handle IL AST ThisPropertyAccess node type
      if (leftNode.type === 'ThisPropertyAccess' || leftNode.ilNodeType === 'ThisPropertyAccess')
        return leftNode.property;

      // Handle standard MemberExpression
      if (leftNode.type === 'MemberExpression')
        return leftNode.property.name || leftNode.property.value;

      return null;
    }

    /**
     * Transform property definition (class field)
     */
    transformPropertyDefinition(node) {
      const keyName = node.key?.name || node.key?.value || 'field';
      const fieldName = this.toSnakeCase(keyName);
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
     * Transform static block to static initialization statements
     */
    transformStaticBlock(node) {
      // ES2022 static block -> C++ global namespace statements or static member initialization
      // C++ doesn't have static class blocks, so transform to statements that will be emitted
      // outside the class definition
      // node.body is a BlockStatement, so access its body property
      const statements = node.body?.body || node.body || [];
      if (Array.isArray(statements)) {
        return statements.map(stmt => this.transformStatement(stmt)).filter(s => s);
      }
      return [];
    }

    transformClassExpression(node) {
      // ClassExpression -> C++ uses lambdas or local struct
      // For simple cases, return a struct definition
      const className = node.id?.name || 'AnonymousClass';
      const classDecl = new CppClass(className);

      if (node.superClass) {
        let baseName = node.superClass.name;
        // Handle AlgorithmFramework.TypeName pattern
        if (!baseName && node.superClass.type === 'MemberExpression' &&
            node.superClass.object?.type === 'Identifier' &&
            node.superClass.object.name === 'AlgorithmFramework') {
          baseName = node.superClass.property.name || node.superClass.property.value;
        }
        baseName = baseName || 'Base';
        classDecl.bases.push({ name: baseName, access: 'public' });
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
      // C++20 has co_yield for coroutines - return argument for now
      const argument = node.argument ? this.transformExpression(node.argument) : CppLiteral.Nullptr();
      return argument;
    }

    /**
     * Transform getter method
     */
    transformGetter(node) {
      // Handle missing or malformed key
      const keyName = node.key?.name || node.key?.value || 'value';
      const methodName = `get_${this.toSnakeCase(keyName)}`;

      // Infer return type from getter name
      let returnType = this.inferReturnTypeFromMethodName(methodName);
      if (!returnType) {
        returnType = CppType.Auto();
      }
      // Fix any remaining auto types
      returnType = this.fixAutoInReturnType(returnType, methodName);

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
      // Handle missing or malformed key
      const keyName = node.key?.name || node.key?.value || 'value';
      const methodName = `set_${this.toSnakeCase(keyName)}`;

      const method = new CppMethod(methodName, CppType.Void());

      // Push scope early so parameter types can be registered
      this.pushScope();

      // Setter has one parameter (the value)
      if (node.value && node.value.params && node.value.params.length > 0) {
        const paramName = this.toSnakeCase(node.value.params[0].name);
        const paramType = this.inferParameterTypeFromName(paramName, methodName);
        method.parameters.push(new CppParameter(paramName, paramType));
        // Register the parameter type so body transformations can detect its type
        this.registerVariableType(paramName, paramType);
      }

      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      this.popScope();

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

      // Try parsed jsDoc first (already structured)
      const jsDoc = node.jsDoc || node.value?.jsDoc;
      if (jsDoc && jsDoc.params) {
        for (const param of jsDoc.params) {
          if (param.name && param.type) {
            const typeName = typeof param.type === 'string' ? param.type : (param.type.name || param.type);
            let paramType = this.mapType(typeName);
            // Handle Object type for algorithm parameters -> use Algorithm*
            if ((typeName === 'Object' || typeName === 'object') &&
                (param.name === 'algorithm' || param.name === 'algo')) {
              paramType = new CppType('Algorithm*');
            }
            paramTypes.set(param.name, paramType);
          }
        }
      }

      // Fallback: extract from raw leadingComments if no parsed jsDoc
      if (paramTypes.size === 0 && (node.leadingComments || node.value?.leadingComments)) {
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

      // Parameters (handle default values - both AssignmentPattern and param.defaultValue formats)
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          let paramId, defaultValue;

          // Handle parameters with default values
          // Format 1: AssignmentPattern (standard ESTree) {type: 'AssignmentPattern', left: id, right: default}
          // Format 2: Identifier with defaultValue property (custom parser)
          if (param.type === 'AssignmentPattern') {
            paramId = param.left;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            paramId = param;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramId = param;
            defaultValue = null;
          }

          const paramName = this.toSnakeCase(paramId.name);
          const originalName = paramId.name;

          // Infer type from default value if no explicit type from JSDoc
          let paramType = paramTypes.get(originalName);
          if (!paramType && defaultValue) {
            // Try to infer type from the default value
            paramType = this.inferExpressionType(defaultValue);
          }
          // Check if this parameter matches a known field type
          // (for constructor parameters that are directly assigned to fields)
          if (!paramType && this.classFieldTypes.has(paramName)) {
            paramType = this.classFieldTypes.get(paramName);
          }
          if (!paramType) {
            paramType = this.inferParameterTypeFromName(paramName);
          }

          // Register parameter type
          this.registerVariableType(originalName, paramType);

          const cppParam = new CppParameter(paramName, paramType);
          if (defaultValue) {
            cppParam.defaultValue = defaultValue;
          }
          ctor.parameters.push(cppParam);
        }
      }

      // Store constructor default parameters for later use in static member initialization
      // This helps with the C++ issue where default args can't be used before they're defined
      const defaultParams = ctor.parameters
        .filter(p => p.defaultValue)
        .map(p => p.defaultValue);
      if (defaultParams.length > 0) {
        this.constructorDefaultParams.set(className, defaultParams);
      }

      // Transform body, extracting ParentConstructorCall for initializer list
      if (node.value && node.value.body && node.value.body.body) {
        const bodyStatements = [];

        for (const stmt of node.value.body.body) {
          // Check for ParentConstructorCall (super() in constructor)
          const isParentCtorCall = stmt.type === 'ExpressionStatement' &&
              stmt.expression?.type === 'ParentConstructorCall';

          // Also handle original super() CallExpression
          const callee = stmt.expression?.callee;
          const isSuperCall = stmt.type === 'ExpressionStatement' &&
              stmt.expression?.type === 'CallExpression' &&
              (callee?.type === 'Super' || (callee?.type === 'Identifier' && callee?.name === 'super'));

          if (isParentCtorCall) {
            // Add to initializer list: BaseClass(args)
            const parentClass = stmt.expression.parentClass || 'Base';
            const args = (stmt.expression.arguments || []).map(arg => this.transformExpression(arg));
            // For initializer list, use parentClass as member and create function call args
            ctor.initializerList.push({
              member: this.toPascalCase(parentClass),
              value: args.length > 0 ? args[0] : new CppIdentifier('')
            });
            continue; // Don't add to body
          }

          if (isSuperCall) {
            // Handle original super() call
            const args = (stmt.expression.arguments || []).map(arg => this.transformExpression(arg));
            ctor.initializerList.push({
              member: 'Base',
              value: args.length > 0 ? args[0] : new CppIdentifier('')
            });
            continue; // Don't add to body
          }

          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              bodyStatements.push(...transformed);
            } else {
              bodyStatements.push(transformed);
            }
          }
        }

        ctor.body = new CppBlock();
        ctor.body.statements = bodyStatements;
      } else if (node.value && node.value.body) {
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
      const keyName = node.key?.name || node.key?.value || 'method';
      const methodName = this.toSnakeCase(keyName);

      // Check if this method overrides a base class virtual method
      let baseMethodInfo = null;
      if (this.currentClass && this.currentClass.baseClasses) {
        for (const baseClass of this.currentClass.baseClasses) {
          const baseClassName = baseClass.toString ? baseClass.toString() : baseClass;
          const baseMethods = this.baseClassMethods.get(baseClassName);
          if (baseMethods && baseMethods.has(methodName)) {
            baseMethodInfo = baseMethods.get(methodName);
            break;
          }
        }
      }

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
      // For crypto methods (encrypt/decrypt/hash/process/words), prefer name-based inference
      // Body inference can return wrong types due to local variable analysis
      const lowerMethodName = methodName.toLowerCase();
      const isCryptoMethod = lowerMethodName.includes('encrypt') || lowerMethodName.includes('decrypt') ||
                              lowerMethodName.includes('hash') || lowerMethodName.includes('process') ||
                              lowerMethodName.includes('digest') || lowerMethodName.includes('transform') ||
                              lowerMethodName.includes('words') || lowerMethodName.includes('_words');

      if (isCryptoMethod && returnType.name === 'auto') {
        const nameInferredType = this.inferReturnTypeFromMethodName(methodName);
        if (nameInferredType) {
          returnType = nameInferredType;
        }
      }

      // If still auto/void, try to infer from body return statements (for non-crypto methods)
      if ((returnType.name === 'auto' || returnType.name === 'void') && node.value && node.value.body) {
        const inferredType = this.inferReturnTypeFromBody(node.value.body);
        if (inferredType)
          returnType = inferredType;
      }

      // If still auto, try to infer from method name (C++17 doesn't support auto in all contexts)
      if (returnType.name === 'auto') {
        const nameInferredType = this.inferReturnTypeFromMethodName(methodName);
        if (nameInferredType) {
          returnType = nameInferredType;
        }
      }

      // CRITICAL: If overriding a base class method, use the base class return type
      if (baseMethodInfo && baseMethodInfo.returnType) {
        returnType = baseMethodInfo.returnType;
      }

      // Final check: Fix any remaining 'auto' types in return type (C++17 compatibility)
      returnType = this.fixAutoInReturnType(returnType, methodName);

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

      // Parameters with type extraction - use base class types if overriding
      if (node.value && node.value.params) {
        for (let i = 0; i < node.value.params.length; ++i) {
          const param = node.value.params[i];

          // Handle default values (both AST formats)
          let paramId, defaultValue;
          if (param.type === 'AssignmentPattern') {
            paramId = param.left;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            paramId = param;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramId = param;
            defaultValue = null;
          }

          const paramName = this.toSnakeCase(paramId.name);
          const originalName = paramId.name;

          // Use base class parameter type if available, otherwise infer from name
          let paramType = paramTypes.get(originalName) || this.inferParameterTypeFromName(paramName, methodName);
          if (baseMethodInfo && baseMethodInfo.paramTypes && baseMethodInfo.paramTypes[i]) {
            paramType = baseMethodInfo.paramTypes[i];
          }

          // Register parameter type
          this.registerVariableType(originalName, paramType);

          const cppParam = new CppParameter(paramName, paramType);
          if (defaultValue) {
            cppParam.defaultValue = defaultValue;
          }
          method.parameters.push(cppParam);
        }
      }

      // Body - track current method name and return type for special return handling
      const prevMethodName = this.currentMethodName;
      const prevMethodReturnType = this.currentMethodReturnType;
      this.currentMethodName = methodName;
      this.currentMethodReturnType = returnType;

      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      } else {
        // Ensure method has a body even if empty
        method.body = new CppBlock();
      }

      // Restore previous method name and return type
      this.currentMethodName = prevMethodName;
      this.currentMethodReturnType = prevMethodReturnType;

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
        case 'ReturnStatement': {
          // If we're at module level (not inside a function/method), skip return
          // This handles UMD pattern's final return statement
          if (!this.currentMethod && !this.currentClass) {
            // At module level, skip return statements from UMD wrapper
            return null;
          }

          if (!node.argument) {
            return new CppReturn(null);
          }

          let returnExpr;

          // Special handling for array expressions in return statements
          // Use the method's return type to determine the array element type
          // BUT: if the array contains SpreadElements (e.g., [...arr1, ...arr2]),
          // let normal transformArrayExpression handle it for concat_arrays generation
          if (node.argument.type === 'ArrayExpression' && this.currentMethodReturnType &&
              this.currentMethodReturnType.isVector && this.currentMethodReturnType.vectorElement) {
            // Check for SpreadElements - these need concat_arrays, not direct array creation
            const hasSpreadElements = node.argument.elements.some(elem => elem && elem.type === 'SpreadElement');
            if (!hasSpreadElements) {
              // Create array with the correct element type from the method's return type
              const elements = node.argument.elements.filter(e => e).map(elem => this.transformExpression(elem));
              returnExpr = new CppArrayCreation(this.currentMethodReturnType.vectorElement, null, elements);
            } else {
              // Let transformArrayExpression handle spread elements with concat_arrays
              returnExpr = this.transformExpression(node.argument);
            }
          } else {
            returnExpr = this.transformExpression(node.argument);
          }

          // Check if we're in create_instance method and returning an object instance
          // Need to wrap with new and cast to void*
          if (this.currentMethodName && this.currentMethodName.toLowerCase().includes('createinstance') ||
              this.currentMethodName === 'create_instance') {
            // Check if return expression is an object creation (not null)
            if (returnExpr && returnExpr.nodeType === 'ObjectCreation') {
              // Wrap: new ClassName(args) -> std::make_optional(static_cast<void*>(new ClassName(args)))
              const newExpr = new CppUnaryExpression('new', returnExpr, true);
              const voidCast = new CppCast(new CppType('void*'), newExpr, 'static');
              returnExpr = new CppFunctionCall(null, 'std::make_optional', [voidCast]);
            }
          }

          return new CppReturn(returnExpr);
        }
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
        let varType, initializer;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);

          // Check if initializer is a map (CppMapInitializer)
          if (initializer && initializer.nodeType === 'MapInitializer') {
            // Use std::map<std::string, DynamicConfig> for config dictionaries
            varType = new CppType('std::map<std::string, DynamicConfig>');
          } else {
            // Check for variable name patterns that imply specific types
            const lowerVarName = decl.id.name.toLowerCase();
            const currentMethodName = this.currentMethodName || '';
            const isWordContext = currentMethodName.toLowerCase().includes('words');

            if (lowerVarName === 'words' || lowerVarName.includes('_words') || lowerVarName.endsWith('words')) {
              // Variables named 'words' store 32-bit packed values
              varType = CppType.Vector(CppType.UInt());
            } else if (lowerVarName === 'key_words' || lowerVarName === 'keywords') {
              // Key words are also 32-bit arrays
              varType = CppType.Vector(CppType.UInt());
            } else if (isWordContext && (lowerVarName === 'z' || lowerVarName === 'y')) {
              // In word methods, z and y are 32-bit word values
              varType = CppType.UInt();
            } else {
              varType = this.inferExpressionType(decl.init);
            }
          }
        } else {
          // No initializer - can't use auto in C++, need concrete type
          // Infer type from variable name for common patterns
          const lowerName = decl.id.name.toLowerCase();
          if (lowerName === 'result' || lowerName === 'output' || lowerName.includes('buffer')) {
            varType = CppType.Vector(CppType.Byte());
            initializer = new CppInitializerList([]);  // Initialize to empty vector
          } else {
            varType = CppType.UInt();
            initializer = CppLiteral.UInt(0);  // Initialize to 0
          }
        }

        const varDecl = new CppVariableDeclaration(varName, varType, initializer);

        // Don't mark vectors as const if they're initialized empty - they'll likely be mutated
        // Also don't mark vectors named 'output', 'result', 'buffer' as const since they accumulate data
        const isEmptyVector = this.isVectorType(varType) &&
          initializer && (
            (initializer.nodeType === 'InitializerList' && (!initializer.elements || initializer.elements.length === 0)) ||
            (initializer.nodeType === 'ArrayCreation')
          );
        const isMutableVectorName = ['output', 'result', 'buffer', 'processed_block', 'words'].includes(varName);
        varDecl.isConst = node.kind === 'const' && !isEmptyVector && !(this.isVectorType(varType) && isMutableVectorName);

        this.registerVariableType(decl.id.name, varType);
        result.push(varDecl);
      }

      return result;
    }

    /**
     * Transform if statement
     */
    transformIfStatement(node) {
      // Handle vector in boolean context: if (vector) -> if (!vector.empty())
      let condition;
      if (this.isVectorExpression(node.test)) {
        const vectorExpr = this.transformExpression(node.test);
        const emptyCall = new CppFunctionCall(vectorExpr, 'empty', []);
        condition = new CppUnaryExpression('!', emptyCall, true);
      } else {
        condition = this.transformExpression(node.test);
      }
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
        case 'ArrayLiteral':
          return this.transformArrayExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'ThisExpression':
          return new CppThis();
        case 'ObjectExpression':
        case 'ObjectLiteral':
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
          // Object destructuring - C++ doesn't support this directly (requires structured bindings in C++17)
          // Return a comment placeholder
          return new CppIdentifier('/* Object destructuring not supported in C++ */');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ClassExpression':
          // Anonymous class expression - C++ uses lambdas/struct literals
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - C++ doesn't have generators directly
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> C++ private member with m_ prefix convention
          return new CppIdentifier('m_' + this.toSnakeCase(node.name));

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

        case 'ArrayMap':
          return this.transformArrayMap(node);

        case 'ArraySome':
          return this.transformArraySome(node);

        case 'ArrayForEach':
          return this.transformArrayForEach(node);

        case 'ArrayFilter':
          return this.transformArrayFilter(node);

        case 'ArrayEvery':
          return this.transformArrayEvery(node);

        case 'ArrayReduce':
          return this.transformArrayReduce(node);

        case 'ArraySplice':
          return this.transformArraySplice(node);

        case 'ArrayCreation':
          return this.transformArrayCreationNode(node);

        case 'TypedArrayCreation':
          return this.transformTypedArrayCreation(node);

        case 'ByteBufferView':
          return this.transformByteBufferView(node);

        case 'BufferCreation': {
          // ArrayBuffer/Buffer creation → std::vector<uint8_t>(size)
          const sizeExpr = node.size ? this.transformExpression(node.size) : CppLiteral.Int(0);
          return new CppObjectCreation(
            new CppType('std::vector', [new CppType('uint8_t')]),
            [sizeExpr]
          );
        }

        case 'DataViewCreation': {
          // DataView creation - in C++ we just use the underlying buffer directly
          // The DataView is just a wrapper for typed access to bytes
          return this.transformExpression(node.buffer);
        }

        case 'DataViewGet': {
          // DataView.getUint32, getInt16, etc → cast/read from buffer
          const bufferExpr = this.transformExpression(node.dataView);
          const offsetExpr = this.transformExpression(node.offset);
          const typeMap = {
            'getUint8': 'uint8_t', 'getInt8': 'int8_t',
            'getUint16': 'uint16_t', 'getInt16': 'int16_t',
            'getUint32': 'uint32_t', 'getInt32': 'int32_t',
            'getFloat32': 'float', 'getFloat64': 'double',
            'getBigUint64': 'uint64_t', 'getBigInt64': 'int64_t'
          };
          const cppType = typeMap[node.method] || 'uint32_t';
          // Return pointer cast: *reinterpret_cast<type*>(&buffer[offset])
          return new CppUnaryExpression('*',
            new CppCast(
              new CppType(cppType + '*'),
              new CppUnaryExpression('&', new CppElementAccess(bufferExpr, offsetExpr)),
              'reinterpret_cast'
            )
          );
        }

        case 'DataViewSet': {
          // DataView.setUint32, setInt16, etc → cast/write to buffer
          const bufferExpr = this.transformExpression(node.dataView);
          const offsetExpr = this.transformExpression(node.offset);
          const valueExpr = this.transformExpression(node.value);
          const typeMap = {
            'setUint8': 'uint8_t', 'setInt8': 'int8_t',
            'setUint16': 'uint16_t', 'setInt16': 'int16_t',
            'setUint32': 'uint32_t', 'setInt32': 'int32_t',
            'setFloat32': 'float', 'setFloat64': 'double',
            'setBigUint64': 'uint64_t', 'setBigInt64': 'int64_t'
          };
          const cppType = typeMap[node.method] || 'uint32_t';
          // *reinterpret_cast<type*>(&buffer[offset]) = value
          return new CppAssignment(
            new CppUnaryExpression('*',
              new CppCast(
                new CppType(cppType + '*'),
                new CppUnaryExpression('&', new CppElementAccess(bufferExpr, offsetExpr)),
                'reinterpret_cast'
              )
            ),
            '=',
            valueExpr
          );
        }

        case 'HexDecode':
          return this.transformHexDecode(node);

        case 'HexEncode':
          return this.transformHexEncode(node);

        case 'StringToBytes':
          return this.transformStringToBytes(node);

        case 'BytesToString':
          return this.transformBytesToString(node);

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
          return new CppFunctionCall(null, 'std::sqrt', [this.transformExpression(node.argument)]);

        case 'Log':
          return new CppFunctionCall(null, 'std::log', [this.transformExpression(node.argument)]);

        case 'Log2':
          return new CppFunctionCall(null, 'std::log2', [this.transformExpression(node.argument)]);

        case 'Log10':
          return new CppFunctionCall(null, 'std::log10', [this.transformExpression(node.argument)]);

        case 'Sin':
          return new CppFunctionCall(null, 'std::sin', [this.transformExpression(node.argument)]);

        case 'Cos':
          return new CppFunctionCall(null, 'std::cos', [this.transformExpression(node.argument)]);

        case 'Tan':
          return new CppFunctionCall(null, 'std::tan', [this.transformExpression(node.argument)]);

        case 'Asin':
          return new CppFunctionCall(null, 'std::asin', [this.transformExpression(node.argument)]);

        case 'Acos':
          return new CppFunctionCall(null, 'std::acos', [this.transformExpression(node.argument)]);

        case 'Atan':
          return new CppFunctionCall(null, 'std::atan', [this.transformExpression(node.argument)]);

        case 'Atan2':
          return new CppFunctionCall(null, 'std::atan2', [this.transformExpression(node.arguments[0]), this.transformExpression(node.arguments[1])]);

        case 'Sinh':
          return new CppFunctionCall(null, 'std::sinh', [this.transformExpression(node.argument)]);

        case 'Cosh':
          return new CppFunctionCall(null, 'std::cosh', [this.transformExpression(node.argument)]);

        case 'Tanh':
          return new CppFunctionCall(null, 'std::tanh', [this.transformExpression(node.argument)]);

        case 'Exp':
          return new CppFunctionCall(null, 'std::exp', [this.transformExpression(node.argument)]);

        case 'Cbrt':
          return new CppFunctionCall(null, 'std::cbrt', [this.transformExpression(node.argument)]);

        case 'Hypot':
          return new CppFunctionCall(null, 'std::hypot', [this.transformExpression(node.arguments[0]), this.transformExpression(node.arguments[1])]);

        case 'Fround':
          return new CppCast('float', this.transformExpression(node.argument));

        case 'MathConstant': {
          const mathConstMap = {
            'PI': 'M_PI', 'E': 'M_E', 'LN2': 'M_LN2', 'LN10': 'M_LN10',
            'LOG2E': 'M_LOG2E', 'LOG10E': 'M_LOG10E', 'SQRT2': 'M_SQRT2', 'SQRT1_2': 'M_SQRT1_2'
          };
          return new CppIdentifier(mathConstMap[node.name] || String(node.value));
        }

        case 'NumberConstant': {
          switch (node.name) {
            case 'MAX_SAFE_INTEGER':
              return new CppIdentifier('std::numeric_limits<long long>::max()');
            case 'MIN_SAFE_INTEGER':
              return new CppIdentifier('std::numeric_limits<long long>::min()');
            case 'MAX_VALUE':
              return new CppIdentifier('std::numeric_limits<double>::max()');
            case 'MIN_VALUE':
              return new CppIdentifier('std::numeric_limits<double>::min()');
            case 'EPSILON':
              return new CppIdentifier('std::numeric_limits<double>::epsilon()');
            case 'POSITIVE_INFINITY':
              return new CppIdentifier('std::numeric_limits<double>::infinity()');
            case 'NEGATIVE_INFINITY':
              return new CppIdentifier('-std::numeric_limits<double>::infinity()');
            case 'NaN':
              return new CppIdentifier('std::numeric_limits<double>::quiet_NaN()');
            default:
              return CppLiteral.Double(node.value);
          }
        }

        case 'InstanceOfCheck': {
          const instValue = this.transformExpression(node.value);
          const instClassName = typeof node.className === 'string' ? node.className : (node.className.name || node.className.value || 'void');
          return new CppIdentifier(`dynamic_cast<${instClassName}*>(&${instValue}) != nullptr`);
        }

        case 'Random':
          return this.transformRandom(node);

        case 'Imul':
          return this.transformImul(node);

        case 'Clz32':
          return this.transformClz32(node);

        case 'Cast':
          return this.transformCastNode(node);

        case 'DestructuringAssignment':
          return this.transformDestructuringAssignment(node);

        // IL AST Error node
        case 'ErrorCreation': {
          const exceptionType = node.errorType === 'TypeError' ? 'std::invalid_argument' :
                                node.errorType === 'RangeError' ? 'std::out_of_range' :
                                'std::runtime_error';
          return new CppObjectCreation(
            new CppType(exceptionType),
            [node.message ? this.transformExpression(node.message) : CppLiteral.String('')]
          );
        }

        // Fallback for unknown OpCodes methods
        case 'OpCodesCall': {
          const args = node.arguments.map(a => this.transformExpression(a));
          // Handle specific OpCodes methods that need special C++ translation
          switch (node.method) {
            case 'CopyArray':
              // In C++, vectors have copy semantics, just return the expression
              return args[0];
            case 'ClearArray':
              // vector.clear() in C++
              return new CppFunctionCall(args[0], 'clear', []);
            default:
              // Generic fallback - call method as static helper
              return new CppFunctionCall(null, this.toSnakeCase(node.method), args);
          }
        }

        case 'StringTransform': {
          // Handle string method transformations like toUpperCase, toLowerCase, trim
          const stringExpr = this.transformExpression(node.string);
          switch (node.method) {
            case 'toUpperCase':
              // C++: std::transform with ::toupper, or use a helper function
              return new CppFunctionCall(null, 'to_upper_case', [stringExpr]);
            case 'toLowerCase':
              return new CppFunctionCall(null, 'to_lower_case', [stringExpr]);
            case 'trim':
              return new CppFunctionCall(null, 'trim', [stringExpr]);
            case 'trimStart':
            case 'trimLeft':
              return new CppFunctionCall(null, 'trim_left', [stringExpr]);
            case 'trimEnd':
            case 'trimRight':
              return new CppFunctionCall(null, 'trim_right', [stringExpr]);
            default:
              // Generic string method call
              return new CppFunctionCall(stringExpr, this.toSnakeCase(node.method), []);
          }
        }

        case 'ArraySort': {
          // Handle array sort - std::sort in C++
          const arrayExpr = this.transformExpression(node.array);
          if (node.compareFn) {
            // Custom comparator
            const compareFn = this.transformExpression(node.compareFn);
            return new CppFunctionCall(null, 'std::sort', [
              new CppFunctionCall(arrayExpr, 'begin', []),
              new CppFunctionCall(arrayExpr, 'end', []),
              compareFn
            ]);
          } else {
            // Default sort
            return new CppFunctionCall(null, 'std::sort', [
              new CppFunctionCall(arrayExpr, 'begin', []),
              new CppFunctionCall(arrayExpr, 'end', [])
            ]);
          }
        }

        case 'BigIntCast': {
          // Cast to uint64_t for BigInt emulation in C++
          const arg = this.transformExpression(node.argument);
          return new CppCast(new CppType('uint64_t'), arg);
        }

        case 'TypedArraySet': {
          // TypedArray.set(source, offset) → std::copy or memcpy
          const arrayExpr = this.transformExpression(node.array);
          const sourceExpr = this.transformExpression(node.source);
          const offsetExpr = node.offset ? this.transformExpression(node.offset) : CppLiteral.Int(0);
          // Use std::copy: std::copy(src.begin(), src.end(), dst.begin() + offset)
          return new CppFunctionCall(null, 'std::copy', [
            new CppFunctionCall(sourceExpr, 'begin', []),
            new CppFunctionCall(sourceExpr, 'end', []),
            new CppBinaryExpression(
              new CppFunctionCall(arrayExpr, 'begin', []),
              '+',
              offsetExpr
            )
          ]);
        }

        // IL AST StringInterpolation - `Hello ${name}` -> string concatenation (C++17 safe)
        case 'StringInterpolation': {
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                const val = part.value || '';
                if (val) parts.push(CppLiteral.String(val));
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                const expr = this.transformExpression(part.expression);
                parts.push(new CppFunctionCall(null, 'std::to_string', [expr]));
              }
            }
          } else if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              const raw = node.quasis[i] || '';
              if (raw) parts.push(CppLiteral.String(raw));
              if (i < node.expressions.length) {
                const expr = this.transformExpression(node.expressions[i]);
                parts.push(new CppFunctionCall(null, 'std::to_string', [expr]));
              }
            }
          }
          if (parts.length === 0) return CppLiteral.String('');
          if (parts.length === 1) return parts[0];
          let result = parts[0];
          for (let i = 1; i < parts.length; ++i)
            result = new CppBinaryExpression(result, '+', parts[i]);
          return result;
        }

        // IL AST ObjectLiteral - {key: value} -> struct initializer or std::map
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new CppFunctionCall(null, 'std::map<std::string, std::string>', []);

          // For simple objects, generate initializer list
          const inits = [];
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') continue;
            const key = prop.key?.name || prop.key?.value || prop.key || 'key';
            const value = this.transformExpression(prop.value);
            inits.push(new CppIdentifier(`{"${key}", ${value ? this._nodeToCode(value) : 'nullptr'}}`));
          }
          return new CppIdentifier(`{${inits.map(i => this._nodeToCode(i)).join(', ')}}`);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> std::string(1, char)
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return CppLiteral.String('');
          if (args.length === 1) {
            // Single char: std::string(1, static_cast<char>(code))
            return new CppFunctionCall(null, 'std::string', [
              CppLiteral.Int(1),
              new CppFunctionCall(null, 'static_cast<char>', args)
            ]);
          }
          // Multiple chars: string from char array
          const charCasts = args.map(a => new CppFunctionCall(null, 'static_cast<char>', [a]));
          return new CppIdentifier(`std::string({${charCasts.map(c => this._nodeToCode(c)).join(', ')}})`);
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> check if pointer is not null
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new CppBinaryExpression(value, '!=', new CppIdentifier('nullptr'));
        }

        // IL AST ArrowFunction - (x) => expr -> lambda [](auto x) { return expr; }
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return `auto ${name}`;
          }).join(', ');
          let bodyCode;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              const stmts = this.transformBlockStatement(node.body);
              bodyCode = stmts ? this._nodeToCode(stmts) : '{}';
            } else {
              const expr = this.transformExpression(node.body);
              bodyCode = `{ return ${expr ? this._nodeToCode(expr) : '0'}; }`;
            }
          } else {
            bodyCode = '{}';
          }
          return new CppIdentifier(`[](${params}) ${bodyCode}`);
        }

        // IL AST TypeOfExpression - typeof x -> typeid(x).name()
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new CppIdentifier(`typeid(${value ? this._nodeToCode(value) : 'void'}).name()`);
        }

        // IL AST Power - x ** y -> std::pow(x, y)
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new CppFunctionCall(null, 'std::pow', [left, right]);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in C++)
        case 'ObjectFreeze': {
          return this.transformExpression(node.value);
        }

        // IL AST ArrayFrom - Array.from(x) -> std::vector(x.begin(), x.end())
        case 'ArrayFrom': {
          const iterable = this.transformExpression(node.iterable);
          if (node.mapFunction) {
            // Array.from(arr, fn) -> transform with std::transform
            const mapFn = this.transformExpression(node.mapFunction);
            return new CppIdentifier(`std::vector<uint8_t>([&]() { auto v = ${iterable}; std::transform(v.begin(), v.end(), v.begin(), ${mapFn}); return v; }())`);
          }
          return new CppIdentifier(`std::vector<uint8_t>(${iterable}.begin(), ${iterable}.end())`);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> write to buffer
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;

          if (method === 'setUint8')
            return new CppAssignment(new CppElementAccess(view, offset), '=', value);

          // Use memcpy for larger types
          const size = method.includes('32') ? 4 : method.includes('16') ? 2 : 1;
          return new CppIdentifier(`std::memcpy(&${view}[${offset}], &${value}, ${size})`);
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> read from buffer
        case 'DataViewRead': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const method = node.method;

          if (method === 'getUint8')
            return new CppElementAccess(view, offset);

          // Use reinterpret_cast for larger types
          const cppType = method.includes('Uint32') || method.includes('uint32') ? 'uint32_t' :
                          method.includes('Uint16') || method.includes('uint16') ? 'uint16_t' :
                          method.includes('Int32') || method.includes('int32') ? 'int32_t' :
                          method.includes('Int16') || method.includes('int16') ? 'int16_t' : 'uint8_t';
          return new CppIdentifier(`*reinterpret_cast<${cppType}*>(&${view}[${offset}])`);
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> static_cast<uint8_t>(str[i])
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new CppIdentifier(`static_cast<uint8_t>(${str}[${index}])`);
        }

        // IL AST StringReplace - str.replace(search, replace) -> use std::regex_replace or custom
        case 'StringReplace': {
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue);
          const replace = this.transformExpression(node.replaceValue);
          return new CppIdentifier(`std::regex_replace(${str}, std::regex(${search}), ${replace})`);
        }

        // IL AST BufferCreation - new ArrayBuffer(n) -> std::vector<uint8_t>(n)
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new CppIdentifier(`std::vector<uint8_t>(${size}, 0)`);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods
        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          if (method === 'imul') {
            // Math.imul(a, b) -> static_cast<int32_t>(static_cast<int64_t>(a) * b)
            if (args.length >= 2)
              return new CppIdentifier(`static_cast<int32_t>(static_cast<int64_t>(${args[0]}) * ${args[1]})`);
          }
          // Default: use std::
          return new CppIdentifier(`std::${method}(${args.join(', ')})`);
        }

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> span or iterator range
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const end = node.end ? this.transformExpression(node.end) : null;

          if (end)
            return new CppIdentifier(`std::span(${array}.begin() + ${start}, ${array}.begin() + ${end})`);
          return new CppIdentifier(`std::span(${array}.begin() + ${start}, ${array}.end())`);
        }

        // IL AST ArrayFind - array.find(pred) -> *std::find_if(...)
        case 'ArrayFind': {
          const array = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new CppFunctionCall(null, 'std::find_if', [
              new CppFunctionCall(array, 'begin', []),
              new CppFunctionCall(array, 'end', []),
              fn
            ]);
          }
          return new CppIdentifier('nullptr');
        }

        // IL AST ArrayFindIndex - array.findIndex(pred) -> std::distance(begin, std::find_if(...))
        case 'ArrayFindIndex': {
          const array = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            const fn = this.transformExpression(callback);
            return new CppFunctionCall(null, 'std::distance', [
              new CppFunctionCall(array, 'begin', []),
              new CppFunctionCall(null, 'std::find_if', [
                new CppFunctionCall(array, 'begin', []),
                new CppFunctionCall(array, 'end', []),
                fn
              ])
            ]);
          }
          return CppLiteral.Int(-1);
        }

        // IL AST ArrayUnshift - array.unshift(element) -> vec.insert(vec.begin(), element)
        case 'ArrayUnshift': {
          const array = this.transformExpression(node.array);
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return array;
          return new CppFunctionCall(array, 'insert', [
            new CppFunctionCall(array, 'begin', []),
            ...args
          ]);
        }

        // IL AST StringCharAt - str.charAt(i) -> str[index] or str.at(index)
        case 'StringCharAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new CppElementAccess(str, index);
        }

        // IL AST StringEndsWith - str.endsWith(suffix) -> str.ends_with(suffix) (C++20) or manual
        case 'StringEndsWith': {
          const str = this.transformExpression(node.string || node.object);
          const suffix = this.transformExpression(node.suffix || node.search);
          // Use C++20 ends_with or helper function
          return new CppFunctionCall(str, 'ends_with', [suffix]);
        }

        // IL AST StringIncludes - str.includes(sub) -> str.find(sub) != std::string::npos
        case 'StringIncludes': {
          const str = this.transformExpression(node.string || node.object);
          const substr = this.transformExpression(node.substring || node.search);
          return new CppBinaryExpression(
            new CppFunctionCall(str, 'find', [substr]),
            '!=',
            new CppIdentifier('std::string::npos')
          );
        }

        // IL AST StringIndexOf - str.indexOf(sub) -> str.find(sub) (returns npos if not found)
        case 'StringIndexOf': {
          const str = this.transformExpression(node.string || node.object);
          const substr = this.transformExpression(node.substring || node.search);
          return new CppFunctionCall(str, 'find', [substr]);
        }

        // IL AST StringRepeat - str.repeat(count) -> custom loop-based repeat
        case 'StringRepeat': {
          const str = this.transformExpression(node.string);
          const count = node.count ? this.transformExpression(node.count) : CppLiteral.Int(1);
          return new CppFunctionCall(null, 'string_repeat', [str, count]);
        }

        // IL AST StringSplit - str.split(delim) -> custom split function
        case 'StringSplit': {
          const str = this.transformExpression(node.string || node.object);
          const separator = node.separator ? this.transformExpression(node.separator) : CppLiteral.String("");
          return new CppFunctionCall(null, 'string_split', [str, separator]);
        }

        // IL AST StringStartsWith - str.startsWith(prefix) -> str.starts_with(prefix) (C++20)
        case 'StringStartsWith': {
          const str = this.transformExpression(node.string || node.object);
          const prefix = this.transformExpression(node.prefix || node.search);
          return new CppFunctionCall(str, 'starts_with', [prefix]);
        }

        // IL AST StringSubstring - str.substring(start, length) -> str.substr(start, length)
        case 'StringSubstring': {
          const str = this.transformExpression(node.string || node.object);
          const start = node.start ? this.transformExpression(node.start) : CppLiteral.Int(0);
          if (node.end) {
            const end = this.transformExpression(node.end);
            // substr(start, end - start) since JS substring uses start/end, C++ uses start/length
            return new CppFunctionCall(str, 'substr', [
              start,
              new CppBinaryExpression(end, '-', start)
            ]);
          }
          return new CppFunctionCall(str, 'substr', [start]);
        }

        // IL AST StringToLowerCase - str.toLowerCase() -> std::transform with ::tolower
        case 'StringToLowerCase': {
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new CppFunctionCall(null, 'to_lower_case', [str]);
        }

        // IL AST StringToUpperCase - str.toUpperCase() -> std::transform with ::toupper
        case 'StringToUpperCase': {
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new CppFunctionCall(null, 'to_upper_case', [str]);
        }

        // IL AST StringTrim - str.trim() -> custom trim function
        case 'StringTrim': {
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new CppFunctionCall(null, 'trim', [str]);
        }

        // IL AST MapCreation - new Map() -> std::unordered_map<K, V>
        case 'MapCreation': {
          if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
            const pairs = node.entries.elements.map(entry => {
              if (entry.elements && entry.elements.length >= 2) {
                const key = this.transformExpression(entry.elements[0]);
                const value = this.transformExpression(entry.elements[1]);
                return `{${key}, ${value}}`;
              }
              return null;
            }).filter(p => p !== null);
            return new CppIdentifier(`std::unordered_map<std::string, int>{${pairs.join(', ')}}`);
          }
          return new CppIdentifier('std::unordered_map<std::string, int>{}');
        }

        // IL AST MapGet - map.get(key) -> m[key] or m.at(key)
        case 'MapGet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new CppElementAccess(map, key);
        }

        // IL AST MapSet - map.set(key, value) -> m[key] = value
        case 'MapSet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new CppAssignment(
            new CppElementAccess(map, key),
            '=',
            value
          );
        }

        // IL AST MapHas - map.has(key) -> m.count(key) > 0
        case 'MapHas': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new CppBinaryExpression(
            new CppFunctionCall(map, 'count', [key]),
            '>',
            CppLiteral.Int(0)
          );
        }

        // IL AST MapDelete - map.delete(key) -> m.erase(key)
        case 'MapDelete': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new CppFunctionCall(map, 'erase', [key]);
        }

        // IL AST SetCreation - new Set() -> std::unordered_set<T>
        case 'SetCreation': {
          if (node.values) {
            const values = this.transformExpression(node.values);
            return new CppIdentifier(`std::unordered_set<int>(${values}.begin(), ${values}.end())`);
          }
          return new CppIdentifier('std::unordered_set<int>{}');
        }

        // IL AST ObjectKeys - Object.keys(obj) -> iterate map, collect keys into vector
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new CppFunctionCall(null, 'get_keys', [obj]);
        }

        // IL AST ObjectValues - Object.values(obj) -> iterate map, collect values into vector
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new CppFunctionCall(null, 'get_values', [obj]);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> iterate map, collect pairs
        case 'ObjectEntries': {
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new CppFunctionCall(null, 'get_entries', [obj]);
        }

        // IL AST ObjectCreate - Object.create(null) -> empty map
        case 'ObjectCreate': {
          return new CppIdentifier('std::unordered_map<std::string, int>{}');
        }

        // IL AST DebugOutput - console.log/warn/error -> std::cerr or std::cout
        case 'DebugOutput': {
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const method = node.method || node.level || 'log';
          if (args.length === 0)
            return new CppIdentifier('std::cerr << std::endl');
          // Build streaming output: std::cerr << arg1 << " " << arg2 << std::endl
          const parts = args.map(a => this._nodeToCode(a)).join(' << " " << ');
          if (method === 'error' || method === 'warn')
            return new CppIdentifier(`std::cerr << ${parts} << std::endl`);
          return new CppIdentifier(`std::cout << ${parts} << std::endl`);
        }

        // IL AST IsFiniteCheck - Number.isFinite(v) -> std::isfinite(v)
        case 'IsFiniteCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new CppFunctionCall(null, 'std::isfinite', [value]);
        }

        // IL AST IsNaNCheck - Number.isNaN(v) -> std::isnan(v)
        case 'IsNaNCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new CppFunctionCall(null, 'std::isnan', [value]);
        }

        // IL AST IsIntegerCheck - Number.isInteger(v) -> std::floor(v) == v
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new CppBinaryExpression(
            new CppFunctionCall(null, 'std::floor', [value]),
            '==',
            value
          );
        }

        default:
          // Log warning for unhandled expression types to aid debugging
          const safeStringify = (obj) => {
            try {
              return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v, 2).substring(0, 200);
            } catch (e) { return '[stringify error]'; }
          };
          console.warn(`[CppTransformer] Unhandled expression type: ${node.type}`, safeStringify(node));
          // Return a placeholder that will cause compilation to fail with clear message
          return new CppIdentifier(`UNHANDLED_EXPRESSION_${node.type}`);
          // Note: This will cause C++ compilation to fail with a clear error indicating what's missing
      }
    }

    /**
     * Transform object expression to C++ initializer list or std::map
     */
    /**
     * Extract key name from an object property, handling both AST object keys and plain string keys
     */
    getPropertyKeyName(prop) {
      if (!prop || !prop.key) return undefined;
      // IL ObjectLiteral: key is a plain string
      if (typeof prop.key === 'string') return prop.key;
      // Standard AST: key is an Identifier or Literal node
      return prop.key.name || prop.key.value;
    }

    transformObjectExpression(node, targetType = null) {
      // Check if this looks like a TestCase object (has input/expected properties)
      const propNames = new Set(node.properties.map(p => this.getPropertyKeyName(p)).filter(Boolean));
      if (propNames.has('input') && propNames.has('expected')) {
        // This is a TestCase - use explicit constructor call with correct argument order
        return this.transformTestCaseObject(node);
      }

      // Check if this is a dictionary pattern (all string keys with object values)
      const hasDictionaryPattern = node.properties.length > 0 && node.properties.every(prop => {
        const keyName = this.getPropertyKeyName(prop);
        return keyName && (prop.value?.type === 'ObjectExpression' || prop.value?.type === 'ArrayExpression' ||
               prop.value?.type === 'ObjectLiteral' || prop.value?.type === 'ArrayLiteral');
      });

      if (hasDictionaryPattern) {
        // Generate std::map initialization
        const pairs = [];
        for (const prop of node.properties) {
          let keyName = this.getPropertyKeyName(prop);
          // Clean key name - remove leading underscores for variant keys
          // Also strip surrounding quotes (single or double) if present
          if (typeof keyName === 'string') {
            keyName = keyName.replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes
            if (keyName.startsWith('_')) keyName = keyName.substring(1);
          }
          const key = CppLiteral.String(keyName);
          const value = this.transformExpression(prop.value);
          pairs.push(new CppInitializerList([key, value]));
        }
        // Return map-style initializer: { {"key1", value1}, {"key2", value2} }
        return new CppMapInitializer(pairs);
      }

      // For simple cases, use struct initializer list
      const elements = [];
      for (const prop of node.properties) {
        const value = this.transformExpression(prop.value);
        if (value)
          elements.push(value);
      }
      return new CppInitializerList(elements);
    }

    /**
     * Transform TestCase object literal to explicit constructor call
     * JavaScript: { text: "...", uri: "...", input: [...], expected: [...] }
     * C++: TestCase(input, expected, description, source) or TestCase(description, source, input, key, expected)
     */
    transformTestCaseObject(node) {
      // Extract properties by name, forcing byte arrays for input/expected/key/iv
      const props = {};
      const byteArrayProps = ['input', 'expected', 'key', 'iv', 'nonce'];
      for (const prop of node.properties) {
        const keyName = this.getPropertyKeyName(prop);
        if (!keyName) continue;
        // Force byte arrays for TestCase input/expected/key properties
        if (byteArrayProps.includes(keyName) && (prop.value.type === 'ArrayExpression' || prop.value.type === 'ArrayLiteral')) {
          const elements = prop.value.elements.filter(e => e).map(e => this.transformExpression(e));
          props[keyName] = new CppArrayCreation(CppType.Byte(), null, elements);
        } else {
          props[keyName] = this.transformExpression(prop.value);
        }
      }

      // Get the values - map JS property names to C++ constructor order
      // 4-arg constructor: (input, expected, description, source)
      // 5-arg constructor: (description, source, input, key, expected)
      const input = props.input || new CppInitializerList([]);
      const expected = props.expected || new CppInitializerList([]);
      const description = props.text || props.description || CppLiteral.String("");
      const source = props.uri || props.source || CppLiteral.String("");
      const key = props.key;

      if (key) {
        // Use 5-arg constructor
        return new CppObjectCreation(new CppType('TestCase'), [description, source, input, key, expected]);
      } else {
        // Use 4-arg constructor: (input, expected, description, source)
        return new CppObjectCreation(new CppType('TestCase'), [input, expected, description, source]);
      }
    }

    /**
     * Transform function expression to lambda
     */
    transformLambdaExpression(node) {
      const params = (node.params || []).map(p => {
        let paramId, defaultValue;
        if (p.type === 'AssignmentPattern') {
          paramId = p.left;
          defaultValue = this.transformExpression(p.right);
        } else if (p.defaultValue) {
          paramId = p;
          defaultValue = this.transformExpression(p.defaultValue);
        } else {
          paramId = p;
          defaultValue = null;
        }
        const paramName = this.toSnakeCase(paramId.name);
        const cppParam = new CppParameter(paramName, CppType.Auto());
        if (defaultValue) {
          cppParam.defaultValue = defaultValue;
        }
        return cppParam;
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
      // Handle undefined - treat same as null in C++
      if (node.value === undefined) return CppLiteral.Nullptr();
      if (typeof node.value === 'boolean') return CppLiteral.Bool(node.value);
      if (typeof node.value === 'string') {
        // Use char literal for single-character strings (for comparisons like char >= '0')
        if (node.value.length === 1)
          return CppLiteral.Char(node.value);
        return CppLiteral.String(node.value);
      }
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
          const origExpr = node.expressions[i];
          const expr = this.transformExpression(origExpr);

          // Check if expression is already a string type - don't wrap in to_string
          const exprType = this.inferExpressionType(origExpr);
          const isStringType = exprType && (exprType.name === 'std::string' || exprType.name === 'string');

          if (isStringType) {
            // Already a string, use directly
            parts.push(expr);
          } else {
            // Use std::to_string for numeric types
            const toStringCall = new CppFunctionCall(null, 'std::to_string', [expr]);
            parts.push(toStringCall);
          }
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
      // Handle || operator for null-coalescing with map subscript access
      // Pattern: configs[variant] || configs["32"] -> configs.count(variant) ? configs.at(variant) : configs.at("32")
      if (node.operator === '||' &&
          node.left.type === 'MemberExpression' && node.left.computed &&
          node.right.type === 'MemberExpression' && node.right.computed) {
        // Check if same object is being accessed (likely a map pattern)
        const leftObj = this.transformExpression(node.left.object);
        const leftKey = this.transformExpression(node.left.property);
        const rightObj = this.transformExpression(node.right.object);
        const rightKey = this.transformExpression(node.right.property);

        // Generate: obj.count(key) ? obj.at(key) : obj.at(defaultKey)
        const countCall = new CppFunctionCall(leftObj, 'count', [leftKey]);
        const atCallLeft = new CppFunctionCall(leftObj, 'at', [leftKey]);
        const atCallRight = new CppFunctionCall(rightObj, 'at', [rightKey]);

        return new CppConditional(countCall, atCallLeft, atCallRight);
      }

      // Handle || operator as null-coalescing for general expressions
      // Pattern: value || default -> value is truthy ? value : default
      // For null/nullptr on right side, convert to ternary
      if (node.operator === '||') {
        const isRightNull = (node.right.type === 'Literal' && node.right.value === null) ||
                            (node.right.type === 'Identifier' && (node.right.name === 'null' || node.right.name === 'nullptr'));
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);

        // For general || operator, convert to ternary expression
        // In C++: left || right with mismatched types doesn't work
        // Convert to: left ? left : right
        return new CppConditional(left, left, right);
      }

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
      // Handle !vector -> vector.empty() for C++
      if (node.operator === '!' && this.isVectorExpression(node.argument)) {
        const operand = this.transformExpression(node.argument);
        return new CppFunctionCall(operand, 'empty', []);
      }
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
      // Handle null/nullptr assignment
      const isNullAssignment = node.right.type === 'Literal' &&
                               (node.right.value === null || node.right.value === undefined);
      if (isNullAssignment && node.operator === '=') {
        // vector = null -> vector.clear()
        if (this.isVectorExpression(node.left)) {
          const target = this.transformExpression(node.left);
          return new CppFunctionCall(target, 'clear', []);
        }
        // For enum-typed fields assigned null, skip the assignment entirely
        // The field already has a default value from the class declaration
        const fieldName = this.getAssignmentTargetFieldName(node.left);
        if (fieldName) {
          const lowerField = fieldName.toLowerCase();
          const enumFields = ['securitystatus', 'security_status', 'category', 'country', 'complexity'];
          if (enumFields.includes(lowerField))
            return null;
        }
        // For integral/primitive fields assigned null, use default value 0
        // This handles cases like: this->counter = null; -> this->counter = 0;
        const target = this.transformExpression(node.left);
        return new CppAssignment(target, '=', new CppLiteral(0, 'int'));
      }

      // Fix ArrayCreation element type based on target field name
      // The IL generates 'uint8' by default but the field may be declared as uint32[]
      if (node.right?.type === 'ArrayCreation' || node.right?.ilNodeType === 'ArrayCreation') {
        const targetFieldName = this.getAssignmentTargetFieldName(node.left);
        if (targetFieldName) {
          const expectedElementType = this.inferArrayElementTypeFromFieldName(targetFieldName);
          if (expectedElementType) {
            node.right.elementType = expectedElementType;
          }
        }
      }

      const target = this.transformExpression(node.left);
      const value = this.transformExpression(node.right);
      return new CppAssignment(target, node.operator, value);
    }

    /**
     * Get field name from assignment target if it's a this.field expression
     * @private
     */
    getAssignmentTargetFieldName(leftNode) {
      if (!leftNode) return null;
      // this.fieldName pattern
      if (leftNode.type === 'MemberExpression' &&
          leftNode.object?.type === 'ThisExpression') {
        return leftNode.property?.name || leftNode.property?.value;
      }
      // ThisPropertyAccess IL node pattern
      if (leftNode.type === 'ThisPropertyAccess' || leftNode.ilNodeType === 'ThisPropertyAccess') {
        return leftNode.property || leftNode.name;
      }
      return null;
    }

    /**
     * Infer array element type from field name pattern
     * @private
     */
    inferArrayElementTypeFromFieldName(fieldName) {
      if (!fieldName) return null;
      const lowerName = fieldName.toLowerCase();

      // Fields that should be uint32 arrays
      if (lowerName === 'sum0' || lowerName === 'sum1' || lowerName === 'sum2' ||
          lowerName === 'keywords' || lowerName === 'key_words' ||
          lowerName === 'roundkeys' || lowerName === 'round_keys' ||
          lowerName === 'subkeys' || lowerName === 'sub_keys' ||
          lowerName === 'schedule' || lowerName === 'keyschedule' || lowerName === 'key_schedule' ||
          lowerName === 'state' || lowerName === 'block' || lowerName === 'working' ||
          lowerName === 'sbox' || lowerName === 's_box' ||
          lowerName === 'rcon' || lowerName === 'roundconst' || lowerName === 'round_const') {
        return 'uint32';
      }

      // Fields that should be uint8 arrays
      if (lowerName === 'inputbuffer' || lowerName === 'input_buffer' ||
          lowerName === 'outputbuffer' || lowerName === 'output_buffer' ||
          lowerName === 'key' || lowerName === 'iv' || lowerName === 'nonce' ||
          lowerName === 'tag' || lowerName === 'aad' || lowerName === 'plaintext' ||
          lowerName === 'ciphertext') {
        return 'uint8';
      }

      return null;
    }

    /**
     * Known framework enum types
     */
    static ENUM_TYPES = new Set([
      'CategoryType', 'SecurityStatus', 'CountryCode', 'ComplexityType'
    ]);

    /**
     * Transform member expression
     */
    transformMemberExpression(node) {
      // Handle AlgorithmFramework.X patterns first
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        // AlgorithmFramework.Type -> just Type (base class, enum, etc.)
        const typeName = node.property.name || node.property.value;
        return new CppIdentifier(typeName);
      }

      // Handle AlgorithmFramework.CategoryType.BLOCK patterns (nested member access)
      if (node.object.type === 'MemberExpression' &&
          node.object.object?.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {
        // AlgorithmFramework.EnumType.VALUE -> EnumType::VALUE
        const enumTypeName = node.object.property.name || node.object.property.value;
        const enumValue = node.property.name || node.property.value;
        if (CppTransformer.ENUM_TYPES.has(enumTypeName))
          return new CppIdentifier(`${enumTypeName}::${enumValue}`);
        // Not an enum, just return the type identifier
        return new CppIdentifier(enumTypeName);
      }

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

      // Check if this is an enum access (e.g., CategoryType.CHECKSUM)
      if (node.object.type === 'Identifier' && CppTransformer.ENUM_TYPES.has(node.object.name)) {
        // Use scope resolution operator (::) for enums in C++
        // Preserve enum type name and value name as-is (not snake_case)
        return new CppIdentifier(`${node.object.name}::${member}`);
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
        const method = node.callee.property.name || node.callee.property.value;
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

        // Handle Array methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Array') {
          // Array.isArray(x) -> in C++, vectors are always "arrays", just check if it's a valid container
          // For type safety we treat this as true since we know the type at compile time
          if (method === 'isArray' && args.length === 1) {
            // Since we type-check at compile time in C++, just check if it's a valid reference
            // This becomes: !x.empty() || true (effectively always true for valid vectors)
            return CppLiteral.Bool(true);
          }
        }

        // Handle String static methods (JavaScript built-ins)
        // Check for both 'String' and 'string' (may be lowercased during parsing)
        if (node.callee.object.type === 'Identifier' &&
            (node.callee.object.name === 'String' || node.callee.object.name === 'string')) {
          // String.fromCharCode(code) -> static_cast<char>(code)
          // Also handle snake_case from_char_code
          if ((method === 'fromCharCode' || method === 'from_char_code') && args.length >= 1) {
            if (args.length === 1)
              return new CppCast('char', args[0]);
            // Multiple args: create a string from multiple chars
            // std::string{static_cast<char>(a), static_cast<char>(b), ...}
            const chars = args.map(a => new CppCast('char', a));
            return new CppObjectCreation(new CppType('std::string'), chars);
          }
        }

        // Handle JavaScript Math methods -> C++ <cmath> functions
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Math') {
          // Add cmath include if we have a target file
          if (this.targetFile && !this.targetFile.includes.some(inc => inc.header === 'cmath')) {
            this.targetFile.includes.push(new CppIncludeDirective('cmath', true));
          }
          switch (method) {
            case 'floor':
              return new CppFunctionCall(null, 'std::floor', args);
            case 'ceil':
              return new CppFunctionCall(null, 'std::ceil', args);
            case 'abs':
              return new CppFunctionCall(null, 'std::abs', args);
            case 'round':
              return new CppFunctionCall(null, 'std::round', args);
            case 'sqrt':
              return new CppFunctionCall(null, 'std::sqrt', args);
            case 'pow':
              return new CppFunctionCall(null, 'std::pow', args);
            case 'min':
              return new CppFunctionCall(null, 'std::min', args);
            case 'max':
              return new CppFunctionCall(null, 'std::max', args);
            case 'sin':
              return new CppFunctionCall(null, 'std::sin', args);
            case 'cos':
              return new CppFunctionCall(null, 'std::cos', args);
            case 'tan':
              return new CppFunctionCall(null, 'std::tan', args);
            case 'asin':
              return new CppFunctionCall(null, 'std::asin', args);
            case 'acos':
              return new CppFunctionCall(null, 'std::acos', args);
            case 'atan':
              return new CppFunctionCall(null, 'std::atan', args);
            case 'atan2':
              return new CppFunctionCall(null, 'std::atan2', args);
            case 'log':
              return new CppFunctionCall(null, 'std::log', args);
            case 'log2':
              return new CppFunctionCall(null, 'std::log2', args);
            case 'log10':
              return new CppFunctionCall(null, 'std::log10', args);
            case 'exp':
              return new CppFunctionCall(null, 'std::exp', args);
            case 'trunc':
              return new CppFunctionCall(null, 'std::trunc', args);
            case 'sign':
              // C++11 doesn't have sign, but we can implement it
              // (x > 0) - (x < 0)
              return new CppBinaryExpression(
                new CppBinaryExpression(args[0], '>', new CppLiteral('0')),
                '-',
                new CppBinaryExpression(args[0], '<', new CppLiteral('0'))
              );
            case 'clz32':
              // Count leading zeros - use __builtin_clz in GCC/Clang or _BitScanReverse in MSVC
              return new CppFunctionCall(null, '__builtin_clz', args);
            case 'imul':
              // 32-bit integer multiplication
              return new CppCast('int32_t', new CppBinaryExpression(args[0], '*', args[1]));
            default:
              // Fallback for unknown Math methods
              return new CppFunctionCall(null, `std::${method}`, args);
          }
        }

        // Array methods
        if (method === 'push') {
          // If pushing a vector to a vector, use insert instead of push_back
          if (args.length === 1 && node.arguments && node.arguments.length === 1 &&
              this.isVectorExpression(node.arguments[0])) {
            // target.insert(target.end(), arg.begin(), arg.end())
            return new CppFunctionCall(target, 'insert', [
              new CppFunctionCall(target, 'end', []),
              new CppFunctionCall(args[0], 'begin', []),
              new CppFunctionCall(args[0], 'end', [])
            ]);
          }
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
        'RotL32': (a) => `((static_cast<uint32_t>(${a[0]}) << (${a[1]})) | (static_cast<uint32_t>(${a[0]}) >> (32 - (${a[1]}))))`,
        'RotR32': (a) => `((static_cast<uint32_t>(${a[0]}) >> (${a[1]})) | (static_cast<uint32_t>(${a[0]}) << (32 - (${a[1]}))))`,
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
      // Handle AlgorithmFramework.TypeName pattern
      let typeName = node.callee.name;
      if (!typeName && node.callee.type === 'MemberExpression' &&
          node.callee.object?.type === 'Identifier' &&
          node.callee.object.name === 'AlgorithmFramework') {
        // new AlgorithmFramework.TypeName(...) -> TypeName{...}
        typeName = node.callee.property.name || node.callee.property.value;
      }

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

      // Handle JavaScript Error types -> C++ std::exception types
      // new Error("message") -> std::runtime_error("message")
      if (typeName === 'Error' || typeName === 'TypeError' || typeName === 'RangeError' ||
          typeName === 'SyntaxError' || typeName === 'ReferenceError') {
        const exceptionType = typeName === 'TypeError' ? 'std::invalid_argument' :
                              typeName === 'RangeError' ? 'std::out_of_range' :
                              typeName === 'SyntaxError' ? 'std::runtime_error' :
                              typeName === 'ReferenceError' ? 'std::runtime_error' :
                              'std::runtime_error';
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new CppObjectCreation(new CppType(exceptionType), args);
      }

      // Special handling for TestCase - force array arguments to be byte arrays
      // TestCase(input, expected, description, source) - input and expected are byte arrays
      if (typeName === 'TestCase') {
        const transformedArgs = [];
        for (let i = 0; i < node.arguments.length; ++i) {
          const arg = node.arguments[i];
          // Arguments 0 and 1 are input/expected byte arrays
          if (i < 2 && arg.type === 'ArrayExpression') {
            const elements = arg.elements.filter(e => e).map(e => this.transformExpression(e));
            transformedArgs.push(new CppArrayCreation(CppType.Byte(), null, elements));
          } else {
            transformedArgs.push(this.transformExpression(arg));
          }
        }
        return new CppObjectCreation(new CppType('TestCase'), transformedArgs);
      }

      // Regular object creation
      const pascalTypeName = this.toPascalCase(typeName);
      const type = new CppType(pascalTypeName);
      let args = node.arguments.map(arg => this.transformExpression(arg));

      // If no arguments provided but class has constructor with default params,
      // explicitly provide the defaults (fixes C++ static member init ordering issue)
      if (args.length === 0 && this.constructorDefaultParams.has(pascalTypeName)) {
        args = this.constructorDefaultParams.get(pascalTypeName);
      }

      return new CppObjectCreation(type, args);
    }

    /**
     * Transform array expression
     */
    transformArrayExpression(node) {
      // Check if elements contain SpreadElements (e.g., [...arr1, ...arr2])
      // This pattern is used for array concatenation in JavaScript
      const hasSpreadElements = node.elements.some(elem => elem && elem.type === 'SpreadElement');

      if (hasSpreadElements) {
        // Use concat_arrays to combine spread vectors
        const spreadElements = node.elements
          .filter(elem => elem && elem.type === 'SpreadElement')
          .map(elem => this.transformExpression(elem.argument));

        if (spreadElements.length >= 2) {
          let result = spreadElements[0];
          for (let i = 1; i < spreadElements.length; ++i) {
            result = new CppFunctionCall(null, 'concat_arrays', [result, spreadElements[i]]);
          }
          return result;
        } else if (spreadElements.length === 1) {
          return spreadElements[0];
        }
      }

      // Check if elements are function calls that return vectors (e.g., unpack_32BE)
      // In that case, use concat_arrays instead of brace initialization
      const vectorReturningFunctions = ['unpack_32BE', 'unpack_32LE', 'unpack_16BE', 'unpack32_be', 'unpack32_le', 'Unpack32BE', 'Unpack32LE', 'Unpack16BE'];

      const hasVectorElements = node.elements.some(elem => {
        if (!elem) return false;
        if (elem.type === 'CallExpression' && elem.callee.type === 'Identifier') {
          return vectorReturningFunctions.some(fn => elem.callee.name.toLowerCase().includes(fn.toLowerCase().replace('_', '')));
        }
        if (elem.type === 'CallExpression' && elem.callee.type === 'MemberExpression') {
          const methodName = elem.callee.property.name || elem.callee.property.value;
          return vectorReturningFunctions.some(fn => methodName && methodName.toLowerCase().includes(fn.toLowerCase().replace('_', '')));
        }
        return false;
      });

      if (hasVectorElements && node.elements.length >= 2) {
        // Use concat_arrays to combine vectors
        const elements = node.elements.filter(e => e).map(elem => this.transformExpression(elem));
        let result = elements[0];
        for (let i = 1; i < elements.length; ++i) {
          result = new CppFunctionCall(null, 'concat_arrays', [result, elements[i]]);
        }
        return result;
      }

      const elements = node.elements.filter(e => e).map(elem => this.transformExpression(elem));
      // Use IL node's elementType if available for byte arrays (from type inference),
      // otherwise fall back to inferring from first element or constructor type
      let elemType;
      // Only use IL elementType for primitive types (byte arrays in test vectors)
      if (node.elementType && ['uint8', 'byte', 'int8', 'uint16', 'int16'].includes(node.elementType)) {
        elemType = this.mapType(node.elementType);
      } else if (node.elements.length > 0 && node.elements[0]) {
        const firstEl = node.elements[0];
        // Check if first element is a framework constructor call
        if (firstEl.type === 'NewExpression' && firstEl.callee?.name) {
          elemType = new CppType(firstEl.callee.name);
        } else if (firstEl.type === 'CallExpression' && firstEl.callee?.name) {
          // Function-style constructors like KeySize(...), TestCase(...)
          const funcName = firstEl.callee.name;
          const frameworkTypes = ['TestCase', 'KeySize', 'LinkItem', 'Vulnerability'];
          if (frameworkTypes.includes(funcName)) {
            elemType = new CppType(funcName);
          } else {
            elemType = this.inferExpressionType(firstEl);
          }
        } else {
          elemType = this.inferExpressionType(firstEl);
        }
      } else {
        elemType = CppType.UInt();
      }
      return new CppArrayCreation(elemType, null, elements);
    }

    /**
     * Transform conditional expression
     */
    transformConditionalExpression(node) {
      // Handle vector in boolean context: vector ? x : y -> !vector.empty() ? x : y
      let condition;
      if (this.isVectorExpression(node.test)) {
        const vectorExpr = this.transformExpression(node.test);
        const emptyCall = new CppFunctionCall(vectorExpr, 'empty', []);
        condition = new CppUnaryExpression('!', emptyCall, true);
      } else {
        condition = this.transformExpression(node.test);
      }
      const trueExpr = this.transformExpression(node.consequent);

      // Handle nullptr in false branch when true branch returns a vector
      // vector ? vector : nullptr -> !vector.empty() ? vector : std::vector<uint8_t>{}
      let falseExpr;
      const isNullAlternate = node.alternate.type === 'Literal' &&
                              (node.alternate.value === null || node.alternate.value === undefined);
      if (isNullAlternate && this.isVectorExpression(node.consequent)) {
        // Replace nullptr with empty vector constructor: std::vector<uint8_t>()
        falseExpr = new CppArrayCreation(CppType.Byte(), null, null);
      } else {
        falseExpr = this.transformExpression(node.alternate);
      }

      return new CppConditional(condition, trueExpr, falseExpr);
    }

    // ========================[ IL AST NODE TRANSFORMERS ]========================

    /**
     * Transform ParentConstructorCall to base class constructor call
     * C++: BaseClass(args...) in initializer list
     * Note: Should be handled in transformConstructor, not here
     */
    transformParentConstructorCall(node) {
      // Parent constructor calls should be handled in transformConstructor
      // and placed in the initializer list. If we get here, return null to skip.
      return null;
    }

    /**
     * Transform ParentMethodCall to base class method call
     * C++: BaseClass::method(args...)
     */
    transformParentMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      const parentClass = node.parentClass || 'Base';
      const methodName = this.toSnakeCase(node.method);
      return new CppFunctionCall(new CppIdentifier(this.toPascalCase(parentClass)), methodName, args);
    }

    /**
     * Transform ThisMethodCall to this->method(args...)
     */
    transformThisMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      const methodName = this.toSnakeCase(node.method);
      return new CppFunctionCall(new CppThis(), methodName, args, true);
    }

    /**
     * Transform ThisPropertyAccess to this->property
     */
    transformThisPropertyAccess(node) {
      const propName = this.toSnakeCase(node.property);
      return new CppMemberAccess(new CppThis(), propName, true);
    }

    /**
     * Transform RotateLeft/RotateRight to inline bit rotation (C++17 safe)
     */
    transformRotation(node) {
      const value = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // Use inline formula instead of std::rotl/std::rotr (C++20)
      let castType;
      switch (bits) {
        case 8: castType = 'uint8_t'; break;
        case 16: castType = 'uint16_t'; break;
        case 32: castType = 'uint32_t'; break;
        case 64: castType = 'uint64_t'; break;
        default: castType = 'uint32_t';
      }

      // rotl: (v << n) | (v >> (bits - n))
      // rotr: (v >> n) | (v << (bits - n))
      const v = new CppCast(castType, value);
      const bitsLit = CppLiteral.Int(bits);
      const complement = new CppParenthesized(new CppBinaryExpression(bitsLit, '-', amount));
      if (isLeft) {
        const leftShift = new CppParenthesized(new CppBinaryExpression(v, '<<', amount));
        const rightShift = new CppParenthesized(new CppBinaryExpression(new CppCast(castType, value), '>>', complement));
        return new CppParenthesized(new CppBinaryExpression(leftShift, '|', rightShift));
      } else {
        const rightShift = new CppParenthesized(new CppBinaryExpression(v, '>>', amount));
        const leftShift = new CppParenthesized(new CppBinaryExpression(new CppCast(castType, value), '<<', complement));
        return new CppParenthesized(new CppBinaryExpression(rightShift, '|', leftShift));
      }
    }

    /**
     * Transform PackBytes to byte packing expression
     */
    transformPackBytes(node) {
      // Handle both IL AST (arguments array) and legacy (bytes property)
      const bytes = (node.arguments || node.bytes || []).map(b => this.transformExpression(b));
      const endian = node.endian === 'big' ? 'BE' : 'LE';
      const bits = node.bits || 32;

      // Generate inline bit shifting expression
      if (bits === 32 && bytes.length === 4) {
        if (endian === 'BE') {
          // (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
          return new CppBinaryExpression(
            new CppBinaryExpression(
              new CppBinaryExpression(
                new CppBinaryExpression(bytes[0], '<<', CppLiteral.Int(24)),
                '|',
                new CppBinaryExpression(bytes[1], '<<', CppLiteral.Int(16))
              ),
              '|',
              new CppBinaryExpression(bytes[2], '<<', CppLiteral.Int(8))
            ),
            '|',
            bytes[3]
          );
        } else {
          // b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
          return new CppBinaryExpression(
            new CppBinaryExpression(
              new CppBinaryExpression(
                bytes[0],
                '|',
                new CppBinaryExpression(bytes[1], '<<', CppLiteral.Int(8))
              ),
              '|',
              new CppBinaryExpression(bytes[2], '<<', CppLiteral.Int(16))
            ),
            '|',
            new CppBinaryExpression(bytes[3], '<<', CppLiteral.Int(24))
          );
        }
      }

      // Fallback for other sizes
      return new CppFunctionCall(null, `pack_${bits}${endian}`, bytes);
    }

    /**
     * Transform UnpackBytes to byte unpacking expression
     */
    transformUnpackBytes(node) {
      // Handle both IL AST (arguments array) and legacy (value property)
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const endian = node.endian === 'big' ? 'BE' : 'LE';
      const bits = node.bits || 32;

      // Generate helper function call for unpacking
      return new CppFunctionCall(null, `unpack_${bits}${endian}`, [value]);
    }

    /**
     * Transform ArrayLength to vector.size()
     */
    transformArrayLength(node) {
      const array = this.transformExpression(node.array);
      return new CppFunctionCall(array, 'size', []);
    }

    /**
     * Transform ArrayAppend to vector.push_back() or vector.insert()
     */
    transformArrayAppend(node) {
      const array = this.transformExpression(node.array);

      // Check for SpreadElement - indicates appending a collection, not single element
      if (node.value && node.value.type === 'SpreadElement') {
        const spreadValue = this.transformExpression(node.value.argument);
        // array.insert(array.end(), value.begin(), value.end())
        return new CppFunctionCall(array, 'insert', [
          new CppFunctionCall(array, 'end', []),
          new CppFunctionCall(spreadValue, 'begin', []),
          new CppFunctionCall(spreadValue, 'end', [])
        ]);
      }

      const value = this.transformExpression(node.value);

      // If appending a vector to a vector, use insert instead of push_back
      if (this.isVectorExpression(node.value)) {
        // array.insert(array.end(), value.begin(), value.end())
        return new CppFunctionCall(array, 'insert', [
          new CppFunctionCall(array, 'end', []),
          new CppFunctionCall(value, 'begin', []),
          new CppFunctionCall(value, 'end', [])
        ]);
      }

      return new CppFunctionCall(array, 'push_back', [value]);
    }

    /**
     * Transform ArraySlice to std::vector constructor with iterators
     */
    transformArraySlice(node) {
      const array = this.transformExpression(node.array);
      const start = node.start ? this.transformExpression(node.start) : CppLiteral.Int(0);
      const end = node.end ? this.transformExpression(node.end) : new CppFunctionCall(array, 'size', []);

      // Infer element type from array, default to byte for crypto contexts
      let elementType = CppType.Byte();
      if (node.array) {
        const arrayType = this.inferExpressionType(array);
        if (arrayType && arrayType.vectorElement) {
          elementType = arrayType.vectorElement;
        } else if (arrayType && arrayType.templateArgs && arrayType.templateArgs.length > 0) {
          elementType = arrayType.templateArgs[0];
        }
      }

      return new CppObjectCreation(
        CppType.Vector(elementType),
        [
          new CppBinaryExpression(new CppFunctionCall(array, 'begin', []), '+', start),
          new CppBinaryExpression(new CppFunctionCall(array, 'begin', []), '+', end)
        ]
      );
    }

    /**
     * Transform ArrayFill to std::fill
     */
    transformArrayFill(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      return new CppFunctionCall(
        null,
        'std::fill',
        [
          new CppFunctionCall(array, 'begin', []),
          new CppFunctionCall(array, 'end', []),
          value
        ]
      );
    }

    /**
     * Transform ArrayXor to std::transform with XOR lambda
     */
    transformArrayXor(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      // std::transform(a.begin(), a.end(), b.begin(), result.begin(), [](auto a, auto b) { return a ^ b; })
      return new CppFunctionCall(null, 'xor_arrays', [left, right]);
    }

    /**
     * Transform ArrayClear to vector.clear()
     */
    transformArrayClear(node) {
      const array = this.transformExpression(node.array);
      return new CppFunctionCall(array, 'clear', []);
    }

    /**
     * Transform ArrayIndexOf to std::find
     */
    transformArrayIndexOf(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      // std::distance(array.begin(), std::find(array.begin(), array.end(), value))
      return new CppFunctionCall(null, 'std::distance', [
        new CppFunctionCall(array, 'begin', []),
        new CppFunctionCall(null, 'std::find', [
          new CppFunctionCall(array, 'begin', []),
          new CppFunctionCall(array, 'end', []),
          value
        ])
      ]);
    }

    /**
     * Transform ArrayIncludes to std::find != end()
     */
    transformArrayIncludes(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      return new CppBinaryExpression(
        new CppFunctionCall(null, 'std::find', [
          new CppFunctionCall(array, 'begin', []),
          new CppFunctionCall(array, 'end', []),
          value
        ]),
        '!=',
        new CppFunctionCall(array, 'end', [])
      );
    }

    /**
     * Transform ArrayConcat - concatenate vectors
     */
    transformArrayConcat(node) {
      const array = this.transformExpression(node.array);
      // For now, just return the array - concat is complex in C++
      return array;
    }

    /**
     * Transform ArrayJoin - join elements with separator
     */
    transformArrayJoin(node) {
      const array = this.transformExpression(node.array);
      // This needs a helper function in C++
      return new CppFunctionCall(null, 'join', [array]);
    }

    /**
     * Transform ArrayReverse to std::reverse
     */
    transformArrayReverse(node) {
      const array = this.transformExpression(node.array);
      return new CppFunctionCall(null, 'std::reverse', [
        new CppFunctionCall(array, 'begin', []),
        new CppFunctionCall(array, 'end', [])
      ]);
    }

    /**
     * Transform ArrayPop to vector.pop_back()
     */
    transformArrayPop(node) {
      const array = this.transformExpression(node.array);
      return new CppFunctionCall(array, 'pop_back', []);
    }

    /**
     * Transform ArrayShift - remove first element
     */
    transformArrayShift(node) {
      const array = this.transformExpression(node.array);
      return new CppFunctionCall(array, 'erase', [
        new CppFunctionCall(array, 'begin', [])
      ]);
    }

    /**
     * Transform ArrayMap - array.map(callback) to std::transform
     * Returns a new vector with transformed elements
     */
    transformArrayMap(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback ? this.transformExpression(node.callback) : null;

      // If no callback, just return a copy
      if (!callback) return array;

      // Create: std::vector<auto> result; std::transform(arr.begin(), arr.end(), std::back_inserter(result), callback)
      // Simplified: Use a helper or inline lambda
      return new CppFunctionCall(null, 'transform_array', [array, callback]);
    }

    /**
     * Transform ArraySome - array.some(predicate) to std::any_of
     */
    transformArraySome(node) {
      const array = this.transformExpression(node.array);
      const predicate = node.callback ? this.transformExpression(node.callback) : null;

      if (!predicate)
        return CppLiteral.Bool(false);

      return new CppFunctionCall(null, 'std::any_of', [
        new CppFunctionCall(array, 'begin', []),
        new CppFunctionCall(array, 'end', []),
        predicate
      ]);
    }

    /**
     * Transform ArrayForEach - array.forEach(callback) to std::for_each
     */
    transformArrayForEach(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback ? this.transformExpression(node.callback) : null;

      if (!callback) return array;

      return new CppFunctionCall(null, 'std::for_each', [
        new CppFunctionCall(array, 'begin', []),
        new CppFunctionCall(array, 'end', []),
        callback
      ]);
    }

    /**
     * Transform ArrayFilter - array.filter(predicate) to std::copy_if
     */
    transformArrayFilter(node) {
      const array = this.transformExpression(node.array);
      const predicate = node.callback ? this.transformExpression(node.callback) : null;

      if (!predicate) return array;

      // Use helper function for filter
      return new CppFunctionCall(null, 'filter_array', [array, predicate]);
    }

    /**
     * Transform ArrayEvery - array.every(predicate) to std::all_of
     */
    transformArrayEvery(node) {
      const array = this.transformExpression(node.array);
      const predicate = node.callback ? this.transformExpression(node.callback) : null;

      if (!predicate)
        return CppLiteral.Bool(true);

      return new CppFunctionCall(null, 'std::all_of', [
        new CppFunctionCall(array, 'begin', []),
        new CppFunctionCall(array, 'end', []),
        predicate
      ]);
    }

    /**
     * Transform ArrayReduce - array.reduce(callback, initial) to std::accumulate
     */
    transformArrayReduce(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback ? this.transformExpression(node.callback) : null;
      const initial = node.initialValue ? this.transformExpression(node.initialValue) : CppLiteral.Int(0);

      if (!callback) return initial;

      return new CppFunctionCall(null, 'std::accumulate', [
        new CppFunctionCall(array, 'begin', []),
        new CppFunctionCall(array, 'end', []),
        initial,
        callback
      ]);
    }

    /**
     * Transform ArraySplice IL node to std::vector::erase
     * IL AST: { type: 'ArraySplice', array, start, deleteCount?, items? }
     * C++: array.erase(array.begin() + start, array.begin() + start + deleteCount)
     */
    transformArraySplice(node) {
      const array = this.transformExpression(node.array);
      const start = this.transformExpression(node.start);
      const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : null;
      const items = (node.items || []).map(item => this.transformExpression(item));

      // start iterator: array.begin() + start
      const startIter = new CppBinaryExpression(
        new CppFunctionCall(array, 'begin', []),
        '+',
        start
      );

      if (items.length === 0 && deleteCount) {
        // Simple erase: array.erase(array.begin() + start, array.begin() + start + deleteCount)
        const endIter = new CppBinaryExpression(
          new CppFunctionCall(array, 'begin', []),
          '+',
          new CppBinaryExpression(start, '+', deleteCount)
        );
        return new CppFunctionCall(array, 'erase', [startIter, endIter]);
      }

      if (items.length > 0 && deleteCount) {
        // Erase then insert - complex case, emit erase for now
        const endIter = new CppBinaryExpression(
          new CppFunctionCall(array, 'begin', []),
          '+',
          new CppBinaryExpression(start, '+', deleteCount)
        );
        return new CppFunctionCall(array, 'erase', [startIter, endIter]);
      }

      // Default: erase from start to end
      return new CppFunctionCall(array, 'erase', [
        startIter,
        new CppFunctionCall(array, 'end', [])
      ]);
    }

    /**
     * Transform ArrayCreation IL node to std::vector
     */
    transformArrayCreationNode(node) {
      if (node.size) {
        const size = this.transformExpression(node.size);
        const elementType = node.elementType ? this.mapType(node.elementType) : CppType.UInt();
        return new CppArrayCreation(elementType, size);
      }
      return new CppArrayCreation(CppType.UInt());
    }

    /**
     * Transform TypedArrayCreation to std::vector<type>
     */
    transformTypedArrayCreation(node) {
      const size = node.size ? this.transformExpression(node.size) : null;
      const arrayType = node.arrayType || 'Uint8Array';

      const typeMap = {
        'Uint8Array': CppType.Byte(),
        'Uint16Array': CppType.UShort(),
        'Uint32Array': CppType.UInt(),
        'Int8Array': CppType.SByte(),
        'Int16Array': CppType.Short(),
        'Int32Array': CppType.Int()
      };

      const elemType = typeMap[arrayType] || CppType.Byte();
      return size ? new CppArrayCreation(elemType, size) : new CppArrayCreation(elemType);
    }

    /**
     * Transform ByteBufferView to span or raw pointer
     */
    transformByteBufferView(node) {
      const buffer = this.transformExpression(node.buffer);
      // C++20 std::span or use raw pointer for older standards
      return new CppFunctionCall(null, 'std::span', [buffer]);
    }

    /**
     * Transform HexDecode to helper function call
     */
    transformHexDecode(node) {
      const value = this.transformExpression(node.value);
      return new CppFunctionCall(null, 'hex_to_bytes', [value]);
    }

    /**
     * Transform HexEncode to helper function call
     */
    transformHexEncode(node) {
      const value = this.transformExpression(node.value);
      return new CppFunctionCall(null, 'bytes_to_hex', [value]);
    }

    /**
     * Transform StringToBytes to vector<uint8_t> construction from string
     */
    transformStringToBytes(node) {
      let value = this.transformExpression(node.arguments?.[0] || node.value);
      const encoding = node.encoding || 'ascii';

      // String literals don't have .begin()/.end(), so wrap in std::string_view
      // For both UTF-8 and ASCII: std::vector<uint8_t>(std::string_view(str).begin(), std::string_view(str).end())
      // Or use the simpler: reinterpret_cast approach
      // Actually, we use a helper or inline approach

      // Handle char literals: string_view doesn't accept a bare char, so convert to string literal
      if (value.nodeType === 'Literal' && value.literalType === 'char') {
        value = CppLiteral.String(value.value);
      }

      // Create std::string_view wrapper for the value
      const strView = new CppFunctionCall(null, 'std::string_view', [value]);
      return new CppFunctionCall(
        null,
        'std::vector<uint8_t>',
        [
          new CppMemberAccess(strView, 'begin()'),
          new CppMemberAccess(strView, 'end()')
        ]
      );
    }

    /**
     * Transform BytesToString to std::string construction from bytes
     */
    transformBytesToString(node) {
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const encoding = node.encoding || 'ascii';

      // For both ASCII and UTF-8: std::string(bytes.begin(), bytes.end())
      return new CppFunctionCall(
        null,
        'std::string',
        [
          new CppMemberAccess(value, 'begin()'),
          new CppMemberAccess(value, 'end()')
        ]
      );
    }

    /**
     * Transform Floor to std::floor
     */
    transformFloor(node) {
      const argument = this.transformExpression(node.argument);
      return new CppFunctionCall(null, 'std::floor', [argument]);
    }

    /**
     * Transform Ceil to std::ceil
     */
    transformCeil(node) {
      const argument = this.transformExpression(node.argument);
      return new CppFunctionCall(null, 'std::ceil', [argument]);
    }

    /**
     * Transform Abs to std::abs
     */
    transformAbs(node) {
      const argument = this.transformExpression(node.argument);
      return new CppFunctionCall(null, 'std::abs', [argument]);
    }

    /**
     * Transform Min to std::min
     */
    transformMin(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new CppFunctionCall(null, 'std::min', args);
    }

    /**
     * Transform Max to std::max
     */
    transformMax(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new CppFunctionCall(null, 'std::max', args);
    }

    /**
     * Transform Pow to std::pow
     */
    transformPow(node) {
      const base = this.transformExpression(node.base);
      const exponent = this.transformExpression(node.exponent);
      return new CppFunctionCall(null, 'std::pow', [base, exponent]);
    }

    /**
     * Transform Round to std::round
     */
    transformRound(node) {
      const argument = this.transformExpression(node.argument);
      return new CppFunctionCall(null, 'std::round', [argument]);
    }

    /**
     * Transform Trunc to std::trunc
     */
    transformTrunc(node) {
      const argument = this.transformExpression(node.argument);
      return new CppFunctionCall(null, 'std::trunc', [argument]);
    }

    /**
     * Transform Sign to (x > 0) - (x < 0)
     */
    transformSign(node) {
      const argument = this.transformExpression(node.argument);
      return new CppBinaryExpression(
        new CppBinaryExpression(argument, '>', CppLiteral.Int(0)),
        '-',
        new CppBinaryExpression(argument, '<', CppLiteral.Int(0))
      );
    }

    /**
     * Transform Random to random number generator call
     */
    transformRandom(node) {
      // C++ uses <random> header with distribution
      return new CppFunctionCall(null, 'random_double', []);
    }

    /**
     * Transform Imul to 32-bit integer multiplication
     */
    transformImul(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      const multiply = new CppBinaryExpression(left, '*', right);
      return new CppCast('int32_t', multiply);
    }

    /**
     * Transform Clz32 to __builtin_clz or std::countl_zero (C++20)
     */
    transformClz32(node) {
      const argument = this.transformExpression(node.argument);
      // C++20: std::countl_zero, GCC/Clang: __builtin_clz
      return new CppFunctionCall(null, 'std::countl_zero', [new CppCast('uint32_t', argument)]);
    }

    /**
     * Transform Cast IL node to C++ cast
     */
    transformCastNode(node) {
      const expression = this.transformExpression(node.arguments?.[0] || node.expression);
      const targetType = node.targetType;

      const typeMap = {
        'uint32': 'uint32_t',
        'int32': 'int32_t',
        'uint16': 'uint16_t',
        'int16': 'int16_t',
        'uint8': 'uint8_t',
        'int8': 'int8_t',
        'byte': 'uint8_t',
        'int': 'int32_t',
        'float': 'float',
        'double': 'double',
        'bool': 'bool',
        'string': 'std::string'
      };

      const cppType = typeMap[targetType] || targetType;
      return new CppCast(cppType, expression);
    }

    /**
     * Transform DestructuringAssignment to multiple variable declarations
     */
    transformDestructuringAssignment(node) {
      const source = this.transformExpression(node.source);
      // C++17 structured bindings: auto [a, b, c] = func();
      // For now, return the source expression (structured bindings handled by emitter)
      return source;
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
