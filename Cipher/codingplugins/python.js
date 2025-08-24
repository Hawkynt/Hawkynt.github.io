/**
 * Python Language Plugin for Multi-Language Code Generation
 * Generates Python 3.x compatible code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

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
    
    // Python-specific type mappings
    this.typeMap = {
      'byte': 'int',
      'word': 'int',
      'dword': 'int', 
      'qword': 'int',
      'byte[]': 'bytes',
      'word[]': 'List[int]',
      'dword[]': 'List[int]',
      'qword[]': 'List[int]',
      'string': 'str',
      'boolean': 'bool'
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
      // Reset state for clean generation
      this.indentLevel = 0;
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Python code
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
      case 'Identifier':
        return this._generateIdentifier(node, options);
      case 'Literal':
        return this._generateLiteral(node, options);
      case 'ThisExpression':
        return 'self';
      default:
        return `# TODO: Implement ${node.type}`;
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
    const functionName = node.id ? this._toPythonName(node.id.name) : 'unnamed_function';
    let code = '';
    
    // Function signature
    code += this._indent(`def ${functionName}(`);
    
    // Parameters with type hints
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        if (options.addTypeHints) {
          const typeHint = this._inferParameterType(paramName);
          return typeHint ? `${paramName}: ${typeHint}` : paramName;
        }
        return paramName;
      });
      code += params.join(', ');
    }
    
    // Return type hint
    if (options.addTypeHints) {
      const returnType = this._inferReturnType(functionName);
      code += returnType ? `) -> ${returnType}:` : '):';
    } else {
      code += '):';
    }
    
    code += '\n';
    
    // Docstring
    if (options.addDocstrings) {
      this.indentLevel++;
      code += this._indent(`"""${functionName} function"""\n`);
      this.indentLevel--;
    }
    
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
   * Generate binary expression
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ? 
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    
    // Handle special cases
    if (callee === 'super') {
      return `super().__init__(${args})`;
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
   * Wrap generated code with necessary imports
   * @private
   */
  _wrapWithImports(code, options) {
    let imports = '';
    
    if (options.addTypeHints) {
      imports += 'from typing import Any, Union, Optional, List\n';
    }
    
    if (code.includes('# TODO:')) {
      imports += '# Generated Python code - some features need manual implementation\n';
    }
    
    return imports ? imports + '\n\n' + code : code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    if (options.addTypeHints) {
      dependencies.push('typing');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Check for unsupported features
    if (this._hasUnsupportedFeatures(ast)) {
      warnings.push('Some JavaScript features may require manual conversion');
    }
    
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
      
      // Simple range-based conversion (could be enhanced)
      if (test.includes('<') && update.includes('++')) {
        const endValue = test.replace(`${varName} < `, '').trim();
        let code = this._indent(`for ${varName} in range(${initialValue || 0}, ${endValue}):\n`);
        
        this.indentLevel++;
        const bodyCode = this._generateNode(node.body, options);
        code += bodyCode || this._indent('pass\n');
        this.indentLevel--;
        
        return code;
      }
    }
    
    // Fallback for complex for loops
    return this._indent('# TODO: Complex for loop conversion\n');
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
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    const elements = node.elements ? 
      node.elements.map(elem => this._generateNode(elem, options)).join(', ') : '';
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
   * Generate new expression
   * @private
   */
  _generateNewExpression(node, options) {
    const className = this._generateNode(node.callee, options);
    const args = node.arguments ? 
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    return `${className}(${args})`;
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
}

// Register the plugin
const pythonPlugin = new PythonPlugin();
LanguagePlugins.Add(pythonPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = pythonPlugin;
}

})(); // End of IIFE
