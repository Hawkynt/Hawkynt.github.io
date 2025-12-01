/**
 * JavaScript Language Plugin for Multi-Language Code Generation
 * Generates modern JavaScript (ES2020+) code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let JavaScriptAST, JavaScriptEmitter, JavaScriptTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load new AST pipeline components
  try {
    JavaScriptAST = require('./JavaScriptAST.js');
    const emitterModule = require('./JavaScriptEmitter.js');
    JavaScriptEmitter = emitterModule.JavaScriptEmitter;
    const transformerModule = require('./JavaScriptTransformer.js');
    JavaScriptTransformer = transformerModule.JavaScriptTransformer;
  } catch (e) {
    // Pipeline components not available - will use legacy mode
    console.warn('JavaScript AST pipeline components not loaded:', e.message);
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  JavaScriptAST = window.JavaScriptAST;
  JavaScriptEmitter = window.JavaScriptEmitter;
  JavaScriptTransformer = window.JavaScriptTransformer;
}

/**
 * JavaScript Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class JavaScriptPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'JavaScript';
    this.extension = 'js';
    this.icon = '💛';
    this.description = 'JavaScript code generator with ECMAScript version targeting (ES3 to ESNext)';
    this.mimeType = 'text/javascript';
    this.version = 'ES3-ESNext';
    
    // JavaScript-specific options
    this.options = {
      indent: '  ', // 2 spaces (common JS convention)
      lineEnding: '\n',
      ecmaVersion: 'es2020', // Target ECMAScript version
      strictTypes: false,
      useModules: true,
      addJSDoc: true,
      useArrowFunctions: true,
      useTemplateLiterals: true,
      useClasses: true,
      useDestructuring: true,
      useSpreadOperator: true,
      useOptionalChaining: true,
      useNullishCoalescing: true,
      useAsyncAwait: true,
      useBigInt: true,
      usePrivateFields: true,
      useAstPipeline: true // Enable new AST pipeline by default
    };

    // Option metadata - defines enum choices
    this.optionsMeta = {
      ecmaVersion: {
        type: 'enum',
        choices: [
          { value: 'es3', label: 'ES3 (1999)', description: 'ECMAScript 3 - Original JavaScript standard' },
          { value: 'es5', label: 'ES5 (2009)', description: 'ECMAScript 5 - Strict mode, JSON, Array methods' },
          { value: 'es2015', label: 'ES2015/ES6', description: 'Classes, arrow functions, let/const, promises' },
          { value: 'es2016', label: 'ES2016/ES7', description: 'Array.includes, exponentiation operator' },
          { value: 'es2017', label: 'ES2017/ES8', description: 'Async/await, Object.entries/values' },
          { value: 'es2018', label: 'ES2018/ES9', description: 'Spread properties, async iteration' },
          { value: 'es2019', label: 'ES2019/ES10', description: 'Array.flat, Object.fromEntries' },
          { value: 'es2020', label: 'ES2020/ES11', description: 'Optional chaining, nullish coalescing, BigInt' },
          { value: 'es2021', label: 'ES2021/ES12', description: 'String.replaceAll, Promise.any' },
          { value: 'es2022', label: 'ES2022/ES13', description: 'Class fields, top-level await' },
          { value: 'es2023', label: 'ES2023/ES14', description: 'Array findLast, Hashbang support' },
          { value: 'esnext', label: 'ESNext', description: 'Latest ECMAScript features' }
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

    // Option constraints - which options are available based on ECMAScript version
    this.optionConstraints = {
      useArrowFunctions: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Arrow functions require ES2015 or later'
      },
      useClasses: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Classes require ES2015 or later'
      },
      useTemplateLiterals: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Template literals require ES2015 or later'
      },
      useDestructuring: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Destructuring requires ES2015 or later'
      },
      useSpreadOperator: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Spread operator requires ES2015 or later'
      },
      useModules: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'ES modules require ES2015 or later'
      },
      useAsyncAwait: {
        enabledWhen: { ecmaVersion: ['es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Async/await requires ES2017 or later'
      },
      useOptionalChaining: {
        enabledWhen: { ecmaVersion: ['es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Optional chaining requires ES2020 or later'
      },
      useNullishCoalescing: {
        enabledWhen: { ecmaVersion: ['es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Nullish coalescing requires ES2020 or later'
      },
      useBigInt: {
        enabledWhen: { ecmaVersion: ['es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'BigInt requires ES2020 or later'
      },
      usePrivateFields: {
        enabledWhen: { ecmaVersion: ['es2022', 'es2023', 'esnext'] },
        disabledReason: 'Private class fields require ES2022 or later'
      }
    };

    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Check if current ECMAScript version is at least the specified level
   * @private
   */
  _isVersionAtLeast(options, minVersion) {
    const current = options.ecmaVersion || 'es2020';
    const levels = {
      'es3': 1, 'es5': 2, 'es2015': 3, 'es2016': 4, 'es2017': 5,
      'es2018': 6, 'es2019': 7, 'es2020': 8, 'es2021': 9,
      'es2022': 10, 'es2023': 11, 'esnext': 12
    };
    const minLevel = levels[minVersion] || 0;
    const currentLevel = levels[current] || 8;
    return currentLevel >= minLevel;
  }

  /**
   * Check if ES5 or later
   * @private
   */
  _isES5OrLater(options) {
    return this._isVersionAtLeast(options, 'es5');
  }

  /**
   * Check if ES2015 (ES6) or later
   * @private
   */
  _isES2015OrLater(options) {
    return this._isVersionAtLeast(options, 'es2015');
  }

  /**
   * Check if ES2017 or later
   * @private
   */
  _isES2017OrLater(options) {
    return this._isVersionAtLeast(options, 'es2017');
  }

  /**
   * Check if ES2020 or later
   * @private
   */
  _isES2020OrLater(options) {
    return this._isVersionAtLeast(options, 'es2020');
  }

  /**
   * Check if ES2022 or later
   * @private
   */
  _isES2022OrLater(options) {
    return this._isVersionAtLeast(options, 'es2022');
  }

  /**
   * Get variable declaration keyword based on version and mutability
   * @private
   */
  _getVarKeyword(options, isConst = false) {
    if (this._isES2015OrLater(options)) {
      return isConst ? 'const' : 'let';
    }
    return 'var';
  }

  /**
   * Check if arrow functions are supported and enabled
   * @private
   */
  _supportsArrowFunctions(options) {
    return this._isES2015OrLater(options) && options.useArrowFunctions;
  }

  /**
   * Check if classes are supported and enabled
   * @private
   */
  _supportsClasses(options) {
    return this._isES2015OrLater(options) && options.useClasses;
  }

  /**
   * Check if template literals are supported and enabled
   * @private
   */
  _supportsTemplateLiterals(options) {
    return this._isES2015OrLater(options) && options.useTemplateLiterals;
  }

  /**
   * Check if destructuring is supported and enabled
   * @private
   */
  _supportsDestructuring(options) {
    return this._isES2015OrLater(options) && options.useDestructuring;
  }

  /**
   * Check if spread operator is supported and enabled
   * @private
   */
  _supportsSpread(options) {
    return this._isES2015OrLater(options) && options.useSpreadOperator;
  }

  /**
   * Check if async/await is supported and enabled
   * @private
   */
  _supportsAsyncAwait(options) {
    return this._isES2017OrLater(options) && options.useAsyncAwait;
  }

  /**
   * Check if optional chaining is supported and enabled
   * @private
   */
  _supportsOptionalChaining(options) {
    return this._isES2020OrLater(options) && options.useOptionalChaining;
  }

  /**
   * Check if nullish coalescing is supported and enabled
   * @private
   */
  _supportsNullishCoalescing(options) {
    return this._isES2020OrLater(options) && options.useNullishCoalescing;
  }

  /**
   * Check if BigInt is supported and enabled
   * @private
   */
  _supportsBigInt(options) {
    return this._isES2020OrLater(options) && options.useBigInt;
  }

  /**
   * Check if private class fields are supported and enabled
   * @private
   */
  _supportsPrivateFields(options) {
    return this._isES2022OrLater(options) && options.usePrivateFields;
  }

  /**
   * Get string concatenation or template literal based on version
   * @private
   */
  _makeString(options, parts) {
    if (this._supportsTemplateLiterals(options) && parts.length > 1) {
      // Use template literal for string interpolation
      return '`' + parts.map((p, i) => i % 2 === 0 ? p : '${' + p + '}').join('') + '`';
    }
    // Use string concatenation for older versions
    return parts.map((p, i) => i % 2 === 0 ? '"' + p + '"' : p).join(' + ');
  }

  /**
   * Generate JavaScript code from Abstract Syntax Tree
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
      if (mergedOptions.useAstPipeline && JavaScriptTransformer && JavaScriptEmitter) {
        return this._generateWithAstPipeline(ast, mergedOptions);
      }

      // Reset state for clean generation (legacy mode)
      this.indentLevel = 0;

      // Generate JavaScript code using legacy direct emission
      const code = this._generateNode(ast, mergedOptions);

      // Add standard headers and exports
      const finalCode = this._wrapWithHeaders(code, mergedOptions);

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);

      return this.CreateSuccessResult(finalCode, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate JavaScript code using the new AST pipeline
   * Pipeline: IL AST -> JS Transformer -> JS AST -> JS Emitter -> JS Source
   * @private
   */
  _generateWithAstPipeline(ast, options) {
    try {
      // Create transformer
      const transformer = new JavaScriptTransformer({});

      // Transform IL AST to JavaScript AST
      const jsAst = transformer.transform(ast);

      // Create emitter with options
      const emitter = new JavaScriptEmitter({
        indent: options.indent || '  ',
        newline: options.lineEnding || options.newline || '\n'
      });

      // Emit JavaScript code from JavaScript AST
      const code = emitter.emit(jsAst);

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, options);

      // Generate warnings if any
      const warnings = this._generateWarnings(ast, options);

      return this.CreateSuccessResult(code, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`AST pipeline failed: ${error.message}\n${error.stack}`);
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

    // Store options for use in helper methods
    this._currentOptions = options;
    
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
      case 'ThisExpression':
        return 'this';
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'SwitchStatement':
        return this._generateSwitchStatement(node, options);
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      default:
        // Better fallback: try to extract basic structure
        if (node.body && Array.isArray(node.body)) {
          return this._generateProgram(node, options);
        }
        return `/* Unimplemented AST node: ${node.type} */`;
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

    const le = this._lineEnding();
    return statements.join(le + le);
  }

  /**
   * Generate function declaration
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? node.id.name : 'unnamedFunction';
    const le = this._lineEnding();
    let code = '';

    // JSDoc comment
    if (options.addJSDoc) {
      code += this._indent('/**' + le);
      code += this._indent(` * ${functionName} function` + le);
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          const paramType = options.strictTypes ? this._inferType(param) : '*';
          code += this._indent(` * @param {${paramType}} ${paramName} - parameter` + le);
        });
      }
      const returnType = options.strictTypes ? this._inferReturnType(node) : '*';
      code += this._indent(` * @returns {${returnType}} return value` + le);
      code += this._indent(' */' + le);
    }

    // Function signature (using regular function or arrow function based on options and version)
    const useArrow = this._supportsArrowFunctions(options) && !this._isTopLevelFunction(node);
    if (useArrow) {
      const varKeyword = this._getVarKeyword(options, true);
      code += this._indent(`${varKeyword} ${functionName} = (`);
    } else {
      code += this._indent(`function ${functionName}(`);
    }

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => param.name || 'param');
      code += params.join(', ');
    }

    if (useArrow) {
      code += ') => {' + le;
    } else {
      code += ') {' + le;
    }

    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("throw new Error('Not implemented');" + le);
    } else {
      code += this._indent("throw new Error('Not implemented');" + le);
    }
    this.indentLevel--;

    if (useArrow) {
      code += this._indent('};' + le);
    } else {
      code += this._indent('}' + le);
    }

    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    const le = this._lineEnding();
    let code = '';

    // Check if classes are supported
    if (!this._supportsClasses(options)) {
      // Fall back to constructor function pattern for pre-ES2015
      return this._generateClassAsConstructor(node, options);
    }

    // JSDoc for class
    if (options.addJSDoc) {
      code += this._indent('/**' + le);
      code += this._indent(` * ${className} class` + le);
      code += this._indent(' */' + le);
    }

    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className} extends ${superName} {` + le);
    } else {
      code += this._indent(`class ${className} {` + le);
    }

    // Class body
    this.indentLevel++;
    const bodyMembers = node.body?.body || node.body || [];
    if (bodyMembers.length > 0) {
      const methods = bodyMembers
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join(le + le);
    }
    this.indentLevel--;

    code += this._indent('}' + le);

    return code;
  }

  /**
   * Generate class as constructor function for pre-ES2015
   * @private
   */
  _generateClassAsConstructor(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    const le = this._lineEnding();
    let code = '';

    // JSDoc for constructor
    if (options.addJSDoc) {
      code += this._indent('/**' + le);
      code += this._indent(` * ${className} constructor function` + le);
      code += this._indent(' * @constructor' + le);
      code += this._indent(' */' + le);
    }

    // Constructor function
    code += this._indent(`function ${className}() {` + le);
    this.indentLevel++;

    // Find constructor method and inline its body
    const bodyMembers = node.body?.body || node.body || [];
    const constructorMethod = bodyMembers.find(m => m.key && m.key.name === 'constructor');
    if (constructorMethod && constructorMethod.value && constructorMethod.value.body) {
      const bodyCode = this._generateNode(constructorMethod.value.body, options);
      code += bodyCode;
    }

    this.indentLevel--;
    code += this._indent('}' + le + le);

    // Handle inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`${className}.prototype = Object.create(${superName}.prototype);` + le);
      code += this._indent(`${className}.prototype.constructor = ${className};` + le + le);
    }

    // Add methods to prototype
    const methods = bodyMembers.filter(m => m.key && m.key.name !== 'constructor');
    methods.forEach(method => {
      if (method.key && method.value) {
        const methodName = method.key.name;

        if (options.addJSDoc) {
          code += this._indent('/**' + le);
          code += this._indent(` * ${methodName} method` + le);
          code += this._indent(' */' + le);
        }

        code += this._indent(`${className}.prototype.${methodName} = function(`);

        // Parameters
        if (method.value.params && method.value.params.length > 0) {
          const params = method.value.params.map(param => param.name || 'param');
          code += params.join(', ');
        }

        code += ') {' + le;

        this.indentLevel++;
        if (method.value.body) {
          const bodyCode = this._generateNode(method.value.body, options);
          code += bodyCode;
        }
        this.indentLevel--;

        code += this._indent('};' + le + le);
      }
    });

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
    const le = this._lineEnding();
    let code = '';

    // JSDoc
    if (options.addJSDoc) {
      code += this._indent('/**' + le);
      code += this._indent(` * ${isConstructor ? 'Constructor' : methodName + ' method'}` + le);
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          const paramType = options.strictTypes ? this._inferType(param) : '*';
          code += this._indent(` * @param {${paramType}} ${paramName} - parameter` + le);
        });
      }
      if (!isConstructor) {
        const returnType = options.strictTypes ? this._inferReturnType(node.value) : '*';
        code += this._indent(` * @returns {${returnType}} return value` + le);
      }
      code += this._indent(' */' + le);
    }

    // Method signature
    code += this._indent(`${methodName}(`);

    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => param.name || 'param');
      code += params.join(', ');
    }

    code += ') {' + le;

    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      // Empty body is valid in JavaScript (constructors and methods)
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
    }
    this.indentLevel--;

    code += this._indent('}' + le);

    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    const le = this._lineEnding();
    if (!node.body || node.body.length === 0) {
      return this._indent("throw new Error('Empty block');" + le);
    }

    return node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim())
      .join(le);
  }

  /**
   * Generate variable declaration
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';

    const le = this._lineEnding();
    return node.declarations
      .map(decl => {
        const varName = decl.id ? decl.id.name : 'variable';

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use appropriate keyword based on ECMAScript version
          let keyword = node.kind || 'let';
          if (!this._isES2015OrLater(options)) {
            keyword = 'var'; // Fall back to var for ES3/ES5
          }
          return this._indent(`${keyword} ${varName} = ${initValue};` + le);
        } else {
          const keyword = this._getVarKeyword(options, false);
          return this._indent(`${keyword} ${varName};` + le);
        }
      })
      .join('');
  }

  /**
   * Generate expression statement
   * @private
   */
  _generateExpressionStatement(node, options) {
    const le = this._lineEnding();
    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(expr + ';' + le) : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    const le = this._lineEnding();
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent(`return ${returnValue};` + le);
    } else {
      return this._indent('return;' + le);
    }
  }

  /**
   * Generate binary expression
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression
   * @private
   */
  _generateCallExpression(node, options) {
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle member expressions with method calls
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const propertyName = node.callee.property.name || node.callee.property;

      // Handle OpCodes method calls
      if (object === 'OpCodes') {
        return this._generateOpCodesCall(propertyName, args);
      }
    }

    const callee = this._generateNode(node.callee, options);
    return `${callee}(${args})`;
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      `[${this._generateNode(node.property, options)}]` : 
      `.${node.property.name || node.property}`;
    
    return `${object}${property}`;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return node.name;
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      // Use template literals if enabled, supported, and string contains variables
      if (this._supportsTemplateLiterals(options) && this._shouldUseTemplateLiteral(node.value)) {
        return `\`${node.value.replace(/`/g, '\\`')}\``;
      }
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'null';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else if (typeof node.value === 'bigint' || (node.raw && node.raw.endsWith('n'))) {
      // BigInt literal
      if (this._supportsBigInt(options)) {
        return String(node.value) + 'n';
      }
      // Fall back to regular number for older versions (may lose precision)
      return String(node.value);
    } else {
      return String(node.value);
    }
  }

  /**
   * Generate empty statement
   * @private
   */
  _generateEmptyStatement(node, options) {
    const le = this._lineEnding();
    return this._indent(';' + le);
  }

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    // Operators like typeof, void, delete need space
    const needsSpace = ['typeof', 'void', 'delete'].includes(operator);

    if (node.prefix) {
      return needsSpace ? `${operator} ${argument}` : `${operator}${argument}`;
    } else {
      // Postfix (rare, usually handled by UpdateExpression)
      return `${argument}${operator}`;
    }
  }

  /**
   * Generate update expression (++/--)
   * @private
   */
  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (node.prefix) {
      return `${operator}${argument}`;
    } else {
      return `${argument}${operator}`;
    }
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    const le = this._lineEnding();
    let code = '';

    code += this._indent('if (');
    code += this._generateNode(node.test, options);
    code += ') ';

    // Handle consequent (if branch)
    if (node.consequent.type === 'BlockStatement') {
      code += '{' + le;
      this.indentLevel++;
      code += this._generateNode(node.consequent, options);
      this.indentLevel--;
      code += this._indent('}');
    } else {
      code += le;
      this.indentLevel++;
      code += this._generateNode(node.consequent, options);
      this.indentLevel--;
    }

    // Handle alternate (else branch)
    if (node.alternate) {
      code += ' else ';

      if (node.alternate.type === 'IfStatement') {
        // else if
        code += this._generateNode(node.alternate, options).trim();
      } else if (node.alternate.type === 'BlockStatement') {
        code += '{' + le;
        this.indentLevel++;
        code += this._generateNode(node.alternate, options);
        this.indentLevel--;
        code += this._indent('}');
      } else {
        code += le;
        this.indentLevel++;
        code += this._generateNode(node.alternate, options);
        this.indentLevel--;
      }
    }

    code += le;
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    const le = this._lineEnding();
    let code = this._indent('for (');

    // Init
    if (node.init) {
      const initCode = this._generateNode(node.init, options);
      code += initCode.trim().replace(/;\s*$/, '');
    }
    code += '; ';

    // Test
    if (node.test) {
      code += this._generateNode(node.test, options);
    }
    code += '; ';

    // Update
    if (node.update) {
      code += this._generateNode(node.update, options);
    }

    code += ') ';

    // Body
    if (node.body.type === 'BlockStatement') {
      code += '{' + le;
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('}' + le);
    } else {
      code += le;
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    const le = this._lineEnding();
    let code = this._indent('while (');
    code += this._generateNode(node.test, options);
    code += ') ';

    // Body
    if (node.body.type === 'BlockStatement') {
      code += '{' + le;
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('}' + le);
    } else {
      code += le;
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const le = this._lineEnding();
    let code = this._indent('switch (');
    code += this._generateNode(node.discriminant, options);
    code += ') {' + le;

    this.indentLevel++;

    // Generate cases
    if (node.cases && node.cases.length > 0) {
      node.cases.forEach(caseNode => {
        if (caseNode.test) {
          // Regular case
          code += this._indent(`case ${this._generateNode(caseNode.test, options)}:` + le);
        } else {
          // Default case
          code += this._indent('default:' + le);
        }

        // Case body
        this.indentLevel++;
        if (caseNode.consequent && caseNode.consequent.length > 0) {
          caseNode.consequent.forEach(stmt => {
            code += this._generateNode(stmt, options);
          });
        }
        this.indentLevel--;
      });
    }

    this.indentLevel--;
    code += this._indent('}' + le);

    return code;
  }

  /**
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const le = this._lineEnding();
    const elements = node.elements.map(elem => {
      if (elem === null) {
        return ''; // Sparse array
      }
      return this._generateNode(elem, options);
    });

    // Simple inline for short arrays
    if (elements.length <= 5 && elements.every(e => e.length < 20)) {
      return `[${elements.join(', ')}]`;
    }

    // Multi-line for longer arrays
    let code = '[' + le;
    this.indentLevel++;
    elements.forEach((elem, idx) => {
      code += this._indent(elem);
      if (idx < elements.length - 1) {
        code += ',';
      }
      code += le;
    });
    this.indentLevel--;
    code += this._indent(']');

    return code;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '{}';
    }

    const le = this._lineEnding();

    // Simple inline for small objects
    if (node.properties.length === 1) {
      const prop = node.properties[0];
      const key = prop.key.name || this._generateNode(prop.key, options);
      const value = this._generateNode(prop.value, options);
      return `{ ${key}: ${value} }`;
    }

    // Multi-line for larger objects
    let code = '{' + le;
    this.indentLevel++;

    node.properties.forEach((prop, idx) => {
      let key;
      if (prop.computed) {
        key = `[${this._generateNode(prop.key, options)}]`;
      } else if (prop.key.type === 'Identifier') {
        key = prop.key.name;
      } else {
        key = this._generateNode(prop.key, options);
      }

      const value = this._generateNode(prop.value, options);
      code += this._indent(`${key}: ${value}`);

      if (idx < node.properties.length - 1) {
        code += ',';
      }
      code += le;
    });

    this.indentLevel--;
    code += this._indent('}');

    return code;
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    const le = this._lineEnding();
    let code = 'function';

    // Named function expression
    if (node.id) {
      code += ` ${node.id.name}`;
    }

    code += '(';

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => param.name || 'param');
      code += params.join(', ');
    }

    code += ') {' + le;

    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      // Empty body is valid in JavaScript
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
    }
    this.indentLevel--;

    code += this._indent('}');

    return code;
  }

  /**
   * Generate arrow function expression
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    const le = this._lineEnding();

    // Fall back to regular function for pre-ES2015
    if (!this._supportsArrowFunctions(options)) {
      return this._generateFunctionExpression(node, options);
    }

    let code = '(';

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => param.name || 'param');
      code += params.join(', ');
    }

    code += ') => ';

    // Body
    if (node.body.type === 'BlockStatement') {
      code += '{' + le;
      this.indentLevel++;
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("throw new Error('Not implemented');" + le);
      this.indentLevel--;
      code += this._indent('}');
    } else {
      // Expression body (implicit return)
      code += this._generateNode(node.body, options);
    }

    return code;
  }

  /**
   * Check if this is a top-level function declaration
   * @private
   */
  _isTopLevelFunction(node) {
    // For now, assume all function declarations are top-level
    // Could be enhanced with more context tracking
    return true;
  }

  /**
   * Check if string should use template literal
   * @private
   */
  _shouldUseTemplateLiteral(str) {
    // Simple heuristic: use template literals for strings with ${} patterns
    return str.includes('${');
  }

  /**
   * Add proper indentation
   * @private
   */
  _indent(code) {
    const options = this._currentOptions || this.options;
    const indentStr = options.indent.repeat(this.indentLevel);
    const lineEnding = options.lineEnding;
    return code.split('\n').map(line =>
      line.trim() ? indentStr + line : line
    ).join(lineEnding);
  }

  /**
   * Get line ending character(s) based on options
   * @private
   */
  _lineEnding() {
    const options = this._currentOptions || this.options;
    return options.lineEnding;
  }

  /**
   * Wrap generated code with necessary headers
   * @private
   */
  _wrapWithHeaders(code, options) {
    const le = options.lineEnding;
    let headers = '';

    // Add version-appropriate comment
    const versionLabel = this._getVersionLabel(options);
    headers += `// JavaScript ${versionLabel}` + le;

    // Add "use strict" for ES5+
    if (this._isES5OrLater(options)) {
      headers += '"use strict";' + le;
    }

    // Add module comment for ES2015+
    if (this._isES2015OrLater(options) && options.useModules) {
      headers += '// ES Module' + le;
    }

    headers += le;

    return headers + code;
  }

  /**
   * Get human-readable version label
   * @private
   */
  _getVersionLabel(options) {
    const version = options.ecmaVersion || 'es2020';
    const labels = {
      'es3': 'ES3 (1999)',
      'es5': 'ES5 (2009)',
      'es2015': 'ES2015 (ES6)',
      'es2016': 'ES2016 (ES7)',
      'es2017': 'ES2017 (ES8)',
      'es2018': 'ES2018 (ES9)',
      'es2019': 'ES2019 (ES10)',
      'es2020': 'ES2020 (ES11)',
      'es2021': 'ES2021 (ES12)',
      'es2022': 'ES2022 (ES13)',
      'es2023': 'ES2023 (ES14)',
      'esnext': 'ESNext'
    };
    return labels[version] || version;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // JavaScript typically doesn't have external dependencies for basic features
    // Could be enhanced to detect specific library usage
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Version-specific warnings
    if (!this._isES2015OrLater(options)) {
      warnings.push('Pre-ES2015 code may not support modern features like classes, arrow functions, or let/const');
    }

    if (!this._isES5OrLater(options)) {
      warnings.push('ES3 code is very limited - consider upgrading target for better compatibility');
    }

    // Check for potential improvements
    if (this._isES2015OrLater(options) && !options.useArrowFunctions) {
      warnings.push('Consider enabling arrow functions for more concise code');
    }

    if (this._isES2015OrLater(options) && !options.useTemplateLiterals) {
      warnings.push('Consider enabling template literals for string interpolation');
    }

    if (this._isES2020OrLater(options) && !options.useOptionalChaining) {
      warnings.push('Consider enabling optional chaining for safer property access');
    }

    if (this._isES2020OrLater(options) && !options.useNullishCoalescing) {
      warnings.push('Consider enabling nullish coalescing for cleaner default values');
    }

    return warnings;
  }

  /**
   * Check if Node.js is available on the system
   * @private
   */
  _isNodeAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('node --version', { 
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
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}' };
      const opening = Object.keys(pairs);
      const closing = Object.values(pairs);
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        // Skip string literals
        if (char === '"' || char === "'" || char === '`') {
          const quote = char;
          i++; // Skip opening quote
          while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        if (opening.includes(char)) {
          stack.push(char);
        } else if (closing.includes(char)) {
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
   * Validate JavaScript code syntax using Node.js
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Node.js is available first
    const nodeAvailable = this._isNodeAvailable();
    if (!nodeAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Node.js not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_js_${Date.now()}.js`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to parse the JavaScript code
        execSync(`node --check "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 2000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'node',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'node',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Node.js is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Node.js not available - using basic validation'
      };
    }
  }

  /**
   * Get Node.js runtime download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Node.js',
      downloadUrl: 'https://nodejs.org/en/download/',
      installInstructions: [
        'Download Node.js from https://nodejs.org/en/download/',
        'Run the installer for your operating system',
        'Verify installation with: node --version',
        'JavaScript can also run in any web browser',
        '',
        'ECMAScript version support:',
        '  ES3: All browsers since Netscape 4 / IE4',
        '  ES5: All modern browsers, Node.js 0.10+',
        '  ES2015: Node.js 6+, Chrome 51+, Firefox 52+, Safari 10+',
        '  ES2017: Node.js 8+, Chrome 55+, Firefox 52+, Safari 10.1+',
        '  ES2020: Node.js 14+, Chrome 80+, Firefox 72+, Safari 13.1+',
        '  ES2022: Node.js 16.11+, Chrome 94+, Firefox 93+, Safari 15+'
      ].join('\n'),
      verifyCommand: 'node --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'npm',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      supportedVersions: ['es3', 'es5', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext']
    };
  }

  /**
   * Generate OpCodes method call - JavaScript keeps OpCodes as-is
   * since it's the source language
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // JavaScript is the source language, so OpCodes calls stay the same
    // Just ensure proper formatting
    return `OpCodes.${methodName}(${args})`;
  }

  /**
   * Infer type from parameter node (for strictTypes option)
   * @private
   */
  _inferType(param) {
    // Basic type inference from parameter
    // In a real implementation, this could analyze default values, usage, etc.
    if (param.type === 'AssignmentPattern' && param.right) {
      // Has default value - infer from it
      return this._inferTypeFromValue(param.right);
    }
    // Default to any
    return 'any';
  }

  /**
   * Infer return type from function node (for strictTypes option)
   * @private
   */
  _inferReturnType(node) {
    // Basic return type inference
    // In a real implementation, this could analyze return statements
    if (!node.body) return 'void';

    // Check for return statements in body
    const hasReturn = this._hasReturnStatement(node.body);
    return hasReturn ? 'any' : 'void';
  }

  /**
   * Infer type from a value node
   * @private
   */
  _inferTypeFromValue(node) {
    if (!node) return 'any';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'number') return 'number';
        if (typeof node.value === 'boolean') return 'boolean';
        if (node.value === null) return 'null';
        return 'any';
      case 'ArrayExpression':
        return 'Array';
      case 'ObjectExpression':
        return 'Object';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'Function';
      default:
        return 'any';
    }
  }

  /**
   * Check if a node has return statements
   * @private
   */
  _hasReturnStatement(node) {
    if (!node) return false;

    if (node.type === 'ReturnStatement' && node.argument) {
      return true;
    }

    if (node.type === 'BlockStatement' && node.body) {
      return node.body.some(stmt => this._hasReturnStatement(stmt));
    }

    return false;
  }
}

// Register the plugin
const javaScriptPlugin = new JavaScriptPlugin();
LanguagePlugins.Add(javaScriptPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = javaScriptPlugin;
}


})(); // End of IIFE