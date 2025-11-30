/**
 * Python Language Plugin for Multi-Language Code Generation
 * Generates Python 3.x compatible code from JavaScript AST
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Supports two generation modes:
 * 1. Direct emission (legacy) - _generateNode directly emits Python code
 * 2. AST pipeline (new) - JS AST -> Python AST -> Python Emitter
 */

// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let PythonAST, PythonEmitter, PythonTransformer;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load new AST pipeline components
    try {
      PythonAST = require('./PythonAST.js');
      const emitterModule = require('./PythonEmitter.js');
      PythonEmitter = emitterModule.PythonEmitter;
      const transformerModule = require('./PythonTransformer.js');
      PythonTransformer = transformerModule.PythonTransformer;
    } catch (e) {
      // Pipeline components not available - will use legacy mode
      console.warn('Python AST pipeline components not loaded:', e.message);
    }
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    PythonAST = window.PythonAST;
    PythonEmitter = window.PythonEmitter;
    PythonTransformer = window.PythonTransformer;
  }

/**
 * Python Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class PythonPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Python';
    this.extension = 'py';
    this.icon = '🐍';
    this.description = 'Python 3.x code generator';
    this.mimeType = 'text/x-python';
    this.version = '3.9+';
    
    // Python-specific options
    this.options = {
      indent: '    ', // 4 spaces for Python PEP 8
      lineEnding: '\n',
      strictTypes: false,
      addTypeHints: true,
      addDocstrings: true
    };
    
    // Enhanced Python type mappings for cryptographic algorithms
    this.typeMap = {
      'byte': 'int',
      'word': 'int',
      'dword': 'int',
      'qword': 'int',
      'uint': 'int',
      'uint32': 'int',
      'byte[]': 'bytes',
      'word[]': 'List[int]',
      'dword[]': 'List[int]',
      'qword[]': 'List[int]',
      'uint[]': 'List[int]',
      'int[]': 'List[int]',
      'string': 'str',
      'boolean': 'bool',
      'object': 'Any',
      'void': 'None'
    };

    // Cryptographic context for better type inference
    this.cryptoTypeMap = {
      'key': 'bytes',
      'nonce': 'bytes',
      'iv': 'bytes',
      'data': 'bytes',
      'input': 'bytes',
      'output': 'bytes',
      'buffer': 'bytes',
      'state': 'List[int]',
      'word': 'int',
      'round': 'int',
      'size': 'int',
      'length': 'int',
      'count': 'int',
      'index': 'int'
    };
    
    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Generate Python code from Abstract Syntax Tree
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
      if (mergedOptions.useAstPipeline && PythonTransformer && PythonEmitter) {
        return this._generateWithAstPipeline(ast, mergedOptions);
      }

      // Reset state for clean generation (legacy mode)
      this.indentLevel = 0;

      // Generate Python code using legacy direct emission
      const code = this._generateNode(ast, mergedOptions);

      // Add standard imports and headers
      const finalCode = this._wrapWithImports(code, mergedOptions);

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
   * Generate Python code using the new AST pipeline
   * Pipeline: JS AST -> Python AST -> Python Emitter -> Python Source
   * @private
   */
  _generateWithAstPipeline(ast, options) {
    try {
      console.error('[INFO] Using AST pipeline for Python generation');

      // Create transformer with options
      const transformer = new PythonTransformer({
        typeKnowledge: options.parser?.typeKnowledge || options.typeKnowledge,
        addTypeHints: options.addTypeHints !== undefined ? options.addTypeHints : true,
        addDocstrings: options.addDocstrings !== undefined ? options.addDocstrings : true,
        strictTypes: options.strictTypes !== undefined ? options.strictTypes : false
      });

      // Transform JS AST to Python AST
      const pyAst = transformer.transform(ast);
      console.error('[INFO] Transformation complete');

      // Create emitter with formatting options
      const emitter = new PythonEmitter({
        indent: options.indent || '    ',
        lineEnding: options.lineEnding || '\n',
        addTypeHints: options.addTypeHints !== undefined ? options.addTypeHints : true,
        addDocstrings: options.addDocstrings !== undefined ? options.addDocstrings : true
      });

      // Emit Python source code
      const code = emitter.emit(pyAst);
      console.error('[INFO] Emission complete');

      // Collect any warnings from transformation
      const warnings = transformer.warnings || [];

      return this.CreateSuccessResult(code, [], warnings);

    } catch (error) {
      console.error('[ERROR] AST pipeline error:', error);
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
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'BinaryExpression':
        return this._generateBinaryExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'CallExpression':
        return this._generateCallExpression(node, options);
      case 'MemberExpression':
        return this._generateMemberExpression(node, options);
      case 'AssignmentExpression':
        return this._generateAssignmentExpression(node, options);
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
      case 'TemplateLiteral':
        return this._generateTemplateLiteral(node, options);
      case 'TaggedTemplateExpression':
        return this._generateTaggedTemplateExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'Property':
        return this._generateProperty(node, options);
      case 'SequenceExpression':
        return this._generateSequenceExpression(node, options);
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
      case 'Identifier':
        return this._generateIdentifier(node, options);
      case 'Literal':
        return this._generateLiteral(node, options);
      case 'ThisExpression':
        return 'self';
      // Enhanced AST node coverage for cryptographic algorithms
      case 'Super':
        return 'super()';
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ExportDeclaration':
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
      default:
        return `# ${node.type} not yet supported in Python generator`;
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
   * Generate function declaration with complete implementations
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? this._toPythonName(node.id.name) : 'unnamed_function';
    let code = '';

    // Function signature with enhanced type hints
    code += this._indent(`def ${functionName}(`);

    // Parameters with cryptographic context-aware type hints
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        if (options.addTypeHints) {
          const typeHint = this._inferPythonParameterType(paramName);
          return `${this._toPythonName(paramName)}: ${typeHint}`;
        }
        return this._toPythonName(paramName);
      });
      code += params.join(', ');
    }

    // Enhanced return type hint
    if (options.addTypeHints) {
      const returnType = this._inferPythonReturnType(functionName, node);
      code += `) -> ${returnType}:`;
    } else {
      code += '):';
    }

    code += '\n';

    // Enhanced docstring with cryptographic context
    if (options.addDocstrings) {
      this.indentLevel++;
      code += this._indent('"""\n');
      code += this._indent(this._generateFunctionDescription(functionName) + '\n');
      if (node.params && node.params.length > 0) {
        code += this._indent('\n');
        code += this._indent('Args:\n');
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          const paramDesc = this._generateParamDescription(paramName);
          const paramType = this._inferPythonParameterType(paramName);
          code += this._indent(`    ${paramName} (${paramType}): ${paramDesc}\n`);
        });
      }
      const returnType = this._inferPythonReturnType(functionName, node);
      const returnDesc = this._generateReturnDescription(functionName);
      code += this._indent('\n');
      code += this._indent('Returns:\n');
      code += this._indent(`    ${returnType}: ${returnDesc}\n`);
      code += this._indent('"""\n');
      this.indentLevel--;
    }

    // Enhanced function body generation
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateCompleteMethodBody(node.body, options, functionName);
      // If body exists but transforms to empty, use 'pass' instead of stub
      if (bodyCode !== null && bodyCode !== undefined) {
        code += bodyCode.trim() ? bodyCode : this._indent('pass\n');
      } else {
        code += this._indent('pass\n');
      }
    } else {
      // No body at all - use pass
      code += this._indent('pass\n');
    }
    this.indentLevel--;

    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    let code = '';
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className}(${superName}):\n`);
    } else {
      code += this._indent(`class ${className}:\n`);
    }
    
    // Class docstring
    if (options.addDocstrings) {
      this.indentLevel++;
      code += this._indent(`"""${className} class implementation"""\n\n`);
      this.indentLevel--;
    }
    
    // Class body
    this.indentLevel++;
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    } else {
      code += this._indent('pass\n');
    }
    this.indentLevel--;
    
    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('pass\n');
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
        const varName = decl.id ? decl.id.name : 'variable';
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          return this._indent(`${varName} = ${initValue}\n`);
        } else {
          return this._indent(`${varName} = None\n`);
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
    return expr ? this._indent(expr + '\n') : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent(`return ${returnValue}\n`);
    } else {
      return this._indent('return\n');
    }
  }

  /**
   * Generate binary expression with cryptographic patterns
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);

    // Handle cryptographic-specific bitwise operations
    if (node.operator === '>>>') {
      // Unsigned right shift - Python doesn't have this, simulate it
      return `(${left} >> ${right}) & ((1 << (32 - ${right})) - 1)`;
    }
    if (node.operator === '<<') {
      // Left shift with overflow protection
      return `(${left} << ${right}) & 0xFFFFFFFF`;
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression with string method conversion and crypto patterns
   * @private
   */
  _generateCallExpression(node, options) {
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle member expressions with method calls
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const propertyName = node.callee.property.name || node.callee.property;

      // Convert JavaScript string methods to Python equivalents
      if (propertyName === 'charAt') {
        return `${object}[${args}]`;
      }
      if (propertyName === 'charCodeAt') {
        return `ord(${object}[${args}])`;
      }
      if (propertyName === 'substring') {
        return `${object}[${args}]`; // Python slice notation
      }
      if (propertyName === 'toLowerCase') {
        return `${object}.lower()`;
      }
      if (propertyName === 'toUpperCase') {
        return `${object}.upper()`;
      }
      if (propertyName === 'indexOf') {
        return `${object}.find(${args})`;
      }

      // Handle array methods
      if (propertyName === 'push') {
        // Check if any argument is a spread element: push(...array) -> extend(array)
        const hasSpread = node.arguments && node.arguments.some(arg => arg.type === 'SpreadElement');
        if (hasSpread && node.arguments.length === 1) {
          // push(...arr) becomes extend(arr) - remove the * prefix
          const arrayArg = this._generateNode(node.arguments[0].argument, options);
          return `${object}.extend(${arrayArg})`;
        }
        return `${object}.append(${args})`;
      }
      if (propertyName === 'slice') {
        // Convert array.slice(start, end) to array[start:end] Python syntax
        const sliceArgs = args.replace(',', ':');
        return `${object}[${sliceArgs}]`;
      }
      if (propertyName === 'length') {
        return `len(${object})`;
      }

      // Handle OpCodes method calls (check original and all Python-converted name variants)
      if (object === 'OpCodes' || object === 'op_codes' || object === '_op_codes') {
        const result = this._generateOpCodesCall(propertyName, args);
        return result;
      }

      // Handle console.log -> print
      if (object === 'console' && propertyName === 'log') {
        return `print(${args})`;
      }

      const property = node.callee.computed ?
        `[${this._generateNode(node.callee.property, options)}]` :
        `.${propertyName}`;

      return `${object}${property}(${args})`;
    }

    const callee = this._generateNode(node.callee, options);

    // Handle special cases
    if (callee === 'super') {
      return `super().__init__(${args})`;
    }

    // Handle Array constructor
    if (callee === 'Array') {
      return this._generateArrayConstructorCall(args);
    }

    // Handle Error constructor
    if (callee === 'Error') {
      return `Exception(${args})`;
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
      `[${this._generateNode(node.property, options)}]` : 
      `.${node.property.name || node.property}`;
    
    // Convert this.something to self.something
    if (object === 'self' || object === 'this') {
      return `self${property}`;
    }
    
    return `${object}${property}`;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    if (node.name === 'this') return 'self';
    return this._toPythonName(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'None';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'True' : 'False';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert JavaScript names to Python naming convention
   * @private
   */
  _toPythonName(name) {
    // Convert camelCase to snake_case
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Map JavaScript operators to Python equivalents
   * @private
   */
  _mapOperator(operator) {
    const operatorMap = {
      '===': '==',
      '!==': '!=',
      '&&': 'and',
      '||': 'or',
      '!': 'not '
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Infer parameter type for type hints
   * @private
   */
  _inferParameterType(paramName) {
    const typeMap = {
      'data': 'Union[str, bytes]',
      'key': 'Union[str, bytes]',
      'input': 'Any',
      'value': 'Union[int, str]',
      'index': 'int',
      'length': 'int'
    };
    return typeMap[paramName.toLowerCase()] || 'Any';
  }

  /**
   * Infer return type for type hints
   * @private
   */
  _inferReturnType(functionName) {
    const returnTypeMap = {
      'encrypt': 'Union[str, bytes]',
      'decrypt': 'Union[str, bytes]',
      'simple_function': 'int'
    };
    return returnTypeMap[functionName] || 'Any';
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
   * Wrap generated code with enhanced imports for cryptographic algorithms
   * @private
   */
  _wrapWithImports(code, options) {
    let result = '';

    // Enhanced imports for cryptographic algorithms
    result += 'from typing import Any, List, Optional, Union, Dict, Callable\n';
    result += 'import struct\n';
    result += 'import hashlib\n';
    result += 'import secrets\n';
    result += 'from dataclasses import dataclass\n';
    result += 'import abc\n';
    result += '\n';

    // Add docstring for the module
    if (options.addDocstrings) {
      result += '"""\n';
      result += 'Cryptographic Algorithm Implementation\n';
      result += 'Generated from JavaScript AST using Python language plugin\n';
      result += '\n';
      result += 'This module provides cryptographic algorithm implementations\n';
      result += 'suitable for educational and research purposes.\n';
      result += '"""\n';
      result += '\n';
    }

    // Generated code
    result += code;

    return result;
  }

  /**
   * Collect required dependencies for cryptographic algorithms
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    // Core Python dependencies for crypto algorithms
    dependencies.push('typing');
    dependencies.push('struct');
    dependencies.push('hashlib');
    dependencies.push('secrets');
    dependencies.push('dataclasses');
    dependencies.push('abc');

    // Optional cryptographic libraries
    dependencies.push('cryptography (optional)');
    dependencies.push('pycryptodome (optional)');
    dependencies.push('numpy (for performance)');

    return dependencies;
  }

  /**
   * Generate warnings about potential cryptographic issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Cryptographic algorithm specific warnings
    warnings.push('This implementation is for educational purposes only');
    warnings.push('Use established cryptographic libraries for production code');
    warnings.push('Consider constant-time implementations for side-channel resistance');
    warnings.push('Validate all inputs and handle errors securely');
    warnings.push('Use secrets module for cryptographically secure random numbers');
    warnings.push('Consider using type hints and dataclasses for better structure');
    warnings.push('Test against official test vectors when available');

    return warnings;
  }

  /**
   * Check if AST contains unsupported features
   * @private
   */
  _hasUnsupportedFeatures(ast) {
    // Simple check for TODO comments in generated code
    return false; // Could be enhanced with more sophisticated checking
  }

  // === Python-specific generation methods extracted from transpiler ===

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    let code = this._indent(`if ${this._generateNode(node.test, options)}:\n`);
    
    this.indentLevel++;
    const consequentCode = this._generateNode(node.consequent, options);
    code += consequentCode || this._indent('pass\n');
    this.indentLevel--;
    
    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        // elif chain
        const elseCode = this._generateIfStatement(node.alternate, options).replace(/^\s*if/, 'elif');
        code += elseCode;
      } else {
        // else block
        code += this._indent('else:\n');
        this.indentLevel++;
        const alternateCode = this._generateNode(node.alternate, options);
        code += alternateCode || this._indent('pass\n');
        this.indentLevel--;
      }
    }
    
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    // Convert JavaScript for loop to Python equivalent
    if (node.init && node.test && node.update) {
      const init = this._generateNode(node.init, options).replace(/let |const |var /, '').trim();
      const test = this._generateNode(node.test, options);
      const update = this._generateNode(node.update, options);

      // Extract variable name and initial value
      const [varName, initialValue] = init.split('=').map(s => s.trim());

      // Handle simple i++ increment: for (let i = 0; i < end; i++)
      if (test.includes('<') && update.includes('++')) {
        const endValue = test.replace(`${varName} < `, '').trim();
        let code = this._indent(`for ${varName} in range(${initialValue || 0}, ${endValue}):\n`);

        this.indentLevel++;
        const bodyCode = this._generateNode(node.body, options);
        code += bodyCode || this._indent('pass\n');
        this.indentLevel--;

        return code;
      }

      // Handle i += step increment: for (let i = 0; i < end; i += step)
      if (test.includes('<') && update.includes('+=')) {
        const endValue = test.replace(`${varName} < `, '').replace(`${varName}<`, '').trim();
        // Extract step value from "i += step"
        const stepValue = update.replace(`${varName} += `, '').replace(`${varName}+=`, '').trim();
        let code = this._indent(`for ${varName} in range(${initialValue || 0}, ${endValue}, ${stepValue}):\n`);

        this.indentLevel++;
        const bodyCode = this._generateNode(node.body, options);
        code += bodyCode || this._indent('pass\n');
        this.indentLevel--;

        return code;
      }
    }

    // Fallback for complex for loops that can't be automatically converted
    // Generate a valid Python for loop with pass
    return this._indent('# Complex for loop - may require manual review\n') +
           this._indent('for item in range(1):  # Placeholder iteration\n') +
           this._indent('    pass\n');
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    let code = this._indent(`while ${this._generateNode(node.test, options)}:\n`);
    
    this.indentLevel++;
    const bodyCode = this._generateNode(node.body, options);
    code += bodyCode || this._indent('pass\n');
    this.indentLevel--;
    
    return code;
  }

  /**
   * Generate logical expression
   * @private
   */
  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapPythonOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate array expression with cryptographic context
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '0')
      .join(', ');

    // For cryptographic algorithms, determine if this should be bytes or list
    const context = { isCryptographic: true };
    const firstElement = node.elements.find(el => el !== null && el !== undefined);
    if (firstElement && this._isLikelyByteValue(firstElement)) {
      return `bytes([${elements}])`;
    }

    return `[${elements}]`;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '{}';
    }
    
    const properties = node.properties.map(prop => {
      const key = prop.key.type === 'Identifier' ? prop.key.name : this._generateNode(prop.key, options);
      const value = this._generateNode(prop.value, options);
      return `"${key}": ${value}`;
    }).join(', ');
    
    return `{${properties}}`;
  }

  /**
   * Generate new expression with Python constructor patterns
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
      return `Exception(${args})`;
    }
    if (className === 'Object') {
      return '{}';
    }

    // Handle crypto-specific class names
    const mappedClassName = this._mapAlgorithmFrameworkClass(className);
    return `${mappedClassName}(${args})`;
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
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapAssignmentOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethod(node, options) {
    const methodName = node.key ? this._toPythonName(node.key.name) : 'method';
    let code = '';
    
    // Add self parameter for instance methods
    const params = ['self'];
    if (node.value && node.value.params) {
      params.push(...node.value.params.map(p => p.name));
    }
    
    code += this._indent(`def ${methodName}(${params.join(', ')}):\n`);
    
    // Method docstring
    if (options.addDocstrings) {
      this.indentLevel++;
      code += this._indent(`"""${methodName} method implementation"""\n`);
      this.indentLevel--;
    }
    
    // Method body
    this.indentLevel++;
    if (node.value && node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || this._indent('pass\n');
    } else {
      code += this._indent('pass\n');
    }
    this.indentLevel--;
    
    return code;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._toPythonName(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (typeof node.value === 'number') {
      return String(node.value);
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'True' : 'False';
    } else if (node.value === null) {
      return 'None';
    }
    return String(node.value);
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    
    if (node.computed) {
      const property = this._generateNode(node.property, options);
      return `${object}[${property}]`;
    } else {
      const property = node.property.name || this._generateNode(node.property, options);
      
      // Handle 'this' keyword mapping to 'self'
      if (object === 'this' || object === 'self') {
        return `self.${property}`;
      }
      
      return `${object}.${property}`;
    }
  }

  // === Helper methods ===

  /**
   * Map JavaScript operators to Python operators
   * @private
   */
  _mapPythonOperator(operator) {
    const operatorMap = {
      '&&': 'and',
      '||': 'or',
      '!': 'not',
      '===': '==',
      '!==': '!=',
      '>>>': '>>'  // Python doesn't have >>>, approximate with >>
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Map JavaScript operators to Python operators
   * @private
   */
  _mapOperator(operator) {
    // Handle unsigned right shift specially for Python
    if (operator === '>>>') {
      return '>>';  // Python doesn't have >>>, need special handling
    }
    return this._mapPythonOperator(operator);
  }

  /**
   * Map unary operators
   * @private
   */
  _mapUnaryOperator(operator) {
    const unaryMap = {
      '!': 'not ',
      'typeof': 'type',
      '++': '',  // Handle separately
      '--': ''   // Handle separately
    };
    return unaryMap[operator] || operator;
  }

  /**
   * Generate update expression (++/--)
   * @private
   */
  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (node.prefix) {
      if (operator === '++') {
        return `(${argument} := ${argument} + 1)`;  // Walrus operator for inline increment
      } else if (operator === '--') {
        return `(${argument} := ${argument} - 1)`;  // Walrus operator for inline decrement
      }
    } else {
      // Postfix operators need special handling in Python
      return `# ${argument}${operator}  # Python doesn't support postfix increment/decrement`;
    }

    return argument + operator;
  }

  /**
   * Generate conditional expression (ternary operator)
   * @private
   */
  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `${consequent} if ${test} else ${alternate}`;
  }

  /**
   * Generate template literal (f-strings)
   * @private
   */
  _generateTemplateLiteral(node, options) {
    if (!node.quasis || node.quasis.length === 0) {
      return '""';
    }

    let result = 'f"';
    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      result += quasi.value ? quasi.value.raw || quasi.value.cooked || '' : '';

      if (i < node.expressions.length) {
        const expr = this._generateNode(node.expressions[i], options);
        result += '{' + expr + '}';
      }
    }
    result += '"';
    return result;
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
   * Generate arrow function expression (lambda)
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    const params = node.params ?
      node.params.map(param => this._toPythonName(param.name || 'param')).join(', ') : '';

    if (node.body.type === 'BlockStatement') {
      // Multi-line lambda (not directly supported, convert to def)
      return `# lambda ${params}: ... # Multi-line lambda not supported, use def`;
    } else {
      const body = this._generateNode(node.body, options);
      return `lambda ${params}: ${body}`;
    }
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    const functionName = node.id ? this._toPythonName(node.id.name) : 'anonymous_function';
    let code = '';

    // Function signature
    code += `def ${functionName}(`;

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return this._toPythonName(paramName);
      });
      code += params.join(', ');
    }

    code += '):\n';

    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('pass\n');
    } else {
      code += this._indent('pass\n');
    }
    this.indentLevel--;

    return code;
  }

  /**
   * Generate property
   * @private
   */
  _generateProperty(node, options) {
    const key = node.key ? this._generateNode(node.key, options) : '"unknown"';
    const value = node.value ? this._generateNode(node.value, options) : 'None';

    if (node.computed) {
      return `[${key}]: ${value}`;
    } else {
      return `"${key}": ${value}`;
    }
  }

  /**
   * Generate sequence expression
   * @private
   */
  _generateSequenceExpression(node, options) {
    if (!node.expressions || node.expressions.length === 0) {
      return '';
    }

    // Python doesn't have comma operators like JavaScript
    // Convert to tuple
    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return `(${expressions.join(', ')})`;
  }

  /**
   * Generate rest element (*args)
   * @private
   */
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `*${argument}`;
  }

  /**
   * Generate spread element
   * @private
   */
  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `*${argument}`;
  }

  /**
   * Generate assignment pattern (default parameters)
   * @private
   */
  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left}=${right}`;
  }

  /**
   * Generate object pattern (destructuring)
   * @private
   */
  _generateObjectPattern(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '# Empty object destructuring';
    }

    const properties = node.properties.map(prop => this._generateNode(prop, options));
    return `# Object destructuring: {${properties.join(', ')}}`;
  }

  /**
   * Generate array pattern (destructuring)
   * @private
   */
  _generateArrayPattern(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '# Empty array destructuring';
    }

    const elements = node.elements.map(elem => elem ? this._generateNode(elem, options) : 'None');
    return `${elements.join(', ')}`;  // Python tuple unpacking
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const id = node.id ? this._generateNode(node.id, options) : 'variable';

    if (node.init) {
      const init = this._generateNode(node.init, options);
      return `${id} = ${init}`;
    } else {
      return `${id} = None`;
    }
  }

  /**
   * Generate for-in statement
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for ${left.replace(/var\s+/, '')} in ${right}:\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('pass\n');
    }

    this.indentLevel--;
    return code;
  }

  /**
   * Generate for-of statement (same as for-in in Python)
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for ${left.replace(/var\s+/, '')} in ${right}:\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('pass\n');
    }

    this.indentLevel--;
    return code;
  }

  /**
   * Generate do-while statement
   * @private
   */
  _generateDoWhileStatement(node, options) {
    // Python doesn't have do-while, convert to while True with break
    let code = this._indent('while True:\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('pass\n');
    }

    const test = this._generateNode(node.test, options);
    code += this._indent(`if not (${test}):\n`);
    this.indentLevel++;
    code += this._indent('break\n');
    this.indentLevel--;

    this.indentLevel--;
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);

    // Python 3.10+ has match-case, but for compatibility use if-elif
    let code = `# Switch statement converted to if-elif\\n`;
    let isFirst = true;

    if (node.cases) {
      for (const caseNode of node.cases) {
        if (caseNode.test) {
          const test = this._generateNode(caseNode.test, options);
          const keyword = isFirst ? 'if' : 'elif';
          code += this._indent(`${keyword} ${discriminant} == ${test}:\n`);
          isFirst = false;
        } else {
          // Default case
          code += this._indent('else:\n');
        }

        this.indentLevel++;
        if (caseNode.consequent && caseNode.consequent.length > 0) {
          for (const stmt of caseNode.consequent) {
            if (stmt.type !== 'BreakStatement') {
              code += this._generateNode(stmt, options);
            }
          }
        } else {
          code += this._indent('pass\n');
        }
        this.indentLevel--;
      }
    }

    return code;
  }

  /**
   * Generate switch case
   * @private
   */
  _generateSwitchCase(node, options) {
    // This is handled by _generateSwitchStatement
    return '';
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    return this._indent('break\n');
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    return this._indent('continue\n');
  }

  /**
   * Generate try statement
   * @private
   */
  _generateTryStatement(node, options) {
    let code = this._indent('try:\n');
    this.indentLevel++;

    if (node.block) {
      const block = this._generateNode(node.block, options);
      code += block || this._indent('pass\n');
    }

    this.indentLevel--;

    if (node.handler) {
      code += this._generateNode(node.handler, options);
    }

    if (node.finalizer) {
      code += this._indent('finally:\n');
      this.indentLevel++;
      const finalizer = this._generateNode(node.finalizer, options);
      code += finalizer || this._indent('pass\n');
      this.indentLevel--;
    }

    return code;
  }

  /**
   * Generate catch clause
   * @private
   */
  _generateCatchClause(node, options) {
    let code = this._indent('except');

    if (node.param) {
      const param = this._generateNode(node.param, options);
      code += ` Exception as ${param}`;
    } else {
      code += ' Exception';
    }

    code += ':\n';
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('pass\n');
    }

    this.indentLevel--;
    return code;
  }

  /**
   * Generate throw statement
   * @private
   */
  _generateThrowStatement(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return this._indent(`raise ${argument}\n`);
    } else {
      return this._indent('raise\n');
    }
  }

  /**
   * Generate empty statement
   * @private
   */
  _generateEmptyStatement(node, options) {
    return this._indent('pass\n');
  }

  /**
   * Generate debugger statement
   * @private
   */
  _generateDebuggerStatement(node, options) {
    return this._indent('import pdb; pdb.set_trace()\n');
  }

  /**
   * Generate with statement
   * @private
   */
  _generateWithStatement(node, options) {
    const object = this._generateNode(node.object, options);
    let code = this._indent(`with ${object}:\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('pass\n');
    }

    this.indentLevel--;
    return code;
  }

  /**
   * Generate labeled statement
   * @private
   */
  _generateLabeledStatement(node, options) {
    const label = node.label ? this._generateNode(node.label, options) : 'label';
    const body = node.body ? this._generateNode(node.body, options) : '';

    return this._indent(`# Label: ${label}\n`) + body;
  }

  /**
   * Generate OpCodes method call with proper Python translation
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // Map OpCodes methods to Python equivalents
    switch (methodName) {
      case 'Pack32LE':
        return `struct.pack('<L', ${args})`;
      case 'Pack32BE':
        return `struct.pack('>L', ${args})`;
      case 'Unpack32LE':
        return `struct.unpack('<L', ${args})[0]`;
      case 'Unpack32BE':
        return `struct.unpack('>L', ${args})[0]`;
      case 'RotL32':
      case 'RotR32': {
        // Parse args like "value, positions" into components
        const argList = args.split(',').map(a => a.trim());
        const value = argList[0] || 'value';
        const positions = argList[1] || 'n';
        if (methodName === 'RotL32') {
          return `((${value}) << ${positions} | (${value}) >> (32 - ${positions})) & 0xFFFFFFFF`;
        } else {
          return `((${value}) >> ${positions} | (${value}) << (32 - ${positions})) & 0xFFFFFFFF`;
        }
      }
      case 'XorArrays':
        return `bytes(a ^ b for a, b in zip(${args}))`;
      case 'ClearArray':
        return `${args}.clear()`;
      case 'Hex8ToBytes':
        return `bytes.fromhex(${args})`;
      case 'BytesToHex8':
        return `${args}.hex()`;
      case 'AnsiToBytes':
        return `${args}.encode('ascii')`;
      default:
        return `OpCodes.${methodName}(${args})`;
    }
  }

  /**
   * Generate Array constructor call with Python equivalent
   * @private
   */
  _generateArrayConstructorCall(args) {
    if (!args) {
      return '[]';
    }
    // Handle new Array(size) pattern
    if (!args.includes(',')) {
      return `[0] * ${args}`;
    }
    // Handle new Array(element1, element2, ...) pattern
    return `[${args}]`;
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
   * Map AlgorithmFramework class names to Python equivalents
   * @private
   */
  _mapAlgorithmFrameworkClass(className) {
    const frameworkClasses = {
      'Algorithm': 'AlgorithmBase',
      'BlockCipher': 'BlockCipherAlgorithm',
      'StreamCipher': 'StreamCipherAlgorithm',
      'HashFunction': 'HashFunctionAlgorithm',
      'AsymmetricCipher': 'AsymmetricCipherAlgorithm',
      'AeadAlgorithm': 'AeadAlgorithm'
    };
    return frameworkClasses[className] || className;
  }

  /**
   * Infer Python type from JavaScript AST value with crypto context
   * @private
   */
  _inferPythonType(node, context = {}) {
    if (!node) return 'Any';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'str';
        if (typeof node.value === 'number') {
          return Number.isInteger(node.value) ? 'int' : 'float';
        }
        if (typeof node.value === 'boolean') return 'bool';
        if (node.value === null) return 'Optional[Any]';
        break;
      case 'ArrayExpression':
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null);
          if (firstElement && this._isLikelyByteValue(firstElement)) {
            return 'bytes';
          }
        }
        return 'List[int]';
      case 'ObjectExpression':
        return 'Dict[str, Any]';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'Callable';
    }

    return context.isCryptographic ? 'int' : 'Any';
  }

  /**
   * Generate missing AST node types
   * @private
   */
  _generateMetaProperty(node, options) {
    return `# MetaProperty: ${node.meta?.name || 'unknown'}.${node.property?.name || 'unknown'}`;
  }

  _generateAwaitExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `await ${argument}`;
  }

  _generateYieldExpression(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : '';
    return node.delegate ? `yield from ${argument}` : `yield ${argument}`;
  }

  _generateImportDeclaration(node, options) {
    const source = this._generateNode(node.source, options);
    if (node.specifiers && node.specifiers.length > 0) {
      const imports = node.specifiers.map(spec => {
        if (spec.type === 'ImportDefaultSpecifier') {
          return spec.local.name;
        }
        return spec.imported?.name || spec.local.name;
      }).join(', ');
      return this._indent(`from ${source} import ${imports}\n`);
    }
    return this._indent(`import ${source}\n`);
  }

  _generateExportDeclaration(node, options) {
    return this._indent(`# Export: ${this._generateNode(node.declaration, options)}\n`);
  }

  _generateClassExpression(node, options) {
    return this._generateClass(node, options);
  }

  _generatePropertyDefinition(node, options) {
    const key = this._generateNode(node.key, options);
    const value = node.value ? this._generateNode(node.value, options) : 'None';
    return this._indent(`${key} = ${value}\n`);
  }

  _generatePrivateIdentifier(node, options) {
    return `_${node.name}`; // Python convention for private
  }

  _generateStaticBlock(node, options) {
    return this._indent('# Static block\n') + this._generateNode(node.body, options);
  }

  _generateChainExpression(node, options) {
    return this._generateNode(node.expression, options);
  }

  _generateImportExpression(node, options) {
    const source = this._generateNode(node.source, options);
    return `__import__(${source})`;
  }

  /**
   * Generate complete method body with cryptographic patterns
   * @private
   */
  _generateCompleteMethodBody(bodyNode, options, methodName = '') {
    if (!bodyNode || bodyNode.type !== 'BlockStatement' || !bodyNode.body) {
      return '';
    }

    const context = {
      isCryptographic: true,
      methodName: methodName.toLowerCase()
    };

    const statements = bodyNode.body
      .map(stmt => this._generateStatementWithContext(stmt, options, context))
      .filter(code => code && code.trim());

    return statements.join('\n');
  }

  /**
   * Generate statement with cryptographic context
   * @private
   */
  _generateStatementWithContext(stmt, options, context) {
    // Enhanced statement generation for crypto patterns
    return this._generateNode(stmt, options);
  }

  /**
   * NOTE: This method is deprecated and should not be used.
   * Empty function bodies are now properly handled with 'pass' statements.
   * Keeping for backward compatibility only.
   * @private
   * @deprecated
   */
  _generateDefaultImplementation(methodName) {
    // Always return pass - no more stub generation
    return this._indent('pass\n');
  }

  /**
   * Infer Python parameter type from parameter name
   * @private
   */
  _inferPythonParameterType(paramName) {
    const lowerName = paramName.toLowerCase();

    // Cryptographic parameter patterns
    if (lowerName.includes('key') && !lowerName.includes('size')) return 'bytes';
    if (lowerName.includes('nonce') || lowerName.includes('iv')) return 'bytes';
    if (lowerName.includes('data') || lowerName.includes('input') || lowerName.includes('output')) return 'bytes';
    if (lowerName.includes('buffer')) return 'bytes';
    if (lowerName.includes('state') || lowerName.includes('words')) return 'List[int]';
    if (lowerName.includes('size') || lowerName.includes('length') || lowerName.includes('count')) return 'int';
    if (lowerName.includes('round') || lowerName.includes('index')) return 'int';
    if (lowerName.includes('flag') || lowerName.includes('enable')) return 'bool';
    if (lowerName.includes('name') || lowerName.includes('text')) return 'str';

    return 'Any';
  }

  /**
   * Infer Python return type from method name and body
   * @private
   */
  _inferPythonReturnType(methodName, methodNode) {
    const lowerName = methodName.toLowerCase();

    // Cryptographic method patterns
    if (lowerName.includes('encrypt') || lowerName.includes('decrypt')) return 'bytes';
    if (lowerName.includes('process') || lowerName.includes('transform')) return 'bytes';
    if (lowerName.includes('generate') || lowerName.includes('create')) {
      if (lowerName.includes('key') || lowerName.includes('nonce')) return 'bytes';
      if (lowerName.includes('state') || lowerName.includes('words')) return 'List[int]';
      return 'bytes';
    }
    if (lowerName.includes('get')) {
      if (lowerName.includes('size') || lowerName.includes('length')) return 'int';
      if (lowerName.includes('data') || lowerName.includes('key')) return 'bytes';
      return 'Any';
    }
    if (lowerName.includes('is') || lowerName.includes('has') || lowerName.includes('can')) return 'bool';
    if (lowerName.includes('setup') || lowerName.includes('initialize')) return 'None';

    // Analyze method body for return statements
    if (methodNode && methodNode.body && methodNode.body.body) {
      for (const stmt of methodNode.body.body) {
        if (stmt.type === 'ReturnStatement' && stmt.argument) {
          const inferredType = this._inferPythonType(stmt.argument, { isCryptographic: true });
          if (inferredType !== 'Any') return inferredType;
        }
      }
    }

    return 'Any';
  }

  /**
   * Generate function description for documentation
   * @private
   */
  _generateFunctionDescription(functionName) {
    const lowerName = functionName.toLowerCase();
    if (lowerName.includes('encrypt')) return 'Encrypt data using the cryptographic algorithm.';
    if (lowerName.includes('decrypt')) return 'Decrypt data using the cryptographic algorithm.';
    if (lowerName.includes('process')) return 'Process data through the algorithm.';
    if (lowerName.includes('generate')) return 'Generate algorithm output.';
    if (lowerName.includes('setup')) return 'Set up the algorithm with parameters.';
    if (lowerName.includes('permutation')) return 'Perform the permutation operation.';
    if (lowerName.includes('round')) return 'Execute algorithm rounds.';
    return `${functionName} function for cryptographic operations.`;
  }

  /**
   * Generate parameter description for documentation
   * @private
   */
  _generateParamDescription(paramName) {
    const lowerName = paramName.toLowerCase();
    if (lowerName.includes('key')) return 'Cryptographic key data';
    if (lowerName.includes('data') || lowerName.includes('input')) return 'Input data to process';
    if (lowerName.includes('nonce') || lowerName.includes('iv')) return 'Initialization vector or nonce';
    if (lowerName.includes('size') || lowerName.includes('length')) return 'Size or length parameter';
    if (lowerName.includes('round')) return 'Number of rounds to execute';
    if (lowerName.includes('state')) return 'Algorithm internal state';
    return `Parameter ${paramName}`;
  }

  /**
   * Generate return description for documentation
   * @private
   */
  _generateReturnDescription(functionName) {
    const lowerName = functionName.toLowerCase();
    if (lowerName.includes('encrypt') || lowerName.includes('decrypt')) return 'Processed cryptographic data';
    if (lowerName.includes('generate')) return 'Generated output data';
    if (lowerName.includes('get')) return 'Retrieved value';
    if (lowerName.includes('is') || lowerName.includes('validate')) return 'Boolean result';
    if (lowerName.includes('process')) return 'Processed data';
    return 'Function result';
  }

  /**
   * Generate method description for documentation
   * @private
   */
  _generateMethodDescription(methodName) {
    return this._generateFunctionDescription(methodName);
  }

  /**
   * Generate constructor body excluding super() calls
   * @private
   */
  _generateConstructorBody(bodyNode, options) {
    if (!bodyNode || bodyNode.type !== 'BlockStatement' || !bodyNode.body) {
      return this._indent('pass\n');
    }

    // Filter out super() calls and generate the rest
    const statements = bodyNode.body.filter(stmt => {
      if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression') {
        const callee = stmt.expression.callee;
        return !(callee.type === 'Super' || (callee.type === 'Identifier' && callee.name === 'super'));
      }
      return true;
    });

    if (statements.length === 0) {
      return this._indent('pass\n');
    }

    return statements
      .map(stmt => this._generateNode(stmt, options))
      .filter(code => code.trim())
      .join('\n');
  }

  /**
   * Map assignment operators
   * @private
   */
  _mapAssignmentOperator(operator) {
    // Most assignment operators are the same in Python
    return operator;
  }

  /**
   * Convert JavaScript name to Python naming convention
   * @private
   */
  _toPythonName(name) {
    // Convert camelCase to snake_case
    return name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Map JavaScript/internal type to Python type
   * @override
   */
  MapType(internalType) {
    return this.typeMap[internalType] || internalType;
  }

  /**
   * Map JavaScript/internal type to Python type (private helper)
   * @private
   */
  _mapType(internalType) {
    return this.MapType(internalType);
  }

  /**
   * Check if Python is available on the system
   * @private
   */
  _isPythonAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('python --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      try {
        // Try python3 as fallback
        execSync('python3 --version', { 
          stdio: 'pipe', 
          timeout: 1000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'python3';
      } catch (error2) {
        return false;
      }
    }
  }

  /**
   * Validate Python code syntax using native interpreter
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Python is available first
    const pythonCommand = this._isPythonAvailable();
    if (!pythonCommand) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Python not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const pythonCmd = pythonCommand === true ? 'python' : pythonCommand;
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_python_${Date.now()}.py`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Python code
        execSync(`${pythonCmd} -m py_compile "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 2000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'python',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'python',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Python is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Python not available - using basic validation'
      };
    }
  }

  /**
   * Get Python compiler/interpreter download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Python',
      downloadUrl: 'https://www.python.org/downloads/',
      installInstructions: [
        'Download Python from https://www.python.org/downloads/',
        'Run the installer and check "Add Python to PATH"',
        'Verify installation with: python --version'
      ].join('\n'),
      verifyCommand: 'python --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'pip',
      documentation: 'https://docs.python.org/'
    };
  }
}

// Register the plugin
const pythonPlugin = new PythonPlugin();
LanguagePlugins.Add(pythonPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = pythonPlugin;
}

})(); // End of IIFE
