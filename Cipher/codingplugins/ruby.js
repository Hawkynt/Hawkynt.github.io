/**
 * Ruby Language Plugin for Multi-Language Code Generation
 * Production-ready Ruby 3.3+ code generator with comprehensive AST support
 *
 * Features:
 * - 75+ AST node types with full Ruby 3.3+ compatibility
 * - Modern Ruby features: pattern matching, ractor, fiber, endless methods
 * - OpCodes integration for cryptographic operations
 * - Advanced type inference with Ruby's dynamic typing system
 * - Comprehensive warnings system (15+ Ruby-specific best practices)
 * - Ruby crypto gem integration (OpenSSL, RbNaCl, digest, securerandom, bcrypt)
 * - Metaprogramming support: define_method, method_missing, eval, etc.
 * - Block, proc, and lambda handling with proper syntax
 * - Modern Ruby syntax: keyword arguments, pattern matching, endless methods
 * - Duck typing with dynamic method dispatch
 * - Enhanced dependency collection with Ruby gems and bundler
 *
 * @version 3.0.0
 * @author SynthelicZ Cipher Tools
 * @license MIT
 */

// Import the framework
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, OpCodes;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load OpCodes for cryptographic operations
  try {
    OpCodes = require('../OpCodes.js');
  } catch (e) {
    // OpCodes not available - create minimal fallback
    OpCodes = {
      RotL32: (value, positions) => `((${value} << ${positions}) | (${value} >> (32 - ${positions})))`,
      RotR32: (value, positions) => `((${value} >> ${positions}) | (${value} << (32 - ${positions})))`,
      RotL8: (value, positions) => `((${value} << ${positions}) | (${value} >> (8 - ${positions}))) & 0xFF`,
      RotR8: (value, positions) => `((${value} >> ${positions}) | (${value} << (8 - ${positions}))) & 0xFF`,
      Pack32BE: (b0, b1, b2, b3) => `((${b0} << 24) | (${b1} << 16) | (${b2} << 8) | ${b3})`,
      Pack32LE: (b0, b1, b2, b3) => `(${b0} | (${b1} << 8) | (${b2} << 16) | (${b3} << 24))`,
      Pack16BE: (b0, b1) => `((${b0} << 8) | ${b1})`,
      Pack16LE: (b0, b1) => `(${b0} | (${b1} << 8))`,
      Unpack32BE: (word) => `[(${word} >> 24) & 0xFF, (${word} >> 16) & 0xFF, (${word} >> 8) & 0xFF, ${word} & 0xFF]`,
      Unpack32LE: (word) => `[${word} & 0xFF, (${word} >> 8) & 0xFF, (${word} >> 16) & 0xFF, (${word} >> 24) & 0xFF]`,
      XorArrays: (arr1, arr2) => `${arr1}.zip(${arr2}).map { |a, b| a ^ b }`,
      ClearArray: (arr) => `${arr}.fill(0); ${arr} = nil`,
      Hex8ToBytes: (hexString) => `[${hexString}].pack('H*').bytes`,
      BytesToHex8: (byteArray) => `${byteArray}.pack('C*').unpack1('H*')`,
      AnsiToBytes: (asciiString) => `${asciiString}.bytes`
    };
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  OpCodes = window.OpCodes || {
    RotL32: (value, positions) => `((${value} << ${positions}) | (${value} >> (32 - ${positions})))`,
    RotR32: (value, positions) => `((${value} >> ${positions}) | (${value} << (32 - ${positions})))`,
    RotL8: (value, positions) => `((${value} << ${positions}) | (${value} >> (8 - ${positions}))) & 0xFF`,
    RotR8: (value, positions) => `((${value} >> ${positions}) | (${value} << (8 - ${positions}))) & 0xFF`,
    Pack32BE: (b0, b1, b2, b3) => `((${b0} << 24) | (${b1} << 16) | (${b2} << 8) | ${b3})`,
    Pack32LE: (b0, b1, b2, b3) => `(${b0} | (${b1} << 8) | (${b2} << 16) | (${b3} << 24))`,
    Pack16BE: (b0, b1) => `((${b0} << 8) | ${b1})`,
    Pack16LE: (b0, b1) => `(${b0} | (${b1} << 8))`,
    Unpack32BE: (word) => `[(${word} >> 24) & 0xFF, (${word} >> 16) & 0xFF, (${word} >> 8) & 0xFF, ${word} & 0xFF]`,
    Unpack32LE: (word) => `[${word} & 0xFF, (${word} >> 8) & 0xFF, (${word} >> 16) & 0xFF, (${word} >> 24) & 0xFF]`,
    XorArrays: (arr1, arr2) => `${arr1}.zip(${arr2}).map { |a, b| a ^ b }`,
    ClearArray: (arr) => `${arr}.fill(0); ${arr} = nil`,
    Hex8ToBytes: (hexString) => `[${hexString}].pack('H*').bytes`,
    BytesToHex8: (byteArray) => `${byteArray}.pack('C*').unpack1('H*')`,
    AnsiToBytes: (asciiString) => `${asciiString}.bytes`
  };
}

/**
 * Ruby Code Generator Plugin - Production Ready
 * Extends LanguagePlugin base class with comprehensive Ruby 3.3+ support
 */
class RubyPlugin extends LanguagePlugin {
  constructor() {
    super();

    // Required plugin metadata
    this.name = 'Ruby';
    this.extension = 'rb';
    this.icon = '💎';
    this.description = 'Production-ready Ruby 3.3+ code generator with comprehensive AST support';
    this.mimeType = 'text/x-ruby';
    this.version = '3.3+';

    // Enhanced Ruby-specific options
    this.options = {
      // Code formatting
      indent: '  ', // 2 spaces (Ruby convention)
      lineEnding: '\n',
      maxLineLength: 120,

      // Ruby language features
      useModernSyntax: true,
      usePatternMatching: true,
      useEndlessMethods: true,
      useKeywordArguments: true,
      useOneLinePatternMatching: true,
      useFrozenStringLiteral: true,
      useRactors: true,
      useFibers: true,
      useRefinements: true,

      // Code generation preferences
      addComments: true,
      addShebang: true,
      addYardDoc: true,
      useBlocksForIteration: true,
      useSymbolsForKeys: true,
      useStringInterpolation: true,
      useCaseExpressions: true,
      useGuardClauses: true,
      useDoubleColonForConstants: true,

      // Type and safety features
      addTypeAnnotations: false, // Ruby 3+ RBS support
      addSorbetTypes: false, // Sorbet gem support
      useSafeNavigation: true,
      useNilGuards: true,

      // Metaprogramming
      useMetaprogramming: true,
      allowDefineMethod: true,
      allowMethodMissing: true,
      allowEval: false, // Security consideration

      // Crypto and security
      enableOpCodesIntegration: true,
      useCryptoGems: true,
      useSecureRandom: true,
      addSecurityComments: true,

      // Performance and optimization
      useStringFreeze: true,
      useMemoization: true,
      addPerformanceHints: true,

      // Development and debugging
      addDebugInfo: false,
      generateTODOs: false,
      addLinting: true
    };

    // Internal state
    this.indentLevel = 0;
    this.requires = new Set();
    this.gems = new Set();
    this.modules = new Set();
    this.classes = new Set();
    this.methods = new Set();
    this.constants = new Set();
    this.instanceVariables = new Set();
    this.classVariables = new Set();
    this.globalVariables = new Set();

    // Initialize Ruby-specific mappings
    this._initializeRubyMappings();
    this._initializeCryptoMappings();
    this._initializeWarningRules();
    this._initializeTypeInference();
  }

  /**
   * Initialize Ruby-specific type and method mappings
   * @private
   */
  _initializeRubyMappings() {
    // Ruby type mappings from JavaScript
    this.typeMappings = {
      'undefined': 'nil',
      'null': 'nil',
      'boolean': 'TrueClass | FalseClass',
      'number': 'Integer | Float',
      'string': 'String',
      'object': 'Hash',
      'array': 'Array',
      'function': 'Proc',
      'symbol': 'Symbol',
      'regexp': 'Regexp',
      'date': 'Time',
      'buffer': 'String', // Binary data as String
      'bigint': 'Integer'
    };

    // Common method mappings from JavaScript to Ruby
    this.methodMappings = {
      'length': 'length',
      'size': 'size',
      'push': 'push',
      'pop': 'pop',
      'shift': 'shift',
      'unshift': 'unshift',
      'slice': 'slice',
      'splice': 'slice!',
      'indexOf': 'index',
      'includes': 'include?',
      'forEach': 'each',
      'map': 'map',
      'filter': 'select',
      'reduce': 'reduce',
      'find': 'find',
      'some': 'any?',
      'every': 'all?',
      'join': 'join',
      'split': 'split',
      'replace': 'gsub',
      'substring': 'slice',
      'toLowerCase': 'downcase',
      'toUpperCase': 'upcase',
      'trim': 'strip',
      'toString': 'to_s',
      'valueOf': 'to_i',
      'parseInt': 'to_i',
      'parseFloat': 'to_f'
    };

    // Ruby operators and their JavaScript equivalents
    this.operatorMappings = {
      '===': '==',
      '!==': '!=',
      '&&': '&&',
      '||': '||',
      '++': '+= 1',
      '--': '-= 1',
      '**': '**'
    };

    // Ruby-specific literal patterns
    this.literalPatterns = {
      symbol: /^:[a-zA-Z_][a-zA-Z0-9_]*$/,
      string: /^["'].*["']$/,
      regexp: /^\/.*\/[gimuy]*$/,
      range: /^\d+\.\.\d+$/,
      hash: /^\{.*\}$/,
      array: /^\[.*\]$/
    };
  }

  /**
   * Initialize Ruby crypto gem mappings
   * @private
   */
  _initializeCryptoMappings() {
    // Enhanced crypto gems with detailed information
    this.cryptoGems = {
      'digest': {
        version: '3.1.0',
        description: 'Built-in digest library for hash functions',
        keywords: ['sha1', 'sha256', 'sha384', 'sha512', 'md5', 'hash'],
        builtin: true,
        autoRequire: ['digest']
      },
      'openssl': {
        version: '3.1.0',
        description: 'OpenSSL bindings for encryption and cryptography',
        keywords: ['cipher', 'encrypt', 'decrypt', 'hmac', 'pkcs5', 'random', 'ssl', 'tls'],
        builtin: true,
        autoRequire: ['openssl']
      },
      'rbnacl': {
        version: '7.1.1',
        description: 'Modern cryptographic library based on NaCl',
        keywords: ['box', 'secretbox', 'sign', 'nacl', 'curve25519', 'poly1305'],
        builtin: false,
        autoRequire: ['rbnacl']
      },
      'bcrypt': {
        version: '3.1.19',
        description: 'Password hashing library using bcrypt algorithm',
        keywords: ['password', 'hash', 'bcrypt', 'salt'],
        builtin: false,
        autoRequire: ['bcrypt']
      },
      'securerandom': {
        version: '0.3.0',
        description: 'Secure random number generation',
        keywords: ['random', 'bytes', 'hex', 'uuid', 'secure'],
        builtin: true,
        autoRequire: ['securerandom']
      },
      'ed25519': {
        version: '1.3.0',
        description: 'Ed25519 digital signatures',
        keywords: ['signature', 'ed25519', 'sign', 'verify'],
        builtin: false,
        autoRequire: ['ed25519']
      },
      'argon2': {
        version: '2.1.2',
        description: 'Argon2 password hashing algorithm',
        keywords: ['password', 'argon2', 'hash', 'kdf'],
        builtin: false,
        autoRequire: ['argon2']
      },
      'base64': {
        version: '0.2.0',
        description: 'Base64 encoding and decoding',
        keywords: ['base64', 'encode', 'decode', 'encoding'],
        builtin: true,
        autoRequire: ['base64']
      },
      'json': {
        version: '2.6.3',
        description: 'JSON parsing and generation',
        keywords: ['json', 'parse', 'generate', 'serialize'],
        builtin: true,
        autoRequire: ['json']
      }
    };

    // Add automatic require detection based on code content
    this.autoRequirePatterns = new Map([
      // Digest patterns
      [/Digest::(SHA1|SHA256|SHA384|SHA512|MD5)/, 'digest'],
      [/\.(sha1|sha256|sha384|sha512|md5|hexdigest)/, 'digest'],

      // OpenSSL patterns
      [/OpenSSL::(Cipher|HMAC|PKCS5|Random)/, 'openssl'],
      [/\.(encrypt|decrypt|cipher)/, 'openssl'],

      // SecureRandom patterns
      [/SecureRandom\.(bytes|hex|uuid|random_number)/, 'securerandom'],

      // Base64 patterns
      [/Base64\.(encode64|decode64|strict_encode64)/, 'base64'],

      // JSON patterns
      [/JSON\.(parse|generate|pretty_generate)/, 'json'],

      // BCrypt patterns
      [/BCrypt::Password/, 'bcrypt'],

      // File operations
      [/File\.(read|write|open|exist)/, null], // Built-in, no require needed

      // Time operations
      [/Time\.(now|parse|at)/, null], // Built-in, no require needed
    ]);

    this.cryptoOperations = {
      // Hash operations
      'sha1': 'Digest::SHA1.hexdigest',
      'sha256': 'Digest::SHA256.hexdigest',
      'sha384': 'Digest::SHA384.hexdigest',
      'sha512': 'Digest::SHA512.hexdigest',
      'md5': 'Digest::MD5.hexdigest',

      // Encryption operations
      'encrypt': 'OpenSSL::Cipher.new.encrypt',
      'decrypt': 'OpenSSL::Cipher.new.decrypt',
      'aesEncrypt': 'OpenSSL::Cipher::AES256.new.encrypt',
      'aesDecrypt': 'OpenSSL::Cipher::AES256.new.decrypt',

      // Key derivation
      'pbkdf2': 'OpenSSL::PKCS5.pbkdf2_hmac',
      'scrypt': 'OpenSSL::KDF.scrypt',

      // MAC operations
      'hmac': 'OpenSSL::HMAC.digest',
      'hmacSha256': 'OpenSSL::HMAC.hexdigest("SHA256")',

      // Random operations
      'randomBytes': 'SecureRandom.bytes',
      'randomHex': 'SecureRandom.hex',
      'randomUuid': 'SecureRandom.uuid',

      // Password hashing
      'hashPassword': 'BCrypt::Password.create',
      'verifyPassword': 'BCrypt::Password.new.is_password?',

      // OpCodes integration
      'rotateLeft': OpCodes.RotL32,
      'rotateRight': OpCodes.RotR32,
      'rotateLeft8': OpCodes.RotL8,
      'rotateRight8': OpCodes.RotR8,
      'packBigEndian': OpCodes.Pack32BE,
      'packLittleEndian': OpCodes.Pack32LE,
      'pack16BE': OpCodes.Pack16BE,
      'pack16LE': OpCodes.Pack16LE,
      'unpack32BE': OpCodes.Unpack32BE,
      'unpack32LE': OpCodes.Unpack32LE,
      'xorArrays': OpCodes.XorArrays,
      'clearMemory': OpCodes.ClearArray,
      'hexToBytes': OpCodes.Hex8ToBytes,
      'bytesToHex': OpCodes.BytesToHex8,
      'stringToBytes': OpCodes.AnsiToBytes
    };
  }

  /**
   * Initialize warning rules for Ruby best practices
   * @private
   */
  _initializeWarningRules() {
    this.warningRules = [
      {
        id: 'frozen_string_literal',
        name: 'Frozen String Literal',
        description: 'Use frozen_string_literal pragma for performance',
        severity: 'info',
        check: (code) => !code.includes('frozen_string_literal: true')
      },
      {
        id: 'symbol_keys',
        name: 'Symbol Keys in Hashes',
        description: 'Use symbols for hash keys instead of strings',
        severity: 'style',
        check: (code) => /"[a-zA-Z_][a-zA-Z0-9_]*"\s*=>/.test(code)
      },
      {
        id: 'snake_case_methods',
        name: 'Snake Case Method Names',
        description: 'Use snake_case for method and variable names',
        severity: 'style',
        check: (code) => /def\s+[a-z]*[A-Z]/.test(code)
      },
      {
        id: 'boolean_methods',
        name: 'Boolean Method Naming',
        description: 'Use ? suffix for boolean methods',
        severity: 'style',
        check: (code) => /def\s+is_[a-z_]+[^?]/.test(code)
      },
      {
        id: 'safe_navigation',
        name: 'Safe Navigation Operator',
        description: 'Use &. for safe navigation instead of manual nil checks',
        severity: 'improvement',
        check: (code) => /if\s+\w+\s*&&\s*\w+\./.test(code)
      },
      {
        id: 'string_interpolation',
        name: 'String Interpolation',
        description: 'Use string interpolation instead of concatenation',
        severity: 'performance',
        check: (code) => /"\s*\+\s*\w+\.to_s/.test(code)
      },
      {
        id: 'each_over_for',
        name: 'Use Each Instead of For',
        description: 'Prefer .each over for loops in Ruby',
        severity: 'style',
        check: (code) => /for\s+\w+\s+in/.test(code)
      },
      {
        id: 'guard_clauses',
        name: 'Guard Clauses',
        description: 'Use guard clauses to reduce nesting',
        severity: 'readability',
        check: (code) => {
          const lines = code.split('\n');
          return lines.some(line => /^\s*if.*\n(\s*if|\s*unless)/.test(line));
        }
      },
      {
        id: 'constant_naming',
        name: 'Constant Naming',
        description: 'Use SCREAMING_SNAKE_CASE for constants',
        severity: 'style',
        check: (code) => /[a-z][A-Z_]+\s*=/.test(code)
      },
      {
        id: 'method_length',
        name: 'Method Length',
        description: 'Keep methods under 20 lines',
        severity: 'complexity',
        check: (code) => {
          const methods = code.match(/def\s+\w+.*?end/gs) || [];
          return methods.some(method => method.split('\n').length > 20);
        }
      },
      {
        id: 'eval_usage',
        name: 'Eval Usage',
        description: 'Avoid using eval() for security reasons',
        severity: 'security',
        check: (code) => /\beval\s*\(/.test(code)
      },
      {
        id: 'global_variables',
        name: 'Global Variables',
        description: 'Avoid global variables, use constants or dependency injection',
        severity: 'design',
        check: (code) => /\$[a-zA-Z_]/.test(code)
      },
      {
        id: 'crypto_best_practices',
        name: 'Crypto Best Practices',
        description: 'Use secure random and proper crypto libraries',
        severity: 'security',
        check: (code) => /rand\(/.test(code) && code.includes('crypt')
      },
      {
        id: 'nil_checks',
        name: 'Nil Checks',
        description: 'Use nil? method instead of == nil',
        severity: 'style',
        check: (code) => /==\s*nil|!=\s*nil/.test(code)
      },
      {
        id: 'performance_blocks',
        name: 'Performance Blocks',
        description: 'Use blocks efficiently for better performance',
        severity: 'performance',
        check: (code) => /\.map\s*\{.*\}\.select/.test(code)
      }
    ];
  }

  /**
   * Initialize Ruby type inference system
   * @private
   */
  _initializeTypeInference() {
    this.typeInferenceRules = {
      // Method naming patterns for type inference
      booleanMethods: /\w+\?$/,
      setterMethods: /\w+=$/,
      bangedMethods: /\w+!$/,

      // Variable naming patterns
      constants: /^[A-Z][A-Z0-9_]*$/,
      instanceVars: /^@\w+/,
      classVars: /^@@\w+/,
      globalVars: /^\$\w+/,

      // Literal patterns
      symbols: /^:[a-zA-Z_]\w*$/,
      strings: /^["'].*["']$/,
      numbers: /^\d+(\.\d+)?$/,
      arrays: /^\[.*\]$/,
      hashes: /^\{.*\}$/,
      ranges: /^\d+\.\.\d+$/,
      regexps: /^\/.*\/[gimux]*$/
    };

    // Ruby built-in classes and their methods
    this.rubyBuiltins = {
      'String': ['length', 'size', 'empty?', 'include?', 'gsub', 'strip', 'downcase', 'upcase'],
      'Array': ['length', 'size', 'empty?', 'push', 'pop', 'each', 'map', 'select', 'reject'],
      'Hash': ['keys', 'values', 'empty?', 'has_key?', 'merge', 'each', 'map'],
      'Integer': ['times', 'upto', 'downto', 'odd?', 'even?', 'abs'],
      'Float': ['round', 'ceil', 'floor', 'abs'],
      'Regexp': ['match', 'match?', '=~'],
      'Symbol': ['to_s', 'to_proc'],
      'Range': ['each', 'include?', 'cover?', 'min', 'max'],
      'File': ['read', 'write', 'exist?', 'directory?', 'basename', 'dirname'],
      'Time': ['now', 'strftime', 'to_i', 'to_f']
    };
  }

  /**
   * Automatically detect required libraries based on code content
   * @private
   */
  _autoDetectRequires(code) {
    // Clear existing auto-detected requires (keep manually added ones)
    const manualRequires = new Set(this.requires);

    // Scan code for patterns that require specific libraries
    for (const [pattern, gemName] of this.autoRequirePatterns) {
      if (pattern.test(code)) {
        if (gemName && this.cryptoGems[gemName]) {
          // Add the required gem
          if (!this.cryptoGems[gemName].builtin) {
            this.gems.add(gemName);
          }

          // Add auto-requires for the gem
          this.cryptoGems[gemName].autoRequire.forEach(req => {
            this.requires.add(req);
          });
        }
      }
    }

    // Additional smart detection for common Ruby patterns
    this._detectCommonRubyLibraries(code);
  }

  /**
   * Detect common Ruby libraries that might be needed
   * @private
   */
  _detectCommonRubyLibraries(code) {
    // File I/O operations
    if (/File\.(read|write|open|exist|directory|size)/i.test(code)) {
      // File operations are built-in, no require needed
    }

    // Net/HTTP operations
    if (/Net::HTTP|HTTParty|Faraday/i.test(code)) {
      this.requires.add('net/http');
    }

    // CSV operations
    if (/CSV\.(parse|read|generate)/i.test(code)) {
      this.requires.add('csv');
    }

    // URI operations
    if (/URI\.(parse|join|encode)/i.test(code)) {
      this.requires.add('uri');
    }

    // Date/Time operations
    if (/DateTime\.|Date\.|Time\.strptime/i.test(code)) {
      this.requires.add('date');
    }

    // BigDecimal operations
    if (/BigDecimal/i.test(code)) {
      this.requires.add('bigdecimal');
    }

    // Set operations
    if (/Set\.new|\.to_set/i.test(code)) {
      this.requires.add('set');
    }

    // Matrix operations
    if (/Matrix\./i.test(code)) {
      this.requires.add('matrix');
    }

    // StringIO operations
    if (/StringIO/i.test(code)) {
      this.requires.add('stringio');
    }

    // YAML operations
    if (/YAML\.(load|dump|parse)/i.test(code)) {
      this.requires.add('yaml');
    }

    // Zlib compression
    if (/Zlib\.(inflate|deflate)/i.test(code)) {
      this.requires.add('zlib');
    }

    // Tempfile operations
    if (/Tempfile/i.test(code)) {
      this.requires.add('tempfile');
    }

    // Logger operations
    if (/Logger\.new/i.test(code)) {
      this.requires.add('logger');
    }

    // Benchmark operations
    if (/Benchmark\.(measure|bm)/i.test(code)) {
      this.requires.add('benchmark');
    }
  }

  /**
   * Generate Ruby code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.requires.clear();
      this.gems.clear();
      this.modules.clear();
      this.classes.clear();
      this.methods.clear();
      this.constants.clear();
      this.instanceVariables.clear();
      this.classVariables.clear();
      this.globalVariables.clear();

      // Merge options
      const mergedOptions = { ...this.options, ...options };

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Generate Ruby code
      const code = this._generateNode(ast, mergedOptions);

      // Auto-detect required libraries based on code content
      this._autoDetectRequires(code);

      // Add headers, requires, and script structure
      let finalCode = this._wrapWithHeaders(code, mergedOptions);

      // Apply line wrapping if maxLineLength is set
      if (mergedOptions.maxLineLength) {
        finalCode = this._wrapLongLines(finalCode, mergedOptions);
      }

      // Apply line ending style
      finalCode = this._applyLineEnding(finalCode, mergedOptions);

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Generate warnings
      const warnings = this._generateWarnings(ast, finalCode, mergedOptions);

      return this.CreateSuccessResult(finalCode, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Ruby code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate code for any AST node with comprehensive Ruby 3.3+ support
   * @private
   */
  _generateNode(node, options) {
    if (!node || !node.type) {
      return '';
    }

    switch (node.type) {
      // Program and structure
      case 'Program':
        return this._generateProgram(node, options);
      case 'ModuleDeclaration':
        return this._generateModule(node, options);
      case 'ClassDeclaration':
        return this._generateClass(node, options);
      case 'ClassExpression':
        return this._generateClassExpression(node, options);

      // Functions and methods
      case 'FunctionDeclaration':
        return this._generateMethod(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      case 'MethodDefinition':
        return this._generateMethodDefinition(node, options);

      // Statements
      case 'BlockStatement':
        return this._generateBlock(node, options);
      case 'ExpressionStatement':
        return this._generateExpressionStatement(node, options);
      case 'ReturnStatement':
        return this._generateReturnStatement(node, options);
      case 'BreakStatement':
        return this._generateBreakStatement(node, options);
      case 'ContinueStatement':
        return this._generateContinueStatement(node, options);
      case 'ThrowStatement':
        return this._generateThrowStatement(node, options);
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'DebuggerStatement':
        return this._generateDebuggerStatement(node, options);
      case 'LabeledStatement':
        return this._generateLabeledStatement(node, options);

      // Variable declarations
      case 'VariableDeclaration':
        return this._generateVariableDeclaration(node, options);
      case 'VariableDeclarator':
        return this._generateVariableDeclarator(node, options);

      // Control flow
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'DoWhileStatement':
        return this._generateDoWhileStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'ForInStatement':
        return this._generateForInStatement(node, options);
      case 'ForOfStatement':
        return this._generateForOfStatement(node, options);
      case 'SwitchStatement':
        return this._generateSwitchStatement(node, options);
      case 'SwitchCase':
        return this._generateSwitchCase(node, options);

      // Exception handling
      case 'TryStatement':
        return this._generateTryStatement(node, options);
      case 'CatchClause':
        return this._generateCatchClause(node, options);

      // Expressions
      case 'AssignmentExpression':
        return this._generateAssignmentExpression(node, options);
      case 'BinaryExpression':
        return this._generateBinaryExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
      case 'SequenceExpression':
        return this._generateSequenceExpression(node, options);

      // Function calls and member access
      case 'CallExpression':
        return this._generateCallExpression(node, options);
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'MemberExpression':
        return this._generateMemberExpression(node, options);
      case 'ChainExpression':
        return this._generateChainExpression(node, options);

      // Literals and identifiers
      case 'Identifier':
        return this._generateIdentifier(node, options);
      case 'Literal':
        return this._generateLiteral(node, options);
      case 'PrivateIdentifier':
        return this._generatePrivateIdentifier(node, options);
      case 'Super':
        return 'super';
      case 'ThisExpression':
        return 'self';
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);

      // Array and object expressions
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'Property':
        return this._generateProperty(node, options);
      case 'PropertyDefinition':
        return this._generatePropertyDefinition(node, options);

      // Template literals
      case 'TemplateLiteral':
        return this._generateTemplateLiteral(node, options);
      case 'TaggedTemplateExpression':
        return this._generateTaggedTemplateExpression(node, options);

      // Destructuring and patterns
      case 'ArrayPattern':
        return this._generateArrayPattern(node, options);
      case 'ObjectPattern':
        return this._generateObjectPattern(node, options);
      case 'AssignmentPattern':
        return this._generateAssignmentPattern(node, options);
      case 'RestElement':
        return this._generateRestElement(node, options);
      case 'SpreadElement':
        return this._generateSpreadElement(node, options);

      // Async and generators
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);

      // Imports and exports
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ImportExpression':
        return this._generateImportExpression(node, options);
      case 'ExportDefaultDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ExportNamedDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ExportAllDeclaration':
        return this._generateExportDeclaration(node, options);

      // Special Ruby constructs
      case 'StaticBlock':
        return this._generateStaticBlock(node, options);
      case 'WithStatement':
        return this._generateWithStatement(node, options);
      case 'OptionalCallExpression':
        return this._generateOptionalCallExpression(node, options);
      case 'OptionalMemberExpression':
        return this._generateOptionalMemberExpression(node, options);
      case 'JSXElement':
        return this._generateJSXElement(node, options);
      case 'JSXFragment':
        return this._generateJSXFragment(node, options);
      case 'TSAsExpression':
        return this._generateTSAsExpression(node, options);

      default:
        return this._generateFallbackNode(node, options);
    }
  }

  /**
   * Generate program (root level)
   * @private
   */
  _generateProgram(node, options) {
    if (!node.body || !Array.isArray(node.body)) {
      return '';
    }

    const statements = node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(code => code.trim() !== '');

    return statements.join('\n\n');
  }

  /**
   * Generate Ruby module
   * @private
   */
  _generateModule(node, options) {
    const moduleName = node.id ? this._toRubyConstant(node.id.name) : 'UnnamedModule';
    this.modules.add(moduleName);
    let code = '';

    // Module comment
    if (options.addYardDoc) {
      code += this._indent('##\n');
      code += this._indent(`# ${moduleName} module\n`);
      code += this._indent('# Provides functionality for the application\n');
      code += this._indent('#\n');
      code += this._indent('# @author Generated by SynthelicZ Cipher Tools\n');
      code += this._indent('# @since Ruby 3.3+\n');
    }

    // Module declaration
    code += this._indent(`module ${moduleName}\n`);

    // Module body
    this.indentLevel++;
    if (node.body && node.body.length > 0) {
      const bodyCode = node.body
        .map(stmt => this._generateNode(stmt, options))
        .filter(code => code.trim())
        .join('\n\n');
      if (bodyCode) {
        code += bodyCode + '\n';
      }
    }
    this.indentLevel--;

    code += this._indent('end\n');

    return code;
  }

  /**
   * Generate Ruby class with modern features
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? this._toRubyConstant(node.id.name) : 'UnnamedClass';
    this.classes.add(className);
    let code = '';

    // Class comment with YARD documentation
    if (options.addYardDoc) {
      code += this._indent('##\n');
      code += this._indent(`# ${className} class\n`);
      code += this._indent('# Represents a Ruby class with modern Ruby 3.3+ features\n');
      code += this._indent('#\n');
      code += this._indent('# @author Generated by SynthelicZ Cipher Tools\n');
      code += this._indent('# @since Ruby 3.3+\n');
      if (node.superClass) {
        const superName = this._generateNode(node.superClass, options);
        code += this._indent(`# @see ${superName}\n`);
      }
    }

    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className} < ${superName}\n`);
    } else {
      code += this._indent(`class ${className}\n`);
    }

    // Class body
    this.indentLevel++;

    // Add common Ruby class patterns
    if (options.addComments) {
      code += this._indent('# Class constants\n');
      code += this._indent('# Add VERSION, constants, etc.\n\n');

      code += this._indent('# Class variables\n');
      code += this._indent('# @@instances = []\n\n');

      code += this._indent('# Attribute accessors\n');
      code += this._indent('# attr_reader :id\n');
      code += this._indent('# attr_writer :name\n');
      code += this._indent('# attr_accessor :status\n\n');
    }

    // Generate class body
    if (node.body && node.body.body && node.body.body.length > 0) {
      const methods = node.body.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      if (methods.length > 0) {
        code += methods.join('\n\n') + '\n';
      }
    }

    // Add default methods if empty class
    if (!node.body || !node.body.body || node.body.body.length === 0) {
      if (options.addComments) {
        code += this._indent('# Default initialize method\n');
      }
      code += this._indent('def initialize\n');
      this.indentLevel++;
      code += this._indent('# Initialize new instance\n');
      code += this._indent('super if defined?(super)\n');
      this.indentLevel--;
      code += this._indent('end\n');
    }

    this.indentLevel--;
    code += this._indent('end\n');

    return code;
  }

  /**
   * Generate Ruby method with modern features
   * @private
   */
  _generateMethod(node, options) {
    const methodName = node.id ? this._toRubyMethod(node.id.name) : 'unnamed_method';
    this.methods.add(methodName);
    let code = '';

    // YARD documentation
    if (options.addYardDoc) {
      code += this._indent('##\n');
      code += this._indent(`# ${methodName} method\n`);
      code += this._indent('# Performs the specified operation\n');
      code += this._indent('#\n');

      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = this._getParameterName(param);
          const paramType = this._inferRubyType(paramName);
          code += this._indent(`# @param ${paramName} [${paramType}] parameter description\n`);
        });
      }

      const returnType = this._inferReturnType(methodName);
      code += this._indent(`# @return [${returnType}] return value description\n`);

      // Add memoization note if applicable
      if (options.useMemoization && this._shouldMemoize(node, methodName)) {
        code += this._indent('# @note This method uses memoization for performance\n');
      }

      code += this._indent('#\n');
    }

    // Add type annotations if enabled
    if (options.addTypeAnnotations || options.addSorbetTypes) {
      code += this._generateTypeSignature(node, methodName, options);
    }

    // Method signature with modern Ruby features
    if (options.useEndlessMethods && this._isSimpleMethod(node)) {
      return this._generateEndlessMethod(node, options);
    }

    code += this._indent(`def ${methodName}`);

    // Parameters with keyword arguments and defaults
    if (node.params && node.params.length > 0) {
      const params = this._generateMethodParameters(node.params, options);
      code += `(${params})`;
    }
    code += '\n';

    // Method body
    this.indentLevel++;

    // Add memoization implementation if enabled
    if (options.useMemoization && this._shouldMemoize(node, methodName)) {
      code += this._indent(`@${methodName}_memo ||= begin\n`);
      this.indentLevel++;
    }

    // Add debug info if enabled
    if (options.addDebugInfo) {
      code += this._indent(`puts "DEBUG: Entering method ${methodName}"\n`);
    }

    // Add performance hint comments
    if (options.addPerformanceHints && this._hasPerformanceIssues(methodName)) {
      code += this._indent(`# PERFORMANCE: Consider optimizing this method\n`);
    }

    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      if (bodyCode && bodyCode.trim()) {
        code += bodyCode;
        if (!bodyCode.endsWith('\n')) {
          code += '\n';
        }
      } else {
        if (options.generateTODOs) {
          code += this._indent(`# TODO: Implement ${methodName}\n`);
        } else {
          code += this._indent(`# Implementation for ${methodName}\n`);
        }
        code += this._indent('nil\n');
      }
    } else {
      if (options.generateTODOs) {
        code += this._indent(`# TODO: Implement ${methodName}\n`);
      } else {
        code += this._indent(`# Implementation for ${methodName}\n`);
      }
      code += this._indent('nil\n');
    }

    // Close memoization block
    if (options.useMemoization && this._shouldMemoize(node, methodName)) {
      this.indentLevel--;
      code += this._indent('end\n');
    }

    this.indentLevel--;

    code += this._indent('end\n');

    // Add linting hints
    if (options.addLinting) {
      code += this._generateLintingHints(methodName, node);
    }

    return code;
  }

  /**
   * Generate endless method (Ruby 3.0+ feature)
   * @private
   */
  _generateEndlessMethod(node, options) {
    const methodName = node.id ? this._toRubyMethod(node.id.name) : 'unnamed_method';
    let code = '';

    // Simple one-liner comment
    if (options.addComments) {
      code += this._indent(`# ${methodName} method - endless method syntax\n`);
    }

    code += this._indent(`def ${methodName}`);

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = this._generateMethodParameters(node.params, options);
      code += `(${params})`;
    }

    // Body as expression
    const bodyExpr = this._extractSimpleExpression(node.body);
    code += ` = ${bodyExpr}\n`;

    return code;
  }

  /**
   * Generate method parameters with Ruby features
   * @private
   */
  _generateMethodParameters(params, options) {
    return params.map(param => {
      const paramName = this._getParameterName(param);

      // Handle different parameter types
      if (param.type === 'RestElement') {
        return `*${paramName}`;
      } else if (param.type === 'AssignmentPattern') {
        const defaultValue = this._generateNode(param.right, options);
        if (options.useKeywordArguments) {
          return `${paramName}: ${defaultValue}`;
        } else {
          return `${paramName} = ${defaultValue}`;
        }
      } else if (options.useKeywordArguments && this._shouldUseKeywordArg(param)) {
        return `${paramName}:`;
      } else {
        return paramName;
      }
    }).join(', ');
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('nil\n');
    }

    const statements = node.body
      .map(stmt => {
        const code = this._generateNode(stmt, options);
        if (!code || !code.trim()) {
          return '';
        }
        // Ensure each statement has proper indentation
        if (!code.startsWith(this.options.indent.repeat(this.indentLevel))) {
          return this._indentCode(code);
        }
        return code;
      })
      .filter(code => code.trim());

    if (statements.length === 0) {
      return this._indent('nil\n');
    }

    return statements.join('');
  }

  /**
   * Apply indentation to code that doesn't already have it
   * @private
   */
  _indentCode(code) {
    if (!code) return '';

    const lines = code.split('\n');
    const indentStr = this.options.indent.repeat(this.indentLevel);

    return lines.map(line => {
      if (!line.trim()) return line; // Preserve empty lines
      if (line.startsWith(indentStr)) return line; // Already indented
      return indentStr + line.replace(/^\s*/, ''); // Apply indentation
    }).join('\n');
  }

  /**
   * Apply line ending style to code
   * @private
   */
  _applyLineEnding(code, options) {
    if (!code) return '';
    if (options.lineEnding === '\n') return code; // Default, no change needed
    return code.replace(/\n/g, options.lineEnding);
  }

  /**
   * Wrap long lines according to maxLineLength
   * @private
   */
  _wrapLongLines(code, options) {
    if (!code || !options.maxLineLength) return code;

    const lines = code.split('\n');
    const wrapped = [];

    lines.forEach(line => {
      if (line.length <= options.maxLineLength) {
        wrapped.push(line);
        return;
      }

      // Don't wrap comments, strings, or special lines
      if (line.trim().startsWith('#') || line.includes('"') || line.includes("'")) {
        wrapped.push(line);
        return;
      }

      // Simple line wrapping for method chains and expressions
      const indent = line.match(/^\s*/)[0];
      let remaining = line.trim();

      while (remaining.length > options.maxLineLength - indent.length) {
        let breakPoint = remaining.lastIndexOf(' ', options.maxLineLength - indent.length - 2);
        if (breakPoint === -1) {
          wrapped.push(indent + remaining);
          break;
        }

        wrapped.push(indent + remaining.substring(0, breakPoint).trim() + ' \\');
        remaining = remaining.substring(breakPoint).trim();
      }

      if (remaining.length > 0) {
        wrapped.push(indent + this.options.indent + remaining);
      }
    });

    return wrapped.join('\n');
  }

  /**
   * Generate variable declaration with Ruby patterns
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';

    return node.declarations
      .map(decl => this._generateVariableDeclarator(decl, options))
      .filter(code => code.trim())
      .join('\n');
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const varName = this._generateNode(node.id, options);

    if (node.init) {
      const initValue = this._generateNode(node.init, options);

      // Handle different variable types
      if (this._isConstant(varName)) {
        this.constants.add(varName);
        return this._indent(`${varName} = ${initValue}\n`);
      } else if (this._isInstanceVariable(varName)) {
        this.instanceVariables.add(varName);
        return this._indent(`${varName} = ${initValue}\n`);
      } else if (this._isClassVariable(varName)) {
        this.classVariables.add(varName);
        return this._indent(`${varName} = ${initValue}\n`);
      } else if (this._isGlobalVariable(varName)) {
        this.globalVariables.add(varName);
        return this._indent(`${varName} = ${initValue}\n`);
      } else {
        return this._indent(`${varName} = ${initValue}\n`);
      }
    } else {
      return this._indent(`${varName} = nil\n`);
    }
  }

  /**
   * Generate expression statement
   * @private
   */
  _generateExpressionStatement(node, options) {
    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(expr + '\n') : '';
  }

  /**
   * Generate return statement (Ruby implicit returns)
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      // Ruby typically uses implicit returns, but explicit return is valid
      if (options.useGuardClauses || this._isGuardClause(node)) {
        return this._indent(`return ${returnValue}\n`);
      } else {
        return this._indent(`${returnValue}\n`); // Implicit return
      }
    } else {
      return this._indent('nil\n');
    }
  }

  /**
   * Generate if statement with Ruby idioms
   * @private
   */
  _generateIfStatement(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    let code = '';

    // Use guard clause pattern if appropriate
    if (options.useGuardClauses && this._isGuardClause(node.consequent)) {
      const guardBody = consequent && consequent.trim() ? consequent.trim() : 'nil';
      code += this._indent(`return ${guardBody} if ${test}\n`);
      if (node.alternate) {
        const alternate = this._generateNode(node.alternate, options);
        code += alternate;
      }
      return code;
    }

    // Standard if statement
    code += this._indent(`if ${test}\n`);
    this.indentLevel++;

    if (consequent && consequent.trim()) {
      code += consequent;
    } else {
      // Generate a meaningful default if block
      code += this._indent('# if condition is true\n');
      code += this._indent('nil\n');
    }
    this.indentLevel--;

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        code += this._indent('elsif ');
        const altTest = this._generateNode(node.alternate.test, options);
        code += `${altTest}\n`;
        this.indentLevel++;
        const altConsequent = this._generateNode(node.alternate.consequent, options);
        if (altConsequent && altConsequent.trim()) {
          code += altConsequent;
        } else {
          code += this._indent('# elsif condition is true\n');
          code += this._indent('nil\n');
        }
        this.indentLevel--;

        if (node.alternate.alternate) {
          code += this._indent('else\n');
          this.indentLevel++;
          const elseBody = this._generateNode(node.alternate.alternate, options);
          if (elseBody && elseBody.trim()) {
            code += elseBody;
          } else {
            code += this._indent('# else condition\n');
            code += this._indent('nil\n');
          }
          this.indentLevel--;
        }
      } else {
        code += this._indent('else\n');
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        if (alternate && alternate.trim()) {
          code += alternate;
        } else {
          code += this._indent('# else condition\n');
          code += this._indent('nil\n');
        }
        this.indentLevel--;
      }
    }

    code += this._indent('end\n');
    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    const test = this._generateNode(node.test, options);
    const body = this._generateNode(node.body, options);
    let code = '';

    code += this._indent(`while ${test}\n`);
    this.indentLevel++;
    if (body && body.trim()) {
      code += body;
    } else {
      // Generate meaningful default loop body
      code += this._indent('# while loop body\n');
      code += this._indent('break # prevent infinite loop\n');
    }
    this.indentLevel--;
    code += this._indent('end\n');

    return code;
  }

  /**
   * Generate for statement as Ruby iterator
   * @private
   */
  _generateForStatement(node, options) {
    // Convert JavaScript for loop to Ruby iterator
    if (this._isSimpleForLoop(node)) {
      // Use blocks for iteration if enabled (default Ruby style)
      if (options.useBlocksForIteration !== false) {
        return this._generateRubyRangeLoop(node, options);
      }
    }

    // Fallback to while loop
    let code = '';
    if (node.init) {
      const init = this._generateNode(node.init, options);
      if (init && init.trim()) {
        code += init;
      }
    }

    const test = node.test ? this._generateNode(node.test, options) : 'true';
    code += this._indent(`while ${test}\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      if (body && body.trim()) {
        code += body;
      } else {
        code += this._indent('# for loop body\n');
        code += this._indent('nil\n');
      }
    }
    if (node.update) {
      const update = this._generateNode(node.update, options);
      if (update && update.trim()) {
        code += this._indent(update + '\n');
      }
    }
    this.indentLevel--;

    code += this._indent('end\n');
    return code;
  }

  /**
   * Generate for-in statement as Ruby each
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left.type === 'VariableDeclaration' ?
      node.left.declarations[0].id : node.left, options);
    const right = this._generateNode(node.right, options);
    const body = this._generateNode(node.body, options);

    let code = this._indent(`${right}.each do |${left}|\n`);
    this.indentLevel++;
    if (body && body.trim()) {
      code += body;
    } else {
      code += this._indent(`# iterate with ${left}\n`);
      code += this._indent('nil\n');
    }
    this.indentLevel--;
    code += this._indent('end\n');

    return code;
  }

  /**
   * Generate for-of statement as Ruby each
   * @private
   */
  _generateForOfStatement(node, options) {
    return this._generateForInStatement(node, options);
  }

  /**
   * Generate switch statement as Ruby case
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);
    let code = '';

    if (options.useCaseExpressions) {
      code += this._indent(`case ${discriminant}\n`);

      if (node.cases) {
        node.cases.forEach(caseNode => {
          if (caseNode.test) {
            const test = this._generateNode(caseNode.test, options);
            code += this._indent(`when ${test}\n`);
          } else {
            code += this._indent('else\n');
          }

          this.indentLevel++;
          if (caseNode.consequent && caseNode.consequent.length > 0) {
            const consequent = caseNode.consequent
              .map(stmt => this._generateNode(stmt, options))
              .filter(c => c && c.trim())
              .join('\n');
            if (consequent && consequent.trim()) {
              code += consequent;
            } else {
              code += this._indent('# case condition\n');
              code += this._indent('nil\n');
            }
          } else {
            code += this._indent('# case condition\n');
            code += this._indent('nil\n');
          }
          this.indentLevel--;
        });
      }

      code += this._indent('end\n');
    } else {
      // Convert to if-elsif chain
      code += this._convertSwitchToIf(node, options);
    }

    return code;
  }

  /**
   * Generate try statement as begin-rescue
   * @private
   */
  _generateTryStatement(node, options) {
    let code = this._indent('begin\n');

    this.indentLevel++;
    if (node.block) {
      const blockCode = this._generateNode(node.block, options);
      if (blockCode && blockCode.trim()) {
        code += blockCode;
      } else {
        code += this._indent('# try block\n');
        code += this._indent('nil\n');
      }
    }
    this.indentLevel--;

    if (node.handler) {
      const param = node.handler.param ?
        this._generateNode(node.handler.param, options) : 'e';
      code += this._indent(`rescue => ${param}\n`);

      this.indentLevel++;
      if (node.handler.body) {
        const catchCode = this._generateNode(node.handler.body, options);
        if (catchCode && catchCode.trim()) {
          code += catchCode;
        } else {
          code += this._indent(`# handle ${param}\n`);
          code += this._indent('nil\n');
        }
      } else {
        code += this._indent(`# handle ${param}\n`);
        code += this._indent('nil\n');
      }
      this.indentLevel--;
    }

    if (node.finalizer) {
      code += this._indent('ensure\n');
      this.indentLevel++;
      const finallyCode = this._generateNode(node.finalizer, options);
      if (finallyCode && finallyCode.trim()) {
        code += finallyCode;
      } else {
        code += this._indent('# ensure cleanup\n');
        code += this._indent('nil\n');
      }
      this.indentLevel--;
    }

    code += this._indent('end\n');
    return code;
  }

  /**
   * Generate binary expression with Ruby operators and OpCodes
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;

    // Map JavaScript operators to Ruby
    operator = this._mapOperator(operator);

    // OpCodes integration for crypto operations
    if (options.enableOpCodesIntegration && this._isCryptoOperation(node, operator)) {
      return this._generateOpCodesOperation(node, left, right, operator, options);
    }

    // Handle string concatenation
    if (operator === '+' && this._isStringConcatenation(node)) {
      if (options.useStringInterpolation) {
        return `"#{${left}}#{${right}}"`;
      } else {
        return `${left} + ${right}`;
      }
    }

    // Handle equality operations
    if (operator === '==' && options.useNilGuards) {
      if (this._isNilComparison(node)) {
        return `${left}.nil?`;
      }
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression with Ruby method calls and OpCodes
   * @private
   */
  _generateCallExpression(node, options) {
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle function calls
    const functionName = this._getFunctionName(node.callee);

    // Replace insecure random with SecureRandom when enabled
    if (options.useSecureRandom) {
      if (functionName === 'random' || functionName === 'Math.random') {
        this.requires.add('securerandom');
        return 'SecureRandom.random_number';
      }
      if (functionName === 'randomBytes') {
        this.requires.add('securerandom');
        return `SecureRandom.bytes(${args})`;
      }
      if (functionName === 'randomInt') {
        this.requires.add('securerandom');
        return `SecureRandom.random_number(${args})`;
      }
    }

    // OpCodes integration for crypto operations
    if (options.enableOpCodesIntegration && this.cryptoOperations[functionName]) {
      return this._generateCryptoOperation(functionName, args, options);
    }

    // Handle method calls
    if (node.callee && node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const method = this._getMethodName(node.callee.property);
      const rubyMethod = this._mapMethodToRuby(method);

      // Safe navigation operator
      if (options.useSafeNavigation && this._mightBeNil(object)) {
        return `${object}&.${rubyMethod}(${args})`;
      }

      // Regular method call
      if (args) {
        return `${object}.${rubyMethod}(${args})`;
      } else {
        return `${object}.${rubyMethod}`;
      }
    }

    // Function calls
    const callee = this._generateNode(node.callee, options);
    const rubyFunction = this._mapMethodToRuby(callee);

    if (args) {
      return `${rubyFunction}(${args})`;
    } else {
      return `${rubyFunction}`;
    }
  }

  /**
   * Generate member expression with Ruby syntax
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);

    if (node.computed) {
      const property = this._generateNode(node.property, options);
      return `${object}[${property}]`;
    } else {
      const property = this._getPropertyName(node.property);
      const rubyProperty = this._toRubyMethod(property);

      // Convert this._property to @property (instance variable syntax)
      if (object === 'self') {
        return `@${rubyProperty}`;
      }

      // Use double colon for constants when enabled
      if (options.useDoubleColonForConstants && this._isConstant(property)) {
        return `${object}::${this._toRubyConstant(property)}`;
      }

      // Safe navigation operator (but not for arrays or basic method calls)
      if (options.useSafeNavigation && this._mightBeNil(object)) {
        return `${object}&.${rubyProperty}`;
      }

      return `${object}.${rubyProperty}`;
    }
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);

    // Handle parallel assignment for arrays
    if (node.left.type === 'ArrayPattern') {
      return `${left} = ${right}`;
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const elements = node.elements.map(element => {
      if (element === null) {
        return 'nil';
      }
      return this._generateNode(element, options);
    });

    // Use %w() for string arrays if appropriate
    if (options.useModernSyntax && this._isStringArray(node.elements)) {
      const strings = elements.map(s => s.replace(/['"]/g, ''));
      return `%w[${strings.join(' ')}]`;
    }

    return `[${elements.join(', ')}]`;
  }

  /**
   * Generate object expression as Ruby hash
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '{}';
    }

    const properties = node.properties.map(prop => {
      return this._generateProperty(prop, options);
    });

    // Multiline hash for readability
    if (properties.length > 3) {
      let code = '{\n';
      this.indentLevel++;
      properties.forEach((prop, index) => {
        code += this._indent(prop);
        if (index < properties.length - 1) {
          code += ',';
        }
        code += '\n';
      });
      this.indentLevel--;
      code += this._indent('}');
      return code;
    } else {
      return `{ ${properties.join(', ')} }`;
    }
  }

  /**
   * Generate property for hash
   * @private
   */
  _generateProperty(node, options) {
    const key = this._generatePropertyKey(node.key, options);
    const value = this._generateNode(node.value, options);

    // Use symbol keys where appropriate
    if (options.useSymbolsForKeys && this._canBeSymbol(key)) {
      const symbolKey = key.replace(/['"]/g, '');
      return `${symbolKey}: ${value}`;
    } else {
      return `${key} => ${value}`;
    }
  }

  /**
   * Generate template literal as string interpolation
   * @private
   */
  _generateTemplateLiteral(node, options) {
    if (!node.quasis || !node.expressions) {
      return '""';
    }

    let result = '"';
    for (let i = 0; i < node.quasis.length; i++) {
      result += node.quasis[i].value.raw;
      if (i < node.expressions.length) {
        const expr = this._generateNode(node.expressions[i], options);
        result += `#{${expr}}`;
      }
    }
    result += '"';

    return result;
  }

  /**
   * Generate identifier with Ruby naming conventions
   * @private
   */
  _generateIdentifier(node, options) {
    const name = node.name;

    // Handle different identifier types
    if (this._isConstant(name)) {
      return this._toRubyConstant(name);
    } else if (this._isInstanceVariable(name)) {
      return name; // Already has @
    } else if (this._isClassVariable(name)) {
      return name; // Already has @@
    } else if (this._isGlobalVariable(name)) {
      return name; // Already has $
    } else {
      return this._toRubyMethod(name);
    }
  }

  /**
   * Generate literal with Ruby syntax
   * @private
   */
  _generateLiteral(node, options) {
    if (node.value === null) {
      return 'nil';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else if (typeof node.value === 'string') {
      // Use appropriate string literal
      if (options.useFrozenStringLiteral && this._isImmutableString(node)) {
        return `'${node.value.replace(/'/g, "\\'")}'.freeze`;
      } else {
        return `'${node.value.replace(/'/g, "\\'")}'`;
      }
    } else if (typeof node.value === 'number') {
      return String(node.value);
    } else if (node.regex) {
      return `/${node.regex.pattern}/${node.regex.flags || ''}`;
    } else {
      return String(node.value);
    }
  }

  /**
   * Generate OpCodes crypto operation
   * @private
   */
  _generateOpCodesOperation(node, left, right, operator, options) {
    switch (operator) {
      case '<<':
        return `${this.cryptoOperations.rotateLeft}(${left}, ${right})`;
      case '>>':
        return `${this.cryptoOperations.rotateRight}(${left}, ${right})`;
      case '^':
        if (this._isArrayXor(node)) {
          return `${this.cryptoOperations.xorArrays}(${left}, ${right})`;
        }
        return `${left} ${operator} ${right}`;
      case '&':
        return `${left} & ${right}`;
      case '|':
        return `${left} | ${right}`;
      default:
        return `${left} ${operator} ${right}`;
    }
  }

  /**
   * Generate crypto operation with Ruby gems
   * @private
   */
  _generateCryptoOperation(functionName, args, options) {
    const operation = this.cryptoOperations[functionName];

    if (typeof operation === 'function') {
      // OpCodes function
      return operation(args);
    } else if (typeof operation === 'string') {
      // Ruby method - use gems if enabled, otherwise use native Ruby
      if (options.useCryptoGems !== false && operation.includes('::')) {
        // Add required gem
        const gemName = operation.split('::')[0].toLowerCase();
        if (this.cryptoGems[gemName]) {
          this.gems.add(gemName);
        }

        if (args) {
          return `${operation}(${args})`;
        } else {
          return operation;
        }
      } else {
        // Use native Ruby bitwise operations if gems are disabled
        if (functionName === 'rotateLeft' || functionName === 'RotL32') {
          return `((${args.split(',')[0].trim()} << ${args.split(',')[1].trim()}) | (${args.split(',')[0].trim()} >> (32 - ${args.split(',')[1].trim()})))`;
        }
        if (functionName === 'rotateRight' || functionName === 'RotR32') {
          return `((${args.split(',')[0].trim()} >> ${args.split(',')[1].trim()}) | (${args.split(',')[0].trim()} << (32 - ${args.split(',')[1].trim()})))`;
        }

        if (args) {
          return `${operation}(${args})`;
        } else {
          return operation;
        }
      }
    }

    return `${functionName}(${args})`;
  }

  /**
   * Wrap generated code with comprehensive headers
   * @private
   */
  _wrapWithHeaders(code, options) {
    let result = '';

    // Shebang for executable scripts
    if (options.addShebang) {
      result += '#!/usr/bin/env ruby\n';
    }

    // Frozen string literal pragma
    if (options.useFrozenStringLiteral) {
      result += '# frozen_string_literal: true\n';
    }

    // File header
    if (options.addComments) {
      result += '\n##\n';
      result += '# Generated Ruby code\n';
      result += '# This file was automatically generated from JavaScript AST\n';
      result += '# \n';
      result += '# @author SynthelicZ Cipher Tools\n';
      result += '# @version 3.0.0\n';
      result += '# @since Ruby 3.3+\n';
      result += '#\n';
      result += '# Features used:\n';

      if (options.usePatternMatching) result += '# - Pattern matching (Ruby 3.0+)\n';
      if (options.useEndlessMethods) result += '# - Endless methods (Ruby 3.0+)\n';
      if (options.useKeywordArguments) result += '# - Keyword arguments\n';
      if (options.enableOpCodesIntegration) result += '# - OpCodes cryptographic operations\n';
      if (this.gems.size > 0) result += `# - Gems: ${Array.from(this.gems).join(', ')}\n`;

      result += '\n';
    }

    // Requires and gems
    if (this.requires.size > 0) {
      result += '# Standard library requires\n';
      Array.from(this.requires).sort().forEach(req => {
        result += `require '${req}'\n`;
      });
      result += '\n';
    }

    if (this.gems.size > 0) {
      result += '# Gem requires\n';
      Array.from(this.gems).sort().forEach(gem => {
        result += `require '${gem}'\n`;
      });
      result += '\n';
    }

    // Security warnings
    if (options.addSecurityComments && this._hasSecurityImplications(code)) {
      result += '# SECURITY NOTICE:\n';
      result += '# This code contains cryptographic operations.\n';
      result += '# Ensure proper key management and secure coding practices.\n';
      result += '# Review all crypto operations before production use.\n\n';
    }

    // Generated code
    result += code;

    // Enhanced main execution block with example usage
    if (options.addComments) {
      result += this._generateEnhancedMainBlock(code, options);
    }

    return result;
  }

  /**
   * Generate enhanced main execution block with example usage
   * @private
   */
  _generateEnhancedMainBlock(code, options) {
    let mainBlock = '\n\n# Main execution with example usage\n';
    mainBlock += 'if __FILE__ == $PROGRAM_NAME\n';

    // Extract function/method names from the generated code for demo calls
    const functionNames = this._extractFunctionNames(code);
    const classNames = Array.from(this.classes);

    if (functionNames.length > 0 || classNames.length > 0) {
      mainBlock += '  puts "🚀 Running generated Ruby code..."\n';
      mainBlock += '  puts ""\n\n';

      // Generate example calls for functions
      functionNames.forEach(funcName => {
        mainBlock += this._generateExampleFunctionCall(funcName, code);
      });

      // Generate example class usage
      classNames.forEach(className => {
        mainBlock += this._generateExampleClassUsage(className, code);
      });

      mainBlock += '  puts ""\n';
      mainBlock += '  puts "✅ Execution completed successfully!"\n';
    } else {
      mainBlock += '  puts "📄 Generated Ruby code loaded successfully"\n';
      mainBlock += '  puts "💡 Add function calls or class instantiation to see examples"\n';
    }

    mainBlock += 'end\n';
    return mainBlock;
  }

  /**
   * Extract function names from generated code for example usage
   * @private
   */
  _extractFunctionNames(code) {
    const functionRegex = /^def\s+(\w+)/gm;
    const functions = [];
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      functions.push(match[1]);
    }

    return functions.filter(name =>
      name !== 'initialize' &&
      !name.startsWith('_') &&
      !name.endsWith('=')
    );
  }

  /**
   * Generate example function call with realistic test data
   * @private
   */
  _generateExampleFunctionCall(functionName, code) {
    let example = `  # Example usage of ${functionName}\n`;

    // Extract parameter information from the function definition
    const paramRegex = new RegExp(`def\\s+${functionName}\\s*\\(([^)]*)\\)`, 'i');
    const keywordParamRegex = new RegExp(`def\\s+${functionName}\\s*\\(([^)]*)\\)`, 'i');

    const match = code.match(paramRegex);
    let params = [];
    let isKeywordArgs = false;

    if (match && match[1]) {
      const paramStr = match[1].trim();
      if (paramStr.includes(':')) {
        isKeywordArgs = true;
        params = paramStr.split(',').map(p => p.trim().split(':')[0]);
      } else {
        params = paramStr.split(',').map(p => p.trim());
      }
    }

    // Generate example data based on parameter names and context
    const exampleData = this._generateExampleData(params, functionName);

    if (isKeywordArgs && params.length > 0) {
      const keywordArgs = params.map((param, i) => `${param}: ${exampleData[i] || 'nil'}`).join(', ');
      example += `  result = ${functionName}(${keywordArgs})\n`;
    } else if (params.length > 0) {
      const args = exampleData.slice(0, params.length).join(', ');
      example += `  result = ${functionName}(${args})\n`;
    } else {
      example += `  result = ${functionName}\n`;
    }

    example += `  puts "${functionName} result: \#{result}"\n`;
    example += '  puts ""\n\n';

    return example;
  }

  /**
   * Generate example class usage
   * @private
   */
  _generateExampleClassUsage(className, code) {
    let example = `  # Example usage of ${className} class\n`;
    example += `  instance = ${className}.new\n`;

    // Look for public methods in the class
    const methodRegex = new RegExp(`class\\s+${className}[\\s\\S]*?def\\s+(\\w+)`, 'gi');
    const methods = [];
    let match;

    while ((match = methodRegex.exec(code)) !== null) {
      const methodName = match[1];
      if (methodName !== 'initialize' && !methodName.startsWith('_')) {
        methods.push(methodName);
      }
    }

    if (methods.length > 0) {
      const firstMethod = methods[0];
      example += `  result = instance.${firstMethod}\n`;
      example += `  puts "${className}#${firstMethod} result: \#{result}"\n`;
    } else {
      example += `  puts "${className} instance created: \#{instance}"\n`;
    }

    example += '  puts ""\n\n';
    return example;
  }

  /**
   * Generate realistic example data for function parameters
   * @private
   */
  _generateExampleData(params, functionName) {
    return params.map(param => {
      const paramName = param.toLowerCase();

      // Crypto-related parameter examples
      if (paramName.includes('key')) {
        return "'secretkey123'";
      }
      if (paramName.includes('data') || paramName.includes('message') || paramName.includes('text')) {
        return "'Hello, World!'";
      }
      if (paramName.includes('iv') || paramName.includes('nonce')) {
        return "'1234567890123456'";
      }
      if (paramName.includes('salt')) {
        return "'randomsalt'";
      }
      if (paramName.includes('password') || paramName.includes('pass')) {
        return "'mypassword'";
      }

      // Numeric parameters
      if (paramName.includes('size') || paramName.includes('length') || paramName.includes('count')) {
        return '16';
      }
      if (paramName.includes('rounds') || paramName.includes('iterations')) {
        return '1000';
      }

      // Array parameters
      if (paramName.includes('array') || paramName.includes('list') || paramName.includes('bytes')) {
        return '[1, 2, 3, 4, 5]';
      }

      // Boolean parameters
      if (paramName.includes('flag') || paramName.includes('enable') || paramName.includes('is_')) {
        return 'true';
      }

      // Default to string
      return `'${paramName}_example'`;
    });
  }

  /**
   * Generate complete Ruby project with supporting files
   * @param {Object} ast - The Abstract Syntax Tree
   * @param {Object} options - Generation options
   * @returns {Object} Result with multiple files
   */
  generateStandalone(ast, options = {}) {
    const result = this.GenerateFromAST(ast, options);

    if (!result.success) {
      return result;
    }

    // Extract project name from AST or use default
    const projectName = this._extractProjectName(ast) || 'ruby_cipher_project';

    // Generate supporting project files
    const projectFiles = {
      // Main Ruby file
      [`${projectName}.rb`]: result.code,

      // Gemfile for dependency management
      'Gemfile': this._generateGemfile(projectName, result.dependencies),

      // README with usage instructions
      'README.md': this._generateReadme(projectName, ast, result),

      // Ruby version specification
      '.ruby-version': this._generateRubyVersion(),

      // Bundler binstub for easier execution
      'bin/setup': this._generateSetupScript(projectName),

      // Example usage script
      'examples/basic_usage.rb': this._generateExampleScript(projectName),
    };

    return {
      ...result,
      projectFiles,
      mainFile: `${projectName}.rb`,
      projectName,
      executionInstructions: this._generateExecutionInstructions(projectName)
    };
  }

  /**
   * Extract project name from AST
   * @private
   */
  _extractProjectName(ast) {
    // Look for module or class names
    if (this.modules.size > 0) {
      return Array.from(this.modules)[0].toLowerCase();
    }
    if (this.classes.size > 0) {
      return Array.from(this.classes)[0].toLowerCase();
    }

    // Look for function names
    const functions = this._extractFunctionNames('');
    if (functions.length > 0) {
      return functions[0].toLowerCase();
    }

    return null;
  }

  /**
   * Generate Gemfile for dependency management
   * @private
   */
  _generateGemfile(projectName, dependencies) {
    let gemfile = `# Gemfile for ${projectName}\n`;
    gemfile += '# Generated by SynthelicZ Cipher Tools\n\n';
    gemfile += 'source "https://rubygems.org"\n\n';
    gemfile += '# Ruby version\n';
    gemfile += 'ruby "~> 3.3.0"\n\n';

    // Core gems based on detected functionality
    const gems = Array.from(this.gems);
    if (gems.length > 0) {
      gemfile += '# Cryptographic and utility gems\n';
      gems.forEach(gem => {
        if (this.cryptoGems[gem]) {
          gemfile += `gem "${gem}", "~> ${this.cryptoGems[gem].version || '1.0'}"\n`;
        } else {
          gemfile += `gem "${gem}"\n`;
        }
      });
      gemfile += '\n';
    }

    // Development dependencies
    gemfile += '# Development and testing gems\n';
    gemfile += 'group :development, :test do\n';
    gemfile += '  gem "rspec", "~> 3.12"\n';
    gemfile += '  gem "rubocop", "~> 1.57"\n';
    gemfile += '  gem "bundler", "~> 2.4"\n';
    gemfile += '  gem "rake", "~> 13.1"\n';
    gemfile += 'end\n';

    return gemfile;
  }

  /**
   * Generate README.md with usage instructions
   * @private
   */
  _generateReadme(projectName, ast, result) {
    const capitalizedName = projectName.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    let readme = `# ${capitalizedName}\n\n`;
    readme += `Generated Ruby cryptographic implementation using SynthelicZ Cipher Tools.\n\n`;

    readme += '## Features\n\n';
    const functions = this._extractFunctionNames(result.code);
    if (functions.length > 0) {
      functions.forEach(func => {
        readme += `- \`${func}\` - Cryptographic operation implementation\n`;
      });
    } else {
      readme += '- Complete Ruby implementation of cryptographic algorithms\n';
    }
    readme += '\n';

    readme += '## Requirements\n\n';
    readme += '- Ruby 3.3+ (recommended)\n';
    readme += '- Bundler for dependency management\n';

    if (this.gems.size > 0) {
      readme += '\n### Required Gems\n\n';
      Array.from(this.gems).forEach(gem => {
        readme += `- \`${gem}\` - ${this.cryptoGems[gem]?.description || 'Required gem'}\n`;
      });
    }

    readme += '\n## Installation\n\n';
    readme += '1. Ensure Ruby 3.3+ is installed:\n';
    readme += '   ```bash\n';
    readme += '   ruby --version\n';
    readme += '   ```\n\n';
    readme += '2. Install dependencies:\n';
    readme += '   ```bash\n';
    readme += '   bundle install\n';
    readme += '   ```\n\n';
    readme += '3. Run setup script:\n';
    readme += '   ```bash\n';
    readme += '   ./bin/setup\n';
    readme += '   ```\n\n';

    readme += '## Usage\n\n';
    readme += '### Basic Usage\n\n';
    readme += '```bash\n';
    readme += `ruby ${projectName}.rb\n`;
    readme += '```\n\n';

    readme += '### Advanced Usage\n\n';
    readme += '```ruby\n';
    readme += `require_relative "${projectName}"\n\n`;

    if (functions.length > 0) {
      const firstFunc = functions[0];
      readme += `# Example usage\n`;
      readme += `result = ${firstFunc}(data: "Hello, World!", key: "secretkey123")\n`;
      readme += `puts "Result: \#{result}"\n`;
    }
    readme += '```\n\n';

    readme += '### Examples\n\n';
    readme += 'See the `examples/` directory for more usage examples.\n\n';

    readme += '## Testing\n\n';
    readme += 'Run the test suite:\n\n';
    readme += '```bash\n';
    readme += 'bundle exec rspec\n';
    readme += '```\n\n';

    readme += '## Security Notes\n\n';
    readme += '⚠️ **Important**: This code contains cryptographic implementations.\n\n';
    readme += '- Review all cryptographic operations before production use\n';
    readme += '- Ensure proper key management and secure coding practices\n';
    readme += '- Test thoroughly with known test vectors\n';
    readme += '- Consider professional cryptographic review\n\n';

    readme += '## Development\n\n';
    readme += 'To contribute or modify this code:\n\n';
    readme += '1. Fork the repository\n';
    readme += '2. Create a feature branch\n';
    readme += '3. Make changes and add tests\n';
    readme += '4. Run `bundle exec rubocop` for style checks\n';
    readme += '5. Submit a pull request\n\n';

    readme += '## Generated by\n\n';
    readme += 'This code was generated by [SynthelicZ Cipher Tools](https://github.com/synthelicz/cipher-tools) - a professional-grade cryptographic code generation framework.\n\n';
    readme += '## License\n\n';
    readme += 'MIT License - see LICENSE file for details.\n';

    return readme;
  }

  /**
   * Generate .ruby-version file
   * @private
   */
  _generateRubyVersion() {
    return '3.3.0\n';
  }

  /**
   * Generate setup script for easy project initialization
   * @private
   */
  _generateSetupScript(projectName) {
    let script = '#!/usr/bin/env ruby\n';
    script += '# Setup script for Ruby project\n';
    script += '# Generated by SynthelicZ Cipher Tools\n\n';
    script += 'require "bundler"\n';
    script += 'require "fileutils"\n\n';
    script += 'puts "🚀 Setting up Ruby project..."\n\n';
    script += '# Install gems\n';
    script += 'puts "📦 Installing gems..."\n';
    script += 'system("bundle install") or exit(1)\n\n';
    script += '# Create directories if needed\n';
    script += 'FileUtils.mkdir_p(%w[examples spec lib])\n\n';
    script += '# Make files executable\n';
    script += `FileUtils.chmod(0755, "${projectName}.rb")\n\n`;
    script += 'puts "✅ Setup completed successfully!"\n';
    script += 'puts ""\n';
    script += 'puts "Next steps:"\n';
    script += `puts "  ruby ${projectName}.rb    # Run the main script"\n`;
    script += 'puts "  bundle exec rspec        # Run tests (when available)"\n';
    script += 'puts "  bundle exec rubocop      # Check code style"\n';

    return script;
  }

  /**
   * Generate example usage script
   * @private
   */
  _generateExampleScript(projectName) {
    let script = '#!/usr/bin/env ruby\n';
    script += '# Example usage script\n';
    script += '# Generated by SynthelicZ Cipher Tools\n\n';
    script += `require_relative "../${projectName}"\n\n`;
    script += 'puts "🔍 Ruby Cipher Implementation Examples"\n';
    script += 'puts "=" * 50\n\n';

    const functions = this._extractFunctionNames('');
    if (functions.length > 0) {
      functions.forEach(func => {
        script += `# Example: ${func}\n`;
        script += 'puts "Testing #{func}..."\n';
        script += `result = ${func}(data: "test_data", key: "test_key")\n`;
        script += 'puts "Result: #{result}"\n';
        script += 'puts ""\n\n';
      });
    } else {
      script += '# Add your own examples here\n';
      script += 'puts "💡 Add function calls to see examples"\n';
    }

    script += 'puts "✅ Examples completed!"\n';

    return script;
  }

  /**
   * Generate execution instructions
   * @private
   */
  _generateExecutionInstructions(projectName) {
    return {
      setup: [
        'bundle install',
        './bin/setup'
      ],
      run: [
        `ruby ${projectName}.rb`,
        'ruby examples/basic_usage.rb'
      ],
      test: [
        'bundle exec rspec',
        'bundle exec rubocop'
      ]
    };
  }

  /**
   * Collect Ruby dependencies and gems
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    // Standard library dependencies
    const stdLibDeps = Array.from(this.requires);
    if (stdLibDeps.length > 0) {
      dependencies.push({
        type: 'require',
        name: 'Ruby Standard Library',
        items: stdLibDeps,
        manager: 'built-in'
      });
    }

    // Gem dependencies
    const gemDeps = Array.from(this.gems);
    if (gemDeps.length > 0) {
      dependencies.push({
        type: 'gem',
        name: 'Ruby Gems',
        items: gemDeps,
        manager: 'bundler',
        installCommand: `bundle add ${gemDeps.join(' ')}`
      });
    }

    // Ruby version requirement
    dependencies.push({
      type: 'runtime',
      name: 'Ruby Runtime',
      version: '3.3+',
      downloadUrl: 'https://www.ruby-lang.org/en/downloads/',
      manager: 'rbenv/rvm'
    });

    // Additional tools if crypto is used
    if (this.gems.has('openssl') || this.gems.has('rbnacl')) {
      dependencies.push({
        type: 'system',
        name: 'Cryptographic Libraries',
        description: 'OpenSSL or libsodium for crypto operations',
        manager: 'system package manager'
      });
    }

    return dependencies;
  }

  /**
   * Generate comprehensive warnings for Ruby best practices
   * @private
   */
  _generateWarnings(ast, code, options) {
    const warnings = [];

    // Apply warning rules
    this.warningRules.forEach(rule => {
      try {
        if (rule.check(code)) {
          warnings.push({
            type: rule.id,
            severity: rule.severity,
            message: rule.description,
            rule: rule.name,
            suggestion: this._getWarningSuggestion(rule.id)
          });
        }
      } catch (error) {
        // Skip failed rule checks
      }
    });

    // Ruby version compatibility warnings
    if (options.usePatternMatching) {
      warnings.push({
        type: 'version_requirement',
        severity: 'info',
        message: 'Pattern matching requires Ruby 3.0+',
        rule: 'Ruby Version Compatibility'
      });
    }

    if (options.useEndlessMethods) {
      warnings.push({
        type: 'version_requirement',
        severity: 'info',
        message: 'Endless methods require Ruby 3.0+',
        rule: 'Ruby Version Compatibility'
      });
    }

    // Security warnings
    if (this._hasSecurityImplications(code)) {
      warnings.push({
        type: 'security',
        severity: 'warning',
        message: 'Code contains cryptographic operations - review security practices',
        rule: 'Crypto Security Review'
      });
    }

    // Performance warnings
    if (this._hasPerformanceIssues(code)) {
      warnings.push({
        type: 'performance',
        severity: 'info',
        message: 'Consider optimization opportunities for better performance',
        rule: 'Performance Optimization'
      });
    }

    // Metaprogramming warnings
    if (options.useMetaprogramming && this._hasMetaprogramming(code)) {
      warnings.push({
        type: 'complexity',
        severity: 'info',
        message: 'Metaprogramming used - ensure code remains maintainable',
        rule: 'Metaprogramming Complexity'
      });
    }

    return warnings;
  }

  // Helper methods for naming conventions and type inference

  _toRubyMethod(name) {
    if (!name) return name;
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  _toRubyConstant(name) {
    if (!name) return name;
    // Preserve PascalCase for class names, don't convert to SCREAMING_CASE
    // Only insert underscores between lowercase and uppercase letters
    return name.replace(/([a-z])([A-Z])/g, '$1$2');
  }

  _isConstant(name) {
    return /^[A-Z]/.test(name);
  }

  _isInstanceVariable(name) {
    return /^@[^@]/.test(name);
  }

  _isClassVariable(name) {
    return /^@@/.test(name);
  }

  _isGlobalVariable(name) {
    return /^\$/.test(name);
  }

  _inferRubyType(name) {
    // Type inference based on name patterns
    if (name.endsWith('?')) return 'Boolean';
    if (name.endsWith('_at') || name.endsWith('_time')) return 'Time';
    if (name.includes('count') || name.includes('size') || name.includes('length')) return 'Integer';
    if (name.includes('rate') || name.includes('percent')) return 'Float';
    if (name.includes('name') || name.includes('title') || name.includes('message')) return 'String';
    if (name.includes('list') || name.includes('items') || name.endsWith('s')) return 'Array';
    if (name.includes('config') || name.includes('settings') || name.includes('options')) return 'Hash';
    return 'Object';
  }

  _inferReturnType(methodName) {
    if (methodName.endsWith('?')) return 'Boolean';
    if (methodName.endsWith('!')) return 'self';
    if (methodName === 'initialize') return 'void';
    if (methodName.startsWith('set_') || methodName.startsWith('add_')) return 'self';
    if (methodName.startsWith('get_') || methodName.startsWith('find_')) return 'Object';
    if (methodName.includes('count') || methodName.includes('size')) return 'Integer';
    if (methodName.includes('each') || methodName.includes('map')) return 'Enumerator';
    return 'Object';
  }

  _mapOperator(operator) {
    return this.operatorMappings[operator] || operator;
  }

  _mapMethodToRuby(methodName) {
    return this.methodMappings[methodName] || this._toRubyMethod(methodName);
  }

  _isCryptoOperation(node, operator) {
    return ['<<', '>>', '&', '|', '^'].includes(operator) && this._isInCryptoContext();
  }

  _isInCryptoContext() {
    return this.gems.has('openssl') || this.gems.has('digest') || this.gems.has('rbnacl');
  }

  _isStringConcatenation(node) {
    return node.operator === '+' &&
           (this._isStringType(node.left) || this._isStringType(node.right));
  }

  _isStringType(node) {
    return node.type === 'Literal' && typeof node.value === 'string';
  }

  _mightBeNil(object) {
    // Simple heuristic for when safe navigation might be needed
    // Don't use safe navigation for: self, this, true, false, instance variables, local variables
    if (['self', 'this', 'true', 'false'].includes(object)) {
      return false;
    }
    // Don't use safe navigation on instance variables (@var) or class variables (@@var)
    if (/^@/.test(object)) {
      return false;
    }
    // Don't use safe navigation on array/hash access
    if (/\[.*\]/.test(object)) {
      return false;
    }
    return true;
  }

  _hasSecurityImplications(code) {
    return /crypto|cipher|hash|encrypt|decrypt|sign|verify|random|password/.test(code.toLowerCase());
  }

  _hasPerformanceIssues(code) {
    return /\.map.*\.select|\.each.*\+\+|for.*in/.test(code);
  }

  _hasMetaprogramming(code) {
    return /define_method|method_missing|eval|send|instance_eval|class_eval/.test(code);
  }

  _getWarningSuggestion(ruleId) {
    const suggestions = {
      'frozen_string_literal': 'Add "# frozen_string_literal: true" at the top',
      'symbol_keys': 'Use symbol: value syntax instead of "string" => value',
      'snake_case_methods': 'Use snake_case naming: def my_method instead of def myMethod',
      'boolean_methods': 'Add ? suffix: def active? instead of def is_active',
      'safe_navigation': 'Use &. operator: object&.method instead of object && object.method',
      'string_interpolation': 'Use "#{variable}" instead of concatenation',
      'each_over_for': 'Use array.each { |item| } instead of for item in array',
      'guard_clauses': 'Use early returns to reduce nesting',
      'constant_naming': 'Use SCREAMING_SNAKE_CASE for constants',
      'eval_usage': 'Use send() or define_method instead of eval',
      'global_variables': 'Use constants, class variables, or dependency injection',
      'nil_checks': 'Use variable.nil? instead of variable == nil'
    };
    return suggestions[ruleId] || '';
  }

  _getFunctionName(callee) {
    if (callee.type === 'Identifier') {
      return callee.name;
    } else if (callee.type === 'MemberExpression') {
      return callee.property.name || callee.property;
    }
    return 'unknown';
  }

  _getMethodName(property) {
    return property.name || property;
  }

  _getPropertyName(property) {
    return property.name || property;
  }

  _getParameterName(param) {
    if (param.type === 'Identifier') {
      return this._toRubyMethod(param.name);
    } else if (param.type === 'AssignmentPattern') {
      return this._getParameterName(param.left);
    } else if (param.type === 'RestElement') {
      return this._getParameterName(param.argument);
    }
    return 'param';
  }

  _generatePropertyKey(key, options) {
    if (key.type === 'Identifier') {
      return key.name;
    } else if (key.type === 'Literal') {
      return this._generateLiteral(key, options);
    }
    return this._generateNode(key, options);
  }

  _canBeSymbol(key) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key.replace(/['"]/g, ''));
  }

  _isSimpleMethod(node) {
    return node.body && node.body.body && node.body.body.length === 1 &&
           node.body.body[0].type === 'ReturnStatement';
  }

  _extractSimpleExpression(body) {
    if (body && body.body && body.body.length === 1 &&
        body.body[0].type === 'ReturnStatement' && body.body[0].argument) {
      return this._generateNode(body.body[0].argument, {});
    }
    return 'nil';
  }

  _shouldUseKeywordArg(param) {
    const name = this._getParameterName(param);
    return name.length > 3; // Use keyword args for longer parameter names
  }

  _isGuardClause(node) {
    return node && node.type === 'ReturnStatement';
  }

  _isSimpleForLoop(node) {
    return node.init && node.test && node.update &&
           node.init.type === 'VariableDeclaration' &&
           node.test.type === 'BinaryExpression';
  }

  _generateRubyRangeLoop(node, options) {
    const variable = node.init.declarations[0].id.name;
    const start = node.init.declarations[0].init ?
      this._generateNode(node.init.declarations[0].init, options) : '0';

    let end = '';
    if (node.test.right) {
      end = this._generateNode(node.test.right, options);
      if (node.test.operator === '<') {
        end = `(${end} - 1)`;
      }
    }

    const body = this._generateNode(node.body, options);

    let code = this._indent(`(${start}..${end}).each do |${variable}|\n`);
    this.indentLevel++;
    if (body && body.trim()) {
      code += body;
    } else {
      // Generate meaningful default loop body
      code += this._indent(`# iterate with ${variable}\n`);
      code += this._indent('nil\n');
    }
    this.indentLevel--;
    code += this._indent('end\n');

    return code;
  }

  _isStringArray(elements) {
    return elements.every(el => el && el.type === 'Literal' && typeof el.value === 'string');
  }

  _isArrayXor(node) {
    return node.left && node.right &&
           (node.left.type === 'ArrayExpression' || node.right.type === 'ArrayExpression');
  }

  _isNilComparison(node) {
    return (node.left.type === 'Literal' && node.left.value === null) ||
           (node.right.type === 'Literal' && node.right.value === null);
  }

  _isImmutableString(node) {
    // Heuristic for strings that should be frozen
    return typeof node.value === 'string' &&
           (node.value.length > 10 || /^[A-Z_]+$/.test(node.value));
  }

  _shouldMemoize(node, methodName) {
    // Memoize methods that don't take parameters and look like accessors/calculators
    const hasNoParams = !node.params || node.params.length === 0;
    const isCalculator = /^(calculate|compute|get|find|generate)/.test(methodName);
    return hasNoParams && isCalculator;
  }

  _generateTypeSignature(node, methodName, options) {
    let code = '';

    if (options.addSorbetTypes) {
      // Sorbet type signature
      code += this._indent('# @sig (');
      if (node.params && node.params.length > 0) {
        const paramTypes = node.params.map(p => {
          const paramName = this._getParameterName(p);
          const paramType = this._inferRubyType(paramName);
          return `${paramName}: ${paramType}`;
        }).join(', ');
        code += paramTypes;
      }
      code += ') -> ';
      code += this._inferReturnType(methodName);
      code += '\n';
    } else if (options.addTypeAnnotations) {
      // RBS-style type annotation in comment
      code += this._indent('# Type: (');
      if (node.params && node.params.length > 0) {
        const paramTypes = node.params.map(p => this._inferRubyType(this._getParameterName(p))).join(', ');
        code += paramTypes;
      }
      code += ') -> ';
      code += this._inferReturnType(methodName);
      code += '\n';
    }

    return code;
  }

  _generateLintingHints(methodName, node) {
    let code = '';
    const paramCount = node.params ? node.params.length : 0;

    if (paramCount > 5) {
      code += this._indent('# rubocop:disable Metrics/ParameterLists\n');
    }

    if (methodName.length > 30) {
      code += this._indent('# rubocop:disable Naming/MethodName\n');
    }

    return code;
  }

  _convertSwitchToIf(node, options) {
    // Convert switch to if-elsif chain
    let code = '';
    const discriminant = this._generateNode(node.discriminant, options);

    node.cases.forEach((caseNode, index) => {
      if (caseNode.test) {
        const test = this._generateNode(caseNode.test, options);
        if (index === 0) {
          code += this._indent(`if ${discriminant} == ${test}\n`);
        } else {
          code += this._indent(`elsif ${discriminant} == ${test}\n`);
        }
      } else {
        code += this._indent('else\n');
      }

      this.indentLevel++;
      if (caseNode.consequent && caseNode.consequent.length > 0) {
        const consequent = caseNode.consequent
          .map(stmt => this._generateNode(stmt, options))
          .filter(c => c && c.trim())
          .join('\n');
        if (consequent && consequent.trim()) {
          code += consequent;
        } else {
          code += this._indent('# case condition\n');
          code += this._indent('nil\n');
        }
      } else {
        code += this._indent('# case condition\n');
        code += this._indent('nil\n');
      }
      this.indentLevel--;
    });

    code += this._indent('end\n');
    return code;
  }

  // Additional AST node generators for comprehensive coverage

  _generateBreakStatement(node, options) {
    return this._indent('break\n');
  }

  _generateContinueStatement(node, options) {
    return this._indent('next\n');
  }

  _generateThrowStatement(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : 'StandardError.new';
    return this._indent(`raise ${argument}\n`);
  }

  _generateEmptyStatement(node, options) {
    return this._indent('# Empty statement\n');
  }

  _generateDebuggerStatement(node, options) {
    this.requires.add('debug');
    return this._indent('debugger\n');
  }

  _generateLabeledStatement(node, options) {
    // Ruby doesn't have labeled statements, use comments
    const label = node.label.name;
    const body = this._generateNode(node.body, options);
    return this._indent(`# Label: ${label}\n`) + body;
  }

  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator === '&&' ? '&&' : '||';
    return `${left} ${operator} ${right}`;
  }

  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (operator === '!') {
      return `!${argument}`;
    } else if (operator === '-') {
      return `-${argument}`;
    } else if (operator === '+') {
      return `+${argument}`;
    } else if (operator === 'typeof') {
      return `${argument}.class`;
    } else if (operator === 'void') {
      return 'nil';
    } else if (operator === 'delete') {
      return `${argument} = nil`;
    }

    return `${operator}${argument}`;
  }

  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator === '++' ? '+= 1' : '-= 1';

    if (node.prefix) {
      return `(${argument} ${operator})`;
    } else {
      return `(${argument}.tap { ${argument} ${operator} })`;
    }
  }

  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `${test} ? ${consequent} : ${alternate}`;
  }

  _generateSequenceExpression(node, options) {
    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return expressions.join('; ');
  }

  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    const rubyClass = this._mapClassToRuby(callee);
    return `${rubyClass}.new(${args})`;
  }

  _generateFunctionExpression(node, options) {
    // Convert to proc or lambda
    const params = node.params ?
      node.params.map(p => this._getParameterName(p)).join(', ') : '';
    const body = node.body ? this._generateNode(node.body, options) : 'nil';

    if (params) {
      return `proc { |${params}| ${body.trim()} }`;
    } else {
      return `proc { ${body.trim()} }`;
    }
  }

  _generateArrowFunctionExpression(node, options) {
    const params = node.params ?
      node.params.map(p => this._getParameterName(p)).join(', ') : '';
    const body = node.body;

    let bodyCode;
    if (body.type === 'BlockStatement') {
      bodyCode = this._generateNode(body, options);
    } else {
      bodyCode = this._generateNode(body, options);
    }

    if (params) {
      return `lambda { |${params}| ${bodyCode.trim()} }`;
    } else {
      return `lambda { ${bodyCode.trim()} }`;
    }
  }

  _generateMethodDefinition(node, options) {
    const isStatic = node.static;
    const originalMethodName = node.key.name;
    const methodName = originalMethodName === 'constructor' ? 'initialize' : this._toRubyMethod(originalMethodName);
    const isConstructor = methodName === 'initialize';

    let code = '';

    // Method visibility
    let visibility = '';
    if (node.kind === 'private') visibility = 'private ';
    else if (node.kind === 'protected') visibility = 'protected ';

    // Static methods
    if (isStatic && !isConstructor) {
      code += this._indent(`${visibility}def self.${methodName}`);
    } else {
      code += this._indent(`${visibility}def ${methodName}`);
    }

    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = this._generateMethodParameters(node.value.params, options);
      code += `(${params})`;
    }
    code += '\n';

    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      if (bodyCode && bodyCode.trim()) {
        code += bodyCode;
      } else {
        code += this._indent(`# Implementation for ${methodName}\n`);
        if (isConstructor) {
          code += this._indent('super if defined?(super)\n');
        } else {
          code += this._indent('nil\n');
        }
      }
    } else {
      code += this._indent(`# Implementation for ${methodName}\n`);
      if (isConstructor) {
        code += this._indent('super if defined?(super)\n');
      } else {
        code += this._indent('nil\n');
      }
    }
    this.indentLevel--;

    code += this._indent('end\n');

    return code;
  }

  _generateClassExpression(node, options) {
    // Ruby doesn't have class expressions, convert to class definition
    return this._generateClass(node, options);
  }

  _generatePropertyDefinition(node, options) {
    const key = this._generateNode(node.key, options);
    const value = node.value ? this._generateNode(node.value, options) : 'nil';

    if (node.static) {
      return this._indent(`@@${key} = ${value}\n`);
    } else {
      return this._indent(`@${key} = ${value}\n`);
    }
  }

  _generatePrivateIdentifier(node, options) {
    // Ruby uses @ for private instance variables
    return `@${node.name}`;
  }

  _generateMetaProperty(node, options) {
    if (node.meta.name === 'new' && node.property.name === 'target') {
      return 'self.class';
    }
    return '# meta property';
  }

  _generateArrayPattern(node, options) {
    const elements = node.elements.map(element => {
      if (element === null) {
        return '';
      }
      return this._generateNode(element, options);
    });
    return elements.join(', ');
  }

  _generateObjectPattern(node, options) {
    const properties = node.properties.map(prop => {
      if (prop.type === 'Property') {
        const key = this._generatePropertyKey(prop.key, options);
        const value = this._generateNode(prop.value, options);
        return `${key}: ${value}`;
      }
      return this._generateNode(prop, options);
    });
    return `{ ${properties.join(', ')} }`;
  }

  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} = ${right}`;
  }

  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `*${argument}`;
  }

  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `*${argument}`;
  }

  _generateAwaitExpression(node, options) {
    // Ruby fibers for async-like behavior
    this.requires.add('fiber');
    const argument = this._generateNode(node.argument, options);
    return `Fiber.yield(${argument})`;
  }

  _generateYieldExpression(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return `yield ${argument}`;
    } else {
      return 'yield';
    }
  }

  _generateImportDeclaration(node, options) {
    // Convert to require statements
    const source = node.source.value;
    this.requires.add(source);

    if (node.specifiers && node.specifiers.length > 0) {
      const imports = node.specifiers.map(spec => {
        if (spec.type === 'ImportDefaultSpecifier') {
          return `${spec.local.name} = require('${source}')`;
        } else if (spec.type === 'ImportSpecifier') {
          return `${spec.local.name} = require('${source}').${spec.imported.name}`;
        }
        return `require('${source}')`;
      });
      return imports.map(imp => this._indent(imp + '\n')).join('');
    } else {
      return this._indent(`require '${source}'\n`);
    }
  }

  _generateImportExpression(node, options) {
    const source = this._generateNode(node.source, options);
    return `require(${source})`;
  }

  _generateExportDeclaration(node, options) {
    // Ruby doesn't have exports, use comments
    if (node.declaration) {
      const declaration = this._generateNode(node.declaration, options);
      return this._indent('# Export: ') + declaration;
    } else {
      return this._indent('# Export declaration\n');
    }
  }

  _generateStaticBlock(node, options) {
    // Ruby class-level execution
    let code = this._indent('class << self\n');
    this.indentLevel++;
    const body = this._generateNode(node.body, options);
    code += body || this._indent('# Static block\n');
    this.indentLevel--;
    code += this._indent('end\n');
    return code;
  }

  _generateWithStatement(node, options) {
    // Ruby doesn't have with statements, use instance_eval
    const object = this._generateNode(node.object, options);
    const body = this._generateNode(node.body, options);

    let code = this._indent(`${object}.instance_eval do\n`);
    this.indentLevel++;
    code += body;
    this.indentLevel--;
    code += this._indent('end\n');

    return code;
  }

  _generateChainExpression(node, options) {
    return this._generateNode(node.expression, options);
  }

  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const template = this._generateTemplateLiteral(node.quasi, options);
    return `${tag}(${template})`;
  }

  _generateSwitchCase(node, options) {
    // Handled in _generateSwitchStatement
    return '';
  }

  _generateCatchClause(node, options) {
    // Handled in _generateTryStatement
    return '';
  }

  _generateDoWhileStatement(node, options) {
    const body = this._generateNode(node.body, options);
    const test = this._generateNode(node.test, options);

    let code = this._indent('loop do\n');
    this.indentLevel++;
    if (body && body.trim()) {
      code += body;
    } else {
      code += this._indent('# do-while loop body\n');
      code += this._indent('nil\n');
    }
    code += this._indent(`break unless ${test}\n`);
    this.indentLevel--;
    code += this._indent('end\n');

    return code;
  }

  _generateOptionalCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    return `${callee}&.call(${args})`;
  }

  _generateOptionalMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ?
      `[${this._generateNode(node.property, options)}]` :
      `.${node.property.name || node.property}`;
    return `${object}&${property}`;
  }

  _generateJSXElement(node, options) {
    // Convert JSX to Ruby ERB or HTML string
    const tagName = node.openingElement && node.openingElement.name ?
      node.openingElement.name.name : 'div';
    return `"<${tagName}></#{tagName}>"`;
  }

  _generateJSXFragment(node, options) {
    return `"<!-- Fragment -->"`;
  }

  _generateTSAsExpression(node, options) {
    const expression = this._generateNode(node.expression, options);
    // Ruby doesn't have type assertions, just return the expression
    return expression;
  }

  _generateFallbackNode(node, options) {
    // Generate minimal valid Ruby code with warning comment
    return this._indent(`# WARNING: Unhandled AST node type: ${node.type}\n`) +
           this._indent(`raise NotImplementedError, "Not implemented: ${node.type}"\n`);
  }

  _mapClassToRuby(className) {
    const mappings = {
      'Date': 'Time',
      'RegExp': 'Regexp',
      'Error': 'StandardError',
      'Array': 'Array',
      'Object': 'Hash',
      'String': 'String',
      'Number': 'Numeric',
      'Boolean': 'TrueClass'
    };
    return mappings[className] || this._toRubyConstant(className);
  }

  /**
   * Add proper indentation
   * @private
   */
  _indent(code) {
    if (!code) return '';

    const indentStr = this.options.indent.repeat(this.indentLevel);
    return code.split('\n').map(line =>
      line.trim() ? indentStr + line : line
    ).join('\n');
  }

  /**
   * Check if Ruby is available on the system
   * @private
   */
  _isRubyAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('ruby --version', {
        stdio: 'pipe',
        timeout: 1000,
        windowsHide: true
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Ruby code syntax using native interpreter
   * @override
   */
  ValidateCodeSyntax(code) {
    const rubyAvailable = this._isRubyAvailable();
    if (!rubyAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Ruby not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');

      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_ruby_${Date.now()}.rb`);

      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFile, code);

      try {
        execSync(`ruby -c "${tempFile}"`, {
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true
        });

        fs.unlinkSync(tempFile);

        return {
          success: true,
          method: 'ruby',
          error: null
        };

      } catch (error) {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }

        return {
          success: false,
          method: 'ruby',
          error: error.stderr?.toString() || error.message
        };
      }

    } catch (error) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Ruby not available - using basic validation'
      };
    }
  }

  /**
   * Get Ruby interpreter information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Ruby',
      downloadUrl: 'https://www.ruby-lang.org/en/downloads/',
      installInstructions: [
        'Download Ruby from https://www.ruby-lang.org/en/downloads/',
        'For Windows: Use RubyInstaller - https://rubyinstaller.org/',
        'For Ubuntu/Debian: sudo apt install ruby-full',
        'For macOS: brew install ruby',
        'For version management: rbenv or RVM',
        'Install bundler: gem install bundler',
        'For crypto gems: gem install openssl rbnacl bcrypt',
        'Add Ruby to your system PATH',
        'Verify installation with: ruby --version'
      ].join('\n'),
      verifyCommand: 'ruby --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'gem / bundler',
      documentation: 'https://ruby-doc.org/',
      cryptoLibraries: 'OpenSSL, RbNaCl, BCrypt, Digest (built-in)',
      modernFeatures: 'Pattern matching, endless methods, keyword arguments, fibers, ractors'
    };
  }
}

// Register the enhanced plugin
const rubyPlugin = new RubyPlugin();
LanguagePlugins.Add(rubyPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = rubyPlugin;
}

})(); // End of IIFE