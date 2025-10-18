/**
 * PHP Language Plugin for Multi-Language Code Generation
 * Production-ready PHP 8.4+ code generator with comprehensive AST support
 *
 * Features:
 * - 75+ AST node types with full PHP 8.4 compatibility
 * - Modern PHP features: enums, readonly properties, union types, match expressions
 * - OpCodes integration for cryptographic operations
 * - Advanced type inference with 42+ type mappings
 * - Comprehensive warnings system (10+ PHP-specific best practices)
 * - PHP crypto library integration (OpenSSL, libsodium, hash functions)
 * - Constructor property promotion, attributes, fibers support
 * - Static analysis compatibility and strict types enforcement
 *
 * @version 2.0.0
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
      RotL32: (value, positions) => `($value << $positions) | ($value >> (32 - $positions))`,
      RotR32: (value, positions) => `($value >> $positions) | ($value << (32 - $positions))`,
      Pack32BE: (b0, b1, b2, b3) => `(($b0 << 24) | ($b1 << 16) | ($b2 << 8) | $b3)`,
      Pack32LE: (b0, b1, b2, b3) => `($b0 | ($b1 << 8) | ($b2 << 16) | ($b3 << 24))`,
      XorArrays: (arr1, arr2) => `array_map(fn($a, $b) => $a ^ $b, $arr1, $arr2)`,
      ClearArray: (arr) => `sodium_memzero($arr)`
    };
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  OpCodes = window.OpCodes || {
    RotL32: (value, positions) => `($value << $positions) | ($value >> (32 - $positions))`,
    RotR32: (value, positions) => `($value >> $positions) | ($value << (32 - $positions))`,
    Pack32BE: (b0, b1, b2, b3) => `(($b0 << 24) | ($b1 << 16) | ($b2 << 8) | $b3)`,
    Pack32LE: (b0, b1, b2, b3) => `($b0 | ($b1 << 8) | ($b2 << 16) | ($b3 << 24))`,
    XorArrays: (arr1, arr2) => `array_map(fn($a, $b) => $a ^ $b, $arr1, $arr2)`,
    ClearArray: (arr) => `sodium_memzero($arr)`
  };
}

/**
 * PHP Code Generator Plugin - Production Ready
 * Extends LanguagePlugin base class with comprehensive PHP 8.4+ support
 */
class PHPPlugin extends LanguagePlugin {
  constructor() {
    super();

    // Required plugin metadata
    this.name = 'PHP';
    this.extension = 'php';
    this.icon = '🐘';
    this.description = 'Production-ready PHP 8.4+ code generator with comprehensive AST support';
    this.mimeType = 'text/x-php';
    this.version = '8.4+';

    // Enhanced PHP-specific options
    this.options = {
      // Code formatting
      indent: '    ', // 4 spaces (PSR-12 compliant)
      lineEnding: '\n',
      maxLineLength: 120,

      // PHP language features
      strictTypes: true,
      addTypeHints: true,
      addDocBlocks: true,
      useShortArraySyntax: true,
      useNullCoalescing: true,
      useMatchExpressions: true,
      useArrowFunctions: true,
      useConstructorPromotion: true,
      useReadonlyProperties: true,
      useEnums: true,
      useAttributes: true,
      useUnionTypes: true,
      useIntersectionTypes: true,
      useNamedArguments: true,
      useFibers: true,

      // Code generation preferences
      generateInterfaces: true,
      generateTraits: true,
      generateAbstractClasses: true,
      addVisibilityModifiers: true,
      addReturnTypes: true,
      addParameterTypes: true,
      addPropertyTypes: true,

      // Security and best practices
      enableOpCodesIntegration: true,
      useSodiumCrypto: true,
      useSecureRandom: true,
      enableInputValidation: true,
      addSecurityComments: true,

      // Static analysis
      addPsalmAnnotations: true,
      addPhpStanAnnotations: true,
      generateTODOs: false
    };

    // Internal state
    this.indentLevel = 0;
    this.namespaces = new Set();
    this.imports = new Set();
    this.dependencies = new Set();
    this.currentClass = null;
    this.currentMethod = null;
    this.variables = new Map();
    this.constants = new Set();
    this.traits = new Set();
    this.interfaces = new Set();

    // Initialize type mappings
    this._initializeTypeMappings();
    this._initializeCryptoMappings();
    this._initializeWarningRules();
  }

  /**
   * Initialize comprehensive type mappings for PHP 8.4+
   * @private
   */
  _initializeTypeMappings() {
    // Primitive type mappings
    this.typeMap = {
      'string': 'string',
      'number': 'int|float',
      'boolean': 'bool',
      'object': 'object',
      'array': 'array',
      'null': 'null',
      'undefined': 'null',
      'mixed': 'mixed',
      'void': 'void',
      'never': 'never',
      'callable': 'callable',
      'iterable': 'iterable',
      'resource': 'resource'
    };

    // Crypto context type mappings (42+ types)
    this.cryptoTypeMap = {
      // Cryptographic data types
      'key': 'string',
      'iv': 'string',
      'nonce': 'string',
      'salt': 'string',
      'hash': 'string',
      'digest': 'string',
      'signature': 'string',
      'certificate': 'string',
      'privateKey': 'string',
      'publicKey': 'string',
      'keyPair': 'array{private: string, public: string}',
      'cipher': 'string',
      'plaintext': 'string',
      'ciphertext': 'string',
      'encrypted': 'string',
      'decrypted': 'string',

      // Numeric crypto types
      'keySize': 'int',
      'blockSize': 'int',
      'hashSize': 'int',
      'rounds': 'int',
      'iterations': 'int',
      'keyLength': 'int',
      'ivLength': 'int',
      'nonceLength': 'int',
      'saltLength': 'int',
      'tagLength': 'int',

      // Byte operations
      'bytes': 'string',
      'byteArray': 'array<int>',
      'hexString': 'string',
      'base64': 'string',
      'binary': 'string',
      'buffer': 'string',

      // Algorithm parameters
      'algorithm': 'string',
      'mode': 'string',
      'padding': 'string',
      'curve': 'string',
      'format': 'string',

      // Crypto structures
      'jwk': 'array',
      'der': 'string',
      'pem': 'string',
      'pkcs12': 'string',
      'x509': 'string'
    };

    // Collection and generic types
    this.genericTypeMap = {
      'Array': 'array',
      'Object': 'object',
      'Map': 'array',
      'Set': 'array',
      'WeakMap': 'WeakMap',
      'WeakSet': 'WeakSet',
      'Promise': 'mixed', // No direct equivalent
      'Generator': '\\Generator',
      'Iterator': '\\Iterator',
      'Traversable': '\\Traversable'
    };
  }

  /**
   * Initialize cryptographic operation mappings
   * @private
   */
  _initializeCryptoMappings() {
    this.cryptoOperations = {
      // Symmetric encryption
      'encrypt': 'openssl_encrypt',
      'decrypt': 'openssl_decrypt',
      'aeadEncrypt': 'sodium_crypto_aead_*_encrypt',
      'aeadDecrypt': 'sodium_crypto_aead_*_decrypt',

      // Hashing
      'hash': 'hash',
      'hashHmac': 'hash_hmac',
      'blake2b': 'sodium_crypto_generichash',
      'sha256': 'hash("sha256", ...)',
      'sha512': 'hash("sha512", ...)',

      // Key derivation
      'pbkdf2': 'hash_pbkdf2',
      'scrypt': 'sodium_crypto_pwhash_scryptsalsa208sha256',
      'argon2': 'sodium_crypto_pwhash',

      // Random generation
      'randomBytes': 'random_bytes',
      'randomInt': 'random_int',
      'cryptoSecureRandom': 'sodium_randombytes_buf',

      // Digital signatures
      'sign': 'sodium_crypto_sign',
      'verify': 'sodium_crypto_sign_verify_detached',
      'rsaSign': 'openssl_sign',
      'rsaVerify': 'openssl_verify',

      // OpCodes integration
      'rotateLeft': OpCodes.RotL32,
      'rotateRight': OpCodes.RotR32,
      'packBigEndian': OpCodes.Pack32BE,
      'packLittleEndian': OpCodes.Pack32LE,
      'xorArrays': OpCodes.XorArrays,
      'clearMemory': OpCodes.ClearArray
    };
  }

  /**
   * Initialize warning rules for PHP best practices
   * @private
   */
  _initializeWarningRules() {
    this.warningRules = [
      {
        name: 'deprecated_function',
        pattern: /\b(each|create_function|mysql_|ereg|split)\b/g,
        message: 'Use of deprecated PHP function detected',
        severity: 'error'
      },
      {
        name: 'crypto_weakness',
        pattern: /\b(md5|sha1|des|rc4)\b/gi,
        message: 'Weak cryptographic function detected - consider stronger alternatives',
        severity: 'warning'
      },
      {
        name: 'sql_injection',
        pattern: /\$_[GP]OST.*mysql_query|mysqli_query.*\$_[GP]OST/g,
        message: 'Potential SQL injection vulnerability',
        severity: 'error'
      },
      {
        name: 'xss_vulnerability',
        pattern: /echo\s+\$_[GP]OST|print\s+\$_[GP]OST/g,
        message: 'Potential XSS vulnerability - sanitize output',
        severity: 'warning'
      },
      {
        name: 'eval_usage',
        pattern: /\beval\s*\(/g,
        message: 'Use of eval() is dangerous and should be avoided',
        severity: 'error'
      },
      {
        name: 'global_variables',
        pattern: /global\s+\$/g,
        message: 'Use of global variables should be minimized',
        severity: 'info'
      },
      {
        name: 'error_suppression',
        pattern: /@[a-zA-Z_]/g,
        message: 'Error suppression operator (@) should be used sparingly',
        severity: 'info'
      },
      {
        name: 'short_open_tags',
        pattern: /<\?\s/g,
        message: 'Short open tags are discouraged - use <?php',
        severity: 'warning'
      },
      {
        name: 'register_globals',
        pattern: /\$_(GET|POST|COOKIE|SESSION)\[.*?\]/g,
        message: 'Direct superglobal access - consider validation and sanitization',
        severity: 'info'
      },
      {
        name: 'magic_numbers',
        pattern: /\b\d{2,}\b/g,
        message: 'Consider using named constants instead of magic numbers',
        severity: 'info'
      }
    ];
  }

  /**
   * Generate PHP code from Abstract Syntax Tree with comprehensive support
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this._resetState();

      // Merge options
      const mergedOptions = { ...this.options, ...options };

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Pre-analysis phase
      this._analyzeAST(ast, mergedOptions);

      // Generate PHP code
      const code = this._generateNode(ast, mergedOptions);

      // Post-process code
      const processedCode = this._postProcessCode(code, mergedOptions);

      // Add standard headers and imports
      const finalCode = this._wrapWithHeaders(processedCode, mergedOptions);

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Generate warnings
      const warnings = this._generateWarnings(finalCode, mergedOptions);

      return this.CreateSuccessResult(finalCode, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`, {
        stack: error.stack,
        phase: this._getCurrentPhase()
      });
    }
  }

  /**
   * Reset internal state for clean generation
   * @private
   */
  _resetState() {
    this.indentLevel = 0;
    this.namespaces.clear();
    this.imports.clear();
    this.dependencies.clear();
    this.currentClass = null;
    this.currentMethod = null;
    this.variables.clear();
    this.constants.clear();
    this.traits.clear();
    this.interfaces.clear();
  }

  /**
   * Pre-analyze AST to gather metadata
   * @private
   */
  _analyzeAST(ast, options) {
    // Collect class names, method signatures, variable usage
    this._walkAST(ast, (node) => {
      switch (node.type) {
        case 'ClassDeclaration':
          if (node.id) this.currentClass = node.id.name;
          break;
        case 'FunctionDeclaration':
          if (node.id) this.constants.add(node.id.name);
          break;
        case 'VariableDeclarator':
          if (node.id) this.variables.set(node.id.name, this._inferType(node));
          break;
      }
    });
  }

  /**
   * Walk AST with callback
   * @private
   */
  _walkAST(node, callback) {
    if (!node || typeof node !== 'object') return;

    callback(node);

    for (const key in node) {
      if (node.hasOwnProperty(key) && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => this._walkAST(child, callback));
        } else {
          this._walkAST(node[key], callback);
        }
      }
    }
  }

  /**
   * Get current generation phase for error reporting
   * @private
   */
  _getCurrentPhase() {
    return this.currentClass ? `class:${this.currentClass}` :
           this.currentMethod ? `method:${this.currentMethod}` : 'global';
  }

  /**
   * Generate code for any AST node - Comprehensive 75+ node types support
   * @private
   */
  _generateNode(node, options) {
    if (!node || !node.type) {
      return '';
    }

    // Track current context for error reporting
    const previousContext = this._getCurrentPhase();

    try {
      switch (node.type) {
        // Program and top-level structures
        case 'Program':
        case 'Module':
          return this._generateProgram(node, options);

        // Declarations
        case 'FunctionDeclaration':
          return this._generateFunction(node, options);
        case 'ClassDeclaration':
          return this._generateClass(node, options);
        case 'InterfaceDeclaration':
          return this._generateInterface(node, options);
        case 'TraitDeclaration':
          return this._generateTrait(node, options);
        case 'EnumDeclaration':
          return this._generateEnum(node, options);
        case 'VariableDeclaration':
          return this._generateVariableDeclaration(node, options);
        case 'VariableDeclarator':
          return this._generateVariableDeclarator(node, options);

        // Method and property definitions
        case 'MethodDefinition':
          return this._generateMethod(node, options);
        case 'PropertyDefinition':
        case 'Property':
          return this._generateProperty(node, options);
        case 'FunctionExpression':
          return this._generateFunctionExpression(node, options);
        case 'ArrowFunctionExpression':
          return this._generateArrowFunction(node, options);

        // Statements
        case 'BlockStatement':
          return this._generateBlock(node, options);
        case 'ExpressionStatement':
          return this._generateExpressionStatement(node, options);
        case 'ReturnStatement':
          return this._generateReturnStatement(node, options);
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
        case 'BreakStatement':
          return this._generateBreakStatement(node, options);
        case 'ContinueStatement':
          return this._generateContinueStatement(node, options);
        case 'ThrowStatement':
          return this._generateThrowStatement(node, options);
        case 'TryStatement':
          return this._generateTryStatement(node, options);
        case 'CatchClause':
          return this._generateCatchClause(node, options);
        case 'FinallyClause':
          return this._generateFinallyClause(node, options);
        case 'SwitchStatement':
          return this._generateSwitchStatement(node, options);
        case 'SwitchCase':
          return this._generateSwitchCase(node, options);

        // Expressions
        case 'BinaryExpression':
          return this._generateBinaryExpression(node, options);
        case 'UnaryExpression':
          return this._generateUnaryExpression(node, options);
        case 'UpdateExpression':
          return this._generateUpdateExpression(node, options);
        case 'LogicalExpression':
          return this._generateLogicalExpression(node, options);
        case 'ConditionalExpression':
          return this._generateConditionalExpression(node, options);
        case 'AssignmentExpression':
          return this._generateAssignmentExpression(node, options);
        case 'SequenceExpression':
          return this._generateSequenceExpression(node, options);
        case 'CallExpression':
          return this._generateCallExpression(node, options);
        case 'NewExpression':
          return this._generateNewExpression(node, options);
        case 'MemberExpression':
          return this._generateMemberExpression(node, options);
        case 'MetaProperty':
          return this._generateMetaProperty(node, options);

        // Object and array expressions
        case 'ObjectExpression':
          return this._generateObjectExpression(node, options);
        case 'ArrayExpression':
          return this._generateArrayExpression(node, options);
        case 'SpreadElement':
          return this._generateSpreadElement(node, options);
        case 'RestElement':
          return this._generateRestElement(node, options);

        // Template and tag expressions
        case 'TemplateLiteral':
          return this._generateTemplateLiteral(node, options);
        case 'TemplateElement':
          return this._generateTemplateElement(node, options);
        case 'TaggedTemplateExpression':
          return this._generateTaggedTemplateExpression(node, options);

        // Identifiers and literals
        case 'Identifier':
          return this._generateIdentifier(node, options);
        case 'Literal':
          return this._generateLiteral(node, options);
        case 'RegExpLiteral':
          return this._generateRegExpLiteral(node, options);
        case 'NullLiteral':
          return 'null';
        case 'BooleanLiteral':
          return this._generateBooleanLiteral(node, options);
        case 'NumericLiteral':
          return this._generateNumericLiteral(node, options);
        case 'StringLiteral':
          return this._generateStringLiteral(node, options);

        // Special expressions
        case 'ThisExpression':
          return '$this';
        case 'Super':
          return 'parent';
        case 'EmptyStatement':
          return ';';

        // Modern JavaScript features
        case 'ClassExpression':
          return this._generateClassExpression(node, options);
        case 'YieldExpression':
          return this._generateYieldExpression(node, options);
        case 'AwaitExpression':
          return this._generateAwaitExpression(node, options);

        // Import/Export (converted to include/require)
        case 'ImportDeclaration':
          return this._generateImportDeclaration(node, options);
        case 'ExportDeclaration':
          return this._generateExportDeclaration(node, options);
        case 'ExportNamedDeclaration':
          return this._generateExportNamedDeclaration(node, options);
        case 'ExportDefaultDeclaration':
          return this._generateExportDefaultDeclaration(node, options);
        case 'ExportAllDeclaration':
          return this._generateExportAllDeclaration(node, options);
        case 'ImportSpecifier':
          return this._generateImportSpecifier(node, options);
        case 'ExportSpecifier':
          return this._generateExportSpecifier(node, options);

        // Patterns
        case 'ObjectPattern':
          return this._generateObjectPattern(node, options);
        case 'ArrayPattern':
          return this._generateArrayPattern(node, options);
        case 'AssignmentPattern':
          return this._generateAssignmentPattern(node, options);

        // PHP-specific constructs
        case 'GlobalStatement':
          return this._generateGlobalStatement(node, options);
        case 'StaticStatement':
          return this._generateStaticStatement(node, options);
        case 'EchoStatement':
          return this._generateEchoStatement(node, options);
        case 'IncludeExpression':
          return this._generateIncludeExpression(node, options);
        case 'RequireExpression':
          return this._generateRequireExpression(node, options);
        case 'IssetExpression':
          return this._generateIssetExpression(node, options);
        case 'EmptyExpression':
          return this._generateEmptyExpression(node, options);
        case 'UnsetStatement':
          return this._generateUnsetStatement(node, options);
        case 'ListExpression':
          return this._generateListExpression(node, options);
        case 'EvalExpression':
          return this._generateEvalExpression(node, options);
        case 'ExitStatement':
          return this._generateExitStatement(node, options);
        case 'CloneExpression':
          return this._generateCloneExpression(node, options);
        case 'InstanceofExpression':
          return this._generateInstanceofExpression(node, options);

        // Error handling for unknown types
        default:
          if (options.generateTODOs) {
            return `// TODO: Implement ${node.type}`;
          } else {
            console.warn(`Unknown AST node type: ${node.type}`);
            return '';
          }
      }
    } catch (error) {
      throw new Error(`Error generating ${node.type}: ${error.message}`);
    }
  }

  /**
   * Generate program (root level) - Enhanced
   * @private
   */
  _generateProgram(node, options) {
    if (!node.body || !Array.isArray(node.body)) {
      return '';
    }

    const statements = [];

    // Process each statement with context tracking
    for (const stmt of node.body) {
      const code = this._generateNode(stmt, options);
      if (code && code.trim() !== '') {
        statements.push(code);
      }
    }

    return statements.join('\n\n');
  }

  /**
   * Post-process generated code
   * @private
   */
  _postProcessCode(code, options) {
    let processed = code;

    // Remove excessive blank lines
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // Ensure proper line endings
    processed = processed.replace(/\r\n/g, '\n');

    // Add final newline
    if (!processed.endsWith('\n')) {
      processed += '\n';
    }

    return processed;
  }

  /**
   * Infer type from AST node context
   * @private
   */
  _inferType(node) {
    if (!node) return 'mixed';

    if (node.init) {
      const init = node.init;
      if (init.type === 'Literal') {
        if (typeof init.value === 'string') return 'string';
        if (typeof init.value === 'number') return Number.isInteger(init.value) ? 'int' : 'float';
        if (typeof init.value === 'boolean') return 'bool';
        if (init.value === null) return 'null';
      } else if (init.type === 'ArrayExpression') {
        return 'array';
      } else if (init.type === 'ObjectExpression') {
        return 'object';
      }
    }

    // Check crypto context
    if (node.id && node.id.name) {
      const name = node.id.name.toLowerCase();
      if (this.cryptoTypeMap[name]) {
        return this.cryptoTypeMap[name];
      }
    }

    return 'mixed';
  }

  /**
   * Generate function declaration
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? this._toPHPName(node.id.name) : 'unnamedFunction';
    let code = '';
    
    // DocBlock comment
    if (options.addDocBlocks) {
      code += this._indent('/**\n');
      code += this._indent(` * ${functionName} function\n`);
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          const paramType = this._inferParameterType(paramName);
          code += this._indent(` * @param ${paramType} $${paramName}\n`);
        });
      }
      const returnType = this._inferReturnType(functionName);
      code += this._indent(` * @return ${returnType}\n`);
      code += this._indent(' */\n');
    }
    
    // Function signature
    code += this._indent(`function ${functionName}(`);
    
    // Parameters with type hints
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        if (options.addTypeHints) {
          const typeHint = this._inferPHPTypeHint(paramName);
          return typeHint ? `${typeHint} $${paramName}` : `$${paramName}`;
        }
        return `$${paramName}`;
      });
      code += params.join(', ');
    }
    
    // Return type hint
    if (options.addTypeHints) {
      const returnType = this._inferPHPReturnType(functionName);
      code += returnType ? `): ${returnType}` : ')';
    } else {
      code += ')';
    }
    
    code += '\n' + this._indent('{\n');
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("return null;\n");
    } else {
      code += this._indent("return null;\n");
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    let code = '';
    
    // DocBlock for class
    if (options.addDocBlocks) {
      code += this._indent('/**\n');
      code += this._indent(` * ${className} class\n`);
      code += this._indent(' */\n');
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className} extends ${superName}\n`);
    } else {
      code += this._indent(`class ${className}\n`);
    }
    
    code += this._indent('{\n');
    
    // Class body
    this.indentLevel++;
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethod(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = node.key.name;
    const isConstructor = methodName === 'constructor';
    let code = '';
    
    // DocBlock
    if (options.addDocBlocks) {
      code += this._indent('/**\n');
      code += this._indent(` * ${isConstructor ? 'Constructor' : methodName + ' method'}\n`);
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          const paramType = this._inferParameterType(paramName);
          code += this._indent(` * @param ${paramType} $${paramName}\n`);
        });
      }
      if (!isConstructor) {
        const returnType = this._inferReturnType(methodName);
        code += this._indent(` * @return ${returnType}\n`);
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    const phpMethodName = isConstructor ? '__construct' : this._toPHPName(methodName);
    code += this._indent(`public function ${phpMethodName}(`);
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        if (options.addTypeHints) {
          const typeHint = this._inferPHPTypeHint(paramName);
          return typeHint ? `${typeHint} $${paramName}` : `$${paramName}`;
        }
        return `$${paramName}`;
      });
      code += params.join(', ');
    }
    
    // Return type
    if (options.addTypeHints && !isConstructor) {
      const returnType = this._inferPHPReturnType(methodName);
      code += returnType ? `): ${returnType}` : ')';
    } else {
      code += ')';
    }
    
    code += '\n' + this._indent('{\n');
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? '' : this._indent("return null;\n"));
    } else {
      if (!isConstructor) {
        code += this._indent("return null;\n");
      }
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent("return null;\n");
    }
    
    return node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim())
      .join('\n');
  }

  /**
   * Generate variable declaration
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';
    
    return node.declarations
      .map(decl => {
        const varName = decl.id ? '$' + decl.id.name : '$variable';
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          return this._indent(`${varName} = ${initValue};\n`);
        } else {
          return this._indent(`${varName} = null;\n`);
        }
      })
      .join('');
  }

  /**
   * Generate expression statement
   * @private
   */
  _generateExpressionStatement(node, options) {
    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(expr + ';\n') : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent(`return ${returnValue};\n`);
    } else {
      return this._indent('return;\n');
    }
  }

  /**
   * Generate binary expression - Enhanced with PHP operators
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);

    // Handle special cases
    if (operator === '.' && (node.operator === '+' && this._isStringConcatenation(node))) {
      return `${left} . ${right}`;
    }

    // OpCodes integration for crypto operations
    if (options.enableOpCodesIntegration && this._isCryptoOperation(node, operator)) {
      return this._generateOpCodesOperation(node, left, right, operator, options);
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Check if binary expression is string concatenation
   * @private
   */
  _isStringConcatenation(node) {
    // Simple heuristic: if either operand is a string literal or template
    return (node.left?.type === 'Literal' && typeof node.left.value === 'string') ||
           (node.right?.type === 'Literal' && typeof node.right.value === 'string') ||
           node.left?.type === 'TemplateLiteral' ||
           node.right?.type === 'TemplateLiteral';
  }

  /**
   * Check if operation is cryptographic
   * @private
   */
  _isCryptoOperation(node, operator) {
    // Check for bit operations that might be crypto-related
    return ['<<', '>>', '&', '|', '^'].includes(operator) &&
           this._isInCryptoContext();
  }

  /**
   * Generate OpCodes operation
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
      default:
        return `${left} ${operator} ${right}`;
    }
  }

  /**
   * Check if we're in a cryptographic context
   * @private
   */
  _isInCryptoContext() {
    return this.currentClass && (
      this.currentClass.toLowerCase().includes('cipher') ||
      this.currentClass.toLowerCase().includes('crypto') ||
      this.currentClass.toLowerCase().includes('hash') ||
      this.currentClass.toLowerCase().includes('encrypt')
    );
  }

  /**
   * Check if XOR operation is on arrays
   * @private
   */
  _isArrayXor(node) {
    // Simple heuristic: check if operands look like arrays
    return node.left?.type === 'ArrayExpression' ||
           node.right?.type === 'ArrayExpression' ||
           (node.left?.type === 'Identifier' && node.left.name.toLowerCase().includes('array')) ||
           (node.right?.type === 'Identifier' && node.right.name.toLowerCase().includes('array'));
  }

  /**
   * Generate call expression - Enhanced with crypto function mapping
   * @private
   */
  _generateCallExpression(node, options) {
    // Handle method calls vs function calls
    if (node.callee && node.callee.type === 'MemberExpression') {
      return this._generateMethodCall(node, options);
    }

    // Handle function calls
    const functionName = this._getFunctionName(node.callee);
    const args = this._generateArguments(node.arguments || [], options);

    // Map crypto functions
    if (options.enableOpCodesIntegration && this.cryptoOperations[functionName]) {
      const phpFunction = this.cryptoOperations[functionName];
      if (typeof phpFunction === 'function') {
        return phpFunction(args);
      } else {
        return `${phpFunction}(${args})`;
      }
    }

    // Map common JavaScript functions to PHP equivalents
    const mappedFunction = this._mapJSFunctionToPHP(functionName);
    return `${mappedFunction}(${args})`;
  }

  /**
   * Generate method call
   * @private
   */
  _generateMethodCall(node, options) {
    const object = this._generateNode(node.callee.object, options);
    const method = node.callee.property.name || node.callee.property;
    const args = this._generateArguments(node.arguments || [], options);

    // Handle static method calls
    if (node.callee.object.type === 'Identifier' &&
        node.callee.object.name[0] === node.callee.object.name[0].toUpperCase()) {
      return `${object}::${method}(${args})`;
    }

    // Handle $this calls
    if (object === '$this' || object === 'this') {
      return `$this->${method}(${args})`;
    }

    return `${object}->${method}(${args})`;
  }

  /**
   * Generate arguments with named arguments support (PHP 8+)
   * @private
   */
  _generateArguments(args, options) {
    return args.map(arg => {
      // Named arguments (PHP 8+)
      if (arg.type === 'AssignmentExpression' && options.useNamedArguments) {
        const name = this._generateNode(arg.left, options).replace('$', '');
        const value = this._generateNode(arg.right, options);
        return `${name}: ${value}`;
      }

      return this._generateNode(arg, options);
    }).join(', ');
  }

  /**
   * Get function name from callee
   * @private
   */
  _getFunctionName(callee) {
    if (callee.type === 'Identifier') {
      return callee.name;
    }
    return 'unknownFunction';
  }

  /**
   * Map JavaScript functions to PHP equivalents
   * @private
   */
  _mapJSFunctionToPHP(functionName) {
    const jsToPhpMap = {
      // Array functions
      'push': 'array_push',
      'pop': 'array_pop',
      'shift': 'array_shift',
      'unshift': 'array_unshift',
      'splice': 'array_splice',
      'slice': 'array_slice',
      'indexOf': 'array_search',
      'join': 'implode',
      'split': 'explode',
      'map': 'array_map',
      'filter': 'array_filter',
      'reduce': 'array_reduce',
      'forEach': 'array_walk',
      'sort': 'sort',
      'reverse': 'array_reverse',

      // String functions
      'charAt': 'substr',
      'substring': 'substr',
      'substr': 'substr',
      'toLowerCase': 'strtolower',
      'toUpperCase': 'strtoupper',
      'trim': 'trim',
      'replace': 'str_replace',
      'match': 'preg_match',
      'search': 'strpos',

      // Math functions
      'floor': 'floor',
      'ceil': 'ceil',
      'round': 'round',
      'abs': 'abs',
      'min': 'min',
      'max': 'max',
      'random': 'rand',

      // Object functions
      'hasOwnProperty': 'property_exists',
      'keys': 'array_keys',
      'values': 'array_values',

      // Console functions
      'log': 'echo',
      'error': 'error_log',
      'warn': 'trigger_error',

      // Type functions
      'typeof': 'gettype',
      'instanceof': 'instanceof',
      'isArray': 'is_array',
      'isNaN': 'is_nan',
      'isFinite': 'is_finite',
      'parseInt': 'intval',
      'parseFloat': 'floatval',

      // Date functions
      'now': 'time',
      'getTime': 'time'
    };

    return jsToPhpMap[functionName] || functionName;
  }

  /**
   * Generate member expression - Enhanced
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);

    // Handle computed vs non-computed property access
    let property;
    if (node.computed) {
      const prop = this._generateNode(node.property, options);
      property = `[${prop}]`;
    } else {
      const propName = node.property.name || node.property;

      // Handle static property access
      if (this._isStaticAccess(node)) {
        property = `::$${propName}`;
      } else {
        property = `->${propName}`;
      }
    }

    // Handle special cases
    if (object === '$this' || object === 'this') {
      return node.computed ? `$this${property}` : `$this->${node.property.name || node.property}`;
    }

    // Handle class constants
    if (this._isClassConstant(node)) {
      const className = object.replace('$', '');
      const constName = node.property.name || node.property;
      return `${className}::${constName}`;
    }

    return `${object}${property}`;
  }

  /**
   * Check if member access is static
   * @private
   */
  _isStaticAccess(node) {
    return node.object.type === 'Identifier' &&
           node.object.name[0] === node.object.name[0].toUpperCase() &&
           !node.computed;
  }

  /**
   * Check if accessing a class constant
   * @private
   */
  _isClassConstant(node) {
    return !node.computed &&
           node.property.name &&
           node.property.name === node.property.name.toUpperCase();
  }

  /**
   * Generate assignment expression - Enhanced
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);

    // Handle string concatenation assignment
    if (operator === '.=' && node.operator === '+=') {
      return `${left} .= ${right}`;
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier - Enhanced with context awareness
   * @private
   */
  _generateIdentifier(node, options) {
    if (!node.name) return '$unknown';

    const name = node.name;

    // Special identifiers
    if (name === 'this') return '$this';
    if (name === 'self') return 'self';
    if (name === 'parent') return 'parent';
    if (name === 'static') return 'static';

    // Constants (all uppercase)
    if (name === name.toUpperCase() && name.length > 1) {
      return name;
    }

    // Class names (PascalCase)
    if (name[0] === name[0].toUpperCase() && name.includes('_') === false) {
      return name;
    }

    // Global functions
    if (this._isGlobalFunction(name)) {
      return name;
    }

    // Regular variables
    return '$' + this._toPHPName(name);
  }

  /**
   * Check if identifier is a global function
   * @private
   */
  _isGlobalFunction(name) {
    const globalFunctions = [
      'echo', 'print', 'var_dump', 'print_r', 'die', 'exit',
      'isset', 'empty', 'unset', 'include', 'require', 'include_once', 'require_once',
      'array', 'count', 'sizeof', 'is_array', 'is_string', 'is_int', 'is_float', 'is_bool',
      'strlen', 'substr', 'strpos', 'str_replace', 'preg_match', 'preg_replace',
      'json_encode', 'json_decode', 'serialize', 'unserialize',
      'hash', 'hash_hmac', 'openssl_encrypt', 'openssl_decrypt', 'random_bytes'
    ];
    return globalFunctions.includes(name);
  }

  /**
   * Generate literal - Enhanced with PHP-specific formatting
   * @private
   */
  _generateLiteral(node, options) {
    if (node.value === null) {
      return 'null';
    }

    if (typeof node.value === 'string') {
      // Handle special string cases
      if (node.value.includes('\n') || node.value.includes('\t')) {
        // Use double quotes for strings with escape sequences
        return `"${this._escapeString(node.value)}"`;
      } else {
        // Use single quotes for simple strings (PHP convention)
        return `'${node.value.replace(/'/g, "\\\'")}';`
      }
    }

    if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    }

    if (typeof node.value === 'number') {
      // Handle special numeric values
      if (node.value === Infinity) return 'INF';
      if (node.value === -Infinity) return '-INF';
      if (isNaN(node.value)) return 'NAN';

      // Handle different number formats
      if (Number.isInteger(node.value)) {
        // Check for hex, octal, binary representations
        if (node.raw && node.raw.startsWith('0x')) {
          return node.raw; // Keep hex format
        }
        if (node.raw && node.raw.startsWith('0b')) {
          return `0b${node.value.toString(2)}`; // Binary
        }
        if (node.raw && node.raw.startsWith('0o')) {
          return `0o${node.value.toString(8)}`; // Octal
        }
        return String(node.value);
      } else {
        return String(node.value);
      }
    }

    return String(node.value);
  }

  /**
   * Escape string for PHP
   * @private
   */
  _escapeString(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\$/g, '\\$'); // Escape $ to prevent variable interpolation
  }

  /**
   * Convert JavaScript names to PHP naming convention
   * @private
   */
  _toPHPName(name) {
    if (!name) return 'unnamed';

    // Handle special cases
    if (name === 'constructor') return '__construct';
    if (name === 'destructor') return '__destruct';

    // PHP uses camelCase for methods and variables, PascalCase for classes
    // Keep the name as-is since both JS and PHP use similar conventions
    return name;
  }

  /**
   * Map JavaScript operators to PHP equivalents - Comprehensive
   * @private
   */
  _mapOperator(operator) {
    const operatorMap = {
      // Comparison operators
      '===': '===',
      '!==': '!==',
      '==': '==',
      '!=': '!=',
      '<': '<',
      '>': '>',
      '<=': '<=',
      '>=': '>=',
      '<=>': '<=>', // PHP spaceship operator

      // Logical operators
      '&&': '&&',
      '||': '||',
      '!': '!',
      'and': 'and',
      'or': 'or',
      'xor': 'xor',

      // Arithmetic operators
      '+': '+',
      '-': '-',
      '*': '*',
      '/': '/',
      '%': '%',
      '**': '**', // Exponentiation (PHP 5.6+)

      // Bitwise operators
      '&': '&',
      '|': '|',
      '^': '^',
      '~': '~',
      '<<': '<<',
      '>>': '>>',

      // Assignment operators
      '=': '=',
      '+=': '+=',
      '-=': '-=',
      '*=': '*=',
      '/=': '/=',
      '%=': '%=',
      '**=': '**=',
      '.=': '.=', // String concatenation assignment
      '&=': '&=',
      '|=': '|=',
      '^=': '^=',
      '<<=': '<<=',
      '>>=': '>>=',
      '??=': '??=', // Null coalescing assignment (PHP 7.4+)

      // Increment/Decrement
      '++': '++',
      '--': '--',

      // String concatenation
      '.': '.', // PHP uses . for string concatenation

      // Null coalescing
      '??': '??', // PHP 7+

      // Type operators
      'instanceof': 'instanceof',

      // Error control
      '@': '@'
    };

    return operatorMap[operator] || operator;
  }

  /**
   * Infer parameter type for docblocks - Enhanced with crypto context
   * @private
   */
  _inferParameterType(paramName) {
    if (!paramName) return 'mixed';

    const name = paramName.toLowerCase();

    // Check crypto-specific types first
    if (this.cryptoTypeMap[name]) {
      return this.cryptoTypeMap[name];
    }

    // General parameter types
    const typeMap = {
      'data': 'string|array',
      'input': 'mixed',
      'output': 'mixed',
      'value': 'mixed',
      'values': 'array',
      'index': 'int',
      'position': 'int',
      'offset': 'int',
      'length': 'int',
      'size': 'int',
      'count': 'int',
      'limit': 'int',
      'max': 'int',
      'min': 'int',
      'start': 'int',
      'end': 'int',
      'step': 'int',
      'flag': 'bool',
      'flags': 'int',
      'enabled': 'bool',
      'disabled': 'bool',
      'active': 'bool',
      'valid': 'bool',
      'name': 'string',
      'title': 'string',
      'description': 'string',
      'message': 'string',
      'text': 'string',
      'content': 'string',
      'body': 'string',
      'url': 'string',
      'uri': 'string',
      'path': 'string',
      'file': 'string',
      'filename': 'string',
      'directory': 'string',
      'folder': 'string',
      'email': 'string',
      'username': 'string',
      'password': 'string',
      'token': 'string',
      'id': 'int|string',
      'uuid': 'string',
      'timestamp': 'int',
      'date': 'string|\\DateTime',
      'time': 'int|string',
      'callback': 'callable',
      'closure': 'callable',
      'function': 'callable',
      'method': 'callable',
      'class': 'string|object',
      'object': 'object',
      'instance': 'object',
      'resource': 'resource',
      'handle': 'resource',
      'connection': 'resource|object',
      'config': 'array',
      'settings': 'array',
      'options': 'array',
      'params': 'array',
      'parameters': 'array',
      'arguments': 'array',
      'args': 'array',
      'items': 'array',
      'list': 'array',
      'collection': 'array|\\Traversable',
      'iterator': '\\Iterator',
      'stream': 'resource',
      'buffer': 'string',
      'bytes': 'string',
      'binary': 'string'
    };

    return typeMap[name] || 'mixed';
  }

  /**
   * Infer return type for docblocks - Enhanced with comprehensive mapping
   * @private
   */
  _inferReturnType(functionName) {
    if (!functionName) return 'mixed';

    const name = functionName.toLowerCase();

    // Cryptographic functions
    const cryptoReturnTypes = {
      'encrypt': 'string',
      'decrypt': 'string',
      'hash': 'string',
      'sign': 'string',
      'verify': 'bool',
      'generatekey': 'string',
      'generatekeypair': 'array{private: string, public: string}',
      'generaterandom': 'string',
      'generateiv': 'string',
      'generatenonce': 'string',
      'generatesalt': 'string'
    };

    if (cryptoReturnTypes[name]) {
      return cryptoReturnTypes[name];
    }

    // Common function patterns
    const returnTypeMap = {
      // Boolean returns
      'is': 'bool',
      'has': 'bool',
      'can': 'bool',
      'should': 'bool',
      'will': 'bool',
      'exists': 'bool',
      'contains': 'bool',
      'includes': 'bool',
      'equals': 'bool',
      'matches': 'bool',
      'validates': 'bool',
      'check': 'bool',
      'test': 'bool',
      'verify': 'bool',
      'confirm': 'bool',
      'validate': 'bool',

      // String returns
      'get': 'string',
      'fetch': 'string',
      'read': 'string',
      'load': 'string',
      'render': 'string',
      'format': 'string',
      'parse': 'string',
      'convert': 'string',
      'transform': 'string',
      'encode': 'string',
      'decode': 'string',
      'serialize': 'string',
      'stringify': 'string',
      'tostring': 'string',
      'build': 'string',
      'generate': 'string',
      'create': 'string',

      // Integer returns
      'count': 'int',
      'size': 'int',
      'length': 'int',
      'indexOf': 'int',
      'position': 'int',
      'index': 'int',
      'find': 'int',
      'search': 'int',
      'calculate': 'int|float',
      'compute': 'int|float',
      'sum': 'int|float',
      'total': 'int|float',

      // Array returns
      'list': 'array',
      'all': 'array',
      'select': 'array',
      'filter': 'array',
      'map': 'array',
      'reduce': 'mixed',
      'split': 'array',
      'explode': 'array',
      'parse': 'array',
      'extract': 'array',
      'collect': 'array',
      'gather': 'array',

      // Object returns
      'make': 'object',
      'build': 'object',
      'construct': 'object',
      'instance': 'object',

      // Resource returns
      'open': 'resource',
      'connect': 'resource',

      // Void returns
      'set': 'void',
      'put': 'void',
      'save': 'void',
      'store': 'void',
      'write': 'void',
      'update': 'void',
      'delete': 'void',
      'remove': 'void',
      'clear': 'void',
      'reset': 'void',
      'init': 'void',
      'initialize': 'void',
      'setup': 'void',
      'configure': 'void',
      'execute': 'void',
      'run': 'void',
      'process': 'void',
      'handle': 'void',
      'manage': 'void',
      'destroy': 'void',
      'cleanup': 'void',
      'close': 'void',
      'disconnect': 'void'
    };

    // Check for exact matches first
    if (returnTypeMap[name]) {
      return returnTypeMap[name];
    }

    // Check for pattern matches
    for (const [pattern, type] of Object.entries(returnTypeMap)) {
      if (name.startsWith(pattern) || name.endsWith(pattern) || name.includes(pattern)) {
        return type;
      }
    }

    return 'mixed';
  }

  /**
   * Infer PHP type hints for parameters - Enhanced for PHP 8+
   * @private
   */
  _inferPHPTypeHint(param, options = {}) {
    if (!param) return '';

    // Get parameter name
    const paramName = param.name || param.id?.name || '';
    const name = paramName.toLowerCase();

    // Check crypto-specific types first
    if (this.cryptoTypeMap[name]) {
      const cryptoType = this.cryptoTypeMap[name];
      // Convert complex types to simpler ones for type hints
      if (cryptoType.includes('|')) {
        return options.useUnionTypes ? cryptoType : cryptoType.split('|')[0];
      }
      if (cryptoType.includes('array{')) {
        return 'array';
      }
      if (cryptoType.includes('<')) {
        return cryptoType.split('<')[0];
      }
      return cryptoType;
    }

    // Enhanced type mapping for PHP 8+
    const typeHintMap = {
      // Basic types
      'string': 'string',
      'int': 'int',
      'integer': 'int',
      'float': 'float',
      'double': 'float',
      'bool': 'bool',
      'boolean': 'bool',
      'array': 'array',
      'object': 'object',
      'callable': 'callable',
      'iterable': 'iterable',
      'mixed': options.useUnionTypes ? 'mixed' : '',

      // Common parameter names
      'data': 'string',
      'input': options.useUnionTypes ? 'mixed' : '',
      'output': options.useUnionTypes ? 'mixed' : '',
      'value': options.useUnionTypes ? 'mixed' : '',
      'values': 'array',
      'index': 'int',
      'position': 'int',
      'offset': 'int',
      'length': 'int',
      'size': 'int',
      'count': 'int',
      'limit': 'int',
      'max': 'int',
      'min': 'int',
      'start': 'int',
      'end': 'int',
      'step': 'int',
      'flag': 'bool',
      'flags': 'int',
      'enabled': 'bool',
      'disabled': 'bool',
      'active': 'bool',
      'valid': 'bool',
      'name': 'string',
      'title': 'string',
      'description': 'string',
      'message': 'string',
      'text': 'string',
      'content': 'string',
      'body': 'string',
      'url': 'string',
      'uri': 'string',
      'path': 'string',
      'file': 'string',
      'filename': 'string',
      'directory': 'string',
      'folder': 'string',
      'email': 'string',
      'username': 'string',
      'password': 'string',
      'token': 'string',
      'id': options.useUnionTypes ? 'int|string' : '',
      'uuid': 'string',
      'timestamp': 'int',
      'date': '\\DateTime',
      'time': options.useUnionTypes ? 'int|string' : '',
      'callback': 'callable',
      'closure': 'callable',
      'function': 'callable',
      'method': 'callable',
      'class': options.useUnionTypes ? 'string|object' : '',
      'object': 'object',
      'instance': 'object',
      'resource': options.useUnionTypes ? 'resource' : '',
      'handle': options.useUnionTypes ? 'resource' : '',
      'connection': options.useUnionTypes ? 'resource|object' : '',
      'config': 'array',
      'settings': 'array',
      'options': 'array',
      'params': 'array',
      'parameters': 'array',
      'arguments': 'array',
      'args': 'array',
      'items': 'array',
      'list': 'array',
      'collection': options.useUnionTypes ? 'array|\\Traversable' : 'array',
      'iterator': '\\Iterator',
      'stream': options.useUnionTypes ? 'resource' : '',
      'buffer': 'string',
      'bytes': 'string',
      'binary': 'string'
    };

    return typeHintMap[name] || '';
  }

  /**
   * Infer PHP return type hints - Enhanced for PHP 8+
   * @private
   */
  _inferPHPReturnType(functionName, functionNode = null) {
    if (!functionName) return '';

    const name = functionName.toLowerCase();

    // Special methods that don't return values
    if (name === '__construct' || name === '__destruct' ||
        name === 'constructor' || name === 'destructor') {
      return '';
    }

    // Check if function has explicit return type from AST analysis
    if (functionNode && this._hasExplicitReturnType(functionNode)) {
      return this._extractReturnTypeFromAST(functionNode);
    }

    // Get basic return type
    const basicType = this._inferReturnType(functionName);

    // Convert docblock types to PHP type hints
    const typeHintMap = {
      'mixed': 'mixed',
      'void': 'void',
      'never': 'never',
      'null': '?mixed',
      'bool': 'bool',
      'boolean': 'bool',
      'int': 'int',
      'integer': 'int',
      'float': 'float',
      'double': 'float',
      'string': 'string',
      'array': 'array',
      'object': 'object',
      'callable': 'callable',
      'iterable': 'iterable',
      'resource': 'mixed', // resource type hint not available
      '\\DateTime': '\\DateTime',
      '\\Iterator': '\\Iterator',
      '\\Traversable': '\\Traversable',
      '\\Generator': '\\Generator'
    };

    // Handle union types
    if (basicType.includes('|')) {
      const types = basicType.split('|').map(t => t.trim());
      const mappedTypes = types.map(t => typeHintMap[t] || t).filter(t => t && t !== 'mixed');

      if (mappedTypes.length === 0) return 'mixed';
      if (mappedTypes.length === 1) return mappedTypes[0];

      // PHP 8+ union types
      return mappedTypes.join('|');
    }

    // Handle nullable types
    if (basicType.includes('null')) {
      const nonNullType = basicType.replace(/\|null|null\|/, '').trim();
      const mappedType = typeHintMap[nonNullType] || nonNullType;
      return mappedType ? `?${mappedType}` : 'mixed';
    }

    // Handle array types
    if (basicType.includes('array{')) {
      return 'array';
    }

    if (basicType.includes('array<')) {
      return 'array';
    }

    return typeHintMap[basicType] || '';
  }

  /**
   * Check if function has explicit return type
   * @private
   */
  _hasExplicitReturnType(functionNode) {
    return functionNode.returnType !== null && functionNode.returnType !== undefined;
  }

  /**
   * Extract return type from AST
   * @private
   */
  _extractReturnTypeFromAST(functionNode) {
    if (!functionNode.returnType) return '';

    // Handle different return type representations
    if (typeof functionNode.returnType === 'string') {
      return functionNode.returnType;
    }

    if (functionNode.returnType.name) {
      return functionNode.returnType.name;
    }

    return '';
  }

  /**
   * Add proper indentation with enhanced formatting
   * @private
   */
  _indent(code) {
    if (!code) return '';

    const indentStr = this.options.indent.repeat(this.indentLevel);
    return code.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      return indentStr + trimmed;
    }).join('\n');
  }

  /**
   * Get visibility modifier
   * @private
   */
  _getVisibility(node, defaultVisibility = 'public') {
    if (node.accessibility) {
      return node.accessibility;
    }
    if (node.kind === 'private') return 'private';
    if (node.kind === 'protected') return 'protected';
    if (node.kind === 'public') return 'public';
    return defaultVisibility;
  }

  /**
   * Check if node is static
   * @private
   */
  _isStatic(node) {
    return node.static === true;
  }

  /**
   * Check if function has return statement
   * @private
   */
  _hasReturnStatement(body) {
    if (!body) return false;

    // Simple check for return statements
    const hasReturn = this._findInAST(body, node => node.type === 'ReturnStatement');
    return hasReturn.length > 0;
  }

  /**
   * Find nodes in AST matching predicate
   * @private
   */
  _findInAST(node, predicate) {
    const results = [];

    const walk = (n) => {
      if (!n || typeof n !== 'object') return;

      if (predicate(n)) {
        results.push(n);
      }

      for (const key in n) {
        if (n.hasOwnProperty(key) && typeof n[key] === 'object') {
          if (Array.isArray(n[key])) {
            n[key].forEach(walk);
          } else {
            walk(n[key]);
          }
        }
      }
    };

    walk(node);
    return results;
  }

  /**
   * Check if function is void (no return value expected)
   * @private
   */
  _isVoidFunction(functionName) {
    const voidFunctions = [
      '__construct', '__destruct', 'constructor', 'destructor',
      'set', 'put', 'save', 'store', 'write', 'update', 'delete', 'remove',
      'clear', 'reset', 'init', 'initialize', 'setup', 'configure',
      'execute', 'run', 'process', 'handle', 'manage', 'destroy',
      'cleanup', 'close', 'disconnect'
    ];

    return voidFunctions.includes(functionName.toLowerCase()) ||
           functionName.toLowerCase().startsWith('set') ||
           functionName.toLowerCase().startsWith('add') ||
           functionName.toLowerCase().startsWith('remove') ||
           functionName.toLowerCase().startsWith('delete') ||
           functionName.toLowerCase().startsWith('update') ||
           functionName.toLowerCase().startsWith('save') ||
           functionName.toLowerCase().startsWith('store');
  }

  /**
   * Wrap generated code with comprehensive headers
   * @private
   */
  _wrapWithHeaders(code, options) {
    let headers = '<?php\n';

    // Strict types declaration (PHP 7+)
    if (options.strictTypes) {
      headers += 'declare(strict_types=1);\n';
    }

    // Add namespace if detected
    if (this.namespaces.size > 0) {
      const namespace = Array.from(this.namespaces)[0]; // Use first namespace
      headers += `\nnamespace ${namespace};\n`;
    }

    // Add imports/use statements
    if (this.imports.size > 0) {
      headers += '\n';
      for (const importStmt of this.imports) {
        headers += `use ${importStmt};\n`;
      }
    }

    // Add file-level docblock if in class context
    if (options.addDocBlocks && this.currentClass) {
      headers += '\n/**\n';
      headers += ` * ${this.currentClass} - Generated PHP class\n`;
      headers += ' * \n';
      headers += ' * This file was automatically generated from JavaScript/TypeScript code.\n';
      headers += ' * Manual modifications may be overwritten.\n';
      headers += ' * \n';
      headers += ` * @generated ${new Date().toISOString()}\n`;
      if (options.addPsalmAnnotations) {
        headers += ' * @psalm-api\n';
      }
      if (options.addPhpStanAnnotations) {
        headers += ' * @phpstan-api\n';
      }
      headers += ' */\n';
    }

    headers += '\n';

    return headers + code;
  }

  /**
   * Collect required dependencies - Enhanced for PHP ecosystem
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = new Set();

    // Check for crypto extensions
    if (options.useSodiumCrypto || this._usesSodium(ast)) {
      dependencies.add('ext-sodium');
    }

    if (this._usesOpenSSL(ast)) {
      dependencies.add('ext-openssl');
    }

    if (this._usesHash(ast)) {
      dependencies.add('ext-hash');
    }

    // Check for other common extensions
    if (this._usesJSON(ast)) {
      dependencies.add('ext-json');
    }

    if (this._usesMbstring(ast)) {
      dependencies.add('ext-mbstring');
    }

    if (this._usesCurl(ast)) {
      dependencies.add('ext-curl');
    }

    if (this._usesPDO(ast)) {
      dependencies.add('ext-pdo');
    }

    // Check for Composer packages
    if (this._usesSymfony(ast)) {
      dependencies.add('symfony/console');
    }

    if (this._usesGuzzle(ast)) {
      dependencies.add('guzzlehttp/guzzle');
    }

    if (this._usesMonolog(ast)) {
      dependencies.add('monolog/monolog');
    }

    // Add dependencies from imports
    for (const dep of this.dependencies) {
      dependencies.add(dep);
    }

    return Array.from(dependencies);
  }

  /**
   * Check for sodium usage
   * @private
   */
  _usesSodium(ast) {
    return this._hasFunction(ast, /sodium_/);
  }

  /**
   * Check for OpenSSL usage
   * @private
   */
  _usesOpenSSL(ast) {
    return this._hasFunction(ast, /openssl_/);
  }

  /**
   * Check for hash usage
   * @private
   */
  _usesHash(ast) {
    return this._hasFunction(ast, /hash(_|$)/);
  }

  /**
   * Check for JSON usage
   * @private
   */
  _usesJSON(ast) {
    return this._hasFunction(ast, /json_(encode|decode)/);
  }

  /**
   * Check for mbstring usage
   * @private
   */
  _usesMbstring(ast) {
    return this._hasFunction(ast, /mb_/);
  }

  /**
   * Check for cURL usage
   * @private
   */
  _usesCurl(ast) {
    return this._hasFunction(ast, /curl_/);
  }

  /**
   * Check for PDO usage
   * @private
   */
  _usesPDO(ast) {
    return this._hasClass(ast, /PDO/) || this._hasFunction(ast, /pdo/);
  }

  /**
   * Check for Symfony usage
   * @private
   */
  _usesSymfony(ast) {
    return this._hasClass(ast, /Symfony/);
  }

  /**
   * Check for Guzzle usage
   * @private
   */
  _usesGuzzle(ast) {
    return this._hasClass(ast, /GuzzleHttp/);
  }

  /**
   * Check for Monolog usage
   * @private
   */
  _usesMonolog(ast) {
    return this._hasClass(ast, /Monolog/);
  }

  /**
   * Check if AST contains function matching pattern
   * @private
   */
  _hasFunction(ast, pattern) {
    const functions = this._findInAST(ast, node =>
      (node.type === 'CallExpression' || node.type === 'Identifier') &&
      node.name && pattern.test(node.name)
    );
    return functions.length > 0;
  }

  /**
   * Check if AST contains class matching pattern
   * @private
   */
  _hasClass(ast, pattern) {
    const classes = this._findInAST(ast, node =>
      (node.type === 'ClassDeclaration' || node.type === 'NewExpression' || node.type === 'Identifier') &&
      node.name && pattern.test(node.name)
    );
    return classes.length > 0;
  }

  /**
   * Generate comprehensive warnings - Enhanced with security and best practices
   * @private
   */
  _generateWarnings(code, options) {
    const warnings = [];

    // Apply all warning rules
    for (const rule of this.warningRules) {
      const matches = code.match(rule.pattern);
      if (matches) {
        warnings.push({
          type: rule.name,
          severity: rule.severity,
          message: rule.message,
          occurrences: matches.length,
          rule: rule.name
        });
      }
    }

    // Additional contextual warnings
    if (options.enableOpCodesIntegration && !this._hasOpCodesUsage(code)) {
      if (this._hasCryptoOperations(code)) {
        warnings.push({
          type: 'crypto_optimization',
          severity: 'info',
          message: 'Consider using OpCodes for optimized cryptographic operations',
          rule: 'opcodes_suggestion'
        });
      }
    }

    if (options.useReadonlyProperties && this._hasPropertyWithoutReadonly(code)) {
      warnings.push({
        type: 'immutability',
        severity: 'info',
        message: 'Consider using readonly properties for immutable data (PHP 8.1+)',
        rule: 'readonly_suggestion'
      });
    }

    if (options.useEnums && this._hasConstants(code)) {
      warnings.push({
        type: 'modernization',
        severity: 'info',
        message: 'Consider using enums instead of class constants (PHP 8.1+)',
        rule: 'enum_suggestion'
      });
    }

    if (!options.strictTypes) {
      warnings.push({
        type: 'type_safety',
        severity: 'warning',
        message: 'Enable strict_types=1 for better type safety',
        rule: 'strict_types_suggestion'
      });
    }

    return warnings;
  }

  /**
   * Check for OpCodes usage
   * @private
   */
  _hasOpCodesUsage(code) {
    return Object.values(this.cryptoOperations).some(op =>
      typeof op === 'string' && code.includes(op)
    );
  }

  /**
   * Check for crypto operations
   * @private
   */
  _hasCryptoOperations(code) {
    const cryptoPatterns = [
      /\b(encrypt|decrypt|hash|sign|verify)\b/i,
      /\b(aes|des|rsa|ecdsa|sha|md5)\b/i,
      /\b(cipher|crypto|key|iv|nonce)\b/i,
      /<<|>>|\^|&|\|/,
      /\brot(ate)?(left|right)\b/i
    ];

    return cryptoPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Check for properties without readonly
   * @private
   */
  _hasPropertyWithoutReadonly(code) {
    return /private\s+\$\w+\s*=/.test(code) && !/readonly\s+private/.test(code);
  }

  /**
   * Check for constants that could be enums
   * @private
   */
  _hasConstants(code) {
    return /const\s+[A-Z_]+\s*=/.test(code);
  }

  /**
   * Check if AST contains array operations
   * @private
   */
  _hasArrayOperations(ast) {
    const arrayOps = this._findInAST(ast, node =>
      node.type === 'ArrayExpression' ||
      node.type === 'MemberExpression' ||
      (node.type === 'CallExpression' &&
       node.callee &&
       ['push', 'pop', 'shift', 'unshift', 'splice', 'slice'].includes(node.callee.property?.name))
    );
    return arrayOps.length > 0;
  }

  // ================ COMPREHENSIVE AST NODE GENERATORS ================
  // The following methods implement all 75+ AST node types with PHP 8+ features

  /**
   * Generate interface declaration
   * @private
   */
  _generateInterface(node, options) {
    const interfaceName = node.id ? node.id.name : 'UnnamedInterface';
    this.interfaces.add(interfaceName);
    let code = '';

    // DocBlock
    if (options.addDocBlocks) {
      code += this._generateDocBlock(node, 'interface', options);
    }

    // Interface declaration
    code += this._indent(`interface ${interfaceName}`);

    // Extends interfaces
    if (node.extends && node.extends.length > 0) {
      const extended = node.extends.map(ext => this._generateNode(ext, options));
      code += ` extends ${extended.join(', ')}`;
    }

    code += '\n' + this._indent('{\n');
    this.indentLevel++;

    // Interface methods (only signatures)
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateInterfaceMethod(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate interface method signature
   * @private
   */
  _generateInterfaceMethod(node, options) {
    if (!node.key) return '';

    const methodName = node.key.name || node.key;
    let code = '';

    // DocBlock
    if (options.addDocBlocks) {
      code += this._generateMethodDocBlock(node, options);
    }

    // Method signature only (no body for interfaces)
    const visibility = this._getMethodVisibility(node, options);
    code += this._indent(`${visibility}function ${methodName}(`);

    // Parameters
    if (node.value && node.value.params && node.value.params.length > 0) {
      const params = this._generateParameters(node.value.params, options);
      code += params;
    }

    // Return type
    if (options.addReturnTypes) {
      const returnType = this._inferPHPReturnType(methodName, node.value);
      if (returnType) {
        code += `): ${returnType}`;
      } else {
        code += ')';
      }
    } else {
      code += ')';
    }

    code += ';\n';
    return code;
  }

  /**
   * Generate trait declaration
   * @private
   */
  _generateTrait(node, options) {
    const traitName = node.id ? node.id.name : 'UnnamedTrait';
    this.traits.add(traitName);
    let code = '';

    // DocBlock
    if (options.addDocBlocks) {
      code += this._generateDocBlock(node, 'trait', options);
    }

    // Trait declaration
    code += this._indent(`trait ${traitName}\n`);
    code += this._indent('{\n');
    this.indentLevel++;

    // Trait body
    if (node.body && node.body.length > 0) {
      const members = node.body
        .map(member => this._generateNode(member, options))
        .filter(m => m.trim());
      code += members.join('\n\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate enum declaration (PHP 8.1+)
   * @private
   */
  _generateEnum(node, options) {
    if (!options.useEnums) {
      // Fall back to class with constants
      return this._generateEnumAsClass(node, options);
    }

    const enumName = node.id ? node.id.name : 'UnnamedEnum';
    let code = '';

    // DocBlock
    if (options.addDocBlocks) {
      code += this._generateDocBlock(node, 'enum', options);
    }

    // Enum declaration
    const backingType = node.backingType ? `: ${node.backingType}` : '';
    code += this._indent(`enum ${enumName}${backingType}\n`);
    code += this._indent('{\n');
    this.indentLevel++;

    // Enum cases
    if (node.body && node.body.length > 0) {
      const cases = node.body
        .filter(member => member.type === 'EnumCase')
        .map(enumCase => this._generateEnumCase(enumCase, options));
      code += cases.join('\n');

      // Enum methods
      const methods = node.body
        .filter(member => member.type !== 'EnumCase')
        .map(member => this._generateNode(member, options))
        .filter(m => m.trim());
      if (methods.length > 0) {
        code += '\n\n' + methods.join('\n\n');
      }
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate enum as class (fallback)
   * @private
   */
  _generateEnumAsClass(node, options) {
    const enumName = node.id ? node.id.name : 'UnnamedEnum';
    let code = '';

    // DocBlock
    if (options.addDocBlocks) {
      code += this._generateDocBlock(node, 'class', options);
    }

    code += this._indent(`final class ${enumName}\n`);
    code += this._indent('{\n');
    this.indentLevel++;

    // Generate constants for enum cases
    if (node.body && node.body.length > 0) {
      const cases = node.body
        .filter(member => member.type === 'EnumCase')
        .map(enumCase => this._generateEnumCaseAsConstant(enumCase, options));
      code += cases.join('\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate enum case
   * @private
   */
  _generateEnumCase(node, options) {
    const caseName = node.id ? node.id.name : 'UNNAMED';
    const value = node.value ? ` = ${this._generateNode(node.value, options)}` : '';
    return this._indent(`case ${caseName}${value};\n`);
  }

  /**
   * Generate enum case as constant
   * @private
   */
  _generateEnumCaseAsConstant(node, options) {
    const caseName = node.id ? node.id.name : 'UNNAMED';
    const value = node.value ? this._generateNode(node.value, options) : `'${caseName}'`;
    return this._indent(`public const ${caseName} = ${value};\n`);
  }

  /**
   * Generate property definition
   * @private
   */
  _generateProperty(node, options) {
    if (!node.key) return '';

    const propertyName = node.key.name || node.key;
    let code = '';

    // DocBlock
    if (options.addDocBlocks) {
      code += this._generatePropertyDocBlock(node, options);
    }

    // Property declaration
    const visibility = this._getVisibility(node, 'private');
    const modifiers = this._getPropertyModifiers(node, options);
    const typeHint = options.addPropertyTypes ? this._getPropertyTypeHint(node, options) : '';

    code += this._indent(`${visibility}${modifiers}${typeHint}$${propertyName}`);

    // Default value
    if (node.value) {
      const defaultValue = this._generateNode(node.value, options);
      code += ` = ${defaultValue}`;
    }

    code += ';\n';
    return code;
  }

  /**
   * Get property modifiers
   * @private
   */
  _getPropertyModifiers(node, options) {
    const modifiers = [];
    if (node.static) modifiers.push('static');
    if (node.readonly && options.useReadonlyProperties) modifiers.push('readonly');
    return modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
  }

  /**
   * Get property type hint
   * @private
   */
  _getPropertyTypeHint(node, options) {
    if (!options.addPropertyTypes) return '';

    // Try to infer from property name or value
    const propertyName = node.key?.name || '';
    const inferredType = this._inferParameterType(propertyName);

    if (inferredType && inferredType !== 'mixed') {
      const typeHint = this._convertDocTypeToTypeHint(inferredType, options);
      return typeHint ? `${typeHint} ` : '';
    }

    return '';
  }

  /**
   * Convert docblock type to PHP type hint
   * @private
   */
  _convertDocTypeToTypeHint(docType, options) {
    if (!docType) return '';

    const typeMap = {
      'string': 'string',
      'int': 'int',
      'integer': 'int',
      'float': 'float',
      'double': 'float',
      'bool': 'bool',
      'boolean': 'bool',
      'array': 'array',
      'object': 'object',
      'callable': 'callable',
      'iterable': 'iterable',
      'mixed': options.useUnionTypes ? 'mixed' : ''
    };

    // Handle union types
    if (docType.includes('|')) {
      const types = docType.split('|').map(t => t.trim());
      const mappedTypes = types.map(t => typeMap[t] || '').filter(t => t);

      if (mappedTypes.length === 0) return '';
      if (mappedTypes.length === 1) return mappedTypes[0];

      return options.useUnionTypes ? mappedTypes.join('|') : mappedTypes[0];
    }

    return typeMap[docType] || '';
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    let code = 'function(';

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = this._generateParameters(node.params, options);
      code += params;
    }

    code += ')';

    // Use variables (PHP closure)
    if (node.useVariables && node.useVariables.length > 0) {
      const useVars = node.useVariables.map(v => '$' + v.name).join(', ');
      code += ` use (${useVars})`;
    }

    // Function body
    code += ' {\n';
    this.indentLevel++;

    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode;
    }

    this.indentLevel--;
    code += this._indent('}');

    return code;
  }

  /**
   * Generate arrow function (PHP 7.4+)
   * @private
   */
  _generateArrowFunction(node, options) {
    if (!options.useArrowFunctions) {
      return this._generateFunctionExpression(node, options);
    }

    let code = 'fn(';

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = this._generateParameters(node.params, options);
      code += params;
    }

    code += ') => ';

    // Arrow function body (single expression)
    if (node.body) {
      if (node.body.type === 'BlockStatement') {
        // If it's a block, try to extract single return statement
        if (node.body.body && node.body.body.length === 1 &&
            node.body.body[0].type === 'ReturnStatement') {
          const returnExpr = this._generateNode(node.body.body[0].argument, options);
          code += returnExpr;
        } else {
          // Fall back to regular function
          return this._generateFunctionExpression(node, options);
        }
      } else {
        const bodyCode = this._generateNode(node.body, options);
        code += bodyCode;
      }
    }

    return code;
  }

  /**
   * Generate control flow statements
   */

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    let code = '';

    // Test condition
    const test = this._generateNode(node.test, options);
    code += this._indent(`if (${test}) {\n`);

    // Consequent
    this.indentLevel++;
    if (node.consequent) {
      const consequent = this._generateNode(node.consequent, options);
      code += consequent;
    }
    this.indentLevel--;

    code += this._indent('}');

    // Alternate (else/elseif)
    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        // elseif
        const elseif = this._generateIfStatement(node.alternate, options);
        code += ' else' + elseif.substring(elseif.indexOf('if'));
      } else {
        // else
        code += ' else {\n';
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate;
        this.indentLevel--;
        code += this._indent('}');
      }
    }

    code += '\n';
    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`while (${test}) {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate do-while statement
   * @private
   */
  _generateDoWhileStatement(node, options) {
    let code = this._indent('do {\n');

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    const test = this._generateNode(node.test, options);
    code += this._indent(`} while (${test});\n`);
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    let code = this._indent('for (');

    // Init
    if (node.init) {
      const init = this._generateNode(node.init, options);
      code += init.replace(/;\n$/, ''); // Remove trailing semicolon and newline
    }
    code += '; ';

    // Test
    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += test;
    }
    code += '; ';

    // Update
    if (node.update) {
      const update = this._generateNode(node.update, options);
      code += update;
    }

    code += ') {\n';

    // Body
    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-in statement (foreach)
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    // Remove variable declaration wrapper if present
    const variable = left.includes('$') ? left.replace(/\$(\w+)\s*=.*$/, '$$$1') : left;

    let code = this._indent(`foreach (${right} as ${variable}) {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-of statement (foreach with key-value)
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    // For arrays, use key => value syntax
    const variable = left.includes('$') ? left.replace(/\$(\w+)\s*=.*$/, '$key => $$$1') : '$key => ' + left;

    let code = this._indent(`foreach (${right} as ${variable}) {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    const levels = node.label ? ` ${node.label.name}` : '';
    return this._indent(`break${levels};\n`);
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    const levels = node.label ? ` ${node.label.name}` : '';
    return this._indent(`continue${levels};\n`);
  }

  /**
   * Generate throw statement
   * @private
   */
  _generateThrowStatement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return this._indent(`throw ${argument};\n`);
  }

  /**
   * Generate try-catch statement
   * @private
   */
  _generateTryStatement(node, options) {
    let code = this._indent('try {\n');

    // Try block
    this.indentLevel++;
    if (node.block) {
      const tryBlock = this._generateNode(node.block, options);
      code += tryBlock;
    }
    this.indentLevel--;

    code += this._indent('}');

    // Catch handlers
    if (node.handlers && node.handlers.length > 0) {
      for (const handler of node.handlers) {
        const catchCode = this._generateCatchClause(handler, options);
        code += catchCode;
      }
    }

    // Finally block
    if (node.finalizer) {
      code += ' finally {\n';
      this.indentLevel++;
      const finallyBlock = this._generateNode(node.finalizer, options);
      code += finallyBlock;
      this.indentLevel--;
      code += this._indent('}');
    }

    code += '\n';
    return code;
  }

  /**
   * Generate catch clause
   * @private
   */
  _generateCatchClause(node, options) {
    let code = ' catch (';

    // Exception type
    if (node.param && node.param.typeAnnotation) {
      const exceptionType = this._generateNode(node.param.typeAnnotation, options);
      code += exceptionType;
    } else {
      code += '\\Exception'; // Default exception type
    }

    // Exception variable
    if (node.param) {
      const paramName = node.param.name || 'e';
      code += ` $${paramName}`;
    } else {
      code += ' $e';
    }

    code += ') {\n';

    // Catch body
    this.indentLevel++;
    if (node.body) {
      const catchBody = this._generateNode(node.body, options);
      code += catchBody;
    }
    this.indentLevel--;

    code += this._indent('}');
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);

    // Use match expression if enabled (PHP 8+)
    if (options.useMatchExpressions && this._canUseMatchExpression(node)) {
      return this._generateMatchExpression(node, options);
    }

    let code = this._indent(`switch (${discriminant}) {\n`);

    this.indentLevel++;
    if (node.cases && node.cases.length > 0) {
      for (const switchCase of node.cases) {
        const caseCode = this._generateSwitchCase(switchCase, options);
        code += caseCode;
      }
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate switch case
   * @private
   */
  _generateSwitchCase(node, options) {
    let code = '';

    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += this._indent(`case ${test}:\n`);
    } else {
      code += this._indent('default:\n');
    }

    // Case body
    this.indentLevel++;
    if (node.consequent && node.consequent.length > 0) {
      for (const stmt of node.consequent) {
        const stmtCode = this._generateNode(stmt, options);
        code += stmtCode;
      }
    }
    this.indentLevel--;

    return code;
  }

  /**
   * Check if switch can use match expression
   * @private
   */
  _canUseMatchExpression(node) {
    // Match expressions work best with simple cases that return values
    return node.cases.every(switchCase =>
      switchCase.consequent.length === 1 &&
      switchCase.consequent[0].type === 'ReturnStatement'
    );
  }

  /**
   * Generate match expression (PHP 8+)
   * @private
   */
  _generateMatchExpression(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);
    let code = this._indent(`$result = match (${discriminant}) {\n`);

    this.indentLevel++;
    const cases = node.cases.map(switchCase => {
      if (switchCase.test) {
        const test = this._generateNode(switchCase.test, options);
        const value = switchCase.consequent[0] ?
          this._generateNode(switchCase.consequent[0].argument, options) : 'null';
        return this._indent(`${test} => ${value},\n`);
      } else {
        const value = switchCase.consequent[0] ?
          this._generateNode(switchCase.consequent[0].argument, options) : 'null';
        return this._indent(`default => ${value},\n`);
      }
    });
    code += cases.join('');
    this.indentLevel--;

    code += this._indent('};\n');
    return code;
  }

  /**
   * Generate expressions
   */

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const operator = this._mapOperator(node.operator);
    const argument = this._generateNode(node.argument, options);

    if (node.prefix) {
      return `${operator}${argument}`;
    } else {
      return `${argument}${operator}`;
    }
  }

  /**
   * Generate update expression (++/--)
   * @private
   */
  _generateUpdateExpression(node, options) {
    const operator = node.operator;
    const argument = this._generateNode(node.argument, options);

    if (node.prefix) {
      return `${operator}${argument}`;
    } else {
      return `${argument}${operator}`;
    }
  }

  /**
   * Generate logical expression
   * @private
   */
  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate conditional (ternary) expression
   * @private
   */
  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `${test} ? ${consequent} : ${alternate}`;
  }

  /**
   * Generate sequence expression
   * @private
   */
  _generateSequenceExpression(node, options) {
    if (!node.expressions || node.expressions.length === 0) {
      return '';
    }

    // In PHP, we'll use a closure to simulate sequence expressions
    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return `(function() { ${expressions.slice(0, -1).map(e => e + ';').join(' ')} return ${expressions[expressions.length - 1]}; })()`;
  }

  /**
   * Generate new expression
   * @private
   */
  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = this._generateArguments(node.arguments || [], options);

    return `new ${callee}(${args})`;
  }

  /**
   * Generate meta property
   * @private
   */
  _generateMetaProperty(node, options) {
    if (node.meta && node.property) {
      const meta = node.meta.name;
      const property = node.property.name;

      // Map common meta properties
      if (meta === 'new' && property === 'target') {
        return 'static::class'; // PHP equivalent
      }
    }

    return 'null'; // Fallback
  }

  // ================ ARRAY AND OBJECT EXPRESSIONS ================

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '[]';
    }

    const isMultiline = node.properties.length > 3 ||
                       node.properties.some(prop => prop.value?.type === 'ObjectExpression');

    if (isMultiline) {
      let code = '[\n';
      this.indentLevel++;

      const properties = node.properties.map(prop => this._generateObjectProperty(prop, options));
      code += properties.join(',\n');

      this.indentLevel--;
      code += '\n' + this._indent(']');
      return code;
    } else {
      const properties = node.properties.map(prop => this._generateObjectProperty(prop, options));
      return `[${properties.join(', ')}]`;
    }
  }

  /**
   * Generate object property
   * @private
   */
  _generateObjectProperty(node, options) {
    const key = this._generateObjectKey(node.key, node.computed, options);
    const value = this._generateNode(node.value, options);

    return this._indent(`${key} => ${value}`);
  }

  /**
   * Generate object key
   * @private
   */
  _generateObjectKey(key, computed, options) {
    if (computed) {
      return this._generateNode(key, options);
    }

    if (key.type === 'Identifier') {
      return `'${key.name}'`;
    }

    return this._generateNode(key, options);
  }

  /**
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const isMultiline = node.elements.length > 5 ||
                       node.elements.some(el => el?.type === 'ArrayExpression' || el?.type === 'ObjectExpression');

    if (isMultiline) {
      let code = '[\n';
      this.indentLevel++;

      const elements = node.elements.map((element, index) => {
        if (element === null) {
          return this._indent('null');
        }
        return this._indent(this._generateNode(element, options));
      });

      code += elements.join(',\n');

      this.indentLevel--;
      code += '\n' + this._indent(']');
      return code;
    } else {
      const elements = node.elements.map(element => {
        if (element === null) return 'null';
        return this._generateNode(element, options);
      });
      return `[${elements.join(', ')}]`;
    }
  }

  /**
   * Generate spread element
   * @private
   */
  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `...$${argument}`; // PHP 5.6+ unpacking
  }

  /**
   * Generate rest element
   * @private
   */
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `...$${argument}`;
  }

  // ================ TEMPLATE AND TAGGED EXPRESSIONS ================

  /**
   * Generate template literal
   * @private
   */
  _generateTemplateLiteral(node, options) {
    if (!node.quasis || node.quasis.length === 0) {
      return "''";
    }

    // Convert template literal to string concatenation
    let code = '';
    const parts = [];

    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      const expression = node.expressions[i];

      // Add the text part
      if (quasi.value.cooked) {
        parts.push(`'${this._escapeString(quasi.value.cooked)}'`);
      }

      // Add the expression part
      if (expression) {
        parts.push(this._generateNode(expression, options));
      }
    }

    return parts.join(' . ');
  }

  /**
   * Generate template element
   * @private
   */
  _generateTemplateElement(node, options) {
    return `'${this._escapeString(node.value.cooked || node.value.raw)}'`;
  }

  /**
   * Generate tagged template expression
   * @private
   */
  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const template = this._generateTemplateLiteral(node.quasi, options);

    // Convert to function call
    return `${tag}(${template})`;
  }

  // ================ LITERAL EXPRESSIONS ================

  /**
   * Generate regex literal
   * @private
   */
  _generateRegExpLiteral(node, options) {
    const pattern = node.pattern || '';
    const flags = node.flags || '';

    // Convert to PHP preg pattern
    const delimiter = '/';
    const escapedPattern = pattern.replace(/\//g, '\\/');
    return `'${delimiter}${escapedPattern}${delimiter}${flags}'`;
  }

  /**
   * Generate boolean literal
   * @private
   */
  _generateBooleanLiteral(node, options) {
    return node.value ? 'true' : 'false';
  }

  /**
   * Generate numeric literal
   * @private
   */
  _generateNumericLiteral(node, options) {
    return this._generateLiteral(node, options);
  }

  /**
   * Generate string literal
   * @private
   */
  _generateStringLiteral(node, options) {
    return this._generateLiteral(node, options);
  }

  // ================ MODERN JAVASCRIPT FEATURES ================

  /**
   * Generate class expression
   * @private
   */
  _generateClassExpression(node, options) {
    // Anonymous class in PHP
    const className = node.id ? node.id.name : null;

    let code = 'new class';

    // Constructor parameters for anonymous class
    if (node.constructorParams) {
      const params = this._generateParameters(node.constructorParams, options);
      code += `(${params})`;
    }

    // Inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += ` extends ${superName}`;
    }

    // Interfaces
    if (node.implements && node.implements.length > 0) {
      const interfaces = node.implements.map(iface => this._generateNode(iface, options));
      code += ` implements ${interfaces.join(', ')}`;
    }

    code += ' {\n';
    this.indentLevel++;

    // Class body
    if (node.body && node.body.length > 0) {
      const members = node.body
        .map(member => this._generateNode(member, options))
        .filter(m => m.trim());
      code += members.join('\n\n');
    }

    this.indentLevel--;
    code += this._indent('}');

    return code;
  }

  /**
   * Generate yield expression
   * @private
   */
  _generateYieldExpression(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return node.delegate ? `yield from ${argument}` : `yield ${argument}`;
    } else {
      return 'yield';
    }
  }

  /**
   * Generate await expression
   * @private
   */
  _generateAwaitExpression(node, options) {
    const argument = this._generateNode(node.argument, options);

    // PHP doesn't have native async/await, use comment or custom implementation
    if (options.useFibers) {
      return `Fiber::suspend(${argument})`;
    } else {
      return `/* await */ ${argument}`;
    }
  }

  // ================ IMPORT/EXPORT DECLARATIONS ================

  /**
   * Generate import declaration
   * @private
   */
  _generateImportDeclaration(node, options) {
    const source = this._generateNode(node.source, options);
    const sourcePath = source.replace(/['"]/g, '');

    // Convert to require_once
    let code = '';

    if (node.specifiers && node.specifiers.length > 0) {
      // Named imports
      const specifiers = node.specifiers.map(spec => this._generateImportSpecifier(spec, options));

      if (node.specifiers.some(spec => spec.type === 'ImportDefaultSpecifier')) {
        code += this._indent(`$default = require_once '${sourcePath}';\n`);
      }

      // Named imports as array destructuring
      const namedImports = node.specifiers.filter(spec => spec.type === 'ImportSpecifier');
      if (namedImports.length > 0) {
        const names = namedImports.map(spec => spec.local.name);
        code += this._indent(`extract(require_once '${sourcePath}'); // ${names.join(', ')}\n`);
      }
    } else {
      // Simple require
      code += this._indent(`require_once '${sourcePath}';\n`);
    }

    this.imports.add(sourcePath);
    return code;
  }

  /**
   * Generate import specifier
   * @private
   */
  _generateImportSpecifier(node, options) {
    const imported = node.imported ? node.imported.name : 'default';
    const local = node.local ? node.local.name : imported;
    return { imported, local };
  }

  /**
   * Generate export declaration
   * @private
   */
  _generateExportDeclaration(node, options) {
    // PHP doesn't have native exports, use return statement or global assignment
    return this._generateNode(node.declaration, options);
  }

  /**
   * Generate export named declaration
   * @private
   */
  _generateExportNamedDeclaration(node, options) {
    let code = '';

    if (node.declaration) {
      code += this._generateNode(node.declaration, options);
    }

    if (node.specifiers && node.specifiers.length > 0) {
      // Export specifiers as return array
      const exports = node.specifiers.map(spec => {
        const local = spec.local.name;
        const exported = spec.exported.name;
        return `'${exported}' => $${local}`;
      });

      code += this._indent(`return [\n`);
      this.indentLevel++;
      code += exports.map(exp => this._indent(exp)).join(',\n');
      this.indentLevel--;
      code += '\n' + this._indent('];\n');
    }

    return code;
  }

  /**
   * Generate export default declaration
   * @private
   */
  _generateExportDefaultDeclaration(node, options) {
    const declaration = this._generateNode(node.declaration, options);
    return this._indent(`return ${declaration};\n`);
  }

  /**
   * Generate export all declaration
   * @private
   */
  _generateExportAllDeclaration(node, options) {
    const source = this._generateNode(node.source, options);
    const sourcePath = source.replace(/['"]/g, '');

    return this._indent(`return require_once '${sourcePath}';\n`);
  }

  /**
   * Generate export specifier
   * @private
   */
  _generateExportSpecifier(node, options) {
    const local = node.local.name;
    const exported = node.exported.name;
    return { local, exported };
  }

  // ================ PATTERN MATCHING ================

  /**
   * Generate object pattern
   * @private
   */
  _generateObjectPattern(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '[]';
    }

    // PHP array destructuring
    const properties = node.properties.map(prop => {
      if (prop.type === 'Property') {
        const key = this._generateObjectKey(prop.key, prop.computed, options);
        const value = prop.value.name || 'value';
        return `${key} => $${value}`;
      }
      return this._generateNode(prop, options);
    });

    return `[${properties.join(', ')}]`;
  }

  /**
   * Generate array pattern
   * @private
   */
  _generateArrayPattern(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const elements = node.elements.map((element, index) => {
      if (element === null) {
        return ''; // Skip element
      }

      if (element.type === 'Identifier') {
        return `$${element.name}`;
      }

      return this._generateNode(element, options);
    });

    return `[${elements.join(', ')}]`;
  }

  /**
   * Generate assignment pattern
   * @private
   */
  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    return `${left} = ${right}`;
  }

  // ================ PHP-SPECIFIC CONSTRUCTS ================

  /**
   * Generate global statement
   * @private
   */
  _generateGlobalStatement(node, options) {
    if (!node.declarations || node.declarations.length === 0) {
      return '';
    }

    const variables = node.declarations.map(decl => '$' + decl.id.name);
    return this._indent(`global ${variables.join(', ')};\n`);
  }

  /**
   * Generate static statement
   * @private
   */
  _generateStaticStatement(node, options) {
    if (!node.declarations || node.declarations.length === 0) {
      return '';
    }

    const declarations = node.declarations.map(decl => {
      const name = '$' + decl.id.name;
      const init = decl.init ? ' = ' + this._generateNode(decl.init, options) : '';
      return name + init;
    });

    return this._indent(`static ${declarations.join(', ')};\n`);
  }

  /**
   * Generate echo statement
   * @private
   */
  _generateEchoStatement(node, options) {
    if (!node.arguments || node.arguments.length === 0) {
      return this._indent('echo;\n');
    }

    const args = node.arguments.map(arg => this._generateNode(arg, options));
    return this._indent(`echo ${args.join(', ')};\n`);
  }

  /**
   * Generate include expression
   * @private
   */
  _generateIncludeExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const type = node.once ? 'include_once' : 'include';
    return `${type} ${argument}`;
  }

  /**
   * Generate require expression
   * @private
   */
  _generateRequireExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const type = node.once ? 'require_once' : 'require';
    return `${type} ${argument}`;
  }

  /**
   * Generate isset expression
   * @private
   */
  _generateIssetExpression(node, options) {
    if (!node.arguments || node.arguments.length === 0) {
      return 'isset()';
    }

    const args = node.arguments.map(arg => this._generateNode(arg, options));
    return `isset(${args.join(', ')})`;
  }

  /**
   * Generate empty expression
   * @private
   */
  _generateEmptyExpression(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : '';
    return `empty(${argument})`;
  }

  /**
   * Generate unset statement
   * @private
   */
  _generateUnsetStatement(node, options) {
    if (!node.arguments || node.arguments.length === 0) {
      return this._indent('unset();\n');
    }

    const args = node.arguments.map(arg => this._generateNode(arg, options));
    return this._indent(`unset(${args.join(', ')});\n`);
  }

  /**
   * Generate list expression
   * @private
   */
  _generateListExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return 'list()';
    }

    const elements = node.elements.map(element => {
      if (element === null) return '';
      return this._generateNode(element, options);
    });

    return `list(${elements.join(', ')})`;
  }

  /**
   * Generate eval expression
   * @private
   */
  _generateEvalExpression(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : "''";

    // Add warning comment
    if (options.addSecurityComments) {
      return `/* WARNING: eval() is dangerous */ eval(${argument})`;
    }

    return `eval(${argument})`;
  }

  /**
   * Generate exit statement
   * @private
   */
  _generateExitStatement(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return this._indent(`exit(${argument});\n`);
    } else {
      return this._indent('exit;\n');
    }
  }

  /**
   * Generate clone expression
   * @private
   */
  _generateCloneExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `clone ${argument}`;
  }

  /**
   * Generate instanceof expression
   * @private
   */
  _generateInstanceofExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} instanceof ${right}`;
  }

  // ================ DOCBLOCK GENERATORS ================

  /**
   * Generate comprehensive docblock
   * @private
   */
  _generateDocBlock(node, type, options) {
    let code = this._indent('/**\n');

    // Main description
    const name = node.id?.name || `Unnamed${type.charAt(0).toUpperCase() + type.slice(1)}`;
    code += this._indent(` * ${name} ${type}\n`);
    code += this._indent(' *\n');

    // Add type-specific documentation
    switch (type) {
      case 'class':
        code += this._generateClassDocBlock(node, options);
        break;
      case 'interface':
        code += this._indent(' * Interface definition\n');
        break;
      case 'trait':
        code += this._indent(' * Trait for shared functionality\n');
        break;
      case 'enum':
        code += this._indent(' * Enumeration of constant values\n');
        break;
      case 'function':
        // Parameters and return will be added by specific generators
        break;
    }

    // Add Psalm/PHPStan annotations
    if (options.addPsalmAnnotations) {
      code += this._indent(' * @psalm-api\n');
    }

    if (options.addPhpStanAnnotations) {
      code += this._indent(' * @phpstan-api\n');
    }

    code += this._indent(' */\n');
    return code;
  }

  /**
   * Generate class-specific docblock content
   * @private
   */
  _generateClassDocBlock(node, options) {
    let code = '';

    // Add class description
    if (node.superClass) {
      const superName = node.superClass.name || 'Parent';
      code += this._indent(` * Extends ${superName}\n`);
    }

    if (node.implements && node.implements.length > 0) {
      const interfaces = node.implements.map(iface => iface.name || 'Interface');
      code += this._indent(` * Implements ${interfaces.join(', ')}\n`);
    }

    code += this._indent(' *\n');
    return code;
  }

  /**
   * Generate method docblock
   * @private
   */
  _generateMethodDocBlock(node, options) {
    const methodName = node.key?.name || 'method';
    const isConstructor = methodName === 'constructor' || methodName === '__construct';

    let code = this._indent('/**\n');
    code += this._indent(` * ${isConstructor ? 'Constructor' : methodName + ' method'}\n`);
    code += this._indent(' *\n');

    // Parameters
    if (node.value?.params && node.value.params.length > 0) {
      for (const param of node.value.params) {
        const paramName = param.name || param.id?.name || 'param';
        const paramType = this._inferParameterType(paramName);
        code += this._indent(` * @param ${paramType} $${paramName}\n`);
      }
    }

    // Return type
    if (!isConstructor) {
      const returnType = this._inferReturnType(methodName);
      code += this._indent(` * @return ${returnType}\n`);
    }

    code += this._indent(' */\n');
    return code;
  }

  /**
   * Generate property docblock
   * @private
   */
  _generatePropertyDocBlock(node, options) {
    const propertyName = node.key?.name || 'property';
    const propertyType = this._inferParameterType(propertyName);

    let code = this._indent('/**\n');
    code += this._indent(` * ${propertyName} property\n`);
    code += this._indent(' *\n');
    code += this._indent(` * @var ${propertyType}\n`);
    code += this._indent(' */\n');

    return code;
  }

  /**
   * Generate attributes (PHP 8+)
   * @private
   */
  _generateAttributes(attributes, options) {
    if (!attributes || attributes.length === 0) {
      return '';
    }

    let code = '';
    for (const attr of attributes) {
      code += this._generateAttribute(attr, options);
    }

    return code;
  }

  /**
   * Generate single attribute
   * @private
   */
  _generateAttribute(node, options) {
    const name = node.name || 'Attribute';
    const args = node.arguments ? this._generateArguments(node.arguments, options) : '';

    return this._indent(`#[${name}${args ? `(${args})` : ''}]\n`);
  }

  /**
   * Generate inline attributes for parameters
   * @private
   */
  _generateInlineAttributes(attributes) {
    if (!attributes || attributes.length === 0) {
      return '';
    }

    const attrs = attributes.map(attr => {
      const name = attr.name || 'Attribute';
      const args = attr.arguments ? '(' + attr.arguments.map(arg => arg.value || arg.name).join(', ') + ')' : '';
      return `#[${name}${args}]`;
    });

    return attrs.join(' ') + ' ';
  }

  /**
   * Check if PHP is available on the system
   * @private
   */
  _isPHPAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('php --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate PHP code syntax using native interpreter
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if PHP is available first
    const phpAvailable = this._isPHPAvailable();
    if (!phpAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'PHP not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_php_${Date.now()}.php`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Check PHP syntax using -l (lint) flag
        execSync(`php -l "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'php',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'php',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If PHP is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'PHP not available - using basic validation'
      };
    }
  }

  /**
   * Get PHP interpreter download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'PHP',
      downloadUrl: 'https://www.php.net/downloads',
      installInstructions: [
        'Download PHP from https://www.php.net/downloads',
        'For Windows: Download from https://windows.php.net/download/',
        'For Ubuntu/Debian: sudo apt install php-cli',
        'For macOS: brew install php',
        'Add PHP to your system PATH',
        'Verify installation with: php --version'
      ].join('\n'),
      verifyCommand: 'php --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'composer',
      documentation: 'https://www.php.net/manual/'
    };
  }
}

// Register the plugin
const phpPlugin = new PHPPlugin();
LanguagePlugins.Add(phpPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = phpPlugin;
}


})(); // End of IIFE