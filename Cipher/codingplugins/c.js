/**
 * C Language Plugin for Multi-Language Code Generation
 * Generates C code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
}

/**
 * C Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class CPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'C';
    this.extension = 'c';
    this.icon = '🔧';
    this.description = 'C language code generator';
    this.mimeType = 'text/x-c';
    this.version = 'C99/C11';
    
    // C-specific options with enhanced crypto support
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      standard: 'c11', // c89, c99, c11, c17, c23
      addHeaders: true,
      useInlineAssembly: false,
      useCryptoLibs: true,
      useOpenSSL: true,
      useSodium: false,
      useStaticAssert: true, // C11 feature
      useGenericSelections: true, // C11 feature
      useAlignof: true, // C11 feature
      useThreadLocal: true, // C11 feature
      useAtomics: true, // C11 feature
      useBitOperations: true, // Enhanced crypto bit ops
      addDocstrings: true,
      strictTypes: false,
      useConstCorrectness: true,
      addSafetyChecks: true,
      memoryManagement: 'manual' // manual, gc, pool
    };

    // Enhanced C type mappings for cryptographic algorithms
    this.typeMap = {
      'byte': 'uint8_t',
      'word': 'uint16_t',
      'dword': 'uint32_t',
      'qword': 'uint64_t',
      'uint': 'unsigned int',
      'uint8': 'uint8_t',
      'uint16': 'uint16_t',
      'uint32': 'uint32_t',
      'uint64': 'uint64_t',
      'int8': 'int8_t',
      'int16': 'int16_t',
      'int32': 'int32_t',
      'int64': 'int64_t',
      'byte[]': 'uint8_t*',
      'word[]': 'uint16_t*',
      'dword[]': 'uint32_t*',
      'qword[]': 'uint64_t*',
      'uint[]': 'unsigned int*',
      'int[]': 'int*',
      'string': 'char*',
      'boolean': 'bool',
      'object': 'void*',
      'void': 'void',
      'size_t': 'size_t',
      'ptrdiff_t': 'ptrdiff_t'
    };

    // Cryptographic context for better type inference
    this.cryptoTypeMap = {
      'key': 'const uint8_t*',
      'nonce': 'const uint8_t*',
      'iv': 'const uint8_t*',
      'data': 'uint8_t*',
      'input': 'const uint8_t*',
      'output': 'uint8_t*',
      'buffer': 'uint8_t*',
      'state': 'uint32_t*',
      'word': 'uint32_t',
      'round': 'int',
      'size': 'size_t',
      'length': 'size_t',
      'count': 'size_t',
      'index': 'size_t',
      'keysize': 'size_t',
      'blocksize': 'size_t',
      'rounds': 'int'
    };
    
    // Internal state
    this.indentLevel = 0;
    this.includes = new Set();
    this.prototypes = [];
    this.structures = [];
    this.constants = [];
    this.globalVariables = [];
    this.usedFeatures = new Set();
  }

  /**
   * Generate C code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.includes.clear();
      this.prototypes = [];
      this.structures = [];
      this.constants = [];
      this.globalVariables = [];
      this.usedFeatures.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate C code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add headers, prototypes, and program structure
      const finalCode = this._wrapWithProgramStructure(code, mergedOptions);
      
      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);
      
      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);
      
      return this.CreateSuccessResult(finalCode, dependencies, warnings);
      
    } catch (error) {
      return this.CreateErrorResult('Code generation failed: ' + error.message);
    }
  }

  /**
   * Generate code for any AST node
   * @private
   */
  _generateNode(node, options) {
    if (!node || !node.type) {
      return '';
    }
    
    switch (node.type) {
      case 'Program':
        return this._generateProgram(node, options);
      case 'FunctionDeclaration':
        return this._generateFunction(node, options);
      case 'ClassDeclaration':
        return this._generateStruct(node, options);
      case 'MethodDefinition':
        return this._generateMethod(node, options);
      case 'BlockStatement':
        return this._generateBlock(node, options);
      case 'VariableDeclaration':
        return this._generateVariableDeclaration(node, options);
      case 'ExpressionStatement':
        return this._generateExpressionStatement(node, options);
      case 'ReturnStatement':
        return this._generateReturnStatement(node, options);
      case 'BinaryExpression':
        return this._generateBinaryExpression(node, options);
      case 'CallExpression':
        return this._generateCallExpression(node, options);
      case 'MemberExpression':
        return this._generateMemberExpression(node, options);
      case 'AssignmentExpression':
        return this._generateAssignmentExpression(node, options);
      case 'Identifier':
        return this._generateIdentifier(node, options);
      case 'Literal':
        return this._generateLiteral(node, options);
      case 'ThisExpression':
        return 'this'; // C doesn't have 'this', use context pointer
      case 'Super':
        return 'parent'; // C doesn't have inheritance
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'Property':
        return this._generateProperty(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
      case 'SequenceExpression':
        return this._generateSequenceExpression(node, options);
      case 'TemplateLiteral':
        return this._generateTemplateLiteral(node, options);
      case 'TaggedTemplateExpression':
        return this._generateTaggedTemplateExpression(node, options);
      case 'RestElement':
        return this._generateRestElement(node, options);
      case 'SpreadElement':
        return this._generateSpreadElement(node, options);
      case 'AssignmentPattern':
        return this._generateAssignmentPattern(node, options);
      case 'ObjectPattern':
        return this._generateObjectPattern(node, options);
      case 'ArrayPattern':
        return this._generateArrayPattern(node, options);
      case 'VariableDeclarator':
        return this._generateVariableDeclarator(node, options);
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'ForInStatement':
        return this._generateForInStatement(node, options);
      case 'ForOfStatement':
        return this._generateForOfStatement(node, options);
      case 'DoWhileStatement':
        return this._generateDoWhileStatement(node, options);
      case 'SwitchStatement':
        return this._generateSwitchStatement(node, options);
      case 'SwitchCase':
        return this._generateSwitchCase(node, options);
      case 'BreakStatement':
        return this._generateBreakStatement(node, options);
      case 'ContinueStatement':
        return this._generateContinueStatement(node, options);
      case 'TryStatement':
        return this._generateTryStatement(node, options);
      case 'CatchClause':
        return this._generateCatchClause(node, options);
      case 'ThrowStatement':
        return this._generateThrowStatement(node, options);
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'DebuggerStatement':
        return this._generateDebuggerStatement(node, options);
      case 'WithStatement':
        return this._generateWithStatement(node, options);
      case 'LabeledStatement':
        return this._generateLabeledStatement(node, options);
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ExportDefaultDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ExportNamedDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ClassExpression':
        return this._generateClassExpression(node, options);
      case 'PropertyDefinition':
        return this._generatePropertyDefinition(node, options);
      case 'PrivateIdentifier':
        return this._generatePrivateIdentifier(node, options);
      case 'StaticBlock':
        return this._generateStaticBlock(node, options);
      case 'ChainExpression':
        return this._generateChainExpression(node, options);
      case 'ImportExpression':
        return this._generateImportExpression(node, options);
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
   * Generate function declaration with enhanced error handling and memory management
   * @private
   */
  _generateFunction(node, options) {
    const functionName = this._toCIdentifier(node.id ? node.id.name : 'unnamed_function');
    let code = '';

    // Determine if this is a crypto function based on name patterns
    const isCryptoFunction = this._isCryptoFunction(functionName);
    const returnType = isCryptoFunction ? 'crypto_error_t' : 'int';

    // Enhanced parameter type inference
    const parameters = [];
    if (node.params && node.params.length > 0) {
      node.params.forEach((param, index) => {
        const paramName = this._toCIdentifier(param.name || `param${index}`);
        const paramType = this._inferCType(null, param.name || `param${index}`, options);

        // Add const correctness for input parameters
        if (paramType.includes('*') && (paramName.includes('key') || paramName.includes('input') || paramName.includes('data'))) {
          parameters.push(`const ${paramType} ${paramName}`);
        } else {
          parameters.push(`${paramType} ${paramName}`);
        }
      });
    }

    // Add function prototype for forward declaration
    let prototype = `${returnType} ${functionName}(`;
    if (parameters.length > 0) {
      prototype += parameters.join(', ');
    } else {
      prototype += 'void';
    }
    prototype += ');';
    this.prototypes.push(prototype);

    // Enhanced C documentation
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(` * ${functionName} - ${isCryptoFunction ? 'Cryptographic' : 'General'} function\n`);
      code += this._indent(` * ${node.id ? node.id.name : 'unnamed'} operation implementation\n`);
      code += this._indent(' *\n');

      if (parameters.length > 0) {
        parameters.forEach(param => {
          const [type, name] = param.split(' ').slice(-2);
          code += this._indent(` * @param ${name} ${type} parameter\n`);
        });
      }

      code += this._indent(` * @return ${returnType === 'crypto_error_t' ? 'CRYPTO_SUCCESS on success, error code on failure' : 'Result of the operation'}\n`);

      if (isCryptoFunction) {
        code += this._indent(' *\n');
        code += this._indent(' * @note This function requires proper parameter validation\n');
        code += this._indent(' * @warning Ensure all pointers are valid before calling\n');
      }

      code += this._indent(' */\n');
    }

    // Enhanced function signature
    code += this._indent(`${returnType} ${functionName}(`);
    if (parameters.length > 0) {
      code += parameters.join(', ');
    } else {
      code += 'void';
    }
    code += ')\n';
    code += this._indent('{\n');

    // Function body with enhanced error handling
    this.indentLevel++;

    // Add parameter validation for crypto functions
    if (isCryptoFunction && options.addSafetyChecks) {
      code += this._indent('/* Parameter validation */\n');
      parameters.forEach(param => {
        const [, , name] = param.split(' ');
        if (param.includes('*')) {
          code += this._indent(`if (!${name}) {\n`);
          code += this._indent(`    return CRYPTO_ERROR_INVALID_PARAMETER;\n`);
          code += this._indent(`}\n`);
        }
      });
      code += this._indent('\n');
    }

    // Local variables for cleanup tracking
    if (isCryptoFunction && options.addSafetyChecks) {
      code += this._indent('/* Local variables for cleanup tracking */\n');
      code += this._indent(`${returnType} result = ${returnType === 'crypto_error_t' ? 'CRYPTO_SUCCESS' : '0'};\n`);
      code += this._indent('void *allocated_memory[16] = {0}; /* Track up to 16 allocations */\n');
      code += this._indent('size_t allocation_count = 0;\n\n');
    }

    // Function body implementation
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);

      // Check if body is effectively empty (no statements, just braces or whitespace)
      const isEmptyBody = !bodyCode ||
                         bodyCode.trim() === '' ||
                         bodyCode.replace(/[\s\{\}]/g, '') === '' ||
                         (node.body.type === 'BlockStatement' && (!node.body.body || node.body.body.length === 0));

      if (isEmptyBody) {
        // Empty body - generate type-aware fallback
        code += this._generateFunctionBodyFallback(returnType, isCryptoFunction, parameters, options);
      } else {
        code += bodyCode;
      }
    } else {
      // No body provided - generate type-aware fallback
      code += this._generateFunctionBodyFallback(returnType, isCryptoFunction, parameters, options);
    }

    // Add cleanup section for crypto functions
    if (isCryptoFunction && options.addSafetyChecks) {
      code += this._indent('\n');
      code += this._indent('cleanup:\n');
      code += this._indent('    /* Clean up any allocated memory */\n');
      code += this._indent('    for (size_t i = 0; i < allocation_count; i++) {\n');
      code += this._indent('        if (allocated_memory[i]) {\n');
      code += this._indent('            secure_clear(allocated_memory[i], 0); /* Size tracking would be needed */\n');
      code += this._indent('            free(allocated_memory[i]);\n');
      code += this._indent('        }\n');
      code += this._indent('    }\n');
      code += this._indent('    return result;\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Check if function name indicates cryptographic function
   * @private
   */
  _isCryptoFunction(functionName) {
    const cryptoKeywords = [
      'encrypt', 'decrypt', 'hash', 'cipher', 'crypto', 'key', 'block',
      'stream', 'mac', 'hmac', 'pbkdf', 'scrypt', 'aes', 'des', 'rsa',
      'ecdsa', 'sha', 'md5', 'algorithm', 'round', 'transform', 'schedule'
    ];

    return cryptoKeywords.some(keyword =>
      functionName.toLowerCase().includes(keyword)
    );
  }

  /**
   * Generate type-aware fallback implementation for empty/unimplemented function bodies
   * @private
   */
  _generateFunctionBodyFallback(returnType, isCryptoFunction, parameters, options) {
    let code = '';

    // Add unused parameter attributes to avoid warnings
    if (parameters.length > 0) {
      code += this._indent('/* Mark parameters as unused to avoid compiler warnings */\n');
      parameters.forEach(param => {
        // Extract parameter name from "type name" format
        const paramName = param.split(' ').pop().replace(/[^a-zA-Z0-9_]/g, '');
        code += this._indent(`(void)${paramName};\n`);
      });
      code += this._indent('\n');
    }

    code += this._indent('/* Fallback implementation - function body not provided */\n');

    // Crypto functions have special error codes
    if (isCryptoFunction) {
      code += this._indent('fprintf(stderr, "Cryptographic function not implemented: %s\\n", __func__);\n');
      code += this._indent('return CRYPTO_ERROR_NOT_IMPLEMENTED;\n');
      return code;
    }

    // Type-aware return value based on return type
    if (returnType === 'void') {
      // Void functions: just return
      code += this._indent('/* Empty function body - void return type */\n');
      code += this._indent('return;\n');
    } else if (returnType.includes('*')) {
      // Pointer return types: return NULL
      code += this._indent('/* Function not implemented - returning NULL for safety */\n');
      code += this._indent('fprintf(stderr, "Function not implemented: %s\\n", __func__);\n');
      code += this._indent('return NULL;\n');
    } else if (returnType === 'bool' || returnType === '_Bool') {
      // Boolean return types: return false
      code += this._indent('/* Function not implemented - returning false */\n');
      code += this._indent('fprintf(stderr, "Function not implemented: %s\\n", __func__);\n');
      code += this._indent('return false;\n');
    } else if (returnType.includes('int') || returnType === 'long' || returnType === 'short' ||
               returnType === 'size_t' || returnType === 'ssize_t') {
      // Integer/size return types: return -1 or 0 depending on signed/unsigned
      const isUnsigned = returnType.includes('unsigned') || returnType.includes('uint') ||
                        returnType === 'size_t';
      code += this._indent(`/* Function not implemented - returning ${isUnsigned ? '0' : '-1'} */\n`);
      code += this._indent('fprintf(stderr, "Function not implemented: %s\\n", __func__);\n');
      code += this._indent(`return ${isUnsigned ? '0' : '-1'};\n`);
    } else if (returnType === 'float' || returnType === 'double') {
      // Floating point: return 0.0
      code += this._indent('/* Function not implemented - returning 0.0 */\n');
      code += this._indent('fprintf(stderr, "Function not implemented: %s\\n", __func__);\n');
      code += this._indent('return 0.0;\n');
    } else {
      // Default fallback: try to return 0 with cast
      code += this._indent('/* Function not implemented - returning default value */\n');
      code += this._indent('fprintf(stderr, "Function not implemented: %s\\n", __func__);\n');
      code += this._indent(`return (${returnType})0;\n`);
    }

    return code;
  }

  /**
   * Generate struct (equivalent to class)
   * @private
   */
  _generateStruct(node, options) {
    const structName = node.id ? this._toSnakeCase(node.id.name) + '_t' : 'unnamed_struct_t';
    let code = '';
    
    // Struct comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + structName + ' structure\n');
      code += this._indent(' * Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
      code += this._indent(' */\n');
    }
    
    // Struct declaration
    code += this._indent('typedef struct {\n');
    
    // Struct fields - enhanced with crypto context
    this.indentLevel++;

    if (node.body && node.body.body && node.body.body.length > 0) {
      node.body.body.forEach(member => {
        if (member.type === 'PropertyDefinition' || member.type === 'ClassProperty') {
          const fieldName = this._toCIdentifier(member.key.name);
          const fieldType = this._inferCType(member.value, member.key.name, options);
          code += this._indent(`${fieldType} ${fieldName}; /* ${member.key.name} field */\n`);
        }
      });
    } else {
      // Generate default fields for empty class/struct
      code += this._indent('char _placeholder; /* Empty struct placeholder */\n');
    }

    this.indentLevel--;
    
    code += this._indent('} ' + structName + ';\n\n');
    
    // Generate functions for struct methods
    if (node.body && node.body.length > 0) {
      code += this._indent('/* Methods for ' + structName + ' */\n');
      const methods = node.body
        .map(method => this._generateStructMethod(method, structName, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    
    return code;
  }

  /**
   * Generate struct method as a function
   * @private
   */
  _generateStructMethod(node, structName, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toSnakeCase(node.key.name);
    const fullFunctionName = structName.replace('_t', '') + '_' + methodName;
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Add prototype
    let prototype = '';
    if (isConstructor) {
      prototype = structName + ' ' + structName.replace('_t', '') + '_create(';
    } else {
      prototype = 'int ' + fullFunctionName + '(' + structName + '* self';
      if (node.value.params && node.value.params.length > 0) {
        prototype += ', ';
      }
    }
    
    if (node.value.params && node.value.params.length > 0) {
      const paramTypes = node.value.params.map(() => 'int').join(', ');
      prototype += paramTypes;
    }
    
    if (isConstructor && (!node.value.params || node.value.params.length === 0)) {
      prototype += 'void';
    }
    
    prototype += ');';
    this.prototypes.push(prototype);
    
    // Method comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + (isConstructor ? 'Constructor for ' + structName : fullFunctionName + ' method') + '\n');
      code += this._indent(' */\n');
    }
    
    // Function signature
    if (isConstructor) {
      code += this._indent(structName + ' ' + structName.replace('_t', '') + '_create(');
    } else {
      code += this._indent('int ' + fullFunctionName + '(' + structName + '* self');
      if (node.value.params && node.value.params.length > 0) {
        code += ', ';
      }
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toSnakeCase(paramName);
      });
      code += params.join(', ');
    } else if (isConstructor) {
      code += 'void';
    }
    
    code += ')\n';
    code += this._indent('{\n');
    
    // Function body
    this.indentLevel++;
    if (isConstructor) {
      code += this._indent(structName + ' result = {0};\n');
      code += this._indent('/* Initialize struct with default values */\n');
      code += this._indent('memset(&result, 0, sizeof(result));\n');
      code += this._indent('return result;\n');
    } else {
      if (node.value.body) {
        const bodyCode = this._generateNode(node.value.body, options);
        // Empty body is valid in C (for void functions)
        code += bodyCode;
      } else {
        // No body - empty is valid
        code += '';
      }
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate method definition (placeholder)
   * @private
   */
  _generateMethod(node, options) {
    return this._generateStructMethod(node, 'unknown_t', options);
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('{\n') + this._indent('}\n');
    }

    let code = this._indent('{\n');
    this.indentLevel++;

    const statements = node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim());

    code += statements.join('\n');
    if (statements.length > 0 && !code.endsWith('\n')) {
      code += '\n';
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate variable declaration with enhanced type inference and memory management
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';

    return node.declarations
      .map(decl => {
        const varName = this._toCIdentifier(decl.id.name);
        const varType = this._inferCType(decl.init, decl.id.name, options);

        // Add memory management annotations for pointers
        let code = '';
        if (varType.includes('*') && options.addSafetyChecks) {
          code += this._indent(`/* Memory: ${varName} requires manual cleanup */\n`);
        }

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);

          // Special handling for dynamic memory allocation
          if (initValue.includes('malloc') || initValue.includes('calloc') || initValue.includes('aligned_malloc')) {
            code += this._indent(`${varType} ${varName} = ${initValue};\n`);
            if (options.addSafetyChecks) {
              code += this._indent(`if (!${varName}) {\n`);
              code += this._indent(`    fprintf(stderr, "Memory allocation failed for ${varName}\\n");\n`);
              code += this._indent(`    return CRYPTO_ERROR_MEMORY_ALLOCATION;\n`);
              code += this._indent(`}\n`);
            }
          } else {
            code += this._indent(`${varType} ${varName} = ${initValue};\n`);
          }
        } else {
          // Zero initialization for security
          if (varType.includes('uint8_t') || varType.includes('char')) {
            code += this._indent(`${varType} ${varName} = {0};\n`);
          } else {
            code += this._indent(`${varType} ${varName};\n`);
          }
        }

        return code;
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
      return this._indent('return ' + returnValue + ';\n');
    } else {
      return this._indent('return 0;\n');
    }
  }

  /**
   * Generate binary expression
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;
    
    // C operators are mostly the same as JavaScript
    switch (operator) {
      case '===':
        operator = '==';
        break;
      case '!==':
        operator = '!=';
        break;
    }
    
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression with enhanced function mapping
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle special function calls
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const propertyName = node.callee.property.name || node.callee.property;

      // Handle OpCodes method calls
      if (object === 'OpCodes') {
        return this._generateOpCodesCall(propertyName, args, options);
      }

      // Handle console.log
      if (object === 'console' && propertyName === 'log') {
        return `printf(${args}${args ? ', ' : ''}"\\n")`;
      }

      // Handle Array methods
      if (propertyName === 'push') {
        return `/* Array.push */ ${object}[${object}_length++] = ${args}`;
      }
      if (propertyName === 'pop') {
        return `/* Array.pop */ ${object}[--${object}_length]`;
      }
      if (propertyName === 'join') {
        const separator = args || '""';
        return `join_array(${object}, ${object}_length, ${separator})`;
      }
    }

    // Handle built-in function mappings
    const mappedCallee = this._mapBuiltinFunction(callee);
    return mappedCallee + '(' + args + ')';
  }

  /**
   * Map JavaScript built-in functions to C equivalents
   * @private
   */
  _mapBuiltinFunction(functionName) {
    const functionMappings = {
      'parseInt': 'atoi',
      'parseFloat': 'atof',
      'isNaN': 'isnan',
      'isFinite': 'isfinite',
      'Math.abs': 'abs',
      'Math.floor': 'floor',
      'Math.ceil': 'ceil',
      'Math.round': 'round',
      'Math.sqrt': 'sqrt',
      'Math.pow': 'pow',
      'Math.sin': 'sin',
      'Math.cos': 'cos',
      'Math.tan': 'tan',
      'Math.random': 'rand',
      'Date.now': 'time',
      'String.fromCharCode': '/* String.fromCharCode */',
      'Array.isArray': '/* Array.isArray */'
    };

    // Add math.h include for math functions
    if (functionName.startsWith('Math.') || ['abs', 'floor', 'ceil', 'round', 'sqrt', 'pow', 'sin', 'cos', 'tan'].includes(functionName)) {
      this.includes.add('math.h');
    }

    // Add time.h include for time functions
    if (functionName === 'Date.now' || functionName === 'time') {
      this.includes.add('time.h');
    }

    // Add stdlib.h for random and conversion functions
    if (['parseInt', 'parseFloat', 'rand', 'atoi', 'atof'].includes(functionName)) {
      this.includes.add('stdlib.h');
    }

    return functionMappings[functionName] || functionName;
  }

  /**
   * Generate member expression with enhanced OpCodes support
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const propertyName = node.property.name || node.property;

    // Handle special cases first
    if (object === 'console' && propertyName === 'log') {
      return 'printf';
    }

    // Handle array/string length property
    if (propertyName === 'length') {
      return `strlen(${object})`; // For strings, use sizeof for arrays
    }

    // Handle OpCodes method calls
    if (object === 'OpCodes') {
      const args = ''; // Args will be added by call expression
      return this._generateOpCodesCall(propertyName, args, options);
    }

    // Handle AlgorithmFramework properties
    if (object === 'AlgorithmFramework') {
      const mappedProperty = this._mapAlgorithmFrameworkProperty(propertyName);
      return mappedProperty;
    }

    // Regular member access
    const property = node.computed ?
      '[' + this._generateNode(node.property, options) + ']' :
      '.' + this._toCIdentifier(propertyName);

    return object + property;
  }

  /**
   * Map AlgorithmFramework properties to C equivalents
   * @private
   */
  _mapAlgorithmFrameworkProperty(propertyName) {
    const propertyMappings = {
      'RegisterAlgorithm': 'register_algorithm',
      'CategoryType': 'category_type_e',
      'SecurityStatus': 'security_status_e',
      'ComplexityType': 'complexity_type_e',
      'CountryCode': 'country_code_e',
      'BlockCipherAlgorithm': 'block_cipher_algorithm_t',
      'IBlockCipherInstance': 'block_cipher_instance_t',
      'TestCase': 'test_case_t',
      'LinkItem': 'link_item_t',
      'KeySize': 'key_size_t'
    };
    return propertyMappings[propertyName] || this._toCIdentifier(propertyName);
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._toSnakeCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    } else if (node.value === null) {
      return 'NULL';
    } else if (typeof node.value === 'boolean') {
      // C doesn't have boolean literals (before C99 stdbool.h)
      return node.value ? '1' : '0';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to snake_case (C convention)
   * @private
   */
  _toSnakeCase(str) {
    if (!str) return str;
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Convert JavaScript identifier to C identifier with reserved word handling
   * @private
   */
  _toCIdentifier(str) {
    if (!str) return str;

    // C reserved words that need prefixing
    const cReservedWords = new Set([
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
      'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
      'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
      'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
      // C99 keywords
      'inline', 'restrict', '_Bool', '_Complex', '_Imaginary',
      // C11 keywords
      '_Alignas', '_Alignof', '_Atomic', '_Static_assert', '_Noreturn',
      '_Thread_local', '_Generic'
    ]);

    const converted = this._toSnakeCase(str);

    if (cReservedWords.has(converted)) {
      return 'c_' + converted;
    }

    return converted;
  }

  /**
   * Infer C type from context and JavaScript type
   * @private
   */
  _inferCType(node, varName, options) {
    // Check cryptographic context first
    if (this.cryptoTypeMap[varName]) {
      return this.cryptoTypeMap[varName];
    }

    // Check general type mappings
    if (this.typeMap[varName]) {
      return this.typeMap[varName];
    }

    // Infer from literal values
    if (node && node.type === 'Literal') {
      if (typeof node.value === 'string') {
        return 'const char*';
      } else if (typeof node.value === 'boolean') {
        return options.standard === 'c99' || options.standard === 'c11' ? 'bool' : 'int';
      } else if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          if (node.value >= 0 && node.value <= 255) {
            return 'uint8_t';
          } else if (node.value >= -128 && node.value <= 127) {
            return 'int8_t';
          } else if (node.value >= 0 && node.value <= 65535) {
            return 'uint16_t';
          } else if (node.value >= 0 && node.value <= 4294967295) {
            return 'uint32_t';
          } else {
            return 'uint64_t';
          }
        } else {
          return 'double';
        }
      }
    }

    // Infer from array expressions
    if (node && node.type === 'ArrayExpression') {
      if (this._isLikelyByteArray(node)) {
        return 'uint8_t*';
      } else {
        return 'int*';
      }
    }

    // Default fallback
    return 'int';
  }

  /**
   * Check if array expression is likely a byte array
   * @private
   */
  _isLikelyByteArray(node) {
    if (!node.elements || node.elements.length === 0) {
      return false;
    }

    // Check if all elements are likely bytes (0-255)
    return node.elements.every(element => {
      if (!element || element.type !== 'Literal' || typeof element.value !== 'number') {
        return false;
      }
      return Number.isInteger(element.value) && element.value >= 0 && element.value <= 255;
    });
  }

  /**
   * Add proper indentation
   * @private
   */
  _indent(code) {
    const indentStr = this.options.indent.repeat(this.indentLevel);
    return code.split('\n').map(line => 
      line.trim() ? indentStr + line : line
    ).join('\n');
  }

  /**
   * Wrap generated code with program structure
   * @private
   */
  _wrapWithProgramStructure(code, options) {
    let result = '';
    
    // File header comment
    if (options.addComments) {
      result += '/**\n';
      result += ' * Generated C code\n';
      result += ' * This file was automatically generated from JavaScript AST\n';
      result += ' * Standard: ' + options.standard.toUpperCase() + '\n';
      result += ' * Compiler: GCC/Clang compatible\n';
      result += ' */\n\n';
    }
    
    // Standard includes
    this.includes.add('stdio.h');
    this.includes.add('stdlib.h');
    this.includes.add('string.h');
    this.includes.add('stdint.h'); // For fixed-width integer types
    this.includes.add('stddef.h'); // For size_t and ptrdiff_t

    // Add crypto-specific includes
    if (options.useCryptoLibs) {
      if (options.useOpenSSL) {
        this.includes.add('openssl/evp.h');
        this.includes.add('openssl/rand.h');
        this.includes.add('openssl/crypto.h');
      }
      if (options.useSodium) {
        this.includes.add('sodium.h');
      }
    }

    // Add C11+ includes
    if (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23') {
      this.includes.add('stdbool.h'); // Boolean type support
      if (options.useStaticAssert) {
        this.includes.add('assert.h');
      }
      if (options.useAtomics) {
        this.includes.add('stdatomic.h');
      }
      if (options.useThreadLocal) {
        this.includes.add('threads.h');
      }
    }

    // Add OpCodes utility functions if used
    if (this.usedFeatures.has('opcodes')) {
      code += this._generateOpCodesUtilityFunctions(options);
    }

    // Add crypto utility structures and functions
    if (options.useCryptoLibs) {
      code += this._generateCryptoUtilities(options);
    }
    
    // Add includes
    for (const include of this.includes) {
      result += '#include <' + include + '>\n';
    }
    result += '\n';
    
    // Feature test macros
    if (options.standard === 'c99' || options.standard === 'c11') {
      result += '#define _GNU_SOURCE\n';
      result += '#define _POSIX_C_SOURCE 200809L\n\n';
    }
    
    // Function prototypes
    if (this.prototypes.length > 0) {
      result += '/* Function prototypes */\n';
      this.prototypes.forEach(proto => {
        result += proto + '\n';
      });
      result += '\n';
    }
    
    // Add any generated structures
    if (this.structures.length > 0) {
      result += '/* Generated structures */\n';
      this.structures.forEach(struct => {
        result += struct + '\n';
      });
      result += '\n';
    }

    // Add any global constants
    if (this.constants.length > 0) {
      result += '/* Generated constants */\n';
      this.constants.forEach(constant => {
        result += constant + '\n';
      });
      result += '\n';
    }

    // Add any global variables
    if (this.globalVariables.length > 0) {
      result += '/* Generated global variables */\n';
      this.globalVariables.forEach(variable => {
        result += variable + '\n';
      });
      result += '\n';
    }

    // Generated code
    result += code;
    
    // Enhanced main function with crypto initialization
    result += '\n\n/**\n';
    result += ' * Main function\n';
    result += ' * Entry point for the generated C program\n';
    result += ' * Includes cryptographic library initialization if needed\n';
    result += ' *\n';
    result += ' * @param argc Number of command-line arguments\n';
    result += ' * @param argv Array of command-line argument strings\n';
    result += ' * @return EXIT_SUCCESS on success, EXIT_FAILURE on error\n';
    result += ' */\n';
    result += 'int main(int argc, char* argv[])\n';
    result += '{\n';

    // Add crypto library initialization
    if (options.useCryptoLibs) {
      if (options.useOpenSSL) {
        result += '    /* Initialize OpenSSL */\n';
        result += '    SSL_library_init();\n';
        result += '    SSL_load_error_strings();\n';
        result += '    OpenSSL_add_all_algorithms();\n\n';
      }
      if (options.useSodium) {
        result += '    /* Initialize libsodium */\n';
        result += '    if (sodium_init() < 0) {\n';
        result += '        fprintf(stderr, "Failed to initialize libsodium\\n");\n';
        result += '        return EXIT_FAILURE;\n';
        result += '    }\n\n';
      }
      if (options.useAtomics) {
        result += '    /* Mark crypto library as initialized */\n';
        result += '    crypto_mark_library_initialized();\n\n';
      }
    }

    // Add the actual program logic from the AST
    if (code && code.trim()) {
      result += code + '\n';
    } else {
      result += '    /* Program logic will be added here */\n';
    }
    result += '    printf("Generated C code execution successful\\n");\n';
    result += '    printf("Compiler: %s\\n", __VERSION__);\n';
    result += '    printf("Standard: C%s\\n", ' +
      (options.standard === 'c99' ? '"99"' :
       options.standard === 'c11' ? '"11"' :
       options.standard === 'c17' ? '"17"' :
       options.standard === 'c23' ? '"23"' : '"89"') + ');\n\n';

    // Add crypto operation counter if enabled
    if (options.useAtomics && options.useCryptoLibs) {
      result += '    /* Display crypto operation statistics */\n';
      result += '    printf("Crypto operations performed: %lu\\n", crypto_get_operation_count());\n\n';
    }

    // Add cleanup
    if (options.useCryptoLibs && options.useOpenSSL) {
      result += '    /* Cleanup OpenSSL */\n';
      result += '    EVP_cleanup();\n';
      result += '    CRYPTO_cleanup_all_ex_data();\n';
      result += '    ERR_remove_thread_state(NULL);\n';
      result += '    ERR_free_strings();\n\n';
    }

    result += '    return EXIT_SUCCESS;\n';
    result += '}\n';
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Standard C library headers
    dependencies.push('stdio.h');
    dependencies.push('stdlib.h');
    dependencies.push('string.h');
    
    return dependencies;
  }

  /**
   * Generate comprehensive warnings about potential cryptographic and C-specific issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Cryptographic algorithm specific warnings
    warnings.push('This implementation is for educational purposes only');
    warnings.push('Use established cryptographic libraries (OpenSSL, libsodium) for production code');
    warnings.push('This code has not undergone cryptographic review or security audit');
    warnings.push('Constant-time implementation required for side-channel attack resistance');
    warnings.push('Proper key management and secure random number generation essential');

    // C-specific security warnings
    warnings.push('Check for buffer overflows and use safe string functions (strncpy, snprintf)');
    warnings.push('Add proper bounds checking for all array and pointer operations');
    warnings.push('Use const correctness for read-only parameters and data');
    warnings.push('Add comprehensive error checking for all system calls and library functions');
    warnings.push('Implement proper memory management with malloc/free pairing');
    warnings.push('Use static analysis tools (Clang Static Analyzer, Coverity, PVS-Studio)');
    warnings.push('Consider using memory-safe alternatives or sanitizers during development');
    warnings.push('Validate all input parameters and handle edge cases');
    warnings.push('Use secure memory clearing for sensitive data (explicit_bzero, SecureZeroMemory)');
    warnings.push('Consider stack protection and ASLR in compilation flags');

    // Modern C standard warnings
    if (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23') {
      warnings.push('Take advantage of C11+ features like static_assert for compile-time checks');
      warnings.push('Use _Generic for type-safe macro implementations');
      warnings.push('Consider _Alignas and _Alignof for memory layout optimization');
      if (options.useThreadLocal) {
        warnings.push('Thread-local storage requires careful synchronization design');
      }
      if (options.useAtomics) {
        warnings.push('Atomic operations require understanding of memory ordering');
      }
    }

    // Crypto library integration warnings
    if (options.useCryptoLibs) {
      if (options.useOpenSSL) {
        warnings.push('OpenSSL integration requires proper initialization and cleanup');
        warnings.push('Check OpenSSL version compatibility and update regularly');
      }
      if (options.useSodium) {
        warnings.push('libsodium provides higher-level cryptographic primitives');
        warnings.push('Sodium library requires proper initialization with sodium_init()');
      }
    }

    // Performance and optimization warnings
    warnings.push('Profile cryptographic operations for performance bottlenecks');
    warnings.push('Consider vectorization (SSE, AVX) for performance-critical operations');
    warnings.push('Implement proper cache-timing attack mitigation');
    warnings.push('Use compiler optimization flags carefully (-O2, -O3) while preserving security');

    return warnings;
  }

  // ===== COMPREHENSIVE AST NODE IMPLEMENTATIONS =====

  /**
   * Generate array expression with cryptographic context
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '{0}'; // Empty array initializer
    }

    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '0')
      .join(', ');

    // For cryptographic algorithms, determine if this should be a byte array
    if (this._isLikelyByteArray(node)) {
      return `{${elements}}`;
    }

    return `{${elements}}`;
  }

  /**
   * Generate object expression as struct initializer
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '{0}'; // Empty struct initializer
    }

    const properties = node.properties.map(prop => {
      const key = prop.key.type === 'Identifier' ? prop.key.name : this._generateNode(prop.key, options);
      const value = this._generateNode(prop.value, options);
      return `.${this._toCIdentifier(key)} = ${value}`;
    }).join(', ');

    return `{${properties}}`;
  }

  /**
   * Generate property definition
   * @private
   */
  _generateProperty(node, options) {
    const key = node.key.type === 'Identifier' ? node.key.name : this._generateNode(node.key, options);
    const value = this._generateNode(node.value, options);
    return `.${this._toCIdentifier(key)} = ${value}`;
  }

  /**
   * Generate function expression as function pointer
   * @private
   */
  _generateFunctionExpression(node, options) {
    const functionName = 'lambda_' + Math.random().toString(36).substr(2, 9);

    // Generate as regular function
    let code = this._generateFunction({
      ...node,
      id: { name: functionName, type: 'Identifier' }
    }, options);

    // Return function name for use as pointer
    return functionName;
  }

  /**
   * Generate arrow function expression as function pointer
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    return this._generateFunctionExpression(node, options);
  }

  /**
   * Generate new expression with C constructor patterns
   * @private
   */
  _generateNewExpression(node, options) {
    const className = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle special constructors
    if (className === 'Array') {
      return this._generateArrayConstructorCall(args);
    }
    if (className === 'Error') {
      return `/* Error: ${args} */ -1`;
    }
    if (className === 'Object') {
      return '{0}';
    }

    // Handle crypto-specific class names
    const mappedClassName = this._mapAlgorithmFrameworkClass(className);
    return `${mappedClassName}_create(${args})`;
  }

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const operator = this._mapUnaryOperator(node.operator);
    const argument = this._generateNode(node.argument, options);

    if (node.prefix) {
      return `${operator}${argument}`;
    } else {
      return `${argument}${operator}`;
    }
  }

  /**
   * Generate update expression (++, --)
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
    const operator = this._mapLogicalOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate conditional expression (ternary operator)
   * @private
   */
  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);
    return `${test} ? ${consequent} : ${alternate}`;
  }

  /**
   * Generate sequence expression (comma operator)
   * @private
   */
  _generateSequenceExpression(node, options) {
    const expressions = node.expressions
      .map(expr => this._generateNode(expr, options))
      .join(', ');
    return `(${expressions})`;
  }

  /**
   * Generate template literal as sprintf format
   * @private
   */
  _generateTemplateLiteral(node, options) {
    this.includes.add('stdio.h');

    if (!node.expressions || node.expressions.length === 0) {
      // Simple string literal
      return this._generateNode(node.quasis[0], options);
    }

    // Complex template literal with expressions
    let format = '';
    const args = [];

    for (let i = 0; i < node.quasis.length; i++) {
      format += node.quasis[i].value.cooked || node.quasis[i].value.raw || '';
      if (i < node.expressions.length) {
        format += '%s'; // Generic string placeholder
        args.push(this._generateNode(node.expressions[i], options));
      }
    }

    return `sprintf(buffer, "${format}", ${args.join(', ')})`;
  }

  /**
   * Generate tagged template expression
   * @private
   */
  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const quasi = this._generateNode(node.quasi, options);
    return `${tag}(${quasi})`;
  }

  /**
   * Generate rest element (...args)
   * @private
   */
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `/* variadic: */ ${argument}`;
  }

  /**
   * Generate spread element (...array)
   * @private
   */
  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `/* spread: */ ${argument}`;
  }

  /**
   * Generate assignment pattern (default parameters)
   * @private
   */
  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} /* = ${right} */`;
  }

  /**
   * Generate object pattern (destructuring)
   * @private
   */
  _generateObjectPattern(node, options) {
    const properties = node.properties
      .map(prop => this._generateNode(prop, options))
      .join(', ');
    return `/* destructure: {${properties}} */`;
  }

  /**
   * Generate array pattern (destructuring)
   * @private
   */
  _generateArrayPattern(node, options) {
    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '')
      .join(', ');
    return `/* destructure: [${elements}] */`;
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const varName = this._toCIdentifier(node.id.name);
    const varType = this._inferCType(node.init, node.id.name, options);

    if (node.init) {
      const initValue = this._generateNode(node.init, options);
      return `${varType} ${varName} = ${initValue}`;
    } else {
      return `${varType} ${varName}`;
    }
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    let code = this._indent(`if (${this._generateNode(node.test, options)}) {\n`);

    this.indentLevel++;
    const consequentCode = this._generateNode(node.consequent, options);
    code += consequentCode || this._indent('/* empty */\n');
    this.indentLevel--;

    code += this._indent('}\n');

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        code += this._indent('else ') + this._generateIfStatement(node.alternate, options).trim() + '\n';
      } else {
        code += this._indent('else {\n');
        this.indentLevel++;
        const alternateCode = this._generateNode(node.alternate, options);
        code += alternateCode || this._indent('/* empty */\n');
        this.indentLevel--;
        code += this._indent('}\n');
      }
    }

    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    let code = this._indent(`while (${this._generateNode(node.test, options)}) {\n`);

    this.indentLevel++;
    const bodyCode = this._generateNode(node.body, options);
    code += bodyCode || this._indent('/* empty */\n');
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    const init = node.init ? this._generateNode(node.init, options).replace(/;\n$/, '') : '';
    const test = node.test ? this._generateNode(node.test, options) : '';
    const update = node.update ? this._generateNode(node.update, options) : '';

    let code = this._indent(`for (${init}; ${test}; ${update}) {\n`);

    this.indentLevel++;
    const bodyCode = this._generateNode(node.body, options);
    code += bodyCode || this._indent('/* empty */\n');
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-in statement (not directly supported in C)
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`/* for-in: ${left} in ${right} - converted to for loop */\n`);
    code += this._indent(`for (int ${left}_index = 0; ${left}_index < ${right}_length; ${left}_index++) {\n`);
    this.indentLevel++;
    if (node.body) {
      code += this._generateNode(node.body, options);
    }
    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate for-of statement (not directly supported in C)
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`/* for-of: ${left} of ${right} - converted to for loop */\n`);
    code += this._indent(`for (int ${left}_index = 0; ${left}_index < ${right}_length; ${left}_index++) {\n`);
    this.indentLevel++;
    code += this._indent(`${this._inferCType(null, left, options)} ${left} = ${right}[${left}_index];\n`);
    if (node.body) {
      code += this._generateNode(node.body, options);
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
    const bodyCode = this._generateNode(node.body, options);
    code += bodyCode || this._indent('/* empty */\n');
    this.indentLevel--;

    code += this._indent(`} while (${this._generateNode(node.test, options)});\n`);
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    let code = this._indent(`switch (${this._generateNode(node.discriminant, options)}) {\n`);

    this.indentLevel++;
    if (node.cases) {
      node.cases.forEach(caseNode => {
        code += this._generateSwitchCase(caseNode, options);
      });
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
      code += this._indent(`case ${this._generateNode(node.test, options)}:\n`);
    } else {
      code += this._indent('default:\n');
    }

    this.indentLevel++;
    node.consequent.forEach(stmt => {
      code += this._generateNode(stmt, options);
    });
    this.indentLevel--;

    return code;
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    if (node.label) {
      return this._indent(`goto ${this._toCIdentifier(node.label.name)}_break;\n`);
    } else {
      return this._indent('break;\n');
    }
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    if (node.label) {
      return this._indent(`goto ${this._toCIdentifier(node.label.name)}_continue;\n`);
    } else {
      return this._indent('continue;\n');
    }
  }

  /**
   * Generate try statement (using setjmp/longjmp)
   * @private
   */
  _generateTryStatement(node, options) {
    this.includes.add('setjmp.h');

    let code = this._indent('/* Try-catch using setjmp/longjmp */\n');
    code += this._indent('jmp_buf exception_buf;\n');
    code += this._indent('if (setjmp(exception_buf) == 0) {\n');

    this.indentLevel++;
    const tryCode = this._generateNode(node.block, options);
    code += tryCode;
    this.indentLevel--;

    code += this._indent('}\n');

    if (node.handler) {
      code += this._generateCatchClause(node.handler, options);
    }

    if (node.finalizer) {
      code += this._indent('/* Finally block */\n');
      this.indentLevel++;
      const finallyCode = this._generateNode(node.finalizer, options);
      code += finallyCode;
      this.indentLevel--;
    }

    return code;
  }

  /**
   * Generate catch clause
   * @private
   */
  _generateCatchClause(node, options) {
    let code = this._indent('else {\n');
    code += this._indent('    /* Exception caught */\n');

    this.indentLevel++;
    const bodyCode = this._generateNode(node.body, options);
    code += bodyCode;
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate throw statement (using longjmp)
   * @private
   */
  _generateThrowStatement(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : '1';
    return this._indent(`longjmp(exception_buf, ${argument});\n`);
  }

  /**
   * Generate empty statement
   * @private
   */
  _generateEmptyStatement(node, options) {
    return this._indent(';\n');
  }

  /**
   * Generate debugger statement
   * @private
   */
  _generateDebuggerStatement(node, options) {
    if (options.useInlineAssembly) {
      return this._indent('__asm__("int $3"); /* debugger breakpoint */\n');
    } else {
      return this._indent('/* debugger; */\n');
    }
  }

  /**
   * Generate with statement (not supported in C)
   * @private
   */
  _generateWithStatement(node, options) {
    return this._indent('/* with statement not supported in C */\n');
  }

  /**
   * Generate labeled statement
   * @private
   */
  _generateLabeledStatement(node, options) {
    const label = this._toCIdentifier(node.label.name);
    const body = this._generateNode(node.body, options);
    return this._indent(`${label}:\n`) + body;
  }

  /**
   * Generate meta property (like new.target)
   * @private
   */
  _generateMetaProperty(node, options) {
    if (node.meta.name === 'new' && node.property.name === 'target') {
      return '/* new.target not supported in C */';
    }
    return `/* ${node.meta.name}.${node.property.name} */`;
  }

  /**
   * Generate await expression (not supported in C)
   * @private
   */
  _generateAwaitExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `/* await */ ${argument}`;
  }

  /**
   * Generate yield expression (not supported in C)
   * @private
   */
  _generateYieldExpression(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : '';
    return `/* yield */ ${argument}`;
  }

  /**
   * Generate import declaration as include
   * @private
   */
  _generateImportDeclaration(node, options) {
    const source = node.source.value;

    // Map common imports to C includes
    const importMappings = {
      'crypto': 'openssl/evp.h',
      'fs': 'stdio.h',
      'path': 'libgen.h',
      'os': 'unistd.h'
    };

    if (importMappings[source]) {
      this.includes.add(importMappings[source]);
      return this._indent(`/* import from ${source} -> #include <${importMappings[source]}> */\n`);
    } else {
      return this._indent(`#include "${source}.h" /* import ${source} */\n`);
    }
  }

  /**
   * Generate export declaration (not directly supported in C)
   * @private
   */
  _generateExportDeclaration(node, options) {
    if (node.declaration) {
      const declaration = this._generateNode(node.declaration, options);
      return declaration + this._indent('/* exported */\n');
    } else {
      return this._indent('/* export */\n');
    }
  }

  /**
   * Generate class expression as struct typedef
   * @private
   */
  _generateClassExpression(node, options) {
    return this._generateStruct(node, options);
  }

  /**
   * Generate property definition
   * @private
   */
  _generatePropertyDefinition(node, options) {
    const key = this._toCIdentifier(node.key.name);
    const type = this._inferCType(node.value, node.key.name, options);
    return this._indent(`${type} ${key};\n`);
  }

  /**
   * Generate private identifier
   * @private
   */
  _generatePrivateIdentifier(node, options) {
    return '_private_' + this._toCIdentifier(node.name);
  }

  /**
   * Generate static block
   * @private
   */
  _generateStaticBlock(node, options) {
    let code = this._indent('/* static block */\n');
    code += this._indent('static void __attribute__((constructor)) static_init(void) {\n');

    this.indentLevel++;
    const bodyCode = this._generateNode(node.body, options);
    code += bodyCode;
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate chain expression (optional chaining)
   * @private
   */
  _generateChainExpression(node, options) {
    const expression = this._generateNode(node.expression, options);
    return `/* optional chaining */ ${expression}`;
  }

  /**
   * Generate import expression (dynamic import)
   * @private
   */
  _generateImportExpression(node, options) {
    const source = this._generateNode(node.source, options);
    return `/* dynamic import: */ ${source}`;
  }

  // ===== ADDITIONAL AST NODE IMPLEMENTATIONS =====

  /**
   * Generate Super expression
   * @private
   */
  _generateSuper(node, options) {
    return '/* super */';
  }

  /**
   * Generate template element
   * @private
   */
  _generateTemplateElement(node, options) {
    return `"${node.value.cooked || node.value.raw || ''}"`;
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

  /**
   * Generate boolean literal
   * @private
   */
  _generateBooleanLiteral(node, options) {
    return this._generateLiteral(node, options);
  }

  /**
   * Generate null literal
   * @private
   */
  _generateNullLiteral(node, options) {
    return 'NULL';
  }

  /**
   * Generate undefined literal
   * @private
   */
  _generateUndefinedLiteral(node, options) {
    return '/* undefined */';
  }

  /**
   * Generate RegExp literal
   * @private
   */
  _generateRegExpLiteral(node, options) {
    this.includes.add('regex.h');
    return `/* regex: /${node.pattern}/${node.flags || ''} */`;
  }

  /**
   * Generate BigInt literal
   * @private
   */
  _generateBigIntLiteral(node, options) {
    this.includes.add('stdint.h');
    return `${node.value}LL /* BigInt */`;
  }

  // ===== JSX SUPPORT (COMMENTED OUT) =====

  /**
   * Generate JSX element (not supported in C)
   * @private
   */
  _generateJSXElement(node, options) {
    return '/* JSX not supported in C */';
  }

  /**
   * Generate JSX fragment (not supported in C)
   * @private
   */
  _generateJSXFragment(node, options) {
    return '/* JSX fragment not supported in C */';
  }

  /**
   * Generate JSX text (not supported in C)
   * @private
   */
  _generateJSXText(node, options) {
    return `"${node.value}"`;
  }

  /**
   * Generate JSX expression container (not supported in C)
   * @private
   */
  _generateJSXExpressionContainer(node, options) {
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate JSX attribute (not supported in C)
   * @private
   */
  _generateJSXAttribute(node, options) {
    return '/* JSX attribute not supported in C */';
  }

  /**
   * Generate JSX spread attribute (not supported in C)
   * @private
   */
  _generateJSXSpreadAttribute(node, options) {
    return '/* JSX spread attribute not supported in C */';
  }

  /**
   * Generate JSX opening element (not supported in C)
   * @private
   */
  _generateJSXOpeningElement(node, options) {
    return '/* JSX opening element not supported in C */';
  }

  /**
   * Generate JSX closing element (not supported in C)
   * @private
   */
  _generateJSXClosingElement(node, options) {
    return '/* JSX closing element not supported in C */';
  }

  /**
   * Generate JSX identifier (not supported in C)
   * @private
   */
  _generateJSXIdentifier(node, options) {
    return this._toCIdentifier(node.name);
  }

  /**
   * Generate JSX member expression (not supported in C)
   * @private
   */
  _generateJSXMemberExpression(node, options) {
    return '/* JSX member expression not supported in C */';
  }

  /**
   * Generate JSX namespaced name (not supported in C)
   * @private
   */
  _generateJSXNamespacedName(node, options) {
    return '/* JSX namespaced name not supported in C */';
  }

  // ===== ADVANCED FEATURES =====

  /**
   * Generate directive literal
   * @private
   */
  _generateDirectiveLiteral(node, options) {
    return `/* directive: ${node.value} */`;
  }

  /**
   * Generate directive
   * @private
   */
  _generateDirective(node, options) {
    return this._generateNode(node.value, options);
  }

  /**
   * Generate interpreter directive
   * @private
   */
  _generateInterpreterDirective(node, options) {
    return `/* interpreter: ${node.value} */`;
  }

  /**
   * Generate file node
   * @private
   */
  _generateFile(node, options) {
    return this._generateNode(node.program, options);
  }

  /**
   * Generate comment block
   * @private
   */
  _generateCommentBlock(node, options) {
    return `/*${node.value}*/`;
  }

  /**
   * Generate comment line
   * @private
   */
  _generateCommentLine(node, options) {
    return `// ${node.value}`;
  }

  /**
   * Generate class property
   * @private
   */
  _generateClassProperty(node, options) {
    return this._generatePropertyDefinition(node, options);
  }

  /**
   * Generate class method
   * @private
   */
  _generateClassMethod(node, options) {
    return this._generateMethod(node, options);
  }

  /**
   * Generate class private property
   * @private
   */
  _generateClassPrivateProperty(node, options) {
    const key = this._generatePrivateIdentifier(node.key, options);
    const type = this._inferCType(node.value, node.key.name, options);
    return this._indent(`${type} ${key};\n`);
  }

  /**
   * Generate class private method
   * @private
   */
  _generateClassPrivateMethod(node, options) {
    return this._generateMethod(node, options);
  }

  /**
   * Generate class accessor property
   * @private
   */
  _generateClassAccessorProperty(node, options) {
    return this._generatePropertyDefinition(node, options);
  }

  /**
   * Generate decorator (not supported in C)
   * @private
   */
  _generateDecorator(node, options) {
    return '/* decorator not supported in C */';
  }

  /**
   * Generate do expression (not supported in C)
   * @private
   */
  _generateDoExpression(node, options) {
    return this._generateNode(node.body, options);
  }

  /**
   * Generate export all declaration
   * @private
   */
  _generateExportAllDeclaration(node, options) {
    return `/* export * from "${node.source.value}" */`;
  }

  /**
   * Generate export specifier
   * @private
   */
  _generateExportSpecifier(node, options) {
    return `/* export ${node.local.name} as ${node.exported.name} */`;
  }

  /**
   * Generate import specifier
   * @private
   */
  _generateImportSpecifier(node, options) {
    return `/* import ${node.imported.name} as ${node.local.name} */`;
  }

  /**
   * Generate import default specifier
   * @private
   */
  _generateImportDefaultSpecifier(node, options) {
    return `/* import default as ${node.local.name} */`;
  }

  /**
   * Generate import namespace specifier
   * @private
   */
  _generateImportNamespaceSpecifier(node, options) {
    return `/* import * as ${node.local.name} */`;
  }

  /**
   * Generate export namespace specifier
   * @private
   */
  _generateExportNamespaceSpecifier(node, options) {
    return `/* export * as ${node.exported.name} */`;
  }

  /**
   * Generate export default specifier
   * @private
   */
  _generateExportDefaultSpecifier(node, options) {
    return `/* export default ${node.exported.name} */`;
  }

  /**
   * Generate parenthesized expression
   * @private
   */
  _generateParenthesizedExpression(node, options) {
    return `(${this._generateNode(node.expression, options)})`;
  }

  /**
   * Generate optional member expression
   * @private
   */
  _generateOptionalMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ?
      `[${this._generateNode(node.property, options)}]` :
      `.${this._toCIdentifier(node.property.name || node.property)}`;

    return `/* optional */ ${object}${property}`;
  }

  /**
   * Generate optional call expression
   * @private
   */
  _generateOptionalCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `/* optional call */ ${callee}(${args})`;
  }

  /**
   * Generate bind expression (not supported in C)
   * @private
   */
  _generateBindExpression(node, options) {
    return '/* bind expression not supported in C */';
  }

  /**
   * Generate pipeline topic expression (not supported in C)
   * @private
   */
  _generatePipelineTopicExpression(node, options) {
    return '/* pipeline topic expression not supported in C */';
  }

  /**
   * Generate pipeline bare function (not supported in C)
   * @private
   */
  _generatePipelineBareFunction(node, options) {
    return '/* pipeline bare function not supported in C */';
  }

  /**
   * Generate pipeline primary topic reference (not supported in C)
   * @private
   */
  _generatePipelinePrimaryTopicReference(node, options) {
    return '/* pipeline primary topic reference not supported in C */';
  }

  /**
   * Generate topic reference (not supported in C)
   * @private
   */
  _generateTopicReference(node, options) {
    return '/* topic reference not supported in C */';
  }

  /**
   * Generate argument placeholder (not supported in C)
   * @private
   */
  _generateArgumentPlaceholder(node, options) {
    return '/* argument placeholder not supported in C */';
  }

  /**
   * Generate module expression (not supported in C)
   * @private
   */
  _generateModuleExpression(node, options) {
    return '/* module expression not supported in C */';
  }

  /**
   * Generate TypeScript as expression (not supported in C)
   * @private
   */
  _generateTSAsExpression(node, options) {
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate TypeScript type assertion (not supported in C)
   * @private
   */
  _generateTSTypeAssertion(node, options) {
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate TypeScript non-null expression (not supported in C)
   * @private
   */
  _generateTSNonNullExpression(node, options) {
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate TypeScript instantiation expression (not supported in C)
   * @private
   */
  _generateTSInstantiationExpression(node, options) {
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate TypeScript satisfies expression (not supported in C)
   * @private
   */
  _generateTSSatisfiesExpression(node, options) {
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate fallback for unknown node types
   * @private
   */
  _generateOptionalCallExpression(node, options) {
    // C doesn't have optional calls, but we can generate a safe call pattern
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    return `(${callee} ? ${callee}(${args}) : NULL)`;
  }

  _generateOptionalMemberExpression(node, options) {
    // C doesn't have optional member access, generate null check
    const object = this._generateNode(node.object, options);
    const property = node.computed ?
      `[${this._generateNode(node.property, options)}]` :
      `.${node.property.name || node.property}`;
    return `(${object} ? ${object}${property} : 0)`;
  }

  _generateJSXElement(node, options) {
    // Convert JSX to C string literal or HTML generation
    const tagName = node.openingElement && node.openingElement.name ?
      node.openingElement.name.name : 'div';
    return `"<${tagName}></${tagName}>"`;
  }

  _generateJSXFragment(node, options) {
    return `"<!-- Fragment -->"`;
  }

  _generateTSAsExpression(node, options) {
    const expression = this._generateNode(node.expression, options);
    // C doesn't have type assertions, use explicit cast if needed
    return `(${expression})`;
  }

  _generateFallbackNode(node, options) {
    if (!node || !node.type) {
      return '/* invalid node */';
    }

    console.warn(`Unknown AST node type: ${node.type}`);

    // Generate a minimal valid C code stub instead of just a comment
    let fallback = '';
    fallback += `/* WARNING: Unhandled AST node type: ${node.type} */\n`;
    fallback += `/* This is a fallback stub - proper implementation needed */\n`;

    // Try to provide useful context if available
    if (node.raw) {
      fallback += `/* Original: ${node.raw} */\n`;
    } else if (node.value !== undefined) {
      fallback += `/* Value: ${JSON.stringify(node.value)} */\n`;
    } else if (node.name) {
      fallback += `/* Name: ${node.name} */\n`;
    }

    // Return a safe default value that will compile
    // For expressions, return 0 (most generic fallback)
    fallback += '0 /* fallback value */';

    return fallback;
  }

  // ===== HELPER METHODS =====

  /**
   * Map JavaScript operators to C operators
   * @private
   */
  _mapUnaryOperator(operator) {
    const operatorMap = {
      '!': '!',
      '~': '~',
      '+': '+',
      '-': '-',
      'typeof': '/* typeof */',
      'void': '/* void */',
      'delete': '/* delete */'
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Map JavaScript logical operators to C operators
   * @private
   */
  _mapLogicalOperator(operator) {
    const operatorMap = {
      '&&': '&&',
      '||': '||',
      '??': '/* nullish coalescing */ ||'
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Map JavaScript assignment operators to C operators
   * @private
   */
  _mapAssignmentOperator(operator) {
    const operatorMap = {
      '=': '=',
      '+=': '+=',
      '-=': '-=',
      '*=': '*=',
      '/=': '/=',
      '%=': '%=',
      '&=': '&=',
      '|=': '|=',
      '^=': '^=',
      '<<=': '<<=',
      '>>=': '>>=',
      '>>>=': '/* >>> */ >>=',
      '**=': '/* **= */ *='
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Map AlgorithmFramework class names to C equivalents
   * @private
   */
  _mapAlgorithmFrameworkClass(className) {
    const classMappings = {
      'BlockCipherAlgorithm': 'block_cipher_algorithm_t',
      'StreamCipherAlgorithm': 'stream_cipher_algorithm_t',
      'HashFunctionAlgorithm': 'hash_function_algorithm_t',
      'IBlockCipherInstance': 'block_cipher_instance_t',
      'IStreamCipherInstance': 'stream_cipher_instance_t',
      'IHashFunctionInstance': 'hash_function_instance_t'
    };
    return classMappings[className] || this._toCIdentifier(className) + '_t';
  }

  /**
   * Generate Array constructor call
   * @private
   */
  _generateArrayConstructorCall(args) {
    if (!args) {
      return '{0}';
    }

    // Parse array size from arguments
    const size = args.split(',')[0] || '0';
    return `/* Array(${size}) */ calloc(${size}, sizeof(int))`;
  }

  /**
   * Generate OpCodes utility functions for C
   * @private
   */
  _generateOpCodesUtilityFunctions(options) {
    let code = '/* OpCodes utility functions */\n';

    code += '#ifndef OPCODES_UTILS_H\n';
    code += '#define OPCODES_UTILS_H\n\n';

    // Rotation functions
    code += '/* Bit rotation functions */\n';
    code += 'static inline uint32_t rotl32(uint32_t value, unsigned int count) {\n';
    code += '    count &= 31;\n';
    code += '    return (value << count) | (value >> (32 - count));\n';
    code += '}\n\n';

    code += 'static inline uint32_t rotr32(uint32_t value, unsigned int count) {\n';
    code += '    count &= 31;\n';
    code += '    return (value >> count) | (value << (32 - count));\n';
    code += '}\n\n';

    code += 'static inline uint8_t rotl8(uint8_t value, unsigned int count) {\n';
    code += '    count &= 7;\n';
    code += '    return (value << count) | (value >> (8 - count));\n';
    code += '}\n\n';

    code += 'static inline uint8_t rotr8(uint8_t value, unsigned int count) {\n';
    code += '    count &= 7;\n';
    code += '    return (value >> count) | (value << (8 - count));\n';
    code += '}\n\n';

    // Packing functions
    code += '/* Byte packing/unpacking functions */\n';
    code += 'static inline uint32_t pack32le(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {\n';
    code += '    return (uint32_t)b0 | ((uint32_t)b1 << 8) | ((uint32_t)b2 << 16) | ((uint32_t)b3 << 24);\n';
    code += '}\n\n';

    code += 'static inline uint32_t pack32be(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {\n';
    code += '    return ((uint32_t)b0 << 24) | ((uint32_t)b1 << 16) | ((uint32_t)b2 << 8) | (uint32_t)b3;\n';
    code += '}\n\n';

    code += 'static inline void unpack32le(uint32_t value, uint8_t *bytes) {\n';
    code += '    bytes[0] = (uint8_t)(value & 0xFF);\n';
    code += '    bytes[1] = (uint8_t)((value >> 8) & 0xFF);\n';
    code += '    bytes[2] = (uint8_t)((value >> 16) & 0xFF);\n';
    code += '    bytes[3] = (uint8_t)((value >> 24) & 0xFF);\n';
    code += '}\n\n';

    code += 'static inline void unpack32be(uint32_t value, uint8_t *bytes) {\n';
    code += '    bytes[0] = (uint8_t)((value >> 24) & 0xFF);\n';
    code += '    bytes[1] = (uint8_t)((value >> 16) & 0xFF);\n';
    code += '    bytes[2] = (uint8_t)((value >> 8) & 0xFF);\n';
    code += '    bytes[3] = (uint8_t)(value & 0xFF);\n';
    code += '}\n\n';

    // XOR operations
    code += '/* XOR operations */\n';
    code += 'static inline void xor_arrays(const uint8_t *a, const uint8_t *b, uint8_t *result, size_t length) {\n';
    code += '    for (size_t i = 0; i < length; i++) {\n';
    code += '        result[i] = a[i] ^ b[i];\n';
    code += '    }\n';
    code += '}\n\n';

    // Secure memory clearing
    code += '/* Secure memory operations */\n';
    if (options.useOpenSSL) {
      code += 'static inline void secure_clear(void *ptr, size_t size) {\n';
      code += '    OPENSSL_cleanse(ptr, size);\n';
      code += '}\n\n';
    } else {
      code += 'static inline void secure_clear(void *ptr, size_t size) {\n';
      code += '#ifdef _WIN32\n';
      code += '    SecureZeroMemory(ptr, size);\n';
      code += '#else\n';
      code += '    explicit_bzero(ptr, size);\n';
      code += '#endif\n';
      code += '}\n\n';
    }

    // Hex conversion utilities
    code += '/* Hex conversion utilities */\n';
    code += 'static const char hex_chars[] = "0123456789abcdef";\n\n';

    code += 'static inline void bytes_to_hex(const uint8_t *bytes, size_t length, char *hex_string) {\n';
    code += '    for (size_t i = 0; i < length; i++) {\n';
    code += '        hex_string[i * 2] = hex_chars[bytes[i] >> 4];\n';
    code += '        hex_string[i * 2 + 1] = hex_chars[bytes[i] & 0x0F];\n';
    code += '    }\n';
    code += '    hex_string[length * 2] = \'\\0\';\n';
    code += '}\n\n';

    code += 'static inline int hex_char_to_value(char c) {\n';
    code += '    if (c >= \'0\' && c <= \'9\') return c - \'0\';\n';
    code += '    if (c >= \'a\' && c <= \'f\') return c - \'a\' + 10;\n';
    code += '    if (c >= \'A\' && c <= \'F\') return c - \'A\' + 10;\n';
    code += '    return -1;\n';
    code += '}\n\n';

    code += 'static inline int hex_to_bytes(const char *hex_string, uint8_t *bytes, size_t max_length) {\n';
    code += '    size_t hex_length = strlen(hex_string);\n';
    code += '    if (hex_length % 2 != 0 || hex_length / 2 > max_length) return -1;\n';
    code += '    \n';
    code += '    for (size_t i = 0; i < hex_length; i += 2) {\n';
    code += '        int high = hex_char_to_value(hex_string[i]);\n';
    code += '        int low = hex_char_to_value(hex_string[i + 1]);\n';
    code += '        if (high == -1 || low == -1) return -1;\n';
    code += '        bytes[i / 2] = (uint8_t)((high << 4) | low);\n';
    code += '    }\n';
    code += '    return (int)(hex_length / 2);\n';
    code += '}\n\n';

    code += '#endif /* OPCODES_UTILS_H */\n\n';

    return code;
  }

  /**
   * Generate cryptographic utility structures and functions
   * @private
   */
  _generateCryptoUtilities(options) {
    let code = '/* Cryptographic utility structures and functions */\n';

    code += '#ifndef CRYPTO_UTILS_H\n';
    code += '#define CRYPTO_UTILS_H\n\n';

    // Error codes
    code += '/* Cryptographic error codes */\n';
    code += 'typedef enum {\n';
    code += '    CRYPTO_SUCCESS = 0,\n';
    code += '    CRYPTO_ERROR_INVALID_PARAMETER = -1,\n';
    code += '    CRYPTO_ERROR_INVALID_KEY_SIZE = -2,\n';
    code += '    CRYPTO_ERROR_INVALID_BLOCK_SIZE = -3,\n';
    code += '    CRYPTO_ERROR_INSUFFICIENT_BUFFER = -4,\n';
    code += '    CRYPTO_ERROR_NOT_IMPLEMENTED = -5,\n';
    code += '    CRYPTO_ERROR_MEMORY_ALLOCATION = -6\n';
    code += '} crypto_error_t;\n\n';

    // Basic algorithm context structure
    code += '/* Basic algorithm context structure */\n';
    code += 'typedef struct {\n';
    code += '    uint8_t *key;\n';
    code += '    size_t key_size;\n';
    code += '    uint8_t *iv;\n';
    code += '    size_t iv_size;\n';
    code += '    size_t block_size;\n';
    code += '    int is_initialized;\n';
    code += '} crypto_context_t;\n\n';

    // Algorithm framework structures
    code += '/* Algorithm framework structures */\n';
    code += 'typedef enum {\n';
    code += '    CATEGORY_BLOCK = 0,\n';
    code += '    CATEGORY_STREAM = 1,\n';
    code += '    CATEGORY_HASH = 2,\n';
    code += '    CATEGORY_ASYMMETRIC = 3,\n';
    code += '    CATEGORY_MAC = 4,\n';
    code += '    CATEGORY_KDF = 5,\n';
    code += '    CATEGORY_COMPRESSION = 6,\n';
    code += '    CATEGORY_ENCODING = 7,\n';
    code += '    CATEGORY_CLASSICAL = 8,\n';
    code += '    CATEGORY_ECC = 9,\n';
    code += '    CATEGORY_CHECKSUM = 10,\n';
    code += '    CATEGORY_SPECIAL = 11\n';
    code += '} category_type_e;\n\n';

    code += 'typedef enum {\n';
    code += '    SECURITY_SECURE = 0,\n';
    code += '    SECURITY_BROKEN = 1,\n';
    code += '    SECURITY_DEPRECATED = 2,\n';
    code += '    SECURITY_EXPERIMENTAL = 3,\n';
    code += '    SECURITY_EDUCATIONAL = 4,\n';
    code += '    SECURITY_OBSOLETE = 5\n';
    code += '} security_status_e;\n\n';

    code += 'typedef enum {\n';
    code += '    COMPLEXITY_BEGINNER = 0,\n';
    code += '    COMPLEXITY_INTERMEDIATE = 1,\n';
    code += '    COMPLEXITY_ADVANCED = 2,\n';
    code += '    COMPLEXITY_EXPERT = 3,\n';
    code += '    COMPLEXITY_RESEARCH = 4\n';
    code += '} complexity_type_e;\n\n';

    code += 'typedef struct {\n';
    code += '    size_t min_size;\n';
    code += '    size_t max_size;\n';
    code += '    size_t step_size;\n';
    code += '} key_size_t;\n\n';

    code += 'typedef struct {\n';
    code += '    const char *text;\n';
    code += '    const char *uri;\n';
    code += '} link_item_t;\n\n';

    code += 'typedef struct {\n';
    code += '    const char *text;\n';
    code += '    const char *uri;\n';
    code += '    const uint8_t *input;\n';
    code += '    size_t input_size;\n';
    code += '    const uint8_t *key;\n';
    code += '    size_t key_size;\n';
    code += '    const uint8_t *expected;\n';
    code += '    size_t expected_size;\n';
    code += '    const uint8_t *iv;\n';
    code += '    size_t iv_size;\n';
    code += '} test_case_t;\n\n';

    // Utility functions
    code += '/* Utility functions */\n';
    code += 'static inline crypto_error_t validate_key_size(size_t actual_size, const key_size_t *supported_sizes, size_t num_sizes) {\n';
    code += '    for (size_t i = 0; i < num_sizes; i++) {\n';
    code += '        if (actual_size >= supported_sizes[i].min_size && \n';
    code += '            actual_size <= supported_sizes[i].max_size &&\n';
    code += '            (actual_size - supported_sizes[i].min_size) % supported_sizes[i].step_size == 0) {\n';
    code += '            return CRYPTO_SUCCESS;\n';
    code += '        }\n';
    code += '    }\n';
    code += '    return CRYPTO_ERROR_INVALID_KEY_SIZE;\n';
    code += '}\n\n';

    code += 'static inline crypto_error_t validate_buffer_size(size_t required_size, size_t actual_size) {\n';
    code += '    return (actual_size >= required_size) ? CRYPTO_SUCCESS : CRYPTO_ERROR_INSUFFICIENT_BUFFER;\n';
    code += '}\n\n';

    code += 'static inline crypto_error_t crypto_context_init(crypto_context_t *ctx, \n';
    code += '                                                 const uint8_t *key, size_t key_size,\n';
    code += '                                                 const uint8_t *iv, size_t iv_size,\n';
    code += '                                                 size_t block_size) {\n';
    code += '    if (!ctx || !key) return CRYPTO_ERROR_INVALID_PARAMETER;\n';
    code += '    \n';
    code += '    ctx->key = malloc(key_size);\n';
    code += '    if (!ctx->key) return CRYPTO_ERROR_MEMORY_ALLOCATION;\n';
    code += '    memcpy(ctx->key, key, key_size);\n';
    code += '    ctx->key_size = key_size;\n';
    code += '    \n';
    code += '    if (iv && iv_size > 0) {\n';
    code += '        ctx->iv = malloc(iv_size);\n';
    code += '        if (!ctx->iv) {\n';
    code += '            free(ctx->key);\n';
    code += '            return CRYPTO_ERROR_MEMORY_ALLOCATION;\n';
    code += '        }\n';
    code += '        memcpy(ctx->iv, iv, iv_size);\n';
    code += '        ctx->iv_size = iv_size;\n';
    code += '    } else {\n';
    code += '        ctx->iv = NULL;\n';
    code += '        ctx->iv_size = 0;\n';
    code += '    }\n';
    code += '    \n';
    code += '    ctx->block_size = block_size;\n';
    code += '    ctx->is_initialized = 1;\n';
    code += '    return CRYPTO_SUCCESS;\n';
    code += '}\n\n';

    code += 'static inline void crypto_context_cleanup(crypto_context_t *ctx) {\n';
    code += '    if (ctx && ctx->is_initialized) {\n';
    code += '        if (ctx->key) {\n';
    code += '            secure_clear(ctx->key, ctx->key_size);\n';
    code += '            free(ctx->key);\n';
    code += '            ctx->key = NULL;\n';
    code += '        }\n';
    code += '        if (ctx->iv) {\n';
    code += '            secure_clear(ctx->iv, ctx->iv_size);\n';
    code += '            free(ctx->iv);\n';
    code += '            ctx->iv = NULL;\n';
    code += '        }\n';
    code += '        ctx->is_initialized = 0;\n';
    code += '    }\n';
    code += '}\n\n';

    // C11 static assertions for cryptographic constants
    if (options.useStaticAssert && (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23')) {
      code += '/* Compile-time assertions for cryptographic constants */\n';
      code += '_Static_assert(sizeof(uint8_t) == 1, "uint8_t must be 1 byte");\n';
      code += '_Static_assert(sizeof(uint16_t) == 2, "uint16_t must be 2 bytes");\n';
      code += '_Static_assert(sizeof(uint32_t) == 4, "uint32_t must be 4 bytes");\n';
      code += '_Static_assert(sizeof(uint64_t) == 8, "uint64_t must be 8 bytes");\n';
      code += '_Static_assert(CHAR_BIT == 8, "char must be 8 bits");\n\n';
    }

    // C11+ Generic selections for type-safe operations
    if (options.useGenericSelections && (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23')) {
      code += '/* Generic selections for type-safe operations */\n';
      code += '#define GENERIC_SWAP(x, y) _Generic((x), \\\n';
      code += '    int: swap_int, \\\n';
      code += '    uint8_t: swap_uint8, \\\n';
      code += '    uint16_t: swap_uint16, \\\n';
      code += '    uint32_t: swap_uint32, \\\n';
      code += '    uint64_t: swap_uint64, \\\n';
      code += '    default: swap_generic)(x, y)\n\n';

      code += '#define GENERIC_CLEAR(ptr) _Generic((ptr), \\\n';
      code += '    uint8_t*: clear_uint8_array, \\\n';
      code += '    uint16_t*: clear_uint16_array, \\\n';
      code += '    uint32_t*: clear_uint32_array, \\\n';
      code += '    uint64_t*: clear_uint64_array, \\\n';
      code += '    default: secure_clear)(ptr, sizeof(*(ptr)))\n\n';

      code += '#define GENERIC_MEMCMP(a, b, size) _Generic((a), \\\n';
      code += '    const uint8_t*: constant_time_memcmp, \\\n';
      code += '    const char*: constant_time_memcmp, \\\n';
      code += '    default: memcmp)(a, b, size)\n\n';

      // Add implementations for the generic functions
      code += '/* Implementation functions for generic selections */\n';
      code += 'static inline void swap_uint8(uint8_t *a, uint8_t *b) {\n';
      code += '    uint8_t temp = *a; *a = *b; *b = temp;\n';
      code += '}\n\n';

      code += 'static inline void swap_uint16(uint16_t *a, uint16_t *b) {\n';
      code += '    uint16_t temp = *a; *a = *b; *b = temp;\n';
      code += '}\n\n';

      code += 'static inline void swap_uint32(uint32_t *a, uint32_t *b) {\n';
      code += '    uint32_t temp = *a; *a = *b; *b = temp;\n';
      code += '}\n\n';

      code += 'static inline void swap_uint64(uint64_t *a, uint64_t *b) {\n';
      code += '    uint64_t temp = *a; *a = *b; *b = temp;\n';
      code += '}\n\n';

      code += '/* Array join utility function */\n';
      code += 'static inline char* join_array(const char** array, size_t length, const char* separator) {\n';
      code += '    if (!array || length == 0) return strdup("");\n';
      code += '    size_t sep_len = separator ? strlen(separator) : 0;\n';
      code += '    size_t total_len = 0;\n';
      code += '    for (size_t i = 0; i < length; i++) {\n';
      code += '        total_len += array[i] ? strlen(array[i]) : 0;\n';
      code += '        if (i < length - 1) total_len += sep_len;\n';
      code += '    }\n';
      code += '    char* result = malloc(total_len + 1);\n';
      code += '    if (!result) return NULL;\n';
      code += '    result[0] = \'\\0\';\n';
      code += '    for (size_t i = 0; i < length; i++) {\n';
      code += '        if (array[i]) strcat(result, array[i]);\n';
      code += '        if (i < length - 1 && separator) strcat(result, separator);\n';
      code += '    }\n';
      code += '    return result;\n';
      code += '}\n\n';

      code += '/* Constant-time memory comparison for cryptographic use */\n';
      code += 'static inline int constant_time_memcmp(const void *a, const void *b, size_t size) {\n';
      code += '    const uint8_t *pa = (const uint8_t*)a;\n';
      code += '    const uint8_t *pb = (const uint8_t*)b;\n';
      code += '    uint8_t result = 0;\n';
      code += '    for (size_t i = 0; i < size; i++) {\n';
      code += '        result |= pa[i] ^ pb[i];\n';
      code += '    }\n';
      code += '    return result;\n';
      code += '}\n\n';
    }

    // Memory alignment support (C11+)
    if (options.useAlignof && (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23')) {
      code += '/* Memory alignment utilities */\n';
      code += '#define CRYPTO_CACHE_LINE_SIZE 64\n';
      code += '#define ALIGN_TO_CACHE_LINE _Alignas(CRYPTO_CACHE_LINE_SIZE)\n';
      code += '#define ALIGN_TO_WORD _Alignas(_Alignof(uint64_t))\n\n';

      code += '/* Aligned memory allocation */\n';
      code += 'static inline void* aligned_malloc(size_t size, size_t alignment) {\n';
      code += '#ifdef _WIN32\n';
      code += '    return _aligned_malloc(size, alignment);\n';
      code += '#else\n';
      code += '    void *ptr;\n';
      code += '    if (posix_memalign(&ptr, alignment, size) == 0) {\n';
      code += '        return ptr;\n';
      code += '    }\n';
      code += '    return NULL;\n';
      code += '#endif\n';
      code += '}\n\n';

      code += 'static inline void aligned_free(void *ptr) {\n';
      code += '#ifdef _WIN32\n';
      code += '    _aligned_free(ptr);\n';
      code += '#else\n';
      code += '    free(ptr);\n';
      code += '#endif\n';
      code += '}\n\n';
    }

    // Thread-local storage support (C11+)
    if (options.useThreadLocal && (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23')) {
      code += '/* Thread-local storage for cryptographic contexts */\n';
      code += '_Thread_local crypto_context_t thread_crypto_context;\n';
      code += '_Thread_local uint8_t thread_crypto_buffer[4096];\n';
      code += '_Thread_local int thread_crypto_initialized = 0;\n\n';
    }

    // Atomic operations support (C11+)
    if (options.useAtomics && (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23')) {
      code += '/* Atomic operations for thread-safe cryptographic operations */\n';
      code += 'static _Atomic(uint64_t) crypto_operation_counter = ATOMIC_VAR_INIT(0);\n';
      code += 'static _Atomic(int) crypto_library_initialized = ATOMIC_VAR_INIT(0);\n\n';

      code += 'static inline uint64_t crypto_get_operation_count(void) {\n';
      code += '    return atomic_load(&crypto_operation_counter);\n';
      code += '}\n\n';

      code += 'static inline void crypto_increment_operation_count(void) {\n';
      code += '    atomic_fetch_add(&crypto_operation_counter, 1);\n';
      code += '}\n\n';

      code += 'static inline int crypto_is_library_initialized(void) {\n';
      code += '    return atomic_load(&crypto_library_initialized);\n';
      code += '}\n\n';

      code += 'static inline void crypto_mark_library_initialized(void) {\n';
      code += '    atomic_store(&crypto_library_initialized, 1);\n';
      code += '}\n\n';
    }

    code += '#endif /* CRYPTO_UTILS_H */\n\n';

    return code;
  }

  /**
   * Check if C compiler is available on the system
   * @private
   */
  _isCCompilerAvailable() {
    try {
      const { execSync } = require('child_process');
      
      // Try gcc first
      try {
        execSync('gcc --version', { 
          stdio: 'pipe', 
          timeout: 2000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'gcc';
      } catch (error) {
        // Try clang as fallback
        try {
          execSync('clang --version', { 
            stdio: 'pipe', 
            timeout: 2000,
            windowsHide: true  // Prevent Windows error dialogs
          });
          return 'clang';
        } catch (error2) {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation for C code
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      let braces = 0;
      let parentheses = 0;
      let brackets = 0;
      let inString = false;
      let inChar = false;
      let inComment = false;
      let inLineComment = false;
      let escaped = false;
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        
        // Handle string literals
        if (char === '"' && !escaped && !inChar && !inComment && !inLineComment) {
          inString = !inString;
          continue;
        }
        
        // Handle character literals
        if (char === "'" && !escaped && !inString && !inComment && !inLineComment) {
          inChar = !inChar;
          continue;
        }
        
        // Handle comments
        if (!inString && !inChar) {
          if (char === '/' && nextChar === '*' && !inLineComment) {
            inComment = true;
            i++; // Skip next character
            continue;
          }
          if (char === '*' && nextChar === '/' && inComment) {
            inComment = false;
            i++; // Skip next character
            continue;
          }
          if (char === '/' && nextChar === '/' && !inComment) {
            inLineComment = true;
            i++; // Skip next character
            continue;
          }
        }
        
        // Handle line endings for line comments
        if (char === '\n') {
          inLineComment = false;
        }
        
        // Track escape sequences
        if (char === '\\' && (inString || inChar)) {
          escaped = !escaped;
          continue;
        } else {
          escaped = false;
        }
        
        // Skip if inside string, character, or comment
        if (inString || inChar || inComment || inLineComment) {
          continue;
        }
        
        // Count brackets and braces
        switch (char) {
          case '{':
            braces++;
            break;
          case '}':
            braces--;
            if (braces < 0) return false;
            break;
          case '(':
            parentheses++;
            break;
          case ')':
            parentheses--;
            if (parentheses < 0) return false;
            break;
          case '[':
            brackets++;
            break;
          case ']':
            brackets--;
            if (brackets < 0) return false;
            break;
        }
      }
      
      return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inChar && !inComment;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate C code syntax using native compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if C compiler is available first
    const compiler = this._isCCompilerAvailable();
    if (!compiler) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'C compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_c_${Date.now()}.c`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the C code (syntax check only)
        const compilerFlags = compiler === 'gcc' ? '-fsyntax-only -std=c99' : '-fsyntax-only -std=c99';
        execSync(`${compiler} ${compilerFlags} "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: compiler,
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: compiler,
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'C compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get C compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'GCC/Clang',
      downloadUrl: 'https://gcc.gnu.org/ or https://clang.llvm.org/',
      installInstructions: [
        'Windows: Install MinGW-w64 from https://www.mingw-w64.org/ or Visual Studio Build Tools',
        'macOS: Install Xcode Command Line Tools with: xcode-select --install',
        'Ubuntu/Debian: sudo apt install build-essential',
        'CentOS/RHEL: sudo yum groupinstall "Development Tools"',
        'Verify installation with: gcc --version or clang --version'
      ].join('\n'),
      verifyCommand: 'gcc --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
      packageManager: 'System package manager or manual installation',
      documentation: 'https://gcc.gnu.org/onlinedocs/ or https://clang.llvm.org/docs/'
    };
  }
}

// Register the plugin
const cPlugin = new CPlugin();
LanguagePlugins.Add(cPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cPlugin;
}


})(); // End of IIFE