/**
 * C++ Language Plugin for Multi-Language Code Generation
 * Generates C++ code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let CppAST, CppEmitter, CppTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load new AST pipeline components
  try {
    CppAST = require('./CppAST.js');
    const emitterModule = require('./CppEmitter.js');
    CppEmitter = emitterModule.CppEmitter;
    const transformerModule = require('./CppTransformer.js');
    CppTransformer = transformerModule.CppTransformer;
  } catch (e) {
    // Pipeline components not available - will use legacy mode
    console.warn('C++ AST pipeline components not loaded:', e.message);
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  CppAST = window.CppAST;
  CppEmitter = window.CppEmitter;
  CppTransformer = window.CppTransformer;
}

/**
 * C++ Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class CppPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'C++';
    this.extension = 'cpp';
    this.icon = '🔧';
    this.description = 'C++ language code generator';
    this.mimeType = 'text/x-c++src';
    this.version = 'C++11/14/17/20';
    
    // C++-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      addComments: true,
      useNamespaces: true,
      cppStandard: 'cpp20', // cpp98, cpp03, cpp11, cpp14, cpp17, cpp20
      useSmartPointers: true,
      useModernSyntax: true,
      addHeaders: true,
      useConstexpr: true,
      useTemplates: true,
      useConcepts: true,
      useRanges: true,
      useSimd: false, // Enable SIMD optimizations
      useCoroutines: false, // Enable coroutines for async crypto
      useAstPipeline: true // Enable new AST pipeline by default
    };

    // Option metadata - defines enum choices
    this.optionsMeta = {
      cppStandard: {
        type: 'enum',
        choices: [
          { value: 'cpp98', label: 'C++98', description: 'ISO C++ 1998 standard' },
          { value: 'cpp03', label: 'C++03', description: 'ISO C++ 2003 standard' },
          { value: 'cpp11', label: 'C++11', description: 'ISO C++ 2011 with auto, lambdas, move semantics' },
          { value: 'cpp14', label: 'C++14', description: 'ISO C++ 2014 with generic lambdas' },
          { value: 'cpp17', label: 'C++17', description: 'ISO C++ 2017 with structured bindings' },
          { value: 'cpp20', label: 'C++20', description: 'ISO C++ 2020 with concepts, ranges, coroutines' },
          { value: 'cpp23', label: 'C++23', description: 'ISO C++ 2023 with modules, constexpr improvements' }
        ]
      },
      indent: {
        type: 'enum',
        choices: [
          { value: '  ', label: '2 Spaces' },
          { value: '    ', label: '4 Spaces' },
          { value: '\t', label: 'Tab' }
        ]
      }
    };

    // Option constraints
    this.optionConstraints = {
      useConcepts: {
        enabledWhen: { cppStandard: ['cpp20', 'cpp23'] },
        disabledReason: 'Concepts require C++20 or later'
      },
      useRanges: {
        enabledWhen: { cppStandard: ['cpp20', 'cpp23'] },
        disabledReason: 'Ranges require C++20 or later'
      },
      useCoroutines: {
        enabledWhen: { cppStandard: ['cpp20', 'cpp23'] },
        disabledReason: 'Coroutines require C++20 or later'
      },
      useConstexpr: {
        enabledWhen: { cppStandard: ['cpp11', 'cpp14', 'cpp17', 'cpp20', 'cpp23'] },
        disabledReason: 'constexpr requires C++11 or later'
      },
      useSmartPointers: {
        enabledWhen: { cppStandard: ['cpp11', 'cpp14', 'cpp17', 'cpp20', 'cpp23'] },
        disabledReason: 'Smart pointers require C++11 or later'
      }
    };

    // Internal state
    this.indentLevel = 0;
    this.includes = new Set();
    this.namespaces = new Set();
    this.declarations = [];
  }

  /**
   * Check if current C++ standard is at least the specified level
   * @private
   */
  _isStandardAtLeast(options, minStandard) {
    const current = options.cppStandard || 'cpp20';
    const levels = { 'cpp98': 1, 'cpp03': 2, 'cpp11': 3, 'cpp14': 4, 'cpp17': 5, 'cpp20': 6, 'cpp23': 7 };
    const minLevel = levels[minStandard] || 0;
    const currentLevel = levels[current] || 6;
    return currentLevel >= minLevel;
  }

  /**
   * Check if C++11 or later
   * @private
   */
  _isCpp11OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp11');
  }

  /**
   * Check if C++14 or later
   * @private
   */
  _isCpp14OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp14');
  }

  /**
   * Check if C++17 or later
   * @private
   */
  _isCpp17OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp17');
  }

  /**
   * Check if C++20 or later
   * @private
   */
  _isCpp20OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp20');
  }

  /**
   * Check if C++23 or later
   * @private
   */
  _isCpp23OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp23');
  }

  /**
   * Get auto keyword usage based on standard
   * @private
   */
  _supportsAuto(options) {
    return this._isCpp11OrLater(options);
  }

  /**
   * Get constexpr keyword based on standard
   * @private
   */
  _supportsConstexpr(options) {
    return this._isCpp11OrLater(options);
  }

  /**
   * Get extended constexpr (relaxed constexpr) based on standard
   * @private
   */
  _supportsExtendedConstexpr(options) {
    return this._isCpp14OrLater(options);
  }

  /**
   * Get if constexpr based on standard
   * @private
   */
  _supportsIfConstexpr(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get concepts support
   * @private
   */
  _supportsConcepts(options) {
    return this._isCpp20OrLater(options) && options.useConcepts;
  }

  /**
   * Get ranges support
   * @private
   */
  _supportsRanges(options) {
    return this._isCpp20OrLater(options) && options.useRanges;
  }

  /**
   * Get coroutines support
   * @private
   */
  _supportsCoroutines(options) {
    return this._isCpp20OrLater(options) && options.useCoroutines;
  }

  /**
   * Get modules support
   * @private
   */
  _supportsModules(options) {
    return this._isCpp20OrLater(options);
  }

  /**
   * Get lambda expression syntax based on standard
   * @private
   */
  _supportsLambdas(options) {
    return this._isCpp11OrLater(options);
  }

  /**
   * Get generic lambdas support
   * @private
   */
  _supportsGenericLambdas(options) {
    return this._isCpp14OrLater(options);
  }

  /**
   * Get structured bindings support
   * @private
   */
  _supportsStructuredBindings(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get init-statement in if/switch support
   * @private
   */
  _supportsInitStatementInIf(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get [[nodiscard]] attribute support
   * @private
   */
  _supportsNodiscard(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get [[likely]]/[[unlikely]] attribute support
   * @private
   */
  _supportsLikelyUnlikely(options) {
    return this._isCpp20OrLater(options);
  }

  /**
   * Get appropriate nullptr or NULL based on standard
   * @private
   */
  _getNullPtr(options) {
    return this._isCpp11OrLater(options) ? 'nullptr' : 'NULL';
  }

  /**
   * Get appropriate smart pointer type
   * @private
   */
  _getSmartPointerType(options, innerType) {
    if (!this._isCpp11OrLater(options) || !options.useSmartPointers) {
      return innerType + '*';
    }
    return 'std::unique_ptr<' + innerType + '>';
  }

  /**
   * Get appropriate array initialization syntax
   * @private
   */
  _getArrayInit(options, elements) {
    if (this._isCpp11OrLater(options)) {
      return '{' + elements + '}';  // C++11 initializer list
    }
    return '{' + elements + '}';  // Same syntax but different semantics
  }

  /**
   * Get for-each loop syntax based on standard
   * @private
   */
  _getForEachSyntax(options, varName, containerExpr, bodyCode) {
    if (this._isCpp11OrLater(options)) {
      const autoKw = this._supportsAuto(options) ? 'auto' : 'int';
      return `for (${autoKw}& ${varName} : ${containerExpr}) {\n${bodyCode}}\n`;
    }
    // Pre-C++11: use iterators
    return `for (std::vector<int>::iterator it = ${containerExpr}.begin(); it != ${containerExpr}.end(); ++it) {\n    int ${varName} = *it;\n${bodyCode}}\n`;
  }

  /**
   * Generate C++ code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Merge options
      const mergedOptions = { ...this.options, ...options };

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Check if new AST pipeline is requested and available
      if (mergedOptions.useAstPipeline && CppTransformer && CppEmitter) {
        return this._generateWithAstPipeline(ast, mergedOptions);
      }

      // Reset state for clean generation (legacy mode)
      this.indentLevel = 0;
      this.includes.clear();
      this.namespaces.clear();
      this.declarations = [];

      // Generate C++ code using legacy direct emission
      const code = this._generateNode(ast, mergedOptions);

      // Add headers, namespaces, and program structure
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
   * Generate C++ code using the new AST pipeline
   * Pipeline: JS AST -> C++ AST -> C++ Emitter -> C++ Source
   * @private
   */
  _generateWithAstPipeline(ast, options) {
    try {
      // Create transformer with options
      const transformer = new CppTransformer({
        namespace: options.namespace || 'generated',
        className: options.className || 'GeneratedClass',
        typeKnowledge: options.parser?.typeKnowledge || options.typeKnowledge
      });

      // Transform JS AST to C++ AST
      const cppAst = transformer.transform(ast);

      // Create emitter with formatting options
      const emitter = new CppEmitter({
        indent: options.indent || '    ',
        lineEnding: options.lineEnding || '\n',
        braceStyle: options.braceStyle || 'knr'
      });

      // Emit C++ source code
      const code = emitter.emit(cppAst);

      // Collect any warnings from transformation
      const warnings = transformer.warnings || [];

      return this.CreateSuccessResult(code, [], warnings);

    } catch (error) {
      return this.CreateErrorResult('AST pipeline generation failed: ' + error.message);
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
        return this._generateClass(node, options);
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

      // Array and Object expressions
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'Property':
        return this._generateProperty(node, options);

      // Function expressions
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);

      // Unary and logical expressions
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

      // Template literals
      case 'TemplateLiteral':
        return this._generateTemplateLiteral(node, options);
      case 'TaggedTemplateExpression':
        return this._generateTaggedTemplateExpression(node, options);

      // Control flow statements
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

      // Exception handling
      case 'TryStatement':
        return this._generateTryStatement(node, options);
      case 'CatchClause':
        return this._generateCatchClause(node, options);
      case 'ThrowStatement':
        return this._generateThrowStatement(node, options);

      // Other statements
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'DebuggerStatement':
        return this._generateDebuggerStatement(node, options);
      case 'WithStatement':
        return this._generateWithStatement(node, options);
      case 'LabeledStatement':
        return this._generateLabeledStatement(node, options);

      // Constructor and new expressions
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);

      // Async/await and yield
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);

      // Import/export
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ExportDefaultDeclaration':
      case 'ExportNamedDeclaration':
        return this._generateExportDeclaration(node, options);

      // Class expressions and properties
      case 'ClassExpression':
        return this._generateClassExpression(node, options);
      case 'PropertyDefinition':
        return this._generatePropertyDefinition(node, options);
      case 'PrivateIdentifier':
        return this._generatePrivateIdentifier(node, options);
      case 'StaticBlock':
        return this._generateStaticBlock(node, options);

      // Modern JavaScript features
      case 'ChainExpression':
        return this._generateChainExpression(node, options);
      case 'ImportExpression':
        return this._generateImportExpression(node, options);

      // Destructuring patterns
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
   * Generate function declaration
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? this._toCamelCase(node.id.name) : 'unnamedFunction';
    let code = '';

    // Function template (C++11+)
    if (this._isCpp11OrLater(options) && options.useTemplates) {
      code += this._indent('template<typename T = int>\n');
    }

    // Doxygen comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief ' + functionName + ' function\n');
      code += this._indent(' * @details Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach((param, index) => {
          const paramName = param.name || 'param' + index;
          code += this._indent(' * @param ' + paramName + ' Input parameter\n');
        });
      }
      code += this._indent(' * @return Result of the operation\n');
      if (this._isCpp11OrLater(options)) {
        code += this._indent(' * @throws std::exception On error conditions\n');
      }
      code += this._indent(' */\n');
    }

    // Function signature based on C++ standard
    let returnType = this._supportsAuto(options) ? 'auto' : 'int';

    // Apply constexpr if enabled and standard supports it
    let modifiers = '';
    if (options.useConstexpr && this._supportsConstexpr(options)) {
      modifiers += 'constexpr ';
    }

    // Apply [[nodiscard]] for C++17+
    if (this._supportsNodiscard(options)) {
      modifiers += '[[nodiscard]] ';
    }

    code += this._indent(modifiers + returnType + ' ' + functionName + '(');

    // Parameters with C++ types based on standard
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        let paramType;
        if (this._isCpp11OrLater(options) && options.useTemplates) {
          paramType = 'const T&';
        } else {
          paramType = 'int';
        }
        return paramType + ' ' + this._toCamelCase(paramName);
      });
      code += params.join(', ');
    }

    code += ')';

    // Trailing return type (C++11+)
    if (this._isCpp11OrLater(options) && returnType === 'auto') {
      code += ' -> int';
    }

    code += '\n';
    code += this._indent('{\n');
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      // Empty body is valid in C++
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
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
    const className = node.id ? this._toPascalCase(node.id.name) : 'UnnamedClass';
    let code = '';
    
    // Doxygen comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief ' + className + ' class\n');
      code += this._indent(' * @details Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
      code += this._indent(' * @author Auto-generated from JavaScript AST\n');
      code += this._indent(' * @version 1.0\n');
      code += this._indent(' */\n');
    }
    
    // Class declaration
    code += this._indent('class ' + className + '\n');
    code += this._indent('{\n');
    
    // Public section
    code += this._indent('public:\n');
    this.indentLevel++;
    
    // Constructor
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief Default constructor\n');
      code += this._indent(' */\n');
    }
    
    code += this._indent(className + '()');
    if (options.useModernSyntax) {
      code += ' = default;\n\n';
    } else {
      code += ' {}\n\n';
    }
    
    // Destructor
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief Virtual destructor\n');
      code += this._indent(' */\n');
    }
    
    code += this._indent('virtual ~' + className + '()');
    if (options.useModernSyntax) {
      code += ' = default;\n\n';
    } else {
      code += ' {}\n\n';
    }
    
    // Copy constructor and assignment operator (Rule of Three/Five)
    if (options.useModernSyntax) {
      code += this._indent('// Rule of Five\n');
      code += this._indent(className + '(const ' + className + '&) = default;\n');
      code += this._indent(className + '& operator=(const ' + className + '&) = default;\n');
      code += this._indent(className + '(' + className + '&&) = default;\n');
      code += this._indent(className + '& operator=(' + className + '&&) = default;\n\n');
    }
    
    // Generate methods from class body
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateMethod(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
      code += '\n';
    }
    
    // Private section
    this.indentLevel--;
    code += this._indent('private:\n');
    this.indentLevel++;
    
    // Member variables
    code += this._indent('int m_value{0}; ///< Member variable placeholder\n');
    if (options.useSmartPointers) {
      this.includes.add('memory');
      code += this._indent('std::unique_ptr<int> m_data; ///< Smart pointer example\n');
    }
    
    this.indentLevel--;
    code += this._indent('};\n');
    
    return code;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethod(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toCamelCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    const isStatic = node.static;
    let code = '';
    
    // Method comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief ' + (isConstructor ? 'Constructor' : methodName + ' method') + '\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach((param, index) => {
          const paramName = param.name || 'param' + index;
          code += this._indent(' * @param ' + paramName + ' Input parameter\n');
        });
      }
      if (!isConstructor) {
        code += this._indent(' * @return Result of the operation\n');
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    let signature = '';
    if (isStatic) {
      signature += 'static ';
    }
    
    if (isConstructor) {
      // Skip - constructor already handled in class generation
      return '';
    } else {
      if (options.useModernSyntax) {
        signature += 'auto ';
      } else {
        signature += 'int ';
      }
      signature += methodName + '(';
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = options.useModernSyntax ? 'const auto&' : 'int';
        return paramType + ' ' + this._toCamelCase(paramName);
      });
      signature += params.join(', ');
    }
    
    signature += ')';
    
    // Const qualifier for non-mutating methods
    if (!isStatic && methodName !== 'operator=') {
      signature += ' const';
    }
    
    // Trailing return type
    if (options.useModernSyntax && !isConstructor) {
      signature += ' -> int';
    }
    
    code += this._indent(signature + '\n');
    code += this._indent('{\n');
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      // Empty body is valid in C++
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
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
      return this._indent('{\n') +
             this._indent('    // Empty block\n') +
             this._indent('}\n');
    }

    let code = '';

    // Generate statements with proper indentation
    this.indentLevel++;
    const statements = node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim())
      .join('');
    this.indentLevel--;

    // Wrap in braces for proper C++ block syntax
    code += this._indent('{\n');
    code += statements;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate variable declaration
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';
    
    return node.declarations
      .map(decl => {
        const varName = decl.id ? this._toCamelCase(decl.id.name) : 'variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          
          if (options.useModernSyntax) {
            // Modern C++ auto with initialization
            return this._indent('auto ' + varName + ' = ' + initValue + ';\n');
          } else {
            return this._indent('int ' + varName + ' = ' + initValue + ';\n');
          }
        } else {
          const type = options.useModernSyntax ? 'int' : 'int';
          return this._indent(type + ' ' + varName + '{};\n');
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
    
    // C++ operators (mostly same as JavaScript)
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
   * Generate call expression with C++ optimizations
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle OpCodes calls
    if (node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'OpCodes') {
      const methodName = node.callee.property.name;
      return this._generateOpCodesCall(methodName, args, options);
    }

    // Handle special JavaScript methods
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const property = node.callee.property.name;

      switch (property) {
        case 'push':
          return `${object}.push_back(${args})`;
        case 'pop':
          return `${object}.pop_back()`;
        case 'length':
          return `${object}.size()`;
        case 'charAt':
          return `${object}[${args}]`;
        case 'charCodeAt':
          return `static_cast<int>(${object}[${args}])`;
        case 'substring':
        case 'substr':
          return `${object}.substr(${args})`;
        case 'indexOf':
          this.includes.add('#include <algorithm>');
          return `std::find(${object}.begin(), ${object}.end(), ${args}) - ${object}.begin()`;
        case 'toUpperCase':
          this.includes.add('#include <algorithm>');
          this.includes.add('#include <cctype>');
          return `[&]() { std::string result = ${object}; std::transform(result.begin(), result.end(), result.begin(), ::toupper); return result; }()`;
        case 'toLowerCase':
          this.includes.add('#include <algorithm>');
          this.includes.add('#include <cctype>');
          return `[&]() { std::string result = ${object}; std::transform(result.begin(), result.end(), result.begin(), ::tolower); return result; }()`;
        case 'split':
          return `split(${object}, ${args})`; // Custom utility function needed
        case 'join':
          this.includes.add('#include <algorithm>');
          this.includes.add('#include <iterator>');
          return `[&]() { std::ostringstream oss; std::copy(${object}.begin(), ${object}.end(), std::ostream_iterator<std::string>(oss, ${args})); return oss.str(); }()`;
        case 'slice':
          return `${object}.substr(${args})`;
        case 'toString':
          this.includes.add('#include <string>');
          return `std::to_string(${object})`;
        default:
          return `${callee}(${args})`;
      }
    }

    // Handle constructor calls
    if (node.callee.type === 'Identifier') {
      switch (node.callee.name) {
        case 'Array':
          this.includes.add('#include <vector>');
          return `std::vector<int>{${args}}`;
        case 'Object':
          this.includes.add('#include <unordered_map>');
          return 'std::unordered_map<std::string, int>{}';
        case 'String':
          return `std::string{${args}}`;
        case 'Number':
          return `static_cast<double>(${args})`;
      }
    }

    return `${callee}(${args})`;
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      '[' + this._generateNode(node.property, options) + ']' : 
      '.' + this._toCamelCase(node.property.name || node.property);
    
    return object + property;
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
    return this._toCamelCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    } else if (node.value === null) {
      return 'nullptr';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to camelCase (C++ method convention)
   * @private
   */
  _toCamelCase(str) {
    if (!str) return str;
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
  }

  /**
   * Convert to PascalCase (C++ class convention)
   * @private
   */
  _toPascalCase(str) {
    if (!str) return str;
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase()).replace(/\s+/g, '');
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
      result += ' * @file generated.cpp\n';
      result += ' * @brief Generated C++ code\n';
      result += ' * @details This file was automatically generated from JavaScript AST\n';
      result += ' * @standard ' + options.cppStandard.replace('cpp', 'C++') + '\n';
      result += ' * @compiler GCC/Clang/MSVC compatible\n';
      result += ' * @author Auto-generated\n';
      result += ' * @date Generated at runtime\n';
      result += ' */\n\n';
    }

    // Add includes only if addHeaders is enabled
    if (options.addHeaders) {
      // Standard includes
      this.includes.add('iostream');
      this.includes.add('string');
      this.includes.add('vector');
      this.includes.add('algorithm');

      if (options.useSmartPointers) {
        this.includes.add('memory');
      }

      if (options.useModernSyntax) {
        this.includes.add('type_traits');
        this.includes.add('utility');
      }

      // Add includes
      for (const include of this.includes) {
        result += '#include <' + include + '>\n';
      }
      result += '\n';
    }
    
    // Using namespace (if enabled)
    if (options.useNamespaces) {
      result += 'using namespace std;\n\n';
    }
    
    // Generated code
    result += code;
    
    // Main function
    result += '\n\n/**\n';
    result += ' * @brief Main function\n';
    result += ' * @details Entry point for the program\n';
    result += ' * @param argc Number of command line arguments\n';
    result += ' * @param argv Array of command line arguments\n';
    result += ' * @return Exit status\n';
    result += ' */\n';
    result += 'int main(int argc, char* argv[])\n';
    result += '{\n';
    if (options.useModernSyntax) {
      result += '    // Modern C++ main with unused parameter attributes\n';
      result += '    [[maybe_unused]] auto argumentCount = argc;\n';
      result += '    [[maybe_unused]] auto arguments = argv;\n\n';
    }
    
    result += '    ' + (options.useNamespaces ? '' : 'std::') + 'cout << "Generated C++ code execution" << ' + (options.useNamespaces ? '' : 'std::') + 'endl;\n';
    
    if (options.useModernSyntax) {
      result += '    return EXIT_SUCCESS;\n';
    } else {
      result += '    return 0;\n';
    }
    result += '}\n';
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Standard C++ library headers
    dependencies.push('iostream');
    dependencies.push('string');
    dependencies.push('vector');
    dependencies.push('algorithm');
    
    if (options.useSmartPointers) {
      dependencies.push('memory');
    }
    
    if (options.useModernSyntax) {
      dependencies.push('type_traits');
      dependencies.push('utility');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // C++-specific warnings
    warnings.push('Consider using RAII for resource management');
    warnings.push('Use const-correctness for better code safety');
    warnings.push('Consider exception safety (basic, strong, no-throw)');
    warnings.push('Use smart pointers instead of raw pointers when appropriate');
    warnings.push('Enable compiler warnings (-Wall -Wextra -Wpedantic)');
    warnings.push('Consider using static analysis tools (Clang-tidy, PVS-Studio)');

    if (options.useModernSyntax) {
      warnings.push('Modern C++ features may require C++11 or later compiler support');
    }

    return warnings;
  }

  /**
   * Generate OpCodes method call with C++ crypto optimizations
   * @private
   */
  _generateOpCodesCall(methodName, args, options) {
    // Map OpCodes methods to C++ equivalents with optimizations
    switch (methodName) {
      case 'Pack32LE':
        this.includes.add('#include <cstring>');
        this.includes.add('#include <cstdint>');
        return `[&]() { uint32_t val = ${args}; uint8_t result[4]; std::memcpy(result, &val, 4); return *reinterpret_cast<uint32_t*>(result); }()`;
      case 'Pack32BE':
        this.includes.add('#include <cstring>');
        this.includes.add('#include <cstdint>');
        this.includes.add('#include <bit>');
        return `std::byteswap(static_cast<uint32_t>(${args}))`;
      case 'Unpack32LE':
        this.includes.add('#include <cstring>');
        this.includes.add('#include <cstdint>');
        return `[&]() { uint32_t result; std::memcpy(&result, ${args}, 4); return result; }()`;
      case 'Unpack32BE':
        this.includes.add('#include <bit>');
        this.includes.add('#include <cstdint>');
        return `std::byteswap(*reinterpret_cast<const uint32_t*>(${args}))`;
      case 'RotL32':
        this.includes.add('#include <bit>');
        return `std::rotl(static_cast<uint32_t>(${args}))`;
      case 'RotR32':
        this.includes.add('#include <bit>');
        return `std::rotr(static_cast<uint32_t>(${args}))`;
      case 'XorArrays':
        this.includes.add('#include <algorithm>');
        if (options.useRanges && options.cppStandard === 'cpp20') {
          this.includes.add('#include <ranges>');
          return `[&]() { auto [a, b] = std::make_tuple(${args}); std::ranges::transform(a, b, a.begin(), std::bit_xor<>{}); return a; }()`;
        } else {
          return `[&]() { auto [a, b] = std::make_tuple(${args}); std::transform(a.begin(), a.end(), b.begin(), a.begin(), std::bit_xor<>{}); return a; }()`;
        }
      case 'ClearArray':
        this.includes.add('#include <cstring>');
        return `std::memset(${args}, 0, sizeof(${args}))`;
      case 'Hex8ToBytes':
        return `hexToBytes(${args})`; // Custom utility function
      case 'BytesToHex8':
        return `bytesToHex(${args})`; // Custom utility function
      case 'AnsiToBytes':
        this.includes.add('#include <string>');
        this.includes.add('#include <vector>');
        return `std::vector<uint8_t>(${args}.begin(), ${args}.end())`;
      default:
        return `OpCodes::${methodName}(${args})`;
    }
  }

  /**
   * Infer C++ type from JavaScript AST value with crypto context
   * @private
   */
  _inferCppType(node, context = {}) {
    if (!node) return 'auto';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'std::string';
        if (typeof node.value === 'number') {
          if (Number.isInteger(node.value)) {
            return node.value >= 0 && node.value <= 255 ? 'uint8_t' :
                   node.value >= -2147483648 && node.value <= 2147483647 ? 'int32_t' : 'int64_t';
          }
          return 'double';
        }
        if (typeof node.value === 'boolean') return 'bool';
        if (node.value === null) return 'std::nullptr_t';
        break;
      case 'ArrayExpression':
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null);
          if (firstElement && this._isLikelyByteValue(firstElement)) {
            return 'std::array<uint8_t, ' + node.elements.length + '>';
          }
          const elementType = this._inferCppType(firstElement, context);
          return `std::vector<${elementType}>`;
        }
        return context.isCryptographic ? 'std::vector<uint8_t>' : 'std::vector<int>';
      case 'ObjectExpression':
        return context.isCryptographic ? 'std::unordered_map<std::string, uint32_t>' : 'std::unordered_map<std::string, std::any>';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'std::function<auto()>';
    }

    // Crypto-specific type inference
    if (context.isCryptographic) {
      if (context.isKey) return 'std::vector<uint8_t>';
      if (context.isIV) return 'std::array<uint8_t, 16>';
      if (context.isState) return 'std::array<uint32_t, 16>';
      return 'uint32_t';
    }

    return 'auto';
  }

  /**
   * Check if a value is likely a byte value for crypto contexts
   * @private
   */
  _isLikelyByteValue(node) {
    if (node.type === 'Literal' && typeof node.value === 'number') {
      return node.value >= 0 && node.value <= 255;
    }
    return false;
  }

  /**
   * Generate C++ template specialization for crypto operations
   * @private
   */
  _generateCryptoTemplate(operation, options) {
    let template = '';

    switch (operation) {
      case 'BlockCipher':
        template += 'template<size_t BlockSize, size_t KeySize>\n';
        template += 'class BlockCipher {\n';
        template += '    static_assert(BlockSize > 0 && KeySize > 0);\n';
        template += 'public:\n';
        template += '    using block_t = std::array<uint8_t, BlockSize>;\n';
        template += '    using key_t = std::array<uint8_t, KeySize>;\n';
        template += '};\n';
        break;
      case 'HashFunction':
        template += 'template<size_t DigestSize>\n';
        template += 'class HashFunction {\n';
        template += '    static_assert(DigestSize > 0);\n';
        template += 'public:\n';
        template += '    using digest_t = std::array<uint8_t, DigestSize>;\n';
        template += '};\n';
        break;
    }

    return template;
  }

  /**
   * Generate C++ concepts for type constraints (C++20)
   * @private
   */
  _generateCryptoConcepts(options) {
    if (!options.useConcepts || options.cppStandard !== 'cpp20') return '';

    let concepts = '';
    this.includes.add('#include <concepts>');
    this.includes.add('#include <type_traits>');

    concepts += 'template<typename T>\n';
    concepts += 'concept CryptoKey = requires(T t) {\n';
    concepts += '    { t.data() } -> std::same_as<const uint8_t*>;\n';
    concepts += '    { t.size() } -> std::same_as<size_t>;\n';
    concepts += '};\n\n';

    concepts += 'template<typename T>\n';
    concepts += 'concept CryptoBlock = std::is_trivially_copyable_v<T> && sizeof(T) > 0;\n\n';

    return concepts;
  }

  /**
   * Generate C++ crypto utility functions
   * @private
   */
  _generateCryptoUtilities(options) {
    let utilities = '';

    // Hex conversion utilities
    this.includes.add('#include <string>');
    this.includes.add('#include <vector>');
    this.includes.add('#include <iomanip>');
    this.includes.add('#include <sstream>');

    utilities += '// Crypto utility functions\n';
    utilities += 'inline std::vector<uint8_t> hexToBytes(const std::string& hex) {\n';
    utilities += '    std::vector<uint8_t> bytes;\n';
    utilities += '    for (size_t i = 0; i < hex.length(); i += 2) {\n';
    utilities += '        auto byteString = hex.substr(i, 2);\n';
    utilities += '        bytes.push_back(static_cast<uint8_t>(std::stoi(byteString, nullptr, 16)));\n';
    utilities += '    }\n';
    utilities += '    return bytes;\n';
    utilities += '}\n\n';

    utilities += 'inline std::string bytesToHex(const std::vector<uint8_t>& bytes) {\n';
    utilities += '    std::ostringstream oss;\n';
    utilities += '    for (auto byte : bytes) {\n';
    utilities += '        oss << std::hex << std::setw(2) << std::setfill(\'0\') << static_cast<int>(byte);\n';
    utilities += '    }\n';
    utilities += '    return oss.str();\n';
    utilities += '}\n\n';

    // SIMD operations for crypto
    if (options.useSimd) {
      this.includes.add('#include <immintrin.h>');
      utilities += '// SIMD-optimized XOR operation\n';
      utilities += 'inline void xorBlocks(uint8_t* dest, const uint8_t* src1, const uint8_t* src2, size_t length) {\n';
      utilities += '    const size_t simdLength = length & ~15; // 16-byte aligned\n';
      utilities += '    for (size_t i = 0; i < simdLength; i += 16) {\n';
      utilities += '        __m128i a = _mm_loadu_si128(reinterpret_cast<const __m128i*>(src1 + i));\n';
      utilities += '        __m128i b = _mm_loadu_si128(reinterpret_cast<const __m128i*>(src2 + i));\n';
      utilities += '        __m128i result = _mm_xor_si128(a, b);\n';
      utilities += '        _mm_storeu_si128(reinterpret_cast<__m128i*>(dest + i), result);\n';
      utilities += '    }\n';
      utilities += '    for (size_t i = simdLength; i < length; ++i) {\n';
      utilities += '        dest[i] = src1[i] ^ src2[i];\n';
      utilities += '    }\n';
      utilities += '}\n\n';
    }

    return utilities;
  }

  /**
   * Generate missing AST node types for modern C++
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return 'std::vector<int>{}';
    }

    // Determine array type based on elements
    const firstElement = node.elements.find(el => el !== null);
    const elementType = this._inferCppType(firstElement, { isCryptographic: true });

    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '0')
      .join(', ');

    if (this._isLikelyByteValue(firstElement) || elementType.includes('uint8_t')) {
      return `std::array<uint8_t, ${node.elements.length}>{${elements}}`;
    }

    return `std::vector<${elementType.replace('std::', '')}>{${elements}}`;
  }

  _generateObjectExpression(node, options) {
    this.includes.add('#include <unordered_map>');
    this.includes.add('#include <string>');

    if (!node.properties || node.properties.length === 0) {
      return 'std::unordered_map<std::string, int>{}';
    }

    const properties = node.properties
      .map(prop => this._generateProperty(prop, options))
      .join(', ');

    return `std::unordered_map<std::string, auto>{${properties}}`;
  }

  _generateProperty(node, options) {
    const key = this._generateNode(node.key, options);
    const value = this._generateNode(node.value, options);
    return `{${key}, ${value}}`;
  }

  _generateFunctionExpression(node, options) {
    this.includes.add('#include <functional>');

    let params = '';
    if (node.params && node.params.length > 0) {
      params = node.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = 'auto';
        return `${paramType} ${paramName}`;
      }).join(', ');
    }

    const body = node.body ? this._generateNode(node.body, options) : 'return;';
    return `[&](${params}) ${body}`;
  }

  _generateArrowFunctionExpression(node, options) {
    return this._generateFunctionExpression(node, options);
  }

  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle smart pointers for modern C++
    if (options.useSmartPointers) {
      this.includes.add('#include <memory>');
      return `std::make_unique<${callee}>(${args})`;
    }

    return `new ${callee}(${args})`;
  }

  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    switch (operator) {
      case 'typeof':
        this.includes.add('#include <typeinfo>');
        return `typeid(${argument}).name()`;
      case 'delete':
        return options.useSmartPointers ? `${argument}.reset()` : `delete ${argument}`;
      case 'void':
        return `static_cast<void>(${argument})`;
      case '!':
        return `!${argument}`;
      case '~':
        return `~${argument}`;
      case '+':
        return `+${argument}`;
      case '-':
        return `-${argument}`;
      default:
        return `${operator}${argument}`;
    }
  }

  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (node.prefix) {
      return `${operator}${argument}`;
    } else {
      return `${argument}${operator}`;
    }
  }

  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;

    switch (operator) {
      case '||':
        operator = '||';
        break;
      case '&&':
        operator = '&&';
        break;
      case '??':
        // C++ doesn't have null-coalescing operator, use ternary
        return `(${left} ? ${left} : ${right})`;
    }

    return `${left} ${operator} ${right}`;
  }

  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `${test} ? ${consequent} : ${alternate}`;
  }

  _generateSequenceExpression(node, options) {
    const expressions = node.expressions
      .map(expr => this._generateNode(expr, options))
      .join(', ');
    return `(${expressions})`;
  }

  _generateTemplateLiteral(node, options) {
    this.includes.add('#include <string>');
    this.includes.add('#include <sstream>');

    let result = 'std::string{';

    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      if (quasi.value && quasi.value.cooked) {
        result += `"${quasi.value.cooked}"`;
      }

      if (i < node.expressions.length) {
        const expression = this._generateNode(node.expressions[i], options);
        result += ` + std::to_string(${expression})`;
      }
    }

    result += '}';
    return result;
  }

  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const template = this._generateTemplateLiteral(node.quasi, options);
    return `${tag}(${template})`;
  }

  _generateIfStatement(node, options) {
    let code = '';
    const test = this._generateNode(node.test, options);

    code += this._indent(`if (${test}) {\n`);
    this.indentLevel++;

    if (node.consequent) {
      const consequent = this._generateNode(node.consequent, options);
      code += consequent || this._indent('// Empty if body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        code += this._indent('else ');
        code += this._generateIfStatement(node.alternate, options).replace(/^\s+/, '');
      } else {
        code += this._indent('else {\n');
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate || this._indent('// Empty else body\n');
        this.indentLevel--;
        code += this._indent('}\n');
      }
    }

    return code;
  }

  _generateWhileStatement(node, options) {
    let code = '';
    const test = this._generateNode(node.test, options);

    code += this._indent(`while (${test}) {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty while body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateForStatement(node, options) {
    let code = '';
    const init = node.init ? this._generateNode(node.init, options).replace(/;\s*$/, '') : '';
    const test = node.test ? this._generateNode(node.test, options) : '';
    const update = node.update ? this._generateNode(node.update, options) : '';

    code += this._indent(`for (${init}; ${test}; ${update}) {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateForInStatement(node, options) {
    this.includes.add('#include <algorithm>');
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for (const auto& ${left.replace(/^(int|auto)\s+/, '')} : ${right}) {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for-in body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateForOfStatement(node, options) {
    return this._generateForInStatement(node, options); // Same in C++
  }

  _generateDoWhileStatement(node, options) {
    let code = this._indent('do {\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty do-while body\n');
    }

    this.indentLevel--;
    const test = this._generateNode(node.test, options);
    code += this._indent(`} while (${test});\n`);
    return code;
  }

  _generateSwitchStatement(node, options) {
    let code = '';
    const discriminant = this._generateNode(node.discriminant, options);

    code += this._indent(`switch (${discriminant}) {\n`);
    this.indentLevel++;

    if (node.cases) {
      for (const caseNode of node.cases) {
        code += this._generateSwitchCase(caseNode, options);
      }
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateSwitchCase(node, options) {
    let code = '';

    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += this._indent(`case ${test}:\n`);
    } else {
      code += this._indent('default:\n');
    }

    this.indentLevel++;
    if (node.consequent) {
      for (const stmt of node.consequent) {
        code += this._generateNode(stmt, options);
      }
    }
    this.indentLevel--;

    return code;
  }

  _generateBreakStatement(node, options) {
    return this._indent('break;\n');
  }

  _generateContinueStatement(node, options) {
    return this._indent('continue;\n');
  }

  _generateTryStatement(node, options) {
    let code = this._indent('try {\n');
    this.indentLevel++;

    if (node.block) {
      const block = this._generateNode(node.block, options);
      code += block || this._indent('// Empty try block\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    if (node.handler) {
      code += this._generateCatchClause(node.handler, options);
    }

    if (node.finalizer) {
      code += this._indent('// Finally not directly supported in C++\n');
      code += this._generateNode(node.finalizer, options);
    }

    return code;
  }

  _generateCatchClause(node, options) {
    let code = this._indent('catch');

    if (node.param) {
      const param = this._generateNode(node.param, options);
      code += ` (const std::exception& ${param})`;
    } else {
      code += ' (...)';
    }

    code += ' {\n';
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty catch block\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateThrowStatement(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return this._indent(`throw ${argument};\n`);
    } else {
      return this._indent('throw;\n');
    }
  }

  _generateEmptyStatement(node, options) {
    return this._indent(';\n');
  }

  _generateDebuggerStatement(node, options) {
    return this._indent('// Debugger statement\n');
  }

  _generateWithStatement(node, options) {
    return this._indent('// With statement not supported in C++\n');
  }

  _generateLabeledStatement(node, options) {
    const label = this._generateNode(node.label, options);
    const body = this._generateNode(node.body, options);
    return `${label}:\n${body}`;
  }

  _generateMetaProperty(node, options) {
    return `// MetaProperty: ${node.meta?.name || 'unknown'}.${node.property?.name || 'unknown'}`;
  }

  _generateAwaitExpression(node, options) {
    if (options.useCoroutines) {
      this.includes.add('#include <coroutine>');
      const argument = this._generateNode(node.argument, options);
      return `co_await ${argument}`;
    }
    const argument = this._generateNode(node.argument, options);
    return `${argument}.get()`; // Assume future-like object
  }

  _generateYieldExpression(node, options) {
    if (options.useCoroutines) {
      this.includes.add('#include <coroutine>');
      const argument = node.argument ? this._generateNode(node.argument, options) : '';
      return node.delegate ? `co_yield* ${argument}` : `co_yield ${argument}`;
    }
    return `// Yield not supported without coroutines`;
  }

  _generateImportDeclaration(node, options) {
    const source = this._generateNode(node.source, options);
    const cleanSource = source.replace(/["']/g, '');
    this.includes.add(`#include "${cleanSource}.h"`);
    return this._indent(`// import ${source};\n`);
  }

  _generateExportDeclaration(node, options) {
    // C++ uses headers for exports
    const declaration = this._generateNode(node.declaration, options);
    return declaration; // Already public in header
  }

  _generateClassExpression(node, options) {
    return this._generateClass(node, options);
  }

  _generatePropertyDefinition(node, options) {
    const key = this._generateNode(node.key, options);
    const value = node.value ? this._generateNode(node.value, options) : '{}';
    const type = this._inferCppType(node.value, { isCryptographic: true });
    const modifier = node.static ? 'static ' : '';
    const access = 'private'; // Default to private in C++
    return this._indent(`${access}: ${modifier}${type} ${key} = ${value};\n`);
  }

  _generatePrivateIdentifier(node, options) {
    return `m_${node.name}`; // Use m_ prefix for private members
  }

  _generateStaticBlock(node, options) {
    // C++ doesn't have static blocks, simulate with static member
    return this._indent('// Static block not directly supported in C++\n');
  }

  _generateChainExpression(node, options) {
    // C++ doesn't have optional chaining, use conditional
    const expr = this._generateNode(node.expression, options);
    return expr; // Simplified
  }

  _generateImportExpression(node, options) {
    // C++ doesn't have dynamic imports
    const source = this._generateNode(node.source, options);
    return `/* Dynamic import not supported: ${source} */`;
  }

  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `...${argument}`; // C++11 variadic templates
  }

  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `...${argument}`;
  }

  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} = ${right}`;
  }

  _generateObjectPattern(node, options) {
    this.includes.add('#include <tuple>');
    const properties = node.properties
      .map(prop => this._generateNode(prop, options))
      .join(', ');
    return `std::tie(${properties})`;
  }

  _generateArrayPattern(node, options) {
    this.includes.add('#include <tuple>');
    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '_')
      .join(', ');
    return `std::tie(${elements})`;
  }

  _generateVariableDeclarator(node, options) {
    const id = this._generateNode(node.id, options);
    if (node.init) {
      const init = this._generateNode(node.init, options);
      return `${id} = ${init}`;
    }
    return id;
  }

  _generateFallbackNode(node, options) {
    // Enhanced fallback for unknown node types
    if (node.type && node.type.startsWith('TS')) {
      return `/* TypeScript node: ${node.type} */`;
    }

    // Try to handle common patterns
    if (node.operator && node.left && node.right) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);
      return `${left} ${node.operator} ${right}`;
    }

    // Generate minimal valid C++ stub with warning
    return `{\n${this._indent('// WARNING: Unhandled AST node type: ' + node.type + '\n')}${this._indent('throw std::runtime_error("Not implemented: ' + node.type + '");\n')}}`;
  }

  /**
   * Check if C++ compiler is available on the system
   * @private
   */
  _isCppCompilerAvailable() {
    const compilers = [
      { cmd: 'g++', name: 'gcc' },
      { cmd: 'clang++', name: 'clang' },
      { cmd: 'cl', name: 'msvc' }
    ];

    try {
      const { execSync } = require('child_process');
      
      for (const compiler of compilers) {
        try {
          if (compiler.cmd === 'cl') {
            // MSVC compiler check
            execSync('cl 2>&1', { 
              stdio: 'pipe', 
              timeout: 1000,
              windowsHide: true
            });
          } else {
            // GCC/Clang compiler check
            execSync(`${compiler.cmd} --version`, { 
              stdio: 'pipe', 
              timeout: 1000,
              windowsHide: true
            });
          }
          return compiler.name;
        } catch (error) {
          // Continue to next compiler
          continue;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
      const opening = Object.keys(pairs);
      const closing = Object.values(pairs);
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        // Skip string literals
        if (char === '"') {
          i++; // Skip opening quote
          while (i < code.length && code[i] !== '"') {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        // Skip character literals
        if (char === "'") {
          i++; // Skip opening quote
          while (i < code.length && code[i] !== "'") {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        // Skip single-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        
        // Skip multi-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '*') {
          i += 2;
          while (i < code.length - 1) {
            if (code[i] === '*' && code[i + 1] === '/') {
              i += 2;
              break;
            }
            i++;
          }
          continue;
        }
        
        if (opening.includes(char)) {
          // Special handling for < in C++ - only count as opening if it looks like a template
          if (char === '<') {
            // Simple heuristic: check if this could be a template parameter
            const nextChars = code.slice(i + 1, i + 10);
            if (!/^[A-Za-z_]/.test(nextChars)) continue;
          }
          stack.push(char);
        } else if (closing.includes(char)) {
          if (char === '>') {
            // Only match > with < if we have an unmatched <
            if (stack.length === 0 || stack[stack.length - 1] !== '<') continue;
          }
          if (stack.length === 0) return false;
          const lastOpening = stack.pop();
          if (pairs[lastOpening] !== char) return false;
        }
      }
      
      return stack.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate C++ code syntax using available compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if C++ compiler is available first
    const cppCompiler = this._isCppCompilerAvailable();
    if (!cppCompiler) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'C++ compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_cpp_${Date.now()}.cpp`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Wrap code in a basic program structure if needed
      let cppCode = code;
      if (!code.includes('#include') && !code.includes('int main')) {
        cppCode = `#include <iostream>\n#include <string>\nusing namespace std;\n\n${code}\n\nint main() { return 0; }`;
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, cppCode);
      
      try {
        let compileCommand;
        const objFile = tempFile.replace('.cpp', '.o');
        const exeFile = tempFile.replace('.cpp', '.exe');
        
        // Choose compile command based on available compiler
        switch (cppCompiler) {
          case 'gcc':
            compileCommand = `g++ -fsyntax-only -std=c++17 -Wall -Wextra -pedantic "${tempFile}"`;
            break;
          case 'clang':
            compileCommand = `clang++ -fsyntax-only -std=c++17 -Wall -Wextra -pedantic "${tempFile}"`;
            break;
          case 'msvc':
            compileCommand = `cl /c /EHsc /std:c++17 "${tempFile}"`;
            break;
          default:
            throw new Error('Unknown compiler type');
        }
        
        // Try to compile the C++ code
        execSync(compileCommand, { 
          stdio: 'pipe',
          timeout: 3000,
          cwd: path.dirname(tempFile),
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up files
        [tempFile, objFile, exeFile].forEach(file => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
          }
        });
        
        return {
          success: true,
          method: cppCompiler,
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        const objFile = tempFile.replace('.cpp', '.o');
        const exeFile = tempFile.replace('.cpp', '.exe');
        [tempFile, objFile, exeFile].forEach(file => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
          }
        });
        
        return {
          success: false,
          method: cppCompiler,
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If C++ compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'C++ compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get C++ compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'C++ Compiler',
      downloadUrl: 'https://gcc.gnu.org/ or https://clang.llvm.org/',
      installInstructions: [
        'GCC: Download from https://gcc.gnu.org/ or use package manager',
        'Clang: Download from https://clang.llvm.org/',
        'Windows: Install MinGW-w64, MSYS2, or Visual Studio',
        'Linux: sudo apt install g++ (Ubuntu) or equivalent',
        'macOS: Install Xcode Command Line Tools',
        'Verify installation with: g++ --version or clang++ --version'
      ].join('\n'),
      verifyCommand: 'g++ --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with C++ templates)',
      packageManager: 'Conan/vcpkg',
      documentation: 'https://en.cppreference.com/'
    };
  }
}

// Register the plugin
const cppPlugin = new CppPlugin();
LanguagePlugins.Add(cppPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cppPlugin;
}


})(); // End of IIFE